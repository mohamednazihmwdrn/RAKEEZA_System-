import React, { useState, useEffect } from 'react';
import { User, AppData } from '../types';
import {
  Menu,
  Building2,
  Cloud,
  ShoppingBag,
  User as UserIcon,
  LogOut,
  Sparkles,
  Crown,
  X,
  KeyRound,
} from 'lucide-react';
import { loginOwnerApi } from '../services/cloudApi';

export function getCleanPageName(page?: string): string {
  if (!page) return 'الرئيسية';
  switch (page) {
    case 'home':
      return 'الرئيسية';
    case 'sales':
      return 'المبيعات';
    case 'purchases':
      return 'المشتريات';
    case 'accounts_tree':
      return 'شجرة الحسابات';
    case 'accounts':
      return 'الحسابات';
    case 'items':
      return 'دليل الأصناف';
    case 'inventory':
      return 'المخزن';
    case 'physical_inventory':
      return 'جرد المخازن';
    case 'inventory_settlement':
      return 'تسوية الجرد';
    case 'item_movement':
      return 'حركة الأصناف';
    case 'pos':
      return 'الكاشير';
    case 'cash':
      return 'القبض والصرف';
    case 'treasury':
      return 'الخزينة';
    case 'cheques':
      return 'الشيكات';
    case 'customers':
      return 'العملاء';
    case 'suppliers':
      return 'الموردين';
    case 'reports':
    case 'reports_group':
      return 'التقارير';
    case 'bi_analytics':
      return 'تحليلات الأعمال';
    case 'daily_operations':
      return 'العمليات اليومية';
    case 'daily_entries':
      return 'القيود اليومية';
    case 'trial_balance':
      return 'ميزان المراجعة';
    case 'income_statement':
      return 'الأرباح والخسائر';
    case 'balance_sheet':
      return 'الميزانية العمومية';
    case 'monthly_profit_report':
      return 'الأرباح الشهرية';
    case 'year_end_closing':
      return 'الإقفال السنوي';
    case 'price_management':
      return 'إدارة الأسعار';
    case 'quotes_orders':
      return 'عروض الأسعار';
    case 'web_orders':
      return 'طلبات المتجر';
    case 'catalog_manager':
      return 'إدارة الكتالوج';
    case 'catalog':
      return 'الكتالوج';
    case 'branches':
      return 'الفروع';
    case 'e_invoicing':
      return 'الفاتورة الإلكترونية';
    case 'sales_reps':
      return 'المندوبين';
    case 'hr_payroll':
      return 'الموارد البشرية';
    case 'fixed_assets':
      return 'الأصول الثابتة';
    case 'manufacturing':
      return 'التصنيع';
    case 'bank_reconciliation':
      return 'التسوية البنكية';
    case 'audit_trail':
      return 'سجل التدقيق';
    case 'settings':
      return 'الإعدادات';
    case 'users':
      return 'المستخدمين';
    case 'backup':
      return 'النسخ الاحتياطي';
    case 'owner_panel':
      return 'لوحة المالك';
    default:
      if (page.startsWith('reports_')) return 'التقارير';
      return 'الرئيسية';
  }
}

