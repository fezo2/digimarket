"use server";
import { requireAdmin } from "@/lib/auth";
import { kashierSettings } from "@/lib/payments/config";
import { kashierApiHost } from "@/lib/payments/kashier";
import type { ActionState } from "@/components/action-form";

// Checks the Secret Key against Kashier's order list without paying for
// anything. The Payment API Key is only checked by real payments.
export async function testKashier(): Promise<ActionState> {
  await requireAdmin();
  const config = kashierSettings();
  if (!config) return { error: "مفاتيح كاشير مش متظبطة في Vercel" };
  try {
    const response = await fetch(
      `${kashierApiHost(config.mode)}/v3/payment/orders?${new URLSearchParams({ search: "digiegy-connection-test" })}`,
      { headers: { Authorization: config.secretKey }, signal: AbortSignal.timeout(15000), cache: "no-store" },
    );
    if (response.ok) return { success: "الاتصال بكاشير شغال والـ Secret Key مقبول" };
    if (response.status === 401 || response.status === 403)
      return {
        error:
          config.mode === "test"
            ? "كاشير رفض الـ Secret Key. اتأكد إنه مفتاح الوضع التجريبي (Test Mode) ومنسوخ كامل"
            : "كاشير رفض الـ Secret Key. اتأكد إنه مفتاح الوضع الحقيقي (Live) ومنسوخ كامل",
      };
    return { error: `كاشير رد برقم ${response.status}، جرّب تاني بعد شوية` };
  } catch {
    return { error: "مقدرناش نوصل لكاشير دلوقتي" };
  }
}
