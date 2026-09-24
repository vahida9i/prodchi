import { prisma } from '../lib/prisma.ts'
import { levelFromXp } from '@prodchi/shared-types/scoring'
import type { LevelScore } from '@prodchi/shared-types/scoring'

/**
 * Gamification + level crediting.
 *
 * This module is the ONLY writer of `LevelProgress`. It is called from exactly
 * one place — the session engine, when an answer's `next` is END — so a level's
 * pass state can never be set by a route handler directly.
 *
 * Pass condition: reaching END. That is the session engine's existing
 * behaviour, so nothing here decides pass/fail; it records the score that came
 * with it.
 *
 * XP rule (plan): xp = 10 x best hits. XP is credited ONCE, on the first pass,
 * and never recomputed. Replays improve `bestXp`/`bestStars` for display only,
 * so a level's score cannot be farmed by replaying it.
 */

export interface BadgeAward {
  id: string
  name: string
  description: string
  iconRef: string
}

export interface LevelCompletion {
  /** The recorded run for this level. */
  hits: number
  answered: number
  accuracy: number
  stars: number
  /** XP credited to the level (the first-pass value; unchanged by replays). */
  xpEarned: number
  /** XP added to the account by this attempt — 0 when replaying a passed level. */
  xpGained: number
  bestXp: number
  bestStars: number
  attempts: number
  firstPass: boolean
  levelNumber: number
  nextLevelNumber: number | null
  totalXp: number
  playerLevel: number
  leveledUp: boolean
  streak: { currentStreak: number; longestStreak: number }
  newBadges: BadgeAward[]
}

/** Start of the given day in UTC — streak days are UTC dates. */
function utcDayStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

/** XP of this account ON ONE role track — profile/progress never aggregate across tracks. */
async function sumXp(userId: string, roleId: string): Promise<number> {
  const aggregate = await prisma.levelProgress.aggregate({
    where: { userId, level: { challenge: { roleId } } },
    _sum: { xpEarned: true }
  })
  return aggregate._sum.xpEarned ?? 0
}

