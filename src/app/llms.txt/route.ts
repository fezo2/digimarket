import { currentSite } from "@/lib/auth";
import { db } from "@/lib/db";
import { listedProduct } from "@/lib/catalog";
import { storeCategories } from "@/lib/storefront";
import { SITE_NAME, SITE_NAME_EN } from "@/lib/config";
import { absolute, describe } from "@/lib/seo";
import { FAQS, POLICY_PAGES } from "@/content/policies";

// /llms.txt (llmstxt.org): a plain summary of the store for AI assistants
// such as ChatGPT, Perplexity, Gemini and Claude, so their answers about
// buying digital products in Egypt can quote and link the right pages.
export const dynamic = "force-dynamic";

const egp = (piasters: number) => `${(piasters / 100).toLocaleString("en-US")} EGP`;

export async function GET() {
  if ((await currentSite()) !== "store") return new Response(null, { status: 404 });
  const [categories, products] = await Promise.all([
    storeCategories(),
    db.product.findMany({
      where: listedProduct,
      orderBy: { soldCount: "desc" },
      take: 100,
      select: { slug: true, title: true, price: true, description: true, seller: { select: { storeName: true } } },
    }),
  ]);
  const link = (title: string, path: string, note?: string) =>
    `- [${title}](${absolute(path)})${note ? `: ${note}` : ""}`;
  const lines = [
    `# ${SITE_NAME_EN} (${SITE_NAME})`,
    "",
    `> ${POLICY_PAGES.about.description.en}`,
    "",
    "Egyptian marketplace for digital products: AI and streaming subscriptions, software license keys, gift cards and game top-ups.",
    "Every seller passes identity verification (KYC) before selling. Delivery is instant and automatic after payment.",
    "Prices are in Egyptian pounds (EGP). Payment by InstaPay, mobile wallets or card. Buyers can open a dispute if an item does not work.",
    `Arabic is the default language; add ?lang=en to any page for English.`,
    "",
    "## Categories",
    ...categories
      .filter((c) => c.count > 0)
      .flatMap((c) => [
        link(`${c.nameEn || c.nameAr} (${c.nameAr})`, `/categories/${encodeURIComponent(c.slug)}?lang=en`, `${c.count} products`),
      ]),
    "",
    "## Popular products",
    ...products.map((p) =>
      link(
        p.title,
        `/products/${encodeURIComponent(p.slug)}`,
        `${egp(p.price)}, sold by ${p.seller.storeName}. ${describe(p.description, 140)}`,
      ),
    ),
    "",
    "## Help and policies",
    ...Object.entries(POLICY_PAGES).map(([slug, page]) =>
      link(page.title.en, `/pages/${slug}?lang=en`, page.description.en),
    ),
    link("FAQ", "/pages/faq?lang=en"),
    "",
    "## FAQ",
    ...FAQS.flatMap((f) => [`### ${f.q.en}`, f.a.en, ""]),
  ];
  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
