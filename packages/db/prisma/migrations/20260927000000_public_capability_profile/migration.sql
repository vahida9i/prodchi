ALTER TABLE "User" ADD COLUMN "displayName" TEXT;
ALTER TABLE "User" ADD COLUMN "publicProfileToken" TEXT;
ALTER TABLE "User" ADD COLUMN "mentorVerifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "mentorVerifiedBy" TEXT;
CREATE UNIQUE INDEX "User_publicProfileToken_key" ON "User"("publicProfileToken");

CREATE TABLE "ProfileEvidence" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "url" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "verifiedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProfileEvidence_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProfileEvidence_userId_verifiedAt_idx" ON "ProfileEvidence"("userId", "verifiedAt");
ALTER TABLE "ProfileEvidence" ADD CONSTRAINT "ProfileEvidence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
