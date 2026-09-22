export interface Settings {
  companyName: string;
  address: string;
  phone1: string;
  phone2: string;
  phone3: string;
  taxNumber: string;
  notes: string;
  defaultTaxRate: number;
  currencySymbol: string;
  commercialReg?: string;
  activityCode?: string;
  withholdingTaxRate?: number;
  fiscalYear?: string;
  email?: string;
  website?: string;
  city?: string;
  country?: string;
  bankName?: string;
  bankAccountNumber?: string;
  iban?: string;
  logo?: string;
  logoUrl?: string;
  paperSize?: 'A4' | 'A5' | 'Letter' | 'auto';
  pageMargin?: number; // margin in mm (e.g. 0, 3, 5, 8, 10, 15)
  showLogoInPrint?: boolean;
  printerType?: 'standard' | 'thermal';
  companyId?: string;
  companyCode?: string;
  apiKey?: string;
}

export interface CustomerRepresentative {
  id: string;
  name: string;
  phone: string;
  jobTitle?: string;
  email?: string;
  notes?: string;
  isPrimary?: boolean;
}

export type UserRole = 'owner' | 'company_admin' | 'admin' | 'user' | 'cashier' | 'accountant' | 'warehouse_keeper' | 'sales_rep';

export interface ActionPermissions {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  approve: boolean;
  cancel: boolean;
  print: boolean;
  export: boolean;
  import: boolean;
  manage: boolean;
}

export type SystemModuleKey =
  | 'dashboard'
  | 'sales'
  | 'pos'
  | 'quotes_orders'
  | 'purchases'
  | 'inventory'
  | 'pricing'
  | 'cash'
  | 'treasury'
  | 'cheques'
  | 'accounts'
  | 'accounts_tree'
  | 'manufacturing'
  | 'hr_payroll'
  | 'fixed_assets'
  | 'sales_reps'
  | 'branches'
  | 'bank_reconciliation'
  | 'bi_analytics'
  | 'e_invoicing'
  | 'reports'
  | 'audit_trail'
  | 'year_end_closing'
  | 'users'
  | 'settings'
  | 'backup';

export interface User {
  id: string;
  uid?: string; // معرف فريد مشتق ومربوط بالشركة لمنع تسريب البيانات
  code?: string | number; // كود المستخدم داخل الشركة (كود 1 للمدير، كود 2، 3...)
  userCode?: string | number; // كود المستخدم الصريح
  companyId?: string;
  companyCode?: string;
  name: string;
  username: string;
  password?: string;
  phone?: string;
  email?: string;
  role: UserRole;
  avatar?: string;
  status?: 'active' | 'disabled';
  permissions?: Record<string, boolean | Partial<ActionPermissions>>;
  allowedBranches?: string[];
  allowedWarehouses?: string[];
  branchId?: string;
  lastLogin?: string;
  createdAt?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  balance: number;
  taxNumber?: string;
  commercialReg?: string;
  address?: string;
  priceTier?: 'retail' | 'wholesale' | 'special';
  creditLimit?: number;
  creditPeriodDays?: number;
  paymentGracePeriodDays?: number;
  transactions?: any[];
  representatives?: CustomerRepresentative[];
  selectedRepId?: string;
  notes?: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  balance: number;
  taxNumber?: string;
  commercialReg?: string;
  address?: string;
  transactions?: any[];
  representatives?: CustomerRepresentative[];
  selectedRepId?: string;
  notes?: string;
}

export interface ItemBatch {
  id: string;
  batchNumber: string;
  expiryDate: string;
  qty: number;
  purchasePrice: number;
}

export interface ItemMovement {
  date: string;
  type: 'sale' | 'purchase' | 'return_sale' | 'return_purchase' | 'adjustment' | 'transfer_in' | 'transfer_out';
  qty: number;
  quantity?: number;
  price: number;
  total: number;
  note: string;
  branchName?: string;
  batchNumber?: string;
}

export interface Item {
  id: string;
  code?: string;
  name: string;
  barcode?: string;
  category?: string;
  unit?: string;
  description?: string;
  quantity: number;
  purchasePrice: number;
  salePrice: number;
  price?: number;
  costPrice?: number;
  wholesalePrice?: number;
  normalSellingPrice?: number; // Synced with salePrice (سعر البيع النقدي)
  wholesaleSellingPrice?: number; // Synced with wholesalePrice (سعر البيع بالجملة)
  minStockAlert?: number;
  costMethod?: 'fifo' | 'avg';
  batches?: ItemBatch[];
  serialNumbers?: string[];
  branchStock?: Record<string, number>;
  movements?: ItemMovement[];
  lastPriceUpdate?: string;
  lastPriceUpdatedBy?: string;

