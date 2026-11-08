import "server-only";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { enqueueNotice } from "./notifications";
import bcrypt from "bcryptjs";
import { passwordProblem } from "./password-policy";
import { STAFF_DENIED, staffMayNotTouch, type StaffTarget } from "./staff-scope";

// Every admin action on an account: status-guarded, audit-logged, and
// re-checked against the database so a stale form can't act twice.

export class AdminControlError extends Error {}

const id = z.string().min(1).max(100);
const reason = z
  .string()
  .trim()
  .min(3, "اكتب السبب")
  .max(500, "السبب طويل أوي");

type Tx = Prisma.TransactionClient;

async function audit(
  tx: Tx,
  actorId: string,
  action: string,
  targetId: string,
  data?: Record<string, unknown>,
) {
  await tx.auditLog.create({
    data: {
      actorId,
      action,
      targetId,
      data: data ? JSON.stringify(data) : null,
    },
  });
}

async function adminActor(tx: Tx, actorId: string) {
  const actor = await tx.user.findUnique({ where: { id: actorId } });
  if (actor?.role !== "ADMIN" || actor.suspendedAt)
    throw new AdminControlError("غير مسموح");
  return actor;
}

// The admin may act on this account or store (see staff-scope.ts).
function allowed(actor: { id: string; adminDataFrom: Date | null }, target: StaffTarget) {
  if (staffMayNotTouch(actor, target)) throw new AdminControlError(STAFF_DENIED);
}

async function userTarget(tx: Tx, userId: string) {
  const target = await tx.user.findUnique({ where: { id: userId } });
  if (!target) throw new AdminControlError("الحساب مش موجود");
  return {
    target,
    // Accounts and stores are visible to staff whatever their age; only
    // their orders and money records are dated.
    scope: {
      userIds: [target.id],
      admin: target.role === "ADMIN",
    },
  };
}

async function sellerTarget(tx: Tx, sellerId: string) {
  const seller = await tx.sellerProfile.findUnique({
    where: { id: sellerId },
    select: { userId: true },
  });
  if (!seller) throw new AdminControlError("المتجر مش موجود");
  return { userIds: [seller.userId] };
}

export async function suspendUser(
  actorId: string,
  userId: string,
  why: string,
) {
  id.parse(userId);
  const suspendReason = reason.parse(why);
  if (actorId === userId)
    throw new AdminControlError("مينفعش توقف حسابك");
  return db.$transaction(async (tx) => {
    const actor = await adminActor(tx, actorId);
    const { target, scope } = await userTarget(tx, userId);
    allowed(actor, scope);
    if (target.role === "ADMIN")
      throw new AdminControlError("مينفعش توقف حساب أدمن من هنا");
    // Bumping the session version signs the user out everywhere at once.
    const changed = await tx.user.updateMany({
      where: { id: userId, suspendedAt: null },
      data: {
        suspendedAt: new Date(),
        suspendReason,
        sessionVersion: { increment: 1 },
      },
    });
    if (!changed.count) return false;
    await audit(tx, actorId, "user.suspended", userId, {
      reason: suspendReason,
    });
    return true;
  });
}

export async function unsuspendUser(actorId: string, userId: string) {
  id.parse(userId);
  return db.$transaction(async (tx) => {
    const actor = await adminActor(tx, actorId);
    allowed(actor, (await userTarget(tx, userId)).scope);
    const changed = await tx.user.updateMany({
      where: { id: userId, suspendedAt: { not: null } },
      data: { suspendedAt: null, suspendReason: null },
    });
    if (!changed.count) return false;
    await audit(tx, actorId, "user.unsuspended", userId);
    return true;
  });
}

export async function forceLogout(actorId: string, userId: string) {
  id.parse(userId);
  return db.$transaction(async (tx) => {
    const actor = await adminActor(tx, actorId);
    allowed(actor, (await userTarget(tx, userId)).scope);
    const changed = await tx.user.updateMany({
      where: { id: userId },
      data: { sessionVersion: { increment: 1 } },
    });
    if (!changed.count) throw new AdminControlError("الحساب مش موجود");
    await audit(tx, actorId, "user.signed_out", userId);
    return true;
  });
}

export const profileInput = z.object({
  name: z.string().trim().min(2, "الاسم قصير").max(100),
  phone: z
    .string()
    .trim()
    .max(20)
    .refine((v) => !v || /^01[0125]\d{8}$/.test(v), "رقم الموبايل مش صحيح"),
  adminNote: z.string().trim().max(2000),
});

export async function updateUserProfile(
  actorId: string,
  userId: string,
  input: z.input<typeof profileInput>,
) {
  id.parse(userId);
  const v = profileInput.parse(input);
  return db.$transaction(async (tx) => {
    const actor = await adminActor(tx, actorId);
    const { target: before, scope } = await userTarget(tx, userId);
    allowed(actor, scope);
    await tx.user.update({
      where: { id: userId },
      data: { name: v.name, phone: v.phone || null, adminNote: v.adminNote || null },
    });
    await audit(tx, actorId, "user.updated", userId, {
      name: before.name !== v.name,
      phone: (before.phone ?? "") !== v.phone,
      note: (before.adminNote ?? "") !== v.adminNote,
    });
    return true;
  });
}

