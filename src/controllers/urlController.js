import {
  createShortUrl,
  findOriginalUrl,
  getUrlStats,
  enqueueClickEvent,
} from "../services/urlService.js";
import redisClient from "../config/redis.js";

function buildShortUrl(shortCode) {
  // Prefer explicit BASE_URL, then Render's public URL, then localhost for local dev.
  const base = (
    process.env.BASE_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    `http://localhost:${process.env.PORT || 3000}`
  ).replace(/\/$/, "");
  return `${base}/${shortCode}`;
}

export async function shortenUrl(req, res, next) {
  try {
    const { originalUrl, expiresAt, customAlias } = req.body;
    const result = await createShortUrl(originalUrl, expiresAt, customAlias);
    res.status(201).json({
      shortCode: result.shortCode,
      shortUrl: buildShortUrl(result.shortCode),
    });
  } catch (error) {
    next(error);
  }
}

export async function redirectUrl(req, res, next) {
  try {
    const { code } = req.params;
    const key = `url:${code}`;

    let cachedUrl = null;

    try {
      if (redisClient?.isReady) {
        cachedUrl = await redisClient.get(key);
      }
    } catch {
      console.error("Redis unavailable");
    }

    if (cachedUrl) {
      // Analytics is enqueued asynchronously; redirect should not wait.
      enqueueClickEvent(code);
      return res.redirect(cachedUrl);
    }

    const urlData = await findOriginalUrl(code);

    if (!urlData) {
      return res.status(404).json({ message: "URL not found" });
    }

    const { originalUrl, expiresAt } = urlData;

    try {
      if (redisClient?.isReady) {
        if (expiresAt) {
          const ttlSeconds = Math.floor(
            (new Date(expiresAt) - new Date()) / 1000
          );

          if (ttlSeconds > 0) {
            await redisClient.setEx(key, ttlSeconds, originalUrl);
          }
        } else {
          await redisClient.set(key, originalUrl);
        }
      }
    } catch {
      console.error("Redis unavailable");
    }

    // Analytics is enqueued asynchronously; redirect should not wait.
    enqueueClickEvent(code);
    return res.redirect(originalUrl);
  } catch (error) {
    next(error);
  }
}

export async function urlStats(req, res, next) {
  try {
    const { code } = req.params;
    const stats = await getUrlStats(code);
    res.json({
      ...stats,
      shortUrl: buildShortUrl(stats.shortCode),
    });
  } catch (error) {
    next(error);
  }
}
