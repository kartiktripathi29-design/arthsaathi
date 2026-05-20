'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { unlockNextTab } from '../unlockNextTab'

const C = { fg:'#3A4B41', wheat:'#E6CFA7', wl:'#F5ECD8', wm:'#D4B98A', bg:'#FDFAF6', card:'#fff', border:'#E4DDD1', text:'#1C2B22', muted:'#7A8A7E', danger:'#B94040' }

interface Deduction {
  key: string
  label: string
  section: string
  amount: number
  description: string
}

export default function DeductionsPage() {
  const router = useRouter()
  const [deductions, setDeductions] = useState<Deduction[]>([
    {
      key:'80c',
      label:'Investments (Section 80C)',
      section:'LIC, PPF, ELSS, FD, NSC, etc.',
      amount:0,
      description:'Investment-based deductions up to ₹1,50,000 in a financial year.',
    },
    {
      key:'80d',
      label:'Health Insurance (Section 80D)',
      section:'Medical insurance premiums',
      amount:0,
      description:'Deduction for health insurance premiums for self and family.',
    },
    {
      key:'80e',
      label:'Education Loan Interest (Section 80E)',
      section:'Student loan interest payments',
      amount:0,
      description:'Deduction for interest paid on education loan (no limit).',
    },
    {
      key:'other',
      label:'Other Deductions',
      section:'Section 80CCC, 80CCD, 80D(2D), etc.',
      amount:0,
      description:'Any other deductions you are eligible for.',
    },
  ])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const data = localStorage.getItem('av_deductions')
      if (data) {
        setDeductions(JSON.parse(data))
      }
    } catch (err) {
      console.error('Failed to load deductions:', err)
    }
    setLoading(false)
  }, [])

  const handleUpdateDeduction = (key: string, amount: number) => {
    setDeductions(prev =>
      prev.map(ded => ded.key === key ? { ...ded, amount } : ded)
    )
  }

  const handleProceed = () => {
    try {
      localStorage.setItem('av_deductions', JSON.stringify(deductions))
      unlockNextTab('deductions')
      toast.success('Deductions saved. You can now view your tax optimization results!')
      const completion = JSON.parse(localStorage.getItem('av_profile_completion') || '{}')
      completion['tax_optimization'] = true
      localStorage.setItem('av_profile_completion', JSON.stringify(completion))
      router.push('/dashboard/tax')
    } catch (err) {
      toast.error('Failed to save deductions')
      console.error(err)
    }
  }

  if (loading) {
    return <div style={{ padding:20, color:C.muted }}>Loading...</div>
  }

  const total80C = deductions.find(d => d.key === '80c')?.amount || 0
  const total80D = deductions.find(d => d.key === '80d')?.amount || 0
  const total80E = deductions.find(d => d.key === '80e')?.amount || 0
  const totalDeduction = deductions.reduce((sum, ded) => sum + ded.amount, 0)

  return (
    <div style={{ maxWidth:900 }}>
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:20, marginBottom:20 }}>
        <h2 style={{ fontSize:16, fontWeight:700, color:C.text, margin:'0 0 8px' }}>Deductions</h2>
        <p style={{ fontSize:13, color:C.muted, margin:'0 0 16px', lineHeight:1.6 }}>
          These are investments and expenses that <strong>reduce your taxable income</strong>. Enter the amounts you have invested or paid in this financial year.
        </p>

        <div style={{ display:'flex', flexDirection:'column', gap:16, marginBottom:20 }}>
          {deductions.map(deduction => (
            <div
              key={deduction.key}
              style={{
                background:C.wl,
                border:`1px solid ${C.border}`,
                borderRadius:8,
                padding:16,
              }}
            >
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'start', marginBottom:10 }}>
                <div>
                  <p style={{ fontSize:14, fontWeight:600, color:C.text, margin:'0 0 2px' }}>
                    {deduction.label}
                  </p>
                  <p style={{ fontSize:11, color:C.muted, margin:0 }}>
                    {deduction.section}
                  </p>
                </div>
              </div>

              <p style={{ fontSize:12, color:C.text, margin:'0 0 12px', lineHeight:1.6 }}>
                {deduction.description}
              </p>

              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <label style={{ fontSize:12, color:C.muted, fontWeight:500 }}>Amount:</label>
                <div style={{ display:'flex', alignItems:'center', border:`1px solid ${C.border}`, borderRadius:4, overflow:'hidden' }}>
                  <span style={{ padding:'5px 7px', background:C.wl, fontSize:11, color:C.fg, fontWeight:600, borderRight:`1px solid ${C.border}` }}>₹</span>
                  <input
                    type="number"
                    value={deduction.amount || ''}
                    onChange={e => handleUpdateDeduction(deduction.key, parseInt(e.target.value) || 0)}
                    placeholder="0"
                    style={{
                      border:'none',
                      outline:'none',
                      padding:'6px 8px',
                      fontSize:12,
                      width:140,
                      fontFamily:'inherit',
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding:16, background:C.wl, border:`1px solid ${C.wm}`, borderRadius:8, marginBottom:20 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
            <div>
              <p style={{ fontSize:11, color:C.muted, margin:'0 0 4px' }}>Section 80C</p>
              <p style={{ fontSize:14, fontWeight:600, color:C.text, margin:0 }}>
                ₹{total80C.toLocaleString('en-IN')}
              </p>
            </div>
            <div>
              <p style={{ fontSize:11, color:C.muted, margin:'0 0 4px' }}>Section 80D</p>
              <p style={{ fontSize:14, fontWeight:600, color:C.text, margin:0 }}>
                ₹{total80D.toLocaleString('en-IN')}
              </p>
            </div>
          </div>
          <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:12 }}>
            <p style={{ fontSize:12, color:C.muted, margin:'0 0 6px' }}>Total Deductions</p>
            <p style={{ fontSize:18, fontWeight:700, color:C.fg, margin:0 }}>
              ₹{totalDeduction.toLocaleString('en-IN')}
            </p>
          </div>
        </div>

        <div style={{ display:'flex', gap:12, justifyContent:'flex-end' }}>
          <button
            onClick={() => router.push('/dashboard/profile/exemptions')}
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
            View Tax Results →
          </button>
        </div>
      </div>
    </div>
  )
}
