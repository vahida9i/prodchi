# Baaten — Technical Implementation Plan

Build spec for the Baaten MVP: Product Design skill-practice app with an admin panel for content management. Written for direct execution by an engineer or AI coding agent — every stack choice, schema, and API contract below is final, not a menu of options.

Challenge content is authored outside this system (the operator runs the Challenge Generator Prompt externally and gets back a JSON file) and brought in through the admin panel. This app never calls an LLM to generate content — it calls an LLM exactly once per completed attempt, to assess it.

---

## 1. Scope

**In scope:** Product Design role only. Admin panel for Skill Categories, Skills, and Challenge import/publish. User signup/login, skill tree, challenge attempts, AI assessment, Capability Profile, streak, levels, badges, single-cohort leaderboard.

**Out of scope:** Pro billing, in-app content generation, automated content QC, cross-cohort/global leaderboard, human review queue UI, second role's content, employer features, native mobile app, mentor verification, content version history.

---

## 2. Software Architecture

### 2.1 Components

| Component | Tech | Responsibility |
|---|---|---|
| Web app | Next.js 14+, TypeScript, React, Tailwind CSS, shadcn/ui | Serves both user-facing routes (`/`) and admin routes (`/admin/*`, role-gated) |
| API server | Node.js, TypeScript, Fastify | All business logic, auth, data access |
| Database | PostgreSQL 15+, Prisma ORM | Single source of truth |
| Assessment service | Internal module inside API server | Calls Anthropic API on attempt completion only |

One API process, one database, one web app. No queues, no background workers, no microservices, no separate admin deployment. At this scale (one operator, an MVP user base) that infrastructure would add operational surface without solving a real problem.

### 2.2 Diagram

```
┌──────────────────────────────┐
│           Next.js Web App             │
│  /              user-facing routes  │
│  /admin/*       admin routes           │
│  (role check enforced server-side,   │
│   not just hidden in the UI)          │
└───────────────┬──────────────┘
                │ HTTPS / JSON (REST)
┌───────────────▼──────────────┐
│            API Server                    │
│  routes/auth                              │
│  routes/challenges   (user-facing)      │
│  routes/attempts                          │
│  routes/profile                           │
│  routes/admin/skills                      │
│  routes/admin/challenges (CRUD + import)│
│  services/assessment                       │
│  services/gamification                    │
└──────┬─────────────────┬───────────┘
       │                       │
┌──────▼──────┐     ┌──────▼──────────┐
│  PostgreSQL     │     │  Anthropic API       │
│                   │     │  (assessment only)  │
└─────────────┘     └────────────────────┘
```

### 2.3 Core flows

**Admin import → publish**
1. Admin pastes/uploads JSON at `POST /admin/challenges/import` (Section 6.5).
2. API runs the structural validator (Section 5.3) — deterministic, no LLM call.
3. On pass: creates `Challenge` row, `status = "draft"`.
4. Admin reviews content at `GET /admin/challenges/:id` (full view, including `hiddenCase`/`answerSheet`).
5. Admin calls `PATCH /admin/challenges/:id/status` → `"published"`. Only published challenges are visible to `GET /challenges`.

**User attempt → assessment → profile update**
1. `POST /attempts` — creates an `Attempt`, returns step 0 of `applicantSteps` only.
2. `POST /attempts/:id/answer` per step — server looks up the chosen option in `Challenge.answerSheet` (never sent to the client), applies its `reveal`, appends to `Attempt.path`, returns the next step (determined by `nextStepIndex`, not a fixed linear order).
3. On final step: `POST /attempts/:id/complete` triggers the Assessment Service → Anthropic API call → writes `Attempt.assessment` → updates `SkillScore` rows → recomputes and upserts `CapabilityProfile` (Section 4.7) → updates `Streak` → evaluates `Badge` unlocks → computes `xpEarned`.
4. Client fetches the updated `CapabilityProfile`, `Streak`, and any newly earned `UserBadge` rows to render the feedback/level-up/progress screens.

---

## 3. Repository Structure

