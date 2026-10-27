import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { PortalHeader } from "@/components/portal-header";
import { currentSite } from "@/lib/auth";
import { SITE_NAME, SITE_NAME_EN } from "@/lib/config";
import { storeOrigin } from "@/lib/seo";
import "./globals.css";

const cairo = Cairo({ subsets: ["arabic", "latin"], variable: "--font-cairo" });

const DESCRIPTION =
  "سوق مصري للمنتجات الرقمية من تجار موثّقين: اشتراكات، حسابات، برامج ومفاتيح تفعيل، بتسليم فوري.";

export async function generateMetadata(): Promise<Metadata> {
  const store = (await currentSite()) === "store";
  return {
    metadataBase: new URL(storeOrigin()),
    title: {
      default: `${SITE_NAME} ${SITE_NAME_EN} | سوق المنتجات الرقمية في مصر`,
      template: `%s | ${SITE_NAME}`,
    },
    description: DESCRIPTION,
    applicationName: SITE_NAME,
    openGraph: {
      type: "website",
      siteName: `${SITE_NAME} ${SITE_NAME_EN}`,
      locale: "ar_EG",
      description: DESCRIPTION,
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
  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <body className="flex min-h-screen flex-col font-sans antialiased">
        {site === "store" ? <Header /> : <PortalHeader site={site} />}
        <main className="flex-1">{children}</main>
        {site === "store" && <Footer />}
      </body>
    </html>
  );
}
