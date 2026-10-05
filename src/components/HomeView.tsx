import React, { useState, useMemo } from 'react';
import {
  ShoppingCart,
  Receipt,
  Users,
  Wallet,
  CreditCard,
  Tag,
  Briefcase,
  Target,
  Layers,
  Landmark,
  Building2,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Calendar,
  X,
  FileSpreadsheet,
  Printer,
  ArrowUpRight,
  ArrowDownRight,
  Lightbulb,
  Scale,
} from 'lucide-react';
import { AppData, User, SaleInvoice } from '../types';
import {
  calculateAllActualInventoryStocks,
  auditCompanyFinancialIntegrity,
} from '../utils/accounting';
import { exportIncomeStatementToExcel } from '../utils/excelExport';

interface HomeViewProps {
  appData: AppData;
  onNavigate: (page: string) => void;
  currentUser?: User;
}

// Helper to compute P&L metrics for any arbitrary date range
export function computeDateRangePnL(appData: AppData, start: string, end: string) {
  const allSalesInvoices: SaleInvoice[] = appData?.salesInvoices || [];
  const allItems = appData?.items || [];
  const allCashTransactions = appData?.cashTransactions || [];

  const filteredInvoices = allSalesInvoices.filter((inv) => {
    if (!inv || inv.status === 'cancelled') return false;
    const invDate = inv.date || '';
    return invDate >= start && invDate <= end;
  });

  let grossSales = 0;
  let salesReturns = 0;
  let totalCogs = 0;
  const itemProfits: Record<string, { name: string; qty: number; revenue: number; profit: number }> = {};

  filteredInvoices.forEach((inv) => {
    const isReturn = inv.type === 'return_nagdi' || inv.type === 'return_ajel' || (inv as any).isReturn;
    const invTotal = Number(inv.total || 0);

    if (isReturn) {
      salesReturns += Math.abs(invTotal);
    } else {
      grossSales += invTotal;
    }

    const lines = inv.items || [];
    lines.forEach((line) => {
      const qty = Number(line.qty ?? (line as any).quantity ?? 0);
      const price = Number(line.price || 0);
      const lineRevenue = qty * price;

      const matchedItem = allItems.find(
        (it) => it.id === line.itemId || it.name.trim().toLowerCase() === (line.name || '').trim().toLowerCase()
      );
      const costPrice = Number((line as any).costPrice ?? matchedItem?.costPrice ?? matchedItem?.price ?? 0);
      const lineCost = qty * costPrice;
      const lineProfit = lineRevenue - lineCost;

      if (isReturn) {
        totalCogs -= lineCost;
      } else {
        totalCogs += lineCost;
      }

      const itemName = line.name || matchedItem?.name || 'صنف';
      if (!itemProfits[itemName]) {
        itemProfits[itemName] = { name: itemName, qty: 0, revenue: 0, profit: 0 };
      }
      if (isReturn) {
        itemProfits[itemName].qty -= qty;
        itemProfits[itemName].revenue -= lineRevenue;
        itemProfits[itemName].profit -= lineProfit;
      } else {
        itemProfits[itemName].qty += qty;
        itemProfits[itemName].revenue += lineRevenue;
        itemProfits[itemName].profit += lineProfit;
      }
    });
  });

  const netSales = Math.max(0, grossSales - salesReturns);
  const safeCogs = Math.max(0, totalCogs);
  const grossProfit = netSales - safeCogs;
  const grossProfitMargin = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

  let periodExpenses = 0;
  allCashTransactions.forEach((tx) => {
    if (!tx || (tx as any).status === 'cancelled') return;
    const txDate = tx.date || '';
    if (txDate >= start && txDate <= end) {
      if (tx.type === 'pay' || tx.type === 'withdraw') {
        if (!tx.supplierName && !tx.invoiceId) {
          periodExpenses += Number(tx.amount || 0);
        }
      }
    }
  });

  const netOperatingProfit = grossProfit - periodExpenses;
  const netProfitMargin = netSales > 0 ? (netOperatingProfit / netSales) * 100 : 0;

  const topItems = Object.values(itemProfits)
    .filter((i) => i.revenue > 0)
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 5);

  return {
    invoicesCount: filteredInvoices.length,
    grossSales,
    salesReturns,
    netSales,
    cogs: safeCogs,
    grossProfit,
    grossProfitMargin,
    periodExpenses,
    netOperatingProfit,
    netProfitMargin,
    topItems,
  };
}

