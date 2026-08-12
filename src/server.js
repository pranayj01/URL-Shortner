import "dotenv/config";
import { spawn } from "node:child_process";
import app from "./app.js";
import "./config/redis.js";

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// If someone starts `node src/server.js` (common Render override), still run analytics.
if (process.env.START_WORKER !== "false") {
  const worker = spawn(process.execPath, ["src/workers/clickWorker.js"], {
    stdio: "inherit",
    env: { ...process.env, START_WORKER: "false" },
  });
  worker.on("exit", (code, signal) => {
    console.error(`click-worker exited (code=${code}, signal=${signal})`);
  });
}
