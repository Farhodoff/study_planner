import { createClient } from '@supabase/supabase-js';
import { getRandomBattleQuestion } from './battle-questions.js';
import { sendGroupPoll } from './dispatch-group-battle.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://qmuimxnknxwarvnkpnlo.supabase.co';
const SERVICE_ROLE = process.env.SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const defaultKeyboard = {
  keyboard: [
    [{ text: '🚀 Nihon Talk Mini App', web_app: { url: 'https://nihon-talk.vercel.app/twa' } }],
    [{ text: '📅 Bugungi reja' }, { text: '🎌 Yaponcha Quiz' }],
    [{ text: '📚 Fleshkartalar' }, { text: '🎯 Speaking Mashqi' }],
    [{ text: 'ℹ️ Yordam' }]
  ],
  resize_keyboard: true,
  one_time_keyboard: false
};

async function setTelegramMenuButton(chatId) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return;
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/setChatMenuButton`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        menu_button: {
          type: 'web_app',
          text: 'Nihon Talk',
          web_app: { url: 'https://nihon-talk.vercel.app/twa' }
        }
      })
    });
  } catch (e) {
    console.warn('setChatMenuButton warning:', e.message);
  }
}

const QUIZ_QUESTIONS = [
  {
    id: 1,
    question: "🎌 <b>[JLPT N5] Bo'sh joyni to'ldiring:</b>\n\n毎朝、パン _____ 食べます。\n<i>(Har kuni ertalab non yeyman)</i>",
    options: ['1. を (o)', '2. に (ni)', '3. で (de)', '4. が (ga)'],
    correct: 0,
    explanation: "To'g'ri javob: <b>を (o)</b>\nVositasiz to'ldiruvchi harakat ob'ekti uchun <b>を</b> yuklamasi ishlatiladi (パンを食べます)."
  },
  {
    id: 2,
    question: "🎌 <b>[JLPT N5] Bo'sh joyni to'ldiring:</b>\n\n学校 _____ バスで行きます。\n<i>(Maktabga avtobus bilan boraman)</i>",
    options: ['1. へ (e)', '2. を (o)', '3. と (to)', '4. から (kara)'],
    correct: 0,
    explanation: "To'g'ri javob: <b>へ (e)</b>\nHarakat yo'nalishi va manzil uchun <b>へ (e)</b> yoki <b>に (ni)</b> yuklamasi qo'llaniladi."
  },
  {
    id: 3,
    question: "🎌 <b>[JLPT N4] Ushbu Kanji qanday o'qiladi?</b>\n\n「約束」\n<i>(Ma'nosi: Va'da / Kelishuv)</i>",
    options: ['1. やくそく (yakusoku)', '2. あんない (annai)', '3. しんぱい (shinpai)', '4. れんらく (renraku)'],
    correct: 0,
    explanation: "To'g'ri javob: <b>やくそく (yakusoku)</b>\n「約束」 — va'da, kelishuv degan ma'noni bildiradi."
  },
  {
    id: 4,
    question: "🎌 <b>[JLPT N5] Mos yuklamani tanlang:</b>\n\n昨日、友達 _____ 会いました。\n<i>(Kecha do'stim bilan uchrashdim)</i>",
    options: ['1. に (ni)', '2. を (o)', '3. で (de)', '4. へ (e)'],
    correct: 0,
    explanation: "To'g'ri javob: <b>に (ni)</b>\nYapon tilida 'uchrashmoq' fe'li odatda <b>に</b> bilan birikadi (友達に会う)."
  },
  {
    id: 5,
    question: "🎌 <b>[JLPT N4] Bo'sh joyni to'ldiring:</b>\n\n日本へ行く _____、お金をためています。\n<i>(Yaponiyaga borish maqsadida pul yig'yapman)</i>",
    options: ['1. ために (tameni)', '2. ように (youni)', '3. から (kara)', '4. のに (noni)'],
    correct: 0,
    explanation: "To'g'ri javob: <b>ために (tameni)</b>\nAniq maqsad va niyatni ifodalash uchun fe'lning oddiy shakli + <b>ために</b> ishlatiladi."
  },
  {
    id: 6,
    question: "🎌 <b>[JLPT N3] Bo'sh joyni to'ldiring:</b>\n\n雨が _____ 始めました。\n<i>(Yomg'ir yog'a boshladi)</i>",
    options: ['1. 降り (furi)', '2. 降る (furu)', '3. 降って (futte)', '4. 降れば (fureba)'],
    correct: 0,
    explanation: "To'g'ri javob: <b>降り (furi)</b>\nFe'l o'zagi (masu-stem) + <b>始める (hajimeru)</b> birikmasi harakatning boshlanishini bildiradi (降り始める)."
  }
];

function getQuizMarkup(qIndex) {
  const q = QUIZ_QUESTIONS[qIndex];
  return {
    inline_keyboard: [
      q.options.slice(0, 2).map((opt, i) => ({
        text: opt,
        callback_data: `quiz_${qIndex}_${i}`
      })),
      q.options.slice(2, 4).map((opt, i) => ({
        text: opt,
        callback_data: `quiz_${qIndex}_${i + 2}`
      })),
      [{ text: "🎲 Boshqa savol", callback_data: "quiz_next" }]
    ]
  };
}

async function sendTelegramMessage(chatId, text, replyMarkup = defaultKeyboard) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return { ok: false, error: 'No bot token' };
  const body = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML'
  };
  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function answerCallbackQuery(callbackQueryId, text) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return;
  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Telegram-Bot-Api-Secret-Token');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const update = req.body;
  if (!update) {
    return res.status(200).json({ ok: true, message: 'Empty update' });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    // 0. Handle Group Membership Updates (Bot added to or removed from group)
    if (update.my_chat_member) {
      const mcm = update.my_chat_member;
      const chat = mcm.chat;
      const newStatus = mcm.new_chat_member?.status;
      const isGroup = ['group', 'supergroup'].includes(chat?.type);

      if (isGroup && chat?.id) {
        if (['member', 'administrator'].includes(newStatus)) {
          // Register / activate group in telegram_groups
          await supabase.from('telegram_groups').upsert({
            chat_id: chat.id,
            title: chat.title || 'JLPT Study Group',
            chat_type: chat.type,
            is_active: true,
            interval_hours: 2,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'chat_id' });

          const welcomeText =
            `🎌 <b>JLPT Quiz Battle Guruhga Xush Kelibsiz!</b> ⚔️\n\n` +
            `Men <b>Nihon Talk</b> botiman. Ushbu guruhda talabalar o'rtasida JLPT (N5 - N2) bilimi bo'yicha jonli viktorina boshlandi!\n\n` +
            `⚡ <b>Imkoniyatlar:</b>\n` +
            `• Har 2 soatda bot avtomatik yangi JLPT savolini tashlaydi.\n` +
            `• To'g'ri javob bergan ishtirokchilar <b>+10 XP</b> oladi!\n` +
            `• /top yoki /reyting — guruh yetakchilar reytingi\n` +
            `• /battle yoki /quiz — navbatsiz yangi savol tashlash\n` +
            `• /start_battle va /stop_battle — avto-savollarni yoqish/to'xtatish\n\n` +
            `<i>Birinchi savol quyida yo'llanmoqda, barchaga omad! 🔥</i>`;

          await sendTelegramMessage(chat.id, welcomeText, null);

          // Immediately send 1st Quiz Poll
          const q = getRandomBattleQuestion();
          const pollRes = await sendGroupPoll(chat.id, q.question, q.options, q.correct, q.explanation);
          if (pollRes?.ok && pollRes.result?.poll?.id) {
            await supabase.from('telegram_group_polls').insert({
              poll_id: pollRes.result.poll.id,
              chat_id: chat.id,
              question_id: q.id,
              correct_option_id: q.correct,
              explanation: q.explanation,
              created_at: new Date().toISOString(),
            });

            await supabase
              .from('telegram_groups')
              .update({
                last_quiz_at: new Date().toISOString(),
                total_quizzes_sent: 1,
                updated_at: new Date().toISOString(),
              })
              .eq('chat_id', chat.id);
          }
          return res.status(200).json({ ok: true });
        } else if (['left', 'kicked'].includes(newStatus)) {
          // Deactivate group
          await supabase
            .from('telegram_groups')
            .update({
              is_active: false,
              updated_at: new Date().toISOString(),
            })
            .eq('chat_id', chat.id);
          return res.status(200).json({ ok: true });
        }
      }
      return res.status(200).json({ ok: true });
    }

    // 0.1 Handle Poll Answers (Group Quiz Voting)
    if (update.poll_answer) {
      const pa = update.poll_answer;
      const pollId = pa.poll_id;
      const user = pa.user;
      const chosenOption = pa.option_ids?.[0];

      if (pollId && user && chosenOption !== undefined) {
        // Find matching group poll
        const { data: pollRecord } = await supabase
          .from('telegram_group_polls')
          .select('*')
          .eq('poll_id', pollId)
          .maybeSingle();

        if (pollRecord) {
          const isCorrect = chosenOption === pollRecord.correct_option_id;
          const points = isCorrect ? 10 : 0;
          const userName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || 'Talaba';

          const { data: existingScore } = await supabase
            .from('telegram_group_scores')
            .select('*')
            .eq('chat_id', pollRecord.chat_id)
            .eq('user_id', user.id)
            .maybeSingle();

          if (existingScore) {
            await supabase
              .from('telegram_group_scores')
              .update({
                score: (existingScore.score || 0) + points,
                correct_count: (existingScore.correct_count || 0) + (isCorrect ? 1 : 0),
                total_answered: (existingScore.total_answered || 0) + 1,
                user_name: userName,
                username: user.username || existingScore.username || null,
                last_answered_at: new Date().toISOString(),
              })
              .eq('id', existingScore.id);
          } else {
            await supabase
              .from('telegram_group_scores')
              .insert({
                chat_id: pollRecord.chat_id,
                user_id: user.id,
                user_name: userName,
                username: user.username || null,
                score: points,
                correct_count: isCorrect ? 1 : 0,
                total_answered: 1,
                last_answered_at: new Date().toISOString(),
              });
          }
        }
      }
      return res.status(200).json({ ok: true });
    }

    // 1. Handle Callback Queries (Inline Buttons)
    if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message?.chat?.id;
      const data = cb.data;

      // Handle interactive JLPT Quiz
      if (data && data.startsWith('quiz_')) {
        if (data === 'quiz_next') {
          const nextQIndex = Math.floor(Math.random() * QUIZ_QUESTIONS.length);
          const q = QUIZ_QUESTIONS[nextQIndex];
          await answerCallbackQuery(cb.id, 'Yangi savol yuklanmoqda...');
          await sendTelegramMessage(chatId, q.question, getQuizMarkup(nextQIndex));
          return res.status(200).json({ ok: true });
        }

        const parts = data.split('_');
        const qIdx = parseInt(parts[1], 10);
        const selectedOpt = parseInt(parts[2], 10);
        const q = QUIZ_QUESTIONS[qIdx];

        if (q) {
          const isCorrect = selectedOpt === q.correct;
          const feedbackTitle = isCorrect ? "🎉 <b>TO'G'RI JAVOB!</b>" : "❌ <b>NOTO'G'RI JAVOB!</b>";
          await answerCallbackQuery(cb.id, isCorrect ? "Barakalla! To'g'ri javob! 🎉" : "Noto'g'ri javob! 💡");

          const replyText = `${feedbackTitle}\n\n${q.explanation}\n\n👉 <i>Keyingi savolni ishlash uchun quyidagi tugmani bosing:</i>`;
          const nextMarkup = {
            inline_keyboard: [
              [{ text: "🎲 Keyingi savol ➡️", callback_data: "quiz_next" }],
              [{ text: "🌐 Nihon Talk Webda o'rganish", url: "https://nihon-talk.vercel.app/jlpt" }]
            ]
          };
          await sendTelegramMessage(chatId, replyText, nextMarkup);
          return res.status(200).json({ ok: true });
        }
      }

      await answerCallbackQuery(cb.id);
      return res.status(200).json({ ok: true });
    }

    // 2. Handle Messages
    const message = update.message;
    if (!message || !message.text) {
      return res.status(200).json({ ok: true });
    }

    const chatId = message.chat.id;
    const isGroup = ['group', 'supergroup'].includes(message.chat.type);
    const text = message.text.trim();
    const telegramId = message.from?.id;
    const username = message.from?.username || '';
    const firstName = message.from?.first_name || '';
    const lastName = message.from?.last_name || '';
    const cleanCommand = text.split(' ')[0].toLowerCase().split('@')[0];

    // --- Group JLPT Quiz Battle Commands ---
    // 1. /battle or /quiz in group: Drop native quiz poll
    if (cleanCommand === '/battle' || (isGroup && (cleanCommand === '/quiz' || text.includes('Quiz')))) {
      const q = getRandomBattleQuestion();
      const pollRes = await sendGroupPoll(chatId, q.question, q.options, q.correct, q.explanation);
      if (pollRes?.ok && pollRes.result?.poll?.id) {
        await supabase.from('telegram_group_polls').insert({
          poll_id: pollRes.result.poll.id,
          chat_id: chatId,
          question_id: q.id,
          correct_option_id: q.correct,
          explanation: q.explanation,
          created_at: new Date().toISOString(),
        });

        await supabase.from('telegram_groups').upsert({
          chat_id: chatId,
          title: message.chat.title || 'Guruh',
          chat_type: message.chat.type,
          is_active: true,
          last_quiz_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'chat_id' });
      }
      return res.status(200).json({ ok: true });
    }

    // 2. Leaderboard: /top, /reyting, /leaderboard
    if (cleanCommand === '/top' || cleanCommand === '/reyting' || cleanCommand === '/leaderboard') {
      const { data: topUsers } = await supabase
        .from('telegram_group_scores')
        .select('*')
        .eq('chat_id', chatId)
        .order('score', { ascending: false })
        .order('correct_count', { ascending: false })
        .limit(10);

      if (!topUsers || topUsers.length === 0) {
        await sendTelegramMessage(
          chatId,
          `🏆 <b>Guruh JLPT Quiz Battle Reytingi:</b>\n\nHozircha hech kim savollarga javob bermagan.\nSavol tashlash uchun: /battle\nTo'g'ri javob bering va 1-o'ringa chiqing! ⚔️`,
          null
        );
        return res.status(200).json({ ok: true });
      }

      const medalIcons = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
      const lines = topUsers.map((u, idx) => {
        const medal = medalIcons[idx] || `${idx + 1}.`;
        const name = escapeHTML(u.user_name || (u.username ? `@${u.username}` : 'Talaba'));
        const tag = u.username ? ` (@${escapeHTML(u.username)})` : '';
        const pct = u.total_answered > 0 ? Math.round((u.correct_count / u.total_answered) * 100) : 0;
        return `${medal} <b>${name}</b>${tag}\n    └ <b>${u.score} XP</b> | ${u.correct_count}/${u.total_answered} to'g'ri (${pct}%)`;
      });

      const topText =
        `🏆 <b>Guruh JLPT Quiz Battle — TOP 10 Yetakchilar:</b>\n\n` +
        lines.join('\n\n') +
        `\n\n⚔️ <i>To'g'ri javob: +10 XP</i>\n` +
        `🎲 Yangi savol: /battle`;

      await sendTelegramMessage(chatId, topText, null);
      return res.status(200).json({ ok: true });
    }

    // 3. /start_battle
    if (cleanCommand === '/start_battle') {
      await supabase.from('telegram_groups').upsert({
        chat_id: chatId,
        title: message.chat.title || 'Guruh',
        chat_type: message.chat.type,
        is_active: true,
        interval_hours: 2,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'chat_id' });

      await sendTelegramMessage(
        chatId,
        `⚔️ <b>JLPT Quiz Battle faollashtirildi!</b>\n\n✅ Bot har 2 soatda avtomatik savol tashlab turadi.\n\n• /battle — Navbatsiz yangi savol\n• /top — Guruh reytingi\n• /stop_battle — Avto-savollarni to'xtatish`,
        null
      );
      return res.status(200).json({ ok: true });
    }

    // 4. /stop_battle
    if (cleanCommand === '/stop_battle') {
      await supabase
        .from('telegram_groups')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('chat_id', chatId);

      await sendTelegramMessage(
        chatId,
        `⏸️ <b>JLPT Quiz Battle avtomatik savollari to'xtatildi.</b>\n\nQayta yoqish uchun: /start_battle yozing.`,
        null
      );
      return res.status(200).json({ ok: true });
    }

    // 5. /battle_help or /help in group
    if (cleanCommand === '/battle_help' || (isGroup && (cleanCommand === '/help' || text.includes('Yordam')))) {
      const battleHelpText =
        `⚔️ <b>JLPT Quiz Battle Buyruqlari:</b>\n\n` +
        `• /battle — Yangi JLPT savolini navbatsiz tashlash\n` +
        `• /top yoki /reyting — Guruhning TOP 10 reyting jadvali\n` +
        `• /start_battle — Har 2 soatda avtomatik savol yuborishni yoqish\n` +
        `• /stop_battle — Avtomatik savollarni to'xtatish\n` +
        `• /battle_help — Ushbu yordam xabari\n\n` +
        `🚀 <b>Nihon Talk Mini App:</b> https://nihon-talk.vercel.app/twa`;
      await sendTelegramMessage(chatId, battleHelpText, null);
      return res.status(200).json({ ok: true });
    }

    // 6. In groups, ignore any other text messages quietly to avoid spamming the group
    if (isGroup) {
      return res.status(200).json({ ok: true });
    }

    // A. Handle /start <code> or /start
    if (text.startsWith('/start')) {
      const parts = text.split(' ');
      const code = (parts[1] || '').trim().toUpperCase();

      if (code && code.length === 6) {
        // Find code in telegram_link_codes
        const { data: linkRecord, error: codeErr } = await supabase
          .from('telegram_link_codes')
          .select('*')
          .ilike('code', code)
          .eq('used', false)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();

        if (codeErr || !linkRecord) {
          await sendTelegramMessage(chatId, `❌ <b>Noto'g'ri yoki muddati o'tgan kod!</b>\n\nIltimos, Nihon Talk saytidagi Sozlamalar sahifasidan yangi kod oling:\n<a href="https://nihon-talk.vercel.app/settings">Sozlamalar sahifasiga o'tish</a>`);
          return res.status(200).json({ ok: true });
        }

        // Link user
        await supabase.from('telegram_users').upsert({
          user_id: linkRecord.user_id,
          telegram_id: telegramId,
          chat_id: chatId,
          telegram_username: username,
          telegram_first_name: firstName,
          telegram_last_name: lastName,
          notifications_enabled: true,
          updated_at: new Date().toISOString()
        });

        // Mark code as used
        await supabase.from('telegram_link_codes').update({ used: true }).eq('id', linkRecord.id);

        await sendTelegramMessage(chatId, `🎉 <b>Tabriklaymiz, ${escapeHTML(firstName)}!</b>\n\nTelegram bot Nihon Talk hisobingizga muvaffaqiyatli ulandi! 🚀\n\nEndi siz:\n• Kunlik darslar va vazifalar eslatmalarini olasiz\n• Mini-quizlar orqali yapon tilini mustahkamlaysiz\n• Speaking va fleshkarta natijalaringizni kuzatib borasiz!`, defaultKeyboard);
        return res.status(200).json({ ok: true });
      }

      // Check if already linked
      const { data: existingUser } = await supabase
        .from('telegram_users')
        .select('*')
        .eq('telegram_id', telegramId)
        .maybeSingle();

      await setTelegramMenuButton(chatId);
      const appInlineMarkup = {
        inline_keyboard: [
          [{ text: '🚀 Nihon Talk Mini Appni Ochish', web_app: { url: 'https://nihon-talk.vercel.app/twa' } }]
        ]
      };

      if (existingUser) {
        await sendTelegramMessage(chatId, `👋 <b>Assalomu alaykum, ${escapeHTML(firstName)}!</b>\n\nHisobingiz platformaga ulangan.\n\nTelegram ichida tezkor o'rganish uchun Mini Appni ochishingiz yoki quyidagi menyudan foydalanishingiz mumkin:`, appInlineMarkup);
      } else {
        await sendTelegramMessage(chatId, `👋 <b>Assalomu alaykum!</b>\n\nNihon Talk Telegram botiga xush kelibsiz.\n\nTelegramdan chiqmasdan darslarni boshlash uchun Mini Appni oching yoki saytdagi Sozlamalar bo'limidan kod oling:\n<a href="https://nihon-talk.vercel.app/settings">Nihon Talk Sozlamalar</a>`, appInlineMarkup);
      }
      return res.status(200).json({ ok: true });
    }

    // B. Handle /app or 'Mini App'
    if (text === '/app' || text.includes('Mini App')) {
      await setTelegramMenuButton(chatId);
      const appMarkup = {
        inline_keyboard: [
          [{ text: '🚀 Nihon Talk Mini Appni Ochish', web_app: { url: 'https://nihon-talk.vercel.app/twa' } }]
        ]
      };
      await sendTelegramMessage(
        chatId,
        `📱 <b>Nihon Talk Telegram Mini App:</b>\n\nTelegramdan chiqmasdan yapon tilini o'rganing:\n• 🎴 Kunlik SRS fleshkartalari\n• 🧠 JLPT tezkor testlari\n• 🎙️ 10 daqiqalik Speaking mashqi\n• 🔥 Streak va XP to'plash\n\nIlovani ochish uchun quyidagi tugmani bosing:`,
        appMarkup
      );
      return res.status(200).json({ ok: true });
    }

    // C. Handle /quiz or '🎌 Yaponcha Quiz'
    if (text === '/quiz' || text.includes('Yaponcha Quiz') || text.includes('Quiz')) {
      const randIdx = Math.floor(Math.random() * QUIZ_QUESTIONS.length);
      const q = QUIZ_QUESTIONS[randIdx];
      await sendTelegramMessage(chatId, q.question, getQuizMarkup(randIdx));
      return res.status(200).json({ ok: true });
    }

    // C. Handle /flashcards or '📚 Fleshkartalar'
    if (text === '/flashcards' || text.includes('Fleshkartalar')) {
      const { data: userLink } = await supabase
        .from('telegram_users')
        .select('user_id')
        .eq('telegram_id', telegramId)
        .maybeSingle();

      let cardInfo = "";
      if (userLink?.user_id) {
        const nowIso = new Date().toISOString();
        const { count } = await supabase
          .from('flashcards')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userLink.user_id)
          .lte('next_review', nowIso);

        cardInfo = count && count > 0
          ? `\n\n📌 <b>Sizda bugun takrorlanishi kerak bo'lgan:</b> <code>${count} ta</code> karta mavjud!`
          : `\n\n✨ Barcha kartalar takrorlangan yoki yangi so'zlar qo'shishingiz mumkin!`;
      }

      const flashcardMarkup = {
        inline_keyboard: [
          [{ text: "🎴 Fleshkartalarni Takrorlash", url: "https://nihon-talk.vercel.app/decks" }]
        ]
      };
      await sendTelegramMessage(
        chatId,
        `📚 <b>Nihon Talk Fleshkartalari (SRS Tizimi):</b>\n\nSuperMemo SM-2 algoritmi asosida so'zlar va iyerogliflarni eslab qoling.${cardInfo}\n\nFleshkartalarni o'rganish uchun veb ilovaga kiring:`,
        flashcardMarkup
      );
      return res.status(200).json({ ok: true });
    }

    // D. Handle /speaking or '🎯 Speaking Mashqi'
    if (text === '/speaking' || text.includes('Speaking Mashqi')) {
      const speakingMarkup = {
        inline_keyboard: [
          [{ text: "🎙️ Speaking Coach-ga o'tish", url: "https://nihon-talk.vercel.app/speaking" }]
        ]
      };
      await sendTelegramMessage(
        chatId,
        `🎯 <b>Bugungi Speaking Mashqi (10 daqiqa):</b>\n\nKundalik hayotiy vaziyatlarda yapon tilida gaplashish ko'nikmangizni oshiring:\n• 🛒 Kombinida xarid qilish\n• 🚆 Tokioda metro chiptasi xarid qilish\n• 🏠 Kvartira ijarasi agentligi bilan suhbat\n• 💼 Baito / ish suhbati (Mensetsu)\n\nHar kuni 10 daqiqa jonli gaplashish tilingiz ravonlashishiga yordam beradi! 🚀`,
        speakingMarkup
      );
      return res.status(200).json({ ok: true });
    }

    // E. Handle /plan or '📅 Bugungi reja'
    if (text === '/plan' || text.includes('Bugungi reja') || text === '/tasks') {
      const { data: userLink } = await supabase
        .from('telegram_users')
        .select('user_id')
        .eq('telegram_id', telegramId)
        .maybeSingle();

      if (!userLink?.user_id) {
        await sendTelegramMessage(chatId, "⚠️ <i>Avval akkauntingizni botga ulang: /start kod</i>");
        return res.status(200).json({ ok: true });
      }

      const { data: tasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userLink.user_id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!tasks || tasks.length === 0) {
        await sendTelegramMessage(chatId, `📅 <b>Bugungi rejangiz:</b>\n\nHozircha yangi vazifalar belgilanmagan. Platformaga kirib yangi maqsad qo'shishingiz mumkin:\n<a href="https://nihon-talk.vercel.app/dashboard">Dashboardga o'tish</a>`);
      } else {
        const taskLines = tasks.map((t, idx) => {
          const statusIcon = t.completed ? '✅' : '⏳';
          return `${idx + 1}. ${statusIcon} <b>${escapeHTML(t.title)}</b>`;
        }).join('\n');

        await sendTelegramMessage(chatId, `📋 <b>Sizning vazifalaringiz:</b>\n\n${taskLines}\n\n👉 <a href="https://nihon-talk.vercel.app/tasks">Barcha vazifalarni boshqarish</a>`);
      }
      return res.status(200).json({ ok: true });
    }

    // F. Legacy fallback: /subscription
    if (text === '/subscription' || text.includes('Obuna holati')) {
      await sendTelegramMessage(chatId, `🎁 <b>Nihon Talk 100% Bepul va Ochiq!</b>\n\nPlatformadagi barcha imkoniyatlar (AI Speaking Coach, JLPT Mock Exam, Anki Fleshkartalar, Audio talaffuz) barcha foydalanuvchilar uchun mutlaqo bepul taqdim etiladi! 🚀\n\n🔗 Web sayt: <a href="https://nihon-talk.vercel.app">Nihon Talk Bosh Sahifa</a>`);
      return res.status(200).json({ ok: true });
    }

    // G. Handle /help or 'ℹ️ Yordam'
    if (text === '/help' || text.includes('Yordam')) {
      await sendTelegramMessage(chatId, `ℹ️ <b>Nihon Talk Bot Yordam Qo'llanmasi:</b>\n\n/start - Akkauntni ulash yoki bosh menyu\n/app - Telegram Mini App ilovasini ochish 🚀\n/quiz - Yapon tili bo'yicha interaktiv mini-quiz\n/plan - Bugungi o'quv rejalari va vazifalar\n/flashcards - Fleshkartalar holati va takrorlash\n/speaking - Speaking Coach mashqlari\n/help - Yordam menyusi\n\n🌐 Asosiy veb-sayt: <a href="https://nihon-talk.vercel.app">Nihon Talk Platformasi</a>`);
      return res.status(200).json({ ok: true });
    }

    // Default fallback
    await sendTelegramMessage(chatId, `Tushunarsiz buyruq. Quyidagi menyu tugmalaridan birini tanlang yoki /help yozing:`, defaultKeyboard);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Telegram webhook error:', err);
    return res.status(200).json({ ok: false, error: err?.message });
  }
}
