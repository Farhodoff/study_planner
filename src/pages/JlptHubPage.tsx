import React, { Suspense, lazy } from 'react';
import {
  Target,
  FileText,
  BookOpen,
  Sparkles,
  ArrowRight,
  Languages,
  Compass,
  Headphones,
  GraduationCap,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStudyData } from '../context/StudyPlannerContext';
import { useLanguage } from '../context/LanguageContext';
import { useSEO } from '../hooks/useSEO';

const JlptGrammarKanjiMaster = lazy(() => import('../components/jlpt/JlptGrammarKanjiMaster'));
const KanjiCanvasPractice = lazy(() => import('../components/jlpt/KanjiCanvasPractice'));
const ScenarioPickerPage = lazy(() =>
  import('./ScenarioPickerPage').then((m) => ({ default: m.ScenarioPickerPage })),
);
const JlptReadingPage = lazy(() =>
  import('./JlptReadingPage').then((m) => ({ default: m.JlptReadingPage })),
);
const JlptListeningMockPage = lazy(() =>
  import('./JlptListeningMockPage').then((m) => ({ default: m.JlptListeningMockPage })),
);
const JlptMockExamPage = lazy(() =>
  import('./JlptMockExamPage').then((m) => ({ default: m.JlptMockExamPage })),
);

