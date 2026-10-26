import Link from "next/link";
import { siteHref } from "@/lib/sites";
import { listedProduct } from "@/lib/catalog";
import { db } from "@/lib/db";
import { ProductCard, productCardSelect } from "@/components/product-card";
import { SITE_NAME } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [categories, bestSellers, newest, topStores] = await Promise.all([
    db.category.findMany({ where: { parentId: null }, orderBy: { sortOrder: "asc" } }),
    db.product.findMany({
      where: listedProduct,
      orderBy: { soldCount: "desc" },
      take: 8,
      select: productCardSelect,
    }),
    db.product.findMany({
      where: listedProduct,
      orderBy: { createdAt: "desc" },
      take: 8,
      select: productCardSelect,
    }),
    db.sellerProfile.findMany({
      where: { kycStatus: "APPROVED", salesSuspendedAt: null },
      take: 6,
      orderBy: { products: { _count: "desc" } },
      select: { slug: true, storeName: true, type: true, _count: { select: { products: true } } },
    }),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 py-8">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-l from-brand-700 to-brand-500 px-6 py-12 text-white sm:px-12">
        <h1 className="max-w-xl text-3xl font-extrabold leading-tight sm:text-4xl">
          اشتراكات وبرامج ومفاتيح تفعيل، من تجار موثّقين وبتسليم فوري
        </h1>
        <p className="mt-4 max-w-lg text-brand-100">
          كل تاجر على {SITE_NAME} اتحقّقنا من هويته قبل ما يبيع. ادفع بالكارت أو المحفظة، واستلم طلبك في ثواني.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="#categories" className="btn bg-white text-brand-700 hover:bg-brand-50">تصفّح الأقسام</Link>
          <Link href={siteHref("seller", "/seller/join")} className="btn border border-white/40 text-white hover:bg-white/10">ابدأ البيع</Link>
        </div>
      </section>

      <section id="categories">
        <h2 className="mb-4 text-xl font-bold">الأقسام</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {categories.map((c) => (
            <Link key={c.id} href={`/categories/${c.slug}`} className="card flex flex-col items-center gap-2 p-4 text-center hover:border-brand-500">
              <span className="text-3xl">{c.icon}</span>
              <span className="text-sm font-semibold">{c.nameAr}</span>
            </Link>
          ))}
        </div>
      </section>

      <ProductRow title="الأكثر مبيعاً" products={bestSellers} />
      <ProductRow title="وصل حديثاً" products={newest} />

      {topStores.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-bold">متاجر موثّقة</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {topStores.map((s) => (
              <Link key={s.slug} href={`/stores/${s.slug}`} className="card p-4 text-center hover:border-brand-500">
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-lg font-bold text-brand-700">
                  {s.storeName.slice(0, 1)}
                </div>
                <p className="truncate text-sm font-semibold">{s.storeName}</p>
                <p className="text-xs text-slate-500">{s._count.products} منتج</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-4">
        {[
          ["🛡️", "تجار موثّقين", "بالبطاقة أو السجل التجاري"],
          ["⚡", "تسليم فوري", "الكود أو الملف يوصلك بعد الدفع"],
          ["💳", "دفع آمن", "فيزا، ميزة، ومحافظ إلكترونية"],
          ["🤝", "ضمان حقك", "أرباح التاجر بتتعلّق لحد ما تتأكد"],
        ].map(([icon, title, text]) => (
          <div key={title} className="card p-4">
            <p className="text-2xl">{icon}</p>
            <p className="mt-2 font-semibold">{title}</p>
            <p className="text-sm text-slate-500">{text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

function ProductRow({ title, products }: { title: string; products: Parameters<typeof ProductCard>[0]["product"][] }) {
  if (products.length === 0) return null;
  return (
    <section>
      <h2 className="mb-4 text-xl font-bold">{title}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => (
          <ProductCard key={p.slug} product={p} />
        ))}
      </div>
    </section>
  );
}
