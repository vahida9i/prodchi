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

  // The role tracks are fixed seed data (spec Section 4): the import validator
  // checks a challenge JSON's `role` against these exact names, and a
  // candidate's onboarding choice picks the track their content comes from.
  const productDesign = await prisma.role.upsert({
    where: { name: 'Product Design' },
    update: {},
    create: { name: 'Product Design' }
  })

  const productManagement = await prisma.role.upsert({
    where: { name: 'Product Management' },
    update: {},
    create: { name: 'Product Management' }
  })

  const techLead = await prisma.role.upsert({
    where: { name: 'Tech Lead' },
    update: {},
    create: { name: 'Tech Lead' }
  })

  console.log('Created roles:', [productDesign.name, productManagement.name, techLead.name].join(', '))

  // Create admin user from env vars
  const adminEmail = process.env.ADMIN_SEED_EMAIL || 'admin@prodchi.local'
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

  // Industry labels are always Persian; names are stable keys for path import.
  const industries = [
    { name: 'خرده‌فروشی آنلاین', order: 0 },
    { name: 'فین‌تک', order: 1 },
    { name: 'سلامت', order: 2 },
    { name: 'سرویس ابری', order: 3 },
    { name: 'بهره‌وری', order: 4 },
    { name: 'سازمانی', order: 5 }
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
  const badges = [
    {
      id: 'first-level',
      name: 'گام نخست',
      description: 'اولین مرحله خود را با موفقیت پشت سر بگذارید',
      iconRef: '🎯',
      unlockCondition: { type: 'levelsPassedAbove', threshold: 1 }
    },
    {
      id: 'sharp-eye',
      name: 'دید دقیق',
      description: '۳ مرحله را با انتخاب تمام گزینه‌های ایده‌آل سپری کنید',
      iconRef: '🔍',
      unlockCondition: { type: 'perfectLevelsAbove', threshold: 3 }
    },
    {
      id: 'star-collector',
      name: 'شکارچی ستاره‌ها',
      description: '۱۵ ستاره در طول مسیر مراحل به دست آورید',
      iconRef: '⭐',
      unlockCondition: { type: 'starsAbove', threshold: 15 }
    },
    {
      id: 'streak-7',
      name: 'تعهد هفتگی',
      description: '۷ روز تداوم فعالیت داشته باشید',
      iconRef: '🔥',
      unlockCondition: { type: 'streakAbove', threshold: 7 }
    },
    {
      id: 'path-pioneer',
      name: 'پیشگام مسیر',
      description: '۱۰ مرحله را به پایان برسانید',
      iconRef: '🏆',
      unlockCondition: { type: 'levelsPassedAbove', threshold: 10 }
    },
    {
      id: 'industry-explorer',
      name: 'کاوشگر صنایع',
      description: 'همهٔ مراحل یکی از صنایع مسیر نقش خود را پشت سر بگذارید',
      iconRef: '🧭',
      unlockCondition: { type: 'industryCompleted' }
    },
    {
      id: 'three-steps', name: 'شروع محکم', description: '۳ مرحله را به پایان برسانید', iconRef: '🚀',
      unlockCondition: { type: 'levelsPassedAbove', threshold: 3 }
    },
    {
      id: 'five-steps', name: 'مسیرساز', description: '۵ مرحله را به پایان برسانید', iconRef: '🗺️',
      unlockCondition: { type: 'levelsPassedAbove', threshold: 5 }
    },
    {
      id: 'streak-3', name: 'سه روز پیوسته', description: '۳ روز تداوم فعالیت داشته باشید', iconRef: '🔥',
      unlockCondition: { type: 'streakAbove', threshold: 3 }
    },
    {
      id: 'streak-30', name: 'یک ماه استمرار', description: '۳۰ روز تداوم فعالیت داشته باشید', iconRef: '🏅',
      unlockCondition: { type: 'streakAbove', threshold: 30 }
    },
    {
      id: 'perfect-first', name: 'بی‌نقص', description: 'یک مرحله را با تمام انتخاب‌های برتر تمام کنید', iconRef: '💎',
      unlockCondition: { type: 'perfectLevelsAbove', threshold: 1 }
    },
    {
      id: 'star-30', name: 'کهکشان ستاره‌ها', description: '۳۰ ستاره در مسیر خود جمع کنید', iconRef: '🌟',
      unlockCondition: { type: 'starsAbove', threshold: 30 }
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
