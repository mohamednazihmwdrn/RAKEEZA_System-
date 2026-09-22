import React, { useState } from 'react';
import { AppData, BankStatementItem, ApprovalRequest, JournalEntry } from '../types';
import { addAuditLog } from '../utils/storage';
import { openUnifiedPrintWindow } from '../utils/printUnified';
import { printBankReconciliationReportWindow } from '../utils/printBankReconciliationReport';
import { exportToExcel } from '../utils/excelExport';
import { TableActionButtons } from './TableActionButtons';

interface BankReconciliationViewProps {
  appData: AppData;
  onUpdateData: (newData: AppData) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onInspectItem?: (type: any, data: any) => void;
}

export const BankReconciliationView: React.FC<BankReconciliationViewProps> = ({
  appData,
  onUpdateData,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<'reconciliation' | 'approvals'>('reconciliation');
  const [selectedBankId, setSelectedBankId] = useState(appData.bankAccounts[0]?.id || 'b1');

  // Bank Statement item form
  const [stmtDesc, setStmtDesc] = useState('');
  const [stmtRef, setStmtRef] = useState('');
  const [stmtAmount, setStmtAmount] = useState<number>(500);
  const [stmtType, setStmtType] = useState<'credit' | 'debit'>('credit'); // credit=deposit, debit=withdrawal/fee
  const [stmtDate, setStmtDate] = useState(new Date().toISOString().substring(0, 10));

  // Approval filter
  const [approvalStatus, setApprovalStatus] = useState<string>('all');

  const currency = appData.settings?.currencySymbol || 'ج.م';
  const bankAccounts = appData.bankAccounts || [];
  const selectedBank = bankAccounts.find((b) => b.id === selectedBankId) || bankAccounts[0];
  const statementItems = (appData.bankStatements || []).filter((s) => s.bankAccountId === selectedBankId);
  const approvals = appData.approvalRequests || [];

  // Reconciled math
  const bookBalance = selectedBank ? selectedBank.balance : 0;
  const totalBankCredits = statementItems.reduce((a, b) => a + (b.credit || 0), 0);
  const totalBankDebits = statementItems.reduce((a, b) => a + (b.debit || 0), 0);
  const calculatedStatementBalance = totalBankCredits - totalBankDebits;
  const difference = bookBalance - calculatedStatementBalance;

  // Add Bank Statement Line
  const handleAddStatementItem = () => {
    if (!stmtDesc.trim() || stmtAmount <= 0) {
      showToast('يرجى كتابة بيان الحركة والمبلغ', 'warning');
      return;
    }

    const newItem: BankStatementItem = {
      id: `stmt-${Date.now()}`,
      bankAccountId: selectedBankId,
      date: stmtDate,
      reference: stmtRef.trim() || `BNK-${Date.now().toString().slice(-4)}`,
      description: stmtDesc,
      debit: stmtType === 'debit' ? Number(stmtAmount) : 0,
      credit: stmtType === 'credit' ? Number(stmtAmount) : 0,
      isReconciled: false,
    };

    let updated = {
      ...appData,
      bankStatements: [newItem, ...(appData.bankStatements || [])],
    };
    updated = addAuditLog(updated, 'create', 'المطابقة البنكية', `تم إدراج سطر بكشف حساب البنك (${selectedBank?.name}): ${stmtDesc} بقيمة ${stmtAmount} ${currency}.`);
    onUpdateData(updated);
    showToast('تمت إضافة حركة كشف الحساب بنجاح', 'success');
    setStmtDesc('');
    setStmtRef('');
    setStmtAmount(500);
  };

  // Toggle Item Reconciliation
  const handleToggleReconciled = (itemId: string) => {
    let updated = {
      ...appData,
      bankStatements: (appData.bankStatements || []).map((s) =>
        s.id === itemId ? { ...s, isReconciled: !s.isReconciled } : s
      ),
    };
    onUpdateData(updated);
  };

  // 1-Click Post Bank Fees / Adjustment into Journal
  const handlePostBankFee = () => {
    if (difference === 0) {
      showToast('الحسابات متطابقة تماماً ولا توجد فروقات للتسوية', 'info');
      return;
    }

    const nextJournalId = appData.nextJournalId || 1;
    const diffAbs = Math.abs(difference);

    // Create journal entry for difference (bank charges/interest)
    const jv: JournalEntry = {
      id: nextJournalId,
      entryNumber: `BNK-REC-${String(nextJournalId).padStart(4, '0')}`,
      date: new Date().toISOString().substring(0, 10),
      description: `تسوية وإثبات مصاريف وفروقات بنكية لحساب (${selectedBank?.name})`,
      source: 'manual',
      createdBy: appData.users.find((u) => u.id === appData.currentUser)?.name || 'المدير',
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      isApproved: true,
      lines: [
        {
          accountCode: '5205',
          accountName: 'عمولات ومصاريف بنكية',
          debit: diffAbs,
          credit: 0,
          note: `تسوية كشف حساب ${selectedBank?.name}`,
        },
        {
          accountCode: '1104',
          accountName: `الحسابات البنكية (${selectedBank?.name})`,
          debit: 0,
          credit: diffAbs,
          note: `مطابقة الرصيد الدفتري مع البنكي`,
        },
      ],
    };

    let updated: AppData = {
      ...appData,
      bankAccounts: appData.bankAccounts.map((b) =>
        b.id === selectedBankId ? { ...b, balance: b.balance - diffAbs } : b
      ),
      journalEntries: [jv, ...appData.journalEntries],
      nextJournalId: nextJournalId + 1,
    };

    updated = addAuditLog(updated, 'approval', 'التسوية البنكية', `تم إثبات قيد التسوية البنكية #${jv.entryNumber} بمبلغ ${diffAbs} ${currency}.`);
    onUpdateData(updated);
    showToast(`تم إثبات قيود التسوية البنكية بنجاح وتطابق الرصيد الدفتري`, 'success');
  };

  // Action on Approval Request
  const handleApprovalAction = (req: ApprovalRequest, status: 'approved' | 'rejected') => {
    let updated = {
      ...appData,
      approvalRequests: (appData.approvalRequests || []).map((a) =>
        a.id === req.id
          ? {
              ...a,
              status,
              approvedBy: appData.users.find((u) => u.id === appData.currentUser)?.name || 'المدير العام',
              approvedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
            }
          : a
      ),
    };

    updated = addAuditLog(
      updated,
      'approval',
      'دورة الاعتمادات',
      `تم ${status === 'approved' ? 'اعتماد وموافقة' : 'رفض'} طلب الاعتماد #${req.transactionNumber} (${req.notes || ''}).`
    );

    onUpdateData(updated);
    showToast(`تم ${status === 'approved' ? 'الموافقة على' : 'رفض'} طلب الاعتماد بنجاح`, 'success');
  };

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap justify-between items-center gap-4">
        <div>
          <h3 className="text-lg font-black text-[#1a237e] flex items-center gap-2">
            <span>🏦 التسوية والمطابقة البنكية ودورة الاعتمادات والموافقات</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            مطابقة كشوف الحسابات البنكية مع الدفاتر، تسوية العمولات البنكية، وإدارة صلاحيات الاعتماد المالي.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <TableActionButtons
            onPrint={() => {
              printBankReconciliationReportWindow(appData, selectedBankId, undefined, showToast);
            }}
            onExportExcel={() => {
              exportToExcel({
                filename: `كشف_حركات_الحساب_البنكي_${selectedBank?.bankName || 'البنك'}_${new Date().toISOString().split('T')[0]}`,
                sheetName: 'حركات كشف الحساب',
                data: statementItems,
                columns: [
                  { header: 'كود الحركة', key: 'id', width: 12 },
                  { header: 'تاريخ الحركة البنكية', key: 'date', width: 16 },
                  { header: 'البيان وتفاصيل العملية', key: 'description', width: 30 },
                  { header: 'المرجع البنكي / الشيك', key: 'referenceNumber', width: 20 },
                  { header: 'إيداع / دائن (ج.م)', getValue: (item: BankStatementItem) => (item.credit || 0).toFixed(2), width: 18 },
                  { header: 'سحب / مدين (ج.م)', getValue: (item: BankStatementItem) => (item.debit || 0).toFixed(2), width: 18 },
                  {
                    header: 'حالة المطابقة',
                    getValue: (item: BankStatementItem) => item.isReconciled ? 'تمت المطابقة' : 'غير مطابق / معلق',
                    width: 18,
                  },
                ],
                companyName: appData.settings?.companyName || 'المنظومة المحاسبية المعتمدة',
                reportTitle: `كشف حركات الحساب البنكي - ${selectedBank?.bankName || ''} (${selectedBank?.accountNumber || ''})`,
              });
              showToast('تم تصدير كشف الحساب البنكي إلى Excel بنجاح', 'success');
            }}
            printTitle="طباعة مذكرة التسوية والاعتماد البنكية"
            exportTitle="تصدير كشف الحساب البنكي إلى Excel"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-4 text-xs font-bold">
        <button
          onClick={() => setActiveTab('reconciliation')}
          className={`pb-2.5 px-2 border-b-2 transition cursor-pointer ${
            activeTab === 'reconciliation' ? 'border-[#1a237e] text-[#1a237e]' : 'border-transparent text-slate-500'
          }`}
        >
          🏦 مذكرة المطابقة البنكية
        </button>
        <button
          onClick={() => setActiveTab('approvals')}
          className={`pb-2.5 px-2 border-b-2 transition cursor-pointer ${
            activeTab === 'approvals' ? 'border-[#1a237e] text-[#1a237e]' : 'border-transparent text-slate-500'
          }`}
        >
          🛡️ دورة الموافقات والاعتمادات ({approvals.filter((a) => a.status === 'pending').length} معلق)
        </button>
      </div>

      {/* TAB 1: BANK RECONCILIATION */}
      {activeTab === 'reconciliation' && (
        <div className="space-y-4">
          {/* Bank Selector & Status Cards */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-bold">
              <span>اختر الحساب البنكي:</span>
              <select
                value={selectedBankId}
                onChange={(e) => setSelectedBankId(e.target.value)}
                className="p-2 border border-slate-300 rounded-xl bg-slate-50 font-bold"
              >
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.accountNumber})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              {difference !== 0 && (
                <button
                  onClick={handlePostBankFee}
                  className="bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
                >
                  ⚡ تسوية الفروقات والمصاريف البنكية آلياً
                </button>
              )}
            </div>
          </div>

          {/* KPI Balance Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-bold block">الرصيد الدفتري بالنظام (Book Balance)</span>
                <strong className="text-xl font-black text-blue-900">{bookBalance.toLocaleString()} {currency}</strong>
              </div>
              <span className="p-3 bg-blue-50 text-blue-800 rounded-xl text-xl">📘</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-bold block">رصيد كشف الحساب البنكي الفعلي</span>
                <strong className="text-xl font-black text-emerald-800">{calculatedStatementBalance.toLocaleString()} {currency}</strong>
              </div>
              <span className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xl">🏛️</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-bold block">فرق التسوية (Variance)</span>
                <strong className={`text-xl font-black ${difference === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {difference.toLocaleString()} {currency}
                </strong>
              </div>
              <span className={`p-3 rounded-xl text-xl ${difference === 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
                {difference === 0 ? '✅' : '⚖️'}
              </span>
            </div>
          </div>

          {/* Add Statement Line Box */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <span className="text-xs font-bold text-slate-700 block">إدخال حركات كشف حساب البنك للمطابقة:</span>
            <div className="grid grid-cols-1 sm:grid-cols-6 gap-2 text-xs">
              <input
                type="date"
                value={stmtDate}
                onChange={(e) => setStmtDate(e.target.value)}
                className="p-2 border rounded-xl bg-white"
              />
              <input
                type="text"
                value={stmtRef}
                onChange={(e) => setStmtRef(e.target.value)}
                className="p-2 border rounded-xl bg-white"
                placeholder="المرجع / الشيك"
              />
              <input
                type="text"
                value={stmtDesc}
                onChange={(e) => setStmtDesc(e.target.value)}
                className="p-2 border rounded-xl bg-white sm:col-span-2"
                placeholder="بيان الحركة (مثال: عمولة مصرفية، إيداع عميل...)"
              />
              <select
                value={stmtType}
                onChange={(e) => setStmtType(e.target.value as any)}
                className="p-2 border rounded-xl bg-white"
              >
                <option value="credit">📥 إيداع (Credit +)</option>
                <option value="debit">📤 سحب / مصروف (Debit -)</option>
              </select>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={stmtAmount}
                  onChange={(e) => setStmtAmount(Number(e.target.value))}
                  className="w-full p-2 border rounded-xl bg-white font-bold"
                  placeholder="المبلغ"
                />
                <button
                  onClick={handleAddStatementItem}
                  className="bg-[#1a237e] hover:bg-[#0d47a1] text-white px-3 rounded-xl font-bold whitespace-nowrap cursor-pointer"
                >
                  ➕ إضافة
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Statement Items Cards (< md) */}
          <div className="block md:hidden space-y-3">
            {statementItems.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-slate-400">
                لا توجد بنود كشف حساب مدخلة لهذا الحساب البنكي
              </div>
            ) : (
              statementItems.map((item) => {
                const isCredit = (item.credit || 0) > 0;
                const amount = isCredit ? item.credit : item.debit;
                return (
                  <div
                    key={item.id}
                    className={`bg-white rounded-2xl p-4 border transition space-y-2.5 ${
                      item.isReconciled ? 'border-emerald-200 bg-emerald-50/20' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={item.isReconciled}
                          onChange={() => handleToggleReconciled(item.id)}
                          className="w-5 h-5 rounded text-blue-600 cursor-pointer"
                        />
                        <span className="text-xs font-bold text-slate-700">مطابقة</span>
                      </label>

                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-500">{item.date}</span>
                        {item.reference && (
                          <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                            {item.reference}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="font-bold text-slate-900 text-xs break-words">
                      {item.description}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          isCredit ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {isCredit ? 'إيداع وارد' : 'سحب / عمولة'}
                      </span>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.isReconciled ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {item.isReconciled ? 'مطابق ✅' : 'معلق'}
                        </span>
                        <span className="font-black text-sm text-slate-900 font-mono">
                          {isCredit ? '+' : '-'}{amount.toLocaleString()} {currency}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table of Statement Items (>= md) */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3 text-center" style={{ width: '40px' }}>مطابقة</th>
                  <th className="p-3">تاريخ الحركة</th>
                  <th className="p-3">المرجع</th>
                  <th className="p-3">البيان بكشف الحساب</th>
                  <th className="p-3">نوع الحركة</th>
                  <th className="p-3 text-left">المبلغ</th>
                  <th className="p-3 text-center">حالة المطابقة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {statementItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center p-8 text-slate-400">
                      لا توجد بنود كشف حساب مدخلة لهذا الحساب البنكي
                    </td>
                  </tr>
                ) : (
                  statementItems.map((item) => {
                    const isCredit = (item.credit || 0) > 0;
                    const amount = isCredit ? item.credit : item.debit;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={item.isReconciled}
                            onChange={() => handleToggleReconciled(item.id)}
                            className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                          />
                        </td>
                        <td className="p-3 font-mono text-slate-500">{item.date}</td>
                        <td className="p-3 font-mono text-slate-600">{item.reference || '-'}</td>
                        <td className="p-3 font-bold text-slate-800">{item.description}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10.5px] font-bold ${
                              isCredit ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {isCredit ? 'إيداع وارد' : 'سحب / عمولة'}
                          </span>
                        </td>
                        <td className="p-3 text-left font-black text-slate-900">
                          {isCredit ? '+' : '-'}{amount.toLocaleString()} {currency}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.isReconciled ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {item.isReconciled ? 'تمت المطابقة' : 'معلق للمراجعة'}
                          </span>
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

      {/* TAB 2: APPROVAL WORKFLOWS */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center text-xs font-bold">
            <span>تصفية طلبات الاعتماد:</span>
            <select
              value={approvalStatus}
              onChange={(e) => setApprovalStatus(e.target.value)}
              className="p-2 border border-slate-300 rounded-xl bg-slate-50"
            >
              <option value="all">جميع الطلبات</option>
              <option value="pending">⏳ طلبات معلقة بانتظار الاعتماد</option>
              <option value="approved">✅ طلبات معتمدة</option>
              <option value="rejected">❌ طلبات مرفوضة</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {approvals
              .filter((a) => (approvalStatus === 'all' ? true : a.status === approvalStatus))
              .map((req) => (
                <div
                  key={req.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[11px] bg-blue-50 text-blue-900 px-2 py-0.5 rounded-md font-bold">
                        {req.module === 'purchase'
                          ? 'اعتماد فاتورة مشتريات'
                          : req.module === 'sale'
                          ? 'اعتماد خصم / سقف بيع'
                          : req.module === 'payroll'
                          ? 'اعتماد مسير رواتب'
                          : req.module === 'production'
                          ? 'اعتماد أمر إنتاج'
                          : 'اعتماد مالي'}
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm mt-1.5">{req.notes || `طلب اعتماد #${req.transactionNumber}`}</h4>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        req.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-800'
                          : req.status === 'rejected'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800 animate-pulse'
                      }`}
                    >
                      {req.status === 'approved' ? 'معتمد' : req.status === 'rejected' ? 'مرفوض' : 'بانتظار الموافقة'}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">رقم الحركة المرجعية:</span>
                      <strong className="text-slate-800 font-mono">{req.transactionNumber}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">مقدم الطلب:</span>
                      <strong className="text-slate-800">{req.requestedBy}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">القيمة المالية:</span>
                      <strong className="text-blue-900 font-bold">{req.amount.toLocaleString()} {currency}</strong>
                    </div>
                    {req.approvedBy && (
                      <div className="flex justify-between text-slate-500 text-[11px] pt-1 border-t border-slate-200">
                        <span>المعتمد: {req.approvedBy}</span>
                        <span>{req.approvedAt}</span>
                      </div>
                    )}
                  </div>

                  {req.status === 'pending' && (
                    <div className="flex gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => handleApprovalAction(req, 'approved')}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-xl text-xs font-bold cursor-pointer transition shadow-xs"
                      >
                        ✅ اعتماد وموافقة
                      </button>
                      <button
                        onClick={() => handleApprovalAction(req, 'rejected')}
                        className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-2 rounded-xl text-xs font-bold cursor-pointer transition shadow-xs"
                      >
                        ❌ رفض الطلب
                      </button>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};
