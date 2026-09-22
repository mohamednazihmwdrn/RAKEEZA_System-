import React, { useState, useEffect, useRef } from 'react';
import { AppData } from './types';
import { loadAppData, saveAppData, mergeAppDataMonotonically } from './utils/storage';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Toast } from './components/Toast';
import { HomeView } from './components/HomeView';
import { SalesView } from './components/SalesView';
import { PurchasesView } from './components/PurchasesView';
import { CashView } from './components/CashView';
import { AccountsView } from './components/AccountsView';
import { ItemsView } from './components/ItemsView';
import { OperationsView } from './components/OperationsView';
import { TreasuryView } from './components/TreasuryView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { UsersView } from './components/UsersView';
import { BackupView } from './components/BackupView';
import { InventoryStocktakingView } from './components/InventoryStocktakingView';
import { YearEndClosingView } from './components/YearEndClosingView';

// Enterprise Pillar Views
import { PosView } from './components/PosView';
import { AccountsTreeView } from './components/AccountsTreeView';
import { QuotesOrdersView } from './components/QuotesOrdersView';
import { BranchesView } from './components/BranchesView';
import { EInvoicingView } from './components/EInvoicingView';
import { AuditTrailView } from './components/AuditTrailView';
import { BiAnalyticsView } from './components/BiAnalyticsView';

// 6 Enterprise ERP Modules
import { HrPayrollView } from './components/HrPayrollView';
import { FixedAssetsView } from './components/FixedAssetsView';
import { ChequesView } from './components/ChequesView';
import { PriceManagementView } from './components/PriceManagementView';
import { SalesRepsCommissionsView } from './components/SalesRepsCommissionsView';
import { ManufacturingView } from './components/ManufacturingView';
import { BankReconciliationView } from './components/BankReconciliationView';
import { OwnerPanelView } from './components/OwnerPanelView';
import { TransactionInspectorModal, InspectableItem } from './components/TransactionInspectorModal';
import { CustomerCatalogView } from './components/CustomerCatalogView';
import { ShareCatalogModal } from './components/ShareCatalogModal';
import { CatalogManagerView } from './components/CatalogManagerView';
import { WebOrdersInboxView } from './components/WebOrdersInboxView';
import { MonthlyProfitReportView } from './components/MonthlyProfitReportView';
import { CrmPipelineView } from './components/CrmPipelineView';
import { SerialWarrantyTrackingView } from './components/SerialWarrantyTrackingView';
import { CashFlowClosingView } from './components/CashFlowClosingView';
import { printWebOrderReceipt } from './utils/printOrderReceipt';
import { playOrderAlertChime } from './utils/audioChime';
import {
  createSystemSnapshot,
  downloadBackupJsonFile,
  shouldTriggerAutoBackup,
} from './utils/autoBackup';
import { LoginView } from './components/LoginView';
import {
  fetchCurrentSession,
  fetchTenantDataCloud,
  saveTenantDataCloud,
  logoutFromCloud,
  activateTenantLicenseCloud,
  verifyOwnerSecretApi,
  verifyUserIdentityInFirebase,
  AuthSessionResponse,
} from './services/cloudApi';
import { realtimeSync } from './services/realtimeSync';
import { offlineSyncManager } from './services/offlineSyncManager';
import { AlertTriangle, KeyRound } from 'lucide-react';

