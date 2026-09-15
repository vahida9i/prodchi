import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.ts'

/**
 * The caller's skill tree (spec Section 9, screen 3): categories and skills for
 * their role, each with the user's current score and whether the previous skill's
 * `unlockThreshold` gates it.
 *
 * Lock state is computed here from `SkillScore` so the client does not have to
 * re-derive progression rules (or hardcode the tree).
 */
export async function skillRoutes(fastify: FastifyInstance) {
  // GET /api/v1/skills
  fastify.get('/', async (request, reply) => {
    const user = request.user!

    if (!user.roleTrackId) {
      return reply.status(400).send({ error: 'Role not selected. Complete onboarding first.' })
    }

    const categories = await prisma.skillCategory.findMany({
      where: { roleId: user.roleTrackId },
      orderBy: { order: 'asc' },
      include: { skills: { orderBy: { order: 'asc' } } }
    })

    const scores = await prisma.skillScore.findMany({
      where: { userId: user.userId },
      select: { skillId: true, score: true }
    })
    const scoreBySkill = new Map(scores.map(s => [s.skillId, s.score]))

    return reply.send({
      categories: categories.map(category => ({
        id: category.id,
        name: category.name,
        order: category.order,
        skills: category.skills.map((skill, index) => {
          const previous = category.skills[index - 1]
          const score = scoreBySkill.get(skill.id) ?? null
          const locked = Boolean(
            skill.unlockThreshold !== null &&
              previous &&
              (scoreBySkill.get(previous.id) ?? 0) < skill.unlockThreshold
          )

          return {
            id: skill.id,
            name: skill.name,
            order: skill.order,
            unlockThreshold: skill.unlockThreshold,
            gatedBySkillId: previous?.id ?? null,
            score,
            locked
          }
        })
      }))
    })
  })
}