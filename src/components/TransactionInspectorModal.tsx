import React, { useState } from 'react';
import { AppData, SaleInvoice, PurchaseInvoice, CashTransaction, JournalEntry, Cheque, Quotation, StockTransfer, PayrollSlip, FixedAsset, ProductionOrder } from '../types';
import { openUnifiedPrintWindow } from '../utils/printUnified';
import { printCashVoucherWindow } from '../utils/printCash';
import { printChequesReport, printChequeVoucher } from '../utils/printChequesReport';
import { addAuditLog } from '../utils/storage';

export interface InspectableItem {
  type: 'sale' | 'purchase' | 'cash' | 'journal' | 'cheque' | 'quote' | 'transfer' | 'payroll' | 'asset' | 'production';
  data: any;
}

interface TransactionInspectorModalProps {
  isOpen: boolean;
  item: InspectableItem | null;
  onClose: () => void;
  appData: AppData;
  onUpdateData: (newData: AppData) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export const TransactionInspectorModal: React.FC<TransactionInspectorModalProps> = ({
  isOpen,
  item,
  onClose,
  appData,
  onUpdateData,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<'view' | 'edit' | 'audit'>('view');
  const [isDeleting, setIsDeleting] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editStatus, setEditStatus] = useState<string>('');

  if (!isOpen || !item || !item.data) return null;

  const { type, data } = item;
  const currency = appData.settings?.currencySymbol || 'ج.م';

  const getTypeTitle = () => {
    switch (type) {
      case 'sale':
        return data.type?.includes('return') ? 'فاتورة مردود مبيعات' : 'فاتورة مبيعات';
      case 'purchase':
        return data.type?.includes('return') ? 'فاتورة مردود مشتريات' : 'فاتورة مشتريات وتوريد';
      case 'cash':
        return data.type === 'receive' ? 'سند قبض نقدية' : data.type === 'pay' ? 'سند صرف نقدية' : 'حركة خزينة';
      case 'journal':
        return 'قيد يومية مزدوج';
      case 'cheque':
        return data.type === 'receivable' ? 'ورقة قبض (شيك وارد)' : 'ورقة دفع (شيك صادر)';
      case 'quote':
        return data.type === 'sale_quote' ? 'عرض سعر عميل' : 'أمر شراء مورد';
      case 'transfer':
        return 'إذن تحويل بضاعة بين المخازن';
      case 'payroll':
        return 'مسير وقسيمة راتب موظف';
      case 'asset':
        return 'سجل أصل ثابت';
      case 'production':
        return 'أمر تصنيع وتشغيل';
      default:
        return 'معاينة العملية';
    }
  };

  // Trigger Unified High-Precision Print
  const handlePrint = (isThermal: boolean = false) => {
    if (type === 'sale' || type === 'purchase') {
      const inv = data as SaleInvoice | PurchaseInvoice;
      const isSale = type === 'sale';
      openUnifiedPrintWindow(
        {
          title: isSale ? (inv.type?.includes('return') ? 'فاتورة مردود مبيعات' : 'فاتورة مبيعات ضريبية') : 'فاتورة مشتريات وتوريد',
          docNumber: inv.id,
          date: inv.date,
          time: inv.time || inv.createdAt?.substring(11, 16),
          partyLabel: isSale ? 'العميل' : 'المورد',
          partyName: isSale ? (inv as SaleInvoice).customerName : (inv as PurchaseInvoice).supplierName,
          partyPhone: inv.phone,
          notes: inv.notes,
          paymentMethod: inv.paymentMethod === 'drawer' ? 'نقدي (الخزينة)' : inv.paymentMethod === 'bank' ? 'حساب بنكي' : inv.paymentMethod,
          isThermal,
          items: inv.items?.map((it) => ({
            name: it.name,
            qty: it.qty,
            price: it.price,
            discount: it.discount,
            total: it.total,
            notes: it.notes,
          })),
          totals: [
            { label: 'المجموع قبل الضريبة:', value: inv.subtotal },
            ...(inv.discount > 0 ? [{ label: 'الخصم التجاري:', value: -inv.discount }] : []),
            ...(inv.tax > 0 ? [{ label: 'ضريبة القيمة المضافة (VAT):', value: inv.tax }] : []),
            ...(inv.withholdingTax ? [{ label: 'ضريبة الخصم من المنبع (WHT):', value: -inv.withholdingTax }] : []),
            ...(inv.fees > 0 ? [{ label: 'مصاريف وخدمات إضافية:', value: inv.fees }] : []),
            { label: 'الصافي النهائي للفاتورة:', value: inv.total, isBold: true, isHighlight: true },
            { label: 'المدفوع / المسدد:', value: inv.paidAmount || 0 },
            { label: 'المتبقي الآجل:', value: inv.remainingAmount || 0 },
          ],
        },
        appData.settings,
        showToast
      );
    } else if (type === 'cash') {
      const c = data as CashTransaction;
      if (!isThermal) {
        printCashVoucherWindow(c, appData, showToast);
      } else {
        openUnifiedPrintWindow(
          {
            title: c.type === 'receive' ? 'سند قبض نقدية رسمي' : c.type === 'pay' ? 'سند صرف نقدية رسمي' : 'إشعار حركة خزينة',
            docNumber: c.id,
            date: c.date,
            partyLabel: c.customerName ? 'استلمنا من السيد/العميل' : c.supplierName ? 'صرفنا إلى السيد/المورد' : 'الطرف المعني',
            partyName: c.customerName || c.supplierName || 'حساب عام',
            paymentMethod: c.method === 'drawer' ? 'الصندوق الرئيسي' : c.method === 'bank' ? 'البنك' : c.method,
            notes: c.note,
            isThermal,
            totals: [
              { label: 'المبلغ الإجمالي للسند:', value: c.amount, isBold: true, isHighlight: true },
            ],
          },
          appData.settings,
          showToast
        );
      }
    } else if (type === 'cheque') {
      const chq = data as Cheque;
      printChequeVoucher(chq, appData);
    } else if (type === 'payroll') {
      const p = data as PayrollSlip;
      openUnifiedPrintWindow(
        {
          title: 'قسيمة ومسير راتب موظف (Pay Slip)',
          docNumber: p.slipNumber || p.id,
          date: p.paymentDate || p.createdAt?.substring(0, 10),
          partyLabel: 'اسم الموظف',
          partyName: `${p.employeeName} (${p.department})`,
          notes: `مسير راتب شهر: ${p.month} | ${p.notes || ''}`,
          totals: [
            { label: 'الراتب الأساسي:', value: p.basicSalary },
            { label: 'البدلات والمكافآت:', value: p.allowances + p.bonuses + p.overtime },
            { label: 'إجمالي المستحق:', value: p.grossSalary },
            { label: 'الاستقطاعات والغيابات:', value: -p.deductions },
            { label: 'سداد السلف الشهرية:', value: -p.advancesDeducted },
            { label: 'صافي الراتب المستلم:', value: p.netSalary, isBold: true, isHighlight: true },
          ],
        },
        appData.settings,
        showToast
      );
    } else if (type === 'journal') {
      const j = data as any;
      openUnifiedPrintWindow(
        {
          title: 'سند وقيد يومية عامة مزدوج (Journal Voucher)',
          docNumber: j.id || j.entryNumber || '',
          date: j.date || j.createdAt?.substring(0, 10),
          partyLabel: 'البيان العام',
          partyName: j.description || j.notes || 'قيد تسوية يومية عامة',
          isThermal,
          items: j.lines?.map((l: any) => ({
            name: l.accountName || l.description || 'حساب',
            qty: l.debit > 0 ? `مدين: ${Number(l.debit).toLocaleString()}` : `دائن: ${Number(l.credit).toLocaleString()}`,
            price: l.debit > 0 ? l.debit : l.credit,
            total: l.debit > 0 ? l.debit : l.credit,
            notes: l.notes || '',
          })),
          totals: [
            { label: 'إجمالي الجانب المدين:', value: j.totalDebit || j.totalAmount || 0 },
            { label: 'إجمالي الجانب الدائن:', value: j.totalCredit || j.totalAmount || 0, isBold: true, isHighlight: true },
          ],
        },
        appData.settings,
        showToast
      );
    } else if (type === 'quote') {
      const q = data as any;
      openUnifiedPrintWindow(
        {
          title: q.type === 'purchase_order' ? 'أمر شراء وتوريد رسمي' : 'عرض أسعار تجاري معتمد (Quotation)',
          docNumber: q.quoteNumber || q.id || '',
          date: q.date || q.validUntil,
          partyLabel: q.customerName ? 'العميل المستلم' : 'المورد الموجه له',
          partyName: q.customerName || q.supplierName || '',
          partyPhone: q.phone || '',
          notes: q.notes || q.terms,
          isThermal,
          items: q.items?.map((it: any) => ({
            name: it.name,
            qty: it.qty,
            price: it.price,
            discount: it.discount,
            total: it.total,
          })),
          totals: [
            { label: 'المجموع قبل الضريبة:', value: q.subtotal || q.total },
            ...(q.tax > 0 ? [{ label: 'ضريبة القيمة المضافة:', value: q.tax }] : []),
            { label: 'الإجمالي النهائي المعتمد:', value: q.total, isBold: true, isHighlight: true },
          ],
        },
        appData.settings,
        showToast
      );
    } else if (type === 'transfer') {
      const tr = data as any;
      openUnifiedPrintWindow(
        {
          title: 'إذن تحويل ونقل مخزني بين الفروع',
          docNumber: tr.id || tr.transferNumber || '',
          date: tr.date || tr.createdAt?.substring(0, 10),
          partyLabel: 'مسار التحويل',
          partyName: `من: ${tr.fromWarehouse || 'المخزن الرئيسي'} ⬅ إلى: ${tr.toWarehouse || 'مخزن الفرع'}`,
          notes: tr.notes || `مسؤول النقل والترحيل: ${tr.createdBy || 'مدير المخازن'}`,
          isThermal,
          items: tr.items?.map((it: any) => ({
            name: it.name,
            qty: it.qty,
            price: it.cost || 0,
            total: (Number(it.qty) || 0) * (Number(it.cost) || 0),
          })),
          totals: [
            { label: 'إجمالي عدد الأصناف المحولة:', value: tr.items?.length || 0, isBold: true, isHighlight: true },
          ],
        },
        appData.settings,
        showToast
      );
    } else {
      showToast('جاري تجهيز وطباعة المستند المحاسبي...', 'info');
      openUnifiedPrintWindow(
        {
          title: getTypeTitle(),
          docNumber: data.id || data.code || data.orderNumber || data.number || '',
          date: data.date || data.createdAt?.substring(0, 10),
          partyName: data.customerName || data.supplierName || data.name || data.title || '',
          notes: data.notes || data.description || data.note || '',
          totals: data.amount || data.total ? [{ label: 'القيمة الإجمالية:', value: data.amount || data.total, isBold: true, isHighlight: true }] : undefined,
        },
        appData.settings,
        showToast
      );
    }
  };

  // Safe Deletion with Full Rollback
  const handleDelete = () => {
    let updated = { ...appData };

    if (type === 'sale') {
      const inv = data as SaleInvoice;
      // 1. Rollback stock
      if (inv.items && inv.items.length > 0) {
        updated.items = updated.items.map((it) => {
          const invItem = inv.items.find((x) => x.name === it.name || x.itemId === it.id);
          if (invItem) {
            const returnedQty = inv.type?.includes('return') ? -invItem.qty : invItem.qty;
            return { ...it, quantity: it.quantity + returnedQty };
          }
          return it;
        });
      }
      // 2. Rollback customer balance
      if (inv.customerName) {
        updated.customers = updated.customers.map((c) => {
          if (c.name === inv.customerName) {
            const netChange = (inv.remainingAmount || (inv.total - (inv.paidAmount || 0)));
            return { ...c, balance: Math.max(0, c.balance - (inv.type?.includes('return') ? -netChange : netChange)) };
          }
          return c;
        });
      }
      // 3. Rollback cash if paid
      if (inv.paidAmount && inv.paidAmount > 0) {
        const method = inv.paymentMethod === 'drawer' ? 'drawer' : 'bank';
        updated.cashBox = {
          ...updated.cashBox,
          [method]: Math.max(0, (updated.cashBox[method as keyof typeof updated.cashBox] || 0) - inv.paidAmount),
        };
      }
      // Remove invoice
      updated.salesInvoices = updated.salesInvoices.filter((x) => x.id !== inv.id);
      updated = addAuditLog(updated, 'delete', 'المبيعات', `تم حذف فاتورة مبيعات #${inv.id} للعميل ${inv.customerName} وإعادة المخزون والأرصدة.`);
    } else if (type === 'purchase') {
      const inv = data as PurchaseInvoice;
      // Rollback stock
      if (inv.items && inv.items.length > 0) {
        updated.items = updated.items.map((it) => {
          const invItem = inv.items.find((x) => x.name === it.name || x.itemId === it.id);
          if (invItem) {
            const deductedQty = inv.type?.includes('return') ? -invItem.qty : invItem.qty;
            return { ...it, quantity: Math.max(0, it.quantity - deductedQty) };
          }
          return it;
        });
      }
      // Rollback supplier balance
      if (inv.supplierName) {
        updated.suppliers = updated.suppliers.map((s) => {
          if (s.name === inv.supplierName) {
            const netChange = (inv.remainingAmount || (inv.total - (inv.paidAmount || 0)));
            return { ...s, balance: Math.max(0, s.balance - netChange) };
          }
          return s;
        });
      }
      updated.purchaseInvoices = updated.purchaseInvoices.filter((x) => x.id !== inv.id);
      updated = addAuditLog(updated, 'delete', 'المشتريات', `تم حذف فاتورة مشتريات #${inv.id} للمورد ${inv.supplierName} وتسوية الأرصدة.`);
    } else if (type === 'cash') {
      const c = data as CashTransaction;
      const methodKey = c.method === 'drawer' ? 'drawer' : c.method === 'vodafone' ? 'vodafone' : c.method === 'instapay' ? 'instapay' : 'bank';
      if (c.type === 'receive' || c.type === 'deposit') {
        updated.cashBox = { ...updated.cashBox, [methodKey]: Math.max(0, updated.cashBox[methodKey] - c.amount) };
      } else {
        updated.cashBox = { ...updated.cashBox, [methodKey]: updated.cashBox[methodKey] + c.amount };
      }
      // Rollback customer/supplier balance
      if (c.customerName) {
        updated.customers = updated.customers.map((cust) => cust.name === c.customerName ? { ...cust, balance: cust.balance + c.amount } : cust);
      }
      if (c.supplierName) {
        updated.suppliers = updated.suppliers.map((sup) => sup.name === c.supplierName ? { ...sup, balance: sup.balance + c.amount } : sup);
      }
      updated.cashTransactions = updated.cashTransactions.filter((x) => x.id !== c.id);
      updated = addAuditLog(updated, 'delete', 'الخزينة والمالية', `تم حذف سند مالي #${c.id} بقيمة ${c.amount} ${currency}.`);
    } else if (type === 'journal') {
      const j = data as JournalEntry;
      updated.journalEntries = updated.journalEntries.filter((x) => x.id !== j.id);
      updated = addAuditLog(updated, 'delete', 'القيود المزدوجة', `تم حذف قيد يومية رقم ${j.entryNumber}.`);
    } else if (type === 'cheque') {
      const chq = data as Cheque;
      updated.cheques = updated.cheques.filter((x) => x.id !== chq.id);
      updated = addAuditLog(updated, 'delete', 'الشيكات والأوراق المالية', `تم حذف الشيك رقم ${chq.chequeNumber}.`);
    } else if (type === 'quote') {
      const q = data as Quotation;
      updated.quotations = updated.quotations.filter((x) => x.id !== q.id);
      updated = addAuditLog(updated, 'delete', 'عروض الأسعار', `تم حذف عرض السعر #${q.id}.`);
    } else if (type === 'payroll') {
      const p = data as PayrollSlip;
      updated.payrollSlips = updated.payrollSlips.filter((x) => x.id !== p.id);
      updated = addAuditLog(updated, 'delete', 'الرواتب والأجور', `تم حذف مسير راتب #${p.id} للموظف ${p.employeeName}.`);
    } else if (type === 'production') {
      const prod = data as ProductionOrder;
      updated.productionOrders = updated.productionOrders.filter((x) => x.id !== prod.id);
      updated = addAuditLog(updated, 'delete', 'التصنيع', `تم حذف أمر الإنتاج رقم ${prod.orderNumber}.`);
    }

    onUpdateData(updated);
    showToast(`تم حذف العملية بنجاح وتحديث كافة الأرصدة المتأثرة`, 'success');
    setIsDeleting(false);
    onClose();
  };

  // Save quick edits (Notes, Date, Status)
  const handleSaveEdit = () => {
    let updated = { ...appData };
    if (type === 'sale') {
      updated.salesInvoices = updated.salesInvoices.map((s) =>
        s.id === data.id
          ? { ...s, notes: editNotes || s.notes, date: editDate || s.date, status: (editStatus as any) || s.status }
          : s
      );
    } else if (type === 'purchase') {
      updated.purchaseInvoices = updated.purchaseInvoices.map((p) =>
        p.id === data.id
          ? { ...p, notes: editNotes || p.notes, date: editDate || p.date, status: (editStatus as any) || p.status }
          : p
      );
    } else if (type === 'cash') {
      updated.cashTransactions = updated.cashTransactions.map((c) =>
        c.id === data.id ? { ...c, note: editNotes || c.note, date: editDate || c.date } : c
      );
    } else if (type === 'cheque') {
      updated.cheques = updated.cheques.map((c) =>
        c.id === data.id ? { ...c, notes: editNotes || c.notes, status: (editStatus as any) || c.status } : c
      );
    }

    updated = addAuditLog(updated, 'update', getTypeTitle(), `تم تعديل بيانات العملية #${data.id || data.code || ''}.`);
    onUpdateData(updated);
    showToast('تم حفظ التعديلات بنجاح', 'success');
    setActiveTab('view');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 overflow-y-auto animate-fade-in" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Modal Top Bar */}
        <div className="bg-gradient-to-r from-[#0d47a1] to-[#1a237e] text-white p-4 md:px-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔍</span>
            <div>
              <h3 className="font-black text-lg md:text-xl flex items-center gap-2">
                <span>{getTypeTitle()}</span>
                <span className="bg-amber-400 text-slate-900 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  #{data.id || data.code || data.orderNumber || data.chequeNumber || '0'}
                </span>
              </h3>
              <p className="text-xs text-blue-200 mt-0.5">
                📅 التاريخ: {data.date || data.createdAt?.substring(0, 10) || '-'} {data.time ? `| ⏰ ${data.time}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePrint(false)}
              className="bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-xs"
              title="طباعة سريعة ومباشرة للمستند"
            >
              <span>⚡</span>
              <span className="hidden sm:inline">طباعة سريعة</span>
            </button>
            <button
              onClick={onClose}
              className="bg-white/10 hover:bg-white/20 text-white rounded-full w-8 h-8 flex items-center justify-center transition cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-2 gap-2 text-xs font-bold">
          <button
            onClick={() => setActiveTab('view')}
            className={`pb-2.5 px-4 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'view' ? 'border-[#0d47a1] text-[#0d47a1]' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>📋 المعاينة الشاملة</span>
          </button>
          <button
            onClick={() => {
              setEditNotes(data.notes || data.note || '');
              setEditDate(data.date || '');
              setEditStatus(data.status || '');
              setActiveTab('edit');
            }}
            className={`pb-2.5 px-4 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'edit' ? 'border-[#0d47a1] text-[#0d47a1]' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>✏️ تعديل العملية</span>
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`pb-2.5 px-4 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'audit' ? 'border-[#0d47a1] text-[#0d47a1]' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>🛡️ سجل التتبع والتدقيق</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 md:p-6 overflow-y-auto flex-1 text-sm">
          {activeTab === 'view' && (
            <div className="space-y-5">
              {/* Key Meta Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 block">الطرف المعني:</span>
                  <strong className="text-slate-800 text-sm">
                    {data.customerName || data.supplierName || data.employeeName || data.drawerName || data.beneficiaryName || 'عام'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">طريقة السداد / الخزينة:</span>
                  <strong className="text-slate-800">
                    {data.paymentMethod === 'drawer' ? 'الخزينة النقدية' : data.paymentMethod === 'bank' ? 'البنك' : data.paymentMethod || data.method || 'آجل'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">المسؤول / المدخل:</span>
                  <strong className="text-slate-800">{data.createdBy || 'مدير النظام'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">الحالة:</span>
                  <span className="inline-block bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                    {data.status || 'معتمد'}
                  </span>
                </div>
              </div>

              {/* Items List if exists */}
              {data.items && data.items.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                    <span>📦 بنود وأصناف العملية ({data.items.length})</span>
                  </h4>
                  {/* Mobile Items Cards (< md) */}
                  <div className="block md:hidden space-y-2">
                    {data.items.map((it: any, idx: number) => (
                      <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-bold text-slate-800 break-words">{it.name}</span>
                          <span className="font-black text-slate-900 font-mono text-sm shrink-0">
                            {Number(it.total).toLocaleString()} {currency}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-500 text-[11px] pt-1 border-t border-slate-200">
                          <span>الكمية: <strong className="text-slate-800 font-mono">{it.qty}</strong></span>
                          <span>السعر: <strong className="text-slate-800 font-mono">{Number(it.price).toLocaleString()}</strong></span>
                          {it.discount > 0 && (
                            <span className="text-rose-600 font-bold">خصم: {it.discount}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Items Table (>= md) */}
                  <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 shadow-xs">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-2.5 text-center">#</th>
                          <th className="p-2.5">اسم الصنف / البيان</th>
                          <th className="p-2.5 text-center">الكمية</th>
                          <th className="p-2.5 text-left">السعر</th>
                          {data.items.some((x: any) => x.discount > 0) && <th className="p-2.5 text-left">الخصم</th>}
                          <th className="p-2.5 text-left">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.items.map((it: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2.5 text-center text-slate-400">{idx + 1}</td>
                            <td className="p-2.5 font-bold text-slate-800">{it.name}</td>
                            <td className="p-2.5 text-center font-bold">{it.qty}</td>
                            <td className="p-2.5 text-left">{Number(it.price).toLocaleString()} {currency}</td>
                            {data.items.some((x: any) => x.discount > 0) && (
                              <td className="p-2.5 text-left text-rose-600">{it.discount || 0}</td>
                            )}
                            <td className="p-2.5 text-left font-black text-slate-900">{Number(it.total).toLocaleString()} {currency}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Financial Totals Box */}
              {(data.total !== undefined || data.amount !== undefined || data.netSalary !== undefined) && (
                <div className="bg-gradient-to-br from-slate-50 to-blue-50/50 p-4 rounded-xl border border-blue-100 flex flex-wrap justify-between items-center gap-4">
                  <div className="text-xs text-slate-600 space-y-1">
                    {data.subtotal !== undefined && <div>المجموع قبل الضريبة: <strong>{Number(data.subtotal).toLocaleString()} {currency}</strong></div>}
                    {data.tax > 0 && <div>ضريبة القيمة المضافة: <strong className="text-emerald-700">{Number(data.tax).toLocaleString()} {currency}</strong></div>}
                    {data.discount > 0 && <div>الخصم التجاري: <strong className="text-rose-600">-{Number(data.discount).toLocaleString()} {currency}</strong></div>}
                    {data.paidAmount !== undefined && <div>المدفوع: <strong>{Number(data.paidAmount).toLocaleString()} {currency}</strong></div>}
                    {data.remainingAmount > 0 && <div>المتبقي الآجل: <strong className="text-amber-700">{Number(data.remainingAmount).toLocaleString()} {currency}</strong></div>}
                  </div>

                  <div className="text-left bg-white p-3.5 rounded-xl border border-blue-200 shadow-xs">
                    <span className="text-[11px] text-slate-500 font-bold block">الصافي الإجمالي النهائي</span>
                    <strong className="text-xl md:text-2xl font-black text-[#0d47a1]">
                      {Number(data.total ?? data.amount ?? data.netSalary ?? 0).toLocaleString()} {currency}
                    </strong>
                  </div>
                </div>
              )}

              {/* Notes / Description */}
              {(data.notes || data.note || data.description) && (
                <div className="bg-amber-50/70 border border-amber-200 p-3 rounded-xl text-xs text-amber-900">
                  <strong>📝 البيان والملاحظات:</strong> {data.notes || data.note || data.description}
                </div>
              )}
            </div>
          )}

          {activeTab === 'edit' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ العملية</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">حالة العملية</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs bg-white"
                >
                  <option value="approved">معتمد (Approved)</option>
                  <option value="draft">مسودة (Draft)</option>
                  <option value="cancelled">ملغي (Cancelled)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">البيان والملاحظات</label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs"
                  placeholder="أدخل أي تعديلات أو إيضاحات..."
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleSaveEdit}
                  className="bg-[#0d47a1] hover:bg-[#1a237e] text-white px-5 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
                >
                  💾 حفظ التعديلات
                </button>
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="space-y-3">
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs text-slate-700">
                🛡️ سجل الأمان وتتبع التعديلات لهذه العملية:
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                <div className="p-3 bg-white flex justify-between items-center">
                  <div>
                    <strong className="text-slate-800">إنشاء العملية الأصلية</strong>
                    <div className="text-[11px] text-slate-500">بواسطة: {data.createdBy || 'مدير النظام'}</div>
                  </div>
                  <span className="text-slate-400 font-mono">{data.createdAt || data.date || '-'}</span>
                </div>
                {appData.auditLogs
                  ?.filter((l) => l.details.includes(String(data.id || data.code || '')) || l.details.includes(data.customerName || data.supplierName || ''))
                  .map((log) => (
                    <div key={log.id} className="p-3 bg-white flex justify-between items-center">
                      <div>
                        <strong className="text-blue-900">{log.action === 'create' ? 'إضافة' : log.action === 'update' ? 'تعديل' : log.action}</strong>
                        <div className="text-[11px] text-slate-600">{log.details}</div>
                      </div>
                      <span className="text-slate-400 font-mono text-[10px]">{log.timestamp}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="bg-slate-100 p-4 px-6 border-t border-slate-200 flex flex-wrap justify-between items-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handlePrint(false)}
              className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <span>⚡</span>
              <span>طباعة سريع</span>
            </button>
            <button
              onClick={() => handlePrint(false)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <span>🖨️</span>
              <span>طباعة A4 / A5 وتصدير PDF</span>
            </button>
            <button
              onClick={() => handlePrint(true)}
              className="bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <span>🧾</span>
              <span>إيصال حراري 80mm</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {!isDeleting ? (
              <button
                onClick={() => setIsDeleting(true)}
                className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1"
              >
                <span>🗑️ حذف العملية</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 bg-rose-100 p-1.5 rounded-xl border border-rose-300">
                <span className="text-[11px] font-bold text-rose-900 px-1">تأكيد الحذف واسترجاع الأرصدة؟</span>
                <button
                  onClick={handleDelete}
                  className="bg-rose-700 hover:bg-rose-800 text-white px-3 py-1 rounded-lg text-xs font-bold cursor-pointer"
                >
                  نعم، احذف
                </button>
                <button
                  onClick={() => setIsDeleting(false)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-1 rounded-lg text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            )}

            <button
              onClick={onClose}
              className="bg-slate-300 hover:bg-slate-400 text-slate-800 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