  // Online Catalog & Multi-Company Specifics
  material?: string; // نوع الخامة أو القماش أو المادة أو المواصفة المحددة (قطن، صوف، خشب، حديد...)
  showInCatalog?: boolean; // هل يظهر الصنف في الكتالوج / الويب سايت
  catalogPrice?: number; // سعر البيع المخصص للويب سايت (إذا رغبت الشركة بسعر مختلف)
  catalogWholesalePrice?: number; // سعر الجملة المخصص للكتالوج
  catalogDiscountPrice?: number; // سعر العرض الترويجي المخفض
  catalogFeatured?: boolean; // منتج مميز يظهر في أعلى الكتالوج
  catalogBadge?: string; // شارة ترويجية (مثل: الأكثر طلباً، عرض خاص، جديد)
  catalogDescription?: string; // وصف تسويقي مخصص للعملاء على الويب سايت
  imageUrl?: string; // صورة المنتج
  companyId?: string; // معرف الشركة المالكة للعزل التام بين الشركات
}

export interface InvoiceItem {
  itemId?: string;
  name: string;
  qty: number;
  price: number;
  costPrice?: number;
  total: number;
  notes?: string; // البيان أو الملاحظة الخاصة بالصنف
  statement?: string; // بيان بديل
  discount?: number; // قيمة الخصم المحسوبة
  discountType?: 'percent' | 'fixed'; // نسبة مئوية % أو مبلغ ثابت
  discountValue?: number; // القيمة المدخلة للخصم
  tax?: number; // قيمة الضريبة المحسوبة
  taxType?: 'percent' | 'fixed'; // نسبة مئوية % أو مبلغ ثابت
  taxValue?: number; // القيمة المدخلة للضريبة
  batchNumber?: string;
  serialNumber?: string;
  priceType?: 'cash' | 'wholesale' | 'custom';
  priceSource?: 'price_management' | 'manual_override';
}

export interface SaleInvoice {
  id: number;
  customerName: string;
  phone?: string;
  customerRepId?: string;
  customerRepName?: string;
  customerRepPhone?: string;
  customerCompany?: string;
  customerAddress?: string;
  customerTaxNumber?: string;
  salesRep?: string;
  salesRepId?: string;
  notes?: string;
  date: string;
  time?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  discountType?: 'percent' | 'fixed';
  discountValue?: number;
  tax: number;
  taxType?: 'percent' | 'fixed';
  taxValue?: number;
  extraRevenueName?: string; // اسم الإيراد الإضافي للفاتورة
  extraRevenueAmount?: number; // مبلغ الإيراد الإضافي للفاتورة
  withholdingTax?: number;
  fees: number;
  total: number;
  paymentMethod: 'drawer' | 'vodafone' | 'instapay' | 'bank' | 'split';
  type: 'nagdi' | 'ajel' | 'return_nagdi' | 'return_ajel';
  salesType?: 'cash' | 'wholesale'; // نوع البيع: نقدي أو جملة لتحديد التسعيرة المطبقة
  paidAmount: number;
  remainingAmount: number;
  createdAt: string;
  createdBy: string;
  createdByUserId?: string;
  createdByUserCode?: string | number;
  updatedAt?: string;
  updatedBy?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  companyId?: string;
  branchId?: string;
  warehouseId?: string;
  costCenter?: string;
  status?: 'draft' | 'approved' | 'cancelled';
  eInvoiceUuid?: string;
  eInvoiceStatus?: 'valid' | 'submitted' | 'pending';
  eInvoiceQr?: string;
}

export interface PurchaseInvoice {
  id: number;
  supplierName: string;
  phone?: string;
  supplierRepId?: string;
  supplierRepName?: string;
  supplierRepPhone?: string;
  supplierCompany?: string;
  salesRep?: string;
  notes?: string;
  date: string;
  time?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  discountType?: 'percent' | 'fixed';
  discountValue?: number;
  tax: number;
  taxType?: 'percent' | 'fixed';
  taxValue?: number;
  extraRevenueName?: string; // اسم الإيراد أو المصروف الإضافي
  extraRevenueAmount?: number; // مبلغ الإيراد أو المصروف الإضافي
  withholdingTax?: number;
  fees: number;
  total: number;
  paymentMethod: 'drawer' | 'vodafone' | 'instapay' | 'bank';
  type: 'nagdi' | 'ajel' | 'return_nagdi' | 'return_ajel';
  paidAmount?: number;
  remainingAmount?: number;
  createdAt: string;
  createdBy: string;
  createdByUserId?: string;
  createdByUserCode?: string | number;
  updatedAt?: string;
  updatedBy?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  companyId?: string;
  branchId?: string;
  warehouseId?: string;
  costCenter?: string;
  status?: 'draft' | 'approved' | 'cancelled';
}

export interface CashTransaction {
  id: number;
  date: string;
  type: 'receive' | 'pay' | 'deposit' | 'withdraw';
  method: 'drawer' | 'vodafone' | 'instapay' | 'bank';
  amount: number;
  note: string;
  customerName?: string;
  supplierName?: string;
  invoiceId?: number;
  createdBy?: string;
  accountCode?: string;
  costCenter?: string;
}

