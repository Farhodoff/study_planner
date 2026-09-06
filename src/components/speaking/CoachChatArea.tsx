import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CoachChatMessage, CoachVocabularyItem, CoachPersonaItem } from './speakingTypes';
import { Check, Copy, Volume2, Plus, Sparkles, ArrowRight, TrendingUp } from 'lucide-react';
import { UzbekistanFlag } from '../common/FlagIcons';
import { useLanguage } from '../../context/LanguageContext';
import { useStudyData } from '../../context/StudyPlannerContext';
import { safeLocalStorage } from '../../utils/storage/safeLocalStorage';
import { ConversationHints } from './ConversationHints';
import { generateContextualHints } from '../../utils/ai/conversationHintGenerator';
import { ConversationScenario } from './scenarioTypes';

interface CoachChatAreaProps {
  chatHistory: CoachChatMessage[];
  isLiveSession: boolean;
  currentPersona: CoachPersonaItem;
  currentTranscript: string;
  isListening: boolean;
  isThinking: boolean;
  copiedIndex: number | null;
  chatContainerRef: React.RefObject<HTMLDivElement>;
  handleTranslateMessage: (idx: number) => void;
  copyToClipboard: (text: string, index: number) => void;
  speakText: (text: string) => void;
  setChatHistory: React.Dispatch<React.SetStateAction<CoachChatMessage[]>>;
  onAddVocabulary?: (vocab: CoachVocabularyItem) => Promise<boolean | void> | void;
  onInspectPitch?: (word: string, kanaHint?: string) => void;
  activeScenario?: ConversationScenario | null;
  onSelectHint?: (text: string) => void;
}

