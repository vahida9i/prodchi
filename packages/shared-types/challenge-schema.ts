import { z } from 'zod'

/**
 * Role tracks. Fixed seed data: the import validator checks the challenge
 * JSON's `role` against this list, and each role carries its own internal
 * stage set and skill profile (see ROLE_STAGES and skills.ts).
 */
export const ROLES = ['Product Design', 'Product Management'] as const
export type Role = (typeof ROLES)[number]

/**
 * Internal process stages — scaffolding only — per the product plan (Section 7)
 * these must never be sent to or shown in the candidate-facing UI.
 *
 * Stages are per-role: a challenge's choices must use the stage set of the
 * challenge's own role (enforced at import, itemized per choice). FRAME is
 * shared; the rest speak each role's own process vocabulary.
 *
 * PD (7): FRAME, DISCOVER, DEFINE, IDEATE, DESIGN, TEST, REFINE
 * PM (7): FRAME, DIAGNOSE, STRATEGIZE, PRIORITIZE, PLAN, EXECUTE, MEASURE
 */
export const PD_STAGES = ['FRAME', 'DISCOVER', 'DEFINE', 'IDEATE', 'DESIGN', 'TEST', 'REFINE'] as const
export const PM_STAGES = ['FRAME', 'DIAGNOSE', 'STRATEGIZE', 'PRIORITIZE', 'PLAN', 'EXECUTE', 'MEASURE'] as const

/** Kept as the PD list under its historical name for existing call sites. */
export const STAGES = PD_STAGES

/** Stage sets per role, in process order. */
export const ROLE_STAGES: Record<Role, readonly Stage[]> = {
  'Product Design': PD_STAGES,
  'Product Management': PM_STAGES
}

export function stagesForRole(role: Role): readonly Stage[] {
  return ROLE_STAGES[role]
}

/** The full stage union across roles (validation bound for `choice.stage`). FRAME is shared. */
export const ALL_STAGES = ['FRAME', 'DISCOVER', 'DEFINE', 'IDEATE', 'DESIGN', 'TEST', 'REFINE', 'DIAGNOSE', 'STRATEGIZE', 'PRIORITIZE', 'PLAN', 'EXECUTE', 'MEASURE'] as const

export const StageSchema = z.enum(ALL_STAGES)
export const RoleSchema = z.enum(ROLES)

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const
export const DifficultySchema = z.enum(DIFFICULTIES)

/**
 * Graded verdict for a choice — the backbone of the end-of-run feedback
 * (deliberately rule-based, no AI): 'best' matches bestChoice, 'reasonable' is
 * a defensible move that costs the candidate something, 'poor' is a misstep.
 * Optional per choice: anything untagged derives at read time (bestChoice →
 * 'best', the rest → 'poor'), so challenges authored before grading existed
 * keep working unchanged.
 */
export const QUALITY_TIERS = ['best', 'reasonable', 'poor'] as const
export const QualitySchema = z.enum(QUALITY_TIERS)

/** Terminal marker: a choice whose `next` is END finishes the session. */
export const END = 'END'

// ---------------------------------------------------------------------------
// Reveals
//
// A reveal is what the candidate learns after committing a choice. It is
// authored content, never generated: either a plain sentence (the original
// format, still accepted as-is) or a block that may carry a data table.
//
// Limits mirror MAX_QUESTIONS: reveals are copied into every session path
// entry, so an imported table has to stay bounded.
// ---------------------------------------------------------------------------

export const MAX_TABLE_COLUMNS = 6
export const MAX_TABLE_ROWS = 50
export const MAX_CELL_LENGTH = 200

/** Cells are strings: the author decides the formatting ("3.0%" vs "3%"). */
export const RevealTableSchema = z.object({
  caption: z.string().min(1).max(MAX_CELL_LENGTH).optional(),
  columns: z.array(z.string().min(1).max(MAX_CELL_LENGTH)).min(1).max(MAX_TABLE_COLUMNS),
  rows: z.array(z.array(z.string().max(MAX_CELL_LENGTH)).min(1)).min(1).max(MAX_TABLE_ROWS)
}).strict().superRefine((table, ctx) => {
  // A ragged table is an authoring mistake, not a layout choice: report the
  // exact row so the admin can fix the source and re-import.
  table.rows.forEach((row, index) => {
    if (row.length !== table.columns.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rows', index],
        message: `row ${index} has ${row.length} cells but "columns" has ${table.columns.length}`
      })
    }
  })
})

