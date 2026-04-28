import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const CAS_API_URL = 'https://api.casparser.in/v4/smart/parse'
const CAS_API_KEY = process.env.CASPARSER_API_KEY || ''

export async function POST(req: NextRequest) {
  try {
    if (!CAS_API_KEY) {
      return NextResponse.json({ error: 'CASParser API key not configured' }, { status: 500 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const password = formData.get('password') as string || ''

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 15MB)' }, { status: 400 })
    }

    // Build form data for CASParser API
    const casForm = new FormData()
    casForm.append('file', file)
    if (password) casForm.append('password', password)

    const res = await fetch(CAS_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': CAS_API_KEY,
      },
      body: casForm,
    })

    const json = await res.json()

    if (!res.ok) {
      const errMsg = json?.message || json?.error || 'CASParser failed'
      const errLower = errMsg.toLowerCase()
      if (errLower.includes('password') || errLower.includes('decrypt') || errLower.includes('encrypted')) {
        return NextResponse.json({ error: 'incorrect_password', message: 'Incorrect password. CAS password is usually your PAN in CAPS (e.g. ABCDE1234F).' }, { status: 422 })
      }
      return NextResponse.json({ error: 'parse_failed', message: errMsg }, { status: 500 })
    }

    // Extract key data from CASParser response
    const data = json.data || json

    // Build simplified holdings for frontend
    const holdings: any[] = []
    let totalEquityValue = 0
    let totalMFValue = 0
    let totalBondValue = 0
    let totalOtherValue = 0

    // Demat accounts (equities, bonds, G-secs)
    const dematAccounts = data.demat_accounts || data.dematAccounts || []
    dematAccounts.forEach((account: any) => {
      const dpName = account.dp_name || account.dpName || ''
      const dpId = account.dp_id || account.dpId || ''

      // Equities
      const equities = account.equities || []
      equities.forEach((eq: any) => {
        const val = eq.value || eq.current_value || 0
        totalEquityValue += val
        holdings.push({
          type: 'equity',
          name: eq.name || eq.company_name || 'Unknown',
          isin: eq.isin || '',
          units: eq.units || eq.quantity || 0,
          value: val,
          dpName,
        })
      })

      // Bonds
      const bonds = account.corporate_bonds || account.bonds || []
      bonds.forEach((bond: any) => {
        const val = bond.value || bond.face_value || 0
        totalBondValue += val
        holdings.push({
          type: 'bond',
          name: bond.name || 'Bond',
          isin: bond.isin || '',
          units: bond.units || 0,
          value: val,
        })
      })

      // Government securities
      const gsecs = account.government_securities || account.gsecs || []
      gsecs.forEach((gs: any) => {
        const val = gs.value || gs.face_value || 0
        totalBondValue += val
        holdings.push({
          type: 'gsec',
          name: gs.name || 'G-Sec',
          isin: gs.isin || '',
          units: gs.units || 0,
          value: val,
        })
      })
    })

    // Mutual fund folios
    const mfFolios = data.mutual_fund_folios || data.mutualFundFolios || data.folios || []
    mfFolios.forEach((folio: any) => {
      const amc = folio.amc || folio.fund_house || ''
      const folioNumber = folio.folio_number || folio.folioNumber || ''
      const schemes = folio.schemes || folio.mutual_funds || []
      schemes.forEach((scheme: any) => {
        const val = scheme.value || scheme.current_value || scheme.valuation?.value || 0
        totalMFValue += val
        holdings.push({
          type: 'mutual_fund',
          name: scheme.name || scheme.scheme_name || 'MF Scheme',
          isin: scheme.isin || '',
          units: scheme.units || scheme.balance_units || 0,
          value: val,
          amc,
          folioNumber,
          nav: scheme.nav || scheme.latest_nav || 0,
        })
      })
    })

    // Insurance, NPS, etc.
    const insurance = data.life_insurance || data.insurance || []
    insurance.forEach((pol: any) => {
      const val = pol.value || pol.sum_assured || 0
      totalOtherValue += val
      holdings.push({
        type: 'insurance',
        name: pol.name || pol.policy_name || 'Insurance',
        value: val,
      })
    })

    const nps = data.nps || []
    nps.forEach((acc: any) => {
      const val = acc.value || acc.total_value || 0
      totalOtherValue += val
      holdings.push({
        type: 'nps',
        name: acc.name || 'NPS',
        value: val,
      })
    })

    // Investor info
    const investor = data.investor || data.investor_info || {}

    // Summary
    const summary = {
      totalValue: totalEquityValue + totalMFValue + totalBondValue + totalOtherValue,
      equityValue: totalEquityValue,
      mfValue: totalMFValue,
      bondValue: totalBondValue,
      otherValue: totalOtherValue,
      equityCount: holdings.filter(h => h.type === 'equity').length,
      mfCount: holdings.filter(h => h.type === 'mutual_fund').length,
      bondCount: holdings.filter(h => h.type === 'bond' || h.type === 'gsec').length,
      otherCount: holdings.filter(h => h.type === 'insurance' || h.type === 'nps').length,
    }

    const period = data.statement_period || data.meta?.statement_period || {}

    return NextResponse.json({
      success: true,
      data: {
        investor: {
          name: investor.name || '',
          pan: investor.pan || '',
          email: investor.email || '',
        },
        period: {
          from: period.from || '',
          to: period.to || '',
        },
        summary,
        holdings,
        uploadedAt: new Date().toISOString(),
      }
    })
  } catch (error: any) {
    console.error('CAS parse error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to parse CAS statement' },
      { status: 500 }
    )
  }
}
