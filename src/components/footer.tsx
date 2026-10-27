import { i18n } from "@/lib/prefs";
import Link from "next/link";
import { SITE_NAME, SITE_NAME_EN } from "@/lib/config";
import { siteHref } from "@/lib/sites";
import { storeCategories } from "@/lib/storefront";
import { Icon, type IconName } from "./icons";

export async function Footer() {
  const { t, lang, cat } = await i18n();
  const categories = await storeCategories();
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="border-b border-slate-100">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 text-sm sm:grid-cols-3">
          {(
            [
              ["bolt", t("تسليم فوري"), t("الكود أو الملف يوصلك بعد الدفع")],
              ["shield", t("تجار موثّقين"), t("بالبطاقة أو السجل التجاري")],
              ["thumb", t("ضمان حقك"), t("أرباح التاجر بتتعلّق لحد ما تتأكد")],
            ] as [IconName, string, string][]
          ).map(([icon, title, text]) => (
            <div key={title} className="flex items-center gap-3">
              <Icon name={icon} className="h-6 w-6 shrink-0 text-brand-600" />
              <span>
                <span className="block font-bold text-slate-900">{title}</span>
                <span className="text-slate-500">{text}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xl font-black text-brand-600">
            {t(SITE_NAME)}{" "}
            {lang === "ar" && <span className="text-sm font-semibold text-slate-400">{SITE_NAME_EN}</span>}
          </p>
          <p className="mt-2 leading-6">{t("سوق مصري للمنتجات الرقمية من تجار موثّقين، بتسليم فوري بعد الدفع.")}</p>
        </div>
        <div>
          <p className="mb-3 font-bold text-slate-900">{t("الأقسام")}</p>
          <ul className="space-y-2">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link href={`/categories/${c.slug}`} className="hover:text-brand-600">{cat(c)}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-3 font-bold text-slate-900">{t("للمشترين")}</p>
          <ul className="space-y-2">
            <li><Link href="/account" className="hover:text-brand-600">{t("مشترياتي")}</Link></li>
            <li><Link href="/search" className="hover:text-brand-600">{t("كل المنتجات")}</Link></li>
            <li><Link href="/pages/refunds" className="hover:text-brand-600">{t("سياسة الاسترداد")}</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-3 font-bold text-slate-900">{t("للتجار")}</p>
          <ul className="space-y-2">
            <li><Link href={siteHref("seller", "/seller/join")} className="hover:text-brand-600">{t("ابدأ البيع")}</Link></li>
            <li><Link href="/pages/terms" className="hover:text-brand-600">{t("الشروط والأحكام")}</Link></li>
          </ul>
        </div>
      </div>
      <p className="border-t border-slate-100 py-4 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} {t(SITE_NAME)}
      </p>
    </footer>
  );
}
