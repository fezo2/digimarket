import { i18n } from "@/lib/prefs";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { reviewKyc } from "../../actions";

const PAYOUT = { INSTAPAY: "InstaPay", MOBILE_WALLET: "محفظة موبايل", BANK_TRANSFER: "تحويل بنكي" } as const;

export default async function KycReview({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { t } = await i18n();
  const { id } = await params;
  const { error } = await searchParams;
  const s = await db.kycSubmission.findUnique({
    where: { id },
    include: { seller: { include: { user: { select: { email: true, createdAt: true } } } } },
  });
  if (!s) notFound();

  const docs = [
    [t("البطاقة (وش)"), s.idFrontKey],
    [t("البطاقة (ضهر)"), s.idBackKey],
    [t("سيلفي بالبطاقة"), s.selfieKey],
    [t("السجل التجاري"), s.commercialRegKey],
    [t("البطاقة الضريبية"), s.taxCardKey],
  ].filter((d): d is [string, string] => Boolean(d[1]));

  const rows: [string, string | null][] = [
    [t("المتجر"), s.seller.storeName],
    [t("إيميل الحساب"), s.seller.user.email],
    [t("النوع"), s.type === "COMPANY" ? t("شركة") : t("فرد")],
    [t("الاسم"), s.fullName],
    [t("الرقم القومي"), s.nationalId],
    [t("الموبايل"), s.phone],
    [t("اسم الشركة"), s.companyName],
    [t("السجل التجاري"), s.commercialRegNo],
    [t("البطاقة الضريبية"), s.taxCardNo],
    [t("استلام الأرباح"), `${t(PAYOUT[s.payoutMethod])}: ${s.payoutAccount}`],
    [t("اسم صاحب الحساب"), s.payoutAccountName],
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("مراجعة توثيق: ")}{s.seller.storeName}</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="card p-6">
          <dl className="space-y-3 text-sm">
            {rows
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="font-semibold">{v}</dd>
                </div>
              ))}
          </dl>
          <p className="mt-4 text-xs text-slate-500">
            {t("اتأكد إن الاسم على البطاقة هو نفس اسم صاحب حساب الأرباح، وإن السيلفي لنفس الشخص.")}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {docs.map(([label, key]) => {
            const url = `/api/admin/files/${key}`;
            return (
              <a key={key} href={url} target="_blank" className="card block overflow-hidden hover:border-brand-500">
                <p className="p-2 text-sm font-semibold">{label}</p>
                {key.endsWith(".pdf") ? (
                  <p className="p-6 text-center text-brand-600">{t("فتح ملف PDF")}</p>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={label} className="aspect-[4/3] w-full bg-slate-100 object-contain" />
                )}
              </a>
            );
          })}
        </div>
      </div>

      {s.status === "PENDING" ? (
        <form className="card space-y-4 p-6">
          <input type="hidden" name="id" value={s.id} />
          <div>
            <label className="label" htmlFor="note">{t("ملاحظة (مطلوبة في حالة الرفض، والتاجر هيشوفها)")}</label>
            <textarea id="note" name="note" rows={2} className="input" />
            {error === "note" && <p className="mt-1 text-sm text-red-700">{t("اكتب سبب الرفض.")}</p>}
          </div>
          <div className="flex gap-3">
            <button formAction={reviewKyc.bind(null, "APPROVED")} className="btn-primary">{t("قبول وتوثيق التاجر")}</button>
            <button formAction={reviewKyc.bind(null, "REJECTED")} className="btn-danger">{t("رفض")}</button>
          </div>
        </form>
      ) : (
        <p className="card p-4 text-sm">
          {t("الحالة: ")}{s.status === "APPROVED" ? t("مقبول") : t("مرفوض")}
          {s.reviewNote && ` · ${s.reviewNote}`}
        </p>
      )}
    </div>
  );
}
