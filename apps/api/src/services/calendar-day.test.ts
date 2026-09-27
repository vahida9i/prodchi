import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tehranDayKey } from './calendar-day.ts'

test('starts the Persian activity day at Tehran midnight', () => {
  assert.equal(tehranDayKey(new Date('2026-09-26T19:00:00Z')), '2026-09-26')
  assert.equal(tehranDayKey(new Date('2026-09-26T21:00:00Z')), '2026-09-27')
})
