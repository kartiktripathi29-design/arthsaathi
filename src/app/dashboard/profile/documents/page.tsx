'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import FYSelector from '@/components/FYSelector'

const C = { bg: '#FDFAF6', card: '#fff', border: '#E4DDD1', fg: '#1C2B22', muted: '#6B7770', primary: '#3A4B41' }

export default function DocumentsPage() {
  const router = useRouter()
  const [salaryFile, setSalaryFile] = useState<File | null>(null)
  const [aisFile, setAisFile] = useState<File | null>(null)
  const [form26File, setForm26File] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [showFYSelector, setShowFYSelector] = useState(false)
  const [parsedData, setParsedData] = useState<any>(null)

  const salaryRef = useRef<HTMLInputElement>(null)
  const aisRef = useRef<HTMLInputElement>(null)
  const form26Ref = useRef<HTMLInputElement>(null)

  const handleProceed = async () => {
    if (!salaryFile) {
      alert('Please upload at least one salary slip to continue.')
      return
    }

    setUploading(true)
    
    try {
      if (typeof window !== 'undefined') {
        const docs = {
          salary: salaryFile.name,
          ais: aisFile?.name || null,
          form26as: form26File?.name || null,
          uploadedAt: new Date().toISOString()
        }
        localStorage.setItem('av_uploaded_docs', JSON.stringify(docs))
      }

      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const base64 = (e.target?.result as string).split(',')[1]
          const mediaType = salaryFile.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'application/pdf'
          
          console.log('[Documents] Sending to API with mediaType:', mediaType)
          const res = await fetch('/api/parse-salary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64Data: base64, mediaType })
          })

          console.log('[Documents] API response status:', res.status)
          if (!res.ok) {
            const err = await res.json()
            console.error('[Documents] API error:', err)
            throw new Error(err.error || 'Parse failed')
          }

          const parsed = await res.json()
          console.log('[Documents] Parse successful, data:', parsed)
          setParsedData(parsed)
          setShowFYSelector(true)
          setUploading(false)
        } catch (err: any) {
          console.error('[Documents] Error:', err)
          alert(err.message || 'Upload failed')
          setUploading(false)
        }
      }
      reader.readAsDataURL(salaryFile)
    } catch (e: any) {
      console.error('[Documents] Outer error:', e)
      alert(e.message || 'Upload failed')
      setUploading(false)
    }
  }

  const handleFYSelect = (fy: string) => {
    localStorage.setItem('av_selected_fy', fy)
    const existing = JSON.parse(localStorage.getItem('av_salary_timeline') || '[]')
    localStorage.setItem('av_salary_timeline', JSON.stringify([...existing, ...parsedData.data]))
    router.push('/dashboard/profile/salary')
  }

  const handleSkipToOtherIncome = () => {
    router.push('/dashboard/profile/other-income')
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.fg, margin: '0 0 6px' }}>Upload Your Documents</h2>
        <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>
          Start by uploading your salary slip. AIS and Form 26AS are optional.
        </p>
      </div>

      {/* Salary Slip - Required */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: C.fg, margin: '0 0 4px' }}>Salary Slip</h3>
            <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>PDF, image, or Excel — any month</p>
          </div>
          <span style={{ fontSize: 11, background: '#FEE', color: '#C33', padding: '2px 8px', borderRadius: 4, fontWeight: 500 }}>Required</span>
        </div>
        {salaryFile ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: C.bg, borderRadius: 6, border: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 18 }}>📄</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.fg }}>{salaryFile.name}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{(salaryFile.size / 1024).toFixed(1)} KB</div>
            </div>
            <button onClick={() => setSalaryFile(null)} style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 18 }}>×</button>
          </div>
        ) : (
          <button onClick={() => salaryRef.current?.click()} style={{
            width: '100%', padding: '16px', background: C.bg, border: `2px dashed ${C.border}`,
            borderRadius: 6, cursor: 'pointer', fontSize: 13, color: C.muted, fontFamily: 'inherit',
          }}>
            Click to upload
          </button>
        )}
        <input ref={salaryRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && setSalaryFile(e.target.files[0])} />
      </div>

      {/* AIS - Optional */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: C.fg, margin: '0 0 4px' }}>AIS (Annual Information Statement)</h3>
            <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>From Income Tax Portal — optional</p>
          </div>
          <span style={{ fontSize: 11, background: '#F0F0F0', color: '#666', padding: '2px 8px', borderRadius: 4, fontWeight: 500 }}>Optional</span>
        </div>
        {aisFile ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: C.bg, borderRadius: 6, border: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 18 }}>📄</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.fg }}>{aisFile.name}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{(aisFile.size / 1024).toFixed(1)} KB</div>
            </div>
            <button onClick={() => setAisFile(null)} style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 18 }}>×</button>
          </div>
        ) : (
          <button onClick={() => aisRef.current?.click()} style={{
            width: '100%', padding: '16px', background: C.bg, border: `2px dashed ${C.border}`,
            borderRadius: 6, cursor: 'pointer', fontSize: 13, color: C.muted, fontFamily: 'inherit',
          }}>
            Click to upload (optional)
          </button>
        )}
        <input ref={aisRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && setAisFile(e.target.files[0])} />
      </div>

      {/* Form 26AS - Optional */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: C.fg, margin: '0 0 4px' }}>Form 26AS</h3>
            <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>TDS certificate — optional</p>
          </div>
          <span style={{ fontSize: 11, background: '#F0F0F0', color: '#666', padding: '2px 8px', borderRadius: 4, fontWeight: 500 }}>Optional</span>
        </div>
        {form26File ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: C.bg, borderRadius: 6, border: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 18 }}>📄</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.fg }}>{form26File.name}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{(form26File.size / 1024).toFixed(1)} KB</div>
            </div>
            <button onClick={() => setForm26File(null)} style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 18 }}>×</button>
          </div>
        ) : (
          <button onClick={() => form26Ref.current?.click()} style={{
            width: '100%', padding: '16px', background: C.bg, border: `2px dashed ${C.border}`,
            borderRadius: 6, cursor: 'pointer', fontSize: 13, color: C.muted, fontFamily: 'inherit',
          }}>
            Click to upload (optional)
          </button>
        )}
        <input ref={form26Ref} type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && setForm26File(e.target.files[0])} />
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={handleProceed} disabled={!salaryFile || uploading} style={{
          flex: 1, padding: '12px', background: salaryFile && !uploading ? C.primary : '#CCC',
          color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600,
          cursor: salaryFile && !uploading ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
        }}>
          {uploading ? 'Parsing...' : 'Proceed'}
        </button>
        <button onClick={handleSkipToOtherIncome} style={{
          padding: '12px 20px', background: 'transparent', color: C.primary,
          border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, fontWeight: 500,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          Skip to Other Income
        </button>
      </div>
      
      {showFYSelector && parsedData?.data?.[0] && (
        <FYSelector
          month={parsedData.data[0].month}
          year={parsedData.data[0].year}
          onSelect={handleFYSelect}
        />
      )}
    </div>
  )
}
