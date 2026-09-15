import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.ts'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import jwt from 'jsonwebtoken'
import { createSessionToken, AuthUser, JWT_SECRET } from '../middleware/requireAuth.ts'

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
})

const onboardingSchema = z.object({
  roleId: z.string().uuid()
})

export async function authRoutes(fastify: FastifyInstance) {
  // POST /api/v1/auth/signup
  fastify.post('/signup', async (request, reply) => {
    const parseResult = signupSchema.safeParse(request.body)
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parseResult.error.flatten() })
    }

    const { email, password } = parseResult.data

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return reply.status(409).send({ error: 'Email already registered' })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: { email, passwordHash },
      select: { id: true, email: true, role: true, roleTrackId: true, cohortId: true }
    })

    const token = createSessionToken(user)
    reply.setCookie('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/'
    })

    return reply.status(201).send({ userId: user.id })
  })

  // POST /api/v1/auth/login
  fastify.post('/login', async (request, reply) => {
    const parseResult = loginSchema.safeParse(request.body)
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parseResult.error.flatten() })
    }

    const { email, password } = parseResult.data

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.passwordHash) {
      return reply.status(401).send({ error: 'Invalid credentials' })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid credentials' })
    }

    const token = createSessionToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      roleTrackId: user.roleTrackId,
      cohortId: user.cohortId
    })

    reply.setCookie('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/'
    })

    return reply.send({ userId: user.id })
  })

  // POST /api/v1/auth/logout
  fastify.post('/logout', async (_request, reply) => {
    reply.clearCookie('session', { path: '/' })
    return reply.send({ success: true })
  })

  // POST /api/v1/auth/onboarding/role
  fastify.post('/onboarding/role', async (request, reply) => {
    const token = request.cookies?.session
    console.log('DEBUG onboarding/role - cookies:', request.cookies)
    console.log('DEBUG onboarding/role - token:', token)
    console.log('DEBUG onboarding/role - JWT_SECRET:', JWT_SECRET)
    if (!token) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    // Verify token manually since this is under public auth routes
    let userId: string
    try {
      const payload = jwt.verify(token, JWT_SECRET) as AuthUser
      userId = payload.userId
    } catch {
      return reply.status(401).send({ error: 'Invalid session' })
    }

    const parseResult = onboardingSchema.safeParse(request.body)
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parseResult.error.flatten() })
    }

    const { roleId } = parseResult.data

    const role = await prisma.role.findUnique({ where: { id: roleId } })
    if (!role) {
      return reply.status(404).send({ error: 'Role not found' })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, roleTrackId: true, cohortId: true }
    })
    
    if (!user) {
      return reply.status(401).send({ error: 'User not found' })
    }
    
    if (user.roleTrackId) {
      return reply.status(409).send({ error: 'Role already selected' })
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { roleTrackId: roleId },
      select: { id: true, email: true, role: true, roleTrackId: true, cohortId: true }
    })

    const newToken = createSessionToken(updatedUser)
    reply.setCookie('session', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/'
    })

    return reply.send({ success: true })
  })

  // GET /api/v1/auth/me - for checking current session
  fastify.get('/me', async (request, reply) => {
    const token = request.cookies?.session
    if (!token) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    // Verify token manually since this is under public auth routes
    let user: { id: string; email: string; role: string; roleTrackId: string | null; cohortId: string | null }
    try {
      const payload = jwt.verify(token, JWT_SECRET) as AuthUser
      const dbUser = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, email: true, role: true, roleTrackId: true, cohortId: true }
      })
      if (!dbUser) {
        return reply.status(401).send({ error: 'User not found' })
      }
      user = dbUser
    } catch {
      return reply.status(401).send({ error: 'Invalid session' })
    }

    return reply.send({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        roleTrackId: user.roleTrackId,
        cohortId: user.cohortId
      }
    })
  })
}