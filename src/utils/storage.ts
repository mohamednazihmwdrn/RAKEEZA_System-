import { AppData, AccountNode } from '../types';
import { ensureProductPricesSynced } from './priceService';
import { DEFAULT_COMPANIES } from './multiTenantService';

export const STORAGE_KEY = 'accounting_system_v8';

export const defaultAccountsTree: AccountNode[] = [
  // 1 - الأصول
  { code: '1', name: 'الأصول (Assets)', type: 'asset', isParent: true, debit: 0, credit: 0, balance: 0 },
  { code: '11', name: 'الأصول المتداولة (Current Assets)', type: 'asset', parentCode: '1', isParent: true, debit: 0, credit: 0, balance: 0 },
  { code: '1101', name: 'الصندوق والخزينة الرئيسية (Cash)', type: 'asset', parentCode: '11', isParent: false, debit: 0, credit: 0, balance: 0 },
  { code: '1102', name: 'فودافون كاش والمحافظ الإلكترونية', type: 'asset', parentCode: '11', isParent: false, debit: 0, credit: 0, balance: 0 },
  { code: '1103', name: 'إنستاباي (InstaPay)', type: 'asset', parentCode: '11', isParent: false, debit: 0, credit: 0, balance: 0 },
  { code: '1104', name: 'الحسابات البنكية (Bank Accounts)', type: 'asset', parentCode: '11', isParent: false, debit: 0, credit: 0, balance: 0 },
  { code: '1105', name: 'العملاء والمدينون (Accounts Receivable)', type: 'asset', parentCode: '11', isParent: false, debit: 0, credit: 0, balance: 0 },
  { code: '1106', name: 'مخزون البضاعة (Merchandise Inventory)', type: 'asset', parentCode: '11', isParent: false, debit: 0, credit: 0, balance: 0 },
  { code: '12', name: 'الأصول الثابتة (Fixed Assets)', type: 'asset', parentCode: '1', isParent: true, debit: 0, credit: 0, balance: 0 },
  { code: '1201', name: 'الأثاث والمعدات المكتبية', type: 'asset', parentCode: '12', isParent: false, debit: 0, credit: 0, balance: 0 },
  { code: '1202', name: 'أجهزة الكمبيوتر والتكنولوجيا', type: 'asset', parentCode: '12', isParent: false, debit: 0, credit: 0, balance: 0 },

  // 2 - الخصوم
  { code: '2', name: 'الخصوم والالتزامات (Liabilities)', type: 'liability', isParent: true, debit: 0, credit: 0, balance: 0 },
  { code: '21', name: 'الخصوم المتداولة (Current Liabilities)', type: 'liability', parentCode: '2', isParent: true, debit: 0, credit: 0, balance: 0 },
  { code: '2101', name: 'الموردون والدائنون (Accounts Payable)', type: 'liability', parentCode: '21', isParent: false, debit: 0, credit: 0, balance: 0 },
  { code: '2102', name: 'أمانات ضريبة القيمة المضافة (VAT Payable)', type: 'liability', parentCode: '21', isParent: false, debit: 0, credit: 0, balance: 0 },
  { code: '2103', name: 'ضريبة الخصم والتحصيل من المنبع', type: 'liability', parentCode: '21', isParent: false, debit: 0, credit: 0, balance: 0 },
  { code: '2104', name: 'مصروفات مستحقة الدفع', type: 'liability', parentCode: '21', isParent: false, debit: 0, credit: 0, balance: 0 },

  // 3 - حقوق الملكية
  { code: '3', name: 'حقوق الملكية (Owner\'s Equity)', type: 'equity', isParent: true, debit: 0, credit: 0, balance: 0 },
  { code: '3101', name: 'رأس المال المستثمر (Capital)', type: 'equity', parentCode: '3', isParent: false, debit: 0, credit: 0, balance: 0 },
  { code: '3102', name: 'الأرباح والخسائر المرحلة (Retained Earnings)', type: 'equity', parentCode: '3', isParent: false, debit: 0, credit: 0, balance: 0 },
  { code: '3103', name: 'جاري صاحب المنشأة / الشركاء', type: 'equity', parentCode: '3', isParent: false, debit: 0, credit: 0, balance: 0 },

  // 4 - الإيرادات
  { code: '4', name: 'الإيرادات والمبيعات (Revenues)', type: 'revenue', isParent: true, debit: 0, credit: 0, balance: 0 },
  { code: '4101', name: 'إيراد مبيعات بضاعة تجارية (Sales Revenue)', type: 'revenue', parentCode: '4', isParent: false, debit: 0, credit: 0, balance: 0 },
  { code: '4102', name: 'مردودات ومسموحات المبيعات (Sales Returns)', type: 'revenue', parentCode: '4', isParent: false, debit: 0, credit: 0, balance: 0 },
  { code: '4103', name: 'إيرادات خدمات وشحن وصيانة', type: 'revenue', parentCode: '4', isParent: false, debit: 0, credit: 0, balance: 0 },
  { code: '4104', name: 'خصم مسموح به (Sales Discounts)', type: 'revenue', parentCode: '4', isParent: false, debit: 0, credit: 0, balance: 0 },
  { code: '4201', name: 'أرباح وفروقات تسوية المخزون (Inventory Adjustment Gain)', type: 'revenue', parentCode: '4', isParent: false, debit: 0, credit: 0, balance: 0 },

  // 5 - المصروفات
  { code: '5', name: 'المصروفات وتكلفة البضاعة (Expenses & COGS)', type: 'expense', isParent: true, debit: 0, credit: 0, balance: 0 },
  { code: '5101', name: 'تكلفة البضاعة المباعة (Cost of Goods Sold - COGS)', type: 'expense', parentCode: '5', isParent: false, debit: 0, credit: 0, balance: 0 },
  { code: '5201', name: 'مصروفات الإيجار والمرافق', type: 'expense', parentCode: '5', isParent: false, debit: 0, credit: 0, balance: 0 },
  { code: '5202', name: 'الرواتب والأجور والمكافآت', type: 'expense', parentCode: '5', isParent: false, debit: 0, credit: 0, balance: 0 },
  { code: '5203', name: 'مصاريف الدعاية والتسويق', type: 'expense', parentCode: '5', isParent: false, debit: 0, credit: 0, balance: 0 },
  { code: '5204', name: 'مصاريف الصيانة والتشغيل والنثريات', type: 'expense', parentCode: '5', isParent: false, debit: 0, credit: 0, balance: 0 },
  { code: '5205', name: 'عمولات المندوبين والمبيعات', type: 'expense', parentCode: '5', isParent: false, debit: 0, credit: 0, balance: 0 },
  { code: '5206', name: 'عجز وفاقد تسوية المخزون (Inventory Shrinkage & Loss)', type: 'expense', parentCode: '5', isParent: false, debit: 0, credit: 0, balance: 0 },
];

