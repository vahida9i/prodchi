import { STAGES } from './challenge-schema'
import type { Question, QualityTier, Role, Stage } from './challenge-schema'
import { qualityOf } from './feedback'

/**
 * The real-world skill profile — "what you are good at in your role", read
 * from how the candidate actually answered.
 *
 * Every authored choice carries a `stage` (the role's process phase the move
 * belongs to), and each role's stages map 1:1 onto the skills that role lists
 * on a CV: for Product Design the seven design skills (framing, discovery,
 * synthesis, ideation, solution design, testing, refinement); for Product
 * Management the seven management skills (framing, diagnosis, strategy,
 * planning, execution, measurement). The profile groups every recorded
 * decision by the stage of the move the candidate *chose* (not the ideal one)
 * and credits it with the same deterministic weights as the run feedback
 * (best = 1, reasonable = 0.5, poor = 0).
 *
 * Pure and database-free like scoring.ts/feedback.ts: the caller passes the
 * recorded paths and the challenges' stored question graphs. Challenge-local
 * rubric criteria are deliberately NOT part of this profile — they speak a
 * per-challenge vocabulary that does not standardize across challenges; they
 * stay in the end-of-run report where they belong.
 */

/** The only fields the engine reads from a recorded path entry. */
export interface SkillPathEntry {
  key: string
  choiceIndex: number
}

/** One finished run: its recorded path plus the graph it was played against. */
export interface SkillRun {
  path: readonly SkillPathEntry[]
  questions: Record<string, Question>
}

/** Same weights as the run feedback engine (feedback.ts keeps its copy private). */
const QUALITY_WEIGHT: Record<QualityTier, number> = { best: 1, reasonable: 0.5, poor: 0 }

/**
 * The seven skills, in design-process order. `stage` is the authored tag the
 * skill is read from — internal only: it is how the answer is classified and
 * never crosses the API boundary (the payload speaks only the public
 * vocabulary below).
 */
export interface SkillDefinition {
  id: string
  /** Real-world name — CV vocabulary, not the internal stage id. */
  name: string
  /** Compact label for the radar chart. */
  shortName: string
  stage: Stage
  /** What the skill is in the real world. */
  blurb: string
  /** The growth pointer, shown when the skill reads below strong. */
  growthNote: string
}

/**
 * The Product Design skills, in design-process order. `stage` is the authored
 * tag the skill is read from — internal only: it is how the answer is
 * classified and never crosses the API boundary (the payload speaks only the
 * public vocabulary below).
 */
const PD_SKILLS: readonly SkillDefinition[] = [
  {
    id: 'framing',
    name: 'Problem framing',
    shortName: 'Framing',
    stage: 'FRAME',
    blurb: 'You turn a vague business situation into a well-posed problem with a measurable target.',
    growthNote: 'Restate the problem in the customer\'s words before reaching for a solution.'
  },
  {
    id: 'discovery',
    name: 'Discovery & evidence',
    shortName: 'Discovery',
    stage: 'DISCOVER',
    blurb: 'You pick the right question to ask and the evidence that can actually answer it.',
    growthNote: 'Ask what you most need to learn first — then choose the move that learns it.'
  },
  {
    id: 'synthesis',
    name: 'Synthesis & definition',
    shortName: 'Synthesis',
    stage: 'DEFINE',
    blurb: 'You turn scattered findings into a crisp problem statement and success metric.',
    growthNote: 'Force the findings into one sentence: who struggles, with what, and how we will measure it.'
  },
  {
    id: 'ideation',
    name: 'Ideation & options',
    shortName: 'Ideation',
    stage: 'IDEATE',
    blurb: 'You generate real alternatives instead of anchoring on the first idea.',
    growthNote: 'Sketch the boring option, the bold option and the cheap option before you pick one.'
  },
  {
    id: 'solution',
    name: 'Solution & tradeoffs',
    shortName: 'Solution',
    stage: 'DESIGN',
    blurb: 'You shape the solution while defending what you deliberately gave up.',
    growthNote: 'Name the tradeoff out loud: what does this choice cost, and why is it worth paying here?'
  },
  {
    id: 'testing',
    name: 'Testing with users',
    shortName: 'Testing',
    stage: 'TEST',
    blurb: 'You test the riskiest assumption before committing to the build.',
    growthNote: 'Identify the assumption that would sink the idea if wrong — test that one first.'
  },
  {
    id: 'refinement',
    name: 'Refinement & iteration',
    shortName: 'Refinement',
    stage: 'REFINE',
    blurb: 'You tighten the solution from test evidence instead of shipping the first version that works.',
    growthNote: 'Take one test finding back into the design before calling it done.'
  }
]

