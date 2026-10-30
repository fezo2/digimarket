import "server-only";
import { headers } from "next/headers";

// Cloudflare Turnstile. Off until both keys are set (see launch-config), so
// local development and tests work without it.
export function captchaEnabled(env: NodeJS.ProcessEnv = process.env) {
  return !!env.TURNSTILE_SECRET_KEY && !!env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
}

export const CAPTCHA_ERROR = "أكّد إنك مش روبوت وجرّب تاني";

export async function captchaPassed(form: FormData) {
  if (!captchaEnabled()) return true;
  const token = form.get("cf-turnstile-response");
  if (typeof token !== "string" || !token || token.length > 2048) return false;
  const body = new URLSearchParams({
    secret: process.env.TURNSTILE_SECRET_KEY!,
    response: token,
  });
  const ip = await clientIp();
  if (ip !== "unknown") body.set("remoteip", ip);
  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body, signal: AbortSignal.timeout(8000) },
    );
    const result = (await res.json()) as { success?: boolean };
    return result.success === true;
  } catch (error) {
    // Fail closed: a form behind the captcha stays shut if Cloudflare is down.
    console.error("Turnstile verification failed", error);
    return false;
  }
}

export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim().slice(0, 100) || "unknown";
}
