-- Unit-layer rubric for the feedback model: one optional JSON block per challenge.
ALTER TABLE "Challenge" ADD COLUMN "assessment" JSONB;