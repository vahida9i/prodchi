CREATE TABLE "DailyChallenge" (
  "userId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "day" TEXT NOT NULL,
  "challengeId" TEXT NOT NULL,
  "sessionId" TEXT,
  "xpEarned" INTEGER NOT NULL DEFAULT 0,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "DailyChallenge_pkey" PRIMARY KEY ("userId", "roleId", "day")
);
CREATE UNIQUE INDEX "DailyChallenge_sessionId_key" ON "DailyChallenge"("sessionId");
CREATE INDEX "DailyChallenge_roleId_completedAt_idx" ON "DailyChallenge"("roleId", "completedAt");
ALTER TABLE "DailyChallenge" ADD CONSTRAINT "DailyChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyChallenge" ADD CONSTRAINT "DailyChallenge_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DailyChallenge" ADD CONSTRAINT "DailyChallenge_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
