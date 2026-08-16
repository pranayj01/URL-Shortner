import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.BETTER_AUTH_SECRET =
  process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET || "test-secret";
process.env.RATE_LIMIT_MAX = "10000";
process.env.START_WORKER = "false";
process.env.REDIS_URL = "";
process.env.NODE_ENV = process.env.NODE_ENV || "test";
if (!process.env.BETTER_AUTH_URL) {
  process.env.BETTER_AUTH_URL = "http://127.0.0.1";
}
if (!process.env.BASE_URL) {
  process.env.BASE_URL = "http://127.0.0.1";
}

const { default: app } = await import("../src/app.js");
const { persistClickEvent } = await import("../src/services/urlService.js");
const { default: prisma } = await import("../src/config/db.js");

let server;
let base;
let dbReady = true;
let cookieJar = "";

function listen(application) {
  return new Promise((resolve, reject) => {
    const s = application.listen(0, "127.0.0.1", () => {
      const address = s.address();
      resolve({ server: s, base: `http://127.0.0.1:${address.port}` });
    });
    s.on("error", reject);
  });
}

function rememberCookies(res) {
  const setCookies =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : [];
  if (!setCookies.length) return;
  const next = new Map(
    cookieJar
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const idx = part.indexOf("=");
        return [part.slice(0, idx), part.slice(idx + 1)];
      })
  );
  for (const raw of setCookies) {
    const pair = raw.split(";")[0];
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    next.set(pair.slice(0, idx), pair.slice(idx + 1));
  }
  cookieJar = [...next.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function json(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (cookieJar) headers.Cookie = cookieJar;
  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${base}${path}`, { ...options, headers });
  rememberCookies(res);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

describe("phase 1 API", () => {
  before(async () => {
    try {
      await Promise.race([
        prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("database ping timeout")), 3000)
        ),
      ]);
    } catch (err) {
      dbReady = false;
      console.log("Skipping API tests; database unavailable:", err.message);
      return;
    }
    process.env.BETTER_AUTH_URL = undefined;
    const started = await listen(app);
    server = started.server;
    base = started.base;
    process.env.BETTER_AUTH_URL = base;
    process.env.BASE_URL = base;
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect().catch(() => {});
  });

  it("registers, shortens, patches, tracks analytics, and deletes", async (t) => {
    if (!dbReady) {
      t.skip("database unavailable");
      return;
    }

    cookieJar = "";
    const email = `phase1-${Date.now()}@example.com`;
    const { res: registerRes, data: registerData } = await json(
      "/api/auth/sign-up/email",
      {
        method: "POST",
        body: JSON.stringify({
          email,
          password: "secret123",
          name: "Phase One",
        }),
      }
    );
    assert.ok(registerRes.status === 200 || registerRes.status === 201);
    assert.ok(registerData.user?.id);
    assert.ok(cookieJar.includes("="));

    const alias = `p1${Date.now().toString(36)}`.slice(0, 12);
    const { res: createRes, data: created } = await json("/api/shorten", {
      method: "POST",
      body: JSON.stringify({
        originalUrl: "https://example.com/phase-1",
        customAlias: alias,
        password: "gate",
      }),
    });
    assert.equal(createRes.status, 201);
    assert.equal(created.shortCode, alias);

    const gated = await fetch(`${base}/${alias}`, {
      redirect: "manual",
      headers: { Accept: "text/html" },
    });
    assert.equal(gated.status, 200);
    const gateHtml = await gated.text();
    assert.match(gateHtml, /locked/i);

    const unlocked = await fetch(`${base}/${alias}`, {
      method: "POST",
      redirect: "manual",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "password=gate",
    });
    assert.equal(unlocked.status, 302);
    assert.equal(unlocked.headers.get("location"), "https://example.com/phase-1");

    await persistClickEvent({
      shortCode: alias,
      clickedAt: new Date().toISOString(),
      country: "US",
      device: "desktop",
      browser: "chrome",
      referrer: "t.co",
      utmSource: "twitter",
    });

    const { res: statsRes, data: stats } = await json(`/api/urls/${alias}`);
    assert.equal(statsRes.status, 200);
    assert.ok(stats.clickCount >= 1);
    assert.equal(stats.hasPassword, true);

    const { data: analytics } = await json(`/api/urls/${alias}/analytics`);
    assert.ok(analytics.countries.some((row) => row.name === "US"));
    assert.ok(analytics.utmSources.some((row) => row.name === "twitter"));

    const qrRes = await fetch(`${base}/${alias}/qr.png`);
    assert.equal(qrRes.status, 200);
    assert.match(qrRes.headers.get("content-type") || "", /image\/png/);
    await qrRes.arrayBuffer();

    const { res: patchRes, data: patched } = await json(`/api/urls/${alias}`, {
      method: "PATCH",
      body: JSON.stringify({ disabled: true, clearPassword: true }),
    });
    assert.equal(patchRes.status, 200);
    assert.equal(patched.disabled, true);
    assert.equal(patched.hasPassword, false);

    const disabled = await fetch(`${base}/${alias}`, {
      redirect: "manual",
      headers: { Accept: "text/html" },
    });
    assert.equal(disabled.status, 410);

    const { data: listed } = await json(
      "/api/urls/mine?q=phase-1&sort=clickCount&order=desc"
    );
    assert.ok(listed.urls.some((row) => row.shortCode === alias));

    const { res: deleteRes } = await json(`/api/urls/${alias}`, {
      method: "DELETE",
    });
    assert.equal(deleteRes.status, 200);

    const missing = await fetch(`${base}/${alias}`, { redirect: "manual" });
    assert.equal(missing.status, 404);
  });
});
