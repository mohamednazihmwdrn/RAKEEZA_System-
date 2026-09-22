import { User } from '../types';

export interface PermissionDefinition {
  id: string;
  name: string;
  category: string;
  description?: string;
}

export const SYSTEM_PERMISSIONS: PermissionDefinition[] = [
  // 1. لوحة التحكم والقيادة
  { id: 'dashboard', name: 'لوحة التحكم والقيادة العامة', category: 'لوحة التحكم', description: 'عرض بطاقات الملخص والإحصائيات العامة' },

  // 2. المبيعات
  { id: 'sales_view', name: 'استعراض فواتير المبيعات', category: 'المبيعات', description: 'استعراض جدول وفواتير المبيعات وقوائمها' },
  { id: 'sales_create', name: 'إنشاء فاتورة مبيعات جديدة', category: 'المبيعات', description: 'إمكانية إصدار فواتير بيع نقدي وآجل' },
  { id: 'sales_edit', name: 'تعديل فاتورة مبيعات', category: 'المبيعات', description: 'تعديل أصناف وكميات الفاتورة بعد إنشائها' },
  { id: 'sales_delete', name: 'حذف فاتورة مبيعات', category: 'المبيعات', description: 'إلغاء وحذف فواتير المبيعات وتسوية المخزن' },
  { id: 'sales_returns', name: 'مرتجعات المبيعات', category: 'المبيعات', description: 'إصدار مرتجع بيع نقدي أو آجل واسترجاع المخزون' },
  { id: 'quotes_orders', name: 'عروض الأسعار والطلبيات', category: 'المبيعات', description: 'إنشاء ومتابعة عروض الأسعار وأوامر التوريد' },
  { id: 'pos_access', name: 'نقطة البيع السريعة POS', category: 'المبيعات', description: 'تشغيل شاشة الكاشير ونقاط البيع السريعة' },
  { id: 'price_management', name: 'إدارة وتعديل قوائم الأسعار', category: 'المبيعات', description: 'تعديل أسعار البيع النقدي والجملة' },

  // 3. المشتريات
  { id: 'purchases_view', name: 'استعراض فواتير المشتريات', category: 'المشتريات', description: 'استعراض فواتير المشتريات والموردين' },
  { id: 'purchases_create', name: 'إنشاء فاتورة مشتريات', category: 'المشتريات', description: 'تسجيل بضاعة واردة من الموردين نقدي وآجل' },
  { id: 'purchases_edit', name: 'تعديل فاتورة مشتريات', category: 'المشتريات', description: 'تعديل بنود وأسعار الشراء' },
  { id: 'purchases_delete', name: 'حذف فاتورة مشتريات', category: 'المشتريات', description: 'حذف فاتورة الشراء واستبعاد كمياتها' },
  { id: 'purchases_returns', name: 'مرتجعات المشتريات', category: 'المشتريات', description: 'إرجاع بضاعة للمورد واسترداد القيمة' },

  // 4. المخازن والأصناف
  { id: 'inventory_view', name: 'استعراض المخازن والأرصدة', category: 'المخازن والأصناف', description: 'متابعة أرصدة المخازن والحد الأدنى' },
  { id: 'items_view', name: 'استعراض كروت الأصناف', category: 'المخازن والأصناف', description: 'عرض قائمة الأصناف وأسعارها' },
  { id: 'items_create', name: 'إضافة صنف جديد', category: 'المخازن والأصناف', description: 'تعريف أصناف وباركود ووحدات جديدة' },
  { id: 'items_edit', name: 'تعديل بيانات صنف', category: 'المخازن والأصناف', description: 'تعديل اسم الصنف وتصنيفه' },
  { id: 'items_delete', name: 'حذف صنف', category: 'المخازن والأصناف', description: 'حذف الأصناف غير المرتبطة بحركات نشطة' },
  { id: 'inventory_stocktaking', name: 'الجرد الفعلي والتسويات', category: 'المخازن والأصناف', description: 'مطابقة الرصيد الدفتري والفعلي وتسوية العجز' },
  { id: 'inventory_transfers', name: 'التحويلات المخزنية بين الفروع', category: 'المخازن والأصناف', description: 'مناقلة بضاعة بين المخازن والفروع' },

  // 5. العملاء والموردين
  { id: 'customers_manage', name: 'إدارة العملاء والمديونيات', category: 'العملاء والموردين', description: 'إضافة عملاء، سقف الائتمان، وكشوف الحساب' },
  { id: 'suppliers_manage', name: 'إدارة الموردين والمستحقات', category: 'العملاء والموردين', description: 'إضافة موردين ومتابعة الأرصدة الدائنة' },

  // 6. الخزينة والمالية
  { id: 'treasury_view', name: 'استعراض الخزائن والسيولة', category: 'الخزينة والمالية', description: 'عرض رصيد الدرج، فودافون كاش، إنستاباي' },
  { id: 'cash_receipt', name: 'إنشاء سند قبض نقدية', category: 'الخزينة والمالية', description: 'قبض مبالغ من العملاء أو إيرادات أخرى' },
  { id: 'cash_payment', name: 'إنشاء سند صرف نقدية', category: 'الخزينة والمالية', description: 'صرف مبالغ للموردين أو مصروفات عمومية' },
  { id: 'banks_manage', name: 'حسابات البنوك والتسوية البنكية', category: 'الخزينة والمالية', description: 'إدارة المعاملات البنكية ومطابقة الكشوف' },
  { id: 'cheques_manage', name: 'الشيكات وأوراق القبض والدفع', category: 'الخزينة والمالية', description: 'إدارة الشيكات الصادرة والواردة وتواريخ الاستحقاق' },

  // 7. الحسابات العامة
  { id: 'accounts_view', name: 'شجرة الحسابات العامة', category: 'الحسابات العامة', description: 'استعراض الدليل المحاسبي الشجري' },
  { id: 'daily_entries', name: 'دفتر القيود اليومية المحاسبية', category: 'الحسابات العامة', description: 'إنشاء وترحيل القيود اليومية المزدوجة' },
  { id: 'trial_balance', name: 'ميزان المراجعة والقوائم الختامية', category: 'الحسابات العامة', description: 'استعراض ميزان المراجعة، الأرباح والخسائر، والميزانية' },
  { id: 'year_end_closing', name: 'الإقفال السنوي وترحيل الأرصدة', category: 'الحسابات العامة', description: 'إغلاق السنة المالية وترحيل الأرصدة الافتتاحية' },

  // 8. التقارير والذكاء المالي
  { id: 'reports_view', name: 'استعراض التقارير المالية والإدارية', category: 'التقارير', description: 'الوصول لكافة تقارير المبيعات، المشتريات، والأرباح' },
  { id: 'reports_export', name: 'تصدير التقارير (Excel / PDF)', category: 'التقارير', description: 'تصدير التقارير إلى ملفات إكسل وطباعتها' },
  { id: 'bi_analytics', name: 'تحليلات ذكاء الأعمال BI', category: 'التقارير', description: 'مؤشرات الأداء وتحليل الربحية والمنتجات الأكثر مبيعاً' },

  // 9. المتجر والكتالوج الإلكتروني
  { id: 'website_catalog', name: 'المتجر الإلكتروني وطلبات الويب', category: 'المتجر والويب', description: 'إدارة منتجات وأسعار الكتالوج واستقبال طلبات الزبائن' },

  // 10. المناديب والموارد البشرية
  { id: 'sales_reps', name: 'مناديب المبيعات وعمولات التحصيل', category: 'الموارد والمناديب', description: 'إدارة المناديب وتحديد نسب العمولات وسقف البيع' },
  { id: 'hr_payroll', name: 'شؤون الموظفين والرواتب', category: 'الموارد والمناديب', description: 'سجلات الموظفين ومسيرات الرواتب والسلف' },
  { id: 'manufacturing', name: 'أوامر التصنيع وتكاليف الإنتاج', category: 'الإنتاج والأصول', description: 'معادلات التكوين BOM وأوامر التشغيل' },
  { id: 'fixed_assets', name: 'الأصول الثابتة وحساب الإهلاك', category: 'الإنتاج والأصول', description: 'حصر الأصول الثابتة وتسجيل الإهلاك المحاسبي' },

  // 11. إعدادات النظام والأمان
  { id: 'company_settings', name: 'إعدادات الشركة والفرع والمطبوعات', category: 'إعدادات النظام', description: 'بيانات الفاتورة، اللوجو، الضرائب، وترويسة الطباعة' },
  { id: 'users_manage', name: 'إدارة المستخدمين وتوزيع الصلاحيات', category: 'إعدادات النظام', description: 'إضافة حسابات الموظفين وتعيين صلاحياتهم' },
  { id: 'backup_export', name: 'النسخ الاحتياطي وتصدير البيانات', category: 'إعدادات النظام', description: 'إنشاء واستعادة النسخ الاحتياطية وتصدير البيانات' },
  { id: 'audit_trail', name: 'سجل المراجعة والأمان (Audit Trail)', category: 'إعدادات النظام', description: 'متابعة سجل حركات المستخدمين ومن قام بكل عملية' },
];

