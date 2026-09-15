import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.ts'
import { z } from 'zod'

const createAttemptSchema = z.object({
  challengeId: z.string().uuid()
})

const answerSchema = z.object({
  stepIndex: z.number().int().nonnegative(),
  optionId: z.string().length(1).regex(/^[A-D]$/).optional(),
  freeText: z.string().optional()
}).refine(data => data.optionId || data.freeText, {
  message: 'Either optionId or freeText must be provided'
})

export async function attemptRoutes(fastify: FastifyInstance) {
  // POST /api/v1/attempts
  fastify.post('/', async (request, reply) => {
    const parseResult = createAttemptSchema.safeParse(request.body)
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parseResult.error.flatten() })
    }

    const { challengeId } = parseResult.data
    const user = request.user!

    if (!user.roleTrackId) {
      return reply.status(400).send({ error: 'Role not selected. Complete onboarding first.' })
    }

    const challenge = await prisma.challenge.findFirst({
      where: {
        id: challengeId,
        roleId: user.roleTrackId,
        status: 'published',
        tier: 'free'
      },
      include: {
        skills: true
      }
    })

    if (!challenge) {
      return reply.status(404).send({ error: 'Challenge not found or not available' })
    }

    const applicantSteps = challenge.applicantSteps as any[]
    if (!applicantSteps || applicantSteps.length === 0) {
      return reply.status(500).send({ error: 'Challenge has no steps' })
    }

    const attempt = await prisma.attempt.create({
      data: {
        userId: user.userId,
        challengeId,
        path: []
      }
    })

    const firstStep = applicantSteps[0]

    return reply.status(201).send({
      attemptId: attempt.id,
      step: firstStep
    })
  })

  // POST /api/v1/attempts/:id/answer
  fastify.post('/:id/answer', async (request, reply) => {
    const { id } = request.params as { id: string }
    const parseResult = answerSchema.safeParse(request.body)
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parseResult.error.flatten() })
    }

    const { stepIndex, optionId, freeText } = parseResult.data
    const user = request.user!

    const attempt = await prisma.attempt.findFirst({
      where: { id, userId: user.userId },
      include: { challenge: true }
    })

    if (!attempt) {
      return reply.status(404).send({ error: 'Attempt not found' })
    }

    if (attempt.completedAt) {
      return reply.status(409).send({ error: 'Attempt already completed' })
    }

    const challenge = attempt.challenge
    const applicantSteps = challenge.applicantSteps as any[]
    const answerSheet = challenge.answerSheet as any[]
    const path = attempt.path as any[]

    // Challenges branch through answerSheet[*].options[*].nextStepIndex, so the
    // answered steps form a path of jumps rather than a dense 0..n range: comparing
    // stepIndex against path.length rejects every branch (spec Section 5.2). The
    // expected step is derived from the tail of the path instead.
    const expectedStepIndex: number | null = path.length === 0
      ? applicantSteps[0]?.stepIndex ?? 0
      : path[path.length - 1]?.nextStepIndex ?? null

    if (expectedStepIndex === null) {
      return reply.status(409).send({ error: 'Attempt has already reached the final step' })
    }

    if (stepIndex !== expectedStepIndex) {
      return reply.status(400).send({
        error: `Step index does not match current attempt position (expected ${expectedStepIndex})`
      })
    }

    const currentStep = applicantSteps.find(s => s.stepIndex === stepIndex)
    if (!currentStep) {
      return reply.status(400).send({ error: 'Invalid step index' })
    }

    const answerStep = answerSheet.find(s => s.stepIndex === stepIndex)
    if (!answerStep) {
      return reply.status(500).send({ error: 'Answer sheet missing for step' })
    }

    let chosenOption: any = null
    let revealedInfo: string[] = []
    let nextStepIndex: number | null = null

    if (currentStep.inputType === 'freeText') {
      // Free-text answers are scored against the skill rubric directly (spec
      // Section 5.2). They carry no optionId, so branching uses the answer sheet's
      // single entry for that step.
      chosenOption = { freeTextResponse: freeText }
      const freeTextEntry = Object.values(answerStep.options)[0] as any
      if (freeTextEntry) {
        revealedInfo = freeTextEntry.reveal || []
        nextStepIndex = freeTextEntry.nextStepIndex
      }
    } else {
      if (!optionId) {
        return reply.status(400).send({ error: 'optionId required for options-type step' })
      }

      const option = answerStep.options[optionId]
      if (!option) {
        return reply.status(400).send({ error: 'Invalid optionId' })
      }

      chosenOption = { optionChosen: optionId }
      revealedInfo = option.reveal || []
      nextStepIndex = option.nextStepIndex
    }

    const pathEntry = {
      stepIndex,
      ...chosenOption,
      revealedInfoSnapshot: revealedInfo,
      // Persisted so the next request (and GET /attempts/:id) can resolve the
      // current position without re-reading the answer sheet.
      nextStepIndex,
      timestamp: new Date().toISOString()
    }

    const updatedPath = [...path, pathEntry]

    await prisma.attempt.update({
      where: { id },
      data: { path: updatedPath }
    })

    if (nextStepIndex === null) {
      return reply.send({ nextStep: null })
    }

    const nextStep = applicantSteps.find(s => s.stepIndex === nextStepIndex)
    if (!nextStep) {
      return reply.status(500).send({ error: 'Next step not found' })
    }

    return reply.send({ nextStep })
  })

  // POST /api/v1/attempts/:id/complete
  fastify.post('/:id/complete', async (request, reply) => {
    const { id } = request.params as { id: string }
    const user = request.user!

    const attempt = await prisma.attempt.findFirst({
      where: { id, userId: user.userId },
      include: { challenge: true }
    })

    if (!attempt) {
      return reply.status(404).send({ error: 'Attempt not found' })
    }

    if (attempt.completedAt) {
      return reply.status(409).send({ error: 'Attempt already completed' })
    }

    const path = attempt.path as any[]

    // The path ends on a terminal step when the last answered step's nextStepIndex
    // is null, meaning "this ends the challenge" (spec Section 5.2).
    const lastPathEntry = path[path.length - 1]
    if (!lastPathEntry) {
      return reply.status(409).send({ error: 'No steps answered' })
    }

    if (lastPathEntry.nextStepIndex !== null) {
      return reply.status(409).send({ error: 'Not all steps answered' })
    }

    // Mark attempt as completed (assessment will be triggered by the service)
    const completedAttempt = await prisma.attempt.update({
      where: { id },
      data: {
        completedAt: new Date()
      },
      include: { challenge: true }
    })

    // Import assessment service dynamically to avoid circular dependency
    const { assessAttempt } = await import('../services/assessment.js')
    const { updateGamification } = await import('../services/gamification.js')

    try {
      const assessmentResult = await assessAttempt(completedAttempt)
      const gamificationResult = await updateGamification(user.userId, completedAttempt, assessmentResult)

      return reply.send({
        assessment: assessmentResult,
        xpEarned: gamificationResult.xpEarned,
        leveledUp: gamificationResult.leveledUp,
        newBadges: gamificationResult.newBadges
      })
    } catch (error) {
      console.error('Assessment error:', error)
      return reply.status(503).send({ error: 'Assessment service unavailable' })
    }
  })

  // GET /api/v1/attempts/:id
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const user = request.user!

    const attempt = await prisma.attempt.findFirst({
      where: { id, userId: user.userId },
      include: { challenge: true }
    })

    if (!attempt) {
      return reply.status(404).send({ error: 'Attempt not found' })
    }

    const applicantSteps = attempt.challenge.applicantSteps as any[]
    const path = attempt.path as any[]

    // Resume support: the client needs the client-safe steps plus the step that
    // comes next, derived from the persisted path. `hiddenCase` and `answerSheet`
    // are never exposed here (spec Section 6.3).
    const expectedStepIndex: number | null = path.length === 0
      ? applicantSteps[0]?.stepIndex ?? 0
      : path[path.length - 1]?.nextStepIndex ?? null

    const step = attempt.completedAt || expectedStepIndex === null
      ? null
      : applicantSteps.find(s => s.stepIndex === expectedStepIndex) ?? null

    return reply.send({
      id: attempt.id,
      challengeId: attempt.challengeId,
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt,
      path: attempt.path,
      assessment: attempt.assessment,
      xpEarned: attempt.xpEarned,
      challenge: {
        id: attempt.challenge.id,
        title: attempt.challenge.title,
        applicantSteps
      },
      step
    })
  })
}