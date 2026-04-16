'use client'
import { useState, useCallback, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { useAppStore } from '@/store/AppStore'
import { InfoBox, Badge, Card } from '@/components/ui'
import type { ParsedSalaryData } from '@/types'

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ─── Take-Home Visual ────────────────────────────────────────────────────
function TakeHomeVisual({ gross, deductions, net }: { gross: number; deductions: number; net: number }) {
  const netPct = gross > 0 ? (net / gross) * 100 : 0
  const dedPct = gross > 0 ? (deductions / gross) * 100 : 0
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 11, color: '#5D6D7E', marginBottom: 6, fontWeight: 500 }}>
        Monthly gross → take-home
      </div>
      <div style={{ height: 10, borderRadius: 99, background: '#F1F2F4', overflow: 'hidden', display: 'flex', marginBottom: 8 }}>
        <div style={{ width: `${netPct}%`, background: '#1E8449', borderRadius: '99px 0 0 99px', transition: 'width 0.8s ease' }} />
        <div style={{ width: `${dedPct}%`, background: '#C0392B', transition: 'width 0.8s ease' }} />
      </div>
      <div style={{ display: 'flex', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#5D6D7E' }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: '#1E8449' }} />
          Take-Home ({netPct.toFixed(0)}%)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#5D6D7E' }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: '#C0392B' }} />
          Deductions ({dedPct.toFixed(0)}%)
        </div>
      </div>
    </div>
  )
}

// ─── Component Row ───────────────────────────────────────────────────────
function ComponentRow({ label, amount, type }: { label: string; amount: number; type: string }) {
  if (!amount || amount === 0) return null
  const styles: Record<string, { bg: string; border: string; color: string; prefix: string }> = {
    earning:    { bg: '#F0FDF4', border: '#1E8449', color: '#1E8449', prefix: '' },
    deduction:  { bg: '#FFF5F5', border: '#C0392B', color: '#C0392B', prefix: '−' },
    computed:   { bg: '#FFFBEB', border: '#E67E22', color: '#E67E22', prefix: '' },
  }
  const s = styles[type] || styles.computed
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', borderRadius: 8, marginBottom: 5, background: s.bg, borderLeft: `3px solid ${s.border}` }}>
      <span style={{ fontSize: 13, color: '#374151' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: s.color }}>{s.prefix}₹{amount.toLocaleString('en-IN')}</span>
    </div>
  )
}

