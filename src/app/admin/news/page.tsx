import { paginate } from "@/lib/pagination";
import { Pager } from "@/components/pager";
import type { Prisma } from "@prisma/client";
import { i18n } from "@/lib/prefs";
import { adminFrom, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ActionForm } from "@/components/action-form";
import { announcementVisibility, newAnnouncement } from "../control-actions";

const PER_PAGE = 20;

export async function generateMetadata() {
  return { title: (await i18n()).t("إعلانات للتجار") };
}

export default async function News({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { t, date } = await i18n();
  const admin = await requireAdmin();
  const { page } = await searchParams;
  const pageParams = {};
  const where: Prisma.AnnouncementWhereInput = { createdAt: adminFrom(admin) };
  const info = paginate(await db.announcement.count({ where }), PER_PAGE, page);
  const items = await db.announcement.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: info.skip,
    take: info.take,
  });
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">{t("إعلانات للتجار")}</h1>
      <section className="card p-5">
        <ActionForm action={newAnnouncement} button={t("انشر الإعلان")}>
          <label className="label">
            {t("العنوان")}
            <input className="input" name="title" required maxLength={150} />
          </label>
          <label className="label">
            {t("النص")}
            <textarea className="input" name="body" required maxLength={3000} rows={4} />
          </label>
        </ActionForm>
      </section>
      {items.map((a) => (
        <section key={a.id} className="card space-y-2 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-bold">{a.title}</h2>
            <span
              className={`badge ${a.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
            >
              {a.active ? t("ظاهر") : t("مخفي")}
            </span>
            <span className="ms-auto text-sm text-slate-500">
              {date(a.createdAt)}
            </span>
          </div>
          <p className="whitespace-pre-wrap text-sm">{a.body}</p>
          <ActionForm
            action={announcementVisibility}
            button={a.active ? t("إخفاء") : t("إظهار")}
          >
            <input type="hidden" name="id" value={a.id} />
            <input type="hidden" name="active" value={String(!a.active)} />
          </ActionForm>
        </section>
      ))}
      <Pager {...info} params={pageParams} />
    </div>
  );
}
