import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { PortalHeader } from "@/components/portal-header";
import { currentSite } from "@/lib/auth";
import { SITE_NAME } from "@/lib/config";
import "./globals.css";

const cairo = Cairo({ subsets: ["arabic", "latin"], variable: "--font-cairo" });

export const metadata: Metadata = {
  title: { default: `${SITE_NAME} | سوق المنتجات الرقمية`, template: `%s | ${SITE_NAME}` },
  description: "سوق مصري للمنتجات الرقمية من تجار موثّقين: اشتراكات، حسابات، برامج ومفاتيح تفعيل، بتسليم فوري.",
};

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
