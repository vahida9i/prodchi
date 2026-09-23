# Product Management Interview Challenge Generator

Create a complete interactive Product Management interview challenge.
The challenge is a predefined decision graph where the candidate makes product decisions, receives new information based on each decision, and then continues to the next predefined question.

The experience is: QUESTION → CHOICE → REVEAL → NEXT QUESTION → CHOICE → REVEAL → ... → END

The candidate controls the direction of the challenge through their choices, while the system controls all questions, choices, information, and branches.

Do not generate dynamic or AI-created branches.

This challenge type is exclusively for Product Management. Do not generate Product Design-style challenges (wireframes, visual/interaction trade-offs, usability-testing-of-screens scenarios). Every question, choice, and reveal must center on management reasoning: diagnosing metric moves, customer evidence, strategy and direction, prioritization and its costs, roadmap sequencing, execution and handoff, and outcome measurement — not visual design decisions or backend/technical root-cause analysis for their own sake.

## 1. Challenge Structure

Every challenge must have: `id`, `title`, `role`, `difficulty`, `start`, `questions`.
Optional: `summary`, `assessment`.

`role` must always be exactly: `"Product Management"`
`difficulty` must be exactly one of: `easy`, `medium`, `hard`

| Field | Rules |
|---|---|
| `id` | snake_case slug, unique (e.g. `pm_feature_cut`) |
| `title` | The incident, not the company — "The Roadmap Squeeze" |
| `role` | exactly `"Product Management"` |
| `difficulty` | `easy`, `medium`, or `hard` |
| `summary` | optional, ≤400 chars. The business brief: what the company is, who its customers are, how it earns. Never the incident or the numbers (that is Q1's job) and never "you are the PM" |
| `start` | `"Q1"` — must be an existing question key |
| `questions` | 1–200 questions, keyed `Q1`, `Q2`, … |
| `assessment` | optional rubric — see §4 |

Strictness: every object allows **only** the fields defined in this document — any unknown field is a rejection. Validation is all-or-nothing: one violation anywhere rejects the whole document.

## 2. Difficulty

Difficulty controls the quality and complexity of the questions and reveals — the amount of ambiguity, the quality of available evidence, the number of plausible hypotheses, and the reasoning required to decide what to do next. It must NOT simply mean more questions, more choices, longer text, or more complicated vocabulary.

### Easy
Clear context, a clear problem, straightforward product decisions, 3–4 plausible professional choices. Reveals are direct, easy to interpret, strongly connected to the chosen action, high-signal. One or two major hypotheses, limited trade-offs. Minimum bar (at least one of): at least 1 convergence point in the graph, or at least one question offering a genuine (if low-stakes) choice between two reasonable next steps.

### Medium
Several plausible directions; the candidate must decide what evidence is most useful. Reveals provide useful but incomplete evidence, sometimes answer one hypothesis while opening another, and occasionally introduce a constraint (engineering, brand, legal, sales-driven). Minimum bars (all required): at least 2 convergence points; at least 1 reveal that answers one hypothesis while opening another; at least 1 reveal that introduces a constraint.

### Hard
Senior-level ambiguity: competing hypotheses, meaningful trade-offs, sometimes choosing what NOT to investigate, evidence that must be connected across multiple prior decisions. There should not be an obvious answer. Minimum bars (all required): at least 3 convergence points; at least 1 convergence point bringing together conflicting evidence the next question must reconcile; at least 2 genuinely ambiguous or partially-resolving reveals; at least 1 question where no choice is a clearly dominant "best" option.

The candidate should often have to decide "what evidence would be most valuable to obtain next?" rather than following the obvious path.

## 3. Core Data Model

Each question contains: `text`, `choices`, `bestChoice`
Each choice contains: `text`, `stage`, `reveal`, `next` — and optionally `quality`, `because`, `criteria`

The internal stages are: `FRAME`, `DIAGNOSE`, `STRATEGIZE`, `PRIORITIZE`, `PLAN`, `EXECUTE`, `MEASURE`
Stages are internal metadata only. Never show stages to the candidate.

What each stage means in a Product Management context:

- **FRAME** — Establishing the problem space: who the customer is, what outcome moved, what success would mean.
- **DIAGNOSE** — Root-causing the move: funnel and usage data, support tickets, sales feedback, segmentation, churn interviews.
- **STRATEGIZE** — Setting direction: bets, positioning, which segment to serve, what the company wins by choosing it.
- **PRIORITIZE** — Deciding what gets built and what does NOT: impact vs effort, dependencies, explicit trade-offs.
- **PLAN** — Turning direction into a roadmap: scoping, sequencing, milestones, rollout stages.
- **EXECUTE** — Shipping: specs, acceptance criteria, handoff to engineering/design, launch coordination.
- **MEASURE** — Learning: instrumentation, success metrics, post-launch review, iterate-or-kill decisions.

A candidate can move between stages freely (e.g., DIAGNOSE → STRATEGIZE → DIAGNOSE → PLAN → MEASURE is valid). Do not force a fixed sequence.

### `bestChoice` — required, internal

A 0-based index into that question's `choices` marking the strongest move; must satisfy `0 ≤ bestChoice < choices.length`. It is the answer key: candidates never see it, and it is what a finished run is scored against after it ends.

### Grading — optional, internal

A choice may also carry:

- `quality` — `best`, `reasonable`, or `poor`
- `because` — ≤500 chars, one sentence on why this is the strongest move (required on every `best`; it is what a candidate who missed it is shown *after* the run)
- `criteria` — array of rubric ids this move exercises

Grading rules: `quality` is **all-or-nothing per question** (tag every choice, or none); exactly one `"best"` per question, only at `bestChoice`; every `"best"` needs `because`. Semantics: `best` = the strongest reasoning; `reasonable` = defensible but it costs the candidate something; `poor` = a misstep whose reveal shows the failed consequence. Untagged questions are tolerated (`bestChoice` reads as best, the rest as poor) — **prefer full grading**.

### `reveal` — a sentence or a table

A reveal is either a plain sentence or a block that may carry a data table:

```json
"reveal": "The pilot accounts' seat expansion resumes within a month."
```

```json
"reveal": {
  "text": "The pilot cohort against its own baseline:",
  "table": {
    "caption": "Pilot accounts, first month",
    "columns": ["Measure", "Result"],
    "rows": [["Guest-to-seat conversion", "50%"], ["Seat expansion", "resumed"]]
  }
}
```

Table limits: `caption` optional; 1–6 `columns`; 1–50 `rows`; **every row has exactly as many cells as `columns`**; cells are strings ≤200 chars. The table is display-only; it never affects scoring. Good reveals advance the story with concrete numbers or customer quotes; a poor choice's reveal shows the failed consequence.

### `assessment` — optional rubric

```json
"assessment": {
  "criteria": [
    { "id": "evidence-first", "label": "Letting evidence lead", "guidance": "Name the driver before betting the roadmap." }
  ]
}
```

1–8 criteria (3–4 is the sweet spot); `id` — unique kebab-case slug ≤64 chars; `label` ≤120 chars; `guidance` ≤500 chars (the remediation line for a weak strand). Every best move must cite ≥1 declared criterion; every cited id must be declared here.

## 4. No Correct or Incorrect Choices

Every choice must represent a legitimate professional product-management action. No reveal may evaluate the candidate's decision (no "That was the right call", no "You should have prioritized differently"). Instead, always just provide information. The candidate's path is the result of their decisions, not a graded judgment. The internal `bestChoice`/`quality` layer is the one exception — invisible during play; it exists so the finished run can be scored after the fact.

## 5. Progressive Information

Do not reveal the complete problem at the beginning. The initial question should contain enough information to make a decision, but not enough to know the entire situation. Every choice reveals information relevant to that specific choice, answering: "What did the candidate learn because they chose this action?"

## 6. Meaningful Branching — Hard Rules

Different choices should create genuinely different paths, exposing different evidence. Branches may converge later. These rules are mandatory:

- **No cycles.** A `next` value must never point to a question that has already appeared earlier in that same path (includes indirect cycles A → B → C → A).
- **No self-loops.** A choice's `next` must never point back to the question it belongs to.
- **Minimum divergence.** From any branch point, each resulting branch must expose genuinely different evidence for at least its next two hops before it converges with another branch. Convergence by node-sharing is fine and expected; what is forbidden is *informational* collapse.
- **Convergence minimums.** See the per-difficulty minimum bars in Section 2 — convergence is a tool for controlling graph size, not a box to check.
- **No orphans.** Every question key must be reachable from `start` by following at least one sequence of choices.

If you want to send a choice "back" to an earlier question, route it forward instead — to a new or later-converging question that reflects what the candidate has now learned.

## 7. Question Quality

Every question should require a product decision.

Good: "Seat expansion stalled three months after signup. What do you diagnose next?"
Good: "Two directions are on the table and leadership wants both. What do you do?"
Bad: "What is a roadmap?"
Bad: "What does ARR stand for?"
Bad: "What is the correct solution?"

Do not turn the challenge into a trivia test or static question bank.

## 8. Challenge Length

Generate approximately: Easy 8–12 questions, Medium 10–16, Hard 12–20 (±20%). Do not increase difficulty simply by increasing question count — increase it per Section 2.

## 9. Worked Example (complete and valid)

This document is small but complete and valid — use it as the structural template and scale the narrative up per Section 2.

```json
{
  "id": "pm_feature_cut",
  "title": "The Roadmap Squeeze",
  "role": "Product Management",
  "difficulty": "medium",
  "summary": "Taskline is a project-management tool for small agencies — teams plan work, track tasks, and bill time in one place. Its customers are agency leads who pay per seat, and the company earns when whole teams adopt it and renew year after year.",
  "start": "Q1",
  "questions": {
    "Q1": {
      "text": "Seat expansion has stalled: accounts buy five seats and never add more, even as their teams grow. New-signup conversion is healthy. What do you do first?",
      "choices": [
        {
          "text": "Segment seat growth by account size and tenure",
          "stage": "DIAGNOSE",
          "reveal": "Small accounts never expand; mid-size agencies add seats for three months, then stop — the stall begins after onboarding, not at signup.",
          "next": "Q2",
          "quality": "reasonable",
          "criteria": [
            "evidence-first"
          ]
        },
        {
          "text": "Interview the leads of accounts that added zero seats in the last 90 days",
          "stage": "DIAGNOSE",
          "reveal": "The leads say the same thing in different words: freelancers join per-project, and 'a seat forever' doesn't fit how they hire.",
          "next": "Q3",
          "quality": "best",
          "criteria": [
            "evidence-first",
            "customer-impact"
          ],
          "because": "The people who stopped expanding can say why — their reasons isolate the cause faster than another cut of the same data."
        },
        {
          "text": "Reframe the goal: is the target seat expansion or total account growth?",
          "stage": "FRAME",
          "reveal": "Leadership's target is explicitly seat expansion — account growth is already healthy. The goal stays seats.",
          "next": "Q2",
          "quality": "reasonable",
          "criteria": [
            "customer-impact"
          ]
        },
        {
          "text": "Start speccing the reporting feature leadership asked for",
          "stage": "EXECUTE",
          "reveal": "A week goes into the spec while the stall goes undiagnosed — the build is aimed at a problem nobody has named.",
          "next": "END",
          "quality": "poor"
        }
      ],
      "bestChoice": 1
    },
    "Q2": {
      "text": "The stall starts after onboarding: accounts add seats for three months, then stop — and mid-size agencies drive it. What do you diagnose next?",
      "choices": [
        {
          "text": "Check whether new-seat invites and provisioning have friction",
          "stage": "DIAGNOSE",
          "reveal": "Invites are clean — provisioned seats go active within minutes. The friction isn't in the invite flow.",
          "next": "Q4",
          "quality": "reasonable",
          "criteria": [
            "evidence-first"
          ]
        },
        {
          "text": "Pull the timing: what changes in an account's third month",
          "stage": "DIAGNOSE",
          "reveal": "Month three is when agency projects end — the temporary teammates those projects hired simply leave, and nobody replaces them.",
          "next": "Q5",
          "quality": "best",
          "criteria": [
            "evidence-first"
          ],
          "because": "The stall has a clock on it — whatever changes at month three is closer to the cause than another aggregate cut."
        },
        {
          "text": "Compare renewal rates between stalled and expanding accounts",
          "stage": "DIAGNOSE",
          "reveal": "Stalled accounts renew at the same rate — they stay and pay; they just never grow. Retention isn't the issue.",
          "next": "Q4",
          "quality": "reasonable",
          "criteria": [
            "evidence-first"
          ]
        }
      ],
      "bestChoice": 1
    },
    "Q3": {
      "text": "Leads tell you freelancers join per-project and a permanent seat doesn't fit them. What do you do next?",
      "choices": [
        {
          "text": "Explore a per-project guest tier with three design-partner agencies",
          "stage": "STRATEGIZE",
          "reveal": "The leads like the direction; two ask the same question — 'will my seated leads still see the freelancer's work?'",
          "next": "Q5",
          "quality": "reasonable",
          "criteria": [
            "customer-impact",
            "trade-off-clarity"
          ]
        },
        {
          "text": "Size the opportunity first: how many stalled seats are freelancer-shaped, and what revenue rides on them",
          "stage": "STRATEGIZE",
          "reveal": "Roughly 60% of stalled seats sit in agencies with per-project hiring — a segment big enough to earn a roadmap slot.",
          "next": "Q6",
          "quality": "best",
          "criteria": [
            "evidence-first",
            "trade-off-clarity"
          ],
          "because": "A tier is only a good bet if the segment it serves is big enough to matter — sizing comes before the roadmap slot."
        },
        {
          "text": "Write the guest-tier PRD and hand it to engineering",
          "stage": "EXECUTE",
          "reveal": "The spec lands in a sprint before anyone knows whether freelancer-shaped demand is big enough to earn the build.",
          "next": "END",
          "quality": "poor"
        }
      ],
      "bestChoice": 1
    },
    "Q4": {
      "text": "Invites are frictionless and stalled accounts renew at the same rate — the stall is expansion-specific, not satisfaction-related. What do you do?",
      "choices": [
        {
          "text": "Take the freelancer pattern into strategy: size the segment and the offer that fits it",
          "stage": "STRATEGIZE",
          "reveal": "The diagnostics all point at per-project work — sizing that segment turns three dead ends into one decision.",
          "next": "Q6",
          "quality": "best",
          "criteria": [
            "trade-off-clarity",
            "evidence-first"
          ],
          "because": "Every thread ends at the same customer pattern — sizing it is the move that turns evidence into a decision."
        },
        {
          "text": "Ship the reporting feature leadership asked for",
          "stage": "EXECUTE",
          "reveal": "Reporting ships on time; seat counts stay flat — feature value that doesn't change the seat decision doesn't move expansion.",
          "next": "END",
          "quality": "reasonable",
          "criteria": [
            "customer-impact"
          ]
        },
        {
          "text": "Add automated expansion nudge emails at month three",
          "stage": "EXECUTE",
          "reveal": "Nudges bump seat adds for two weeks, then fade — pressure without a better offer.",
          "next": "END",
          "quality": "poor"
        }
      ],
      "bestChoice": 0
    },
    "Q5": {
      "text": "The evidence converges on freelancers: per-project work that a permanent seat doesn't fit. What do you do?",
      "choices": [
        {
          "text": "Position a per-project guest tier against the seat model and size the revenue trade-off",
          "stage": "STRATEGIZE",
          "reveal": "The tier trades a little seat revenue for a new expansion path — the trade-off is explicit and acceptable at the sized segment.",
          "next": "Q6",
          "quality": "best",
          "criteria": [
            "trade-off-clarity"
          ],
          "because": "The tier only makes sense if its trade-off with seat revenue is explicit — the direction and its cost get decided together."
        },
        {
          "text": "Scope a guest-tier pilot with the interviewed agencies",
          "stage": "PLAN",
          "reveal": "A ten-agency pilot scopes quickly, but without sizing the trade-off the pilot can't say what success should be.",
          "next": "Q6",
          "quality": "reasonable",
          "criteria": [
            "outcome-measurement"
          ]
        },
        {
          "text": "Instrument seat-add events more precisely and revisit next quarter",
          "stage": "MEASURE",
          "reveal": "Cleaner dashboards describe the stall; they don't change the offer that caused it.",
          "next": "END",
          "quality": "poor"
        }
      ],
      "bestChoice": 0
    },
    "Q6": {
      "text": "You've sized the opportunity and the guest tier is the front-runner. What settles whether it works?",
      "choices": [
        {
          "text": "Track guest-project creation across all accounts weekly",
          "stage": "MEASURE",
          "reveal": "Guest projects tick up, but without a comparison you can't tell the tier's effect from seasonal project churn.",
          "next": "END",
          "quality": "reasonable",
          "criteria": [
            "outcome-measurement"
          ]
        },
        {
          "text": "Pilot with ten agencies: measure guest-to-seat conversion and each account's seat expansion against its own baseline",
          "stage": "MEASURE",
          "reveal": "In the pilot, half the guest projects convert to paid members within a month, and pilot accounts' seat expansion resumes — the stall was the seat, not the product.",
          "next": "END",
          "quality": "best",
          "criteria": [
            "outcome-measurement",
            "customer-impact"
          ],
          "because": "A pilot cohort turns the tier into a measured bet — its effect on expansion is exactly the number the stall was about."
        },
        {
          "text": "Launch broadly and compare quarter-end revenue",
          "stage": "MEASURE",
          "reveal": "Quarter-end revenue can't separate the tier's effect from renewals — only the pilot cohort can.",
          "next": "END",
          "quality": "poor"
        }
      ],
      "bestChoice": 1
    }
  },
  "assessment": {
    "criteria": [
      {
        "id": "evidence-first",
        "label": "Letting evidence lead",
        "guidance": "Name the driver before betting the roadmap."
      },
      {
        "id": "customer-impact",
        "label": "Sizing customer impact",
        "guidance": "Ground the decision in what changes for the customer, not the feature count."
      },
      {
        "id": "trade-off-clarity",
        "label": "Making the trade-off explicit",
        "guidance": "Name what each direction costs — revenue, focus, or roadmap time."
      },
      {
        "id": "outcome-measurement",
        "label": "Proving the outcome",
        "guidance": "Define the measure that separates the bet's effect from noise before launch."
      }
    ]
  }
}
```

It demonstrates: branching with reconvergence and early poor-choice exits, full grading (`quality` + `because` on bests), a four-criterion rubric where every best move cites a strand, the strongest path's stage arc (DIAGNOSE → STRATEGIZE → MEASURE), and a PM-native incident (a business metric move, not a screen).

## 10. Final Validation — Required Before Output

Before returning the challenge, trace the graph, not estimate it:

**Step A — Enumerate every path.** Starting at `start`, list every distinct path of question keys from `start` to END. Do this explicitly, question by question.

**Step B — Check each path:** no question key appears twice (no cycles, direct or indirect); no choice's `next` equals its own question's key; every path terminates at END; each branch exposes genuinely different evidence for at least its next two hops before converging.

**Step C — Check the whole graph:** the JSON parses; `role` is exactly `"Product Management"`; `difficulty` is exactly `easy`, `medium`, or `hard`; `start` exists; every `next` is `"END"` or an existing key; no orphans; every question has 3–4 choices with `text`, `stage`, `reveal`, `next`; `bestChoice` present and in range; if grading: all-or-nothing per question, one `best` at `bestChoice`, `because` ≤500 on each best; if a rubric: unique kebab-case ids, `label` ≤120, `guidance` ≤500, every cited id declared, every best move cites ≥1; if a table: rectangular, ≤6 columns, ≤50 rows, cells ≤200 chars; every `stage` ∈ {FRAME, DIAGNOSE, STRATEGIZE, PRIORITIZE, PLAN, EXECUTE, MEASURE}; the difficulty's minimum bars are met (Section 2); question count within (or close to, ±20%) the Section 8 range.

**Step D — Content quality:** no reveal evaluates the candidate's decision; every reveal answers "what did the candidate learn from this specific action"; every question requires an actual product decision, not trivia; all content concerns Product Management reasoning, not visual design or engineering internals for their own sake; the challenge ends with a meaningful outcome.

If any check fails, fix the JSON and re-run Steps A–D before returning output.

## Output

Return ONLY the final valid JSON challenge. Do not include explanations, analysis, scoring, answer keys, recommended paths, path traces, or commentary outside the JSON.
