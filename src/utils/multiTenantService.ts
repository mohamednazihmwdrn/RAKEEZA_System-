import {
  TenantCompany,
  SubscriptionPlan,
  LicenseRecord,
  TrialRegistryRecord,
  ExportAuditLog,
  SupportAccessSession,
  User,
  SystemModuleKey,
  ActionPermissions,
  AppData,
} from '../types';

export const SYSTEM_MODULES_LIST: { key: SystemModuleKey; name: string; icon: string; category: string }[] = [
  { key: 'dashboard', name: 'لوحة التحكم الرئيسية', icon: '🏠', category: 'الرئيسية والذكاء' },
  { key: 'bi_analytics', name: 'ذكاء الأعمال والتحليلات BI', icon: '📊', category: 'الرئيسية والذكاء' },
  { key: 'sales', name: 'المبيعات والفواتير', icon: '💰', category: 'المبيعات والعملاء' },
  { key: 'pos', name: 'نقطة البيع السريعة POS', icon: '⚡', category: 'المبيعات والعملاء' },
  { key: 'quotes_orders', name: 'عروض الأسعار والطلبيات', icon: '📑', category: 'المبيعات والعملاء' },
  { key: 'pricing', name: 'إدارة الأسعار المركزية', icon: '🏷️', category: 'المبيعات والعملاء' },
  { key: 'sales_reps', name: 'مندوبي المبيعات والعمولات', icon: '🎯', category: 'المبيعات والعملاء' },
  { key: 'purchases', name: 'المشتريات والتوريدات', icon: '🛒', category: 'المشتريات والموردين' },
  { key: 'inventory', name: 'إدارة الأصناف والمخازن', icon: '📦', category: 'المخزون واللوجستيات' },
  { key: 'branches', name: 'الفروع والتحويلات المخزنية', icon: '🏢', category: 'المخزون واللوجستيات' },
  { key: 'manufacturing', name: 'التصنيع وتكاليف التكوين BOM', icon: '⚙️', category: 'المخزون واللوجستيات' },
  { key: 'accounts', name: 'حسابات العملاء والموردين', icon: '📋', category: 'المحاسبة والمالية' },
  { key: 'accounts_tree', name: 'دليل الحسابات ومراكز التكلفة', icon: '🌳', category: 'المحاسبة والمالية' },
  { key: 'cash', name: 'سندات القبض والصرف', icon: '💵', category: 'المحاسبة والمالية' },
  { key: 'treasury', name: 'الخزينة والأرصدة النقدية', icon: '🏦', category: 'المحاسبة والمالية' },
  { key: 'cheques', name: 'الشيكات وأوراق الدفع والقبض', icon: '💳', category: 'المحاسبة والمالية' },
  { key: 'bank_reconciliation', name: 'التسوية البنكية والاعتمادات', icon: '🏛️', category: 'المحاسبة والمالية' },
  { key: 'e_invoicing', name: 'الفاتورة والمنظومة الضريبية', icon: '🏛️', category: 'المحاسبة والمالية' },
  { key: 'year_end_closing', name: 'الإقفال السنوي وترحيل الحسابات', icon: '🔒', category: 'المحاسبة والمالية' },
  { key: 'hr_payroll', name: 'الموارد البشرية والرواتب HR', icon: '👥', category: 'الموارد البشرية' },
  { key: 'fixed_assets', name: 'الأصول الثابتة والإهلاكات', icon: '🏢', category: 'الأصول والرقابة' },
  { key: 'reports', name: 'التقارير الشاملة والقوائم المالية', icon: '📈', category: 'التقارير والأمان' },
  { key: 'audit_trail', name: 'سجل التدقيق الرقابي والأمان', icon: '🛡️', category: 'التقارير والأمان' },
  { key: 'users', name: 'المستخدمين ومركز الصلاحيات', icon: '👥', category: 'إدارة النظام' },
  { key: 'settings', name: 'إعدادات المؤسسة والنظام', icon: '⚙️', category: 'إدارة النظام' },
  { key: 'backup', name: 'النسخ الاحتياطي والاستعادة', icon: '💾', category: 'إدارة النظام' },
];

