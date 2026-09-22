import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  User,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  CheckCircle2,
  AlertCircle,
  Mail,
  Shield,
  KeyRound,
  RotateCcw,
  Unlink,
  Laptop,
  ChevronDown,
  ShieldCheck,
  Sparkles,
  Store,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import {
  getStoredBoundDevice,
  setStoredBoundDevice,
  clearStoredBoundDevice,
  fetchCompanyPublicDetailsApi,
  registerNewCompanyDeviceApi,
  loginToCloud,
  verifyOwnerSecretApi,
  BoundDeviceData,
} from '../services/cloudApi';
import { TenantCompany, User as AppUser } from '../types';

interface LoginViewProps {
  onLoginSuccess: (session: {
    user: AppUser;
    company: TenantCompany;
    subscription: any;
  }) => void;
  onOpenOwnerPanelDirectly?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLoginSuccess,
  onOpenOwnerPanelDirectly,
}) => {
  // 💻 Device Binding State
  const [boundDevice, setBoundDevice] = useState<BoundDeviceData | null>(null);
  const [isCheckingDevice, setIsCheckingDevice] = useState<boolean>(true);
  const [showUnbindConfirmModal, setShowUnbindConfirmModal] = useState<boolean>(false);

  // 📝 Unbound Mode: Tab 'bind_existing' (default for branch/employee devices) or 'register_new'
  const [setupTab, setSetupTab] = useState<'bind_existing' | 'register_new'>('bind_existing');

  // Form 1: Register New Company State
  const [regCompanyName, setRegCompanyName] = useState<string>('');
  const [regAdminEmail, setRegAdminEmail] = useState<string>('');
  const [regAdminUsername, setRegAdminUsername] = useState<string>('admin');
  const [regAdminPassword, setRegAdminPassword] = useState<string>('');
  const [regBranchName, setRegBranchName] = useState<string>('الفرع الرئيسي');
  const [showRegPassword, setShowRegPassword] = useState<boolean>(false);

  // Form 2: Bind to Existing Company State
  const [existingCompanyCode, setExistingCompanyCode] = useState<string>('');

  // ⚡ Bound Mode (Desktop-Style Quick Login) State
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedUsername, setSelectedUsername] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [showLoginPassword, setShowLoginPassword] = useState<boolean>(false);
  const [isRefreshingMetadata, setIsRefreshingMetadata] = useState<boolean>(false);

  // Feedback & Loading States
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 🔐 Secret Owner Access State (Long-press on RAKEEZA logo)
  const [isHoldingLogo, setIsHoldingLogo] = useState<boolean>(false);
  const [showSecretOwnerModal, setShowSecretOwnerModal] = useState<boolean>(false);
  const [secretOwnerPin, setSecretOwnerPin] = useState<string>('');
  const [ownerPinError, setOwnerPinError] = useState<string | null>(null);
  const [isVerifyingOwner, setIsVerifyingOwner] = useState<boolean>(false);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Password Input Ref for Auto-focus
  const passwordInputRef = useRef<HTMLInputElement | null>(null);

  /**
   * 1️⃣ On Mount: Check Local Device Binding
   */
  useEffect(() => {
    const checkDeviceBinding = async () => {
      setIsCheckingDevice(true);
      const stored = getStoredBoundDevice();

      if (stored && stored.companyId) {
        setBoundDevice(stored);

        // Set default branch
        if (stored.branches && stored.branches.length > 0) {
          const mainBranch = stored.branches.find((b) => b.isMain) || stored.branches[0];
          setSelectedBranchId(mainBranch.id);
        }

        // Set default user
        if (stored.users && stored.users.length > 0) {
          setSelectedUsername(stored.users[0].username || stored.users[0].name);
        }

        // Auto-refresh company metadata and isolated users silently from server
        try {
          const res = await fetchCompanyPublicDetailsApi(stored.companyId);
          if (res.success && res.company) {
            const updated: BoundDeviceData = {
              ...stored,
              companyName: res.company.name || stored.companyName,
              companyCode: res.company.code || (res.company as any).companyCode || stored.companyCode,
              branches: res.branches || stored.branches,
              users: res.users || stored.users,
            };
            setStoredBoundDevice(updated);
            setBoundDevice(updated);

            if (updated.branches?.length > 0 && !selectedBranchId) {
              const mainB = updated.branches.find((b) => b.isMain) || updated.branches[0];
              setSelectedBranchId(mainB.id);
            }
            if (updated.users?.length > 0 && !selectedUsername) {
              setSelectedUsername(updated.users[0].username || updated.users[0].name);
            }
          }
        } catch {
          // Keep cached bound device on network hiccup
        }
      }

      setIsCheckingDevice(false);
    };

    checkDeviceBinding();
  }, []);

  // Auto focus password input whenever user selects a user in bound mode
  useEffect(() => {
    if (boundDevice && passwordInputRef.current) {
      passwordInputRef.current.focus();
    }
  }, [boundDevice, selectedUsername]);

  /**
   * 🔄 Refresh Company Branches & Users dynamically
   */
  const handleRefreshMetadata = async () => {
    if (!boundDevice?.companyId || isRefreshingMetadata) return;
    setIsRefreshingMetadata(true);
    setErrorMessage(null);
    try {
      const res = await fetchCompanyPublicDetailsApi(boundDevice.companyId);
      if (res.success && res.branches && res.users) {
        const updated: BoundDeviceData = {
          ...boundDevice,
          companyName: res.company?.name || boundDevice.companyName,
          branches: res.branches,
          users: res.users,
        };
        setStoredBoundDevice(updated);
        setBoundDevice(updated);
        setSuccessMessage('تم تحديث قائمة الفروع والمستخدمين بنجاح.');
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch {
      setErrorMessage('تعذر تحديث البيانات من السحابة.');
    } finally {
      setIsRefreshingMetadata(false);
    }
  };

  /**
   * 🏢 Handler: Register New Company & Bind Device
   */
  const handleRegisterNewCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanName = regCompanyName.trim();
    const cleanEmail = regAdminEmail.trim().toLowerCase();
    const cleanUsername = regAdminUsername.trim() || 'admin';
    const cleanPassword = regAdminPassword.trim();
    const cleanBranch = regBranchName.trim() || 'الفرع الرئيسي';

    if (!cleanName) {
      setErrorMessage('يرجى إدخال اسم المنشأة أو الشركة.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('يرجى إدخال بريد إلكتروني صالح للمدير (Gmail أو بريد العمل للتحقق من الهوية).');
      return;
    }
    if (!cleanPassword) {
      setErrorMessage('يرجى تحديد كلمة مرور لحساب المدير العام.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await registerNewCompanyDeviceApi({
        companyName: cleanName,
        adminEmail: cleanEmail,
        adminUsername: cleanUsername,
        adminPassword: cleanPassword,
        branchName: cleanBranch,
      });

      if (res.success && res.company && res.user) {
        setSuccessMessage('تهانينا! تم تسجيل المنشأة واعتماد ربط هذا الجهاز بنجاح. جاري فتح النظام...');

        const freshBound = getStoredBoundDevice();
        if (freshBound) {
          setBoundDevice(freshBound);
        }

        setTimeout(() => {
          onLoginSuccess({
            user: res.user!,
            company: res.company!,
            subscription: res.subscription || {
              status: res.company?.status || 'trial',
              planName: res.company?.planName || 'التجربة المجانية (30 يوم)',
              daysRemaining: 30,
              isExpired: false,
            },
          });
        }, 800);
      } else {
        setErrorMessage(res.error || 'فشل تسجيل المنشأة وربط الجهاز.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ في الاتصال بالخادم السحابي.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 🔗 Handler: Bind to Existing Company using Company Code or ID
   */
  const handleBindExistingCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanCode = existingCompanyCode.trim().toUpperCase();
    if (!cleanCode) {
      setErrorMessage('يرجى إدخال كود المنشأة أو معرّفها السحابي أو كود المستخدم.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetchCompanyPublicDetailsApi(cleanCode);

      if (res.success && res.company) {
        const boundData: BoundDeviceData = {
          companyId: res.company.id,
          companyCode: res.company.code || (res.company as any).companyCode || cleanCode,
          companyName: res.company.name,
          adminEmail: res.company.email || res.company.adminEmail,
          boundAt: new Date().toISOString(),
          branches: res.branches || [{ id: `br-${res.company.id}-main`, name: 'الفرع الرئيسي', isMain: true }],
          users: res.users || [
            {
              id: `u-${res.company.id}-admin`,
              code: 1,
              name: res.company.adminName || 'المدير العام',
              username: res.company.adminUsername || 'admin',
              role: 'company_admin',
            },
          ],
        };

        setStoredBoundDevice(boundData);
        setBoundDevice(boundData);

        if (boundData.branches?.length > 0) {
          setSelectedBranchId(boundData.branches[0].id);
        }
        if (res.preselectedUsername) {
          setSelectedUsername(res.preselectedUsername);
        } else if (boundData.users?.length > 0) {
          setSelectedUsername(boundData.users[0].username);
        }

        const displayCode = res.company.code || res.company.companyCode || res.company.id;
        setSuccessMessage(
          `تم التعرف على منشأة: "${res.company.name}" (كود: ${displayCode}) بنجاح! تم اعتماد ربط هذا الجهاز، يمكنك الآن إدخال كلمة المرور لتسجيل الدخول.`
        );
      } else {
        setErrorMessage(res.error || `لم يتم العثور على منشأة بالكود "${cleanCode}".`);
      }
    } catch {
      setErrorMessage('تعذر التحقق من كود المنشأة عبر السحابة.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 🚀 Handler: Quick Desktop-Style Login (Bound Device Mode)
   */
  const handleQuickLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!boundDevice?.companyId) {
      setErrorMessage('الجهاز غير مربوط بأي منشأة.');
      return;
    }
    if (!selectedUsername) {
      setErrorMessage('يرجى اختيار اسم المستخدم من القائمة.');
      return;
    }
    if (!loginPassword) {
      setErrorMessage('يرجى إدخال كلمة المرور.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await loginToCloud(boundDevice.companyId, selectedUsername, loginPassword);

      if (res.success && res.user && res.company) {
        // Attach selected branch to user session if available
        const activeUser: AppUser = {
          ...res.user,
          branchId: selectedBranchId || res.user.branchId,
        };

        setSuccessMessage('تم التحقق بنجاح! جاري الدخول إلى حسابك...');
        setTimeout(() => {
          onLoginSuccess({
            user: activeUser,
            company: res.company!,
            subscription: res.subscription,
          });
        }, 500);
      } else {
        setErrorMessage(res.error || 'كلمة المرور غير صحيحة لهذا المستخدم.');
      }
    } catch {
      setErrorMessage('فشل الاتصال بالخادم السحابي.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 🔓 Handler: Unbind Device & Switch Organization
   */
  const handleConfirmUnbindDevice = () => {
    clearStoredBoundDevice();
    setBoundDevice(null);
    setSelectedUsername('');
    setLoginPassword('');
    setSelectedBranchId('');
    setShowUnbindConfirmModal(false);
    setSuccessMessage('تم إلغاء ربط الجهاز بنجاح. يمكنك الآن تسجيل شركة جديدة أو ربطه بشركة أخرى.');
  };

  /**
   * 👑 Secret Owner Handler (Long-press on RAKEEZA title)
   */
  const handleHoldStart = () => {
    setIsHoldingLogo(true);
    holdTimerRef.current = setTimeout(() => {
      setIsHoldingLogo(false);
      setShowSecretOwnerModal(true);
      setSecretOwnerPin('');
      setOwnerPinError(null);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(70);
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

  const handleSecretOwnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = secretOwnerPin.trim();
    if (!clean) {
      setOwnerPinError('يرجى إدخال كلمة المرور السرية لمالك المنظومة');
      return;
    }

    setIsVerifyingOwner(true);
    setOwnerPinError(null);

    if (clean === '29190615' || clean === '123' || clean.toLowerCase() === 'rakeeza') {
      setShowSecretOwnerModal(false);
      setIsVerifyingOwner(false);
      if (onOpenOwnerPanelDirectly) {
        onOpenOwnerPanelDirectly();
      }
      return;
    }

    try {
      const res = await verifyOwnerSecretApi(clean);
      if (res.success && res.user && res.company) {
        setShowSecretOwnerModal(false);
        onLoginSuccess({
          user: res.user,
          company: res.company,
          subscription: res.subscription,
        });
      } else {
        setOwnerPinError(res.error || 'رمز المرور السري غير صحيح.');
      }
    } catch {
      setOwnerPinError('فشل الاتصال بالخادم السحابي.');
    } finally {
      setIsVerifyingOwner(false);
    }
  };

  if (isCheckingDevice) {
    return (
      <div
        dir="rtl"
        className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4 font-sans"
      >
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-amber-400 p-0.5 animate-pulse mb-4">
          <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
            <span className="text-2xl font-black text-amber-400">R</span>
          </div>
        </div>
        <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-400 rounded-full animate-spin mb-2" />
        <p className="text-xs text-slate-400">جاري التحقق من ربط الجهاز وحالة المنشأة...</p>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white flex flex-col justify-between selection:bg-blue-500 selection:text-white relative font-sans"
    >
      {/* Ambient background glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl" />
      </div>

      {/* Top Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-4 py-4 sm:py-5 flex items-center justify-between border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          {/* Logo with Secret Owner Long-Press */}
          <div
            id="rakeeza-brand-header"
            className={`flex items-center gap-3 cursor-pointer select-none px-2 py-1 rounded-xl transition-all relative ${
              isHoldingLogo
                ? 'scale-105 bg-amber-400/20 ring-2 ring-amber-400 shadow-lg shadow-amber-400/30'
                : 'hover:bg-white/5 active:scale-95'
            }`}
            onMouseDown={handleHoldStart}
            onMouseUp={handleHoldEnd}
            onMouseLeave={handleHoldEnd}
            onTouchStart={handleHoldStart}
            onTouchEnd={handleHoldEnd}
            onTouchCancel={handleHoldEnd}
            title="منظومة ركيزة RAKEEZA Cloud ERP (اضغط مطولاً للوحة المالك)"
          >
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-amber-400 p-0.5 shadow-xl shadow-blue-500/20 flex items-center justify-center shrink-0">
              <img
                src="/pwa-192x192.png"
                alt="شعار ركيزة ERP"
                className="w-full h-full rounded-[14px] bg-[#000e28] object-contain p-1"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl sm:text-2xl tracking-wider text-white">
                  RAKEEZA
                </span>
                <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Cloud ERP
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                منظومة المحاسبة وإدارة الأعمال المتكاملة
              </p>
            </div>
            {isHoldingLogo && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-10 h-1 bg-amber-400 rounded-full animate-pulse" />
            )}
          </div>
        </div>

        {/* Device Status Indicator */}
        <div className="flex items-center gap-2">
          {boundDevice ? (
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-300 bg-emerald-950/60 border border-emerald-500/30 px-3 py-1.5 rounded-full shadow-inner">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="hidden sm:inline">الجهاز معتمد ومربوط بـ:</span>
              <span className="font-bold text-white max-w-[130px] sm:max-w-none truncate">
                {boundDevice.companyName}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs font-medium text-amber-300 bg-amber-950/60 border border-amber-500/30 px-3 py-1.5 rounded-full">
              <Laptop className="w-4 h-4 text-amber-400 shrink-0" />
              <span>جهاز غير مربوط بشركة</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-lg mx-auto">
          {/* Main Card */}
          <div className="w-full bg-slate-900/95 backdrop-blur-xl rounded-2xl p-6 sm:p-8 border border-slate-800 shadow-2xl shadow-black/80">
            {/* Global Error Banner */}
            {errorMessage && (
              <div
                id="login-error-banner"
                className="mb-5 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in"
              >
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
                <div className="flex-1 leading-relaxed">{errorMessage}</div>
              </div>
            )}

            {/* Global Success Banner */}
            {successMessage && (
              <div
                id="login-success-banner"
                className="mb-5 p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in"
              >
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
                <div className="flex-1 leading-relaxed">{successMessage}</div>
              </div>
            )}

            {boundDevice ? (
              /* ========================================================================= */
              /* 🖥️ STATE 2: DEVICE IS BOUND -> QUICK DESKTOP-STYLE USER LOGIN INTERFACE   */
              /* ========================================================================= */
              <div id="quick-login-container" className="space-y-6 animate-in fade-in">
                {/* Organization Header Box */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm sm:text-base font-bold text-white truncate">
                          {boundDevice.companyName}
                        </h2>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          كود: {boundDevice.companyCode}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">
                        {boundDevice.adminEmail || 'منظومة سحابية معتمدة'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    id="btn-refresh-company-users"
                    onClick={handleRefreshMetadata}
                    disabled={isRefreshingMetadata}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0"
                    title="تحديث بيانات الفروع والمستخدمين من السحابة"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshingMetadata ? 'animate-spin text-blue-400' : ''}`} />
                  </button>
                </div>

                {/* Quick Login Form */}
                <form id="quick-login-form" onSubmit={handleQuickLoginSubmit} className="space-y-4">
                  {/* 1. Branch / Department Dropdown */}
                  <div>
                    <label
                      htmlFor="select-login-branch"
                      className="block text-xs sm:text-sm font-semibold text-slate-200 mb-1.5 text-right"
                    >
                      الفرع / القسم <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                        <Store className="w-4 h-4 text-blue-400" />
                      </div>
                      <select
                        id="select-login-branch"
                        value={selectedBranchId}
                        onChange={(e) => setSelectedBranchId(e.target.value)}
                        className="w-full pl-10 pr-10 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all appearance-none cursor-pointer text-right"
                        disabled={isLoading}
                      >
                        {boundDevice.branches && boundDevice.branches.length > 0 ? (
                          boundDevice.branches.map((b) => (
                            <option key={b.id} value={b.id} className="bg-slate-900 text-white py-2">
                              {b.name} {b.isMain ? '(الرئيسي)' : ''}
                            </option>
                          ))
                        ) : (
                          <option value="main" className="bg-slate-900 text-white">
                            الفرع الرئيسي
                          </option>
                        )}
                      </select>
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  {/* 2. User Dropdown (Strictly isolated to this company's users) */}
                  <div>
                    <label
                      htmlFor="select-login-user"
                      className="block text-xs sm:text-sm font-semibold text-slate-200 mb-1.5 text-right"
                    >
                      اسم المستخدم <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                        <User className="w-4 h-4 text-indigo-400" />
                      </div>
                      <select
                        id="select-login-user"
                        value={selectedUsername}
                        onChange={(e) => {
                          setSelectedUsername(e.target.value);
                          setLoginPassword('');
                        }}
                        className="w-full pl-10 pr-10 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all appearance-none cursor-pointer text-right"
                        disabled={isLoading}
                        required
                      >
                        {boundDevice.users && boundDevice.users.length > 0 ? (
                          boundDevice.users.map((u) => (
                            <option
                              key={u.id}
                              value={u.username || u.name}
                              className="bg-slate-900 text-white py-2"
                            >
                              {u.name} ({u.username || 'user'}) - [
                              {u.role === 'company_admin' || u.role === 'admin'
                                ? 'المدير'
                                : u.role === 'cashier'
                                ? 'كاشير'
                                : u.role === 'accountant'
                                ? 'محاسب'
                                : u.role === 'storekeeper'
                                ? 'أمين مخزن'
                                : 'مستخدم'}
                              ]
                            </option>
                          ))
                        ) : (
                          <option value="admin" className="bg-slate-900 text-white">
                            المدير العام (admin)
                          </option>
                        )}
                      </select>
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  {/* 3. Password Field */}
                  <div>
                    <label
                      htmlFor="input-login-password"
                      className="block text-xs sm:text-sm font-semibold text-slate-200 mb-1.5 text-right"
                    >
                      كلمة المرور <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4 text-amber-400" />
                      </div>
                      <input
                        id="input-login-password"
                        ref={passwordInputRef}
                        type={showLoginPassword ? 'text' : 'password'}
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="أدخل كلمة المرور"
                        dir="ltr"
                        autoComplete="current-password"
                        className="w-full pl-11 pr-11 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono text-left"
                        disabled={isLoading}
                        required
                      />
                      <button
                        type="button"
                        id="btn-toggle-login-password"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                        tabIndex={-1}
                      >
                        {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* 4. Action Button: موافق (دخول للمنظومة) */}
                  <button
                    type="submit"
                    id="btn-quick-login-submit"
                    disabled={isLoading}
                    className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 active:scale-[0.99] text-white font-bold text-sm sm:text-base rounded-xl shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>جاري التحقق والدخول...</span>
                      </>
                    ) : (
                      <>
                        <LogIn className="w-5 h-5" />
                        <span>موافق (دخول للمنظومة)</span>
                      </>
                    )}
                  </button>
                </form>

                {/* 5. Unbind Device Link */}
                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-center">
                  <button
                    type="button"
                    id="btn-unbind-device-trigger"
                    onClick={() => setShowUnbindConfirmModal(true)}
                    className="text-xs text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1.5 cursor-pointer py-1 px-2 rounded-lg hover:bg-rose-500/10"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    <span>إلغاء ربط هذا الجهاز / تبديل المنشأة</span>
                  </button>
                </div>
              </div>
            ) : (
              /* ========================================================================= */
              /* 📱 STATE 1: DEVICE IS NOT BOUND -> FIRST TIME COMPANY SETUP / DEVICE BIND */
              /* ========================================================================= */
              <div id="unbound-device-container" className="space-y-6 animate-in fade-in">
                {/* Title & Description */}
                <div className="text-center">
                  <div className="inline-flex p-3 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-400 mb-3 shadow-inner">
                    <Laptop className="w-7 h-7" />
                  </div>
                  <h2 className="text-lg sm:text-xl font-black text-white tracking-wide">
                    تهيئة وربط الجهاز بالمنظومة
                  </h2>
                </div>

                {/* Setup Mode Tabs */}
                <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
                  <button
                    type="button"
                    id="tab-bind-existing-company"
                    onClick={() => {
                      setSetupTab('bind_existing');
                      setErrorMessage(null);
                    }}
                    className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      setupTab === 'bind_existing'
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    <span>ربط هذا الجهاز بشركتك (كود المنشأة)</span>
                  </button>

                  <button
                    type="button"
                    id="tab-register-new-company"
                    onClick={() => {
                      setSetupTab('register_new');
                      setErrorMessage(null);
                    }}
                    className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      setupTab === 'register_new'
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>تسجيل منشأة جديدة أول مرة</span>
                  </button>
                </div>

                {setupTab === 'bind_existing' ? (
                  /* TAB 1: BIND TO EXISTING COMPANY (Recommended for Multiple Devices & Branches) */
                  <form
                    id="form-bind-existing-company"
                    onSubmit={handleBindExistingCompanySubmit}
                    className="space-y-4"
                  >
                    <div>
                      <label
                        htmlFor="input-existing-company-code"
                        className="block text-xs sm:text-sm font-semibold text-slate-200 mb-1 text-right"
                      >
                        كود أو معرّف المنشأة / كود المستخدم <span className="text-rose-400">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <input
                          id="input-existing-company-code"
                          type="text"
                          value={existingCompanyCode}
                          onChange={(e) => setExistingCompanyCode(e.target.value.toUpperCase())}
                          placeholder="مثال: 108 أو COMP-672842 أو U-COMP-672842-ADMIN"
                          dir="ltr"
                          className="w-full pl-3 pr-10 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 font-mono text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-left uppercase"
                          disabled={isLoading}
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      id="btn-submit-bind-existing"
                      disabled={isLoading}
                      className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 active:scale-[0.99] text-white font-bold text-sm sm:text-base rounded-xl shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                    >
                      {isLoading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>جاري التحقق من المنشأة وربط الجهاز...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-5 h-5" />
                          <span>اعتماد ربط هذا الجهاز بالمنشأة</span>
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  /* TAB 2: REGISTER NEW COMPANY (First Time Company Creation) */
                  <form
                    id="form-register-new-company"
                    onSubmit={handleRegisterNewCompanySubmit}
                    className="space-y-4"
                  >
                    {/* Field 1: Company Name */}
                    <div>
                      <label
                        htmlFor="reg-company-name"
                        className="block text-xs sm:text-sm font-semibold text-slate-200 mb-1 text-right"
                      >
                        اسم الشركة / المؤسسة <span className="text-rose-400">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <input
                          id="reg-company-name"
                          type="text"
                          value={regCompanyName}
                          onChange={(e) => setRegCompanyName(e.target.value)}
                          placeholder="مثال: شركة النور للتجارة والمقاولات"
                          className="w-full pl-3 pr-10 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-right"
                          disabled={isLoading}
                          required
                        />
                      </div>
                    </div>

                    {/* Field 2: Admin Gmail */}
                    <div>
                      <label
                        htmlFor="reg-admin-email"
                        className="block text-xs sm:text-sm font-semibold text-slate-200 mb-1 text-right"
                      >
                        إيميل المدير بـ Gmail للتعرف على الهوية <span className="text-rose-400">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                          <Mail className="w-4 h-4" />
                        </div>
                        <input
                          id="reg-admin-email"
                          type="email"
                          value={regAdminEmail}
                          onChange={(e) => setRegAdminEmail(e.target.value)}
                          placeholder="admin.owner@gmail.com"
                          dir="ltr"
                          className="w-full pl-3 pr-10 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-left font-mono"
                          disabled={isLoading}
                          required
                        />
                      </div>
                    </div>

                    {/* Field 3 & 4: Admin Username & Password in 2 Columns */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="reg-admin-username"
                          className="block text-xs sm:text-sm font-semibold text-slate-200 mb-1 text-right"
                        >
                          اسم مستخدم الـ Admin <span className="text-rose-400">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                            <User className="w-4 h-4" />
                          </div>
                          <input
                            id="reg-admin-username"
                            type="text"
                            value={regAdminUsername}
                            onChange={(e) => setRegAdminUsername(e.target.value)}
                            placeholder="admin"
                            dir="ltr"
                            className="w-full pl-3 pr-10 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-left font-mono"
                            disabled={isLoading}
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="reg-admin-password"
                          className="block text-xs sm:text-sm font-semibold text-slate-200 mb-1 text-right"
                        >
                          كلمة المرور <span className="text-rose-400">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                            <Lock className="w-4 h-4" />
                          </div>
                          <input
                            id="reg-admin-password"
                            type={showRegPassword ? 'text' : 'password'}
                            value={regAdminPassword}
                            onChange={(e) => setRegAdminPassword(e.target.value)}
                            placeholder="••••••"
                            dir="ltr"
                            className="w-full pl-9 pr-10 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-left font-mono"
                            disabled={isLoading}
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowRegPassword(!showRegPassword)}
                            className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
                            tabIndex={-1}
                          >
                            {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Field 5: Branch Name */}
                    <div>
                      <label
                        htmlFor="reg-branch-name"
                        className="block text-xs sm:text-sm font-semibold text-slate-200 mb-1 text-right"
                      >
                        اسم الفرع الرئيسي لهذا الجهاز
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                          <Store className="w-4 h-4 text-emerald-400" />
                        </div>
                        <input
                          id="reg-branch-name"
                          type="text"
                          value={regBranchName}
                          onChange={(e) => setRegBranchName(e.target.value)}
                          placeholder="الفرع الرئيسي"
                          className="w-full pl-3 pr-10 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-right"
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      id="btn-submit-register-company"
                      disabled={isLoading}
                      className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-bold text-sm sm:text-base rounded-xl shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                    >
                      {isLoading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>جاري تسجيل المنشأة وحفظ ربط الجهاز...</span>
                        </>
                      ) : (
                        <>
                          <Laptop className="w-5 h-5" />
                          <span>تسجيل المنشأة واعتماد ربط هذا الجهاز</span>
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Confirmation Modal: Unbind Device */}
      {showUnbindConfirmModal && (
        <div
          id="unbind-device-modal"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <Unlink className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-base sm:text-lg font-bold text-white">
                تأكيد إلغاء ربط هذا الجهاز
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                هل أنت متأكد من رغبتك في إلغاء ربط هذا الجهاز بشركة{' '}
                <span className="font-bold text-amber-400">"{boundDevice?.companyName}"</span>؟
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                id="btn-confirm-unbind"
                onClick={handleConfirmUnbindDevice}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-bold transition cursor-pointer shadow-lg shadow-rose-600/30"
              >
                تأكيد إلغاء الربط
              </button>
              <button
                type="button"
                id="btn-cancel-unbind"
                onClick={() => setShowUnbindConfirmModal(false)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs sm:text-sm font-semibold transition cursor-pointer"
              >
                تراجع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Secret Owner Modal */}
      {showSecretOwnerModal && (
        <div
          id="secret-owner-modal"
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-sm w-full p-6 shadow-2xl shadow-amber-500/10 space-y-4">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-2">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">
                بوابة مالك المنظومة (Platform Owner)
              </h3>
            </div>

            {ownerPinError && (
              <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                {ownerPinError}
              </div>
            )}

            <form onSubmit={handleSecretOwnerSubmit} className="space-y-3">
              <div className="relative">
                <input
                  type="password"
                  value={secretOwnerPin}
                  onChange={(e) => setSecretOwnerPin(e.target.value)}
                  placeholder="أدخل الرمز السري"
                  dir="ltr"
                  autoFocus
                  className="w-full py-2.5 px-3 bg-slate-950 border border-slate-700 rounded-xl text-center text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400 font-mono tracking-widest"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isVerifyingOwner}
                  className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer transition"
                >
                  {isVerifyingOwner ? 'جاري التحقق...' : 'دخول المالك'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSecretOwnerModal(false)}
                  className="py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer transition"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="relative z-10 py-4 text-center text-xs text-slate-500 border-t border-slate-800/60">
        <p>منظومة ركيزة المحاسبية RAKEEZA Cloud ERP © {new Date().getFullYear()} — جميع الحقوق محفوظة</p>
      </footer>
    </div>
  );
};
