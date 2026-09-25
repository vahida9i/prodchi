/* Rebuild the dev path: import the authored scenarios and lay them out as levels.
 *
 * The seed creates roles, the admin, industries and badges — content and the path
 * are normally built by hand through the admin UI, which is how a dev path drifts
 * (stale clones, retired probes, gaps in the numbering). This is the repeatable
 * version of that hand-work: every fixture goes through the REAL import endpoint,
 * so the graph validator and the authoring rules judge it exactly as the admin
 * panel would, and each one lands on a level.
 *
 * Idempotent: re-importing updates a challenge in place (the import is keyed on
 * the fixture's `id`), and a level is only created when its slot is free. A slot
 * it cannot claim is reported instead of overwritten — this never edits a path
 * the operator built by hand.
 *
 * Usage: pnpm db:reset-content    (API running; admin creds come from the root .env)
 *
 * Locale: APP_LOCALE picks the content set. An `fa` deployment loads a
 * COMPLETELY SEPARATE fixture directory (docs/fixtures/fa) with its own path
 * layout below — independent Farsi content, never a translation of the English
 * files, and never a silent fallback in either direction: a missing directory
 * or file aborts before anything touches the network.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// tsx/node do not read .env on their own; the root .env is where ADMIN_SEED_*,
// APP_LOCALE and PORT live (same pattern as packages/db/seed.ts).
for (const path of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../.env')]) {
  if (existsSync(path)) {
    process.loadEnvFile(path)
    break
  }
}

const BASE = process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 4000}/api/v1`
const EMAIL = process.env.ADMIN_SEED_EMAIL ?? 'admin@prodchi.local'
const PASSWORD = process.env.ADMIN_SEED_PASSWORD ?? 'admin123'
const LOCALE = (process.env.APP_LOCALE || process.env.NEXT_PUBLIC_APP_LOCALE || 'en') === 'fa' ? 'fa' : 'en'
const FIXTURE_DIR = fileURLToPath(
  new URL(LOCALE === 'fa' ? '../docs/fixtures/fa' : '../docs/fixtures', import.meta.url)
)

/**
 * The path, in play order: one scenario per industry, easiest first. Difficulty
 * comes from the fixture itself, so a level can never disagree with its content.
 * `single-question-sample.json` is deliberately absent — it is the quick-call
 * sample the e2e suites import, not path content.
 */
const PATH_EN = [
  // Product Design track (existing)
  { file: 'clinic-booking.json', industry: 'Health' },
  { file: 'kyc-drop-off.json', industry: 'Fintech' },
  { file: 'onboarding-drop-off.json', industry: 'E-commerce' },
  { file: 'saas-pricing-rework.json', industry: 'SaaS' },
  // Product Management track (existing + new)
  { file: 'pm_checkout_abandonment.json', industry: 'E-commerce' },
  { file: 'pm_unused_feature.json', industry: 'Productivity' },
  { file: 'pm_pricing_split.json', industry: 'SaaS' },
  { file: 'pm-feature-cut.json', industry: 'Productivity' },
  { file: 'pm_growth_plateau.json', industry: 'Health' },
  { file: 'pm_enterprise_migration.json', industry: 'Enterprise' }
]

/**
 * Farsi path: its own files, its own order, its own ids — nothing here maps to
 * the English fixtures. `industry` values are the names seeded by
 * packages/db/seed.ts when APP_LOCALE=fa (the name is both the unique key and
 * the label candidates see). Grow this list as Farsi scenarios are authored.
 */
const PATH_FA = [
  { file: 'fa_search_empty_state.json', industry: 'خرده‌فروشی آنلاین' },
  { file: 'fa_infra_cost_squeeze.json', industry: 'سرویس ابری' }
]

const PATH = LOCALE === 'fa' ? PATH_FA : PATH_EN

// Fail fast, before touching the network: the chosen locale's directory and
// every file the layout names must exist. A missing Farsi set on an fa
// deployment (or vice versa) aborts here rather than seeding wrong-language
// content.
if (!existsSync(FIXTURE_DIR)) {
  console.error(`Fixture directory for locale "${LOCALE}" not found: ${FIXTURE_DIR}`)
  process.exit(1)
}
for (const entry of PATH) {
  if (!existsSync(`${FIXTURE_DIR}/${entry.file}`)) {
    console.error(`Fixture "${entry.file}" (locale "${LOCALE}") not found in ${FIXTURE_DIR}`)
    process.exit(1)
  }
}