export const HomeView: React.FC<HomeViewProps> = ({ appData, onNavigate }) => {
  // 1. Precise Financial and Operational Audit
  const financialAudit = auditCompanyFinancialIntegrity(appData);
  const actualStockMap = calculateAllActualInventoryStocks(appData);

  const totalSales = Number(financialAudit.netSales || 0);
  const totalPurchases = Number(financialAudit.netPurchases || 0);
  const stockValue = Number(financialAudit.inventoryValuation || 0);
  const currencySymbol = appData.settings?.currencySymbol || 'ج.م';

  const salesCount = (appData?.salesInvoices || []).length;
  const purchasesCount = (appData?.purchaseInvoices || []).length;
  const customersCount = (appData?.customers || []).length;
  const suppliersCount = (appData?.suppliers || []).length;

  // Real liquid breakdown
  const drawerCash = Number(appData?.cashBox?.drawer || 0);
  const vodafoneCash = Number(appData?.cashBox?.vodafone || 0);
  const instapayCash = Number(appData?.cashBox?.instapay || 0);
  const bankCash = Number(appData?.cashBox?.bank || 0);
  const totalLiquid = drawerCash + vodafoneCash + instapayCash + bankCash;

  const chequesUnderCollection = (appData?.cheques || []).filter(
    (c) => c.status === 'under_collection' || c.status === 'received'
  ).length;

  // --------------------------------------------------------------------------
  // 📊 أداة تحليل ومقارنة الأرباح بين فترتين زمنيتين (Decision Tool)
  // --------------------------------------------------------------------------
  const [isPnlModalOpen, setIsPnlModalOpen] = useState(false);
  const [pnlTab, setPnlTab] = useState<'single' | 'compare'>('single');

  // Dates for Period 1
  const todayStr = new Date().toISOString().split('T')[0];
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .split('T')[0];

  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(todayStr);
  const [activePeriodPreset, setActivePeriodPreset] = useState<'today' | '7days' | 'month' | 'last_month' | 'quarter' | 'year' | 'custom'>('month');

  // Dates for Period 2 (Comparison Mode)
  const lastMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().split('T')[0];
  const lastMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().split('T')[0];
  const [compStartDate, setCompStartDate] = useState(lastMonthStart);
  const [compEndDate, setCompEndDate] = useState(lastMonthEnd);
  const [compPreset, setCompPreset] = useState<'month_vs_last' | '7days_vs_prior' | 'quarter_vs_prior' | 'year_vs_prior' | 'custom'>('month_vs_last');

  // Quick period presets handler for single period
  const setPeriodPreset = (preset: 'today' | '7days' | 'month' | 'last_month' | 'quarter' | 'year') => {
    setActivePeriodPreset(preset);
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    if (preset === 'today') {
      setStartDate(today);
      setEndDate(today);
    } else if (preset === '7days') {
      const past7 = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      setStartDate(past7);
      setEndDate(today);
    } else if (preset === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      setStartDate(monthStart);
      setEndDate(today);
    } else if (preset === 'last_month') {
      const lastMonthS = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const lastMonthE = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      setStartDate(lastMonthS);
      setEndDate(lastMonthE);
    } else if (preset === 'quarter') {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const quarterStart = new Date(now.getFullYear(), currentQuarter * 3, 1).toISOString().split('T')[0];
      setStartDate(quarterStart);
      setEndDate(today);
    } else if (preset === 'year') {
      const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      setStartDate(yearStart);
      setEndDate(today);
    }
  };

  // Quick presets handler for Comparison Mode
  const setComparisonPreset = (type: 'month_vs_last' | '7days_vs_prior' | 'quarter_vs_prior' | 'year_vs_prior') => {
    setCompPreset(type);
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    if (type === 'month_vs_last') {
      // Period 1: Current month
      setStartDate(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]);
      setEndDate(today);
      // Period 2: Previous month
      setCompStartDate(new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]);
      setCompEndDate(new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]);
    } else if (type === '7days_vs_prior') {
      // Period 1: Last 7 days
      setStartDate(new Date(now.getTime() - 6 * 86400000).toISOString().split('T')[0]);
      setEndDate(today);
      // Period 2: Previous 7 days
      setCompStartDate(new Date(now.getTime() - 13 * 86400000).toISOString().split('T')[0]);
      setCompEndDate(new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0]);
    } else if (type === 'quarter_vs_prior') {
      const currentQ = Math.floor(now.getMonth() / 3);
      setStartDate(new Date(now.getFullYear(), currentQ * 3, 1).toISOString().split('T')[0]);
      setEndDate(today);
      const priorQStartMonth = (currentQ - 1) * 3;
      setCompStartDate(new Date(now.getFullYear(), priorQStartMonth, 1).toISOString().split('T')[0]);
      setCompEndDate(new Date(now.getFullYear(), currentQ * 3, 0).toISOString().split('T')[0]);
    } else if (type === 'year_vs_prior') {
      setStartDate(new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]);
      setEndDate(today);
      setCompStartDate(new Date(now.getFullYear() - 1, 0, 1).toISOString().split('T')[0]);
      setCompEndDate(new Date(now.getFullYear() - 1, 11, 31).toISOString().split('T')[0]);
    }
  };

  // Computations for Period 1
  const periodAnalysis = useMemo(() => {
    const res = computeDateRangePnL(appData, startDate, endDate);

    // Smart Decision Making KPI (مؤشر القرار التحليلي السريع)
    let decisionBadge = {
      title: 'أداء متوازن ومستقر',
      color: 'text-amber-800 bg-amber-50 border-amber-300',
      recommendation: 'المبيعات مستقرة ولكن يفضل ضبط المصروفات لزيادة هامش الربح الصافي.',
    };

    if (res.netOperatingProfit > 0 && res.netProfitMargin >= 22) {
      decisionBadge = {
        title: 'أداء ربحي استثنائي وممتاز 🟢',
        color: 'text-emerald-800 bg-emerald-50 border-emerald-300',
        recommendation: 'مؤشر قرار إيجابي: هامش الربح ممتاز، نوصي بالتوسع في الأصناف الرابحة وضخ سيولة في المخزون.',
      };
    } else if (res.netOperatingProfit > 0 && res.netProfitMargin >= 10) {
      decisionBadge = {
        title: 'أداء صحي وجيد 🟡',
        color: 'text-blue-800 bg-blue-50 border-blue-300',
        recommendation: 'مؤشر قرار آمن: المنظومة تحقق أرباحاً جيدة، ركز على تقليل مردودات المبيعات وتحصيل الآجل.',
      };
    } else if (res.netOperatingProfit > 0 && res.netProfitMargin < 10) {
      decisionBadge = {
        title: 'هامش ربح حرج ومنخفض 🟠',
        color: 'text-orange-800 bg-orange-50 border-orange-300',
        recommendation: 'مؤشر قرار تحذيري: هامش الربح ضئيل. ينبغي مراجعة أسعار البيع والتفاوض مع الموردين على خصومات إضافية.',
      };
    } else if (res.netOperatingProfit <= 0) {
      decisionBadge = {
        title: 'عجز أو خسارة تشغيلية للفترة 🔴',
        color: 'text-rose-800 bg-rose-50 border-rose-300',
        recommendation: 'مؤشر قرار عاجل: المصروفات وتكلفة البضاعة تتجاوز صافي الإيرادات. راجع تسعير الأصناف وأوقف الهدر فوراً.',
      };
    }

    return { ...res, decisionBadge };
  }, [appData, startDate, endDate]);

  // Computations for Period 2 (Comparison)
  const compPeriodAnalysis = useMemo(() => {
    return computeDateRangePnL(appData, compStartDate, compEndDate);
  }, [appData, compStartDate, compEndDate]);

  // Growth / Decline calculations between Period 1 and Period 2
  const comparisonMetrics = useMemo(() => {
    const p1 = periodAnalysis;
    const p2 = compPeriodAnalysis;

    const diffSales = p1.netSales - p2.netSales;
    const salesGrowthRate = p2.netSales > 0 ? (diffSales / p2.netSales) * 100 : p1.netSales > 0 ? 100 : 0;

    const diffProfit = p1.netOperatingProfit - p2.netOperatingProfit;
    const profitGrowthRate =
      Math.abs(p2.netOperatingProfit) > 0
        ? (diffProfit / Math.abs(p2.netOperatingProfit)) * 100
        : p1.netOperatingProfit > 0
        ? 100
        : 0;

    const diffGross = p1.grossProfit - p2.grossProfit;
    const diffExpenses = p1.periodExpenses - p2.periodExpenses;

    let compareDecision = {
      title: 'أداء مستقر ومتقارب',
      color: 'text-slate-800 bg-slate-50 border-slate-300',
      text: 'نتائج الفترتين متقاربة. حافظ على كفاءة دورة التحصيل والمخزون.',
    };

    if (profitGrowthRate >= 15) {
      compareDecision = {
        title: `نمو ربحي ملحوظ (+${profitGrowthRate.toFixed(1)}%) 🚀`,
        color: 'text-emerald-800 bg-emerald-50 border-emerald-300',
        text: `قفزة ربحية ممتازة مقارنة بالفترة السابقة (+${diffProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currencySymbol}). استمر على نفس سياسة التسعير وزيادة حجم المبيعات.`,
      };
    } else if (profitGrowthRate > 0) {
      compareDecision = {
        title: `نمو إيجابي طفيف (+${profitGrowthRate.toFixed(1)}%) 📈`,
        color: 'text-blue-800 bg-blue-50 border-blue-300',
        text: `الأرباح في اتجاه تصاعدي مقارنة بالفترة السابقة. ركز على تقليص المصروفات التشغيلية لتعظيم هامش الربح.`,
      };
    } else if (profitGrowthRate < -10) {
      compareDecision = {
        title: `تراجع حرج في الأرباح (${profitGrowthRate.toFixed(1)}%) ⚠️`,
        color: 'text-rose-800 bg-rose-50 border-rose-300',
        text: `تراجعت الأرباح بمقدار ${Math.abs(diffProfit).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currencySymbol} عن الفترة المقارنة. اتخذ قراراً فورياً بمراجعة أسعار البيع والتأكد من عدم زيادة المصروفات.`,
      };
    } else if (profitGrowthRate < 0) {
      compareDecision = {
        title: `تراجع طفيف في الأرباح (${profitGrowthRate.toFixed(1)}%) 📉`,
        color: 'text-amber-800 bg-amber-50 border-amber-300',
        text: `انخفاض طفيف في صافي الربح مقارنة بالفترة السابقة. تحقق من نسبة الخصومات الممنوحة أو ارتفاع تكلفة الشراء.`,
      };
    }

    return {
      diffSales,
      salesGrowthRate,
      diffProfit,
      profitGrowthRate,
      diffGross,
      diffExpenses,
      compareDecision,
    };
  }, [periodAnalysis, compPeriodAnalysis, currencySymbol]);

  const handleExportPnlExcel = () => {
    exportIncomeStatementToExcel({
      companyName: appData?.settings?.companyName || 'منظومة ركيزة RAKEEZA ERP',
      allSales: periodAnalysis.grossSales,
      allSalesReturns: periodAnalysis.salesReturns,
      netSalesRevenue: periodAnalysis.netSales,
      totalCOGS: periodAnalysis.cogs,
      grossProfit: periodAnalysis.grossProfit,
      operatingExpenses: periodAnalysis.periodExpenses,
      netIncome: periodAnalysis.netOperatingProfit,
    });
  };

  const handlePrintPnl = () => {
    window.print();
  };

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-2.5 pb-8 text-slate-800" dir="rtl">
      {/* الهيدر العلوي: اسم التطبيق على اليمين فقط وبدون أي عناصر أخرى */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-600 text-white px-4 py-2.5 rounded-lg flex items-center justify-between text-xs sm:text-sm font-bold shadow-xs">
        <span className="tracking-wide">
          {appData?.settings?.companyName || 'المحاسب المحترف'}
        </span>
        <span className="text-[11px] font-normal text-blue-100 hidden sm:inline">
          لوحة التحكم الرئيسية
        </span>
      </div>

      {/* شبكة البطاقات الرئيسية: الـ 11 قسماً الفريدة والمحددة بدقة تامة وبدون أي تكرار */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-2 sm:gap-2.5">
        {/* 1. المشتريات والتوريد (القسم الوحيد للمشتريات) */}
        <div
          onClick={() => onNavigate('purchases')}
          className="bg-white border border-slate-300 hover:border-blue-600 hover:bg-slate-50 rounded-lg p-2.5 sm:p-3 flex flex-col items-center justify-center gap-1.5 cursor-pointer relative shadow-xs transition-all select-none group"
          title="المشتريات والتوريد"
        >
          <div className="absolute top-2 right-2 bg-slate-800 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold leading-none">
            {purchasesCount}
          </div>
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-blue-600 group-hover:scale-105 transition-transform">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div className="text-[11px] sm:text-xs font-bold text-slate-900 text-center leading-tight">
            المشتريات والتوريد
          </div>
        </div>

        {/* 2. المبيعات والفواتير (القسم الوحيد للمبيعات بدون تكرار في أي مكان آخر) */}
        <div
          onClick={() => onNavigate('sales')}
          className="bg-white border border-slate-300 hover:border-blue-600 hover:bg-slate-50 rounded-lg p-2.5 sm:p-3 flex flex-col items-center justify-center gap-1.5 cursor-pointer relative shadow-xs transition-all select-none group"
          title="المبيعات والفواتير"
        >
          <div className="absolute top-2 right-2 bg-slate-800 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold leading-none">
            {salesCount}
          </div>
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-emerald-600 group-hover:scale-105 transition-transform">
            <Receipt className="w-5 h-5" />
          </div>
          <div className="text-[11px] sm:text-xs font-bold text-slate-900 text-center leading-tight">
            المبيعات والفواتير
          </div>
        </div>

        {/* 3. العملاء والموردين */}
        <div
          onClick={() => onNavigate('customers')}
          className="bg-white border border-slate-300 hover:border-blue-600 hover:bg-slate-50 rounded-lg p-2.5 sm:p-3 flex flex-col items-center justify-center gap-1.5 cursor-pointer relative shadow-xs transition-all select-none group"
          title="العملاء والموردين"
        >
          <div className="absolute top-2 right-2 bg-slate-800 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold leading-none">
            {customersCount + suppliersCount}
          </div>
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-purple-600 group-hover:scale-105 transition-transform">
            <Users className="w-5 h-5" />
          </div>
          <div className="text-[11px] sm:text-xs font-bold text-slate-900 text-center leading-tight">
            العملاء والموردين
          </div>
        </div>

        {/* 4. الخزينة والسيولة */}
        <div
          onClick={() => onNavigate('treasury')}
          className="bg-white border border-slate-300 hover:border-blue-600 hover:bg-slate-50 rounded-lg p-2.5 sm:p-3 flex flex-col items-center justify-center gap-1.5 cursor-pointer relative shadow-xs transition-all select-none group"
          title="الخزينة والسيولة"
        >
          <div className="absolute top-2 right-2 bg-emerald-600 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold leading-none">
            {totalLiquid > 0 ? `${Math.round(totalLiquid).toLocaleString()} ${currencySymbol}` : '0'}
          </div>
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-emerald-600 group-hover:scale-105 transition-transform">
            <Wallet className="w-5 h-5" />
          </div>
          <div className="text-[11px] sm:text-xs font-bold text-slate-900 text-center leading-tight">
            الخزينة والسيولة
          </div>
        </div>

        {/* 5. شيكات وأوراق قبض */}
        <div
          onClick={() => onNavigate('cheques')}
          className="bg-white border border-slate-300 hover:border-blue-600 hover:bg-slate-50 rounded-lg p-2.5 sm:p-3 flex flex-col items-center justify-center gap-1.5 cursor-pointer relative shadow-xs transition-all select-none group"
          title="شيكات وأوراق قبض"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-amber-600 group-hover:scale-105 transition-transform">
            <CreditCard className="w-5 h-5" />
          </div>
          <div className="text-[11px] sm:text-xs font-bold text-slate-900 text-center leading-tight">
            شيكات وأوراق قبض
          </div>
          <div className="text-[8px] sm:text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-bold">
            {chequesUnderCollection > 0 ? `${chequesUnderCollection} تحت التحصيل` : 'تحت التحصيل'}
          </div>
        </div>

        {/* 6. إدارة الأسعار - مميزة بإطار أصفر ذهبي */}
        <div
          onClick={() => onNavigate('price_management')}
          className="bg-white border-2 border-yellow-400 hover:border-blue-600 hover:bg-slate-50 rounded-lg p-2.5 sm:p-3 flex flex-col items-center justify-center gap-1.5 cursor-pointer relative shadow-xs transition-all select-none group"
          title="إدارة الأسعار"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-amber-500 group-hover:scale-105 transition-transform">
            <Tag className="w-5 h-5" />
          </div>
          <div className="text-[11px] sm:text-xs font-bold text-slate-900 text-center leading-tight">
            إدارة الأسعار
          </div>
          <div className="text-[8px] sm:text-[9px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-bold">
            التسعير المركزي
          </div>
        </div>

        {/* 7. الموارد والرواتب */}
        <div
          onClick={() => onNavigate('hr_payroll')}
          className="bg-white border border-slate-300 hover:border-blue-600 hover:bg-slate-50 rounded-lg p-2.5 sm:p-3 flex flex-col items-center justify-center gap-1.5 cursor-pointer relative shadow-xs transition-all select-none group"
          title="الموارد والرواتب"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-blue-600 group-hover:scale-105 transition-transform">
            <Briefcase className="w-5 h-5" />
          </div>
          <div className="text-[11px] sm:text-xs font-bold text-slate-900 text-center leading-tight">
            الموارد والرواتب
          </div>
          <div className="text-[8px] sm:text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-bold">
            شؤون العاملين
          </div>
        </div>

        {/* 8. المندوبين والعمولات */}
        <div
          onClick={() => onNavigate('sales_reps')}
          className="bg-white border border-slate-300 hover:border-blue-600 hover:bg-slate-50 rounded-lg p-2.5 sm:p-3 flex flex-col items-center justify-center gap-1.5 cursor-pointer relative shadow-xs transition-all select-none group"
          title="المندوبين والعمولات"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-rose-600 group-hover:scale-105 transition-transform">
            <Target className="w-5 h-5" />
          </div>
          <div className="text-[11px] sm:text-xs font-bold text-slate-900 text-center leading-tight">
            المندوبين والعمولات
          </div>
          <div className="text-[8px] sm:text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-bold">
            إدارة المبيعات الخارجية
          </div>
        </div>

        {/* 9. التصنيع و BOM */}
        <div
          onClick={() => onNavigate('manufacturing')}
          className="bg-white border border-slate-300 hover:border-blue-600 hover:bg-slate-50 rounded-lg p-2.5 sm:p-3 flex flex-col items-center justify-center gap-1.5 cursor-pointer relative shadow-xs transition-all select-none group"
          title="التصنيع و BOM"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 group-hover:scale-105 transition-transform">
            <Layers className="w-5 h-5" />
          </div>
          <div className="text-[11px] sm:text-xs font-bold text-slate-900 text-center leading-tight">
            التصنيع و BOM
          </div>
          <div className="text-[8px] sm:text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-bold">
            أوامر الإنتاج
          </div>
        </div>

        {/* 10. الأصول والإهلاك */}
        <div
          onClick={() => onNavigate('fixed_assets')}
          className="bg-white border border-slate-300 hover:border-blue-600 hover:bg-slate-50 rounded-lg p-2.5 sm:p-3 flex flex-col items-center justify-center gap-1.5 cursor-pointer relative shadow-xs transition-all select-none group"
          title="الأصول والإهلاك"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-sky-600 group-hover:scale-105 transition-transform">
            <Landmark className="w-5 h-5" />
          </div>
          <div className="text-[11px] sm:text-xs font-bold text-slate-900 text-center leading-tight">
            الأصول والإهلاك
          </div>
          <div className="text-[8px] sm:text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-bold">
            إدارة الأصول
          </div>
        </div>

        {/* 11. المطابقة البنكية */}
        <div
          onClick={() => onNavigate('bank_reconciliation')}
          className="bg-white border border-slate-300 hover:border-blue-600 hover:bg-slate-50 rounded-lg p-2.5 sm:p-3 flex flex-col items-center justify-center gap-1.5 cursor-pointer relative shadow-xs transition-all select-none group"
          title="المطابقة البنكية"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-emerald-700 group-hover:scale-105 transition-transform">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="text-[11px] sm:text-xs font-bold text-slate-900 text-center leading-tight">
            المطابقة البنكية
          </div>
          <div className="text-[8px] sm:text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-bold">
            الحسابات البنكية
          </div>
        </div>

        {/* 12. أسعار الشركات والتصنيفات (قسم خاص للشركات والتسعير المركزي) */}
        <div
          onClick={() => onNavigate('company_prices')}
          className="bg-white border border-slate-300 hover:border-blue-600 hover:bg-slate-50 rounded-lg p-2.5 sm:p-3 flex flex-col items-center justify-center gap-1.5 cursor-pointer relative shadow-xs transition-all select-none group"
          title="أسعار الشركات والتصنيفات"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-purple-600 group-hover:scale-105 transition-transform">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="text-[11px] sm:text-xs font-bold text-slate-900 text-center leading-tight">
            أسعار الشركات والتصنيفات
          </div>
          <div className="text-[8px] sm:text-[9px] text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded font-bold">
            دليل الشركات والمخزون
          </div>
        </div>
      </div>

      {/* ملخص المؤشرات المالية والتشغيلية مع أداة تحليل الأرباح ومقارنة الفترات */}
      <div className="bg-white border border-slate-300 rounded-lg p-3 sm:p-4 flex flex-col gap-2.5 shadow-xs mt-1">
        <div className="border-b border-slate-200 pb-2 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="text-[11px] sm:text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <span>ملخص المؤشرات المالية والتشغيلية</span>
          </div>

          {/* 📊 زر أداة تحليل ومقارنة الأرباح بين فترتين زمنيتين */}
          <button
            type="button"
            onClick={() => setIsPnlModalOpen(true)}
            className="text-[10px] sm:text-[11px] font-bold px-2.5 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors flex items-center gap-1.5 cursor-pointer"
            title="تحليل ومقارنة الأرباح بين فترتين زمنيتين لتعزيز اتخاذ القرار"
          >
            <Scale className="w-3.5 h-3.5 text-blue-600" />
            <span>أداة تحليل ومقارنة الأرباح ⚖️</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-5 gap-2">
          {/* إجمالي المشتريات */}
          <div
            onClick={() => onNavigate('purchases')}
            className="bg-slate-50 border border-slate-200 hover:border-rose-400 hover:bg-rose-50/30 rounded-md p-2 flex flex-col items-center gap-0.5 text-center cursor-pointer transition-colors"
            title="فتح فواتير المشتريات"
          >
            <span className="text-[9px] sm:text-[10px] text-slate-500 font-bold">
              إجمالي المشتريات
            </span>
            <span className="text-xs sm:text-sm font-black text-rose-600 font-mono">
              {totalPurchases.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol}
            </span>
          </div>

          {/* إجمالي المبيعات */}
          <div
            onClick={() => onNavigate('sales')}
            className="bg-slate-50 border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/30 rounded-md p-2 flex flex-col items-center gap-0.5 text-center cursor-pointer transition-colors"
            title="فتح فواتير المبيعات"
          >
            <span className="text-[9px] sm:text-[10px] text-slate-500 font-bold">
              إجمالي المبيعات
            </span>
            <span className="text-xs sm:text-sm font-black text-emerald-600 font-mono">
              {totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol}
            </span>
          </div>

          {/* عدد الموردين */}
          <div
            onClick={() => onNavigate('customers')}
            className="bg-slate-50 border border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 rounded-md p-2 flex flex-col items-center gap-0.5 text-center cursor-pointer transition-colors"
            title="فتح دليل الموردين"
          >
            <span className="text-[9px] sm:text-[10px] text-slate-500 font-bold">
              عدد الموردين
            </span>
            <span className="text-xs sm:text-sm font-black text-slate-900 font-mono">
              {suppliersCount}
            </span>
          </div>

          {/* عدد العملاء */}
          <div
            onClick={() => onNavigate('customers')}
            className="bg-slate-50 border border-slate-200 hover:border-purple-400 hover:bg-purple-50/30 rounded-md p-2 flex flex-col items-center gap-0.5 text-center cursor-pointer transition-colors"
            title="فتح دليل العملاء"
          >
            <span className="text-[9px] sm:text-[10px] text-slate-500 font-bold">
              عدد العملاء
            </span>
            <span className="text-xs sm:text-sm font-black text-slate-900 font-mono">
              {customersCount}
            </span>
          </div>

          {/* قيمة المخزون الكلي */}
          <div
            className="bg-slate-50 border border-slate-200 rounded-md p-2 flex flex-col items-center gap-0.5 text-center col-span-2 sm:col-span-2 md:col-span-1"
          >
            <span className="text-[9px] sm:text-[10px] text-slate-500 font-bold">
              قيمة المخزون الكلي
            </span>
            <span className="text-xs sm:text-sm font-black text-amber-600 font-mono">
              {stockValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol}
            </span>
          </div>
        </div>
      </div>

      {/* 📊 النافذة المنبثقة: أداة تحليل ومقارنة الأرباح بين فترتين زمنيتين (اتخاذ القرار) */}
      {isPnlModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 my-auto animate-in fade-in zoom-in-95 duration-200" dir="rtl">
            {/* Header with Tab Switcher */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-slate-200 mb-4 gap-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  {pnlTab === 'single' ? <BarChart3 className="w-5 h-5" /> : <Scale className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900">
                    أداة تحليل الأرباح واتخاذ القرار السريعة
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    تحليل دقيق للأرباح والخسائر ومقارنة الفترات لحساب معدلات النمو والتراجع
                  </p>
                </div>
              </div>

              {/* Mode Selector Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 self-stretch sm:self-auto justify-center">
                <button
                  type="button"
                  onClick={() => setPnlTab('single')}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    pnlTab === 'single'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  فترة واحدة
                </button>
                <button
                  type="button"
                  onClick={() => setPnlTab('compare')}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                    pnlTab === 'compare'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Scale className="w-3.5 h-3.5" />
                  <span>مقارنة فترتين (نمو / تراجع)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPnlModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-200 transition mr-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* TAB 1: Single Period Analysis */}
            {pnlTab === 'single' && (
              <>
                {/* Quick Period Filter Buttons */}
                <div className="mb-4">
                  <div className="text-[11px] font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    <span>اختر الفترة الزمنية للتحليل:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {[
                      { key: 'today', label: 'اليوم' },
                      { key: '7days', label: 'آخر 7 أيام' },
                      { key: 'month', label: 'هذا الشهر' },
                      { key: 'last_month', label: 'الشهر الماضي' },
                      { key: 'quarter', label: 'الربع الحالي' },
                      { key: 'year', label: 'العام الحالي' },
                    ].map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setPeriodPreset(item.key as any)}
                        className={`text-[10px] sm:text-xs px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                          activePeriodPreset === item.key
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  {/* Custom Date Inputs */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">
                        من تاريخ:
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => {
                          setStartDate(e.target.value);
                          setActivePeriodPreset('custom');
                        }}
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-mono focus:outline-hidden focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">
                        إلى تاريخ:
                      </label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => {
                          setEndDate(e.target.value);
                          setActivePeriodPreset('custom');
                        }}
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-mono focus:outline-hidden focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Smart Decision Card (مؤشر القرار التحليلي السريع) */}
                <div className={`p-3 rounded-xl border mb-4 flex items-start gap-2.5 ${periodAnalysis.decisionBadge.color}`}>
                  <Lightbulb className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-black">
                      {periodAnalysis.decisionBadge.title}
                    </div>
                    <div className="text-[11px] leading-relaxed mt-0.5">
                      {periodAnalysis.decisionBadge.recommendation}
                    </div>
                  </div>
                </div>

                {/* Financial Summary Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-2.5 mb-4">
                  {/* صافي المبيعات */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center">
                    <span className="text-[10px] text-slate-500 font-bold block mb-1">
                      صافي مبيعات الفترة
                    </span>
                    <span className="text-sm sm:text-base font-black text-slate-900 font-mono block">
                      {periodAnalysis.netSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol}
                    </span>
                    <span className="text-[9px] text-slate-400">
                      {periodAnalysis.invoicesCount} فاتورة بيع
                    </span>
                  </div>

                  {/* تكلفة البضاعة المباعة COGS */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center">
                    <span className="text-[10px] text-slate-500 font-bold block mb-1">
                      تكلفة البضاعة المباعة (COGS)
                    </span>
                    <span className="text-sm sm:text-base font-black text-rose-600 font-mono block">
                      {periodAnalysis.cogs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol}
                    </span>
                    <span className="text-[9px] text-slate-400">
                      تكلفة الأصناف المباعة
                    </span>
                  </div>

                  {/* مجمل الربح التجاري */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-slate-500 font-bold block mb-1">
                      مجمل الربح (Gross Profit)
                    </span>
                    <span className={`text-sm sm:text-base font-black font-mono block ${periodAnalysis.grossProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {periodAnalysis.grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol}
                    </span>
                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                      هامش: {periodAnalysis.grossProfitMargin.toFixed(1)}%
                    </span>
                  </div>

                  {/* المصروفات التشغيلية */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center">
                    <span className="text-[10px] text-slate-500 font-bold block mb-1">
                      المصروفات التشغيلية
                    </span>
                    <span className="text-sm sm:text-base font-black text-amber-600 font-mono block">
                      {periodAnalysis.periodExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol}
                    </span>
                    <span className="text-[9px] text-slate-400">
                      مصروفات النثرية والخزينة
                    </span>
                  </div>

                  {/* صافي الربح التشغيلي النهائي */}
                  <div className="bg-slate-50 border-2 border-emerald-400 rounded-xl p-2.5 text-center col-span-2 sm:col-span-2">
                    <span className="text-[10px] text-emerald-800 font-black block mb-0.5">
                      🏆 صافي الربح التشغيلي النهائي للفترة
                    </span>
                    <span className={`text-base sm:text-lg font-black font-mono block ${periodAnalysis.netOperatingProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {periodAnalysis.netOperatingProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol}
                    </span>
                    <span className="text-[10px] font-black text-slate-600">
                      صافي هامش الربح: {periodAnalysis.netProfitMargin.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Top Profitable Items Table */}
                {periodAnalysis.topItems.length > 0 && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden mb-4">
                    <div className="bg-slate-100 px-3 py-1.5 text-[11px] font-black text-slate-700 border-b border-slate-200">
                      الأصناف الأكثر مساهمة في أرباح الفترة:
                    </div>
                    <div className="divide-y divide-slate-100 text-xs">
                      {periodAnalysis.topItems.map((item, idx) => (
                        <div key={idx} className="px-3 py-2 flex items-center justify-between hover:bg-slate-50">
                          <div className="flex items-center gap-2">
                            <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="font-bold text-slate-800">{item.name}</span>
                            <span className="text-[10px] text-slate-400">({item.qty} وحدة)</span>
                          </div>
                          <div className="text-left font-mono">
                            <span className="text-emerald-700 font-black">
                              +{item.profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* TAB 2: Period 1 vs Period 2 Comparison Mode (مقارنة الأرباح ونسبة النمو / التراجع) */}
            {pnlTab === 'compare' && (
              <div className="space-y-4">
                {/* Presets for comparison */}
                <div>
                  <div className="text-[11px] font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                    <Scale className="w-3.5 h-3.5 text-blue-600" />
                    <span>اختر نمط المقارنة المسبق:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {[
                      { key: 'month_vs_last', label: 'الشهر الحالي مقابل السابق' },
                      { key: '7days_vs_prior', label: 'آخر 7 أيام مقابل السابقة' },
                      { key: 'quarter_vs_prior', label: 'الربع الحالي مقابل السابق' },
                      { key: 'year_vs_prior', label: 'العام الحالي مقابل السابق' },
                    ].map((btn) => (
                      <button
                        key={btn.key}
                        type="button"
                        onClick={() => setComparisonPreset(btn.key as any)}
                        className={`text-[10px] sm:text-xs px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                          compPreset === btn.key
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>

                  {/* Dual Period Date Selectors */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    {/* Period 1 */}
                    <div className="border-r-0 sm:border-r border-slate-200 sm:pr-3">
                      <div className="text-xs font-black text-blue-700 mb-1.5 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                        <span>الفترة الحالية (الفترة 1):</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 mb-0.5">من:</label>
                          <input
                            type="date"
                            value={startDate}
                            onChange={(e) => {
                              setStartDate(e.target.value);
                              setCompPreset('custom');
                            }}
                            className="w-full bg-white border border-slate-300 rounded-md px-2 py-1 text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 mb-0.5">إلى:</label>
                          <input
                            type="date"
                            value={endDate}
                            onChange={(e) => {
                              setEndDate(e.target.value);
                              setCompPreset('custom');
                            }}
                            className="w-full bg-white border border-slate-300 rounded-md px-2 py-1 text-xs font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Period 2 */}
                    <div>
                      <div className="text-xs font-black text-slate-600 mb-1.5 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                        <span>الفترة المقارنة (الفترة 2):</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 mb-0.5">من:</label>
                          <input
                            type="date"
                            value={compStartDate}
                            onChange={(e) => {
                              setCompStartDate(e.target.value);
                              setCompPreset('custom');
                            }}
                            className="w-full bg-white border border-slate-300 rounded-md px-2 py-1 text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 mb-0.5">إلى:</label>
                          <input
                            type="date"
                            value={compEndDate}
                            onChange={(e) => {
                              setCompEndDate(e.target.value);
                              setCompPreset('custom');
                            }}
                            className="w-full bg-white border border-slate-300 rounded-md px-2 py-1 text-xs font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Executive Comparison Decision KPI Banner */}
                <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${comparisonMetrics.compareDecision.color}`}>
                  <Lightbulb className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-black">
                      {comparisonMetrics.compareDecision.title}
                    </div>
                    <div className="text-[11px] leading-relaxed mt-0.5">
                      {comparisonMetrics.compareDecision.text}
                    </div>
                  </div>
                </div>

                {/* Key Growth Indicator Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {/* نسبة نمو الأرباح الصافية */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                    <span className="text-[10px] text-slate-500 font-bold block mb-1">
                      نسبة نمو الأرباح الصافية
                    </span>
                    <div className="flex items-center justify-center gap-1">
                      {comparisonMetrics.profitGrowthRate >= 0 ? (
                        <ArrowUpRight className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <ArrowDownRight className="w-5 h-5 text-rose-600" />
                      )}
                      <span
                        className={`text-base sm:text-lg font-black font-mono ${
                          comparisonMetrics.profitGrowthRate >= 0 ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {comparisonMetrics.profitGrowthRate >= 0 ? '+' : ''}
                        {comparisonMetrics.profitGrowthRate.toFixed(1)}%
                      </span>
                    </div>
                    <span className="text-[9px] text-slate-500 font-mono block mt-0.5">
                      الفارق: {comparisonMetrics.diffProfit >= 0 ? '+' : ''}
                      {comparisonMetrics.diffProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })} {currencySymbol}
                    </span>
                  </div>

                  {/* نسبة نمو المبيعات */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                    <span className="text-[10px] text-slate-500 font-bold block mb-1">
                      نسبة نمو صافي المبيعات
                    </span>
                    <div className="flex items-center justify-center gap-1">
                      {comparisonMetrics.salesGrowthRate >= 0 ? (
                        <ArrowUpRight className="w-5 h-5 text-blue-600" />
                      ) : (
                        <ArrowDownRight className="w-5 h-5 text-rose-600" />
                      )}
                      <span
                        className={`text-base sm:text-lg font-black font-mono ${
                          comparisonMetrics.salesGrowthRate >= 0 ? 'text-blue-700' : 'text-rose-600'
                        }`}
                      >
                        {comparisonMetrics.salesGrowthRate >= 0 ? '+' : ''}
                        {comparisonMetrics.salesGrowthRate.toFixed(1)}%
                      </span>
                    </div>
                    <span className="text-[9px] text-slate-500 font-mono block mt-0.5">
                      الفارق: {comparisonMetrics.diffSales >= 0 ? '+' : ''}
                      {comparisonMetrics.diffSales.toLocaleString(undefined, { maximumFractionDigits: 0 })} {currencySymbol}
                    </span>
                  </div>

                  {/* فرق تكلفة البضاعة المباعة والمصروفات */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-slate-500 font-bold block mb-1">
                      تغير المصروفات التشغيلية
                    </span>
                    <span
                      className={`text-base sm:text-lg font-black font-mono block ${
                        comparisonMetrics.diffExpenses <= 0 ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {comparisonMetrics.diffExpenses >= 0 ? '+' : ''}
                      {comparisonMetrics.diffExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })} {currencySymbol}
                    </span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">
                      {comparisonMetrics.diffExpenses <= 0 ? 'انخفاض في المصاريف (إيجابي)' : 'زيادة في المصاريف'}
                    </span>
                  </div>
                </div>

                {/* Comparative Financial Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-right">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-black border-b border-slate-200 text-[11px]">
                        <th className="p-2.5">البند المالي</th>
                        <th className="p-2.5 text-center text-blue-700">الفترة الحالية (1)</th>
                        <th className="p-2.5 text-center text-slate-600">الفترة المقارنة (2)</th>
                        <th className="p-2.5 text-center">التغير / النمو</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {/* المبيعات */}
                      <tr className="hover:bg-slate-50">
                        <td className="p-2.5 font-sans font-bold text-slate-800">صافي المبيعات</td>
                        <td className="p-2.5 text-center font-bold text-blue-700">
                          {periodAnalysis.netSales.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                        <td className="p-2.5 text-center text-slate-600">
                          {compPeriodAnalysis.netSales.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                        <td className={`p-2.5 text-center font-black ${comparisonMetrics.salesGrowthRate >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {comparisonMetrics.salesGrowthRate >= 0 ? '+' : ''}{comparisonMetrics.salesGrowthRate.toFixed(1)}%
                        </td>
                      </tr>

                      {/* تكلفة البضاعة المباعة */}
                      <tr className="hover:bg-slate-50">
                        <td className="p-2.5 font-sans font-bold text-slate-800">تكلفة البضاعة (COGS)</td>
                        <td className="p-2.5 text-center text-rose-600 font-bold">
                          {periodAnalysis.cogs.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                        <td className="p-2.5 text-center text-slate-600">
                          {compPeriodAnalysis.cogs.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                        <td className="p-2.5 text-center text-slate-500">
                          {periodAnalysis.cogs >= compPeriodAnalysis.cogs ? '+' : ''}
                          {(periodAnalysis.cogs - compPeriodAnalysis.cogs).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                      </tr>

                      {/* مجمل الربح */}
                      <tr className="hover:bg-slate-50">
                        <td className="p-2.5 font-sans font-bold text-slate-800">مجمل الربح (Gross Profit)</td>
                        <td className="p-2.5 text-center font-bold text-emerald-600">
                          {periodAnalysis.grossProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          <span className="text-[10px] text-slate-400 block font-normal">({periodAnalysis.grossProfitMargin.toFixed(1)}%)</span>
                        </td>
                        <td className="p-2.5 text-center text-slate-600">
                          {compPeriodAnalysis.grossProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          <span className="text-[10px] text-slate-400 block font-normal">({compPeriodAnalysis.grossProfitMargin.toFixed(1)}%)</span>
                        </td>
                        <td className={`p-2.5 text-center font-black ${comparisonMetrics.diffGross >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {comparisonMetrics.diffGross >= 0 ? '+' : ''}{comparisonMetrics.diffGross.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                      </tr>

                      {/* المصروفات */}
                      <tr className="hover:bg-slate-50">
                        <td className="p-2.5 font-sans font-bold text-slate-800">المصروفات التشغيلية</td>
                        <td className="p-2.5 text-center text-amber-600 font-bold">
                          {periodAnalysis.periodExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                        <td className="p-2.5 text-center text-slate-600">
                          {compPeriodAnalysis.periodExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                        <td className="p-2.5 text-center text-slate-500">
                          {comparisonMetrics.diffExpenses >= 0 ? '+' : ''}{comparisonMetrics.diffExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                      </tr>

                      {/* صافي الربح النهائي */}
                      <tr className="bg-emerald-50/60 font-black">
                        <td className="p-2.5 font-sans text-emerald-950">🏆 صافي الربح التشغيلي النهائي</td>
                        <td className="p-2.5 text-center text-emerald-800 text-sm">
                          {periodAnalysis.netOperatingProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })} {currencySymbol}
                          <span className="text-[10px] text-emerald-700 block font-normal">({periodAnalysis.netProfitMargin.toFixed(1)}%)</span>
                        </td>
                        <td className="p-2.5 text-center text-slate-700 text-sm">
                          {compPeriodAnalysis.netOperatingProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })} {currencySymbol}
                          <span className="text-[10px] text-slate-500 block font-normal">({compPeriodAnalysis.netProfitMargin.toFixed(1)}%)</span>
                        </td>
                        <td className={`p-2.5 text-center text-sm ${comparisonMetrics.profitGrowthRate >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {comparisonMetrics.profitGrowthRate >= 0 ? '▲ +' : '▼ '}
                          {comparisonMetrics.profitGrowthRate.toFixed(1)}%
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Footer Actions */}
            <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 mt-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportPnlExcel}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>تصدير Excel</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintPnl}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsPnlModalOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
