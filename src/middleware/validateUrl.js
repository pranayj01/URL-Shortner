import { normalizeUtmInput } from "../utils/utm.js";

const ALIAS_PATTERN = /^[a-zA-Z0-9_-]{3,32}$/;
const RESERVED_ALIASES = new Set([
  "api",
  "health",
  "assets",
  "favicon.ico",
  "robots.txt",
]);

function normalizeOriginalUrl(url) {
  if (!url || typeof url !== "string") {
    return { error: "originalUrl is required" };
  }
  let next = url.trim();
  if (!next.startsWith("http://") && !next.startsWith("https://")) {
    next = "https://" + next;
  }
  try {
    new URL(next);
    return { url: next };
  } catch {
    return { error: "Invalid URL" };
  }
}

function normalizeAlias(customAlias) {
  if (customAlias === undefined || customAlias === null || customAlias === "") {
    return { alias: undefined };
  }
  if (typeof customAlias !== "string" || !ALIAS_PATTERN.test(customAlias)) {
    return {
      error: "customAlias must be 3–32 characters (letters, numbers, _ or -)",
    };
  }
  if (RESERVED_ALIASES.has(customAlias.toLowerCase())) {
    return { error: "That alias is reserved" };
  }
  return { alias: customAlias };
}

function normalizeExpiresAt(expiresAt, { allowNull = false } = {}) {
  if (expiresAt === undefined) return { expiresAt: undefined };
  if (allowNull && (expiresAt === null || expiresAt === "")) {
    return { expiresAt: null };
  }
  if (expiresAt === null || expiresAt === "") {
    return { expiresAt: undefined };
  }
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) {
    return { error: "expiresAt must be a valid date" };
  }
  if (date <= new Date()) {
    return { error: "expiresAt must be in the future" };
  }
  return { expiresAt: date };
}

function normalizeTags(tags) {
  if (tags === undefined) return undefined;
  if (!Array.isArray(tags)) {
    if (typeof tags === "string") {
      return tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 20);
    }
    return { error: "tags must be an array or comma-separated string" };
  }
  return tags
    .map((t) => String(t || "").trim())
    .filter(Boolean)
    .slice(0, 20);
}

function normalizeOgFields(body) {
  const out = {};
  for (const key of ["ogTitle", "ogDescription", "ogImage"]) {
    if (body[key] === undefined) continue;
    if (body[key] === null || body[key] === "") {
      out[key] = null;
      continue;
    }
    if (typeof body[key] !== "string") {
      return { error: `${key} must be a string` };
    }
    out[key] = body[key].trim();
  }
  if (out.ogImage) {
    try {
      const parsed = new URL(out.ogImage);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { error: "ogImage must be an http(s) URL" };
      }
    } catch {
      return { error: "ogImage must be a valid URL" };
    }
  }
  return out;
}

export function validateUrl(req, res, next) {
  const parsedUrl = normalizeOriginalUrl(req.body.originalUrl);
  if (parsedUrl.error) {
    return res.status(400).json({ message: parsedUrl.error });
  }
  req.body.originalUrl = parsedUrl.url;

  const parsedAlias = normalizeAlias(req.body.customAlias);
  if (parsedAlias.error) {
    return res.status(400).json({ message: parsedAlias.error });
  }
  req.body.customAlias = parsedAlias.alias;

  const parsedExpiry = normalizeExpiresAt(req.body.expiresAt);
  if (parsedExpiry.error) {
    return res.status(400).json({ message: parsedExpiry.error });
  }
  req.body.expiresAt = parsedExpiry.expiresAt;

  if (req.body.password !== undefined && req.body.password !== null && req.body.password !== "") {
    if (typeof req.body.password !== "string" || req.body.password.length < 1) {
      return res.status(400).json({ message: "password must be a string" });
    }
  } else {
    req.body.password = undefined;
  }

  if (req.body.disabled !== undefined) {
    req.body.disabled = Boolean(req.body.disabled);
  }

  const utm = normalizeUtmInput(req.body);
  if (utm.error) return res.status(400).json({ message: utm.error });
  req.body.utm = utm;

  const og = normalizeOgFields(req.body);
  if (og.error) return res.status(400).json({ message: og.error });
  Object.assign(req.body, og);

  const tags = normalizeTags(req.body.tags);
  if (tags?.error) return res.status(400).json({ message: tags.error });
  req.body.tags = tags;

  if (req.body.folderId === "" || req.body.folderId === null) {
    req.body.folderId = undefined;
  }

  next();
}

export function validateUrlPatch(req, res, next) {
  const body = req.body || {};

  if (body.originalUrl !== undefined) {
    const parsedUrl = normalizeOriginalUrl(body.originalUrl);
    if (parsedUrl.error) {
      return res.status(400).json({ message: parsedUrl.error });
    }
    req.body.originalUrl = parsedUrl.url;
  }

  if (body.customAlias !== undefined || body.shortCode !== undefined) {
    const parsedAlias = normalizeAlias(body.customAlias ?? body.shortCode);
    if (parsedAlias.error) {
      return res.status(400).json({ message: parsedAlias.error });
    }
    req.body.shortCode = parsedAlias.alias;
  }

  if (body.expiresAt !== undefined) {
    const parsedExpiry = normalizeExpiresAt(body.expiresAt, { allowNull: true });
    if (parsedExpiry.error) {
      return res.status(400).json({ message: parsedExpiry.error });
    }
    req.body.expiresAt = parsedExpiry.expiresAt;
  }

  if (body.disabled !== undefined) {
    req.body.disabled = Boolean(body.disabled);
  }

  if (body.clearPassword) {
    req.body.clearPassword = true;
    req.body.password = undefined;
  } else if (body.password !== undefined && body.password !== "") {
    if (typeof body.password !== "string") {
      return res.status(400).json({ message: "password must be a string" });
    }
  } else {
    req.body.password = undefined;
  }

  const utm = normalizeUtmInput(body);
  if (utm.error) return res.status(400).json({ message: utm.error });
  req.body.utm = utm;

  const og = normalizeOgFields(body);
  if (og.error) return res.status(400).json({ message: og.error });
  Object.assign(req.body, og);

  if (body.tags !== undefined) {
    const tags = normalizeTags(body.tags);
    if (tags?.error) return res.status(400).json({ message: tags.error });
    req.body.tags = tags;
  }

  if (body.folderId === "") req.body.folderId = null;

  next();
}
