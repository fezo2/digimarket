import { getCurrentUser } from "@/lib/auth";
import { unreadCounts } from "@/lib/chat";
import Link from "next/link";

export default async function SellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const unread = user
    ? [...(await unreadCounts(user.id, false, "seller")).values()].reduce(
        (a, b) => a + b,
        0,
      )
    : 0;
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
        <Link className="btn-outline" href="/seller/sales">
          المبيعات {unread > 0 && <span className="badge">{unread}</span>}
        </Link>
        <Link className="btn-outline" href="/seller/reviews">
          التقييمات
        </Link>
        <Link className="btn-outline" href="/seller/disputes">
          الشكاوى
        </Link>
        <Link className="btn-outline" href="/seller/wallet">
          المحفظة
        </Link>
        <Link className="btn-outline" href="/seller/settings">
          بيانات المتجر
        </Link>
      </nav>
      {children}
    </>
  );
}