/**
 * Returns true if the user has full administrative privileges
 */
export function isAdminUser(user: User | undefined): boolean {
  if (!user) return false;
  const role = user.role;
  return role === 'owner' || role === 'company_admin' || role === 'admin';
}

/**
 * Checks whether a user possesses a specific permission.
 * Admins, company admins, and owners automatically have all permissions.
 */
export function hasPermission(user: User | undefined, permissionId: string): boolean {
  if (!user) return false;

  // 1. Owner & Company Admin & Admin always have all company permissions
  if (isAdminUser(user)) return true;

  // 2. Full access flag in permissions
  if (user.permissions?.all === true) return true;

  // 3. Check explicit permission record
  const permValue = user.permissions?.[permissionId];
  if (typeof permValue === 'boolean') return permValue;
  if (typeof permValue === 'object' && permValue !== null) {
    return !!(permValue as any).view || !!(permValue as any).create || !!(permValue as any).edit;
  }

  // 4. Default role-based fallbacks if granular permissions not explicitly saved yet
  const role = user.role;
  if (role === 'cashier') {
    const cashierAllowed = ['pos_access', 'sales_create', 'sales_view', 'sales_returns', 'items_view'];
    return cashierAllowed.includes(permissionId);
  }
  if (role === 'warehouse_keeper') {
    const warehouseAllowed = ['inventory_view', 'items_view', 'items_create', 'items_edit', 'inventory_stocktaking', 'inventory_transfers'];
    return warehouseAllowed.includes(permissionId);
  }
  if (role === 'accountant') {
    const accountantDisallowed = ['users_manage', 'company_settings'];
    return !accountantDisallowed.includes(permissionId);
  }
  if (role === 'sales_rep') {
    const repAllowed = ['sales_create', 'sales_view', 'quotes_orders', 'customers_manage', 'items_view'];
    return repAllowed.includes(permissionId);
  }

  return false;
}