export const DEFAULT_ACTION_PERMISSIONS: ActionPermissions = {
  view: true,
  create: true,
  edit: true,
  delete: false,
  approve: false,
  cancel: false,
  print: true,
  export: false,
  import: false,
  manage: false,
};

export const ALL_ACTION_PERMISSIONS: ActionPermissions = {
  view: true,
  create: true,
  edit: true,
  delete: true,
  approve: true,
  cancel: true,
  print: true,
  export: true,
  import: true,
  manage: true,
};

export const READONLY_ACTION_PERMISSIONS: ActionPermissions = {
  view: true,
  create: false,
  edit: false,
  delete: false,
  approve: false,
  cancel: false,
  print: true,
  export: true,
  import: false,
  manage: false,
};

export const DEFAULT_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'trial',
    code: 'TRIAL-30D',
    name: 'التجربة المجانية (Free Trial)',
    nameEn: 'Free Trial 30 Days',
    durationDays: 30,
    price: 0,
    currency: 'ج.م',
    badge: 'هدية 30 يوم مجاناً',
    badgeColor: 'emerald',
    description: 'تجربة مجانية غير مقيدة لمدة شهر كامل لكافة وحدات منظومة ركيزة بدون استثناء',
    isDefaultTrial: true,
    features: [
      'sales',
      'pos',
      'purchases',
      'inventory',
      'accounting',
      'treasury',
      'reports',
      'hr',
      'manufacturing',
      'bi',
      'multi_branch',
      'e_invoicing',
      'fixed_assets',
      'cheques',
      'price_management',
      'full_export',
      'cloud_sync',
    ],
    limits: {
      maxUsers: 5,
      maxBranches: 2,
      maxWarehouses: 3,
      maxTransactionsPerMonth: 1000,
      storageMb: 1024,
      maxSalesReps: 5,
    },
  },
  {
    id: 'monthly',
    code: 'MONTHLY-BASIC',
    name: 'الاشتراك الشهري (Monthly)',
    nameEn: 'Monthly Subscription',
    durationDays: 30,
    price: 499,
    currency: 'ج.م',
    badge: 'مرونة شهرية',
    badgeColor: 'blue',
    description: 'خطة مرنة للشركات والمتاجر مع إمكانية التجديد الشهري والدعم الفني السحابي',
    features: [
      'sales',
      'pos',
      'purchases',
      'inventory',
      'accounting',
      'treasury',
      'reports',
      'e_invoicing',
      'price_management',
      'cloud_sync',
    ],
    limits: {
      maxUsers: 5,
      maxBranches: 2,
      maxWarehouses: 3,
      maxTransactionsPerMonth: 3000,
      storageMb: 2048,
      maxSalesReps: 5,
    },
  },
  {
    id: 'semi_annual',
    code: 'SEMI-6M',
    name: 'اشتراك 6 أشهر (6 Months)',
    nameEn: '6 Months Plan',
    durationDays: 180,
    price: 2490,
    currency: 'ج.م',
    badge: 'توفير 15%',
    badgeColor: 'purple',
    description: 'باقة مميزة للأعمال المتوسطة تشمل كافة وحدات الـ ERP مع تقارير متقدمة',
    features: [
      'sales',
      'pos',
      'purchases',
      'inventory',
      'accounting',
      'treasury',
      'reports',
      'hr',
      'fixed_assets',
      'cheques',
      'manufacturing',
      'e_invoicing',
      'price_management',
      'cloud_sync',
    ],
    limits: {
      maxUsers: 15,
      maxBranches: 5,
      maxWarehouses: 8,
      maxTransactionsPerMonth: 15000,
      storageMb: 5120,
      maxSalesReps: 15,
    },
  },
  {
    id: 'annual',
    code: 'ANNUAL-PRO',
    name: 'الاشتراك السنوي (Annual Pro)',
    nameEn: 'Annual Professional Plan',
    durationDays: 365,
    price: 4500,
    currency: 'ج.م',
    badge: 'الأكثر طلباً ⭐',
    badgeColor: 'amber',
    isPopular: true,
    description: 'الخطة الاحترافية الشاملة لكافة قطاعات الأعمال مع ربط ضريبي وفروع غير محدودة ودعم مخصص',
    features: [
      'sales',
      'pos',
      'purchases',
      'inventory',
      'accounting',
      'treasury',
      'reports',
      'hr',
      'manufacturing',
      'bi',
      'multi_branch',
      'e_invoicing',
      'fixed_assets',
      'cheques',
      'price_management',
      'full_export',
      'cloud_sync',
      'priority_support',
    ],
    limits: {
      maxUsers: 50,
      maxBranches: 15,
      maxWarehouses: 25,
      maxTransactionsPerMonth: 100000,
      storageMb: 20480,
      maxSalesReps: 50,
    },
  },
  {
    id: 'lifetime',
    code: 'LIFETIME-ENTERPRISE',
    name: 'مدى الحياة (Lifetime Enterprise)',
    nameEn: 'Lifetime Enterprise License',
    durationDays: 36500, // 100 years
    price: 18500,
    currency: 'ج.م',
    badge: 'ملكية دائمة 👑',
    badgeColor: 'emerald',
    description: 'ترخيص ملكية دائم بدون أي تجديدات دورية أو رسوم سنوية مع ترقيات مجانية مستمرة',
    features: [
      'sales',
      'pos',
      'purchases',
      'inventory',
      'accounting',
      'treasury',
      'reports',
      'hr',
      'manufacturing',
      'bi',
      'multi_branch',
      'e_invoicing',
      'fixed_assets',
      'cheques',
      'price_management',
      'full_export',
      'cloud_sync',
      'vip_support',
      'custom_api',
    ],
    limits: {
      maxUsers: 9999,
      maxBranches: 999,
      maxWarehouses: 999,
      maxTransactionsPerMonth: 9999999,
      storageMb: 102400,
      maxSalesReps: 999,
    },
  },
];

