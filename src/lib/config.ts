import type { SellerType } from "@prisma/client";

export const SITE_NAME = "ديجي مصر";
export const SITE_NAME_EN = "Digiegy";

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

// Smallest payout a seller can request, in piasters (default EGP 1,000).
export const MIN_PAYOUT =
  Math.round(Number(process.env.MIN_PAYOUT_EGP || 1000) * 100) || 100_000;
