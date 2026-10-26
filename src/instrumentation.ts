export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { paymentConfig } = await import("./lib/payments/config");
    paymentConfig();
  }
}
