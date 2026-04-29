// app/api/cas/save/route.ts
// Receives parsed CAS data from the frontend after the widget completes,
// saves it to your database, and records the last-fetched timestamp
// so you can drive the "auto-refresh monthly" logic.

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth'; // adjust to your auth setup
// import { db } from '@/lib/db';         // uncomment and adjust to your DB client

export async function POST(req: NextRequest) {
  // 1. Auth check
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: 'User ID not found in session' }, { status: 400 });
  }

  // 2. Parse body
  let body: CASHoldings;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // 3. Basic validation
  if (!body?.investor?.pan) {
    return NextResponse.json({ error: 'Missing investor PAN in holdings data' }, { status: 400 });
  }

  // 4. Save to DB
  // Replace this block with your actual DB logic (Supabase, Prisma, etc.)
  try {
    // Example for Supabase:
    // const { error } = await db
    //   .from('demat_holdings')
    //   .upsert({
    //     user_id: userId,
    //     pan: body.investor.pan,
    //     investor_name: body.investor.name,
    //     total_value: body.summary.total_value,
    //     holdings_json: body,           // store the full JSON blob
    //     fetched_at: new Date().toISOString(),
    //     next_refresh_at: getNextRefreshDate(),
    //   }, { onConflict: 'user_id' });
    //
    // if (error) throw error;

    // ---- PLACEHOLDER: log until DB is wired ----
    console.log(`[CAS SAVE] User ${userId} | PAN ${body.investor.pan} | ₹${body.summary?.total_value?.toLocaleString('en-IN')}`);
    // --------------------------------------------

    return NextResponse.json({
      success: true,
      message: 'Holdings saved',
      summary: {
        investor: body.investor.name,
        pan: body.investor.pan,
        total_value: body.summary?.total_value,
        fetched_at: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('[CAS SAVE] DB error:', error);
    return NextResponse.json({ error: 'Failed to save holdings' }, { status: 500 });
  }
}

// --- Helper: schedule next refresh 30 days from now ---
function getNextRefreshDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString();
}

// --- Types (subset of CASparser response) ---
interface CASHoldings {
  meta: {
    cas_type: 'CAMS_KFINTECH' | 'CDSL' | 'NSDL';
    statement_period: { from: string; to: string };
    generated_at: string;
  };
  investor: {
    name: string;
    pan: string;
    email?: string;
  };
  summary: {
    total_value: number;
    accounts: {
      demat: { count: number; total_value: number };
      mutual_funds: { count: number; total_value: number };
    };
  };
  demat_accounts: object[];
  mutual_funds: object[];
}
