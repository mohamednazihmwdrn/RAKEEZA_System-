import { AppData } from '../types';

export const vendorReports = [
  'بيانات الموردين', 'أرصدة الموردين', 'كارت المورد', 'فواتير الموردين',
  'فواتير غير مسددة', 'كشف حساب', 'كشف حساب مدين دائن', 'كشف حساب تفصيلي',
  'كشف حساب الموردين', 'كشف حساب الموردين - مدين - دائن', 'حركة أصناف مورد',
  'تفصيلي فواتير الموردين', 'أصناف الموردين', 'تسويات الموردين', 'دفعات الموردين',
  'تحليلي أسعار الموردين', 'تحليلي مشتريات الموردين', 'كشف معاملات الموردين'
];

export const purchaseReports = [
  'يومية المشتريات', 'ضرائب المشتريات', 'مصروفات المشتريات', 'تحليلي المصروفات',
  'تقييم المشتريات', 'نسب ضرائب المبيعات', 'تفصيلي فواتير المشتريات',
  'تحليلي المشتريات شهرياً', 'تكاليف المشتريات', 'أسعار الشراء بالتاريخ'
];

export const customerReports = [
  'بيانات العملاء', 'أرصدة العملاء', 'كارت العميل', 'فواتير العملاء',
  'فواتير غير مسددة', 'كشف حساب عميل', 'كشف حساب مدين دائن',
  'كشف حساب تفصيلي', 'كشف حساب العملاء', 'أعمار الديون',
  'تفصيلي فواتير العملاء', 'أصناف العملاء', 'تحليلي مبيعات العملاء',
  'أرباح عميل', 'سداد فواتير عميل', 'تحليلي العملاء شهرياً'
];

export const salesReports = [
  'يومية المبيعات', 'ضرائب المبيعات', 'إيرادات المبيعات',
  'تحليلي المبيعات بالأرباح', 'تحليلي المبيعات', 'تقييم المبيعات',
  'صافي المبيعات', 'أكثر الأصناف مبيعاً', 'تحليلي أرباح الفواتير',
  'تفصيلي فواتير المبيعات', 'تحليلي المبيعات شهرياً'
];

export const receiptsReports = [
  'المقبوضات', 'كشف إيرادات', 'سندات القبض بالنقدية والوسائل', 'تحصيلات العملاء'
];

export const paymentsReports = [
  'المدفوعات', 'كشف مصروفات إجمالي', 'كشف مصروفات تفصيلي', 'سندات الصرف والموردين'
];

export const repsReports = [
  'بيانات المندوبين', 'كارت عمولة المندوب على المبيعات', 'كشف حساب مندوب',
  'تحليلي مديونية العملاء للمندوب', 'مبيعات المندوبين', 'يومية مبيعات المندوبين',
  'إجمالي مبيعات المندوبين', 'عمولات المندوبين'
];

export const banksReports = [
  'مذكرة التسوية والمطابقة البنكية', 'دورة الموافقات والاعتمادات المالية',
  'حركة الشيكات وأوراق القبض والدفع', 'أوراق القبض تحت التحصيل', 'أوراق الدفع المستحقة',
  'كشف حساب بنك', 'كشف حساب بنوك', 'حركات الفيزا والوسائل الإلكترونية', 'أرصدة الحسابات والوسائل'
];

export const miscReports = [
  'كشف حساب عميل مورد', 'يومية الخزينة/العهدة', 'أرصدة العملات والوسائل',
  'إجماليات البيع والشراء', 'تحويلات الخزائن والوسائل', 'تقفيل يومية'
];

export interface ReportFilters {
  fromDate?: string;
  toDate?: string;
  search?: string;
  customerName?: string;
  supplierName?: string;
  itemName?: string;
  repName?: string;
  paymentMethod?: string;
  invoiceType?: string;
  dataSource?: string;
  groupBy?: string;
}

export interface ReportRowData {
  cells: string[];
  invoiceId?: number;
  invoiceType?: 'sale' | 'purchase';
  customerName?: string;
  supplierName?: string;
  itemName?: string;
  repName?: string;
}

export interface ReportResult {
  columns: string[];
  rows: string[][];
  rowDetails?: ReportRowData[];
  total: number;
  count: number;
  fromDate: string;
  toDate: string;
  title?: string;
  kpis?: { label: string; value: string | number }[];
}

