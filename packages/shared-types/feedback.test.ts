import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateRun, qualityOf, strongestRunSteps } from './feedback'
import type { RunChallenge } from './feedback'

const REVEAL = { text: 'what you learn' }

/** The same two questions, plus the unit-layer rubric they are assessed under. */
const RUBRICED: RunChallenge = {
  role: 'Product Design',
  startKey: 'Q1',
  assessment: {
    criteria: [
      { id: 'root-cause', label: 'Finding the root cause', guidance: 'Name what broke before fixing anything.' },
      { id: 'validate', label: 'Validating before rollout', guidance: 'A comparison turns improvement into proof.' }
    ]
  },
  questions: {
    Q1: {
      text: 'First decision',
      bestChoice: 0,
      choices: [
        { text: 'Split by device', stage: 'INVESTIGATE', reveal: REVEAL, next: 'Q2', quality: 'best', because: 'The pattern is device-dependent.', criteria: ['root-cause'] },
        { text: 'Brainstorm fixes', stage: 'EXPLORE', reveal: REVEAL, next: 'Q2', quality: 'poor', criteria: ['root-cause'] },
        { text: 'Ship a variant', stage: 'DESIGN', reveal: REVEAL, next: 'END', quality: 'reasonable', criteria: ['validate'] }
      ]
    },
    Q2: {
      text: 'Second decision',
      bestChoice: 1,
      choices: [
        { text: 'Trust the average', stage: 'EXPLORE', reveal: REVEAL, next: 'END', quality: 'poor', criteria: ['root-cause'] },
        { text: 'Validate with users', stage: 'VALIDATE', reveal: REVEAL, next: 'END', quality: 'best', because: 'Averages hide the segments.', criteria: ['validate'] },
        { text: 'Define the metric', stage: 'DEFINE', reveal: REVEAL, next: 'END', quality: 'reasonable' }
      ]
    }
  }
}

test('a rubriced run scores each strand it exercised, in declared order', () => {
  const report = evaluateRun([{ key: 'Q1', choiceIndex: 0 }, { key: 'Q2', choiceIndex: 1 }], RUBRICED)
  assert.deepEqual(report.dimensions?.map(d => d.id), ['root-cause', 'validate'])
  assert.equal(report.dimensions?.[0].status, 'strength')
  assert.equal(report.dimensions?.[0].count, 1)
  assert.equal(report.dimensions?.[1].status, 'strength')
  // Q2's reasonable choice has no criteria, so the strand only sees the best call.
  const mixed = evaluateRun([{ key: 'Q1', choiceIndex: 1 }, { key: 'Q2', choiceIndex: 2 }], RUBRICED)
  assert.equal(mixed.dimensions?.[0].status, 'growth')
  assert.equal(mixed.dimensions?.[0].count, 1)
  assert.equal(mixed.dimensions?.[1].count, 0)
  assert.equal(mixed.dimensions?.[1].status, 'neutral')
  assert.equal(mixed.dimensions?.[1].evidence, 'not exercised on this run')
})

test('an unrubriced challenge reports an empty unit layer', () => {
  const report = evaluateRun([{ key: 'Q1', choiceIndex: 0 }], graph)
  assert.deepEqual(report.dimensions, [])
})

/** Two questions whose best moves test different reasoning areas. */
const graph: RunChallenge = {
  role: 'Product Design',
  startKey: 'Q1',
  questions: {
    Q1: {
      text: 'First decision',
      bestChoice: 0,
      choices: [
        { text: 'Split by device', stage: 'INVESTIGATE', reveal: REVEAL, next: 'Q2', quality: 'best', because: 'The pattern is device-dependent.' },
        { text: 'Brainstorm fixes', stage: 'EXPLORE', reveal: REVEAL, next: 'Q2', quality: 'poor' },
        { text: 'Ship a variant', stage: 'DESIGN', reveal: REVEAL, next: 'END', quality: 'reasonable' }
      ]
    },
    Q2: {
      text: 'Second decision',
      bestChoice: 1,
      choices: [
        { text: 'Trust the average', stage: 'EXPLORE', reveal: REVEAL, next: 'END', quality: 'poor' },
        { text: 'Validate with users', stage: 'VALIDATE', reveal: REVEAL, next: 'END', quality: 'best', because: 'Averages hide the segments.' },
        { text: 'Define the metric', stage: 'DEFINE', reveal: REVEAL, next: 'END', quality: 'reasonable' }
      ]
    }
  }
}

