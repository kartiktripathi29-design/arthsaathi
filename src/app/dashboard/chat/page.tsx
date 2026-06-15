'use client'
// Phase-1 help chat ("ArthVo Guide"): helps people USE the app and understand fields — no financial
// advice (guardrails live in the system prompt, lib/claude.ts → buildChatSystem). Streams the answer
// from /api/chat (Server-Sent Events).
import { useState, useRef, useEffect } from 'react'
import { tokens as T } from '@/lib/tokens'

const C = { fg: T.teal, wheat: T.taupe, wl: T.sand, wm: T.taupeLine, bg: T.paper, card: T.card, border: T.hairline, text: T.ink, muted: T.muted, danger: '#B94040' }

interface Message { role: 'user' | 'assistant'; content: string }

const SUGGESTIONS = [
  'Where do I put my FD interest?',
  'What counts as an allowance?',
  "What does '87A rebate' mean?",
  'Which section is my rental income?',
  "What's the difference between old and new regime?",
]

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Phase-1 context = where the user is in the flow (navigation help only — no amounts, no advice).
  const buildContext = () => {
    const has = (k: string) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return Array.isArray(v) ? v.length > 0 : !!v } catch { return false } }
    return [
      `Salary added: ${has('av_salary_timeline') ? 'yes' : 'no'}`,
      `Other earnings added: ${has('av_other_income') ? 'yes' : 'no'}`,
      `Allowances added: ${has('av_exemptions') ? 'yes' : 'no'}`,
      `Deductions added: ${has('av_deductions') ? 'yes' : 'no'}`,
      `Tax computed (visited Your Tax): ${has('av_tax_overview') ? 'yes' : 'no'}`,
    ].join(' · ')
  }

  const send = async (text: string) => {
    if (!text.trim() || loading) return
    const base = [...messages, { role: 'user' as const, content: text }]
    setMessages([...base, { role: 'assistant', content: '' }])  // empty bubble to stream into
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: base.map(m => ({ role: m.role, content: m.content })), userContext: buildContext() }),
      })
      if (!res.body) throw new Error('no stream')
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = '', acc = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const parts = buf.split('\n\n')
        buf = parts.pop() || ''
        for (const part of parts) {
          const m = part.match(/^data: ([\s\S]*)$/)
          if (!m || m[1] === '[DONE]') continue
          try {
            const obj = JSON.parse(m[1])
            if (obj.text) { acc += obj.text; setMessages(prev => prev.map((mm, i) => i === prev.length - 1 ? { ...mm, content: acc } : mm)) }
          } catch {}
        }
      }
      if (!acc) setMessages(prev => prev.map((mm, i) => i === prev.length - 1 ? { ...mm, content: "Sorry, I couldn't get a response. Please try again." } : mm))
    } catch {
      setMessages(prev => prev.map((mm, i) => i === prev.length - 1 ? { ...mm, content: "Sorry, I couldn't connect. Please try again." } : mm))
    } finally { setLoading(false) }
  }

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const Avatar = ({ size }: { size: number }) => (
    <div style={{ width: size, height: size, borderRadius: '50%', background: C.wl, border: `1px solid ${C.wm}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 120 120" fill="none"><polygon points="9,9 21,9 60,101 99,9 111,9 60,111" fill={C.fg} /></svg>
    </div>
  )

  return (
    <div style={{ fontFamily: '"Sora",-apple-system,sans-serif', maxWidth: 720, height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 16, flexShrink: 0 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: '0 0 4px', letterSpacing: '-0.02em' }}>Ask ArthVo</h2>
        <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Stuck on a field? I'll explain it or tell you where it goes. (I help you use the app — not financial advice.)</p>
      </div>

      <div style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: '16px', overflow: 'auto', marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, textAlign: 'center', gap: 12 }}>
            <Avatar size={48} />
            <div>
              <p style={{ fontSize: 15, fontWeight: 600, color: C.text, margin: '0 0 4px' }}>{greeting}! I'm the ArthVo Guide.</p>
              <p style={{ fontSize: 12.5, color: C.muted, margin: 0, maxWidth: 400 }}>Ask me how to use ArthVo or what something on your screen means. No question is too small.</p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 4 }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)} style={{ padding: '7px 12px', background: C.wl, border: `1px solid ${C.wm}`, borderRadius: 20, fontSize: 12, color: C.fg, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {m.role === 'assistant' && <div style={{ marginRight: 8, marginTop: 2 }}><Avatar size={28} /></div>}
            <div style={{
              maxWidth: '78%', padding: '10px 14px', borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
              background: m.role === 'user' ? C.fg : C.wl, border: `1px solid ${m.role === 'user' ? 'transparent' : C.border}`,
              fontSize: 13, color: m.role === 'user' ? C.wheat : C.text, lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {m.role === 'assistant' && !m.content ? 'Thinking…' : m.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
          placeholder="Ask how to use ArthVo or what a field means…"
          style={{ flex: 1, padding: '10px 14px', border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: C.text, background: C.card }} />
        <button onClick={() => send(input)} disabled={!input.trim() || loading}
          style={{ padding: '10px 18px', background: input.trim() && !loading ? C.fg : '#C8D4C8', color: input.trim() && !loading ? C.wheat : '#8A9A8A', border: 'none', borderRadius: 5, fontSize: 13, fontWeight: 600, cursor: input.trim() && !loading ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
          Send →
        </button>
      </div>
    </div>
  )
}
