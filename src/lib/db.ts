// Lightweight in-memory/file store for local dev
// Replace with Prisma + Postgres for production

export const db = {
  salarySlips: [] as any[],
  chatMessages: [] as any[],
  goals: [] as any[],
}
