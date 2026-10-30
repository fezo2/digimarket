export function paymentConfig(env: NodeJS.ProcessEnv = process.env) {
  const name =
    env.PAYMENT_PROVIDER ?? (env.NODE_ENV === "production" ? "paymob" : "test");
  if (
    name !== "test" &&
    name !== "paymob" &&
    name !== "manual" &&
    name !== "kashier"
  )
    throw new Error("Invalid PAYMENT_PROVIDER");
  if (name === "manual") return manualConfig(env);
  if (name === "kashier") return kashierConfig(env);
  if (name === "test") {
    if (env.NODE_ENV === "production")
      throw new Error("The test payment provider is forbidden in production");
    return { name } as const;
  }
  const {
    PAYMOB_SECRET_KEY: secret,
    PAYMOB_PUBLIC_KEY: publicKey,
    PAYMOB_HMAC_SECRET: hmacSecret,
    APP_URL: appUrl,
  } = env;
  const integrationIds = (env.PAYMOB_INTEGRATION_IDS ?? "")
    .split(",")
    .map((s) => Number(s.trim()));
  if (
    !secret ||
    !publicKey ||
    !hmacSecret ||
    !appUrl ||
    !integrationIds.length ||
    integrationIds.some((id) => !Number.isSafeInteger(id) || id <= 0)
  )
    throw new Error("Paymob configuration is incomplete");
  const url = new URL(appUrl);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (env.NODE_ENV === "production" && url.protocol !== "https:")
  )
    throw new Error("APP_URL must be HTTPS in production");
  return {
    name,
    secret,
    publicKey,
    hmacSecret,
    integrationIds,
    appUrl: url.origin,
  } as const;
}

// Card gateways take cards and wallets online; manual payments are transfers.
export function takesCards(env: NodeJS.ProcessEnv = process.env) {
  return env.PAYMENT_PROVIDER === "kashier" || env.PAYMENT_PROVIDER === "paymob";
}

// Kashier: hosted payment sessions. The Payment API Key signs and verifies
// (order hash, redirects, webhooks); the Secret Key authorizes API calls.
export function kashierConfig(env: NodeJS.ProcessEnv = process.env) {
  const merchantId = env.KASHIER_MERCHANT_ID?.trim() || "";
  const apiKey = env.KASHIER_API_KEY?.trim() || "";
  const secretKey = env.KASHIER_SECRET_KEY?.trim() || "";
  const mode = (env.KASHIER_MODE?.trim() || "test") as string;
  if (!/^MID-[A-Za-z0-9]+-[A-Za-z0-9]+$/.test(merchantId))
    throw new Error("KASHIER_MERCHANT_ID must look like MID-123-456");
  if (!apiKey || !secretKey)
    throw new Error("Kashier configuration is incomplete");
  if (mode !== "test" && mode !== "live")
    throw new Error("KASHIER_MODE must be test or live");
  return {
    name: "kashier",
    merchantId,
    apiKey,
    secretKey,
    mode,
    appUrl: appOrigin(env),
  } as const;
}

function appOrigin(env: NodeJS.ProcessEnv) {
  if (!env.APP_URL) throw new Error("APP_URL is required");
  const url = new URL(env.APP_URL);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (env.NODE_ENV === "production" && url.protocol !== "https:")
  )
    throw new Error("APP_URL must be HTTPS in production");
  return url.origin;
}

// Buyers transfer by hand to these accounts; an admin confirms each transfer.
export function manualConfig(env: NodeJS.ProcessEnv = process.env) {
  const instapay = env.MANUAL_INSTAPAY?.trim() || "";
  const wallet = env.MANUAL_WALLET?.trim() || "";
  if (!instapay && !wallet)
    throw new Error("Manual payments need MANUAL_INSTAPAY or MANUAL_WALLET");
  if (
    instapay &&
    !/^([A-Za-z0-9._-]+@instapay|01[0125]\d{8})$/.test(instapay)
  )
    throw new Error("Invalid MANUAL_INSTAPAY");
  if (wallet && !/^01[0125]\d{8}$/.test(wallet))
    throw new Error("Invalid MANUAL_WALLET");
  return { name: "manual", instapay, wallet } as const;
}