/**
 * Map of page IDs to required permission IDs
 */
export const PAGE_PERMISSION_MAP: Record<string, string[]> = {
  home: ['dashboard'],
  pos: ['pos_access', 'sales_create'],
  sales: ['sales_view', 'sales_create', 'sales_edit'],
  price_management: ['price_management'],
  quotes_orders: ['quotes_orders', 'sales_view'],
  web_orders: ['website_catalog', 'sales_view'],
  catalog_manager: ['website_catalog', 'items_edit'],
  catalog: [], // Public store view
  purchases: ['purchases_view', 'purchases_create', 'purchases_edit'],
  cash: ['treasury_view', 'cash_receipt', 'cash_payment'],
  accounts: ['customers_manage', 'suppliers_manage', 'accounts_view'],
  accounts_tree: ['accounts_view'],
  branches: ['company_settings'],
  e_invoicing: ['e_invoicing', 'company_settings'],
  crm_pipeline: ['sales_view'],
  serial_warranty: ['sales_view', 'items_view'],
  cash_flow_closing: ['trial_balance', 'treasury_view'],
  bi_analytics: ['bi_analytics', 'reports_view', 'dashboard'],
  audit_trail: ['audit_trail', 'company_settings'],
  items: ['items_view', 'inventory_view'],
  item_movement: ['items_view', 'inventory_view'],
  inventory: ['inventory_view'],
  physical_inventory: ['inventory_stocktaking'],
  inventory_settlement: ['inventory_stocktaking'],
  daily_operations: ['daily_entries', 'accounts_view'],
  daily_entries: ['daily_entries'],
  trial_balance: ['trial_balance', 'accounts_view'],
  income_statement: ['trial_balance', 'accounts_view'],
  balance_sheet: ['trial_balance', 'accounts_view'],
  monthly_profit_report: ['reports_view', 'bi_analytics'],
  year_end_closing: ['year_end_closing'],
  treasury: ['treasury_view'],
  cheques: ['cheques_manage', 'treasury_view'],
  sales_reps: ['sales_reps'],
  hr_payroll: ['hr_payroll'],
  fixed_assets: ['fixed_assets'],
  manufacturing: ['manufacturing'],
  bank_reconciliation: ['banks_manage'],
  settings: ['company_settings'],
  users: ['users_manage'],
  backup: ['backup_export'],
  owner_panel: ['owner'], // Strict owner only
};

