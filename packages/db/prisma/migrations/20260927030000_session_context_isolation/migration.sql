-- Daily/free-play runs and numbered path runs of the same challenge have
-- independent progress. PostgreSQL 16 treats NULL levelId as equal here so
-- duplicate daily starts still resume a single null-level session.
DROP INDEX "sessions_one_in_progress";
CREATE UNIQUE INDEX "sessions_one_in_progress"
  ON "Session"("userId", "challengeId", "levelId") NULLS NOT DISTINCT
  WHERE status = 'in_progress';
