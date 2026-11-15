// Shared by the browser tracker and the server: no server-only imports.

// Random id the storefront gives each browser, so a visitor counts once per
// product per day. Readable by the page script on purpose; it holds nothing
// but the random id.
export const VISITOR_COOKIE = "dm_vid";

export function validVisitorId(value: string | null | undefined): value is string {
  return Boolean(value && /^[A-Za-z0-9_-]{16,40}$/.test(value));
}

// Crawlers, link previews, uptime checks and scripts. Most of them never run
// the page's JavaScript anyway; this catches the ones that do or that post
// to the endpoint directly.
const BOT =
  /bot|crawl|spider|slurp|scrape|facebookexternalhit|embedly|preview|headless|phantom|puppeteer|playwright|selenium|lighthouse|pagespeed|pingdom|uptime|monitor|python|curl|wget|httpclient|okhttp|axios|node-fetch|undici|go-http|java\/|libwww|feedfetcher|^whatsapp/i;

export function isBotAgent(agent: string | null | undefined) {
  return !agent || agent.length < 20 || BOT.test(agent);
}
