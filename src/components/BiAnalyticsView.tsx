import React from 'react';
import { AppData } from '../types';

interface BiAnalyticsViewProps {
  appData: AppData;
  onNavigate?: (page: string) => void;
}

export const BiAnalyticsView: React.FC<BiAnalyticsViewProps> = ({ appData, onNavigate }) => {
  // BI KPIs
  const totalSalesVal = appData.salesInvoices.reduce((s, inv) => s + (inv.total || 0), 0);
  const totalPurchasesVal = appData.purchaseInvoices.reduce((s, inv) => s + (inv.total || 0), 0);

  // Profit Margins
  const totalCost = appData.salesInvoices.reduce((sum, inv) => {
    const invCost = inv.items.reduce((iSum, item) => {
      const original = appData.items.find((i) => i.name === item.name);
      return iSum + ((original?.purchasePrice || item.price * 0.75) * item.qty);
    }, 0);
    return sum + (inv.type.includes('return') ? -invCost : invCost);
  }, 0);

  const grossProfit = totalSalesVal - totalCost;
  const marginPercentage = totalSalesVal > 0 ? (grossProfit / totalSalesVal) * 100 : 0;
  const avgInvoiceValue = appData.salesInvoices.length > 0 ? totalSalesVal / appData.salesInvoices.length : 0;

  // Inventory Intelligence: Low Stock / Reorder Alerts
  const reorderAlertItems = appData.items.filter((item) => {
    const min = item.minStockAlert ?? 3;
    return item.quantity <= min;
  });

  // Top Selling Items
  const itemSalesCounts: Record<string, { qty: number; revenue: number }> = {};
  appData.salesInvoices.forEach((inv) => {
    inv.items.forEach((it) => {
      if (!itemSalesCounts[it.name]) {
        itemSalesCounts[it.name] = { qty: 0, revenue: 0 };
      }
      itemSalesCounts[it.name].qty += it.qty;
      itemSalesCounts[it.name].revenue += it.total;
    });
  });

  const topSellingList = Object.entries(itemSalesCounts)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  // Stagnant / Slow-Moving Items (0 sales)
  const stagnantItems = appData.items.filter((it) => !itemSalesCounts[it.name]);

  // Customer Profitability Ranking
  const customerRevenues: Record<string, number> = {};
  appData.salesInvoices.forEach((inv) => {
    customerRevenues[inv.customerName] = (customerRevenues[inv.customerName] || 0) + inv.total;
  });

  const topCustomers = Object.entries(customerRevenues)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#1a237e] via-[#283593] to-[#3949ab] text-white p-6 rounded-2xl shadow-lg flex flex-wrap justify-between items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-3xl">📊</span>
            <h3 className="font-black text-xl md:text-2xl text-[#ffd54f]">
              ذكاء الأعمال والتحليلات التنبؤية (BI Intelligence & Analytics)
            </h3>
          </div>
          <p className="text-xs text-indigo-100 mt-1">
            مؤشرات الأداء الرئيسية (KPIs)، تحليل هوامش الربحية، تنبيهات إعادة الطلب الذكية، والأصناف الراكدة
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl text-center border border-white/20">
          <span className="text-[11px] text-indigo-200 block">متوسط الفاتورة</span>
          <strong className="text-lg font-mono font-bold text-white">
            {(avgInvoiceValue || 0).toLocaleString('en-US', { minimumFractionDigits: 1 })} ج.م
          </strong>
        </div>
      </div>

      {/* 4 Core Financial BI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-1">
          <span className="text-xs text-slate-500 font-bold">💰 إجمالي المبيعات المحققة</span>
          <strong className="text-xl font-black text-[#1a237e] block font-mono">
            {(totalSalesVal || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
          </strong>
          <span className="text-[11px] text-emerald-700 font-bold block">
            عدد الفواتير: {appData.salesInvoices.length} فاتورة
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-1">
          <span className="text-xs text-slate-500 font-bold">🧮 مجمل الأرباح التجارية</span>
          <strong className="text-xl font-black text-emerald-700 block font-mono">
            {(grossProfit || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
          </strong>
          <span className="text-[11px] text-slate-500 block">بعد خصم تكلفة البضاعة المباعة</span>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-1">
          <span className="text-xs text-slate-500 font-bold">📈 هامش الربح الإجمالي (Margin)</span>
          <strong className="text-xl font-black text-indigo-700 block font-mono">
            {marginPercentage.toFixed(1)}%
          </strong>
          <span className="text-[11px] text-indigo-600 block font-semibold">معدل ربحية مبيعات المنشأة</span>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-1">
          <span className="text-xs text-slate-500 font-bold">⚠️ تنبيهات إعادة الطلب</span>
          <strong className={`text-xl font-black block font-mono ${reorderAlertItems.length > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
            {reorderAlertItems.length} أصناف
          </strong>
          <span className="text-[11px] text-slate-500 block">بلغت الحد الأدنى للمخزون</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Smart Reorder & Low Stock Alerts */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <h4 className="font-black text-[#1a237e] text-base flex items-center gap-1.5">
              <span>🚨 تنبيهات إعادة الطلب الذكية (Reorder Alerts)</span>
            </h4>
            <span className="bg-rose-100 text-rose-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
              {reorderAlertItems.length} صنف يحتاج شراء
            </span>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {reorderAlertItems.length === 0 ? (
              <div className="text-center py-8 text-emerald-700 font-bold text-xs">
                ✅ جميع الأصناف بالمخزن في الحدود الآمنة ولا يوجد نقص حالياً
              </div>
            ) : (
              reorderAlertItems.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between items-center p-3 rounded-xl bg-rose-50/70 border border-rose-200 text-xs"
                >
                  <div>
                    <strong className="text-slate-900 block">{item.name}</strong>
                    <span className="text-[11px] text-rose-800">
                      الكمية المتوفرة: <strong className="font-mono text-sm">{item.quantity}</strong> | الحد الأدنى: {item.minStockAlert ?? 3}
                    </span>
                  </div>
                  {onNavigate && (
                    <button
                      onClick={() => onNavigate('purchases')}
                      className="bg-rose-700 hover:bg-rose-800 text-white px-3 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer"
                    >
                      طلب شراء 🛒
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Selling Fast-Moving Products */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <h4 className="font-black text-[#1a237e] text-base flex items-center gap-1.5">
              <span>🔥 الأصناف الأكثر مبيعاً ورواجاً (Fast-Moving)</span>
            </h4>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {topSellingList.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                لا توجد بيانات مبيعات كافية بعد لإظهار الترتيب
              </div>
            ) : (
              topSellingList.map((it, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#1a237e] text-white flex items-center justify-center text-[10px] font-bold">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-slate-900">{it.name}</span>
                  </div>
                  <div className="text-left font-mono">
                    <span className="text-indigo-900 font-bold">{it.qty} قطعة</span>
                    <span className="text-slate-500 text-[11px] block">
                      {(it.revenue || 0).toLocaleString('en-US')} ج.م
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Profitable Customers */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h4 className="font-black text-[#1a237e] text-base">
              👥 كبار العملاء الأكثر شراءً (Top Customers by Revenue)
            </h4>
          </div>

          <div className="space-y-2">
            {topCustomers.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                لا توجد بيانات مبيعات مسجلة للعملاء بعد
              </div>
            ) : (
              topCustomers.map((c, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⭐</span>
                    <span className="font-bold text-slate-900">{c.name}</span>
                  </div>
                  <span className="font-mono font-bold text-emerald-800 text-sm">
                    {(c.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Stagnant & Slow-Moving Stock */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <h4 className="font-black text-[#1a237e] text-base">
              ⏳ الأصناف الراكدة وبطيئة الحركة (Slow-Moving)
            </h4>
            <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
              {stagnantItems.length} صنف
            </span>
          </div>

          <div className="space-y-2 max-h-[250px] overflow-y-auto">
            {stagnantItems.length === 0 ? (
              <div className="text-center py-8 text-emerald-700 font-bold text-xs">
                ممتاز! جميع أصناف المخزون تتحرك ولا يوجد ركود
              </div>
            ) : (
              stagnantItems.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between items-center p-2.5 rounded-xl bg-amber-50/50 border border-amber-200 text-xs"
                >
                  <span className="font-bold text-slate-800">{item.name}</span>
                  <span className="text-[11px] text-slate-600 font-mono">
                    الكمية الراكدة: <strong className="text-slate-900">{item.quantity}</strong> قطعة
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
