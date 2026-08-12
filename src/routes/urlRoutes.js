import express from "express";
import {
  shortenUrl,
  redirectUrl,
  urlStats,
  myUrls,
} from "../controllers/urlController.js";
import { login, register, me } from "../controllers/authController.js";
import { validateUrl } from "../middleware/validateUrl.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { requireAuth } from "../middleware/auth.js";

export const apiRouter = express.Router();
apiRouter.use(rateLimit);

apiRouter.post("/auth/register", register);
apiRouter.post("/auth/login", login);
apiRouter.get("/auth/me", requireAuth, me);

// Create + insights require login. Opening short links stays public.
apiRouter.post("/shorten", requireAuth, validateUrl, shortenUrl);
apiRouter.get("/urls/mine", requireAuth, myUrls);
apiRouter.get("/urls/:code", requireAuth, urlStats);

export const redirectRouter = express.Router();
redirectRouter.use(rateLimit);
redirectRouter.get("/:code", redirectUrl);
