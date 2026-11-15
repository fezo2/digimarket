import { i18n } from "@/lib/prefs";
import { requireAdmin } from "@/lib/auth";
import { ActionForm } from "@/components/action-form";
import { checkoutMethods, kashierConfig, paymentConfig } from "@/lib/payments/config";
import { testKashier } from "./actions";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: (await i18n()).t("بوابة الدفع") };
}

const NAMES: Record<string, string> = {
  manual: "تحويل يدوي (إنستاباي / محفظة)",
  kashier: "كاشير (كارت ومحافظ)",
  paymob: "Paymob",
  test: "دفع تجريبي (للتطوير)",
};

// Shows which way buyers pay today and whether Kashier is ready to switch on.
// Only names and states reach the page, never a key.
export default async function Gateway() {
  const { t } = await i18n();
  await requireAdmin();
  const primary = safe(() => paymentConfig().name);
  const methods = safe(() => checkoutMethods());
  let kashier: ReturnType<typeof kashierConfig> | null = null;
  let problem = "";
  try {
    kashier = kashierConfig();
  } catch (error) {
    problem = error instanceof Error ? error.message : "";
  }
  const base = kashier?.appUrl ?? process.env.APP_URL ?? "https://digiegy.com";
  const has = (name: string) => !!process.env[name]?.trim();
  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold">{t("بوابة الدفع")}</h1>

      <section className="card space-y-2 p-5">
        <h2 className="font-bold">{t("الدفع دلوقتي")}</h2>
        <p>
          {t("وسيلة الدفع الأساسية: ")}
          <b>{primary ? t(NAMES[primary] ?? primary) : t("فيه مشكلة في إعدادات الدفع")}</b>
        </p>
        {methods && (
          <p>
            {t("المشتري بيشوف: ")}
            {methods.map((m) => t(NAMES[m] ?? m)).join(t(" + "))}
          </p>
        )}
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-bold">{t("كاشير")}</h2>
        <ul className="space-y-1 text-sm">
          <Check ok={has("KASHIER_MERCHANT_ID")} label="KASHIER_MERCHANT_ID" />
          <Check ok={has("KASHIER_API_KEY")} label="KASHIER_API_KEY" />
          <Check ok={has("KASHIER_SECRET_KEY")} label="KASHIER_SECRET_KEY" />
          <li>
            KASHIER_MODE: <b dir="ltr">{kashier?.mode ?? process.env.KASHIER_MODE ?? "test"}</b>{" "}
            {(kashier?.mode ?? "test") === "test"
              ? t("(تجريبي: كروت الاختبار بس، مفيش فلوس حقيقية)")
              : t("(حقيقي: فلوس حقيقية)")}
          </li>
        </ul>
        {kashier ? (
          <>
            <p className="text-emerald-700">
              {primary === "kashier"
                ? t("كاشير شغال والمشترين بيدفعوا بيه.")
                : t("المفاتيح جاهزة. انت كأدمن هتلاقي زرار كاشير في صفحة الدفع عشان تجرّب، والمشترين لسه بيشوفوا التحويل اليدوي بس. لما تخلص التجربة غيّر PAYMENT_PROVIDER لـ kashier.")}
            </p>
            <ActionForm action={testKashier} button={t("اختبر الاتصال بكاشير")} />
          </>
        ) : (
          <p className="text-amber-800">
            {t("كاشير لسه مش متظبط: ")}
            <span dir="ltr">{problem}</span>
          </p>
        )}
        <div className="space-y-1 text-sm">
          <p>{t("الروابط دي بتتبعت لكاشير تلقائيًا مع كل عملية دفع. لو لوحة كاشير طلبت رابط Webhook حط ده:")}</p>
          <p dir="ltr" className="rounded bg-slate-100 p-2 font-mono dark:bg-slate-800">{base}/api/payments/kashier/webhook</p>
        </div>
      </section>
    </div>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li dir="ltr" className="text-start">
      {ok ? "✅" : "❌"} {label}
    </li>
  );
}

function safe<T>(read: () => T): T | null {
  try {
    return read();
  } catch {
    return null;
  }
}
