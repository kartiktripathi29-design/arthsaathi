'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { unlockNextTab } from '../unlockNextTab'

const C = { fg:'#3A4B41', wheat:'#E6CFA7', wl:'#F5ECD8', wm:'#D4B98A', bg:'#FDFAF6', card:'#fff', border:'#E4DDD1', text:'#1C2B22', muted:'#7A8A7E', danger:'#B94040' }

interface Exemption {
  key: string
  label: string
  section: string
  amount: number
  description: string
}

export default function ExemptionsPage() {
  const router = useRouter()
  const [exemptions, setExemptions] = useState<Exemption[]>([
    {
      key:'hra',
      label:'House Rent Allowance (HRA)',
      section:'Section 10(13A)',
      amount:0,
      description:'Part of your salary that is tax-exempt if you pay rent and meet eligibility criteria.',
    },
    {
      key:'travel',
      label:'Travel Allowance',
      section:'Section 10(14)',
      amount:0,
      description:'Allowance received for official travel is fully exempt from tax.',
    },
    {
      key:'uniform',
      label:'Uniform / Conveyance Allowance',
      section:'Section 10(14)',
      amount:0,
      description:'Allowance for uniform maintenance and commute is exempt up to prescribed limits.',
    },
    {
      key:'lta',
      label:'Leave Travel Allowance (LTA)',
      section:'Section 10(5D)',
      amount:0,
      description:'Allowance for leave travel is exempt once in 2 calendar years.',
    },
    {
      key:'other',
      label:'Other Exemptions',
      section:'Section 10(14)',
      amount:0,
      description:'Any other allowances that are tax-exempt under Section 10(14).',
    },
  ])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const data = localStorage.getItem('av_exemptions')
      if (data) {
        setExemptions(JSON.parse(data))
      }
    } catch (err) {
      console.error('Failed to load exemptions:', err)
    }
    setLoading(false)
  }, [])

  const handleUpdateExemption = (key: string, amount: number) => {
    setExemptions(prev =>
      prev.map(ex => ex.key === key ? { ...ex, amount } : ex)
    )
  }

  const handleProceed = () => {
    try {
      localStorage.setItem('av_exemptions', JSON.stringify(exemptions))
      unlockNextTab('exemptions')
      toast.success('Exemptions saved. Proceeding to Deductions...')
      router.push('/dashboard/profile/deductions')
    } catch (err) {
      toast.error('Failed to save exemptions')
      console.error(err)
    }
  }

  if (loading) {
    return <div style={{ padding:20, color:C.muted }}>Loading...</div>
  }

  const totalExemption = exemptions.reduce((sum, ex) => sum + ex.amount, 0)

  return (
    <div style={{ maxWidth:900 }}>
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:20, marginBottom:20 }}>
        <h2 style={{ fontSize:16, fontWeight:700, color:C.text, margin:'0 0 8px' }}>Exemptions</h2>
        <p style={{ fontSize:13, color:C.muted, margin:'0 0 16px', lineHeight:1.6 }}>
          These are parts of your salary that are <strong>not taxed</strong> under Section 10(13A) and 10(14). Most people miss these and end up paying more tax than necessary.
        </p>

        <div style={{ display:'flex', flexDirection:'column', gap:16, marginBottom:20 }}>
          {exemptions.map(exemption => (
            <div
              key={exemption.key}
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
                    {exemption.label}
                  </p>
                  <p style={{ fontSize:11, color:C.muted, margin:0 }}>
                    {exemption.section}
                  </p>
                </div>
              </div>

              <p style={{ fontSize:12, color:C.text, margin:'0 0 12px', lineHeight:1.6 }}>
                {exemption.description}
              </p>

              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <label style={{ fontSize:12, color:C.muted, fontWeight:500 }}>Amount claiming:</label>
                <div style={{ display:'flex', alignItems:'center', border:`1px solid ${C.border}`, borderRadius:4, overflow:'hidden' }}>
                  <span style={{ padding:'5px 7px', background:C.wl, fontSize:11, color:C.fg, fontWeight:600, borderRight:`1px solid ${C.border}` }}>₹</span>
                  <input
                    type="number"
                    value={exemption.amount || ''}
                    onChange={e => handleUpdateExemption(exemption.key, parseInt(e.target.value) || 0)}
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

        <div style={{ padding:16, background:'#EEF2EE', border:`1px solid ${C.fg}`, borderRadius:8, marginBottom:20 }}>
          <p style={{ fontSize:12, color:C.muted, margin:'0 0 6px' }}>Total Tax-Free Income (Exemptions)</p>
          <p style={{ fontSize:18, fontWeight:700, color:C.fg, margin:0 }}>
            ₹{totalExemption.toLocaleString('en-IN')}
          </p>
          <p style={{ fontSize:11, color:C.muted, margin:'6px 0 0', fontStyle:'italic' }}>
            This amount is not subject to income tax
          </p>
        </div>

        <div style={{ display:'flex', gap:12, justifyContent:'flex-end' }}>
          <button
            onClick={() => router.push('/dashboard/profile/other-income')}
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
            Proceed to Deductions →
          </button>
        </div>
      </div>
    </div>
  )
}
