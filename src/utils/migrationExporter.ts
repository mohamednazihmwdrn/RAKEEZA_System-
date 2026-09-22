import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { AppData, ExportAuditLog, ExportType, TenantCompany } from '../types';

export interface ExportResult {
  fileName: string;
  fileSize: string;
  recordsCount: number;
  blob: Blob;
}

/**
 * Migration Data Dictionary definition
 */
export const MIGRATION_DATA_DICTIONARY = [
  // Customers
  { Table: 'Customers', Field: 'id', Type: 'String (UUID)', Description: 'المعرف الفريد للعميل', Required: 'نعم', Unique: 'نعم', FK: '-' },
  { Table: 'Customers', Field: 'name', Type: 'String', Description: 'اسم العميل / اسم الشركة المشترية', Required: 'نعم', Unique: 'لا', FK: '-' },
  { Table: 'Customers', Field: 'phone', Type: 'String (Phone)', Description: 'رقم هاتف الشركة / العميل الرئيسي', Required: 'نعم', Unique: 'لا', FK: '-' },
  { Table: 'Customers', Field: 'balance', Type: 'Decimal (Currency)', Description: 'الرصيد الافتتاحي / الحالي (مدين موجب / دائن سالب)', Required: 'نعم', Unique: 'لا', FK: '-' },
  { Table: 'Customers', Field: 'taxNumber', Type: 'String', Description: 'الرقم الضريبي الموحد', Required: 'اختياري', Unique: 'لا', FK: '-' },
  { Table: 'Customers', Field: 'commercialReg', Type: 'String', Description: 'رقم السجل التجاري', Required: 'اختياري', Unique: 'لا', FK: '-' },
  { Table: 'Customers', Field: 'address', Type: 'String', Description: 'العنوان بالتفصيل', Required: 'اختياري', Unique: 'لا', FK: '-' },
  { Table: 'Customers', Field: 'creditLimit', Type: 'Decimal', Description: 'الحد الائتماني المسموح به للعميل', Required: 'اختياري', Unique: 'لا', FK: '-' },
  { Table: 'Customers', Field: 'priceTier', Type: 'Enum', Description: 'فئة التسعير (retail=قطاعي, wholesale=جملة, special=خاص)', Required: 'نعم', Unique: 'لا', FK: '-' },

  // Customer Representatives
  { Table: 'Customer_Representatives', Field: 'id', Type: 'String (UUID)', Description: 'المعرف الفريد للمندوب / جهة الاتصال', Required: 'نعم', Unique: 'نعم', FK: '-' },
  { Table: 'Customer_Representatives', Field: 'customerId', Type: 'String (UUID)', Description: 'معرف الشركة التابع لها المندوب', Required: 'نعم', Unique: 'لا', FK: 'Customers.id' },
  { Table: 'Customer_Representatives', Field: 'name', Type: 'String', Description: 'اسم المندوب المفوض / مسؤول الاتصال', Required: 'نعم', Unique: 'لا', FK: '-' },
  { Table: 'Customer_Representatives', Field: 'phone', Type: 'String (Phone)', Description: 'رقم هاتف المندوب المباشر', Required: 'نعم', Unique: 'لا', FK: '-' },
  { Table: 'Customer_Representatives', Field: 'jobTitle', Type: 'String', Description: 'المسمى الوظيفي (مدير مشتريات / محاسب)', Required: 'اختياري', Unique: 'لا', FK: '-' },
  { Table: 'Customer_Representatives', Field: 'email', Type: 'String (Email)', Description: 'البريد الإلكتروني للمندوب', Required: 'اختياري', Unique: 'لا', FK: '-' },

  // Suppliers
  { Table: 'Suppliers', Field: 'id', Type: 'String (UUID)', Description: 'المعرف الفريد للمورد', Required: 'نعم', Unique: 'نعم', FK: '-' },
  { Table: 'Suppliers', Field: 'name', Type: 'String', Description: 'اسم المورد / الشركة الموردة', Required: 'نعم', Unique: 'لا', FK: '-' },
  { Table: 'Suppliers', Field: 'phone', Type: 'String (Phone)', Description: 'رقم هاتف المورد', Required: 'نعم', Unique: 'لا', FK: '-' },
  { Table: 'Suppliers', Field: 'balance', Type: 'Decimal', Description: 'الرصيد الحالي للمورد (دائن موجب)', Required: 'نعم', Unique: 'لا', FK: '-' },
  { Table: 'Suppliers', Field: 'taxNumber', Type: 'String', Description: 'الرقم الضريبي للمورد', Required: 'اختياري', Unique: 'لا', FK: '-' },
  { Table: 'Suppliers', Field: 'address', Type: 'String', Description: 'عنوان المورد', Required: 'اختياري', Unique: 'لا', FK: '-' },

  // Products
  { Table: 'Products', Field: 'id', Type: 'String (UUID)', Description: 'المعرف الفريد للمنتج / الصنف', Required: 'نعم', Unique: 'نعم', FK: '-' },
  { Table: 'Products', Field: 'code', Type: 'String', Description: 'كود الصنف الداخلي', Required: 'اختياري', Unique: 'لا', FK: '-' },
  { Table: 'Products', Field: 'barcode', Type: 'String (Barcode)', Description: 'الباركود الدولي للصنف', Required: 'اختياري', Unique: 'نعم', FK: '-' },
  { Table: 'Products', Field: 'name', Type: 'String', Description: 'اسم الصنف التجاري', Required: 'نعم', Unique: 'لا', FK: '-' },
  { Table: 'Products', Field: 'category', Type: 'String', Description: 'التصنيف / الفئة التابع لها', Required: 'نعم', Unique: 'لا', FK: '-' },
  { Table: 'Products', Field: 'unit', Type: 'String', Description: 'وحدة القياس (قطعة / طقم / جهاز / كرتونة)', Required: 'نعم', Unique: 'لا', FK: '-' },
  { Table: 'Products', Field: 'quantity', Type: 'Decimal', Description: 'الرصيد الإجمالي الحالي بالمستودعات', Required: 'نعم', Unique: 'لا', FK: '-' },
  { Table: 'Products', Field: 'purchasePrice', Type: 'Decimal', Description: 'سعر الشراء / التكلفة المعيارية', Required: 'نعم', Unique: 'لا', FK: '-' },
  { Table: 'Products', Field: 'salePrice', Type: 'Decimal', Description: 'سعر البيع النقدي والقطاعي', Required: 'نعم', Unique: 'لا', FK: '-' },
  { Table: 'Products', Field: 'wholesalePrice', Type: 'Decimal', Description: 'سعر البيع بالجملة', Required: 'اختياري', Unique: 'لا', FK: '-' },
  { Table: 'Products', Field: 'costMethod', Type: 'Enum', Description: 'طريقة احتساب التكلفة (fifo / avg)', Required: 'نعم', Unique: 'لا', FK: '-' },

  // Sales Invoices
  { Table: 'Sales_Invoices', Field: 'id', Type: 'Integer', Description: 'رقم الفاتورة الموحد', Required: 'نعم', Unique: 'نعم', FK: '-' },
  { Table: 'Sales_Invoices', Field: 'date', Type: 'Date (YYYY-MM-DD)', Description: 'تاريخ تحرير الفاتورة', Required: 'نعم', Unique: 'لا', FK: '-' },
  { Table: 'Sales_Invoices', Field: 'customerName', Type: 'String', Description: 'اسم العميل / الشركة المشترية', Required: 'نعم', Unique: 'لا', FK: 'Customers.name' },
  { Table: 'Sales_Invoices', Field: 'customerRepName', Type: 'String', Description: 'اسم مندوب العميل المستلم', Required: 'اختياري', Unique: 'لا', FK: 'Customer_Representatives.name' },
  { Table: 'Sales_Invoices', Field: 'customerRepPhone', Type: 'String', Description: 'رقم هاتف مندوب العميل المستلم', Required: 'اختياري', Unique: 'لا', FK: '-' },
  { Table: 'Sales_Invoices', Field: 'salesRep', Type: 'String', Description: 'مندوب مبيعات الشركة البائعة', Required: 'اختياري', Unique: 'لا', FK: 'Sales_Representatives.name' },
  { Table: 'Sales_Invoices', Field: 'subtotal', Type: 'Decimal', Description: 'المجموع قبل الخصم والضريبة', Required: 'نعم', Unique: 'لا', FK: '-' },
  { Table: 'Sales_Invoices', Field: 'discount', Type: 'Decimal', Description: 'قيمة الخصم التجاري', Required: 'نعم', Unique: 'لا', FK: '-' },
  { Table: 'Sales_Invoices', Field: 'tax', Type: 'Decimal', Description: 'قيمة ضريبة القيمة المضافة (14%)', Required: 'نعم', Unique: 'لا', FK: '-' },
  { Table: 'Sales_Invoices', Field: 'total', Type: 'Decimal', Description: 'صافي إجمالي الفاتورة النهائي', Required: 'نعم', Unique: 'لا', FK: '-' },
  { Table: 'Sales_Invoices', Field: 'paidAmount', Type: 'Decimal', Description: 'المبلغ المسدد نقداً / بنكياً', Required: 'نعم', Unique: 'لا', FK: '-' },
  { Table: 'Sales_Invoices', Field: 'remainingAmount', Type: 'Decimal', Description: 'المبلغ الآجل المتبقي على العميل', Required: 'نعم', Unique: 'لا', FK: '-' },
  { Table: 'Sales_Invoices', Field: 'paymentMethod', Type: 'Enum', Description: 'طريقة الدفع (drawer, vodafone, instapay, bank)', Required: 'نعم', Unique: 'لا', FK: '-' },
  { Table: 'Sales_Invoices', Field: 'type', Type: 'Enum', Description: 'نوع الفاتورة (nagdi=نقدي, ajel=آجل, return_nagdi, return_ajel)', Required: 'نعم', Unique: 'لا', FK: '-' },
  { Table: 'Sales_Invoices', Field: 'branchId', Type: 'String', Description: 'معرف الفرع المنفذ للفاتورة', Required: 'نعم', Unique: 'لا', FK: 'Branches.id' },
  { Table: 'Sales_Invoices', Field: 'createdBy', Type: 'String', Description: 'اسم المستخدم المنشئ للفاتورة', Required: 'نعم', Unique: 'لا', FK: 'Users.name' },

  // Sales Items
  { Table: 'Sales_Items', Field: 'invoiceId', Type: 'Integer', Description: 'رقم الفاتورة المرتبطة', Required: 'نعم', Unique: 'لا', FK: 'Sales_Invoices.id' },
  { Table: 'Sales_Items', Field: 'itemId', Type: 'String', Description: 'معرف الصنف في المخزون', Required: 'اختياري', Unique: 'لا', FK: 'Products.id' },
  { Table: 'Sales_Items', Field: 'name', Type: 'String', Description: 'اسم الصنف المباع', Required: 'نعم', Unique: 'لا', FK: '-' },
  { Table: 'Sales_Items', Field: 'qty', Type: 'Decimal', Description: 'الكمية المباعة', Required: 'نعم', Unique: 'لا', FK: '-' },
  { Table: 'Sales_Items', Field: 'price', Type: 'Decimal', Description: 'سعر بيع الوحدة', Required: 'نعم', Unique: 'لا', FK: '-' },
  { Table: 'Sales_Items', Field: 'total', Type: 'Decimal', Description: 'الإجمالي للصنف (الكمية × السعر)', Required: 'نعم', Unique: 'لا', FK: '-' },

  // Purchase Invoices
  { Table: 'Purchase_Invoices', Field: 'id', Type: 'Integer', Description: 'رقم فاتورة الشراء', Required: 'نعم', Unique: 'نعم', FK: '-' },
  { Table: 'Purchase_Invoices', Field: 'date', Type: 'Date (YYYY-MM-DD)', Description: 'تاريخ الفاتورة', Required: 'نعم', Unique: 'لا', FK: '-' },
  { Table: 'Purchase_Invoices', Field: 'supplierName', Type: 'String', Description: 'اسم المورد', Required: 'نعم', Unique: 'لا', FK: 'Suppliers.name' },
  { Table: 'Purchase_Invoices', Field: 'total', Type: 'Decimal', Description: 'صافي إجمالي فاتورة الشراء', Required: 'نعم', Unique: 'لا', FK: '-' },
  { Table: 'Purchase_Invoices', Field: 'paidAmount', Type: 'Decimal', Description: 'المسدد للمورد', Required: 'نعم', Unique: 'لا', FK: '-' },
  { Table: 'Purchase_Invoices', Field: 'remainingAmount', Type: 'Decimal', Description: 'المتبقي كذمم موردين', Required: 'نعم', Unique: 'لا', FK: '-' },
  { Table: 'Purchase_Invoices', Field: 'type', Type: 'Enum', Description: 'نوع الشراء (nagdi=نقدي, ajel=آجل)', Required: 'نعم', Unique: 'لا', FK: '-' },
  { Table: 'Purchase_Invoices', Field: 'branchId', Type: 'String', Description: 'معرف الفرع / المخزن المستلم', Required: 'نعم', Unique: 'لا', FK: 'Branches.id' },

  // Cash Transactions
  { Table: 'Cash_Transactions', Field: 'id', Type: 'Integer', Description: 'رقم السند المالي', Required: 'نعم', Unique: 'نعم', FK: '-' },
  { Table: 'Cash_Transactions', Field: 'date', Type: 'Date', Description: 'تاريخ السند', Required: 'نعم', Unique: 'لا', FK: '-' },
  { Table: 'Cash_Transactions', Field: 'type', Type: 'Enum', Description: 'نوع السند (receive=قبض, pay=صرف, deposit=إيداع, withdraw=سحب)', Required: 'نعم', Unique: 'لا', FK: '-' },
  { Table: 'Cash_Transactions', Field: 'method', Type: 'Enum', Description: 'الخزينة / الحساب (drawer, vodafone, instapay, bank)', Required: 'نعم', Unique: 'لا', FK: '-' },
  { Table: 'Cash_Transactions', Field: 'amount', Type: 'Decimal', Description: 'قيمة الحركة النقدية', Required: 'نعم', Unique: 'لا', FK: '-' },
  { Table: 'Cash_Transactions', Field: 'note', Type: 'String', Description: 'بيان وسبب الحركة', Required: 'نعم', Unique: 'لا', FK: '-' },

  // Accounts Tree
  { Table: 'Accounts_Tree', Field: 'code', Type: 'String', Description: 'رقم الحساب في الدليل المحاسبي الشجري', Required: 'نعم', Unique: 'نعم', FK: '-' },
  { Table: 'Accounts_Tree', Field: 'name', Type: 'String', Description: 'اسم الحساب المحاسبي', Required: 'نعم', Unique: 'لا', FK: '-' },
  { Table: 'Accounts_Tree', Field: 'type', Type: 'Enum', Description: 'نوع الحساب (asset=أصول, liability=خصوم, equity=حقوق ملكية, revenue=إيرادات, expense=مصروفات)', Required: 'نعم', Unique: 'لا', FK: '-' },
  { Table: 'Accounts_Tree', Field: 'parentCode', Type: 'String', Description: 'رقم الحساب الأب / الرئيسي', Required: 'اختياري', Unique: 'لا', FK: 'Accounts_Tree.code' },
  { Table: 'Accounts_Tree', Field: 'balance', Type: 'Decimal', Description: 'الرصيد التراكمي للحساب', Required: 'نعم', Unique: 'لا', FK: '-' },

  // Journal Entries
  { Table: 'Journal_Entries', Field: 'id', Type: 'Integer', Description: 'رقم القيد المحاسبي', Required: 'نعم', Unique: 'نعم', FK: '-' },
  { Table: 'Journal_Entries', Field: 'date', Type: 'Date', Description: 'تاريخ القيد', Required: 'نعم', Unique: 'لا', FK: '-' },
  { Table: 'Journal_Entries', Field: 'description', Type: 'String', Description: 'شرح القيد اليومي', Required: 'نعم', Unique: 'لا', FK: '-' },
  { Table: 'Journal_Entries', Field: 'totalDebit', Type: 'Decimal', Description: 'إجمالي طرف المدين (يساوي الدائن)', Required: 'نعم', Unique: 'لا', FK: '-' },
  { Table: 'Journal_Entries', Field: 'totalCredit', Type: 'Decimal', Description: 'إجمالي طرف الدائن', Required: 'نعم', Unique: 'لا', FK: '-' },
];

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Trigger browser file download
 */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 1. Full Backup (JSON) for Instant Rakeeza Restore
 */
