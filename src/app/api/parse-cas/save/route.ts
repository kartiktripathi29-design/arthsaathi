// app/api/parse-cas/save/route.ts
// Receives parsed CAS data from the frontend after the widget completes.

import { NextRequest, NextResponse } from 'next/server';
import { PHASE_2_ENABLED } from '@/lib/phase';

export async function POST(req: NextRequest) {
  // Phase-2 gate — same flag as the CAS token route. 404 while Phase-2 is off.
  if (!PHASE_2_ENABLED) return new NextResponse(null, { status: 404 });

  let body: any;

  try {
    const text = await req.text();
    console.log('[CAS SAVE] Raw body:', text?.slice(0, 200));
    if (!text || text.trim() === '') {
      return NextResponse.json({ error: 'Empty request body' }, { status: 400 });
    }
    body = JSON.parse(text);
  } catch (e) {
    console.error('[CAS SAVE] JSON parse error:', e);
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const fetchedAt = new Date().toISOString();

    // Handle different shapes CASparser might send
    const holdings = body?.holdings || body?.data || body || {};
    const investor = holdings?.investor || {};
    const summary = holdings?.summary || {};

    return NextResponse.json({
      success: true,
      message: 'Holdings received',
      summary: {
        investor: investor?.name || 'Investor',
        pan: investor?.pan || '',
        total_value: summary?.total_value || summary?.totalValue || 0,
        fetched_at: fetchedAt,
      },
      data: holdings,
    });

  } catch (error) {
    console.error('[CAS SAVE] Error:', error);
    return NextResponse.json({ error: 'Failed to process holdings' }, { status: 500 });
  }
}
