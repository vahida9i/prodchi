-- Short authored brief on the business and who its customers are: one optional
-- text block per challenge, shown on the path map before a run starts.
-- Nullable — content imported before summaries existed keeps importing.
ALTER TABLE "Challenge" ADD COLUMN "summary" TEXT;
