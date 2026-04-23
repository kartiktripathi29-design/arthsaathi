'use client'
import { useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useAppStore } from '@/store/AppStore'

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function DataRow({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #F5F5F5' }}>
      <div>
        <div style={{ fontSize: 13, color: '#374151' }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: '#95A5A6', marginTop: 1 }}>{sub}</div>}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: highlight ? '#1E8449' : '#1C2833' }}>{value}</div>
    </div>
  )
}

export default function AISPage() {
  const { aisData, setAisData } = useAppStore()
  const [loading, setLoading] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pdfPassword, setPdfPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(async (file: File, password: string) => {
    setLoading(true)
    setShowPasswordModal(false)
    const tid = toast.loading('Reading your AIS / 26AS…')
    try {
      const base64Data = await fileToBase64(file)
      const res = await fetch('/api/parse-ais', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Data, mediaType: file.type, password: password || undefined }),
      })
      const json = await res.json()
      if (res.status === 422 || json.error === 'incorrect_password') {
        setShowPasswordModal(true)
        setPendingFile(file)
        setPasswordError('Incorrect password. Format: PAN lowercase + DOB DDMMYYYY. e.g. aizpn6725a05121998')
        toast.dismiss(tid)
        return
      }
      if (!res.ok) throw new Error(json.error)
      setAisData(json.data)
      setPendingFile(null)
      setPdfPassword('')
      toast.success(`AIS parsed! TDS: ₹${(json.data.totalTDSDeducted || 0).toLocaleString('en-IN')}`, { id: tid })
    } catch (e: any) {
      toast.error(e.message || 'Failed. Please try again.', { id: tid })
    } finally {
      setLoading(false)
    }
  }, [setAisData])

  const handleFile = useCallback((file: File) => {
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Please upload a PDF or image'); return
    }
    if (file.type === 'application/pdf') {
      setPendingFile(file)
      setPdfPassword('')
      setPasswordError('')
      setShowPasswordModal(true)
      return
    }
    processFile(file, '')
  }, [processFile])

  const fmt = (n: number) => n > 0 ? `₹${Math.round(n).toLocaleString('en-IN')}` : '—'

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1C2833', marginBottom: 6 }}>AIS / Form 26AS</h2>
        <p style={{ fontSize: 14, color: '#5D6D7E', lineHeight: 1.65, maxWidth: 600 }}>
          Upload your Annual Information Statement (AIS) or Form 26AS first. ArthVo reads your complete income picture — salary TDS, capital gains, dividends, interest — and auto-fills everything.
        </p>
      </div>

      {/* Why start here */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { icon: '🤖', title: 'Auto-fills everything', desc: 'Capital gains, dividends, FD interest — all extracted automatically' },
          { icon: '✅', title: 'IT Dept verified data', desc: 'AIS is the IT Department\'s record — most accurate source of income' },
          { icon: '⚡', title: 'Skip manual entry', desc: 'No need to manually enter what AIS already knows' },
        ].map(f => (
          <div key={f.title} style={{ background: '#E8F1FA', border: '1px solid #A8CCE8', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{f.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1A3C5E', marginBottom: 4 }}>{f.title}</div>
            <div style={{ fontSize: 12, color: '#2E5A88', lineHeight: 1.5 }}>{f.desc}</div>
          </div>
        ))}
      </div>

      {/* How to download */}
      <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 10, padding: '12px 16px', marginBottom: 24, fontSize: 13, color: '#78350F' }}>
        <strong>How to download AIS:</strong> incometax.gov.in → Login → AIS → Download PDF (password = PAN lowercase + DOB DDMMYYYY)<br />
        <strong>Form 26AS:</strong> TRACES (traces.gov.in) → View 26AS → Export PDF (no password)
      </div>

      {aisData ? (
        <>
          {/* Parsed data display */}
          <div style={{ background: 'linear-gradient(135deg, #0F2640, #1A3C5E)', borderRadius: 16, padding: '24px 28px', marginBottom: 20, color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4, letterSpacing: '0.08em' }}>AIS PARSED SUCCESSFULLY</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{aisData.taxpayerName || 'Taxpayer'}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>PAN: {aisData.pan} · AY {aisData.assessmentYear}</div>
              </div>
              <button onClick={() => setAisData(null)}
                style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: 'rgba(255,255,255,0.7)', fontSize: 12, cursor: 'pointer' }}>
                ↑ Upload New
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginTop: 20 }}>
              {[
                { label: 'Total TDS Deducted', value: fmt(aisData.totalTDSDeducted || 0), color: '#FC8181' },
                { label: 'Salary Income', value: fmt(aisData.salaryIncome || 0), color: 'rgba(255,255,255,0.9)' },
                { label: 'Interest Income', value: fmt(aisData.totalInterestIncome || 0), color: '#FCD34D' },
                { label: 'Capital Gains', value: fmt(aisData.totalCapitalGains || 0), color: '#FCD34D' },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* TDS Entries */}
          {aisData.tdsEntries?.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #E5E9ED', borderRadius: 12, padding: '20px', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1C2833', marginBottom: 14 }}>TDS Deducted By</div>
              {aisData.tdsEntries.map((e: any, i: number) => (
                <DataRow key={i} label={e.deductorName} value={fmt(e.tdsDeducted)}
                  sub={`${e.incomeType === 'salary' ? 'Salary' : 'Other'} · Gross: ${fmt(e.grossAmount)}`} />
              ))}
            </div>
          )}

          {/* Other income from AIS */}
          {(aisData.totalInterestIncome > 0 || aisData.totalCapitalGains > 0 || aisData.dividendIncome > 0) && (
            <div style={{ background: '#fff', border: '1px solid #E5E9ED', borderRadius: 12, padding: '20px', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1C2833', marginBottom: 6 }}>Other Income Found in AIS</div>
              <div style={{ fontSize: 12, color: '#27AE60', marginBottom: 14, background: '#E9F7EF', padding: '8px 12px', borderRadius: 6 }}>
                ✅ This will be auto-filled in your Other Income tab
              </div>
              {aisData.dividendIncome > 0 && <DataRow label="Dividend Income" value={fmt(aisData.dividendIncome)} sub="Taxable at slab rate" />}
              {aisData.totalInterestIncome > 0 && <DataRow label="Interest Income (Total)" value={fmt(aisData.totalInterestIncome)} sub="FD, savings, bonds" />}
              {aisData.totalCapitalGains > 0 && <DataRow label="Capital Gains (Total)" value={fmt(aisData.totalCapitalGains)} sub="LTCG + STCG" />}
              {aisData.rentalIncome > 0 && <DataRow label="Rental Income" value={fmt(aisData.rentalIncome)} />}
            </div>
          )}

          {/* Alerts */}
          {aisData.alerts?.length > 0 && (
            <div style={{ background: '#FEF3E2', border: '1px solid #F0C070', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#78350F', marginBottom: 10 }}>⚠️ Tax Alerts</div>
              {aisData.alerts.map((a: string, i: number) => (
                <div key={i} style={{ fontSize: 13, color: '#92400E', marginBottom: 6, paddingLeft: 8, borderLeft: '3px solid #F0C070' }}>{a}</div>
              ))}
            </div>
          )}

          {/* Next step */}
          <div style={{ background: '#E9F7EF', border: '1px solid #A9DFBF', borderRadius: 12, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1E5631' }}>✅ AIS loaded — data auto-filled</div>
              <div style={{ fontSize: 12, color: '#27AE60', marginTop: 3 }}>Next: confirm your salary details</div>
            </div>
            <Link href="/dashboard/salary"
              style={{ padding: '10px 20px', background: '#1A3C5E', color: '#fff', borderRadius: 9, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
              Go to Salary Slip →
            </Link>
          </div>

          {/* Reset */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFF5F5', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ fontSize: 13, color: '#7F1D1D' }}>Uploaded the wrong document?</div>
            <button onClick={() => setAisData(null)} style={{ padding: '7px 16px', background: '#DC2626', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              ↺ Start over
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Upload area */}
          <div style={{ border: '2px dashed #D1D5DB', borderRadius: 16, padding: '60px 40px', textAlign: 'center', marginBottom: 20, background: '#FAFAFA', cursor: 'pointer' }}
            onClick={() => fileRef.current?.click()}>
            <div style={{ fontSize: 52, marginBottom: 14 }}>📑</div>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#1C2833', marginBottom: 8 }}>Upload AIS or Form 26AS PDF</div>
            <div style={{ fontSize: 13, color: '#5D6D7E', marginBottom: 22 }}>PDF (with password for AIS) or image · Any format</div>
            <button type="button" style={{ padding: '11px 28px', background: '#1A3C5E', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              {loading ? '⟳ Reading…' : 'Browse Files'}
            </button>
            <input ref={fileRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }}
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </div>

          {/* Password modal */}
          {showPasswordModal && pendingFile && (
            <div style={{ background: '#fff', border: '1px solid #E5E9ED', borderRadius: 12, padding: '20px', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1C2833', marginBottom: 6 }}>🔐 Enter AIS Password</div>
              <div style={{ fontSize: 12, color: '#5D6D7E', marginBottom: 12, lineHeight: 1.6 }}>
                AIS password = PAN lowercase + DOB (DDMMYYYY)<br />
                <span style={{ fontFamily: 'monospace', color: '#1A3C5E' }}>e.g. aizpn6725a05121998</span><br />
                For Form 26AS — leave blank and click Open
              </div>
              <input type="text" value={pdfPassword} onChange={e => { setPdfPassword(e.target.value); setPasswordError('') }}
                onKeyDown={e => e.key === 'Enter' && pendingFile && processFile(pendingFile, pdfPassword)}
                placeholder="Leave blank for Form 26AS"
                style={{ width: '100%', padding: '10px 12px', border: `1px solid ${passwordError ? '#C0392B' : '#E5E9ED'}`, borderRadius: 8, fontSize: 13, outline: 'none', marginBottom: 8, boxSizing: 'border-box', fontFamily: 'monospace' }} />
              {passwordError && <div style={{ fontSize: 12, color: '#C0392B', marginBottom: 8 }}>{passwordError}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setShowPasswordModal(false); setPendingFile(null) }}
                  style={{ flex: 1, padding: '10px', background: '#fff', border: '1px solid #E5E9ED', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#5D6D7E' }}>
                  Cancel
                </button>
                <button onClick={() => pendingFile && processFile(pendingFile, pdfPassword)} disabled={loading}
                  style={{ flex: 2, padding: '10px', background: '#1A3C5E', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  {loading ? '⟳ Reading…' : 'Open PDF →'}
                </button>
              </div>
            </div>
          )}

          {/* Skip option */}
          <div style={{ textAlign: 'center', padding: '12px', fontSize: 13, color: '#5D6D7E' }}>
            Don't have AIS?{' '}
            <Link href="/dashboard/salary" style={{ color: '#1A3C5E', fontWeight: 600 }}>
              Skip and enter salary manually →
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
