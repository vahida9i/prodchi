import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.ts'
import { XP_PER_BEST_CHOICE } from '@prodchi/shared-types/challenge-schema'
import { startOrResumeSession } from '../services/session-engine.ts'
import { isLevelPlayable } from '../services/gamification.ts'

/**
 * The path map: numbered levels, unlocked in order, one content challenge each.
 *
 * Pass condition is "reached END" — the session engine's existing behaviour —
 * so this route never decides pass/fail. It only reports lock state and starts
 * the session for a level the caller is allowed to play.
 */
export async function levelRoutes(fastify: FastifyInstance) {
  // GET /api/v1/levels
  fastify.get('/', async (request, reply) => {
    const user = request.user!

    if (!user.roleTrackId) {
      return reply.status(400).send({ error: 'Role not selected. Complete onboarding first.' })
    }

    const [levels, progressRows, finishedRuns] = await Promise.all([
      prisma.level.findMany({
        where: { status: 'active', challenge: { roleId: user.roleTrackId, status: 'active' } },
        orderBy: { number: 'asc' },
        include: {
          industry: { select: { id: true, name: true } },
          challenge: { select: { title: true, summary: true } }
        }
      }),
      prisma.levelProgress.findMany({ where: { userId: user.userId } }),
      // The recap needs a session id, which progress rows never carried. Latest
      // wins — a replay is the run the candidate remembers. Bounded by `take`:
      // a path is a few dozen levels at MVP scale.
      prisma.session.findMany({
        where: { userId: user.userId, status: 'completed', levelId: { not: null } },
        orderBy: { completedAt: 'desc' },
        select: { id: true, levelId: true },
        take: 100
      })
    ])

    const progressByLevel = new Map(progressRows.map(row => [row.levelId, row]))
    const passedIds = new Set(
      progressRows.filter(row => row.status === 'passed').map(row => row.levelId)
    )

    // `orderBy` desc + first-wins = the latest finished run for each level.
    const lastRunByLevel = new Map<string, string>()
    for (const run of finishedRuns) {
      if (run.levelId && !lastRunByLevel.has(run.levelId)) lastRunByLevel.set(run.levelId, run.id)
    }

    // Display status is DERIVED from passed rows — the same rule the gate
    // enforces: the first active level is open, every later level unlocks
    // when the active level right before it is passed. Retiring or
    // renumbering re-routes the path instead of stranding anyone.
    let previousLevelId: string | null = null

    return reply.send({
      levels: levels.map(level => {
        const progress = progressByLevel.get(level.id)
        const derivedUnlocked = previousLevelId === null || passedIds.has(previousLevelId)
        previousLevelId = level.id

        return {
          id: level.id,
          number: level.number,
          title: level.challenge.title,
          // The authored brief on the business, shown before the run starts.
          // Null for content imported without one — the node renders bare.
          summary: level.challenge.summary ?? null,
          industry: level.industry,
          difficulty: level.difficulty,
          type: level.type,
          xpPerBest: XP_PER_BEST_CHOICE,
          progress: {
            status: progress?.status === 'passed' ? 'passed' : derivedUnlocked ? 'unlocked' : 'locked',
            bestStars: progress?.bestStars ?? 0,
            bestXp: progress?.bestXp ?? 0,
            xpEarned: progress?.xpEarned ?? 0,
            attempts: progress?.attempts ?? 0,
            // What "Review your run" opens. A level the candidate replayed
            // points at the newest run; one with no finished run has none.
            lastSessionId: lastRunByLevel.get(level.id) ?? null
          }
        }
      })
    })
  })

  // POST /api/v1/levels/:id/start — begin (or resume) a level's session
  fastify.post('/:id/start', async (request, reply) => {
    const { id } = request.params as { id: string }
    const user = request.user!

    if (!user.roleTrackId) {
      return reply.status(400).send({ error: 'Role not selected. Complete onboarding first.' })
    }

    const level = await prisma.level.findUnique({
      where: { id },
      include: { challenge: true }
    })

    if (
      !level ||
      level.status !== 'active' ||
      level.challenge.status !== 'active' ||
      level.challenge.roleId !== user.roleTrackId
    ) {
      return reply.status(404).send({ error: 'Level not found or not available' })
    }

    // Gating is enforced here, not just hidden in the UI: only the first active
    // level, or a level the caller has already unlocked/passed, can be started.
    // The same shared gate guards a level-tagged `POST /sessions`. The role must
    // travel with the call — without it the gate widens to every role's levels
    // and locks one track behind progress it can never see or make.
    const playable = await isLevelPlayable(user.userId, level, user.roleTrackId)
    if (!playable) {
      return reply.status(403).send({ error: 'This level is locked. Pass the previous level to unlock it.' })
    }

    let started
    try {
      started = await startOrResumeSession(user.userId, level.challenge, level.id)
    } catch (err) {
      if (err instanceof Error && err.message === 'Challenge has no valid start question') {
        return reply.status(500).send({ error: err.message })
      }
      throw err
    }

    return reply.status(started.resumed ? 200 : 201).send({
      ...started,
      level: { id: level.id, number: level.number, type: level.type }
    })
  })
}
