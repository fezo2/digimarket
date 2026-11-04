import { siteOrigins, type Site } from "./sites";

// The public origin of a portal, used to build the provider's redirect URI.
// It must match one of the redirect URIs registered with Google and Apple.
export function portalOrigin(site: Site, requestUrl: string) {
  const origins = siteOrigins();
  if (origins) return origins[site];
  try {
    if (process.env.APP_URL) return new URL(process.env.APP_URL).origin;
  } catch {}
  return new URL(requestUrl).origin;
}
