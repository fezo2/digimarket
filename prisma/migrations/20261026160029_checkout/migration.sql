-- AlterEnum
ALTER TYPE "StockStatus" ADD VALUE 'RESERVED';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "expiresAt" TIMESTAMP(3);
UPDATE "Order" SET "expiresAt" = "createdAt" + INTERVAL '30 minutes';
ALTER TABLE "Order" ALTER COLUMN "expiresAt" SET NOT NULL;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "deliveryContent" TEXT,
ADD COLUMN     "deliveryType" "DeliveryType",
ADD COLUMN     "instructions" TEXT;

-- Backfill any pre-checkout rows before enforcing the snapshot requirement.
UPDATE "OrderItem" i SET "deliveryType" = p."deliveryType",
  "deliveryContent" = CASE WHEN p."deliveryType" = 'UNIQUE_CODES' THEN NULL ELSE p."deliveryContent" END,
  "instructions" = p."instructions"
FROM "Product" p WHERE p.id = i."productId";
ALTER TABLE "OrderItem" ALTER COLUMN "deliveryType" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Order_status_expiresAt_idx" ON "Order"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "Order_buyerId_createdAt_idx" ON "Order"("buyerId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_sellerId_idx" ON "OrderItem"("sellerId");
