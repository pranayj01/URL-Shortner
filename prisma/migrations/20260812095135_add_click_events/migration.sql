-- CreateTable
CREATE TABLE "ClickEvent" (
    "id" SERIAL NOT NULL,
    "shortCode" TEXT NOT NULL,
    "clickedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClickEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClickEvent_shortCode_idx" ON "ClickEvent"("shortCode");

-- CreateIndex
CREATE INDEX "ClickEvent_clickedAt_idx" ON "ClickEvent"("clickedAt");
