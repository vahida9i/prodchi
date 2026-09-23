# Baaten — Challenge Import, Session & Progression App

A product-design skill-practice app: admins import branching scenario challenges as JSON, candidates play them one question at a time along a numbered level path, and the finished reasoning path is viewable as a recap with the run's score. The app **consumes, runs, and tracks** challenge content — it never generates or edits it, and scoring is fully deterministic (no LLM, no per-content judgments beyond the authored answer key).

## Architecture

- **Web App**: Next.js 14+ (App Router), TypeScript, React, Tailwind CSS, shadcn/ui
- **API Server**: Node.js, TypeScript, Fastify
- **Database**: PostgreSQL 15+, Prisma ORM

## Project Structure

```
baaten/
├── apps/
│   ├── web/          # Next.js frontend (level path, candidate sessions, progress + admin panel)
│   └── api/          # Fastify API server (import validation, session engine, progression)
├── packages/
│   ├── db/           # Prisma schema, migrations, seed (roles, industries, badges)
│   └── shared-types/ # Zod schema, graph validator, deterministic scoring/feedback, tests
├── docs/
│   └── fixtures/     # onboarding-drop-off.json + single-question-sample.json
├── test/
│   └── e2e/          # end-to-end API flows: import → play → resume → levels → XP
└── scripts/
    └── reset-content.mjs  # wipes authored content/progress for a clean level path
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 15+

### Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database URL and other secrets

# Generate Prisma client
pnpm db:generate

# Run migrations
pnpm db:migrate

# Seed the database (roles + admin user)
pnpm db:seed
```

### Development

```bash
# Start all services
pnpm dev

# Or start individually:
# API: pnpm dev:api   (http://localhost:4000)
# Web: pnpm dev:web   (http://localhost:3000)
```

### Rebuilding path content

The seed creates roles, the admin, industries and badges — challenge content and the
level path are built through the admin UI. To lay the authored scenarios out as a clean
path in one command:

```bash
pnpm db:reset-content
```

Every fixture in `docs/fixtures` is imported through the real import endpoint (so the
graph validator judges it exactly as the admin panel would) and assigned to one level,
easiest first, one scenario per industry. Re-running it refreshes content in place and
never overwrites a level slot it cannot claim. `single-question-sample.json` is left out
deliberately: it is the quick-call sample the e2e suites import, not path content.

For a clean slate first, wipe and re-seed:

