-- AlterTable
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Url" ADD COLUMN "disabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Url" ADD COLUMN "passwordHash" TEXT;

-- CreateIndex
CREATE INDEX "Url_userId_createdAt_idx" ON "Url"("userId", "createdAt" DESC);

-- AlterTable
ALTER TABLE "ClickEvent" ADD COLUMN "country" TEXT;
ALTER TABLE "ClickEvent" ADD COLUMN "device" TEXT;
ALTER TABLE "ClickEvent" ADD COLUMN "browser" TEXT;
ALTER TABLE "ClickEvent" ADD COLUMN "referrer" TEXT;
ALTER TABLE "ClickEvent" ADD COLUMN "utmSource" TEXT;
ALTER TABLE "ClickEvent" ADD COLUMN "utmMedium" TEXT;
ALTER TABLE "ClickEvent" ADD COLUMN "utmCampaign" TEXT;
ALTER TABLE "ClickEvent" ADD COLUMN "urlId" INTEGER;

-- Backfill urlId from shortCode
UPDATE "ClickEvent" AS c
SET "urlId" = u.id
FROM "Url" AS u
WHERE u."shortCode" = c."shortCode";

-- DropIndex
DROP INDEX IF EXISTS "ClickEvent_shortCode_idx";
DROP INDEX IF EXISTS "ClickEvent_clickedAt_idx";

-- CreateIndex
CREATE INDEX "ClickEvent_shortCode_clickedAt_idx" ON "ClickEvent"("shortCode", "clickedAt");

-- AddForeignKey
ALTER TABLE "ClickEvent" ADD CONSTRAINT "ClickEvent_urlId_fkey" FOREIGN KEY ("urlId") REFERENCES "Url"("id") ON DELETE CASCADE ON UPDATE CASCADE;
