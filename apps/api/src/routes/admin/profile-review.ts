import type { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma.ts'

export async function adminProfileReviewRoutes(fastify: FastifyInstance) {
  fastify.get('/profile-review', async () => {
    const [evidence, profiles] = await Promise.all([
      prisma.profileEvidence.findMany({ where: { verifiedAt: null }, orderBy: { createdAt: 'asc' }, take: 100, select: { id: true, type: true, title: true, description: true, url: true, createdAt: true, user: { select: { id: true, displayName: true } } } }),
      prisma.user.findMany({ where: { publicProfileToken: { not: null } }, orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, displayName: true, mentorVerifiedAt: true } })
    ])
    return { evidence, profiles }
  })

  fastify.post('/profile-review/evidence/:id/verify', async (request, reply) => {
    const { id } = request.params as { id: string }
    const result = await prisma.profileEvidence.updateMany({ where: { id, verifiedAt: null }, data: { verifiedAt: new Date(), verifiedBy: request.user!.userId } })
    if (!result.count) return reply.status(404).send({ error: 'شاهد در انتظار تأیید پیدا نشد' })
    return reply.send({ success: true })
  })

  fastify.post('/profile-review/users/:id/verify', async (request, reply) => {
    const { id } = request.params as { id: string }
    const existing = await prisma.user.findUnique({ where: { id }, select: { id: true } })
    if (!existing) return reply.status(404).send({ error: 'کاربر پیدا نشد' })
    await prisma.user.update({ where: { id }, data: { mentorVerifiedAt: new Date(), mentorVerifiedBy: request.user!.userId } })
    return reply.send({ success: true })
  })
}
