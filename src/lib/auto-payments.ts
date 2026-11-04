import "server-only";
import { createHash, randomInt } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { formatEGP } from "./money";
import { alertAdmin } from "./notifications";
import { lockOrder, markOrderPaid, OrderError } from "./orders";
import { manualConfig } from "./payments/config";
import { normalizeAccount, parseNotice } from "./payments/sms-parse";
import { siteHref } from "./sites";
import { pickOrder } from "./auto-payments-pick";

// A transfer can land a while after the 30-minute order window: a matched
// late payment still revives and delivers the order (see markOrderPaid).
const LATE_PAYMENT_MS = 3 * 60 * 60 * 1000;

export function autoPaymentSettings(env: NodeJS.ProcessEnv = process.env) {
  const max = Number(env.AUTO_CONFIRM_MAX_EGP ?? "3000");
  return {
    secret: env.SMS_WEBHOOK_SECRET?.trim() || "",
    maxAmount: Number.isFinite(max) && max > 0 ? Math.round(max * 100) : 300000,
    // On by default: a notice confirms an order only when its balance
    // continues the last trusted one. "off" trusts every SMS.
    balanceCheck: (env.SMS_BALANCE_CHECK ?? "on").trim().toLowerCase() !== "off",
    allowedSenders: (env.SMS_ALLOWED_SENDERS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  };
}

function platformAccounts() {
  try {
    const c = manualConfig();
    return [c.instapay, c.wallet].filter(Boolean).map(normalizeAccount);
  } catch {
    return [];
  }
}

export function validPayFrom(value: string) {
  const account = normalizeAccount(value);
  if (
    !/^01[0125]\d{8}$/.test(account) &&
    !/^[a-z0-9._-]{2,60}@instapay$/.test(account)
  )
    throw new OrderError(
      "اكتب رقم موبايل مصري (01xxxxxxxxx) أو عنوان إنستاباي (name@instapay)",
    );
  if (platformAccounts().includes(account))
    throw new OrderError("ده رقم الاستلام بتاعنا، اكتب الرقم اللي هتحوّل منه");
  return account;
}

// The buyer names the account they will pay from; the order then gets a
// payable amount unique among open manual orders (total + 1..99 piasters),
// so the incoming SMS points at exactly one order.
export async function startAutoPayment(
  orderId: string,
  buyerId: string,
  payFromInput: string,
) {
  const payFrom = validPayFrom(payFromInput);
  return db.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    const order = await tx.order.findFirst({
      where: { id: orderId, buyerId, paymentProvider: "manual" },
    });
    if (
      !order ||
      order.status !== "PENDING_PAYMENT" ||
      order.expiresAt <= new Date()
    )
      throw new OrderError("مدة الطلب انتهت، ابدأ طلب جديد");
    if (order.payAmount)
      return tx.order.update({
        where: { id: orderId },
        data: { payFrom },
      });
    const taken = new Set(
      (
        await tx.order.findMany({
          where: {
            paymentProvider: "manual",
            payAmount: { gte: order.total, lt: order.total + 100 },
            createdAt: { gt: new Date(Date.now() - 2 * LATE_PAYMENT_MS) },
          },
          select: { payAmount: true },
        })
      ).map((o) => o.payAmount),
    );
    const free = Array.from({ length: 99 }, (_, i) => order.total + i + 1).filter(
      (a) => !taken.has(a),
    );
    // All 99 in use (very unlikely): reuse one; matching by the sender's
    // number still works, and an ambiguous transfer goes to the admin.
    const payAmount = free.length
      ? free[randomInt(free.length)]
      : order.total + randomInt(1, 100);
    return tx.order.update({
      where: { id: orderId },
      data: { payFrom, payAmount },
    });
  });
}

