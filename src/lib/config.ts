import type { SellerType } from "@prisma/client";

export const SITE_NAME = "ديجي ماركت";

// Benefits differ by seller type: verified companies get paid out faster
// and can list more products.
export const SELLER_TIERS: Record<
  SellerType,
  { label: string; holdDays: number; maxActiveProducts: number; badge: string }
> = {
  INDIVIDUAL: {
    label: "فرد",
    holdDays: 7,
    maxActiveProducts: 50,
    badge: "تاجر موثّق",
  },
  COMPANY: {
    label: "شركة",
    holdDays: 3,
    maxActiveProducts: 1000,
    badge: "شركة موثّقة",
  },
};

export const MIN_PAYOUT = 10_000; // 100 EGP
