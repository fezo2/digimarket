import { i18n } from "@/lib/prefs";
import { ActionForm } from "@/components/action-form";
import { MAX_REPLIES } from "@/lib/seller-tools";
import { removeReply, saveReply } from "./actions";

export async function RepliesSection({
  replies,
}: {
  replies: { id: string; title: string; body: string }[];
}) {
  const { t, num } = await i18n();
  return (
    <section className="card space-y-4 p-6">
      <div>
        <h2 className="text-lg font-bold">{t("الردود الجاهزة")}</h2>
        <p className="text-sm text-slate-500">
          {t("بتظهرلك في محادثة كل طلب تختار منها بدل ما تكتب نفس الرد كل مرة (لحد")}{" "}
          {num(MAX_REPLIES)}{t(" رد).")}
        </p>
      </div>
      {replies.map((r) => (
        <div key={r.id} className="rounded-xl border p-3">
          <p className="font-semibold">{r.title}</p>
          <p className="whitespace-pre-wrap text-sm text-slate-600">{r.body}</p>
          <ActionForm action={removeReply} button={t("امسح")}>
            <input type="hidden" name="id" value={r.id} />
          </ActionForm>
        </div>
      ))}
      <ActionForm action={saveReply} button={t("ضيف الرد")}>
        <label className="label">
          {t("العنوان (بيظهر لك بس)")}
          <input className="input" name="title" required maxLength={60} placeholder={t("مثلاً: طريقة التفعيل")} />
        </label>
        <label className="label">
          {t("نص الرد")}
          <textarea className="input" name="body" required maxLength={2000} rows={3} />
        </label>
      </ActionForm>
    </section>
  );
}
