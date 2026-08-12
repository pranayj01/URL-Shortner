const ALIAS_PATTERN = /^[a-zA-Z0-9_-]{3,32}$/;

export function validateUrl(req, res, next) {
  let url = req.body.originalUrl;

  if (!url || typeof url !== "string") {
    return res.status(400).json({ message: "originalUrl is required" });
  }

  url = url.trim();

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }

  try {
    new URL(url);
    req.body.originalUrl = url;
  } catch {
    return res.status(400).json({ message: "Invalid URL" });
  }

  const { customAlias, expiresAt } = req.body;

  if (customAlias !== undefined && customAlias !== null && customAlias !== "") {
    if (typeof customAlias !== "string" || !ALIAS_PATTERN.test(customAlias)) {
      return res.status(400).json({
        message:
          "customAlias must be 3–32 characters (letters, numbers, _ or -)",
      });
    }
    req.body.customAlias = customAlias;
  } else {
    req.body.customAlias = undefined;
  }

  if (expiresAt !== undefined && expiresAt !== null && expiresAt !== "") {
    const date = new Date(expiresAt);
    if (Number.isNaN(date.getTime())) {
      return res.status(400).json({ message: "expiresAt must be a valid date" });
    }
    if (date <= new Date()) {
      return res
        .status(400)
        .json({ message: "expiresAt must be in the future" });
    }
    req.body.expiresAt = date;
  } else {
    req.body.expiresAt = undefined;
  }

  next();
}
