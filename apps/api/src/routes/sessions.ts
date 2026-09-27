import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.ts'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { PassThrough } from 'node:stream'
import { scoreLevel } from '@prodchi/shared-types/scoring'
import type { LevelScore } from '@prodchi/shared-types/scoring'
import { evaluateRun } from '@prodchi/shared-types/feedback'
import type { FeedbackReport } from '@prodchi/shared-types/feedback'
import type { Assessment, Role } from '@prodchi/shared-types/challenge-schema'

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
import { assessCompletedRun, assessWrittenAnswer, isAiConfigured, parseRunAssessment, streamCompletedRun, streamWrittenAnswer } from '../services/written-assessment.ts'
import { creditDailySession } from '../services/daily-challenge.ts'

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
const SUPERSEDED_MESSAGE = 'این مرحله به‌روزرسانی شده و ادامهٔ اجرای فعلی ممکن نیست. آن را از مسیر دوباره شروع کنید.'

const createSessionSchema = z.object({
  challengeId: z.string().uuid(),
  // Optional: when a session is started from a level on the path, the level is
  // recorded on the session so reaching END scores and credits it.
  levelId: z.string().uuid().optional()
})

const answerSchema = z.object({
  choiceIndex: z.number().int().nonnegative().optional(),
  answerText: z.string().trim().min(20).max(2000).optional()
}).strict().refine(value => (value.choiceIndex === undefined) !== (value.answerText === undefined), 'یک نوع پاسخ لازم است')

