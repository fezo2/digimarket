"use client";

// Drops a saved reply into the chat box of the surrounding form.
export function ReplyPicker({
  replies,
}: {
  replies: { id: string; title: string; body: string }[];
}) {
  if (!replies.length) return null;
  return (
    <label className="label">
      رد جاهز
      <select
        className="input"
        defaultValue=""
        onChange={(e) => {
          const reply = replies.find((r) => r.id === e.target.value);
          const box = e.target.form?.elements.namedItem("body");
          if (reply && box instanceof HTMLTextAreaElement) {
            box.value = reply.body;
            box.focus();
          }
          e.target.value = "";
        }}
      >
        <option value="">اختار رد…</option>
        {replies.map((r) => (
          <option key={r.id} value={r.id}>
            {r.title}
          </option>
        ))}
      </select>
    </label>
  );
}
