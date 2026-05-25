#!/usr/bin/env bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "========================================="
echo "  Wire DB persistence into routes"
echo "========================================="
echo ""

if [ ! -f "package.json" ]; then
  echo -e "${RED}ERROR: Run from project root.${NC}"
  exit 1
fi

# ─── 1. PATCH parse-salary/route.ts ───────────────────────────────

echo -e "${YELLOW}[1/3]${NC} Patching parse-salary/route.ts..."

SALARY_FILE="src/app/api/parse-salary/route.ts"
cp "$SALARY_FILE" "$SALARY_FILE.bak"

# Add imports after the last existing import
sed -i '' '/^import type { ParsedSalaryData } from/a\
import { prisma } from "@/lib/db"\
import { logActivity } from "@/lib/activity"
' "$SALARY_FILE"

# Replace the success return with response + fire-and-forget persist
# We find the exact return block and replace it
python3 << 'PYEOF'
import re

with open("src/app/api/parse-salary/route.ts", "r") as f:
    content = f.read()

old_return = """    return NextResponse.json({
      success: true,
      data: validSlips,
      count: validSlips.length,
      skipped: parsedSlips.length - validSlips.length,
      errors: errors.length > 0 ? errors : undefined,
    })"""

new_return = """    const response = NextResponse.json({
      success: true,
      data: validSlips,
      count: validSlips.length,
      skipped: parsedSlips.length - validSlips.length,
      errors: errors.length > 0 ? errors : undefined,
    })

    // Fire-and-forget: persist salary slips to DB
    Promise.resolve().then(async () => {
      try {
        for (const slip of validSlips) {
          const netPay = slip.netSalary || slip.netPay || 0
          if (netPay <= 0) continue
          const period = slip.payPeriod || new Date().toISOString().slice(0, 7) + '-01'
          await prisma.salarySlip.upsert({
            where: {
              userId_periodMonth: {
                userId: 'anonymous',
                periodMonth: new Date(period),
              },
            },
            update: {
              employer: slip.employerName || null,
              netPay,
              components: JSON.parse(JSON.stringify(slip)),
            },
            create: {
              userId: 'anonymous',
              periodMonth: new Date(period),
              employer: slip.employerName || null,
              netPay,
              components: JSON.parse(JSON.stringify(slip)),
            },
          })
        }
        await logActivity('anonymous', 'SALARY_PARSE_SUCCESS', null, {
          count: validSlips.length,
          netPay: validSlips[0]?.netSalary || validSlips[0]?.netPay,
        })
      } catch (e) {
        console.error('[parse-salary] DB write failed (non-blocking):', e)
      }
    })

    return response"""

if old_return in content:
    content = content.replace(old_return, new_return)
    with open("src/app/api/parse-salary/route.ts", "w") as f:
        f.write(content)
    print("  ✓ Salary route patched")
else:
    print("  ⚠ Could not find exact return block — check manually")
PYEOF

echo -e "${GREEN}  ✓ parse-salary patched${NC}"

# ─── 2. PATCH parse-bank-statement/route.ts ───────────────────────

echo -e "${YELLOW}[2/3]${NC} Patching parse-bank-statement/route.ts..."

BANK_FILE="src/app/api/parse-bank-statement/route.ts"
cp "$BANK_FILE" "$BANK_FILE.bak"

python3 << 'PYEOF'
with open("src/app/api/parse-bank-statement/route.ts", "r") as f:
    content = f.read()

# 1. Add imports after the last existing import line
import_anchor = "import type { IntelligenceReport } from '@/lib/txn-intelligence'"
new_imports = """import type { IntelligenceReport } from '@/lib/txn-intelligence'
import { prisma } from '@/lib/db'
import { logActivity } from '@/lib/activity'
import { hashBuffer } from '@/lib/storage'"""

content = content.replace(import_anchor, new_imports)

# 2. Replace ALL five return NextResponse.json patterns with response + persist
# Pattern: each success return that includes `data: localResult` or `data: haikuData`

