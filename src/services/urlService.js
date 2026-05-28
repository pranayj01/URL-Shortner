import prisma from "../config/db.js";
import { encodeToBase62 } from "../utils/base62.js";

export async function createShortUrl(originalUrl) {
 
  const urlEntry = await prisma.url.create({
    data:{
        originalUrl: originalUrl
    }
});
  const code = encodeToBase62(urlEntry.id);
  await prisma.url.update({
    where:{
        id:urlEntry.id
    },
    data:{
        shortCode:code
    }
});
  return  {shortCode: code};
}

export async function findOriginalUrl(code) {
  // TODO: implement lookup logic for the original URL by short code
  if (code) {
    const urlEntry = await prisma.url.findUnique({
      where: {
        shortCode: code
      }
    });
    return urlEntry ? urlEntry.originalUrl : null;
  }
  return null;
}
