-- Phase-1 email capture on /try + minimal server-side analytics counter.
-- Created for review (not applied to the shared DB by the assistant); applies via `prisma migrate deploy`.

-- CreateTable
CREATE TABLE "EmailCapture" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'try-verdict',
    "verdictFY" INTEGER NOT NULL,
    "verdictAmount" INTEGER,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unsubscribed" BOOLEAN NOT NULL DEFAULT false,
    "unsubscribeToken" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailCapture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsCounter" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsCounter_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailCapture_email_key" ON "EmailCapture"("email");

-- CreateIndex
CREATE UNIQUE INDEX "EmailCapture_unsubscribeToken_key" ON "EmailCapture"("unsubscribeToken");

-- CreateIndex
CREATE INDEX "EmailCapture_capturedAt_idx" ON "EmailCapture"("capturedAt");
