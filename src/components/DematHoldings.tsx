'use client';

// components/DematHoldings.tsx

import { useState, useEffect } from 'react';
import { tokens as T } from '@/lib/tokens';

interface Transaction {
  date: string;
  type: 'buy' | 'sell' | string;
  units: number;
  price: number;
  amount?: number;
}

interface Holding {
  isin: string;
  name: string;
  units: number;
  value: number;
  transactions: Transaction[];
  additional_info?: any;
}

interface BreakdownRow {
  icon: string;
  label: string;
  count: number;
  value: number;
  holdings: Holding[];
}

interface HoldingsSummary {
  investor: string;
  pan: string;
  total_value: number;
  fetched_at: string;
  breakdown?: BreakdownRow[];
}

interface DematHoldingsProps {
  existingHoldings?: HoldingsSummary | null;
  onSuccess?: (holdings: object) => void;
}

declare global {
  interface Window {
    PortfolioConnect?: {
      open: (opts: object) => Promise<{ data: any }>;
    };
  }
}

// ── LTCG/STCG calculation ──────────────────────────────────────────
function getTaxImplication(transactions: Transaction[]): { ltcg: boolean; stcg: boolean; mixed: boolean } {
  if (!transactions || transactions.length === 0) return { ltcg: false, stcg: false, mixed: false };
  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  let hasLTCG = false;
  let hasSTCG = false;
  transactions.forEach(t => {
    if (t.type?.toLowerCase() === 'buy' || t.type?.toLowerCase() === 'purchase') {
      const buyDate = new Date(t.date);
      if (buyDate <= oneYearAgo) hasLTCG = true;
      else hasSTCG = true;
    }
  });
  // If no buy transactions found, infer from oldest date
  if (!hasLTCG && !hasSTCG && transactions.length > 0) {
    const oldest = transactions.reduce((a, b) => new Date(a.date) < new Date(b.date) ? a : b);
    if (new Date(oldest.date) <= oneYearAgo) hasLTCG = true;
    else hasSTCG = true;
  }
  return { ltcg: hasLTCG, stcg: hasSTCG, mixed: hasLTCG && hasSTCG };
}

function TaxBadge({ transactions }: { transactions: Transaction[] }) {
  const { ltcg, stcg, mixed } = getTaxImplication(transactions);
  if (!ltcg && !stcg) return <span style={{ fontSize: 10, color: '#7A8A7E', background: '#F5ECD8', padding: '2px 6px', borderRadius: 3 }}>No tx data</span>;
  return (
    <span style={{ display: 'flex', gap: 4 }}>
      {ltcg && <span style={{ fontSize: 10, fontWeight: 600, color: '#2A7A4A', background: '#EEF2EE', padding: '2px 6px', borderRadius: 3, border: '1px solid #C8D8C8' }}>LTCG</span>}
      {stcg && <span style={{ fontSize: 10, fontWeight: 600, color: '#B94040', background: '#FBF0F0', padding: '2px 6px', borderRadius: 3, border: '1px solid #F0CECE' }}>STCG</span>}
    </span>
  );
}