// ─── Breakdown Panel ─────────────────────────────────────────────────────
function SalaryBreakdown({ data }: { data: ParsedSalaryData }) {
  const earnings = data.components?.filter(c => c.type === 'earning' && c.amount > 0) || []
  const deductions = data.components?.filter(c => c.type === 'deduction' && c.amount > 0) || []
  const hasComponents = earnings.length > 0 || deductions.length > 0

  const earningsItems = hasComponents ? earnings : [
    { label: 'Basic Salary', amount: data.basicSalary, type: 'earning' },
    { label: 'HRA', amount: data.hra, type: 'earning' },
    { label: 'Dearness Allowance', amount: data.da, type: 'earning' },
    { label: 'Travel Allowance', amount: data.ta, type: 'earning' },
    { label: 'Leave Travel Allowance', amount: data.lta, type: 'earning' },
    { label: 'Medical Allowance', amount: data.medicalAllowance, type: 'earning' },
    { label: 'Special Allowance', amount: data.specialAllowance, type: 'earning' },
    { label: 'Other Allowances', amount: data.otherAllowances, type: 'earning' },
  ].filter(c => c.amount > 0)

  const deductionItems = hasComponents ? deductions : [
    { label: 'EPF (Employee 12%)', amount: data.employeePF, type: 'deduction' },
    { label: 'ESIC', amount: data.esic, type: 'deduction' },
    { label: 'Professional Tax', amount: data.professionalTax, type: 'deduction' },
    { label: 'TDS (Income Tax)', amount: data.tdsDeducted, type: 'deduction' },
    { label: 'Loan Recovery', amount: data.loanDeduction, type: 'deduction' },
    { label: 'Other Deductions', amount: data.otherDeductions, type: 'deduction' },
  ].filter(c => c.amount > 0)

  return (
    <div className="fade-in">
      {/* Header summary */}
      <div style={{ background: 'linear-gradient(135deg, #0F2640, #1A3C5E)', borderRadius: 16, padding: '24px 28px', marginBottom: 20, color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 4, fontWeight: 500 }}>SALARY SLIP PARSED</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{data.employeeName || 'Employee'}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 3 }}>{data.employerName || 'Employer'} · {data.month} {data.year}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>MONTHLY TAKE-HOME</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: '#4ADE80', lineHeight: 1 }}>₹{data.netSalary?.toLocaleString('en-IN')}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 22 }}>
          {[
            { label: 'Gross Monthly', value: `₹${data.grossSalary?.toLocaleString('en-IN')}`, color: 'rgba(255,255,255,0.9)' },
            { label: 'Total Deductions', value: `₹${data.totalDeductions?.toLocaleString('en-IN')}`, color: '#FC8181' },
            { label: 'Annual CTC', value: `₹${((data.ctcAnnual || data.grossSalary * 12) / 100000).toFixed(2)}L`, color: '#FCD34D' },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        <TakeHomeVisual gross={data.grossSalary} deductions={data.totalDeductions} net={data.netSalary} />
      </div>

      {/* Components split */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14, alignItems: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1E8449' }}>↑ Earnings</div>
            <Badge color="green">{earningsItems.length} items</Badge>
          </div>
          {earningsItems.map((c, i) => <ComponentRow key={i} {...c} />)}
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '2px solid #F0F0F0', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1C2833' }}>Gross Salary</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#1E8449' }}>₹{data.grossSalary?.toLocaleString('en-IN')}</span>
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14, alignItems: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#C0392B' }}>↓ Deductions</div>
            <Badge color="red">{deductionItems.length} items</Badge>
          </div>
          {deductionItems.map((c, i) => <ComponentRow key={i} {...c} />)}
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '2px solid #F0F0F0', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1C2833' }}>Total Deductions</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#C0392B' }}>₹{data.totalDeductions?.toLocaleString('en-IN')}</span>
          </div>
        </Card>
      </div>

      {/* Net pay & EPF callouts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
        <div style={{ background: '#F0FDF4', border: '1px solid #A9DFBF', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ fontSize: 11, color: '#1E5631', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Net Pay (Take-Home)</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#1E8449' }}>₹{data.netSalary?.toLocaleString('en-IN')}</div>
          <div style={{ fontSize: 12, color: '#27AE60', marginTop: 4 }}>per month · ₹{(data.netSalary * 12)?.toLocaleString('en-IN')}/year</div>
        </div>

        {data.employeePF > 0 && (
          <div style={{ background: '#E8F1FA', border: '1px solid #A8CCE8', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ fontSize: 11, color: '#1A3C5E', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>EPF Contribution</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1A3C5E' }}>₹{((data.employeePF + (data.employerPF || data.employeePF)) * 12)?.toLocaleString('en-IN')}/yr</div>
            <div style={{ fontSize: 12, color: '#2E5A88', marginTop: 4 }}>
              You ₹{data.employeePF?.toLocaleString('en-IN')} + Employer ₹{(data.employerPF || data.employeePF)?.toLocaleString('en-IN')} /mo
            </div>
          </div>
        )}
      </div>

      {/* Next step */}
      <InfoBox variant="info" icon="→">
        <strong>Next step:</strong> Use the{' '}
        <Link href="/dashboard/tax" style={{ color: '#1A3C5E', fontWeight: 700 }}>Tax Optimiser</Link>
        {' '}to compare Old vs New regime based on this salary — and see exactly how much tax you can save.
      </InfoBox>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────
