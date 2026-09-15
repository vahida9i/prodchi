import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create roles
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

  console.log('Created roles:', productDesign.name, productManagement.name)

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
      roleTrackId: productDesign.id
    }
  })

  console.log('Created admin user:', admin.email)

  // Create skill categories for Product Design
  const research = await prisma.skillCategory.upsert({
    where: { id: 'research-category' },
    update: {},
    create: {
      id: 'research-category',
      name: 'Research & Discovery',
      order: 0,
      roleId: productDesign.id
    }
  })

  const strategy = await prisma.skillCategory.upsert({
    where: { id: 'strategy-category' },
    update: {},
    create: {
      id: 'strategy-category',
      name: 'Strategy & Prioritization',
      order: 1,
      roleId: productDesign.id
    }
  })

  const design = await prisma.skillCategory.upsert({
    where: { id: 'design-category' },
    update: {},
    create: {
      id: 'design-category',
      name: 'Interaction & Visual Design',
      order: 2,
      roleId: productDesign.id
    }
  })

  const validation = await prisma.skillCategory.upsert({
    where: { id: 'validation-category' },
    update: {},
    create: {
      id: 'validation-category',
      name: 'Validation & Iteration',
      order: 3,
      roleId: productDesign.id
    }
  })

  console.log('Created skill categories')

  // Create skills for Product Design
  const skills = [
    // Research & Discovery
    { id: 'user-research', name: 'User Research', order: 0, skillCategoryId: research.id, unlockThreshold: null },
    { id: 'competitive-analysis', name: 'Competitive Analysis', order: 1, skillCategoryId: research.id, unlockThreshold: 40 },
    { id: 'data-analysis', name: 'Quantitative Data Analysis', order: 2, skillCategoryId: research.id, unlockThreshold: 50 },

    // Strategy & Prioritization
    { id: 'problem-framing', name: 'Problem Framing', order: 0, skillCategoryId: strategy.id, unlockThreshold: null },
    { id: 'roadmapping', name: 'Roadmapping & Prioritization', order: 1, skillCategoryId: strategy.id, unlockThreshold: 40 },
    { id: 'metrics-definition', name: 'Metrics Definition', order: 2, skillCategoryId: strategy.id, unlockThreshold: 50 },

    // Interaction & Visual Design
    { id: 'wireframing', name: 'Wireframing & Prototyping', order: 0, skillCategoryId: design.id, unlockThreshold: null },
    { id: 'visual-design', name: 'Visual Design Systems', order: 1, skillCategoryId: design.id, unlockThreshold: 40 },
    { id: 'interaction-design', name: 'Interaction Design', order: 2, skillCategoryId: design.id, unlockThreshold: 50 },

    // Validation & Iteration
    { id: 'usability-testing', name: 'Usability Testing', order: 0, skillCategoryId: validation.id, unlockThreshold: null },
    { id: 'ab-testing', name: 'A/B Testing & Experimentation', order: 1, skillCategoryId: validation.id, unlockThreshold: 40 },
    { id: 'iteration', name: 'Iteration & Learning Loops', order: 2, skillCategoryId: validation.id, unlockThreshold: 50 }
  ]

  for (const skill of skills) {
    await prisma.skill.upsert({
      where: { id: skill.id },
      update: { name: skill.name, order: skill.order, skillCategoryId: skill.categoryId, unlockThreshold: skill.unlockThreshold },
      create: skill
    })
  }

  console.log('Created skills')

  // Create some badges
  const badges = [
    {
      id: 'first-attempt',
      name: 'First Steps',
      description: 'Complete your first challenge',
      iconRef: '🎯',
      unlockCondition: { type: 'attemptsCompletedAbove', threshold: 1 }
    },
    {
      id: 'streak-7',
      name: 'Week Warrior',
      description: 'Maintain a 7-day streak',
      iconRef: '🔥',
      unlockCondition: { type: 'streakAbove', threshold: 7 }
    },
    {
      id: 'streak-30',
      name: 'Monthly Master',
      description: 'Maintain a 30-day streak',
      iconRef: '🏆',
      unlockCondition: { type: 'streakAbove', threshold: 30 }
    },
    {
      id: 'skill-master',
      name: 'Skill Master',
      description: 'Score 80+ in any skill',
      iconRef: '⭐',
      unlockCondition: { type: 'skillScoreAbove', skillId: 'user-research', threshold: 80 }
    },
    {
      id: 'case-study-complete',
      name: 'Case Study Complete',
      description: 'Complete 3 case studies (difficulty 4+)',
      iconRef: '📚',
      unlockCondition: { type: 'attemptsCompletedAbove', threshold: 3 }
    }
  ]

  for (const badge of badges) {
    await prisma.badge.upsert({
      where: { id: badge.id },
      update: badge,
      create: badge
    })
  }

  console.log('Created badges')
  console.log('Seeding complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })