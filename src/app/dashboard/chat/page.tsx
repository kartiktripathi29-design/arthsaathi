'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '@/store/AppStore'
import { formatINR } from '@/lib/tax-engine'

interface Message { id: string; role: 'user' | 'assistant'; content: string; ts: Date }

const QUICK_PROMPTS = [
  { label: 'Save max tax this year', icon: '📊' },
  { label: 'New vs Old regime for me', icon: '⚖️' },
  { label: 'Best SIP for ₹5,000/mo', icon: '📈' },
  { label: 'How to claim HRA exemption', icon: '🏠' },
  { label: 'EPF vs NPS — which is better', icon: '🏦' },
  { label: 'Build ₹1 Crore in 10 years', icon: '🎯' },
  { label: 'What is Section 80C?', icon: '📋' },
  { label: 'Should I buy term insurance', icon: '🛡️' },
]

// Simple markdown-like renderer for assistant messages
function MessageContent({ content }: { content: string }) {
  const lines = content.split('\n')
  return (
    <div>
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} style={{ height: 6 }} />
        // Bold (**text**)
        const rendered = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Bullet points
        if (line.startsWith('- ') || line.startsWith('• ')) {
          return (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
              <span style={{ color: '#E67E22', flexShrink: 0, marginTop: 1 }}>•</span>
              <span dangerouslySetInnerHTML={{ __html: rendered.replace(/^[-•]\s/, '') }} />
            </div>
          )
        }
        // Numbered list
        const numMatch = line.match(/^(\d+)\.\s(.+)/)
        if (numMatch) {
          return (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
              <span style={{ color: '#E67E22', flexShrink: 0, minWidth: 18, fontWeight: 600 }}>{numMatch[1]}.</span>
              <span dangerouslySetInnerHTML={{ __html: numMatch[2].replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
            </div>
          )
        }
        // SEBI disclaimer line
        if (line.startsWith('⚠️')) {
          return (
            <div key={i} style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.08)', fontSize: 11, opacity: 0.65, lineHeight: 1.5 }}
              dangerouslySetInnerHTML={{ __html: rendered }} />
          )
        }
        return <div key={i} style={{ marginBottom: 2, lineHeight: 1.65 }} dangerouslySetInnerHTML={{ __html: rendered }} />
      })}
    </div>
  )
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 0' }}>
      {[0, 1, 2].map(i => (
        <div key={i} className="typing-dot" style={{ animationDelay: i === 0 ? '-0.32s' : i === 1 ? '-0.16s' : '0s' }} />
      ))}
    </div>
  )
}

