"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { staffMayNotTouch } from "@/lib/staff-scope";

export async function reviewKyc(decision: "APPROVED" | "REJECTED", form: FormData) {
  const admin = await requireAdmin();
  if (decision !== "APPROVED" && decision !== "REJECTED") redirect("/admin/kyc");
  const id = String(form.get("id")).slice(0, 100);
  const note = String(form.get("note") ?? "").trim().slice(0, 1000);

  const submission = await db.kycSubmission.findUnique({
    where: { id },
    include: { seller: { select: { userId: true } } },
  });
  if (!submission || submission.status !== "PENDING") redirect("/admin/kyc");
  if (decision === "REJECTED" && !note) redirect(`/admin/kyc/${id}?error=note`);
  // A staff admin can't verify their own store or an old submission.
  if (
    staffMayNotTouch(admin, {
      createdAt: submission.submittedAt,
      userIds: [submission.seller.userId],
    })
  )
    redirect("/admin/kyc");

  const now = new Date();
  await db.$transaction(async (tx) => {
    // Only a still-pending submission is decided, so two admins (or a double
    // click) can't approve and reject the same one.
    const claimed = await tx.kycSubmission.updateMany({
      where: { id, status: "PENDING" },
      data: { status: decision, reviewNote: note || null, reviewedById: admin.id, reviewedAt: now },
    });
    if (!claimed.count) return;
    await tx.sellerProfile.update({
      where: { id: submission.sellerId },
      data: {
        kycStatus: decision,
        type: submission.type,
        verifiedAt: decision === "APPROVED" ? now : null,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: admin.id,
        action: decision === "APPROVED" ? "kyc.approved" : "kyc.rejected",
        targetId: submission.sellerId,
      },
    });
  });
  revalidatePath("/admin/kyc");
  redirect("/admin/kyc");
}

const commissionSchema = z.object({
  id: z.string(),
  percent: z.coerce.number().min(0).max(50),
});

export async function updateCommission(form: FormData) {
  await requireAdmin();
  const { id, percent } = commissionSchema.parse(Object.fromEntries(form));
  await db.category.update({ where: { id }, data: { commissionBps: Math.round(percent * 100) } });
  revalidatePath("/admin/categories");
}
