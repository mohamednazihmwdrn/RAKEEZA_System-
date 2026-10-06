import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  ArrowDownLeft,
  Search,
  Filter,
  Printer,
  FileSpreadsheet,
  Calendar,
  Clock,
  Save,
  RotateCcw,
  Pencil,
  Trash2,
  DollarSign,
  User,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  FileText,
  Smartphone,
  Landmark,
} from 'lucide-react';
import { AppData, CashTransaction, SaleInvoice } from '../types';
import { printCashVoucherWindow } from '../utils/printCash';
import { exportToExcel } from '../utils/excelExport';
import { calculateCustomerBalance } from '../utils/accounting';

interface ReceiptVouchersClassicProps {
  appData: AppData;
  onUpdateData: (newData: AppData, actionInfo?: { action?: string; module?: string; details?: string; deletedId?: string | number }) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  initialCustomerName?: string;
  initialAmount?: number;
}

export const ReceiptVouchersClassic: React.FC<ReceiptVouchersClassicProps> = ({
  appData,
  onUpdateData,
  showToast,
  initialCustomerName,
  initialAmount,
}) => {
  // Live Clock & Date State
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('ar-EG', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
      setCurrentDate(
        now.toLocaleDateString('ar-EG', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Form State
  const [editingId, setEditingId] = useState<number | null>(null);
  const [voucherDate, setVoucherDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [customerName, setCustomerName] = useState<string>(initialCustomerName || '');
  const [amount, setAmount] = useState<string>(initialAmount ? initialAmount.toString() : '');
  const [method, setMethod] = useState<'drawer' | 'vodafone' | 'instapay' | 'bank'>('drawer');
  const [note, setNote] = useState<string>('');
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<number[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(appData.activeBranchId || appData.branches?.[0]?.id || 'main');

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState<'all' | 'drawer' | 'vodafone' | 'instapay' | 'bank'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'month'>('all');

  // Next Voucher Sequential ID (REC-...)
  const nextVoucherCode = useMemo(() => {
    const nextId = appData.nextCashId || (appData.cashTransactions?.length || 0) + 1;
    return `REC-${String(nextId).padStart(4, '0')}`;
  }, [appData.nextCashId, appData.cashTransactions]);

  // Selected Customer Live Balance
  const matchedCustomer = useMemo(() => {
    if (!customerName.trim()) return null;
    return appData.customers.find((c) => c.name.trim().toLowerCase() === customerName.trim().toLowerCase());
  }, [customerName, appData.customers]);

  const customerLiveBalance = useMemo(() => {
    if (!matchedCustomer) return null;
    return calculateCustomerBalance(matchedCustomer, appData);
  }, [matchedCustomer, appData]);

  // Unpaid Invoices for this customer
  const unpaidInvoices = useMemo(() => {
    if (!customerName.trim()) return [];
    return (appData.salesInvoices || []).filter((inv: SaleInvoice) => {
      const match = inv.customerName?.trim().toLowerCase() === customerName.trim().toLowerCase();
      const rem = inv.remainingAmount ?? (inv.total - (inv.paidAmount || 0));
      return match && inv.type === 'ajel' && rem > 0 && inv.status !== 'cancelled';
    });
  }, [customerName, appData.salesInvoices]);

  // Receipts List (Filter cash transactions for receive / deposit)
  const receiptTransactions = useMemo(() => {
    return (appData.cashTransactions || []).filter((t) => t.type === 'receive' || t.type === 'deposit');
  }, [appData.cashTransactions]);

  // KPIs
  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    let totalAmount = 0;
    let todayAmount = 0;
    let todayCount = 0;

    receiptTransactions.forEach((t) => {
      const val = Number(t.amount) || 0;
      totalAmount += val;
      if (t.date === today) {
        todayAmount += val;
        todayCount++;
      }
    });

    const cashDrawerBalance = appData.cashBox?.drawer || 0;
    const totalLiquidAssets =
      (appData.cashBox?.drawer || 0) +
      (appData.cashBox?.vodafone || 0) +
      (appData.cashBox?.instapay || 0) +
      (appData.cashBox?.bank || 0);

    return {
      totalCount: receiptTransactions.length,
      totalAmount,
      todayAmount,
      todayCount,
      cashDrawerBalance,
      totalLiquidAssets,
    };
  }, [receiptTransactions, appData.cashBox]);

  // Filtered List
  const filteredReceipts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = today.substring(0, 7);

    return receiptTransactions.filter((t) => {
      // Method filter
      if (methodFilter !== 'all' && t.method !== methodFilter) return false;

      // Date filter
      if (dateFilter === 'today' && t.date !== today) return false;
      if (dateFilter === 'month' && !t.date?.startsWith(currentMonth)) return false;

      // Search
      if (!q) return true;
      const matchCust = t.customerName?.toLowerCase().includes(q) || t.payerName?.toLowerCase().includes(q);
      const matchNote = t.note?.toLowerCase().includes(q);
      const matchId = t.id?.toString().includes(q) || t.voucherNo?.toLowerCase().includes(q);
      const matchInv = t.invoiceId?.toString().includes(q);
      return matchCust || matchNote || matchId || matchInv;
    });
  }, [receiptTransactions, searchTerm, methodFilter, dateFilter]);

  // Reset Form
  const resetForm = () => {
    setEditingId(null);
    setVoucherDate(new Date().toISOString().split('T')[0]);
    setCustomerName('');
    setAmount('');
    setMethod('drawer');
    setNote('');
    setSelectedInvoiceIds([]);
  };

  // Populate for Edit
  const handleStartEdit = (t: CashTransaction) => {
    setEditingId(t.id);
    setVoucherDate(t.date || new Date().toISOString().split('T')[0]);
    setCustomerName(t.customerName || t.payerName || '');
    setAmount(t.amount.toString());
    setMethod(t.method || 'drawer');
    setNote(t.note || '');
    setSelectedInvoiceIds(t.invoiceId ? [t.invoiceId] : []);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Toggle invoice selection
  const handleToggleInvoice = (invId: number) => {
    let next: number[];
    if (selectedInvoiceIds.includes(invId)) {
      next = selectedInvoiceIds.filter((id) => id !== invId);
    } else {
      next = [...selectedInvoiceIds, invId];
    }
    setSelectedInvoiceIds(next);

    const sumRem = unpaidInvoices
      .filter((i) => next.includes(i.id))
      .reduce((acc, i) => acc + (i.remainingAmount ?? (i.total - (i.paidAmount || 0))), 0);

    if (sumRem > 0) {
      setAmount(sumRem.toFixed(2));
    }
  };

  // Save Voucher (Save only OR Save & Print)
  const handleSaveVoucher = (shouldPrint: boolean) => {
    const val = parseFloat(amount);
    if (!val || val <= 0) {
      showToast('يرجى إدخال مبلغ صحيح أكبر من صفر', 'warning');
      return;
    }

    if (!customerName.trim()) {
      showToast('يرجى تحديد أو كتابة اسم العميل / المقبوض منه', 'warning');
      return;
    }

    const currentUserObj = appData.users.find((u) => u.id === appData.currentUser) || appData.users[0];
    const nowIso = new Date().toISOString();
    const updatedData = { ...appData };

    let generatedNote = note.trim();
    if (!generatedNote) {
      if (selectedInvoiceIds.length > 0) {
        generatedNote = `تحصيل سداد فواتير آجل (#${selectedInvoiceIds.join(', #')}) - العميل: ${customerName.trim()}`;
      } else {
        generatedNote = `تحصيل دفعة حساب - العميل: ${customerName.trim()}`;
      }
    }

    let savedTransaction: CashTransaction;

    if (editingId) {
      // ✏️ Edit Existing
      const existingIdx = updatedData.cashTransactions.findIndex((t) => t.id === editingId);
      if (existingIdx === -1) return;
      const oldTrans = updatedData.cashTransactions[existingIdx];

      // Revert old cashbox impact
      updatedData.cashBox[oldTrans.method] = (updatedData.cashBox[oldTrans.method] || 0) - oldTrans.amount;
      // Apply new cashbox
      updatedData.cashBox[method] = (updatedData.cashBox[method] || 0) + val;

      savedTransaction = {
        ...oldTrans,
        date: voucherDate,
        amount: val,
        method,
        note: generatedNote,
        customerName: customerName.trim(),
        payerName: customerName.trim(),
        invoiceId: selectedInvoiceIds.length === 1 ? selectedInvoiceIds[0] : oldTrans.invoiceId,
        updatedAt: nowIso,
        updatedBy: currentUserObj?.name || 'مدير النظام',
      };

      updatedData.cashTransactions[existingIdx] = savedTransaction;
      onUpdateData(updatedData, {
        action: 'edit_receipt',
        module: 'سندات القبض',
        details: `تعديل سند قبض #${editingId} بقيمة ${val.toFixed(2)} ج.م`,
      });
      showToast(`تم تعديل سند القبض #${editingId} بنجاح`, 'success');
    } else {
      // ➕ Create New
      const nextId = updatedData.nextCashId || (updatedData.cashTransactions?.length || 0) + 1;
      const voucherNo = `REC-${String(nextId).padStart(4, '0')}`;

      // Distribute payment if specific invoices selected
      if (selectedInvoiceIds.length > 0) {
        let remToAllocate = val;
        updatedData.salesInvoices = (updatedData.salesInvoices || []).map((inv) => {
          if (selectedInvoiceIds.includes(inv.id) && remToAllocate > 0) {
            const currentRem = inv.remainingAmount ?? (inv.total - (inv.paidAmount || 0));
            const payForThis = Math.min(currentRem, remToAllocate);
            remToAllocate -= payForThis;
            const newPaid = (inv.paidAmount || 0) + payForThis;
            const newRem = Math.max(0, inv.total - newPaid);
            return {
              ...inv,
              paidAmount: newPaid,
              remainingAmount: newRem,
            };
          }
          return inv;
        });
      }

      // Update customer recorded balance if customer exists
      if (matchedCustomer) {
        updatedData.customers = (updatedData.customers || []).map((c) => {
          if (c.id === matchedCustomer.id) {
            return {
              ...c,
              balance: (c.balance || 0) - val,
            };
          }
          return c;
        });
      }

      // Update Cashbox
      updatedData.cashBox[method] = (updatedData.cashBox[method] || 0) + val;

      savedTransaction = {
        id: nextId,
        voucherNo,
        syncId: `rec_${nextId}_${Date.now()}`,
        companyId: appData.companyId || 'COMP-000001',
        branchId: selectedBranchId || 'main',
        date: voucherDate,
        time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        type: 'receive',
        method,
        amount: val,
        note: generatedNote,
        customerName: customerName.trim(),
        payerName: customerName.trim(),
        invoiceId: selectedInvoiceIds.length === 1 ? selectedInvoiceIds[0] : undefined,
        status: 'approved',
        createdAt: nowIso,
        updatedAt: nowIso,
        createdBy: currentUserObj?.name || 'مدير النظام',
        createdByUserId: currentUserObj?.id,
        createdByUserCode: currentUserObj?.code || 1,
      };

      updatedData.nextCashId = nextId + 1;
      updatedData.cashTransactions = [savedTransaction, ...(updatedData.cashTransactions || [])];

      onUpdateData(updatedData, {
        action: 'create_receipt',
        module: 'سندات القبض',
        details: `إصدار سند قبض (${voucherNo}) للعميل ${customerName.trim()} بقيمة ${val.toFixed(2)} ج.م`,
      });
      showToast(`تم حفظ سند القبض (${voucherNo}) بنجاح وتحديث رصيد الخزينة`, 'success');
    }

    if (shouldPrint) {
      printCashVoucherWindow(savedTransaction, appData.settings, showToast);
    }

    resetForm();
  };

  // Delete Voucher
  const handleDeleteReceipt = (t: CashTransaction) => {
    if (!confirm(`هل أنت متأكد من إلغاء وحذف سند القبض #${t.id} بقيمة ${t.amount} ج.م؟ سيتم استرجاع رصيد الخزينة والعميل.`)) return;

    const updatedData = { ...appData };

    // Revert cashbox
    updatedData.cashBox[t.method] = Math.max(0, (updatedData.cashBox[t.method] || 0) - t.amount);

    // Revert customer balance if applicable
    if (t.customerName) {
      updatedData.customers = (updatedData.customers || []).map((c) => {
        if (c.name.trim().toLowerCase() === t.customerName?.trim().toLowerCase()) {
          return {
            ...c,
            balance: (c.balance || 0) + t.amount,
          };
        }
        return c;
      });
    }

    if (!updatedData.deletedRecords) updatedData.deletedRecords = {};
    updatedData.deletedRecords[`cash_${t.id}`] = Date.now();
    updatedData.cashTransactions = updatedData.cashTransactions.filter((x) => x.id !== t.id);

    onUpdateData(updatedData, {
      action: 'delete_receipt',
      module: 'سندات القبض',
      details: `إلغاء وحذف سند قبض #${t.id} بقيمة ${t.amount} ج.م`,
      deletedId: t.id,
    });
    showToast(`تم إلغاء سند القبض #${t.id} وتعديل رصيد الخزينة والعميل بنجاح`, 'info');
    if (editingId === t.id) resetForm();
  };

  // Export to Excel
  const handleExportExcel = () => {
    exportToExcel({
      filename: `سجل_سندات_القبض_ركيزة_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'سندات القبض',
      data: filteredReceipts,
      columns: [
        { header: 'رقم السند', key: 'voucherNo', getValue: (t: any) => t.voucherNo || `REC-${t.id}`, width: 14 },
        { header: 'التاريخ', key: 'date', width: 14 },
        { header: 'العميل / المقبوض منه', key: 'customerName', width: 28 },
        { header: 'المبلغ (ج.م)', key: 'amount', getValue: (t: any) => t.amount.toFixed(2), width: 16 },
        {
          header: 'طريقة التحصيل',
          key: 'method',
          getValue: (t: any) =>
            t.method === 'drawer'
              ? 'درج النقدية'
              : t.method === 'vodafone'
              ? 'فودافون كاش'
              : t.method === 'instapay'
              ? 'إنستاباي'
              : 'تحويل بنكي',
          width: 18,
        },
        { header: 'البيان', key: 'note', width: 32 },
        { header: 'المحرر', key: 'createdBy', width: 18 },
      ],
      companyName: appData.settings?.companyName || 'منظومة ركيزة المحاسبية',
      reportTitle: 'سجل مقبوضات وتحصيلات النقدية',
    });
    showToast('تم تصدير سندات القبض إلى Excel بنجاح', 'success');
  };

  return (
    <div className="w-full flex flex-col space-y-4 text-slate-800" dir="rtl">
      {/* 🏛️ Classic Header with Live Clock */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white rounded-xl p-3 sm:p-4 shadow-sm border border-slate-700/80 flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-emerald-600/30 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shadow-inner">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-wide text-white">سندات القبض والتحصيل - ركيزة</h1>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] px-2 py-0.5 rounded font-mono font-bold">
                ERP Windows Classic
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              تحصيل النقدية، سداد حسابات العملاء، إيداعات الخزينة والمحافظ، وطباعة إيصالات الاستلام
            </p>
          </div>
        </div>

        {/* Live Digital Clock */}
        <div className="bg-slate-950/70 border border-slate-700/80 rounded-lg px-3 py-1.5 text-left font-mono">
          <div className="flex items-center gap-1.5 text-emerald-400 text-xs sm:text-sm font-bold tracking-wider">
            <Clock className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>{currentTime || '--:--:--'}</span>
          </div>
          <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
            <Calendar className="w-3 h-3 text-slate-400" />
            <span>{currentDate}</span>
          </div>
        </div>
      </div>

      {/* 📊 KPI Statistics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Total Receipts */}
        <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500">إجمالي سندات القبض</div>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-0.5 font-mono">
              {stats.totalCount} <span className="text-xs font-normal text-slate-500">سند</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">مسجلة في دفتر المقبوضات</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
            <Receipt className="w-5 h-5" />
          </div>
        </div>

        {/* Total Received Amount */}
        <div className="bg-white rounded-xl p-3 border border-emerald-200/80 shadow-2xs flex items-center justify-between bg-emerald-50/20">
          <div>
            <div className="text-[11px] font-semibold text-emerald-800">إجمالي المقبوضات المحصلة</div>
            <div className="text-lg sm:text-xl font-black text-emerald-800 mt-0.5 font-mono">
              {stats.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-xs font-bold text-emerald-700 mr-1">ج.م</span>
            </div>
            <div className="text-[10px] text-emerald-600 mt-0.5">تحصيلات وإيداعات فعلية</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-300 flex items-center justify-center font-bold">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        {/* Today's Receipts */}
        <div className="bg-white rounded-xl p-3 border border-blue-200/80 shadow-2xs flex items-center justify-between bg-blue-50/20">
          <div>
            <div className="text-[11px] font-semibold text-blue-800">مقبوضات اليوم</div>
            <div className="text-lg sm:text-xl font-black text-blue-800 mt-0.5 font-mono">
              {stats.todayAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-xs font-bold text-blue-700 mr-1">ج.م</span>
            </div>
            <div className="text-[10px] text-blue-600 mt-0.5">{stats.todayCount} سند تحصيل اليوم</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 border border-blue-300 flex items-center justify-center font-bold font-mono text-xs">
            اليوم
          </div>
        </div>

        {/* Current Cash Drawer */}
        <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500">رصيد درج النقدية الرئيسي</div>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-0.5 font-mono">
              {stats.cashDrawerBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-xs font-bold text-slate-600 mr-1">ج.م</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              إجمالي السيولة: {stats.totalLiquidAssets.toFixed(2)} ج.م
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 border border-slate-300 flex items-center justify-center">
            <Wallet className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 📝 Windows Classic Receipt Voucher Form Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="bg-slate-100/90 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${editingId ? 'bg-amber-500 animate-pulse' : 'bg-emerald-600'}`} />
            <h2 className="text-xs sm:text-sm font-bold text-slate-800">
              {editingId ? `✏️ تعديل سند القبض #${editingId}` : '➕ إصدار وتحرير سند قبض نقدية جديد'}
            </h2>
            {editingId && (
              <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] px-2 py-0.5 rounded font-bold">
                وضع التعديل
              </span>
            )}
          </div>
          <div className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded">
            رقم السند: {editingId ? `REC-${editingId}` : nextVoucherCode}
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Voucher No */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">رقم السند</label>
              <input
                type="text"
                readOnly
                value={editingId ? `REC-${editingId}` : nextVoucherCode}
                className="w-full bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-600 cursor-not-allowed select-none text-center"
              />
            </div>

            {/* Voucher Date */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">تاريخ السند</label>
              <input
                type="date"
                value={voucherDate}
                onChange={(e) => setVoucherDate(e.target.value)}
                className="w-full bg-white border border-slate-300 focus:border-emerald-600 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 transition"
              />
            </div>

            {/* Received From (Customer) */}
            <div className="space-y-1 sm:col-span-2">
              <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                <span>المقبوض منه (العميل / الجهة) <span className="text-rose-600">*</span></span>
                {customerLiveBalance && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-bold font-mono ${
                      customerLiveBalance.balance > 0.005
                        ? 'text-rose-700 bg-rose-50 border border-rose-200'
                        : customerLiveBalance.balance < -0.005
                        ? 'text-blue-700 bg-blue-50 border border-blue-200'
                        : 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                    }`}
                  >
                    الرصيد: {customerLiveBalance.balance.toFixed(2)} ج.م
                  </span>
                )}
              </label>
              <input
                type="text"
                list="customers-datalist"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="اختر عميل أو اكتب اسم الدافع..."
                className="w-full bg-white border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 rounded-lg px-3 py-1.5 text-xs text-slate-800 transition"
              />
              <datalist id="customers-datalist">
                {appData.customers.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.phone ? `${c.name} (${c.phone})` : c.name}
                  </option>
                ))}
              </datalist>
            </div>

            {/* Amount */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">
                المبلغ المقبوض <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-white border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-emerald-700 transition text-left"
                dir="ltr"
              />
            </div>

            {/* Payment Method */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">الخزينة / طريقة التحصيل</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as any)}
                className="w-full bg-white border border-slate-300 focus:border-emerald-600 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 transition"
              >
                <option value="drawer">💵 درج النقدية الرئيسي</option>
                <option value="vodafone">📱 فودافون كاش / محفظة</option>
                <option value="instapay">⚡ إنستاباي InstaPay</option>
                <option value="bank">🏦 حساب بنكي</option>
              </select>
            </div>
          </div>

          {/* Unpaid Invoices Quick Picker */}
          {unpaidInvoices.length > 0 && (
            <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-2.5 space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-[11px] font-bold text-amber-900">
                <span>📑 فواتير آجلة مستحقة على هذا العميل ({unpaidInvoices.length} فواتير):</span>
                <span className="text-[10px] text-amber-700">اضغط على الفاتورة لتسديدها آلياً بالمبلغ</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {unpaidInvoices.map((inv) => {
                  const rem = inv.remainingAmount ?? (inv.total - (inv.paidAmount || 0));
                  const isSelected = selectedInvoiceIds.includes(inv.id);
                  return (
                    <button
                      key={inv.id}
                      type="button"
                      onClick={() => handleToggleInvoice(inv.id)}
                      className={`px-2.5 py-1 rounded border text-[11px] font-mono transition flex items-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-amber-600 text-white border-amber-700 font-bold shadow-2xs'
                          : 'bg-white text-slate-700 border-amber-300 hover:bg-amber-100'
                      }`}
                    >
                      <CheckCircle2 className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                      <span>فاتورة #{inv.id}</span>
                      <span className="font-bold">({rem.toFixed(2)} ج.م)</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Statement / Note */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700">البيان والشرح المحاسبي</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="مثال: تحصيل دفعة حساب عن شهر أكتوبر / سداد فاتورة مبيعات #..."
              className="w-full bg-white border border-slate-300 focus:border-emerald-600 rounded-lg px-3 py-1.5 text-xs text-slate-800 transition"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="min-h-[36px] bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>إلغاء التعديل</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleSaveVoucher(false)}
              className="min-h-[36px] bg-slate-800 hover:bg-slate-900 active:bg-black text-white px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{editingId ? 'حفظ التعديلات' : '💾 حفظ السند فقط'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleSaveVoucher(true)}
              className="min-h-[36px] bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white px-5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>🖨️ حفظ وطباعة إيصال استلام</span>
            </button>
          </div>
        </div>
      </div>

      {/* 🔍 Search & Filters Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث برقم السند، اسم العميل، البيان، أو رقم الفاتورة..."
            className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-lg pr-9 pl-3 py-1.5 text-xs text-slate-800 transition"
          />
        </div>

        {/* Method Filter */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setMethodFilter('all')}
            className={`px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer ${
              methodFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الكل
          </button>
          <button
            type="button"
            onClick={() => setMethodFilter('drawer')}
            className={`px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer ${
              methodFilter === 'drawer' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-emerald-50'
            }`}
          >
            درج النقدية
          </button>
          <button
            type="button"
            onClick={() => setMethodFilter('vodafone')}
            className={`px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer ${
              methodFilter === 'vodafone' ? 'bg-rose-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-rose-50'
            }`}
          >
            فودافون كاش
          </button>
          <button
            type="button"
            onClick={() => setMethodFilter('instapay')}
            className={`px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer ${
              methodFilter === 'instapay' ? 'bg-purple-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-purple-50'
            }`}
          >
            إنستاباي
          </button>
          <button
            type="button"
            onClick={() => setMethodFilter('bank')}
            className={`px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer ${
              methodFilter === 'bank' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-blue-50'
            }`}
          >
            حساب بنكي
          </button>
        </div>

        {/* Export Excel */}
        <button
          type="button"
          onClick={handleExportExcel}
          className="min-h-[34px] bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>تصدير Excel</span>
        </button>
      </div>

      {/* 📋 Receipt Vouchers Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-gradient-to-b from-slate-100 to-slate-200/90 text-slate-800 font-bold border-b border-slate-300 select-none">
                <th className="py-2.5 px-3 w-12 text-center border-l border-slate-300">#</th>
                <th className="py-2.5 px-3 w-28 text-center border-l border-slate-300">رقم السند</th>
                <th className="py-2.5 px-3 w-28 text-center border-l border-slate-300">التاريخ</th>
                <th className="py-2.5 px-3 min-w-[180px] border-l border-slate-300">المقبوض منه (العميل)</th>
                <th className="py-2.5 px-4 w-32 text-left border-l border-slate-300">المبلغ المحصل</th>
                <th className="py-2.5 px-3 w-36 text-center border-l border-slate-300">الخزينة / الوسيلة</th>
                <th className="py-2.5 px-3 min-w-[200px] border-l border-slate-300">البيان والشرح</th>
                <th className="py-2.5 px-3 w-28 text-center border-l border-slate-300">المحرر</th>
                <th className="py-2.5 px-3 w-32 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredReceipts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-1">
                      <Receipt className="w-8 h-8 text-slate-300 stroke-1" />
                      <div className="font-semibold text-xs">لا توجد سندات قبض مسجلة حالياً</div>
                      <div className="text-[11px] text-slate-400">يمكنك تسجيل سند قبض جديد من النموذج بالأعلى</div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredReceipts.map((t, idx) => {
                  const isEditingThis = editingId === t.id;
                  const methodBadge =
                    t.method === 'drawer' ? (
                      <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] px-2 py-0.5 rounded font-bold">
                        💵 درج نقدية
                      </span>
                    ) : t.method === 'vodafone' ? (
                      <span className="bg-rose-50 text-rose-800 border border-rose-200 text-[10px] px-2 py-0.5 rounded font-bold">
                        📱 فودافون كاش
                      </span>
                    ) : t.method === 'instapay' ? (
                      <span className="bg-purple-50 text-purple-800 border border-purple-200 text-[10px] px-2 py-0.5 rounded font-bold">
                        ⚡ إنستاباي
                      </span>
                    ) : (
                      <span className="bg-blue-50 text-blue-800 border border-blue-200 text-[10px] px-2 py-0.5 rounded font-bold">
                        🏦 بنك
                      </span>
                    );

                  return (
                    <tr
                      key={t.id}
                      className={`hover:bg-emerald-50/40 transition-colors ${
                        isEditingThis ? 'bg-amber-50 font-semibold' : idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'
                      }`}
                    >
                      <td className="py-2 px-3 text-center font-mono text-slate-500 border-l border-slate-200">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-bold text-emerald-800 border-l border-slate-200">
                        {t.voucherNo || `REC-${t.id}`}
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-slate-600 border-l border-slate-200">
                        {t.date}
                      </td>
                      <td className="py-2 px-3 font-bold text-slate-900 border-l border-slate-200">
                        {t.customerName || t.payerName || 'عميل نقدي'}
                      </td>
                      <td className="py-2 px-4 text-left font-mono font-bold text-emerald-700 text-xs border-l border-slate-200" dir="ltr">
                        {t.amount.toFixed(2)} ج.م
                      </td>
                      <td className="py-2 px-3 text-center border-l border-slate-200">{methodBadge}</td>
                      <td className="py-2 px-3 text-slate-700 border-l border-slate-200">
                        <div className="truncate max-w-xs">{t.note}</div>
                        {t.invoiceId && (
                          <div className="text-[10px] text-blue-700 font-mono mt-0.5">مرتبط بفاتورة #{t.invoiceId}</div>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center text-slate-500 text-[11px] border-l border-slate-200">
                        {t.createdBy || 'مدير النظام'}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Print Receipt */}
                          <button
                            type="button"
                            onClick={() => printCashVoucherWindow(t, appData.settings, showToast)}
                            title="طباعة إيصال استلام النقدية"
                            className="p-1 rounded text-blue-700 hover:bg-blue-100 transition cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => handleStartEdit(t)}
                            title="تعديل السند"
                            className="p-1 rounded text-amber-700 hover:bg-amber-100 transition cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => handleDeleteReceipt(t)}
                            title="إلغاء وحذف السند"
                            className="p-1 rounded text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
    </div>
  );
};
