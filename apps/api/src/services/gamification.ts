import { prisma } from '../lib/prisma.ts'

interface GamificationResult {
  xpEarned: number
  leveledUp: boolean
  newBadges: Array<{ id: string; name: string; description: string; iconRef: string }>
}

export async function updateGamification(
  userId: string,
  attempt: any,
  assessment: any
): Promise<GamificationResult> {
  const challenge = attempt.challenge

  // 1. Streak update
  await updateStreak(userId)

  // 2. XP and Level
  const xpEarned = challenge.xpValue
  await prisma.attempt.update({
    where: { id: attempt.id },
    data: { xpEarned }
  })

  // Calculate level before and after
  const totalXpBefore = await prisma.attempt.aggregate({
    where: { userId, completedAt: { not: null }, id: { not: attempt.id } },
    _sum: { xpEarned: true }
  })

  const totalXpAfter = (totalXpBefore._sum.xpEarned || 0) + xpEarned
  const levelBefore = Math.floor(Math.sqrt((totalXpBefore._sum.xpEarned || 0) / 100))
  const levelAfter = Math.floor(Math.sqrt(totalXpAfter / 100))
  const leveledUp = levelAfter > levelBefore

  // 3. Badges
  const newBadges = await evaluateBadges(userId)

  // 4. CapabilityProfile recompute
  await recomputeCapabilityProfile(userId)

  return { xpEarned, leveledUp, newBadges }
}

/** Start of the given day in UTC, per spec Section 8.1 ("yesterday (UTC date)"). */
function utcDayStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

async function updateStreak(userId: string) {
  const today = utcDayStart(new Date())

  const streak = await prisma.streak.findUnique({ where: { userId } })

  if (!streak) {
    await prisma.streak.create({
      data: { userId, currentStreak: 1, longestStreak: 1, lastActiveDay: today }
    })
    return
  }

  const lastActive = streak.lastActiveDay ? utcDayStart(new Date(streak.lastActiveDay)) : null
  let newCurrentStreak = streak.currentStreak

  if (lastActive) {
    const diffDays = Math.round((today.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 1) {
      newCurrentStreak = streak.currentStreak + 1
    } else if (diffDays > 1) {
      newCurrentStreak = 1
    }
    // diffDays === 0 means already active today, no change
  } else {
    newCurrentStreak = 1
  }

  const newLongestStreak = Math.max(streak.longestStreak, newCurrentStreak)

  await prisma.streak.update({
    where: { userId },
    data: {
      currentStreak: newCurrentStreak,
      longestStreak: newLongestStreak,
      lastActiveDay: today
    }
  })
}

async function evaluateBadges(userId: string) {
  const allBadges = await prisma.badge.findMany()
  const userBadges = await prisma.userBadge.findMany({ where: { userId } })
  const earnedBadgeIds = new Set(userBadges.map(ub => ub.badgeId))

  const skillScores = await prisma.skillScore.findMany({ where: { userId } })
  const streak = await prisma.streak.findUnique({ where: { userId } })
  const attemptsCompleted = await prisma.attempt.count({ where: { userId, completedAt: { not: null } } })

  const newBadges: Array<{ id: string; name: string; description: string; iconRef: string }> = []

  for (const badge of allBadges) {
    if (earnedBadgeIds.has(badge.id)) continue

    const condition = badge.unlockCondition as any
    let unlocked = false

    switch (condition.type) {
      case 'skillScoreAbove': {
        const skillScore = skillScores.find(s => s.skillId === condition.skillId)
        if (skillScore && skillScore.score >= condition.threshold) {
          unlocked = true
        }
        break
      }
      case 'streakAbove': {
        if (streak && streak.currentStreak >= condition.threshold) {
          unlocked = true
        }
        break
      }
      case 'attemptsCompletedAbove': {
        if (attemptsCompleted >= condition.threshold) {
          unlocked = true
        }
        break
      }
    }

    if (unlocked) {
      await prisma.userBadge.create({
        data: { userId, badgeId: badge.id }
      })
      newBadges.push({
        id: badge.id,
        name: badge.name,
        description: badge.description,
        iconRef: badge.iconRef
      })
    }
  }

  return newBadges
}

export async function recomputeCapabilityProfile(userId: string) {
  const skillScores = await prisma.skillScore.findMany({
    where: { userId },
    include: { skill: true }
  })

  const overallScore = skillScores.length > 0
    ? skillScores.reduce((sum, s) => sum + s.score, 0) / skillScores.length
    : 0

  const skillBreakdown = skillScores.map(s => ({
    skillId: s.skillId,
    skillName: s.skill.name,
    score: s.score
  }))

  const challengesCompleted = await prisma.attempt.count({
    where: { userId, completedAt: { not: null } }
  })

  const caseStudiesCompleted = await prisma.attempt.count({
    where: {
      userId,
      completedAt: { not: null },
      challenge: { difficulty: { gte: 4 } }
    }
  })

  await prisma.capabilityProfile.upsert({
    where: { userId },
    create: {
      userId,
      overallScore,
      skillBreakdown,
      challengesCompleted,
      caseStudiesCompleted
    },
    update: {
      overallScore,
      skillBreakdown,
      challengesCompleted,
      caseStudiesCompleted
    }
  })
}

// Pure function for level calculation (no DB access)
export function calculateLevel(totalXp: number): number {
  return Math.floor(Math.sqrt(totalXp / 100))
}