import React, { useState, useEffect } from 'react';
import { Users, Building2 } from 'lucide-react';
import { AppData } from '../types';
import { CustomersManagerClassic } from './CustomersManagerClassic';
import { SuppliersManagerClassic } from './SuppliersManagerClassic';

interface AccountsViewProps {
  appData: AppData;
  onUpdateData: (newData: AppData, actionInfo?: { action?: string; module?: string; details?: string; deletedId?: string | number }) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  initialTab?: 'customers' | 'suppliers';
  onNavigate?: (page: string) => void;
  onOpenReceiptForCustomer?: (customerName: string, customerDebt?: number) => void;
  onOpenPaymentForSupplier?: (supplierName: string, supplierPayable?: number) => void;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  appData,
  onUpdateData,
  showToast,
  initialTab = 'customers',
  onNavigate,
  onOpenReceiptForCustomer,
  onOpenPaymentForSupplier,
}) => {
  const [activeTab, setActiveTab] = useState<'customers' | 'suppliers'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const handleOpenReceipt = (customerName: string, customerDebt?: number) => {
    if (onOpenReceiptForCustomer) {
      onOpenReceiptForCustomer(customerName, customerDebt);
    } else if (onNavigate) {
      // Store in session/local storage for CashView to pick up if needed
      try {
        sessionStorage.setItem('rakeeza_prefilled_receipt_customer', customerName);
        if (customerDebt !== undefined) {
          sessionStorage.setItem('rakeeza_prefilled_receipt_amount', customerDebt.toString());
        }
      } catch {}
      onNavigate('receipts');
    }
  };

  const handleOpenPayment = (supplierName: string, supplierPayable?: number) => {
    if (onOpenPaymentForSupplier) {
      onOpenPaymentForSupplier(supplierName, supplierPayable);
    } else if (onNavigate) {
      try {
        sessionStorage.setItem('rakeeza_prefilled_payment_supplier', supplierName);
        if (supplierPayable !== undefined) {
          sessionStorage.setItem('rakeeza_prefilled_payment_amount', supplierPayable.toString());
        }
      } catch {}
      onNavigate('payments');
    }
  };

  return (
    <div className="w-full flex flex-col space-y-4 text-slate-800" dir="rtl">
      {/* 🧭 Classic Windows ERP Navigation Tabs Bar */}
      <div className="bg-slate-100 p-1.5 rounded-xl border border-slate-300 flex items-center justify-between gap-2 shadow-xs select-none">
        <div className="flex items-center gap-1.5 flex-1">
          {/* Customers Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('customers')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'customers'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'bg-transparent text-slate-700 hover:bg-slate-200/80 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span>دليل وحسابات العملاء</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                activeTab === 'customers' ? 'bg-blue-900/60 text-blue-100' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {appData.customers.length}
            </span>
          </button>

          {/* Suppliers Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('suppliers')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'suppliers'
                ? 'bg-indigo-700 text-white shadow-xs'
                : 'bg-transparent text-slate-700 hover:bg-slate-200/80 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-4 h-4 shrink-0" />
            <span>دليل وحسابات الموردين</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                activeTab === 'suppliers' ? 'bg-indigo-900/60 text-indigo-100' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {appData.suppliers.length}
            </span>
          </button>
        </div>

        <div className="hidden md:flex items-center text-[11px] text-slate-500 font-mono px-3">
          نظام ركيزة المحاسبي المعتمد • إدارة الحسابات
        </div>
      </div>

      {/* 📦 Tab Content */}
      {activeTab === 'customers' ? (
        <CustomersManagerClassic
          appData={appData}
          onUpdateData={onUpdateData}
          showToast={showToast}
          onOpenReceiptForCustomer={handleOpenReceipt}
        />
      ) : (
        <SuppliersManagerClassic
          appData={appData}
          onUpdateData={onUpdateData}
          showToast={showToast}
          onOpenPaymentForSupplier={handleOpenPayment}
        />
      )}
    </div>
  );
};
