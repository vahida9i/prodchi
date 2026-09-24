/* End-to-end verification of the PRODUCT MANAGEMENT track — the complete journey.
 *
 *   roles seed → PM import (idempotent) → level assignment → role isolation →
 *   session play (sanitized, resumable) → PM-labeled feedback →
 *   the 7-skill Product Management profile
 *
 * Requires the API running on :4000 and a scratch database (seed applied).
 * Mirrors e2e-product-design.mjs: one suite per role track, both complete
 * journeys. The PM suite adds the two things only two roles make testable —
 * role isolation and the PM skill vocabulary.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const BASE = 'http://localhost:4000/api/v1'
const FIXTURE_DIR = fileURLToPath(new URL('../../docs/fixtures', import.meta.url))
const PASSWORD = 'e2e-password-123'

const pmFixture = JSON.parse(readFileSync(`${FIXTURE_DIR}/pm-feature-cut.json`, 'utf-8'))

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

/** Signup + onboarding as a candidate of the given role track. */
async function signupAs(roleName) {
  const stamp = Date.now() + Math.random().toString(36).slice(2, 8)
  const email = `pm-e2e-${stamp}@prodchi.test`
  const signup = await req('POST', '/auth/signup', { email, password: PASSWORD })
  if (signup.status !== 201) throw new Error(`signup failed: ${JSON.stringify(signup.json)}`)
  const roles = await req('GET', '/roles')
  const role = roles.json?.roles?.find(r => r.name === roleName)
  if (!role) throw new Error(`role ${roleName} not seeded: ${JSON.stringify(roles.json)}`)
  await req('POST', '/auth/onboarding/role', { roleId: role.id })
  return email
}

/** Play a level start-to-END. `chooseBest` false always picks the next choice along. */
async function playLevel(levelId, questions, chooseBest = true) {
  const started = await req('POST', `/levels/${levelId}/start`)
  if (started.status !== 200 && started.status !== 201) return { started, answers: 0, last: started }
  const sessionId = started.json.sessionId
  let question = started.json.question
  let answers = 0
  let last = started
  while (question && answers < 300) {
    const best = questions[question.key]?.bestChoice ?? 0
    const choiceIndex = chooseBest ? best : (best + 1) % question.choices.length
    last = await req('POST', `/sessions/${sessionId}/answer`, { choiceIndex })
    question = last.json?.question
    answers++
  }
  return { started, answers, last }
}

const stamp = Date.now()

// 1. seed seam: both role tracks are live
let r = await req('POST', '/auth/login', { email: 'admin@prodchi.local', password: 'admin123' })
check('admin login', r.status === 200, JSON.stringify(r.json))

r = await req('GET', '/roles')
const roleNames = (r.json?.roles ?? []).map(role => role.name)
check('both role tracks are seeded and exposed',
  roleNames.includes('Product Design') && roleNames.includes('Product Management'),
  JSON.stringify(roleNames))

// 2. import seam: the PM fixture resolves its role row by name
const imported = await importFixture(pmFixture)
check('PM challenge imports through the real endpoint', Boolean(imported.challengeId), 'no challenge id')
if (imported.type !== null) {
  check('PM challenge derives a level type', ['challenge', 'single_question'].includes(imported.type), String(imported.type))
}

// Re-importing the same id updates in place: same challenge, no duplicate, no
// delete. This is the only way PM content changes reach the live challenge.
const reimport = await req('POST', '/admin/challenges/import', pmFixture)
check('re-importing PM content updates in place → 200 with updated=true',
  reimport.status === 200 && reimport.json?.updated === true && reimport.json?.challengeId === imported.challengeId,
  JSON.stringify(reimport.json))

// 3. assign it to a fresh level number
const levels = (await req('GET', '/admin/levels')).json?.levels ?? []
const usedNumbers = new Set(levels.map(level => level.number))
let freeNumber = 1
while (usedNumbers.has(freeNumber)) freeNumber++
const pmLevelPrior = levels.find(level => level.challenge?.id === imported.challengeId)

// A level is always a challenge wrapped with an industry and a difficulty —
// `POST /admin/levels` takes the industry's id, not its name.
const industries = (await req('GET', '/admin/industries')).json?.industries ?? []
const pmIndustry = industries.find(industry => industry.name === 'Productivity') ?? industries[0]
check('the PM industry is available to place the level in', Boolean(pmIndustry?.id), JSON.stringify(industries))

let pmLevel
if (pmLevelPrior) {
  pmLevel = pmLevelPrior
  check('PM challenge already sits on a level', true, pmLevelPrior.number)
} else {
  const created = await req('POST', '/admin/levels', {
    number: freeNumber,
    industryId: pmIndustry.id,
    difficulty: pmFixture.difficulty,
    challengeId: imported.challengeId
  })
  check('PM challenge assigned to a level', created.status === 201, JSON.stringify(created.json))
  pmLevel = created.json
}

