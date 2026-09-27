import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { assessCompletedRun, assessWrittenAnswer, isAiConfigured, parseRunAssessment, parseWrittenAssessment, streamCompletedRun, streamWrittenAnswer } from './written-assessment.ts'
import type { Question } from '@prodchi/shared-types/challenge-schema'

const fixture = JSON.parse(readFileSync(new URL('../../../../docs/fixtures/fa_calendar_growth.json', import.meta.url), 'utf8'))

test('accepts a bounded assessment for an authored branch', () => {
  assert.deepEqual(parseWrittenAssessment({ choiceIndex: 1, score: 72, strength: 'تحلیل داده', weakness: 'نیاز به تفکیک بیشتر' }, 3), {
    choiceIndex: 1, score: 72, strength: 'تحلیل داده', weakness: 'نیاز به تفکیک بیشتر'
  })
})

test('rejects a branch outside the question and a score outside 0–100', () => {
  assert.throws(() => parseWrittenAssessment({ choiceIndex: 3, score: 72, strength: 'خوب', weakness: 'کم' }, 3))
  assert.throws(() => parseWrittenAssessment({ choiceIndex: 0, score: 101, strength: 'خوب', weakness: 'کم' }, 3))
})

test('validates a concise overall AI assessment', () => {
  assert.deepEqual(parseRunAssessment({ score: 78, strength: 'صورت‌بندی روشن', weakness: 'تفکیک ناقص داده', nextStep: 'گروه‌ها را جداگانه بررسی کن' }), {
    score: 78, strength: 'صورت‌بندی روشن', weakness: 'تفکیک ناقص داده', nextStep: 'گروه‌ها را جداگانه بررسی کن'
  })
  assert.throws(() => parseRunAssessment({ score: 120, strength: 'خوب', weakness: 'کم', nextStep: 'ادامه' }))
})

test('sends written evidence and rubric to Liara chat completions in structured format', async () => {
  const previousConfig = { base: process.env.LIARA_BASE_URL, key: process.env.LIARA_API_KEY, model: process.env.LIARA_CHAT_MODEL }
  const previousFetch = globalThis.fetch
  process.env.LIARA_BASE_URL = 'https://ai.liara.ir/api/test-workspace/v1/'
  process.env.LIARA_API_KEY = 'test-key'
  process.env.LIARA_CHAT_MODEL = 'openai/gpt-4o-mini'
  let requestUrl: string
  let requestBody: any
  globalThis.fetch = async (url, options) => {
    requestUrl = String(url)
    requestBody = JSON.parse(options?.body as string)
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ choiceIndex: 0, score: 81, strength: 'تفکیک گروه‌ها', weakness: 'نیاز به آزمون بیشتر' }) } }] }), { status: 200 })
  }
  try {
    const result = await assessWrittenAnswer(fixture.questions.Q1 as Question, 'نرخ تبدیل گروه‌ها را جداگانه می‌سنجم تا علت افت را پیدا کنم.')
    assert.equal(result.score, 81)
    assert.equal(requestUrl!, 'https://ai.liara.ir/api/test-workspace/v1/chat/completions')
    assert.equal(requestBody.model, 'openai/gpt-4o-mini')
    assert.equal(requestBody.response_format.type, 'json_schema')
    assert.equal(requestBody.response_format.json_schema.strict, true)
    const input = JSON.parse(requestBody.messages[1].content)
    assert.equal(input.candidateAnswer, 'نرخ تبدیل گروه‌ها را جداگانه می‌سنجم تا علت افت را پیدا کنم.')
    assert.equal(input.material.image.alt, fixture.questions.Q1.material.image.alt)
    assert.equal(input.rubric.length, fixture.questions.Q1.choices.length)
  } finally {
    globalThis.fetch = previousFetch
    for (const [name, value] of Object.entries({ LIARA_BASE_URL: previousConfig.base, LIARA_API_KEY: previousConfig.key, LIARA_CHAT_MODEL: previousConfig.model })) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
})

test('parses overall assessment from a structured Liara chat completion', async () => {
  const previousConfig = { base: process.env.LIARA_BASE_URL, key: process.env.LIARA_API_KEY, model: process.env.LIARA_CHAT_MODEL }
  const previousFetch = globalThis.fetch
  process.env.LIARA_BASE_URL = 'https://ai.liara.ir/api/test-workspace/v1'
  process.env.LIARA_API_KEY = 'test-key'
  process.env.LIARA_CHAT_MODEL = 'openai/gpt-4o-mini'
  let requestBody: any
  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options?.body as string)
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ score: 76, strength: 'تحلیل روشن', weakness: 'شواهد کم', nextStep: 'گروه‌ها را جدا کن' }) } }] }), { status: 200 })
  }
  try {
    const result = await assessCompletedRun('سناریوی آزمون', [{ question: 'چه می‌کنید؟', answer: 'گروه‌ها را جدا می‌کنم', strongest: 'بررسی گروه‌ها' }], 75)
    assert.equal(result.score, 76)
    assert.equal(requestBody.response_format.json_schema.name, 'run_assessment')
    assert.equal(JSON.parse(requestBody.messages[1].content).referenceScore, 75)
  } finally {
    globalThis.fetch = previousFetch
    for (const [name, value] of Object.entries({ LIARA_BASE_URL: previousConfig.base, LIARA_API_KEY: previousConfig.key, LIARA_CHAT_MODEL: previousConfig.model })) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
})