// The newest notice whose balance is known to be real.
async function lastTrustedBalance(tx: Prisma.TransactionClient) {
  const anchor = await tx.paymentNotice.findFirst({
    where: { trusted: true, balance: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { balance: true },
  });
  return anchor?.balance ?? null;
}

// Pure, exported for tests: a real incoming SMS raises the last trusted
// balance by exactly one of the amounts it names.
export function balanceContinues(
  previous: number | null,
  parsed: { balance: number | null; amounts: number[] },
) {
  return (
    previous !== null &&
    parsed.balance !== null &&
    parsed.amounts.some((a) => previous + a === parsed.balance)
  );
}

export async function handlePaymentNotice(input: {
  sender?: string;
  text: string;
}) {
  const settings = autoPaymentSettings();
  const text = input.text.trim().slice(0, 2000);
  const sender = input.sender?.trim().slice(0, 100) || null;
  const textHash = createHash("sha256")
    .update((sender ?? "") + "\n" + text.replace(/\s+/g, " "))
    .digest("hex");
  const parsed = parseNotice(text);
  const own = platformAccounts();
  parsed.phones = parsed.phones.filter((p) => !own.includes(p));

  let status: "MATCHED" | "HELD" | "UNMATCHED" | "IGNORED" = "UNMATCHED";
  let note = "";
  let pick: ReturnType<typeof pickOrder> = { reason: "" };
  if (
    settings.allowedSenders.length &&
    !settings.allowedSenders.some((s) => (sender ?? "").toLowerCase().includes(s))
  ) {
    status = "IGNORED";
    note = "المرسل مش في القائمة المسموحة";
  } else if (!parsed.incoming || !parsed.amounts.length) {
    status = "IGNORED";
    note = "مش رسالة تحويل وارد";
  } else {
    const since = new Date(Date.now() - LATE_PAYMENT_MS);
    const candidates = await db.order.findMany({
      where: {
        paymentProvider: "manual",
        paidAt: null,
        OR: [
          { status: "PENDING_PAYMENT" },
          { status: "CANCELLED", expiresAt: { gt: since } },
        ],
        createdAt: { gt: new Date(Date.now() - 2 * LATE_PAYMENT_MS) },
      },
      select: {
        id: true,
        number: true,
        total: true,
        payAmount: true,
        payFrom: true,
        manualPayment: { select: { reference: true, status: true } },
      },
      take: 500,
    });
    pick = pickOrder(parsed, candidates);
    note = pick.reason;
  }

  let notice;
  try {
    // One notice at a time, so each reads the balance the previous one left.
    notice = await db.$transaction(async (tx) => {
      let trusted = false;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('payment-notice-balance', 0))::text`;
      if (status !== "IGNORED") {
        trusted =
          !settings.balanceCheck ||
          balanceContinues(await lastTrustedBalance(tx), parsed);
        if (pick.order) {
          if (pick.order.total > settings.maxAmount) {
            status = "HELD";
            note = `المبلغ أكبر من حد التأكيد التلقائي (${formatEGP(settings.maxAmount)})`;
          } else if (!trusted) {
            status = "HELD";
            note =
              parsed.balance === null
                ? "الرسالة مفيهاش رصيد نتأكد بيه، راجع المحفظة وأكد"
                : "الرصيد مش مكمّل آخر رصيد معروف، راجع المحفظة وأكد";
          } else status = "MATCHED";
        }
      }
      return tx.paymentNotice.create({
        data: {
          textHash,
          sender,
          text,
          amount: parsed.amounts[0] ?? null,
          balance: status === "IGNORED" ? null : parsed.balance,
          trusted: trusted && parsed.balance !== null,
          status,
          orderId: pick.order?.id ?? null,
          note: note || null,
        },
      });
    });
  } catch (error) {
    // The same SMS forwarded twice: the first copy already did the work.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      // ...unless that first attempt crashed before paying the order: the
      // forwarder's retry finishes it (markOrderPaid is idempotent).
      const first = await db.paymentNotice.findUnique({ where: { textHash } });
      if (first?.status === "MATCHED" && first.orderId)
        await payNoticeOrder(first.id, first.orderId);
      return { status: "DUPLICATE" as const };
    }
    throw error;
  }
  status = notice.status;
  note = notice.note ?? "";
  const amount = parsed.amounts[0] ? formatEGP(parsed.amounts[0]) : "";
  if (status === "HELD" && pick.order) {
    await alertAdmin(
      `⏸ تحويل ${amount} لطلب #${pick.order.number} مستني تأكيدك (${note})\n${siteHref("admin", "/admin/payments?status=AUTO")}`,
    );
    return { status, orderId: pick.order.id };
  }
  if (status !== "MATCHED" || !pick.order) {
    if (status === "UNMATCHED")
      await alertAdmin(
        `❓ وصل تحويل ${amount} ومش عارفين نربطه بطلب (${note})\n${siteHref("admin", "/admin/payments?status=AUTO")}`,
      );
    return { status };
  }
  const paid = await payNoticeOrder(notice.id, pick.order.id);
  await alertAdmin(
    [
      paid ? "✅ دفع اتأكد تلقائيًا" : "⚠️ تحويل اتربط بطلب بس الطلب ما اتدفعش، راجعه",
      `طلب #${pick.order.number} · ${amount} · ${note}`,
      siteHref("admin", "/admin/payments?status=AUTO"),
    ].join("\n"),
  );
  return { status, orderId: pick.order.id };
}

async function payNoticeOrder(noticeId: string, orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { total: true },
  });
  if (!order) return false;
  // A transfer the buyer also reported by hand is closed with it, so the
  // admin queue does not ask to confirm it again.
  await db.manualPayment.updateMany({
    where: { orderId, status: "SUBMITTED" },
    data: {
      status: "CONFIRMED",
      receivedAmount: order.total,
      reviewNote: "تأكيد من رسالة التحويل",
      reviewedAt: new Date(),
    },
  });
  // The buyer may round the unique piasters away; the order total is what
  // the sellers and the ledger are owed, any extra piasters stay with us.
  await markOrderPaid(orderId, {
    provider: "manual",
    reference: "sms:" + noticeId,
    amount: order.total,
  });
  const paid = await db.order.findUnique({
    where: { id: orderId },
    select: { status: true },
  });
  return paid?.status === "PAID";
}

