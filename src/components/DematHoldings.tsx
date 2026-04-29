'use client';

// components/DematHoldings.tsx

import { useState, useEffect } from 'react';

interface BreakdownRow {
  icon: string;
  label: string;
  count: number;
  value: number;
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
      open: (opts: object) => Promise<{ data: { holdings: object } }>;
    };
  }
}

function buildBreakdown(data: any): BreakdownRow[] {
  const rows: BreakdownRow[] = [];
  const s = data?.summary?.accounts || {};

  if (s.demat?.total_value > 0) {
    let equityCount = 0, equityValue = 0;
    let gsecCount = 0, gsecValue = 0;
    let dematMfCount = 0, dematMfValue = 0;

    (data.demat_accounts || []).forEach((acc: any) => {
      const h = acc.holdings || {};
      equityCount += (h.equities || []).filter((e: any) => e.value > 0).length;
      equityValue += (h.equities || []).reduce((s: number, e: any) => s + (e.value || 0), 0);
      gsecCount += (h.government_securities || []).length;
      gsecValue += (h.government_securities || []).reduce((s: number, e: any) => s + (e.value || 0), 0);
      dematMfCount += (h.demat_mutual_funds || []).length;
      dematMfValue += (h.demat_mutual_funds || []).reduce((s: number, e: any) => s + (e.value || 0), 0);
    });

    if (equityValue > 0) rows.push({ icon: '📊', label: 'Equities', count: equityCount, value: equityValue });
    if (dematMfValue > 0) rows.push({ icon: '📈', label: 'Demat Mutual Funds', count: dematMfCount, value: dematMfValue });
    if (gsecValue > 0) rows.push({ icon: '🏛️', label: 'Govt Securities / SGB', count: gsecCount, value: gsecValue });
  }

  if (s.mutual_funds?.total_value > 0) {
    let mfCount = 0;
    (data.mutual_funds || []).forEach((folio: any) => { mfCount += (folio.schemes || []).length; });
    rows.push({ icon: '💼', label: 'Mutual Funds (Non-Demat)', count: mfCount, value: s.mutual_funds.total_value });
  }

  if (s.nps?.total_value > 0) {
    rows.push({ icon: '🏦', label: 'NPS', count: s.nps.count || 1, value: s.nps.total_value });
  }

  if (s.insurance?.total_value > 0) {
    rows.push({ icon: '🛡️', label: 'Life Insurance', count: s.insurance.count || 0, value: s.insurance.total_value });
  }

  return rows;
}

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
      if (message === 'Widget closed by user') {
        setStatus('idle');
      } else {
        setErrorMsg(message || 'Something went wrong. Please try again.');
        setStatus('error');
      }
    }
  };

  const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

  const formattedDate = holdings?.fetched_at
    ? new Date(holdings.fetched_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  const C = { fg: '#3A4B41', wheat: '#E6CFA7', wl: '#F5ECD8', wm: '#D4B98A', border: '#E4DDD1', text: '#1C2B22', muted: '#7A8A7E' };

  return (
    <div style={{ marginBottom: 14 }}>
      {/* Main card */}
      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: holdings?.breakdown?.length ? '8px 8px 0 0' : 8, padding: 16, display: 'flex', gap: 14, alignItems: 'center' }}>
        <div style={{ width: 42, height: 42, borderRadius: '50%', background: holdings ? '#EEF2EE' : C.wl, border: `2px solid ${holdings ? C.fg : C.wm}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
          🏛️
        </div>
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
              <p style={{ fontSize: 10.5, color: C.muted, margin: 0 }}>💡 OTP sent to your CDSL-registered mobile</p>
            </>
          )}
          {errorMsg && (
            <p style={{ fontSize: 11, color: '#B94040', margin: '4px 0 0', background: '#FBF0F0', padding: '4px 8px', borderRadius: 4 }}>{errorMsg}</p>
          )}
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

      {/* Breakdown table */}
      {holdings?.breakdown && holdings.breakdown.length > 0 && (
        <div style={{ border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
          {holdings.breakdown.map((row, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 16px', borderBottom: `1px solid #FAF7F2`, fontSize: 12.5 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{row.icon}</span>
                <span style={{ color: C.text }}>{row.label}</span>
                {row.count > 0 && <span style={{ fontSize: 10.5, color: C.muted }}>({row.count})</span>}
              </span>
              <span style={{ fontWeight: 600, color: C.fg }}>{fmt(row.value)}</span>
            </div>
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
