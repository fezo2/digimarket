import "server-only";
import { siteForHost, siteOrigins } from "./sites";

// With the portals split, admin powers come only from a session on the admin
// host, whose password is separate. An admin signed in to the store (with the
// store password or Google) is an ordinary shopper there: admin server
// actions and admin-only APIs posted to the store host are refused.
export async function onAdminPortal() {
  if (!siteOrigins()) return true;
  let host: string | null;
  try {
    const { headers } = await import("next/headers");
    host = (await headers()).get("host");
  } catch {
    // Outside a request (jobs, scripts) there is no portal to check.
    return true;
  }
  return siteForHost(host) === "admin";
}
