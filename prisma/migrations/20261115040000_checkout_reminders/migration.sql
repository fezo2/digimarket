-- AlterTable
ALTER TABLE "User" ADD COLUMN "checkoutRemindersOffAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "reminderSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Order_status_reminderSentAt_createdAt_idx" ON "Order"("status", "reminderSentAt", "createdAt");

-- CreateTable
CREATE TABLE "CheckoutReminderSettings" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "delayMinutes" INTEGER NOT NULL DEFAULT 60,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckoutReminderSettings_pkey" PRIMARY KEY ("id")
);
