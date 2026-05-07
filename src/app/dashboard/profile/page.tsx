'use client'

// =============================================================================
// ArthVo — Review Tab (Profile page)
// =============================================================================
//
// CONTRACT WITH THE INTELLIGENCE ENGINE (txn-intelligence.ts):
//
// This file READS from `api.intelligence` (IntelligenceReport). It does NOT
// re-classify, does NOT keyword-match narrations, does NOT guess relationships.
// If a classification looks wrong, the fix goes in txn-intelligence.ts, NOT
// here. This file is presentation only.
//
// What we get from the engine:
//   intelligence.transactions[]  — every txn classified, single category
//   intelligence.pnl             — totals + by_category aggregates
//   intelligence.persons[]       — pre-grouped person ledgers, sorted by count
//   intelligence.channels[]      — channel summary
//   intelligence.questions[]     — pre-built questions per person (we DO NOT
//                                  render these as cards — Mistake #4)
//   intelligence.discoveries[]   — info strings for the top strip
//
// LOCKED PRINCIPLES THIS COMPONENT ENFORCES:
//   1. Never guess relationships → unclassified P2P stays in Transfer to
//      Persons until user classifies. Person name is shown verbatim, no
//      "domestic help" / "spouse" / "vendor" labels invented anywhere.
//   2. One P&L category per transaction → P&L columns show pnl.by_category
//      directly. Person ledgers are a TAG view, not a second P&L bucket.
//   3. Transfer to Persons = expandable person-grouped ledger. Significant
//      persons get full ledgers at top. One-offs go in a compact list at
//      bottom. Never question cards. Never 30 separate prompts.
//   4. Purpose > Person → if engine says a Nikita txn is "Food/Groceries"
//      because the note said GROCERY EXPENSE, we render it as Groceries in
//      her ledger Nature column too. We do NOT recategorize.
//   5. Self Transfer is auto-handled by the engine. We never show it as a
//      question, never put it in Transfer to Persons.
//   6. Masked accounts → engine puts them in `Transfer to Account` category.
//      We render them in a separate section, not mixed with persons.
//   7. Credits with clarity:'ask_user' get INCOME options (Salary, Freelance,
//      Investment Return, Business Income), never expense options. Debits
//      get expense options.
//
// SIGNIFICANCE RULE (the only piece of UI logic this file owns):
//   A person is "significant" if total volume (debit+credit) ≥ ₹10,000
//   OR transaction count ≥ 3. Significant → full expandable ledger at top.
//   Otherwise → one compact row at bottom. This is purely a display choice;
//   the data is the same.
//
// =============================================================================

import { useMemo, useState } from 'react'
import type {
  IntelligenceReport,
  ClassifiedTransaction,
  PersonLedger,
} from '@/lib/txn-intelligence'

// -----------------------------------------------------------------------------
// API response shape (matches route.ts)
// -----------------------------------------------------------------------------

interface ApiResponse {
  data: any
  pipeline: any | null
  intelligence: IntelligenceReport | null
  fileKind: string
  parsedLocally: boolean
}

// -----------------------------------------------------------------------------
// Local reclassification overlay
//
// User reclassifications live in component state, keyed by the txn's `raw`
// narration string (engine doesn't expose a stable id, but raw narration is
// unique per row in practice). When the user reclassifies, we don't mutate
// the engine output — we just remember the override and apply it in renders.
// A future save endpoint can read this map and POST it; until then it's
// session-local.
// -----------------------------------------------------------------------------

interface Override {
  category: string
  subcategory: string
  is_pnl: boolean
}
type Overrides = Map<string, Override>

function applyOverride(t: ClassifiedTransaction, overrides: Overrides): ClassifiedTransaction {
  const o = overrides.get(t.raw)
  if (!o) return t
  return { ...t, category: o.category, subcategory: o.subcategory, is_pnl: o.is_pnl, clarity: 'certain' }
}

// -----------------------------------------------------------------------------
// Significance
// -----------------------------------------------------------------------------

const SIGNIFICANCE_AMOUNT = 10_000
const SIGNIFICANCE_COUNT = 3

function isSignificant(p: PersonLedger): boolean {
  const volume = p.total_debit + p.total_credit
  return volume >= SIGNIFICANCE_AMOUNT || p.count >= SIGNIFICANCE_COUNT
}

