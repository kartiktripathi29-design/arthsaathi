import { prisma } from "@/lib/db";
import type { Category } from "../../generated/prisma/client";

export type ReviewBucket = {
  category: Category;
  total: number;
  txnCount: number;
};

export async function getReviewBuckets(userId: string): Promise<ReviewBucket[]> {
  const rows = await prisma.transaction.groupBy({
    by: ["category"],
    where: { userId },
    _sum: { amount: true },
    _count: { _all: true },
  });
  return rows.map((r) => ({
    category: r.category,
    total: r._sum.amount?.toNumber() ?? 0,
    txnCount: r._count._all,
  }));
}

export async function getPersonLedger(userId: string) {
  const persons = await prisma.transactionTag.findMany({
    where: {
      kind: "PERSON",
      transaction: { userId, category: "TRANSFER_TO_PERSONS" },
    },
    select: {
      value: true,
      transaction: {
        select: { id: true, txnDate: true, amount: true, what: true, why: true, rawNarration: true },
      },
    },
  });

  type Agg = { name: string; txnCount: number; totalAbs: number; txns: typeof persons[number]["transaction"][] };
  const byPerson = new Map<string, Agg>();
  for (const p of persons) {
    const agg = byPerson.get(p.value) ?? { name: p.value, txnCount: 0, totalAbs: 0, txns: [] };
    agg.txnCount += 1;
    agg.totalAbs += Math.abs(p.transaction.amount.toNumber());
    agg.txns.push(p.transaction);
    byPerson.set(p.value, agg);
  }
  return Array.from(byPerson.values()).sort((a, b) => b.totalAbs - a.totalAbs);
}

export async function listStatements(userId: string) {
  return prisma.statement.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { transactions: true } }, account: true },
  });
}
