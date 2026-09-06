import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { safeLocalStorage } from '../utils/storage/safeLocalStorage';
import { isPublicPreviewActive, MOCK_PREVIEW_USER } from '../config/previewMode';

export interface AuthState {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user:
    safeLocalStorage.getJSON<User | null>('study_planner_user_cache', null) ||
    (isPublicPreviewActive() ? (MOCK_PREVIEW_USER as unknown as User) : null),
  loading: isPublicPreviewActive() ? false : true,
  setUser: (user) => {
    safeLocalStorage.setJSON('study_planner_user_cache', user);
    set({ user });
  },
  setLoading: (loading) => set({ loading }),
}));
