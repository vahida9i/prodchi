import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSkillProfile, SKILL_ORDER, MIN_SKILL_EVIDENCE, skillOrderFor, skillCountFor } from './skills'
import type { Choice, Question, Stage } from './challenge-schema'

/**
 * Fixtures for the skill-profile engine. Only the fields buildSkillProfile
 * reads are filled in — the same shape-first approach as feedback.test.ts.
 */

function gradedQuestion(moves: Array<{ stage: Stage; quality?: 'best' | 'reasonable' | 'poor' }>): Question {
  const bestIndex = moves.findIndex(move => move.quality === 'best')
  return {
    text: 'q',
    bestChoice: bestIndex,
    choices: moves.map((move, index): Choice => ({
      text: `choice ${index}`,
      stage: move.stage,
      reveal: { text: 'r' },
      next: 'END',
      ...(move.quality ? { quality: move.quality } : {}),
      ...(move.quality === 'best' ? { because: 'why' } : {})
    }))
  }
}

/** Best choice at bestIndex (tagged 'best'), everything else untagged → reads 'poor'. */
function question(stages: Stage[], bestIndex = 0): Question {
  return gradedQuestion(stages.map((stage, index) => ({ stage, quality: index === bestIndex ? 'best' : undefined })))
}

const GRAPH = {
  A: question(['VALIDATE', 'FRAME', 'EXPLORE'], 0),
  B: gradedQuestion([
    { stage: 'VALIDATE', quality: 'reasonable' },
    { stage: 'FRAME' },
    { stage: 'EXPLORE' }
  ]),
  C: gradedQuestion([
    { stage: 'VALIDATE', quality: 'reasonable' },
    { stage: 'FRAME' },
    { stage: 'EXPLORE' }
  ]),
  D: question(['VALIDATE', 'FRAME', 'EXPLORE'], 0)
}

const validation = (profile: ReturnType<typeof buildSkillProfile>) =>
  profile.skills.find(skill => skill.id === 'validation')!

test('skills are always in fixed process order', () => {
  assert.deepEqual(SKILL_ORDER, ['framing', 'research', 'synthesis', 'ideation', 'solution', 'validation'])
  assert.deepEqual(buildSkillProfile([]).skills.map(skill => skill.id), SKILL_ORDER)
})

test('an empty history yields an unproven profile with no fake zeros', () => {
  const profile = buildSkillProfile([])
  assert.equal(profile.decisions, 0)
  assert.equal(profile.scenarios, 0)
  assert.equal(profile.overallRate, 0)
  for (const skill of profile.skills) {
    assert.equal(skill.proficiency, 'unproven')
    assert.equal(skill.count, 0)
    assert.equal(skill.rate, 0)
    assert.equal(skill.evidence, 'not yet observed')
    assert.equal(skill.thinEvidence, false)
  }
})

test('each decision credits the skill of the stage on the move actually chosen', () => {
  const questions = {
    Q1: question(['FRAME', 'INVESTIGATE', 'EXPLORE'], 0),
    Q2: question(['VALIDATE', 'FRAME', 'EXPLORE'], 0)
  }
  // Q1: best FRAME move. Q2: the poor FRAME-tagged alternative (not the best
  // VALIDATE move) — credit follows the chosen move's stage, not the ideal one.
  const profile = buildSkillProfile([{ path: [{ key: 'Q1', choiceIndex: 0 }, { key: 'Q2', choiceIndex: 1 }], questions }])
  const framing = profile.skills.find(skill => skill.id === 'framing')!
  const validation = profile.skills.find(skill => skill.id === 'validation')!
  const research = profile.skills.find(skill => skill.id === 'research')!

  assert.equal(framing.count, 2)
  assert.equal(framing.bestHits, 1)
  assert.equal(framing.rate, 0.5)
  assert.equal(framing.proficiency, 'developing')
  assert.equal(framing.thinEvidence, true)
  assert.equal(framing.evidence, '1 of 2 strongest calls')
  assert.equal(validation.count, 0)
  assert.equal(research.count, 0)
  assert.equal(profile.decisions, 2)
  assert.equal(profile.scenarios, 1)
  assert.equal(profile.overallRate, 0.5)
})

test('strong needs the rate AND the evidence floor — thin perfect records stay developing', () => {
  assert.ok(MIN_SKILL_EVIDENCE === 3)
  const thin = buildSkillProfile([{ path: [{ key: 'A', choiceIndex: 0 }, { key: 'D', choiceIndex: 0 }], questions: GRAPH }])
  assert.equal(validation(thin).rate, 1)
  assert.equal(validation(thin).count, 2)
  assert.equal(validation(thin).proficiency, 'developing')
  assert.equal(validation(thin).thinEvidence, true)

  const third = question(['VALIDATE', 'FRAME', 'EXPLORE'], 0)
  const full = buildSkillProfile([{
    path: [{ key: 'A', choiceIndex: 0 }, { key: 'D', choiceIndex: 0 }, { key: 'E', choiceIndex: 0 }],
    questions: { ...GRAPH, E: third }
  }])
  assert.equal(validation(full).proficiency, 'strong')
  assert.equal(validation(full).thinEvidence, false)
  assert.equal(full.overallRate, 1)
})

