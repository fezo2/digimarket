"use client";
import { useI18n } from "@/components/i18n-provider";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { changeCoupon, payNow } from "./actions";

export function CheckoutForms({
  id,
  coupon,
  locked,
}: {
  id: string;
  coupon: string;
  locked: boolean;
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
      <form action={paymentAction}>
        <button
          className="btn-primary w-full"
          disabled={couponPending || paymentPending}
        >
          {paymentPending ? t("بنجهّز الدفع…") : t("ادفع دلوقتي")}
        </button>
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
