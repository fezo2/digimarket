import type { Prisma } from "@prisma/client";

// A product is listed and purchasable only while its seller is verified and
// not suspended by an admin. Every storefront query goes through this filter.
export const listedProduct = {
  status: "ACTIVE",
  salesEnabled: true,
  seller: { kycStatus: "APPROVED", salesSuspendedAt: null },
} satisfies Prisma.ProductWhereInput;

export function isListed(product: {
  status: string;
  salesEnabled: boolean;
  seller: { kycStatus: string; salesSuspendedAt: Date | null };
}) {
  return (
    product.status === "ACTIVE" &&
    product.salesEnabled &&
    product.seller.kycStatus === "APPROVED" &&
    !product.seller.salesSuspendedAt
  );
}
