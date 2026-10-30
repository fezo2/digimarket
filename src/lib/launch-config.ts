import { paymentConfig } from "./payments/config";
export function launchConfig(env: NodeJS.ProcessEnv = process.env) {
  const driver = env.STORAGE_DRIVER || "local";
  if (!["local", "r2"].includes(driver))
    throw new Error("Invalid STORAGE_DRIVER");
  const r2 = {
    account: env.R2_ACCOUNT_ID || "",
    access: env.R2_ACCESS_KEY_ID || "",
    secret: env.R2_SECRET_ACCESS_KEY || "",
    bucket: env.R2_BUCKET || "",
  };
  if (
    driver === "r2" &&
    (!/^[a-zA-Z0-9]+$/.test(r2.account) ||
      !r2.access ||
      !r2.secret ||
      !r2.bucket)
  )
    throw new Error("Incomplete R2 configuration");
  const telegram = [
    env.TELEGRAM_BOT_TOKEN,
    env.TELEGRAM_BOT_USERNAME,
    env.TELEGRAM_WEBHOOK_SECRET,
  ];
  if (telegram.some(Boolean) && !telegram.every(Boolean))
    throw new Error("Incomplete Telegram configuration");
  if (
    env.TELEGRAM_BOT_USERNAME &&
    !/^[a-zA-Z0-9_]+$/.test(env.TELEGRAM_BOT_USERNAME)
  )
    throw new Error("Invalid bot username");
  if (!!env.TURNSTILE_SECRET_KEY !== !!env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)
    throw new Error("Set both Turnstile keys, or neither");
  if (env.NODE_ENV === "production" && !env.TURNSTILE_SECRET_KEY)
    console.warn("Turnstile is off: sign-in forms have no captcha");
  if (!!env.RESEND_API_KEY !== !!env.EMAIL_FROM)
    throw new Error("Incomplete email configuration");
  if (env.NODE_ENV === "production") {
    if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32)
      throw new Error("AUTH_SECRET must be at least 32 characters");
    const url = new URL(env.APP_URL || "");
    if (url.protocol !== "https:" || url.username || url.password)
      throw new Error("APP_URL must be HTTPS");
    for (const key of ["SELLER_URL", "ADMIN_URL"] as const) {
      if (!env[key]) continue;
      const portal = new URL(env[key]);
      if (portal.protocol !== "https:" || portal.username || portal.password)
        throw new Error(key + " must be HTTPS");
    }
    if (!!env.SELLER_URL !== !!env.ADMIN_URL)
      throw new Error("Set both SELLER_URL and ADMIN_URL, or neither");
    if (driver !== "r2" || !env.CRON_SECRET)
      throw new Error("Production requires R2 and CRON_SECRET");
    if (!env.DATABASE_URL || !env.DIRECT_URL)
      throw new Error("Database URLs required");
  }
  paymentConfig(env);
  return {
    driver,
    r2,
    telegram: telegram.every(Boolean),
    email: !!env.RESEND_API_KEY,
  };
}
