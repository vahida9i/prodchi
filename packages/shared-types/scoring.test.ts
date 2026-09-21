import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { isSingleQuestion, levelFromXp, scoreLevel, starsFor } from './scoring'
import { END, XP_PER_BEST_CHOICE } from './challenge-schema'
import type { ChallengeImport, Question } from './challenge-schema'

const FIXTURE_PATH = fileURLToPath(new URL('../../docs/fixtures/onboarding-drop-off.json', import.meta.url))
const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf-8')) as ChallengeImport

function question(bestChoice: number, choices = 3): Question {
  return {
    text: 'question',
    choices: Array.from({ length: choices }, (_, i) => ({
      text: `choice ${i}`,
      stage: 'INVESTIGATE' as const,
      reveal: `reveal ${i}`,
      next: END
    })),
    bestChoice
  }
}

function singleQuestionChart(bestChoice: number): Record<string, Question> {
  return { Q1: question(bestChoice) }
}

/** Walks the fixture from `start` following `choiceAt`, collecting the path. */
function walk(choiceAt: (key: string) => number) {
  const path: Array<{ key: string; choiceIndex: number }> = []
  let key: string | null = fixture.start
  const guard = Object.keys(fixture.questions).length + 1

  while (key && path.length < guard) {
    const current: Question = fixture.questions[key]
    const choiceIndex = choiceAt(key)
    path.push({ key, choiceIndex })
    const next: string = current.choices[choiceIndex].next
    key = next === END ? null : next
  }

  return path
}

const bestPath = () => walk(key => fixture.questions[key].bestChoice)
const firstChoicePath = () => walk(() => 0)

test('a perfect run scores 10 XP per answered question and 3 stars', () => {
  const path = bestPath()
  const score = scoreLevel(path, fixture.questions)

  assert.equal(score.answered, path.length)
  assert.equal(score.hits, path.length)
  assert.equal(score.accuracy, 1)
  assert.equal(score.xp, path.length * XP_PER_BEST_CHOICE)
  assert.equal(score.stars, 3)
})

test('hits are counted against the question that was answered, not a choice ordinal', () => {
  const q2 = fixture.questions.Q2
  const path = [
    { key: 'Q1', choiceIndex: fixture.questions.Q1.bestChoice },
    { key: 'Q2', choiceIndex: (q2.bestChoice + 1) % q2.choices.length }
  ]
  const score = scoreLevel(path, fixture.questions)

  assert.equal(score.answered, 2)
  assert.equal(score.hits, 1)
  assert.equal(score.xp, XP_PER_BEST_CHOICE)
  assert.equal(score.stars, 0) // accuracy 0.5 sits below the one-star band
})

test('zero hits scores zero XP and zero stars', () => {
  const questions: Record<string, Question> = { Q1: question(2), Q2: question(1) }
  const score = scoreLevel([{ key: 'Q1', choiceIndex: 0 }, { key: 'Q2', choiceIndex: 0 }], questions)

  assert.equal(score.answered, 2)
  assert.equal(score.hits, 0)
  assert.equal(score.accuracy, 0)
  assert.equal(score.xp, 0)
  assert.equal(score.stars, 0)
})

test('an empty path scores nothing without dividing by zero', () => {
  const score = scoreLevel([], fixture.questions)

  assert.equal(score.answered, 0)
  assert.equal(score.hits, 0)
  assert.equal(score.accuracy, 0)
  assert.equal(score.xp, 0)
  assert.equal(score.stars, 0)
})

test('entries for questions that no longer exist in the graph are skipped, not fatal', () => {
  const score = scoreLevel(
    [{ key: 'Q1', choiceIndex: fixture.questions.Q1.bestChoice }, { key: 'GONE', choiceIndex: 0 }],
    fixture.questions
  )

  assert.equal(score.answered, 1)
  assert.equal(score.hits, 1)
  assert.equal(score.xp, XP_PER_BEST_CHOICE)
})

test('star bands follow accuracy', () => {
  assert.equal(starsFor(1), 3)
  assert.equal(starsFor(0.8), 2)
  assert.equal(starsFor(0.79), 1)
  assert.equal(starsFor(0.6), 1)
  assert.equal(starsFor(0.59), 0)
  assert.equal(starsFor(0), 0)
})

test('a single-question level is win-or-lose: 10 XP and 3 stars, or nothing', () => {
  const win = scoreLevel([{ key: 'Q1', choiceIndex: 1 }], singleQuestionChart(1))
  assert.deepEqual(win, { answered: 1, hits: 1, accuracy: 1, xp: 10, stars: 3 })

  const lose = scoreLevel([{ key: 'Q1', choiceIndex: 0 }], singleQuestionChart(1))
  assert.deepEqual(lose, { answered: 1, hits: 0, accuracy: 0, xp: 0, stars: 0 })
})

test('single-question type is derived: one question whose every choice ends the session', () => {
  assert.equal(isSingleQuestion(singleQuestionChart(0)), true)
  // Same single question, but one choice continues: no longer a single-question level.
  const branching: Record<string, Question> = { Q1: question(0) }
  branching.Q1.choices[0].next = 'Q2'
  branching.Q2 = question(0)
  assert.equal(isSingleQuestion(branching), false)
  assert.equal(isSingleQuestion(fixture.questions), false)
})

test('level curve is a pure function of total XP', () => {
  assert.equal(levelFromXp(0), 0)
  assert.equal(levelFromXp(99), 0)
  assert.equal(levelFromXp(100), 1)
  assert.equal(levelFromXp(399), 1)
  assert.equal(levelFromXp(400), 2)
  assert.equal(levelFromXp(900), 3)
  assert.equal(levelFromXp(-50), 0)
})

test('the fixture scores end-to-end from the traced best path', () => {
  const perfect = scoreLevel(bestPath(), fixture.questions)
  const firstChoices = scoreLevel(firstChoicePath(), fixture.questions)

  assert.equal(perfect.stars, 3)
  assert.equal(perfect.xp, perfect.answered * XP_PER_BEST_CHOICE)
  assert.ok(perfect.xp > firstChoices.xp, 'the traced best path should outscore always picking choice 0')
  // Always picking choice 0 still completes the level — reaching END is the
  // pass condition, so a low score never blocks progression.
  assert.ok(firstChoices.answered > 0)
  assert.ok(firstChoices.xp >= 0)
})
