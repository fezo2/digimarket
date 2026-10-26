export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { launchConfig } = await import("./lib/launch-config");
    launchConfig();
  }
}
