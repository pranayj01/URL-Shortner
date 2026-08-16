import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseUserAgent } from "../src/utils/userAgent.js";
import { extractClickMeta } from "../src/utils/clickMeta.js";
import { validateUrl, validateUrlPatch } from "../src/middleware/validateUrl.js";

describe("parseUserAgent", () => {
  it("detects mobile chrome", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1";
    assert.deepEqual(parseUserAgent(ua), { device: "mobile", browser: "chrome" });
  });

  it("detects desktop firefox", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0";
    assert.deepEqual(parseUserAgent(ua), { device: "desktop", browser: "firefox" });
  });
});

describe("extractClickMeta", () => {
  it("reads country, UTMs, referrer host, and IP", () => {
    const meta = extractClickMeta({
      headers: {
        "cf-ipcountry": "in",
        "x-forwarded-for": "203.0.113.10, 10.0.0.1",
        "user-agent": "Mozilla/5.0 Firefox/121.0",
        referer: "https://news.example.com/path",
      },
      query: { utm_source: "twitter", utm_medium: "social", utm_campaign: "launch" },
      get(name) {
        if (name === "user-agent") return this.headers["user-agent"];
        if (name === "referer") return this.headers.referer;
        return undefined;
      },
    });
    assert.equal(meta.country, "IN");
    assert.equal(meta.ipAddress, "203.0.113.10");
    assert.equal(meta.browser, "firefox");
    assert.equal(meta.referrer, "news.example.com");
    assert.equal(meta.utmSource, "twitter");
    assert.equal(meta.utmMedium, "social");
    assert.equal(meta.utmCampaign, "launch");
  });
});

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe("validateUrl", () => {
  it("rejects reserved aliases", () => {
    const req = { body: { originalUrl: "https://example.com", customAlias: "api" } };
    const res = mockRes();
    let nextCalled = false;
    validateUrl(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /reserved/i);
  });

  it("prefixes https when missing", () => {
    const req = { body: { originalUrl: "example.com/x" } };
    const res = mockRes();
    validateUrl(req, res, () => {});
    assert.equal(req.body.originalUrl, "https://example.com/x");
  });
});

describe("validateUrlPatch", () => {
  it("allows clearing expiry", () => {
    const req = { body: { expiresAt: null } };
    const res = mockRes();
    let nextCalled = false;
    validateUrlPatch(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    assert.equal(req.body.expiresAt, null);
  });
});