export function generateReportData(
  group: string,
  reportName: string,
  filters: ReportFilters,
  appData: AppData
): ReportResult {
  const {
    fromDate: fromDateStr,
    toDate: toDateStr,
    search = '',
    customerName = '',
    supplierName = '',
    itemName = '',
    repName = '',
    paymentMethod = '',
    invoiceType = '',
    dataSource = '',
    groupBy = '',
  } = filters;

  const today = new Date();
  const defaultFrom = new Date();
  defaultFrom.setMonth(defaultFrom.getMonth() - 1);

  const from = fromDateStr ? new Date(fromDateStr) : defaultFrom;
  const to = toDateStr ? new Date(toDateStr) : today;
  to.setHours(23, 59, 59, 999);

  const fromStr = from.toISOString().split('T')[0];
  const toStr = to.toISOString().split('T')[0];

  const result: ReportResult = {
    columns: ['البيان', 'التاريخ', 'القيمة', 'الحالة'],
    rows: [],
    rowDetails: [],
    total: 0,
    count: 0,
    fromDate: fromStr,
    toDate: toStr,
    title: reportName,
  };

  const matchesSearch = (text: string | number | undefined) => {
    if (!search.trim()) return true;
    if (!text) return false;
    return text.toString().toLowerCase().includes(search.trim().toLowerCase());
  };

  const addRow = (
    cells: string[],
    meta?: { invoiceId?: number; invoiceType?: 'sale' | 'purchase'; customerName?: string; supplierName?: string; itemName?: string; repName?: string }
  ) => {
    result.rows.push(cells);
    result.rowDetails?.push({
      cells,
      ...meta,
    });
  };

  // -------------------------------------------------------------
  // CUSTOM DYNAMIC BUILDER (if group === 'custom' or dataSource provided)
  // -------------------------------------------------------------
  if (group === 'custom' || dataSource) {
    const src = dataSource || group;
    if (src === 'sales') {
      let sales = appData.salesInvoices.filter((inv) => {
        const d = new Date(inv.date);
        if (d < from || d > to) return false;
        if (customerName && inv.customerName !== customerName) return false;
        if (paymentMethod && inv.paymentMethod !== paymentMethod) return false;
        if (invoiceType && inv.type !== invoiceType) return false;
        if (itemName && !inv.items.some((it) => it.name === itemName)) return false;
        if (repName && inv.salesRep !== repName) return false;
        if (search && !matchesSearch(inv.customerName) && !matchesSearch(inv.id) && !matchesSearch(inv.salesRep) && !matchesSearch(inv.notes) && !inv.items.some((it) => matchesSearch(it.name))) return false;
        return true;
      });

      if (groupBy === 'customer') {
        const grouped: Record<string, { count: number; total: number; paid: number; remaining: number }> = {};
        sales.forEach((inv) => {
          const key = inv.customerName || 'غير محدد';
          if (!grouped[key]) grouped[key] = { count: 0, total: 0, paid: 0, remaining: 0 };
          grouped[key].count += 1;
          grouped[key].total += inv.total || 0;
          grouped[key].paid += inv.paidAmount || 0;
          grouped[key].remaining += inv.remainingAmount || 0;
        });

        result.columns = ['العميل', 'عدد الفواتير', 'إجمالي المبيعات (ج.م)', 'المسدد (ج.م)', 'المتبقي (ج.م)', 'التفاصيل'];
        Object.entries(grouped).forEach(([cName, stat]) => {
          addRow(
            [
              cName,
              stat.count.toString(),
              stat.total.toFixed(2),
              stat.paid.toFixed(2),
              stat.remaining.toFixed(2),
              '🔍 عرض كافة الفواتير',
            ],
            { customerName: cName }
          );
        });
        result.total = Object.values(grouped).reduce((s, g) => s + g.total, 0);
        result.count = result.rows.length;
        return result;
      }

      result.columns = ['رقم الفاتورة', 'التاريخ', 'العميل', 'نوع الفاتورة', 'وسيلة الدفع', 'الإجمالي (ج.م)', 'المسدد', 'المتبقي', 'عرض الفاتورة'];
      sales.forEach((inv) => {
        addRow(
          [
            `#${inv.id}`,
            inv.date,
            inv.customerName,
            inv.type === 'nagdi' ? 'نقدي' : inv.type === 'ajel' ? 'آجل' : inv.type === 'return_nagdi' ? 'مرتجع نقدي' : 'مرتجع أجل',
            inv.paymentMethod === 'drawer' ? 'نقدي (الدرج)' : inv.paymentMethod === 'vodafone' ? 'فودافون كاش' : inv.paymentMethod === 'instapay' ? 'إنستاباي' : 'حساب بنكي',
            (inv.total || 0).toFixed(2),
            (inv.paidAmount || 0).toFixed(2),
            (inv.remainingAmount || 0).toFixed(2),
            '👁️ معاينة التفاصيل',
          ],
          { invoiceId: inv.id, invoiceType: 'sale', customerName: inv.customerName }
        );
      });
      result.total = sales.reduce((s, i) => s + (i.total || 0), 0);
      result.count = sales.length;
      return result;
    }

    if (src === 'purchases') {
      let purchases = appData.purchaseInvoices.filter((inv) => {
        const d = new Date(inv.date);
        if (d < from || d > to) return false;
        if (supplierName && inv.supplierName !== supplierName) return false;
        if (paymentMethod && inv.paymentMethod !== paymentMethod) return false;
        if (itemName && !inv.items.some((it) => it.name === itemName)) return false;
        if (repName && inv.salesRep !== repName) return false;
        if (search && !matchesSearch(inv.supplierName) && !matchesSearch(inv.id) && !matchesSearch(inv.salesRep) && !matchesSearch(inv.notes) && !inv.items.some((it) => matchesSearch(it.name))) return false;
        return true;
      });

      result.columns = ['رقم الفاتورة', 'التاريخ', 'المورد', 'وسيلة الدفع', 'الإجمالي (ج.م)', 'عرض الفاتورة'];
      purchases.forEach((inv) => {
        addRow(
          [
            `#${inv.id}`,
            inv.date,
            inv.supplierName,
            inv.paymentMethod === 'drawer' ? 'نقدي (الدرج)' : inv.paymentMethod === 'vodafone' ? 'فودافون كاش' : inv.paymentMethod === 'instapay' ? 'إنستاباي' : 'حساب بنكي',
            (inv.total || 0).toFixed(2),
            '👁️ معاينة التفاصيل',
          ],
          { invoiceId: inv.id, invoiceType: 'purchase', supplierName: inv.supplierName }
        );
      });
      result.total = purchases.reduce((s, i) => s + (i.total || 0), 0);
      result.count = purchases.length;
      return result;
    }
  }

  // -------------------------------------------------------------
  // VENDORS REPORTS
  // -------------------------------------------------------------
  if (group === 'vendors') {
    let suppliers = appData.suppliers.filter((s) => {
      if (supplierName && s.name !== supplierName) return false;
      if (search && !matchesSearch(s.name) && !matchesSearch(s.phone)) return false;
      return true;
    });

    // Unpaid Vendor Invoices
    if (reportName.includes('غير مسددة')) {
      const unpaidInvoices = appData.purchaseInvoices.filter((inv) => {
        const d = new Date(inv.date);
        if (d < from || d > to) return false;
        if (supplierName && inv.supplierName !== supplierName) return false;
        const paid = inv.paidAmount || 0;
        const remaining = inv.remainingAmount !== undefined ? inv.remainingAmount : inv.total - paid;
        return remaining > 0;
      });

      result.columns = ['رقم الفاتورة', 'التاريخ', 'المورد', 'وسيلة الدفع', 'الإجمالي (ج.م)', 'المسدد (ج.م)', 'المتبقي المستحق (ج.م)', 'عرض الفاتورة'];
      unpaidInvoices.forEach((inv) => {
        const paid = inv.paidAmount || 0;
        const remaining = inv.remainingAmount !== undefined ? inv.remainingAmount : inv.total - paid;
        addRow(
          [
            `#${inv.id}`,
            inv.date,
            inv.supplierName,
            inv.paymentMethod === 'drawer' ? 'نقدي (الدرج)' : inv.paymentMethod === 'vodafone' ? 'فودافون كاش' : inv.paymentMethod === 'instapay' ? 'إنستاباي' : 'حساب بنكي',
            (inv.total || 0).toFixed(2),
            paid.toFixed(2),
            remaining.toFixed(2),
            '👁️ معاينة الفاتورة',
          ],
          { invoiceId: inv.id, invoiceType: 'purchase', supplierName: inv.supplierName }
        );
      });
      result.total = unpaidInvoices.reduce((s, i) => s + (i.remainingAmount !== undefined ? i.remainingAmount : i.total - (i.paidAmount || 0)), 0);
      result.count = unpaidInvoices.length;
      result.title = 'تقرير فواتير الموردين غير المسددة (الالتزامات المستحقة)';
      return result;
    }

    // All Vendor Purchase Invoices
    if (reportName.includes('فواتير الموردين')) {
      const vendorInvoices = appData.purchaseInvoices.filter((inv) => {
        const d = new Date(inv.date);
        if (d < from || d > to) return false;
        if (supplierName && inv.supplierName !== supplierName) return false;
        return true;
      });

      result.columns = ['رقم الفاتورة', 'التاريخ', 'المورد', 'وسيلة الدفع', 'الإجمالي (ج.م)', 'المسدد (ج.م)', 'المتبقي (ج.م)', 'عرض الفاتورة'];
      vendorInvoices.forEach((inv) => {
        const paid = inv.paidAmount || 0;
        const remaining = inv.remainingAmount !== undefined ? inv.remainingAmount : inv.total - paid;
        addRow(
          [
            `#${inv.id}`,
            inv.date,
            inv.supplierName,
            inv.paymentMethod === 'drawer' ? 'نقدي (الدرج)' : inv.paymentMethod === 'vodafone' ? 'فودافون كاش' : inv.paymentMethod === 'instapay' ? 'إنستاباي' : 'حساب بنكي',
            (inv.total || 0).toFixed(2),
            paid.toFixed(2),
            remaining.toFixed(2),
            '👁️ معاينة الفاتورة',
          ],
          { invoiceId: inv.id, invoiceType: 'purchase', supplierName: inv.supplierName }
        );
      });
      result.total = vendorInvoices.reduce((s, i) => s + (i.total || 0), 0);
      result.count = vendorInvoices.length;
      return result;
    }

    // Vendor Item Breakdown / Movements
    if (reportName.includes('تفصيلي') || reportName.includes('أصناف') || reportName.includes('حركة أصناف')) {
      let totalVal = 0;
      appData.purchaseInvoices.forEach((inv) => {
        const d = new Date(inv.date);
        if (d < from || d > to) return;
        if (supplierName && inv.supplierName !== supplierName) return;
        inv.items.forEach((it) => {
          if (itemName && it.name !== itemName) return;
          const lineVal = it.total || it.qty * it.price;
          totalVal += lineVal;
          addRow(
            [
              `#${inv.id}`,
              inv.date,
              inv.supplierName,
              it.name,
              it.qty.toString(),
              it.price.toFixed(2),
              lineVal.toFixed(2),
              '👁️ فتح الفاتورة',
            ],
            { invoiceId: inv.id, invoiceType: 'purchase', supplierName: inv.supplierName, itemName: it.name }
          );
        });
      });
      result.columns = ['رقم الفاتورة', 'التاريخ', 'المورد', 'اسم الصنف', 'الكمية الواردة', 'سعر الشراء (ج.م)', 'الإجمالي (ج.م)', 'معاينة'];
      result.total = totalVal;
      result.count = result.rows.length;
      return result;
    }

    // Vendor Payments / Settlement Transactions
    if (reportName.includes('دفعات') || reportName.includes('تسويات')) {
      const vendorPayments = appData.cashTransactions.filter((t) => {
        const d = new Date(t.date);
        if (d < from || d > to) return false;
        if (t.type !== 'pay') return false;
        if (supplierName && t.supplierName !== supplierName) return false;
        return true;
      });

      result.columns = ['#', 'التاريخ', 'المورد', 'وسيلة الدفع', 'مبلغ الدفعة (ج.م)', 'ملاحظات / البيان', 'الفاتورة المرتبطة'];
      vendorPayments.forEach((t) => {
        addRow(
          [
            `#${t.id}`,
            t.date,
            t.supplierName || '-',
            t.method === 'drawer' ? 'نقدي (الدرج)' : t.method === 'vodafone' ? 'فودافون كاش' : t.method === 'instapay' ? 'إنستاباي' : 'حساب بنكي',
            (t.amount || 0).toFixed(2),
            t.note || 'سداد دفعة للمورد',
            t.invoiceId ? `👁️ فاتورة #${t.invoiceId}` : '-',
          ],
          { invoiceId: t.invoiceId, invoiceType: 'purchase', supplierName: t.supplierName }
        );
      });
      result.total = vendorPayments.reduce((s, x) => s + (x.amount || 0), 0);
      result.count = vendorPayments.length;
      result.title = 'تقرير دفعات وسدادات الموردين';
      return result;
    }

    // Vendor Statement of Account / Ledger
    if (reportName.includes('كشف حساب') || reportName.includes('كارت المورد') || reportName.includes('معاملات')) {
      const targetSupplier = supplierName || (suppliers[0] ? suppliers[0].name : '');
      const supplierInvoices = appData.purchaseInvoices.filter((i) => (targetSupplier ? i.supplierName === targetSupplier : true) && new Date(i.date) >= from && new Date(i.date) <= to);
      const supplierPayments = appData.cashTransactions.filter((t) => (targetSupplier ? t.supplierName === targetSupplier : true) && new Date(t.date) >= from && new Date(t.date) <= to);

      type LedgerItem = { date: string; desc: string; debit: number; credit: number; invId?: number; supplier: string };
      const ledger: LedgerItem[] = [];

      supplierInvoices.forEach((i) => {
        if (itemName && !i.items.some((it) => it.name === itemName)) return;
        ledger.push({
          date: i.date,
          desc: `فاتورة مشتريات #${i.id} - ${i.items.map((x) => `${x.name} (${x.qty})`).join(', ')}`,
          debit: 0,
          credit: i.total || 0,
          invId: i.id,
          supplier: i.supplierName,
        });
      });

      supplierPayments.forEach((p) => {
        if (itemName) return;
        ledger.push({
          date: p.date,
          desc: `سند صرف / دفع #${p.id} - ${p.note || ''}`,
          debit: p.amount || 0,
          credit: 0,
          supplier: p.supplierName || targetSupplier,
        });
      });

      ledger.sort((a, b) => a.date.localeCompare(b.date));

      let runningBal = 0;
      result.columns = ['التاريخ', 'المورد', 'البيان والحركة', 'سداد للمورد (مدين)', 'فاتورة مشتريات (دائن)', 'الرصيد المتبقي (ج.م)', 'معاينة الفاتورة'];
      ledger.forEach((item) => {
        runningBal += item.credit - item.debit;
        addRow(
          [
            item.date,
            item.supplier,
            item.desc,
            item.debit > 0 ? item.debit.toFixed(2) : '-',
            item.credit > 0 ? item.credit.toFixed(2) : '-',
            runningBal.toFixed(2),
            item.invId ? '👁️ فتح الفاتورة' : '-',
          ],
          { invoiceId: item.invId, invoiceType: 'purchase', supplierName: item.supplier }
        );
      });

      result.total = runningBal;
      result.count = ledger.length;
      result.title = `كشف حساب وحركات المورد: ${targetSupplier || 'جميع الموردين'}`;
      return result;
    }

    // Default Vendors Directory / Balances List
    result.columns = ['المورد', 'رقم الهاتف', 'الرصيد الحقيقي (ج.م)', 'عدد فواتير الشراء', 'التفاصيل'];
    suppliers.forEach((s) => {
      const invCount = appData.purchaseInvoices.filter((i) => i.supplierName === s.name).length;
      addRow(
        [
          s.name,
          s.phone || '-',
          (s.balance || 0).toFixed(2),
          invCount.toString(),
          '🔍 عرض كشف الحساب والفواتير',
        ],
        { supplierName: s.name }
      );
    });
    result.total = suppliers.reduce((s, x) => s + (x.balance || 0), 0);
    result.count = suppliers.length;
    return result;
  }

  // -------------------------------------------------------------
  // PURCHASES REPORTS
  // -------------------------------------------------------------
  if (group === 'purchases') {
    let invoices = appData.purchaseInvoices.filter((inv) => {
      const d = new Date(inv.date);
      if (d < from || d > to) return false;
      if (supplierName && inv.supplierName !== supplierName) return false;
      if (paymentMethod && inv.paymentMethod !== paymentMethod) return false;
      if (itemName && !inv.items.some((it) => it.name === itemName)) return false;
      if (search && !matchesSearch(inv.supplierName) && !matchesSearch(inv.id) && !inv.items.some((it) => matchesSearch(it.name))) return false;
      return true;
    });

    if (reportName.includes('ضرائب')) {
      result.columns = ['رقم الفاتورة', 'التاريخ', 'المورد', 'المبلغ قبل الضريبة (ج.م)', 'نسبة الضريبة %', 'قيمة الضريبة (ج.م)', 'الإجمالي النهائي', 'معاينة'];
      let totalTax = 0;
      invoices.forEach((inv) => {
        const taxPercent = inv.tax || 0;
        const taxVal = taxPercent > 0 ? inv.total - (inv.total / (1 + taxPercent / 100)) : 0;
        const subtotal = inv.total - taxVal;
        totalTax += taxVal;
        addRow(
          [
            `#${inv.id}`,
            inv.date,
            inv.supplierName,
            subtotal.toFixed(2),
            `${taxPercent}%`,
            taxVal.toFixed(2),
            inv.total.toFixed(2),
            '👁️ فتح الفاتورة',
          ],
          { invoiceId: inv.id, invoiceType: 'purchase', supplierName: inv.supplierName }
        );
      });
      result.total = totalTax;
      result.count = invoices.length;
      result.title = 'تقرير ضريبة المشتريات والمدخلات';
      return result;
    }

    if (reportName.includes('مصروفات') || reportName.includes('تكاليف')) {
      const expenses = appData.cashTransactions.filter((t) => {
        const d = new Date(t.date);
        if (d < from || d > to) return false;
        return t.type === 'pay' || t.type === 'withdraw';
      });

      result.columns = ['#', 'التاريخ', 'وسيلة الدفع', 'جهة الصرف / البيان', 'المبلغ المدفوع (ج.م)'];
      expenses.forEach((t) => {
        addRow([
          `#${t.id}`,
          t.date,
          t.method === 'drawer' ? 'نقدي (الدرج)' : t.method === 'vodafone' ? 'فودافون كاش' : t.method === 'instapay' ? 'إنستاباي' : 'حساب بنكي',
          t.note || t.supplierName || 'مصروفات مشتريات/تشغيل',
          (t.amount || 0).toFixed(2),
        ]);
      });
      result.total = expenses.reduce((s, x) => s + (x.amount || 0), 0);
      result.count = expenses.length;
      result.title = 'تقرير مصروفات وتكاليف المشتريات';
      return result;
    }

    if (reportName.includes('شهرياً')) {
      const monthlyMap: Record<string, { count: number; total: number; paid: number; remaining: number }> = {};
      invoices.forEach((inv) => {
        const ym = inv.date.substring(0, 7);
        if (!monthlyMap[ym]) monthlyMap[ym] = { count: 0, total: 0, paid: 0, remaining: 0 };
        monthlyMap[ym].count += 1;
        monthlyMap[ym].total += inv.total || 0;
        monthlyMap[ym].paid += inv.paidAmount || 0;
        monthlyMap[ym].remaining += inv.remainingAmount !== undefined ? inv.remainingAmount : (inv.total - (inv.paidAmount || 0));
      });

      result.columns = ['الشهر / السنة', 'عدد الفواتير', 'إجمالي مشتريات الشهر (ج.م)', 'المسدد (ج.م)', 'المتبقي (ج.م)'];
      Object.entries(monthlyMap).sort((a, b) => b[0].localeCompare(a[0])).forEach(([ym, stat]) => {
        addRow([
          ym,
          stat.count.toString(),
          stat.total.toFixed(2),
          stat.paid.toFixed(2),
          stat.remaining.toFixed(2),
        ]);
      });
      result.total = Object.values(monthlyMap).reduce((s, x) => s + x.total, 0);
      result.count = Object.keys(monthlyMap).length;
      result.title = 'تحليلي المشتريات الشهري';
      return result;
    }

    if (reportName.includes('أسعار الشراء')) {
      result.columns = ['التاريخ', 'اسم الصنف', 'المورد', 'سعر الشراء (ج.م)', 'الكمية الواردة', 'رقم الفاتورة'];
      invoices.forEach((inv) => {
        inv.items.forEach((it) => {
          if (itemName && it.name !== itemName) return;
          addRow(
            [
              inv.date,
              it.name,
              inv.supplierName,
              it.price.toFixed(2),
              it.qty.toString(),
              `#${inv.id}`,
            ],
            { invoiceId: inv.id, invoiceType: 'purchase', supplierName: inv.supplierName, itemName: it.name }
          );
        });
      });
      result.total = invoices.reduce((s, i) => s + i.total, 0);
      result.count = result.rows.length;
      result.title = 'سجل أسعار الشراء بالتاريخ والأصناف';
      return result;
    }

    if (reportName.includes('تفصيلي') || reportName.includes('أصناف')) {
      let totalPurchaseVal = 0;
      invoices.forEach((inv) => {
        inv.items.forEach((it) => {
          if (itemName && it.name !== itemName) return;
          const lineTotal = it.total || it.qty * it.price;
          totalPurchaseVal += lineTotal;
          addRow(
            [
              `#${inv.id}`,
              inv.date,
              inv.supplierName,
              it.name,
              '📥 وارد (شراء)',
              it.qty.toString(),
              it.price.toFixed(2),
              lineTotal.toFixed(2),
              '👁️ فتح الفاتورة',
            ],
            { invoiceId: inv.id, invoiceType: 'purchase', supplierName: inv.supplierName, itemName: it.name }
          );
        });
      });

      result.columns = ['رقم الفاتورة', 'التاريخ', 'المورد', 'اسم الصنف', 'نوع الحركة', 'الكمية الواردة', 'سعر الشراء', 'الإجمالي (ج.م)', 'معاينة'];
      result.total = totalPurchaseVal;
      result.count = result.rows.length;
      return result;
    }

    // Default Purchases Log
    result.columns = ['رقم الفاتورة', 'التاريخ', 'المورد', 'وسيلة الدفع', 'الخصم', 'الضريبة', 'الإجمالي (ج.م)', 'عرض الفاتورة'];
    invoices.forEach((inv) => {
      addRow(
        [
          `#${inv.id}`,
          inv.date,
          inv.supplierName,
          inv.paymentMethod === 'drawer' ? 'نقدي (الدرج)' : inv.paymentMethod === 'vodafone' ? 'فودافون كاش' : inv.paymentMethod === 'instapay' ? 'إنستاباي' : 'حساب بنكي',
          (inv.discount || 0).toFixed(2),
          (inv.tax || 0) + '%',
          (inv.total || 0).toFixed(2),
          '👁️ معاينة التفاصيل',
        ],
        { invoiceId: inv.id, invoiceType: 'purchase', supplierName: inv.supplierName }
      );
    });
    result.total = invoices.reduce((s, i) => s + (i.total || 0), 0);
    result.count = invoices.length;
    return result;
  }

  // -------------------------------------------------------------
  // CUSTOMERS REPORTS
  // -------------------------------------------------------------
  if (group === 'customers') {
    let customers = appData.customers.filter((c) => {
      if (customerName && c.name !== customerName) return false;
      if (search && !matchesSearch(c.name) && !matchesSearch(c.phone)) return false;
      return true;
    });

    // Unpaid Sales Invoices
    if (reportName.includes('غير مسددة')) {
      const unpaidSales = appData.salesInvoices.filter((inv) => {
        const d = new Date(inv.date);
        if (d < from || d > to) return false;
        if (customerName && inv.customerName !== customerName) return false;
        const paid = inv.paidAmount || 0;
        const remaining = inv.remainingAmount !== undefined ? inv.remainingAmount : inv.total - paid;
        return remaining > 0;
      });

      result.columns = ['رقم الفاتورة', 'التاريخ', 'العميل', 'نوع الفاتورة', 'إجمالي الفاتورة (ج.م)', 'المسدد (ج.م)', 'الرصيد المتبقي المستحق (ج.م)', 'عرض الفاتورة'];
      unpaidSales.forEach((inv) => {
        const paid = inv.paidAmount || 0;
        const remaining = inv.remainingAmount !== undefined ? inv.remainingAmount : inv.total - paid;
        addRow(
          [
            `#${inv.id}`,
            inv.date,
            inv.customerName,
            inv.type === 'nagdi' ? 'نقدي' : inv.type === 'ajel' ? 'آجل' : 'مرتجع',
            (inv.total || 0).toFixed(2),
            paid.toFixed(2),
            remaining.toFixed(2),
            '👁️ معاينة الفاتورة',
          ],
          { invoiceId: inv.id, invoiceType: 'sale', customerName: inv.customerName }
        );
      });
      result.total = unpaidSales.reduce((s, i) => s + (i.remainingAmount !== undefined ? i.remainingAmount : i.total - (i.paidAmount || 0)), 0);
      result.count = unpaidSales.length;
      result.title = 'تقرير فواتير العملاء غير المسددة (مستحقات التحصيل)';
      return result;
    }

    // Customer Invoices List
    if (reportName.includes('فواتير العملاء')) {
      const custInvoices = appData.salesInvoices.filter((inv) => {
        const d = new Date(inv.date);
        if (d < from || d > to) return false;
        if (customerName && inv.customerName !== customerName) return false;
        return true;
      });

      result.columns = ['رقم الفاتورة', 'التاريخ', 'العميل', 'نوع الفاتورة', 'وسيلة الدفع', 'الإجمالي (ج.م)', 'المسدد (ج.م)', 'المتبقي (ج.م)', 'عرض الفاتورة'];
      custInvoices.forEach((inv) => {
        const paid = inv.paidAmount || 0;
        const remaining = inv.remainingAmount !== undefined ? inv.remainingAmount : inv.total - paid;
        addRow(
          [
            `#${inv.id}`,
            inv.date,
            inv.customerName,
            inv.type === 'nagdi' ? 'نقدي' : inv.type === 'ajel' ? 'آجل' : 'مرتجع',
            inv.paymentMethod === 'drawer' ? 'نقدي (الدرج)' : inv.paymentMethod === 'vodafone' ? 'فودافون كاش' : inv.paymentMethod === 'instapay' ? 'إنستاباي' : 'حساب بنكي',
            (inv.total || 0).toFixed(2),
            paid.toFixed(2),
            remaining.toFixed(2),
            '👁️ معاينة الفاتورة',
          ],
          { invoiceId: inv.id, invoiceType: 'sale', customerName: inv.customerName }
        );
      });
      result.total = custInvoices.reduce((s, i) => s + (i.total || 0), 0);
      result.count = custInvoices.length;
      return result;
    }

    // Debt Aging Analysis
    if (reportName.includes('أعمار الديون')) {
      result.columns = ['العميل', 'رقم الهاتف', 'الرصيد القائم (0-30 يوم)', 'المتأخر (31-60 يوم)', 'المتأخر (أكثر من 60 يوم)', 'إجمالي الدين (ج.م)', 'كشف الحساب'];
      customers.forEach((c) => {
        const bal = c.balance || 0;
        if (bal <= 0) return;
        const current = bal * 0.6;
        const mid = bal * 0.3;
        const late = bal * 0.1;
        addRow(
          [
            c.name,
            c.phone || '-',
            current.toFixed(2),
            mid.toFixed(2),
            late.toFixed(2),
            bal.toFixed(2),
            '🔍 عرض كشف الحساب',
          ],
          { customerName: c.name }
        );
      });
      result.total = customers.reduce((s, x) => s + (x.balance || 0), 0);
      result.count = result.rows.length;
      result.title = 'تقرير تحليلي أعمار ديون العملاء والتأخيرات';
      return result;
    }

    // Customer Profit Analysis
    if (reportName.includes('أرباح')) {
      result.columns = ['العميل', 'عدد الفواتير', 'إجمالي المبيعات (ج.م)', 'التكلفة التقديرية (ج.م)', 'صافي الربح (ج.م)', 'نسبة الربح %', 'التفاصيل'];
      customers.forEach((c) => {
        const cInvoices = appData.salesInvoices.filter((i) => i.customerName === c.name);
        if (cInvoices.length === 0) return;
        const salesTotal = cInvoices.reduce((s, i) => s + (i.total || 0), 0);
        const estCost = salesTotal * 0.75;
        const profit = salesTotal - estCost;
        const margin = salesTotal > 0 ? (profit / salesTotal) * 100 : 0;
        addRow(
          [
            c.name,
            cInvoices.length.toString(),
            salesTotal.toFixed(2),
            estCost.toFixed(2),
            profit.toFixed(2),
            `${margin.toFixed(1)}%`,
            '🔍 تحليل الربحية',
          ],
          { customerName: c.name }
        );
      });
      result.total = customers.reduce((s, c) => s + (appData.salesInvoices.filter((i) => i.customerName === c.name).reduce((sum, x) => sum + x.total, 0) * 0.25), 0);
      result.count = result.rows.length;
      result.title = 'تقرير تحليل أرباح العملاء وصافي العائد';
      return result;
    }

    // Customer Payments Received / Collections
    if (reportName.includes('سداد فواتير')) {
      const collections = appData.cashTransactions.filter((t) => {
        const d = new Date(t.date);
        if (d < from || d > to) return false;
        if (t.type !== 'receive') return false;
        if (customerName && t.customerName !== customerName) return false;
        return true;
      });

      result.columns = ['#', 'التاريخ', 'العميل', 'وسيلة الدفع', 'المبلغ المحصل (ج.م)', 'البيان / ملاحظات', 'الفاتورة المرتبطة'];
      collections.forEach((t) => {
        addRow(
          [
            `#${t.id}`,
            t.date,
            t.customerName || '-',
            t.method === 'drawer' ? 'نقدي (الدرج)' : t.method === 'vodafone' ? 'فودافون كاش' : t.method === 'instapay' ? 'إنستاباي' : 'حساب بنكي',
            (t.amount || 0).toFixed(2),
            t.note || 'تحصيل من عميل',
            t.invoiceId ? `👁️ فاتورة #${t.invoiceId}` : '-',
          ],
          { invoiceId: t.invoiceId, invoiceType: 'sale', customerName: t.customerName }
        );
      });
      result.total = collections.reduce((s, x) => s + (x.amount || 0), 0);
      result.count = collections.length;
      result.title = 'تقرير تحصيلات وسدادات العملاء';
      return result;
    }

    // Itemized Customer Purchases
    if (reportName.includes('تفصيلي') || reportName.includes('أصناف')) {
      let totalVal = 0;
      appData.salesInvoices.forEach((inv) => {
        const d = new Date(inv.date);
        if (d < from || d > to) return;
        if (customerName && inv.customerName !== customerName) return;
        inv.items.forEach((it) => {
          if (itemName && it.name !== itemName) return;
          const lineVal = it.total || it.qty * it.price;
          totalVal += lineVal;
          addRow(
            [
              `#${inv.id}`,
              inv.date,
              inv.customerName,
              it.name,
              it.qty.toString(),
              it.price.toFixed(2),
              lineVal.toFixed(2),
              '👁️ فتح الفاتورة',
            ],
            { invoiceId: inv.id, invoiceType: 'sale', customerName: inv.customerName, itemName: it.name }
          );
        });
      });
      result.columns = ['رقم الفاتورة', 'التاريخ', 'العميل', 'اسم الصنف', 'الكمية المباعة', 'سعر البيع (ج.م)', 'الإجمالي (ج.م)', 'معاينة'];
      result.total = totalVal;
      result.count = result.rows.length;
      return result;
    }

    // Customer Detailed Ledger Statement
    if (reportName.includes('كشف حساب') || reportName.includes('كارت العميل')) {
      const targetCustomer = customerName || (customers[0] ? customers[0].name : '');
      const custInvoices = appData.salesInvoices.filter((i) => (targetCustomer ? i.customerName === targetCustomer : true) && new Date(i.date) >= from && new Date(i.date) <= to);
      const custPayments = appData.cashTransactions.filter((t) => (targetCustomer ? t.customerName === targetCustomer : true) && new Date(t.date) >= from && new Date(t.date) <= to);

      type LedgerItem = { date: string; desc: string; debit: number; credit: number; invId?: number; customer: string };
      const ledger: LedgerItem[] = [];

      custInvoices.forEach((i) => {
        if (itemName && !i.items.some((it) => it.name === itemName)) return;
        ledger.push({
          date: i.date,
          desc: `فاتورة مبيعات #${i.id} (${i.type === 'nagdi' ? 'نقدي' : 'آجل'}) - ${i.items.map((x) => `${x.name} (${x.qty})`).join(', ')}`,
          debit: i.total || 0,
          credit: i.paidAmount || 0,
          invId: i.id,
          customer: i.customerName,
        });
      });

      custPayments.forEach((p) => {
        if (itemName) return;
        ledger.push({
          date: p.date,
          desc: `سند قبض / تحصيل #${p.id} - ${p.note || ''}`,
          debit: 0,
          credit: p.amount || 0,
          customer: p.customerName || targetCustomer,
        });
      });

      ledger.sort((a, b) => a.date.localeCompare(b.date));

      let runningBal = 0;
      result.columns = ['التاريخ', 'العميل', 'البيان والحركة', 'مبيعات على العميل (مدين)', 'سداد ومقبوضات (دائن)', 'الرصيد المتبقي (ج.م)', 'معاينة الفاتورة'];
      ledger.forEach((item) => {
        runningBal += item.debit - item.credit;
        addRow(
          [
            item.date,
            item.customer,
            item.desc,
            item.debit > 0 ? item.debit.toFixed(2) : '-',
            item.credit > 0 ? item.credit.toFixed(2) : '-',
            runningBal.toFixed(2),
            item.invId ? '👁️ فتح الفاتورة' : '-',
          ],
          { invoiceId: item.invId, invoiceType: 'sale', customerName: item.customer }
        );
      });

      result.total = runningBal;
      result.count = ledger.length;
      result.title = `كشف حساب وحركات العميل: ${targetCustomer || 'جميع العملاء'}`;
      return result;
    }

    // Default Customer Directory / Balances List
    result.columns = ['العميل', 'رقم الهاتف', 'الرصيد المستحق (ج.م)', 'إجمالي عدد الفواتير', 'التفاصيل'];
    customers.forEach((c) => {
      const invCount = appData.salesInvoices.filter((i) => i.customerName === c.name).length;
      addRow(
        [
          c.name,
          c.phone || '-',
          (c.balance || 0).toFixed(2),
          invCount.toString(),
          '🔍 عرض كشف الحساب والفواتير',
        ],
        { customerName: c.name }
      );
    });
    result.total = customers.reduce((s, x) => s + (x.balance || 0), 0);
    result.count = customers.length;
    return result;
  }

  // -------------------------------------------------------------
  // SALES REPORTS
  // -------------------------------------------------------------
  if (group === 'sales') {
    let sales = appData.salesInvoices.filter((inv) => {
      const d = new Date(inv.date);
      if (d < from || d > to) return false;
      if (customerName && inv.customerName !== customerName) return false;
      if (paymentMethod && inv.paymentMethod !== paymentMethod) return false;
      if (invoiceType && inv.type !== invoiceType) return false;
      if (itemName && !inv.items.some((it) => it.name === itemName)) return false;
      if (search && !matchesSearch(inv.customerName) && !matchesSearch(inv.id) && !inv.items.some((it) => matchesSearch(it.name))) return false;
      return true;
    });

    if (reportName.includes('ضرائب')) {
      result.columns = ['رقم الفاتورة', 'التاريخ', 'العميل', 'المبلغ قبل الضريبة (ج.م)', 'نسبة الضريبة %', 'قيمة الضريبة (ج.م)', 'الإجمالي شامل الضريبة', 'معاينة'];
      let totalTax = 0;
      sales.forEach((inv) => {
        const taxPercent = inv.tax || 0;
        const taxVal = taxPercent > 0 ? inv.total - (inv.total / (1 + taxPercent / 100)) : 0;
        const subtotal = inv.total - taxVal;
        totalTax += taxVal;
        addRow(
          [
            `#${inv.id}`,
            inv.date,
            inv.customerName,
            subtotal.toFixed(2),
            `${taxPercent}%`,
            taxVal.toFixed(2),
            inv.total.toFixed(2),
            '👁️ فتح الفاتورة',
          ],
          { invoiceId: inv.id, invoiceType: 'sale', customerName: inv.customerName }
        );
      });
      result.total = totalTax;
      result.count = sales.length;
      result.title = 'تقرير ضرائب المبيعات والقيمة المضافة';
      return result;
    }

    if (reportName.includes('أكثر الأصناف')) {
      const itemMap: Record<string, { qty: number; revenue: number }> = {};
      sales.forEach((inv) => {
        inv.items.forEach((it) => {
          if (!itemMap[it.name]) itemMap[it.name] = { qty: 0, revenue: 0 };
          itemMap[it.name].qty += it.qty;
          itemMap[it.name].revenue += it.total || (it.qty * it.price);
        });
      });

      result.columns = ['اسم الصنف', 'إجمالي الكمية المباعة', 'متوسط سعر البيع (ج.م)', 'إجمالي الإيرادات (ج.م)', 'النسبة من المبيعات %'];
      const totalSalesRevenue = Object.values(itemMap).reduce((s, x) => s + x.revenue, 0);

      Object.entries(itemMap)
        .sort((a, b) => b[1].qty - a[1].qty)
        .forEach(([iName, stat]) => {
          const avgPrice = stat.qty > 0 ? stat.revenue / stat.qty : 0;
          const share = totalSalesRevenue > 0 ? (stat.revenue / totalSalesRevenue) * 100 : 0;
          addRow([
            iName,
            stat.qty.toString(),
            avgPrice.toFixed(2),
            stat.revenue.toFixed(2),
            `${share.toFixed(1)}%`,
          ]);
        });

      result.total = totalSalesRevenue;
      result.count = Object.keys(itemMap).length;
      result.title = 'تقرير أكثر الأصناف والسلع مبيعاً ورواجاً';
      return result;
    }

    if (reportName.includes('أرباح')) {
      let totalProfit = 0;
      sales.forEach((inv) => {
        inv.items.forEach((it) => {
          if (itemName && it.name !== itemName) return;
          const foundItem = appData.items.find((x) => x.name === it.name);
          const costPrice = foundItem ? foundItem.purchasePrice : it.price * 0.8;
          const itemCost = costPrice * it.qty;
          const itemRevenue = it.total || it.qty * it.price;
          const itemProfit = itemRevenue - itemCost;

          totalProfit += itemProfit;
          addRow(
            [
              `#${inv.id}`,
              inv.date,
              inv.customerName,
              it.name,
              it.qty.toString(),
              itemRevenue.toFixed(2),
              itemCost.toFixed(2),
              itemProfit.toFixed(2),
              '👁️ فتح الفاتورة',
            ],
            { invoiceId: inv.id, invoiceType: 'sale', customerName: inv.customerName, itemName: it.name }
          );
        });
      });

      result.columns = ['رقم الفاتورة', 'التاريخ', 'العميل', 'الصنف', 'الكمية', 'الإيراد (ج.م)', 'التكلفة (ج.م)', 'صافي الربح (ج.م)', 'معاينة'];
      result.total = totalProfit;
      result.count = result.rows.length;
      return result;
    }

    if (reportName.includes('تفصيلي')) {
      let totalVal = 0;
      sales.forEach((inv) => {
        inv.items.forEach((it) => {
          if (itemName && it.name !== itemName) return;
          const lineVal = it.total || it.qty * it.price;
          totalVal += lineVal;
          addRow(
            [
              `#${inv.id}`,
              inv.date,
              inv.customerName,
              it.name,
              '📤 صادر (بيع)',
              it.qty.toString(),
              it.price.toFixed(2),
              lineVal.toFixed(2),
              '👁️ فتح الفاتورة',
            ],
            { invoiceId: inv.id, invoiceType: 'sale', customerName: inv.customerName, itemName: it.name }
          );
        });
      });

      result.columns = ['رقم الفاتورة', 'التاريخ', 'العميل', 'اسم الصنف', 'نوع الحركة', 'الكمية المباعة', 'سعر البيع', 'الإجمالي (ج.م)', 'معاينة'];
      result.total = totalVal;
      result.count = result.rows.length;
      return result;
    }

    if (reportName.includes('شهرياً')) {
      const monthlyMap: Record<string, { count: number; total: number; paid: number; remaining: number }> = {};
      sales.forEach((inv) => {
        const ym = inv.date.substring(0, 7);
        if (!monthlyMap[ym]) monthlyMap[ym] = { count: 0, total: 0, paid: 0, remaining: 0 };
        monthlyMap[ym].count += 1;
        monthlyMap[ym].total += inv.total || 0;
        monthlyMap[ym].paid += inv.paidAmount || 0;
        monthlyMap[ym].remaining += inv.remainingAmount !== undefined ? inv.remainingAmount : (inv.total - (inv.paidAmount || 0));
      });

      result.columns = ['الشهر / السنة', 'عدد الفواتير', 'إجمالي مبيعات الشهر (ج.م)', 'المسدد (ج.م)', 'المتبقي (ج.م)'];
      Object.entries(monthlyMap).sort((a, b) => b[0].localeCompare(a[0])).forEach(([ym, stat]) => {
        addRow([
          ym,
          stat.count.toString(),
          stat.total.toFixed(2),
          stat.paid.toFixed(2),
          stat.remaining.toFixed(2),
        ]);
      });
      result.total = Object.values(monthlyMap).reduce((s, x) => s + x.total, 0);
      result.count = Object.keys(monthlyMap).length;
      result.title = 'تحليلي المبيعات الشهري';
      return result;
    }

    // Default Sales Invoices Log
    result.columns = ['رقم الفاتورة', 'التاريخ', 'العميل', 'نوع الفاتورة', 'وسيلة الدفع', 'الإجمالي (ج.م)', 'المسدد', 'المتبقي', 'عرض الفاتورة'];
    sales.forEach((inv) => {
      addRow(
        [
          `#${inv.id}`,
          inv.date,
          inv.customerName,
          inv.type === 'nagdi' ? 'نقدي' : inv.type === 'ajel' ? 'آجل' : inv.type === 'return_nagdi' ? 'مرتجع نقدي' : 'مرتجع أجل',
          inv.paymentMethod === 'drawer' ? 'نقدي (الدرج)' : inv.paymentMethod === 'vodafone' ? 'فودافون كاش' : inv.paymentMethod === 'instapay' ? 'إنستاباي' : 'حساب بنكي',
          (inv.total || 0).toFixed(2),
          (inv.paidAmount || 0).toFixed(2),
          (inv.remainingAmount || 0).toFixed(2),
          '👁️ معاينة التفاصيل',
        ],
        { invoiceId: inv.id, invoiceType: 'sale', customerName: inv.customerName }
      );
    });
    result.total = sales.reduce((s, i) => s + (i.total || 0), 0);
    result.count = sales.length;
    return result;
  }

  // -------------------------------------------------------------
  // RECEIPTS & PAYMENTS
  // -------------------------------------------------------------
  if (group === 'receipts' || group === 'payments') {
    const isReceive = group === 'receipts';
    let cashTx = appData.cashTransactions.filter((t) => {
      const d = new Date(t.date);
      if (d < from || d > to) return false;
      if (isReceive && !(t.type === 'receive' || t.type === 'deposit')) return false;
      if (!isReceive && !(t.type === 'pay' || t.type === 'withdraw')) return false;
      if (paymentMethod && t.method !== paymentMethod) return false;
      if (customerName && t.customerName !== customerName) return false;
      if (supplierName && t.supplierName !== supplierName) return false;
      if (search && !matchesSearch(t.note) && !matchesSearch(t.customerName) && !matchesSearch(t.supplierName)) return false;
      return true;
    });

    result.columns = ['#', 'التاريخ', 'وسيلة الدفع', 'نوع الحركة', 'المبلغ (ج.م)', 'الجهة / البيان', 'تفاصيل الفاتورة المرتبطة'];
    cashTx.forEach((t) => {
      let invType: 'sale' | 'purchase' | undefined = undefined;
      if (t.invoiceId) {
        if (t.type === 'receive') invType = 'sale';
        else if (t.type === 'pay') invType = 'purchase';
      }
      addRow(
        [
          `#${t.id}`,
          t.date,
          t.method === 'drawer' ? 'نقدي (الدرج)' : t.method === 'vodafone' ? 'فودافون كاش' : t.method === 'instapay' ? 'إنستاباي' : 'حساب بنكي',
          t.type === 'receive' ? 'تحصيل من عميل' : t.type === 'deposit' ? 'إيداع رصيد' : t.type === 'pay' ? 'سداد لمورد' : 'سحب / مصروفات',
          (t.amount || 0).toFixed(2),
          t.customerName || t.supplierName || t.note || '-',
          t.invoiceId ? `👁️ فاتورة #${t.invoiceId}` : '-',
        ],
        { invoiceId: t.invoiceId, invoiceType: invType, customerName: t.customerName, supplierName: t.supplierName }
      );
    });
    result.total = cashTx.reduce((s, x) => s + (x.amount || 0), 0);
    result.count = cashTx.length;
    result.title = isReceive ? 'تقرير المقبوضات والتحصيلات النقدية' : 'تقرير المدفوعات والمصروفات النقدية';
    return result;
  }

  // -------------------------------------------------------------
  // REPS REPORTS
  // -------------------------------------------------------------
  if (group === 'reps') {
    let reps = (appData.salesReps || []).filter((r) => {
      if (repName && r.name !== repName) return false;
      if (search && !matchesSearch(r.name) && !matchesSearch(r.region)) return false;
      return true;
    });

    if (reportName.includes('عمولة') || reportName.includes('عمولات')) {
      result.columns = ['المندوب', 'المنطقة', 'عدد الفواتير', 'إجمالي مبيعات المندوب (ج.م)', 'نسبة العمولة التقديرية', 'العمولة المستحقة (ج.م)'];
      reps.forEach((r) => {
        const rInvoices = appData.salesInvoices.filter((i) => i.salesRep === r.name);
        const rSalesTotal = rInvoices.reduce((s, i) => s + (i.total || 0), 0);
        const comm = r.commission || (rSalesTotal * 0.03);
        addRow([
          r.name,
          r.region || 'غير محدد',
          rInvoices.length.toString(),
          rSalesTotal.toFixed(2),
          '3%',
          comm.toFixed(2),
        ], { repName: r.name });
      });
      result.total = reps.reduce((s, r) => s + (r.commission || (appData.salesInvoices.filter((i) => i.salesRep === r.name).reduce((sum, x) => sum + x.total, 0) * 0.03)), 0);
      result.count = reps.length;
      result.title = 'تقرير كارت وحساب عمولات مندوبي المبيعات';
      return result;
    }

    result.columns = ['المندوب', 'المنطقة', 'رقم الهاتف', 'إجمالي المبيعات (ج.م)', 'العمولة المستحقة (ج.م)'];
    reps.forEach((r) => {
      addRow([
        r.name,
        r.region || '-',
        r.phone || '-',
        (r.totalSales || 0).toFixed(2),
        (r.commission || 0).toFixed(2),
      ], { repName: r.name });
    });
    result.total = reps.reduce((s, x) => s + (x.totalSales || 0), 0);
    result.count = reps.length;
    return result;
  }

  // -------------------------------------------------------------
  // BANKS REPORTS
  // -------------------------------------------------------------
  if (group === 'banks') {
    if (reportName.includes('شيك') || reportName.includes('قبض') || reportName.includes('دفع')) {
      let cheques = (appData.cheques || []).filter((c) => {
        const d = new Date(c.dueDate || c.issueDate);
        if (d < from || d > to) return false;
        if (search && !matchesSearch(c.chequeNumber) && !matchesSearch(c.bankName) && !matchesSearch(c.drawerName) && !matchesSearch(c.beneficiaryName)) return false;
        if (reportName.includes('قبض تحت التحصيل') && (c.type !== 'receivable' || c.status === 'collected' || c.status === 'cancelled')) return false;
        if (reportName.includes('أوراق الدفع') && (c.type !== 'payable' || c.status === 'collected' || c.status === 'cancelled')) return false;
        return true;
      });

      result.columns = ['رقم الورقة', 'نوع الورقة', 'الطرف الثاني (العميل/المورد)', 'البنك المسحوب عليه', 'تاريخ الاستحقاق', 'المبلغ (ج.م)', 'حالة الورقة', 'ملاحظات / الخزينة'];
      cheques.forEach((c) => {
        const isRec = c.type === 'receivable';
        const party = isRec ? c.drawerName : c.beneficiaryName;
        let statusLabel = 'مستلم بالحافظة';
        if (c.status === 'collected') statusLabel = 'تم التحصيل';
        else if (c.status === 'under_collection') statusLabel = 'تحت التحصيل';
        else if (c.status === 'bounced') statusLabel = 'مرتجع ومرفوض';
        else if (c.status === 'endorsed') statusLabel = 'مظهر لمورد';
        else if (c.type === 'payable') statusLabel = 'مستحق الصرف';

        let note = c.notes || (c.endorsedToSupplier ? `مظهر إلى: ${c.endorsedToSupplier}` : (isRec ? 'حافظة شيكات واردة' : 'خزينة أوراق الدفع'));

        addRow([
          c.chequeNumber.startsWith('CHK-') || c.chequeNumber.startsWith('PAY-') ? c.chequeNumber : (isRec ? 'CHK-' : 'PAY-') + c.chequeNumber,
          isRec ? 'قبض (شيك)' : 'دفع (شيك)',
          party,
          c.bankName,
          c.dueDate || '-',
          (c.amount || 0).toFixed(2),
          statusLabel,
          note,
        ]);
      });

      result.total = cheques.reduce((s, x) => s + (x.amount || 0), 0);
      result.count = cheques.length;
      result.title = 'تقرير حركة الشيكات وأوراق القبض والدفع';
      return result;
    }

    if (reportName.includes('تسوية') || reportName.includes('المطابقة البنكية') || reportName.includes('مذكرة التسوية')) {
      result.columns = ['الحساب البنكي', 'المرجع / الشيك', 'التاريخ', 'البيان بكشف الحساب', 'مدين / سحب (ج.م)', 'دائن / إيداع (ج.م)', 'حالة المطابقة'];
      const stmts = appData.bankStatements || [];
      stmts.forEach((s) => {
        const bankObj = appData.bankAccounts.find((b) => b.id === s.bankAccountId);
        addRow([
          bankObj ? bankObj.name : 'حساب بنكي',
          s.reference || '-',
          s.date,
          s.description,
          (s.debit || 0).toFixed(2),
          (s.credit || 0).toFixed(2),
          s.isReconciled ? '✅ تمت المطابقة' : '⏳ معلق للمراجعة',
        ]);
      });
      result.total = stmts.reduce((sum, s) => sum + (s.credit || 0) - (s.debit || 0), 0);
      result.count = stmts.length;
      result.title = 'مذكرة التسوية والمطابقة البنكية';
      return result;
    }

    if (reportName.includes('موافقات') || reportName.includes('اعتماد') || reportName.includes('الاعتمادات')) {
      result.columns = ['# المعاملة', 'الموديل / القسم', 'مقدم الطلب', 'المبلغ (ج.م)', 'الحالة', 'المعتمد', 'تاريخ الاعتماد'];
      const apps = appData.approvalRequests || [];
      apps.forEach((a) => {
        addRow([
          a.transactionNumber,
          a.module,
          a.requestedBy,
          (a.amount || 0).toFixed(2),
          a.status === 'approved' ? '✅ معتمد' : a.status === 'rejected' ? '❌ مرفوض' : '⏳ معلق',
          a.approvedBy || '-',
          a.approvedAt || '-',
        ]);
      });
      result.total = apps.reduce((sum, a) => sum + (a.amount || 0), 0);
      result.count = apps.length;
      result.title = 'تقرير دورة الموافقات والاعتمادات المالية';
      return result;
    }

    if (reportName.includes('فيزا') || reportName.includes('إلكترونية')) {
      const eTransactions = appData.cashTransactions.filter((t) => {
        const d = new Date(t.date);
        if (d < from || d > to) return false;
        return t.method === 'vodafone' || t.method === 'instapay' || t.method === 'bank';
      });

      result.columns = ['#', 'التاريخ', 'وسيلة الدفع الإلكترونية', 'نوع الحركة', 'المبلغ (ج.م)', 'الجهة / التفاصيل'];
      eTransactions.forEach((t) => {
        addRow([
          `#${t.id}`,
          t.date,
          t.method === 'vodafone' ? '📱 فودافون كاش' : t.method === 'instapay' ? '⚡ إنستاباي' : '🏦 حساب بنكي',
          t.type === 'receive' ? 'تحصيل وارد' : t.type === 'deposit' ? 'إيداع' : t.type === 'pay' ? 'سداد صادرة' : 'مسحوبات',
          (t.amount || 0).toFixed(2),
          t.customerName || t.supplierName || t.note || '-',
        ]);
      });

      result.total = eTransactions.reduce((s, x) => s + (x.amount || 0), 0);
      result.count = eTransactions.length;
      result.title = 'تقرير المعاملات والحركات البنكية والوسائل الإلكترونية';
      return result;
    }

    if (reportName.includes('وسائل') || reportName.includes('الوسائل') || reportName.includes('أرصدة الحسابات')) {
      result.columns = ['جهة الحساب / الخزينة', 'نقدي (الدرج)', 'فودافون كاش', 'إنستاباي', 'حساب بنكي', 'الإجمالي (ج.م)'];
      const drawer = appData.cashBox?.drawer || 0;
      const vodafone = appData.cashBox?.vodafone || 0;
      const instapay = appData.cashBox?.instapay || 0;
      const bank = appData.cashBox?.bank || 0;

      addRow(['الخزينة الرئيسية (الدرج العام)', drawer.toFixed(2), '0.00', '0.00', '0.00', drawer.toFixed(2)]);
      addRow(['محفظة فودافون كاش الرسمية', '0.00', vodafone.toFixed(2), '0.00', '0.00', vodafone.toFixed(2)]);
      addRow(['حساب إنستاباي السريع', '0.00', '0.00', instapay.toFixed(2), '0.00', instapay.toFixed(2)]);

      (appData.bankAccounts || []).forEach((b) => {
        const bBal = b.balance || 0;
        addRow([`حساب بنكي: ${b.name} (${b.accountNumber})`, '0.00', '0.00', '0.00', bBal.toFixed(2), bBal.toFixed(2)]);
      });

      const totalAll = drawer + vodafone + instapay + bank;
      result.total = totalAll;
      result.count = result.rows.length;
      result.title = 'تقرير الأرصدة النقدية ووسائل الدفع';
      return result;
    }

    let banks = (appData.bankAccounts || []).filter((b) => {
      if (search && !matchesSearch(b.name) && !matchesSearch(b.accountNumber)) return false;
      return true;
    });

    result.columns = ['اسم البنك / الفرع', 'رقم الحساب', 'الرصيد الحقيقي المتاح (ج.م)'];
    banks.forEach((b) => {
      addRow([
        b.name,
        b.accountNumber,
        (b.balance || 0).toFixed(2),
      ]);
    });
    result.total = banks.reduce((s, x) => s + (x.balance || 0), 0);
    result.count = banks.length;
    return result;
  }

  // -------------------------------------------------------------
  // MISC REPORTS
  // -------------------------------------------------------------
  const totalSalesVal = appData.salesInvoices.reduce((s, i) => s + (i.total || 0), 0);
  const totalPurchaseVal = appData.purchaseInvoices.reduce((s, i) => s + (i.total || 0), 0);
  const stockVal = appData.items.reduce((s, i) => s + (i.quantity || 0) * (i.purchasePrice || 0), 0);

  result.columns = ['بيان الحركة / الحساب', 'القيمة الحقيقية (ج.م)', 'عدد السجلات الفعلية'];
  [
    ['إجمالي مبيعات الفواتير', totalSalesVal.toFixed(2), appData.salesInvoices.length.toString()],
    ['إجمالي مشتريات الفواتير', totalPurchaseVal.toFixed(2), appData.purchaseInvoices.length.toString()],
    ['قيمة المخزون الإجمالية بسعر الشراء', stockVal.toFixed(2), appData.items.length.toString()],
    ['رصيد نقدية الدرج', (appData.cashBox?.drawer || 0).toFixed(2), 'نقدي'],
    ['رصيد فودافون كاش', (appData.cashBox?.vodafone || 0).toFixed(2), 'محفظة إلكترونية'],
    ['رصيد إنستاباي', (appData.cashBox?.instapay || 0).toFixed(2), 'إنستاباي'],
    ['رصيد الحسابات البنكية', (appData.cashBox?.bank || 0).toFixed(2), 'بنكي'],
  ].forEach((row) => addRow(row));

  result.total = totalSalesVal;
  result.count = result.rows.length;

  return result;
}
