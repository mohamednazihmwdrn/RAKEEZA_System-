import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Sparkles, X, CheckCircle2 } from 'lucide-react';

interface CloudUpdateBannerProps {
  showToast?: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const CloudUpdateBanner: React.FC<CloudUpdateBannerProps> = ({ showToast }) => {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [lastCheckedText, setLastCheckedText] = useState<string>('');

  // Function to apply update across any browser / device
  const handleApplyUpdate = useCallback(async () => {
    setIsUpdating(true);
    showToast?.('جاري تطبيق التحديث وتحديث ملفات النظام...', 'info');

    try {
      // 1. Unregister or skip waiting on service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
          await reg.update();
        }
      }

      // 2. Clear browser caches to fetch freshly built chunks from Vercel
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((key) => caches.delete(key)));
      }

      // 3. Mark update completed
      showToast?.('تم تنزيل وتطبيق التحديث بنجاح! جاري إعادة التشغيل...', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 600);
    } catch (err) {
      console.error('Error applying update:', err);
      window.location.reload();
    }
  }, [showToast]);

  // Check for updates
  const checkForUpdates = useCallback(async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.update();
          if (registration.waiting) {
            setHasUpdate(true);
            setIsDismissed(false);
            return;
          }
        }
      }

      // Fallback check by inspecting index.html headers/content
      const res = await fetch(`/index.html?chk=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      });

      if (res.ok) {
        const text = await res.text();
        // Look for main bundle script tags
        const match = text.match(/assets\/index-[a-zA-Z0-9_-]+\.js/);
        if (match && match[0]) {
          const currentScript = Array.from(document.querySelectorAll('script')).find((s) =>
            s.src && s.src.includes('assets/index-')
          );
          if (currentScript && !currentScript.src.includes(match[0])) {
            setHasUpdate(true);
            setIsDismissed(false);
          }
        }
      }

      const now = new Date();
      setLastCheckedText(now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }));
    } catch {
      // Quiet fail if offline
    }
  }, []);

  useEffect(() => {
    // Check initially after 3 seconds
    const initialTimer = setTimeout(() => {
      checkForUpdates();
    }, 3000);

    // Periodic check every 45 seconds
    const interval = setInterval(() => {
      checkForUpdates();
    }, 45000);

    // Check when user refocuses window or tab becomes visible
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', checkForUpdates);
    window.addEventListener('online', checkForUpdates);

    // Listen for custom SW update event if dispatched
    const handleSwUpdate = () => {
      setHasUpdate(true);
      setIsDismissed(false);
    };
    window.addEventListener('swUpdated', handleSwUpdate);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', checkForUpdates);
      window.removeEventListener('online', checkForUpdates);
      window.removeEventListener('swUpdated', handleSwUpdate);
    };
  }, [checkForUpdates]);

  if (!hasUpdate || isDismissed) {
    return null;
  }

  return (
    <div
      dir="rtl"
      className="fixed top-14 right-3 left-3 sm:right-6 sm:left-6 md:right-auto md:left-6 md:max-w-md z-50 animate-bounce-subtle"
    >
      <div className="bg-white text-slate-900 p-3.5 rounded-xl border-2 border-slate-300 shadow-xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-amber-500 animate-spin-slow" />
          </div>
          <div className="text-right">
            <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-tight flex items-center gap-1.5">
              <span>تحديث جديد متوفر على Vercel!</span>
              <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[9px] px-1.5 py-0.2 rounded font-mono font-bold">
                NEW
              </span>
            </h4>
            <p className="text-[10.5px] sm:text-xs text-slate-600 mt-0.5 leading-snug">
              تم نشر إصدار أحدث للنظام من GitHub. انقر للتحديث الفوري لجميع أجهزتك.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleApplyUpdate}
            disabled={isUpdating}
            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-lg text-xs font-black shadow-md cursor-pointer transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
            <span>{isUpdating ? 'جاري التحديث...' : 'تحديث الآن'}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="w-7 h-7 rounded-lg hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center cursor-pointer transition"
            title="إخفاء مؤقت"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
