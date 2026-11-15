import "server-only";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { computeBalance } from "./ledger";
import { formatEGP } from "./money";
import { passwordHashFor } from "./site-password";
import { passwordCheckAllowed } from "./account-security";
import { destinationSchema, idSchema, noteSchema, passwordSchema, payoutUnlockAt } from "./wallet-validation";
import { STAFF_DENIED, staffMayNotTouch } from "./staff-scope";
import { affiliateCommission, affiliateRateFor, normalizeRefCode, refCodeProblem } from "./affiliate-rules";

// Affiliate program: anyone with an account shares links with ?ref=<code>.
// A purchase made within 30 days of the click earns the affiliate a share of
// the order, paid by the platform out of its commission. The share is held
// like a seller's sale, reversed on refund, frozen during an open dispute,
// and withdrawn through a payout request the admin pays by hand.

export class AffiliateError extends Error {}
type Tx = Prisma.TransactionClient;

const SETTINGS_ID = "default";
export const DEFAULT_SETTINGS = { enabled: true, rateBps: 500, holdDays: 7, minPayout: 20000 };

export async function affiliateSettings(tx?: Tx) {
  const client = tx ?? db;
  const row = await client.affiliateSettings.findUnique({ where: { id: SETTINGS_ID } });
  return row ?? { id: SETTINGS_ID, ...DEFAULT_SETTINGS, updatedAt: new Date(0) };
}

async function lockAffiliate(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM "Affiliate" WHERE id = ${id} FOR UPDATE`;
}

async function audit(tx: Tx, actorId: string, action: string, targetId: string, data?: Record<string, unknown>) {
  await tx.auditLog.create({
    data: { actorId, action, targetId, data: data ? JSON.stringify(data) : null },
  });
}

// ---------- joining ----------

export async function joinAffiliate(userId: string, wanted: string) {
  const settings = await affiliateSettings();
  if (!settings.enabled) throw new AffiliateError("برنامج الإحالة متوقف دلوقتي");
  let code: string;
  if (wanted.trim()) {
    const problem = refCodeProblem(wanted);
    if (problem) throw new AffiliateError(problem);
    code = normalizeRefCode(wanted)!;
  } else code = "r" + randomBytes(5).toString("hex");
  const user = await db.user.findUnique({ where: { id: userId }, select: { suspendedAt: true, emailVerifiedAt: true } });
  if (!user || user.suspendedAt) throw new AffiliateError("الحساب موقوف");
  if (!user.emailVerifiedAt) throw new AffiliateError("أكّد إيميلك الأول");
  try {
    await db.affiliate.create({ data: { userId, code } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      if (await db.affiliate.findUnique({ where: { userId } })) return;
      throw new AffiliateError("الكود ده مستخدم، اختار غيره");
    }
    throw error;
  }
}

// Counted on landing pages that carry ?ref=. Only a statistic: money is
// never paid for clicks.
export async function trackAffiliateClick(ref: string | undefined) {
  const code = normalizeRefCode(ref);
  if (!code) return;
  await db.affiliate
    .updateMany({ where: { code, suspendedAt: null }, data: { clicks: { increment: 1 } } })
    .catch(() => undefined);
}

// ---------- attribution at checkout ----------

// The affiliate and rate a new order is credited to, or null. Fraud guard:
// nobody earns on their own purchase or on their own store's products, and
// a suspended affiliate or account earns nothing.
export async function referralFor(
  tx: Tx,
  rawCode: string | undefined,
  buyerId: string,
  seller: { userId: string; affiliateBps: number | null },
) {
  const code = normalizeRefCode(rawCode);
  if (!code) return null;
  const affiliate = await tx.affiliate.findUnique({
    where: { code },
    select: { id: true, userId: true, rateBps: true, suspendedAt: true, user: { select: { suspendedAt: true } } },
  });
  if (!affiliate || affiliate.suspendedAt || affiliate.user.suspendedAt) return null;
  if (affiliate.userId === buyerId || affiliate.userId === seller.userId) return null;
  const settings = await affiliateSettings(tx);
  if (!settings.enabled) return null;
  const bps = affiliateRateFor({
    platformBps: settings.rateBps,
    sellerBps: seller.affiliateBps,
    affiliateBps: affiliate.rateBps,
  });
  return bps > 0 ? { affiliateId: affiliate.id, bps } : null;
}

// ---------- earning and reversing (inside the order transactions) ----------

// Called once, right after the seller's SALE entry: the share is released
// no earlier than the seller's own hold and the program's hold.
export async function earnAffiliateCommission(
  tx: Tx,
  order: { affiliateId: string | null; number: number },
  item: { id: string; total: number; commissionAmount: number; affiliateBps: number },
  saleAvailableAt: Date,
) {
  if (!order.affiliateId || item.affiliateBps <= 0) return;
  const amount = affiliateCommission(item.total, item.commissionAmount, item.affiliateBps);
  if (!amount) return;
  const affiliate = await tx.affiliate.findUnique({
    where: { id: order.affiliateId },
    select: { suspendedAt: true },
  });
  if (!affiliate || affiliate.suspendedAt) return;
  if (await tx.affiliateEntry.findFirst({ where: { orderItemId: item.id, type: "COMMISSION" } })) return;
  const settings = await affiliateSettings(tx);
  const hold = new Date(Date.now() + settings.holdDays * 86400000);
  await tx.affiliateEntry.create({
    data: {
      affiliateId: order.affiliateId,
      type: "COMMISSION",
      amount,
      availableAt: hold > saleAvailableAt ? hold : saleAvailableAt,
      orderItemId: item.id,
      note: `طلب #${order.number}`,
    },
  });
}

