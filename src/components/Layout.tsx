import React, { useState, useMemo, useEffect } from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Menu,
  Settings as SettingsIcon,
  Mic,
  Brain,
  Sparkles,
  Shield,
  BarChart3,
  Star,
} from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { SessionCompleteModal } from './SessionCompleteModal';
import { RatingReviewModal } from './feedback';
import { useRatingModalStore } from '../stores';
import { useFocusTimerContext } from '../context/FocusTimerContext';
import { useLanguage } from '../context/LanguageContext';
import { useStudyData } from '../context/StudyPlannerContext';
import { isAdminEmail, isSuperAdmin } from '../utils/admin';
import { AnimatePresence, motion } from 'framer-motion';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import { Button } from './ui/Button';
import { AppLogo } from './AppLogo';
import { UzbekistanFlag, JapanFlag } from './common/FlagIcons';
import { GlobalAnnouncementBanner } from './GlobalAnnouncementBanner';
import { QuickCommandPalette } from './common/QuickCommandPalette';

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<any>;
}

const Layout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { focusState } = useFocusTimerContext();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('study_planner_sidebar_collapsed');
    return saved === 'true';
  });

  const { language, setLanguage, t } = useLanguage();
  const { user, primaryLanguage, enabledLanguages, targetLevel, setPrimaryFocus } = useStudyData();
  const displayEmail = user?.email || '';
  const isAdmin = Boolean(displayEmail && isAdminEmail(displayEmail, (user as any)?.role));
  const isSuper = Boolean(displayEmail && isSuperAdmin(displayEmail));

  const isRatingOpen = useRatingModalStore((s) => s.isOpen);
  const isRatingSubmitting = useRatingModalStore((s) => s.isSubmitting);
  const closeRatingModal = useRatingModalStore((s) => s.closeModal);
  const openRatingModal = useRatingModalStore((s) => s.openModal);
  const submitRatingReview = useRatingModalStore((s) => s.submitReview);
  const initialRating = useRatingModalStore((s) => s.initialRating);
  const initialCategory = useRatingModalStore((s) => s.initialCategory);

  // Global Keyboard Shortcuts (Cmd/Ctrl+K for Quick Command Palette)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const isFullScreenPage = React.useMemo(() => {
    const fullScreenPaths = [
      '/speaking-coach',
      '/room',
      '/focus',
      '/ielts/speaking-mock',
      '/jlpt/listening',
    ];
    return fullScreenPaths.some((p) => location.pathname.startsWith(p));
  }, [location.pathname]);

  const navItems: NavItem[] = useMemo(() => {
    const isJa = language === 'ja';
    // Super Admin can switch to English (IELTS) track for development
    if (isSuper && primaryLanguage === 'en') {
      return [
        { name: isJa ? '単語・語彙分析' : 'Vocabulary', path: '/vocabulary?lang=en', icon: Brain },
        { name: isJa ? 'IELTSマスター' : 'IELTS Master', path: '/ielts', icon: BookOpen },
        { name: isJa ? '会話シナリオ' : 'Scenarios', path: '/scenarios?lang=en', icon: Sparkles },
        { name: isJa ? 'AIスピーキング' : 'Speaking', path: '/speaking-coach?lang=en', icon: Mic },
        { name: isJa ? 'フラッシュカード' : 'Fleshkard', path: '/flashcards', icon: Copy },
        { name: isJa ? '集中タイマー' : 'Pomodoro', path: '/focus', icon: Clock },
        { name: isJa ? '進捗・分析' : 'Progress', path: '/progress', icon: BarChart3 },
      ];
    }

    // Public Focus: 100% Japanese (JLPT)
    return [
      { name: isJa ? 'JLPTマスター' : 'JLPT Master', path: '/jlpt', icon: BookOpen },
      { name: isJa ? '単語・語彙分析' : 'Vocabulary', path: '/vocabulary?lang=ja', icon: Brain },
      { name: isJa ? '会話シナリオ' : 'Scenarios', path: '/scenarios?lang=ja', icon: Sparkles },
      { name: isJa ? 'AIスピーキング' : 'Speaking', path: '/speaking-coach?lang=ja', icon: Mic },
      { name: isJa ? 'フラッシュカード' : 'Fleshkard', path: '/flashcards', icon: Copy },
      { name: isJa ? '集中タイマー' : 'Pomodoro', path: '/focus', icon: Clock },
      { name: isJa ? '進捗・分析' : 'Progress', path: '/progress', icon: BarChart3 },
    ];
  }, [primaryLanguage, isSuper, language]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getPageTitle = () => {
    const isJa = language === 'ja';
    const found = navItems.find((item) => item.path === location.pathname);
    if (found) return found.name;
    if (location.pathname.startsWith('/scenarios')) return isJa ? '会話シナリオ' : 'Scenarios';
    if (location.pathname.startsWith('/speaking-coach'))
      return isJa ? 'AIスピーキング' : 'Speaking';
    if (location.pathname === '/jlpt') return isJa ? 'JLPTマスター' : 'JLPT Master';
    if (location.pathname === '/ielts') return isJa ? 'IELTSマスター' : 'IELTS Master';
    if (location.pathname === '/progress')
      return isJa ? '学習進捗 & アナリティクス' : "O'quv Statistikasi & Progress";
    if (location.pathname === '/admin')
      return isJa ? 'システム管理者ダッシュボード' : 'Super Admin Paneli';
    if (location.pathname === '/personal-plan') return isJa ? '個人学習プラン' : 'Shaxsiy Rejam';
    if (location.pathname === '/settings') return isJa ? '設定' : 'Sozlamalar';
    return 'Nihongo Talk';
  };

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <div className="scrollbar-hide flex-1 space-y-1.5 overflow-y-auto px-3.5 py-3">
      {/* Direct Flat Menu Items */}
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          onClick={onClick}
          className={({ isActive }) =>
            `group relative flex items-center ${isCollapsed ? 'justify-center' : ''} gap-3.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 ${
              isActive
                ? 'bg-primary/10 font-bold text-primary shadow-xs'
                : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
            }`
          }
          title={isCollapsed ? item.name : ''}
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <motion.div
                  layoutId="activeNavIndicator"
                  className="absolute left-0 h-6 w-1.5 rounded-r-full bg-primary"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
              <item.icon
                size={19}
                className={`transition-transform duration-200 ${isCollapsed ? '' : 'group-hover:scale-105'} ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
                strokeWidth={isActive ? 2.5 : 2}
              />
              {!isCollapsed && (
                <span className="truncate font-medium tracking-tight">{item.name}</span>
              )}
            </>
          )}
        </NavLink>
      ))}
    </div>
  );

  return (
    <div className="flex h-screen w-full max-w-[100vw] flex-col overflow-hidden bg-background font-sans text-foreground transition-colors duration-300 md:flex-row">
      {/* Mini Timer Overlay */}
      {focusState.isActive && location.pathname !== '/focus' && (
        <div
          onClick={() => navigate('/focus')}
          className={`fixed ${isFullScreenPage ? 'bottom-28 right-6 md:bottom-24' : 'bottom-20 right-6 md:bottom-6'} glass-card group z-50 flex cursor-pointer items-center gap-3 rounded-2xl p-3 shadow-xl transition-all animate-in slide-in-from-bottom-4 hover:scale-105`}
        >
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-primary/20">
              <Clock size={18} className="animate-pulse text-primary" />
            </div>
            <svg className="absolute inset-0 h-10 w-10 -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                strokeDasharray="283"
                strokeDashoffset={
                  283 -
                  (283 *
                    ((focusState.mode === 'focus'
                      ? 25 * 60
                      : focusState.mode === 'short_break'
                        ? 5 * 60
                        : 15 * 60) -
                      focusState.timeLeft)) /
                    (focusState.mode === 'focus'
                      ? 25 * 60
                      : focusState.mode === 'short_break'
                        ? 5 * 60
                        : 15 * 60)
                }
                className="text-primary transition-all duration-1000"
              />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="mb-1 text-[10px] font-bold uppercase leading-none tracking-widest text-muted-foreground">
              {focusState.mode === 'focus'
                ? language === 'ja'
                  ? '集中'
                  : 'Fokus'
                : language === 'ja'
                  ? '休憩'
                  : 'Tanaffus'}
            </span>
            <span className="font-mono text-lg font-bold tabular-nums leading-none text-foreground">
              {formatTime(focusState.timeLeft)}
            </span>
          </div>
          <div className="ml-1 opacity-0 transition-opacity group-hover:opacity-100">
            <ChevronRight size={16} className="text-muted-foreground" />
          </div>
        </div>
      )}

      {/* Mobile Header */}
      <header className="glass-card relative z-30 flex items-center justify-between border-b px-4 py-2.5 pt-[max(env(safe-area-inset-top),0.65rem)] md:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <AppLogo size="sm" showText={false} />
          <h1 className="text-gradient truncate text-lg font-bold">{getPageTitle()}</h1>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setLanguage(language === 'uz' ? 'ja' : 'uz')}
            className="flex items-center gap-1 rounded-xl border border-border/80 bg-muted/80 px-2 py-1 text-[11px] font-bold text-muted-foreground shadow-xs transition-all hover:bg-muted hover:text-foreground active:scale-95"
            title={language === 'uz' ? '日本語 (JA)' : "O'zbekcha (UZ)"}
          >
            {language === 'uz' ? (
              <>
                <UzbekistanFlag className="h-2.5 w-3.5" />
                <span>UZ</span>
              </>
            ) : (
              <>
                <JapanFlag className="h-2.5 w-3.5" />
                <span>JA</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => openRatingModal()}
            className="flex items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/10 p-1.5 text-amber-500 transition hover:bg-amber-500/20 active:scale-95"
            title={language === 'ja' ? '評価' : 'Baholash'}
          >
            <Star size={16} className="fill-amber-400" />
          </button>

          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="flex items-center justify-center rounded-xl border border-border bg-muted/80 p-1.5 text-foreground transition hover:bg-muted active:scale-95"
            aria-label="Menyu"
          >
            <Menu size={18} />
          </button>
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside
        className={`relative hidden translate-x-0 flex-col md:flex ${isCollapsed ? 'w-20' : 'w-64'} z-30 border-r border-border/70 bg-card/95 backdrop-blur-md transition-all duration-300 ease-in-out`}
      >
        {/* Logo Area */}
        <div
          className={`flex h-16 items-center px-4 py-3 ${isCollapsed ? 'justify-center' : 'justify-between'} border-b border-border bg-card`}
        >
          <AppLogo size="md" collapsed={isCollapsed} />

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden rounded-xl text-muted-foreground hover:bg-muted/80 hover:text-foreground md:flex"
            aria-label={isCollapsed ? 'Sidebar-ni ochish' : 'Sidebar-ni yopish'}
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </Button>
        </div>

        {/* Secondary Focus Quick Switcher (Only for Super Admin when 2 languages enabled) */}
        {isSuper && enabledLanguages.length > 1 && (
          <div className={`px-3.5 pb-1 pt-2.5 ${isCollapsed ? 'flex justify-center px-1' : ''}`}>
            {!isCollapsed ? (
              <div
                className={`flex items-center justify-between rounded-xl border px-3 py-1.5 transition-all ${
                  primaryLanguage === 'ja'
                    ? 'border-rose-500/30 bg-rose-950/25 text-rose-300'
                    : 'border-indigo-500/30 bg-indigo-950/25 text-indigo-300'
                }`}
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="text-sm">{primaryLanguage === 'ja' ? '🇯🇵' : '🇬🇧'}</span>
                  <span className="truncate text-xs font-bold text-foreground">
                    {primaryLanguage === 'ja'
                      ? `JLPT ${targetLevel || 'N3'}`
                      : `IELTS ${targetLevel || 'B2'}`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPrimaryFocus(primaryLanguage === 'en' ? 'ja' : 'en')}
                  className="shrink-0 rounded-lg border border-border bg-background/80 px-2 py-0.5 text-[10px] font-bold text-muted-foreground shadow-xs transition-all hover:bg-background hover:text-foreground"
                  title="Boshqa tilga o'tish"
                >
                  ⇄ Almashtirish
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setPrimaryFocus(primaryLanguage === 'en' ? 'ja' : 'en')}
                className={`flex h-9 w-9 items-center justify-center rounded-xl border text-sm transition-all ${
                  primaryLanguage === 'ja'
                    ? 'border-rose-500/30 bg-rose-950/30'
                    : 'border-indigo-500/30 bg-indigo-950/30'
                }`}
                title={
                  primaryLanguage === 'ja'
                    ? `🇯🇵 JLPT ${targetLevel || 'N3'}`
                    : `🇬🇧 IELTS ${targetLevel || 'B2'}`
                }
              >
                {primaryLanguage === 'ja' ? '🇯🇵' : '🇬🇧'}
              </button>
            )}
          </div>
        )}

        {/* Navigation Links */}
        <NavLinks />

        {/* Bottom Section: Settings & Admin */}
        <div className="space-y-2 border-t border-border/60 bg-card/80 p-3.5">
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `flex w-full items-center ${isCollapsed ? 'justify-center' : ''} gap-3 rounded-xl px-3 py-2 text-xs font-bold transition-all duration-200 ${
                  isActive
                    ? 'border border-rose-500/30 bg-rose-500/15 text-rose-400 shadow-xs'
                    : 'border border-rose-500/20 text-rose-400/90 hover:bg-rose-500/10 hover:text-rose-400'
                }`
              }
              title={isCollapsed ? 'Admin Panel' : ''}
            >
              <Shield size={16} className="shrink-0 text-rose-500" />
              {!isCollapsed && <span>{language === 'ja' ? '管理コンソール' : 'Admin Panel'}</span>}
            </NavLink>
          )}

          {/* Quick Rate App & Feedback Button */}
          <button
            type="button"
            onClick={() => openRatingModal()}
            className={`flex w-full items-center ${isCollapsed ? 'justify-center' : ''} gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-600 shadow-xs transition-all hover:bg-amber-500/20 active:scale-95 dark:text-amber-400`}
            title={language === 'ja' ? 'アプリを評価・フィードバック' : 'Ilovani baholash (5★)'}
          >
            <Star size={16} className="shrink-0 fill-amber-400 text-amber-500" />
            {!isCollapsed && <span>{language === 'ja' ? '⭐ アプリ評価' : '⭐ Baholash'}</span>}
          </button>

          <div className="flex items-center gap-1.5">
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `flex flex-1 items-center ${isCollapsed ? 'justify-center' : ''} gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-primary/10 font-bold text-primary shadow-xs'
                    : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                }`
              }
              title={isCollapsed ? (language === 'ja' ? '設定' : 'Sozlamalar') : ''}
            >
              <SettingsIcon size={16} />
              {!isCollapsed && <span>{language === 'ja' ? '設定' : 'Sozlamalar'}</span>}
            </NavLink>

            <button
              onClick={() => setLanguage(language === 'uz' ? 'ja' : 'uz')}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border/80 bg-muted/80 px-2.5 py-1.5 text-[11px] font-bold text-muted-foreground shadow-xs transition-all hover:bg-muted hover:text-foreground"
              title={
                language === 'uz' ? '日本語に切り替え (Switch to Japanese)' : "O'zbek tiliga o'tish"
              }
            >
              {language === 'uz' ? (
                <>
                  <UzbekistanFlag className="h-2.5 w-4" />
                  <span>UZ</span>
                </>
              ) : (
                <>
                  <JapanFlag className="h-2.5 w-4" />
                  <span>JA</span>
                </>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="relative flex w-full max-w-full flex-1 flex-col overflow-hidden bg-background">
        <GlobalAnnouncementBanner />
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className={`w-full max-w-full overflow-x-hidden ${
              isFullScreenPage
                ? 'flex h-full flex-col overflow-hidden'
                : 'h-full overflow-y-auto pb-24 md:pb-6'
            }`}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="glass-card fixed bottom-0 z-40 flex w-full items-center justify-around border-t border-border bg-background/90 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5 backdrop-blur-md md:hidden">
        {[
          {
            name: isSuper && primaryLanguage === 'en' ? 'IELTS' : 'JLPT',
            path: isSuper && primaryLanguage === 'en' ? '/ielts' : '/jlpt',
            icon: BookOpen,
          },
          { name: t('nav.aiCoach') || 'Speaking', path: '/speaking-coach', icon: Mic },
          { name: t('nav.flashcards') || 'Fleshkard', path: '/flashcards', icon: Copy },
          { name: t('nav.focus') || 'Pomodoro', path: '/focus', icon: Clock },
        ].map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex w-16 flex-col items-center justify-center rounded-xl p-1.5 transition-all duration-200 ${isActive ? 'scale-105 bg-primary/10 font-bold text-primary' : 'text-muted-foreground hover:text-foreground'}`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon size={20} className="mb-1" strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-medium leading-none">{item.name}</span>
              </>
            )}
          </NavLink>
        ))}

        <Sheet open={isSidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <button
              aria-label="Menyuni ochish"
              className="flex w-16 flex-col items-center justify-center rounded-xl p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <Menu size={20} className="mb-1" />
              <span className="text-[10px] font-medium leading-none">Menyu</span>
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-72 flex-col bg-card p-0">
            <div className="flex h-16 items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-2">
                <AppLogo size="sm" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <NavLinks onClick={() => setSidebarOpen(false)} />
            </div>
            <div className="space-y-2 border-t border-border/60 bg-card/80 p-3.5">
              <button
                type="button"
                onClick={() => {
                  setSidebarOpen(false);
                  openRatingModal();
                }}
                className="flex w-full items-center gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-600 transition hover:bg-amber-500/20 active:scale-95 dark:text-amber-400"
              >
                <Star size={16} className="shrink-0 fill-amber-400 text-amber-500" />
                <span>{language === 'ja' ? '⭐ アプリを評価する' : '⭐ Ilovani baholash'}</span>
              </button>

              {isAdmin && (
                <NavLink
                  to="/admin"
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-bold transition-all duration-200 ${
                      isActive
                        ? 'border border-rose-500/30 bg-rose-500/15 text-rose-400 shadow-xs'
                        : 'border border-rose-500/20 text-rose-400/90 hover:bg-rose-500/10 hover:text-rose-400'
                    }`
                  }
                >
                  <Shield size={16} className="shrink-0 text-rose-500" />
                  <span>Admin Panel</span>
                </NavLink>
              )}
              <NavLink
                to="/settings"
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-primary/10 font-bold text-primary shadow-xs'
                      : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                  }`
                }
              >
                <SettingsIcon size={16} className="shrink-0" />
                <span>{t('nav.settings') || 'Sozlamalar'}</span>
              </NavLink>
            </div>
          </SheetContent>
        </Sheet>
      </nav>

      {/* Quick Command Palette (Cmd/Ctrl + K) */}
      <QuickCommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />

      {/* Global Modals */}
      <SessionCompleteModal />
      <RatingReviewModal
        isOpen={isRatingOpen}
        onClose={closeRatingModal}
        onSubmit={submitRatingReview}
        isSubmitting={isRatingSubmitting}
        initialRating={initialRating}
        initialCategory={initialCategory}
      />
    </div>
  );
};

export default Layout;
