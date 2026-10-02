import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppData, SaleInvoice, PurchaseInvoice, InvoiceItem, Customer, Supplier } from '../types';
import { calculateCustomerBalance, calculateSupplierBalance } from '../utils/accounting';
import { postSaleInvoice, postPurchaseInvoice } from '../utils/posting';
import { printInvoiceWindow } from '../utils/printInvoice';

export interface RakeezaInvoiceWorkspaceProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'sale' | 'purchase';
  invoiceType: 'nagdi' | 'ajel' | 'return_nagdi' | 'return_ajel';
  editingInvoice?: SaleInvoice | PurchaseInvoice | null;
  appData: AppData;
  onUpdateData: (newData: AppData, actionInfo?: { action?: string; module?: string; details?: string; deletedId?: string | number }) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export interface WorkspaceItemRow {
  code: string;
  name: string;
  spec: string;
  qty: number;
  price: number;
  total: number;
  itemId?: string;
  costPrice?: number;
}

export interface WorkspacePayRow {
  id: string;
  method: string;
  amount: number;
}

const EXACT_RAW_CSS = `
:root {
    --primary: #1e293b;
    --secondary: #2563eb;
    --accent: #16a34a;
    --danger: #dc2626;
    --warning: #d97706;
    --bg: #e2e8f0;
    --border: #cbd5e1;
    --light: #f8fafc;
}

.rakeeza-root * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    font-family: "Segoe UI", Tahoma, Arial, sans-serif;
}

.rakeeza-overlay {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background-color: rgba(15, 23, 42, 0.7);
    padding: 4px;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 2000;
}

.app-container {
    width: 100%;
    max-width: 480px;
    background: #fff;
    border-radius: 6px;
    border: 1px solid var(--border);
    box-shadow: 0 2px 10px rgba(0,0,0,0.08);
    display: flex;
    flex-direction: column;
    height: 100%;
    max-height: 98vh;
    position: relative;
    overflow: hidden;
}

.header-title {
    background: var(--primary);
    color: #fff;
    padding: 5px 8px;
    font-size: 10.5px;
    font-weight: bold;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
}

#liveTime {
    font-size: 9px;
}

/* شريط التنقل العلوي للتبويبات */
.portal-nav {
    display: flex;
    background: #f1f5f9;
    border-bottom: 1px solid var(--border);
    overflow-x: auto;
    flex-shrink: 0;
    white-space: nowrap;
    scrollbar-width: none;
}

.portal-nav::-webkit-scrollbar {
    display: none;
}

.nav-tab {
    padding: 6px 8px;
    font-size: 8px;
    font-weight: bold;
    color: #475569;
    background: transparent;
    border: none;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    border-bottom: 2px solid transparent;
    transition: all 0.2s ease;
}

.nav-tab i {
    font-size: 11px;
}

.nav-tab.active {
    color: var(--secondary);
    background: #fff;
    border-bottom-color: var(--secondary);
}

.main-viewport {
    flex: 1;
    position: relative;
    overflow-y: auto;
    background: #f8fafc;
    display: flex;
    flex-direction: column;
    padding: 4px;
}

.tab-content {
    display: none;
    flex-direction: column;
    gap: 4px;
    height: 100%;
}

.tab-content.active {
    display: flex;
}

/* تنسيقات شاشة الفواتير والمخزون المدمجة */
.invoice-card {
    background: #ffffff;
    border: 1px solid var(--border);
    border-radius: 3px;
    padding: 3px;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 2px;
    flex-shrink: 0;
}

.field-inline {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
    position: relative;
}

label {
    font-size: 8px;
    font-weight: bold;
    color: #475569;
}

input, select {
    padding: 2px 4px;
    border: 1px solid var(--border);
    border-radius: 3px;
    font-size: 9px;
    outline: none;
    background: #fff;
    width: 100%;
    height: 22px;
}

.span-2 { grid-column: span 2; }
.span-3 { grid-column: span 3; }

.autocomplete-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    left: 0;
    background: #fff;
    border: 1px solid var(--secondary);
    border-radius: 3px;
    max-height: 110px;
    overflow-y: auto;
    z-index: 9999;
    box-shadow: 0 4px 8px rgba(0,0,0,0.15);
    margin-top: 2px;
}

.autocomplete-item {
    padding: 5px 6px;
    font-size: 9px;
    cursor: pointer;
    border-bottom: 1px solid #f1f5f9;
    color: #1e293b;
}

.autocomplete-item:hover {
    background: #eff6ff;
    color: var(--secondary);
    font-weight: bold;
}

.top-actions-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3px;
    flex-shrink: 0;
}

.btn-action-top {
    width: 100%;
    padding: 5px;
    background: var(--secondary);
    color: white;
    border: none;
    border-radius: 3px;
    font-size: 9.5px;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
}

.btn-action-alt {
    background: #475569;
}

.table-responsive {
    width: 100%;
    flex: 1;
    overflow-y: auto;
    border: 1px solid var(--border);
    border-radius: 3px;
    background: #fff;
}

.rakeeza-root table {
    width: 100%;
    border-collapse: collapse;
    font-size: 8.5px;
    text-align: center;
}

.rakeeza-root th, .rakeeza-root td {
    padding: 2px 2px;
    border: 1px solid var(--border);
    vertical-align: middle;
}

.rakeeza-root th {
    background: #f1f5f9;
    color: var(--primary);
    font-weight: bold;
    position: sticky;
    top: 0;
    z-index: 2;
}

.invoice-item-actions {
    display: inline-flex;
    gap: 4px;
    justify-content: center;
}

.invoice-item-actions i {
    cursor: pointer;
    font-size: 10px;
    padding: 2px;
}

.bottom-fixed-area {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
    background: #fff;
    padding: 4px;
    border-top: 1px solid var(--border);
}

.summary-bar {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 2px;
    background: #ffffff;
    color: #1e293b;
    padding: 4px;
    border-radius: 3px;
    border: 1px solid var(--border);
    text-align: center;
}

.summary-item {
    font-size: 8px;
    background: #f8fafc;
    border: 1px solid var(--border);
    color: #475569;
    padding: 3px 2px;
    border-radius: 2px;
}

.summary-item span {
    font-weight: bold;
    color: #0f172a;
    display: block;
    font-size: 9px;
}

.summary-net {
    grid-column: span 3;
    background: #f1f5f9 !important;
    border: 1px solid #cbd5e1 !important;
    color: #0f172a !important;
    font-size: 9.5px !important;
}

.summary-net span { color: #0f172a !important; font-size: 11px !important; font-weight: bold !important; }

.btn-action-bar {
    display: flex;
    gap: 3px;
}

.btn-action {
    flex: 1;
    padding: 5px;
    border: none;
    border-radius: 3px;
    font-weight: bold;
    font-size: 8.5px;
    color: white;
    cursor: pointer;
    text-align: center;
}

/* النوافذ المنبثقة (Modals) */
.modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.65);
    z-index: 2500;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 6px;
}

.modal-box {
    background: #fff;
    width: 100%;
    max-width: 400px;
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border);
    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
}

.modal-header {
    background: var(--secondary);
    color: white;
    padding: 6px 10px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 10.5px;
    font-weight: bold;
}

.modal-body {
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.big-toggle-group {
    display: flex;
    border: 2px solid var(--secondary);
    border-radius: 4px;
    overflow: hidden;
    height: 24px;
    width: 110px;
}

.big-toggle-btn {
    flex: 1;
    font-size: 9.5px;
    font-weight: bold;
    cursor: pointer;
    border: none;
    background: #fff;
    color: var(--secondary);
    display: flex;
    align-items: center;
    justify-content: center;
}

.big-toggle-btn.active {
    background: var(--secondary);
    color: white;
}

.edit-card-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4px;
}

.lookup-modal-box {
    background: #e5e7eb;
    width: 98vw;
    height: 94vh;
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    border: 2px solid #64748b;
    overflow: hidden;
}

.lookup-layout {
    display: flex;
    flex: 1;
    padding: 4px;
    gap: 4px;
    overflow: hidden;
}

.categories-panel {
    width: 85px;
    background: #f8fafc;
    border: 1px solid #94a3b8;
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    flex-shrink: 0;
}

.categories-header {
    background: #f1f5f9;
    padding: 4px 2px;
    font-size: 8px;
    font-weight: bold;
    border-bottom: 1px solid #cbd5e1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
}

.categories-list {
    flex: 1;
    overflow-y: auto;
}

.category-item {
    padding: 6px 3px;
    font-size: 8px;
    font-weight: bold;
    border-bottom: 1px solid #e2e8f0;
    cursor: pointer;
    text-align: center;
    color: #1e293b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.category-item.active {
    background: #0284c7;
    color: white;
}

.items-panel {
    flex: 1;
    background: #f8fafc;
    border: 1px solid #94a3b8;
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    padding: 4px;
    gap: 3px;
    overflow: hidden;
}

.search-top-bar {
    background: #fff;
    padding: 3px;
    border: 1px solid #cbd5e1;
    border-radius: 3px;
    display: flex;
    gap: 3px;
    align-items: center;
}

.lookup-cards-container {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 2px;
}

.item-card-box {
    background: #fff;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    padding: 5px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.item-card-box:hover {
    border-color: var(--secondary);
    background: #f8fafc;
}

.item-card-box.low-stock {
    border-color: var(--danger);
    background: #fef2f2;
}

.item-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: bold;
    font-size: 9.5px;
    color: var(--primary);
    border-bottom: 1px solid #f1f5f9;
    padding-bottom: 2px;
}

.item-card-body {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 2px;
    font-size: 8px;
    text-align: center;
    padding-top: 1px;
}

.item-card-info {
    background: #f8fafc;
    padding: 2px 1px;
    border-radius: 2px;
    border: 1px solid #e2e8f0;
}

.item-card-box.low-stock .item-card-info {
    background: #fff5f5;
    border-color: #fca5a5;
}

.item-card-info span {
    display: block;
    font-size: 6px;
    color: #64748b;
}

.item-card-info strong {
    font-size: 8px;
}

.system-footer {
    flex-shrink: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #fff;
    padding: 4px 8px;
    border-top: 1px solid var(--border);
    font-size: 8px;
    color: #64748b;
}

/* 📱💻 تحسينات التجاوب والمرونة للشاشات الأكبر (التابلت والكمبيوتر) دون التأثير إطلاقاً على الهاتف */
.app-container.maximized {
    width: 99vw !important;
    max-width: 99vw !important;
    height: 98vh !important;
    max-height: 98vh !important;
    border-radius: 6px !important;
}

@media (min-width: 641px) {
    .rakeeza-overlay {
        padding: 8px;
    }
    .app-container {
        max-width: 760px;
        height: 95vh;
        max-height: 95vh;
        border-radius: 8px;
    }
    .header-title {
        font-size: 11.5px;
        padding: 6px 10px;
    }
    .portal-nav {
        padding: 0 4px;
    }
    .nav-tab {
        font-size: 9.5px;
        padding: 7px 10px;
    }
}

@media (min-width: 768px) {
    .app-container {
        max-width: 920px;
        height: 94vh;
        max-height: 94vh;
    }
    .header-title {
        font-size: 12px;
        padding: 7px 12px;
    }
    .portal-nav {
        gap: 2px;
    }
    .nav-tab {
        flex-direction: row;
        gap: 5px;
        font-size: 10px;
        padding: 7px 12px;
    }
    .nav-tab i {
        font-size: 12px;
    }
    .main-viewport {
        padding: 6px 8px;
        gap: 6px;
    }
    .invoice-card {
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 6px;
        padding: 6px 8px;
        border-radius: 5px;
    }
    .invoice-card .span-2 {
        grid-column: span 2;
    }
    .invoice-card > .field-inline:nth-child(6) {
        grid-column: span 2;
    }
    .invoice-card > .field-inline:nth-child(7) {
        grid-column: span 4;
    }
    .invoice-card #custLimitDisplay,
    .invoice-card .span-3 {
        grid-column: span 6;
    }
    label {
        font-size: 9.5px;
    }
    input, select {
        height: 26px;
        font-size: 10.5px;
        padding: 3px 6px;
    }
    #custLimitDisplay {
        font-size: 9.5px !important;
        padding: 5px 8px !important;
    }
    .pricing-box {
        padding: 5px 8px !important;
    }
    .pricing-box label {
        font-size: 9.5px !important;
    }
    .price-type-btn {
        font-size: 9.5px !important;
        padding: 4px 6px !important;
    }
    .top-actions-grid {
        gap: 6px;
    }
    .btn-action-top {
        padding: 7px !important;
        font-size: 10.5px !important;
    }
    .rakeeza-root table {
        font-size: 10px;
    }
    .rakeeza-root th, .rakeeza-root td {
        padding: 5px 6px;
    }
    .invoice-item-actions i {
        font-size: 12px;
        padding: 2px 4px;
    }
    .summary-bar {
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 4px;
        padding: 6px;
        border-radius: 5px;
    }
    .summary-item {
        font-size: 9px;
        padding: 4px 2px;
    }
    .summary-item span {
        font-size: 10.5px;
    }
    .summary-net {
        grid-column: span 1 !important;
        font-size: 9.5px !important;
    }
    .summary-net span {
        font-size: 11.5px !important;
    }
    .btn-action-bar {
        gap: 6px;
    }
    .btn-action {
        padding: 7px !important;
        font-size: 10.5px !important;
    }
    .lookup-modal-box {
        max-width: 1050px;
        height: 88vh;
    }
    .categories-panel {
        width: 140px;
    }
    .category-item {
        font-size: 10px;
        padding: 8px 4px;
    }
    .lookup-cards-container {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 6px;
        padding: 4px;
    }
    .item-card-header {
        font-size: 11px;
    }
    .item-card-body {
        font-size: 9px;
    }
    .item-card-info strong {
        font-size: 9.5px;
    }
}

@media (min-width: 1025px) {
    .app-container {
        max-width: 1280px;
        height: 92vh;
        max-height: 92vh;
    }
    .header-title {
        font-size: 13px;
        padding: 8px 14px;
    }
    .nav-tab {
        font-size: 11px;
        padding: 8px 16px;
        gap: 7px;
    }
    .nav-tab i {
        font-size: 13px;
    }
    .main-viewport {
        padding: 8px 12px;
        gap: 8px;
    }
    .invoice-card {
        padding: 8px 12px;
        gap: 8px;
    }
    label {
        font-size: 10.5px;
    }
    input, select {
        height: 28px;
        font-size: 11px;
        padding: 4px 8px;
    }
    #custLimitDisplay {
        font-size: 10.5px !important;
        padding: 6px 12px !important;
    }
    .rakeeza-root table {
        font-size: 11px;
    }
    .rakeeza-root th, .rakeeza-root td {
        padding: 7px 8px;
    }
    .summary-bar {
        gap: 6px;
        padding: 8px;
    }
    .summary-item {
        font-size: 10px;
        padding: 5px 3px;
    }
    .summary-item span {
        font-size: 12px;
    }
    .summary-net {
        font-size: 10.5px !important;
    }
    .summary-net span {
        font-size: 13px !important;
    }
    .btn-action-bar {
        gap: 8px;
    }
    .btn-action {
        padding: 9px !important;
        font-size: 11.5px !important;
    }
    .lookup-modal-box {
        max-width: 1200px;
    }
    .categories-panel {
        width: 160px;
    }
}
`;

