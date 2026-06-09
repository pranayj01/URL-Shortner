import express from "express";
import { shortenUrl , redirectUrl } from "../controllers/urlController.js";
import { validateUrl } from "../middleware/validateUrl.js";
import redisClient from "../config/redis.js";
const router = express.Router();

router.get("/shorten", (req, res) => {
  res.json({ message: "shorten endpoint working" });
});

router.post("/shorten",validateUrl, shortenUrl);
router.get("/:code", redirectUrl);
router.get("/redis-test", async (req, res) => {
  await redisClient.set("test", "hello");
  const value = await redisClient.get("test");

  res.json({ value });
});
export default router;
