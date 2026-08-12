import {
  createShortUrl,
  findOriginalUrl,
  getUrlStatsForOwner,
  listUrlsForUser,
  enqueueClickEvent,
} from "../services/urlService.js";
import redisClient from "../config/redis.js";

function buildShortUrl(shortCode) {
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
    const result = await createShortUrl(
      originalUrl,
      expiresAt,
      customAlias,
      req.user.id
    );
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

    enqueueClickEvent(code);
    return res.redirect(originalUrl);
  } catch (error) {
    next(error);
  }
}

export async function urlStats(req, res, next) {
  try {
    let { code } = req.params;

    if (code.includes("/")) {
      const parts = code.split("/").filter(Boolean);
      code = parts[parts.length - 1];
    }

    const stats = await getUrlStatsForOwner(code, req.user.id);
    res.json({
      ...stats,
      shortUrl: buildShortUrl(stats.shortCode),
    });
  } catch (error) {
    next(error);
  }
}

export async function myUrls(req, res, next) {
  try {
    const urls = await listUrlsForUser(req.user.id);
    res.json({
      urls: urls.map((u) => ({
        ...u,
        shortUrl: buildShortUrl(u.shortCode),
      })),
    });
  } catch (error) {
    next(error);
  }
}
