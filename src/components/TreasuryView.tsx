import React, { useState } from 'react';
import { AppData, CashTransaction } from '../types';
import { Modal } from './Modal';
import { printCashClosingWindow } from '../utils/printCashClosing';
import { printCashBalancesReportWindow, compileCashBalancesData, formatEnNumber } from '../utils/printCashBalancesReport';
import { printDailyTransactionsReportWindow } from '../utils/printDailyTransactionsReport';
import { exportToExcel } from '../utils/excelExport';

interface TreasuryViewProps {
  appData: AppData;
  onUpdateData: (newData: AppData) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const TreasuryView: React.FC<TreasuryViewProps> = ({ appData, onUpdateData, showToast }) => {
  const cash = appData.cashBox || { drawer: 0, vodafone: 0, instapay: 0, bank: 0 };
  const totalCash = (cash.drawer || 0) + (cash.vodafone || 0) + (cash.instapay || 0) + (cash.bank || 0);

  // Active view tab: 'transactions' or 'balances_matrix'
  const [activeTab, setActiveTab] = useState<'transactions' | 'balances_matrix'>('transactions');

  // Modals state
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [isBankOpen, setIsBankOpen] = useState(false);

  // Deposit Form
  const [depMethod, setDepMethod] = useState<'drawer' | 'vodafone' | 'instapay' | 'bank'>('drawer');
  const [depBankId, setDepBankId] = useState<string>('');
  const [depAmount, setDepAmount] = useState<number | ''>('');
  const [depNote, setDepNote] = useState<string>('');
  const [depDate, setDepDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Transfer Form
  const [trFrom, setTrFrom] = useState<'drawer' | 'vodafone' | 'instapay' | 'bank'>('drawer');
  const [trTo, setTrTo] = useState<'drawer' | 'vodafone' | 'instapay' | 'bank'>('vodafone');
  const [trAmount, setTrAmount] = useState<number | ''>('');
  const [trNote, setTrNote] = useState<string>('');
  const [trDate, setTrDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Withdraw Form
  const [wthMethod, setWthMethod] = useState<'drawer' | 'vodafone' | 'instapay' | 'bank'>('drawer');
  const [wthAmount, setWthAmount] = useState<number | ''>('');
  const [wthNote, setWthNote] = useState<string>('');
  const [wthDate, setWthDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // New Bank Form
  const [bankName, setBankName] = useState('');
  const [bankAccountNum, setBankAccountNum] = useState('');
  const [bankInitial, setBankInitial] = useState<number | ''>('');

  // Table Filters
  const [search, setSearch] = useState('');
  const [filterMethod, setFilterMethod] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const getMethodName = (m: string) => {
    switch (m) {
      case 'drawer':
        return 'نقدي (الدرج)';
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

  // Compile Balances Matrix Data
  const matrixData = compileCashBalancesData(appData);
  const paymentMethodsSet = new Set<string>();
  matrixData.cashData.forEach((item) => {
    Object.keys(item.amounts).forEach((m) => paymentMethodsSet.add(m));
  });
  const methods = Array.from(paymentMethodsSet);
  const methodTotals: Record<string, number> = {};
  methods.forEach((m) => (methodTotals[m] = 0));
  let grandTotal = 0;
  matrixData.cashData.forEach((item) => {
    methods.forEach((m) => {
      const val = item.amounts[m] || 0;
      methodTotals[m] += val;
      grandTotal += val;
    });
  });

  // Deposit Action
  const handleExecuteDeposit = () => {
    const amt = Number(depAmount);
    if (!amt || amt <= 0) {
      showToast('يرجى إدخال مبلغ إيداع صحيح أكبر من صفر', 'warning');
      return;
    }

    const newCashBox = { ...cash, [depMethod]: (cash[depMethod] || 0) + amt };

    let updatedBankAccounts = appData.bankAccounts || [];
    if (depMethod === 'bank' && depBankId) {
      updatedBankAccounts = updatedBankAccounts.map((b) =>
        b.id === depBankId ? { ...b, balance: (b.balance || 0) + amt } : b
      );
    }

    const newTx: CashTransaction = {
      id: appData.nextCashId,
      date: depDate || new Date().toISOString().split('T')[0],
      type: 'deposit',
      method: depMethod,
      amount: amt,
      note: depNote.trim() || `إيداع نقدية مباشر في ${getMethodName(depMethod)}`,
    };

    const updatedData: AppData = {
      ...appData,
      cashBox: newCashBox,
      bankAccounts: updatedBankAccounts,
      cashTransactions: [...appData.cashTransactions, newTx],
      nextCashId: appData.nextCashId + 1,
    };

    onUpdateData(updatedData);
    setIsDepositOpen(false);
    setDepAmount('');
    setDepNote('');
    showToast(`تم إيداع مبلغ ${amt.toFixed(2)} ج.م في ${getMethodName(depMethod)} بنجاح`, 'success');
  };

  // Transfer Action
  const handleExecuteTransfer = () => {
    if (trFrom === trTo) {
      showToast('يرجى اختيار وسيلتين مختلفين للتحويل بينهما', 'warning');
      return;
    }

    const amt = Number(trAmount);
    if (!amt || amt <= 0) {
      showToast('يرجى إدخال مبلغ تحويل صحيح أكبر من صفر', 'warning');
      return;
    }

    const currentSourceBalance = cash[trFrom] || 0;
    if (currentSourceBalance < amt) {
      showToast(
        `تنبيه: الرصيد المتاح في ${getMethodName(trFrom)} هو ${currentSourceBalance.toFixed(
          2
        )} ج.م (أقل من المبلغ المراد تحويله)`,
        'warning'
      );
    }

    const newCashBox = {
      ...cash,
      [trFrom]: (cash[trFrom] || 0) - amt,
      [trTo]: (cash[trTo] || 0) + amt,
    };

    const txDate = trDate || new Date().toISOString().split('T')[0];
    const userNote = trNote.trim() ? ` (${trNote.trim()})` : '';

    const txWithdraw: CashTransaction = {
      id: appData.nextCashId,
      date: txDate,
      type: 'withdraw',
      method: trFrom,
      amount: amt,
      note: `تحويل إلى ${getMethodName(trTo)}${userNote}`,
    };

    const txDeposit: CashTransaction = {
      id: appData.nextCashId + 1,
      date: txDate,
      type: 'deposit',
      method: trTo,
      amount: amt,
      note: `تحويل من ${getMethodName(trFrom)}${userNote}`,
    };

    const updatedData: AppData = {
      ...appData,
      cashBox: newCashBox,
      cashTransactions: [...appData.cashTransactions, txWithdraw, txDeposit],
      nextCashId: appData.nextCashId + 2,
    };

    onUpdateData(updatedData);
    setIsTransferOpen(false);
    setTrAmount('');
    setTrNote('');
    showToast(
      `تم تحويل مبلغ ${amt.toFixed(2)} ج.م من ${getMethodName(trFrom)} إلى ${getMethodName(trTo)} بنجاح`,
      'success'
    );
  };

  // Withdraw Action
  const handleExecuteWithdraw = () => {
    const amt = Number(wthAmount);
    if (!amt || amt <= 0) {
      showToast('يرجى إدخال مبلغ سحب صحيح أكبر من صفر', 'warning');
      return;
    }

    const currentBal = cash[wthMethod] || 0;
    if (currentBal < amt) {
      showToast(
        `تنبيه: الرصيد المتاح في ${getMethodName(wthMethod)} هو ${currentBal.toFixed(2)} ج.م`,
        'warning'
      );
    }

    const newCashBox = {
      ...cash,
      [wthMethod]: (cash[wthMethod] || 0) - amt,
    };

    const newTx: CashTransaction = {
      id: appData.nextCashId,
      date: wthDate || new Date().toISOString().split('T')[0],
      type: 'withdraw',
      method: wthMethod,
      amount: amt,
      note: wthNote.trim() || `سحب/مصروفات من ${getMethodName(wthMethod)}`,
    };

    const updatedData: AppData = {
      ...appData,
      cashBox: newCashBox,
      cashTransactions: [...appData.cashTransactions, newTx],
      nextCashId: appData.nextCashId + 1,
    };

    onUpdateData(updatedData);
    setIsWithdrawOpen(false);
    setWthAmount('');
    setWthNote('');
    showToast(`تم سحب مبلغ ${amt.toFixed(2)} ج.م من ${getMethodName(wthMethod)} بنجاح`, 'success');
  };

  // Add Bank Account Action
  const handleAddBankAccount = () => {
    if (!bankName.trim() || !bankAccountNum.trim()) {
      showToast('يرجى إدخال اسم البنك ورقم الحساب', 'warning');
      return;
    }

    const initAmt = Number(bankInitial) || 0;
    const newBank = {
      id: 'b' + Date.now(),
      name: bankName.trim(),
      accountNumber: bankAccountNum.trim(),
      balance: initAmt,
    };

    const newCashBox = {
      ...cash,
      bank: (cash.bank || 0) + initAmt,
    };

    let newTransactions = appData.cashTransactions;
    let nextId = appData.nextCashId;

    if (initAmt > 0) {
      newTransactions = [
        ...newTransactions,
        {
          id: nextId,
          date: new Date().toISOString().split('T')[0],
          type: 'deposit',
          method: 'bank',
          amount: initAmt,
          note: `رصيد افتتاحي لحساب بنك ${bankName.trim()} (${bankAccountNum.trim()})`,
        },
      ];
      nextId++;
    }

    const updatedData: AppData = {
      ...appData,
      bankAccounts: [...(appData.bankAccounts || []), newBank],
      cashBox: newCashBox,
      cashTransactions: newTransactions,
      nextCashId: nextId,
    };

    onUpdateData(updatedData);
    setIsBankOpen(false);
    setBankName('');
    setBankAccountNum('');
    setBankInitial('');
    showToast('تم إضاقة الحساب البنكي الجديد بنجاح', 'success');
  };

  const handleDeleteBankAccount = (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الحساب البنكي؟')) return;
    const updatedData = { ...appData };
    updatedData.bankAccounts = (updatedData.bankAccounts || []).filter((b) => b.id !== id);
    onUpdateData(updatedData);
    showToast('تم حذف الحساب البنكي بنجاح', 'success');
  };

  const handleDeleteTransaction = (id: number) => {
    if (!confirm('هل أنت متأكد من حذف هذه الحركة النقدية؟')) return;
    const updatedData = { ...appData };
    const idx = updatedData.cashTransactions.findIndex((t) => t.id === id);
    if (idx !== -1) {
      const t = updatedData.cashTransactions[idx];
      if (t.type === 'receive' || t.type === 'deposit') {
        updatedData.cashBox[t.method] = Math.max(0, (updatedData.cashBox[t.method] || 0) - t.amount);
      } else {
        updatedData.cashBox[t.method] = (updatedData.cashBox[t.method] || 0) + t.amount;
      }
      updatedData.cashTransactions.splice(idx, 1);
      onUpdateData(updatedData);
      showToast('تم حذف الحركة النقدية وتعديل رصيد الخزينة بنجاح', 'success');
    }
  };

  // Filter Transactions
  const filteredTransactions = appData.cashTransactions.filter((t) => {
    // Method filter
    if (filterMethod !== 'all' && t.method !== filterMethod) return false;

    // Type filter
    if (filterType === 'deposit' && !(t.type === 'deposit' || t.type === 'receive')) return false;
    if (filterType === 'withdraw' && !(t.type === 'withdraw' || t.type === 'pay')) return false;

    // Date filters
    if (fromDate && t.date < fromDate) return false;
    if (toDate && t.date > toDate) return false;

    // Search filter
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matchNote = t.note?.toLowerCase().includes(q);
      const matchCust = t.customerName?.toLowerCase().includes(q);
      const matchSupp = t.supplierName?.toLowerCase().includes(q);
      const matchAmt = t.amount?.toString().includes(q);
      if (!matchNote && !matchCust && !matchSupp && !matchAmt) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Action Toolbar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-3 items-center justify-between">
        <div>
          <h3 className="font-bold text-[#1a237e] text-base">🏦 إدارة الخزينة والأرصدة النقدية</h3>
          <p className="text-gray-500 text-xs">إيداع، تحويل بين الوسائل والحسابات، سحب، ومتابعة حركة النقدية</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab(activeTab === 'balances_matrix' ? 'transactions' : 'balances_matrix')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-sm ${
              activeTab === 'balances_matrix'
                ? 'bg-[#f57f17] hover:bg-[#e65100] text-white'
                : 'bg-[#00695c] hover:bg-[#004d40] text-white'
            }`}
          >
            <span>{activeTab === 'balances_matrix' ? '📋' : '📊'}</span>
            {activeTab === 'balances_matrix' ? 'عرض دفتر الحركات اليومية' : 'مصفوفة الأرصدة ووسائل الدفع'}
          </button>
          <button
            onClick={() => printCashBalancesReportWindow(appData, showToast)}
            className="bg-[#00897b] hover:bg-[#00695c] text-white px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-sm"
            title="طباعة وعرض تقرير الأرصدة النقدية ووسائل الدفع الرسمية"
          >
            <span>🖨️</span> تقرير الأرصدة والوسائل
          </button>
          <button
            onClick={() => printDailyTransactionsReportWindow(appData, undefined, undefined, showToast)}
            className="bg-[#1a237e] hover:bg-[#0d1642] text-white px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-sm"
            title="طباعة تقرير حركة العمليات والمالية اليومية"
          >
            <span>📑</span> تقرير حركة العمليات
          </button>
          <button
            onClick={() => {
              exportToExcel({
                filename: `دفتر_حركات_الخزينة_${new Date().toISOString().split('T')[0]}`,
                sheetName: 'حركات الخزينة',
                data: filteredTransactions,
                columns: [
                  { header: 'كود الحركة', key: 'id', width: 12 },
                  { header: 'التاريخ', key: 'date', width: 14 },
                  {
                    header: 'نوع الحركة',
                    getValue: (item: any) => item.type === 'receive' ? 'قبض/تحصيل' : item.type === 'pay' ? 'صرف/سداد' : item.type === 'deposit' ? 'إيداع' : 'سحب',
                    width: 16,
                  },
                  {
                    header: 'وسيلة الدفع',
                    getValue: (item: any) => item.method === 'drawer' ? 'نقدي (الدرج)' : item.method === 'vodafone' ? 'فودافون كاش' : item.method === 'instapay' ? 'إنستاباي' : 'حساب بنكي',
                    width: 18,
                  },
                  {
                    header: 'المبلغ (ج.م)',
                    getValue: (item: any) => (item.amount || 0).toFixed(2),
                    width: 16,
                  },
                  {
                    header: 'الطرف المعني / الحساب',
                    getValue: (item: any) => item.customerName || item.supplierName || 'حساب عام',
                    width: 24,
                  },
                  { header: 'البيان والملاحظات', key: 'note', width: 30 },
                ],
                companyName: appData.settings?.companyName || 'المنظومة المحاسبية المعتمدة',
                reportTitle: 'دفتر حركات وسجلات الخزينة النقدية',
              });
              showToast('تم تصدير سجل حركات الخزينة إلى Excel بنجاح', 'success');
            }}
            className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-sm"
            title="تصدير حركات الخزينة إلى Excel"
          >
            <span>📊</span> تصدير Excel
          </button>
          <button
            onClick={() => setIsDepositOpen(true)}
            className="bg-[#2e7d32] hover:bg-[#1b5e20] text-white px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-sm"
          >
            <span>➕</span> إيداع في وسيلة
          </button>
          <button
            onClick={() => setIsTransferOpen(true)}
            className="bg-[#1a237e] hover:bg-[#0d47a1] text-white px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-sm"
          >
            <span>🔄</span> تحويل بين الوسائل
          </button>
          <button
            onClick={() => setIsWithdrawOpen(true)}
            className="bg-[#c62828] hover:bg-[#b71c1c] text-white px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-sm"
          >
            <span>➖</span> سحب / مصروفات
          </button>
          <button
            onClick={() => setIsBankOpen(true)}
            className="bg-[#0288d1] hover:bg-[#01579b] text-white px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-sm"
          >
            <span>🏦</span> إضافة حساب بنكي
          </button>
          <button
            onClick={() => {
              const todayStr = new Date().toISOString().split('T')[0];
              printCashClosingWindow(appData, todayStr, undefined, undefined, showToast);
            }}
            className="bg-[#311b92] hover:bg-[#1a237e] text-white px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-sm"
            title="طباعة تقفيل يومية الخزينة متعدد الوسائل"
          >
            <span>📑</span> تقفيل يومية الخزينة
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex bg-slate-200/80 p-1 rounded-xl w-fit text-xs font-bold gap-1">
        <button
          onClick={() => setActiveTab('transactions')}
          className={`px-4 py-2 rounded-lg transition cursor-pointer ${
            activeTab === 'transactions' ? 'bg-white text-[#1a237e] shadow-xs' : 'text-slate-600 hover:text-black'
          }`}
        >
          📋 دفتر ومعاملات النقدية
        </button>
        <button
          onClick={() => setActiveTab('balances_matrix')}
          className={`px-4 py-2 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'balances_matrix' ? 'bg-white text-[#1a237e] shadow-xs' : 'text-slate-600 hover:text-black'
          }`}
        >
          <span>📊</span> مصفوفة الأرصدة ووسائل الدفع التفاعلية
          <span className="bg-amber-400 text-slate-900 text-[10px] px-1.5 py-0.2 rounded font-black">تقرير رسمي</span>
        </button>
      </div>

      {activeTab === 'balances_matrix' ? (
        /* Interactive Balances & Payment Matrix View */
        <div className="space-y-4">
          <div className="report-container shadow-md rounded-2xl p-6 bg-white border-2 border-slate-900">
            {/* 1. Header */}
            <div className="header">
              <div className="header-right">
                <h2 className="text-xl font-bold text-[#1a237e]">{matrixData.company.companyName || 'RAKEEZA'}</h2>
                <p className="text-xs text-gray-600">{matrixData.company.address || 'الفرع الرئيسي - ش المعهد الديني، القاهرة'}</p>
              </div>
              <div className="header-left">
                <ul className="phones-list">
                  <li className="text-xs font-bold text-[#1a237e]">{matrixData.company.phone1 || '01029190615'}</li>
                </ul>
              </div>
            </div>

            {/* 2. Info Box */}
            <div className="info-box my-3 bg-slate-50 border border-slate-300 rounded-lg p-3">
              <div className="info-item text-right">
                <p className="text-xs"><strong>نوع التقرير:</strong> <span className="font-bold text-[#1a237e]">تقرير الأرصدة النقدية ووسائل الدفع</span></p>
                <p className="text-xs"><strong>نطاق التقرير:</strong> <span>جميع الخزائن والحسابات النشطة</span></p>
              </div>
              <div className="info-item text-center">
                <p className="text-xs"><strong>حتى تاريخ:</strong> <span>{matrixData.targetDate}</span></p>
                <p className="text-xs"><strong>مُستخرج التقرير:</strong> <span>{matrixData.issuerName}</span></p>
              </div>
              <div className="info-item text-left">
                <p className="text-xs"><strong>تاريخ الطباعة:</strong> <span>{new Date().toLocaleDateString('en-GB')}</span></p>
                <p className="text-xs"><strong>وقت الطباعة:</strong> <span>{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span></p>
              </div>
            </div>

            {/* 3. KPI Cards Grid */}
            <div className="kpi-grid my-3">
              {methods.map((m) => (
                <div key={m} className="kpi-card bg-slate-50 rounded-lg p-2.5 border border-slate-300">
                  <div className="kpi-title text-xs font-bold text-gray-700">{m}</div>
                  <div className="kpi-value text-base font-extrabold text-[#1a237e] mt-1">{formatEnNumber(methodTotals[m])} EGP</div>
                </div>
              ))}
              <div className="kpi-card bg-indigo-50 border-2 border-indigo-500 rounded-lg p-2.5 text-center">
                <div className="kpi-title text-xs font-bold text-indigo-900">إجمالي جميع الوسائل</div>
                <div className="kpi-value text-lg font-black text-indigo-700 mt-1">{formatEnNumber(grandTotal)} EGP</div>
              </div>
            </div>

            {/* 4. Cash Matrix: Mobile Cards (< md) */}
            <div className="block md:hidden print:hidden space-y-3 my-4">
              {matrixData.cashData.map((item, idx) => {
                let rowSum = 0;
                return (
                  <div key={idx} className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-xs space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 font-bold">
                      <span className="text-slate-900">{item.location}</span>
                      <span className="font-mono text-[#1a237e]">
                        {formatEnNumber(methods.reduce((acc, m) => acc + (item.amounts[m] || 0), 0))} EGP
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                      {methods.map((m) => {
                        const val = item.amounts[m] || 0;
                        if (val === 0) return null;
                        return (
                          <div key={m} className="bg-white p-1.5 rounded border border-slate-100 flex justify-between items-center">
                            <span className="text-slate-500">{m}:</span>
                            <span className="font-mono font-bold text-slate-800">{formatEnNumber(val)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-xl flex justify-between items-center font-bold text-xs">
                <span className="text-indigo-900">الإجمالي العام:</span>
                <span className="font-mono font-black text-indigo-700 text-sm">{formatEnNumber(grandTotal)} EGP</span>
              </div>
            </div>

            {/* 4. Desktop / Print Table (>= md or print) */}
            <div className="table-wrapper my-4 hidden md:block print:block overflow-x-auto">
              <table className="w-full text-center border-collapse">
                <thead>
                  <tr className="bg-slate-200 text-slate-900 text-xs font-bold">
                    <th className="p-2.5 border border-slate-400 text-right w-1/4">جهة الحساب / الخزينة</th>
                    {methods.map((m) => (
                      <th key={m} className="p-2.5 border border-slate-400">{m}</th>
                    ))}
                    <th className="p-2.5 border border-slate-400 bg-slate-300 font-bold">إجمالي الحساب</th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  {matrixData.cashData.map((item, idx) => {
                    let rowSum = 0;
                    return (
                      <tr key={idx} className="hover:bg-slate-50 transition border-b border-slate-200">
                        <td className="p-2.5 border border-slate-300 text-right font-bold text-slate-800">{item.location}</td>
                        {methods.map((m) => {
                          const val = item.amounts[m] || 0;
                          rowSum += val;
                          return (
                            <td key={m} className="p-2.5 border border-slate-300 font-mono text-center">
                              {val > 0 ? (
                                <span className="font-semibold text-slate-900">{formatEnNumber(val)}</span>
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="p-2.5 border border-slate-300 bg-slate-100 font-bold font-mono text-center text-[#1a237e]">
                          {formatEnNumber(rowSum)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-200 text-xs font-bold">
                    <td className="p-3 border border-slate-400 text-right font-black text-slate-900">الإجمالـــي العــام</td>
                    {methods.map((m) => (
                      <td key={m} className="p-3 border border-slate-400 font-mono font-black text-slate-900 text-center">
                        {formatEnNumber(methodTotals[m])}
                      </td>
                    ))}
                    <td className="p-3 border border-slate-400 bg-indigo-100 text-indigo-900 font-black font-mono text-sm text-center">
                      {formatEnNumber(grandTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* 5. Signatures */}
            <div className="bottom-section flex justify-between items-center text-xs font-bold pt-6 border-t border-slate-300 mt-6 text-slate-700">
              <div>أمين الخزينة: ....................</div>
              <div>المراجع المحاسبي: ....................</div>
              <div>يعتمد / المدير المالي: ....................</div>
            </div>

            {/* Footer Note */}
            <div className="report-footer-note mt-6 pt-2 border-t border-slate-200 flex justify-between text-[11px] text-gray-500">
              <div>* أرقام المبالغ معروضة بالصيغة الإنجليزية مع التنسيق الآلي المعتمد</div>
              <div>صفحة رقم: 1/1</div>
            </div>
          </div>

          <div className="copyright-outside text-center text-xs font-bold text-gray-500">
            حقوق الملكية محفوظة Mohamed Nazih 01029190615
          </div>
        </div>
      ) : (
        /* Standard Transactions View */
        <>
      {/* Treasury Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm text-center border border-gray-100">
          <div className="text-3xl mb-1">💰</div>
          <div className="text-gray-500 text-xs mb-1">نقدي (الدرج)</div>
          <div className="text-[#1a237e] text-xl font-bold">{cash.drawer.toFixed(2)} ج.م</div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm text-center border border-gray-100">
          <div className="text-3xl mb-1">📱</div>
          <div className="text-gray-500 text-xs mb-1">فودافون كاش</div>
          <div className="text-[#1a237e] text-xl font-bold">{cash.vodafone.toFixed(2)} ج.م</div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm text-center border border-gray-100">
          <div className="text-3xl mb-1">🏦</div>
          <div className="text-gray-500 text-xs mb-1">إنستاباي</div>
          <div className="text-[#1a237e] text-xl font-bold">{cash.instapay.toFixed(2)} ج.م</div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm text-center border border-gray-100">
          <div className="text-3xl mb-1">💳</div>
          <div className="text-gray-500 text-xs mb-1">حساب بنكي</div>
          <div className="text-[#1a237e] text-xl font-bold">{cash.bank.toFixed(2)} ج.م</div>
        </div>

        <div className="bg-gradient-to-br from-[#1a237e] to-[#0d47a1] text-white p-5 rounded-2xl shadow-md text-center">
          <div className="text-3xl mb-1">💵</div>
          <div className="text-slate-200 text-xs mb-1">الإجمالي الكلي للنقدية</div>
          <div className="text-2xl font-extrabold text-[#ffd54f]">{totalCash.toFixed(2)} ج.م</div>
        </div>
      </div>

      {/* Bank Accounts Overview */}
      {(appData.bankAccounts?.length || 0) > 0 && (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-3">
          <h4 className="text-[#1a237e] font-bold text-sm flex items-center gap-1">
            <span>🏦</span> الحسابات البنكية المسجلة ({appData.bankAccounts.length})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {appData.bankAccounts.map((b) => (
              <div key={b.id} className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                <div>
                  <div className="font-bold text-[#1a237e] text-sm">{b.name}</div>
                  <div className="text-gray-500">رقم الحساب: {b.accountNumber}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-left font-bold text-[#2e7d32] text-sm">
                    {b.balance.toFixed(2)} ج.م
                  </div>
                  <button
                    onClick={() => handleDeleteBankAccount(b.id)}
                    className="bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-lg text-xs cursor-pointer transition"
                    title="حذف الحساب البنكي"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filterable Cash Transactions Table */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <div className="flex flex-wrap gap-3 items-center justify-between border-b border-gray-100 pb-3">
          <h4 className="text-[#1a237e] font-bold text-base flex items-center gap-1">
            <span>📊</span> سجل حركات ومعاملات النقدية ({filteredTransactions.length})
          </h4>

          <div className="flex flex-wrap gap-2 text-xs">
            <input
              type="text"
              placeholder="🔍 بحث بالبيان أو المبلغ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="p-1.5 border-2 border-gray-200 rounded-lg text-xs w-44 focus:border-[#1a237e] focus:outline-none"
            />

            <select
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value)}
              className="p-1.5 border-2 border-gray-200 rounded-lg text-xs focus:border-[#1a237e] focus:outline-none"
            >
              <option value="all">جميع الوسائل</option>
              <option value="drawer">نقدي (الدرج)</option>
              <option value="vodafone">فودافون كاش</option>
              <option value="instapay">إنستاباي</option>
              <option value="bank">حساب بنكي</option>
            </select>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="p-1.5 border-2 border-gray-200 rounded-lg text-xs focus:border-[#1a237e] focus:outline-none"
            >
              <option value="all">جميع الحركات</option>
              <option value="deposit">إيداع / تحصيل / ورود</option>
              <option value="withdraw">سحب / تحويل / صرف</option>
            </select>

            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="p-1.5 border-2 border-gray-200 rounded-lg text-xs"
            />
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="p-1.5 border-2 border-gray-200 rounded-lg text-xs"
            />
          </div>
        </div>

        {/* Mobile Responsive Cards (< md) */}
        <div className="block md:hidden space-y-3">
          {filteredTransactions.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center text-gray-400 border border-slate-200">
              <span className="text-3xl block mb-2">💸</span>
              <p className="font-bold text-sm text-slate-700">لا توجد حركات نقدية مطابقة لفلاتر البحث</p>
            </div>
          ) : (
            filteredTransactions
              .slice()
              .reverse()
              .map((t) => {
                const isIn = t.type === 'receive' || t.type === 'deposit';
                return (
                  <div
                    key={t.id}
                    className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3 w-full max-w-full box-border"
                  >
                    {/* Header: ID, Date, Method */}
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-400">#{t.id}</span>
                        <span className="text-xs font-mono text-slate-500">{t.date}</span>
                      </div>
                      <span className="bg-slate-100 text-slate-800 px-2.5 py-0.5 rounded-lg text-xs font-bold">
                        {getMethodName(t.method)}
                      </span>
                    </div>

                    {/* Type and Amount */}
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        {isIn ? (
                          <span className="inline-flex items-center gap-1 text-[#2e7d32] bg-green-50 px-2.5 py-1 rounded-lg text-xs font-bold border border-green-200">
                            🟢 إيداع / تحصيل
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[#c62828] bg-red-50 px-2.5 py-1 rounded-lg text-xs font-bold border border-red-200">
                            🔴 سحب / صرف
                          </span>
                        )}
                      </div>
                      <div className={`font-mono font-black text-lg ${isIn ? 'text-[#2e7d32]' : 'text-[#c62828]'}`}>
                        {isIn ? '+' : '-'}{t.amount.toFixed(2)} ج.م
                      </div>
                    </div>

                    {/* Note & Delete */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center justify-between gap-2 text-xs">
                      <div className="text-slate-700 break-words flex-1 font-medium">
                        {t.note ? `📝 ${t.note}` : 'بدون بيان'}
                      </div>
                      <button
                        onClick={() => handleDeleteTransaction(t.id)}
                        className="min-h-[40px] px-3 bg-red-50 hover:bg-red-100 active:bg-red-200 text-red-600 rounded-xl text-xs font-bold cursor-pointer transition shrink-0 flex items-center gap-1"
                        title="حذف الحركة النقدية"
                      >
                        <span>🗑️</span>
                        <span>حذف</span>
                      </button>
                    </div>
                  </div>
                );
              })
          )}
        </div>

        {/* Desktop Transactions Table (>= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-right text-xs md:text-sm">
            <thead>
              <tr className="bg-[#1a237e] text-white">
                <th className="p-3 rounded-r-lg">#</th>
                <th className="p-3">التاريخ</th>
                <th className="p-3">الوسيلة</th>
                <th className="p-3">نوع الحركة</th>
                <th className="p-3">المبلغ (ج.م)</th>
                <th className="p-3">البيان / السبب</th>
                <th className="p-3 rounded-l-lg">حذف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center p-8 text-gray-400">
                    لا توجد حركات نقدية مطابقة لفلاتر البحث
                  </td>
                </tr>
              ) : (
                filteredTransactions
                  .slice()
                  .reverse()
                  .map((t) => {
                    const isIn = t.type === 'receive' || t.type === 'deposit';
                    return (
                      <tr key={t.id} className="hover:bg-slate-50 transition">
                        <td className="p-3 font-mono text-gray-400">#{t.id}</td>
                        <td className="p-3 text-gray-600 font-medium">{t.date}</td>
                        <td className="p-3">
                          <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-xs font-semibold">
                            {getMethodName(t.method)}
                          </span>
                        </td>
                        <td className="p-3 font-semibold">
                          {isIn ? (
                            <span className="text-[#2e7d32] bg-green-50 px-2 py-0.5 rounded border border-green-200">
                              🟢 إيداع / تحصيل
                            </span>
                          ) : (
                            <span className="text-[#c62828] bg-red-50 px-2 py-0.5 rounded border border-red-200">
                              🔴 سحب / تحويل / صرف
                            </span>
                          )}
                        </td>
                        <td className={`p-3 font-bold text-base ${isIn ? 'text-[#2e7d32]' : 'text-[#c62828]'}`}>
                          {isIn ? '+' : '-'}{t.amount.toFixed(2)}
                        </td>
                        <td className="p-3 text-gray-700">{t.note || '-'}</td>
                        <td className="p-3">
                          <button
                            onClick={() => handleDeleteTransaction(t.id)}
                            className="bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-lg text-xs cursor-pointer transition shadow-xs"
                            title="حذف الحركة النقدية"
                          >
                            🗑️
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
      </>
      )}

      {/* Modal 1: Deposit */}
      <Modal isOpen={isDepositOpen} title="➕ إيداع رصيد / نقدية في وسيلة" onClose={() => setIsDepositOpen(false)}>
        <div className="space-y-4 text-xs md:text-sm">
          <div>
            <label className="block font-bold mb-1">اختر وسيلة الإيداع</label>
            <select
              value={depMethod}
              onChange={(e) => setDepMethod(e.target.value as any)}
              className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none"
            >
              <option value="drawer">💰 نقدي (الدرج)</option>
              <option value="vodafone">📱 فودافون كاش</option>
              <option value="instapay">🏦 إنستاباي</option>
              <option value="bank">💳 حساب بنكي</option>
            </select>
          </div>

          {depMethod === 'bank' && (appData.bankAccounts?.length || 0) > 0 && (
            <div>
              <label className="block font-bold mb-1">حدد الحساب البنكي (اختياري)</label>
              <select
                value={depBankId}
                onChange={(e) => setDepBankId(e.target.value)}
                className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none"
              >
                <option value="">جميع الحسابات / إيداع عام بالبنك</option>
                {appData.bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.accountNumber}) - رصيده الحالي: {b.balance.toFixed(2)} ج.م
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block font-bold mb-1">المبلغ المُراد إيداعه (ج.م)</label>
            <input
              type="number"
              min="1"
              placeholder="0.00"
              value={depAmount}
              onChange={(e) => setDepAmount(e.target.value ? Number(e.target.value) : '')}
              className="w-full p-2.5 border-2 border-gray-200 rounded-xl text-base font-bold text-[#2e7d32] focus:border-[#2e7d32] focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold mb-1">السبب / البيان</label>
            <input
              type="text"
              placeholder="مثال: إيداع رأس مال رأس سنة / تحصيل نقدي خارجي..."
              value={depNote}
              onChange={(e) => setDepNote(e.target.value)}
              className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold mb-1">التاريخ</label>
            <input
              type="date"
              value={depDate}
              onChange={(e) => setDepDate(e.target.value)}
              className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleExecuteDeposit}
              className="bg-[#2e7d32] hover:bg-[#1b5e20] text-white px-6 py-2.5 rounded-xl font-bold transition cursor-pointer"
            >
              ✅ إتمام الإيداع
            </button>
            <button
              onClick={() => setIsDepositOpen(false)}
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-2.5 rounded-xl font-bold cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal 2: Transfer */}
      <Modal isOpen={isTransferOpen} title="🔄 تحويل بين الوسائل والحسابات النقدية" onClose={() => setIsTransferOpen(false)}>
        <div className="space-y-4 text-xs md:text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold mb-1">تحويل من (المصدر)</label>
              <select
                value={trFrom}
                onChange={(e) => setTrFrom(e.target.value as any)}
                className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none"
              >
                <option value="drawer">💰 نقدي (الدرج) - المتاح: {cash.drawer.toFixed(2)} ج.م</option>
                <option value="vodafone">📱 فودافون كاش - المتاح: {cash.vodafone.toFixed(2)} ج.م</option>
                <option value="instapay">🏦 إنستاباي - المتاح: {cash.instapay.toFixed(2)} ج.m</option>
                <option value="bank">💳 حساب بنكي - المتاح: {cash.bank.toFixed(2)} ج.م</option>
              </select>
            </div>

            <div>
              <label className="block font-bold mb-1">تحويل إلى (الوجهة)</label>
              <select
                value={trTo}
                onChange={(e) => setTrTo(e.target.value as any)}
                className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none"
              >
                <option value="drawer">💰 نقدي (الدرج)</option>
                <option value="vodafone">📱 فودافون كاش</option>
                <option value="instapay">🏦 إنستاباي</option>
                <option value="bank">💳 حساب بنكي</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold mb-1">المبلغ المُراد تحويله (ج.م)</label>
            <input
              type="number"
              min="1"
              placeholder="0.00"
              value={trAmount}
              onChange={(e) => setTrAmount(e.target.value ? Number(e.target.value) : '')}
              className="w-full p-2.5 border-2 border-gray-200 rounded-xl text-base font-bold text-[#1a237e] focus:border-[#1a237e] focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold mb-1">ملاحظات / سبب التحويل</label>
            <input
              type="text"
              placeholder="مثال: تغذية حساب فودافون كاش من نقدية الدرج..."
              value={trNote}
              onChange={(e) => setTrNote(e.target.value)}
              className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold mb-1">التاريخ</label>
            <input
              type="date"
              value={trDate}
              onChange={(e) => setTrDate(e.target.value)}
              className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleExecuteTransfer}
              className="bg-[#1a237e] hover:bg-[#0d47a1] text-white px-6 py-2.5 rounded-xl font-bold transition cursor-pointer"
            >
              🔄 تنفيذ التحويل
            </button>
            <button
              onClick={() => setIsTransferOpen(false)}
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-2.5 rounded-xl font-bold cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal 3: Withdraw */}
      <Modal isOpen={isWithdrawOpen} title="➖ سحب نقدية / مصروفات من وسيلة" onClose={() => setIsWithdrawOpen(false)}>
        <div className="space-y-4 text-xs md:text-sm">
          <div>
            <label className="block font-bold mb-1">اختر الوسيلة المُراد السحب منها</label>
            <select
              value={wthMethod}
              onChange={(e) => setWthMethod(e.target.value as any)}
              className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none"
            >
              <option value="drawer">💰 نقدي (الدرج) - المتاح: {cash.drawer.toFixed(2)} ج.م</option>
              <option value="vodafone">📱 فودافون كاش - المتاح: {cash.vodafone.toFixed(2)} ج.م</option>
              <option value="instapay">🏦 إنستاباي - المتاح: {cash.instapay.toFixed(2)} ج.م</option>
              <option value="bank">💳 حساب بنكي - المتاح: {cash.bank.toFixed(2)} ج.م</option>
            </select>
          </div>

          <div>
            <label className="block font-bold mb-1">المبلغ المُراد سحبه (ج.م)</label>
            <input
              type="number"
              min="1"
              placeholder="0.00"
              value={wthAmount}
              onChange={(e) => setWthAmount(e.target.value ? Number(e.target.value) : '')}
              className="w-full p-2.5 border-2 border-gray-200 rounded-xl text-base font-bold text-[#c62828] focus:border-[#c62828] focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold mb-1">السبب / نوع المصروف</label>
            <input
              type="text"
              placeholder="مثال: مصروفات كهرباء / صيانة / سحب شخصي..."
              value={wthNote}
              onChange={(e) => setWthNote(e.target.value)}
              className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold mb-1">التاريخ</label>
            <input
              type="date"
              value={wthDate}
              onChange={(e) => setWthDate(e.target.value)}
              className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleExecuteWithdraw}
              className="bg-[#c62828] hover:bg-[#b71c1c] text-white px-6 py-2.5 rounded-xl font-bold transition cursor-pointer"
            >
              ➖ إتمام السحب
            </button>
            <button
              onClick={() => setIsWithdrawOpen(false)}
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-2.5 rounded-xl font-bold cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal 4: Bank Account */}
      <Modal isOpen={isBankOpen} title="🏦 إضافة حساب بنكي جديد" onClose={() => setIsBankOpen(false)}>
        <div className="space-y-4 text-xs md:text-sm">
          <div>
            <label className="block font-bold mb-1">اسم البنك / الفرع</label>
            <input
              type="text"
              placeholder="مثال: البنك الأهلي المصري - فرع التجمع"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold mb-1">رقم الحساب / IBAN</label>
            <input
              type="text"
              placeholder="EG0000000000000000"
              value={bankAccountNum}
              onChange={(e) => setBankAccountNum(e.target.value)}
              className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold mb-1">الرصيد الافتتاحي (ج.م)</label>
            <input
              type="number"
              min="0"
              placeholder="0.00"
              value={bankInitial}
              onChange={(e) => setBankInitial(e.target.value ? Number(e.target.value) : '')}
              className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleAddBankAccount}
              className="bg-[#0288d1] hover:bg-[#01579b] text-white px-6 py-2.5 rounded-xl font-bold transition cursor-pointer"
            >
              💾 حفظ الحساب البنكي
            </button>
            <button
              onClick={() => setIsBankOpen(false)}
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-2.5 rounded-xl font-bold cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
