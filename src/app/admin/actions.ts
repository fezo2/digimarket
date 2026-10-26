"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function reviewKyc(decision: "APPROVED" | "REJECTED", form: FormData) {
  const admin = await requireAdmin();
  const id = String(form.get("id"));
  const note = String(form.get("note") ?? "").trim();

  const submission = await db.kycSubmission.findUnique({ where: { id } });
  if (!submission || submission.status !== "PENDING") redirect("/admin/kyc");
  if (decision === "REJECTED" && !note) redirect(`/admin/kyc/${id}?error=note`);

  const now = new Date();
  await db.$transaction([
    db.kycSubmission.update({
      where: { id },
      data: { status: decision, reviewNote: note || null, reviewedById: admin.id, reviewedAt: now },
    }),
    db.sellerProfile.update({
      where: { id: submission.sellerId },
      data: {
        kycStatus: decision,
        type: submission.type,
        verifiedAt: decision === "APPROVED" ? now : null,
      },
    }),
  ]);
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
