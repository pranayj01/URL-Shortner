-- AlterTable
ALTER TABLE "Url" ADD COLUMN "ogTitle" TEXT;
ALTER TABLE "Url" ADD COLUMN "ogDescription" TEXT;
ALTER TABLE "Url" ADD COLUMN "ogImage" TEXT;
ALTER TABLE "Url" ADD COLUMN "folderId" TEXT;

-- CreateTable
CREATE TABLE "Folder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Folder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Folder_userId_name_key" ON "Folder"("userId", "name");
CREATE INDEX "Folder_userId_idx" ON "Folder"("userId");

CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tag_userId_name_key" ON "Tag"("userId", "name");
CREATE INDEX "Tag_userId_idx" ON "Tag"("userId");

CREATE TABLE "UrlTag" (
    "urlId" INTEGER NOT NULL,
    "tagId" TEXT NOT NULL,
    CONSTRAINT "UrlTag_pkey" PRIMARY KEY ("urlId","tagId")
);

CREATE INDEX "UrlTag_tagId_idx" ON "UrlTag"("tagId");

CREATE TABLE "Webhook" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT,
    "events" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Webhook_userId_idx" ON "Webhook"("userId");

CREATE INDEX "Url_folderId_idx" ON "Url"("folderId");

ALTER TABLE "Folder" ADD CONSTRAINT "Folder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UrlTag" ADD CONSTRAINT "UrlTag_urlId_fkey" FOREIGN KEY ("urlId") REFERENCES "Url"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UrlTag" ADD CONSTRAINT "UrlTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Url" ADD CONSTRAINT "Url_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