/**
 * The Product Management skills, in management-process order — the same
 * deterministic profile machinery, speaking the PM process vocabulary.
 */
const PM_SKILLS: readonly SkillDefinition[] = [
  {
    id: 'framing',
    name: 'Problem framing',
    shortName: 'Framing',
    stage: 'FRAME',
    blurb: 'You turn a vague business situation into a well-posed problem with a measurable target.',
    growthNote: 'Restate the problem in the customer\'s words before reaching for a solution.'
  },
  {
    id: 'diagnosis',
    name: 'Diagnosis',
    shortName: 'Diagnosis',
    stage: 'DIAGNOSE',
    blurb: 'You find the real driver behind a metric move instead of treating the symptom.',
    growthNote: 'Keep asking what changed until the cause explains the number — not just the timing.'
  },
  {
    id: 'strategy',
    name: 'Strategy & direction',
    shortName: 'Strategy',
    stage: 'STRATEGIZE',
    blurb: 'You pick a direction that fits the market and the company\'s constraints.',
    growthNote: 'Name what the strategy deliberately gives up — a direction that costs nothing decides nothing.'
  },
  {
    id: 'prioritization',
    name: 'Prioritization',
    shortName: 'Prioritizing',
    stage: 'PRIORITIZE',
    blurb: 'You decide what gets built now, later, and never — and defend the cut.',
    growthNote: 'Rank by the outcome you are accountable for, not by who asked loudest.'
  },
  {
    id: 'planning',
    name: 'Planning & roadmapping',
    shortName: 'Planning',
    stage: 'PLAN',
    blurb: 'You sequence the work into a credible plan with dependencies and rollout stages.',
    growthNote: 'Sequence by risk: the step that could invalidate the plan goes first.'
  },
  {
    id: 'execution',
    name: 'Execution & delivery',
    shortName: 'Execution',
    stage: 'EXECUTE',
    blurb: 'You turn decisions into specs, acceptance criteria, and coordinated launches.',
    growthNote: 'Write down what "done" means before the build starts — handoff clarity is the PM\'s job.'
  },
  {
    id: 'measurement',
    name: 'Measurement & learning',
    shortName: 'Measurement',
    stage: 'MEASURE',
    blurb: 'You instrument the outcome and decide iterate-or-kill on evidence.',
    growthNote: 'Define the success metric before launch — an unmeasured launch teaches nothing.'
  }
]
const PD_SKILLS_FA: readonly SkillDefinition[] = [
  {
    id: 'framing',
    name: 'صورت‌بندی مسئله',
    shortName: 'صورت‌بندی',
    stage: 'FRAME',
    blurb: 'شما یک وضعیت مبهم کسب‌وکار را به مسئله‌ای شفاف با هدف قابل‌اندازه‌گیری تبدیل می‌کنید.',
    growthNote: 'پیش از اقدام برای راه‌حل، مسئله را به زبان خود کاربر بازتعریف کنید.'
  },
  {
    id: 'discovery',
    name: 'اکتشاف و شواهد',
    shortName: 'اکتشاف',
    stage: 'DISCOVER',
    blurb: 'شما پرسش کلیدی مناسب و شواهدی که می‌تواند به آن پاسخ دهد را انتخاب می‌کنید.',
    growthNote: 'ابتدا مشخص کنید مهم‌ترین چیزی که باید یاد بگیرید چیست، سپس تصمیمی بگیرید که آن را بیاموزید.'
  },
  {
    id: 'synthesis',
    name: 'ترکیب و تعریف',
    shortName: 'ترکیب',
    stage: 'DEFINE',
    blurb: 'شما داده‌های پراکنده را به بیانیه شفاف مسئله و معیار موفقیت تبدیل می‌کنید.',
    growthNote: 'یافته‌ها را در یک جمله خلاصه کنید: چه کسی با چه مشکلی مواجه است و چگونه آن را اندازه می‌گیریم.'
  },
  {
    id: 'ideation',
    name: 'ایده‌پردازی و گزینه‌ها',
    shortName: 'ایده‌پردازی',
    stage: 'IDEATE',
    blurb: 'به جای تکیه بر اولین ایده، گزینه‌ها و راه‌حل‌های واقعی متعددی خلق می‌کنید.',
    growthNote: 'قبل از انتخاب نهایی، گزینه ساده، جسورانه و کم‌هزینه را جداگانه ترسیم نمایید.'
  },
  {
    id: 'solution',
    name: 'طراحی راه‌حل و ترید‌آف',
    shortName: 'طراحی راه‌حل',
    stage: 'DESIGN',
    blurb: 'شما راه‌حل را شکل داده و از مواردی که آگاهانه فدا کرده‌اید دفاع می‌کنید.',
    growthNote: 'تریدآف را با صدای بلند بیان کنید: این انتخاب چه هزینه‌ای دارد و چرا پرداخت آن ارزش دارد؟'
  },
  {
    id: 'testing',
    name: 'تست با کاربران',
    shortName: 'تست کاربر',
    stage: 'TEST',
    blurb: 'پرخطرترین فرض‌ها را پیش از تعهد به ساخت کامل محصول اعتبارسنجی می‌کنید.',
    growthNote: 'فرضی را پیدا کنید که در صورت اشتباه بودن کل طرح را با شکست روبرو می‌کند؛ ابتدا آن را تست کنید.'
  },
  {
    id: 'refinement',
    name: 'بهبود و بازآفرینی',
    shortName: 'بهبود مستمر',
    stage: 'REFINE',
    blurb: 'به جای انتشار اولین نسخه، راه‌حل را بر اساس شواهد حاصل از آزمون کاربر ارتقا می‌دهید.',
    growthNote: 'شواهد آزمون کاربر را دست‌کم نگیرید — بر اساس داده‌های مشاهده‌شده تغییرات را اعمال کنید.'
  }
]

