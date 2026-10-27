"use client";
import { useI18n } from "@/components/i18n-provider";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function CopyCode({ code }: { code: string }) {
  const { t } = useI18n();
  const [message, setMessage] = useState("");
  return (
    <div className="space-y-2 rounded-xl border p-4">
      <pre className="whitespace-pre-wrap break-all" dir="auto">
        {code}
      </pre>
      <button
        className="btn-outline"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setMessage(t("اتنسخ"));
          } catch {
            setMessage(t("حدد الكود وانسخه يدويًا"));
          }
        }}
      >
        {t("نسخ الكود")}
      </button>
      <span role="status" className="ms-2 text-sm">
        {message}
      </span>
    </div>
  );
}

export function PaymentPolling() {
  const { t } = useI18n();
  const router = useRouter();
  const [finished, setFinished] = useState(false);
  useEffect(() => {
    let count = 0;
    const timer = setInterval(() => {
      router.refresh();
      if (++count >= 20) {
        clearInterval(timer);
        setFinished(true);
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [router]);
  return (
    <div className="space-y-3">
      <p role="status">
        {finished ? t("التأكيد لسه موصلش. ارجع للطلب بعد شوية.") : t("بنأكد الدفع…")}
      </p>
      {finished && (
        <button className="btn-outline" onClick={() => router.refresh()}>
          {t("تحديث حالة الطلب")}
        </button>
      )}
    </div>
  );
}