export const RevealBlockSchema = z.object({
  text: z.string().min(1).optional(),
  table: RevealTableSchema.optional()
}).strict().superRefine((value, ctx) => {
  if (!value.text && !value.table) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [],
      message: 'reveal must include "text", "table", or both'
    })
  }
})

/**
 * Authored `reveal`: a legacy sentence OR a block. A string is normalized to
 * `{ text }` *before* validation (rather than modelled as a union) so every
 * failure is reported against one strict object schema — a union would collapse
 * into a bare "Invalid input" and cost the admin the itemized reasons.
 */
export const RevealSchema = z.preprocess(
  (value) => (typeof value === 'string' ? { text: value } : value),
  RevealBlockSchema
)

export const MAX_CRITERIA = 8

/**
 * One strand of a challenge's unit-layer rubric. Written once per challenge;
 * choices only *reference* these by id. `label`/`guidance` are candidate-safe
 * prose: they appear exclusively in the finished run's report, never during
 * play (the e2e sweep enforces that).
 */
export const CriterionSchema = z.object({
  id: z.string().min(1).max(64).regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'criterion ids are kebab-case slugs (e.g. "root-cause")'
  ),
  label: z.string().min(1).max(120),
  guidance: z.string().min(1).max(500)
}).strict()

/** The unit layer of the feedback model: the challenge's own vocabulary. */
export const AssessmentSchema = z.object({
  criteria: z.array(CriterionSchema).min(1).max(MAX_CRITERIA)
}).strict().superRefine((assessment, ctx) => {
  const seen = new Set<string>()
  assessment.criteria.forEach((criterion, index) => {
    if (seen.has(criterion.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['criteria', index, 'id'],
        message: `duplicate criterion id "${criterion.id}"`
      })
    }
    seen.add(criterion.id)
  })
})

export const ChoiceSchema = z.object({
  text: z.string().min(1),
  stage: StageSchema,
  quality: QualitySchema.optional(),
  /** Kebab-case ids of the rubric strands this move exercises. */
  criteria: z.array(z.string().min(1).max(64)).max(MAX_CRITERIA).optional(),
  /**
   * Why this choice is what it is. When the candidate misses, the strongest
   * move's `because` is the payload of the feedback — one authored sentence,
   * not generated prose. Required on every 'best' choice (enforced below).
   */
  because: z.string().min(1).max(500).optional(),
  reveal: RevealSchema,
  next: z.string().min(1)
}).strict()

export const QuestionSchema = z.object({
  text: z.string().min(1),
  choices: z.array(ChoiceSchema).min(3).max(4),
  /**
   * Index (0-based) of the choice that represents the strongest reasoning at
   * this question. Authored in the imported JSON and server-only: it never
   * reaches the candidate (the session engine hands out choice texts only) and
   * is read once a session reaches END, to score the path — see ./scoring.
   *
   * Choices are addressed positionally; the format has no option letters, and
   * most questions have 3 choices, so the valid range is 0..choices.length - 1.
   */
  bestChoice: z.number().int().nonnegative()
}).strict().superRefine((question, ctx) => {
  // Grading rules for the feedback engine. Itemized like every other authoring
  // error so the admin can fix the source and re-import.
  const tagged = question.choices.filter(choice => choice.quality !== undefined).length
  if (tagged > 0 && tagged < question.choices.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['choices'],
      message: `quality is all-or-nothing per question: ${tagged} of ${question.choices.length} choices are tagged`
    })
  }
  const best = question.choices[question.bestChoice]
  if (!best) return // out-of-range bestChoice is reported by the graph validator
  // Grading is all-or-nothing per question (rejected above when partial); once
  // fully tagged, the choice at bestChoice must carry the "best" tier.
  if (tagged === question.choices.length && best.quality !== 'best') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['choices', question.bestChoice, 'quality'],
      message: `the choice at bestChoice (${question.bestChoice}) must be quality "best" (got "${best.quality}")`
    })
  }
  question.choices.forEach((choice, index) => {
    if (choice.quality === 'best' && index !== question.bestChoice) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['choices', index, 'quality'],
        message: `only the choice at bestChoice (${question.bestChoice}) may be quality "best"`
      })
    }
    if (choice.quality === 'best' && !choice.because) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['choices', index, 'because'],
        message: 'a "best" choice needs "because" — it is what miss-feedback shows'
      })
    }
  })
})

