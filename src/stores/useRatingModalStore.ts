import { create } from 'zustand';
import { safeLocalStorage } from '../utils/storage/safeLocalStorage';
import { useAuthStore } from './useAuthStore';

const STORAGE_KEYS = {
  SUBMITTED_AT: 'app_rating_submitted_at',
  DISMISSED_AT: 'app_rating_dismissed_at',
  MILESTONE_COUNT: 'app_rating_milestones_count',
} as const;

const MILESTONE_THRESHOLD = 3;
const DISMISS_COOLDOWN_DAYS = 14;

export interface ReviewSubmitParams {
  rating: number;
  comment?: string;
  category?: string;
  contactInfo?: {
    name?: string;
    email?: string;
    telegramUsername?: string;
  };
}

export interface RatingModalState {
  isOpen: boolean;
  isSubmitting: boolean;
  initialRating?: number;
  initialCategory?: string;
  openModal: (options?: { rating?: number; category?: string } | unknown) => void;
  closeModal: () => void;
  recordMilestone: () => void;
  submitReview: (
    params: ReviewSubmitParams,
  ) => Promise<{ success: boolean; message?: string; error?: string }>;
}

export const useRatingModalStore = create<RatingModalState>((set) => ({
  isOpen: false,
  isSubmitting: false,
  initialRating: 5,
  initialCategory: 'general',
  openModal: (options?: { rating?: number; category?: string } | unknown) =>
    set({
      isOpen: true,
      initialRating:
        options &&
        typeof options === 'object' &&
        'rating' in options &&
        typeof (options as any).rating === 'number'
          ? (options as any).rating
          : 5,
      initialCategory:
        options &&
        typeof options === 'object' &&
        'category' in options &&
        typeof (options as any).category === 'string'
          ? (options as any).category
          : 'general',
    }),
  closeModal: () => {
    set({ isOpen: false });
    safeLocalStorage.setItem(STORAGE_KEYS.DISMISSED_AT, Date.now().toString());
  },
  recordMilestone: () => {
    const submittedAt = safeLocalStorage.getItem(STORAGE_KEYS.SUBMITTED_AT);
    if (submittedAt) return;

    const dismissedAt = Number(safeLocalStorage.getItem(STORAGE_KEYS.DISMISSED_AT) || 0);
    const daysSinceDismissed = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
    if (dismissedAt && daysSinceDismissed < DISMISS_COOLDOWN_DAYS) {
      return;
    }

    const currentCount = Number(safeLocalStorage.getItem(STORAGE_KEYS.MILESTONE_COUNT) || 0) + 1;
    safeLocalStorage.setItem(STORAGE_KEYS.MILESTONE_COUNT, currentCount.toString());

    if (currentCount >= MILESTONE_THRESHOLD) {
      setTimeout(() => {
        set({ isOpen: true });
      }, 1200);
    }
  },
  submitReview: async (params: ReviewSubmitParams) => {
    set({ isSubmitting: true });
    try {
      const user = useAuthStore.getState().user;
      const payload = {
        rating: params.rating,
        comment: params.comment || '',
        category: params.category || 'general',
        userInfo: {
          id: user?.id,
          email: user?.email || params.contactInfo?.email,
          name:
            params.contactInfo?.name || user?.user_metadata?.full_name || user?.user_metadata?.name,
          telegramUsername: params.contactInfo?.telegramUsername,
        },
        metadata: {
          platform:
            typeof window !== 'undefined'
              ? window.innerWidth < 768
                ? 'Mobile Web'
                : 'Desktop Web'
              : 'Web',
          url: typeof window !== 'undefined' ? window.location.pathname : '/',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          isMobile: typeof window !== 'undefined' ? window.innerWidth < 768 : false,
        },
      };

      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Xatolik yuz berdi');
      }

      safeLocalStorage.setItem(STORAGE_KEYS.SUBMITTED_AT, Date.now().toString());
      return {
        success: true,
        message: data.message || 'Baho va fikringiz qabul qilindi!',
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Tarmoq xatosi';
      return {
        success: false,
        error: errorMsg,
      };
    } finally {
      set({ isSubmitting: false });
    }
  },
}));
