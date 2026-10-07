import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Search,
  Filter,
  Printer,
  FileSpreadsheet,
  Phone,
  Calendar,
  Clock,
  Save,
  RotateCcw,
  Pencil,
  Trash2,
  FileText,
  DollarSign,
  ArrowUpRight,
  X,
  Share2,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { AppData, Supplier } from '../types';
import { calculateSupplierBalance } from '../utils/accounting';
import { printStatementWindow, compileStatementData } from '../utils/printStatement';
import { openUnifiedPrintWindow } from '../utils/printUnified';
import { exportToExcel } from '../utils/excelExport';
import { generateStatementWhatsAppMessage, openWhatsAppChat } from '../services/whatsappService';

interface SuppliersManagerClassicProps {
  appData: AppData;
  onUpdateData: (newData: AppData, actionInfo?: { action?: string; module?: string; details?: string; deletedId?: string | number }) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onOpenPaymentForSupplier?: (supplierName: string, supplierPayable?: number) => void;
}

export const SuppliersManagerClassic: React.FC<SuppliersManagerClassicProps> = ({
  appData,
  onUpdateData,
  showToast,
  onOpenPaymentForSupplier,
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [balanceNature, setBalanceNature] = useState<'creditor' | 'debtor' | 'balanced'>('balanced');
  const [openingBalanceInput, setOpeningBalanceInput] = useState<string>('0');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'creditor' | 'debtor' | 'balanced'>('all');

  // Statement Modal State
  const [statementSupplier, setStatementSupplier] = useState<Supplier | null>(null);
  const [statementFromDate, setStatementFromDate] = useState('');
  const [statementToDate, setStatementToDate] = useState(new Date().toISOString().split('T')[0]);

  // Generate Next Auto Supplier Code (e.g. SUP-001)
  const nextSupplierCode = useMemo(() => {
    const existingCodes = appData.suppliers
      .map((s) => {
        const num = parseInt(s.code?.replace(/\D/g, '') || s.id?.replace(/\D/g, '') || '0', 10);
        return isNaN(num) ? 0 : num;
      })
      .filter((n) => n > 0);
    const max = existingCodes.length > 0 ? Math.max(...existingCodes) : appData.suppliers.length;
    return `SUP-${String(max + 1).padStart(3, '0')}`;
  }, [appData.suppliers]);

  // Suppliers with live calculated balance
  const suppliersWithBalances = useMemo(() => {
    return appData.suppliers.map((s) => {
      const fin = calculateSupplierBalance(s, appData);
      return {
        ...s,
        calculatedBalance: fin.balance,
        status: fin.status,
        statusLabel: fin.statusLabel,
      };
    });
  }, [appData.suppliers, appData.purchaseInvoices, appData.cashTransactions]);

  // KPI Calculations
  const stats = useMemo(() => {
    let creditorsCount = 0;
    let creditorsTotal = 0;
    let debtorsCount = 0;
    let debtorsTotal = 0;
    let balancedCount = 0;

    suppliersWithBalances.forEach((s) => {
      const bal = s.calculatedBalance;
      if (bal > 0.005) {
        // In Supplier balance: positive means payable (دائن - له رصيد واجب السداد)
        creditorsCount++;
        creditorsTotal += bal;
      } else if (bal < -0.005) {
        // Negative means supplier owes us (مدين - عليه دفعات)
        debtorsCount++;
        debtorsTotal += Math.abs(bal);
      } else {
        balancedCount++;
      }
    });

    const netPayables = creditorsTotal - debtorsTotal;

    return {
      totalCount: suppliersWithBalances.length,
      creditorsCount,
      creditorsTotal,
      debtorsCount,
      debtorsTotal,
      balancedCount,
      netPayables,
    };
  }, [suppliersWithBalances]);

  // Filtered List
  const filteredSuppliers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return suppliersWithBalances.filter((s) => {
      // Balance filter
      if (balanceFilter === 'creditor' && s.calculatedBalance <= 0.005) return false;
      if (balanceFilter === 'debtor' && s.calculatedBalance >= -0.005) return false;
      if (balanceFilter === 'balanced' && Math.abs(s.calculatedBalance) > 0.005) return false;

      // Text search
      if (!q) return true;
      const matchName = s.name?.toLowerCase().includes(q);
      const matchPhone = s.phone?.toLowerCase().includes(q);
      const matchCode = (s.code || s.id)?.toLowerCase().includes(q);
      const matchAddress = s.address?.toLowerCase().includes(q);
      return matchName || matchPhone || matchCode || matchAddress;
    });
  }, [suppliersWithBalances, searchTerm, balanceFilter]);

  // Reset Form
  const resetForm = () => {
    setEditingId(null);
    setName('');
    setPhone('');
    setBalanceNature('balanced');
    setOpeningBalanceInput('0');
    setAddress('');
    setNotes('');
  };

  // Populate Form for Edit
  const handleStartEdit = (s: Supplier) => {
    setEditingId(s.id);
    setName(s.name || '');
    setPhone(s.phone || '');
    const opBal = s.openingBalance ?? (s.balance || 0);
    if (opBal > 0) {
      setBalanceNature('creditor');
      setOpeningBalanceInput(Math.abs(opBal).toString());
    } else if (opBal < 0) {
      setBalanceNature('debtor');
      setOpeningBalanceInput(Math.abs(opBal).toString());
    } else {
      setBalanceNature('balanced');
      setOpeningBalanceInput('0');
    }
    setAddress(s.address || '');
    setNotes(s.notes || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Save Supplier (Add / Update)
  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('يرجى كتابة اسم المورد / شركة التوريد', 'warning');
      return;
    }

    const opNum = parseFloat(openingBalanceInput) || 0;
    // In Supplier accounting: creditor (له) is positive, debtor (عليه) is negative
    const finalOpening = balanceNature === 'creditor' ? Math.abs(opNum) : balanceNature === 'debtor' ? -Math.abs(opNum) : 0;

    const currentUserObj = appData.users.find((u) => u.id === appData.currentUser) || appData.users[0];
    const nowIso = new Date().toISOString();
    const updatedData = { ...appData };

    if (editingId) {
      // Update
      updatedData.suppliers = updatedData.suppliers.map((s) =>
        s.id === editingId
          ? {
              ...s,
              name: name.trim(),
              phone: phone.trim(),
              balanceType: balanceNature,
              openingBalance: finalOpening,
              address: address.trim() || undefined,
              notes: notes.trim() || undefined,
              updatedAt: nowIso,
              updatedBy: currentUserObj?.name || 'مدير النظام',
            }
          : s
      );
      onUpdateData(updatedData, {
        action: 'edit_supplier',
        module: 'الموردين',
        details: `تعديل بيانات المورد: ${name.trim()}`,
      });
      showToast('تم تحديث بيانات المورد بنجاح', 'success');
    } else {
      // Add
      const newId = `SUP-${Date.now()}`;
      const newSupplier: Supplier = {
        id: newId,
        code: nextSupplierCode,
        companyId: appData.companyId || 'COMP-000001',
        name: name.trim(),
        phone: phone.trim(),
        balance: finalOpening,
        openingBalance: finalOpening,
        balanceType: balanceNature,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
        createdAt: nowIso,
        updatedAt: nowIso,
        createdBy: currentUserObj?.name || 'مدير النظام',
        createdByUserId: currentUserObj?.id,
        createdByUserCode: currentUserObj?.code || 1,
      };

      updatedData.suppliers = [newSupplier, ...(updatedData.suppliers || [])];
      onUpdateData(updatedData, {
        action: 'create_supplier',
        module: 'الموردين',
        details: `إضافة مورد جديد: ${name.trim()} (${nextSupplierCode})`,
      });
      showToast(`تم تسجيل المورد (${name.trim()}) بنجاح بالكود ${nextSupplierCode}`, 'success');
    }

    resetForm();
  };

  // Delete Supplier
  const handleDeleteSupplier = (id: string, suppName: string) => {
    if (!confirm(`هل أنت متأكد من حذف حساب المورد (${suppName}) نهائياً من المنظومة؟`)) return;

    const updatedData = { ...appData };
    if (!updatedData.deletedRecords) updatedData.deletedRecords = {};
    updatedData.deletedRecords[`suppliers_${id}`] = Date.now();
    updatedData.suppliers = updatedData.suppliers.filter((s) => s.id !== id);

    onUpdateData(updatedData, {
      action: 'delete_supplier',
      module: 'الموردين',
      details: `حذف المورد: ${suppName}`,
      deletedId: id,
    });
    showToast(`تم حذف المورد (${suppName}) بنجاح`, 'info');
    if (editingId === id) resetForm();
  };

  // Print Full Directory
  const handlePrintSuppliers = () => {
    openUnifiedPrintWindow(
      {
        reportTitle: 'دليل وحسابات الموردين المعتمدة',
        subTitle: 'سجل حسابات وأرصدة الموردين والتوريدات بنظام ركيزة المحاسبي',
        serial: 'SUPP-DIR',
        branch: 'الإدارة المالية والمشتريات',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        kpis: [
          { title: 'إجمالي الموردين', value: `${stats.totalCount} مورد` },
          { title: 'إجمالي مستحقات الموردين', value: `${stats.creditorsTotal.toFixed(2)} ج.م` },
          { title: 'أرصدة مدينين (لنا عندهم)', value: `${stats.debtorsTotal.toFixed(2)} ج.م` },
          { title: 'صافي التزامات التوريد', value: `${stats.netPayables.toFixed(2)} ج.م` },
        ],
        columns: ['#', 'كود المورد', 'اسم المورد / الشركة', 'رقم الهاتف', 'طبيعة الحساب', 'المستحق الفعلي (ج.م)'],
        rows: filteredSuppliers.map((s, idx) => {
          const bal = s.calculatedBalance;
          const statusText = bal > 0.005 ? 'مستحق له (دائن)' : bal < -0.005 ? 'لنا مبالغ (مدين)' : 'متزن';
          return [
            idx + 1,
            s.code || s.id,
            s.name,
            s.phone || '-',
            statusText,
            `${bal.toFixed(2)} ج.م`,
          ];
        }),
        summary: [
          { label: 'إجمالي الالتزامات المستحقة للموردين', value: `${stats.creditorsTotal.toFixed(2)} ج.م`, isTotal: true },
        ],
        footerNote: 'تم استخراج كشف أرصدة الموردين آلياً بناء على قيود المشتريات والمدفوعات المسجلة بالنظام',
      },
      appData.settings,
      showToast
    );
  };

  // Export to Excel
  const handleExportExcel = () => {
    exportToExcel({
      filename: `دليل_الموردين_ركيزة_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'الموردين',
      data: filteredSuppliers,
      columns: [
        { header: 'كود المورد', key: 'code', getValue: (item: any) => item.code || item.id, width: 14 },
        { header: 'اسم المورد / الشركة', key: 'name', width: 28 },
        { header: 'رقم الهاتف', key: 'phone', width: 18 },
        { header: 'طبيعة الحساب', key: 'statusLabel', width: 18 },
        {
          header: 'المستحق الفعلي (ج.م)',
          key: 'calculatedBalance',
          getValue: (item: any) => item.calculatedBalance.toFixed(2),
          width: 20,
        },
        { header: 'العنوان', key: 'address', width: 26 },
      ],
      companyName: appData.settings?.companyName || 'منظومة ركيزة المحاسبية',
      reportTitle: 'دليل حسابات ومستحقات الموردين',
    });
    showToast('تم تصدير دليل الموردين إلى Excel بنجاح', 'success');
  };

  return (
    <div className="w-full flex flex-col space-y-4 text-slate-800" dir="rtl">
      {/* 🏛️ Classic Header with Live Clock - خلفية بيضاء وكتابة سوداء متناسقة مع الواجهة الرئيسية */}
      <div className="bg-white text-slate-900 rounded-xl p-3 sm:p-4 shadow-xs border-2 border-slate-200 flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 shadow-2xs">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-wide text-slate-900">إدارة حسابات الموردين - ركيزة</h1>
              <span className="bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] px-2 py-0.5 rounded font-bold">
                🏢 قسم الموردين
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5 font-medium">
              دليل الموردين وشركات التوريد، الالتزامات والمستحقات، وسندات الصرف
            </p>
          </div>
        </div>

        {/* Live Digital Clock & System Badge */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-left font-mono shadow-2xs">
            <div className="flex items-center gap-1.5 text-indigo-700 text-xs sm:text-sm font-bold tracking-wider">
              <Clock className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
              <span>{currentTime || '--:--:--'}</span>
            </div>
            <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5 font-semibold">
              <Calendar className="w-3 h-3 text-slate-500" />
              <span>{currentDate}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 📊 KPI Statistics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Total Suppliers */}
        <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500">إجمالي الموردين</div>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-0.5 font-mono">
              {stats.totalCount} <span className="text-xs font-normal text-slate-500">مورد</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">مسجلين في دليل التوريد</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        {/* Creditors (لهم مستحقات واجبة السداد) */}
        <div className="bg-white rounded-xl p-3 border border-blue-200/80 shadow-2xs flex items-center justify-between bg-blue-50/20">
          <div>
            <div className="text-[11px] font-semibold text-blue-800 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>موردون دائنون (لهم مستحقات)</span>
            </div>
            <div className="text-lg sm:text-xl font-black text-blue-800 mt-0.5 font-mono">
              {stats.creditorsTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-xs font-bold text-blue-700 mr-1">ج.م</span>
            </div>
            <div className="text-[10px] text-blue-600 mt-0.5">
              {stats.creditorsCount} مورد مستحق له سداد
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 border border-blue-300 flex items-center justify-center font-bold font-mono text-sm">
            {stats.creditorsCount}
          </div>
        </div>

        {/* Debtors (لنا عندهم دفعات مقدمة) */}
        <div className="bg-white rounded-xl p-3 border border-rose-200/80 shadow-2xs flex items-center justify-between bg-rose-50/20">
          <div>
            <div className="text-[11px] font-semibold text-rose-700 flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5" />
              <span>موردون مدينون (لنا دفعات عندهم)</span>
            </div>
            <div className="text-lg sm:text-xl font-black text-rose-700 mt-0.5 font-mono">
              {stats.debtorsTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-xs font-bold text-rose-600 mr-1">ج.م</span>
            </div>
            <div className="text-[10px] text-rose-600/80 mt-0.5">
              {stats.debtorsCount} مورد برصيد مسبق
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-rose-100 text-rose-700 border border-rose-300 flex items-center justify-center font-bold font-mono text-sm">
            {stats.debtorsCount}
          </div>
        </div>

        {/* Net Payables */}
        <div className="bg-white rounded-xl p-3 border border-amber-200/80 shadow-2xs flex items-center justify-between bg-amber-50/20">
          <div>
            <div className="text-[11px] font-semibold text-amber-900">صافي التزامات التوريد</div>
            <div className="text-lg sm:text-xl font-black text-amber-900 mt-0.5 font-mono">
              {stats.netPayables.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-xs font-bold text-amber-700 mr-1">ج.م</span>
            </div>
            <div className="text-[10px] text-amber-700 mt-0.5">
              متزن: {stats.balancedCount} مورد (رصيد صفر)
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 📝 Windows Classic Supplier Registration / Edit Form */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="bg-slate-100/90 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${editingId ? 'bg-amber-500 animate-pulse' : 'bg-indigo-600'}`} />
            <h2 className="text-xs sm:text-sm font-bold text-slate-800">
              {editingId ? '✏️ تعديل بيانات حساب المورد' : '➕ إضافة وتسجيل مورد جديد'}
            </h2>
            {editingId && (
              <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] px-2 py-0.5 rounded font-bold">
                وضع التعديل
              </span>
            )}
          </div>
          <div className="text-xs font-mono font-bold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded">
            الكود: {editingId ? appData.suppliers.find((s) => s.id === editingId)?.code || editingId : nextSupplierCode}
          </div>
        </div>

        <form onSubmit={handleSaveSupplier} className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Auto Code */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">كود المورد</label>
              <input
                type="text"
                readOnly
                value={editingId ? appData.suppliers.find((s) => s.id === editingId)?.code || editingId : nextSupplierCode}
                className="w-full bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-600 cursor-not-allowed select-none text-center"
              />
            </div>

            {/* Name */}
            <div className="space-y-1 sm:col-span-2">
              <label className="text-[11px] font-bold text-slate-700">
                اسم المورد أو شركة التوريد <span className="text-rose-600 font-bold">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="أدخل اسم المورد، المصنع، أو الشركة الموردة..."
                className="w-full bg-white border border-slate-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-lg px-3 py-1.5 text-xs text-slate-800 transition"
              />
            </div>

            {/* Phone */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">رقم الهاتف / الاتصال</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="مثال: 01112345678"
                className="w-full bg-white border border-slate-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-800 transition text-left"
                dir="ltr"
              />
            </div>

            {/* Balance Nature */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">طبيعة الرصيد</label>
              <select
                value={balanceNature}
                onChange={(e) => setBalanceNature(e.target.value as any)}
                className="w-full bg-white border border-slate-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 transition"
              >
                <option value="balanced">متزن (رصيد صفر)</option>
                <option value="creditor">دائن (مستحق له مبالغ واجبة السداد)</option>
                <option value="debtor">مدين (لنا دفعات ومبالغ عنده)</option>
              </select>
            </div>

            {/* Opening Balance */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">الرصيد الافتتاحي (ج.م)</label>
              <input
                type="number"
                step="any"
                min="0"
                disabled={balanceNature === 'balanced'}
                value={balanceNature === 'balanced' ? '0' : openingBalanceInput}
                onChange={(e) => setOpeningBalanceInput(e.target.value)}
                placeholder="0.00"
                className={`w-full border rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold transition text-left ${
                  balanceNature === 'balanced'
                    ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-white border-slate-300 focus:border-indigo-600 text-slate-900'
                }`}
                dir="ltr"
              />
            </div>
          </div>

          {/* Address & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">العنوان / مقر التوريد</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="مقر الشركة، المصنع، المخزن الرئيسي، المحافظة..."
                className="w-full bg-white border border-slate-300 focus:border-indigo-600 rounded-lg px-3 py-1.5 text-xs text-slate-800 transition"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">النشاط والملاحظات</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="طبيعة الأصناف الموردة، شروط السداد، المندوب المفوض..."
                className="w-full bg-white border border-slate-300 focus:border-indigo-600 rounded-lg px-3 py-1.5 text-xs text-slate-800 transition"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
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
              type="submit"
              className={`min-h-[36px] px-5 py-1.5 rounded-lg text-xs font-bold text-white transition flex items-center gap-1.5 shadow-xs cursor-pointer ${
                editingId ? 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800' : 'bg-indigo-700 hover:bg-indigo-800 active:bg-indigo-900'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>{editingId ? 'حفظ تعديلات المورد' : 'تسجيل المورد وحفظه'}</span>
            </button>
          </div>
        </form>
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
            placeholder="بحث سريع بالاسم، رقم الهاتف، الكود، أو العنوان..."
            className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-lg pr-9 pl-3 py-1.5 text-xs text-slate-800 transition"
          />
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setBalanceFilter('all')}
            className={`px-3 py-1 rounded text-xs font-bold transition cursor-pointer ${
              balanceFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الكل ({suppliersWithBalances.length})
          </button>
          <button
            type="button"
            onClick={() => setBalanceFilter('creditor')}
            className={`px-3 py-1 rounded text-xs font-bold transition cursor-pointer ${
              balanceFilter === 'creditor' ? 'bg-blue-600 text-white shadow-2xs' : 'text-blue-700 hover:bg-blue-50'
            }`}
          >
            دائنون - لهم مستحقات ({stats.creditorsCount})
          </button>
          <button
            type="button"
            onClick={() => setBalanceFilter('debtor')}
            className={`px-3 py-1 rounded text-xs font-bold transition cursor-pointer ${
              balanceFilter === 'debtor' ? 'bg-rose-600 text-white shadow-2xs' : 'text-rose-700 hover:bg-rose-50'
            }`}
          >
            مدينون - لنا عندهم ({stats.debtorsCount})
          </button>
          <button
            type="button"
            onClick={() => setBalanceFilter('balanced')}
            className={`px-3 py-1 rounded text-xs font-bold transition cursor-pointer ${
              balanceFilter === 'balanced' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            متزنون ({stats.balancedCount})
          </button>
        </div>

        {/* Action Buttons: Print & Excel */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrintSuppliers}
            className="min-h-[34px] bg-slate-800 hover:bg-slate-900 text-white px-3 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>طباعة الدليل</span>
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="min-h-[34px] bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>تصدير Excel</span>
          </button>
        </div>
      </div>

      {/* 📋 Suppliers Data Table (Windows Classic Grid) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-gradient-to-b from-slate-100 to-slate-200/90 text-slate-800 font-bold border-b border-slate-300 select-none">
                <th className="py-2.5 px-3 w-12 text-center border-l border-slate-300">#</th>
                <th className="py-2.5 px-3 w-28 text-center border-l border-slate-300">كود المورد</th>
                <th className="py-2.5 px-3 min-w-[200px] border-l border-slate-300">اسم المورد والشركة</th>
                <th className="py-2.5 px-3 w-36 text-center border-l border-slate-300">رقم الهاتف</th>
                <th className="py-2.5 px-3 w-36 text-center border-l border-slate-300">طبيعة الحساب</th>
                <th className="py-2.5 px-4 w-40 text-left border-l border-slate-300">المستحق الفعلي (ج.م)</th>
                <th className="py-2.5 px-3 min-w-[220px] text-center">العمليات السريعة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-1">
                      <Building2 className="w-8 h-8 text-slate-300 stroke-1" />
                      <div className="font-semibold text-xs">لا يوجد موردون يطابقون شروط البحث الحالية</div>
                      <div className="text-[11px] text-slate-400">يمكنك تسجيل مورد جديد من النموذج بالأعلى</div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((s, idx) => {
                  const bal = s.calculatedBalance;
                  const isCreditor = bal > 0.005; // Supplier has credit (مستحق له)
                  const isDebtor = bal < -0.005; // Supplier owes us (لنا مبالغ عنده)
                  const isEditingThis = editingId === s.id;

                  return (
                    <tr
                      key={s.id}
                      className={`hover:bg-indigo-50/40 transition-colors ${
                        isEditingThis ? 'bg-amber-50/80 font-semibold' : idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'
                      }`}
                    >
                      <td className="py-2 px-3 text-center font-mono text-slate-500 border-l border-slate-200">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-bold text-slate-700 border-l border-slate-200">
                        {s.code || s.id}
                      </td>
                      <td className="py-2 px-3 border-l border-slate-200">
                        <div className="font-bold text-slate-900">{s.name}</div>
                        {s.address && (
                          <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-xs">{s.address}</div>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-slate-600 border-l border-slate-200" dir="ltr">
                        {s.phone || '-'}
                      </td>
                      <td className="py-2 px-3 text-center border-l border-slate-200">
                        {isCreditor ? (
                          <span className="bg-blue-100 text-blue-800 border border-blue-200 text-[10px] px-2 py-0.5 rounded font-bold">
                            دائن (مستحق له)
                          </span>
                        ) : isDebtor ? (
                          <span className="bg-rose-100 text-rose-800 border border-rose-200 text-[10px] px-2 py-0.5 rounded font-bold">
                            مدين (لنا عنده)
                          </span>
                        ) : (
                          <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] px-2 py-0.5 rounded font-bold">
                            متزن (0.00)
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-4 text-left font-mono font-bold text-xs border-l border-slate-200" dir="ltr">
                        <span
                          className={
                            isCreditor
                              ? 'text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200'
                              : isDebtor
                              ? 'text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200'
                              : 'text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200'
                          }
                        >
                          {bal.toFixed(2)} ج.م
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Statement Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setStatementSupplier(s);
                              setStatementFromDate('');
                              setStatementToDate(new Date().toISOString().split('T')[0]);
                            }}
                            title="عرض وطباعة كشف حساب تفصيلي"
                            className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-2 py-1 rounded text-[11px] font-bold transition flex items-center gap-1 border border-slate-300 cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5 text-indigo-700" />
                            <span>كشف حساب</span>
                          </button>

                          {/* Quick Payment Voucher */}
                          {onOpenPaymentForSupplier && (
                            <button
                              type="button"
                              onClick={() => onOpenPaymentForSupplier(s.name, isCreditor ? bal : undefined)}
                              title="تسجيل سند صرف وسداد دفعة لهذا المورد"
                              className="bg-amber-50 hover:bg-amber-100 text-amber-900 px-2 py-1 rounded text-[11px] font-bold transition flex items-center gap-1 border border-amber-300 cursor-pointer"
                            >
                              <DollarSign className="w-3.5 h-3.5 text-amber-700" />
                              <span>سند صرف</span>
                            </button>
                          )}

                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => handleStartEdit(s)}
                            title="تعديل بيانات المورد"
                            className="p-1 rounded text-amber-700 hover:bg-amber-100 border border-transparent hover:border-amber-300 transition cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteSupplier(s.id, s.name)}
                            title="حذف حساب المورد"
                            className="p-1 rounded text-rose-700 hover:bg-rose-100 border border-transparent hover:border-rose-300 transition cursor-pointer"
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

      {/* 📄 Interactive Statement Modal (كشف حساب تفصيلي للمورد) */}
      {statementSupplier && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs z-50 flex items-center justify-center p-3 select-none animate-fade-in" dir="rtl">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="bg-white text-slate-900 px-4 py-3 flex items-center justify-between border-b-2 border-slate-200">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  كشف حساب المورد: <span className="text-indigo-700 font-mono font-bold">{statementSupplier.name}</span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setStatementSupplier(null)}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filter Date Range & Print Bar */}
            <div className="bg-slate-50 border-b border-slate-200 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-600">من تاريخ:</span>
                  <input
                    type="date"
                    value={statementFromDate}
                    onChange={(e) => setStatementFromDate(e.target.value)}
                    className="border border-slate-300 rounded px-2 py-1 text-xs bg-white text-slate-800"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-600">إلى تاريخ:</span>
                  <input
                    type="date"
                    value={statementToDate}
                    onChange={(e) => setStatementToDate(e.target.value)}
                    className="border border-slate-300 rounded px-2 py-1 text-xs bg-white text-slate-800"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const stData = compileStatementData(
                      statementSupplier.name,
                      'supplier',
                      appData,
                      statementFromDate || undefined,
                      statementToDate || undefined
                    );
                    printStatementWindow(stData, 'supplier', appData, undefined, undefined, showToast);
                  }}
                  className="bg-indigo-700 hover:bg-indigo-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة كشف الحساب</span>
                </button>
                {statementSupplier.phone && (
                  <button
                    type="button"
                    onClick={() => {
                      const msg = generateStatementWhatsAppMessage(
                        statementSupplier.name,
                        statementSupplier.balance || 0,
                        new Date().toISOString().split('T')[0],
                        appData.settings
                      );
                      openWhatsAppChat(statementSupplier.phone, msg);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>مشاركة واتساب</span>
                  </button>
                )}
              </div>
            </div>

            {/* Statement Preview Body */}
            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {(() => {
                const stData = compileStatementData(
                  statementSupplier.name,
                  'supplier',
                  appData,
                  statementFromDate || undefined,
                  statementToDate || undefined
                );

                let running = stData.previousBalance;
                let totCredit = 0;
                let totDebit = 0;
                const rows = (stData.transactions || []).map((t) => {
                  totDebit += t.debit;
                  totCredit += t.credit;
                  // For supplier: credit increases payable (له), debit decreases payable (سداد له)
                  running = running + t.credit - t.debit;
                  return {
                    ...t,
                    runningBalance: running,
                  };
                });

                return (
                  <div className="space-y-3">
                    {/* Summary Header Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                        <div className="text-[10px] text-slate-500">رصيد أول المدة</div>
                        <div className="font-mono font-bold text-slate-800 text-sm mt-0.5">
                          {stData.previousBalance.toFixed(2)} ج.م
                        </div>
                      </div>
                      <div className="bg-blue-50/60 p-2.5 rounded-lg border border-blue-200">
                        <div className="text-[10px] text-blue-800 font-bold">إجمالي التوريدات (الدائن)</div>
                        <div className="font-mono font-bold text-blue-900 text-sm mt-0.5">
                          {totCredit.toFixed(2)} ج.م
                        </div>
                      </div>
                      <div className="bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-200">
                        <div className="text-[10px] text-emerald-800 font-bold">إجمالي المسدد (المدين)</div>
                        <div className="font-mono font-bold text-emerald-800 text-sm mt-0.5">
                          {totDebit.toFixed(2)} ج.م
                        </div>
                      </div>
                      <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                        <div className="text-[10px] text-amber-900 font-bold">صافي المستحق الختامي</div>
                        <div className="font-mono font-bold text-amber-900 text-sm mt-0.5">
                          {running.toFixed(2)} ج.م
                        </div>
                      </div>
                    </div>

                    {/* Transactions Table */}
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-right border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                            <th className="py-2 px-3 w-10 text-center">#</th>
                            <th className="py-2 px-3 w-24 text-center">التاريخ</th>
                            <th className="py-2 px-3">البيان والشرح</th>
                            <th className="py-2 px-3 w-28 text-left">مدين (سداد لنا)</th>
                            <th className="py-2 px-3 w-28 text-left">دائن (توريد له)</th>
                            <th className="py-2 px-3 w-32 text-left">الرصيد التراكمي</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {rows.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-6 text-center text-slate-400">
                                لا توجد حركات مسجلة للمورد خلال هذه الفترة
                              </td>
                            </tr>
                          ) : (
                            rows.map((row, rIdx) => (
                              <tr key={rIdx} className={rIdx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}>
                                <td className="py-1.5 px-3 text-center font-mono text-slate-400">{rIdx + 1}</td>
                                <td className="py-1.5 px-3 text-center font-mono text-slate-600">{row.date}</td>
                                <td className="py-1.5 px-3 font-medium text-slate-800">{row.description}</td>
                                <td className="py-1.5 px-3 text-left font-mono font-bold text-emerald-700" dir="ltr">
                                  {row.debit > 0 ? `${row.debit.toFixed(2)}` : '-'}
                                </td>
                                <td className="py-1.5 px-3 text-left font-mono font-bold text-blue-700" dir="ltr">
                                  {row.credit > 0 ? `${row.credit.toFixed(2)}` : '-'}
                                </td>
                                <td className="py-1.5 px-3 text-left font-mono font-bold text-slate-900" dir="ltr">
                                  {row.runningBalance.toFixed(2)} ج.م
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-100 border-t border-slate-200 px-4 py-2.5 flex justify-end">
              <button
                type="button"
                onClick={() => setStatementSupplier(null)}
                className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