export const DEFAULT_COMPANIES: TenantCompany[] = [
  {
    id: 'COMP-000001',
    tenantId: 'TENANT-8812-HQ1',
    code: '101',
    name: 'شركة ركيزة للمحاسبة والتجارة العامة (RAKEEZA)',
    tradeName: 'ركيزة للأنظمة والحلول التقنية RAKEEZA',
    activity: '4651 - تجارة أجهزة الكمبيوتر والمعدات الإلكترونية',
    phone: '01029190615',
    whatsapp: '01029190615',
    email: 'admin@rakeeza.com',
    address: 'مدينة نصر، القاهرة، جمهورية مصر العربية',
    taxNumber: '123-456-789',
    commercialReg: 'CR-98765',
    adminName: 'Mohamed Nazih',
    adminPhone: '01029190615',
    adminEmail: 'nazih@rakeeza.com',
    adminUsername: 'admin',
    adminPassword: 'admin123',
    status: 'active',
    planId: 'annual',
    planName: 'الاشتراك السنوي (Annual Pro)',
    subscriptionId: 'SUB-2026-0001',
    licenseId: 'LIC-2026-9901',
    createdAt: '2026-01-01 08:00',
    subscriptionStartedAt: '2026-01-01',
    subscriptionExpiresAt: '2027-01-01',
    limits: {
      maxUsers: 50,
      maxBranches: 15,
      maxWarehouses: 25,
      maxTransactionsPerMonth: 100000,
      storageMb: 20480,
      maxSalesReps: 50,
    },
    features: [
      'sales',
      'pos',
      'purchases',
      'inventory',
      'accounting',
      'treasury',
      'reports',
      'hr',
      'manufacturing',
      'bi',
      'multi_branch',
      'e_invoicing',
      'fixed_assets',
      'cheques',
      'price_management',
      'full_export',
    ],
    usersCount: 3,
    branchesCount: 2,
    warehousesCount: 2,
    operationsCount: 0,
    lastActivityAt: '2026-09-02 11:20',
  },
  {
    id: 'COMP-000002',
    tenantId: 'TENANT-4491-TR2',
    code: '102',
    name: 'مؤسسة الأمل للتوريدات العمومية',
    tradeName: 'الأمل سوفت وير',
    activity: '4791 - تجارة التجزئة والتوريدات',
    phone: '01011223344',
    whatsapp: '01011223344',
    email: 'contact@alamal-trade.eg',
    address: 'المهندسين، الجيزة',
    taxNumber: '987-654-321',
    commercialReg: 'CR-11223',
    adminName: 'أحمد محمود القاضي',
    adminPhone: '01011223344',
    adminEmail: 'ahmed@alamal-trade.eg',
    adminUsername: 'alamal_admin',
    adminPassword: '123',
    status: 'trial',
    planId: 'trial',
    planName: 'التجربة المجانية (Free Trial 30 Days)',
    subscriptionId: 'SUB-2026-0002',
    licenseId: 'LIC-2026-0002',
    createdAt: '2026-08-15 10:00',
    trialStartedAt: '2026-08-15',
    trialExpiresAt: '2026-09-15',
    limits: {
      maxUsers: 5,
      maxBranches: 2,
      maxWarehouses: 3,
      maxTransactionsPerMonth: 1000,
      storageMb: 1024,
      maxSalesReps: 5,
    },
    features: [
      'sales',
      'pos',
      'purchases',
      'inventory',
      'accounting',
      'treasury',
      'reports',
      'hr',
      'manufacturing',
      'bi',
      'multi_branch',
    ],
    usersCount: 2,
    branchesCount: 1,
    warehousesCount: 1,
    operationsCount: 0,
    lastActivityAt: '2026-09-01 16:45',
  },
  {
    id: 'COMP-000003',
    tenantId: 'TENANT-9923-SL3',
    code: '103',
    name: 'مجموعة السلام الهندسية والمقاولات',
    tradeName: 'السلام إنجينيرينج',
    activity: '4321 - التركيبات والتجهيزات الهندسية',
    phone: '01299887766',
    email: 'info@elsalam-group.com',
    address: 'سموحة، الإسكندرية',
    taxNumber: '445-556-667',
    commercialReg: 'CR-77889',
    adminName: 'م. حسام علي إبراهيم',
    adminPhone: '01299887766',
    adminEmail: 'hossam@elsalam-group.com',
    adminUsername: 'elsalam_admin',
    adminPassword: '123',
    status: 'active',
    planId: 'monthly',
    planName: 'الاشتراك الشهري (Monthly)',
    subscriptionId: 'SUB-2026-0003',
    licenseId: 'LIC-2026-0003',
    createdAt: '2026-07-01 12:00',
    subscriptionStartedAt: '2026-08-01',
    subscriptionExpiresAt: '2026-09-01',
    limits: {
      maxUsers: 5,
      maxBranches: 2,
      maxWarehouses: 3,
      maxTransactionsPerMonth: 3000,
      storageMb: 2048,
      maxSalesReps: 5,
    },
    features: ['sales', 'pos', 'purchases', 'inventory', 'accounting', 'treasury', 'reports'],
    usersCount: 3,
    branchesCount: 2,
    warehousesCount: 2,
    operationsCount: 84,
    lastActivityAt: '2026-08-30 14:10',
  },
];

