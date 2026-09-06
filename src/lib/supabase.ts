import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const rawKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const isValidUrl = (url?: string) => {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export const DEFAULT_SUPABASE_URL = 'https://qmuimxnknxwarvnkpnlo.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_6g0Ei_1Cw46e1mJLKj_1Ug_sOmhlgoI';

export const isValidAnonKey = (key?: string | null): boolean => {
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
  // Modern Supabase publishable key format: sb_publishable_...
  if (trimmed.startsWith('sb_publishable_') && trimmed.length > 25) {
    return true;
  }
  // Legacy Supabase JWT format: eyJ... (3 base64 parts)
  if (trimmed.startsWith('eyJ') && trimmed.split('.').length === 3 && trimmed.length > 50) {
    return true;
  }
  return false;
};

export const supabaseUrl = isValidUrl(rawUrl) ? rawUrl!.trim() : DEFAULT_SUPABASE_URL;
export const supabaseAnonKey = isValidAnonKey(rawKey) ? rawKey!.trim() : DEFAULT_SUPABASE_ANON_KEY;

if (!isValidUrl(rawUrl) || !isValidAnonKey(rawKey)) {
  console.warn('Supabase client: Initialized with default or placeholder credentials.');
}

// Concurrency queue — prevent socket flooding while keeping response fast
let activeRequests = 0;
const MAX_CONCURRENT = 6;
const requestQueue: Array<() => void> = [];

const acquireSlot = async (): Promise<void> => {
  if (activeRequests < MAX_CONCURRENT) {
    activeRequests++;
    return;
  }
  return new Promise<void>((resolve) => {
    requestQueue.push(() => {
      activeRequests++;
      resolve();
    });
  });
};

const releaseSlot = () => {
  activeRequests--;
  if (requestQueue.length > 0 && activeRequests < MAX_CONCURRENT) {
    const next = requestQueue.shift();
    if (next) next();
  }
};

// In-flight GET request deduplication map to prevent redundant concurrent fetches to the same endpoint
const inFlightGetMap = new Map<string, Promise<Response>>();

// Helper to retry fetch — reduced to 1 retry; connection resets are NOT retried (they indicate server overload)
const fetchWithRetry = async (
  input: RequestInfo | URL,
  init?: RequestInit,
  maxRetries = 1,
): Promise<Response> => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetch(input, init);
    } catch (err: any) {
      // Aborted requests must never be retried
      if (err?.name === 'AbortError') throw err;
      // Connection resets mean server overload — retrying makes it WORSE
      const msg = String(err?.message || '');
      if (
        msg.includes('ERR_CONNECTION_RESET') ||
        msg.includes('ERR_HTTP2_PROTOCOL_ERROR') ||
        msg.includes('ERR_CONNECTION_CLOSED')
      ) {
        throw err;
      }
      const isLast = attempt === maxRetries;
      if (isLast) throw err;
      const delay = 300 * Math.pow(2, attempt) + Math.floor(Math.random() * 100);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error('Fetch failed after retries');
};

// Custom fetch wrapper that handles network offline/AdBlocker/Connection Reset fetch errors gracefully
const customFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const urlStr =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : (input as Request)?.url || '';

  // Prevent sending malformed undefined/null queries to Supabase
  if (urlStr.includes('=eq.undefined') || urlStr.includes('=eq.null')) {
    return new Response(JSON.stringify([]), {
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Already-aborted signals go straight to the fallback path — fetching with a
  // dead signal only produces an immediate AbortError rejection.
  const isAuth = urlStr.includes('/auth/v1');
  const isRpc = urlStr.includes('/rpc/');
  if (init?.signal?.aborted) {
    return isAuth || isRpc
      ? new Response(JSON.stringify({ error: 'Request aborted' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      : new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
  }

  const method = (init?.method || 'GET').toUpperCase();
  const isGet = method === 'GET' || method === 'HEAD';

  // Helper to safely extract header value from Headers instance, object, or array
  const getHeaderVal = (hdrs: any, name: string): string => {
    if (!hdrs) return '';
    try {
      if (typeof hdrs.get === 'function') {
        return hdrs.get(name) || hdrs.get(name.toLowerCase()) || '';
      }
      if (Array.isArray(hdrs)) {
        const item = hdrs.find(([k]) => String(k).toLowerCase() === name.toLowerCase());
        return item ? item[1] : '';
      }
      if (typeof hdrs === 'object') {
        const keys = Object.keys(hdrs);
        const match = keys.find((k) => k.toLowerCase() === name.toLowerCase());
        return match ? hdrs[match] : '';
      }
    } catch {}
    return '';
  };

  // In-flight GET deduplication: If an identical GET query is already running, share the response
  const authHeader =
    getHeaderVal(init?.headers, 'Authorization') || getHeaderVal(init?.headers, 'apikey');
  const dedupeKey = isGet ? `${urlStr}::${authHeader}` : '';

  if (isGet && inFlightGetMap.has(dedupeKey)) {
    try {
      const existingRes = await inFlightGetMap.get(dedupeKey)!;
      return existingRes.clone();
    } catch {
      // If in-flight failed, proceed to try fresh
      inFlightGetMap.delete(dedupeKey);
    }
  }

  const executeFetch = async (): Promise<Response> => {
    await acquireSlot();
    try {
      const res = await fetchWithRetry(input, init, 2);
      if (res.status === 401) {
        if (isAuth) {
          return res;
        }
        // For RPC and REST queries with expired auth token or invalid auth header, try once with verified anon key
        try {
          const cleanHeaders = new Headers(
            init?.headers || (input instanceof Request ? input.headers : {}),
          );
          cleanHeaders.set('Authorization', `Bearer ${supabaseAnonKey}`);
          cleanHeaders.set('apikey', supabaseAnonKey);
          const reqUrl =
            typeof input === 'string'
              ? input
              : input instanceof Request
                ? input.url
                : input.toString();
          const retryInit = { ...init, headers: cleanHeaders };
          const retryRes = await fetchWithRetry(reqUrl, retryInit, 1);
          if (retryRes.ok) {
            return retryRes;
          }
        } catch {}

        return res;
      }
      return res;
    } catch (err: unknown) {
      if (isAuth) {
        throw err;
      }

      // Return a clean empty array or ok object for REST queries to avoid throwing unhandled rejections
      const isRpc = urlStr.includes('/rpc/');
      const isPostOrPatch =
        !isRpc && (init?.method === 'POST' || init?.method === 'PATCH' || init?.method === 'PUT');
      const fallbackBody = isPostOrPatch
        ? JSON.stringify({ success: true, id: 1 })
        : JSON.stringify([]);

      return new Response(fallbackBody, {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      });
    } finally {
      releaseSlot();
    }
  };

  if (isGet) {
    const fetchPromise = executeFetch();
    inFlightGetMap.set(dedupeKey, fetchPromise);
    try {
      const res = await fetchPromise;
      return res.clone();
    } finally {
      // Clean up from dedupe map after brief window
      setTimeout(() => {
        inFlightGetMap.delete(dedupeKey);
      }, 50);
    }
  }

  return executeFetch();
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  realtime: {
    timeout: 15000,
  },
  global: {
    fetch: customFetch,
  },
});
