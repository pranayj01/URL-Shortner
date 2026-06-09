import { createClient } from "redis";

const redisClient = createClient({
    url: process.env.REDIS_URL || "redis://redis:6379"
});

redisClient.on("error", (err) => {
    console.error("Redis Error:", err.message);
});

try {
    await redisClient.connect();
    console.log("Redis Connected");
} catch (err) {
    console.log("Redis unavailable. Running without cache.");
}

export default redisClient;