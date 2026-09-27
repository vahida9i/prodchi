import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.ts'
import { ROLES } from '@prodchi/shared-types/challenge-schema'
import type { Question } from '@prodchi/shared-types/challenge-schema'
import { buildSkillProfile } from '@prodchi/shared-types/skills'
import type { SkillPathEntry } from '@prodchi/shared-types/skills'

const profileSchema = z.object({ displayName: z.string().trim().min(2).max(60).optional(), shareEnabled: z.boolean().optional() }).strict()
const evidenceSchema = z.object({
  type: z.enum(['case_study', 'project']),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(20).max(1000),
  url: z.string().url().max(500).refine(value => value.startsWith('https://'), 'نشانی باید HTTPS باشد').optional()
}).strict()

export async function profileRoutes(fastify: FastifyInstance) {
  fastify.get('/', async request => {
    const user = await prisma.user.findUnique({ where: { id: request.user!.userId }, select: {
      displayName: true, publicProfileToken: true, mentorVerifiedAt: true,
      evidence: { orderBy: { createdAt: 'desc' }, select: { id: true, type: true, title: true, description: true, url: true, verifiedAt: true, createdAt: true } }
    } })
    return user
  })

  fastify.patch('/', async (request, reply) => {
    const parsed = profileSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'اطلاعات پروفایل نامعتبر است', details: parsed.error.flatten() })
    const current = await prisma.user.findUnique({ where: { id: request.user!.userId }, select: { publicProfileToken: true } })
    const updated = await prisma.user.update({ where: { id: request.user!.userId }, data: {
      ...(parsed.data.displayName !== undefined ? { displayName: parsed.data.displayName } : {}),
      ...(parsed.data.shareEnabled !== undefined ? { publicProfileToken: parsed.data.shareEnabled ? current?.publicProfileToken ?? randomUUID() : null } : {})
    }, select: { displayName: true, publicProfileToken: true } })
    return reply.send(updated)
  })

  fastify.post('/evidence', async (request, reply) => {
    const parsed = evidenceSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'اطلاعات شاهد نامعتبر است', details: parsed.error.flatten() })
    const evidence = await prisma.profileEvidence.create({ data: { ...parsed.data, userId: request.user!.userId } })
    return reply.status(201).send(evidence)
  })

  fastify.delete('/evidence/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const result = await prisma.profileEvidence.deleteMany({ where: { id, userId: request.user!.userId, verifiedAt: null } })
    if (!result.count) return reply.status(404).send({ error: 'شاهد پیدا نشد یا پس از تأیید قابل حذف نیست.' })
    return reply.send({ success: true })
  })
}

export async function publicProfileRoutes(fastify: FastifyInstance) {
  fastify.get('/profiles/:token', async (request, reply) => {
    const { token } = request.params as { token: string }
    if (!z.string().uuid().safeParse(token).success) return reply.status(404).send({ error: 'پروفایل پیدا نشد' })
    const user = await prisma.user.findUnique({ where: { publicProfileToken: token }, select: {
      id: true, displayName: true, mentorVerifiedAt: true, roleTrackId: true,
      roleTrack: { select: { name: true } },
      evidence: { where: { verifiedAt: { not: null } }, orderBy: { verifiedAt: 'desc' }, select: { id: true, type: true, title: true, description: true, url: true, verifiedAt: true } }
    } })
    if (!user || !user.roleTrackId) return reply.status(404).send({ error: 'پروفایل پیدا نشد' })
    const role = ROLES.find(value => value === user.roleTrack?.name)
    if (!role) return reply.status(404).send({ error: 'پروفایل پیدا نشد' })
    const sessions = await prisma.session.findMany({ where: { userId: user.id, status: 'completed', challenge: { roleId: user.roleTrackId } }, select: { path: true, challenge: { select: { questions: true } } } })
    const skills = buildSkillProfile(sessions.map(session => ({
      path: (Array.isArray(session.path) ? session.path : []) as unknown as SkillPathEntry[],
      questions: (session.challenge.questions ?? {}) as Record<string, Question>
    })), role)
    return reply.send({
      displayName: user.displayName || 'کاربر پرودچی', roleName: role,
      mentorVerified: Boolean(user.mentorVerifiedAt), skills,
      evidence: user.evidence,
      caseStudies: user.evidence.filter(item => item.type === 'case_study').length,
      projects: user.evidence.filter(item => item.type === 'project').length
    })
  })
}
