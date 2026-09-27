import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'

const require = createRequire(new URL('../../packages/db/package.json', import.meta.url))
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const base = process.env.API_URL || 'http://localhost:4000/api/v1'
let userId

async function call(path, method = 'GET', data, cookie) {
  const response = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: data === undefined ? undefined : JSON.stringify(data)
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${JSON.stringify(body)}`)
  return { body, cookie: response.headers.get('set-cookie')?.split(';')[0] }
}

async function finish(sessionId, cookie) {
  let last
  for (let step = 0; step < 40; step++) {
    const state = await call(`/sessions/${sessionId}`, 'GET', undefined, cookie)
    if (!state.body.question) break
    const question = state.body.question
    if (question.answerMode !== 'choice') throw new Error('isolation test requires a choice-only challenge')
    last = await call(`/sessions/${sessionId}/answer`, 'POST', { choiceIndex: question.choices[0].index }, cookie)
    if (last.body.status === 'completed') return last.body
  }
  throw new Error('session did not complete')
}

try {
  const signup = await call('/auth/signup', 'POST', { email: `daily-isolation-${randomUUID()}@example.test`, password: randomUUID() + 'Aa1!' })
  userId = signup.body.userId
  const cookie = signup.cookie
  const roles = await call('/roles', 'GET', undefined, cookie)
  const role = roles.body.roles.find(item => item.name === 'Product Management')
  if (!role) throw new Error('PM role missing')
  await call('/auth/onboarding/role', 'POST', { roleId: role.id }, cookie)
  const levels = await call('/levels', 'GET', undefined, cookie)
  const first = levels.body.levels.find(item => item.progress.status === 'unlocked')
  if (!first) throw new Error('first level missing')
  const level = await prisma.level.findUniqueOrThrow({ where: { id: first.id } })
  const day = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const part = kind => day.find(item => item.type === kind).value
  await prisma.dailyChallenge.create({ data: { userId, roleId: role.id, day: `${part('year')}-${part('month')}-${part('day')}`, challengeId: level.challengeId } })

  const path = await call(`/levels/${level.id}/start`, 'POST', {}, cookie)
  const daily = await call('/daily/start', 'POST', {}, cookie)
  if (path.body.sessionId === daily.body.sessionId) throw new Error('daily reused the path session')
  const dailyRecord = await prisma.session.findUniqueOrThrow({ where: { id: daily.body.sessionId } })
  if (dailyRecord.levelId !== null) throw new Error('daily session is attached to a path level')
  const pathRecord = await prisma.session.findUniqueOrThrow({ where: { id: path.body.sessionId } })
  if (pathRecord.levelId !== level.id) throw new Error('path session lost its level')
  const dailyResult = await finish(daily.body.sessionId, cookie)
  if (dailyResult.dailyReward?.xpGained !== 20 || dailyResult.result !== null) throw new Error('daily reward or level credit is wrong')
  const pathStillOpen = await prisma.session.findUniqueOrThrow({ where: { id: path.body.sessionId } })
  if (pathStillOpen.status !== 'in_progress') throw new Error('daily completion changed path progress')
  const pathResult = await finish(path.body.sessionId, cookie)
  if (!pathResult.result || pathResult.dailyReward !== null) throw new Error('path reward or daily credit is wrong')
  const dailySummary = await call(`/sessions/${daily.body.sessionId}/summary`, 'GET', undefined, cookie)
  const pathSummary = await call(`/sessions/${path.body.sessionId}/summary`, 'GET', undefined, cookie)
  if (dailySummary.body.dailyReward !== 20 || pathSummary.body.dailyReward !== 0) throw new Error('recaps mixed daily and path credit')
  if (process.env.LIARA_BASE_URL && process.env.LIARA_API_KEY && process.env.LIARA_CHAT_MODEL && !dailySummary.body.aiAvailable) {
    throw new Error('API did not recognize the Liara configuration')
  }
  console.log('Daily and path sessions remain independent: OK')
} finally {
  if (userId) {
    await prisma.dailyChallenge.deleteMany({ where: { userId } })
    await prisma.userBadge.deleteMany({ where: { userId } })
    await prisma.streak.deleteMany({ where: { userId } })
    await prisma.levelProgress.deleteMany({ where: { userId } })
    await prisma.session.deleteMany({ where: { userId } })
    await prisma.user.delete({ where: { id: userId } })
  }
  await prisma.$disconnect()
}
