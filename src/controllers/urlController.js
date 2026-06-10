import { createShortUrl, findOriginalUrl } from "../services/urlService.js";
import redisClient from "../config/redis.js";

export async function shortenUrl(req, res, next) {
  try {
    const { originalUrl, expiresAt, customAlias } = req.body;
    const result = await createShortUrl(originalUrl, expiresAt, customAlias);
    res.status(201).json(result);
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
    } catch (err) {
      console.error("Redis unavailable");
    }

    if (cachedUrl) {
      
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
    } catch (err) {
      console.error("Redis unavailable");
    }

    
    
    return res.redirect(originalUrl);
  } catch (error) {
    next(error);
  }
}