```
baaten/
├── apps/
│   ├── web/
│   │   ├── app/
│   │   │   ├── (user)/
│   │   │   │   ├── home/page.tsx
│   │   │   │   ├── onboarding/page.tsx
│   │   │   │   ├── skills/page.tsx
│   │   │   │   ├── challenges/[id]/page.tsx
│   │   │   │   ├── attempts/[id]/page.tsx
│   │   │   │   ├── progress/page.tsx
│   │   │   │   ├── badges/page.tsx
│   │   │   │   └── profile/page.tsx
│   │   │   ├── admin/
│   │   │   │   ├── skills/page.tsx
│   │   │   │   ├── challenges/page.tsx
│   │   │   │   ├── challenges/import/page.tsx
│   │   │   │   └── challenges/[id]/page.tsx
│   │   │   └── (auth)/login/page.tsx, signup/page.tsx
│   │   ├── components/
│   │   │   ├── ui/                  # shadcn/ui primitives (button, card, dialog, table,
│   │   │   │                        # progress, tabs, avatar, badge, radio-group, textarea, etc.)
│   │   │   │                        # generated via the shadcn CLI, not hand-rolled
│   │   │   ├── challenge/           # ChallengeCard, StepOptionList, StageProgressBar,
│   │   │   │                        # RadarChart (skill breakdown), StreakCalendar, BadgeGrid
│   │   │   └── admin/               # SkillForm, ChallengeImportForm, ValidationErrorList
│   │   ├── lib/
│   │   │   ├── api-client.ts
│   │   │   └── utils.ts             # cn() helper, shadcn convention
│   │   ├── tailwind.config.ts
│   │   └── components.json          # shadcn CLI config
│   └── api/
│       ├── src/
│       │   ├── routes/
│       │   │   ├── auth.ts
│       │   │   ├── challenges.ts
│       │   │   ├── attempts.ts
│       │   │   ├── profile.ts
│       │   │   └── admin/
│       │   │       ├── skills.ts
│       │   │       └── challenges.ts
│       │   ├── services/
│       │   │   ├── assessment.ts
│       │   │   └── gamification.ts
│       │   ├── middleware/
│       │   │   ├── requireAuth.ts
│       │   │   └── requireAdmin.ts
│       │   └── server.ts
│       └── package.json
├── packages/
│   ├── db/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   └── shared-types/
│       ├── challenge-schema.ts      # zod schema for the import contract (Section 5)
│       ├── validator.ts             # structural validator, used by admin import route
│       └── rubrics/                 # static JSON, one file per skill
└── docs/
    └── challenge-generator-prompt.md   # verbatim reference copy, not executed by app code
```

pnpm workspaces. No Docker/Nx/Turborepo orchestration required at this scale.

---

## 4. Data Schema (Prisma, PostgreSQL)

