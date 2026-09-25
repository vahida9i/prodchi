# Persian Duolingo Customer Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans (required) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the customer-facing web experience as a Persian-first, RTL, Duolingo-inspired learning path for mobile and tablet.

**Architecture:** Keep the existing API/session contracts and replace the customer presentation layer with a shared RTL shell, a focused path home, a single-question session runner, and compact progress/profile screens. All visible copy comes from the Persian translation source; internal API keys remain unchanged.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Radix UI primitives, lucide-react, existing API client and i18n modules.

**Spec:** `docs/superpowers/specs/2026-09-25-persian-duolingo-customer-design.md`

## Global Constraints

- UI language is Persian (`fa`) and all customer-facing screens use RTL.
- No English UI copy is rendered; internal API keys may remain English.
- Mobile and tablet are the target viewports: 390px and 768px must have no horizontal overflow.
- Touch targets are at least 44px high.
- Admin, API, Prisma, seed data and endpoint contracts remain unchanged.
- Respect `prefers-reduced-motion`.

---

### Task 1: Establish Persian RTL foundation

**Files:**
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/lib/i18n/config.ts`
- Modify: `apps/web/lib/i18n/fa.ts`
- Modify: `apps/web/lib/i18n/index.ts` only if the locale fallback needs correction

**Interfaces:**
- Produces a root `dir="rtl"`, Persian Vazirmatn font, Persian locale selection, and shared tokens for later customer components.

- [ ] **Step 1: Audit locale and visible English fallbacks**

Run:

```bash
rg -n "APP_LOCALE|NEXT_PUBLIC_APP_LOCALE|DEFAULT_LOCALE|English|Sign In|Continue|Home|Progress|Profile" apps/web
```

Record every customer-facing English fallback that must move into `fa.ts`.

- [ ] **Step 2: Make Persian the customer fallback**

Keep `APP_LOCALE` as the deployment setting, but make missing client locale values resolve to `fa` and make the root layout set `lang="fa"` and `dir="rtl"` when Persian is active.

- [ ] **Step 3: Add the RTL visual tokens**

Use a restrained light background, one primary green, one warm accent, readable border and muted colors. Add shared focus styles, 44px touch utility, safe bottom padding, and reduced-motion rules without adding decorative gradients.

- [ ] **Step 4: Verify the foundation**

Run:

```bash
./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit
```

Expected: PASS with no type errors.

---

### Task 2: Build the Persian customer shell and navigation

**Files:**
- Create: `apps/web/components/user/PersianUserShell.tsx`
- Create: `apps/web/components/user/ProgressStat.tsx`
- Modify: `apps/web/components/RoleChip.tsx`
- Modify: `apps/web/app/(user)/layout.tsx` only if shared shell placement is needed

**Interfaces:**
- `PersianUserShell({ children, title?, showHeader? })` renders the RTL content frame and bottom navigation.
- `ProgressStat({ label, value, icon, tone })` renders one compact stat tile.

- [ ] **Step 1: Define navigation data**

Use three visible destinations: مسیر (`/home`), پیشرفت (`/progress`), پروفایل (`/profile`). Keep all labels in Persian and mark the active route from `usePathname()`.

- [ ] **Step 2: Implement the shell**

Render a compact mobile/tablet header, a centered content column, fixed bottom navigation with safe-area padding, and `dir="rtl"` on the shell root. Keep every nav link at least 44px high.

- [ ] **Step 3: Implement stat tiles and role label**

Use Persian role labels and direction-neutral icons. Avoid emoji in navigation and status UI.

- [ ] **Step 4: Verify responsive shell**

Check 390px and 768px viewports for overflow and bottom-nav overlap in the browser.

---

### Task 3: Rebuild the home path as a Duolingo-style map

**Files:**
- Modify: `apps/web/app/(user)/home/page.tsx`
- Modify: `apps/web/components/challenge/PathMap.tsx`
- Create: `apps/web/components/challenge/LevelNode.tsx`

**Interfaces:**
- `PathMap({ levels, startingId, onStart, onViewSummary })` keeps the existing callback contract.
- `LevelNode` accepts one `LevelOnPath`, its state, and the start/summary callbacks.

- [ ] **Step 1: Keep home data loading unchanged**

Continue using `api.getLevels()`, `api.getProgress()`, `api.getMe()` and `api.getRoles()`. Keep 401 handling and `api.startLevel()` behavior.

- [ ] **Step 2: Build the home hierarchy**

Render one primary action, a compact stats row, the current unit label, and the path. Remove the large hero illustration and decorative sky layer.

- [ ] **Step 3: Implement the path**

Render unit separators, a centered vertical rail, completed nodes, the current node, and locked nodes. Each node has Persian title, industry, XP/reward, and one clear action. Use `aria-current="step"` for the active node.

- [ ] **Step 4: Verify path behavior**

Test starting the unlocked level, opening a passed summary, and confirming locked levels cannot start. Check no horizontal overflow at 390px and 768px.

---

### Task 4: Rebuild the challenge runner and reward state

**Files:**
- Modify: `apps/web/app/(user)/sessions/[id]/page.tsx`
- Modify: `apps/web/components/challenge/StepOptionList.tsx`
- Modify: `apps/web/components/challenge/RevealBlock.tsx` only for RTL table/text alignment
- Create: `apps/web/components/challenge/RewardSummary.tsx`

**Interfaces:**
- Preserve `api.getSession()` and `api.answerSession()` payloads.
- `RewardSummary({ result, onContinue, onBack })` displays Persian XP, stars, streak, badges and next-level state.

- [ ] **Step 1: Add the RTL session frame**

Show stage title, decision count and a right-to-left progress indicator. Keep leave behavior available but visually secondary.

- [ ] **Step 2: Convert choices to touch cards**

Use a single selected state, visible focus/selected styling, 44px minimum height, and a Persian confirmation CTA. Do not auto-advance after answering.

- [ ] **Step 3: Add the reward summary**

Render first-pass XP, best stars, streak, new badges and next unlocked level in Persian. Preserve the existing summary route and callbacks.

- [ ] **Step 4: Verify the core journey**

Start a level, select an option, submit, continue through reveal, finish, and open the summary. Verify the disabled/loading state during submission.

---

### Task 5: Rebuild progress and profile screens

**Files:**
- Modify: `apps/web/app/(user)/progress/page.tsx`
- Modify: `apps/web/app/(user)/profile/page.tsx`
- Modify: `apps/web/components/profile/SkillRadar.tsx` if labels or axis direction need RTL correction

**Interfaces:**
- Keep existing `ProgressSummary`, `BadgeInfo`, `Leaderboard`, `SkillProfile`, and `SkillScore` data types.

- [ ] **Step 1: Implement the progress hierarchy**

Use the shared shell, a top stat row, simple industry progress cards, Persian leaderboard rows and badge cards. Remove redundant header buttons.

- [ ] **Step 2: Implement the profile hierarchy**

Use the shared shell, account summary, skill overview, strengths and growth sections. Keep the empty state actionable with a route to `/home`.

- [ ] **Step 3: Localize all remaining copy**

Replace direct English strings, role names and status labels with Persian translation keys or explicit mapping helpers.

- [ ] **Step 4: Verify responsive states**

Check loading, error, empty, populated and long-text states at 390px and 768px.

---

### Task 6: Full RTL QA and handoff

**Files:**
- Create or update: `design-qa.md`
- Modify: any customer file required by QA findings

- [ ] **Step 1: Run static checks**

```bash
./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit
git diff --check
```

- [ ] **Step 2: Run browser checks**

Verify home → level → answer → reveal → completion → summary, plus navigation to progress and profile. Test 390px and 768px viewport overrides.

- [ ] **Step 3: Search for visible English**

```bash
rg -n "Sign In|Sign Up|Continue|Home|Progress|Profile|Locked|Start|Retry|Decision|Question|XP|Streak" apps/web/app apps/web/components
```

Review each hit and keep only internal keys or intentional API identifiers.

- [ ] **Step 4: Write QA result**

Record the tested viewport sizes, primary flow result, remaining limitations and final result in `design-qa.md`.

