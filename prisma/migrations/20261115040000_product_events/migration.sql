-- CreateEnum
CREATE TYPE "ProductEventKind" AS ENUM ('VIEW', 'CART');

-- CreateTable
CREATE TABLE "ProductEvent" (
    "id" BIGSERIAL NOT NULL,
    "productId" TEXT NOT NULL,
    "kind" "ProductEventKind" NOT NULL,
    "visitor" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductEvent_createdAt_kind_idx" ON "ProductEvent"("createdAt", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "ProductEvent_productId_kind_visitor_day_key" ON "ProductEvent"("productId", "kind", "visitor", "day");

-- AddForeignKey
ALTER TABLE "ProductEvent" ADD CONSTRAINT "ProductEvent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
