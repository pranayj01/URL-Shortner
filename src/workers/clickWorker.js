import "../config/loadEnv.js";
import {
  persistClickEvent,
  requeueProcessingItem,
} from "../services/urlService.js";
import { connectRedis } from "../config/connectRedis.js";

const CLICK_QUEUE_KEY = process.env.CLICK_QUEUE_KEY || "clicks:queue";
const CLICK_PROCESSING_KEY =
  process.env.CLICK_PROCESSING_KEY || "clicks:processing";
const BRPOP_TIMEOUT = String(process.env.CLICK_BRPOP_TIMEOUT || 5);

const redisClient = await connectRedis("Click worker");

function getEventPayload(result) {
  if (!result) return null;
  if (Array.isArray(result) && result.length >= 2) return result[1];
  if (typeof result === "object" && result.element) return result.element;
  if (typeof result === "string") return result;
  return null;
}

async function listLen(key) {
  const value = await redisClient.sendCommand(["LLEN", key]);
  return Number(value) || 0;
}

async function drainProcessing() {
  if (!redisClient?.isReady) return 0;

  let count = 0;
  while (true) {
    const payload = await redisClient
      .sendCommand(["RPOP", CLICK_PROCESSING_KEY])
      .catch(() => null);
    if (!payload) break;

    const out = await persistClickEvent(payload).catch((err) => {
      console.error("Worker persist error:", err.message);
      return { ok: false, reason: "postgres_error" };
    });

    if (!out?.ok && out?.reason === "postgres_error") {
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

  if (!redisClient) {
    console.log("Click worker idle; clicks still save to Postgres.");
    return;
  }

  let processed = 0;
  let errors = 0;
  let lastLog = Date.now();

  while (true) {
    if (!redisClient.isReady) {
      console.log("Click worker: Redis dropped. Exiting; API will persist clicks directly.");
      return;
    }

    try {
      const drained = await drainProcessing();
      if (drained > 0) {
        console.log(`Recovered ${drained} queued click(s) from processing list`);
      }
    } catch (err) {
      console.error("Worker drainProcessing failed:", err.message);
    }

    try {
      const res = await redisClient.sendCommand([
        "BRPOPLPUSH",
        CLICK_QUEUE_KEY,
        CLICK_PROCESSING_KEY,
        BRPOP_TIMEOUT,
      ]);

      const payload = getEventPayload(res);
      if (!payload) continue;

      const out = await persistClickEvent(payload).catch((err) => {
        console.error("Worker persist error:", err.message);
        return { ok: false, reason: "postgres_error" };
      });
      processed += 1;

      if (!out?.ok) {
        errors += 1;
        if (out?.reason === "postgres_error") {
          await requeueProcessingItem(payload).catch(() => {});
        } else {
          await redisClient
            .sendCommand(["LREM", CLICK_PROCESSING_KEY, "1", payload])
            .catch(() => {});
        }
      } else {
        await redisClient
          .sendCommand(["LREM", CLICK_PROCESSING_KEY, "1", payload])
          .catch(() => {});
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
        listLen(CLICK_QUEUE_KEY).catch(() => 0),
        listLen(CLICK_PROCESSING_KEY).catch(() => 0),
      ]);
      console.log(
        `Worker stats: processed=${processed} errors=${errors} queueDepth=${qDepth} processingDepth=${pDepth}`
      );
    }
  }
}

main().catch((err) => {
  console.error("Click worker fatal:", err.message);
  process.exit(1);
});
