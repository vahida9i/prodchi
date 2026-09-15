import { FastifyRequest, FastifyReply } from 'fastify'
import { requireAuth } from './requireAuth.ts'

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  await requireAuth(request, reply)
  if (request.user?.role !== 'admin') {
    return reply.status(403).send({ error: 'Forbidden: Admin access required' })
  }
}