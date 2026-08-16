import bcrypt from "bcryptjs";
import prisma from "../config/db.js";
import { encodeToBase62 } from "../utils/base62.js";
import { AppError } from "../utils/AppError.js";
import redisClient from "../config/redis.js";

const CLICK_QUEUE_KEY = process.env.CLICK_QUEUE_KEY || "clicks:queue";
const CLICK_PROCESSING_KEY =
  process.env.CLICK_PROCESSING_KEY || "clicks:processing";

const URL_PUBLIC_SELECT = {
  id: true,
  shortCode: true,
  originalUrl: true,
  expiresAt: true,
  clickCount: true,
  createdAt: true,
  updatedAt: true,
  disabled: true,
  userId: true,
  passwordHash: true,
};

function cacheKey(code) {
  return `url:${code}`;
}

function toPublicUrl(row) {
  if (!row) return null;
  const { passwordHash, userId, ...rest } = row;
  return {
    ...rest,
    hasPassword: Boolean(passwordHash),
  };
}

export async function invalidateUrlCache(code) {
  if (!code || !redisClient?.isReady) return;
  try {
    await redisClient.del(cacheKey(code));
  } catch {
    console.error("Redis unavailable");
  }
}

async function readCachedUrl(code) {
  if (!redisClient?.isReady) return null;
  try {
    const raw = await redisClient.get(cacheKey(code));
    if (!raw) return null;
    if (raw.startsWith("{")) return JSON.parse(raw);
    return { originalUrl: raw, disabled: false, hasPassword: false };
  } catch {
    return null;
  }
}

async function writeCachedUrl(code, payload, expiresAt) {
  if (!redisClient?.isReady) return;
  if (payload.hasPassword || payload.disabled) return;
  const value = JSON.stringify({
    originalUrl: payload.originalUrl,
    disabled: false,
    hasPassword: false,
  });
  try {
    if (expiresAt) {
      const ttlSeconds = Math.floor((new Date(expiresAt) - new Date()) / 1000);
      if (ttlSeconds > 0) await redisClient.setEx(cacheKey(code), ttlSeconds, value);
    } else {
      await redisClient.set(cacheKey(code), value);
    }
  } catch {
    console.error("Redis unavailable");
  }
}

async function hashLinkPassword(password) {
  if (!password) return null;
  if (typeof password !== "string" || password.length < 1) {
    throw new AppError("Link password must not be empty", 400);
  }
  return bcrypt.hash(password, 10);
}

function mapPrismaError(error) {
  if (error?.code === "P2002") {
    throw new AppError("Custom alias already in use", 409);
  }
  throw error;
}

export async function createShortUrl(
  originalUrl,
  expiresAt,
  customAlias,
  userId,
  { password, disabled } = {}
) {
  const ownerId = userId || null;
  const passwordHash = await hashLinkPassword(password);
  const disabledFlag = Boolean(disabled);

  try {
    if (customAlias) {
      const existing = await prisma.url.findUnique({
        where: { shortCode: customAlias },
      });
      if (existing) {
        throw new AppError("Custom alias already in use", 409);
      }

      await prisma.url.create({
        data: {
          originalUrl,
          expiresAt: expiresAt ?? null,
          shortCode: customAlias,
          userId: ownerId,
          passwordHash,
          disabled: disabledFlag,
        },
      });

      return { shortCode: customAlias };
    }

    const urlEntry = await prisma.$transaction(async (tx) => {
      const row = await tx.url.create({
        data: {
          originalUrl,
          expiresAt: expiresAt ?? null,
          userId: ownerId,
          passwordHash,
          disabled: disabledFlag,
        },
      });
      const code = encodeToBase62(row.id);
      return tx.url.update({
        where: { id: row.id },
        data: { shortCode: code },
      });
    });

    return { shortCode: urlEntry.shortCode };
  } catch (error) {
    mapPrismaError(error);
  }
}

export async function findOriginalUrl(code) {
  const cached = await readCachedUrl(code);
  if (cached?.originalUrl && !cached.hasPassword && !cached.disabled) {
    return {
      originalUrl: cached.originalUrl,
      expiresAt: null,
      disabled: false,
      hasPassword: false,
      passwordHash: null,
      fromCache: true,
    };
  }

  const urlEntry = await prisma.url.findUnique({
    where: { shortCode: code },
  });

  if (!urlEntry) {
    return null;
  }

  if (urlEntry.expiresAt && urlEntry.expiresAt < new Date()) {
    throw new AppError("URL has expired", 410);
  }

  return {
    originalUrl: urlEntry.originalUrl,
    expiresAt: urlEntry.expiresAt,
    disabled: urlEntry.disabled,
    hasPassword: Boolean(urlEntry.passwordHash),
    passwordHash: urlEntry.passwordHash,
    fromCache: false,
  };
}