export interface CashBox {
  drawer: number;
  vodafone: number;
  instapay: number;
  bank: number;
}

export interface SalesRep {
  id: string;
  code?: string;
  name: string;
  phone: string;
  region?: string;
  totalSales?: number;
  totalSalesAchieved?: number;
  commission?: number;
  totalCommissionsEarned?: number;
  targetSales?: number;
  targetPeriod?: 'monthly' | 'quarterly' | 'yearly';
  commissionRate?: number;
  commissionType?: 'percentage_of_sales' | 'percentage_of_collection' | 'fixed_monthly';
  status?: 'active' | 'inactive';
  notes?: string;
}

export interface BankAccount {
  id: string;
  name: string;
  bankName?: string;
  accountNumber: string;
  balance: number;
}

export interface AutoBackupConfig {
  enabled: boolean;
  intervalMinutes: number; // 15, 30, 60, 120, 360, 1440
  autoDownloadFile: boolean;
  maxSnapshotsToKeep: number;
  lastBackupTimestamp?: string;
  backupLocation?: 'browser_storage' | 'auto_download' | 'both';
  notifyOnBackup?: boolean;
}

export interface BackupRecord {
  id?: string;
  date: string;
  timestamp?: string;
  code?: string;
  label?: string;
  type?: 'auto' | 'manual' | 'pre_restore' | 'file_export';
  sizeKB?: number;
  sizeKb?: number;
  counts?: any;
  dataPreview?: {
    invoicesCount: number;
    purchasesCount: number;
    customersCount: number;
    itemsCount: number;
    journalEntriesCount: number;
  };
  snapshotJson?: string;
}

// 1. Core Accounting & Chart of Accounts
export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export interface AccountNode {
  code: string;
  name: string;
  type: AccountType;
  parentCode?: string;
  isParent: boolean;
  debit: number;
  credit: number;
  balance: number;
  description?: string;
}

export interface JournalLine {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  note?: string;
  costCenter?: string;
}

export interface JournalEntry {
  id: number;
  date: string;
  entryNumber: string;
  reference?: string;
  description: string;
  lines: JournalLine[];
  source: 'manual' | 'sales' | 'purchase' | 'cash' | 'inventory' | 'pos';
  createdBy: string;
  createdAt: string;
  isApproved: boolean;
}

export interface CostCenter {
  id: string;
  code: string;
  name: string;
  manager?: string;
}

// 2. Branches & Transfers
export interface Branch {
  id: string;
  code: string;
  name: string;
  location: string;
  phone: string;
  isMain: boolean;
  manager?: string;
}

export interface StockTransfer {
  id: number;
  transferNumber?: string;
  date: string;
  fromBranch: string;
  toBranch: string;
  fromBranchName?: string;
  toBranchName?: string;
  itemId?: string;
  itemName?: string;
  quantity?: number;
  items: {
    itemId: string;
    itemName: string;
    qty: number;
    cost: number;
  }[];
  note?: string;
  createdBy: string;
  status: 'completed' | 'pending';
}

// 3. Quotes & Sales/Purchase Orders Pipeline
export interface Quotation {
  id: number;
  type: 'sale_quote' | 'purchase_order';
  clientName: string;
  phone?: string;
  repId?: string;
  repName?: string;
  repPhone?: string;
  date: string;
  validUntil?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: 'draft' | 'sent' | 'converted' | 'cancelled' | 'online_order';
  source?: 'direct' | 'online_catalog' | 'pos';
  customerAddress?: string;
  orderReference?: string;
  deliveryNotes?: string;
  notes?: string;
  createdBy: string;
  convertedInvoiceId?: number;
  companyId?: string; // الشركة المالكة للطلب للعزل التام
  orderStatus?: 'new' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'converted'; // حالة دورة الطلب الإلكتروني
  autoPrinted?: boolean; // هل تم طباعة الإيصال آلياً فور وصوله
  isRead?: boolean; // هل تم فتح والاطلاع على الطلب في لوحة التحكم
  time?: string; // توقيت استلام الطلب
}