export function getDefaultData(companyId?: string): AppData {
  const targetCompanyId = companyId || 'COMP-000001';
  return {
    companyId: targetCompanyId,
    settings: {
      companyName: 'منظومة RAKEEZA للمحاسبة',
      address: 'القاهرة، مصر',
      phone1: '01029190615',
      phone2: '01100000000',
      phone3: '01200000000',
      taxNumber: '',
      commercialReg: 'CR-98765',
      activityCode: '4651 - تجارة أجهزة وإلكترونيات',
      notes: 'شكراً لتعاملكم مع منظومة RAKEEZA للمحاسبة',
      defaultTaxRate: 0,
      withholdingTaxRate: 0,
      currencySymbol: 'ج.م',
      fiscalYear: '2026',
    },
    users: [
      {
        id: 'user1',
        code: 1,
        name: 'Mohamed Nazih (المدير العام)',
        username: 'admin',
        password: '123',
        role: 'admin',
        permissions: { all: true },
      },
      {
        id: 'user4',
        code: 4,
        name: 'محمود سعيد (المحاسب المالي)',
        username: 'accountant',
        password: '123',
        role: 'accountant',
      },
      {
        id: 'user5',
        code: 5,
        name: 'خالد عبد الرحمن (مسؤول المبيعات)',
        username: 'sales',
        password: '123',
        role: 'sales_rep',
      },
      {
        id: 'user3',
        code: 3,
        name: 'سامح إبراهيم (مسؤول المخازن)',
        username: 'warehouse',
        password: '123',
        role: 'warehouse_keeper',
      },
      {
        id: 'user2',
        code: 2,
        name: 'أحمد محمود (كاشير الفرع الرئيسي)',
        username: 'cashier',
        password: '123',
        role: 'cashier',
        permissions: { sales: true, pos: true, quotes: true },
      },
    ],
    currentUser: 'user1',
    customers: [],
    suppliers: [],
    items: [],
    salesInvoices: [],
    purchaseInvoices: [],
    cashTransactions: [],
    backups: [],
    nextInvoiceNumber: 1,
    nextPurchaseNumber: 1,
    nextCashId: 1,
    cashBox: { drawer: 0, vodafone: 0, instapay: 0, bank: 0 },
    salesReps: [],
    bankAccounts: [
      { id: 'b1', name: 'البنك الأهلي المصري', accountNumber: '', balance: 0 },
      { id: 'b2', name: 'بنك مصر', accountNumber: '', balance: 0 },
    ],
    physicalInventories: [],
    inventoryAdjustments: [],
    goodsIssueVouchers: [],
    fiscalClosings: [],
    nextStocktakeId: 2,
    nextAdjustmentId: 1,
    nextGoodsIssueId: 89,
    nextClosingId: 1,
    advancedSettings: {
      categories: ['أجهزة كمبيوتر', 'طابعات ومعدات', 'شاشات', 'إكسسوارات', 'شبكات وكاميرات'],
      itemGroups: ['إلكترونيات', 'مكتبية', 'أجهزة ذكية'],
      units: ['جهاز', 'قطعة', 'طقم', 'علبة', 'كرتونة', 'متر'],
    },

    // Enterprise Modules Initial Data:
    accounts: defaultAccountsTree,
    journalEntries: [],
    nextJournalId: 1,
    costCenters: [
      { id: 'cc-1', code: 'CC-01', name: 'المركز العام الرئيسي', manager: 'المدير المالي' },
      { id: 'cc-2', code: 'CC-02', name: 'مشروع مبيعات التوزيع', manager: 'مدير المبيعات' },
      { id: 'cc-3', code: 'CC-03', name: 'فرع الجيزة والمعارض', manager: 'مدير الفرع' },
    ],
    branches: [
      { id: 'br-main', code: 'HQ-01', name: 'الفرع الرئيسي والمخزن المركزي', location: 'القاهرة - المقر الرئيسي', phone: '01029190615', isMain: true, manager: 'Mohamed Nazih' },
      { id: 'br-branch2', code: 'BR-02', name: 'فرع الجيزة والمعرض', location: 'الجيزة - شارع التحرير', phone: '01100000000', isMain: false, manager: 'أحمد محمود' },
    ],
    activeBranchId: 'br-main',
    stockTransfers: [],
    quotations: [],
    nextQuoteId: 1,
    auditLogs: [
      {
        id: 'log-init',
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        userName: 'Mohamed Nazih (المدير)',
        action: 'login',
        module: 'النظام العام',
        details: 'تم تشغيل وتهيئة منظومة ركيزة RAKEEZA ERP الاحترافية بجميع وحدات المحاسبة والربط الضريبي بنجاح.',
      },
    ],
    eInvoiceConfig: {
      taxRegNumber: '123-456-789',
      commercialRegNumber: 'CR-98765',
      branchCode: '0',
      activityCode: '4651',
      posSerial: 'NAZIH-POS-001',
      isEtaConnected: true,
      autoGenerateQr: true,
    },

    // 1. HR & Payroll Initial Data
    employees: [],
    payrollSlips: [],
    nextPayrollId: 1,
    employeeAdvances: [],

    // 2. Fixed Assets & Depreciation
    fixedAssets: [],
    depreciationLogs: [],

    // 3. Cheques & Notes
    cheques: [],
    nextChequeId: 1,
    commissions: [],

    // 4. Manufacturing & BOM
    boms: [],
    productionOrders: [],
    nextProductionId: 1,

    // 5. Bank Statements & Reconciliation
    bankStatements: [],

    // 6. Approval Requests
    approvalRequests: [],

    // 7. Auto Backup & Protection
    autoBackupConfig: {
      enabled: true,
      intervalMinutes: 60, // Every 1 hour
      autoDownloadFile: false,
      maxSnapshotsToKeep: 15,
      lastBackupTimestamp: new Date().toISOString(),
      backupLocation: 'browser_storage',
      notifyOnBackup: true,
    },

    // 8. Multi-Tenant Enterprise Architecture
    companies: DEFAULT_COMPANIES,
    companyCatalogConfigs: {
      'COMP-000001': {
        enabled: true,
        storeName: 'شركة ركيزة للمحاسبة والتجارة RAKEEZA',
        storeDescription: 'الكتالوج الإلكتروني لأجهزة الكمبيوتر والشاشات والشبكات مع الطلب الفوري',
        contactPhone: '01029190615',
        whatsappNumber: '01029190615',
        allowOnlineOrders: true,
        priceDisplayMode: 'both',
        showStockStatus: true,
        showExactStockQty: false,
        bannerMessage: '🚚 شحن وتوصيل فوري لجميع المحافظات مع ضمان الاستبدال',
        minOrderAmount: 200,
        currencySymbol: 'ج.م',
        autoPrintOrders: true,
        printFormat: '80mm',
        soundAlertEnabled: true,
        companyId: 'COMP-000001',
      },
      'COMP-000002': {
        enabled: true,
        storeName: 'مؤسسة الأمل للتوريدات ومستلزمات الكاشير',
        storeDescription: 'المتجر الإلكتروني لتوريدات الورق الحراري وطابعات الفواتير والأجهزة المكتبية',
        contactPhone: '01011223344',
        whatsappNumber: '01011223344',
        allowOnlineOrders: true,
        priceDisplayMode: 'both',
        showStockStatus: true,
        showExactStockQty: false,
        bannerMessage: '📦 أسعار خاصة وخصومات للكميات والجملة لكراتين بكر الكاشير وورق التصوير',
        minOrderAmount: 150,
        currencySymbol: 'ج.م',
        autoPrintOrders: true,
        printFormat: '80mm',
        soundAlertEnabled: true,
        companyId: 'COMP-000002',
      },
    },
    deletedRecords: {},
  };
}

