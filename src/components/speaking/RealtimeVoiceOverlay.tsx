import React from 'react';
import { Mic, Sparkles, AlertCircle, CheckCircle2, Volume2, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../../context/LanguageContext';

export interface ErrorTag {
  id: string;
  type: 'grammar' | 'vocabulary' | 'pronunciation';
  originalText: string;
  correction: string;
  explanation: string;
}

interface RealtimeVoiceOverlayProps {
  isRecording: boolean;
  isAiSpeaking: boolean;
  transcript: string;
  errors: ErrorTag[];
  activeCefrLevel?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  activeJlptLevel?: 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
  isHandsFree?: boolean;
  audioVolume?: number;
  onToggleRecording: () => void;
  onCommitNow?: () => void;
  onBargeIn?: () => void;
  onToggleHandsFree?: () => void;
  onSpeakText?: (text: string) => void;
}

export const RealtimeVoiceOverlay: React.FC<RealtimeVoiceOverlayProps> = ({
  isRecording,
  isAiSpeaking,
  transcript,
  errors,
  activeCefrLevel: _activeCefrLevel,
  activeJlptLevel: _activeJlptLevel,
  isHandsFree = false,
  audioVolume = 0,
  onToggleRecording: _onToggleRecording,
  onCommitNow,
  onBargeIn,
  onToggleHandsFree,
  onSpeakText,
}) => {
  const { language } = useLanguage();
  const isJa = language === 'ja';

  const getCategoryBadge = (type: string) => {
    switch (type) {
      case 'vocabulary':
        return { label: "Lug'at", color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' };
      case 'pronunciation':
        return {
          label: 'Talaffuz',
          color: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
        };
      default:
        return { label: 'Grammatika', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
    }
  };

  return (
    <div className="w-full space-y-2.5 rounded-2xl border border-border/80 bg-card/90 p-3 shadow-xl backdrop-blur-md transition-all sm:rounded-3xl sm:p-4">
      {/* Top Row: Visual Status & Interactive Wave Indicator */}
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <div
            className={`flex shrink-0 items-center justify-center rounded-xl p-2 transition-all sm:rounded-2xl sm:p-2.5 ${
              isAiSpeaking
                ? 'animate-pulse bg-[#C9A961]/15 text-[#C9A961] shadow-lg shadow-[#C9A961]/20 ring-2 ring-[#C9A961]/40'
                : isRecording
                  ? 'bg-primary/15 text-primary shadow-lg shadow-primary/20 ring-2 ring-primary/40'
                  : 'bg-muted text-muted-foreground'
            }`}
          >
            {isAiSpeaking ? (
              <Volume2 size={16} className="animate-bounce" />
            ) : isRecording ? (
              <Mic size={16} className="animate-pulse" />
            ) : (
              <Sparkles size={16} />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-xs font-extrabold tracking-wide text-foreground">
                {isAiSpeaking
                  ? isJa
                    ? 'AIが発話中...'
                    : 'AI Coach Gapirmoqda...'
                  : isRecording
                    ? isJa
                      ? '音声認識中...'
                      : 'Jonli Ovoz Yozib Olinmoqda...'
                    : isJa
                      ? 'リアルタイムAI音声対話'
                      : 'Real-Time Voice Coach'}
              </span>
              {(isRecording || isAiSpeaking) && (
                <span className="relative flex h-2 w-2 shrink-0">
                  <span
                    className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${isAiSpeaking ? 'bg-[#C9A961]' : 'bg-primary'}`}
                  />
                  <span
                    className={`relative inline-flex h-2 w-2 rounded-full ${isAiSpeaking ? 'bg-[#C9A961]' : 'bg-primary'}`}
                  />
                </span>
              )}
            </div>
            <p className="flex items-center gap-1.5 truncate text-[10px] font-medium text-muted-foreground">
              {isAiSpeaking
                ? isJa
                  ? 'タップして発話を中断できます'
                  : "Gapirish uchun to'xtatishingiz mumkin"
                : isRecording
                  ? isJa
                    ? '適応型リアルタイム分析中'
                    : 'Tezkor adaptiv tahlil rejimida'
                  : isJa
                    ? '双方向リアルタイム対話モード'
                    : 'Jonli ovozli muloqot rejimida'}
              {isHandsFree && (
                <span className="py-0.2 shrink-0 rounded border border-emerald-500/20 bg-emerald-500/10 px-1 text-[9px] font-bold text-emerald-400">
                  ⚡ Hands-free
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Right: Level Badges, Hands-Free Toggle & Barge-in */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {/* Barge-in Stop Button if AI is speaking */}
          {isAiSpeaking && onBargeIn && (
            <button
              type="button"
              onClick={onBargeIn}
              className="flex shrink-0 cursor-pointer items-center gap-1 rounded-xl border border-[#C9A961]/40 bg-[#C9A961]/20 px-2 py-1 text-[10px] font-bold text-[#C9A961] shadow-md transition-all hover:bg-[#C9A961]/30 active:scale-95 sm:px-2.5 sm:text-[11px]"
              title="AI gapirishini to'xtatish va so'zlash"
            >
              <Zap size={11} className="animate-pulse text-[#C9A961] sm:size-3" />
              <span>To'xtatish</span>
            </button>
          )}

          {onToggleHandsFree && (
            <button
              type="button"
              onClick={onToggleHandsFree}
              className={`flex cursor-pointer items-center gap-1 rounded-xl border px-2 py-1 text-[10px] font-bold transition-all ${
                isHandsFree
                  ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                  : 'border-border bg-muted/60 text-muted-foreground hover:text-foreground'
              }`}
              title="Hands-free avtomatik suhbat rejimini yoqish/o'chirish"
            >
              <span className="hidden sm:inline">Hands-free:</span>
              <span>{isHandsFree ? '⚡ ON' : '🖐️ OFF'}</span>
            </button>
          )}

          {/* Realtime Audio Waveform Volume Meter */}
          {isRecording && (
            <div
              className="flex h-6 items-center gap-0.5 rounded-xl border border-primary/25 bg-primary/10 px-2 py-1 sm:h-7 sm:gap-1 sm:px-2.5 sm:py-1.5"
              title="Jonli ovoz kuchi"
            >
              {[0.5, 0.9, 1.2, 0.8, 0.4].map((mult, i) => {
                const height = Math.max(4, Math.min(16, Math.round((audioVolume * mult) / 5) + 3));
                return (
                  <div
                    key={i}
                    className="w-0.5 rounded-full bg-primary transition-all duration-75 ease-out sm:w-1"
                    style={{ height: `${height}px` }}
                  />
                );
              })}
            </div>
          )}

          {errors.length > 0 && (
            <div className="flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300 sm:px-2.5 sm:py-1 sm:text-[11px]">
              <AlertCircle size={12} />
              <span>{errors.length} maslahat</span>
            </div>
          )}
        </div>
      </div>

      {/* LIVE SPEECH TRANSCRIPTION AT THE TOP */}
      <AnimatePresence>
        {(isRecording || transcript) && (
          <motion.div
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="relative rounded-xl border border-primary/30 bg-primary/10 p-2.5 shadow-inner backdrop-blur-xl sm:rounded-2xl sm:p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-primary sm:text-[11px]">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                  </span>
                  <span>{isJa ? 'リアルタイム音声認識' : 'Jonli Nutq (Realtime Voice)'}</span>
                </div>

                {onCommitNow && transcript && (
                  <button
                    type="button"
                    onClick={onCommitNow}
                    className="flex cursor-pointer items-center gap-1 rounded-lg bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow-xs transition-all hover:bg-primary/90 active:scale-95"
                    title={isJa ? '今すぐ送信' : 'Hozir yuborish'}
                  >
                    <CheckCircle2 size={11} />
                    <span>{isJa ? '送信' : 'Yuborish'}</span>
                  </button>
                )}
              </div>

              <div className="min-h-[26px] sm:min-h-[30px]">
                {transcript ? (
                  <p className="font-japanese break-words text-xs font-semibold leading-relaxed text-foreground sm:text-sm">
                    <span>"{transcript}"</span>
                    <span className="ml-1 inline-block h-3.5 w-1.5 animate-pulse bg-primary align-middle" />
                  </p>
                ) : (
                  <p className="flex items-center gap-1.5 text-xs font-medium italic text-muted-foreground sm:text-sm">
                    <Mic size={13} className="shrink-0 animate-pulse text-primary" />
                    <span>
                      {isJa
                        ? 'お話しください。リアルタイムで文字起こしされます...'
                        : 'Gapiring, AI nutqingizni real vaqtda yozmoqda...'}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expandable Micro-error toasts if detected */}
      <AnimatePresence>
        {errors.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="grid grid-cols-1 gap-2 sm:grid-cols-2"
          >
            {errors.slice(0, 2).map((err) => {
              const badge = getCategoryBadge(err.type);
              return (
                <div
                  key={err.id}
                  className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-950/40 p-2.5 text-xs backdrop-blur-md"
                >
                  <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-400" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 truncate text-[11px] font-bold text-amber-200">
                        <span className="text-slate-400 line-through">{err.originalText}</span>
                        <span className="flex items-center gap-0.5 font-bold text-emerald-400">
                          <CheckCircle2 size={11} /> {err.correction}
                        </span>
                        {onSpeakText && (
                          <button
                            type="button"
                            onClick={() => onSpeakText(err.correction)}
                            className="shrink-0 cursor-pointer rounded p-0.5 text-emerald-400 transition-colors hover:bg-emerald-500/20"
                            title="To'g'ri jumlani tinglash"
                          >
                            <Volume2 size={11} />
                          </button>
                        )}
                      </div>
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase ${badge.color}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <p className="line-clamp-1 text-[10px] text-slate-300">{err.explanation}</p>
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RealtimeVoiceOverlay;
