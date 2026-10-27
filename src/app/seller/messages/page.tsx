import { i18n } from "@/lib/prefs";
import Link from "next/link";
import { requireSeller } from "@/lib/auth";
import { db } from "@/lib/db";

export async function generateMetadata() {
  return { title: (await i18n()).t("الرسائل") };
}

// Every order conversation in one inbox, newest first, unread on top.
export default async function SellerMessages({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; unread?: string }>;
}) {
  const { t, num, date } = await i18n();
  const { user, seller } = await requireSeller();
  const { q = "", unread } = await searchParams;
  const term = q.trim().slice(0, 100);
  const threads = await db.$queryRaw<
    {
      orderId: string;
      number: number;
      email: string;
      body: string;
      fromMe: boolean;
      at: Date;
      unread: bigint;
    }[]
  >`
    SELECT o.id AS "orderId", o.number, u.email, last.body,
      last."senderId" = ${user.id} AS "fromMe", last."createdAt" AS at,
      (SELECT count(*) FROM "Message" m
        LEFT JOIN "OrderRead" r ON r."orderId" = m."orderId" AND r."userId" = ${user.id}
        WHERE m."orderId" = o.id AND m."senderId" <> ${user.id}
          AND (r."lastReadAt" IS NULL OR m."createdAt" > r."lastReadAt")) AS unread
    FROM "Order" o
    JOIN "User" u ON u.id = o."buyerId"
    JOIN LATERAL (
      SELECT body, "senderId", "createdAt" FROM "Message"
      WHERE "orderId" = o.id ORDER BY "createdAt" DESC LIMIT 1
    ) last ON true
    WHERE EXISTS (SELECT 1 FROM "OrderItem" i WHERE i."orderId" = o.id AND i."sellerId" = ${seller.id})
      AND (${term} = '' OR u.email ILIKE '%' || ${term} || '%' OR o.number::text = ${term.replace(/^#/, "")})
    ORDER BY last."createdAt" DESC
    LIMIT 200`;
  const list = unread === "1" ? threads.filter((th) => th.unread > 0) : threads;
  const unreadCount = threads.filter((th) => th.unread > 0).length;

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{t("الرسائل")}</h1>
        {unreadCount > 0 && (
          <span className="badge bg-brand-600 text-white">
            {num(unreadCount)}{t(" محادثة جديدة")}
          </span>
        )}
      </div>
      <form className="flex flex-wrap gap-2">
        <input
          className="input max-w-sm"
          name="q"
          defaultValue={term}
          placeholder={t("إيميل المشتري أو رقم الطلب")}
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="unread" value="1" defaultChecked={unread === "1"} />
          {t("غير المقروء بس")}
        </label>
        <button className="btn-primary">{t("بحث")}</button>
      </form>
      <div className="card divide-y">
        {list.map((th) => (
          <Link
            key={th.orderId}
            href={`/seller/sales/${th.orderId}`}
            className={`flex gap-4 p-4 hover:bg-slate-50 ${th.unread > 0 ? "bg-brand-50/40" : ""}`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold" dir="ltr">{th.email}</span>
                <span className="text-slate-500">{t("طلب #")}{th.number}</span>
              </div>
              <p className={`mt-1 truncate text-sm ${th.unread > 0 ? "font-semibold" : "text-slate-600"}`}>
                {th.fromMe && <span className="text-slate-400">{t("أنت: ")}</span>}
                {th.body}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-slate-500">
              {date(th.at)}
              {th.unread > 0 && (
                <span className="badge bg-brand-600 text-white">
                  {num(Number(th.unread))}
                </span>
              )}
            </div>
          </Link>
        ))}
        {!list.length && <p className="p-6 text-slate-500">{t("مفيش رسائل")}</p>}
      </div>
    </div>
  );
}
