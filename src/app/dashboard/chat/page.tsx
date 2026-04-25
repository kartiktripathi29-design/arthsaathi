'use client'
import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '@/store/AppStore'

const C = { fg:'#3A4B41', wheat:'#E6CFA7', wl:'#F5ECD8', wm:'#D4B98A', bg:'#FDFAF6', card:'#fff', border:'#E4DDD1', text:'#1C2B22', muted:'#7A8A7E', danger:'#B94040' }
const fmt = (n:number) => `₹${Math.round(n).toLocaleString('en-IN')}`

interface Message { role:'user'|'assistant'; content:string }

const SUGGESTIONS = [
  'Should I switch to New Regime?',
  'How much should I invest in SIP?',
  'Can I afford a ₹50,000 purchase?',
  'What is 80C and how do I use it?',
  'How do I build an emergency fund?',
]

export default function ChatPage() {
  const { salary } = useAppStore()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Build context from profile + salary
  const buildContext = () => {
    let ctx = ''
    if (salary) ctx += `Salary: take-home ₹${salary.netSalary}/mo, gross ₹${salary.grossSalary}/mo at ${salary.employerName||'employer'}. `
    try {
      const p = localStorage.getItem('av_profile')
      if (p) {
        const d = JSON.parse(p)
        const exp = (d.expenses||[]).reduce((s:number,e:any)=>s+e.amount,0)
        const sav = (d.savings||[]).reduce((s:number,sv:any)=>s+sv.amount,0)
        const free = Math.max(0,(salary?.netSalary||0)-exp-sav)
        ctx += `Monthly fixed expenses: ₹${exp}. Monthly savings: ₹${sav}. Free to spend: ₹${free}. `
      }
    } catch {}
    return ctx
  }

  const send = async (text: string) => {
    if (!text.trim() || loading) return
    const userMsg: Message = { role:'user', content:text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    try {
      const context = buildContext()
      const res = await fetch('/api/chat', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role:m.role, content:m.content })),
          userContext: context,
        })
      })
      const json = await res.json()
      if (json.message) setMessages(prev => [...prev, { role:'assistant', content:json.message }])
    } catch { setMessages(prev => [...prev, { role:'assistant', content:"Sorry, I couldn't connect. Please try again." }]) }
    finally { setLoading(false) }
  }

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages, loading])

  // Greeting based on time
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div style={{ fontFamily:'"Sora",-apple-system,sans-serif', maxWidth:720, height:'calc(100vh - 120px)', display:'flex', flexDirection:'column' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap')`}</style>

      <div style={{ marginBottom:16, flexShrink:0 }}>
        <h2 style={{ fontSize:20, fontWeight:700, color:C.text, margin:'0 0 4px', letterSpacing:'-0.02em' }}>AI Advisor</h2>
        <p style={{ fontSize:13, color:C.muted, margin:0 }}>Knows your full financial picture — ask anything</p>
      </div>

      {/* Chat area */}
      <div style={{ flex:1, background:C.card, border:`1px solid ${C.border}`, borderRadius:6, padding:'16px', overflow:'auto', marginBottom:10, display:'flex', flexDirection:'column', gap:10 }}>

        {/* Welcome state */}
        {messages.length === 0 && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flex:1, textAlign:'center', gap:12 }}>
            <div style={{ width:48, height:48, borderRadius:'50%', background:C.wl, border:`2px solid ${C.wm}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="24" height="24" viewBox="0 0 120 120" fill="none"><polygon points="9,9 21,9 60,101 99,9 111,9 60,111" fill={C.fg}/></svg>
            </div>
            <div>
              <p style={{ fontSize:15, fontWeight:600, color:C.text, margin:'0 0 4px' }}>{greeting}! I'm your ArthVo Advisor.</p>
              <p style={{ fontSize:12.5, color:C.muted, margin:0, maxWidth:380 }}>
                {salary ? `I can see your salary from ${salary.employerName||'your employer'}. Ask me anything about tax, investments or spending.` : 'Complete your profile in My Profile for personalised advice.'}
              </p>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, justifyContent:'center', marginTop:4 }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)} style={{ padding:'7px 12px', background:C.wl, border:`1px solid ${C.wm}`, borderRadius:20, fontSize:12, color:C.fg, cursor:'pointer', fontFamily:'inherit', fontWeight:500 }}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((m,i) => (
          <div key={i} style={{ display:'flex', justifyContent:m.role==='user'?'flex-end':'flex-start' }}>
            {m.role === 'assistant' && (
              <div style={{ width:28, height:28, borderRadius:'50%', background:C.wl, border:`1px solid ${C.wm}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginRight:8, marginTop:2 }}>
                <svg width="14" height="14" viewBox="0 0 120 120" fill="none"><polygon points="9,9 21,9 60,101 99,9 111,9 60,111" fill={C.fg}/></svg>
              </div>
            )}
            <div style={{
              maxWidth:'75%', padding:'10px 14px', borderRadius: m.role==='user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
              background: m.role==='user' ? C.fg : C.wl,
              border: `1px solid ${m.role==='user' ? 'transparent' : C.border}`,
              fontSize:13, color: m.role==='user' ? C.wheat : C.text, lineHeight:1.65,
              whiteSpace:'pre-wrap', wordBreak:'break-word',
            }}>
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:28, height:28, borderRadius:'50%', background:C.wl, border:`1px solid ${C.wm}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="14" height="14" viewBox="0 0 120 120" fill="none"><polygon points="9,9 21,9 60,101 99,9 111,9 60,111" fill={C.fg}/></svg>
            </div>
            <div style={{ background:C.wl, border:`1px solid ${C.border}`, borderRadius:'12px 12px 12px 2px', padding:'10px 14px', fontSize:13, color:C.muted }}>
              Thinking…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ display:'flex', gap:8, flexShrink:0 }}>
        <input value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e => e.key==='Enter' && !e.shiftKey && (e.preventDefault(), send(input))}
          placeholder="Ask about your taxes, investments, goals…"
          style={{ flex:1, padding:'10px 14px', border:`1px solid ${C.border}`, borderRadius:5, fontSize:13, fontFamily:'inherit', outline:'none', color:C.text, background:C.card }} />
        <button onClick={() => send(input)} disabled={!input.trim()||loading}
          style={{ padding:'10px 18px', background:input.trim()&&!loading?C.fg:'#C8D4C8', color:input.trim()&&!loading?C.wheat:'#8A9A8A', border:'none', borderRadius:5, fontSize:13, fontWeight:600, cursor:input.trim()&&!loading?'pointer':'not-allowed', fontFamily:'inherit' }}>
          Send →
        </button>
      </div>
    </div>
  )
}
