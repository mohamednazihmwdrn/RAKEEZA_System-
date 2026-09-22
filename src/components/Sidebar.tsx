import React, { useState } from 'react';
import { LogOut } from 'lucide-react';
import { User } from '../types';
import { canAccessPage } from '../utils/permissions';
import {
  vendorReports,
  purchaseReports,
  customerReports,
  salesReports,
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
}

interface ReportGroupDef {
  key: string;
  label: string;
  reports: string[];
}

const reportGroups: ReportGroupDef[] = [
  { key: 'vendors', label: '📁 الموردين', reports: vendorReports },
  { key: 'purchases', label: '📁 المشتريات', reports: purchaseReports },
  { key: 'customers', label: '📁 العملاء', reports: customerReports },
  { key: 'sales', label: '📁 المبيعات', reports: salesReports },
  { key: 'receipts', label: '📁 المقبوضات', reports: receiptsReports },
  { key: 'payments', label: '📁 المدفوعات', reports: paymentsReports },
  { key: 'reps', label: '📁 المندوبين', reports: repsReports },
  { key: 'banks', label: '📁 البنوك', reports: banksReports },
  { key: 'misc', label: '📁 تقارير متنوعة', reports: miscReports },
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
}) => {
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({
    items: false,
    operations: false,
    accounting_tree: false,
    reports_group: false,
  });

  const [openReportsSub, setOpenReportsSub] = useState<Record<string, boolean>>({});

  const toggleItem = (key: string) => {
    setOpenItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleReportSub = (key: string) => {
    setOpenReportsSub((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <nav
      className={`fixed top-0 md:top-[60px] right-0 bottom-0 w-[85vw] max-w-[320px] md:w-[280px] bg-[#1a237e] text-white overflow-y-auto transition-all duration-300 z-50 md:z-40 py-0 md:py-2 shadow-2xl border-l border-white/10 no-print ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="flex flex-col text-sm">
        {/* Mobile Drawer Top Bar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3.5 bg-[#0d47a1] border-b border-white/15 sticky top-0 z-10 shadow-xs">
          <div className="flex items-center gap-2">
            <img
              src="/pwa-192x192.png"
              alt="شعار ركيزة"
              className="w-8 h-8 rounded-lg object-contain bg-[#000e28] p-0.5 border border-amber-300/30 shadow-xs"
            />
            <div>
              <span className="font-black text-[#ffd54f] text-sm tracking-wide block">RAKEEZA | ركيزة</span>
              <span className="text-[10px] text-blue-200 block">قائمة المنظومة الإدارية</span>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="min-w-[36px] min-h-[36px] rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white flex items-center justify-center text-sm font-bold transition cursor-pointer"
              aria-label="إغلاق القائمة"
            >
              ✕
            </button>
          )}
        </div>
        {/* Desktop Sidebar System Branding Header */}
        <div className="hidden md:flex items-center gap-2.5 px-4 py-3 bg-[#0d47a1]/80 border-b border-white/10 mb-1">
          <img
            src="/pwa-192x192.png"
            alt="شعار ركيزة"
            className="w-7 h-7 rounded-lg object-contain bg-[#000e28] p-0.5 border border-amber-300/30 shadow-xs"
          />
          <div>
            <span className="font-black text-[#ffd54f] text-sm tracking-wider block">RAKEEZA ERP</span>
            <span className="text-[10px] text-blue-200 block">منظومة ركيزة المحاسبية</span>
          </div>
        </div>

        {/* 🏠 الرئيسية */}
        {canAccessPage(currentUser, 'home') && (
          <div
            onClick={() => onNavigate('home')}
            className={`min-h-[44px] px-4 sm:px-5 py-2.5 cursor-pointer border-b border-white/5 transition hover:bg-white/10 active:bg-white/20 flex justify-between items-center ${
              activePage === 'home' ? 'bg-white/15 text-[#ffd54f] font-bold' : ''
            }`}
          >
            <span>🏠 الرئيسية</span>
          </div>
        )}

        {/* ⚡ نقطة البيع السريعة POS */}
        {canAccessPage(currentUser, 'pos') && (
          <div
            onClick={() => onNavigate('pos')}
            className={`min-h-[44px] px-4 sm:px-5 py-2.5 cursor-pointer border-b border-white/5 transition hover:bg-white/10 active:bg-white/20 flex justify-between items-center ${
              activePage === 'pos' ? 'bg-white/15 text-[#ffd54f] font-bold' : 'text-amber-300 font-semibold'
            }`}
          >
            <span>⚡ نقطة البيع (POS)</span>
            <span className="bg-amber-400 text-slate-900 text-[10px] px-1.5 py-0.5 rounded font-black">سريع</span>
          </div>
        )}

        {/* 💰 المبيعات */}
        {canAccessPage(currentUser, 'sales') && (
          <div
            onClick={() => onNavigate('sales')}
            className={`min-h-[44px] px-4 sm:px-5 py-2.5 cursor-pointer border-b border-white/5 transition hover:bg-white/10 active:bg-white/20 flex justify-between items-center ${
              activePage === 'sales' ? 'bg-white/15 text-[#ffd54f] font-bold' : ''
            }`}
          >
            <span>💰 إدارة المبيعات</span>
          </div>
        )}

        {/* 💰 إدارة الأسعار (Price Management - Master Source) */}
        {canAccessPage(currentUser, 'price_management') && (
          <div
            onClick={() => onNavigate('price_management')}
            className={`min-h-[44px] px-4 sm:px-5 py-2.5 cursor-pointer border-b border-white/5 transition hover:bg-white/10 active:bg-white/20 flex justify-between items-center ${
              activePage === 'price_management' ? 'bg-white/15 text-[#ffd54f] font-bold' : 'text-emerald-300 font-bold'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span>🏷️</span> إدارة الأسعار
            </span>
            <span className="bg-emerald-500 text-slate-950 text-[10px] px-1.5 py-0.5 rounded font-black">تسعير</span>
          </div>
        )}

        {/* 📋 عروض الأسعار والطلبيات */}
        {canAccessPage(currentUser, 'quotes_orders') && (
          <div
            onClick={() => onNavigate('quotes_orders')}
            className={`min-h-[44px] px-4 sm:px-5 py-2.5 cursor-pointer border-b border-white/5 transition hover:bg-white/10 active:bg-white/20 flex justify-between items-center ${
              activePage === 'quotes_orders' ? 'bg-white/15 text-[#ffd54f] font-bold' : ''
            }`}
          >
            <span>📑 عروض الأسعار والطلبيات</span>
          </div>
        )}

        {/* 🎯 إدارة الفرص والعملاء المحتملين (CRM Pipeline) */}
        {canAccessPage(currentUser, 'crm_pipeline') && (
          <div
            onClick={() => onNavigate('crm_pipeline')}
            className={`min-h-[44px] px-4 sm:px-5 py-2.5 cursor-pointer border-b border-white/5 transition hover:bg-white/10 active:bg-white/20 flex justify-between items-center ${
              activePage === 'crm_pipeline' ? 'bg-white/15 text-[#ffd54f] font-bold' : 'text-indigo-200 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span>🎯</span> إدارة علاقات العملاء (CRM)
            </span>
            <span className="bg-indigo-500 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">فرص</span>
          </div>
        )}

        {/* 📥 طلبات الويب سايت والكتالوج */}
        {canAccessPage(currentUser, 'web_orders') && (
          <div
            onClick={() => onNavigate('web_orders')}
            className={`min-h-[44px] px-4 sm:px-5 py-2.5 cursor-pointer border-b border-white/5 transition hover:bg-white/10 active:bg-white/20 flex justify-between items-center ${
              activePage === 'web_orders'
                ? 'bg-rose-600/30 text-rose-300 font-black border-r-4 border-rose-500'
                : 'text-rose-200 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-1.5 font-bold">
              <span>📥</span> طلبات الويب سايت
            </span>
            {(pendingWebOrdersCount ?? 0) > 0 ? (
              <span className="bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black animate-pulse">
                {pendingWebOrdersCount} جديد
              </span>
            ) : (
              <span className="bg-slate-700 text-slate-300 text-[10px] px-1.5 py-0.5 rounded font-bold">وارد</span>
            )}
          </div>
        )}

        {/* 🛍️ إدارة منتجات وأسعار الكتالوج */}
        {canAccessPage(currentUser, 'catalog_manager') && (
          <div
            onClick={() => onNavigate('catalog_manager')}
            className={`min-h-[44px] px-4 sm:px-5 py-2.5 cursor-pointer border-b border-white/5 transition hover:bg-white/10 active:bg-white/20 flex justify-between items-center ${
              activePage === 'catalog_manager'
                ? 'bg-amber-500/20 text-amber-300 font-black border-r-4 border-amber-400'
                : 'text-amber-200 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-1.5 font-bold">
              <span>🏷️</span> منتجات وأسعار الويب سايت
            </span>
            <span className="bg-amber-400 text-slate-950 text-[10px] px-1.5 py-0.5 rounded font-black">تحكم</span>
          </div>
        )}

        {/* 🌐 معاينة متجر الكتالوج أونلاين (B2B / B2C) */}
        {canAccessPage(currentUser, 'catalog') && (
          <div
            onClick={() => onNavigate('catalog')}
            className={`min-h-[44px] px-4 sm:px-5 py-2.5 cursor-pointer border-b border-white/5 transition hover:bg-white/10 active:bg-white/20 flex justify-between items-center ${
              activePage === 'catalog' ? 'bg-white/15 text-[#ffd54f] font-bold' : 'text-slate-300 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span>🌐</span> معاينة المتجر الإلكتروني
            </span>
            <span className="bg-indigo-500 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">عرض</span>
          </div>
        )}

        {/* 🛒 المشتريات */}
        {canAccessPage(currentUser, 'purchases') && (
          <div
            onClick={() => onNavigate('purchases')}
            className={`min-h-[44px] px-4 sm:px-5 py-2.5 cursor-pointer border-b border-white/5 transition hover:bg-white/10 active:bg-white/20 flex justify-between items-center ${
              activePage === 'purchases' ? 'bg-white/15 text-[#ffd54f] font-bold' : ''
            }`}
          >
            <span>🛒 إدارة المشتريات</span>
          </div>
        )}

        {/* 💵 قبض/صرف */}
        {canAccessPage(currentUser, 'cash') && (
          <div
            onClick={() => onNavigate('cash')}
            className={`min-h-[44px] px-4 sm:px-5 py-2.5 cursor-pointer border-b border-white/5 transition hover:bg-white/10 active:bg-white/20 flex justify-between items-center ${
              activePage === 'cash' ? 'bg-white/15 text-[#ffd54f] font-bold' : ''
            }`}
          >
            <span>💵 سندات القبض والصرف</span>
          </div>
        )}

        {/* 📋 الحسابات */}
        {canAccessPage(currentUser, 'accounts') && (
          <div
            onClick={() => onNavigate('accounts')}
            className={`min-h-[44px] px-4 sm:px-5 py-2.5 cursor-pointer border-b border-white/5 transition hover:bg-white/10 active:bg-white/20 flex justify-between items-center ${
              activePage === 'accounts' ? 'bg-white/15 text-[#ffd54f] font-bold' : ''
            }`}
          >
            <span>📋 حسابات العملاء والموردين</span>
          </div>
        )}

        {/* 💳 الشيكات وأوراق القبض والدفع (Enterprise) */}
        {canAccessPage(currentUser, 'cheques') && (
          <div
            onClick={() => onNavigate('cheques')}
            className={`min-h-[44px] px-4 sm:px-5 py-2.5 cursor-pointer border-b border-white/5 transition hover:bg-white/10 active:bg-white/20 flex justify-between items-center ${
              activePage === 'cheques' ? 'bg-white/15 text-[#ffd54f] font-bold' : 'text-emerald-300'
            }`}
          >
            <span>💳 الشيكات وأوراق القبض والدفع</span>
            <span className="bg-emerald-500 text-slate-900 text-[10px] px-1.5 py-0.5 rounded font-black">جديد</span>
          </div>
        )}

        {/* 🎯 المندوبين والعمولات وسقف الائتمان (Enterprise) */}
        {canAccessPage(currentUser, 'sales_reps') && (
          <div
            onClick={() => onNavigate('sales_reps')}
            className={`min-h-[44px] px-4 sm:px-5 py-2.5 cursor-pointer border-b border-white/5 transition hover:bg-white/10 active:bg-white/20 flex justify-between items-center ${
              activePage === 'sales_reps' ? 'bg-white/15 text-[#ffd54f] font-bold' : ''
            }`}
          >
            <span>🎯 المندوبين والعمولات والائتمان</span>
          </div>
        )}

        {/* 👥 الموارد البشرية والرواتب (Enterprise) */}
        {canAccessPage(currentUser, 'hr_payroll') && (
          <div
            onClick={() => onNavigate('hr_payroll')}
            className={`min-h-[44px] px-4 sm:px-5 py-2.5 cursor-pointer border-b border-white/5 transition hover:bg-white/10 active:bg-white/20 flex justify-between items-center ${
              activePage === 'hr_payroll' ? 'bg-white/15 text-[#ffd54f] font-bold' : 'text-blue-200'
            }`}
          >
            <span>👥 الموارد البشرية والرواتب (HR)</span>
            <span className="bg-blue-400 text-slate-900 text-[10px] px-1.5 py-0.5 rounded font-black">ERP</span>
          </div>
        )}

        {/* 🏢 الأصول الثابتة والإهلاكات (Enterprise) */}
        {canAccessPage(currentUser, 'fixed_assets') && (
          <div
            onClick={() => onNavigate('fixed_assets')}
            className={`min-h-[44px] px-4 sm:px-5 py-2.5 cursor-pointer border-b border-white/5 transition hover:bg-white/10 active:bg-white/20 flex justify-between items-center ${
              activePage === 'fixed_assets' ? 'bg-white/15 text-[#ffd54f] font-bold' : ''
            }`}
          >
            <span>🏢 الأصول الثابتة والإهلاكات</span>
          </div>
        )}

        {/* ⚙️ التصنيع ومعادلات التكوين BOM (Enterprise) */}
        {canAccessPage(currentUser, 'manufacturing') && (
          <div
            onClick={() => onNavigate('manufacturing')}
            className={`min-h-[44px] px-4 sm:px-5 py-2.5 cursor-pointer border-b border-white/5 transition hover:bg-white/10 active:bg-white/20 flex justify-between items-center ${
              activePage === 'manufacturing' ? 'bg-white/15 text-[#ffd54f] font-bold' : 'text-amber-200'
            }`}
          >
            <span>⚙️ التصنيع والإنتاج (BOM)</span>
            <span className="bg-amber-400 text-slate-900 text-[10px] px-1.5 py-0.5 rounded font-black">BOM</span>
          </div>
        )}

        {/* 🏦 التسوية البنكية والموافقات (Enterprise) */}
        {canAccessPage(currentUser, 'bank_reconciliation') && (
          <div
            onClick={() => onNavigate('bank_reconciliation')}
            className={`min-h-[44px] px-4 sm:px-5 py-2.5 cursor-pointer border-b border-white/5 transition hover:bg-white/10 active:bg-white/20 flex justify-between items-center ${
              activePage === 'bank_reconciliation' ? 'bg-white/15 text-[#ffd54f] font-bold' : ''
            }`}
          >
            <span>🏦 التسوية البنكية والاعتمادات</span>
          </div>
        )}

        {/* 🌳 دليل الحسابات الشجري ومراكز التكلفة */}
        {canAccessPage(currentUser, 'accounts_tree') && (
          <div
            onClick={() => onNavigate('accounts_tree')}
            className={`min-h-[44px] px-4 sm:px-5 py-2.5 cursor-pointer border-b border-white/5 transition hover:bg-white/10 active:bg-white/20 flex justify-between items-center ${
              activePage === 'accounts_tree' ? 'bg-white/15 text-[#ffd54f] font-bold' : ''
            }`}
          >
            <span>🌳 دليل الحسابات ومراكز التكلفة</span>
          </div>
        )}

        {/* 📦 الأصناف والمخازن */}
        {(canAccessPage(currentUser, 'items') || canAccessPage(currentUser, 'inventory')) && (
          <div>
            <div
              onClick={() => toggleItem('items')}
              className="min-h-[44px] px-4 sm:px-5 py-2.5 cursor-pointer border-b border-white/5 transition hover:bg-white/10 active:bg-white/20 flex justify-between items-center"
            >
              <span>📦 المخزون والأصناف</span>
              <span className={`text-xs transition-transform ${openItems.items ? 'rotate-90' : ''}`}>▶</span>
            </div>
            {openItems.items && (
              <div className="bg-black/20 text-xs transition-all">
                {canAccessPage(currentUser, 'items') && (
                  <div
                    onClick={() => onNavigate('items')}
                    className="min-h-[40px] px-8 sm:px-10 py-2.5 cursor-pointer border-b border-white/5 hover:bg-white/10 active:bg-white/20 text-slate-300 hover:text-white flex items-center"
                  >
                    إدارة الأصناف والأسعار
                  </div>
                )}
                {canAccessPage(currentUser, 'items') && (
                  <div
                    onClick={() => onNavigate('item_movement')}
                    className="min-h-[40px] px-8 sm:px-10 py-2.5 cursor-pointer border-b border-white/5 hover:bg-white/10 active:bg-white/20 text-slate-300 hover:text-white flex items-center"
                  >
                    سجل حركة الصنف
                  </div>
                )}
                {canAccessPage(currentUser, 'inventory') && (
                  <div
                    onClick={() => onNavigate('inventory')}
                    className="min-h-[40px] px-8 sm:px-10 py-2.5 cursor-pointer border-b border-white/5 hover:bg-white/10 active:bg-white/20 text-slate-300 hover:text-white flex items-center"
                  >
                    تقييم المخزون الإجمالي
                  </div>
                )}
                {canAccessPage(currentUser, 'physical_inventory') && (
                  <div
                    onClick={() => onNavigate('physical_inventory')}
                    className="min-h-[40px] px-8 sm:px-10 py-2.5 cursor-pointer border-b border-white/5 hover:bg-white/10 active:bg-white/20 text-slate-300 hover:text-white flex items-center"
                  >
                    الجرد الفعلي للمخازن
                  </div>
                )}
                {canAccessPage(currentUser, 'inventory_settlement') && (
                  <div
                    onClick={() => onNavigate('inventory_settlement')}
                    className="min-h-[40px] px-8 sm:px-10 py-2.5 cursor-pointer border-b border-white/5 hover:bg-white/10 active:bg-white/20 text-slate-300 hover:text-white flex items-center"
                  >
                    مطابقة وتسوية الجرد
                  </div>
                )}
                {canAccessPage(currentUser, 'serial_warranty') && (
                  <div
                    onClick={() => onNavigate('serial_warranty')}
                    className={`min-h-[40px] px-8 sm:px-10 py-2.5 cursor-pointer border-b border-white/5 hover:bg-white/10 active:bg-white/20 flex justify-between items-center ${
                      activePage === 'serial_warranty' ? 'text-amber-300 font-bold bg-white/10' : 'text-amber-200 hover:text-white'
                    }`}
                  >
                    <span>الأرقام التسلسلية وتتبع الضمان (S/N)</span>
                    <span className="bg-amber-400 text-slate-950 text-[9px] px-1.5 py-0.5 rounded font-black">سيريال</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 🏢 الفروع والتحويلات */}
        {canAccessPage(currentUser, 'branches') && (
          <div
            onClick={() => onNavigate('branches')}
            className={`min-h-[44px] px-4 sm:px-5 py-2.5 cursor-pointer border-b border-white/5 transition hover:bg-white/10 active:bg-white/20 flex justify-between items-center ${
              activePage === 'branches' ? 'bg-white/15 text-[#ffd54f] font-bold' : ''
            }`}
          >
            <span>🏢 الفروع والتحويلات المخزنية</span>
          </div>
        )}

        {/* 📊 العمليات والقوائم المالية */}
        {(canAccessPage(currentUser, 'daily_operations') || canAccessPage(currentUser, 'trial_balance')) && (
          <div>
            <div
              onClick={() => toggleItem('operations')}
              className="min-h-[44px] px-4 sm:px-5 py-2.5 cursor-pointer border-b border-white/5 transition hover:bg-white/10 active:bg-white/20 flex justify-between items-center"
            >
              <span>📊 المحاسبة والقوائم المالية</span>
              <span className={`text-xs transition-transform ${openItems.operations ? 'rotate-90' : ''}`}>▶</span>
            </div>
            {openItems.operations && (
              <div className="bg-black/20 text-xs">
                {canAccessPage(currentUser, 'daily_operations') && (
                  <div
                    onClick={() => onNavigate('daily_operations')}
                    className="min-h-[40px] px-8 sm:px-10 py-2.5 cursor-pointer border-b border-white/5 hover:bg-white/10 active:bg-white/20 text-slate-300 hover:text-white flex items-center"
                  >
                    العمليات اليومية
                  </div>
                )}
                {canAccessPage(currentUser, 'daily_entries') && (
                  <div
                    onClick={() => onNavigate('daily_entries')}
                    className="min-h-[40px] px-8 sm:px-10 py-2.5 cursor-pointer border-b border-white/5 hover:bg-white/10 active:bg-white/20 text-slate-300 hover:text-white flex items-center"
                  >
                    دفتر القيود المزدوجة
                  </div>
                )}
                {canAccessPage(currentUser, 'trial_balance') && (
                  <div
                    onClick={() => onNavigate('trial_balance')}
                    className="min-h-[40px] px-8 sm:px-10 py-2.5 cursor-pointer border-b border-white/5 hover:bg-white/10 active:bg-white/20 text-slate-300 hover:text-white flex items-center"
                  >
                    ميزان المراجعة
                  </div>
                )}
                {canAccessPage(currentUser, 'income_statement') && (
                  <div
                    onClick={() => onNavigate('income_statement')}
                    className="min-h-[40px] px-8 sm:px-10 py-2.5 cursor-pointer border-b border-white/5 hover:bg-white/10 active:bg-white/20 text-slate-300 hover:text-white flex items-center"
                  >
                    قائمة الدخل والأرباح (P&L)
                  </div>
                )}
                {canAccessPage(currentUser, 'balance_sheet') && (
                  <div
                    onClick={() => onNavigate('balance_sheet')}
                    className="min-h-[40px] px-8 sm:px-10 py-2.5 cursor-pointer border-b border-white/5 hover:bg-white/10 active:bg-white/20 text-slate-300 hover:text-white flex items-center"
                  >
                    الميزانية العمومية
                  </div>
                )}
                {canAccessPage(currentUser, 'monthly_profit_report') && (
                  <div
                    onClick={() => onNavigate('monthly_profit_report')}
                    className={`min-h-[40px] px-8 sm:px-10 py-2.5 cursor-pointer border-b border-white/5 hover:bg-white/10 active:bg-white/20 flex justify-between items-center ${
                      activePage === 'monthly_profit_report' ? 'text-amber-300 font-bold bg-white/10' : 'text-emerald-300 hover:text-white'
                    }`}
                  >
                    <span>💰 تقرير الأرباح وتكلفة المبيعات (COGS)</span>
                    <span className="bg-emerald-500 text-slate-950 text-[9px] px-1.5 py-0.5 rounded font-black">جديد</span>
                  </div>
                )}
                {canAccessPage(currentUser, 'cash_flow_closing') && (
                  <div
                    onClick={() => onNavigate('cash_flow_closing')}
                    className={`min-h-[40px] px-8 sm:px-10 py-2.5 cursor-pointer border-b border-white/5 hover:bg-white/10 active:bg-white/20 flex justify-between items-center ${
                      activePage === 'cash_flow_closing' ? 'text-amber-300 font-bold bg-white/10' : 'text-cyan-300 hover:text-white'
                    }`}
                  >
                    <span>🌊 قائمة التدفقات النقدية المعيارية</span>
                    <span className="bg-cyan-500 text-slate-950 text-[9px] px-1.5 py-0.5 rounded font-black">EAS</span>
                  </div>
                )}
                {canAccessPage(currentUser, 'year_end_closing') && (
                  <div
                    onClick={() => onNavigate('year_end_closing')}
                    className="min-h-[40px] px-8 sm:px-10 py-2.5 cursor-pointer border-b border-white/5 hover:bg-white/10 active:bg-white/20 text-amber-300 hover:text-amber-200 font-bold flex justify-between items-center"
                  >
                    <span>الإقفال السنوي والترحيل المالي</span>
                    <span className="bg-amber-400 text-slate-900 text-[9px] px-1.5 py-0.5 rounded font-black">الختامي</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 🏛️ الفاتورة الإلكترونية والضرائب */}
        {canAccessPage(currentUser, 'e_invoicing') && (
          <div
            onClick={() => onNavigate('e_invoicing')}
            className={`min-h-[44px] px-4 sm:px-5 py-2.5 cursor-pointer border-b border-white/5 transition hover:bg-white/10 active:bg-white/20 flex justify-between items-center ${
              activePage === 'e_invoicing' ? 'bg-white/15 text-[#ffd54f] font-bold' : ''
            }`}
          >
            <span>🏛️ الفاتورة الإلكترونية والضرائب</span>
          </div>
        )}

        {/* 📈 ذكاء الأعمال BI */}
        {canAccessPage(currentUser, 'bi_analytics') && (
          <div
            onClick={() => onNavigate('bi_analytics')}
            className={`min-h-[44px] px-4 sm:px-5 py-2.5 cursor-pointer border-b border-white/5 transition hover:bg-white/10 active:bg-white/20 flex justify-between items-center ${
              activePage === 'bi_analytics' ? 'bg-white/15 text-[#ffd54f] font-bold' : ''
            }`}
          >
            <span>📈 ذكاء الأعمال والتحليلات (BI)</span>
          </div>
        )}

        {/* 📊 التقارير الشاملة */}
        {canAccessPage(currentUser, 'reports_group') && (
          <div>
            <div
              onClick={() => toggleItem('reports_group')}
              className="min-h-[44px] px-4 sm:px-5 py-2.5 cursor-pointer border-b border-white/5 transition hover:bg-white/10 active:bg-white/20 flex justify-between items-center"
            >
              <span>📊 التقارير الشاملة</span>
              <span className={`text-xs transition-transform ${openItems.reports_group ? 'rotate-90' : ''}`}>▶</span>
            </div>
            {openItems.reports_group && (
              <div className="bg-black/25 text-xs">
                <div
                  onClick={() => onNavigate('reports_group')}
                  className="min-h-[40px] px-8 sm:px-10 py-2.5 cursor-pointer border-b border-white/5 hover:bg-white/10 active:bg-white/20 text-[#ffd54f] font-semibold flex items-center"
                >
                  📋 نظرة عامة على التقارير
                </div>
                {reportGroups.map((group) => (
                  <div key={group.key}>
                    <div
                      onClick={() => toggleReportSub(group.key)}
                      className="min-h-[40px] px-8 sm:px-10 py-2.5 cursor-pointer border-b border-white/5 hover:bg-white/10 active:bg-white/20 text-slate-300 hover:text-white flex justify-between items-center"
                    >
                      <span>{group.label}</span>
                      <span className={`text-[10px] transition-transform ${openReportsSub[group.key] ? 'rotate-90' : ''}`}>
                        ▶
                      </span>
                    </div>
                    {openReportsSub[group.key] && (
                      <div className="bg-black/30 pr-10">
                        {group.reports.map((rep) => {
                          const repPageId = `reports_${group.key}_${rep.replace(/\s+/g, '_')}`;
                          return (
                            <div
                              key={rep}
                              onClick={() => onNavigate(repPageId)}
                              className="min-h-[38px] py-2 px-3 cursor-pointer border-b border-white/3 text-[11px] text-slate-400 hover:text-white hover:bg-white/5 active:bg-white/10 truncate flex items-center"
                              title={rep}
                            >
                              📄 {rep}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 🏦 الخزينة */}
        {canAccessPage(currentUser, 'treasury') && (
          <div
            onClick={() => onNavigate('treasury')}
            className={`min-h-[44px] px-4 sm:px-5 py-2.5 cursor-pointer border-b border-white/5 transition hover:bg-white/10 active:bg-white/20 flex justify-between items-center ${
              activePage === 'treasury' ? 'bg-white/15 text-[#ffd54f] font-bold' : ''
            }`}
          >
            <span>🏦 الخزينة والأرصدة النقدية</span>
          </div>
        )}

        {/* 🛡️ سجل التدقيق والرقابة */}
        {canAccessPage(currentUser, 'audit_trail') && (
          <div
            onClick={() => onNavigate('audit_trail')}
            className={`min-h-[44px] px-4 sm:px-5 py-2.5 cursor-pointer border-b border-white/5 transition hover:bg-white/10 active:bg-white/20 flex justify-between items-center ${
              activePage === 'audit_trail' ? 'bg-white/15 text-[#ffd54f] font-bold' : ''
            }`}
          >
            <span>🛡️ سجل التدقيق والأمان</span>
          </div>
        )}

        {/* ⚙️ الإعدادات */}
        {canAccessPage(currentUser, 'settings') && (
          <div
            onClick={() => onNavigate('settings')}
            className={`min-h-[44px] px-4 sm:px-5 py-2.5 cursor-pointer border-b border-white/5 transition hover:bg-white/10 active:bg-white/20 flex justify-between items-center ${
              activePage === 'settings' ? 'bg-white/15 text-[#ffd54f] font-bold' : ''
            }`}
          >
            <span>⚙️ الإعدادات العامة</span>
          </div>
        )}

        {/* 👥 المستخدمين */}
        {canAccessPage(currentUser, 'users') && (
          <div
            onClick={() => onNavigate('users')}
            className={`min-h-[44px] px-4 sm:px-5 py-2.5 cursor-pointer border-b border-white/5 transition hover:bg-white/10 active:bg-white/20 flex justify-between items-center ${
              activePage === 'users' ? 'bg-white/15 text-[#ffd54f] font-bold' : ''
            }`}
          >
            <span>👥 المستخدمين والصلاحيات</span>
          </div>
        )}

        {/* 💾 النسخ الاحتياطي */}
        {canAccessPage(currentUser, 'backup') && (
          <div
            onClick={() => onNavigate('backup')}
            className={`min-h-[44px] px-4 sm:px-5 py-2.5 cursor-pointer border-b border-white/5 transition hover:bg-white/10 active:bg-white/20 flex justify-between items-center ${
              activePage === 'backup' ? 'bg-white/15 text-[#ffd54f] font-bold' : ''
            }`}
          >
            <span>💾 النسخ الاحتياطي والاستعادة</span>
          </div>
        )}
      </div>

      {/* Pinned Bottom User & Logout Section */}
      <div className="sticky bottom-0 mt-auto bg-[#0d47a1] border-t border-white/15 p-3.5 shadow-2xl z-20">
        <div className="flex items-center gap-2.5 mb-2.5 px-0.5">
          <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
            {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : '👤'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-white truncate leading-tight">
              {currentUser?.name || 'مدير المنظومة'}
            </p>
            <p className="text-[10px] text-blue-200 truncate leading-tight mt-0.5">
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
            className="w-full min-h-[40px] flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white py-2 px-3 rounded-xl text-xs font-black transition-all shadow-md shadow-rose-950/40 cursor-pointer border border-rose-400/40"
          >
            <LogOut className="w-4 h-4" />
            <span>تسجيل الخروج من الحساب</span>
          </button>
        )}
      </div>
    </nav>
  );
};