// -----------------------------------------------------------------------------
// Reclassification options
//
// Driven by direction. NEVER show expense options for a credit (Mistake #4).
// -----------------------------------------------------------------------------

const EXPENSE_OPTIONS: Array<{ category: string; subcategory: string; is_pnl: boolean }> = [
  { category: 'Food & Dining', subcategory: 'Groceries', is_pnl: true },
  { category: 'Food & Dining', subcategory: 'Restaurant', is_pnl: true },
  { category: 'Food & Dining', subcategory: 'Delivery', is_pnl: true },
  { category: 'Transport', subcategory: 'Cab', is_pnl: true },
  { category: 'Transport', subcategory: 'Fuel', is_pnl: true },
  { category: 'Transport', subcategory: 'Metro', is_pnl: true },
  { category: 'Health', subcategory: 'Pharmacy', is_pnl: true },
  { category: 'Health', subcategory: 'Medical', is_pnl: true },
  { category: 'Housing', subcategory: 'Rent', is_pnl: true },
  { category: 'Utilities', subcategory: 'Electricity', is_pnl: true },
  { category: 'Utilities', subcategory: 'Telecom', is_pnl: true },
  { category: 'Shopping', subcategory: 'General', is_pnl: true },
  { category: 'Household', subcategory: 'Expense', is_pnl: true },
  { category: 'Credit Card', subcategory: 'Bill Payment', is_pnl: false },
  { category: 'Investment', subcategory: 'SIP/Mutual Fund', is_pnl: false },
  { category: 'Self Transfer', subcategory: '', is_pnl: false },
]

const INCOME_OPTIONS: Array<{ category: string; subcategory: string; is_pnl: boolean }> = [
  { category: 'Income', subcategory: 'Salary', is_pnl: true },
  { category: 'Income', subcategory: 'Freelance', is_pnl: true },
  { category: 'Income', subcategory: 'Business Income', is_pnl: true },
  { category: 'Income', subcategory: 'Investment Return', is_pnl: true },
  { category: 'Income', subcategory: 'Interest', is_pnl: true },
  { category: 'Income', subcategory: 'Refund', is_pnl: false },
  { category: 'Income', subcategory: 'Gift', is_pnl: true },
  { category: 'Self Transfer', subcategory: '', is_pnl: false },
]

function optionsFor(direction: 'debit' | 'credit') {
  return direction === 'credit' ? INCOME_OPTIONS : EXPENSE_OPTIONS
}

// -----------------------------------------------------------------------------
// Formatting
// -----------------------------------------------------------------------------

