import { i18n } from "@/lib/prefs";
import { auditLabel } from "@/lib/audit-labels";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export async function generateMetadata() {
  return { title: (await i18n()).t("سجل الإجراءات") };
}

export default async function Audit({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { t, date } = await i18n();
  await requireAdmin();
  const { q = "" } = await searchParams;
  const term = q.trim().slice(0, 100);
  const logs = await db.auditLog.findMany({
    where: term
      ? { OR: [{ action: { contains: term } }, { targetId: term }] }
      : {},
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const actors = await db.user.findMany({
    where: { id: { in: [...new Set(logs.map((l) => l.actorId))] } },
    select: { id: true, name: true },
  });
  const name = new Map(actors.map((a) => [a.id, a.name]));
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">{t("سجل إجراءات الإدارة")}</h1>
      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={term}
          className="input max-w-sm"
          dir="ltr"
          placeholder={t("seller.sales_suspended أو رقم الحساب")}
        />
        <button className="btn-primary">{t("بحث")}</button>
      </form>
      <div className="card divide-y text-sm">
        {logs.map((l) => (
          <div key={l.id} className="flex flex-wrap gap-3 p-3">
            <span className="font-semibold">{name.get(l.actorId) ?? l.actorId}</span>
            <span className="font-semibold" title={l.action}>
              {t(auditLabel(l.action))}
            </span>
            <span className="font-mono text-slate-500" dir="ltr">
              {l.targetId}
            </span>
            <span className="min-w-0 flex-1 truncate text-slate-500" dir="ltr">
              {l.data}
            </span>
            <span className="text-slate-500">
              {date(l.createdAt)}
            </span>
          </div>
        ))}
        {!logs.length && <p className="p-4 text-slate-500">{t("مفيش إجراءات")}</p>}
      </div>
    </div>
  );
}
