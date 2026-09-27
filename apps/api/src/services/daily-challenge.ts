import { createHash } from 'node:crypto'
import { prisma } from '../lib/prisma.ts'
import { levelFromXp } from '@prodchi/shared-types/scoring'
import { totalXpForRole, updateStreak, evaluateBadges } from './gamification.ts'
import type { Question } from '@prodchi/shared-types/challenge-schema'
import { tehranDayKey } from './calendar-day.ts'
import { isAiConfigured } from './written-assessment.ts'

export const todayUtc = () => tehranDayKey(new Date())

/** Persist the assignment so imports or changing active content cannot reroll today. */
export async function getOrAssignDaily(userId: string, roleId: string) {
  const day = todayUtc()
  const existing = await prisma.dailyChallenge.findUnique({ where: { userId_roleId_day: { userId, roleId, day } }, include: { challenge: true } })
  if (existing) return existing
  const candidates = await prisma.challenge.findMany({ where: { roleId, status: 'active' }, orderBy: { id: 'asc' } })
  const available = isAiConfigured() ? candidates : candidates.filter(challenge => !Object.values(challenge.questions as Record<string, Question>).some(question => question.answerMode === 'text'))
  if (!available.length) return null
  const hash = createHash('sha256').update(`${userId}:${roleId}:${day}`).digest().readUInt32BE(0)
  const challenge = available[hash % available.length]
  return prisma.dailyChallenge.upsert({ where: { userId_roleId_day: { userId, roleId, day } }, update: {}, create: { userId, roleId, day, challengeId: challenge.id }, include: { challenge: true } })
}

/** One bonus per assigned run, safe against duplicate answer requests. */
export async function creditDailySession(sessionId: string, bonusXp = 20) {
  const assigned = await prisma.dailyChallenge.findUnique({ where: { sessionId } })
  if (!assigned) return null
  const before = await totalXpForRole(assigned.userId, assigned.roleId)
  const applied = await prisma.dailyChallenge.updateMany({ where: { sessionId, completedAt: null }, data: { completedAt: new Date(), xpEarned: bonusXp } })
  if (!applied.count) return null
  await updateStreak(assigned.userId, assigned.roleId)
  await evaluateBadges(assigned.userId, assigned.roleId)
  const totalXp = await totalXpForRole(assigned.userId, assigned.roleId)
  return { xpGained: bonusXp, totalXp, playerLevel: levelFromXp(totalXp), leveledUp: levelFromXp(totalXp) > levelFromXp(before) }
}
