import { redirect } from "next/navigation";
import { requireSeller } from "@/lib/auth";
import { db } from "@/lib/db";
import { KycForm } from "./kyc-form";

export const metadata = { title: "توثيق الهوية" };

export default async function KycPage() {
  const { seller } = await requireSeller();
  if (seller.kycStatus === "PENDING" || seller.kycStatus === "APPROVED") redirect("/seller");

  const last =
    seller.kycStatus === "REJECTED"
      ? await db.kycSubmission.findFirst({ where: { sellerId: seller.id }, orderBy: { submittedAt: "desc" } })
      : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold">توثيق الهوية (KYC)</h1>
      <p className="mt-2 text-sm text-slate-600">
        البيانات والمستندات دي بتتحفظ بشكل خاص، ومحدش بيشوفها غير فريق المراجعة. لازم حساب استلام الأرباح يكون بنفس اسم صاحب البطاقة أو الشركة.
      </p>
      {last?.reviewNote && (
        <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">سبب رفض الطلب السابق: {last.reviewNote}</p>
      )}
      <KycForm defaultType={seller.type} />
    </div>
  );
}
