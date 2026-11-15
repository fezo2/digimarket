import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clampDelay,
  reminderText,
  unsubscribeLinks,
  unsubscribeToken,
  unsubscribeTokenValid,
} from "../src/lib/checkout-reminder-text";

const secret = "s".repeat(40);

test("unsubscribe token only works for its own user and secret", () => {
  const token = unsubscribeToken("user1", secret);
  assert.equal(unsubscribeTokenValid("user1", token, secret), true);
  assert.equal(unsubscribeTokenValid("user2", token, secret), false);
  assert.equal(unsubscribeTokenValid("user1", token, "x".repeat(40)), false);
  assert.equal(unsubscribeTokenValid("user1", token, undefined), false);
  assert.equal(unsubscribeTokenValid("user1", "abc", secret), false);
  assert.equal(unsubscribeTokenValid("", token, secret), false);
});

test("unsubscribe links point at the page and the one-click endpoint", () => {
  const links = unsubscribeLinks("https://digiegy.com", "u1", secret);
  assert.match(links.page, /^https:\/\/digiegy\.com\/unsubscribe\?u=u1&t=[a-f0-9]{64}$/);
  assert.match(links.oneClick, /^https:\/\/digiegy\.com\/api\/unsubscribe\?u=u1&t=[a-f0-9]{64}$/);
});

test("reminder text lists products and the opt-out link", () => {
  const text = reminderText({
    name: "منى",
    products: [{ title: "ChatGPT Plus", url: "https://digiegy.com/products/gpt" }],
    unsubscribeUrl: "https://digiegy.com/unsubscribe?u=1&t=2",
  });
  assert.match(text, /أهلاً منى/);
  assert.match(text, /ChatGPT Plus\n  https:\/\/digiegy\.com\/products\/gpt/);
  assert.match(text, /unsubscribe\?u=1&t=2/);
  assert.doesNotMatch(reminderText({ name: "x", products: [] }), /unsubscribe/);
});

test("reminder delay stays after the 30 minute order expiry", () => {
  assert.equal(clampDelay(5), 35);
  assert.equal(clampDelay(90), 90);
  assert.equal(clampDelay(99999), 1440);
  assert.equal(clampDelay(Number.NaN), 60);
});
