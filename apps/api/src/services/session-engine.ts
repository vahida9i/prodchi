import { prisma } from '../lib/prisma.ts'
import type { Prisma } from '@prisma/client'
import type { Question, RevealBlock } from '@prodchi/shared-types/challenge-schema'
import { normalizeReveal } from '@prodchi/shared-types/challenge-schema'

/**
 * Session engine primitives, shared by the two ways a session can be started:
 * `POST /api/v1/sessions` (a challenge) and `POST /api/v1/levels/:id/start`
 * (a level on the path). Keeping one implementation means the resume rules,
 * the field-visibility rule, and the optimistic-concurrency behaviour cannot
 * drift between the two entry points.
 */

export interface PathEntry {
  key: string
  questionText: string
  choiceIndex: number
  choiceText: string
  reveal: RevealBlock
  at: string
}

/**
 * A path entry as it sits in the database. Entries recorded before reveals
 * could carry a table stored the prose in `revealText`, so reads normalize
 * instead of assuming the current shape.
 */
interface StoredPathEntry {
  questionText?: string
  choiceText?: string
  reveal?: unknown
  revealText?: unknown
}

/** The reveal of a choice, normalized — an author may still have written a sentence. */
export function revealOf(choice: { reveal: unknown }): RevealBlock {
  return normalizeReveal(choice.reveal)
}

export interface SanitizedQuestion {
  key: string
  text: string
  choices: Array<{ index: number; text: string }>
}

export interface ChallengeForSessions {
  id: string
  startKey: string
  questions: unknown
}

export interface SessionStartResult {
  sessionId: string
  resumed: boolean
  status: string
  question: SanitizedQuestion | null
}

export function getQuestions(challenge: { questions: unknown }): Record<string, Question> {
  return challenge.questions as Record<string, Question>
}

export function toPath(session: { path: unknown }): PathEntry[] {
  return Array.isArray(session.path) ? (session.path as PathEntry[]) : []
}

/**
 * The only place a question is shaped for the candidate: its text and the
 * texts of its choices, with stable indexes. `stage`, `reveal`, `next` and
 * `bestChoice` never leave the server, and a reveal is returned exactly once —
 * for the chosen choice, after it is submitted (field visibility rule).
 */
export function sanitizeQuestion(key: string, question: Question): SanitizedQuestion {
  return {
    key,
    text: question.text,
    choices: question.choices.map((choice, index) => ({ index, text: choice.text }))
  }
}

export function toHistory(session: { path: unknown }) {
  return toPath(session).map(entry => {
    const stored = entry as unknown as StoredPathEntry
    return {
      questionText: stored.questionText ?? '',
      choiceText: stored.choiceText ?? '',
      reveal: normalizeReveal(stored.reveal ?? stored.revealText)
    }
  })
}

function resumePayload(
  existing: { id: string; status: string; currentKey: string | null },
  questions: Record<string, Question>
): SessionStartResult {
  const question = existing.currentKey && questions[existing.currentKey]
    ? sanitizeQuestion(existing.currentKey, questions[existing.currentKey])
    : null
  return { sessionId: existing.id, resumed: true, status: existing.status, question }
}

/**
 * Start a session, or resume the caller's existing in-progress one.
 *
 * One in-progress session per challenge per user is enforced by the partial
 * unique index `sessions_one_in_progress`, so a parallel start converges on the
 * session that won rather than forking a second path.
 */
export async function startOrResumeSession(
  userId: string,
  challenge: ChallengeForSessions,
  levelId: string | null = null
): Promise<SessionStartResult> {
  const questions = getQuestions(challenge)

  const existing = await prisma.session.findFirst({
    where: { userId, challengeId: challenge.id, status: 'in_progress' }
  })
  if (existing) {
    const resumed = resumePayload(existing, questions)
    if (resumed.question) {
      return resumed
    }
    // Unusable state (no valid current question): drop it and start clean
    // rather than dead-ending the candidate behind a broken session.
    await prisma.session.delete({ where: { id: existing.id } })
  }

  const startQuestion = questions[challenge.startKey]
  if (!startQuestion) {
    throw new Error('Challenge has no valid start question')
  }

  try {
    const session = await prisma.session.create({
      data: { userId, challengeId: challenge.id, currentKey: challenge.startKey, path: [], levelId }
    })

    return {
      sessionId: session.id,
      resumed: false,
      status: session.status,
      question: sanitizeQuestion(challenge.startKey, startQuestion)
    }
  } catch (err: any) {
    if (err?.code === 'P2002') {
      // Lost a race against a parallel start (the partial unique index fired).
      const winner = await prisma.session.findFirst({
        where: { userId, challengeId: challenge.id, status: 'in_progress' }
      })
      if (winner) {
        return resumePayload(winner, questions)
      }
    }
    throw err
  }
}

export function toInputJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}
