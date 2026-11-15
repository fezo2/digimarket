-- Kashier refunds: "pending" while the refund call runs, then the refund transaction id.
ALTER TABLE "Order" ADD COLUMN "gatewayRefundRef" TEXT;
