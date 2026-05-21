'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const C = { bg: '#FDFAF6', card: '#fff', border: '#E4DDD1', fg: '#1C2B22', muted: '#6B7770', primary: '#3A4B41' }

interface Tooltip {
  key: string | null
  text: string
}

export default function DeductionsPage() {
  const router = useRouter()
  const [tooltip, setTooltip] = useState<Tooltip>({ key: null, text: '' })
  const [expanded, setExpanded] = useState<string[]>(['80c'])
  const [ded, setDed] = useState({
    ppf: 0,
    elss: 0,
    lic: 0,
    tuition: 0,
    nsc: 0,
    selfFamily: 0,
    parents: 0,
    selfSenior: false,
    parentsSenior: false,
    homeLoanInterest: 0,
    nps: 0,
  })

  const tooltips: Record<string, string> = {
    ppf: 'Public Provident Fund. Invest ₹X, get ₹X tax deduction. 15-year lock-in. ₹1.5L/year limit.',
    elss: 'Equity Linked Savings Scheme. Mutual funds with tax benefits. Invest ₹X, deduct ₹X. 3-year lock-in.',
    lic: 'Life Insurance Premium from LIC or private insurers. Both provide ₹X investment = ₹X deduction.',
    tuition: 'Tuition fees paid for education of your 2 children. ₹X paid = ₹X deduction.',
    nsc: 'National Savings Certificate or Tax Saver FD. ₹X invested = ₹X deduction.',
    '80c': 'Section 80C allows deduction up to ₹1,50,000 for investments in PPF, ELSS, LIC, tuition, NSC.',
    '80d': 'Section 80D allows deduction for health insurance premiums. Self+family: ₹25k (or ₹50k if senior). Parents: ₹25k (or ₹50k if senior).',
    selfFamily: 'Health insurance premium for yourself, spouse, and children. Limit: ₹25,000 (or ₹50,000 if you/spouse is 60+).',
    parents: 'Health insurance premium for your parents. Limit: ₹25,000 (or ₹50,000 if they are 60+).',
    selfSenior: 'If you or your spouse is 60 years or older, health insurance limit increases from ₹25k to ₹50k.',
    parentsSenior: 'If your parents are 60 years or older, health insurance limit increases from ₹25k to ₹50k.',
    homeLoan: 'Interest paid on home loan for self-occupied property. Maximum deduction: ₹2,00,000 per IT Act Section 24(b).',
    nps: 'National Pension Scheme contribution under Section 80CCD(1B). Additional ₹50,000 over Section 80C limit.',
  }

  useEffect(() => {
    const saved = localStorage.getItem('av_deductions')
    if (saved) setDed(JSON.parse(saved))
  }, [])

  const saveDeductions = (updated: typeof ded) => {
    setDed(updated)
    localStorage.setItem('av_deductions', JSON.stringify(updated))
  }

  const toggle = (section: string) => {
    setExpanded(prev =>
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    )
  }

  const sec80CTotal = ded.ppf + ded.elss + ded.lic + ded.tuition + ded.nsc
  const sec80CCapped = Math.min(sec80CTotal, 150000)

  const sec80DSelfLimit = ded.selfSenior ? 50000 : 25000
  const sec80DSelf = Math.min(ded.selfFamily, sec80DSelfLimit)
  const sec80DParentsLimit = ded.parentsSenior ? 50000 : 25000
  const sec80DParents = Math.min(ded.parents, sec80DParentsLimit)
  const sec80DTotal = sec80DSelf + sec80DParents

  const homeLoanCapped = Math.min(ded.homeLoanInterest, 200000)
  const npsCapped = Math.min(ded.nps, 50000)

  const handleProceed = () => {
    const capped = {
      ...ded,
      ppf: Math.min(ded.ppf, 150000 - (ded.elss + ded.lic + ded.tuition + ded.nsc)),
      elss: Math.min(ded.elss, 150000 - (ded.ppf + ded.lic + ded.tuition + ded.nsc)),
      lic: Math.min(ded.lic, 150000 - (ded.ppf + ded.elss + ded.tuition + ded.nsc)),
      tuition: Math.min(ded.tuition, 150000 - (ded.ppf + ded.elss + ded.lic + ded.nsc)),
      nsc: Math.min(ded.nsc, 150000 - (ded.ppf + ded.elss + ded.lic + ded.tuition)),
      selfFamily: sec80DSelf,
      parents: sec80DParents,
      homeLoanInterest: homeLoanCapped,
      nps: npsCapped,
    }

    if (homeLoanCapped < ded.homeLoanInterest) {
      alert(`Home loan interest capped at ₹${homeLoanCapped.toLocaleString('en-IN')} per IT Act Section 24(b)`)
    }

    saveDeductions(capped)
    router.push('/dashboard/tax/snapshot')
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px 0' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.fg, margin: '0 0 6px' }}>Deductions</h2>
        <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Reduce your taxable income with investments and payments.</p>
      </div>

      {/* ─── SECTION 80C ─── */}
      <div
        onClick={() => toggle('80c')}
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          padding: 16,
          marginBottom: 12,
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: C.fg,
              marginBottom: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {expanded.includes('80c') ? '▼' : '▶'} Section 80C
            <span
              style={{ fontSize: 12, cursor: 'pointer', color: C.primary, fontWeight: 700 }}
              onMouseEnter={() => setTooltip({ key: '80c', text: tooltips['80c'] })}
              onMouseLeave={() => setTooltip({ key: null, text: '' })}
            >
              ⁱ
            </span>
          </div>
          <div style={{ fontSize: 12, color: C.muted }}>Max ₹1,50,000</div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.fg }}>₹{sec80CCapped.toLocaleString('en-IN')}</div>
      </div>

      {expanded.includes('80c') && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
          {/* PPF */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: C.fg,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                marginBottom: 6,
              }}
            >
              Did you invest in PPF
              <span
                style={{ fontSize: 11, cursor: 'pointer', color: C.primary }}
                onMouseEnter={() => setTooltip({ key: 'ppf', text: tooltips.ppf })}
                onMouseLeave={() => setTooltip({ key: null, text: '' })}
              >
                ⁱ
              </span>
              this year?
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: C.muted }}>₹</span>
              <input
                type="number"
                value={ded.ppf || ''}
                onChange={e => saveDeductions({ ...ded, ppf: parseFloat(e.target.value) || 0 })}
                placeholder="Amount invested"
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  fontSize: 13,
                  fontFamily: 'inherit',
                }}
              />
            </div>
          </div>

          {/* ELSS */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: C.fg,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                marginBottom: 6,
              }}
            >
              Did you buy ELSS Mutual Funds
              <span
                style={{ fontSize: 11, cursor: 'pointer', color: C.primary }}
                onMouseEnter={() => setTooltip({ key: 'elss', text: tooltips.elss })}
                onMouseLeave={() => setTooltip({ key: null, text: '' })}
              >
                ⁱ
              </span>
              ?
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: C.muted }}>₹</span>
              <input
                type="number"
                value={ded.elss || ''}
                onChange={e => saveDeductions({ ...ded, elss: parseFloat(e.target.value) || 0 })}
                placeholder="Amount invested"
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  fontSize: 13,
                  fontFamily: 'inherit',
                }}
              />
            </div>
          </div>

          {/* LIC */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: C.fg,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                marginBottom: 6,
              }}
            >
              Did you pay Life Insurance Premium
              <span
                style={{ fontSize: 11, cursor: 'pointer', color: C.primary }}
                onMouseEnter={() => setTooltip({ key: 'lic', text: tooltips.lic })}
                onMouseLeave={() => setTooltip({ key: null, text: '' })}
              >
                ⁱ
              </span>
              ?
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: C.muted }}>₹</span>
              <input
                type="number"
                value={ded.lic || ''}
                onChange={e => saveDeductions({ ...ded, lic: parseFloat(e.target.value) || 0 })}
                placeholder="Amount paid"
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  fontSize: 13,
                  fontFamily: 'inherit',
                }}
              />
            </div>
          </div>

          {/* Tuition */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: C.fg,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                marginBottom: 6,
              }}
            >
              Did you pay Tuition Fees for your children
              <span
                style={{ fontSize: 11, cursor: 'pointer', color: C.primary }}
                onMouseEnter={() => setTooltip({ key: 'tuition', text: tooltips.tuition })}
                onMouseLeave={() => setTooltip({ key: null, text: '' })}
              >
                ⁱ
              </span>
              ?
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: C.muted }}>₹</span>
              <input
                type="number"
                value={ded.tuition || ''}
                onChange={e => saveDeductions({ ...ded, tuition: parseFloat(e.target.value) || 0 })}
                placeholder="Amount paid"
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  fontSize: 13,
                  fontFamily: 'inherit',
                }}
              />
            </div>
          </div>

          {/* NSC */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: C.fg,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                marginBottom: 6,
              }}
            >
              Did you invest in NSC or Tax Saver FD
              <span
                style={{ fontSize: 11, cursor: 'pointer', color: C.primary }}
                onMouseEnter={() => setTooltip({ key: 'nsc', text: tooltips.nsc })}
                onMouseLeave={() => setTooltip({ key: null, text: '' })}
              >
                ⁱ
              </span>
              ?
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: C.muted }}>₹</span>
              <input
                type="number"
                value={ded.nsc || ''}
                onChange={e => saveDeductions({ ...ded, nsc: parseFloat(e.target.value) || 0 })}
                placeholder="Amount invested"
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  fontSize: 13,
                  fontFamily: 'inherit',
                }}
              />
            </div>
          </div>

          <div style={{ fontSize: 11, color: C.muted, background: '#FEF9F0', padding: 8, borderRadius: 4, marginTop: 12 }}>
            ⚠ Total capped at ₹1,50,000. Current: ₹{sec80CTotal.toLocaleString('en-IN')}
          </div>
        </div>
      )}

      {/* ─── SECTION 80D ─── */}
      <div
        onClick={() => toggle('80d')}
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          padding: 16,
          marginBottom: 12,
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: C.fg,
              marginBottom: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {expanded.includes('80d') ? '▼' : '▶'} Section 80D
            <span
              style={{ fontSize: 12, cursor: 'pointer', color: C.primary, fontWeight: 700 }}
              onMouseEnter={() => setTooltip({ key: '80d', text: tooltips['80d'] })}
              onMouseLeave={() => setTooltip({ key: null, text: '' })}
            >
              ⁱ
            </span>
          </div>
          <div style={{ fontSize: 12, color: C.muted }}>Health Insurance</div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.fg }}>₹{sec80DTotal.toLocaleString('en-IN')}</div>
      </div>

      {expanded.includes('80d') && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <label
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: C.fg,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginBottom: 6,
            }}
          >
            Do you have health insurance for Self + Family
            <span
              style={{ fontSize: 11, cursor: 'pointer', color: C.primary }}
              onMouseEnter={() => setTooltip({ key: 'selfFamily', text: tooltips.selfFamily })}
              onMouseLeave={() => setTooltip({ key: null, text: '' })}
            >
              ⁱ
            </span>
            ?
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: C.muted }}>₹</span>
            <input
              type="number"
              value={ded.selfFamily || ''}
              onChange={e => saveDeductions({ ...ded, selfFamily: parseFloat(e.target.value) || 0 })}
              placeholder="Premium amount"
              style={{
                flex: 1,
                padding: '8px 12px',
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                fontSize: 13,
                fontFamily: 'inherit',
              }}
            />
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              color: C.fg,
              marginBottom: 16,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={ded.selfSenior}
              onChange={e => saveDeductions({ ...ded, selfSenior: e.target.checked })}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              Are you or your spouse 60+ years old
              <span
                style={{ fontSize: 11, cursor: 'pointer', color: C.primary }}
                onMouseEnter={() => setTooltip({ key: 'selfSenior', text: tooltips.selfSenior })}
                onMouseLeave={() => setTooltip({ key: null, text: '' })}
              >
                ⁱ
              </span>
              ?
            </span>
          </label>

          <label
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: C.fg,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginBottom: 6,
              marginTop: 16,
            }}
          >
            Do you have health insurance for your Parents
            <span
              style={{ fontSize: 11, cursor: 'pointer', color: C.primary }}
              onMouseEnter={() => setTooltip({ key: 'parents', text: tooltips.parents })}
              onMouseLeave={() => setTooltip({ key: null, text: '' })}
            >
              ⁱ
            </span>
            ?
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: C.muted }}>₹</span>
            <input
              type="number"
              value={ded.parents || ''}
              onChange={e => saveDeductions({ ...ded, parents: parseFloat(e.target.value) || 0 })}
              placeholder="Premium amount"
              style={{
                flex: 1,
                padding: '8px 12px',
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                fontSize: 13,
                fontFamily: 'inherit',
              }}
            />
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              color: C.fg,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={ded.parentsSenior}
              onChange={e => saveDeductions({ ...ded, parentsSenior: e.target.checked })}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              Are your parents 60+ years old
              <span
                style={{ fontSize: 11, cursor: 'pointer', color: C.primary }}
                onMouseEnter={() => setTooltip({ key: 'parentsSenior', text: tooltips.parentsSenior })}
                onMouseLeave={() => setTooltip({ key: null, text: '' })}
              >
                ⁱ
              </span>
              ?
            </span>
          </label>
        </div>
      )}

      {/* ─── HOME LOAN INTEREST ─── */}
      <div
        onClick={() => toggle('homeLoan')}
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          padding: 16,
          marginBottom: 12,
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: C.fg,
              marginBottom: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {expanded.includes('homeLoan') ? '▼' : '▶'} Home Loan Interest
            <span
              style={{ fontSize: 12, cursor: 'pointer', color: C.primary, fontWeight: 700 }}
              onMouseEnter={() => setTooltip({ key: 'homeLoan', text: tooltips.homeLoan })}
              onMouseLeave={() => setTooltip({ key: null, text: '' })}
            >
              ⁱ
            </span>
          </div>
          <div style={{ fontSize: 12, color: C.muted }}>Section 24(b)</div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.fg }}>₹{homeLoanCapped.toLocaleString('en-IN')}</div>
      </div>

      {expanded.includes('homeLoan') && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <label
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: C.fg,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginBottom: 6,
            }}
          >
            How much home loan interest did you pay
            <span
              style={{ fontSize: 11, cursor: 'pointer', color: C.primary }}
              onMouseEnter={() => setTooltip({ key: 'homeLoan', text: tooltips.homeLoan })}
              onMouseLeave={() => setTooltip({ key: null, text: '' })}
            >
              ⁱ
            </span>
            ?
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: C.muted }}>₹</span>
            <input
              type="number"
              value={ded.homeLoanInterest || ''}
              onChange={e => saveDeductions({ ...ded, homeLoanInterest: parseFloat(e.target.value) || 0 })}
              placeholder="Annual interest paid"
              style={{
                flex: 1,
                padding: '8px 12px',
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                fontSize: 13,
                fontFamily: 'inherit',
              }}
            />
          </div>
          <div style={{ fontSize: 11, color: C.muted, background: '#FEF9F0', padding: 8, borderRadius: 4, marginTop: 12 }}>
            ⚠ Max deduction: ₹2,00,000 for self-occupied property
          </div>
        </div>
      )}

      {/* ─── NPS ─── */}
      <div
        onClick={() => toggle('nps')}
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          padding: 16,
          marginBottom: 12,
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: C.fg,
              marginBottom: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {expanded.includes('nps') ? '▼' : '▶'} NPS
            <span
              style={{ fontSize: 12, cursor: 'pointer', color: C.primary, fontWeight: 700 }}
              onMouseEnter={() => setTooltip({ key: 'nps', text: tooltips.nps })}
              onMouseLeave={() => setTooltip({ key: null, text: '' })}
            >
              ⁱ
            </span>
          </div>
          <div style={{ fontSize: 12, color: C.muted }}>Section 80CCD(1B)</div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.fg }}>₹{npsCapped.toLocaleString('en-IN')}</div>
      </div>

      {expanded.includes('nps') && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <label
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: C.fg,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginBottom: 6,
            }}
          >
            Did you contribute to NPS
            <span
              style={{ fontSize: 11, cursor: 'pointer', color: C.primary }}
              onMouseEnter={() => setTooltip({ key: 'nps', text: tooltips.nps })}
              onMouseLeave={() => setTooltip({ key: null, text: '' })}
            >
              ⁱ
            </span>
            ?
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: C.muted }}>₹</span>
            <input
              type="number"
              value={ded.nps || ''}
              onChange={e => saveDeductions({ ...ded, nps: parseFloat(e.target.value) || 0 })}
              placeholder="Amount contributed"
              style={{
                flex: 1,
                padding: '8px 12px',
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                fontSize: 13,
                fontFamily: 'inherit',
              }}
            />
          </div>
          <div style={{ fontSize: 11, color: C.muted, background: '#FEF9F0', padding: 8, borderRadius: 4, marginTop: 12 }}>
            ℹ Additional ₹50,000 over Section 80C limit. Total 80C + NPS = ₹2,00,000 max.
          </div>
        </div>
      )}

      {/* Tooltip */}
      {tooltip.key && (
        <div
          style={{
            position: 'fixed',
            bottom: 20,
            left: 20,
            right: 20,
            background: C.fg,
            color: '#fff',
            padding: 12,
            borderRadius: 6,
            fontSize: 12,
            zIndex: 50,
          }}
        >
          {tooltip.text}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        <button
          onClick={() => router.back()}
          style={{
            padding: '12px 20px',
            background: 'transparent',
            color: C.primary,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          ← Back
        </button>
        <button
          onClick={handleProceed}
          style={{
            flex: 1,
            padding: '12px',
            background: C.primary,
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Next: Tax Optimizer →
        </button>
      </div>
    </div>
  )
}
