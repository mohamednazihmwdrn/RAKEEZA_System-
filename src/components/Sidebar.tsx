import React, { useState } from 'react';
import {
  LayoutDashboard,
  Zap,
  ShoppingCart,
  Tag,
  FileText,
  Target,
  Inbox,
  ShoppingBag,
  Globe,
  Package,
  Wallet,
  Users,
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  UserCheck,
  Briefcase,
  Building2,
  Factory,
  Scale,
  FolderTree,
  Boxes,
  GitBranch,
  BookOpen,
  Receipt,
  TrendingUp,
  BarChart3,
  Landmark,
  History,
  Settings,
  UserCog,
  ShieldCheck,
  LogOut,
  ChevronDown,
  ChevronLeft,
  Folder,
  FileBarChart,
  X,
} from 'lucide-react';
import { User } from '../types';
import { canAccessPage } from '../utils/permissions';
import {
  vendorReports,
  purchaseReports,
  customerReports,
  salesReports,
  inventoryReports,
  financialReports,
  receiptsReports,
  paymentsReports,
  repsReports,
  banksReports,
  miscReports,
} from '../utils/reportsData';

interface SidebarProps {
  isOpen: boolean;
  activePage: string;
  onNavigate: (page: string) => void;
  pendingWebOrdersCount?: number;
  onClose?: () => void;
  onLogout?: () => void;
  currentUser?: User;
  companyName?: string;
  branchesCount?: number;
  usersCount?: number;
  activeBranchName?: string;
}

interface ReportGroupDef {
  key: string;
  label: string;
  reports: string[];
}