```prisma
model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String?
  role         String   @default("user") // "user" | "admin"
  cohortId     String?
  roleTrackId  String?  // FK to Role (Product Design / Product Management), set at onboarding
  createdAt    DateTime @default(now())
  roleTrack       Role?             @relation(fields: [roleTrackId], references: [id])
  skillScores     SkillScore[]
  attempts        Attempt[]
  streak          Streak?
  badges          UserBadge[]
  capabilityProfile CapabilityProfile?

  @@index([cohortId])
}

model Role {
  id              String          @id @default(uuid())
  name            String          @unique // "Product Design" | "Product Management" — fixed seed data
  skillCategories SkillCategory[]
  challenges      Challenge[]
  users           User[]
}

model SkillCategory {
  id     String  @id @default(uuid())
  name   String
  order  Int     @default(0)
  roleId String
  role   Role    @relation(fields: [roleId], references: [id])
  skills Skill[]

  @@index([roleId])
}

model Skill {
  id              String  @id @default(uuid())
  name            String
  order           Int     @default(0)
  skillCategoryId String
  unlockThreshold Int?    // score needed in the prior skill (by `order`) to unlock; null = always unlocked
  skillCategory   SkillCategory @relation(fields: [skillCategoryId], references: [id])
  challengeLinks  ChallengeSkill[]
  scores          SkillScore[]

  @@index([skillCategoryId])
}

model SkillScore {
  id            String @id @default(uuid())
  userId        String
  skillId       String
  score         Float  // rolling weighted average, 0-100
  evidenceCount Int    @default(0)
  updatedAt     DateTime @updatedAt
  user          User   @relation(fields: [userId], references: [id])
  skill         Skill  @relation(fields: [skillId], references: [id])

  @@unique([userId, skillId])
}

model Challenge {
  id               String   @id @default(uuid())
  title            String
  description      String
  estimatedMinutes Int
  roleId           String
  difficulty       Int      // 1-5
  tier             String   // "free" | "pro"
  xpValue          Int
  hiddenCase       Json     // server-only
  applicantSteps   Json     // client-facing when read via GET /challenges/:id/attempt-safe view
  answerSheet      Json     // server-only
  status           String   @default("draft") // "draft" | "published"
  createdAt        DateTime @default(now())
  role             Role     @relation(fields: [roleId], references: [id])
  skills           ChallengeSkill[]
  attempts         Attempt[]

  @@index([roleId, status, tier])
}

model ChallengeSkill {
  challengeId String
  skillId     String
  challenge   Challenge @relation(fields: [challengeId], references: [id])
  skill       Skill     @relation(fields: [skillId], references: [id])

  @@id([challengeId, skillId])
}

model Attempt {
  id          String    @id @default(uuid())
  userId      String
  challengeId String
  startedAt   DateTime  @default(now())
  completedAt DateTime?
  path        Json      // [{stepIndex, optionChosen | freeTextResponse, revealedInfoSnapshot, timestamp}]
  assessment  Json?     // {perSkillDeltas: [{skillId, delta}], feedbackText: {positives[], negatives[]}, confidence}
  xpEarned    Int?
  user        User      @relation(fields: [userId], references: [id])
  challenge   Challenge @relation(fields: [challengeId], references: [id])

  @@index([userId, challengeId])
}

model Streak {
  userId        String    @id
  currentStreak Int       @default(0)
  longestStreak Int       @default(0)
  lastActiveDay DateTime?
  user          User      @relation(fields: [userId], references: [id])
}

model Badge {
  id              String @id @default(uuid())
  name            String
  description     String
  iconRef         String
  unlockCondition Json   // {"type":"skillScoreAbove","skillId":"...","threshold":80}
                          // {"type":"streakAbove","threshold":30}
                          // {"type":"attemptsCompletedAbove","threshold":1}
  users           UserBadge[]
}

model UserBadge {
  userId   String
  badgeId  String
  earnedAt DateTime @default(now())
  user     User  @relation(fields: [userId], references: [id])
  badge    Badge @relation(fields: [badgeId], references: [id])

  @@id([userId, badgeId])
}

// Persisted, recomputed on every attempt completion. SkillScore rows remain
// the underlying source of truth for individual skill numbers; this table is
// the durable, queryable snapshot the Profile screen and any future export/
// share feature reads from, so that screen doesn't have to assemble an
// aggregate from five different tables on every page load.
model CapabilityProfile {
  userId          String   @id
  overallScore    Float    // mean of the user's SkillScore.score at last recompute
  skillBreakdown  Json     // [{skillId, skillName, score}] snapshot at last recompute
  challengesCompleted Int
  caseStudiesCompleted Int  // challenges with difficulty >= 4, count
  updatedAt       DateTime @updatedAt
  user            User     @relation(fields: [userId], references: [id])
}
```

### 4.1 CapabilityProfile write path

`CapabilityProfile` is written by `services/gamification.ts` as the last step of attempt completion (Section 2.3, step 3), never written directly by any route handler. The recompute function:

1. Reads all `SkillScore` rows for the user.
2. `overallScore` = arithmetic mean of `score` across those rows (0 if none exist yet).
3. `skillBreakdown` = one entry per `SkillScore` row, joined with `Skill.name`.
4. `challengesCompleted` = count of `Attempt` rows for the user with `completedAt != null`.
5. `caseStudiesCompleted` = same, filtered to `Challenge.difficulty >= 4`.
6. Upsert (`userId` as the unique key) — insert on first completion, update thereafter.

`GET /profile` reads this table directly. It does not recompute on read. This keeps profile reads O(1) instead of a multi-table aggregation on every page load, at the cost of the table being current only as of the last completed attempt — acceptable, since it's only ever updated by that one code path and nothing else writes to `SkillScore` outside of attempt completion either.