# Helper: wrap a return in response + persist
def wrap_return(content, old_return, var_name, data_var, has_intelligence):
    intel_arg = "intelligence" if has_intelligence else "null"
    new_return = f"""const {var_name} = {old_return.replace('return ', '')}
            persistStatement(buffer, fileName, {data_var}, {intel_arg}).catch(e =>
              console.error('[bank-parse] DB persist failed (non-blocking):', e)
            )
            return {var_name}"""
    return content.replace(old_return, new_return)

# Fast path 1: Excel with pipeline success
old1 = """            return NextResponse.json({
              data: localResult,
              pipeline: pipelineReport,
              intelligence,
              fileKind,
              parsedLocally: true,
            })"""
new1 = """            const resp1 = NextResponse.json({
              data: localResult,
              pipeline: pipelineReport,
              intelligence,
              fileKind,
              parsedLocally: true,
            })
            persistStatement(buffer, fileName, localResult, intelligence).catch(e =>
              console.error('[bank-parse] DB persist failed (non-blocking):', e)
            )
            return resp1"""
content = content.replace(old1, new1, 1)

# Fast path 2: Excel with pipeline fail
old2 = """            return NextResponse.json({
              data: localResult,
              pipeline: null,
              fileKind,
              parsedLocally: true,
            })"""
new2 = """            const resp2 = NextResponse.json({
              data: localResult,
              pipeline: null,
              fileKind,
              parsedLocally: true,
            })
            persistStatement(buffer, fileName, localResult, null).catch(e =>
              console.error('[bank-parse] DB persist failed (non-blocking):', e)
            )
            return resp2"""
content = content.replace(old2, new2, 1)

# Fast path 3: PDF with pipeline success (same shape as old1 but second occurrence)
# After replacing old1 once, the next occurrence of the same pattern is for PDF
old3 = """            return NextResponse.json({
              data: localResult,
              pipeline: pipelineReport,
              intelligence,
              fileKind: 'pdf',
              parsedLocally: true,
            })"""
new3 = """            const resp3 = NextResponse.json({
              data: localResult,
              pipeline: pipelineReport,
              intelligence,
              fileKind: 'pdf',
              parsedLocally: true,
            })
            persistStatement(buffer, fileName, localResult, intelligence).catch(e =>
              console.error('[bank-parse] DB persist failed (non-blocking):', e)
            )
            return resp3"""
content = content.replace(old3, new3, 1)

# Fast path 4: PDF with pipeline fail
old4 = """            return NextResponse.json({
              data: localResult,
              pipeline: null,
              fileKind: 'pdf',
              parsedLocally: true,
            })"""
new4 = """            const resp4 = NextResponse.json({
              data: localResult,
              pipeline: null,
              fileKind: 'pdf',
              parsedLocally: true,
            })
            persistStatement(buffer, fileName, localResult, null).catch(e =>
              console.error('[bank-parse] DB persist failed (non-blocking):', e)
            )
            return resp4"""
content = content.replace(old4, new4, 1)

# Fast path 5: Haiku fallback (bottom of route)
old5 = """    return NextResponse.json({
      data: haikuData,
      pipeline: pipelineReport,
      intelligence,
      fileKind: result.kind,
      parsedLocally: false,
    })"""
new5 = """    const resp5 = NextResponse.json({
      data: haikuData,
      pipeline: pipelineReport,
      intelligence,
      fileKind: result.kind,
      parsedLocally: false,
    })
    persistStatement(buffer, fileName, haikuData, intelligence).catch(e =>
      console.error('[bank-parse] DB persist failed (non-blocking):', e)
    )
    return resp5"""
content = content.replace(old5, new5, 1)

