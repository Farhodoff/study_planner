import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  isValidAnonKey,
  DEFAULT_SUPABASE_ANON_KEY,
  DEFAULT_SUPABASE_URL,
} from '../../lib/supabase';

describe('Admin Mobile Responsiveness & Supabase Key Resilience Suite', () => {
  describe('1. Supabase Key Validation & Fallback Guard', () => {
    it('strictly rejects [SENSITIVE] and placeholder tokens', () => {
      expect(isValidAnonKey('[SENSITIVE]')).toBe(false);
      expect(isValidAnonKey(' [SENSITIVE] ')).toBe(false);
      expect(isValidAnonKey('your_supabase_anon_key')).toBe(false);
      expect(isValidAnonKey('placeholder-anon-key')).toBe(false);
      expect(isValidAnonKey('undefined')).toBe(false);
      expect(isValidAnonKey('null')).toBe(false);
      expect(isValidAnonKey('')).toBe(false);
      expect(isValidAnonKey(null)).toBe(false);
      expect(isValidAnonKey(undefined)).toBe(false);
    });

    it('strictly accepts valid Supabase publishable keys', () => {
      expect(isValidAnonKey(DEFAULT_SUPABASE_ANON_KEY)).toBe(true);
      expect(isValidAnonKey('sb_publishable_6g0Ei_1Cw46e1mJLKj_1Ug_sOmhlgoI')).toBe(true);
      expect(isValidAnonKey('sb_publishable_test_valid_key_long_enough_12345')).toBe(true);
    });

    it('rejects truncated or malformed publishable keys', () => {
      expect(isValidAnonKey('sb_pub')).toBe(false);
      expect(isValidAnonKey('sb_publishable_short')).toBe(false);
    });

    it('accepts valid legacy Supabase JWT formats', () => {
      const validJwt =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtdWlteG5rbnh3YXJ2bmtwbmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjAwMDAwMDAsImV4cCI6MjAzNjAwMDAwMH0.1234567890abcdefghijklmnopqrstuvwxyz';
      expect(isValidAnonKey(validJwt)).toBe(true);
    });

    it('ensures DEFAULT_SUPABASE_ANON_KEY is verified and working', () => {
      expect(DEFAULT_SUPABASE_ANON_KEY).toBe('sb_publishable_6g0Ei_1Cw46e1mJLKj_1Ug_sOmhlgoI');
      expect(DEFAULT_SUPABASE_URL).toBe('https://qmuimxnknxwarvnkpnlo.supabase.co');
    });
  });

  describe('2. Mobile Viewport Meta Tag Regression Guard', () => {
    it('verifies index.html contains responsive width=device-width viewport meta tag', () => {
      const indexHtmlPath = path.resolve(__dirname, '../../../index.html');
      const htmlContent = fs.readFileSync(indexHtmlPath, 'utf-8');

      expect(htmlContent).toContain('<meta name="viewport"');
      expect(htmlContent).toContain('width=device-width');
      expect(htmlContent).toContain('viewport-fit=cover');
    });
  });

  describe('3. Admin Dashboard & Layout Mobile Contracts', () => {
    it('verifies Layout contains mobile header and safe area padding', () => {
      const layoutPath = path.resolve(__dirname, '../../components/Layout.tsx');
      const layoutContent = fs.readFileSync(layoutPath, 'utf-8');

      expect(layoutContent).toContain('safe-area-inset-top');
      expect(layoutContent).toContain('safe-area-inset-bottom');
      expect(layoutContent).toContain('md:hidden');
    });

    it('verifies AdminDashboardPage contains responsive container and table scrolling', () => {
      const adminPath = path.resolve(__dirname, '../../pages/AdminDashboardPage.tsx');
      const adminContent = fs.readFileSync(adminPath, 'utf-8');

      expect(adminContent).toContain('overflow-x-auto');
      expect(adminContent).toContain('min-w-[640px]');
      expect(adminContent).toContain('supabaseUrl');
      expect(adminContent).toContain('supabaseAnonKey');
    });
  });
});
