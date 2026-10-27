import { i18n } from "@/lib/prefs";
import Link from "next/link";
import { SITE_NAME, SITE_NAME_EN } from "@/lib/config";
import { siteHref } from "@/lib/sites";

export async function Footer() {
  const { t, lang } = await i18n();
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm text-slate-600 sm:grid-cols-3">
        <div>
          <p className="text-lg font-bold text-brand-600">
            {t(SITE_NAME)}{" "}
            {lang === "ar" && <span className="text-sm font-semibold text-slate-400">{SITE_NAME_EN}</span>}
          </p>
          <p className="mt-2">{t("سوق مصري للمنتجات الرقمية من تجار موثّقين، بتسليم فوري بعد الدفع.")}</p>
        </div>
        <div>
          <p className="mb-2 font-semibold text-slate-900">{t("للمشترين")}</p>
          <ul className="space-y-1">
            <li><Link href="/account">{t("مشترياتي")}</Link></li>
            <li><Link href="/pages/refunds">{t("سياسة الاسترداد")}</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-2 font-semibold text-slate-900">{t("للتجار")}</p>
          <ul className="space-y-1">
            <li><Link href={siteHref("seller", "/seller/join")}>{t("ابدأ البيع")}</Link></li>
            <li><Link href="/pages/terms">{t("الشروط والأحكام")}</Link></li>
          </ul>
        </div>
      </div>
      <p className="border-t border-slate-100 py-4 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} {t(SITE_NAME)}
      </p>
    </footer>
  );
}