const PM_SKILLS_FA: readonly SkillDefinition[] = [
  {
    id: 'framing',
    name: 'تعریف و شفاف‌سازی مسئله',
    shortName: 'تعریف مسئله',
    stage: 'FRAME',
    blurb: 'شما سیگنال‌های مبهم تجاری را به هدفی شفاف و قابل‌سنجش تبدیل می‌کنید.',
    growthNote: 'روی چرایی مسئله و ارزش تجاری حل آن تمرکز کنید.'
  },
  {
    id: 'diagnosis',
    name: 'ریشه‌یابی و تحلیل علت',
    shortName: 'ریشه‌یابی',
    stage: 'DIAGNOSE',
    blurb: 'علل اصلی و محرک‌های اساسی مسئله را قبل از ارائه راه‌حل شناسایی می‌کنید.',
    growthNote: 'علت‌های ریشه‌ای را از علائم و نشانه‌های سطحی تفکیک کنید.'
  },
  {
    id: 'strategy',
    name: 'استراتژی و جهت‌گیری',
    shortName: 'استراتژی',
    stage: 'STRATEGIZE',
    blurb: 'مسیر و فرضیه راهبردی مشخصی برای دستیابی به خروجی مطلوب تعیین می‌کنید.',
    growthNote: 'مشخص کنید چه کارهایی را آگاهانه نباید انجام دهیم.'
  },
  {
    id: 'prioritization',
    name: 'اولویت‌بندی و انتخاب',
    shortName: 'اولویت‌بندی',
    stage: 'PRIORITIZE',
    blurb: 'فرصت‌ها و امکانات را بر مبنای ارزش و اثر واقعی رتبه‌بندی می‌کنید.',
    growthNote: 'از شاخص‌های شفاف برای سنجش هزینه و فایده استفاده نمایید.'
  },
  {
    id: 'planning',
    name: 'برنامه‌ریزی و نقشه راه',
    shortName: 'نقشه راه',
    stage: 'PLAN',
    blurb: 'توالی منطقی و انتشار فازبندی‌شده را برای محصول تدوین می‌کنید.',
    growthNote: 'انتشار تدریجی و یادگیری سریع در هر فاز را مدنظر قرار دهید.'
  },
  {
    id: 'execution',
    name: 'اجرا و تحویل',
    shortName: 'اجرا',
    stage: 'EXECUTE',
    blurb: 'موانع اجرا را رفع کرده و هماهنگی میان تیم‌ها را حفظ می‌کنید.',
    growthNote: 'کیفیت و زمان‌بندی را همزمان با رضایت کاربر متعادل نگه دارید.'
  },
  {
    id: 'measurement',
    name: 'سنجش و یادگیری',
    shortName: 'سنجش',
    stage: 'MEASURE',
    blurb: 'نتایج را با داده‌های معتبر ارزیابی کرده و درباره ادامه یا توقف تصمیم می‌گیرید.',
    growthNote: 'پیش از عرضه محصول، شاخص‌های کلیدی موفقیت (KPI) را به وضوح مشخص کنید.'
  }
]

