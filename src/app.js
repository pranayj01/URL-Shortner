import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { apiRouter, redirectRouter } from "./routes/urlRoutes.js";
import { healthCheck } from "./controllers/healthController.js";
import { errorHandler } from "./middleware/errorHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "..", "public");

const app = express();

app.use(cors());
app.use(express.json());
app.set("trust proxy", 1);

app.get("/health", healthCheck);
app.use("/api", apiRouter);

app.use(express.static(publicDir));

app.use("/", redirectRouter);

app.use(errorHandler);

export default app;
