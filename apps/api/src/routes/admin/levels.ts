import { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma.ts'
import { z } from 'zod'
import { isSingleQuestion } from '@baaten/shared-types/scoring'
import { DIFFICULTIES } from '@baaten/shared-types/challenge-schema'
import type { Question } from '@baaten/shared-types/challenge-schema'

const createIndustrySchema = z.object({
  name: z.string().min(1),
  order: z.number().int().default(0)
})

const updateIndustrySchema = z.object({
  name: z.string().min(1).optional(),
  order: z.number().int().optional()
})

const createLevelSchema = z.object({
  number: z.number().int().positive(),
  industryId: z.string().uuid(),
  difficulty: z.enum(DIFFICULTIES),
  challengeId: z.string().uuid()
})

const updateLevelSchema = z.object({
  number: z.number().int().positive().optional(),
  industryId: z.string().uuid().optional(),
  difficulty: z.enum(DIFFICULTIES).optional(),
  status: z.enum(['active', 'retired']).optional()
})

/**
 * Admin management of the level path: industries, and levels (which only ever
 * wrap an already-imported challenge). `type` is derived from the question
 * graph at assignment time, so it can never disagree with the content.
 */
export async function adminLevelRoutes(fastify: FastifyInstance) {
  // GET /api/v1/admin/industries
  fastify.get('/industries', async (_request, reply) => {
    const industries = await prisma.industry.findMany({
      orderBy: { order: 'asc' },
      include: { _count: { select: { levels: true } } }
    })

    return reply.send({
      industries: industries.map(industry => ({
        id: industry.id,
        name: industry.name,
        order: industry.order,
        levelCount: industry._count.levels
      }))
    })
  })

  // POST /api/v1/admin/industries
  fastify.post('/industries', async (request, reply) => {
    const parseResult = createIndustrySchema.safeParse(request.body)
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parseResult.error.flatten() })
    }

    try {
      const industry = await prisma.industry.create({ data: parseResult.data })
      return reply.status(201).send(industry)
    } catch (err: any) {
      if (err?.code === 'P2002') {
        return reply.status(409).send({ error: `An industry named "${parseResult.data.name}" already exists` })
      }
      throw err
    }
  })

  // PATCH /api/v1/admin/industries/:id
  fastify.patch('/industries/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const parseResult = updateIndustrySchema.safeParse(request.body)
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parseResult.error.flatten() })
    }

    try {
      const industry = await prisma.industry.update({ where: { id }, data: parseResult.data })
      return reply.send(industry)
    } catch (err: any) {
      if (err?.code === 'P2025') return reply.status(404).send({ error: 'Industry not found' })
      if (err?.code === 'P2002') return reply.status(409).send({ error: 'Another industry already uses that name' })
      throw err
    }
  })

  // DELETE /api/v1/admin/industries/:id — only when no levels reference it
  fastify.delete('/industries/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const levelCount = await prisma.level.count({ where: { industryId: id } })
    if (levelCount > 0) {
      return reply.status(409).send({ error: 'Cannot delete an industry that still has levels. Retire or reassign them.' })
    }

    try {
      await prisma.industry.delete({ where: { id } })
      return reply.send({ success: true })
    } catch (err: any) {
      if (err?.code === 'P2025') return reply.status(404).send({ error: 'Industry not found' })
      throw err
    }
  })

  // GET /api/v1/admin/levels/unassigned — imported challenges with no level yet.
  // Declared before /levels/:id-style routes so it is never read as an id.
  fastify.get('/levels/unassigned', async (_request, reply) => {
    const challenges = await prisma.challenge.findMany({
      where: { status: 'active', level: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, importKey: true, title: true, difficulty: true, questions: true }
    })

    return reply.send({
      challenges: challenges.map(challenge => ({
        id: challenge.id,
        importKey: challenge.importKey,
        title: challenge.title,
        difficulty: challenge.difficulty,
        type: isSingleQuestion(challenge.questions as Record<string, Question>) ? 'single_question' : 'challenge'
      }))
    })
  })

  // GET /api/v1/admin/levels
  fastify.get('/levels', async (_request, reply) => {
    const levels = await prisma.level.findMany({
      orderBy: { number: 'asc' },
      include: {
        industry: { select: { id: true, name: true } },
        challenge: { select: { id: true, importKey: true, title: true, status: true } },
        _count: { select: { progress: true } }
      }
    })

    return reply.send({
      levels: levels.map(level => ({
        id: level.id,
        number: level.number,
        industry: level.industry,
        difficulty: level.difficulty,
        type: level.type,
        status: level.status,
        challenge: level.challenge,
        playerCount: level._count.progress
      }))
    })
  })

  // POST /api/v1/admin/levels — assign an imported challenge to a level number
  fastify.post('/levels', async (request, reply) => {
    const parseResult = createLevelSchema.safeParse(request.body)
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parseResult.error.flatten() })
    }

    const { number, industryId, difficulty, challengeId } = parseResult.data

    const [industry, challenge] = await Promise.all([
      prisma.industry.findUnique({ where: { id: industryId }, select: { id: true } }),
      prisma.challenge.findUnique({ where: { id: challengeId }, select: { id: true, questions: true } })
    ])

    if (!industry) return reply.status(404).send({ error: 'Industry not found' })
    if (!challenge) return reply.status(404).send({ error: 'Challenge not found' })

    // Derived, never authored: one question whose every choice ends the session.
    const type = isSingleQuestion(challenge.questions as Record<string, Question>)
      ? 'single_question'
      : 'challenge'

    try {
      const level = await prisma.level.create({
        data: { number, industryId, difficulty, challengeId, type, status: 'active' }
      })
      return reply.status(201).send({ id: level.id, number: level.number, type: level.type })
    } catch (err: any) {
      // P2002 covers both the unique `number` and the unique `challengeId`.
      if (err?.code === 'P2002') {
        const target = String(err?.meta?.target ?? '')
        return reply.status(409).send({
          error: target.includes('challengeId')
            ? 'That challenge is already assigned to a level'
            : `Level number ${number} is already taken`
        })
      }
      throw err
    }
  })

  // PATCH /api/v1/admin/levels/:id — rename/reorder/re-tag/retire
  fastify.patch('/levels/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const parseResult = updateLevelSchema.safeParse(request.body)
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parseResult.error.flatten() })
    }

    // A nonexistent industry would otherwise fail later as an opaque FK
    // violation; report it the way the create route does.
    if (parseResult.data.industryId) {
      const industry = await prisma.industry.findUnique({
        where: { id: parseResult.data.industryId },
        select: { id: true }
      })
      if (!industry) return reply.status(404).send({ error: 'Industry not found' })
    }

    try {
      const level = await prisma.level.update({ where: { id }, data: parseResult.data })
      return reply.send({ id: level.id, number: level.number, status: level.status, difficulty: level.difficulty })
    } catch (err: any) {
      if (err?.code === 'P2025') return reply.status(404).send({ error: 'Level not found' })
      if (err?.code === 'P2002') return reply.status(409).send({ error: 'That level number is already taken' })
      throw err
    }
  })

  // DELETE /api/v1/admin/levels/:id — only when nobody has progress on it
  fastify.delete('/levels/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const progressCount = await prisma.levelProgress.count({ where: { levelId: id } })
    if (progressCount > 0) {
      return reply.status(409).send({ error: 'Cannot delete a level players have progress on. Retire it instead.' })
    }

    try {
      await prisma.level.delete({ where: { id } })
      return reply.send({ success: true })
    } catch (err: any) {
      if (err?.code === 'P2025') return reply.status(404).send({ error: 'Level not found' })
      throw err
    }
  })
}
