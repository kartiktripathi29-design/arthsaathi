// Test Claude API call locally with the actual CSV data
// Usage: node test_claude.js
// Needs ANTHROPIC_API_KEY in environment or .env.local

const fs = require('fs')
const path = require('path')

// Load env from .env.local
try {
  const env = fs.readFileSync('.env.local', 'utf8')
  env.split('\n').forEach(line => {
    const [k, ...v] = line.split('=')
    if (k && v.length) process.env[k.trim()] = v.join('=').trim()
  })
} catch {}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('❌ No ANTHROPIC_API_KEY found in .env.local')
    process.exit(1)
  }
  console.log('✓ API key found:', apiKey.slice(0, 8) + '...')

  // Read the PNB xls and convert to CSV (same as our parser)
  let csvText = ''
  try {
    const XLSX = require('xlsx')
    const buffer = fs.readFileSync('pnb.xls')

    // Decrypt first
    let workbook
    try {
      workbook = XLSX.read(buffer, { type: 'buffer' })
    } catch {
      const officeCrypto = require('officecrypto-tool')
      const password = process.argv[2] || '1466010026594'
      const decrypted = await officeCrypto.decrypt(buffer, { password })
      workbook = XLSX.read(decrypted, { type: 'buffer' })
    }

    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name]
      csvText += XLSX.utils.sheet_to_csv(sheet)
    }
    console.log(`✓ CSV ready: ${csvText.length} chars`)
  } catch (e) {
    console.error('❌ File parsing failed:', e.message)
    process.exit(1)
  }

  // Test 1: Simple call without tool calling
  console.log('\n--- Test 1: Haiku, NO tool calling, just text ---')
  let t = Date.now()
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        messages: [{ role: 'user', content: `Say "ok" if you can read this (${csvText.length} chars of bank data)` }]
      }),
      signal: AbortSignal.timeout(15000)
    })
    const data = await res.json()
    console.log(`✓ Response in ${Date.now()-t}ms:`, data.content?.[0]?.text || JSON.stringify(data).slice(0,100))
  } catch (e) {
    console.log(`❌ Failed in ${Date.now()-t}ms:`, e.message)
  }

  // Test 2: Haiku with tool calling but small input
  console.log('\n--- Test 2: Haiku, tool calling, small input ---')
  t = Date.now()
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        tools: [{
          name: 'test_tool',
          description: 'Return a test result',
          input_schema: {
            type: 'object',
            properties: { result: { type: 'string' } },
            required: ['result']
          }
        }],
        tool_choice: { type: 'tool', name: 'test_tool' },
        messages: [{ role: 'user', content: 'Return result: "ok"' }]
      }),
      signal: AbortSignal.timeout(15000)
    })
    const data = await res.json()
    const tool = data.content?.find(c => c.type === 'tool_use')
    console.log(`✓ Response in ${Date.now()-t}ms:`, tool?.input || JSON.stringify(data).slice(0,150))
  } catch (e) {
    console.log(`❌ Failed in ${Date.now()-t}ms:`, e.message)
  }

  // Test 3: Haiku with tool calling and FULL CSV
  console.log('\n--- Test 3: Haiku, tool calling, FULL bank CSV ---')
  t = Date.now()
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 16000,
        tools: [{
          name: 'submit',
          description: 'Submit transaction count',
          input_schema: {
            type: 'object',
            properties: { count: { type: 'number' }, sample: { type: 'string' } },
            required: ['count', 'sample']
          }
        }],
        tool_choice: { type: 'tool', name: 'submit' },
        messages: [{ role: 'user', content: `Count the transactions in this bank statement and return the first merchant name:\n\n${csvText}` }]
      }),
      signal: AbortSignal.timeout(30000)
    })
    const data = await res.json()
    const tool = data.content?.find(c => c.type === 'tool_use')
    console.log(`✓ Response in ${Date.now()-t}ms:`, tool?.input || JSON.stringify(data).slice(0,200))
  } catch (e) {
    console.log(`❌ Failed in ${Date.now()-t}ms:`, e.message)
  }

  console.log('\n✅ All tests done')
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
