-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "supplier" TEXT,
ADD COLUMN     "supplierAttempt" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "supplierError" TEXT,
ADD COLUMN     "supplierOrderId" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "supplier" TEXT,
ADD COLUMN     "supplierCostMills" INTEGER,
ADD COLUMN     "supplierProductId" TEXT,
ADD COLUMN     "supplierStock" INTEGER,
ADD COLUMN     "supplierSyncedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SupplierSettings" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT,
    "usdRate" INTEGER NOT NULL DEFAULT 5500,
    "multiplierBps" INTEGER NOT NULL DEFAULT 25000,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_supplier_supplierProductId_key" ON "Product"("supplier", "supplierProductId");
