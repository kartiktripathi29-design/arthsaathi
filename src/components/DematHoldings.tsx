'use client';

// components/DematHoldings.tsx
// Replaces the "Upload CAS" block in My Profile > Step 4.
// Primary path: CASparser Portfolio Connect widget (OTP fetch + PDF fallback built-in)
// Fallback path: manual PDF upload (shown as secondary option)

import { useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import to avoid SSR issues with the SDK
const PortfolioConnect = dynamic(
  () => import('@cas-parser/connect').then((m) => m.PortfolioConnect),
  { ssr: false }
);

interface HoldingsSummary {
  investor: string;
  pan: string;
  total_value: number;
  fetched_at: string;
}

interface DematHoldingsProps {
  existingHoldings?: HoldingsSummary | null;
  onSuccess?: (holdings: object) => void; // callback to page.tsx to update casData state
}

export default function DematHoldings({ existingHoldings, onSuccess }: DematHoldingsProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [holdings, setHoldings] = useState<HoldingsSummary | null>(existingHoldings ?? null);
  const [errorMsg, setErrorMsg] = useState('');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [showWidget, setShowWidget] = useState(false);

  // Step 1: Get a short-lived token from our backend
  const handleConnect = async () => {
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/cas/token', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Token fetch failed');
      setAccessToken(json.access_token);
      setShowWidget(true);
      setStatus('idle');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not connect. Please try again.';
      setErrorMsg(message);
      setStatus('error');
    }
  };

  // Step 2: Widget success — save data to our backend
  const handleSuccess = async (data: { holdings: object }) => {
    setShowWidget(false);
    setStatus('loading');
    try {
      const res = await fetch('/api/cas/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data.holdings),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      setHoldings(json.summary);
      onSuccess?.(data.holdings); // update parent page.tsx state + localStorage
      setStatus('success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save holdings.';
      setErrorMsg(message);
      setStatus('error');
    }
  };

  const handleError = (err: { message: string }) => {
    setShowWidget(false);
    if (err.message !== 'Widget closed by user') {
      setErrorMsg(err.message || 'Something went wrong. Please try again.');
      setStatus('error');
    } else {
      setStatus('idle');
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
    <div className="border rounded-xl p-5 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-full bg-[#f5f0e8] flex items-center justify-center text-lg">
          🏦
        </div>
        <div>
          <p className="font-semibold text-gray-800 text-sm">Demat &amp; Mutual Fund Holdings</p>
          <p className="text-xs text-gray-500">
            CDSL · NSDL · CAMS · KFintech &mdash; all in one fetch
          </p>
        </div>
      </div>

      {/* Already connected state */}
      {holdings && status !== 'loading' && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-green-700 font-medium">✓ Holdings connected</p>
              <p className="text-sm font-semibold text-gray-800 mt-0.5">{formattedValue}</p>
              <p className="text-xs text-gray-400 mt-0.5">Last synced: {formattedDate}</p>
            </div>
            <button
              onClick={handleConnect}
              className="text-xs text-[#2d5a27] underline underline-offset-2 hover:opacity-70"
            >
              Refresh
            </button>
          </div>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">
          {errorMsg}
        </div>
      )}

      {/* CTA — show when not yet connected */}
      {!holdings && (
        <div className="mt-4 flex flex-col gap-2">
          {/* Primary CTA */}
          <button
            onClick={handleConnect}
            disabled={status === 'loading'}
            className="w-full bg-[#2d5a27] hover:bg-[#234820] text-white text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60"
          >
            {status === 'loading' ? 'Connecting…' : 'Fetch My Holdings'}
          </button>

          <p className="text-center text-xs text-gray-400">
            OTP sent to your CDSL-registered email · takes ~2 min
          </p>

          {/* Helper note for common confusion */}
          <p className="text-center text-xs text-gray-400">
            💡 Check the email you used when opening your demat account
          </p>
        </div>
      )}

      {/* Show refresh CTA when connected */}
      {holdings && status === 'idle' && (
        <p className="text-xs text-gray-400 mt-2 text-center">
          Auto-refreshes monthly · <span className="text-[#2d5a27] cursor-pointer" onClick={handleConnect}>Fetch now</span>
        </p>
      )}

      {/* Portfolio Connect Widget */}
      {showWidget && accessToken && (
        <PortfolioConnect
          accessToken={accessToken}
          config={{
            enableCdslFetch: true,   // CDSL OTP fetch (primary)
            enableGenerator: true,   // MF email fetch
            enableInbox: true,       // Gmail inbox import
          }}
          onSuccess={handleSuccess}
          onError={handleError}
        >
          {({ open }: { open: () => void }) => {
            // Auto-open the widget as soon as it mounts
            setTimeout(open, 100);
            return null;
          }}
        </PortfolioConnect>
      )}

      {/* Fallback: manual PDF upload */}
      <div className="mt-4 border-t pt-3">
        <p className="text-xs text-gray-400 text-center">
          OTP not working?{' '}
          <label
            htmlFor="cas-pdf-upload"
            className="text-[#2d5a27] cursor-pointer underline underline-offset-2 hover:opacity-70"
          >
            Upload CAS PDF manually
          </label>
        </p>
        <input
          id="cas-pdf-upload"
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              // TODO: wire to your existing CAS PDF upload handler
              console.log('Manual PDF selected:', file.name);
              alert(`PDF "${file.name}" selected. Wire this to your existing upload handler.`);
            }
          }}
        />
      </div>
    </div>
  );
}