// Refund or admin cancel: the commission comes back off the balance (it may
// go negative if it was already withdrawn; later earnings cover it).
export async function reverseAffiliateCommission(tx: Tx, orderItemId: string, note: string) {
  const earned = await tx.affiliateEntry.findFirst({
    where: { orderItemId, type: "COMMISSION" },
  });
  if (!earned) return null;
  await lockAffiliate(tx, earned.affiliateId);
  if (await tx.affiliateEntry.findFirst({ where: { orderItemId, type: "REVERSAL" } })) return null;
  return tx.affiliateEntry.create({
    data: {
      affiliateId: earned.affiliateId,
      type: "REVERSAL",
      amount: -earned.amount,
      availableAt: earned.availableAt,
      orderItemId,
      note,
    },
  });
}

// ---------- balance ----------

export async function affiliateBalance(affiliateId: string, tx?: Tx, now = new Date()) {
  const client = tx ?? db;
  const entries = await client.affiliateEntry.findMany({
    where: { affiliateId },
    select: { amount: true, availableAt: true },
  });
  const balance = computeBalance(entries, now);
  // Released commissions on an order with an open complaint wait for it.
  const frozen = await client.affiliateEntry.aggregate({
    where: {
      affiliateId,
      type: "COMMISSION",
      availableAt: { lte: now },
      orderItem: { disputes: { some: { status: "OPEN" } }, affiliateEntries: { none: { type: "REVERSAL" } } },
    },
    _sum: { amount: true },
  });
  return { ...balance, frozen: frozen._sum.amount ?? 0 };
}

// ---------- payouts ----------

