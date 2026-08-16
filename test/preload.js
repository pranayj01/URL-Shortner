import { config } from "dotenv";

config();
process.env.REDIS_URL = "";
process.env.START_WORKER = "false";
process.env.RATE_LIMIT_MAX = process.env.RATE_LIMIT_MAX || "10000";
process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.BETTER_AUTH_SECRET =
  process.env.BETTER_AUTH_SECRET ||
  process.env.JWT_SECRET ||
  "test-secret";
process.env.BETTER_AUTH_URL =
  process.env.BETTER_AUTH_URL || "http://127.0.0.1";
process.env.BASE_URL = process.env.BASE_URL || "http://127.0.0.1";
