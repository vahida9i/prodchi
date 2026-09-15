import type { PrismaClient } from '@prisma/client'
import { ChallengeImportSchema, ChallengeImport, ApplicantStep } from './challenge-schema'

export interface ValidationError {
  path: string
  message: string
}

const STAGE_ORDER = ['FRAME', 'INVESTIGATE', 'DEFINE', 'EXPLORE', 'DECIDE', 'DESIGN', 'VALIDATE']

/**
 * Deterministic structural validation of an imported challenge (spec Section 5.3).
 * The Prisma client is injected by the caller so this package never owns a
 * database connection of its own.
 */
export async function validateChallengeImport(
  data: unknown,
  prisma: PrismaClient
): Promise<{ valid: boolean; errors: ValidationError[]; parsed?: ChallengeImport }> {
  const errors: ValidationError[] = []

  // 1. Zod schema validation
  const parseResult = ChallengeImportSchema.safeParse(data)
  if (!parseResult.success) {
    for (const issue of parseResult.error.issues) {
      errors.push({
        path: issue.path.join('.'),
        message: issue.message
      })
    }
    return { valid: false, errors }
  }

  const parsed = parseResult.data

  // 2. Check roleId and skillIds exist in DB
  const role = await prisma.role.findUnique({ where: { id: parsed.metadata.roleId } })
  if (!role) {
    errors.push({ path: 'metadata.roleId', message: 'Role not found in database' })
  }

  const skills = await prisma.skill.findMany({
    where: { id: { in: parsed.metadata.skillIds } }
  })
  if (skills.length !== parsed.metadata.skillIds.length) {
    const foundIds = new Set(skills.map(s => s.id))
    for (const skillId of parsed.metadata.skillIds) {
      if (!foundIds.has(skillId)) {
        errors.push({ path: `metadata.skillIds[]`, message: `Skill ${skillId} not found in database` })
      }
    }
  }

  // 3. Every options-type step has exactly 4 options with unique ids A-D
  for (const step of parsed.applicantSteps) {
    if (step.inputType === 'options') {
      if (!step.options || step.options.length !== 4) {
        errors.push({ path: `applicantSteps[${step.stepIndex}].options`, message: 'Options-type step must have exactly 4 options' })
      } else {
        const ids = step.options.map(o => o.id).sort()
        if (JSON.stringify(ids) !== JSON.stringify(['A', 'B', 'C', 'D'])) {
          errors.push({ path: `applicantSteps[${step.stepIndex}].options`, message: 'Options must have unique IDs A, B, C, D' })
        }
      }
    } else if (step.inputType === 'freeText') {
      if (step.options && step.options.length > 0) {
        errors.push({ path: `applicantSteps[${step.stepIndex}].options`, message: 'FreeText step must not have options' })
      }
    }
  }

  // 4. Stages appear in correct order (subsequence of STAGE_ORDER)
  const seenStages = new Set<string>()
  let lastStageIndex = -1
  for (const step of parsed.applicantSteps) {
    if (!seenStages.has(step.stage)) {
      const stageIndex = STAGE_ORDER.indexOf(step.stage)
      if (stageIndex < lastStageIndex) {
        errors.push({ path: `applicantSteps[${step.stepIndex}].stage`, message: `Stage ${step.stage} appears before ${STAGE_ORDER[lastStageIndex]}, violating order` })
      }
      lastStageIndex = stageIndex
      seenStages.add(step.stage)
    }
  }

  // 5. Every applicantSteps[i] has matching answerSheet[i] with same stepIndex
  const answerSheetByIndex = new Map(parsed.answerSheet.map(a => [a.stepIndex, a]))
  for (const step of parsed.applicantSteps) {
    if (!answerSheetByIndex.has(step.stepIndex)) {
      errors.push({ path: `answerSheet[${step.stepIndex}]`, message: `Missing answerSheet entry for stepIndex ${step.stepIndex}` })
    }
  }

  // 6. Every option in answerSheet has all four fields, nextStepIndex exists or is null
  const applicantStepIndices = new Set(parsed.applicantSteps.map(s => s.stepIndex))
  for (const answerStep of parsed.answerSheet) {
    for (const [optionKey, option] of Object.entries(answerStep.options)) {
      if (option.reasoningSignal === undefined || option.consequence === undefined || option.reveal === undefined || option.nextStepIndex === undefined) {
        errors.push({ path: `answerSheet[${answerStep.stepIndex}].options.${optionKey}`, message: 'Missing required field: reasoningSignal, consequence, reveal, or nextStepIndex' })
      }
      if (option.nextStepIndex !== null && !applicantStepIndices.has(option.nextStepIndex)) {
        errors.push({ path: `answerSheet[${answerStep.stepIndex}].options.${optionKey}.nextStepIndex`, message: `nextStepIndex ${option.nextStepIndex} does not exist in applicantSteps` })
      }
    }
  }

  return { valid: errors.length === 0, errors: errors.length > 0 ? errors : [], parsed }
}