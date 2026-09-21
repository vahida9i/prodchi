/* End-to-end verification of the level path:
 *   import → level assignment → gated start → play → score → XP → unlock → badges
 *
 * Requires the API running on :4000 and the seed applied (industries + badges).
 * Uses a fresh throwaway candidate each run, so "fresh player" assertions are
 * deterministic and no real user's progress is touched. Reuses levels that
 * already exist at the numbers it needs (deleting them is blocked once anyone
 * has progress on them).
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const BASE = 'http://localhost:4000/api/v1'
// Resolved relative to this script, so the suite runs from any checkout.
const FIXTURE_DIR = fileURLToPath(new URL('../docs/fixtures', import.meta.url))
const PASSWORD = 'e2e-password-123'

const onboarding = JSON.parse(readFileSync(`${FIXTURE_DIR}/onboarding-drop-off.json`, 'utf-8'))
const single = JSON.parse(readFileSync(`${FIXTURE_DIR}/single-question-sample.json`, 'utf-8'))

let cookie = ''

async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined
  })
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) cookie = setCookie.split(';')[0]
  let json = null
  try { json = await res.json() } catch {}
  return { status: res.status, json }
}

let failures = 0
function check(label, cond, detail) {
  if (cond) { console.log(`PASS ${label}`) } else { failures++; console.log(`FAIL ${label} — ${detail}`) }
}

/** Every object key seen anywhere in a payload — used to prove nothing internal leaks. */
function keysOf(value, acc = new Set()) {
  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) { acc.add(key); keysOf(nested, acc) }
  }
  return acc
}

// Authoring scaffolding that must never reach a candidate anywhere. `reveal` is
// deliberately absent: a reveal (prose or table) is returned exactly once, after
// the choice is submitted — so it is asserted positively below instead.
const INTERNAL_KEYS = ['bestChoice', 'stage', 'next']

/** Import a fixture, or resolve the existing challenge with that import key. */
async function importFixture(fixture) {
  const res = await req('POST', '/admin/challenges/import', fixture)
  if (res.status === 201) return { challengeId: res.json.challengeId, type: res.json.type }

  const list = await req('GET', '/admin/challenges')
  const existing = list.json?.challenges?.find(c => c.importKey === fixture.id)
  if (!existing) throw new Error(`fixture ${fixture.id} missing and not importable: ${JSON.stringify(res.json)}`)
  return { challengeId: existing.id, type: null }
}

/** Play a level start-to-END. `chooseBest` false always picks the next choice along. */
async function playLevel(levelId, questions, chooseBest = true) {
  const seen = new Set()
  const reveals = []
  const started = await req('POST', `/levels/${levelId}/start`)
  keysOf(started.json, seen)
  if (started.status !== 200 && started.status !== 201) return { started, answers: 0, last: started, seen, reveals }

  const sessionId = started.json.sessionId
  let question = started.json.question
  let answers = 0
  let last = started

  while (question && answers < 300) {
    const best = questions[question.key]?.bestChoice ?? 0
    const choiceIndex = chooseBest ? best : (best + 1) % question.choices.length
    last = await req('POST', `/sessions/${sessionId}/answer`, { choiceIndex })
    keysOf(last.json, seen)
    if (last.json?.reveal) reveals.push(last.json.reveal)
    answers++
    if (last.status !== 200 || last.json?.status === 'completed') break
    question = last.json?.question
  }

  return { sessionId, answers, last, started, seen, reveals }
}

// 1. authenticate as admin
let r = await req('POST', '/auth/login', { email: 'admin@baaten.local', password: 'admin123' })
check('admin login', r.status === 200, JSON.stringify(r.json))

// 2. import both fixtures (idempotent)
const branch = await importFixture(onboarding)
check('branching challenge available', Boolean(branch.challengeId), JSON.stringify(branch))
if (branch.type !== null) check('import reports derived type = challenge', branch.type === 'challenge', branch.type)

const singleQuestion = await importFixture(single)
check('single-question challenge available', Boolean(singleQuestion.challengeId), JSON.stringify(singleQuestion))
if (singleQuestion.type !== null) check('import reports derived type = single_question', singleQuestion.type === 'single_question', singleQuestion.type)

// 3. an industry and two levels (reuse when they already exist)
const industries = await req('GET', '/admin/industries')
check('seeded industries available', industries.status === 200 && industries.json.industries.length > 0, JSON.stringify(industries.json))
const industryId = industries.json.industries[0].id

