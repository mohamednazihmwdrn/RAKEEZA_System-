import { User, AppData } from '../types';

export interface PermissionDefinition {
  id: string;
  name: string;
  category: string;
  description?: string;
  actionType?: 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'export';
}

export const SYSTEM_PERMISSIONS: PermissionDefinition[] = [
  // 1. لوحة التحكم (Dashboard)
  { id: 'dashboard', name: 'استعراض لوحة التحكم والمؤشرات المالية', category: 'لوحة التحكم', description: 'عرض بطاقات الموقف المالي وحركة المبيعات والمشتريات', actionType: 'view' },

  // 2. المبيعات (Sales)
  { id: 'sales_view', name: 'استعراض فواتير المبيعات', category: 'المبيعات', description: 'استعراض جدول وفواتير المبيعات وقوائمها', actionType: 'view' },
  { id: 'sales_create', name: 'إنشاء وإصدار فواتير المبيعات', category: 'المبيعات', description: 'إمكانية إصدار فواتير بيع نقدي وآجل للعملاء', actionType: 'create' },
  { id: 'sales_edit', name: 'تعديل فواتير المبيعات القائمة', category: 'المبيعات', description: 'تعديل أصناف وكميات الفاتورة بعد إنشائها', actionType: 'edit' },
  { id: 'sales_delete', name: 'حذف وإلغاء فواتير المبيعات', category: 'المبيعات', description: 'إلغاء وحذف فواتير المبيعات مع تسوية المخزن', actionType: 'delete' },
  { id: 'sales_returns', name: 'تسجيل واعتماد مرتجعات المبيعات', category: 'المبيعات', description: 'إصدار مرتجع بيع نقدي أو آجل واسترجاع المخزون', actionType: 'approve' },
  { id: 'sales_export', name: 'تصدير وطباعة فواتير المبيعات', category: 'المبيعات', description: 'طباعة وتصدير فواتير البيع إلى Excel و PDF', actionType: 'export' },
  { id: 'quotes_orders', name: 'عروض الأسعار والطلبيات', category: 'المبيعات', description: 'إنشاء ومتابعة عروض الأسعار وأوامر التوريد', actionType: 'create' },
  { id: 'pos_access', name: 'نقطة البيع السريعة POS', category: 'المبيعات', description: 'تشغيل شاشة الكاشير ونقاط البيع السريعة', actionType: 'create' },

  // 3. المشتريات (Purchases)
  { id: 'purchases_view', name: 'استعراض فواتير المشتريات', category: 'المشتريات', description: 'استعراض فواتير المشتريات والموردين', actionType: 'view' },
  { id: 'purchases_create', name: 'إنشاء فواتير المشتريات والتوريد', category: 'المشتريات', description: 'تسجيل بضاعة واردة من الموردين نقدي وآجل', actionType: 'create' },
  { id: 'purchases_edit', name: 'تعديل فواتير المشتريات', category: 'المشتريات', description: 'تعديل بنود وأسعار الشراء بعد التسجيل', actionType: 'edit' },
  { id: 'purchases_delete', name: 'حذف فواتير المشتريات', category: 'المشتريات', description: 'حذف فاتورة الشراء واستبعاد كمياتها من المخزن', actionType: 'delete' },
  { id: 'purchases_returns', name: 'تسجيل واعتماد مرتجعات المشتريات', category: 'المشتريات', description: 'إرجاع بضاعة للمورد واسترداد القيمة وتعديل الرصيد', actionType: 'approve' },
  { id: 'purchases_export', name: 'تصدير وطباعة المشتريات', category: 'المشتريات', description: 'تصدير كشوف المشتريات إلى Excel و PDF', actionType: 'export' },

  // 4. العملاء (Customers)
  { id: 'customers_view', name: 'استعراض سجل وكشوف العملاء', category: 'العملاء', description: 'عرض قائمة العملاء وأرصدتهم الحالية', actionType: 'view' },
  { id: 'customers_create', name: 'إضافة عميل جديد', category: 'العملاء', description: 'تسجيل بيانات عميل جديد في المنظومة', actionType: 'create' },
  { id: 'customers_edit', name: 'تعديل بيانات وسقف ائتمان عميل', category: 'العملاء', description: 'تعديل هاتف وعنوان وسقف ائتمان العميل', actionType: 'edit' },
  { id: 'customers_delete', name: 'حذف حساب عميل', category: 'العملاء', description: 'حذف حساب عميل من الدليل', actionType: 'delete' },
  { id: 'customers_export', name: 'تصدير كشوف حسابات العملاء', category: 'العملاء', description: 'تصدير كشف حساب العميل والمديونيات إلى Excel و PDF', actionType: 'export' },

  // 5. الموردين (Suppliers)
  { id: 'suppliers_view', name: 'استعراض سجل كشوف الموردين', category: 'الموردين', description: 'عرض قائمة الموردين وأرصدتهم المستحقة', actionType: 'view' },
  { id: 'suppliers_create', name: 'إضافة مورد جديد', category: 'الموردين', description: 'تسجيل بيانات مورد وتصنيفه', actionType: 'create' },
  { id: 'suppliers_edit', name: 'تعديل بيانات وحساب مورد', category: 'الموردين', description: 'تعديل بيانات الاتصال والحساب للمورد', actionType: 'edit' },
  { id: 'suppliers_delete', name: 'حذف حساب مورد', category: 'الموردين', description: 'حذف حساب مورد من الدليل', actionType: 'delete' },
  { id: 'suppliers_export', name: 'تصدير كشوف حسابات الموردين', category: 'الموردين', description: 'تصدير مستحقات وكشوف الموردين إلى Excel و PDF', actionType: 'export' },

  // 6. المنتجات والأصناف (Products)
  { id: 'items_view', name: 'استعراض كروت الأصناف والمنتجات', category: 'المنتجات والأصناف', description: 'عرض قائمة الأصناف وأسعارها وباركوداتها', actionType: 'view' },
  { id: 'items_create', name: 'إضافة صنف ومنتج جديد', category: 'المنتجات والأصناف', description: 'تعريف أصناف وباركود ووحدات جديدة', actionType: 'create' },
  { id: 'items_edit', name: 'تعديل بيانات وأسعار صنف', category: 'المنتجات والأصناف', description: 'تعديل اسم الصنف وتصنيفه وسعر تكلفته وبيعه', actionType: 'edit' },
  { id: 'items_delete', name: 'حذف صنف من المنظومة', category: 'المنتجات والأصناف', description: 'حذف الأصناف غير المرتبطة بحركات نشطة', actionType: 'delete' },
  { id: 'items_export', name: 'تصدير دليل الأصناف والباركود', category: 'المنتجات والأصناف', description: 'تصدير دليل الأصناف إلى Excel و PDF', actionType: 'export' },
  { id: 'price_management', name: 'إدارة وتعديل قوائم الأسعار', category: 'المنتجات والأصناف', description: 'تعديل أسعار البيع النقدي والجملة للأصناف', actionType: 'edit' },

  // 7. المخزون (Inventory)
  { id: 'inventory_view', name: 'استعراض أرصدة المخزون وحركته', category: 'المخزون', description: 'متابعة أرصدة المخازن وحركة الصادر والوارد وتكلفة المخزون', actionType: 'view' },
  { id: 'inventory_transfers', name: 'التحويلات المخزنية بين الفروع', category: 'المخزون', description: 'مناقلة بضاعة بين المخازن والفروع', actionType: 'create' },
  { id: 'inventory_stocktaking', name: 'الجرد الفعلي واعتماد التسويات', category: 'المخزون', description: 'مطابقة الرصيد الدفتري والفعلي وتسوية العجز والزيادة', actionType: 'approve' },
  { id: 'inventory_export', name: 'تصدير تقارير حركة المخزون', category: 'المخزون', description: 'تصدير كشوف جرد المخازن إلى Excel و PDF', actionType: 'export' },

  // 8. المستودعات والفروع (Warehouses)
  { id: 'warehouses_view', name: 'استعراض قائمة المستودعات والفروع', category: 'المستودعات والفروع', description: 'عرض قائمة الفروع والمخازن التابعة للمنشأة', actionType: 'view' },
  { id: 'warehouses_manage', name: 'إدارة وإنشاء وتعديل المستودعات', category: 'المستودعات والفروع', description: 'إضافة وتعديل بيانات المخازن والفروع ومسؤوليها', actionType: 'edit' },

  // 9. الخزينة والسيولة (Cash)
  { id: 'treasury_view', name: 'استعراض أرصدة الخزائن والسيولة', category: 'الخزينة والسيولة', description: 'عرض رصيد الدرج، فودافون كاش، إنستاباي، والعهدة', actionType: 'view' },
  { id: 'cash_transfer', name: 'التحويل بين الخزائن وحسابات الكاش', category: 'الخزينة والسيولة', description: 'نقل أموال بين الدرج والمحافظ النقدية وحسابات السيولة', actionType: 'create' },

  // 10. البنوك والشيكات (Banks)
  { id: 'banks_view', name: 'استعراض الحسابات البنكية والودائع', category: 'البنوك والشيكات', description: 'عرض أرصدة الحسابات المصرفية ومتابعة الحركات', actionType: 'view' },
  { id: 'banks_manage', name: 'إدارة وتعديل الحسابات البنكية', category: 'البنوك والشيكات', description: 'إدارة الحسابات البنكية ومطابقة الكشوف والتسويات المصرفية', actionType: 'edit' },
  { id: 'cheques_manage', name: 'إدارة واعتماد أوراق القبض والدفع والشيكات', category: 'البنوك والشيكات', description: 'إدارة الشيكات وتواريخ استحقاقها وحالات التحصيل والارتداد', actionType: 'approve' },

  // 11. سندات القبض (Receipts)
  { id: 'receipts_view', name: 'استعراض سندات قبض النقدية', category: 'سندات القبض', description: 'استعراض سجل سندات وإيصالات قبض النقدية من العملاء', actionType: 'view' },
  { id: 'cash_receipt', name: 'إنشاء وإصدار سند قبض نقدية', category: 'سندات القبض', description: 'قبض مبالغ من العملاء أو إيرادات أخرى وإيداعها بالخزينة', actionType: 'create' },
  { id: 'receipts_edit', name: 'تعديل سند قبض نقدية', category: 'سندات القبض', description: 'تعديل بيانات أو قيمة سند قبض مسجل', actionType: 'edit' },
  { id: 'receipts_delete', name: 'حذف أو إلغاء سند قبض', category: 'سندات القبض', description: 'إلغاء سند قبض واسترجاع أثر الخزينة ورصيد العميل', actionType: 'delete' },
  { id: 'receipts_export', name: 'طباعة وتصدير سندات القبض', category: 'سندات القبض', description: 'طباعة إيصالات القبض وتصدير سجل المقبوضات', actionType: 'export' },

  // 12. سندات الصرف (Payments)
  { id: 'payments_view', name: 'استعراض سندات صرف النقدية', category: 'سندات الصرف', description: 'استعراض سجل سندات صرف النقدية للموردين أو الجهات', actionType: 'view' },
  { id: 'cash_payment', name: 'إنشاء وإصدار سند صرف نقدية', category: 'سندات الصرف', description: 'صرف مبالغ للموردين أو سداد التزامات من الخزينة', actionType: 'create' },
  { id: 'payments_edit', name: 'تعديل سند صرف نقدية', category: 'سندات الصرف', description: 'تعديل بيانات أو قيمة سند صرف مسجل', actionType: 'edit' },
  { id: 'payments_delete', name: 'حذف أو إلغاء سند صرف', category: 'سندات الصرف', description: 'إلغاء سند صرف واسترجاع النقدية للخزينة ورصيد المورد', actionType: 'delete' },
  { id: 'payments_export', name: 'طباعة وتصدير سندات الصرف', category: 'سندات الصرف', description: 'طباعة إيصالات الصرف وتصدير سجل المدفوعات', actionType: 'export' },

  // 13. المصروفات (Expenses)
  { id: 'expenses_view', name: 'استعراض سجل المصروفات التشغيلية', category: 'المصروفات', description: 'عرض قيود المصروفات العمومية والتشغيلية والإيجارات', actionType: 'view' },
  { id: 'expenses_manage', name: 'تسجيل وبناء قيود المصروفات', category: 'المصروفات', description: 'تسجيل وتبويب بنود المصروفات والكهرباء والصيانة', actionType: 'create' },
  { id: 'expenses_delete', name: 'حذف قيود المصروفات', category: 'المصروفات', description: 'حذف قيود المصروفات الخاطئة وتسوية الخزينة', actionType: 'delete' },
  { id: 'expenses_export', name: 'تصدير كشوف المصروفات', category: 'المصروفات', description: 'تصدير تقرير المصروفات المبوبة إلى Excel و PDF', actionType: 'export' },

  // 14. الحسابات العامة (Accounting)
  { id: 'accounts_view', name: 'استعراض شجرة الحسابات والدليل', category: 'الحسابات العامة', description: 'استعراض الدليل المحاسبي الشجري والحسابات العامة', actionType: 'view' },
  { id: 'daily_entries', name: 'دفتر القيود اليومية المحاسبية', category: 'الحسابات العامة', description: 'إنشاء وترحيل القيود اليومية المزدوجة', actionType: 'create' },
  { id: 'trial_balance', name: 'ميزان المراجعة والقوائم الختامية', category: 'الحسابات العامة', description: 'استعراض ميزان المراجعة، الأرباح والخسائر، والميزانية العمومية', actionType: 'view' },
  { id: 'year_end_closing', name: 'الإقفال السنوي وترحيل الأرصدة', category: 'الحسابات العامة', description: 'إغلاق السنة المالية وترحيل الأرصدة الافتتاحية للمدة الجديدة', actionType: 'approve' },
  { id: 'accounting_export', name: 'تصدير القوائم ودفتر الأستاذ', category: 'الحسابات العامة', description: 'تصدير القوائم المالية وموازين المراجعة إلى Excel و PDF', actionType: 'export' },

  // 15. التقارير والذكاء المالي (Reports)
  { id: 'reports_view', name: 'استعراض التقارير المالية والإدارية', category: 'التقارير', description: 'الوصول لكافة تقارير المبيعات، المشتريات، والأرباح وحركة الصناديق', actionType: 'view' },
  { id: 'reports_export', name: 'تصدير التقارير (Excel / PDF)', category: 'التقارير', description: 'تصدير التقارير إلى ملفات إكسل وطباعتها ورقياً', actionType: 'export' },
  { id: 'bi_analytics', name: 'تحليلات ذكاء الأعمال BI', category: 'التقارير', description: 'مؤشرات الأداء وتحليل الربحية والمنتجات الأكثر مبيعاً ونمو المبيعات', actionType: 'view' },

  // 16. المتجر والكتالوج والمناديب
  { id: 'website_catalog', name: 'المتجر الإلكتروني وطلبات الويب', category: 'المتجر الإلكتروني', description: 'إدارة منتجات وأسعار الكتالوج واستقبال طلبات الزبائن', actionType: 'edit' },
  { id: 'sales_reps', name: 'مناديب المبيعات وعمولات التحصيل', category: 'المناديب والموارد', description: 'إدارة المناديب وتحديد نسب العمولات وسقف البيع والتحصيل', actionType: 'edit' },
  { id: 'hr_payroll', name: 'شؤون الموظفين والرواتب', category: 'المناديب والموارد', description: 'سجلات الموظفين ومسيرات الرواتب والسلف والخصومات', actionType: 'edit' },

  // 17. إدارة المستخدمين والصلاحيات (Users)
  { id: 'users_view', name: 'استعراض سجل ودليل المستخدمين', category: 'إدارة المستخدمين', description: 'عرض قائمة المستخدمين والموظفين المسجلين بالشركة', actionType: 'view' },
  { id: 'users_manage', name: 'إدارة وتعديل المستخدمين وتوزيع الصلاحيات', category: 'إدارة المستخدمين', description: 'إضافة حسابات موظفين جديدة وتعيين أو تعديل الصلاحيات', actionType: 'edit' },
  { id: 'users_delete', name: 'حذف وتعطيل حسابات المستخدمين', category: 'إدارة المستخدمين', description: 'حذف أو تعطيل حساب مستخدم لمنعه من الدخول', actionType: 'delete' },

  // 18. إعدادات النظام وسجل الأمان (Settings & Audit Logs)
  { id: 'company_settings', name: 'إعدادات الشركة والفرع والضرائب', category: 'إعدادات النظام', description: 'بيانات الفاتورة، اللوجو، الضرائب، وترويسة الطباعة', actionType: 'edit' },
  { id: 'backup_export', name: 'النسخ الاحتياطي وتصدير البيانات', category: 'إعدادات النظام', description: 'إنشاء واستعادة النسخ الاحتياطية وتصدير البيانات الشاملة', actionType: 'export' },
  { id: 'audit_trail', name: 'سجل التدقيق الرقابي والأمان (Audit Trail)', category: 'إعدادات النظام', description: 'متابعة سجل حركات المستخدمين ومن قام بكل عملية قبل وبعد', actionType: 'view' },
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

  // 3. Direct boolean or object permission
  const permValue = user.permissions?.[permissionId];
  if (typeof permValue === 'boolean') return permValue;
  if (typeof permValue === 'object' && permValue !== null) {
    return !!(permValue as any).view || !!(permValue as any).create || !!(permValue as any).edit || !!(permValue as any).delete;
  }

  // 4. Aliased permission checks (e.g. customers_manage grants customers_view/create/edit)
  if (permissionId.startsWith('customers_') && user.permissions?.['customers_manage']) return true;
  if (permissionId.startsWith('suppliers_') && user.permissions?.['suppliers_manage']) return true;
  if (permissionId.startsWith('sales_') && user.permissions?.['sales_create'] && permissionId === 'sales_view') return true;
  if (permissionId.startsWith('purchases_') && user.permissions?.['purchases_create'] && permissionId === 'purchases_view') return true;
  if (permissionId.startsWith('items_') && user.permissions?.['items_view'] && permissionId === 'inventory_view') return true;
  if (permissionId === 'receipts_create' && user.permissions?.['cash_receipt']) return true;
  if (permissionId === 'payments_create' && user.permissions?.['cash_payment']) return true;
  if (permissionId === 'expenses_create' && user.permissions?.['cash_payment']) return true;

  // 5. Default role-based fallbacks if granular permissions not explicitly saved yet
  const role = user.role;
  if (role === 'cashier') {
    const cashierAllowed = [
      'dashboard',
      'pos_access',
      'sales_view',
      'sales_create',
      'sales_returns',
      'items_view',
      'cash_receipt',
      'receipts_create',
      'customers_view',
    ];
    return cashierAllowed.includes(permissionId);
  }
  if (role === 'warehouse_keeper') {
    const warehouseAllowed = [
      'dashboard',
      'inventory_view',
      'items_view',
      'items_create',
      'items_edit',
      'inventory_stocktaking',
      'inventory_transfers',
      'purchases_view',
      'purchases_create',
      'warehouses_manage',
    ];
    return warehouseAllowed.includes(permissionId);
  }
  if (role === 'accountant') {
    const accountantDisallowed = ['users_manage', 'company_settings', 'owner'];
    return !accountantDisallowed.includes(permissionId);
  }
  if (role === 'sales_rep') {
    const repAllowed = [
      'dashboard',
      'sales_create',
      'sales_view',
      'quotes_orders',
      'customers_view',
      'customers_create',
      'customers_manage',
      'items_view',
      'cash_receipt',
      'receipts_create',
    ];
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
  accounts: ['customers_manage', 'customers_view', 'suppliers_manage', 'suppliers_view', 'accounts_view'],
  accounts_tree: ['accounts_view'],
  branches: ['company_settings', 'warehouses_manage'],
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
  profit_report: ['reports_view', 'trial_balance'],
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
 * Supports isolated Owner session context without changing the tenant user's role.
 */
export function canAccessPage(
  user: User | undefined,
  pageId: string,
  hasActiveOwnerSession: boolean = false
): boolean {
  if (!user) return true;

  // 1. Owner panel is strictly reserved for an authenticated Owner session or native owner role
  if (pageId === 'owner_panel') {
    return hasActiveOwnerSession === true || user.role === 'owner';
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
 * 🛡️ Data-Operation Level Enforcement:
 * Prevents unauthorized users from creating, modifying, or deleting records even if they attempt
 * to invoke state or mutation methods directly.
 */
export function verifyDataOperationPermission(
  user: User | undefined,
  actionInfo?: { action?: string; module?: string; details?: string; deletedId?: string | number }
): { allowed: boolean; reason?: string } {
  if (!user) return { allowed: true };
  if (isAdminUser(user) || user.permissions?.all === true) return { allowed: true };

  const action = (actionInfo?.action || '').toLowerCase();
  const moduleName = (actionInfo?.module || '').toLowerCase();
  const details = (actionInfo?.details || '').toLowerCase();

  // 1. Sales Operations
  if (
    action === 'delete_sale' ||
    action === 'delete_invoice' ||
    ((moduleName.includes('مبيع') || details.includes('فاتورة بيع')) && (action.includes('حذف') || action === 'delete'))
  ) {
    if (!hasPermission(user, 'sales_delete')) {
      return { allowed: false, reason: 'عفواً، حسابك لا يمتلك صلاحية حذف فواتير المبيعات!' };
    }
  }

  if (
    action === 'edit_sale' ||
    action === 'update_invoice' ||
    ((moduleName.includes('مبيع') || details.includes('فاتورة بيع')) && (action.includes('تعديل') || action === 'update'))
  ) {
    if (!hasPermission(user, 'sales_edit')) {
      return { allowed: false, reason: 'عفواً، حسابك لا يمتلك صلاحية تعديل فواتير المبيعات!' };
    }
  }

  if (
    action === 'create_sale' ||
    ((moduleName.includes('مبيع') || details.includes('فاتورة بيع')) && (action.includes('إنشاء') || action.includes('إضافة') || action === 'create'))
  ) {
    if (!hasPermission(user, 'sales_create') && !hasPermission(user, 'pos_access')) {
      return { allowed: false, reason: 'عفواً، حسابك لا يمتلك صلاحية إنشاء فواتير مبيعات!' };
    }
  }

  // 2. Purchases Operations
  if (
    action === 'delete_purchase' ||
    ((moduleName.includes('مشتر') || details.includes('فاتورة توريد') || details.includes('فاتورة شراء')) && (action.includes('حذف') || action === 'delete'))
  ) {
    if (!hasPermission(user, 'purchases_delete')) {
      return { allowed: false, reason: 'عفواً، حسابك لا يمتلك صلاحية حذف فواتير المشتريات!' };
    }
  }

  if (
    action === 'create_purchase' ||
    ((moduleName.includes('مشتر') || details.includes('توريد')) && (action.includes('إنشاء') || action.includes('إضافة') || action === 'create'))
  ) {
    if (!hasPermission(user, 'purchases_create')) {
      return { allowed: false, reason: 'عفواً، حسابك لا يمتلك صلاحية تسجيل فواتير المشتريات!' };
    }
  }

  // 3. Customers & Suppliers
  if (moduleName.includes('عملا') && (action.includes('حذف') || action === 'delete')) {
    if (!hasPermission(user, 'customers_delete') && !hasPermission(user, 'customers_manage')) {
      return { allowed: false, reason: 'عفواً، حسابك لا يمتلك صلاحية حذف سجلات العملاء!' };
    }
  }

  if (moduleName.includes('مورد') && (action.includes('حذف') || action === 'delete')) {
    if (!hasPermission(user, 'suppliers_delete') && !hasPermission(user, 'suppliers_manage')) {
      return { allowed: false, reason: 'عفواً، حسابك لا يمتلك صلاحية حذف سجلات الموردين!' };
    }
  }

  // 4. Items & Inventory
  if (action === 'delete_item' || ((moduleName.includes('صنف') || moduleName.includes('مخزن')) && (action.includes('حذف') || action === 'delete'))) {
    if (!hasPermission(user, 'items_delete')) {
      return { allowed: false, reason: 'عفواً، حسابك لا يمتلك صلاحية حذف الأصناف من المخزن!' };
    }
  }

  if (action === 'create_item' || ((moduleName.includes('صنف') || moduleName.includes('مخزن')) && (action.includes('إضافة') || action === 'create'))) {
    if (!hasPermission(user, 'items_create')) {
      return { allowed: false, reason: 'عفواً، حسابك لا يمتلك صلاحية إضافة أصناف جديدة!' };
    }
  }

  // 5. Cash & Treasury Receipts and Payments
  if (
    action === 'cash_receipt' ||
    action === 'create_receipt' ||
    details.includes('سند قبض') ||
    details.includes('إيصال قبض')
  ) {
    if (!hasPermission(user, 'cash_receipt') && !hasPermission(user, 'receipts_create')) {
      return { allowed: false, reason: 'عفواً، حسابك لا يمتلك صلاحية إصدار سندات قبض النقدية!' };
    }
  }

  if (
    action === 'cash_payment' ||
    action === 'create_payment' ||
    details.includes('سند صرف') ||
    details.includes('إيصال صرف')
  ) {
    if (!hasPermission(user, 'cash_payment') && !hasPermission(user, 'payments_create')) {
      return { allowed: false, reason: 'عفواً، حسابك لا يمتلك صلاحية إصدار سندات صرف النقدية!' };
    }
  }

  // 6. Expenses Operations
  if (moduleName.includes('مصروف') || action.includes('expense') || details.includes('مصروف')) {
    if (action.includes('حذف') || action === 'delete' || action === 'delete_expense') {
      if (!hasPermission(user, 'expenses_delete') && !hasPermission(user, 'expenses_manage')) {
        return { allowed: false, reason: 'عفواً، حسابك لا يمتلك صلاحية حذف قيود المصروفات!' };
      }
    } else if (action.includes('إضافة') || action.includes('إنشاء') || action === 'create' || action === 'create_expense') {
      if (!hasPermission(user, 'expenses_manage') && !hasPermission(user, 'cash_payment')) {
        return { allowed: false, reason: 'عفواً، حسابك لا يمتلك صلاحية تسجيل المصروفات!' };
      }
    }
  }

  // 7. General Accounting & Journal Entries
  if (moduleName.includes('قيد') || moduleName.includes('يومية') || action.includes('entry') || details.includes('قيد يومي')) {
    if (!hasPermission(user, 'daily_entries') && !hasPermission(user, 'accounts_view')) {
      return { allowed: false, reason: 'عفواً، حسابك لا يمتلك صلاحية تسجيل أو ترحيل القيود اليومية المحاسبية!' };
    }
  }

  // 8. Users & Roles
  if (moduleName.includes('مستخدم') || action.includes('user') || details.includes('مستخدم')) {
    if (!hasPermission(user, 'users_manage')) {
      return { allowed: false, reason: 'عفواً، إدارة وتعديل المستخدمين والصلاحيات مقتصرة على الإدارة فقط!' };
    }
  }

  // 9. System Settings
  if (moduleName.includes('إعداد') || action.includes('setting') || details.includes('إعدادات')) {
    if (!hasPermission(user, 'company_settings')) {
      return { allowed: false, reason: 'عفواً، تعديل إعدادات المنشأة مقتصر على الإدارة فقط!' };
    }
  }

  return { allowed: true };
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