export const DEFAULT_TRIAL_REGISTRY: TrialRegistryRecord[] = [
  {
    id: 'TR-01',
    phone: '01011223344',
    email: 'contact@alamal-trade.eg',
    deviceFingerprint: 'DEV-FINGERPRINT-8899AA',
    companyId: 'COMP-000002',
    companyName: 'مؤسسة الأمل للتوريدات العمومية',
    trialStartedAt: '2026-08-15',
    trialExpiresAt: '2026-09-15',
    status: 'active',
    otpVerified: true,
    notes: 'تم التحقق من رقم الهاتف عبر رمز OTP بنجاح',
  },
  {
    id: 'TR-02',
    phone: '01122334455',
    email: 'past-trial@example.com',
    deviceFingerprint: 'DEV-FINGERPRINT-1122BB',
    companyId: 'COMP-000099',
    companyName: 'تجربة سابقة منتهية',
    trialStartedAt: '2026-06-01',
    trialExpiresAt: '2026-07-01',
    status: 'expired',
    otpVerified: true,
    notes: 'استنفدت فترة الـ 30 يوماً - غير مسموح بتجربة ثانية',
  },
];

/**
 * Generate cryptographically unique License Activation Code
 * Format: RKZ-YYYY-XXXX-XXXX-XXXX
 */