export async function setSalesSuspended(
  actorId: string,
  sellerId: string,
  suspended: boolean,
  why = "",
) {
  id.parse(sellerId);
  const note = suspended ? reason.parse(why) : null;
  return db.$transaction(async (tx) => {
    const actor = await adminActor(tx, actorId);
    allowed(actor, await sellerTarget(tx, sellerId));
    const changed = await tx.sellerProfile.updateMany({
      where: {
        id: sellerId,
        salesSuspendedAt: suspended ? null : { not: null },
      },
      data: suspended
        ? { salesSuspendedAt: new Date(), salesSuspendReason: note }
        : { salesSuspendedAt: null, salesSuspendReason: null },
    });
    if (!changed.count) return false;
    await audit(
      tx,
      actorId,
      suspended ? "seller.sales_suspended" : "seller.sales_resumed",
      sellerId,
      note ? { reason: note } : undefined,
    );
    await enqueueNotice(
      tx,
      sellerId,
      suspended ? "sales.suspended" : "sales.resumed",
      note ? { title: note } : {},
    );
    return true;
  });
}

export async function setPayoutsFrozen(
  actorId: string,
  sellerId: string,
  frozen: boolean,
  why = "",
) {
  id.parse(sellerId);
  const note = frozen ? reason.parse(why) : null;
  return db.$transaction(async (tx) => {
    const actor = await adminActor(tx, actorId);
    allowed(actor, await sellerTarget(tx, sellerId));
    // Same lock requestPayout takes, so a request can't slip past a freeze.
    await tx.$queryRaw`SELECT id FROM "SellerProfile" WHERE id = ${sellerId} FOR UPDATE`;
    const changed = await tx.sellerProfile.updateMany({
      where: {
        id: sellerId,
        payoutsFrozenAt: frozen ? null : { not: null },
      },
      data: frozen
        ? { payoutsFrozenAt: new Date(), payoutsFrozenReason: note }
        : { payoutsFrozenAt: null, payoutsFrozenReason: null },
    });
    if (!changed.count) return false;
    await audit(
      tx,
      actorId,
      frozen ? "seller.payouts_frozen" : "seller.payouts_unfrozen",
      sellerId,
      note ? { reason: note } : undefined,
    );
    await enqueueNotice(
      tx,
      sellerId,
      frozen ? "payouts.frozen" : "payouts.unfrozen",
      note ? { title: note } : {},
    );
    return true;
  });
}

// Percent with up to 2 decimals, or empty for the category default.
export const termsInput = z.object({
  commission: z
    .string()
    .trim()
    .regex(/^(\d{1,2}(\.\d{1,2})?|100)?$/, "اكتب نسبة من 0 لـ 100")
    .transform((v) => (v ? Math.round(Number(v) * 100) : null)),
  holdDays: z
    .string()
    .trim()
    .regex(/^\d{0,2}$/, "اكتب عدد أيام من 0 لـ 60")
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || v <= 60, "اكتب عدد أيام من 0 لـ 60"),
});

export async function setSellerTerms(
  actorId: string,
  sellerId: string,
  input: z.input<typeof termsInput>,
) {
  id.parse(sellerId);
  const v = termsInput.parse(input);
  return db.$transaction(async (tx) => {
    const actor = await adminActor(tx, actorId);
    allowed(actor, await sellerTarget(tx, sellerId));
    const before = await tx.sellerProfile.findUnique({
      where: { id: sellerId },
      select: { commissionBps: true, holdDays: true },
    });
    if (!before) throw new AdminControlError("المتجر مش موجود");
    await tx.sellerProfile.update({
      where: { id: sellerId },
      data: { commissionBps: v.commission, holdDays: v.holdDays },
    });
    await audit(tx, actorId, "seller.terms_changed", sellerId, {
      before,
      after: { commissionBps: v.commission, holdDays: v.holdDays },
    });
    return true;
  });
}

export const announcementInput = z.object({
  title: z.string().trim().min(3, "اكتب عنوان").max(150),
  body: z.string().trim().min(3, "اكتب الإعلان").max(3000),
});

export async function createAnnouncement(
  actorId: string,
  input: z.input<typeof announcementInput>,
) {
  const v = announcementInput.parse(input);
  return db.$transaction(async (tx) => {
    await adminActor(tx, actorId);
    const a = await tx.announcement.create({
      data: { ...v, createdById: actorId },
    });
    await audit(tx, actorId, "announcement.created", a.id);
    return a.id;
  });
}

