import { END, MAX_QUESTIONS } from './challenge-schema'
import type { Assessment, Choice, Question, QualityTier, Role, Stage } from './challenge-schema'

/**
 * Deterministic end-of-run feedback — the "how well did you traverse it"
 * report, shown once when a session reaches END (plan: feedback lives at the
 * finish line, not on every answer).
 *
 * Rule-based by design — no AI: every signal is derived from the authored
 * structure (`bestChoice`, the per-choice `stage`/`quality` tags) and the
 * candidate's recorded path. Pure and database-free like scoring.ts, so the
 * summary can fall back to live computation for runs recorded before the
 * feedback snapshot existed.
 */

/** The only fields the engine reads from a recorded path entry. */
export interface RunPathEntry {
  key: string
  choiceIndex: number
  questionText?: string
  choiceText?: string
}

export interface RunChallenge {
  /** The challenge's role track — the report's stage labels come from it. */
  role: Role
  startKey: string
  questions: Record<string, Question>
  /** Unit-layer rubric (optional): when present the report speaks the challenge's own vocabulary. */
  assessment?: Assessment | null
}

/** Candidate-facing verdict names — never the internal `quality` strings. */
export type Verdict = 'strongest' | 'reasonable' | 'missed'
export type Headline = 'strong' | 'solid' | 'mixed' | 'struggled'
export type Trajectory = 'finished-stronger' | 'steady' | 'faded'

/** Weighted credit: a defensible move counts half a strongest call. */
const QUALITY_WEIGHT: Record<QualityTier, number> = { best: 1, reasonable: 0.5, poor: 0 }
const VERDICT_WEIGHT: Record<Verdict, number> = { strongest: 1, reasonable: 0.5, missed: 0 }

/**
 * Candidate-friendly labels for the internal stages (field visibility rule:
 * raw stage strings never reach the candidate — these labels are what the
 * report shows instead). Per role: each role's report speaks its own process
 * vocabulary. FRAME is shared.
 */
const STAGE_LABELS: Record<Role, Record<string, string>> = {
  'Product Design': {
    FRAME: 'Framing the challenge',
    DISCOVER: 'Discovering needs & evidence',
    DEFINE: 'Defining the problem',
    IDEATE: 'Generating options',
    DESIGN: 'Designing the solution',
    TEST: 'Testing with users',
    REFINE: 'Refining the solution'
  },
  'Product Management': {
    FRAME: 'Framing the problem',
    DIAGNOSE: 'Diagnosing the cause',
    STRATEGIZE: 'Setting the direction',
    PRIORITIZE: 'Prioritizing the work',
    PLAN: 'Planning the roadmap',
    EXECUTE: 'Executing and shipping',
    MEASURE: 'Measuring the outcome'
  }
}

export function stageLabel(role: Role, stage: Stage): string {
  return STAGE_LABELS[role][stage] ?? stage
}

/**
 * A choice's quality, derived for content authored before grading existed:
 * untagged choices read as bestChoice → 'best', everything else → 'poor'.
 */
export function qualityOf(choice: Choice, isBest: boolean): QualityTier {
  return choice.quality ?? (isBest ? 'best' : 'poor')
}

export function verdictOf(quality: QualityTier): Verdict {
  if (quality === 'best') return 'strongest'
  if (quality === 'reasonable') return 'reasonable'
  return 'missed'
}

export interface AreaScore {
  area: string
  /** questions in this area on the recorded path */
  count: number
  bestHits: number
  reasonableCalls: number
  /** weighted rate, 0..1 */
  rate: number
  /** human evidence line, e.g. "2 of 3 strongest moves, 1 defensible" */
  evidence: string
}

export interface GrowthArea {
  area: string
  evidence: string
  /** first missed question in this area */
  atQuestion: string
  questionText: string
  strongest: { text: string; because?: string }
}

/**
 * One strand of the challenge's own rubric, scored over the recorded path —
 * the unit layer of the report. `guidance` is the authored remediation; it is
 * what a growth criterion shows instead of a generic explanation.
 */
export interface DimensionScore {
  id: string
  label: string
  guidance: string
  /** how many recorded answers exercised this strand */
  count: number
  bestHits: number
  /** weighted rate over the recorded answers that exercised it, 0..1 */
  rate: number
  evidence: string
  status: 'strength' | 'growth' | 'neutral'
}

