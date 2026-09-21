import { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma.ts'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { validateChallengeImport } from '@baaten/shared-types/validator'
import { isSingleQuestion } from '@baaten/shared-types/scoring'
import type { Question } from '@baaten/shared-types/challenge-schema'
import { normalizeReveal } from '@baaten/shared-types/challenge-schema'

const updateChallengeStatusSchema = z.object({
  status: z.enum(['active', 'retired'])
})

const adminChallengeListQuerySchema = z.object({
  status: z.enum(['active', 'retired']).optional()
})

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

/** Persist a rejected import so admins can review what failed and why (plan Feature 5). */
async function logFailedImport(payload: unknown, errors: Array<{ path: string; message: string }>) {
  try {
    await prisma.failedImport.create({
      data: { payload: toInputJson(payload), errors: toInputJson(errors) }
    })
  } catch (err) {
    // Recording the failure must never mask the validation response itself.
    console.error('[admin] failed to record a failed import:', err)
  }
}

export async function adminChallengeRoutes(fastify: FastifyInstance) {
  // POST /api/v1/admin/challenges/import — paste raw challenge JSON.
  // Validation is deterministic (schema + graph flow); a broken import is
  // rejected with itemized reasons, never auto-repaired.
  //
  // The endpoint is idempotent on `id`: the first import creates the challenge
  // (goes live immediately as "active"), and every later import of the same id
  // UPDATES it in place. Challenge content is authored outside this app, so
  // fixing a reveal or an answer key must never require deleting a challenge
  // that already has sessions — and re-pasting the generator's output is the
  // whole update workflow. `status` is never touched by an import.
  fastify.post('/challenges/import', async (request, reply) => {
    const validation = validateChallengeImport(request.body)

    if (!validation.valid) {
      await logFailedImport(request.body, validation.errors)
      return reply.status(400).send({ errors: validation.errors })
    }

    const parsed = validation.parsed!

    const role = await prisma.role.findUnique({ where: { name: parsed.role } })
    if (!role) {
      const errors = [{ path: 'role', message: `Role "${parsed.role}" is not seeded in the database` }]
      await logFailedImport(request.body, errors)
      return reply.status(400).send({ errors })
    }

    // The level type is derived from the graph, so the admin panel can show it
    // (and offer the challenge for a level slot) without re-deriving it.
    const type = isSingleQuestion(parsed.questions as Record<string, Question>)
      ? 'single_question'
      : 'challenge'

    const content = {
      title: parsed.title,
      roleId: role.id,
      difficulty: parsed.difficulty,
      startKey: parsed.start,
      questions: toInputJson(parsed.questions),
      summary: parsed.summary ?? null,
      assessment: parsed.assessment ? toInputJson(parsed.assessment) : Prisma.DbNull
    }

    const updateInPlace = async (id: string) => {
      const challenge = await prisma.challenge.update({ where: { id }, data: content })
      // Keep the level's derived type honest if the graph's shape changed.
      await prisma.level.updateMany({ where: { challengeId: id }, data: { type } })
      return reply.send({ challengeId: challenge.id, type, updated: true })
    }

    const existing = await prisma.challenge.findUnique({ where: { importKey: parsed.id } })
    if (existing) {
      return updateInPlace(existing.id)
    }

    try {
      const challenge = await prisma.challenge.create({
        data: { importKey: parsed.id, ...content, status: 'active' }
      })
      return reply.status(201).send({ challengeId: challenge.id, type, updated: false })
    } catch (err: any) {
      if (err?.code === 'P2002') {
        // Lost a race against a parallel import of the same id: converge on the
        // row that won instead of reporting a duplicate.
        const winner = await prisma.challenge.findUnique({ where: { importKey: parsed.id } })
        if (winner) return updateInPlace(winner.id)
      }
      throw err
    }
  })

  // GET /api/v1/admin/challenges?status=active|retired
  fastify.get('/challenges', async (request, reply) => {
    const parseResult = adminChallengeListQuerySchema.safeParse(request.query)
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Invalid query', details: parseResult.error.flatten() })
    }

    const { status } = parseResult.data

    const challenges = await prisma.challenge.findMany({
      where: status ? { status } : undefined,
      select: { id: true, importKey: true, title: true, difficulty: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    })

    return reply.send({ challenges })
  })

  // GET /api/v1/admin/challenges/:id — full internal view (the admin may see
  // stages, reveals, and next pointers; candidates never do). Reveals are
  // normalized so the admin view always sees `{ text, table? }`, whichever
  // format the content was authored in, and `role` comes back as a name so the
  // payload can be pasted straight back into the import/update field.
  fastify.get('/challenges/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const challenge = await prisma.challenge.findUnique({
      where: { id },
      include: { role: { select: { name: true } } }
    })
    if (!challenge) {
      return reply.status(404).send({ error: 'Challenge not found' })
    }

    const stored = (challenge.questions ?? {}) as Record<string, Question>
    const questions = Object.fromEntries(
      Object.entries(stored).map(([key, question]) => [
        key,
        {
          ...question,
          choices: question.choices.map(choice => ({ ...choice, reveal: normalizeReveal(choice.reveal) }))
        }
      ])
    )

    return reply.send({
      id: challenge.id,
      importKey: challenge.importKey,
      title: challenge.title,
      role: challenge.role.name,
      difficulty: challenge.difficulty,
      startKey: challenge.startKey,
      questions,
      summary: challenge.summary ?? undefined,
      assessment: challenge.assessment ? JSON.parse(JSON.stringify(challenge.assessment)) : undefined,
      status: challenge.status,
      createdAt: challenge.createdAt,
      updatedAt: challenge.updatedAt
    })
  })

  // PATCH /api/v1/admin/challenges/:id/status — retire or re-activate
  fastify.patch('/challenges/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string }
    const parseResult = updateChallengeStatusSchema.safeParse(request.body)
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parseResult.error.flatten() })
    }

    try {
      const challenge = await prisma.challenge.update({
        where: { id },
        data: { status: parseResult.data.status }
      })
      return reply.send({ id: challenge.id, status: challenge.status })
    } catch (err: any) {
      if (err?.code === 'P2025') {
        return reply.status(404).send({ error: 'Challenge not found' })
      }
      throw err
    }
  })

  // DELETE /api/v1/admin/challenges/:id — only when no session references it
  fastify.delete('/challenges/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const sessionsCount = await prisma.session.count({ where: { challengeId: id } })
    if (sessionsCount > 0) {
      return reply.status(409).send({ error: 'Cannot delete a challenge with sessions. Retire it instead.' })
    }

    try {
      await prisma.challenge.delete({ where: { id } })
      return reply.send({ success: true })
    } catch (err: any) {
      if (err?.code === 'P2025') {
        return reply.status(404).send({ error: 'Challenge not found' })
      }
      throw err
    }
  })
}