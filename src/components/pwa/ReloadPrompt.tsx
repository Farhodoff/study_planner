import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

const ReloadPrompt: React.FC = () => {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (r) {
        // Sahifaga kirganda va har 60 soniyada yangi versiya borligini xavfsiz tekshirish
        r.update().catch(() => {});
        setInterval(() => {
          r.update().catch(() => {});
        }, 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.warn('[PWA] ServiceWorker registration warning:', error);
    },
  });

  React.useEffect(() => {
    if (needRefresh) {
      // Avtomatik yangilash (keshni qo'lda tozalash yoki tugma bosish shart emas)
      const timer = setTimeout(() => {
        updateServiceWorker(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [needRefresh, updateServiceWorker]);

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!offlineReady && !needRefresh) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[100] duration-300 animate-in slide-in-from-bottom-10 md:bottom-8 md:left-auto md:right-8">
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-2xl dark:border-gray-700 dark:bg-gray-800 md:flex-row md:p-5">
        <div className="flex flex-1 items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-900/30">
            <RefreshCw
              className={`h-6 w-6 text-indigo-600 dark:text-indigo-400 ${needRefresh ? 'animate-spin' : ''}`}
            />
          </div>
          <div>
            <h4 className="font-bold text-gray-900 dark:text-white">
              {offlineReady ? 'Offline ishlashga tayyor' : 'Yangi versiya mavjud'}
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {offlineReady
                ? 'Ilova keshlandi va internetsiz ham ishlaydi.'
                : 'Ilovani yangilash uchun "Yangilash" tugmasini bosing.'}
            </p>
          </div>
        </div>

        <div className="flex w-full items-center gap-2 md:w-auto">
          {needRefresh && (
            <button
              onClick={() => updateServiceWorker(true)}
              className="flex-1 whitespace-nowrap rounded-xl bg-indigo-600 px-6 py-2 text-sm font-bold text-white transition-colors hover:bg-indigo-700 md:flex-none"
            >
              Yangilash
            </button>
          )}
          <button
            onClick={() => close()}
            className="p-2 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200"
            aria-label="Yopish"
          >
            <X size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReloadPrompt;
