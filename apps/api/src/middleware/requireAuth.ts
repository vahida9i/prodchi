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

/** Shape of the `User` columns needed to build a session user. */
export interface SessionUserRow {
  id: string
  email: string
  role: string
  roleTrackId: string | null
  cohortId: string | null
}

/**
 * Single mapping from a `User` row to the session payload, so route handlers and
 * the `requireAuth` hook can never drift apart on the shape of `AuthUser`.
 */
export function toAuthUser(user: SessionUserRow): AuthUser {
  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    roleTrackId: user.roleTrackId,
    cohortId: user.cohortId
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser
  }
}

/**
 * Single place where a session cookie is turned into an authenticated user.
 * Used by the `requireAuth` hook and by the auth routes that live outside the
 * protected scope (`/auth/me`, `/auth/onboarding/role`), so token verification
 * and the DB lookup can never drift between entry points.
 */
export async function resolveSessionUser(request: FastifyRequest): Promise<AuthUser | null> {
  const token = request.cookies?.session
  if (!token) {
    return null
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthUser
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, role: true, roleTrackId: true, cohortId: true }
    })

    return user ? toAuthUser(user) : null
  } catch {
    return null
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!request.cookies?.session) {
    return reply.status(401).send({ error: 'Unauthorized' })
  }

  const user = await resolveSessionUser(request)
  if (!user) {
    return reply.status(401).send({ error: 'Invalid session' })
  }

  request.user = user
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) {
    await requireAuth(request, reply)
    if (!request.user) return
  }

  if (request.user.role !== 'admin') {
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