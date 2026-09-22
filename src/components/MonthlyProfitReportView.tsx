import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area,
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  PackageCheck,
  Percent,
  Calendar,
  Download,
  Printer,
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  BarChart3,
  LineChart as LineChartIcon,
  HelpCircle,
  Award,
} from 'lucide-react';
import { AppData, SaleInvoice } from '../types';
import { exportToExcel, ExcelColumn } from '../utils/excelExport';

interface MonthlyProfitReportViewProps {
  appData: AppData;
  onNavigate?: (page: string) => void;
}

interface MonthProfitRow {
  key: string; // e.g. "2026-03"
  year: number;
  monthNum: number;
  monthName: string;
  invoicesCount: number;
  grossSales: number;
  salesReturns: number;
  netSales: number;
  cogs: number; // Cost of Goods Sold
  grossProfit: number; // Net Sales - COGS
  grossMarginPct: number; // (grossProfit / netSales) * 100
  operatingExpenses: number;
  netProfit: number; // grossProfit - operatingExpenses
  growthRatePct: number; // vs previous month
}

const ARABIC_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

export const MonthlyProfitReportView: React.FC<MonthlyProfitReportViewProps> = ({
  appData,
  onNavigate,
}) => {
  const currency = appData.settings?.currencySymbol || 'ج.م';
  const currentYear = new Date().getFullYear();

  // Year filter state
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [activeChartTab, setActiveChartTab] = useState<'comparison' | 'growth' | 'margin'>('comparison');

  // Available years from sales invoices
  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>();
    yearsSet.add(currentYear.toString());
    (appData.salesInvoices || []).forEach((inv) => {
      if (inv.date) {
        const y = inv.date.substring(0, 4);
        if (y && !isNaN(Number(y))) yearsSet.add(y);
      }
    });
    return Array.from(yearsSet).sort((a, b) => Number(b) - Number(a));
  }, [appData.salesInvoices, currentYear]);

  // Fast item cost lookup map
  const itemCostMap = useMemo(() => {
    const map: Record<string, number> = {};
    (appData.items || []).forEach((item) => {
      const cost = Number(item.purchasePrice || item.costPrice || (item as any).averageCostPrice || 0);
      if (item.id) map[item.id] = cost;
      if (item.barcode) map[item.barcode] = cost;
      if (item.name) map[item.name.trim().toLowerCase()] = cost;
    });
    return map;
  }, [appData.items]);

  // Calculate monthly analytics
  const monthlyData = useMemo(() => {
    const monthsMap: Record<string, {
      invoicesCount: number;
      grossSales: number;
      salesReturns: number;
      cogs: number;
      expenses: number;
    }> = {};

    // Initialize all 12 months for the selected year
    const targetYearNum = Number(selectedYear);
    for (let m = 1; m <= 12; m++) {
      const monthKey = `${targetYearNum}-${String(m).padStart(2, '0')}`;
      monthsMap[monthKey] = {
        invoicesCount: 0,
        grossSales: 0,
        salesReturns: 0,
        cogs: 0,
        expenses: 0,
      };
    }

    // 1. Process Sales Invoices
    (appData.salesInvoices || []).forEach((inv) => {
      if (!inv.date || inv.status === 'cancelled') return;
      const invYear = inv.date.substring(0, 4);
      if (selectedYear !== 'all' && invYear !== selectedYear) return;

      const monthKey = inv.date.substring(0, 7);
      if (!monthsMap[monthKey]) {
        monthsMap[monthKey] = { invoicesCount: 0, grossSales: 0, salesReturns: 0, cogs: 0, expenses: 0 };
      }

      const isReturn = (inv as any).isReturn === true || (inv as any).type === 'return';
      const invTotal = Math.abs(Number((inv as any).grandTotal ?? (inv as any).finalTotal ?? inv.total ?? 0));

      if (isReturn) {
        monthsMap[monthKey].salesReturns += invTotal;
      } else {
        monthsMap[monthKey].grossSales += invTotal;
        monthsMap[monthKey].invoicesCount += 1;
      }

      // Calculate COGS per line item
      let invoiceCogs = 0;
      if (Array.isArray(inv.items)) {
        inv.items.forEach((line) => {
          const qty = Number((line as any).quantity || line.qty || 1);
          let unitCost = Number(line.costPrice || 0);
          if (unitCost <= 0) {
            unitCost =
              (line.itemId && itemCostMap[line.itemId]) ||
              ((line as any).barcode && itemCostMap[(line as any).barcode]) ||
              (line.name && itemCostMap[line.name.trim().toLowerCase()]) ||
              0;
          }
          invoiceCogs += qty * unitCost;
        });
      }

      if (isReturn) {
        monthsMap[monthKey].cogs -= invoiceCogs;
      } else {
        monthsMap[monthKey].cogs += invoiceCogs;
      }
    });

    // 2. Process Operating Expenses (Cash out transactions)
    (appData.cashTransactions || []).forEach((tx) => {
      if (!tx.date) return;
      const txYear = tx.date.substring(0, 4);
      if (selectedYear !== 'all' && txYear !== selectedYear) return;

      const monthKey = tx.date.substring(0, 7);
      if (!monthsMap[monthKey]) {
        monthsMap[monthKey] = { invoicesCount: 0, grossSales: 0, salesReturns: 0, cogs: 0, expenses: 0 };
      }

      if (tx.type === 'pay' || (tx as any).type === 'expense' || (tx as any).type === 'payment') {
        monthsMap[monthKey].expenses += Math.abs(Number(tx.amount || 0));
      }
    });

    // 3. Build sorted result rows and compute growth
    const sortedKeys = Object.keys(monthsMap).sort();
    let previousGrossProfit: number | null = null;

    const rows: MonthProfitRow[] = sortedKeys.map((key) => {
      const raw = monthsMap[key];
      const parts = key.split('-');
      const y = Number(parts[0]);
      const m = Number(parts[1]);
      const monthName = `${ARABIC_MONTHS[m - 1]} ${y}`;

      const netSales = Math.max(0, raw.grossSales - raw.salesReturns);
      const safeCogs = Math.max(0, raw.cogs);
      const grossProfit = netSales - safeCogs;
      const grossMarginPct = netSales > 0 ? (grossProfit / netSales) * 100 : 0;
      const netProfit = grossProfit - raw.expenses;

      let growthRatePct = 0;
      if (previousGrossProfit !== null && previousGrossProfit !== 0) {
        growthRatePct = ((grossProfit - previousGrossProfit) / Math.abs(previousGrossProfit)) * 100;
      }
      if (grossProfit > 0 || netSales > 0) {
        previousGrossProfit = grossProfit;
      }

      return {
        key,
        year: y,
        monthNum: m,
        monthName,
        invoicesCount: raw.invoicesCount,
        grossSales: raw.grossSales,
        salesReturns: raw.salesReturns,
        netSales,
        cogs: safeCogs,
        grossProfit,
        grossMarginPct: Number(grossMarginPct.toFixed(1)),
        operatingExpenses: raw.expenses,
        netProfit,
        growthRatePct: Number(growthRatePct.toFixed(1)),
      };
    });

    return rows;
  }, [appData.salesInvoices, appData.cashTransactions, selectedYear, itemCostMap]);

  // Overall Totals
  const totals = useMemo(() => {
    let grossSales = 0;
    let salesReturns = 0;
    let netSales = 0;
    let cogs = 0;
    let grossProfit = 0;
    let expenses = 0;
    let netProfit = 0;
    let invoicesCount = 0;
    let bestMonth: MonthProfitRow | null = null;

    monthlyData.forEach((row) => {
      grossSales += row.grossSales;
      salesReturns += row.salesReturns;
      netSales += row.netSales;
      cogs += row.cogs;
      grossProfit += row.grossProfit;
      expenses += row.operatingExpenses;
      netProfit += row.netProfit;
      invoicesCount += row.invoicesCount;

      if (!bestMonth || row.grossProfit > bestMonth.grossProfit) {
        if (row.grossProfit > 0) bestMonth = row;
      }
    });

    const overallMarginPct = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

    return {
      grossSales,
      salesReturns,
      netSales,
      cogs,
      grossProfit,
      expenses,
      netProfit,
      invoicesCount,
      overallMarginPct: Number(overallMarginPct.toFixed(1)),
      bestMonth,
    };
  }, [monthlyData]);

  // Excel Export Handler
  const handleExportExcel = () => {
    const columns: ExcelColumn<MonthProfitRow>[] = [
      { header: 'الشهر', getValue: (r) => r.monthName },
      { header: 'عدد الفواتير', getValue: (r) => r.invoicesCount, isNumeric: true },
      { header: 'إجمالي المبيعات', getValue: (r) => r.grossSales, isCurrency: true },
      { header: 'مردودات المبيعات', getValue: (r) => r.salesReturns, isCurrency: true },
      { header: 'صافي المبيعات', getValue: (r) => r.netSales, isCurrency: true },
      { header: 'تكلفة البضاعة المباعة (COGS)', getValue: (r) => r.cogs, isCurrency: true },
      { header: 'مجمل ربح النشاط', getValue: (r) => r.grossProfit, isCurrency: true },
      { header: 'نسبة هامش الربح %', getValue: (r) => `${r.grossMarginPct}%` },
      { header: 'المصروفات التشغيلية', getValue: (r) => r.operatingExpenses, isCurrency: true },
      { header: 'صافي الأرباح', getValue: (r) => r.netProfit, isCurrency: true },
      { header: 'معدل النمو الشهري %', getValue: (r) => `${r.growthRatePct}%` },
    ];

    exportToExcel({
      filename: `تقرير_الأرباح_الشهرية_وتكلفة_المبيعات_${selectedYear}.xlsx`,
      sheetName: 'الأرباح الشهرية',
      columns,
      data: monthlyData,
      reportTitle: `تقرير الأرباح الشهرية وتكلفة البضاعة المباعة (COGS) لعام ${selectedYear}`,
      companyName: appData.settings.companyName,
    });
  };

  // Print Handler
  const handlePrint = () => {
    window.print();
  };

  // Chart data formatted
  const chartData = useMemo(() => {
    return monthlyData.map((row) => ({
      name: ARABIC_MONTHS[row.monthNum - 1],
      fullName: row.monthName,
      'صافي المبيعات': Math.round(row.netSales),
      'تكلفة البضاعة المباعة (COGS)': Math.round(row.cogs),
      'مجمل الربح': Math.round(row.grossProfit),
      'صافي الربح': Math.round(row.netProfit),
      'نسبة النمو %': row.growthRatePct,
      'هامش الربح %': row.grossMarginPct,
    }));
  }, [monthlyData]);

  return (
    <div dir="rtl" className="space-y-5 print:space-y-3">
      {/* Header & Controls */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-700">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-[#1a237e]">
                تقرير الأرباح الشهرية وتكلفة المبيعات (COGS)
              </h1>
              <p className="text-xs text-slate-500">
                مقارنة صافي المبيعات مع تكلفة البضاعة المباعة وحساب هوامش الربح ومعدلات النمو الشهرية بدقة
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap no-print">
          {/* Year Filter */}
          <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl px-3 py-1.5 border border-slate-200 text-xs font-bold text-slate-700">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span>السنة المالية:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2 py-1 font-bold text-[#1a237e] focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
              <option value="all">كافة السنوات</option>
            </select>
          </div>

          {/* Export Excel Button */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
            title="تصدير إكسيل"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>تصدير Excel</span>
          </button>

          {/* Print Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
            title="طباعة التقرير"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Net Sales */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 block mb-1">صافي المبيعات</span>
            <span className="text-lg sm:text-xl font-black text-[#1a237e]">
              {totals.netSales.toLocaleString()} <small className="text-xs font-normal">{currency}</small>
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5">
              من إجمالي {totals.invoicesCount} فاتورة
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-700 flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Total COGS */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 block mb-1">تكلفة البضاعة المباعة (COGS)</span>
            <span className="text-lg sm:text-xl font-black text-rose-600">
              {totals.cogs.toLocaleString()} <small className="text-xs font-normal">{currency}</small>
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5">
              تكلفة الشراء المباشرة للمبيعات
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
            <PackageCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Gross Profit */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 block mb-1">مجمل ربح النشاط</span>
            <span className={`text-lg sm:text-xl font-black ${totals.grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
              {totals.grossProfit.toLocaleString()} <small className="text-xs font-normal">{currency}</small>
            </span>
            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 mt-0.5">
              <Percent className="w-3.5 h-3.5" />
              <span>هامش ربح: {totals.overallMarginPct}%</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-700 flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Best Month Card */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 block mb-1">الشهر الأعلى ربحية</span>
            {totals.bestMonth ? (
              <>
                <span className="text-base sm:text-lg font-black text-indigo-900 block truncate">
                  {totals.bestMonth.monthName}
                </span>
                <span className="text-[11px] font-bold text-indigo-700 block mt-0.5">
                  أرباح: {totals.bestMonth.grossProfit.toLocaleString()} {currency}
                </span>
              </>
            ) : (
              <span className="text-sm font-bold text-slate-400">لا توجد بيانات كافية</span>
            )}
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-700 flex items-center justify-center shrink-0">
            <Award className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Interactive Growth & Comparison Charts with Recharts */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
        {/* Chart View Switcher */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <h2 className="text-sm sm:text-base font-black text-slate-800 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <span>الرسوم البيانية التفاعلية للنمو وتكلفة المبيعات</span>
            </h2>
            <p className="text-xs text-slate-500">تحليل الاتجاهات والمقارنات الشهرية باستخدام Recharts</p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl no-print self-stretch sm:self-auto justify-center">
            <button
              type="button"
              onClick={() => setActiveChartTab('comparison')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeChartTab === 'comparison'
                  ? 'bg-white text-[#1a237e] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📊 المبيعات vs التكلفة vs الربح
            </button>
            <button
              type="button"
              onClick={() => setActiveChartTab('growth')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeChartTab === 'growth'
                  ? 'bg-white text-[#1a237e] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📈 منحنى نمو الأرباح
            </button>
            <button
              type="button"
              onClick={() => setActiveChartTab('margin')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeChartTab === 'margin'
                  ? 'bg-white text-[#1a237e] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🎯 هوامش الربحية %
            </button>
          </div>
        </div>

        {/* Active Chart Component */}
        <div className="h-[320px] sm:h-[380px] w-full pt-2">
          {activeChartTab === 'comparison' && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 10, left: 10, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip
                  formatter={(value: any) => [`${Number(value).toLocaleString()} ${currency}`, '']}
                  labelFormatter={(label) => `شهر: ${label}`}
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    color: '#fff',
                    borderRadius: '12px',
                    border: 'none',
                    textAlign: 'right',
                    direction: 'rtl',
                    fontSize: '12px',
                  }}
                />
                <Legend
                  wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }}
                  iconType="circle"
                />
                <Bar dataKey="صافي المبيعات" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={40} />
                <Bar dataKey="تكلفة البضاعة المباعة (COGS)" fill="#f43f5e" radius={[6, 6, 0, 0]} maxBarSize={40} />
                <Bar dataKey="مجمل الربح" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}

          {activeChartTab === 'growth' && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 20, right: 10, left: 10, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip
                  formatter={(value: any, name: string) => [
                    name.includes('%') ? `${value}%` : `${Number(value).toLocaleString()} ${currency}`,
                    name,
                  ]}
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    color: '#fff',
                    borderRadius: '12px',
                    border: 'none',
                    textAlign: 'right',
                    direction: 'rtl',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />
                <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                <Line
                  type="monotone"
                  dataKey="مجمل الربح"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ r: 5, fill: '#10b981' }}
                  activeDot={{ r: 7 }}
                />
                <Line
                  type="monotone"
                  dataKey="صافي الربح"
                  stroke="#6366f1"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 4, fill: '#6366f1' }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}

          {activeChartTab === 'margin' && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 20, right: 10, left: 10, bottom: 20 }}
              >
                <defs>
                  <linearGradient id="marginGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} unit="%" />
                <Tooltip
                  formatter={(val: any) => [`${val}%`, 'هامش الربح']}
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    color: '#fff',
                    borderRadius: '12px',
                    border: 'none',
                    textAlign: 'right',
                    direction: 'rtl',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />
                <Area
                  type="monotone"
                  dataKey="هامش الربح %"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#marginGrad)"
                  dot={{ r: 4, fill: '#10b981' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Detailed Monthly Breakdown: Cards on Mobile (No Horizontal Scrolling) & Table on Desktop */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm sm:text-base font-black text-[#1a237e]">
              جدول الأرباح الشهرية وتكلفة البضاعة المباعة التفصيلي
            </h2>
            <p className="text-xs text-slate-500">
              بيان تفصيلي لكل شهر بالقيم ونسب الهامش ومعدل النمو مقارنة بالشهر السابق
            </p>
          </div>
        </div>

        {/* Mobile View: Cards Layout (Strictly No Horizontal Overflow) */}
        <div className="block md:hidden space-y-3">
          {monthlyData.map((row) => (
            <div
              key={row.key}
              className={`rounded-xl p-3.5 border transition ${
                row.netSales > 0 ? 'bg-slate-50/60 border-slate-200' : 'bg-slate-50/30 border-slate-100 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-[#1a237e] text-sm">{row.monthName}</span>
                  <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold">
                    {row.invoicesCount} فواتير
                  </span>
                </div>
                {row.growthRatePct !== 0 && (
                  <span
                    className={`flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${
                      row.growthRatePct > 0
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {row.growthRatePct > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    {row.growthRatePct}%
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-white border border-slate-100">
                  <span className="text-[11px] text-slate-400 block">صافي المبيعات</span>
                  <span className="font-bold text-slate-900">{row.netSales.toLocaleString()} {currency}</span>
                </div>

                <div className="p-2 rounded-lg bg-white border border-slate-100">
                  <span className="text-[11px] text-slate-400 block">التكلفة (COGS)</span>
                  <span className="font-bold text-rose-600">{row.cogs.toLocaleString()} {currency}</span>
                </div>

                <div className="p-2 rounded-lg bg-emerald-50/50 border border-emerald-100">
                  <span className="text-[11px] text-emerald-700 block">مجمل الربح</span>
                  <span className="font-black text-emerald-700">{row.grossProfit.toLocaleString()} {currency}</span>
                </div>

                <div className="p-2 rounded-lg bg-emerald-50/50 border border-emerald-100">
                  <span className="text-[11px] text-emerald-700 block">هامش الربح</span>
                  <span className="font-black text-emerald-700">{row.grossMarginPct}%</span>
                </div>
              </div>

              {row.operatingExpenses > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">المصروفات: {row.operatingExpenses.toLocaleString()} {currency}</span>
                  <span className="font-bold text-indigo-900">
                    صافي الأرباح: {row.netProfit.toLocaleString()} {currency}
                  </span>
                </div>
              )}
            </div>
          ))}

          {/* Mobile Totals Card */}
          <div className="bg-[#1a237e] text-white rounded-xl p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between border-b border-white/20 pb-2">
              <span className="font-black text-amber-300 text-sm">الإجمالي العام السنوي</span>
              <span className="text-xs text-blue-200">{totals.invoicesCount} فواتير</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-blue-200 block text-[11px]">صافي المبيعات:</span>
                <span className="font-bold text-white">{totals.netSales.toLocaleString()} {currency}</span>
              </div>
              <div>
                <span className="text-blue-200 block text-[11px]">إجمالي التكلفة:</span>
                <span className="font-bold text-rose-300">{totals.cogs.toLocaleString()} {currency}</span>
              </div>
              <div>
                <span className="text-blue-200 block text-[11px]">مجمل الربح:</span>
                <span className="font-black text-emerald-300">{totals.grossProfit.toLocaleString()} {currency}</span>
              </div>
              <div>
                <span className="text-blue-200 block text-[11px]">متوسط الهامش:</span>
                <span className="font-black text-amber-300">{totals.overallMarginPct}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop View: Full Analytical Data Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-right text-xs border border-slate-200 rounded-xl overflow-hidden">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3">الشهر</th>
                <th className="p-3 text-center">الفواتير</th>
                <th className="p-3 text-left">إجمالي المبيعات</th>
                <th className="p-3 text-left text-amber-700">المردودات</th>
                <th className="p-3 text-left text-blue-700">صافي المبيعات</th>
                <th className="p-3 text-left text-rose-600">تكلفة البضاعة (COGS)</th>
                <th className="p-3 text-left text-emerald-700">مجمل الربح</th>
                <th className="p-3 text-center">هامش الربح %</th>
                <th className="p-3 text-left text-slate-600">المصروفات</th>
                <th className="p-3 text-left text-indigo-900">صافي الأرباح</th>
                <th className="p-3 text-center">النمو الشهري</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {monthlyData.map((row) => (
                <tr
                  key={row.key}
                  className={`hover:bg-blue-50/40 transition ${
                    row.netSales > 0 ? '' : 'text-slate-400'
                  }`}
                >
                  <td className="p-3 font-bold text-slate-800">{row.monthName}</td>
                  <td className="p-3 text-center">{row.invoicesCount}</td>
                  <td className="p-3 text-left font-mono">{row.grossSales.toLocaleString()}</td>
                  <td className="p-3 text-left font-mono text-amber-700">
                    {row.salesReturns > 0 ? `-${row.salesReturns.toLocaleString()}` : '0'}
                  </td>
                  <td className="p-3 text-left font-mono font-bold text-blue-800">
                    {row.netSales.toLocaleString()}
                  </td>
                  <td className="p-3 text-left font-mono font-bold text-rose-600">
                    {row.cogs.toLocaleString()}
                  </td>
                  <td className="p-3 text-left font-mono font-black text-emerald-700">
                    {row.grossProfit.toLocaleString()}
                  </td>
                  <td className="p-3 text-center font-bold">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] ${
                        row.grossMarginPct >= 25
                          ? 'bg-emerald-100 text-emerald-800'
                          : row.grossMarginPct > 0
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {row.grossMarginPct}%
                    </span>
                  </td>
                  <td className="p-3 text-left font-mono text-slate-600">
                    {row.operatingExpenses.toLocaleString()}
                  </td>
                  <td className="p-3 text-left font-mono font-black text-indigo-900">
                    {row.netProfit.toLocaleString()}
                  </td>
                  <td className="p-3 text-center">
                    {row.growthRatePct !== 0 ? (
                      <span
                        className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          row.growthRatePct > 0
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {row.growthRatePct > 0 ? '+' : ''}
                        {row.growthRatePct}%
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Table Footer Totals */}
            <tfoot className="bg-slate-900 text-white font-bold border-t-2 border-slate-700">
              <tr>
                <td className="p-3 font-black text-amber-300">الإجمالي السنوي العام</td>
                <td className="p-3 text-center text-blue-200">{totals.invoicesCount}</td>
                <td className="p-3 text-left font-mono">{totals.grossSales.toLocaleString()}</td>
                <td className="p-3 text-left font-mono text-amber-300">
                  {totals.salesReturns > 0 ? `-${totals.salesReturns.toLocaleString()}` : '0'}
                </td>
                <td className="p-3 text-left font-mono font-black text-blue-300">
                  {totals.netSales.toLocaleString()}
                </td>
                <td className="p-3 text-left font-mono font-black text-rose-300">
                  {totals.cogs.toLocaleString()}
                </td>
                <td className="p-3 text-left font-mono font-black text-emerald-400">
                  {totals.grossProfit.toLocaleString()}
                </td>
                <td className="p-3 text-center text-amber-300">{totals.overallMarginPct}%</td>
                <td className="p-3 text-left font-mono text-slate-300">
                  {totals.expenses.toLocaleString()}
                </td>
                <td className="p-3 text-left font-mono font-black text-white">
                  {totals.netProfit.toLocaleString()}
                </td>
                <td className="p-3 text-center text-slate-400">-</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
export default MonthlyProfitReportView;
