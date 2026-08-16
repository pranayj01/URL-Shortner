import crypto from "node:crypto";

const SECRET =
  process.env.BETTER_AUTH_SECRET ||
  process.env.JWT_SECRET ||
  "dev-only-change-me";

export function unlockToken(code) {
  return crypto
    .createHmac("sha256", SECRET)
    .update(`unlock:${code}`)
    .digest("hex");
}

export function unlockCookieName(code) {
  return `sl_${code}`;
}

export function parseCookies(header) {
  const out = {};
  if (!header || typeof header !== "string") return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

export function hasUnlockCookie(req, code) {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[unlockCookieName(code)] === unlockToken(code);
}

export function setUnlockCookie(res, code) {
  const maxAge = 60 * 60 * 24 * 7;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const value = unlockToken(code);
  res.setHeader(
    "Set-Cookie",
    `${unlockCookieName(code)}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`
  );
}
