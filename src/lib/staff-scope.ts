// A staff admin (adminDataFrom set) has the admin tools, but each action must
// stay inside what they are allowed to see, and must never serve themselves:
// no records from before their start date, nothing on their own account,
// store or orders, and nothing on another admin's account. A full admin
// (adminDataFrom null) is the owner and is never limited here.

export type StaffActor = { id: string; adminDataFrom: Date | null };

export type StaffTarget = {
  // When the record (order, payout, account) was created.
  createdAt?: Date | null;
  // Accounts the action benefits or touches: buyer, seller owner, user.
  userIds?: (string | null | undefined)[];
  // The target is an admin account.
  admin?: boolean;
};

export function staffMayNotTouch(actor: StaffActor, target: StaffTarget) {
  if (!actor.adminDataFrom) return false;
  if (target.createdAt && target.createdAt < actor.adminDataFrom) return true;
  if (target.userIds?.some((id) => id === actor.id)) return true;
  return Boolean(target.admin);
}

export const STAFF_DENIED = "الأدمن المساعد مايقدرش يعمل ده";
