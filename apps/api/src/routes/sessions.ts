import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.ts'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { scoreLevel } from '@baaten/shared-types/scoring'
import type { LevelScore } from '@baaten/shared-types/scoring'
import { evaluateRun } from '@baaten/shared-types/feedback'
import type { FeedbackReport } from '@baaten/shared-types/feedback'
import type { Assessment, Role } from '@baaten/shared-types/challenge-schema'

/** The challenge's stored role name, narrowed to the known role tracks. */
type RunChallengeRole = Role

/** The rubric as stored on the challenge; reads normalize rather than trust it. */
function challengeAssessment(value: unknown): Assessment | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as { criteria?: unknown }
  if (!Array.isArray(candidate.criteria)) return null
  return value as Assessment
}
import {
  getQuestions,
  revealOf,
  sanitizeQuestion,
  startOrResumeSession,
  toHistory,
  toPath
} from '../services/session-engine.ts'
import { creditLevelResult, isLevelPlayable } from '../services/gamification.ts'

/**
 * The run's score as frozen at completion. Challenges can be re-imported at any
 * time, so recomputing `hits`/`answered` from the live graph after an answer-key
 * edit could contradict the XP the run was credited with. The snapshot is the
 * authority; recomputation is only the fallback for runs recorded before it.
 */
function sessionScore(value: unknown): LevelScore | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<LevelScore>
  if (
    typeof candidate.hits !== 'number' ||
    typeof candidate.answered !== 'number' ||
    typeof candidate.accuracy !== 'number' ||
    typeof candidate.xp !== 'number' ||
    typeof candidate.stars !== 'number'
  ) {
    return null
  }
  return {
    hits: candidate.hits,
    answered: candidate.answered,
    accuracy: candidate.accuracy,
    xp: candidate.xp,
    stars: candidate.stars
  }
}

/**
 * The run's feedback report as frozen at completion — the same snapshot
 * semantics as the score: re-importing content must never rewrite what a
 * finished run's recap said. Null when the run predates the snapshot; the
 * summary then computes from the live graph instead.
 */
function sessionFeedback(value: unknown): FeedbackReport | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<FeedbackReport>
  if (
    typeof candidate.headline !== 'string' ||
    typeof candidate.rate !== 'number' ||
    !Array.isArray(candidate.perQuestion) ||
    !Array.isArray(candidate.strengths) ||
    !Array.isArray(candidate.growth) ||
    !candidate.traversal ||
    typeof candidate.traversal.steps !== 'number'
  ) {
    return null
  }
  return candidate as FeedbackReport
}

/** A challenge can be re-imported mid-run; retire the unusable session instead of dead-ending on a 500. */
const SUPERSEDED_MESSAGE = 'This level was updated and this run can no longer continue. Start it again from your path.'

const createSessionSchema = z.object({
  challengeId: z.string().uuid(),
  // Optional: when a session is started from a level on the path, the level is
  // recorded on the session so reaching END scores and credits it.
  levelId: z.string().uuid().optional()
})

const answerSchema = z.object({
  choiceIndex: z.number().int().nonnegative()
})

