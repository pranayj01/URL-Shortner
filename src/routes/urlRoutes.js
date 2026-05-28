import express from "express";
import { shortenUrl, redirectUrl } from "../controllers/urlController.js";

const router = express.Router();

router.get("/shorten", (req, res) => {
  res.json({ message: "shorten endpoint working" });
});

router.post("/shorten", shortenUrl);
router.get("/:code", redirectUrl);

export default router;
