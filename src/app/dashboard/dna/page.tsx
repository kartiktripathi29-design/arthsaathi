'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const C = { fg:'#3A4B41', wheat:'#E6CFA7', wl:'#F5ECD8', wm:'#D4B98A', bg:'#FDFAF6', card:'#fff', border:'#E4DDD1', text:'#1C2B22', muted:'#7A8A7E' }

const QUESTIONS = [
  {
    q: "It's the last week of the month. You have ₹8,000 left. What do you do?",
    opts: [
      { icon:'🎉', text:'Enjoy it — month end plans with friends, a nice dinner. Money is meant to be spent.', type:'E' },
      { icon:'⚖️', text:'Split it — some for fun, some I move to savings before I can spend it.', type:'B' },
      { icon:'🏰', text:'Keep it safe. What if something comes up? I don\'t spend until I know I\'m covered.', type:'P' },
      { icon:'📊', text:'Already accounted for. My SIP went out on the 1st. This ₹8K is just liquidity.', type:'O' },
    ]
  },
  {
    q: "A friend just made ₹3L profit from a stock tip. Your honest first reaction?",
    opts: [
      { icon:'🤩', text:'FOMO immediately. Ask them for the next tip. I want in too.', type:'E' },
      { icon:'🤔', text:'Happy for them, but wonder if I should be doing more with my money too.', type:'B' },
      { icon:'😬', text:'Nervous for them honestly. What if it goes wrong next time? I\'d rather be safe.', type:'P' },
      { icon:'🧠', text:'Curious about their thesis. One stock tip isn\'t a strategy — what\'s their full portfolio?', type:'O' },
    ]
  },
  {
    q: "If you had an extra ₹50,000 right now — a bonus, a gift — what would actually happen to it?",
    opts: [
      { icon:'✈️', text:'Trip. Already planned in my head before the money even lands.', type:'E' },
      { icon:'🔀', text:'Half for something fun, half toward a goal. I\'d feel guilty doing only one.', type:'B' },
      { icon:'🏦', text:'FD or savings account. Having a cushion matters more than any purchase.', type:'P' },
      { icon:'📈', text:'Straight to investments. I\'d research where it fits my portfolio before doing anything else.', type:'O' },
    ]
  },
  {
    q: "When you think about money, which of these feels most true for you?",
    opts: [
      { icon:'🌊', text:'"I work hard and I deserve to enjoy it. The future will figure itself out."', type:'E' },
      { icon:'🌿', text:'"I want to live well now AND be secure later. I just haven\'t figured out the balance."', type:'B' },
      { icon:'🏔️', text:'"My family\'s security is everything. I\'ll sacrifice comfort now for peace of mind later."', type:'P' },
      { icon:'⚡', text:'"Every rupee should be working. Idle money bothers me."', type:'O' },
    ]
  },
  {
    q: "How do you feel about your financial situation right now, honestly?",
    opts: [
      { icon:'😅', text:'Could be better. I earn well but somehow month end always sneaks up on me.', type:'E' },
      { icon:'😐', text:'Okay. Not bad, not great. I know I should be doing more but it feels overwhelming.', type:'B' },
      { icon:'😊', text:'Stable. I don\'t take risks so I don\'t have big gains but I sleep well at night.', type:'P' },
      { icon:'🎯', text:'On track. I have a plan and I check it regularly. Room to optimise but I\'m intentional.', type:'O' },
    ]
  },
  {
    q: "Your company offers ESOPs. How do you react?",
    opts: [
      { icon:'😶', text:'Sounds complicated. I\'ll deal with it when they vest — if they vest.', type:'E' },
      { icon:'🙋', text:'I want to understand it. I\'ll ask HR or Google it, but I\'m not sure where to start.', type:'B' },
      { icon:'⚠️', text:'Bit nervous — what if the company doesn\'t do well? I\'d rather have the cash.', type:'P' },
      { icon:'🔢', text:'I immediately calculate vesting schedule, tax implications and what it adds to my net worth.', type:'O' },
    ]
  },
  {
    q: "Someone asks: \"Should I buy a car on a 5-year loan or wait 2 years and buy in cash?\" What do you say?",
    opts: [
      { icon:'🚗', text:'Buy now. Time you enjoy the car matters. EMIs are manageable if income is steady.', type:'E' },
      { icon:'🤷', text:'Depends on the EMI vs their monthly income — I\'d want to know more before advising.', type:'B' },
      { icon:'⏳', text:'Wait. Debt is stress. The peace of buying something you truly own is underrated.', type:'P' },
      { icon:'🧮', text:'Calculate total interest cost vs opportunity cost of waiting. The math usually says wait.', type:'O' },
    ]
  },
  {
    q: "What does \"financial success\" look like to you at 45?",
    opts: [
      { icon:'🌍', text:'I\'ve seen the world, built memories, and still have enough to be comfortable.', type:'E' },
      { icon:'🏡', text:'Home paid off, kids\' education secured, and a decent corpus growing quietly.', type:'B' },
      { icon:'🛡️', text:'Zero debt, 2 years of expenses in liquid savings, family fully insured. That\'s enough.', type:'P' },
      { icon:'🏆', text:'Option to retire. Not that I necessarily will — but the choice should be mine.', type:'O' },
    ]
  },
  {
    q: "Market crashes 30% in a month. Your portfolio is down ₹2L. What do you do?",
    opts: [
      { icon:'😱', text:'Panic a little. Probably check it obsessively and wonder if I should pull out.', type:'E' },
      { icon:'😬', text:'Uncomfortable but I stay put. I know I shouldn\'t sell but it doesn\'t feel great.', type:'B' },
      { icon:'😰', text:'This is why I stay in FDs. I can\'t handle seeing my money disappear even temporarily.', type:'P' },
      { icon:'🛒', text:'This is a sale. I look at what to buy more of while prices are low.', type:'O' },
    ]
  },
  {
    q: "Last one. What made you open ArthVo today?",
    opts: [
      { icon:'😬', text:'Honestly? A little guilt. I know I should be doing more with money and I keep putting it off.', type:'E' },
      { icon:'🔍', text:'Curiosity. I want to understand where I actually stand — no fluff, just clarity.', type:'B' },
      { icon:'😟', text:'Some anxiety. A big expense is coming up and I\'m not sure I\'m prepared.', type:'P' },
      { icon:'🎯', text:'Optimization. I\'m already doing okay — I want to do significantly better.', type:'O' },
    ]
  },
]

