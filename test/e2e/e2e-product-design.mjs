/* End-to-end verification of the PRODUCT DESIGN track — the complete journey.
 *
 *   role onboarding → content import (idempotent, validated) →
 *   session play (reveal-once, field-visibility, resume, concurrency) →
 *   level path (gated, progressive, XP/badges) → path ops (retire/reroute) →
 *   the 6-skill Product Design profile
 *
 * Every candidate-facing payload of the run is swept for authoring internals.
 * Requires the API running on :4000 and a scratch database (seed applied):
 * the suite builds its own levels and leaves throwaway candidates behind —
 * it is not idempotent against a database that already carries an authored
 * path. Mirrors e2e-product-management.mjs: one suite per role track.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const BASE = 'http://localhost:4000/api/v1'
const FIXTURE_DIR = fileURLToPath(new URL('../../docs/fixtures', import.meta.url))
const PASSWORD = 'e2e-password-123'

const onboarding = JSON.parse(readFileSync(`${FIXTURE_DIR}/onboarding-drop-off.json`, 'utf-8'))
const single = JSON.parse(readFileSync(`${FIXTURE_DIR}/single-question-sample.json`, 'utf-8'))

let cookie = ''

// Every payload the candidate-facing API returned during this run, so the
// field-visibility rule can be asserted across the whole flow, not spot checks.
// Admin paths (/admin/*) are excluded — admins pasted the JSON themselves.
const candidatePayloads = []

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
  if (
    path.startsWith('/sessions') || path.startsWith('/challenges') ||
    path.startsWith('/levels') || path.startsWith('/progress')
  ) {
    candidatePayloads.push({ method, path, text: JSON.stringify(json) })
  }
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

// ---------------------------------------------------------------------------
// Journey stage 1 — content ops (as the admin): import is the only way
// content enters, and it is idempotent on `id` so updates never need deletes.
// ---------------------------------------------------------------------------
let r = await req('POST', '/auth/login', { email: 'admin@baaten.local', password: 'admin123' })
check('admin login', r.status === 200, JSON.stringify(r.json))

const fixture = onboarding
let importRes = await req('POST', '/admin/challenges/import', fixture)
let challengeId = importRes.json?.challengeId

check('import fixture → 201 created (or 200 when it already existed)',
  (importRes.status === 201 || importRes.status === 200) && importRes.json?.updated === (importRes.status === 200) && Boolean(challengeId),
  JSON.stringify(importRes.json))

// Re-importing the same id updates in place: same challenge, no duplicate,
// no delete — and it is the only way content changes reach live challenges.
importRes = await req('POST', '/admin/challenges/import', fixture)
check('re-import updates in place → 200 with updated=true',
  importRes.status === 200 && importRes.json?.updated === true, JSON.stringify(importRes.json))
check('the update addresses the same challenge', importRes.json?.challengeId === challengeId, JSON.stringify(importRes.json))

// The level type is derived from the graph, never authored: a branching
// challenge reports `challenge`, a one-question one reports `single_question`.
const branch = { challengeId, type: importRes.json?.type }
check('branching challenge available', Boolean(branch.challengeId), JSON.stringify(branch))
check('import reports derived type = challenge', branch.type === 'challenge', String(branch.type))

// Broken flow import → 400 with itemized reasons (bad start + a cycle).
const broken = JSON.parse(JSON.stringify(fixture))
broken.id = 'broken_import'
broken.start = 'NOPE'
broken.questions.Q14.choices[0].next = 'Q12' // also a cycle
r = await req('POST', '/admin/challenges/import', broken)
check('broken import → 400 itemized', r.status === 400 && Array.isArray(r.json?.errors) && r.json.errors.length >= 2, JSON.stringify(r.json))
console.log('   errors:', r.json?.errors?.map(e => `${e.path}: ${e.message}`).join(' | '))

// A SECOND, independent rejection: an authored reveal table whose rows do not
// match its columns. The failed-import history asserted in the next stage must
// record both payloads — so this suite creates both of them itself instead of
// expecting rows an earlier run happened to leave behind.
const ragged = JSON.parse(JSON.stringify(fixture))
ragged.id = 'ragged_reveal_import'
ragged.questions.Q2.choices[0].reveal = {
  text: 'Conversion is flat across all four variants:',
  table: { columns: ['Variant', 'Conversion'], rows: [['Control', '3.0%', 'extra cell']] }
}
r = await req('POST', '/admin/challenges/import', ragged)
check('ragged reveal table → 400 naming the row',
  r.status === 400 && (r.json?.errors ?? []).some(e => `${e.path} ${e.message}`.includes('row 0')),
  JSON.stringify(r.json))
console.log('   errors:', r.json?.errors?.map(e => `${e.path}: ${e.message}`).join(' | '))

// The candidate library shows only active challenges.
r = await req('GET', '/challenges')
check('library lists active challenge', r.status === 200 && r.json.challenges.some(c => c.id === challengeId), JSON.stringify(r.json))

// ---------------------------------------------------------------------------
// Journey stage 2 — session mechanics (as the admin, no level involved): a
// session is sanitized on the way out, resumable, race-safe, and the answer key
// never crosses the wire anywhere in the run.
// ---------------------------------------------------------------------------
r = await req('POST', '/sessions', { challengeId })
check('start session → 201/200', r.status === 201 || r.status === 200, JSON.stringify(r.json))
const q = r.json.question
check('question sanitized (no stage/reveal/next/bestChoice/table/columns/rows)',
  ['"stage"', '"reveal"', '"next"', '"bestChoice"', '"columns"', '"rows"'].every(key => !JSON.stringify(r.json).includes(key)),
  JSON.stringify(r.json))
check('question has text + 3-4 choices', q?.text?.length > 0 && q.choices.length >= 3 && q.choices.length <= 4, JSON.stringify(q))
const sessionId = r.json.sessionId

// Resume: POST /sessions again returns the same in-progress session.
r = await req('POST', '/sessions', { challengeId })
check('starting again resumes (same sessionId)', r.json?.sessionId === sessionId && r.json.resumed === true, JSON.stringify(r.json))

// Exact accounting baseline: a resumed session may already carry path entries
// from an interrupted run. The finished recap must hold exactly those plus this
// run's answers — nothing lost, nothing duplicated.
r = await req('GET', `/sessions/${sessionId}`)
const answeredBefore = r.json?.answeredCount ?? 0

// Play choice 0 through to END.
let steps = 0
let last = null
while (steps < 300) {
  last = await req('POST', `/sessions/${sessionId}/answer`, { choiceIndex: 0 })
  steps++
  if (last.json?.status === 'completed') break
  if (last.status !== 200 || !last.json?.question) {
    check('answer loop', false, `step ${steps}: ${last.status} ${JSON.stringify(last.json)}`)
    break
  }
}
check('session completes via END', last?.json?.status === 'completed', JSON.stringify(last?.json))

r = await req('POST', `/sessions/${sessionId}/answer`, { choiceIndex: 99 })
check('answering a completed session → 409', r.status === 409, JSON.stringify(r.json))

// The recap: an ordered path of question/choice/reveal triplets, no scores.
r = await req('GET', `/sessions/${sessionId}/summary`)
check('summary → path of question/choice/reveal triplets',
  r.status === 200 && r.json.path.length === answeredBefore + steps &&
  r.json.path.every(p => p.questionText && p.choiceText && (p.reveal?.text || p.reveal?.table)),
  JSON.stringify(r.json).slice(0, 400))

// The fixture's Q2 answer carries an authored table, and this run walked it:
// the imported table must survive to the recap intact, prose included.
const tableEntry = r.json.path.find(p => p.reveal?.table)
check('an authored table reveal survives to the summary',
  Boolean(tableEntry) && tableEntry.reveal.table.columns.length >= 2 && tableEntry.reveal.table.rows.length >= 2,
  JSON.stringify(tableEntry).slice(0, 300))
check('a table reveal keeps its authored prose alongside it',
  typeof tableEntry?.reveal?.text === 'string' && tableEntry.reveal.text.length > 0,
  JSON.stringify(tableEntry).slice(0, 300))
check('the table arrives row-width-consistent',
  tableEntry.reveal.table.rows.every(row => row.length === tableEntry.reveal.table.columns.length),
  JSON.stringify(tableEntry.reveal.table))
check('a plain prose reveal still normalizes to { text }',
  r.json.path.some(p => typeof p.reveal?.text === 'string' && !p.reveal.table),
  JSON.stringify(r.json.path?.[0]).slice(0, 200))
console.log(`   summary steps: ${r.json?.path?.length}`)

// Failed-import history recorded both rejections from stage 1 — asserted by
// identity and by reason, so the suite is deterministic on a fresh database
// instead of depending on rows an earlier run happened to leave behind.
r = await req('GET', '/admin/imports')
const failedImports = r.json?.failedImports ?? []
const failedIds = failedImports.map(f => f.summary?.id)
check('failed imports history lists both rejected payloads',
  r.status === 200 && failedIds.includes('broken_import') && failedIds.includes('ragged_reveal_import'),
  `ids=${JSON.stringify(failedIds)}`)
const brokenEntry = failedImports.find(f => f.summary?.id === 'broken_import')
check('a rejected import keeps its itemized reasons and payload summary',
  Array.isArray(brokenEntry?.errors) && brokenEntry.errors.length >= 2 && brokenEntry.summary?.questionCount > 0,
  JSON.stringify(brokenEntry)?.slice(0, 300))

// Retire → the challenge leaves the candidate library; restore puts it back.
r = await req('PATCH', `/admin/challenges/${challengeId}/status`, { status: 'retired' })
check('retire → 200', r.status === 200 && r.json.status === 'retired', JSON.stringify(r.json))
r = await req('GET', '/challenges')
check('retired challenge hidden from library', r.status === 200 && !r.json.challenges.some(c => c.id === challengeId), JSON.stringify(r.json))
r = await req('PATCH', `/admin/challenges/${challengeId}/status`, { status: 'active' })
check('restore → 200 active', r.status === 200 && r.json.status === 'active', JSON.stringify(r.json))

// History protects content: a challenge that has been played cannot be deleted.
r = await req('DELETE', `/admin/challenges/${challengeId}`)
check('delete blocked with sessions → 409', r.status === 409, JSON.stringify(r.json))

// Concurrency: an answer either commits or conflicts — never lost, never
// applied twice. Two truly parallel calls yield one 200 and one 409; if the
// server happened to serialize them, both legitimately answer successive
// questions. Either way the recorded state must match the accepted answers.
r = await req('POST', '/sessions', { challengeId })
const raceSessionId = r.json.sessionId
const [answerA, answerB] = await Promise.all([
  req('POST', `/sessions/${raceSessionId}/answer`, { choiceIndex: 0 }),
  req('POST', `/sessions/${raceSessionId}/answer`, { choiceIndex: 1 })
])
check('parallel answers: no server errors, only 200/409',
  [answerA.status, answerB.status].every(s => s === 200 || s === 409),
  `got ${answerA.status}/${answerB.status} — ${JSON.stringify(answerA.json)} / ${JSON.stringify(answerB.json)}`)
r = await req('GET', `/sessions/${raceSessionId}`)
const accepted = [answerA, answerB].filter(a => a.status === 200)
check('parallel answers: state matches accepted answers (none lost, none duplicated)',
  r.status === 200 && r.json.answeredCount === accepted.length,
  `answeredCount=${r.json?.answeredCount}, accepted=${accepted.length} (${answerA.status}/${answerB.status})`)

// Drain the raced session so the database is left clean.
let cursor = answerA.status === 200 ? answerA : answerB
while (cursor.json && cursor.json.status !== 'completed' && cursor.json.question) {
  cursor = await req('POST', `/sessions/${raceSessionId}/answer`, { choiceIndex: 0 })
}
check('raced session finishes cleanly', cursor.json?.status === 'completed', JSON.stringify(cursor.json))

// Parallel starts converge to ONE in-progress session (partial unique index).
const [start1, start2] = await Promise.all([
  req('POST', '/sessions', { challengeId }),
  req('POST', '/sessions', { challengeId })
])
check('parallel starts converge to the same session',
  start1.json?.sessionId === start2.json?.sessionId,
  `${start1.status}/${start2.status} — ${JSON.stringify(start1.json)} / ${JSON.stringify(start2.json)}`)

// Answer responses carry no sessionId, so post to the converged one explicitly
// — otherwise the loop silently 404s after the first hop.
const convergedSessionId = start1.json.sessionId
cursor = start1
while (cursor.json && cursor.json.status !== 'completed' && cursor.json.question) {
  cursor = await req('POST', `/sessions/${convergedSessionId}/answer`, { choiceIndex: 0 })
}
check('converged session finishes cleanly', cursor.json?.status === 'completed', JSON.stringify(cursor.json))

// Field-visibility guarantee over EVERY candidate payload of the run so far:
// the answer key must never cross the wire, anywhere. This is the tested form
// of the rule — sanitizeQuestion strips it by construction, and any regression
// anywhere in the candidate API fails here.
const leak = candidatePayloads.find(p => p.text.includes('"bestChoice"'))
check('bestChoice never appears in any candidate payload (full-run sweep)',
  leak === undefined,
  leak ? `${leak.method} ${leak.path} → ${leak.text.slice(0, 300)}` : '')

// ---------------------------------------------------------------------------
// Journey stage 3 — the level path, as a fresh Product Design candidate:
// content → levels → gated start → play → score/XP → unlock → replay →
// rollups → badges. Then path ops, then the six-skill PD profile.
// ---------------------------------------------------------------------------
const singleQuestion = await importFixture(single)
check('single-question challenge available', Boolean(singleQuestion.challengeId), JSON.stringify(singleQuestion))
if (singleQuestion.type !== null) check('import reports derived type = single_question', singleQuestion.type === 'single_question', singleQuestion.type)

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

const level1 = await ensureLevel(1, challengeId, 'medium')
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

// A duplicate level number is rejected with a reason, not silently overwritten.
const duplicate = await req('POST', '/admin/levels', { number: 1, industryId, difficulty: 'easy', challengeId: singleQuestion.challengeId })
check('duplicate level number → 409 with a reason',
  duplicate.status === 409 && typeof duplicate.json?.error === 'string',
  JSON.stringify(duplicate.json))

// A fresh throwaway candidate, so unlock assertions start from zero.
const freshEmail = `e2e-pd-${Date.now()}@baaten.local`
r = await req('POST', '/auth/signup', { email: freshEmail, password: PASSWORD })
check('candidate signup', r.status === 201, JSON.stringify(r.json))

const roles = await req('GET', '/roles')
const productDesign = roles.json.roles.find(role => role.name === 'Product Design')
check('Product Design role available', Boolean(productDesign), JSON.stringify(roles.json))
r = await req('POST', '/auth/onboarding/role', { roleId: productDesign.id })
check('candidate role selected', r.status === 200, JSON.stringify(r.json))

// The path map for a brand-new player: numbered order, level 1 open, 2 locked.
let path = await req('GET', '/levels')
check('path map lists the levels in number order',
  path.status === 200 && path.json.levels[0].number === 1 && path.json.levels[1].number === 2,
  JSON.stringify(path.json.levels?.map(level => level.number)))
check('new player has level 1 unlocked', path.json.levels[0].progress.status === 'unlocked', JSON.stringify(path.json.levels[0].progress))
check('level 2 is locked until level 1 is passed', path.json.levels[1].progress.status === 'locked', JSON.stringify(path.json.levels[1].progress))
check('each level advertises 10 XP per best choice', path.json.levels[0].xpPerBest === 10, String(path.json.levels[0].xpPerBest))

// The skill profile starts empty for a fresh player — real endpoint, no fake
// zeros, and only the public vocabulary on the wire (no `stage`).
const emptySkills = await req('GET', '/progress/skills')
check('skill profile endpoint available',
  emptySkills.status === 200 && Array.isArray(emptySkills.json?.skills),
  JSON.stringify(emptySkills.json))
check('a new player has six unproven skills and no decisions',
  emptySkills.json?.decisions === 0 && emptySkills.json?.scenarios === 0 &&
  emptySkills.json?.skills?.length === 6 &&
  emptySkills.json?.skills?.every(skill => skill.proficiency === 'unproven' && skill.evidence === 'not yet observed'),
  JSON.stringify(emptySkills.json))
check('the skill payload speaks the public vocabulary only',
  !keysOf(emptySkills.json).has('stage'),
  `keys: ${[...keysOf(emptySkills.json)].join(', ')}`)

// Gating is enforced server-side, not just hidden in the UI — on both entry
// points: the level start route AND a level-tagged `POST /sessions`.
const lockedStart = await req('POST', `/levels/${level2.json.id}/start`)
check('starting a locked level → 403', lockedStart.status === 403, JSON.stringify(lockedStart.json))
const lockedDirect = await req('POST', '/sessions', { challengeId: singleQuestion.challengeId, levelId: level2.json.id })
check('a locked level cannot be credited via POST /sessions either → 403',
  lockedDirect.status === 403,
  JSON.stringify(lockedDirect.json))

// Play level 1 always picking the best choice — the benchmark path.
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

// Nothing internal ever reaches the candidate.
const leaked = INTERNAL_KEYS.filter(key => level1Run.seen.has(key))
check('no bestChoice/stage/next in candidate payloads', leaked.length === 0, `leaked: ${leaked.join(', ')}`)

// The reveal is the one thing that crosses over, exactly once, after the answer.
const startText = JSON.stringify(level1Run.started.json)
check('the question payload carries no reveal or authoring structure',
  ['"reveal"', '"bestChoice"', '"stage"', '"next"', '"table"', '"columns"', '"rows"'].every(key => !startText.includes(key)),
  startText.slice(0, 200))
check('a reveal does reach the candidate after answering', level1Run.seen.has('reveal'), [...level1Run.seen].join(', '))
// Every reveal arrives as a normalized block ({ text, table? }), never as a raw
// string. Table-bearing reveals are asserted in stage 2 above, which walks the
// branch that authors one — the best-choice path in this fixture is prose-only.
check('every reveal arrives as a normalized block',
  level1Run.reveals.length > 0 &&
  level1Run.reveals.every(rv => rv && typeof rv === 'object' && (typeof rv.text === 'string' || rv.table)),
  JSON.stringify(level1Run.reveals?.slice(0, 2)))

// The map reflects the pass: status, stored XP, and a one-click recap link.
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

// Replaying a passed level cannot farm XP.
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

// A single-question level: reaching END is the pass condition, even when wrong.
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

// Replaying it with the right choice improves the record but still adds no XP.
const rightRun = await playLevel(level2.json.id, single.questions, true)
const right = rightRun.last.json?.result
check('a correct single-question answer scores 10 XP and 3 stars',
  right.bestXp === 10 && right.bestStars === 3,
  JSON.stringify(right))
check('improving a level adds no XP', right.xpGained === 0, JSON.stringify(right))
check('credited XP stays at the first-pass value', right.xpEarned === 0, JSON.stringify(right))

// Progress rolls up XP, stars, accuracy, streaks and industries.
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
// Per-candidate rollup must count exactly the two levels this run passed. The
// industry's level total belongs to the admin's path, which may carry more
// levels than this suite created — so `completed` is asserted as the rollup's
// own consistency rule (passed all of them), never as a hardcoded total.
check('industry rollup counts both passed levels, with stars',
  industry.levelsPassed === 2 && industry.stars === 6,
  JSON.stringify(industry))
check('industry `completed` mirrors passed === total',
  industry.completed === (industry.levelsPassed === industry.levelsTotal),
  JSON.stringify(industry))

// Badges award off the path model — earned and not-yet-earned both asserted.
const badges = await req('GET', '/progress/badges')
const earned = new Set(badges.json.badges.filter(badge => badge.earned).map(badge => badge.id))
check('badges list is available', badges.status === 200, JSON.stringify(badges.json))
check('“first level” badge earned', earned.has('first-level'), [...earned].join(', '))
check('“industry completed” badge agrees with the industry rollup',
  earned.has('industry-explorer') === Boolean(industry.completed),
  `badge=${earned.has('industry-explorer')} rollup completed=${industry.completed} — earned: ${[...earned].join(', ')}`)
check('star badge not yet earned (needs 15 stars, we have 6)', !earned.has('star-collector'), [...earned].join(', '))
check('streak badge not yet earned', !earned.has('streak-7'), [...earned].join(', '))

// The session summary reports the score of the finished run.
const summary = await req('GET', `/sessions/${level1Run.sessionId}/summary`)
check('summary is readable', summary.status === 200, JSON.stringify(summary.json))
check('summary carries the level number', summary.json.levelNumber === 1, String(summary.json.levelNumber))
check('summary reports hits/answered/xp/stars',
  summary.json.score.hits === 9 && summary.json.score.answered === 9 && summary.json.score.xp === 90 && summary.json.score.stars === 3,
  JSON.stringify(summary.json.score))
check('summary still returns the readable path', summary.json.path.length === 9, String(summary.json.path?.length))

// The gate DERIVES from passed rows: a level created after the fact is playable
// as soon as every active level before it is passed, and retiring a level
// re-routes the path instead of stranding anyone on a stale unlock row.
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
  // Reuse whatever level occupies number 3 (the path may have grown since this
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

// Back to the candidate: levels 1 and 2 are behind them, so level 3 must open
// even though 2 was retired and its own unlock row is now irrelevant.
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

// The skill profile after real runs: six Product Design skills, real evidence,
// fixed process order, and still no authoring internals on the wire.
const skills = await req('GET', '/progress/skills')
check('skill profile reflects the runs played',
  skills.status === 200 && skills.json?.scenarios >= 3 && skills.json?.decisions >= 10,
  JSON.stringify({ scenarios: skills.json?.scenarios, decisions: skills.json?.decisions }))
check('all six skills present in process order',
  skills.json?.skills?.map(skill => skill.id).join(',') === 'framing,research,synthesis,ideation,solution,validation',
  JSON.stringify(skills.json?.skills?.map(skill => skill.id)))
const evidenced = (skills.json?.skills ?? []).filter(skill => skill.count > 0)
check('skills carry evidence in the report line format',
  evidenced.length > 0 && evidenced.every(skill => /^\d+ of \d+ strongest calls/.test(skill.evidence)),
  JSON.stringify(skills.json?.skills?.map(skill => [skill.id, skill.evidence])))
check('proficiencies stay within the declared bands',
  skills.json?.skills?.every(skill => ['strong', 'developing', 'emerging', 'unproven'].includes(skill.proficiency)),
  JSON.stringify(skills.json?.skills?.map(skill => [skill.id, skill.proficiency])))
check('the strongest-run skills are visibly strong',
  evidenced.every(skill => (skill.rate >= 0.75 && skill.count >= 3) === (skill.proficiency === 'strong')),
  JSON.stringify(skills.json?.skills?.map(skill => [skill.id, skill.rate, skill.count, skill.proficiency])))
const skillLeaks = INTERNAL_KEYS.filter(key => keysOf(skills.json).has(key))
check('the skill payload exposes no authoring internals', skillLeaks.length === 0, `leaked: ${skillLeaks.join(', ')}`)

// Restore what this suite rearranged, so it never changes the shape of the
// admin's path as a side effect.
await req('POST', '/auth/login', { email: 'admin@baaten.local', password: 'admin123' })
const restore2 = await req('PATCH', `/admin/levels/${level2.json.id}`, { status: 'active' })
check('level 2 restored', restore2.status === 200 && restore2.json.status === 'active', JSON.stringify(restore2.json))

if (level3PriorStatus && level3PriorStatus !== 'active') {
  const back = await req('PATCH', `/admin/levels/${level3.json.id}`, { status: level3PriorStatus })
  check('level 3 returned to its prior status', back.status === 200 && back.json.status === level3PriorStatus, JSON.stringify(back.json))
}
if (level3ChallengePriorStatus && level3ChallengePriorStatus !== 'active' && level3ChallengeId) {
  await req('PATCH', `/admin/challenges/${level3ChallengeId}/status`, { status: level3ChallengePriorStatus })
}

console.log(failures === 0 ? '\nALL PRODUCT DESIGN E2E CHECKS PASSED' : `\n${failures} PRODUCT DESIGN E2E CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
