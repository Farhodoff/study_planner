import React, { useState } from 'react';
import { Lightbulb, Volume2, Send, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

import { safeLocalStorage } from '../../utils/storage/safeLocalStorage';

export interface ConversationHintItem {
  japanese: string;
  romaji?: string;
  uzbek: string;
}

interface ConversationHintsProps {
  hints: ConversationHintItem[];
  onSelectHint: (text: string) => void;
  onSpeakText: (text: string) => void;
  disabled?: boolean;
  enabled?: boolean;
  onToggleEnabled?: (enabled: boolean) => void;
}

export const ConversationHints: React.FC<ConversationHintsProps> = ({
  hints,
  onSelectHint,
  onSpeakText,
  disabled = false,
  enabled,
  onToggleEnabled,
}) => {
  // Read persisted preference; default to FALSE (OFF) so user is not distracted
  const [internalEnabled, setInternalEnabled] = useState<boolean>(() => {
    return safeLocalStorage.getItem('speaking_show_hints') === 'true';
  });
  const [isOpen, setIsOpen] = useState(true);

  const isHintsActive = typeof enabled === 'boolean' ? enabled : internalEnabled;

  const handleToggle = (nextState: boolean) => {
    setInternalEnabled(nextState);
    safeLocalStorage.setItem('speaking_show_hints', String(nextState));
    if (onToggleEnabled) {
      onToggleEnabled(nextState);
    }
  };

  if (!hints || hints.length === 0) return null;

  // When hints are OFF: Render a compact, single-line pill button to allow the user to easily turn it ON
  if (!isHintsActive) {
    return (
      <div className="mb-2 mt-2 flex items-center justify-start duration-150 animate-in fade-in">
        <button
          type="button"
          onClick={() => handleToggle(true)}
          className="backdrop-blur-xs group flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-500 transition-all hover:border-amber-500/50 hover:bg-amber-500/20 dark:text-amber-400"
          title="Nima deb javob berish namunalari va maslahatlarni yoqish (ON)"
        >
          <Lightbulb
            size={13}
            className="text-amber-500 transition-transform group-hover:scale-110"
          />
          <span>Javob namunalari:</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-black uppercase text-muted-foreground">
            OFF
          </span>
          <span className="text-[11px] font-bold text-amber-500 underline underline-offset-2">
            Yoqish (ON)
          </span>
        </button>
      </div>
    );
  }

  // When hints are ON: Render the full suggestions block with an explicit OFF switch button
  return (
    <div className="backdrop-blur-xs mb-2 mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3 transition-all duration-200 animate-in fade-in">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 text-xs font-bold text-amber-600 transition-opacity hover:opacity-80 dark:text-amber-400"
        >
          <Lightbulb size={15} className="animate-pulse text-amber-500" />
          <span>Nima deb javob bersam bo'ladi? (Javob namunalari)</span>
          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1 text-[10px] font-semibold text-muted-foreground sm:flex">
            <Sparkles size={11} className="text-amber-500" /> {hints.length} ta maslahat
          </span>
          <button
            type="button"
            onClick={() => handleToggle(false)}
            className="cursor-pointer rounded-lg border border-border bg-muted/90 px-2 py-0.5 text-[10px] font-bold text-muted-foreground transition-all hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400"
            title="Javob namunalarini o'chirish (OFF)"
          >
            O'chirish (OFF)
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {hints.map((hint, idx) => (
            <div
              key={idx}
              className="flex flex-col justify-between rounded-xl border border-border/80 bg-card/90 p-2.5 shadow-xs transition-all hover:border-amber-500/40 hover:shadow-sm"
            >
              <div>
                <p className="font-japanese text-sm font-bold text-foreground">{hint.japanese}</p>
                {hint.romaji && (
                  <p className="mt-0.5 text-[11px] italic text-muted-foreground">{hint.romaji}</p>
                )}
                <p className="mt-1 text-xs font-medium text-muted-foreground/90">🇺🇿 {hint.uzbek}</p>
              </div>

              <div className="mt-2.5 flex items-center justify-between border-t border-border/50 pt-2">
                <button
                  type="button"
                  onClick={() => onSpeakText(hint.japanese)}
                  title="Talaffuzini eshitish"
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Volume2 size={13} className="text-primary" />
                  <span>Eshitish</span>
                </button>

                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelectHint(hint.japanese)}
                  title="Ushbu javobni yuborish"
                  className="flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
                >
                  <Send size={11} />
                  <span>Aytish</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ConversationHints;
