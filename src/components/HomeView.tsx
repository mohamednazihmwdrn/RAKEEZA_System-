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
  Calendar,
  X,
  FileSpreadsheet,
  Printer,
  ArrowUpRight,
  ArrowDownRight,
  Lightbulb,
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
  // 📊 أداة تحليل الأرباح والخسائر السريعة لفترات مخصصة (Decision Tool)
  // --------------------------------------------------------------------------
  const [isPnlModalOpen, setIsPnlModalOpen] = useState(false);

  // Default dates: Start of current month to today
  const todayStr = new Date().toISOString().split('T')[0];
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .split('T')[0];

  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(todayStr);
  const [activePeriodPreset, setActivePeriodPreset] = useState<'today' | '7days' | 'month' | 'last_month' | 'quarter' | 'year' | 'custom'>('month');

  // Quick period presets handler
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
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      setStartDate(lastMonthStart);
      setEndDate(lastMonthEnd);
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

  // Custom period P&L Calculations
  const periodAnalysis = useMemo(() => {
    const allSalesInvoices: SaleInvoice[] = appData?.salesInvoices || [];
    const allItems = appData?.items || [];
    const allCashTransactions = appData?.cashTransactions || [];

    // Filter sales within the custom period
    const filteredInvoices = allSalesInvoices.filter((inv) => {
      if (!inv || inv.status === 'cancelled') return false;
      const invDate = inv.date || '';
      return invDate >= startDate && invDate <= endDate;
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

      // Calculate cost of goods sold per item line
      const lines = inv.items || [];
      lines.forEach((line) => {
        const qty = Number(line.qty ?? (line as any).quantity ?? 0);
        const price = Number(line.price || 0);
        const lineRevenue = qty * price;

        // Find cost price from inventory definition or invoice line
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

    // Filter operating expenses (مصروفات تشغيلية) within the custom period
    let periodExpenses = 0;
    allCashTransactions.forEach((tx) => {
      if (!tx || (tx as any).status === 'cancelled') return;
      const txDate = tx.date || '';
      if (txDate >= startDate && txDate <= endDate) {
        if (tx.type === 'pay' || tx.type === 'withdraw') {
          // Exclude supplier invoice settlements to avoid double counting COGS
          if (!tx.supplierName && !tx.invoiceId) {
            periodExpenses += Number(tx.amount || 0);
          }
        }
      }
    });

    const netOperatingProfit = grossProfit - periodExpenses;
    const netProfitMargin = netSales > 0 ? (netOperatingProfit / netSales) * 100 : 0;

    // Top 5 profitable items
    const topItems = Object.values(itemProfits)
      .filter((i) => i.revenue > 0)
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5);

    // Smart Decision Making KPI (مؤشر القرار التحليلي السريع)
    let decisionBadge = {
      title: 'أداء متوازن ومستقر',
      color: 'text-amber-800 bg-amber-50 border-amber-300',
      recommendation: 'المبيعات مستقرة ولكن يفضل ضبط المصروفات لزيادة هامش الربح الصافي.',
    };

    if (netOperatingProfit > 0 && netProfitMargin >= 22) {
      decisionBadge = {
        title: 'أداء ربحي استثنائي وممتاز 🟢',
        color: 'text-emerald-800 bg-emerald-50 border-emerald-300',
        recommendation: 'مؤشر قرار إيجابي: هامش الربح ممتاز، نوصي بالتوسع في الأصناف الرابحة وضخ سيولة في المخزون.',
      };
    } else if (netOperatingProfit > 0 && netProfitMargin >= 10) {
      decisionBadge = {
        title: 'أداء صحي وجيد 🟡',
        color: 'text-blue-800 bg-blue-50 border-blue-300',
        recommendation: 'مؤشر قرار آمن: المنظومة تحقق أرباحاً جيدة، ركز على تقليل مردودات المبيعات وتحصيل الآجل.',
      };
    } else if (netOperatingProfit > 0 && netProfitMargin < 10) {
      decisionBadge = {
        title: 'هامش ربح حرج ومنخفض 🟠',
        color: 'text-orange-800 bg-orange-50 border-orange-300',
        recommendation: 'مؤشر قرار تحذيري: هامش الربح ضئيل. ينبغي مراجعة أسعار البيع والتفاوض مع الموردين على خصومات إضافية.',
      };
    } else if (netOperatingProfit <= 0) {
      decisionBadge = {
        title: 'عجز أو خسارة تشغيلية للفترة 🔴',
        color: 'text-rose-800 bg-rose-50 border-rose-300',
        recommendation: 'مؤشر قرار عاجل: المصروفات وتكلفة البضاعة تتجاوز صافي الإيرادات. راجع تسعير الأصناف وأوقف الهدر فوراً.',
      };
    }

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
      decisionBadge,
    };
  }, [appData, startDate, endDate]);

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
    <div className="w-full max-w-6xl mx-auto flex flex-col gap-2.5 pb-8 text-slate-800" dir="rtl">
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

        {/* 11. المطابقة البنكية (تمتد لعمودين على الهاتف المحمول تماماً كالكود المطلوب) */}
        <div
          onClick={() => onNavigate('bank_reconciliation')}
          className="bg-white border border-slate-300 hover:border-blue-600 hover:bg-slate-50 rounded-lg p-2.5 sm:p-3 flex flex-col items-center justify-center gap-1.5 cursor-pointer relative shadow-xs transition-all select-none group col-span-2 sm:col-span-1 md:col-span-2"
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
      </div>

      {/* ملخص المؤشرات المالية والتشغيلية مع أداة تحليل الأرباح السريعة */}
      <div className="bg-white border border-slate-300 rounded-lg p-3 sm:p-4 flex flex-col gap-2.5 shadow-xs mt-1">
        <div className="border-b border-slate-200 pb-2 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="text-[11px] sm:text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <span>ملخص المؤشرات المالية والتشغيلية</span>
          </div>

          {/* 📊 زر أداة تحليل الأرباح والخسائر لفترات مخصصة */}
          <button
            type="button"
            onClick={() => setIsPnlModalOpen(true)}
            className="text-[10px] sm:text-[11px] font-bold px-2.5 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors flex items-center gap-1.5 cursor-pointer"
            title="تحليل الأرباح والخسائر لمبيعات فترة مخصصة لاتخاذ القرار"
          >
            <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
            <span>أداة تحليل الأرباح لفترة مخصصة 🎯</span>
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

      {/* 📊 النافذة المنبثقة: تقرير وتحليل أرباح وخسائر الفترات المخصصة لاتخاذ القرار */}
      {isPnlModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 my-auto animate-in fade-in zoom-in-95 duration-200" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900">
                    تقرير أرباح وخسائر فترات مخصصة (أداة اتخاذ القرار)
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    تحليل فوري دقيق لربحية مبيعات الفترة المحددة وتكلفة البضاعة المباعة
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPnlModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

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

            {/* Footer Actions */}
            <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
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
