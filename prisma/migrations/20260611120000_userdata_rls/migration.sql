-- Enable Row Level Security on UserData.
--
-- UserData (BUG-8 cloud-sync, migration 20260605120000) shipped WITHOUT RLS because it
-- was added after prisma/rls.sql was authored, and that file was never updated. As a
-- result the table was readable/writable by anyone holding the public (anon) key via the
-- Supabase Data API / PostgREST -- flagged by the Supabase Security Advisor.
--
-- This mirrors the owner-only pattern used for every other user-scoped table in
-- prisma/rls.sql. The app's own cloud-sync route writes via Prisma (DB owner role, which
-- bypasses RLS), so enabling RLS here does NOT affect that feature -- it only closes the
-- public Data API door.

ALTER TABLE "UserData" ENABLE ROW LEVEL SECURITY;

CREATE POLICY userdata_owner ON "UserData" FOR ALL TO authenticated
  USING ("userId" = (select auth.uid())::text)
  WITH CHECK ("userId" = (select auth.uid())::text);
