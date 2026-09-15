import './lib/env.ts'
import fastify from 'fastify'
import fastifyCookie from '@fastify/cookie'
import fastifyCors from '@fastify/cors'
import { authRoutes } from './routes/auth.ts'
import { challengeRoutes } from './routes/challenges.ts'
import { attemptRoutes } from './routes/attempts.ts'
import { profileRoutes } from './routes/profile.ts'
import { roleRoutes } from './routes/roles.ts'
import { skillRoutes } from './routes/skills.ts'
import { adminSkillRoutes } from './routes/admin/skills.ts'
import { adminChallengeRoutes } from './routes/admin/challenges.ts'
import { requireAuth } from './middleware/requireAuth.ts'
import { requireAdmin } from './middleware/requireAdmin.ts'

const app = fastify({
  logger: true
})

// The web client posts some bodyless endpoints (logout, attempt completion) with
// a JSON content type, which the default parser rejects with an empty-body 400.
// Treat an empty JSON body as an empty object so these endpoints stay callable.
app.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, body, done) => {
  // parseAs: 'string' guarantees a string payload at runtime; the union type in
  // the callback signature is only there for binary parsers.
  const raw = body as string
  if (raw.trim() === '') {
    done(null, {})
    return
  }
  try {
    done(null, JSON.parse(raw))
  } catch (err) {
    done(err as Error, undefined)
  }
})

app.register(fastifyCors, {
  origin: process.env.WEB_URL || 'http://localhost:3000',
  credentials: true
})

app.register(fastifyCookie, {
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  parseOptions: {}
})

// Health check
app.get('/health', async () => ({ status: 'ok' }))

// Public auth routes
app.register(authRoutes, { prefix: '/api/v1/auth' })

// Protected user routes
app.register(async function (fastify) {
  fastify.addHook('preHandler', requireAuth)
  fastify.register(challengeRoutes, { prefix: '/api/v1/challenges' })
  fastify.register(attemptRoutes, { prefix: '/api/v1/attempts' })
  fastify.register(profileRoutes, { prefix: '/api/v1/profile' })
  fastify.register(roleRoutes, { prefix: '/api/v1/roles' })
  fastify.register(skillRoutes, { prefix: '/api/v1/skills' })
})

// Admin routes
app.register(async function (fastify) {
  // requireAdmin performs the authentication step itself (spec Section 6:
  // requireAuth on everything except /auth/*, requireAdmin additionally on
  // /admin/*), so it must not be chained after requireAuth here.
  fastify.addHook('preHandler', requireAdmin)
  fastify.register(adminSkillRoutes, { prefix: '/api/v1/admin' })
  fastify.register(adminChallengeRoutes, { prefix: '/api/v1/admin' })
})

const start = async () => {
  try {
    await app.listen({ port: Number(process.env.PORT) || 4000, host: '0.0.0.0' })
    console.log(`API server running on port ${process.env.PORT || 4000}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()