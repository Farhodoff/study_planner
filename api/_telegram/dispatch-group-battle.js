import { createClient } from '@supabase/supabase-js';
import { getRandomBattleQuestion } from './battle-questions.js';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://qmuimxnknxwarvnkpnlo.supabase.co';
const SERVICE_ROLE = process.env.SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function sendGroupPoll(chatId, question, options, correctOptionId, explanation) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return { ok: false, error: 'No bot token' };

  const body = {
    chat_id: chatId,
    question: question.slice(0, 300),
    options: options.map((opt) => (typeof opt === 'string' ? opt : String(opt)).slice(0, 100)),
    type: 'quiz',
    correct_option_id: correctOptionId,
    explanation: explanation ? explanation.slice(0, 200) : undefined,
    is_anonymous: false, // Must be false so poll_answer contains user details
  };

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPoll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return res.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const serviceRole = process.env.SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || SERVICE_ROLE;
  if (!serviceRole) {
    return res.status(500).json({ error: 'Missing service role key' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL;
  const supabase = createClient(supabaseUrl, serviceRole);

  try {
    // 1. Fetch active groups
    const { data: groups, error: groupErr } = await supabase
      .from('telegram_groups')
      .select('*')
      .eq('is_active', true);

    if (groupErr) {
      console.error('Failed to fetch telegram groups:', groupErr);
      return res.status(500).json({ error: groupErr.message });
    }

    if (!groups || groups.length === 0) {
      return res.status(200).json({ ok: true, message: 'No active groups', dispatched: 0 });
    }

    const now = Date.now();
    let dispatched = 0;
    const results = [];

    for (const group of groups) {
      const intervalHours = group.interval_hours || 2;
      const intervalMs = intervalHours * 60 * 60 * 1000;
      const lastQuizTime = group.last_quiz_at ? new Date(group.last_quiz_at).getTime() : 0;

      // Check if interval has passed
      if (now - lastQuizTime >= intervalMs) {
        const q = getRandomBattleQuestion();
        const pollRes = await sendGroupPoll(
          group.chat_id,
          q.question,
          q.options,
          q.correct,
          q.explanation,
        );

        if (pollRes?.ok && pollRes.result?.poll?.id) {
          const pollId = pollRes.result.poll.id;

          // Record active poll in DB
          await supabase.from('telegram_group_polls').insert({
            poll_id: pollId,
            chat_id: group.chat_id,
            question_id: q.id,
            correct_option_id: q.correct,
            explanation: q.explanation,
            created_at: new Date().toISOString(),
          });

          // Update group stats
          await supabase
            .from('telegram_groups')
            .update({
              last_quiz_at: new Date().toISOString(),
              total_quizzes_sent: (group.total_quizzes_sent || 0) + 1,
              updated_at: new Date().toISOString(),
            })
            .eq('chat_id', group.chat_id);

          dispatched++;
          results.push({ chat_id: group.chat_id, title: group.title, ok: true, poll_id: pollId });
        } else {
          results.push({
            chat_id: group.chat_id,
            title: group.title,
            ok: false,
            error: pollRes?.description || 'Poll send error',
          });
        }
      }
    }

    return res.status(200).json({
      ok: true,
      total_active_groups: groups.length,
      dispatched,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Group battle dispatcher exception:', err);
    return res.status(500).json({ error: err.message });
  }
}
