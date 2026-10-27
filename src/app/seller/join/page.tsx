import { i18n } from "@/lib/prefs";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { SELLER_TIERS } from "@/lib/config";
import { JoinForm } from "./join-form";

export async function generateMetadata() {
  return { title: (await i18n()).t("ابدأ البيع") };
}

export default async function JoinPage() {
  const { t, num } = await i18n();
  const user = await requireUser("/seller/join");
  if (user.seller) redirect("/seller");

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">{t("ابدأ البيع")}</h1>
      <p className="mt-2 text-slate-600">
        {t("هتعمل متجرك في دقيقة، وبعدها هنطلب منك توثيق الهوية. منتجاتك هتظهر للناس بعد ما نراجع التوثيق.")}
      </p>
      <div className="my-6 grid gap-4 sm:grid-cols-2">
        {(["INDIVIDUAL", "COMPANY"] as const).map((kind) => (
          <div key={kind} className="card p-5">
            <p className="text-lg font-bold">{t(SELLER_TIERS[kind].label)}</p>
            <p className="mb-3 text-sm text-slate-500">
              {kind === "INDIVIDUAL" ? t("بالبطاقة الشخصية") : t("بالسجل التجاري والبطاقة الضريبية")}
            </p>
            <ul className="space-y-1 text-sm">
              <li>{t("• الأرباح متاحة للسحب بعد ")}{SELLER_TIERS[kind].holdDays}{t(" أيام")}</li>
              <li>{t("• لحد ")}{num(SELLER_TIERS[kind].maxActiveProducts)}{t(" منتج نشط")}</li>
              <li>{t("• شارة \"")}{t(SELLER_TIERS[kind].badge)}&quot;</li>
            </ul>
          </div>
        ))}
      </div>
      <JoinForm />
    </div>
  );
}
