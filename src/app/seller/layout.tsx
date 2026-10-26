import Link from "next/link";

export default function SellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <nav
        aria-label="لوحة التاجر"
        className="mx-auto flex max-w-5xl flex-wrap gap-2 px-4 pt-6"
      >
        <Link className="btn-outline" href="/seller">
          لوحة التحكم
        </Link>
        <Link className="btn-outline" href="/seller/products">
          المنتجات
        </Link>
        <Link className="btn-outline" href="/seller/sales">المبيعات والأرباح</Link>
        <Link className="btn-outline" href="/seller/settings">
          بيانات المتجر
        </Link>
      </nav>
      {children}
    </>
  );
}
