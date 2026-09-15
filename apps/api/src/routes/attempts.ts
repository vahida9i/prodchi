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

    // Verify stepIndex matches current position
    const path = attempt.path as any[]
    if (path.length !== stepIndex) {
      return reply.status(400).send({ error: 'Step index does not match current attempt position' })
    }

    const challenge = attempt.challenge
    const applicantSteps = challenge.applicantSteps as any[]
    const answerSheet = challenge.answerSheet as any[]

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
      // For freeText, we'll use a special handling - just record the response
      // The assessment service will handle scoring
      chosenOption = { freeTextResponse: freeText }
      // For freeText, we need to determine next step from answerSheet
      // Since there's no optionId, we'll use the first option's nextStepIndex as default
      const firstOption = Object.values(answerStep.options)[0] as any
      if (firstOption) {
        revealedInfo = firstOption.reveal || []
        nextStepIndex = firstOption.nextStepIndex
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

    const newPathEntry = {
      stepIndex,
      ...chosenOption,
      revealedInfoSnapshot: revealedInfo,
      timestamp: new Date().toISOString()
    }

    const updatedPath = [...path, newPathEntry]

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
    const applicantSteps = attempt.challenge.applicantSteps as any[]
    const answerSheet = attempt.challenge.answerSheet as any[]

    // Verify all steps have been answered
    const answeredStepIndices = new Set(path.map(p => p.stepIndex))
    const requiredStepIndices = new Set(applicantSteps.map(s => s.stepIndex))

    // Check if we've reached a terminal step (nextStepIndex === null)
    const lastPathEntry = path[path.length - 1]
    if (!lastPathEntry) {
      return reply.status(409).send({ error: 'No steps answered' })
    }

    const lastAnswerStep = answerSheet.find(s => s.stepIndex === lastPathEntry.stepIndex)
    if (!lastAnswerStep) {
      return reply.status(500).send({ error: 'Answer sheet missing for last step' })
    }

    let isTerminal = false
    if (lastPathEntry.optionChosen) {
      const option = lastAnswerStep.options[lastPathEntry.optionChosen]
      isTerminal = option?.nextStepIndex === null
    } else if (lastPathEntry.freeTextResponse) {
      // For freeText, check the first option's nextStepIndex
      const firstOption = Object.values(lastAnswerStep.options)[0] as any
      isTerminal = firstOption?.nextStepIndex === null
    }

    if (!isTerminal) {
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

    return reply.send({
      id: attempt.id,
      challengeId: attempt.challengeId,
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt,
      path: attempt.path,
      assessment: attempt.assessment,
      xpEarned: attempt.xpEarned
    })
  })
}