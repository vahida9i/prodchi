import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { validateChallengeImport } from './validator'
import { MAX_SUMMARY } from './challenge-schema'
import type { ChallengeImport, ChallengeImportInput, RevealBlock } from './challenge-schema'

const FIXTURE_PATH = fileURLToPath(new URL('../../docs/fixtures/onboarding-drop-off.json', import.meta.url))
const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf-8')) as ChallengeImport

function mutate(fn: (challenge: ChallengeImport) => void): unknown {
  const copy = JSON.parse(JSON.stringify(fixture)) as ChallengeImport
  fn(copy)
  return copy
}

test('accepts the traced end-to-end fixture', () => {
  const result = validateChallengeImport(fixture)
  assert.equal(result.valid, true, `expected no errors, got: ${JSON.stringify(result.errors)}`)
  assert.deepEqual(result.errors, [])
  assert.ok(result.parsed)
  assert.equal(result.parsed!.id, 'onboarding_drop_off')
})

test('rejects a start key that does not exist in questions', () => {
  const result = validateChallengeImport(mutate(c => { c.start = 'Q99' }))
  assert.equal(result.valid, false)
  assert.ok(result.errors.some(e => e.path === 'start' && e.message.includes('Q99')))
})

test('rejects a next that is neither END nor an existing question key', () => {
  const result = validateChallengeImport(mutate(c => { c.questions.Q14.choices[0].next = 'Q99' }))
  assert.equal(result.valid, false)
  assert.ok(result.errors.some(e => e.path === 'questions.Q14.choices[0].next' && e.message.includes('Q99')))
})

test('rejects a self-loop', () => {
  const result = validateChallengeImport(mutate(c => { c.questions.Q2.choices[0].next = 'Q2' }))
  assert.equal(result.valid, false)
  assert.ok(result.errors.some(e => e.message.includes('Question Q2 loops back to itself')))
})

test('rejects a cycle and reports the concrete chain', () => {
  // Q12 → Q14 already exists; pointing Q14 back at Q12 closes the loop.
  // The chain is reported from whichever edge closes the loop first in the
  // DFS, so assert on the loop's nodes rather than the exact edge order.
  const result = validateChallengeImport(mutate(c => { c.questions.Q14.choices[0].next = 'Q12' }))
  assert.equal(result.valid, false)
  assert.ok(
    result.errors.some(e =>
      e.message.includes('loops back') &&
      e.message.includes('Q12') &&
      e.message.includes('Q14')
    ),
    `expected a cycle error with the chain, got: ${JSON.stringify(result.errors)}`
  )
})

test('rejects orphaned questions', () => {
  // Q11 is only referenced by Q6's second choice; redirect it elsewhere
  const result = validateChallengeImport(mutate(c => { c.questions.Q6.choices[1].next = 'Q13' }))
  assert.equal(result.valid, false)
  assert.ok(
    result.errors.some(e => e.path === 'questions.Q11' && e.message.includes('never reachable')),
    `expected an orphan error for Q11, got: ${JSON.stringify(result.errors)}`
  )
})

test('rejects fewer than 3 choices', () => {
  const result = validateChallengeImport(mutate(c => { c.questions.Q14.choices = c.questions.Q14.choices.slice(0, 2) }))
  assert.equal(result.valid, false)
  assert.ok(result.errors.some(e => e.path.startsWith('questions.Q14.choices')))
})

test('rejects unknown top-level fields', () => {
  const result = validateChallengeImport(mutate(c => { (c as any).hiddenCase = {} }))
  assert.equal(result.valid, false)
  assert.ok(result.errors.some(e => e.path === 'hiddenCase'))
})

test('rejects an internal stage value outside the enum (DECIDE was removed)', () => {
  const result = validateChallengeImport(mutate(c => { c.questions.Q1.choices[0].stage = 'DECIDE' as any }))
  assert.equal(result.valid, false)
  assert.ok(result.errors.some(e => e.path === 'questions.Q1.choices[0].stage'))
})

test('rejects an unknown role', () => {
  const result = validateChallengeImport(mutate(c => { c.role = 'Data Science' as any }))
  assert.equal(result.valid, false)
  assert.ok(result.errors.some(e => e.path === 'role'))
})