export function loadAppData(companyId?: string): AppData {
  try {
    let raw: string | null = null;
    const cleanCompId = companyId?.trim().toUpperCase();

    if (cleanCompId) {
      raw = localStorage.getItem(`rakeeza_tenant_data_${cleanCompId}`);
      // Fallback check on standard legacy key only if matching company
      if (!raw) {
        const legacyRaw = localStorage.getItem(STORAGE_KEY);
        if (legacyRaw) {
          try {
            const parsedLegacy = JSON.parse(legacyRaw);
            const legacyCompId = (parsedLegacy.companyId || parsedLegacy.settings?.companyId || '').trim().toUpperCase();
            if (legacyCompId === cleanCompId) {
              raw = legacyRaw;
            }
          } catch {}
        }
      }
    } else {
      raw = localStorage.getItem(STORAGE_KEY);
    }
    const defaults = getDefaultData(cleanCompId);
    const storedLogo = localStorage.getItem('company_logo_base64');
    if (raw) {
      const parsed = JSON.parse(raw);
      // Strict Cross-Company Guard: Discard if company ID mismatch!
      const parsedCompId = (parsed.companyId || parsed.settings?.companyId || '').trim().toUpperCase();
      if (cleanCompId && parsedCompId && parsedCompId !== cleanCompId) {
        console.warn(`[RAKEEZA Guard] Prevented cross-tenant data leak. Requested: ${cleanCompId}, found: ${parsedCompId}`);
        return defaults;
      }
      const mergedSettings = { ...defaults.settings, ...(parsed.settings || {}) };
      if (storedLogo && !mergedSettings.logo && !mergedSettings.logoUrl) {
        mergedSettings.logo = storedLogo;
        mergedSettings.logoUrl = storedLogo;
      }
      // Migrate system/company name if it contains the old name
      if (
        mergedSettings.companyName === 'النزيه للمحاسبة' ||
        mergedSettings.companyName === 'النزيه' ||
        mergedSettings.companyName === 'شركة النزيه التجارية' ||
        mergedSettings.companyName === 'شركة النزيه للمحاسبة والتجارة'
      ) {
        mergedSettings.companyName = 'منظومة RAKEEZA للمحاسبة';
      }
      if (mergedSettings.notes && mergedSettings.notes.includes('نظام النزيه')) {
        mergedSettings.notes = mergedSettings.notes.replace(/نظام النزيه/g, 'منظومة RAKEEZA');
      }
      // Migrate and ensure all enterprise properties exist seamlessly
      const loaded: AppData = {
        ...defaults,
        ...parsed,
        settings: mergedSettings,
        accounts: parsed.accounts && parsed.accounts.length > 0 ? parsed.accounts : defaults.accounts,
        journalEntries: parsed.journalEntries || defaults.journalEntries,
        costCenters: parsed.costCenters || defaults.costCenters,
        branches: parsed.branches || defaults.branches,
        activeBranchId: parsed.activeBranchId || defaults.activeBranchId,
        stockTransfers: parsed.stockTransfers || defaults.stockTransfers,
        quotations: parsed.quotations || defaults.quotations,
        auditLogs: parsed.auditLogs || defaults.auditLogs,
        eInvoiceConfig: { ...defaults.eInvoiceConfig, ...(parsed.eInvoiceConfig || {}) },
        nextJournalId: parsed.nextJournalId || 1,
        nextQuoteId: parsed.nextQuoteId || 1,

        // Comprehensive modules migration
        employees: parsed.employees && parsed.employees.length > 0 ? parsed.employees : defaults.employees,
        payrollSlips: parsed.payrollSlips || defaults.payrollSlips,
        nextPayrollId: parsed.nextPayrollId || defaults.nextPayrollId,
        employeeAdvances: parsed.employeeAdvances || defaults.employeeAdvances,
        fixedAssets: parsed.fixedAssets && parsed.fixedAssets.length > 0 ? parsed.fixedAssets : defaults.fixedAssets,
        depreciationLogs: parsed.depreciationLogs || defaults.depreciationLogs,
        cheques: parsed.cheques && parsed.cheques.length > 0 ? parsed.cheques : defaults.cheques,
        nextChequeId: parsed.nextChequeId || defaults.nextChequeId,
        commissions: parsed.commissions || defaults.commissions,
        boms: parsed.boms && parsed.boms.length > 0 ? parsed.boms : defaults.boms,
        productionOrders: parsed.productionOrders || defaults.productionOrders,
        nextProductionId: parsed.nextProductionId || defaults.nextProductionId,
        bankStatements: parsed.bankStatements && parsed.bankStatements.length > 0 ? parsed.bankStatements : defaults.bankStatements,
        approvalRequests: parsed.approvalRequests || defaults.approvalRequests,
        physicalInventories: parsed.physicalInventories && parsed.physicalInventories.length > 0 ? parsed.physicalInventories : defaults.physicalInventories,
        inventoryAdjustments: parsed.inventoryAdjustments || defaults.inventoryAdjustments,
        goodsIssueVouchers: parsed.goodsIssueVouchers && parsed.goodsIssueVouchers.length > 0 ? parsed.goodsIssueVouchers : defaults.goodsIssueVouchers || [],
        fiscalClosings: parsed.fiscalClosings || defaults.fiscalClosings || [],
        nextStocktakeId: parsed.nextStocktakeId || defaults.nextStocktakeId || 2,
        nextAdjustmentId: parsed.nextAdjustmentId || defaults.nextAdjustmentId || 1,
        nextGoodsIssueId: parsed.nextGoodsIssueId || defaults.nextGoodsIssueId || 89,
        nextClosingId: parsed.nextClosingId || defaults.nextClosingId || 1,
        autoBackupConfig: { ...defaults.autoBackupConfig, ...(parsed.autoBackupConfig || {}) },
        backups: parsed.backups || defaults.backups || [],
        productPrices: parsed.productPrices || defaults.productPrices || [],
        priceHistories: parsed.priceHistories || defaults.priceHistories || [],

        // Multi-Tenant Isolation
        companies: parsed.companies && parsed.companies.length > 0 ? parsed.companies : defaults.companies,
        companyId: parsed.companyId || defaults.companyId || 'COMP-000001',
        companyCatalogConfigs: {
          ...(defaults.companyCatalogConfigs || {}),
          ...(parsed.companyCatalogConfigs || {}),
        },
      };

      // Seamlessly migrate legacy company 1 names to RAKEEZA
      if (loaded.companies) {
        loaded.companies = loaded.companies.map((c) => {
          if (c.id === 'COMP-000001' && (c.name.includes('النزيه') || c.tradeName?.includes('النزيه'))) {
            return {
              ...c,
              name: 'شركة ركيزة للمحاسبة والتجارة العامة (RAKEEZA)',
              tradeName: 'ركيزة للأنظمة والحلول التقنية RAKEEZA',
              email: 'admin@rakeeza.com',
            };
          }
          return c;
        });
      }
      if (loaded.companyCatalogConfigs?.['COMP-000001']?.storeName?.includes('النزيه')) {
        loaded.companyCatalogConfigs['COMP-000001'].storeName = 'شركة ركيزة للمحاسبة والتجارة RAKEEZA';
      }

      // Ensure all standard test roles (accountant, sales, warehouse) exist in users list
      if (loaded.users && Array.isArray(loaded.users)) {
        for (const defaultUser of defaults.users) {
          const exists = loaded.users.some(
            (u) => u.username?.toLowerCase() === defaultUser.username?.toLowerCase() || (defaultUser.role !== 'admin' && u.role === defaultUser.role)
          );
          if (!exists) {
            loaded.users.push(defaultUser);
          }
        }
      } else {
        loaded.users = defaults.users;
      }

      // Ensure all items have a companyId, and seed company 2 items if not present
      if (loaded.items && loaded.items.length > 0) {
        const hasCompany2 = loaded.items.some((it) => it.companyId === 'COMP-000002');
        loaded.items = loaded.items.map((it) => ({
          ...it,
          companyId: it.companyId || 'COMP-000001',
        }));
        if (!hasCompany2) {
          const company2Items = defaults.items.filter((it) => it.companyId === 'COMP-000002');
          loaded.items.push(...company2Items);
        }
      }

      return ensureProductPricesSynced(loaded);
    }
  } catch (e) {
    console.error('Failed to load data:', e);
  }
  return ensureProductPricesSynced(getDefaultData());
}

