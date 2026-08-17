import express from "express";
import {
  shortenUrl,
  redirectUrl,
  urlStats,
  myUrls,
  updateUrl,
  deleteUrl,
  urlAnalytics,
  urlQr,
  publicQr,
} from "../controllers/urlController.js";
import { me } from "../controllers/authController.js";
import {
  getFolders,
  postFolder,
  removeFolder,
  getTags,
  postTag,
  removeTag,
  getWebhooks,
  postWebhook,
  patchWebhook,
  removeWebhook,
} from "../controllers/metaController.js";
import { validateUrl, validateUrlPatch } from "../middleware/validateUrl.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";

export const apiRouter = express.Router();
apiRouter.use(rateLimit);

apiRouter.get("/me", requireAuth, me);

apiRouter.post("/shorten", optionalAuth, validateUrl, shortenUrl);
apiRouter.get("/urls/mine", requireAuth, myUrls);
apiRouter.get("/urls/:code/analytics", requireAuth, urlAnalytics);
apiRouter.get("/urls/:code/qr", requireAuth, urlQr);
apiRouter.patch("/urls/:code", requireAuth, validateUrlPatch, updateUrl);
apiRouter.delete("/urls/:code", requireAuth, deleteUrl);
apiRouter.get("/urls/:code", requireAuth, urlStats);

apiRouter.get("/folders", requireAuth, getFolders);
apiRouter.post("/folders", requireAuth, postFolder);
apiRouter.delete("/folders/:id", requireAuth, removeFolder);

apiRouter.get("/tags", requireAuth, getTags);
apiRouter.post("/tags", requireAuth, postTag);
apiRouter.delete("/tags/:id", requireAuth, removeTag);

apiRouter.get("/webhooks", requireAuth, getWebhooks);
apiRouter.post("/webhooks", requireAuth, postWebhook);
apiRouter.patch("/webhooks/:id", requireAuth, patchWebhook);
apiRouter.delete("/webhooks/:id", requireAuth, removeWebhook);

export const redirectRouter = express.Router();
redirectRouter.use(rateLimit);
redirectRouter.get("/:code/qr.png", publicQr);
redirectRouter.get("/:code", redirectUrl);
redirectRouter.post("/:code", redirectUrl);
