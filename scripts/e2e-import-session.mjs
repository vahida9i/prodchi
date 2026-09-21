/* End-to-end verification of the redesigned import + session flow. */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const BASE = 'http://localhost:4000/api/v1'
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

// 1. login as admin
let r = await req('POST', '/auth/login', { email: 'admin@baaten.local', password: 'admin123' })
check('admin login', r.status === 200, JSON.stringify(r.json))

// 2. import the fixture (paste-JSON contract). The endpoint is idempotent on
// `id`: the first import creates the challenge, and every later import of the
// same id UPDATES it in place — that is the content-update workflow, so no
// challenge ever has to be deleted (and cannot be, once it has sessions).
const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL('../docs/fixtures/onboarding-drop-off.json', import.meta.url)), 'utf-8')
)
let importRes = await req('POST', '/admin/challenges/import', fixture)
let challengeId = importRes.json?.challengeId

check('import fixture → 201 created (or 200 when it already existed)',
  (importRes.status === 201 || importRes.status === 200) && importRes.json?.updated === (importRes.status === 200) && Boolean(challengeId),
  JSON.stringify(importRes.json))

// 3. re-importing the same id updates in place: same challenge, no duplicate,
// no delete — and it is the only way content changes reach live challenges.
importRes = await req('POST', '/admin/challenges/import', fixture)
check('re-import updates in place → 200 with updated=true',
  importRes.status === 200 && importRes.json?.updated === true, JSON.stringify(importRes.json))
check('the update addresses the same challenge', importRes.json?.challengeId === challengeId, JSON.stringify(importRes.json))

// 4. broken flow import → 400 with itemized reasons
const broken = JSON.parse(JSON.stringify(fixture))
broken.id = 'broken_import'
broken.start = 'NOPE'
broken.questions.Q14.choices[0].next = 'Q12' // also a cycle
r = await req('POST', '/admin/challenges/import', broken)
check('broken import → 400 itemized', r.status === 400 && Array.isArray(r.json?.errors) && r.json.errors.length >= 2, JSON.stringify(r.json))
console.log('   errors:', r.json?.errors?.map(e => `${e.path}: ${e.message}`).join(' | '))

// 4b. a SECOND, independent rejection: an authored reveal table whose rows do
// not match its columns. The failed-import history asserted in step 11 must
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

// 5. candidate library shows only active challenges
r = await req('GET', '/challenges')
check('library lists active challenge', r.status === 200 && r.json.challenges.some(c => c.id === challengeId), JSON.stringify(r.json))

// 6. start a session — question must be sanitized
r = await req('POST', '/sessions', { challengeId })
check('start session → 201/200', r.status === 201 || r.status === 200, JSON.stringify(r.json))
const q = r.json.question
check('question sanitized (no stage/reveal/next/bestChoice/table anywhere)',
  JSON.stringify(r.json).includes('"stage"') === false &&
  JSON.stringify(r.json).includes('"reveal"') === false &&
  JSON.stringify(r.json).includes('"next"') === false &&
  JSON.stringify(r.json).includes('"bestChoice"') === false &&
  JSON.stringify(r.json).includes('"columns"') === false &&
  JSON.stringify(r.json).includes('"rows"') === false,
  JSON.stringify(r.json))
check('question has text + 3-4 choices', q?.text?.length > 0 && q.choices.length >= 3 && q.choices.length <= 4, JSON.stringify(q))
const sessionId = r.json.sessionId

// 7. resume: POST /sessions again returns the same session
r = await req('POST', '/sessions', { challengeId })
check('starting again resumes (same sessionId)', r.json?.sessionId === sessionId && r.json.resumed === true, JSON.stringify(r.json))

// Exact accounting baseline: a resumed session may already carry path entries
// from an interrupted earlier run. The finished summary must hold exactly those
// plus this run's answers — nothing lost, nothing duplicated.
r = await req('GET', `/sessions/${sessionId}`)
const answeredBefore = r.json?.answeredCount ?? 0

// 8. play choice 0 through to END
let steps = 0
let last = null
while (steps < 30) {
  last = await req('POST', `/sessions/${sessionId}/answer`, { choiceIndex: 0 })
  steps++
  if (last.json?.status === 'completed') break
  if (last.status !== 200 || !last.json?.question) {
    check('answer loop', false, `step ${steps}: ${last.status} ${JSON.stringify(last.json)}`)
    break
  }
}
check('session completes via END', last?.json?.status === 'completed', JSON.stringify(last?.json))

// 9. invalid choice index rejected
r = await req('POST', `/sessions/${sessionId}/answer`, { choiceIndex: 99 })
check('answering a completed session → 409', r.status === 409, JSON.stringify(r.json))

