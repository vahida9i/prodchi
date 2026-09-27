import { test } from 'node:test'
import assert from 'node:assert/strict'
import { api } from './api-client'

test('streams AI progress across arbitrary network chunks and returns the saved result', async () => {
  const previousFetch = globalThis.fetch
  const events = [
    { type: 'progress', fields: { strength: 'تحلیل' } },
    { type: 'progress', fields: { strength: 'تحلیل روشن', weakness: 'شواهد کم' } },
    { type: 'done', assessment: { score: 76, strength: 'تحلیل روشن', weakness: 'شواهد کم', nextStep: 'گروه‌ها را جدا کن' } }
  ]
  const encoded = new TextEncoder().encode(events.map(event => JSON.stringify(event) + '\n').join(''))
  let requestOptions: RequestInit | undefined
  globalThis.fetch = async (_url, options) => {
    requestOptions = options
    return new Response(new ReadableStream({
      start(controller) {
        for (let offset = 0; offset < encoded.length; offset += 7) controller.enqueue(encoded.slice(offset, offset + 7))
        controller.close()
      }
    }), { status: 200 })
  }
  const progress: Array<{ strength?: string; weakness?: string; nextStep?: string }> = []
  try {
    const assessment = await api.streamAiAssessment('session-id', fields => progress.push(fields))
    assert.equal(requestOptions?.headers && (requestOptions.headers as Record<string, string>).Accept, 'application/x-ndjson')
    assert.equal(requestOptions?.credentials, 'include')
    assert.deepEqual(progress, [events[0].fields, events[1].fields])
    assert.deepEqual(assessment, events[2].assessment)
  } finally {
    globalThis.fetch = previousFetch
  }
})

test('streams written-answer feedback and waits for the final session decision', async () => {
  const previousFetch = globalThis.fetch
  const result = { reveal: { text: 'روشن شد' }, assessment: { score: 88, strength: 'تحلیل درست', weakness: 'شواهد کم' }, question: null, status: 'completed', result: null, dailyReward: null }
  const events = [
    { type: 'progress', fields: { strength: 'تحلیل' } },
    { type: 'progress', fields: { strength: 'تحلیل درست', weakness: 'شواهد کم' } },
    { type: 'done', result }
  ]
  globalThis.fetch = async (_url, options) => {
    assert.equal(JSON.parse(options?.body as string).answerText, 'پاسخ آزمون با شواهد و تحلیل کافی')
    return new Response(events.map(event => JSON.stringify(event) + '\n').join(''), { status: 200 })
  }
  const progress: Array<{ strength?: string; weakness?: string }> = []
  try {
    const response = await api.streamWrittenAnswer('session-id', 'پاسخ آزمون با شواهد و تحلیل کافی', fields => progress.push(fields))
    assert.deepEqual(progress, [events[0].fields, events[1].fields])
    assert.deepEqual(response, result)
  } finally {
    globalThis.fetch = previousFetch
  }
})