/** Yesterday extends the streak, today is a no-op, anything older restarts at 1. Per (user, role). */
async function updateStreak(userId: string, roleId: string) {
  const today = utcDayStart(new Date())
  const existing = await prisma.streak.findUnique({ where: { userId_roleId: { userId, roleId } } })

  if (!existing) {
    return prisma.streak.create({
      data: { userId, roleId, currentStreak: 1, longestStreak: 1, lastActiveDay: today }
    })
  }

  const lastActive = existing.lastActiveDay ? utcDayStart(existing.lastActiveDay) : null
  let currentStreak = existing.currentStreak

  if (lastActive) {
    const diffDays = Math.round((today.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays === 1) currentStreak = existing.currentStreak + 1
    else if (diffDays > 1) currentStreak = 1
    // diffDays === 0 means already active today: unchanged
  } else {
    currentStreak = 1
  }

  return prisma.streak.update({
    where: { userId_roleId: { userId, roleId } },
    data: {
      currentStreak,
      longestStreak: Math.max(existing.longestStreak, currentStreak),
      lastActiveDay: today
    }
  })
}

/**
 * Evaluate every badge the user has not earned yet on THIS role track against
 * that track's current path state. Progress, streak and industry completion are
 * all scoped to the track — a badge earned on one track never shows (or counts)
 * on the other. An unknown `unlockCondition.type` is skipped rather than
 * unlocked, so a typo in seed data can never hand out a badge for free.
 */
export async function evaluateBadges(userId: string, roleId: string): Promise<BadgeAward[]> {
  const [allBadges, earned, progress, streak] = await Promise.all([
    prisma.badge.findMany(),
    prisma.userBadge.findMany({ where: { userId, roleId } }),
    // Only this track's levels count toward thresholds.
    prisma.levelProgress.findMany({ where: { userId, level: { challenge: { roleId } } } }),
    prisma.streak.findUnique({ where: { userId_roleId: { userId, roleId } } })
  ])

  const earnedIds = new Set(earned.map(row => row.badgeId))
  const passed = progress.filter(row => row.status === 'passed')
  const levelsPassed = passed.length
  const perfectLevels = passed.filter(row => row.answered > 0 && row.hits === row.answered).length
  const totalStars = progress.reduce((sum, row) => sum + row.bestStars, 0)

  const newBadges: BadgeAward[] = []

  for (const badge of allBadges) {
    if (earnedIds.has(badge.id)) continue

    const condition = badge.unlockCondition as {
      type?: string
      threshold?: number
      industryId?: string
    }

    let unlocked = false
    switch (condition.type) {
      case 'levelsPassedAbove':
        unlocked = levelsPassed >= (condition.threshold ?? 0)
        break
      case 'perfectLevelsAbove':
        unlocked = perfectLevels >= (condition.threshold ?? 0)
        break
      case 'starsAbove':
        unlocked = totalStars >= (condition.threshold ?? 0)
        break
      case 'streakAbove':
        unlocked = (streak?.currentStreak ?? 0) >= (condition.threshold ?? 0)
        break
      case 'industryCompleted': {
        if (!condition.industryId) break
        // Scoped to the track: only this role's levels inside the industry can
        // complete it — the other track's levels in the same industry are not
        // part of this candidate's path at all.
        const industryLevels = await prisma.level.findMany({
          where: { industryId: condition.industryId, status: 'active', challenge: { roleId } },
          select: { id: true }
        })
        const passedIds = new Set(passed.map(row => row.levelId))
        unlocked = industryLevels.length > 0 && industryLevels.every(level => passedIds.has(level.id))
        break
      }
      default:
        continue
    }

    if (!unlocked) continue

    try {
      await prisma.userBadge.create({ data: { userId, badgeId: badge.id, roleId } })
      newBadges.push({
        id: badge.id,
        name: badge.name,
        description: badge.description,
        iconRef: badge.iconRef
      })
    } catch (err: any) {
      // Lost a race against a parallel completion: the badge is already earned.
      if (err?.code !== 'P2002') throw err
    }
  }

  return newBadges
}

/**
 * Whether the caller may play this level. The gate is DERIVED from passed
 * rows, never from stored `unlocked` rows: a level is playable when it is
 * already passed, when no active level precedes it (the start of the path is
 * always open, so a brand-new player is never stuck), or when the active
 * level right before it is passed. Deriving means retiring, restoring or
 * renumbering a level re-routes the path instead of stranding players on a
 * stale unlock row.
 *
 * The path is per-role: level numbers run across every role track, so the
 * preceding levels must be narrowed to the same role track the level belongs
 * to — exactly the set `GET /levels` shows the caller. Without that, a role's
 * first level would sit behind the other role's levels and could never open.
 * A preceding level whose challenge is retired is skipped for the same reason
 * the map skips it: it is not on the caller's path at all.
 *
 * `roleId` arrives as its own argument because a `Level` row carries no role —
 * the challenge does. A caller that passed a level object without the role
 * would silently widen the filter (Prisma ignores an `undefined` field) and
 * gate one role's levels behind another role's progress, which is exactly what
 * the explicitly required argument rules out.
 */
export async function isLevelPlayable(
  userId: string,
  level: { id: string; number: number },
  roleId: string
): Promise<boolean> {
  const [precedingLevels, ownProgress] = await Promise.all([
    prisma.level.findMany({
      where: {
        status: 'active',
        number: { lt: level.number },
        challenge: { roleId, status: 'active' }
      },
      orderBy: { number: 'asc' },
      select: { id: true }
    }),
    prisma.levelProgress.findUnique({
      where: { userId_levelId: { userId, levelId: level.id } }
    })
  ])

  // Replays of a passed level are always allowed (they can never add XP).
  if (ownProgress?.status === 'passed') {
    return true
  }

  // No earlier active level: this is the head of the path.
  if (precedingLevels.length === 0) {
    return true
  }

  // The active level immediately before this one must be passed.
  const previous = precedingLevels[precedingLevels.length - 1]
  const passed = await prisma.levelProgress.findFirst({
    where: { userId, levelId: previous.id, status: 'passed' },
    select: { levelId: true }
  })
  return passed !== null
}

/**
 * Record a finished level, credit XP once, unlock the next level and refresh
 * streak/badges. `score` comes straight from the session engine's scoring pass.
 */
export async function creditLevelResult(
  userId: string,
  levelId: string,
  score: LevelScore
): Promise<LevelCompletion> {
  // The level's role track travels with every write below: XP totals, streak,
  // badges and the unlock chain are all scoped to this track so the completion
  // card can never contradict the (per-track) progress page.
  const levelRow = await prisma.level.findUnique({
    where: { id: levelId },
    include: { challenge: { select: { roleId: true } } }
  })
  if (!levelRow) {
    throw new Error('Level not found')
  }
  const roleId = levelRow.challenge.roleId

  const totalXpBefore = await sumXp(userId, roleId)

  // The two writes (record the run, unlock the next active level) and the
  // pre-read happen in one transaction, so a parallel completion can never
  // interleave between the read and the write. True parallel completions of
  // the same level are already impossible (one in-progress session per
  // challenge, optimistic-concurrency guarded) — this closes the last seam.
  const { progress, previous, nextLevelNumber } = await prisma.$transaction(async tx => {
    const previous = await tx.levelProgress.findUnique({
      where: { userId_levelId: { userId, levelId } }
    })
    const previousBestXp = previous?.bestXp ?? -1

    const progress = await tx.levelProgress.upsert({
      where: { userId_levelId: { userId, levelId } },
      create: {
        userId,
        levelId,
        status: 'passed',
        hits: score.hits,
        answered: score.answered,
        bestStars: score.stars,
        xpEarned: score.xp,
        bestXp: score.xp,
        attempts: 1,
        passedAt: new Date()
      },
      update: {
        status: 'passed',
        passedAt: previous?.passedAt ?? new Date(),
        attempts: { increment: 1 },
        bestXp: Math.max(previousBestXp, score.xp),
        bestStars: Math.max(previous?.bestStars ?? 0, score.stars),
        // Keep the details of the best run; xpEarned is never touched here.
        ...(score.xp > previousBestXp ? { hits: score.hits, answered: score.answered } : {})
      }
    })

    // Unlock the next active level OF THE SAME TRACK (retired levels are
    // skipped by number order). Cross-track levels must never be unlocked by
    // this completion — they are not on the candidate's path.
    const nextLevel = await tx.level.findFirst({
      where: { status: 'active', number: { gt: levelRow.number }, challenge: { roleId } },
      orderBy: { number: 'asc' },
      select: { id: true, number: true }
    })
    if (nextLevel) {
      await tx.levelProgress.upsert({
        where: { userId_levelId: { userId, levelId: nextLevel.id } },
        create: { userId, levelId: nextLevel.id, status: 'unlocked' },
        // Never demote a level the user has already passed.
        update: {}
      })
    }

    return { progress, previous, nextLevelNumber: nextLevel?.number ?? null }
  })

  const firstPass = previous?.status !== 'passed'
  const streak = await updateStreak(userId, roleId)
  const newBadges = await evaluateBadges(userId, roleId)
  const totalXp = await sumXp(userId, roleId)
  const playerLevel = levelFromXp(totalXp)

  return {
    hits: progress.hits,
    answered: progress.answered,
    accuracy: score.accuracy,
    stars: progress.bestStars,
    xpEarned: progress.xpEarned,
    // DB truth: what this run actually added to the account. A parallel
    // completion can at worst make this 0 for a duplicate report.
    xpGained: totalXp - totalXpBefore,
    bestXp: progress.bestXp,
    bestStars: progress.bestStars,
    attempts: progress.attempts,
    firstPass,
    levelNumber: levelRow.number,
    nextLevelNumber,
    totalXp,
    playerLevel,
    leveledUp: playerLevel > levelFromXp(totalXpBefore),
    streak: { currentStreak: streak.currentStreak, longestStreak: streak.longestStreak },
    newBadges
  }
}