---

## 5. Challenge Import JSON Contract

### 5.1 Shape

```json
{
  "metadata": {
    "title": "string",
    "description": "string",
    "estimatedMinutes": 15,
    "roleId": "uuid",
    "difficulty": 2,
    "tier": "free",
    "xpValue": 120,
    "skillIds": ["uuid", "uuid"]
  },
  "hiddenCase": {
    "company": {}, "product": {}, "initialProblem": {}, "constraints": {},
    "stakeholders": [], "historicalContext": [], "evidence": {},
    "rootCause": {}, "opportunity": {}, "solutionDirections": [], "validation": {}
  },
  "applicantSteps": [
    {
      "stepIndex": 0,
      "stage": "FRAME",
      "inputType": "options",
      "context": "string",
      "contextBlocks": [ {"type": "table", "data": {}}, {"type": "screenshot", "data": {}} ],
      "question": "string",
      "options": [
        {"id": "A", "text": "string"}, {"id": "B", "text": "string"},
        {"id": "C", "text": "string"}, {"id": "D", "text": "string"}
      ]
    }
  ],
  "answerSheet": [
    {
      "stepIndex": 0,
      "objective": "string",
      "preferredOption": "B",
      "options": {
        "A": {"reasoningSignal": "string", "consequence": "string", "reveal": ["string"], "nextStepIndex": 1},
        "B": {"reasoningSignal": "string", "consequence": "string", "reveal": ["string"], "nextStepIndex": 2},
        "C": {"reasoningSignal": "string", "consequence": "string", "reveal": [], "nextStepIndex": 1},
        "D": {"reasoningSignal": "string", "consequence": "string", "reveal": [], "nextStepIndex": 1}
      }
    }
  ]
}
```

### 5.2 Field rules

- `inputType` is `"options"` (default; requires exactly 4 entries in `options[]`) or `"freeText"` (requires `options[]` to be absent or empty).
- `contextBlocks` is optional; only present on steps needing structured evidence (table/screenshot).
- `stage` must be one of the 7 fixed values (`FRAME`, `INVESTIGATE`, `DEFINE`, `EXPLORE`, `DECIDE`, `DESIGN`, `VALIDATE`) and is never rendered in user-facing UI (fine to show in admin).
- Every `applicantSteps[i]` must have a matching `answerSheet[i]` entry with the same `stepIndex`.
- **Free-text scoring:** the Assessment Service scores `freeText` responses directly against the skill rubric (Section 7), with no forced mapping onto the answer sheet's A/B/C/D options. The answer sheet entry for a `freeText` step still needs `reveal`/`nextStepIndex` per "option" if the step branches, but `reasoningSignal`/`consequence` for those entries are used only as scoring context passed to the LLM, not for exact-match routing.

### 5.3 Structural validator (deterministic, no LLM)

Implemented as `packages/shared-types/validator.ts`, a zod schema plus these additional checks run in code:
1. All `metadata` fields present and correctly typed; `roleId` and every `skillIds[]` entry exist in the DB.
2. Every `options`-type step has exactly 4 options with unique `id`s (`A`–`D`).
3. The stages appearing across `applicantSteps`, in order of first occurrence, are a subsequence of `[FRAME, INVESTIGATE, DEFINE, EXPLORE, DECIDE, DESIGN, VALIDATE]` (i.e., no stage appears before an earlier one, though not every stage must appear).
4. Every `applicantSteps[i].stepIndex` has a corresponding `answerSheet[i].stepIndex`.
5. Every option (or the single freeText entry) in every `answerSheet` item has all four fields (`reasoningSignal`, `consequence`, `reveal`, `nextStepIndex`) present.
6. Every `nextStepIndex` referenced exists as a `stepIndex` in `applicantSteps`, or is `null` (meaning "this ends the challenge").

On failure, the import endpoint returns a 400 with a list of `{path, message}` errors — one per failed check, not just "invalid" — so the admin can fix the source JSON.

---

## 6. API Specification

