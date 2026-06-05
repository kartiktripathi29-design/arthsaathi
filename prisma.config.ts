import "dotenv/config";
import { defineConfig } from "prisma/config";

// Migrations prefer a direct (non-pooled) connection, falling back to DATABASE_URL when
// DIRECT_DATABASE_URL isn't set. NOTE: prisma/config's `env()` *throws* on a missing variable, so
// it can't express this fallback — reading process.env directly does.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL,
  },
});