// 4. isolation seam: the PD path does not expose the PM level
const pdEmail = await signupAs('Product Design')
r = await req('GET', '/levels')
const pdLevelIds = new Set((r.json?.levels ?? []).map(level => level.id))
check('a PD candidate does not see the PM level on their path',
  !pdLevelIds.has(pmLevel.id),
  JSON.stringify([...pdLevelIds]))

// 5. the PM candidate sees exactly their role's content and plays it to END
const pmEmail = await signupAs('Product Management')
r = await req('GET', '/levels')
const pmLevels = r.json?.levels ?? []
check('the PM candidate sees the PM level on their path',
  pmLevels.some(level => level.id === pmLevel.id),
  JSON.stringify(pmLevels.map(level => level.number)))
check('the PM candidate does not see PD-only levels',
  pmLevels.every(level => !pdLevelIds.has(level.id) || pmLevel.id === level.id),
  'PM path overlaps the PD candidate path')

// Opening the level starts a session; opening it again resumes that same one,
// and the question payload is sanitized on the way out — same contract as any
// other track, since the session engine is role-agnostic.
// The gate must be role-scoped: the PM level sits at a number after the PD
// suite's levels, so an unscoped gate would lock this PM candidate behind
// Product Design progress they can never see. Opening here is the regression
// guard for exactly that.
const opened = await req('POST', `/levels/${pmLevel.id}/start`)
check('the PM level opens a session', opened.status === 201 || opened.status === 200, JSON.stringify(opened.json))
check('the PM question payload is sanitized',
  ['"stage"', '"reveal"', '"next"', '"bestChoice"'].every(key => !JSON.stringify(opened.json).includes(key)),
  JSON.stringify(opened.json).slice(0, 200))
const reopened = await req('POST', `/levels/${pmLevel.id}/start`)
check('re-opening the PM level resumes the same session',
  reopened.json?.sessionId === opened.json?.sessionId && reopened.json?.resumed === true,
  JSON.stringify({ opened: opened.json?.sessionId, reopened: reopened.json?.sessionId, flag: reopened.json?.resumed }))

const played = await playLevel(pmLevel.id, pmFixture.questions, true)
check('the PM run reaches END', played.last.json?.status === 'completed', JSON.stringify(played.last.json))

// 6. the finished run's feedback speaks the PM process vocabulary
r = await req('GET', `/sessions/${played.started.json.sessionId}/summary`)
const feedback = r.json?.feedback
check('the PM summary carries a frozen feedback report', Boolean(feedback), JSON.stringify(r.json).slice(0, 200))
const areas = [...(feedback?.strengths ?? []), ...(feedback?.growth ?? [])].map(area => area.area)
const PM_LABELS = ['Framing the problem', 'Diagnosing the cause', 'Setting the direction',
  'Prioritizing the work', 'Planning the roadmap', 'Executing and shipping', 'Measuring the outcome']
const PD_LABELS = ['Digging into evidence', 'Defining the problem', 'Generating options',
  'Designing the solution', 'Validating with users']
check('the report areas use PM labels only', areas.length > 0 && areas.every(area => PM_LABELS.includes(area)),
  JSON.stringify(areas))
check('no PD label leaks into the PM report', !areas.some(area => PD_LABELS.includes(area)),
  JSON.stringify(areas))
const summaryKeys = keysOf(r.json)
const summaryLeaks = INTERNAL_KEYS.filter(key => summaryKeys.has(key))
check('the PM summary exposes no authoring internals', summaryLeaks.length === 0, `leaked: ${summaryLeaks.join(', ')}`)

// 7. profile seam: the 7 PM skills, in process order, with evidence
r = await req('GET', '/progress/skills')
const skills = r.json?.skills ?? []
check('the PM skill profile carries the seven PM skills in process order',
  skills.map(skill => skill.id).join(',') === 'framing,diagnosis,strategy,prioritization,planning,execution,measurement',
  JSON.stringify(skills.map(skill => skill.id)))
const evidenced = skills.filter(skill => skill.count > 0)
check('played skills carry evidence in the report line format',
  evidenced.length > 0 && evidenced.every(skill => /^\d+ of \d+ strongest calls/.test(skill.evidence)),
  JSON.stringify(skills.map(skill => [skill.id, skill.count, skill.evidence])))
check('proficiencies stay within the declared bands',
  skills.every(skill => ['strong', 'developing', 'emerging', 'unproven'].includes(skill.proficiency)),
  JSON.stringify(skills.map(skill => [skill.id, skill.proficiency])))
const skillLeaks = INTERNAL_KEYS.filter(key => keysOf(r.json).has(key))
check('the skill payload exposes no authoring internals', skillLeaks.length === 0, `leaked: ${skillLeaks.join(', ')}`)

