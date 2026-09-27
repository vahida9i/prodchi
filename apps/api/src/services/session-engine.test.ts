import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { remainingDecisionRange, sanitizeQuestion } from './session-engine.ts'
import type { Question } from '@prodchi/shared-types/challenge-schema'

const fixture = JSON.parse(readFileSync(new URL('../../../../docs/fixtures/fa_calendar_growth.json', import.meta.url), 'utf8'))

test('written question shows evidence but never leaks grading branches', () => {
  const question = sanitizeQuestion('Q1', fixture.questions.Q1 as Question)
  assert.equal(question.answerMode, 'text')
  assert.deepEqual(question.choices, [])
  assert.equal(question.material?.table?.rows[1][2], '۲۹٪')
  assert.equal(question.material?.image?.src, '/scenario-assets/calendar-onboarding.svg')
  assert.equal(JSON.stringify(question).includes('bestChoice'), false)
})

test('remaining decisions reflect the shortest and longest possible branches', () => {
  const questions = {
    Q1: { choices: [{ next: 'END' }, { next: 'Q2' }] },
    Q2: { choices: [{ next: 'Q3' }] },
    Q3: { choices: [{ next: 'END' }] }
  } as unknown as Record<string, Question>

  assert.deepEqual(remainingDecisionRange(questions, 'Q1'), { min: 1, max: 3 })
  assert.deepEqual(remainingDecisionRange(questions, 'Q2'), { min: 2, max: 2 })
  assert.equal(remainingDecisionRange(questions, 'missing'), null)
})
