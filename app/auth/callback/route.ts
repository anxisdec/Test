import { NextRequest } from 'next/server';
import { sessionDatabase } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const db = await sessionDatabase();
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const raw = searchParams.get('next') || '/';
  let destination = '/';
  if (/^\/(?!\/)[^\\\x00-\x20]*$/.test(raw) && !raw.startsWith('/auth/callback') && raw.length < 2048) {
    const safe = new URL(raw, 'https://cellula.invalid');
    if (safe.origin === 'https://cellula.invalid') destination = `${safe.pathname}${safe.search}${safe.hash}`;
  }
  let verified = false;
  try {
    if (db && code) verified = !(await db.auth.exchangeCodeForSession(code)).error;
    else if (db && tokenHash) verified = !(await db.auth.verifyOtp({ token_hash: tokenHash, type: 'email' })).error;
  } catch { /* Show a safe, actionable message on the home page. */ }
  return new Response(null, { status: 303, headers: { Location: verified ? destination : '/?auth=link-error', 'Cache-Control': 'private, no-store' } });
}
