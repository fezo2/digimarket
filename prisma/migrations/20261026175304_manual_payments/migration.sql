-- CreateEnum
CREATE TYPE "ManualMethod" AS ENUM ('INSTAPAY', 'WALLET');

-- CreateEnum
CREATE TYPE "ManualPaymentStatus" AS ENUM ('SUBMITTED', 'CONFIRMED', 'REJECTED');

-- CreateTable
CREATE TABLE "ManualPayment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "method" "ManualMethod" NOT NULL,
    "senderAccount" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "receiptKey" TEXT NOT NULL,
    "status" "ManualPaymentStatus" NOT NULL DEFAULT 'SUBMITTED',
    "receivedAmount" INTEGER,
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "ManualPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ManualPayment_orderId_key" ON "ManualPayment"("orderId");

-- CreateIndex
CREATE INDEX "ManualPayment_status_createdAt_idx" ON "ManualPayment"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ManualPayment_method_reference_key" ON "ManualPayment"("method", "reference");

-- AddForeignKey
ALTER TABLE "ManualPayment" ADD CONSTRAINT "ManualPayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
