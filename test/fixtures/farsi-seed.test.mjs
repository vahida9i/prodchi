import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { validateChallengeImport } from '../../packages/shared-types/dist/validator.js'

const fixtureDir = new URL('../../docs/fixtures/fa/', import.meta.url)

test('the Farsi demo catalog contains twenty valid, unique challenges', async () => {
  const files = (await readdir(fixtureDir))
    .filter(file => file.endsWith('.json'))
    .sort()

  assert.equal(files.length, 20, 'the Farsi demo catalog should contain 20 fixtures')

  const ids = new Set()
  for (const file of files) {
    const challenge = JSON.parse(await readFile(new URL(file, fixtureDir), 'utf8'))
    assert.equal(ids.has(challenge.id), false, `duplicate challenge id: ${challenge.id}`)
    ids.add(challenge.id)

    const result = validateChallengeImport(challenge)
    assert.equal(result.valid, true, `${file} is invalid: ${JSON.stringify(result.errors)}`)
  }
})
