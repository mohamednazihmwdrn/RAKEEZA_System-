import React, { useState, useEffect } from 'react';
import { Calendar, Lock, CloudDownload, RefreshCw, CheckCircle, ShieldCheck } from 'lucide-react';
import { AppData, SaleInvoice, PurchaseInvoice } from '../types';
import { firestoreShardingService } from '../services/firestoreShardingService';
import { printInvoiceWindow } from '../utils/printInvoice';
import { printStatementWindow } from '../utils/printStatement';
import { printReportWindow } from '../utils/printReport';
import { printShiftReportWindow } from '../utils/printShiftReport';
import { printCashClosingWindow } from '../utils/printCashClosing';
import { printChequesReport } from '../utils/printChequesReport';
import { printCashBalancesReportWindow } from '../utils/printCashBalancesReport';
import { printDailyTransactionsReportWindow } from '../utils/printDailyTransactionsReport';
import { printBankReconciliationReportWindow } from '../utils/printBankReconciliationReport';
import { exportElementToPdf } from '../utils/pdfExport';
import { exportToExcel } from '../utils/excelExport';
import {
  vendorReports,
  purchaseReports,
  customerReports,
  salesReports,
  receiptsReports,
  paymentsReports,
  repsReports,
  banksReports,
  miscReports,
  generateReportData,
  ReportFilters,
  ReportRowData,
} from '../utils/reportsData';
import { Modal } from './Modal';

