import { verifyAuth, getBearerToken, SUPABASE_ANON_KEY } from './_auth.js';
import { checkRateLimit } from './_rateLimit.js';
import { checkDailyQuota } from './_quota.js';

export const config = {
  runtime: 'edge',
};

const ALLOWED_LANGUAGES = new Set([
  'uz',
  'ja',
  'en',
  'ru',
  'ko',
  'zh',
  'es',
  'fr',
  'de',
  'tr',
  'ar',
  'it',
  'pt',
  'hi',
  'id',
  'vi',
  'th',
]);

function normalizeAndValidateLanguage(langInput) {
  if (!langInput) return 'en';
  if (typeof langInput !== 'string') return null;

  const cleanLang = langInput.trim().toLowerCase();
  if (ALLOWED_LANGUAGES.has(cleanLang)) {
    return cleanLang;
  }

  // Support locale format like "ja-JP", "en-US", "uz-UZ"
  const primaryTag = cleanLang.split(/[-_]/)[0];
  if (ALLOWED_LANGUAGES.has(primaryTag)) {
    return primaryTag;
  }

  return null;
}

export default async function handler(req) {
  // 1. CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'HEAD') {
    return new Response(
      JSON.stringify({
        error: 'Method Not Allowed',
        message: "Faqat GET yoki POST so'rovlari qo'llab-quvvatlanadi.",
      }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      },
    );
  }

  // 2. Authentication: strictly verify Supabase JWT or Anon Key
  const token = getBearerToken(req);
  if (!token) {
    return new Response(
      JSON.stringify({
        error: 'Unauthorized',
        message: 'Autentifikatsiya talab qilinadi. Authorization Bearer token yuborilishi shart.',
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      },
    );
  }

  let authenticatedUserId = null;
  let userRole = 'user';

  if (token === SUPABASE_ANON_KEY) {
    authenticatedUserId = null;
    userRole = 'user';
  } else {
    const { user, error: authError } = await verifyAuth(req);
    if (authError || !user) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          message: "Yaroqsiz yoki muddati o'tgan autentifikatsiya sessiyasi.",
          details: authError,
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        },
      );
    }
    authenticatedUserId = user.id;
    userRole = user.role || 'user';
  }

  // 3. Distributed Rate Limiter (80 req/min for conversational dialogue chunk streaming)
  const rateCheck = await checkRateLimit(req, authenticatedUserId, 80);
  if (!rateCheck.allowed) {
    return new Response(
      JSON.stringify({
        error: 'Too Many Requests',
        message: `TTS so'rovlar tezligi oshdi. Iltimos ${rateCheck.retryAfter} soniyadan so'ng qayta urinib ko'ring.`,
        retryAfter: rateCheck.retryAfter,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Retry-After': String(rateCheck.retryAfter),
        },
      },
    );
  }

  // 4. Input Extraction & Request Size Limit
  let rawText = '';
  let rawLang = 'en';
  let payloadForQuota = '';

  if (req.method === 'POST') {
    let body;
    try {
      payloadForQuota = await req.text();
      body = JSON.parse(payloadForQuota || '{}');
    } catch {
      return new Response(
        JSON.stringify({ error: 'Bad Request', message: 'Yaroqsiz JSON formati.' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        },
      );
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return new Response(
        JSON.stringify({ error: 'Bad Request', message: "Request body ob'ekt bo'lishi shart." }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        },
      );
    }

    rawText = body.text;
    rawLang = body.lang || 'en';
  } else {
    const url = new URL(req.url);
    rawText = url.searchParams.get('text');
    rawLang = url.searchParams.get('lang') || 'en';
    payloadForQuota = rawText || '';
  }

  // 5. Daily AI/TTS Quota Check (evaluated before hitting upstream provider)
  const quotaCheck = await checkDailyQuota(authenticatedUserId, userRole, payloadForQuota);
  if (!quotaCheck.allowed) {
    return new Response(
      JSON.stringify({
        error: 'Quota Exceeded',
        message: quotaCheck.reason,
      }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      },
    );
  }

  // 6. Strict Input Validation
  if (typeof rawText !== 'string') {
    return new Response(
      JSON.stringify({
        error: 'Bad Request',
        message: "Matn (text) maydoni satr (string) bo'lishi shart.",
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      },
    );
  }

  if (rawText.length > 200) {
    return new Response(
      JSON.stringify({
        error: 'Bad Request',
        message: 'Matn uzunligi maksimal 200 belgidan oshmasligi kerak.',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      },
    );
  }

  const cleanText = rawText
    .replace(/[*_#`~[\]()（）]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleanText.length === 0) {
    return new Response(
      JSON.stringify({ error: 'Bad Request', message: "Bo'sh matnni ovozlashtirib bo'lmaydi." }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      },
    );
  }

  if (cleanText.length > 200) {
    return new Response(
      JSON.stringify({
        error: 'Bad Request',
        message: 'Matn uzunligi maksimal 200 belgidan oshmasligi kerak.',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      },
    );
  }

  const validatedLang = normalizeAndValidateLanguage(rawLang);
  if (!validatedLang) {
    return new Response(
      JSON.stringify({
        error: 'Bad Request',
        message: `Qo'llab-quvvatlanmaydigan til: "${String(rawLang).substring(0, 20)}". Ruxsat etilgan tillar: ${Array.from(ALLOWED_LANGUAGES).join(', ')}`,
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      },
    );
  }

  // 7. SSRF-Safe Upstream Request with Timeout (10s)
  const gUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=${encodeURIComponent(validatedLang)}&client=tw-ob`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const upstreamResponse = await fetch(gUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    clearTimeout(timeoutId);

    // 8. Output Validation
    if (!upstreamResponse.ok) {
      return new Response(
        JSON.stringify({
          error: 'Bad Gateway',
          message: "TTS provayderidan audio qabul qilib bo'lmadi.",
        }),
        {
          status: 502,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        },
      );
    }

    const contentType = upstreamResponse.headers.get('content-type') || '';
    if (
      !contentType.includes('audio') &&
      !contentType.includes('mpeg') &&
      !contentType.includes('octet-stream')
    ) {
      return new Response(
        JSON.stringify({
          error: 'Bad Gateway',
          message: 'TTS provayderi yaroqsiz formatdagi javob qaytardi.',
        }),
        {
          status: 502,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        },
      );
    }

    const audioBuffer = await upstreamResponse.arrayBuffer();
    if (!audioBuffer || audioBuffer.byteLength === 0) {
      return new Response(
        JSON.stringify({
          error: 'Bad Gateway',
          message: "TTS provayderi bo'sh audio qaytardi.",
        }),
        {
          status: 502,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        },
      );
    }

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audioBuffer.byteLength),
        'Cache-Control': 'public, max-age=604800, s-maxage=2592000, stale-while-revalidate=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    clearTimeout(timeoutId);

    if (error?.name === 'AbortError' || error?.message?.includes('aborted')) {
      return new Response(
        JSON.stringify({
          error: 'Gateway Timeout',
          message: 'TTS provayderi belgilangan vaqt ichida javob bermadi (10s timeout).',
        }),
        {
          status: 504,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        },
      );
    }

    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message: 'Audio sintez jarayonida server xatoligi yuz berdi.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      },
    );
  }
}
