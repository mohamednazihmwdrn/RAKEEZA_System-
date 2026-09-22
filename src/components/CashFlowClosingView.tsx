import React, { useState } from 'react';
import { AppData } from '../types';
import { openUnifiedPrintWindow } from '../utils/printUnified';
import { exportToExcel } from '../utils/excelExport';

interface CashFlowClosingViewProps {
  appData: AppData;
  onUpdateData?: (newData: AppData) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export const CashFlowClosingView: React.FC<CashFlowClosingViewProps> = ({
  appData,
  showToast,
}) => {
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());

  // Calculate Real Operating Cash Flows
  // 1. Operating Inflows
  const salesCashInflow = appData.salesInvoices
    .filter((inv) => inv.type === 'nagdi' || (inv.paidAmount && inv.paidAmount > 0))
    .reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);

  const receiptVouchersInflow = appData.cashTransactions
    .filter((t) => t.type === 'receive' || t.type === 'deposit')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const totalOperatingInflow = salesCashInflow + receiptVouchersInflow;

  // 2. Operating Outflows
  const purchasesCashOutflow = appData.purchaseInvoices
    .filter((inv) => inv.type === 'nagdi' || (inv.paidAmount && inv.paidAmount > 0))
    .reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);

  const paymentVouchersOutflow = appData.cashTransactions
    .filter((t) => t.type === 'pay' || t.type === 'withdraw')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const payrollOutflow = (appData.payrollSlips || [])
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + (p.netSalary || 0), 0);

  const totalOperatingOutflow = purchasesCashOutflow + paymentVouchersOutflow + payrollOutflow;
  const netOperatingCashFlow = totalOperatingInflow - totalOperatingOutflow;

  // 3. Investing Activities (Fixed Assets purchases)
  const fixedAssetsPurchased = (appData.fixedAssets || [])
    .reduce((sum, a) => sum + (a.purchasePrice || 0), 0);
  const netInvestingCashFlow = -fixedAssetsPurchased;

  // 4. Financing Activities (Cheques collected vs paid)
  const chequesCollected = (appData.cheques || [])
    .filter((c) => c.type === 'receivable' && c.status === 'collected')
    .reduce((sum, c) => sum + (c.amount || 0), 0);

  const chequesPaid = (appData.cheques || [])
    .filter((c) => c.type === 'payable' && c.status === 'collected')
    .reduce((sum, c) => sum + (c.amount || 0), 0);

  const netFinancingCashFlow = chequesCollected - chequesPaid;

  // 5. Total Net Change in Cash
  const netChangeInCash = netOperatingCashFlow + netInvestingCashFlow + netFinancingCashFlow;

  // Cash Equivalents (Treasury + Bank Balances)
  const currentTreasuryBalance = appData.cashTransactions.reduce((acc, t) => {
    return (t.type === 'receive' || t.type === 'deposit') ? acc + t.amount : acc - t.amount;
  }, 0);

  const currentBankBalance = (appData.bankAccounts || []).reduce((acc, b) => {
    return acc + (b.balance || 0);
  }, 0);

  const endingCashBalance = Math.max(0, currentTreasuryBalance + currentBankBalance);
  const beginningCashBalance = Math.max(0, endingCashBalance - netChangeInCash);

  const handlePrint = () => {
    openUnifiedPrintWindow({
      reportTitle: 'قائمة التدفقات النقدية المعيارية (Statement of Cash Flows)',
      subTitle: `وفقاً لمعايير المحاسبة المصرية (EAS) والدولية (IFRS) - للسنة المالية ${selectedYear}`,
      date: new Date().toISOString().split('T')[0],
      company: {
        name: appData.settings.companyName || 'منظومة ركيزة للحلول الإدارية والمحاسبية',
        address: appData.settings.address || 'القاهرة - جمهورية مصر العربية',
        phones: [appData.settings.phone1 || appData.settings.phone2 || '01029190615'],
      },
      kpis: [
        { title: 'صافي التدفق التشغيلي', value: `${netOperatingCashFlow.toLocaleString()} ج.م` },
        { title: 'صافي التدفق الاستثماري', value: `${netInvestingCashFlow.toLocaleString()} ج.م` },
        { title: 'صافي التدفق التمويلي', value: `${netFinancingCashFlow.toLocaleString()} ج.م` },
        { title: 'رصيد النقدية آخر المدة', value: `${endingCashBalance.toLocaleString()} ج.م` },
      ],
      columns: ['البند المحاسبي والبيان', 'التدفق الداخل (+)', 'التدفق الخارج (-)', 'الصافي (ج.م)'],
      rows: [
        ['مقبوضات مبيعات وسندات قبض عملاء', salesCashInflow.toLocaleString(), '-', salesCashInflow.toLocaleString()],
        ['مدفوعات مشتريات وسندات صرف موردين', '-', purchasesCashOutflow.toLocaleString(), `-${purchasesCashOutflow.toLocaleString()}`],
        ['مصروفات عمومية وتشغيلية ورواتب', '-', (paymentVouchersOutflow + payrollOutflow).toLocaleString(), `-${(paymentVouchersOutflow + payrollOutflow).toLocaleString()}`],
        ['صافي التدفقات النقدية من الأنشطة التشغيلية', totalOperatingInflow.toLocaleString(), totalOperatingOutflow.toLocaleString(), netOperatingCashFlow.toLocaleString()],
        ['شراء أصول ثابتة ومعدات وتوسعات', '-', fixedAssetsPurchased.toLocaleString(), `-${fixedAssetsPurchased.toLocaleString()}`],
        ['صافي التدفقات النقدية من الأنشطة الاستثمارية', '0', fixedAssetsPurchased.toLocaleString(), netInvestingCashFlow.toLocaleString()],
        ['شيكات مقبوضة مسددة وأوراق دفع', chequesCollected.toLocaleString(), chequesPaid.toLocaleString(), netFinancingCashFlow.toLocaleString()],
        ['صافي التدفقات النقدية من الأنشطة التمويلية', chequesCollected.toLocaleString(), chequesPaid.toLocaleString(), netFinancingCashFlow.toLocaleString()],
        ['صافي التغير الإجمالي في النقدية وما في حكمها', '-', '-', netChangeInCash.toLocaleString()],
        ['رصيد النقدية وما في حكمها أول الفترة', '-', '-', beginningCashBalance.toLocaleString()],
        ['رصيد النقدية وما في حكمها آخر الفترة (المطابق)', '-', '-', endingCashBalance.toLocaleString()],
      ],
      signatures: ['المدير المالي CFO', 'المراجع القانوني', 'اعتماد رئيس مجلس الإدارة'],
    });
  };

  const handleExportExcel = () => {
    const rows = [
      { 'القسم': 'الأنشطة التشغيلية', 'البيان': 'متحصلات المبيعات النقدية والقبض', 'القيمة (ج.م)': totalOperatingInflow },
      { 'القسم': 'الأنشطة التشغيلية', 'البيان': 'مدفوعات المشتريات والمصروفات والرواتب', 'القيمة (ج.م)': -totalOperatingOutflow },
      { 'القسم': 'الأنشطة التشغيلية', 'البيان': 'صافي التدفق النقدي التشغيلي', 'القيمة (ج.م)': netOperatingCashFlow },
      { 'القسم': 'الأنشطة الاستثمارية', 'البيان': 'شراء أصول ومعدات', 'القيمة (ج.م)': -fixedAssetsPurchased },
      { 'القسم': 'الأنشطة التمويلية', 'البيان': 'شيكات محصلة ومسددة وتمويل', 'القيمة (ج.م)': netFinancingCashFlow },
      { 'القسم': 'الإجمالي', 'البيان': 'صافي التغير الإجمالي في النقدية', 'القيمة (ج.م)': netChangeInCash },
      { 'القسم': 'الأرصدة', 'البيان': 'رصيد النقدية وما في حكمها أول المدة', 'القيمة (ج.م)': beginningCashBalance },
      { 'القسم': 'الأرصدة', 'البيان': 'رصيد النقدية وما في حكمها آخر المدة', 'القيمة (ج.م)': endingCashBalance },
    ];
    exportToExcel({
      filename: `قائمة_التدفقات_النقدية_${selectedYear}`,
      sheetName: 'قائمة التدفقات النقدية',
      data: rows,
      columns: [
        { header: 'القسم', key: 'القسم', width: 22 },
        { header: 'البيان', key: 'البيان', width: 35 },
        { header: 'القيمة (ج.م)', key: 'القيمة (ج.م)', width: 20, isNumeric: true },
      ],
      reportTitle: `قائمة التدفقات النقدية المعيارية لسنة ${selectedYear}`,
    });
    showToast('تم تصدير قائمة التدفقات النقدية بنجاح إلى Excel', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#004d40] via-[#00695c] to-[#00796b] text-white p-5 rounded-2xl shadow-md flex flex-wrap justify-between items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌊</span>
            <h3 className="font-black text-lg md:text-xl text-[#ffd54f]">
              قائمة التدفقات النقدية المعيارية (Statement of Cash Flows)
            </h3>
          </div>
          <p className="text-xs text-teal-100 mt-1 opacity-90">
            تحليل حركة السيولة والأنشطة التشغيلية والاستثمارية والتمويلية وفقاً لمعايير المحاسبة المصرية والدولية
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="px-3 py-2 bg-white/15 hover:bg-white/25 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1"
          >
            <span>📊</span> تصدير Excel
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 font-black rounded-xl text-xs transition shadow-sm cursor-pointer flex items-center gap-1.5"
          >
            <span>🖨️</span> طباعة القائمة المعتمدة
          </button>
        </div>
      </div>

      {/* Cash Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200">
          <div className="text-xs text-slate-500 font-bold">الأنشطة التشغيلية (الصافي)</div>
          <div
            className={`text-xl font-black mt-1 font-mono ${
              netOperatingCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {netOperatingCashFlow.toLocaleString()} ج.م
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200">
          <div className="text-xs text-slate-500 font-bold">الأنشطة الاستثمارية (الأصول)</div>
          <div className="text-xl font-black text-slate-700 mt-1 font-mono">
            {netInvestingCashFlow.toLocaleString()} ج.م
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200">
          <div className="text-xs text-slate-500 font-bold">الأنشطة التمويلية والشيكات</div>
          <div className="text-xl font-black text-slate-700 mt-1 font-mono">
            {netFinancingCashFlow.toLocaleString()} ج.م
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-xs border border-teal-200 bg-teal-50/30">
          <div className="text-xs text-teal-800 font-bold">رصيد النقدية المتوفر آخر المدة</div>
          <div className="text-xl font-black text-teal-900 mt-1 font-mono">
            {endingCashBalance.toLocaleString()} ج.م
          </div>
        </div>
      </div>

      {/* Main Statement Breakdown Card */}
      <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 space-y-5">
        <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
          <h4 className="font-bold text-slate-800 text-sm md:text-base flex items-center gap-2">
            <span>📑</span> الهيكل التفصيلي للتدفقات النقدية (Direct Method)
          </h4>
          <span className="text-xs font-mono font-bold bg-slate-100 px-3 py-1 rounded-full text-slate-600">
            السنة المالية: {selectedYear}
          </span>
        </div>

        {/* 1. Operating Activities */}
        <div className="space-y-2">
          <div className="bg-slate-100 p-2.5 rounded-xl font-bold text-xs text-slate-800 flex justify-between">
            <span>أولاً: التدفقات النقدية من الأنشطة التشغيلية (Cash Flows from Operating Activities)</span>
            <span className="font-mono text-indigo-900 font-black">{netOperatingCashFlow.toLocaleString()} ج.م</span>
          </div>
          <div className="pr-4 space-y-1.5 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-600">متحصلات المبيعات النقدية وسندات قبض العملاء</span>
              <span className="font-mono font-bold text-emerald-600">+{totalOperatingInflow.toLocaleString()} ج.م</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-600">مدفوعات المشتريات النقدية وسداد فواتير الموردين</span>
              <span className="font-mono font-bold text-rose-600">-{purchasesCashOutflow.toLocaleString()} ج.م</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-600">المصروفات العمومية والتشغيلية وسندات الصرف ومسيرات الرواتب</span>
              <span className="font-mono font-bold text-rose-600">
                -{(paymentVouchersOutflow + payrollOutflow).toLocaleString()} ج.م
              </span>
            </div>
          </div>
        </div>

        {/* 2. Investing Activities */}
        <div className="space-y-2">
          <div className="bg-slate-100 p-2.5 rounded-xl font-bold text-xs text-slate-800 flex justify-between">
            <span>ثانياً: التدفقات النقدية من الأنشطة الاستثمارية (Cash Flows from Investing Activities)</span>
            <span className="font-mono text-indigo-900 font-black">{netInvestingCashFlow.toLocaleString()} ج.م</span>
          </div>
          <div className="pr-4 space-y-1.5 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-600">المدفوعات لشراء الأصول الثابتة والمعدات الرأسمالية</span>
              <span className="font-mono font-bold text-rose-600">
                {netInvestingCashFlow < 0 ? `${netInvestingCashFlow.toLocaleString()} ج.م` : '0 ج.م'}
              </span>
            </div>
          </div>
        </div>

        {/* 3. Financing Activities */}
        <div className="space-y-2">
          <div className="bg-slate-100 p-2.5 rounded-xl font-bold text-xs text-slate-800 flex justify-between">
            <span>ثالثاً: التدفقات النقدية من الأنشطة التمويلية (Cash Flows from Financing Activities)</span>
            <span className="font-mono text-indigo-900 font-black">{netFinancingCashFlow.toLocaleString()} ج.م</span>
          </div>
          <div className="pr-4 space-y-1.5 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-600">صافي تحصيل وسداد أوراق القبض والشيكات البنكية</span>
              <span className="font-mono font-bold text-slate-700">{netFinancingCashFlow.toLocaleString()} ج.م</span>
            </div>
          </div>
        </div>

        {/* Final Reconciliation */}
        <div className="bg-gradient-to-r from-teal-50 to-emerald-50 p-4 rounded-2xl border border-teal-200 space-y-2 text-xs">
          <div className="flex justify-between font-bold text-slate-800 border-b border-teal-200/60 pb-1.5">
            <span>صافي التغير في النقدية وما في حكمها خلال العام:</span>
            <span className="font-mono text-sm">{netChangeInCash.toLocaleString()} ج.م</span>
          </div>
          <div className="flex justify-between text-slate-700">
            <span>رصيد النقدية وما في حكمها أول الفترة:</span>
            <span className="font-mono">{beginningCashBalance.toLocaleString()} ج.م</span>
          </div>
          <div className="flex justify-between font-black text-teal-900 pt-1 text-sm">
            <span>رصيد النقدية وما في حكمها آخر الفترة (خزائن + بنوك):</span>
            <span className="font-mono">{endingCashBalance.toLocaleString()} ج.م</span>
          </div>
        </div>
      </div>
    </div>
  );
};
