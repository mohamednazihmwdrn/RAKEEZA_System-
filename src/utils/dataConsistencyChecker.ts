import { AppData } from '../types';

export interface ConsistencyIssue {
  id: string;
  category:
    | 'journal_unbalanced'
    | 'invoice_without_journal'
    | 'journal_without_invoice'
    | 'cash_without_source'
    | 'stock_without_source'
    | 'negative_stock'
    | 'duplicate_invoice_number'
    | 'duplicate_transaction_id'
    | 'customer_balance_mismatch'
    | 'supplier_balance_mismatch'
    | 'orphan_record'
    | 'cross_company_record'
    | 'missing_audit_log';
  severity: 'error' | 'warning' | 'info';
  title: string;
  details: string;
  entityId?: string | number;
  entityType?: string;
  companyId?: string;
}

export interface ConsistencyReport {
  timestamp: string;
  companyId: string;
  totalChecksRun: number;
  issuesCount: number;
  errorsCount: number;
  warningsCount: number;
  isHealthy: boolean;
  issues: ConsistencyIssue[];
  summary: {
    unbalancedJournals: number;
    invoicesWithoutJournals: number;
    negativeStockItems: number;
    duplicateInvoices: number;
    customerBalanceMismatches: number;
    supplierBalanceMismatches: number;
  };
}

/**
 * 🔍 فاحص التكامل والاتساق المحاسبي والمالي الشامل (RAKEEZA Accounting & Data Consistency Auditor)
 * يفحص ويكتشف الفروقات والأخطاء المحاسبية والتضاربات دون أي تعديل تلقائي أو تشويه للبيانات.
 */
