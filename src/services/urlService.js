import prisma from "../config/db.js";
import { encodeToBase62 } from "../utils/base62.js";

export async function createShortUrl(originalUrl,expiresAt,customAlias) {

    if(customAlias){
    const existing = await prisma.url.findUnique({
        where:{
            shortCode: customAlias  
        }
    });

    if(existing){
        throw new Error("Custom alias already in use");
    }
    await prisma.url.create({
        data:{
            originalUrl,
            expiresAt,
            shortCode: customAlias
        }
    });
    
    return {shortCode: customAlias};
  }

  const urlEntry = await prisma.url.create({
    data:{
        originalUrl: originalUrl,
        expiresAt: expiresAt,
        shortCode: customAlias
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



export async function findOriginalUrl(code){
    
    const urlEntry = await prisma.url.findUnique({
        where:{
            shortCode: code
            
        }
    });

    if(!urlEntry){
        return null;
    }

    if(urlEntry.expiresAt && urlEntry.expiresAt < new Date()){
        throw new Error("URL has expired");

    }

    return {
        originalUrl: urlEntry.originalUrl,
        expiresAt: urlEntry.expiresAt
    }
}