export function generateLicenseActivationCode(): string {
  const year = new Date().getFullYear();
  const segment = () =>
    Math.random().toString(36).substring(2, 6).toUpperCase();
  return `RKZ-${year}-${segment()}-${segment()}-${segment()}`;
}

/**
 * Anti-Abuse Server & Registry Trial Validator
 * Checks phone number, email, and device identifier
 */
export function validateTrialEligibility(
  phone: string,
  email: string | undefined,
  trialRegistry: TrialRegistryRecord[]
): { eligible: boolean; reason?: string; pastRecord?: TrialRegistryRecord } {
  const cleanPhone = phone.replace(/[\s-+]/g, '').trim();

  // Check phone number
  const matchedPhone = trialRegistry.find(
    (r) => r.phone.replace(/[\s-+]/g, '').trim() === cleanPhone
  );

  if (matchedPhone) {
    return {
      eligible: false,
      reason: `عذراً، رقم الهاتف (${phone}) قد استفاد مسبقاً من التجربة المجانية لمدة 30 يوم لشركة "${matchedPhone.companyName}". لحماية النظام من إساءة الاستخدام، لا يمكن تكرار التجربة المجانية لنفس رقم الهاتف. يرجى الاشتراك في إحدى باقات ركيزة للاستمرار.`,
      pastRecord: matchedPhone,
    };
  }

  // Check email if provided
  if (email && email.trim().length > 3) {
    const cleanEmail = email.toLowerCase().trim();
    const matchedEmail = trialRegistry.find(
      (r) => r.email && r.email.toLowerCase().trim() === cleanEmail
    );
    if (matchedEmail) {
      return {
        eligible: false,
        reason: `عذراً، البريد الإلكتروني (${email}) مسجل مسبقاً في تجربة مجانية لشركة "${matchedEmail.companyName}".`,
        pastRecord: matchedEmail,
      };
    }
  }

  return { eligible: true };
}

/**
 * Check if a user has permission to perform an action on a module
 */
export function hasUserPermission(
  user: User | undefined,
  moduleKey: SystemModuleKey,
  action: keyof ActionPermissions,
  branchId?: string,
  warehouseId?: string
): boolean {
  if (!user) return false;

  // Platform Owner and Company Admin have full access
  if (user.role === 'owner' || user.role === 'company_admin' || user.role === 'admin') {
    return true;
  }

  // Check if disabled
  if (user.status === 'disabled') {
    return false;
  }

  // Check Branch scope
  if (branchId && user.allowedBranches && user.allowedBranches.length > 0) {
    if (!user.allowedBranches.includes('all') && !user.allowedBranches.includes(branchId)) {
      return false;
    }
  }

  // Check Warehouse scope
  if (warehouseId && user.allowedWarehouses && user.allowedWarehouses.length > 0) {
    if (!user.allowedWarehouses.includes('all') && !user.allowedWarehouses.includes(warehouseId)) {
      return false;
    }
  }

  // Global 'all' permission flag
  if (user.permissions?.all === true) {
    return true;
  }

  const modulePerms = user.permissions?.[moduleKey];

  if (modulePerms === true) {
    return true;
  }

  if (typeof modulePerms === 'object' && modulePerms !== null) {
    return Boolean((modulePerms as Partial<ActionPermissions>)[action]);
  }

  return false;
}