export const JlptHubPage: React.FC = () => {
  useSEO({
    title: 'JLPT N5-N1 Tayyorgarlik Markazi (Kanji, Grammatika, Mocks)',
    description:
      "Yapon tili JLPT N5 dan N1 gacha bo'lgan to'liq o'quv dasturi. 1000+ Kanji mashqi, grammatika viktorinalari va rasmiy formatdagi mock imtihonlar.",
    canonical: '/jlpt',
    keywords: "JLPT N5 N4 N3 N2 N1, yapon tili o'rganish O'zbekiston, Kanji mashq, JLPT mock exam",
  });

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { settings, updateSettings } = useStudyData();
  const { language } = useLanguage();

  const activeTab = searchParams.get('tab') || 'kanji';

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab });
  };

  return (
    <div className="mx-auto max-w-7xl max-w-full space-y-6 overflow-x-hidden p-3.5 pb-16 sm:p-4 md:space-y-8 md:p-8">
      {/* Header Banner — Sumi-e & Hanko Aesthetic */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-xs md:p-8">
        <div className="relative z-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="max-w-2xl space-y-2">
            <div className="badge-gold">
              <Sparkles size={13} />
              <span>JLPT & KAIWA JAPANESE MASTER</span>
            </div>
            <h1 className="font-display text-3xl font-black tracking-tight text-foreground md:text-4xl">
              {language === 'ja' ? '日本語マスターハブ' : 'Yapon Tili Master Hub'}
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {language === 'ja'
                ? '漢字・文法・読解・聴解・会話シチュエーション・JLPT模擬試験の総合学習センター。'
                : 'Kanji, Grammatika, Dokkai, Choukai, Dialog senariylari va 180 ballik rasmiy JLPT mock imtihonlari bitta markazda.'}
            </p>
          </div>

          <div className="flex w-full flex-wrap items-center gap-3 md:w-auto">
            {/* Furigana & Romaji Controls */}
            <div className="flex items-center rounded-xl border border-border bg-muted/50 p-1">
              <button
                onClick={() => updateSettings({ showFurigana: !settings.showFurigana })}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  settings.showFurigana
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Languages size={13} />
                <span>Furigana</span>
                <span className="text-[10px] opacity-75">
                  {settings.showFurigana ? 'ON' : 'OFF'}
                </span>
              </button>
              <button
                onClick={() => updateSettings({ showRomaji: !settings.showRomaji })}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  settings.showRomaji
                    ? 'border border-[#C9A961]/30 bg-amber-500/15 text-[#C9A961]'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>Romaji</span>
                <span className="ml-1 text-[10px] opacity-75">
                  {settings.showRomaji ? 'ON' : 'OFF'}
                </span>
              </button>
            </div>

            {/* Primary Plan Creator CTA */}
            <button
              onClick={() => navigate('/personal-plan')}
              className="flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-xs transition-all hover:bg-primary/90 active:scale-95"
            >
              <Target size={15} />
              <span>{language === 'ja' ? '学習プラン' : 'Shaxsiy Rejam'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Direct Link to Central Personal Learning Plan */}
      <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-l-4 border-border border-l-primary bg-card p-5 text-foreground shadow-xs md:flex-row md:p-6">
        <div className="flex items-center gap-3.5">
          <div className="shrink-0 rounded-xl border border-border bg-muted/80 p-3 text-primary">
            <Target size={22} />
          </div>
          <div>
            <h2 className="flex items-center gap-2 font-display text-base font-black text-foreground md:text-lg">
              <span>
                {language === 'ja'
                  ? 'JLPT個別学習プラン・レッスン'
                  : 'JLPT Shaxsiy Rejangiz & Darslar'}
              </span>
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                AI Adaptive
              </span>
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {language === 'ja'
                ? '毎日のタスク、スピーキング、漢字、単語帳、模擬試験の自動スケジュール'
                : 'Kunlik va haftalik vazifalar, Speaking, Kanji, Fleshkartalar va Mock imtihonlar taqsimoti'}
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/personal-plan')}
          className="flex w-full shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-muted/80 px-4 py-2 text-xs font-bold text-foreground transition-all hover:bg-muted md:w-auto"
        >
          <span>{language === 'ja' ? '学習プランを開く' : "Shaxsiy Rejamga O'tish"}</span>
          <ArrowRight size={14} />
        </button>
      </div>

      {/* Unified JLPT Skill Navigation Tabs */}
      <div className="scrollbar-none sticky top-0 z-20 flex max-w-full items-center gap-1.5 overflow-x-auto rounded-2xl border border-border bg-card/90 p-1.5 shadow-xs backdrop-blur-md">
        <button
          onClick={() => handleTabChange('kanji')}
          className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
            activeTab === 'kanji'
              ? 'scale-[1.02] bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
          }`}
        >
          <BookOpen size={15} /> {language === 'ja' ? '⛩️ 漢字・文法' : '⛩️ Kanji & Grammatika'}
        </button>

        <button
          onClick={() => handleTabChange('scenarios')}
          className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
            activeTab === 'scenarios'
              ? 'scale-[1.02] bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
          }`}
        >
          <Compass size={15} />{' '}
          {language === 'ja' ? '🎌 会話シチュエーション' : '🎌 Dialog Senariylar'}
        </button>

        <button
          onClick={() => handleTabChange('reading')}
          className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
            activeTab === 'reading'
              ? 'scale-[1.02] bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
          }`}
        >
          <FileText size={15} /> {language === 'ja' ? '📖 読解トレーニング' : "📖 Dokkai (O'qish)"}
        </button>

        <button
          onClick={() => handleTabChange('listening')}
          className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
            activeTab === 'listening'
              ? 'scale-[1.02] bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
          }`}
        >
          <Headphones size={15} />{' '}
          {language === 'ja' ? '🎧 聴解トレーニング' : '🎧 Choukai (Tinglash)'}
        </button>

        <button
          onClick={() => handleTabChange('mock')}
          className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
            activeTab === 'mock'
              ? 'scale-[1.02] bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
          }`}
        >
          <GraduationCap size={15} /> {language === 'ja' ? '🏆 JLPT模擬試験' : '🏆 JLPT Mock Exam'}
        </button>
      </div>

      {/* Tab Views */}
      <Suspense
        fallback={
          <div className="flex items-center justify-center p-12">
            <div className="border-3 h-8 w-8 animate-spin rounded-full border-primary border-t-transparent" />
          </div>
        }
      >
        {/* Tab 1: Kanji Canvas & Bunpou Grammar Master */}
        {activeTab === 'kanji' && (
          <div className="space-y-8 animate-in fade-in">
            <div>
              <KanjiCanvasPractice />
            </div>
            <div>
              <JlptGrammarKanjiMaster />
            </div>
          </div>
        )}

        {/* Tab 2: Conversation Scenarios & Kaiwa Dialogue */}
        {activeTab === 'scenarios' && (
          <div className="animate-in fade-in">
            <ScenarioPickerPage />
          </div>
        )}

        {/* Tab 3: Dokkai (Reading) */}
        {activeTab === 'reading' && (
          <div className="animate-in fade-in">
            <JlptReadingPage />
          </div>
        )}

        {/* Tab 4: Choukai (Listening) */}
        {activeTab === 'listening' && (
          <div className="animate-in fade-in">
            <JlptListeningMockPage />
          </div>
        )}

        {/* Tab 5: Full Mock Exam */}
        {activeTab === 'mock' && (
          <div className="animate-in fade-in">
            <JlptMockExamPage />
          </div>
        )}
      </Suspense>
    </div>
  );
};

export default JlptHubPage;
