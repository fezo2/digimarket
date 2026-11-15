import test from "node:test";
import assert from "node:assert/strict";
import { isBotAgent, validVisitorId } from "../src/lib/visitor";
import { parsePeriod, periodSlots, cairoHour } from "../src/lib/seller-period";

const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

test("bots and scripts are not counted as views", () => {
  assert.equal(isBotAgent(CHROME), false);
  assert.equal(isBotAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 350.0"), false);
  for (const ua of [
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "facebookexternalhit/1.1",
    "WhatsApp/2.23.20.0",
    "curl/8.5.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/130.0 Safari/537.36",
    "",
    null,
  ])
    assert.equal(isBotAgent(ua), true, String(ua));
});

test("visitor ids are short random tokens only", () => {
  assert.equal(validVisitorId("7e976ab00be05046f7892a020ac65acc"), true);
  assert.equal(validVisitorId("short"), false);
  assert.equal(validVisitorId("x'; DROP TABLE--aaaaaaaaaaaaaaa"), false);
  assert.equal(validVisitorId(undefined), false);
});

test("24h period has hourly slots keyed in Cairo time", () => {
  const now = new Date("2026-11-15T03:52:00Z");
  const p = parsePeriod({ p: "24h" }, "7d", now);
  assert.equal(p.bucket, "hour");
  assert.equal(p.from?.toISOString(), "2026-11-14T03:52:00.000Z");
  const slots = periodSlots(p);
  assert.equal(slots.length, 25);
  assert.equal(slots.at(-1)!.key, cairoHour(now));
  assert.equal(cairoHour(new Date("2026-11-14T22:30:00Z")), "2026-11-15 00");
});
