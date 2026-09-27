import { PrismaClient, Prisma } from '@prisma/client'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { validateChallengeImport } from '../shared-types/validator.ts'
import { isSingleQuestion } from '../shared-types/scoring.ts'

for (const path of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')]) {
  try { process.loadEnvFile(path); break } catch { /* try next path */ }
}

const source = JSON.parse(readFileSync(new URL('../../docs/fixtures/fa_calendar_growth.json', import.meta.url), 'utf8'))
const validated = validateChallengeImport(source)
if (!validated.valid || !validated.parsed) throw new Error(`Challenge invalid: ${JSON.stringify(validated.errors)}`)
const challenge = validated.parsed
const prisma = new PrismaClient()

const extraBadges = [
  { id: 'three-steps', name: 'شروع محکم', description: '۳ مرحله را به پایان برسانید', iconRef: '🚀', unlockCondition: { type: 'levelsPassedAbove', threshold: 3 } },
  { id: 'five-steps', name: 'مسیرساز', description: '۵ مرحله را به پایان برسانید', iconRef: '🗺️', unlockCondition: { type: 'levelsPassedAbove', threshold: 5 } },
  { id: 'streak-3', name: 'سه روز پیوسته', description: '۳ روز تداوم فعالیت داشته باشید', iconRef: '🔥', unlockCondition: { type: 'streakAbove', threshold: 3 } },
  { id: 'streak-30', name: 'یک ماه استمرار', description: '۳۰ روز تداوم فعالیت داشته باشید', iconRef: '🏅', unlockCondition: { type: 'streakAbove', threshold: 30 } },
  { id: 'perfect-first', name: 'بی‌نقص', description: 'یک مرحله را با تمام انتخاب‌های برتر تمام کنید', iconRef: '💎', unlockCondition: { type: 'perfectLevelsAbove', threshold: 1 } },
  { id: 'star-30', name: 'کهکشان ستاره‌ها', description: '۳۰ ستاره در مسیر خود جمع کنید', iconRef: '🌟', unlockCondition: { type: 'starsAbove', threshold: 30 } }
]

async function main() {
try {
  const role = await prisma.role.findUniqueOrThrow({ where: { name: challenge.role } })
  const row = await prisma.challenge.upsert({
    where: { importKey: challenge.id },
    update: { title: challenge.title, difficulty: challenge.difficulty, startKey: challenge.start, questions: challenge.questions as unknown as Prisma.InputJsonValue, summary: challenge.summary, assessment: challenge.assessment as unknown as Prisma.InputJsonValue | undefined },
    create: { importKey: challenge.id, title: challenge.title, roleId: role.id, difficulty: challenge.difficulty, startKey: challenge.start, questions: challenge.questions as unknown as Prisma.InputJsonValue, summary: challenge.summary, assessment: challenge.assessment as unknown as Prisma.InputJsonValue | undefined }
  })
  const existingLevel = await prisma.level.findUnique({ where: { challengeId: row.id } })
  if (!existingLevel) {
    const last = await prisma.level.findFirst({ orderBy: { number: 'desc' }, select: { number: true } })
    const industry = await prisma.industry.findUniqueOrThrow({ where: { name: 'بهره‌وری' } })
    await prisma.level.create({ data: { number: (last?.number ?? 0) + 1, industryId: industry.id, challengeId: row.id, difficulty: challenge.difficulty, type: isSingleQuestion(challenge.questions) ? 'single_question' : 'challenge' } })
  }
  for (const badge of extraBadges) await prisma.badge.upsert({ where: { id: badge.id }, create: badge, update: badge })
  const industryBadge = { id: 'industry-explorer', name: 'کاوشگر صنایع', description: 'همهٔ مراحل یکی از صنایع مسیر نقش خود را پشت سر بگذارید', iconRef: '🧭', unlockCondition: { type: 'industryCompleted' } }
  await prisma.badge.upsert({ where: { id: industryBadge.id }, create: industryBadge, update: industryBadge })
  console.log(`Synced written challenge ${challenge.id} and ${extraBadges.length} badges.`)
} finally {
  await prisma.$disconnect()
}
}

main().catch(error => { console.error(error); process.exitCode = 1 })
