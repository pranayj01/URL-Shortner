import prisma from "../config/db.js";
import { encodeToBase62 } from "../utils/base62.js";
import { AppError } from "../utils/AppError.js";
import redisClient from "../config/redis.js";

const CLICK_QUEUE_KEY = process.env.CLICK_QUEUE_KEY || "clicks:queue";
const CLICK_PROCESSING_KEY =
  process.env.CLICK_PROCESSING_KEY || "clicks:processing";

export async function createShortUrl(originalUrl, expiresAt, customAlias) {
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
      },
    });

    return { shortCode: customAlias };
  }

  const urlEntry = await prisma.url.create({
    data: {
      originalUrl,
      expiresAt: expiresAt ?? null,
    },
  });

  const code = encodeToBase62(urlEntry.id);
  await prisma.url.update({
    where: { id: urlEntry.id },
    data: { shortCode: code },
  });

  return { shortCode: code };
}

export async function findOriginalUrl(code) {
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
  };
}

export async function getUrlStats(code) {
  const urlEntry = await prisma.url.findUnique({
    where: { shortCode: code },
    select: {
      shortCode: true,
      originalUrl: true,
      expiresAt: true,
      clickCount: true,
      createdAt: true,
    },
  });

  if (!urlEntry) {
    throw new AppError("URL not found", 404);
  }

  return urlEntry;
}

function buildClickEvent(shortCode, clickedAt = new Date()) {
  return {
    shortCode,
    clickedAt: clickedAt.toISOString(),
  };
}

function persistInBackground(payload) {
  persistClickEvent(payload).catch((err) => {
    console.error("Failed to persist click:", err.message);
  });
}

// Producer: must not block the redirect path.
export function enqueueClickEvent(shortCode) {
  if (!shortCode || typeof shortCode !== "string") return;

  const payload = JSON.stringify(buildClickEvent(shortCode));

  if (redisClient?.isReady) {
    redisClient.rPush(CLICK_QUEUE_KEY, payload).catch((err) => {
      console.error("Failed to enqueue click:", err.message);
      persistInBackground(payload);
    });
    return;
  }

  // No Redis (or worker) available — still record the click without blocking.
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

  // At-least-once semantics: worker may retry and create duplicates in ClickEvent.
  // For this learning project, we keep the logic simple and resilient.
  await prisma.$transaction(async (tx) => {
    await tx.clickEvent.create({
      data: {
        shortCode,
        clickedAt,
      },
    });

    await tx.url.updateMany({
      where: { shortCode },
      data: { clickCount: { increment: 1 } },
    });
  });

  return { ok: true };
}

export async function requeueProcessingItem(rawPayload) {
  if (!redisClient?.isReady) return;
  await redisClient
    .rPush(CLICK_QUEUE_KEY, rawPayload)
    .catch(() => {});
  await redisClient
    .lRem(CLICK_PROCESSING_KEY, 0, rawPayload)
    .catch(() => {});
}
