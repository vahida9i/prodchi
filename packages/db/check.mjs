import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

(async () => {
  const challenges = await prisma.challenge.findMany({
    include: { level: true, role: true },
    orderBy: { createdAt: 'desc' }
  });
  
  console.log('Challenges with levels:');
  challenges.filter(c => c.level).forEach(c => {
    console.log(`  ${c.level.number}. ${c.title} [${c.role.name}] - ${c.level.industry.name}`);
  });
  
  console.log('\nChallenges without levels:');
  challenges.filter(c => !c.level).forEach(c => {
    console.log(`  - ${c.title} [${c.role.name}] (${c.importKey})`);
  });
  
  const total = await prisma.level.count();
  console.log(`\nTotal levels: ${total}`);
  
  await prisma.$disconnect();
})();