test('a defensible call counts half a strongest call', () => {
  // 2 best + 2 reasonable validation moves → weight 3 of 4 → 0.75 → strong.
  const profile = buildSkillProfile([{
    path: [
      { key: 'A', choiceIndex: 0 },
      { key: 'B', choiceIndex: 0 },
      { key: 'C', choiceIndex: 0 },
      { key: 'D', choiceIndex: 0 }
    ],
    questions: GRAPH
  }])
  const skill = validation(profile)
  assert.equal(skill.count, 4)
  assert.equal(skill.bestHits, 2)
  assert.equal(skill.reasonableCalls, 2)
  assert.equal(skill.rate, 0.75)
  assert.equal(skill.proficiency, 'strong')
  assert.equal(skill.evidence, '2 of 4 strongest calls, 2 defensible')
})

test('runs merge, and only runs that actually scored count as scenarios', () => {
  const run1 = { path: [{ key: 'A', choiceIndex: 0 }], questions: GRAPH }
  const run2 = { path: [{ key: 'B', choiceIndex: 0 }], questions: GRAPH }
  const emptyRun = { path: [{ key: 'GONE', choiceIndex: 0 }], questions: GRAPH }
  const profile = buildSkillProfile([run1, run2, emptyRun])
  assert.equal(profile.scenarios, 2)
  assert.equal(profile.decisions, 2)
  assert.equal(validation(profile).count, 2)
})

test('path entries whose question left the graph do not score and cannot throw', () => {
  const profile = buildSkillProfile([{
    path: [{ key: 'RETIRED', choiceIndex: 0 }, { key: 'A', choiceIndex: 0 }],
    questions: GRAPH
  }])
  assert.equal(profile.decisions, 1)
  assert.equal(profile.scenarios, 1)
  assert.equal(validation(profile).count, 1)
})

test('an out-of-range choice index is skipped rather than throwing', () => {
  const profile = buildSkillProfile([{
    path: [{ key: 'A', choiceIndex: 9 }, { key: 'A', choiceIndex: 0 }],
    questions: GRAPH
  }])
  assert.equal(profile.decisions, 1)
  assert.equal(profile.scenarios, 1)
})

test('a run recorded against a non-array path degrades to empty', () => {
  const profile = buildSkillProfile([{ path: null as unknown as [], questions: GRAPH }])
  assert.equal(profile.decisions, 0)
  assert.equal(profile.scenarios, 0)
})

// ---------------------------------------------------------------------------
// Product Management: the same machinery, the PM process vocabulary
// ---------------------------------------------------------------------------

test('PM skills are always in fixed process order', () => {
  assert.deepEqual(
    skillOrderFor('Product Management'),
    ['framing', 'diagnosis', 'strategy', 'prioritization', 'planning', 'execution', 'measurement']
  )
  assert.deepEqual(
    buildSkillProfile([], 'Product Management').skills.map(skill => skill.id),
    skillOrderFor('Product Management')
  )
  assert.equal(skillCountFor('Product Management'), 7)
  assert.equal(skillCountFor('Product Design'), 6)
})

test('a PM run credits PM skills by the stage of the move actually chosen', () => {
  const questions = {
    Q1: question(['FRAME', 'DIAGNOSE', 'STRATEGIZE'] as Stage[], 0),
    Q2: question(['MEASURE', 'DIAGNOSE', 'EXECUTE'] as Stage[], 0)
  }
  // Q1: best FRAME move. Q2: the DIAGNOSE-tagged alternative (not the best
  // MEASURE move) — credit follows the chosen move's stage.
  const profile = buildSkillProfile(
    [{ path: [{ key: 'Q1', choiceIndex: 0 }, { key: 'Q2', choiceIndex: 1 }], questions }],
    'Product Management'
  )
  const framing = profile.skills.find(skill => skill.id === 'framing')!
  const diagnosis = profile.skills.find(skill => skill.id === 'diagnosis')!
  const measurement = profile.skills.find(skill => skill.id === 'measurement')!

  assert.equal(framing.count, 1)
  assert.equal(framing.rate, 1)
  assert.equal(diagnosis.count, 1)
  assert.equal(diagnosis.rate, 0)
  assert.equal(diagnosis.evidence, '0 of 1 strongest calls')
  assert.equal(measurement.count, 0)
  assert.equal(profile.decisions, 2)
  assert.equal(profile.overallRate, 0.5)
})

test('the PD default is untouched: a PD run reads the six design skills', () => {
  const questions = { Q1: question(['FRAME', 'INVESTIGATE', 'EXPLORE'], 0) }
  const profile = buildSkillProfile([{ path: [{ key: 'Q1', choiceIndex: 0 }], questions }])
  assert.deepEqual(profile.skills.map(skill => skill.id), SKILL_ORDER)
})

test('a PM profile skips stages that belong to no role skill set without throwing', () => {
  // A stale PM run whose graph somehow carries a PD stage: it belongs to no PM
  // skill, so it scores nothing at all — not in the skills, not in the rates.
  const questions = {
    Q1: question(['VALIDATE' as Stage, 'DIAGNOSE', 'EXECUTE'], 0),
    Q2: question(['MEASURE' as Stage, 'DIAGNOSE', 'EXECUTE'], 0)
  }
  const profile = buildSkillProfile(
    [{ path: [{ key: 'Q1', choiceIndex: 0 }, { key: 'Q2', choiceIndex: 0 }], questions }],
    'Product Management'
  )
  assert.equal(profile.decisions, 1) // only the MEASURE decision scores
  assert.equal(profile.scenarios, 1)
  assert.equal(profile.overallRate, 1)
  assert.equal(profile.skills.find(skill => skill.id === 'measurement')!.count, 1)
  assert.equal(profile.skills.find(skill => skill.id === 'diagnosis')!.count, 0)
})