import Link from "next/link";
import { SITE_NAME, SITE_NAME_EN } from "@/lib/config";
import { siteHref } from "@/lib/sites";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm text-slate-600 sm:grid-cols-3">
        <div>
          <p className="text-lg font-bold text-brand-600">
            {SITE_NAME} <span className="text-sm font-semibold text-slate-400">{SITE_NAME_EN}</span>
          </p>
          <p className="mt-2">سوق مصري للمنتجات الرقمية من تجار موثّقين، بتسليم فوري بعد الدفع.</p>
        </div>
        <div>
          <p className="mb-2 font-semibold text-slate-900">للمشترين</p>
          <ul className="space-y-1">
            <li><Link href="/account">مشترياتي</Link></li>
            <li><Link href="/pages/refunds">سياسة الاسترداد</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-2 font-semibold text-slate-900">للتجار</p>
          <ul className="space-y-1">
            <li><Link href={siteHref("seller", "/seller/join")}>ابدأ البيع</Link></li>
            <li><Link href="/pages/terms">الشروط والأحكام</Link></li>
          </ul>
        </div>
      </div>
      <p className="border-t border-slate-100 py-4 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} {SITE_NAME}
      </p>
    </footer>
  );
}
