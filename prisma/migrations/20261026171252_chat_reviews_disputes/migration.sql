-- AlterEnum
ALTER TYPE "DisputeStatus" ADD VALUE 'CLOSED_BY_BUYER';

-- AlterTable
ALTER TABLE "Dispute" ADD COLUMN     "resolvedById" TEXT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "attachmentKey" TEXT,
ADD COLUMN     "flagged" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "negativeReviews" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "positiveReviews" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "editedOnce" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hiddenAt" TIMESTAMP(3),
ADD COLUMN     "hiddenReason" TEXT,
ADD COLUMN     "sellerReplyAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SellerProfile" ADD COLUMN     "negativeReviews" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "positiveReviews" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "OrderRead" (
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderRead_pkey" PRIMARY KEY ("orderId","userId")
);

-- CreateIndex
CREATE INDEX "Dispute_status_createdAt_idx" ON "Dispute"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Dispute_orderItemId_idx" ON "Dispute"("orderItemId");

-- CreateIndex
CREATE INDEX "Review_productId_createdAt_idx" ON "Review"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "Review_sellerId_createdAt_idx" ON "Review"("sellerId", "createdAt");

CREATE UNIQUE INDEX "Dispute_one_open_per_item" ON "Dispute"("orderItemId") WHERE status = 'OPEN';
UPDATE "Product" p SET "positiveReviews" = (SELECT count(*) FROM "Review" r WHERE r."productId" = p.id AND r.positive AND r."hiddenAt" IS NULL), "negativeReviews" = (SELECT count(*) FROM "Review" r WHERE r."productId" = p.id AND NOT r.positive AND r."hiddenAt" IS NULL);
UPDATE "SellerProfile" s SET "positiveReviews" = (SELECT count(*) FROM "Review" r WHERE r."sellerId" = s.id AND r.positive AND r."hiddenAt" IS NULL), "negativeReviews" = (SELECT count(*) FROM "Review" r WHERE r."sellerId" = s.id AND NOT r.positive AND r."hiddenAt" IS NULL);