export const CoachChatArea: React.FC<CoachChatAreaProps> = ({
  chatHistory,
  isLiveSession,
  currentPersona,
  currentTranscript: _currentTranscript,
  isListening,
  isThinking,
  copiedIndex,
  chatContainerRef,
  handleTranslateMessage,
  copyToClipboard,
  speakText,
  setChatHistory,
  onAddVocabulary,
  onInspectPitch,
  activeScenario,
  onSelectHint,
}) => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { flashcards } = useStudyData();
  const [addedVocabs, setAddedVocabs] = useState<Set<string>>(() => {
    try {
      const set = new Set<string>();
      const jaWords = safeLocalStorage.getJSON<any[]>(
        'study_planner_speaking_vocabularies_local_user_ja',
        [],
      );
      const enWords = safeLocalStorage.getJSON<any[]>(
        'study_planner_speaking_vocabularies_local_user_en',
        [],
      );
      jaWords.forEach((w: any) => w.word && set.add(w.word.trim()));
      enWords.forEach((w: any) => w.word && set.add(w.word.trim()));
      return set;
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    if (flashcards && flashcards.length > 0) {
      setAddedVocabs((prev) => {
        const updated = new Set(prev);
        flashcards.forEach((f) => {
          const firstWord = (f.front || '').split('\n')[0].trim();
          if (firstWord) updated.add(firstWord);
        });
        return updated;
      });
    }
  }, [flashcards]);

  const ActivePersonaIcon = currentPersona?.icon || Sparkles;

  const handleVocabClick = async (vocab: CoachVocabularyItem) => {
    if (!onAddVocabulary) return;
    setAddedVocabs((prev) => new Set(prev).add(vocab.word.trim()));
    try {
      await onAddVocabulary(vocab);
    } catch {
      // Keep state as marked or handle gracefully
    }
  };

  if (chatHistory.length === 0 && !isLiveSession) return null;

  return (
    <div
      ref={chatContainerRef}
      className="scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent flex-1 space-y-3 overflow-y-auto px-1 py-3"
    >
      {chatHistory.map((msg, idx) => (
        <div
          key={idx}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}
        >
          {/* AI Avatar */}
          {msg.role === 'assistant' && (
            <div
              className={`h-8 w-8 shrink-0 rounded-xl bg-gradient-to-tr ${currentPersona.color} mr-2 mt-1 flex items-center justify-center shadow-md`}
            >
              <ActivePersonaIcon size={14} className="text-white" />
            </div>
          )}

          <div className="group relative max-w-[85%] transition-all sm:max-w-[75%] md:max-w-[70%]">
            {/* Message Bubble */}
            <div
              className={`rounded-2xl p-3 shadow-sm sm:p-3.5 ${
                msg.role === 'user'
                  ? 'rounded-tr-md bg-primary text-primary-foreground shadow-md shadow-primary/20'
                  : 'rounded-tl-md border border-border bg-card text-foreground shadow-sm'
              }`}
            >
              {/* Timestamp */}
              <div
                className={`mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold ${
                  msg.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                }`}
              >
                <span>
                  {msg.role === 'user'
                    ? language === 'ja'
                      ? 'あなた'
                      : 'Siz'
                    : currentPersona.name}
                </span>
                <span>•</span>
                <span>{msg.timestamp}</span>
              </div>

              <p className="whitespace-pre-wrap text-xs font-medium leading-relaxed sm:text-sm">
                {msg.content}
              </p>

              {/* Romaji Reading Aid */}
              {msg.role === 'assistant' && msg.romaji && (
                <p className="mt-1 font-mono text-[11px] italic leading-tight text-muted-foreground">
                  {msg.romaji}
                </p>
              )}

              {/* Instant Correction Banner */}
              {msg.role === 'assistant' &&
                msg.correction &&
                (msg.correction.hasError ||
                  Boolean(
                    msg.correction.corrected && msg.correction.corrected.trim().length > 0,
                  )) &&
                msg.correction.corrected && (
                  <div className="mt-2.5 space-y-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs">
                    <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-[#C9A961]">
                      <span>
                        {language === 'ja'
                          ? '💡 文法・表現のアドバイス:'
                          : '💡 Grammatika / Iborani yaxshilash:'}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          speakText(
                            msg.correction!.explanation
                              ? `${msg.correction!.explanation} ${msg.correction!.corrected || ''}`
                              : msg.correction!.corrected || '',
                          )
                        }
                        className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-500 transition-colors hover:bg-amber-500/25"
                        title="Maslahatni to'liq ovozda tinglash"
                      >
                        <Volume2 size={12} />
                        <span>Kengashni Tinglash</span>
                      </button>
                    </div>
                    {msg.correction.original && (
                      <div className="text-[11px] text-rose-400 line-through">
                        ❌ {msg.correction.original}
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-400">
                      <span>✅ {msg.correction.corrected}</span>
                      <button
                        type="button"
                        onClick={() => speakText(msg.correction?.corrected || '')}
                        className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 transition-colors hover:bg-emerald-500/20"
                        title="To'g'ri jumlani tinglash"
                      >
                        <Volume2 size={12} />
                        <span>Tinglash</span>
                      </button>
                    </div>
                    {msg.correction.explanation && (
                      <div className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                        {msg.correction.explanation}
                      </div>
                    )}
                  </div>
                )}

              {/* Vocabulary Recommendations */}
              {msg.role === 'assistant' && msg.vocabulary && msg.vocabulary.length > 0 && (
                <div className="mt-2.5 space-y-1.5 border-t border-border/50 pt-2">
                  <div className="flex items-center justify-between gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <span>
                      {language === 'ja'
                        ? '🧠 おすすめ単語・表現（単語帳）:'
                        : "🧠 Yangi Lug'atlar (Fleshkarta):"}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate('/decks')}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-amber-500 transition-colors hover:bg-amber-500/10 hover:text-amber-400"
                      title="Speaking fleshkartalariga o'tish"
                    >
                      <span>🎙️ Lug'atlarim</span>
                      <ArrowRight size={10} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {msg.vocabulary.map((vocab, vIdx) => {
                      const isSaved =
                        addedVocabs.has(vocab.word.trim()) ||
                        (flashcards && flashcards.some((f) => f.front.includes(vocab.word.trim())));
                      return (
                        <div
                          key={vIdx}
                          className={`inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs transition-all ${
                            isSaved
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-xs'
                              : 'border-border bg-muted/80 text-foreground shadow-xs hover:border-primary/50'
                          }`}
                        >
                          <div className="flex items-baseline gap-1">
                            <span className="font-bold text-foreground">{vocab.word}</span>
                            {vocab.reading && (
                              <span className="font-mono text-[10px] text-muted-foreground">
                                ({vocab.reading})
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => speakText(vocab.reading || vocab.word)}
                              className="cursor-pointer rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-amber-400"
                              title="So'z talaffuzini tinglash"
                            >
                              <Volume2 size={12} />
                            </button>
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            • {vocab.meaning}
                          </span>

                          {onInspectPitch && language === 'ja' && (
                            <button
                              type="button"
                              onClick={() => onInspectPitch(vocab.word, vocab.reading)}
                              className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary transition-all hover:bg-primary/20 hover:shadow-xs active:scale-95"
                              title="Yapon tili ohangi (Pitch Accent) grafigini ko'rish"
                            >
                              <TrendingUp size={11} />
                              <span>Pitch</span>
                            </button>
                          )}

                          {onAddVocabulary && (
                            <button
                              type="button"
                              onClick={() => handleVocabClick(vocab)}
                              className={`inline-flex cursor-pointer items-center gap-1 rounded-lg px-1.5 py-0.5 text-[11px] font-bold transition-all ${
                                isSaved
                                  ? 'cursor-default bg-emerald-600 text-white'
                                  : 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:scale-95'
                              }`}
                              title={
                                isSaved
                                  ? language === 'ja'
                                    ? '単語帳に保存済み'
                                    : 'Fleshkartaga saqlangan'
                                  : language === 'ja'
                                    ? '単語帳に追加'
                                    : "Fleshkartaga qo'shish"
                              }
                            >
                              {isSaved ? (
                                <>
                                  <Check size={12} className="shrink-0" />
                                  <span>{language === 'ja' ? '保存済み' : 'Saqlandi'}</span>
                                </>
                              ) : (
                                <>
                                  <Plus size={12} className="shrink-0" />
                                  <span>{language === 'ja' ? '追加' : "Qo'shish"}</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Uzbek / Japanese Translation Box */}
              {msg.role === 'assistant' && language !== 'ja' && (
                <div className="mt-2.5 border-t border-border/50 pt-2">
                  {!msg.showTranslation ? (
                    <button
                      onClick={() => handleTranslateMessage(idx)}
                      disabled={msg.isTranslating}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary transition-colors hover:text-primary/80"
                    >
                      <UzbekistanFlag className="h-2.5 w-3.5" />
                      <span>
                        {msg.isTranslating ? 'Tarjima qilinmoqda...' : "O'zbekcha tarjimasi"}
                      </span>
                    </button>
                  ) : (
                    <div className="rounded-xl border border-border bg-muted/80 p-2.5 text-xs font-medium leading-relaxed text-foreground animate-in fade-in sm:p-3">
                      <div className="mb-1 flex items-center justify-between text-[11px] font-bold text-primary">
                        <span className="flex items-center gap-1.5">
                          <UzbekistanFlag className="h-2.5 w-3.5" />
                          <span>O'zbekcha tarjimasi:</span>
                        </span>
                        <button
                          onClick={() =>
                            setChatHistory((prev) =>
                              prev.map((m, i) =>
                                i === idx ? { ...m, showTranslation: false } : m,
                              ),
                            )
                          }
                          className="cursor-pointer text-[10px] text-muted-foreground hover:text-foreground"
                        >
                          Berkitish ✕
                        </button>
                      </div>
                      <p className="whitespace-pre-wrap">{msg.translation}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div
              className={`mt-1.5 flex items-center gap-1 ${msg.role === 'user' ? 'justify-end' : 'ml-0 justify-start'}`}
            >
              {msg.role === 'assistant' && language === 'ja' && onInspectPitch && (
                <button
                  type="button"
                  onClick={() => {
                    const firstWord = msg.content.match(/[\u3040-\u30ff\u4e00-\u9fff]+/);
                    if (firstWord) {
                      onInspectPitch(firstWord[0]);
                    }
                  }}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                  title="Ohang (Pitch Accent) grafigini ko'rish"
                >
                  <TrendingUp size={11} />
                  <span>Pitch</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => copyToClipboard(msg.content, idx)}
                className="cursor-pointer rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Nusxalash"
              >
                {copiedIndex === idx ? (
                  <Check size={13} className="text-emerald-500" />
                ) : (
                  <Copy size={13} />
                )}
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Smart Conversation Hints for Beginners */}
      {(() => {
        const lastCoachMessage = [...chatHistory].reverse().find((m) => m.role === 'assistant');
        if (!lastCoachMessage || isThinking || !onSelectHint) return null;
        const hints = generateContextualHints(lastCoachMessage.content, activeScenario);
        return (
          <ConversationHints
            hints={hints}
            onSelectHint={onSelectHint}
            onSpeakText={speakText}
            disabled={isThinking || isListening}
          />
        );
      })()}

      {/* AI Thinking Indicator */}
      {isThinking && (
        <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2">
          <div
            className={`h-8 w-8 shrink-0 rounded-xl bg-gradient-to-tr ${currentPersona.color} mr-2 mt-1 flex items-center justify-center shadow-md`}
          >
            <ActivePersonaIcon size={14} className="animate-pulse text-white" />
          </div>
          <div className="rounded-2xl rounded-tl-md border border-border bg-card p-3.5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-4 items-end gap-[3px]">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`w-[3px] rounded-full bg-gradient-to-t ${currentPersona.color} animate-bounce`}
                    style={{
                      animationDelay: `${i * 120}ms`,
                      animationDuration: '0.8s',
                      height: `${[60, 100, 40, 80, 50][i]}%`,
                    }}
                  />
                ))}
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                {currentPersona.name} javob tayyorlamoqda...
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoachChatArea;
