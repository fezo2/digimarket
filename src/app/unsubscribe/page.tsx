import { i18n } from "@/lib/prefs";
import { unsubscribeTokenValid } from "@/lib/checkout-reminder-text";

export async function generateMetadata() {
  return { title: (await i18n()).t("إيقاف رسايل التذكير"), robots: { index: false } };
}

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ u?: string; t?: string; done?: string }>;
}) {
  const { t } = await i18n();
  const q = await searchParams;
  const valid = unsubscribeTokenValid(q.u ?? "", q.t ?? "", process.env.AUTH_SECRET);
  const action = `/api/unsubscribe?${new URLSearchParams({ u: q.u ?? "", t: q.t ?? "" })}`;
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="card space-y-4 p-6 text-center">
        <h1 className="text-xl font-bold">{t("إيقاف رسايل التذكير")}</h1>
        {q.done ? (
          <p className="text-sm text-slate-600">
            {t("تمام، مش هنبعتلك رسايل تذكير بالطلبات اللي ماكملتش دفعها تاني. تقدر ترجّعها من صفحة حسابي.")}
          </p>
        ) : valid ? (
          <>
            <p className="text-sm text-slate-600">
              {t("مش عايز نفكّرك لما تبدأ طلب ومتكمّلش الدفع؟")}
            </p>
            <form method="post" action={action}>
              <input type="hidden" name="from" value="page" />
              <button className="btn-primary w-full">{t("أيوه، اقفل التذكيرات")}</button>
            </form>
          </>
        ) : (
          <p className="text-sm text-red-600">{t("اللينك ده مش صحيح.")}</p>
        )}
      </div>
    </div>
  );
}