export interface QuestionFeedback {
  key: string
  questionText: string
  chosenText: string
  verdict: Verdict
  area: string
  /** true when the kind of move made differs from the kind the question needed */
  mismatch: boolean
  /** what the strongest move was — the payload of a miss; null on a best call */
  strongest: { text: string; because?: string } | null
}

export interface FeedbackReport {
  headline: Headline
  /** weighted rate: best=1, reasonable=0.5, poor=0 */
  rate: number
  strengths: AreaScore[]
  growth: GrowthArea[]
  /**
   * Unit layer: the rubric strands in declared order, or [] when the challenge
   * has no `assessment`. Optional at read time so snapshots frozen before the
   * unit layer existed (and runs on unrubriced content) still validate.
   */
  dimensions?: DimensionScore[]
  traversal: { steps: number; strongestRunSteps: number; earlyExit: boolean }
  trajectory: Trajectory
  perQuestion: QuestionFeedback[]
}

const HEADLINE_BANDS = { STRONG: 0.85, SOLID: 0.6, MIXED: 0.35 } as const
const TRAJECTORY_BAND = 0.25

/**
 * Length of the ideal walk: following bestChoice from start to END. A display
 * benchmark only — scoring deliberately has no path-length component.
 */
export function strongestRunSteps(challenge: RunChallenge): number {
  const { questions, startKey } = challenge
  let key = startKey
  const seen = new Set<string>()
  let steps = 0
  while (key !== END && questions[key] && !seen.has(key) && steps < MAX_QUESTIONS) {
    seen.add(key)
    steps += 1
    const best = questions[key].choices[questions[key].bestChoice]
    key = best?.next ?? END
  }
  return steps
}

/**
 * The report for a finished run. Entries whose question vanished from the graph
 * (content re-imported mid-run) do not score — the same convention as
 * scoreLevel — so a stale path can never throw.
 */