test('accepts a Product Management challenge whose stages speak the PM vocabulary', async () => {
  const { readFileSync } = await import('node:fs')
  const { fileURLToPath } = await import('node:url')
  const pmFixture = JSON.parse(readFileSync(
    fileURLToPath(new URL('../../docs/fixtures/pm-feature-cut.json', import.meta.url)), 'utf-8'
  ))
  const result = validateChallengeImport(pmFixture)
  assert.equal(result.valid, true, `expected no errors, got: ${JSON.stringify(result.errors)}`)
})

test('rejects a Product Management challenge using a Product Design stage', async () => {
  const { readFileSync } = await import('node:fs')
  const { fileURLToPath } = await import('node:url')
  const pmFixture = JSON.parse(readFileSync(
    fileURLToPath(new URL('../../docs/fixtures/pm-feature-cut.json', import.meta.url)), 'utf-8'
  ))
  pmFixture.questions.Q1.choices[0].stage = 'DISCOVER'
  const result = validateChallengeImport(pmFixture)
  assert.equal(result.valid, false)
  assert.ok(
    result.errors.some(e =>
      e.path === 'questions.Q1.choices[0].stage' && e.message.includes('Product Management process')
    ),
    `expected a per-role stage error, got: ${JSON.stringify(result.errors)}`
  )
})

test('rejects a Product Design challenge using a Product Management stage', () => {
  const result = validateChallengeImport(mutate(c => { c.questions.Q1.choices[0].stage = 'PRIORITIZE' as any }))
  assert.equal(result.valid, false)
  assert.ok(
    result.errors.some(e =>
      e.path === 'questions.Q1.choices[0].stage' && e.message.includes('Product Design process')
    ),
    `expected a per-role stage error, got: ${JSON.stringify(result.errors)}`
  )
})

test('rejects the retired PD vocabulary on a Product Design challenge', () => {
  for (const retired of ['INVESTIGATE', 'EXPLORE', 'VALIDATE']) {
    const result = validateChallengeImport(mutate(c => { c.questions.Q1.choices[0].stage = retired as any }))
    assert.equal(result.valid, false, `expected ${retired} to be rejected`)
    assert.ok(
      result.errors.some(e =>
        e.path === 'questions.Q1.choices[0].stage' && e.message.includes('Product Design process')
      ),
      `expected a per-role stage error for ${retired}, got: ${JSON.stringify(result.errors)}`
    )
  }
})

test('rejects an empty questions map', () => {
  const result = validateChallengeImport(mutate(c => { c.questions = {} }))
  assert.equal(result.valid, false)
  assert.ok(result.errors.some(e => e.path === 'questions' && e.message.includes('at least one question')))
})

test('rejects a bestChoice outside the question\'s choice range', () => {
  // Q2 has 3 choices, so index 3 ("D") is not a real option. This is the
  // common authoring failure: the format has no option letters, and 13 of the
  // fixture's 14 questions have only 3 choices.
  const result = validateChallengeImport(mutate(c => { c.questions.Q2.bestChoice = 3 }))
  assert.equal(result.valid, false)
  assert.ok(
    result.errors.some(e => e.path === 'questions.Q2.bestChoice' && e.message.includes('between 0 and 2')),
    `expected a bestChoice range error, got: ${JSON.stringify(result.errors)}`
  )
})

test('rejects a negative or non-integer bestChoice', () => {
  const negative = validateChallengeImport(mutate(c => { c.questions.Q1.bestChoice = -1 }))
  assert.equal(negative.valid, false)
  assert.ok(negative.errors.some(e => e.path === 'questions.Q1.bestChoice'))

  const fractional = validateChallengeImport(mutate(c => { c.questions.Q1.bestChoice = 1.5 }))
  assert.equal(fractional.valid, false)
  assert.ok(fractional.errors.some(e => e.path === 'questions.Q1.bestChoice'))
})

test('rejects a missing bestChoice', () => {
  const result = validateChallengeImport(mutate(c => { delete (c.questions.Q5 as any).bestChoice }))
  assert.equal(result.valid, false)
  assert.ok(result.errors.some(e => e.path === 'questions.Q5.bestChoice'))
})