/** Per-role skill sets, each in that role's process order. */
export const SKILLS_BY_ROLE: Record<Role, readonly SkillDefinition[]> = {
  'Product Design': PD_SKILLS,
  'Product Management': PM_SKILLS
}

export function skillsForRole(role: Role): readonly SkillDefinition[] {
  const isFa = (process.env.APP_LOCALE === 'fa' || process.env.NEXT_PUBLIC_APP_LOCALE === 'fa')
  if (isFa) {
    return role === 'Product Management' ? PM_SKILLS_FA : PD_SKILLS_FA
  }
  return SKILLS_BY_ROLE[role]
}

/** The PD set under its historical name for existing call sites. */
export const SKILLS = PD_SKILLS

export type Proficiency = 'strong' | 'developing' | 'emerging' | 'unproven'

/** Bands, reused from the feedback engine's thresholds (strength >= 0.75, growth <= 0.5). */
const STRONG_RATE = 0.75
const DEVELOPING_RATE = 0.5
/** A skill needs this many observed decisions before it may read `strong`. */
export const MIN_SKILL_EVIDENCE = 3

export interface SkillScore {
  id: string
  name: string
  shortName: string
  blurb: string
  growthNote: string
  /** Decisions whose chosen move exercised this skill. */
  count: number
  bestHits: number
  reasonableCalls: number
  /** Weighted rate 0..1 (best = 1, reasonable = 0.5, poor = 0). */
  rate: number
  /** Human evidence line, e.g. "4 of 5 strongest calls, 1 defensible". */
  evidence: string
  proficiency: Proficiency
  /**
   * True when the skill reads strong-band but has fewer than
   * MIN_SKILL_EVIDENCE decisions: the UI caps it below strong.
   */
  thinEvidence: boolean
}

export interface SkillProfile {
  /** All skills of the role, fixed process order. */
  skills: SkillScore[]
  /** Weighted rate across every recorded decision, 0 when none. */
  overallRate: number
  /** Recorded decisions that fed the profile. */
  decisions: number
  /** Finished runs that fed it (a run counts when it has at least one scorable decision). */
  scenarios: number
}