const PROFILES: Record<string, any> = {
  E: {
    emoji:'🌊', name:'The Free Spirit', color:'#2A5A8A',
    tagline:'You live fully. You earn well. The future is a conversation you keep postponing — and ArthVo gets that.',
    traits:['Experience-first','Generous','Present-focused','Impulse-aware'],
    shadow:'Month-end surprises are your pattern. Not because you can\'t manage — because no one showed you how to automate the boring parts so the fun parts feel guilt-free.',
    strength:'You know how to enjoy life. That\'s genuinely rare. The goal isn\'t to change that — it\'s to make sure 55-year-old you is at that dinner table too.',
    insight:'₹5,000/month invested from today = ₹1.1Cr by 55. You don\'t need a personality transplant. You need one automated transfer.',
    projLow:'₹88L', projHigh:'₹3.2Cr',
    nudge:'Your plan will automate everything — so you never have to choose between living today and building tomorrow.',
  },
  B: {
    emoji:'🌿', name:'The Balancer', color:'#2A7A4A',
    tagline:'You want it all — the life today and the security tomorrow. The frustrating part is nobody told you it\'s actually possible.',
    traits:['Balanced instincts','Growth-oriented','Slightly overwhelmed','High potential'],
    shadow:'You\'re doing several things adequately but nothing optimally. A SIP here, an FD there, a bit of FOMO. The result is financial scatter — not disaster, just untapped.',
    strength:'You already think about money intentionally. That puts you ahead of 70% of people your age. You just need a coherent plan, not more information.',
    insight:'People with your income and habits who get a plan at your age end up 2.8x wealthier than those who figure it out at 40.',
    projLow:'₹95L', projHigh:'₹3.8Cr',
    nudge:'Your plan will consolidate everything into one clear direction — so you stop second-guessing and start compounding.',
  },
  P: {
    emoji:'🏔️', name:'The Protector', color:'#8A4A1A',
    tagline:'Security isn\'t just a financial preference for you — it\'s a value. And that foundation is something most people never build.',
    traits:['Family-first','Risk-averse','Disciplined','Conservative'],
    shadow:'The quiet risk you\'re taking is inflation. Your FDs return 7%. Inflation runs at 6%. Your money is barely growing. Safety without growth is its own kind of risk.',
    strength:'You have zero bad debt. You sleep well. Your emergency fund is real. These are things most people in their 40s still haven\'t built. Respect.',
    insight:'Shifting just 20% of your portfolio from debt to equity doesn\'t make you a risk-taker. It makes you someone who beats inflation without losing sleep.',
    projLow:'₹72L', projHigh:'₹2.4Cr',
    nudge:'Your plan will keep you safe AND help your money grow — without asking you to take risks that don\'t feel like you.',
  },
  O: {
    emoji:'⚡', name:'The Maximiser', color:C.fg,
    tagline:'You\'ve already figured out that money is a tool. Now you want the sharpest version of that tool.',
    traits:['Analytically wired','High financial literacy','Systems-thinker','Efficiency-obsessed'],
    shadow:'Your blind spot is over-optimisation paralysis — researching the perfect move so long that good moves don\'t get made. The best plan executed beats the perfect plan delayed.',
    strength:'You ask better questions than most financial advisors. You understand compounding, tax efficiency, and asset allocation intuitively. ArthVo is your co-pilot, not your teacher.',
    insight:'You\'re likely leaving ₹40,000–₹80,000/year on the table in tax inefficiencies alone. That\'s ₹8–16L over 10 years just sitting there.',
    projLow:'₹1.2Cr', projHigh:'₹5.1Cr',
    nudge:'Your plan goes deep — tax-loss harvesting, regime optimisation, ESOP strategy, NPS layer. Built for someone who actually wants to read it.',
  },
}

