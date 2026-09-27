import type { FeedbackReport } from './api-client'
import { fmt } from './utils'

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
export function getHeadlineText(headline: FeedbackReport['headline']): string {
  return ({
    strong: 'عملکرد بسیار قوی',
    solid: 'پایدار با چند نقص جزئی',
    mixed: 'عملکرد متوسط و متناقض',
    struggled: 'یک مسیر چالش‌برانگیز و دشوار',
  })[headline] ?? headline
}

/** Candidate-facing label for how the run moved over its length. */
export function getTrajectoryText(trajectory: FeedbackReport['trajectory']): string {
  return ({
    'finished-stronger': 'در بخش پایانی سناریو تصمیمات سنجیده‌تری نسبت به آغاز گرفتید.',
    steady: 'کیفیت استدلال شما در تمام طول سناریو پایدار بود.',
    faded: 'در آغاز سناریو قوی‌تر عمل کردید اما در تصمیمات پایانی افت داشتید.',
  })[trajectory] ?? trajectory
}

/**
 * One strand of the assessment: a strength, a gap, held ground, or a strand the
 * run never touched. `unused` is deliberately separate from `steady` — a strand
 * the run never exercised is information, not a weakness.
 */
export type Tone = 'strength' | 'growth' | 'steady' | 'unused'

export function getToneText(tone: Tone): string {
  return ({
    strength: 'نقطه قوت',
    growth: 'فرصت بهبود',
    steady: 'پایدار',
    unused: 'مورد ارزیابی قرار نگرفت',
  })[tone] ?? tone
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
      advice: g.strongest.because
        ? fmt("بهترین حرکت ممکن این بود: {text} — {because}", { text: g.strongest.text, because: g.strongest.because })
        : fmt("بهترین حرکت ممکن این بود: {text}", { text: g.strongest.text })
    }))
  ]
}

export function listLabels(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? ''
  return `${labels.slice(0, -1).join('، ')} و ${labels[labels.length - 1]}`
}

/** The run's upside in one sentence, built only from what was actually scored. */
export function overallStrength(rows: AssessmentRow[], feedback: FeedbackReport): string {
  const strengths = rows.filter(r => r.tone === 'strength')
  if (strengths.length > 0) {
    const [lead, ...rest] = strengths
    if (rest.length > 0) {
      return fmt("بهترین زمینه شما {lead} بود ({result})؛ {rest} هم پایدار ماند.", {
        lead: lead.label.toLowerCase(),
        result: lead.result.toLowerCase(),
        rest: listLabels(rest.map(r => r.label.toLowerCase()))
      })
    }
    return fmt("بهترین زمینه شما {lead} بود ({result}).", {
      lead: lead.label.toLowerCase(),
      result: lead.result.toLowerCase()
    })
  }
  const rate = Math.round(feedback.rate * 100)
  if (feedback.rate >= 0.5) {
    return fmt("هیچ محوری برجسته نشد، اما اجرا را از ابتدا تا انتها قابل دفاع نگه داشتید ({rate}٪ وزن‌دار).", { rate })
  }
  return fmt("در این اجرا هیچ محوری به‌عنوان قوت ظاهر نشد ({rate}٪ وزن‌دار).", { rate })
}

/** The run's downside in one sentence — no question-by-question listing. */
export function overallWeakness(rows: AssessmentRow[], feedback: FeedbackReport): string {
  const gaps = rows.filter(r => r.tone === 'growth')
  if (gaps.length > 0) {
    return fmt("زمینه‌های ضعیف {labels} بودند — جایی که انتخاب قابل دفاعی وجود داشت و اجرا به‌جای بهترین حرکت، همان را برداشت.", { labels: listLabels(gaps.map(r => r.label.toLowerCase())) })
  }
  if (feedback.rate >= 0.75) {
    return "نقطه ضعف مشخصی نبود: انتخاب‌های پیشِ روی شما همان بهترین انتخاب‌ها بودند."
  }
  return "هیچ چیزی فرو نپاشید، اما هیچ محوری هم تثبیت نشد — اجرا در میانه ماند."
}

/**
 * What to do differently next time: the authored remediation for every gap, plus
 * one line about the walk itself when the run wrapped up early or faded.
 */
export function nextSteps(rows: AssessmentRow[], feedback: FeedbackReport): string[] {
  const steps = rows.filter(r => r.tone === 'growth' && r.advice).map(r => r.advice as string)
  if (feedback.traversal.earlyExit) {
    steps.push(
      fmt("شما در {steps} گام تمام کردید در حالی که بهترین اجرا {strongest} گام دارد — گام‌هایی که رد کردید معمولاً همان گام‌های تشخیصی‌اند.", {
        steps: feedback.traversal.steps,
        strongest: feedback.traversal.strongestRunSteps
      })
    )
  } else if (feedback.trajectory === 'faded') {
    steps.push("انتخاب‌های پایانی‌تان ضعیف‌تر از ابتدای اجرا بود — به پایان اجرا همان دقت ابتدای آن را بدهید.")
  }
  if (steps.length === 0) {
    steps.push("در این اجرا چیزی برای اصلاح نیست — برای ستاره دوباره بازی کنید یا سراغ مرحله بعد بروید.")
  }
  return steps.slice(0, 4)
}