test('rejects more than 200 questions (DoS guard)', () => {
  const COUNT = 201
  // Authored (input) shape: a reveal may still be a plain sentence.
  const questions: ChallengeImportInput['questions'] = {}
  for (let i = 0; i < COUNT; i++) {
    const next = i === COUNT - 1 ? 'END' : `Q${i + 1}`
    questions[`Q${i}`] = {
      text: `Question ${i}`,
      choices: [0, 1, 2].map(k => ({
        text: `choice ${k}`,
        stage: 'INVESTIGATE' as const,
        reveal: `reveal ${k}`,
        next
      })),
      bestChoice: 0
    }
  }
  // Acyclic, fully reachable, valid `next` values — only the size cap fails.
  const oversized = { ...fixture, id: 'oversized', start: 'Q0', questions }
  const result = validateChallengeImport(oversized)
  assert.equal(result.valid, false)
  assert.ok(
    result.errors.some(e => e.path === 'questions' && e.message.includes('at most 200')),
    `expected a size-cap error, got: ${JSON.stringify(result.errors)}`
  )
})

// ---------------------------------------------------------------------------
// Reveals: a sentence (legacy), or a block that may carry a table
// ---------------------------------------------------------------------------

/** Replaces one choice's reveal with an authored value, whatever its shape. */
function withReveal(value: unknown): unknown {
  return mutate(c => { (c.questions.Q1.choices[0] as { reveal: unknown }).reveal = value })
}

test('normalizes a legacy sentence reveal into a block', () => {
  const result = validateChallengeImport(fixture)
  assert.equal(result.valid, true, JSON.stringify(result.errors))
  const reveal = result.parsed!.questions.Q1.choices[0].reveal as RevealBlock
  assert.deepEqual(reveal, {
    text: 'Most users who drop off pause noticeably on the permissions screen before leaving.'
  })
})

test('accepts a reveal with text and a table', () => {
  const reveal = {
    text: 'Conversion is flat across all variants:',
    table: {
      caption: 'Variant results, week 2',
      columns: ['Variant', 'Visitors', 'Conversion'],
      rows: [['Control', '12,480', '3.0%'], ['Short copy', '12,511', '3.0%']]
    }
  }
  const result = validateChallengeImport(withReveal(reveal))
  assert.equal(result.valid, true, JSON.stringify(result.errors))
  assert.deepEqual(result.parsed!.questions.Q1.choices[0].reveal, reveal)
})

test('accepts a table-only reveal', () => {
  const result = validateChallengeImport(withReveal({
    table: { columns: ['Period', 'Completion'], rows: [['Before', '60%'], ['After', '71%']] }
  }))
  assert.equal(result.valid, true, JSON.stringify(result.errors))
  const reveal = result.parsed!.questions.Q1.choices[0].reveal as RevealBlock
  assert.equal(reveal.table?.rows.length, 2)
})

test('rejects a reveal with neither text nor table', () => {
  const result = validateChallengeImport(withReveal({}))
  assert.equal(result.valid, false)
  assert.ok(
    result.errors.some(e =>
      e.path === 'questions.Q1.choices[0].reveal' && e.message.includes('"text", "table", or both')
    ),
    `expected a missing-content error, got: ${JSON.stringify(result.errors)}`
  )
})

test('rejects a ragged table and names the offending row', () => {
  const result = validateChallengeImport(withReveal({
    table: {
      columns: ['Variant', 'Visitors', 'Conversion'],
      rows: [['Control', '12,480', '3.0%'], ['Short copy', '12,511']]
    }
  }))
  assert.equal(result.valid, false)
  assert.ok(
    result.errors.some(e =>
      e.path.includes('reveal.table.rows[1]') && e.message.includes('2 cells but "columns" has 3')
    ),
    `expected a ragged-row error with its row index, got: ${JSON.stringify(result.errors)}`
  )
})

test('rejects a table wider than the column cap', () => {
  const columns = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
  const result = validateChallengeImport(withReveal({
    table: { columns, rows: [columns.map(() => 'x')] }
  }))
  assert.equal(result.valid, false)
  assert.ok(
    result.errors.some(e => e.path.includes('reveal.table.columns')),
    `expected a column-cap error, got: ${JSON.stringify(result.errors)}`
  )
})

test('rejects an unknown field inside a reveal', () => {
  const result = validateChallengeImport(withReveal({ text: 'ok', chart: 'nope' }))
  assert.equal(result.valid, false)
  assert.ok(
    result.errors.some(e => e.path.includes('reveal.chart') && e.message.includes('Unrecognized field')),
    `expected an unrecognized-field error, got: ${JSON.stringify(result.errors)}`
  )
})

