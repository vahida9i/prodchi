import type { FeedbackReport } from './api-client'

/**
 * Presentation layer for the end-of-run report (plan Feature 4) — pure and
 * framework-free, so the summary page stays a thin renderer.
 *
 * It answers three questions about a run, in this order: what did each strand of
 * the assessment come to, what was the run's one overall strength and one overall
 * weakness, and what is worth trying next time. Every sentence is composed from
 * the engine's own deterministic output — the `evidence` lines it already scored
 * and the challenge's authored `guidance` — never from the per-question verdicts,
 * which stay internal so the summary reads as one assessment instead of a recap.
 */

/** Candidate-facing label for the engine's headline verdict. */
export const HEADLINE_TEXT: Record<FeedbackReport['headline'], string> = {
  strong: 'Strong run',
  solid: 'Solid, with gaps',
  mixed: 'Mixed run',
  struggled: 'A difficult run'
}

/** Candidate-facing label for how the run moved over its length. */
export const TRAJECTORY_TEXT: Record<FeedbackReport['trajectory'], string> = {
  'finished-stronger': 'You finished stronger than you started.',
  steady: 'Steady throughout.',
  faded: 'You started stronger than you finished.'
}

/**
 * One strand of the assessment: a strength, a gap, held ground, or a strand the
 * run never touched. `unused` is deliberately separate from `steady` — a strand
 * the run never exercised is information, not a weakness.
 */
export type Tone = 'strength' | 'growth' | 'steady' | 'unused'

export const TONE_TEXT: Record<Tone, string> = {
  strength: 'strength',
  growth: 'growth area',
  steady: 'steady',
  unused: 'not exercised'
}

export interface AssessmentRow {
  key: string
  label: string
  /** What happened on this run — the engine's authored evidence line. */
  result: string
  tone: Tone
  /** Authored remediation; only growth rows carry one, and it feeds "what to try next". */
  advice?: string
}

/**
 * Every assessment signal as one list: the challenge's own rubric when it has one
 * (a row per declared strand), otherwise the reasoning areas the engine scored.
 * Strengths, gaps and untouched ground read as a single assessment instead of
 * three separate sections.
 */
export function assessmentRows(feedback: FeedbackReport): AssessmentRow[] {
  const dimensions = feedback.dimensions ?? []
  if (dimensions.length > 0) {
    return dimensions.map(d => ({
      key: d.id,
      label: d.label,
      result: d.evidence,
      tone:
        d.status === 'strength' ? 'strength'
        : d.status === 'growth' ? 'growth'
        : d.count === 0 ? 'unused'
        : 'steady',
      advice: d.status === 'growth' ? d.guidance : undefined
    }))
  }

  // Unrubriced content: the engine's reasoning areas are the whole assessment.
  return [
    ...feedback.strengths.map(s => ({
      key: `strength-${s.area}`,
      label: s.area,
      result: s.evidence,
      tone: 'strength' as const
    })),
    ...feedback.growth.map(g => ({
      key: `growth-${g.area}`,
      label: g.area,
      result: g.evidence,
      tone: 'growth' as const,
      advice: `The strongest move was: ${g.strongest.text}${g.strongest.because ? ` — ${g.strongest.because}` : ''}`
    }))
  ]
}

export function listLabels(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? ''
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
}

/** The run's upside in one sentence, built only from what was actually scored. */
export function overallStrength(rows: AssessmentRow[], feedback: FeedbackReport): string {
  const strengths = rows.filter(r => r.tone === 'strength')
  if (strengths.length > 0) {
    const [lead, ...rest] = strengths
    const restText = rest.length > 0 ? `; ${listLabels(rest.map(r => r.label.toLowerCase()))} held up too` : ''
    return `Your strongest ground was ${lead.label.toLowerCase()} (${lead.result.toLowerCase()})${restText}.`
  }
  if (feedback.rate >= 0.5) {
    return `No single strand stood out, but you kept the run defensible end to end (${Math.round(feedback.rate * 100)}% weighted).`
  }
  return `No strand came through as a strength on this run (${Math.round(feedback.rate * 100)}% weighted).`
}

/** The run's downside in one sentence — no question-by-question listing. */
export function overallWeakness(rows: AssessmentRow[], feedback: FeedbackReport): string {
  const gaps = rows.filter(r => r.tone === 'growth')
  if (gaps.length > 0) {
    return `The weak ground was ${listLabels(gaps.map(r => r.label.toLowerCase()))} — where a defensible call was available and the run took it instead of the strongest move.`
  }
  if (feedback.rate >= 0.75) {
    return 'No clear weak spot: the calls open to you were the strongest ones.'
  }
  return 'Nothing fell apart, but no strand locked in — the run stayed in the middle.'
}

/**
 * What to do differently next time: the authored remediation for every gap, plus
 * one line about the walk itself when the run wrapped up early or faded.
 */
export function nextSteps(rows: AssessmentRow[], feedback: FeedbackReport): string[] {
  const steps = rows.filter(r => r.tone === 'growth' && r.advice).map(r => r.advice as string)
  if (feedback.traversal.earlyExit) {
    steps.push(
      `You finished in ${feedback.traversal.steps} steps where the strongest run takes ${feedback.traversal.strongestRunSteps} — the steps you skipped are usually the diagnostic ones.`
    )
  } else if (feedback.trajectory === 'faded') {
    steps.push('Your later calls were weaker than your opening ones — give the end of the run the same care as the start.')
  }
  if (steps.length === 0) {
    steps.push('Nothing to fix on this run — replay it for stars, or take the next level.')
  }
  return steps.slice(0, 4)
}