export async function saveAffiliateDestination(
  userId: string,
  input: z.input<typeof destinationSchema>,
  password: string,
) {
  const value = destinationSchema.parse(input);
  passwordSchema.parse(password);
  if (!(await passwordCheckAllowed(userId))) throw new AffiliateError("محاولات كتير، جرّب بعد شوية");
  return db.$transaction(async (tx) => {
    const owner = await tx.affiliate.findUnique({ where: { userId }, select: { id: true } });
    if (!owner) throw new AffiliateError("انضم لبرنامج الإحالة الأول");
    await lockAffiliate(tx, owner.id);
    const affiliate = await tx.affiliate.findUniqueOrThrow({ where: { id: owner.id }, include: { user: true } });
    if (!(await bcrypt.compare(password, passwordHashFor(affiliate.user, "store"))))
      throw new AffiliateError("الباسورد الحالي مش صحيح");
    if (
      affiliate.payoutMethod === value.method &&
      affiliate.payoutAccount === value.account &&
      affiliate.payoutHolderName === value.holderName
    )
      return;
    await tx.affiliate.update({
      where: { id: owner.id },
      data: {
        payoutMethod: value.method,
        payoutAccount: value.account,
        payoutHolderName: value.holderName,
        payoutUpdatedAt: new Date(),
      },
    });
    await audit(tx, userId, "affiliate.payout_account_changed", owner.id, {
      method: value.method,
      accountLast4: value.account.slice(-4),
    });
  });
}

export async function requestAffiliatePayout(userId: string, amount: number) {
  z.number().int().min(1).max(999999999).parse(amount);
  return db.$transaction(async (tx) => {
    const owner = await tx.affiliate.findUnique({ where: { userId }, select: { id: true } });
    if (!owner) throw new AffiliateError("انضم لبرنامج الإحالة الأول");
    await lockAffiliate(tx, owner.id);
    const affiliate = await tx.affiliate.findUniqueOrThrow({
      where: { id: owner.id },
      include: { user: { select: { suspendedAt: true } } },
    });
    if (affiliate.suspendedAt || affiliate.user.suspendedAt)
      throw new AffiliateError(
        "حساب الإحالة موقوف من الإدارة" + (affiliate.suspendReason ? `: ${affiliate.suspendReason}` : ""),
      );
    const settings = await affiliateSettings(tx);
    if (amount < settings.minPayout) throw new AffiliateError(`الحد الأدنى للسحب ${formatEGP(settings.minPayout)}`);
    const balance = await affiliateBalance(affiliate.id, tx);
    const withdrawable = balance.available - balance.frozen;
    if (amount > withdrawable)
      throw new AffiliateError(
        `الرصيد المتاح للسحب ${formatEGP(Math.max(0, withdrawable))} بس، والأرباح المعلّقة بتتاح بعد مدة الضمان`,
      );
    if (!affiliate.payoutMethod || !affiliate.payoutAccount || !affiliate.payoutHolderName || !affiliate.payoutUpdatedAt)
      throw new AffiliateError("احفظ بيانات استلام الأرباح الأول");
    if (payoutUnlockAt(affiliate.payoutUpdatedAt) > new Date())
      throw new AffiliateError("السحب مقفول لمدة ٢٤ ساعة بعد تغيير بيانات الحساب");
    if (await tx.affiliatePayout.findFirst({ where: { affiliateId: affiliate.id, status: "REQUESTED" } }))
      throw new AffiliateError("عندك طلب سحب قيد المراجعة بالفعل");
    const payout = await tx.affiliatePayout.create({
      data: {
        affiliateId: affiliate.id,
        amount,
        method: affiliate.payoutMethod,
        account: affiliate.payoutAccount,
        holderName: affiliate.payoutHolderName,
      },
    });
    await tx.affiliateEntry.create({
      data: { affiliateId: affiliate.id, type: "PAYOUT", amount: -amount, payoutId: payout.id, note: "طلب سحب" },
    });
    return payout.id;
  });
}

// ---------- admin ----------

async function adminActor(tx: Tx, actorId: string) {
  const actor = await tx.user.findUnique({ where: { id: actorId } });
  if (!actor || actor.role !== "ADMIN" || actor.suspendedAt) throw new AffiliateError("غير مسموح");
  return actor;
}

