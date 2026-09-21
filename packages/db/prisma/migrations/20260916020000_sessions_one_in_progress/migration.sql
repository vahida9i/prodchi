-- One in-progress session per user per challenge (POST /sessions resume invariant).
-- Partial indexes are not expressible in the Prisma schema, so this index is
-- maintained directly in migration SQL.
CREATE UNIQUE INDEX "sessions_one_in_progress"
  ON "Session"("userId", "challengeId")
  WHERE status = 'in_progress';
