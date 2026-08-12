import "dotenv/config";
import { spawn } from "node:child_process";
import { applyDatabaseUrl } from "./config/databaseUrl.js";

applyDatabaseUrl();

const runMigrations =
  process.env.RUN_MIGRATIONS === "true" ||
  process.env.NODE_ENV === "production";

function spawnNode(label, scriptPath) {
  const child = spawn(process.execPath, [scriptPath], {
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code, signal) => {
    if (!shuttingDown) {
      console.error(`${label} exited (code=${code}, signal=${signal})`);
      shutdown(code || 1);
    }
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

children.push(spawnNode("server", "src/server.js"));
children.push(spawnNode("click-worker", "src/workers/clickWorker.js"));
