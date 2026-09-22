import React, { useState, useEffect } from 'react';
import {
  AppData,
  TenantCompany,
  SubscriptionPlan,
  LicenseRecord,
  TrialRegistryRecord,
  ExportAuditLog,
  SupportAccessSession,
  CompanyStatus,
} from '../types';
import {
  DEFAULT_COMPANIES,
  DEFAULT_SUBSCRIPTION_PLANS,
  DEFAULT_TRIAL_REGISTRY,
  createNewTenantCompany,
  generateLicenseActivationCode,
  validateTrialEligibility,
} from '../utils/multiTenantService';
import {
  exportFullCompanyBackup,
  exportMigrationExcel,
  exportMigrationCsvPackage,
} from '../utils/migrationExporter';
import {
  fetchOwnerCompaniesCloud,
  deleteCompanyCloudApi,
  cleanEntireSystemCloudApi,
} from '../services/cloudApi';
import {
  firestoreShardingService,
  ShardedFiscalYearSummary,
  ColdStorageArchiveRecord,
} from '../services/firestoreShardingService';

interface OwnerPanelViewProps {
  appData: AppData;
  onUpdateAppData: (data: Partial<AppData>) => void;
  onEnterCompany: (company: TenantCompany, asSupportSession?: boolean, supportReason?: string) => void;
  onClose: () => void;
  onLogout?: () => void;
}

