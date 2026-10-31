-- CreateEnum
CREATE TYPE "PaymentNoticeStatus" AS ENUM ('MATCHED', 'UNMATCHED', 'IGNORED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "payAmount" INTEGER,
ADD COLUMN     "payFrom" TEXT;

-- CreateTable
CREATE TABLE "PaymentNotice" (
    "id" TEXT NOT NULL,
    "textHash" TEXT NOT NULL,
    "sender" TEXT,
    "text" TEXT NOT NULL,
    "amount" INTEGER,
    "status" "PaymentNoticeStatus" NOT NULL,
    "orderId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentNotice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentNotice_textHash_key" ON "PaymentNotice"("textHash");

-- CreateIndex
CREATE INDEX "PaymentNotice_createdAt_idx" ON "PaymentNotice"("createdAt");

-- CreateIndex
CREATE INDEX "Order_paymentProvider_payAmount_idx" ON "Order"("paymentProvider", "payAmount");
