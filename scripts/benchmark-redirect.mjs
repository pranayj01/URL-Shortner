import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import net from "node:net";
import path from "node:path";
import os from "node:os";
import autocannon from "autocannon";
import EmbeddedPostgres from "embedded-postgres";
import { RedisMemoryServer } from "redis-memory-server";

const PORT = 3000;
const BENCH_CODE = "benchrun";
const DURATION = 20;
const CONNECTIONS = 20;
const PIPELINING = 10;

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" ? address.port : 0;
      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
    server.on("error", reject);
  });
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: false,
      ...options,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

async function waitForHttp(url, attempts = 40) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // retry
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function seedUrl(baseUrl) {
  const res = await fetch(`${baseUrl}/api/shorten`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      originalUrl: "https://example.com/benchmark-target",
      customAlias: BENCH_CODE,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to seed URL (${res.status}): ${body}`);
  }
}

function extractMetrics(result) {
  return {
    avgLatencyMs: Number(result.latency.mean.toFixed(2)),
    p50Ms: result.latency.p50,
    p95Ms: result.latency.p95 ?? result.latency.p97_5,
    p99Ms: result.latency.p99,
    reqPerSec: Number(result.requests.average.toFixed(2)),
  };
}

async function runBenchmark(label, targetUrl) {
  console.log(`\n=== ${label} ===`);
  console.log(`Target: ${targetUrl}`);

  const result = await autocannon({
    url: targetUrl,
    connections: CONNECTIONS,
    duration: DURATION,
    pipelining: PIPELINING,
  });

  const metrics = extractMetrics(result);
  console.log(
    `Avg ${metrics.avgLatencyMs} ms | p50 ${metrics.p50Ms} ms | p95 ${metrics.p95Ms} ms | p99 ${metrics.p99Ms} ms | ${metrics.reqPerSec} req/s`
  );

  return metrics;
}

async function startServer(env) {
  const child = spawn("node", ["src/server.js"], {
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => process.stdout.write(`[app] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[app] ${chunk}`));

  await waitForHttp(`http://127.0.0.1:${PORT}/health`);
  return child;
}

function stopProcess(child, name) {
  if (!child || child.killed) return Promise.resolve();
  return new Promise((resolve) => {
    child.once("exit", () => resolve());
    child.kill("SIGTERM");
    setTimeout(() => {
      if (!child.killed) child.kill("SIGKILL");
    }, 3000);
    console.log(`Stopped ${name}`);
  });
}

async function main() {
  process.env.REDISMS_DOWNLOAD_DIR =
    process.env.REDISMS_DOWNLOAD_DIR ||
    `${process.env.LOCALAPPDATA}\\redis-memory-server`;

  const pgPort = await getFreePort();
  let pg;
  let redisServer;
  let server;

  try {
  pg = new EmbeddedPostgres({
    port: pgPort,
    user: "postgres",
    password: "password",
    database: "mydb",
    databaseDir: path.join(os.tmpdir(), `urlshort-bench-pg-${Date.now()}`),
  });

  console.log("Starting embedded PostgreSQL...");
  await pg.initialise();
  await pg.start();

  const databaseUrl =
    `postgresql://postgres:password@127.0.0.1:${pgPort}/mydb?schema=public`;

  process.env.DATABASE_URL = databaseUrl;
  await runCommand(process.execPath, [
    "node_modules/prisma/build/index.js",
    "migrate",
    "deploy",
  ], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });

  const baseEnv = {
    PORT: String(PORT),
    BASE_URL: `http://127.0.0.1:${PORT}`,
    DATABASE_URL: databaseUrl,
    RATE_LIMIT_WINDOW_MS: "60000",
    RATE_LIMIT_MAX: "1000000",
  };

  const baseUrl = `http://127.0.0.1:${PORT}`;

  console.log("Benchmark A: PostgreSQL only (no Redis)...");
  server = await startServer({ ...baseEnv, REDIS_URL: "" });
  await seedUrl(baseUrl);
  const postgresOnly = await runBenchmark(
    "PostgreSQL only",
    `${baseUrl}/${BENCH_CODE}`
  );
  await stopProcess(server, "app");
  server = null;

  console.log("Starting embedded Redis...");
  redisServer = new RedisMemoryServer();
  const redisHost = await redisServer.getHost();
  const redisPort = await redisServer.getPort();
  const redisUrl = `redis://${redisHost}:${redisPort}`;

  console.log("Benchmark B: PostgreSQL + Redis cache...");
  server = await startServer({ ...baseEnv, REDIS_URL: redisUrl });
  await waitForHttp(`${baseUrl}/health`);

  // Warm cache so redirect hits Redis instead of Postgres.
  const warm = await fetch(`${baseUrl}/${BENCH_CODE}`, { redirect: "manual" });
  if (warm.status !== 302) {
    throw new Error(`Expected warm-up redirect 302, got ${warm.status}`);
  }

  const withRedis = await runBenchmark(
    "PostgreSQL + Redis",
    `${baseUrl}/${BENCH_CODE}`
  );

  console.log("\n| Metric | PostgreSQL | Redis |");
  console.log("| --- | ---: | ---: |");
  console.log(
    `| Avg latency | ${postgresOnly.avgLatencyMs} ms | ${withRedis.avgLatencyMs} ms |`
  );
  console.log(`| p50 | ${postgresOnly.p50Ms} ms | ${withRedis.p50Ms} ms |`);
  console.log(`| p95 | ${postgresOnly.p95Ms} ms | ${withRedis.p95Ms} ms |`);
  console.log(`| p99 | ${postgresOnly.p99Ms} ms | ${withRedis.p99Ms} ms |`);
  console.log(
    `| Requests/sec | ${postgresOnly.reqPerSec} | ${withRedis.reqPerSec} |`
  );
  } finally {
    await stopProcess(server, "app");
    if (redisServer) await redisServer.stop();
    if (pg) await pg.stop();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
