import React from 'react';
import { User, AppData } from '../types';

export function getCleanPageName(page?: string): string {
  if (!page) return 'الرئيسية';
  switch (page) {
    case 'home':
      return 'الرئيسية';
    case 'sales':
      return 'المبيعات';
    case 'purchases':
      return 'المشتريات';
    case 'accounts_tree':
      return 'شجرة الحسابات';
    case 'accounts':
      return 'الحسابات';
    case 'items':
      return 'دليل الأصناف';
    case 'inventory':
      return 'المخزن';
    case 'physical_inventory':
      return 'جرد المخازن';
    case 'inventory_settlement':
      return 'تسوية الجرد';
    case 'item_movement':
      return 'حركة الأصناف';
    case 'pos':
      return 'الكاشير';
    case 'cash':
      return 'القبض والصرف';
    case 'treasury':
      return 'الخزينة';
    case 'cheques':
      return 'الشيكات';
    case 'customers':
      return 'العملاء';
    case 'suppliers':
      return 'الموردين';
    case 'reports':
    case 'reports_group':
      return 'التقارير';
    case 'bi_analytics':
      return 'تحليلات الأعمال';
    case 'daily_operations':
      return 'العمليات اليومية';
    case 'daily_entries':
      return 'القيود اليومية';
    case 'trial_balance':
      return 'ميزان المراجعة';
    case 'income_statement':
      return 'الأرباح والخسائر';
    case 'balance_sheet':
      return 'الميزانية العمومية';
    case 'monthly_profit_report':
      return 'الأرباح الشهرية';
    case 'year_end_closing':
      return 'الإقفال السنوي';
    case 'price_management':
      return 'إدارة الأسعار';
    case 'quotes_orders':
      return 'عروض الأسعار';
    case 'web_orders':
      return 'طلبات المتجر';
    case 'catalog_manager':
      return 'إدارة الكتالوج';
    case 'catalog':
      return 'الكتالوج';
    case 'branches':
      return 'الفروع';
    case 'e_invoicing':
      return 'الفاتورة الإلكترونية';
    case 'sales_reps':
      return 'المندوبين';
    case 'hr_payroll':
      return 'الموارد البشرية';
    case 'fixed_assets':
      return 'الأصول الثابتة';
    case 'manufacturing':
      return 'التصنيع';
    case 'bank_reconciliation':
      return 'التسوية البنكية';
    case 'audit_trail':
      return 'سجل التدقيق';
    case 'settings':
      return 'الإعدادات';
    case 'users':
      return 'المستخدمين';
    case 'backup':
      return 'النسخ الاحتياطي';
    case 'owner_panel':
      return 'لوحة المالك';
    default:
      if (page.startsWith('reports_')) return 'التقارير';
      return 'الرئيسية';
  }
}

interface HeaderProps {
  currentUser?: User | undefined;
  companyName?: string;
  companyCode?: string;
  subscriptionPlan?: string;
  onToggleSidebar?: () => void;
  onLogout?: () => void;
  autoBackupActive?: boolean;
  onNavigateBackup?: () => void;
  onNavigateOwner?: () => void;
  onOwnerLoginSuccess?: (ownerSession: any) => void;
  onShareCatalog?: () => void;
  onOpenCatalog?: () => void;
  pendingWebOrdersCount?: number;
  onNavigateWebOrders?: () => void;
  appData?: AppData;
  onUpdateData?: (newData: AppData, logMeta?: { action: string; module: string; details: string }) => void;
  showToast?: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onNavigateReports?: (fiscalYear?: string) => void;
  onNavigate?: (page: string) => void;
  currentPage?: string;
}

export const Header: React.FC<HeaderProps> = ({
  currentPage = 'home',
}) => {
  const pageTitle = getCleanPageName(currentPage);

  return (
    <header
      className="fixed top-0 right-0 left-0 h-[50px] sm:h-[54px] bg-[#1e293b] text-white px-4 flex items-center justify-center z-50 shadow-sm no-print select-none"
      dir="rtl"
    >
      <h1 className="text-base sm:text-lg font-black text-white tracking-wide">
        {pageTitle}
      </h1>
    </header>
  );
};
