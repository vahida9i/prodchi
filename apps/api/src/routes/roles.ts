import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.ts'

/**
 * The two role tracks are fixed seed data (spec Section 4: Role is created by the
 * seed, not by users or admins). Client screens need their real UUIDs instead of
 * hardcoded slugs, so they are exposed here for onboarding and the admin panel.
 */
export async function roleRoutes(fastify: FastifyInstance) {
  // GET /api/v1/roles
  fastify.get('/', async (_request, reply) => {
    const roles = await prisma.role.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true }
    })

    return reply.send({ roles })
  })
}