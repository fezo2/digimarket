-- Each portal gets its own password and its own sign-out counter.
ALTER TABLE "User" ADD COLUMN "sellerPasswordHash" TEXT,
ADD COLUMN "adminPasswordHash" TEXT,
ADD COLUMN "storeSessionVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "sellerSessionVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "adminSessionVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "PasswordResetToken" ADD COLUMN "site" TEXT NOT NULL DEFAULT 'store';

-- Existing sellers and admins keep today's password on their portal, now
-- stored separately so a later change on one portal leaves the others alone.
UPDATE "User" SET "sellerPasswordHash" = "passwordHash"
WHERE "id" IN (SELECT "userId" FROM "SellerProfile");
UPDATE "User" SET "adminPasswordHash" = "passwordHash" WHERE "role" = 'ADMIN';
