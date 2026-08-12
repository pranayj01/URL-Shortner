import prisma from "../config/db.js";
import redisClient from "../config/redis.js";

export async function healthCheck(req, res) {
  let postgres = "down";
  let redis = "down";

  try {
    await prisma.$queryRaw`SELECT 1`;
    postgres = "up";
  } catch {
    postgres = "down";
  }

  try {
    if (redisClient?.isReady) {
      await redisClient.ping();
      redis = "up";
    } else if (!process.env.REDIS_URL) {
      redis = "disabled";
    }
  } catch {
    redis = "down";
  }

  const healthy = postgres === "up";
  const status =
    healthy && (redis === "up" || redis === "disabled") ? "ok" : "degraded";

  res.status(healthy ? 200 : 503).json({
    status,
    postgres,
    redis,
  });
}
