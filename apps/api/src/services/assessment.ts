import type { Prisma } from '@prisma/client'
import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { prisma } from '../lib/prisma.ts'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Rubrics are authored alongside challenge content (spec Section 7). The depth is
// identical from src/services/ and dist/services/, so this resolves in dev and in
// the built output.
const RUBRICS_DIR = fileURLToPath(new URL('../../../../packages/shared-types/rubrics/', import.meta.url))

interface Rubric {
  skillId: string
  criteria: Array<{ description: string; weight: number }>
}

interface AssessmentResult {
  perSkillDeltas: Array<{ skillId: string; delta: number }>
  feedbackText: { positives: string[]; negatives: string[] }
  confidence: number
}

async function loadRubrics(skillIds: string[]): Promise<Rubric[]> {
  const rubrics: Rubric[] = []
  for (const skillId of skillIds) {
    const filePath = join(RUBRICS_DIR, `${skillId}.json`)
    try {
      const fileContent = readFileSync(filePath, 'utf-8')
      const rubric = JSON.parse(fileContent)
      rubrics.push(rubric)
    } catch {
      // Never fail an assessment over a missing rubric, but make it visible: a
      // silent fallback would hide an authoring mistake behind scoreable output.
      console.warn(`[assessment] No rubric found at ${filePath}; scoring skill ${skillId} with the generic rubric.`)
      rubrics.push({
        skillId,
        criteria: [
          { description: 'Demonstrates understanding of core concepts', weight: 0.4 },
          { description: 'Applies appropriate frameworks and methods', weight: 0.3 },
          { description: 'Communicates reasoning clearly', weight: 0.3 }
        ]
      })
    }
  }
  return rubrics
}

function buildAssessmentPrompt(
  attempt: any,
  challenge: any,
  rubrics: Rubric[]
): string {
  const path = attempt.path as any[]
  const applicantSteps = challenge.applicantSteps as any[]
  const answerSheet = challenge.answerSheet as any[]

  let prompt = `You are an expert Product Design assessor. Evaluate the candidate's responses to a multi-step design challenge.\n\n`
  prompt += `Challenge: ${challenge.title}\n`
  prompt += `Description: ${challenge.description}\n\n`
  prompt += `Skills being assessed:\n`
  for (const rubric of rubrics) {
    prompt += `- ${rubric.skillId}: ${rubric.criteria.map(c => c.description).join(', ')}\n`
  }
  prompt += `\nCandidate's responses:\n`

  for (const stepResponse of path) {
    const step = applicantSteps.find(s => s.stepIndex === stepResponse.stepIndex)
    const answerStep = answerSheet.find(s => s.stepIndex === stepResponse.stepIndex)

    if (!step || !answerStep) continue

    prompt += `\n--- Step ${step.stepIndex} (${step.stage}) ---\n`
    prompt += `Question: ${step.question}\n`

    if (stepResponse.optionChosen) {
      const option = answerStep.options[stepResponse.optionChosen]
      prompt += `Selected: ${stepResponse.optionChosen}\n`
      prompt += `Reasoning signal: ${option?.reasoningSignal || 'N/A'}\n`
      prompt += `Consequence: ${option?.consequence || 'N/A'}\n`
    } else if (stepResponse.freeTextResponse) {
      prompt += `Free-text response: ${stepResponse.freeTextResponse}\n`
    }

    if (stepResponse.revealedInfoSnapshot?.length) {
      prompt += `Information revealed: ${stepResponse.revealedInfoSnapshot.join('; ')}\n`
    }
  }

  prompt += `\n\nProvide your assessment as JSON with this exact structure:\n`
  prompt += `{\n`
  prompt += `  "perSkillDeltas": [{"skillId": "uuid", "delta": number}],\n`
  prompt += `  "feedbackText": {"positives": ["string"], "negatives": ["string"]},\n`
  prompt += `  "confidence": number\n`
  prompt += `}\n\n`
  prompt += `Guidelines:\n`
  prompt += `- delta range: -20 to +20 per skill\n`
  prompt += `- positive delta for good reasoning, negative for poor reasoning\n`
  prompt += `- confidence: 0.0 to 1.0\n`
  prompt += `- feedback: 2-4 items each for positives and negatives\n`
  prompt += `- Base scores on the rubric criteria provided\n`

  return prompt
}

export async function assessAttempt(attempt: any): Promise<AssessmentResult> {
  const challenge = await prisma.challenge.findUnique({
    where: { id: attempt.challengeId },
    include: { skills: true }
  })

  if (!challenge) {
    throw new Error('Challenge not found')
  }

  const skillIds = challenge.skills.map(s => s.skillId)
  const rubrics = await loadRubrics(skillIds)

  const prompt = buildAssessmentPrompt(attempt, challenge, rubrics)

  let lastError: Error | null = null

  for (let retry = 0; retry < 2; retry++) {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }]
      })

      const content = response.content[0]
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Anthropic')
      }

      const assessment = JSON.parse(content.text) as AssessmentResult

      // Validate response structure
      if (!assessment.perSkillDeltas || !assessment.feedbackText || typeof assessment.confidence !== 'number') {
        throw new Error('Invalid assessment response structure')
      }

      // Update SkillScore for each skill
      for (const { skillId, delta } of assessment.perSkillDeltas) {
        const existingScore = await prisma.skillScore.findUnique({
          where: { userId_skillId: { userId: attempt.userId, skillId } }
        })

        let newScore: number
        if (existingScore) {
          newScore = Math.max(0, Math.min(100, existingScore.score + delta))
          await prisma.skillScore.update({
            where: { id: existingScore.id },
            data: { score: newScore, evidenceCount: existingScore.evidenceCount + 1 }
          })
        } else {
          newScore = Math.max(0, Math.min(100, 50 + delta))
          await prisma.skillScore.create({
            data: { userId: attempt.userId, skillId, score: newScore, evidenceCount: 1 }
          })
        }
      }

      // Save assessment to attempt
      await prisma.attempt.update({
        where: { id: attempt.id },
        data: { assessment: assessment as unknown as Prisma.InputJsonValue }
      })

      return assessment
    } catch (error) {
      lastError = error as Error
      console.error(`Assessment attempt ${retry + 1} failed:`, error)
      if (retry === 0) {
        // Wait a bit before retry
        await new Promise(r => setTimeout(r, 1000))
      }
    }
  }

  // Both retries failed
  await prisma.attempt.update({
    where: { id: attempt.id },
    data: { assessment: { error: true, message: lastError?.message || 'Unknown error' } }
  })

  throw new Error('Assessment service unavailable after retries')
}