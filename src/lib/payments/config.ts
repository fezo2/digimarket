export function paymentConfig(env: NodeJS.ProcessEnv = process.env) {
  const name =
    env.PAYMENT_PROVIDER ?? (env.NODE_ENV === "production" ? "paymob" : "test");
  if (name !== "test" && name !== "paymob")
    throw new Error("Invalid PAYMENT_PROVIDER");
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
