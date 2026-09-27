import type { FastifyInstance } from 'fastify'
import type { Question } from '@prodchi/shared-types/challenge-schema'
import { XP_PER_BEST_CHOICE } from '@prodchi/shared-types/challenge-schema'
import { getOrAssignDaily } from '../services/daily-challenge.ts'
import { startOrResumeSession } from '../services/session-engine.ts'
import { prisma } from '../lib/prisma.ts'

export async function dailyRoutes(fastify: FastifyInstance) {
  const getDaily = async (userId: string, roleId: string) => {
    const assigned = await getOrAssignDaily(userId, roleId)
    if (!assigned) return null
    const questions = assigned.challenge.questions as Record<string, Question>
    const count = Object.keys(questions).length
    return {
      day: assigned.day, challengeId: assigned.challengeId, title: assigned.challenge.title,
      summary: assigned.challenge.summary, difficulty: assigned.challenge.difficulty,
      estimatedMinutes: Math.max(3, Math.min(30, count * 2)),
      maxXp: count * XP_PER_BEST_CHOICE, bonusXp: 20,
      completed: Boolean(assigned.completedAt), sessionId: assigned.sessionId
    }
  }

  fastify.get('/', async (request, reply) => {
    if (!request.user!.roleTrackId) return reply.status(400).send({ error: 'ابتدا نقش خود را انتخاب کنید.' })
    const daily = await getDaily(request.user!.userId, request.user!.roleTrackId)
    if (!daily) return reply.status(404).send({ error: 'چالش فعالی برای این نقش نیست.' })
    return reply.send(daily)
  })

  fastify.post('/start', async (request, reply) => {
    const user = request.user!
    if (!user.roleTrackId) return reply.status(400).send({ error: 'ابتدا نقش خود را انتخاب کنید.' })
    const assigned = await getOrAssignDaily(user.userId, user.roleTrackId)
    if (!assigned || assigned.challenge.status !== 'active') return reply.status(404).send({ error: 'چالش امروز در دسترس نیست.' })
    if (assigned.completedAt) return reply.status(409).send({ error: 'چالش امروز کامل شده است.', sessionId: assigned.sessionId })
    const started = await startOrResumeSession(user.userId, assigned.challenge, null)
    // A session left open overnight belongs to today's assignment only.
    await prisma.dailyChallenge.updateMany({ where: { sessionId: started.sessionId, completedAt: null }, data: { sessionId: null } })
    await prisma.dailyChallenge.update({ where: { userId_roleId_day: { userId: user.userId, roleId: user.roleTrackId, day: assigned.day } }, data: { sessionId: started.sessionId } })
    return reply.send(started)
  })
}
