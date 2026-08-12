const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000;
const MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX) || 100;

const hits = new Map();

function prune(now) {
  for (const [key, entry] of hits) {
    if (now - entry.windowStart >= WINDOW_MS) {
      hits.delete(key);
    }
  }
}

function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || "unknown";
}

/**
 * IP-based rate limiter. Identity is the client IP only — not the URL path.
 * Apply before any Redis/Postgres access on routes that hit those stores.
 */
export function rateLimit(req, res, next) {
  const now = Date.now();
  prune(now);

  const key = clientIp(req);
  let entry = hits.get(key);

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    entry = { windowStart: now, count: 0 };
    hits.set(key, entry);
  }

  entry.count += 1;

  const remaining = Math.max(0, MAX_REQUESTS - entry.count);
  res.setHeader("X-RateLimit-Limit", String(MAX_REQUESTS));
  res.setHeader("X-RateLimit-Remaining", String(remaining));

  if (entry.count > MAX_REQUESTS) {
    return res.status(429).json({
      message: "Too many requests. Try again later.",
    });
  }

  next();
}
