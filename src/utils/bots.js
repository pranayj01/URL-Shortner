const BOT_RE =
  /bot|crawl|spider|slurp|facebookexternalhit|facebot|twitterbot|linkedinbot|embedly|quora link preview|pinterest|redditbot|applebot|whatsapp|telegram|discordbot|skypeuripreview|vkshare|w3c_validator|preview/i;

export function isSocialBot(req) {
  const ua = req.get?.("user-agent") || req.headers?.["user-agent"] || "";
  return BOT_RE.test(String(ua));
}

export function hasOgPreview(urlData) {
  return Boolean(urlData?.ogTitle || urlData?.ogDescription || urlData?.ogImage);
}
