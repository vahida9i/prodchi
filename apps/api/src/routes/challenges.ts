import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.ts'
import { z } from 'zod'

const challengeListQuerySchema = z.object({
  tier: z.enum(['free', 'pro']).optional()
})

export async function challengeRoutes(fastify: FastifyInstance) {
  // GET /api/v1/challenges
  fastify.get('/', async (request, reply) => {
    const parseResult = challengeListQuerySchema.safeParse(request.query)
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Invalid query', details: parseResult.error.flatten() })
    }

    const { tier } = parseResult.data
    const user = request.user!

    if (!user.roleTrackId) {
      return reply.status(400).send({ error: 'Role not selected. Complete onboarding first.' })
    }

    const where: any = {
      roleId: user.roleTrackId,
      status: 'published'
    }

    if (tier) {
      where.tier = tier
    } else {
      // Default to free tier for non-pro users
      where.tier = 'free'
    }

    const challenges = await prisma.challenge.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        difficulty: true,
        estimatedMinutes: true,
        xpValue: true,
        skills: {
          select: { skillId: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    return reply.send({
      challenges: challenges.map(c => ({
        id: c.id,
        title: c.title,
        description: c.description,
        difficulty: c.difficulty,
        estimatedMinutes: c.estimatedMinutes,
        xpValue: c.xpValue,
        skillIds: c.skills.map(s => s.skillId)
      }))
    })
  })

  // GET /api/v1/challenges/:id
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const user = request.user!

    if (!user.roleTrackId) {
      return reply.status(400).send({ error: 'Role not selected. Complete onboarding first.' })
    }

    const challenge = await prisma.challenge.findFirst({
      where: {
        id,
        roleId: user.roleTrackId,
        status: 'published',
        tier: 'free' // MVP: only free tier
      },
      select: {
        id: true,
        title: true,
        description: true,
        difficulty: true,
        estimatedMinutes: true,
        xpValue: true,
        applicantSteps: true,
        skills: {
          select: { skillId: true }
        }
      }
    })

    if (!challenge) {
      return reply.status(404).send({ error: 'Challenge not found' })
    }

    return reply.send({
      id: challenge.id,
      title: challenge.title,
      description: challenge.description,
      difficulty: challenge.difficulty,
      estimatedMinutes: challenge.estimatedMinutes,
      xpValue: challenge.xpValue,
      applicantSteps: challenge.applicantSteps,
      skillIds: challenge.skills.map(s => s.skillId)
    })
  })
}