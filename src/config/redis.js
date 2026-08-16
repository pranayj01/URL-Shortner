import "./loadEnv.js";
import { connectRedis } from "./connectRedis.js";

const redisClient = await connectRedis("Redis");

export default redisClient;
