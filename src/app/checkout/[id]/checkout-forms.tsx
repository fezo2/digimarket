"use client";
import { useI18n } from "@/components/i18n-provider";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cancelOrder, changeCoupon, payNow } from "./actions";

const METHOD_LABELS: Record<string, { title: string; hint: string }> = {
  kashier: { title: "ادفع بالكارت أو المحفظة", hint: "فيزا، ماستركارد، ميزة أو محفظة موبايل. الكود بيوصلك فورًا." },
  manual: { title: "تحويل إنستاباي أو محفظة", hint: "بتحوّل بنفسك والإدارة بتأكد التحويل قبل التسليم." },
};

export function CheckoutForms({
  id,
  coupon,
  locked,
  methods = [],
}: {
  id: string;
  coupon: string;
  locked: boolean;
  // Two or more means the buyer picks; one (or none) keeps the single button.
  methods?: string[];
}) {
  const { t } = useI18n();
  const [couponState, couponAction, couponPending] = useActionState(
    changeCoupon.bind(null, id),
    undefined,
  );
  const [paymentState, paymentAction, paymentPending] = useActionState(
    payNow.bind(null, id),
    undefined,
  );
  return (
    <div className="space-y-5">
      <form action={couponAction} className="space-y-3">
        <label className="label" htmlFor="code">
          {t("كود الخصم (امسحه لو عايز تشيله)")}
        </label>
        <input
          id="code"
          name="code"
          className="input"
          defaultValue={coupon}
          maxLength={100}
          disabled={locked}
          readOnly={couponPending || paymentPending}
        />
        <button
          className="btn-outline"
          disabled={locked || couponPending || paymentPending}
        >
          {t("تطبيق الكوبون")}
        </button>
        {locked && (
          <p className="text-sm text-slate-500">
            {t("الكوبون بيتحدد قبل بدء الدفع.")}
          </p>
        )}
        {couponState?.error && (
          <p role="alert" className="text-red-700">
            {t(couponState.error)}
          </p>
        )}
      </form>
      <form action={paymentAction} className="space-y-3">
        {methods.length > 1 ? (
          methods.map((m, i) => (
            <button
              key={m}
              name="method"
              value={m}
              className={`${i === 0 ? "btn-primary" : "btn-outline"} flex w-full flex-col items-center gap-0.5 py-3`}
              disabled={couponPending || paymentPending}
            >
              <span>{paymentPending ? t("بنجهّز الدفع…") : t(METHOD_LABELS[m]?.title ?? "ادفع دلوقتي")}</span>
              {METHOD_LABELS[m] && <span className="text-xs font-normal opacity-80">{t(METHOD_LABELS[m].hint)}</span>}
            </button>
          ))
        ) : (
          <button
            name="method"
            value={methods[0] ?? ""}
            className="btn-primary w-full"
            disabled={couponPending || paymentPending}
          >
            {paymentPending ? t("بنجهّز الدفع…") : t("ادفع دلوقتي")}
          </button>
        )}
        {paymentState?.error && (
          <p role="alert" className="text-red-700">
            {t(paymentState.error)}
          </p>
        )}
      </form>
    </div>
  );
}

export function Countdown({ expiresAt }: { expiresAt: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      const seconds = Math.max(
        0,
        Math.ceil((Date.parse(expiresAt) - Date.now()) / 1000),
      );
      setRemaining(seconds);
      return seconds;
    };
    tick();
    const timer = setInterval(() => {
      if (tick() === 0) {
        clearInterval(timer);
        router.refresh();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, router]);
  return (
    <p className="rounded-xl bg-amber-50 p-3">
      {t("المخزون محجوز لمدة:")}{" "}
      {remaining === null
        ? "…"
        : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`}
    </p>
  );
}

// Gives up an unpaid order so its reserved codes go back on sale now.
export function CancelOrderButton({ id }: { id: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(cancelOrder.bind(null, id), undefined);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(t("متأكد إنك عايز تلغي الطلب ده؟"))) e.preventDefault();
      }}
      className="space-y-1"
    >
      <button disabled={pending} className="text-sm font-semibold text-red-600 hover:underline disabled:opacity-50">
        {pending ? t("بنلغي الطلب…") : t("إلغاء الطلب")}
      </button>
      {state?.error && <p className="text-sm text-red-700">{t(state.error)}</p>}
    </form>
  );
}
