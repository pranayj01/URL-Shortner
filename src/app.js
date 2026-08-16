import "./config/loadEnv.js";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";
import { apiRouter, redirectRouter } from "./routes/urlRoutes.js";
import { healthCheck } from "./controllers/healthController.js";
import { errorHandler } from "./middleware/errorHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "..", "public");

const app = express();

const allowedOrigin = (
  process.env.BETTER_AUTH_URL ||
  process.env.BASE_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  true
);

app.use(
  cors({
    origin: allowedOrigin === true ? true : String(allowedOrigin).replace(/\/$/, ""),
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
