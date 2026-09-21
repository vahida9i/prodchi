-- Link a session to the path level it was started from, so a session reaching
-- END can be credited against that level (scoring + gamification). Nullable:
-- sessions started straight from a challenge (POST /api/v1/sessions) have no
-- level and simply do not score.

-- AlterTable
ALTER TABLE "Session" ADD COLUMN "levelId" TEXT;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Session_levelId_idx" ON "Session"("levelId");