// 8. the role select is revisitable, and EVERYTHING follows a switch — path,
// progress (XP/levels/stars/streak), badges and the skill profile are strictly
// per-track, never aggregated across roles.
r = await req('GET', '/progress')
check('PM progress is readable before the switch', r.status === 200, JSON.stringify(r.json).slice(0, 200))
const pmProgress = r.json ?? {}
check('the PM candidate earned XP on the PM track', (pmProgress.totalXp ?? 0) > 0, JSON.stringify(pmProgress))
const pmIndustries = (pmProgress.industries ?? []).map(industry => industry.name)
check('the PM dashboard lists only PM-track industries',
  pmIndustries.includes('Productivity') && !pmIndustries.includes('E-commerce'),
  JSON.stringify(pmIndustries))
r = await req('GET', '/progress/badges')
const pmEarnedIds = new Set((r.json?.badges ?? []).filter(badge => badge.earned).map(badge => badge.id))
check('the PM candidate earned a badge on the PM track', pmEarnedIds.size > 0, JSON.stringify([...pmEarnedIds]))

const rolesRes = await req('GET', '/roles')
const pdRole = rolesRes.json?.roles?.find(role => role.name === 'Product Design')
const pmRole = rolesRes.json?.roles?.find(role => role.name === 'Product Management')
check('both role ids resolve for the switch', Boolean(pdRole && pmRole), JSON.stringify(rolesRes.json))

r = await req('POST', '/auth/onboarding/role', { roleId: pmRole.id })
check('re-selecting the current role → 200 (no-op)', r.status === 200, JSON.stringify(r.json))

r = await req('POST', '/auth/onboarding/role', { roleId: pdRole.id })
check('switching the role → 200', r.status === 200, JSON.stringify(r.json))

// The path flips to the other track immediately (cookie re-issued with it).
r = await req('GET', '/levels')
const switchedLevels = r.json?.levels ?? []
check('after the switch the PM level is gone from the path',
  !switchedLevels.some(level => level.id === pmLevel.id),
  JSON.stringify(switchedLevels.map(level => level.number)))
check('after the switch the path shows exactly the PD track',
  switchedLevels.length > 0 && switchedLevels.every(level => pdLevelIds.has(level.id)),
  JSON.stringify(switchedLevels.map(level => level.id)))

// Progress is per-track: the PM candidate's fresh PD dashboard aggregates nothing.
r = await req('GET', '/progress')
const pdProgress = r.json ?? {}
check('PM-track XP/stars/streak do not follow the switch',
  pdProgress.totalXp === 0 && pdProgress.levelsPassed === 0 && pdProgress.totalStars === 0 &&
  (pdProgress.streak?.currentStreak ?? 0) === 0,
  JSON.stringify(pdProgress))

r = await req('GET', '/progress/badges')
const pdEarnedIds = (r.json?.badges ?? []).filter(badge => badge.earned).map(badge => badge.id)
check('a badge earned on the PM track does not show on the PD track',
  pdEarnedIds.every(id => !pmEarnedIds.has(id)),
  JSON.stringify({ pm: [...pmEarnedIds], pd: pdEarnedIds }))

r = await req('GET', '/progress/skills')
const switchedSkills = r.json?.skills ?? []
check('after the switch the profile is the PD seven, in process order',
  switchedSkills.map(skill => skill.id).join(',') === 'framing,discovery,synthesis,ideation,solution,testing,refinement',
  JSON.stringify(switchedSkills.map(skill => skill.id)))
check('the fresh track reads unproven — PM decisions score nothing for PD',
  r.json?.decisions === 0 && switchedSkills.every(skill => skill.proficiency === 'unproven'),
  JSON.stringify({ decisions: r.json?.decisions, proficiencies: switchedSkills.map(skill => skill.proficiency) }))

// Switching back restores the PM dashboard exactly — nothing was lost or merged.
r = await req('POST', '/auth/onboarding/role', { roleId: pmRole.id })
check('switching back → 200', r.status === 200, JSON.stringify(r.json))
r = await req('GET', '/progress')
check('switching back restores the PM dashboard exactly',
  r.json?.totalXp === pmProgress.totalXp &&
  r.json?.levelsPassed === pmProgress.levelsPassed &&
  r.json?.totalStars === pmProgress.totalStars,
  JSON.stringify({
    now: { xp: r.json?.totalXp, passed: r.json?.levelsPassed, stars: r.json?.totalStars },
    before: { xp: pmProgress.totalXp, passed: pmProgress.levelsPassed, stars: pmProgress.totalStars }
  }))

// cleanup: restore any level state the suite changed
if (pmLevelPrior && pmLevelPrior.status && pmLevelPrior.status !== 'active') {
  const back = await req('PATCH', `/admin/levels/${pmLevel.id}`, { status: pmLevelPrior.status })
  check('the PM level returned to its prior status', back.status === 200, JSON.stringify(back.json))
}

console.log(failures === 0 ? '\nALL PRODUCT-MANAGEMENT CHECKS PASSED' : `\n${failures} PRODUCT-MANAGEMENT CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
