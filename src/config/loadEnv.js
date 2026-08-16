import dotenv from "dotenv";

const priorRedis = process.env.REDIS_URL;
const isTest = process.env.NODE_ENV === "test";

// Local `.env` must win over leftover shell/user vars (e.g. a Render REDIS_URL).
dotenv.config({ override: true });

// Tests may clear REDIS_URL before import; don't let `.env` turn it back on.
if (isTest && priorRedis === "") {
  process.env.REDIS_URL = "";
}
