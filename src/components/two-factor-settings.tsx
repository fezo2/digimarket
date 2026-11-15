"use client";
import { useActionState, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import {
  beginTwoFactor,
  finishTwoFactor,
  renewBackupCodes,
  turnOffTwoFactor,
  type TwoFactorState,
} from "@/app/(auth)/two-factor-actions";

function Messages({ state }: { state: TwoFactorState }) {
  const { t } = useI18n();
  return (
    <>
      {state.error && <p role="alert" className="text-sm text-red-700">{t(state.error)}</p>}
      {state.success && <p role="status" className="text-sm text-green-700">{t(state.success)}</p>}
    </>
  );
}

function CodeInput({ label }: { label: string }) {
  return (
    <label className="label">
      {label}
      <input
        className="input text-center tracking-widest"
        name="code"
        required
        maxLength={20}
        autoComplete="one-time-code"
        dir="ltr"
      />
    </label>
  );
}

function BackupCodes({ codes }: { codes: string[] }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
      <p className="text-sm font-semibold">
        {t("احفظ الأكواد دي في مكان آمن. كل كود بيشتغل مرة واحدة لو موبايلك ضاع، ومش هتظهر تاني.")}
      </p>
      <ul className="grid grid-cols-2 gap-1 font-mono text-sm" dir="ltr">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <button
        type="button"
        className="btn-outline text-sm"
        onClick={() => {
          navigator.clipboard?.writeText(codes.join("\n")).then(() => setCopied(true), () => {});
        }}
      >
        {copied ? t("اتنسخت") : t("انسخ الأكواد")}
      </button>
    </div>
  );
}

export function TwoFactorSettings({ enabled }: { enabled: boolean }) {
  const { t } = useI18n();
  const [started, start, starting] = useActionState<TwoFactorState>(beginTwoFactor, {});
  const [confirmed, confirm, confirming] = useActionState(finishTwoFactor, {});
  const [off, turnOff, turningOff] = useActionState(turnOffTwoFactor, {});
  const [renewed, renew, renewing] = useActionState(renewBackupCodes, {});

  if (confirmed.codes)
    return (
      <div className="space-y-3">
        <Messages state={confirmed} />
        <BackupCodes codes={confirmed.codes} />
      </div>
    );

  if (!enabled) {
    const setup = confirmed.setup ?? started.setup;
    if (!setup)
      return (
        <form action={start} className="space-y-3">
          <Messages state={started.error ? started : off} />
          <button className="btn-primary" disabled={starting}>
            {starting ? t("لحظة…") : t("فعّل التحقق بخطوتين")}
          </button>
        </form>
      );
    return (
      <div className="space-y-4">
        <ol className="list-decimal space-y-1 ps-5 text-sm text-slate-700">
          <li>{t("نزّل تطبيق مصادقة زي Google Authenticator أو Microsoft Authenticator.")}</li>
          <li>{t("امسح الكود ده من التطبيق، أو اكتب المفتاح بإيدك.")}</li>
          <li>{t("اكتب الكود اللي ظهر في التطبيق عشان نتأكد.")}</li>
        </ol>
        <div
          className="size-48 rounded-xl bg-white p-2"
          aria-label={t("كود QR لتطبيق المصادقة")}
          role="img"
          dangerouslySetInnerHTML={{ __html: setup.qr }}
        />
        <p className="text-sm">
          {t("المفتاح:")}{" "}
          <code className="break-all rounded bg-slate-100 px-2 py-1 font-mono" dir="ltr">
            {setup.secret.match(/.{1,4}/g)?.join(" ")}
          </code>
        </p>
        <form action={confirm} className="space-y-3">
          <label className="label">
            {t("كود التطبيق")}
            <input
              className="input text-center text-xl tracking-[0.4em]"
              name="code"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]{6,7}"
              maxLength={7}
              dir="ltr"
            />
          </label>
          <Messages state={confirmed} />
          <button className="btn-primary" disabled={confirming}>
            {confirming ? t("لحظة…") : t("تأكيد وتفعيل")}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {renewed.codes && <BackupCodes codes={renewed.codes} />}
      <details className="rounded-xl border border-slate-200 p-4">
        <summary className="cursor-pointer text-sm font-semibold">{t("أكواد احتياطية جديدة")}</summary>
        <form action={renew} className="mt-3 space-y-3">
          <CodeInput label={t("كود التطبيق أو كود احتياطي")} />
          <Messages state={renewed.codes ? {} : renewed} />
          <button className="btn-outline" disabled={renewing}>
            {renewing ? t("لحظة…") : t("اعمل أكواد جديدة")}
          </button>
        </form>
      </details>
      <details className="rounded-xl border border-slate-200 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-red-700">{t("إيقاف التحقق بخطوتين")}</summary>
        <form action={turnOff} className="mt-3 space-y-3">
          <CodeInput label={t("كود التطبيق أو كود احتياطي")} />
          <Messages state={off} />
          <button className="btn-danger" disabled={turningOff}>
            {turningOff ? t("لحظة…") : t("إيقاف")}
          </button>
        </form>
      </details>
    </div>
  );
}
