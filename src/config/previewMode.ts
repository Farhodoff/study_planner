import type { User, Session } from '@supabase/supabase-js';

/**
 * PUBLIC PREVIEW MODE
 *
 * Used for Figma html.to.design plugin crawler to capture pages
 * without authentication walls (Admin, Dashboard, Speaking Coach, etc.)
 *
 * Set PUBLIC_PREVIEW_MODE = true to open the preview.
 * Set PUBLIC_PREVIEW_MODE = false to restore normal production authentication security.
 */
export const PUBLIC_PREVIEW_MODE = false;

/**
 * Checks if preview mode should be active for the current runtime.
 * Automatically keeps automated tests (Vitest) in normal mode unless explicitly requested.
 */
export const isPublicPreviewActive = (): boolean => {
  // In automated test environments (Vitest/Jest), keep normal auth flow by default
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
    return false;
  }
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('preview') === 'false') return false;
    if (params.get('preview') === 'true') return true;
  }
  return PUBLIC_PREVIEW_MODE;
};

export const MOCK_PREVIEW_USER: User = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'fsoyilov@gmail.com',
  aud: 'authenticated',
  role: 'authenticated',
  email_confirmed_at: '2024-01-01T00:00:00.000Z',
  app_metadata: {
    provider: 'email',
    providers: ['email'],
    role: 'superadmin',
  },
  user_metadata: {
    full_name: 'Farhod Soyilov',
    name: 'Farhod Soyilov',
    role: 'superadmin',
  },
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: new Date().toISOString(),
};

export const MOCK_PREVIEW_SESSION: Session = {
  access_token: 'preview-access-token',
  token_type: 'bearer',
  expires_in: 360000,
  refresh_token: 'preview-refresh-token',
  user: MOCK_PREVIEW_USER,
};