All endpoints under `/api/v1`. Auth via a signed session cookie (issued by Lucia/Auth.js); `requireAuth` middleware on everything except `/auth/*`; `requireAdmin` additionally on every `/admin/*` route (returns 403 for non-admin).

### 6.1 Auth
- `POST /auth/signup` — body `{email, password}` → `201 {userId}`. Errors: `409` if email taken.
- `POST /auth/login` — body `{email, password}` → `200`, sets session cookie. Errors: `401` on bad credentials.
- `POST /auth/logout` — clears session.
- `POST /auth/onboarding/role` — body `{roleId}` → sets `User.roleTrackId`. One-time; `409` if already set.

### 6.2 User-facing challenges
- `GET /challenges` — query `?tier=free`. Returns published challenges for the caller's `roleTrackId`, list view (`id, title, description, difficulty, estimatedMinutes, xpValue, skillIds`) — never `hiddenCase`/`answerSheet`.
- `GET /challenges/:id` — same exclusions, single-item detail (for the challenge-intro screen).

### 6.3 Attempts
- `POST /attempts` — body `{challengeId}` → `201 {attemptId, step: applicantSteps[0]}`. Errors: `404` if challenge not published or not caller's role/tier.
- `POST /attempts/:id/answer` — body `{stepIndex, optionId}` or `{stepIndex, freeText}`. Looks up `answerSheet[stepIndex].options[optionId]` (or the freeText entry), appends `{stepIndex, response, revealedInfoSnapshot, timestamp}` to `Attempt.path`, returns `{nextStep: applicantSteps[n] | null}`. `nextStep: null` signals the client to call `/complete`. Errors: `409` if attempt already completed, `400` if `stepIndex` doesn't match the attempt's current position.
- `POST /attempts/:id/complete` — triggers Assessment Service synchronously, then gamification update (Section 2.3 step 3). Returns `{assessment, xpEarned, leveledUp: boolean, newBadges: Badge[]}`. Errors: `409` if not all steps answered.
- `GET /attempts/:id` — current state (path so far, whether completed).

### 6.4 Profile
- `GET /profile` — returns the `CapabilityProfile` row plus `Streak` and earned `UserBadge`s joined with `Badge`. `404` if the user has no completed attempts yet — client renders an empty-state, not an error page.
- `GET /leaderboard` — returns top N users by weekly `xpEarned` sum within the caller's `cohortId`, plus the caller's own rank even if outside top N.

### 6.5 Admin: skills
- `POST /admin/skill-categories` — body `{name, roleId, order}`.
- `PATCH /admin/skill-categories/:id`, `DELETE /admin/skill-categories/:id`.
- `POST /admin/skills` — body `{name, skillCategoryId, order, unlockThreshold?}`.
- `PATCH /admin/skills/:id`, `DELETE /admin/skills/:id` — `DELETE` blocked (`409`) if the skill has any `ChallengeSkill` links or `SkillScore` rows, to avoid silently orphaning attempt/score history.

### 6.6 Admin: challenges
- `POST /admin/challenges/import` — body per Section 5.1 → `201 {challengeId}` or `400 {errors: [{path, message}]}` from the validator.
- `GET /admin/challenges` — query `?status=draft|published`. List view.
- `GET /admin/challenges/:id` — full view, including `hiddenCase` and `answerSheet`.
- `PATCH /admin/challenges/:id/status` — body `{status: "draft" | "published"}`.
- `DELETE /admin/challenges/:id` — `409` if any `Attempt` rows reference it; unpublish instead.

---

## 7. Assessment Service Detail

`services/assessment.ts`, called synchronously from `POST /attempts/:id/complete`.

**Input assembly:** for the completed `Attempt`, load `Challenge.answerSheet`, the `Attempt.path`, and the rubric files (Section 3 repo structure, `packages/shared-types/rubrics/{skillId}.json`) for every skill in `Challenge.skills`.

**Rubric format:**
```json
{ "skillId": "uuid", "criteria": [ {"description": "string", "weight": 0.4} ] }
```
Weights per rubric sum to 1.0. Static content, authored alongside challenge content — not generated at runtime.