let adminLevels = await req('GET', '/admin/levels')
const byNumber = new Map(adminLevels.json.levels.map(level => [level.number, level]))

async function ensureLevel(number, challengeId, difficulty) {
  if (byNumber.has(number)) return { status: 200, json: byNumber.get(number), reused: true }
  const created = await req('POST', '/admin/levels', { number, industryId, difficulty, challengeId })
  return { ...created, reused: false }
}

const level1 = await ensureLevel(1, branch.challengeId, 'medium')
check('level 1 available', level1.status === 201 || level1.status === 200, JSON.stringify(level1.json))
const level2 = await ensureLevel(2, singleQuestion.challengeId, 'easy')
check('level 2 available', level2.status === 201 || level2.status === 200, JSON.stringify(level2.json))

adminLevels = await req('GET', '/admin/levels')
const adminLevel1 = adminLevels.json.levels.find(level => level.number === 1)
const adminLevel2 = adminLevels.json.levels.find(level => level.number === 2)
check('level 1 typed as a branching challenge', adminLevel1.type === 'challenge', adminLevel1.type)
check('level 2 typed as a single question', adminLevel2.type === 'single_question', adminLevel2.type)
check('levels carry industry and difficulty',
  Boolean(adminLevel1.industry?.name) && adminLevel1.difficulty === 'medium',
  JSON.stringify(adminLevel1))

// 4. duplicate level number is rejected with a reason
const duplicate = await req('POST', '/admin/levels', { number: 1, industryId, difficulty: 'easy', challengeId: singleQuestion.challengeId })
check('duplicate level number → 409 with a reason',
  duplicate.status === 409 && typeof duplicate.json?.error === 'string',
  JSON.stringify(duplicate.json))

// 5. a fresh throwaway candidate, so unlock assertions start from zero
const freshEmail = `e2e-level-${Date.now()}@baaten.local`
r = await req('POST', '/auth/signup', { email: freshEmail, password: PASSWORD })
check('candidate signup', r.status === 201, JSON.stringify(r.json))

const roles = await req('GET', '/roles')
const productDesign = roles.json.roles.find(role => role.name === 'Product Design')
check('Product Design role available', Boolean(productDesign), JSON.stringify(roles.json))
r = await req('POST', '/auth/onboarding/role', { roleId: productDesign.id })
check('candidate role selected', r.status === 200, JSON.stringify(r.json))

// 6. the path map for a brand-new player
let path = await req('GET', '/levels')
check('path map lists the levels in number order',
  path.status === 200 && path.json.levels[0].number === 1 && path.json.levels[1].number === 2,
  JSON.stringify(path.json.levels?.map(level => level.number)))
check('new player has level 1 unlocked', path.json.levels[0].progress.status === 'unlocked', JSON.stringify(path.json.levels[0].progress))
check('level 2 is locked until level 1 is passed', path.json.levels[1].progress.status === 'locked', JSON.stringify(path.json.levels[1].progress))
check('each level advertises 10 XP per best choice', path.json.levels[0].xpPerBest === 10, String(path.json.levels[0].xpPerBest))

// 7. gating is enforced server-side, not just hidden in the UI — on both entry
// points: the level start route AND a level-tagged `POST /sessions`.
const lockedStart = await req('POST', `/levels/${level2.json.id}/start`)
check('starting a locked level → 403', lockedStart.status === 403, JSON.stringify(lockedStart.json))
const lockedDirect = await req('POST', '/sessions', { challengeId: singleQuestion.challengeId, levelId: level2.json.id })
check('a locked level cannot be credited via POST /sessions either → 403',
  lockedDirect.status === 403,
  JSON.stringify(lockedDirect.json))

// 8. play level 1 always picking the best choice
const level1Run = await playLevel(level1.json.id, onboarding.questions, true)
check('level 1 reaches END', level1Run.last.json?.status === 'completed', JSON.stringify(level1Run.last.json))

