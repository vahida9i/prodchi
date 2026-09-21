-- The run's score, frozen when the session reached END.
--
-- Challenges can now be re-imported (updated in place) at any time. Without a
-- snapshot, GET /sessions/:id/summary would recompute hits/answered from the
-- live question graph and could disagree with the XP the run was credited with
-- (LevelProgress.xpEarned is never recomputed). Nullable: runs completed before
-- this migration fall back to recomputation.
ALTER TABLE "Session" ADD COLUMN "score" JSONB;