// ── Build breakdown from CASparser response ────────────────────────
function buildBreakdown(data: any): BreakdownRow[] {
  const rows: BreakdownRow[] = [];
  const s = data?.summary?.accounts || {};

  // Aggregate across all demat accounts
  const allEquities: Holding[] = [];
  const allDematMFs: Holding[] = [];
  const allGSecs: Holding[] = [];

  (data.demat_accounts || []).forEach((acc: any) => {
    const h = acc.holdings || {};
    (h.equities || []).filter((e: any) => e.value > 0).forEach((e: any) => allEquities.push(e));
    (h.demat_mutual_funds || []).forEach((e: any) => allDematMFs.push(e));
    (h.government_securities || []).forEach((e: any) => allGSecs.push(e));
  });

  if (allEquities.length > 0) {
    const totalVal = allEquities.reduce((s, e) => s + (e.value || 0), 0);
    rows.push({ icon: '', label: 'Equities', count: allEquities.length, value: totalVal, holdings: allEquities });
  }
  if (allDematMFs.length > 0) {
    const totalVal = allDematMFs.reduce((s, e) => s + (e.value || 0), 0);
    rows.push({ icon: '', label: 'Demat Mutual Funds', count: allDematMFs.length, value: totalVal, holdings: allDematMFs });
  }
  if (allGSecs.length > 0) {
    const totalVal = allGSecs.reduce((s, e) => s + (e.value || 0), 0);
    rows.push({ icon: '', label: 'Govt Securities / SGB', count: allGSecs.length, value: totalVal, holdings: allGSecs });
  }

  // Non-demat MFs from mutual_funds array
  const allMFs: Holding[] = [];
  (data.mutual_funds || []).forEach((folio: any) => {
    (folio.schemes || []).forEach((scheme: any) => allMFs.push(scheme));
  });
  if (allMFs.length > 0 && s.mutual_funds?.total_value > 0) {
    rows.push({ icon: '', label: 'Mutual Funds (Non-Demat)', count: allMFs.length, value: s.mutual_funds.total_value, holdings: allMFs });
  }

  if (s.nps?.total_value > 0) {
    rows.push({ icon: '', label: 'NPS', count: s.nps.count || 1, value: s.nps.total_value, holdings: [] });
  }
  if (s.insurance?.total_value > 0) {
    rows.push({ icon: '', label: 'Life Insurance', count: s.insurance.count || 0, value: s.insurance.total_value, holdings: [] });
  }

  return rows;
}

