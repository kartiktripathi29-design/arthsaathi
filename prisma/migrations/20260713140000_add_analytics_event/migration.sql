-- Time-stamped funnel/health events for /api/health last-hour counters (Step 3, launch monitoring).
-- Created for review (not applied to the shared DB by the assistant); applies via `prisma migrate deploy`.

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalyticsEvent_key_at_idx" ON "AnalyticsEvent"("key", "at");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_at_idx" ON "AnalyticsEvent"("at");
