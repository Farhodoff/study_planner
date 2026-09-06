import React, { useState, Suspense, lazy } from 'react';
import { Target, BookOpen, GraduationCap, Headphones, PenTool } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { RealWeaknessTracker } from '../components/ielts/RealWeaknessTracker';
import { DailyTargetHub } from '../components/ielts/DailyTargetHub';
import { useSEO } from '../hooks/useSEO';

const PersonalPlanPage = lazy(() => import('./PersonalPlanPage'));
const IeltsGrammarMaster = lazy(() => import('../components/ielts/IeltsGrammarMaster'));
const VocabularyGenerator = lazy(() =>
  import('../components/ielts/VocabularyGenerator').then((m) => ({
    default: m.VocabularyGenerator,
  })),
);
const IeltsReadingListeningMockPage = lazy(() =>
  import('./IeltsReadingListeningMockPage').then((m) => ({
    default: m.IeltsReadingListeningMockPage,
  })),
);
const IeltsWritingPage = lazy(() => import('./IeltsWritingPage'));
const DailyReflectionModal = lazy(() =>
  import('../components/ielts/DailyReflectionModal').then((m) => ({
    default: m.DailyReflectionModal,
  })),
);

export const IeltsHubPage: React.FC = () => {
  useSEO({
    title: 'IELTS Master Hub (Shaxsiy Reja, Grammatika, Mocks, Writing)',
    description:
      "IELTS Band 7.5+ uchun maxsus AI shaxsiy o'quv rejasi. Speaking, Writing Task 1 & 2 baholash, Reading & Listening mock testlari va Band 7.5 Grammatika Akademiyasi.",
    canonical: '/ielts',
    keywords:
      "IELTS mock exam O'zbekiston, IELTS Speaking AI, IELTS Writing baholash, IELTS Band 7 grammatika, shaxsiy reja",
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'grammar';

  const [isReflectionOpen, setIsReflectionOpen] = useState(false);

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab });
  };

  return (
    <div className="mx-auto max-w-7xl max-w-full space-y-6 overflow-x-hidden p-3.5 pb-16 sm:p-4 md:space-y-8 md:p-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-amber-500/20 bg-gradient-to-r from-amber-950/80 via-slate-900 to-indigo-950/80 p-6 shadow-2xl backdrop-blur-xl md:p-8">
        <div className="pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/15 px-3 py-1 text-xs font-extrabold text-amber-400">
              <GraduationCap size={14} />
              <span>IELTS MASTER SUITE & ACADEMY</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">
              {activeTab === 'plan'
                ? 'IELTS Shaxsiy Rejangiz'
                : activeTab === 'writing'
                  ? 'IELTS Writing Mock & Examiner'
                  : activeTab === 'reading_listening'
                    ? 'IELTS Reading & Listening Mock'
                    : 'IELTS Band 7.5 Grammatika Akademiyasi'}
            </h1>
            <p className="text-sm leading-relaxed text-slate-300">
              {activeTab === 'plan'
                ? 'Sizning maqsadli Band ballingiz uchun adaptiv kunlik va haftalik vazifalar taqsimoti.'
                : 'Band 7.5+ Grammatika Akademiyasi, Reading/Listening va Writing mock imtihonlari yagona markazda.'}
            </p>
          </div>
        </div>
      </div>

      {/* Unified IELTS Navigation Tabs */}
      <div className="scrollbar-none flex max-w-full items-center gap-1.5 overflow-x-auto rounded-2xl border border-border/80 bg-muted/40 p-1.5">
        <button
          onClick={() => handleTabChange('plan')}
          className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-black transition-all ${
            activeTab === 'plan'
              ? 'bg-amber-600 text-white shadow-md'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Target size={16} /> 🎯 Shaxsiy Rejam & Jadval
        </button>

        <button
          onClick={() => handleTabChange('grammar')}
          className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-black transition-all ${
            activeTab === 'grammar'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <BookOpen size={16} /> 📚 Band 7.5 Grammatika
        </button>

        <button
          onClick={() => handleTabChange('reading_listening')}
          className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-black transition-all ${
            activeTab === 'reading_listening'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Headphones size={16} /> 🎧 Reading & Listening Mock
        </button>

        <button
          onClick={() => handleTabChange('writing')}
          className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-black transition-all ${
            activeTab === 'writing'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <PenTool size={16} /> ✍️ Writing Mock & Examiner
        </button>
      </div>

      {/* Tab Views */}
      <Suspense
        fallback={
          <div className="flex items-center justify-center p-12">
            <div className="border-3 h-8 w-8 animate-spin rounded-full border-amber-500 border-t-transparent" />
          </div>
        }
      >
        {/* Tab 1: Personal Learning Plan & Schedule */}
        {activeTab === 'plan' && (
          <div className="animate-in fade-in">
            <PersonalPlanPage />
          </div>
        )}

        {/* Tab 2: Band 7.5 Grammar Academy & Vocab Tools */}
        {activeTab === 'grammar' && (
          <div className="space-y-8 animate-in fade-in">
            <IeltsGrammarMaster />
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <RealWeaknessTracker />
              <VocabularyGenerator />
            </div>
            <DailyTargetHub onOpenReflection={() => setIsReflectionOpen(true)} />
          </div>
        )}

        {/* Tab 3: Reading & Listening Mock Exam Simulator */}
        {activeTab === 'reading_listening' && (
          <div className="animate-in fade-in">
            <IeltsReadingListeningMockPage />
          </div>
        )}

        {/* Tab 4: Writing Mock & AI Evaluator */}
        {activeTab === 'writing' && (
          <div className="animate-in fade-in">
            <IeltsWritingPage />
          </div>
        )}
      </Suspense>

      {/* Daily Reflection Modal */}
      <Suspense fallback={null}>
        {isReflectionOpen && (
          <DailyReflectionModal
            isOpen={isReflectionOpen}
            onClose={() => setIsReflectionOpen(false)}
          />
        )}
      </Suspense>
    </div>
  );
};

export default IeltsHubPage;