/** Upper bound on imported questions — keeps validation and session traversal bounded (DoS guard). */
export const MAX_QUESTIONS = 200

/**
 * Upper bound on the authored challenge summary. It is a short brief on the
 * business and its customers, not a case write-up: room for two or three
 * sentences, but short enough to sit on a path-map node without crowding it.
 */
export const MAX_SUMMARY = 400

/**
 * Points awarded for each question the candidate answered with that question's
 * `bestChoice`. Reaching END is what passes a level; XP is the only thing this
 * score drives (plan: pass = reach END, XP = 10 x best hits).
 */
export const XP_PER_BEST_CHOICE = 10

export const ChallengeImportSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  role: RoleSchema,
  difficulty: DifficultySchema,
  /**
   * What the company is, before any of the incident: a short brief on the
   * business and who its customers are. Candidate-safe — it is the one piece of
   * prose shown before the run starts (on the path map). Optional, so content
   * authored before summaries existed still imports unchanged.
   */
  summary: z.string().min(1).max(MAX_SUMMARY).optional(),
  start: z.string().min(1),
  /** Optional unit-layer rubric: 3–6 criteria per challenge is the sweet spot. */
  assessment: AssessmentSchema.optional(),
  questions: z.record(z.string(), QuestionSchema)
}).strict().superRefine((value, ctx) => {
  const count = Object.keys(value.questions).length
  if (count < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['questions'],
      message: 'questions must contain at least one question'
    })
  }
  if (count > MAX_QUESTIONS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['questions'],
      message: `questions must contain at most ${MAX_QUESTIONS} questions (got ${count})`
    })
  }
  // Stages are per-role: every choice's `stage` must belong to the challenge's
  // own role's process vocabulary. Itemized per choice like every other
  // authoring error, so the admin can fix the source and re-import.
  const allowed = ROLE_STAGES[value.role]
  for (const [key, question] of Object.entries(value.questions)) {
    question.choices.forEach((choice, index) => {
      if (!allowed.includes(choice.stage)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['questions', key, 'choices', index, 'stage'],
          message: `"${choice.stage}" is not a stage of the ${value.role} process (valid: ${allowed.join(', ')})`
        })
      }
    })
  }
})

export type Stage = z.infer<typeof StageSchema>
export type Difficulty = z.infer<typeof DifficultySchema>
export type QualityTier = z.infer<typeof QualitySchema>
export type AssessmentCriterion = z.infer<typeof CriterionSchema>
export type Assessment = z.infer<typeof AssessmentSchema>
export type RevealTable = z.infer<typeof RevealTableSchema>
export type RevealBlock = z.infer<typeof RevealBlockSchema>
export type Choice = z.infer<typeof ChoiceSchema>
export type Question = z.infer<typeof QuestionSchema>
/** A parsed challenge: reveals are always normalized blocks. */
export type ChallengeImport = z.infer<typeof ChallengeImportSchema>
/** The authored shape: `reveal` may still be a plain sentence. */
export type ChallengeImportInput = z.input<typeof ChallengeImportSchema>

/**
 * Always returns a reveal block, whatever the source: an authored sentence
 * (the format before tables existed), a normalized block, or nothing usable.
 * Challenges imported earlier stored the prose in a plain string — and session
 * path entries recorded before this change carry `revealText` — so every read
 * path normalizes instead of trusting the stored shape.
 */
export function normalizeReveal(value: unknown): RevealBlock {
  if (typeof value === 'string') return { text: value }
  if (value && typeof value === 'object') {
    const candidate = value as RevealBlock
    if (typeof candidate.text === 'string' || candidate.table) {
      return candidate
    }
  }
  return {}
}