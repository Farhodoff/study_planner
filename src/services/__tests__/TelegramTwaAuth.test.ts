import { describe, expect, it, vi } from 'vitest';
import crypto from 'crypto';
// @ts-ignore
import twaHandler, { verifyTelegramWebAppData } from '../../../api/_telegram/auth-twa.js';

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              id: 'rec_1',
              user_id: '00000000-0000-0000-0000-000000000001',
              telegram_id: 998877,
              telegram_first_name: 'Farhod',
            },
            error: null,
          }),
          lte: async () => ({ count: 5, error: null }),
        }),
      }),
      update: () => ({
        eq: async () => ({ data: {}, error: null }),
      }),
      insert: async () => ({ data: {}, error: null }),
    }),
  }),
}));

describe('Telegram TWA Auth', () => {
  const mockBotToken = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';

  it('1. correctly validates authentic Telegram WebApp initData', () => {
    const userJson = JSON.stringify({ id: 998877, first_name: 'Farhod', username: 'farhod_dev' });
    const authDate = Math.floor(Date.now() / 1000).toString();

    // Generate valid hash
    const dataCheckString = `auth_date=${authDate}\nuser=${userJson}`;
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(mockBotToken).digest();
    const validHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    const initData = `user=${encodeURIComponent(userJson)}&auth_date=${authDate}&hash=${validHash}`;

    const result = verifyTelegramWebAppData(initData, mockBotToken);
    expect(result.valid).toBe(true);
    expect(result.user?.id).toBe(998877);
    expect(result.user?.first_name).toBe('Farhod');
  });

  it('2. rejects tampered or invalid initData hash', () => {
    const initData = 'user=%7B%22id%22%3A998877%7D&hash=invalid_hash_value_123';
    const result = verifyTelegramWebAppData(initData, mockBotToken);
    expect(result.valid).toBe(false);
  });

  it('3. handles TWA auth HTTP handler and returns user profile and stats', async () => {
    let statusCode = 200;
    let jsonResponse: any = null;

    const res = {
      setHeader: vi.fn(),
      status: (code: number) => {
        statusCode = code;
        return {
          json: (data: any) => {
            jsonResponse = data;
          },
          end: vi.fn(),
        };
      },
    };

    const req = {
      method: 'POST',
      body: {
        mockUser: {
          id: 998877,
          first_name: 'Farhod',
          username: 'farhod_dev',
        },
      },
    };

    await twaHandler(req as any, res as any);

    expect(statusCode).toBe(200);
    expect(jsonResponse.ok).toBe(true);
    expect(jsonResponse.userId).toBe('00000000-0000-0000-0000-000000000001');
    expect(jsonResponse.telegramUser.firstName).toBe('Farhod');
  });
});
