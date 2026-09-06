import React, { useState } from 'react';
import { useStudyData } from '../context/StudyPlannerContext';
import { useLanguage } from '../context/LanguageContext';
import { requestNotificationPermission } from '../utils/notifications';
import PreferencesSection from '../components/settings/PreferencesSection';
import AccountSection from '../components/settings/AccountSection';
import {
  User,
  Sliders,
  Shield,
  Send,
  Flame,
  Award,
  Clock,
  Sparkles,
  Mail,
  Star,
} from 'lucide-react';
import { isAdminEmail, isSuperAdmin } from '../utils/admin';
import { toast } from '../hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

import AdminDashboardPage from './AdminDashboardPage';
import TelegramSection from '../components/settings/TelegramSection';
import { useSettingsStore, useRatingModalStore } from '../stores';

const SettingsPage: React.FC = () => {
  const { settings, updateSettings } = useSettingsStore();
  const { user, getRank } = useStudyData();
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState('profile');
  const openRatingModal = useRatingModalStore((s) => s.openModal);

  const displayEmail = user?.email || '';
  const isCurrentSuperAdmin = Boolean(displayEmail && isSuperAdmin(displayEmail));
  const isCurrentAdmin = Boolean(displayEmail && isAdminEmail(displayEmail, (user as any)?.role));

  const tabs = [
    {
      id: 'profile',
      label: language === 'ja' ? 'プロフィール・アカウント' : 'Profil & Hisob',
      icon: User,
    },
    { id: 'telegram', label: language === 'ja' ? 'Telegram 連携' : 'Telegram Bot', icon: Send },
    {
      id: 'preferences',
      label: language === 'ja' ? '学習設定・システム' : "O'quv Yo'nalishi & Tizim",
      icon: Sliders,
    },
  ];

  // Admin bo'lsa Admin tab qo'shamiz
  if (isCurrentAdmin) {
    tabs.push({
      id: 'admin',
      label: language === 'ja' ? '管理者パネル' : 'Admin Panel',
      icon: Shield,
    });
  }

  const toggleNotifications = async () => {
    if (!settings.notificationsEnabled) {
      const granted = await requestNotificationPermission();
      if (granted) {
        updateSettings({ notificationsEnabled: true });
        toast({
          title: language === 'ja' ? '🔔 通知が有効になりました' : '🔔 Bildirishnomalar yoqildi',
        });
      } else {
        toast({
          variant: 'destructive',
          title: language === 'ja' ? '❌ 許可が拒否されました' : '❌ Ruxsat rad etildi',
        });
      }
    } else {
      updateSettings({ notificationsEnabled: false });
      toast({
        title: language === 'ja' ? '🔕 通知が無効になりました' : "🔕 Bildirishnomalar o'chirildi",
      });
    }
  };

  const rankTitle = getRank ? getRank(settings.level || 1) : 'Bilimdon';
  const userName =
    user?.user_metadata?.full_name ||
    (displayEmail ? displayEmail.split('@')[0] : language === 'ja' ? '学習者' : 'Talaba');

  return (
    <div className="mx-auto min-h-screen max-w-5xl space-y-8 p-4 pb-28 duration-300 animate-in fade-in md:p-8 md:pb-12">
      {/* Hero Profile Banner — Sumi-e & Hanko Aesthetic */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-xs md:p-8">
        <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          {/* Left: Avatar & Identity */}
          <div className="flex items-center gap-5">
            <div className="relative shrink-0">
              {/* Neutral Sumi Avatar */}
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-muted/90 font-display text-2xl font-black text-foreground shadow-xs ring-1 ring-border/50 md:h-20 md:w-20 md:text-3xl">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="absolute -bottom-1.5 -right-1.5 rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-bold text-muted-foreground shadow-xs">
                Lvl {settings.level || 1}
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-display text-2xl font-black tracking-tight text-foreground md:text-3xl">
                  {userName}
                </h1>
                {isCurrentSuperAdmin ? (
                  <span className="badge-gold font-black">👑 SUPER ADMIN</span>
                ) : isCurrentAdmin ? (
                  <span className="badge-hanko font-black">🛡️ ADMIN</span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    {language === 'ja' ? '🎓 学習者' : "🎓 O'QUVCHI"}
                  </span>
                )}
              </div>
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground md:text-sm">
                <Mail size={14} className="shrink-0 text-muted-foreground" />
                <span className="font-semibold text-foreground/90">{displayEmail}</span>
              </p>
            </div>
          </div>

          {/* Right: 4 Standout Quick Stats (Visual Hierarchy with Bold Numbers + Light Captions) */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            <div className="backdrop-blur-xs rounded-2xl border border-border bg-muted/30 p-3.5 text-center transition-all hover:border-amber-500/30">
              <div className="mb-1 flex items-center justify-center gap-1 text-[#C9A961]">
                <Flame size={15} />
                <span className="text-[11px] font-bold uppercase tracking-wider">
                  {language === 'ja' ? '連続日数' : 'Streak'}
                </span>
              </div>
              <div className="text-xl font-black tabular-nums tracking-tight text-foreground md:text-2xl">
                {settings.currentStreak || 0}
              </div>
              <div className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                {language === 'ja' ? '日連続' : 'kun ketma-ket'}
              </div>
            </div>

            <div className="backdrop-blur-xs rounded-2xl border border-border bg-muted/30 p-3.5 text-center transition-all hover:border-border">
              <div className="mb-1 flex items-center justify-center gap-1 text-[#C9A961]">
                <Award size={15} />
                <span className="text-[11px] font-bold uppercase tracking-wider">
                  {language === 'ja' ? 'ランク' : 'Daraja'}
                </span>
              </div>
              <div className="text-xl font-black tabular-nums tracking-tight text-foreground md:text-2xl">
                {settings.level || 1}
              </div>
              <div className="mx-auto mt-0.5 max-w-[90px] truncate text-[11px] font-medium text-muted-foreground">
                {rankTitle}
              </div>
            </div>

            <div className="backdrop-blur-xs rounded-2xl border border-border bg-muted/30 p-3.5 text-center transition-all hover:border-border">
              <div className="mb-1 flex items-center justify-center gap-1 text-muted-foreground">
                <Clock size={15} />
                <span className="text-[11px] font-bold uppercase tracking-wider">
                  {language === 'ja' ? '目標時間' : 'Maqsad'}
                </span>
              </div>
              <div className="text-xl font-black tabular-nums tracking-tight text-foreground md:text-2xl">
                {Math.floor((settings.dailyStudyGoalMinutes || 240) / 60)}
              </div>
              <div className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                {language === 'ja' ? '時間/日' : 'soat/kun'}
              </div>
            </div>

            <div className="backdrop-blur-xs rounded-2xl border border-border bg-muted/30 p-3.5 text-center transition-all hover:border-emerald-500/30">
              <div className="mb-1 flex items-center justify-center gap-1 text-emerald-500">
                <Sparkles size={15} />
                <span className="text-[11px] font-bold uppercase tracking-wider">
                  {language === 'ja' ? 'AIクレジット' : 'AI Kredit'}
                </span>
              </div>
              <div className="pt-1 text-base font-black tracking-tight text-emerald-600 dark:text-emerald-400 md:text-lg">
                {language === 'ja' ? '無制限' : 'Cheksiz'}
              </div>
              <div className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                {language === 'ja' ? '完全無料' : 'Har doim bepul'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rate App & Leave Feedback Banner */}
      <div className="flex flex-col items-center justify-between gap-4 rounded-3xl border border-amber-500/25 bg-gradient-to-r from-amber-500/10 via-card to-primary/10 p-5 shadow-xs sm:flex-row">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-500 shadow-inner">
            <Star className="h-6 w-6 fill-amber-400 text-amber-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground sm:text-base">
              {language === 'ja'
                ? 'アプリを評価・フィードバック'
                : 'Ilovani baholash va fikr bildirish'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {language === 'ja'
                ? '星評価やご意見を直接Telegram bot orqali jamoamizga yuboring'
                : 'App Store uslubida yulduzchalar bilan baholang va fikringizni botga yuboring'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => openRatingModal()}
          className="flex shrink-0 items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-amber-500/25 transition hover:brightness-105 active:scale-95"
        >
          <Star className="h-4 w-4 fill-white" />
          {language === 'ja' ? '評価する (5★)' : 'Baholash (5★)'}
        </button>
      </div>

      {/* Navigation Tabs (Horizontal Scrollable Pills) */}
      <div className="scrollbar-hide sticky top-0 z-20 flex gap-1.5 overflow-x-auto rounded-2xl border border-border bg-card/90 p-1.5 shadow-xs backdrop-blur-md">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex select-none items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-bold transition-all duration-200 ${
                isActive
                  ? 'scale-[1.02] bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                  : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
              }`}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Contents with Framer Motion Animation */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="mt-6"
        >
          {activeTab === 'profile' && <AccountSection />}

          {activeTab === 'telegram' && <TelegramSection />}

          {activeTab === 'preferences' && (
            <PreferencesSection settings={settings} onToggleNotifications={toggleNotifications} />
          )}

          {activeTab === 'admin' && <AdminDashboardPage />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default SettingsPage;