export function saveAppData(data: AppData, companyId?: string): void {
  const targetCompId = (companyId || data.companyId || 'COMP-000001').trim().toUpperCase();
  data.companyId = targetCompId;
  try {
    localStorage.setItem(`rakeeza_tenant_data_${targetCompId}`, JSON.stringify(data));
    // Also update current active storage key
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e: any) {
    console.warn('Storage quota warning, performing defensive cache pruning:', e);
    try {
      // 1. Prune heavy backups and remove redundant base64 strings
      const trimmedBackups = (data.backups || []).slice(0, 3).map((b) => ({
        ...b,
        code: '', // remove redundant base64
      }));
      // 2. Trim audit logs to latest 100
      const trimmedAudit = (data.auditLogs || []).slice(0, 100);
      const prunedData: AppData = {
        ...data,
        companyId: targetCompId,
        backups: trimmedBackups,
        auditLogs: trimmedAudit,
      };
      localStorage.setItem(`rakeeza_tenant_data_${targetCompId}`, JSON.stringify(prunedData));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prunedData));
    } catch (e2) {
      try {
        // Fallback: save without backups to guarantee core ERP state is always persisted
        const strippedData = { ...data, companyId: targetCompId, backups: [], auditLogs: (data.auditLogs || []).slice(0, 50) };
        localStorage.setItem(`rakeeza_tenant_data_${targetCompId}`, JSON.stringify(strippedData));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(strippedData));
      } catch (e3) {
        console.error('Critical localStorage save failure:', e3);
      }
    }
  }
}

