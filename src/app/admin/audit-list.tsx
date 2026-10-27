import { i18n } from "@/lib/prefs";
import { auditLabel } from "@/lib/audit-labels";
export async function AuditList({
  logs,
}: {
  logs: { id: string; action: string; data: string | null; createdAt: Date }[];
}) {
  const { t, date } = await i18n();
  return (
    <section className="card p-5">
      <h2 className="mb-3 font-bold">{t("سجل إجراءات الإدارة")}</h2>
      <div className="divide-y text-sm">
        {logs.map((l) => (
          <div key={l.id} className="flex flex-wrap gap-3 py-2">
            <span className="font-semibold" title={l.action}>
              {t(auditLabel(l.action))}
            </span>
            <span className="min-w-0 flex-1 truncate text-slate-500" dir="ltr">
              {l.data}
            </span>
            <span className="text-slate-500">
              {date(l.createdAt)}
            </span>
          </div>
        ))}
        {!logs.length && <p className="text-slate-500">{t("مفيش إجراءات")}</p>}
      </div>
    </section>
  );
}
