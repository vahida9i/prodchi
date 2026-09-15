import { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma.ts'
import { z } from 'zod'

const createSkillCategorySchema = z.object({
  name: z.string().min(1),
  roleId: z.string().uuid(),
  order: z.number().int().default(0)
})

const updateSkillCategorySchema = z.object({
  name: z.string().min(1).optional(),
  order: z.number().int().optional()
})

const createSkillSchema = z.object({
  name: z.string().min(1),
  skillCategoryId: z.string().uuid(),
  order: z.number().int().default(0),
  unlockThreshold: z.number().int().min(0).max(100).nullable().optional()
})

const updateSkillSchema = z.object({
  name: z.string().min(1).optional(),
  order: z.number().int().optional(),
  unlockThreshold: z.number().int().min(0).max(100).nullable().optional()
})

export async function adminSkillRoutes(fastify: FastifyInstance) {
  // GET /api/v1/admin/skill-categories?roleId=
  fastify.get('/skill-categories', async (request, reply) => {
    const { roleId } = request.query as { roleId?: string }

    const categories = await prisma.skillCategory.findMany({
      where: roleId ? { roleId } : undefined,
      orderBy: [{ roleId: 'asc' }, { order: 'asc' }],
      include: {
        skills: { orderBy: { order: 'asc' } }
      }
    })

    return reply.send({ categories })
  })

  // GET /api/v1/admin/skills?skillCategoryId=
  fastify.get('/skills', async (request, reply) => {
    const { skillCategoryId } = request.query as { skillCategoryId?: string }

    const skills = await prisma.skill.findMany({
      where: skillCategoryId ? { skillCategoryId } : undefined,
      orderBy: [{ skillCategoryId: 'asc' }, { order: 'asc' }],
      include: { skillCategory: { select: { id: true, name: true, roleId: true } } }
    })

    return reply.send({ skills })
  })

  // Skill Categories
  fastify.post('/skill-categories', async (request, reply) => {
    const parseResult = createSkillCategorySchema.safeParse(request.body)
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parseResult.error.flatten() })
    }

    const { name, roleId, order } = parseResult.data

    const role = await prisma.role.findUnique({ where: { id: roleId } })
    if (!role) {
      return reply.status(404).send({ error: 'Role not found' })
    }

    const category = await prisma.skillCategory.create({
      data: { name, roleId, order }
    })

    return reply.status(201).send(category)
  })

  fastify.patch('/skill-categories/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const parseResult = updateSkillCategorySchema.safeParse(request.body)
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parseResult.error.flatten() })
    }

    const category = await prisma.skillCategory.update({
      where: { id },
      data: parseResult.data
    })

    return reply.send(category)
  })

  fastify.delete('/skill-categories/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const skillsCount = await prisma.skill.count({ where: { skillCategoryId: id } })
    if (skillsCount > 0) {
      return reply.status(409).send({ error: 'Cannot delete category with existing skills' })
    }

    await prisma.skillCategory.delete({ where: { id } })
    return reply.send({ success: true })
  })

  // Skills
  fastify.post('/skills', async (request, reply) => {
    const parseResult = createSkillSchema.safeParse(request.body)
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parseResult.error.flatten() })
    }

    const { name, skillCategoryId, order, unlockThreshold } = parseResult.data

    const category = await prisma.skillCategory.findUnique({ where: { id: skillCategoryId } })
    if (!category) {
      return reply.status(404).send({ error: 'Skill category not found' })
    }

    const skill = await prisma.skill.create({
      data: { name, skillCategoryId, order, unlockThreshold }
    })

    return reply.status(201).send(skill)
  })

  fastify.patch('/skills/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const parseResult = updateSkillSchema.safeParse(request.body)
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parseResult.error.flatten() })
    }

    const skill = await prisma.skill.update({
      where: { id },
      data: parseResult.data
    })

    return reply.send(skill)
  })

  fastify.delete('/skills/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const challengeLinks = await prisma.challengeSkill.count({ where: { skillId: id } })
    const skillScores = await prisma.skillScore.count({ where: { skillId: id } })

    if (challengeLinks > 0 || skillScores > 0) {
      return reply.status(409).send({ error: 'Cannot delete skill with existing challenge links or skill scores' })
    }

    await prisma.skill.delete({ where: { id } })
    return reply.send({ success: true })
  })
}