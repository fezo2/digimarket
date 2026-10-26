-- AlterTable
ALTER TABLE "SellerProfile" ADD COLUMN     "commissionBps" INTEGER,
ADD COLUMN     "holdDays" INTEGER,
ADD COLUMN     "payoutsFrozenAt" TIMESTAMP(3),
ADD COLUMN     "payoutsFrozenReason" TEXT,
ADD COLUMN     "salesSuspendReason" TEXT,
ADD COLUMN     "salesSuspendedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "adminNote" TEXT,
ADD COLUMN     "suspendReason" TEXT,
ADD COLUMN     "suspendedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Announcement_active_createdAt_idx" ON "Announcement"("active", "createdAt");

-- Admin overrides stay within sane bounds even if a form check is bypassed.
ALTER TABLE "SellerProfile" ADD CONSTRAINT "SellerProfile_commissionBps_range" CHECK ("commissionBps" IS NULL OR ("commissionBps" >= 0 AND "commissionBps" <= 10000));
ALTER TABLE "SellerProfile" ADD CONSTRAINT "SellerProfile_holdDays_range" CHECK ("holdDays" IS NULL OR ("holdDays" >= 0 AND "holdDays" <= 60));
