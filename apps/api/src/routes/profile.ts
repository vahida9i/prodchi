import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.ts'

export async function profileRoutes(fastify: FastifyInstance) {
  // GET /api/v1/profile
  fastify.get('/', async (request, reply) => {
    const user = request.user!

    const capabilityProfile = await prisma.capabilityProfile.findUnique({
      where: { userId: user.userId }
    })

    if (!capabilityProfile) {
      return reply.status(404).send({ error: 'No profile data available. Complete a challenge first.' })
    }

    const streak = await prisma.streak.findUnique({
      where: { userId: user.userId }
    })

    const userBadges = await prisma.userBadge.findMany({
      where: { userId: user.userId },
      include: { badge: true },
      orderBy: { earnedAt: 'desc' }
    })

    const totalXp = await prisma.attempt.aggregate({
      where: { userId: user.userId, completedAt: { not: null } },
      _sum: { xpEarned: true }
    })

    const level = Math.floor(Math.sqrt((totalXp._sum.xpEarned || 0) / 100))

    return reply.send({
      profile: {
        overallScore: capabilityProfile.overallScore,
        skillBreakdown: capabilityProfile.skillBreakdown,
        challengesCompleted: capabilityProfile.challengesCompleted,
        caseStudiesCompleted: capabilityProfile.caseStudiesCompleted,
        updatedAt: capabilityProfile.updatedAt
      },
      streak: streak ? {
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        lastActiveDay: streak.lastActiveDay
      } : {
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDay: null
      },
      level,
      totalXp: totalXp._sum.xpEarned || 0,
      badges: userBadges.map(ub => ({
        id: ub.badge.id,
        name: ub.badge.name,
        description: ub.badge.description,
        iconRef: ub.badge.iconRef,
        earnedAt: ub.earnedAt
      }))
    })
  })

  // GET /api/v1/leaderboard
  fastify.get('/leaderboard', async (request, reply) => {
    const user = request.user!

    if (!user.cohortId) {
      return reply.send({ leaderboard: [], userRank: null })
    }

    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    const leaderboard = await prisma.attempt.groupBy({
      by: ['userId'],
      where: {
        user: { cohortId: user.cohortId },
        completedAt: { gte: oneWeekAgo },
        xpEarned: { not: null }
      },
      _sum: { xpEarned: true },
      orderBy: { _sum: { xpEarned: 'desc' } },
      take: 10
    })

    const userIds = leaderboard.map(l => l.userId)
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true }
    })

    const userMap = new Map(users.map(u => [u.id, u.email]))

    const formattedLeaderboard = leaderboard.map((entry, index) => ({
      rank: index + 1,
      userId: entry.userId,
      email: userMap.get(entry.userId) || 'Unknown',
      weeklyXp: entry._sum.xpEarned || 0
    }))

    // Find user's rank
    const userEntry = leaderboard.find(l => l.userId === user.userId)
    let userRank = null
    if (userEntry) {
      userRank = {
        rank: formattedLeaderboard.find(f => f.userId === user.userId)?.rank,
        weeklyXp: userEntry._sum.xpEarned || 0
      }
    } else {
      // User not in top 10, calculate their rank
      const userWeeklyXp = await prisma.attempt.aggregate({
        where: {
          userId: user.userId,
          completedAt: { gte: oneWeekAgo },
          xpEarned: { not: null }
        },
        _sum: { xpEarned: true }
      })

      // Count how many users have more XP
      const higherCount = await prisma.attempt.groupBy({
        by: ['userId'],
        where: {
          user: { cohortId: user.cohortId },
          completedAt: { gte: oneWeekAgo },
          xpEarned: { not: null }
        },
        _sum: { xpEarned: true },
        having: {
          xpEarned: { _sum: { gt: userWeeklyXp._sum.xpEarned || 0 } }
        }
      })

      userRank = {
        rank: higherCount.length + 1,
        weeklyXp: userWeeklyXp._sum.xpEarned || 0
      }
    }

    return reply.send({
      leaderboard: formattedLeaderboard,
      userRank
    })
  })

  // GET /api/v1/badges - all badges for the badge collection screen
  fastify.get('/badges', async (request, reply) => {
    const user = request.user!

    const allBadges = await prisma.badge.findMany({
      orderBy: { name: 'asc' }
    })

    const userBadges = await prisma.userBadge.findMany({
      where: { userId: user.userId },
      select: { badgeId: true, earnedAt: true }
    })

    const earnedBadgeIds = new Set(userBadges.map(ub => ub.badgeId))
    const earnedAtMap = new Map(userBadges.map(ub => [ub.badgeId, ub.earnedAt]))

    return reply.send({
      badges: allBadges.map(badge => ({
        id: badge.id,
        name: badge.name,
        description: badge.description,
        iconRef: badge.iconRef,
        unlockCondition: badge.unlockCondition,
        earned: earnedBadgeIds.has(badge.id),
        earnedAt: earnedAtMap.get(badge.id) || null
      }))
    })
  })
}