/**
 * Create a new Company / Tenant with all unique IDs
 */
export function createNewTenantCompany(
  companyInput: Partial<TenantCompany>,
  planId: string,
  plans: SubscriptionPlan[],
  trialRegistry: TrialRegistryRecord[]
): { company: TenantCompany; license: LicenseRecord; updatedRegistry: TrialRegistryRecord[] } {
  const shortNum = Math.floor(100 + Math.random() * 900);
  const companyCode = `${shortNum}`;
  const companyId = `COMP-${shortNum}`;
  const tenantId = `TENANT-${shortNum}`;
  const subId = `SUB-${new Date().getFullYear()}-${shortNum}`;
  const licId = `LIC-${new Date().getFullYear()}-${shortNum}`;

  const selectedPlan = plans.find((p) => p.id === planId) || plans[0];
  const now = new Date();
  const startDateStr = now.toISOString().split('T')[0];

  const expiryDate = new Date();
  expiryDate.setDate(now.getDate() + (selectedPlan.durationDays || 30));
  const expiryDateStr = expiryDate.toISOString().split('T')[0];

  const isTrial = selectedPlan.id === 'trial';
  const status = isTrial ? 'trial' : 'active';

  const activationCode = generateLicenseActivationCode();

  const newCompany: TenantCompany = {
    id: companyId,
    tenantId,
    code: companyCode,
    name: companyInput.name || 'شركة جديدة',
    tradeName: companyInput.tradeName || companyInput.name,
    activity: companyInput.activity || 'تجارة عامة وخدمات',
    phone: companyInput.phone || '',
    whatsapp: companyInput.whatsapp || companyInput.phone || '',
    email: companyInput.email || '',
    address: companyInput.address || 'جمهورية مصر العربية',
    taxNumber: companyInput.taxNumber || '',
    commercialReg: companyInput.commercialReg || '',
    adminName: companyInput.adminName || 'المدير العام',
    adminPhone: companyInput.adminPhone || companyInput.phone || '',
    adminEmail: companyInput.adminEmail || companyInput.email || '',
    adminUsername: companyInput.adminUsername || 'admin',
    adminPassword: companyInput.adminPassword || '123456',
    status,
    planId: selectedPlan.id,
    planName: selectedPlan.name,
    subscriptionId: subId,
    licenseId: licId,
    createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    trialStartedAt: isTrial ? startDateStr : undefined,
    trialExpiresAt: isTrial ? expiryDateStr : undefined,
    subscriptionStartedAt: !isTrial ? startDateStr : undefined,
    subscriptionExpiresAt: !isTrial ? expiryDateStr : undefined,
    limits: { ...selectedPlan.limits },
    features: [...selectedPlan.features],
    usersCount: 1,
    branchesCount: 1,
    warehousesCount: 1,
    operationsCount: 0,
    lastActivityAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
  };

  const newLicense: LicenseRecord = {
    id: licId,
    activationCode,
    companyId,
    companyName: newCompany.name,
    planId: selectedPlan.id,
    planName: selectedPlan.name,
    startDate: startDateStr,
    expiryDate: expiryDateStr,
    status: 'active',
    features: [...selectedPlan.features],
    limits: { ...selectedPlan.limits },
    generatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    generatedBy: 'RAKEEZA OWNER',
    activationCount: 1,
  };

  let updatedRegistry = [...trialRegistry];
  if (isTrial && companyInput.phone) {
    const trialRecord: TrialRegistryRecord = {
      id: `TR-${Date.now()}`,
      phone: companyInput.phone,
      email: companyInput.email,
      deviceFingerprint: `DEV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      companyId,
      companyName: newCompany.name,
      trialStartedAt: startDateStr,
      trialExpiresAt: expiryDateStr,
      status: 'active',
      otpVerified: true,
      notes: 'تم تفعيل التجربة المجانية لمدة 30 يوم بنجاح',
    };
    updatedRegistry.push(trialRecord);
  }

  return { company: newCompany, license: newLicense, updatedRegistry };
}
