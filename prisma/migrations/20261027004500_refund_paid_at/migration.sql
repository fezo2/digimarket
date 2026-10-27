-- AlterTable
ALTER TABLE "Order" ADD COLUMN "refundPaidAt" TIMESTAMP(3);

-- Refunds so far were all recorded by an admin after paying the buyer.
UPDATE "Order" SET "refundPaidAt" = "refundedAt" WHERE "refundedAt" IS NOT NULL;
