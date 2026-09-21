import { FastifyRequest, FastifyReply } from 'fastify'
import { requireAuth } from './requireAuth.ts'

/**
 * Admin gate for the /api/v1/admin scope. It performs the authentication step
 * itself, so it must not be chained after `requireAuth`. When authentication
 * fails, `requireAuth` has already replied 401 — return silently instead of
 * sending a second response, which Fastify logs as a double-send error.
 */
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  await requireAuth(request, reply)
  if (!request.user) return
  if (request.user.role !== 'admin') {
    return reply.status(403).send({ error: 'Forbidden: Admin access required' })
  }
}