/**
 * 🛡️ Detects whether an action represents an intentional record deletion
 */
export function isDeleteAction(action?: string, details?: string): boolean {
  if (!action && !details) return false;
  const combined = `${action || ''} ${details || ''}`.toLowerCase();
  return (
    combined.includes('delete') ||
    combined.includes('حذف') ||
    combined.includes('remove') ||
    combined.includes('destroy') ||
    combined.includes('إلغاء')
  );
}

/**
 * 🔍 Maps an action or details string to its target AppData collection name
 */
export function getTargetCollectionForAction(action?: string, details?: string): string | null {
  const combined = `${action || ''} ${details || ''}`.toLowerCase();
  if (combined.includes('purchase') || combined.includes('مشتريات') || combined.includes('شراء')) {
    return 'purchaseInvoices';
  }
  if (combined.includes('invoice') || combined.includes('فاتورة مبيعات') || combined.includes('مبيعات')) {
    return 'salesInvoices';
  }
  if (combined.includes('customer') || combined.includes('عميل') || combined.includes('العملاء')) {
    return 'customers';
  }
  if (combined.includes('supplier') || combined.includes('مورد') || combined.includes('الموردين')) {
    return 'suppliers';
  }
  if (combined.includes('cash') || combined.includes('نقد') || combined.includes('سند') || combined.includes('خزينة') || combined.includes('قبض') || combined.includes('صرف')) {
    return 'cashTransactions';
  }
  if (combined.includes('item') || combined.includes('صنف') || combined.includes('أصناف') || combined.includes('منتج')) {
    return 'items';
  }
  if (combined.includes('user') || combined.includes('مستخدم')) {
    return 'users';
  }
  if (combined.includes('branch') || combined.includes('فرع')) {
    return 'branches';
  }
  if (combined.includes('quotation') || combined.includes('عرض أسعار')) {
    return 'quotations';
  }
  if (combined.includes('cheque') || combined.includes('شيك')) {
    return 'cheques';
  }
  return null;
}

/**
 * 🛡️ Monotonic Record Merge with Tombstones:
 * Ensures that newly created or existing records in `prevList` are NEVER wiped out by an
 * empty or partial `incomingList` array, unless an explicit deletion was intended.
 * Deletions tracked by tombstones (`deletedRecords`) are pruned definitively everywhere.
 * If both arrays contain a record with the same ID, incoming (latest) is preferred.
 */
/**
 * 🔑 Extract deduplication / idempotency key for any business entity
 */