async function requireAdminActor(actorId: string) {
  const actor = await db.user.findUnique({ where: { id: actorId } });
  if (actor?.role !== "ADMIN") throw new OrderError("غير مسموح");
}

// The admin checked the wallet: the money in this SMS really arrived. The
// notice becomes the new trusted balance, and a held order is paid.
export async function vouchForNotice(actorId: string, noticeId: string) {
  await requireAdminActor(actorId);
  const notice = await db.paymentNotice.findUnique({ where: { id: noticeId } });
  if (!notice || notice.status === "IGNORED")
    throw new OrderError("الرسالة مش موجودة");
  await db.paymentNotice.update({
    where: { id: noticeId },
    data: {
      trusted: notice.balance !== null,
      status: notice.status === "HELD" ? "MATCHED" : notice.status,
      note: "أكدها الأدمن",
    },
  });
  await db.auditLog.create({
    data: { actorId, action: "payment_notice.vouched", targetId: noticeId },
  });
  if (notice.status === "HELD" && notice.orderId)
    return payNoticeOrder(notice.id, notice.orderId);
  return true;
}

// After spending from the wallet the chain breaks; the admin types the
// current balance so the next transfers are checked against it again.
export async function setWalletBalance(actorId: string, balance: number) {
  await requireAdminActor(actorId);
  if (!Number.isSafeInteger(balance) || balance < 0)
    throw new OrderError("اكتب الرصيد صح");
  await db.paymentNotice.create({
    data: {
      textHash: "manual-balance:" + createHash("sha256").update(randomInt(2 ** 40) + ":" + Date.now()).digest("hex"),
      text: "رصيد المحفظة اتسجل يدوي من لوحة الأدمن",
      status: "IGNORED",
      balance,
      trusted: true,
      note: "رصيد يدوي",
    },
  });
  await db.auditLog.create({
    data: {
      actorId,
      action: "payment_notice.balance_set",
      targetId: "wallet",
      data: JSON.stringify({ balance }),
    },
  });
}
