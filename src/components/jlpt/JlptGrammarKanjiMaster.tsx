import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Sparkles,
  Search,
  Volume2,
  CheckCircle2,
  GraduationCap,
  Flame,
  Plus,
  Check,
  Play,
  ArrowRight,
} from 'lucide-react';
import type { JlptGrammarItem, JlptKanjiItem } from '../../data/jlptGrammarKanji';
import { JLPT_GRAMMAR_DATABASE } from '../../data/jlptGrammarDatabase';
import { JLPT_KANJI_DATABASE } from '../../data/jlptKanjiDatabase';
import type { JlptGrammarQuestion } from '../../data/jlpt/grammar_data';
import { speakText } from '../../utils/audioTts';
import { useStudyData } from '../../context/StudyPlannerContext';
import { FuriganaText } from './FuriganaText';
import { KanjiStrokeOrderModal } from './KanjiStrokeOrderModal';
import { useJlptMastery, MasteryStatus } from '../../hooks/useJlptMastery';
import { HistoryService } from '../../services/HistoryService';
import { useLanguage } from '../../context/LanguageContext';
import { getOrEnsureLanguageSubject } from '../../utils/subjectResolver';
import { useSearchParams } from 'react-router-dom';

export const JlptGrammarKanjiMaster: React.FC = () => {
  const [searchParams] = useSearchParams();
  const urlLevel = searchParams.get('level')?.toUpperCase();
  const initialLevel: 'ALL' | 'N5' | 'N4' | 'N3' | 'N2' | 'N1' =
    urlLevel && ['N5', 'N4', 'N3', 'N2', 'N1'].includes(urlLevel) ? (urlLevel as any) : 'ALL';

  const { addFlashcardsBatch, subjects, addSubject, awardXP, addSession } = useStudyData();
  const { getItemStatus, setItemStatus, getStatsForLevel } = useJlptMastery();
  const { language } = useLanguage();

  const [activeTab, setActiveTab] = useState<'grammar' | 'kanji' | 'quiz'>('grammar');
  const [selectedLevel, setSelectedLevel] = useState<'ALL' | 'N5' | 'N4' | 'N3' | 'N2' | 'N1'>(
    initialLevel,
  );

  useEffect(() => {
    if (urlLevel && ['N5', 'N4', 'N3', 'N2', 'N1', 'ALL'].includes(urlLevel)) {
      setSelectedLevel(urlLevel as any);
    }
  }, [urlLevel]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | MasteryStatus>('ALL');

  // Lazy load data
  const [grammarData, setGrammarData] = useState<JlptGrammarItem[]>([]);
  const [kanjiData, setKanjiData] = useState<JlptKanjiItem[]>([]);
  const [grammarQuestions, setGrammarQuestions] = useState<JlptGrammarQuestion[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [gkModule, questionsModule] = await Promise.all([
          import('../../data/jlptGrammarKanji'),
          import('../../data/jlpt/grammar_data'),
        ]);
        setGrammarData(gkModule.JLPT_GRAMMAR_DATA);
        setKanjiData(gkModule.JLPT_KANJI_DATA);
        setGrammarQuestions(questionsModule.JLPT_GRAMMAR_QUESTIONS);
      } catch (err) {
        console.error('Failed to load JLPT data', err);
      } finally {
        setIsLoadingData(false);
      }
    };
    loadData();
  }, []);

  // Stroke Modal State
  const [strokeModalKanji, setStrokeModalKanji] = useState<JlptKanjiItem | null>(null);

  // Saved Flashcard Items Notification State
  const [savedCardIds, setSavedCardIds] = useState<string[]>([]);

  // Quiz State
  const [quizIndex, setQuizIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [isQuizCompleted, setIsQuizCompleted] = useState(false);
  const [missedQuizQuestions, setMissedQuizQuestions] = useState<JlptGrammarQuestion[]>([]);
  const [quizFlashcardsSaved, setQuizFlashcardsSaved] = useState(false);

  // Merge databases (or fallback)
  const grammarSource: JlptGrammarItem[] =
    JLPT_GRAMMAR_DATABASE.length > 0 ? JLPT_GRAMMAR_DATABASE : grammarData;
  const kanjiSource: JlptKanjiItem[] =
    JLPT_KANJI_DATABASE.length > 0 ? JLPT_KANJI_DATABASE : kanjiData;

  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  // Direct Export to Flashcards
  const handleExportToFlashcard = async (
    item: JlptGrammarItem | JlptKanjiItem,
    isGrammar: boolean,
  ) => {
    const subjectId = await getOrEnsureLanguageSubject(subjects, addSubject, 'ja');

    let frontText = '';
    let backText = '';

    if (isGrammar) {
      const g = item as JlptGrammarItem;
      frontText = `[${g.level} Grammar] ${g.title}\nStruktura: ${g.structure}`;
      backText = `🇺🇿 Ma'nosi: ${g.meaningUz}\n\nMisol:\n${g.examples[0]?.ja || ''}\n(${g.examples[0]?.romaji || ''})\n${g.examples[0]?.uz || ''}`;
    } else {
      const k = item as JlptKanjiItem;
      frontText = `[${k.level} Kanji] ${k.kanji}`;
      backText = `Onyomi: ${k.onyomi}\nKunyomi: ${k.kunyomi}\n\nMa'nosi: ${k.meaningUz}\n\nMisol: ${k.examples[0]?.word || ''} (${k.examples[0]?.reading || ''}) — ${k.examples[0]?.meaning || ''}`;
    }

    await addFlashcardsBatch([
      {
        subjectId,
        front: frontText,
        back: backText,
        interval: 1,
        repetitions: 0,
        easeFactor: 2.5,
      },
    ]);

    setSavedCardIds((prev) => [...prev, item.id]);
  };

  // Filter Grammar Items
  const filteredGrammar = grammarSource.filter((item) => {
    const matchesLevel = selectedLevel === 'ALL' || item.level === selectedLevel;
    const matchesQuery =
      !searchQuery.trim() ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.meaningUz.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.romaji.toLowerCase().includes(searchQuery.toLowerCase());
    const itemStatus = getItemStatus(item.id);
    const matchesStatus = statusFilter === 'ALL' || itemStatus === statusFilter;
    return matchesLevel && matchesQuery && matchesStatus;
  });

  // Filter Kanji Items
  const filteredKanji = kanjiSource.filter((item) => {
    const matchesLevel = selectedLevel === 'ALL' || item.level === selectedLevel;
    const matchesQuery =
      !searchQuery.trim() ||
      item.kanji.includes(searchQuery) ||
      item.meaningUz.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.onyomi.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.kunyomi.toLowerCase().includes(searchQuery.toLowerCase());
    const itemStatus = getItemStatus(item.id);
    const matchesStatus = statusFilter === 'ALL' || itemStatus === statusFilter;
    return matchesLevel && matchesQuery && matchesStatus;
  });

  // Calculate level stats
  const currentActiveList = activeTab === 'grammar' ? grammarSource : kanjiSource;
  const currentLevelItems =
    selectedLevel === 'ALL'
      ? currentActiveList
      : currentActiveList.filter((i) => i.level === selectedLevel);
  const levelStats = getStatsForLevel(currentLevelItems);

  const quizQuestions: JlptGrammarQuestion[] =
    selectedLevel === 'ALL'
      ? grammarQuestions
      : grammarQuestions.filter((q) => q.level === selectedLevel).length > 0
        ? grammarQuestions.filter((q) => q.level === selectedLevel)
        : grammarQuestions;

  const handleAnswerQuiz = (index: number) => {
    if (selectedOption !== null) return;
    setSelectedOption(index);
    const currentQ = quizQuestions[quizIndex];
    if (index === currentQ.correctAnswer) {
      setScore((prev) => prev + 1);
      setItemStatus(`jlpt_${currentQ.level}_${currentQ.id}`, 'mastered');
    } else {
      setMissedQuizQuestions((prev) => [...prev, currentQ]);
      setItemStatus(`jlpt_${currentQ.level}_${currentQ.id}`, 'hard');
    }
  };

  const handleNextQuiz = async () => {
    setSelectedOption(null);
    if (quizIndex + 1 < quizQuestions.length) {
      setQuizIndex((prev) => prev + 1);
    } else {
      setIsQuizCompleted(true);
      try {
        if (awardXP && score > 0) {
          awardXP(score * 20);
        }
        if (addSession) {
          const quizSubjectId = await getOrEnsureLanguageSubject(subjects, addSubject, 'ja');
          addSession({
            duration: Math.max(3, Math.round(quizQuestions.length * 1.5)),
            type: 'focus',
            completed: true,
            subjectId: quizSubjectId || undefined,
            startTime: new Date().toISOString(),
          });
        }
        HistoryService.saveMockExam({
          examType: 'jlpt',
          level: selectedLevel === 'ALL' ? 'N3' : selectedLevel,
          score,
          totalQuestions: quizQuestions.length,
          bandScore: Math.round((score / (quizQuestions.length || 1)) * 180),
        });
      } catch (e) {
        console.warn('Failed to save JLPT quiz score:', e);
      }
    }
  };

  const handleCreateFlashcardsFromMistakes = async () => {
    if (missedQuizQuestions.length === 0 || quizFlashcardsSaved) return;
    const subjectId = await getOrEnsureLanguageSubject(subjects, addSubject, 'ja');
    const cards = missedQuizQuestions.map((q) => ({
      subjectId,
      front: `[JLPT ${q.level} Grammar] ${q.pattern}\n\n${q.questionText}`,
      back: `To'g'ri javob: ${q.options[q.correctAnswer]}\n\n🇺🇿 Tahlil: ${q.explanationUzbek}`,
      interval: 1,
      repetitions: 0,
      easeFactor: 2.5,
    }));
    await addFlashcardsBatch(cards);
    setQuizFlashcardsSaved(true);
  };

  const resetQuiz = () => {
    setQuizIndex(0);
    setSelectedOption(null);
    setScore(0);
    setIsQuizCompleted(false);
    setMissedQuizQuestions([]);
    setQuizFlashcardsSaved(false);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner — Sumi-e & Hanko */}
      <div className="relative max-w-full overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-xs sm:p-6 md:p-8">
        <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div className="badge-gold mb-3">
              <Sparkles className="h-3.5 w-3.5" />{' '}
              {language === 'ja'
                ? 'こうしき きょうかしょ＆テストの データベース'
                : 'Rasmiy Darsliklar & Imtihonlar Bazasi'}
            </div>
            <h1 className="flex items-center gap-3 font-display text-2xl font-black tracking-tight text-foreground md:text-3xl">
              {language === 'ja'
                ? '⛩️ JLPT ぶんぽう＆かんじ マスター'
                : '⛩️ JLPT Grammar & Kanji Master'}
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {language === 'ja'
                ? 'N5〜N1の こうしき ぶんぽう＆かんじ。かきじゅん アニメーション、ふりがな ひょうじ、ワンクリックで たんごちょうへ ほぞんできます！'
                : "N5-N1 rasmiy darsliklar va imtihonlar bazasi. Kanji Stroke Order animatsiyalari, Furigana o'qilishlari hamda 1-Bosing bilan Flashcards eksporti!"}
            </p>
          </div>

          {/* Quick Stats Widget */}
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/40 p-3.5">
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-[#C9A961]">
              <Flame className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">
                {language === 'ja' ? '学習データ数' : 'Baza hajmi'}
              </div>
              <div className="flex items-center gap-1.5 text-lg font-black text-foreground">
                <span>
                  {grammarSource.length} {language === 'ja' ? '文法項目' : 'Qoida'}
                </span>{' '}
                •{' '}
                <span className="text-[#E8483A]">
                  {kanjiSource.length} {language === 'ja' ? '漢字' : 'Kanji'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sub-Tabs Bar */}
        <div className="mt-6 flex items-center gap-2 overflow-x-auto border-t border-border pt-4">
          <button
            onClick={() => setActiveTab('grammar')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'grammar'
                ? 'scale-[1.02] bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            {language === 'ja'
              ? `📖 文法マスター (${grammarSource.length})`
              : `📖 Grammatika (${grammarSource.length})`}
          </button>

          <button
            onClick={() => setActiveTab('kanji')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'kanji'
                ? 'scale-[1.02] bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            }`}
          >
            <GraduationCap className="h-4 w-4" />
            {language === 'ja'
              ? `⛩️ 漢字マスター (${kanjiSource.length})`
              : `⛩️ Kanji Iyerogliflar (${kanjiSource.length})`}
          </button>

          <button
            onClick={() => setActiveTab('quiz')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'quiz'
                ? 'scale-[1.02] bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            }`}
          >
            <Flame className="h-4 w-4 text-[#C9A961]" />
            {language === 'ja' ? '⚡ AIテスト演習' : '⚡ AI Test Generator'}
          </button>
        </div>
      </div>

      {/* Level & Search Controls (for Grammar & Kanji) */}
      {activeTab !== 'quiz' && (
        <div className="max-w-full space-y-4 overflow-hidden rounded-2xl border border-border bg-card p-3.5 shadow-xs sm:p-4">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            {/* Level Pills */}
            <div className="scrollbar-none flex max-w-full items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              {(['ALL', 'N5', 'N4', 'N3', 'N2', 'N1'] as const).map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setSelectedLevel(lvl)}
                  className={`shrink-0 whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                    selectedLevel === lvl
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'border border-border bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {lvl === 'ALL' ? (language === 'ja' ? 'すべて' : 'BARCHASI') : lvl}
                </button>
              ))}
            </div>

            {/* Search Bar */}
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeTab === 'grammar'
                    ? language === 'ja'
                      ? '文法・キーワード・意味で検索...'
                      : 'Grammatika, romaji yoki uzbekcha izlash...'
                    : language === 'ja'
                      ? '漢字・読み方・意味で検索...'
                      : "Kanji iyeroglif, o'qilishi yoki ma'nosi..."
                }
                className="w-full rounded-xl border border-border bg-muted/30 py-2.5 pl-10 pr-4 text-sm text-foreground transition placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Mastery Filter & Progress Bar */}
          <div className="flex flex-col justify-between gap-3 border-t border-border pt-3 md:flex-row md:items-center">
            {/* Status Filter buttons */}
            <div className="flex max-w-full flex-wrap items-center gap-1.5 text-xs">
              <span className="mr-1 shrink-0 font-medium text-muted-foreground">
                {language === 'ja' ? '習得状況:' : 'Holat:'}
              </span>
              {(['ALL', 'mastered', 'learned', 'hard', 'unlearned'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-lg px-2.5 py-1 font-bold transition ${
                    statusFilter === st
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'border border-border bg-muted/40 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {st === 'ALL'
                    ? language === 'ja'
                      ? 'すべて'
                      : 'Barchasi'
                    : st === 'mastered'
                      ? language === 'ja'
                        ? '✓ 習得済み'
                        : ' Mustahkamlandi'
                      : st === 'learned'
                        ? language === 'ja'
                          ? '📖 学習中'
                          : " O'rganildi"
                        : st === 'hard'
                          ? language === 'ja'
                            ? '⚡ 苦手・復習'
                            : ' Qiyin'
                          : language === 'ja'
                            ? '✨ 未学習'
                            : ' Yangi'}
                </button>
              ))}
            </div>

            {/* Progress Bar Widget */}
            <div className="flex items-center gap-3">
              <div className="text-xs text-muted-foreground">
                {language === 'ja' ? '進捗率' : 'Progress'} (
                {selectedLevel === 'ALL' && language === 'ja' ? 'すべて' : selectedLevel}):{' '}
                <span className="font-bold text-[#C9A961]">{levelStats.percentage}%</span> (
                {levelStats.mastered + levelStats.learned}/{levelStats.total})
              </div>
              <div className="h-2.5 w-32 overflow-hidden rounded-full border border-border bg-muted">
                <div
                  className="h-full bg-gradient-to-r from-[#C9A961] to-[#E8483A] transition-all duration-500"
                  style={{ width: `${levelStats.percentage}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: GRAMMAR LIST */}
      {activeTab === 'grammar' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredGrammar.map((item) => {
            const status = getItemStatus(item.id);
            const isExported = savedCardIds.includes(item.id);

            return (
              <div
                key={item.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-xs transition-all duration-200 hover:border-primary/40"
              >
                <div>
                  {/* Level Badge & Audio */}
                  <div className="mb-3 flex items-center justify-between">
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-[#C9A961]">
                      {item.level}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => speakText(item.title, 'ja-JP')}
                        className="rounded-xl border border-border bg-muted/60 p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        title="Yaponcha talaffuz"
                      >
                        <Volume2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleExportToFlashcard(item, true)}
                        className={`rounded-xl border p-2 transition ${
                          isExported
                            ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'border-border bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                        title="Flashcards'ga saqlash"
                      >
                        {isExported ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Rule Title & Furigana */}
                  <h3 className="font-japanese mb-1 text-xl font-bold tracking-tight text-foreground transition group-hover:text-primary">
                    <FuriganaText text={item.title} />
                  </h3>
                  <div className="mb-2 font-mono text-xs text-[#C9A961]">{item.romaji}</div>

                  {/* Structure & Uzbek Meaning */}
                  <div className="mb-3 space-y-1 rounded-xl border border-border bg-muted/30 p-2.5">
                    <div className="text-xs font-semibold text-foreground">
                      <span className="text-[#E8483A]">Formula:</span> {item.structure}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span className="text-emerald-600 dark:text-emerald-400">🇺🇿 Ma'nosi:</span>{' '}
                      {item.meaningUz}
                    </div>
                  </div>

                  {/* Example Sentences */}
                  {item.examples.map((ex, idx) => (
                    <div
                      key={idx}
                      className="mb-2 space-y-1 rounded-xl border border-border/80 bg-muted/20 p-3"
                    >
                      <div className="font-japanese flex items-center justify-between text-sm font-medium text-foreground">
                        <span>
                          <FuriganaText text={ex.ja} />
                        </span>
                        <button
                          onClick={() => speakText(ex.ja, 'ja-JP')}
                          className="text-muted-foreground transition hover:text-foreground"
                        >
                          <Volume2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="text-xs italic text-muted-foreground">{ex.romaji}</div>
                      <div className="text-xs text-foreground/90">{ex.uz}</div>
                    </div>
                  ))}
                </div>

                {/* Status Toggle Buttons */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs">
                  <span className="shrink-0 text-muted-foreground">
                    {language === 'ja' ? 'おぼえかた:' : 'Mustahkamlash:'}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => setItemStatus(item.id, 'hard')}
                      className={`rounded-lg border px-2 py-1 transition ${
                        status === 'hard'
                          ? 'border-[#E8483A]/30 bg-rose-500/15 font-bold text-[#E8483A]'
                          : 'border-border bg-muted/30 text-muted-foreground hover:text-[#E8483A]'
                      }`}
                    >
                      {language === 'ja' ? 'むずかしい 🔴' : 'Qiyin 🔴'}
                    </button>
                    <button
                      onClick={() => setItemStatus(item.id, 'learned')}
                      className={`rounded-lg border px-2 py-1 transition ${
                        status === 'learned'
                          ? 'border-emerald-500/30 bg-emerald-500/15 font-bold text-emerald-600 dark:text-emerald-400'
                          : 'border-border bg-muted/30 text-muted-foreground hover:text-emerald-600'
                      }`}
                    >
                      {language === 'ja' ? 'がくしゅうずみ 🟢' : "O'rganildi 🟢"}
                    </button>
                    <button
                      onClick={() => setItemStatus(item.id, 'mastered')}
                      className={`rounded-lg border px-2 py-1 transition ${
                        status === 'mastered'
                          ? 'border-[#C9A961]/30 bg-amber-500/15 font-bold text-[#C9A961]'
                          : 'border-border bg-muted/30 text-muted-foreground hover:text-[#C9A961]'
                      }`}
                    >
                      {language === 'ja' ? 'おぼえた ⚡' : 'Mukammal ⚡'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: KANJI LIST */}
      {activeTab === 'kanji' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredKanji.map((item) => {
            const status = getItemStatus(item.id);
            const isExported = savedCardIds.includes(item.id);

            return (
              <div
                key={item.id}
                className="flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-xs transition-all duration-200 hover:border-primary/40"
              >
                <div>
                  {/* Level Badge & Actions */}
                  <div className="mb-3 flex items-center justify-between">
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-[#C9A961]">
                      {item.level} • {item.strokeCount} {language === 'ja' ? 'かく' : 'chiziq'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => speakText(item.kanji, 'ja-JP')}
                        className="rounded-xl border border-border bg-muted/60 p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        title={language === 'ja' ? 'おんせい' : 'Talaffuz'}
                      >
                        <Volume2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setStrokeModalKanji(item)}
                        className="flex items-center gap-1 rounded-xl border border-amber-500/30 bg-amber-500/10 p-1.5 text-xs font-bold text-[#C9A961] transition hover:bg-amber-500/20"
                        title="Stroke Order Animation"
                      >
                        <Play className="h-3.5 w-3.5" />{' '}
                        {language === 'ja' ? 'かきじゅん' : 'Chizish'}
                      </button>
                      <button
                        onClick={() => handleExportToFlashcard(item, false)}
                        className={`rounded-xl border p-1.5 transition ${
                          isExported
                            ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'border-border bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                        title={
                          language === 'ja' ? 'たんごカードへ ほぞん' : "Flashcards'ga saqlash"
                        }
                      >
                        {isExported ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Kanji Large Render */}
                  <div className="mb-4 flex items-center gap-4">
                    <div
                      onClick={() => setStrokeModalKanji(item)}
                      className="font-japanese flex h-20 w-20 cursor-pointer items-center justify-center rounded-2xl border border-border bg-muted/40 text-4xl font-black text-[#E8483A] shadow-inner transition hover:scale-105"
                    >
                      {item.kanji}
                    </div>
                    <div className="space-y-1">
                      <div className="text-base font-bold text-foreground">{item.meaningUz}</div>
                      <div className="text-xs text-muted-foreground">
                        <span className="font-bold text-[#C9A961]">On:</span> {item.onyomi}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          Kun:
                        </span>{' '}
                        {item.kunyomi}
                      </div>
                    </div>
                  </div>

                  {/* Examples */}
                  <div className="space-y-1.5 rounded-xl border border-border/80 bg-muted/20 p-3">
                    {item.examples.map((ex, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <span className="font-japanese font-semibold text-foreground">
                          {ex.word} ({ex.reading})
                        </span>
                        <span className="text-muted-foreground">{ex.meaning}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Status Toggle Buttons */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs">
                  <span className="shrink-0 text-muted-foreground">
                    {language === 'ja' ? 'じょうたい:' : 'Holat:'}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => setItemStatus(item.id, 'hard')}
                      className={`rounded-lg border px-2 py-0.5 transition ${
                        status === 'hard'
                          ? 'border-[#E8483A]/30 bg-rose-500/15 font-bold text-[#E8483A]'
                          : 'border-border bg-muted/30 text-muted-foreground'
                      }`}
                    >
                      {language === 'ja' ? 'むずかしい 🔴' : 'Qiyin 🔴'}
                    </button>
                    <button
                      onClick={() => setItemStatus(item.id, 'mastered')}
                      className={`rounded-lg border px-2 py-0.5 transition ${
                        status === 'mastered'
                          ? 'border-[#C9A961]/30 bg-amber-500/15 font-bold text-[#C9A961]'
                          : 'border-border bg-muted/30 text-muted-foreground'
                      }`}
                    >
                      {language === 'ja' ? 'おぼえた ⚡' : 'Mukammal ⚡'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 3: QUIZ MODE */}
      {activeTab === 'quiz' && (
        <div className="mx-auto max-w-2xl space-y-6 rounded-3xl border border-border bg-card p-6 shadow-xs md:p-8">
          {!isQuizCompleted && quizQuestions.length > 0 ? (
            <>
              <div className="flex items-center justify-between border-b border-border pb-3 text-xs font-semibold text-muted-foreground">
                <span>
                  Savol {quizIndex + 1} / {quizQuestions.length} ({quizQuestions[quizIndex]?.level})
                </span>
                <span className="font-bold text-[#C9A961]">Joriy Ball: {score}</span>
              </div>

              <h3 className="font-japanese text-xl font-bold leading-relaxed text-foreground">
                {quizQuestions[quizIndex]?.questionText}
              </h3>

              <div className="space-y-3">
                {quizQuestions[quizIndex]?.options.map((opt, idx) => {
                  const isSelected = selectedOption === idx;
                  const isCorrect = idx === quizQuestions[quizIndex].correctAnswer;

                  let btnClass =
                    'w-full text-left p-4 rounded-2xl border text-sm font-semibold transition-all flex items-center justify-between ';

                  if (selectedOption === null) {
                    btnClass += 'bg-muted/30 border-border hover:border-primary/40 text-foreground';
                  } else if (isCorrect) {
                    btnClass +=
                      'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-bold';
                  } else if (isSelected) {
                    btnClass += 'bg-rose-500/15 border-rose-500/40 text-[#E8483A] font-bold';
                  } else {
                    btnClass += 'bg-muted/20 border-border text-muted-foreground';
                  }

                  return (
                    <button key={idx} onClick={() => handleAnswerQuiz(idx)} className={btnClass}>
                      <span>{opt}</span>
                      {selectedOption !== null && isCorrect && (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedOption !== null && (
                <div className="animate-fadeIn space-y-3 rounded-2xl border border-border bg-muted/40 p-4">
                  <div className="text-xs font-medium text-muted-foreground">
                    💡 <span className="font-bold text-foreground">Tushuntirish:</span>{' '}
                    {quizQuestions[quizIndex]?.explanationUzbek}
                  </div>
                  <button
                    onClick={handleNextQuiz}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-xs transition hover:bg-primary/90"
                  >
                    Keyingi Savol <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-5 py-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10 text-2xl font-bold text-[#C9A961]">
                🏆
              </div>
              <h3 className="font-display text-2xl font-black text-foreground">Test Yakunlandi!</h3>
              <p className="text-sm text-muted-foreground">
                Siz {quizQuestions.length} ta savoldan{' '}
                <span className="font-bold text-[#C9A961]">{score} ta</span> to'g'ri javob
                berdingiz. (+{score * 20} XP)
              </p>

              {missedQuizQuestions.length > 0 && (
                <div className="pt-2">
                  <button
                    onClick={handleCreateFlashcardsFromMistakes}
                    disabled={quizFlashcardsSaved}
                    className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-bold shadow-xs transition-all ${
                      quizFlashcardsSaved
                        ? 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : 'bg-primary text-primary-foreground hover:bg-primary/90'
                    }`}
                  >
                    {quizFlashcardsSaved ? (
                      <>
                        <Check className="h-4 w-4" /> Xatolar Fleshkartalarga Qo'shildi!
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" /> {missedQuizQuestions.length} ta Xatolarni
                        Fleshkartaga Aylantirish (Anki SRS)
                      </>
                    )}
                  </button>
                </div>
              )}

              <div className="pt-2">
                <button
                  onClick={resetQuiz}
                  className="rounded-xl border border-border bg-muted px-6 py-3 text-sm font-bold text-foreground transition hover:bg-muted/80"
                >
                  Qayta Boshlash
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Kanji Stroke Order Modal */}
      {strokeModalKanji && (
        <KanjiStrokeOrderModal
          kanji={strokeModalKanji.kanji}
          meaningUz={strokeModalKanji.meaningUz}
          onyomi={strokeModalKanji.onyomi}
          kunyomi={strokeModalKanji.kunyomi}
          strokeCount={strokeModalKanji.strokeCount}
          level={strokeModalKanji.level}
          isOpen={!!strokeModalKanji}
          onClose={() => setStrokeModalKanji(null)}
        />
      )}
    </div>
  );
};

export default JlptGrammarKanjiMaster;