export default function SalaryPage() {
  const { salary, setSalary, } = useAppStore()
  const [loading, setLoading] = useState(false)
  const [consent, setConsent] = useState(true)

  const processFile = useCallback(async (file: File) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowed.includes(file.type)) { toast.error('Please upload a PDF or image (JPG, PNG, WebP)'); return }
    if (file.size > 10 * 1024 * 1024) { toast.error('File must be under 10MB'); return }

    setLoading(true)
    const toastId = toast.loading('Reading your salary slip with AI…')
    try {
      const base64Data = await fileToBase64(file)
      const res = await fetch('/api/parse-salary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Data, mediaType: file.type, fileName: file.name }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Parsing failed')
      setSalary(json.data)
      toast.success(`Parsed! Take-home: ₹${json.data.netSalary?.toLocaleString('en-IN')}/mo`, { id: toastId })
    } catch (e: any) {
      toast.error(e.message || 'Failed to parse. Try a clearer image.', { id: toastId })
    } finally {
      setLoading(false)
    }
  }, [setSalary])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: files => files[0] && processFile(files[0]),
    accept: { 'application/pdf': [], 'image/*': [] },
    multiple: false,
    disabled: loading,
  })

  if (salary && !loading) {
    return (
      <div className="fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1C2833', margin: 0 }}>Salary Analysis</h2>
            <div style={{ fontSize: 13, color: '#5D6D7E', marginTop: 3 }}>
              All components extracted · <Badge color="green">Parsed by AI</Badge>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setSalary(null)}
              style={{ padding: '8px 18px', background: '#fff', border: '1px solid #E5E9ED', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#1C2833' }}>
              ↑ New Upload
            </button>
            <Link href="/dashboard/tax" style={{ padding: '8px 18px', background: '#1A3C5E', color: '#fff', borderRadius: 9, fontSize: 13, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
              Optimise Tax →
            </Link>
          </div>
        </div>
        <SalaryBreakdown data={salary} />
      </div>
    )
  }

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1C2833', marginBottom: 6 }}>Upload Your Salary Slip</h2>
        <p style={{ fontSize: 14, color: '#5D6D7E', lineHeight: 1.65, maxWidth: 580 }}>
          Any format, any employer — PDF or photo. Claude Vision reads every component including Basic, HRA, PF, TDS, and more. Your data stays private.
        </p>
      </div>

      {/* Consent checkbox */}
      <div style={{ background: '#fff', border: '2px solid #E5E9ED', borderRadius: 12, padding: '16px 20px', marginBottom: 16, borderColor: consent ? '#1E8449' : '#E5E9ED', transition: 'border-color 0.2s' }}>
        <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer' }}>
          <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}
            style={{ width: 18, height: 18, marginTop: 1, accentColor: '#1E8449', cursor: 'pointer', flexShrink: 0 }} />
          <div style={{ fontSize: 13, color: '#1C2833', lineHeight: 1.7 }}>
            I understand that my salary slip will be processed by{' '}
            <a href="https://anthropic.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#1A3C5E', fontWeight: 600 }}>Anthropic's Claude AI</a>
            {' '}to extract salary data. The document is <strong>not stored</strong> on any server — only the structured numbers are shown to me. I have read the{' '}
            <a href="/privacy" target="_blank" style={{ color: '#1A3C5E', fontWeight: 600 }}>ArthVo Privacy Policy</a>
            {' '}and consent to this processing.
          </div>
        </label>
      </div>

      <div {...getRootProps()} className={`upload-zone${isDragActive ? ' active' : ''}`}
        style={{ padding: '64px 40px', textAlign: 'center', marginBottom: 20, opacity: consent ? 1 : 0.5, cursor: consent ? 'pointer' : 'not-allowed' }}>
        <input {...getInputProps()} />
        {loading ? (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#1C2833', marginBottom: 8 }}>Analysing with Claude Vision…</div>
            <div style={{ fontSize: 13, color: '#5D6D7E', marginBottom: 24 }}>Extracting every salary component</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              {['Reading layout', 'Finding components', 'Calculating totals'].map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#E8F1FA', borderRadius: 20, padding: '5px 14px', fontSize: 12, color: '#1A3C5E' }}>
                  <div className="skeleton" style={{ width: 7, height: 7, borderRadius: '50%' }} />
                  {s}
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 52, marginBottom: 14 }}>{isDragActive ? '📂' : '📄'}</div>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#1C2833', marginBottom: 8 }}>
              {isDragActive ? 'Drop to parse' : 'Drop your salary slip here'}
            </div>
            <div style={{ fontSize: 13, color: '#5D6D7E', marginBottom: 22 }}>PDF, JPG, PNG, WebP · Max 10MB · Any employer format</div>
            <button type="button" style={{ padding: '11px 28px', background: '#E67E22', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
              Browse Files
            </button>
          </>
        )}
      </div>

      {/* Supported formats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { icon: '🖨️', title: 'PDF Payslips', desc: 'Email PDFs, HR system exports, scanned documents' },
          { icon: '📸', title: 'Photo / Image', desc: 'Phone camera photos of printed payslips' },
          { icon: '🏢', title: 'Any Employer', desc: 'IT sector, PSU, SME, startup — all formats supported' },
          { icon: '🔒', title: 'Stays Private', desc: 'Processed in-memory, never stored on third-party servers' },
        ].map(f => (
          <div key={f.title} style={{ background: '#fff', border: '1px solid #E5E9ED', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>{f.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1C2833', marginBottom: 4 }}>{f.title}</div>
            <div style={{ fontSize: 12, color: '#5D6D7E', lineHeight: 1.5 }}>{f.desc}</div>
          </div>
        ))}
      </div>

      <InfoBox variant="info" icon="🔒">
        <strong>Privacy:</strong> Your salary slip is processed directly by Claude AI and converted to structured data. The raw document is never saved to any database. Only you see your financial information.
      </InfoBox>
    </div>
  )
}