// ---------------------------------------------------------------------------
// Choice grading (`quality` / `because`) — the input of the feedback engine
// ---------------------------------------------------------------------------

test('accepts a fully graded question with because on the best choice', () => {
  const result = validateChallengeImport(mutate(c => {
    const q = c.questions.Q1
    q.choices.forEach((choice, i) => {
      ;(choice as { quality?: string }).quality =
        i === q.bestChoice ? 'best' : i === (q.bestChoice + 1) % q.choices.length ? 'reasonable' : 'poor'
    })
    ;(q.choices[q.bestChoice] as { because?: string }).because = 'The evidence points at the device split.'
  }))
  assert.equal(result.valid, true, `expected no errors, got: ${JSON.stringify(result.errors)}`)
})

test('rejects partial grading (quality is all-or-nothing per question)', () => {
  // Untouched fixture content is legacy-untagged: tagging one choice makes
  // the question partial, which the importer must reject.
  const result = validateChallengeImport(mutate(c => {
    const q = c.questions.Q1
    if (q.choices[q.bestChoice].quality !== undefined) delete (q.choices[q.bestChoice] as { quality?: string }).quality
    ;(c.questions.Q1.choices[0] as { quality?: string }).quality = 'poor'
  }))
  assert.equal(result.valid, false)
  assert.ok(
    result.errors.some(e => e.path === 'questions.Q1.choices' && e.message.includes('all-or-nothing')),
    `expected an all-or-nothing error, got: ${JSON.stringify(result.errors)}`
  )
})

test('reports the all-or-nothing violation exactly once per question', () => {
  // Best untagged + one other choice tagged is the shape a second, duplicate
  // guard used to double-report; the importer must emit the error once.
  const result = validateChallengeImport(mutate(c => {
    const q = c.questions.Q1
    if (q.choices[q.bestChoice].quality !== undefined) delete (q.choices[q.bestChoice] as { quality?: string }).quality
    ;(c.questions.Q1.choices[0] as { quality?: string }).quality = 'poor'
  }))
  assert.equal(result.valid, false)
  const allOrNothing = result.errors.filter(
    e => e.path === 'questions.Q1.choices' && e.message.includes('all-or-nothing')
  )
  assert.equal(
    allOrNothing.length, 1,
    `expected exactly one all-or-nothing error, got: ${JSON.stringify(allOrNothing)}`
  )
})

test('rejects quality "best" on a choice other than bestChoice', () => {
  let other = -1
  // The graded fixture is the baseline: moving the only 'best' off bestChoice
  // breaks the tier without touching the count (stays fully tagged).
  const result = validateChallengeImport(mutate(c => {
    const q = c.questions.Q1
    other = (q.bestChoice + 1) % q.choices.length
    delete (q.choices[q.bestChoice] as { quality?: string }).quality
    delete (q.choices[q.bestChoice] as { because?: string }).because
    ;(q.choices[other] as { quality?: string }).quality = 'best'
  }))
  assert.equal(result.valid, false)
  assert.ok(
    result.errors.some(e => e.path === `questions.Q1.choices[${other}].quality` && e.message.includes('only the choice at bestChoice')),
    `expected a misplaced-best error, got: ${JSON.stringify(result.errors)}`
  )
})

test('rejects full grading where the bestChoice choice is not "best"', () => {
  // Demote the fixture's best move in place: the count stays fully tagged,
  // only the tier at bestChoice breaks.
  const result = validateChallengeImport(mutate(c => {
    const q = c.questions.Q1
    ;(q.choices[q.bestChoice] as { quality?: string }).quality = 'reasonable'
  }))
  assert.equal(result.valid, false)
  assert.ok(
    result.errors.some(e =>
      e.path === `questions.Q1.choices[${fixture.questions.Q1.bestChoice}].quality` &&
      e.message.includes('must be quality "best"')
    ),
    `expected a wrong-tier-at-bestChoice error, got: ${JSON.stringify(result.errors)}`
  )
})

