import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

// The seed script is run by tsx, which does not read .env files. Load the repo
// root .env (or the copy next to this package) before Prisma reads DATABASE_URL.
for (const path of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../.env')]) {
  if (existsSync(path)) {
    process.loadEnvFile(path)
    break
  }
}

if (!process.env.DATABASE_URL) {
  console.error('[seed] DATABASE_URL is not set. Add it to .env at the repo root or to packages/db/.env.')
  process.exit(1)
}

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // The app consumes challenges for one role only; the import validator checks
  // the challenge JSON's `role` against this exact name.
  const productDesign = await prisma.role.upsert({
    where: { name: 'Product Design' },
    update: {},
    create: { name: 'Product Design' }
  })

  console.log('Created roles:', productDesign.name)

  // Create admin user from env vars
  const adminEmail = process.env.ADMIN_SEED_EMAIL || 'admin@baaten.local'
  const adminPassword = process.env.ADMIN_SEED_PASSWORD || 'admin123'
  const passwordHash = await bcrypt.hash(adminPassword, 12)

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash, role: 'admin', roleTrackId: productDesign.id },
    create: {
      email: adminEmail,
      passwordHash,
      role: 'admin',
      roleTrackId: productDesign.id,
      cohortId: 'default'
    }
  })

  console.log('Created admin user:', admin.email)

  // Industries are the path's content dimension — every level is tagged with one.
  const industries = [
    { name: 'E-commerce', order: 0 },
    { name: 'Fintech', order: 1 },
    { name: 'Health', order: 2 },
    { name: 'SaaS', order: 3 }
  ]

  const industryByName = new Map<string, { id: string }>()
  for (const industry of industries) {
    const row = await prisma.industry.upsert({
      where: { name: industry.name },
      update: { order: industry.order },
      create: industry
    })
    industryByName.set(row.name, row)
  }

  console.log('Created industries:', industries.map(i => i.name).join(', '))

  // Badges key off the path model (levels / stars / streak / industry). The v1
  // `skillScoreAbove` condition is gone along with the skill tree.
  const ecommerce = industryByName.get('E-commerce')!
  const badges = [
    {
      id: 'first-level',
      name: 'First Steps',
      description: 'Pass your first level',
      iconRef: '🎯',
      unlockCondition: { type: 'levelsPassedAbove', threshold: 1 }
    },
    {
      id: 'sharp-eye',
      name: 'Sharp Eye',
      description: 'Pass 3 levels picking every best choice',
      iconRef: '🔍',
      unlockCondition: { type: 'perfectLevelsAbove', threshold: 3 }
    },
    {
      id: 'star-collector',
      name: 'Star Collector',
      description: 'Collect 15 stars across the path',
      iconRef: '⭐',
      unlockCondition: { type: 'starsAbove', threshold: 15 }
    },
    {
      id: 'streak-7',
      name: 'Week Warrior',
      description: 'Maintain a 7-day streak',
      iconRef: '🔥',
      unlockCondition: { type: 'streakAbove', threshold: 7 }
    },
    {
      id: 'path-pioneer',
      name: 'Path Pioneer',
      description: 'Pass 10 levels',
      iconRef: '🏆',
      unlockCondition: { type: 'levelsPassedAbove', threshold: 10 }
    },
    {
      id: 'industry-explorer',
      name: 'Industry Explorer',
      description: 'Pass every level in the E-commerce path',
      iconRef: '🧭',
      unlockCondition: { type: 'industryCompleted', industryId: ecommerce.id }
    }
  ]

  for (const badge of badges) {
    await prisma.badge.upsert({
      where: { id: badge.id },
      update: {
        name: badge.name,
        description: badge.description,
        iconRef: badge.iconRef,
        unlockCondition: badge.unlockCondition
      },
      create: badge
    })
  }

  console.log('Created badges:', badges.length)
  console.log('Seeding complete!')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())