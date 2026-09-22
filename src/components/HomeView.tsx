import React from 'react';
import { AppData, User } from '../types';

interface HomeViewProps {
  appData: AppData;
  onNavigate: (page: string) => void;
  currentUser?: User;
}

export const HomeView: React.FC<HomeViewProps> = ({ appData, onNavigate }) => {
  const totalSales = (appData?.salesInvoices || []).reduce((sum, inv) => sum + (Number(inv?.total) || 0), 0);
  const totalPurchases = (appData?.purchaseInvoices || []).reduce((sum, inv) => sum + (Number(inv?.total) || 0), 0);
  const stockValue = (appData?.items || []).reduce((sum, item) => sum + (Number(item?.quantity) || 0) * (Number(item?.purchasePrice) || 0), 0);
  const activeBranch = appData?.branches?.find((b) => b.id === appData?.activeBranchId) || appData?.branches?.[0];

  const salesCount = (appData?.salesInvoices || []).length;
  const purchasesCount = (appData?.purchaseInvoices || []).length;
  const cashCount = (appData?.cashTransactions || []).length;
  const contactsCount = (appData?.customers || []).length + (appData?.suppliers || []).length;
  const pricedItemsCount = (appData?.items || []).filter((it) => Number(it.salePrice || it.price) > 0).length;
  const chequesUnderCollectionCount = (appData?.cheques || []).filter((c) => c.status === 'under_collection' || c.status === 'received').length;
  const activeSalesRepsCount = (appData?.salesReps || []).filter((r) => r.status !== 'inactive').length;
  const employeesCount = (appData?.employees || []).length;
  const fixedAssetsCount = (appData?.fixedAssets || []).length;
  const workOrdersCount = (appData?.workOrders || appData?.productionOrders || []).filter((w) => w.status === 'in_progress').length;
  const pendingBankCount = (appData?.approvalRequests || []).filter((b) => b.status === 'pending').length;

  return (
    <div className="space-y-3.5 sm:space-y-4 pb-6 max-w-4xl mx-auto px-1 sm:px-2 select-none">
      {/* 1. Header Title */}
      <div className="text-center font-bold text-slate-800 text-base sm:text-lg flex items-center justify-center gap-1.5 pt-1">
        <span>🏠</span>
        <span>لوحة القيادة والتحكم الرئيسية</span>
      </div>

      {/* 2. Blue Enterprise Company Banner (With single unified POS button and BI button) */}
      <div className="bg-gradient-to-r from-[#1a237e] via-[#283593] to-[#0d47a1] text-white p-4 sm:p-5 rounded-2xl shadow-md space-y-3.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-black text-sm sm:text-base md:text-lg text-[#ffd54f]">
              {appData?.settings?.companyName || 'منظومة RAKEEZA للمحاسبة'}
            </h3>
            <p className="text-blue-100 text-xs sm:text-sm opacity-90 mt-0.5">
              الفرع: {activeBranch?.name || 'الفرع الرئيسي والمخزن المركزي'}
            </p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center text-2xl shrink-0 border border-white/15">
            🏢
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 pt-0.5">
          <button
            onClick={() => onNavigate('pos')}
            className="py-2.5 px-3 bg-[#ffc107] hover:bg-[#ffb300] active:scale-95 text-slate-950 font-black text-xs sm:text-sm rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs border border-amber-400"
          >
            <span>⚡</span>
            <span>كاشير POS السريع</span>
          </button>
          <button
            onClick={() => onNavigate('bi_analytics')}
            className="py-2.5 px-3 bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold text-xs sm:text-sm rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer border border-white/20"
          >
            <span>📊</span>
            <span>ذكاء الأعمال</span>
          </button>
        </div>
      </div>

      {/* 3. Cards Grid (2 Columns as in Screenshot - strictly unique, zero duplicate cards) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {/* Row 1 - Right: المبيعات والفواتير */}
        <div
          onClick={() => onNavigate('sales')}
          className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/90 hover:border-indigo-300 hover:shadow-sm active:scale-[0.98] transition cursor-pointer relative flex flex-col items-center justify-center text-center min-h-[110px]"
        >
          <span className="absolute top-2.5 left-2.5 bg-[#1a237e] text-white rounded-full min-w-[22px] h-[22px] px-1.5 flex items-center justify-center text-xs font-bold font-mono">
            {salesCount}
          </span>
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center text-2xl mb-2">
            💰
          </div>
          <h3 className="text-slate-800 font-bold text-xs sm:text-sm">المبيعات والفواتير</h3>
        </div>

        {/* Row 1 - Left: المشتريات والتوريد */}
        <div
          onClick={() => onNavigate('purchases')}
          className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/90 hover:border-indigo-300 hover:shadow-sm active:scale-[0.98] transition cursor-pointer relative flex flex-col items-center justify-center text-center min-h-[110px]"
        >
          <span className="absolute top-2.5 left-2.5 bg-[#5c6bc0] text-white rounded-full min-w-[22px] h-[22px] px-1.5 flex items-center justify-center text-xs font-bold font-mono">
            {purchasesCount}
          </span>
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-2xl mb-2">
            🛒
          </div>
          <h3 className="text-slate-800 font-bold text-xs sm:text-sm">المشتريات والتوريد</h3>
        </div>

        {/* Row 2 - Right: الخزينة والسيولة */}
        <div
          onClick={() => onNavigate('cash')}
          className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/90 hover:border-emerald-300 hover:shadow-sm active:scale-[0.98] transition cursor-pointer relative flex flex-col items-center justify-center text-center min-h-[110px]"
        >
          <span className="absolute top-2.5 left-2.5 bg-[#00897b] text-white rounded-full min-w-[22px] h-[22px] px-1.5 flex items-center justify-center text-xs font-bold font-mono">
            {cashCount}
          </span>
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl mb-2">
            💵
          </div>
          <h3 className="text-slate-800 font-bold text-xs sm:text-sm">الخزينة والسيولة</h3>
        </div>

        {/* Row 2 - Left: العملاء والموردين */}
        <div
          onClick={() => onNavigate('accounts')}
          className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/90 hover:border-purple-300 hover:shadow-sm active:scale-[0.98] transition cursor-pointer relative flex flex-col items-center justify-center text-center min-h-[110px]"
        >
          <span className="absolute top-2.5 left-2.5 bg-[#7b1fa2] text-white rounded-full min-w-[22px] h-[22px] px-1.5 flex items-center justify-center text-xs font-bold font-mono">
            {contactsCount}
          </span>
          <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center text-2xl mb-2">
            📋
          </div>
          <h3 className="text-slate-800 font-bold text-xs sm:text-sm">العملاء والموردين</h3>
        </div>

        {/* Row 3 - Right: إدارة الأسعار (Yellow Highlighted Border) */}
        <div
          onClick={() => onNavigate('price_management')}
          className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border-2 border-amber-300 hover:border-amber-400 hover:shadow-sm active:scale-[0.98] transition cursor-pointer flex flex-col items-center justify-center text-center min-h-[110px]"
        >
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center text-2xl mb-1.5">
            🏷️
          </div>
          <h3 className="text-slate-800 font-bold text-xs sm:text-sm mb-1.5">إدارة الأسعار</h3>
          <span className="bg-amber-100/90 text-amber-900 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
            {pricedItemsCount} صنف مسعر
          </span>
        </div>

        {/* Row 3 - Left: شيكات وأوراق قبض */}
        <div
          onClick={() => onNavigate('cheques')}
          className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/90 hover:border-emerald-300 hover:shadow-sm active:scale-[0.98] transition cursor-pointer flex flex-col items-center justify-center text-center min-h-[110px]"
        >
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl mb-1.5">
            💳
          </div>
          <h3 className="text-slate-800 font-bold text-xs sm:text-sm mb-1.5">شيكات وأوراق قبض</h3>
          <span className="bg-emerald-100/90 text-emerald-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
            {chequesUnderCollectionCount} تحت التحصيل
          </span>
        </div>

        {/* Row 4 - Right: المندوبين والعمولات */}
        <div
          onClick={() => onNavigate('sales_reps')}
          className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/90 hover:border-indigo-300 hover:shadow-sm active:scale-[0.98] transition cursor-pointer flex flex-col items-center justify-center text-center min-h-[110px]"
        >
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center text-2xl mb-1.5">
            🎯
          </div>
          <h3 className="text-slate-800 font-bold text-xs sm:text-sm mb-1.5">المندوبين والعمولات</h3>
          <span className="bg-blue-100/90 text-blue-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
            {activeSalesRepsCount} مندوب نشط
          </span>
        </div>

        {/* Row 4 - Left: الموارد والرواتب */}
        <div
          onClick={() => onNavigate('hr_payroll')}
          className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/90 hover:border-blue-300 hover:shadow-sm active:scale-[0.98] transition cursor-pointer flex flex-col items-center justify-center text-center min-h-[110px]"
        >
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-2xl mb-1.5">
            👥
          </div>
          <h3 className="text-slate-800 font-bold text-xs sm:text-sm mb-1.5">الموارد والرواتب</h3>
          <span className="bg-blue-100/90 text-blue-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
            {employeesCount} موظف
          </span>
        </div>

        {/* Row 5 - Right: الأصول والإهلاك */}
        <div
          onClick={() => onNavigate('fixed_assets')}
          className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/90 hover:border-purple-300 hover:shadow-sm active:scale-[0.98] transition cursor-pointer flex flex-col items-center justify-center text-center min-h-[110px]"
        >
          <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center text-2xl mb-1.5">
            🏢
          </div>
          <h3 className="text-slate-800 font-bold text-xs sm:text-sm mb-1.5">الأصول والإهلاك</h3>
          <span className="bg-purple-100/90 text-purple-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
            {fixedAssetsCount} أصل
          </span>
        </div>

        {/* Row 5 - Left: التصنيع و BOM */}
        <div
          onClick={() => onNavigate('manufacturing')}
          className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/90 hover:border-amber-300 hover:shadow-sm active:scale-[0.98] transition cursor-pointer flex flex-col items-center justify-center text-center min-h-[110px]"
        >
          <div className="w-12 h-12 rounded-full bg-slate-50 text-slate-700 flex items-center justify-center text-2xl mb-1.5">
            ⚙️
          </div>
          <h3 className="text-slate-800 font-bold text-xs sm:text-sm mb-1.5">التصنيع و BOM</h3>
          <span className="bg-amber-100/90 text-amber-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
            {workOrdersCount} أمر إنتاج
          </span>
        </div>

        {/* Row 6 - Right: المطابقة البنكية */}
        <div
          onClick={() => onNavigate('bank_reconciliation')}
          className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/90 hover:border-teal-300 hover:shadow-sm active:scale-[0.98] transition cursor-pointer flex flex-col items-center justify-center text-center min-h-[110px]"
        >
          <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center text-2xl mb-1.5">
            🏦
          </div>
          <h3 className="text-slate-800 font-bold text-xs sm:text-sm mb-1.5">المطابقة البنكية</h3>
          <span className="bg-teal-100/90 text-teal-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
            {pendingBankCount} معلق
          </span>
        </div>
      </div>

      {/* 4. ملخص المؤشرات المالية والتشغيلية (Strictly non-repeating stats) */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/90 space-y-3 mt-4">
        <div className="text-center font-bold text-slate-800 text-sm sm:text-base flex items-center justify-center gap-1.5">
          <span>📈</span>
          <span>ملخص المؤشرات المالية والتشغيلية</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          {/* إجمالي المبيعات */}
          <div className="bg-slate-50/90 p-3 rounded-xl border border-slate-200/70 text-center">
            <span className="text-slate-500 block mb-1 text-xs font-semibold">إجمالي المبيعات</span>
            <strong className="text-[#2e7d32] text-sm sm:text-base md:text-lg font-black font-mono">
              {(totalSales ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م
            </strong>
          </div>

          {/* إجمالي المشتريات */}
          <div className="bg-slate-50/90 p-3 rounded-xl border border-slate-200/70 text-center">
            <span className="text-slate-500 block mb-1 text-xs font-semibold">إجمالي المشتريات</span>
            <strong className="text-[#c62828] text-sm sm:text-base md:text-lg font-black font-mono">
              {(totalPurchases ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م
            </strong>
          </div>

          {/* عدد العملاء */}
          <div className="bg-slate-50/90 p-3 rounded-xl border border-slate-200/70 text-center">
            <span className="text-slate-500 block mb-1 text-xs font-semibold">عدد العملاء</span>
            <strong className="text-slate-800 text-sm sm:text-base md:text-lg font-black font-mono">
              {(appData?.customers || []).length}
            </strong>
          </div>

          {/* عدد الموردين */}
          <div className="bg-slate-50/90 p-3 rounded-xl border border-slate-200/70 text-center">
            <span className="text-slate-500 block mb-1 text-xs font-semibold">عدد الموردين</span>
            <strong className="text-slate-800 text-sm sm:text-base md:text-lg font-black font-mono">
              {(appData?.suppliers || []).length}
            </strong>
          </div>

          {/* قيمة المخزون الكلي */}
          <div className="bg-slate-50/90 p-3 rounded-xl border border-slate-200/70 text-center col-span-2">
            <span className="text-slate-500 block mb-1 text-xs font-semibold">قيمة المخزون الكلي</span>
            <strong className="text-[#f57f17] text-sm sm:text-base md:text-lg font-black font-mono">
              {(stockValue ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
};
