// F4b — sample the deductions page right after navigation to catch the mount-time write-back flicker.
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
const ORIGIN = 'http://localhost:3000', CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe', PORT = 9345
const M=120000, basic=48000, hra=24000, net=108000
const slip={grossSalary:M,basicSalary:basic,hra,specialAllowance:36000,otherAllowances:12000,employeePF:5760,professionalTax:200,tdsDeducted:9000,netSalary:net,month:'March',year:'2026',employerName:'Acme Corp'}
const SEED={as_user:JSON.stringify({name:'Test User',email:'t@a.in'}),av_salary_timeline:JSON.stringify([slip]),av_salary_summary:JSON.stringify({annualGross:M*12,annualNet:net*12,annualTDS:108000,fyStartYear:2026,hraBasis:Array.from({length:12},()=>({basic,hra}))}),av_deductions:JSON.stringify({ppf:90000,employeePF:69120}),av_exemptions:JSON.stringify({hra:{rentPaid:30000,hraReceived:hra,isMetro:true,annualExemption:168000}})}
let id=1
const rpc=(ws,method,params={})=>new Promise((res,rej)=>{const i=id++;const f=e=>{const m=JSON.parse(e.data);if(m.id===i){ws.removeEventListener('message',f);m.error?rej(new Error(m.error.message)):res(m.result)}};ws.addEventListener('message',f);ws.send(JSON.stringify({id:i,method,params}))})
const ev=async(ws,x)=>(await rpc(ws,'Runtime.evaluate',{expression:x,returnByValue:true})).result.value
const seedExpr=`(()=>{${Object.entries(SEED).map(([k,v])=>`localStorage.setItem(${JSON.stringify(k)},${JSON.stringify(v)});`).join('')}localStorage.setItem('av_theme','light');return 1})()`
const probe=`(()=>{const d=JSON.parse(localStorage.getItem('av_deductions')||'null');const m=document.body.innerText.match(/saves\\s*₹([\\d,]+)/);return (d&&d.ppf)+'|empPF='+(d&&d.employeePF)+'|saves='+(m&&m[1])})()`
async function main(){
  const ch=spawn(CHROME,[`--remote-debugging-port=${PORT}`,'--headless=new','--disable-gpu','--no-first-run',`--user-data-dir=${process.cwd()}/.probe-profile2`,'about:blank'],{stdio:'ignore'})
  let u;for(let i=0;i<40;i++){try{u=(await(await fetch(`http://localhost:${PORT}/json/version`)).json()).webSocketDebuggerUrl;if(u)break}catch{}await sleep(250)}
  const t=await fetch(`http://localhost:${PORT}/json/new?about:blank`,{method:'PUT'}).then(r=>r.json()).catch(()=>null)
  const ws=new WebSocket(t?.webSocketDebuggerUrl||u);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j})
  await rpc(ws,'Page.enable');await rpc(ws,'Runtime.enable')
  await rpc(ws,'Page.navigate',{url:ORIGIN+'/'});await sleep(1200);await ev(ws,seedExpr)
  // Navigate to deductions and sample fast.
  await rpc(ws,'Page.navigate',{url:ORIGIN+'/dashboard/profile/deductions'})
  let last=0
  for(const d of [250,500,800,1100,1500,2000,2600,3400,4500]){ await sleep(d-last); last=d; console.log(`t≈${String(d).padStart(4)}ms  ppf|`, await ev(ws,probe)) }
  ws.close();ch.kill()
}
main().catch(e=>{console.error(e);process.exit(1)})
