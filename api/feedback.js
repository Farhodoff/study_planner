import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from './_auth.js';
import { checkRateLimit } from './_rateLimit.js';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://qmuimxnknxwarvnkpnlo.supabase.co';
const SERVICE_ROLE = process.env.SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Primary superadmin contact for feedback notifications
const admin = 6756073816; // Superadmin Farhod Soyilov (@Soyilov_Farhod)
const SUPERADMIN_EMAIL = 'fsoyilov@gmail.com';
const FALLBACK_SUPERADMIN_CHAT_ID = admin;
// Explicit exclusion of non-admin student/test chat IDs to prevent feedback broadcast
const EXCLUDED_NON_ADMIN_CHAT_IDS = new Set([6839776532]);

function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getRatingStars(rating) {
  const r = Math.min(Math.max(Number(rating) || 5, 1), 5);
  const stars = '⭐️'.repeat(r) + '☆'.repeat(5 - r);
  const labels = {
    5: 'Ajoyib! (5/5)',
    4: 'Yaxshi (4/5)',
    3: "O'rtacha (3/5)",
    2: 'Qoniqarsiz (2/5)',
    1: 'Yomon (1/5)',
  };
  return `${stars} <b>${labels[r] || `${r}/5`}</b>`;
}

async function sendTelegramMessage(chatId, text) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn('[Feedback] TELEGRAM_BOT_TOKEN is missing');
    return { ok: false, error: 'Bot token missing' };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    return await res.json();
  } catch (err) {
    console.error(`[Feedback] Failed to send Telegram message to chat ${chatId}:`, err?.message);
    return { ok: false, error: err?.message };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Rate limiting check
  const rateLimit = await checkRateLimit(req);
  if (!rateLimit.allowed) {
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'Iltimos, biroz kutib qayta urinib ko‘ring.',
      retryAfter: rateLimit.retryAfter,
    });
  }

  // 2. Parse and validate input
  const body = req.body || {};
  const rawRating = Number(body.rating);

  if (isNaN(rawRating) || rawRating < 1 || rawRating > 5) {
    return res.status(400).json({ error: 'Baho 1 va 5 oralig‘ida bo‘lishi shart.' });
  }

  const rating = Math.round(rawRating);
  const comment = typeof body.comment === 'string' ? body.comment.trim().substring(0, 2000) : '';
  const category =
    typeof body.category === 'string' ? body.category.trim().substring(0, 50) : 'general';
  const clientUserInfo = body.userInfo && typeof body.userInfo === 'object' ? body.userInfo : {};
  const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : {};

  // 3. Optional Auth check
  let authUserId = null;
  let authEmail = null;
  try {
    const { user } = await verifyAuth(req);
    if (user?.id) {
      authUserId = user.id;
      authEmail = user.email;
    }
  } catch {
    // Guest user is permitted to leave feedback
  }

  const userId = authUserId || clientUserInfo.id || null;
  const userEmail = authEmail || clientUserInfo.email || null;
  const userName = clientUserInfo.name || 'Mehmon (Anonim)';
  const telegramUsername = clientUserInfo.telegramUsername || null;

  // 4. Save to Supabase (app_reviews table) if SERVICE_ROLE configured
  if (SERVICE_ROLE) {
    try {
      const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
      await supabase.from('app_reviews').insert({
        user_id: userId,
        rating,
        comment: comment || null,
        category,
        user_name: userName,
        user_email: userEmail,
        telegram_username: telegramUsername,
        metadata: {
          ...metadata,
          submitted_at: new Date().toISOString(),
        },
      });
    } catch (dbErr) {
      console.warn('[Feedback] Could not write to app_reviews table:', dbErr?.message);
    }
  }

  // 5. Gather Telegram Admin Chat IDs (Strictly Superadmin only)
  const targetChatIds = new Set();

  // If env variable TELEGRAM_ADMIN_CHAT_ID is present, add it if valid and not excluded
  if (process.env.TELEGRAM_ADMIN_CHAT_ID) {
    const envIds = process.env.TELEGRAM_ADMIN_CHAT_ID.split(',').map((id) => id.trim());
    for (const id of envIds) {
      const numId = Number(id);
      if (!isNaN(numId) && numId > 0 && !EXCLUDED_NON_ADMIN_CHAT_IDS.has(numId)) {
        targetChatIds.add(numId);
      }
    }
  }

  // Query database strictly for the verified superadmin (fsoyilov@gmail.com / role=superadmin)
  if (SERVICE_ROLE) {
    try {
      const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
      const { data: adminProfiles } = await supabase
        .from('profiles')
        .select('id, email, role')
        .or(`email.eq.${SUPERADMIN_EMAIL},role.eq.superadmin`);

      if (adminProfiles && adminProfiles.length > 0) {
        const verifiedAdminIds = adminProfiles
          .filter(
            (p) =>
              p.email?.toLowerCase().trim() === SUPERADMIN_EMAIL.toLowerCase() ||
              p.role === 'superadmin',
          )
          .map((p) => p.id);

        if (verifiedAdminIds.length > 0) {
          const { data: telegramAdmins } = await supabase
            .from('telegram_users')
            .select('chat_id')
            .in('user_id', verifiedAdminIds);

          if (telegramAdmins && telegramAdmins.length > 0) {
            for (const ta of telegramAdmins) {
              const numId = Number(ta.chat_id);
              if (!isNaN(numId) && numId > 0 && !EXCLUDED_NON_ADMIN_CHAT_IDS.has(numId)) {
                targetChatIds.add(numId);
              }
            }
          }
        }
      }
    } catch (queryErr) {
      console.warn('[Feedback] Superadmin lookup warning:', queryErr?.message);
    }
  }

  // Fallback: strictly default to verified superadmin chat ID if none resolved
  if (targetChatIds.size === 0) {
    targetChatIds.add(admin);
  }

  // 6. Format Telegram Notification Message
  const tashkentTime = new Intl.DateTimeFormat('uz-UZ', {
    timeZone: 'Asia/Tashkent',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date());

  const platformStr = metadata.platform || (metadata.isMobile ? '📱 Mobile' : '💻 Desktop Web');
  const pathStr = metadata.url || metadata.path || '/';

  let tgMessage = `🌟 <b>YANGI FOYDALANUVCHI REYTINGI VA FIKRI</b> 🌟\n\n`;
  tgMessage += `⭐️ <b>Baho:</b> ${getRatingStars(rating)}\n`;

  if (comment) {
    tgMessage += `\n💬 <b>Fikr-mulohaza:</b>\n<i>"${escapeHTML(comment)}"</i>\n`;
  } else {
    tgMessage += `\n💬 <b>Fikr-mulohaza:</b> <i>(Matn qoldirilmadi)</i>\n`;
  }

  tgMessage += `\n👤 <b>Foydalanuvchi:</b>`;
  tgMessage += `\n• <b>Ism:</b> ${escapeHTML(userName)}`;
  if (userEmail) tgMessage += `\n• <b>Email:</b> ${escapeHTML(userEmail)}`;
  if (telegramUsername)
    tgMessage += `\n• <b>Telegram:</b> @${escapeHTML(telegramUsername.replace(/^@/, ''))}`;
  if (userId) tgMessage += `\n• <b>ID:</b> <code>${escapeHTML(userId)}</code>`;

  tgMessage += `\n\n📱 <b>Kontekst / Qurilma:</b>`;
  tgMessage += `\n• <b>Platforma:</b> ${escapeHTML(platformStr)}`;
  tgMessage += `\n• <b>Sahifa:</b> ${escapeHTML(pathStr)}`;
  tgMessage += `\n• <b>Vaqt:</b> ${tashkentTime} (Toshkent)`;

  // 7. Dispatch Telegram messages in parallel
  const sendPromises = Array.from(targetChatIds).map((chatId) =>
    sendTelegramMessage(chatId, tgMessage),
  );
  await Promise.allSettled(sendPromises);

  return res.status(200).json({
    success: true,
    message: 'Fikr va bahoingiz uchun katta rahmat!',
  });
}