test('rejects a fully-graded "best" choice without because', () => {
  // Rule shape: grading only bites once a question is FULLY graded. The
  // fixture is already fully graded with a well-formed best move, so removing
  // only its `because` isolates exactly the rule under test.
  const result = validateChallengeImport(mutate(c => {
    const q = c.questions.Q1
    delete (q.choices[q.bestChoice] as { because?: string }).because
  }))
  assert.equal(result.valid, false)
  assert.ok(
    result.errors.some(e =>
      e.path === `questions.Q1.choices[${fixture.questions.Q1.bestChoice}].because` &&
      e.message.includes('needs "because"')
    ),
    `expected a missing-because error, got: ${JSON.stringify(result.errors)}`
  )
})

test('accepts criteria references that resolve to the declared rubric', () => {
  // The graded fixture already passes wholesale: the unmodified fixture is
  // the positive case, nothing to mutate.
  const result = validateChallengeImport(fixture)
  assert.equal(result.valid, true, `expected no errors, got: ${JSON.stringify(result.errors)}`)
})

test('rejects a dangling criterion reference and names it', () => {
  const result = validateChallengeImport(mutate(c => {
    c.assessment = {
      criteria: [{ id: 'root-cause', label: 'Finding the root cause', guidance: 'Name what broke first.' }]
    }
    ;(c.questions.Q1.choices[0] as { criteria?: string[] }).criteria = ['nope']
  }))
  assert.equal(result.valid, false)
  assert.ok(
    result.errors.some(e =>
      e.path === 'questions.Q1.choices[0].criteria' &&
      e.message.includes('"nope"') && e.message.includes('not declared')
    ),
    `expected a dangling-ref error, got: ${JSON.stringify(result.errors)}`
  )
})

test('rejects a best move that tests nothing in the rubric', () => {
  // The graded fixture already references the rubric everywhere: clearing only
  // the best move's refs isolates exactly the rule under test.
  const result = validateChallengeImport(mutate(c => {
    const q = c.questions.Q1
    if (!c.assessment) {
      c.assessment = {
        criteria: [{ id: 'root-cause', label: 'Finding the root cause', guidance: 'Name what broke first.' }]
      }
      for (const question of Object.values(c.questions)) {
        question.choices.forEach((choice, i) => {
          if (choice.criteria === undefined) choice.criteria = ['root-cause']
          if (choice.quality === undefined) choice.quality = i === question.bestChoice ? 'best' : 'reasonable'
        })
        if (question.choices[question.bestChoice].because === undefined) {
          question.choices[question.bestChoice].because = 'Authored.'
        }
      }
    }
    delete (q.choices[q.bestChoice] as { criteria?: string[] }).criteria
  }))
  assert.equal(result.valid, false)
  assert.ok(
    result.errors.some(e =>
      e.path === `questions.Q1.choices[${fixture.questions.Q1.bestChoice}].criteria` &&
      e.message.includes('tests nothing in the rubric')
    ),
    `expected an unassessed-best error, got: ${JSON.stringify(result.errors)}`
  )
})

test('rejects duplicate criterion ids', () => {
  const result = validateChallengeImport(mutate(c => {
    c.assessment = {
      criteria: [
        { id: 'root-cause', label: 'One', guidance: 'First.' },
        { id: 'root-cause', label: 'Two', guidance: 'Second.' }
      ]
    }
  }))
  assert.equal(result.valid, false)
  assert.ok(
    result.errors.some(e =>
      e.path === 'assessment.criteria[1].id' && e.message.includes('duplicate')
    ),
    `expected a duplicate-id error, got: ${JSON.stringify(result.errors)}`
  )
})

test('keeps an authored summary on the parsed challenge', () => {
  const result = validateChallengeImport(fixture)
  assert.equal(result.valid, true, `expected no errors, got: ${JSON.stringify(result.errors)}`)
  assert.equal(result.parsed!.summary, fixture.summary)
})

test('accepts a challenge with no summary — the field is optional', () => {
  const result = validateChallengeImport(mutate(c => { delete c.summary }))
  assert.equal(result.valid, true, `expected no errors, got: ${JSON.stringify(result.errors)}`)
  assert.equal(result.parsed!.summary, undefined)
})

test('rejects a summary past the length cap', () => {
  const result = validateChallengeImport(mutate(c => { c.summary = 'x'.repeat(MAX_SUMMARY + 1) }))
  assert.equal(result.valid, false)
  assert.ok(
    result.errors.some(e => e.path === 'summary' && e.message.includes(String(MAX_SUMMARY))),
    `expected a summary-length error, got: ${JSON.stringify(result.errors)}`
  )
})