function getItemDeduplicationKey(item: any, collectionKey?: string): string | null {
  if (!item || typeof item !== 'object') return null;
  // 1. Explicit idempotency / client sync key
  if (item.clientSyncId) return `sync_${String(item.clientSyncId).trim()}`;
  if (item.syncId) return `sync_${String(item.syncId).trim()}`;
  if (item.idempotencyKey) return `sync_${String(item.idempotencyKey).trim()}`;
  if (item.uuid) return `uuid_${String(item.uuid).trim()}`;

  // 2. Collection-specific semantic deduplication
  if (collectionKey === 'customers') {
    const cleanPhone = String(item.phone || '').trim().replace(/[^0-9]/g, '');
    const cleanName = String(item.name || '').trim().toLowerCase();
    if (cleanPhone && cleanName) return `cust_${cleanName}_${cleanPhone}`;
  } else if (collectionKey === 'suppliers') {
    const cleanPhone = String(item.phone || '').trim().replace(/[^0-9]/g, '');
    const cleanName = String(item.name || '').trim().toLowerCase();
    if (cleanPhone && cleanName) return `supp_${cleanName}_${cleanPhone}`;
  } else if (collectionKey === 'items') {
    if (item.barcode && String(item.barcode).trim()) {
      return `item_barcode_${String(item.barcode).trim()}`;
    }
    if (item.code && String(item.code).trim()) {
      return `item_code_${String(item.code).trim().toLowerCase()}`;
    }
    if (item.name && String(item.name).trim()) {
      return `item_name_${String(item.name).trim().toLowerCase()}`;
    }
  } else if (collectionKey === 'cashTransactions') {
    if (item.invoiceId && item.amount && item.type) {
      return `cash_inv_${item.invoiceId}_${item.type}_${item.amount}_${item.method || ''}`;
    }
    if (item.date && item.type && item.amount && (item.customerName || item.supplierName || item.note)) {
      return `cash_tx_${item.date}_${item.type}_${item.amount}_${String(item.customerName || item.supplierName || '').trim()}_${String(item.note || '').trim()}`;
    }
  } else if (collectionKey === 'salesInvoices' || collectionKey === 'purchaseInvoices') {
    const party = String(item.customerName || item.supplierName || '').trim().toLowerCase();
    const date = String(item.date || '').trim();
    const total = Number(item.total || 0).toFixed(2);
    const count = Array.isArray(item.items) ? item.items.length : 0;
    if (party && date && total) {
      return `inv_sig_${date}_${party}_${total}_${count}`;
    }
  }
  return null;
}

/**
 * 🛡️ Monotonic Record Merge with Tombstones & Duplication Protection:
 * - Offline synchronization never creates duplicate invoices, customers, payments, products, or records.
 * - Stable IDs / Idempotency keys are checked first.
 * - Retried operations update existing records instead of cloning.
 * - Offline ID collisions between devices (e.g. both used counter 5) are safely re-numbered to prevent data loss.
 */
export function mergeCollectionRecords<T = any>(
  prevList: T[] = [],
  incomingList: T[] = [],
  isExplicitDeletion: boolean = false,
  collectionKey?: string,
  deletedRecords?: Record<string, number>
): T[] {
  const isDeleted = (item: any): boolean => {
    if (!item || typeof item !== 'object' || !collectionKey || !deletedRecords) return false;
    const idKey = item.id !== undefined && item.id !== null ? String(item.id).trim() : null;
    const codeKey = item.code !== undefined && item.code !== null ? String(item.code).trim() : null;
    const syncKey = item.clientSyncId || item.syncId || item.idempotencyKey;
    if (idKey && deletedRecords[`${collectionKey}_${idKey}`]) return true;
    if (codeKey && deletedRecords[`${collectionKey}_${codeKey}`]) return true;
    if (syncKey && deletedRecords[`${collectionKey}_${syncKey}`]) return true;
    return false;
  };

  // If explicit deletion was requested specifically for this collection:
  if (isExplicitDeletion) {
    const baseList = Array.isArray(incomingList) ? incomingList : (Array.isArray(prevList) ? prevList : []);
    return baseList.filter((item) => !isDeleted(item));
  }

  // If incomingList is empty, retain prevList except tombstoned items
  if (!Array.isArray(incomingList) || incomingList.length === 0) {
    const baseList = Array.isArray(prevList) ? prevList : [];
    return baseList.filter((item) => !isDeleted(item));
  }

  // Index existing records by normalized ID, sync/idempotency key, and semantic key
  const recordsMap = new Map<string, T>();
  const syncKeyToId = new Map<string, string>();
  let maxNumericId = 0;

  const registerItem = (item: any, forceId?: string) => {
    if (!item || typeof item !== 'object' || isDeleted(item)) return;
    const key = forceId || (item.id !== undefined && item.id !== null ? String(item.id).trim() : (item.code ? String(item.code).trim() : null));
    if (!key) return;

    const num = Number(key);
    if (!isNaN(num) && num > maxNumericId) {
      maxNumericId = num;
    }

    recordsMap.set(key, item);

    const dedupKey = getItemDeduplicationKey(item, collectionKey);
    if (dedupKey) {
      syncKeyToId.set(dedupKey, key);
    }
  };

  if (Array.isArray(prevList)) {
    for (const item of prevList) {
      registerItem(item);
    }
  }

  // Process incoming items with idempotency and deduplication
  for (const item of incomingList) {
    if (!item || typeof item !== 'object' || isDeleted(item)) continue;

    const dedupKey = getItemDeduplicationKey(item, collectionKey);
    const existingIdByDedup = dedupKey ? syncKeyToId.get(dedupKey) : null;

    if (existingIdByDedup && recordsMap.has(existingIdByDedup)) {
      // 🔄 Idempotency Match: Retry or re-sync of existing item -> Merge in place!
      const existing = recordsMap.get(existingIdByDedup)!;
      recordsMap.set(existingIdByDedup, { ...existing, ...item, id: (existing as any).id });
      continue;
    }

    const itemAny = item as any;
    const rawId = itemAny.id !== undefined && itemAny.id !== null ? String(itemAny.id).trim() : (itemAny.code ? String(itemAny.code).trim() : null);

    if (rawId && recordsMap.has(rawId)) {
      const existing = recordsMap.get(rawId)!;
      const existingAny = existing as any;
      // Check if existing and incoming are genuinely the same record (same syncId or matching content)
      const sameSyncId = (itemAny.clientSyncId && itemAny.clientSyncId === existingAny.clientSyncId) ||
                         (itemAny.syncId && itemAny.syncId === existingAny.syncId);
      const isInvoice = collectionKey === 'salesInvoices' || collectionKey === 'purchaseInvoices';
      const isSameInvoice = isInvoice && (
        sameSyncId ||
        (String(existingAny.date) === String(itemAny.date) &&
         String(existingAny.customerName || existingAny.supplierName) === String(itemAny.customerName || itemAny.supplierName) &&
         Math.abs(Number(existingAny.total || 0) - Number(itemAny.total || 0)) < 0.01)
      );

      if (sameSyncId || isSameInvoice || !isInvoice) {
        // Genuine update or idempotent retry -> update in place
        recordsMap.set(rawId, { ...existing, ...item });
      } else {
        // ⚠️ Collision Detection: Two offline devices created different records with the same counter ID!
        // Re-assign incoming record to next safe unique ID so neither is overwritten or lost!
        maxNumericId += 1;
        const safeNewId = typeof itemAny.id === 'number' ? maxNumericId : String(maxNumericId);
        const resolvedItem = { ...item, id: safeNewId };
        registerItem(resolvedItem, String(safeNewId));
      }
    } else if (rawId) {
      registerItem(item, rawId);
    } else {
      // Record without explicit ID
      maxNumericId += 1;
      const safeNewId = String(maxNumericId);
      registerItem({ ...item, id: safeNewId }, safeNewId);
    }
  }

  return Array.from(recordsMap.values());
}

