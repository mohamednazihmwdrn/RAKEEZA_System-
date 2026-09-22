import React, { useState } from 'react';
import { AppData, SalesRepresentative, CommissionRecord, Customer } from '../types';
import { addAuditLog } from '../utils/storage';
import { openUnifiedPrintWindow } from '../utils/printUnified';
import { exportToExcel } from '../utils/excelExport';
import { TableActionButtons } from './TableActionButtons';

interface SalesRepsCommissionsViewProps {
  appData: AppData;
  onUpdateData: (newData: AppData) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onInspectItem?: (type: any, data: any) => void;
}

export const SalesRepsCommissionsView: React.FC<SalesRepsCommissionsViewProps> = ({
  appData,
  onUpdateData,
  showToast,
  onInspectItem,
}) => {
  const [activeTab, setActiveTab] = useState<'reps' | 'commissions' | 'credit_limits'>('reps');
  const [isRepModalOpen, setIsRepModalOpen] = useState(false);
  const [editingRepId, setEditingRepId] = useState<string | null>(null);

  // Rep Form
  const [repName, setRepName] = useState('');
  const [repPhone, setRepPhone] = useState('');
  const [repType, setRepType] = useState<SalesRepresentative['commissionType']>('percentage_of_sales');
  const [repRate, setRepRate] = useState<number>(3);
  const [repTarget, setRepTarget] = useState<number>(100000);

  // Credit Limit Edit Modal
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [custCreditLimit, setCustCreditLimit] = useState<number>(0);
  const [custGraceDays, setCustGraceDays] = useState<number>(30);

  const currency = appData.settings?.currencySymbol || 'ج.م';
  const reps = appData.salesReps || [];
  const commissions = appData.commissionRecords || [];
  const salesInvoices = appData.salesInvoices || [];
  const customers = appData.customers || [];

  // Recalculate Performance Metrics per Rep from Sales Invoices
  const repsWithMetrics = reps.map((rep) => {
    const repInvoices = salesInvoices.filter((inv) => inv.salesRepId === rep.id || inv.createdBy?.includes(rep.name));
    const totalSales = repInvoices.reduce((acc, inv) => acc + (inv.type?.includes('return') ? -inv.total : inv.total), 0);
    const repCommissions = commissions.filter((c) => c.salesRepId === rep.id);
    const totalCommissionEarned = repCommissions.reduce((acc, c) => acc + c.commissionAmount, 0);
    const paidCommission = repCommissions.filter((c) => c.status === 'paid').reduce((acc, c) => acc + c.commissionAmount, 0);
    const pendingCommission = totalCommissionEarned - paidCommission;
    const achievementRate = rep.targetSales > 0 ? Math.min(100, Math.round((totalSales / rep.targetSales) * 100)) : 100;

    return {
      ...rep,
      invoicesCount: repInvoices.length,
      totalSales,
      totalCommissionEarned,
      paidCommission,
      pendingCommission,
      achievementRate,
    };
  });

  // Pay Commission Settlement
  const handlePayCommission = (record: CommissionRecord) => {
    if (record.status === 'paid') return;

    const commAmt = record.commissionAmount ?? record.amount ?? 0;
    let updated: AppData = {
      ...appData,
      commissionRecords: (appData.commissionRecords || []).map((c) =>
        c.id === record.id ? { ...c, status: 'paid' as const, paymentDate: new Date().toISOString().substring(0, 10) } : c
      ),
      cashBox: {
        ...appData.cashBox,
        drawer: Math.max(0, appData.cashBox.drawer - commAmt),
      },
    };

    updated = addAuditLog(
      updated,
      'create',
      'العمولات والمبيعات',
      `تم صرف وتسوية عمولة للمندوب ${record.salesRepName || record.repName} بمبلغ ${commAmt} ${currency}.`
    );

    onUpdateData(updated);
    showToast(`تم صرف عمولة المندوب ${record.salesRepName} بنجاح`, 'success');
  };

  // Save Rep
  const handleSaveRep = () => {
    if (!repName.trim()) {
      showToast('يرجى إدخال اسم مندوب المبيعات', 'warning');
      return;
    }

    let updated = { ...appData };
    if (editingRepId) {
      updated.salesReps = updated.salesReps.map((r) =>
        r.id === editingRepId
          ? {
              ...r,
              name: repName,
              phone: repPhone,
              commissionType: repType,
              commissionRate: Number(repRate),
              targetSales: Number(repTarget),
            }
          : r
      );
      showToast('تم تحديث بيانات المندوب بنجاح', 'success');
    } else {
      const newRep: SalesRepresentative = {
        id: `rep-${Date.now()}`,
        code: `REP-${String(reps.length + 1).padStart(3, '0')}`,
        name: repName,
        phone: repPhone,
        commissionType: repType,
        commissionRate: Number(repRate),
        targetSales: Number(repTarget),
        targetPeriod: 'monthly',
        status: 'active',
        totalSalesAchieved: 0,
        totalCommissionsEarned: 0,
      };
      updated.salesReps = [newRep, ...updated.salesReps];
      showToast('تمت إضافة مندوب المبيعات بنجاح', 'success');
    }

    onUpdateData(updated);
    setIsRepModalOpen(false);
  };

  // Save Customer Credit Limit
  const handleSaveCreditLimit = () => {
    if (!editingCustomer) return;
    let updated = {
      ...appData,
      customers: appData.customers.map((c) =>
        c.id === editingCustomer.id
          ? {
              ...c,
              creditLimit: Number(custCreditLimit),
              paymentGracePeriodDays: Number(custGraceDays),
            }
          : c
      ),
    };
    updated = addAuditLog(
      updated,
      'update',
      'سقف الائتمان',
      `تم تعديل سقف الائتمان للعميل ${editingCustomer.name} إلى ${custCreditLimit} ${currency}.`
    );
    onUpdateData(updated);
    showToast(`تم حفظ سقف الائتمان للعميل ${editingCustomer.name}`, 'success');
    setEditingCustomer(null);
  };

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap justify-between items-center gap-4">
        <div>
          <h3 className="text-lg font-black text-[#1a237e] flex items-center gap-2">
            <span>🎯 إدارة مندوبي المبيعات، العمولات، وسقوف الائتمان</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            متابعة تارجت المندوبين، احتساب العمولات التلقائي عند البيع، وإدارة حدود الائتمان للعملاء.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditingRepId(null);
              setRepName('');
              setRepPhone('');
              setRepRate(3);
              setRepTarget(150000);
              setIsRepModalOpen(true);
            }}
            className="bg-[#1a237e] hover:bg-[#0d47a1] text-white px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-xs"
          >
            <span>➕ إضافة مندوب مبيعات</span>
          </button>
          <TableActionButtons
            onPrint={() => {
              if (activeTab === 'commissions') {
                openUnifiedPrintWindow(
                  {
                    title: 'سجل حركات وعمولات مندوبي المبيعات',
                    partyLabel: 'إجمالي السجلات',
                    partyName: `${commissions.length} حركة عمولة`,
                    items: commissions.map((c) => ({
                      name: `${c.salesRepName} (فاتورة #${c.invoiceNumber})`,
                      unit: `${c.rate}% عمولة`,
                      qty: 1,
                      price: c.invoiceAmount,
                      total: c.commissionAmount,
                      notes: `الحالة: ${c.status === 'paid' ? 'تم الصرف والتسوية' : 'مستحق ومعلق'} | التاريخ: ${c.paymentDate || '-'}`,
                    })),
                    totals: [
                      {
                        label: 'إجمالي العمولات:',
                        value: commissions.reduce((a, b) => a + (b.commissionAmount || 0), 0),
                        isBold: true,
                        isHighlight: true,
                      },
                    ],
                  },
                  appData.settings,
                  showToast
                );
              } else if (activeTab === 'credit_limits') {
                openUnifiedPrintWindow(
                  {
                    title: 'تقرير حدود وسقوف ائتمان العملاء وفترات السداد',
                    partyLabel: 'عدد العملاء',
                    partyName: `${customers.length} عميل`,
                    items: customers.map((c) => ({
                      name: c.name,
                      unit: `${c.creditPeriodDays || 0} يوم سداد`,
                      qty: 1,
                      price: c.creditLimit || 0,
                      total: c.balance || 0,
                      notes: `الحد: ${(c.creditLimit || 0).toLocaleString()} | المديونية: ${(c.balance || 0).toLocaleString()} ${currency}`,
                    })),
                    totals: [
                      {
                        label: 'إجمالي أرصدة مديونيات العملاء:',
                        value: customers.reduce((a, b) => a + (b.balance || 0), 0),
                        isBold: true,
                        isHighlight: true,
                      },
                    ],
                  },
                  appData.settings,
                  showToast
                );
              } else {
                openUnifiedPrintWindow(
                  {
                    title: 'تقرير أداء مندوبي المبيعات والعمولات المستحقة',
                    items: repsWithMetrics.map((r) => ({
                      name: `${r.name} (${r.code})`,
                      unit: `${r.commissionRate}% عمولة`,
                      qty: r.invoicesCount,
                      price: r.totalSales,
                      total: r.totalCommissionEarned,
                      notes: `المحقق: ${r.achievementRate}% من التارجت | المعلق: ${r.pendingCommission} ${currency}`,
                    })),
                    totals: [
                      {
                        label: 'إجمالي مبيعات المندوبين:',
                        value: repsWithMetrics.reduce((a, b) => a + b.totalSales, 0),
                      },
                      {
                        label: 'إجمالي العمولات المستحقة:',
                        value: repsWithMetrics.reduce((a, b) => a + b.totalCommissionEarned, 0),
                        isBold: true,
                        isHighlight: true,
                      },
                    ],
                  },
                  appData.settings,
                  showToast
                );
              }
            }}
            onExportExcel={() => {
              if (activeTab === 'commissions') {
                exportToExcel({
                  filename: `سجل_عمولات_المندوبين_${new Date().toISOString().split('T')[0]}`,
                  sheetName: 'سجل العمولات',
                  data: commissions,
                  columns: [
                    { header: 'اسم المندوب', key: 'salesRepName', width: 25 },
                    { header: 'رقم الفاتورة', key: 'invoiceNumber', width: 16 },
                    { header: 'قيمة الفاتورة (ج.م)', getValue: (c: any) => (c.invoiceAmount || 0).toFixed(2), width: 18 },
                    { header: 'نسبة العمولة', getValue: (c: any) => `${c.rate}%`, width: 14 },
                    { header: 'مبلغ العمولة المستحق (ج.م)', getValue: (c: any) => (c.commissionAmount || 0).toFixed(2), width: 20 },
                    { header: 'حالة الصرف', getValue: (c: any) => c.status === 'paid' ? 'تم الصرف' : 'مستحق ومعلق', width: 16 },
                    { header: 'تاريخ الصرف', getValue: (c: any) => c.paymentDate || '-', width: 16 },
                  ],
                  companyName: appData.settings?.companyName || 'المنظومة المحاسبية المعتمدة',
                  reportTitle: 'سجل عمولات مبيعات المندوبين وحالة التسوية المالية',
                });
                showToast('تم تصدير سجل العمولات إلى Excel بنجاح', 'success');
              } else if (activeTab === 'credit_limits') {
                exportToExcel({
                  filename: `حدود_ائتمان_العملاء_${new Date().toISOString().split('T')[0]}`,
                  sheetName: 'حدود الائتمان',
                  data: customers,
                  columns: [
                    { header: 'اسم العميل', key: 'name', width: 25 },
                    { header: 'رقم الهاتف', key: 'phone', width: 16 },
                    { header: 'سقف الائتمان المسموح (ج.م)', getValue: (c: any) => (c.creditLimit || 0).toFixed(2), width: 22 },
                    { header: 'الرصيد الحالي / المديونية (ج.م)', getValue: (c: any) => (c.balance || 0).toFixed(2), width: 22 },
                    { header: 'فترة الائتمان (أيام)', getValue: (c: any) => c.creditPeriodDays || 0, width: 18 },
                  ],
                  companyName: appData.settings?.companyName || 'المنظومة المحاسبية المعتمدة',
                  reportTitle: 'كشف حدود وسقوف ائتمان العملاء وفترات السداد',
                });
                showToast('تم تصدير حدود ائتمان العملاء إلى Excel بنجاح', 'success');
              } else {
                exportToExcel({
                  filename: `تقرير_مندوبي_المبيعات_${new Date().toISOString().split('T')[0]}`,
                  sheetName: 'مندوبو المبيعات والعمولات',
                  data: repsWithMetrics,
                  columns: [
                    { header: 'كود المندوب', key: 'code', width: 14 },
                    { header: 'اسم المندوب', key: 'name', width: 25 },
                    { header: 'رقم الهاتف', key: 'phone', width: 16 },
                    { header: 'نسبة/قيمة العمولة', getValue: (r: any) => `${r.commissionRate}%`, width: 16 },
                    { header: 'المبيعات المستهدفة (التارجت)', getValue: (r: any) => (r.targetSales || 0).toFixed(2), width: 22 },
                    { header: 'إجمالي المبيعات المحققة', getValue: (r: any) => (r.totalSales || 0).toFixed(2), width: 22 },
                    { header: 'نسبة تحقيق التارجت', getValue: (r: any) => `${r.achievementRate}%`, width: 18 },
                    { header: 'إجمالي العمولات المكتسبة', getValue: (r: any) => (r.totalCommissionEarned || 0).toFixed(2), width: 22 },
                    { header: 'العمولات المعلقة/غير المسددة', getValue: (r: any) => (r.pendingCommission || 0).toFixed(2), width: 22 },
                  ],
                  companyName: appData.settings?.companyName || 'المنظومة المحاسبية المعتمدة',
                  reportTitle: 'تقرير أداء مندوبي المبيعات ونسب تحقيق التارجت والعمولات المستحقة',
                });
                showToast('تم تصدير تقرير المندوبين والعمولات إلى Excel بنجاح', 'success');
              }
            }}
            printTitle={activeTab === 'commissions' ? 'طباعة سجل العمولات' : activeTab === 'credit_limits' ? 'طباعة حدود الائتمان' : 'طباعة تقرير المندوبين'}
            exportTitle={activeTab === 'commissions' ? 'تصدير سجل العمولات إلى Excel' : activeTab === 'credit_limits' ? 'تصدير حدود الائتمان إلى Excel' : 'تصدير تقرير المندوبين إلى Excel'}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-4 text-xs font-bold">
        <button
          onClick={() => setActiveTab('reps')}
          className={`pb-2.5 px-2 border-b-2 transition cursor-pointer ${
            activeTab === 'reps' ? 'border-[#1a237e] text-[#1a237e]' : 'border-transparent text-slate-500'
          }`}
        >
          👤 سجل المندوبين والأداء ({reps.length})
        </button>
        <button
          onClick={() => setActiveTab('commissions')}
          className={`pb-2.5 px-2 border-b-2 transition cursor-pointer ${
            activeTab === 'commissions' ? 'border-[#1a237e] text-[#1a237e]' : 'border-transparent text-slate-500'
          }`}
        >
          💵 سجل العمولات والتسويات ({commissions.length})
        </button>
        <button
          onClick={() => setActiveTab('credit_limits')}
          className={`pb-2.5 px-2 border-b-2 transition cursor-pointer ${
            activeTab === 'credit_limits' ? 'border-[#1a237e] text-[#1a237e]' : 'border-transparent text-slate-500'
          }`}
        >
          🛡️ حدود وسقوف ائتمان العملاء ({customers.length})
        </button>
      </div>

      {/* TAB 1: REPS CARDS */}
      {activeTab === 'reps' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {repsWithMetrics.map((rep) => (
            <div
              key={rep.id}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-blue-300 transition space-y-4"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-black text-slate-900 text-sm">{rep.name}</h4>
                  <span className="text-xs text-slate-500 font-mono" dir="ltr">{rep.phone}</span>
                </div>
                <span className="bg-blue-50 text-blue-900 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                  {rep.code}
                </span>
              </div>

              {/* Progress to Target */}
              <div className="space-y-1 text-xs">
                <div className="flex justify-between font-bold">
                  <span className="text-slate-600">نسبة تحقيق التارجت:</span>
                  <span className={rep.achievementRate >= 100 ? 'text-emerald-700 font-black' : 'text-blue-900'}>
                    {rep.achievementRate}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      rep.achievementRate >= 100 ? 'bg-emerald-500' : 'bg-blue-600'
                    }`}
                    style={{ width: `${Math.min(100, rep.achievementRate)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10.5px] text-slate-400">
                  <span>المحقق: {(rep.totalSales || 0).toLocaleString()} {currency}</span>
                  <span>الهدف: {(rep.targetSales || 0).toLocaleString()} {currency}</span>
                </div>
              </div>

              {/* Commission Stats */}
              <div className="bg-slate-50 p-3 rounded-xl text-xs space-y-1.5 border border-slate-100">
                <div className="flex justify-between">
                  <span className="text-slate-500">نظام العمولة:</span>
                  <strong className="text-slate-800">{rep.commissionRate}% من المبيعات</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">إجمالي العمولات المستحقة:</span>
                  <strong className="text-emerald-700">{(rep.totalCommissionEarned || 0).toLocaleString()} {currency}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">العمولات المعلقة للصرف:</span>
                  <strong className="text-amber-700">{(rep.pendingCommission || 0).toLocaleString()} {currency}</strong>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
                <span className="text-slate-500">{rep.invoicesCount} فاتورة محررة</span>
                <button
                  onClick={() => {
                    setEditingRepId(rep.id);
                    setRepName(rep.name);
                    setRepPhone(rep.phone);
                    setRepRate(rep.commissionRate);
                    setRepTarget(rep.targetSales);
                    setIsRepModalOpen(true);
                  }}
                  className="text-blue-700 hover:text-blue-900 font-bold cursor-pointer"
                >
                  ✏️ تعديل المندوب
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: COMMISSIONS LOG */}
      {activeTab === 'commissions' && (
        <div className="space-y-3">
          {/* Mobile Cards */}
          <div className="block md:hidden space-y-3">
            {commissions.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-sm">
                لا توجد سجلات عمولات مسجلة حالياً
              </div>
            ) : (
              commissions.map((c) => (
                <div
                  key={c.id}
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div>
                      <strong className="text-slate-900 text-sm">{c.salesRepName}</strong>
                      <span className="text-xs text-blue-900 font-mono font-bold block">فاتورة #{c.invoiceNumber}</span>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        c.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {c.status === 'paid' ? 'تم الصرف والتسوية' : 'مستحق ومعلق'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-mono">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">قيمة الفاتورة</span>
                      <strong className="text-slate-800">{(c.invoiceAmount || 0).toLocaleString()} {currency}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">نسبة العمولة</span>
                      <strong className="text-blue-700">{c.rate}%</strong>
                    </div>
                    <div className="col-span-2 pt-1 border-t border-slate-200/50 flex justify-between items-center">
                      <span className="text-xs text-slate-600 font-sans">مبلغ العمولة:</span>
                      <strong className="text-emerald-800 text-sm font-black">
                        {(c.commissionAmount || 0).toLocaleString()} {currency}
                      </strong>
                    </div>
                  </div>

                  {c.status !== 'paid' ? (
                    <button
                      onClick={() => handlePayCommission(c)}
                      className="w-full min-h-[42px] bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition shadow-xs flex items-center justify-center gap-1"
                    >
                      💵 صرف العمولة الآن
                    </button>
                  ) : (
                    <div className="text-center text-slate-400 font-mono text-xs">صرفت: {c.paymentDate}</div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">المندوب</th>
                  <th className="p-3">رقم الفاتورة</th>
                  <th className="p-3 text-left">قيمة الفاتورة</th>
                  <th className="p-3 text-center">النسبة</th>
                  <th className="p-3 text-left">مبلغ العمولة</th>
                  <th className="p-3 text-center">الحالة</th>
                  <th className="p-3 text-center">إجراءات الصرف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {commissions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center p-8 text-slate-400">
                      لا توجد سجلات عمولات مسجلة حالياً
                    </td>
                  </tr>
                ) : (
                  commissions.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-800">{c.salesRepName}</td>
                      <td className="p-3 font-mono text-blue-900 font-bold">#{c.invoiceNumber}</td>
                      <td className="p-3 text-left font-bold">{(c.invoiceAmount || 0).toLocaleString()} {currency}</td>
                      <td className="p-3 text-center font-bold">{c.rate}%</td>
                      <td className="p-3 text-left font-black text-emerald-800 text-sm">
                        {(c.commissionAmount || 0).toLocaleString()} {currency}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            c.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {c.status === 'paid' ? 'تم الصرف والتسوية' : 'مستحق ومعلق'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {c.status !== 'paid' ? (
                          <button
                            onClick={() => handlePayCommission(c)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition shadow-xs"
                          >
                            💵 صرف العمولة الآن
                          </button>
                        ) : (
                          <span className="text-slate-400 font-mono text-[10.5px]">صرفت: {c.paymentDate}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: CUSTOMER CREDIT LIMITS */}
      {activeTab === 'credit_limits' && (
        <div className="space-y-3">
          {/* Mobile Cards */}
          <div className="block md:hidden space-y-3">
            {customers.map((cust) => {
              const limit = cust.creditLimit || 0;
              const isOverLimit = limit > 0 && cust.balance > limit;
              return (
                <div
                  key={cust.id}
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div>
                      <strong className="text-slate-900 text-sm">{cust.name}</strong>
                      <span className="text-xs text-slate-500 font-mono block" dir="ltr">{cust.phone}</span>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        isOverLimit ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {isOverLimit ? '⚠️ تجاوز السقف' : 'ائتمان سليم'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-[10px] text-slate-400 block">المديونية الحالية:</span>
                      <strong className="font-mono text-rose-700 font-black">{(cust.balance || 0).toLocaleString()} {currency}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">سقف الائتمان:</span>
                      <strong className="font-mono text-slate-800">
                        {limit > 0 ? `${(limit || 0).toLocaleString()} ${currency}` : 'مفتوح'}
                      </strong>
                    </div>
                    <div className="col-span-2 text-slate-600">
                      فترة السماح: <strong className="text-slate-800">{cust.paymentGracePeriodDays || 30} يوم</strong>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setEditingCustomer(cust);
                      setCustCreditLimit(cust.creditLimit || 0);
                      setCustGraceDays(cust.paymentGracePeriodDays || 30);
                    }}
                    className="w-full min-h-[42px] bg-blue-50 hover:bg-blue-100 text-blue-800 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    ⚙️ ضبط سقف الائتمان والسماح
                  </button>
                </div>
              );
            })}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">اسم العميل</th>
                  <th className="p-3">الهاتف</th>
                  <th className="p-3 text-left">المديونية الحالية</th>
                  <th className="p-3 text-left">سقف الائتمان المسموح</th>
                  <th className="p-3 text-center">فترة السماح</th>
                  <th className="p-3 text-center">حالة الائتمان</th>
                  <th className="p-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((cust) => {
                  const limit = cust.creditLimit || 0;
                  const isOverLimit = limit > 0 && cust.balance > limit;
                  return (
                    <tr key={cust.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-900">{cust.name}</td>
                      <td className="p-3 font-mono text-slate-500" dir="ltr">{cust.phone}</td>
                      <td className="p-3 text-left font-black text-rose-700">{(cust.balance || 0).toLocaleString()} {currency}</td>
                      <td className="p-3 text-left font-bold text-slate-800">
                        {limit > 0 ? `${(limit || 0).toLocaleString()} ${currency}` : 'غير محدد (مفتوح)'}
                      </td>
                      <td className="p-3 text-center font-semibold">{cust.paymentGracePeriodDays || 30} يوم</td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isOverLimit
                              ? 'bg-rose-100 text-rose-800 animate-pulse'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isOverLimit ? '⚠️ تجاوز حد الائتمان' : 'ائتمان سليم'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => {
                            setEditingCustomer(cust);
                            setCustCreditLimit(cust.creditLimit || 0);
                            setCustGraceDays(cust.paymentGracePeriodDays || 30);
                          }}
                          className="text-blue-700 hover:text-blue-900 font-bold px-2 py-1 bg-blue-50 rounded-lg cursor-pointer"
                        >
                          ⚙️ ضبط السقف
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rep Modal */}
      {isRepModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 border border-slate-200">
            <h3 className="font-black text-lg text-[#1a237e]">
              {editingRepId ? 'تعديل بيانات مندوب المبيعات' : 'إضافة مندوب مبيعات جديد'}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم المندوب *</label>
                <input
                  type="text"
                  value={repName}
                  onChange={(e) => setRepName(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl"
                  placeholder="الاسم ثلاثي"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">رقم الهاتف</label>
                <input
                  type="text"
                  value={repPhone}
                  onChange={(e) => setRepPhone(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl"
                  placeholder="01xxxxxxxxx"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">نسبة العمولة (%) *</label>
                <input
                  type="number"
                  step="0.5"
                  value={repRate}
                  onChange={(e) => setRepRate(Number(e.target.value))}
                  className="w-full p-2 border border-slate-300 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">التارجت المستهدف شهرياً ({currency})</label>
                <input
                  type="number"
                  value={repTarget}
                  onChange={(e) => setRepTarget(Number(e.target.value))}
                  className="w-full p-2 border border-slate-300 rounded-xl font-bold"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsRepModalOpen(false)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveRep}
                className="bg-[#1a237e] hover:bg-[#0d47a1] text-white px-5 py-2 rounded-xl text-xs font-bold cursor-pointer shadow-xs"
              >
                💾 حفظ المندوب
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credit Limit Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 border border-slate-200">
            <h3 className="font-black text-lg text-[#1a237e]">
              سقف الائتمان للعميل: {editingCustomer.name}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">الحد الأقصى للمديونية (سقف الائتمان بالـ {currency})</label>
                <input
                  type="number"
                  value={custCreditLimit}
                  onChange={(e) => setCustCreditLimit(Number(e.target.value))}
                  className="w-full p-2 border border-slate-300 rounded-xl font-bold"
                  placeholder="0 تعني بدون حد"
                />
                <span className="text-[10.5px] text-slate-500 block mt-1">
                  المديونية الحالية للعميل: <strong>{(editingCustomer?.balance || 0).toLocaleString()} {currency}</strong>
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">فترة السماح للسداد (أيام)</label>
                <input
                  type="number"
                  value={custGraceDays}
                  onChange={(e) => setCustGraceDays(Number(e.target.value))}
                  className="w-full p-2 border border-slate-300 rounded-xl font-bold"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setEditingCustomer(null)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveCreditLimit}
                className="bg-[#1a237e] hover:bg-[#0d47a1] text-white px-5 py-2 rounded-xl text-xs font-bold cursor-pointer shadow-xs"
              >
                💾 حفظ إعدادات الائتمان
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
