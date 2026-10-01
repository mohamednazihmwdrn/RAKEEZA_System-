import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Boxes,
  SlidersHorizontal,
  Plus,
  Minus,
  Trash2,
  Edit,
  Printer,
  Save,
  X,
  Check,
  Search,
  Calendar,
  Clock,
  Building2,
  DollarSign,
  AlertTriangle,
  FolderTree,
} from 'lucide-react';
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
  discVal: number;
  discType: 'val' | 'percent';
  taxVal: number;
  taxType: 'val' | 'percent';
  total: number;
  itemId?: string;
  costPrice?: number;
}

export interface SplitPaymentRow {
  id: string;
  method: string;
  amount: number;
}

export const PAYMENT_METHODS = [
  'نقدي / كاش (الدرج)',
  'انستاباي Instapay',
  'فودافون كاش Vodafone Cash',
  'فيزا / كارت Visa',
  'حساب بنكي',
];

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
  const isReturn = invoiceType.startsWith('return_');
  const isEditing = !!editingInvoice;

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
  const [partyName, setPartyName] = useState<string>(
    isSale ? (editingInvoice as SaleInvoice)?.customerName || '' : (editingInvoice as PurchaseInvoice)?.supplierName || ''
  );
  const [partyPhone, setPartyPhone] = useState<string>(editingInvoice?.phone || '');
  const [partyCode, setPartyCode] = useState<string>('1');
  const [statement, setStatement] = useState<string>(editingInvoice?.notes || '');

  const [showPartyDropdown, setShowPartyDropdown] = useState(false);
  const [showPhoneDropdown, setShowPhoneDropdown] = useState(false);

  // Pricing Mode: 'cash' | 'wholesale' | 'buy'
  const [pricingType, setPricingType] = useState<'cash' | 'wholesale' | 'buy'>(
    isSale
      ? (editingInvoice as any)?.salesType === 'wholesale'
        ? 'wholesale'
        : 'cash'
      : 'buy'
  );

  // Items State
  const [items, setItems] = useState<WorkspaceItemRow[]>(() => {
    if (editingInvoice?.items && editingInvoice.items.length > 0) {
      return editingInvoice.items.map((itm) => ({
        code: itm.code || `ITM-${itm.itemId || '001'}`,
        name: itm.name,
        spec: itm.spec || itm.notes || '',
        qty: itm.qty || 1,
        price: itm.price || 0,
        discVal: itm.discVal ?? itm.discountValue ?? (itm.discount || 0),
        discType: (itm.discType as any) === 'percent' || itm.discountType === 'percent' ? 'percent' : 'val',
        taxVal: itm.taxVal ?? itm.taxValue ?? (itm.tax || 0),
        taxType: (itm.taxType as any) === 'percent' || itm.taxType === 'percent' ? 'percent' : 'val',
        total: itm.total || 0,
        itemId: itm.itemId,
        costPrice: itm.costPrice,
      }));
    }
    return [];
  });

  // Global Discount & Tax & Extra Revenue
  const [globalInvDisc, setGlobalInvDisc] = useState<number>(editingInvoice?.discountValue || 0);
  const [invDiscType, setInvDiscType] = useState<'val' | 'percent'>(
    editingInvoice?.discountType === 'percent' ? 'percent' : 'val'
  );
  const [globalInvTax, setGlobalInvTax] = useState<number>(editingInvoice?.taxValue || 0);
  const [invTaxType, setInvTaxType] = useState<'percent' | 'val'>(
    editingInvoice?.taxType === 'percent' ? 'percent' : 'val'
  );
  const [extraRevenueName, setExtraRevenueName] = useState<string>(
    editingInvoice?.extraRevenueName || ''
  );
  const [extraRevenueVal, setExtraRevenueVal] = useState<number>(
    editingInvoice?.extraRevenueAmount || 0
  );

  // Payments
  const [paymentRows, setPaymentRows] = useState<SplitPaymentRow[]>(() => {
    if (editingInvoice?.paymentSplits && editingInvoice.paymentSplits.length > 0) {
      return editingInvoice.paymentSplits.map((s, idx) => ({
        id: `split_${idx}`,
        method: s.method || 'نقدي / كاش (الدرج)',
        amount: s.amount || 0,
      }));
    }
    const defaultPaid = editingInvoice?.paidAmount ?? (invoiceType === 'nagdi' ? editingInvoice?.total || 0 : 0);
    return [
      {
        id: 'pay_init',
        method: 'نقدي / كاش (الدرج)',
        amount: defaultPaid,
      },
    ];
  });

  // Popups
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isItemEditModalOpen, setIsItemEditModalOpen] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number>(-1);

  // Item Edit State
  const [editItemObj, setEditItemObj] = useState<{
    code: string;
    name: string;
    category?: string;
    stock: number;
    cashPrice: number;
    wholesalePrice: number;
    buyPrice: number;
    id?: string;
  } | null>(null);

  const [editQty, setEditQty] = useState('1');
  const [editPrice, setEditPrice] = useState('0');
  const [editDiscVal, setEditDiscVal] = useState('0');
  const [editDiscType, setEditDiscType] = useState<'val' | 'percent'>('val');
  const [editTaxVal, setEditTaxVal] = useState('0');
  const [editTaxType, setEditTaxType] = useState<'val' | 'percent'>('percent');
  const [editSpec, setEditSpec] = useState('');
  const [itemPriceTier, setItemPriceTier] = useState<'cash' | 'wholesale' | 'buy' | 'custom'>('cash');

  // Fast Catalog Search State
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategory, setCatalogCategory] = useState('all');

  // Matched Customer / Supplier
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

  // Update party code
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

  // Customer or Supplier Balance Calculation
  const partyFinancials = useMemo(() => {
    if (isSale) {
      if (!matchedCustomer) return { balance: 0, statusLabel: 'نقدي (عميل جديد)' };
      const summary = calculateCustomerBalance(matchedCustomer, appData);
      return {
        balance: summary.balance,
        statusLabel:
          summary.balance > 0
            ? `مدين (مستحق عليه ${summary.balance.toFixed(2)} ج.م)`
            : summary.balance < 0
            ? `دائن (له رصيد ${Math.abs(summary.balance).toFixed(2)} ج.م)`
            : 'متزن (خالص 0.00)',
      };
    } else {
      if (!matchedSupplier) return { balance: 0, statusLabel: 'نقدي (مورد جديد)' };
      const summary = calculateSupplierBalance(matchedSupplier, appData);
      return {
        balance: summary.balance,
        statusLabel:
          summary.balance > 0
            ? `دائن (له مستحق ${summary.balance.toFixed(2)} ج.م)`
            : summary.balance < 0
            ? `مدين (عليه رصيد ${Math.abs(summary.balance).toFixed(2)} ج.م)`
            : 'متزن (خالص 0.00)',
      };
    }
  }, [isSale, matchedCustomer, matchedSupplier, appData]);

  // Filtered Party Lists for search
  const filteredParties = useMemo(() => {
    const list = isSale ? appData.customers : appData.suppliers;
    if (!partyName.trim()) return list.slice(0, 10);
    const q = partyName.trim().toLowerCase();
    return list.filter(
      (p) =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.phone || '').includes(q)
    );
  }, [isSale, partyName, appData.customers, appData.suppliers]);

  const filteredPartiesByPhone = useMemo(() => {
    const list = isSale ? appData.customers : appData.suppliers;
    if (!partyPhone.trim()) return list.slice(0, 10);
    return list.filter((p) => (p.phone || '').includes(partyPhone.trim()));
  }, [isSale, partyPhone, appData.customers, appData.suppliers]);

  // Catalog items
  const catalogList = useMemo(() => {
    return appData.items.map((i) => ({
      id: i.id,
      code: i.code || i.barcode || `ITM-${i.id.substring(0, 5)}`,
      name: i.name,
      category: i.category || 'عام',
      stock: Number(i.quantity ?? 0),
      cashPrice: Number(i.salePrice || i.normalSellingPrice || i.price || 0),
      wholesalePrice: Number(i.wholesalePrice || i.wholesaleSellingPrice || i.salePrice || 0),
      buyPrice: Number(i.purchasePrice || i.costPrice || 0),
    }));
  }, [appData.items]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    catalogList.forEach((c) => {
      if (c.category) set.add(c.category.trim());
    });
    return Array.from(set);
  }, [catalogList]);

  const filteredCatalogItems = useMemo(() => {
    const q = catalogSearch.toLowerCase().trim();
    return catalogList.filter((item) => {
      if (catalogCategory !== 'all' && item.category !== catalogCategory) {
        return false;
      }
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q)
      );
    });
  }, [catalogList, catalogCategory, catalogSearch]);

  // Calculations
  const calculations = useMemo(() => {
    let totalQty = 0;
    let itemsSubtotal = 0;
    let totalItemDiscounts = 0;
    let totalItemTaxes = 0;

    items.forEach((itm) => {
      totalQty += itm.qty;
      const base = itm.price * itm.qty;
      itemsSubtotal += base;

      const lineDisc =
        itm.discType === 'percent'
          ? base * (itm.discVal / 100)
          : itm.discVal * itm.qty;
      totalItemDiscounts += lineDisc;

      const afterDisc = base - lineDisc;
      const lineTax =
        itm.taxType === 'percent'
          ? afterDisc * (itm.taxVal / 100)
          : itm.taxVal * itm.qty;
      totalItemTaxes += lineTax;
    });

    const netItems = itemsSubtotal - totalItemDiscounts + totalItemTaxes;

    const globalDisc =
      invDiscType === 'percent'
        ? netItems * (globalInvDisc / 100)
        : globalInvDisc;
    const totalDiscount = totalItemDiscounts + globalDisc;

    const baseForGlobalTax = Math.max(0, netItems - globalDisc);
    const globalTax =
      invTaxType === 'percent'
        ? baseForGlobalTax * (globalInvTax / 100)
        : globalInvTax;
    const totalTax = totalItemTaxes + globalTax;

    const netFinal = Math.max(
      0,
      itemsSubtotal - totalDiscount + totalTax + (extraRevenueVal || 0)
    );

    const paidTotal = paymentRows.reduce(
      (sum, r) => sum + (Number(r.amount) || 0),
      0
    );
    const remaining = Math.max(0, netFinal - paidTotal);

    return {
      totalQty,
      subtotal: itemsSubtotal,
      totalDiscount,
      totalTax,
      extraRevenueVal,
      netFinal,
      paidTotal,
      remaining,
    };
  }, [
    items,
    globalInvDisc,
    invDiscType,
    globalInvTax,
    invTaxType,
    extraRevenueVal,
    paymentRows,
  ]);

  // Automatically sync paid total if single payment row and cash type
  useEffect(() => {
    if (invoiceType === 'nagdi' && paymentRows.length === 1 && items.length > 0) {
      if (paymentRows[0].amount === 0 || paymentRows[0].amount !== calculations.netFinal) {
        setPaymentRows([
          {
            id: paymentRows[0].id,
            method: paymentRows[0].method,
            amount: calculations.netFinal,
          },
        ]);
      }
    }
  }, [calculations.netFinal, invoiceType, items.length]);

  // Open Item Edit Modal
  const openItemEdit = (
    itemData: {
      code: string;
      name: string;
      category?: string;
      stock: number;
      cashPrice: number;
      wholesalePrice: number;
      buyPrice: number;
      id?: string;
    },
    index = -1
  ) => {
    setEditingItemIndex(index);
    setEditItemObj(itemData);

    if (index > -1 && items[index]) {
      const cur = items[index];
      setEditQty(String(cur.qty));
      setEditPrice(String(cur.price));
      setEditDiscVal(String(cur.discVal));
      setEditDiscType(cur.discType);
      setEditTaxVal(String(cur.taxVal));
      setEditTaxType(cur.taxType);
      setEditSpec(cur.spec);
      if (Math.abs(cur.price - itemData.cashPrice) < 0.01) setItemPriceTier('cash');
      else if (Math.abs(cur.price - itemData.wholesalePrice) < 0.01) setItemPriceTier('wholesale');
      else if (Math.abs(cur.price - itemData.buyPrice) < 0.01) setItemPriceTier('buy');
      else setItemPriceTier('custom');
    } else {
      let defaultP = itemData.cashPrice;
      let initialTier: 'cash' | 'wholesale' | 'buy' | 'custom' = 'cash';
      if (!isSale || pricingType === 'buy') {
        defaultP = itemData.buyPrice;
        initialTier = 'buy';
      } else if (pricingType === 'wholesale') {
        defaultP = itemData.wholesalePrice;
        initialTier = 'wholesale';
      }
      setItemPriceTier(initialTier);
      setEditPrice(String(defaultP));
      setEditQty('1');
      setEditDiscVal('0');
      setEditDiscType('val');
      setEditTaxVal('0');
      setEditTaxType('percent');
      setEditSpec('');
    }
    setIsCatalogOpen(false);
    setIsItemEditModalOpen(true);
  };

  // Push Item from Modal to Table
  const handleConfirmItem = () => {
    if (!editItemObj) return;
    const qty = parseFloat(editQty) || 1;
    const price = parseFloat(editPrice) || 0;
    const dVal = parseFloat(editDiscVal) || 0;
    const tVal = parseFloat(editTaxVal) || 0;

    const base = price * qty;
    const lineDisc = editDiscType === 'percent' ? base * (dVal / 100) : dVal * qty;
    const afterDisc = base - lineDisc;
    const lineTax = editTaxType === 'percent' ? afterDisc * (tVal / 100) : tVal * qty;
    const total = afterDisc + lineTax;

    const rowObj: WorkspaceItemRow = {
      code: editItemObj.code,
      name: editItemObj.name,
      spec: editSpec.trim(),
      qty,
      price,
      discVal: dVal,
      discType: editDiscType,
      taxVal: tVal,
      taxType: editTaxType,
      total,
      itemId: editItemObj.id,
      costPrice: editItemObj.buyPrice,
    };

    const updated = [...items];
    if (editingItemIndex > -1) {
      updated[editingItemIndex] = rowObj;
    } else {
      updated.push(rowObj);
    }
    setItems(updated);
    setIsItemEditModalOpen(false);
    setEditItemObj(null);
  };

  const handleRemoveItem = (index: number) => {
    const updated = [...items];
    updated.splice(index, 1);
    setItems(updated);
  };

  // Save & Post Invoice
  const handleSaveInvoice = () => {
    if (items.length === 0) {
      showToast('يرجى إضافة صنف واحد على الأقل في الفاتورة', 'warning');
      return;
    }
    if (!partyName.trim()) {
      showToast(`يرجى إدخال اسم ${isSale ? 'العميل' : 'المورد'}`, 'warning');
      return;
    }

    const { subtotal, totalDiscount, totalTax, netFinal, paidTotal, remaining, extraRevenueVal } = calculations;

    const finalInvoiceItems: InvoiceItem[] = items.map((u) => ({
      itemId: u.itemId,
      code: u.code,
      name: u.name,
      qty: u.qty,
      price: u.price,
      costPrice: u.costPrice,
      total: u.total,
      spec: u.spec,
      notes: u.spec,
      discVal: u.discVal,
      discType: u.discType,
      taxVal: u.taxVal,
      taxType: u.taxType,
      discount: u.discVal,
      discountType: u.discType === 'percent' ? 'percent' : 'fixed',
      discountValue: u.discVal,
      tax: u.taxVal,
      taxValue: u.taxVal,
    }));

    const firstMethod = paymentRows[0]?.method || 'نقدي / كاش';
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
        notes: statement.trim() || undefined,
        date,
        time,
        items: finalInvoiceItems,
        subtotal,
        discount: totalDiscount,
        discountType: invDiscType === 'percent' ? 'percent' : 'fixed',
        discountValue: globalInvDisc,
        tax: totalTax,
        taxType: invTaxType === 'percent' ? 'percent' : 'fixed',
        taxValue: globalInvTax,
        extraRevenueAmount: extraRevenueVal > 0 ? extraRevenueVal : undefined,
        fees: 0,
        total: netFinal,
        paymentMethod: paymentRows.length > 1 ? 'split' : primaryKey,
        paymentSplits: paymentRows.map((r) => ({ method: r.method, amount: r.amount })),
        type: invoiceType,
        salesType: pricingType === 'wholesale' ? 'wholesale' : 'cash',
        paidAmount: paidTotal,
        remainingAmount: remaining,
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
        details: `${isReturn ? 'مرتجع' : 'فاتورة'} مبيعات #${invNumber} بقيمة ${netFinal.toFixed(2)} ج.م للعميل "${partyName}"`,
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
        notes: statement.trim() || undefined,
        date,
        time,
        items: finalInvoiceItems,
        subtotal,
        discount: totalDiscount,
        discountType: invDiscType === 'percent' ? 'percent' : 'fixed',
        discountValue: globalInvDisc,
        tax: totalTax,
        taxType: invTaxType === 'percent' ? 'percent' : 'fixed',
        taxValue: globalInvTax,
        extraRevenueAmount: extraRevenueVal > 0 ? extraRevenueVal : undefined,
        fees: 0,
        total: netFinal,
        paymentMethod: primaryKey,
        paymentSplits: paymentRows.map((r) => ({
          method: r.method.includes('فودافون') ? 'vodafone' : r.method.includes('انستاباي') ? 'instapay' : r.method.includes('بنك') ? 'bank' : 'drawer',
          amount: r.amount,
        })),
        type: invoiceType,
        paidAmount: paidTotal,
        remainingAmount: remaining,
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
        details: `${isReturn ? 'مرتجع' : 'فاتورة'} مشتريات #${invNumber} بقيمة ${netFinal.toFixed(2)} ج.م للمورد "${partyName}"`,
      });
      showToast(`تم حفظ ${isReturn ? 'مرتجع' : 'فاتورة'} مشتريات #${invNumber} بنجاح وترحيل الحسابات فورا`, 'success');
      onClose();
    }
  };

  const handlePrint = () => {
    const dummyInv: any = {
      id: invNumber,
      customerName: partyName,
      supplierName: partyName,
      phone: partyPhone,
      date,
      time,
      notes: statement,
      items: items.map((i) => ({ ...i, notes: i.spec })),
      subtotal: calculations.subtotal,
      discount: calculations.totalDiscount,
      tax: calculations.totalTax,
      total: calculations.netFinal,
      paidAmount: calculations.paidTotal,
      remainingAmount: calculations.remaining,
      type: invoiceType,
    };
    printInvoiceWindow(dummyInv, isSale, appData.settings);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-0 sm:p-3 backdrop-blur-xs font-sans"
      dir="rtl"
    >
      <div className="bg-white w-full max-w-5xl rounded-none sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-300 min-h-screen sm:min-h-0 sm:max-h-[96vh]">
        {/* ============================================================== */}
        {/* 1. TOP TITLE BAR (نظام الفواتير والمخزون - ركيزة) */}
        {/* ============================================================== */}
        <div className="bg-[#1e293b] text-white px-4 py-2.5 flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs sm:text-sm text-slate-300">
              {time}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm sm:text-base font-black tracking-wide">
              نظام الفواتير والمخزون - ركيزة
            </span>
            <Building2 className="w-5 h-5 text-amber-400" />
            <button
              onClick={onClose}
              className="mr-3 text-slate-300 hover:text-white p-1 hover:bg-slate-700/60 rounded-lg transition"
              title="إغلاق الفاتورة"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Main Body */}
        <div className="p-3 sm:p-4 overflow-y-auto space-y-2.5 flex-1 text-xs sm:text-sm">
          {/* ============================================================== */}
          {/* 2. INVOICE META ROW (رقم الفاتورة | التاريخ | الوقت) */}
          {/* ============================================================== */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* رقم الفاتورة */}
            <div className="bg-slate-50 border border-slate-300 rounded-lg p-2 flex items-center justify-between">
              <span className="text-slate-600 font-bold text-xs">رقم الفاتورة</span>
              <span className="font-mono font-black text-sm sm:text-base text-slate-900">
                {invNumber}
              </span>
            </div>

            {/* التاريخ */}
            <div className="bg-slate-50 border border-slate-300 rounded-lg p-2 flex items-center justify-between">
              <span className="text-slate-600 font-bold text-xs">التاريخ</span>
              <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-transparent font-bold text-xs sm:text-sm text-slate-900 focus:outline-none cursor-pointer text-left"
                />
                <Calendar className="w-4 h-4 text-slate-500" />
              </div>
            </div>

            {/* الوقت */}
            <div className="bg-slate-50 border border-slate-300 rounded-lg p-2 flex items-center justify-between">
              <span className="text-slate-600 font-bold text-xs">الوقت</span>
              <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900">
                <span className="text-xs sm:text-sm">{time}</span>
                <Clock className="w-4 h-4 text-slate-500" />
              </div>
            </div>
          </div>

          {/* ============================================================== */}
          {/* 3. PARTY INFO ROW (كود العميل | اسم العميل (بحث) | رقم الهاتف) */}
          {/* ============================================================== */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            {/* كود العميل / المورد */}
            <div className="sm:col-span-2 bg-slate-50 border border-slate-300 rounded-lg p-2 flex items-center justify-between">
              <span className="text-slate-600 font-bold text-xs">
                {isSale ? 'كود العميل' : 'كود المورد'}
              </span>
              <span className="font-mono font-black text-xs sm:text-sm text-blue-900">
                {partyCode}
              </span>
            </div>

            {/* اسم العميل / المورد */}
            <div className="sm:col-span-6 relative">
              <div className="border border-slate-300 rounded-lg p-1.5 bg-white flex flex-col justify-center">
                <label className="text-[10px] text-slate-500 font-bold block mb-0.5">
                  {isSale ? 'اسم العميل (بحث)' : 'اسم المورد (بحث)'}
                </label>
                <input
                  type="text"
                  placeholder="اكتب للبحث..."
                  value={partyName}
                  onFocus={() => setShowPartyDropdown(true)}
                  onBlur={() => setTimeout(() => setShowPartyDropdown(false), 200)}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPartyName(val);
                    setShowPartyDropdown(true);
                    const matched = (isSale ? appData.customers : appData.suppliers).find(
                      (p) => p.name.toLowerCase() === val.toLowerCase()
                    );
                    if (matched) {
                      setPartyName(matched.name);
                      setPartyPhone(matched.phone || '');
                      if (isSale && (matched as Customer).priceTier === 'wholesale') {
                        setPricingType('wholesale');
                      }
                    }
                  }}
                  className="w-full text-xs sm:text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent"
                />
              </div>

              {/* Suggestions Dropdown */}
              {showPartyDropdown && (
                <div className="absolute top-full right-0 left-0 z-50 bg-white border border-slate-300 rounded-lg shadow-xl max-h-48 overflow-y-auto mt-1 divide-y divide-slate-100">
                  {filteredParties.length === 0 ? (
                    <div className="p-2.5 text-xs text-slate-600 text-center">
                      طرف جديد: <strong>"{partyName}"</strong> (سيتم تسجيله عند الحفظ)
                    </div>
                  ) : (
                    filteredParties.map((p) => (
                      <div
                        key={p.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setPartyName(p.name);
                          setPartyPhone(p.phone || '');
                          if (isSale && (p as Customer).priceTier === 'wholesale') {
                            setPricingType('wholesale');
                          }
                          setShowPartyDropdown(false);
                        }}
                        className="p-2 hover:bg-slate-100 cursor-pointer flex justify-between items-center text-xs"
                      >
                        <span className="font-bold text-slate-900">👤 {p.name}</span>
                        <span className="text-slate-500 font-mono text-[11px]">
                          {p.phone || 'بدون هاتف'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* رقم الهاتف */}
            <div className="sm:col-span-4 relative">
              <div className="border border-slate-300 rounded-lg p-1.5 bg-white flex flex-col justify-center">
                <label className="text-[10px] text-slate-500 font-bold block mb-0.5">
                  رقم الهاتف (بحث)
                </label>
                <input
                  type="text"
                  placeholder="ابحث برقم الهاتف..."
                  value={partyPhone}
                  onFocus={() => setShowPhoneDropdown(true)}
                  onBlur={() => setTimeout(() => setShowPhoneDropdown(false), 200)}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPartyPhone(val);
                    setShowPhoneDropdown(true);
                    const matched = (isSale ? appData.customers : appData.suppliers).find(
                      (p) => p.phone === val
                    );
                    if (matched) {
                      setPartyName(matched.name);
                      setPartyPhone(matched.phone || val);
                    }
                  }}
                  className="w-full text-xs sm:text-sm font-bold font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent"
                />
              </div>

              {showPhoneDropdown && (
                <div className="absolute top-full right-0 left-0 z-50 bg-white border border-slate-300 rounded-lg shadow-xl max-h-48 overflow-y-auto mt-1 divide-y divide-slate-100">
                  {filteredPartiesByPhone.map((p) => (
                    <div
                      key={p.id}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setPartyName(p.name);
                        setPartyPhone(p.phone || '');
                        setShowPhoneDropdown(false);
                      }}
                      className="p-2 hover:bg-slate-100 cursor-pointer flex justify-between items-center text-xs"
                    >
                      <span className="font-mono text-blue-900 font-bold">📞 {p.phone}</span>
                      <span className="text-slate-700 font-bold">{p.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ============================================================== */}
          {/* 4. STATEMENT / WORK ENTITY (البيان / جهة العمل) */}
          {/* ============================================================== */}
          <div className="border border-slate-300 rounded-lg p-1.5 bg-white flex flex-col justify-center">
            <label className="text-[10px] text-slate-500 font-bold block mb-0.5">
              البيان / جهة العمل
            </label>
            <input
              type="text"
              placeholder="اكتب البيان أو ملاحظات الفاتورة هنا..."
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              className="w-full text-xs sm:text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent"
            />
          </div>

          {/* ============================================================== */}
          {/* 5. FINANCIAL STATUS BAR (حالة الحساب | المبلغ له / عليه) */}
          {/* ============================================================== */}
          <div className="bg-[#fffde7] border border-[#fff59d] rounded-lg px-3 py-1.5 flex items-center justify-between font-bold text-xs sm:text-sm text-slate-800">
            <div>
              <span className="text-blue-900 ml-1">حالة الحساب:</span>
              <span className="text-slate-900 font-black">
                {invoiceType === 'nagdi'
                  ? 'نقدي'
                  : invoiceType === 'ajel'
                  ? 'آجل'
                  : invoiceType === 'return_nagdi'
                  ? 'مرتجع نقدي'
                  : 'مرتجع آجل'}
              </span>
            </div>
            <div>
              <span className="ml-1 text-slate-700">المبلغ (له / عليه):</span>
              <span
                className={`font-mono font-black ${
                  partyFinancials.balance > 0
                    ? 'text-rose-700'
                    : partyFinancials.balance < 0
                    ? 'text-emerald-700'
                    : 'text-amber-800'
                }`}
              >
                {partyFinancials.balance.toFixed(2)} ج.م
              </span>
            </div>
          </div>

          {/* ============================================================== */}
          {/* 6. PRICING MODE SYSTEM (نظام تسعير الفاتورة: سعر نقدي | سعر جملة | سعر شراء) */}
          {/* ============================================================== */}
          <div className="border border-slate-300 rounded-lg px-3 py-1.5 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
            <span className="text-slate-700 font-bold text-xs sm:text-sm">
              نظام تسعير الفاتورة:
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPricingType('cash')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
                  pricingType === 'cash'
                    ? 'bg-[#2e7d32] text-white shadow-xs'
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                سعر نقدي
              </button>
              <button
                type="button"
                onClick={() => setPricingType('wholesale')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
                  pricingType === 'wholesale'
                    ? 'bg-[#2e7d32] text-white shadow-xs'
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                سعر جملة
              </button>
              <button
                type="button"
                onClick={() => setPricingType('buy')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
                  pricingType === 'buy'
                    ? 'bg-[#2e7d32] text-white shadow-xs'
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                سعر شراء
              </button>
            </div>
          </div>

          {/* ============================================================== */}
          {/* 7. TWO MAIN ACTION BUTTONS (دليل الأصناف | الخصم والضريبة والدفع) */}
          {/* ============================================================== */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* دليل الأصناف (إضافة سريعة) */}
            <button
              type="button"
              onClick={() => setIsCatalogOpen(true)}
              className="min-h-[44px] bg-[#1976d2] hover:bg-[#1565c0] active:scale-[0.99] text-white rounded-lg font-bold text-xs sm:text-sm shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Boxes className="w-4 h-4" />
              <span>دليل الأصناف (إضافة سريعة)</span>
            </button>

            {/* الخصم، الضريبة والدفع */}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="min-h-[44px] bg-[#1a237e] hover:bg-[#0d47a1] active:scale-[0.99] text-white rounded-lg font-bold text-xs sm:text-sm shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>الخصم، الضريبة والدفع</span>
            </button>
          </div>

          {/* ============================================================== */}
          {/* 8. ITEMS TABLE */}
          {/* ============================================================== */}
          <div className="border border-slate-300 rounded-lg overflow-x-auto min-h-[160px] bg-white">
            <table className="w-full text-center border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                  <th className="py-2 px-2 border-l border-slate-300 w-10">م</th>
                  <th className="py-2 px-3 border-l border-slate-300 text-right">الصنف</th>
                  <th className="py-2 px-3 border-l border-slate-300 text-right">الوصف</th>
                  <th className="py-2 px-2 border-l border-slate-300 w-16">الكمية</th>
                  <th className="py-2 px-2 border-l border-slate-300 w-24">السعر</th>
                  <th className="py-2 px-2 border-l border-slate-300 w-24">الإجمالي</th>
                  <th className="py-2 px-2 w-20">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-12 px-4 text-center text-slate-400 font-bold text-xs sm:text-sm"
                    >
                      لم يتم إدراج أصناف بعد (اضغط من دليل الأصناف للبيع السريع)
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => {
                    const catalogMatch = catalogList.find((c) => c.code === item.code) || {
                      code: item.code,
                      name: item.name,
                      stock: 0,
                      cashPrice: item.price,
                      wholesalePrice: item.price,
                      buyPrice: item.price,
                    };

                    return (
                      <tr
                        key={index}
                        className="border-b border-slate-200 hover:bg-slate-50 transition"
                      >
                        <td className="py-2 px-2 border-l border-slate-300 font-mono text-slate-700">
                          {index + 1}
                        </td>
                        <td className="py-2 px-3 border-l border-slate-300 text-right font-bold text-slate-900">
                          <div>{item.name}</div>
                          <span className="font-mono text-[10px] text-slate-400">
                            {item.code}
                          </span>
                        </td>
                        <td className="py-2 px-3 border-l border-slate-300 text-right text-slate-600 truncate max-w-[150px]">
                          {item.spec || '-'}
                        </td>
                        <td className="py-2 px-2 border-l border-slate-300 font-mono font-bold text-slate-900">
                          {item.qty}
                        </td>
                        <td className="py-2 px-2 border-l border-slate-300 font-mono font-bold text-slate-900">
                          {item.price.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 border-l border-slate-300 font-mono font-black text-slate-900">
                          {item.total.toFixed(2)}
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => openItemEdit(catalogMatch, index)}
                              className="p-1 text-blue-700 hover:bg-blue-50 rounded"
                              title="تعديل الصنف"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(index)}
                              className="p-1 text-rose-700 hover:bg-rose-50 rounded"
                              title="حذف الصنف"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ============================================================== */}
          {/* 9. SUMMARY & TOTALS CONTAINER (مربع الإجماليات + الصافي النهائي) */}
          {/* ============================================================== */}
          <div className="rounded-lg overflow-hidden shadow-xs border border-slate-300">
            {/* Dark Navy Block (إجمالي الكميات | الخصومات | الضرائب | الإيراد | المدفوع | المتبقي) */}
            <div className="bg-[#1a237e] text-white p-3 space-y-2">
              <div className="grid grid-cols-3 text-center text-xs font-bold divide-x divide-x-reverse divide-blue-800">
                <div>
                  <div className="text-slate-300 text-[11px] mb-0.5">إجمالي الكميات:</div>
                  <div className="font-mono text-sm sm:text-base font-black">
                    {calculations.totalQty.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-300 text-[11px] mb-0.5">الخصومات:</div>
                  <div className="font-mono text-sm sm:text-base font-black text-amber-300">
                    {calculations.totalDiscount.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-300 text-[11px] mb-0.5">الضرائب:</div>
                  <div className="font-mono text-sm sm:text-base font-black">
                    {calculations.totalTax.toFixed(2)}
                  </div>
                </div>
              </div>

              <hr className="border-blue-900/60" />

              <div className="grid grid-cols-3 text-center text-xs font-bold divide-x divide-x-reverse divide-blue-800">
                <div>
                  <div className="text-slate-300 text-[11px] mb-0.5">
                    {isSale ? 'الإيراد:' : 'المصروف:'}
                  </div>
                  <div className="font-mono text-sm sm:text-base font-black">
                    {calculations.extraRevenueVal.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-300 text-[11px] mb-0.5">المدفوع:</div>
                  <div className="font-mono text-sm sm:text-base font-black text-emerald-300">
                    {calculations.paidTotal.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-300 text-[11px] mb-0.5">المتبقي:</div>
                  <div className="font-mono text-sm sm:text-base font-black text-rose-300">
                    {calculations.remaining.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Bright Green Block (الصافي النهائي) */}
            <div className="bg-[#2e7d32] text-white p-2.5 text-center flex flex-col items-center justify-center">
              <span className="text-xs font-bold text-emerald-100">الصافي النهائي:</span>
              <span className="font-mono text-xl sm:text-2xl font-black tracking-wide">
                {calculations.netFinal.toFixed(2)}
              </span>
            </div>
          </div>

          {/* ============================================================== */}
          {/* 10. BOTTOM ACTION BUTTONS (حفظ وترحيل الحسابات | طباعة) */}
          {/* ============================================================== */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {/* حفظ وترحيل الحسابات */}
            <button
              type="button"
              onClick={handleSaveInvoice}
              className="min-h-[46px] bg-[#2e7d32] hover:bg-[#1b5e20] active:scale-[0.99] text-white rounded-lg font-bold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Save className="w-5 h-5" />
              <span>حفظ وترحيل الحسابات</span>
            </button>

            {/* طباعة */}
            <button
              type="button"
              onClick={handlePrint}
              className="min-h-[46px] bg-[#1976d2] hover:bg-[#1565c0] active:scale-[0.99] text-white rounded-lg font-bold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Printer className="w-5 h-5" />
              <span>طباعة</span>
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* MODAL 1: دليل الأصناف (إضافة سريعة) */}
      {/* ============================================================== */}
      {isCatalogOpen && (
        <div className="fixed inset-0 z-60 bg-black/70 flex items-center justify-center p-2 sm:p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border border-slate-300">
            <div className="bg-[#1976d2] text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm sm:text-base">
                <Boxes className="w-5 h-5" />
                <span>دليل الأصناف والمخزون (إضافة سريعة)</span>
              </div>
              <button
                onClick={() => setIsCatalogOpen(false)}
                className="text-white hover:bg-white/20 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 border-b border-slate-200 bg-slate-50 space-y-2">
              {/* Search input */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="ابحث باسم الصنف أو الباركود أو الكود..."
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  className="w-full pl-3 pr-9 py-2 bg-white border border-slate-300 rounded-lg text-xs sm:text-sm font-bold focus:outline-none focus:border-blue-600"
                />
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              </div>

              {/* Categories */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                <button
                  type="button"
                  onClick={() => setCatalogCategory('all')}
                  className={`px-3 py-1 rounded-md font-bold whitespace-nowrap cursor-pointer ${
                    catalogCategory === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-slate-300 text-slate-700'
                  }`}
                >
                  جميع التصنيفات ({catalogList.length})
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCatalogCategory(cat)}
                    className={`px-3 py-1 rounded-md font-bold whitespace-nowrap cursor-pointer ${
                      catalogCategory === cat
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-slate-300 text-slate-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Catalog Items Grid / List */}
            <div className="p-3 overflow-y-auto flex-1 divide-y divide-slate-100">
              {filteredCatalogItems.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm">
                  لا توجد أصناف مطابقة للبحث
                </div>
              ) : (
                filteredCatalogItems.map((itm) => (
                  <div
                    key={itm.code}
                    onClick={() => openItemEdit(itm)}
                    className="py-2.5 px-3 hover:bg-blue-50/70 transition flex items-center justify-between cursor-pointer rounded-lg group"
                  >
                    <div>
                      <div className="font-bold text-slate-900 text-xs sm:text-sm group-hover:text-blue-700">
                        {itm.name}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 font-mono text-[11px] text-slate-500">
                        <span>كود: {itm.code}</span>
                        <span>•</span>
                        <span>تصنيف: {itm.category}</span>
                      </div>
                    </div>

                    <div className="text-left flex items-center gap-3">
                      <div>
                        <div className="font-mono font-bold text-xs sm:text-sm text-slate-900">
                          {isSale
                            ? pricingType === 'wholesale'
                              ? `${itm.wholesalePrice.toFixed(2)} ج.م (جملة)`
                              : `${itm.cashPrice.toFixed(2)} ج.م (نقدي)`
                            : `${itm.buyPrice.toFixed(2)} ج.م (شراء)`}
                        </div>
                        <div className="text-[11px] font-mono mt-0.5">
                          {itm.stock < 0 ? (
                            <span className="text-rose-950 bg-rose-100 px-1.5 py-0.5 rounded border border-rose-300 font-black">
                              رصيد سالب: {itm.stock}
                            </span>
                          ) : (
                            <span className="text-slate-600">رصيد: {itm.stock}</span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="w-8 h-8 rounded-lg bg-blue-100 group-hover:bg-blue-600 group-hover:text-white text-blue-800 flex items-center justify-center transition"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: تعديل الصنف (الكمية، السعر، الخصم، الضريبة، البيان) */}
      {/* ============================================================== */}
      {isItemEditModalOpen && editItemObj && (
        <div className="fixed inset-0 z-70 bg-black/75 flex items-center justify-center p-3 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-300">
            <div className="bg-[#1e293b] text-white px-4 py-3 flex items-center justify-between">
              <span className="font-bold text-sm">
                📦 ضبط الصنف: {editItemObj.name}
              </span>
              <button
                onClick={() => setIsItemEditModalOpen(false)}
                className="text-white hover:bg-slate-700 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3.5 text-xs sm:text-sm">
              {/* Negative Stock Alert Banner */}
              {isSale && editItemObj.stock < parseFloat(editQty || '0') && (
                <div className="bg-rose-50 border-2 border-rose-400 p-2.5 rounded-xl text-rose-950 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-700 shrink-0" />
                  <div className="text-[11px] font-bold">
                    ⚠️ الرصيد المتوفر بالمخزن ({editItemObj.stock}) أقل من الكمية المطلوبة. سيتم البيع بالسالب.
                  </div>
                </div>
              )}

              {/* Price Tier Switcher */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  فئة السعر:
                </label>
                <div className="grid grid-cols-3 gap-1.5 font-bold text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setItemPriceTier('cash');
                      setEditPrice(String(editItemObj.cashPrice));
                    }}
                    className={`py-1.5 px-2 rounded-lg border text-center transition cursor-pointer ${
                      itemPriceTier === 'cash'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 border-slate-300 text-slate-700'
                    }`}
                  >
                    نقدي ({editItemObj.cashPrice})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setItemPriceTier('wholesale');
                      setEditPrice(String(editItemObj.wholesalePrice));
                    }}
                    className={`py-1.5 px-2 rounded-lg border text-center transition cursor-pointer ${
                      itemPriceTier === 'wholesale'
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-slate-50 border-slate-300 text-slate-700'
                    }`}
                  >
                    جملة ({editItemObj.wholesalePrice})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setItemPriceTier('buy');
                      setEditPrice(String(editItemObj.buyPrice));
                    }}
                    className={`py-1.5 px-2 rounded-lg border text-center transition cursor-pointer ${
                      itemPriceTier === 'buy'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 border-slate-300 text-slate-700'
                    }`}
                  >
                    شراء ({editItemObj.buyPrice})
                  </button>
                </div>
              </div>

              {/* Price & Quantity Grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* السعر */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">السعر (ج.م):</label>
                  <input
                    type="number"
                    step="any"
                    value={editPrice}
                    onChange={(e) => {
                      setEditPrice(e.target.value);
                      setItemPriceTier('custom');
                    }}
                    className="w-full p-2 border-2 border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600 text-left"
                  />
                </div>

                {/* الكمية */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">الكمية:</label>
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => {
                        const cur = parseFloat(editQty) || 0;
                        setEditQty(String(cur + 1));
                      }}
                      className="w-8 h-9 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-r-lg flex items-center justify-center font-bold text-slate-800"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      step="any"
                      value={editQty}
                      onChange={(e) => setEditQty(e.target.value)}
                      className="w-full h-9 border-y border-slate-300 font-mono font-black text-center text-slate-900 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const cur = parseFloat(editQty) || 0;
                        if (cur > 1) setEditQty(String(cur - 1));
                      }}
                      className="w-8 h-9 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-l-lg flex items-center justify-center font-bold text-slate-800"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Discount & Tax on Line */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-700 font-bold">الخصم:</label>
                    <button
                      type="button"
                      onClick={() => setEditDiscType(editDiscType === 'percent' ? 'val' : 'percent')}
                      className="text-[10px] text-blue-800 font-bold underline"
                    >
                      {editDiscType === 'percent' ? 'نسبة مئوية %' : 'مبلغ ثابت ج'}
                    </button>
                  </div>
                  <input
                    type="number"
                    step="any"
                    value={editDiscVal}
                    onChange={(e) => setEditDiscVal(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono font-bold text-left"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-700 font-bold">الضريبة:</label>
                    <button
                      type="button"
                      onClick={() => setEditTaxType(editTaxType === 'percent' ? 'val' : 'percent')}
                      className="text-[10px] text-blue-800 font-bold underline"
                    >
                      {editTaxType === 'percent' ? 'نسبة مئوية %' : 'مبلغ ثابت ج'}
                    </button>
                  </div>
                  <input
                    type="number"
                    step="any"
                    value={editTaxVal}
                    onChange={(e) => setEditTaxVal(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono font-bold text-left"
                  />
                </div>
              </div>

              {/* Specification / Description */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  البيان / الوصف (يظهر بالفاتورة):
                </label>
                <input
                  type="text"
                  placeholder="ملاحظات أو مواصفات للصنف..."
                  value={editSpec}
                  onChange={(e) => setEditSpec(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg font-bold text-slate-900"
                />
              </div>

              {/* Total preview */}
              <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between font-bold">
                <span className="text-slate-700">إجمالي هذا الصنف:</span>
                <span className="font-mono text-base text-blue-900 font-black">
                  {(() => {
                    const q = parseFloat(editQty) || 0;
                    const p = parseFloat(editPrice) || 0;
                    const dv = parseFloat(editDiscVal) || 0;
                    const tv = parseFloat(editTaxVal) || 0;
                    const base = q * p;
                    const disc = editDiscType === 'percent' ? base * (dv / 100) : dv * q;
                    const aft = base - disc;
                    const tax = editTaxType === 'percent' ? aft * (tv / 100) : tv * q;
                    return (aft + tax).toFixed(2);
                  })()}{' '}
                  ج.م
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleConfirmItem}
                  className="flex-1 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-bold text-sm cursor-pointer"
                >
                  ✓ تأكيد وإدراج بالفاتورة
                </button>
                <button
                  type="button"
                  onClick={() => setIsItemEditModalOpen(false)}
                  className="py-2.5 px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-bold text-sm cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: الخصم، الضريبة والدفع */}
      {/* ============================================================== */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-70 bg-black/75 flex items-center justify-center p-3 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl border border-slate-300">
            <div className="bg-[#1a237e] text-white px-4 py-3 flex items-center justify-between">
              <span className="font-bold text-sm sm:text-base flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4" />
                <span>إعدادات الخصم، الضريبة، وطرق الدفع</span>
              </span>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-white hover:bg-blue-900 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4 text-xs sm:text-sm max-h-[80vh] overflow-y-auto">
              {/* الخصم الكلي للفاتورة */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800">خصم الفاتورة الإجمالي:</label>
                  <div className="flex items-center gap-1 bg-white p-0.5 rounded border border-slate-300 text-xs">
                    <button
                      type="button"
                      onClick={() => setInvDiscType('val')}
                      className={`px-2 py-0.5 rounded ${invDiscType === 'val' ? 'bg-blue-700 text-white' : 'text-slate-700'}`}
                    >
                      مبلغ ثابت
                    </button>
                    <button
                      type="button"
                      onClick={() => setInvDiscType('percent')}
                      className={`px-2 py-0.5 rounded ${invDiscType === 'percent' ? 'bg-blue-700 text-white' : 'text-slate-700'}`}
                    >
                      نسبة مئوية %
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  step="any"
                  value={globalInvDisc}
                  onChange={(e) => setGlobalInvDisc(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-left"
                />
              </div>

              {/* الضريبة الكلية للفاتورة */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800">ضريبة الفاتورة العامة:</label>
                  <div className="flex items-center gap-1 bg-white p-0.5 rounded border border-slate-300 text-xs">
                    <button
                      type="button"
                      onClick={() => setInvTaxType('val')}
                      className={`px-2 py-0.5 rounded ${invTaxType === 'val' ? 'bg-blue-700 text-white' : 'text-slate-700'}`}
                    >
                      مبلغ ثابت
                    </button>
                    <button
                      type="button"
                      onClick={() => setInvTaxType('percent')}
                      className={`px-2 py-0.5 rounded ${invTaxType === 'percent' ? 'bg-blue-700 text-white' : 'text-slate-700'}`}
                    >
                      نسبة مئوية %
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  step="any"
                  value={globalInvTax}
                  onChange={(e) => setGlobalInvTax(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-left"
                />
              </div>

              {/* خدمات / مصاريف إضافية */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                <label className="font-bold text-slate-800 block">خدمة / شحن / إيراد إضافي:</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="بيان الخدمة أو الشحن..."
                    value={extraRevenueName}
                    onChange={(e) => setExtraRevenueName(e.target.value)}
                    className="p-2 bg-white border border-slate-300 rounded-lg font-bold"
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder="القيمة..."
                    value={extraRevenueVal || ''}
                    onChange={(e) => setExtraRevenueVal(parseFloat(e.target.value) || 0)}
                    className="p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-left"
                  />
                </div>
              </div>

              {/* طرق الدفع المتعددة */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800">طرق الدفع والتسديد:</label>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentRows([
                        ...paymentRows,
                        {
                          id: `pay_${Date.now()}`,
                          method: 'نقدي / كاش (الدرج)',
                          amount: 0,
                        },
                      ]);
                    }}
                    className="text-xs text-blue-700 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة طريقة دفع أخرى</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {paymentRows.map((row, rIdx) => (
                    <div key={row.id} className="flex items-center gap-2">
                      <select
                        value={row.method}
                        onChange={(e) => {
                          const updated = [...paymentRows];
                          updated[rIdx].method = e.target.value;
                          setPaymentRows(updated);
                        }}
                        className="flex-1 p-2 bg-white border border-slate-300 rounded-lg font-bold text-xs"
                      >
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        step="any"
                        placeholder="المبلغ..."
                        value={row.amount || ''}
                        onChange={(e) => {
                          const updated = [...paymentRows];
                          updated[rIdx].amount = parseFloat(e.target.value) || 0;
                          setPaymentRows(updated);
                        }}
                        className="w-32 p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-left"
                      />
                      {paymentRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = paymentRows.filter((_, i) => i !== rIdx);
                            setPaymentRows(updated);
                          }}
                          className="p-2 text-rose-600 hover:bg-rose-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between text-xs pt-1 text-slate-600 font-bold">
                  <span>إجمالي المدفوع: {calculations.paidTotal.toFixed(2)} ج.م</span>
                  <span>المتبقي: {calculations.remaining.toFixed(2)} ج.م</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-bold text-sm cursor-pointer"
              >
                تطبيق الإعدادات
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
