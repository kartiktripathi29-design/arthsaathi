'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import FYSelector from '@/components/FYSelector'

const C = { bg: '#FDFAF6', card: '#fff', border: '#E4DDD1', fg: '#1C2B22', muted: '#6B7770', primary: '#3A4B41', accent: '#E6CFA7' }

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
      toast.error('Please upload at least one salary slip to continue.')
      return
    }

    setUploading(true)
    
    try {
      // Store files metadata
      if (typeof window !== 'undefined') {
        const docs = {
          salary: salaryFile.name,
          ais: aisFile?.name || null,
          form26as: form26File?.name || null,
          uploadedAt: new Date().toISOString()
        }
        localStorage.setItem('av_uploaded_docs', JSON.stringify(docs))
      }

      // Parse salary slip. The API expects JSON { base64Data, mediaType, fileName } — it can't read
      // multipart FormData, so this upload previously failed for every file type. Send JSON to match
      // the route contract (same shape the other upload screens use).
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(((reader.result as string) || '').split(',')[1])
        reader.onerror = () => reject(new Error('Could not read file'))
        reader.readAsDataURL(salaryFile)
      })

      const res = await fetch('/api/parse-salary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Data, mediaType: salaryFile.type, fileName: salaryFile.name }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Parse failed')
      }

      const parsed = await res.json()
      setParsedData(parsed)

      // Show FY selector modal
      setShowFYSelector(true)
    } catch (e: any) {
      toast.error(e.message || 'Upload failed')
      setUploading(false)
    }
  }

  const handleFYSelect = (fy: string) => {
    // Store selected FY
    localStorage.setItem('av_selected_fy', fy)

    // Store parsed salary data. The API returns the slips under `data` (not `slips`), so the prior
    // `parsedData.slips` was undefined and threw here. Append behaviour is unchanged.
    const existing = JSON.parse(localStorage.getItem('av_salary_timeline') || '[]')
    localStorage.setItem('av_salary_timeline', JSON.stringify([...existing, ...(parsedData.data || [])]))

    // Navigate to Salary tab
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
          Start by uploading your salary slip. AIS and Form 26AS are optional and can be added later.
        </p>
      </div>

      {/* Salary Slip - Required */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: C.fg, margin: '0 0 4px' }}>Salary Slip</h3>
            <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>PDF, image, or Excel — any month of the financial year</p>
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
            Click to upload or drag & drop
          </button>
        )}
        <input ref={salaryRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && setSalaryFile(e.target.files[0])} />
      </div>

      {/* AIS - Optional */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: C.fg, margin: '0 0 4px' }}>Annual Information Statement (AIS)</h3>
            <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>From Income Tax Portal — optional, for comprehensive data</p>
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
            <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>TDS certificate — optional, for TDS reconciliation</p>
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

      {/* Action Buttons */}
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
      
      {/* FY Selector Modal */}
      {showFYSelector && parsedData?.slips?.[0] && (
        <FYSelector
          month={parsedData.slips[0].month}
          year={parsedData.slips[0].year}
          onSelect={handleFYSelect}
        />
      )}
    </div>
  )
}