test('streams readable assessment fields before returning a validated result', async () => {
  const previousConfig = { base: process.env.LIARA_BASE_URL, key: process.env.LIARA_API_KEY, model: process.env.LIARA_CHAT_MODEL }
  const previousFetch = globalThis.fetch
  process.env.LIARA_BASE_URL = 'https://ai.liara.ir/api/test-workspace/v1'
  process.env.LIARA_API_KEY = 'test-key'
  process.env.LIARA_CHAT_MODEL = 'openai/gpt-4o-mini'
  let requestBody: any
  const chunks = [
    '{"score":76,"strength":"تحلیل ',
    'روشن","weakness":"شواهد ',
    'کم","nextStep":"گروه‌ها را جدا کن"}'
  ]
  const eventText = chunks.map(content => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`).join('') + 'data: [DONE]\n\n'
  const encoded = new TextEncoder().encode(eventText)
  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options?.body as string)
    return new Response(new ReadableStream({
      start(controller) {
        for (let offset = 0; offset < encoded.length; offset += 11) controller.enqueue(encoded.slice(offset, offset + 11))
        controller.close()
      }
    }), { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
  }
  const progress: Array<{ strength?: string; weakness?: string; nextStep?: string }> = []
  try {
    const result = await streamCompletedRun('سناریوی آزمون', [{ question: 'چه می‌کنید؟', answer: 'گروه‌ها را جدا می‌کنم', strongest: 'بررسی گروه‌ها' }], 75, value => progress.push(value))
    assert.equal(requestBody.stream, true)
    assert.equal(requestBody.response_format.json_schema.name, 'run_assessment')
    assert.ok(progress.some(value => value.strength === 'تحلیل ' && value.weakness === undefined))
    assert.ok(progress.some(value => value.weakness === 'شواهد ' && value.nextStep === undefined))
    assert.deepEqual(result, { score: 76, strength: 'تحلیل روشن', weakness: 'شواهد کم', nextStep: 'گروه‌ها را جدا کن' })
  } finally {
    globalThis.fetch = previousFetch
    for (const [name, value] of Object.entries({ LIARA_BASE_URL: previousConfig.base, LIARA_API_KEY: previousConfig.key, LIARA_CHAT_MODEL: previousConfig.model })) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
})

test('streams written-answer feedback before choosing the final authored branch', async () => {
  const previousConfig = { base: process.env.LIARA_BASE_URL, key: process.env.LIARA_API_KEY, model: process.env.LIARA_CHAT_MODEL }
  const previousFetch = globalThis.fetch
  process.env.LIARA_BASE_URL = 'https://ai.liara.ir/api/test-workspace/v1'
  process.env.LIARA_API_KEY = 'test-key'
  process.env.LIARA_CHAT_MODEL = 'openai/gpt-4o-mini'
  const chunks = ['{"choiceIndex":0,"score":88,"strength":"تفکیک ', 'درست","weakness":"شواهد بیشتری لازم است"}']
  globalThis.fetch = async () => new Response(chunks.map(content => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`).join('') + 'data: [DONE]\n\n', { status: 200 })
  const progress: Array<{ strength?: string; weakness?: string }> = []
  try {
    const result = await streamWrittenAnswer(fixture.questions.Q1 as Question, 'ابتدا کاربران را بر اساس کانال جذب و اتصال همکار جدا می‌کنم تا افت را دقیق‌تر ببینم.', value => progress.push(value))
    assert.ok(progress.some(value => value.strength === 'تفکیک ' && value.weakness === undefined))
    assert.deepEqual(result, { choiceIndex: 0, score: 88, strength: 'تفکیک درست', weakness: 'شواهد بیشتری لازم است' })
  } finally {
    globalThis.fetch = previousFetch
    for (const [name, value] of Object.entries({ LIARA_BASE_URL: previousConfig.base, LIARA_API_KEY: previousConfig.key, LIARA_CHAT_MODEL: previousConfig.model })) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
})

test('AI is available only with a complete HTTPS Liara configuration', () => {
  const previous = { base: process.env.LIARA_BASE_URL, key: process.env.LIARA_API_KEY, model: process.env.LIARA_CHAT_MODEL }
  try {
    process.env.LIARA_BASE_URL = 'https://ai.liara.ir/api/test-workspace/v1'
    process.env.LIARA_API_KEY = 'test-key'
    process.env.LIARA_CHAT_MODEL = 'openai/gpt-4o-mini'
    assert.equal(isAiConfigured(), true)
    process.env.LIARA_BASE_URL = 'http://ai.liara.ir/api/test-workspace/v1'
    assert.equal(isAiConfigured(), false)
    process.env.LIARA_BASE_URL = 'https://example.com/v1'
    assert.equal(isAiConfigured(), false)
    process.env.LIARA_BASE_URL = 'https://ai.liara.ir/api/test-workspace/v1'
    delete process.env.LIARA_API_KEY
    assert.equal(isAiConfigured(), false)
  } finally {
    for (const [name, value] of Object.entries({ LIARA_BASE_URL: previous.base, LIARA_API_KEY: previous.key, LIARA_CHAT_MODEL: previous.model })) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
})
