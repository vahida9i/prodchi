import { ChallengeImportSchema } from './challenge-schema'
import type { ChallengeImport } from './challenge-schema'
import { validateChallengeGraph } from './graph-validator'
import type { ValidationError } from './graph-validator'

export interface ImportValidationResult {
  valid: boolean
  errors: ValidationError[]
  parsed?: ChallengeImport
}

/**
 * Full intake validation for an imported challenge (plan Feature 1):
 * 1. structural — the JSON matches the challenge schema exactly (unknown
 *    fields are rejected, not ignored)
 * 2. flow — the question graph is sound (start exists, valid `next` pointers,
 *    no self-loops, no cycles, no orphans; every path reaches END)
 *
 * Purely synchronous and database-free: role existence is resolved by the
 * admin import route against the seeded roles.
 */
export function validateChallengeImport(data: unknown): ImportValidationResult {
  const errors: ValidationError[] = []

  const parseResult = ChallengeImportSchema.safeParse(data)
  if (!parseResult.success) {
    for (const issue of parseResult.error.issues) {
      // Unrecognized keys are reported once for the whole object with an empty
      // path; expand them so the admin sees exactly which field is at fault.
      if (issue.code === 'unrecognized_keys' && 'keys' in issue) {
        const keys = (issue as { keys: string[] }).keys
        const basePath = formatZodPath(issue.path)
        for (const key of keys) {
          errors.push({
            path: basePath ? `${basePath}.${key}` : key,
            message: `Unrecognized field "${key}" — the challenge schema does not allow it`
          })
        }
        continue
      }
      errors.push({
        path: formatZodPath(issue.path) || 'root',
        message: issue.message
      })
    }
    return { valid: false, errors }
  }

  const parsed = parseResult.data
  errors.push(...validateChallengeGraph(parsed))

  return {
    valid: errors.length === 0,
    errors,
    parsed
  }
}

/** Formats a Zod issue path with bracket notation for array indices, e.g. questions.Q1.choices[0].stage */
function formatZodPath(path: (string | number)[]): string {
  return path.reduce<string>((acc, segment) => {
    if (typeof segment === 'number') return `${acc}[${segment}]`
    return acc ? `${acc}.${segment}` : segment
  }, '')
}