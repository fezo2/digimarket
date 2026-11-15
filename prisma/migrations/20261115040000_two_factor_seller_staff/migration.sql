-- Optional two-step sign in, and employee accounts for seller stores.
-- CreateEnum
CREATE TYPE "StaffPermission" AS ENUM ('PRODUCTS', 'ORDERS', 'MESSAGES', 'FINANCE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "twoFactorBackupCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "twoFactorEnabledAt" TIMESTAMP(3),
ADD COLUMN     "twoFactorLastStep" INTEGER,
ADD COLUMN     "twoFactorPendingSecret" TEXT,
ADD COLUMN     "twoFactorSecret" TEXT;

-- CreateTable
CREATE TABLE "SellerStaff" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissions" "StaffPermission"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SellerStaff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SellerStaff_userId_key" ON "SellerStaff"("userId");

-- CreateIndex
CREATE INDEX "SellerStaff_sellerId_idx" ON "SellerStaff"("sellerId");

-- AddForeignKey
ALTER TABLE "SellerStaff" ADD CONSTRAINT "SellerStaff_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerStaff" ADD CONSTRAINT "SellerStaff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

