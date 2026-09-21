import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.ts'

export async function challengeRoutes(fastify: FastifyInstance) {
  // GET /api/v1/challenges — the active library for the candidate's role track
  fastify.get('/', async (request, reply) => {
    const user = request.user!

    if (!user.roleTrackId) {
      return reply.status(400).send({ error: 'Role not selected. Complete onboarding first.' })
    }

    const challenges = await prisma.challenge.findMany({
      where: { roleId: user.roleTrackId, status: 'active' },
      select: { id: true, title: true, difficulty: true },
      orderBy: { createdAt: 'asc' }
    })

    // Resume capability: surface any in-progress session so the library can
    // offer "Resume" instead of starting a second path.
    const inProgress = await prisma.session.findMany({
      where: {
        userId: user.userId,
        status: 'in_progress',
        challengeId: { in: challenges.map(c => c.id) }
      },
      select: { id: true, challengeId: true }
    })
    const sessionIdByChallenge = new Map(inProgress.map(s => [s.challengeId, s.id]))

    return reply.send({
      challenges: challenges.map(c => ({
        id: c.id,
        title: c.title,
        difficulty: c.difficulty,
        inProgressSessionId: sessionIdByChallenge.get(c.id) ?? null
      }))
    })
  })

  // GET /api/v1/challenges/:id — metadata only. Question content is served
  // exclusively by the session engine, one question at a time (field
  // visibility rule, plan Section 7).
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const user = request.user!

    if (!user.roleTrackId) {
      return reply.status(400).send({ error: 'Role not selected. Complete onboarding first.' })
    }

    const challenge = await prisma.challenge.findFirst({
      where: { id, roleId: user.roleTrackId, status: 'active' },
      select: { id: true, title: true, difficulty: true }
    })

    if (!challenge) {
      return reply.status(404).send({ error: 'Challenge not found' })
    }

    const inProgress = await prisma.session.findFirst({
      where: { userId: user.userId, challengeId: challenge.id, status: 'in_progress' },
      select: { id: true }
    })

    return reply.send({
      ...challenge,
      inProgressSessionId: inProgress?.id ?? null
    })
  })
}