import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Printer,
  FileSpreadsheet,
  Phone,
  Building2,
  Calendar,
  Clock,
  Save,
  RotateCcw,
  Pencil,
  Trash2,
  FileText,
  DollarSign,
  ArrowDownLeft,
  X,
  Share2,
  CheckCircle2,
  AlertCircle,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { AppData, Customer } from '../types';
import { calculateCustomerBalance } from '../utils/accounting';
import { printStatementWindow, compileStatementData, formatEnNumber } from '../utils/printStatement';
import { openUnifiedPrintWindow } from '../utils/printUnified';
import { exportToExcel } from '../utils/excelExport';
import { generateStatementWhatsAppMessage, openWhatsAppChat } from '../services/whatsappService';

interface CustomersManagerClassicProps {
  appData: AppData;
  onUpdateData: (newData: AppData, actionInfo?: { action?: string; module?: string; details?: string; deletedId?: string | number }) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onOpenReceiptForCustomer?: (customerName: string, customerDebt?: number) => void;
}

export const CustomersManagerClassic: React.FC<CustomersManagerClassicProps> = ({
  appData,
  onUpdateData,
  showToast,
  onOpenReceiptForCustomer,
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
  const [balanceNature, setBalanceNature] = useState<'debtor' | 'creditor' | 'balanced'>('balanced');
  const [openingBalanceInput, setOpeningBalanceInput] = useState<string>('0');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'debtor' | 'creditor' | 'balanced'>('all');

  // Statement Modal State
  const [statementCustomer, setStatementCustomer] = useState<Customer | null>(null);
  const [statementFromDate, setStatementFromDate] = useState('');
  const [statementToDate, setStatementToDate] = useState(new Date().toISOString().split('T')[0]);

  // Generate Next Auto Customer Code (e.g., CUST-001)
  const nextCustomerCode = useMemo(() => {
    const existingCodes = appData.customers
      .map((c) => {
        const num = parseInt(c.code?.replace(/\D/g, '') || c.id?.replace(/\D/g, '') || '0', 10);
        return isNaN(num) ? 0 : num;
      })
      .filter((n) => n > 0);
    const max = existingCodes.length > 0 ? Math.max(...existingCodes) : appData.customers.length;
    return `CUST-${String(max + 1).padStart(3, '0')}`;
  }, [appData.customers]);

  // Customers with live calculated balance
  const customersWithBalances = useMemo(() => {
    return appData.customers.map((c) => {
      const fin = calculateCustomerBalance(c, appData);
      return {
        ...c,
        calculatedBalance: fin.balance,
        status: fin.status,
        statusLabel: fin.statusLabel,
      };
    });
  }, [appData.customers, appData.salesInvoices, appData.cashTransactions]);

  // KPI Calculations
  const stats = useMemo(() => {
    let debtorsCount = 0;
    let debtorsTotal = 0;
    let creditorsCount = 0;
    let creditorsTotal = 0;
    let balancedCount = 0;

    customersWithBalances.forEach((c) => {
      const bal = c.calculatedBalance;
      if (bal > 0.005) {
        debtorsCount++;
        debtorsTotal += bal;
      } else if (bal < -0.005) {
        creditorsCount++;
        creditorsTotal += Math.abs(bal);
      } else {
        balancedCount++;
      }
    });

    const netReceivables = debtorsTotal - creditorsTotal;

    return {
      totalCount: customersWithBalances.length,
      debtorsCount,
      debtorsTotal,
      creditorsCount,
      creditorsTotal,
      balancedCount,
      netReceivables,
    };
  }, [customersWithBalances]);

  // Filtered List
  const filteredCustomers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return customersWithBalances.filter((c) => {
      // Balance filter
      if (balanceFilter === 'debtor' && c.calculatedBalance <= 0.005) return false;
      if (balanceFilter === 'creditor' && c.calculatedBalance >= -0.005) return false;
      if (balanceFilter === 'balanced' && Math.abs(c.calculatedBalance) > 0.005) return false;

      // Text search
      if (!q) return true;
      const matchName = c.name?.toLowerCase().includes(q);
      const matchPhone = c.phone?.toLowerCase().includes(q);
      const matchCode = (c.code || c.id)?.toLowerCase().includes(q);
      const matchAddress = c.address?.toLowerCase().includes(q);
      return matchName || matchPhone || matchCode || matchAddress;
    });
  }, [customersWithBalances, searchTerm, balanceFilter]);

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
  const handleStartEdit = (c: Customer) => {
    setEditingId(c.id);
    setName(c.name || '');
    setPhone(c.phone || '');
    const opBal = c.openingBalance ?? (c.balance || 0);
    if (opBal > 0) {
      setBalanceNature('debtor');
      setOpeningBalanceInput(Math.abs(opBal).toString());
    } else if (opBal < 0) {
      setBalanceNature('creditor');
      setOpeningBalanceInput(Math.abs(opBal).toString());
    } else {
      setBalanceNature('balanced');
      setOpeningBalanceInput('0');
    }
    setAddress(c.address || '');
    setNotes(c.notes || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Save Customer (Add / Update)
  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('يرجى كتابة اسم العميل / الشركة', 'warning');
      return;
    }

    const opNum = parseFloat(openingBalanceInput) || 0;
    const finalOpening = balanceNature === 'creditor' ? -Math.abs(opNum) : balanceNature === 'debtor' ? Math.abs(opNum) : 0;

    const currentUserObj = appData.users.find((u) => u.id === appData.currentUser) || appData.users[0];
    const nowIso = new Date().toISOString();
    const updatedData = { ...appData };

    if (editingId) {
      // Update
      const existing = updatedData.customers.find((c) => c.id === editingId);
      updatedData.customers = updatedData.customers.map((c) =>
        c.id === editingId
          ? {
              ...c,
              name: name.trim(),
              phone: phone.trim(),
              balanceType: balanceNature,
              openingBalance: finalOpening,
              address: address.trim() || undefined,
              notes: notes.trim() || undefined,
              updatedAt: nowIso,
              updatedBy: currentUserObj?.name || 'مدير النظام',
            }
          : c
      );
      onUpdateData(updatedData, {
        action: 'edit_customer',
        module: 'العملاء',
        details: `تعديل بيانات العميل: ${name.trim()}`,
      });
      showToast('تم تحديث بيانات العميل بنجاح', 'success');
    } else {
      // Add
      const newId = `CUST-${Date.now()}`;
      const newCustomer: Customer = {
        id: newId,
        code: nextCustomerCode,
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

      updatedData.customers = [newCustomer, ...(updatedData.customers || [])];
      onUpdateData(updatedData, {
        action: 'create_customer',
        module: 'العملاء',
        details: `إضافة عميل جديد: ${name.trim()} (${nextCustomerCode})`,
      });
      showToast(`تم تسجيل العميل (${name.trim()}) بنجاح بالكود ${nextCustomerCode}`, 'success');
    }

    resetForm();
  };

  // Delete Customer
  const handleDeleteCustomer = (id: string, custName: string) => {
    if (!confirm(`هل أنت متأكد من حذف حساب العميل (${custName}) نهائياً من المنظومة؟`)) return;

    const updatedData = { ...appData };
    if (!updatedData.deletedRecords) updatedData.deletedRecords = {};
    updatedData.deletedRecords[`customers_${id}`] = Date.now();
    updatedData.customers = updatedData.customers.filter((c) => c.id !== id);

    onUpdateData(updatedData, {
      action: 'delete_customer',
      module: 'العملاء',
      details: `حذف العميل: ${custName}`,
      deletedId: id,
    });
    showToast(`تم حذف العميل (${custName}) بنجاح`, 'info');
    if (editingId === id) resetForm();
  };

  // Print Full Directory
  const handlePrintCustomers = () => {
    openUnifiedPrintWindow(
      {
        reportTitle: 'دليل وحسابات العملاء المعتمدة',
        subTitle: 'سجل حسابات وأرصدة العملاء بنظام ركيزة المحاسبي',
        serial: 'CUST-DIR',
        branch: 'الإدارة المالية والمبيعات',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        kpis: [
          { title: 'إجمالي العملاء', value: `${stats.totalCount} عميل` },
          { title: 'إجمالي مديونيات العملاء', value: `${stats.debtorsTotal.toFixed(2)} ج.م` },
          { title: 'إجمالي أرصدة الدائنين', value: `${stats.creditorsTotal.toFixed(2)} ج.م` },
          { title: 'صافي مستحقات المبيعات', value: `${stats.netReceivables.toFixed(2)} ج.م` },
        ],
        columns: ['#', 'كود العميل', 'اسم العميل / الشركة', 'رقم الهاتف', 'طبيعة الحساب', 'الرصيد الفعلي (ج.م)'],
        rows: filteredCustomers.map((c, idx) => {
          const bal = c.calculatedBalance;
          const statusText = bal > 0.005 ? 'مدين (عليه)' : bal < -0.005 ? 'دائن (له)' : 'متزن';
          return [
            idx + 1,
            c.code || c.id,
            c.name,
            c.phone || '-',
            statusText,
            `${bal.toFixed(2)} ج.م`,
          ];
        }),
        summary: [
          { label: 'إجمالي المديونيات المستحقة', value: `${stats.debtorsTotal.toFixed(2)} ج.م`, isTotal: true },
        ],
        footerNote: 'تم استخراج كشف أرصدة العملاء آلياً بناء على قيود المبيعات والتحصيلات المسجلة بالنظام',
      },
      appData.settings,
      showToast
    );
  };

  // Export to Excel
  const handleExportExcel = () => {
    exportToExcel({
      filename: `دليل_العملاء_ركيزة_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'العملاء',
      data: filteredCustomers,
      columns: [
        { header: 'كود العميل', key: 'code', getValue: (item: any) => item.code || item.id, width: 14 },
        { header: 'اسم العميل / الشركة', key: 'name', width: 28 },
        { header: 'رقم الهاتف', key: 'phone', width: 18 },
        { header: 'طبيعة الحساب', key: 'statusLabel', width: 16 },
        {
          header: 'الرصيد الفعلي (ج.م)',
          key: 'calculatedBalance',
          getValue: (item: any) => item.calculatedBalance.toFixed(2),
          width: 20,
        },
        { header: 'العنوان', key: 'address', width: 26 },
      ],
      companyName: appData.settings?.companyName || 'منظومة ركيزة المحاسبية',
      reportTitle: 'دليل حسابات وأرصدة العملاء',
    });
    showToast('تم تصدير دليل العملاء إلى Excel بنجاح', 'success');
  };

  return (
    <div className="w-full flex flex-col space-y-4 text-slate-800" dir="rtl">
      {/* 🏛️ Classic Header with Live Clock - خلفية بيضاء وكتابة سوداء متناسقة مع الواجهة الرئيسية */}
      <div className="bg-white text-slate-900 rounded-xl p-3 sm:p-4 shadow-xs border-2 border-slate-200 flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shadow-2xs">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-wide text-slate-900">إدارة حسابات العملاء - ركيزة</h1>
              <span className="bg-blue-50 text-blue-800 border border-blue-200 text-[10px] px-2 py-0.5 rounded font-bold">
                👥 قسم العملاء
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5 font-medium">
              دليل العملاء، المديونيات، الأرصدة الافتتاحية، وكشوف الحسابات المعتمدة
            </p>
          </div>
        </div>

        {/* Live Digital Clock & System Badge */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-left font-mono shadow-2xs">
            <div className="flex items-center gap-1.5 text-blue-700 text-xs sm:text-sm font-bold tracking-wider">
              <Clock className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
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
        {/* Total Customers */}
        <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500">إجمالي العملاء</div>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-0.5 font-mono">
              {stats.totalCount} <span className="text-xs font-normal text-slate-500">عميل</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">مسجلين في دليل المنظومة</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Debtors (عليهم مبالغ) */}
        <div className="bg-white rounded-xl p-3 border border-rose-200/80 shadow-2xs flex items-center justify-between bg-rose-50/20">
          <div>
            <div className="text-[11px] font-semibold text-rose-700 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>عملاء مدينون (عليهم مبالغ)</span>
            </div>
            <div className="text-lg sm:text-xl font-black text-rose-700 mt-0.5 font-mono">
              {stats.debtorsTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-xs font-bold text-rose-600 mr-1">ج.م</span>
            </div>
            <div className="text-[10px] text-rose-600/80 mt-0.5">
              {stats.debtorsCount} عميل عليهم مستحقات
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-rose-100 text-rose-700 border border-rose-300 flex items-center justify-center font-bold font-mono text-sm">
            {stats.debtorsCount}
          </div>
        </div>

        {/* Creditors (لهم أرصدة) */}
        <div className="bg-white rounded-xl p-3 border border-blue-200/80 shadow-2xs flex items-center justify-between bg-blue-50/20">
          <div>
            <div className="text-[11px] font-semibold text-blue-800 flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5" />
              <span>عملاء دائنون (لهم أرصدة)</span>
            </div>
            <div className="text-lg sm:text-xl font-black text-blue-800 mt-0.5 font-mono">
              {stats.creditorsTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-xs font-bold text-blue-700 mr-1">ج.م</span>
            </div>
            <div className="text-[10px] text-blue-600 mt-0.5">
              {stats.creditorsCount} عميل لهم دفعات مقدمة
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 border border-blue-300 flex items-center justify-center font-bold font-mono text-sm">
            {stats.creditorsCount}
          </div>
        </div>

        {/* Net Receivables */}
        <div className="bg-white rounded-xl p-3 border border-emerald-200/80 shadow-2xs flex items-center justify-between bg-emerald-50/20">
          <div>
            <div className="text-[11px] font-semibold text-emerald-800">صافي مديونيات العملاء</div>
            <div className="text-lg sm:text-xl font-black text-emerald-800 mt-0.5 font-mono">
              {stats.netReceivables.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-xs font-bold text-emerald-700 mr-1">ج.م</span>
            </div>
            <div className="text-[10px] text-emerald-700 mt-0.5">
              متزن: {stats.balancedCount} عميل (رصيد صفر)
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-300 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 📝 Windows Classic Customer Registration / Edit Form */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="bg-slate-100/90 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${editingId ? 'bg-amber-500 animate-pulse' : 'bg-blue-600'}`} />
            <h2 className="text-xs sm:text-sm font-bold text-slate-800">
              {editingId ? '✏️ تعديل بيانات حساب العميل' : '➕ إضافة وتسجيل عميل جديد'}
            </h2>
            {editingId && (
              <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] px-2 py-0.5 rounded font-bold">
                وضع التعديل
              </span>
            )}
          </div>
          <div className="text-xs font-mono font-bold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded">
            الكود: {editingId ? appData.customers.find((c) => c.id === editingId)?.code || editingId : nextCustomerCode}
          </div>
        </div>

        <form onSubmit={handleSaveCustomer} className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Auto Code */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">كود العميل</label>
              <input
                type="text"
                readOnly
                value={editingId ? appData.customers.find((c) => c.id === editingId)?.code || editingId : nextCustomerCode}
                className="w-full bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-600 cursor-not-allowed select-none text-center"
              />
            </div>

            {/* Name */}
            <div className="space-y-1 sm:col-span-2">
              <label className="text-[11px] font-bold text-slate-700">
                اسم العميل أو الشركة <span className="text-rose-600 font-bold">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="أدخل الاسم التجاري أو الشخصي بالكامل..."
                className="w-full bg-white border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 rounded-lg px-3 py-1.5 text-xs text-slate-800 transition"
              />
            </div>

            {/* Phone */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">رقم الهاتف / الجوال</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="مثال: 01012345678"
                className="w-full bg-white border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-800 transition text-left"
                dir="ltr"
              />
            </div>

            {/* Balance Nature */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">طبيعة الرصيد</label>
              <select
                value={balanceNature}
                onChange={(e) => setBalanceNature(e.target.value as any)}
                className="w-full bg-white border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 transition"
              >
                <option value="balanced">متزن (رصيد صفر)</option>
                <option value="debtor">مدين (عليه مبالغ للشركة)</option>
                <option value="creditor">دائن (له رصيد مدفوع مقدماً)</option>
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
                    : 'bg-white border-slate-300 focus:border-blue-600 text-slate-900'
                }`}
                dir="ltr"
              />
            </div>
          </div>

          {/* Address & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">العنوان / المنطقة</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="المدينة، الحي، الشارع، تفاصيل المقر..."
                className="w-full bg-white border border-slate-300 focus:border-blue-600 rounded-lg px-3 py-1.5 text-xs text-slate-800 transition"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">ملاحظات الحساب</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="سقف الائتمان، المندوب المسؤول، أي تعليمات محاسبية خاصة..."
                className="w-full bg-white border border-slate-300 focus:border-blue-600 rounded-lg px-3 py-1.5 text-xs text-slate-800 transition"
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
                editingId ? 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800' : 'bg-blue-700 hover:bg-blue-800 active:bg-blue-900'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>{editingId ? 'حفظ تعديلات العميل' : 'تسجيل العميل وحفظه'}</span>
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
            className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 rounded-lg pr-9 pl-3 py-1.5 text-xs text-slate-800 transition"
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
            الكل ({customersWithBalances.length})
          </button>
          <button
            type="button"
            onClick={() => setBalanceFilter('debtor')}
            className={`px-3 py-1 rounded text-xs font-bold transition cursor-pointer ${
              balanceFilter === 'debtor' ? 'bg-rose-600 text-white shadow-2xs' : 'text-rose-700 hover:bg-rose-50'
            }`}
          >
            مدينون ({stats.debtorsCount})
          </button>
          <button
            type="button"
            onClick={() => setBalanceFilter('creditor')}
            className={`px-3 py-1 rounded text-xs font-bold transition cursor-pointer ${
              balanceFilter === 'creditor' ? 'bg-blue-600 text-white shadow-2xs' : 'text-blue-700 hover:bg-blue-50'
            }`}
          >
            دائنون ({stats.creditorsCount})
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
            onClick={handlePrintCustomers}
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

      {/* 📋 Customers Data Table (Windows Classic Grid) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-gradient-to-b from-slate-100 to-slate-200/90 text-slate-800 font-bold border-b border-slate-300 select-none">
                <th className="py-2.5 px-3 w-12 text-center border-l border-slate-300">#</th>
                <th className="py-2.5 px-3 w-28 text-center border-l border-slate-300">كود العميل</th>
                <th className="py-2.5 px-3 min-w-[200px] border-l border-slate-300">اسم العميل والشركة</th>
                <th className="py-2.5 px-3 w-36 text-center border-l border-slate-300">رقم الهاتف</th>
                <th className="py-2.5 px-3 w-32 text-center border-l border-slate-300">طبيعة الحساب</th>
                <th className="py-2.5 px-4 w-40 text-left border-l border-slate-300">الرصيد الفعلي (ج.م)</th>
                <th className="py-2.5 px-3 min-w-[220px] text-center">العمليات السريعة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-1">
                      <Users className="w-8 h-8 text-slate-300 stroke-1" />
                      <div className="font-semibold text-xs">لا يوجد عملاء يطابقون شروط البحث الحالية</div>
                      <div className="text-[11px] text-slate-400">يمكنك تسجيل عميل جديد من النموذج بالأعلى</div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c, idx) => {
                  const bal = c.calculatedBalance;
                  const isDebtor = bal > 0.005;
                  const isCreditor = bal < -0.005;
                  const isEditingThis = editingId === c.id;

                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-blue-50/50 transition-colors ${
                        isEditingThis ? 'bg-amber-50/80 font-semibold' : idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'
                      }`}
                    >
                      <td className="py-2 px-3 text-center font-mono text-slate-500 border-l border-slate-200">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-bold text-slate-700 border-l border-slate-200">
                        {c.code || c.id}
                      </td>
                      <td className="py-2 px-3 border-l border-slate-200">
                        <div className="font-bold text-slate-900">{c.name}</div>
                        {c.address && (
                          <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-xs">{c.address}</div>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-slate-600 border-l border-slate-200" dir="ltr">
                        {c.phone || '-'}
                      </td>
                      <td className="py-2 px-3 text-center border-l border-slate-200">
                        {isDebtor ? (
                          <span className="bg-rose-100 text-rose-800 border border-rose-200 text-[10px] px-2 py-0.5 rounded font-bold">
                            مدين (عليه)
                          </span>
                        ) : isCreditor ? (
                          <span className="bg-blue-100 text-blue-800 border border-blue-200 text-[10px] px-2 py-0.5 rounded font-bold">
                            دائن (له)
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
                            isDebtor
                              ? 'text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200'
                              : isCreditor
                              ? 'text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200'
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
                              setStatementCustomer(c);
                              setStatementFromDate('');
                              setStatementToDate(new Date().toISOString().split('T')[0]);
                            }}
                            title="عرض وطباعة كشف حساب تفصيلي"
                            className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-2 py-1 rounded text-[11px] font-bold transition flex items-center gap-1 border border-slate-300 cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5 text-blue-700" />
                            <span>كشف حساب</span>
                          </button>

                          {/* Quick Receipt Voucher */}
                          {onOpenReceiptForCustomer && (
                            <button
                              type="button"
                              onClick={() => onOpenReceiptForCustomer(c.name, isDebtor ? bal : undefined)}
                              title="تسجيل سند قبض وتحصيل نقدية من هذا العميل"
                              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-2 py-1 rounded text-[11px] font-bold transition flex items-center gap-1 border border-emerald-300 cursor-pointer"
                            >
                              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                              <span>سند قبض</span>
                            </button>
                          )}

                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => handleStartEdit(c)}
                            title="تعديل بيانات العميل"
                            className="p-1 rounded text-amber-700 hover:bg-amber-100 border border-transparent hover:border-amber-300 transition cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomer(c.id, c.name)}
                            title="حذف حساب العميل"
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

      {/* 📄 Interactive Statement Modal (كشف حساب تفصيلي) */}
      {statementCustomer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs z-50 flex items-center justify-center p-3 select-none animate-fade-in" dir="rtl">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="bg-white text-slate-900 px-4 py-3 flex items-center justify-between border-b-2 border-slate-200">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  كشف حساب العميل: <span className="text-blue-700 font-mono font-bold">{statementCustomer.name}</span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setStatementCustomer(null)}
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
                      statementCustomer.name,
                      'customer',
                      appData,
                      statementFromDate || undefined,
                      statementToDate || undefined
                    );
                    printStatementWindow(stData, 'customer', appData, undefined, undefined, showToast);
                  }}
                  className="bg-blue-700 hover:bg-blue-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة كشف الحساب</span>
                </button>
                {statementCustomer.phone && (
                  <button
                    type="button"
                    onClick={() => {
                      const msg = generateStatementWhatsAppMessage(
                        statementCustomer.name,
                        statementCustomer.balance || 0,
                        new Date().toISOString().split('T')[0],
                        appData.settings
                      );
                      openWhatsAppChat(statementCustomer.phone, msg);
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
                  statementCustomer.name,
                  'customer',
                  appData,
                  statementFromDate || undefined,
                  statementToDate || undefined
                );

                let running = stData.previousBalance;
                let totDebit = 0;
                let totCredit = 0;
                const rows = (stData.transactions || []).map((t) => {
                  totDebit += t.debit;
                  totCredit += t.credit;
                  running = running + t.debit - t.credit;
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
                      <div className="bg-rose-50/60 p-2.5 rounded-lg border border-rose-200">
                        <div className="text-[10px] text-rose-700 font-bold">إجمالي المدين (المبيعات)</div>
                        <div className="font-mono font-bold text-rose-700 text-sm mt-0.5">
                          {totDebit.toFixed(2)} ج.م
                        </div>
                      </div>
                      <div className="bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-200">
                        <div className="text-[10px] text-emerald-800 font-bold">إجمالي الدائن (المسدد)</div>
                        <div className="font-mono font-bold text-emerald-800 text-sm mt-0.5">
                          {totCredit.toFixed(2)} ج.م
                        </div>
                      </div>
                      <div className="bg-blue-50 p-2.5 rounded-lg border border-blue-200">
                        <div className="text-[10px] text-blue-800 font-bold">الرصيد الختامي الحالي</div>
                        <div className="font-mono font-bold text-blue-900 text-sm mt-0.5">
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
                            <th className="py-2 px-3 w-28 text-left">مدين (عليه)</th>
                            <th className="py-2 px-3 w-28 text-left">دائن (له)</th>
                            <th className="py-2 px-3 w-32 text-left">الرصيد التراكمي</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {rows.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-6 text-center text-slate-400">
                                لا توجد حركات مسجلة للعميل خلال هذه الفترة
                              </td>
                            </tr>
                          ) : (
                            rows.map((row, rIdx) => (
                              <tr key={rIdx} className={rIdx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}>
                                <td className="py-1.5 px-3 text-center font-mono text-slate-400">{rIdx + 1}</td>
                                <td className="py-1.5 px-3 text-center font-mono text-slate-600">{row.date}</td>
                                <td className="py-1.5 px-3 font-medium text-slate-800">{row.description}</td>
                                <td className="py-1.5 px-3 text-left font-mono font-bold text-rose-700" dir="ltr">
                                  {row.debit > 0 ? `${row.debit.toFixed(2)}` : '-'}
                                </td>
                                <td className="py-1.5 px-3 text-left font-mono font-bold text-emerald-700" dir="ltr">
                                  {row.credit > 0 ? `${row.credit.toFixed(2)}` : '-'}
                                </td>
                                <td className="py-1.5 px-3 text-left font-mono font-bold text-blue-900" dir="ltr">
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
                onClick={() => setStatementCustomer(null)}
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
