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

function DataRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #F1F5F9' }}>
      <div>
        <div style={{ fontSize: 13, color: '#374151' }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{sub}</div>}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>{value}</div>
    </div>
  )
}

type DocType = 'ais' | '26as'

interface ParsedDoc { type: DocType; data: any }

export default function AISPage() {
  const { aisData, setAisData } = useAppStore()
  const [loading, setLoading] = useState<DocType | null>(null)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingType, setPendingType] = useState<DocType>('ais')
  const [pdfPassword, setPdfPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [parsed26AS, setParsed26AS] = useState<any>(null)
  const aisRef = useRef<HTMLInputElement>(null)
  const taxRef = useRef<HTMLInputElement>(null)

  const fmt = (n: number) => n > 0 ? `₹${Math.round(n).toLocaleString('en-IN')}` : '—'

  const processFile = useCallback(async (file: File, docType: DocType, password: string) => {
    setLoading(docType)
    setShowPasswordModal(false)
    const tid = toast.loading(docType === 'ais' ? 'Reading your AIS…' : 'Reading Form 26AS…')
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
        setPendingType(docType)
        setPasswordError('Incorrect password. AIS password = PAN lowercase + DOB DDMMYYYY')
        toast.dismiss(tid)
        return
      }
      if (!res.ok) throw new Error(json.error)
      if (docType === 'ais') {
        setAisData(json.data)
        toast.success(`AIS parsed! TDS: ${fmt(json.data.totalTDSDeducted || 0)}`, { id: tid })
      } else {
        setParsed26AS(json.data)
        toast.success('Form 26AS parsed!', { id: tid })
      }
      setPendingFile(null)
      setPdfPassword('')
    } catch (e: any) {
      toast.error(e.message || 'Failed. Please try again.', { id: tid })
    } finally {
      setLoading(null)
    }
  }, [setAisData])

  const handleFile = useCallback((file: File, docType: DocType) => {
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Please upload a PDF or image'); return
    }
    if (file.type === 'application/pdf' && docType === 'ais') {
      setPendingFile(file)
      setPendingType(docType)
      setPdfPassword('')
      setPasswordError('')
      setShowPasswordModal(true)
      return
    }
    processFile(file, docType, '')
  }, [processFile])

  const combined = aisData || parsed26AS
  const hasAIS = !!aisData
  const has26AS = !!parsed26AS

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1E293B', marginBottom: 6 }}>AIS / Form 26AS</h2>
        <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.65, maxWidth: 580 }}>
          Upload either or both. ArthVo reads your complete income and auto-fills everything.
        </p>
      </div>

      {/* Why info */}
      <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '10px 16px', marginBottom: 20, fontSize: 13, color: '#1D4ED8' }}>
        💡 <strong>AIS</strong> has more detail (capital gains, dividends, interest). <strong>Form 26AS</strong> shows TDS. Both are from the Income Tax website — upload whichever you have.
      </div>

      {/* Two upload cards */}
      {(!hasAIS || !has26AS) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>

          {/* AIS card */}
          <div style={{ border: hasAIS ? '1.5px solid #059669' : '1.5px dashed #A7F3D0', borderRadius: 14, padding: '24px 18px', textAlign: 'center', background: hasAIS ? '#ECFDF5' : '#F8FFFE', cursor: hasAIS ? 'default' : 'pointer' }}
            onClick={() => !hasAIS && !loading && aisRef.current?.click()}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📑</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: hasAIS ? '#065F46' : '#1E293B', marginBottom: 4 }}>
              {hasAIS ? '✅ AIS uploaded' : 'AIS'}
            </div>
            <div style={{ fontSize: 12, color: '#64748B', marginBottom: 14, lineHeight: 1.5 }}>
              Annual Information Statement<br />from incometax.gov.in
            </div>
            {!hasAIS && (
              <>
                <div style={{ display: 'inline-block', padding: '8px 20px', background: loading === 'ais' ? '#A7F3D0' : '#059669', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                  {loading === 'ais' ? 'Reading…' : 'Upload AIS'}
                </div>
                <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 8 }}>Optional · Needs password</div>
              </>
            )}
            {hasAIS && (
              <button onClick={e => { e.stopPropagation(); setAisData(null) }}
                style={{ fontSize: 11, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>
                Remove
              </button>
            )}
            <input ref={aisRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }}
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0], 'ais')} />
          </div>

          {/* 26AS card */}
          <div style={{ border: has26AS ? '1.5px solid #059669' : '1.5px dashed #CBD5E1', borderRadius: 14, padding: '24px 18px', textAlign: 'center', background: has26AS ? '#ECFDF5' : '#F8FAFC', cursor: has26AS ? 'default' : 'pointer' }}
            onClick={() => !has26AS && !loading && taxRef.current?.click()}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: has26AS ? '#065F46' : '#1E293B', marginBottom: 4 }}>
              {has26AS ? '✅ Form 26AS uploaded' : 'Form 26AS'}
            </div>
            <div style={{ fontSize: 12, color: '#64748B', marginBottom: 14, lineHeight: 1.5 }}>
              Tax credit statement<br />from TRACES portal
            </div>
            {!has26AS && (
              <>
                <div style={{ display: 'inline-block', padding: '8px 20px', background: loading === '26as' ? '#E2E8F0' : '#fff', color: '#1E293B', border: '1px solid #CBD5E1', borderRadius: 8, fontSize: 13, fontWeight: 500 }}>
                  {loading === '26as' ? 'Reading…' : 'Upload 26AS'}
                </div>
                <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 8 }}>Optional · No password needed</div>
              </>
            )}
            {has26AS && (
              <button onClick={e => { e.stopPropagation(); setParsed26AS(null) }}
                style={{ fontSize: 11, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>
                Remove
              </button>
            )}
            <input ref={taxRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }}
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0], '26as')} />
          </div>

        </div>
      )}

      {/* Password modal */}
      {showPasswordModal && pendingFile && (
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '20px', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B', marginBottom: 6 }}>🔐 Enter AIS Password</div>
          <div style={{ fontSize: 12, color: '#64748B', marginBottom: 12, lineHeight: 1.6 }}>
            AIS password = PAN lowercase + DOB (DDMMYYYY)<br />
            <span style={{ fontFamily: 'monospace', color: '#059669' }}>e.g. abcde1234f01011990</span><br />
            For Form 26AS — leave blank
          </div>
          <input type="text" value={pdfPassword} onChange={e => { setPdfPassword(e.target.value); setPasswordError('') }}
            onKeyDown={e => e.key === 'Enter' && pendingFile && processFile(pendingFile, pendingType, pdfPassword)}
            placeholder="Leave blank for Form 26AS"
            style={{ width: '100%', padding: '10px 12px', border: `1px solid ${passwordError ? '#DC2626' : '#E2E8F0'}`, borderRadius: 8, fontSize: 13, outline: 'none', marginBottom: 8, boxSizing: 'border-box' as const, fontFamily: 'monospace' }} />
          {passwordError && <div style={{ fontSize: 12, color: '#DC2626', marginBottom: 8 }}>{passwordError}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setShowPasswordModal(false); setPendingFile(null) }}
              style={{ flex: 1, padding: '10px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#64748B', fontFamily: 'inherit' }}>
              Cancel
            </button>
            <button onClick={() => pendingFile && processFile(pendingFile, pendingType, pdfPassword)} disabled={!!loading}
              style={{ flex: 2, padding: '10px', background: '#059669', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              {loading ? 'Reading…' : 'Open →'}
            </button>
          </div>
        </div>
      )}

      {/* Parsed results */}
      {combined && (
        <>
          <div style={{ background: '#1E293B', borderRadius: 16, padding: '20px 24px', marginBottom: 16, color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4, letterSpacing: '0.06em' }}>
                  {hasAIS && has26AS ? 'AIS + 26AS PARSED' : hasAIS ? 'AIS PARSED' : '26AS PARSED'}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{combined.taxpayerName || 'Taxpayer'}</div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                  {combined.pan ? `PAN: ${combined.pan}` : ''} {combined.assessmentYear ? `· AY ${combined.assessmentYear}` : ''}
                </div>
              </div>
              {/* Add the other doc button */}
              {hasAIS && !has26AS && (
                <button onClick={() => taxRef.current?.click()}
                  style={{ padding: '7px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: 'rgba(255,255,255,0.7)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  + Add 26AS
                </button>
              )}
              {has26AS && !hasAIS && (
                <button onClick={() => aisRef.current?.click()}
                  style={{ padding: '7px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: 'rgba(255,255,255,0.7)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  + Add AIS
                </button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
              {[
                { label: 'Total TDS Deducted', value: fmt(combined.totalTDSDeducted || 0), color: '#FC8181' },
                { label: 'Salary Income', value: fmt(combined.salaryIncome || 0), color: 'rgba(255,255,255,0.9)' },
                { label: 'Interest Income', value: fmt(combined.totalInterestIncome || 0), color: '#FCD34D' },
                { label: 'Capital Gains', value: fmt(combined.totalCapitalGains || 0), color: '#FCD34D' },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>{s.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* TDS entries */}
          {combined.tdsEntries?.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '16px 20px', marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1E293B', marginBottom: 12, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>TDS Deducted By</div>
              {combined.tdsEntries.map((e: any, i: number) => (
                <DataRow key={i} label={e.deductorName} value={fmt(e.tdsDeducted)} sub={`Gross: ${fmt(e.grossAmount)}`} />
              ))}
            </div>
          )}

          {/* Other income found */}
          {(combined.totalInterestIncome > 0 || combined.totalCapitalGains > 0 || combined.dividendIncome > 0) && (
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '16px 20px', marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1E293B', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Other Income Found</div>
              <div style={{ fontSize: 12, color: '#059669', background: '#ECFDF5', padding: '8px 12px', borderRadius: 6, marginBottom: 12 }}>
                ✅ Auto-filling your Other Income tab
              </div>
              {combined.dividendIncome > 0 && <DataRow label="Dividend Income" value={fmt(combined.dividendIncome)} />}
              {combined.totalInterestIncome > 0 && <DataRow label="Interest Income" value={fmt(combined.totalInterestIncome)} sub="FD, savings, bonds" />}
              {combined.totalCapitalGains > 0 && <DataRow label="Capital Gains" value={fmt(combined.totalCapitalGains)} sub="LTCG + STCG" />}
            </div>
          )}

          {/* Alerts */}
          {combined.alerts?.length > 0 && (
            <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 12, padding: '14px 18px', marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#78350F', marginBottom: 8 }}>⚠️ Tax Alerts</div>
              {combined.alerts.map((a: string, i: number) => (
                <div key={i} style={{ fontSize: 13, color: '#92400E', marginBottom: 5, paddingLeft: 8, borderLeft: '2px solid #FCD34D' }}>{a}</div>
              ))}
            </div>
          )}

          {/* Next + Reset */}
          <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 12, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#065F46' }}>✅ Document loaded — data auto-filled</div>
              <div style={{ fontSize: 12, color: '#059669', marginTop: 2 }}>Next: confirm your salary details</div>
            </div>
            <Link href="/dashboard/salary"
              style={{ padding: '10px 20px', background: '#1E293B', color: '#fff', borderRadius: 9, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
              Go to Salary Slip →
            </Link>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFF5F5', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ fontSize: 13, color: '#7F1D1D' }}>Uploaded the wrong document?</div>
            <button onClick={() => { setAisData(null); setParsed26AS(null) }}
              style={{ padding: '7px 16px', background: '#DC2626', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              ↺ Start over
            </button>
          </div>
        </>
      )}

      {/* Skip option */}
      {!combined && (
        <div style={{ textAlign: 'center', padding: '8px', fontSize: 13, color: '#64748B' }}>
          Don't have either?{' '}
          <Link href="/dashboard/salary" style={{ color: '#059669', fontWeight: 600 }}>
            Skip and enter salary manually →
          </Link>
        </div>
      )}

      {/* Hidden input refs for "add other" buttons */}
      <input ref={aisRef.current ? undefined : aisRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }}
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0], 'ais')} />
      <input ref={taxRef.current ? undefined : taxRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }}
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0], '26as')} />
    </div>
  )
}
