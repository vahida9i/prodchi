# Product Design Interview Challenge Generator

Create a complete interactive Product Design interview challenge.
The challenge is a predefined decision graph where the candidate makes design decisions, receives new information based on each decision, and then continues to the next predefined question.

The experience is: QUESTION → CHOICE → REVEAL → NEXT QUESTION → CHOICE → REVEAL → ... → END

The candidate controls the direction of the challenge through their choices, while the system controls all questions, choices, information, and branches.

Do not generate dynamic or AI-created branches.

This challenge type is exclusively for Product Design. Do not generate Product Management-style challenges (funnel/metrics/growth investigations, payment-conversion analytics, A/B-testing-for-revenue scenarios, etc.). Every question, choice, and reveal must center on design reasoning: user needs, interaction patterns, information architecture, visual/interaction trade-offs, usability evidence, accessibility, and design-system constraints — not business metrics or backend/technical root-cause analysis for their own sake.

## 1. Challenge Structure

Every challenge must have: `id`, `title`, `role`, `difficulty`, `start`, `questions`.
Optional: `summary`, `assessment`.

`role` must always be exactly: `"Product Design"`
`difficulty` must be exactly one of: `easy`, `medium`, `hard`

| Field | Rules |
|---|---|
| `id` | snake_case slug, unique (e.g. `onboarding_drop_off`) |
| `title` | The incident, not the company — "The Onboarding Drop-Off" |
| `role` | exactly `"Product Design"` |
| `difficulty` | `easy`, `medium`, or `hard` |
| `summary` | optional, ≤400 chars. The business brief: what the company is, who its customers are, how it earns. Never the incident or the numbers (that is Q1's job) and never "you are the designer" |
| `start` | `"Q1"` — must be an existing question key |
| `questions` | 1–200 questions, keyed `Q1`, `Q2`, … |
| `assessment` | optional rubric — see §4 |

Strictness: every object allows **only** the fields defined in this document — any unknown field is a rejection. Validation is all-or-nothing: one violation anywhere rejects the whole document.

Example skeleton:

```json
{
  "id": "onboarding_drop_off",
  "title": "The Onboarding Drop-Off",
  "role": "Product Design",
  "difficulty": "medium",
  "summary": "…",
  "start": "Q1",
  "questions": {},
  "assessment": { "criteria": [] }
}
```

## 2. Difficulty

Difficulty controls the quality and complexity of the questions and reveals. It is an instruction for how the challenge should be authored.
Difficulty must NOT simply mean: more questions, more choices, longer text, or more complicated vocabulary. Instead, difficulty should affect the amount of ambiguity, the quality of available evidence, the number of plausible design hypotheses, and the reasoning required to decide what to investigate, explore, or design next.

### Easy

Appropriate for a candidate relatively early in their design career. Questions should have a clear context, a relatively clear design problem, straightforward design decisions, 3–4 plausible professional choices, and avoid excessive ambiguity.

> "New users are dropping off during onboarding. What do you do?"

Reveals should be direct, easy to interpret, strongly connected to the selected action, and relatively high-signal.

> "62% of users abandon onboarding on the permissions screen."

Use: one or two major hypotheses, clear signals, limited trade-offs, relatively direct usability evidence, straightforward progression. Avoid: conflicting evidence, subtle signals, multiple competing constraints, highly ambiguous user behavior.

**Minimum bar for "easy" (must include at least one of):**
- At least 1 convergence point somewhere in the graph
- At least one question offering a genuine (if low-stakes) choice between two reasonable next steps

### Medium

Requires solid design reasoning. Questions should have several plausible directions, require the candidate to decide what evidence is most useful, introduce moderate ambiguity, and require connecting information from previous reveals.

> "Users abandon onboarding at different steps depending on the device they're using. What do you investigate next?"

Reveals should provide useful but incomplete evidence, sometimes answer one hypothesis while opening another, require connecting multiple signals, and occasionally introduce a constraint (design-system, engineering, brand, accessibility).

> "On mobile, most users drop at the permissions screen. On desktop, drop-off is spread evenly across all four onboarding steps."

**Minimum bar for "medium" (all required):**
- At least 2 convergence points across the graph
- At least 1 reveal that answers one hypothesis while opening another
- At least 1 reveal that introduces a constraint (design-system, engineering, brand, or accessibility)

### Hard

Simulates a challenging senior-level design interview. Difficulty comes from ambiguity and competing considerations, not complexity for its own sake.
Questions should have several highly plausible approaches, require prioritization, contain competing hypotheses, involve meaningful trade-offs, sometimes force the candidate to choose what NOT to investigate, and require connecting evidence across multiple previous decisions.

> "Onboarding completion has declined by 14%. Usability sessions show users hesitating on the permissions screen, but session recordings show most users who hesitate still complete onboarding. Meanwhile, support tickets about 'not understanding what the app does' have increased sharply. What do you investigate next?"

There should not be an obvious answer.
Reveals should provide evidence that may be incomplete, indirect, ambiguous, conflicting, dependent on context, or useful for one hypothesis but inconclusive for another.

> "Users who hesitate on the permissions screen but complete onboarding report significantly lower satisfaction in post-onboarding surveys, even though their completion rate is normal."

This should require the candidate to connect: user comprehension, emotional friction, completion metrics, and long-term engagement — not just a single "fix the screen" conclusion.

**Minimum bar for "hard" (all required):**
- At least 3 convergence points across the graph
- At least 1 convergence point brings together two paths that discovered conflicting or tension-creating evidence, so the following question must reconcile them
- At least 2 reveals that are genuinely ambiguous or only partially resolve the question that prompted them
- At least 1 question where no choice is a clearly dominant "best" option

The candidate should often have to decide "What evidence would be most valuable to obtain next?" rather than simply following the obvious investigation path.

## 3. Difficulty Must Affect Both Questions AND Reveals

Apply difficulty consistently. The schema stays identical across difficulty levels — only the content, reasoning difficulty, and the minimum bars in Section 2 change.

## 4. Core Data Model

Each question contains: `text`, `choices`, `bestChoice`
Each choice contains: `text`, `stage`, `reveal`, `next` — and optionally `quality`, `because`, `criteria`

The internal stages are: `FRAME`, `INVESTIGATE`, `DEFINE`, `EXPLORE`, `DESIGN`, `VALIDATE`
Stages are internal metadata only. Never show stages to the candidate.

What each stage means in a Product Design context:

- **FRAME** — Establishing or reframing the design problem itself: who the user is, what job they're trying to do, what "success" would look like.
- **INVESTIGATE** — Gathering evidence: usability sessions, session recordings, heatmaps, support tickets, analytics on user flows, interviews, competitive review, accessibility audits.
- **DEFINE** — Sharpening the problem: articulating user needs, naming constraints (technical, brand, accessibility, design-system), stating what must be true for a solution to work.
- **EXPLORE** — Generating and comparing design directions: sketches, wireframe concepts, alternative interaction patterns, considering multiple structural approaches before committing.
- **DESIGN** — Making concrete design decisions: layout, information hierarchy, navigation structure, interaction patterns, states (empty/error/loading), microcopy, accessibility choices.
- **VALIDATE** — Testing a direction: usability testing, A/B testing a design variant, prototype feedback, review with engineering/accessibility/design-system stakeholders.

A candidate can move between stages freely (e.g., INVESTIGATE → DESIGN → INVESTIGATE → DEFINE → VALIDATE is valid). Do not force a fixed sequence.

### `bestChoice` — required, internal

A 0-based index into that question's `choices` marking the strongest move; must satisfy `0 ≤ bestChoice < choices.length`. It is the answer key: candidates never see it, and it is what a finished run is scored against after it ends.

### Grading — optional, internal

A choice may also carry:

- `quality` — `best`, `reasonable`, or `poor`
- `because` — ≤500 chars, one sentence on why this is the strongest move (required on every `best`; it is what a candidate who missed it is shown *after* the run)
- `criteria` — array of rubric ids this move exercises

Grading rules:
- `quality` is **all-or-nothing per question**: tag every choice, or none. Two of four tagged is a rejection.
- Exactly one `"best"` per question, and only at `bestChoice`.
- Semantics: `best` = the strongest reasoning; `reasonable` = defensible but it costs the candidate something; `poor` = a misstep whose reveal shows the failed consequence.

Leaving every question untagged is tolerated (the choice at `bestChoice` reads as best, the rest as poor). **Prefer full grading** — it makes the after-run feedback richer.

### `reveal` — a sentence or a table

A reveal is either a plain sentence or a block that may carry a data table:

```json
"reveal": "Most users who drop off pause noticeably on the permissions screen before leaving."
```

```json
"reveal": {
  "text": "The recordings agree on where guest sessions stop:",
  "table": {
    "caption": "Where guest sessions abandon, last 30 days",
    "columns": ["Step", "Share of abandons"],
    "rows": [["Account form", "63%"], ["Payment fields", "22%"], ["Order review", "15%"]]
  }
}
```

Table limits: `caption` optional; 1–6 `columns`; 1–50 `rows`; **every row has exactly as many cells as `columns`** (rectangular, no ragged rows); cells are strings ≤200 chars — you decide the formatting, nothing is recomputed. The table is display-only; it never affects scoring.

### `assessment` — optional rubric

```json
"assessment": {
  "criteria": [
    { "id": "root-cause", "label": "Finding the root cause", "guidance": "The drop has one trigger — name it before fixing anything." }
  ]
}
```

- 1–8 criteria; 3–6 is the sweet spot. They are the challenge's own vocabulary — specific strands of design reasoning, not generic skills.
- `id` — kebab-case slug, ≤64 chars, unique.
- `label` — ≤120 chars.
- `guidance` — ≤500 chars — the remediation line for a weak strand.
- Every best move must cite ≥1 declared criterion; every cited id must be declared here.

## 5. No Correct or Incorrect Choices

Every choice must represent a legitimate professional design action. Do not mark any choice correct for the candidate: no true/false treatment, and no reveal may evaluate the candidate's decision (no reveals like "That was the right call" or "You should have tested with users first"). Instead, always just provide information:

> "Users who hesitate on the permissions screen report lower trust in how their data will be used."

The candidate's path is the result of their decisions, not a graded judgment.

The internal `bestChoice`/`quality` layer from §4 is the one exception — and it is invisible during play: it exists only so the finished run can be scored after the fact, and `because` is the miss-feedback shown to a candidate who made a different call, after their run ends. During the challenge itself, every choice is simply an action with its own information.

## 6. Progressive Information

Do not reveal the complete problem at the beginning. The initial question should contain enough information to make a decision, but not enough to know the entire situation. The candidate discovers the design problem progressively. Every choice should reveal information relevant to that specific choice, answering: "What did the candidate learn because they chose this action?"

## 7. Meaningful Branching — Hard Rules

Different choices should create genuinely different paths, exposing different evidence:

```
Q1
├── Review usability recordings → Q2
├── Talk to users who dropped off → Q3
├── Audit the current screen against the design system → Q4
└── Explore alternative onboarding structures → Q5
```

Branches may converge later:

```
Q2 ──────┐
Q3 ──────┤
Q4 ──────┼──→ Q8
Q5 ──────┘
```

These rules are mandatory, not aspirational — do not treat any of the following as optional:

- **No cycles.** A `next` value must never point to a question that has already appeared earlier in that same path. Every path must move strictly forward toward END. This includes indirect cycles (A → B → C → A), not just direct ones.
- **No self-loops.** A choice's `next` must never point back to the question it belongs to.
- **Minimum divergence.** From any branch point, each resulting branch must expose genuinely different evidence for at least its next two hops (distinct question nodes, or distinct reveals) before it converges with another branch. A branch whose first two hops re-expose the same information as a sibling branch is a violation, not a stylistic shortcut. (Convergence by node-sharing is fine and expected — see the diagram above and Example 1; what is forbidden is *informational* collapse.)
- **Convergence minimums.** See the per-difficulty minimum bars in Section 2. Convergence should keep the total question count within the target range in Section 10 — it is a tool for controlling graph size, not just a box to check.
- **No orphans.** Every question key in `questions` must be reachable from `start` by following at least one sequence of choices.

Negative example — what NOT to do (illustrates a forbidden cycle):

```
Q6 → (choice) → Q11
Q11 → (choice) → Q6      ✗ FORBIDDEN: Q6 already appeared earlier in this path
Q11 → (choice) → Q13     ✓ fine, as long as Q13 doesn't loop back either
```

If you find yourself wanting to send a choice "back" to a question the candidate could reach earlier in the same path, instead route it forward to a new or later-converging question that reflects what they've now learned — never literally back to the earlier node.

## 8. Stages Are Not a Sequence

Do not force a fixed order such as FRAME → INVESTIGATE → DEFINE → EXPLORE → DESIGN → VALIDATE. Non-linear movement between stages (including returning to an earlier stage, e.g., DESIGN → INVESTIGATE) is valid and encouraged where it reflects realistic design work. (Note: revisiting a stage is fine and expected; revisiting a question node is the forbidden cycle in Section 7.)

## 9. Question Quality

Every question should require a design decision.

Good: "Usability sessions show users hesitating on the permissions screen. What do you investigate next?"
Good: "Two onboarding directions test well with different user segments. What do you do?"
Bad: "What is a wireframe?"
Bad: "What is the definition of usability?"
Bad: "What is the correct solution?"

Do not turn the challenge into a trivia test or static question bank.

## 10. Challenge Length

Generate approximately:

- Easy: 8–12 questions
- Medium: 10–16 questions
- Hard: 12–20 questions

These are target ranges. Do not go more than ~20% outside them, and do not increase difficulty simply by increasing question count — increase it per Section 2.

## 11. Complete Worked Examples

### Example 1 — medium difficulty (minimal form)

This example demonstrates the required structure and the expected design-reasoning content. It uses the minimal valid form: no `quality`, `criteria`, or `assessment` — `bestChoice` alone is the answer key.

```json
{
  "id": "onboarding_drop_off",
  "title": "The Onboarding Drop-Off",
  "role": "Product Design",
  "difficulty": "medium",
  "start": "Q1",
  "questions": {
    "Q1": {
      "text": "Onboarding completion has dropped from 78% to 65% over the last month. What do you do?",
      "choices": [
        {
          "text": "Review usability session recordings from the last month",
          "stage": "INVESTIGATE",
          "reveal": "Most users who drop off pause noticeably on the permissions screen before leaving.",
          "next": "Q2"
        },
        {
          "text": "Talk to users who recently abandoned onboarding",
          "stage": "INVESTIGATE",
          "reveal": "Several users say they weren't sure why the app needed the permissions it asked for.",
          "next": "Q3"
        },
        {
          "text": "Check what changed in the onboarding flow recently",
          "stage": "INVESTIGATE",
          "reveal": "A new permissions screen was added three weeks ago to support a location-based feature.",
          "next": "Q4"
        },
        {
          "text": "Define what 'successful onboarding' should mean before investigating further",
          "stage": "DEFINE",
          "reveal": "Success was previously defined purely as 'reached the home screen,' with no measure of user understanding.",
          "next": "Q5"
        }
      ],
      "bestChoice": 1
    },
    "Q2": {
      "text": "Users pause noticeably on the permissions screen before many of them leave. What do you investigate next?",
      "choices": [
        {
          "text": "Break down drop-off by device type",
          "stage": "INVESTIGATE",
          "reveal": {
            "text": "On mobile, most drop-off happens on the permissions screen. On desktop, drop-off is spread evenly across all steps.",
            "table": {
              "caption": "Where drop-off concentrates",
              "columns": [
                "Platform",
                "Drop-off pattern"
              ],
              "rows": [
                [
                  "Mobile",
                  "Concentrated on the permissions screen"
                ],
                [
                  "Desktop",
                  "Spread evenly across all steps"
                ]
              ]
            }
          },
          "next": "Q6"
        },
        {
          "text": "Review what the permissions screen currently communicates",
          "stage": "INVESTIGATE",
          "reveal": "The screen lists the permissions requested but doesn't explain why they're needed or what happens if a user declines.",
          "next": "Q7"
        },
        {
          "text": "Check whether declining a permission blocks onboarding entirely",
          "stage": "INVESTIGATE",
          "reveal": "Declining any permission currently stops onboarding, with no way to continue.",
          "next": "Q8"
        }
      ],
      "bestChoice": 0
    },
    "Q3": {
      "text": "Several users say they weren't sure why the app needed the permissions it asked for. What do you do next?",
      "choices": [
        {
          "text": "Review what the permissions screen currently communicates",
          "stage": "INVESTIGATE",
          "reveal": "The screen lists the permissions requested but doesn't explain why they're needed or what happens if a user declines.",
          "next": "Q7"
        },
        {
          "text": "Check whether this is a new problem or a longstanding one",
          "stage": "INVESTIGATE",
          "reveal": "The permissions screen was added three weeks ago; before that, onboarding didn't request these permissions at all.",
          "next": "Q4"
        },
        {
          "text": "Define what information users need before granting a permission",
          "stage": "DEFINE",
          "reveal": "Users need to understand what the permission enables, what happens if they decline, and whether they can change their mind later.",
          "next": "Q9"
        }
      ],
      "bestChoice": 1
    },
    "Q4": {
      "text": "A new permissions screen was added three weeks ago to support a location-based feature. What do you do next?",
      "choices": [
        {
          "text": "Compare onboarding completion before and after the screen was added",
          "stage": "INVESTIGATE",
          "reveal": "Completion was stable at 78% before the screen was added and has declined steadily since.",
          "next": "Q6"
        },
        {
          "text": "Check whether the permission is required or optional for core app use",
          "stage": "INVESTIGATE",
          "reveal": "The location permission is only needed for one optional feature, not for the app's core functionality.",
          "next": "Q8"
        },
        {
          "text": "Explore whether this permission request could happen later, in context",
          "stage": "EXPLORE",
          "reveal": "Other permissions in the app are currently requested contextually, at the moment they're needed, except this one.",
          "next": "Q10"
        }
      ],
      "bestChoice": 0
    },
    "Q5": {
      "text": "Success was previously defined only as 'reached the home screen,' with no measure of understanding. What do you do next?",
      "choices": [
        {
          "text": "Investigate what users understand about the app right after onboarding",
          "stage": "INVESTIGATE",
          "reveal": "In short follow-up surveys, many users who completed onboarding can't clearly explain what the location permission was for.",
          "next": "Q9"
        },
        {
          "text": "Investigate where users hesitate during onboarding",
          "stage": "INVESTIGATE",
          "reveal": "Most users who drop off pause noticeably on the permissions screen before leaving.",
          "next": "Q2"
        },
        {
          "text": "Define what onboarding needs to achieve beyond completion",
          "stage": "DEFINE",
          "reveal": "Onboarding should leave users understanding what they agreed to and confident they can proceed.",
          "next": "Q9"
        }
      ],
      "bestChoice": 1
    },
    "Q6": {
      "text": "Drop-off on the permissions screen is concentrated on mobile, while desktop drop-off is spread across all steps. What do you investigate next?",
      "choices": [
        {
          "text": "Review how the permissions screen renders on mobile specifically",
          "stage": "INVESTIGATE",
          "reveal": "On smaller screens, the explanation text is truncated, leaving only the permission name and two buttons visible.",
          "next": "Q7"
        },
        {
          "text": "Investigate the general desktop drop-off separately",
          "stage": "INVESTIGATE",
          "reveal": "Desktop drop-off appears linked to overall onboarding length, not any single screen.",
          "next": "Q11"
        },
        {
          "text": "Check whether the permissions screen is mandatory on both platforms",
          "stage": "INVESTIGATE",
          "reveal": "The permissions screen is mandatory on both platforms, with no option to skip and return later.",
          "next": "Q8"
        }
      ],
      "bestChoice": 0
    },
    "Q7": {
      "text": "The permissions screen lists what's requested but doesn't explain why it's needed or what happens if declined. What do you do?",
      "choices": [
        {
          "text": "Define the information users actually need at this step",
          "stage": "DEFINE",
          "reveal": "Users need to understand the purpose of the permission, the consequence of declining, and that the choice can be changed later.",
          "next": "Q9"
        },
        {
          "text": "Explore alternative ways to present this screen",
          "stage": "EXPLORE",
          "reveal": "Options include an inline explanation, a contextual request tied to the relevant feature, or a benefit-led framing before the system prompt.",
          "next": "Q10"
        },
        {
          "text": "Check how similar permission requests are handled elsewhere in the app",
          "stage": "INVESTIGATE",
          "reveal": "Other permissions in the app are requested contextually, with a short explanation shown just before the system prompt.",
          "next": "Q10"
        }
      ],
      "bestChoice": 0
    },
    "Q8": {
      "text": "Declining the permission currently blocks onboarding entirely, even though the permission is only needed for one optional feature. What do you do next?",
      "choices": [
        {
          "text": "Define what should happen if a user declines",
          "stage": "DEFINE",
          "reveal": "If declined, users should be able to continue onboarding and enable the feature later from settings.",
          "next": "Q9"
        },
        {
          "text": "Explore letting users skip and continue onboarding",
          "stage": "EXPLORE",
          "reveal": "Removing the hard block would require a way to re-prompt for the permission later, in context.",
          "next": "Q10"
        },
        {
          "text": "Check with engineering whether the feature can degrade gracefully without the permission",
          "stage": "INVESTIGATE",
          "reveal": "Engineering confirms the feature can be fully disabled without the permission, with no impact on the rest of the app.",
          "next": "Q10"
        }
      ],
      "bestChoice": 0
    },
    "Q9": {
      "text": "You've defined what users need to understand before granting this permission. What do you do next?",
      "choices": [
        {
          "text": "Explore how to communicate this at the right moment",
          "stage": "EXPLORE",
          "reveal": "Two directions emerge: explain everything upfront in onboarding, or move the request to the moment the feature is first used.",
          "next": "Q10"
        },
        {
          "text": "Design a revised permissions screen with clearer explanation",
          "stage": "DESIGN",
          "reveal": "A revised screen adds a short explanation and a visible 'you can change this later' note.",
          "next": "Q12"
        },
        {
          "text": "Investigate whether moving the request later is technically feasible",
          "stage": "INVESTIGATE",
          "reveal": "Engineering confirms the permission can be requested contextually rather than during onboarding.",
          "next": "Q10"
        }
      ],
      "bestChoice": 0
    },
    "Q10": {
      "text": "Two directions are on the table: keep the request in onboarding with better explanation, or move it to when the feature is first used. What do you do?",
      "choices": [
        {
          "text": "Design both directions as low-fidelity concepts to compare",
          "stage": "DESIGN",
          "reveal": "The contextual version removes one full step from onboarding but requires a new prompt inside the feature itself.",
          "next": "Q13"
        },
        {
          "text": "Explore the trade-offs of each direction with stakeholders",
          "stage": "EXPLORE",
          "reveal": "Engineering notes the contextual version is straightforward to build; analytics notes it will be harder to track permission grant rate against onboarding.",
          "next": "Q13"
        },
        {
          "text": "Design the contextual version as the primary direction",
          "stage": "DESIGN",
          "reveal": "The contextual prompt appears the first time a user taps the location-based feature, with a short explanation and a system prompt.",
          "next": "Q12"
        }
      ],
      "bestChoice": 0
    },
    "Q11": {
      "text": "Desktop drop-off appears tied to overall onboarding length rather than a single screen. What do you do next?",
      "choices": [
        {
          "text": "Investigate which steps users spend the most time on",
          "stage": "INVESTIGATE",
          "reveal": "Two steps account for most of the time spent: the permissions screen and a preferences-setup step.",
          "next": "Q13"
        },
        {
          "text": "Explore reducing the number of required onboarding steps",
          "stage": "EXPLORE",
          "reveal": "The preferences-setup step could be deferred to a later moment without blocking core app use.",
          "next": "Q13"
        },
        {
          "text": "Define what must happen during onboarding versus what can happen later",
          "stage": "DEFINE",
          "reveal": "Only account creation and the location permission decision are strictly required upfront; everything else can be deferred.",
          "next": "Q13"
        }
      ],
      "bestChoice": 0
    },
    "Q12": {
      "text": "You have a concrete design direction for the permissions request. What do you do before releasing it?",
      "choices": [
        {
          "text": "Run a usability test comparing it to the current version",
          "stage": "VALIDATE",
          "reveal": "Users understand the purpose of the permission significantly more often with the new version, and fewer hesitate before deciding.",
          "next": "Q14"
        },
        {
          "text": "Review the direction with engineering and accessibility",
          "stage": "VALIDATE",
          "reveal": "The design is technically feasible and passes an accessibility review, with one note about contrast on the explanation text.",
          "next": "Q14"
        },
        {
          "text": "Test it with users who previously declined the permission",
          "stage": "VALIDATE",
          "reveal": "Several previously-declining users say they would grant the permission now that they understand what it's for.",
          "next": "Q14"
        }
      ],
      "bestChoice": 0
    },
    "Q13": {
      "text": "You're deciding between deferring parts of onboarding versus keeping the flow as-is with better explanations. What do you do?",
      "choices": [
        {
          "text": "Prototype a shortened onboarding flow and test it",
          "stage": "VALIDATE",
          "reveal": "A shortened flow tests well for completion, but a few users express uncertainty about whether onboarding is 'finished.'",
          "next": "Q14"
        },
        {
          "text": "Design a version that clearly signals deferred steps can be completed later",
          "stage": "DESIGN",
          "reveal": "Adding a lightweight 'finish setup later' indicator addresses the completion-uncertainty concern from testing.",
          "next": "Q14"
        },
        {
          "text": "Review the shortened flow with the design-system team",
          "stage": "VALIDATE",
          "reveal": "The design-system team confirms the deferred-step pattern already exists elsewhere in the app and can be reused here.",
          "next": "Q14"
        }
      ],
      "bestChoice": 0
    },
    "Q14": {
      "text": "The revised onboarding direction has been validated with users, engineering, and accessibility review. What do you do next?",
      "choices": [
        {
          "text": "Release it gradually and monitor onboarding completion",
          "stage": "VALIDATE",
          "reveal": "Onboarding completion recovers to 76% within two weeks of the gradual rollout.",
          "next": "END"
        },
        {
          "text": "Expand the rollout while monitoring post-onboarding understanding",
          "stage": "VALIDATE",
          "reveal": "Follow-up surveys show a significant increase in users who can correctly explain what the permission is used for.",
          "next": "END"
        },
        {
          "text": "Document the new pattern for reuse in future permission requests",
          "stage": "DEFINE",
          "reveal": "The pattern is added to the design system as the standard approach for contextual permission requests.",
          "next": "END"
        }
      ],
      "bestChoice": 0
    }
  }
}
```

### Example 2 — easy difficulty (fully graded, with rubric and a table reveal)

The same schema in its richest form: every choice graded (`quality` + `because` on bests), a 3-criterion rubric, one reveal carrying a data table, and fan-in branching — Q1's two investigation moves feed Q2, and all three Q2 fixes feed the single decision point Q3. Note the strongest path's stage arc — INVESTIGATE → DESIGN → VALIDATE — while the poor Q1 choice jumps straight to DESIGN: rushing to a fix is what makes it poor.

(This example is deliberately shorter than the Section 10 target range so the grading, rubric, and table layers stay readable. A real easy challenge must still carry 8–12 questions with the Section 2 minimum bars.)

```json

{
  "id": "checkout_guest_abandon",
  "title": "The Guest Checkout Wall",
  "role": "Product Design",
  "difficulty": "easy",
  "summary": "Meridian Tickets is an event-ticketing app where fans buy seats in a couple of taps. Its customers are one-time concertgoers arriving from artist newsletters and ads, and the company earns on each ticket sold — but only when checkout completes.",
  "start": "Q1",
  "questions": {
    "Q1": {
      "text": "Guest checkout completion fell from 71% to 58% this month, and nearly all of the loss sits at the payment step, where guests are asked to create an account before paying. What do you do first?",
      "choices": [
        {
          "text": "Break the drop-down by device and by traffic source",
          "stage": "INVESTIGATE",
          "reveal": "The loss is even across devices and sources — this is not a segment problem, it is the step itself.",
          "next": "Q2",
          "quality": "reasonable",
          "criteria": ["diagnose-first"]
        },
        {
          "text": "Watch session recordings of guests abandoning the payment step",
          "stage": "INVESTIGATE",
          "reveal": {
            "text": "The recordings agree on where guest sessions stop:",
            "table": {
              "caption": "Where guest sessions abandon, last 30 days",
              "columns": ["Step", "Share of abandons"],
              "rows": [
                ["Account form", "63%"],
                ["Payment fields", "22%"],
                ["Order review", "15%"]
              ]
            }
          },
          "next": "Q2",
          "quality": "best",
          "criteria": ["diagnose-first"],
          "because": "Watching the moment of abandonment shows why guests leave before anyone proposes a fix."
        },
        {
          "text": "Delete the account requirement so guests can check out",
          "stage": "DESIGN",
          "reveal": "Completion ticks up two points for a week, then support tickets arrive from guests who can no longer find their orders.",
          "next": "END",
          "quality": "poor"
        }
      ],
      "bestChoice": 1
    },
    "Q2": {
      "text": "Your investigation points at the account-creation wall sitting before payment. What do you do?",
      "choices": [
        {
          "text": "Shorten the account form to a single email field",
          "stage": "DESIGN",
          "reveal": "A shorter form helps a little, but guests still hesitate at any account ask before they have paid.",
          "next": "Q3",
          "quality": "reasonable",
          "criteria": ["remove-the-wall"]
        },
        {
          "text": "Move the account offer to after payment confirmation, so guests pay first",
          "stage": "DESIGN",
          "reveal": "In the prototype, guests reach payment without slowing down, and most accept the account offer once the ticket is already theirs.",
          "next": "Q3",
          "quality": "best",
          "criteria": ["remove-the-wall"],
          "because": "It removes the wall from the payment path while keeping accounts optional — the evidence blamed the ask, not the payment."
        },
        {
          "text": "Rewrite the form's helper copy to reassure guests",
          "stage": "DESIGN",
          "reveal": "Softer copy barely moves completion — reassurance does not remove the step.",
          "next": "Q3",
          "quality": "poor"
        }
      ],
      "bestChoice": 1
    },
    "Q3": {
      "text": "Whatever shipped is now live for a small slice of new guests. What settles whether it worked?",
      "choices": [
        {
          "text": "Watch support-ticket volume for a week",
          "stage": "VALIDATE",
          "reveal": "Tickets stay quiet, but quiet tickets say nothing about completion — the metric you set out to fix is still unmeasured.",
          "next": "END",
          "quality": "reasonable",
          "criteria": ["prove-it"]
        },
        {
          "text": "Compare checkout completion on the new slice against the old flow's 58% baseline",
          "stage": "VALIDATE",
          "reveal": "Completion on the new flow climbs to 69% in the first week of the comparison — the wall was the ask.",
          "next": "END",
          "quality": "best",
          "criteria": ["prove-it"],
          "because": "A like-for-like comparison on the metric you set out to fix turns the change into evidence."
        },
        {
          "text": "Ship it to everyone and move on to the next roadmap item",
          "stage": "VALIDATE",
          "reveal": "Without a comparison, nobody can tell a real gain from a good week — and the next incident starts from that blind spot.",
          "next": "END",
          "quality": "poor"
        }
      ],
      "bestChoice": 1
    }
  },
  "assessment": {
    "criteria": [
      { "id": "diagnose-first", "label": "Letting evidence lead", "guidance": "Name where the loss happens before touching the flow." },
      { "id": "remove-the-wall", "label": "Removing the wall from the payment path", "guidance": "Fix the step the evidence points at, not its wording." },
      { "id": "prove-it", "label": "Proving the change worked", "guidance": "Compare against the same baseline on the same metric." }
    ]
  }
}
```

## 12. Final Validation — Required Before Output

Before returning the challenge, you must actually trace the graph, not estimate it. Do this as an internal step:

### Step A — Enumerate every path

Starting at `start`, list out every distinct path of question keys from `start` to END (or note if a path doesn't reach END). Do this explicitly, question by question — do not skip this step or assume it based on how the graph "looks."

### Step B — Check each path against these rules

- No question key appears twice in the same path (no cycles, direct or indirect)
- No choice's `next` equals its own question's key (no self-loops)
- Every path terminates at END
- From each branch point, every branch exposes genuinely different evidence for at least its next two hops before converging (Section 7, rule 3)

### Step C — Check the whole graph

- The JSON is valid and parses correctly
- `role` is exactly `"Product Design"`; `difficulty` is exactly `easy`, `medium`, or `hard`
- `start` references an existing question key
- Every `next` value is either `"END"` or an existing question key
- Every question in `questions` was visited in at least one path from Step A (no orphans)
- Every question has 3–4 choices, and every choice has all four required fields: `text`, `stage`, `reveal`, `next`
- Every question has `bestChoice`, and it is in range (`0 ≤ bestChoice < choices.length`)
- If grading: `quality` on all choices of a question or none; exactly one `best`, at `bestChoice`; every `best` has `because` (≤500 chars)
- If a rubric: criterion ids unique kebab-case, `label` ≤120, `guidance` ≤500; every cited id declared; every best move cites ≥1
- If a table reveal: rectangular rows, ≤6 columns, ≤50 rows, cells ≤200 chars
- Every stage value is one of the six valid stages
- The graph meets the minimum-bar requirements for its stated difficulty (Section 2)
- Total question count falls within (or close to, ±20%) the target range for the stated difficulty (Section 10)

### Step D — Content quality

- No choice is marked correct/incorrect **to the candidate**, and no reveal evaluates the candidate's decision
- Every reveal answers "what did the candidate learn from this specific action" and is meaningfully different from other reveals reachable from the same question
- Every question requires an actual design decision, not a definition or trivia recall
- All content concerns Product Design reasoning (user needs, interaction/visual decisions, usability evidence, design-system/accessibility constraints), not business-metrics analytics for its own sake
- The difficulty level's ambiguity and evidence quality matches Section 2's minimum bars, not just its question count
- The challenge ends with a meaningful outcome, not a graded score

If any check in Steps B, C, or D fails, fix the JSON and re-run Steps A–D before returning output. Do not return a challenge that hasn't been traced this way.

## Output

Return ONLY the final valid JSON challenge. Do not include explanations, analysis, scoring, answer keys, recommended paths, path traces, or commentary outside the JSON.
