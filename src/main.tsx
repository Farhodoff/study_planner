import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { registerSW } from 'virtual:pwa-register';
import { initErrorTracking } from './lib/errorTracking';
import { installConsoleShield } from './lib/consoleFilter';
import { FlashcardOfflineSync } from './services/FlashcardOfflineSync';

import './index.css';

// Xavfsiz konsol filtri va Cookie tozalagichni faollashtirish
installConsoleShield();

// Sentry / Error tracking tizimini ishga tushirish
initErrorTracking();

// Offline-first fleshkartalar avtomatik sinxronizatsiyasi
FlashcardOfflineSync.initAutoSync();

// PWA service worker-ni ro'yxatdan o'tkazish va avtomatik yangilash (kesh tiqilib qolishini oldini olish)
let isRefreshing = false;
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (isRefreshing) return;
    isRefreshing = true;
    console.info('[PWA] Yangi versiya faollashdi. Sahifa avtomatik yangilanmoqda...');
    window.location.reload();
  });
}

const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (registration) {
      // 1. Dastlabki kirganda yangilanishni darhol tekshirish
      registration.update().catch(() => {});

      // 2. Har 60 soniyada yangi deploy borligini tekshirish
      setInterval(() => {
        registration.update().catch(() => {});
      }, 60 * 1000);

      // 3. Foydalanuvchi ilovaga qaytganida (tab active bo'lganda) tekshirish
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          registration.update().catch(() => {});
        }
      });
    }
  },
  onNeedRefresh() {
    console.info('[PWA] Yangi versiya aniqlandi, avtomatik o‘rnatilmoqda...');
    updateSW(true);
  },
  onRegisterError(error) {
    console.warn('[PWA] ServiceWorker registration ignored:', error);
  },
});

// Yangi deploydan keyin keshdagi eski chunklar 404 berganda keshni tozalab avtomatik yangilash
window.addEventListener('vite:preloadError', async (event) => {
  event.preventDefault();
  console.warn(
    '[Vite] Dynamic import preload error detected. Keshlarni tozalab qayta yuklanmoqda...',
  );
  if ('caches' in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch {}
  }
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
