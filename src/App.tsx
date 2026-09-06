import React, { Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Session } from '@supabase/supabase-js';
import ErrorBoundary from './components/ErrorBoundary';
import GlobalAudioPlayer from './components/GlobalAudioPlayer';
import Layout from './components/Layout';
import { StudyPlannerProvider } from './context/StudyPlannerContext';
import { FocusTimerProvider } from './context/FocusTimerContext';
import { LanguageProvider } from './context/LanguageContext';
import { supabase } from './lib/supabase';
import OfflineIndicator from './components/OfflineIndicator';
import { PushNotificationPrompt } from './components/pwa/PushNotificationPrompt';
import { Toaster } from './components/ui/toaster';
import { lazyWithRetry } from './utils/lazyRetry';

const CalendarPage = lazyWithRetry(() => import('./pages/CalendarPage'));
const DecksPage = lazyWithRetry(() => import('./pages/DecksPage'));
const FlashcardForm = lazyWithRetry(() => import('./pages/FlashcardForm'));
const FocusPage = lazyWithRetry(() => import('./pages/FocusPage'));
const SettingsPage = lazyWithRetry(() => import('./pages/SettingsPage'));
const StudyRoomPage = lazyWithRetry(() => import('./pages/StudyRoomPage'));
const SubjectDetailPage = lazyWithRetry(() => import('./pages/SubjectDetailPage'));
const SubjectsPage = lazyWithRetry(() => import('./pages/SubjectsPage'));
const AdminDashboardPage = lazyWithRetry(() => import('./pages/AdminDashboardPage'));
const SpeakingCoachPage = lazyWithRetry(() => import('./pages/SpeakingCoachPage'));
const IeltsHubPage = lazyWithRetry(() => import('./pages/IeltsHubPage'));
const IeltsSpeakingMockPage = lazyWithRetry(() => import('./pages/IeltsSpeakingMockPage'));
const JlptHubPage = lazyWithRetry(() => import('./pages/JlptHubPage'));
const JlptWritingPage = lazyWithRetry(() => import('./pages/JlptWritingPage'));
const VocabularyBuilderPage = lazyWithRetry(() =>
  import('./pages/VocabularyBuilderPage').then((m) => ({ default: m.VocabularyBuilderPage })),
);
const PricingPage = lazyWithRetry(() =>
  import('./pages/PricingPage').then((m) => ({ default: m.PricingPage })),
);
const ExamsManager = lazyWithRetry(() => import('./pages/admin/ExamsManager'));
const QuestionEditor = lazyWithRetry(() => import('./pages/admin/QuestionEditor'));
const ExamTake = lazyWithRetry(() => import('./pages/exams/ExamTake'));
const DeveloperApiPage = lazyWithRetry(() => import('./pages/DeveloperApiPage'));
const LessonPlayerPage = lazyWithRetry(() => import('./pages/LessonPlayerPage'));
const RoadmapPage = lazyWithRetry(() => import('./pages/RoadmapPage'));
const DiagnosticPage = lazyWithRetry(() =>
  import('./pages/DiagnosticPage').then((m) => ({ default: m.DiagnosticPage })),
);
const PersonalPlanPage = lazyWithRetry(() =>
  import('./pages/PersonalPlanPage').then((m) => ({ default: m.PersonalPlanPage })),
);
const StudyModePage = lazyWithRetry(() => import('./pages/StudyModePage'));
const ScenarioPickerPage = lazyWithRetry(() =>
  import('./pages/ScenarioPickerPage').then((m) => ({ default: m.ScenarioPickerPage })),
);
const ProgressPage = lazyWithRetry(() => import('./pages/ProgressPage'));
const TelegramMiniAppPage = lazyWithRetry(() => import('./pages/TelegramMiniAppPage'));
const DashboardPage = lazyWithRetry(() => import('./pages/DashboardPage'));
const LandingPage = lazyWithRetry(() => import('./pages/LandingPage'));

import { isSuperAdmin, isUserAdmin } from './utils/admin';
import { useAuthStore } from './stores';
import { safeLocalStorage } from './utils/storage/safeLocalStorage';
import { isPublicPreviewActive, MOCK_PREVIEW_SESSION } from './config/previewMode';

const SuperAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  if (isPublicPreviewActive()) {
    return <>{children}</>;
  }
  const cachedUser = safeLocalStorage.getJSON<any>('study_planner_user_cache', null);
  const effectiveUser = user || cachedUser;
  if (loading && !effectiveUser) {
    return <PageLoader />;
  }
  if (!isSuperAdmin(effectiveUser?.email)) {
    return <Navigate to="/jlpt" replace />;
  }
  return <>{children}</>;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  if (isPublicPreviewActive()) {
    return <>{children}</>;
  }
  const cachedUser = safeLocalStorage.getJSON<any>('study_planner_user_cache', null);
  const effectiveUser = user || cachedUser;
  if (loading && !effectiveUser) {
    return <PageLoader />;
  }
  if (!isUserAdmin(effectiveUser)) {
    return <Navigate to="/jlpt" replace />;
  }
  return <>{children}</>;
};

