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

export function getDefaultData(): AppData {
  return {
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
        name: 'Mohamed Nazih (المدير)',
        username: 'admin',
        password: 'admin123',
        role: 'admin',
        permissions: { all: true },
      },
      {
        id: 'user2',
        code: 2,
        name: 'كاشير الفرع الرئيسي',
        username: 'cashier',
        password: '123',
        role: 'user',
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
    companyId: 'COMP-000001',
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
  };
}

export function loadAppData(companyId?: string): AppData {
  try {
    let raw: string | null = null;
    if (companyId) {
      raw = localStorage.getItem(`rakeeza_tenant_data_${companyId}`);
    }
    if (!raw) {
      raw = localStorage.getItem(STORAGE_KEY);
    }
    const defaults = getDefaultData();
    const storedLogo = localStorage.getItem('company_logo_base64');
    if (raw) {
      const parsed = JSON.parse(raw);
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
  const targetCompId = companyId || data.companyId || 'COMP-000001';
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    if (targetCompId) {
      localStorage.setItem(`rakeeza_tenant_data_${targetCompId}`, JSON.stringify(data));
    }
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
        backups: trimmedBackups,
        auditLogs: trimmedAudit,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prunedData));
      if (targetCompId) {
        localStorage.setItem(`rakeeza_tenant_data_${targetCompId}`, JSON.stringify(prunedData));
      }
    } catch (e2) {
      try {
        // Fallback: save without backups to guarantee core ERP state is always persisted
        const strippedData = { ...data, backups: [], auditLogs: (data.auditLogs || []).slice(0, 50) };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(strippedData));
        if (targetCompId) {
          localStorage.setItem(`rakeeza_tenant_data_${targetCompId}`, JSON.stringify(strippedData));
        }
      } catch (e3) {
        console.error('Critical localStorage save failure:', e3);
      }
    }
  }
}

/**
 * 🛡️ Monotonic Record Merge:
 * Ensures that newly created or existing records in `prevList` are NEVER wiped out by an
 * empty or partial `incomingList` array, unless an explicit deletion was intended.
 * If both arrays contain a record with the same ID, incoming (latest) is preferred.
 * Any ID in `prevList` that is not in `incomingList` is safely retained!
 */
export function mergeCollectionRecords<T = any>(
  prevList: T[] = [],
  incomingList: T[] = [],
  isExplicitDeletion: boolean = false
): T[] {
  if (isExplicitDeletion) {
    return Array.isArray(incomingList) ? incomingList : (Array.isArray(prevList) ? prevList : []);
  }
  if (!Array.isArray(incomingList) || incomingList.length === 0) {
    return Array.isArray(prevList) ? prevList : [];
  }
  if (!Array.isArray(prevList) || prevList.length === 0) {
    return incomingList;
  }

  const map = new Map<string | number, T>();
  for (const item of prevList) {
    if (item && typeof item === 'object') {
      const key = (item as any).id !== undefined && (item as any).id !== null ? (item as any).id : (item as any).code;
      if (key !== undefined && key !== null) {
        map.set(key, item);
      }
    }
  }
  for (const item of incomingList) {
    if (item && typeof item === 'object') {
      const key = (item as any).id !== undefined && (item as any).id !== null ? (item as any).id : (item as any).code;
      if (key !== undefined && key !== null) {
        map.set(key, item);
      }
    }
  }
  return Array.from(map.values());
}

/**
 * 🛡️ Merge full AppData payload preserving all business collections
 */
export function mergeAppDataMonotonically(
  prev: AppData,
  incoming: Partial<AppData>,
  isExplicitDeletion: boolean = false
): AppData {
  if (!incoming || typeof incoming !== 'object') return prev;

  return {
    ...prev,
    ...incoming,
    settings: { ...prev.settings, ...(incoming.settings || {}) },
    advancedSettings: incoming.advancedSettings || prev.advancedSettings,
    branches: mergeCollectionRecords(prev.branches, incoming.branches, isExplicitDeletion),
    costCenters: mergeCollectionRecords(prev.costCenters, incoming.costCenters, isExplicitDeletion),
    accounts: mergeCollectionRecords(prev.accounts, incoming.accounts, isExplicitDeletion),
    users: mergeCollectionRecords(prev.users, incoming.users, isExplicitDeletion),
    customers: mergeCollectionRecords(prev.customers, incoming.customers, isExplicitDeletion),
    suppliers: mergeCollectionRecords(prev.suppliers, incoming.suppliers, isExplicitDeletion),
    items: mergeCollectionRecords(prev.items, incoming.items, isExplicitDeletion),
    salesInvoices: mergeCollectionRecords(prev.salesInvoices, incoming.salesInvoices, isExplicitDeletion),
    purchaseInvoices: mergeCollectionRecords(prev.purchaseInvoices, incoming.purchaseInvoices, isExplicitDeletion),
    cashTransactions: mergeCollectionRecords(prev.cashTransactions, incoming.cashTransactions, isExplicitDeletion),
    journalEntries: mergeCollectionRecords(prev.journalEntries, incoming.journalEntries, isExplicitDeletion),
    cheques: mergeCollectionRecords(prev.cheques, incoming.cheques, isExplicitDeletion),
    quotations: mergeCollectionRecords(prev.quotations, incoming.quotations, isExplicitDeletion),
    auditLogs: mergeCollectionRecords(prev.auditLogs, incoming.auditLogs, isExplicitDeletion),
    bankAccounts: mergeCollectionRecords(prev.bankAccounts, incoming.bankAccounts, isExplicitDeletion),
    employees: mergeCollectionRecords(prev.employees, incoming.employees, isExplicitDeletion),
    fixedAssets: mergeCollectionRecords(prev.fixedAssets, incoming.fixedAssets, isExplicitDeletion),
    boms: mergeCollectionRecords(prev.boms, incoming.boms, isExplicitDeletion),
    salesReps: mergeCollectionRecords(prev.salesReps, incoming.salesReps, isExplicitDeletion),
    physicalInventories: mergeCollectionRecords(prev.physicalInventories, incoming.physicalInventories, isExplicitDeletion),
    inventoryAdjustments: mergeCollectionRecords(prev.inventoryAdjustments, incoming.inventoryAdjustments, isExplicitDeletion),
    goodsIssueVouchers: mergeCollectionRecords(prev.goodsIssueVouchers, incoming.goodsIssueVouchers, isExplicitDeletion),
    productionOrders: mergeCollectionRecords(prev.productionOrders, incoming.productionOrders, isExplicitDeletion),
    approvalRequests: mergeCollectionRecords(prev.approvalRequests, incoming.approvalRequests, isExplicitDeletion),
    commissions: mergeCollectionRecords(prev.commissions, incoming.commissions, isExplicitDeletion),
    fiscalClosings: mergeCollectionRecords(prev.fiscalClosings, incoming.fiscalClosings, isExplicitDeletion),
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
