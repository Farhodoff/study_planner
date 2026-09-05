/**
 * P0 security regression tests (2026-08-24 audit).
 *
 * 1. /api/telegram/* must never authenticate a caller from a body-supplied
 *    userId — the pre-fix code fell back to req.body.userId when the JWT was
 *    missing, letting unauthenticated attackers act on arbitrary accounts.
 * 2. The P0 RLS migration must keep the fixed policies (owner-scoped telegram
 *    tables, RLS on user_subscriptions/app_settings).
 * 3. The shared admin Gemini key must not be fetched into localStorage.
 */
/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

type Handler = (req: any, res: any) => Promise<any>;

const projectRoot = path.resolve(__dirname, '../../..');

function createRes() {
  const res: any = {
    statusCode: 0,
    body: undefined,
    setHeader(_k: string, _v: string) {
      return res;
    },
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
    end() {
      return res;
    },
  };
  return res;
}

const VICTIM_UUID = '99a2f2c1-3fa0-477e-b73c-2ca6537d1721';

async function callWithoutAuth(handler: Handler, body: unknown) {
  const req = { method: 'POST', headers: {}, body };
  const res = createRes();
  await handler(req, res);
  return res;
}

describe.each(['generate-code', 'check-link', 'send-test', 'toggle-notifications', 'unlink'])(
  'POST /api/telegram/%s unauthenticated',
  (endpoint) => {
    it('rejects a body-supplied userId with 401 (no JWT fallback)', async () => {
      const handler: Handler = (await import(`../../../api/_telegram/${endpoint}.js`)).default;
      const res = await callWithoutAuth(handler, { userId: VICTIM_UUID });

      expect(res.statusCode).toBe(401);
      expect(res.body).toMatchObject({ error: 'Unauthorized' });
    });

    it('rejects an empty body with 401', async () => {
      const handler: Handler = (await import(`../../../api/_telegram/${endpoint}.js`)).default;
      const res = await callWithoutAuth(handler, {});

      expect(res.statusCode).toBe(401);
    });
  },
);

describe('P0 RLS migration (20260824000000_p0_security_fixes.sql)', () => {
  const migration = readFileSync(
    path.join(projectRoot, 'supabase/migrations/20260824000000_p0_security_fixes.sql'),
    'utf-8',
  );

  it('enables RLS on user_subscriptions and app_settings', () => {
    expect(migration).toContain('ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('app_settings ENABLE ROW LEVEL SECURITY');
  });

  it('scopes telegram tables to the owning user', () => {
    expect(migration).toContain('ON public.telegram_users FOR SELECT TO authenticated');
    expect(migration).toContain('USING (auth.uid() = user_id)');
    expect(migration).toContain('ON public.telegram_link_codes FOR INSERT TO authenticated');
  });

  it('drops the re-opened study_rooms and leaderboard public policies', () => {
    expect(migration).toContain('DROP POLICY IF EXISTS "Public write study_rooms"');
    expect(migration).toContain('DROP POLICY IF EXISTS "Public write leaderboard"');
  });

  it('stops user_notifications forgery (self or admin insert only)', () => {
    expect(migration).toContain('WITH CHECK (user_id = auth.uid() OR is_admin())');
  });

  it('contains no USING (true) policy on user-owned tables', () => {
    // The only allowed USING (true) targets are public content tables.
    const forbidden = [
      /ON public\.telegram_users[^;]*USING \(true\)/s,
      /ON public\.telegram_link_codes[^;]*USING \(true\)/s,
      /ON public\.user_subscriptions[^;]*USING \(true\)/s,
    ];
    for (const rx of forbidden) {
      expect(migration).not.toMatch(rx);
    }
  });
});

describe('shared admin Gemini key distribution', () => {
  const srcRoot = path.join(projectRoot, 'src');

  function collectFiles(dir: string, exts: string[]): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'test') continue;
        out.push(...collectFiles(full, exts));
      } else if (exts.some((e) => entry.name.endsWith(e))) {
        out.push(full);
      }
    }
    return out;
  }

  it('no src file reads or writes study_planner_admin_api_key (only removeItem allowed)', () => {
    const offenders: string[] = [];
    for (const file of collectFiles(srcRoot, ['.ts', '.tsx'])) {
      const content = readFileSync(file, 'utf-8');
      const forbidden = [
        /localStorage\.getItem\(['"`]study_planner_admin_api_key/,
        /localStorage\.setItem\(['"`]study_planner_admin_api_key/,
        /safeStorage\.getItem\(['"`]study_planner_admin_api_key/,
        /safeStorage\.setItem\(['"`]study_planner_admin_api_key/,
      ];
      if (forbidden.some((rx) => rx.test(content))) {
        offenders.push(path.relative(srcRoot, file));
      }
    }
    expect(offenders).toEqual([]);
  }, 20000);

  it('no src file fetches gemini_api_key from the client', () => {
    const offenders: string[] = [];
    for (const file of collectFiles(srcRoot, ['.ts', '.tsx'])) {
      const content = readFileSync(file, 'utf-8');
      if (/select\(['"`][^'"`]*gemini_api_key/.test(content)) {
        offenders.push(path.relative(srcRoot, file));
      }
    }
    // AdminDashboardPage still reads app_settings for the admin editor —
    // server-side the column REVOKE + admin-only RLS protects it.
    expect(offenders.filter((f) => !f.includes('AdminDashboardPage'))).toEqual([]);
  });
});
