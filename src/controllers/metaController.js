import {
  listFolders,
  createFolder,
  deleteFolder,
  listTags,
  createTag,
  deleteTag,
} from "../services/tagFolderService.js";
import {
  listWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
} from "../services/webhookCrudService.js";

export async function getFolders(req, res, next) {
  try {
    res.json({ folders: await listFolders(req.user.id) });
  } catch (error) {
    next(error);
  }
}

export async function postFolder(req, res, next) {
  try {
    const folder = await createFolder(req.user.id, req.body?.name);
    res.status(201).json(folder);
  } catch (error) {
    next(error);
  }
}

export async function removeFolder(req, res, next) {
  try {
    res.json(await deleteFolder(req.user.id, req.params.id));
  } catch (error) {
    next(error);
  }
}

export async function getTags(req, res, next) {
  try {
    res.json({ tags: await listTags(req.user.id) });
  } catch (error) {
    next(error);
  }
}

export async function postTag(req, res, next) {
  try {
    const tag = await createTag(req.user.id, req.body?.name);
    res.status(201).json(tag);
  } catch (error) {
    next(error);
  }
}

export async function removeTag(req, res, next) {
  try {
    res.json(await deleteTag(req.user.id, req.params.id));
  } catch (error) {
    next(error);
  }
}

export async function getWebhooks(req, res, next) {
  try {
    res.json({ webhooks: await listWebhooks(req.user.id) });
  } catch (error) {
    next(error);
  }
}

export async function postWebhook(req, res, next) {
  try {
    const webhook = await createWebhook(req.user.id, req.body || {});
    res.status(201).json(webhook);
  } catch (error) {
    next(error);
  }
}

export async function patchWebhook(req, res, next) {
  try {
    const webhook = await updateWebhook(req.user.id, req.params.id, req.body || {});
    res.json(webhook);
  } catch (error) {
    next(error);
  }
}

export async function removeWebhook(req, res, next) {
  try {
    res.json(await deleteWebhook(req.user.id, req.params.id));
  } catch (error) {
    next(error);
  }
}
