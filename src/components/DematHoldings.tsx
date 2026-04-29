'use client';

// components/DematHoldings.tsx
// Replaces the "Upload CAS" block in My Profile > Step 4.
// Primary path: CASparser Portfolio Connect widget (OTP fetch + PDF fallback built-in)
// Uses CDN version of the SDK to avoid build-time package dependency issues.

import { useState, useEffect } from 'react';

interface HoldingsSummary {
  investor: string;
  pan: string;
  total_value: number;
  fetched_at: string;
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

export default function DematHoldings({ existingHoldings, onSuccess }: DematHoldingsProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [holdings, setHoldings] = useState<HoldingsSummary | null>(existingHoldings ?? null);
  const [errorMsg, setErrorMsg] = useState('');
  const [sdkReady, setSdkReady] = useState(false);

  // Load the Portfolio Connect SDK from CDN
  useEffect(() => {
    if (document.getElementById('casparser-sdk')) { setSdkReady(true); return; }
    const script = document.createElement('script');
    script.id = 'casparser-sdk';
    script.src = 'https://cdn.jsdelivr.net/npm/@cas-parser/connect/dist/portfolio-connect.standalone.min.js';
    script.onload = () => setSdkReady(true);
    script.onerror = () => setErrorMsg('Failed to load portfolio widget. Please try again.');
    document.body.appendChild(script);
  }, []);

  const handleConnect = async () => {
    setStatus('loading');
    setErrorMsg('');

    // Step 1: Get short-lived token from our backend
    let accessToken: string;
    try {
      const res = await fetch('/api/parse-cas/token', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Token fetch failed');
      accessToken = json.access_token;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not connect. Please try again.';
      setErrorMsg(message);
      setStatus('error');
      return;
    }

    // Step 2: Open the Portfolio Connect widget
    if (!window.PortfolioConnect) {
      setErrorMsg('Portfolio widget not loaded. Please refresh and try again.');
      setStatus('error');
      return;
    }

    try {
      const { data } = await window.PortfolioConnect.open({
        accessToken,
        config: {
          enableCdslFetch: true,
          enableGenerator: true,
          enableInbox: true,
        },
      });

      // Step 3: Save to backend
      const saveRes = await fetch('/api/parse-cas/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data.holdings),
      });
      const saveJson = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveJson.error || 'Save failed');

      setHoldings(saveJson.summary);
      onSuccess?.(saveJson.data || data.holdings);
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

  const formattedValue = holdings?.total_value
    ? `₹${holdings.total_value.toLocaleString('en-IN')}`
    : null;

  const formattedDate = holdings?.fetched_at
    ? new Date(holdings.fetched_at).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : null;

  return (
    <div style={{ background:'#fff', border:'1px solid #E4DDD1', borderRadius:8, padding:16, marginBottom:14, display:'flex', gap:14, alignItems:'center' }}>
      {/* Icon */}
      <div style={{ width:42, height:42, borderRadius:'50%', background: holdings ? '#EEF2EE' : '#F5ECD8', border:`2px solid ${holdings ? '#3A4B41' : '#D4B98A'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
        🏛️
      </div>

      {/* Content */}
      <div style={{ flex:1 }}>
        {holdings ? (
          <>
            <p style={{ fontSize:13, fontWeight:700, color:'#3A4B41', margin:'0 0 3px' }}>✓ Holdings connected</p>
            <p style={{ fontSize:11.5, color:'#7A8A7E', margin:'0 0 2px' }}>Total value: {formattedValue}</p>
            <p style={{ fontSize:10.5, color:'#7A8A7E', margin:0 }}>Last synced: {formattedDate} · auto-refreshes monthly</p>
          </>
        ) : (
          <>
            <p style={{ fontSize:13, fontWeight:600, color:'#1C2B22', margin:'0 0 3px' }}>Fetch Demat &amp; MF Holdings</p>
            <p style={{ fontSize:11, color:'#7A8A7E', margin:'0 0 2px', lineHeight:1.55 }}>CDSL · NSDL · CAMS · KFintech — all in one fetch</p>
            <p style={{ fontSize:10.5, color:'#7A8A7E', margin:0 }}>💡 OTP sent to your CDSL-registered email</p>
          </>
        )}

        {errorMsg && (
          <p style={{ fontSize:11, color:'#B94040', margin:'4px 0 0', background:'#FBF0F0', padding:'4px 8px', borderRadius:4 }}>
            {errorMsg}
          </p>
        )}
      </div>

      {/* Action button */}
      {holdings ? (
        <button
          onClick={handleConnect}
          disabled={status === 'loading' || !sdkReady}
          style={{ padding:'6px 12px', fontSize:11, color:'#3A4B41', background:'#F5ECD8', border:'1px solid #D4B98A', borderRadius:4, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' as const }}
        >
          {status === 'loading' ? 'Connecting…' : 'Refresh'}
        </button>
      ) : (
        <button
          onClick={handleConnect}
          disabled={status === 'loading' || !sdkReady}
          style={{ padding:'8px 16px', background:'#3A4B41', color:'#E6CFA7', border:'none', borderRadius:5, fontSize:12, fontWeight:600, cursor: (status === 'loading' || !sdkReady) ? 'wait' : 'pointer', fontFamily:'inherit', whiteSpace:'nowrap' as const }}
        >
          {status === 'loading' ? 'Connecting…' : !sdkReady ? 'Loading…' : 'Fetch My Holdings'}
        </button>
      )}
    </div>
  );
}
