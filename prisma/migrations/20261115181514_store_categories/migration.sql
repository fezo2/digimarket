-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "storeCategoryId" TEXT;

-- CreateTable
CREATE TABLE "StoreCategory" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoreCategory_sellerId_sortOrder_idx" ON "StoreCategory"("sellerId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "StoreCategory_sellerId_name_key" ON "StoreCategory"("sellerId", "name");

-- CreateIndex
CREATE INDEX "Product_storeCategoryId_idx" ON "Product"("storeCategoryId");

-- AddForeignKey
ALTER TABLE "StoreCategory" ADD CONSTRAINT "StoreCategory_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_storeCategoryId_fkey" FOREIGN KEY ("storeCategoryId") REFERENCES "StoreCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