export function exportFullCompanyBackup(
  appData: AppData,
  company?: TenantCompany,
  userRole: string = 'RAKEEZA OWNER'
): { result: ExportResult; log: ExportAuditLog } {
  const compName = company?.name || appData.settings.companyName || 'Rakeeza-Company';
  const safeCompName = compName.replace(/[/\\?%*:|"<>]/g, '_');
  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `RAKEEZA_FULL_BACKUP_${safeCompName}_${dateStr}.json`;

  const backupPayload = {
    _schemaVersion: '8.0.0',
    _exportSystem: 'RAKEEZA Multi-Tenant Cloud ERP',
    _exportedAt: new Date().toISOString(),
    _exportedBy: userRole,
    company: company || {
      id: appData.companyId || 'COMP-000001',
      name: appData.settings.companyName,
      phone: appData.settings.phone1,
      taxNumber: appData.settings.taxNumber,
      commercialReg: appData.settings.commercialReg,
      address: appData.settings.address,
    },
    data: appData,
  };

  const jsonStr = JSON.stringify(backupPayload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const fileSize = formatBytes(blob.size);

  const totalRecords =
    (appData.customers?.length || 0) +
    (appData.suppliers?.length || 0) +
    (appData.items?.length || 0) +
    (appData.salesInvoices?.length || 0) +
    (appData.purchaseInvoices?.length || 0) +
    (appData.cashTransactions?.length || 0) +
    (appData.journalEntries?.length || 0) +
    (appData.accounts?.length || 0);

  downloadBlob(blob, fileName);

  const log: ExportAuditLog = {
    id: `EXP-LOG-${Date.now()}`,
    exportedBy: userRole,
    exportedByRole: userRole,
    companyId: company?.id || appData.companyId || 'COMP-000001',
    companyName: compName,
    exportType: 'full_backup',
    fileName,
    fileSize,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    status: 'success',
    recordsCount: totalRecords,
  };

  return { result: { fileName, fileSize, recordsCount: totalRecords, blob }, log };
}

/**
 * 2. Multi-Sheet Migration Excel (with Data Dictionary & Relational Tables)
 */
export function exportMigrationExcel(
  appData: AppData,
  company?: TenantCompany,
  userRole: string = 'RAKEEZA OWNER'
): { result: ExportResult; log: ExportAuditLog } {
  const compName = company?.name || appData.settings.companyName || 'Rakeeza-Company';
  const safeCompName = compName.replace(/[/\\?%*:|"<>]/g, '_');
  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `RAKEEZA_MIGRATION_EXCEL_${safeCompName}_${dateStr}.xlsx`;

  const wb = XLSX.utils.book_new();

  // 1. Data Dictionary Sheet
  const wsDictionary = XLSX.utils.json_to_sheet(MIGRATION_DATA_DICTIONARY);
  XLSX.utils.book_append_sheet(wb, wsDictionary, '0_Data_Dictionary');

  // 2. Company Info Sheet
  const companyData = [
    {
      company_id: company?.id || appData.companyId || 'COMP-000001',
      tenant_id: company?.tenantId || appData.tenantId || 'TENANT-001',
      company_code: company?.code || 'RKZ-001',
      company_name: compName,
      trade_name: company?.tradeName || compName,
      activity: company?.activity || appData.settings.activityCode,
      phone: company?.phone || appData.settings.phone1,
      email: company?.email || '',
      tax_number: company?.taxNumber || appData.settings.taxNumber,
      commercial_reg: company?.commercialReg || appData.settings.commercialReg,
      address: company?.address || appData.settings.address,
      currency: appData.settings.currencySymbol || 'ج.م',
      fiscal_year: appData.settings.fiscalYear || '2026',
      created_at: company?.createdAt || '2026-01-01',
    },
  ];
  const wsCompany = XLSX.utils.json_to_sheet(companyData);
  XLSX.utils.book_append_sheet(wb, wsCompany, '1_Company');

  // 3. Customers
  const customersData = (appData.customers || []).map((c) => ({
    customer_id: c.id,
    name: c.name,
    phone: c.phone,
    balance: c.balance,
    tax_number: c.taxNumber || '',
    commercial_reg: c.commercialReg || '',
    address: c.address || '',
    credit_limit: c.creditLimit || 0,
    price_tier: c.priceTier || 'retail',
    representatives_count: c.representatives?.length || 0,
    primary_rep_name: c.representatives?.find((r) => r.isPrimary)?.name || c.representatives?.[0]?.name || '',
    primary_rep_phone: c.representatives?.find((r) => r.isPrimary)?.phone || c.representatives?.[0]?.phone || '',
  }));
  const wsCustomers = XLSX.utils.json_to_sheet(customersData);
  XLSX.utils.book_append_sheet(wb, wsCustomers, '2_Customers');

  // 4. Customer Representatives
  const repsData: any[] = [];
  (appData.customers || []).forEach((c) => {
    (c.representatives || []).forEach((r) => {
      repsData.push({
        rep_id: r.id,
        customer_id: c.id,
        customer_name: c.name,
        name: r.name,
        phone: r.phone,
        job_title: r.jobTitle || '',
        email: r.email || '',
        is_primary: r.isPrimary ? 'Yes' : 'No',
        notes: r.notes || '',
      });
    });
  });
  const wsReps = XLSX.utils.json_to_sheet(
    repsData.length > 0 ? repsData : [{ rep_id: '-', customer_id: '-', customer_name: '-', name: 'لا توجد بيانات', phone: '-' }]
  );
  XLSX.utils.book_append_sheet(wb, wsReps, '3_Customer_Reps');

  // 5. Suppliers
  const suppliersData = (appData.suppliers || []).map((s) => ({
    supplier_id: s.id,
    name: s.name,
    phone: s.phone,
    balance: s.balance,
    tax_number: s.taxNumber || '',
    address: s.address || '',
  }));
  const wsSuppliers = XLSX.utils.json_to_sheet(suppliersData);
  XLSX.utils.book_append_sheet(wb, wsSuppliers, '4_Suppliers');

  // 6. Products
  const productsData = (appData.items || []).map((i) => ({
    product_id: i.id,
    code: i.code || '',
    barcode: i.barcode || '',
    name: i.name,
    category: i.category || '',
    unit: i.unit || 'قطعة',
    quantity: i.quantity,
    purchase_cost: i.purchasePrice,
    normal_sale_price: i.salePrice,
    wholesale_price: i.wholesalePrice || i.salePrice,
    min_stock_alert: i.minStockAlert || 0,
    cost_method: i.costMethod || 'avg',
    total_inventory_value: i.quantity * i.purchasePrice,
  }));
  const wsProducts = XLSX.utils.json_to_sheet(productsData);
  XLSX.utils.book_append_sheet(wb, wsProducts, '5_Products');

  // 7. Sales Invoices
  const salesInvoicesData = (appData.salesInvoices || []).map((inv) => ({
    invoice_id: inv.id,
    date: inv.date,
    time: inv.time || '',
    customer_name: inv.customerName,
    customer_phone: inv.phone || '',
    customer_rep_name: inv.customerRepName || '',
    customer_rep_phone: inv.customerRepPhone || '',
    sales_rep: inv.salesRep || '',
    subtotal: inv.subtotal,
    discount: inv.discount,
    tax_14_percent: inv.tax,
    withholding_tax: inv.withholdingTax || 0,
    fees: inv.fees || 0,
    net_total: inv.total,
    paid_amount: inv.paidAmount,
    remaining_amount: inv.remainingAmount,
    payment_method: inv.paymentMethod,
    invoice_type: inv.type,
    status: inv.status || 'approved',
    branch_id: inv.branchId || 'br-main',
    created_by: inv.createdBy,
    e_invoice_uuid: inv.eInvoiceUuid || '',
  }));
  const wsSales = XLSX.utils.json_to_sheet(salesInvoicesData);
  XLSX.utils.book_append_sheet(wb, wsSales, '6_Sales_Invoices');

  // 8. Sales Items
  const salesItemsData: any[] = [];
  (appData.salesInvoices || []).forEach((inv) => {
    (inv.items || []).forEach((item, idx) => {
      salesItemsData.push({
        invoice_id: inv.id,
        line_no: idx + 1,
        item_id: item.itemId || '',
        item_name: item.name,
        quantity: item.qty,
        unit_price: item.price,
        discount: item.discount || 0,
        tax: item.tax || 0,
        total: item.total,
        batch_number: item.batchNumber || '',
      });
    });
  });
  const wsSalesItems = XLSX.utils.json_to_sheet(
    salesItemsData.length > 0 ? salesItemsData : [{ invoice_id: '-', item_name: 'لا توجد مبيعات', quantity: 0, unit_price: 0, total: 0 }]
  );
  XLSX.utils.book_append_sheet(wb, wsSalesItems, '7_Sales_Items');

  // 9. Purchase Invoices
  const purchasesData = (appData.purchaseInvoices || []).map((inv) => ({
    invoice_id: inv.id,
    date: inv.date,
    time: inv.time || '',
    supplier_name: inv.supplierName,
    supplier_phone: inv.phone || '',
    subtotal: inv.subtotal,
    discount: inv.discount,
    tax: inv.tax,
    withholding_tax: inv.withholdingTax || 0,
    net_total: inv.total,
    paid_amount: inv.paidAmount || 0,
    remaining_amount: inv.remainingAmount || 0,
    payment_method: inv.paymentMethod,
    invoice_type: inv.type,
    status: inv.status || 'approved',
    branch_id: inv.branchId || 'br-main',
    created_by: inv.createdBy,
  }));
  const wsPurchases = XLSX.utils.json_to_sheet(purchasesData);
  XLSX.utils.book_append_sheet(wb, wsPurchases, '8_Purchase_Invoices');

  // 10. Purchase Items
  const purchaseItemsData: any[] = [];
  (appData.purchaseInvoices || []).forEach((inv) => {
    (inv.items || []).forEach((item, idx) => {
      purchaseItemsData.push({
        invoice_id: inv.id,
        line_no: idx + 1,
        item_id: item.itemId || '',
        item_name: item.name,
        quantity: item.qty,
        unit_price: item.price,
        discount: item.discount || 0,
        tax: item.tax || 0,
        total: item.total,
      });
    });
  });
  const wsPurchaseItems = XLSX.utils.json_to_sheet(
    purchaseItemsData.length > 0 ? purchaseItemsData : [{ invoice_id: '-', item_name: 'لا توجد مشتريات', quantity: 0, unit_price: 0, total: 0 }]
  );
  XLSX.utils.book_append_sheet(wb, wsPurchaseItems, '9_Purchase_Items');

  // 11. Cash Transactions
  const cashData = (appData.cashTransactions || []).map((c) => ({
    transaction_id: c.id,
    date: c.date,
    type: c.type,
    method: c.method,
    amount: c.amount,
    note: c.note,
    customer_name: c.customerName || '',
    supplier_name: c.supplierName || '',
    account_code: c.accountCode || '',
    invoice_id: c.invoiceId || '',
    created_by: c.createdBy || '',
  }));
  const wsCash = XLSX.utils.json_to_sheet(cashData);
  XLSX.utils.book_append_sheet(wb, wsCash, '10_Cash_Transactions');

  // 12. Accounts Tree
  const accountsData = (appData.accounts || []).map((a) => ({
    account_code: a.code,
    account_name: a.name,
    account_type: a.type,
    parent_code: a.parentCode || '',
    is_parent: a.isParent ? 'Yes' : 'No',
    balance: a.balance || 0,
    debit_total: a.debit || 0,
    credit_total: a.credit || 0,
  }));
  const wsAccounts = XLSX.utils.json_to_sheet(accountsData);
  XLSX.utils.book_append_sheet(wb, wsAccounts, '11_Accounts_Tree');

  // 13. Journal Entries & Lines
  const journalData = (appData.journalEntries || []).map((j) => {
    const totalDebit = (j.lines || []).reduce((s, l) => s + (l.debit || 0), 0);
    const totalCredit = (j.lines || []).reduce((s, l) => s + (l.credit || 0), 0);
    return {
      entry_id: j.id,
      entry_number: j.entryNumber,
      date: j.date,
      description: j.description,
      total_debit: totalDebit,
      total_credit: totalCredit,
      status: j.isApproved ? 'Approved' : 'Pending',
      created_by: j.createdBy,
    };
  });
  const wsJournal = XLSX.utils.json_to_sheet(journalData);
  XLSX.utils.book_append_sheet(wb, wsJournal, '12_Journal_Entries');

  // 14. Cheques
  const chequesData = (appData.cheques || []).map((ch) => ({
    cheque_id: ch.id,
    cheque_number: ch.chequeNumber,
    bank_name: ch.bankName,
    drawer_name: ch.drawerName,
    beneficiary_name: ch.beneficiaryName,
    amount: ch.amount,
    issue_date: ch.issueDate,
    due_date: ch.dueDate,
    type: ch.type,
    status: ch.status,
  }));
  const wsCheques = XLSX.utils.json_to_sheet(chequesData);
  XLSX.utils.book_append_sheet(wb, wsCheques, '13_Cheques');

  // 15. Employees
  const employeesData = (appData.employees || []).map((emp) => ({
    employee_id: emp.id,
    code: emp.code,
    name: emp.name,
    phone: emp.phone,
    national_id: emp.nationalId || '',
    department: emp.department,
    job_title: emp.jobTitle,
    basic_salary: emp.basicSalary,
    hire_date: emp.hireDate,
    status: emp.status,
  }));
  const wsEmployees = XLSX.utils.json_to_sheet(employeesData);
  XLSX.utils.book_append_sheet(wb, wsEmployees, '14_Employees');

  // 16. Fixed Assets
  const assetsData = (appData.fixedAssets || []).map((ast) => ({
    asset_id: ast.id,
    code: ast.code,
    name: ast.name,
    category: ast.category,
    purchase_date: ast.purchaseDate,
    purchase_price: ast.purchasePrice,
    salvage_value: ast.salvageValue,
    useful_life_years: ast.usefulLifeYears,
    accumulated_depreciation: ast.accumulatedDepreciation,
    net_book_value: ast.netBookValue,
    status: ast.status,
  }));
  const wsAssets = XLSX.utils.json_to_sheet(assetsData);
  XLSX.utils.book_append_sheet(wb, wsAssets, '15_Fixed_Assets');

  // 17. Sales Reps
  const salesRepsData = (appData.salesReps || []).map((sr) => ({
    rep_id: sr.id,
    code: sr.code || '',
    name: sr.name,
    phone: sr.phone,
    region: sr.region || '',
    total_sales: sr.totalSales || 0,
    commission_rate: sr.commission || sr.commissionRate || 0,
  }));
  const wsSalesReps = XLSX.utils.json_to_sheet(salesRepsData);
  XLSX.utils.book_append_sheet(wb, wsSalesReps, '16_Sales_Reps');

  // 18. Branches
  const branchesData = (appData.branches || []).map((b) => ({
    branch_id: b.id,
    code: b.code,
    name: b.name,
    location: b.location,
    phone: b.phone,
    manager: b.manager,
    is_main: b.isMain ? 'Yes' : 'No',
  }));
  const wsBranches = XLSX.utils.json_to_sheet(branchesData);
  XLSX.utils.book_append_sheet(wb, wsBranches, '17_Branches');

  // Generate binary XLSX buffer
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const fileSize = formatBytes(blob.size);

  const totalRecords =
    customersData.length +
    suppliersData.length +
    productsData.length +
    salesInvoicesData.length +
    purchasesData.length +
    cashData.length +
    accountsData.length;

  downloadBlob(blob, fileName);

  const log: ExportAuditLog = {
    id: `EXP-LOG-${Date.now()}`,
    exportedBy: userRole,
    exportedByRole: userRole,
    companyId: company?.id || appData.companyId || 'COMP-000001',
    companyName: compName,
    exportType: 'migration_excel',
    fileName,
    fileSize,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    status: 'success',
    recordsCount: totalRecords,
  };

  return { result: { fileName, fileSize, recordsCount: totalRecords, blob }, log };
}

/**
 * 3. Migration CSV Package (ZIP package containing all relational CSVs)
 */
export async function exportMigrationCsvPackage(
  appData: AppData,
  company?: TenantCompany,
  userRole: string = 'RAKEEZA OWNER'
): Promise<{ result: ExportResult; log: ExportAuditLog }> {
  const compName = company?.name || appData.settings.companyName || 'Rakeeza-Company';
  const safeCompName = compName.replace(/[/\\?%*:|"<>]/g, '_');
  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `RAKEEZA_MIGRATION_CSV_BUNDLE_${safeCompName}_${dateStr}.zip`;

  const zip = new JSZip();
  const folder = zip.folder(`rakeeza_${safeCompName}_csv_migration`);

  const arrayToCsv = (data: any[]): string => {
    if (!data || data.length === 0) return '';
    const headers = Object.keys(data[0]);
    const rows = data.map((obj) =>
      headers
        .map((header) => {
          const val = obj[header] === null || obj[header] === undefined ? '' : String(obj[header]);
          return `"${val.replace(/"/g, '""')}"`;
        })
        .join(',')
    );
    return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  };

  // Add CSV files
  folder?.file('00_data_dictionary.csv', arrayToCsv(MIGRATION_DATA_DICTIONARY));

  // Customers
  const customers = (appData.customers || []).map((c) => ({
    customer_id: c.id,
    name: c.name,
    phone: c.phone,
    balance: c.balance,
    tax_number: c.taxNumber || '',
    commercial_reg: c.commercialReg || '',
    address: c.address || '',
    credit_limit: c.creditLimit || 0,
    price_tier: c.priceTier || 'retail',
  }));
  folder?.file('customers.csv', arrayToCsv(customers));

  // Customer Representatives
  const reps: any[] = [];
  (appData.customers || []).forEach((c) => {
    (c.representatives || []).forEach((r) => {
      reps.push({
        rep_id: r.id,
        customer_id: c.id,
        customer_name: c.name,
        name: r.name,
        phone: r.phone,
        job_title: r.jobTitle || '',
        email: r.email || '',
        is_primary: r.isPrimary ? 1 : 0,
        notes: r.notes || '',
      });
    });
  });
  folder?.file('customer_representatives.csv', arrayToCsv(reps));

  // Suppliers
  const suppliers = (appData.suppliers || []).map((s) => ({
    supplier_id: s.id,
    name: s.name,
    phone: s.phone,
    balance: s.balance,
    tax_number: s.taxNumber || '',
    address: s.address || '',
  }));
  folder?.file('suppliers.csv', arrayToCsv(suppliers));

  // Products
  const products = (appData.items || []).map((i) => ({
    product_id: i.id,
    code: i.code || '',
    barcode: i.barcode || '',
    name: i.name,
    category: i.category || '',
    unit: i.unit || 'قطعة',
    quantity: i.quantity,
    purchase_price: i.purchasePrice,
    sale_price: i.salePrice,
    wholesale_price: i.wholesalePrice || i.salePrice,
    min_stock_alert: i.minStockAlert || 0,
    cost_method: i.costMethod || 'avg',
  }));
  folder?.file('products.csv', arrayToCsv(products));

  // Sales Invoices & Items
  const salesInvoices = (appData.salesInvoices || []).map((inv) => ({
    invoice_id: inv.id,
    date: inv.date,
    customer_name: inv.customerName,
    customer_rep_name: inv.customerRepName || '',
    customer_rep_phone: inv.customerRepPhone || '',
    sales_rep: inv.salesRep || '',
    subtotal: inv.subtotal,
    discount: inv.discount,
    tax: inv.tax,
    total: inv.total,
    paid_amount: inv.paidAmount,
    remaining_amount: inv.remainingAmount,
    payment_method: inv.paymentMethod,
    type: inv.type,
    status: inv.status || 'approved',
    branch_id: inv.branchId || 'br-main',
    created_by: inv.createdBy,
  }));
  folder?.file('sales_invoices.csv', arrayToCsv(salesInvoices));

  const salesItems: any[] = [];
  (appData.salesInvoices || []).forEach((inv) => {
    (inv.items || []).forEach((item, idx) => {
      salesItems.push({
        invoice_id: inv.id,
        line_number: idx + 1,
        item_id: item.itemId || '',
        name: item.name,
        qty: item.qty,
        price: item.price,
        discount: item.discount || 0,
        tax: item.tax || 0,
        total: item.total,
      });
    });
  });
  folder?.file('sales_invoice_items.csv', arrayToCsv(salesItems));

  // Purchases
  const purchases = (appData.purchaseInvoices || []).map((inv) => ({
    invoice_id: inv.id,
    date: inv.date,
    supplier_name: inv.supplierName,
    subtotal: inv.subtotal,
    discount: inv.discount,
    tax: inv.tax,
    total: inv.total,
    paid_amount: inv.paidAmount || 0,
    remaining_amount: inv.remainingAmount || 0,
    payment_method: inv.paymentMethod,
    type: inv.type,
    created_by: inv.createdBy,
  }));
  folder?.file('purchase_invoices.csv', arrayToCsv(purchases));

  // Cash
  const cash = (appData.cashTransactions || []).map((c) => ({
    id: c.id,
    date: c.date,
    type: c.type,
    method: c.method,
    amount: c.amount,
    note: c.note,
    customer_name: c.customerName || '',
    supplier_name: c.supplierName || '',
    created_by: c.createdBy || '',
  }));
  folder?.file('cash_transactions.csv', arrayToCsv(cash));

  // Accounts
  const accounts = (appData.accounts || []).map((a) => ({
    code: a.code,
    name: a.name,
    type: a.type,
    parent_code: a.parentCode || '',
    is_parent: a.isParent ? 1 : 0,
    balance: a.balance || 0,
  }));
  folder?.file('accounts_tree.csv', arrayToCsv(accounts));

  // README
  const readme = `========================================================================
منظومة ركيزة RAKEEZA Multi-Tenant Cloud ERP - حزمة هجرة البيانات (CSV Migration Bundle)
الشركة: ${compName}
تاريخ التصدير: ${dateStr}
المصدّر: ${userRole}
========================================================================
هذه الحزمة تحتوي على ملفات CSV متوافقة مع معايير UTF-8 العالمية لتمكين استيراد
بيانات الشركة في أي نظام ERP آخر (Odoo, SAP, Oracle, Zoho, D365, Custom SQL).

قائمة الملفات:
1. 00_data_dictionary.csv -> قاموس البيانات الشامل وشرح العلاقات والمعرفات
2. customers.csv -> بيانات العملاء والشركات المشترية
3. customer_representatives.csv -> مندوبي العملاء ومسؤولي الاتصال
4. suppliers.csv -> الموردين
5. products.csv -> الأصناف والمخزون
6. sales_invoices.csv -> فواتير المبيعات
7. sales_invoice_items.csv -> بنود وتفاصيل فواتير المبيعات
8. purchase_invoices.csv -> فواتير المشتريات
9. cash_transactions.csv -> سندات القبض والصرف
10. accounts_tree.csv -> الدليل المحاسبي الشجري
========================================================================
بياناتك ملكك دائماً مع ركيزة | Your Data Is Always Yours With Rakeeza ERP.
`;
  folder?.file('README_MIGRATION_GUIDE.txt', readme);

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const fileSize = formatBytes(zipBlob.size);
  const totalRecords = customers.length + suppliers.length + products.length + salesInvoices.length;

  downloadBlob(zipBlob, fileName);

  const log: ExportAuditLog = {
    id: `EXP-LOG-${Date.now()}`,
    exportedBy: userRole,
    exportedByRole: userRole,
    companyId: company?.id || appData.companyId || 'COMP-000001',
    companyName: compName,
    exportType: 'migration_csv',
    fileName,
    fileSize,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    status: 'success',
    recordsCount: totalRecords,
  };

  return { result: { fileName, fileSize, recordsCount: totalRecords, blob: zipBlob }, log };
}