```bash
cd packages/db && DATABASE_URL=postgresql://postgres@localhost:5432/baaten pnpm exec prisma migrate reset --force
pnpm db:seed && pnpm db:reset-content
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Secret for session cookies |
| `ADMIN_SEED_EMAIL` | Initial admin email |
| `ADMIN_SEED_PASSWORD` | Initial admin password |
| `NEXT_PUBLIC_API_URL` | API URL for frontend |
| `WEB_URL` | Frontend URL for CORS |
| `PORT` | API server port (default: 4000) |
| `NEXT_PUBLIC_ASHKAR_DSN` | AshkarHQ monitoring DSN (optional — monitoring is disabled when empty) |
| `NEXT_PUBLIC_ASHKAR_PROJECT_KEY` | AshkarHQ project key (optional) |

## Challenge JSON Format

Challenges are authored externally (by the Challenge Generator) and imported as JSON:

```json
{
  "id": "onboarding_drop_off",
  "title": "The Onboarding Drop-Off",
  "role": "Product Design",
  "difficulty": "medium",
  "summary": "Shopwell is an online store with its own mobile app — first-party retail, no marketplace or third-party sellers. …",
  "start": "Q1",
  "questions": {
    "Q1": {
      "text": "...",
      "bestChoice": 1,
      "choices": [
        { "text": "...", "stage": "INVESTIGATE", "reveal": "...", "next": "Q2" },
        { "text": "...", "stage": "DEFINE", "reveal": "...", "next": "END" }
      ]
    }
  }
}
```

- `next` is either `"END"` or another question key
- every question has 3–4 choices
- `bestChoice` is the **0-based index** of the strongest choice at that question — it must satisfy `0 ≤ bestChoice < choices.length` (the import rejects `"D"`-style habits on 3-choice questions). It is server-only: candidates never see it; it solely drives XP when a level session reaches END
- `stage` is internal scaffolding — never shown to candidates
- `summary` is optional — a short brief on the business, shown on the path-map node before the run starts (see below)

### The challenge summary

`summary` is an optional short brief on the **business**: what the company does and who its customers are. It is the one piece of prose a candidate sees *before* they start — on the level's node in the path map, above its status line.

Keep it about the company, not the incident. What went wrong, the numbers, and the decision in front of the candidate belong in `Q1`'s text, which is where the scenario opens; a summary that repeats them tells the candidate nothing new. Also not the candidate's role ("you're the designer") — the question text already speaks to them.

```json
"summary": "Shopwell is an online store with its own mobile app — first-party retail, no marketplace or third-party sellers. Its customers are shoppers who install the app from ads and app-store features, and the company earns when they browse and buy."
```

- Applies to every scenario fixture in `docs/fixtures/`; keep them in sync with the content on the path
- Max 400 characters (the import rejects longer); the node clamps display to three lines
- Optional, so content imported without one keeps importing — its node simply renders without a brief


### Reveals: a sentence or a table

A `reveal` is what the candidate learns after committing a choice. It is authored content, never generated. The original form is a plain sentence, still accepted as-is:

```json
"reveal": "Conversion is flat across all four variants."
```

When the evidence is tabular, author it as a table instead — `text` stays optional, so a caption, a sentence, or both can sit above it:

```json
"reveal": {
  "text": "Conversion is flat across all four variants:",
  "table": {
    "caption": "Variant results, week 2",
    "columns": ["Variant", "Visitors", "Signups", "Conversion"],
    "rows": [
      ["Control",    "12,480", "374", "3.0%"],
      ["Short copy", "12,511", "381", "3.0%"]
    ]
  }
}
```

- one of `text` / `table` is required; unknown fields inside `reveal` are rejected
- every row must have exactly as many cells as `columns` — a ragged table fails validation and names the offending row
- limits: 6 columns, 50 rows, 200 characters per cell (reveals are copied into every session path entry)
- cells are plain strings: the author decides the formatting (`"3.0%"` vs `"3%"`) — nothing is reformatted or recomputed
- the table is display-only: it never affects pass/fail, XP, or stars

See `packages/shared-types/challenge-schema.ts` for the full Zod schema and `docs/fixtures/onboarding-drop-off.json` for a complete valid example.

### Validation (import is all-or-nothing)

1. **Structural** — the JSON matches the schema exactly (unknown fields rejected)
2. **Flow** — `start` exists; every `next` is `END` or an existing question; no self-loops; no cycles; no unreachable questions; every path reaches `END`
3. **Answer key** — every `bestChoice` addresses one of that question's own choices

Failures are rejected with itemized reasons (e.g. *"Question Q11 loops back to Q6"*) and logged to the failed-imports history. Nothing is auto-repaired.

## Progression & Scoring

- **The path**: numbered levels, unlocked in order. An admin assigns an imported challenge to a level number + industry; a level's `type` (`challenge` | `single_question`) is derived from the question graph, never authored.
- **Pass condition**: reach `END` — identical for a 9-question scenario and a single-question "quick call". A level cannot be failed.
- **XP**: `10 × best calls` (`XP_PER_BEST_CHOICE = 10`) — the count of questions on the player's recorded path where they picked that question's `bestChoice`. No ceiling, no longest-path bonus.
- **XP is credited once**, on the first pass. Replays can improve `bestXp`/`bestStars` for display, but never add XP — replay-farming is impossible.
- **Stars** (display-only): 3★ = 100% best calls, 2★ ≥ 80%, 1★ ≥ 60% — never gate progression.
- **Player level**: `floor(√(totalXp / 100))` from total credited XP.
- **Streaks**: UTC-day streak incremented when a level is passed. **Badges**: condition-based (`levelsPassedAbove`, `perfectLevelsAbove`, `starsAbove`, `streakAbove`, `industryCompleted`). **Leaderboard**: weekly XP within the player's cohort.

## Skill Profile

The candidate's real-world capability profile — what they are good at in their role, read from how they answered. Like everything else here it is **fully deterministic** (no AI, no new authoring): every choice in every challenge is tagged with a process `stage`, and each role's stages map onto the skills that role lists on a CV.

- **Product Design (six skills)** (fixed process order): Problem framing (`FRAME`), Research & evidence (`INVESTIGATE`), Synthesis & definition (`DEFINE`), Ideation & options (`EXPLORE`), Solution & tradeoffs (`DESIGN`), Validation & experimentation (`VALIDATE`).
- **Product Management (seven skills)** (fixed process order): Problem framing (`FRAME`), Diagnosis (`DIAGNOSE`), Strategy & direction (`STRATEGIZE`), Prioritization (`PRIORITIZE`), Planning & roadmapping (`PLAN`), Execution & delivery (`EXECUTE`), Measurement & learning (`MEASURE`).
- Each decision is credited to the skill of the stage on the move the candidate **chose** — not the ideal one — weighted best = 1, reasonable = 0.5, poor = 0 (`packages/shared-types/skills.ts`). Stages are per-role at import: a PM challenge may only use PM stages, a PD challenge only PD stages (`FRAME` is shared).
- **Proficiency bands** reuse the run-feedback thresholds: `strong` ≥ 75%, `emerging` ≤ 50%, else `developing`. A skill also needs **≥ 3 observed decisions** (`MIN_SKILL_EVIDENCE`) before it may read strong — a thin perfect record stays `developing` and is flagged `thinEvidence` ("needs more evidence"), so one lucky answer cannot claim mastery. Skills with no decisions read `unproven` ("not yet observed") — no fake zeros.
- **Aggregated on read, no profile table**: `GET /api/v1/progress/skills` walks the caller's completed sessions and their challenges' stored graphs with the same pure `buildSkillProfile` used by the unit tests, so the profile can never contradict a finished run's own report. Challenge-local rubric criteria are deliberately **not** part of the profile — they stay in the end-of-run report.
- **Web**: `/profile` — header stats (strong-call rate, decisions, scenarios), an SVG radar of the role's skills, Strengths and "Where you lose ground" cards (growth ones surface the authored remediation note), and the full skill breakdown.

## API Endpoints

### Auth
- `POST /api/v1/auth/signup` — Register new user
- `POST /api/v1/auth/login` — Login
- `POST /api/v1/auth/logout` — Logout
- `POST /api/v1/auth/onboarding/role` — Select or switch role (first pick, switch, or same-role no-op; re-issues the session cookie so the gate and every scoped read follow the new track)

### Sessions (guided candidate session)
- `POST /api/v1/sessions` — Start (or resume) a session for a challenge. A challenge assigned to a level is only playable through that level: the session is always tagged with it and the progression gate is enforced (403 when locked). Unassigned challenges play unscored. Returns the first question.
- `POST /api/v1/sessions/:id/answer` — Submit the current choice; returns that choice's reveal + next question, auto-completes at `END` (a level-tagged session scores and credits there)
- `GET /api/v1/sessions/:id` — Session state; current question + path so far (resume support)
- `GET /api/v1/sessions/:id/summary` — Finished path as a readable recap; when the session belongs to a level, also the run's score (hits/answered/XP/stars)

**Field visibility rule**: candidates receive question text and choice texts only. `stage`, `next`, and `bestChoice` never leave the server. A `reveal` (prose or table) is the single exception: it is returned exactly once, for the choice that was just submitted — never with the question, and never for a choice that was not made. Everything the candidate sees in a recap is their own path. The challenge `summary` is authored for pre-run display by design: it describes the business and is not derived from any question.

**Score is frozen at completion**: a level run's score is stored on the session when it reaches END, so re-importing a challenge (which is allowed at any time) can never make an old recap contradict the XP that run earned.

### Level path (candidate)
- `GET /api/v1/levels` — The numbered path map: lock state, stars, XP info, and the challenge's authored business brief per level
- `POST /api/v1/levels/:id/start` — Start (or resume) a level's session; 403 when the level is locked

### Progress (candidate)
- `GET /api/v1/progress` — Totals **for the caller's role track**: XP, player level, levels passed, stars, accuracy, streak, per-industry rollups — never aggregated across roles
- `GET /api/v1/progress/skills` — The skill profile: the role's own real-world skills (six for Product Design, seven for Product Management) scored from the recorded decisions (weighted best/reasonable/poor, `strong` needs rate ≥ 0.75 **and** ≥ 3 decisions), with per-skill evidence lines and proficiency bands
- `GET /api/v1/progress/badges` — Every badge with earned state (evaluated and stored per track — a badge earned on one role doesn't show on the other)
- `GET /api/v1/progress/leaderboard` — Weekly XP on the caller's track's levels within their cohort + the caller's rank

### Admin: Challenges
- `POST /api/v1/admin/challenges/import` — Paste challenge JSON. Idempotent on `id`: the first import creates the challenge (live immediately), and re-importing the same `id` **updates it in place** — the update workflow is simply pasting the generator's output again. The same validator gates both. Never touches `status`
- `GET /api/v1/admin/challenges` — List (filter by `status=active|retired`)
- `GET /api/v1/admin/challenges/:id` — Full internal view (stages, reveals, next pointers; reveals normalized, role name included so the view can be edited and re-imported as-is)
- `PATCH /api/v1/admin/challenges/:id/status` — Retire / restore
- `DELETE /api/v1/admin/challenges/:id` — Delete (blocked when sessions exist — update instead)
- `GET /api/v1/admin/imports` — Failed-import history with reasons

### Admin: Level path
- `GET /api/v1/admin/levels` — All levels (number, industry, type, status, player count)
- `GET /api/v1/admin/levels/unassigned` — Imported, active challenges with no level yet
- `POST /api/v1/admin/levels` — Assign a challenge to a level number + industry (+ derived `type`)
- `PATCH /api/v1/admin/levels/:id` — Reorder / re-tag / retire / restore
- `DELETE /api/v1/admin/levels/:id` — Delete (blocked when players have progress)
- `GET|POST /api/v1/admin/industries` — List / create industries
- `PATCH|DELETE /api/v1/admin/industries/:id` — Update / delete (blocked when levels reference it)

## Web Routes

- `/` `/login` `/signup` — entry and auth
- `/onboarding` `/role` — role selection: first run, and the revisitable role-select page behind the header's role chip (both render the shared selector; success lands on `/home`, the selected track's path)
- `/home` — the level path map (play/replay levels, each node showing the challenge's business brief; locked levels unlock in order)
- `/sessions/[id]` — guided session player (reveal waits for Continue; level result card on completion)
- `/sessions/[id]/summary` — session recap + score
- `/progress` — XP, player level, streak, industries, weekly leaderboard, badges
- `/admin/challenges` — import + library management (retire/restore/delete)
- `/admin/challenges/[id]` — internal view + **Update content** (edit the JSON and save; re-imports in place)
- `/admin/levels` — level path management (assign/retire/delete, industries)
- `/admin/imports` — failed import history

## Testing

```bash
# 1. Start from a clean level path (both suites reuse existing levels otherwise)
pnpm db:reset-content

