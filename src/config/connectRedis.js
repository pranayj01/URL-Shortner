import { createClient } from "redis";

export function redisHostname(raw = process.env.REDIS_URL) {
  if (!raw) return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

function errorDetail(err) {
  return err?.message || err?.code || String(err);
}

export async function connectRedis(label = "Redis") {
  const url = process.env.REDIS_URL;
  if (!url) return null;

  const host = redisHostname(url) || "unknown";
  const client = createClient({
    url,
    socket: {
      connectTimeout: 2000,
      reconnectStrategy: false,
    },
  });

  client.on("error", (err) => {
    console.error(`${label} error: ${errorDetail(err)}`);
  });

  try {
    await client.connect();
    console.log(`${label} connected (${host})`);
    return client;
  } catch (err) {
    console.log(`${label} unavailable (${host}): ${errorDetail(err)}`);
    try {
      await client.close();
    } catch {
      // ignore
    }
    return null;
  }
}
