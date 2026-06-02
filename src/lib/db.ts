import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Check .env.local.");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

// Resolve (and cache) the real client on first use. The client is reused across hot-reloads
// in dev via the global, and is created once per process in production.
function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

// Lazy Proxy. Previously `export const prisma = createPrismaClient()` ran at import time, so a
// missing/invalid DATABASE_URL threw during module load — taking down EVERY route that imports
// this file, even routes whose DB writes are deliberately fire-and-forget / try-caught (e.g.
// parse-salary). With a Proxy the client is instantiated only on first property access, so import
// never throws and a DB misconfig surfaces at the call site where it can be caught.
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma();
    const value = (client as never)[prop as never] as unknown;
    // Bind client methods ($transaction, $queryRaw, $connect, …) so `this` stays correct.
    // Model delegates (prisma.user, prisma.salarySlip, …) are objects and pass through as-is.
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(client) : value;
  },
});