# 2. Run the whole e2e layer — one suite per role track
pnpm test:e2e

# Schema + graph + scoring unit tests
pnpm --filter @baaten/shared-types test

# Typecheck everything
pnpm typecheck
```

The e2e layer is organised by role track — one suite per role, each a complete
journey (`role onboarding → import → play → level path → skills profile`):

| Suite | Track |
|---|---|
| `test/e2e/e2e-product-design.mjs` | Product Design — content ops, session mechanics, the level path, the six design skills |
| `test/e2e/e2e-product-management.mjs` | Product Management — the same journey plus role isolation and the seven PM skills |

Both suites mutate the database they run against: they import fixtures, build levels as
they go (`e2e-product-design.mjs` claims a level 2 with `single-question-sample.json` when
that slot is free) and leave their throwaway candidates behind. They also *reuse*
whatever already occupies the level numbers they need, so a database that already carries
the authored path makes them play someone else's content and fail their own assertions.
Give them a scratch database:

```bash
createdb baaten_e2e

# Point the seed at the scratch database by editing packages/db/.env (gitignored):
# seed.ts loads it with process.loadEnvFile, which OVERRIDES the environment, so this
# URL cannot be supplied on the command line. Prisma's CLI reads the same file.
cd packages/db && pnpm exec prisma migrate deploy && pnpm db:seed

# The API keeps a real environment variable over .env, so it can be pointed per run:
cd ../.. && DATABASE_URL=postgresql://postgres@localhost:5432/baaten_e2e pnpm dev:api
pnpm test:e2e
```

Then restore `packages/db/.env` and drop the scratch database. The authored scenarios
come back on the dev database with `pnpm db:reset-content`.

## What the app deliberately does NOT do

- Does not generate, edit, or auto-fix challenge content (the answer key is authored, not inferred) — reveal tables included
- Does not use LLM or heuristic scoring — the score is a deterministic count against the authored `bestChoice`
- Does not expose internal authoring structure (`stage`, `next`, `bestChoice`) to candidates; only the reveal for a choice they actually made
- No partial credit, difficulty multipliers, or per-question scoring — one score per finished level

## License

MIT