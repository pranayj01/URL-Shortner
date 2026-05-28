/*
  Warnings:

  - You are about to drop the `URL` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "URL";

-- CreateTable
CREATE TABLE "Url" (
    "id" SERIAL NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "shortCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Url_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Url_shortCode_key" ON "Url"("shortCode");