const reportGroups: ReportGroupDef[] = [
  { key: 'vendors', label: 'تقارير الموردين', reports: vendorReports },
  { key: 'purchases', label: 'تقارير المشتريات', reports: purchaseReports },
  { key: 'customers', label: 'تقارير العملاء', reports: customerReports },
  { key: 'sales', label: 'تقارير المبيعات', reports: salesReports },
  { key: 'inventory', label: 'تقارير المخزون والمستودعات', reports: inventoryReports },
  { key: 'financial', label: 'تقارير الأرباح والقوائم والضرائب', reports: financialReports },
  { key: 'receipts', label: 'تقارير المقبوضات', reports: receiptsReports },
  { key: 'payments', label: 'تقارير المدفوعات', reports: paymentsReports },
  { key: 'reps', label: 'تقارير المندوبين', reports: repsReports },
  { key: 'banks', label: 'تقارير البنوك والوسائل', reports: banksReports },
  { key: 'misc', label: 'تقارير محاسبية متنوعة', reports: miscReports },
];

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  activePage,
  onNavigate,
  pendingWebOrdersCount = 0,
  onClose,
  onLogout,
  currentUser,
  companyName,
  branchesCount,
  usersCount,
  activeBranchName,
}) => {
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({
    items: false,
    operations: false,
    accounting_tree: false,
    reports_group: false,
  });

  const [openReportsSub, setOpenReportsSub] = useState<Record<string, boolean>>({});

  const [secretClicks, setSecretClicks] = useState(0);
  const [lastSecretTime, setLastSecretTime] = useState(0);

  const handleSecretRakeezaClicks = (e: React.MouseEvent) => {
    e.stopPropagation();
    const now = Date.now();
    if (now - lastSecretTime < 3000) {
      const next = secretClicks + 1;
      if (next >= 5) {
        setSecretClicks(0);
        window.dispatchEvent(new CustomEvent('trigger_rakeeza_owner_modal'));
      } else {
        setSecretClicks(next);
      }
    } else {
      setSecretClicks(1);
    }
    setLastSecretTime(now);
  };

  const toggleItem = (key: string) => {
    setOpenItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleReportSub = (key: string) => {
    setOpenReportsSub((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const navItemClass = (pageKey: string, extraActiveStyle?: string) => {
    const isActive = activePage === pageKey;
    if (isActive) {
      return (
        extraActiveStyle ||
        'bg-slate-100 text-black font-black border-r-4 border-black shadow-xs'
      );
    }
    return 'text-black hover:text-black hover:bg-slate-100 active:bg-slate-200 font-bold';
  };

  return (
    <nav
      className={`fixed top-0 md:top-[56px] right-0 bottom-0 w-[85vw] max-w-[320px] md:w-[280px] bg-white text-black overflow-y-auto transition-all duration-300 z-50 md:z-40 py-0 md:py-1 shadow-2xl border-l border-slate-200 no-print ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
      dir="rtl"
    >
      <div className="flex flex-col text-sm">
        {/* Mobile Drawer Top Bar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <span className="font-black text-black text-xs sm:text-sm tracking-wide block truncate">
                {companyName || 'المنظومة المحاسبية'}
              </span>
              <span className="text-[10px] text-blue-700 font-bold block truncate">
                🏢 {activeBranchName || 'الفرع الرئيسي'}
              </span>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-black flex items-center justify-center transition cursor-pointer font-bold"
              aria-label="إغلاق القائمة"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Desktop Sidebar System Branding Header */}
        <div className="hidden md:flex items-center gap-2.5 px-4 py-3 bg-white border-b border-slate-200 mb-1">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="font-black text-black text-xs sm:text-sm tracking-wider block truncate">
              {companyName || 'المنظومة المحاسبية'}
            </span>
            <span className="text-[10px] text-blue-700 font-bold block truncate">
              🏢 {activeBranchName || 'الفرع الرئيسي'}
            </span>
          </div>
        </div>

        {/* الرئيسية / Dashboard */}
        {canAccessPage(currentUser, 'home') && (
          <div
            onClick={() => onNavigate('home')}
            className={`min-h-[42px] px-4 py-2.5 cursor-pointer border-b border-slate-100 transition flex items-center gap-2.5 ${navItemClass(
              'home'
            )}`}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0 text-slate-800" />
            <span className="font-bold text-xs sm:text-sm text-black">الرئيسية ولوحة التحكم</span>
          </div>
        )}

        {/* نقطة البيع السريعة POS */}
        {canAccessPage(currentUser, 'pos') && (
          <div
            onClick={() => onNavigate('pos')}
            className={`min-h-[42px] px-4 py-2.5 cursor-pointer border-b border-slate-100 transition flex justify-between items-center ${navItemClass(
              'pos'
            )}`}
          >
            <div className="flex items-center gap-2.5">
              <Zap className="w-4 h-4 shrink-0 text-slate-800" />
              <span className="font-bold text-xs sm:text-sm text-black">نقطة البيع (POS)</span>
            </div>
            <span className="bg-slate-900 text-white text-[10px] px-1.5 py-0.5 rounded font-black">سريع</span>
          </div>
        )}

        {/* إدارة المبيعات */}
        {canAccessPage(currentUser, 'sales') && (
          <div
            onClick={() => onNavigate('sales')}
            className={`min-h-[42px] px-4 py-2.5 cursor-pointer border-b border-slate-100 transition flex items-center gap-2.5 ${navItemClass(
              'sales'
            )}`}
          >
            <ShoppingCart className="w-4 h-4 shrink-0 text-slate-800" />
            <span className="font-bold text-xs sm:text-sm text-black">إدارة المبيعات والفواتير</span>
          </div>
        )}

        {/* إدارة الأسعار */}
        {canAccessPage(currentUser, 'price_management') && (
          <div
            onClick={() => onNavigate('price_management')}
            className={`min-h-[42px] px-4 py-2.5 cursor-pointer border-b border-slate-100 transition flex justify-between items-center ${navItemClass(
              'price_management'
            )}`}
          >
            <div className="flex items-center gap-2.5">
              <Tag className="w-4 h-4 shrink-0 text-slate-800" />
              <span className="font-bold text-xs sm:text-sm text-black">إدارة الأسعار والتسعير</span>
            </div>
            <span className="bg-slate-100 text-black border border-slate-300 text-[10px] px-1.5 py-0.5 rounded font-bold">تسعير</span>
          </div>
        )}

        {/* قائمة أسعار الشركات والتصنيفات */}
        {canAccessPage(currentUser, 'company_prices') && (
          <div
            onClick={() => onNavigate('company_prices')}
            className={`min-h-[42px] px-4 py-2.5 cursor-pointer border-b border-slate-100 transition flex justify-between items-center ${navItemClass(
              'company_prices'
            )}`}
          >
            <div className="flex items-center gap-2.5">
              <Building2 className="w-4 h-4 shrink-0 text-slate-800" />
              <span className="font-bold text-xs sm:text-sm text-black">أسعار الشركات والتصنيفات</span>
            </div>
            <span className="bg-slate-100 text-black border border-slate-300 text-[10px] px-1.5 py-0.5 rounded font-bold">شركات</span>
          </div>
        )}

        {/* عروض الأسعار والطلبيات */}
        {canAccessPage(currentUser, 'quotes_orders') && (
          <div
            onClick={() => onNavigate('quotes_orders')}
            className={`min-h-[42px] px-4 py-2.5 cursor-pointer border-b border-slate-100 transition flex items-center gap-2.5 ${navItemClass(
              'quotes_orders'
            )}`}
          >
            <FileText className="w-4 h-4 shrink-0 text-slate-800" />
            <span className="font-bold text-xs sm:text-sm text-black">عروض الأسعار والطلبيات</span>
          </div>
        )}

        {/* علاقات العملاء CRM */}
        {canAccessPage(currentUser, 'crm_pipeline') && (
          <div
            onClick={() => onNavigate('crm_pipeline')}
            className={`min-h-[42px] px-4 py-2.5 cursor-pointer border-b border-slate-100 transition flex justify-between items-center ${navItemClass(
              'crm_pipeline'
            )}`}
          >
            <div className="flex items-center gap-2.5">
              <Target className="w-4 h-4 shrink-0 text-slate-800" />
              <span className="font-bold text-xs sm:text-sm text-black">علاقات العملاء (CRM)</span>
            </div>
            <span className="bg-slate-100 text-black border border-slate-300 text-[10px] px-1.5 py-0.5 rounded font-bold">فرص</span>
          </div>
        )}

        {/* طلبات الويب سايت */}
        {canAccessPage(currentUser, 'web_orders') && (
          <div
            onClick={() => onNavigate('web_orders')}
            className={`min-h-[42px] px-4 py-2.5 cursor-pointer border-b border-slate-100 transition flex justify-between items-center ${navItemClass(
              'web_orders'
            )}`}
          >
            <div className="flex items-center gap-2.5">
              <Inbox className="w-4 h-4 shrink-0 text-slate-800" />
              <span className="font-bold text-xs sm:text-sm text-black">طلبات الويب سايت</span>
            </div>
            {(pendingWebOrdersCount ?? 0) > 0 ? (
              <span className="bg-black text-white text-[10px] px-2 py-0.5 rounded font-black animate-pulse">
                {pendingWebOrdersCount} جديد
              </span>
            ) : (
              <span className="bg-slate-100 text-black text-[10px] px-1.5 py-0.5 rounded font-bold">وارد</span>
            )}
          </div>
        )}

        {/* منتجات وأسعار الكتالوج */}
        {canAccessPage(currentUser, 'catalog_manager') && (
          <div
            onClick={() => onNavigate('catalog_manager')}
            className={`min-h-[42px] px-4 py-2.5 cursor-pointer border-b border-slate-100 transition flex justify-between items-center ${navItemClass(
              'catalog_manager'
            )}`}
          >
            <div className="flex items-center gap-2.5">
              <ShoppingBag className="w-4 h-4 shrink-0 text-slate-800" />
              <span className="font-bold text-xs sm:text-sm text-black">المتجر والكتالوج الإلكتروني</span>
            </div>
            <span className="bg-slate-100 text-black border border-slate-300 text-[10px] px-1.5 py-0.5 rounded font-bold">متجر</span>
          </div>
        )}

        {/* إدارة المشتريات */}
        {canAccessPage(currentUser, 'purchases') && (
          <div
            onClick={() => onNavigate('purchases')}
            className={`min-h-[42px] px-4 py-2.5 cursor-pointer border-b border-slate-100 transition flex items-center gap-2.5 ${navItemClass(
              'purchases'
            )}`}
          >
            <Package className="w-4 h-4 shrink-0 text-slate-800" />
            <span className="font-bold text-xs sm:text-sm text-black">إدارة المشتريات والتوريد</span>
          </div>
        )}

        {/* حسابات العملاء والموردين */}
        {canAccessPage(currentUser, 'accounts') && (
          <div
            onClick={() => onNavigate('accounts')}
            className={`min-h-[42px] px-4 py-2.5 cursor-pointer border-b border-slate-100 transition flex items-center justify-between ${navItemClass(
              'accounts'
            )}`}
          >
            <div className="flex items-center gap-2.5">
              <Users className="w-4 h-4 shrink-0 text-slate-800" />
              <span className="font-bold text-xs sm:text-sm text-black">حسابات العملاء والموردين</span>
            </div>
            <span className="bg-slate-100 text-black border border-slate-300 text-[10px] px-1.5 py-0.5 rounded font-bold">دليل</span>
          </div>
        )}

        {/* العملاء */}
        {canAccessPage(currentUser, 'customers') && (
          <div
            onClick={() => onNavigate('customers')}
            className={`min-h-[38px] pr-8 pl-4 py-2 cursor-pointer border-b border-slate-100 transition flex items-center gap-2 ${navItemClass(
              'customers'
            )}`}
          >
            <Users className="w-3.5 h-3.5 shrink-0 text-slate-800" />
            <span className="font-bold text-xs text-black">إدارة العملاء</span>
          </div>
        )}

        {/* الموردين */}
        {canAccessPage(currentUser, 'suppliers') && (
          <div
            onClick={() => onNavigate('suppliers')}
            className={`min-h-[38px] pr-8 pl-4 py-2 cursor-pointer border-b border-slate-100 transition flex items-center gap-2 ${navItemClass(
              'suppliers'
            )}`}
          >
            <Building2 className="w-3.5 h-3.5 shrink-0 text-slate-800" />
            <span className="font-bold text-xs text-black">إدارة الموردين</span>
          </div>
        )}

        {/* قسم الخزينة والسيولة النقدية والبنوك */}
        {/* سندات القبض والصرف */}
        {canAccessPage(currentUser, 'cash') && (
          <div
            onClick={() => onNavigate('cash')}
            className={`min-h-[42px] px-4 py-2.5 cursor-pointer border-b border-slate-100 transition flex items-center justify-between ${navItemClass(
              'cash'
            )}`}
          >
            <div className="flex items-center gap-2.5">
              <Wallet className="w-4 h-4 shrink-0 text-slate-800" />
              <span className="font-bold text-xs sm:text-sm text-black">سندات القبض والصرف والخزينة</span>
            </div>
            <span className="bg-slate-100 text-black border border-slate-300 text-[10px] px-1.5 py-0.5 rounded font-bold">خزينة</span>
          </div>
        )}

        {/* سندات القبض */}
        {canAccessPage(currentUser, 'receipts') && (
          <div
            onClick={() => onNavigate('receipts')}
            className={`min-h-[38px] pr-8 pl-4 py-2 cursor-pointer border-b border-slate-100 transition flex items-center gap-2 ${navItemClass(
              'receipts'
            )}`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5 shrink-0 text-slate-800" />
            <span className="font-bold text-xs text-black">سندات القبض (التحصيل)</span>
          </div>
        )}

        {/* سندات الصرف */}
        {canAccessPage(currentUser, 'payments') && (
          <div
            onClick={() => onNavigate('payments')}
            className={`min-h-[38px] pr-8 pl-4 py-2 cursor-pointer border-b border-slate-100 transition flex items-center gap-2 ${navItemClass(
              'payments'
            )}`}
          >
            <ArrowUpRight className="w-3.5 h-3.5 shrink-0 text-slate-800" />
            <span className="font-bold text-xs text-black">سندات الصرف والمصروفات</span>
          </div>
        )}

        {/* مصفوفة أرصدة الخزينة والحسابات البنكية */}
        {canAccessPage(currentUser, 'treasury') && (
          <div
            onClick={() => onNavigate('treasury')}
            className={`min-h-[42px] px-4 py-2.5 cursor-pointer border-b border-slate-100 transition flex justify-between items-center ${navItemClass(
              'treasury'
            )}`}
          >
            <div className="flex items-center gap-2.5">
              <Landmark className="w-4 h-4 shrink-0 text-slate-800" />
              <span className="font-bold text-xs sm:text-sm text-black">أرصدة الخزائن والبنوك</span>
            </div>
            <span className="bg-slate-100 text-black border border-slate-300 text-[10px] px-1.5 py-0.5 rounded font-bold">أرصدة</span>
          </div>
        )}

        {/* الشيكات وأوراق القبض والدفع */}
        {canAccessPage(currentUser, 'cheques') && (
          <div
            onClick={() => onNavigate('cheques')}
            className={`min-h-[42px] px-4 py-2.5 cursor-pointer border-b border-slate-100 transition flex justify-between items-center ${navItemClass(
              'cheques'
            )}`}
          >
            <div className="flex items-center gap-2.5">
              <CreditCard className="w-4 h-4 shrink-0 text-slate-800" />
              <span className="font-bold text-xs sm:text-sm text-black">الشيكات وأوراق الدفع والقبض</span>
            </div>
            <span className="bg-slate-100 text-black border border-slate-300 text-[10px] px-1.5 py-0.5 rounded font-bold">شيكات</span>
          </div>
        )}

        {/* التسوية البنكية والاعتمادات */}
        {canAccessPage(currentUser, 'bank_reconciliation') && (
          <div
            onClick={() => onNavigate('bank_reconciliation')}
            className={`min-h-[42px] px-4 py-2.5 cursor-pointer border-b border-slate-100 transition flex items-center gap-2.5 ${navItemClass(
              'bank_reconciliation'
            )}`}
          >
            <Scale className="w-4 h-4 shrink-0 text-slate-800" />
            <span className="font-bold text-xs sm:text-sm text-black">التسوية البنكية والاعتمادات</span>
          </div>
        )}

        {/* المخزون والأصناف (Collapsible) */}
        {(canAccessPage(currentUser, 'items') || canAccessPage(currentUser, 'inventory')) && (
          <div>
            <div
              onClick={() => toggleItem('items')}
              className="min-h-[42px] px-4 py-2.5 cursor-pointer border-b border-slate-100 transition hover:bg-slate-100 flex justify-between items-center text-black"
            >
              <div className="flex items-center gap-2.5">
                <Boxes className="w-4 h-4 shrink-0 text-slate-800" />
                <span className="font-bold text-xs sm:text-sm text-black">المخزون والأصناف والمستودعات</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 transition-transform text-slate-800 ${
                  openItems.items ? 'rotate-180 text-black' : ''
                }`}
              />
            </div>
            {openItems.items && (
              <div className="bg-slate-50 border-y border-slate-200 text-xs">
                {canAccessPage(currentUser, 'items') && (
                  <div
                    onClick={() => onNavigate('items')}
                    className={`min-h-[38px] pr-9 pl-4 py-2 cursor-pointer border-b border-slate-100 transition flex items-center ${navItemClass(
                      'items'
                    )}`}
                  >
                    <span className="font-bold text-black">دليل الأصناف والباركود</span>
                  </div>
                )}
                {canAccessPage(currentUser, 'items') && (
                  <div
                    onClick={() => onNavigate('item_movement')}
                    className={`min-h-[38px] pr-9 pl-4 py-2 cursor-pointer border-b border-slate-100 transition flex items-center ${navItemClass(
                      'item_movement'
                    )}`}
                  >
                    <span className="font-bold text-black">سجل حركة الصنف</span>
                  </div>
                )}
                {canAccessPage(currentUser, 'inventory') && (
                  <div
                    onClick={() => onNavigate('inventory')}
                    className={`min-h-[38px] pr-9 pl-4 py-2 cursor-pointer border-b border-slate-100 transition flex items-center ${navItemClass(
                      'inventory'
                    )}`}
                  >
                    <span className="font-bold text-black">تقييم المخزون الإجمالي</span>
                  </div>
                )}
                {canAccessPage(currentUser, 'physical_inventory') && (
                  <div
                    onClick={() => onNavigate('physical_inventory')}
                    className={`min-h-[38px] pr-9 pl-4 py-2 cursor-pointer border-b border-slate-100 transition flex items-center ${navItemClass(
                      'physical_inventory'
                    )}`}
                  >
                    <span className="font-bold text-black">الجرد الفعلي وتسوية المخازن</span>
                  </div>
                )}
                {canAccessPage(currentUser, 'serial_warranty') && (
                  <div
                    onClick={() => onNavigate('serial_warranty')}
                    className={`min-h-[38px] pr-9 pl-4 py-2 cursor-pointer border-b border-slate-100 transition flex justify-between items-center ${navItemClass(
                      'serial_warranty'
                    )}`}
                  >
                    <span className="font-bold text-black">الأرقام التسلسلية وتتبع الضمان (S/N)</span>
                    <span className="bg-slate-200 text-black text-[9px] px-1.5 py-0.5 rounded font-bold">سيريال</span>
                  </div>
                )}
                {canAccessPage(currentUser, 'manufacturing') && (
                  <div
                    onClick={() => onNavigate('manufacturing')}
                    className={`min-h-[38px] pr-9 pl-4 py-2 cursor-pointer border-b border-slate-100 transition flex justify-between items-center ${navItemClass(
                      'manufacturing'
                    )}`}
                  >
                    <span className="font-bold text-black">التصنيع ومعادلات الإنتاج (BOM)</span>
                    <span className="bg-slate-200 text-black border border-slate-300 text-[9px] px-1.5 py-0.5 rounded font-bold">BOM</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* الفروع والتحويلات */}
        {canAccessPage(currentUser, 'branches') && (
          <div
            onClick={() => onNavigate('branches')}
            className={`min-h-[42px] px-4 py-2.5 cursor-pointer border-b border-slate-100 transition flex justify-between items-center ${navItemClass(
              'branches'
            )}`}
          >
            <div className="flex items-center gap-2.5">
              <Building2 className="w-4 h-4 shrink-0 text-slate-800" />
              <span className="font-bold text-xs sm:text-sm text-black">إدارة الفروع والتحويلات</span>
            </div>
            {branchesCount !== undefined && (
              <span className="bg-slate-100 text-black border border-slate-300 text-[10px] px-1.5 py-0.5 rounded font-bold font-mono">
                {branchesCount} {branchesCount === 1 ? 'فرع' : 'فروع'}
              </span>
            )}
          </div>
        )}

        {/* المحاسبة والقوائم المالية (Collapsible) */}
        {(canAccessPage(currentUser, 'daily_operations') || canAccessPage(currentUser, 'trial_balance')) && (
          <div>
            <div
              onClick={() => toggleItem('operations')}
              className="min-h-[42px] px-4 py-2.5 cursor-pointer border-b border-slate-100 transition hover:bg-slate-100 flex justify-between items-center text-black"
            >
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-4 h-4 shrink-0 text-slate-800" />
                <span className="font-bold text-xs sm:text-sm text-black">المحاسبة والقيود والقوائم المالية</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 transition-transform text-slate-800 ${
                  openItems.operations ? 'rotate-180 text-black' : ''
                }`}
              />
            </div>
            {openItems.operations && (
              <div className="bg-slate-50 border-y border-slate-200 text-xs">
                {canAccessPage(currentUser, 'accounts_tree') && (
                  <div
                    onClick={() => onNavigate('accounts_tree')}
                    className={`min-h-[38px] pr-9 pl-4 py-2 cursor-pointer border-b border-slate-100 transition flex items-center gap-2 ${navItemClass(
                      'accounts_tree'
                    )}`}
                  >
                    <FolderTree className="w-3.5 h-3.5 text-slate-800 shrink-0" />
                    <span className="font-bold text-black">دليل الحسابات ومراكز التكلفة</span>
                  </div>
                )}
                {(canAccessPage(currentUser, 'daily_operations') || canAccessPage(currentUser, 'daily_entries')) && (
                  <div
                    onClick={() => onNavigate('daily_operations')}
                    className={`min-h-[38px] pr-9 pl-4 py-2 cursor-pointer border-b border-slate-100 transition flex items-center ${navItemClass(
                      'daily_operations'
                    )}`}
                  >
                    <span className="font-bold text-black">العمليات اليومية ودفتر القيود</span>
                  </div>
                )}
                {canAccessPage(currentUser, 'trial_balance') && (
                  <div
                    onClick={() => onNavigate('trial_balance')}
                    className={`min-h-[38px] pr-9 pl-4 py-2 cursor-pointer border-b border-slate-100 transition flex items-center ${navItemClass(
                      'trial_balance'
                    )}`}
                  >
                    <span className="font-bold text-black">ميزان المراجعة</span>
                  </div>
                )}
                {canAccessPage(currentUser, 'income_statement') && (
                  <div
                    onClick={() => onNavigate('income_statement')}
                    className={`min-h-[38px] pr-9 pl-4 py-2 cursor-pointer border-b border-slate-100 transition flex items-center ${navItemClass(
                      'income_statement'
                    )}`}
                  >
                    <span className="font-bold text-black">قائمة الدخل والأرباح والخسائر (P&L)</span>
                  </div>
                )}
                {canAccessPage(currentUser, 'balance_sheet') && (
                  <div
                    onClick={() => onNavigate('balance_sheet')}
                    className={`min-h-[38px] pr-9 pl-4 py-2 cursor-pointer border-b border-slate-100 transition flex items-center ${navItemClass(
                      'balance_sheet'
                    )}`}
                  >
                    <span className="font-bold text-black">الميزانية العمومية</span>
                  </div>
                )}
                {canAccessPage(currentUser, 'monthly_profit_report') && (
                  <div
                    onClick={() => onNavigate('monthly_profit_report')}
                    className={`min-h-[38px] pr-9 pl-4 py-2 cursor-pointer border-b border-slate-100 transition flex justify-between items-center ${navItemClass(
                      'monthly_profit_report'
                    )}`}
                  >
                    <span className="font-bold text-black">تقرير الأرباح وتكلفة المبيعات (COGS)</span>
                    <span className="bg-slate-200 text-black border border-slate-300 text-[9px] px-1.5 py-0.5 rounded font-bold">معتمد</span>
                  </div>
                )}
                {canAccessPage(currentUser, 'cash_flow_closing') && (
                  <div
                    onClick={() => onNavigate('cash_flow_closing')}
                    className={`min-h-[38px] pr-9 pl-4 py-2 cursor-pointer border-b border-slate-100 transition flex justify-between items-center ${navItemClass(
                      'cash_flow_closing'
                    )}`}
                  >
                    <span className="font-bold text-black">قائمة التدفقات النقدية المعيارية</span>
                    <span className="bg-slate-200 text-black border border-slate-300 text-[9px] px-1.5 py-0.5 rounded font-bold">EAS</span>
                  </div>
                )}
                {canAccessPage(currentUser, 'fixed_assets') && (
                  <div
                    onClick={() => onNavigate('fixed_assets')}
                    className={`min-h-[38px] pr-9 pl-4 py-2 cursor-pointer border-b border-slate-100 transition flex items-center ${navItemClass(
                      'fixed_assets'
                    )}`}
                  >
                    <span className="font-bold text-black">الأصول الثابتة والإهلاكات</span>
                  </div>
                )}
                {canAccessPage(currentUser, 'year_end_closing') && (
                  <div
                    onClick={() => onNavigate('year_end_closing')}
                    className={`min-h-[38px] pr-9 pl-4 py-2 cursor-pointer border-b border-slate-100 transition flex justify-between items-center ${navItemClass(
                      'year_end_closing'
                    )}`}
                  >
                    <span className="font-bold text-black">الإقفال السنوي والترحيل المالي</span>
                    <span className="bg-slate-200 text-black text-[9px] px-1.5 py-0.5 rounded font-bold">الختامي</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* الفاتورة الإلكترونية والضرائب */}
        {canAccessPage(currentUser, 'e_invoicing') && (
          <div
            onClick={() => onNavigate('e_invoicing')}
            className={`min-h-[42px] px-4 py-2.5 cursor-pointer border-b border-slate-100 transition flex items-center gap-2.5 ${navItemClass(
              'e_invoicing'
            )}`}
          >
            <Receipt className="w-4 h-4 shrink-0 text-slate-800" />
            <span className="font-bold text-xs sm:text-sm text-black">الفاتورة الإلكترونية والضرائب</span>
          </div>
        )}

        {/* المندوبين والعمولات والائتمان */}
        {canAccessPage(currentUser, 'sales_reps') && (
          <div
            onClick={() => onNavigate('sales_reps')}
            className={`min-h-[42px] px-4 py-2.5 cursor-pointer border-b border-slate-100 transition flex items-center gap-2.5 ${navItemClass(
              'sales_reps'
            )}`}
          >
            <UserCheck className="w-4 h-4 shrink-0 text-slate-800" />
            <span className="font-bold text-xs sm:text-sm text-black">المندوبين والعمولات وسقف الائتمان</span>
          </div>
        )}

        {/* الموارد البشرية والرواتب */}
        {canAccessPage(currentUser, 'hr_payroll') && (
          <div
            onClick={() => onNavigate('hr_payroll')}
            className={`min-h-[42px] px-4 py-2.5 cursor-pointer border-b border-slate-100 transition flex justify-between items-center ${navItemClass(
              'hr_payroll'
            )}`}
          >
            <div className="flex items-center gap-2.5">
              <Briefcase className="w-4 h-4 shrink-0 text-slate-800" />
              <span className="font-bold text-xs sm:text-sm text-black">الموارد البشرية والرواتب (HR)</span>
            </div>
            <span className="bg-slate-100 text-black border border-slate-300 text-[10px] px-1.5 py-0.5 rounded font-bold">HR</span>
          </div>
        )}

        {/* ذكاء الأعمال والتحليلات BI */}
        {canAccessPage(currentUser, 'bi_analytics') && (
          <div
            onClick={() => onNavigate('bi_analytics')}
            className={`min-h-[42px] px-4 py-2.5 cursor-pointer border-b border-slate-100 transition flex items-center gap-2.5 ${navItemClass(
              'bi_analytics'
            )}`}
          >
            <TrendingUp className="w-4 h-4 shrink-0 text-slate-800" />
            <span className="font-bold text-xs sm:text-sm text-black">ذكاء الأعمال والتحليلات (BI)</span>
          </div>
        )}

        {/* التقارير الشاملة (Collapsible) */}
        {canAccessPage(currentUser, 'reports_group') && (
          <div>
            <div
              onClick={() => toggleItem('reports_group')}
              className="min-h-[42px] px-4 py-2.5 cursor-pointer border-b border-slate-100 transition hover:bg-slate-100 flex justify-between items-center text-black"
            >
              <div className="flex items-center gap-2.5">
                <BarChart3 className="w-4 h-4 shrink-0 text-slate-800" />
                <span className="font-bold text-xs sm:text-sm text-black">التقارير الشاملة والمصنفة</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 transition-transform text-slate-800 ${
                  openItems.reports_group ? 'rotate-180 text-black' : ''
                }`}
              />
            </div>
            {openItems.reports_group && (
              <div className="bg-slate-50 border-y border-slate-200 text-xs">
                <div
                  onClick={() => onNavigate('reports_group')}
                  className={`min-h-[38px] pr-9 pl-4 py-2 cursor-pointer border-b border-slate-100 transition flex items-center gap-2 text-black font-bold ${
                    activePage === 'reports_group' ? 'bg-slate-200 text-black font-black border-r-4 border-black' : 'hover:bg-slate-100'
                  }`}
                >
                  <FileBarChart className="w-3.5 h-3.5 text-slate-800" />
                  <span className="font-bold text-black">نظرة عامة على جميع التقارير</span>
                </div>
                {reportGroups.map((group) => {
                  const catPageId = `reports_${group.key}`;
                  const isCatActive = activePage === catPageId || activePage.startsWith(`${catPageId}_`);
                  return (
                    <div
                      key={group.key}
                      onClick={() => onNavigate(catPageId)}
                      className={`min-h-[36px] pr-9 pl-4 py-1.5 cursor-pointer border-b border-slate-100 transition flex justify-between items-center ${
                        isCatActive
                          ? 'bg-slate-200 text-black font-black border-r-4 border-black'
                          : 'text-black hover:text-black hover:bg-slate-100 font-bold'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Folder className="w-3.5 h-3.5 text-slate-800 shrink-0" />
                        <span className="font-bold text-black">{group.label}</span>
                      </div>
                      <span className="text-[10px] bg-slate-200 text-black font-bold px-1.5 py-0.5 rounded font-mono border border-slate-300">
                        {group.reports.length}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* سجل التدقيق والرقابة */}
        {canAccessPage(currentUser, 'audit_trail') && (
          <div
            onClick={() => onNavigate('audit_trail')}
            className={`min-h-[42px] px-4 py-2.5 cursor-pointer border-b border-slate-100 transition flex items-center gap-2.5 ${navItemClass(
              'audit_trail'
            )}`}
          >
            <History className="w-4 h-4 shrink-0 text-slate-800" />
            <span className="font-bold text-xs sm:text-sm text-black">سجل التدقيق والأمان والرقابة</span>
          </div>
        )}

        {/* الإعدادات العامة */}
        {canAccessPage(currentUser, 'settings') && (
          <div
            onClick={() => onNavigate('settings')}
            className={`min-h-[42px] px-4 py-2.5 cursor-pointer border-b border-slate-100 transition flex items-center gap-2.5 ${navItemClass(
              'settings'
            )}`}
          >
            <Settings className="w-4 h-4 shrink-0 text-slate-800" />
            <span className="font-bold text-xs sm:text-sm text-black">الإعدادات العامة للنظام</span>
          </div>
        )}

        {/* المستخدمين والصلاحيات */}
        {canAccessPage(currentUser, 'users') && (
          <div
            onClick={() => onNavigate('users')}
            className={`min-h-[42px] px-4 py-2.5 cursor-pointer border-b border-slate-100 transition flex justify-between items-center ${navItemClass(
              'users'
            )}`}
          >
            <div className="flex items-center gap-2.5">
              <UserCog className="w-4 h-4 shrink-0 text-slate-800" />
              <span className="font-bold text-xs sm:text-sm text-black">المستخدمين والصلاحيات</span>
            </div>
            {usersCount !== undefined && (
              <span className="bg-slate-100 text-black border border-slate-300 text-[10px] px-1.5 py-0.5 rounded font-bold font-mono">
                {usersCount} {usersCount === 1 ? 'مستخدم' : 'مستخدمين'}
              </span>
            )}
          </div>
        )}

        {/* النسخ الاحتياطي والاستعادة */}
        {canAccessPage(currentUser, 'backup') && (
          <div
            onClick={() => onNavigate('backup')}
            className={`min-h-[42px] px-4 py-2.5 cursor-pointer border-b border-slate-100 transition flex items-center gap-2.5 ${navItemClass(
              'backup'
            )}`}
          >
            <ShieldCheck className="w-4 h-4 shrink-0 text-slate-800" />
            <span className="font-bold text-xs sm:text-sm text-black">النسخ الاحتياطي والأمان</span>
          </div>
        )}
      </div>

      {/* Pinned Bottom User & Logout Section */}
      <div className="sticky bottom-0 mt-auto bg-slate-50 border-t border-slate-200 p-3 shadow-lg z-20">
        <div className="flex items-center gap-2.5 mb-2.5 px-0.5">
          <div className="w-8 h-8 rounded-lg bg-black text-white font-black text-xs flex items-center justify-center shrink-0">
            {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-black truncate leading-tight">
              {currentUser?.name || 'مدير المنظومة'}
            </p>
            <p className="text-[10px] text-black font-semibold truncate leading-tight mt-0.5">
              {companyName || 'الفرع الرئيسي'}
            </p>
          </div>
        </div>

        {onLogout && (
          <button
            type="button"
            onClick={() => {
              if (onClose) onClose();
              onLogout();
            }}
            className="w-full min-h-[38px] flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer border border-rose-700 shadow-xs"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>تسجيل الخروج من الحساب</span>
          </button>
        )}
      </div>
    </nav>
  );
};
