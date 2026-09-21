import { END, XP_PER_BEST_CHOICE } from './challenge-schema'
import type { Question } from './challenge-schema'

/**
 * Scoring for a finished level (plan: pass = reach END; XP = 10 x best hits).
 *
 * There is deliberately no path-length component and no maximum: a candidate
 * only ever traverses one branch of the graph, so the number of questions they
 * answered is their own path, and `xp` is simply the count of questions where
 * they picked that question's `bestChoice`, times {@link XP_PER_BEST_CHOICE}.
 *
 * Pure and database-free — the caller passes the recorded path and the
 * challenge's stored question graph.
 */

/** The only fields scoring reads from a recorded path entry. */
export interface ScoredPathEntry {
  key: string
  choiceIndex: number
}

export interface LevelScore {
  /** Questions on the candidate's path that still exist in the graph. */
  answered: number
  /** Questions where the candidate chose `bestChoice`. */
  hits: number
  /** hits / answered, 0 when nothing was answered. */
  accuracy: number
  /** hits x XP_PER_BEST_CHOICE. */
  xp: number
  /** Display-only band derived from accuracy — never gates progression. */
  stars: number
}

/** Star bands by accuracy. Reaching END is the pass condition, not this. */
const STAR_BANDS = { THREE: 1, TWO: 0.8, ONE: 0.6 } as const

export function starsFor(accuracy: number): number {
  if (accuracy >= STAR_BANDS.THREE) return 3
  if (accuracy >= STAR_BANDS.TWO) return 2
  if (accuracy >= STAR_BANDS.ONE) return 1
  return 0
}

export function scoreLevel(
  path: readonly ScoredPathEntry[],
  questions: Record<string, Question>
): LevelScore {
  // A retired/re-imported question can vanish from the graph after a session
  // was recorded; those entries simply do not score rather than throwing.
  const recorded = path.filter(entry => questions[entry.key])
  const answered = recorded.length
  const hits = recorded.filter(entry => entry.choiceIndex === questions[entry.key].bestChoice).length
  const accuracy = answered === 0 ? 0 : hits / answered

  return {
    answered,
    hits,
    accuracy,
    xp: hits * XP_PER_BEST_CHOICE,
    stars: starsFor(accuracy)
  }
}

/**
 * `single_question` levels are one question whose every choice ends the
 * session. Derived from the graph rather than authored, so the two can never
 * disagree.
 */
export function isSingleQuestion(questions: Record<string, Question>): boolean {
  const keys = Object.keys(questions)
  if (keys.length !== 1) return false
  return questions[keys[0]].choices.every(choice => choice.next === END)
}

/**
 * Level curve: a pure function of total XP, so tuning it never needs a
 * migration or a backfill (plan Section 8.2).
 */
export function levelFromXp(totalXp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, totalXp) / 100))
}
