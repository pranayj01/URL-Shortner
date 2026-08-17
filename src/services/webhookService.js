import crypto from "node:crypto";
import prisma from "../config/db.js";

const WEBHOOK_TIMEOUT_MS = 4000;

function signBody(secret, body) {
  if (!secret) return null;
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

export async function dispatchWebhooks(userId, event, payload) {
  if (!userId || !event) return;

  const hooks = await prisma.webhook
    .findMany({
      where: {
        userId,
        enabled: true,
        events: { has: event },
      },
    })
    .catch(() => []);

  if (!hooks.length) return;

  const body = JSON.stringify({
    event,
    createdAt: new Date().toISOString(),
    data: payload,
  });

  await Promise.allSettled(
    hooks.map(async (hook) => {
      const headers = {
        "Content-Type": "application/json",
        "User-Agent": "Shortlink-Webhook/1.0",
        "X-Shortlink-Event": event,
      };
      const signature = signBody(hook.secret, body);
      if (signature) headers["X-Shortlink-Signature"] = `sha256=${signature}`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
      try {
        await fetch(hook.url, {
          method: "POST",
          headers,
          body,
          signal: controller.signal,
        });
      } catch (err) {
        console.error(`Webhook ${hook.id} failed:`, err.message);
      } finally {
        clearTimeout(timer);
      }
    })
  );
}

export function enqueueWebhook(userId, event, payload) {
  dispatchWebhooks(userId, event, payload).catch((err) => {
    console.error("Webhook dispatch error:", err.message);
  });
}