// Online Product Catalog Configuration (كتالوج المنتجات والمتجر الإلكتروني)
export interface CatalogConfig {
  enabled: boolean;
  storeName?: string;
  storeDescription?: string;
  contactPhone?: string;
  whatsappNumber?: string;
  allowOnlineOrders?: boolean;
  priceDisplayMode?: 'retail_only' | 'wholesale_only' | 'both';
  showStockStatus?: boolean;
  showExactStockQty?: boolean;
  bannerMessage?: string;
  minOrderAmount?: number;
  currencySymbol?: string;
  autoPrintOrders?: boolean; // تفعيل الطباعة الفورية التلقائية للطلبات الواردة من الويب سايت
  printFormat?: '80mm' | 'a4'; // صيغة الطباعة: بون حراري 80mm أو نموذج A4
  soundAlertEnabled?: boolean; // تشغيل نغمة تنبيه صوتية عند استلام طلب جديد
  companyId?: string; // عزل الإعدادات للشركة المحددة
  isMarketplacePublished?: boolean; // ظهور منتجات الشركة في المتجر الموحد (أمازون)
  storeSubscriptionStatus?: 'trial' | 'active' | 'pending_payment' | 'inactive'; // حالة اشتراك المتجر الإلكتروني (1000 ج.م)
  storeSubscriptionPaid?: boolean;
  storeSubscriptionAmount?: number; // قيمة الاشتراك 1000 ج.م
  storeSubscriptionPaidAt?: string;
  storeSlug?: string; // رابط فريد باسم الشركة
  ownerContactPhone?: string; // رقم هاتف المالك للتفعيل
  ownerContactWhatsapp?: string; // واتساب المالك للتفعيل
}

// 4. Audit Trail & Security
export interface AuditLog {
  id: string;
  timestamp: string;
  userName: string;
  userId?: string;
  userCode?: string | number; // كود المستخدم (كود 1 للمدير، كود 2، 3...)
  userRole?: string;
  companyId?: string;
  action: 'create' | 'update' | 'delete' | 'print' | 'approval' | 'login' | 'transfer' | string;
  module: string;
  details: string;
  ipOrDevice?: string;
}

// 5. E-Invoicing & Tax Config
export interface EInvoiceConfig {
  taxRegNumber: string;
  commercialRegNumber: string;
  branchCode: string;
  activityCode: string;
  posSerial: string;
  isEtaConnected: boolean;
  autoGenerateQr: boolean;
}

// 6. HR & Payroll (الموارد البشرية والرواتب)
export interface Employee {
  id: string;
  code: string;
  name: string;
  phone: string;
  nationalId?: string;
  department: string;
  jobTitle: string;
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  otherAllowances: number;
  insuranceDeduction: number;
  taxDeduction: number;
  hireDate: string;
  status: 'active' | 'on_leave' | 'terminated';
  bankAccount?: string;
  notes?: string;
}

