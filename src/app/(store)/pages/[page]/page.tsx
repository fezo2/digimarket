import { i18n } from "@/lib/prefs";
import { notFound } from "next/navigation";

// Draft policy text. To be reviewed by a lawyer before launch.
const PAGES: Record<string, { title: string; body: string[] }> = {
  terms: {
    title: "الشروط والأحكام",
    body: [
      "التاجر لازم يوثّق هويته (بالبطاقة أو السجل التجاري) قبل ما منتجاته تظهر.",
      "ممنوع بيع حسابات مسروقة، أو محتوى مقرصن، أو أي منتج مخالف للقانون المصري أو لشروط الشركة صاحبة المنتج.",
      "المنصة بتاخد عمولة على كل بيعة حسب القسم، وأرباح التاجر بتتعلّق فترة قصيرة لضمان حق المشتري.",
    ],
  },
  refunds: {
    title: "سياسة الاسترداد",
    body: [
      "لو المنتج اللي استلمته مش شغال أو مش زي الوصف، افتح شكوى من صفحة الطلب خلال فترة الضمان.",
      "التاجر يقدر يرجّعلك المبلغ كله أو جزء منه، ولو مفيش اتفاق الإدارة بتراجع وتحكم.",
      "المنتجات الرقمية اللي اتسلّمت وشغالة مش بتترجّع.",
    ],
  },
};

export default async function StaticPage({ params }: { params: Promise<{ page: string }> }) {
  const { t } = await i18n();
  const page = PAGES[(await params).page];
  if (!page) notFound();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">{t(page.title)}</h1>
      <ul className="card list-disc space-y-3 p-6 ps-10 leading-8">
        {page.body.map((p) => (
          <li key={p}>{t(p)}</li>
        ))}
      </ul>
    </div>
  );
}
