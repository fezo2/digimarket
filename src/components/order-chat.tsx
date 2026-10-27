import { i18n } from "@/lib/prefs";
import { notFound } from "next/navigation";
import { readChat } from "@/lib/chat";
import { ParticipantError } from "@/lib/community-error";
import { ActionForm } from "./action-form";
import { ChatRefresh } from "./chat-refresh";
import { ReplyPicker } from "./reply-picker";
import { sendChat } from "@/app/account/orders/[id]/actions";
export async function OrderChat({
  orderId,
  userId,
  replies = [],
}: {
  orderId: string;
  userId: string;
  replies?: { id: string; title: string; body: string }[];
}) {
  const { t, date } = await i18n();
  const chat = await readChat(userId, orderId).catch((error) => {
    if (error instanceof ParticipantError) notFound();
    throw error;
  });
  return (
    <section className="card space-y-4 p-5">
      <ChatRefresh />
      <h2 className="text-xl font-bold">{t("محادثة الطلب")}</h2>
      {chat.messages.map((m) => (
        <article
          className={
            m.kind === "SYSTEM"
              ? "rounded-lg border border-sky-300 bg-sky-50 p-3 text-sky-950"
              : "rounded-lg border p-3"
          }
          key={m.id}
        >
          <p className="font-semibold">
            {m.kind === "SYSTEM" ? t("النظام") : m.role} ·{" "}
            {date(m.createdAt)}
          </p>
          <p className="whitespace-pre-wrap break-words">{m.body}</p>
          {m.flagged && (
            <p className="text-red-700">
              {t("رسالة معلّمة: اتشالت وسائل تواصل خارج الموقع")}
            </p>
          )}
          {m.hasAttachment && (
            <a
              className="underline"
              href={`/api/orders/${orderId}/messages/${m.id}/attachment`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("عرض الصورة المرفقة")}
            </a>
          )}
        </article>
      ))}
      {!chat.messages.length && <p>{t("لسه مفيش رسائل.")}</p>}
      {chat.canSend ? (
        <ActionForm
          uploadOrderId={orderId}
          action={sendChat}
          button={t("ابعت الرسالة")}
        >
          <input type="hidden" name="orderId" value={orderId} />
          <ReplyPicker replies={replies} />
          <label className="label">
            {t("الرسالة")}
            <textarea className="input" name="body" required maxLength={2000} />
          </label>
          <label className="label">
            {t("صورة اختيارية (٥ ميجا)")}
            <input
              className="input"
              type="file"
              name="image"
              accept="image/jpeg,image/png,image/webp"
            />
          </label>
        </ActionForm>
      ) : (
        <p>{t("مدة إرسال الرسائل انتهت. تقدر تقرأ المحادثة.")}</p>
      )}
    </section>
  );
}
