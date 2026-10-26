"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function CopyCode({ code }: { code: string }) {
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
            setMessage("اتنسخ");
          } catch {
            setMessage("حدد الكود وانسخه يدويًا");
          }
        }}
      >
        نسخ الكود
      </button>
      <span role="status" className="ms-2 text-sm">
        {message}
      </span>
    </div>
  );
}

export function PaymentPolling() {
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
        {finished ? "التأكيد لسه موصلش. ارجع للطلب بعد شوية." : "بنأكد الدفع…"}
      </p>
      {finished && (
        <button className="btn-outline" onClick={() => router.refresh()}>
          تحديث حالة الطلب
        </button>
      )}
    </div>
  );
}
