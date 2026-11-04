-- AlterEnum
ALTER TYPE "PaymentNoticeStatus" ADD VALUE 'HELD';

-- AlterTable
ALTER TABLE "PaymentNotice" ADD COLUMN     "balance" INTEGER,
ADD COLUMN     "trusted" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "PaymentNotice_trusted_createdAt_idx" ON "PaymentNotice"("trusted", "createdAt");