export async function cachePublicRedirect(code, urlData) {
  if (!urlData || urlData.disabled || urlData.hasPassword) return;
  await writeCachedUrl(code, urlData, urlData.expiresAt);
}

async function requireOwnedUrl(code, userId) {
  const urlEntry = await prisma.url.findUnique({
    where: { shortCode: code },
    select: URL_PUBLIC_SELECT,
  });

  if (!urlEntry) {
    throw new AppError("URL not found", 404);
  }
  if (!urlEntry.userId) {
    throw new AppError(
      "This link has no owner, so it is private and unavailable",
      403
    );
  }
  if (urlEntry.userId !== userId) {
    throw new AppError("You can only manage links you created", 403);
  }
  return urlEntry;
}

export async function getUrlStatsForOwner(code, userId) {
  const urlEntry = await requireOwnedUrl(code, userId);
  return toPublicUrl(urlEntry);
}

export async function listUrlsForUser(
  userId,
  { q = "", sort = "createdAt", order = "desc", page = 1, limit = 20 } = {}
) {
  const take = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const currentPage = Math.max(Number(page) || 1, 1);
  const skip = (currentPage - 1) * take;
  const allowedSort = new Set(["createdAt", "clickCount", "shortCode"]);
  const sortKey = allowedSort.has(sort) ? sort : "createdAt";
  const dir = order === "asc" ? "asc" : "desc";

  const where = { userId };
  const query = String(q || "").trim();
  if (query) {
    where.OR = [
      { shortCode: { contains: query, mode: "insensitive" } },
      { originalUrl: { contains: query, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.url.findMany({
      where,
      orderBy: { [sortKey]: dir },
      skip,
      take,
      select: URL_PUBLIC_SELECT,
    }),
    prisma.url.count({ where }),
  ]);

  return {
    urls: rows.map(toPublicUrl),
    total,
    page: currentPage,
    limit: take,
  };
}

export async function updateUrlForOwner(code, userId, patch) {
  const existing = await requireOwnedUrl(code, userId);
  const data = {};

  if (patch.originalUrl !== undefined) data.originalUrl = patch.originalUrl;
  if (patch.expiresAt !== undefined) data.expiresAt = patch.expiresAt;
  if (patch.disabled !== undefined) data.disabled = Boolean(patch.disabled);

  if (patch.shortCode && patch.shortCode !== existing.shortCode) {
    data.shortCode = patch.shortCode;
  }

  if (patch.clearPassword) {
    data.passwordHash = null;
  } else if (patch.password) {
    data.passwordHash = await hashLinkPassword(patch.password);
  }

  let updated;
  try {
    updated = await prisma.url.update({
      where: { id: existing.id },
      data,
      select: URL_PUBLIC_SELECT,
    });
  } catch (error) {
    mapPrismaError(error);
  }

  await invalidateUrlCache(existing.shortCode);
  if (updated.shortCode && updated.shortCode !== existing.shortCode) {
    await invalidateUrlCache(updated.shortCode);
  }

  return toPublicUrl(updated);
}

export async function deleteUrlForOwner(code, userId) {
  const existing = await requireOwnedUrl(code, userId);
  await prisma.url.delete({ where: { id: existing.id } });
  await invalidateUrlCache(existing.shortCode);
  return { deleted: true, shortCode: existing.shortCode };
}

export async function verifyLinkPassword(passwordHash, password) {
  if (!passwordHash) return true;
  if (!password) return false;
  return bcrypt.compare(password, passwordHash);
}

function labelOrUnknown(value) {
  return value && String(value).trim() ? String(value) : "Unknown";
}

function groupRows(rows, key) {
  return rows.map((row) => ({
    name: labelOrUnknown(row[key]),
    count: row._count._all,
  }));
}

export async function getAnalyticsForOwner(code, userId, { from, to } = {}) {
  await requireOwnedUrl(code, userId);

  const toDate = to ? new Date(to) : new Date();
  const fromDate = from
    ? new Date(from)
    : new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);

  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    throw new AppError("from and to must be valid dates", 400);
  }
  if (fromDate > toDate) {
    throw new AppError("`from` must be before `to`", 400);
  }

  const where = {
    shortCode: code,
    clickedAt: { gte: fromDate, lte: toDate },
  };

  const [byCountry, byDevice, byBrowser, byReferrer, byUtmSource, timeseries, recent] =
    await Promise.all([
      prisma.clickEvent.groupBy({
        by: ["country"],
        where,
        _count: { _all: true },
        orderBy: { _count: { country: "desc" } },
        take: 12,
      }),
      prisma.clickEvent.groupBy({
        by: ["device"],
        where,
        _count: { _all: true },
        orderBy: { _count: { device: "desc" } },
      }),
      prisma.clickEvent.groupBy({
        by: ["browser"],
        where,
        _count: { _all: true },
        orderBy: { _count: { browser: "desc" } },
      }),
      prisma.clickEvent.groupBy({
        by: ["referrer"],
        where,
        _count: { _all: true },
        orderBy: { _count: { referrer: "desc" } },
        take: 12,
      }),
      prisma.clickEvent.groupBy({
        by: ["utmSource"],
        where,
        _count: { _all: true },
        orderBy: { _count: { utmSource: "desc" } },
        take: 12,
      }),
      prisma.$queryRaw`
        SELECT to_char(date_trunc('day', "clickedAt"), 'YYYY-MM-DD') AS day,
               COUNT(*)::int AS count
        FROM "ClickEvent"
        WHERE "shortCode" = ${code}
          AND "clickedAt" >= ${fromDate}
          AND "clickedAt" <= ${toDate}
        GROUP BY 1
        ORDER BY 1
      `,
      prisma.clickEvent.findMany({
        where,
        orderBy: { clickedAt: "desc" },
        take: 50,
        select: {
          id: true,
          clickedAt: true,
          ipAddress: true,
          country: true,
          device: true,
          browser: true,
          referrer: true,
        },
      }),
    ]);

  return {
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
    timeseries: (timeseries || []).map((row) => ({
      day: row.day,
      count: Number(row.count),
    })),
    countries: groupRows(byCountry, "country"),
    devices: groupRows(byDevice, "device"),
    browsers: groupRows(byBrowser, "browser"),
    referrers: groupRows(byReferrer, "referrer"),
    utmSources: groupRows(byUtmSource, "utmSource"),
    recentClicks: recent.map((row) => ({
      id: row.id,
      clickedAt: row.clickedAt.toISOString(),
      ipAddress: row.ipAddress || "Unknown",
      country: row.country || "Unknown",
      device: row.device || "Unknown",
      browser: row.browser || "Unknown",
      referrer: row.referrer || "Direct",
    })),
  };
}

