import { createClient } from "redis";
const redisUrl = process.env.REDIS_URL;

let redisClient = null;

if (redisUrl) {
    redisClient = createClient({
        url: redisUrl
    });

    redisClient.on("error", (err) => {
        console.error("Redis Error:", err.message);
    });

    try {
        await redisClient.connect();
        console.log("Redis Connected");
    } catch (err) {
        console.log("Redis unavailable");
    }
}

export default redisClient;