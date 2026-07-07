// F4 probe — does av_deductions.ppf survive a visit to the deductions page, and does the live
// "saves" figure agree across /start and /deductions for identical seeded data?
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const ORIGIN = 'http://localhost:3000'
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORT = 9344

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

let nextId = 1
function rpc(ws, method, params = {}) {
  const id = nextId++
  return new Promise((resolve, reject) => {
    const onMsg = (e) => { const m = JSON.parse(e.data); if (m.id === id) { ws.removeEventListener('message', onMsg); m.error ? reject(new Error(method + ': ' + m.error.message)) : resolve(m.result) } }
    ws.addEventListener('message', onMsg); ws.send(JSON.stringify({ id, method, params }))
  })
}
async function evalJS(ws, expr) {
  const r = await rpc(ws, 'Runtime.evaluate', { expression: expr, returnByValue: true })
  return r.result.value
}
const seedExpr = `(()=>{${Object.entries(SEED).map(([k,v])=>`localStorage.setItem(${JSON.stringify(k)},${JSON.stringify(v)});`).join('')}localStorage.setItem('av_theme','light');return 'seeded'})()`
const reseedDed = `localStorage.setItem('av_deductions', JSON.stringify({ppf:90000,employeePF:69120}))`
// Probe payload: stored ded + the "saves ₹X" the VerdictBar shows + the 80C pill if present.
const probe = `(()=>{
  const ded = JSON.parse(localStorage.getItem('av_deductions')||'null');
  const t = document.body.innerText;
  const m = t.match(/saves\\s*₹([\\d,]+)/);
  const c = t.match(/Tax-saving investments[\\s\\S]{0,40}?₹([\\d,]+)/);
  return JSON.stringify({ ppf: ded&&ded.ppf, employeePF: ded&&ded.employeePF, saves: m&&m[1], eighty0C: c&&c[1] });
})()`

async function main() {
  const chrome = spawn(CHROME, [`--remote-debugging-port=${PORT}`, '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${process.cwd()}/.probe-profile`, 'about:blank'], { stdio: 'ignore' })
  let wsUrl
  for (let i = 0; i < 40; i++) { try { wsUrl = (await (await fetch(`http://localhost:${PORT}/json/version`)).json()).webSocketDebuggerUrl; if (wsUrl) break } catch {} await sleep(250) }
  const tgt = await fetch(`http://localhost:${PORT}/json/new?about:blank`, { method: 'PUT' }).then(r => r.json()).catch(() => null)
  const ws = new WebSocket(tgt?.webSocketDebuggerUrl || wsUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  await rpc(ws, 'Page.enable'); await rpc(ws, 'Runtime.enable')
  const go = async (url, wait) => { await rpc(ws, 'Page.navigate', { url: ORIGIN + url }); await sleep(wait) }

  // Land on origin, seed everything.
  await go('/', 1000); await evalJS(ws, seedExpr)

  // A) Direct visit to deductions — does ppf survive?
  await evalJS(ws, reseedDed)
  await go('/dashboard/profile/deductions', 4000)
  console.log('A /deductions (direct):       ', await evalJS(ws, probe))

  // B) Fresh seed → /start, read its saves + ded.
  await go('/', 600); await evalJS(ws, reseedDed)
  await go('/dashboard/tax/start', 4000)
  console.log('B /start:                     ', await evalJS(ws, probe))

  // C) From B's state (no reseed) → navigate to deductions, read saves + ded (the real journey order).
  await go('/dashboard/profile/deductions', 4000)
  console.log('C /deductions (after /start): ', await evalJS(ws, probe))

  // D) Re-read /start again after deductions wrote back, to see if the number moved.
  await go('/dashboard/tax/start', 4000)
  console.log('D /start (after /deductions): ', await evalJS(ws, probe))

  ws.close(); chrome.kill()
}
main().catch(e => { console.error(e); process.exit(1) })