export default function ChatPage() {
  const { salary, taxComparison } = useAppStore()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [showQuick, setShowQuick] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Build initial greeting
  useEffect(() => {
    const greeting = salary
      ? `Namaste! 🙏 I'm **ArthSaathi**, your SEBI-backed AI financial advisor.\n\nI can see your salary data: **₹${salary.netSalary?.toLocaleString('en-IN')}/mo take-home** from ${salary.employerName || 'your employer'}${taxComparison ? ` · Best regime: **${taxComparison.recommendation === 'new' ? 'New' : 'Old'} Regime** (saves ₹${taxComparison.savings.toLocaleString('en-IN')}/yr)` : ''}.\n\nAsk me anything about your taxes, investments, salary components, or financial goals. I follow SEBI guidelines and Indian tax law.`
      : `Namaste! 🙏 I'm **ArthSaathi**, your SEBI-backed AI financial advisor.\n\nI give personalised guidance on:\n- Indian income tax & regime comparison\n- Salary components & HRA exemption\n- SIP, ELSS, NPS & direct MF investment\n- Goal-based financial planning\n- Emergency funds & insurance\n\nUpload your salary slip for hyper-personalised advice, or ask me anything!`

    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: greeting,
      ts: new Date(),
    }])
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const buildContext = useCallback(() => {
    if (!salary) return 'No salary data uploaded. Give general Indian financial advice.'
    const parts = [
      `Employee: ${salary.employeeName} | Employer: ${salary.employerName} | ${salary.month} ${salary.year}`,
      `Monthly: Gross ₹${salary.grossSalary?.toLocaleString('en-IN')} | Net ₹${salary.netSalary?.toLocaleString('en-IN')} | TDS ₹${salary.tdsDeducted?.toLocaleString('en-IN')}`,
      `CTC Annual: ₹${(salary.ctcAnnual || salary.grossSalary * 12)?.toLocaleString('en-IN')}`,
      `PF: Employee ₹${salary.employeePF?.toLocaleString('en-IN')}/mo | Employer ₹${(salary.employerPF || salary.employeePF)?.toLocaleString('en-IN')}/mo`,
    ]
    if (taxComparison) {
      parts.push(`Tax: Old regime ₹${taxComparison.old.totalTax?.toLocaleString('en-IN')}/yr | New regime ₹${taxComparison.new.totalTax?.toLocaleString('en-IN')}/yr | Recommended: ${taxComparison.recommendation} (saves ₹${taxComparison.savings?.toLocaleString('en-IN')}/yr)`)
    }
    return parts.join('\n')
  }, [salary, taxComparison])

  const sendMessage = useCallback(async (text?: string) => {
    const content = (text || input).trim()
    if (!content || streaming) return
    setInput('')
    setShowQuick(false)

    const userMsg: Message = { id: `u${Date.now()}`, role: 'user', content, ts: new Date() }
    const aId = `a${Date.now() + 1}`
    const aMsg: Message = { id: aId, role: 'assistant', content: '', ts: new Date() }

    setMessages(prev => [...prev, userMsg, aMsg])
    setStreaming(true)

    try {
      const history = [...messages, userMsg]
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role, content: m.content }))

      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, userContext: buildContext() }),
      })

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') continue
          try {
            const { text } = JSON.parse(data)
            if (text) setMessages(prev => prev.map(m => m.id === aId ? { ...m, content: m.content + text } : m))
          } catch {}
        }
      }
    } catch {
      setMessages(prev => prev.map(m => m.id === aId ? { ...m, content: 'Sorry, something went wrong. Please try again.' } : m))
    } finally {
      setStreaming(false)
      inputRef.current?.focus()
    }
  }, [input, messages, streaming, buildContext])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)', maxWidth: 780 }}>
      {/* Context strip */}
      {salary && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 11, background: '#E8F1FA', color: '#1A3C5E', padding: '4px 10px', borderRadius: 20, fontWeight: 500 }}>
            📄 {salary.employeeName} · ₹{salary.netSalary?.toLocaleString('en-IN')}/mo
          </div>
          {taxComparison && (
            <div style={{ fontSize: 11, background: '#FEF3E2', color: '#92400E', padding: '4px 10px', borderRadius: 20, fontWeight: 500 }}>
              📊 {taxComparison.recommendation === 'new' ? 'New' : 'Old'} Regime saves ₹{(taxComparison.savings / 1000).toFixed(0)}K/yr
            </div>
          )}
          <div style={{ fontSize: 11, background: '#E9F7EF', color: '#1E5631', padding: '4px 10px', borderRadius: 20, fontWeight: 500 }}>
            🔒 Context-aware responses
          </div>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4, paddingBottom: 12 }}>
        {messages.map(msg => {
          const isUser = msg.role === 'user'
          return (
            <div key={msg.id} className="fade-in" style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 14 }}>
              {!isUser && (
                <div style={{ width: 34, height: 34, background: '#0F2640', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: '#E67E22', marginRight: 10, flexShrink: 0, alignSelf: 'flex-end', marginBottom: 2 }}>₹</div>
              )}
              <div className={isUser ? 'chat-user' : 'chat-assistant'}
                style={{ maxWidth: '76%', padding: isUser ? '11px 16px' : '14px 18px', fontSize: 14, lineHeight: 1.65, color: isUser ? '#fff' : '#1C2833' }}>
                {msg.content === '' && !isUser ? <TypingIndicator /> : <MessageContent content={msg.content} />}
                <div style={{ fontSize: 10, opacity: 0.45, marginTop: 6, textAlign: 'right' }}>
                  {msg.ts.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      {showQuick && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#95A5A6', marginBottom: 8, fontWeight: 500 }}>Quick questions</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {QUICK_PROMPTS.map(q => (
              <button key={q.label} onClick={() => sendMessage(q.label)}
                style={{ padding: '6px 13px', background: '#fff', border: '1px solid #E5E9ED', borderRadius: 20, fontSize: 12, color: '#1A3C5E', cursor: 'pointer', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.12s' }}
                onMouseEnter={e => { const el = e.currentTarget; el.style.background = '#E8F1FA'; el.style.borderColor = '#A8CCE8' }}
                onMouseLeave={e => { const el = e.currentTarget; el.style.background = '#fff'; el.style.borderColor = '#E5E9ED' }}>
                <span style={{ fontSize: 13 }}>{q.icon}</span> {q.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input box */}
      <div style={{ background: '#fff', border: '1px solid #E5E9ED', borderRadius: 14, padding: '10px 14px 10px 16px', display: 'flex', alignItems: 'flex-end', gap: 10, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', transition: 'border-color 0.15s' }}
        onFocusCapture={e => (e.currentTarget.style.borderColor = '#1A3C5E')}
        onBlurCapture={e => (e.currentTarget.style.borderColor = '#E5E9ED')}>
        <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKeyDown}
          placeholder="Ask about taxes, salary, investments… (Enter to send)"
          disabled={streaming} rows={1}
          style={{ flex: 1, border: 'none', outline: 'none', resize: 'none', fontSize: 14, color: '#1C2833', background: 'transparent', maxHeight: 120, lineHeight: 1.55, fontFamily: 'inherit', padding: '2px 0' }} />
        <button onClick={() => sendMessage()} disabled={!input.trim() || streaming}
          style={{ padding: '8px 18px', background: input.trim() && !streaming ? '#1A3C5E' : '#F0F0F0', color: input.trim() && !streaming ? '#fff' : '#95A5A6', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: input.trim() && !streaming ? 'pointer' : 'default', transition: 'all 0.15s', flexShrink: 0, lineHeight: 1 }}>
          {streaming ? '…' : '↑'}
        </button>
      </div>

      <div style={{ fontSize: 11, color: '#95A5A6', marginTop: 8, textAlign: 'center', lineHeight: 1.5 }}>
        ⚠️ AI advice is for educational purposes only. Consult a CA for ITR filing and a SEBI-registered RIA for investments above ₹5L.
      </div>
    </div>
  )
}
