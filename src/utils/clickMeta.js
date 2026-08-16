import { parseUserAgent } from "./userAgent.js";

function firstHeader(req, names) {
  for (const name of names) {
    const value = req.headers[name];
    if (typeof value === "string" && value.trim() && value !== "XX") {
      return value.trim();
    }
  }
  return null;
}

function queryValue(req, key) {
  const value = req.query?.[key];
  if (Array.isArray(value)) return String(value[0] || "").slice(0, 200) || null;
  if (typeof value === "string" && value.trim()) return value.trim().slice(0, 200);
  return null;
}

export function extractClickMeta(req) {
  const country = firstHeader(req, [
    "cf-ipcountry",
    "x-vercel-ip-country",
    "cloudfront-viewer-country",
    "x-country-code",
  ]);
  const { device, browser } = parseUserAgent(req.get?.("user-agent") || req.headers["user-agent"]);
  const referer = req.get?.("referer") || req.headers.referer;
  let referrer = null;
  if (typeof referer === "string" && referer) {
    try {
      referrer = new URL(referer).hostname.slice(0, 200);
    } catch {
      referrer = referer.slice(0, 200);
    }
  }

  return {
    country: country ? country.toUpperCase().slice(0, 8) : null,
    device,
    browser,
    referrer,
    utmSource: queryValue(req, "utm_source"),
    utmMedium: queryValue(req, "utm_medium"),
    utmCampaign: queryValue(req, "utm_campaign"),
  };
}
