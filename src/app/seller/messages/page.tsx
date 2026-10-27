import { i18n } from "@/lib/prefs";
import Link from "next/link";
import { requireSeller } from "@/lib/auth";
import { db } from "@/lib/db";
import { OrderChat } from "@/components/order-chat";
import { withParams } from "@/lib/seller-period";
import { Icon } from "../icons";

export async function generateMetadata() {
  return { title: (await i18n()).t("الرسائل") };
}

// Every order conversation in one inbox: the list on one side, the open
// conversation on the other (one at a time on phones).
export default async function SellerMessages({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; unread?: string; open?: string }>;
}) {
  const { t, num, day, time } = await i18n();
  const { user, seller } = await requireSeller();
  const { q = "", unread, open } = await searchParams;
  const term = q.trim().slice(0, 100);
  const threads = await db.$queryRaw<
    {
      orderId: string;
      number: number;
      email: string;
      title: string;
      body: string;
      fromMe: boolean;
      at: Date;
      unread: bigint;
    }[]
  >`
    SELECT o.id AS "orderId", o.number, u.email, last.body,
      (SELECT i.title FROM "OrderItem" i WHERE i."orderId" = o.id AND i."sellerId" = ${seller.id} LIMIT 1) AS title,
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
  // Only a conversation from this seller's own inbox can be opened here.
  const current = threads.find((th) => th.orderId === open);
  const replies = current
    ? await db.sellerReply.findMany({
        where: { sellerId: seller.id },
        orderBy: { createdAt: "asc" },
        select: { id: true, title: true, body: true },
      })
    : [];
  const keep = { q: term || undefined, unread: unread === "1" ? "1" : undefined };

  return (
    <div className="p-0 lg:p-6">
      <div className="card flex h-[calc(100vh-4rem)] overflow-hidden max-lg:rounded-none max-lg:border-0 lg:h-[calc(100vh-7rem)]">
        <div className={`flex w-full flex-col border-e border-slate-200 lg:w-96 lg:shrink-0 ${current ? "max-lg:hidden" : ""}`}>
          <form className="space-y-3 border-b border-slate-200 p-4">
            <div className="relative">
              <input
                className="input pe-10"
                name="q"
                defaultValue={term}
                placeholder={t("إيميل المشتري أو رقم الطلب")}
              />
              <button className="absolute inset-y-0 end-0 px-3 text-slate-500" aria-label={t("بحث")}>
                <Icon name="search" />
              </button>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="unread" value="1" defaultChecked={unread === "1"} />
              {t("غير المقروء بس")}
            </label>
          </form>
          <div className="flex-1 divide-y divide-slate-200 overflow-y-auto">
            {list.map((th) => (
              <Link
                key={th.orderId}
                href={withParams(keep, { open: th.orderId })}
                className={`flex gap-3 px-4 py-3.5 hover:bg-slate-50 ${th.orderId === open ? "bg-slate-100" : ""}`}
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white uppercase">
                  {th.email.slice(0, 2)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate font-semibold" dir="ltr">{th.email}</span>
                    <span className="shrink-0 text-xs text-slate-500">{day(th.at)} {time(th.at)}</span>
                  </div>
                  <p className="truncate text-xs text-slate-500">#{th.number} · {th.title}</p>
                  <div className="flex items-center gap-2">
                    <p className={`min-w-0 flex-1 truncate text-sm ${th.unread > 0 ? "font-semibold" : "text-slate-500"}`}>
                      {th.fromMe && <span className="text-slate-400">{t("أنت: ")}</span>}
                      {th.body}
                    </p>
                    {th.unread > 0 && (
                      <span className="rounded-full bg-brand-600 px-2 py-0.5 text-xs font-bold text-white">
                        {num(Number(th.unread))}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
            {!list.length && <p className="p-6 text-center text-slate-500">{t("مفيش رسائل")}</p>}
          </div>
        </div>
        <div className={`min-w-0 flex-1 overflow-y-auto ${current ? "" : "max-lg:hidden"}`}>
          {current ? (
            <div className="space-y-4 p-4 lg:p-6">
              <div className="flex flex-wrap items-center gap-3">
                <Link href={withParams(keep, {})} className="rounded-lg p-1.5 hover:bg-slate-100 lg:hidden" aria-label={t("رجوع")}>
                  <Icon name="chevron" className="size-5 rotate-90 rtl:-rotate-90" />
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold" dir="ltr">{current.email}</p>
                  <p className="truncate text-sm text-slate-500">#{current.number} · {current.title}</p>
                </div>
                <Link href={`/seller/sales/${current.orderId}`} className="btn-outline">
                  {t("تفاصيل الطلب")}
                </Link>
              </div>
              <OrderChat userId={user.id} orderId={current.orderId} replies={replies} />
            </div>
          ) : (
            <div className="grid h-full place-items-center p-6 text-center text-slate-500">
              <div className="space-y-3">
                <span className="mx-auto grid size-16 place-items-center rounded-full bg-brand-600 text-white">
                  <Icon name="chats" className="size-8" />
                </span>
                <p className="text-lg font-semibold text-slate-700">{t("اختار محادثة")}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