export async function setAnnouncementActive(
  actorId: string,
  announcementId: string,
  active: boolean,
) {
  id.parse(announcementId);
  return db.$transaction(async (tx) => {
    await adminActor(tx, actorId);
    const changed = await tx.announcement.updateMany({
      where: { id: announcementId, active: !active },
      data: { active },
    });
    if (!changed.count) return false;
    await audit(
      tx,
      actorId,
      active ? "announcement.shown" : "announcement.hidden",
      announcementId,
    );
    return true;
  });
}

// ---- Staff admins -------------------------------------------------------
// A staff admin has every admin tool but only sees records created on or
// after adminDataFrom. Only a full admin (adminDataFrom null) manages them.

async function fullAdminActor(tx: Tx, actorId: string) {
  const actor = await tx.user.findUnique({ where: { id: actorId } });
  if (actor?.role !== "ADMIN" || actor.suspendedAt || actor.adminDataFrom)
    throw new AdminControlError("غير مسموح");
}

// "YYYY-MM-DD" is midnight Cairo time; empty means from right now.
export function parseDataFrom(value: string, now = new Date()) {
  const v = value.trim();
  if (!v) return now;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v))
    throw new AdminControlError("التاريخ مش صحيح");
  const at = new Date(`${v}T00:00:00+02:00`);
  if (Number.isNaN(at.getTime())) throw new AdminControlError("التاريخ مش صحيح");
  return at;
}

export const staffInput = z.object({
  name: z.string().trim().min(2, "الاسم قصير").max(100),
  email: z.string().trim().toLowerCase().email("الإيميل مش صحيح").max(200),
  password: z.string().max(200),
  dataFrom: z.string().max(20),
});

// Creates a new staff admin, or turns an existing non-admin account into one
// (that account keeps its password). Returns the user id.
export async function addStaffAdmin(
  actorId: string,
  input: z.input<typeof staffInput>,
) {
  const v = staffInput.parse(input);
  const adminDataFrom = parseDataFrom(v.dataFrom);
  const existing = await db.user.findUnique({ where: { email: v.email } });
  if (existing?.role === "ADMIN")
    throw new AdminControlError("الحساب ده أدمن بالفعل");
  let passwordHash: string | null = null;
  if (!existing) {
    const problem = passwordProblem(v.password, v.email);
    if (problem) throw new AdminControlError(problem);
    passwordHash = await bcrypt.hash(v.password, 12);
  }
  return db.$transaction(async (tx) => {
    await fullAdminActor(tx, actorId);
    const user = existing
      ? await tx.user.update({
          where: { id: existing.id },
          data: {
            role: "ADMIN",
            adminDataFrom,
            sessionVersion: { increment: 1 },
          },
        })
      : await tx.user.create({
          data: {
            name: v.name,
            email: v.email,
            passwordHash: passwordHash!,
            role: "ADMIN",
            adminDataFrom,
            emailVerifiedAt: new Date(),
          },
        });
    await audit(tx, actorId, "admin.staff_added", user.id, {
      from: adminDataFrom.toISOString(),
      existing: Boolean(existing),
    });
    return user.id;
  });
}

async function staffTarget(tx: Tx, userId: string) {
  const target = await tx.user.findUnique({ where: { id: userId } });
  if (target?.role !== "ADMIN" || !target.adminDataFrom)
    throw new AdminControlError("ده مش حساب أدمن محدود");
  return target;
}

export async function setStaffDataFrom(
  actorId: string,
  userId: string,
  value: string,
) {
  id.parse(userId);
  const adminDataFrom = parseDataFrom(value);
  return db.$transaction(async (tx) => {
    await fullAdminActor(tx, actorId);
    await staffTarget(tx, userId);
    await tx.user.update({ where: { id: userId }, data: { adminDataFrom } });
    await audit(tx, actorId, "admin.staff_date", userId, {
      from: adminDataFrom.toISOString(),
    });
    return true;
  });
}

// Takes admin access away and signs the account out everywhere.
export async function removeStaffAdmin(actorId: string, userId: string) {
  id.parse(userId);
  return db.$transaction(async (tx) => {
    await fullAdminActor(tx, actorId);
    await staffTarget(tx, userId);
    const seller = await tx.sellerProfile.findUnique({ where: { userId } });
    await tx.user.update({
      where: { id: userId },
      data: {
        role: seller ? "SELLER" : "BUYER",
        adminDataFrom: null,
        sessionVersion: { increment: 1 },
      },
    });
    await audit(tx, actorId, "admin.staff_removed", userId);
    return true;
  });
}

export function adminActionError(error: unknown) {
  if (error instanceof AdminControlError) return { error: error.message };
  if (error instanceof z.ZodError)
    return { error: error.issues[0]?.message ?? "راجع البيانات" };
  console.error("Admin control action failed", {
    kind: error instanceof Error ? error.name : "unknown",
  });
  return { error: "حصل خطأ، جرّب تاني" };
}