// 10. summary — full recap, no scores
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

// 11. failed-import history recorded both rejections from step 4/4b — checked by
// identity and by their reasons, so the suite is deterministic on a fresh
// database instead of depending on rows left over from an earlier run.
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

// 12. retire → challenge leaves the candidate library
r = await req('PATCH', `/admin/challenges/${challengeId}/status`, { status: 'retired' })
check('retire → 200', r.status === 200 && r.json.status === 'retired', JSON.stringify(r.json))
r = await req('GET', '/challenges')
check('retired challenge hidden from library', r.status === 200 && !r.json.challenges.some(c => c.id === challengeId), JSON.stringify(r.json))

// 13. restore
r = await req('PATCH', `/admin/challenges/${challengeId}/status`, { status: 'active' })
check('restore → 200 active', r.status === 200 && r.json.status === 'active', JSON.stringify(r.json))

// 14. delete blocked because sessions exist
r = await req('DELETE', `/admin/challenges/${challengeId}`)
check('delete blocked with sessions → 409', r.status === 409, JSON.stringify(r.json))

// 15. concurrent answers: exactly one wins, the other conflicts (optimistic concurrency)
r = await req('POST', '/sessions', { challengeId })
const raceSessionId = r.json.sessionId
const [answerA, answerB] = await Promise.all([
  req('POST', `/sessions/${raceSessionId}/answer`, { choiceIndex: 0 }),
  req('POST', `/sessions/${raceSessionId}/answer`, { choiceIndex: 1 })
])
// 15. concurrent answers: the compare-and-swap guard means an answer either
// commits or conflicts — it is never lost and never applied twice. Two truly
// parallel calls yield exactly one 200 and one 409; if the server happened to
// serialize them, both legitimately answer successive questions. Either way the
// recorded state must match the accepted answers exactly.
const accepted = [answerA, answerB].filter(a => a.status === 200)
check('parallel answers: no server errors, only 200/409',
  [answerA.status, answerB.status].every(s => s === 200 || s === 409),
  `got ${answerA.status}/${answerB.status} — ${JSON.stringify(answerA.json)} / ${JSON.stringify(answerB.json)}`)
r = await req('GET', `/sessions/${raceSessionId}`)
check('parallel answers: state matches accepted answers (none lost, none duplicated)',
  r.status === 200 && r.json.answeredCount === accepted.length,
  `answeredCount=${r.json?.answeredCount}, accepted=${accepted.length} (${answerA.status}/${answerB.status})`)

// drain the raced session to END so the DB is left clean
let cursor = answerA.status === 200 ? answerA : answerB
while (cursor.json && cursor.json.status !== 'completed' && cursor.json.question) {
  cursor = await req('POST', `/sessions/${raceSessionId}/answer`, { choiceIndex: 0 })
}
check('raced session finishes cleanly', cursor.json?.status === 'completed', JSON.stringify(cursor.json))

// 16. concurrent session starts converge to ONE in-progress session (partial unique index)
const [start1, start2] = await Promise.all([
  req('POST', '/sessions', { challengeId }),
  req('POST', '/sessions', { challengeId })
])
check('parallel starts converge to the same session',
  start1.json?.sessionId === start2.json?.sessionId,
  `${start1.status}/${start2.status} — ${JSON.stringify(start1.json)} / ${JSON.stringify(start2.json)}`)

// drain the converged session. Answer responses carry no sessionId, so post to
// the converged one explicitly — otherwise the loop silently 404s after the
// first hop and leaves the session in progress.
const convergedSessionId = start1.json.sessionId
cursor = start1
while (cursor.json && cursor.json.status !== 'completed' && cursor.json.question) {
  cursor = await req('POST', `/sessions/${convergedSessionId}/answer`, { choiceIndex: 0 })
}
check('converged session finishes cleanly', cursor.json?.status === 'completed', JSON.stringify(cursor.json))

// 17. field-visibility guarantee over EVERY candidate payload of the run: the
// answer key (`bestChoice`) must never cross the wire, anywhere. This is the
// tested form of the rule — sanitizeQuestion strips it by construction, and any
// regression anywhere in the candidate API fails here.
const leak = candidatePayloads.find(p => p.text.includes('"bestChoice"'))
check('bestChoice never appears in any candidate payload (full-run sweep)',
  leak === undefined,
  leak ? `${leak.method} ${leak.path} → ${leak.text.slice(0, 300)}` : '')

console.log(failures === 0 ? '\nALL E2E CHECKS PASSED' : `\n${failures} E2E CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)