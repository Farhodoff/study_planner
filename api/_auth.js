import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://qmuimxnknxwarvnkpnlo.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_6g0Ei_1Cw46e1mJLKj_1Ug_sOmhlgoI';

const isValidAnonKey = (key) => {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();
  if (
    trimmed === '[SENSITIVE]' ||
    trimmed.includes('placeholder') ||
    trimmed.includes('your_supabase') ||
    trimmed === 'undefined' ||
    trimmed === 'null' ||
    trimmed === ''
  ) {
    return false;
  }
  if (trimmed.startsWith('sb_publishable_') && trimmed.length > 25) return true;
  if (trimmed.startsWith('eyJ') && trimmed.split('.').length === 3 && trimmed.length > 50) return true;
  return false;
};

const rawAnonKey =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const SUPABASE_ANON_KEY = isValidAnonKey(rawAnonKey)
  ? rawAnonKey.trim()
  : DEFAULT_SUPABASE_ANON_KEY;

/**
 * Extract bearer token from either Fetch Request (Edge) or Node IncomingMessage (Vercel serverless)
 */
export function getBearerToken(req) {
  let authHeader = null;
  if (req && typeof req.headers?.get === 'function') {
    authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  } else if (req && req.headers) {
    authHeader = req.headers['authorization'] || req.headers['Authorization'];
  }

  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * Verifies Supabase JWT access token.
 * Returns { user, error }
 */
export async function verifyAuth(req) {
  const token = getBearerToken(req);
  if (!token || token === SUPABASE_ANON_KEY) {
    return { user: null, error: null };
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (error || !user) {
      return { user: null, error: error?.message || 'Invalid or expired authentication session.' };
    }
    return { user, error: null };
  } catch (err) {
    return { user: null, error: err?.message || 'Authentication verification failed.' };
  }
}
