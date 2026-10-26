import { ActionForm } from "@/components/action-form";
import { MAX_REPLIES } from "@/lib/seller-tools";
import { removeReply, saveReply } from "./actions";

export function RepliesSection({
  replies,
}: {
  replies: { id: string; title: string; body: string }[];
}) {
  return (
    <section className="card space-y-4 p-6">
      <div>
        <h2 className="text-lg font-bold">الردود الجاهزة</h2>
        <p className="text-sm text-slate-500">
          بتظهرلك في محادثة كل طلب تختار منها بدل ما تكتب نفس الرد كل مرة (لحد{" "}
          {MAX_REPLIES.toLocaleString("ar-EG")} رد).
        </p>
      </div>
      {replies.map((r) => (
        <div key={r.id} className="rounded-xl border p-3">
          <p className="font-semibold">{r.title}</p>
          <p className="whitespace-pre-wrap text-sm text-slate-600">{r.body}</p>
          <ActionForm action={removeReply} button="امسح">
            <input type="hidden" name="id" value={r.id} />
          </ActionForm>
        </div>
      ))}
      <ActionForm action={saveReply} button="ضيف الرد">
        <label className="label">
          العنوان (بيظهر لك بس)
          <input className="input" name="title" required maxLength={60} placeholder="مثلاً: طريقة التفعيل" />
        </label>
        <label className="label">
          نص الرد
          <textarea className="input" name="body" required maxLength={2000} rows={3} />
        </label>
      </ActionForm>
    </section>
  );
}
