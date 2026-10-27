import Link from "next/link";
import { i18n } from "@/lib/prefs";
import { ProductCard, type ProductCardData } from "./product-card";
import { Icon } from "./icons";

// Building blocks shared by the store pages.

export async function SectionHeader({ title, href, icon }: { title: string; href?: string; icon?: React.ReactNode }) {
  const { t } = await i18n();
  return (
    <div className="mb-4 flex items-center gap-2">
      {icon}
      <h2 className="text-xl font-extrabold">{title}</h2>
      {href && (
        <Link href={href} className="ms-auto flex items-center gap-0.5 text-sm font-semibold text-brand-600 hover:underline">
          {t("الكل")}
          <Icon name="chevron" className="h-4 w-4 rtl:rotate-180" />
        </Link>
      )}
    </div>
  );
}

export function ProductGrid({ products, dense }: { products: ProductCardData[]; dense?: boolean }) {
  return (
    <div
      className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${dense ? "lg:grid-cols-4" : "md:grid-cols-4 xl:grid-cols-5"}`}
    >
      {products.map((p) => (
        <ProductCard key={p.slug} product={p} />
      ))}
    </div>
  );
}

// One row that scrolls sideways on small screens instead of wrapping.
export function ProductScroller({ products }: { products: ProductCardData[] }) {
  return (
    <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
      {products.map((p) => (
        <div key={p.slug} className="w-40 shrink-0 snap-start sm:w-48 lg:w-52">
          <ProductCard product={p} />
        </div>
      ))}
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="breadcrumb" className="mb-4 flex flex-wrap items-center gap-1 text-sm text-slate-500">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <Icon name="chevron" className="h-3.5 w-3.5 text-slate-300 rtl:rotate-180" />}
          {item.href ? (
            <Link href={item.href} className="hover:text-brand-600">
              {item.label}
            </Link>
          ) : (
            <span className="line-clamp-1 text-slate-700">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
