// app/api/parse-cas/save/route.ts
// Receives parsed CAS data from the frontend after the widget completes.
// Returns a summary so the frontend can update its local state.

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  // Parse body
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Basic validation
  if (!body) {
    return NextResponse.json({ error: 'Missing holdings data' }, { status: 400 });
  }

  try {
    const fetchedAt = new Date().toISOString();

    // Return summary back to frontend so it can update localStorage + state
    return NextResponse.json({
      success: true,
      message: 'Holdings received',
      summary: {
        investor: body.investor?.name || '',
        pan: body.investor?.pan || '',
        total_value: body.summary?.total_value || body.summary?.totalValue || 0,
        fetched_at: fetchedAt,
      },
      // Pass full data back so frontend can store it in av_cas_holdings
      data: body,
    });

  } catch (error) {
    console.error('[CAS SAVE] Error:', error);
    return NextResponse.json({ error: 'Failed to process holdings' }, { status: 500 });
  }
}
