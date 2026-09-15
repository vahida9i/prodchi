import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../lib/prisma.ts'
// Using JWT for session management

import jwt from 'jsonwebtoken'

export const JWT_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-in-production'

export interface AuthUser {
  userId: string
  email: string
  role: string
  roleTrackId: string | null
  cohortId: string | null
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const token = request.cookies?.session
  console.log('DEBUG requireAuth - cookies:', request.cookies)
  console.log('DEBUG requireAuth - token:', token)

  if (!token) {
    return reply.status(401).send({ error: 'Unauthorized' })
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthUser
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, role: true, roleTrackId: true, cohortId: true }
    })

    if (!user) {
      return reply.status(401).send({ error: 'User not found' })
    }

    // Map database user to AuthUser interface
    request.user = {
      userId: user.id,
      email: user.email,
      role: user.role,
      roleTrackId: user.roleTrackId,
      cohortId: user.cohortId
    }
  } catch {
    return reply.status(401).send({ error: 'Invalid session' })
  }
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  await requireAuth(request, reply)
  if (request.user?.role !== 'admin') {
    return reply.status(403).send({ error: 'Forbidden: Admin access required' })
  }
}

export function createSessionToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '30d' })
}

export function parseSessionToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser
  } catch {
    return null
  }
}