export interface PayrollSlip {
  id: number;
  slipNumber: string;
  month: string; // YYYY-MM
  employeeId: string;
  employeeName: string;
  department: string;
  basicSalary: number;
  allowances: number;
  bonuses: number;
  overtime: number;
  grossSalary: number;
  deductions: number;
  advancesDeducted: number;
  netSalary: number;
  status: 'draft' | 'approved' | 'paid';
  paymentDate?: string;
  paymentMethod?: 'drawer' | 'bank' | 'vodafone' | 'instapay';
  journalEntryId?: number;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface EmployeeAdvance {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  totalAmount: number;
  monthlyDeduction: number;
  paidAmount: number;
  remainingAmount: number;
  installmentsCount: number;
  notes?: string;
  status: 'active' | 'completed';
}

// 7. Fixed Assets & Depreciation (الأصول الثابتة والإهلاكات)
export interface FixedAsset {
  id: string;
  code: string;
  name: string;
  category: 'equipment' | 'vehicles' | 'buildings' | 'furniture' | 'computers' | 'machinery' | 'other';
  purchaseDate: string;
  purchasePrice: number;
  salvageValue: number;
  usefulLifeYears: number;
  annualDepreciationRate: number; // percentage
  accumulatedDepreciation: number;
  netBookValue: number;
  location?: string;
  status: 'active' | 'disposed' | 'depreciated';
  notes?: string;
  assetAccountCode?: string;
  depExpenseAccountCode?: string;
  depAccumAccountCode?: string;
}

export interface DepreciationLog {
  id: string;
  assetId: string;
  assetName: string;
  date: string;
  fiscalYear: string;
  period: string; // e.g. "2026-08"
  amount: number;
  accumulatedBefore: number;
  accumulatedAfter: number;
  bookValueAfter: number;
  journalEntryId?: number;
  createdBy: string;
}

// 8. Cheques & Commercial Papers (إدارة الشيكات وأوراق القبض والدفع)
export interface Cheque {
  id: number;
  chequeNumber: string;
  bankName: string;
  drawerName: string; // الساحب (عميل أو المورد أو المنشأة)
  beneficiaryName: string; // المستفيد
  amount: number;
  issueDate: string;
  dueDate: string;
  type: 'receivable' | 'payable'; // ورقة قبض أو ورقة دفع
  status: 'received' | 'under_collection' | 'collected' | 'bounced' | 'endorsed' | 'cancelled';
  collectingBankAccountId?: string;
  endorsedToSupplier?: string;
  notes?: string;
  journalEntryIds?: number[];
  createdBy: string;
  createdAt: string;
}

export type SalesRepresentative = SalesRep;

// 9. Commissions & Rep Targets (عمولات المندوبين والمستهدفات)
export interface CommissionRecord {
  id: string;
  repId: string;
  salesRepId?: string;
  repName: string;
  salesRepName?: string;
  invoiceId?: number;
  invoiceNumber?: string;
  invoiceAmount?: number;
  amount: number;
  commissionAmount?: number;
  rate: number;
  date: string;
  type: 'sale' | 'collection';
  status: 'pending' | 'paid';
  paidDate?: string;
  paymentDate?: string;
  paidMethod?: 'drawer' | 'bank' | 'vodafone' | 'instapay';
}

// 10. Manufacturing & BOM (التصنيع وتكاليف الإنتاج)
export interface BOMRawItem {
  itemId: string;
  itemName: string;
  unit: string;
  qty?: number;
  quantity?: number;
  unitCost?: number;
  estimatedCost?: number;
  totalCost?: number;
}

export interface BOMIndirectCost {
  name: string;
  cost: number;
}

export interface BOM {
  id: string;
  code?: string;
  name: string;
  finishedItemId?: string;
  finishedItemName?: string;
  finishedProductName?: string;
  outputQty?: number;
  outputQuantity?: number;
  unit?: string;
  rawMaterials: BOMRawItem[];
  items?: BOMRawItem[];
  rawMaterialCost?: number;
  indirectCosts?: BOMIndirectCost[];
  laborCost?: number;
  overheadCost?: number;
  totalEstimatedCost?: number;
  totalUnitCost?: number;
  unitCost?: number;
  status?: 'active' | 'archived';
  notes?: string;
  createdAt?: string;
}

export interface ProductionOrder {
  id: number;
  orderNumber: string;
  date?: string;
  startDate?: string;
  bomId: string;
  bomName?: string;
  finishedItemId?: string;
  finishedItemName?: string;
  finishedProductName?: string;
  targetQty?: number;
  targetQuantity?: number;
  producedQuantity?: number;
  actualProducedQty?: number;
  status: 'draft' | 'planned' | 'in_progress' | 'completed' | 'cancelled';
  rawMaterialsConsumed?: BOMRawItem[];
  indirectCostsTotal?: number;
  estimatedCost?: number;
  actualCost?: number;
  totalCost?: number;
  unitCost?: number;
  sourceBranchId?: string;
  destinationBranchId?: string;
  notes?: string;
  createdBy?: string;
  createdAt?: string;
  completedAt?: string;
  journalEntryId?: number;
}

// 11. Bank Reconciliation (التسوية والمطابقة البنكية)
export interface BankStatementItem {
  id: string;
  bankAccountId: string;
  date: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  isReconciled: boolean;
  systemTransactionId?: string;
  matchedDate?: string;
}

// 12. Approvals & Workflows (دورة الاعتمادات والموافقات)
export interface ApprovalRequest {
  id: string;
  module: 'sale' | 'purchase' | 'cash' | 'payroll' | 'production' | 'cheque';
  transactionId: number | string;
  transactionNumber: string;
  requestedBy: string;
  requestedAt: string;
  amount: number;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
}

// 13. Advanced Physical Inventory & Stocktaking Sessions (نظام الجرد الفعلي للمخازن)
export interface StocktakeItemRecord {
  itemId: string;
  itemName: string;
  barcode?: string;
  category?: string;
  unit?: string;
  bookQty: number;
  countedQty: number;
  varianceQty: number; // countedQty - bookQty
  costPrice: number;
  varianceCostTotal: number; // varianceQty * costPrice
  reason?: 'shortage_loss' | 'damage' | 'expired' | 'surplus_found' | 'entry_error' | 'routine_adjustment' | 'other';
  notes?: string;
  scannedAt?: string;
}

export interface StocktakeSession {
  id: string;
  sessionNumber: string; // e.g. "INV-2026-001"
  title: string;
  date: string;
  branchId?: string;
  branchName?: string;
  category?: string; // all or specific
  status: 'draft' | 'in_review' | 'approved_settled' | 'cancelled';
  items: StocktakeItemRecord[];
  totalItemsCounted: number;
  matchedItemsCount: number;
  shortageItemsCount: number;
  surplusItemsCount: number;
  totalShortageValue: number;
  totalSurplusValue: number;
  netVarianceValue: number;
  committeeMembers?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  settlementVoucherId?: string;
  journalEntryId?: number;
}

// 14. Inventory Adjustment & Settlement Voucher (سندات تسوية الجرد المحاسبية)
export interface InventoryAdjustmentVoucher {
  id: string;
  voucherNumber: string; // e.g. "ADJ-2026-001"
  stocktakeSessionId?: string;
  stocktakeSessionNumber?: string;
  date: string;
  branchId?: string;
  branchName?: string;
  type: 'mixed' | 'shortage_only' | 'surplus_only';
  status: 'posted' | 'reversed';
  items: {
    itemId: string;
    itemName: string;
    bookQtyBefore: number;
    adjustedQty: number;
    newStockQty: number;
    unitCost: number;
    totalAmount: number;
    varianceType: 'shortage' | 'surplus';
    reason: string;
  }[];
  totalShortageAmount: number;
  totalSurplusAmount: number;
  netAdjustmentAmount: number;
  journalEntryId?: number;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

// 14.b Goods Issue Note / Stock Issue Voucher (أذونات الصرف المخزني الرسمية)
export interface GoodsIssueItem {
  itemId?: string;
  code?: string;
  name: string;
  unit?: string;
  qty: number;
  unitCost: number;
  totalCost: number;
  notes?: string;
}

export interface GoodsIssueVoucher {
  id: string;
  voucherNumber: string; // e.g. "GIN-2026-088"
  date: string;
  time?: string;
  sourceBranchId?: string;
  sourceBranchName?: string;
  recipientName: string; // الجهة / المستلم (فرع المنتزه / قسم الصيانة / العميل)
  recipientType?: 'branch' | 'department' | 'customer' | 'maintenance' | 'production' | 'internal' | 'other';
  purposeReason: string; // السبب / الغرض من الصرف
  items: GoodsIssueItem[];
  totalQty: number;
  totalCost: number;
  createdBy: string;
  warehouseKeeper?: string;
  recipientSignatory?: string;
  approvedBy?: string;
  status: 'draft' | 'issued' | 'approved';
  journalEntryId?: number;
  referenceOrderNo?: string;
  notes?: string;
}

// 15. Fiscal Year & Annual Closing (الإقفال السنوي والترحيل المالي)
export interface FiscalYearClosingRecord {
  id: string;
  closingNumber: string; // e.g. "CLS-2025"
  fiscalYear: string; // e.g. "2025"
  nextFiscalYear: string; // e.g. "2026"
  closingDate: string;
  status: 'completed' | 'reopened';
  totalRevenues: number;
  totalExpenses: number;
  netProfitOrLoss: number; // positive = net profit, negative = net loss
  closedToAccountCode: string; // e.g. '3102' (Retained Earnings)
  closedToAccountName: string;
  closingJournalEntryId: number;
  openingJournalEntryId?: number;
  lockDateApplied: string;
  inventoryValueAtClosing: number;
  totalAssetsAtClosing: number;
  totalLiabilitiesAtClosing: number;
  totalEquityAtClosing: number;
  revenueAccountsBreakdown?: { code: string; name: string; balance: number }[];
  expenseAccountsBreakdown?: { code: string; name: string; balance: number }[];
  notes?: string;
  closedBy: string;
  closedAt: string;
  reopenedBy?: string;
  reopenedAt?: string;
  reopenReason?: string;
}

export interface FiscalYearInfo {
  year: string;
  isCurrent: boolean;
  isClosed: boolean;
  isArchived: boolean;
  statusText: string;
  closingRecord?: FiscalYearClosingRecord;
  invoicesCount?: number;
  totalRevenue?: number;
  netProfit?: number;
  closingDate?: string;
}

export interface AppData {
  settings: Settings;
  users: User[];
  currentUser: string;
  customers: Customer[];
  suppliers: Supplier[];
  items: Item[];
  salesInvoices: SaleInvoice[];
  purchaseInvoices: PurchaseInvoice[];
  cashTransactions: CashTransaction[];
  backups: BackupRecord[];
  autoBackupConfig?: AutoBackupConfig;
  nextInvoiceNumber: number;
  nextPurchaseNumber: number;
  nextCashId: number;
  cashBox: CashBox;
  salesReps: SalesRep[];
  bankAccounts: BankAccount[];
  physicalInventories: StocktakeSession[];
  inventoryAdjustments: InventoryAdjustmentVoucher[];
  goodsIssueVouchers?: GoodsIssueVoucher[];
  nextStocktakeId?: number;
  nextAdjustmentId?: number;
  nextGoodsIssueId?: number;
  advancedSettings: {
    categories: string[];
    itemGroups: string[];
    units: string[];
  };