function fmtINR(n: number): string {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function fmtDate(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

// Nature column for the person ledger:
//   - if engine assigned a real P&L category (purpose-noted txn) → show
//     that ("Groceries", "Metro", etc.)
//   - if it's still in the holding category → show the channel
function natureOf(t: ClassifiedTransaction): string {
  if (t.category === 'Transfer to Persons') return t.channel || 'Transfer'
  return t.subcategory || t.category
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function ReviewTab({ api }: { api: ApiResponse }) {
  const [overrides, setOverrides] = useState<Overrides>(new Map())
  const [expandedPersons, setExpandedPersons] = useState<Set<string>>(new Set())
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [reclassifyTarget, setReclassifyTarget] = useState<string | null>(null) // raw narration

  if (!api.intelligence) {
    return (
      <div className="p-8 text-center text-gray-500">
        Intelligence report not available. Statement may not have parsed correctly.
      </div>
    )
  }

  const intel = api.intelligence

  // Apply user overrides on top of engine output
  const txns = useMemo(
    () => intel.transactions.map(t => applyOverride(t, overrides)),
    [intel.transactions, overrides],
  )

  // Recompute P&L from overridden txns (so user reclassifications flow into totals)
  const pnl = useMemo(() => {
    const by: Record<string, { income: number; expense: number; count: number; subcats: Record<string, { income: number; expense: number; count: number }> }> = {}
    let totalIncome = 0
    let totalExpense = 0
    let totalExcluded = 0
    for (const t of txns) {
      const sub = t.subcategory || '(uncategorized)'
      if (!by[t.category]) by[t.category] = { income: 0, expense: 0, count: 0, subcats: {} }
      if (!by[t.category].subcats[sub]) by[t.category].subcats[sub] = { income: 0, expense: 0, count: 0 }
      by[t.category].count++
      by[t.category].subcats[sub].count++
      if (!t.is_pnl) {
        totalExcluded += t.amount
        continue
      }
      if (t.direction === 'credit') {
        by[t.category].income += t.amount
        by[t.category].subcats[sub].income += t.amount
        totalIncome += t.amount
      } else {
        by[t.category].expense += t.amount
        by[t.category].subcats[sub].expense += t.amount
        totalExpense += t.amount
      }
    }
    return { totalIncome, totalExpense, totalExcluded, by }
  }, [txns])

  // ---- Bucket categories into the three columns ----
  const incomeCategories: string[] = []
  const expenseCategories: string[] = []
  const excludedCategories: string[] = [] // savings & investments + transfers + cc payments
  const holdingPersonCategory = 'Transfer to Persons'
  const holdingAccountCategory = 'Transfer to Account'

  for (const cat of Object.keys(pnl.by)) {
    const entry = pnl.by[cat]
    if (cat === holdingPersonCategory) continue // rendered separately
    if (cat === holdingAccountCategory) continue // rendered separately
    if (cat === 'Income') {
      incomeCategories.push(cat)
    } else if (
      cat === 'Self Transfer' ||
      cat === 'Credit Card' ||
      cat === 'Investment' ||
      (cat === 'Refund')
    ) {
      excludedCategories.push(cat)
    } else if (entry.income > 0 && entry.expense === 0) {
      incomeCategories.push(cat)
    } else {
      expenseCategories.push(cat)
    }
  }

  // ---- Rebuild person ledgers from current txn view (so overrides flow in) ----
  const personMap = new Map<string, ClassifiedTransaction[]>()
  for (const t of txns) {
    const personTag = t.tags.find(tag => tag.startsWith('person:'))
    if (!personTag) continue
    const name = personTag.substring('person:'.length)
    if (!name) continue
    if (!personMap.has(name)) personMap.set(name, [])
    personMap.get(name)!.push(t)
  }
  const personLedgers: PersonLedger[] = Array.from(personMap.entries()).map(([name, ts]) => {
    const totalDebit = ts.filter(t => t.direction === 'debit').reduce((s, t) => s + t.amount, 0)
    const totalCredit = ts.filter(t => t.direction === 'credit').reduce((s, t) => s + t.amount, 0)
    const unclassified = ts.filter(t => t.category === holdingPersonCategory).length
    return {
      name,
      transactions: ts,
      total_debit: totalDebit,
      total_credit: totalCredit,
      net: totalCredit - totalDebit,
      count: ts.length,
      classified_count: ts.length - unclassified,
      unclassified_count: unclassified,
    }
  })

  // Persons with at least one unclassified txn — these are the ones the user
  // needs to act on. Persons whose txns are all already classified (e.g. all
  // of Nikita's purpose-noted txns) don't need to appear in this section.
  const personsNeedingAttention = personLedgers
    .filter(p => p.unclassified_count > 0)
    .sort((a, b) => {
      // Significant first, by volume
      const aSig = isSignificant(a)
      const bSig = isSignificant(b)
      if (aSig !== bSig) return aSig ? -1 : 1
      return (b.total_debit + b.total_credit) - (a.total_debit + a.total_credit)
    })

  const significantPersons = personsNeedingAttention.filter(isSignificant)
  const compactPersons = personsNeedingAttention.filter(p => !isSignificant(p))

  // Masked-account transfers (separate section)
  const maskedAccountTxns = txns.filter(t => t.category === holdingAccountCategory)

  // Large company credits flagged ask_user (Neblio etc.) — credit-aware income confirmation
  const unconfirmedIncome = txns.filter(
    t => t.direction === 'credit' && t.clarity === 'ask_user' && t.category === 'Income',
  )

  // ---- Handlers ----
  const togglePerson = (name: string) => {
    setExpandedPersons(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name); else next.add(name)
      return next
    })
  }

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat); else next.add(cat)
      return next
    })
  }

  const reclassify = (rawKey: string, opt: Override) => {
    setOverrides(prev => {
      const next = new Map(prev)
      next.set(rawKey, opt)
      return next
    })
    setReclassifyTarget(null)
  }

  const reclassifyPerson = (personName: string, opt: Override) => {
    // Bulk: apply override to all of this person's currently-unclassified txns
    setOverrides(prev => {
      const next = new Map(prev)
      const person = personLedgers.find(p => p.name === personName)
      if (!person) return prev
      for (const t of person.transactions) {
        if (t.category === holdingPersonCategory) {
          next.set(t.raw, opt)
        }
      }
      return next
    })
  }

  // -----------------------------------------------------------------
  // RENDER
  // -----------------------------------------------------------------
  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Discoveries strip */}
      {intel.discoveries.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">What we found</div>
          <ul className="space-y-1 text-sm text-gray-700">
            {intel.discoveries.map((d, i) => (
              <li key={i}>• {d}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Headline P&L */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard label="Income" value={pnl.totalIncome} tone="positive" />
        <SummaryCard label="Expenses" value={pnl.totalExpense} tone="negative" />
        <SummaryCard label="Net" value={pnl.totalIncome - pnl.totalExpense} tone="neutral" />
      </div>

      {/* Three-column P&L */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <PnLColumn
          title="Income"
          categories={incomeCategories}
          pnl={pnl}
          txns={txns}
          expanded={expandedCategories}
          onToggle={toggleCategory}
          showAs="income"
        />
        <PnLColumn
          title="Expense"
          categories={expenseCategories}
          pnl={pnl}
          txns={txns}
          expanded={expandedCategories}
          onToggle={toggleCategory}
          showAs="expense"
        />
        <PnLColumn
          title="Savings & Investments"
          categories={excludedCategories}
          pnl={pnl}
          txns={txns}
          expanded={expandedCategories}
          onToggle={toggleCategory}
          showAs="excluded"
        />
      </div>

      {/* Unconfirmed income (credit-aware: Neblio etc.) */}
      {unconfirmedIncome.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-900 mb-3">
            Income to confirm ({unconfirmedIncome.length})
          </h2>
          <p className="text-xs text-amber-800 mb-4">
            Large credits from companies. Tell us what type of income these are — the engine
            doesn't guess between salary, freelance, or investment return.
          </p>
          <div className="space-y-2">
            {unconfirmedIncome.map(t => (
              <UnconfirmedIncomeRow
                key={t.raw}
                txn={t}
                onReclassify={opt => reclassify(t.raw, opt)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Transfer to Persons — expandable ledgers */}
      {personsNeedingAttention.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-1">Transfer to Persons</h2>
          <p className="text-sm text-gray-600 mb-4">
            Person-to-person payments without a stated purpose. Classify these to move them
            into your P&L. Already-classified payments (e.g. with "GROCERY EXPENSE" notes)
            are tagged to the person but counted in their proper category.
          </p>

          {/* Significant persons — full ledger */}
          {significantPersons.length > 0 && (
            <div className="space-y-3">
              {significantPersons.map(p => (
                <PersonLedgerCard
                  key={p.name}
                  person={p}
                  isExpanded={expandedPersons.has(p.name)}
                  onToggle={() => togglePerson(p.name)}
                  onReclassifyTxn={(raw, opt) => reclassify(raw, opt)}
                  onReclassifyAll={opt => reclassifyPerson(p.name, opt)}
                  reclassifyTarget={reclassifyTarget}
                  setReclassifyTarget={setReclassifyTarget}
                />
              ))}
            </div>
          )}

          {/* Compact persons — one-liners */}
          {compactPersons.length > 0 && (
            <div className="mt-6">
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">
                Small one-off transfers ({compactPersons.length})
              </div>
              <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
                {compactPersons.map(p => {
                  // Compact: one row per person showing total. Click expands.
                  const isExpanded = expandedPersons.has(p.name)
                  return (
                    <div key={p.name}>
                      <button
                        onClick={() => togglePerson(p.name)}
                        className="w-full px-4 py-2 flex items-center justify-between text-sm hover:bg-gray-50 text-left"
                      >
                        <span className="text-gray-700">{p.name}</span>
                        <span className="flex items-center gap-3 text-gray-500">
                          <span>{p.count} txn{p.count > 1 ? 's' : ''}</span>
                          <span className="font-medium text-gray-900">
                            {fmtINR(p.total_debit + p.total_credit)}
                          </span>
                          <span className="text-gray-400">{isExpanded ? '−' : '+'}</span>
                        </span>
                      </button>
                      {isExpanded && (
                        <div className="px-4 pb-3 bg-gray-50">
                          <PersonTxnTable
                            txns={p.transactions}
                            onReclassifyTxn={(raw, opt) => reclassify(raw, opt)}
                            reclassifyTarget={reclassifyTarget}
                            setReclassifyTarget={setReclassifyTarget}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Transfer to Bank Account — masked accounts */}
      {maskedAccountTxns.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-1">Transfer to Bank Account</h2>
          <p className="text-sm text-gray-600 mb-4">
            Transfers to accounts where only the masked number is shown. These could be
            your own accounts (mark as Self Transfer) or someone else's.
          </p>
          <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
            {maskedAccountTxns.map(t => (
              <div key={t.raw} className="px-4 py-3 flex items-center justify-between text-sm">
                <div>
                  <div className="font-mono text-gray-900">{t.who || t.subcategory}</div>
                  <div className="text-xs text-gray-500">{fmtDate(t.date)} · {t.channel}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={t.direction === 'debit' ? 'text-red-600' : 'text-green-600'}>
                    {t.direction === 'debit' ? '−' : '+'}{fmtINR(t.amount)}
                  </span>
                  <ReclassifyButton
                    txn={t}
                    onPick={opt => reclassify(t.raw, opt)}
                    isOpen={reclassifyTarget === t.raw}
                    onOpen={() => setReclassifyTarget(t.raw)}
                    onClose={() => setReclassifyTarget(null)}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Channel breakdown — informational footer */}
      {intel.channels.length > 0 && (
        <section className="border-t border-gray-200 pt-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">By channel</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {intel.channels.map(c => (
              <div key={c.channel} className="rounded border border-gray-200 p-3 text-sm">
                <div className="font-medium text-gray-900">{c.channel}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {c.debit_count + c.credit_count} txns
                </div>
                <div className="text-xs text-gray-700 mt-1">
                  Out: {fmtINR(c.total_debit)} · In: {fmtINR(c.total_credit)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: 'positive' | 'negative' | 'neutral' }) {
  const colorClass =
    tone === 'positive' ? 'text-green-700' :
    tone === 'negative' ? 'text-red-700' :
    value >= 0 ? 'text-green-700' : 'text-red-700'
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${colorClass}`}>{fmtINR(value)}</div>
    </div>
  )
}

function PnLColumn({
  title, categories, pnl, txns, expanded, onToggle, showAs,
}: {
  title: string
  categories: string[]
  pnl: { by: Record<string, { income: number; expense: number; count: number; subcats: Record<string, { income: number; expense: number; count: number }> }> }
  txns: ClassifiedTransaction[]
  expanded: Set<string>
  onToggle: (cat: string) => void
  showAs: 'income' | 'expense' | 'excluded'
}) {
  if (categories.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 p-4">
        <h3 className="font-semibold text-sm text-gray-900 mb-2">{title}</h3>
        <div className="text-xs text-gray-500">Nothing here.</div>
      </div>
    )
  }

  // Sort categories by relevant amount DESC
  const sortedCats = [...categories].sort((a, b) => {
    const aVal = showAs === 'income' ? pnl.by[a].income : showAs === 'expense' ? pnl.by[a].expense : (pnl.by[a].income + pnl.by[a].expense)
    const bVal = showAs === 'income' ? pnl.by[b].income : showAs === 'expense' ? pnl.by[b].expense : (pnl.by[b].income + pnl.by[b].expense)
    return bVal - aVal
  })

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <h3 className="font-semibold text-sm text-gray-900 mb-3">{title}</h3>
      <div className="space-y-1">
        {sortedCats.map(cat => {
          const entry = pnl.by[cat]
          const value = showAs === 'income' ? entry.income : showAs === 'expense' ? entry.expense : (entry.income + entry.expense)
          const isOpen = expanded.has(cat)
          const catTxns = txns.filter(t => t.category === cat)
          return (
            <div key={cat}>
              <button
                onClick={() => onToggle(cat)}
                className="w-full flex items-center justify-between py-1.5 text-sm hover:bg-gray-50 rounded px-2 -mx-2 text-left"
              >
                <span className="flex items-center gap-2">
                  <span className="text-gray-400 text-xs w-3">{isOpen ? '▾' : '▸'}</span>
                  <span className="text-gray-900">{cat}</span>
                  <span className="text-xs text-gray-400">({entry.count})</span>
                </span>
                <span className="font-medium text-gray-900">{fmtINR(value)}</span>
              </button>
              {isOpen && (
                <div className="ml-5 mt-1 space-y-0.5">
                  {Object.entries(entry.subcats).map(([sub, s]) => {
                    const subVal = showAs === 'income' ? s.income : showAs === 'expense' ? s.expense : (s.income + s.expense)
                    return (
                      <div key={sub} className="flex justify-between text-xs text-gray-600 py-0.5">
                        <span>{sub} <span className="text-gray-400">({s.count})</span></span>
                        <span>{fmtINR(subVal)}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PersonLedgerCard({
  person, isExpanded, onToggle, onReclassifyTxn, onReclassifyAll, reclassifyTarget, setReclassifyTarget,
}: {
  person: PersonLedger
  isExpanded: boolean
  onToggle: () => void
  onReclassifyTxn: (raw: string, opt: Override) => void
  onReclassifyAll: (opt: Override) => void
  reclassifyTarget: string | null
  setReclassifyTarget: (raw: string | null) => void
}) {
  const bulkKey = `bulk:${person.name}`
  const bulkOpen = reclassifyTarget === bulkKey
  // Direction for bulk reclassify defaults to majority direction of unclassified
  const unclassified = person.transactions.filter(t => t.category === 'Transfer to Persons')
  const debitCount = unclassified.filter(t => t.direction === 'debit').length
  const creditCount = unclassified.filter(t => t.direction === 'credit').length
  const bulkDirection: 'debit' | 'credit' = creditCount > debitCount ? 'credit' : 'debit'

  return (
    <div className="rounded-lg border border-gray-200">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-sm w-3">{isExpanded ? '−' : '+'}</span>
          <div>
            <div className="font-medium text-gray-900">{person.name}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              {person.count} txn{person.count > 1 ? 's' : ''}
              {person.classified_count > 0 && (
                <> · {person.classified_count} classified · {person.unclassified_count} pending</>
              )}
            </div>
          </div>
        </div>
        <div className="text-right">
          {person.total_debit > 0 && (
            <div className="text-sm text-red-600">−{fmtINR(person.total_debit)}</div>
          )}
          {person.total_credit > 0 && (
            <div className="text-sm text-green-600">+{fmtINR(person.total_credit)}</div>
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
          {unclassified.length > 1 && (
            <div className="mb-3 pb-3 border-b border-gray-200 text-sm flex items-center justify-between">
              <span className="text-gray-600">
                Classify all {unclassified.length} pending txns at once:
              </span>
              <div className="relative">
                <button
                  onClick={() => setReclassifyTarget(bulkOpen ? null : bulkKey)}
                  className="text-xs px-3 py-1 border border-gray-300 rounded bg-white hover:bg-gray-50"
                >
                  Bulk classify
                </button>
                {bulkOpen && (
                  <ReclassifyMenu
                    direction={bulkDirection}
                    onPick={opt => { onReclassifyAll(opt); setReclassifyTarget(null) }}
                    onClose={() => setReclassifyTarget(null)}
                  />
                )}
              </div>
            </div>
          )}
          <PersonTxnTable
            txns={person.transactions}
            onReclassifyTxn={onReclassifyTxn}
            reclassifyTarget={reclassifyTarget}
            setReclassifyTarget={setReclassifyTarget}
          />
        </div>
      )}
    </div>
  )
}

function PersonTxnTable({
  txns, onReclassifyTxn, reclassifyTarget, setReclassifyTarget,
}: {
  txns: ClassifiedTransaction[]
  onReclassifyTxn: (raw: string, opt: Override) => void
  reclassifyTarget: string | null
  setReclassifyTarget: (raw: string | null) => void
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-xs text-gray-500 uppercase tracking-wide">
          <th className="text-left font-normal pb-2 w-8">#</th>
          <th className="text-left font-normal pb-2 w-16">Date</th>
          <th className="text-left font-normal pb-2">Nature</th>
          <th className="text-right font-normal pb-2 w-28">Amount</th>
          <th className="text-right font-normal pb-2 w-32">Action</th>
        </tr>
      </thead>
      <tbody>
        {txns.map((t, i) => {
          const isPending = t.category === 'Transfer to Persons'
          return (
            <tr key={t.raw} className="border-t border-gray-200">
              <td className="py-2 text-gray-400">{i + 1}</td>
              <td className="py-2 text-gray-600">{fmtDate(t.date)}</td>
              <td className="py-2">
                <div className={isPending ? 'text-gray-500 italic' : 'text-gray-900'}>
                  {natureOf(t)}
                </div>
                {!isPending && (
                  <div className="text-xs text-gray-400">{t.category}</div>
                )}
              </td>
              <td className={`py-2 text-right ${t.direction === 'debit' ? 'text-red-600' : 'text-green-600'}`}>
                {t.direction === 'debit' ? '−' : '+'}{fmtINR(t.amount)}
              </td>
              <td className="py-2 text-right">
                <ReclassifyButton
                  txn={t}
                  onPick={opt => onReclassifyTxn(t.raw, opt)}
                  isOpen={reclassifyTarget === t.raw}
                  onOpen={() => setReclassifyTarget(t.raw)}
                  onClose={() => setReclassifyTarget(null)}
                />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function ReclassifyButton({
  txn, onPick, isOpen, onOpen, onClose,
}: {
  txn: ClassifiedTransaction
  onPick: (opt: Override) => void
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
}) {
  return (
    <div className="relative inline-block">
      <button
        onClick={isOpen ? onClose : onOpen}
        className="text-xs px-2 py-1 border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700"
      >
        Classify
      </button>
      {isOpen && (
        <ReclassifyMenu
          direction={txn.direction}
          onPick={onPick}
          onClose={onClose}
        />
      )}
    </div>
  )
}

function ReclassifyMenu({
  direction, onPick, onClose,
}: {
  direction: 'debit' | 'credit'
  onPick: (opt: Override) => void
  onClose: () => void
}) {
  const opts = optionsFor(direction)
  return (
    <>
      {/* click-outside scrim */}
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute right-0 mt-1 w-64 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-80 overflow-y-auto">
        <div className="px-3 py-1.5 text-xs uppercase tracking-wide text-gray-500 border-b border-gray-100">
          {direction === 'credit' ? 'Income type' : 'Expense type'}
        </div>
        {opts.map((o, i) => (
          <button
            key={i}
            onClick={() => onPick(o)}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 flex justify-between"
          >
            <span>
              <span className="text-gray-900">{o.category}</span>
              {o.subcategory && <span className="text-gray-500"> · {o.subcategory}</span>}
            </span>
            {!o.is_pnl && <span className="text-xs text-gray-400">excl</span>}
          </button>
        ))}
      </div>
    </>
  )
}

function UnconfirmedIncomeRow({
  txn, onReclassify,
}: {
  txn: ClassifiedTransaction
  onReclassify: (opt: Override) => void
}) {
  return (
    <div className="flex items-center justify-between bg-white rounded border border-amber-100 px-3 py-2 text-sm">
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900 truncate">{txn.who}</div>
        <div className="text-xs text-gray-500">{fmtDate(txn.date)} · {txn.explanation}</div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-green-700 font-medium">+{fmtINR(txn.amount)}</span>
        <select
          onChange={e => {
            const v = e.target.value
            if (!v) return
            const opt = INCOME_OPTIONS.find(o => `${o.category}|${o.subcategory}` === v)
            if (opt) onReclassify(opt)
          }}
          defaultValue=""
          className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
        >
          <option value="" disabled>Confirm type…</option>
          {INCOME_OPTIONS.map((o, i) => (
            <option key={i} value={`${o.category}|${o.subcategory}`}>
              {o.category} · {o.subcategory}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
