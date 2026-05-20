'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { unlockNextTab } from '../unlockNextTab'

const C = { fg:'#3A4B41', wheat:'#E6CFA7', wl:'#F5ECD8', wm:'#D4B98A', bg:'#FDFAF6', card:'#fff', border:'#E4DDD1', text:'#1C2B22', muted:'#7A8A7E', danger:'#B94040' }

interface SalaryComponent {
  label: string
  amount: number
  type: 'earning' | 'deduction'
}

export default function SalaryPage() {
  const router = useRouter()
  const [components, setComponents] = useState<SalaryComponent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const salary = localStorage.getItem('av_salary_components')
      if (salary) {
        setComponents(JSON.parse(salary))
      } else {
        setComponents([])
      }
    } catch (err) {
      console.error('Failed to load salary data:', err)
    }
    setLoading(false)
  }, [])

  const handleComponentChange = (index: number, field: 'amount', value: number) => {
    const updated = [...components]
    updated[index][field] = value
    setComponents(updated)
  }

  const handleAddComponent = () => {
    setComponents(prev => [...prev, { label:'', amount:0, type:'earning' }])
  }

  const handleRemoveComponent = (index: number) => {
    setComponents(prev => prev.filter((_, i) => i !== index))
  }

  const handleProceed = () => {
    if (components.length === 0) {
      toast.error('Please add at least one salary component')
      return
    }

    try {
      localStorage.setItem('av_salary_components', JSON.stringify(components))
      unlockNextTab('salary')
      toast.success('Salary data saved. Proceeding to Other Income...')
      router.push('/dashboard/profile/other-income')
    } catch (err) {
      toast.error('Failed to save salary data')
      console.error(err)
    }
  }

  if (loading) {
    return <div style={{ padding:20, color:C.muted }}>Loading...</div>
  }

  return (
    <div style={{ maxWidth:900 }}>
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:20, marginBottom:20 }}>
        <h2 style={{ fontSize:16, fontWeight:700, color:C.text, margin:'0 0 8px' }}>Your Salary Components</h2>
        <p style={{ fontSize:13, color:C.muted, margin:'0 0 16px', lineHeight:1.6 }}>
          Review and edit your salary components extracted from the uploaded slip. You can add or remove components as needed.
        </p>

        {components.length === 0 ? (
          <div style={{ padding:32, textAlign:'center', background:C.wl, borderRadius:8, marginBottom:20 }}>
            <p style={{ fontSize:14, color:C.muted, margin:'0 0 12px' }}>
              No salary components found. Please upload a salary slip first.
            </p>
            <button
              onClick={() => router.push('/dashboard/profile/documents')}
              style={{
                padding:'8px 16px',
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
              ← Go Back to Documents
            </button>
          </div>
        ) : (
          <>
            <div style={{ marginBottom:20, overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ borderBottom:`1px solid ${C.border}`, background:C.wl }}>
                    <th style={{ padding:'10px 12px', textAlign:'left', fontWeight:600, color:C.text }}>Component</th>
                    <th style={{ padding:'10px 12px', textAlign:'right', fontWeight:600, color:C.text }}>Amount (₹)</th>
                    <th style={{ padding:'10px 12px', textAlign:'center', fontWeight:600, color:C.text }}>Type</th>
                    <th style={{ padding:'10px 12px', textAlign:'center', fontWeight:600, color:C.text }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {components.map((comp, idx) => (
                    <tr key={idx} style={{ borderBottom:`0.5px solid ${C.border}` }}>
                      <td style={{ padding:'10px 12px', color:C.text }}>
                        <input
                          type="text"
                          value={comp.label}
                          onChange={e => {
                            const updated = [...components]
                            updated[idx].label = e.target.value
                            setComponents(updated)
                          }}
                          placeholder="e.g. Basic Salary"
                          style={{
                            width:'100%',
                            padding:'6px 8px',
                            border:`1px solid ${C.border}`,
                            borderRadius:4,
                            fontSize:12,
                            outline:'none',
                            fontFamily:'inherit',
                          }}
                        />
                      </td>
                      <td style={{ padding:'10px 12px', textAlign:'right' }}>
                        <input
                          type="number"
                          value={comp.amount}
                          onChange={e => handleComponentChange(idx, 'amount', parseInt(e.target.value) || 0)}
                          style={{
                            width:100,
                            padding:'6px 8px',
                            border:`1px solid ${C.border}`,
                            borderRadius:4,
                            fontSize:12,
                            outline:'none',
                            textAlign:'right',
                            fontFamily:'inherit',
                          }}
                        />
                      </td>
                      <td style={{ padding:'10px 12px', textAlign:'center' }}>
                        <select
                          value={comp.type}
                          onChange={e => {
                            const updated = [...components]
                            updated[idx].type = e.target.value as 'earning' | 'deduction'
                            setComponents(updated)
                          }}
                          style={{
                            padding:'6px 8px',
                            border:`1px solid ${C.border}`,
                            borderRadius:4,
                            fontSize:12,
                            outline:'none',
                            fontFamily:'inherit',
                          }}
                        >
                          <option value="earning">Earning</option>
                          <option value="deduction">Deduction</option>
                        </select>
                      </td>
                      <td style={{ padding:'10px 12px', textAlign:'center' }}>
                        <button
                          onClick={() => handleRemoveComponent(idx)}
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              onClick={handleAddComponent}
              style={{
                padding:'8px 16px',
                background:C.card,
                color:C.text,
                border:`1px solid ${C.border}`,
                borderRadius:6,
                fontSize:12,
                fontWeight:500,
                cursor:'pointer',
                fontFamily:'inherit',
                marginBottom:20,
              }}
            >
              + Add Component
            </button>
          </>
        )}

        <div style={{ display:'flex', gap:12, justifyContent:'flex-end' }}>
          <button
            onClick={() => router.push('/dashboard/profile/documents')}
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
            disabled={components.length === 0}
            style={{
              padding:'10px 20px',
              background: components.length > 0 ? C.fg : C.muted,
              color:C.wheat,
              border:'none',
              borderRadius:6,
              fontSize:13,
              fontWeight:600,
              cursor: components.length > 0 ? 'pointer' : 'not-allowed',
              fontFamily:'inherit',
              opacity: components.length > 0 ? 1 : 0.6,
            }}
          >
            Proceed to Other Income →
          </button>
        </div>
      </div>
    </div>
  )
}