const first = level1Run.last.json?.result
check('completion carries a score', Boolean(first), JSON.stringify(level1Run.last.json))
check('a perfect run hits every question', first.hits === first.answered, JSON.stringify(first))
check('XP = 10 x best hits', first.xpEarned === 10 * first.hits, JSON.stringify(first))
check('a perfect run is 3 stars', first.stars === 3, JSON.stringify(first))
check('the first pass credits XP', first.firstPass === true && first.xpGained === first.xpEarned, JSON.stringify(first))
check('passing level 1 unlocks level 2', first.nextLevelNumber === 2, JSON.stringify(first))
check('there is no ceiling: XP scales with how many questions were answered',
  first.answered === 9 && first.xpEarned === 90, JSON.stringify({ answered: first.answered, xp: first.xpEarned }))

// 9. nothing internal ever reaches the candidate
const leaked = INTERNAL_KEYS.filter(key => level1Run.seen.has(key))
check('no bestChoice/stage/next in candidate payloads', leaked.length === 0, `leaked: ${leaked.join(', ')}`)

// The reveal is the one thing that crosses over, exactly once, after the answer.
const startText = JSON.stringify(level1Run.started.json)
check('the question payload carries no reveal or authoring structure',
  ['"reveal"', '"bestChoice"', '"stage"', '"next"', '"table"', '"columns"', '"rows"'].every(key => !startText.includes(key)),
  startText.slice(0, 200))
check('a reveal does reach the candidate after answering', level1Run.seen.has('reveal'), [...level1Run.seen].join(', '))
// Every reveal arrives as a normalized block ({ text, table? }), never as a raw
// string. Table-bearing reveals are asserted end-to-end in
// e2e-import-session.mjs, which walks the branch that authors one — this suite
// follows the best-choice path, which in this fixture is prose-only.
check('every reveal arrives as a normalized block',
  level1Run.reveals.length > 0 &&
  level1Run.reveals.every(rv => rv && typeof rv === 'object' && (typeof rv.text === 'string' || rv.table)),
  JSON.stringify(level1Run.reveals?.slice(0, 2)))

// 10. the map reflects the pass
path = await req('GET', '/levels')
check('level 1 now reads as passed', path.json.levels[0].progress.status === 'passed', JSON.stringify(path.json.levels[0].progress))
check('level 2 is now unlocked', path.json.levels[1].progress.status === 'unlocked', JSON.stringify(path.json.levels[1].progress))
check('level 1 stores the earned XP', path.json.levels[0].progress.xpEarned === 90, JSON.stringify(path.json.levels[0].progress))
// The recap link is the run that was just finished; a level nobody has finished
// carries none, so the map can never offer a recap the API would reject.
check('the map points at the finished run so its recap is one click away',
  path.json.levels[0].progress.lastSessionId === level1Run.sessionId,
  `map=${path.json.levels[0].progress.lastSessionId} run=${level1Run.sessionId}`)
check('a level with no finished run offers no recap link',
  path.json.levels[1].progress.lastSessionId === null,
  JSON.stringify(path.json.levels[1].progress))
const mapLeaks = INTERNAL_KEYS.filter(key => keysOf(path.json).has(key))
check('the map exposes no authoring internals', mapLeaks.length === 0, `leaked: ${mapLeaks.join(', ')}`)

// 11. replaying a passed level cannot farm XP
const replay = await playLevel(level1.json.id, onboarding.questions, true)
const replayResult = replay.last.json?.result
check('replay is not a first pass', replayResult.firstPass === false, JSON.stringify(replayResult))
check('replay adds no XP', replayResult.xpGained === 0, JSON.stringify(replayResult))
check('replay leaves the credited XP untouched', replayResult.xpEarned === 90, JSON.stringify(replayResult))
check('replay increments the attempt count', replayResult.attempts === 2, JSON.stringify(replayResult))

// The recap follows the newest run — a replay is the run the candidate
// remembers — and the id the map hands out has to open a readable summary.
const afterReplay = await req('GET', '/levels')
check('the recap link follows the newest run, not the first pass',
  afterReplay.json.levels[0].progress.lastSessionId === replay.sessionId &&
  replay.sessionId !== level1Run.sessionId,
  `map=${afterReplay.json.levels[0].progress.lastSessionId} replay=${replay.sessionId} first=${level1Run.sessionId}`)
const replayedSummary = await req('GET', `/sessions/${replay.sessionId}/summary`)
check('the recap link the map hands out opens a summary', replayedSummary.status === 200, JSON.stringify(replayedSummary.json))

