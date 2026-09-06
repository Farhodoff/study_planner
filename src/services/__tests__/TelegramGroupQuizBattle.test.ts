import { describe, it, expect, vi, beforeEach } from 'vitest';
// @ts-expect-error JavaScript serverless handler import
import webhookHandler from '../../../api/_telegram/webhook.js';
// @ts-expect-error JavaScript serverless handler import
import dispatchGroupBattleHandler, {
  sendGroupPoll,
} from '../../../api/_telegram/dispatch-group-battle.js';
// @ts-expect-error JavaScript questions bank import
import {
  BATTLE_QUESTIONS,
  getRandomBattleQuestion,
} from '../../../api/_telegram/battle-questions.js';

// In-memory mock DB state for tests
let mockGroups: Record<string, any> = {};
let mockPolls: Record<string, any> = {};
let mockScores: Record<string, any> = {};

vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn(() => ({
      from: vi.fn((table: string) => {
        if (table === 'telegram_groups') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation((col: string, val: any) => {
              return {
                maybeSingle: vi.fn().mockResolvedValue({
                  data: Object.values(mockGroups).find((g: any) => g[col] === val) || null,
                  error: null,
                }),
                then: (resolve: any) =>
                  resolve({
                    data: Object.values(mockGroups).filter((g: any) => g[col] === val),
                    error: null,
                  }),
              };
            }),
            upsert: vi.fn().mockImplementation(async (record: any) => {
              mockGroups[record.chat_id] = { ...mockGroups[record.chat_id], ...record };
              return { data: mockGroups[record.chat_id], error: null };
            }),
            update: vi.fn().mockImplementation((record: any) => ({
              eq: vi.fn().mockImplementation(async (_col: string, val: any) => {
                if (mockGroups[val]) {
                  mockGroups[val] = { ...mockGroups[val], ...record };
                }
                return { data: mockGroups[val], error: null };
              }),
            })),
          };
        }

        if (table === 'telegram_group_polls') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation((col: string, val: any) => ({
              maybeSingle: vi.fn().mockImplementation(async () => {
                const found = Object.values(mockPolls).find((p: any) => p[col] === val);
                return { data: found || null, error: null };
              }),
            })),
            insert: vi.fn().mockImplementation(async (record: any) => {
              mockPolls[record.poll_id] = record;
              return { data: record, error: null };
            }),
          };
        }

        if (table === 'telegram_group_scores') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation((col1: string, val1: any) => ({
              eq: vi.fn().mockImplementation((_col2: string, val2: any) => ({
                maybeSingle: vi.fn().mockImplementation(async () => {
                  const key = `${val1}_${val2}`;
                  return { data: mockScores[key] || null, error: null };
                }),
              })),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockImplementation(async () => {
                const list = Object.values(mockScores).filter((s: any) => s[col1] === val1);
                list.sort(
                  (a: any, b: any) => b.score - a.score || b.correct_count - a.correct_count,
                );
                return { data: list, error: null };
              }),
            })),
            insert: vi.fn().mockImplementation(async (record: any) => {
              const key = `${record.chat_id}_${record.user_id}`;
              const newRec = { id: `score_${Date.now()}`, ...record };
              mockScores[key] = newRec;
              return { data: newRec, error: null };
            }),
            update: vi.fn().mockImplementation((record: any) => ({
              eq: vi.fn().mockImplementation(async (_col: string, id: string) => {
                const key = Object.keys(mockScores).find((k) => mockScores[k].id === id);
                if (key) {
                  mockScores[key] = { ...mockScores[key], ...record };
                }
                return { error: null };
              }),
            })),
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

describe('Telegram Group Quiz Battle System', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    mockGroups = {};
    mockPolls = {};
    mockScores = {};
    process.env = {
      ...originalEnv,
      TELEGRAM_BOT_TOKEN: 'mock_test_token_123',
      SERVICE_ROLE: 'mock_service_role',
    };
    global.fetch = vi.fn().mockImplementation(async (url: string, init: any) => {
      const body = init?.body ? JSON.parse(init.body) : {};
      if (url.includes('/sendPoll')) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            result: {
              poll: {
                id: `poll_${Date.now()}`,
                question: body.question,
                options: body.options,
                total_voter_count: 0,
                is_closed: false,
                is_anonymous: false,
                type: 'quiz',
                correct_option_id: body.correct_option_id,
              },
            },
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({ ok: true, result: { message_id: 999 } }),
      };
    }) as any;
  });

  describe('1. Battle Questions Bank', () => {
    it('contains at least 20 curated JLPT questions', () => {
      expect(BATTLE_QUESTIONS.length).toBeGreaterThanOrEqual(20);
    });

    it('each question conforms to Telegram quiz specifications', () => {
      BATTLE_QUESTIONS.forEach((q: any) => {
        expect(q.id).toBeDefined();
        expect(q.question.length).toBeGreaterThan(0);
        expect(q.question.length).toBeLessThanOrEqual(300);
        expect(q.options.length).toBeGreaterThanOrEqual(2);
        expect(q.options.length).toBeLessThanOrEqual(10);
        expect(q.correct).toBeGreaterThanOrEqual(0);
        expect(q.correct).toBeLessThan(q.options.length);
        if (q.explanation) {
          expect(q.explanation.length).toBeLessThanOrEqual(200);
        }
      });
    });

    it('getRandomBattleQuestion picks a question and respects exclusion pool', () => {
      const q = getRandomBattleQuestion();
      expect(q).toBeDefined();
      expect(q.question).toBeDefined();

      const qExcluded = getRandomBattleQuestion([1, 2, 3, 4, 5]);
      expect([1, 2, 3, 4, 5]).not.toContain(qExcluded.id);
    });
  });

  describe('2. sendGroupPoll helper', () => {
    it('sends non-anonymous quiz poll with correct parameters', async () => {
      const res = await sendGroupPoll(
        -100123456789,
        'Question test?',
        ['Option A', 'Option B'],
        0,
        'Explanation test',
      );
      expect(res.ok).toBe(true);
      expect(res.result.poll.type).toBe('quiz');
      expect(res.result.poll.is_anonymous).toBe(false);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/sendPoll'),
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });
  });

  describe('3. Webhook: Group Membership (my_chat_member)', () => {
    it('registers group and sends welcome + 1st quiz poll when bot is added', async () => {
      const req = {
        method: 'POST',
        body: {
          update_id: 1,
          my_chat_member: {
            chat: { id: -100999, title: 'Nihongo Study Club', type: 'supergroup' },
            new_chat_member: { status: 'member' },
          },
        },
      };
      const res = {
        setHeader: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await webhookHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockGroups['-100999']).toBeDefined();
      expect(mockGroups['-100999'].is_active).toBe(true);
      expect(mockGroups['-100999'].total_quizzes_sent).toBe(1);

      // Verify poll was recorded in telegram_group_polls
      const recordedPolls = Object.values(mockPolls);
      expect(recordedPolls.length).toBe(1);
      expect(recordedPolls[0].chat_id).toBe(-100999);
    });

    it('deactivates group when bot is kicked or leaves', async () => {
      mockGroups['-100999'] = { chat_id: -100999, is_active: true };

      const req = {
        method: 'POST',
        body: {
          update_id: 2,
          my_chat_member: {
            chat: { id: -100999, title: 'Nihongo Study Club', type: 'supergroup' },
            new_chat_member: { status: 'kicked' },
          },
        },
      };
      const res = {
        setHeader: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await webhookHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockGroups['-100999'].is_active).toBe(false);
    });
  });

  describe('4. Webhook: Poll Answer Voting & Scoring', () => {
    it('awards +10 XP for correct quiz answer', async () => {
      // Seed a poll in DB
      mockPolls['test_poll_1'] = {
        poll_id: 'test_poll_1',
        chat_id: -100999,
        question_id: 1,
        correct_option_id: 2,
      };

      const req = {
        method: 'POST',
        body: {
          update_id: 3,
          poll_answer: {
            poll_id: 'test_poll_1',
            user: { id: 777001, first_name: 'Akbar', username: 'akbar_nihon' },
            option_ids: [2], // Correct!
          },
        },
      };
      const res = {
        setHeader: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await webhookHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const userScore = mockScores['-100999_777001'];
      expect(userScore).toBeDefined();
      expect(userScore.score).toBe(10);
      expect(userScore.correct_count).toBe(1);
      expect(userScore.total_answered).toBe(1);
      expect(userScore.user_name).toBe('Akbar');
    });

    it('awards 0 XP for incorrect quiz answer but records total answered', async () => {
      mockPolls['test_poll_2'] = {
        poll_id: 'test_poll_2',
        chat_id: -100999,
        question_id: 1,
        correct_option_id: 2,
      };

      const req = {
        method: 'POST',
        body: {
          update_id: 4,
          poll_answer: {
            poll_id: 'test_poll_2',
            user: { id: 777002, first_name: 'Jasur' },
            option_ids: [0], // Incorrect!
          },
        },
      };
      const res = {
        setHeader: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await webhookHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const userScore = mockScores['-100999_777002'];
      expect(userScore).toBeDefined();
      expect(userScore.score).toBe(0);
      expect(userScore.correct_count).toBe(0);
      expect(userScore.total_answered).toBe(1);
    });
  });

  describe('5. Webhook: Group Battle Commands', () => {
    it('handles /battle by sending a new quiz poll and registering group', async () => {
      const req = {
        method: 'POST',
        body: {
          update_id: 5,
          message: {
            chat: { id: -100888, type: 'supergroup', title: 'Toshkent JLPT Guruh' },
            from: { id: 777001, first_name: 'Akbar' },
            text: '/battle@study_plannerr_bot',
          },
        },
      };
      const res = {
        setHeader: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await webhookHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockGroups['-100888']).toBeDefined();
      expect(mockGroups['-100888'].is_active).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/sendPoll'),
        expect.any(Object),
      );
    });

    it('handles /top with formatted leaderboard', async () => {
      // Seed some scores
      mockScores['-100888_1'] = {
        id: 's1',
        chat_id: -100888,
        user_id: 1,
        user_name: 'Sherzod',
        username: 'sher_jp',
        score: 50,
        correct_count: 5,
        total_answered: 5,
      };
      mockScores['-100888_2'] = {
        id: 's2',
        chat_id: -100888,
        user_id: 2,
        user_name: 'Madina',
        username: 'madina_tokyo',
        score: 30,
        correct_count: 3,
        total_answered: 4,
      };

      const req = {
        method: 'POST',
        body: {
          update_id: 6,
          message: {
            chat: { id: -100888, type: 'supergroup' },
            from: { id: 1 },
            text: '/top',
          },
        },
      };
      const res = {
        setHeader: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await webhookHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/sendMessage'),
        expect.objectContaining({
          body: expect.stringContaining('TOP 10 Yetakchilar'),
        }),
      );
    });

    it('silently ignores non-command chatter in groups without spamming', async () => {
      const req = {
        method: 'POST',
        body: {
          update_id: 7,
          message: {
            chat: { id: -100888, type: 'supergroup' },
            from: { id: 1 },
            text: 'Salom bolalar, bugun dars nechida?',
          },
        },
      };
      const res = {
        setHeader: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      const fetchCountBefore = (global.fetch as any).mock.calls.length;
      await webhookHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      // No message sent to the group!
      expect((global.fetch as any).mock.calls.length).toBe(fetchCountBefore);
    });
  });

  describe('6. Automatic Dispatcher: dispatchGroupBattleHandler', () => {
    it('dispatches polls to active groups past the 2-hour interval', async () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 3600000).toISOString();
      mockGroups['-100111'] = {
        chat_id: -100111,
        title: 'Auto Quiz Group',
        is_active: true,
        interval_hours: 2,
        last_quiz_at: threeHoursAgo,
        total_quizzes_sent: 5,
      };

      const req = {
        method: 'POST',
        headers: {},
      };
      const res = {
        setHeader: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await dispatchGroupBattleHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ok: true,
          dispatched: 1,
        }),
      );
      expect(mockGroups['-100111'].total_quizzes_sent).toBe(6);
    });
  });
});
