-- DropForeignKey
ALTER TABLE "Attempt" DROP CONSTRAINT "Attempt_challengeId_fkey";

-- DropForeignKey
ALTER TABLE "Attempt" DROP CONSTRAINT "Attempt_userId_fkey";

-- DropForeignKey
ALTER TABLE "CapabilityProfile" DROP CONSTRAINT "CapabilityProfile_userId_fkey";

-- DropForeignKey
ALTER TABLE "ChallengeSkill" DROP CONSTRAINT "ChallengeSkill_challengeId_fkey";

-- DropForeignKey
ALTER TABLE "ChallengeSkill" DROP CONSTRAINT "ChallengeSkill_skillId_fkey";

-- DropForeignKey
ALTER TABLE "Skill" DROP CONSTRAINT "Skill_skillCategoryId_fkey";

-- DropForeignKey
ALTER TABLE "SkillCategory" DROP CONSTRAINT "SkillCategory_roleId_fkey";

-- DropForeignKey
ALTER TABLE "SkillScore" DROP CONSTRAINT "SkillScore_skillId_fkey";

-- DropForeignKey
ALTER TABLE "SkillScore" DROP CONSTRAINT "SkillScore_userId_fkey";

-- DropForeignKey
ALTER TABLE "Streak" DROP CONSTRAINT "Streak_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserBadge" DROP CONSTRAINT "UserBadge_badgeId_fkey";

-- DropForeignKey
ALTER TABLE "UserBadge" DROP CONSTRAINT "UserBadge_userId_fkey";

-- DropIndex
DROP INDEX "Challenge_roleId_status_tier_idx";

-- AlterTable
ALTER TABLE "Challenge" DROP COLUMN "answerSheet",
DROP COLUMN "applicantSteps",
DROP COLUMN "description",
DROP COLUMN "estimatedMinutes",
DROP COLUMN "hiddenCase",
DROP COLUMN "tier",
DROP COLUMN "xpValue",
ADD COLUMN     "importKey" TEXT NOT NULL,
ADD COLUMN     "questions" JSONB NOT NULL,
ADD COLUMN     "startKey" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "difficulty" SET DATA TYPE TEXT,
ALTER COLUMN "status" SET DEFAULT 'active';

-- DropTable
DROP TABLE "Attempt";

-- DropTable
DROP TABLE "Badge";

-- DropTable
DROP TABLE "CapabilityProfile";

-- DropTable
DROP TABLE "ChallengeSkill";

-- DropTable
DROP TABLE "Skill";

-- DropTable
DROP TABLE "SkillCategory";

-- DropTable
DROP TABLE "SkillScore";

-- DropTable
DROP TABLE "Streak";

-- DropTable
DROP TABLE "UserBadge";

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "currentKey" TEXT,
    "path" JSONB NOT NULL DEFAULT '[]',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FailedImport" (
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "errors" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FailedImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Session_userId_status_idx" ON "Session"("userId", "status");

-- CreateIndex
CREATE INDEX "Session_userId_challengeId_idx" ON "Session"("userId", "challengeId");

-- CreateIndex
CREATE UNIQUE INDEX "Challenge_importKey_key" ON "Challenge"("importKey");

-- CreateIndex
CREATE INDEX "Challenge_roleId_status_idx" ON "Challenge"("roleId", "status");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