export function runDataConsistencyCheck(appData: AppData, targetCompanyId?: string): ConsistencyReport {
  const companyId = targetCompanyId || appData.companyId || 'COMP-000001';
  const issues: ConsistencyIssue[] = [];

  const salesInvoices = (appData.salesInvoices || []).filter(
    (inv) => !inv.companyId || inv.companyId === companyId
  );
  const purchaseInvoices = (appData.purchaseInvoices || []).filter(
    (inv) => !inv.companyId || inv.companyId === companyId
  );
  const journalEntries = (appData.journalEntries || []).filter(
    (j) => !(j as any).companyId || (j as any).companyId === companyId
  );
  const cashTransactions = (appData.cashTransactions || []).filter(
    (c) => !(c as any).companyId || (c as any).companyId === companyId
  );
  const customers = appData.customers || [];
  const suppliers = appData.suppliers || [];
  const items = appData.items || [];
  const auditLogs = appData.auditLogs || [];

  // 1. Unbalanced Journal Entries (Total Debit !== Total Credit)
  journalEntries.forEach((entry) => {
    const lines = entry.lines || [];
    const debit = Math.round(lines.reduce((s, l) => s + (Number(l.debit) || 0), 0) * 100) / 100;
    const credit = Math.round(lines.reduce((s, l) => s + (Number(l.credit) || 0), 0) * 100) / 100;
    const diff = Math.abs(Math.round((debit - credit) * 100) / 100);

    if (diff > 0.01) {
      issues.push({
        id: `unbalanced_jv_${entry.id}`,
        category: 'journal_unbalanced',
        severity: 'error',
        title: `قيد محاسبي غير متوازن #${entry.entryNumber || entry.id}`,
        details: `إجمالي المدين (${debit.toFixed(2)}) لا يتساوى مع إجمالي الدائن (${credit.toFixed(2)}) بفارق قدره ${diff.toFixed(2)}.`,
        entityId: entry.id,
        entityType: 'journalEntry',
        companyId,
      });
    }
  });

  // 2. Invoices Without Linked Journal Entries
  salesInvoices.forEach((inv) => {
    const hasJv = journalEntries.some(
      (j) =>
        j.reference === `SALE-INV-${inv.id}` ||
        j.reference === `INV-${inv.id}` ||
        (j as any).invoiceId === inv.id
    );
    if (!hasJv) {
      issues.push({
        id: `sale_no_jv_${inv.id}`,
        category: 'invoice_without_journal',
        severity: 'warning',
        title: `فاتورة مبيعات #${inv.id} بدون قيد يومية مسجل`,
        details: `الفاتورة بقيمة ${inv.total.toFixed(2)} للعميل "${inv.customerName}" لا يوجد لها قيد يومية مرتبط.`,
        entityId: inv.id,
        entityType: 'saleInvoice',
        companyId,
      });
    }
  });

  purchaseInvoices.forEach((inv) => {
    const hasJv = journalEntries.some(
      (j) =>
        j.reference === `PUR-INV-${inv.id}` ||
        j.reference === `PUR-${inv.id}` ||
        (j as any).invoiceId === inv.id
    );
    if (!hasJv) {
      issues.push({
        id: `pur_no_jv_${inv.id}`,
        category: 'invoice_without_journal',
        severity: 'warning',
        title: `فاتورة مشتريات #${inv.id} بدون قيد يومية مسجل`,
        details: `الفاتورة بقيمة ${inv.total.toFixed(2)} للمورد "${inv.supplierName}" لا يوجد لها قيد يومية مرتبط.`,
        entityId: inv.id,
        entityType: 'purchaseInvoice',
        companyId,
      });
    }
  });

  // 3. Duplicate Invoice Numbers
  const saleIdsSeen = new Set<number>();
  const duplicateSaleIds = new Set<number>();
  salesInvoices.forEach((inv) => {
    if (saleIdsSeen.has(inv.id)) {
      duplicateSaleIds.add(inv.id);
    }
    saleIdsSeen.add(inv.id);
  });
  duplicateSaleIds.forEach((dupId) => {
    issues.push({
      id: `dup_sale_id_${dupId}`,
      category: 'duplicate_invoice_number',
      severity: 'error',
      title: `رقم فاتورة مبيعات مكرر #${dupId}`,
      details: `تم العثور على أكثر من فاتورة مبيعات مسجلة بنفس الرقم #${dupId}.`,
      entityId: dupId,
      entityType: 'saleInvoice',
      companyId,
    });
  });

  const purIdsSeen = new Set<number>();
  const duplicatePurIds = new Set<number>();
  purchaseInvoices.forEach((inv) => {
    if (purIdsSeen.has(inv.id)) {
      duplicatePurIds.add(inv.id);
    }
    purIdsSeen.add(inv.id);
  });
  duplicatePurIds.forEach((dupId) => {
    issues.push({
      id: `dup_pur_id_${dupId}`,
      category: 'duplicate_invoice_number',
      severity: 'error',
      title: `رقم فاتورة مشتريات مكرر #${dupId}`,
      details: `تم العثور على أكثر من فاتورة مشتريات مسجلة بنفس الرقم #${dupId}.`,
      entityId: dupId,
      entityType: 'purchaseInvoice',
      companyId,
    });
  });

  // 4. Negative Stock Items
  items.forEach((item) => {
    const qty = Number(item.quantity ?? 0);
    if (qty < 0) {
      issues.push({
        id: `neg_stock_${item.id}`,
        category: 'negative_stock',
        severity: 'warning',
        title: `رصيد مخزني سالب للصنف "${item.name}"`,
        details: `الكمية الحالية في المخزن (${qty}) بالسالب، يرجى تسوية رصيد الصنف بجرد أو فاتورة مشتريات.`,
        entityId: item.id,
        entityType: 'item',
        companyId,
      });
    }
  });

  // 5. Customer Balance Mismatch (Ledger vs Stored Balance)
  customers.forEach((cust) => {
    const storedBalance = Number(cust.balance ?? 0);
    const txs = cust.transactions || [];
    let calculatedBalance = 0;

    txs.forEach((tx) => {
      const debit = Number(tx.debit ?? 0);
      const credit = Number(tx.credit ?? 0);
      calculatedBalance += debit - credit;
    });

    const diff = Math.abs(Math.round((storedBalance - calculatedBalance) * 100) / 100);
    if (diff > 0.05 && txs.length > 0) {
      issues.push({
        id: `cust_balance_mismatch_${cust.id}`,
        category: 'customer_balance_mismatch',
        severity: 'warning',
        title: `عدم تطابق رصيد العميل "${cust.name}"`,
        details: `الرصيد المحفوظ (${storedBalance.toFixed(2)}) يختلف عن مجموع حركات كشف الحساب (${calculatedBalance.toFixed(2)}) بفارق ${diff.toFixed(2)}.`,
        entityId: cust.id,
        entityType: 'customer',
        companyId,
      });
    }
  });

  // 6. Supplier Balance Mismatch (Ledger vs Stored Balance)
  suppliers.forEach((supp) => {
    const storedBalance = Number(supp.balance ?? 0);
    const txs = supp.transactions || [];
    let calculatedBalance = 0;

    txs.forEach((tx) => {
      const debit = Number(tx.debit ?? 0);
      const credit = Number(tx.credit ?? 0);
      calculatedBalance += credit - debit;
    });

    const diff = Math.abs(Math.round((storedBalance - calculatedBalance) * 100) / 100);
    if (diff > 0.05 && txs.length > 0) {
      issues.push({
        id: `supp_balance_mismatch_${supp.id}`,
        category: 'supplier_balance_mismatch',
        severity: 'warning',
        title: `عدم تطابق رصيد المورد "${supp.name}"`,
        details: `الرصيد المحفوظ (${storedBalance.toFixed(2)}) يختلف عن مجموع حركات كشف الحساب (${calculatedBalance.toFixed(2)}) بفارق ${diff.toFixed(2)}.`,
        entityId: supp.id,
        entityType: 'supplier',
        companyId,
      });
    }
  });

  // 7. Cash Transactions Without Invoices or Notes
  cashTransactions.forEach((tx) => {
    if (!tx.invoiceId && !tx.customerName && !tx.supplierName && (!tx.note || tx.note.trim() === '')) {
      issues.push({
        id: `cash_orphan_${tx.id}`,
        category: 'cash_without_source',
        severity: 'info',
        title: `حركة خزينة #${tx.id} بدون مصدر محدد`,
        details: `حركة نقدية بمبلغ ${Number(tx.amount).toFixed(2)} لا ترتبط برقم فاتورة أو اسم جهة أو بيان توضيحي.`,
        entityId: tx.id,
        entityType: 'cashTransaction',
        companyId,
      });
    }
  });

  // 8. Cross-Company Contamination Check
  if (appData.companyId) {
    salesInvoices.forEach((inv) => {
      if (inv.companyId && inv.companyId !== appData.companyId) {
        issues.push({
          id: `cross_comp_sale_${inv.id}`,
          category: 'cross_company_record',
          severity: 'error',
          title: `سجل ينتمي لمنشأة أخرى: فاتورة مبيعات #${inv.id}`,
          details: `الفاتورة تابعة للمنشأة "${inv.companyId}" بينما المنشأة النشطة هي "${appData.companyId}".`,
          entityId: inv.id,
          entityType: 'saleInvoice',
          companyId,
        });
      }
    });
  }

  const errorsCount = issues.filter((i) => i.severity === 'error').length;
  const warningsCount = issues.filter((i) => i.severity === 'warning').length;

  return {
    timestamp: new Date().toISOString(),
    companyId,
    totalChecksRun: 8,
    issuesCount: issues.length,
    errorsCount,
    warningsCount,
    isHealthy: errorsCount === 0 && warningsCount === 0,
    issues,
    summary: {
      unbalancedJournals: issues.filter((i) => i.category === 'journal_unbalanced').length,
      invoicesWithoutJournals: issues.filter((i) => i.category === 'invoice_without_journal').length,
      negativeStockItems: issues.filter((i) => i.category === 'negative_stock').length,
      duplicateInvoices: issues.filter((i) => i.category === 'duplicate_invoice_number').length,
      customerBalanceMismatches: issues.filter((i) => i.category === 'customer_balance_mismatch').length,
      supplierBalanceMismatches: issues.filter((i) => i.category === 'supplier_balance_mismatch').length,
    },
  };
}