export async function sessionRoutes(fastify: FastifyInstance) {
  // POST /api/v1/sessions — start (or resume) a session for a challenge
  fastify.post('/', async (request, reply) => {
    const parseResult = createSessionSchema.safeParse(request.body)
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'ورودی نامعتبر است', details: parseResult.error.flatten() })
    }

    const { challengeId, levelId } = parseResult.data
    const user = request.user!

    if (!user.roleTrackId) {
      return reply.status(400).send({ error: 'هنوز نقشی انتخاب نشده است. ابتدا مسیر خود را انتخاب کنید.' })
    }

    const challenge = await prisma.challenge.findFirst({
      where: { id: challengeId, roleId: user.roleTrackId, status: 'active' },
      include: { level: { select: { id: true, number: true } } }
    })
    if (!challenge) {
      return reply.status(404).send({ error: 'سناریو پیدا نشد یا در دسترس نیست' })
    }

    // Path integrity: a challenge that is assigned to a level is ONLY playable
    // through that level, and only when the progression gate allows it. Playing
    // it with a bare `{ challengeId }` (no levelId) can never bypass the gate.
    let sessionLevelId: string | null = null
    if (challenge.level) {
      // A caller-supplied levelId must match the challenge's level, otherwise
      // a level could be credited by playing unrelated content.
      if (levelId && levelId !== challenge.level.id) {
        return reply.status(400).send({ error: 'مرحله با این سناریو مطابقت ندارد' })
      }
      // The caller's role scopes the gate: a track's levels unlock only
      // against that same track's progress, never another role's.
      if (!(await isLevelPlayable(user.userId, challenge.level, user.roleTrackId))) {
        return reply.status(403).send({ error: 'این مرحله قفل است. برای بازشدن آن مرحلهٔ قبلی را کامل کنید.' })
      }
      sessionLevelId = challenge.level.id
    } else if (levelId) {
      // No level backs this challenge: any levelId is bogus (a level always
      // points at exactly one challenge).
      return reply.status(400).send({ error: 'مرحله با این سناریو مطابقت ندارد' })
    }

    let started
    try {
      started = await startOrResumeSession(user.userId, challenge, sessionLevelId)
    } catch (err) {
      if (err instanceof Error && err.message === 'سناریو سؤال آغازین معتبری ندارد') {
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
      return reply.status(400).send({ error: 'ورودی نامعتبر است', details: parseResult.error.flatten() })
    }

    const user = request.user!

    const session = await prisma.session.findFirst({
      where: { id, userId: user.userId },
      include: { challenge: { include: { role: { select: { name: true } } } } }
    })
    if (!session) {
      return reply.status(404).send({ error: 'نشست پیدا نشد' })
    }
    if (session.status !== 'in_progress' || !session.currentKey) {
      return reply.status(409).send({ error: 'نشست قبلاً کامل شده است' })
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

    const isWritten = question.answerMode === 'text'
    if (isWritten !== (parseResult.data.answerText !== undefined)) {
      return reply.status(400).send({ error: 'نوع پاسخ با سؤال فعلی مطابقت ندارد' })
    }
    const streaming = isWritten && (request.headers.accept?.includes('application/x-ndjson') ?? false)
    if (streaming && !isAiConfigured()) return reply.status(503).send({ error: 'ارزیابی پاسخ تشریحی هنوز پیکربندی نشده است.' })
    const output = streaming ? new PassThrough() : null
    if (output) reply.type('application/x-ndjson; charset=utf-8').header('Cache-Control', 'no-cache, no-transform').header('X-Accel-Buffering', 'no').send(output)
    const deliver = (body: object, status = 200) => {
      if (!output) return reply.status(status).send(body)
      output.end(JSON.stringify(status >= 400 ? { type: 'error', status, ...body } : { type: 'done', result: body }) + '\n')
      return reply
    }
    let assessment: Awaited<ReturnType<typeof assessWrittenAnswer>> | undefined
    if (isWritten) {
      try {
        assessment = output
          ? await streamWrittenAnswer(question, parseResult.data.answerText!, fields => { if (!output.destroyed) output.write(JSON.stringify({ type: 'progress', fields }) + '\n') })
          : await assessWrittenAnswer(question, parseResult.data.answerText!)
      } catch (error) {
        request.log.error({ error }, 'written assessment failed')
        return deliver({
          error: isAiConfigured() ? 'ارزیابی پاسخ در دسترس نیست. دوباره تلاش کنید.' : 'ارزیابی پاسخ تشریحی هنوز پیکربندی نشده است.'
        }, isAiConfigured() ? 502 : 503)
      }
    }
    try {
      const choiceIndex = assessment?.choiceIndex ?? parseResult.data.choiceIndex!
      const choice = question.choices[choiceIndex]
      if (!choice) {
        return deliver({ error: 'گزینهٔ انتخاب‌شده برای سؤال فعلی معتبر نیست' }, 400)
      }

      const path = toPath(session).slice()
      path.push({
        key: session.currentKey,
        questionText: question.text,
        choiceIndex,
        choiceText: parseResult.data.answerText ?? choice.text,
        reveal: revealOf(choice),
        at: new Date().toISOString(),
        ...(assessment ? { assessment: { score: assessment.score, strength: assessment.strength, weakness: assessment.weakness } } : {})
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
        const score = scoreLevel(path, questions)
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
            score: score as unknown as Prisma.InputJsonValue,
            feedback: feedback as unknown as Prisma.InputJsonValue
          }
        })
        if (result.count === 0) {
          return deliver({ error: 'این سؤال قبلاً پاسخ داده شده است. صفحه را تازه‌سازی کنید.' }, 409)
        }

        const completion = session.levelId
          ? await creditLevelResult(user.userId, session.levelId, score)
          : null
        const dailyReward = await creditDailySession(session.id)
        if (completion && dailyReward) {
          completion.totalXp = dailyReward.totalXp
          completion.playerLevel = dailyReward.playerLevel
          completion.leveledUp = completion.leveledUp || dailyReward.leveledUp
        }

        return deliver({
          reveal: revealOf(choice),
          assessment: assessment ? { score: assessment.score, strength: assessment.strength, weakness: assessment.weakness } : null,
          question: null,
          status: 'completed',
          result: completion,
          dailyReward
        })
      }

      // The graph can be re-imported mid-run: if the chosen branch no longer
      // leads anywhere, retire the run rather than dead-ending on a 500.
      const nextQuestion = questions[choice.next]
      if (!nextQuestion) {
        await prisma.session.delete({ where: { id: session.id } })
        return deliver({ error: SUPERSEDED_MESSAGE, restart: true }, 409)
      }

      const result = await prisma.session.updateMany({
        where: guard,
        data: { path: pathJson, currentKey: choice.next }
      })
      if (result.count === 0) {
        return deliver({ error: 'این سؤال قبلاً پاسخ داده شده است. صفحه را تازه‌سازی کنید.' }, 409)
      }

      return deliver({
        reveal: revealOf(choice),
        assessment: assessment ? { score: assessment.score, strength: assessment.strength, weakness: assessment.weakness } : null,
        question: sanitizeQuestion(choice.next, nextQuestion),
        status: 'in_progress'
      })
    } catch (error) {
      if (!output) throw error
      request.log.error({ error }, 'streamed answer failed')
      return deliver({ error: 'ثبت پاسخ ناموفق بود. دوباره تلاش کنید.' }, 500)
    }
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
      return reply.status(404).send({ error: 'نشست پیدا نشد' })
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
      return reply.status(404).send({ error: 'نشست پیدا نشد' })
    }
    if (session.status !== 'completed') {
      return reply.status(409).send({ error: 'نشست هنوز کامل نشده است' })
    }

    const questions = getQuestions(session.challenge)
    // Prefer the score frozen at completion (content may have been re-imported
    // since); recomputing is the fallback for runs recorded before the snapshot.
    const computed = scoreLevel(toPath(session), questions)
    const snapshot = sessionScore(session.score)
    const level = session.levelId
      ? await prisma.level.findUnique({ where: { id: session.levelId }, select: { number: true } })
      : null
    const progress = session.levelId
      ? await prisma.levelProgress.findUnique({
          where: { userId_levelId: { userId: user.userId, levelId: session.levelId } }
        })
      : null
    const daily = await prisma.dailyChallenge.findUnique({ where: { sessionId: session.id }, select: { xpEarned: true } })

    return reply.send({
      id: session.id,
      challengeTitle: session.challenge.title,
      completedAt: session.completedAt,
      levelNumber: level?.number ?? null,
      score: {
        hits: snapshot?.hits ?? computed.hits,
        answered: snapshot?.answered ?? computed.answered,
        accuracy: snapshot?.accuracy ?? computed.accuracy,
        xp: progress?.xpEarned ?? daily?.xpEarned ?? 0,
        stars: progress?.bestStars ?? snapshot?.stars ?? computed.stars
      },
      dailyReward: daily?.xpEarned ?? 0,
      aiAvailable: isAiConfigured(),
      aiAssessment: session.aiAssessment ?? null,
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

  fastify.post('/:id/ai-assessment', async (request, reply) => {
    const { id } = request.params as { id: string }
    const user = request.user!
    const streaming = request.headers.accept?.includes('application/x-ndjson') ?? false
    if (!isAiConfigured()) return reply.status(503).send({ error: 'ارزیابی هوشمند هنوز پیکربندی نشده است.' })
    const session = await prisma.session.findFirst({ where: { id, userId: user.userId }, include: { challenge: true } })
    if (!session) return reply.status(404).send({ error: 'نشست پیدا نشد' })
    if (session.status !== 'completed') return reply.status(409).send({ error: 'ابتدا سناریو را کامل کنید.' })
    if (session.aiAssessment) {
      try {
        const cached = parseRunAssessment(session.aiAssessment)
        if (!streaming) return reply.send(cached)
        const output = new PassThrough()
        reply.type('application/x-ndjson; charset=utf-8').header('Cache-Control', 'no-cache, no-transform').send(output)
        output.end(JSON.stringify({ type: 'done', assessment: cached }) + '\n')
        return reply
      } catch { /* regenerate invalid legacy data */ }
    }
    const questions = getQuestions(session.challenge)
    const path = toPath(session)
    const decisions = path.map(entry => ({
      question: entry.questionText,
      answer: entry.choiceText.slice(0, 2000),
      strongest: questions[entry.key]?.choices[questions[entry.key].bestChoice]?.text ?? ''
    }))
    const referenceScore = Math.round(scoreLevel(path, questions).accuracy * 100)
    if (streaming) {
      const output = new PassThrough()
      reply.type('application/x-ndjson; charset=utf-8')
        .header('Cache-Control', 'no-cache, no-transform')
        .header('X-Accel-Buffering', 'no')
        .send(output)
      const send = (event: object) => { if (!output.destroyed) output.write(JSON.stringify(event) + '\n') }
      void (async () => {
        try {
          const assessment = await streamCompletedRun(session.challenge.title, decisions, referenceScore, fields => send({ type: 'progress', fields }))
          await prisma.session.update({ where: { id: session.id }, data: { aiAssessment: assessment as unknown as Prisma.InputJsonValue } })
          send({ type: 'done', assessment })
        } catch (error) {
          request.log.error({ error }, 'run AI assessment stream failed')
          send({ type: 'error', error: 'ارزیابی هوشمند در دسترس نیست. دوباره تلاش کنید.' })
        } finally {
          output.end()
        }
      })()
      return reply
    }
    try {
      const assessment = await assessCompletedRun(session.challenge.title, decisions, referenceScore)
      await prisma.session.update({ where: { id: session.id }, data: { aiAssessment: assessment as unknown as Prisma.InputJsonValue } })
      return reply.send(assessment)
    } catch (error) {
      request.log.error({ error }, 'run AI assessment failed')
      return reply.status(502).send({ error: 'ارزیابی هوشمند در دسترس نیست. دوباره تلاش کنید.' })
    }
  })
}
