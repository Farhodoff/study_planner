import { describe, it, expect, vi, beforeEach } from 'vitest';
// @ts-expect-error JavaScript serverless handler import
import webhookHandler from '../../../api/_telegram/webhook.js';
// @ts-expect-error JavaScript serverless handler import
import notifyDailyHandler from '../../../api/_telegram/notify-daily.js';
import telegramService from '../TelegramService';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn(() => ({
      from: vi.fn((table: string) => {
        if (table === 'telegram_link_codes') {
          return {
            select: vi.fn().mockReturnThis(),
            ilike: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gt: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockImplementation(async () => {
              return {
                data: {
                  id: 'code_rec_123',
                  code: 'KAIZ01',
                  user_id: 'user_uuid_123',
                  used: false,
                  expires_at: new Date(Date.now() + 3600000).toISOString(),
                },
                error: null,
              };
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }

        if (table === 'telegram_users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockImplementation(async () => {
              return {
                data: {
                  id: 'tg_user_1',
                  user_id: 'user_uuid_123',
                  telegram_id: 998877,
                  chat_id: 998877,
                  telegram_first_name: 'Farhod',
                  notifications_enabled: true,
                },
                error: null,
              };
            }),
            upsert: vi.fn().mockResolvedValue({ error: null }),
          };
        }

        if (table === 'user_subscriptions') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockImplementation(async () => {
              return {
                data: {
                  id: 'user_uuid_123',
                  tier: 'pro',
                  ai_credits: 250,
                  valid_until: new Date(Date.now() + 86400000 * 2).toISOString(), // 2 days left
                },
                error: null,
              };
            }),
          };
        }

        if (table === 'tasks') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockImplementation(async () => {
              return {
                data: [
                  { id: 'task_1', title: 'JLPT N3 Kanji 20 cards', completed: false },
                  { id: 'task_2', title: 'Speaking Coach IELTS Part 2', completed: true },
                ],
                error: null,
              };
            }),
          };
        }

        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }),
    })),
  };
});

// Helper mock response
function createMockRes() {
  const res: any = {
    headers: {},
    statusCode: 200,
    setHeader: (k: string, v: string) => {
      res.headers[k] = v;
    },
    status: (s: number) => {
      res.statusCode = s;
      return res;
    },
    json: (d: any) => {
      res.data = d;
      return res;
    },
    end: () => res,
  };
  return res;
}

describe('Telegram Webhook & Notifications End-to-End Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TELEGRAM_BOT_TOKEN = '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ';
    process.env.SERVICE_ROLE = 'mock-service-role-key';
    process.env.VITE_SUPABASE_URL = 'https://qmuimxnknxwarvnkpnlo.supabase.co';
    // Mock global fetch for Telegram API
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 101 } }),
    } as any);
  });

  it('1. handles OPTIONS preflight and non-POST methods correctly', async () => {
    const optionsRes = createMockRes();
    await webhookHandler({ method: 'OPTIONS', headers: {} } as any, optionsRes);
    expect(optionsRes.statusCode).toBe(204);

    const getRes = createMockRes();
    await webhookHandler({ method: 'GET', headers: {} } as any, getRes);
    expect(getRes.statusCode).toBe(405);
  });

  it('2. verifies account linking when user submits /start KAIZ01', async () => {
    const res = createMockRes();
    const req = {
      method: 'POST',
      headers: {},
      body: {
        message: {
          message_id: 1,
          chat: { id: 998877 },
          from: { id: 998877, first_name: 'Farhod', username: 'farhod_dev' },
          text: '/start KAIZ01',
        },
      },
    };

    await webhookHandler(req as any, res);
    expect(res.statusCode).toBe(200);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('sendMessage'),
      expect.objectContaining({
        body: expect.stringContaining('Tabriklaymiz, Farhod!'),
      }),
    );
  });

  it('3. responds with subscription status when user requests /subscription', async () => {
    const res = createMockRes();
    const req = {
      method: 'POST',
      headers: {},
      body: {
        message: {
          message_id: 2,
          chat: { id: 998877 },
          from: { id: 998877, first_name: 'Farhod' },
          text: '/subscription',
        },
      },
    };

    await webhookHandler(req as any, res);
    expect(res.statusCode).toBe(200);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('sendMessage'),
      expect.objectContaining({
        body: expect.stringContaining('100% Bepul'),
      }),
    );
  });

  it('4. responds with active tasks when user requests /plan', async () => {
    const res = createMockRes();
    const req = {
      method: 'POST',
      headers: {},
      body: {
        message: {
          message_id: 3,
          chat: { id: 998877 },
          from: { id: 998877, first_name: 'Farhod' },
          text: '/plan',
        },
      },
    };

    await webhookHandler(req as any, res);
    expect(res.statusCode).toBe(200);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('sendMessage'),
      expect.objectContaining({
        body: expect.stringContaining('JLPT N3 Kanji 20 cards'),
      }),
    );
  });

  it('5. handles interactive quiz callback queries', async () => {
    const res = createMockRes();
    const req = {
      method: 'POST',
      headers: {},
      body: {
        callback_query: {
          id: 'cb_query_1',
          data: 'quiz_0_0',
          message: {
            chat: { id: 998877 },
          },
        },
      },
    };

    await webhookHandler(req as any, res);
    expect(res.statusCode).toBe(200);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('answerCallbackQuery'),
      expect.any(Object),
    );
  });

  it('6. formats study reminders and subscription alerts via TelegramService', async () => {
    const reminderSpy = vi.spyOn(telegramService, 'sendNotification').mockResolvedValue(true);

    const okReminder = await telegramService.sendStudyReminder(
      '00000000-0000-0000-0000-000000000001',
      3,
      5,
    );
    expect(okReminder).toBe(true);
    expect(reminderSpy).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000001',
      expect.stringContaining('5 kun'),
    );

    const okAlert = await telegramService.sendSubscriptionAlert(
      '00000000-0000-0000-0000-000000000001',
      'pro',
      2,
    );
    expect(okAlert).toBe(true);
    expect(reminderSpy).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000001',
      expect.stringContaining('PRO'),
    );
  });

  it('7. dispatches daily notifications to linked users via notify-daily handler', async () => {
    const res = createMockRes();
    const req = {
      method: 'POST',
      headers: {},
    };

    await notifyDailyHandler(req as any, res);
    expect(res.statusCode).toBe(200);
    expect(res.data).toMatchObject({ success: true });
  });
});