export async function sessionRoutes(fastify: FastifyInstance) {
  // POST /api/v1/sessions — start (or resume) a session for a challenge
  fastify.post('/', async (request, reply) => {
    const parseResult = createSessionSchema.safeParse(request.body)
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parseResult.error.flatten() })
    }

    const { challengeId, levelId } = parseResult.data
    const user = request.user!

    if (!user.roleTrackId) {
      return reply.status(400).send({ error: 'Role not selected. Complete onboarding first.' })
    }

    const challenge = await prisma.challenge.findFirst({
      where: { id: challengeId, roleId: user.roleTrackId, status: 'active' },
      include: { level: { select: { id: true, number: true } } }
    })
    if (!challenge) {
      return reply.status(404).send({ error: 'Challenge not found or not available' })
    }

    // Path integrity: a challenge that is assigned to a level is ONLY playable
    // through that level, and only when the progression gate allows it. Playing
    // it with a bare `{ challengeId }` (no levelId) can never bypass the gate.
    let sessionLevelId: string | null = null
    if (challenge.level) {
      // A caller-supplied levelId must match the challenge's level, otherwise
      // a level could be credited by playing unrelated content.
      if (levelId && levelId !== challenge.level.id) {
        return reply.status(400).send({ error: 'Level does not match this challenge' })
      }
      // The caller's role scopes the gate: a track's levels unlock only
      // against that same track's progress, never another role's.
      if (!(await isLevelPlayable(user.userId, challenge.level, user.roleTrackId))) {
        return reply.status(403).send({ error: 'This level is locked. Pass the previous level to unlock it.' })
      }
      sessionLevelId = challenge.level.id
    } else if (levelId) {
      // No level backs this challenge: any levelId is bogus (a level always
      // points at exactly one challenge).
      return reply.status(400).send({ error: 'Level does not match this challenge' })
    }

    let started
    try {
      started = await startOrResumeSession(user.userId, challenge, sessionLevelId)
    } catch (err) {
      if (err instanceof Error && err.message === 'Challenge has no valid start question') {
        return reply.status(500).send({ error: err.message })
      }
      throw err
    }

    return reply.status(started.resumed ? 200 : 201).send(started)
  })

  // POST /api/v1/sessions/:id/answer — submit the choice for the current question
  fastify.post('/:id/answer', async (request, reply) => {
    const { id } = request.params as { id: string }
    const parseResult = answerSchema.safeParse(request.body)
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parseResult.error.flatten() })
    }

    const user = request.user!

    const session = await prisma.session.findFirst({
      where: { id, userId: user.userId },
      include: { challenge: { include: { role: { select: { name: true } } } } }
    })
    if (!session) {
      return reply.status(404).send({ error: 'Session not found' })
    }
    if (session.status !== 'in_progress' || !session.currentKey) {
      return reply.status(409).send({ error: 'Session already completed' })
    }

    const questions = getQuestions(session.challenge)
    const question = questions[session.currentKey]
    if (!question) {
      // The challenge was re-imported while this run was open, so the session
      // points at a question that no longer exists. Retire it (nothing can be
      // answered from here) and tell the client to start the level again.
      await prisma.session.delete({ where: { id: session.id } })
      return reply.status(409).send({ error: SUPERSEDED_MESSAGE, restart: true })
    }

    const { choiceIndex } = parseResult.data
    const choice = question.choices[choiceIndex]
    if (!choice) {
      return reply.status(400).send({ error: 'Invalid choiceIndex for the current question' })
    }

    const path = toPath(session).slice()
    path.push({
      key: session.currentKey,
      questionText: question.text,
      choiceIndex,
      choiceText: choice.text,
      reveal: revealOf(choice),
      at: new Date().toISOString()
    })
    const pathJson = path as unknown as Prisma.InputJsonValue

    // Optimistic concurrency: the update only applies while the session still
    // sits on the question that was just answered. A parallel answer (second
    // tab, double-click, network retry) changes `currentKey` first, so this
    // update matches nothing and the caller gets a conflict instead of a lost
    // or duplicated path entry.
    const guard = { id: session.id, currentKey: session.currentKey, status: 'in_progress' }

    // The session completes itself when the chosen choice's next is END. That is
    // also the level's pass condition, so this is the one place a finished level
    // is scored: the recorded path is compared against each question's
    // `bestChoice` (10 XP per best hit) and the result is credited to the level.
    if (choice.next === 'END') {
      // Score once, here: the snapshot rides on the session so the recap can
      // never disagree with the XP credited below.
      const score = session.levelId ? scoreLevel(path, questions) : null
      // The feedback report freezes alongside the score, computed once from
      // the graph as it stood at completion — for free-play runs too.
      const feedback = evaluateRun(path, {
        role: session.challenge.role.name as RunChallengeRole,
        startKey: session.challenge.startKey,
        questions,
        assessment: challengeAssessment(session.challenge.assessment)
      })

      const result = await prisma.session.updateMany({
        where: guard,
        data: {
          path: pathJson,
          currentKey: null,
          status: 'completed',
          completedAt: new Date(),
          score: score ? (score as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
          feedback: feedback as unknown as Prisma.InputJsonValue
        }
      })
      if (result.count === 0) {
        return reply.status(409).send({ error: 'This question was already answered. Reload to see the current state.' })
      }

      const completion = session.levelId && score
        ? await creditLevelResult(user.userId, session.levelId, score)
        : null

      return reply.send({
        reveal: revealOf(choice),
        question: null,
        status: 'completed',
        result: completion
      })
    }

    // The graph can be re-imported mid-run: if the chosen branch no longer
    // leads anywhere, retire the run rather than dead-ending on a 500.
    const nextQuestion = questions[choice.next]
    if (!nextQuestion) {
      await prisma.session.delete({ where: { id: session.id } })
      return reply.status(409).send({ error: SUPERSEDED_MESSAGE, restart: true })
    }

    const result = await prisma.session.updateMany({
      where: guard,
      data: { path: pathJson, currentKey: choice.next }
    })
    if (result.count === 0) {
      return reply.status(409).send({ error: 'This question was already answered. Reload to see the current state.' })
    }

    return reply.send({
      reveal: revealOf(choice),
      question: sanitizeQuestion(choice.next, nextQuestion),
      status: 'in_progress'
    })
  })

  // GET /api/v1/sessions/:id — session state; this is what makes resume work.
  // Returns the current sanitized question plus the candidate's own path so far.
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const user = request.user!

    const session = await prisma.session.findFirst({
      where: { id, userId: user.userId },
      include: { challenge: true }
    })
    if (!session) {
      return reply.status(404).send({ error: 'Session not found' })
    }

    const history = toHistory(session)
    const questions = getQuestions(session.challenge)
    const question = session.status === 'in_progress' && session.currentKey && questions[session.currentKey]
      ? sanitizeQuestion(session.currentKey, questions[session.currentKey])
      : null

    return reply.send({
      id: session.id,
      challengeId: session.challengeId,
      levelId: session.levelId,
      challengeTitle: session.challenge.title,
      // The authored brief on the business, so the challenge screen can show it
      // under the title before the first question. Null on content without one.
      summary: session.challenge.summary,
      status: session.status,
      answeredCount: history.length,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      question,
      history
    })
  })

  // GET /api/v1/sessions/:id/summary — readable recap of the finished path.
  // No scores are hidden: pass/fail is "reached END", and the score is the
  // count of best choices, so it is safe (and useful) to return it here.
  fastify.get('/:id/summary', async (request, reply) => {
    const { id } = request.params as { id: string }
    const user = request.user!

    const session = await prisma.session.findFirst({
      where: { id, userId: user.userId },
      include: { challenge: { include: { role: { select: { name: true } } } } }
    })
    if (!session) {
      return reply.status(404).send({ error: 'Session not found' })
    }
    if (session.status !== 'completed') {
      return reply.status(409).send({ error: 'Session is not completed yet' })
    }

    const questions = getQuestions(session.challenge)
    // Prefer the score frozen at completion (content may have been re-imported
    // since); recomputing is the fallback for runs recorded before the snapshot.
    const computed = session.levelId ? scoreLevel(toPath(session), questions) : null
    const snapshot = session.levelId ? sessionScore(session.score) : null
    const level = session.levelId
      ? await prisma.level.findUnique({ where: { id: session.levelId }, select: { number: true } })
      : null
    const progress = session.levelId
      ? await prisma.levelProgress.findUnique({
          where: { userId_levelId: { userId: user.userId, levelId: session.levelId } }
        })
      : null

    return reply.send({
      id: session.id,
      challengeTitle: session.challenge.title,
      completedAt: session.completedAt,
      levelNumber: level?.number ?? null,
      score: computed && {
        hits: snapshot?.hits ?? computed.hits,
        answered: snapshot?.answered ?? computed.answered,
        accuracy: snapshot?.accuracy ?? computed.accuracy,
        xp: progress?.xpEarned ?? snapshot?.xp ?? computed.xp,
        stars: progress?.bestStars ?? snapshot?.stars ?? computed.stars
      },
      // Feedback: snapshot first (same authority rule as the score); live
      // computation is the fallback for runs recorded before the snapshot.
      feedback: sessionFeedback(session.feedback) ??
        evaluateRun(toPath(session), {
          role: session.challenge.role.name as RunChallengeRole,
          startKey: session.challenge.startKey,
          questions,
          assessment: challengeAssessment(session.challenge.assessment)
        }),
      path: toHistory(session)
    })
  })
}
