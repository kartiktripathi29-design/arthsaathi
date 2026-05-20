'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { unlockNextTab } from '../unlockNextTab'

const C = { fg:'#3A4B41', wheat:'#E6CFA7', wl:'#F5ECD8', wm:'#D4B98A', bg:'#FDFAF6', card:'#fff', border:'#E4DDD1', text:'#1C2B22', muted:'#7A8A7E', danger:'#B94040' }

interface OtherIncome {
  id: string
  type: 'dividend' | 'fd' | 'ltcg' | 'rental' | 'freelance' | 'other'
  amount: number
}

const INCOME_TYPES = [
  { key:'dividend', icon:'📈', label:'Dividend Income', sub:'Shares / mutual funds' },
  { key:'fd', icon:'🏦', label:'FD / Savings Interest', sub:'Bank deposits' },
  { key:'ltcg', icon:'📊', label:'Capital Gains', sub:'MF, shares, property' },
  { key:'rental', icon:'🏠', label:'Rental Income', sub:'From property you own' },
  { key:'freelance', icon:'💻', label:'Freelance / Consulting', sub:'Professional income' },
  { key:'other', icon:'💼', label:'Other Income', sub:'Any other taxable income' },
]

export default function OtherIncomePage() {
  const router = useRouter()
  const [incomes, setIncomes] = useState<OtherIncome[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const data = localStorage.getItem('av_other_income')
      if (data) {
        setIncomes(JSON.parse(data))
      }
    } catch (err) {
      console.error('Failed to load other income:', err)
    }
    setLoading(false)
  }, [])

  const handleAddIncome = (type: OtherIncome['type']) => {
    setIncomes(prev => [...prev, { id: Math.random().toString(36).slice(2, 9), type, amount: 0 }])
  }

  const handleUpdateAmount = (id: string, amount: number) => {
    setIncomes(prev => prev.map(inc => inc.id === id ? { ...inc, amount } : inc))
  }

  const handleRemoveIncome = (id: string) => {
    setIncomes(prev => prev.filter(inc => inc.id !== id))
  }

  const handleProceed = () => {
    try {
      localStorage.setItem('av_other_income', JSON.stringify(incomes))
      unlockNextTab('other-income')
      toast.success('Other income saved. Proceeding to Exemptions...')
      router.push('/dashboard/profile/exemptions')
    } catch (err) {
      toast.error('Failed to save other income')
      console.error(err)
    }
  }

  if (loading) {
    return <div style={{ padding:20, color:C.muted }}>Loading...</div>
  }

  const totalOtherIncome = incomes.reduce((sum, inc) => sum + inc.amount, 0)

  return (
    <div style={{ maxWidth:900 }}>
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:20, marginBottom:20 }}>
        <h2 style={{ fontSize:16, fontWeight:700, color:C.text, margin:'0 0 8px' }}>Other Income</h2>
        <p style={{ fontSize:13, color:C.muted, margin:'0 0 16px', lineHeight:1.6 }}>
          Add any income you received besides your salary. This could be dividends, interest, capital gains, rental income, freelance work, or other sources.
        </p>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:12, marginBottom:20 }}>
          {INCOME_TYPES.map(incomeType => (
            <button
              key={incomeType.key}
              onClick={() => handleAddIncome(incomeType.key as OtherIncome['type'])}
              style={{
                padding:16,
                background:C.wl,
                border:`1px solid ${C.border}`,
                borderRadius:8,
                cursor:'pointer',
                textAlign:'left',
                fontFamily:'inherit',
                transition:'all 0.2s',
              }}
              onMouseOver={e => {
                if (e.currentTarget) (e.currentTarget as HTMLButtonElement).style.borderColor = C.fg
              }}
              onMouseOut={e => {
                if (e.currentTarget) (e.currentTarget as HTMLButtonElement).style.borderColor = C.border
              }}
            >
              <div style={{ fontSize:24, marginBottom:6 }}>{incomeType.icon}</div>
              <p style={{ fontSize:13, fontWeight:600, color:C.text, margin:'0 0 2px' }}>{incomeType.label}</p>
              <p style={{ fontSize:11, color:C.muted, margin:0 }}>{incomeType.sub}</p>
            </button>
          ))}
        </div>

        {incomes.length > 0 && (
          <div style={{ marginBottom:20 }}>
            <h3 style={{ fontSize:13, fontWeight:600, color:C.text, margin:'0 0 12px' }}>
              Added Income Sources
            </h3>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {incomes.map(income => {
                const incomeTypeConfig = INCOME_TYPES.find(t => t.key === income.type)
                return (
                  <div
                    key={income.id}
                    style={{
                      display:'flex',
                      justifyContent:'space-between',
                      alignItems:'center',
                      padding:12,
                      background:C.wl,
                      borderRadius:6,
                      border:`1px solid ${C.border}`,
                    }}
                  >
                    <div style={{ display:'flex', alignItems:'center', gap:10, flex:1 }}>
                      <span style={{ fontSize:18 }}>{incomeTypeConfig?.icon}</span>
                      <div>
                        <p style={{ fontSize:13, fontWeight:500, color:C.text, margin:'0 0 2px' }}>
                          {incomeTypeConfig?.label}
                        </p>
                        <p style={{ fontSize:11, color:C.muted, margin:0 }}>
                          {incomeTypeConfig?.sub}
                        </p>
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ display:'flex', alignItems:'center', border:`1px solid ${C.border}`, borderRadius:4, overflow:'hidden' }}>
                        <span style={{ padding:'5px 7px', background:C.wl, fontSize:11, color:C.fg, fontWeight:600, borderRight:`1px solid ${C.border}` }}>₹</span>
                        <input
                          type="number"
                          value={income.amount || ''}
                          onChange={e => handleUpdateAmount(income.id, parseInt(e.target.value) || 0)}
                          placeholder="0"
                          style={{
                            border:'none',
                            outline:'none',
                            padding:'5px 8px',
                            fontSize:12,
                            width:100,
                            fontFamily:'inherit',
                          }}
                        />
                      </div>
                      <button
                        onClick={() => handleRemoveIncome(income.id)}
                        style={{
                          padding:'4px 8px',
                          background:C.danger,
                          color:'#fff',
                          border:'none',
                          borderRadius:3,
                          fontSize:11,
                          cursor:'pointer',
                          fontFamily:'inherit',
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ marginTop:12, padding:12, background:C.wl, borderRadius:6, borderLeft:`3px solid ${C.fg}` }}>
              <p style={{ fontSize:12, color:C.muted, margin:'0 0 4px' }}>Total Other Income</p>
              <p style={{ fontSize:16, fontWeight:700, color:C.text, margin:0 }}>
                ₹{totalOtherIncome.toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        )}

        <div style={{ display:'flex', gap:12, justifyContent:'flex-end' }}>
          <button
            onClick={() => router.push('/dashboard/profile/salary')}
            style={{
              padding:'10px 16px',
              background:C.card,
              color:C.text,
              border:`1px solid ${C.border}`,
              borderRadius:6,
              fontSize:13,
              fontWeight:500,
              cursor:'pointer',
              fontFamily:'inherit',
            }}
          >
            ← Back
          </button>
          <button
            onClick={handleProceed}
            style={{
              padding:'10px 20px',
              background:C.fg,
              color:C.wheat,
              border:'none',
              borderRadius:6,
              fontSize:13,
              fontWeight:600,
              cursor:'pointer',
              fontFamily:'inherit',
            }}
          >
            Proceed to Exemptions →
          </button>
        </div>
      </div>
    </div>
  )
}
