// Proto gate-walk screenshot driver — raw CDP over the DevTools WebSocket (no deps).
// Launches headless Chrome, seeds localStorage (auth + salary + theme), navigates each
// route at the given theme/width, and writes a PNG per scenario for eyeballing.
//
// Usage: node scripts/gatewalk.mjs
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

const ORIGIN = 'http://localhost:3000'
const OUT = 'gatewalk-shots'
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORT = 9333
mkdirSync(OUT, { recursive: true })

// A realistic seed: a confirmed single slip + summary + mock auth user, so every computed
// state renders (verdict, regime cards, exactness). Monthly gross 1,20,000.
const M = 120000, basic = 48000, hra = 24000, net = 108000
const slip = { grossSalary: M, basicSalary: basic, hra, specialAllowance: 36000, otherAllowances: 12000,
  employeePF: 5760, professionalTax: 200, tdsDeducted: 9000, netSalary: net, month: 'March', year: '2026', employerName: 'Acme Corp' }
const SEED = {
  as_user: JSON.stringify({ name: 'Test User', email: 'test@arthvo.in' }),
  av_salary_timeline: JSON.stringify([slip]),
  av_salary_summary: JSON.stringify({ annualGross: M * 12, annualNet: net * 12, annualTDS: 9000 * 12, fyStartYear: 2026,
    hraBasis: Array.from({ length: 12 }, () => ({ basic, hra })) }),
  av_deductions: JSON.stringify({ ppf: 90000, employeePF: 69120 }),
  av_exemptions: JSON.stringify({ hra: { rentPaid: 30000, hraReceived: hra, isMetro: true, annualExemption: 168000 } }),
}

// Scenarios: [route, label]. Themes and widths are crossed below.
const ROUTES = [
  ['/try?m=120000', 'try'],
  ['/dashboard/tax/confirm', 'confirm'],
  ['/dashboard/tax/start', 'start'],
  ['/dashboard/tax/wizard', 'wizard'],
  ['/dashboard/profile/deductions', 'deductions'],
  ['/dashboard/profile/exemptions', 'exemptions'],
  ['/dashboard/tax/optimizer', 'optimizer'],
  ['/', 'landing'],
]
const THEMES = ['light', 'dark']
const WIDTHS = [[1280, 900, 'desktop'], [320, 720, 'm320']]

let nextId = 1
// Node 24's global WebSocket is the WHATWG API: addEventListener('message', e => e.data), not .on().
function rpc(ws, method, params = {}) {
  const id = nextId++
  return new Promise((resolve, reject) => {
    const onMsg = (event) => {
      const msg = JSON.parse(typeof event.data === 'string' ? event.data : event.data.toString())
      if (msg.id === id) { ws.removeEventListener('message', onMsg); msg.error ? reject(new Error(method + ': ' + msg.error.message)) : resolve(msg.result) }
    }
    ws.addEventListener('message', onMsg)
    ws.send(JSON.stringify({ id, method, params }))
  })
}

async function main() {
  const chrome = spawn(CHROME, [
    `--remote-debugging-port=${PORT}`, '--headless=new', '--disable-gpu', '--hide-scrollbars',
    '--no-first-run', '--no-default-browser-check', `--user-data-dir=${process.cwd()}/.gatewalk-profile`,
    'about:blank',
  ], { stdio: 'ignore' })

  // Wait for the debugging endpoint.
  let wsUrl
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://localhost:${PORT}/json/version`)
      wsUrl = (await r.json()).webSocketDebuggerUrl
      if (wsUrl) break
    } catch {}
    await sleep(250)
  }
  if (!wsUrl) throw new Error('Chrome DevTools endpoint never came up')

  // Open a fresh page target and attach.
  const tgt = await fetch(`http://localhost:${PORT}/json/new?about:blank`, { method: 'PUT' }).then(r => r.json()).catch(() => null)
  const pageWsUrl = tgt?.webSocketDebuggerUrl || wsUrl
  const ws = new WebSocket(pageWsUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })

  await rpc(ws, 'Page.enable')
  await rpc(ws, 'Runtime.enable')
  await rpc(ws, 'Emulation.setEmulatedMedia', { features: [] })

  const navAndShoot = async (route, theme, [w, h, wlabel], label) => {
    const file = `${OUT}/${label}__${theme}__${wlabel}.png`
    if (existsSync(file)) { process.stdout.write(`skip ${file}\n`); return }
    await rpc(ws, 'Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 768 })
    // 1) Land on origin (landing page — no client construction on mount) so localStorage is writable.
    await rpc(ws, 'Page.navigate', { url: ORIGIN + '/' })
    await sleep(900)
    // 2) Seed storage + theme.
    const seedJs = `(() => { try {
      ${Object.entries(SEED).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)});`).join('\n')}
      localStorage.setItem('av_theme', ${JSON.stringify(theme)});
      return 'ok'
    } catch(e){ return String(e) } })()`
    await rpc(ws, 'Runtime.evaluate', { expression: seedJs })
    // 3) Navigate to the target route.
    await rpc(ws, 'Page.navigate', { url: ORIGIN + route })
    await sleep(2600) // compile (first hit) + client render + count-up settle
    // Force prefers-color-scheme so 'system' resolution can't fight our explicit av_theme.
    await rpc(ws, 'Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }] })
    await sleep(400)
    const { data } = await rpc(ws, 'Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
    writeFileSync(file, Buffer.from(data, 'base64'))
    process.stdout.write(`shot ${file}\n`)
  }

  for (const [route, label] of ROUTES) {
    for (const theme of THEMES) {
      for (const width of WIDTHS) {
        try { await navAndShoot(route, theme, width, label) }
        catch (e) { process.stdout.write(`FAIL ${label} ${theme} ${width[2]}: ${e.message}\n`) }
      }
    }
  }

  ws.close()
  chrome.kill()
  process.stdout.write('DONE\n')
}
main().catch(e => { console.error(e); process.exit(1) })