interface ReportsViewProps {
  appData: AppData;
  pageId: string;
  onNavigate: (page: string) => void;
  onUpdateData?: (newData: AppData) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ pageId, onNavigate, onUpdateData, showToast, appData }) => {
  const parts = pageId.split('_');

  // Fiscal Year & Dates
  const currentActiveYear = appData.currentActiveFiscalYear || appData.settings?.fiscalYear || `${new Date().getFullYear()}`;
  const initialYear = appData.viewingClosedYear || currentActiveYear;
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>(initialYear);
  const [isFetchingCloudYear, setIsFetchingCloudYear] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];
  const monthAgo = new Date();
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  const monthAgoStr = monthAgo.toISOString().split('T')[0];

  const defaultFrom = appData.viewingClosedYear ? `${appData.viewingClosedYear}-01-01` : monthAgoStr;
  const defaultTo = appData.viewingClosedYear ? `${appData.viewingClosedYear}-12-31` : todayStr;

  // Applied Filters State (active report state)
  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);
  const [search, setSearch] = useState('');

  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedItem, setSelectedItem] = useState('');
  const [selectedRep, setSelectedRep] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [searchTargetMode, setSearchTargetMode] = useState<'all' | 'customers' | 'suppliers'>('all');

  // Draft Filter Inputs (for typing before clicking Search)
  const [draftFromDate, setDraftFromDate] = useState(defaultFrom);
  const [draftToDate, setDraftToDate] = useState(defaultTo);
  const [draftSearch, setDraftSearch] = useState('');

  // Sync when viewingClosedYear in appData changes
  useEffect(() => {
    if (appData.viewingClosedYear) {
      setSelectedFiscalYear(appData.viewingClosedYear);
      const yr = appData.viewingClosedYear;
      setFromDate(`${yr}-01-01`);
      setToDate(`${yr}-12-31`);
      setDraftFromDate(`${yr}-01-01`);
      setDraftToDate(`${yr}-12-31`);
    }
  }, [appData.viewingClosedYear]);

  const [draftCustomer, setDraftCustomer] = useState('');
  const [draftSupplier, setDraftSupplier] = useState('');
  const [draftItem, setDraftItem] = useState('');
  const [draftRep, setDraftRep] = useState('');
  const [draftMethod, setDraftMethod] = useState('');
  const [draftType, setDraftType] = useState('');
  const [draftTargetMode, setDraftTargetMode] = useState<'all' | 'customers' | 'suppliers'>('all');

  // Custom Builder State
  const [customSource, setCustomSource] = useState('sales');
  const [customGroupBy, setCustomGroupBy] = useState('none');

  // Drill-down Modal State
  const [viewingInvoice, setViewingInvoice] = useState<{ id: number; type: 'sale' | 'purchase' } | null>(null);

  // Payment Modal State
  const [payModalInvoice, setPayModalInvoice] = useState<{ inv: SaleInvoice | PurchaseInvoice; isSale: boolean } | null>(null);
  const [payAmountInput, setPayAmountInput] = useState<string>('');
  const [payMethodInput, setPayMethodInput] = useState<'drawer' | 'vodafone' | 'instapay' | 'bank'>('drawer');

  const handleOpenPaymentModal = (inv: SaleInvoice | PurchaseInvoice, isSale: boolean) => {
    const paid = inv.paidAmount || 0;
    const rem = inv.remainingAmount !== undefined ? inv.remainingAmount : (inv.total - paid);
    setPayModalInvoice({ inv, isSale });
    setPayAmountInput(rem > 0 ? rem.toString() : '0');
    setPayMethodInput('drawer');
  };

  const handleConfirmPayment = () => {
    if (!payModalInvoice) return;
    const val = parseFloat(payAmountInput);
    if (!val || val <= 0) {
      showToast('يرجى إدخال مبلغ دفع صحيح أكبر من صفر', 'warning');
      return;
    }
    const { inv, isSale } = payModalInvoice;
    const paid = inv.paidAmount || 0;
    const rem = inv.remainingAmount !== undefined ? inv.remainingAmount : (inv.total - paid);
    if (val > rem) {
      showToast('المبلغ المدفوع يتجاوز القيمة المتبقية للفاتورة', 'error');
      return;
    }

    const updatedData = { ...appData };
    if (isSale) {
      const saleInv = updatedData.salesInvoices.find((s) => s.id === inv.id);
      if (saleInv) {
        saleInv.paidAmount = (saleInv.paidAmount || 0) + val;
        saleInv.remainingAmount = saleInv.total - saleInv.paidAmount;
        updatedData.cashBox[payMethodInput] += val;
        const cust = updatedData.customers.find((c) => c.name === saleInv.customerName);
        if (cust) cust.balance = Math.max(0, (cust.balance || 0) - val);

        updatedData.cashTransactions.push({
          id: updatedData.nextCashId++,
          date: new Date().toISOString().split('T')[0],
          type: 'receive',
          method: payMethodInput,
          amount: val,
          note: `سداد/تحصيل فاتورة مبيعات #${saleInv.id} - ${saleInv.customerName}`,
          customerName: saleInv.customerName,
          invoiceId: saleInv.id,
        });
      }
    } else {
      const purInv = updatedData.purchaseInvoices.find((p) => p.id === inv.id);
      if (purInv) {
        purInv.paidAmount = (purInv.paidAmount || 0) + val;
        purInv.remainingAmount = purInv.total - purInv.paidAmount;
        updatedData.cashBox[payMethodInput] -= val;
        const supp = updatedData.suppliers.find((s) => s.name === purInv.supplierName);
        if (supp) supp.balance = Math.max(0, (supp.balance || 0) - val);

        updatedData.cashTransactions.push({
          id: updatedData.nextCashId++,
          date: new Date().toISOString().split('T')[0],
          type: 'pay',
          method: payMethodInput,
          amount: val,
          note: `سداد/دفعة فاتورة مشتريات #${purInv.id} - ${purInv.supplierName}`,
          supplierName: purInv.supplierName,
          invoiceId: purInv.id,
        });
      }
    }

    if (onUpdateData) {
      onUpdateData(updatedData);
    }
    setPayModalInvoice(null);
    showToast(`تم تسجيل ${isSale ? 'تحصيل' : 'سداد'} مبلغ ${val.toFixed(2)} ج.م بنجاح`, 'success');
  };

  // Trigger search handler
  const handleExecuteSearch = () => {
    setFromDate(draftFromDate);
    setToDate(draftToDate);
    setSearch(draftSearch);
    setSearchTargetMode(draftTargetMode);

    if (draftTargetMode === 'customers') {
      setSelectedCustomer(draftCustomer);
      setSelectedSupplier('');
    } else if (draftTargetMode === 'suppliers') {
      setSelectedCustomer('');
      setSelectedSupplier(draftSupplier);
    } else {
      setSelectedCustomer(draftCustomer);
      setSelectedSupplier(draftSupplier);
    }

    setSelectedItem(draftItem);
    setSelectedRep(draftRep);
    setSelectedMethod(draftMethod);
    setSelectedType(draftType);
    showToast('تم تطبيق الفلاتر واستخراج التقرير بنجاح', 'info');
  };

  // Reset filters handler
  const handleResetFilters = () => {
    setDraftFromDate(monthAgoStr);
    setDraftToDate(todayStr);
    setDraftSearch('');
    setDraftCustomer('');
    setDraftSupplier('');
    setDraftItem('');
    setDraftRep('');
    setDraftMethod('');
    setDraftType('');
    setDraftTargetMode('all');

    setFromDate(monthAgoStr);
    setToDate(todayStr);
    setSearch('');
    setSelectedCustomer('');
    setSelectedSupplier('');
    setSelectedItem('');
    setSelectedRep('');
    setSelectedMethod('');
    setSelectedType('');
    setSearchTargetMode('all');
    showToast('تم إعادة ضبط جميع الفلاتر', 'info');
  };

  // Quick Date Helpers
  const handleQuickDate = (type: 'today' | 'week' | 'month' | 'year' | 'all') => {
    const t = new Date();
    const tStr = t.toISOString().split('T')[0];
    setDraftToDate(tStr);

    let fStr = tStr;
    if (type === 'today') {
      fStr = tStr;
    } else if (type === 'week') {
      const w = new Date();
      w.setDate(w.getDate() - 7);
      fStr = w.toISOString().split('T')[0];
    } else if (type === 'month') {
      const m = new Date();
      m.setMonth(m.getMonth() - 1);
      fStr = m.toISOString().split('T')[0];
    } else if (type === 'year') {
      const y = new Date();
      y.setFullYear(y.getFullYear() - 1);
      fStr = y.toISOString().split('T')[0];
    } else if (type === 'all') {
      fStr = '2020-01-01';
    }

    setDraftFromDate(fStr);
    setFromDate(fStr);
    setToDate(tStr);
  };

  // Overview groups screen
  if (pageId === 'reports_group' || parts.length === 1) {
    const groups = [
      { id: 'reports_custom', label: '🛠️ مُصمم التقارير الديناميكي المخصص', icon: '⚡' },
      { id: 'reports_vendors', label: '📁 الموردين (24 تقرير)', icon: '🏭' },
      { id: 'reports_purchases', label: '📁 المشتريات (16 تقرير)', icon: '🛒' },
      { id: 'reports_customers', label: '📁 العملاء (35 تقرير)', icon: '👥' },
      { id: 'reports_sales', label: '📁 المبيعات (20 تقرير)', icon: '💰' },
      { id: 'reports_receipts', label: '📁 المقبوضات (6 تقارير)', icon: '📥' },
      { id: 'reports_payments', label: '📁 المدفوعات (10 تقارير)', icon: '📤' },
      { id: 'reports_reps', label: '📁 المندوبين (26 تقرير)', icon: '👔' },
      { id: 'reports_banks', label: '📁 البنوك والوسائل (6 تقارير)', icon: '🏦' },
      { id: 'reports_misc', label: '📁 تقارير متنوعة (19 تقرير)', icon: '📊' },
    ];

    return (
      <div className="space-y-6">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap justify-between items-center gap-3">
          <div>
            <h3 className="text-lg font-bold text-[#1a237e]">📊 نظام التقارير والتحليلات الديناميكية</h3>
            <p className="text-gray-500 text-xs">
              جميع التقارير تعتمد 100% على البيانات الحقيقية التي تدخلها في النظام، مع إمكانية البحث المباشر والتصفية والتأشر على أي حركة أو فاتورة لرؤية التفاصيل الكاملة
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => printShiftReportWindow(appData, undefined, undefined, showToast)}
              className="bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-900 px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              title="طباعة تقرير ملخص الشفت والأرباح اليومية المعتمد"
            >
              <span>📈</span>
              <span>طباعة ملخص الشفت والأرباح</span>
            </button>
            <button
              onClick={() => printCashClosingWindow(appData, undefined, undefined, undefined, showToast)}
              className="bg-[#1a237e] hover:bg-[#0d47a1] text-white px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              title="طباعة تقفيل يومية الخزينة متعدد الوسائل"
            >
              <span>📑</span>
              <span>طباعة تقفيل اليومية</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {groups.map((g) => (
            <div
              key={g.id}
              onClick={() => onNavigate(g.id)}
              className="bg-white p-5 rounded-2xl shadow-sm border-2 border-transparent hover:border-[#1a237e] hover:-translate-y-1 transition cursor-pointer text-center group"
            >
              <div className="text-4xl mb-2 group-hover:scale-110 transition transform">{g.icon}</div>
              <h4 className="text-sm md:text-base font-bold text-[#1a237e]">{g.label}</h4>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Category view screen (e.g., reports_vendors)
  if (parts.length === 2 && parts[1] !== 'custom') {
    const groupKey = parts[1];
    const categoryMaps: Record<string, { label: string; reports: string[] }> = {
      vendors: { label: 'الموردين', reports: vendorReports },
      purchases: { label: 'المشتريات', reports: purchaseReports },
      customers: { label: 'العملاء', reports: customerReports },
      sales: { label: 'المبيعات', reports: salesReports },
      receipts: { label: 'المقبوضات', reports: receiptsReports },
      payments: { label: 'المدفوعات', reports: paymentsReports },
      reps: { label: 'المندوبين', reports: repsReports },
      banks: { label: 'البنوك والوسائل', reports: banksReports },
      misc: { label: 'تقارير متنوعة', reports: miscReports },
    };

    const currentCat = categoryMaps[groupKey] || { label: groupKey, reports: [] };

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <button
            onClick={() => onNavigate('reports_group')}
            className="bg-[#1a237e] hover:bg-[#0d47a1] text-white px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            ↩ العودة لقائمة التقارير
          </button>
          <span className="font-bold text-[#1a237e] text-base">تقارير {currentCat.label}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {currentCat.reports.map((rep) => {
            const linkId = `reports_${groupKey}_${rep.replace(/\s+/g, '_')}`;
            return (
              <div
                key={rep}
                onClick={() => onNavigate(linkId)}
                className="bg-white p-4 rounded-2xl shadow-sm border-2 border-transparent hover:border-[#1a237e] hover:-translate-y-1 transition cursor-pointer text-center flex flex-col justify-between"
              >
                <div>
                  <div className="text-2xl mb-1">📄</div>
                  <h4 className="text-xs md:text-sm font-bold text-[#1a237e] mb-2">{rep}</h4>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate(linkId);
                  }}
                  className="mt-2 bg-[#1a237e] hover:bg-[#0d47a1] text-white py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer w-full shadow-xs"
                >
                  👁️ عرض التقرير
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Determine group and report name
  const isCustomMode = parts[1] === 'custom';
  const groupKey = isCustomMode ? 'custom' : parts[1];
  const reportName = isCustomMode ? 'تقرير ديناميكي مخصص' : parts.slice(2).join('_').replace(/_/g, ' ');

  const currentFilters: ReportFilters = {
    fromDate,
    toDate,
    search,
    customerName: selectedCustomer,
    supplierName: selectedSupplier,
    itemName: selectedItem,
    repName: selectedRep,
    paymentMethod: selectedMethod,
    invoiceType: selectedType,
    dataSource: isCustomMode ? customSource : undefined,
    groupBy: isCustomMode ? customGroupBy : undefined,
  };

  const availableYears = firestoreShardingService.getAvailableFiscalYearsList(
    appData.companyId || 'COMP-000001',
    appData
  );

  const isSelectedYearClosed = (appData.fiscalClosings || []).some(
    (c) => c.fiscalYear === selectedFiscalYear && c.status === 'completed'
  ) || (selectedFiscalYear !== currentActiveYear);

  const handleSelectFiscalYear = (yr: string) => {
    setSelectedFiscalYear(yr);
    const newFrom = `${yr}-01-01`;
    const newTo = yr === `${new Date().getFullYear()}` ? todayStr : `${yr}-12-31`;
    setDraftFromDate(newFrom);
    setDraftToDate(newTo);
    setFromDate(newFrom);
    setToDate(newTo);
  };

  const handleSelectPeriod = (period: 'full' | 'q1' | 'q2' | 'q3' | 'q4') => {
    const yr = selectedFiscalYear;
    let from = `${yr}-01-01`;
    let to = `${yr}-12-31`;
    if (period === 'q1') {
      from = `${yr}-01-01`;
      to = `${yr}-03-31`;
    } else if (period === 'q2') {
      from = `${yr}-04-01`;
      to = `${yr}-06-30`;
    } else if (period === 'q3') {
      from = `${yr}-07-01`;
      to = `${yr}-09-30`;
    } else if (period === 'q4') {
      from = `${yr}-10-01`;
      to = `${yr}-12-31`;
    }
    setDraftFromDate(from);
    setDraftToDate(to);
    setFromDate(from);
    setToDate(to);
  };

  const handleFetchCloudRecordsForYear = async (yr: string) => {
    try {
      setIsFetchingCloudYear(true);
      showToast(`جاري استدعاء سجلات وفواتير السنة (${yr}) من مجموعات فايربيس السحابية...`, 'info');
      const res = await firestoreShardingService.fetchClosedFiscalYearComprehensiveData(
        appData.companyId || 'COMP-000001',
        yr,
        appData
      );

      if (onUpdateData && res.salesInvoices.length > 0) {
        const map = new Map<string, SaleInvoice>();
        (appData.salesInvoices || []).forEach((i) => map.set(String(i.id), i));
        res.salesInvoices.forEach((i) => map.set(String(i.id), i));

        const updated: AppData = {
          ...appData,
          salesInvoices: Array.from(map.values()),
        };
        onUpdateData(updated);
        showToast(`تم جلب ${res.salesInvoices.length} فاتورة وسجل للسنة (${yr}) بنجاح للمراجعة والطباعة`, 'success');
      } else {
        showToast(`سجلات السنة (${yr}) محملة بالكامل ومطابقة للمستودع السحابي`, 'info');
      }
    } catch (e) {
      showToast('تعذر استدعاء السجلات من السحابة حالياً', 'error');
    } finally {
      setIsFetchingCloudYear(false);
    }
  };

  const reportData = generateReportData(groupKey, reportName, currentFilters, appData);

  const handleExportExcel = () => {
    try {
      const exportRows = reportData.rows.map((row) => {
        const rowObj: Record<string, any> = {};
        reportData.columns.forEach((col, idx) => {
          rowObj[`col_${idx}`] = row[idx] ?? '';
        });
        return rowObj;
      });

      const excelColumns = reportData.columns.map((col, idx) => ({
        header: col,
        key: `col_${idx}`,
        width: Math.max(16, col.length * 2 + 4),
      }));

      exportToExcel({
        filename: `${groupKey}_${reportName}_سنة_${selectedFiscalYear}_${new Date().toISOString().split('T')[0]}`,
        sheetName: reportData.title || reportName || 'التقرير',
        data: exportRows,
        columns: excelColumns,
        companyName: appData.settings?.companyName || 'المنظومة المحاسبية المعتمدة',
        reportTitle: `${reportData.title || reportName} - سنة ${selectedFiscalYear} ${isSelectedYearClosed ? '(مقفلة للمراجعة)' : ''} (من ${fromDate} إلى ${toDate})`,
      });
      showToast('تم تصدير التقرير إلى ملف Excel بنجاح', 'success');
    } catch (e) {
      // Fallback to CSV
      let csv = '';
      csv += reportData.columns.map((c) => `"${c}"`).join(',') + '\n';
      reportData.rows.forEach((row) => {
        csv += row.map((cell) => `"${cell}"`).join(',') + '\n';
      });

      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${groupKey}_${reportName}_سنة_${selectedFiscalYear}_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      showToast('تم تصدير التقرير إلى ملف Excel (CSV) بنجاح', 'success');
    }
  };

  const handlePrintReport = () => {
    if (selectedCustomer) {
      printStatementWindow(selectedCustomer, 'customer', appData, fromDate, toDate, showToast);
      return;
    }
    if (selectedSupplier) {
      printStatementWindow(selectedSupplier, 'supplier', appData, fromDate, toDate, showToast);
      return;
    }
    if (
      (groupKey === 'customers' || reportName.includes('عميل') || reportName.includes('العملاء')) &&
      appData.customers.length > 0
    ) {
      const party = selectedCustomer || appData.customers[0].name;
      printStatementWindow(party, 'customer', appData, fromDate, toDate, showToast);
      return;
    }
    if (
      (groupKey === 'vendors' || reportName.includes('مورد') || reportName.includes('الموردين')) &&
      appData.suppliers.length > 0
    ) {
      const party = selectedSupplier || appData.suppliers[0].name;
      printStatementWindow(party, 'supplier', appData, fromDate, toDate, showToast);
      return;
    }
    if (
      reportName.includes('وسائل') ||
      reportName.includes('الوسائل') ||
      reportName.includes('أرصدة الحسابات') ||
      reportName.includes('الأرصدة النقدية')
    ) {
      printCashBalancesReportWindow(appData, showToast);
      return;
    }
    if (
      reportName.includes('حركة العمليات') ||
      reportName.includes('الحركة اليومية') ||
      reportName.includes('الحركة المالية اليومية') ||
      reportName.includes('العمليات اليومية')
    ) {
      printDailyTransactionsReportWindow(appData, fromDate, undefined, showToast);
      return;
    }
    if (
      reportName.includes('تسوية') ||
      reportName.includes('المطابقة البنكية') ||
      reportName.includes('مذكرة التسوية')
    ) {
      printBankReconciliationReportWindow(appData, undefined, fromDate, showToast);
      return;
    }
    if (groupKey === 'banks' && (reportName.includes('شيك') || reportName.includes('قبض') || reportName.includes('دفع'))) {
      printChequesReport(
        {
          title: reportData.title || reportName,
          fromDate,
          toDate,
          filterType: reportName.includes('قبض') ? 'receivable' : reportName.includes('دفع') ? 'payable' : 'all',
          filterStatus: reportName.includes('تحت التحصيل') ? 'under_collection' : 'all',
        },
        appData
      );
      return;
    }
    const reportToPrint = {
      ...reportData,
      title: `${reportData.title || reportName} - سنة ${selectedFiscalYear} ${isSelectedYearClosed ? '(مقفلة للمراجعة والطباعة)' : ''}`,
    };
    printReportWindow(reportToPrint, appData, fromDate, toDate, showToast);
  };

  // Direct PDF Exporter using html2canvas & jsPDF
  const handleExportPdf = async () => {
    const printableEl = document.getElementById('report-printable-card');
    if (printableEl) {
      showToast('جاري تصدير التقرير كملف PDF عالي الجودة...', 'info');
      try {
        await exportElementToPdf(
          printableEl,
          `${reportData.title || reportName}_سنة_${selectedFiscalYear}_${fromDate}_${toDate}.pdf`,
          {
            orientation: (reportData.columns?.length || 0) > 5 ? 'landscape' : 'portrait',
            format: (appData.settings?.paperSize?.toLowerCase() as any) || 'a4',
            margin: appData.settings?.pageMargin ?? 5,
          }
        );
        showToast('تم تحميل وتصدير ملف PDF بنجاح', 'success');
      } catch (err) {
        console.error('PDF export fallback:', err);
        showToast('جاري فتح نافذة الطباعة المباشرة لتصدير PDF...', 'info');
        handlePrintReport();
      }
    } else {
      handlePrintReport();
    }
  };

  // Row click handler for drill-down
  const handleRowClick = (detail?: ReportRowData) => {
    if (!detail) return;

    if (detail.invoiceId) {
      // If invoice ID exists, determine type and open invoice modal
      let invType: 'sale' | 'purchase' = detail.invoiceType || 'sale';
      if (!detail.invoiceType) {
        if (groupKey === 'purchases' || groupKey === 'vendors') invType = 'purchase';
      }
      setViewingInvoice({ id: detail.invoiceId, type: invType });
      return;
    }

    if (detail.supplierName) {
      // Filter by supplier name and navigate to vendor account statement
      setDraftSupplier(detail.supplierName);
      setSelectedSupplier(detail.supplierName);
      showToast(`تم فتح كشف حساب المورد: ${detail.supplierName}`, 'success');
      onNavigate('reports_vendors_كشف_حساب');
      return;
    }

    if (detail.customerName) {
      // Filter by customer name and navigate to customer account statement
      setDraftCustomer(detail.customerName);
      setSelectedCustomer(detail.customerName);
      showToast(`تم فتح كشف حساب العميل: ${detail.customerName}`, 'success');
      onNavigate('reports_customers_كشف_حساب_عميل');
      return;
    }

    if (detail.repName) {
      // Filter by rep name and navigate to rep account statement
      setDraftRep(detail.repName);
      setSelectedRep(detail.repName);
      showToast(`تم فتح كشف حساب المندوب: ${detail.repName}`, 'success');
      onNavigate('reports_reps_كشف_حساب_مندوب');
      return;
    }

    if (detail.itemName) {
      // Filter by item name and navigate to itemized movements
      setDraftItem(detail.itemName);
      setSelectedItem(detail.itemName);
      showToast(`تم فتح حركة الصنف: ${detail.itemName}`, 'info');
      if (groupKey === 'purchases' || groupKey === 'vendors') {
        onNavigate('reports_purchases_تفصيلي_فواتير_المشتريات');
      } else {
        onNavigate('reports_sales_تفصيلي_فواتير_المبيعات');
      }
      return;
    }
  };

  // Find active invoice object for Modal
  let activeSaleInvoice: SaleInvoice | undefined;
  let activePurchaseInvoice: PurchaseInvoice | undefined;
  if (viewingInvoice) {
    if (viewingInvoice.type === 'sale') {
      activeSaleInvoice = appData.salesInvoices.find((x) => x.id === viewingInvoice.id);
    } else {
      activePurchaseInvoice = appData.purchaseInvoices.find((x) => x.id === viewingInvoice.id);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate(isCustomMode ? 'reports_group' : `reports_${groupKey}`)}
            className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            ↩ العودة
          </button>
          <div>
            <h3 className="font-bold text-[#1a237e] text-base">{reportData.title || reportName}</h3>
            <span className="text-xs text-gray-500">بيانات دقيقة 100% محسوبة من فواتير وحسابات النظام الحقيقية</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleExportExcel}
            className="bg-[#2e7d32] hover:bg-[#1b5e20] text-white px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-sm"
          >
            📊 تصدير Excel
          </button>
          <button
            onClick={handleExportPdf}
            className="bg-[#c2410c] hover:bg-[#9a3412] text-white px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-sm"
          >
            📥 تصدير PDF
          </button>
          <button
            onClick={handlePrintReport}
            className="bg-[#1a237e] hover:bg-[#0d47a1] text-white px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-sm"
          >
            🖨️ طباعة التقرير
          </button>
        </div>
      </div>

      {/* 📅 Enterprise Fiscal Year Reporting & Closed Year Review Bar */}
      <div className={`p-4 rounded-2xl border transition-all shadow-sm ${
        isSelectedYearClosed
          ? 'bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-slate-50 border-amber-300 ring-1 ring-amber-200'
          : 'bg-white border-slate-200'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Year Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-800 shrink-0">
              <Calendar className="w-4 h-4 text-blue-700" />
              <span>السنة المالية للتقرير:</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {availableYears.map((yr) => {
                const isSelected = yr.year === selectedFiscalYear;
                const isClosed = yr.isClosed;
                const isCurrent = yr.isCurrent;

                return (
                  <button
                    key={yr.year}
                    type="button"
                    onClick={() => handleSelectFiscalYear(yr.year)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-xs ${
                      isSelected
                        ? isClosed
                          ? 'bg-amber-600 text-white shadow-md ring-2 ring-amber-400'
                          : 'bg-[#1a237e] text-white shadow-md ring-2 ring-blue-400'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {isClosed ? (
                      <Lock className="w-3.5 h-3.5 text-amber-200" />
                    ) : (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span>سنة {yr.year}</span>
                    {isCurrent && <span className="text-[10px] opacity-80">(النشطة)</span>}
                    {isClosed && <span className="text-[10px] opacity-80">(مقفلة)</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Period Buttons for Selected Fiscal Year */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[11px] font-bold text-slate-500 ml-1">فترات سريعة:</span>
            <button
              type="button"
              onClick={() => handleSelectPeriod('full')}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-900 text-xs font-bold transition cursor-pointer border border-slate-200"
            >
              كامل السنة
            </button>
            <button
              type="button"
              onClick={() => handleSelectPeriod('q1')}
              className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-900 text-xs font-bold transition cursor-pointer border border-slate-200"
            >
              Q1 (يناير - مارس)
            </button>
            <button
              type="button"
              onClick={() => handleSelectPeriod('q2')}
              className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-900 text-xs font-bold transition cursor-pointer border border-slate-200"
            >
              Q2 (أبريل - يونيو)
            </button>
            <button
              type="button"
              onClick={() => handleSelectPeriod('q3')}
              className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-900 text-xs font-bold transition cursor-pointer border border-slate-200"
            >
              Q3 (يوليو - سبتمبر)
            </button>
            <button
              type="button"
              onClick={() => handleSelectPeriod('q4')}
              className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-900 text-xs font-bold transition cursor-pointer border border-slate-200"
            >
              Q4 (أكتوبر - ديسمبر)
            </button>
          </div>
        </div>

        {/* Closed Year Certified Banner & Cloud Pull if needed */}
        {isSelectedYearClosed && (
          <div className="mt-3 pt-3 border-t border-amber-300/50 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-900 font-bold flex items-center justify-center shrink-0">
                🔒
              </span>
              <div>
                <span className="font-black text-amber-950">
                  وضع تدقيق ومراجعة السنة المالية المقفلة ({selectedFiscalYear})
                </span>
                <span className="text-amber-800 mr-2">
                  (كافة التقارير وكشوف الحسابات والطباعة مطابقة لمحضر الإقفال والحسابات الختامية المعتمدة)
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleFetchCloudRecordsForYear(selectedFiscalYear)}
              disabled={isFetchingCloudYear}
              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              title="جلب فواتير وسجلات هذه السنة من مجموعات فايربيس السحابية الفرعية"
            >
              {isFetchingCloudYear ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CloudDownload className="w-3.5 h-3.5" />
              )}
              <span>استدعاء سجلات {selectedFiscalYear} من السحابة</span>
            </button>
          </div>
        )}
      </div>

      {/* Custom Dynamic Builder Controls (If in Custom Mode) */}
      {isCustomMode && (
        <div className="bg-white p-4 rounded-2xl shadow-sm border-2 border-[#1a237e]/20 space-y-3">
          <div className="font-bold text-[#1a237e] text-sm flex items-center gap-1">
            <span>⚡</span> تخصيص مصدر البيانات والتجميع في التقرير
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block font-bold mb-1">مصدر البيانات المُراد تحليله</label>
              <select
                value={customSource}
                onChange={(e) => setCustomSource(e.target.value)}
                className="w-full p-2 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none"
              >
                <option value="sales">💰 فواتير المبيعات</option>
                <option value="purchases">🛒 فواتير المشتريات</option>
                <option value="customers">👥 أداء وحسابات العملاء</option>
                <option value="suppliers">🏭 أداء وحسابات الموردين</option>
                <option value="receipts">📥 حركة المقبوضات والنقدية</option>
                <option value="payments">📤 حركة المدفوعات والنقدية</option>
              </select>
            </div>

            <div>
              <label className="block font-bold mb-1">طريقة التجميع (Group By)</label>
              <select
                value={customGroupBy}
                onChange={(e) => setCustomGroupBy(e.target.value)}
                className="w-full p-2 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none"
              >
                <option value="none">بدون تجميع (عرض تفصيلي سجل بسجل)</option>
                <option value="customer">حسب العميل</option>
                <option value="supplier">حسب المورد</option>
                <option value="method">حسب وسيلة الدفع</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Dimensional Filter Toolbar with Search Button */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-3">
        {/* Target Entity Selection Mode Toggle (Customers vs Suppliers vs All) */}
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-3 rounded-xl border border-indigo-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="font-bold text-[#1a237e] flex items-center gap-1.5">
            <span className="text-base">🎯</span>
            <div>
              <span className="block text-xs font-bold text-[#1a237e]">نوع البحث والتصفية المطلوب:</span>
              <span className="text-[11px] text-gray-500 font-normal">حدد ما إذا كنت تبحث في حسابات العملاء فقط أو الموردين فقط لتجنب اللغبطة</span>
            </div>
          </div>
          <div className="flex gap-1.5 bg-white p-1 rounded-xl border border-indigo-200 shadow-sm">
            <button
              type="button"
              onClick={() => {
                setDraftTargetMode('customers');
                setDraftSupplier('');
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 text-xs ${
                draftTargetMode === 'customers'
                  ? 'bg-[#1a237e] text-white shadow-md'
                  : 'text-gray-600 hover:bg-indigo-50'
              }`}
            >
              <span>👥</span> تصفية عملاء فقط
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftTargetMode('suppliers');
                setDraftCustomer('');
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 text-xs ${
                draftTargetMode === 'suppliers'
                  ? 'bg-[#1a237e] text-white shadow-md'
                  : 'text-gray-600 hover:bg-indigo-50'
              }`}
            >
              <span>🏢</span> تصفية موردين فقط
            </button>
            <button
              type="button"
              onClick={() => setDraftTargetMode('all')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 text-xs ${
                draftTargetMode === 'all'
                  ? 'bg-[#1a237e] text-white shadow-md'
                  : 'text-gray-600 hover:bg-indigo-50'
              }`}
            >
              <span>🌐</span> عرض الكل (عملاء وموردين)
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center justify-between border-b border-gray-100 pb-2">
          <span className="font-bold text-[#1a237e] text-xs flex items-center gap-1">
            <span>⚙️</span> الفلاتر والنطاق الزمني
          </span>

          {/* Quick Date Range Buttons */}
          <div className="flex flex-wrap gap-1 text-xs">
            <button
              onClick={() => handleQuickDate('today')}
              className="bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg text-slate-700 font-semibold cursor-pointer"
            >
              اليوم
            </button>
            <button
              onClick={() => handleQuickDate('week')}
              className="bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg text-slate-700 font-semibold cursor-pointer"
            >
              آخر أسبوع
            </button>
            <button
              onClick={() => handleQuickDate('month')}
              className="bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg text-slate-700 font-semibold cursor-pointer"
            >
              آخر شهر
            </button>
            <button
              onClick={() => handleQuickDate('year')}
              className="bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg text-slate-700 font-semibold cursor-pointer"
            >
              آخر سنة
            </button>
            <button
              onClick={() => handleQuickDate('all')}
              className="bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg text-slate-700 font-semibold cursor-pointer"
            >
              كل الفترات
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs">
          {/* Date From / To */}
          <div>
            <label className="block font-bold text-gray-600 mb-0.5">من تاريخ:</label>
            <input
              type="date"
              value={draftFromDate}
              onChange={(e) => setDraftFromDate(e.target.value)}
              className="w-full p-1.5 border-2 border-gray-200 rounded-lg text-xs focus:border-[#1a237e]"
            />
          </div>

          <div>
            <label className="block font-bold text-gray-600 mb-0.5">إلى تاريخ:</label>
            <input
              type="date"
              value={draftToDate}
              onChange={(e) => setDraftToDate(e.target.value)}
              className="w-full p-1.5 border-2 border-gray-200 rounded-lg text-xs focus:border-[#1a237e]"
            />
          </div>

          {/* Customer Filter */}
          <div className={draftTargetMode === 'suppliers' ? 'opacity-40' : ''}>
            <label className="block font-bold text-gray-600 mb-0.5">
              العميل {draftTargetMode === 'customers' && <span className="text-[#1a237e] text-[10px] bg-indigo-50 px-1 rounded">(محدد)</span>}:
            </label>
            <select
              value={draftCustomer}
              disabled={draftTargetMode === 'suppliers'}
              onChange={(e) => setDraftCustomer(e.target.value)}
              className="w-full p-1.5 border-2 border-gray-200 rounded-lg text-xs focus:border-[#1a237e] disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">جميع العملاء</option>
              {appData.customers.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Supplier Filter */}
          <div className={draftTargetMode === 'customers' ? 'opacity-40' : ''}>
            <label className="block font-bold text-gray-600 mb-0.5">
              المورد {draftTargetMode === 'suppliers' && <span className="text-[#1a237e] text-[10px] bg-indigo-50 px-1 rounded">(محدد)</span>}:
            </label>
            <select
              value={draftSupplier}
              disabled={draftTargetMode === 'customers'}
              onChange={(e) => setDraftSupplier(e.target.value)}
              className="w-full p-1.5 border-2 border-gray-200 rounded-lg text-xs focus:border-[#1a237e] disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">جميع الموردين</option>
              {appData.suppliers.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Item Filter */}
          <div>
            <label className="block font-bold text-gray-600 mb-0.5">الصنف:</label>
            <select
              value={draftItem}
              onChange={(e) => setDraftItem(e.target.value)}
              className="w-full p-1.5 border-2 border-gray-200 rounded-lg text-xs focus:border-[#1a237e]"
            >
              <option value="">جميع الأصناف</option>
              {appData.items.map((i) => (
                <option key={i.id} value={i.name}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Method Filter */}
          <div>
            <label className="block font-bold text-gray-600 mb-0.5">وسيلة الدفع:</label>
            <select
              value={draftMethod}
              onChange={(e) => setDraftMethod(e.target.value)}
              className="w-full p-1.5 border-2 border-gray-200 rounded-lg text-xs focus:border-[#1a237e]"
            >
              <option value="">جميع الوسائل</option>
              <option value="drawer">نقدي (الدرج)</option>
              <option value="vodafone">فودافون كاش</option>
              <option value="instapay">إنستاباي</option>
              <option value="bank">حساب بنكي</option>
            </select>
          </div>
        </div>

        {/* Second Filter Row with Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs pt-1 items-end">
          <div>
            <label className="block font-bold text-gray-600 mb-0.5">مندوب المبيعات:</label>
            <select
              value={draftRep}
              onChange={(e) => setDraftRep(e.target.value)}
              className="w-full p-1.5 border-2 border-gray-200 rounded-lg text-xs focus:border-[#1a237e]"
            >
              <option value="">جميع المندوبين</option>
              {(appData.salesReps || []).map((r) => (
                <option key={r.id} value={r.name}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-gray-600 mb-0.5">نوع الفاتورة / الحركة:</label>
            <select
              value={draftType}
              onChange={(e) => setDraftType(e.target.value)}
              className="w-full p-1.5 border-2 border-gray-200 rounded-lg text-xs focus:border-[#1a237e]"
            >
              <option value="">جميع الأنواع</option>
              <option value="nagdi">نقدي</option>
              <option value="ajel">آجل</option>
              <option value="return_nagdi">مرتجع نقدي</option>
              <option value="return_ajel">مرتجع أجل</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-gray-600 mb-0.5">بحث بالكلمات / رقم الفاتورة:</label>
            <input
              type="text"
              placeholder="اكتب كلمة التصفية برقم الفاتورة أو اسم الصنف..."
              value={draftSearch}
              onChange={(e) => setDraftSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleExecuteSearch()}
              className="w-full p-1.5 border-2 border-gray-200 rounded-lg text-xs focus:border-[#1a237e]"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleExecuteSearch}
              className="flex-1 bg-[#1a237e] hover:bg-[#0d47a1] text-white py-2 px-3 rounded-xl font-bold text-xs transition cursor-pointer shadow-md flex items-center justify-center gap-1"
            >
              🔍 بحث واستخراج التقرير
            </button>
            <button
              onClick={handleResetFilters}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-3 rounded-xl font-bold text-xs transition cursor-pointer"
            >
              🔄 إلغاء
            </button>
          </div>
        </div>
      </div>

      {/* Applied Filters Badge Indicator */}
      {(selectedCustomer || selectedSupplier || selectedItem || selectedRep || selectedMethod || selectedType || search || searchTargetMode !== 'all') && (
        <div className="bg-indigo-50 border border-indigo-200 p-2.5 rounded-xl text-xs flex flex-wrap gap-2 items-center text-[#1a237e]">
          <span className="font-bold">🎯 الفلاتر النشطة حالياً:</span>
          {searchTargetMode === 'customers' && (
            <span className="bg-indigo-100 font-bold px-2 py-0.5 rounded-md border border-indigo-300">
              النطاق: 👥 عملاء فقط
            </span>
          )}
          {searchTargetMode === 'suppliers' && (
            <span className="bg-indigo-100 font-bold px-2 py-0.5 rounded-md border border-indigo-300">
              النطاق: 🏢 موردين فقط
            </span>
          )}
          {selectedCustomer && <span className="bg-white px-2 py-0.5 rounded-md border border-indigo-200">العميل: <strong>{selectedCustomer}</strong></span>}
          {selectedSupplier && <span className="bg-white px-2 py-0.5 rounded-md border border-indigo-200">المورد: <strong>{selectedSupplier}</strong></span>}
          {selectedItem && <span className="bg-white px-2 py-0.5 rounded-md border border-indigo-200">الصنف: <strong>{selectedItem}</strong></span>}
          {selectedRep && <span className="bg-white px-2 py-0.5 rounded-md border border-indigo-200">المندوب: <strong>{selectedRep}</strong></span>}
          {selectedMethod && <span className="bg-white px-2 py-0.5 rounded-md border border-indigo-200">الوسيلة: <strong>{selectedMethod}</strong></span>}
          {selectedType && <span className="bg-white px-2 py-0.5 rounded-md border border-indigo-200">النوع: <strong>{selectedType}</strong></span>}
          {search && <span className="bg-white px-2 py-0.5 rounded-md border border-indigo-200">الكلمة: <strong>{search}</strong></span>}
          <button onClick={handleResetFilters} className="text-red-600 hover:underline mr-auto font-bold text-xs">إزالة الفلاتر ✕</button>
        </div>
      )}

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3 rounded-xl shadow-sm text-center border border-gray-100">
          <span className="text-gray-500 text-xs block">📊 إجمالي القيمة بالفترة</span>
          <strong className="text-[#2e7d32] text-base font-bold">{reportData.total.toFixed(2)} ج.م</strong>
        </div>
        <div className="bg-white p-3 rounded-xl shadow-sm text-center border border-gray-100">
          <span className="text-gray-500 text-xs block">📋 عدد السجلات الفعلية</span>
          <strong className="text-[#1a237e] text-base font-bold">{reportData.count}</strong>
        </div>
        <div className="bg-white p-3 rounded-xl shadow-sm text-center border border-gray-100">
          <span className="text-gray-500 text-xs block">📅 بداية الفترة</span>
          <strong className="text-gray-700 text-xs font-bold">{reportData.fromDate}</strong>
        </div>
        <div className="bg-white p-3 rounded-xl shadow-sm text-center border border-gray-100">
          <span className="text-gray-500 text-xs block">📅 نهاية الفترة</span>
          <strong className="text-gray-700 text-xs font-bold">{reportData.toDate}</strong>
        </div>
      </div>

      {/* Report Results */}
      <div id="report-printable-card" className="bg-white p-4 rounded-2xl shadow-xs border border-gray-100 space-y-3">
        <div className="flex flex-wrap items-center justify-end gap-2 pb-2 border-b border-gray-100">
          <span className="text-xs font-bold text-[#1a237e] bg-indigo-50 px-2.5 py-1 rounded-lg">
            {reportData.rows.length} نتيجة
          </span>
        </div>

        {/* Mobile Report Cards View */}
        <div className="block md:hidden space-y-3">
          {reportData.rows.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              لا توجد بيانات مسجلة في النظام تطابق شروط التصفية للفترة المحددة
            </div>
          ) : (
            reportData.rows.map((row, rIdx) => {
              const detail = reportData.rowDetails ? reportData.rowDetails[rIdx] : undefined;
              const isInteractive = Boolean(
                detail && (detail.invoiceId || detail.customerName || detail.supplierName || detail.repName || detail.itemName)
              );
              const mainTitle = row[0] || `سجل #${rIdx + 1}`;
              const subTitle = row[1] || '';
              const otherCols = row.slice(2, row.length - 1);
              const lastCell = row[row.length - 1];
              const isActionBtn = Boolean(
                lastCell &&
                  (lastCell.includes('معاينة') ||
                    lastCell.includes('فتح') ||
                    lastCell.includes('عرض') ||
                    lastCell.includes('كشف') ||
                    lastCell.includes('تفاصيل') ||
                    lastCell.includes('تحليل'))
              );

              return (
                <div
                  key={rIdx}
                  onClick={() => isInteractive && handleRowClick(detail)}
                  className={`bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2.5 transition ${
                    isInteractive ? 'hover:border-indigo-300 cursor-pointer active:scale-[0.99]' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 border-b border-slate-200/70 pb-2">
                    <div>
                      <span className="font-bold text-xs text-[#1a237e] block">{mainTitle}</span>
                      {subTitle && <span className="text-xs text-slate-600 block">{subTitle}</span>}
                    </div>
                    {isInteractive && (
                      <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full shrink-0">
                        تفاصيل 🔍
                      </span>
                    )}
                  </div>

                  {otherCols.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 text-xs bg-white p-2.5 rounded-xl border border-slate-100">
                      {otherCols.map((val, cIdx) => {
                        const colName = reportData.columns[cIdx + 2] || '';
                        return (
                          <div key={cIdx} className="space-y-0.5">
                            <span className="text-[10px] text-slate-400 block">{colName}:</span>
                            <span className="font-semibold text-slate-800 break-words">{val}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {isActionBtn ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isInteractive) handleRowClick(detail);
                      }}
                      className="w-full min-h-[42px] bg-[#1a237e] hover:bg-[#0d47a1] text-white px-3 py-2 rounded-xl text-xs font-bold shadow-xs transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      {lastCell}
                    </button>
                  ) : (
                    lastCell && (
                      <div className="text-xs text-slate-600 text-left pt-1">
                        <span className="font-bold">{lastCell}</span>
                      </div>
                    )
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Report Results Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-right text-xs md:text-sm border-collapse">
            <thead>
              <tr className="bg-[#1a237e] text-white">
                {reportData.columns.map((col, idx) => (
                  <th key={idx} className="p-3">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reportData.rows.length === 0 ? (
                <tr>
                  <td colSpan={reportData.columns.length} className="text-center py-10 text-gray-400">
                    لا توجد بيانات مسجلة في النظام تطابق شروط التصفية للفترة المحددة
                  </td>
                </tr>
              ) : (
                reportData.rows.map((row, rIdx) => {
                  const detail = reportData.rowDetails ? reportData.rowDetails[rIdx] : undefined;
                  const isInteractive = Boolean(
                    detail && (detail.invoiceId || detail.customerName || detail.supplierName || detail.repName || detail.itemName)
                  );
                  return (
                    <tr
                      key={rIdx}
                      onClick={() => isInteractive && handleRowClick(detail)}
                      className={`transition ${
                        isInteractive ? 'hover:bg-indigo-50/70 cursor-pointer' : 'hover:bg-slate-50'
                      }`}
                    >
                      {row.map((cell, cIdx) => {
                        const isLastCol = cIdx === row.length - 1;
                        const isActionBtn = isLastCol && (cell.includes('معاينة') || cell.includes('فتح') || cell.includes('عرض') || cell.includes('كشف') || cell.includes('تفاصيل') || cell.includes('تحليل'));
                        return (
                          <td key={cIdx} className="p-3 font-medium">
                            {isActionBtn ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isInteractive) handleRowClick(detail);
                                }}
                                className="inline-flex items-center gap-1 bg-[#1a237e] hover:bg-[#0d47a1] text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                              >
                                {cell}
                              </button>
                            ) : (
                              cell
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Full Invoice Details Modal (Drill-down) */}
      <Modal
        isOpen={Boolean(viewingInvoice)}
        title={
          viewingInvoice?.type === 'sale'
            ? `📄 تفاصيل فاتورة المبيعات #${viewingInvoice?.id}`
            : `📄 تفاصيل فاتورة المشتريات #${viewingInvoice?.id}`
        }
        onClose={() => setViewingInvoice(null)}
      >
        {activeSaleInvoice && (
          <div className="space-y-4 text-xs md:text-sm">
            {/* Control Toolbar */}
            <div className="no-print bg-slate-100 p-3 rounded-xl flex flex-wrap gap-2 items-center justify-between border border-slate-200">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    printInvoiceWindow(activeSaleInvoice!, true, appData.settings, showToast)
                  }
                  className="bg-[#1a237e] hover:bg-[#0d47a1] text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  🖨️ طباعة
                </button>

                <button
                  onClick={() => {
                    setViewingInvoice(null);
                    onNavigate('sales');
                    showToast(`جاري التوجه لإدارة المبيعات لتعديل الفاتورة #${activeSaleInvoice!.id}`, 'info');
                  }}
                  className="bg-[#f57f17] hover:bg-[#e65100] text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  ✏️ تعديل
                </button>

                {(activeSaleInvoice.remainingAmount !== undefined
                  ? activeSaleInvoice.remainingAmount
                  : activeSaleInvoice.total - (activeSaleInvoice.paidAmount || 0)) > 0 && (
                  <button
                    onClick={() => handleOpenPaymentModal(activeSaleInvoice!, true)}
                    className="bg-[#2e7d32] hover:bg-[#1b5e20] text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                  >
                    💰 تحصيل المبلغ المتبقي ({(activeSaleInvoice.remainingAmount !== undefined ? activeSaleInvoice.remainingAmount : activeSaleInvoice.total - (activeSaleInvoice.paidAmount || 0)).toFixed(2)} ج.م)
                  </button>
                )}
              </div>

              <span className="text-xs font-bold text-[#1a237e]">
                معاينة تفاعلية للفاتورة #{activeSaleInvoice.id}
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-gray-200 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <span className="text-gray-500 block text-xs">رقم الفاتورة:</span>
                <strong className="text-[#1a237e] text-base font-bold">#{activeSaleInvoice.id}</strong>
              </div>
              <div>
                <span className="text-gray-500 block text-xs">اسم العميل:</span>
                <strong className="text-gray-800 font-bold">{activeSaleInvoice.customerName}</strong>
              </div>
              <div>
                <span className="text-gray-500 block text-xs">التاريخ والوقت:</span>
                <strong className="text-gray-800">{activeSaleInvoice.date} ({activeSaleInvoice.time || '12:00 PM'})</strong>
              </div>
              <div>
                <span className="text-gray-500 block text-xs">نوع الفاتورة ووسيلة الدفع:</span>
                <span className="bg-indigo-100 text-[#1a237e] px-2 py-0.5 rounded font-bold text-xs">
                  {activeSaleInvoice.type === 'nagdi' ? 'نقدي' : activeSaleInvoice.type === 'ajel' ? 'آجل' : 'مرتجع'} - {activeSaleInvoice.paymentMethod}
                </span>
              </div>
            </div>

            {/* Line items */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-[#1a237e] text-white p-2.5 font-bold text-xs flex justify-between">
                <span>اصناف وبنود الفاتورة</span>
                <span>إجمالي البنود: {activeSaleInvoice.items.length}</span>
              </div>
              {/* Mobile Items Cards (< md) */}
              <div className="block md:hidden p-2 space-y-2 max-h-60 overflow-y-auto">
                {activeSaleInvoice.items.map((it, idx) => (
                  <div key={idx} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs space-y-1">
                    <div className="flex justify-between items-start font-bold">
                      <span className="text-[#1a237e]">{it.name}</span>
                      <span className="text-[#2e7d32]">{(it.total || it.qty * it.price).toFixed(2)} ج.م</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/50">
                      <span>الكمية: <strong className="text-slate-800">{it.qty}</strong></span>
                      <span>سعر الوحدة: <strong className="text-slate-800">{it.price.toFixed(2)} ج.م</strong></span>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop Items Table (>= md) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-right">
                  <thead className="bg-gray-100 border-b border-gray-200 text-xs">
                    <tr>
                      <th className="p-2">#</th>
                      <th className="p-2">اسم الصنف</th>
                      <th className="p-2">الكمية</th>
                      <th className="p-2">سعر الوحدة</th>
                      <th className="p-2">الإجمالي (ج.م)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {activeSaleInvoice.items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2 text-gray-500">{idx + 1}</td>
                        <td className="p-2 font-bold text-[#1a237e]">{it.name}</td>
                        <td className="p-2">{it.qty}</td>
                        <td className="p-2">{it.price.toFixed(2)} ج.م</td>
                        <td className="p-2 font-bold text-[#2e7d32]">{(it.total || it.qty * it.price).toFixed(2)} ج.م</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals Summary */}
            <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 space-y-1 text-xs">
              <div className="flex justify-between">
                <span>المجموع الفرعي:</span>
                <strong>{(activeSaleInvoice.subtotal || activeSaleInvoice.items.reduce((s, i) => s + (i.total || i.qty * i.price), 0)).toFixed(2)} ج.م</strong>
              </div>
              {activeSaleInvoice.discount ? (
                <div className="flex justify-between text-red-600">
                  <span>الخصم المباشر:</span>
                  <strong>- {activeSaleInvoice.discount.toFixed(2)} ج.م</strong>
                </div>
              ) : null}
              {activeSaleInvoice.tax ? (
                <div className="flex justify-between text-gray-600">
                  <span>ضريبة القيمة المضافة ({activeSaleInvoice.tax}%):</span>
                  <strong>+ {(((activeSaleInvoice.subtotal || 0) * activeSaleInvoice.tax) / 100).toFixed(2)} ج.م</strong>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-indigo-200 pt-2 text-sm font-bold text-[#1a237e]">
                <span>صافي قيمة الفاتورة:</span>
                <span>{(activeSaleInvoice.total || 0).toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between text-xs font-semibold pt-1">
                <span className="text-[#2e7d32]">المبلغ المسدد: {(activeSaleInvoice.paidAmount || 0).toFixed(2)} ج.م</span>
                <span className="text-red-600">المتبقي: {(activeSaleInvoice.remainingAmount !== undefined ? activeSaleInvoice.remainingAmount : activeSaleInvoice.total - (activeSaleInvoice.paidAmount || 0)).toFixed(2)} ج.م</span>
              </div>
            </div>

            <div className="flex justify-end items-center pt-2">
              <button
                onClick={() => setViewingInvoice(null)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                إغلاق ✕
              </button>
            </div>
          </div>
        )}

        {activePurchaseInvoice && (
          <div className="space-y-4 text-xs md:text-sm">
            {/* Control Toolbar */}
            <div className="no-print bg-slate-100 p-3 rounded-xl flex flex-wrap gap-2 items-center justify-between border border-slate-200">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    printInvoiceWindow(activePurchaseInvoice!, false, appData.settings, showToast)
                  }
                  className="bg-[#1a237e] hover:bg-[#0d47a1] text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  🖨️ طباعة
                </button>

                <button
                  onClick={() => {
                    setViewingInvoice(null);
                    onNavigate('purchases');
                    showToast(`جاري التوجه لإدارة المشتريات لتعديل الفاتورة #${activePurchaseInvoice!.id}`, 'info');
                  }}
                  className="bg-[#f57f17] hover:bg-[#e65100] text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  ✏️ تعديل
                </button>

                {(activePurchaseInvoice.remainingAmount !== undefined
                  ? activePurchaseInvoice.remainingAmount
                  : activePurchaseInvoice.total - (activePurchaseInvoice.paidAmount || 0)) > 0 && (
                  <button
                    onClick={() => handleOpenPaymentModal(activePurchaseInvoice!, false)}
                    className="bg-[#2e7d32] hover:bg-[#1b5e20] text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                  >
                    💸 سداد المبلغ المتبقي ({(activePurchaseInvoice.remainingAmount !== undefined ? activePurchaseInvoice.remainingAmount : activePurchaseInvoice.total - (activePurchaseInvoice.paidAmount || 0)).toFixed(2)} ج.م)
                  </button>
                )}
              </div>

              <span className="text-xs font-bold text-[#1a237e]">
                معاينة تفاعلية للفاتورة #{activePurchaseInvoice.id}
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-gray-200 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <span className="text-gray-500 block text-xs">رقم الفاتورة:</span>
                <strong className="text-[#1a237e] text-base font-bold">#{activePurchaseInvoice.id}</strong>
              </div>
              <div>
                <span className="text-gray-500 block text-xs">اسم المورد:</span>
                <strong className="text-gray-800 font-bold">{activePurchaseInvoice.supplierName}</strong>
              </div>
              <div>
                <span className="text-gray-500 block text-xs">التاريخ والوقت:</span>
                <strong className="text-gray-800">{activePurchaseInvoice.date} ({activePurchaseInvoice.time || '12:00 PM'})</strong>
              </div>
              <div>
                <span className="text-gray-500 block text-xs">وسيلة الدفع:</span>
                <span className="bg-indigo-100 text-[#1a237e] px-2 py-0.5 rounded font-bold text-xs">
                  {activePurchaseInvoice.paymentMethod}
                </span>
              </div>
            </div>

            {/* Line items */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-[#1a237e] text-white p-2.5 font-bold text-xs flex justify-between">
                <span>اصناف المشتريات الواردة</span>
                <span>إجمالي البنود: {activePurchaseInvoice.items.length}</span>
              </div>
              {/* Mobile Items Cards (< md) */}
              <div className="block md:hidden p-2 space-y-2 max-h-60 overflow-y-auto">
                {activePurchaseInvoice.items.map((it, idx) => (
                  <div key={idx} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs space-y-1">
                    <div className="flex justify-between items-start font-bold">
                      <span className="text-[#1a237e]">{it.name}</span>
                      <span className="text-[#2e7d32]">{(it.total || it.qty * it.price).toFixed(2)} ج.م</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/50">
                      <span>الكمية الواردة: <strong className="text-slate-800">{it.qty}</strong></span>
                      <span>سعر الشراء: <strong className="text-slate-800">{it.price.toFixed(2)} ج.م</strong></span>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop Items Table (>= md) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-right">
                  <thead className="bg-gray-100 border-b border-gray-200 text-xs">
                    <tr>
                      <th className="p-2">#</th>
                      <th className="p-2">اسم الصنف</th>
                      <th className="p-2">الكمية الواردة</th>
                      <th className="p-2">سعر الشراء</th>
                      <th className="p-2">الإجمالي (ج.م)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {activePurchaseInvoice.items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2 text-gray-500">{idx + 1}</td>
                        <td className="p-2 font-bold text-[#1a237e]">{it.name}</td>
                        <td className="p-2">{it.qty}</td>
                        <td className="p-2">{it.price.toFixed(2)} ج.م</td>
                        <td className="p-2 font-bold text-[#2e7d32]">{(it.total || it.qty * it.price).toFixed(2)} ج.م</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals Summary */}
            <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 space-y-1 text-xs">
              <div className="flex justify-between border-t border-indigo-200 pt-2 text-sm font-bold text-[#1a237e]">
                <span>إجمالي فاتورة الشراء:</span>
                <span>{(activePurchaseInvoice.total || 0).toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between text-xs font-semibold pt-1">
                <span className="text-[#2e7d32]">المبلغ المسدد: {(activePurchaseInvoice.paidAmount || 0).toFixed(2)} ج.م</span>
                <span className="text-red-600">المتبقي: {(activePurchaseInvoice.remainingAmount !== undefined ? activePurchaseInvoice.remainingAmount : activePurchaseInvoice.total - (activePurchaseInvoice.paidAmount || 0)).toFixed(2)} ج.م</span>
              </div>
            </div>

            <div className="flex justify-end items-center pt-2">
              <button
                onClick={() => setViewingInvoice(null)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                إغلاق ✕
              </button>
            </div>
          </div>
        )}

        {!activeSaleInvoice && !activePurchaseInvoice && (
          <div className="text-center py-8 text-gray-500">
            لم يتم العثور على الفاتورة المطلوبة في سجلات النظام.
          </div>
        )}
      </Modal>

      {/* Payment / Collection Modal */}
      <Modal
        isOpen={Boolean(payModalInvoice)}
        title={payModalInvoice?.isSale ? '💰 تحصيل مبلغ آجل' : '💸 سداد مستحقات مورد'}
        onClose={() => setPayModalInvoice(null)}
      >
        {payModalInvoice && (
          <div className="space-y-4 text-xs md:text-sm">
            <p className="text-gray-600 font-semibold">
              {payModalInvoice.isSale
                ? `تسجيل عملية تحصيل نقدية للفاتورة رقم #${payModalInvoice.inv.id} الخاصة بالعميل: ${(payModalInvoice.inv as SaleInvoice).customerName}`
                : `تسجيل عملية سداد نقدي للفاتورة رقم #${payModalInvoice.inv.id} الخاصة بالمورد: ${(payModalInvoice.inv as PurchaseInvoice).supplierName}`}
            </p>

            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-gray-200">
              <div>
                <label className="block text-gray-700 font-bold mb-1">المبلغ المراد {payModalInvoice.isSale ? 'تحصيله' : 'سداده'} (ج.م):</label>
                <input
                  type="number"
                  min="1"
                  value={payAmountInput}
                  onChange={(e) => setPayAmountInput(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-xl font-bold text-base text-[#1a237e]"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">طريقة الدفع الخزينة:</label>
                <select
                  value={payMethodInput}
                  onChange={(e) => setPayMethodInput(e.target.value as any)}
                  className="w-full p-2.5 border border-gray-300 rounded-xl text-xs md:text-sm font-semibold"
                >
                  <option value="drawer">💵 درج الخزينة الرئيسية</option>
                  <option value="vodafone">📱 فودافون كاش (Vodafone Cash)</option>
                  <option value="instapay">⚡ إنستا باي (InstaPay)</option>
                  <option value="bank">🏦 الحساب البنكي (Bank Account)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setPayModalInvoice(null)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={handleConfirmPayment}
                className="bg-[#2e7d32] hover:bg-[#1b5e20] text-white px-5 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-sm"
              >
                حفظ وسداد المعاملة ✓
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

