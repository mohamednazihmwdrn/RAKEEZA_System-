import React from 'react';
import {
  LayoutDashboard,
  Building2,
  Zap,
  ShoppingCart,
  Package,
  Wallet,
  Users,
  Tag,
  CreditCard,
  UserCheck,
  Briefcase,
  Boxes,
  Factory,
  Scale,
  BarChart3,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  AlertTriangle,
  Layers,
  Clock,
  CheckCircle2,
  ChevronLeft,
  Landmark,
  Smartphone,
  Receipt,
  FolderTree,
  FileText,
  ShoppingBag,
  Inbox,
} from 'lucide-react';
import { AppData, User } from '../types';
import {
  calculateAllActualInventoryStocks,
  auditCompanyFinancialIntegrity,
  calculateCustomerBalance,
  calculateSupplierBalance,
} from '../utils/accounting';

interface HomeViewProps {
  appData: AppData;
  onNavigate: (page: string) => void;
  currentUser?: User;
}

export const HomeView: React.FC<HomeViewProps> = ({ appData, onNavigate, currentUser }) => {
  // 1. Accurate Accounting Engine Audit
  const financialAudit = auditCompanyFinancialIntegrity(appData);
  const actualStockMap = calculateAllActualInventoryStocks(appData);

  const totalSales = financialAudit.netSales;
  const totalPurchases = financialAudit.netPurchases;
  const totalReceivables = financialAudit.totalReceivables;
  const totalPayables = financialAudit.totalPayables;
  const totalLiquidAssets = financialAudit.liquidAssets.total;
  const stockValue = financialAudit.inventoryValuation;

  const activeBranch =
    appData?.branches?.find((b) => b.id === appData?.activeBranchId) ||
    appData?.branches?.[0];

  const salesCount = (appData?.salesInvoices || []).length;
  const purchasesCount = (appData?.purchaseInvoices || []).length;
  const cashCount = (appData?.cashTransactions || []).length;
  const itemsCount = (appData?.items || []).length;

  // Real liquid breakdown
  const drawerCash = Number(appData?.cashBox?.drawer || 0);
  const vodafoneCash = Number(appData?.cashBox?.vodafone || 0);
  const instapayCash = Number(appData?.cashBox?.instapay || 0);
  const bankCash = Number(appData?.cashBox?.bank || 0);

  // Debtor & Creditor counts
  const debtorCustomers = (appData?.customers || []).filter(
    (c) => calculateCustomerBalance(c, appData).balance > 0
  );
  const creditorSuppliers = (appData?.suppliers || []).filter(
    (s) => calculateSupplierBalance(s, appData).balance > 0
  );

  // Operational Alerts
  const lowStockItems = (appData?.items || []).filter((item) => {
    const stock = actualStockMap[item.id] !== undefined ? actualStockMap[item.id] : Number(item.quantity) || 0;
    const min = Number(item.minStockAlert) || 5;
    return stock <= min;
  });

  const chequesUnderCollection = (appData?.cheques || []).filter(
    (c) => c.status === 'under_collection' || c.status === 'received'
  );

  const pendingWebOrders = ((appData as any)?.webOrders || (appData as any)?.onlineOrders || []).filter(
    (o: any) => o.status === 'pending'
  );

  const pendingBankCount = (appData?.approvalRequests || []).filter(
    (b) => b.status === 'pending'
  ).length;

  // Operational modules counts
  const pricedItemsCount = (appData?.items || []).filter(
    (it) => Number(it.salePrice || it.price) > 0
  ).length;
  const activeSalesRepsCount = (appData?.salesReps || []).filter(
    (r) => r.status !== 'inactive'
  ).length;
  const employeesCount = (appData?.employees || []).length;
  const fixedAssetsCount = (appData?.fixedAssets || []).length;
  const workOrdersCount = (
    appData?.workOrders ||
    appData?.productionOrders ||
    []
  ).filter((w) => w.status === 'in_progress').length;

  // Build Recent 5 Activities
  interface ActivityItem {
    id: string | number;
    type: 'sale' | 'purchase' | 'cash_in' | 'cash_out';
    label: string;
    party: string;
    date: string;
    amount: number;
    link: string;
  }

  const recentActivities: ActivityItem[] = [];

  (appData?.salesInvoices || []).forEach((inv) => {
    if (!inv || inv.status === 'cancelled') return;
    recentActivities.push({
      id: inv.id,
      type: 'sale',
      label: 'فاتورة بيع',
      party: inv.customerName || 'عميل نقدي',
      date: inv.date || '',
      amount: Number(inv.total || 0),
      link: 'sales',
    });
  });

  (appData?.purchaseInvoices || []).forEach((inv) => {
    if (!inv || (inv as any).status === 'cancelled') return;
    recentActivities.push({
      id: inv.id,
      type: 'purchase',
      label: 'فاتورة توريد',
      party: inv.supplierName || 'مورد عام',
      date: inv.date || '',
      amount: Number(inv.total || 0),
      link: 'purchases',
    });
  });

  (appData?.cashTransactions || []).forEach((tx) => {
    if (!tx) return;
    const isReceive = tx.type === 'receive' || tx.type === 'deposit';
    recentActivities.push({
      id: tx.id,
      type: isReceive ? 'cash_in' : 'cash_out',
      label: isReceive ? 'سند قبض' : 'سند صرف',
      party: (tx as any).partyName || (tx as any).customerName || (tx as any).supplierName || (tx as any).description || (tx as any).notes || 'حساب الخزينة',
      date: tx.date || '',
      amount: Number(tx.amount || 0),
      link: 'cash',
    });
  });

  recentActivities.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const topRecentActivities = recentActivities.slice(0, 5);

  return (
    <div className="space-y-5 pb-16 max-w-6xl mx-auto px-2.5 sm:px-4 select-none" dir="rtl">
      {/* 1. Executive Header & Synchronization Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-b border-slate-200/90 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-900/10 text-blue-900 flex items-center justify-center shrink-0">
            <LayoutDashboard className="w-5 h-5 text-blue-900" />
          </div>
          <div>
            <h1 className="font-black text-slate-900 text-base sm:text-lg tracking-tight">
              لوحة القيادة والمتابعة المالية
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              نظرة شمولية موحدة على المبيعات، المشتريات، الخزائن، والديون
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            نظام ركيزة متزامن ومحمي
          </span>
        </div>
      </div>

      {/* 2. Unified Company Identity & Quick Action Launchpad */}
      <div className="bg-gradient-to-r from-[#0f2756] via-[#1a365d] to-[#1e3a8a] text-white p-4 sm:p-5 rounded-xl shadow-xs border border-blue-900/50 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold bg-amber-400 text-slate-950 px-2 py-0.5 rounded">
                منظومة ركيزة المحاسبية
              </span>
              {appData?.settings?.commercialReg && (
                <span className="text-[11px] text-blue-200 font-mono">
                  س.ت: {appData.settings.commercialReg}
                </span>
              )}
              {appData?.settings?.taxNumber && (
                <span className="text-[11px] text-blue-200 font-mono hidden sm:inline">
                  ب.ض: {appData.settings.taxNumber}
                </span>
              )}
            </div>
            <h2 className="font-black text-base sm:text-xl text-white tracking-wide">
              {appData?.settings?.companyName || 'منظومة RAKEEZA للمحاسبة والإدارة'}
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-blue-200 text-xs font-medium">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-300 shrink-0" />
                الفرع النشط: {activeBranch?.name || 'الفرع الرئيسي والمخزن المركزي'}
              </span>
              {currentUser && (
                <span className="flex items-center gap-1.5 text-blue-100">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  المستخدم: {currentUser.name} ({currentUser.role === 'admin' ? 'مدير عام' : 'مستخدم مصرح'})
                </span>
              )}
            </div>
          </div>

          <div className="hidden md:flex w-12 h-12 rounded-xl bg-white/10 border border-white/15 items-center justify-center text-amber-300 shrink-0 shadow-inner">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        {/* Quick Launchpad Buttons (Unified Button Styles) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={() => onNavigate('pos')}
            className="h-10 px-3 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 font-bold text-xs sm:text-sm rounded-lg transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            <Zap className="w-4 h-4 text-slate-950 shrink-0" />
            <span className="truncate">نقطة البيع (POS)</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('sales')}
            className="h-10 px-3 bg-white/10 hover:bg-white/20 active:bg-white/25 text-white font-semibold text-xs sm:text-sm rounded-lg transition flex items-center justify-center gap-2 cursor-pointer border border-white/15"
          >
            <ShoppingCart className="w-4 h-4 text-blue-300 shrink-0" />
            <span className="truncate">فاتورة بيع</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('purchases')}
            className="h-10 px-3 bg-white/10 hover:bg-white/20 active:bg-white/25 text-white font-semibold text-xs sm:text-sm rounded-lg transition flex items-center justify-center gap-2 cursor-pointer border border-white/15"
          >
            <Package className="w-4 h-4 text-blue-200 shrink-0" />
            <span className="truncate">فاتورة توريد</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('cash')}
            className="h-10 px-3 bg-white/10 hover:bg-white/20 active:bg-white/25 text-white font-semibold text-xs sm:text-sm rounded-lg transition flex items-center justify-center gap-2 cursor-pointer border border-white/15"
          >
            <Wallet className="w-4 h-4 text-emerald-300 shrink-0" />
            <span className="truncate">سند قبض / صرف</span>
          </button>
        </div>
      </div>

      {/* 3. GROUP 1: FINANCIAL OVERVIEW (4 Unique KPI Pillars) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs sm:text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            الموقف المالي والتعاملات
          </h2>
          <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
            مؤشرات مالية دقيقة ومحدثة لحظياً
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Sales */}
          <div
            onClick={() => onNavigate('sales')}
            className="erp-card erp-card-interactive group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500">صافي المبيعات</span>
              <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                <ShoppingCart className="w-4 h-4 text-blue-700" />
              </div>
            </div>
            <div>
              <div className="text-blue-950 text-lg sm:text-xl font-bold font-mono tracking-tight tabular-nums">
                {(totalSales || 0).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                <span className="text-xs font-bold text-slate-500 font-sans">ج.م</span>
              </div>
              <div className="text-[11px] text-slate-500 font-medium flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                <span>فواتير معتمدة</span>
                <span className="font-bold text-blue-700 font-mono">{salesCount} فاتورة</span>
              </div>
            </div>
          </div>

          {/* Card 2: Purchases */}
          <div
            onClick={() => onNavigate('purchases')}
            className="erp-card erp-card-interactive group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500">صافي المشتريات</span>
              <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                <Package className="w-4 h-4 text-slate-700" />
              </div>
            </div>
            <div>
              <div className="text-slate-900 text-lg sm:text-xl font-bold font-mono tracking-tight tabular-nums">
                {(totalPurchases || 0).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                <span className="text-xs font-bold text-slate-500 font-sans">ج.م</span>
              </div>
              <div className="text-[11px] text-slate-500 font-medium flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                <span>فواتير توريد</span>
                <span className="font-bold text-slate-800 font-mono">{purchasesCount} فاتورة</span>
              </div>
            </div>
          </div>

          {/* Card 3: Customer Receivables */}
          <div
            onClick={() => onNavigate('accounts')}
            className="erp-card erp-card-interactive group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500">ديون العملاء (لنا)</span>
              <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                <Users className="w-4 h-4 text-purple-700" />
              </div>
            </div>
            <div>
              <div className="text-purple-950 text-lg sm:text-xl font-bold font-mono tracking-tight tabular-nums">
                {(totalReceivables || 0).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                <span className="text-xs font-bold text-slate-500 font-sans">ج.م</span>
              </div>
              <div className="text-[11px] text-slate-500 font-medium flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                <span>العملاء المدينين</span>
                <span className="font-bold text-purple-700 font-mono">{debtorCustomers.length} عميل</span>
              </div>
            </div>
          </div>

          {/* Card 4: Supplier Payables */}
          <div
            onClick={() => onNavigate('accounts')}
            className="erp-card erp-card-interactive group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500">مستحقات الموردين (علينا)</span>
              <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                <Briefcase className="w-4 h-4 text-rose-700" />
              </div>
            </div>
            <div>
              <div className="text-rose-950 text-lg sm:text-xl font-bold font-mono tracking-tight tabular-nums">
                {(totalPayables || 0).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                <span className="text-xs font-bold text-slate-500 font-sans">ج.م</span>
              </div>
              <div className="text-[11px] text-slate-500 font-medium flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                <span>الموردين الدائنين</span>
                <span className="font-bold text-rose-700 font-mono">{creditorSuppliers.length} مورد</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. GROUP 3: CASH & BANK BREAKDOWN */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs sm:text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
            تفصيل الخزائن والسيولة البنكية
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('cash')}
            className="text-[11px] text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1 transition cursor-pointer"
          >
            <span>إدارة الحسابات</span>
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {/* Drawer */}
          <div
            onClick={() => onNavigate('cash')}
            className="erp-card erp-card-interactive group p-3 sm:p-4"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-500">درج النقدية</span>
              <div className="w-7 h-7 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Wallet className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-emerald-900 text-sm sm:text-base font-bold font-mono tabular-nums">
              {(drawerCash || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
              <span className="text-[10px] text-slate-400 font-sans font-normal">ج.م</span>
            </div>
          </div>

          {/* Vodafone Cash */}
          <div
            onClick={() => onNavigate('cash')}
            className="erp-card erp-card-interactive group p-3 sm:p-4"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-500">فودافون كاش</span>
              <div className="w-7 h-7 rounded-md bg-rose-50 text-rose-700 flex items-center justify-center">
                <Smartphone className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-rose-900 text-sm sm:text-base font-bold font-mono tabular-nums">
              {(vodafoneCash || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
              <span className="text-[10px] text-slate-400 font-sans font-normal">ج.م</span>
            </div>
          </div>

          {/* InstaPay */}
          <div
            onClick={() => onNavigate('cash')}
            className="erp-card erp-card-interactive group p-3 sm:p-4"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-500">إنستاباي</span>
              <div className="w-7 h-7 rounded-md bg-purple-50 text-purple-700 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-purple-900 text-sm sm:text-base font-bold font-mono tabular-nums">
              {(instapayCash || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
              <span className="text-[10px] text-slate-400 font-sans font-normal">ج.م</span>
            </div>
          </div>

          {/* Bank Accounts */}
          <div
            onClick={() => onNavigate('treasury')}
            className="erp-card erp-card-interactive group p-3 sm:p-4"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-500">الحساب البنكي</span>
              <div className="w-7 h-7 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center">
                <Landmark className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-blue-900 text-sm sm:text-base font-bold font-mono tabular-nums">
              {(bankCash || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
              <span className="text-[10px] text-slate-400 font-sans font-normal">ج.م</span>
            </div>
          </div>
        </div>
      </div>

      {/* 6. GROUP 4: ALERTS & OPERATIONAL RADAR */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs sm:text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            التنبيهات العاجلة والرادار التشغيلي
          </h2>
          <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
            إشعارات تحتاج إلى متابعة إدارية
          </span>
        </div>

        {lowStockItems.length === 0 && chequesUnderCollection.length === 0 && pendingWebOrders.length === 0 ? (
          <div className="erp-card bg-emerald-50/60 border-emerald-200/80 p-3.5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <span className="text-xs font-bold text-emerald-950 block">
                موقف المنظومة مستقر تماماً
              </span>
              <span className="text-[11px] text-emerald-800 font-medium">
                لا توجد نواقص في حد الطلب أو أوراق قبض متأخرة أو طلبات معلقة اليوم
              </span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lowStockItems.length > 0 && (
              <div
                onClick={() => onNavigate('items')}
                className="bg-amber-50/90 border border-amber-200 rounded-xl p-3 flex items-center justify-between cursor-pointer hover:bg-amber-100/70 transition shadow-2xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-amber-200 text-amber-900 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-bold text-amber-950 truncate">
                      أصناف قاربت حد الطلب
                    </div>
                    <div className="text-[11px] text-amber-800 truncate">
                      يوجد {lowStockItems.length} صنف يتطلب إعادة الشراء
                    </div>
                  </div>
                </div>
                <span className="text-xs font-bold text-amber-900 flex items-center gap-1 font-mono shrink-0 mr-2">
                  معاينة <ArrowUpRight className="w-3.5 h-3.5" />
                </span>
              </div>
            )}

            {chequesUnderCollection.length > 0 && (
              <div
                onClick={() => onNavigate('cheques')}
                className="bg-blue-50/90 border border-blue-200 rounded-xl p-3 flex items-center justify-between cursor-pointer hover:bg-blue-100/70 transition shadow-2xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-200 text-blue-900 flex items-center justify-center shrink-0">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-bold text-blue-950 truncate">
                      شيكات قيد التحصيل
                    </div>
                    <div className="text-[11px] text-blue-800 truncate">
                      يوجد {chequesUnderCollection.length} ورقة قبض مستحقة
                    </div>
                  </div>
                </div>
                <span className="text-xs font-bold text-blue-900 flex items-center gap-1 font-mono shrink-0 mr-2">
                  متابعة <ArrowUpRight className="w-3.5 h-3.5" />
                </span>
              </div>
            )}

            {pendingWebOrders.length > 0 && (
              <div
                onClick={() => onNavigate('web_orders')}
                className="bg-purple-50/90 border border-purple-200 rounded-xl p-3 flex items-center justify-between cursor-pointer hover:bg-purple-100/70 transition shadow-2xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-purple-200 text-purple-900 flex items-center justify-center shrink-0">
                    <Inbox className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-bold text-purple-950 truncate">
                      طلبات متجر سحابية واردة
                    </div>
                    <div className="text-[11px] text-purple-800 truncate">
                      يوجد {pendingWebOrders.length} طلب بحاجة للمراجعة
                    </div>
                  </div>
                </div>
                <span className="text-xs font-bold text-purple-900 flex items-center gap-1 font-mono shrink-0 mr-2">
                  معاينة <ArrowUpRight className="w-3.5 h-3.5" />
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 7. GROUP 5: RECENT ACTIVITIES (Last 5 Real Transactions) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs sm:text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-700"></span>
            أحدث الحركات والعمليات المسجلة
          </h2>
          <span className="text-[11px] text-slate-400 font-medium">
            آخر 5 قيود معتمدة
          </span>
        </div>

        {topRecentActivities.length === 0 ? (
          <div className="erp-card text-center py-6 text-slate-400 text-xs">
            لم تسجل أي فواتير أو سندات حديثة بعد
          </div>
        ) : (
          <div className="erp-card p-0 overflow-hidden divide-y divide-slate-100">
            {topRecentActivities.map((act, index) => {
              const isIncome = act.type === 'sale' || act.type === 'cash_in';
              return (
                <div
                  key={`${act.type}-${act.id}-${index}`}
                  onClick={() => onNavigate(act.link)}
                  className="p-3 sm:p-3.5 hover:bg-slate-50/80 transition cursor-pointer flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isIncome ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {isIncome ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{act.label}</span>
                        <span className="text-[10px] text-slate-400 font-mono">#{act.id}</span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium truncate block">
                        الطرف: {act.party}
                      </span>
                    </div>
                  </div>

                  <div className="text-left shrink-0">
                    <div
                      className={`text-xs sm:text-sm font-bold font-mono tabular-nums ${
                        isIncome ? 'text-emerald-700' : 'text-slate-900'
                      }`}
                    >
                      {isIncome ? '+' : '-'}{act.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
                      <span className="text-[10px] font-sans font-normal text-slate-400">ج.م</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono block">
                      {act.date}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
