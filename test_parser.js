// Test script — run this from your project root to time each step
// Usage: node test-parser.js "path-to-your-bank-statement.xlsx" "your-password"

const fs = require('fs')
const path = require('path')

async function main() {
  const filePath = process.argv[2]
  const password = process.argv[3] || ''

  if (!filePath) {
    console.log('Usage: node test-parser.js <file-path> [password]')
    process.exit(1)
  }

  console.log(`\n📂 Testing: ${filePath}`)
  console.log(`🔐 Password: ${password ? 'provided' : '(none)'}\n`)

  const t0 = Date.now()
  const log = (label) => console.log(`  ${String(Date.now() - t0).padStart(6)}ms  ${label}`)

  // Step 1: Read file
  log('Reading file...')
  const buffer = fs.readFileSync(filePath)
  log(`File loaded — ${buffer.length} bytes`)

  // Step 2: Detect file type from magic bytes
  log('Detecting file type...')
  const bytes = buffer.subarray(0, 4)
  let kind = 'unknown'
  if (bytes[0] === 0x25 && bytes[1] === 0x50) kind = 'pdf'
  else if (bytes[0] === 0x50 && bytes[1] === 0x4B) kind = 'excel-xlsx'
  else if (bytes[0] === 0xD0 && bytes[1] === 0xCF) kind = 'excel-xls (OLE2 — likely encrypted)'
  log(`Detected: ${kind}`)

  // Step 3: Try xlsx parsing
  log('Loading xlsx library...')
  const XLSX = require('xlsx')
  log('xlsx loaded')

  let workbook
  let needsDecryption = false

  log('Trying xlsx.read() without password...')
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', password: password || undefined })
    log('✅ xlsx.read succeeded')
  } catch (e) {
    log(`❌ xlsx.read failed: ${e.message}`)
    needsDecryption = true
  }

  // Step 4: If encrypted, decrypt with officecrypto-tool
  if (needsDecryption) {
    if (!password) {
      log('No password provided, stopping')
      return
    }
    log('Loading officecrypto-tool...')
    const officeCrypto = require('officecrypto-tool')
    log('officecrypto-tool loaded')

    log('Decrypting Excel file...')
    let decrypted
    try {
      decrypted = await officeCrypto.decrypt(buffer, { password })
      log(`✅ Decryption succeeded — ${decrypted.length} bytes`)
    } catch (e) {
      log(`❌ Decryption failed: ${e.message}`)
      return
    }

    log('Parsing decrypted xlsx...')
    workbook = XLSX.read(decrypted, { type: 'buffer' })
    log('✅ Parsed')
  }

  // Step 5: Convert to CSV
  log('Converting to CSV...')
  let allText = ''
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name]
    const csv = XLSX.utils.sheet_to_csv(sheet)
    if (csv.trim()) allText += `\n=== Sheet: ${name} ===\n${csv}\n`
  }
  log(`CSV generated — ${allText.length} chars, ${allText.split('\n').length} lines`)

  // Show first 10 lines
  console.log('\n📄 First 10 lines of CSV:')
  console.log(allText.split('\n').slice(0, 10).join('\n'))

  console.log(`\n⏱️  TOTAL TIME: ${Date.now() - t0}ms\n`)
}

main().catch(e => {
  console.error('Fatal error:', e)
  process.exit(1)
})