export function evaluateRun(path: readonly RunPathEntry[], challenge: RunChallenge): FeedbackReport {
  const questions = challenge.questions
  const recorded = path.filter(entry => questions[entry.key])

  const perQuestion: QuestionFeedback[] = []
  interface AreaStat {
    count: number
    bestHits: number
    reasonableCalls: number
    weight: number
    firstMissed?: { key: string; questionText: string; best: Choice }
  }
  const byArea = new Map<string, AreaStat>()
  let weightSum = 0

  for (const entry of recorded) {
    const question = questions[entry.key]
    const chosen = question.choices[entry.choiceIndex]
    if (!chosen) continue // defensive: a stale index cannot happen in normal flow
    const isBest = entry.choiceIndex === question.bestChoice
    const best = question.choices[question.bestChoice] ?? chosen
    const quality = qualityOf(chosen, isBest)
    const verdict = verdictOf(quality)
    const area = stageLabel(challenge.role, best.stage)
    weightSum += QUALITY_WEIGHT[quality]

    const stat = byArea.get(area) ?? { count: 0, bestHits: 0, reasonableCalls: 0, weight: 0 }
    stat.count += 1
    stat.weight += QUALITY_WEIGHT[quality]
    if (quality === 'best') stat.bestHits += 1
    if (quality === 'reasonable') stat.reasonableCalls += 1
    if (verdict !== 'strongest' && !stat.firstMissed) {
      stat.firstMissed = { key: entry.key, questionText: entry.questionText ?? question.text, best }
    }
    byArea.set(area, stat)

    perQuestion.push({
      key: entry.key,
      questionText: entry.questionText ?? question.text,
      chosenText: entry.choiceText ?? chosen.text,
      verdict,
      area,
      mismatch: verdict !== 'strongest' && chosen.stage !== best.stage,
      strongest: verdict !== 'strongest' ? { text: best.text, because: best.because } : null
    })
  }

  const answered = perQuestion.length
  const rate = answered === 0 ? 0 : weightSum / answered
  const headline: Headline =
    rate >= HEADLINE_BANDS.STRONG ? 'strong'
    : rate >= HEADLINE_BANDS.SOLID ? 'solid'
    : rate >= HEADLINE_BANDS.MIXED ? 'mixed'
    : 'struggled'

  const areas: AreaScore[] = [...byArea.entries()].map(([area, stat]) => ({
    area,
    count: stat.count,
    bestHits: stat.bestHits,
    reasonableCalls: stat.reasonableCalls,
    rate: stat.weight / stat.count,
    evidence:
      `${stat.bestHits} of ${stat.count} strongest moves` +
      (stat.reasonableCalls > 0 ? `, ${stat.reasonableCalls} defensible` : '')
  }))

  const strengths = areas
    .filter(a => a.rate >= 0.75)
    .sort((a, b) => b.rate - a.rate || b.count - a.count)

  const growth: GrowthArea[] = areas
    .filter(a => a.rate <= 0.5)
    .sort((a, b) => a.rate - b.rate || b.count - a.count)
    .flatMap(a => {
      const missed = byArea.get(a.area)?.firstMissed
      return missed
        ? [{
            area: a.area,
            evidence: a.evidence,
            atQuestion: missed.key,
            questionText: missed.questionText,
            strongest: { text: missed.best.text, because: missed.best.because }
          }]
        : []
    })

  const halfRate = (list: QuestionFeedback[]) =>
    list.length === 0 ? null : list.reduce((sum, q) => sum + VERDICT_WEIGHT[q.verdict], 0) / list.length
  const mid = Math.ceil(answered / 2)
  const firstHalf = halfRate(perQuestion.slice(0, mid))
  const secondHalf = halfRate(perQuestion.slice(mid))
  const trajectory: Trajectory =
    firstHalf === null || secondHalf === null ? 'steady'
    : secondHalf - firstHalf >= TRAJECTORY_BAND ? 'finished-stronger'
    : secondHalf - firstHalf <= -TRAJECTORY_BAND ? 'faded'
    : 'steady'

  const strongestSteps = strongestRunSteps(challenge)
  const lastEntry = recorded[recorded.length - 1]
  const lastChoice = lastEntry ? questions[lastEntry.key]?.choices[lastEntry.choiceIndex] : undefined
  const reachedEnd = lastChoice?.next === END

  // Unit layer: the same answers credited by quality, accrued per rubric
  // strand the *chosen* move exercised. Credit attaches to the move the
  // candidate made (not the ideal one): picking a strong move on a
  // 'root-cause' question is what proves the strand. Untagged moves and
  // strands that appear in play accrue nothing — the report simply omits them.
  const byCriterion = new Map<string, { weight: number; count: number; bestHits: number }>()
  for (const entry of recorded) {
    const question = questions[entry.key]
    const chosen = question.choices[entry.choiceIndex]
    if (!chosen) continue
    const weight = QUALITY_WEIGHT[qualityOf(chosen, entry.choiceIndex === question.bestChoice)]
    for (const ref of chosen.criteria ?? []) {
      const stat = byCriterion.get(ref) ?? { weight: 0, count: 0, bestHits: 0 }
      stat.weight += weight
      stat.count += 1
      if (weight === 1) stat.bestHits += 1
      byCriterion.set(ref, stat)
    }
  }
  const declared = challenge.assessment?.criteria ?? []
  const dimensions: DimensionScore[] = declared.map(criterion => {
    const stat = byCriterion.get(criterion.id) ?? { weight: 0, count: 0, bestHits: 0 }
    const rate = stat.count === 0 ? 0 : stat.weight / stat.count
    return {
      id: criterion.id,
      label: criterion.label,
      guidance: criterion.guidance,
      count: stat.count,
      bestHits: stat.bestHits,
      rate,
      evidence:
        stat.count === 0
          ? 'not exercised on this run'
          : `${stat.bestHits} of ${stat.count} strongest moves`,
      status: stat.count === 0 ? 'neutral' : rate >= 0.75 ? 'strength' : rate <= 0.5 ? 'growth' : 'neutral'
    }
  })

  return {
    headline,
    rate,
    strengths,
    growth,
    dimensions,
    traversal: {
      steps: answered,
      strongestRunSteps: strongestSteps,
      earlyExit: reachedEnd && answered < strongestSteps
    },
    trajectory,
    perQuestion
  }
}