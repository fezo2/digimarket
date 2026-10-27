import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { PortalHeader } from "@/components/portal-header";
import { headers } from "next/headers";
import { currentSite, getCurrentUser } from "@/lib/auth";
import { PATH_HEADER } from "@/lib/sites";
import { SITE_NAME, SITE_NAME_EN } from "@/lib/config";
import { storeOrigin } from "@/lib/seo";
import { getPrefs, i18n } from "@/lib/prefs";
import { I18nProvider } from "@/components/i18n-provider";
import "./globals.css";

const cairo = Cairo({ subsets: ["arabic", "latin"], variable: "--font-cairo" });

const DESCRIPTION =
  "سوق مصري للمنتجات الرقمية من تجار موثّقين: اشتراكات، حسابات، برامج ومفاتيح تفعيل، بتسليم فوري.";

export async function generateMetadata(): Promise<Metadata> {
  const store = (await currentSite()) === "store";
  const { t, lang } = await i18n();
  const description = t(DESCRIPTION);
  return {
    metadataBase: new URL(storeOrigin()),
    title: {
      default: `${SITE_NAME} ${SITE_NAME_EN} | ${t("سوق المنتجات الرقمية في مصر")}`,
      template: `%s | ${SITE_NAME}`,
    },
    description,
    applicationName: SITE_NAME,
    openGraph: {
      type: "website",
      siteName: `${SITE_NAME} ${SITE_NAME_EN}`,
      locale: lang === "en" ? "en_US" : "ar_EG",
      description,
    },
    twitter: { card: "summary_large_image" },
    // The seller and admin portals must never show up in search results.
    robots: store ? { index: true, follow: true } : { index: false, follow: false },
    verification: process.env.GOOGLE_SITE_VERIFICATION
      ? { google: process.env.GOOGLE_SITE_VERIFICATION }
      : undefined,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const site = await currentSite();
  const { lang, theme } = await getPrefs();
  // A seller's own portal draws its full-screen shell (src/app/seller/layout.tsx).
  const path = (await headers()).get(PATH_HEADER) ?? "";
  const shell =
    (path === "/seller" || path.startsWith("/seller/")) && !!(await getCurrentUser())?.seller;
  return (
    <html
      lang={lang}
      dir={lang === "en" ? "ltr" : "rtl"}
      className={`${cairo.variable}${theme === "dark" ? " dark" : ""}`}
    >
      <body className={`flex min-h-screen flex-col font-sans antialiased${site === "store" && !shell ? " store-theme" : ""}`}>
        <I18nProvider lang={lang}>
          {shell ? null : site === "store" ? <Header /> : <PortalHeader site={site} />}
          <main className="flex-1">{children}</main>
          {site === "store" && !shell && <Footer />}
        </I18nProvider>
      </body>
    </html>
  );
}
