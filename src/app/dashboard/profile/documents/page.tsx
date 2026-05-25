'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { seedIfMissing, verifyIdentity, setStoredIdentity } from '@/lib/identity'

const C = { bg: '#FDFAF6', card: '#fff', border: '#E4DDD1', fg: '#1C2B22', muted: '#6B7770', primary: '#3A4B41' }

export default function DocumentsPage() {
  const router = useRouter()
  const [salaryFiles, setSalaryFiles] = useState<File[]>([])
  const [aisFile, setAisFile] = useState<File | null>(null)
  const [form26File, setForm26File] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string>('')
  const [parsedData, setParsedData] = useState<any>(null)

  const salaryRef = useRef<HTMLInputElement>(null)
  const aisRef = useRef<HTMLInputElement>(null)
  const form26Ref = useRef<HTMLInputElement>(null)

  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(((reader.result as string) || '').split(',')[1])
      reader.onerror = () => reject(new Error(`Could not read ${file.name}`))
      reader.readAsDataURL(file)
    })

  const handleProceed = async () => {
    if (salaryFiles.length === 0) {
      alert('Please upload at least one salary slip to continue.')
      return
    }

    setUploading(true)
    setUploadProgress(`Parsing ${salaryFiles.length} file${salaryFiles.length > 1 ? 's' : ''}…`)

    try {
      if (typeof window !== 'undefined') {
        const docs = {
          salary: salaryFiles.map(f => f.name),
          ais: aisFile?.name || null,
          form26as: form26File?.name || null,
          uploadedAt: new Date().toISOString()
        }
        localStorage.setItem('av_uploaded_docs', JSON.stringify(docs))
      }

      // Parse every salary file in parallel, then aggregate the slip arrays.
      const results = await Promise.allSettled(salaryFiles.map(async (file) => {
        const base64 = await readFileAsBase64(file)
        const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'application/pdf'
        const res = await fetch('/api/parse-salary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64Data: base64, mediaType })
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || `Parse failed for ${file.name}`)
        return { file, json }
      }))

      const allSlips: any[] = []
      const failed: string[] = []
      for (const r of results) {
        if (r.status === 'fulfilled') {
          const slips: any[] = Array.isArray(r.value.json?.data) ? r.value.json.data : []
          allSlips.push(...slips)
        } else {
          failed.push((r.reason as Error)?.message || 'parse failed')
        }
      }

      if (allSlips.length === 0) {
        alert(`Could not parse any slip.\n\n${failed.join('\n')}`)
        setUploading(false)
        setUploadProgress('')
        return
      }

      // Identity check across the aggregated batch — seed on first, verify rest.
      for (const slip of allSlips) {
        const seeded = seedIfMissing(slip)
        if (seeded) continue
        const check = verifyIdentity(slip)
        if (!check.ok) {
          const proceed = window.confirm(
            `One slip may belong to someone else:\n\n` +
            check.mismatches.map((m: string) => `• ${m}`).join('\n') +
            `\n\nUpload only your own salary slips. Continue anyway?`
          )
          if (!proceed) {
            setUploading(false)
            setUploadProgress('')
            return
          }
        } else if (check.enriched) {
          setStoredIdentity(check.enriched)
        }
      }

      // Pick the earliest slip's month/year to drive FY detection.
      const earliest = [...allSlips].sort((a, b) => {
        const ka = `${a.year || ''}-${a.month || ''}`
        const kb = `${b.year || ''}-${b.month || ''}`
        return ka.localeCompare(kb)
      })[0]

      const aggregated = { ...(results.find(r => r.status === 'fulfilled') as any)?.value?.json, data: allSlips, count: allSlips.length, _earliest: earliest }
      setParsedData(aggregated)
      // v7: FY is inferred from slip dates on the salary page — skip the FY selector modal.
      let existing: unknown
      try { existing = JSON.parse(localStorage.getItem('av_salary_timeline') || '[]') } catch { existing = [] }
      const existingArr = Array.isArray(existing) ? existing : []
      // Merge + dedupe by (year, month) so re-uploading the same month replaces, not appends.
      const merged = new Map<string, any>()
      for (const s of existingArr) {
        const k = `${s?.year || ''}|${String(s?.month || '').toLowerCase()}`
        if (k !== '|') merged.set(k, s)
      }
      for (const s of allSlips) {
        const k = `${s?.year || ''}|${String(s?.month || '').toLowerCase()}`
        if (k !== '|') merged.set(k, s)
      }
      localStorage.setItem('av_salary_timeline', JSON.stringify(Array.from(merged.values())))
      setUploading(false)
      setUploadProgress('')
      if (failed.length > 0) {
        alert(`${allSlips.length} slip(s) parsed. ${failed.length} file(s) failed:\n\n${failed.join('\n')}`)
      }
      router.push('/dashboard/profile/salary')
    } catch (e: any) {
      console.error('[Documents] Outer error:', e)
      alert(e.message || 'Upload failed')
      setUploading(false)
      setUploadProgress('')
    }
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

      {/* Salary Slips - Required (multi-file) */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: C.fg, margin: '0 0 4px' }}>Salary Slips</h3>
            <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>PDF, image, or Excel — upload one or many at once</p>
          </div>
          <span style={{ fontSize: 11, background: '#FEE', color: '#C33', padding: '2px 8px', borderRadius: 4, fontWeight: 500 }}>Required</span>
        </div>
        {salaryFiles.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
            {salaryFiles.map((f, i) => (
              <div key={`${f.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: C.bg, borderRadius: 6, border: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 18 }}>📄</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.fg }}>{f.name}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{(f.size / 1024).toFixed(1)} KB</div>
                </div>
                <button
                  onClick={() => setSalaryFiles(prev => prev.filter((_, j) => j !== i))}
                  style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 18 }}
                  title="Remove"
                >×</button>
              </div>
            ))}
          </div>
        )}
        <button onClick={() => salaryRef.current?.click()} style={{
          width: '100%', padding: '16px', background: C.bg, border: `2px dashed ${C.border}`,
          borderRadius: 6, cursor: 'pointer', fontSize: 13, color: C.muted, fontFamily: 'inherit',
        }}>
          {salaryFiles.length > 0 ? `+ Add more slips (${salaryFiles.length} selected)` : 'Click to upload one or more slips'}
        </button>
        <input
          ref={salaryRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls"
          multiple
          style={{ display: 'none' }}
          onChange={e => {
            const picked = Array.from(e.target.files || [])
            if (picked.length === 0) return
            setSalaryFiles(prev => {
              // De-dupe by name + size so re-picking the same file doesn't double-add.
              const seen = new Set(prev.map(f => `${f.name}:${f.size}`))
              const additions = picked.filter(f => !seen.has(`${f.name}:${f.size}`))
              return [...prev, ...additions]
            })
            e.target.value = '' // allow re-picking the same file later
          }}
        />
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
        <button onClick={handleProceed} disabled={salaryFiles.length === 0 || uploading} style={{
          flex: 1, padding: '12px', background: salaryFiles.length > 0 && !uploading ? C.primary : '#CCC',
          color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600,
          cursor: salaryFiles.length > 0 && !uploading ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
        }}>
          {uploading ? (uploadProgress || 'Parsing…') : (salaryFiles.length > 1 ? `Proceed (${salaryFiles.length} slips)` : 'Proceed')}
        </button>
        <button onClick={handleSkipToOtherIncome} style={{
          padding: '12px 20px', background: 'transparent', color: C.primary,
          border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, fontWeight: 500,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          Skip to Other Income
        </button>
      </div>
      
    </div>
  )
}
