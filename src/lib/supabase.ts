import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isConfigured = Boolean(url && key);

export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

/** Turns database error codes into translation keys the UI can show. */
export function errorKey(err: unknown): string {
  const msg = (err as { message?: string })?.message ?? '';
  for (const k of ['code_not_found', 'own_code', 'not_connected', 'blocked']) {
    if (msg.includes(k)) return `err.${k}`;
  }
  if (/fetch|network/i.test(msg)) return 'err.offline';
  return 'err.generic';
}
