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
  return {
    ...(env.NODE_ENV === "production"
      ? {
          "Strict-Transport-Security":
            "max-age=63072000; includeSubDomains; preload",
        }
      : {}),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), usb=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-site",
    "X-DNS-Prefetch-Control": "off",
    "X-Permitted-Cross-Domain-Policies": "none",
  };
}