export default function DNAPage() {
  const router = useRouter()
  const [step, setStep] = useState<'quiz'|'processing'|'result'>('quiz')
  const [current, setCurrent] = useState(0)
  const [scores, setScores] = useState({ E:0, B:0, P:0, O:0 })
  const [selected, setSelected] = useState<string|null>(null)
  const [processingLines, setProcessingLines] = useState<string[]>([])
  const [result, setResult] = useState<any>(null)
  const [retake, setRetake] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('av_dna')
    if (saved && !retake) {
      const d = JSON.parse(saved)
      setResult(PROFILES[d.type])
      setStep('result')
    }
  }, [retake])

  const answer = (type: string) => {
    setSelected(type)
    const newScores = { ...scores, [type]: scores[type as keyof typeof scores] + 1 }
    setScores(newScores)
    setTimeout(() => {
      setSelected(null)
      if (current < QUESTIONS.length - 1) {
        setCurrent(current + 1)
      } else {
        // Calculate result
        const max = Math.max(...Object.values(newScores))
        const topType = Object.entries(newScores).sort((a,b)=>b[1]-a[1])[0][0]
        const secondType = Object.entries(newScores).sort((a,b)=>b[1]-a[1])[1][0]
        const dna = { type: topType, secondary: secondType, scores: newScores, completedAt: Date.now() }
        localStorage.setItem('av_dna', JSON.stringify(dna))
        setResult({ ...PROFILES[topType], secondary: PROFILES[secondType], dna })
        setStep('processing')
        // Animate processing
        const lines = [
          '✓ Spending behaviour pattern identified',
          '✓ Risk tolerance scored',
          '✓ Future orientation mapped',
          '✓ Impulse index calculated',
          '✓ Financial archetype matched',
          '✓ Projection model calibrated',
        ]
        lines.forEach((l,i) => setTimeout(() => setProcessingLines(prev=>[...prev,l]), (i+1)*500))
        setTimeout(() => setStep('result'), lines.length*500 + 800)
      }
    }, 260)
  }

  const pct = Math.round(((current + 1) / QUESTIONS.length) * 100)
  const q = QUESTIONS[current]

  if (step === 'quiz') return (
    <div style={{ fontFamily:'"Sora",-apple-system,sans-serif', maxWidth:600 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap')`}</style>
      <div style={{ textAlign:'center', marginBottom:24 }}>
        <p style={{ fontSize:11, color:C.muted, letterSpacing:'0.1em', textTransform:'uppercase', margin:'0 0 6px' }}>ArthVo · Financial DNA</p>
        <h2 style={{ fontSize:22, fontWeight:800, color:C.text, margin:'0 0 4px', letterSpacing:'-0.02em' }}>Let's understand you first</h2>
        <p style={{ fontSize:13, color:C.muted, margin:0 }}>10 questions · no wrong answers · takes 3 minutes</p>
      </div>
      <div style={{ marginBottom:20 }}>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:C.muted, marginBottom:5 }}>
          <span>Question {current+1} of {QUESTIONS.length}</span>
          <span>{pct}%</span>
        </div>
        <div style={{ height:4, background:C.border, borderRadius:2, overflow:'hidden' }}>
          <div style={{ width:`${pct}%`, height:'100%', background:C.fg, borderRadius:2, transition:'width 0.4s ease' }} />
        </div>
      </div>
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:'20px 22px', marginBottom:16 }}>
        <p style={{ fontSize:17, fontWeight:700, color:C.text, margin:'0 0 20px', lineHeight:1.45, letterSpacing:'-0.01em' }}>{q.q}</p>
        {q.opts.map((opt,i) => (
          <button key={i} onClick={() => answer(opt.type)}
            style={{ width:'100%', padding:'13px 16px', border:`1.5px solid ${selected===opt.type?C.fg:C.border}`, borderRadius:8, background:selected===opt.type?C.wl:C.card, textAlign:'left', cursor:'pointer', fontFamily:'inherit', fontSize:13.5, color:selected===opt.type?C.fg:C.text, marginBottom:9, transition:'all 0.15s', display:'flex', alignItems:'flex-start', gap:12, lineHeight:1.5 }}>
            <span style={{ fontSize:18, flexShrink:0 }}>{opt.icon}</span>
            <span>{opt.text}</span>
          </button>
        ))}
      </div>
    </div>
  )

  if (step === 'processing') return (
    <div style={{ fontFamily:'"Sora",-apple-system,sans-serif', maxWidth:600, textAlign:'center', paddingTop:40 }}>
      <p style={{ fontSize:40, margin:'0 0 16px' }}>🧬</p>
      <h2 style={{ fontSize:18, fontWeight:700, color:C.text, margin:'0 0 6px' }}>Reading your Financial DNA…</h2>
      <p style={{ fontSize:13, color:C.muted, margin:'0 0 24px' }}>Cross-referencing answers with behavioural patterns</p>
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:16, textAlign:'left', maxWidth:400, margin:'0 auto' }}>
        {processingLines.map((l,i) => (
          <p key={i} style={{ fontSize:12.5, color:C.muted, margin:'0 0 6px', lineHeight:1.6 }}>{l}</p>
        ))}
      </div>
    </div>
  )

  if (step === 'result' && result) {
    const p = result
    return (
      <div style={{ fontFamily:'"Sora",-apple-system,sans-serif', maxWidth:640 }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap')`}</style>
        {/* Hero */}
        <div style={{ background:p.color, borderRadius:10, padding:'24px 22px', textAlign:'center', marginBottom:14 }}>
          <p style={{ fontSize:10, color:'rgba(255,255,255,0.4)', letterSpacing:'0.1em', margin:'0 0 10px' }}>YOUR FINANCIAL DNA</p>
          <div style={{ fontSize:48, margin:'0 0 10px' }}>{p.emoji}</div>
          <p style={{ fontSize:24, fontWeight:800, color:'#fff', margin:'0 0 6px', letterSpacing:'-0.02em' }}>{p.name}</p>
          <p style={{ fontSize:13.5, color:'rgba(255,255,255,0.65)', margin:'0 0 16px', lineHeight:1.65, maxWidth:380, marginLeft:'auto', marginRight:'auto' }}>{p.tagline}</p>
          <div style={{ display:'flex', justifyContent:'center', gap:6, flexWrap:'wrap' as const }}>
            {p.traits.map((t:string) => (
              <span key={t} style={{ fontSize:11.5, background:'rgba(255,255,255,0.12)', color:'rgba(255,255,255,0.85)', padding:'4px 12px', borderRadius:20 }}>{t}</span>
            ))}
          </div>
          {p.secondary && p.secondary.name !== p.name && (
            <p style={{ fontSize:11, color:'rgba(255,255,255,0.35)', margin:'12px 0 0' }}>Secondary trait: {p.secondary.emoji} {p.secondary.name}</p>
          )}
        </div>

        {/* What this means */}
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, overflow:'hidden', marginBottom:12 }}>
          <div style={{ padding:'9px 14px', background:C.wl, borderBottom:`1px solid ${C.border}`, fontSize:10, fontWeight:700, color:C.fg, letterSpacing:'0.07em', textTransform:'uppercase' as const }}>What this means for you</div>
          {[
            { icon:'🪞', text:p.shadow },
            { icon:'💪', text:p.strength },
            { icon:'💡', text:p.insight },
          ].map((r,i,arr) => (
            <div key={i} style={{ display:'flex', gap:12, alignItems:'flex-start', padding:'12px 14px', borderBottom:i<arr.length-1?`1px solid #FAF7F2`:'none', fontSize:13.5, color:C.text, lineHeight:1.7 }}>
              <span style={{ fontSize:18, flexShrink:0 }}>{r.icon}</span>
              <span>{r.text}</span>
            </div>
          ))}
        </div>

        {/* Potential projection */}
        <div style={{ background:p.color, borderRadius:8, padding:'16px 18px', marginBottom:12 }}>
          <p style={{ fontSize:10, color:'rgba(255,255,255,0.4)', letterSpacing:'0.08em', margin:'0 0 12px' }}>YOUR POTENTIAL — includes expected salary increments + investment growth</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
            <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:6, padding:'12px 14px' }}>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', marginBottom:4 }}>AT CURRENT PACE</div>
              <div style={{ fontSize:24, fontWeight:700, color:'rgba(255,255,255,0.45)' }}>{p.projLow}</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)' }}>by age 55</div>
            </div>
            <div style={{ background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:6, padding:'12px 14px' }}>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.6)', marginBottom:4 }}>WITH ARTHVO PLAN</div>
              <div style={{ fontSize:24, fontWeight:700, color:'#fff' }}>{p.projHigh}</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.45)' }}>by age 55</div>
            </div>
          </div>
          <p style={{ fontSize:12, color:'rgba(255,255,255,0.5)', margin:0, lineHeight:1.65 }}>The difference isn't luck or a higher salary. It's a plan that understands how <em>you</em> think about money.</p>
        </div>

        {/* Unlock */}
        <div style={{ border:`1.5px dashed ${C.wm}`, borderRadius:8, padding:20, textAlign:'center', background:C.wl, marginBottom:16 }}>
          <p style={{ fontSize:16, fontWeight:700, color:C.fg, margin:'0 0 6px' }}>Your personalised plan is ready</p>
          <p style={{ fontSize:13, color:C.muted, margin:'0 0 16px', lineHeight:1.65, maxWidth:380, marginLeft:'auto', marginRight:'auto' }}>{p.nudge}</p>
          <button onClick={() => router.push('/dashboard')} style={{ padding:'11px 28px', background:C.fg, color:C.wheat, border:'none', borderRadius:5, fontSize:13.5, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
            Go to my dashboard →
          </button>
          <p style={{ fontSize:11, color:C.muted, margin:'8px 0 0' }}>Cancel anytime · Takes 2 minutes to set up</p>
        </div>

        <div style={{ textAlign:'center' }}>
          <button onClick={() => { setRetake(true); setCurrent(0); setScores({E:0,B:0,P:0,O:0}); setProcessingLines([]); setStep('quiz') }}
            style={{ fontSize:12, color:C.muted, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', textDecoration:'underline' }}>
            Retake questionnaire
          </button>
        </div>
      </div>
    )
  }
  return null
}