async function affiliateTarget(tx: Tx, actor: { id: string; adminDataFrom: Date | null }, affiliateId: string) {
  const affiliate = await tx.affiliate.findUnique({
    where: { id: affiliateId },
    include: { user: { select: { role: true } } },
  });
  if (!affiliate) throw new AffiliateError("المسوّق مش موجود");
  if (
    staffMayNotTouch(actor, {
      createdAt: affiliate.createdAt,
      userIds: [affiliate.userId],
      admin: affiliate.user.role === "ADMIN",
    })
  )
    throw new AffiliateError(STAFF_DENIED);
  return affiliate;
}

export async function processAffiliatePayout(
  actorId: string,
  payoutId: string,
  status: "PAID" | "REJECTED",
  text: string,
) {
  idSchema.parse(payoutId);
  const value = (status === "PAID" ? noteSchema.max(100) : noteSchema).parse(text);
  return db.$transaction(async (tx) => {
    const actor = await adminActor(tx, actorId);
    const payout = await tx.affiliatePayout.findUnique({
      where: { id: payoutId },
      include: { affiliate: { select: { userId: true } } },
    });
    if (!payout) throw new AffiliateError("طلب السحب مش موجود");
    if (staffMayNotTouch(actor, { createdAt: payout.createdAt, userIds: [payout.affiliate.userId] }))
      throw new AffiliateError(STAFF_DENIED);
    await lockAffiliate(tx, payout.affiliateId);
    const changed = await tx.affiliatePayout.updateMany({
      where: { id: payoutId, status: "REQUESTED" },
      data: {
        status,
        processedAt: new Date(),
        processedById: actorId,
        ...(status === "PAID" ? { reference: value } : { rejectReason: value }),
      },
    });
    if (!changed.count) return false;
    if (status === "REJECTED")
      await tx.affiliateEntry.create({
        data: {
          affiliateId: payout.affiliateId,
          type: "PAYOUT",
          amount: payout.amount,
          payoutId,
          note: "إلغاء طلب السحب المرفوض",
        },
      });
    await audit(tx, actorId, status === "PAID" ? "affiliate.payout_paid" : "affiliate.payout_rejected", payoutId, {
      amount: payout.amount,
    });
    return true;
  });
}

const percent = z
  .string()
  .trim()
  .regex(/^(\d{1,2}(\.\d{1,2})?|100)?$/, "اكتب نسبة من 0 لـ 100")
  .transform((v) => (v ? Math.round(Number(v) * 100) : null));

export const settingsInput = z.object({
  enabled: z.boolean(),
  rate: percent.refine((v) => v !== null, "اكتب النسبة"),
  holdDays: z.coerce.number().int().min(0, "اكتب عدد أيام من 0 لـ 60").max(60, "اكتب عدد أيام من 0 لـ 60"),
  minPayout: z.coerce.number().int().min(1, "اكتب حد أدنى للسحب").max(1000000),
});

// Program-wide terms stay with a full admin, like money adjustments.
export async function saveAffiliateSettings(actorId: string, input: z.input<typeof settingsInput>) {
  const v = settingsInput.parse(input);
  return db.$transaction(async (tx) => {
    const actor = await adminActor(tx, actorId);
    if (actor.adminDataFrom) throw new AffiliateError(STAFF_DENIED);
    const data = { enabled: v.enabled, rateBps: v.rate!, holdDays: v.holdDays, minPayout: v.minPayout * 100 };
    const before = await affiliateSettings(tx);
    await tx.affiliateSettings.upsert({ where: { id: SETTINGS_ID }, create: { id: SETTINGS_ID, ...data }, update: data });
    await audit(tx, actorId, "affiliate.settings_changed", SETTINGS_ID, {
      before: { enabled: before.enabled, rateBps: before.rateBps, holdDays: before.holdDays, minPayout: before.minPayout },
      after: data,
    });
  });
}

