import prisma from "../config/db.js";
import { encodeToBase62 } from "../utils/base62.js";
import { AppError } from "../utils/AppError.js";

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

export function recordClick(code) {
  prisma.url
    .updateMany({
      where: { shortCode: code },
      data: { clickCount: { increment: 1 } },
    })
    .catch((err) => {
      console.error("Failed to record click:", err.message);
    });
}
