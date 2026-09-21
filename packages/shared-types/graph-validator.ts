import type { ChallengeImport } from './challenge-schema'
import { END } from './challenge-schema'

export interface ValidationError {
  path: string
  message: string
}

/**
 * Graph-level checks the JSON Schema cannot express (plan Section 7,
 * "Validation notes"). Every failure is reported as an itemized reason so the
 * admin can fix the source and re-import — nothing is guessed, repaired, or
 * silently accepted.
 */
export function validateChallengeGraph(parsed: ChallengeImport): ValidationError[] {
  const errors: ValidationError[] = []
  const questionKeys = Object.keys(parsed.questions)

  // 1. `start` must be an existing question key
  if (!questionKeys.includes(parsed.start)) {
    errors.push({
      path: 'start',
      message: `start "${parsed.start}" does not exist in questions`
    })
  }

  // 2 + 3. every `next` is END or an existing question key; no self-loops
  for (const [key, question] of Object.entries(parsed.questions)) {
    question.choices.forEach((choice, index) => {
      if (choice.next !== END && !questionKeys.includes(choice.next)) {
        errors.push({
          path: `questions.${key}.choices[${index}].next`,
          message: `next "${choice.next}" is neither "END" nor an existing question key`
        })
      }
      if (choice.next === key) {
        errors.push({
          path: `questions.${key}.choices[${index}].next`,
          message: `Question ${key} loops back to itself`
        })
      }
    })
  }

  // 3b. every `bestChoice` addresses one of that question's own choices.
  // Choices are positional (the format has no option letters) and most
  // questions have only 3 choices, so an author reaching for "D" out of habit
  // is the failure this catches.
  for (const [key, question] of Object.entries(parsed.questions)) {
    if (question.bestChoice >= question.choices.length) {
      errors.push({
        path: `questions.${key}.bestChoice`,
        message: `Question ${key} has ${question.choices.length} choices, so bestChoice must be between 0 and ${question.choices.length - 1} (got ${question.bestChoice})`
      })
    }
  }

  // 3c. rubric references resolve, and every best move is assessed.
  // The `assessment` block is the unit layer of the feedback model: choices
  // reference its criteria by id, so a dangling id or an unassessed best
  // move is an authoring mistake, not a silent gap in the candidate's report.
  const criterionIds = new Set((parsed.assessment?.criteria ?? []).map(criterion => criterion.id))
  for (const [key, question] of Object.entries(parsed.questions)) {
    question.choices.forEach((choice, index) => {
      for (const ref of choice.criteria ?? []) {
        if (!criterionIds.has(ref)) {
          errors.push({
            path: `questions.${key}.choices[${index}].criteria`,
            message: `criterion "${ref}" is not declared in "assessment.criteria"`
          })
        }
      }
    })
    const best = question.choices[question.bestChoice]
    if (parsed.assessment && best && (best.criteria ?? []).length === 0) {
      errors.push({
        path: `questions.${key}.choices[${question.bestChoice}].criteria`,
        message: `the best move tests nothing in the rubric — reference at least one of: ${[...criterionIds].sort().join(', ')}`
      })
    }
  }

  // 4. cycles — checked over the whole graph so loops inside orphaned
  // subgraphs are reported too
  errors.push(...detectCycles(parsed))

  // 5. orphans — every question must be reachable from start
  // (skipped when `start` itself is invalid: then every question would be
  // reported as unreachable, which is just noise on top of the real error)
  if (questionKeys.includes(parsed.start)) {
    const reachable = collectReachable(parsed)
    for (const key of questionKeys) {
      if (!reachable.has(key)) {
        errors.push({
          path: `questions.${key}`,
          message: `Question ${key} is never reachable from start ("${parsed.start}")`
        })
      }
    }
  }

  // 6. Every path reaches END — guaranteed here rather than checked: all
  // `next` values are END or valid keys (2), and the graph is finite and
  // acyclic (4), so any chain of `next` hops must terminate, and the only way
  // a chain terminates is a choice whose `next` is END. The validator tests
  // trace this end-to-end on the fixture.

  return errors
}

/**
 * Iterative DFS with a visiting/done state map (an explicit stack, so even a
 * pathological 200-question chain cannot overflow the call stack). Back edges
 * close a cycle; the cycle is reported as the concrete chain (e.g.
 * "Q12 → Q14 → Q12"). Self-loops are skipped here because the dedicated
 * self-loop check already reports them. The same loop is reported once
 * regardless of how many directions it can be entered from.
 */
function detectCycles(parsed: ChallengeImport): ValidationError[] {
  const errors: ValidationError[] = []
  const state = new Map<string, 'visiting' | 'done'>()
  const reported = new Set<string>()

  for (const root of Object.keys(parsed.questions)) {
    if (state.has(root)) continue

    state.set(root, 'visiting')
    // Explicit stack frames: which question we are walking, and which choice
    // to examine next — mirrors the call stack of the recursive version.
    const stack: Array<{ key: string; choiceIndex: number }> = [{ key: root, choiceIndex: 0 }]

    while (stack.length > 0) {
      const frame = stack[stack.length - 1]
      const choices = parsed.questions[frame.key].choices

      if (frame.choiceIndex >= choices.length) {
        // All choices of this question were explored: mark done and backtrack.
        state.set(frame.key, 'done')
        stack.pop()
        continue
      }

      const choiceIndex = frame.choiceIndex
      frame.choiceIndex += 1
      const choice = choices[choiceIndex]

      if (choice.next === END || choice.next === frame.key) continue
      const next = choice.next
      if (!parsed.questions[next]) continue // dangling `next` already reported by the caller

      const nextState = state.get(next)
      if (nextState === 'visiting') {
        // `next` is an ancestor on the current DFS path: back edge = cycle.
        const cycleStart = stack.findIndex(frame => frame.key === next)
        const cycleKeys = stack.slice(cycleStart).map(frame => frame.key)
        const canonical = cycleKeys.slice().sort().join('->')
        if (!reported.has(canonical)) {
          reported.add(canonical)
          errors.push({
            path: `questions.${frame.key}.choices[${choiceIndex}].next`,
            message: `Question ${frame.key} loops back to ${next}: ${[...cycleKeys, next].join(' → ')}`
          })
        }
      } else if (!nextState) {
        state.set(next, 'visiting')
        stack.push({ key: next, choiceIndex: 0 })
      }
    }
  }

  return errors
}

function collectReachable(parsed: ChallengeImport): Set<string> {
  const reachable = new Set<string>()
  const queue: string[] = [parsed.start]

  while (queue.length > 0) {
    const key = queue.pop()!
    if (reachable.has(key)) continue
    reachable.add(key)

    for (const choice of parsed.questions[key].choices) {
      if (choice.next !== END && parsed.questions[choice.next] && !reachable.has(choice.next)) {
        queue.push(choice.next)
      }
    }
  }

  return reachable
}