// ── Individual holding expanded row ───────────────────────────────
function HoldingDetail({ holding, C }: { holding: Holding; C: any }) {
  const avgBuy = holding.transactions?.length > 0
    ? holding.transactions.filter(t => t.type?.toLowerCase().includes('buy') || t.type?.toLowerCase().includes('purchase'))
        .reduce((acc, t) => ({ total: acc.total + (t.amount || t.price * t.units || 0), units: acc.units + (t.units || 0) }), { total: 0, units: 0 })
    : null;
  const avgBuyPrice = avgBuy && avgBuy.units > 0 ? avgBuy.total / avgBuy.units : null;
  const currentPrice = holding.units > 0 ? holding.value / holding.units : 0;

  return (
    <div style={{ padding: '10px 16px 12px 40px', borderBottom: `1px solid #F5ECD8`, background: '#FDFAF6' }}>
      {/* Stats row */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 8, flexWrap: 'wrap' as const }}>
        <div>
          <p style={{ fontSize: 10, color: C.muted, margin: '0 0 1px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Qty</p>
          <p style={{ fontSize: 12.5, fontWeight: 600, color: C.text, margin: 0 }}>{holding.units?.toLocaleString('en-IN')}</p>
        </div>
        <div>
          <p style={{ fontSize: 10, color: C.muted, margin: '0 0 1px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Current Value</p>
          <p style={{ fontSize: 12.5, fontWeight: 600, color: C.fg, margin: 0 }}>₹{Math.round(holding.value).toLocaleString('en-IN')}</p>
        </div>
        <div>
          <p style={{ fontSize: 10, color: C.muted, margin: '0 0 1px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Current Price</p>
          <p style={{ fontSize: 12.5, fontWeight: 600, color: C.text, margin: 0 }}>₹{currentPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
        </div>
        {avgBuyPrice && (
          <div>
            <p style={{ fontSize: 10, color: C.muted, margin: '0 0 1px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Avg Buy Price</p>
            <p style={{ fontSize: 12.5, fontWeight: 600, color: C.text, margin: 0 }}>₹{avgBuyPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
          </div>
        )}
        <div>
          <p style={{ fontSize: 10, color: C.muted, margin: '0 0 1px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Tax</p>
          <TaxBadge transactions={holding.transactions || []} />
        </div>
      </div>

      {/* Transaction history */}
      {holding.transactions && holding.transactions.length > 0 && (
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, margin: '8px 0 4px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Transaction History</p>
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
            {holding.transactions.map((t, i) => {
              const isBuy = t.type?.toLowerCase().includes('buy') || t.type?.toLowerCase().includes('purchase');
              const isSell = t.type?.toLowerCase().includes('sell') || t.type?.toLowerCase().includes('redemption');
              return (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', borderBottom: i < holding.transactions.length - 1 ? `1px solid #FAF7F2` : 'none', fontSize: 11.5, background: i % 2 === 0 ? '#fff' : '#FDFAF6' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: isBuy ? '#2A7A4A' : isSell ? '#B94040' : C.muted, background: isBuy ? '#EEF2EE' : isSell ? '#FBF0F0' : C.wl, padding: '1px 6px', borderRadius: 3, minWidth: 36, textAlign: 'center' as const }}>
                      {isBuy ? 'BUY' : isSell ? 'SELL' : (t.type || 'TXN').toUpperCase()}
                    </span>
                    <span style={{ color: C.muted }}>{t.date}</span>
                  </span>
                  <span style={{ display: 'flex', gap: 16 }}>
                    <span style={{ color: C.text }}>Qty: <strong>{t.units?.toLocaleString('en-IN')}</strong></span>
                    <span style={{ color: C.text }}>@ ₹<strong>{t.price?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong></span>
                    {t.amount && <span style={{ color: isBuy ? '#2A7A4A' : '#B94040', fontWeight: 600 }}>₹{Math.round(t.amount).toLocaleString('en-IN')}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(!holding.transactions || holding.transactions.length === 0) && (
        <p style={{ fontSize: 11, color: C.muted, margin: 0, fontStyle: 'italic' as const }}>No transaction history available for this holding.</p>
      )}
    </div>
  );
}

// ── Breakdown section with expandable rows ─────────────────────────
function BreakdownSection({ row, C }: { row: BreakdownRow; C: any }) {
  const [open, setOpen] = useState(false);
  const [expandedHolding, setExpandedHolding] = useState<string | null>(null);

  return (
    <div>
      {/* Category row */}
      <div
        onClick={() => row.holdings.length > 0 && setOpen(!open)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 16px', borderBottom: `1px solid #FAF7F2`, fontSize: 12.5, cursor: row.holdings.length > 0 ? 'pointer' : 'default', background: open ? '#F5ECD8' : '#fff', transition: 'background 0.15s' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: C.text, fontWeight: open ? 600 : 400 }}>{row.label}</span>
          {row.count > 0 && <span style={{ fontSize: 10.5, color: C.muted }}>({row.count})</span>}
          {row.holdings.length > 0 && <span style={{ fontSize: 10, color: C.muted }}>{open ? '▲' : '▼'}</span>}
        </span>
        <span style={{ fontWeight: 600, color: C.fg }}>₹{Math.round(row.value).toLocaleString('en-IN')}</span>
      </div>

      {/* Expanded: individual holdings */}
      {open && row.holdings.map((holding, i) => {
        const isExpanded = expandedHolding === holding.isin;
        return (
          <div key={holding.isin || i}>
            {/* Holding row */}
            <div
              onClick={() => setExpandedHolding(isExpanded ? null : holding.isin)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px 8px 32px', borderBottom: `1px solid #FAF7F2`, fontSize: 12, cursor: 'pointer', background: isExpanded ? '#FFF8EE' : '#FDFAF6' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 10 }}>{isExpanded ? '▼' : '▸'}</span>
                <span style={{ color: C.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, maxWidth: 240 }}>{holding.name}</span>
                <TaxBadge transactions={holding.transactions || []} />
              </span>
              <span style={{ fontWeight: 600, color: C.fg, flexShrink: 0, marginLeft: 8 }}>₹{Math.round(holding.value).toLocaleString('en-IN')}</span>
            </div>

            {/* Expanded detail */}
            {isExpanded && <HoldingDetail holding={holding} C={C} />}
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────
export default function DematHoldings({ existingHoldings, onSuccess }: DematHoldingsProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [holdings, setHoldings] = useState<HoldingsSummary | null>(existingHoldings ?? null);
  const [errorMsg, setErrorMsg] = useState('');
  const [sdkReady, setSdkReady] = useState(false);

  useEffect(() => {
    if (document.getElementById('casparser-sdk')) { setSdkReady(true); return; }
    const script = document.createElement('script');
    script.id = 'casparser-sdk';
    script.src = 'https://cdn.jsdelivr.net/npm/@cas-parser/connect/dist/portfolio-connect.standalone.min.js';
    script.onload = () => setSdkReady(true);
    script.onerror = () => setErrorMsg('Failed to load portfolio widget. Please refresh and try again.');
    document.body.appendChild(script);
  }, []);

  const handleConnect = async () => {
    setStatus('loading');
    setErrorMsg('');
    let accessToken: string;
    try {
      const res = await fetch('/api/parse-cas/token', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Token fetch failed');
      accessToken = json.access_token;
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not connect. Please try again.');
      setStatus('error');
      return;
    }

    if (!window.PortfolioConnect) {
      setErrorMsg('Portfolio widget not loaded. Please refresh and try again.');
      setStatus('error');
      return;
    }

    try {
      const { data } = await window.PortfolioConnect.open({
        accessToken,
        config: { enableCdslFetch: true, enableGenerator: true, enableInbox: true },
      });

      const saveRes = await fetch('/api/parse-cas/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const saveJson = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveJson.error || 'Save failed');

      const breakdown = buildBreakdown(saveJson.data);
      const newHoldings = { ...saveJson.summary, breakdown };
      setHoldings(newHoldings);
      onSuccess?.(saveJson.data || data);
      setStatus('success');

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      if (message === 'Widget closed by user') setStatus('idle');
      else { setErrorMsg(message || 'Something went wrong.'); setStatus('error'); }
    }
  };

  const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
  const formattedDate = holdings?.fetched_at
    ? new Date(holdings.fetched_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  const C = { fg: T.teal, wheat: T.taupe, wl: T.sand, wm: T.taupeLine, border: T.hairline, text: T.ink, muted: T.muted };

  return (
    <div style={{ marginBottom: 14 }}>
      {/* Main card */}
      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: holdings?.breakdown?.length ? '8px 8px 0 0' : 8, padding: 16, display: 'flex', gap: 14, alignItems: 'center' }}>
        <div style={{ width: 42, height: 42, borderRadius: '50%', background: holdings ? '#EEF2EE' : C.wl, border: `2px solid ${holdings ? C.fg : C.wm}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}></div>
        <div style={{ flex: 1 }}>
          {holdings ? (
            <>
              <p style={{ fontSize: 13, fontWeight: 700, color: C.fg, margin: '0 0 2px' }}>✓ Holdings connected</p>
              <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: '0 0 2px' }}>{fmt(holdings.total_value)}</p>
              <p style={{ fontSize: 10.5, color: C.muted, margin: 0 }}>Last synced: {formattedDate} · auto-refreshes monthly</p>
            </>
          ) : (
            <>
              <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: '0 0 3px' }}>Fetch Demat &amp; MF Holdings</p>
              <p style={{ fontSize: 11, color: C.muted, margin: '0 0 2px', lineHeight: 1.55 }}>CDSL · NSDL · CAMS · KFintech — all in one fetch</p>
              <p style={{ fontSize: 10.5, color: C.muted, margin: 0 }}>OTP sent to your CDSL-registered mobile</p>
            </>
          )}
          {errorMsg && <p style={{ fontSize: 11, color: '#B94040', margin: '4px 0 0', background: '#FBF0F0', padding: '4px 8px', borderRadius: 4 }}>{errorMsg}</p>}
        </div>
        {holdings ? (
          <button onClick={handleConnect} disabled={status === 'loading' || !sdkReady}
            style={{ padding: '6px 12px', fontSize: 11, color: C.fg, background: C.wl, border: `1px solid ${C.wm}`, borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' as const }}>
            {status === 'loading' ? 'Connecting…' : 'Refresh'}
          </button>
        ) : (
          <button onClick={handleConnect} disabled={status === 'loading' || !sdkReady}
            style={{ padding: '8px 16px', background: C.fg, color: C.wheat, border: 'none', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: (status === 'loading' || !sdkReady) ? 'wait' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' as const }}>
            {status === 'loading' ? 'Connecting…' : !sdkReady ? 'Loading…' : 'Fetch My Holdings'}
          </button>
        )}
      </div>

      {/* Breakdown with expandable rows */}
      {holdings?.breakdown && holdings.breakdown.length > 0 && (
        <div style={{ border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
          {holdings.breakdown.map((row, i) => (
            <BreakdownSection key={i} row={row} C={C} />
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: C.wl, fontSize: 13, fontWeight: 700, color: C.fg }}>
            <span>Total Portfolio</span>
            <span>{fmt(holdings.total_value)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
