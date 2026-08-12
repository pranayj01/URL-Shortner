import express from "express";
import {
  shortenUrl,
  redirectUrl,
  urlStats,
} from "../controllers/urlController.js";
import { validateUrl } from "../middleware/validateUrl.js";
import { rateLimit } from "../middleware/rateLimit.js";

export const apiRouter = express.Router();
// Rate limit before any DB work on API routes (not keyed by URL path).
apiRouter.use(rateLimit);
apiRouter.post("/shorten", validateUrl, shortenUrl);
apiRouter.get("/urls/:code", urlStats);

export const redirectRouter = express.Router();
// Rate limit before Redis cache / PostgreSQL on redirects.
redirectRouter.use(rateLimit);
redirectRouter.get("/:code", redirectUrl);
