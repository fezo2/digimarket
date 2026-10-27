import Link from "next/link";
import { getPrefs, i18n } from "@/lib/prefs";
import { getCurrentUser } from "@/lib/auth";
import { unreadCounts } from "@/lib/chat";
import { db } from "@/lib/db";
import { sellerBalance } from "@/lib/ledger";
import { frozenAmount } from "@/lib/dispute-balance";
import { SITE_NAME, SITE_NAME_EN } from "@/lib/config";
import { portalHref, siteHref } from "@/lib/sites";
import { logout } from "@/app/(auth)/actions";
import { PrefsToggle } from "@/components/prefs-toggle";
import { Icon } from "./icons";
import { Menu, SellerShell } from "./shell";
import "./seller.css";

export default async function SellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t, lang, money } = await i18n();
  const { theme } = await getPrefs();
  const user = await getCurrentUser();
  const seller = user?.seller;
  // Before joining there is no store yet, so no office.
  if (!user || !seller) return children;
  const [unread, disputes, balance, frozen] = await Promise.all([
    unreadCounts(user.id, false, "seller").then((m) =>
      [...m.values()].filter((n) => n > 0).length,
    ),
    db.dispute.count({
      where: { status: "OPEN", orderItem: { sellerId: seller.id } },
    }),
    sellerBalance(seller.id),
    frozenAmount(seller.id, db),
  ]);
  const storeUrl = siteHref("store", `/stores/${seller.slug}`);
  const alerts = unread + disputes;

  const brand = (
    <Link href="/seller" className="flex items-baseline gap-1.5 text-base font-extrabold whitespace-nowrap sm:text-lg">
      {lang === "en" ? SITE_NAME_EN : SITE_NAME}
      <span className="text-sm font-semibold text-brand-600">{t("للتجار")}</span>
    </Link>
  );

  const top = (
    <div className="flex min-w-0 flex-1 items-center gap-2 lg:ps-6 lg:pe-6">
      <Link
        href="/seller/wallet"
        className="hidden items-center gap-3 rounded-xl bg-slate-100 px-3 py-1.5 text-sm sm:flex"
        title={t("الرصيد المتاح للسحب")}
      >
        <span className="font-bold">{money(balance.available - frozen)}</span>
        <span className="text-brand-600 underline underline-offset-4">{t("سحب")}</span>
      </Link>
      <div className="ms-auto flex items-center sm:gap-1">
        <Link
          href={disputes ? "/seller/disputes" : "/seller/messages"}
          className="relative rounded-xl p-2 text-slate-600 hover:bg-slate-100"
          aria-label={t("التنبيهات")}
          title={t("التنبيهات")}
        >
          <Icon name="bell" />
          {alerts > 0 && (
            <span className="absolute -top-0.5 -end-0.5 rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
              {alerts > 9 ? "9+" : alerts}
            </span>
          )}
        </Link>
        <PrefsToggle theme={theme} />
        <Menu
          label={t("قائمة المتجر")}
          button={
            <>
              <span className="max-w-20 truncate sm:max-w-48">{seller.storeName}</span>
              <Icon name="chevron" className="size-4" />
            </>
          }
        >
          <p className="truncate px-3 pt-1 pb-2 text-xs text-slate-500" dir="ltr">{user.email}</p>
          {seller.kycStatus === "APPROVED" && (
            <a href={storeUrl} target="_blank" rel="noopener noreferrer">
              <Icon name="store" className="size-4" />
              {t("صفحة متجري")}
            </a>
          )}
          <Link href="/seller/settings">
            <Icon name="settings" className="size-4" />
            {t("الإعدادات")}
          </Link>
          <Link href="/seller/kyc">
            <Icon name="shield" className="size-4" />
            {t("توثيق الحساب")}
          </Link>
          <a href={portalHref("store")}>
            <Icon name="external" className="size-4" />
            {t("الموقع الرئيسي")}
          </a>
          <form action={logout}>
            <button className="text-red-600">
              <Icon name="logout" className="size-4" />
              {t("خروج")}
            </button>
          </form>
        </Menu>
      </div>
    </div>
  );

  return (
    <SellerShell
      brand={brand}
      top={top}
      links={[
        { href: "/seller", label: t("لوحة التحكم"), icon: "dashboard", exact: true },
        { href: "/seller/products", label: t("المنتجات"), icon: "products" },
        { href: "/seller/sales", label: t("الطلبات"), icon: "orders" },
        { href: "/seller/promo-codes", label: t("أكواد الخصم"), icon: "promo" },
        { href: "/seller/messages", label: t("الرسائل"), icon: "chats", count: unread },
        { href: "/seller/wallet", label: t("المالية"), icon: "finance" },
        { href: "/seller/disputes", label: t("الشكاوى"), icon: "disputes", count: disputes },
        { href: "/seller/reviews", label: t("التقييمات"), icon: "reviews" },
        { href: "/seller/settings", label: t("الإعدادات"), icon: "settings" },
      ]}
      extra={
        seller.kycStatus === "APPROVED"
          ? [{ href: storeUrl, label: t("صفحة متجري"), icon: "store", external: true }]
          : [{ href: "/seller/kyc", label: t("توثيق الحساب"), icon: "shield" }]
      }
    >
      {children}
    </SellerShell>
  );
}