**LLM call:** one Anthropic API call per completed attempt. Prompt includes: the chosen-option (or freeText) sequence with each step's `reasoningSignal`/`consequence` from the answer sheet, and the rubric criteria for each linked skill. Requests structured JSON output:
```json
{
  "perSkillDeltas": [ {"skillId": "uuid", "delta": 6.5} ],
  "feedbackText": { "positives": ["string"], "negatives": ["string"] },
  "confidence": 0.82
}
```

**Score update:** for each `perSkillDeltas` entry, upsert `SkillScore`: if a row exists, `score = clamp(0, 100, score + delta)`; if not, create with `score = clamp(0, 100, 50 + delta)` (50 = neutral starting point) and `evidenceCount = 1`; otherwise increment `evidenceCount`.

**Failure handling:** if the Anthropic API call fails or returns unparseable output, retry once; on second failure, mark `Attempt.assessment = {error: true}` and return a `503` from `/complete` — do not silently write a fabricated score.

---

## 8. Gamification Service Detail

`services/gamification.ts`, called after `SkillScore`/`CapabilityProfile` update in the same request.

1. **Streak:** if `Streak.lastActiveDay` is yesterday (UTC date), `currentStreak += 1`; if today, no change; otherwise reset `currentStreak = 1`. Update `longestStreak` if exceeded. Set `lastActiveDay = today`.
2. **XP/Level:** `xpEarned = Challenge.xpValue`, written to `Attempt.xpEarned`. Level is a pure function, not stored: `level = floor(sqrt(totalXp / 100))` (placeholder curve — tune post-launch, but keep it a pure function of `sum(Attempt.xpEarned)` so tuning never requires a migration or backfill).
3. **Badges:** for every `Badge` not already in `UserBadge` for this user, evaluate `unlockCondition` against current state (`SkillScore`, `Streak.currentStreak`, count of completed `Attempt`s). On match, insert `UserBadge`. Supported condition types are exactly the three in Section 4's `Badge.unlockCondition` comment — adding a new type requires a code change, which is acceptable at this scale.
4. **CapabilityProfile:** recompute and upsert per Section 4.1.

---

## 9. Frontend Screens

Design system: **shadcn/ui** on Tailwind CSS. Install components via the shadcn CLI (`npx shadcn@latest add button card dialog table progress tabs avatar badge radio-group textarea skeleton`) into `components/ui/` — do not hand-roll primitives that shadcn already provides. Custom composite components (radar chart, streak calendar, stage progress bar) live in `components/challenge/`, built on top of the shadcn primitives, not as raw HTML/CSS. Theme via shadcn's CSS variables in `tailwind.config.ts` (a single accent color palette is enough for MVP — don't build a multi-theme system).

| # | Screen | Key data source | Primary shadcn components |
|---|---|---|---|
| 1 | Home | `GET /challenges` (next unattempted), `GET /profile` (streak/level chips) | `Card`, `Badge`, `Avatar` |
| 2 | Role select (onboarding only) | `POST /auth/onboarding/role` | `Card` (selectable), `Button` |
| 3 | Skill tree | Skills for the user's role + `SkillScore` (via profile) for done/current/locked state, using `Skill.unlockThreshold` | `Card`, `Progress`, custom `StageProgressBar`-style vertical stepper |
| 4 | Challenge intro | `GET /challenges/:id` | `Card`, `Badge`, `Button` |
| 5 | Attempt — multiple choice | `POST /attempts`, `POST /attempts/:id/answer` | `RadioGroup`, `Progress`, `Button` |
| 6 | Attempt — table/screenshot/freeText | same, `inputType: "freeText"` steps | `Table`, `Textarea`, `Progress` |
| 7 | AI assessment feedback | response of `POST /attempts/:id/complete` | `Card`, custom score-ring component |
| 8 | Level-up celebration | `leveledUp` flag from `/complete` response | `Dialog` (full-screen variant), `Button` |
| 9 | Progress | `GET /profile` (streak), `GET /leaderboard` | `Card`, `Progress`, `Table` (leaderboard), `Avatar` |
| 10 | Badge collection | `GET /profile` (earned) + all `Badge` rows (locked ones need a `GET /badges` list endpoint — add this alongside Section 6.4) | `Card` grid, `Badge`, `Tooltip` (unlock condition on hover) |
| 11 | Capability Profile | `GET /profile` | `Card`, `Avatar`, custom radar chart (SVG or a lightweight charting lib — do not add a heavy charting dependency for one chart) |