export default function App() {
  const [appData, setAppData] = useState<AppData>(() => loadAppData());
  const appDataRef = useRef<AppData>(appData);

  useEffect(() => {
    appDataRef.current = appData;
  }, [appData]);

  const [currentPage, setCurrentPage] = useState<string>('home');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isShareCatalogOpen, setIsShareCatalogOpen] = useState<boolean>(false);

  // Cloud Authentication & Tenant Session State
  const [session, setSession] = useState<AuthSessionResponse | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState<boolean>(false);
  const [licenseCodeInput, setLicenseCodeInput] = useState<string>('');
  const [isActivatingLicense, setIsActivatingLicense] = useState<boolean>(false);

  // Global Transaction Inspector Modal State (Click-to-inspect, print, edit, delete, review)
  const [inspectModalItem, setInspectModalItem] = useState<InspectableItem | null>(null);
  const [isInspectModalOpen, setIsInspectModalOpen] = useState<boolean>(false);

  const handleInspectItem = (type: any, data: any) => {
    setInspectModalItem({ type, data });
    setIsInspectModalOpen(true);
  };

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning' | 'info'>('success');

  const showToast = (msg: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const updateData = (newData: AppData, actionInfo?: { action?: string; module?: string; details?: string }) => {
    // 🔒 If viewing a closed fiscal year, prevent any alterations or deletions (Review & Print only)
    if (appData.viewingClosedYear && newData.viewingClosedYear === appData.viewingClosedYear) {
      const isSwitchingYear = actionInfo?.action === 'تبديل سنة مالية' || actionInfo?.module === 'تبديل سنة مالية';
      if (!isSwitchingYear) {
        showToast('عفواً، لا يمكن تعديل أو حذف أي بيانات أثناء تصفح سنة مالية مغلقة! السنة مخصصة للمراجعة والطباعة والعرض فقط.', 'warning');
        return;
      }
    }

    // 🛡️ Automatic Inventory Stock Reversal on Invoice Deletion / Modification
    if (appData.items && newData.items) {
      // 1. Sales Invoices Stock Reversal (حذف أو تعديل فواتير المبيعات)
      if (appData.salesInvoices && newData.salesInvoices) {
        const deletedSales = appData.salesInvoices.filter(
          (oldInv) => !newData.salesInvoices.some((nInv) => nInv.id === oldInv.id)
        );
        if (deletedSales.length > 0) {
          deletedSales.forEach((delInv) => {
            const isReturn = delInv.type?.startsWith('return_');
            delInv.items?.forEach((invItem) => {
              const currentItem = newData.items.find((i) => (invItem.itemId && i.id === invItem.itemId) || i.name.trim() === invItem.name.trim());
              const oldItem = appData.items.find((i) => (invItem.itemId && i.id === invItem.itemId) || i.name.trim() === invItem.name.trim());
              // If caller didn't adjust stock already (item quantity unchanged between old and new state)
              if (currentItem && oldItem && currentItem.quantity === oldItem.quantity) {
                const qtyToRestore = isReturn ? -invItem.qty : invItem.qty;
                currentItem.quantity = (currentItem.quantity || 0) + qtyToRestore;
                if (!currentItem.movements) currentItem.movements = [];
                currentItem.movements.push({
                  date: new Date().toISOString().split('T')[0],
                  type: 'adjustment',
                  qty: qtyToRestore,
                  price: invItem.price,
                  total: qtyToRestore * (invItem.price || 0),
                  note: `استرجاع رصيد المخزن تلقائياً بعد حذف فاتورة المبيعات #${delInv.id}`,
                });
              }
            });
          });
        }
      }

      // 2. Purchase Invoices Stock Reversal (حذف أو تعديل فواتير المشتريات)
      if (appData.purchaseInvoices && newData.purchaseInvoices) {
        const deletedPurchases = appData.purchaseInvoices.filter(
          (oldInv) => !newData.purchaseInvoices.some((nInv) => nInv.id === oldInv.id)
        );
        if (deletedPurchases.length > 0) {
          deletedPurchases.forEach((delInv) => {
            const isReturn = delInv.type?.startsWith('return_');
            delInv.items?.forEach((invItem) => {
              const currentItem = newData.items.find((i) => (invItem.itemId && i.id === invItem.itemId) || i.name.trim() === invItem.name.trim());
              const oldItem = appData.items.find((i) => (invItem.itemId && i.id === invItem.itemId) || i.name.trim() === invItem.name.trim());
              if (currentItem && oldItem && currentItem.quantity === oldItem.quantity) {
                const qtyToDeduct = isReturn ? invItem.qty : -invItem.qty;
                currentItem.quantity = Math.max(0, (currentItem.quantity || 0) + qtyToDeduct);
                if (!currentItem.movements) currentItem.movements = [];
                currentItem.movements.push({
                  date: new Date().toISOString().split('T')[0],
                  type: 'adjustment',
                  qty: qtyToDeduct,
                  price: invItem.price,
                  total: qtyToDeduct * (invItem.price || 0),
                  note: `تسوية رصيد المخزن تلقائياً بعد حذف فاتورة المشتريات #${delInv.id}`,
                });
              }
            });
          });
        }
      }
    }

    setAppData(newData);
    saveAppData(newData, session?.company?.id);
    if (session?.company?.id) {
      offlineSyncManager.setCompanyId(session.company.id);

      if (!navigator.onLine) {
        // Queue offline mutation for auto-sync on reconnection
        offlineSyncManager.queueMutation(session.company.id, newData, {
          action: actionInfo?.action,
          module: actionInfo?.module,
          details: actionInfo?.details,
          userCode: session.user?.code,
        });
      } else {
        // ⚡ Broadcast instantly to Google Cloud Firestore listeners on all devices
        realtimeSync.broadcastChange(session.company.id, newData, {
          action: actionInfo?.action,
          module: actionInfo?.module,
          details: actionInfo?.details,
          userCode: session.user?.code,
        });

        saveTenantDataCloud(newData, session.company.id, actionInfo).catch((err) => {
          console.warn('Cloud sync note, queued for offline auto-sync:', err);
          offlineSyncManager.queueMutation(session.company.id, newData, {
            action: actionInfo?.action,
            module: actionInfo?.module,
            details: actionInfo?.details,
            userCode: session.user?.code,
          });
        });
      }
    }
  };

  // ⚡ Offline-First Auto Sync listener
  useEffect(() => {
    if (!session?.company?.id) return;
    offlineSyncManager.setCompanyId(session.company.id);

    let prevOnline = navigator.onLine;
    const unsub = offlineSyncManager.subscribe((st) => {
      if (!prevOnline && st.isOnline) {
        showToast('⚡ تم استعادة الاتصال بنجاح وجاري مزامنة العمليات المحفوظة مع السحابة...', 'success');
      } else if (prevOnline && !st.isOnline) {
        showToast('📴 انقطع الاتصال بالإنترنت - يتم حفظ جميع عملياتك محلياً بشكل آمن وستتم المزامنة تلقائياً فور عودة الإنترنت', 'warning');
      }
      prevOnline = st.isOnline;
    });

    return () => unsub();
  }, [session?.company?.id]);

  // 🔄 Real-time Instant Synchronization between Manager (Code 1) and Users (Code 2+)
  useEffect(() => {
    if (!session?.company?.id) {
      realtimeSync.stop();
      return;
    }

    const currentCode = session.user?.code || 1;
    const currentName = session.user?.name || 'مستخدم';

    realtimeSync.init({
      companyId: session.company.id,
      currentUserCode: currentCode,
      currentUserName: currentName,
      onDataUpdated: (incomingData, meta) => {
        if (!incomingData || typeof incomingData !== 'object') return;
        const isExplicitDelete =
          meta?.actionInfo?.action === 'delete' ||
          meta?.actionInfo?.action === 'delete_invoice' ||
          meta?.actionInfo?.action === 'delete_item';

        setAppData((prev) => {
          const merged = mergeAppDataMonotonically(prev, incomingData, isExplicitDelete);
          saveAppData(merged, session.company.id);
          return merged;
        });

        if (meta?.actorCode && meta.actorCode !== currentCode) {
          const actionMsg = meta.actionInfo?.details || 'تعديل وتحديث بيانات المنظومة';
          showToast(
            `⚡ مزامنة فورية: [كود ${meta.actorCode} - ${meta.actorName || 'مستخدم'} (${meta.actorRole === 'admin' ? 'المدير' : 'موظف'})] قام بـ: ${actionMsg}`,
            'info'
          );
        }
      },
    });

    return () => {
      realtimeSync.stop();
    };
  }, [session?.company?.id, session?.user?.code, session?.user?.name]);

  // ☁️ Initialize and Validate Cloud Authentication Session on App Launch
  useEffect(() => {
    let isMounted = true;
    const initSession = async () => {
      try {
        const activeSession = await fetchCurrentSession();
        if (isMounted) {
          if (activeSession.valid && activeSession.user && activeSession.company) {
            // Verify non-owner session against Firebase for strict validity
            if (activeSession.user.role !== 'owner') {
              const compCodeOrId = activeSession.company.code || activeSession.company.id;
              const userCodeOrName = activeSession.user.code || activeSession.user.userCode || activeSession.user.username;
              const verifyRes = await verifyUserIdentityInFirebase(compCodeOrId, userCodeOrName, activeSession.user.uid);
              if (!verifyRes.valid) {
                console.warn('Session rejected during launch validation:', verifyRes.error);
                await logoutFromCloud();
                setSession(null);
                setIsAuthLoading(false);
                return;
              }
              // Update session with verified UIDs
              activeSession.user.uid = verifyRes.user?.uid || activeSession.user.uid;
              activeSession.user.userCode = verifyRes.user?.userCode || activeSession.user.code;
              activeSession.company.uid = verifyRes.company?.uid || activeSession.company.uid;
              activeSession.company.companyCode = verifyRes.company?.companyCode || activeSession.company.code;
            }

            setSession(activeSession);
            // Fetch isolated tenant data directly from cloud database strictly matching company ID and user UID
            const cloudRes = await fetchTenantDataCloud(activeSession.company.id, activeSession.user?.uid);
            if (cloudRes.success && cloudRes.data) {
              setAppData((prev) => {
                const merged = mergeAppDataMonotonically(prev, cloudRes.data);
                saveAppData(merged, activeSession.company.id);
                return merged;
              });
            } else {
              const localData = loadAppData(activeSession.company.id);
              if (localData) {
                setAppData(localData);
              }
            }
          } else {
            setSession(null);
          }
        }
      } catch (err) {
        console.error('Session init error:', err);
      } finally {
        if (isMounted) {
          setIsAuthLoading(false);
        }
      }
    };
    initSession();
    return () => {
      isMounted = false;
    };
  }, []);

  // 🔐 Login Success Handler - Strict Firebase Verification of CompanyCode, UserCode & Password
  const handleLoginSuccess = async (loginResult: {
    user: any;
    company: any;
    subscription: any;
  }) => {
    // 🛡️ Strict Firebase Security Gate: Prevent session creation if verification fails
    if (loginResult.user.role !== 'owner') {
      const companyCodeOrId = loginResult.company.code || loginResult.company.id;
      const userCodeOrName = loginResult.user.code || loginResult.user.userCode || loginResult.user.username;
      
      const verifyRes = await verifyUserIdentityInFirebase(
        companyCodeOrId,
        userCodeOrName,
        loginResult.user.uid
      );

      if (!verifyRes.valid) {
        // 🚫 STRICT BLOCK: Reject session immediately and clear any tokens
        await logoutFromCloud();
        setSession(null);
        showToast(
          `🚫 رفض أمني: فشل التحقق في قاعدة بيانات فايربيس (${verifyRes.error || 'عدم تطابق كود الشركة أو كود المستخدم أو معرّف الهوية UID'}). تم إلغاء ومنع إنشاء الجلسة فوراً.`,
          'error'
        );
        return;
      }

      // Attach verified UIDs and codes
      loginResult.user.uid = verifyRes.user?.uid || loginResult.user.uid;
      loginResult.user.userCode = verifyRes.user?.userCode || loginResult.user.code;
      loginResult.company.uid = verifyRes.company?.uid || loginResult.company.uid;
      loginResult.company.companyCode = verifyRes.company?.companyCode || loginResult.company.code;
    }

    // 🔒 Establish Verified Session
    const verifiedSession: AuthSessionResponse = {
      valid: true,
      user: loginResult.user,
      company: loginResult.company,
      subscription: loginResult.subscription,
    };
    setSession(verifiedSession);

    showToast(
      `مرحباً بك ${loginResult.user.name}! تم التحقق من الهوية بنجاح وتسجيل الدخول لشركة: ${loginResult.company.name} [UID: ${loginResult.company.uid || loginResult.company.id}]`,
      'success'
    );

    // ☁️ Fetch tenant-isolated ERP data from cloud server locked to this company and UID
    try {
      const cloudRes = await fetchTenantDataCloud(loginResult.company.id, loginResult.user.uid);
      if (cloudRes.success && cloudRes.data) {
        setAppData((prev) => {
          const merged = mergeAppDataMonotonically(prev, cloudRes.data);
          saveAppData(merged, loginResult.company.id);
          return merged;
        });
      } else {
        const localData = loadAppData(loginResult.company.id);
        if (localData) {
          setAppData(localData);
        }
        if (!cloudRes.success && cloudRes.error) {
          showToast(cloudRes.error, 'error');
        }
      }
    } catch (e) {
      console.error('Failed fetching tenant cloud data on login:', e);
      const localData = loadAppData(loginResult.company.id);
      if (localData) {
        setAppData(localData);
      }
    }

    if (loginResult.user.role === 'owner') {
      setCurrentPage('owner_panel');
    } else {
      setCurrentPage('home');
    }
  };

  // 🚪 Logout Handler
  const handleLogout = async () => {
    try {
      await logoutFromCloud();
    } catch (e) {
      console.warn('Logout error:', e);
    }
    setSession(null);
    setCurrentPage('home');
    showToast('تم تسجيل الخروج بنجاح من المنظومة', 'info');
  };

  // 🔑 License Activation Submission
  const handleActivateLicenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseCodeInput.trim()) {
      showToast('يرجى إدخال كود التفعيل', 'warning');
      return;
    }

    setIsActivatingLicense(true);
    try {
      const res = await activateTenantLicenseCloud(licenseCodeInput.trim());
      if (res.success) {
        showToast(res.message, 'success');
        setIsLicenseModalOpen(false);
        setLicenseCodeInput('');
        const freshSession = await fetchCurrentSession();
        if (freshSession.valid) {
          setSession(freshSession);
        }
      } else {
        showToast(res.message || 'كود التفعيل غير صالح', 'error');
      }
    } catch {
      showToast('فشل تفعيل الترخيص', 'error');
    } finally {
      setIsActivatingLicense(false);
    }
  };

  // 🌐 Real-time Synchronization across tabs/windows for incoming web orders + Auto Print
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'accounting_system_v8' && e.newValue) {
        try {
          const freshData: AppData = JSON.parse(e.newValue);
          setAppData((prevData) => {
            const prevIds = new Set((prevData.quotations || []).map((q) => q.id));
            const newWebOrders = (freshData.quotations || []).filter(
              (q) =>
                q.source === 'online_catalog' &&
                !prevIds.has(q.id) &&
                q.autoPrinted !== true
            );

            if (newWebOrders.length > 0) {
              const latestOrder = newWebOrders[0];
              // Audio alert
              if (freshData.catalogConfig?.soundAlertEnabled !== false) {
                playOrderAlertChime();
              }
              // Toast notification
              showToast(
                `🔔 وصل طلب شراء جديد أونلاين #${latestOrder.orderReference || latestOrder.id} من: ${latestOrder.clientName}!`,
                'success'
              );
              // Automatic printing on Rakeeza station if autoPrintOrders is enabled
              if (freshData.catalogConfig?.autoPrintOrders) {
                printWebOrderReceipt(
                  latestOrder,
                  freshData,
                  freshData.catalogConfig.printFormat || '80mm',
                  true
                );
              }
            }
            return freshData;
          });
        } catch (syncErr) {
          console.error('Storage sync error:', syncErr);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // 🤖 Automated Scheduled Background Backup Engine (Auto-Backup Scheduler)
  useEffect(() => {
    const backupIntervalTimer = setInterval(() => {
      const currentData = appDataRef.current;
      const config = currentData.autoBackupConfig;
      if (!config || !config.enabled) return;

      if (shouldTriggerAutoBackup(config)) {
        // Generate automatic system snapshot (ultra-lean)
        const newSnapshot = createSystemSnapshot(currentData, '🤖 نسخة احتياطية مجدولة آلياً', 'auto');
        const maxKeep = Math.min(config.maxSnapshotsToKeep || 5, 5);
        const newBackups = [newSnapshot, ...(currentData.backups || [])].slice(0, maxKeep);

        const updatedData: AppData = {
          ...currentData,
          backups: newBackups,
          autoBackupConfig: {
            ...config,
            lastBackupTimestamp: new Date().toISOString(),
          },
        };

        // If user configured auto file download
        if (config.autoDownloadFile) {
          downloadBackupJsonFile(currentData);
        }

        saveAppData(updatedData);
        setAppData(updatedData);

        if (config.notifyOnBackup) {
          showToast('🛡️ تم حفظ نسخة احتياطية تلقائية من بيانات النظام في المتصفح', 'info');
        }
      }
    }, 60000); // Stable check once every minute

    return () => clearInterval(backupIntervalTimer);
  }, []);

  const handleNavigate = (page: string, pushHistory = true) => {
    if (page === currentPage) return;
    if (pushHistory) {
      window.history.pushState({ page }, '', `#${page}`);
    }
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (window.innerWidth <= 768) {
      setIsSidebarOpen(false);
    }
  };

  // Mobile Phone Back Button & Navigation History Handler (Hardware back button & gestures)
  useEffect(() => {
    // Initialize initial state if empty
    const currentHash = window.location.hash.replace('#', '') || currentPage || 'home';
    window.history.replaceState({ page: currentHash }, '', `#${currentHash}`);

    const handlePopState = (event: PopStateEvent) => {
      // 1. If mobile sidebar is open, phone back button closes the sidebar first
      if (isSidebarOpen) {
        setIsSidebarOpen(false);
        window.history.pushState({ page: currentPage }, '', `#${currentPage}`);
        return;
      }

      // 2. If any modal is open, close it
      if (isInspectModalOpen) {
        setIsInspectModalOpen(false);
        return;
      }
      if (isShareCatalogOpen) {
        setIsShareCatalogOpen(false);
        return;
      }

      // 3. Navigate back to previous page in app
      const targetPage = event.state?.page || window.location.hash.replace('#', '') || 'home';
      setCurrentPage(targetPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isSidebarOpen, isInspectModalOpen, isShareCatalogOpen, currentPage]);

  // Keyboard Shortcuts (Ctrl+1: Sales, Ctrl+2: Purchases, Ctrl+3: POS, Ctrl+4: Items, Ctrl+5: Accounts, Ctrl+0: Home)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '1') {
          e.preventDefault();
          handleNavigate('sales');
          showToast('اختصار: تم الانتقال إلى المبيعات', 'info');
        } else if (e.key === '2') {
          e.preventDefault();
          handleNavigate('purchases');
          showToast('اختصار: تم الانتقال إلى المشتريات', 'info');
        } else if (e.key === '3') {
          e.preventDefault();
          handleNavigate('pos');
          showToast('اختصار: تم الانتقال إلى نقطة البيع السريعة POS', 'info');
        } else if (e.key === '4') {
          e.preventDefault();
          handleNavigate('items');
          showToast('اختصار: تم الانتقال إلى الأصناف والمخزون', 'info');
        } else if (e.key === '5') {
          e.preventDefault();
          handleNavigate('accounts');
          showToast('اختصار: تم الانتقال إلى الحسابات', 'info');
        } else if (e.key === '0') {
          e.preventDefault();
          handleNavigate('home');
          showToast('اختصار: تم الانتقال إلى الرئيسية', 'info');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // URL Parameter Detection for Direct Customer Catalog Access (?mode=catalog or #catalog)
  useEffect(() => {
    const checkCatalogRoute = () => {
      const params = new URLSearchParams(window.location.search);
      if (
        params.get('mode') === 'catalog' ||
        params.get('view') === 'catalog' ||
        window.location.hash === '#catalog'
      ) {
        setCurrentPage('catalog');
      }
    };
    checkCatalogRoute();
    window.addEventListener('popstate', checkCatalogRoute);
    return () => window.removeEventListener('popstate', checkCatalogRoute);
  }, []);

  const currentUser =
    session?.user ||
    appData.users.find((u) => u.id === appData.currentUser) ||
    appData.users[0];
  const isOwner =
    session?.user?.role === 'owner' ||
    currentUser?.role === 'owner' ||
    appData.isOwnerAuthenticated;
  const userCompanyId =
    session?.company?.id || currentUser?.companyId || appData.companyId || 'COMP-000001';

  const pendingWebOrdersCount = (appData.quotations || []).filter((q) => {
    const isWebOrder =
      (q.source === 'online_catalog' || q.status === 'online_order' || (q.orderReference && q.orderReference.startsWith('ORD-'))) &&
      (q.orderStatus === 'new' || q.status === 'online_order' || !q.isRead);
    if (!isWebOrder) return false;
    if (isOwner) return true;
    return q.companyId === userCompanyId || (!q.companyId && userCompanyId === 'COMP-000001');
  }).length;

  const getPageTitle = (pageId: string) => {
    const titles: Record<string, string> = {
      home: '🏠 لوحة القيادة والتحكم الرئيسية',
      pos: '⚡ نقطة البيع السريعة والكاشير (POS)',
      sales: '💰 إدارة المبيعات والفواتير',
      price_management: '🏷️ إدارة وتسعير المنتجات المركزية (Price Management)',
      quotes_orders: '📑 عروض الأسعار والطلبيات (Quotations & Pipeline)',
      web_orders: '📥 طلبات الويب سايت والكتالوج الإلكتروني (Incoming Web Orders)',
      catalog_manager: '🛍️ إدارة منتجات وأسعار الكتالوج الإلكتروني (Catalog Products & Pricing)',
      catalog: '🛍️ كتالوج المنتجات والمتجر الإلكتروني للعملاء (B2B / B2C Catalog)',
      purchases: '🛒 إدارة المشتريات والتوريدات',
      cash: '💵 سندات القبض والصرف',
      accounts: '📋 حسابات العملاء والموردين',
      accounts_tree: '🌳 دليل الحسابات الشجري ومراكز التكلفة',
      items: '📦 إدارة الأصناف والمخزون',
      item_movement: '📦 سجل حركة الأصناف',
      inventory: '📦 تقييم المخزون الإجمالي',
      physical_inventory: '📦 الجرد الفعلي للمخازن',
      inventory_settlement: '📦 مطابقة وتسوية الجرد',
      branches: '🏢 إدارة الفروع والتحويلات المخزنية',
      e_invoicing: '🏛️ الفاتورة والمنظومة الضريبية (E-Invoicing & VAT)',
      bi_analytics: '📊 ذكاء الأعمال والتحليلات التنبؤية (BI Intelligence)',
      daily_operations: '📊 العمليات اليومية',
      daily_entries: '📊 دفتر القيود اليومية المحاسبية المزدوجة',
      trial_balance: '📊 ميزان المراجعة بالمجاميع والأرصدة',
      income_statement: '📊 قائمة الدخل والأرباح والخسائر (P&L)',
      balance_sheet: '📊 الميزانية العمومية والمركز المالي',
      monthly_profit_report: '💰 تقرير الأرباح الشهرية وتكلفة المبيعات (COGS & Growth)',
      year_end_closing: '🏛️ الإقفال السنوي وترحيل الحسابات الختامية (Fiscal Year Closing)',
      treasury: '🏦 الخزينة والأرصدة النقدية',
      cheques: '💳 إدارة الشيكات وأوراق القبض والدفع',
      sales_reps: '🎯 المندوبين والعمولات والائتمان',
      hr_payroll: '👥 الموارد البشرية ومسير الرواتب (HR & Payroll)',
      fixed_assets: '🏢 الأصول الثابتة وحساب الإهلاكات',
      manufacturing: '⚙️ التصنيع ومعادلات التكوين (BOM & Work Orders)',
      bank_reconciliation: '🏦 التسوية البنكية ودورة الاعتمادات',
      audit_trail: '🛡️ سجل التدقيق الرقابي والأمان (Audit Trail)',
      settings: '⚙️ إعدادات المؤسسة والنظام',
      users: '👥 مستخدمي النظام والصلاحيات',
      backup: '💾 النسخ الاحتياطي والاستعادة',
      owner_panel: '👑 لوحة مالك النظام السحابي وإدارة الاشتراكات والشركات (Owner Multi-Tenant SaaS)',
      reports_group: '📊 التقارير الشاملة',
    };

    if (pageId.startsWith('reports_')) {
      const parts = pageId.split('_');
      if (parts.length >= 3) {
        const repName = parts.slice(2).join(' ').replace(/_/g, ' ');
        return `📊 تقارير - ${repName}`;
      }
      return titles[pageId] || '📊 التقارير الشاملة';
    }

    return titles[pageId] || pageId;
  };

  const renderContent = () => {
    switch (currentPage) {
      case 'home':
        return <HomeView appData={appData} onNavigate={handleNavigate} currentUser={currentUser} />;
      case 'pos':
        return <PosView appData={appData} onUpdateData={updateData} showToast={showToast} />;
      case 'sales':
        return <SalesView appData={appData} onUpdateData={updateData} showToast={showToast} onInspectItem={handleInspectItem} />;
      case 'price_management':
        return <PriceManagementView appData={appData} onUpdateData={updateData} showToast={showToast} />;
      case 'quotes_orders':
        return (
          <QuotesOrdersView
            appData={appData}
            onUpdateData={updateData}
            showToast={showToast}
            onInspectItem={handleInspectItem}
            onShareCatalog={() => setIsShareCatalogOpen(true)}
          />
        );
      case 'web_orders':
        return (
          <WebOrdersInboxView
            appData={appData}
            onUpdateData={updateData}
            showToast={showToast}
            onNavigateToSales={() => handleNavigate('sales')}
            onInspectItem={handleInspectItem}
            userCompanyId={userCompanyId}
            isOwner={isOwner}
          />
        );
      case 'catalog_manager':
        return (
          <CatalogManagerView
            appData={appData}
            onUpdateData={updateData}
            showToast={showToast}
            onPreviewStore={(companyId) => {
              const param = companyId ? `&company=${companyId}` : '';
              window.open(`${window.location.origin}${window.location.pathname}?mode=catalog${param}`, '_blank');
            }}
            onShareCatalog={() => setIsShareCatalogOpen(true)}
          />
        );
      case 'catalog':
        return (
          <CustomerCatalogView
            appData={appData}
            onUpdateData={updateData}
            showToast={showToast}
            onExitToAdmin={() => handleNavigate('home')}
            onShareCatalog={() => setIsShareCatalogOpen(true)}
            merchantCompanyId={userCompanyId || session?.company?.id || appData.companyId}
            isPublicCustomerView={false}
          />
        );
      case 'purchases':
        return <PurchasesView appData={appData} onUpdateData={updateData} showToast={showToast} onInspectItem={handleInspectItem} />;
      case 'cash':
        return <CashView appData={appData} onUpdateData={updateData} showToast={showToast} onInspectItem={handleInspectItem} />;
      case 'accounts':
        return <AccountsView appData={appData} onUpdateData={updateData} showToast={showToast} />;
      case 'accounts_tree':
        return <AccountsTreeView appData={appData} onUpdateData={updateData} showToast={showToast} />;
      case 'branches':
        return <BranchesView appData={appData} onUpdateData={updateData} showToast={showToast} />;
      case 'e_invoicing':
        return <EInvoicingView appData={appData} onUpdateData={updateData} showToast={showToast} />;
      case 'crm_pipeline':
        return (
          <CrmPipelineView
            appData={appData}
            onUpdateData={updateData}
            showToast={showToast}
            onNavigateToSales={() => handleNavigate('sales')}
          />
        );
      case 'serial_warranty':
        return (
          <SerialWarrantyTrackingView
            appData={appData}
            onUpdateData={updateData}
            showToast={showToast}
          />
        );
      case 'cash_flow_closing':
        return (
          <CashFlowClosingView
            appData={appData}
            onUpdateData={updateData}
            showToast={showToast}
          />
        );
      case 'bi_analytics':
        return <BiAnalyticsView appData={appData} onNavigate={handleNavigate} />;
      case 'audit_trail':
        return <AuditTrailView appData={appData} onUpdateData={updateData} showToast={showToast} />;
      case 'items':
      case 'item_movement':
      case 'inventory':
      case 'physical_inventory':
      case 'inventory_settlement':
        return (
          <ItemsView
            appData={appData}
            subPage={currentPage}
            onUpdateData={updateData}
            showToast={showToast}
            onShareCatalog={() => setIsShareCatalogOpen(true)}
            onOpenCatalog={() => handleNavigate('catalog')}
          />
        );
      case 'daily_operations':
      case 'daily_entries':
      case 'trial_balance':
      case 'income_statement':
      case 'balance_sheet':
        return <OperationsView appData={appData} subPage={currentPage} onUpdateData={updateData} showToast={showToast} />;
      case 'monthly_profit_report':
        return <MonthlyProfitReportView appData={appData} onNavigate={handleNavigate} />;
      case 'year_end_closing':
        return <YearEndClosingView appData={appData} onUpdateData={updateData} showToast={showToast} />;
      case 'treasury':
        return <TreasuryView appData={appData} onUpdateData={updateData} showToast={showToast} />;
      case 'cheques':
        return <ChequesView appData={appData} onUpdateData={updateData} showToast={showToast} onInspectItem={handleInspectItem} />;
      case 'sales_reps':
        return <SalesRepsCommissionsView appData={appData} onUpdateData={updateData} showToast={showToast} onInspectItem={handleInspectItem} />;
      case 'hr_payroll':
        return <HrPayrollView appData={appData} onUpdateData={updateData} showToast={showToast} onInspectItem={handleInspectItem} />;
      case 'fixed_assets':
        return <FixedAssetsView appData={appData} onUpdateData={updateData} showToast={showToast} onInspectItem={handleInspectItem} />;
      case 'manufacturing':
        return <ManufacturingView appData={appData} onUpdateData={updateData} showToast={showToast} onInspectItem={handleInspectItem} />;
      case 'bank_reconciliation':
        return <BankReconciliationView appData={appData} onUpdateData={updateData} showToast={showToast} onInspectItem={handleInspectItem} />;
      case 'settings':
        return (
          <SettingsView
            appData={appData}
            onUpdateData={updateData}
            showToast={showToast}
            onShareCatalog={() => setIsShareCatalogOpen(true)}
          />
        );
      case 'users':
        return <UsersView appData={appData} onUpdateData={updateData} showToast={showToast} />;
      case 'backup':
        return <BackupView appData={appData} onUpdateData={updateData} showToast={showToast} />;
      case 'owner_panel':
        return (
          <OwnerPanelView
            appData={appData}
            onUpdateAppData={(partial) => {
              const updated = { ...appData, ...partial };
              updateData(updated);
            }}
            onEnterCompany={async (company, asSupport, supportReason) => {
              try {
                if (session) {
                  setSession({
                    ...session,
                    company: company,
                  });
                }
                const cloudRes = await fetchTenantDataCloud(company.id, session?.user?.uid);
                if (cloudRes.success && cloudRes.data) {
                  setAppData(cloudRes.data);
                  saveAppData(cloudRes.data, company.id);
                } else {
                  const localData = loadAppData(company.id);
                  if (localData) {
                    setAppData(localData);
                  }
                }
                showToast(`تم الدخول بنجاح إلى شركة: ${company.name} ${asSupport ? '(وضع الدعم الفني)' : ''}`, 'success');
                handleNavigate('home');
              } catch (e) {
                console.error('Failed to enter company:', e);
                showToast('حدث خطأ أثناء تحميل بيانات الشركة', 'error');
              }
            }}
            onClose={() => handleNavigate('home')}
            onLogout={handleLogout}
          />
        );
      default:
        if (currentPage.startsWith('reports')) {
          return (
            <ReportsView
              appData={appData}
              pageId={currentPage}
              onNavigate={handleNavigate}
              onUpdateData={updateData}
              showToast={showToast}
            />
          );
        }
        const activeUser = appData.users?.find((u) => u.username === appData.currentUser || String(u.code) === String(appData.currentUser) || u.id === appData.currentUser) || appData.users?.[0];
        return <HomeView appData={appData} onNavigate={handleNavigate} currentUser={activeUser} />;
    }
  };

  // Standalone Customer Storefront Route (?mode=catalog or user browsing catalog)
  if (currentPage === 'catalog') {
    const isPublic = !session?.valid;
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 font-sans max-w-full overflow-x-hidden" dir="rtl">
        <CustomerCatalogView
          appData={appData}
          onUpdateData={updateData}
          showToast={showToast}
          onExitToAdmin={session?.valid ? () => handleNavigate('home') : undefined}
          onShareCatalog={() => setIsShareCatalogOpen(true)}
          merchantCompanyId={session?.valid ? userCompanyId : undefined}
          isPublicCustomerView={isPublic}
        />
        <ShareCatalogModal
          isOpen={isShareCatalogOpen}
          onClose={() => setIsShareCatalogOpen(false)}
          appData={appData}
          onUpdateData={updateData}
          showToast={showToast}
          currentCompanyId={userCompanyId}
          onOpenCatalogDirectly={() => {
            setIsShareCatalogOpen(false);
            handleNavigate('catalog');
          }}
        />
        <Toast message={toastMessage} type={toastType} />
      </div>
    );
  }

  // Cloud Auth Loading State
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4 font-sans" dir="rtl">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-amber-400 p-0.5 shadow-xl flex items-center justify-center mb-4 animate-pulse">
          <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
            <span className="text-3xl font-black text-amber-400">R</span>
          </div>
        </div>
        <div className="w-7 h-7 border-3 border-blue-400/30 border-t-blue-400 rounded-full animate-spin mb-3" />
        <h3 className="text-lg font-bold text-white tracking-wide">RAKEEZA Cloud ERP</h3>
        <p className="text-xs text-slate-400 mt-1">جاري التحقق من الجلسة السحابية وعزل بيانات الشركة...</p>
      </div>
    );
  }

  // Not Logged In Gate: Display Login Page
  if (!session?.valid && currentPage !== 'catalog' && currentPage !== 'owner_panel') {
    return (
      <>
        <LoginView
          onLoginSuccess={handleLoginSuccess}
          onOpenOwnerPanelDirectly={async () => {
            try {
              const res = await verifyOwnerSecretApi('29190615');
              if (res.success && res.user && res.company) {
                handleLoginSuccess({
                  user: res.user,
                  company: res.company,
                  subscription: res.subscription,
                });
                return;
              }
            } catch {}
            setCurrentPage('owner_panel');
          }}
        />
        <Toast message={toastMessage} type={toastType} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5] text-slate-800 flex flex-col font-sans max-w-full overflow-x-hidden" dir="rtl">
      {/* Header */}
      <Header
        currentUser={currentUser}
        companyName={session?.company?.name || appData.settings?.companyName}
        companyCode={session?.company?.code || userCompanyId}
        subscriptionPlan={session?.subscription?.planName || session?.company?.planName}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        onLogout={handleLogout}
        autoBackupActive={appData.autoBackupConfig?.enabled ?? true}
        onNavigateBackup={() => handleNavigate('backup')}
        onNavigateOwner={() => handleNavigate('owner_panel')}
        onShareCatalog={() => setIsShareCatalogOpen(true)}
        onOpenCatalog={() => handleNavigate('catalog')}
        pendingWebOrdersCount={pendingWebOrdersCount}
        onNavigateWebOrders={() => handleNavigate('web_orders')}
        appData={appData}
        onUpdateData={updateData}
        showToast={showToast}
        onNavigateReports={(year) => handleNavigate('reports')}
      />

      {/* 👑 Owner Browsing Company Banner */}
      {isOwner && session?.company?.id && session.company.id !== 'OWNER' && (
        <div className="bg-slate-900 border-b border-amber-500/40 text-white px-3 sm:px-5 py-2 z-40 shadow-md flex items-center justify-between gap-3 text-xs sm:text-sm no-print" dir="rtl">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-bold">👑 وضع مالك المنظومة:</span>
            <span className="text-slate-200">
              تتصفح حالياً شركة <strong className="text-white font-bold">{session.company.name}</strong> [كود: <span className="font-mono text-amber-300 font-bold">{session.company.code || session.company.id}</span>]
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleNavigate('owner_panel')}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1 rounded-md text-xs transition cursor-pointer flex items-center gap-1.5 shrink-0 shadow-sm"
          >
            <span>👑</span>
            <span>العودة للوحة المالك</span>
          </button>
        </div>
      )}

      {/* 🔒 Closed Fiscal Year Banner with Return Switcher */}
      {appData.viewingClosedYear && (
        <div className="fixed top-[60px] right-0 left-0 bg-gradient-to-r from-amber-700 via-amber-600 to-amber-700 text-white px-3 sm:px-5 py-2 z-40 shadow-md flex items-center justify-between gap-3 text-xs sm:text-sm border-b border-amber-400/40 animate-fade-in no-print" dir="rtl">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-black/20 flex items-center justify-center text-base shrink-0">
              🔒
            </div>
            <div>
              <span className="font-black text-amber-100">
                أنت تتصفح حالياً السنة المالية المغلقة ({appData.viewingClosedYear})
              </span>
              <span className="hidden md:inline text-amber-200 text-xs mr-2">
                (للمراجعة والطباعة والعرض فقط - محظور أي تعديل أو حذف لحماية الدفاتر)
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const currentYear = appData.currentActiveFiscalYear || appData.settings?.fiscalYear || 'الحالية';
              const updated = {
                ...appData,
                viewingClosedYear: undefined,
              };
              updateData(updated, {
                action: 'تبديل سنة مالية',
                module: 'الإقفال السنوي',
                details: `العودة إلى السنة المالية الحالية ${currentYear}`,
              });
              showToast(`تمت العودة بنجاح إلى السنة المالية الحالية (${currentYear})`, 'success');
            }}
            className="bg-white text-amber-950 hover:bg-amber-100 active:bg-amber-200 px-3 sm:px-4 py-1.5 rounded-xl font-black text-xs transition flex items-center gap-1.5 cursor-pointer shrink-0 shadow-sm"
          >
            <span>العودة للسنة الحالية ({appData.currentActiveFiscalYear || appData.settings?.fiscalYear})</span>
            <span>↩</span>
          </button>
        </div>
      )}

      {/* Sidebar Backdrop Overlay on Mobile */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="md:hidden fixed inset-0 bg-black/50 z-35 backdrop-blur-xs transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        activePage={currentPage}
        onNavigate={handleNavigate}
        pendingWebOrdersCount={pendingWebOrdersCount}
        onClose={() => setIsSidebarOpen(false)}
        onLogout={handleLogout}
        currentUser={currentUser}
        companyName={session?.company?.name || appData.settings?.companyName}
      />

      {/* Main Content Area */}
      <main
        className={`${
          appData.viewingClosedYear ? 'mt-[105px]' : 'mt-[60px]'
        } p-2.5 sm:p-4 md:p-6 pb-24 md:pb-6 transition-all duration-300 flex-1 min-w-0 max-w-full overflow-x-hidden ${
          isSidebarOpen ? 'md:mr-[290px]' : 'mr-0'
        }`}
      >
        <div className="w-full max-w-[1720px] mx-auto min-w-0">
          {/* Subscription Status Banner if expired or warning */}
          {session?.subscription?.isExpired && (
            <div className="mb-4 p-3.5 bg-amber-500/15 border-2 border-amber-500/40 rounded-2xl text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-fade-in">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-800">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                </div>
                <div className="text-xs sm:text-sm">
                  <p className="font-extrabold text-amber-950">
                    تنبيه: انتهت صلاحية اشتراك المنظومة لشركة ({session?.company?.name || 'الشركة'})
                  </p>
                  <p className="text-amber-800 text-xs">
                    بياناتك ومستنداتك محفوظة بأمان تام في السحابة. لتجديد الترخيص ومتابعة العمل، يرجى إدخال كود التفعيل المعتمد.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsLicenseModalOpen(true)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs transition-all shadow-sm cursor-pointer whitespace-nowrap"
              >
                🔑 إدخال كود الترخيص
              </button>
            </div>
          )}

          {/* Page Top Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-5 pb-3 border-b-2 border-slate-200 gap-3">
            <div className="w-full sm:w-auto">
              <h2 className="text-base sm:text-lg md:text-xl font-black text-[#1a237e] flex items-center gap-2 flex-wrap">
                {getPageTitle(currentPage)}
              </h2>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
              {currentPage !== 'home' && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.history.length > 1) {
                      window.history.back();
                    } else {
                      handleNavigate('home');
                    }
                  }}
                  className="min-h-[40px] bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-800 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs flex-1 sm:flex-initial"
                  title="الرجوع إلى الصفحة السابقة (أو استخدم زر الرجوع بهاتفك)"
                >
                  <span>↩️</span>
                  <span>رجوع</span>
                </button>
              )}
              {currentPage !== 'pos' && (
                <button
                  onClick={() => handleNavigate('pos')}
                  className="min-h-[40px] bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 font-black px-3.5 py-2 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1 shadow-xs flex-1 sm:flex-initial"
                >
                  ⚡ POS سريع
                </button>
              )}
              {currentPage !== 'home' && (
                <button
                  onClick={() => handleNavigate('home')}
                  className="min-h-[40px] bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-800 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1 flex-1 sm:flex-initial"
                >
                  🏠 الرئيسية
                </button>
              )}
            </div>
          </div>

          {/* Dynamic Page View */}
          {renderContent()}
        </div>
      </main>

      {/* Mobile Sticky Quick Navigation Bar with Hardware & Screen Back Support */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-t border-slate-200 z-30 flex items-center justify-around px-1 shadow-lg no-print mobile-bottom-nav"
        aria-label="التنقل السريع للهاتف"
      >
        {currentPage !== 'home' ? (
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) {
                window.history.back();
              } else {
                handleNavigate('home');
              }
            }}
            className="flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 text-indigo-700 hover:text-indigo-900 active:scale-95 transition"
            title="الرجوع للصفحة السابقة"
          >
            <span className="text-lg">↩️</span>
            <span className="text-[10px] mt-0.5 font-bold">رجوع</span>
          </button>
        ) : (
          <button
            onClick={() => handleNavigate('home')}
            className="flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 text-[#1a237e] font-black"
          >
            <span className="text-lg">🏠</span>
            <span className="text-[10px] mt-0.5">الرئيسية</span>
          </button>
        )}

        <button
          onClick={() => handleNavigate('pos')}
          className={`flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 transition ${
            currentPage === 'pos' ? 'text-[#1a237e] font-black' : 'text-amber-600 hover:text-amber-700'
          }`}
        >
          <span className="text-lg">⚡</span>
          <span className="text-[10px] mt-0.5 font-bold">الكاشير</span>
        </button>

        <button
          onClick={() => handleNavigate('sales')}
          className={`flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 transition ${
            currentPage === 'sales' ? 'text-[#1a237e] font-black' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="text-lg">💰</span>
          <span className="text-[10px] mt-0.5">المبيعات</span>
        </button>

        <button
          onClick={() => handleNavigate('purchases')}
          className={`flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 transition ${
            currentPage === 'purchases' ? 'text-[#1a237e] font-black' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="text-lg">🛒</span>
          <span className="text-[10px] mt-0.5">المشتريات</span>
        </button>

        <button
          onClick={() => setIsSidebarOpen((prev) => !prev)}
          className="flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 text-slate-500 hover:text-slate-800 transition"
        >
          <span className="text-lg">☰</span>
          <span className="text-[10px] mt-0.5">القائمة</span>
        </button>
      </nav>

      {/* System Footer & Developer Copyright */}
      <footer
        className={`no-print py-3.5 px-4 sm:px-6 bg-white border-t border-slate-200 text-xs text-slate-600 transition-all duration-300 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs mb-16 md:mb-0 ${
          isSidebarOpen ? 'md:mr-[290px]' : 'mr-0'
        }`}
      >
        <div className="flex items-center gap-2 text-center sm:text-right">
          <span className="font-bold text-[#1a237e] text-sm">منظومة ركيزة | RAKEEZA ERP</span>
          <span className="text-slate-300">|</span>
          <span>جميع الحقوق محفوظة © {new Date().getFullYear()}</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 font-semibold text-slate-700 bg-slate-100 px-3.5 py-1.5 rounded-full border border-slate-200 text-center">
          <span>👨‍💻 تطوير: <strong className="text-[#0d47a1]">Mohamed Nazih</strong></span>
          <span className="text-slate-300">|</span>
          <span>📱 للتواصل: <strong className="text-emerald-700 font-mono text-sm" dir="ltr">01029190615</strong></span>
        </div>
      </footer>

      {/* Toast Notification */}
      <Toast message={toastMessage} type={toastType} />

      {/* Share Catalog Modal */}
      <ShareCatalogModal
        isOpen={isShareCatalogOpen}
        onClose={() => setIsShareCatalogOpen(false)}
        appData={appData}
        onUpdateData={updateData}
        showToast={showToast}
        currentCompanyId={userCompanyId}
        onOpenCatalogDirectly={() => {
          setIsShareCatalogOpen(false);
          handleNavigate('catalog');
        }}
      />

      {/* Global Transaction Inspector Modal */}
      {isInspectModalOpen && inspectModalItem && (
        <TransactionInspectorModal
          isOpen={isInspectModalOpen}
          item={inspectModalItem}
          appData={appData}
          onClose={() => {
            setIsInspectModalOpen(false);
            setInspectModalItem(null);
          }}
          onUpdateData={updateData}
          showToast={showToast}
        />
      )}

      {/* Subscription License Activation Modal */}
      {isLicenseModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-fade-in"
          dir="rtl"
          onClick={() => setIsLicenseModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl relative border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    تفعيل كود ترخيص واشتراك المنظومة
                  </h3>
                  <p className="text-xs text-slate-500">
                    شركة: {session?.company?.name || 'الشركة'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsLicenseModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleActivateLicenseSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  أدخل كود الترخيص السحابي (Activation Code):
                </label>
                <input
                  type="text"
                  autoFocus
                  value={licenseCodeInput}
                  onChange={(e) => setLicenseCodeInput(e.target.value.toUpperCase())}
                  placeholder="مثال: RKZ-2026-PRO-ANNUAL-001"
                  dir="ltr"
                  className="w-full bg-slate-50 border border-slate-300 focus:border-amber-500 rounded-xl px-4 py-2.5 text-center text-sm font-mono tracking-widest text-slate-900 outline-none uppercase"
                  disabled={isActivatingLicense}
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  يمكنك الحصول على كود الترخيص من إدارة مبيعات ركيزة
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isActivatingLicense}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold py-2.5 px-4 rounded-xl text-xs sm:text-sm transition shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-50"
                >
                  {isActivatingLicense ? 'جاري التحقق والتفعيل...' : 'تفعيل وتجديد الاشتراك'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsLicenseModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 px-4 rounded-xl text-xs sm:text-sm transition cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