// 12. a single-question level: reaching END is the pass condition, even when wrong
const wrongRun = await playLevel(level2.json.id, single.questions, false)
const wrong = wrongRun.last.json?.result
check('single-question level completes on the wrong choice', wrongRun.last.json?.status === 'completed', JSON.stringify(wrongRun.last.json))
check('a wrong answer scores 0 hits, 0 XP, 0 stars', wrong.hits === 0 && wrong.xpEarned === 0 && wrong.stars === 0, JSON.stringify(wrong))
check('a wrong answer still passes the level', wrong.firstPass === true, JSON.stringify(wrong))
// The next level is whatever active level the path has after level 2 — with a
// grown path there may be several (4, 5, 6 …); the check expects the first.
const pathNow = await req('GET', '/levels')
const nextOnPath = pathNow.json.levels.find(level => level.number > 2)
check('the next path level is reported as next',
  wrong.nextLevelNumber === (nextOnPath ? nextOnPath.number : null),
  `result nextLevelNumber=${wrong.nextLevelNumber}, active levels after 2: ${pathNow.json.levels.filter(l => l.number > 2).map(l => l.number).join(',') || 'none'}`)

// 13. replaying it with the right choice improves the record but still adds no XP
const rightRun = await playLevel(level2.json.id, single.questions, true)
const right = rightRun.last.json?.result
check('a correct single-question answer scores 10 XP and 3 stars',
  right.bestXp === 10 && right.bestStars === 3,
  JSON.stringify(right))
check('improving a level adds no XP', right.xpGained === 0, JSON.stringify(right))
check('credited XP stays at the first-pass value', right.xpEarned === 0, JSON.stringify(right))

// 14. progress rolls up XP, stars, accuracy and industries
const progress = await req('GET', '/progress')
check('progress is readable', progress.status === 200, JSON.stringify(progress.json))
check('total XP = 90 (level 1) + 0 (level 2 first pass)', progress.json.totalXp === 90, String(progress.json.totalXp))
check('both levels count as passed', progress.json.levelsPassed === 2, String(progress.json.levelsPassed))
check('stars roll up from the best run of each level', progress.json.totalStars === 6, String(progress.json.totalStars))
check('accuracy uses the recorded best runs', progress.json.accuracy === 1, String(progress.json.accuracy))
check('player level comes from the XP curve', progress.json.playerLevel === 0, String(progress.json.playerLevel))
check('streak starts at 1 for the first day of activity',
  progress.json.streak.currentStreak === 1 && progress.json.streak.longestStreak === 1,
  JSON.stringify(progress.json.streak))

const industry = progress.json.industries.find(row => row.id === industryId)
check('industry rollup counts both levels as passed',
  industry.levelsPassed === 2 && industry.levelsTotal === 2 && industry.completed === true,
  JSON.stringify(industry))

// 15. badges award off the path model
const badges = await req('GET', '/progress/badges')
const earned = new Set(badges.json.badges.filter(badge => badge.earned).map(badge => badge.id))
check('badges list is available', badges.status === 200, JSON.stringify(badges.json))
check('“first level” badge earned', earned.has('first-level'), [...earned].join(', '))
check('“industry completed” badge earned after clearing the industry', earned.has('industry-explorer'), [...earned].join(', '))
check('star badge not yet earned (needs 15 stars, we have 6)', !earned.has('star-collector'), [...earned].join(', '))
check('streak badge not yet earned', !earned.has('streak-7'), [...earned].join(', '))

// 16. the session summary reports the score of the finished run
const summary = await req('GET', `/sessions/${level1Run.sessionId}/summary`)
check('summary is readable', summary.status === 200, JSON.stringify(summary.json))
check('summary carries the level number', summary.json.levelNumber === 1, String(summary.json.levelNumber))
check('summary reports hits/answered/xp/stars',
  summary.json.score.hits === 9 && summary.json.score.answered === 9 && summary.json.score.xp === 90 && summary.json.score.stars === 3,
  JSON.stringify(summary.json.score))
check('summary still returns the readable path', summary.json.path.length === 9, String(summary.json.path?.length))

// 17. the gate DERIVES from passed rows: a level created after the fact is
// playable as soon as every active level before it is passed, and retiring a
// level re-routes the path instead of stranding anyone on a stale unlock row.
await req('POST', '/auth/login', { email: 'admin@baaten.local', password: 'admin123' })

