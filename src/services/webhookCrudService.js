import prisma from "../config/db.js";
import { AppError } from "../utils/AppError.js";

const ALLOWED_EVENTS = new Set(["link.created", "link.clicked"]);

function normalizeEvents(events) {
  const list = Array.isArray(events) ? events : [];
  const cleaned = [...new Set(list.map((e) => String(e || "").trim()).filter(Boolean))];
  if (!cleaned.length) {
    throw new AppError("Select at least one webhook event", 400);
  }
  for (const event of cleaned) {
    if (!ALLOWED_EVENTS.has(event)) {
      throw new AppError(`Unsupported event: ${event}`, 400);
    }
  }
  return cleaned;
}

function normalizeWebhookUrl(url) {
  if (!url || typeof url !== "string") {
    throw new AppError("Webhook URL is required", 400);
  }
  let next = url.trim();
  try {
    const parsed = new URL(next);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("bad protocol");
    }
    return parsed.toString();
  } catch {
    throw new AppError("Webhook URL must be a valid http(s) URL", 400);
  }
}

export async function listWebhooks(userId) {
  return prisma.webhook.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      url: true,
      events: true,
      enabled: true,
      secret: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function createWebhook(userId, { url, events, secret, enabled }) {
  const endpoint = normalizeWebhookUrl(url);
  const eventList = normalizeEvents(events);
  return prisma.webhook.create({
    data: {
      userId,
      url: endpoint,
      events: eventList,
      secret: secret ? String(secret).slice(0, 128) : null,
      enabled: enabled !== false,
    },
    select: {
      id: true,
      url: true,
      events: true,
      enabled: true,
      secret: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function updateWebhook(userId, id, patch) {
  const existing = await prisma.webhook.findFirst({ where: { id, userId } });
  if (!existing) throw new AppError("Webhook not found", 404);

  const data = {};
  if (patch.url !== undefined) data.url = normalizeWebhookUrl(patch.url);
  if (patch.events !== undefined) data.events = normalizeEvents(patch.events);
  if (patch.enabled !== undefined) data.enabled = Boolean(patch.enabled);
  if (patch.secret !== undefined) {
    data.secret = patch.secret ? String(patch.secret).slice(0, 128) : null;
  }

  return prisma.webhook.update({
    where: { id },
    data,
    select: {
      id: true,
      url: true,
      events: true,
      enabled: true,
      secret: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function deleteWebhook(userId, id) {
  const existing = await prisma.webhook.findFirst({ where: { id, userId } });
  if (!existing) throw new AppError("Webhook not found", 404);
  await prisma.webhook.delete({ where: { id } });
  return { deleted: true, id };
}

export { ALLOWED_EVENTS };
