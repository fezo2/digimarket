import { i18n } from "@/lib/prefs";
import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { db } from "@/lib/db";

export async function generateMetadata() {
  return { title: (await i18n()).t("رسائل مشبوهة") };
}

// Messages the chat filter flagged for contact details (phone, WhatsApp,
// links): the usual sign of a seller pulling buyers off the platform.
export default async function FlaggedMessages({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>;
}) {
  const { t, date } = await i18n();
  await requireAdmin();
  const { all } = await searchParams;
  const messages = await db.message.findMany({
    where: all === "1" ? { kind: "USER" } : { flagged: true },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      sender: { select: { id: true, name: true, role: true } },
      order: { select: { id: true, number: true } },
    },
  });
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">
          {all === "1" ? t("كل الرسائل") : t("رسائل فيها وسائل تواصل")}
        </h1>
        <Link
          className="btn-outline ms-auto"
          href={all === "1" ? "/admin/messages" : "/admin/messages?all=1"}
        >
          {all === "1" ? t("المشبوهة بس") : t("كل الرسائل")}
        </Link>
      </div>
      <div className="card divide-y">
        {messages.map((m) => (
          <div key={m.id} className="space-y-1 p-4">
            <div className="flex flex-wrap gap-3 text-sm">
              <Link className="font-semibold" href={`/admin/users/${m.sender.id}`}>
                {m.sender.name}
              </Link>
              <Link className="text-brand-600" href={`/admin/orders/${m.order.id}`}>
                {t("طلب #")}{m.order.number}
              </Link>
              {m.flagged && (
                <span className="badge bg-red-50 text-red-700">{t("مشبوهة")}</span>
              )}
              <span className="ms-auto text-slate-500">
                {date(m.createdAt)}
              </span>
            </div>
            <p className="whitespace-pre-wrap">{m.body}</p>
          </div>
        ))}
        {!messages.length && <p className="p-4 text-slate-500">{t("مفيش رسائل")}</p>}
      </div>
    </div>
  );
}
