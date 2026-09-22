import React, { useState } from 'react';
import { AppData, JournalEntry, JournalLine } from '../types';
import { Modal } from './Modal';
import { addAuditLog } from '../utils/storage';
import { YearEndClosingView } from './YearEndClosingView';
import { printDailyTransactionsReportWindow } from '../utils/printDailyTransactionsReport';
import { MonthlyProfitReportView } from './MonthlyProfitReportView';
import {
  exportTrialBalanceToExcel,
  exportIncomeStatementToExcel,
  exportBalanceSheetToExcel,
} from '../utils/excelExport';

interface OperationsViewProps {
  appData: AppData;
  subPage?: string;
  onUpdateData?: (newData: AppData) => void;
  showToast?: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export const OperationsView: React.FC<OperationsViewProps> = ({
  appData,
  subPage = 'daily_operations',
  onUpdateData,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<'operations' | 'journals' | 'trialBalance' | 'incomeStatement' | 'balanceSheet' | 'monthlyProfit' | 'yearEndClosing'>(
    subPage === 'daily_entries'
      ? 'journals'
      : subPage === 'trial_balance'
      ? 'trialBalance'
      : subPage === 'income_statement'
      ? 'incomeStatement'
      : subPage === 'balance_sheet'
      ? 'balanceSheet'
      : subPage === 'monthly_profit_report'
      ? 'monthlyProfit'
      : subPage === 'year_end_closing'
      ? 'yearEndClosing'
      : 'operations'
  );

  const today = new Date().toISOString().split('T')[0];
  const [selectedOpDate, setSelectedOpDate] = useState<string>(today);

  // Daily operations stats based on selectedOpDate
  const salesToday = appData.salesInvoices.filter((inv) => inv.date === selectedOpDate);
  const purchasesToday = appData.purchaseInvoices.filter((inv) => inv.date === selectedOpDate);
  const cashToday = appData.cashTransactions.filter((c) => c.date === selectedOpDate);

  const totalSalesVal = salesToday.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const totalPurchasesVal = purchasesToday.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const totalCashIn = cashToday.filter((c) => c.type === 'receive' || c.type === 'deposit').reduce((s, c) => s + c.amount, 0);
  const totalCashOut = cashToday.filter((c) => c.type === 'pay' || c.type === 'withdraw').reduce((s, c) => s + c.amount, 0);

  // Manual Journal Entry Modal State
  const [isNewJournalOpen, setIsNewJournalOpen] = useState(false);
  const [editingJournalId, setEditingJournalId] = useState<number | null>(null);
  const [journalDate, setJournalDate] = useState(today);
  const [journalDesc, setJournalDesc] = useState('');
  const [journalRef, setJournalRef] = useState('');
  const [journalLines, setJournalLines] = useState<JournalLine[]>([
    { accountCode: '1101', accountName: 'الصندوق والخزينة الرئيسية (Cash)', debit: 0, credit: 0, note: '' },
    { accountCode: '4101', accountName: 'إيراد مبيعات بضاعة تجارية (Sales Revenue)', debit: 0, credit: 0, note: '' },
  ]);

  // Selected Journal for Details modal
  const [selectedJournal, setSelectedJournal] = useState<JournalEntry | null>(null);

  const handleOpenNewJournal = () => {
    setEditingJournalId(null);
    setJournalDate(today);
    setJournalDesc('');
    setJournalRef('');
    setJournalLines([
      { accountCode: '1101', accountName: 'الصندوق والخزينة الرئيسية (Cash)', debit: 0, credit: 0, note: '' },
      { accountCode: '4101', accountName: 'إيراد مبيعات بضاعة تجارية (Sales Revenue)', debit: 0, credit: 0, note: '' },
    ]);
    setIsNewJournalOpen(true);
  };

  const handleOpenEditJournal = (entry: JournalEntry) => {
    setEditingJournalId(entry.id);
    setJournalDate(entry.date);
    setJournalRef(entry.reference || '');
    setJournalDesc(entry.description || '');
    setJournalLines(entry.lines.map((l) => ({ ...l })));
    setIsNewJournalOpen(true);
    if (selectedJournal) setSelectedJournal(null);
  };

  const handleDeleteJournal = (id: number) => {
    if (!confirm('هل أنت متأكد من حذف هذا القيد المحاسبي؟ لا يمكن التراجع عن هذا الإجراء.')) return;
    if (!onUpdateData) return;
    const entry = appData.journalEntries?.find((e) => e.id === id);
    let updatedData = {
      ...appData,
      journalEntries: (appData.journalEntries || []).filter((e) => e.id !== id),
    };
    updatedData = addAuditLog(
      updatedData,
      'delete',
      'القيود اليومية',
      `تم حذف سند القيد اليومي رقم: ${entry?.entryNumber || id}`
    );
    onUpdateData(updatedData);
    if (selectedJournal?.id === id) setSelectedJournal(null);
    showToast?.('تم حذف القيد اليومي بنجاح', 'success');
  };

  const handleAddLine = () => {
    setJournalLines((prev) => [
      ...prev,
      { accountCode: '5204', accountName: 'مصاريف الصيانة والتشغيل والنثريات', debit: 0, credit: 0, note: '' },
    ]);
  };

  const handleRemoveLine = (idx: number) => {
    if (journalLines.length <= 2) {
      showToast?.('يجب أن يحتوي القيد على طرفين على الأقل (مدين ودائن)', 'warning');
      return;
    }
    setJournalLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleLineChange = (index: number, field: keyof JournalLine, value: any) => {
    setJournalLines((prev) => {
      const copy = [...prev];
      if (field === 'accountCode') {
        const acc = appData.accounts.find((a) => a.code === value);
        copy[index] = {
          ...copy[index],
          accountCode: value,
          accountName: acc?.name || 'حساب عام',
        };
      } else {
        copy[index] = { ...copy[index], [field]: value };
      }
      return copy;
    });
  };

  const totalDebitSum = journalLines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
  const totalCreditSum = journalLines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebitSum - totalCreditSum) < 0.01 && totalDebitSum > 0;

  const handleSaveJournal = () => {
    if (!journalDesc.trim()) {
      showToast?.('يرجى كتابة شرح أو بيان القيد اليومي', 'warning');
      return;
    }

    if (!isBalanced) {
      showToast?.('القيد غير متوازن! يجب أن يتساوى إجمالي المدين مع إجمالي الدائن تماماً', 'error');
      return;
    }

    if (!onUpdateData) return;

    if (editingJournalId !== null) {
      let updatedData = {
        ...appData,
        journalEntries: (appData.journalEntries || []).map((entry) => {
          if (entry.id === editingJournalId) {
            return {
              ...entry,
              date: journalDate,
              reference: journalRef.trim() || undefined,
              description: journalDesc.trim(),
              lines: journalLines.map((l) => ({
                ...l,
                debit: Number(l.debit) || 0,
                credit: Number(l.credit) || 0,
              })),
            };
          }
          return entry;
        }),
      };

      updatedData = addAuditLog(
        updatedData,
        'update',
        'القيود اليومية',
        `تم تعديل سند القيد اليومي رقم: ${editingJournalId} بمبلغ ${totalDebitSum.toFixed(2)} ج.م`
      );

      onUpdateData(updatedData);
      showToast?.('تم تعديل وحفظ القيد اليومي بنجاح', 'success');
      setIsNewJournalOpen(false);
      setEditingJournalId(null);
      setJournalDesc('');
      setJournalRef('');
      return;
    }

    const nextId = appData.nextJournalId || (appData.journalEntries?.length || 0) + 1;
    const currentUserObj = appData.users.find((u) => u.id === appData.currentUser) || appData.users[0];

    const newEntry: JournalEntry = {
      id: nextId,
      entryNumber: `JV-${new Date().getFullYear()}-${String(nextId).padStart(4, '0')}`,
      date: journalDate,
      reference: journalRef.trim() || undefined,
      description: journalDesc.trim(),
      lines: journalLines.map((l) => ({
        ...l,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
      })),
      source: 'manual',
      createdBy: currentUserObj?.name || 'مدير النظام',
      createdAt: new Date().toISOString(),
      isApproved: true,
    };

    let updatedData = {
      ...appData,
      journalEntries: [newEntry, ...(appData.journalEntries || [])],
      nextJournalId: nextId + 1,
    };

    updatedData = addAuditLog(
      updatedData,
      'create',
      'القيود اليومية',
      `تم تسجيل سند قيد محاسبي مزدوج جديد برقم: ${newEntry.entryNumber} بمبلغ ${totalDebitSum.toFixed(2)} ج.م`
    );

    onUpdateData(updatedData);
    showToast?.('تم تسجيل وترحيل سند القيد اليومي المزدوج بنجاح', 'success');
    setIsNewJournalOpen(false);
    setJournalDesc('');
    setJournalRef('');
  };

  // Compile Financial Statements Calculations
  const allSales = appData.salesInvoices.reduce((s, inv) => s + (inv.total || 0), 0);
  const allSalesReturns = appData.salesInvoices.filter((i) => i.type.includes('return')).reduce((s, inv) => s + (inv.total || 0), 0);
  const netSalesRevenue = allSales - allSalesReturns;

  const totalCOGS = appData.salesInvoices.reduce((sum, inv) => {
    const cost = inv.items.reduce((iSum, item) => {
      const original = appData.items.find((i) => i.name === item.name);
      return iSum + ((original?.purchasePrice || item.price * 0.75) * item.qty);
    }, 0);
    return sum + (inv.type.includes('return') ? -cost : cost);
  }, 0);

  const grossProfit = netSalesRevenue - totalCOGS;

  const operatingExpenses = appData.cashTransactions
    .filter((c) => c.type === 'pay' && !c.supplierName)
    .reduce((sum, c) => sum + c.amount, 0);

  const netIncome = grossProfit - operatingExpenses;

  // Balance Sheet Metrics
  const totalCashBank = (appData.cashBox?.drawer || 0) + (appData.cashBox?.vodafone || 0) + (appData.cashBox?.instapay || 0) + (appData.cashBox?.bank || 0);
  const totalReceivables = appData.customers.reduce((s, c) => s + (c.balance > 0 ? c.balance : 0), 0);
  const totalInventoryVal = appData.items.reduce((s, i) => s + (i.quantity * i.purchasePrice), 0);
  const totalCurrentAssets = totalCashBank + totalReceivables + totalInventoryVal;
  const totalFixedAssets = 35000; // estimated equipment/furniture
  const totalAssets = totalCurrentAssets + totalFixedAssets;

  const totalPayables = appData.suppliers.reduce((s, sObj) => s + (sObj.balance > 0 ? sObj.balance : 0), 0);
  const totalVatPayable = appData.salesInvoices.reduce((s, i) => s + (i.tax || 0), 0) - appData.purchaseInvoices.reduce((s, i) => s + (i.tax || 0), 0);
  const totalLiabilities = totalPayables + (totalVatPayable > 0 ? totalVatPayable : 0);

  const capital = 100000;
  const totalEquity = capital + netIncome;

  return (
    <div className="space-y-6">
      {/* Top Module Tabs */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('operations')}
            className={`px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'operations'
                ? 'bg-[#1a237e] text-white shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            📊 العمليات اليومية
          </button>
          <button
            onClick={() => setActiveTab('journals')}
            className={`px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'journals'
                ? 'bg-[#1a237e] text-white shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            📑 دفتر القيود المزدوجة ({appData.journalEntries?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('trialBalance')}
            className={`px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'trialBalance'
                ? 'bg-[#1a237e] text-white shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            ⚖️ ميزان المراجعة
          </button>
          <button
            onClick={() => setActiveTab('incomeStatement')}
            className={`px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'incomeStatement'
                ? 'bg-[#1a237e] text-white shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            📈 قائمة الدخل (P&L)
          </button>
          <button
            onClick={() => setActiveTab('balanceSheet')}
            className={`px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'balanceSheet'
                ? 'bg-[#1a237e] text-white shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            🏛️ الميزانية العمومية
          </button>
          <button
            onClick={() => setActiveTab('monthlyProfit')}
            className={`px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'monthlyProfit'
                ? 'bg-emerald-700 text-white shadow-md'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-bold border border-emerald-200'
            }`}
          >
            💰 أرباح وتكلفة المبيعات (COGS)
          </button>
          <button
            onClick={() => setActiveTab('yearEndClosing')}
            className={`px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'yearEndClosing'
                ? 'bg-[#1a237e] text-white shadow-md'
                : 'bg-amber-100 text-amber-900 hover:bg-amber-200 font-black'
            }`}
          >
            🔒 الإقفال السنوي
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'operations' && (
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
              <label className="text-xs text-slate-600 font-bold flex items-center gap-1">
                <span>📅</span>
                <span>تاريخ الحركة:</span>
              </label>
              <input
                type="date"
                value={selectedOpDate}
                onChange={(e) => setSelectedOpDate(e.target.value || today)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={() => printDailyTransactionsReportWindow(appData, selectedOpDate, undefined, showToast)}
                className="bg-[#1a237e] hover:bg-[#0d1642] text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                title="طباعة تقرير حركة العمليات اليومية الرسمي"
              >
                <span>🖨️</span>
                <span>طباعة تقرير حركة العمليات</span>
              </button>
            </div>
          )}

          {activeTab === 'journals' && (
            <button
              onClick={handleOpenNewJournal}
              className="bg-[#2e7d32] hover:bg-[#1b5e20] text-white px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition cursor-pointer flex items-center gap-1 shadow-sm"
            >
              ➕ تسجيل قيد يومي مزدوج جديد
            </button>
          )}
        </div>
      </div>

      {/* 1. Daily Operations Tab */}
      {activeTab === 'operations' && (
        <div className="space-y-6">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl shadow-sm text-center border border-slate-100">
              <span className="text-slate-500 text-xs block mb-1">📅 تاريخ اليوم</span>
              <strong className="text-[#1a237e] text-base md:text-lg">{today}</strong>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm text-center border border-slate-100">
              <span className="text-slate-500 text-xs block mb-1">💰 مبيعات اليوم</span>
              <strong className="text-[#2e7d32] text-base md:text-lg">
                {totalSalesVal.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
              </strong>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm text-center border border-slate-100">
              <span className="text-slate-500 text-xs block mb-1">🛒 مشتريات اليوم</span>
              <strong className="text-[#c62828] text-base md:text-lg">
                {totalPurchasesVal.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
              </strong>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm text-center border border-slate-100">
              <span className="text-slate-500 text-xs block mb-1">💵 صافي التدفق النقدي</span>
              <strong
                className={`text-base md:text-lg ${
                  totalCashIn - totalCashOut >= 0 ? 'text-[#2e7d32]' : 'text-[#c62828]'
                }`}
              >
                {(totalCashIn - totalCashOut).toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
              </strong>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Sales Invoices Today */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
              <h4 className="text-[#1a237e] font-bold text-sm mb-3 flex items-center justify-between">
                <span>📄 فواتير المبيعات اليوم ({salesToday.length})</span>
                <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                  {totalSalesVal.toFixed(2)} ج.م
                </span>
              </h4>
              {/* Mobile Today Sales Cards (< md) */}
              <div className="block md:hidden space-y-2 max-h-[300px] overflow-y-auto">
                {salesToday.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-xs">
                    لا توجد فواتير مبيعات مسجلة اليوم
                  </div>
                ) : (
                  salesToday.map((inv) => (
                    <div key={inv.id} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-slate-800">#{inv.id}</span>
                        <span className="font-mono font-bold text-emerald-700">{inv.total.toFixed(2)} ج.م</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="truncate max-w-[150px]">{inv.customerName}</span>
                        <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-semibold">
                          {inv.type === 'nagdi' ? 'نقدي' : 'آجل'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop Today Sales Table (>= md) */}
              <div className="hidden md:block overflow-x-auto max-h-[300px]">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 sticky top-0">
                    <tr>
                      <th className="p-2.5">رقم</th>
                      <th className="p-2.5">العميل</th>
                      <th className="p-2.5">النوع</th>
                      <th className="p-2.5">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {salesToday.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-slate-400">
                          لا توجد فواتير مبيعات مسجلة اليوم
                        </td>
                      </tr>
                    ) : (
                      salesToday.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono font-bold">#{inv.id}</td>
                          <td className="p-2.5">{inv.customerName}</td>
                          <td className="p-2.5">
                            <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-semibold">
                              {inv.type === 'nagdi' ? 'نقدي' : 'آجل'}
                            </span>
                          </td>
                          <td className="p-2.5 font-bold text-emerald-700 font-mono">
                            {inv.total.toFixed(2)} ج.م
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Purchases Invoices Today */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
              <h4 className="text-[#1a237e] font-bold text-sm mb-3 flex items-center justify-between">
                <span>🛒 فواتير المشتريات اليوم ({purchasesToday.length})</span>
                <span className="text-xs bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full font-bold">
                  {totalPurchasesVal.toFixed(2)} ج.م
                </span>
              </h4>
              {/* Mobile Today Purchases Cards (< md) */}
              <div className="block md:hidden space-y-2 max-h-[300px] overflow-y-auto">
                {purchasesToday.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-xs">
                    لا توجد فواتير مشتريات مسجلة اليوم
                  </div>
                ) : (
                  purchasesToday.map((inv) => (
                    <div key={inv.id} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-slate-800">#{inv.id}</span>
                        <span className="font-mono font-bold text-rose-700">{inv.total.toFixed(2)} ج.م</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="truncate max-w-[150px]">{inv.supplierName}</span>
                        <span className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-semibold">
                          {inv.type === 'nagdi' ? 'نقدي' : 'آجل'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop Today Purchases Table (>= md) */}
              <div className="hidden md:block overflow-x-auto max-h-[300px]">
                <table className="w-full text-right text-xs">
                  <tbody className="divide-y divide-slate-100">
                    {purchasesToday.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-slate-400">
                          لا توجد فواتير مشتريات مسجلة اليوم
                        </td>
                      </tr>
                    ) : (
                      purchasesToday.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono font-bold">#{inv.id}</td>
                          <td className="p-2.5">{inv.supplierName}</td>
                          <td className="p-2.5">
                            <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded font-semibold">
                              {inv.type === 'nagdi' ? 'نقدي' : 'آجل'}
                            </span>
                          </td>
                          <td className="p-2.5 font-bold text-rose-700 font-mono">
                            {inv.total.toFixed(2)} ج.م
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Journal Entries Tab */}
      {activeTab === 'journals' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base md:text-lg font-bold text-[#1a237e]">
                سجل القيود اليومية المحاسبية المزدوجة (General Journal)
              </h3>
              <p className="text-xs text-slate-500">
                تسجيل قيود التسوية، القيود الافتتاحية، وسندات اليومية العامة المتوازنة أوتوماتيكياً ويدوياً.
              </p>
            </div>
          </div>

          {/* Mobile Journal Entries Cards (< md) */}
          <div className="block md:hidden space-y-3">
            {(!appData.journalEntries || appData.journalEntries.length === 0) ? (
              <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                لا توجد قيود يومية مسجلة بعد. يمكنك تسجيل قيد جديد عبر الزر أعلاه.
              </div>
            ) : (
              appData.journalEntries.map((entry) => {
                const totalVal = entry.lines.reduce((s, l) => s + (l.debit || 0), 0);
                return (
                  <div key={entry.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
                      <span className="font-mono font-bold text-indigo-900 text-sm">{entry.entryNumber}</span>
                      <span className="font-mono text-slate-500">{entry.date}</span>
                      <span className="text-[11px] bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded font-bold">
                        {entry.source === 'manual' ? 'قيد يدوي' : entry.source}
                      </span>
                    </div>

                    <div className="font-semibold text-slate-900 break-words leading-relaxed">
                      {entry.description}
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-white p-2.5 rounded-lg border border-slate-200">
                      <div>
                        <span className="text-[10px] text-slate-400 block">إجمالي القيد:</span>
                        <span className="font-mono font-bold text-emerald-700 text-sm">
                          {totalVal.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">المحرر:</span>
                        <span className="text-slate-700 font-medium truncate block">{entry.createdBy}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 pt-1">
                      <button
                        onClick={() => setSelectedJournal(entry)}
                        className="min-h-[42px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold transition flex items-center justify-center gap-1"
                      >
                        👁️ عرض
                      </button>
                      <button
                        onClick={() => handleOpenEditJournal(entry)}
                        className="min-h-[42px] bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-bold transition flex items-center justify-center gap-1"
                      >
                        ✏️ تعديل
                      </button>
                      <button
                        onClick={() => handleDeleteJournal(entry.id)}
                        className="min-h-[42px] bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl font-bold transition flex items-center justify-center gap-1"
                      >
                        🗑️ حذف
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Journal Entries Table (>= md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-right text-xs md:text-sm">
              <thead className="bg-[#1a237e] text-white">
                <tr>
                  <th className="p-3 rounded-r-lg">رقم القيد</th>
                  <th className="p-3">التاريخ</th>
                  <th className="p-3">البيان والشرح</th>
                  <th className="p-3">المصدر</th>
                  <th className="p-3">إجمالي القيد</th>
                  <th className="p-3">المحرر</th>
                  <th className="p-3 rounded-l-lg">التفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(!appData.journalEntries || appData.journalEntries.length === 0) ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      لا توجد قيود يومية مسجلة بعد. يمكنك تسجيل قيد جديد عبر الزر أعلاه.
                    </td>
                  </tr>
                ) : (
                  appData.journalEntries.map((entry) => {
                    const totalVal = entry.lines.reduce((s, l) => s + (l.debit || 0), 0);
                    return (
                      <tr key={entry.id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono font-bold text-indigo-900">{entry.entryNumber}</td>
                        <td className="p-3 font-mono">{entry.date}</td>
                        <td className="p-3 font-semibold text-slate-800">{entry.description}</td>
                        <td className="p-3">
                          <span className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">
                            {entry.source === 'manual' ? 'قيد يدوي' : entry.source}
                          </span>
                        </td>
                        <td className="p-3 font-mono font-bold text-emerald-700">
                          {totalVal.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
                        </td>
                        <td className="p-3 text-slate-600">{entry.createdBy}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setSelectedJournal(entry)}
                              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer"
                              title="عرض التفاصيل"
                            >
                              👁️ عرض
                            </button>
                            <button
                              onClick={() => handleOpenEditJournal(entry)}
                              className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer"
                              title="تعديل القيد"
                            >
                              ✏️ تعديل
                            </button>
                            <button
                              onClick={() => handleDeleteJournal(entry.id)}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-700 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer"
                              title="حذف القيد"
                            >
                              🗑️ حذف
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Trial Balance Tab */}
      {activeTab === 'trialBalance' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base md:text-lg font-bold text-[#1a237e]">
                ميزان المراجعة بالأرصدة والمجاميع (Trial Balance)
              </h3>
              <p className="text-xs text-slate-500">
                التحقق المحاسبي الشامل من توازن كافة حسابات الأصول، الخصوم، حقوق الملكية، الإيرادات والمصروفات.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  exportTrialBalanceToExcel({
                    accounts: appData.accounts,
                    companyName: appData.settings?.companyName || 'منظومة ركيزة RAKEEZA ERP',
                    appData,
                  });
                  if (showToast) showToast('تم تصدير ميزان المراجعة إلى ملف Excel بنجاح', 'success');
                }}
                className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <span>📊</span>
                <span>تصدير إلى Excel</span>
              </button>
              <button
                onClick={() => window.print()}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                🖨️ طباعة الميزان
              </button>
            </div>
          </div>

          {/* Mobile Trial Balance Cards (< md) */}
          <div className="block md:hidden space-y-3">
            {appData.accounts
              .filter((a) => !a.isParent)
              .map((acc) => {
                let d = 0;
                let c = 0;
                if (acc.code === '1101') d = appData.cashBox?.drawer || 0;
                if (acc.code === '1102') d = appData.cashBox?.vodafone || 0;
                if (acc.code === '1103') d = appData.cashBox?.instapay || 0;
                if (acc.code === '1104') d = appData.cashBox?.bank || 0;
                if (acc.code === '1105') d = totalReceivables;
                if (acc.code === '1106') d = totalInventoryVal;
                if (acc.code === '2101') c = totalPayables;
                if (acc.code === '4101') c = allSales;
                if (acc.code === '5101') d = totalCOGS;
                if (acc.code === '5204') d = operatingExpenses;

                const bal = (acc.type === 'asset' || acc.type === 'expense') ? d - c : c - d;

                return (
                  <div key={acc.code} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-indigo-900 bg-white border border-slate-200 px-2 py-0.5 rounded text-xs">
                          {acc.code}
                        </span>
                        <span className="font-bold text-slate-900">{acc.name}</span>
                      </div>
                      <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-bold">
                        {acc.type}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 bg-white p-2 rounded-lg border border-slate-200 text-center">
                      <div>
                        <span className="text-[10px] text-slate-400 block">مدين:</span>
                        <span className="font-mono font-semibold text-emerald-700">
                          {d > 0 ? d.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">دائن:</span>
                        <span className="font-mono font-semibold text-rose-700">
                          {c > 0 ? c.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">الرصيد:</span>
                        <span className="font-mono font-bold text-slate-900">
                          {bal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Desktop Trial Balance Table (>= md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-right text-xs md:text-sm">
              <thead className="bg-[#1a237e] text-white">
                <tr>
                  <th className="p-3 rounded-r-lg">كود الحساب</th>
                  <th className="p-3">اسم الحساب</th>
                  <th className="p-3">النوع</th>
                  <th className="p-3">مجموع المدين (Debit)</th>
                  <th className="p-3">مجموع الدائن (Credit)</th>
                  <th className="p-3 rounded-l-lg">رصيد الحساب</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {appData.accounts
                  .filter((a) => !a.isParent)
                  .map((acc) => {
                    let d = 0;
                    let c = 0;
                    if (acc.code === '1101') d = appData.cashBox?.drawer || 0;
                    if (acc.code === '1102') d = appData.cashBox?.vodafone || 0;
                    if (acc.code === '1103') d = appData.cashBox?.instapay || 0;
                    if (acc.code === '1104') d = appData.cashBox?.bank || 0;
                    if (acc.code === '1105') d = totalReceivables;
                    if (acc.code === '1106') d = totalInventoryVal;
                    if (acc.code === '2101') c = totalPayables;
                    if (acc.code === '4101') c = allSales;
                    if (acc.code === '5101') d = totalCOGS;
                    if (acc.code === '5204') d = operatingExpenses;

                    const bal = (acc.type === 'asset' || acc.type === 'expense') ? d - c : c - d;

                    return (
                      <tr key={acc.code} className="hover:bg-slate-50">
                        <td className="p-3 font-mono font-bold text-indigo-900">{acc.code}</td>
                        <td className="p-3 font-semibold">{acc.name}</td>
                        <td className="p-3">
                          <span className="text-[11px] bg-slate-100 px-2 py-0.5 rounded font-bold">
                            {acc.type}
                          </span>
                        </td>
                        <td className="p-3 font-mono font-semibold text-emerald-700">
                          {d > 0 ? d.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                        </td>
                        <td className="p-3 font-mono font-semibold text-rose-700">
                          {c > 0 ? c.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-900">
                          {bal.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Income Statement Tab (P&L) */}
      {activeTab === 'incomeStatement' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base md:text-lg font-bold text-[#1a237e]">
                قائمة الدخل والأرباح والخسائر الشاملة (Income Statement / P&L)
              </h3>
              <p className="text-xs text-slate-500">
                تقرير الإيرادات، تكلفة البضاعة المباعة، المصروفات التشغيلية، وصافي أرباح الفترة.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  exportIncomeStatementToExcel({
                    companyName: appData.settings?.companyName || 'منظومة ركيزة RAKEEZA ERP',
                    allSales,
                    allSalesReturns,
                    netSalesRevenue,
                    totalCOGS,
                    grossProfit,
                    operatingExpenses,
                    netIncome,
                  });
                  if (showToast) showToast('تم تصدير قائمة الدخل إلى ملف Excel بنجاح', 'success');
                }}
                className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <span>📊</span>
                <span>تصدير إلى Excel</span>
              </button>
              <button
                onClick={() => window.print()}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                🖨️ طباعة
              </button>
            </div>
          </div>

          <div className="max-w-2xl mx-auto space-y-3 font-mono text-sm">
            {/* Revenue Section */}
            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-2">
              <div className="flex justify-between items-center font-bold text-blue-900">
                <span>➕ إجمالي الإيرادات والمبيعات (Sales Revenue)</span>
                <span>{allSales.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م</span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-600 pr-4">
                <span>- مردودات ومسموحات المبيعات</span>
                <span>{allSalesReturns.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م</span>
              </div>
              <div className="flex justify-between items-center font-bold text-emerald-800 pt-2 border-t border-blue-200">
                <span>= صافي المبيعات (Net Revenue)</span>
                <span>{netSalesRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م</span>
              </div>
            </div>

            {/* COGS Section */}
            <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-100 space-y-2">
              <div className="flex justify-between items-center font-bold text-rose-900">
                <span>➖ تكلفة البضاعة المباعة (Cost of Goods Sold - COGS)</span>
                <span>{totalCOGS.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م</span>
              </div>
            </div>

            {/* Gross Profit */}
            <div className="bg-emerald-50 p-4 rounded-xl border-2 border-emerald-300 flex justify-between items-center font-black text-emerald-900 text-base">
              <span>🧮 مجمل الربح التجاري (Gross Profit)</span>
              <span>{grossProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م</span>
            </div>

            {/* Operating Expenses */}
            <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100 space-y-2">
              <div className="flex justify-between items-center font-bold text-amber-900">
                <span>➖ المصروفات التشغيلية والإدارية (Operating Expenses)</span>
                <span>{operatingExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م</span>
              </div>
            </div>

            {/* Net Income */}
            <div className="bg-[#1a237e] text-white p-5 rounded-2xl flex justify-between items-center font-black text-lg shadow-lg">
              <span>🏆 صافي الربح / الخسارة النهائي (Net Profit)</span>
              <span className={netIncome >= 0 ? 'text-[#ffd54f]' : 'text-rose-300'}>
                {netIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 5. Balance Sheet Tab */}
      {activeTab === 'balanceSheet' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base md:text-lg font-bold text-[#1a237e]">
                الميزانية العمومية والمركز المالي (Balance Sheet)
              </h3>
              <p className="text-xs text-slate-500">
                معادلة الميزانية: الأصول (Assets) = الخصوم (Liabilities) + حقوق الملكية (Equity).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  exportBalanceSheetToExcel({
                    companyName: appData.settings?.companyName || 'منظومة ركيزة RAKEEZA ERP',
                    totalCurrentAssets,
                    totalCashBank,
                    totalReceivables,
                    totalInventoryVal,
                    totalFixedAssets,
                    totalAssets,
                    totalLiabilities,
                    totalPayables,
                    totalEquity,
                    netIncome,
                  });
                  if (showToast) showToast('تم تصدير الميزانية العمومية والمركز المالي إلى ملف Excel بنجاح', 'success');
                }}
                className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <span>📊</span>
                <span>تصدير إلى Excel</span>
              </button>
              <button
                onClick={() => window.print()}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                🖨️ طباعة
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-sm">
            {/* Assets Side */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
              <h4 className="font-bold text-[#1a237e] text-base pb-2 border-b border-slate-200 flex justify-between">
                <span>1️⃣ الأصول (Assets)</span>
                <span>{totalAssets.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م</span>
              </h4>
              <div className="space-y-1.5 text-xs text-slate-700">
                <div className="flex justify-between font-bold text-slate-900">
                  <span>الأصول المتداولة:</span>
                  <span>{totalCurrentAssets.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م</span>
                </div>
                <div className="flex justify-between pr-3 text-slate-500">
                  <span>• النقدية والبنوك</span>
                  <span>{totalCashBank.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م</span>
                </div>
                <div className="flex justify-between pr-3 text-slate-500">
                  <span>• حسابات العملاء والمدينون</span>
                  <span>{totalReceivables.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م</span>
                </div>
                <div className="flex justify-between pr-3 text-slate-500">
                  <span>• مخزون البضاعة</span>
                  <span>{totalInventoryVal.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م</span>
                </div>

                <div className="flex justify-between font-bold text-slate-900 pt-2">
                  <span>الأصول الثابتة:</span>
                  <span>{totalFixedAssets.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م</span>
                </div>
              </div>
            </div>

            {/* Liabilities & Equity Side */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
              <h4 className="font-bold text-rose-900 text-base pb-2 border-b border-slate-200 flex justify-between">
                <span>2️⃣ الخصوم وحقوق الملكية</span>
                <span>{(totalLiabilities + totalEquity).toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م</span>
              </h4>
              <div className="space-y-1.5 text-xs text-slate-700">
                <div className="flex justify-between font-bold text-slate-900">
                  <span>الخصوم والالتزامات المتداولة:</span>
                  <span>{totalLiabilities.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م</span>
                </div>
                <div className="flex justify-between pr-3 text-slate-500">
                  <span>• الموردون والدائنون</span>
                  <span>{totalPayables.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م</span>
                </div>
                <div className="flex justify-between pr-3 text-slate-500">
                  <span>• التزامات ضريبية مستحقة</span>
                  <span>{(totalVatPayable > 0 ? totalVatPayable : 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م</span>
                </div>

                <div className="flex justify-between font-bold text-purple-900 pt-2">
                  <span>حقوق الملكية (Equity):</span>
                  <span>{totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م</span>
                </div>
                <div className="flex justify-between pr-3 text-slate-500">
                  <span>• رأس المال المستثمر</span>
                  <span>{capital.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م</span>
                </div>
                <div className="flex justify-between pr-3 text-slate-500">
                  <span>• أرباح العام الحالي</span>
                  <span>{netIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5.5 Monthly Profit & COGS Report Tab */}
      {activeTab === 'monthlyProfit' && (
        <div className="pt-2">
          <MonthlyProfitReportView appData={appData} />
        </div>
      )}

      {/* 6. Year-End Closing Tab */}
      {activeTab === 'yearEndClosing' && (
        <div className="pt-2">
          <YearEndClosingView
            appData={appData}
            onUpdateData={onUpdateData || (() => {})}
            showToast={showToast || (() => {})}
          />
        </div>
      )}

      {/* Modal: New Manual Journal Entry */}
      <Modal
        isOpen={isNewJournalOpen}
        onClose={() => {
          setIsNewJournalOpen(false);
          setEditingJournalId(null);
        }}
        title={editingJournalId ? `✏️ تعديل سند القيد اليومي رقم #${editingJournalId}` : "➕ تسجيل سند قيد محاسبي مزدوج (Journal Entry)"}
        footer={
          <div className="flex justify-between items-center w-full">
            <div className="font-mono text-xs font-bold">
              <span className="text-emerald-700">مدين: {totalDebitSum.toFixed(2)}</span> |{' '}
              <span className="text-rose-700">دائن: {totalCreditSum.toFixed(2)}</span> |{' '}
              <span className={isBalanced ? 'text-emerald-800' : 'text-rose-800'}>
                {isBalanced ? '✅ متوازن' : '❌ غير متوازن'}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setIsNewJournalOpen(false);
                  setEditingJournalId(null);
                }}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveJournal}
                disabled={!isBalanced}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition ${
                  isBalanced
                    ? 'bg-[#2e7d32] hover:bg-[#1b5e20] text-white cursor-pointer'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                }`}
              >
                {editingJournalId ? 'تحديث وحفظ التعديلات' : 'ترحيل وحفظ القيد'}
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 text-xs md:text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">تاريخ القيد *</label>
              <input
                type="date"
                value={journalDate}
                onChange={(e) => setJournalDate(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">رقم المرجع / المستند</label>
              <input
                type="text"
                value={journalRef}
                onChange={(e) => setJournalRef(e.target.value)}
                placeholder="مثال: REF-1025"
                className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">البيان والشرح العام للقيد *</label>
            <input
              type="text"
              value={journalDesc}
              onChange={(e) => setJournalDesc(e.target.value)}
              placeholder="مثال: إثبات سداد إيجار المعرض والمرافق عن شهر أغسطس..."
              className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Lines Table */}
          <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-3">
            <div className="flex justify-between items-center">
              <h5 className="font-bold text-slate-800 text-xs">أطراف القيد (المدين والدائن)</h5>
              <button
                onClick={handleAddLine}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                ➕ إضافة سطر
              </button>
            </div>

            <div className="space-y-2">
              {journalLines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-white p-2.5 rounded-xl border border-slate-200">
                  <div className="col-span-5">
                    <select
                      value={line.accountCode}
                      onChange={(e) => handleLineChange(idx, 'accountCode', e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs font-semibold"
                    >
                      {appData.accounts.map((acc) => (
                        <option key={acc.code} value={acc.code}>
                          [{acc.code}] {acc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <input
                      type="number"
                      placeholder="مدين"
                      value={line.debit || ''}
                      onChange={(e) => handleLineChange(idx, 'debit', parseFloat(e.target.value) || 0)}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono font-bold text-emerald-700"
                    />
                  </div>
                  <div className="col-span-3">
                    <input
                      type="number"
                      placeholder="دائن"
                      value={line.credit || ''}
                      onChange={(e) => handleLineChange(idx, 'credit', parseFloat(e.target.value) || 0)}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono font-bold text-rose-700"
                    />
                  </div>
                  <div className="col-span-1 text-center">
                    <button
                      onClick={() => handleRemoveLine(idx)}
                      className="text-rose-600 hover:text-rose-800 font-bold text-sm cursor-pointer"
                      title="حذف السطر"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal: View Selected Journal Entry */}
      <Modal
        isOpen={!!selectedJournal}
        onClose={() => setSelectedJournal(null)}
        title={`📄 تفاصيل سند القيد ${selectedJournal?.entryNumber || ''}`}
        footer={
          <div className="flex justify-between items-center w-full">
            <div className="flex gap-2">
              <button
                onClick={() => selectedJournal && handleOpenEditJournal(selectedJournal)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-xs"
              >
                ✏️ تعديل القيد
              </button>
              <button
                onClick={() => selectedJournal && handleDeleteJournal(selectedJournal.id)}
                className="bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-xs"
              >
                🗑️ حذف القيد
              </button>
            </div>
            <button
              onClick={() => setSelectedJournal(null)}
              className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        }
      >
        {selectedJournal && (
          <div className="space-y-4 text-xs md:text-sm">
            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl">
              <div><strong>رقم القيد:</strong> {selectedJournal.entryNumber}</div>
              <div><strong>التاريخ:</strong> {selectedJournal.date}</div>
              <div className="col-span-2"><strong>البيان والشرح:</strong> {selectedJournal.description}</div>
              <div><strong>المحرر:</strong> {selectedJournal.createdBy}</div>
              <div><strong>المصدر:</strong> {selectedJournal.source}</div>
            </div>

            {/* Mobile Modal Lines Cards (< md) */}
            <div className="block md:hidden space-y-2">
              {selectedJournal.lines.map((l, i) => (
                <div key={i} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-indigo-900">{l.accountCode}</span>
                    <span className="text-slate-800 font-semibold">{l.accountName}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-[11px]">
                    <span className="font-mono text-emerald-700 font-bold">
                      مدين: {l.debit > 0 ? `${l.debit.toFixed(2)} ج.م` : '-'}
                    </span>
                    <span className="font-mono text-rose-700 font-bold">
                      دائن: {l.credit > 0 ? `${l.credit.toFixed(2)} ج.م` : '-'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Modal Lines Table (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-[#1a237e] text-white">
                  <tr>
                    <th className="p-2.5 rounded-r-lg">كود الحساب</th>
                    <th className="p-2.5">اسم الحساب</th>
                    <th className="p-2.5">مدين</th>
                    <th className="p-2.5 rounded-l-lg">دائن</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedJournal.lines.map((l, i) => (
                    <tr key={i}>
                      <td className="p-2.5 font-mono font-bold">{l.accountCode}</td>
                      <td className="p-2.5">{l.accountName}</td>
                      <td className="p-2.5 font-mono font-bold text-emerald-700">{l.debit > 0 ? l.debit.toFixed(2) : '-'}</td>
                      <td className="p-2.5 font-mono font-bold text-rose-700">{l.credit > 0 ? l.credit.toFixed(2) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
