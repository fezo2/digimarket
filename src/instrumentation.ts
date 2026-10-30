import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { launchConfig } = await import("./lib/launch-config");
    launchConfig();
  }
}

// Every server error lands in the Vercel logs with the digest the user sees,
// so a "Ref" from a screenshot can be looked up. Query strings are dropped:
// they can carry reset tokens or payment references.
export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context,
) => {
  const e = error as Error & { digest?: string };
  console.error(
    JSON.stringify({
      level: "error",
      digest: e.digest,
      message: e.message,
      stack: e.stack,
      method: request.method,
      path: request.path.split("?")[0],
      route: context.routePath,
      kind: context.routeType,
    }),
  );
};