export const RakeezaInvoiceWorkspace: React.FC<RakeezaInvoiceWorkspaceProps> = ({
  isOpen,
  onClose,
  mode,
  invoiceType,
  editingInvoice,
  appData,
  onUpdateData,
  showToast,
}) => {
  const isSale = mode === 'sale';
  const [currentInvType, setCurrentInvType] = useState<'nagdi' | 'ajel' | 'return_nagdi' | 'return_ajel'>(invoiceType);
  useEffect(() => {
    setCurrentInvType(invoiceType);
  }, [invoiceType]);
  const isReturn = currentInvType.startsWith('return_');
  const isEditing = !!editingInvoice;

  // Window Maximize Toggle for large displays
  const [isMaximized, setIsMaximized] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'invoice' | 'customers' | 'suppliers' | 'receipts' | 'payments' | 'inventory' | 'pnl' | 'backup'>('invoice');

  // Live Time
  const [liveTimeStr, setLiveTimeStr] = useState('');
  useEffect(() => {
    const update = () => {
      setLiveTimeStr(new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  // Invoice Meta
  const invNumber = editingInvoice
    ? editingInvoice.id
    : isSale
    ? appData.nextInvoiceNumber
    : appData.nextPurchaseNumber;

  const [date, setDate] = useState<string>(
    editingInvoice?.date || new Date().toISOString().split('T')[0]
  );
  const [time, setTime] = useState<string>(
    editingInvoice?.time ||
      new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
  );

  // Party State
  const [partyCode, setPartyCode] = useState<string>('1');
  const [partyName, setPartyName] = useState<string>(
    isSale ? (editingInvoice as SaleInvoice)?.customerName || '' : (editingInvoice as PurchaseInvoice)?.supplierName || ''
  );
  const [partyPhone, setPartyPhone] = useState<string>(editingInvoice?.phone || '');
  const [jobSite, setJobSite] = useState<string>(editingInvoice?.notes || '');

  const [showCustomersDropdownList, setShowCustomersDropdownList] = useState(false);
  const [showPhoneDropdownList, setShowPhoneDropdownList] = useState(false);

  // Pricing Mode: 'cash' | 'wholesale' | 'buy'
  const [currentInvoicePriceType, setCurrentInvoicePriceType] = useState<'cash' | 'wholesale' | 'buy'>(
    isSale
      ? (editingInvoice as any)?.salesType === 'wholesale'
        ? 'wholesale'
        : 'cash'
      : 'buy'
  );

  // Invoice Items
  const [currentInvoiceItems, setCurrentInvoiceItems] = useState<WorkspaceItemRow[]>(() => {
    if (editingInvoice?.items && editingInvoice.items.length > 0) {
      return editingInvoice.items.map((itm) => ({
        code: itm.code || `ITM-${itm.itemId || '001'}`,
        name: itm.name,
        spec: itm.spec || itm.notes || '',
        qty: itm.qty || 1,
        price: itm.price || 0,
        total: (itm.qty || 1) * (itm.price || 0),
        itemId: itm.itemId,
        costPrice: itm.costPrice,
      }));
    }
    return [];
  });

  // Global Options State (Modal)
  const [isOptionsModalOpen, setIsOptionsModalOpen] = useState(false);
  const [invDiscType, setInvDiscType] = useState<'val' | 'percent'>('val');
  const [globalInvDisc, setGlobalInvDisc] = useState<string>(
    editingInvoice?.discountValue ? String(editingInvoice.discountValue) : ''
  );
  const [invTaxType, setInvTaxType] = useState<'val' | 'percent'>('percent');
  const [globalInvTax, setGlobalInvTax] = useState<string>(
    editingInvoice?.taxValue ? String(editingInvoice.taxValue) : ''
  );
  const [extraIncomeName, setExtraIncomeName] = useState<string>(
    editingInvoice?.extraRevenueName || ''
  );
  const [extraIncomeVal, setExtraIncomeVal] = useState<string>(
    editingInvoice?.extraRevenueAmount ? String(editingInvoice.extraRevenueAmount) : ''
  );

  // Split Payments
  const [paymentRows, setPaymentRows] = useState<WorkspacePayRow[]>(() => {
    if (editingInvoice?.paymentSplits && editingInvoice.paymentSplits.length > 0) {
      return editingInvoice.paymentSplits.map((s, idx) => ({
        id: `split_${idx}`,
        method: s.method || 'نقدي',
        amount: s.amount || 0,
      }));
    }
    return [];
  });

  // Lookup Modal State
  const [isLookupModalOpen, setIsLookupModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [lookupSearch, setLookupSearch] = useState<string>('');

  // Modify Item Modal State
  const [isModifyModalOpen, setIsModifyModalOpen] = useState(false);
  const [modifyIndex, setModifyIndex] = useState<number>(-1);
  const [modifyName, setModifyName] = useState<string>('');
  const [modifyQty, setModifyQty] = useState<string>('1');
  const [modifyPrice, setModifyPrice] = useState<string>('0');
  const [modifySpec, setModifySpec] = useState<string>('');

  // Edit Item / New Item Modal State
  const [isEditItemModalOpen, setIsEditItemModalOpen] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCode, setNewItemCode] = useState('');
  const [newItemBuyPrice, setNewItemBuyPrice] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('عامة');
  const [newItemCashPrice, setNewItemCashPrice] = useState('');
  const [newItemWholesalePrice, setNewItemWholesalePrice] = useState('');
  const [newItemStock, setNewItemStock] = useState('');

  // Tab Forms
  const [quickCustName, setQuickCustName] = useState('');
  const [quickCustPhone, setQuickCustPhone] = useState('');
  const [quickCustType, setQuickCustType] = useState('cash');
  const [quickCustVal, setQuickCustVal] = useState('0');

  const [quickSuppName, setQuickSuppName] = useState('');
  const [quickSuppPhone, setQuickSuppPhone] = useState('');
  const [quickSuppType, setQuickSuppType] = useState('forUs');
  const [quickSuppVal, setQuickSuppVal] = useState('0');

  const [recParty, setRecParty] = useState('');
  const [recAmount, setRecAmount] = useState('');
  const [recNotes, setRecNotes] = useState('');

  const [payParty, setPayParty] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payNotes, setPayNotes] = useState('');

  // Items Database from appData
  const itemsDatabase = useMemo(() => {
    return appData.items.map((i) => ({
      code: i.code || i.barcode || `1${i.id.substring(0, 4)}`,
      name: i.name,
      category: i.category || 'عامة',
      stock: Number(i.quantity ?? 0),
      buyPrice: Number(i.purchasePrice || i.costPrice || 0),
      cashPrice: Number(i.salePrice || i.normalSellingPrice || i.price || 0),
      wholesalePrice: Number(i.wholesalePrice || i.wholesaleSellingPrice || i.salePrice || 0),
      id: i.id,
    }));
  }, [appData.items]);

  // Categories List
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    itemsDatabase.forEach((c) => {
      if (c.category && c.category.trim()) set.add(c.category.trim());
    });
    if (set.size === 0) {
      set.add('عامة');
      set.add('بويات وأسقف');
      set.add('أدوات صحية');
      set.add('عدد وأدوات');
    }
    return Array.from(set);
  }, [itemsDatabase]);

  // Party Matched
  const matchedCustomer = useMemo(() => {
    if (!isSale) return null;
    return (
      appData.customers.find(
        (c) =>
          c.name.trim().toLowerCase() === partyName.trim().toLowerCase() ||
          (partyPhone && c.phone && c.phone.trim() === partyPhone.trim())
      ) || null
    );
  }, [isSale, partyName, partyPhone, appData.customers]);

  const matchedSupplier = useMemo(() => {
    if (isSale) return null;
    return (
      appData.suppliers.find(
        (s) =>
          s.name.trim().toLowerCase() === partyName.trim().toLowerCase() ||
          (partyPhone && s.phone && s.phone.trim() === partyPhone.trim())
      ) || null
    );
  }, [isSale, partyName, partyPhone, appData.suppliers]);

  // Update Party Code
  useEffect(() => {
    if (isSale && matchedCustomer) {
      setPartyCode(
        matchedCustomer.id?.startsWith('c')
          ? matchedCustomer.id.slice(-4)
          : matchedCustomer.id || '1'
      );
    } else if (!isSale && matchedSupplier) {
      setPartyCode(
        matchedSupplier.id?.startsWith('s')
          ? matchedSupplier.id.slice(-4)
          : matchedSupplier.id || '1'
      );
    } else {
      setPartyCode('1');
    }
  }, [isSale, matchedCustomer, matchedSupplier]);

  // Dynamic Balance Display
  const partyAccountDisplay = useMemo(() => {
    const isCashOp = currentInvType === 'nagdi' || currentInvType === 'return_nagdi';
    const isRet = currentInvType.startsWith('return_');
    if (isSale) {
      if (!matchedCustomer) {
        return {
          typeLabel: isRet ? (isCashOp ? 'مرتجع نقدي' : 'مرتجع آجل') : isCashOp ? 'نقدي' : 'آجل',
          balanceVal: 0,
        };
      }
      const sum = calculateCustomerBalance(matchedCustomer, appData);
      return {
        typeLabel: sum.balance > 0 ? 'آجل (عليه)' : sum.balance < 0 ? 'آجل (له)' : 'نقدي',
        balanceVal: Math.abs(sum.balance),
      };
    } else {
      if (!matchedSupplier) {
        return {
          typeLabel: isRet ? (isCashOp ? 'مرتجع نقدي' : 'مرتجع آجل') : isCashOp ? 'نقدي' : 'آجل',
          balanceVal: 0,
        };
      }
      const sum = calculateSupplierBalance(matchedSupplier, appData);
      return {
        typeLabel: sum.balance > 0 ? 'آجل (له مستحق)' : sum.balance < 0 ? 'آجل (عليه)' : 'نقدي',
        balanceVal: Math.abs(sum.balance),
      };
    }
  }, [isSale, matchedCustomer, matchedSupplier, appData, currentInvType]);

  // -------------------------------------------------------------
  // ⚡ Precise Calculations Engine with Instant Live Updates
  // -------------------------------------------------------------
  const calculations = useMemo(() => {
    let totalQty = 0;
    let subTotal = 0;

    currentInvoiceItems.forEach((item) => {
      const q = Number(item.qty) || 0;
      const p = Number(item.price) || 0;
      totalQty += q;
      subTotal += q * p;
    });

    const discInput = Math.max(0, parseFloat(globalInvDisc) || 0);
    const rawDisc = invDiscType === 'percent' ? (subTotal * discInput) / 100 : discInput;
    const disc = Math.min(subTotal, Math.max(0, rawDisc));

    const taxInput = Math.max(0, parseFloat(globalInvTax) || 0);
    const taxableBase = Math.max(0, subTotal - disc);
    const rawTax = invTaxType === 'percent' ? (taxableBase * taxInput) / 100 : taxInput;
    const tax = Math.max(0, rawTax);

    const extra = Math.max(0, parseFloat(extraIncomeVal) || 0);
    const net = Math.max(0, subTotal - disc + tax + extra);

    const isCashOperation = currentInvType === 'nagdi' || currentInvType === 'return_nagdi';
    let paid = 0;
    if (paymentRows.length === 0) {
      paid = isCashOperation ? net : 0;
    } else {
      paymentRows.forEach((p) => {
        paid += Number(p.amount) || 0;
      });
    }

    const remain = isCashOperation && paymentRows.length === 0 ? 0 : Math.max(0, net - paid);

    return {
      totalQty,
      subTotal,
      disc,
      tax,
      extra,
      net,
      paid,
      remain,
    };
  }, [
    currentInvoiceItems,
    globalInvDisc,
    invDiscType,
    globalInvTax,
    invTaxType,
    extraIncomeVal,
    paymentRows,
    currentInvType,
  ]);

  // Select Customer/Supplier from Autocomplete
  const selectParty = (party: Customer | Supplier) => {
    setPartyCode(
      party.id?.startsWith('c') || party.id?.startsWith('s')
        ? party.id.slice(-4)
        : party.id || '1'
    );
    setPartyName(party.name);
    setPartyPhone(party.phone || '');
    setShowCustomersDropdownList(false);
    setShowPhoneDropdownList(false);

    if (isSale && (party as Customer).priceTier === 'wholesale') {
      handleSetInvoicePriceType('wholesale');
    }
  };

  // Change Pricing Mode (cash, wholesale, buy)
  const handleSetInvoicePriceType = (type: 'cash' | 'wholesale' | 'buy') => {
    setCurrentInvoicePriceType(type);
    setCurrentInvoiceItems((prev) =>
      prev.map((item) => {
        const db = itemsDatabase.find(
          (i) =>
            i.code === item.code ||
            (item.itemId && i.id === item.itemId) ||
            i.name.trim().toLowerCase() === item.name.trim().toLowerCase()
        );
        if (db) {
          const newPrice =
            type === 'wholesale'
              ? db.wholesalePrice
              : type === 'buy'
              ? db.buyPrice
              : db.cashPrice;
          return {
            ...item,
            price: newPrice,
            total: item.qty * newPrice,
          };
        }
        return item;
      })
    );
  };

  // Quick Add Item from Lookup Table
  const quickAddItemToInvoiceAndReturn = (dbItem: typeof itemsDatabase[0]) => {
    const price =
      currentInvoicePriceType === 'wholesale'
        ? dbItem.wholesalePrice
        : currentInvoicePriceType === 'buy'
        ? dbItem.buyPrice
        : dbItem.cashPrice;

    setCurrentInvoiceItems((prev) => {
      const existing = prev.find(
        (i) =>
          i.code === dbItem.code ||
          (dbItem.id && i.itemId === dbItem.id) ||
          i.name.trim().toLowerCase() === dbItem.name.trim().toLowerCase()
      );
      if (existing) {
        return prev.map((i) =>
          i === existing
            ? { ...i, qty: i.qty + 1, total: (i.qty + 1) * i.price }
            : i
        );
      } else {
        return [
          ...prev,
          {
            code: dbItem.code,
            name: dbItem.name,
            spec: '',
            qty: 1,
            price,
            total: price,
            itemId: dbItem.id,
            costPrice: dbItem.buyPrice,
          },
        ];
      }
    });

    setIsLookupModalOpen(false);
  };

  // Modify Item in Invoice
  const openModifyInvoiceItem = (index: number) => {
    const item = currentInvoiceItems[index];
    if (!item) return;
    setModifyIndex(index);
    setModifyName(item.name);
    setModifyQty(String(item.qty));
    setModifyPrice(String(item.price));
    setModifySpec(item.spec || '');
    setIsModifyModalOpen(true);
  };

  const saveModifiedInvoiceItem = () => {
    if (modifyIndex < 0 || modifyIndex >= currentInvoiceItems.length) return;
    const q = parseFloat(modifyQty) || 1;
    const p = parseFloat(modifyPrice) || 0;
    const sp = modifySpec.trim();

    setCurrentInvoiceItems((prev) =>
      prev.map((itm, idx) =>
        idx === modifyIndex
          ? {
              ...itm,
              qty: q,
              price: p,
              spec: sp,
              total: q * p,
            }
          : itm
      )
    );
    setIsModifyModalOpen(false);
  };

  const removeItem = (index: number) => {
    setCurrentInvoiceItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Add / Remove Payment Rows in Options Modal
  const addPaymentRow = (defaultMethod = 'نقدي', amount = 0) => {
    setPaymentRows((prev) => [
      ...prev,
      {
        id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        method: defaultMethod,
        amount,
      },
    ]);
  };

  const removePaymentRow = (id: string) => {
    setPaymentRows((prev) => prev.filter((r) => r.id !== id));
  };

  // Save New Item to Database from Modal
  const saveNewItemData = () => {
    const name = newItemName.trim();
    const code = newItemCode.trim() || `1${itemsDatabase.length + 101}`;
    const category = newItemCategory || 'عامة';
    const buyPrice = parseFloat(newItemBuyPrice) || 0;
    const cashPrice = parseFloat(newItemCashPrice) || buyPrice * 1.15;
    const wholesalePrice = parseFloat(newItemWholesalePrice) || cashPrice * 0.95;
    const stock = parseFloat(newItemStock) || 0;

    if (!name) {
      alert('أدخل اسم الصنف');
      return;
    }

    const newItemObj = {
      id: `itm_${Date.now()}`,
      code,
      name,
      category,
      quantity: stock,
      purchasePrice: buyPrice,
      costPrice: buyPrice,
      salePrice: cashPrice,
      normalSellingPrice: cashPrice,
      wholesalePrice,
      wholesaleSellingPrice: wholesalePrice,
      minQuantity: 5,
    };

    const updatedData = {
      ...appData,
      items: [...appData.items, newItemObj],
    };
    onUpdateData(updatedData, {
      action: 'add_item',
      module: 'المخزن',
      details: `إضافة صنف جديد: ${name} (${code})`,
    });

    setIsEditItemModalOpen(false);
    setIsLookupModalOpen(false);

    // Also insert into invoice
    quickAddItemToInvoiceAndReturn({
      code,
      name,
      category,
      stock,
      buyPrice,
      cashPrice,
      wholesalePrice,
      id: newItemObj.id,
    });
  };

  // -------------------------------------------------------------
  // 💾 Save & Post Invoice
  // -------------------------------------------------------------
  const saveInvoice = () => {
    if (currentInvoiceItems.length === 0) {
      alert('الفاتورة فارغة! يرجى إدراج صنف واحد على الأقل.');
      return;
    }
    if (!partyName.trim()) {
      alert(`يرجى إدخال اسم ${isSale ? 'العميل' : 'المورد'}`);
      return;
    }

    const { subTotal, disc, tax, extra, net, paid, remain } = calculations;

    const finalInvoiceItems: InvoiceItem[] = currentInvoiceItems.map((u) => ({
      itemId: u.itemId,
      code: u.code,
      name: u.name,
      qty: u.qty,
      price: u.price,
      costPrice: u.costPrice,
      total: u.total,
      spec: u.spec,
      notes: u.spec,
      discVal: 0,
      discType: 'val',
      taxVal: 0,
      taxType: 'fixed',
      discount: 0,
      discountType: 'fixed',
      discountValue: 0,
      tax: 0,
      taxValue: 0,
    }));

    const firstMethod = paymentRows[0]?.method || 'نقدي';
    const primaryKey: 'drawer' | 'vodafone' | 'instapay' | 'bank' =
      firstMethod.includes('فودافون')
        ? 'vodafone'
        : firstMethod.includes('انستاباي')
        ? 'instapay'
        : firstMethod.includes('فيزا') || firstMethod.includes('بنك')
        ? 'bank'
        : 'drawer';

    const nowIso = new Date().toISOString();
    const currentUser = appData.users.find((u) => u.id === appData.currentUser) || appData.users[0];

    if (isSale) {
      const saleInv: SaleInvoice = {
        id: invNumber,
        clientSyncId: isEditing
          ? (editingInvoice as any)?.clientSyncId || `sale_${invNumber}_${Date.now()}`
          : `sale_${invNumber}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        companyId: appData.companyId || 'COMP-000001',
        branchId: appData.activeBranchId || 'main',
        customerName: partyName.trim(),
        phone: partyPhone.trim(),
        notes: jobSite.trim() || undefined,
        date,
        time,
        items: finalInvoiceItems,
        subtotal: subTotal,
        discount: disc,
        discountType: invDiscType === 'percent' ? 'percent' : 'fixed',
        discountValue: parseFloat(globalInvDisc) || 0,
        tax,
        taxType: invTaxType === 'percent' ? 'percent' : 'fixed',
        taxValue: parseFloat(globalInvTax) || 0,
        extraRevenueAmount: extra > 0 ? extra : undefined,
        extraRevenueName: extraIncomeName.trim() || undefined,
        fees: 0,
        total: net,
        paymentMethod: paymentRows.length > 1 ? 'split' : primaryKey,
        paymentSplits: paymentRows.map((r) => ({ method: r.method, amount: r.amount })),
        type: currentInvType,
        salesType: currentInvoicePriceType === 'wholesale' ? 'wholesale' : 'cash',
        paidAmount: paid,
        remainingAmount: remain,
        status: 'approved',
        createdAt: isEditing ? (editingInvoice?.createdAt || nowIso) : nowIso,
        updatedAt: nowIso,
        createdBy: currentUser?.name || 'مدير النظام',
        createdByUserId: currentUser?.id,
        createdByUserCode: currentUser?.code || 1,
      };

      const updatedData = postSaleInvoice(appData, saleInv, isEditing, isEditing ? invNumber : undefined);
      onUpdateData(updatedData, {
        action: isReturn ? 'return' : isEditing ? 'edit' : 'create',
        module: 'المبيعات',
        details: `${isReturn ? 'مرتجع' : 'فاتورة'} مبيعات #${invNumber} بقيمة ${net.toFixed(2)} ج.م للعميل "${partyName}"`,
      });
      showToast(`تم حفظ ${isReturn ? 'مرتجع' : 'فاتورة'} مبيعات #${invNumber} بنجاح وترحيل الحسابات فورا`, 'success');
      onClose();
    } else {
      const purInv: PurchaseInvoice = {
        id: invNumber,
        clientSyncId: isEditing
          ? (editingInvoice as any)?.clientSyncId || `pur_${invNumber}_${Date.now()}`
          : `pur_${invNumber}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        companyId: appData.companyId || 'COMP-000001',
        branchId: appData.activeBranchId || 'main',
        supplierName: partyName.trim(),
        phone: partyPhone.trim(),
        notes: jobSite.trim() || undefined,
        date,
        time,
        items: finalInvoiceItems,
        subtotal: subTotal,
        discount: disc,
        discountType: invDiscType === 'percent' ? 'percent' : 'fixed',
        discountValue: parseFloat(globalInvDisc) || 0,
        tax,
        taxType: invTaxType === 'percent' ? 'percent' : 'fixed',
        taxValue: parseFloat(globalInvTax) || 0,
        extraRevenueAmount: extra > 0 ? extra : undefined,
        extraRevenueName: extraIncomeName.trim() || undefined,
        fees: 0,
        total: net,
        paymentMethod: primaryKey,
        paymentSplits: paymentRows.map((r) => ({
          method: r.method.includes('فودافون') ? 'vodafone' : r.method.includes('انستاباي') ? 'instapay' : r.method.includes('بنك') ? 'bank' : 'drawer',
          amount: r.amount,
        })),
        type: currentInvType,
        paidAmount: paid,
        remainingAmount: remain,
        status: 'approved',
        createdAt: isEditing ? (editingInvoice?.createdAt || nowIso) : nowIso,
        updatedAt: nowIso,
        createdBy: currentUser?.name || 'مدير النظام',
        createdByUserId: currentUser?.id,
        createdByUserCode: currentUser?.code || 1,
      };

      const updatedData = postPurchaseInvoice(appData, purInv, isEditing, isEditing ? invNumber : undefined);
      onUpdateData(updatedData, {
        action: isReturn ? 'return' : isEditing ? 'edit' : 'create',
        module: 'المشتريات',
        details: `${isReturn ? 'مرتجع' : 'فاتورة'} مشتريات #${invNumber} بقيمة ${net.toFixed(2)} ج.م للمورد "${partyName}"`,
      });
      showToast(`تم حفظ ${isReturn ? 'مرتجع' : 'فاتورة'} مشتريات #${invNumber} بنجاح وترحيل الحسابات فورا`, 'success');
      onClose();
    }
  };

  // Quick Customer Save
  const saveQuickCustomer = () => {
    const name = quickCustName.trim();
    const phone = quickCustPhone.trim();
    const type = quickCustType;
    const val = parseFloat(quickCustVal) || 0;
    if (!name) {
      alert('أدخل اسم العميل');
      return;
    }
    const newCust: Customer = {
      id: `c_${Date.now()}`,
      name,
      phone,
      balance: type === 'onUs' ? val : type === 'forUs' ? -val : 0,
    };
    const updated = { ...appData, customers: [...appData.customers, newCust] };
    onUpdateData(updated, {
      action: 'create_customer',
      module: 'العملاء',
      details: `إضافة عميل جديد: ${name}`,
    });
    setQuickCustName('');
    setQuickCustPhone('');
    setQuickCustVal('0');
    alert('تم حفظ العميل بنجاح');
  };

  // Quick Supplier Save
  const saveQuickSupplier = () => {
    const name = quickSuppName.trim();
    const phone = quickSuppPhone.trim();
    const val = parseFloat(quickSuppVal) || 0;
    if (!name) {
      alert('أدخل اسم المورد');
      return;
    }
    const newSupp: Supplier = {
      id: `s_${Date.now()}`,
      name,
      phone,
      balance: quickSuppType === 'forUs' ? val : -val,
    };
    const updated = { ...appData, suppliers: [...appData.suppliers, newSupp] };
    onUpdateData(updated, {
      action: 'create_supplier',
      module: 'الموردين',
      details: `إضافة مورد جديد: ${name}`,
    });
    setQuickSuppName('');
    setQuickSuppPhone('');
    setQuickSuppVal('0');
    alert('تم حفظ المورد بنجاح');
  };

  // Save Receipt
  const saveReceipt = () => {
    const party = recParty.trim();
    const amount = parseFloat(recAmount) || 0;
    const notes = recNotes.trim() || '-';
    if (amount <= 0) {
      alert('أدخل مبلغ صحيح');
      return;
    }
    const newId = (appData.nextCashId || 1);
    const updatedCashBox = {
      ...appData.cashBox,
      drawer: (appData.cashBox.drawer || 0) + amount,
    };
    const newTx = {
      id: newId,
      companyId: appData.companyId || 'COMP-000001',
      branchId: appData.activeBranchId || 'main',
      date: new Date().toISOString().split('T')[0],
      type: 'receive' as const,
      method: 'drawer' as const,
      amount,
      note: `سند قبض: ${party} - ${notes}`,
      customerName: party,
      status: 'approved' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'مدير النظام',
      createdByUserCode: 1,
    };
    onUpdateData(
      {
        ...appData,
        nextCashId: newId + 1,
        cashBox: updatedCashBox,
        cashTransactions: [...appData.cashTransactions, newTx],
      },
      {
        action: 'receipt',
        module: 'الخزينة',
        details: `سند قبض بقيمة ${amount} ج.م من: ${party}`,
      }
    );
    setRecParty('');
    setRecAmount('');
    setRecNotes('');
    alert('تم حفظ سند القبض وإيداعه بالخزنة');
  };

  // Save Payment
  const savePayment = () => {
    const party = payParty.trim();
    const amount = parseFloat(payAmount) || 0;
    const notes = payNotes.trim() || '-';
    if (amount <= 0) {
      alert('أدخل مبلغ صحيح');
      return;
    }
    const newId = (appData.nextCashId || 1);
    const updatedCashBox = {
      ...appData.cashBox,
      drawer: (appData.cashBox.drawer || 0) - amount,
    };
    const newTx = {
      id: newId,
      companyId: appData.companyId || 'COMP-000001',
      branchId: appData.activeBranchId || 'main',
      date: new Date().toISOString().split('T')[0],
      type: 'pay' as const,
      method: 'drawer' as const,
      amount,
      note: `سند صرف: ${party} - ${notes}`,
      customerName: party,
      status: 'approved' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'مدير النظام',
      createdByUserCode: 1,
    };
    onUpdateData(
      {
        ...appData,
        nextCashId: newId + 1,
        cashBox: updatedCashBox,
        cashTransactions: [...appData.cashTransactions, newTx],
      },
      {
        action: 'payment',
        module: 'الخزينة',
        details: `سند صرف بقيمة ${amount} ج.م إلى: ${party}`,
      }
    );
    setPayParty('');
    setPayAmount('');
    setPayNotes('');
    alert('تم حفظ سند الصرف وخصمه من الخزنة');
  };

  // PnL Summary
  const pnlSummary = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    (appData.cashTransactions || []).forEach((t) => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'receive' || t.type === 'deposit') totalIn += amt;
      else if (t.type === 'pay' || t.type === 'withdraw') totalOut += amt;
    });
    return {
      totalIn,
      totalOut,
      net: totalIn - totalOut,
    };
  }, [appData.cashTransactions]);

  // Receipts / Payments table lists
  const receiptsList = useMemo(() => {
    return (appData.cashTransactions || []).filter(
      (t) => t.type === 'receive' || t.type === 'deposit'
    );
  }, [appData.cashTransactions]);

  const paymentsList = useMemo(() => {
    return (appData.cashTransactions || []).filter(
      (t) => t.type === 'pay' || t.type === 'withdraw'
    );
  }, [appData.cashTransactions]);

  if (!isOpen) return null;

  return (
    <div className="rakeeza-root">
      <style dangerouslySetInnerHTML={{ __html: EXACT_RAW_CSS }} />

      <div className="rakeeza-overlay">
        <div className={`app-container ${isMaximized ? 'maximized' : ''}`} dir="rtl">
          {/* Header Title */}
          <div className="header-title">
            <span>
              <i className={isSale ? "fa-solid fa-receipt" : "fa-solid fa-truck-ramp-box"}></i>{' '}
              {isSale
                ? currentInvType === 'return_nagdi'
                  ? 'تسجيل مرتجع مبيعات نقدي'
                  : currentInvType === 'return_ajel'
                  ? 'تسجيل مرتجع مبيعات آجل'
                  : currentInvType === 'nagdi'
                  ? 'تسجيل فاتورة مبيعات نقدية'
                  : 'تسجيل فاتورة مبيعات آجلة'
                : currentInvType === 'return_nagdi'
                ? 'تسجيل مرتجع مشتريات نقدي'
                : currentInvType === 'return_ajel'
                ? 'تسجيل مرتجع مشتريات آجل'
                : currentInvType === 'nagdi'
                ? 'تسجيل فاتورة مشتريات نقدية'
                : 'تسجيل فاتورة مشتريات وتوريدات آجلة'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span id="liveTime">{liveTimeStr}</span>
              <button
                type="button"
                onClick={() => setIsMaximized((prev) => !prev)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  padding: '0 4px',
                }}
                title={isMaximized ? 'تصغير الواجهة للحجم التلقائي' : 'تكبير الواجهة للشاشة الكاملة'}
              >
                <i className={`fa-solid ${isMaximized ? 'fa-compress' : 'fa-expand'}`}></i>
              </button>
              <button
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  padding: '0 4px',
                }}
                title="إغلاق"
              >
                ✕
              </button>
            </div>
          </div>

          {/* شريط التنقل العلوي للتبويبات */}
          <div className="portal-nav" id="portalNav">
            <button
              className={`nav-tab ${activeTab === 'invoice' ? 'active' : ''}`}
              onClick={() => setActiveTab('invoice')}
            >
              <i className="fa-solid fa-receipt"></i>الفواتير
            </button>
            <button
              className={`nav-tab ${activeTab === 'customers' ? 'active' : ''}`}
              onClick={() => setActiveTab('customers')}
            >
              <i className="fa-solid fa-user-tie"></i>العملاء
            </button>
            <button
              className={`nav-tab ${activeTab === 'suppliers' ? 'active' : ''}`}
              onClick={() => setActiveTab('suppliers')}
            >
              <i className="fa-solid fa-truck-field"></i>الموردين
            </button>
            <button
              className={`nav-tab ${activeTab === 'receipts' ? 'active' : ''}`}
              onClick={() => setActiveTab('receipts')}
            >
              <i className="fa-solid fa-file-invoice-dollar"></i>القبض
            </button>
            <button
              className={`nav-tab ${activeTab === 'payments' ? 'active' : ''}`}
              onClick={() => setActiveTab('payments')}
            >
              <i className="fa-solid fa-file-invoice"></i>الصرف
            </button>
            <button
              className={`nav-tab ${activeTab === 'inventory' ? 'active' : ''}`}
              onClick={() => setActiveTab('inventory')}
            >
              <i className="fa-solid fa-boxes-stacked"></i>المخزن
            </button>
            <button
              className={`nav-tab ${activeTab === 'pnl' ? 'active' : ''}`}
              onClick={() => setActiveTab('pnl')}
            >
              <i className="fa-solid fa-chart-line"></i>الأرباح
            </button>
            <button
              className={`nav-tab ${activeTab === 'backup' ? 'active' : ''}`}
              onClick={() => setActiveTab('backup')}
            >
              <i className="fa-solid fa-database"></i>النسخ
            </button>
          </div>

          <div className="main-viewport">
            {/* 1. شاشة الفواتير والمخزون الأساسية */}
            <div id="tab-invoice" className={`tab-content ${activeTab === 'invoice' ? 'active' : ''}`}>
              <div className="invoice-card">
                <div className="field-inline">
                  <label>رقم الفاتورة</label>
                  <input type="text" id="invNum" value={invNumber} readOnly />
                </div>
                <div className="field-inline">
                  <label>التاريخ</label>
                  <input
                    type="date"
                    id="invDate"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div className="field-inline">
                  <label>الوقت</label>
                  <input
                    type="time"
                    id="invTime"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                  />
                </div>
                <div className="field-inline">
                  <label>{isSale ? 'كود العميل' : 'كود المورد'}</label>
                  <input
                    type="text"
                    id="custCode"
                    value={partyCode}
                    placeholder="الكود..."
                    onChange={(e) => {
                      const val = e.target.value;
                      setPartyCode(val);
                      const list = isSale ? appData.customers : appData.suppliers;
                      const matched = list.find((p) => p.id === val || (p as any).code === val);
                      if (matched) selectParty(matched);
                    }}
                  />
                </div>
                <div className="field-inline">
                  <label>{isSale ? 'اسم العميل (بحث)' : 'اسم المورد (بحث)'}</label>
                  <input
                    type="text"
                    id="custSearchInput"
                    value={partyName}
                    placeholder="اكتب للبحث..."
                    onFocus={() => setShowCustomersDropdownList(true)}
                    onChange={(e) => {
                      setPartyName(e.target.value);
                      setShowCustomersDropdownList(true);
                    }}
                  />
                  {showCustomersDropdownList && (
                    <div id="customersDropdownList" className="autocomplete-dropdown" style={{ display: 'block' }}>
                      {(isSale ? appData.customers : appData.suppliers)
                        .filter((p) =>
                          !partyName.trim()
                            ? true
                            : (p.name || '').toLowerCase().includes(partyName.trim().toLowerCase()) ||
                              (p.phone || '').includes(partyName.trim())
                        )
                        .slice(0, 8)
                        .map((p) => (
                          <div
                            key={p.id}
                            className="autocomplete-item"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              selectParty(p);
                            }}
                          >
                            <strong>{p.id?.slice(-4) || '1'}</strong> - {p.name}{' '}
                            <span style={{ color: '#64748b', fontSize: '7.5px' }}>({p.phone || 'بدون هاتف'})</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
                <div className="field-inline">
                  <label>رقم الهاتف (بحث)</label>
                  <input
                    type="text"
                    id="custPhone"
                    value={partyPhone}
                    placeholder="ابحث برقم الهاتف..."
                    onFocus={() => setShowPhoneDropdownList(true)}
                    onChange={(e) => {
                      setPartyPhone(e.target.value);
                      setShowPhoneDropdownList(true);
                    }}
                  />
                  {showPhoneDropdownList && (
                    <div id="phoneDropdownList" className="autocomplete-dropdown" style={{ display: 'block' }}>
                      {(isSale ? appData.customers : appData.suppliers)
                        .filter((p) =>
                          !partyPhone.trim() ? true : (p.phone || '').includes(partyPhone.trim())
                        )
                        .slice(0, 8)
                        .map((p) => (
                          <div
                            key={p.id}
                            className="autocomplete-item"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              selectParty(p);
                            }}
                          >
                            <strong>{p.phone}</strong> - {p.name}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
                <div className="field-inline span-3">
                  <label>البيان / جهة العمل</label>
                  <input
                    type="text"
                    id="jobSite"
                    value={jobSite}
                    onChange={(e) => setJobSite(e.target.value)}
                  />
                </div>
                <div
                  id="custLimitDisplay"
                  className="span-3"
                  style={{
                    fontSize: '8px',
                    color: '#334155',
                    fontWeight: 'bold',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    padding: '3px 6px',
                    borderRadius: '3px',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>
                    حالة الحساب:{' '}
                    <strong id="lblCustAccountType" style={{ color: '#0f172a' }}>
                      {partyAccountDisplay.typeLabel}
                    </strong>
                  </span>
                  <span>
                    المبلغ (له / عليه):{' '}
                    <strong id="lblCustBalanceVal" style={{ color: '#0f172a' }}>
                      {partyAccountDisplay.balanceVal.toFixed(2)}
                    </strong>{' '}
                    ج.م
                  </span>
                </div>
              </div>

              {/* Pricing Box */}
              <div
                className="pricing-box"
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  padding: '3px 5px',
                  borderRadius: '3px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexShrink: 0,
                }}
              >
                <label style={{ color: '#334155', fontSize: '8px' }}>نظام تسعير الفاتورة:</label>
                <div style={{ display: 'flex', gap: '2px', flex: 1, marginRight: '4px' }}>
                  <button
                    type="button"
                    className={`price-type-btn ${currentInvoicePriceType === 'cash' ? 'active' : ''}`}
                    onClick={() => handleSetInvoicePriceType('cash')}
                    style={{
                      flex: 1,
                      padding: '3px',
                      background: currentInvoicePriceType === 'cash' ? '#2563eb' : '#fff',
                      color: currentInvoicePriceType === 'cash' ? 'white' : '#334155',
                      border: currentInvoicePriceType === 'cash' ? '1px solid #2563eb' : '1px solid #cbd5e1',
                      borderRadius: '3px',
                      fontWeight: 'bold',
                      fontSize: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    سعر نقدي
                  </button>
                  <button
                    type="button"
                    className={`price-type-btn ${currentInvoicePriceType === 'wholesale' ? 'active' : ''}`}
                    onClick={() => handleSetInvoicePriceType('wholesale')}
                    style={{
                      flex: 1,
                      padding: '3px',
                      background: currentInvoicePriceType === 'wholesale' ? '#2563eb' : '#fff',
                      color: currentInvoicePriceType === 'wholesale' ? 'white' : '#334155',
                      border: currentInvoicePriceType === 'wholesale' ? '1px solid #2563eb' : '1px solid #cbd5e1',
                      borderRadius: '3px',
                      fontWeight: 'bold',
                      fontSize: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    سعر جملة
                  </button>
                  <button
                    type="button"
                    className={`price-type-btn ${currentInvoicePriceType === 'buy' ? 'active' : ''}`}
                    onClick={() => handleSetInvoicePriceType('buy')}
                    style={{
                      flex: 1,
                      padding: '3px',
                      background: currentInvoicePriceType === 'buy' ? '#2563eb' : '#fff',
                      color: currentInvoicePriceType === 'buy' ? 'white' : '#334155',
                      border: currentInvoicePriceType === 'buy' ? '1px solid #2563eb' : '1px solid #cbd5e1',
                      borderRadius: '3px',
                      fontWeight: 'bold',
                      fontSize: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    سعر شراء
                  </button>
                </div>
              </div>

              {/* Action Buttons Top */}
              <div className="top-actions-grid">
                <button
                  className="btn-action-top"
                  onClick={() => setIsLookupModalOpen(true)}
                  style={{ padding: '7px', fontSize: '10px' }}
                >
                  <i className="fa-solid fa-boxes-stacked"></i> دليل الأصناف (إضافة سريعة)
                </button>
                <button
                  className="btn-action-top btn-action-alt"
                  onClick={() => setIsOptionsModalOpen(true)}
                  style={{ padding: '7px', fontSize: '10px' }}
                >
                  <i className="fa-solid fa-sliders"></i> الخصم، الضريبة والدفع
                </button>
              </div>

              {/* Table */}
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '5%' }}>م</th>
                      <th style={{ width: '22%', textAlign: 'right' }}>الصنف</th>
                      <th style={{ width: '18%', textAlign: 'right' }}>الوصف</th>
                      <th style={{ width: '9%' }}>الكمية</th>
                      <th style={{ width: '11%' }}>السعر</th>
                      <th style={{ width: '15%' }}>الإجمالي</th>
                      <th style={{ width: '20%' }}>إجراء</th>
                    </tr>
                  </thead>
                  <tbody id="invoiceItemsTable">
                    {currentInvoiceItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ color: '#94a3b8', padding: '25px' }}>
                          لم يتم إدراج أصناف بعد (اضغط من دليل الأصناف للإضافة)
                        </td>
                      </tr>
                    ) : (
                      currentInvoiceItems.map((item, index) => (
                        <tr key={index}>
                          <td>{index + 1}</td>
                          <td style={{ textAlign: 'right' }}>{item.name}</td>
                          <td style={{ textAlign: 'right', color: '#64748b' }}>{item.spec || '-'}</td>
                          <td>{item.qty}</td>
                          <td>{item.price.toFixed(2)}</td>
                          <td>{item.total.toFixed(2)}</td>
                          <td>
                            <span className="invoice-item-actions">
                              <i
                                className="fa-solid fa-pen-to-square"
                                style={{ color: 'var(--secondary)' }}
                                onClick={() => openModifyInvoiceItem(index)}
                              ></i>
                              <i
                                className="fa-solid fa-trash"
                                style={{ color: 'var(--danger)' }}
                                onClick={() => removeItem(index)}
                              ></i>
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Bottom Fixed Area */}
              <div className="bottom-fixed-area">
                <div className="summary-bar">
                  <div className="summary-item">
                    الإجمالي: <span id="lblSubTotal">{calculations.subTotal.toFixed(2)}</span>
                  </div>
                  <div className="summary-item">
                    إجمالي الخصم: <span id="lblDiscTotal">{calculations.disc.toFixed(2)}</span>
                  </div>
                  <div className="summary-item">
                    إجمالي الضريبة: <span id="lblTaxTotal">{calculations.tax.toFixed(2)}</span>
                  </div>
                  <div className="summary-item">
                    إجمالي الكمية: <span id="lblItemsTotal">{calculations.totalQty}</span>
                  </div>
                  <div className="summary-item">
                    {isReturn
                      ? currentInvType === 'return_nagdi'
                        ? (isSale ? 'المسترد نقداً للعميل:' : 'المسترد نقداً للدرج:')
                        : 'المدفوع:'
                      : currentInvType === 'nagdi'
                      ? 'المدفوع نقداً:'
                      : 'المسدد مقدم:'}{' '}
                    <span id="lblPaidTotal">{calculations.paid.toFixed(2)}</span>
                  </div>
                  <div className="summary-item">
                    {isReturn
                      ? currentInvType === 'return_ajel'
                        ? (isSale ? 'خصم من مديونية العميل:' : 'خصم من مستحق المورد:')
                        : 'المتبقي:'
                      : currentInvType === 'ajel'
                      ? (isSale ? 'المتبقي (مديونية):' : 'المتبقي (مستحق):')
                      : 'المتبقي:'}{' '}
                    <span id="lblRemainTotal">{calculations.remain.toFixed(2)}</span>
                  </div>
                  <div className="summary-item summary-net">
                    الصافي النهائي: <span id="lblNetTotal">{calculations.net.toFixed(2)}</span>
                  </div>
                </div>

                <div className="btn-action-bar">
                  <button
                    className="btn-action"
                    style={{ background: 'var(--accent)', padding: '7px', fontSize: '9.5px' }}
                    onClick={saveInvoice}
                  >
                    <i className="fa-solid fa-save"></i> {isReturn ? 'حفظ وترحيل المرتجع' : 'حفظ وترحيل الفاتورة'}
                  </button>
                  <button
                    className="btn-action"
                    style={{ background: 'var(--secondary)', padding: '7px', fontSize: '9.5px' }}
                    onClick={() => {
                      const dummyInv: any = {
                        id: invNumber,
                        customerName: partyName,
                        supplierName: partyName,
                        phone: partyPhone,
                        date,
                        time,
                        notes: jobSite,
                        items: currentInvoiceItems.map((i) => ({ ...i, notes: i.spec })),
                        subtotal: calculations.subTotal,
                        discount: calculations.disc,
                        tax: calculations.tax,
                        total: calculations.net,
                        paidAmount: calculations.paid,
                        remainingAmount: calculations.remain,
                        type: currentInvType,
                      };
                      printInvoiceWindow(dummyInv, isSale, appData.settings);
                    }}
                  >
                    <i className="fa-solid fa-print"></i> طباعة
                  </button>
                </div>
              </div>
            </div>

            {/* 2. العملاء */}
            <div id="tab-customers" className={`tab-content ${activeTab === 'customers' ? 'active' : ''}`}>
              <div className="invoice-card" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                <div className="field-inline span-2">
                  <label>اسم العميل</label>
                  <input
                    type="text"
                    id="quickCustName"
                    placeholder="اسم العميل..."
                    value={quickCustName}
                    onChange={(e) => setQuickCustName(e.target.value)}
                  />
                </div>
                <div className="field-inline">
                  <label>الهاتف</label>
                  <input
                    type="text"
                    id="quickCustPhone"
                    placeholder="الهاتف..."
                    value={quickCustPhone}
                    onChange={(e) => setQuickCustPhone(e.target.value)}
                  />
                </div>
                <div className="field-inline">
                  <label>الحساب</label>
                  <select
                    id="quickCustType"
                    value={quickCustType}
                    onChange={(e) => setQuickCustType(e.target.value)}
                  >
                    <option value="cash">نقدي</option>
                    <option value="onUs">عليه مديونية (لنا)</option>
                    <option value="forUs">له رصيد (علينا)</option>
                  </select>
                </div>
                <div className="field-inline span-2">
                  <label>قيمة الرصيد الافتتاحي</label>
                  <input
                    type="number"
                    id="quickCustVal"
                    value={quickCustVal}
                    step="any"
                    onChange={(e) => setQuickCustVal(e.target.value)}
                  />
                </div>
              </div>
              <button className="btn-action-top" onClick={saveQuickCustomer}>
                حفظ العميل الجديد
              </button>
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>م</th>
                      <th>الاسم</th>
                      <th>الهاتف</th>
                      <th>النوع</th>
                      <th>القيمة</th>
                    </tr>
                  </thead>
                  <tbody id="customersTableBody">
                    {appData.customers.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ color: '#94a3b8', padding: '15px' }}>
                          لا توجد بيانات عملاء...
                        </td>
                      </tr>
                    ) : (
                      appData.customers.map((c, i) => (
                        <tr key={c.id}>
                          <td>{i + 1}</td>
                          <td>{c.name}</td>
                          <td>{c.phone || '-'}</td>
                          <td>{(c.balance || 0) > 0 ? 'عليه مديونية' : (c.balance || 0) < 0 ? 'له رصيد' : 'نقدي'}</td>
                          <td>{Math.abs(c.balance || 0).toFixed(2)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3. الموردين */}
            <div id="tab-suppliers" className={`tab-content ${activeTab === 'suppliers' ? 'active' : ''}`}>
              <div className="invoice-card" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                <div className="field-inline span-2">
                  <label>اسم المورد</label>
                  <input
                    type="text"
                    id="quickSuppName"
                    placeholder="اسم المورد..."
                    value={quickSuppName}
                    onChange={(e) => setQuickSuppName(e.target.value)}
                  />
                </div>
                <div className="field-inline">
                  <label>الهاتف</label>
                  <input
                    type="text"
                    id="quickSuppPhone"
                    placeholder="الهاتف..."
                    value={quickSuppPhone}
                    onChange={(e) => setQuickSuppPhone(e.target.value)}
                  />
                </div>
                <div className="field-inline">
                  <label>الحساب</label>
                  <select
                    id="quickSuppType"
                    value={quickSuppType}
                    onChange={(e) => setQuickSuppType(e.target.value)}
                  >
                    <option value="forUs">له مستحقات (علينا)</option>
                    <option value="onUs">مديونية لدينا (لنا)</option>
                  </select>
                </div>
                <div className="field-inline span-2">
                  <label>قيمة الرصيد الافتتاحي</label>
                  <input
                    type="number"
                    id="quickSuppVal"
                    value={quickSuppVal}
                    step="any"
                    onChange={(e) => setQuickSuppVal(e.target.value)}
                  />
                </div>
              </div>
              <button className="btn-action-top" style={{ background: 'var(--accent)' }} onClick={saveQuickSupplier}>
                حفظ المورد الجديد
              </button>
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>م</th>
                      <th>الاسم</th>
                      <th>الهاتف</th>
                      <th>القيمة</th>
                    </tr>
                  </thead>
                  <tbody id="suppliersTableBody">
                    {appData.suppliers.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ color: '#94a3b8', padding: '15px' }}>
                          لا توجد بيانات موردين...
                        </td>
                      </tr>
                    ) : (
                      appData.suppliers.map((s, i) => (
                        <tr key={s.id}>
                          <td>{i + 1}</td>
                          <td>{s.name}</td>
                          <td>{s.phone || '-'}</td>
                          <td>{Math.abs(s.balance || 0).toFixed(2)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. سندات القبض */}
            <div id="tab-receipts" className={`tab-content ${activeTab === 'receipts' ? 'active' : ''}`}>
              <div className="invoice-card" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                <div className="field-inline span-2">
                  <label>اسم الدافع (العميل)</label>
                  <input
                    type="text"
                    id="recParty"
                    placeholder="اسم العميل..."
                    value={recParty}
                    onChange={(e) => setRecParty(e.target.value)}
                  />
                </div>
                <div className="field-inline">
                  <label>المبلغ (ج.م)</label>
                  <input
                    type="number"
                    id="recAmount"
                    placeholder="0.00"
                    step="any"
                    value={recAmount}
                    onChange={(e) => setRecAmount(e.target.value)}
                  />
                </div>
                <div className="field-inline span-2">
                  <label>البيان</label>
                  <input
                    type="text"
                    id="recNotes"
                    placeholder="سبب التحصيل..."
                    value={recNotes}
                    onChange={(e) => setRecNotes(e.target.value)}
                  />
                </div>
              </div>
              <button className="btn-action-top" style={{ background: 'var(--accent)' }} onClick={saveReceipt}>
                حفظ سند القبض وإيداعه بالخزنة
              </button>
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>م</th>
                      <th>الطرف</th>
                      <th>المبلغ</th>
                      <th>البيان</th>
                    </tr>
                  </thead>
                  <tbody id="receiptsTableBody">
                    {receiptsList.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ color: '#94a3b8', padding: '15px' }}>
                          لا توجد سندات قبض مسجلة...
                        </td>
                      </tr>
                    ) : (
                      receiptsList.map((r, i) => (
                        <tr key={r.id}>
                          <td>{i + 1}</td>
                          <td>{r.customerName || '-'}</td>
                          <td>{Number(r.amount).toFixed(2)}</td>
                          <td>{r.note || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 5. سندات الصرف */}
            <div id="tab-payments" className={`tab-content ${activeTab === 'payments' ? 'active' : ''}`}>
              <div className="invoice-card" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                <div className="field-inline span-2">
                  <label>المستفيد / الجهة</label>
                  <input
                    type="text"
                    id="payParty"
                    placeholder="الجهة المستفيدة..."
                    value={payParty}
                    onChange={(e) => setPayParty(e.target.value)}
                  />
                </div>
                <div className="field-inline">
                  <label>المبلغ (ج.م)</label>
                  <input
                    type="number"
                    id="payAmount"
                    placeholder="0.00"
                    step="any"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                  />
                </div>
                <div className="field-inline span-2">
                  <label>البيان</label>
                  <input
                    type="text"
                    id="payNotes"
                    placeholder="سبب الصرف..."
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                  />
                </div>
              </div>
              <button className="btn-action-top" style={{ background: 'var(--danger)' }} onClick={savePayment}>
                حفظ سند الصرف وخصمه من الخزنة
              </button>
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>م</th>
                      <th>الجهة</th>
                      <th>المبلغ</th>
                      <th>البيان</th>
                    </tr>
                  </thead>
                  <tbody id="paymentsTableBody">
                    {paymentsList.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ color: '#94a3b8', padding: '15px' }}>
                          لا توجد سندات صرف مسجلة...
                        </td>
                      </tr>
                    ) : (
                      paymentsList.map((p, i) => (
                        <tr key={p.id}>
                          <td>{i + 1}</td>
                          <td>{p.customerName || '-'}</td>
                          <td>{Number(p.amount).toFixed(2)}</td>
                          <td>{p.note || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 6. المخزن */}
            <div id="tab-inventory" className={`tab-content ${activeTab === 'inventory' ? 'active' : ''}`}>
              <div className="table-responsive" style={{ height: '100%' }}>
                <table>
                  <thead>
                    <tr>
                      <th>الكود</th>
                      <th>الصنف</th>
                      <th>المجموعة</th>
                      <th>المتاح</th>
                      <th>البيع</th>
                    </tr>
                  </thead>
                  <tbody id="inventoryTableBody">
                    {itemsDatabase.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ color: '#94a3b8', padding: '15px' }}>
                          المخزن فارغ...
                        </td>
                      </tr>
                    ) : (
                      itemsDatabase.map((item) => (
                        <tr key={item.code}>
                          <td>{item.code}</td>
                          <td>{item.name}</td>
                          <td>{item.category || '-'}</td>
                          <td>
                            <b>{item.stock}</b>
                          </td>
                          <td>{item.cashPrice.toFixed(2)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 7. الأرباح والخسائر */}
            <div id="tab-pnl" className={`tab-content ${activeTab === 'pnl' ? 'active' : ''}`}>
              <div className="summary-bar" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', padding: '8px' }}>
                <div className="summary-item" style={{ gridColumn: 'span 2', fontSize: '11px' }}>
                  صافي السيولة / الأرباح:{' '}
                  <span id="pnlNetProfit" style={{ fontSize: '14px', color: '#facc15' }}>
                    {pnlSummary.net.toFixed(2)} ج.م
                  </span>
                </div>
                <div className="summary-item">
                  إجمالي المقبوضات: <span id="pnlTotalIn">{pnlSummary.totalIn.toFixed(2)} ج.م</span>
                </div>
                <div className="summary-item">
                  إجمالي المدفوعات: <span id="pnlTotalOut">{pnlSummary.totalOut.toFixed(2)} ج.م</span>
                </div>
              </div>
            </div>

            {/* 8. النسخ الاحتياطي */}
            <div id="tab-backup" className={`tab-content ${activeTab === 'backup' ? 'active' : ''}`} style={{ justifyContent: 'center', alignItems: 'center' }}>
              <div
                style={{
                  background: '#fff',
                  border: '1px solid var(--border)',
                  padding: '12px',
                  borderRadius: '6px',
                  width: '100%',
                  textAlign: 'center',
                }}
              >
                <h3 style={{ fontSize: '10px', marginBottom: '6px', color: 'var(--primary)' }}>
                  حفظ واستعادة بيانات النظام
                </h3>
                <button
                  className="btn-action-top"
                  style={{ background: 'var(--accent)', marginBottom: '6px' }}
                  onClick={() => {
                    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(appData, null, 2));
                    const dl = document.createElement('a');
                    dl.setAttribute('href', dataStr);
                    dl.setAttribute('download', `rakeeza_backup_${Date.now()}.json`);
                    dl.click();
                  }}
                >
                  <i className="fa-solid fa-download"></i> تصدير النسخة الاحتياطية
                </button>
              </div>
            </div>
          </div>

          <div className="system-footer">
            <span>مؤسسة الأخوة / المخازن والحسابات</span>
            <span>RAKEEZA ERP &copy; 2026</span>
          </div>
        </div>
      </div>

      {/* نافذة الخيارات والمدفوعات */}
      {isOptionsModalOpen && (
        <div className="modal-overlay" id="optionsModal" style={{ display: 'flex' }}>
          <div className="modal-box">
            <div className="modal-header">
              <span>
                <i className="fa-solid fa-sliders"></i> خصومات، ضرائب، إيرادات ودفع
              </span>
              <span style={{ cursor: 'pointer', fontSize: '18px' }} onClick={() => setIsOptionsModalOpen(false)}>
                &times;
              </span>
            </div>
            <div className="modal-body">
              {/* اختيار وتأكيد نوع العملية المحاسبية للفاتورة */}
              <div className="field-inline" style={{ gap: '3px', background: '#f8fafc', padding: '5px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                <label style={{ fontSize: '9px', color: '#1e293b' }}>
                  نوع العملية والفاتورة ({isSale ? 'مبيعات' : 'مشتريات وتوريدات'}):
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '3px' }}>
                  <button
                    type="button"
                    onClick={() => setCurrentInvType('nagdi')}
                    style={{
                      padding: '5px 2px',
                      background: currentInvType === 'nagdi' ? '#16a34a' : '#fff',
                      color: currentInvType === 'nagdi' ? 'white' : '#334155',
                      border: currentInvType === 'nagdi' ? '1px solid #16a34a' : '1px solid #cbd5e1',
                      borderRadius: '3px',
                      fontWeight: 'bold',
                      fontSize: '8.5px',
                      cursor: 'pointer',
                    }}
                  >
                    {isSale ? 'بيع نقدي' : 'شراء نقدي'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentInvType('ajel')}
                    style={{
                      padding: '5px 2px',
                      background: currentInvType === 'ajel' ? '#2563eb' : '#fff',
                      color: currentInvType === 'ajel' ? 'white' : '#334155',
                      border: currentInvType === 'ajel' ? '1px solid #2563eb' : '1px solid #cbd5e1',
                      borderRadius: '3px',
                      fontWeight: 'bold',
                      fontSize: '8.5px',
                      cursor: 'pointer',
                    }}
                  >
                    {isSale ? 'بيع آجل' : 'شراء آجل'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentInvType('return_nagdi')}
                    style={{
                      padding: '5px 2px',
                      background: currentInvType === 'return_nagdi' ? '#d97706' : '#fff',
                      color: currentInvType === 'return_nagdi' ? 'white' : '#334155',
                      border: currentInvType === 'return_nagdi' ? '1px solid #d97706' : '1px solid #cbd5e1',
                      borderRadius: '3px',
                      fontWeight: 'bold',
                      fontSize: '8.5px',
                      cursor: 'pointer',
                    }}
                  >
                    مرتجع نقدي
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentInvType('return_ajel')}
                    style={{
                      padding: '5px 2px',
                      background: currentInvType === 'return_ajel' ? '#dc2626' : '#fff',
                      color: currentInvType === 'return_ajel' ? 'white' : '#334155',
                      border: currentInvType === 'return_ajel' ? '1px solid #dc2626' : '1px solid #cbd5e1',
                      borderRadius: '3px',
                      fontWeight: 'bold',
                      fontSize: '8.5px',
                      cursor: 'pointer',
                    }}
                  >
                    مرتجع آجل
                  </button>
                </div>
              </div>

              <div className="field-inline" style={{ gap: '3px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '9px' }}>خصم الفاتورة الكلية</label>
                  <div className="big-toggle-group">
                    <button
                      type="button"
                      className={`big-toggle-btn ${invDiscType === 'val' ? 'active' : ''}`}
                      id="invDiscTypeVal"
                      onClick={() => setInvDiscType('val')}
                    >
                      ج.م
                    </button>
                    <button
                      type="button"
                      className={`big-toggle-btn ${invDiscType === 'percent' ? 'active' : ''}`}
                      id="invDiscTypePercent"
                      onClick={() => setInvDiscType('percent')}
                    >
                      %
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  id="globalInvDisc"
                  value={globalInvDisc}
                  placeholder="أدخل قيمة أو نسبة الخصم..."
                  onChange={(e) => setGlobalInvDisc(e.target.value)}
                  style={{ height: '26px', fontSize: '10px' }}
                />
              </div>

              <div className="field-inline" style={{ gap: '3px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '9px' }}>ضريبة الفاتورة الكلية</label>
                  <div className="big-toggle-group">
                    <button
                      type="button"
                      className={`big-toggle-btn ${invTaxType === 'percent' ? 'active' : ''}`}
                      id="invTaxTypePercent"
                      onClick={() => setInvTaxType('percent')}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      className={`big-toggle-btn ${invTaxType === 'val' ? 'active' : ''}`}
                      id="invTaxTypeVal"
                      onClick={() => setInvTaxType('val')}
                    >
                      ج.م
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  id="globalInvTax"
                  value={globalInvTax}
                  placeholder="أدخل قيمة أو نسبة الضريبة..."
                  onChange={(e) => setGlobalInvTax(e.target.value)}
                  style={{ height: '26px', fontSize: '10px' }}
                />
              </div>

              <div className="edit-card-grid">
                <div className="field-inline">
                  <label style={{ fontSize: '9px' }}>اسم الإيراد</label>
                  <input
                    type="text"
                    id="extraIncomeName"
                    value={extraIncomeName}
                    onChange={(e) => setExtraIncomeName(e.target.value)}
                    style={{ height: '25px', fontSize: '9.5px' }}
                  />
                </div>
                <div className="field-inline">
                  <label style={{ fontSize: '9px' }}>مبلغ الإيراد</label>
                  <input
                    type="number"
                    id="extraIncomeVal"
                    value={extraIncomeVal}
                    onChange={(e) => setExtraIncomeVal(e.target.value)}
                    style={{ height: '25px', fontSize: '9.5px' }}
                  />
                </div>
              </div>

              <div className="field-inline">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '9px' }}>طرق الدفع المتعددة</label>
                  <button
                    type="button"
                    style={{
                      padding: '2px 6px',
                      fontSize: '8.5px',
                      background: 'var(--accent)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                    }}
                    onClick={() => addPaymentRow('نقدي', 0)}
                  >
                    + إضافة دفع
                  </button>
                </div>
                <div
                  id="paymentRowsContainer"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    maxHeight: '100px',
                    overflowY: 'auto',
                    marginTop: '2px',
                  }}
                >
                  {paymentRows.map((r, rIdx) => (
                    <div key={r.id} className="pay-row" style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <select
                        className="pay-method"
                        value={r.method}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPaymentRows((prev) =>
                            prev.map((row, i) => (i === rIdx ? { ...row, method: val } : row))
                          );
                        }}
                        style={{ height: '24px', width: '90px', fontSize: '9.5px' }}
                      >
                        <option value="نقدي">نقدي</option>
                        <option value="انستاباي">انستاباي</option>
                        <option value="فودافون كاش">فودافون كاش</option>
                        <option value="حساب بنكي">حساب بنكي</option>
                      </select>
                      <input
                        type="number"
                        className="pay-amount"
                        value={r.amount || ''}
                        step="any"
                        placeholder="المبلغ..."
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setPaymentRows((prev) =>
                            prev.map((row, i) => (i === rIdx ? { ...row, amount: val } : row))
                          );
                        }}
                        style={{ height: '24px', flex: 1, fontSize: '9.5px' }}
                      />
                      <i
                        className="fa-solid fa-circle-xmark"
                        style={{ color: 'var(--danger)', cursor: 'pointer' }}
                        onClick={() => removePaymentRow(r.id)}
                      ></i>
                    </div>
                  ))}
                </div>
              </div>

              {/* معاينة الحسابات المباشرة لحظياً */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  padding: '5px 8px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                  textAlign: 'center',
                  gap: '4px',
                  marginTop: '4px',
                }}
              >
                <div>
                  <span style={{ fontSize: '7.5px', color: '#64748b', display: 'block' }}>الإجمالي</span>
                  <strong style={{ fontSize: '9.5px', color: '#0f172a' }}>{calculations.subTotal.toFixed(2)}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '7.5px', color: '#64748b', display: 'block' }}>الخصم</span>
                  <strong style={{ fontSize: '9.5px', color: '#0f172a' }}>{calculations.disc.toFixed(2)}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '7.5px', color: '#64748b', display: 'block' }}>الضريبة</span>
                  <strong style={{ fontSize: '9.5px', color: '#0f172a' }}>{calculations.tax.toFixed(2)}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '7.5px', color: '#64748b', display: 'block' }}>الصافي</span>
                  <strong style={{ fontSize: '9.5px', color: '#0f172a', fontWeight: 'bold' }}>{calculations.net.toFixed(2)}</strong>
                </div>
              </div>

              <button
                type="button"
                className="btn-action-top"
                style={{ background: 'var(--accent)', marginTop: '6px', padding: '7px', fontSize: '10px' }}
                onClick={() => setIsOptionsModalOpen(false)}
              >
                <i className="fa-solid fa-check"></i> تم وحفظ الخيارات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* دليل الأصناف */}
      {isLookupModalOpen && (
        <div className="modal-overlay" id="lookupModal" style={{ display: 'flex' }}>
          <div className="lookup-modal-box">
            <div className="modal-header">
              <span>
                <i className="fa-solid fa-layer-group"></i> دليل الأصناف (اختر صنفاً للإضافة السريعة)
              </span>
              <span style={{ cursor: 'pointer', fontSize: '18px' }} onClick={() => setIsLookupModalOpen(false)}>
                &times;
              </span>
            </div>
            <div className="lookup-layout">
              <div className="categories-panel">
                <div className="categories-header">
                  <span>المجموعات</span>
                  <button
                    type="button"
                    onClick={() => {
                      setNewItemName('');
                      setNewItemCode(`1${itemsDatabase.length + 101}`);
                      setNewItemBuyPrice('');
                      setNewItemCashPrice('');
                      setNewItemWholesalePrice('');
                      setNewItemStock('');
                      setIsEditItemModalOpen(true);
                    }}
                    style={{
                      background: 'var(--accent)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      padding: '3px 5px',
                      fontSize: '8px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      marginTop: '2px',
                    }}
                    title="إضافة صنف جديد"
                  >
                    <i className="fa-solid fa-plus"></i> صنف جديد
                  </button>
                </div>
                <div className="categories-list" id="categoriesListContainer">
                  <div
                    className={`category-item ${selectedCategory === 'all' ? 'active' : ''}`}
                    onClick={() => setSelectedCategory('all')}
                  >
                    الكل
                  </div>
                  {categoriesList.map((cat) => (
                    <div
                      key={cat}
                      className={`category-item ${selectedCategory === cat ? 'active' : ''}`}
                      onClick={() => setSelectedCategory(cat)}
                    >
                      {cat}
                    </div>
                  ))}
                </div>
              </div>
              <div className="items-panel">
                <div className="search-top-bar">
                  <input
                    type="text"
                    id="lookupSearch"
                    placeholder="بحث بالاسم أو الكود..."
                    value={lookupSearch}
                    onChange={(e) => setLookupSearch(e.target.value)}
                    style={{ height: '24px', flex: 1, fontSize: '9.5px' }}
                  />
                </div>
                <div className="lookup-cards-container" id="lookupCardsBody">
                  {itemsDatabase
                    .filter((item) => {
                      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
                      const q = lookupSearch.toLowerCase().trim();
                      return !q || item.name.toLowerCase().includes(q) || item.code.includes(q);
                    })
                    .map((item) => (
                      <div
                        key={item.code}
                        className={`item-card-box ${item.stock <= 0 ? 'low-stock' : ''}`}
                        onClick={() => quickAddItemToInvoiceAndReturn(item)}
                      >
                        <div className="item-card-header">
                          <span>{item.name}</span>
                          <span style={{ color: '#0284c7' }}>{item.code}</span>
                        </div>
                        <div className="item-card-body">
                          <div className="item-card-info">
                            <span>المتاح</span>
                            <strong>{item.stock}</strong>
                          </div>
                          <div className="item-card-info">
                            <span>نقدي</span>
                            <strong style={{ color: '#16a34a' }}>{item.cashPrice.toFixed(2)}</strong>
                          </div>
                          <div className="item-card-info">
                            <span>جملة</span>
                            <strong style={{ color: '#d97706' }}>{item.wholesalePrice.toFixed(2)}</strong>
                          </div>
                          <div className="item-card-info">
                            <span>شراء</span>
                            <strong style={{ color: '#dc2626' }}>{item.buyPrice.toFixed(2)}</strong>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* نافذة إضافة صنف جديد للمخزون */}
      {isEditItemModalOpen && (
        <div className="modal-overlay" id="editItemModal" style={{ display: 'flex' }}>
          <div className="modal-box">
            <div className="modal-header">
              <span>إضافة صنف جديد للمخزون</span>
              <span style={{ cursor: 'pointer', fontSize: '18px' }} onClick={() => setIsEditItemModalOpen(false)}>
                &times;
              </span>
            </div>
            <div className="modal-body">
              <div className="edit-card-grid">
                <div className="field-inline span-2">
                  <label>اسم الصنف الجديد</label>
                  <input
                    type="text"
                    id="newInputItemName"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    style={{ height: '24px', fontSize: '9.5px' }}
                  />
                </div>
                <div className="field-inline span-2">
                  <label>كود الصنف (تلقائي)</label>
                  <input
                    type="text"
                    id="newInputItemCode"
                    value={newItemCode}
                    readOnly
                    style={{ background: '#f1f5f9', fontWeight: 'bold', height: '24px', fontSize: '9.5px' }}
                  />
                </div>
                <div className="field-inline">
                  <label>سعر الشراء الأساسي</label>
                  <input
                    type="number"
                    id="editBuyPrice"
                    value={newItemBuyPrice}
                    min="0"
                    step="any"
                    onChange={(e) => {
                      const bp = e.target.value;
                      setNewItemBuyPrice(bp);
                      const num = parseFloat(bp) || 0;
                      setNewItemCashPrice((num * 1.15).toFixed(2));
                      setNewItemWholesalePrice((num * 1.08).toFixed(2));
                    }}
                    style={{ height: '24px', fontSize: '9.5px' }}
                  />
                </div>
                <div className="field-inline">
                  <label>المجموعة</label>
                  <select
                    id="editItemCategory"
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    style={{ height: '24px', fontSize: '9.5px' }}
                  >
                    {categoriesList.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field-inline">
                  <label>سعر القطاعي (نقدي)</label>
                  <input
                    type="number"
                    id="editCashPriceManual"
                    value={newItemCashPrice}
                    min="0"
                    step="any"
                    onChange={(e) => setNewItemCashPrice(e.target.value)}
                    style={{ height: '24px', fontSize: '9px' }}
                  />
                </div>
                <div className="field-inline">
                  <label>سعر الجملة</label>
                  <input
                    type="number"
                    id="editWholesalePriceManual"
                    value={newItemWholesalePrice}
                    min="0"
                    step="any"
                    onChange={(e) => setNewItemWholesalePrice(e.target.value)}
                    style={{ height: '24px', fontSize: '9px' }}
                  />
                </div>
                <div className="field-inline span-2">
                  <label>الكمية بالمخزون</label>
                  <input
                    type="number"
                    id="editQty"
                    value={newItemStock}
                    min="0"
                    step="any"
                    onChange={(e) => setNewItemStock(e.target.value)}
                    style={{ height: '24px', fontSize: '9.5px' }}
                  />
                </div>
              </div>
              <button
                type="button"
                className="btn-action-top"
                style={{ background: 'var(--accent)', marginTop: '4px', padding: '7px', fontSize: '10px' }}
                onClick={saveNewItemData}
              >
                <i className="fa-solid fa-check"></i> حفظ والرجوع للفاتورة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تعديل بيانات البند داخل الفاتورة */}
      {isModifyModalOpen && (
        <div className="modal-overlay" id="modifyInvoiceItemModal" style={{ display: 'flex' }}>
          <div className="modal-box">
            <div className="modal-header">
              <span>
                <i className="fa-solid fa-pen-to-square"></i> تعديل صنف في الفاتورة
              </span>
              <span style={{ cursor: 'pointer', fontSize: '18px' }} onClick={() => setIsModifyModalOpen(false)}>
                &times;
              </span>
            </div>
            <div className="modal-body">
              <input type="hidden" id="modifyItemIndex" value={modifyIndex} />
              <div className="field-inline">
                <label>اسم الصنف</label>
                <input
                  type="text"
                  id="modifyItemName"
                  value={modifyName}
                  readOnly
                  style={{ background: '#f1f5f9', height: '24px', fontSize: '9.5px' }}
                />
              </div>
              <div className="edit-card-grid">
                <div className="field-inline">
                  <label>الكمية</label>
                  <input
                    type="number"
                    id="modifyItemQty"
                    min="0.01"
                    step="any"
                    value={modifyQty}
                    onChange={(e) => setModifyQty(e.target.value)}
                    style={{ height: '24px', fontSize: '9.5px' }}
                  />
                </div>
                <div className="field-inline">
                  <label>{isSale ? 'سعر البيع' : 'سعر الشراء'}</label>
                  <input
                    type="number"
                    id="modifyItemPrice"
                    min="0"
                    step="any"
                    value={modifyPrice}
                    onChange={(e) => setModifyPrice(e.target.value)}
                    style={{ height: '24px', fontSize: '9.5px' }}
                  />
                </div>
              </div>
              <div className="field-inline span-2">
                <label>الوصف / البيان</label>
                <input
                  type="text"
                  id="modifyItemSpec"
                  placeholder="اختياري..."
                  value={modifySpec}
                  onChange={(e) => setModifySpec(e.target.value)}
                  style={{ height: '24px', fontSize: '9.5px' }}
                />
              </div>
              <button
                type="button"
                className="btn-action-top"
                style={{ background: 'var(--accent)', marginTop: '6px', padding: '7px', fontSize: '10px' }}
                onClick={saveModifiedInvoiceItem}
              >
                <i className="fa-solid fa-check"></i> حفظ التعديل
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