# 3. Add persistStatement function at the very end
persist_fn = """

// ─── DB PERSISTENCE (fire-and-forget, never blocks response) ────────────────

async function persistStatement(
  buffer: Buffer,
  fileName: string,
  localResult: any,
  intelligence: IntelligenceReport | null,
) {
  try {
    const contentHash = hashBuffer(buffer)
    const txnCount = localResult.transactions?.length || 0

    const statement = await prisma.statement.upsert({
      where: {
        userId_contentHash: { userId: 'anonymous', contentHash },
      },
      update: { txnCount, parsedAt: new Date() },
      create: {
        userId: 'anonymous',
        originalName: fileName,
        contentHash,
        storagePath: '',
        fileSize: buffer.length,
        txnCount,
        parsedAt: new Date(),
      },
    })

    await logActivity('anonymous', 'STATEMENT_PARSE_SUCCESS', statement.id, {
      fileName,
      txnCount,
      bank: localResult.bank || 'unknown',
    })
  } catch (e) {
    console.error('[persistStatement]', e)
  }
}
"""

content = content + persist_fn

with open("src/app/api/parse-bank-statement/route.ts", "w") as f:
    f.write(content)

print("  ✓ Bank statement route patched")
PYEOF

echo -e "${GREEN}  ✓ parse-bank-statement patched${NC}"

# ─── 3. PATCH chat/route.ts ───────────────────────────────────────

echo -e "${YELLOW}[3/3]${NC} Patching chat/route.ts..."

CHAT_FILE="src/app/api/chat/route.ts"
cp "$CHAT_FILE" "$CHAT_FILE.bak"

python3 << 'PYEOF'
with open("src/app/api/chat/route.ts", "r") as f:
    content = f.read()

# Add import
old_import = "import { streamChatResponse } from '@/lib/claude'"
new_import = """import { streamChatResponse } from '@/lib/claude'
import { logActivity } from '@/lib/activity'"""
content = content.replace(old_import, new_import)

# Add log after destructuring
old_destructure = "    const { messages, userContext } = body"
new_destructure = """    const { messages, userContext } = body

    // Fire-and-forget: log chat activity
    logActivity('anonymous', 'CHAT_MESSAGE_SENT', null, {
      messageCount: messages?.length || 0,
    }).catch(() => {})"""
content = content.replace(old_destructure, new_destructure)

with open("src/app/api/chat/route.ts", "w") as f:
    f.write(content)

print("  ✓ Chat route patched")
PYEOF

echo -e "${GREEN}  ✓ chat patched${NC}"

# ─── ENSURE anonymous user exists ─────────────────────────────────

echo -e "${YELLOW}[+]${NC} Creating anonymous user in DB..."

cat > /tmp/seed-anon.mjs << 'SEEDEOF'
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
await prisma.user.upsert({
  where: { id: "anonymous" },
  update: {},
  create: { id: "anonymous", email: "anonymous@arthvo.local" },
});
console.log("✅ Anonymous user ready");
process.exit(0);
SEEDEOF

npx tsx /tmp/seed-anon.mjs
rm /tmp/seed-anon.mjs

# ─── DONE ─────────────────────────────────────────────────────────

echo ""
echo "========================================="
echo -e "  ${GREEN}✓ ALL ROUTES WIRED${NC}"
echo "========================================="
echo ""
echo "  Modified files (backups created):"
echo "    src/app/api/parse-salary/route.ts       (.bak saved)"
echo "    src/app/api/parse-bank-statement/route.ts (.bak saved)"
echo "    src/app/api/chat/route.ts                (.bak saved)"
echo ""
echo "  What happens now:"
echo "    - Upload a salary slip → saved to SalarySlip table"
echo "    - Upload a bank statement → saved to Statement table"  
echo "    - Send a chat message → logged to ActivityEvent table"
echo "    - All fire-and-forget — if DB is down, app works as before"
echo ""
echo "  To test: npm run dev → upload something → check Supabase Table Editor"
echo "  To revert: mv src/app/api/parse-salary/route.ts.bak src/app/api/parse-salary/route.ts"
echo ""