function emptyStat() {
  return { weight: 0, count: 0, bestHits: 0, reasonableCalls: 0 }
}

function proficiencyFor(rate: number, count: number): Proficiency {
  if (count === 0) return 'unproven'
  if (rate >= STRONG_RATE && count >= MIN_SKILL_EVIDENCE) return 'strong'
  // A thin but high-quality record stays `developing` — one lucky answer
  // cannot claim strong. The UI surfaces `thinEvidence` as "needs more
  // evidence" so the cap never looks like a demotion.
  if (rate >= DEVELOPING_RATE) return 'developing'
  return 'emerging'
}

/**
 * Build the profile from the user's finished runs, for one role track. The
 * role decides which skill set the decisions are read against — a candidate
 * has exactly one `roleTrack`, so callers pass it through. Tolerates the same
 * stale data as scoreLevel/evaluateRun: path entries whose question no longer
 * exists in the graph (retired or re-imported content) simply do not score.
 */
export function buildSkillProfile(runs: readonly SkillRun[], role: Role = 'Product Design'): SkillProfile {
  const definitions = skillsForRole(role)
  const roleStages = new Set(definitions.map(definition => definition.stage))
  const byStage = new Map<Stage, ReturnType<typeof emptyStat>>()
  let totalWeight = 0
  let decisions = 0
  let scenarios = 0

  for (const run of runs) {
    const questions = run.questions ?? {}
    const path = Array.isArray(run.path) ? run.path : []
    const recorded = path.filter(entry => questions[entry.key])
    let contributed = false
    for (const entry of recorded) {
      const question = questions[entry.key]
      const chosen = question.choices[entry.choiceIndex]
      if (!chosen) continue
      // Stages outside the role's own set (possible only in stale data — the
      // importer rejects cross-role stages) belong to no skill of this
      // profile, so they do not score at all rather than skewing the rates.
      if (!roleStages.has(chosen.stage)) continue
      const quality = qualityOf(chosen, entry.choiceIndex === question.bestChoice)
      const stat = byStage.get(chosen.stage) ?? emptyStat()
      stat.weight += QUALITY_WEIGHT[quality]
      stat.count += 1
      if (quality === 'best') stat.bestHits += 1
      if (quality === 'reasonable') stat.reasonableCalls += 1
      byStage.set(chosen.stage, stat)
      totalWeight += QUALITY_WEIGHT[quality]
      decisions += 1
      contributed = true
    }
    if (contributed) scenarios += 1
  }

  const skills: SkillScore[] = definitions.map(definition => {
    const stat = byStage.get(definition.stage) ?? emptyStat()
    const rate = stat.count === 0 ? 0 : stat.weight / stat.count
    return {
      id: definition.id,
      name: definition.name,
      shortName: definition.shortName,
      blurb: definition.blurb,
      growthNote: definition.growthNote,
      count: stat.count,
      bestHits: stat.bestHits,
      reasonableCalls: stat.reasonableCalls,
      rate,
      evidence:
        stat.count === 0
          ? 'not yet observed'
          : `${stat.bestHits} of ${stat.count} strongest calls${stat.reasonableCalls > 0 ? `, ${stat.reasonableCalls} defensible` : ''}`,
      proficiency: proficiencyFor(rate, stat.count),
      thinEvidence: stat.count > 0 && stat.count < MIN_SKILL_EVIDENCE
    }
  })

  return {
    skills,
    overallRate: decisions === 0 ? 0 : totalWeight / decisions,
    decisions,
    scenarios
  }
}

/** Role-scoped profile contract. PD is the default for existing call sites. */
export const skillCountFor = (role: Role): number => SKILLS_BY_ROLE[role].length
export const skillOrderFor = (role: Role): string[] => SKILLS_BY_ROLE[role].map(skill => skill.id)
/** The PD contract under its historical names for existing call sites. */
export const SKILL_COUNT = SKILLS.length
export const SKILL_ORDER = SKILLS.map(skill => skill.id)