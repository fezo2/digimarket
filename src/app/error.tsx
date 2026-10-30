"use client";
import { useEffect } from "react";
import { useI18n } from "@/components/i18n-provider";

// Users only see a generic message and a reference; the details stay in the
// server logs (see onRequestError in src/instrumentation.ts).
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") console.error(error);
  }, [error]);
  return (
    <section className="card mx-auto my-12 max-w-md space-y-4 p-6 text-center">
      <h1 className="text-xl font-bold">{t("حصل خطأ، جرّب تاني بعد شوية")}</h1>
      {error.digest && (
        <p className="text-xs text-slate-500" dir="ltr">
          Ref: {error.digest}
        </p>
      )}
      <button className="btn-primary" onClick={reset}>
        {t("جرّب تاني")}
      </button>
    </section>
  );
}
