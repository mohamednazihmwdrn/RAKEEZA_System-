import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  ArrowUpRight,
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
  Building2,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  FileText,
  Briefcase,
  AlertCircle,
} from 'lucide-react';
import { AppData, CashTransaction, PurchaseInvoice } from '../types';
import { printCashVoucherWindow } from '../utils/printCash';
import { exportToExcel } from '../utils/excelExport';
import { calculateSupplierBalance } from '../utils/accounting';

interface PaymentVouchersClassicProps {
  appData: AppData;
  onUpdateData: (newData: AppData, actionInfo?: { action?: string; module?: string; details?: string; deletedId?: string | number }) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  initialSupplierName?: string;
  initialAmount?: number;
}

export const PaymentVouchersClassic: React.FC<PaymentVouchersClassicProps> = ({
  appData,
  onUpdateData,
  showToast,
  initialSupplierName,
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
  const [paymentTargetType, setPaymentTargetType] = useState<'supplier' | 'expense'>('supplier');
  const [supplierName, setSupplierName] = useState<string>(initialSupplierName || '');
  const [beneficiaryName, setBeneficiaryName] = useState<string>('');
  const [expenseCategory, setExpenseCategory] = useState<string>('مصروفات عمومية وإدارية');
  const [amount, setAmount] = useState<string>(initialAmount ? initialAmount.toString() : '');
  const [method, setMethod] = useState<'drawer' | 'vodafone' | 'instapay' | 'bank'>('drawer');
  const [note, setNote] = useState<string>('');
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<number[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(appData.activeBranchId || appData.branches?.[0]?.id || 'main');

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'supplier' | 'expense'>('all');
  const [methodFilter, setMethodFilter] = useState<'all' | 'drawer' | 'vodafone' | 'instapay' | 'bank'>('all');

  // Next Voucher Sequential ID (PAY-...)
  const nextVoucherCode = useMemo(() => {
    const nextId = appData.nextCashId || (appData.cashTransactions?.length || 0) + 1;
    return `PAY-${String(nextId).padStart(4, '0')}`;
  }, [appData.nextCashId, appData.cashTransactions]);

  // Selected Supplier Live Balance
  const matchedSupplier = useMemo(() => {
    if (paymentTargetType !== 'supplier' || !supplierName.trim()) return null;
    return appData.suppliers.find((s) => s.name.trim().toLowerCase() === supplierName.trim().toLowerCase());
  }, [paymentTargetType, supplierName, appData.suppliers]);

  const supplierLiveBalance = useMemo(() => {
    if (!matchedSupplier) return null;
    return calculateSupplierBalance(matchedSupplier, appData);
  }, [matchedSupplier, appData]);

  // Unpaid Invoices for this supplier
  const unpaidInvoices = useMemo(() => {
    if (paymentTargetType !== 'supplier' || !supplierName.trim()) return [];
    return (appData.purchaseInvoices || []).filter((inv: PurchaseInvoice) => {
      const match = inv.supplierName?.trim().toLowerCase() === supplierName.trim().toLowerCase();
      const rem = inv.remainingAmount ?? (inv.total - (inv.paidAmount || 0));
      return match && inv.type === 'ajel' && rem > 0 && inv.status !== 'cancelled';
    });
  }, [paymentTargetType, supplierName, appData.purchaseInvoices]);

  // Payments List (Filter cash transactions for pay / withdraw)
  const paymentTransactions = useMemo(() => {
    return (appData.cashTransactions || []).filter((t) => t.type === 'pay' || t.type === 'withdraw');
  }, [appData.cashTransactions]);

  // KPIs
  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    let totalAmount = 0;
    let todayAmount = 0;
    let supplierDisbursed = 0;
    let expenseDisbursed = 0;

    paymentTransactions.forEach((t) => {
      const val = Number(t.amount) || 0;
      totalAmount += val;
      if (t.date === today) todayAmount += val;
      if (t.supplierName) supplierDisbursed += val;
      else expenseDisbursed += val;
    });

    const cashDrawerBalance = appData.cashBox?.drawer || 0;
    const currentMethodBalance = appData.cashBox?.[method] || 0;

    return {
      totalCount: paymentTransactions.length,
      totalAmount,
      todayAmount,
      supplierDisbursed,
      expenseDisbursed,
      cashDrawerBalance,
      currentMethodBalance,
    };
  }, [paymentTransactions, appData.cashBox, method]);

  // Filtered List
  const filteredPayments = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    return paymentTransactions.filter((t) => {
      // Category filter
      if (categoryFilter === 'supplier' && !t.supplierName) return false;
      if (categoryFilter === 'expense' && t.supplierName) return false;

      // Method filter
      if (methodFilter !== 'all' && t.method !== methodFilter) return false;

      // Search
      if (!q) return true;
      const matchSupp = t.supplierName?.toLowerCase().includes(q);
      const matchBeneficiary = t.recipientName?.toLowerCase().includes(q) || t.customerName?.toLowerCase().includes(q);
      const matchNote = t.note?.toLowerCase().includes(q);
      const matchId = t.id?.toString().includes(q) || t.voucherNo?.toLowerCase().includes(q);
      const matchCat = t.expenseCategory?.toLowerCase().includes(q);
      return matchSupp || matchBeneficiary || matchNote || matchId || matchCat;
    });
  }, [paymentTransactions, searchTerm, categoryFilter, methodFilter]);

  // Reset Form
  const resetForm = () => {
    setEditingId(null);
    setVoucherDate(new Date().toISOString().split('T')[0]);
    setPaymentTargetType('supplier');
    setSupplierName('');
    setBeneficiaryName('');
    setAmount('');
    setMethod('drawer');
    setNote('');
    setSelectedInvoiceIds([]);
  };

  // Populate for Edit
  const handleStartEdit = (t: CashTransaction) => {
    setEditingId(t.id);
    setVoucherDate(t.date || new Date().toISOString().split('T')[0]);
    if (t.supplierName) {
      setPaymentTargetType('supplier');
      setSupplierName(t.supplierName);
      setBeneficiaryName('');
    } else {
      setPaymentTargetType('expense');
      setBeneficiaryName(t.recipientName || t.customerName || '');
      setExpenseCategory(t.expenseCategory || 'مصروفات عمومية وإدارية');
    }
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

    const partyName = paymentTargetType === 'supplier' ? supplierName.trim() : beneficiaryName.trim();
    if (!partyName) {
      showToast(paymentTargetType === 'supplier' ? 'يرجى اختيار اسم المورد' : 'يرجى كتابة اسم المستفيد أو بند المصروف', 'warning');
      return;
    }

    // Cash Liquidity Check warning
    const availableCash = appData.cashBox?.[method] || 0;
    if (val > availableCash) {
      const proceed = confirm(
        `⚠️ تنبيه محاسبي: الرصيد المتاح في (${method === 'drawer' ? 'درج النقدية' : method}) هو (${availableCash.toFixed(2)} ج.م)، بينما المبلغ المطلوب صرفه (${val.toFixed(2)} ج.م). هل تريد المتابعة والسماح بالسحب بالسالب مؤقتاً؟`
      );
      if (!proceed) return;
    }

    const currentUserObj = appData.users.find((u) => u.id === appData.currentUser) || appData.users[0];
    const nowIso = new Date().toISOString();
    const updatedData = { ...appData };

    let generatedNote = note.trim();
    if (!generatedNote) {
      if (paymentTargetType === 'supplier') {
        if (selectedInvoiceIds.length > 0) {
          generatedNote = `سداد فواتير مشتريات (#${selectedInvoiceIds.join(', #')}) للمورد: ${partyName}`;
        } else {
          generatedNote = `سداد دفعة حساب للمورد: ${partyName}`;
        }
      } else {
        generatedNote = `صرف ${expenseCategory} - المستفيد: ${partyName}`;
      }
    }

    let savedTransaction: CashTransaction;

    if (editingId) {
      // ✏️ Edit Existing
      const existingIdx = updatedData.cashTransactions.findIndex((t) => t.id === editingId);
      if (existingIdx === -1) return;
      const oldTrans = updatedData.cashTransactions[existingIdx];

      // Revert old cashbox impact
      updatedData.cashBox[oldTrans.method] = (updatedData.cashBox[oldTrans.method] || 0) + oldTrans.amount;
      // Apply new cashbox deduction
      updatedData.cashBox[method] = (updatedData.cashBox[method] || 0) - val;

      savedTransaction = {
        ...oldTrans,
        date: voucherDate,
        amount: val,
        method,
        note: generatedNote,
        supplierName: paymentTargetType === 'supplier' ? partyName : undefined,
        recipientName: partyName,
        expenseCategory: paymentTargetType === 'expense' ? expenseCategory : undefined,
        invoiceId: selectedInvoiceIds.length === 1 ? selectedInvoiceIds[0] : oldTrans.invoiceId,
        updatedAt: nowIso,
        updatedBy: currentUserObj?.name || 'مدير النظام',
      };

      updatedData.cashTransactions[existingIdx] = savedTransaction;
      onUpdateData(updatedData, {
        action: 'edit_payment',
        module: 'سندات الصرف',
        details: `تعديل سند صرف #${editingId} بقيمة ${val.toFixed(2)} ج.م`,
      });
      showToast(`تم تعديل سند الصرف #${editingId} بنجاح`, 'success');
    } else {
      // ➕ Create New
      const nextId = updatedData.nextCashId || (updatedData.cashTransactions?.length || 0) + 1;
      const voucherNo = `PAY-${String(nextId).padStart(4, '0')}`;

      // Distribute payment if specific purchase invoices selected
      if (paymentTargetType === 'supplier' && selectedInvoiceIds.length > 0) {
        let remToAllocate = val;
        updatedData.purchaseInvoices = (updatedData.purchaseInvoices || []).map((inv) => {
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

      // Update supplier recorded balance if applicable
      if (paymentTargetType === 'supplier' && matchedSupplier) {
        updatedData.suppliers = (updatedData.suppliers || []).map((s) => {
          if (s.id === matchedSupplier.id) {
            return {
              ...s,
              balance: (s.balance || 0) - val,
            };
          }
          return s;
        });
      }

      // Deduct from Cashbox
      updatedData.cashBox[method] = (updatedData.cashBox[method] || 0) - val;

      savedTransaction = {
        id: nextId,
        voucherNo,
        syncId: `pay_${nextId}_${Date.now()}`,
        companyId: appData.companyId || 'COMP-000001',
        branchId: selectedBranchId || 'main',
        date: voucherDate,
        time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        type: 'pay',
        method,
        amount: val,
        note: generatedNote,
        supplierName: paymentTargetType === 'supplier' ? partyName : undefined,
        recipientName: partyName,
        expenseCategory: paymentTargetType === 'expense' ? expenseCategory : undefined,
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
        action: 'create_payment',
        module: 'سندات الصرف',
        details: `إصدار سند صرف (${voucherNo}) للجهة ${partyName} بقيمة ${val.toFixed(2)} ج.م`,
      });
      showToast(`تم حفظ سند الصرف (${voucherNo}) بنجاح وخصم المبلغ من الخزينة`, 'success');
    }

    if (shouldPrint) {
      printCashVoucherWindow(savedTransaction, appData.settings, showToast);
    }

    resetForm();
  };

  // Delete Voucher
  const handleDeletePayment = (t: CashTransaction) => {
    if (!confirm(`هل أنت متأكد من إلغاء وحذف سند الصرف #${t.id} بقيمة ${t.amount} ج.م؟ سيتم استرجاع النقدية للخزينة.`)) return;

    const updatedData = { ...appData };

    // Revert cashbox (refund to drawer)
    updatedData.cashBox[t.method] = (updatedData.cashBox[t.method] || 0) + t.amount;

    // Revert supplier balance if applicable
    if (t.supplierName) {
      updatedData.suppliers = (updatedData.suppliers || []).map((s) => {
        if (s.name.trim().toLowerCase() === t.supplierName?.trim().toLowerCase()) {
          return {
            ...s,
            balance: (s.balance || 0) + t.amount,
          };
        }
        return s;
      });
    }

    if (!updatedData.deletedRecords) updatedData.deletedRecords = {};
    updatedData.deletedRecords[`cash_${t.id}`] = Date.now();
    updatedData.cashTransactions = updatedData.cashTransactions.filter((x) => x.id !== t.id);

    onUpdateData(updatedData, {
      action: 'delete_payment',
      module: 'سندات الصرف',
      details: `إلغاء وحذف سند صرف #${t.id} بقيمة ${t.amount} ج.م`,
      deletedId: t.id,
    });
    showToast(`تم إلغاء سند الصرف #${t.id} واسترجاع النقدية للخزينة بنجاح`, 'info');
    if (editingId === t.id) resetForm();
  };

  // Export to Excel
  const handleExportExcel = () => {
    exportToExcel({
      filename: `سجل_سندات_الصرف_ركيزة_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'سندات الصرف',
      data: filteredPayments,
      columns: [
        { header: 'رقم السند', key: 'voucherNo', getValue: (t: any) => t.voucherNo || `PAY-${t.id}`, width: 14 },
        { header: 'التاريخ', key: 'date', width: 14 },
        { header: 'المستفيد / المورد', key: 'recipient', getValue: (t: any) => t.supplierName || t.recipientName || 'مورد عام', width: 28 },
        { header: 'نوع الصرف', key: 'category', getValue: (t: any) => t.supplierName ? 'سداد مورد' : t.expenseCategory || 'مصروف عام', width: 20 },
        { header: 'المبلغ المنصرف (ج.م)', key: 'amount', getValue: (t: any) => t.amount.toFixed(2), width: 18 },
        {
          header: 'طريقة الصرف',
          key: 'method',
          getValue: (t: any) =>
            t.method === 'drawer'
              ? 'درج النقدية'
              : t.method === 'vodafone'
              ? 'فودافون كاش'
              : t.method === 'instapay'
              ? 'إنستاباي'
              : 'حساب بنكي',
          width: 18,
        },
        { header: 'البيان', key: 'note', width: 32 },
        { header: 'المحرر', key: 'createdBy', width: 18 },
      ],
      companyName: appData.settings?.companyName || 'منظومة ركيزة المحاسبية',
      reportTitle: 'سجل مدفوعات وسندات الصرف والمصروفات',
    });
    showToast('تم تصدير سندات الصرف إلى Excel بنجاح', 'success');
  };

  return (
    <div className="w-full flex flex-col space-y-4 text-slate-800" dir="rtl">
      {/* 🏛️ Classic Header with Live Clock - خلفية بيضاء وكتابة سوداء متناسقة مع الواجهة الرئيسية */}
      <div className="bg-white text-slate-900 rounded-xl p-3 sm:p-4 shadow-xs border-2 border-slate-200 flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700 shadow-2xs">
            <ArrowUpRight className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-wide text-slate-900">سندات الصرف والمصروفات - ركيزة</h1>
              <span className="bg-rose-50 text-rose-800 border border-rose-200 text-[10px] px-2 py-0.5 rounded font-bold">
                📤 قسم سندات الصرف
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5 font-medium">
              صرف وسداد دفعات الموردين، المصروفات التشغيلية والعمومية، وطباعة إيصالات الصرف
            </p>
          </div>
        </div>

        {/* Live Digital Clock */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-left font-mono shadow-2xs">
          <div className="flex items-center gap-1.5 text-rose-700 text-xs sm:text-sm font-bold tracking-wider">
            <Clock className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
            <span>{currentTime || '--:--:--'}</span>
          </div>
          <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5 font-semibold">
            <Calendar className="w-3 h-3 text-slate-500" />
            <span>{currentDate}</span>
          </div>
        </div>
      </div>

      {/* 📊 KPI Statistics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Total Payments Count */}
        <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500">إجمالي سندات الصرف</div>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-0.5 font-mono">
              {stats.totalCount} <span className="text-xs font-normal text-slate-500">سند</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">مسجلة في دفتر المدفوعات</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center">
            <Receipt className="w-5 h-5" />
          </div>
        </div>

        {/* Total Disbursed Amount */}
        <div className="bg-white rounded-xl p-3 border border-rose-200/80 shadow-2xs flex items-center justify-between bg-rose-50/20">
          <div>
            <div className="text-[11px] font-semibold text-rose-800">إجمالي المدفوعات والمصروفات</div>
            <div className="text-lg sm:text-xl font-black text-rose-800 mt-0.5 font-mono">
              {stats.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-xs font-bold text-rose-700 mr-1">ج.م</span>
            </div>
            <div className="text-[10px] text-rose-600 mt-0.5">
              موردين: {stats.supplierDisbursed.toFixed(2)} | مصاريف: {stats.expenseDisbursed.toFixed(2)}
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-rose-100 text-rose-700 border border-rose-300 flex items-center justify-center font-bold">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        {/* Today's Payments */}
        <div className="bg-white rounded-xl p-3 border border-amber-200/80 shadow-2xs flex items-center justify-between bg-amber-50/20">
          <div>
            <div className="text-[11px] font-semibold text-amber-900">مدفوعات اليوم</div>
            <div className="text-lg sm:text-xl font-black text-amber-900 mt-0.5 font-mono">
              {stats.todayAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-xs font-bold text-amber-700 mr-1">ج.م</span>
            </div>
            <div className="text-[10px] text-amber-700 mt-0.5">منصرفات اليوم من الخزائن</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center font-bold font-mono text-xs">
            اليوم
          </div>
        </div>

        {/* Drawer Cash Available */}
        <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500">السيولة المتاحة في الدرج</div>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-0.5 font-mono">
              {stats.cashDrawerBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-xs font-bold text-slate-600 mr-1">ج.م</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              رصيد الوسيلة المحددة: {stats.currentMethodBalance.toFixed(2)} ج.م
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 border border-slate-300 flex items-center justify-center">
            <Wallet className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 📝 Windows Classic Payment Voucher Form Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="bg-slate-100/90 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${editingId ? 'bg-amber-500 animate-pulse' : 'bg-rose-600'}`} />
            <h2 className="text-xs sm:text-sm font-bold text-slate-800">
              {editingId ? `✏️ تعديل سند الصرف #${editingId}` : '➕ إصدار وتحرير سند صرف نقدية جديد'}
            </h2>
            {editingId && (
              <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] px-2 py-0.5 rounded font-bold">
                وضع التعديل
              </span>
            )}
          </div>
          <div className="text-xs font-mono font-bold text-rose-800 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded">
            رقم السند: {editingId ? `PAY-${editingId}` : nextVoucherCode}
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* Target Type Selector: Supplier vs Operating Expense */}
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <span className="text-xs font-bold text-slate-700 ml-2">نوع جهة الصرف:</span>
            <button
              type="button"
              onClick={() => setPaymentTargetType('supplier')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                paymentTargetType === 'supplier'
                  ? 'bg-indigo-700 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>🏢 سداد لمورد أو شركة توريد</span>
            </button>
            <button
              type="button"
              onClick={() => setPaymentTargetType('expense')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                paymentTargetType === 'expense'
                  ? 'bg-rose-700 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>💼 مصروف تشغيلي / عام</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Voucher No */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">رقم السند</label>
              <input
                type="text"
                readOnly
                value={editingId ? `PAY-${editingId}` : nextVoucherCode}
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
                className="w-full bg-white border border-slate-300 focus:border-rose-600 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 transition"
              />
            </div>

            {/* Payee / Target */}
            {paymentTargetType === 'supplier' ? (
              <div className="space-y-1 sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                  <span>المورد / شركة التوريد <span className="text-rose-600">*</span></span>
                  {supplierLiveBalance && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-bold font-mono ${
                        supplierLiveBalance.balance > 0.005
                          ? 'text-blue-700 bg-blue-50 border border-blue-200'
                          : 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                      }`}
                    >
                      المستحق له: {supplierLiveBalance.balance.toFixed(2)} ج.م
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  list="suppliers-datalist"
                  required
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="اختر مورد أو اكتب اسم المورد..."
                  className="w-full bg-white border border-slate-300 focus:border-rose-600 focus:ring-1 focus:ring-rose-600 rounded-lg px-3 py-1.5 text-xs text-slate-800 transition"
                />
                <datalist id="suppliers-datalist">
                  {appData.suppliers.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.phone ? `${s.name} (${s.phone})` : s.name}
                    </option>
                  ))}
                </datalist>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">بند المصروف</label>
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value)}
                    className="w-full bg-white border border-slate-300 focus:border-rose-600 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 transition"
                  >
                    <option value="مصروفات عمومية وإدارية">مصروفات عمومية وإدارية</option>
                    <option value="إيجار المقر والمخازن">إيجار المقر والمخازن</option>
                    <option value="رواتب وأجور الموظفين">رواتب وأجور الموظفين</option>
                    <option value="كهرباء ومياه وإنترنت">كهرباء ومياه وإنترنت</option>
                    <option value="بوفيه وضيافة ونثريات">بوفيه وضيافة ونثريات</option>
                    <option value="صيانة ومستلزمات تشغيل">صيانة ومستلزمات تشغيل</option>
                    <option value="وقود ومصاريف نقل وانتقالات">وقود ومصاريف نقل وانتقالات</option>
                    <option value="دعاية وإعلانات وتسويق">دعاية وإعلانات وتسويق</option>
                    <option value="مسحوبات شخصية للشركاء">مسحوبات شخصية للشركاء</option>
                    <option value="مصروفات شحن وتوصيل">مصروفات شحن وتوصيل</option>
                    <option value="أخرى">أخرى (غير مصنف)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">
                    اسم المستفيد <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={beneficiaryName}
                    onChange={(e) => setBeneficiaryName(e.target.value)}
                    placeholder="اسم الشخص أو الجهة المستلمة..."
                    className="w-full bg-white border border-slate-300 focus:border-rose-600 rounded-lg px-3 py-1.5 text-xs text-slate-800 transition"
                  />
                </div>
              </>
            )}

            {/* Amount */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">
                المبلغ المنصرف <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-white border border-slate-300 focus:border-rose-600 focus:ring-1 focus:ring-rose-600 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-rose-700 transition text-left"
                dir="ltr"
              />
            </div>

            {/* Payment Method */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">الخزينة المنصرف منها</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as any)}
                className="w-full bg-white border border-slate-300 focus:border-rose-600 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 transition"
              >
                <option value="drawer">💵 درج النقدية الرئيسي</option>
                <option value="vodafone">📱 فودافون كاش / محفظة</option>
                <option value="instapay">⚡ إنستاباي InstaPay</option>
                <option value="bank">🏦 حساب بنكي</option>
              </select>
            </div>
          </div>

          {/* Unpaid Purchase Invoices Quick Picker (If Supplier) */}
          {paymentTargetType === 'supplier' && unpaidInvoices.length > 0 && (
            <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-2.5 space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-[11px] font-bold text-blue-900">
                <span>📑 فواتير مشتريات آجلة مستحقة لهذا المورد ({unpaidInvoices.length} فواتير):</span>
                <span className="text-[10px] text-blue-700">اضغط على الفاتورة لتسديدها آلياً بالمبلغ</span>
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
                          ? 'bg-blue-700 text-white border-blue-800 font-bold shadow-2xs'
                          : 'bg-white text-slate-700 border-blue-300 hover:bg-blue-100'
                      }`}
                    >
                      <CheckCircle2 className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                      <span>فاتورة مشتريات #{inv.id}</span>
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
              placeholder="مثال: سداد دفعة توريد خامات / سداد فاتورة كهرباء شهر 10 / صيانة سيارة التوزيع..."
              className="w-full bg-white border border-slate-300 focus:border-rose-600 rounded-lg px-3 py-1.5 text-xs text-slate-800 transition"
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
              className="min-h-[36px] bg-rose-700 hover:bg-rose-800 active:bg-rose-900 text-white px-5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>🖨️ حفظ وطباعة إيصال صرف</span>
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
            placeholder="بحث برقم السند، اسم المورد/المستفيد، البيان، أو نوع المصروف..."
            className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-rose-600 rounded-lg pr-9 pl-3 py-1.5 text-xs text-slate-800 transition"
          />
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer ${
              categoryFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الكل ({paymentTransactions.length})
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter('supplier')}
            className={`px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer ${
              categoryFilter === 'supplier' ? 'bg-indigo-700 text-white shadow-2xs' : 'text-slate-600 hover:bg-indigo-50'
            }`}
          >
            سداد موردين
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter('expense')}
            className={`px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer ${
              categoryFilter === 'expense' ? 'bg-rose-700 text-white shadow-2xs' : 'text-slate-600 hover:bg-rose-50'
            }`}
          >
            مصروفات عامة
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

      {/* 📋 Payment Vouchers Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-gradient-to-b from-slate-100 to-slate-200/90 text-slate-800 font-bold border-b border-slate-300 select-none">
                <th className="py-2.5 px-3 w-12 text-center border-l border-slate-300">#</th>
                <th className="py-2.5 px-3 w-28 text-center border-l border-slate-300">رقم السند</th>
                <th className="py-2.5 px-3 w-28 text-center border-l border-slate-300">التاريخ</th>
                <th className="py-2.5 px-3 min-w-[180px] border-l border-slate-300">المستفيد / المورد</th>
                <th className="py-2.5 px-3 w-36 text-center border-l border-slate-300">نوع الصرف</th>
                <th className="py-2.5 px-4 w-32 text-left border-l border-slate-300">المبلغ المنصرف</th>
                <th className="py-2.5 px-3 w-36 text-center border-l border-slate-300">الخزينة المنصرف منها</th>
                <th className="py-2.5 px-3 min-w-[200px] border-l border-slate-300">البيان والشرح</th>
                <th className="py-2.5 px-3 w-28 text-center border-l border-slate-300">المحرر</th>
                <th className="py-2.5 px-3 w-32 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-1">
                      <Receipt className="w-8 h-8 text-slate-300 stroke-1" />
                      <div className="font-semibold text-xs">لا توجد سندات صرف مسجلة حالياً</div>
                      <div className="text-[11px] text-slate-400">يمكنك تسجيل سند صرف جديد من النموذج بالأعلى</div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPayments.map((t, idx) => {
                  const isEditingThis = editingId === t.id;
                  const isSupplier = Boolean(t.supplierName);

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
                      className={`hover:bg-rose-50/40 transition-colors ${
                        isEditingThis ? 'bg-amber-50 font-semibold' : idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'
                      }`}
                    >
                      <td className="py-2 px-3 text-center font-mono text-slate-500 border-l border-slate-200">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-bold text-rose-800 border-l border-slate-200">
                        {t.voucherNo || `PAY-${t.id}`}
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-slate-600 border-l border-slate-200">
                        {t.date}
                      </td>
                      <td className="py-2 px-3 font-bold text-slate-900 border-l border-slate-200">
                        {t.supplierName || t.recipientName || 'مورد عام'}
                      </td>
                      <td className="py-2 px-3 text-center border-l border-slate-200">
                        {isSupplier ? (
                          <span className="bg-indigo-100 text-indigo-800 border border-indigo-200 text-[10px] px-2 py-0.5 rounded font-bold">
                            🏢 سداد مورد
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-800 border border-slate-200 text-[10px] px-2 py-0.5 rounded font-bold">
                            {t.expenseCategory || '💼 مصروف عام'}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-4 text-left font-mono font-bold text-rose-700 text-xs border-l border-slate-200" dir="ltr">
                        {t.amount.toFixed(2)} ج.م
                      </td>
                      <td className="py-2 px-3 text-center border-l border-slate-200">{methodBadge}</td>
                      <td className="py-2 px-3 text-slate-700 border-l border-slate-200">
                        <div className="truncate max-w-xs">{t.note}</div>
                        {t.invoiceId && (
                          <div className="text-[10px] text-blue-700 font-mono mt-0.5">مرتبط بفاتورة مشتريات #{t.invoiceId}</div>
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
                            title="طباعة إيصال صرف النقدية"
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
                            onClick={() => handleDeletePayment(t)}
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
