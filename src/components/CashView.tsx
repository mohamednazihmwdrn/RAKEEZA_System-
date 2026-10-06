import React, { useState, useEffect } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Landmark,
  BarChart3,
  Search,
  Printer,
  Calendar,
  X,
  Plus,
} from 'lucide-react';
import { AppData, CashTransaction } from '../types';
import { ReceiptVouchersClassic } from './ReceiptVouchersClassic';
import { PaymentVouchersClassic } from './PaymentVouchersClassic';
import { printCashClosingWindow, compileCashClosingData, formatNumber } from '../utils/printCashClosing';
import { printShiftReportWindow } from '../utils/printShiftReport';
import { printCashBalancesReportWindow } from '../utils/printCashBalancesReport';
import { printDailyTransactionsReportWindow } from '../utils/printDailyTransactionsReport';
import { printCashVoucherWindow } from '../utils/printCash';
import { exportToExcel } from '../utils/excelExport';
import { Modal } from './Modal';

interface CashViewProps {
  appData: AppData;
  onUpdateData: (newData: AppData, actionInfo?: { action?: string; module?: string; details?: string; deletedId?: string | number }) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onInspectItem?: (type: string, data: any) => void;
  initialTab?: 'receipt' | 'pay' | 'closing' | 'all';
  prefilledCustomerName?: string;
  prefilledCustomerDebt?: number;
  prefilledSupplierName?: string;
  prefilledSupplierPayable?: number;
}