// Loading component
const PageLoader = () => (
  <div className="flex h-screen items-center justify-center bg-background text-foreground">
    <div className="text-center">
      <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
      <p className="mt-4 text-muted-foreground">Yuklanmoqda...</p>
    </div>
  </div>
);

import ReloadPrompt from './components/pwa/ReloadPrompt';
import UnauthRouter from './components/UnauthRouter';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(() => {
    if (isPublicPreviewActive()) {
      return MOCK_PREVIEW_SESSION as unknown as Session;
    }
    if (typeof window !== 'undefined') {
      try {
        const rawUser = localStorage.getItem('study_planner_user_cache');
        if (rawUser) {
          const parsed = JSON.parse(rawUser);
          if (parsed && parsed.email) {
            return {
              access_token: 'cached-token',
              token_type: 'bearer',
              expires_in: 360000,
              refresh_token: 'cached-refresh',
              user: parsed,
            } as unknown as Session;
          }
        }
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes('auth-token') || key.includes('supabase.auth.token'))) {
            const raw = localStorage.getItem(key);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (
                parsed &&
                (parsed.access_token ||
                  (parsed.currentSession && parsed.currentSession.access_token))
              ) {
                return parsed.currentSession || parsed;
              }
            }
          }
        }
      } catch {}
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => !session && !isPublicPreviewActive());

  useEffect(() => {
    // Safety timeout: Never leave the UI stuck on "Yuklanmoqda..."
    const safetyTimer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    supabase.auth
      .getSession()
      .then(({ data: { session: fetchedSession } }) => {
        clearTimeout(safetyTimer);
        if (fetchedSession) {
          setSession(fetchedSession);
        } else if (isPublicPreviewActive()) {
          setSession(MOCK_PREVIEW_SESSION as unknown as Session);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        clearTimeout(safetyTimer);
        console.warn('Session check aborted/failed:', err);
        if (isPublicPreviewActive()) {
          setSession(MOCK_PREVIEW_SESSION as unknown as Session);
        }
        setIsLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (newSession) {
        setSession(newSession);
      } else if (isPublicPreviewActive()) {
        setSession(MOCK_PREVIEW_SESSION as unknown as Session);
      }
    });

    const handleStorageAuth = (e: StorageEvent) => {
      if (
        e.key &&
        (e.key.includes('auth-token') || e.key.includes('supabase.auth.token')) &&
        !e.newValue
      ) {
        if (isPublicPreviewActive()) {
          setSession(MOCK_PREVIEW_SESSION as unknown as Session);
        } else {
          setSession(null);
        }
      }
    };

    window.addEventListener('storage', handleStorageAuth);

    return () => {
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
      window.removeEventListener('storage', handleStorageAuth);
    };
  }, []);

  console.log(
    '[App Debug]',
    JSON.stringify({
      sessionUser: session?.user?.email,
      isLoading,
      pathname: typeof window !== 'undefined' ? window.location.pathname : '',
    }),
  );
  if (isLoading) {
    return <PageLoader />;
  }

  if (!session && !isPublicPreviewActive()) {
    return (
      <LanguageProvider>
        <UnauthRouter />
        <ReloadPrompt />
      </LanguageProvider>
    );
  }

  return (
    <ErrorBoundary>
      <LanguageProvider>
        <StudyPlannerProvider>
          <FocusTimerProvider>
            <BrowserRouter>
              <div className="relative h-screen overflow-hidden bg-background text-foreground transition-colors duration-200">
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<Layout />}>
                      <Route index element={<Navigate to="/jlpt" replace />} />
                      <Route path="landing" element={<LandingPage />} />
                      <Route path="dashboard" element={<DashboardPage />} />
                      <Route
                        path="admin"
                        element={
                          <AdminRoute>
                            <AdminDashboardPage />
                          </AdminRoute>
                        }
                      />
                      <Route path="roadmap" element={<RoadmapPage />} />
                      <Route path="personal-plan" element={<PersonalPlanPage />} />
                      <Route path="diagnostic" element={<DiagnosticPage />} />
                      <Route path="lesson/:lessonId" element={<LessonPlayerPage />} />
                      <Route path="speaking" element={<SpeakingCoachPage />} />
                      <Route path="speaking-coach" element={<SpeakingCoachPage />} />
                      <Route
                        path="ielts"
                        element={
                          <SuperAdminRoute>
                            <IeltsHubPage />
                          </SuperAdminRoute>
                        }
                      />
                      <Route
                        path="ielts/grammar"
                        element={
                          <SuperAdminRoute>
                            <Navigate to="/ielts?tab=grammar" replace />
                          </SuperAdminRoute>
                        }
                      />
                      <Route
                        path="ielts/writing"
                        element={
                          <SuperAdminRoute>
                            <Navigate to="/ielts?tab=writing" replace />
                          </SuperAdminRoute>
                        }
                      />
                      <Route
                        path="ielts-writing"
                        element={
                          <SuperAdminRoute>
                            <Navigate to="/ielts?tab=writing" replace />
                          </SuperAdminRoute>
                        }
                      />
                      <Route
                        path="ielts/speaking-mock"
                        element={
                          <SuperAdminRoute>
                            <IeltsSpeakingMockPage />
                          </SuperAdminRoute>
                        }
                      />
                      <Route
                        path="ielts/reading-listening"
                        element={
                          <SuperAdminRoute>
                            <Navigate to="/ielts?tab=reading_listening" replace />
                          </SuperAdminRoute>
                        }
                      />
                      <Route path="jlpt" element={<JlptHubPage />} />
                      <Route path="scenarios" element={<ScenarioPickerPage />} />
                      <Route
                        path="jlpt-speaking"
                        element={<Navigate to="/speaking-coach?lang=ja" replace />}
                      />
                      <Route path="jlpt-writing" element={<JlptWritingPage />} />
                      <Route
                        path="jlpt/listening"
                        element={<Navigate to="/jlpt?tab=listening" replace />}
                      />
                      <Route
                        path="jlpt/grammar"
                        element={<Navigate to="/jlpt?tab=kanji" replace />}
                      />
                      <Route
                        path="jlpt/grammar-quiz"
                        element={<Navigate to="/jlpt?tab=kanji" replace />}
                      />
                      <Route
                        path="jlpt/reading"
                        element={<Navigate to="/jlpt?tab=reading" replace />}
                      />
                      <Route
                        path="jlpt/mock-exam"
                        element={<Navigate to="/jlpt?tab=mock" replace />}
                      />
                      <Route path="calendar" element={<CalendarPage />} />
                      <Route path="subjects" element={<SubjectsPage />} />
                      <Route path="subjects/:id" element={<SubjectDetailPage />} />
                      <Route path="plan" element={<Navigate to="/personal-plan" replace />} />
                      <Route path="goals" element={<Navigate to="/personal-plan" replace />} />
                      <Route path="tasks" element={<Navigate to="/personal-plan" replace />} />
                      <Route path="focus" element={<FocusPage />} />
                      <Route path="ai" element={<Navigate to="/speaking-coach" replace />} />
                      <Route path="flashcards" element={<DecksPage />} />
                      <Route path="deck" element={<Navigate to="/flashcards" replace />} />
                      <Route path="decks" element={<Navigate to="/flashcards" replace />} />
                      <Route path="deck/:id" element={<Navigate to="/flashcards" replace />} />
                      <Route path="decks/:id" element={<Navigate to="/flashcards" replace />} />
                      <Route path="flashcards/new" element={<FlashcardForm />} />
                      <Route path="study-mode" element={<StudyModePage />} />
                      <Route path="study-mode/:subjectId" element={<StudyModePage />} />
                      <Route path="flashcards/study/:subjectId" element={<StudyModePage />} />
                      <Route path="progress" element={<ProgressPage />} />
                      <Route path="vocabulary" element={<VocabularyBuilderPage />} />
                      <Route path="pricing" element={<PricingPage />} />
                      <Route path="room/:roomId" element={<StudyRoomPage />} />
                      <Route path="settings" element={<SettingsPage />} />
                      <Route path="twa" element={<TelegramMiniAppPage />} />
                      <Route path="developers" element={<DeveloperApiPage />} />
                      <Route path="api-docs" element={<Navigate to="/developers" replace />} />
                      <Route
                        path="admin/exams"
                        element={
                          <AdminRoute>
                            <ExamsManager />
                          </AdminRoute>
                        }
                      />
                      <Route
                        path="admin/exams/:id"
                        element={
                          <AdminRoute>
                            <QuestionEditor />
                          </AdminRoute>
                        }
                      />
                      <Route path="exams/:id" element={<ExamTake />} />
                      <Route path="auth" element={<Navigate to="/jlpt" replace />} />
                      <Route path="login" element={<Navigate to="/jlpt" replace />} />
                      <Route path="register" element={<Navigate to="/jlpt" replace />} />
                      <Route path="signup" element={<Navigate to="/jlpt" replace />} />
                      <Route path="*" element={<Navigate to="/jlpt" replace />} />
                    </Route>
                    <Route path="/auth" element={<Navigate to="/jlpt" replace />} />
                    <Route path="/login" element={<Navigate to="/jlpt" replace />} />
                    <Route path="/register" element={<Navigate to="/jlpt" replace />} />
                    <Route path="/signup" element={<Navigate to="/jlpt" replace />} />
                    <Route path="*" element={<Navigate to="/jlpt" replace />} />
                  </Routes>
                </Suspense>
                <GlobalAudioPlayer />

                {/* PWA Prompts */}
                <ReloadPrompt />
                <PushNotificationPrompt />

                <OfflineIndicator />
                <Toaster />
              </div>
            </BrowserRouter>
          </FocusTimerProvider>
        </StudyPlannerProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
};

export default App;
