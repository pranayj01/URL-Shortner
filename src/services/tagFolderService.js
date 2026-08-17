import prisma from "../config/db.js";
import { AppError } from "../utils/AppError.js";

function cleanName(name, label = "Name") {
  const value = String(name || "").trim().slice(0, 48);
  if (!value) throw new AppError(`${label} is required`, 400);
  return value;
}

export async function listFolders(userId) {
  return prisma.folder.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, createdAt: true },
  });
}

export async function createFolder(userId, name) {
  const cleaned = cleanName(name, "Folder name");
  try {
    return await prisma.folder.create({
      data: { userId, name: cleaned },
      select: { id: true, name: true, createdAt: true },
    });
  } catch (error) {
    if (error?.code === "P2002") throw new AppError("Folder already exists", 409);
    throw error;
  }
}

export async function deleteFolder(userId, folderId) {
  const folder = await prisma.folder.findFirst({ where: { id: folderId, userId } });
  if (!folder) throw new AppError("Folder not found", 404);
  await prisma.folder.delete({ where: { id: folderId } });
  return { deleted: true, id: folderId };
}

export async function listTags(userId) {
  return prisma.tag.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, createdAt: true },
  });
}

export async function createTag(userId, name) {
  const cleaned = cleanName(name, "Tag name");
  try {
    return await prisma.tag.create({
      data: { userId, name: cleaned },
      select: { id: true, name: true, createdAt: true },
    });
  } catch (error) {
    if (error?.code === "P2002") throw new AppError("Tag already exists", 409);
    throw error;
  }
}

export async function deleteTag(userId, tagId) {
  const tag = await prisma.tag.findFirst({ where: { id: tagId, userId } });
  if (!tag) throw new AppError("Tag not found", 404);
  await prisma.tag.delete({ where: { id: tagId } });
  return { deleted: true, id: tagId };
}

export async function resolveTagIdsForUser(userId, tagNames = []) {
  if (!userId) return [];
  const names = [...new Set(
    (tagNames || [])
      .map((n) => String(n || "").trim().slice(0, 48))
      .filter(Boolean)
  )];
  if (!names.length) return [];

  const existing = await prisma.tag.findMany({
    where: { userId, name: { in: names } },
  });
  const byName = new Map(existing.map((t) => [t.name, t.id]));
  const ids = [];
  for (const name of names) {
    if (byName.has(name)) {
      ids.push(byName.get(name));
      continue;
    }
    const created = await prisma.tag.create({
      data: { userId, name },
    });
    ids.push(created.id);
  }
  return ids;
}

export async function assertFolderOwned(userId, folderId) {
  if (!folderId) return null;
  const folder = await prisma.folder.findFirst({
    where: { id: folderId, userId },
    select: { id: true, name: true },
  });
  if (!folder) throw new AppError("Folder not found", 404);
  return folder;
}
