-- CreateTable
CREATE TABLE "URL" (
    "id" SERIAL NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "shortCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "URL_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "URL_shortCode_key" ON "URL"("shortCode");
