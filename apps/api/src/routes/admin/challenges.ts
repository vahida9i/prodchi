import { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma.ts'
import { z } from 'zod'
import { validateChallengeImport } from '@baaten/shared-types/validator'

const updateChallengeStatusSchema = z.object({
  status: z.enum(['draft', 'published'])
})

const adminChallengeListQuerySchema = z.object({
  status: z.enum(['draft', 'published']).optional()
})

export async function adminChallengeRoutes(fastify: FastifyInstance) {
  // POST /api/v1/admin/challenges/import
  fastify.post('/challenges/import', async (request, reply) => {
    const validation = await validateChallengeImport(request.body)

    if (!validation.valid) {
      return reply.status(400).send({ errors: validation.errors })
    }

    const { parsed } = validation!
    const { metadata, hiddenCase, applicantSteps, answerSheet } = parsed!

    const challenge = await prisma.challenge.create({
      data: {
        title: metadata.title,
        description: metadata.description,
        estimatedMinutes: metadata.estimatedMinutes,
        roleId: metadata.roleId,
        difficulty: metadata.difficulty,
        tier: metadata.tier,
        xpValue: metadata.xpValue,
        hiddenCase,
        applicantSteps,
        answerSheet,
        status: 'draft',
        skills: {
          create: metadata.skillIds.map(skillId => ({ skillId }))
        }
      }
    })

    return reply.status(201).send({ challengeId: challenge.id })
  })

  // GET /api/v1/admin/challenges
  fastify.get('/challenges', async (request, reply) => {
    const parseResult = adminChallengeListQuerySchema.safeParse(request.query)
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Invalid query', details: parseResult.error.flatten() })
    }

    const { status } = parseResult.data

    const where: any = {}
    if (status) {
      where.status = status
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
        tier: true,
        status: true,
        createdAt: true,
        skills: { select: { skillId: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    return reply.send({
      challenges: challenges.map(c => ({
        id: c.id,
        title: c.title,
        description: c.description,
        difficulty: c.difficulty,
        estimatedMinutes: c.estimatedMinutes,
        xpValue: c.xpValue,
        tier: c.tier,
        status: c.status,
        createdAt: c.createdAt,
        skillIds: c.skills.map(s => s.skillId)
      }))
    })
  })

  // GET /api/v1/admin/challenges/:id
  fastify.get('/challenges/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const challenge = await prisma.challenge.findUnique({
      where: { id },
      include: {
        skills: { select: { skillId: true } }
      }
    })

    if (!challenge) {
      return reply.status(404).send({ error: 'Challenge not found' })
    }

    return reply.send({
      id: challenge.id,
      title: challenge.title,
      description: challenge.description,
      estimatedMinutes: challenge.estimatedMinutes,
      roleId: challenge.roleId,
      difficulty: challenge.difficulty,
      tier: challenge.tier,
      xpValue: challenge.xpValue,
      hiddenCase: challenge.hiddenCase,
      applicantSteps: challenge.applicantSteps,
      answerSheet: challenge.answerSheet,
      status: challenge.status,
      createdAt: challenge.createdAt,
      skillIds: challenge.skills.map(s => s.skillId)
    })
  })

  // PATCH /api/v1/admin/challenges/:id/status
  fastify.patch('/challenges/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string }
    const parseResult = updateChallengeStatusSchema.safeParse(request.body)
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parseResult.error.flatten() })
    }

    const { status } = parseResult.data

    const challenge = await prisma.challenge.update({
      where: { id },
      data: { status }
    })

    return reply.send(challenge)
  })

  // DELETE /api/v1/admin/challenges/:id
  fastify.delete('/challenges/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const attemptsCount = await prisma.attempt.count({ where: { challengeId: id } })
    if (attemptsCount > 0) {
      return reply.status(409).send({ error: 'Cannot delete challenge with existing attempts. Unpublish instead.' })
    }

    await prisma.challenge.delete({ where: { id } })
    return reply.send({ success: true })
  })
}