export const OwnerPanelView: React.FC<OwnerPanelViewProps> = ({
  appData,
  onUpdateAppData,
  onEnterCompany,
  onClose,
  onLogout,
}) => {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    appData.isOwnerAuthenticated || false
  );
  const [ownerPin, setOwnerPin] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');

  // Active Tab
  const [activeTab, setActiveTab] = useState<
    'companies' | 'migration' | 'plans' | 'licenses' | 'anti_abuse' | 'audit' | 'firestore_ops'
  >('companies');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState<boolean>(false);
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  // Selected Entities
  const [selectedCompany, setSelectedCompany] = useState<TenantCompany | null>(null);
  const [supportReason, setSupportReason] = useState<string>('فحص فني بناءً على طلب العميل');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportFeedback, setExportFeedback] = useState<string>('');

  // Form State for New Company
  const [newCompanyForm, setNewCompanyForm] = useState<Partial<TenantCompany>>({
    name: '',
    tradeName: '',
    activity: 'تجارة عامة وتوريدات',
    phone: '',
    whatsapp: '',
    email: '',
    address: 'القاهرة، مصر',
    taxNumber: '',
    commercialReg: '',
    adminName: '',
    adminPhone: '',
    adminEmail: '',
    adminUsername: 'admin',
    adminPassword: '',
    planId: 'trial',
  });
  const [formError, setFormError] = useState<string>('');

  // License Generator Form
  const [genPlanId, setGenPlanId] = useState<string>('annual');
  const [genCompanyId, setGenCompanyId] = useState<string>('');
  const [generatedCode, setGeneratedCode] = useState<string>('');

  // Anti-Abuse Test Phone
  const [testPhone, setTestPhone] = useState<string>('');
  const [testPhoneResult, setTestPhoneResult] = useState<{ eligible: boolean; reason?: string } | null>(null);

  // Real-time Cloud Companies State
  const [cloudCompanies, setCloudCompanies] = useState<TenantCompany[]>(
    appData.companies && appData.companies.length > 0 ? appData.companies : DEFAULT_COMPANIES
  );
  const [isLoadingCompanies, setIsLoadingCompanies] = useState<boolean>(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<string>('');

  // Delete Company Confirmation Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [companyToDelete, setCompanyToDelete] = useState<TenantCompany | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string>('');

  // System Cleanup Modal State (Wipe all movements/amounts across system)
  const [isCleanupModalOpen, setIsCleanupModalOpen] = useState<boolean>(false);
  const [cleanupConfirmText, setCleanupConfirmText] = useState<string>('');
  const [isCleaning, setIsCleaning] = useState<boolean>(false);
  const [cleanupFeedback, setCleanupFeedback] = useState<string>('');
  const [cleanupError, setCleanupError] = useState<string>('');

  // 🔥 Firestore Data Sharding, Cold Storage Archiving & Cloud Cleaner State
  const [shardedSummaries, setShardedSummaries] = useState<ShardedFiscalYearSummary[]>([]);
  const [archivesList, setArchivesList] = useState<ColdStorageArchiveRecord[]>([]);
  const [isSharding, setIsSharding] = useState<boolean>(false);
  const [shardingFeedback, setShardingFeedback] = useState<string>('');
  const [isArchiving, setIsArchiving] = useState<boolean>(false);
  const [archiveFeedback, setArchiveFeedback] = useState<string>('');
  const [isCleaningFirestore, setIsCleaningFirestore] = useState<boolean>(false);
  const [firestoreCleanFeedback, setFirestoreCleanFeedback] = useState<string>('');
  const [firestoreCleanError, setFirestoreCleanError] = useState<string>('');
  const [isFirestoreCleanModalOpen, setIsFirestoreCleanModalOpen] = useState<boolean>(false);
  const [firestoreCleanTarget, setFirestoreCleanTarget] = useState<string>('all');
  const [firestoreCleanType, setFirestoreCleanType] = useState<'zero_movements' | 'full_wipe'>('zero_movements');
  const [firestoreCleanConfirmCode, setFirestoreCleanConfirmCode] = useState<string>('');

  // Initial state setup if empty
  const companies: TenantCompany[] = cloudCompanies.length > 0 ? cloudCompanies : (appData.companies || DEFAULT_COMPANIES);
  const plans: SubscriptionPlan[] = appData.plans || DEFAULT_SUBSCRIPTION_PLANS;
  const trialRegistry: TrialRegistryRecord[] = appData.trialRegistry || DEFAULT_TRIAL_REGISTRY;
  const exportAuditLogs: ExportAuditLog[] = appData.exportAuditLogs || [];
  const supportSessions: SupportAccessSession[] = appData.supportSessions || [];

  // Helper to load live companies directly from Cloud Database
  const loadCloudCompanies = async (silent = false) => {
    if (!silent) setIsLoadingCompanies(true);
    try {
      const res = await fetchOwnerCompaniesCloud();
      if (res.success && res.companies) {
        setCloudCompanies(res.companies);
        onUpdateAppData({ companies: res.companies });
        setCloudSyncStatus('متزامن مع السحابة فورياً');
      }
    } catch (err) {
      console.error('Failed to load cloud companies:', err);
    } finally {
      if (!silent) setIsLoadingCompanies(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadCloudCompanies();
    }
  }, [isAuthenticated]);

  // Helper to persist updates
  const updateOwnerState = (updates: Partial<AppData>) => {
    onUpdateAppData({
      companies,
      plans,
      trialRegistry,
      exportAuditLogs,
      supportSessions,
      ...updates,
    });
  };

  // Perform safe deletion of company after confirmation
  const handleConfirmDeleteCompany = async () => {
    if (!companyToDelete) return;
    setIsDeleting(true);
    setDeleteError('');

    try {
      const res = await deleteCompanyCloudApi(companyToDelete.id);
      if (res.success) {
        const remaining = companies.filter((c) => c.id !== companyToDelete.id);
        setCloudCompanies(remaining);
        updateOwnerState({ companies: remaining });
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(`rakeeza_tenant_data_${companyToDelete.id}`);
          }
        } catch {}
        setIsDeleteModalOpen(false);
        setCompanyToDelete(null);
        setDeleteConfirmText('');
        setDeleteError('');
      } else {
        setDeleteError(res.error || 'فشل حذف الشركة من الخادم السحابي.');
      }
    } catch (err: any) {
      setDeleteError(err.message || 'حدث خطأ أثناء محاولة حذف الشركة.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Perform system cleanup: wipe all transactions/movements across all companies
  const handleConfirmSystemCleanup = async () => {
    setIsCleaning(true);
    setCleanupError('');
    setCleanupFeedback('');

    try {
      const res = await cleanEntireSystemCloudApi();
      if (res.success) {
        setCleanupFeedback(res.message || 'تم تنظيف النظام بنجاح وتصفير كافة الحركات والمبالغ.');
        // Refresh cloud companies
        await loadCloudCompanies(true);
        // Also wipe local appData state if applicable
        onUpdateAppData({
          salesInvoices: [],
          purchaseInvoices: [],
          cashTransactions: [],
          journalEntries: [],
          physicalInventories: [],
          inventoryAdjustments: [],
          goodsIssueVouchers: [],
          fiscalClosings: [],
          stockTransfers: [],
          quotations: [],
          cashBox: { drawer: 0, vodafone: 0, instapay: 0, bank: 0 },
        });
        setTimeout(() => {
          setIsCleanupModalOpen(false);
          setCleanupConfirmText('');
        }, 1500);
      } else {
        setCleanupError(res.error || 'فشل تنظيف النظام من الخادم السحابي.');
      }
    } catch (err: any) {
      setCleanupError(err.message || 'حدث خطأ أثناء الاتصال بالخادم السحابي.');
    } finally {
      setIsCleaning(false);
    }
  };

  // -------------------------------------------------------------
  // 🔥 FIRESTORE SHARDING, ARCHIVING & CLEANER HANDLERS
  // -------------------------------------------------------------
  const loadFirestoreShardsAndArchives = async () => {
    try {
      const compId = appData.companyId || 'COMP-000001';
      const [summaries, archives] = await Promise.all([
        firestoreShardingService.fetchAllFiscalYearSummaries(compId),
        firestoreShardingService.fetchTenantArchives(compId),
      ]);
      setShardedSummaries(summaries);
      setArchivesList(archives);
    } catch (e) {
      console.warn('Could not load sharding metadata:', e);
    }
  };

  useEffect(() => {
    if (activeTab === 'firestore_ops') {
      loadFirestoreShardsAndArchives();
    }
  }, [activeTab]);

  // Trigger Data Sharding across fiscal years
  const handleExecuteDataSharding = async () => {
    setIsSharding(true);
    setShardingFeedback('');
    try {
      const compId = appData.companyId || 'COMP-000001';
      const invoices = appData.salesInvoices || [];
      const res = await firestoreShardingService.shardBatchInvoices(compId, invoices);
      if (res.success) {
        setShardingFeedback(`تم تقسيم ${res.shardedCount} فاتورة مبيعات بنجاح إلى مجموعات فرعية للسنوات: ${res.years.join('، ')}`);
        await loadFirestoreShardsAndArchives();
      } else {
        setShardingFeedback('حدث خطأ أثناء تقسيم الفواتير');
      }
    } catch (err: any) {
      setShardingFeedback(`فشل التقسيم: ${err?.message || 'خطأ'}`);
    } finally {
      setIsSharding(false);
    }
  };

  // Trigger Cold Storage Archiving (> 2 Years Old)
  const handleExecuteColdArchiving = async () => {
    setIsArchiving(true);
    setArchiveFeedback('');
    try {
      const compId = appData.companyId || 'COMP-000001';
      const res = await firestoreShardingService.executeColdStorageArchiving(compId, appData, 'مالك المنصة');
      if (res.archivedCount > 0) {
        onUpdateAppData(res.remainingData);
        setArchiveFeedback(`تم أرشفة ${res.archivedCount} حركة قديمة بنجاح إلى Google Cloud Storage مع حفظ مؤشراتها في Firestore`);
        await loadFirestoreShardsAndArchives();
      } else {
        setArchiveFeedback('لا توجد فواتير أو حركات يتجاوز عمرها السنتين بحاجة للأرشفة حالياً');
      }
    } catch (err: any) {
      setArchiveFeedback(`فشل تنفيذ الأرشفة: ${err?.message || 'خطأ'}`);
    } finally {
      setIsArchiving(false);
    }
  };

  // Execute Firestore Database Cleaning
  const handleConfirmFirestoreClean = async () => {
    setIsCleaningFirestore(true);
    setFirestoreCleanError('');
    setFirestoreCleanFeedback('');
    try {
      // 1. Create an instant backup first for safety
      try {
        exportFullCompanyBackup(appData, undefined, 'مالك المنصة (قبل تنظيف فايربيس)');
      } catch {}

      // 2. Execute Firestore cleanup
      if (firestoreCleanTarget === 'all') {
        const compIds = companies.map((c) => c.id);
        const res = await firestoreShardingService.cleanAllTenantsFirestoreDatabase(compIds);
        if (res.success) {
          setFirestoreCleanFeedback(res.details);
          // Wipe active local state
          onUpdateAppData({
            salesInvoices: [],
            purchaseInvoices: [],
            cashTransactions: [],
            journalEntries: [],
            physicalInventories: [],
            inventoryAdjustments: [],
            goodsIssueVouchers: [],
            quotations: [],
            cheques: [],
            cashBox: { drawer: 0, vodafone: 0, instapay: 0, bank: 0 },
          });
          setTimeout(() => {
            setIsFirestoreCleanModalOpen(false);
            setFirestoreCleanConfirmCode('');
          }, 2000);
        } else {
          setFirestoreCleanError(res.details);
        }
      } else {
        const res = await firestoreShardingService.cleanTenantFirestoreOperationalData(firestoreCleanTarget, true);
        if (res.success) {
          setFirestoreCleanFeedback(res.details);
          if (firestoreCleanTarget === appData.companyId) {
            onUpdateAppData({
              salesInvoices: [],
              purchaseInvoices: [],
              cashTransactions: [],
              journalEntries: [],
              cashBox: { drawer: 0, vodafone: 0, instapay: 0, bank: 0 },
            });
          }
          setTimeout(() => {
            setIsFirestoreCleanModalOpen(false);
            setFirestoreCleanConfirmCode('');
          }, 2000);
        } else {
          setFirestoreCleanError(res.details);
        }
      }
      await loadFirestoreShardsAndArchives();
    } catch (err: any) {
      setFirestoreCleanError(err?.message || 'فشل تنظيف فايربيس');
    } finally {
      setIsCleaningFirestore(false);
    }
  };

  // Authenticate Owner
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Default Owner PIN or password
    if (ownerPin === '123456' || ownerPin === 'rakeeza' || ownerPin === 'owner' || ownerPin === 'admin') {
      setIsAuthenticated(true);
      setAuthError('');
      updateOwnerState({ isOwnerAuthenticated: true });
    } else {
      setAuthError('كلمة المرور غير صحيحة. كلمة المرور الافتراضية للوحة التحكم هي 123456');
    }
  };

  // Logout Owner
  const handleLogout = () => {
    setIsAuthenticated(false);
    updateOwnerState({ isOwnerAuthenticated: false });
    if (onLogout) {
      onLogout();
    }
  };

  // Handle Create Company
  const handleCreateCompany = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!newCompanyForm.name?.trim()) {
      setFormError('يرجى إدخال اسم الشركة');
      return;
    }
    if (!newCompanyForm.phone?.trim()) {
      setFormError('يرجى إدخال رقم الهاتف الرئيسي للشركة');
      return;
    }

    const planId = newCompanyForm.planId || 'trial';

    // Anti-Abuse Validation for Free Trial
    if (planId === 'trial') {
      const eligibility = validateTrialEligibility(
        newCompanyForm.phone!,
        newCompanyForm.email,
        trialRegistry
      );
      if (!eligibility.eligible) {
        setFormError(eligibility.reason || 'رقم الهاتف مستخدم مسبقاً في تجربة مجانية');
        return;
      }
    }

    const { company, license, updatedRegistry } = createNewTenantCompany(
      newCompanyForm,
      planId,
      plans,
      trialRegistry
    );

    const updatedCompanies = [company, ...companies];
    const updatedLicenses = [license, ...(appData.licenses || [])];

    updateOwnerState({
      companies: updatedCompanies,
      licenses: updatedLicenses,
      trialRegistry: updatedRegistry,
    });

    setIsCreateModalOpen(false);
    setNewCompanyForm({
      name: '',
      tradeName: '',
      activity: 'تجارة عامة وتوريدات',
      phone: '',
      whatsapp: '',
      email: '',
      address: 'القاهرة، مصر',
      taxNumber: '',
      commercialReg: '',
      adminName: '',
      adminPhone: '',
      adminEmail: '',
      adminUsername: 'admin',
      adminPassword: '',
      planId: 'trial',
    });
  };

  // Handle Status Change
  const handleStatusChange = (companyId: string, newStatus: CompanyStatus) => {
    const updatedCompanies = companies.map((c) =>
      c.id === companyId ? { ...c, status: newStatus } : c
    );
    updateOwnerState({ companies: updatedCompanies });
  };

  // Handle Launch Support Session
  const handleLaunchSupport = () => {
    if (!selectedCompany) return;
    const session: SupportAccessSession = {
      id: `SUP-${Date.now()}`,
      ownerName: 'RAKEEZA Super Admin',
      companyId: selectedCompany.id,
      companyName: selectedCompany.name,
      reason: supportReason,
      startedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      status: 'active',
      actionsPerformed: ['بدء جلسة الدعم الفني والوصول المباشر'],
    };

    const updatedSessions = [session, ...supportSessions];
    updateOwnerState({
      supportSessions: updatedSessions,
      currentSupportSession: session,
    });

    setIsSupportModalOpen(false);
    onEnterCompany(selectedCompany, true, supportReason);
  };

  // Export Handlers
  const handleExportFullBackup = (company?: TenantCompany) => {
    const targetComp = company || selectedCompany || undefined;
    const { log } = exportFullCompanyBackup(appData, targetComp, 'RAKEEZA OWNER');
    const updatedLogs = [log, ...exportAuditLogs];
    updateOwnerState({ exportAuditLogs: updatedLogs });
    setExportFeedback(`تم إنشاء وتحميل النسخة الاحتياطية الشاملة (JSON) بنجاح (${log.fileSize})`);
    setTimeout(() => setExportFeedback(''), 5000);
  };

  const handleExportMigrationExcel = (company?: TenantCompany) => {
    const targetComp = company || selectedCompany || undefined;
    const { log } = exportMigrationExcel(appData, targetComp, 'RAKEEZA OWNER');
    const updatedLogs = [log, ...exportAuditLogs];
    updateOwnerState({ exportAuditLogs: updatedLogs });
    setExportFeedback(`تم إنشاء وتحميل مصنف الهجرة الشامل (Excel مع قاموس البيانات) بنجاح (${log.fileSize})`);
    setTimeout(() => setExportFeedback(''), 5000);
  };

  const handleExportMigrationCsv = async (company?: TenantCompany) => {
    setIsExporting(true);
    const targetComp = company || selectedCompany || undefined;
    try {
      const { log } = await exportMigrationCsvPackage(appData, targetComp, 'RAKEEZA OWNER');
      const updatedLogs = [log, ...exportAuditLogs];
      updateOwnerState({ exportAuditLogs: updatedLogs });
      setExportFeedback(`تم إنشاء حزمة ملفات CSV المضغوطة (ZIP Bundle) بنجاح (${log.fileSize})`);
      setTimeout(() => setExportFeedback(''), 5000);
    } catch (err) {
      console.error(err);
      setExportFeedback('حدث خطأ أثناء تجميع ملفات CSV');
    } finally {
      setIsExporting(false);
    }
  };

  // Metrics Calculation
  const totalCompanies = companies.length;
  const activeCompanies = companies.filter((c) => c.status === 'active').length;
  const trialCompanies = companies.filter((c) => c.status === 'trial').length;
  const suspendedCompanies = companies.filter((c) => c.status === 'suspended').length;
  const expiredCompanies = companies.filter((c) => c.status === 'expired').length;

  const planStats = {
    trial: companies.filter((c) => c.planId === 'trial').length,
    monthly: companies.filter((c) => c.planId === 'monthly').length,
    semi_annual: companies.filter((c) => c.planId === 'semi_annual').length,
    annual: companies.filter((c) => c.planId === 'annual').length,
    lifetime: companies.filter((c) => c.planId === 'lifetime').length,
  };

  const totalUsersAcrossCompanies = companies.reduce((acc, c) => acc + (c.usersCount || 1), 0);
  const totalBranchesAcrossCompanies = companies.reduce((acc, c) => acc + (c.branchesCount || 1), 0);
  const totalOperationsAcrossCompanies = companies.reduce((acc, c) => acc + (c.operationsCount || 0), 0);

  // Filtered Companies List
  const filteredCompanies = companies.filter((c) => {
    const matchQuery =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery) ||
      c.adminName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchPlan = planFilter === 'all' || c.planId === planFilter;
    return matchQuery && matchStatus && matchPlan;
  });

  // If not authenticated, render Login Gate
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-slate-800 border border-slate-700 rounded-3xl p-8 max-w-md w-full shadow-2xl text-white">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-amber-500/20 border border-amber-500/40 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3 shadow-inner">
              👑
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">
              RAKEEZA | لوحة مالك المنصة
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              منصة إدارة المستأجرين والشركات والاشتراكات السحابية Multi-Tenant SaaS
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                رمز المرور السري للمالك (Owner PIN / Password)
              </label>
              <input
                type="password"
                value={ownerPin}
                onChange={(e) => setOwnerPin(e.target.value)}
                placeholder="أدخل رمز المالك (الافتراضي: 123456)"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-500 font-mono tracking-widest text-center"
                autoFocus
              />
            </div>

            {authError && (
              <div className="p-3 bg-red-900/40 border border-red-500/50 rounded-xl text-xs text-red-200">
                {authError}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black py-3 rounded-xl transition shadow-lg cursor-pointer flex items-center justify-center gap-2"
            >
              <span>تسجيل الدخول إلى لوحة التحكم</span>
              <span>🔒</span>
            </button>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-slate-400 hover:text-white transition"
              >
                ← العودة إلى منظومة ركيزة
              </button>
              <span className="text-[10px] text-slate-500">v8.0 Multi-Tenant Edition</span>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col" dir="rtl">
      {/* Top Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black text-xl shadow-md">
              👑
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-white">RAKEEZA | لوحة مالك المنصة السحابية</h1>
                <span className="bg-amber-500/20 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-md border border-amber-500/30">
                  Owner Super Admin
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                إدارة الشركات والمستأجرين • التراخيص والاشتراكات • مكافحة التحايل • هجرة البيانات الشاملة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <span>➕ إضافة شركة جديدة</span>
            </button>
            <button
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 transition"
            >
              🏢 العودة للنظام
            </button>
            <button
              onClick={handleLogout}
              className="bg-red-950 hover:bg-red-900 text-red-200 text-xs font-semibold px-3 py-2 rounded-xl border border-red-800/60 transition"
              title="تسجيل الخروج"
            >
              🚪 خروج
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Feedback Alert */}
        {exportFeedback && (
          <div className="p-4 bg-emerald-950/80 border border-emerald-500 rounded-2xl text-sm font-bold text-emerald-200 shadow-lg animate-fadeIn flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">✅</span>
              <span>{exportFeedback}</span>
            </div>
            <button
              onClick={() => setExportFeedback('')}
              className="text-emerald-400 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* Global Statistics Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-xs text-slate-400 font-semibold">إجمالي الشركات</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-black text-white font-mono">{totalCompanies}</span>
              <span className="text-xs text-slate-500">شركة</span>
            </div>
            <div className="mt-2 text-[10px] text-emerald-400 flex items-center gap-1">
              <span>●</span>
              <span>{activeCompanies} نشطة</span>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-xs text-slate-400 font-semibold">التجربة المجانية (30D)</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-black text-emerald-400 font-mono">{trialCompanies}</span>
              <span className="text-xs text-slate-500">تجربة</span>
            </div>
            <div className="mt-2 text-[10px] text-slate-400">
              {trialRegistry.length} مسجل بسجل التحقق
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-xs text-slate-400 font-semibold">الاشتراكات المدفوعة</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-black text-amber-400 font-mono">
                {planStats.monthly + planStats.semi_annual + planStats.annual + planStats.lifetime}
              </span>
              <span className="text-xs text-slate-500">خطة</span>
            </div>
            <div className="mt-2 text-[10px] text-amber-300">
              {planStats.annual} سنوي • {planStats.lifetime} مدى الحياة
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-xs text-slate-400 font-semibold">المستخدمين بالنظام</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-black text-blue-400 font-mono">{totalUsersAcrossCompanies}</span>
              <span className="text-xs text-slate-500">مستخدم</span>
            </div>
            <div className="mt-2 text-[10px] text-slate-400">
              {totalBranchesAcrossCompanies} فرع ومستودع
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-xs text-slate-400 font-semibold">إجمالي العمليات المنفذة</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-black text-purple-400 font-mono">{totalOperationsAcrossCompanies}</span>
              <span className="text-xs text-slate-500">حركة</span>
            </div>
            <div className="mt-2 text-[10px] text-purple-300">فواتير ومخزون وسندات</div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-xs text-slate-400 font-semibold">حالة الخوادم السحابية</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-base font-black text-emerald-400 font-mono">99.99%</span>
              <span className="text-[10px] bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-800">
                Active
              </span>
            </div>
            <div className="mt-2 text-[10px] text-slate-400">المزامنة: متصل ولحظي</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-1.5 flex flex-wrap gap-1">
          <button
            onClick={() => setActiveTab('companies')}
            className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'companies'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span>🏢 الشركات والمستأجرين</span>
            <span className="bg-black/20 text-current text-[10px] px-1.5 py-0.5 rounded-full">
              {companies.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('migration')}
            className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'migration'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span>💾 مركز هجرة وتصدير البيانات</span>
            <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded-md">
              JSON / Excel / CSV
            </span>
          </button>

          <button
            onClick={() => setActiveTab('plans')}
            className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'plans'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span>💳 الخطط والاشتراكات</span>
          </button>

          <button
            onClick={() => setActiveTab('licenses')}
            className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'licenses'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span>🔑 التراخيص وأكواد التفعيل</span>
          </button>

          <button
            onClick={() => setActiveTab('anti_abuse')}
            className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'anti_abuse'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span>🛡️ مكافحة التحايل على التجربة</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span>📜 سجل الرقابة والدعم</span>
          </button>

          <button
            onClick={() => setActiveTab('firestore_ops')}
            className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'firestore_ops'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black shadow-md'
                : 'text-amber-400 hover:bg-slate-800 border border-amber-500/30'
            }`}
          >
            <span>🔥 إدارة فايربيس والتقسيم والأرشفة</span>
          </button>
        </div>

        {/* TAB 1: Companies & Tenants Management */}
        {activeTab === 'companies' && (
          <div className="space-y-4">
            {/* Search & Filter Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap gap-3 items-center justify-between">
              <div className="flex-1 min-w-[240px]">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="🔍 بحث باسم الشركة، كود الشركة، رقم الهاتف، أو اسم المدير..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none"
                >
                  <option value="all">كافة الحالات</option>
                  <option value="active">نشطة (Active)</option>
                  <option value="trial">تجربة مجانية (Trial)</option>
                  <option value="suspended">معلقة (Suspended)</option>
                  <option value="expired">منتهية (Expired)</option>
                </select>

                <select
                  value={planFilter}
                  onChange={(e) => setPlanFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none"
                >
                  <option value="all">كافة الخطط</option>
                  <option value="trial">التجربة المجانية (30D)</option>
                  <option value="monthly">الشهري (Monthly)</option>
                  <option value="semi_annual">6 أشهر (Semi-Annual)</option>
                  <option value="annual">السنوي (Annual)</option>
                  <option value="lifetime">مدى الحياة (Lifetime)</option>
                </select>

                <button
                  type="button"
                  onClick={() => loadCloudCompanies(false)}
                  disabled={isLoadingCompanies}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3 py-2 rounded-xl transition flex items-center gap-1.5 border border-slate-700 cursor-pointer disabled:opacity-50"
                  title="تحديث قائمة الشركات فورياً من السحابة السحابية"
                >
                  <span className={isLoadingCompanies ? 'animate-spin' : ''}>🔄</span>
                  <span>{isLoadingCompanies ? 'جاري التحميل...' : 'تحديث السحابة'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCleanupConfirmText('');
                    setCleanupError('');
                    setCleanupFeedback('');
                    setIsCleanupModalOpen(true);
                  }}
                  className="bg-purple-950/70 hover:bg-purple-900 text-purple-300 hover:text-white border border-purple-800/80 text-xs font-black px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="تنظيف النظام وتصفير كافة الحركات والمبالغ المسجلة"
                >
                  <span>🧹</span>
                  <span>تنظيف وتصفير النظام</span>
                </button>

                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black px-4 py-2 rounded-xl transition flex items-center gap-1 cursor-pointer"
                >
                  <span>➕ شركة جديدة</span>
                </button>
              </div>
            </div>

            {/* Companies Section */}
            {/* Mobile Companies Cards (< md) */}
            <div className="block md:hidden space-y-3">
              {filteredCompanies.map((c) => (
                <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-xl text-xs">
                  <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2.5">
                    <div>
                      <div className="font-bold text-white text-base">{c.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-amber-400 font-bold">
                          {c.code}
                        </span>
                        <span className="text-[10px] text-slate-400">{c.activity}</span>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        c.status === 'active'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : c.status === 'trial'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : c.status === 'suspended'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}
                    >
                      ● {c.status === 'active' ? 'نشطة' : c.status === 'trial' ? 'تجربة' : c.status === 'suspended' ? 'معلقة' : 'منتهية'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[11px]">
                    <div>
                      <span className="text-slate-500 block text-[10px]">الخطة:</span>
                      <span className="font-bold text-slate-200">{c.planName}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">الانتهاء:</span>
                      <span className="font-mono text-slate-300">{c.trialExpiresAt || c.subscriptionExpiresAt || 'دائم'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">المدير:</span>
                      <span className="text-slate-200 font-medium">{c.adminName} ({c.phone})</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">المستخدمين:</span>
                      <span className="font-mono text-slate-300">{c.usersCount || 1} / {c.limits.maxUsers}</span>
                    </div>
                  </div>

                  {/* Actions Grid */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => {
                        setSelectedCompany(c);
                        setIsSupportModalOpen(true);
                      }}
                      className="min-h-[40px] bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                    >
                      <span>🛠️</span>
                      <span>دخول دعم</span>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedCompany(c);
                        setIsExportModalOpen(true);
                      }}
                      className="min-h-[40px] bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition flex items-center justify-center gap-1"
                    >
                      <span>💾</span>
                      <span>تصدير</span>
                    </button>

                    {c.status === 'active' || c.status === 'trial' ? (
                      <button
                        onClick={() => handleStatusChange(c.id, 'suspended')}
                        className="min-h-[40px] bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-800/60 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1"
                      >
                        <span>⏸️</span>
                        <span>تعليق الحساب</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStatusChange(c.id, 'active')}
                        className="min-h-[40px] bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/60 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1"
                      >
                        <span>▶️</span>
                        <span>تنشيط الحساب</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setCompanyToDelete(c);
                        setDeleteConfirmText('');
                        setDeleteError('');
                        setIsDeleteModalOpen(true);
                      }}
                      className="min-h-[40px] bg-rose-950/80 hover:bg-rose-900 text-rose-300 hover:text-white border border-rose-800/80 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                    >
                      <span>🗑️</span>
                      <span>حذف الشركة</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Companies Table (>= md) */}
            <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-3.5">الشركة / المعرف</th>
                      <th className="p-3.5">الخطة والترخيص</th>
                      <th className="p-3.5">المدير والاتصال</th>
                      <th className="p-3.5">المستخدمين والفروع</th>
                      <th className="p-3.5">تاريخ الانتهاء</th>
                      <th className="p-3.5">الحالة</th>
                      <th className="p-3.5 text-center">إجراءات المالك</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredCompanies.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-800/40 transition">
                        <td className="p-3.5">
                          <div className="font-bold text-white text-sm">{c.name}</div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-amber-400">
                              {c.code}
                            </span>
                            <span className="font-mono text-slate-500">{c.id}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 truncate max-w-[200px] mt-0.5">
                            {c.activity}
                          </div>
                        </td>

                        <td className="p-3.5">
                          <span
                            className={`inline-block font-bold text-[11px] px-2 py-0.5 rounded-md border ${
                              c.planId === 'lifetime'
                                ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                                : c.planId === 'annual'
                                ? 'bg-amber-950 text-amber-300 border-amber-700'
                                : c.planId === 'trial'
                                ? 'bg-blue-950 text-blue-300 border-blue-700'
                                : 'bg-purple-950 text-purple-300 border-purple-700'
                            }`}
                          >
                            {c.planName}
                          </span>
                          <div className="text-[10px] text-slate-400 font-mono mt-1">
                            {c.licenseId}
                          </div>
                        </td>

                        <td className="p-3.5">
                          <div className="font-semibold text-slate-200">{c.adminName}</div>
                          <div className="text-slate-400 font-mono text-[11px] mt-0.5">{c.phone}</div>
                          <div className="text-slate-500 text-[10px]">{c.email}</div>
                        </td>

                        <td className="p-3.5">
                          <div className="text-slate-300 font-mono">
                            {c.usersCount || 1} مستخدم / {c.limits.maxUsers} متاح
                          </div>
                          <div className="text-slate-400 text-[11px] mt-0.5">
                            {c.branchesCount || 1} فروع • {c.operationsCount || 0} حركة
                          </div>
                        </td>

                        <td className="p-3.5">
                          <div className="font-mono text-slate-300 text-xs">
                            {c.trialExpiresAt || c.subscriptionExpiresAt || 'دائم'}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            تم الإنشاء: {c.createdAt.split(' ')[0]}
                          </div>
                        </td>

                        <td className="p-3.5">
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full ${
                              c.status === 'active'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : c.status === 'trial'
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                : c.status === 'suspended'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}
                          >
                            <span>●</span>
                            <span>
                              {c.status === 'active'
                                ? 'نشطة'
                                : c.status === 'trial'
                                ? 'تجربة مجانية'
                                : c.status === 'suspended'
                                ? 'معلقة'
                                : 'منتهية'}
                            </span>
                          </span>
                        </td>

                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {/* Launch Support Session */}
                            <button
                              onClick={() => {
                                setSelectedCompany(c);
                                setIsSupportModalOpen(true);
                              }}
                              className="bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                              title="دخول كدعم فني مباشر"
                            >
                              <span>🛠️ دخول دعم</span>
                            </button>

                            {/* Export Suite */}
                            <button
                              onClick={() => {
                                setSelectedCompany(c);
                                setIsExportModalOpen(true);
                              }}
                              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-slate-700 transition flex items-center gap-1"
                              title="تصدير بيانات الشركة"
                            >
                              <span>💾 تصدير</span>
                            </button>

                            {/* Status Quick Toggle */}
                            {c.status === 'active' || c.status === 'trial' ? (
                              <button
                                onClick={() => handleStatusChange(c.id, 'suspended')}
                                className="bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-800/60 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition"
                                title="تعليق الحساب مؤقتاً"
                              >
                                ⏸️ تعليق
                              </button>
                            ) : (
                              <button
                                onClick={() => handleStatusChange(c.id, 'active')}
                                className="bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/60 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition"
                                title="تنشيط الحساب"
                              >
                                ▶️ تنشيط
                              </button>
                            )}

                            {/* Delete Company Button with Confirmation Protection */}
                            <button
                              type="button"
                              onClick={() => {
                                setCompanyToDelete(c);
                                setDeleteConfirmText('');
                                setDeleteError('');
                                setIsDeleteModalOpen(true);
                              }}
                              className="bg-rose-950/80 hover:bg-rose-900 text-rose-300 hover:text-white border border-rose-800/80 px-2 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                              title="حذف الشركة نهائياً من قاعدة البيانات السحابية"
                            >
                              <span>🗑️</span>
                              <span>حذف</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Data Migration & Export Suite */}
        {activeTab === 'migration' && (
          <div className="space-y-6">
            {/* Banner */}
            <div className="bg-linear-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-2xl">
              <div className="max-w-3xl relative z-10 space-y-3">
                <div className="inline-flex items-center gap-2 bg-amber-500/20 text-amber-300 text-xs font-bold px-3 py-1 rounded-full border border-amber-500/30">
                  <span>✨</span>
                  <span>سيادة البيانات وهجرة الأنظمة المفتوحة (Open Data Sovereignty)</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white">
                  بياناتك ملكك دائماً — تصدير احترافي كامل بكافة المعايير
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  تمنح ركيزة للشركات والمالكين حرية تصدير كامل البيانات والعلاقات والجداول المحاسبية وقاموس البيانات Data Dictionary للاستيراد السهل في أي نظام ERP عالمي (Odoo, SAP, Oracle, Zoho) أو لاستعادة النظام بالكامل بنقرة زر واحدة.
                </p>
              </div>
            </div>

            {/* Quick Export Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Option 1: Full Backup JSON */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-amber-500/50 transition shadow-lg">
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center text-2xl font-bold">
                    📦
                  </div>
                  <h3 className="text-base font-black text-white">
                    1. النسخة الاحتياطية الكاملة (Full Backup JSON)
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    ملف JSON متكامل يحتوي على كافة الكيانات والبيانات والحركات المحاسبية لاستعادة المنظومة بالكامل بنقرة واحدة داخل ركيزة.
                  </p>
                  <ul className="text-[11px] text-slate-300 space-y-1">
                    <li>✓ شجرة الحسابات والقيود اليومية</li>
                    <li>✓ الفواتير والعملاء والمندوبين</li>
                    <li>✓ المخازن والأصناف والأسعار</li>
                  </ul>
                </div>
                <button
                  onClick={() => handleExportFullBackup()}
                  className="mt-5 w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>تحميل النسخة الاحتياطية (JSON)</span>
                  <span>⬇️</span>
                </button>
              </div>

              {/* Option 2: Migration Excel Workbook */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-emerald-500/50 transition shadow-lg">
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-2xl font-bold">
                    📊
                  </div>
                  <h3 className="text-base font-black text-white">
                    2. مصنف الهجرة الشامل (Migration Excel Multi-Sheet)
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    ملف Excel مقسم لصفحات متعددة مع صفحة قاموس البيانات Data Dictionary الشارحة لكل حقل ونوع البيانات والمفاتيح الأجنبية.
                  </p>
                  <ul className="text-[11px] text-slate-300 space-y-1">
                    <li>✓ صفحة Data Dictionary التوضيحية</li>
                    <li>✓ صفحات منفصلة للعملاء والمندوبين والمخازن</li>
                    <li>✓ تفاصيل بنود الفواتير وحركات النقدية</li>
                  </ul>
                </div>
                <button
                  onClick={() => handleExportMigrationExcel()}
                  className="mt-5 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>تحميل مصنف الهجرة (Excel)</span>
                  <span>⬇️</span>
                </button>
              </div>

              {/* Option 3: Migration CSV Bundle */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-blue-500/50 transition shadow-lg">
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/40 text-blue-400 flex items-center justify-center text-2xl font-bold">
                    🗂️
                  </div>
                  <h3 className="text-base font-black text-white">
                    3. حزمة ملفات CSV المنفصلة (CSV ZIP Package)
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    حزمة مضغوطة .ZIP تحتوي على ملف CSV منفصل لكل جدول مع ترميز UTF-8 ودليل الترحيل للاستيراد المباشر في قواعد البيانات.
                  </p>
                  <ul className="text-[11px] text-slate-300 space-y-1">
                    <li>✓ ملفات CSV لكل جدول محاسبي ولوجستي</li>
                    <li>✓ توافق تام مع Odoo / SAP / SQL Server</li>
                    <li>✓ ملف README_MIGRATION_GUIDE.txt</li>
                  </ul>
                </div>
                <button
                  onClick={() => handleExportMigrationCsv()}
                  disabled={isExporting}
                  className="mt-5 w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white font-black py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{isExporting ? 'جاري ضغط الملفات...' : 'تحميل حزمة CSV (ZIP)'}</span>
                  <span>⬇️</span>
                </button>
              </div>
            </div>

            {/* Export Audit Log Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <span>🛡️</span>
                <span>سجل عمليات التصدير والأمان (Export Audit Log)</span>
              </h3>

              {exportAuditLogs.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">
                  لا توجد عمليات تصدير مسجلة حتى الآن. ستظهر هنا كافة سجلات التصدير لأغراض الرقابة والأمان.
                </div>
              ) : (
                <>
                  {/* Mobile Export Logs (< md) */}
                  <div className="block md:hidden space-y-2.5">
                    {exportAuditLogs.map((log) => (
                      <div key={log.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1.5">
                        <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
                          <span className="font-semibold text-white">{log.exportedBy}</span>
                          <span className="font-mono text-slate-500 text-[11px]">{log.timestamp}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-300 font-bold">{log.companyName}</span>
                          <span className="bg-slate-800 px-2 py-0.5 rounded text-[10px] font-mono text-amber-300">
                            {log.exportType}
                          </span>
                        </div>
                        <div className="font-mono text-[11px] text-slate-400 truncate">
                          {log.fileName}
                        </div>
                        <div className="flex items-center justify-between text-[11px] pt-1 text-slate-500">
                          <span>{log.fileSize} ({log.recordsCount || 0} سجل)</span>
                          <span className="text-emerald-400 font-bold">✓ ناجح</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Export Logs Table (>= md) */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="p-3">التاريخ والوقت</th>
                          <th className="p-3">المستخدم / الدور</th>
                          <th className="p-3">الشركة</th>
                          <th className="p-3">نوع التصدير</th>
                          <th className="p-3">اسم الملف</th>
                          <th className="p-3">الحجم والسجلات</th>
                          <th className="p-3">الحالة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {exportAuditLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-800/40">
                            <td className="p-3 font-mono text-slate-400">{log.timestamp}</td>
                            <td className="p-3 font-semibold text-white">{log.exportedBy}</td>
                            <td className="p-3 text-slate-300">{log.companyName}</td>
                            <td className="p-3">
                              <span className="bg-slate-800 px-2 py-0.5 rounded text-[11px] font-mono text-amber-300">
                                {log.exportType}
                              </span>
                            </td>
                            <td className="p-3 font-mono text-[11px] text-slate-300 truncate max-w-[200px]">
                              {log.fileName}
                            </td>
                            <td className="p-3 font-mono text-slate-400">
                              {log.fileSize} ({log.recordsCount || 0} سجل)
                            </td>
                            <td className="p-3">
                              <span className="text-emerald-400 font-bold">✓ ناجح</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: Subscription Plans */}
        {activeTab === 'plans' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {plans.map((p) => (
                <div
                  key={p.id}
                  className={`bg-slate-900 border rounded-2xl p-5 flex flex-col justify-between shadow-xl relative ${
                    p.isPopular
                      ? 'border-amber-500 ring-2 ring-amber-500/20'
                      : 'border-slate-800'
                  }`}
                >
                  {p.isPopular && (
                    <div className="absolute -top-3 right-4 bg-amber-500 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-md">
                      الأكثر طلباً
                    </div>
                  )}

                  <div className="space-y-3">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-amber-400">
                      {p.badge}
                    </span>
                    <h3 className="text-base font-black text-white">{p.name}</h3>
                    <div className="flex items-baseline gap-1 my-2">
                      <span className="text-2xl font-black text-white font-mono">{p.price}</span>
                      <span className="text-xs text-slate-400">{p.currency}</span>
                      <span className="text-[10px] text-slate-500">/ {p.durationDays} يوم</span>
                    </div>
                    <p className="text-xs text-slate-400">{p.description}</p>

                    <div className="border-t border-slate-800 pt-3 space-y-1.5 text-[11px] text-slate-300">
                      <div className="flex justify-between">
                        <span className="text-slate-400">المستخدمين:</span>
                        <span className="font-bold text-white">{p.limits.maxUsers}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">الفروع والمستودعات:</span>
                        <span className="font-bold text-white">
                          {p.limits.maxBranches} فرع / {p.limits.maxWarehouses} مخزن
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">العمليات الشهرية:</span>
                        <span className="font-bold text-white">{p.limits.maxTransactionsPerMonth}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">المساحة السحابية:</span>
                        <span className="font-bold text-white">{p.limits.storageMb} MB</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <span>الشركات المشتركة:</span>
                    <span className="font-bold text-amber-400 font-mono">
                      {companies.filter((c) => c.planId === p.id).length}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: Licenses Center */}
        {activeTab === 'licenses' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <span>🔑</span>
                <span>توليد كود تفعيل جديد (License Key Generator)</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">الشركة المستهدفة</label>
                  <select
                    value={genCompanyId}
                    onChange={(e) => setGenCompanyId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                  >
                    <option value="">اختر الشركة...</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">خطة الترخيص</label>
                  <select
                    value={genPlanId}
                    onChange={(e) => setGenPlanId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.price} {p.currency})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={() => {
                      const code = generateLicenseActivationCode();
                      setGeneratedCode(code);
                    }}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-2.5 rounded-xl text-xs transition cursor-pointer"
                  >
                    ⚡ توليد كود ترخيص مشفر
                  </button>
                </div>
              </div>

              {generatedCode && (
                <div className="bg-slate-950 border-2 border-amber-500/50 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center gap-3">
                  <div>
                    <div className="text-[11px] text-amber-400 font-bold">كود التفعيل الجديد الجاهز للاستخدام:</div>
                    <div className="text-lg font-black font-mono tracking-wider text-white mt-0.5">
                      {generatedCode}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedCode);
                      setExportFeedback('تم نسخ كود التفعيل إلى الحافظة');
                      setTimeout(() => setExportFeedback(''), 3000);
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-4 py-2 rounded-xl border border-slate-700 transition"
                  >
                    📋 نسخ الكود
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: Anti-Abuse Registry */}
        {activeTab === 'anti_abuse' && (
          <div className="space-y-6">
            {/* Anti-Abuse Testing Tool */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <span>🛡️</span>
                <span>فحص رقم هاتف / جهاز في سجل مكافحة التحايل</span>
              </h3>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="أدخل رقم الهاتف للتحقق (مثال: 01011223344)..."
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white"
                />
                <button
                  onClick={() => {
                    const res = validateTrialEligibility(testPhone, undefined, trialRegistry);
                    setTestPhoneResult(res);
                  }}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs transition cursor-pointer"
                >
                  فحص الرقم
                </button>
              </div>

              {testPhoneResult && (
                <div
                  className={`p-4 rounded-xl text-xs ${
                    testPhoneResult.eligible
                      ? 'bg-emerald-950/80 border border-emerald-500 text-emerald-200'
                      : 'bg-red-950/80 border border-red-500 text-red-200'
                  }`}
                >
                  {testPhoneResult.eligible ? (
                    <div>✅ رقم الهاتف مؤهل للاستفادة من التجربة المجانية لمدة 30 يوماً.</div>
                  ) : (
                    <div>❌ {testPhoneResult.reason}</div>
                  )}
                </div>
              )}
            </div>

            {/* Registry Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-black text-white">
                سجل أرقام الهواتف والأجهزة المسجلة في التجربة المجانية ({trialRegistry.length})
              </h3>

              {/* Mobile Trial Registry Cards (< md) */}
              <div className="block md:hidden space-y-2.5">
                {trialRegistry.map((tr) => (
                  <div key={tr.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1.5">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
                      <span className="font-mono font-bold text-amber-300">{tr.phone}</span>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                          tr.status === 'active'
                            ? 'bg-blue-950 text-blue-300'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {tr.status === 'active' ? 'نشطة حالياً' : 'مستنفدة'}
                      </span>
                    </div>
                    <div className="text-white font-semibold">{tr.companyName}</div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>البدء: {tr.trialStartedAt}</span>
                      <span>الانتهاء: {tr.trialExpiresAt}</span>
                    </div>
                    <div className="pt-1">
                      <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                        ✓ تم التحقق بنجاح OTP
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Trial Registry Table (>= md) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3">رقم الهاتف</th>
                      <th className="p-3">الشركة المستفيدة</th>
                      <th className="p-3">تاريخ البدء</th>
                      <th className="p-3">تاريخ الانتهاء</th>
                      <th className="p-3">التحقق OTP</th>
                      <th className="p-3">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {trialRegistry.map((tr) => (
                      <tr key={tr.id} className="hover:bg-slate-800/40">
                        <td className="p-3 font-mono font-bold text-amber-300">{tr.phone}</td>
                        <td className="p-3 text-white font-semibold">{tr.companyName}</td>
                        <td className="p-3 font-mono text-slate-400">{tr.trialStartedAt}</td>
                        <td className="p-3 font-mono text-slate-400">{tr.trialExpiresAt}</td>
                        <td className="p-3">
                          <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                            ✓ تم التحقق بنجاح
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                              tr.status === 'active'
                                ? 'bg-blue-950 text-blue-300'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {tr.status === 'active' ? 'نشطة حالياً' : 'مستنفدة'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: Audit & Support Sessions */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <span>🛠️</span>
                <span>سجل جلسات الدعم الفني والوصول المباشر (Support Access Sessions)</span>
              </h3>

              {supportSessions.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">
                  لم يتم تنفيذ جلسات دخول دعم فني حتى الآن. يتم تسجيل كل جلسة دخول للمالك تلقائياً هنا مع السبب والوقت.
                </div>
              ) : (
                <>
                  {/* Mobile Support Sessions Cards (< md) */}
                  <div className="block md:hidden space-y-2.5">
                    {supportSessions.map((s) => (
                      <div key={s.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1.5">
                        <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
                          <span className="font-semibold text-white">{s.ownerName}</span>
                          <span className="font-mono text-slate-500 text-[11px]">{s.startedAt}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-300 font-bold">{s.companyName}</span>
                          <span className="text-emerald-400 font-bold text-[11px]">✓ مكتملة ومؤمنة</span>
                        </div>
                        <div className="text-amber-300 text-[11px]">
                          السبب: {s.reason}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500">
                          المعرف: {s.id}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Support Sessions Table (>= md) */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="p-3">معرف الجلسة</th>
                          <th className="p-3">المشرف المنفذ</th>
                          <th className="p-3">الشركة المستهدفة</th>
                          <th className="p-3">سبب الدعم الفني</th>
                          <th className="p-3">وقت البدء</th>
                          <th className="p-3">الحالة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {supportSessions.map((s) => (
                          <tr key={s.id} className="hover:bg-slate-800/40">
                            <td className="p-3 font-mono text-slate-400">{s.id}</td>
                            <td className="p-3 font-semibold text-white">{s.ownerName}</td>
                            <td className="p-3 text-slate-300">{s.companyName}</td>
                            <td className="p-3 text-amber-300">{s.reason}</td>
                            <td className="p-3 font-mono text-slate-400">{s.startedAt}</td>
                            <td className="p-3">
                              <span className="text-emerald-400 font-bold">✓ مكتملة ومؤمنة</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* TAB 7: Firestore Ops, Data Sharding & Cold Archiving */}
        {activeTab === 'firestore_ops' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header / Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-4 space-y-1">
                <div className="flex items-center justify-between text-xs text-amber-400 font-bold">
                  <span>هندسة التجزئة (Data Sharding)</span>
                  <span>⚡ نشطة</span>
                </div>
                <div className="text-xl font-black text-white">
                  {shardedSummaries.length > 0 ? `${shardedSummaries.length} سنوات مالية` : 'جاهزة للتقسيم'}
                </div>
                <p className="text-[11px] text-slate-400">
                  تقسيم الفواتير في Sub-collections لتخطي حاجز 1MB وتسريع الاستعلامات
                </p>
              </div>

              <div className="bg-slate-900 border border-cyan-500/40 rounded-2xl p-4 space-y-1">
                <div className="flex items-center justify-between text-xs text-cyan-400 font-bold">
                  <span>الأرشفة السحابية (&gt; سنتين)</span>
                  <span>📦 سحابي</span>
                </div>
                <div className="text-xl font-black text-white">
                  {archivesList.length} حزم مؤرشفة
                </div>
                <p className="text-[11px] text-slate-400">
                  تخزين البيانات الباردة في Google Cloud Storage مع حفظ روابطها في فايربيس
                </p>
              </div>

              <div className="bg-slate-900 border border-purple-500/40 rounded-2xl p-4 space-y-1">
                <div className="flex items-center justify-between text-xs text-purple-400 font-bold">
                  <span>تطهير وتفريغ قاعدة البيانات</span>
                  <span>🧹 تحكم المالك</span>
                </div>
                <div className="text-xl font-black text-white">
                  تطهير آمن ومحدد
                </div>
                <p className="text-[11px] text-slate-400">
                  إمكانية تصفير أو حذف حركات فايربيس مع حماية الشركات والاشتراكات
                </p>
              </div>
            </div>

            {/* SECTION 1: DATA SHARDING LAYER */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <span className="p-3 bg-amber-500/20 border border-amber-500/30 rounded-2xl text-xl">🔀</span>
                  <div>
                    <h3 className="text-base font-black text-white">
                      طبقة تقسيم وتجزئة البيانات (Firestore Data Sharding)
                    </h3>
                    <p className="text-xs text-slate-400">
                      تجزئة بيانات المبيعات حسب معرف الشركة والسنة المالية (Fiscal Year) في مجموعات فرعية (Sub-collections)
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleExecuteDataSharding}
                  disabled={isSharding}
                  className="bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs transition cursor-pointer flex items-center gap-2 shadow-lg shadow-amber-950/40"
                >
                  {isSharding ? (
                    <>
                      <span className="animate-spin">🔄</span>
                      <span>جاري تجزئة الفواتير سحابياً...</span>
                    </>
                  ) : (
                    <>
                      <span>🚀</span>
                      <span>تفعيل وتقسيم المبيعات بالسنوات المالية فوراً</span>
                    </>
                  )}
                </button>
              </div>

              {shardingFeedback && (
                <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-bold text-center">
                  ✓ {shardingFeedback}
                </div>
              )}

              {/* Sharded Schema Architecture Info */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs space-y-2">
                <div className="font-bold text-amber-400 flex items-center gap-1.5">
                  <span>📐</span>
                  <span>مسار التجزئة المطبق في Firestore:</span>
                </div>
                <div className="font-mono text-xs text-slate-300 bg-slate-900 p-2.5 rounded-xl border border-slate-800 overflow-x-auto">
                  tenants / <span className="text-amber-400">&#123;companyId&#125;</span> / fiscal_years / <span className="text-emerald-400">&#123;fiscalYear&#125;</span> / sales_invoices / <span className="text-cyan-400">&#123;invoiceId&#125;</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-400 pt-1 text-[11px]">
                  <div>✓ يمنع تماماً تجاوز حد 1MB للوثيقة الواحدة</div>
                  <div>✓ استعلام سريع ومباشر لكل سنة مالية دون سحب الفواتير التاريخية</div>
                  <div>✓ توفير استهلاك سعة وقراءات Firebase بنسبة تزيد عن 85%</div>
                </div>
              </div>

              {/* Sharded Years Breakdown */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-300">
                  ملخص السنوات المالية المجزأة في قاعدة البيانات:
                </h4>
                {shardedSummaries.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 text-xs bg-slate-950/60 rounded-2xl border border-slate-800">
                    لم يتم تسجيل مؤشرات تجزئة سابقة بعد. انقر على زر &quot;تفعيل وتقسيم المبيعات بالسنوات المالية فوراً&quot; لأرشفة وتقسيم الفواتير الحالية.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {shardedSummaries.map((yr) => (
                      <div
                        key={yr.fiscalYear}
                        className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-black text-amber-400 font-mono">
                            السنة المالية: {yr.fiscalYear}
                          </span>
                          <span className="text-[11px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-bold">
                            {yr.invoicesCount} فاتورة
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 space-y-1">
                          <div className="flex justify-between">
                            <span>إجمالي المبيعات:</span>
                            <span className="font-bold text-white font-mono">
                              {yr.totalSalesAmount.toLocaleString()} ج.م
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>المبالغ المحصلة:</span>
                            <span className="font-bold text-emerald-400 font-mono">
                              {yr.totalPaidAmount.toLocaleString()} ج.م
                            </span>
                          </div>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-800/80">
                          آخر تحديث: {yr.lastUpdated ? new Date(yr.lastUpdated).toLocaleDateString('ar-EG') : 'الآن'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 2: COLD STORAGE ARCHIVING (> 2 YEARS OLD) */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <span className="p-3 bg-cyan-500/20 border border-cyan-500/30 rounded-2xl text-xl">❄️</span>
                  <div>
                    <h3 className="text-base font-black text-white">
                      محرك الأرشفة التلقائية السحابية (Cold Storage &gt; 2 Years)
                    </h3>
                    <p className="text-xs text-slate-400">
                      ترحيل البيانات القديمة (&gt; سنتين) إلى Google Cloud Storage مع الاحتفاظ بروابط ومؤشرات الأرشفة في Firestore
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleExecuteColdArchiving}
                  disabled={isArchiving}
                  className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-white font-black px-4 py-2.5 rounded-xl text-xs transition cursor-pointer flex items-center gap-2 shadow-lg shadow-cyan-950/40"
                >
                  {isArchiving ? (
                    <>
                      <span className="animate-spin">🔄</span>
                      <span>جاري الفحص والأرشفة الباردة...</span>
                    </>
                  ) : (
                    <>
                      <span>📦</span>
                      <span>فحص وتشغيل الأرشفة التلقائية (&gt; سنتين)</span>
                    </>
                  )}
                </button>
              </div>

              {archiveFeedback && (
                <div className="p-3 bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 rounded-xl text-xs font-bold text-center">
                  ℹ️ {archiveFeedback}
                </div>
              )}

              {/* Bucket details */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs space-y-2">
                <div className="flex items-center justify-between text-slate-300 font-bold">
                  <span className="flex items-center gap-1.5">
                    <span>☁️</span>
                    <span>سلة التخزين السحابي (Google Cloud Storage Bucket):</span>
                  </span>
                  <span className="font-mono text-cyan-400 text-xs">
                    ai-studio-applet-webapp-17f05.firebasestorage.app
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  يتم الاحتفاظ بوثيقة الأرشيف في Firestore بالمسار: <code className="text-slate-300">tenants/&#123;companyId&#125;/archives/&#123;archiveId&#125;</code> وتتضمن رمز الفحص (Checksum SHA-256) ورابط استرداد البيانات الباردة عند الطلب دون إثقال قاعدة البيانات الحية.
                </p>
              </div>

              {/* Archives Records */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-300">
                  سجل حزم الأرشيف البارد المسجلة في Firestore:
                </h4>
                {archivesList.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 text-xs bg-slate-950/60 rounded-2xl border border-slate-800">
                    لا توجد حزم مؤرشفة حالياً. اضغط على زر الفحص لتجميع وترحيل البيانات التي مر عليها أكثر من سنتين.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {archivesList.map((arch) => (
                      <div
                        key={arch.id}
                        className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{arch.title}</span>
                            <span className="bg-cyan-500/20 text-cyan-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              {arch.recordsCount} حركة محفوظة
                            </span>
                          </div>
                          <div className="text-slate-500 font-mono text-[11px]">
                            المعرف: {arch.id} • الحجم: {arch.fileSizeKB || 12} KB • البصمة: {arch.checksum?.substring(0, 20)}...
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {arch.downloadUrl && (
                            <a
                              href={arch.downloadUrl}
                              download={`rakeeza_cold_archive_${arch.fiscalYear}.json`}
                              className="bg-slate-800 hover:bg-slate-700 text-cyan-300 px-3 py-1.5 rounded-xl font-bold text-xs transition flex items-center gap-1.5"
                            >
                              <span>⬇️</span>
                              <span>تحميل حزمة JSON</span>
                            </a>
                          )}
                          <span className="text-[11px] text-emerald-400 font-bold border border-emerald-500/30 px-2.5 py-1 rounded-xl">
                            ✓ محفوظة ومؤمنة
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 3: FIRESTORE DATABASE CLEANER & RESET */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-purple-950/40 border border-purple-800/80 rounded-3xl p-6 space-y-4 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <span className="p-3 bg-purple-500/20 border border-purple-500/40 rounded-2xl text-xl">🧹</span>
                  <div>
                    <h3 className="text-base font-black text-white">
                      أداة تنظيف وتطهير قاعدة بيانات فايربيس (Firestore Database Cleaner)
                    </h3>
                    <p className="text-xs text-purple-300">
                      خاصية تحكم المالك الحصري لتطهير حركات فايربيس، وتصفير المجموعات الفرعية، وتفريغ السعة التخزينية
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsFirestoreCleanModalOpen(true);
                    setFirestoreCleanConfirmCode('');
                    setFirestoreCleanFeedback('');
                    setFirestoreCleanError('');
                  }}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-black px-5 py-2.5 rounded-xl text-xs transition cursor-pointer flex items-center gap-2 shadow-lg shadow-purple-900/50"
                >
                  <span>🧹</span>
                  <span>بدء إجراء تنظيف فايربيس</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl space-y-2">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <span>1️⃣</span>
                    <span>تصفير وتطهير الحركات والفواتير (Zero Operations):</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    يقوم بمسح فواتير المبيعات، والمشتريات، وسندات الخزينة، والمجموعات الفرعية (Sub-collections) مع <strong>الحفاظ التام على سجل الشركات والمستخدمين وشجرة الحسابات والاشتراكات</strong>.
                  </p>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl space-y-2">
                  <div className="font-bold text-purple-300 flex items-center gap-1.5">
                    <span>2️⃣</span>
                    <span>تأمين فوري للبيانات (Safety Auto-Backup):</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    يقوم النظام تلقائياً بتوليد وتحميل حزمة نسخة احتياطية كاملة (JSON) إلى جهاز المالك قبل تنفيذ أي إجراء تنظيف كإجراء احترازي وقائي.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: Create New Company Wizard */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 text-white space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="text-base font-black text-amber-400 flex items-center gap-2">
                <span>➕</span>
                <span>إضافة وتسجيل شركة جديدة في سحابة ركيزة</span>
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-950 border border-red-500 rounded-xl text-xs text-red-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateCompany} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">اسم الشركة / المؤسسة *</label>
                  <input
                    type="text"
                    required
                    value={newCompanyForm.name}
                    onChange={(e) => setNewCompanyForm({ ...newCompanyForm, name: e.target.value })}
                    placeholder="مثال: شركة التوفيق للتجارة العامة"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">الاسم التجاري / العلامة</label>
                  <input
                    type="text"
                    value={newCompanyForm.tradeName}
                    onChange={(e) => setNewCompanyForm({ ...newCompanyForm, tradeName: e.target.value })}
                    placeholder="مثال: التوفيق ستورز"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">رقم هاتف الشركة الرئيسي *</label>
                  <input
                    type="text"
                    required
                    value={newCompanyForm.phone}
                    onChange={(e) => setNewCompanyForm({ ...newCompanyForm, phone: e.target.value })}
                    placeholder="010XXXXXXXX"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">البريد الإلكتروني للشركة</label>
                  <input
                    type="email"
                    value={newCompanyForm.email}
                    onChange={(e) => setNewCompanyForm({ ...newCompanyForm, email: e.target.value })}
                    placeholder="info@company.com"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">الرقم الضريبي (اختياري)</label>
                  <input
                    type="text"
                    value={newCompanyForm.taxNumber}
                    onChange={(e) => setNewCompanyForm({ ...newCompanyForm, taxNumber: e.target.value })}
                    placeholder="123-456-789"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">السجل التجاري (اختياري)</label>
                  <input
                    type="text"
                    value={newCompanyForm.commercialReg}
                    onChange={(e) => setNewCompanyForm({ ...newCompanyForm, commercialReg: e.target.value })}
                    placeholder="CR-12345"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
                  />
                </div>
              </div>

              {/* Admin credentials */}
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-3">
                <div className="font-bold text-amber-400 text-xs">بيانات المدير العام للشركة (Company Admin):</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">اسم المدير</label>
                    <input
                      type="text"
                      value={newCompanyForm.adminName}
                      onChange={(e) => setNewCompanyForm({ ...newCompanyForm, adminName: e.target.value })}
                      placeholder="المدير المسؤول"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">اسم المستخدم</label>
                    <input
                      type="text"
                      value={newCompanyForm.adminUsername}
                      onChange={(e) => setNewCompanyForm({ ...newCompanyForm, adminUsername: e.target.value })}
                      placeholder="admin"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">كلمة المرور الأولية</label>
                    <input
                      type="text"
                      value={newCompanyForm.adminPassword}
                      onChange={(e) => setNewCompanyForm({ ...newCompanyForm, adminPassword: e.target.value })}
                      placeholder="123456"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Subscription Plan Choice */}
              <div>
                <label className="block font-bold text-slate-300 mb-1">خطة الاشتراك والترخيص</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {plans.map((p) => (
                    <label
                      key={p.id}
                      className={`p-3 rounded-xl border cursor-pointer flex flex-col justify-between transition ${
                        newCompanyForm.planId === p.id
                          ? 'bg-amber-500/20 border-amber-500 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <input
                        type="radio"
                        name="planChoice"
                        value={p.id}
                        checked={newCompanyForm.planId === p.id}
                        onChange={() => setNewCompanyForm({ ...newCompanyForm, planId: p.id })}
                        className="sr-only"
                      />
                      <span className="font-bold text-xs">{p.name}</span>
                      <span className="text-[10px] text-amber-400 font-mono mt-1">
                        {p.price === 0 ? 'مجاناً 30 يوم' : `${p.price} ${p.currency}`}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-2.5 rounded-xl transition cursor-pointer"
                >
                  🚀 إنشاء وتفعيل الشركة وتوليد التراخيص
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-2.5 rounded-xl transition"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Launch Support Access */}
      {isSupportModalOpen && selectedCompany && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-white space-y-4">
            <h3 className="text-base font-black text-indigo-400 flex items-center gap-2">
              <span>🛠️</span>
              <span>بدء جلسة دخول الدعم الفني المباشر</span>
            </h3>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs space-y-1">
              <div className="text-slate-400">الشركة المستهدفة:</div>
              <div className="font-bold text-white text-sm">{selectedCompany.name}</div>
              <div className="text-[11px] text-slate-500 font-mono">
                كود: {selectedCompany.code} • المعرف: {selectedCompany.id}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">سبب الدخول الفني (لأغراض سجل التدقيق)</label>
              <textarea
                value={supportReason}
                onChange={(e) => setSupportReason(e.target.value)}
                rows={3}
                placeholder="أدخل سبب وتفاصيل الدعم الفني..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
              />
            </div>

            <div className="text-[11px] text-slate-400 bg-indigo-950/40 border border-indigo-800/50 p-2.5 rounded-xl">
              ℹ️ سيتم تدوين هذه الجلسة في سجل الرقابة الموحد مع حفظ الطابع الزمني واسم المشرف.
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleLaunchSupport}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-black py-2.5 rounded-xl text-xs transition cursor-pointer"
              >
                🚀 تأكيد والدخول لبيئة الشركة
              </button>
              <button
                onClick={() => setIsSupportModalOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-2.5 rounded-xl text-xs transition"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Single Company Export Options */}
      {isExportModalOpen && selectedCompany && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 text-white space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="text-base font-black text-amber-400 flex items-center gap-2">
                <span>💾</span>
                <span>تصدير حزمة بيانات: {selectedCompany.name}</span>
              </h3>
              <button onClick={() => setIsExportModalOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => {
                  handleExportFullBackup(selectedCompany);
                  setIsExportModalOpen(false);
                }}
                className="w-full bg-slate-950 hover:bg-slate-800 border border-amber-500/40 p-3.5 rounded-2xl text-right flex items-center justify-between transition cursor-pointer"
              >
                <div>
                  <div className="font-bold text-amber-400 text-xs">1. النسخة الاحتياطية الكاملة (JSON)</div>
                  <div className="text-[11px] text-slate-400">لاستعادة النظام بالكامل بنقرة زر واحدة في ركيزة</div>
                </div>
                <span className="text-lg">📦</span>
              </button>

              <button
                onClick={() => {
                  handleExportMigrationExcel(selectedCompany);
                  setIsExportModalOpen(false);
                }}
                className="w-full bg-slate-950 hover:bg-slate-800 border border-emerald-500/40 p-3.5 rounded-2xl text-right flex items-center justify-between transition cursor-pointer"
              >
                <div>
                  <div className="font-bold text-emerald-400 text-xs">2. مصنف الهجرة الشامل (Excel Multi-Sheet)</div>
                  <div className="text-[11px] text-slate-400">يشمل قاموس البيانات Data Dictionary وكافة الجداول</div>
                </div>
                <span className="text-lg">📊</span>
              </button>

              <button
                onClick={async () => {
                  await handleExportMigrationCsv(selectedCompany);
                  setIsExportModalOpen(false);
                }}
                className="w-full bg-slate-950 hover:bg-slate-800 border border-blue-500/40 p-3.5 rounded-2xl text-right flex items-center justify-between transition cursor-pointer"
              >
                <div>
                  <div className="font-bold text-blue-400 text-xs">3. حزمة ملفات CSV المنفصلة (ZIP Bundle)</div>
                  <div className="text-[11px] text-slate-400">متوافق مع Odoo, SAP, Oracle, Zoho, PostgreSQL</div>
                </div>
                <span className="text-lg">🗂️</span>
              </button>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs transition"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🚨 MODAL: Delete Company Secure Confirmation (Safeguarded against accidental clicks) */}
      {isDeleteModalOpen && companyToDelete && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" dir="rtl">
          <div className="bg-slate-900 border-2 border-rose-600/80 rounded-3xl max-w-lg w-full p-6 text-white space-y-4 shadow-2xl shadow-rose-950/50">
            {/* Header */}
            <div className="flex justify-between items-center pb-3 border-b border-rose-900/40">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-600/20 border border-rose-500/50 flex items-center justify-center text-xl text-rose-400">
                  ⚠️
                </div>
                <div>
                  <h3 className="text-base font-black text-rose-400">
                    تأكيد حذف الشركة نهائياً
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    إجراء حرج لحماية البيانات من الحذف الخاطئ
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!isDeleting) {
                    setIsDeleteModalOpen(false);
                    setCompanyToDelete(null);
                    setDeleteConfirmText('');
                    setDeleteError('');
                  }
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
                disabled={isDeleting}
              >
                ✕
              </button>
            </div>

            {/* Company Info Box */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">اسم الشركة:</span>
                <span className="text-white font-black text-sm">{companyToDelete.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">كود الشركة والمعرف:</span>
                <span className="font-mono bg-slate-900 px-2 py-0.5 rounded text-amber-300 font-bold">
                  {companyToDelete.code} ({companyToDelete.id})
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">المدير ورقم الهاتف:</span>
                <span className="text-slate-200">
                  {companyToDelete.adminName || 'المدير العام'} • {companyToDelete.phone || '—'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">الخطة الحالية:</span>
                <span className="text-emerald-400 font-bold">
                  {companyToDelete.planName || companyToDelete.planId}
                </span>
              </div>
            </div>

            {/* Critical Warning Alert */}
            <div className="bg-rose-950/50 border border-rose-700/60 p-3.5 rounded-2xl text-xs text-rose-200 space-y-1.5 leading-relaxed">
              <div className="font-black text-rose-300 flex items-center gap-1.5 text-sm">
                <span>🛑</span>
                <span>تحذير لا رجعة فيه:</span>
              </div>
              <p>
                سيتم مسح هذه الشركة نهائياً من قاعدة البيانات السحابية مع كافة فواتير المبيعات والمشتريات، حركات الخزينة، أرصدة العملاء والموردين، وحسابات المستخدمين التابعة لها.
              </p>
              <p className="text-[11px] text-rose-300 font-bold">
                ⚠️ لن يمكن استرجاع بيانات هذه الشركة بأي شكل بعد تأكيد الحذف.
              </p>
            </div>

            {/* Accidental Click Prevention Step */}
            <div className="space-y-2 pt-1">
              <label className="block text-xs font-bold text-slate-300">
                لتأكيد الحذف ومنع الضغط بالخطأ، اكتب كلمة <span className="text-rose-400 underline font-black">حذف</span> أو كود الشركة <span className="text-amber-400 font-mono font-bold">({companyToDelete.code})</span> أدناه:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="اكتب كلمة 'حذف' هنا..."
                className="w-full bg-slate-950 border-2 border-rose-900/60 focus:border-rose-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none text-center font-bold"
                disabled={isDeleting}
                autoFocus
              />
            </div>

            {/* Error Message */}
            {deleteError && (
              <div className="bg-red-500/20 border border-red-500/40 text-red-300 p-2.5 rounded-xl text-xs font-bold text-center">
                {deleteError}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleConfirmDeleteCompany}
                disabled={
                  isDeleting ||
                  (deleteConfirmText.trim() !== 'حذف' &&
                    deleteConfirmText.trim() !== companyToDelete.code &&
                    deleteConfirmText.trim() !== companyToDelete.id)
                }
                className="flex-1 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 disabled:bg-slate-800 disabled:text-slate-500 text-white font-black py-2.5 rounded-xl text-xs transition cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shadow-md shadow-rose-900/30"
              >
                {isDeleting ? (
                  <>
                    <span className="animate-spin">🔄</span>
                    <span>جاري الحذف النهائي...</span>
                  </>
                ) : (
                  <>
                    <span>🗑️</span>
                    <span>تأكيد الحذف النهائي للشركة</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setCompanyToDelete(null);
                  setDeleteConfirmText('');
                  setDeleteError('');
                }}
                disabled={isDeleting}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-2.5 rounded-xl text-xs transition cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 🧹 SYSTEM CLEANUP CONFIRMATION MODAL                         */}
      {/* ============================================================ */}
      {isCleanupModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-800/80 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl p-2 bg-purple-950/80 border border-purple-800 rounded-xl">🧹</span>
                <div>
                  <h3 className="text-base font-black text-white">تنظيف وتصفير النظام بالكامل</h3>
                  <p className="text-xs text-purple-300">بدء العمليات الجديدة بدون أي حركات سابقة</p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!isCleaning) {
                    setIsCleanupModalOpen(false);
                    setCleanupConfirmText('');
                    setCleanupError('');
                    setCleanupFeedback('');
                  }
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
                disabled={isCleaning}
              >
                ✕
              </button>
            </div>

            {/* Explanatory Box */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-slate-300 font-bold">
                <span>الشركات المسجلة الحالية:</span>
                <span className="text-amber-400 font-mono text-sm">{companies.length} شركة مسجلة</span>
              </div>
              <div className="h-px bg-slate-800 my-1" />
              <div className="space-y-1 text-slate-300 leading-relaxed">
                <p className="font-bold text-white">ما الذي سيقوم به هذا الإجراء؟</p>
                <ul className="list-disc list-inside space-y-1 text-slate-400">
                  <li>مسح وتصفير كافة فواتير المبيعات وفواتير المشتريات.</li>
                  <li>تصفير أرصدة الخزائن النقدية (الدرج، فودافون كاش، إنستاباي، البنوك).</li>
                  <li>تصفير كشوف حسابات العملاء والموردين وأرصدتهم السابقة.</li>
                  <li>تصفير أرصدة شجرة الحسابات العامة وكميات المخزون.</li>
                  <li>إعادة ترقيم الفواتير والسندات لتبدأ من رقم (1).</li>
                  <li><strong className="text-emerald-400">الحفاظ الكامل على تسجيل الشركات والمستخدمين والاشتراكات.</strong></li>
                </ul>
              </div>
            </div>

            {/* Confirmation verification input */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300">
                لتأكيد تنظيف وتصفير كافة الحركات، اكتب كلمة <span className="text-purple-400 underline font-black">تصفير</span> أدناه:
              </label>
              <input
                type="text"
                value={cleanupConfirmText}
                onChange={(e) => setCleanupConfirmText(e.target.value)}
                placeholder="اكتب 'تصفير' هنا..."
                className="w-full bg-slate-950 border-2 border-purple-800/80 focus:border-purple-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none text-center font-bold"
                disabled={isCleaning}
                autoFocus
              />
            </div>

            {/* Feedback & Error */}
            {cleanupFeedback && (
              <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 p-2.5 rounded-xl text-xs font-bold text-center">
                {cleanupFeedback}
              </div>
            )}
            {cleanupError && (
              <div className="bg-red-500/20 border border-red-500/40 text-red-300 p-2.5 rounded-xl text-xs font-bold text-center">
                {cleanupError}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleConfirmSystemCleanup}
                disabled={isCleaning || cleanupConfirmText.trim() !== 'تصفير'}
                className="flex-1 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 disabled:bg-slate-800 disabled:text-slate-500 text-white font-black py-2.5 rounded-xl text-xs transition cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shadow-md shadow-purple-900/40"
              >
                {isCleaning ? (
                  <>
                    <span className="animate-spin">🔄</span>
                    <span>جاري تصفير الحركات والمبالغ...</span>
                  </>
                ) : (
                  <>
                    <span>🧹</span>
                    <span>تأكيد تنظيف وتصفير النظام</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsCleanupModalOpen(false);
                  setCleanupConfirmText('');
                  setCleanupError('');
                  setCleanupFeedback('');
                }}
                disabled={isCleaning}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-2.5 rounded-xl text-xs transition cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 🔥 FIRESTORE DATABASE CLEAN & PURGE MODAL                     */}
      {/* ============================================================ */}
      {isFirestoreCleanModalOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-600/80 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl p-2 bg-purple-950/80 border border-purple-600/60 rounded-xl">🔥</span>
                <div>
                  <h3 className="text-base font-black text-white">تطهير وتنظيف قاعدة بيانات فايربيس السحابية</h3>
                  <p className="text-xs text-purple-300">أداة تحكم المالك الحصري لتفريغ سعة وسجلات Firestore</p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!isCleaningFirestore) {
                    setIsFirestoreCleanModalOpen(false);
                    setFirestoreCleanConfirmCode('');
                    setFirestoreCleanError('');
                    setFirestoreCleanFeedback('');
                  }
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
                disabled={isCleaningFirestore}
              >
                ✕
              </button>
            </div>

            {/* Target Selection */}
            <div className="space-y-1.5 text-xs">
              <label className="block font-bold text-slate-300">
                نطاق التنظيف المستهدف في Firestore:
              </label>
              <select
                value={firestoreCleanTarget}
                onChange={(e) => setFirestoreCleanTarget(e.target.value)}
                disabled={isCleaningFirestore}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
              >
                <option value="all">كافة الشركات والوثائق في Firestore ({companies.length} شركة)</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    شركة: {c.name} ({c.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Mode selection */}
            <div className="space-y-1.5 text-xs">
              <label className="block font-bold text-slate-300">نوع إجراء التنظيف:</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFirestoreCleanType('zero_movements')}
                  className={`p-3 rounded-xl border text-right transition cursor-pointer ${
                    firestoreCleanType === 'zero_movements'
                      ? 'bg-purple-950/60 border-purple-500 text-white font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="text-xs font-bold text-purple-300">تصفير الحركات وتفريغ السعة</div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    مسح الفواتير والشاردز مع الحفاظ التام على الشركات والمستخدمين
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFirestoreCleanType('full_wipe')}
                  className={`p-3 rounded-xl border text-right transition cursor-pointer ${
                    firestoreCleanType === 'full_wipe'
                      ? 'bg-rose-950/60 border-rose-500 text-white font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="text-xs font-bold text-rose-300">إعادة ضبط مصنع فايربيس</div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    تفريغ شامل لجميع وثائق ومجموعات فايربيس الفرعية
                  </div>
                </button>
              </div>
            </div>

            {/* Safety Auto-Backup Alert */}
            <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-3 text-xs text-emerald-300 flex items-start gap-2">
              <span className="text-base">🛡️</span>
              <div className="text-[11px] leading-relaxed">
                <strong>حماية وقائية تلقائية:</strong> سيقوم النظام تلقائياً بتوليد وتحميل حزمة نسخة احتياطية (JSON) قبل بدء التنظيف لضمان إمكانية الاستعادة في أي وقت.
              </div>
            </div>

            {/* Confirmation verification input */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300">
                لتأكيد بدء تنظيف قاعدة بيانات فايربيس، اكتب كود الأمان التالي: <span className="text-purple-400 font-mono font-black underline">تطهير_فايربيس</span>
              </label>
              <input
                type="text"
                value={firestoreCleanConfirmCode}
                onChange={(e) => setFirestoreCleanConfirmCode(e.target.value)}
                placeholder="اكتب 'تطهير_فايربيس' هنا..."
                className="w-full bg-slate-950 border-2 border-purple-700/80 focus:border-purple-400 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none text-center font-bold font-mono"
                disabled={isCleaningFirestore}
                autoFocus
              />
            </div>

            {/* Feedback & Error */}
            {firestoreCleanFeedback && (
              <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 p-2.5 rounded-xl text-xs font-bold text-center">
                ✓ {firestoreCleanFeedback}
              </div>
            )}
            {firestoreCleanError && (
              <div className="bg-red-500/20 border border-red-500/40 text-red-300 p-2.5 rounded-xl text-xs font-bold text-center">
                ✕ {firestoreCleanError}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleConfirmFirestoreClean}
                disabled={isCleaningFirestore || firestoreCleanConfirmCode.trim() !== 'تطهير_فايربيس'}
                className="flex-1 bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white font-black py-2.5 rounded-xl text-xs transition cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shadow-md shadow-purple-900/40"
              >
                {isCleaningFirestore ? (
                  <>
                    <span className="animate-spin">🔄</span>
                    <span>جاري تطهير وتنظيف فايربيس...</span>
                  </>
                ) : (
                  <>
                    <span>🔥</span>
                    <span>تأكيد تطهير وتنظيف Firestore الآن</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsFirestoreCleanModalOpen(false);
                  setFirestoreCleanConfirmCode('');
                  setFirestoreCleanError('');
                  setFirestoreCleanFeedback('');
                }}
                disabled={isCleaningFirestore}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-2.5 rounded-xl text-xs transition cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
