import assert from "node:assert/strict";
import test from "node:test";
import {
  portalHref,
  siteForHost,
  siteForPath,
  siteHref,
  siteOrigins,
} from "../src/lib/sites";

const env = {
  APP_URL: "https://digiegy.com",
  SELLER_URL: "https://seller.digiegy.com",
  ADMIN_URL: "https://admin.digiegy.com/",
};

test("split is off unless all three URLs are set", () => {
  assert.equal(siteOrigins({ APP_URL: env.APP_URL }), null);
  assert.equal(siteOrigins({ ...env, ADMIN_URL: "not a url" }), null);
  assert.equal(siteForHost("seller.digiegy.com", {}), "store");
  assert.equal(siteHref("seller", "/seller/join", {}), "/seller/join");
  assert.equal(portalHref("admin", {}), "/admin");
});

test("hosts map to their portal", () => {
  assert.equal(siteForHost("seller.digiegy.com", env), "seller");
  assert.equal(siteForHost("ADMIN.digiegy.com", env), "admin");
  assert.equal(siteForHost("digiegy.com", env), "store");
  assert.equal(siteForHost("www.digiegy.com", env), "store");
  assert.equal(siteForHost(null, env), "store");
  assert.equal(portalHref("admin", env), "https://admin.digiegy.com");
  assert.equal(
    siteHref("seller", "/seller/join", env),
    "https://seller.digiegy.com/seller/join",
  );
});

test("paths belong to one portal or are shared", () => {
  assert.equal(siteForPath("/seller"), "seller");
  assert.equal(siteForPath("/seller/products/x"), "seller");
  assert.equal(siteForPath("/sellers-guide"), "store");
  assert.equal(siteForPath("/admin/users"), "admin");
  assert.equal(siteForPath("/products/abc"), "store");
  assert.equal(siteForPath("/account"), "store");
  assert.equal(siteForPath("/"), "store");
  for (const p of ["/login", "/register", "/api/uploads", "/uploads/a.png", "/_next/data"])
    assert.equal(siteForPath(p), null);
});
