import { createShortUrl, findOriginalUrl } from "../services/urlService.js";

export async function shortenUrl(req, res, next) {
  throw new Error("Testing error handling");
  try {
    const { originalUrl } = req.body;
    const result = await createShortUrl(originalUrl);
    res.status(201).json(result);
    
  } catch (error) {
    next(error);
  }
}

export async function redirectUrl(req, res, next) {
  try {
    const { code } = req.params;
    const originalUrl = await findOriginalUrl(code);

    if (!originalUrl) {
      return res.status(404).json({ message: "URL not found" });
    }
    console.log(originalUrl);
    res.redirect(originalUrl);
  } catch (error) {
    next(error);
  }
  
}