function buildClickEvent(shortCode, clickedAt = new Date(), meta = {}) {
  return {
    shortCode,
    clickedAt: clickedAt.toISOString(),
    ipAddress: meta.ipAddress ?? null,
    country: meta.country ?? null,
    device: meta.device ?? null,
    browser: meta.browser ?? null,
    referrer: meta.referrer ?? null,
    utmSource: meta.utmSource ?? null,
    utmMedium: meta.utmMedium ?? null,
    utmCampaign: meta.utmCampaign ?? null,
  };
}

function persistInBackground(payload) {
  persistClickEvent(payload).catch((err) => {
    console.error("Failed to persist click:", err.message);
  });
}

export function enqueueClickEvent(shortCode, meta = {}) {
  if (!shortCode || typeof shortCode !== "string") return;
  const payload = JSON.stringify(buildClickEvent(shortCode, new Date(), meta));

  if (redisClient?.isReady) {
    redisClient.rPush(CLICK_QUEUE_KEY, payload).catch((err) => {
      console.error("Failed to enqueue click:", err.message);
      persistInBackground(payload);
    });
    return;
  }

  persistInBackground(payload);
}

function isValidEvent(evt) {
  if (!evt || typeof evt !== "object") return false;
  if (typeof evt.shortCode !== "string" || evt.shortCode.length === 0)
    return false;
  if (!evt.clickedAt || typeof evt.clickedAt !== "string") return false;
  const d = new Date(evt.clickedAt);
  return !Number.isNaN(d.getTime());
}

export async function persistClickEvent(rawPayload) {
  let evt;
  try {
    evt = typeof rawPayload === "string" ? JSON.parse(rawPayload) : rawPayload;
  } catch {
    return { ok: false, reason: "malformed_json" };
  }

  if (!isValidEvent(evt)) return { ok: false, reason: "invalid_event" };

  const clickedAt = new Date(evt.clickedAt);
  const shortCode = evt.shortCode;

  const result = await prisma.$transaction(async (tx) => {
    const url = await tx.url.findUnique({
      where: { shortCode },
      select: { id: true },
    });
    if (!url) return { ok: false, reason: "missing_url" };

    await tx.clickEvent.create({
      data: {
        shortCode,
        clickedAt,
        urlId: url.id,
        ipAddress: evt.ipAddress ?? null,
        country: evt.country ?? null,
        device: evt.device ?? null,
        browser: evt.browser ?? null,
        referrer: evt.referrer ?? null,
        utmSource: evt.utmSource ?? null,
        utmMedium: evt.utmMedium ?? null,
        utmCampaign: evt.utmCampaign ?? null,
      },
    });

    await tx.url.update({
      where: { id: url.id },
      data: { clickCount: { increment: 1 } },
    });

    return { ok: true };
  });

  return result;
}

export async function requeueProcessingItem(rawPayload) {
  if (!redisClient?.isReady) return;
  await redisClient.rPush(CLICK_QUEUE_KEY, rawPayload).catch(() => {});
  await redisClient.lRem(CLICK_PROCESSING_KEY, 0, rawPayload).catch(() => {});
}
