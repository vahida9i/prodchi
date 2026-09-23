import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.ts'
import { levelFromXp } from '@baaten/shared-types/scoring'
import { buildSkillProfile } from '@baaten/shared-types/skills'
import type { SkillPathEntry } from '@baaten/shared-types/skills'
import type { Question } from '@baaten/shared-types/challenge-schema'

/**
 * Candidate progress + gamification reads.
 *
 * There is no capability profile table: everything here is aggregated on read
 * from `LevelProgress`, which is the single source of truth for XP, stars and
 * pass state (one indexed query at this scale).
 */
export async function progressRoutes(fastify: FastifyInstance) {
  // GET /api/v1/progress
  fastify.get('/', async (request, reply) => {
    const user = request.user!

    const [progressRows, streak, industries] = await Promise.all([
      prisma.levelProgress.findMany({ where: { userId: user.userId } }),
      prisma.streak.findUnique({ where: { userId: user.userId } }),
      prisma.industry.findMany({
        orderBy: { order: 'asc' },
        include: { levels: { where: { status: 'active' }, select: { id: true } } }
      })
    ])

    const totalXp = progressRows.reduce((sum, row) => sum + row.xpEarned, 0)
    const passedRows = progressRows.filter(row => row.status === 'passed')
    const passedIds = new Set(passedRows.map(row => row.levelId))
    const totalStars = progressRows.reduce((sum, row) => sum + row.bestStars, 0)
    const totalHits = passedRows.reduce((sum, row) => sum + row.hits, 0)
    const totalAnswered = passedRows.reduce((sum, row) => sum + row.answered, 0)
    const starsByLevel = new Map(progressRows.map(row => [row.levelId, row.bestStars]))

    const activeLevelCount = industries.reduce((sum, industry) => sum + industry.levels.length, 0)

    return reply.send({
      totalXp,
      playerLevel: levelFromXp(totalXp),
      levelsPassed: passedRows.length,
      levelsTotal: activeLevelCount,
      totalStars,
      /** Best-choice accuracy across every passed level, 0 when none yet. */
      accuracy: totalAnswered === 0 ? 0 : totalHits / totalAnswered,
      streak: {
        currentStreak: streak?.currentStreak ?? 0,
        longestStreak: streak?.longestStreak ?? 0,
        lastActiveDay: streak?.lastActiveDay ?? null
      },
      industries: industries.map(industry => {
        const levelIds = industry.levels.map(level => level.id)
        const passed = levelIds.filter(id => passedIds.has(id)).length
        return {
          id: industry.id,
          name: industry.name,
          levelsTotal: levelIds.length,
          levelsPassed: passed,
          stars: levelIds.reduce((sum, id) => sum + (starsByLevel.get(id) ?? 0), 0),
          completed: levelIds.length > 0 && passed === levelIds.length
        }
      })
    })
  })

  // GET /api/v1/progress/skills — the real-world skill profile (Framing,
  // Research, Synthesis, Ideation, Solution, Validation), aggregated on read
  // from the caller's completed runs: each recorded decision is classified by
  // the authored stage of the move the candidate actually chose and weighted
  // best = 1, reasonable = 0.5, poor = 0. Same aggregate-on-read philosophy as
  // above — no profile table, so it can never contradict a finished run's own
  // report. `path` and the question graphs are JSON columns; at MVP scale one
  // indexed query over the user's completed sessions is fine.
  fastify.get('/skills', async (request, reply) => {
    const user = request.user!

    const [sessions, account] = await Promise.all([
      prisma.session.findMany({
        where: { userId: user.userId, status: 'completed' },
        select: { path: true, challenge: { select: { questions: true } } }
      }),
      prisma.user.findUnique({
        where: { id: user.userId },
        select: { roleTrack: { select: { name: true } } }
      })
    ])

    // The role track decides which skill set the decisions are read against —
    // onboarding sets it once, before any run can exist, so it is always here.
    const roleName = account?.roleTrack?.name
    if (roleName !== 'Product Design' && roleName !== 'Product Management') {
      return reply.status(400).send({ error: 'Role not selected. Complete onboarding first.' })
    }

    return reply.send(buildSkillProfile(sessions.map(session => ({
      path: (Array.isArray(session.path) ? session.path : []) as unknown as SkillPathEntry[],
      questions: (session.challenge.questions ?? {}) as Record<string, Question>
    })), roleName))
  })

  // GET /api/v1/progress/badges — every badge, with earned state and condition
  fastify.get('/badges', async (request, reply) => {
    const user = request.user!

    const [allBadges, earned] = await Promise.all([
      prisma.badge.findMany({ orderBy: { name: 'asc' } }),
      prisma.userBadge.findMany({ where: { userId: user.userId } })
    ])

    const earnedAtByBadge = new Map(earned.map(row => [row.badgeId, row.earnedAt]))

    return reply.send({
      badges: allBadges.map(badge => ({
        id: badge.id,
        name: badge.name,
        description: badge.description,
        iconRef: badge.iconRef,
        unlockCondition: badge.unlockCondition,
        earned: earnedAtByBadge.has(badge.id),
        earnedAt: earnedAtByBadge.get(badge.id) ?? null
      }))
    })
  })

  // GET /api/v1/progress/leaderboard — weekly XP within the caller's cohort
  fastify.get('/leaderboard', async (request, reply) => {
    const user = request.user!

    if (!user.cohortId) {
      return reply.send({ leaderboard: [], userRank: null })
    }

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const grouped = await prisma.levelProgress.groupBy({
      by: ['userId'],
      where: { passedAt: { gte: oneWeekAgo }, user: { cohortId: user.cohortId } },
      _sum: { xpEarned: true }
    })

    // The cohort is small at MVP scale, so rank the whole cohort rather than
    // fetching a top N and then re-deriving the caller's position.
    const ranked = grouped
      .map(row => ({ userId: row.userId, weeklyXp: row._sum.xpEarned ?? 0 }))
      .filter(row => row.weeklyXp > 0)
      .sort((a, b) => b.weeklyXp - a.weeklyXp)

    const top = ranked.slice(0, 10)
    const users = await prisma.user.findMany({
      where: { id: { in: top.map(row => row.userId) } },
      select: { id: true, email: true }
    })
    const emailById = new Map(users.map(row => [row.id, row.email]))

    const index = ranked.findIndex(row => row.userId === user.userId)

    // Masked SERVER-SIDE: the raw email never crosses the API boundary. The
    // UI's client-side masking was cosmetic only — the data was on the wire.
    const maskEmail = (email: string) => email.replace(/^(.).*(@.*)$/, '$1***$2')

    return reply.send({
      leaderboard: top.map((row, position) => ({
        rank: position + 1,
        userId: row.userId,
        player: maskEmail(emailById.get(row.userId) ?? 'unknown'),
        weeklyXp: row.weeklyXp
      })),
      userRank: index === -1 ? null : { rank: index + 1, weeklyXp: ranked[index].weeklyXp }
    })
  })
}
