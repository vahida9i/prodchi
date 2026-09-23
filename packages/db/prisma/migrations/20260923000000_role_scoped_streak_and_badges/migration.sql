-- Role-scoped streaks and badges: profile and progress must never aggregate
-- across role tracks. Streak and UserBadge gain a roleId and composite keys.

-- 1) Rows of users with no role track cannot be attributed to a track: drop them
--    (they are meaningless under the new contract — no user reaches gamification
--    before onboarding picks a role).
DELETE FROM "Streak" WHERE "userId" IN (SELECT id FROM "User" WHERE "roleTrackId" IS NULL);
DELETE FROM "UserBadge" WHERE "userId" IN (SELECT id FROM "User" WHERE "roleTrackId" IS NULL);

-- 2) Add the column, backfill every row to its owner's CURRENT track (all
--    existing data is single-track: nobody could switch before this migration),
--    then enforce NOT NULL.
ALTER TABLE "Streak" ADD COLUMN "roleId" TEXT;
ALTER TABLE "UserBadge" ADD COLUMN "roleId" TEXT;
UPDATE "Streak" SET "roleId" = "User"."roleTrackId" FROM "User" WHERE "Streak"."userId" = "User"."id";
UPDATE "UserBadge" SET "roleId" = "User"."roleTrackId" FROM "User" WHERE "UserBadge"."userId" = "User"."id";
ALTER TABLE "Streak" ALTER COLUMN "roleId" SET NOT NULL;
ALTER TABLE "UserBadge" ALTER COLUMN "roleId" SET NOT NULL;

-- 3) Composite primary keys: one streak / one badge-earning per (user, role).
ALTER TABLE "Streak" DROP CONSTRAINT "Streak_pkey";
ALTER TABLE "Streak" ADD CONSTRAINT "Streak_pkey" PRIMARY KEY ("userId", "roleId");
ALTER TABLE "UserBadge" DROP CONSTRAINT "UserBadge_pkey";
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("userId", "badgeId", "roleId");

-- 4) Foreign keys to Role (Prisma's default for required relations).
ALTER TABLE "Streak" ADD CONSTRAINT "Streak_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5) Read-path indexes: every scoped lookup filters by (userId, roleId).
CREATE INDEX "Streak_roleId_idx" ON "Streak"("roleId");
CREATE INDEX "UserBadge_roleId_idx" ON "UserBadge"("roleId");