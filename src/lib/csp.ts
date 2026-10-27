// Edge-safe: imported by the middleware, so no Node built-ins here.

// Set per request by the middleware: only scripts carrying this request's
// nonce (Next adds it to its own) run, so an injected <script> does not.
export function contentSecurityPolicy(
  nonce: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  const dev = env.NODE_ENV !== "production";
  const r2 = /^[a-zA-Z0-9]+$/.test(env.R2_ACCOUNT_ID || "")
    ? " https://" + env.R2_ACCOUNT_ID + ".r2.cloudflarestorage.com"
    : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    `img-src 'self' data: blob:${r2}`,
    `connect-src 'self'${r2}`,
    "frame-src https://accept.paymob.com",
    "form-action 'self' https://accept.paymob.com",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}
