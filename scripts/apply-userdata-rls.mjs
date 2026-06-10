// One-off: enable RLS + owner policy on "UserData" (Supabase Security Advisor fix).
// Idempotent: safe to re-run. Connects via DIRECT_DATABASE_URL (non-pooled).
import { config } from 'dotenv'
import pg from 'pg'

config({ path: '.env.local' })

const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL
if (!url) { console.error('No DIRECT_DATABASE_URL / DATABASE_URL'); process.exit(1) }

const client = new pg.Client({ connectionString: url })

async function main() {
  await client.connect()

  // 1) Enable RLS (no-op if already enabled)
  await client.query('ALTER TABLE "UserData" ENABLE ROW LEVEL SECURITY;')
  console.log('RLS enabled on "UserData"')

  // 2) Create owner policy only if absent (CREATE POLICY has no IF NOT EXISTS)
  const exists = await client.query(
    `SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='UserData' AND policyname='userdata_owner'`
  )
  if (exists.rowCount > 0) {
    console.log('Policy userdata_owner already exists - skipping')
  } else {
    await client.query(
      `CREATE POLICY userdata_owner ON "UserData" FOR ALL TO authenticated
         USING ("userId" = (select auth.uid())::text)
         WITH CHECK ("userId" = (select auth.uid())::text);`
    )
    console.log('Policy userdata_owner created')
  }

  // 3) Verify
  const v = await client.query(
    `SELECT c.relrowsecurity AS rls_enabled,
            (SELECT count(*) FROM pg_policies p WHERE p.schemaname='public' AND p.tablename='UserData') AS policy_count
       FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='UserData'`
  )
  console.log('VERIFY:', JSON.stringify(v.rows[0]))
}

main()
  .catch((e) => { console.error('FAILED:', e.message); process.exitCode = 1 })
  .finally(() => client.end())