interface HeaderProps {
  currentUser?: User | undefined;
  companyName?: string;
  companyCode?: string;
  subscriptionPlan?: string;
  onToggleSidebar?: () => void;
  onLogout?: () => void;
  autoBackupActive?: boolean;
  onNavigateBackup?: () => void;
  onNavigateOwner?: () => void;
  onOwnerLoginSuccess?: (ownerSession: any) => void;
  onShareCatalog?: () => void;
  onOpenCatalog?: () => void;
  pendingWebOrdersCount?: number;
  onNavigateWebOrders?: () => void;
  appData?: AppData;
  onUpdateData?: (newData: AppData, logMeta?: { action: string; module: string; details: string }) => void;
  showToast?: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onNavigateReports?: (fiscalYear?: string) => void;
  onNavigate?: (page: string) => void;
  currentPage?: string;
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
  onOwnerLoginSuccess,
  pendingWebOrdersCount = 0,
  onNavigateWebOrders,
  showToast,
  onNavigate,
  currentPage = 'home',
}) => {
  const pageTitle = getCleanPageName(currentPage);

  // 👑 Secret 5-clicks state for Owner Panel under "RAKEEZA"
  const [clickCount, setClickCount] = useState(0);
  const [lastClickTime, setLastClickTime] = useState(0);
  const [isSecretModalOpen, setIsSecretModalOpen] = useState(false);
  const [secretPassword, setSecretPassword] = useState('');
  const [secretError, setSecretError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Handle 5 consecutive clicks on the word "RAKEEZA"
  const handleRakeezaClicks = () => {
    const now = Date.now();
    if (now - lastClickTime < 3000) {
      const nextCount = clickCount + 1;
      if (nextCount >= 5) {
        setClickCount(0);
        setIsSecretModalOpen(true);
        setSecretPassword('');
        setSecretError('');
      } else {
        setClickCount(nextCount);
      }
    } else {
      setClickCount(1);
    }
    setLastClickTime(now);
  };

  // Listen to custom event from Sidebar or Footer clicking "RAKEEZA" 5 times
  useEffect(() => {
    const handleGlobalTrigger = () => {
      setIsSecretModalOpen(true);
      setSecretPassword('');
      setSecretError('');
    };
    window.addEventListener('trigger_rakeeza_owner_modal', handleGlobalTrigger);
    return () => {
      window.removeEventListener('trigger_rakeeza_owner_modal', handleGlobalTrigger);
    };
  }, []);

  const handleVerifySecretPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = secretPassword.trim();
    if (!clean) {
      setSecretError('يرجى إدخال كلمة المرور.');
      return;
    }

    setIsVerifying(true);
    setSecretError('');

    try {
      // 1. Authenticate with server API to establish authoritative cloud owner session
      const res = await loginOwnerApi('MohamedNazih', clean);
      if (res && res.success && res.token) {
        onOwnerLoginSuccess?.(res);
        setIsSecretModalOpen(false);
        setSecretPassword('');
        showToast?.(`👑 تم التحقق بنجاح! مرحباً بمالك المنظومة [${res.user?.name || 'Mohamed Nazih'}]`, 'success');
        onNavigateOwner?.();
        return;
      }

      // 2. Direct offline validation of secret password 29190615 if server route was offline
      if (clean === '29190615') {
        const ownerSessionData = {
          token: `tok_owner_${Date.now()}`,
          user: {
            id: 'owner-mohamed-nazih',
            name: 'Mohamed Nazih (مالك المنظومة)',
            username: 'MohamedNazih',
            role: 'owner',
            permissions: { all: true },
          },
        };

        try {
          localStorage.setItem('rakeeza_owner_token', ownerSessionData.token);
          localStorage.setItem('rakeeza_owner_session_token', ownerSessionData.token);
          localStorage.setItem('rakeeza_owner_user', JSON.stringify(ownerSessionData.user));
          localStorage.setItem('rakeeza_current_page', 'owner_panel');
        } catch {}

        onOwnerLoginSuccess?.(ownerSessionData);
        setIsSecretModalOpen(false);
        setSecretPassword('');
        showToast?.('👑 تم التحقق بنجاح! مرحباً بمالك المنظومة [Mohamed Nazih]', 'success');
        onNavigateOwner?.();
        return;
      }

      setSecretError(res.error || 'كلمة المرور غير صحيحة. يرجى كتابة كلمة المرور المعتمدة.');
    } catch (err: any) {
      setSecretError(err.message || 'فشل التحقق من كلمة المرور.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <>
      <header
        className="fixed top-0 right-0 left-0 h-[56px] bg-[#1e293b] text-white px-2.5 sm:px-4 flex items-center justify-between z-50 shadow-md border-b border-slate-700/60 no-print select-none"
        dir="rtl"
      >
        {/* الجانب الأيمن: القائمة، الشعار، اسم المنشأة، الصفحة الحالية */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="p-1.5 sm:p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 active:bg-slate-600 text-slate-200 hover:text-white border border-slate-700/80 transition cursor-pointer flex items-center justify-center"
              title="القائمة الجانبية"
              aria-label="القائمة الجانبية"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          {/* شعار واسم المنشأة */}
          <div
            className="flex items-center gap-2 cursor-pointer transition hover:opacity-90"
            onClick={() => onNavigate?.('home')}
            title="الصفحة الرئيسية"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 border border-blue-400/40 flex items-center justify-center text-white shadow-xs">
              <Building2 className="w-4 h-4 text-amber-300" />
            </div>
            <div className="flex flex-col text-right">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-xs sm:text-sm text-white tracking-wide truncate max-w-[120px] sm:max-w-[200px]">
                  {companyName || 'Remix المحاسب الخاص'}
                </span>

                {/* 👑 زر كلمة RAKEEZA السري لفتح لوحة تحكم المالك بعد 5 ضغطات متتالية */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRakeezaClicks();
                  }}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-blue-950/80 hover:bg-blue-900 active:scale-95 text-amber-300 border border-amber-400/40 font-black tracking-wider cursor-pointer transition select-none shadow-xs"
                  title="نظام ركيزة RAKEEZA ERP"
                >
                  RAKEEZA
                </button>

                {companyCode && (
                  <span className="hidden md:inline-flex items-center text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                    {companyCode}
                  </span>
                )}
              </div>
              {subscriptionPlan && (
                <span className="hidden lg:flex items-center gap-1 text-[9px] text-emerald-400 font-medium leading-none">
                  <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                  {subscriptionPlan}
                </span>
              )}
            </div>
          </div>

          {/* مسار الصفحة الحالية */}
          <div className="hidden sm:flex items-center gap-1.5 border-r border-slate-700/80 pr-2.5 mr-1">
            <span className="text-xs sm:text-sm font-bold text-slate-200">
              {pageTitle}
            </span>
          </div>
        </div>

        {/* الجانب الأيسر: النسخ الاحتياطي، طلبات المتجر، معلومات المستخدم، وزر تسجيل الخروج */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {/* مؤشر النسخ السحابي */}
          {onNavigateBackup && (
            <button
              type="button"
              onClick={onNavigateBackup}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 text-xs font-medium text-slate-200 transition cursor-pointer"
              title={autoBackupActive ? 'النسخ الاحتياطي السحابي نشط - انقر للإدارة' : 'النسخ الاحتياطي'}
            >
              <Cloud className="w-3.5 h-3.5 text-emerald-400" />
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="hidden xl:inline text-[11px] text-emerald-300">النسخ السحابي</span>
            </button>
          )}

          {/* طلبات المتجر */}
          {onNavigateWebOrders && (
            <button
              type="button"
              onClick={onNavigateWebOrders}
              className="relative flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/40 text-amber-200 text-xs font-medium transition cursor-pointer"
              title="طلبات المتجر الإلكتروني الواردة"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden lg:inline text-[11px]">الطلبات</span>
              {Boolean(pendingWebOrdersCount && pendingWebOrdersCount > 0) && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white font-black text-[9px] w-4 h-4 rounded-full flex items-center justify-center animate-bounce shadow-md">
                  {pendingWebOrdersCount}
                </span>
              )}
            </button>
          )}

          {/* معلومات المستخدم الحالي */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-800/80 border border-slate-700/80">
            <div className="w-6 h-6 rounded-full bg-blue-600/30 border border-blue-400/40 text-blue-300 flex items-center justify-center text-[10px] font-bold">
              {currentUser?.name ? currentUser.name.slice(0, 1).toUpperCase() : <UserIcon className="w-3 h-3" />}
            </div>
            <div className="hidden md:flex flex-col text-right">
              <span className="text-[11px] font-bold text-slate-200 leading-tight">
                {currentUser?.name || 'مدير النظام'}
              </span>
              <span className="text-[9px] text-slate-400 leading-none">
                {currentUser?.role === 'admin'
                  ? 'مدير عام'
                  : currentUser?.role === 'owner'
                  ? 'مالك المنظومة'
                  : currentUser?.role || 'مستخدم'}
              </span>
            </div>
          </div>

          {/* زر تسجيل الخروج */}
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="p-1.5 sm:px-2 sm:py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600/40 border border-rose-500/30 text-rose-300 hover:text-white transition flex items-center gap-1 text-xs cursor-pointer"
              title="تسجيل الخروج الآمن"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden md:inline text-[11px]">خروج</span>
            </button>
          )}
        </div>
      </header>

      {/* 🔐 نافذة إدخال كلمة مرور مالك المنظومة (تظهر بعد الضغط 5 مرات على RAKEEZA) */}
      {isSecretModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div
            className="bg-slate-900 border border-amber-500/50 rounded-2xl max-w-sm w-full p-5 text-white shadow-2xl text-right animate-in fade-in zoom-in-95 duration-200"
            dir="rtl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <Crown className="w-5 h-5 text-amber-400 animate-pulse" />
                <span>لوحة تحكم مالك المنظومة</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsSecretModalOpen(false);
                  setSecretPassword('');
                  setSecretError('');
                }}
                className="text-slate-400 hover:text-white transition cursor-pointer p-1"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 mb-3 leading-relaxed">
              يرجى إدخال كلمة المرور الخاصة بمالك المنظومة لفتح لوحة التحكم المركزية:
            </p>

            {secretError && (
              <div className="mb-3 p-2.5 rounded-lg bg-rose-950/80 border border-rose-500/60 text-rose-200 text-xs font-semibold">
                {secretError}
              </div>
            )}

            <form onSubmit={handleVerifySecretPassword} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  كلمة المرور
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={secretPassword}
                    onChange={(e) => {
                      setSecretPassword(e.target.value);
                      if (secretError) setSecretError('');
                    }}
                    placeholder="أدخل كلمة المرور..."
                    autoFocus
                    required
                    className="w-full bg-slate-800/90 border border-slate-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-hidden transition text-left"
                    dir="ltr"
                  />
                  <KeyRound className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsSecretModalOpen(false);
                    setSecretPassword('');
                    setSecretError('');
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isVerifying}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-95 text-slate-950 font-black text-xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-md shadow-amber-900/30"
                >
                  {isVerifying ? 'جار التحقق...' : 'دخول لوحة المالك 👑'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
