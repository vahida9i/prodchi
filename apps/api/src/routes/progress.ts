import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.ts'
import { levelFromXp } from '@prodchi/shared-types/scoring'
import { buildSkillProfile, skillsForRole } from '@prodchi/shared-types/skills'
import type { SkillPathEntry } from '@prodchi/shared-types/skills'
import type { Question } from '@prodchi/shared-types/challenge-schema'
import { ROLES } from '@prodchi/shared-types/challenge-schema'
import { tehranDayKey } from '../services/calendar-day.ts'

/**
 * Candidate progress + gamification reads.
 *
 * There is no capability profile table: everything here is aggregated on read
 * from `LevelProgress`, which is the single source of truth for XP, stars and
 * pass state (one indexed query at this scale).
 */
export async function progressRoutes(fastify: FastifyInstance) {
  // The caller's track — the single scoping key for everything below. Profile
  // and progress are strictly per-track: nothing here ever aggregates across
  // roles (XP, stars, levels, industries, streak, badges, leaderboard).
  async function requireTrackRole(userId: string): Promise<string | null> {
    const account = await prisma.user.findUnique({
      where: { id: userId },
      select: { roleTrack: { select: { name: true } } }
    })
    const name = account?.roleTrack?.name
    return ROLES.find(role => role === name) ?? null
  }

  // GET /api/v1/progress
  fastify.get('/', async (request, reply) => {
    const user = request.user!

    if (!(await requireTrackRole(user.userId))) {
      return reply.status(400).send({ error: 'هنوز نقشی انتخاب نشده است. ابتدا مسیر خود را انتخاب کنید.' })
    }
    const roleId = user.roleTrackId! // non-null: the account has a known track

    const weekStart = new Date(Date.now() - 7 * 86400000)
    const [progressRows, streak, industries, recentSessions, dailyXp] = await Promise.all([
      // Scoped through the level's challenge to the caller's track.
      prisma.levelProgress.findMany({
        where: { userId: user.userId, level: { challenge: { roleId } } }
      }),
      prisma.streak.findUnique({ where: { userId_roleId: { userId: user.userId, roleId } } }),
      // Only industries that actually carry this track's levels, counted within
      // that scope — the other track's industries don't exist on this dashboard.
      prisma.industry.findMany({
        orderBy: { order: 'asc' },
        include: { levels: { where: { status: 'active', challenge: { roleId } }, select: { id: true } } }
      }).then(rows => rows.filter(industry => industry.levels.length > 0)),
      prisma.session.findMany({
        where: { userId: user.userId, status: 'completed', completedAt: { gte: weekStart }, challenge: { roleId } },
        select: { completedAt: true }
      }),
      prisma.dailyChallenge.aggregate({ where: { userId: user.userId, roleId }, _sum: { xpEarned: true } })
    ])

    const totalXp = progressRows.reduce((sum, row) => sum + row.xpEarned, 0) + (dailyXp._sum.xpEarned ?? 0)
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
      xpLevelStart: 100 * levelFromXp(totalXp) ** 2,
      xpNextLevel: 100 * (levelFromXp(totalXp) + 1) ** 2,
      activityDays: [...new Set(recentSessions.filter(row => row.completedAt).map(row => tehranDayKey(row.completedAt!)))],
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

  // GET /api/v1/progress/skills — the real-world skill profile (the role's own
  // skills: the seven role-specific skills for Product Design, Product
  // Management, or Tech Lead, aggregated on read
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
        where: { userId: user.userId, status: 'completed', challenge: { roleId: user.roleTrackId! } },
        select: { path: true, challenge: { select: { questions: true } } }
      }),
      prisma.user.findUnique({
        where: { id: user.userId },
        select: { roleTrack: { select: { name: true } } }
      })
    ])

    // The role track decides which skill set the decisions are read against —
    // onboarding sets it once, before any run can exist, so it is always here.
    const roleName = ROLES.find(role => role === account?.roleTrack?.name)
    if (!roleName) {
      return reply.status(400).send({ error: 'هنوز نقشی انتخاب نشده است. ابتدا مسیر خود را انتخاب کنید.' })
    }

    return reply.send(buildSkillProfile(sessions.map(session => ({
      path: (Array.isArray(session.path) ? session.path : []) as unknown as SkillPathEntry[],
      questions: (session.challenge.questions ?? {}) as Record<string, Question>
    })), roleName))
  })

  // GET /api/v1/progress/skill-tree — capability nodes over the existing
  // level path. A node opens when the previous skill has evidence at 60%+.
  fastify.get('/skill-tree', async (request, reply) => {
    const user = request.user!
    const roleName = await requireTrackRole(user.userId)
    if (!roleName) return reply.status(400).send({ error: 'ابتدا نقش خود را انتخاب کنید.' })
    const role = roleName as (typeof ROLES)[number]
    const [sessions, levels, progressRows] = await Promise.all([
      prisma.session.findMany({ where: { userId: user.userId, status: 'completed', challenge: { roleId: user.roleTrackId! } }, select: { path: true, challenge: { select: { questions: true } } } }),
      prisma.level.findMany({ where: { status: 'active', challenge: { roleId: user.roleTrackId!, status: 'active' } }, orderBy: { number: 'asc' }, select: { id: true, number: true, challenge: { select: { title: true, questions: true } } } }),
      prisma.levelProgress.findMany({ where: { userId: user.userId, level: { challenge: { roleId: user.roleTrackId! } } }, select: { levelId: true, status: true } })
    ])
    const profile = buildSkillProfile(sessions.map(session => ({
      path: (Array.isArray(session.path) ? session.path : []) as unknown as SkillPathEntry[],
      questions: (session.challenge.questions ?? {}) as Record<string, Question>
    })), role)
    const passed = new Set(progressRows.filter(row => row.status === 'passed').map(row => row.levelId))
    const playable = new Set<string>()
    let previousLevelId: string | null = null
    for (const level of levels) {
      if (previousLevelId === null || passed.has(previousLevelId) || passed.has(level.id)) playable.add(level.id)
      previousLevelId = level.id
    }
    const definitions = skillsForRole(role)
    return reply.send({
      threshold: 60,
      skills: definitions.map((definition, index) => {
        const skill = profile.skills[index]
        const previous = profile.skills[index - 1]
        const unlocked = index === 0 || (previous.count > 0 && previous.rate >= 0.6)
        const challenges = levels.filter(level => Object.values(level.challenge.questions as Record<string, Question>).some(question => question.choices.some(choice => choice.stage === definition.stage))).map(level => ({
          id: level.id, number: level.number, title: level.challenge.title, passed: passed.has(level.id), playable: playable.has(level.id)
        }))
        return { ...skill, status: !unlocked ? 'locked' : skill.count > 0 && skill.rate >= 0.6 ? 'mastered' : 'current', challenges, completedChallenges: challenges.filter(level => level.passed).length }
      })
    })
  })

  // GET /api/v1/progress/badges — every badge, with earned state and condition
  fastify.get('/badges', async (request, reply) => {
    const user = request.user!

    if (!(await requireTrackRole(user.userId))) {
      return reply.status(400).send({ error: 'هنوز نقشی انتخاب نشده است. ابتدا مسیر خود را انتخاب کنید.' })
    }
    const roleId = user.roleTrackId!

    const [allBadges, earned, progressRows, streak, industryLevels] = await Promise.all([
      prisma.badge.findMany({ orderBy: { name: 'asc' } }),
      // Earned rows are per (user, role): only this track's trophies show.
      prisma.userBadge.findMany({ where: { userId: user.userId, roleId } }),
      prisma.levelProgress.findMany({ where: { userId: user.userId, level: { challenge: { roleId } } }, select: { levelId: true, status: true, bestStars: true, answered: true, hits: true } }),
      prisma.streak.findUnique({ where: { userId_roleId: { userId: user.userId, roleId } } }),
      prisma.level.findMany({ where: { status: 'active', challenge: { roleId } }, select: { id: true, industryId: true } })
    ])

    const earnedAtByBadge = new Map(earned.map(row => [row.badgeId, row.earnedAt]))
    const passed = progressRows.filter(row => row.status === 'passed')
    const passedIds = new Set(passed.map(row => row.levelId))
    const totalStars = progressRows.reduce((sum, row) => sum + row.bestStars, 0)
    const perfect = passed.filter(row => row.answered > 0 && row.hits === row.answered).length

    return reply.send({
      badges: allBadges.map(badge => {
        const condition = badge.unlockCondition as { type?: string; threshold?: number; industryId?: string }
        let current = 0
        let target = condition.threshold ?? 1
        switch (condition.type) {
          case 'levelsPassedAbove': current = passed.length; break
          case 'perfectLevelsAbove': current = perfect; break
          case 'starsAbove': current = totalStars; break
          case 'streakAbove': current = streak?.currentStreak ?? 0; break
          case 'industryCompleted': {
            const groups = new Map<string, string[]>()
            for (const level of industryLevels) {
              if (condition.industryId && level.industryId !== condition.industryId) continue
              groups.set(level.industryId, [...(groups.get(level.industryId) ?? []), level.id])
            }
            const closest = [...groups.values()].sort((a, b) => (b.filter(id => passedIds.has(id)).length / b.length) - (a.filter(id => passedIds.has(id)).length / a.length))[0] ?? []
            current = closest.filter(id => passedIds.has(id)).length
            target = closest.length || 1
            break
          }
        }
        return {
        id: badge.id,
        name: badge.name,
        description: badge.description,
        iconRef: badge.iconRef,
        unlockCondition: badge.unlockCondition,
        progress: { current, target, percent: Math.min(100, Math.round(current / target * 100)) },
        earned: earnedAtByBadge.has(badge.id),
        earnedAt: earnedAtByBadge.get(badge.id) ?? null
        }
      })
    })
  })

  // GET /api/v1/progress/leaderboard — weekly XP within the caller's cohort
  fastify.get('/leaderboard', async (request, reply) => {
    const user = request.user!

    if (!user.cohortId) {
      return reply.send({ leaderboard: [], userRank: null })
    }
    if (!(await requireTrackRole(user.userId))) {
      return reply.status(400).send({ error: 'هنوز نقشی انتخاب نشده است. ابتدا مسیر خود را انتخاب کنید.' })
    }
    const roleId = user.roleTrackId!

    // Weekly XP counts only the caller's TRACK's levels: the ranking compares
    // output on the same content, never a mix of both roles' paths. The level
    // set is a path's worth of rows — an `in` filter stays cheap.
    const trackLevelIds = (await prisma.level.findMany({
      where: { challenge: { roleId } },
      select: { id: true }
    })).map(level => level.id)
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const [grouped, dailyRows] = await Promise.all([prisma.levelProgress.groupBy({
      by: ['userId'],
      where: { levelId: { in: trackLevelIds }, passedAt: { gte: oneWeekAgo }, user: { cohortId: user.cohortId } },
      _sum: { xpEarned: true }
    }), prisma.dailyChallenge.groupBy({
      by: ['userId'],
      where: { roleId, completedAt: { gte: oneWeekAgo }, user: { cohortId: user.cohortId } },
      _sum: { xpEarned: true }
    })])

    // The cohort is small at MVP scale, so rank the whole cohort rather than
    // fetching a top N and then re-deriving the caller's position.
    const weeklyByUser = new Map<string, number>()
    for (const row of [...grouped, ...dailyRows]) weeklyByUser.set(row.userId, (weeklyByUser.get(row.userId) ?? 0) + (row._sum.xpEarned ?? 0))
    const ranked = [...weeklyByUser.entries()]
      .map(([userId, weeklyXp]) => ({ userId, weeklyXp }))
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
