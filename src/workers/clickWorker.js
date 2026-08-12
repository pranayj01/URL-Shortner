import "dotenv/config";
import redisClient from "../config/redis.js";
import { persistClickEvent, requeueProcessingItem } from "../services/urlService.js";

const CLICK_QUEUE_KEY = process.env.CLICK_QUEUE_KEY || "clicks:queue";
const CLICK_PROCESSING_KEY =
  process.env.CLICK_PROCESSING_KEY || "clicks:processing";

const BRPOP_LPUSH_TIMEOUT = Number(process.env.CLICK_BRPOP_TIMEOUT || 5); // seconds

function getEventPayload(result) {
  // redis v4 shape can be [key, value]
  // or { element: string, key: string } depending on client version.
  if (!result) return null;
  if (Array.isArray(result) && result.length >= 2) return result[1];
  if (typeof result === "object" && result.element) return result.element;
  if (typeof result === "string") return result;
  return null;
}

async function drainProcessing() {
  if (!redisClient?.isReady) return 0;

  let count = 0;
  while (true) {
    // Use RPOP to avoid blocking; keep this recovery step quick.
    const payload = await redisClient.rPop(CLICK_PROCESSING_KEY).catch(() => null);
    if (!payload) break;

    const out = await persistClickEvent(payload).catch((err) => {
      console.error("Worker persist error:", err.message);
      return { ok: false, reason: "postgres_error" };
    });

    if (!out?.ok) {
      // Best effort requeue and continue.
      await requeueProcessingItem(payload).catch(() => {});
    }

    count += 1;
  }
  return count;
}

async function main() {
  console.log(
    `Click worker starting. queue=${CLICK_QUEUE_KEY} processing=${CLICK_PROCESSING_KEY}`
  );

  let processed = 0;
  let errors = 0;
  let lastLog = Date.now();

  while (true) {
    if (!redisClient?.isReady) {
      console.log("Redis not ready; worker sleeping...");
      await new Promise((r) => setTimeout(r, 1000));
      continue;
    }

    // Recover items that were left in the processing list after restart/crash.
    try {
      const drained = await drainProcessing();
      if (drained > 0) {
        console.log(`Recovered ${drained} queued click(s) from processing list`);
      }
    } catch (err) {
      console.error("Worker drainProcessing failed:", err.message);
    }

    try {
      const res = await redisClient.brPopLPush(
        CLICK_QUEUE_KEY,
        CLICK_PROCESSING_KEY,
        BRPOP_LPUSH_TIMEOUT
      );

      const payload = getEventPayload(res);
      if (!payload) continue;

      const out = await persistClickEvent(payload);
      processed += 1;

      if (!out?.ok) {
        errors += 1;
        // Only requeue on actual persistence failures. Malformed/invalid events
        // are treated as poison messages and are discarded to avoid loops.
        if (out?.reason === "postgres_error") {
          await requeueProcessingItem(payload).catch(() => {});
        } else {
          await redisClient
            .lRem(CLICK_PROCESSING_KEY, 1, payload)
            .catch(() => {});
        }
      } else {
        // Remove processed item from processing list.
        await redisClient.lRem(CLICK_PROCESSING_KEY, 1, payload).catch(() => {});
      }
    } catch (err) {
      errors += 1;
      console.error("Worker loop error:", err.message);
      await new Promise((r) => setTimeout(r, 500));
    }

    const now = Date.now();
    if (now - lastLog > 10_000) {
      lastLog = now;
      const [qDepth, pDepth] = await Promise.all([
        redisClient.llen(CLICK_QUEUE_KEY).catch(() => 0),
        redisClient.llen(CLICK_PROCESSING_KEY).catch(() => 0),
      ]);
      const rate = processed / Math.max(1, (now - (now - 10_000)) / 1000);
      console.log(
        `Worker stats: processed=${processed} errors=${errors} queueDepth=${qDepth} processingDepth=${pDepth} estRate=${rate.toFixed(
          2
        )}/s`
      );
    }
  }
}

main().catch((err) => {
  console.error("Click worker fatal:", err.message);
  process.exit(1);
});