  // Enterprise Modules Additions:
  accounts: AccountNode[];
  journalEntries: JournalEntry[];
  nextJournalId: number;
  costCenters: CostCenter[];
  branches: Branch[];
  activeBranchId: string;
  stockTransfers: StockTransfer[];
  quotations: Quotation[];
  nextQuoteId: number;
  auditLogs: AuditLog[];
  eInvoiceConfig: EInvoiceConfig;
  fiscalLockDate?: string;
  viewingClosedYear?: string; // السنة المالية المغلقة الجاري تصفحها كأرشيف للقراءة فقط
  currentActiveFiscalYear?: string; // السنة المالية النشطة الحالية للتبديل والعودة السريعة
  fiscalClosings?: FiscalYearClosingRecord[]; // سجل ومحاضر إقفال السنوات المالية
  nextClosingId?: number;

  // New Comprehensive Modules:
  employees: Employee[];
  payrollSlips: PayrollSlip[];
  nextPayrollId: number;
  employeeAdvances: EmployeeAdvance[];
  fixedAssets: FixedAsset[];
  depreciationLogs: DepreciationLog[];
  cheques: Cheque[];
  nextChequeId: number;
  commissions: CommissionRecord[];
  commissionRecords?: CommissionRecord[];
  boms: BOM[];
  productionOrders: ProductionOrder[];
  workOrders?: ProductionOrder[];
  nextProductionId: number;
  nextProductionOrderId?: number;
  bankStatements: BankStatementItem[];
  bankStatementItems?: BankStatementItem[];
  approvalRequests: ApprovalRequest[];

