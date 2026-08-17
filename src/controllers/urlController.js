import QRCode from "qrcode";
import {
  createShortUrl,
  findOriginalUrl,
  getUrlStatsForOwner,
  listUrlsForUser,
  updateUrlForOwner,
  deleteUrlForOwner,
  getAnalyticsForOwner,
  enqueueClickEvent,
  cachePublicRedirect,
  verifyLinkPassword,
} from "../services/urlService.js";
import { extractClickMeta } from "../utils/clickMeta.js";
import { hasUnlockCookie, setUnlockCookie } from "../utils/linkAccess.js";
import {
  passwordGatePage,
  simpleMessagePage,
  ogPreviewPage,
} from "../utils/htmlPages.js";
import { hasOgPreview, isSocialBot } from "../utils/bots.js";

function buildShortUrl(shortCode) {
  const base = (
    process.env.BASE_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    `http://localhost:${process.env.PORT || 3000}`
  ).replace(/\/$/, "");
  return `${base}/${shortCode}`;
}

function withShortUrl(row) {
  if (!row?.shortCode) return row;
  return { ...row, shortUrl: buildShortUrl(row.shortCode) };
}

function wantsHtml(req) {
  const accept = req.get("accept") || "";
  return accept.includes("text/html");
}

export async function shortenUrl(req, res, next) {
  try {
    const {
      originalUrl,
      expiresAt,
      customAlias,
      password,
      disabled,
      utm,
      ogTitle,
      ogDescription,
      ogImage,
      folderId,
      tags,
    } = req.body;
    const result = await createShortUrl(
      originalUrl,
      expiresAt,
      customAlias,
      req.user?.id ?? null,
      {
        password,
        disabled,
        utm,
        ogTitle,
        ogDescription,
        ogImage,
        folderId,
        tags,
      }
    );
    res.status(201).json({
      ...withShortUrl(result),
      shortCode: result.shortCode,
      shortUrl: buildShortUrl(result.shortCode),
    });
  } catch (error) {
    next(error);
  }
}

export async function redirectUrl(req, res, next) {
  try {
    const { code } = req.params;
    const urlData = await findOriginalUrl(code);

    if (!urlData) {
      if (wantsHtml(req)) {
        res
          .status(404)
          .type("html")
          .send(simpleMessagePage("Not found", "That short link does not exist."));
        return;
      }
      return res.status(404).json({ message: "URL not found" });
    }

    if (urlData.disabled) {
      if (wantsHtml(req) || req.method === "POST") {
        res
          .status(410)
          .type("html")
          .send(
            simpleMessagePage(
              "Link disabled",
              "This short link has been turned off."
            )
          );
        return;
      }
      return res.status(410).json({ message: "This short link has been disabled" });
    }

    if (urlData.hasPassword) {
      const submitted =
        req.body?.password ||
        (typeof req.body === "object" ? req.body.password : undefined);
      const unlocked =
        hasUnlockCookie(req, code) ||
        (await verifyLinkPassword(urlData.passwordHash, submitted));

      if (!unlocked) {
        const message =
          req.method === "POST" ? "Incorrect password" : undefined;
        res
          .status(req.method === "POST" ? 401 : 200)
          .type("html")
          .send(passwordGatePage(code, message));
        return;
      }

      if (submitted) setUnlockCookie(res, code);
    } else if (!urlData.fromCache) {
      await cachePublicRedirect(code, urlData);
    }

    const bot = isSocialBot(req);
    if (bot && hasOgPreview(urlData)) {
      res
        .status(200)
        .type("html")
        .send(
          ogPreviewPage({
            title: urlData.ogTitle,
            description: urlData.ogDescription,
            image: urlData.ogImage,
            destination: urlData.originalUrl,
            shortUrl: buildShortUrl(code),
          })
        );
      return;
    }

    if (!bot) {
      enqueueClickEvent(code, extractClickMeta(req));
    }
    return res.redirect(urlData.originalUrl);
  } catch (error) {
    if (error.statusCode === 410 && wantsHtml(req)) {
      res
        .status(410)
        .type("html")
        .send(simpleMessagePage("Expired", error.message));
      return;
    }
    next(error);
  }
}

export async function urlStats(req, res, next) {
  try {
    let { code } = req.params;

    if (code.includes("/")) {
      const parts = code.split("/").filter(Boolean);
      code = parts[parts.length - 1];
    }

    const stats = await getUrlStatsForOwner(code, req.user.id);
    res.json(withShortUrl(stats));
  } catch (error) {
    next(error);
  }
}

export async function updateUrl(req, res, next) {
  try {
    const updated = await updateUrlForOwner(req.params.code, req.user.id, {
      originalUrl: req.body.originalUrl,
      expiresAt: req.body.expiresAt,
      shortCode: req.body.shortCode,
      disabled: req.body.disabled,
      password: req.body.password,
      clearPassword: req.body.clearPassword,
      utm: req.body.utm,
      ogTitle: req.body.ogTitle,
      ogDescription: req.body.ogDescription,
      ogImage: req.body.ogImage,
      folderId: req.body.folderId,
      tags: req.body.tags,
    });
    res.json(withShortUrl(updated));
  } catch (error) {
    next(error);
  }
}

export async function deleteUrl(req, res, next) {
  try {
    const result = await deleteUrlForOwner(req.params.code, req.user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function urlAnalytics(req, res, next) {
  try {
    const analytics = await getAnalyticsForOwner(req.params.code, req.user.id, {
      from: req.query.from,
      to: req.query.to,
    });
    res.json(analytics);
  } catch (error) {
    next(error);
  }
}

export async function myUrls(req, res, next) {
  try {
    const result = await listUrlsForUser(req.user.id, {
      q: req.query.q,
      sort: req.query.sort,
      order: req.query.order,
      page: req.query.page,
      limit: req.query.limit,
      tag: req.query.tag,
      folderId: req.query.folderId,
    });
    res.json({
      ...result,
      urls: result.urls.map(withShortUrl),
    });
  } catch (error) {
    next(error);
  }
}

export async function urlQr(req, res, next) {
  try {
    const stats = await getUrlStatsForOwner(req.params.code, req.user.id);
    const png = await QRCode.toBuffer(buildShortUrl(stats.shortCode), {
      type: "png",
      width: 320,
      margin: 1,
      errorCorrectionLevel: "M",
    });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(png);
  } catch (error) {
    next(error);
  }
}

export async function publicQr(req, res, next) {
  try {
    const urlData = await findOriginalUrl(req.params.code);
    if (!urlData || urlData.disabled) {
      return res.status(404).json({ message: "URL not found" });
    }
    const png = await QRCode.toBuffer(buildShortUrl(req.params.code), {
      type: "png",
      width: 320,
      margin: 1,
      errorCorrectionLevel: "M",
    });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(png);
  } catch (error) {
    next(error);
  }
}