const entry = (key: string, choiceIndex: number) => ({ key, choiceIndex })

test('an all-best run reads as strong with no growth areas', () => {
  const report = evaluateRun([entry('Q1', 0), entry('Q2', 1)], graph)
  assert.equal(report.headline, 'strong')
  assert.equal(report.rate, 1)
  assert.deepEqual(report.growth, [])
  assert.ok(report.strengths.length >= 2)
  assert.ok(report.perQuestion.every(q => q.verdict === 'strongest' && q.strongest === null && !q.mismatch))
  assert.deepEqual(report.traversal, { steps: 2, strongestRunSteps: 2, earlyExit: false })
  assert.equal(report.trajectory, 'steady')
})

test('a miss carries the strongest move, its because, and the mismatch flag', () => {
  const report = evaluateRun([entry('Q1', 1), entry('Q2', 1)], graph)
  assert.equal(report.headline, 'mixed')
  assert.equal(report.rate, 0.5)
  const first = report.perQuestion[0]
  assert.equal(first.verdict, 'missed')
  assert.equal(first.mismatch, true) // EXPLORE move where INVESTIGATE was needed
  assert.equal(first.strongest?.text, 'Split by device')
  assert.equal(first.strongest?.because, 'The pattern is device-dependent.')
  const growth = report.growth.find(g => g.area === 'Digging into evidence')
  assert.ok(growth, 'expected the INVESTIGATE area in growth')
  assert.equal(growth.atQuestion, 'Q1')
  assert.equal(growth.strongest.because, 'The pattern is device-dependent.')
  assert.ok(report.strengths.some(s => s.area === 'Validating with users'))
})

test('reasonable moves count half and surface as defensible in evidence', () => {
  const report = evaluateRun([entry('Q1', 2), entry('Q2', 2)], graph)
  assert.equal(report.rate, 0.5)
  assert.equal(report.headline, 'mixed')
  assert.ok(report.perQuestion.every(q => q.verdict === 'reasonable'))
  const evidence = report.strengths.concat(report.growth).map(a => a.evidence).join(' | ')
  assert.ok(evidence.includes('defensible'), evidence)
})

test('untagged (legacy) choices derive best/poor from bestChoice', () => {
  const legacy = JSON.parse(JSON.stringify(graph)) as RunChallenge
  for (const question of Object.values(legacy.questions)) {
    for (const choice of question.choices) {
      delete (choice as { quality?: unknown }).quality
      delete (choice as { because?: unknown }).because
    }
  }
  assert.equal(qualityOf(legacy.questions.Q1.choices[1], false), 'poor')
  assert.equal(qualityOf(legacy.questions.Q1.choices[0], true), 'best')
  const report = evaluateRun([entry('Q1', 1), entry('Q2', 1)], legacy)
  assert.equal(report.headline, 'mixed')
  assert.equal(report.perQuestion[0].strongest?.because, undefined)
})

test('trajectory: finishing stronger than you started, and fading, are detected', () => {
  const stronger = evaluateRun([entry('Q1', 1), entry('Q2', 1)], graph)
  assert.equal(stronger.trajectory, 'finished-stronger')
  const faded = evaluateRun([entry('Q1', 0), entry('Q2', 0)], graph)
  assert.equal(faded.trajectory, 'faded')
})

test('wrapping up before the strongest run depth flags an early exit', () => {
  // Q1's third choice jumps straight to END: 1 step where the best walk is 2.
  const report = evaluateRun([entry('Q1', 2)], graph)
  assert.equal(report.traversal.steps, 1)
  assert.equal(report.traversal.strongestRunSteps, 2)
  assert.equal(report.traversal.earlyExit, true)
  assert.equal(strongestRunSteps(graph), 2)
})

test('an empty path degrades to a struggled headline without throwing', () => {
  const report = evaluateRun([], graph)
  assert.equal(report.headline, 'struggled')
  assert.deepEqual(report.strengths, [])
  assert.deepEqual(report.growth, [])
  assert.equal(report.traversal.steps, 0)
  assert.equal(report.trajectory, 'steady')
})

test('path entries for questions no longer in the graph are ignored', () => {
  const report = evaluateRun([entry('GONE', 0), entry('Q1', 0), entry('Q2', 1)], graph)
  assert.equal(report.traversal.steps, 2)
  assert.equal(report.headline, 'strong')
})