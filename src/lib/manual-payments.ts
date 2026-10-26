import "server-only";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { lockOrder, markOrderPaid, releaseOrderStock } from "./orders";
import { finalizeUpload } from "./finalize-upload";
import { deletePrivateFile } from "./storage";
import { checkMagic, uploadSpec, UploadError } from "./storage-rules";

export class ManualPaymentError extends Error {}

export const manualInput = z
  .object({
    method: z.enum(["INSTAPAY", "WALLET"]),
    senderAccount: z
      .string()
      .trim()
      .min(3, "اكتب الحساب أو الرقم اللي حوّلت منه")
      .max(100),
    reference: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9-]{6,40}$/, "اكتب رقم العملية زي ما هو في الإيصال"),
  })
  .transform((v) => ({ ...v, reference: v.reference.toUpperCase() }));

async function saveReceipt(
  userId: string,
  orderId: string,
  file: File | string,
) {
  if (typeof file !== "string") {
    // Local driver: the presigned flow checks these on R2.
    uploadSpec("receipt", file.size, file.type);
    checkMagic(
      new Uint8Array(await file.slice(0, 16).arrayBuffer()),
      file.type,
    );
  }
  return finalizeUpload(userId, `receipts/${orderId}`, "receipt", file);
}

export async function submitManualPayment(
  userId: string,
  orderId: string,
  input: unknown,
  receipt: File | string | null,
) {
  const value = manualInput.parse(input);
  if (!receipt || (typeof receipt !== "string" && !receipt.size))
    throw new ManualPaymentError("ارفع صورة إيصال التحويل");
  const owned = await db.order.findFirst({
    where: { id: orderId, buyerId: userId },
    select: { id: true },
  });
  if (!owned) throw new ManualPaymentError("الطلب مش موجود");
  const receiptKey = await saveReceipt(userId, orderId, receipt);
  try {
    await db.$transaction(async (tx) => {
      await lockOrder(tx, orderId);
      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { manualPayment: true },
      });
      if (order.buyerId !== userId)
        throw new ManualPaymentError("الطلب مش موجود");
      if (order.manualPayment)
        throw new ManualPaymentError("بيانات التحويل اتبعتت قبل كده");
      if (
        order.status !== "PENDING_PAYMENT" ||
        order.paymentProvider !== "manual" ||
        order.expiresAt <= new Date()
      )
        throw new ManualPaymentError("مدة الطلب انتهت، ابدأ طلب جديد");
      await tx.manualPayment.create({
        data: { orderId, ...value, receiptKey },
      });
    });
  } catch (error) {
    await deletePrivateFile(receiptKey).catch(() => {});
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new ManualPaymentError("رقم العملية ده اتستخدم قبل كده");
    throw error;
  }
}

async function requireAdminUser(actorId: string) {
  const actor = await db.user.findUnique({ where: { id: actorId } });
  if (actor?.role !== "ADMIN") throw new ManualPaymentError("غير مسموح");
}

export async function confirmManualPayment(
  actorId: string,
  paymentId: string,
  receivedAmount: number,
  note: string,
) {
  z.string().min(1).max(100).parse(paymentId);
  z.number().int().positive().max(2147483647).parse(receivedAmount);
  const reviewNote = z.string().trim().max(500).parse(note);
  await requireAdminUser(actorId);
  // Claim the transfer first: the SUBMITTED guard makes confirm and reject
  // mutually exclusive, so a rejected transfer can never mark its order paid.
  const claimed = await db.$transaction(async (tx) => {
    const changed = await tx.manualPayment.updateMany({
      where: { id: paymentId, status: "SUBMITTED" },
      data: {
        status: "CONFIRMED",
        receivedAmount,
        reviewNote: reviewNote || null,
        reviewedById: actorId,
        reviewedAt: new Date(),
      },
    });
    if (changed.count)
      await tx.auditLog.create({
        data: {
          actorId,
          action: "manual_payment.confirmed",
          targetId: paymentId,
          data: JSON.stringify({ receivedAmount }),
        },
      });
    return changed.count > 0;
  });
  const payment = await db.manualPayment.findUnique({
    where: { id: paymentId },
  });
  if (!payment) throw new ManualPaymentError("التحويل مش موجود");
  if (payment.status !== "CONFIRMED" || payment.receivedAmount === null)
    throw new ManualPaymentError("التحويل ده اترفض قبل كده");
  // Idempotent on the fixed reference: a retry after a crash, a double click
  // or two admins at once record one payment and one SALE row.
  await markOrderPaid(payment.orderId, {
    provider: "manual",
    reference: "manual:" + payment.id,
    amount: payment.receivedAmount,
  });
  return claimed;
}

export async function rejectManualPayment(
  actorId: string,
  paymentId: string,
  reason: string,
) {
  z.string().min(1).max(100).parse(paymentId);
  const reviewNote = z
    .string()
    .trim()
    .min(1, "اكتب سبب الرفض")
    .max(500)
    .parse(reason);
  await requireAdminUser(actorId);
  const payment = await db.manualPayment.findUnique({
    where: { id: paymentId },
  });
  if (!payment) throw new ManualPaymentError("التحويل مش موجود");
  return db.$transaction(async (tx) => {
    await lockOrder(tx, payment.orderId);
    const changed = await tx.manualPayment.updateMany({
      where: { id: paymentId, status: "SUBMITTED" },
      data: {
        status: "REJECTED",
        reviewNote,
        reviewedById: actorId,
        reviewedAt: new Date(),
      },
    });
    if (!changed.count) return false;
    const cancelled = await tx.order.updateMany({
      where: { id: payment.orderId, status: "PENDING_PAYMENT" },
      data: { status: "CANCELLED" },
    });
    if (cancelled.count) await releaseOrderStock(tx, payment.orderId);
    await tx.auditLog.create({
      data: {
        actorId,
        action: "manual_payment.rejected",
        targetId: paymentId,
        data: JSON.stringify({ orderId: payment.orderId }),
      },
    });
    return true;
  });
}

export function manualActionError(error: unknown) {
  if (error instanceof ManualPaymentError || error instanceof UploadError)
    return { error: error.message };
  if (error instanceof z.ZodError)
    return { error: error.issues[0]?.message ?? "راجع البيانات" };
  console.error("Manual payment action failed", {
    kind: error instanceof Error ? error.name : "unknown",
  });
  return { error: "حصل خطأ، جرّب تاني" };
}
