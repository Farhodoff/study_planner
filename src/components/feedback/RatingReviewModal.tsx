import React, { useState, useEffect, useId } from 'react';
import { Star, X, CheckCircle2, Loader2, MessageSquare, Send, Sparkles } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';

export interface RatingReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (params: {
    rating: number;
    comment?: string;
    category?: string;
    contactInfo?: {
      name?: string;
      email?: string;
      telegramUsername?: string;
    };
  }) => Promise<{ success: boolean; message?: string; error?: string }>;
  isSubmitting?: boolean;
  initialRating?: number;
  initialCategory?: string;
}

const CATEGORIES = [
  { id: 'general', label: 'Umumiy' },
  { id: 'speaking', label: 'Speaking Coach' },
  { id: 'flashcards', label: 'Fleshkartalar' },
  { id: 'suggestion', label: "Taklif / G'oya" },
  { id: 'bug', label: 'Xatolik / Muammo' },
];

const RATING_LABELS: Record<number, { text: string; emoji: string; color: string }> = {
  5: { text: 'Ajoyib! Juda yoqdi', emoji: '😍', color: 'text-amber-500' },
  4: { text: "Yaxshi, ma'qul keldi", emoji: '👍', color: 'text-amber-500' },
  3: { text: "O'rtacha, kamchiliklar bor", emoji: '🤔', color: 'text-amber-600' },
  2: { text: 'Qoniqarsiz', emoji: '😕', color: 'text-orange-500' },
  1: { text: 'Yomon, muammolar ko‘p', emoji: '😞', color: 'text-rose-500' },
};

export const RatingReviewModal: React.FC<RatingReviewModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
  initialRating = 5,
  initialCategory = 'general',
}) => {
  const user = useAuthStore((s) => s.user);
  const [rating, setRating] = useState<number>(initialRating);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [category, setCategory] = useState(initialCategory);
  const [contactName, setContactName] = useState('');
  const [telegramUsername, setTelegramUsername] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const commentId = useId();
  const contactNameId = useId();
  const telegramUsernameId = useId();

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setRating(initialRating || 5);
      setHoveredRating(null);
      setComment('');
      setCategory(initialCategory || 'general');
      setErrorText(null);
      setIsSuccess(false);
      if (user) {
        setContactName(user.user_metadata?.full_name || user.user_metadata?.name || '');
      }
    }
  }, [isOpen, user, initialRating, initialCategory]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const activeRating = hoveredRating || rating;
  const ratingInfo = RATING_LABELS[activeRating] || RATING_LABELS[5];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);

    const result = await onSubmit({
      rating,
      comment: comment.trim(),
      category,
      contactInfo: {
        name: contactName.trim() || undefined,
        telegramUsername: telegramUsername.trim() || undefined,
      },
    });

    if (result.success) {
      setIsSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2200);
    } else {
      setErrorText(result.error || 'Xatolik yuz berdi. Iltimos qayta urinib ko‘ring.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rating-modal-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={!isSubmitting ? onClose : undefined}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border/80 bg-card p-6 shadow-2xl transition-all sm:p-8">
        {/* Close Button */}
        {!isSubmitting && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        {isSuccess ? (
          <div className="flex flex-col items-center justify-center py-8 text-center duration-300 animate-in fade-in zoom-in">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 ring-8 ring-emerald-500/5">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <h3 className="text-2xl font-bold text-foreground">Katta rahmat!</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Baho va fikringiz qabul qilindi. Sizning fikringiz Nihongo Talk loyihasini yanada
              rivojlantirishga xizmat qiladi.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Header / App Brand */}
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-rose-500 text-white shadow-lg shadow-primary/20">
                <Sparkles className="h-7 w-7" />
              </div>
              <h2
                id="rating-modal-title"
                className="text-xl font-bold tracking-tight text-foreground sm:text-2xl"
              >
                Nihongo Talk ilovasi sizga yoqdimi?
              </h2>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                Fikr va bahoingiz ilovani mukammallashtirishga yordam beradi
              </p>
            </div>

            {/* Stars Selector */}
            <div className="flex flex-col items-center justify-center pt-1">
              <div
                className="flex items-center gap-1 sm:gap-2"
                role="radiogroup"
                aria-label="Baho tanlang (1 dan 5 gacha)"
              >
                {[1, 2, 3, 4, 5].map((starVal) => {
                  const isFilled = starVal <= activeRating;
                  return (
                    <button
                      key={starVal}
                      type="button"
                      role="radio"
                      aria-checked={rating === starVal}
                      aria-label={`${starVal} yulduzcha`}
                      onClick={() => setRating(starVal)}
                      onMouseEnter={() => setHoveredRating(starVal)}
                      onMouseLeave={() => setHoveredRating(null)}
                      className="group relative p-1 transition-transform hover:scale-110 focus:outline-none active:scale-95"
                    >
                      <Star
                        className={`h-9 w-9 transition-colors duration-150 sm:h-10 sm:w-10 ${
                          isFilled
                            ? 'fill-amber-400 text-amber-400 drop-shadow-sm'
                            : 'fill-transparent text-muted-foreground/40 group-hover:text-amber-300'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
              {/* Rating Label Text */}
              <div className="mt-2 text-sm font-semibold transition-all">
                <span className={ratingInfo.color}>
                  {ratingInfo.emoji} {ratingInfo.text}
                </span>
              </div>
            </div>

            {/* Category selection */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Bo‘limni tanlang:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.id)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      category === c.id
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Feedback textarea */}
            <div>
              <label
                htmlFor={commentId}
                className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted-foreground"
              >
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Fikr-mulohaza yoki taklif:
                </span>
                <span className="text-[10px] text-muted-foreground">{comment.length}/1000</span>
              </label>
              <textarea
                id={commentId}
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 1000))}
                rows={3}
                placeholder="Ilovada nima yoqdi yoki yana nimalar qo‘shishimizni xohlaysiz?.."
                className="w-full rounded-xl border border-input bg-background/50 p-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Optional contact input (especially for guests) */}
            {!user && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label
                    htmlFor={contactNameId}
                    className="mb-1 block text-[11px] font-medium text-muted-foreground"
                  >
                    Ismingiz:
                  </label>
                  <input
                    id={contactNameId}
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Ismingiz"
                    className="w-full rounded-lg border border-input bg-background/50 px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor={telegramUsernameId}
                    className="mb-1 block text-[11px] font-medium text-muted-foreground"
                  >
                    Telegram @username:
                  </label>
                  <input
                    id={telegramUsernameId}
                    type="text"
                    value={telegramUsername}
                    onChange={(e) => setTelegramUsername(e.target.value)}
                    placeholder="@username"
                    className="w-full rounded-lg border border-input bg-background/50 px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
            )}

            {errorText && (
              <p className="text-center text-xs font-medium text-destructive">{errorText}</p>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="w-1/3 rounded-xl border border-border py-2.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                Keyinroq
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-2/3 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground shadow-md shadow-primary/25 transition hover:brightness-105 active:scale-[0.98] disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Yuborilmoqda...
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    Baholash va Yuborish
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
