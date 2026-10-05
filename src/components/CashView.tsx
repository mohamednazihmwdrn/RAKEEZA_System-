import React, { useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Printer,
  Pencil,
  Trash2,
  Search,
  FileText,
  Wallet,
  Landmark,
  Smartphone,
  Zap,
  Save,
  X,
  BarChart3,
  Calendar,
} from 'lucide-react';
import { AppData, SaleInvoice, PurchaseInvoice, CashTransaction } from '../types';
import { Modal } from './Modal';
import { printCashVoucherWindow } from '../utils/printCash';
import { printCashClosingWindow, compileCashClosingData, formatNumber } from '../utils/printCashClosing';
import { printShiftReportWindow } from '../utils/printShiftReport';
import { printCashBalancesReportWindow } from '../utils/printCashBalancesReport';
import { printDailyTransactionsReportWindow } from '../utils/printDailyTransactionsReport';
import { exportToExcel } from '../utils/excelExport';
import { TableActionButtons } from './TableActionButtons';

interface CashViewProps {
  appData: AppData;
  onUpdateData: (newData: AppData, actionInfo?: { action?: string; module?: string; details?: string; deletedId?: string | number }) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onInspectItem?: (type: string, data: any) => void;
}

export const CashView: React.FC<CashViewProps> = ({ appData, onUpdateData, showToast }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('all');
  const [selectedBranchId, setSelectedBranchId] = useState<string>(appData.activeBranchId || appData.branches?.[0]?.id || 'main');
  const [filterType, setFilterType] = useState<'all' | 'receive' | 'pay'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Daily Cash Closing Modal State
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  const [closingDate, setClosingDate] = useState(new Date().toISOString().split('T')[0]);
  const [closingOpenBalance, setClosingOpenBalance] = useState<string>('0');
  const [closingActualCash, setClosingActualCash] = useState<string>(
    (appData.cashBox?.drawer || 0).toString()
  );

  // Modal State
  const [editingTransId, setEditingTransId] = useState<number | null>(null);
  const [transType, setTransType] = useState<'receive' | 'pay'>('receive');
  const [partyMode, setPartyMode] = useState<'customer' | 'supplier' | 'general'>('customer');
  const [selectedPartyName, setSelectedPartyName] = useState('');
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<number[]>([]);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [method, setMethod] = useState<'drawer' | 'vodafone' | 'instapay' | 'bank'>('drawer');

  // Filtered transactions
  const filtered = appData.cashTransactions.filter((t) => {
    if (selectedBranchFilter !== 'all' && t.branchId && t.branchId !== selectedBranchFilter) {
      return false;
    }
    const matchType =
      filterType === 'all' ||
      (filterType === 'receive' && (t.type === 'receive' || t.type === 'deposit')) ||
      (filterType === 'pay' && (t.type === 'pay' || t.type === 'withdraw'));
    const s = searchTerm.toLowerCase();
    const matchSearch =
      t.note?.toLowerCase().includes(s) ||
      t.method.toLowerCase().includes(s) ||
      t.customerName?.toLowerCase().includes(s) ||
      t.supplierName?.toLowerCase().includes(s) ||
      (t.invoiceId && t.invoiceId.toString().includes(s));
    return matchType && matchSearch;
  });

  const handleOpenAdd = (type: 'receive' | 'pay') => {
    setEditingTransId(null);
    setSelectedBranchId(appData.activeBranchId || appData.branches?.[0]?.id || 'main');
    setTransType(type);
    setPartyMode(type === 'receive' ? 'customer' : 'supplier');
    setSelectedPartyName('');
    setSelectedInvoiceIds([]);
    setAmount('');
    setNote('');
    setMethod('drawer');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (t: CashTransaction) => {
    setEditingTransId(t.id);
    setSelectedBranchId(t.branchId || appData.activeBranchId || appData.branches?.[0]?.id || 'main');
    setTransType(t.type === 'receive' || t.type === 'deposit' ? 'receive' : 'pay');
    setPartyMode(t.customerName ? 'customer' : t.supplierName ? 'supplier' : 'general');
    setSelectedPartyName(t.customerName || t.supplierName || '');
    setSelectedInvoiceIds(t.invoiceId ? [t.invoiceId] : []);
    setAmount(t.amount.toString());
    setNote(t.note || '');
    setMethod(t.method as any || 'drawer');
    setIsModalOpen(true);
  };

  // Get active unpaid invoices based on the selected party
  const getUnpaidInvoices = () => {
    if (!selectedPartyName.trim()) return [];

    if (transType === 'receive' && partyMode === 'customer') {
      return (appData.salesInvoices || []).filter((inv: SaleInvoice) => {
        const matchName = inv.customerName.trim().toLowerCase() === selectedPartyName.trim().toLowerCase();
        const remaining = inv.remainingAmount ?? (inv.total - (inv.paidAmount || 0));
        return matchName && inv.type === 'ajel' && remaining > 0;
      });
    }

    if (transType === 'pay' && partyMode === 'supplier') {
      return (appData.purchaseInvoices || []).filter((inv: PurchaseInvoice) => {
        const matchName = inv.supplierName.trim().toLowerCase() === selectedPartyName.trim().toLowerCase();
        const remaining = inv.remainingAmount ?? (inv.total - (inv.paidAmount || 0));
        return matchName && inv.type === 'ajel' && remaining > 0;
      });
    }

    return [];
  };

  const unpaidInvoices = getUnpaidInvoices();

  // Find matched customer or supplier
  const matchedCustomer =
    partyMode === 'customer'
      ? appData.customers.find((c) => c.name.trim().toLowerCase() === selectedPartyName.trim().toLowerCase())
      : null;

  const matchedSupplier =
    partyMode === 'supplier'
      ? appData.suppliers.find((s) => s.name.trim().toLowerCase() === selectedPartyName.trim().toLowerCase())
      : null;

  // Toggle invoice selection
  const handleToggleInvoice = (invId: number, invRemaining: number) => {
    let nextSelected: number[];
    if (selectedInvoiceIds.includes(invId)) {
      nextSelected = selectedInvoiceIds.filter((id) => id !== invId);
    } else {
      nextSelected = [...selectedInvoiceIds, invId];
    }
    setSelectedInvoiceIds(nextSelected);

    // Calculate sum of selected invoices remaining amounts
    const sumRemaining = unpaidInvoices
      .filter((i) => nextSelected.includes(i.id))
      .reduce((acc, i) => acc + (i.remainingAmount ?? (i.total - (i.paidAmount || 0))), 0);

    if (sumRemaining > 0) {
      setAmount(sumRemaining.toFixed(2));
    }
  };

  // Select all unpaid invoices
  const handleSelectAllInvoices = () => {
    if (selectedInvoiceIds.length === unpaidInvoices.length) {
      setSelectedInvoiceIds([]);
      setAmount('');
    } else {
      const allIds = unpaidInvoices.map((i) => i.id);
      setSelectedInvoiceIds(allIds);
      const totalRem = unpaidInvoices.reduce(
        (acc, i) => acc + (i.remainingAmount ?? (i.total - (i.paidAmount || 0))),
        0
      );
      setAmount(totalRem.toFixed(2));
    }
  };

  const handleSaveTransaction = () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) {
      showToast('يرجى إدخال مبلغ صحيح أكبر من صفر', 'warning');
      return;
    }

    if (!method) {
      showToast('يرجى اختيار وسيلة استلام/صرف النقدية', 'error');
      return;
    }

    const currentUserObj = appData.users.find((u) => u.id === appData.currentUser) || appData.users[0];
    const currentUserName = currentUserObj?.name || 'مدير النظام';
    const today = new Date().toISOString().split('T')[0];

    const updatedData: AppData = { ...appData };
    const nextCashId = (updatedData.nextCashId || 1) + 1;

    let transactionNote = note.trim();
    let linkedInvoiceId: number | undefined = undefined;

    if (selectedInvoiceIds.length === 1) {
      linkedInvoiceId = selectedInvoiceIds[0];
    }

    // 1. Distribute payment across selected invoices (or apply directly)
    if (transType === 'receive' && partyMode === 'customer') {
      if (!selectedPartyName.trim()) {
        showToast('يرجى تحديد اسم العميل', 'warning');
        return;
      }

      // If specific invoices selected, allocate amount to settle them
      if (selectedInvoiceIds.length > 0) {
        let remainingToAllocate = val;
        updatedData.salesInvoices = (updatedData.salesInvoices || []).map((inv) => {
          if (selectedInvoiceIds.includes(inv.id) && remainingToAllocate > 0) {
            const currentRem = inv.remainingAmount ?? (inv.total - (inv.paidAmount || 0));
            const payForThis = Math.min(currentRem, remainingToAllocate);
            remainingToAllocate -= payForThis;
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

        if (!transactionNote) {
          transactionNote = `تحصيل سداد فواتير آجل (#${selectedInvoiceIds.join(', #')}) - العميل: ${selectedPartyName}`;
        }
      } else {
        if (!transactionNote) {
          transactionNote = `تحصيل دفعة على الحساب - العميل: ${selectedPartyName}`;
        }
      }

      // Update Customer Ledger Balance
      updatedData.customers = (updatedData.customers || []).map((c) => {
        if (c.name.trim().toLowerCase() === selectedPartyName.trim().toLowerCase()) {
          return {
            ...c,
            balance: (c.balance || 0) - val,
          };
        }
        return c;
      });

      // Update Cashbox
      updatedData.cashBox[method] = (updatedData.cashBox[method] || 0) + val;
    } else if (transType === 'pay' && partyMode === 'supplier') {
      if (!selectedPartyName.trim()) {
        showToast('يرجى تحديد اسم المورد', 'warning');
        return;
      }

      // If specific purchase invoices selected, allocate amount to settle them
      if (selectedInvoiceIds.length > 0) {
        let remainingToAllocate = val;
        updatedData.purchaseInvoices = (updatedData.purchaseInvoices || []).map((inv) => {
          if (selectedInvoiceIds.includes(inv.id) && remainingToAllocate > 0) {
            const currentRem = inv.remainingAmount ?? (inv.total - (inv.paidAmount || 0));
            const payForThis = Math.min(currentRem, remainingToAllocate);
            remainingToAllocate -= payForThis;
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

        if (!transactionNote) {
          transactionNote = `سداد فواتير مشتريات آجل (#${selectedInvoiceIds.join(', #')}) - المورد: ${selectedPartyName}`;
        }
      } else {
        if (!transactionNote) {
          transactionNote = `سداد دفعة على الحساب للمورد: ${selectedPartyName}`;
        }
      }

      // Update Supplier Ledger Balance
      updatedData.suppliers = (updatedData.suppliers || []).map((s) => {
        if (s.name.trim().toLowerCase() === selectedPartyName.trim().toLowerCase()) {
          return {
            ...s,
            balance: (s.balance || 0) - val,
          };
        }
        return s;
      });

      // Update Cashbox
      updatedData.cashBox[method] = (updatedData.cashBox[method] || 0) - val;
    } else {
      // General Income / Expense
      if (!transactionNote) {
        transactionNote = transType === 'receive' ? 'سند إيداع / إيراد عام' : 'سند صرف / مصروف عام';
      }
      if (transType === 'receive') {
        updatedData.cashBox[method] = (updatedData.cashBox[method] || 0) + val;
      } else {
        updatedData.cashBox[method] = (updatedData.cashBox[method] || 0) - val;
      }
    }

    if (editingTransId !== null) {
      const existingIdx = updatedData.cashTransactions.findIndex((t) => t.id === editingTransId);
      if (existingIdx !== -1) {
        const oldTrans = updatedData.cashTransactions[existingIdx];
        // Revert old cashbox
        if (oldTrans.type === 'receive' || oldTrans.type === 'deposit') {
          updatedData.cashBox[oldTrans.method] = (updatedData.cashBox[oldTrans.method] || 0) - oldTrans.amount;
        } else {
          updatedData.cashBox[oldTrans.method] = (updatedData.cashBox[oldTrans.method] || 0) + oldTrans.amount;
        }
        // Apply new cashbox
        if (transType === 'receive') {
          updatedData.cashBox[method] = (updatedData.cashBox[method] || 0) + val;
        } else {
          updatedData.cashBox[method] = (updatedData.cashBox[method] || 0) - val;
        }

        const nowIso = new Date().toISOString();
        updatedData.cashTransactions[existingIdx] = {
          ...oldTrans,
          companyId: oldTrans.companyId || appData.companyId || 'COMP-000001',
          branchId: selectedBranchId || oldTrans.branchId || appData.activeBranchId || 'main',
          type: transType,
          method: method,
          amount: val,
          note: transactionNote || oldTrans.note,
          customerName: partyMode === 'customer' ? selectedPartyName.trim() : undefined,
          supplierName: partyMode === 'supplier' ? selectedPartyName.trim() : undefined,
          invoiceId: linkedInvoiceId || oldTrans.invoiceId,
          updatedAt: nowIso,
          updatedBy: currentUserName,
        };

        onUpdateData(updatedData);
        setIsModalOpen(false);
        setEditingTransId(null);
        showToast(`تم تعديل السند #${editingTransId} وتحديث رصيد الخزينة بنجاح`, 'success');
        return;
      }
    }

    const nowIso = new Date().toISOString();
    const newTransId = updatedData.nextCashId || 1;
    const newTrans = {
      id: newTransId,
      syncId: `cash_${newTransId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      companyId: appData.companyId || 'COMP-000001',
      branchId: selectedBranchId || appData.activeBranchId || 'main',
      date: today,
      type: transType,
      method: method,
      amount: val,
      note: transactionNote,
      customerName: partyMode === 'customer' ? selectedPartyName.trim() : undefined,
      supplierName: partyMode === 'supplier' ? selectedPartyName.trim() : undefined,
      invoiceId: linkedInvoiceId,
      status: 'approved',
      createdAt: nowIso,
      updatedAt: nowIso,
      createdBy: currentUserName,
      createdByUserId: currentUserObj?.id,
      createdByUserCode: currentUserObj?.code || 1,
    };

    updatedData.nextCashId = nextCashId;
    updatedData.cashTransactions = [newTrans, ...(updatedData.cashTransactions || [])];

    onUpdateData(updatedData, {
      action: transType === 'receive' ? 'create_receipt' : 'create_payment',
      module: 'الخزينة والنقدية',
      details: `إصدار سند ${transType === 'receive' ? 'قبض' : 'صرف'} #${newTrans.id} بقيمة ${val} ج.م`,
    });
    setIsModalOpen(false);
    showToast(
      `تم إصدار سند ${transType === 'receive' ? 'القبض' : 'الصرف'} #${newTrans.id} وتحديث الأرصدة بنجاح`,
      'success'
    );
  };

  const handleDelete = (id: number) => {
    if (!confirm('هل أنت متأكد من حذف هذه المعاملة؟ سيتم التراجع عن أثرها المالي بالكامل.')) return;
    const updatedData = { ...appData };
    const idx = updatedData.cashTransactions.findIndex((t) => t.id === id);
    if (idx !== -1) {
      const t = updatedData.cashTransactions[idx];
      // 1. Revert cashbox
      if (t.type === 'receive' || t.type === 'deposit') {
        updatedData.cashBox[t.method] = (updatedData.cashBox[t.method] || 0) - t.amount;
      } else {
        updatedData.cashBox[t.method] = (updatedData.cashBox[t.method] || 0) + t.amount;
      }

      // 2. Revert customer balance if linked to customer
      if (t.customerName) {
        const cust = updatedData.customers.find((c) => c.name.trim().toLowerCase() === t.customerName?.trim().toLowerCase());
        if (cust) {
          if (t.type === 'receive') {
            cust.balance = (cust.balance || 0) + t.amount;
          } else {
            cust.balance = (cust.balance || 0) - t.amount;
          }
        }
      }

      // 3. Revert supplier balance if linked to supplier
      if (t.supplierName) {
        const supp = updatedData.suppliers.find((s) => s.name.trim().toLowerCase() === t.supplierName?.trim().toLowerCase());
        if (supp) {
          if (t.type === 'pay') {
            supp.balance = (supp.balance || 0) + t.amount;
          } else {
            supp.balance = (supp.balance || 0) - t.amount;
          }
        }
      }

      // 4. Revert linked invoice paid amount if any
      if (t.invoiceId) {
        const salesInv = updatedData.salesInvoices.find((i) => i.id === t.invoiceId);
        if (salesInv) {
          salesInv.paidAmount = Math.max(0, (salesInv.paidAmount || 0) - t.amount);
          salesInv.remainingAmount = Math.max(0, salesInv.total - (salesInv.paidAmount || 0));
        }
        const purchInv = updatedData.purchaseInvoices.find((i) => i.id === t.invoiceId);
        if (purchInv) {
          purchInv.paidAmount = Math.max(0, (purchInv.paidAmount || 0) - t.amount);
          purchInv.remainingAmount = Math.max(0, purchInv.total - (purchInv.paidAmount || 0));
        }
      }

      // 5. Record tombstone
      if (!updatedData.deletedRecords) updatedData.deletedRecords = {};
      updatedData.deletedRecords[`cashTransactions_${id}`] = Date.now();

      // 6. Remove transaction
      updatedData.cashTransactions = updatedData.cashTransactions.filter((tx) => tx.id !== id);

      onUpdateData(updatedData, {
        action: 'delete_cash',
        module: 'الخزينة والنقدية',
        details: `حذف سند نقدي #${id} وتعديل رصيد الخزينة والأطراف المعنية`,
        deletedId: id,
      });
      showToast('تم حذف السند وتعديل رصيد الخزينة وحسابات الأطراف بنجاح', 'success');
    }
  };

  const getMethodLabel = (m: string) => {
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

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col space-y-4">
      {/* Action Bar & Filter */}
      <div className="bg-white p-3 sm:p-4 rounded-xl shadow-xs border border-slate-200/90 flex flex-col xl:flex-row gap-3 items-stretch xl:items-center justify-between">
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
          <button
            onClick={() => handleOpenAdd('receive')}
            className="min-h-[40px] bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white px-3.5 py-2 rounded-lg text-xs md:text-sm font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
          >
            <ArrowDownLeft className="w-4 h-4 shrink-0" />
            <span>سند قبض (تحصيل)</span>
          </button>
          <button
            onClick={() => handleOpenAdd('pay')}
            className="min-h-[40px] bg-rose-700 hover:bg-rose-800 active:bg-rose-900 text-white px-3.5 py-2 rounded-lg text-xs md:text-sm font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
          >
            <ArrowUpRight className="w-4 h-4 shrink-0" />
            <span>سند صرف (دفع)</span>
          </button>
          <button
            onClick={() => {
              setClosingActualCash((appData.cashBox?.drawer || 0).toString());
              setIsClosingModalOpen(true);
            }}
            className="min-h-[40px] bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white px-3.5 py-2 rounded-lg text-xs md:text-sm font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
            title="تقفيل ومطابقة يومية الخزينة بكافة وسائل الدفع"
          >
            <Wallet className="w-4 h-4 shrink-0" />
            <span>تقفيل يومية الخزينة</span>
          </button>
          <button
            onClick={() => {
              printShiftReportWindow(appData, undefined, undefined, showToast);
            }}
            className="min-h-[40px] bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-2 rounded-lg text-xs md:text-sm font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
            title="طباعة تقرير ملخص الشفت والأرباح اليومية"
          >
            <BarChart3 className="w-4 h-4 shrink-0" />
            <span>ملخص الشفت والأرباح</span>
          </button>
          <button
            onClick={() => {
              printCashBalancesReportWindow(appData, showToast);
            }}
            className="min-h-[40px] bg-slate-700 hover:bg-slate-800 text-white px-3.5 py-2 rounded-lg text-xs md:text-sm font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
            title="طباعة تقرير الأرصدة النقدية ووسائل الدفع"
          >
            <Landmark className="w-4 h-4 shrink-0" />
            <span>الأرصدة ووسائل الدفع</span>
          </button>
          <TableActionButtons
            onPrint={() => {
              printDailyTransactionsReportWindow(appData, undefined, undefined, showToast);
            }}
            onExportExcel={() => {
              exportToExcel({
                filename: `حركة_الخزينة_والسندات_${new Date().toISOString().split('T')[0]}`,
                sheetName: 'سندات الخزينة',
                data: filtered,
                columns: [
                  { header: 'رقم السند', key: 'id', width: 12 },
                  { header: 'التاريخ', key: 'date', width: 14 },
                  {
                    header: 'نوع السند',
                    getValue: (item) => (item.type === 'receive' || item.type === 'deposit') ? 'سند قبض (تحصيل)' : 'سند صرف (دفع)',
                    width: 20,
                  },
                  { header: 'المبلغ (ج.م)', getValue: (item) => item.amount.toFixed(2), width: 16 },
                  {
                    header: 'وسيلة الدفع',
                    getValue: (item) => getMethodLabel(item.method),
                    width: 20,
                  },
                  {
                    header: 'الطرف المعني / الحساب',
                    getValue: (item) => item.customerName || item.supplierName || 'حساب عام',
                    width: 26,
                  },
                  { header: 'البيان والملاحظات', key: 'note', width: 30 },
                ],
                companyName: appData.settings?.companyName || 'المنظومة المحاسبية المعتمدة',
                reportTitle: 'سجل حركات وسندات الخزينة النقدية',
              });
              showToast('تم تصدير سجل الخزينة إلى Excel بنجاح', 'success');
            }}
            printTitle="طباعة سجل حركة العمليات والسندات"
            exportTitle="تصدير حركات الخزينة إلى Excel"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          {/* Type Filter Buttons */}
          <div className="flex bg-slate-100 p-1 rounded-lg gap-1 border border-slate-200">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition cursor-pointer ${
                filterType === 'all' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الكل
            </button>
            <button
              onClick={() => setFilterType('receive')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                filterType === 'receive' ? 'bg-emerald-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>سندات القبض</span>
            </button>
            <button
              onClick={() => setFilterType('pay')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                filterType === 'pay' ? 'bg-rose-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>سندات الصرف</span>
            </button>
          </div>

          <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2 min-w-[200px]">
            {appData.branches && appData.branches.length > 1 && (
              <select
                value={selectedBranchFilter}
                onChange={(e) => setSelectedBranchFilter(e.target.value)}
                className="min-h-[38px] px-3 py-1.5 border border-slate-300 bg-white text-slate-800 font-semibold rounded-lg text-xs focus:border-blue-600 focus:outline-none cursor-pointer"
              >
                <option value="all">جميع الفروع ({appData.cashTransactions?.length || 0})</option>
                {appData.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({appData.cashTransactions?.filter((t) => t.branchId === b.id).length || 0})
                  </option>
                ))}
              </select>
            )}
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="بحث برقم السند، الطرف، الفاتورة..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full min-h-[38px] pl-3 pr-8 py-1.5 border border-slate-300 rounded-lg text-xs focus:border-blue-600 focus:outline-none bg-slate-50/50"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Card List View (< md) */}
      <div className="block md:hidden space-y-2.5">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-6 text-center text-slate-400 text-xs border border-slate-200">
            لا توجد معاملات مالية مسجلة مطابقة للبحث
          </div>
        ) : (
          filtered.map((t) => {
            const isReceive = t.type === 'receive' || t.type === 'deposit';
            return (
              <div
                key={t.id}
                className="bg-white rounded-lg p-3.5 shadow-2xs border border-slate-200 space-y-2.5"
              >
                {/* Header: Type Badge & Date */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold border flex items-center gap-1 ${
                        isReceive
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}
                    >
                      {isReceive ? <ArrowDownLeft className="w-3 h-3 text-emerald-600" /> : <ArrowUpRight className="w-3 h-3 text-rose-600" />}
                      <span>{isReceive ? 'سند قبض' : 'سند صرف'} #{t.id}</span>
                    </span>
                    {t.invoiceId && (
                      <span className="bg-blue-50 text-blue-900 border border-blue-200 text-[10px] font-semibold px-1.5 py-0.5 rounded">
                        فاتورة #{t.invoiceId}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>{t.date}</span>
                  </span>
                </div>

                {/* Amount & Method */}
                <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded border border-slate-100">
                  <div>
                    <div className="text-[10px] text-slate-500">الطرف / الحساب</div>
                    <div className="font-bold text-slate-900 text-xs mt-0.5">
                      {t.customerName ? `عميل: ${t.customerName}` : t.supplierName ? `مورد: ${t.supplierName}` : 'حساب عام / مصروف'}
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5 font-medium">
                      {getMethodLabel(t.method)}
                    </div>
                  </div>
                  <div className="text-left">
                    <div className="text-[10px] text-slate-500">المبلغ المسجل</div>
                    <div className={`font-bold text-base font-mono tabular-nums ${isReceive ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {t.amount.toFixed(2)} ج.م
                    </div>
                  </div>
                </div>

                {/* Note & Creator */}
                <div className="text-xs text-slate-700 bg-slate-50/50 p-2 rounded border border-slate-100">
                  <span className="font-semibold text-slate-800">البيان: </span>
                  {t.note || '-'}
                  <div className="text-[10px] text-slate-400 mt-0.5">بواسطة: {t.createdBy || 'مدير النظام'}</div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <button
                    onClick={() => printCashVoucherWindow(t, appData, showToast)}
                    className="min-h-[36px] bg-slate-800 hover:bg-slate-900 active:bg-slate-950 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>طباعة</span>
                  </button>
                  <button
                    onClick={() => handleOpenEdit(t)}
                    className="min-h-[36px] bg-blue-50 hover:bg-blue-100 active:bg-blue-200 text-blue-800 font-semibold rounded-lg text-xs transition flex items-center justify-center gap-1 border border-blue-200 cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>تعديل</span>
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="min-h-[36px] bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 font-semibold rounded-lg text-xs transition flex items-center justify-center gap-1 border border-rose-200 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Table (>= md) */}
      <div className="hidden md:block bg-white rounded-xl shadow-xs border border-slate-200/90 overflow-x-auto">
        <table className="w-full text-right text-xs md:text-sm border-collapse">
          <thead>
            <tr className="bg-[#0f2756] text-white">
              <th className="p-3 font-semibold">رقم السند</th>
              <th className="p-3 font-semibold">التاريخ</th>
              <th className="p-3 font-semibold">النوع</th>
              <th className="p-3 font-semibold">الطرف / الحساب</th>
              {appData.branches && appData.branches.length > 1 && <th className="p-3 font-semibold">الفرع</th>}
              <th className="p-3 font-semibold">الوسيلة (الخزينة)</th>
              <th className="p-3 font-semibold">المبلغ (ج.م)</th>
              <th className="p-3 font-semibold">البيان / الفواتير المرتبطة</th>
              <th className="p-3 font-semibold">المُحرر</th>
              <th className="p-3 font-semibold">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-8 text-slate-400">
                  لا توجد معاملات مالية مسجلة
                </td>
              </tr>
            ) : (
              filtered.map((t) => {
                const isReceive = t.type === 'receive' || t.type === 'deposit';
                return (
                  <tr key={t.id} className="hover:bg-slate-50 transition">
                    <td className="p-3 font-mono font-bold text-blue-900 tabular-nums">#{t.id}</td>
                    <td className="p-3 font-mono text-slate-600 tabular-nums">{t.date}</td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${
                          isReceive
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}
                      >
                        {isReceive ? <ArrowDownLeft className="w-3 h-3 text-emerald-600" /> : <ArrowUpRight className="w-3 h-3 text-rose-600" />}
                        <span>{isReceive ? 'سند قبض' : 'سند صرف'}</span>
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-slate-900">
                      {t.customerName ? (
                        <span className="text-blue-900 font-bold">{t.customerName}</span>
                      ) : t.supplierName ? (
                        <span className="text-slate-800 font-bold">{t.supplierName}</span>
                      ) : (
                        <span className="text-slate-500">حساب عام</span>
                      )}
                    </td>
                    {appData.branches && appData.branches.length > 1 && (
                      <td className="p-3">
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {appData.branches.find((b) => b.id === t.branchId)?.name || 'الفرع الرئيسي'}
                        </span>
                      </td>
                    )}
                    <td className="p-3 text-slate-700 font-medium">{getMethodLabel(t.method)}</td>
                    <td className={`p-3 font-bold font-mono text-sm tabular-nums ${isReceive ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {t.amount.toFixed(2)}
                    </td>
                    <td className="p-3 max-w-[240px]">
                      <div className="truncate text-slate-700 font-medium" title={t.note}>
                        {t.note || '-'}
                      </div>
                      {t.invoiceId && (
                        <span className="inline-block mt-0.5 bg-blue-50 border border-blue-200 text-blue-800 text-[10px] font-semibold px-1.5 py-0.2 rounded">
                          فاتورة #{t.invoiceId}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-slate-500 text-xs">{t.createdBy || 'مدير النظام'}</td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => printCashVoucherWindow(t, appData, showToast)}
                          className="w-7 h-7 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 transition cursor-pointer flex items-center justify-center border border-slate-200"
                          title="طباعة سند"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(t)}
                          className="w-7 h-7 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 transition cursor-pointer flex items-center justify-center border border-blue-200"
                          title="تعديل السند"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="w-7 h-7 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 transition cursor-pointer flex items-center justify-center border border-rose-200"
                          title="حذف"
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

      {/* Advanced Receipt & Payment Voucher Modal */}
      <Modal
        isOpen={isModalOpen}
        title={
          editingTransId
            ? `✏️ تعديل بيانات سند رقم #${editingTransId}`
            : transType === 'receive'
            ? '💰 سند قبض نقدي جديد (تحصيل وإيراد)'
            : '💸 سند صرف نقدي جديد (سداد ومصروف)'
        }
        onClose={() => {
          setIsModalOpen(false);
          setEditingTransId(null);
        }}
        footer={
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <button
              onClick={handleSaveTransaction}
              className="min-h-[42px] bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white px-6 py-2.5 rounded-lg font-semibold text-xs sm:text-sm cursor-pointer transition shadow-xs flex-1 sm:flex-initial text-center flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>{editingTransId ? 'تحديث السند وحفظ التعديلات' : 'حفظ السند وتحديث الأرصدة'}</span>
            </button>
            <button
              onClick={() => {
                setIsModalOpen(false);
                setEditingTransId(null);
              }}
              className="min-h-[42px] bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-800 px-6 py-2.5 rounded-lg font-semibold text-xs sm:text-sm cursor-pointer transition flex-1 sm:flex-initial text-center flex items-center justify-center gap-1.5"
            >
              <X className="w-4 h-4" />
              <span>إلغاء</span>
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs md:text-sm">
          {/* Quick Top Save Bar */}
          <div className="flex justify-between items-center bg-slate-100 p-2 rounded-lg border border-slate-200">
            <span className="font-semibold text-slate-700 text-xs">
              {transType === 'receive' ? 'نموذج سند قبض' : 'نموذج سند صرف'}
            </span>
            <button
              onClick={handleSaveTransaction}
              className="bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1 rounded text-xs font-semibold transition flex items-center gap-1 shadow-xs cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>حفظ الآن</span>
            </button>
          </div>

          {appData.branches && appData.branches.length > 1 && (
            <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-200 space-y-1.5">
              <label className="block font-bold text-indigo-950 flex items-center gap-1">
                <span>🏢</span> فرع المعاملة / الخزينة:
              </label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full p-2 border-2 border-indigo-200 bg-white rounded-xl focus:border-[#1a237e] focus:outline-none text-xs md:text-sm font-bold"
              >
                {appData.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.isMain ? '(الرئيسي)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          {/* Party Mode Selection (عميل / مورد / حساب عام) */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
            <label className="block font-bold text-slate-800">نوع جهة المعاملة المالية</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {transType === 'receive' ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setPartyMode('customer');
                      setSelectedPartyName('');
                      setSelectedInvoiceIds([]);
                    }}
                    className={`p-2 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      partyMode === 'customer'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>👤</span>
                    <span>عميل (تحصيل مديونية)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPartyMode('general');
                      setSelectedPartyName('');
                      setSelectedInvoiceIds([]);
                    }}
                    className={`p-2 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      partyMode === 'general'
                        ? 'bg-[#1a237e] text-white shadow-xs'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>🏛️</span>
                    <span>إيراد عام / متنوع</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setPartyMode('supplier');
                      setSelectedPartyName('');
                      setSelectedInvoiceIds([]);
                    }}
                    className={`p-2 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      partyMode === 'supplier'
                        ? 'bg-rose-700 text-white shadow-xs'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>🏢</span>
                    <span>مورد (سداد مستحقات)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPartyMode('general');
                      setSelectedPartyName('');
                      setSelectedInvoiceIds([]);
                    }}
                    className={`p-2 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      partyMode === 'general'
                        ? 'bg-[#1a237e] text-white shadow-xs'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>🏛️</span>
                    <span>مصروف عام / تشغيلي</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Party Selection & Balance Info */}
          {partyMode === 'customer' && (
            <div className="space-y-2">
              <label className="block font-bold text-slate-800">اختر العميل</label>
              <select
                value={selectedPartyName}
                onChange={(e) => {
                  setSelectedPartyName(e.target.value);
                  setSelectedInvoiceIds([]);
                  setAmount('');
                }}
                className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none bg-white font-semibold text-xs md:text-sm"
              >
                <option value="">-- اختر عميل من القائمة --</option>
                {appData.customers.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name} (رصيد المديونية: {c.balance.toFixed(2)} ج.م)
                  </option>
                ))}
              </select>

              {matchedCustomer && (
                <div className="bg-indigo-50 border border-indigo-200 p-2.5 rounded-xl flex justify-between items-center text-xs">
                  <span className="text-indigo-900 font-bold">
                    إجمالي مديونية العميل الحالية:
                  </span>
                  <span
                    className={`font-mono font-black text-sm ${
                      matchedCustomer.balance > 0 ? 'text-rose-700' : 'text-emerald-700'
                    }`}
                  >
                    {matchedCustomer.balance.toFixed(2)} ج.م
                  </span>
                </div>
              )}
            </div>
          )}

          {partyMode === 'supplier' && (
            <div className="space-y-2">
              <label className="block font-bold text-slate-800">اختر المورد</label>
              <select
                value={selectedPartyName}
                onChange={(e) => {
                  setSelectedPartyName(e.target.value);
                  setSelectedInvoiceIds([]);
                  setAmount('');
                }}
                className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none bg-white font-semibold text-xs md:text-sm"
              >
                <option value="">-- اختر مورد من القائمة --</option>
                {appData.suppliers.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name} (رصيد المستحقات: {s.balance.toFixed(2)} ج.م)
                  </option>
                ))}
              </select>

              {matchedSupplier && (
                <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl flex justify-between items-center text-xs">
                  <span className="text-amber-900 font-bold">
                    إجمالي مستحقات المورد الحالية:
                  </span>
                  <span
                    className={`font-mono font-black text-sm ${
                      matchedSupplier.balance > 0 ? 'text-rose-700' : 'text-emerald-700'
                    }`}
                  >
                    {matchedSupplier.balance.toFixed(2)} ج.م
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Unpaid Invoices Linking Section */}
          {selectedPartyName && unpaidInvoices.length > 0 && (
            <div className="border border-indigo-200 bg-indigo-50/40 p-3 rounded-2xl space-y-2.5">
              <div className="flex justify-between items-center">
                <div className="font-bold text-[#1a237e] flex items-center gap-1.5 text-xs">
                  <span>📑</span>
                  <span>
                    الفواتير الآجلة غير المسددة ({unpaidInvoices.length} فواتير)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSelectAllInvoices}
                  className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 underline cursor-pointer"
                >
                  {selectedInvoiceIds.length === unpaidInvoices.length
                    ? 'إلغاء تحديد الكل'
                    : 'تحديد كل الفواتير'}
                </button>
              </div>

              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 divide-y divide-indigo-100">
                {unpaidInvoices.map((inv) => {
                  const rem = inv.remainingAmount ?? (inv.total - (inv.paidAmount || 0));
                  const isChecked = selectedInvoiceIds.includes(inv.id);
                  return (
                    <div
                      key={inv.id}
                      onClick={() => handleToggleInvoice(inv.id, rem)}
                      className={`p-2 rounded-xl flex items-center justify-between text-xs cursor-pointer transition ${
                        isChecked
                          ? 'bg-indigo-100/90 border border-indigo-300 font-bold'
                          : 'bg-white hover:bg-indigo-50 border border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // Handled by parent div
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                        />
                        <div>
                          <div className="font-bold text-slate-900">
                            فاتورة #{inv.id} <span className="font-mono text-slate-500 text-[11px]">({inv.date})</span>
                          </div>
                          <div className="text-[10px] text-slate-500">
                            إجمالي: {inv.total.toFixed(2)} | مسدد: {(inv.paidAmount || 0).toFixed(2)}
                          </div>
                        </div>
                      </div>
                      <div className="text-left">
                        <div className="text-[10px] text-rose-600 font-bold">المتبقي:</div>
                        <div className="font-mono font-bold text-rose-700">{rem.toFixed(2)} ج.م</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedInvoiceIds.length > 0 && (
                <div className="text-[11px] text-indigo-800 bg-white p-2 rounded-lg border border-indigo-200 flex justify-between items-center font-bold">
                  <span>تم تحديد {selectedInvoiceIds.length} فواتير لتسويتها بالسند</span>
                  <span className="text-emerald-700 font-mono">
                    المجموع:{' '}
                    {unpaidInvoices
                      .filter((i) => selectedInvoiceIds.includes(i.id))
                      .reduce((acc, i) => acc + (i.remainingAmount ?? (i.total - (i.paidAmount || 0))), 0)
                      .toFixed(2)}{' '}
                    ج.م
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Amount & Method Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold mb-1 text-slate-800">
                المبلغ المطلوب {transType === 'receive' ? 'تحصيله (قبض)' : 'صرفه (دفع)'} (ج.م) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none font-mono font-bold text-sm bg-white"
              />
            </div>

            <div>
              <label className="block font-bold mb-1 text-slate-800">وسيلة الدفع / الخزينة *</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as any)}
                className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none bg-white font-semibold text-xs md:text-sm"
              >
                <option value="drawer">💵 نقدي (الدرج / الخزينة الرئيسية)</option>
                <option value="vodafone">📱 فودافون كاش (محفظة إلكترونية)</option>
                <option value="instapay">⚡ إنستاباي (InstaPay)</option>
                <option value="bank">💳 حساب بنكي</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold mb-1 text-slate-800">البيان / الشرح التفصيلي</label>
            <input
              type="text"
              placeholder="مثال: تحصيل دفعة من العميل، سداد فاتورة توريد، مصاريف..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none bg-white text-xs md:text-sm"
            />
          </div>
        </div>
      </Modal>

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
              className="min-h-[42px] bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-800 px-5 py-2.5 rounded-lg font-semibold text-xs sm:text-sm cursor-pointer transition flex-1 sm:flex-initial text-center flex items-center justify-center gap-1.5"
            >
              <X className="w-4 h-4" />
              <span>إلغاء</span>
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs md:text-sm">
          {/* Header Description */}
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

          {/* Date and Balances Controls */}
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

            // Compute totals for quick preview
            let cashIn = 0;
            let cashOut = 0;
            let visa = 0;
            let instapay = 0;
            let voda = 0;
            let bank = 0;
            let other = 0;

            compiled.transactions.forEach((tx) => {
              const method = tx.method.toLowerCase();
              if (method.includes('كاش') || method.includes('نقدي') || method === 'drawer') {
                cashIn += tx.amountIn;
                cashOut += tx.amountOut;
              } else if (method.includes('فيزا') || method.includes('visa')) {
                visa += tx.amountIn;
              } else if (method.includes('انستاباي') || method.includes('instapay') || method.includes('إنستاباي')) {
                instapay += tx.amountIn;
              } else if (method.includes('فودافون') || method.includes('voda')) {
                voda += tx.amountIn;
              } else if (method.includes('بنك') || method.includes('bank')) {
                bank += tx.amountIn;
              } else {
                other += tx.amountIn;
              }
            });

            const digitalTotal = visa + instapay + voda + bank + other;
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
                    <div className="text-indigo-800 font-bold">إجمالي التحصيل الإلكتروني</div>
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