/**
 * Verifies whether the active user has authorization to view a given page.
 */
export function canAccessPage(user: User | undefined, pageId: string): boolean {
  if (!user) return true;

  // 1. Owner panel is strictly reserved for the owner role
  if (pageId === 'owner_panel') {
    return user.role === 'owner';
  }

  // 2. Administrators have access to all tenant pages
  if (isAdminUser(user)) return true;

  // 3. Public pages (e.g. online catalog)
  if (pageId === 'catalog') return true;

  // 4. Reports pages check
  if (pageId.startsWith('reports')) {
    return hasPermission(user, 'reports_view');
  }

  // 5. Look up page in permission map
  const requiredPermissions = PAGE_PERMISSION_MAP[pageId];
  if (!requiredPermissions || requiredPermissions.length === 0) {
    return true;
  }

  // Check if user has ANY of the permitted flags for this page
  return requiredPermissions.some((p) => hasPermission(user, p));
}

/**
 * Determines the best landing page for a user upon logging in, based on their permissions.
 */
export function getDefaultLandingPage(user: User | undefined): string {
  if (!user) return 'home';

  // 1. Owner
  if (user.role === 'owner') return 'owner_panel';

  // 2. Admin or full permissions
  if (isAdminUser(user)) return 'home';

  // 3. Cashier defaults to POS
  if (user.role === 'cashier' || hasPermission(user, 'pos_access')) {
    return 'pos';
  }

  // 4. If user has dashboard permission
  if (hasPermission(user, 'dashboard')) {
    return 'home';
  }

  // 5. Check other operational permissions in order of priority
  const priorityOrder = [
    { page: 'sales', perm: 'sales_view' },
    { page: 'purchases', perm: 'purchases_view' },
    { page: 'cash', perm: 'cash_receipt' },
    { page: 'items', perm: 'items_view' },
    { page: 'inventory', perm: 'inventory_view' },
    { page: 'accounts', perm: 'customers_manage' },
    { page: 'quotes_orders', perm: 'quotes_orders' },
    { page: 'reports_general', perm: 'reports_view' },
  ];

  for (const item of priorityOrder) {
    if (hasPermission(user, item.perm)) {
      return item.page;
    }
  }

  return 'home';
}
