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
import { pickOrder, type Candidate } from "./auto-payments-pick";

// A transfer can land a while after the 30-minute order window: a matched
// late payment still revives and delivers the order (see markOrderPaid).
const LATE_PAYMENT_MS = 3 * 60 * 60 * 1000;

export function autoPaymentSettings(env: NodeJS.ProcessEnv = process.env) {
  const max = Number(env.AUTO_CONFIRM_MAX_EGP ?? "3000");
  return {
    secret: env.SMS_WEBHOOK_SECRET?.trim() || "",
    maxAmount: Number.isFinite(max) && max > 0 ? Math.round(max * 100) : 300000,
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

  let status: "MATCHED" | "UNMATCHED" | "IGNORED" = "UNMATCHED";
  let note = "";
  let order: Candidate | undefined;
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
    const pick = pickOrder(parsed, candidates);
    note = pick.reason;
    if (pick.order && pick.order.total > settings.maxAmount) {
      note = `المبلغ أكبر من حد التأكيد التلقائي (${formatEGP(settings.maxAmount)})`;
      await alertAdmin(
        `⚠️ تحويل لطلب #${pick.order.number} أكبر من حد التأكيد التلقائي، أكده بنفسك\n${siteHref("admin", "/admin/payments")}`,
      );
    } else if (pick.order) {
      order = pick.order;
      status = "MATCHED";
    }
  }

  let notice;
  try {
    notice = await db.paymentNotice.create({
      data: {
        textHash,
        sender,
        text,
        amount: parsed.amounts[0] ?? null,
        status,
        orderId: order?.id ?? null,
        note: note || null,
      },
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
      if (first?.status === "MATCHED" && first.orderId) {
        const target = await db.order.findUnique({
          where: { id: first.orderId },
          select: { total: true, paidAt: true },
        });
        if (target && !target.paidAt)
          await markOrderPaid(first.orderId, {
            provider: "manual",
            reference: "sms:" + first.id,
            amount: target.total,
          });
      }
      return { status: "DUPLICATE" as const };
    }
    throw error;
  }
  if (!order) {
    if (status === "UNMATCHED")
      await alertAdmin(
        `❓ وصل تحويل ومش عارفين نربطه بطلب (${note})\n${parsed.amounts[0] ? formatEGP(parsed.amounts[0]) : ""}\n${siteHref("admin", "/admin/payments")}`,
      );
    return { status };
  }

  // A transfer the buyer also reported by hand is closed with it, so the
  // admin queue does not ask to confirm it again.
  await db.manualPayment.updateMany({
    where: { orderId: order.id, status: "SUBMITTED" },
    data: {
      status: "CONFIRMED",
      receivedAmount: order.total,
      reviewNote: "تأكيد تلقائي من رسالة التحويل",
      reviewedAt: new Date(),
    },
  });
  // The buyer may round the unique piasters away; the order total is what
  // the sellers and the ledger are owed, any extra piasters stay with us.
  await markOrderPaid(order.id, {
    provider: "manual",
    reference: "sms:" + notice.id,
    amount: order.total,
  });
  const paid = await db.order.findUnique({
    where: { id: order.id },
    select: { status: true },
  });
  await alertAdmin(
    [
      paid?.status === "PAID"
        ? "✅ دفع اتأكد تلقائيًا"
        : "⚠️ تحويل اتربط بطلب بس الطلب ما اتدفعش، راجعه",
      `طلب #${order.number} · ${formatEGP(order.total)} · ${note}`,
      siteHref("admin", "/admin/payments?status=AUTO"),
    ].join("\n"),
  );
  return { status, orderId: order.id };
}
