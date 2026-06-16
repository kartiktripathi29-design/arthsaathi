'use client'
import { useState, useRef, useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { seedIfMissing, verifyIdentity, setStoredIdentity } from '@/lib/identity'
import { confirmDialog, passwordDialog } from '@/components/Dialog'
import { GuideStrip } from '@/components/GuideStrip'

import { tokens as T } from '@/lib/tokens'

const C = { bg: T.paper, card: T.card, border: T.hairline, fg: T.ink, muted: T.muted, primary: T.teal, faint: T.faint, green: T.green, sand: T.sand, navText: T.nav, ivory: T.ivory, caution: T.caution }

// Read an offer letter's joining date into { month, year } for the bootstrap slip. Falls back to the
// April of the financial year that contains today when the date can't be read.
function offerJoiningMonthYear(joining: unknown): { month: string; year: number } {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  if (typeof joining === 'string' && joining) {
    const iso = joining.match(/(\d{4})[-/](\d{1,2})/)               // 2026-06
    if (iso) return { month: months[Math.min(11, Math.max(0, +iso[2] - 1))], year: +iso[1] }
    const dmy = joining.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/)   // DD/MM/YYYY
    if (dmy) return { month: months[Math.min(11, Math.max(0, +dmy[2] - 1))], year: +dmy[3] }
    const abbr = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
    const named = joining.toLowerCase().match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*,?\s*(\d{4})/)
    if (named) return { month: months[abbr.indexOf(named[1])], year: +named[2] }
  }
  const now = new Date()
  const y = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1
  return { month: 'April', year: y }
}

// Synthesize ONE monthly salary slip (the same shape `/api/parse-salary` returns) from parsed
// offer-letter data, so a brand-new joiner with no payslips still has reviewable salary data and the
// tax pages can project the year. Offer fields are annual, so divide by 12. This only constructs
// data in the existing slip format — it changes no tax or salary computation.
function buildSlipFromOffer(d: any) {
  const mo = (n: number) => Math.max(0, Math.round((n || 0) / 12))
  const fixed = d?.fixedCTC || d?.totalCTC || 0
  const employerPF = mo(d?.employerPF)
  const grossSalary = Math.max(0, Math.round((fixed - (d?.employerPF || 0)) / 12))
  const basicSalary = mo(d?.basicSalary)
  const hra = mo(d?.hra)
  const da = mo(d?.da), ta = mo(d?.ta), lta = mo(d?.lta)
  const medicalAllowance = mo(d?.medicalAllowance)
  const otherAllowances = mo(d?.otherAllowances)
  // Offers rarely itemise every component; balance "Special Allowance" so the listed earnings sum to
  // gross (mirrors how the salary wizard recomputes gross = sum of earnings).
  const named = basicSalary + hra + da + ta + lta + medicalAllowance + otherAllowances
  let specialAllowance = mo(d?.specialAllowance)
  if (named + specialAllowance < grossSalary) specialAllowance = grossSalary - named
  const employeePF = mo(d?.employeePF)
  const professionalTax = mo(d?.professionalTax)
  const totalDeductions = employeePF + professionalTax
  const netSalary = Math.max(0, grossSalary - totalDeductions)
  const { month, year } = offerJoiningMonthYear(d?.joiningDate)
  const components = [
    basicSalary > 0 && { label: 'Basic Salary', amount: basicSalary, type: 'earning' },
    hra > 0 && { label: 'HRA', amount: hra, type: 'earning' },
    da > 0 && { label: 'Dearness Allowance', amount: da, type: 'earning' },
    ta > 0 && { label: 'Travel Allowance', amount: ta, type: 'earning' },
    lta > 0 && { label: 'LTA', amount: lta, type: 'earning' },
    medicalAllowance > 0 && { label: 'Medical Allowance', amount: medicalAllowance, type: 'earning' },
    specialAllowance > 0 && { label: 'Special Allowance', amount: specialAllowance, type: 'earning' },
    otherAllowances > 0 && { label: 'Other Allowances', amount: otherAllowances, type: 'earning' },
    employeePF > 0 && { label: 'Provident Fund', amount: employeePF, type: 'deduction' },
    professionalTax > 0 && { label: 'Professional Tax', amount: professionalTax, type: 'deduction' },
  ].filter(Boolean)
  return {
    id: `offer-${Date.now()}`,
    employeeName: '', employerName: d?.employerName || 'New employer',
    month, year,
    basicSalary, hra, da, ta, lta, medicalAllowance, specialAllowance, otherAllowances,
    grossSalary, employeePF, employerPF, esic: 0, professionalTax,
    tdsDeducted: 0, loanDeduction: 0, otherDeductions: 0, totalDeductions,
    netSalary, ctcMonthly: grossSalary + employerPF, ctcAnnual: (grossSalary + employerPF) * 12,
    components, source: 'offer',
  }
}