export const CashView: React.FC<CashViewProps> = ({
  appData,
  onUpdateData,
  showToast,
  onInspectItem,
  initialTab = 'receipt',
  prefilledCustomerName,
  prefilledCustomerDebt,
  prefilledSupplierName,
  prefilledSupplierPayable,
}) => {
  // Determine active tab
  const getInitialActiveTab = (): 'receipt' | 'pay' | 'closing' => {
    if (initialTab === 'pay') return 'pay';
    if (initialTab === 'closing' || initialTab === 'all') return 'closing';
    return 'receipt';
  };

  const [activeTab, setActiveTab] = useState<'receipt' | 'pay' | 'closing'>(getInitialActiveTab());

  // Check sessionStorage for prefilled values
  const [initCustName, setInitCustName] = useState<string>(prefilledCustomerName || '');
  const [initCustDebt, setInitCustDebt] = useState<number | undefined>(prefilledCustomerDebt);
  const [initSuppName, setInitSuppName] = useState<string>(prefilledSupplierName || '');
  const [initSuppPayable, setInitSuppPayable] = useState<number | undefined>(prefilledSupplierPayable);

  useEffect(() => {
    try {
      const storedCust = sessionStorage.getItem('rakeeza_prefilled_receipt_customer');
      const storedAmt = sessionStorage.getItem('rakeeza_prefilled_receipt_amount');
      if (storedCust) {
        setInitCustName(storedCust);
        if (storedAmt) setInitCustDebt(parseFloat(storedAmt));
        setActiveTab('receipt');
        sessionStorage.removeItem('rakeeza_prefilled_receipt_customer');
        sessionStorage.removeItem('rakeeza_prefilled_receipt_amount');
      }

      const storedSupp = sessionStorage.getItem('rakeeza_prefilled_payment_supplier');
      const storedSuppAmt = sessionStorage.getItem('rakeeza_prefilled_payment_amount');
      if (storedSupp) {
        setInitSuppName(storedSupp);
        if (storedSuppAmt) setInitSuppPayable(parseFloat(storedSuppAmt));
        setActiveTab('pay');
        sessionStorage.removeItem('rakeeza_prefilled_payment_supplier');
        sessionStorage.removeItem('rakeeza_prefilled_payment_amount');
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (initialTab === 'receipt') setActiveTab('receipt');
    else if (initialTab === 'pay') setActiveTab('pay');
    else if (initialTab === 'closing' || initialTab === 'all') setActiveTab('closing');
  }, [initialTab]);

  // Cash Closing Modal State
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  const [closingDate, setClosingDate] = useState(new Date().toISOString().split('T')[0]);
  const [closingOpenBalance, setClosingOpenBalance] = useState<string>('0');
  const [closingActualCash, setClosingActualCash] = useState<string>(
    (appData.cashBox?.drawer || 0).toString()
  );

  // Consolidated Cashbook Filters
  const [cashbookSearch, setCashbookSearch] = useState('');
  const [cashbookTypeFilter, setCashbookTypeFilter] = useState<'all' | 'receive' | 'pay'>('all');

  const filteredTransactions = (appData.cashTransactions || []).filter((t) => {
    const matchType =
      cashbookTypeFilter === 'all' ||
      (cashbookTypeFilter === 'receive' && (t.type === 'receive' || t.type === 'deposit')) ||
      (cashbookTypeFilter === 'pay' && (t.type === 'pay' || t.type === 'withdraw'));
    const s = cashbookSearch.toLowerCase();
    const matchSearch =
      !s ||
      t.note?.toLowerCase().includes(s) ||
      t.customerName?.toLowerCase().includes(s) ||
      t.supplierName?.toLowerCase().includes(s) ||
      t.recipientName?.toLowerCase().includes(s) ||
      t.voucherNo?.toLowerCase().includes(s) ||
      t.id.toString().includes(s);
    return matchType && matchSearch;
  });

  const getMethodLabel = (m: string) => {
    switch (m) {
      case 'drawer':
        return 'درج النقدية';
      case 'vodafone':
        return 'فودافون كاش';
      case 'instapay':
        return 'إنستاباي';
      case 'bank':
        return 'حساب بنكي';
      default:
        return m;
    }
  };

  const receiptCount = (appData.cashTransactions || []).filter((t) => t.type === 'receive' || t.type === 'deposit').length;
  const paymentCount = (appData.cashTransactions || []).filter((t) => t.type === 'pay' || t.type === 'withdraw').length;

  return (
    <div className="w-full flex flex-col space-y-4 text-slate-800" dir="rtl">
      {/* 🧭 Classic Windows ERP Navigation Tabs Bar */}
      <div className="bg-slate-100 p-1.5 rounded-xl border border-slate-300 flex items-center justify-between gap-2 shadow-xs select-none">
        <div className="flex items-center gap-1.5 flex-1">
          {/* Receipts Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('receipt')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'receipt'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-transparent text-slate-700 hover:bg-slate-200/80 hover:text-slate-900'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4 shrink-0" />
            <span>سندات القبض (التحصيل)</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                activeTab === 'receipt' ? 'bg-emerald-900/60 text-emerald-100' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {receiptCount}
            </span>
          </button>

          {/* Payments Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('pay')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'pay'
                ? 'bg-rose-700 text-white shadow-xs'
                : 'bg-transparent text-slate-700 hover:bg-slate-200/80 hover:text-slate-900'
            }`}
          >
            <ArrowUpRight className="w-4 h-4 shrink-0" />
            <span>سندات الصرف والمصروفات</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                activeTab === 'pay' ? 'bg-rose-900/60 text-rose-100' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {paymentCount}
            </span>
          </button>

          {/* Cashbook & Closing Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('closing')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'closing'
                ? 'bg-blue-800 text-white shadow-xs'
                : 'bg-transparent text-slate-700 hover:bg-slate-200/80 hover:text-slate-900'
            }`}
          >
            <Wallet className="w-4 h-4 shrink-0" />
            <span>دفتر الخزينة والتقفيل اليومي</span>
          </button>
        </div>

        <div className="hidden md:flex items-center text-[11px] text-slate-500 font-mono px-3">
          نظام ركيزة المحاسبي • الخزينة والنقدية
        </div>
      </div>

      {/* 📦 Tab Content */}
      {activeTab === 'receipt' && (
        <ReceiptVouchersClassic
          appData={appData}
          onUpdateData={onUpdateData}
          showToast={showToast}
          initialCustomerName={initCustName}
          initialAmount={initCustDebt}
        />
      )}

      {activeTab === 'pay' && (
        <PaymentVouchersClassic
          appData={appData}
          onUpdateData={onUpdateData}
          showToast={showToast}
          initialSupplierName={initSuppName}
          initialAmount={initSuppPayable}
        />
      )}

      {activeTab === 'closing' && (
        <div className="space-y-4">
          {/* Liquid Balances Card Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl p-3 border border-emerald-200 shadow-2xs">
              <div className="text-[11px] font-bold text-emerald-800">💵 درج النقدية الرئيسي</div>
              <div className="text-lg font-black text-emerald-800 font-mono mt-0.5">
                {(appData.cashBox?.drawer || 0).toFixed(2)} ج.م
              </div>
            </div>
            <div className="bg-white rounded-xl p-3 border border-rose-200 shadow-2xs">
              <div className="text-[11px] font-bold text-rose-800">📱 فودافون كاش والمحافظ</div>
              <div className="text-lg font-black text-rose-800 font-mono mt-0.5">
                {(appData.cashBox?.vodafone || 0).toFixed(2)} ج.م
              </div>
            </div>
            <div className="bg-white rounded-xl p-3 border border-purple-200 shadow-2xs">
              <div className="text-[11px] font-bold text-purple-800">⚡ إنستاباي InstaPay</div>
              <div className="text-lg font-black text-purple-800 font-mono mt-0.5">
                {(appData.cashBox?.instapay || 0).toFixed(2)} ج.م
              </div>
            </div>
            <div className="bg-white rounded-xl p-3 border border-blue-200 shadow-2xs">
              <div className="text-[11px] font-bold text-blue-800">🏦 الحسابات البنكية</div>
              <div className="text-lg font-black text-blue-800 font-mono mt-0.5">
                {(appData.cashBox?.bank || 0).toFixed(2)} ج.م
              </div>
            </div>
          </div>

          {/* Quick Actions & Reports Toolbar */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setClosingActualCash((appData.cashBox?.drawer || 0).toString());
                  setIsClosingModalOpen(true);
                }}
                className="bg-blue-700 hover:bg-blue-800 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>تقفيل يومية الخزينة</span>
              </button>

              <button
                type="button"
                onClick={() => printShiftReportWindow(appData, undefined, undefined, showToast)}
                className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>ملخص الشفت والأرباح</span>
              </button>

              <button
                type="button"
                onClick={() => printCashBalancesReportWindow(appData, showToast)}
                className="bg-slate-700 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Landmark className="w-3.5 h-3.5" />
                <span>تقرير أرصدة وسائل الدفع</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => printDailyTransactionsReportWindow(appData, undefined, undefined, showToast)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>طباعة اليومية الموحدة</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  exportToExcel({
                    filename: `حركة_الخزينة_الموحدة_${new Date().toISOString().split('T')[0]}`,
                    sheetName: 'حركة الخزينة',
                    data: filteredTransactions,
                    columns: [
                      { header: 'رقم السند', key: 'id', width: 12 },
                      { header: 'التاريخ', key: 'date', width: 14 },
                      {
                        header: 'النوع',
                        key: 'type',
                        getValue: (t: any) => (t.type === 'receive' || t.type === 'deposit' ? 'قبض' : 'صرف'),
                        width: 14,
                      },
                      { header: 'المبلغ', key: 'amount', getValue: (t: any) => t.amount.toFixed(2), width: 16 },
                      { header: 'الوسيلة', key: 'method', getValue: (t: any) => getMethodLabel(t.method), width: 16 },
                      {
                        header: 'الطرف',
                        key: 'party',
                        getValue: (t: any) => t.customerName || t.supplierName || t.recipientName || 'عام',
                        width: 24,
                      },
                      { header: 'البيان', key: 'note', width: 32 },
                    ],
                    companyName: appData.settings?.companyName || 'منظومة ركيزة المحاسبية',
                    reportTitle: 'سجل حركة الخزينة النقدية الموحد',
                  });
                  showToast('تم تصدير سجل الخزينة إلى Excel', 'success');
                }}
                className="bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <span>تصدير Excel</span>
              </button>
            </div>
          </div>

          {/* Consolidated Journal Search & Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={cashbookSearch}
                  onChange={(e) => setCashbookSearch(e.target.value)}
                  placeholder="بحث في الحركات الموحدة..."
                  className="w-full bg-white border border-slate-300 rounded-lg pr-8 pl-3 py-1 text-xs"
                />
              </div>

              <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setCashbookTypeFilter('all')}
                  className={`px-2.5 py-0.5 rounded text-xs font-bold transition cursor-pointer ${
                    cashbookTypeFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-600'
                  }`}
                >
                  الكل ({appData.cashTransactions?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setCashbookTypeFilter('receive')}
                  className={`px-2.5 py-0.5 rounded text-xs font-bold transition cursor-pointer ${
                    cashbookTypeFilter === 'receive' ? 'bg-emerald-700 text-white' : 'text-slate-600'
                  }`}
                >
                  المقبوضات ({receiptCount})
                </button>
                <button
                  type="button"
                  onClick={() => setCashbookTypeFilter('pay')}
                  className={`px-2.5 py-0.5 rounded text-xs font-bold transition cursor-pointer ${
                    cashbookTypeFilter === 'pay' ? 'bg-rose-700 text-white' : 'text-slate-600'
                  }`}
                >
                  المدفوعات ({paymentCount})
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-gradient-to-b from-slate-100 to-slate-200/90 text-slate-800 font-bold border-b border-slate-300 select-none">
                    <th className="py-2.5 px-3 w-12 text-center border-l border-slate-300">#</th>
                    <th className="py-2.5 px-3 w-28 text-center border-l border-slate-300">رقم السند</th>
                    <th className="py-2.5 px-3 w-24 text-center border-l border-slate-300">التاريخ</th>
                    <th className="py-2.5 px-3 w-28 text-center border-l border-slate-300">النوع</th>
                    <th className="py-2.5 px-3 min-w-[160px] border-l border-slate-300">الطرف / الحساب</th>
                    <th className="py-2.5 px-4 w-32 text-left border-l border-slate-300">المبلغ</th>
                    <th className="py-2.5 px-3 w-32 text-center border-l border-slate-300">الوسيلة</th>
                    <th className="py-2.5 px-3 min-w-[200px] border-l border-slate-300">البيان</th>
                    <th className="py-2.5 px-3 w-20 text-center">طباعة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        لا توجد حركات مسجلة
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((t, idx) => {
                      const isReceive = t.type === 'receive' || t.type === 'deposit';
                      return (
                        <tr key={t.id} className={idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}>
                          <td className="py-2 px-3 text-center font-mono text-slate-400 border-l border-slate-200">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-bold text-slate-700 border-l border-slate-200">
                            {t.voucherNo || (isReceive ? `REC-${t.id}` : `PAY-${t.id}`)}
                          </td>
                          <td className="py-2 px-3 text-center font-mono text-slate-600 border-l border-slate-200">
                            {t.date}
                          </td>
                          <td className="py-2 px-3 text-center border-l border-slate-200">
                            {isReceive ? (
                              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] px-2 py-0.5 rounded font-bold">
                                قبض وارد
                              </span>
                            ) : (
                              <span className="bg-rose-50 text-rose-800 border border-rose-200 text-[10px] px-2 py-0.5 rounded font-bold">
                                صرف منصرف
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-bold text-slate-900 border-l border-slate-200">
                            {t.customerName || t.supplierName || t.recipientName || 'حساب عام'}
                          </td>
                          <td
                            className={`py-2 px-4 text-left font-mono font-bold text-xs border-l border-slate-200 ${
                              isReceive ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                            dir="ltr"
                          >
                            {isReceive ? `+${t.amount.toFixed(2)}` : `-${t.amount.toFixed(2)}`} ج.م
                          </td>
                          <td className="py-2 px-3 text-center font-medium text-slate-700 border-l border-slate-200">
                            {getMethodLabel(t.method)}
                          </td>
                          <td className="py-2 px-3 text-slate-700 border-l border-slate-200">
                            <div className="truncate max-w-xs">{t.note}</div>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => printCashVoucherWindow(t, appData.settings, showToast)}
                              className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Daily Cash Closing Multi-Payment Modal */}
      <Modal
        isOpen={isClosingModalOpen}
        title="تقفيل يومية الخزينة متعدد الوسائل (تسوية الدرج)"
        onClose={() => setIsClosingModalOpen(false)}
        footer={
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <button
              onClick={() => {
                const openBal = parseFloat(closingOpenBalance) || 0;
                const actCash = parseFloat(closingActualCash) || 0;
                printCashClosingWindow(appData, closingDate, actCash, openBal, showToast);
                setIsClosingModalOpen(false);
              }}
              className="min-h-[42px] bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white px-4 py-2.5 rounded-lg font-semibold text-xs sm:text-sm cursor-pointer transition shadow-xs flex-1 text-center flex items-center justify-center gap-2"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة تقفيل اليومية</span>
            </button>
            <button
              onClick={() => {
                printShiftReportWindow(appData, closingDate, undefined, showToast);
                setIsClosingModalOpen(false);
              }}
              className="min-h-[42px] bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-lg font-semibold text-xs sm:text-sm cursor-pointer transition shadow-xs flex-1 text-center flex items-center justify-center gap-2"
            >
              <BarChart3 className="w-4 h-4" />
              <span>طباعة ملخص الشفت والأرباح</span>
            </button>
            <button
              onClick={() => setIsClosingModalOpen(false)}
              className="min-h-[42px] bg-slate-200 hover:bg-slate-300 text-slate-800 px-5 py-2.5 rounded-lg font-semibold text-xs sm:text-sm cursor-pointer transition flex-1 sm:flex-initial text-center flex items-center justify-center gap-1.5"
            >
              <X className="w-4 h-4" />
              <span>إلغاء</span>
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs md:text-sm" dir="rtl">
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between">
            <div>
              <div className="font-bold text-[#1a237e] text-sm">
                تسوية ومطابقة المقبوضات والمدفوعات لجميع الوسائل
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                تجميع حركة المبيعات، المشتريات، وسندات القبض والصرف المصنفة حسب وسيلة التحصيل
              </div>
            </div>
            <div className="text-2xl">📑</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold mb-1 text-slate-800">تاريخ التقفيل اليومي</label>
              <input
                type="date"
                value={closingDate}
                onChange={(e) => setClosingDate(e.target.value)}
                className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none bg-white font-semibold text-xs md:text-sm"
              />
            </div>

            <div>
              <label className="block font-bold mb-1 text-slate-800">العهدة النقدية الافتتاحية (ج.م)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={closingOpenBalance}
                onChange={(e) => setClosingOpenBalance(e.target.value)}
                className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none bg-white font-mono font-bold text-xs md:text-sm"
              />
            </div>

            <div>
              <label className="block font-bold mb-1 text-slate-800">الجرد الفعلي بالدرج (الكاش) (ج.م)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={closingActualCash}
                onChange={(e) => setClosingActualCash(e.target.value)}
                className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none bg-white font-mono font-bold text-xs md:text-sm"
              />
            </div>
          </div>

          {/* Live Preview Summary Cards */}
          {(() => {
            const compiled = compileCashClosingData(
              appData,
              closingDate,
              parseFloat(closingActualCash) || 0,
              parseFloat(closingOpenBalance) || 0
            );

            let cashIn = 0;
            let cashOut = 0;
            let digitalTotal = 0;

            compiled.transactions.forEach((tx) => {
              const method = tx.method.toLowerCase();
              if (method.includes('كاش') || method.includes('نقدي') || method === 'drawer') {
                cashIn += tx.amountIn;
                cashOut += tx.amountOut;
              } else {
                digitalTotal += tx.amountIn;
              }
            });

            const openBal = parseFloat(closingOpenBalance) || 0;
            const expectedCash = openBal + cashIn - cashOut;
            const actual = parseFloat(closingActualCash) || 0;
            const diff = actual - expectedCash;

            return (
              <div className="space-y-3 bg-slate-50/80 p-3 rounded-2xl border border-slate-200">
                <div className="font-bold text-slate-800 text-xs flex items-center justify-between">
                  <span>ملخص وسائل الدفع ليوم {closingDate}:</span>
                  <span className="font-mono text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    عدد الحركات: {compiled.transactions.length}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="bg-emerald-50 border border-emerald-200 p-2 rounded-xl">
                    <div className="text-emerald-800 font-bold">نقدي الدرج (وارد)</div>
                    <div className="font-mono font-black text-sm text-emerald-700 mt-1">
                      {formatNumber(cashIn)}
                    </div>
                  </div>
                  <div className="bg-rose-50 border border-rose-200 p-2 rounded-xl">
                    <div className="text-rose-800 font-bold">نقدي الدرج (منصرف)</div>
                    <div className="font-mono font-black text-sm text-rose-700 mt-1">
                      {formatNumber(cashOut)}
                    </div>
                  </div>
                  <div className="bg-indigo-50 border border-indigo-200 p-2 rounded-xl">
                    <div className="text-indigo-800 font-bold">التحصيل الإلكتروني</div>
                    <div className="font-mono font-black text-sm text-indigo-700 mt-1">
                      {formatNumber(digitalTotal)}
                    </div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 p-2 rounded-xl">
                    <div className="text-blue-800 font-bold">الرصيد الدفتري للدرج</div>
                    <div className="font-mono font-black text-sm text-blue-700 mt-1">
                      {formatNumber(expectedCash)}
                    </div>
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex justify-between items-center text-xs font-bold">
                  <span>الفارق بين الفعلي والدفتري (عجز / زيادة):</span>
                  <span
                    className={`font-mono text-sm ${
                      diff < 0 ? 'text-rose-700' : diff > 0 ? 'text-emerald-700' : 'text-slate-800'
                    }`}
                  >
                    {diff > 0 ? `+${formatNumber(diff)} ج.م (زيادة)` : diff < 0 ? `${formatNumber(diff)} ج.م (عجز)` : `0.00 ج.م (مطابق)`}
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
      </Modal>
    </div>
  );
};