  // 16. Price Management Module (إدارة الأسعار المركزية)
  productPrices?: ProductPrice[];
  priceHistories?: PriceHistoryRecord[];

  // 17. Multi-Tenant SaaS & Owner Platform Architecture
  catalogConfig?: CatalogConfig;
  companyCatalogConfigs?: Record<string, CatalogConfig>;
  companyId?: string;
  tenantId?: string;
  isOwnerAuthenticated?: boolean;
  companies?: TenantCompany[];
  plans?: SubscriptionPlan[];
  licenses?: LicenseRecord[];
  trialRegistry?: TrialRegistryRecord[];
  exportAuditLogs?: ExportAuditLog[];
  supportSessions?: SupportAccessSession[];
  currentSupportSession?: SupportAccessSession;

  // 18. Dashboard Customization & User Preferences
  userDashboardWidgets?: Record<string, DashboardWidgetConfig[]>;

  // 19. Global & Egyptian Enterprise Extensions
  crmLeads?: CrmLead[];
  serialRecords?: SerialItemRecord[];
  currencies?: CurrencyDef[];
  exchangeRates?: ExchangeRate[];
  multiCurrencyConfig?: MultiCurrencyConfig;
}

export type DashboardWidgetId =
  | 'banner'
  | 'quick_actions'
  | 'reorder_alerts'
  | 'core_metrics_grid'
  | 'financial_kpis'
  | 'enterprise_shortcuts'
  | 'recent_sales'
  | 'cash_liquidity';

export interface DashboardWidgetConfig {
  id: DashboardWidgetId;
  label: string;
  description: string;
  icon: string;
  visible: boolean;
  order: number;
}

export interface ReorderAlertItem {
  item: Item;
  currentStock: number;
  minStockAlert: number;
  deficit: number;
  suggestedOrderQty: number;
  estimatedCost: number;
  status: 'critical' | 'warning';
}

export type CompanyStatus = 'active' | 'trial' | 'suspended' | 'expired' | 'archived';
export type PlanType = 'trial' | 'monthly' | 'semi_annual' | 'annual' | 'lifetime' | 'custom';

export interface SubscriptionLimits {
  maxUsers: number;
  maxBranches: number;
  maxWarehouses: number;
  maxTransactionsPerMonth: number;
  storageMb: number;
  maxSalesReps: number;
}

export interface SubscriptionPlan {
  id: string;
  code: string;
  name: string;
  nameEn: string;
  durationDays: number;
  price: number;
  currency: string;
  badge: string;
  badgeColor: string;
  description: string;
  features: string[];
  limits: SubscriptionLimits;
  isDefaultTrial?: boolean;
  isPopular?: boolean;
}

export interface TenantCompany {
  id: string; // e.g. COMP-000001
  uid?: string; // معرف فريد مشتق لعزل بيانات الشركة في السحابة
  tenantId?: string; // e.g. TENANT-8829-AF1
  code?: string; // e.g. 101 or RKZ-001
  companyCode?: string; // كود الشركة الصريح
  name: string;
  tradeName?: string;
  activity?: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  taxNumber?: string;
  commercialReg?: string;
  adminName?: string;
  adminPhone?: string;
  adminEmail?: string;
  adminUsername?: string;
  adminPassword?: string;
  status: CompanyStatus;
  planId?: string;
  planName?: string;
  plan?: any;
  subscriptionId?: string;
  licenseId?: string;
  apiKey?: string;
  createdAt?: string;
  trialStartedAt?: string;
  trialExpiresAt?: string;
  trialEndsAt?: string;
  subscriptionStartedAt?: string;
  subscriptionExpiresAt?: string;
  limits?: SubscriptionLimits;
  features?: string[];
  usersCount?: number;
  maxUsers?: number;
  activeUsersCount?: number;
  branchesCount?: number;
  warehousesCount?: number;
  operationsCount?: number;
  lastActivityAt?: string;
  notes?: string;
  isSupportAccessActive?: boolean;
  storeSubscriptionStatus?: 'trial' | 'active' | 'pending_payment' | 'inactive';
  storeSubscriptionPaid?: boolean;
  storeSubscriptionAmount?: number;
  storeSubscriptionPaidAt?: string;
  ecommerceActive?: boolean;
  ecommerceStatus?: 'active' | 'inactive' | 'pending';
  isMarketplacePublished?: boolean;
  catalogConfig?: CatalogConfig;
}

export interface LicenseRecord {
  id: string;
  activationCode: string; // e.g. RKZ-2026-X889-KL32-PQ11
  companyId: string;
  companyName: string;
  planId: string;
  planName: string;
  startDate: string;
  expiryDate: string;
  status: 'active' | 'expired' | 'revoked';
  features: string[];
  limits: SubscriptionLimits;
  generatedAt: string;
  generatedBy: string;
  activationCount?: number;
}

export interface TrialRegistryRecord {
  id: string;
  phone: string;
  email?: string;
  deviceFingerprint?: string;
  ipAddress?: string;
  companyId: string;
  companyName: string;
  trialStartedAt: string;
  trialExpiresAt: string;
  status: 'active' | 'expired' | 'converted';
  otpVerified: boolean;
  notes?: string;
}

export type ExportType = 'full_backup' | 'migration_excel' | 'migration_csv' | 'reports_pdf' | 'reports_excel';

export interface ExportAuditLog {
  id: string;
  exportedBy: string;
  exportedByRole: string;
  companyId: string;
  companyName: string;
  exportType: ExportType;
  fileName: string;
  fileSize: string;
  timestamp: string;
  status: 'success' | 'failed';
  recordsCount?: number;
}

export interface SupportAccessSession {
  id: string;
  ownerName: string;
  companyId: string;
  companyName: string;
  reason: string;
  startedAt: string;
  endedAt?: string;
  status: 'active' | 'closed';
  actionsPerformed: string[];
}

export interface ProductPrice {
  id: string;
  productId: string;
  productCode?: string;
  productBarcode?: string;
  productName?: string;
  category?: string;
  purchaseCost: number;
  normalSellingPrice: number; // سعر البيع النقدي (Cash Selling Price)
  wholesaleSellingPrice: number; // سعر البيع بالجملة (Wholesale Selling Price)
  minSellingPrice?: number;
  profitMarginNormalPercent?: number;
  profitMarginWholesalePercent?: number;
  updatedAt: string;
  updatedBy: string;
  notes?: string;
}

export interface PriceHistoryRecord {
  id: string;
  productId: string;
  productCode?: string;
  productBarcode?: string;
  productName: string;
  category?: string;
  purchaseCost: number;
  oldNormalPrice: number;
  newNormalPrice: number;
  oldWholesalePrice: number;
  newWholesalePrice: number;
  changedBy: string;
  date: string;
  time: string;
  reason?: string;
}

// 19. Global Multi-Currency Engine
export interface CurrencyDef {
  code: string; // e.g. EGP, USD, EUR, SAR, AED, KWD
  name: string; // e.g. الجنيه المصري, الدولار الأمريكي
  symbol: string; // e.g. ج.م, $, €, ر.س, د.إ, د.ك
  isBaseCurrency: boolean;
  exchangeRate: number; // relative to base (EGP = 1.0)
  lastUpdated?: string;
  fractionUnit?: string; // قرش, سنت, هللة, فلس
}

export interface ExchangeRate {
  id: string;
  currencyCode: string;
  rate: number;
  date: string;
  updatedBy: string;
}

export interface MultiCurrencyConfig {
  enabled: boolean;
  baseCurrency: string; // 'EGP'
  allowAutoFxGainLoss: boolean;
  fxGainAccountId?: string;
  fxLossAccountId?: string;
}

// 20. Serial Numbers & Warranty Certificates
export interface SerialItemRecord {
  id: string;
  serialNumber: string;
  itemId: string;
  itemName: string;
  itemCode?: string;
  invoiceId?: number;
  invoiceNumber?: string;
  customerName?: string;
  customerPhone?: string;
  saleDate?: string;
  warrantyMonths: number;
  warrantyExpiryDate: string;
  status: 'available' | 'sold' | 'in_warranty' | 'warranty_expired' | 'maintenance';
  notes?: string;
  batchNumber?: string;
  createdAt: string;
  createdBy: string;
}

// 21. CRM & Lead Pipeline
export type LeadStage = 'new' | 'contacted' | 'quotation_sent' | 'negotiation' | 'won' | 'lost';

export interface CrmActivity {
  id: string;
  date: string;
  type: 'call' | 'whatsapp' | 'meeting' | 'note' | 'email';
  summary: string;
  createdBy: string;
}

export interface CrmLead {
  id: string;
  clientName: string;
  companyName?: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  expectedValue: number;
  currency?: string;
  stage: LeadStage;
  source?: string; // إعلانات, ترشيح, معرض, اتصال مباشر
  salesRep?: string;
  assignedUserId?: string;
  notes?: string;
  nextFollowupDate?: string;
  activities?: CrmActivity[];
  convertedInvoiceId?: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

