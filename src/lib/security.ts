import { createHash, timingSafeEqual } from "node:crypto";
export function secretMatches(
  actual: string | null,
  expected: string | undefined,
) {
  if (!actual || !expected) return false;
  return timingSafeEqual(
    createHash("sha256").update(actual).digest(),
    createHash("sha256").update(expected).digest(),
  );
}
export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export function securityHeaders(env: NodeJS.ProcessEnv = process.env) {
  const production = env.NODE_ENV === "production";
  const r2 = /^[a-zA-Z0-9]+$/.test(env.R2_ACCOUNT_ID || "")
    ? "https://" + env.R2_ACCOUNT_ID + ".r2.cloudflarestorage.com"
    : "";
  return {
    ...(production
      ? {
          "Strict-Transport-Security":
            "max-age=63072000; includeSubDomains; preload",
        }
      : {}),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self' 'unsafe-inline' " +
      (production ? "" : "'unsafe-eval'") +
      "; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: " +
      r2 +
      "; connect-src 'self' " +
      r2 +
      "; frame-src https://accept.paymob.com; form-action 'self' https://accept.paymob.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  };
}