export async function setAffiliateRate(actorId: string, affiliateId: string, rate: string) {
  idSchema.parse(affiliateId);
  const bps = percent.parse(rate);
  return db.$transaction(async (tx) => {
    const actor = await adminActor(tx, actorId);
    const affiliate = await affiliateTarget(tx, actor, affiliateId);
    await tx.affiliate.update({ where: { id: affiliateId }, data: { rateBps: bps } });
    await audit(tx, actorId, "affiliate.rate_changed", affiliateId, { before: affiliate.rateBps, after: bps });
  });
}

// Suspending stops new earnings and payouts. With `reverseHeld`, commissions
// still on hold are taken back too (for a caught fraud).
export async function suspendAffiliate(actorId: string, affiliateId: string, reason: string, reverseHeld: boolean) {
  idSchema.parse(affiliateId);
  const why = z.string().trim().min(3, "اكتب السبب").max(500, "السبب طويل أوي").parse(reason);
  return db.$transaction(async (tx) => {
    const actor = await adminActor(tx, actorId);
    await affiliateTarget(tx, actor, affiliateId);
    await lockAffiliate(tx, affiliateId);
    const changed = await tx.affiliate.updateMany({
      where: { id: affiliateId, suspendedAt: null },
      data: { suspendedAt: new Date(), suspendReason: why },
    });
    if (!changed.count) return false;
    let reversed = 0;
    if (reverseHeld) {
      const held = await tx.affiliateEntry.findMany({
        where: {
          affiliateId,
          type: "COMMISSION",
          availableAt: { gt: new Date() },
          orderItem: { affiliateEntries: { none: { type: "REVERSAL" } } },
        },
      });
      for (const entry of held) {
        await tx.affiliateEntry.create({
          data: {
            affiliateId,
            type: "REVERSAL",
            amount: -entry.amount,
            availableAt: entry.availableAt,
            orderItemId: entry.orderItemId,
            note: `إلغاء من الإدارة: ${why}`,
          },
        });
        reversed += entry.amount;
      }
    }
    await audit(tx, actorId, "affiliate.suspended", affiliateId, { reason: why, reversed });
    return true;
  });
}

export async function unsuspendAffiliate(actorId: string, affiliateId: string) {
  idSchema.parse(affiliateId);
  return db.$transaction(async (tx) => {
    const actor = await adminActor(tx, actorId);
    await affiliateTarget(tx, actor, affiliateId);
    const changed = await tx.affiliate.updateMany({
      where: { id: affiliateId, suspendedAt: { not: null } },
      data: { suspendedAt: null, suspendReason: null },
    });
    if (changed.count) await audit(tx, actorId, "affiliate.unsuspended", affiliateId);
    return changed.count > 0;
  });
}

// Take back one commission the admin judged fraudulent.
export async function cancelAffiliateCommission(actorId: string, entryId: string, reason: string) {
  idSchema.parse(entryId);
  const why = z.string().trim().min(3, "اكتب السبب").max(500, "السبب طويل أوي").parse(reason);
  return db.$transaction(async (tx) => {
    const actor = await adminActor(tx, actorId);
    const entry = await tx.affiliateEntry.findUnique({ where: { id: entryId } });
    if (!entry || entry.type !== "COMMISSION" || !entry.orderItemId) throw new AffiliateError("العمولة مش موجودة");
    await affiliateTarget(tx, actor, entry.affiliateId);
    const reversal = await reverseAffiliateCommission(tx, entry.orderItemId, `إلغاء من الإدارة: ${why}`);
    if (reversal) await audit(tx, actorId, "affiliate.commission_cancelled", entry.affiliateId, { entryId, amount: entry.amount, reason: why });
    return Boolean(reversal);
  });
}

export const affiliateEntryLabels = {
  COMMISSION: "عمولة",
  REVERSAL: "إلغاء عمولة",
  PAYOUT: "سحب",
  ADJUSTMENT: "تسوية",
};
