import { existsSync } from 'node:fs'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'

/**
 * Loads environment variables for the API process.
 *
 * The repo keeps a single `.env` at the root, plus a copy under `packages/db/.env`
 * (Prisma's CLI resolves its own env file relative to the schema). Neither `tsx`
 * nor `node` read those files for us, so this module loads the first one that
 * exists. Depth is identical from `src/lib/env.ts` and `dist/lib/env.js`, so the
 * same candidates work for `pnpm dev` and `node dist/server.js`.
 *
 * Values already present in the real environment win: the file only FILLS
 * missing keys (a plain `process.loadEnvFile` would override them, which would
 * let a checked-in .env shadow production configuration).
 *
 * Must be imported before anything that reads configuration (e.g. `lib/prisma.ts`).
 */
const candidates = [
  new URL('../../../../.env', import.meta.url), // <repo>/.env
  new URL('../.env', import.meta.url), // apps/api/.env
  new URL('../../../../packages/db/.env', import.meta.url) // Prisma CLI's env file
]

for (const candidate of candidates) {
  const path = fileURLToPath(candidate)
  if (existsSync(path)) {
    const parsed = parseEnv(readFileSync(path, 'utf8'))
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined) {
        process.env[key] = value
      }
    }
    break
  }
}

if (!process.env.DATABASE_URL) {
  console.warn('[env] DATABASE_URL is not set - Prisma queries will fail. Add it to .env at the repo root.')
}