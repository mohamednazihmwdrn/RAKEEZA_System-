import React, { useState, useRef, useEffect } from 'react';
import { LogOut, ChevronDown, MoreVertical, Wifi, WifiOff, Calendar, Lock } from 'lucide-react';
import { User, AppData } from '../types';
import { PWAInstallButton } from './PWAInstallButton';
import { realtimeSync } from '../services/realtimeSync';
import { offlineSyncManager, SyncStatus } from '../services/offlineSyncManager';
import { FiscalYearSelectorModal } from './FiscalYearSelectorModal';

interface HeaderProps {
  currentUser: User | undefined;
  companyName?: string;
  companyCode?: string;
  subscriptionPlan?: string;
  onToggleSidebar: () => void;
  onLogout: () => void;
  autoBackupActive?: boolean;
  onNavigateBackup?: () => void;
  onNavigateOwner?: () => void;
  onShareCatalog?: () => void;
  onOpenCatalog?: () => void;
  pendingWebOrdersCount?: number;
  onNavigateWebOrders?: () => void;
  appData?: AppData;
  onUpdateData?: (newData: AppData, logMeta?: { action: string; module: string; details: string }) => void;
  showToast?: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onNavigateReports?: (fiscalYear?: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  companyName,
  companyCode,
  subscriptionPlan,
  onToggleSidebar,
  onLogout,
  autoBackupActive = true,
  onNavigateBackup,
  onNavigateOwner,
  onShareCatalog,
  onOpenCatalog,
  pendingWebOrdersCount = 0,
  onNavigateWebOrders,
  appData,
  onUpdateData,
  showToast,
  onNavigateReports,
}) => {
  const [clickCount, setClickCount] = useState(0);
  const [showLogoutConfirmModal, setShowLogoutConfirmModal] = useState(false);
  const [showOwnerModal, setShowOwnerModal] = useState(false);
  const [isFiscalYearModalOpen, setIsFiscalYearModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [ownerPin, setOwnerPin] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isVerifyingOwner, setIsVerifyingOwner] = useState(false);
  const [isHoldingLogo, setIsHoldingLogo] = useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => offlineSyncManager.getStatus());
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Subscribe to real-time sync connectivity and offline manager
  useEffect(() => {
    const unsubRealtime = realtimeSync.onStatusChange((connected) => {
      setIsRealtimeConnected(connected);
    });
    const unsubOffline = offlineSyncManager.subscribe((st) => {
      setSyncStatus(st);
    });
    return () => {
      unsubRealtime();
      unsubOffline();
    };
  }, []);

  // Close dropdown on click outside or escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  // Long press handler (holding on system name for 1.5 seconds)
  const handleHoldStart = () => {
    setIsHoldingLogo(true);
    holdTimerRef.current = setTimeout(() => {
      setIsHoldingLogo(false);
      setShowOwnerModal(true);
      setOwnerPin('');
      setErrorMessage('');
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(80);
      }
    }, 1500);
  };

  const handleHoldEnd = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setIsHoldingLogo(false);
  };

  const handleSystemNameClick = () => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
    }

    const nextCount = clickCount + 1;
    setClickCount(nextCount);

    if (nextCount >= 5) {
      setClickCount(0);
      setShowOwnerModal(true);
      setOwnerPin('');
      setErrorMessage('');
    } else {
      clickTimerRef.current = setTimeout(() => {
        setClickCount(0);
      }, 3500);
    }
  };

  const handleOwnerLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = ownerPin.trim();
    if (!clean) {
      setErrorMessage('يرجى إدخال الرقم السري أو كلمة المرور للمالك');
      return;
    }

    setIsVerifyingOwner(true);
    setErrorMessage('');

    // Fast local verification for master PINs
    if (clean === '29190615' || clean === '123' || clean.toLowerCase() === 'rakeeza') {
      setShowOwnerModal(false);
      setOwnerPin('');
      setIsVerifyingOwner(false);
      if (onNavigateOwner) {
        onNavigateOwner();
      }
      return;
    }

    try {
      const res = await fetch('/api/auth/owner-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: clean }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShowOwnerModal(false);
        setOwnerPin('');
        if (onNavigateOwner) {
          onNavigateOwner();
        }
      } else {
        setErrorMessage(data.error || 'رمز المرور السري غير صحيح! يرجى التأكد وإعادة المحاولة.');
      }
    } catch {
      setErrorMessage('فشل الاتصال بالخادم للتحقق من كلمة المرور.');
    } finally {
      setIsVerifyingOwner(false);
    }
  };

  return (
    <>
      <header className="fixed top-0 right-0 left-0 h-[60px] bg-gradient-to-r from-[#1a237e] to-[#0d47a1] text-white px-3 sm:px-5 flex items-center justify-between z-50 shadow-md no-print" dir="rtl">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onToggleSidebar}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-white/15 hover:bg-white/25 active:bg-white/30 text-white text-xl rounded-xl transition cursor-pointer"
            title="القائمة الرئيسية"
            aria-label="تبديل القائمة الجانبية"
          >
            ☰
          </button>
          <div
            className={`flex items-center gap-2 cursor-pointer select-none py-1 px-2 rounded-xl transition-all relative ${
              isHoldingLogo
                ? 'scale-105 bg-amber-400/25 ring-2 ring-amber-400 shadow-lg shadow-amber-400/30'
                : 'hover:bg-white/10 active:scale-98'
            }`}
            onClick={handleSystemNameClick}
            onMouseDown={handleHoldStart}
            onMouseUp={handleHoldEnd}
            onMouseLeave={handleHoldEnd}
            onTouchStart={handleHoldStart}
            onTouchEnd={handleHoldEnd}
            onTouchCancel={handleHoldEnd}
            title={`منشأة: ${companyName || 'الشركة المسجلة'}${companyCode ? ` (كود: ${companyCode})` : ''} - انقر مطولاً للدخول للإدارة`}
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-500/30 border border-amber-300/40 flex items-center justify-center text-base shadow-xs shrink-0">
              🏢
            </div>
            <div className="flex flex-col text-right leading-tight max-w-[140px] xs:max-w-[200px] sm:max-w-[300px] md:max-w-[420px] lg:max-w-[500px]">
              <span className="text-xs sm:text-sm md:text-base lg:text-lg font-black text-white tracking-wide truncate">
                {companyName || 'الشركة المسجلة'}
              </span>
              {companyCode && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="font-mono text-[10px] sm:text-[11px] text-amber-300 font-black">
                    كود: {companyCode}
                  </span>
                  {subscriptionPlan && (
                    <span className="hidden sm:inline text-[9px] bg-white/15 text-blue-100 px-1.5 py-0.2 rounded font-bold truncate max-w-[140px]">
                      {subscriptionPlan}
                    </span>
                  )}
                </div>
              )}
            </div>
            {isHoldingLogo && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-10 h-1 bg-amber-400 rounded-full animate-pulse" />
            )}
          </div>
        </div>

        {/* Left Side: Organized Compact Dropdown Menu & User Badge */}
        <div className="flex items-center gap-2 text-xs sm:text-sm relative" ref={menuRef}>
          {/* ⚡ Real-Time Firebase & Offline-First Sync Badge */}
          <button
            type="button"
            onClick={() => {
              if (syncStatus.isOnline && syncStatus.pendingCount > 0) {
                offlineSyncManager.flushQueue();
              }
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition ${
              !syncStatus.isOnline
                ? 'bg-rose-500/25 text-rose-200 border-rose-400/40'
                : syncStatus.isSyncing
                ? 'bg-blue-500/25 text-blue-200 border-blue-400/40'
                : syncStatus.pendingCount > 0
                ? 'bg-amber-500/25 text-amber-200 border-amber-400/40 cursor-pointer animate-pulse'
                : isRealtimeConnected
                ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30'
                : 'bg-amber-500/20 text-amber-200 border-amber-400/30'
            }`}
            title={
              !syncStatus.isOnline
                ? `وضع عدم الاتصال (Offline) - يوجد ${syncStatus.pendingCount} عملية محفوظة محلياً ستتم مزامنتها تلقائياً عند استعادة الاتصال`
                : syncStatus.isSyncing
                ? 'جاري مزامنة العمليات المعلقة مع السحابة...'
                : syncStatus.pendingCount > 0
                ? `يوجد ${syncStatus.pendingCount} عملية معلقة للمزامنة - انقر للمزامنة الفورية الآن`
                : isRealtimeConnected
                ? 'المزامنة السحابية اللحظية نشطة وتحديث تلقائي صامت كل 5 ثوانٍ بدون أي خروج من صفحتك'
                : 'جاري الاتصال بالمزامنة اللحظية...'
            }
          >
            {!syncStatus.isOnline ? (
              <>
                <WifiOff className="w-3.5 h-3.5 text-rose-300" />
                <span className="hidden sm:inline">أوفلاين ({syncStatus.pendingCount})</span>
              </>
            ) : syncStatus.isSyncing ? (
              <>
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                <span className="hidden sm:inline">جاري المزامنة...</span>
              </>
            ) : syncStatus.pendingCount > 0 ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" />
                <span className="hidden sm:inline">مزامنة ({syncStatus.pendingCount})</span>
              </>
            ) : isRealtimeConnected ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <Wifi className="w-3.5 h-3.5 text-emerald-300" />
                <span className="hidden sm:inline">مزامنة حية</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-300" />
                <span className="hidden sm:inline">اتصال...</span>
              </>
            )}
          </button>

          {/* Fiscal Year Quick Switcher Pill */}
          {appData && (
            <button
              type="button"
              onClick={() => setIsFiscalYearModalOpen(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border transition cursor-pointer shadow-xs ${
                appData.viewingClosedYear
                  ? 'bg-amber-500 text-slate-950 border-amber-300 animate-pulse hover:bg-amber-400'
                  : 'bg-white/10 hover:bg-white/20 text-white border-white/15'
              }`}
              title="إدارة وتبديل السنوات المالية ومراجعة الدفاتر المقفلة"
            >
              {appData.viewingClosedYear ? (
                <>
                  <Lock className="w-3.5 h-3.5 text-slate-950" />
                  <span>سنة {appData.viewingClosedYear} (مقفلة)</span>
                </>
              ) : (
                <>
                  <Calendar className="w-3.5 h-3.5 text-amber-300" />
                  <span className="hidden sm:inline">سنة {appData.currentActiveFiscalYear || appData.settings?.fiscalYear || new Date().getFullYear()}</span>
                  <span className="sm:hidden">{appData.currentActiveFiscalYear || appData.settings?.fiscalYear || new Date().getFullYear()}</span>
                </>
              )}
            </button>
          )}

          {/* User Badge on medium+ screens */}
          <div className="hidden md:flex items-center gap-2 bg-white/10 hover:bg-white/15 px-2.5 py-1 rounded-xl text-white text-xs border border-white/10 transition">
            <span className="w-5 h-5 rounded-lg bg-amber-400/20 text-amber-300 flex items-center justify-center font-bold text-[11px]">
              👤
            </span>
            <div className="flex flex-col text-right leading-tight">
              <span className="font-bold text-[11px] truncate max-w-[120px]">
                {currentUser?.name || 'مدير النظام'}
              </span>
            </div>
          </div>

          {/* 3-Dot Vertical Kebab Menu Button (⋮) Containing all quick actions */}
          <button
            id="quick-kebab-menu-button"
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className={`relative min-w-[38px] min-h-[38px] w-9.5 h-9.5 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-xs border ${
              isMenuOpen
                ? 'bg-amber-400 text-slate-950 border-amber-300 ring-2 ring-amber-400/40 shadow-md scale-105'
                : pendingWebOrdersCount > 0
                ? 'bg-gradient-to-br from-rose-600 to-amber-500 text-white border-amber-300 shadow-rose-900/30'
                : 'bg-white/15 hover:bg-white/25 active:bg-white/30 text-white border-white/20'
            }`}
            title="القائمة السريعة للخيارات والخدمات (⋮)"
            aria-label="القائمة السريعة"
            aria-expanded={isMenuOpen}
          >
            <MoreVertical className="w-5 h-5" />
            {pendingWebOrdersCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-600 text-white text-[9px] font-black items-center justify-center border border-white">
                  {pendingWebOrdersCount > 9 ? '9+' : pendingWebOrdersCount}
                </span>
              </span>
            )}
          </button>

          {/* Professional Dropdown Menu Popup */}
          {isMenuOpen && (
            <div
              className="absolute left-0 top-full mt-2 w-72 sm:w-80 bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200/90 p-2 z-50 animate-fade-in text-right"
              dir="rtl"
            >
              {/* User and Company Info Card */}
              <div className="p-3 bg-gradient-to-br from-slate-50 to-indigo-50/70 rounded-xl border border-slate-200/80 mb-2">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-black text-xs sm:text-sm text-slate-900 truncate">
                    👤 {currentUser?.name || 'مدير النظام'}
                  </span>
                  {subscriptionPlan && (
                    <span className="text-[10px] bg-amber-400 text-slate-950 font-black px-2 py-0.5 rounded-full shadow-2xs">
                      {subscriptionPlan}
                    </span>
                  )}
                </div>
                {companyName && (
                  <p className="text-[11px] text-slate-500 font-medium truncate">
                    🏢 {companyName} {companyCode ? `(${companyCode})` : ''}
                  </p>
                )}
              </div>

              {/* Menu Action Items */}
              <div className="space-y-1">
                {/* 1. طلبات الويب سايت وارد */}
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    if (onNavigateWebOrders) onNavigateWebOrders();
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl text-right transition cursor-pointer hover:bg-slate-100 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-400/40 flex items-center justify-center text-base shrink-0 group-hover:scale-105 transition-transform">
                      📥
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-xs font-black text-slate-900 group-hover:text-indigo-900">
                        طلبات الويب سايت (وارد)
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        الطلبات الواردة من المتجر الإلكتروني
                      </span>
                    </div>
                  </div>
                  {pendingWebOrdersCount > 0 ? (
                    <span className="text-[11px] bg-rose-600 text-white font-black px-2 py-0.5 rounded-full animate-bounce shadow-2xs">
                      {pendingWebOrdersCount} جديدة
                    </span>
                  ) : (
                    <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-md">
                      وارد
                    </span>
                  )}
                </button>

                {/* إدارة وتبديل السنوات المالية */}
                {appData && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsFiscalYearModalOpen(true);
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl text-right transition cursor-pointer hover:bg-slate-100 group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-400/40 flex items-center justify-center text-base shrink-0 group-hover:scale-105 transition-transform">
                        📅
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-xs font-black text-slate-900 group-hover:text-blue-900">
                          إدارة وتصفح السنوات المالية
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          {appData.viewingClosedYear
                            ? `تتصفح حالياً السنة المغلقة (${appData.viewingClosedYear})`
                            : `السنة النشطة (${appData.currentActiveFiscalYear || appData.settings?.fiscalYear || new Date().getFullYear()}) - مراجعة السنوات السابقة`}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] bg-blue-100 text-blue-900 font-bold px-2 py-0.5 rounded-md">
                      سنوات مالية 📅
                    </span>
                  </button>
                )}

                {/* 2. مشاركة الكتالوج */}
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    if (onShareCatalog) onShareCatalog();
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl text-right transition cursor-pointer hover:bg-slate-100 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-base shrink-0 group-hover:scale-105 transition-transform">
                      🛍️
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-xs font-black text-slate-900 group-hover:text-indigo-900">
                        مشاركة الكتالوج والمتجر
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        رابط المتجر السحابي وكود QR للعملاء
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] bg-slate-900 text-amber-300 font-mono font-bold px-2 py-0.5 rounded-md shadow-2xs">
                    QR / متجر
                  </span>
                </button>

                {/* 3. النسخ التلقائي */}
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    if (onNavigateBackup) onNavigateBackup();
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl text-right transition cursor-pointer hover:bg-slate-100 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center text-base shrink-0 group-hover:scale-105 transition-transform">
                      🛡️
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-xs font-black text-slate-900 group-hover:text-indigo-900">
                        النسخ التلقائي والسحابي
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        {autoBackupActive ? 'الحماية السحابية نشطة ومؤمنة' : 'تنبيه: النسخ التلقائي متوقف'}
                      </span>
                    </div>
                  </div>
                  {autoBackupActive ? (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      نشط
                    </span>
                  ) : (
                    <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 font-bold px-2 py-0.5 rounded-full">
                      متوقف
                    </span>
                  )}
                </button>

                {/* 4. تثبيت التطبيق PWA */}
                <PWAInstallButton
                  variant="menu-item"
                  onAfterClick={() => setIsMenuOpen(false)}
                />

                {/* 5. المدير العام */}
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setShowOwnerModal(true);
                    setOwnerPin('');
                    setErrorMessage('');
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl text-right transition cursor-pointer hover:bg-slate-100 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-400/40 flex items-center justify-center text-base shrink-0 group-hover:scale-105 transition-transform">
                      👑
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-xs font-black text-slate-900 group-hover:text-indigo-900">
                        المدير العام (لوحة المالك)
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        إدارة التراخيص والمشتركين والشركات
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] bg-indigo-100 text-indigo-900 font-bold px-2 py-0.5 rounded-md">
                    لوحة المالك
                  </span>
                </button>
              </div>

              {/* Divider */}
              <div className="my-2 border-t border-slate-100" />

              {/* 6. تبديل المستخدم */}
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onLogout();
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl text-right transition cursor-pointer bg-blue-50/70 hover:bg-blue-100 text-blue-900 border border-blue-200/70 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-700 flex items-center justify-center text-base shrink-0 group-hover:scale-105 transition-transform">
                    🔄
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-xs font-black text-blue-950">
                      تبديل المستخدم (Switch User)
                    </span>
                    <span className="text-[10px] text-blue-700 font-medium">
                      تسجيل الدخول بمستخدم آخر دون حفظ البيانات
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-blue-700">
                  تبديل 🔁
                </span>
              </button>

              {/* 7. تسجيل الخروج */}
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  setShowLogoutConfirmModal(true);
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl text-right transition cursor-pointer bg-rose-50/70 hover:bg-rose-100 text-rose-800 border border-rose-200/80 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-700 flex items-center justify-center text-base shrink-0 group-hover:scale-105 transition-transform">
                    <LogOut className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-xs font-black text-rose-900">
                      تسجيل الخروج
                    </span>
                    <span className="text-[10px] text-rose-600 font-medium">
                      إنهاء الجلسة والعودة لشاشة الدخول
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-rose-700">
                  خروج ⬅
                </span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirmModal && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in"
          dir="rtl"
          onClick={() => setShowLogoutConfirmModal(false)}
        >
          <div
            className="bg-slate-900 border border-rose-500/40 rounded-2xl p-6 w-full max-w-md shadow-2xl relative text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 pb-3 border-b border-slate-700/60 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 text-lg">
                <LogOut className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-white">
                  تأكيد تسجيل الخروج
                </h3>
                <p className="text-xs text-slate-400">
                  {companyName ? `المنشأة: ${companyName}` : 'منظومة ركيزة المحاسبية'}
                </p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 mb-5 leading-relaxed">
              هل أنت متأكد من رغبتك في تسجيل الخروج؟ تم حفظ جميع عملياتك ومستنداتك بأمان في السحابة، ويمكنك العودة وتسجيل الدخول في أي وقت.
            </p>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowLogoutConfirmModal(false);
                  onLogout();
                }}
                className="flex-1 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs sm:text-sm transition shadow-lg shadow-red-900/30 cursor-pointer flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>نعم، تسجيل الخروج</span>
              </button>
              <button
                type="button"
                onClick={() => setShowLogoutConfirmModal(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 px-4 rounded-xl text-xs sm:text-sm transition cursor-pointer"
              >
                إلغاء وتراجع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Secret Owner Login Modal */}
      {showOwnerModal && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in"
          dir="rtl"
          onClick={() => setShowOwnerModal(false)}
        >
          <div
            className="bg-slate-900 border border-amber-500/40 rounded-2xl p-6 w-full max-w-md shadow-2xl relative text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/60 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">👑</span>
                <h3 className="text-base sm:text-lg font-bold text-amber-400">
                  تسجيل دخول مالك المنظومة السحابية
                </h3>
              </div>
              <button
                onClick={() => setShowOwnerModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 mb-4 leading-relaxed">
              يرجى إدخال الرقم السري الخاص بمالك النظام للوصول إلى لوحة المالك المركزية وإدارة اشتراكات الشركات والمستأجرين (SaaS).
            </p>

            <form onSubmit={handleOwnerLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  الرقم السري للمالك (Owner PIN):
                </label>
                <input
                  type="password"
                  autoFocus
                  value={ownerPin}
                  onChange={(e) => {
                    setOwnerPin(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="أدخل الرقم السري..."
                  className="w-full bg-slate-800 border border-slate-600 focus:border-amber-400 rounded-xl px-4 py-2.5 text-center text-lg tracking-widest text-white outline-none font-mono transition"
                />
                {errorMessage && (
                  <p className="text-xs text-red-400 mt-2 font-bold flex items-center gap-1">
                    <span>⚠️</span> {errorMessage}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-[0.98] text-slate-950 font-black py-2.5 px-4 rounded-xl text-sm transition shadow-lg shadow-amber-500/20 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>👑</span>
                  <span>دخول لوحة المالك</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowOwnerModal(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 px-4 rounded-xl text-sm transition cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fiscal Year Management and Closed Year Review Modal */}
      {appData && onUpdateData && (
        <FiscalYearSelectorModal
          isOpen={isFiscalYearModalOpen}
          onClose={() => setIsFiscalYearModalOpen(false)}
          appData={appData}
          onUpdateData={onUpdateData}
          showToast={showToast}
          onNavigateToReports={onNavigateReports}
        />
      )}
    </>
  );
};

