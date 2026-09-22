import React, { useState } from 'react';
import { AppData, Cheque, JournalEntry } from '../types';
import { addAuditLog } from '../utils/storage';
import { openUnifiedPrintWindow } from '../utils/printUnified';
import { printChequesReport, printChequeVoucher } from '../utils/printChequesReport';
import { exportToExcel } from '../utils/excelExport';
import { TableActionButtons } from './TableActionButtons';

interface ChequesViewProps {
  appData: AppData;
  onUpdateData: (newData: AppData) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onInspectItem?: (type: any, data: any) => void;
}

export const ChequesView: React.FC<ChequesViewProps> = ({
  appData,
  onUpdateData,
  showToast,
  onInspectItem,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'receivable' | 'payable'>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Cheque Form
  const [chequeNumber, setChequeNumber] = useState('');
  const [bankName, setBankName] = useState('البنك الأهلي المصري');
  const [partyName, setPartyName] = useState('');
  const [amount, setAmount] = useState<number>(10000);
  const [issueDate, setIssueDate] = useState(new Date().toISOString().substring(0, 10));
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 15 * 86400000).toISOString().substring(0, 10));
  const [chequeType, setChequeType] = useState<'receivable' | 'payable'>('receivable');
  const [notes, setNotes] = useState('');

  // Lifecycle Action Modal
  const [actionCheque, setActionCheque] = useState<Cheque | null>(null);
  const [targetBankId, setTargetBankId] = useState(appData.bankAccounts[0]?.id || 'b1');
  const [endorsedSupplier, setEndorsedSupplier] = useState(appData.suppliers[0]?.name || '');

  const currency = appData.settings?.currencySymbol || 'ج.م';
  const cheques = appData.cheques || [];

  const todayStr = new Date().toISOString().substring(0, 10);
  const dueCheques = cheques.filter((c) => c.status !== 'collected' && c.status !== 'cancelled' && c.dueDate <= todayStr);

  const filteredCheques = cheques.filter((c) => {
    if (filterType !== 'all' && c.type !== filterType) return false;
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    return true;
  });

  const totalReceivable = cheques.filter((c) => c.type === 'receivable' && c.status !== 'collected' && c.status !== 'cancelled').reduce((acc, c) => acc + c.amount, 0);
  const totalPayable = cheques.filter((c) => c.type === 'payable' && c.status !== 'collected' && c.status !== 'cancelled').reduce((acc, c) => acc + c.amount, 0);

  // Create New Cheque
  const handleSaveCheque = () => {
    if (!chequeNumber.trim() || !partyName.trim() || amount <= 0) {
      showToast('يرجى استكمال بيانات الشيك والمبلغ والطرف المعني', 'warning');
      return;
    }

    const nextId = appData.nextChequeId || 1;
    const newCheque: Cheque = {
      id: nextId,
      chequeNumber,
      bankName,
      drawerName: chequeType === 'receivable' ? partyName : appData.settings.companyName,
      beneficiaryName: chequeType === 'receivable' ? appData.settings.companyName : partyName,
      amount: Number(amount),
      issueDate,
      dueDate,
      type: chequeType,
      status: 'received',
      notes,
      createdBy: appData.users.find((u) => u.id === appData.currentUser)?.name || 'المدير',
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };

    let updated = {
      ...appData,
      cheques: [newCheque, ...appData.cheques],
      nextChequeId: nextId + 1,
    };

    // If receivable from customer, reduce customer debt upon cheque receipt
    if (chequeType === 'receivable') {
      updated.customers = updated.customers.map((c) =>
        c.name === partyName ? { ...c, balance: Math.max(0, c.balance - amount) } : c
      );
    } else {
      // If payable to supplier, reduce supplier balance
      updated.suppliers = updated.suppliers.map((s) =>
        s.name === partyName ? { ...s, balance: Math.max(0, s.balance - amount) } : s
      );
    }

    updated = addAuditLog(
      updated,
      'create',
      'الشيكات',
      `تم استلام / إصدار ${chequeType === 'receivable' ? 'ورقة قبض' : 'ورقة دفع'} شيك رقم #${chequeNumber} بمبلغ ${amount} ${currency}.`
    );

    onUpdateData(updated);
    showToast(`تم تسجيل الشيك رقم ${chequeNumber} بنجاح`, 'success');
    setIsModalOpen(false);
  };

  // Perform Lifecycle Transition
  const handleTransition = (newStatus: Cheque['status']) => {
    if (!actionCheque) return;

    let updated = { ...appData };
    const nextJournalId = updated.nextJournalId || 1;
    const chq = actionCheque;

    if (newStatus === 'collected') {
      // 1. Add amount to selected bank account
      updated.bankAccounts = updated.bankAccounts.map((b) =>
        b.id === targetBankId ? { ...b, balance: b.balance + (chq.type === 'receivable' ? chq.amount : -chq.amount) } : b
      );

      // 2. Dual Accounting Entry
      const targetBankName = updated.bankAccounts.find((b) => b.id === targetBankId)?.name || 'الحساب البنكي';
      const jv: JournalEntry = {
        id: nextJournalId,
        entryNumber: `CHK-${String(nextJournalId).padStart(4, '0')}`,
        date: new Date().toISOString().substring(0, 10),
        description: `تحصيل وإيداع شيك رقم ${chq.chequeNumber} في ${targetBankName}`,
        source: 'cash',
        createdBy: appData.users.find((u) => u.id === appData.currentUser)?.name || 'المدير',
        createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
        isApproved: true,
        lines: [
          {
            accountCode: '1104',
            accountName: `الحسابات البنكية (${targetBankName})`,
            debit: chq.type === 'receivable' ? chq.amount : 0,
            credit: chq.type === 'payable' ? chq.amount : 0,
            note: `شيك رقم ${chq.chequeNumber}`,
          },
          {
            accountCode: '1105',
            accountName: 'أوراق القبض والشيكات تحت التحصيل',
            debit: chq.type === 'payable' ? chq.amount : 0,
            credit: chq.type === 'receivable' ? chq.amount : 0,
            note: `تسوية حافظة الشيكات`,
          },
        ],
      };

      updated.journalEntries = [jv, ...updated.journalEntries];
      updated.nextJournalId = nextJournalId + 1;
      showToast(`تم تحصيل الشيك وإيداع ${(chq.amount || 0).toLocaleString()} ${currency} في ${targetBankName}`, 'success');
    } else if (newStatus === 'bounced') {
      // Revert customer balance
      if (chq.type === 'receivable') {
        updated.customers = updated.customers.map((c) =>
          c.name === chq.drawerName ? { ...c, balance: c.balance + chq.amount } : c
        );
      }
      showToast(`تم تسجيل ارتداد الشيك وإعادة المديونية على حساب العميل ${chq.drawerName}`, 'warning');
    } else if (newStatus === 'endorsed') {
      // Endorse to supplier -> decrease supplier balance
      updated.suppliers = updated.suppliers.map((s) =>
        s.name === endorsedSupplier ? { ...s, balance: Math.max(0, s.balance - chq.amount) } : s
      );
      showToast(`تم تظهير الشيك بنجاح لسداد مديونية المورد ${endorsedSupplier}`, 'success');
    }

    // Update Cheque Status
    updated.cheques = updated.cheques.map((c) =>
      c.id === chq.id
        ? {
            ...c,
            status: newStatus,
            collectingBankAccountId: newStatus === 'collected' ? targetBankId : c.collectingBankAccountId,
            endorsedToSupplier: newStatus === 'endorsed' ? endorsedSupplier : c.endorsedToSupplier,
          }
        : c
    );

    updated = addAuditLog(
      updated,
      'update',
      'الشيكات',
      `تم تغيير حالة الشيك رقم #${chq.chequeNumber} إلى [${newStatus}].`
    );

    onUpdateData(updated);
    setActionCheque(null);
  };

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      {/* Top Header & Sub-nav */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap justify-between items-center gap-4">
        <div>
          <h3 className="text-lg font-black text-[#1a237e] flex items-center gap-2">
            <span>💳 إدارة الشيكات وأوراق القبض والدفع (Cheques & Notes)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            متابعة حافظة الشيكات، تواريخ الاستحقاق، التظهير، التحصيل البنكي، وتنبيهات الشيكات المرتدة.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setChequeNumber(`CHK-${Math.floor(100000 + Math.random() * 900000)}`);
              setPartyName(appData.customers[0]?.name || '');
              setAmount(15000);
              setIsModalOpen(true);
            }}
            className="bg-[#1a237e] hover:bg-[#0d47a1] text-white px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-xs"
          >
            <span>➕ تسجيل شيك جديد</span>
          </button>
          <TableActionButtons
            onPrint={() => {
              printChequesReport(
                {
                  cheques: filteredCheques,
                  title: 'تقرير حركة الشيكات وأوراق القبض/الدفع',
                  filterType,
                  filterStatus,
                },
                appData
              );
            }}
            onExportExcel={() => {
              exportToExcel({
                filename: `سجل_الشيكات_${new Date().toISOString().split('T')[0]}`,
                sheetName: 'الشيكات والأوراق المالية',
                data: filteredCheques,
                columns: [
                  { header: 'رقم الشيك', key: 'chequeNumber', width: 16 },
                  {
                    header: 'النوع',
                    getValue: (c: Cheque) => c.type === 'receivable' ? 'ورقة قبض' : 'ورقة دفع',
                    width: 14,
                  },
                  { header: 'البنك المسحوب عليه', key: 'bankName', width: 22 },
                  { header: 'الطرف المعني / الساحب / المستفيد', key: 'partyName', width: 25 },
                  { header: 'قيمة الشيك (ج.م)', getValue: (c: Cheque) => c.amount.toFixed(2), width: 18 },
                  { header: 'تاريخ التحرير', key: 'issueDate', width: 14 },
                  { header: 'تاريخ الاستحقاق', key: 'dueDate', width: 14 },
                  {
                    header: 'الحالة',
                    getValue: (c: Cheque) => c.status === 'collected' ? 'تم التحصيل' : c.status === 'under_collection' ? 'تحت التحصيل' : c.status === 'bounced' ? 'مرتد ومرفوض' : c.status === 'endorsed' ? 'مظهر لمورد' : 'ملغي',
                    width: 16,
                  },
                  { header: 'ملاحظات', key: 'notes', width: 25 },
                ],
                companyName: appData.settings?.companyName || 'المنظومة المحاسبية المعتمدة',
                reportTitle: 'سجل وحصر الشيكات وأوراق القبض والدفع',
              });
              showToast('تم تصدير سجل الشيكات إلى Excel بنجاح', 'success');
            }}
            printTitle="طباعة سجل حركة الشيكات المعتمد"
            exportTitle="تصدير سجل الشيكات إلى Excel"
          />
        </div>
      </div>

      {/* Due / Overdue Alert Banner */}
      {dueCheques.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center justify-between gap-3 text-xs text-amber-900 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <strong className="text-sm font-black block">
                تنبيه استحقاق: يوجد {dueCheques.length} شيك مستحق الصرف أو التحصيل اليوم!
              </strong>
              <span>
                إجمالي المبالغ المستحقة: <strong>{dueCheques.reduce((a, b) => a + (b.amount || 0), 0).toLocaleString()} {currency}</strong>
              </span>
            </div>
          </div>
          <button
            onClick={() => setFilterStatus('all')}
            className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-xl font-bold cursor-pointer transition shadow-xs"
          >
            استعراض الشيكات المستحقة
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-bold block">أوراق القبض تحت التحصيل (مستحقات للشركة)</span>
            <strong className="text-xl font-black text-emerald-700">{(totalReceivable || 0).toLocaleString()} {currency}</strong>
          </div>
          <span className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xl">📥</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-bold block">أوراق الدفع الصادرة (التزامات على الشركة)</span>
            <strong className="text-xl font-black text-rose-700">{(totalPayable || 0).toLocaleString()} {currency}</strong>
          </div>
          <span className="p-3 bg-rose-50 text-rose-800 rounded-xl text-xl">📤</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap justify-between items-center gap-3 text-xs font-bold">
        <div className="flex items-center gap-2">
          <span>نوع الشيك:</span>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="p-2 border border-slate-300 rounded-xl bg-slate-50"
          >
            <option value="all">جميع الشيكات (قبض ودفع)</option>
            <option value="receivable">📥 أوراق قبض (واردة من عملاء)</option>
            <option value="payable">📤 أوراق دفع (صادرة لموردين)</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span>حالة الشيك:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="p-2 border border-slate-300 rounded-xl bg-slate-50"
          >
            <option value="all">جميع الحالات</option>
            <option value="received">مستلم بالحافظة</option>
            <option value="under_collection">تحت التحصيل بالبنك</option>
            <option value="collected">تم التحصيل والإيداع</option>
            <option value="bounced">مرتد ومرفوض</option>
            <option value="endorsed">مظهر لمورد</option>
          </select>
        </div>
      </div>

      {/* Cheques Container: Responsive Cards on Mobile & Table on Desktop */}
      {/* Mobile Cards View (< md) */}
      <div className="block md:hidden space-y-3">
        {filteredCheques.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center text-slate-400 border border-slate-200">
            <span className="text-3xl block mb-2">💳</span>
            <p className="font-bold text-sm text-slate-700">لا توجد شيكات مطابقة للفلاتر المحددة</p>
          </div>
        ) : (
          filteredCheques.map((c) => {
            const isOverdue = c.status !== 'collected' && c.dueDate < todayStr;
            return (
              <div
                key={c.id}
                onClick={() => onInspectItem && onInspectItem('cheque', c)}
                className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-3 cursor-pointer hover:border-indigo-300 transition w-full max-w-full box-border"
              >
                {/* Header: Cheque Number, Bank, Type */}
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div>
                    <div className="font-mono font-bold text-blue-900 text-sm">#{c.chequeNumber}</div>
                    <span className="text-[11px] text-slate-500 font-semibold">{c.bankName}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        c.type === 'receivable' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {c.type === 'receivable' ? 'ورقة قبض (وارد)' : 'ورقة دفع (صادر)'}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        c.status === 'collected'
                          ? 'bg-emerald-100 text-emerald-800'
                          : c.status === 'under_collection'
                          ? 'bg-blue-100 text-blue-800'
                          : c.status === 'bounced'
                          ? 'bg-rose-100 text-rose-800'
                          : c.status === 'endorsed'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {c.status === 'collected'
                        ? 'محصل بالبنك'
                        : c.status === 'under_collection'
                        ? 'تحت التحصيل'
                        : c.status === 'bounced'
                        ? 'مرتد ومرفوض'
                        : c.status === 'endorsed'
                        ? 'مظهر لمورد'
                        : 'مستلم بالحافظة'}
                    </span>
                  </div>
                </div>

                {/* Drawer / Beneficiary Info */}
                <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100 space-y-1 text-xs">
                  <span className="text-[10px] text-slate-400 block">
                    {c.type === 'receivable' ? 'الساحب (المصدر):' : 'المستفيد:'}
                  </span>
                  <div className="font-bold text-slate-900 text-sm break-words">
                    {c.type === 'receivable' ? c.drawerName : c.beneficiaryName}
                  </div>
                  {c.endorsedToSupplier && (
                    <span className="text-[11px] text-purple-700 block font-semibold">
                      مظهر إلى: {c.endorsedToSupplier}
                    </span>
                  )}
                </div>

                {/* Amount and Dates */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">مبلغ الشيك:</span>
                    <span className="font-mono font-black text-slate-900 text-sm">
                      {(c.amount || 0).toLocaleString()} {currency}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">تاريخ الاستحقاق:</span>
                    <span className={`font-mono font-bold text-xs ${isOverdue ? 'text-rose-600 font-black' : 'text-slate-800'}`}>
                      {c.dueDate} {isOverdue && '⚠️ متأخر'}
                    </span>
                  </div>

                  <div className="col-span-2 bg-slate-50 p-2 rounded-xl border border-slate-100 text-[11px] flex justify-between text-slate-500 font-mono">
                    <span>تاريخ التحرير:</span>
                    <span className="font-bold text-slate-700">{c.issueDate}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-3 gap-1.5 pt-1" onClick={(e) => e.stopPropagation()}>
                  {c.status !== 'collected' ? (
                    <button
                      onClick={() => setActionCheque(c)}
                      className="min-h-[44px] bg-[#1a237e] hover:bg-[#0d47a1] active:bg-[#082a63] text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                    >
                      ⚡ إجراءات الشيك
                    </button>
                  ) : (
                    <div className="min-h-[44px] bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-center">
                      ✅ مكتمل ومحصل
                    </div>
                  )}
                  <button
                    onClick={() => onInspectItem && onInspectItem('cheque', c)}
                    className="min-h-[44px] bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    🔍 معاينة
                  </button>
                  <button
                    onClick={() => printChequeVoucher(c, appData)}
                    className="min-h-[44px] bg-blue-50 hover:bg-blue-100 active:bg-blue-200 text-blue-700 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                    title="طباعة إشعار استلام / صرف الشيك المعتمد"
                  >
                    🖨️ إشعار
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Cheques Table (>= md) */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3">رقم الشيك والبنك</th>
                <th className="p-3">النوع</th>
                <th className="p-3">الساحب / المستفيد</th>
                <th className="p-3 text-left">مبلغ الشيك</th>
                <th className="p-3 text-center">تاريخ التحرير</th>
                <th className="p-3 text-center">تاريخ الاستحقاق</th>
                <th className="p-3 text-center">الحالة</th>
                <th className="p-3 text-center">إجراءات دورة الشيك</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCheques.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center p-8 text-slate-400">
                    لا توجد شيكات مطابقة للفلاتر المحددة
                  </td>
                </tr>
              ) : (
                filteredCheques.map((c) => {
                  const isOverdue = c.status !== 'collected' && c.dueDate < todayStr;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => onInspectItem && onInspectItem('cheque', c)}
                      className="hover:bg-blue-50/40 cursor-pointer transition"
                    >
                      <td className="p-3">
                        <div className="font-mono font-bold text-blue-900 text-sm">#{c.chequeNumber}</div>
                        <span className="text-[10px] text-slate-500 font-semibold">{c.bankName}</span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            c.type === 'receivable' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {c.type === 'receivable' ? 'ورقة قبض (وارد)' : 'ورقة دفع (صادر)'}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">
                          {c.type === 'receivable' ? c.drawerName : c.beneficiaryName}
                        </div>
                        {c.endorsedToSupplier && (
                          <span className="text-[10px] text-purple-700 block">مظهر إلى: {c.endorsedToSupplier}</span>
                        )}
                      </td>
                      <td className="p-3 text-left font-black text-slate-900 text-sm">
                        {(c.amount || 0).toLocaleString()} {currency}
                      </td>
                      <td className="p-3 text-center font-mono text-slate-500">{c.issueDate}</td>
                      <td className="p-3 text-center font-mono font-bold">
                        <span className={isOverdue ? 'text-rose-600 font-black' : 'text-slate-800'}>
                          {c.dueDate} {isOverdue && '⚠️ متأخر'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            c.status === 'collected'
                              ? 'bg-emerald-100 text-emerald-800'
                              : c.status === 'under_collection'
                              ? 'bg-blue-100 text-blue-800'
                              : c.status === 'bounced'
                              ? 'bg-rose-100 text-rose-800'
                              : c.status === 'endorsed'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {c.status === 'collected'
                            ? 'محصل بالبنك'
                            : c.status === 'under_collection'
                            ? 'تحت التحصيل'
                            : c.status === 'bounced'
                            ? 'مرتد ومرفوض'
                            : c.status === 'endorsed'
                            ? 'مظهر لمورد'
                            : 'مستلم بالحافظة'}
                        </span>
                      </td>
                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          {c.status !== 'collected' && (
                            <button
                              onClick={() => setActionCheque(c)}
                              className="bg-[#1a237e] hover:bg-[#0d47a1] text-white px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition shadow-xs"
                            >
                              ⚡ إجراءات الشيك
                            </button>
                          )}
                          <button
                            onClick={() => onInspectItem && onInspectItem('cheque', c)}
                            className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-1 rounded-lg text-[11px] font-bold cursor-pointer"
                          >
                            🔍 معاينة
                          </button>
                          <button
                            onClick={() => printChequeVoucher(c, appData)}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition shadow-xs flex items-center gap-1"
                            title="طباعة إشعار استلام / صرف الشيك المعتمد"
                          >
                            🖨️ إشعار الشيك
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

      {/* New Cheque Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 border border-slate-200">
            <h3 className="font-black text-lg text-[#1a237e]">تسجيل شيك تجاري جديد</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">نوع الشيك *</label>
                <select
                  value={chequeType}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    setChequeType(val);
                    setPartyName(val === 'receivable' ? appData.customers[0]?.name || '' : appData.suppliers[0]?.name || '');
                  }}
                  className="w-full p-2 border border-slate-300 rounded-xl bg-white"
                >
                  <option value="receivable">📥 ورقة قبض (وارد من عميل)</option>
                  <option value="payable">📤 ورقة دفع (صادر لمورد)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">رقم الشيك *</label>
                <input
                  type="text"
                  value={chequeNumber}
                  onChange={(e) => setChequeNumber(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl font-mono font-bold"
                  placeholder="CHK-xxxxxx"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">البنك المسحوب عليه</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl"
                  placeholder="اسم البنك والفرع"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {chequeType === 'receivable' ? 'اسم العميل (الساحب) *' : 'اسم المورد (المستفيد) *'}
                </label>
                <input
                  type="text"
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl"
                  placeholder="الاسم التجاري للطرف"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">مبلغ الشيك ({currency}) *</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full p-2 border border-slate-300 rounded-xl font-black text-blue-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">تاريخ الاستحقاق *</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl font-bold"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">ملاحظات وبيان</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl"
                  placeholder="دفعة من فاتورة، ضمان، شيك مؤجل..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsModalOpen(false)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveCheque}
                className="bg-[#1a237e] hover:bg-[#0d47a1] text-white px-5 py-2 rounded-xl text-xs font-bold cursor-pointer shadow-xs"
              >
                💾 تسجيل وحفظ الشيك
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cheque Lifecycle Action Modal */}
      {actionCheque && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 border border-slate-200">
            <h3 className="font-black text-lg text-[#1a237e]">
              إجراءات دورة الشيك #{actionCheque.chequeNumber}
            </h3>

            <div className="bg-slate-50 p-3 rounded-xl text-xs space-y-1">
              <div>الطرف: <strong>{actionCheque.type === 'receivable' ? actionCheque.drawerName : actionCheque.beneficiaryName}</strong></div>
              <div>المبلغ: <strong className="text-blue-900">{(actionCheque.amount || 0).toLocaleString()} {currency}</strong></div>
              <div>تاريخ الاستحقاق: <strong className="font-mono">{actionCheque.dueDate}</strong></div>
            </div>

            <div className="space-y-3 text-xs">
              {/* Option 1: Deposit for collection */}
              <div className="border border-slate-200 p-3 rounded-xl space-y-2">
                <strong className="block text-slate-800">1. إيداع بالبنك للتحصيل</strong>
                <select
                  value={targetBankId}
                  onChange={(e) => setTargetBankId(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl bg-white text-xs"
                >
                  {appData.bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} ({b.accountNumber})</option>
                  ))}
                </select>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleTransition('under_collection')}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-bold cursor-pointer"
                  >
                    إرسال للمقاصة البنكية
                  </button>
                  <button
                    onClick={() => handleTransition('collected')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold cursor-pointer"
                  >
                    ✅ تم التحصيل والإيداع الفعلي
                  </button>
                </div>
              </div>

              {/* Option 2: Endorsement to Supplier */}
              {actionCheque.type === 'receivable' && (
                <div className="border border-slate-200 p-3 rounded-xl space-y-2">
                  <strong className="block text-slate-800">2. تظهير الشيك لمورد لسداد مشتريات</strong>
                  <select
                    value={endorsedSupplier}
                    onChange={(e) => setEndorsedSupplier(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl bg-white text-xs"
                  >
                    {appData.suppliers.map((s) => (
                      <option key={s.id} value={s.name}>{s.name} (رصيده: {(s.balance || 0).toLocaleString()} {currency})</option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleTransition('endorsed')}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg font-bold cursor-pointer"
                  >
                    🔄 تظهير الشيك للمورد
                  </button>
                </div>
              )}

              {/* Option 3: Mark Bounced */}
              <div className="border border-rose-200 bg-rose-50/50 p-3 rounded-xl flex justify-between items-center">
                <div>
                  <strong className="block text-rose-900">3. ارتداد ورفض الشيك من البنك</strong>
                  <span className="text-[10px] text-rose-700">إعادة المديونية لحساب العميل فوراً</span>
                </div>
                <button
                  onClick={() => handleTransition('bounced')}
                  className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg font-bold cursor-pointer"
                >
                  ❌ تسجيل ارتداد
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <button
                onClick={() => printChequeVoucher(actionCheque, appData)}
                className="bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition flex items-center gap-1.5"
                title="طباعة إشعار استلام / صرف الشيك"
              >
                🖨️ طباعة إشعار السند
              </button>
              <button
                onClick={() => setActionCheque(null)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
