/*
  Warnings:

  - Added the required column `holderName` to the `Payout` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paidAmount" INTEGER,
ADD COLUMN     "refundNote" TEXT,
ADD COLUMN     "refundedAt" TIMESTAMP(3),
ADD COLUMN     "reviewReason" TEXT;

-- AlterTable
ALTER TABLE "Payout" ADD COLUMN     "holderName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "processedById" TEXT,
ADD COLUMN     "rejectReason" TEXT;

-- AlterTable
ALTER TABLE "SellerProfile" ADD COLUMN     "payoutAccount" TEXT,
ADD COLUMN     "payoutHolderName" TEXT,
ADD COLUMN     "payoutMethod" "PayoutMethod",
ADD COLUMN     "payoutUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "data" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_targetId_createdAt_idx" ON "AuditLog"("targetId", "createdAt");

-- CreateIndex
CREATE INDEX "LedgerEntry_sellerId_availableAt_idx" ON "LedgerEntry"("sellerId", "availableAt");

-- CreateIndex
CREATE INDEX "Payout_status_createdAt_idx" ON "Payout"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Payout_sellerId_createdAt_idx" ON "Payout"("sellerId", "createdAt");

-- Existing payouts have no reliable holder snapshot. Leave them blank for admin review.
ALTER TABLE "Payout" ALTER COLUMN "holderName" DROP DEFAULT;
CREATE UNIQUE INDEX "Payout_one_open_per_seller" ON "Payout"("sellerId") WHERE status = 'REQUESTED';