const clone = { ...single, id: 'permission_copy_single_v2' }
const third = await importFixture(clone)
check('cloned challenge available for level 3', Boolean(third.challengeId), JSON.stringify(third))

adminLevels = await req('GET', '/admin/levels')
const byNumberNow = new Map(adminLevels.json.levels.map(level => [level.number, level]))
let level3
let level3PriorStatus = null
let level3ChallengePriorStatus = null
let level3ChallengeId = null
if (byNumberNow.has(3)) {
  // Reuse whatever level occupies number 3 (the path may have grown since the
  // suite was written). A retired level must come back — level AND challenge —
  // for the re-route test, and both go back to their prior status afterwards.
  // The levels list does not carry the challenge's status, so it is fetched
  // separately.
  level3 = { status: 200, json: byNumberNow.get(3), reused: true }
  level3PriorStatus = level3.json.status
  level3ChallengeId = level3.json.challenge?.id ?? null
  if (level3PriorStatus !== 'active') {
    const restore3 = await req('PATCH', `/admin/levels/${level3.json.id}`, { status: 'active' })
    level3.json = restore3.status === 200 ? restore3.json : level3.json
  }
  if (level3ChallengeId) {
    const challengeInfo = await req('GET', `/admin/challenges/${level3ChallengeId}`)
    level3ChallengePriorStatus = challengeInfo.json?.status ?? null
    if (level3ChallengePriorStatus !== 'active') {
      const restore3Challenge = await req('PATCH', `/admin/challenges/${level3ChallengeId}/status`, { status: 'active' })
      if (restore3Challenge.status !== 200) {
        check('level 3 challenge restored for the re-route test', false, JSON.stringify(restore3Challenge.json))
      }
    }
  }
} else {
  level3 = await req('POST', '/admin/levels', { number: 3, industryId, difficulty: 'easy', challengeId: third.challengeId })
}
check('level 3 available', level3.status === 200 || level3.status === 201, JSON.stringify(level3.json))

const retire2 = await req('PATCH', `/admin/levels/${level2.json.id}`, { status: 'retired' })
check('level 2 retired', retire2.status === 200 && retire2.json.status === 'retired', JSON.stringify(retire2.json))

// back to the candidate: levels 1 and 2 are behind them, so level 3 must open
// even though 2 was retired and its own unlock row is now irrelevant
await req('POST', '/auth/login', { email: freshEmail, password: PASSWORD })

const start3 = await req('POST', `/levels/${level3.json.id}/start`)
check('level 3 playable after the level in front of it was retired',
  start3.status === 200 || start3.status === 201,
  JSON.stringify(start3.json))

path = await req('GET', '/levels')
check('the map re-routes around the retired level',
  path.status === 200 &&
  !path.json.levels.some(level => level.number === 2) &&
  path.json.levels[1].number === 3,
  JSON.stringify(path.json.levels?.map(level => [level.number, level.progress.status])))

let cursor3 = start3
while (cursor3.json && cursor3.json.status !== 'completed' && cursor3.json.question) {
  cursor3 = await req('POST', `/sessions/${start3.json.sessionId}/answer`, { choiceIndex: 1 })
}
check('level 3 run finishes cleanly', cursor3.json?.status === 'completed', JSON.stringify(cursor3.json))

await req('POST', '/auth/login', { email: 'admin@baaten.local', password: 'admin123' })
const restore2 = await req('PATCH', `/admin/levels/${level2.json.id}`, { status: 'active' })
check('level 2 restored', restore2.status === 200 && restore2.json.status === 'active', JSON.stringify(restore2.json))

// Put the reused level 3 (and its challenge) back exactly as they were found,
// so the suite never changes the shape of the admin's path as a side effect.
if (level3PriorStatus && level3PriorStatus !== 'active') {
  const back = await req('PATCH', `/admin/levels/${level3.json.id}`, { status: level3PriorStatus })
  check('level 3 returned to its prior status', back.status === 200 && back.json.status === level3PriorStatus, JSON.stringify(back.json))
}
if (level3ChallengePriorStatus && level3ChallengePriorStatus !== 'active' && level3ChallengeId) {
  await req('PATCH', `/admin/challenges/${level3ChallengeId}/status`, { status: level3ChallengePriorStatus })
}

console.log(failures === 0 ? '\nALL LEVEL-PATH CHECKS PASSED' : `\n${failures} LEVEL-PATH CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)


