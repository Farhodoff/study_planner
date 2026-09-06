import { describe, it, expect, vi, beforeEach } from 'vitest';

// We import the serverless handler
// @ts-expect-error - api/feedback.js is an ES module outside src
import feedbackHandler from '../../../api/feedback.js';

describe('Feedback Telegram Routing (api/feedback.js)', () => {
  const globalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createMockRes() {
    const res: any = {
      statusCode: 200,
      headers: {},
      body: null,
      setHeader(k: string, v: string) {
        res.headers[k] = v;
      },
      status(code: number) {
        res.statusCode = code;
        return res;
      },
      json(data: any) {
        res.body = data;
        return res;
      },
      end() {
        return res;
      },
    };
    return res;
  }

  it('rejects non-POST HTTP methods with 405', async () => {
    const req: any = { method: 'GET' };
    const res = createMockRes();

    await feedbackHandler(req, res);
    expect(res.statusCode).toBe(405);
    expect(res.body).toEqual({ error: 'Method not allowed' });
  });

  it('rejects invalid rating values with 400', async () => {
    const req: any = {
      method: 'POST',
      body: { rating: 6, comment: 'Too high' },
    };
    const res = createMockRes();

    await feedbackHandler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Baho 1 va 5 oralig‘ida bo‘lishi shart');
  });

  it('strictly dispatches Telegram message ONLY to superadmin (6756073816), excluding non-admin chats', async () => {
    const sentMessages: Array<{ chatId: number; text: string }> = [];

    // Mock global fetch to capture telegram sendMessage calls
    global.fetch = vi.fn().mockImplementation(async (url: string, options: any) => {
      if (url.includes('api.telegram.org')) {
        const payload = JSON.parse(options.body);
        sentMessages.push({
          chatId: payload.chat_id,
          text: payload.text,
        });
        return {
          ok: true,
          json: async () => ({ ok: true, result: { message_id: 123 } }),
        };
      }
      return { ok: true, json: async () => ({}) };
    }) as any;

    process.env.TELEGRAM_BOT_TOKEN = 'test_token';
    // Ensure excluded non-admin ID (6839776532) in env or lookup is NEVER delivered
    process.env.TELEGRAM_ADMIN_CHAT_ID = '6839776532, 6756073816';

    const req: any = {
      method: 'POST',
      body: {
        rating: 5,
        comment: 'Ajoyib dastur!',
        category: 'general',
        userInfo: {
          name: 'Test Foydalanuvchi',
          email: 'test@example.com',
        },
        metadata: {
          platform: 'Mobile Web',
          url: '/speaking-coach',
        },
      },
    };
    const res = createMockRes();

    await feedbackHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify sent messages
    const recipientIds = sentMessages.map((m) => m.chatId);
    expect(recipientIds).toContain(6756073816); // Superadmin MUST receive it
    expect(recipientIds).not.toContain(6839776532); // Non-admin account MUST NEVER receive it

    // Verify formatting includes the rating and comment
    const adminMsg = sentMessages.find((m) => m.chatId === 6756073816);
    expect(adminMsg?.text).toContain('YANGI FOYDALANUVCHI REYTINGI VA FIKRI');
    expect(adminMsg?.text).toContain('Ajoyib dastur!');
    expect(adminMsg?.text).toContain('Test Foydalanuvchi');

    // Restore fetch and env
    global.fetch = globalFetch;
    delete process.env.TELEGRAM_ADMIN_CHAT_ID;
  });
});
