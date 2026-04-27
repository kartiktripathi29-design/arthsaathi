'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAppStore } from '@/store/AppStore'
import { validateDNA, type DNAType, type ValidationResult } from '@/lib/dnaValidator'

const C = { fg:'#3A4B41', wheat:'#E6CFA7', wl:'#F5ECD8', wm:'#D4B98A', bg:'#FDFAF6', card:'#fff', border:'#E4DDD1', text:'#1C2B22', muted:'#7A8A7E', danger:'#B94040' }
const fmt = (n:number) => `₹${Math.round(n).toLocaleString('en-IN')}`

const PROFILES: Record<string,any> = {
  E: { emoji:'🌊', name:'The Free Spirit', color:'#2A5A8A', projLow:'₹88L', projHigh:'₹3.2Cr',
       tone:"You can have both — the life today and the wealth tomorrow. ArthVo's job is to make sure you never have to choose." },
  B: { emoji:'🌿', name:'The Balancer', color:'#2A7A4A', projLow:'₹95L', projHigh:'₹3.8Cr',
       tone:"You're not behind. You're just unoptimised. There's a big difference — and it's entirely fixable." },
  P: { emoji:'🏔️', name:'The Protector', color:'#8A4A1A', projLow:'₹72L', projHigh:'₹2.4Cr',
       tone:"Your FD is working hard. It's just not working hard enough. There's a safer way to grow." },
  O: { emoji:'⚡', name:'The Maximiser', color:C.fg, projLow:'₹1.2Cr', projHigh:'₹5.1Cr',
       tone:"You're likely leaving ₹40–80K/year on the table in tax inefficiencies alone. Let's fix that." },
}

function SpendingBar({ label, amount, total, color, note }: any) {
  const pct = total > 0 ? Math.min(100, Math.round((amount/total)*100)) : 0
  return (
    <div style={{ marginBottom:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4, fontSize:12.5 }}>
        <span style={{ color:C.text }}>{label}</span>
        <span style={{ fontWeight:600, color:note?C.danger:C.text }}>{fmt(amount)} · {pct}%</span>
      </div>
      <div style={{ height:6, background:'#F0EBE0', borderRadius:3, overflow:'hidden' }}>
        <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:3, transition:'width 0.6s ease' }} />
      </div>
      {note && <p style={{ fontSize:11, color:C.danger, margin:'3px 0 0' }}>{note}</p>}
    </div>
  )
}

function LockedSection({ title, emoji, teaser, height=160 }: any) {
  return (
    <div style={{ position:'relative', marginBottom:12 }}>
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:'12px 14px', height, overflow:'hidden', filter:'blur(2px)', pointerEvents:'none' }}>
        <div style={{ fontSize:10, fontWeight:700, color:C.fg, letterSpacing:'0.07em', textTransform:'uppercase' as const, marginBottom:10 }}>{title}</div>
        {[...Array(4)].map((_,i) => (
          <div key={i} style={{ height:14, background:'#F0EBE0', borderRadius:3, width:`${[85,60,75,50][i]}%`, marginBottom:8 }} />
        ))}
      </div>
      <div style={{ position:'absolute', inset:0, background:'rgba(253,250,246,0.9)', backdropFilter:'blur(2px)', display:'flex', flexDirection:'column' as const, alignItems:'center', justifyContent:'center', borderRadius:8, border:`1.5px dashed ${C.wm}` }}>
        <p style={{ fontSize:22, margin:'0 0 6px' }}>{emoji}</p>
        <p style={{ fontSize:13, fontWeight:700, color:C.text, margin:'0 0 4px', textAlign:'center' }}>{title}</p>
        <p style={{ fontSize:12, color:C.muted, margin:'0 0 12px', textAlign:'center', maxWidth:260, lineHeight:1.6 }}>{teaser}</p>
        <Link href="/upgrade" style={{ padding:'8px 22px', background:C.fg, color:C.wheat, borderRadius:5, fontSize:12.5, fontWeight:600, textDecoration:'none' }}>
          Unlock for ₹199/month →
        </Link>
      </div>
    </div>
  )
}

