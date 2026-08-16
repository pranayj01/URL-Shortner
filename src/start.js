import "./config/loadEnv.js";
import { spawn } from "node:child_process";
import { applyDatabaseUrl } from "./config/databaseUrl.js";
import { redisHostname } from "./config/connectRedis.js";

applyDatabaseUrl();

try {
  const host = new URL(process.env.DATABASE_URL).hostname;
  console.log(`Using database host: ${host}`);
} catch {
  console.log("DATABASE_URL is missing or invalid");
}

const redisHost = redisHostname();
if (redisHost) {
  console.log(`Using redis host: ${redisHost}`);
} else {
  console.log("REDIS_URL is not set; redirects skip cache and clicks save to Postgres");
}

const runMigrations =
  process.env.RUN_MIGRATIONS === "true" ||
  process.env.NODE_ENV === "production";

function spawnNode(label, scriptPath, extraEnv = {}, { fatal = true } = {}) {
  const child = spawn(process.execPath, [scriptPath], {
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    console.error(`${label} exited (code=${code}, signal=${signal})`);
    if (fatal) shutdown(code || 1);
  });

  return child;
}

function runMigrate() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["node_modules/prisma/build/index.js", "migrate", "deploy"],
      { stdio: "inherit", env: process.env }
    );
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`prisma migrate deploy failed with code ${code}`));
    });
  });
}

let shuttingDown = false;
const children = [];

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(code), 1500).unref();
}

process.on("SIGTERM", () => shutdown(0));
process.on("SIGINT", () => shutdown(0));

if (runMigrations) {
  await runMigrate();
}

children.push(spawnNode("server", "src/server.js", { START_WORKER: "false" }));

if (process.env.REDIS_URL) {
  children.push(spawnNode("click-worker", "src/workers/clickWorker.js", {}, { fatal: false }));
} else {
  console.log("REDIS_URL not set; skipping click worker. Clicks still save to Postgres.");
}
