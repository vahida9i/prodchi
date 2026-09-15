import fastify from 'fastify'
import fastifyCookie from '@fastify/cookie'
import fastifyCors from '@fastify/cors'
import { authRoutes } from './routes/auth.ts'
import { challengeRoutes } from './routes/challenges.ts'
import { attemptRoutes } from './routes/attempts.ts'
import { profileRoutes } from './routes/profile.ts'
import { adminSkillRoutes } from './routes/admin/skills.ts'
import { adminChallengeRoutes } from './routes/admin/challenges.ts'
import { requireAuth } from './middleware/requireAuth.ts'
import { requireAdmin } from './middleware/requireAdmin.ts'

const app = fastify({
  logger: true
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
})

// Admin routes
app.register(async function (fastify) {
  fastify.addHook('preHandler', requireAuth)
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