// ── DNA Validation Section ────────────────────────────────────────────────────
function DNAValidationSection({ validation, claimedProfile, evolvedProfile }: { validation:ValidationResult; claimedProfile:any; evolvedProfile:any }) {
  const [expanded, setExpanded] = useState(false)
  const matchColor = validation.matchScore >= 75 ? '#2A7A4A' : validation.matchScore >= 50 ? '#D97706' : C.danger

  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, overflow:'hidden', marginBottom:12 }}>
      <div style={{ padding:'10px 14px', background:C.wl, borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:10, fontWeight:700, color:C.fg, letterSpacing:'0.07em', textTransform:'uppercase' as const }}>Your Financial DNA · Validated</span>
        <span style={{ fontSize:10, background:'#EEF2EE', color:'#2A7A4A', padding:'2px 8px', borderRadius:20, fontWeight:500, border:'1px solid #C8D8C8' }}>Free</span>
      </div>

      {/* Claimed vs Evolved */}
      <div style={{ padding:'14px 16px', borderBottom:`1px solid #FAF7F2` }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 32px 1fr', gap:10, alignItems:'center', marginBottom:12 }}>
          <div style={{ background:claimedProfile.color, borderRadius:7, padding:'11px 12px', textAlign:'center' as const }}>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.45)', letterSpacing:'0.08em', marginBottom:3 }}>YOU SAID</div>
            <div style={{ fontSize:22, margin:'0 0 4px' }}>{claimedProfile.emoji}</div>
            <div style={{ fontSize:12, fontWeight:700, color:'#fff' }}>{claimedProfile.name}</div>
          </div>
          <div style={{ textAlign:'center' as const, fontSize:16, color:C.muted }}>→</div>
          <div style={{ background:evolvedProfile.color, borderRadius:7, padding:'11px 12px', textAlign:'center' as const, border:validation.shifted?`2px solid ${C.wheat}`:'none' }}>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.45)', letterSpacing:'0.08em', marginBottom:3 }}>DATA SAYS</div>
            <div style={{ fontSize:22, margin:'0 0 4px' }}>{evolvedProfile.emoji}</div>
            <div style={{ fontSize:12, fontWeight:700, color:'#fff' }}>{evolvedProfile.name}</div>
            {validation.shifted && <div style={{ fontSize:9, color:'rgba(255,255,255,0.6)', marginTop:2 }}>Evolved</div>}
          </div>
        </div>

        {/* Match score bar */}
        <div style={{ marginBottom:10 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:C.muted, marginBottom:4 }}>
            <span>Behaviour match</span>
            <span style={{ fontWeight:600, color:matchColor }}>{validation.matchScore}%</span>
          </div>
          <div style={{ height:5, background:'#F0EBE0', borderRadius:3, overflow:'hidden' }}>
            <div style={{ width:`${validation.matchScore}%`, height:'100%', background:matchColor, borderRadius:3, transition:'width 0.8s ease' }} />
          </div>
        </div>

        <p style={{ fontSize:13, color:C.text, lineHeight:1.65, margin:0 }}>{validation.evolvedSummary}</p>
      </div>

      {/* Positives */}
      {validation.positives.length > 0 && (
        <div style={{ padding:'10px 14px', borderBottom:`1px solid #FAF7F2` }}>
          {validation.positives.map((p,i) => (
            <div key={i} style={{ display:'flex', gap:10, alignItems:'flex-start', fontSize:13, color:C.text, lineHeight:1.65, marginBottom:i<validation.positives.length-1?8:0 }}>
              <span style={{ fontSize:16, flexShrink:0 }}>💪</span><span>{p}</span>
            </div>
          ))}
        </div>
      )}

      {/* Gaps */}
      {validation.gaps.length > 0 && (
        <div>
          <button onClick={() => setExpanded(!expanded)} style={{ width:'100%', padding:'10px 14px', background:'#FAFAF8', border:'none', borderBottom:expanded?`1px solid #FAF7F2`:'none', cursor:'pointer', fontFamily:'inherit', display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:12.5, color:C.muted }}>
            <span>🔍 {validation.gaps.length} gap{validation.gaps.length>1?'s':''} found between what you said and what you do</span>
            <span>{expanded?'↑':'↓'}</span>
          </button>
          {expanded && validation.gaps.map((g,i) => (
            <div key={i} style={{ padding:'12px 14px', borderBottom:i<validation.gaps.length-1?`1px solid #FAF7F2`:'none', display:'flex', gap:10, alignItems:'flex-start' }}>
              <span style={{ fontSize:16, flexShrink:0 }}>🪞</span>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:12.5, color:C.muted, margin:'0 0 3px', fontStyle:'italic' }}>"{g.claim}"</p>
                <p style={{ fontSize:13, color:C.text, margin:'0 0 4px', lineHeight:1.55 }}>{g.reality}</p>
                <p style={{ fontSize:12, color:C.danger, margin:'0 0 6px' }}>{g.cost}</p>
                <div style={{ background:C.wl, border:`1px solid ${C.wm}`, borderRadius:5, padding:'7px 10px', fontSize:12, color:C.fg, lineHeight:1.6 }}>
                  💡 {g.nudge}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Signals summary */}
      {validation.signals.length > 0 && (
        <div style={{ padding:'10px 14px', background:'#FAFAF8', borderTop:`1px solid #FAF7F2` }}>
          <p style={{ fontSize:10, fontWeight:700, color:C.muted, letterSpacing:'0.06em', textTransform:'uppercase' as const, margin:'0 0 8px' }}>Behavioural signals from your data</p>
          <div style={{ display:'flex', flexWrap:'wrap' as const, gap:6 }}>
            {validation.signals.map((s,i) => (
              <div key={i} style={{ fontSize:11, padding:'4px 10px', borderRadius:20, background:s.type==='positive'?'#EEF2EE':s.type==='gap'?'#FBF0F0':C.wl, color:s.type==='positive'?'#2A7A4A':s.type==='gap'?C.danger:C.fg, border:`1px solid ${s.type==='positive'?'#C8D8C8':s.type==='gap'?'#F0CECE':C.wm}`, fontWeight:500 }}>
                {s.label}: {s.value}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter()
  const { salary } = useAppStore()
  const [dna, setDna] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [validation, setValidation] = useState<ValidationResult|null>(null)
  const [bankData, setBankData] = useState<any>(null)
  const [totals, setTotals] = useState({ exp:0, vari:0, sav:0, free:0 })
  const [hasProfile, setHasProfile] = useState(false)

  useEffect(() => {
    const dnaRaw = localStorage.getItem('av_dna')
    if (!dnaRaw) { router.push('/dashboard/dna'); return }
    const d = JSON.parse(dnaRaw)
    setDna(d)
    setProfile(PROFILES[d.type])

    const profileRaw = localStorage.getItem('av_profile')
    const bankRaw = localStorage.getItem('av_bank')
    const bank = bankRaw ? JSON.parse(bankRaw) : null
    setBankData(bank)

    if (profileRaw) {
      setHasProfile(true)
      const p = JSON.parse(profileRaw)
      const exp  = (p.expenses||[]).reduce((s:number,e:any)=>s+e.amount,0)
      const vari = (p.variable||[]).reduce((s:number,v:any)=>s+v.amount,0)
      const sav  = (p.savings||[]).reduce((s:number,sv:any)=>s+sv.amount,0)
      const net  = salary?.netSalary || 0
      const free = Math.max(0, net - exp - vari - sav)
      setTotals({ exp, vari, sav, free })

      // Run validation when we have salary + either profile or bank data
      if (net > 0) {
        const result = validateDNA(d.type as DNAType, {
          netSalary: net, totalExp: exp, totalVar: vari, totalSav: sav,
          bankSummary: bank?.summary,
        })
        setValidation(result)
      }
    }
  }, [salary])

  if (!profile) return null

  const net = salary?.netSalary || 0
  const { exp, vari, sav, free } = totals
  const savRate = net > 0 ? sav/net : 0
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  let health = 100
  if (savRate < 0.1) health -= 30; else if (savRate < 0.2) health -= 12
  if (net > 0 && (exp+vari)/net > 0.7) health -= 20; else if (net > 0 && (exp+vari)/net > 0.6) health -= 10
  if (free < 0) health -= 20
  health = Math.max(0, Math.min(100, health))

  // Evolved profile for validation display
  const evolvedProfile = validation ? PROFILES[validation.evolvedType] : profile

  return (
    <div style={{ fontFamily:'"Sora",-apple-system,sans-serif', maxWidth:860 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap')`}</style>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, flexWrap:'wrap' as const, gap:10 }}>
        <div>
          <h2 style={{ fontSize:21, fontWeight:700, color:C.text, margin:'0 0 3px', letterSpacing:'-0.02em' }}>
            {greeting} 👋
          </h2>
          <p style={{ fontSize:13, color:C.muted, margin:0 }}>Your financial picture — honest, complete, no jargon</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {validation?.shifted && (
            <div style={{ display:'flex', alignItems:'center', gap:6, background:'#1E293B', padding:'6px 12px', borderRadius:20 }}>
              <span style={{ fontSize:13 }}>{profile.emoji}→{evolvedProfile.emoji}</span>
              <span style={{ fontSize:11, color:'rgba(255,255,255,0.6)' }}>Evolved</span>
            </div>
          )}
          <div style={{ display:'flex', alignItems:'center', gap:6, background:profile.color, padding:'7px 14px', borderRadius:20, cursor:'pointer' }} onClick={() => router.push('/dashboard/dna')}>
            <span style={{ fontSize:15 }}>{profile.emoji}</span>
            <span style={{ fontSize:12, fontWeight:600, color:'#fff' }}>{profile.name}</span>
            <span style={{ fontSize:10, color:'rgba(255,255,255,0.5)', marginLeft:2 }}>retake</span>
          </div>
        </div>
      </div>

      {/* Stat strip */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:1, background:C.border, border:`1px solid ${C.border}`, borderRadius:6, overflow:'hidden', marginBottom:16 }}>
        {[
          { l:'Monthly income', v:net>0?fmt(net):'Add in Profile', pos:true },
          { l:'Truly free / mo', v:net>0?fmt(free):'—', pos:true },
          { l:'Savings rate', v:net>0?`${Math.round(savRate*100)}%`:'—', pos:savRate>=0.2 },
          { l:'Financial health', v:`${health}/100`, pos:health>=65 },
        ].map((s,i) => (
          <div key={i} style={{ background:C.card, padding:'13px 16px' }}>
            <div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>{s.l}</div>
            <div style={{ fontSize:17, fontWeight:700, color:s.pos?C.fg:C.danger, letterSpacing:'-0.02em' }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* DNA tone message */}
      <div style={{ background:evolvedProfile.color, borderRadius:8, padding:'12px 16px', marginBottom:14, display:'flex', gap:12, alignItems:'center' }}>
        <span style={{ fontSize:22, flexShrink:0 }}>{evolvedProfile.emoji}</span>
        <p style={{ fontSize:13, color:'rgba(255,255,255,0.88)', margin:0, lineHeight:1.65 }}>{evolvedProfile.tone}</p>
      </div>

      {net > 0 && hasProfile ? (
        <>
          {/* DNA Validation — only shows after bank/profile data is available */}
          {validation && (
            <DNAValidationSection
              validation={validation}
              claimedProfile={profile}
              evolvedProfile={evolvedProfile}
            />
          )}

          {/* Spending habits */}
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, overflow:'hidden', marginBottom:12 }}>
            <div style={{ padding:'9px 14px', background:C.wl, borderBottom:`1px solid ${C.border}`, fontSize:10, fontWeight:700, color:C.fg, letterSpacing:'0.07em', textTransform:'uppercase' as const, display:'flex', justifyContent:'space-between' }}>
              <span>Where your money goes</span>
              <span style={{ fontSize:10, background:'#EEF2EE', color:'#2A7A4A', padding:'2px 8px', borderRadius:20, fontWeight:500, textTransform:'none' as const, letterSpacing:0 }}>Free</span>
            </div>
            <div style={{ padding:'14px 16px' }}>
              {exp > 0 && <SpendingBar label="🏠 Housing & commitments" amount={exp} total={net} color={C.danger} />}
              {bankData?.summary?.food > 0 && (
                <SpendingBar label="🍽️ Food & Dining" amount={bankData.summary.food} total={net} color="#D97706"
                  note={bankData.summary.food/net > 0.15 ? `${Math.round(bankData.summary.food/net*100)}% of income — above ideal` : undefined} />
              )}
              {bankData?.summary?.fuel > 0 && <SpendingBar label="🚗 Transport & Fuel" amount={bankData.summary.fuel} total={net} color="#2A5A8A" />}
              {bankData?.summary?.shopping > 0 && <SpendingBar label="🛍️ Shopping" amount={bankData.summary.shopping} total={net} color="#7A5A2A" />}
              {sav > 0 && <SpendingBar label="📈 Savings & Investments" amount={sav} total={net} color="#2A7A4A" />}
              {!bankData && <p style={{ fontSize:12.5, color:C.muted, margin:'8px 0 0', lineHeight:1.65 }}>
                <Link href="/dashboard/profile" style={{ color:C.fg, fontWeight:600 }}>Upload your bank statement</Link> to see your real spending breakdown with AI categorisation.
              </p>}
              {savRate < 0.2 && net > 0 && (
                <div style={{ background:C.wl, border:`1px solid ${C.wm}`, borderRadius:5, padding:'9px 12px', fontSize:12.5, color:C.fg, lineHeight:1.65, marginTop:10 }}>
                  💡 Savings rate is {Math.round(savRate*100)}%. The 20% target means {fmt(net*0.2)}/month — you're {fmt(net*0.2-sav)} short. That's one SIP away.
                </div>
              )}
            </div>
          </div>

          {/* Locked — projections */}
          <LockedSection
            title="What you could become — projections"
            emoji="🔮"
            teaser={`At current pace: ${evolvedProfile.projLow} by 55. With ArthVo: ${evolvedProfile.projHigh}. Includes salary increments, bonuses and investment compounding.`}
          />

          {/* Locked — investment plan */}
          <LockedSection
            title="Your personalised investment plan"
            emoji="📈"
            teaser={`Built for ${evolvedProfile.name} — automated, personalised, guilt-free. One tap to see it.`}
            height={150}
          />

          {/* 3 actions */}
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, overflow:'hidden', marginBottom:4 }}>
            <div style={{ padding:'9px 14px', background:C.wl, borderBottom:`1px solid ${C.border}`, fontSize:10, fontWeight:700, color:C.fg, letterSpacing:'0.07em', textTransform:'uppercase' as const }}>
              3 things to do this week
            </div>
            {[
              { icon:'🧮', text:'Complete Tax Optimiser', sub:'See exactly how much you owe — and how to pay less', href:'/dashboard/tax', done:false },
              { icon:'🏦', text:'Upload your bank statement', sub:'Auto-fill your profile with real spend data', href:'/dashboard/profile', done:!!bankData },
              { icon:'💡', text:'Review your deduction portal', sub:'You may be missing 80C, 80D or HRA claims', href:'/dashboard/tax', done:false },
            ].map((a,i,arr) => (
              <Link key={i} href={a.href} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', borderBottom:i<arr.length-1?`1px solid #FAF7F2`:'none', textDecoration:'none' }}>
                <span style={{ fontSize:20, flexShrink:0 }}>{a.icon}</span>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:13, fontWeight:500, color:a.done?C.muted:C.text, margin:'0 0 2px', textDecoration:a.done?'line-through':'none' }}>{a.text}</p>
                  <p style={{ fontSize:11.5, color:C.muted, margin:0 }}>{a.sub}</p>
                </div>
                {a.done ? <span style={{ fontSize:14, color:'#2A7A4A' }}>✓</span> : <span style={{ fontSize:14, color:C.muted }}>→</span>}
              </Link>
            ))}
          </div>
        </>
      ) : (
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:'24px', textAlign:'center' }}>
          <p style={{ fontSize:15, fontWeight:600, color:C.text, margin:'0 0 8px' }}>Complete your profile to validate your Financial DNA</p>
          <p style={{ fontSize:13, color:C.muted, margin:'0 0 16px', lineHeight:1.65 }}>Upload your bank statement or add income and expenses — ArthVo will cross-check your personality against your actual habits.</p>
          <Link href="/dashboard/profile" style={{ display:'inline-block', padding:'10px 24px', background:C.fg, color:C.wheat, borderRadius:5, fontSize:13, fontWeight:600, textDecoration:'none' }}>
            Set up My Profile →
          </Link>
        </div>
      )}
    </div>
  )
}