/**
 * 🛡️ Merge full AppData payload preserving all business collections
 * Guarantees cross-tenant boundary isolation and prevents records from disappearing.
 */
export function mergeAppDataMonotonically(
  prev: AppData,
  incoming: Partial<AppData>,
  isExplicitDeletion: boolean | string | string[] = false,
  actionInfo?: { action?: string; module?: string; details?: string; deletedId?: string | number }
): AppData {
  if (!incoming || typeof incoming !== 'object') return prev;

  // 🛡️ Cross-Company Guard: Never merge data across different company IDs!
  const prevCompId = (prev.companyId || '').trim().toUpperCase();
  const incomingCompId = (incoming.companyId || '').trim().toUpperCase();
  if (prevCompId && incomingCompId && prevCompId !== incomingCompId) {
    const freshDefaults = getDefaultData(incomingCompId);
    return mergeAppDataMonotonically(freshDefaults, incoming, isExplicitDeletion, actionInfo);
  }

  // Merge tombstones monotonically
  const mergedDeletedRecords: Record<string, number> = {
    ...(prev.deletedRecords || {}),
    ...(incoming.deletedRecords || {}),
  };

  // Determine whether deletion applies globally or to a specific collection
  let isGlobalDelete = isExplicitDeletion === true;
  let targetCollection: string | null = null;

  if (typeof isExplicitDeletion === 'string' && isExplicitDeletion !== 'true') {
    targetCollection = isExplicitDeletion;
  } else if (actionInfo && isDeleteAction(actionInfo.action, actionInfo.details)) {
    targetCollection = getTargetCollectionForAction(actionInfo.action, actionInfo.details);
    if (!targetCollection) {
      isGlobalDelete = true;
    }
  }

  // If action specified a deletedId and collection, record in tombstones
  if (targetCollection && actionInfo?.deletedId !== undefined) {
    mergedDeletedRecords[`${targetCollection}_${actionInfo.deletedId}`] = Date.now();
  }

  const isCollectionDelete = (colKey: string): boolean => {
    if (isGlobalDelete) return true;
    if (targetCollection && targetCollection === colKey) return true;
    if (Array.isArray(isExplicitDeletion) && isExplicitDeletion.includes(colKey)) return true;
    return false;
  };

  return {
    ...prev,
    ...incoming,
    companyId: incoming.companyId || prev.companyId,
    settings: { ...prev.settings, ...(incoming.settings || {}) },
    advancedSettings: incoming.advancedSettings || prev.advancedSettings,
    deletedRecords: mergedDeletedRecords,
    branches: mergeCollectionRecords(prev.branches, incoming.branches, isCollectionDelete('branches'), 'branches', mergedDeletedRecords),
    costCenters: mergeCollectionRecords(prev.costCenters, incoming.costCenters, isCollectionDelete('costCenters'), 'costCenters', mergedDeletedRecords),
    accounts: mergeCollectionRecords(prev.accounts, incoming.accounts, isCollectionDelete('accounts'), 'accounts', mergedDeletedRecords),
    users: mergeCollectionRecords(prev.users, incoming.users, isCollectionDelete('users'), 'users', mergedDeletedRecords),
    customers: mergeCollectionRecords(prev.customers, incoming.customers, isCollectionDelete('customers'), 'customers', mergedDeletedRecords),
    suppliers: mergeCollectionRecords(prev.suppliers, incoming.suppliers, isCollectionDelete('suppliers'), 'suppliers', mergedDeletedRecords),
    items: mergeCollectionRecords(prev.items, incoming.items, isCollectionDelete('items'), 'items', mergedDeletedRecords),
    salesInvoices: mergeCollectionRecords(prev.salesInvoices, incoming.salesInvoices, isCollectionDelete('salesInvoices'), 'salesInvoices', mergedDeletedRecords),
    purchaseInvoices: mergeCollectionRecords(prev.purchaseInvoices, incoming.purchaseInvoices, isCollectionDelete('purchaseInvoices'), 'purchaseInvoices', mergedDeletedRecords),
    cashTransactions: mergeCollectionRecords(prev.cashTransactions, incoming.cashTransactions, isCollectionDelete('cashTransactions'), 'cashTransactions', mergedDeletedRecords),
    journalEntries: mergeCollectionRecords(prev.journalEntries, incoming.journalEntries, isCollectionDelete('journalEntries'), 'journalEntries', mergedDeletedRecords),
    cheques: mergeCollectionRecords(prev.cheques, incoming.cheques, isCollectionDelete('cheques'), 'cheques', mergedDeletedRecords),
    quotations: mergeCollectionRecords(prev.quotations, incoming.quotations, isCollectionDelete('quotations'), 'quotations', mergedDeletedRecords),
    auditLogs: mergeCollectionRecords(prev.auditLogs, incoming.auditLogs, isCollectionDelete('auditLogs'), 'auditLogs', mergedDeletedRecords),
    bankAccounts: mergeCollectionRecords(prev.bankAccounts, incoming.bankAccounts, isCollectionDelete('bankAccounts'), 'bankAccounts', mergedDeletedRecords),
    employees: mergeCollectionRecords(prev.employees, incoming.employees, isCollectionDelete('employees'), 'employees', mergedDeletedRecords),
    fixedAssets: mergeCollectionRecords(prev.fixedAssets, incoming.fixedAssets, isCollectionDelete('fixedAssets'), 'fixedAssets', mergedDeletedRecords),
    boms: mergeCollectionRecords(prev.boms, incoming.boms, isCollectionDelete('boms'), 'boms', mergedDeletedRecords),
    salesReps: mergeCollectionRecords(prev.salesReps, incoming.salesReps, isCollectionDelete('salesReps'), 'salesReps', mergedDeletedRecords),
    physicalInventories: mergeCollectionRecords(prev.physicalInventories, incoming.physicalInventories, isCollectionDelete('physicalInventories'), 'physicalInventories', mergedDeletedRecords),
    inventoryAdjustments: mergeCollectionRecords(prev.inventoryAdjustments, incoming.inventoryAdjustments, isCollectionDelete('inventoryAdjustments'), 'inventoryAdjustments', mergedDeletedRecords),
    goodsIssueVouchers: mergeCollectionRecords(prev.goodsIssueVouchers, incoming.goodsIssueVouchers, isCollectionDelete('goodsIssueVouchers'), 'goodsIssueVouchers', mergedDeletedRecords),
    productionOrders: mergeCollectionRecords(prev.productionOrders, incoming.productionOrders, isCollectionDelete('productionOrders'), 'productionOrders', mergedDeletedRecords),
    approvalRequests: mergeCollectionRecords(prev.approvalRequests, incoming.approvalRequests, isCollectionDelete('approvalRequests'), 'approvalRequests', mergedDeletedRecords),
    commissions: mergeCollectionRecords(prev.commissions, incoming.commissions, isCollectionDelete('commissions'), 'commissions', mergedDeletedRecords),
    fiscalClosings: mergeCollectionRecords(prev.fiscalClosings, incoming.fiscalClosings, isCollectionDelete('fiscalClosings'), 'fiscalClosings', mergedDeletedRecords),
    viewingClosedYear: prev.viewingClosedYear !== undefined ? prev.viewingClosedYear : incoming.viewingClosedYear,
    cashBox: incoming.cashBox ? { ...prev.cashBox, ...incoming.cashBox } : prev.cashBox,
    catalogConfig: incoming.catalogConfig || prev.catalogConfig,
    productPrices: Array.isArray(incoming.productPrices) && incoming.productPrices.length > 0
      ? incoming.productPrices
      : prev.productPrices,
    nextInvoiceNumber: typeof incoming.nextInvoiceNumber === 'number'
      ? Math.max(incoming.nextInvoiceNumber, prev.nextInvoiceNumber || 1)
      : prev.nextInvoiceNumber,
    nextPurchaseNumber: typeof incoming.nextPurchaseNumber === 'number'
      ? Math.max(incoming.nextPurchaseNumber, prev.nextPurchaseNumber || 1)
      : prev.nextPurchaseNumber,
  };
}

// Helper to append audit logs easily across the app
export function addAuditLog(
  data: AppData,
  action: 'create' | 'update' | 'delete' | 'print' | 'approval' | 'login' | 'transfer',
  module: string,
  details: string
): AppData {
  const currentUserObj = data.users.find((u) => u.id === data.currentUser) || data.users[0];
  const userName = currentUserObj?.name || 'مدير النظام';

  const newLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    userName,
    action,
    module,
    details,
  };

  return {
    ...data,
    auditLogs: [newLog, ...(data.auditLogs || [])].slice(0, 500), // keep latest 500
  };
}
