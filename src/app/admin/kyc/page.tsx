import { paginate } from "@/lib/pagination";
import { Pager } from "@/components/pager";
import type { Prisma } from "@prisma/client";
import { i18n } from "@/lib/prefs";
import Link from "next/link";
import { db } from "@/lib/db";
import { adminFrom, requireAdmin } from "@/lib/auth";

const PER_PAGE = 30;

export async function generateMetadata() {
  return { title: (await i18n()).t("طلبات التوثيق") };
}

const STATUS = {
  PENDING: ["قيد المراجعة", "bg-blue-50 text-blue-700"],
  APPROVED: ["مقبول", "bg-emerald-50 text-emerald-700"],
  REJECTED: ["مرفوض", "bg-red-50 text-red-700"],
  NOT_SUBMITTED: ["-", ""],
} as const;

export default async function KycQueue({ searchParams }: { searchParams: Promise<{ all?: string; page?: string }> }) {
  const { t, day } = await i18n();
  const admin = await requireAdmin();
  const { all, page } = await searchParams;
  const showAll = all === "1";
  const pageParams = { all };
  const where: Prisma.KycSubmissionWhereInput = {
    submittedAt: adminFrom(admin),
    ...(showAll ? {} : { status: "PENDING" }),
  };
  const info = paginate(await db.kycSubmission.count({ where }), PER_PAGE, page);
  const submissions = await db.kycSubmission.findMany({
    where,
    orderBy: { submittedAt: showAll ? "desc" : "asc" },
    include: { seller: { select: { storeName: true } } },
    skip: info.skip,
    take: info.take,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{t("طلبات التوثيق")}</h1>
        <Link href={showAll ? "/admin/kyc" : "/admin/kyc?all=1"} className="ms-auto text-sm text-brand-600">
          {showAll ? t("المستني مراجعة بس") : t("كل الطلبات")}
        </Link>
      </div>
      {submissions.length === 0 ? (
        <p className="card p-8 text-center text-slate-500">{t("مفيش طلبات.")}</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-right text-slate-500">
              <tr>
                <th className="p-3">{t("المتجر")}</th>
                <th className="p-3">{t("الاسم")}</th>
                <th className="p-3">{t("النوع")}</th>
                <th className="p-3">{t("التاريخ")}</th>
                <th className="p-3">{t("الحالة")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {submissions.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="p-3">
                    <Link href={`/admin/kyc/${s.id}`} className="font-semibold text-brand-600">{s.seller.storeName}</Link>
                  </td>
                  <td className="p-3">{s.fullName}</td>
                  <td className="p-3">{s.type === "COMPANY" ? t("شركة") : t("فرد")}</td>
                  <td className="p-3">{day(s.submittedAt)}</td>
                  <td className="p-3"><span className={`badge ${STATUS[s.status][1]}`}>{t(STATUS[s.status][0])}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager {...info} params={pageParams} />
    </div>
  );
}
