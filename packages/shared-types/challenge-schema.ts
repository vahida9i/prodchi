import { z } from 'zod'

export const ContextBlockSchema = z.object({
  type: z.enum(['table', 'screenshot']),
  data: z.record(z.unknown())
})

export const OptionSchema = z.object({
  id: z.string().length(1).regex(/^[A-D]$/),
  text: z.string().min(1)
})

export const ApplicantStepSchema = z.object({
  stepIndex: z.number().int().nonnegative(),
  stage: z.enum(['FRAME', 'INVESTIGATE', 'DEFINE', 'EXPLORE', 'DECIDE', 'DESIGN', 'VALIDATE']),
  inputType: z.enum(['options', 'freeText']).default('options'),
  context: z.string().min(1),
  contextBlocks: z.array(ContextBlockSchema).optional(),
  question: z.string().min(1),
  options: z.array(OptionSchema).optional()
})

export const AnswerSheetOptionSchema = z.object({
  reasoningSignal: z.string().min(1),
  consequence: z.string().min(1),
  reveal: z.array(z.string()),
  nextStepIndex: z.number().int().nullable()
})

export const AnswerSheetStepSchema = z.object({
  stepIndex: z.number().int().nonnegative(),
  objective: z.string().min(1),
  preferredOption: z.string().length(1).regex(/^[A-D]$/).optional(),
  options: z.record(AnswerSheetOptionSchema)
})

export const HiddenCaseSchema = z.object({
  company: z.record(z.unknown()),
  product: z.record(z.unknown()),
  initialProblem: z.record(z.unknown()),
  constraints: z.record(z.unknown()),
  stakeholders: z.array(z.unknown()),
  historicalContext: z.array(z.unknown()),
  evidence: z.record(z.unknown()),
  rootCause: z.record(z.unknown()),
  opportunity: z.record(z.unknown()),
  solutionDirections: z.array(z.unknown()),
  validation: z.record(z.unknown())
})

export const MetadataSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  estimatedMinutes: z.number().int().positive(),
  roleId: z.string().uuid(),
  difficulty: z.number().int().min(1).max(5),
  tier: z.enum(['free', 'pro']),
  xpValue: z.number().int().positive(),
  // Skill IDs are seeded slugs (e.g. 'user-research'), not UUIDs; referential
  // integrity is enforced against the database in validateChallengeImport.
  skillIds: z.array(z.string().min(1)).min(1)
})

export const ChallengeImportSchema = z.object({
  metadata: MetadataSchema,
  hiddenCase: HiddenCaseSchema,
  applicantSteps: z.array(ApplicantStepSchema).min(1),
  answerSheet: z.array(AnswerSheetStepSchema).min(1)
})

export type ChallengeImport = z.infer<typeof ChallengeImportSchema>
export type ApplicantStep = z.infer<typeof ApplicantStepSchema>
export type AnswerSheetStep = z.infer<typeof AnswerSheetStepSchema>
export type Metadata = z.infer<typeof MetadataSchema>
export type HiddenCase = z.infer<typeof HiddenCaseSchema>