**Progress indicator (screens 5–6):** computed from stage position among the 7 fixed stages, not a hardcoded step count — step count varies by path since challenges branch via `nextStepIndex`.

Admin screens (Section 3 file tree) reuse the same `components/ui/` primitives (`Table`, `Dialog`, `Form` inputs) — functional layouts, no separate design pass needed since it's the same component library, just plainer compositions (data tables and forms rather than cards and progress rings).

---

## 10. Phase-Gated Build Plan

Each phase ends in a runnable, demoable state. Do not start a phase until the prior phase's acceptance criteria pass.

**Phase 0 — Repo, DB, seed.** Scaffold Section 3's structure. Implement Section 4's schema, run migrations. Seed: 2 `Role` rows, 1 admin `User` (credentials from env vars). *Acceptance:* migrations run clean; seed produces exactly those rows.

**Phase 1 — Auth + role gating.** `POST /auth/signup`, `/login`, `/logout`; `requireAuth`/`requireAdmin` middleware. *Acceptance:* non-admin hitting any `/admin/*` route gets 403.

**Phase 2 — Admin API: skills + import.** Section 6.5–6.6 endpoints, validator from Section 5.3. *Acceptance:* an admin can create a SkillCategory/Skill, import a valid challenge, get itemized errors from an invalid one, and publish it — via API calls alone.

**Phase 3 — Admin UI.** Section 3's `/admin/*` pages. *Acceptance:* same as Phase 2, through the browser, no direct DB access.

**Phase 4 — User-facing challenge/attempt API.** Section 6.2–6.3. *Acceptance:* full attempt driven end-to-end via API calls, from signup through `POST /complete`, with at least one published challenge from Phase 3.

**Phase 5 — Assessment Service.** Section 7. *Acceptance:* completing an attempt produces a non-null `assessment` with a score for every linked skill; a forced API failure produces the documented `503`, not a fabricated score.

**Phase 6 — Gamification Service + CapabilityProfile.** Section 8, Section 4.1. *Acceptance:* streak/XP/level/badge/profile all update correctly after a completed attempt, verified against the pure-function level calc and the upsert logic.

**Phase 7 — User-facing frontend.** Section 9's 11 screens. *Acceptance:* new user completes signup → role select → skill tree → challenge → attempt → assessment → (level-up if applicable) → updated Capability Profile, entirely in-browser.

**Phase 8 — Leaderboard + badge list endpoint polish.** `GET /leaderboard`, `GET /badges`. *Acceptance:* leaderboard ranks correctly for a seeded cohort; badge collection screen shows locked badges with their unlock condition text.

---

## 11. Testing Strategy

- **Unit:** structural validator (Section 5.3) — one test per failure mode listed. Gamification pure functions (streak transition, level curve, badge condition evaluation) — deterministic, no mocks needed beyond DB state fixtures.
- **Integration:** one test per API endpoint in Section 6, happy path + documented error cases. A full end-to-end integration test that drives Phase 4's acceptance criteria (signup → import a fixture challenge → full attempt → complete) should exist and run in CI, since it's the single most load-bearing path in the system.
- **Assessment Service:** mock the Anthropic API call in tests; test the retry-then-503 failure path explicitly, since that's the one place a silent wrong answer (fabricated score) would be worst.

---

## 12. Known Blocking Dependency

Phase 5 is the only phase that calls the Anthropic API. Confirm current API access for the deployment region before starting Phase 5 — check `docs.claude.com`/`support.claude.com` rather than assuming, since export-control status can change over time. Phases 0–4 require no LLM access and can be fully built and demoed (with `assessment` left null) while this is being resolved.

---

## 13. Environment Variables

```
DATABASE_URL=
SESSION_SECRET=
ANTHROPIC_API_KEY=
ADMIN_SEED_EMAIL=
ADMIN_SEED_PASSWORD=
```

No other external services required for MVP (no payment provider, no email provider — magic-link auth can use a logged-to-console token in development; a real transactional email provider is a Phase 8+ concern, not MVP-blocking).