export default function DocumentsPage() {
  const router = useRouter()
  const [salaryFiles, setSalaryFiles] = useState<File[]>([])
  const [aisFile, setAisFile] = useState<File | null>(null)
  const [form26File, setForm26File] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string>('')
  const [parsedData, setParsedData] = useState<any>(null)
  // AIS / 26AS are parsed the moment they're attached (independent of the salary slip), so an
  // AIS-only upload works and "Skip to Other Income" carries the data through.
  type DocStatus = { state: 'idle' | 'reading' | 'done' | 'error'; msg?: string }
  const [aisStatus, setAisStatus] = useState<DocStatus>({ state: 'idle' })
  const [form26Status, setForm26Status] = useState<DocStatus>({ state: 'idle' })
  // Offer letter — optional. Bootstraps salary for a new joiner with no slips, or is applied as a
  // mid-year job switch on the Salary page when slips already exist.
  const [offerFile, setOfferFile] = useState<File | null>(null)
  const [offerData, setOfferData] = useState<any>(null)
  const [offerStatus, setOfferStatus] = useState<DocStatus>({ state: 'idle' })

  const salaryRef = useRef<HTMLInputElement>(null)
  const aisRef = useRef<HTMLInputElement>(null)
  const form26Ref = useRef<HTMLInputElement>(null)
  const offerRef = useRef<HTMLInputElement>(null)

  // Guide strip — orientation + the how-to-download-AIS/26AS steps people actually get stuck on.
  // Lightly data-aware: if an AIS was already read on a prior visit, acknowledge it. (localStorage is
  // read in an effect, not in render, so SSR doesn't touch it.)
  const [hasAis, setHasAis] = useState(false)
  useEffect(() => {
    try { setHasAis(!!JSON.parse(localStorage.getItem('as_ais') || 'null')) } catch { /* ignore */ }
  }, [])
  const guideLines: ReactNode[] = [
    hasAis
      ? <>AIS read — its income flows into Other earnings. Add a salary slip to build your year.</>
      : <>Start with a salary slip. AIS &amp; 26AS are optional — they make your refund exact, not estimated.</>,
    <>Download them at the <a href="https://www.incometax.gov.in" target="_blank" rel="noopener noreferrer" style={{ color: C.primary, fontWeight: 600 }}>Income Tax portal</a>: <strong>AIS</strong> (top menu) for the statement; <strong>e-File → Income Tax Returns → View Form 26AS</strong> for 26AS.</>,
    <>PDF password = <strong>PAN in lowercase + DOB (DDMMYYYY)</strong>, e.g. abcde1234f01011990.</>,
  ]

  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(((reader.result as string) || '').split(',')[1])
      reader.onerror = () => reject(new Error(`Could not read ${file.name}`))
      reader.readAsDataURL(file)
    })

  // Parse an AIS / Form 26AS document via /api/parse-ais and return the parsed object (with
  // totalTaxCredit, TDS entries, etc.), or null on skip/failure. Portal AIS/26AS PDFs are
  // password-protected (PAN-lowercase + DOB-DDMMYYYY). The server returns 422 'incorrect_password'
  // BOTH when no password is supplied and when a wrong one is — so we loop: keep re-prompting (with a
  // clearer "that didn't work" message on retries) until the file opens or the user cancels. Optional,
  // so never throws.
  const parseAisDoc = async (file: File): Promise<any | null> => {
    const base64 = await readFileAsBase64(file)
    const mediaType = file.type || 'application/pdf'
    const call = (password?: string) => fetch('/api/parse-ais', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Data: base64, mediaType, password }),
    })
    let res = await call()
    let attempt = 0
    while (res.status === 422) {
      const j = await res.json().catch(() => ({} as any))
      if (j?.error !== 'incorrect_password') break
      attempt++
      const pwd = await passwordDialog({
        title: attempt === 1 ? 'Password-protected document' : 'That password didn’t work',
        message: attempt === 1
          ? `"${file.name}" is password-protected.\n\nThe AIS / 26AS password is your PAN in lowercase + date of birth as DDMMYYYY — e.g. abcde1234f01011990 (all letters lowercase, 8-digit DOB, no spaces).\n\nEnter it to read the document, or cancel to skip.`
          : `That didn’t open "${file.name}".\n\nDouble-check the format: every PAN letter in lowercase, date of birth as DDMMYYYY (e.g. 01081990), and no spaces. It’s the same password the Income-Tax portal shows when you download the AIS.\n\nTry again, or cancel to skip.`,
        confirmLabel: 'Unlock',
        placeholder: 'Document password',
      })
      if (!pwd) return null
      res = await call(pwd)
    }
    if (!res.ok) return null
    const j = await res.json().catch(() => null)
    return j?.data || null
  }

  // Parse a just-attached AIS/26AS and persist to as_ais (prefer AIS as the superset of 26AS).
  // Runs on selection so it doesn't depend on the salary slip or the Proceed button.
  const processTaxDoc = async (file: File, which: 'ais' | 'form26as') => {
    const setStatus = which === 'ais' ? setAisStatus : setForm26Status
    setStatus({ state: 'reading' })
    try {
      const parsed = await parseAisDoc(file)
      if (!parsed) {
        setStatus({ state: 'error', msg: 'Couldn’t read this document — skipped. You can still continue.' })
        return
      }
      // 26AS only writes as_ais when no AIS is attached (AIS is the superset).
      if (which === 'ais' || !aisFile) localStorage.setItem('as_ais', JSON.stringify(parsed))
      const credit = Number(parsed.totalTaxCredit) || 0
      setStatus({ state: 'done', msg: credit > 0 ? `Read ✓ · TDS / tax credit ₹${Math.round(credit).toLocaleString('en-IN')}` : 'Read ✓' })
    } catch (e: any) {
      setStatus({ state: 'error', msg: 'Couldn’t read this document — skipped. You can still continue.' })
    }
  }

  // Parse an offer letter via /api/parse-offer-letter, returning the parsed object or null on
  // skip/failure. Offer PDFs/DOCX may be password-protected — if so, prompt once and retry. Optional,
  // so never throws.
  const parseOfferDoc = async (file: File): Promise<any | null> => {
    const base64 = await readFileAsBase64(file)
    const mediaType = file.type || 'application/pdf'
    const call = (password?: string) => fetch('/api/parse-offer-letter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Data: base64, mediaType, fileName: file.name, password }),
    })
    let res = await call()
    if (res.status === 422) {
      const j = await res.json().catch(() => ({} as any))
      if (j?.error === 'requires_password' || j?.error === 'incorrect_password') {
        const pwd = await passwordDialog({
          title: 'Password-protected offer letter',
          message: `"${file.name}" is password-protected. Enter the password to read it, or cancel to skip.`,
          confirmLabel: 'Unlock',
          placeholder: 'PDF password',
        })
        if (!pwd) return null
        res = await call(pwd)
      }
    }
    if (!res.ok) return null
    const j = await res.json().catch(() => null)
    return j?.data || null
  }

  // Parse a just-attached offer letter and hold the parsed data in state. The decision of how to use
  // it (bootstrap vs. job switch) is made on Proceed, once we know whether the user has slips.
  const processOfferDoc = async (file: File) => {
    setOfferStatus({ state: 'reading' })
    try {
      const parsed = await parseOfferDoc(file)
      if (!parsed) {
        setOfferStatus({ state: 'error', msg: 'Couldn’t read this offer letter — skipped. You can still continue.' })
        setOfferData(null)
        return
      }
      setOfferData(parsed)
      const fixed = parsed.fixedCTC || parsed.totalCTC || 0
      const monthlyGross = Math.max(0, Math.round((fixed - (parsed.employerPF || 0)) / 12))
      const emp = parsed.employerName || 'New employer'
      setOfferStatus({ state: 'done', msg: monthlyGross > 0 ? `Read ✓ · ${emp} · ₹${monthlyGross.toLocaleString('en-IN')}/mo` : 'Read ✓' })
    } catch {
      setOfferStatus({ state: 'error', msg: 'Couldn’t read this offer letter — skipped. You can still continue.' })
      setOfferData(null)
    }
  }

  const DocStatusLine = ({ status }: { status: DocStatus }) => {
    if (status.state === 'idle') return null
    const color = status.state === 'done' ? C.green : status.state === 'error' ? '#B94040' : C.muted
    const text = status.state === 'reading' ? 'Reading document…' : status.msg
    return <p style={{ fontSize: 11, color, margin: '8px 0 0', fontWeight: 500 }}>{text}</p>
  }

  const handleProceed = async () => {
    const hasSalary = salaryFiles.length > 0
    if (!hasSalary && !aisFile && !form26File && !offerData) {
      toast.error('Please upload a salary slip, offer letter, AIS, or Form 26AS to continue.')
      return
    }

    // Does the user already have payslips in their timeline (returning user)?
    let existingSlips: any[] = []
    try { const t = JSON.parse(localStorage.getItem('av_salary_timeline') || '[]'); if (Array.isArray(t)) existingSlips = t } catch {}
    const hasAnySlips = hasSalary || existingSlips.length > 0

    // Offer letter handling. New joiner with NO slips → bootstrap the salary timeline from the offer
    // so the Salary page has reviewable data and the tax pages can project the year. Switcher (slips
    // being uploaded now / already present) → stash the offer; the Salary page turns it into a
    // mid-year job switch on load.
    if (offerData) {
      if (!hasAnySlips) {
        const slip = buildSlipFromOffer(offerData)
        try {
          localStorage.setItem('av_salary_timeline', JSON.stringify([slip]))
          localStorage.removeItem('av_salary_summary')   // recompute salary facts from the offer slip
          localStorage.removeItem('av_pending_offer')
          localStorage.setItem('av_uploaded_docs', JSON.stringify({
            salary: [], ais: aisFile?.name || null, form26as: form26File?.name || null,
            offer: offerFile?.name || null, uploadedAt: new Date().toISOString(),
          }))
        } catch {}
        toast.success('Offer letter read — projecting your year. Review it on the Salary page.')
        router.push('/dashboard/profile/salary')
        return
      }
      try { localStorage.setItem('av_pending_offer', JSON.stringify(offerData)) } catch {}
    }

    // AIS / 26AS-only path: those documents are already parsed on attach, so there's nothing more to
    // parse here. Go straight to Other Income, where the AIS income lands and the import banner shows.
    // (A salary slip is NOT required — e.g. a Sep/Dec filer may have AIS data but no new slip.)
    // With a stashed offer but existing slips, go to the Salary page so the job switch is applied.
    if (!hasSalary) {
      router.push(offerData ? '/dashboard/profile/salary' : '/dashboard/profile/other-income')
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
          offer: offerFile?.name || null,
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
          body: JSON.stringify({ base64Data: base64, mediaType, fileName: file.name })
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
        toast.error(`Could not parse any slip.\n${failed.join('\n')}`)
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
          const proceed = await confirmDialog({
            title: 'Possible identity mismatch',
            message:
              `One slip may belong to someone else:\n\n` +
              check.mismatches.map((m: string) => `• ${m}`).join('\n') +
              `\n\nUpload only your own salary slips. Continue anyway?`,
            confirmLabel: 'Continue', danger: true,
          })
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
        toast(`${allSlips.length} slip(s) parsed. ${failed.length} file(s) failed:\n${failed.join('\n')}`, { icon: '⚠️', duration: 6000 })
      }
      // AIS / 26AS are already parsed on attach (see processTaxDoc), so nothing to do here.
      router.push('/dashboard/profile/salary')
    } catch (e: any) {
      console.error('[Documents] Outer error:', e)
      toast.error(e.message || 'Upload failed')
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
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.fg, margin: '0 0 6px' }}>Upload your documents</h2>
        <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>
          Start by uploading your salary slip — or, if you’ve just changed jobs and have no slip yet, your offer letter. AIS and Form 26AS are optional.
        </p>
      </div>

      <GuideStrip tone={hasAis ? 'good' : 'calm'} lines={guideLines} />

      {/* Salary Slips - Required (multi-file) */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: C.fg, margin: '0 0 4px' }}>Salary Slips</h3>
            <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>PDF, image, or Excel — <span style={{ whiteSpace: 'nowrap' }}>upload one or many at once</span></p>
          </div>
          <span style={{ fontSize: 11, background: C.caution.fill, color: C.caution.text, border: `1px solid ${C.caution.border}`, padding: '2px 8px', borderRadius: 4, fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap' }}>Required</span>
        </div>
        {salaryFiles.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
            {salaryFiles.map((f, i) => (
              <div key={`${f.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: C.bg, borderRadius: 6, border: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 18 }}>📄</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
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

      {/* Offer Letter - Optional (bootstraps salary for a new joiner / mid-year job switch) */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: C.fg, margin: '0 0 4px' }}>Offer Letter</h3>
            <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>New job, no slip yet? We’ll project your year from it. Already have slips? We’ll add it as a mid-year job switch.</p>
          </div>
          <span style={{ fontSize: 11, background: C.sand, color: C.navText, padding: '2px 8px', borderRadius: 4, fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap' }}>Optional</span>
        </div>
        {offerFile ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: C.bg, borderRadius: 6, border: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 18 }}>📄</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{offerFile.name}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{(offerFile.size / 1024).toFixed(1)} KB</div>
            </div>
            <button onClick={() => { setOfferFile(null); setOfferData(null); setOfferStatus({ state: 'idle' }) }} style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 18 }}>×</button>
          </div>
        ) : (
          <button onClick={() => offerRef.current?.click()} style={{
            width: '100%', padding: '16px', background: C.bg, border: `2px dashed ${C.border}`,
            borderRadius: 6, cursor: 'pointer', fontSize: 13, color: C.muted, fontFamily: 'inherit',
          }}>
            Click to upload (optional)
          </button>
        )}
        <DocStatusLine status={offerStatus} />
        <input ref={offerRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { setOfferFile(f); processOfferDoc(f) } }} />
      </div>

      {/* AIS - Optional */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: C.fg, margin: '0 0 4px' }}>AIS</h3>
            <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Annual Information Statement — <span style={{ whiteSpace: 'nowrap' }}>from the Income Tax Portal</span></p>
          </div>
          <span style={{ fontSize: 11, background: C.sand, color: C.navText, padding: '2px 8px', borderRadius: 4, fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap' }}>Optional</span>
        </div>
        {aisFile ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: C.bg, borderRadius: 6, border: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 18 }}>📄</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{aisFile.name}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{(aisFile.size / 1024).toFixed(1)} KB</div>
            </div>
            <button onClick={() => { setAisFile(null); setAisStatus({ state: 'idle' }) }} style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 18 }}>×</button>
          </div>
        ) : (
          <button onClick={() => aisRef.current?.click()} style={{
            width: '100%', padding: '16px', background: C.bg, border: `2px dashed ${C.border}`,
            borderRadius: 6, cursor: 'pointer', fontSize: 13, color: C.muted, fontFamily: 'inherit',
          }}>
            Click to upload (optional)
          </button>
        )}
        <DocStatusLine status={aisStatus} />
        <input ref={aisRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { setAisFile(f); processTaxDoc(f, 'ais') } }} />
      </div>

      {/* Form 26AS - Optional */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: C.fg, margin: '0 0 4px' }}>Form 26AS</h3>
            <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>TDS certificate</p>
          </div>
          <span style={{ fontSize: 11, background: C.sand, color: C.navText, padding: '2px 8px', borderRadius: 4, fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap' }}>Optional</span>
        </div>
        {form26File ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: C.bg, borderRadius: 6, border: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 18 }}>📄</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{form26File.name}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{(form26File.size / 1024).toFixed(1)} KB</div>
            </div>
            <button onClick={() => { setForm26File(null); setForm26Status({ state: 'idle' }) }} style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 18 }}>×</button>
          </div>
        ) : (
          <button onClick={() => form26Ref.current?.click()} style={{
            width: '100%', padding: '16px', background: C.bg, border: `2px dashed ${C.border}`,
            borderRadius: 6, cursor: 'pointer', fontSize: 13, color: C.muted, fontFamily: 'inherit',
          }}>
            Click to upload (optional)
          </button>
        )}
        <DocStatusLine status={form26Status} />
        <input ref={form26Ref} type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { setForm26File(f); processTaxDoc(f, 'form26as') } }} />
      </div>

      <style>{`@media (max-width: 480px) { .doc-actions { flex-direction: column } .doc-actions button { width: 100% } }`}</style>
      <div className="doc-actions" style={{ display: 'flex', gap: 12 }}>
        <button onClick={handleProceed} disabled={!(salaryFiles.length > 0 || aisFile || form26File || offerFile) || uploading} style={{
          flex: 1, padding: '12px', background: (salaryFiles.length > 0 || aisFile || form26File || offerFile) && !uploading ? C.primary : C.sand,
          color: (salaryFiles.length > 0 || aisFile || form26File || offerFile) && !uploading ? T.onTeal : C.faint, border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600,
          cursor: (salaryFiles.length > 0 || aisFile || form26File || offerFile) && !uploading ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
        }}>
          {uploading ? (uploadProgress || 'Parsing…') : (salaryFiles.length > 1 ? `Proceed (${salaryFiles.length} slips)` : 'Proceed')}
        </button>
        <button onClick={handleSkipToOtherIncome} style={{
          padding: '12px 20px', background: 'transparent', color: C.primary,
          border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, fontWeight: 500,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          Skip to Other earnings
        </button>
      </div>

    </div>
  )
}
