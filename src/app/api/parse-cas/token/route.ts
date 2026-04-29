// app/api/cas/token/route.ts
// Generates a short-lived CASparser access token for the frontend.
// The API key NEVER leaves the server.

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth'; // or your auth method
import { authOptions } from '@/lib/auth';     // adjust to your auth setup

export async function POST() {
  // 1. Ensure user is logged in
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.CASPARSER_API_KEY;
  if (!apiKey) {
    console.error('CASPARSER_API_KEY is not set in environment variables');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    const response = await fetch('https://api.casparser.in/v1/token', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiry_minutes: 60 }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('CASparser token error:', err);
      return NextResponse.json({ error: 'Failed to generate token' }, { status: 502 });
    }

    const { access_token } = await response.json();
    return NextResponse.json({ access_token });

  } catch (error) {
    console.error('CASparser token fetch failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
