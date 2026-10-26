"use client";
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
          كود الخصم (امسحه لو عايز تشيله)
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
          تطبيق الكوبون
        </button>
        {locked && (
          <p className="text-sm text-slate-500">
            الكوبون بيتحدد قبل بدء الدفع.
          </p>
        )}
        {couponState?.error && (
          <p role="alert" className="text-red-700">
            {couponState.error}
          </p>
        )}
      </form>
      <form action={paymentAction}>
        <button
          className="btn-primary w-full"
          disabled={couponPending || paymentPending}
        >
          {paymentPending ? "بنجهّز الدفع…" : "ادفع دلوقتي"}
        </button>
        {paymentState?.error && (
          <p role="alert" className="text-red-700">
            {paymentState.error}
          </p>
        )}
      </form>
    </div>
  );
}

export function Countdown({ expiresAt }: { expiresAt: string }) {
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
      المخزون محجوز لمدة:{" "}
      {remaining === null
        ? "…"
        : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`}
    </p>
  );
}