console.log(`Path content (locale: ${LOCALE} → ${FIXTURE_DIR})`)

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
function fail(message) {
  failures++
  console.error(`  ! ${message}`)
}

const login = await req('POST', '/auth/login', { email: EMAIL, password: PASSWORD })
if (login.status !== 200) {
  console.error(`Cannot sign in as ${EMAIL} at ${BASE} (${login.status}). Is the API running and seeded?`)
  process.exit(1)
}

const industries = (await req('GET', '/admin/industries')).json?.industries ?? []
const existing = (await req('GET', '/admin/levels')).json?.levels ?? []
const levelByNumber = new Map(existing.map(level => [level.number, level]))
const levelByChallenge = new Map(existing.map(level => [level.challenge.id, level]))

console.log(`→ ${BASE}\n`)

for (const [index, entry] of PATH.entries()) {
  const number = index + 1
  const fixture = JSON.parse(readFileSync(`${FIXTURE_DIR}/${entry.file}`, 'utf-8'))

  const imported = await req('POST', '/admin/challenges/import', fixture)
  if (imported.status !== 200 && imported.status !== 201) {
    fail(`${fixture.title}: import rejected — ${JSON.stringify(imported.json)}`)
    continue
  }
  const challengeId = imported.json.challengeId
  console.log(`  ${fixture.title} — ${imported.status === 201 ? 'imported' : 'refreshed in place'}`)

  const placed = levelByChallenge.get(challengeId)
  if (placed) {
    console.log(`    = already level ${placed.number}, left alone`)
    continue
  }
  const occupied = levelByNumber.get(number)
  if (occupied) {
    fail(`level ${number} is taken by "${occupied.challenge.title}" — ${fixture.title} has no slot`)
    continue
  }
  // `let`, not `const`: the recovery branch below reassigns it when a missing
  // industry is re-fetched, so a const here throws on exactly that path.
  let industry = industries.find(row => row.name === entry.industry)
  if (!industry) {
    // Try re-fetching industries in case they were just seeded
    console.log(`  ⚠ Industry "${entry.industry}" not found, re-fetching...`)
    const refreshedIndustries = (await req('GET', '/admin/industries')).json?.industries ?? []
    const refreshed = refreshedIndustries.find(row => row.name === entry.industry)
    if (refreshed) {
      industries.push(refreshed) // Add to cache
      industry = refreshed // Use the refreshed one
    } else {
      fail(`industry "${entry.industry}" is not seeded — run pnpm db:seed first (industries are seeded per APP_LOCALE="${LOCALE}"; re-seed after switching locales)`)
      continue
    }
  }

  const created = await req('POST', '/admin/levels', {
    number,
    industryId: industry.id,
    difficulty: fixture.difficulty,
    challengeId
  })
  if (created.status !== 201) {
    fail(`level ${number} not created — ${JSON.stringify(created.json)}`)
    continue
  }
  console.log(`    → level ${number} · ${entry.industry} · ${fixture.difficulty} · ${created.json.type}`)
}

// Report the whole inventory — path plus every challenge, retired ones included —
// so drift is visible in the output rather than only in the database.
const levels = ((await req('GET', '/admin/levels')).json?.levels ?? []).sort((a, b) => a.number - b.number)
const challenges = (await req('GET', '/admin/challenges')).json?.challenges ?? []

console.log(`\nPath (${levels.length} levels):`)
for (const level of levels) {
  console.log(`  ${level.number}. ${level.challenge.title} — ${level.industry.name} · ${level.difficulty} · ${level.status}`)
}
console.log(`\nChallenges on file (${challenges.length}):`)
for (const challenge of challenges) {
  console.log(`  - ${challenge.title} — ${challenge.importKey} · ${challenge.status}`)
}
if (levels.length !== PATH.length) {
  console.log(`\nNote: the path has ${levels.length} levels; ${PATH.length} are described here.`)
}

console.log(failures === 0 ? '\nPath content is ready.' : `\n${failures} problem(s) — nothing was overwritten.`)
process.exit(failures === 0 ? 0 : 1)
