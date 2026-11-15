import type { SellerProfile, SellerStaff, StaffPermission } from "@prisma/client";

// Employee accounts for a store. Each one signs in with their own account on
// the seller site and sees only the parts of the office the owner ticked.
// Opening a store, KYC, store settings, payout details, withdrawals and the
// staff list itself stay with the owner.

export const STAFF_PERMISSIONS: { key: StaffPermission; label: string; hint: string }[] = [
  { key: "PRODUCTS", label: "المنتجات", hint: "إضافة وتعديل المنتجات والمخزون وأكواد الخصم" },
  { key: "ORDERS", label: "الطلبات", hint: "الطلبات والشكاوى ولوحة المبيعات" },
  { key: "MESSAGES", label: "الرسائل", hint: "الرد على المشترين والتقييمات" },
  { key: "FINANCE", label: "المالية", hint: "الرصيد وسجل الأرباح والاسترداد للمشتري" },
];

export const MAX_STAFF = 10;

export function isStaffPermission(value: unknown): value is StaffPermission {
  return STAFF_PERMISSIONS.some((p) => p.key === value);
}

// What a signed-in user can open in the seller office: their own store, the
// store they work for, or nothing.
export type SellerAccess = {
  seller: SellerProfile;
  // Null for the owner, who can do everything.
  staff: { id: string; permissions: StaffPermission[] } | null;
};

// Pages ask for one permission or any of several; "OWNER" is owner only.
export type SellerArea = StaffPermission | StaffPermission[] | "OWNER" | "ANY";

export function sellerAccessOf(user: {
  seller: SellerProfile | null;
  staffOf?: (SellerStaff & { seller: SellerProfile }) | null;
}): SellerAccess | null {
  if (user.seller) return { seller: user.seller, staff: null };
  if (user.staffOf)
    return {
      seller: user.staffOf.seller,
      staff: { id: user.staffOf.id, permissions: user.staffOf.permissions },
    };
  return null;
}

export function canAccess(access: SellerAccess, area: SellerArea) {
  if (!access.staff) return true;
  if (area === "OWNER") return false;
  if (area === "ANY") return true;
  const wanted = Array.isArray(area) ? area : [area];
  return wanted.some((p) => access.staff!.permissions.includes(p));
}

// Where a staff member lands: the first page their permissions open.
export function sellerHome(access: SellerAccess) {
  if (canAccess(access, ["ORDERS", "FINANCE"])) return "/seller";
  if (canAccess(access, "PRODUCTS")) return "/seller/products";
  if (canAccess(access, "MESSAGES")) return "/seller/messages";
  return "/seller/security";
}
