import { prisma } from "@/lib/db";
import type { EventType } from "../../generated/prisma/client";

export async function logActivity(
  userId: string,
  eventType: EventType,
  targetId?: string | null,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.activityEvent.create({
      data: {
        userId,
        eventType,
        targetId: targetId ?? null,
        metadata: metadata ?? {},
      },
    });
  } catch (e) {
    console.error("[activity-log] Failed:", eventType, e);
  }
}

export async function logLogin(
  userId: string,
  req?: { headers?: Headers },
): Promise<void> {
  const meta: Record<string, unknown> = { method: "magic_link" };
  if (req?.headers) {
    meta.userAgent = req.headers.get("user-agent") ?? "unknown";
    meta.ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  }
  return logActivity(userId, "LOGIN", null, meta);
}

export async function logClassification(
  userId: string,
  transactionId: string,
  from: string,
  to: string,
): Promise<void> {
  return logActivity(userId, "TXN_CLASSIFY", transactionId, { from, to });
}
