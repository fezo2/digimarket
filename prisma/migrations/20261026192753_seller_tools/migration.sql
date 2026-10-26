-- CreateTable
CREATE TABLE "SellerReply" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SellerReply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SellerReply_sellerId_createdAt_idx" ON "SellerReply"("sellerId", "createdAt");

-- AddForeignKey
ALTER TABLE "SellerReply" ADD CONSTRAINT "SellerReply_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
