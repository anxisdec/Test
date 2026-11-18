import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { accountsEnabled, supabaseUrl, supabaseKey } from './config';

export function publicDatabase() {
  return accountsEnabled ? createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(4500) }) },
  }) : null;
}

export async function sessionDatabase() {
  if (!accountsEnabled) return null;
  const store = await cookies();
  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (updates) => { try { updates.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* Read-only server render. */ } },
    },
    global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(5500) }) },
  });
}

export function privateDatabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return accountsEnabled && key ? createClient(supabaseUrl, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(4500) }) },
  }) : null;
}
