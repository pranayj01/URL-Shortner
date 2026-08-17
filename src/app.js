import "./config/loadEnv.js";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { toNodeHandler } from "better-auth/node";
import { auth, resolveAuthBaseURL } from "./auth.js";
import { apiRouter, redirectRouter } from "./routes/urlRoutes.js";
import { healthCheck } from "./controllers/healthController.js";
import { errorHandler } from "./middleware/errorHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "..", "public");

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      const allowed = new Set();
      for (const value of [
        resolveAuthBaseURL(),
        process.env.BETTER_AUTH_URL,
        process.env.BASE_URL,
        process.env.RENDER_EXTERNAL_URL,
      ].filter(Boolean)) {
        try {
          const url = new URL(value.includes("://") ? value : `https://${value}`);
          allowed.add(`${url.protocol}//${url.host}`);
        } catch {
          allowed.add(String(value).replace(/\/$/, ""));
        }
      }
      if (allowed.has(origin) || process.env.NODE_ENV !== "production") {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);
app.set("trust proxy", 1);

// Better Auth must run before express.json() or client requests hang.
app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get("/health", healthCheck);
app.use("/api", apiRouter);

app.use(express.static(publicDir));

app.use("/", redirectRouter);

app.use(errorHandler);

export default app;
