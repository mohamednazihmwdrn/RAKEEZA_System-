import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppData, SaleInvoice, PurchaseInvoice, Item, Customer, Supplier } from '../types';
import { calculateCustomerBalance, calculateSupplierBalance } from '../utils/accounting';
import { postSaleInvoice, postPurchaseInvoice, mapPaymentMethodToKey } from '../utils/posting';
import { printInvoiceWindow } from '../utils/printInvoice';

export interface RakeezaInvoiceWorkspaceProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'sale' | 'purchase';
  invoiceType: 'nagdi' | 'ajel' | 'return_nagdi' | 'return_ajel';
  pricingType?: 'cash' | 'wholesale' | 'buy';
  editingInvoice?: SaleInvoice | PurchaseInvoice | null;
  appData: AppData;
  onUpdateData: (newData: AppData, actionInfo?: { action?: string; module?: string; details?: string; deletedId?: string | number }) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export interface WorkspaceItemRow {
  rowId: string;
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

export const RakeezaInvoiceWorkspace: React.FC<RakeezaInvoiceWorkspaceProps> = ({
  isOpen,
  onClose,
  mode,
  invoiceType: initialInvoiceType,
  pricingType,
  editingInvoice,
  appData,
  onUpdateData,
  showToast,
}) => {
  if (!isOpen) return null;

  const isSale = mode === 'sale';

  // State Management
  const [selectedInvoiceType, setSelectedInvoiceType] = useState<'nagdi' | 'ajel' | 'return_nagdi' | 'return_ajel'>(
    editingInvoice?.type || initialInvoiceType || 'nagdi'
  );

  const isReturn = selectedInvoiceType.startsWith('return_');

  // Pricing mode: 'cash' | 'wholesale' | 'buy'
  const [currentInvoicePriceType, setCurrentInvoicePriceType] = useState<'cash' | 'wholesale' | 'buy'>(
    pricingType || (mode === 'purchase' ? 'buy' : 'cash')
  );

  // 🎨 Distinct Color Theming for Sales vs Purchases and invoice types
  const theme = useMemo(() => {
    if (isReturn) {
      return {
        headerBg: 'from-rose-900 via-rose-800 to-red-800',
        primary: '#881337',
        secondary: '#e11d48',
        accent: '#be123c',
        badge: isSale ? '↩ مرتجع مبيعات' : '↩ مرتجع مشتريات',
        badgeColor: 'bg-rose-500 text-white',
        bannerBg: 'bg-rose-50 border-rose-200 text-rose-900',
        cardBorder: 'border-rose-300',
      };
    }
    if (isSale) {
      if (currentInvoicePriceType === 'wholesale') {
        return {
          headerBg: 'from-indigo-950 via-indigo-900 to-purple-900',
          primary: '#312e81',
          secondary: '#4f46e5',
          accent: '#10b981',
          badge: '🏷️ بيع جملة (أسعار الجملة)',
          badgeColor: 'bg-indigo-500 text-white',
          bannerBg: 'bg-indigo-50 border-indigo-200 text-indigo-900',
          cardBorder: 'border-indigo-300',
        };
      }
      if (selectedInvoiceType === 'ajel') {
        return {
          headerBg: 'from-amber-950 via-amber-900 to-yellow-950',
          primary: '#78350f',
          secondary: '#d97706',
          accent: '#059669',
          badge: '⏳ بيع آجل (ذمم عملاء)',
          badgeColor: 'bg-amber-400 text-slate-900 font-black',
          bannerBg: 'bg-amber-50 border-amber-200 text-amber-900',
          cardBorder: 'border-amber-300',
        };
      }
      // Sale Cash
      return {
        headerBg: 'from-blue-950 via-blue-900 to-indigo-900',
        primary: '#1e3a8a',
        secondary: '#2563eb',
        accent: '#16a34a',
        badge: '💵 بيع نقدي (كاش)',
        badgeColor: 'bg-emerald-500 text-white',
        bannerBg: 'bg-blue-50 border-blue-200 text-blue-900',
        cardBorder: 'border-blue-300',
      };
    } else {
      // Purchases Mode
      if (currentInvoicePriceType === 'wholesale') {
        return {
          headerBg: 'from-cyan-950 via-cyan-900 to-teal-950',
          primary: '#155e75',
          secondary: '#0891b2',
          accent: '#059669',
          badge: '📦 توريد وشراء جملة',
          badgeColor: 'bg-cyan-500 text-white',
          bannerBg: 'bg-cyan-50 border-cyan-200 text-cyan-900',
          cardBorder: 'border-cyan-300',
        };
      }
      if (selectedInvoiceType === 'ajel') {
        return {
          headerBg: 'from-amber-950 via-yellow-900 to-amber-900',
          primary: '#713f12',
          secondary: '#ca8a04',
          accent: '#047857',
          badge: '⏳ شراء آجل (مستحقات مورد)',
          badgeColor: 'bg-amber-400 text-slate-900 font-black',
          bannerBg: 'bg-amber-50 border-amber-200 text-amber-900',
          cardBorder: 'border-amber-300',
        };
      }
      // Purchase Cash
      return {
        headerBg: 'from-teal-950 via-teal-900 to-emerald-950',
        primary: '#044e45',
        secondary: '#0d9488',
        accent: '#059669',
        badge: '🛒 شراء نقدي للمنشأة',
        badgeColor: 'bg-teal-500 text-white',
        bannerBg: 'bg-teal-50 border-teal-200 text-teal-900',
        cardBorder: 'border-teal-300',
      };
    }
  }, [isSale, isReturn, selectedInvoiceType, currentInvoicePriceType]);

  const themePrimary = theme.primary;
  const themeSecondary = theme.secondary;
  const themeAccent = theme.accent;

  // Invoice Number & Timestamps
  const invoiceId = useMemo(() => {
    if (editingInvoice?.id) return editingInvoice.id;
    const list = isSale ? (appData.salesInvoices || []) : (appData.purchaseInvoices || []);
    let maxId = 0;
    list.forEach((i) => {
      const num = Number(i.id) || 0;
      if (num > maxId) maxId = num;
    });
    return maxId + 1;
  }, [editingInvoice, isSale, appData]);

  const [invNum] = useState<string>(
    (editingInvoice as any)?.invoiceNumber ? String((editingInvoice as any).invoiceNumber) : String(invoiceId)
  );

  const [invDate, setInvDate] = useState<string>(
    editingInvoice?.date || new Date().toISOString().split('T')[0]
  );

  const now = new Date();
  const [invTime, setInvTime] = useState<string>(
    editingInvoice?.time ||
      `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  );

  // Live Clock in Header
  const [isMaximized, setIsMaximized] = useState(false);
  const [liveClock, setLiveClock] = useState<string>('00:00');
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setLiveClock(d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Party State (Customer in Sales, Supplier in Purchases)
  const [partyCode, setPartyCode] = useState<string>(
    isSale ? (editingInvoice as any)?.customerCode || '1' : (editingInvoice as any)?.supplierCode || '1'
  );
  const [partyName, setPartyName] = useState<string>(
    isSale ? (editingInvoice as SaleInvoice)?.customerName || '' : (editingInvoice as PurchaseInvoice)?.supplierName || ''
  );
  const [partyPhone, setPartyPhone] = useState<string>(editingInvoice?.phone || '');
  const [jobSite, setJobSite] = useState<string>((editingInvoice as any)?.jobSite || editingInvoice?.notes || '');

  // Autocomplete Dropdowns State
  const [showNameDropdown, setShowNameDropdown] = useState(false);
  const [showPhoneDropdown, setShowPhoneDropdown] = useState(false);

  // Items in Current Invoice
  const [invoiceItems, setInvoiceItems] = useState<WorkspaceItemRow[]>(() => {
    if (editingInvoice?.items && editingInvoice.items.length > 0) {
      return editingInvoice.items.map((i, idx) => ({
        rowId: (i as any).rowId || `row_${idx}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        code: i.code || '',
        name: i.name,
        spec: i.spec || '',
        qty: Number(i.qty || (i as any).quantity || 1),
        price: Number(i.price || 0),
        total: Number(i.total || (Number(i.qty || 1) * Number(i.price || 0))),
        itemId: i.itemId,
        costPrice: i.costPrice,
      }));
    }
    return [];
  });

  // 🎯 Multi-Selection & Long-Press state for items deletion
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressTriggeredRef = useRef<boolean>(false);
  const pointerStartPosRef = useRef<{ x: number; y: number } | null>(null);

  // Options & Payments Modal State
  const [isOptionsModalOpen, setIsOptionsModalOpen] = useState(false);
  const [invDiscType, setInvDiscType] = useState<'val' | 'percent'>('val');
  const [globalInvDisc, setGlobalInvDisc] = useState<string>(
    editingInvoice?.discount ? String(editingInvoice.discount) : ''
  );
  const [invTaxType, setInvTaxType] = useState<'val' | 'percent'>('percent');
  const [globalInvTax, setGlobalInvTax] = useState<string>(
    editingInvoice?.tax ? String(editingInvoice.tax) : ''
  );
  const [extraIncomeName, setExtraIncomeName] = useState<string>(
    (editingInvoice as any)?.extraIncomeName || ''
  );
  const [extraIncomeVal, setExtraIncomeVal] = useState<string>(
    (editingInvoice as any)?.extraIncome ? String((editingInvoice as any).extraIncome) : ''
  );

  const [paymentRows, setPaymentRows] = useState<WorkspacePayRow[]>(() => {
    if ((editingInvoice as any)?.paymentRows && (editingInvoice as any).paymentRows.length > 0) {
      return (editingInvoice as any).paymentRows;
    }
    if (editingInvoice?.paidAmount && Number(editingInvoice.paidAmount) > 0) {
      return [{ id: '1', method: editingInvoice.paymentMethod || 'نقدي / كاش', amount: Number(editingInvoice.paidAmount) }];
    }
    return [];
  });

  // Quick Search / Barcode Input State
  const [quickSearchText, setQuickSearchText] = useState('');
  const [showQuickDropdown, setShowQuickDropdown] = useState(false);

  // Lookup Modal (دليل الأصناف) State
  const [isLookupModalOpen, setIsLookupModalOpen] = useState(false);
  const [lookupSearch, setLookupSearch] = useState('');
  const [selectedLookupCategory, setSelectedLookupCategory] = useState('all');

  // Modify Single Invoice Item Modal State (كارت التعديل التفصيلي)
  const [isModifyModalOpen, setIsModifyModalOpen] = useState(false);
  const [modifyIndex, setModifyIndex] = useState<number>(-1);
  const [modifyName, setModifyName] = useState('');
  const [modifyCode, setModifyCode] = useState('');
  const [modifyQty, setModifyQty] = useState('');
  const [modifyPrice, setModifyPrice] = useState('');
  const [modifySpec, setModifySpec] = useState('');
  const [modifyStock, setModifyStock] = useState<number | null>(null);
  const [modifyCostPrice, setModifyCostPrice] = useState<number>(0);

  // Add Brand New Item Modal (إضافة صنف جديد للمخزون) State
  const [isNewItemModalOpen, setIsNewItemModalOpen] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCode, setNewItemCode] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('');
  const [newItemBuyPrice, setNewItemBuyPrice] = useState('');
  const [newItemCashMargin, setNewItemCashMargin] = useState('');
  const [newItemCashPriceManual, setNewItemCashPriceManual] = useState('');
  const [newItemWholesaleMargin, setNewItemWholesaleMargin] = useState('');
  const [newItemWholesalePriceManual, setNewItemWholesalePriceManual] = useState('');
  const [newItemStockQty, setNewItemStockQty] = useState('');

  // Categories List
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    (appData.items || []).forEach((it) => {
      if (it.category) set.add(it.category.trim());
    });
    return Array.from(set).filter(Boolean);
  }, [appData.items]);

  // Active party balance and status
  const partyBalanceInfo = useMemo(() => {
    if (isSale) {
      const customer = (appData.customers || []).find(
        (c) => c.name.trim().toLowerCase() === partyName.trim().toLowerCase() || (c as any).code === partyCode
      );
      if (!customer) {
        return { typeText: 'نقدي', balanceVal: '0.00', color: '#16a34a' };
      }
      const { balance } = calculateCustomerBalance(customer, appData);
      if (balance > 0) {
        return { typeText: 'آجل (عليه مديونية)', balanceVal: `${balance.toFixed(2)} (عليه)`, color: '#dc2626' };
      }
      if (balance < 0) {
        return { typeText: 'آجل (له رصيد دائن)', balanceVal: `${Math.abs(balance).toFixed(2)} (له)`, color: '#16a34a' };
      }
      return { typeText: 'نقدي / مسدد', balanceVal: '0.00', color: '#2563eb' };
    } else {
      const supplier = (appData.suppliers || []).find(
        (s) => s.name.trim().toLowerCase() === partyName.trim().toLowerCase() || (s as any).code === partyCode
      );
      if (!supplier) {
        return { typeText: 'نقدي', balanceVal: '0.00', color: '#16a34a' };
      }
      const { balance } = calculateSupplierBalance(supplier, appData);
      if (balance > 0) {
        return { typeText: 'آجل (له مستحقات)', balanceVal: `${balance.toFixed(2)} (له)`, color: '#dc2626' };
      }
      if (balance < 0) {
        return { typeText: 'آجل (مدين لنا)', balanceVal: `${Math.abs(balance).toFixed(2)} (عليه)`, color: '#16a34a' };
      }
      return { typeText: 'نقدي / مسدد', balanceVal: '0.00', color: '#2563eb' };
    }
  }, [isSale, partyName, partyCode, appData]);

  // Filtered Customers / Suppliers for Dropdowns
  const filteredParties = useMemo(() => {
    const list = isSale ? (appData.customers || []) : (appData.suppliers || []);
    return list;
  }, [isSale, appData]);

  const selectParty = (party: Customer | Supplier) => {
    const code = (party as any).code || party.id;
    setPartyCode(code);
    setPartyName(party.name || '');
    setPartyPhone(party.phone || '');
    setShowNameDropdown(false);
    setShowPhoneDropdown(false);
  };

  const syncPartyByCode = (code: string) => {
    setPartyCode(code);
    const matched = filteredParties.find((p) => ((p as any).code && (p as any).code === code.trim()) || p.id === code.trim());
    if (matched) {
      setPartyName(matched.name || '');
      setPartyPhone(matched.phone || '');
    }
  };

  // Pricing switch logic (cash, wholesale, buy)
  const setInvoicePriceType = (type: 'cash' | 'wholesale' | 'buy') => {
    setCurrentInvoicePriceType(type);
    setInvoiceItems((prev) =>
      prev.map((row) => {
        const dbItem = (appData.items || []).find(
          (i) => i.code === row.code || i.id === row.itemId || i.name.trim() === row.name.trim()
        );
        if (dbItem) {
          let newPrice = row.price;
          if (type === 'wholesale') {
            newPrice = Number(dbItem.wholesalePrice || dbItem.price || row.price);
          } else if (type === 'buy') {
            newPrice = Number(dbItem.costPrice || dbItem.purchasePrice || dbItem.price || row.price);
          } else {
            newPrice = Number(dbItem.salePrice || dbItem.price || row.price);
          }
          return {
            ...row,
            price: newPrice,
            total: row.qty * newPrice,
          };
        }
        return row;
      })
    );
  };

  // Calculation of Subtotals, Discounts, Taxes, Net, Paid, Remain
  const totals = useMemo(() => {
    let totalQty = 0;
    let subtotal = 0;

    invoiceItems.forEach((i) => {
      totalQty += Number(i.qty) || 0;
      subtotal += (Number(i.qty) || 0) * (Number(i.price) || 0);
    });

    const discVal = parseFloat(globalInvDisc) || 0;
    const calculatedDiscount = invDiscType === 'percent' ? subtotal * (discVal / 100) : discVal;

    const afterDiscount = Math.max(0, subtotal - calculatedDiscount);

    const taxVal = parseFloat(globalInvTax) || 0;
    const calculatedTax = invTaxType === 'percent' ? afterDiscount * (taxVal / 100) : taxVal;

    const extra = parseFloat(extraIncomeVal) || 0;

    const net = Math.max(0, afterDiscount + calculatedTax + extra);

    let paid = 0;
    if (paymentRows.length === 0) {
      if (selectedInvoiceType === 'nagdi' || selectedInvoiceType === 'return_nagdi') {
        paid = net;
      } else {
        paid = 0;
      }
    } else {
      paymentRows.forEach((r) => {
        paid += Math.max(0, Number(r.amount) || 0);
      });
      // If cash invoice and paid amount is 0, auto-settle as net
      if ((selectedInvoiceType === 'nagdi' || selectedInvoiceType === 'return_nagdi') && paid === 0 && net > 0) {
        paid = net;
      }
    }

    const remain = Math.max(0, net - paid);

    return {
      totalQty,
      subtotal,
      discount: calculatedDiscount,
      tax: calculatedTax,
      extra,
      net,
      paid,
      remain,
    };
  }, [invoiceItems, globalInvDisc, invDiscType, globalInvTax, invTaxType, extraIncomeVal, paymentRows, selectedInvoiceType]);

  // Quick Add / Barcode Handler
  const handleQuickAddFromSearch = (item: any) => {
    quickAddItemToInvoice(item);
    setQuickSearchText('');
    setShowQuickDropdown(false);
  };

  const handleQuickSearchEnter = () => {
    const q = quickSearchText.trim().toLowerCase();
    if (!q) return;
    const items = appData.items || [];
    // Exact barcode match first
    const exactBarcode = items.find((i) => i.code && i.code.toLowerCase() === q);
    if (exactBarcode) {
      handleQuickAddFromSearch(exactBarcode);
      return;
    }
    // Exact name match
    const exactName = items.find((i) => i.name.toLowerCase() === q);
    if (exactName) {
      handleQuickAddFromSearch(exactName);
      return;
    }
    // Partial matches
    const matches = items.filter(
      (i) => i.name.toLowerCase().includes(q) || (i.code && i.code.toLowerCase().includes(q))
    );
    if (matches.length === 1) {
      handleQuickAddFromSearch(matches[0]);
    } else if (matches.length > 1) {
      setShowQuickDropdown(true);
    } else {
      showToast(`الصنف "${quickSearchText}" غير مسجل بقاعدة الأصناف`, 'warning');
    }
  };

  // Add Item to Invoice from Lookup
  const quickAddItemToInvoice = (item: any) => {
    const stock = Number(item.quantity ?? 0);
    if (isSale && !isReturn && stock <= 0) {
      const proceed = confirm(`⚠️ تنبيه: رصيد الصنف (${item.name}) منتهٍ أو صفر بالمخزن. هل تريد المتابعة بالبيع بالسالب؟`);
      if (!proceed) return;
    }

    let activePrice = Number(item.salePrice || item.price || 0);
    if (currentInvoicePriceType === 'wholesale') {
      activePrice = Number(item.wholesalePrice || item.price || 0);
    } else if (currentInvoicePriceType === 'buy' || !isSale) {
      activePrice = Number(item.costPrice || item.purchasePrice || item.price || 0);
    }

    setInvoiceItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.code === item.code && (!i.spec || i.spec === ''));
      if (existingIdx > -1) {
        const copy = [...prev];
        const nextQty = copy[existingIdx].qty + 1;
        copy[existingIdx] = {
          ...copy[existingIdx],
          qty: nextQty,
          total: nextQty * copy[existingIdx].price,
        };
        return copy;
      }
      return [
        ...prev,
        {
          rowId: `row_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          code: item.code || '',
          name: item.name,
          spec: '',
          qty: 1,
          price: activePrice,
          total: activePrice * 1,
          itemId: item.id,
          costPrice: Number(item.costPrice || 0),
        },
      ];
    });

    setIsLookupModalOpen(false);
  };

  // Modify Item in Invoice Table (كارت التعديل التفصيلي للصنف)
  const openModifyModal = (index: number) => {
    const item = invoiceItems[index];
    if (!item) return;
    setModifyIndex(index);
    setModifyName(item.name);
    setModifyCode(item.code || '');
    setModifyQty(String(item.qty));
    setModifyPrice(String(item.price));
    setModifySpec(item.spec || '');
    setModifyCostPrice(item.costPrice || 0);

    // Look up real-time stock from inventory
    const dbItem = (appData.items || []).find(
      (i) => (i.code && item.code && i.code === item.code) || (item.itemId && i.id === item.itemId) || i.name.trim() === item.name.trim()
    );
    setModifyStock(dbItem ? Number(dbItem.quantity ?? 0) : null);
    setIsModifyModalOpen(true);
  };

  const saveModifiedItem = () => {
    if (modifyIndex < 0 || modifyIndex >= invoiceItems.length) return;
    const qty = parseFloat(modifyQty) || 0;
    const price = parseFloat(modifyPrice) || 0;
    if (qty <= 0) {
      alert('الرجاء إدخال كمية صحيحة أكبر من صفر');
      return;
    }
    setInvoiceItems((prev) => {
      const copy = [...prev];
      copy[modifyIndex] = {
        ...copy[modifyIndex],
        name: modifyName.trim() || copy[modifyIndex].name,
        qty,
        price,
        spec: modifySpec.trim(),
        total: qty * price,
      };
      return copy;
    });
    setIsModifyModalOpen(false);
    showToast('تم حفظ تعديلات الصنف بالفاتورة', 'success');
  };

  const deleteCurrentModifiedItem = () => {
    if (modifyIndex < 0 || modifyIndex >= invoiceItems.length) return;
    removeItemFromInvoice(modifyIndex);
    setIsModifyModalOpen(false);
    showToast('تم حذف الصنف من الفاتورة', 'info');
  };

  // Remove Single Item
  const removeItemFromInvoice = (index: number) => {
    const target = invoiceItems[index];
    if (target && selectedRowIds.has(target.rowId)) {
      setSelectedRowIds((prev) => {
        const next = new Set(prev);
        next.delete(target.rowId);
        return next;
      });
    }
    setInvoiceItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // 🎯 Long Press & Click Logic for Table Rows
  const handlePointerDown = (rowId: string, e: React.PointerEvent) => {
    // Only capture primary button
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    isLongPressTriggeredRef.current = false;
    pointerStartPosRef.current = { x: e.clientX, y: e.clientY };

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    // 450ms press triggers multi-select
    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      setSelectedRowIds((prev) => {
        const next = new Set(prev);
        if (next.has(rowId)) {
          next.delete(rowId);
        } else {
          next.add(rowId);
        }
        return next;
      });
      if (window.navigator?.vibrate) {
        window.navigator.vibrate(50);
      }
    }, 450);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (pointerStartPosRef.current) {
      const dx = Math.abs(e.clientX - pointerStartPosRef.current.x);
      const dy = Math.abs(e.clientY - pointerStartPosRef.current.y);
      if (dx > 10 || dy > 10) {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      }
    }
  };

  const handlePointerUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleRowClick = (index: number, rowId: string, e: React.MouseEvent) => {
    if (isLongPressTriggeredRef.current) {
      // Long press just happened, suppress the regular click
      isLongPressTriggeredRef.current = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // If selection mode is active (any items are selected), clicking a row toggles selection
    if (selectedRowIds.size > 0) {
      setSelectedRowIds((prev) => {
        const next = new Set(prev);
        if (next.has(rowId)) {
          next.delete(rowId);
        } else {
          next.add(rowId);
        }
        return next;
      });
      return;
    }

    // Normal Single Click opens "كارت التعديل التفصيلي"
    openModifyModal(index);
  };

  const toggleSelectRow = (rowId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  // Bulk Delete Selected Items
  const handleDeleteSelected = () => {
    if (selectedRowIds.size === 0) return;
    const count = selectedRowIds.size;
    if (!confirm(`هل أنت متأكد من حذف (${count}) صنف محدد من الفاتورة؟`)) return;
    setInvoiceItems((prev) => prev.filter((item) => !selectedRowIds.has(item.rowId)));
    setSelectedRowIds(new Set());
    showToast(`🗑️ تم حذف (${count}) أصناف محددة بنجاح`, 'info');
  };

  // Select / Deselect All
  const handleSelectAll = () => {
    if (selectedRowIds.size === invoiceItems.length) {
      setSelectedRowIds(new Set());
    } else {
      setSelectedRowIds(new Set(invoiceItems.map((i) => i.rowId)));
    }
  };

  // Multi-Payment Rows in Options Modal
  const addPaymentRow = (method: string = 'نقدي / كاش', amount: number = 0) => {
    setPaymentRows((prev) => [
      ...prev,
      { id: String(Date.now() + Math.random()), method, amount: amount || 0 },
    ]);
  };

  const removePaymentRow = (id: string) => {
    setPaymentRows((prev) => prev.filter((r) => r.id !== id));
  };

  const updatePaymentRow = (id: string, field: 'method' | 'amount', val: any) => {
    setPaymentRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: field === 'amount' ? parseFloat(val) || 0 : val } : r))
    );
  };

  // Create Brand New Item Logic
  const openNewItemDialog = () => {
    let maxCode = 0;
    (appData.items || []).forEach((i) => {
      const num = parseInt(String(i.code || '').replace(/\D/g, '')) || 0;
      if (num > maxCode) maxCode = num;
    });
    setNewItemCode('1' + String(maxCode + 1).padStart(3, '0'));
    setNewItemName('');
    setNewItemCategory(categoriesList[0] || 'عامة');
    setNewItemBuyPrice('');
    setNewItemCashMargin('20');
    setNewItemCashPriceManual('');
    setNewItemWholesaleMargin('10');
    setNewItemWholesalePriceManual('');
    setNewItemStockQty('10');
    setIsNewItemModalOpen(true);
  };

  const handleCalculateMargins = (buyP: number, cashM: number, wholesaleM: number) => {
    if (buyP > 0) {
      if (cashM > 0) {
        setNewItemCashPriceManual((buyP * (1 + cashM / 100)).toFixed(2));
      }
      if (wholesaleM > 0) {
        setNewItemWholesalePriceManual((buyP * (1 + wholesaleM / 100)).toFixed(2));
      }
    }
  };

  const saveNewItemToInventory = () => {
    const name = newItemName.trim();
    if (!name) {
      alert('يرجى إدخال اسم الصنف الجديد');
      return;
    }
    const buyPrice = parseFloat(newItemBuyPrice) || 0;
    const cashPrice = parseFloat(newItemCashPriceManual) || (buyPrice > 0 ? buyPrice * 1.2 : 10);
    const wholesalePrice = parseFloat(newItemWholesalePriceManual) || (cashPrice * 0.95);
    const stock = parseFloat(newItemStockQty) || 0;

    const newItemObj: Item = {
      id: `it_${Date.now()}`,
      code: newItemCode.trim(),
      name,
      category: newItemCategory || 'عامة',
      costPrice: buyPrice,
      purchasePrice: buyPrice,
      price: cashPrice,
      salePrice: cashPrice,
      wholesalePrice: wholesalePrice,
      quantity: stock,
      minStockAlert: 5,
    };

    const updatedData: AppData = {
      ...appData,
      items: [...(appData.items || []), newItemObj],
    };

    onUpdateData(updatedData, {
      action: 'إضافة صنف جديد من الفاتورة',
      module: 'المخزون',
      details: `إضافة صنف ${name} بسعر ${cashPrice}`,
    });

    setIsNewItemModalOpen(false);
    setIsLookupModalOpen(false);

    // Quick add to invoice
    quickAddItemToInvoice(newItemObj);
    showToast(`✅ تم إنشاء الصنف [${name}] وإضافته للمخزون والفاتورة مباشرة`, 'success');
  };

  // Save Invoice & Post Ledger
  const handleSaveAndPostInvoice = () => {
    if (invoiceItems.length === 0) {
      alert('الفاتورة فارغة! يرجى إدراج صنف واحد على الأقل من دليل الأصناف.');
      return;
    }

    const defaultPartyName = isSale
      ? partyName.trim() || 'عميل نقدي'
      : partyName.trim() || 'مورد عام';

    // Build finalized payments array
    let finalPayments = [...paymentRows];
    if (finalPayments.length === 0 || (finalPayments.length === 1 && (finalPayments[0].amount || 0) === 0)) {
      if (selectedInvoiceType === 'nagdi' || selectedInvoiceType === 'return_nagdi') {
        finalPayments = [{ id: '1', method: 'نقدي / كاش', amount: totals.net }];
      }
    }

    const primaryMethodKey = finalPayments.length > 1
      ? 'split'
      : mapPaymentMethodToKey(finalPayments[0]?.method);

    if (isSale) {
      const invoiceData: SaleInvoice = {
        id: editingInvoice?.id || invoiceId,
        date: invDate,
        time: invTime,
        type: selectedInvoiceType,
        salesType: currentInvoicePriceType === 'wholesale' ? 'wholesale' : 'cash',
        customerName: defaultPartyName,
        phone: partyPhone,
        notes: jobSite,
        items: invoiceItems.map((i) => ({
          itemId: i.itemId || i.code,
          code: i.code,
          name: i.name,
          qty: i.qty,
          price: i.price,
          total: i.total,
          spec: i.spec,
          costPrice: i.costPrice || 0,
        })),
        subtotal: totals.subtotal,
        discount: totals.discount,
        discountType: invDiscType === 'percent' ? 'percent' : 'fixed',
        tax: totals.tax,
        taxType: invTaxType === 'percent' ? 'percent' : 'fixed',
        extraRevenueAmount: totals.extra,
        extraRevenueName: extraIncomeName,
        fees: 0,
        total: totals.net,
        paidAmount: totals.paid,
        remainingAmount: totals.remain,
        paymentMethod: primaryMethodKey,
        status: 'approved',
        branchId: appData.activeBranchId || appData.branches?.[0]?.id || 'main',
        createdAt: editingInvoice?.createdAt || new Date().toISOString(),
        createdBy: editingInvoice?.createdBy || (appData.users?.find((u) => u.id === appData.currentUser)?.name || 'مدير النظام'),
      };

      const isEditing = !!editingInvoice?.id;
      const updated = postSaleInvoice(appData, invoiceData, isEditing, editingInvoice?.id);

      onUpdateData(updated, {
        action: isEditing ? 'تعديل فاتورة مبيعات' : 'حفظ فاتورة مبيعات',
        module: 'المبيعات',
        details: `فاتورة مبيعات #${invNum} - العميل: ${defaultPartyName} - الصافي: ${totals.net.toFixed(2)} ج.م`,
      });

      showToast(`✅ تم حفظ وترحيل فاتورة المبيعات #${invNum} وتحديث الحسابات والمخزن بنجاح`, 'success');
      onClose();
    } else {
      const invoiceData: PurchaseInvoice = {
        id: editingInvoice?.id || invoiceId,
        date: invDate,
        time: invTime,
        type: selectedInvoiceType,
        supplierName: defaultPartyName,
        phone: partyPhone,
        notes: jobSite,
        items: invoiceItems.map((i) => ({
          itemId: i.itemId || i.code,
          code: i.code,
          name: i.name,
          qty: i.qty,
          price: i.price,
          total: i.total,
          spec: i.spec,
          costPrice: i.price,
        })),
        subtotal: totals.subtotal,
        discount: totals.discount,
        discountType: invDiscType === 'percent' ? 'percent' : 'fixed',
        tax: totals.tax,
        taxType: invTaxType === 'percent' ? 'percent' : 'fixed',
        fees: 0,
        total: totals.net,
        paidAmount: totals.paid,
        remainingAmount: totals.remain,
        paymentMethod: primaryMethodKey,
        status: 'approved',
        branchId: appData.activeBranchId || appData.branches?.[0]?.id || 'main',
        createdAt: editingInvoice?.createdAt || new Date().toISOString(),
        createdBy: editingInvoice?.createdBy || (appData.users?.find((u) => u.id === appData.currentUser)?.name || 'مدير النظام'),
      };

      const isEditing = !!editingInvoice?.id;
      const updated = postPurchaseInvoice(appData, invoiceData, isEditing, editingInvoice?.id);

      onUpdateData(updated, {
        action: isEditing ? 'تعديل فاتورة مشتريات' : 'حفظ فاتورة مشتريات',
        module: 'المشتريات',
        details: `فاتورة مشتريات #${invNum} - المورد: ${defaultPartyName} - الصافي: ${totals.net.toFixed(2)} ج.م`,
      });

      showToast(`✅ تم حفظ وترحيل فاتورة المشتريات #${invNum} وتحديث الحسابات والمخزن بنجاح`, 'success');
      onClose();
    }
  };

  // Direct Print Call
  const handlePrint = () => {
    const defaultPartyName = isSale
      ? partyName.trim() || 'عميل نقدي'
      : partyName.trim() || 'مورد عام';

    const invObject: any = {
      id: invoiceId,
      date: invDate,
      time: invTime,
      type: selectedInvoiceType,
      customerName: defaultPartyName,
      supplierName: defaultPartyName,
      phone: partyPhone,
      items: invoiceItems.map((i) => ({
        name: i.name,
        qty: i.qty,
        price: i.price,
        total: i.total,
        spec: i.spec,
      })),
      total: totals.net,
      subtotal: totals.subtotal,
      discount: totals.discount,
      tax: totals.tax,
      paidAmount: totals.paid,
      remainingAmount: totals.remain,
      paymentMethod: paymentRows[0]?.method || 'drawer',
    };

    if (appData.settings) {
      printInvoiceWindow(invObject, isSale, appData.settings, showToast);
    }
  };

  return (
    <div
      className={
        isMaximized
          ? 'fixed inset-0 w-full min-h-screen h-full z-50 flex flex-col bg-white overflow-y-auto select-none'
          : 'fixed inset-0 w-full min-h-screen z-50 flex justify-center items-start sm:items-center p-1 sm:p-2.5 md:p-4 bg-slate-900/75 backdrop-blur-2xs overflow-y-auto select-none'
      }
      dir="rtl"
    >
      <div
        className={
          isMaximized
            ? 'w-full min-h-screen h-full bg-white flex flex-col relative text-slate-800'
            : 'w-full max-w-7xl mx-auto my-auto bg-white rounded-xl border-2 border-slate-300 shadow-2xl flex flex-col min-h-[580px] sm:min-h-[85vh] relative text-slate-800 transition-all overflow-hidden'
        }
      >
        {/* Header Title with distinct colors */}
        <div
          className={`text-white px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold flex justify-between items-center shrink-0 shadow-md bg-gradient-to-r ${theme.headerBg}`}
        >
          <div className="flex items-center gap-2">
            <span>
              {isSale ? 'منظومة المبيعات والفواتير والمخزون - ركيزة' : 'منظومة المشتريات والتوريد والمخزون - ركيزة'}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black shadow-xs ${theme.badgeColor}`}>
              {theme.badge}
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-[10px] sm:text-xs font-mono bg-black/20 px-2 py-0.5 rounded text-white/90">🕒 {liveClock}</span>
            <button
              type="button"
              onClick={() => setIsMaximized((prev) => !prev)}
              className="w-7 h-7 rounded-full hover:bg-white/20 active:bg-white/30 flex items-center justify-center text-white text-xs font-black cursor-pointer transition"
              title={isMaximized ? 'استعادة الحجم الطبيعي' : 'تكبير ملء الشاشة (Fullscreen)'}
            >
              {isMaximized ? '🗗' : '⛶'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-full hover:bg-white/20 active:bg-white/30 flex items-center justify-center text-white text-sm font-bold cursor-pointer transition"
              title="إغلاق"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Return Warning Banner if Return */}
        {isReturn && (
          <div className="bg-rose-100 border-b border-rose-300 text-rose-900 px-3 py-1.5 text-xs font-bold flex items-center justify-between shrink-0">
            <span>⚠️ فاتورة مرتجع (سيتم عكس القيد المحاسبي وحركة المخزون ورصيد الحساب تلقائياً)</span>
            <span className="font-mono bg-rose-200 px-2 py-0.5 rounded text-rose-950 font-black">إرجاع</span>
          </div>
        )}

        {/* Main Content Area */}
        <div className="p-2 sm:p-3 flex flex-col gap-2 flex-1 min-w-0">
          {/* Invoice Header Card - Responsive Grid that looks balanced on laptop, desktop and widescreen */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-12 gap-2 shrink-0">
            {/* رقم الفاتورة */}
            <div className="flex flex-col gap-0.5 col-span-1 lg:col-span-2 xl:col-span-1">
              <label className="text-[9px] sm:text-[10px] font-bold text-slate-600">رقم الفاتورة</label>
              <input
                type="text"
                value={invNum}
                readOnly
                className="bg-slate-100 border border-slate-300 rounded px-2 text-[10px] sm:text-xs h-[28px] font-bold text-slate-800"
              />
            </div>
            {/* التاريخ */}
            <div className="flex flex-col gap-0.5 col-span-1 lg:col-span-2 xl:col-span-2">
              <label className="text-[9px] sm:text-[10px] font-bold text-slate-600">التاريخ</label>
              <input
                type="date"
                value={invDate}
                onChange={(e) => setInvDate(e.target.value)}
                className="bg-white border border-slate-300 rounded px-1.5 text-[10px] sm:text-xs h-[28px] font-mono text-slate-800"
              />
            </div>
            {/* الوقت */}
            <div className="flex flex-col gap-0.5 col-span-1 lg:col-span-2 xl:col-span-1">
              <label className="text-[9px] sm:text-[10px] font-bold text-slate-600">الوقت</label>
              <input
                type="time"
                value={invTime}
                onChange={(e) => setInvTime(e.target.value)}
                className="bg-white border border-slate-300 rounded px-1.5 text-[10px] sm:text-xs h-[28px] font-mono text-slate-800"
              />
            </div>

            {/* Party Code */}
            <div className="flex flex-col gap-0.5 col-span-1 lg:col-span-2 xl:col-span-2">
              <label className="text-[9px] sm:text-[10px] font-bold text-slate-600">
                {isSale ? 'كود العميل' : 'كود المورد'}
              </label>
              <input
                type="text"
                value={partyCode}
                onChange={(e) => syncPartyByCode(e.target.value)}
                placeholder="الكود..."
                className="bg-white border border-slate-300 rounded px-2 text-[10px] sm:text-xs h-[28px] font-mono text-slate-800"
              />
            </div>

            {/* Party Name with Autocomplete */}
            <div className="flex flex-col gap-0.5 col-span-2 sm:col-span-2 md:col-span-2 lg:col-span-4 xl:col-span-3 relative">
              <label className="text-[9px] sm:text-[10px] font-bold text-slate-600">
                {isSale ? 'اسم العميل (بحث بالاسم)' : 'اسم المورد (بحث بالاسم)'}
              </label>
              <input
                type="text"
                value={partyName}
                onChange={(e) => {
                  setPartyName(e.target.value);
                  setShowNameDropdown(true);
                }}
                onFocus={() => setShowNameDropdown(true)}
                placeholder="اكتب للبحث عن العميل أو المورد..."
                className="bg-white border border-slate-300 rounded px-2 text-[10px] sm:text-xs h-[28px] text-slate-800 font-bold"
              />
              {showNameDropdown && (
                <div className="absolute top-full right-0 left-0 bg-white border border-blue-500 rounded-lg max-h-[160px] overflow-y-auto z-50 shadow-xl mt-1">
                  {filteredParties
                    .filter(
                      (p) =>
                        !partyName ||
                        p.name.toLowerCase().includes(partyName.toLowerCase()) ||
                        ((p as any).code && String((p as any).code).toLowerCase().includes(partyName.toLowerCase()))
                    )
                    .slice(0, 15)
                    .map((p) => (
                      <div
                        key={p.id}
                        onClick={() => selectParty(p)}
                        className="px-2.5 py-1.5 text-xs cursor-pointer hover:bg-blue-50 border-b border-slate-100 flex items-center justify-between"
                      >
                        <span className="font-bold text-slate-800">{p.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">({(p as any).code || p.id})</span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Party Phone */}
            <div className="flex flex-col gap-0.5 col-span-2 sm:col-span-2 md:col-span-2 lg:col-span-3 xl:col-span-3 relative">
              <label className="text-[9px] sm:text-[10px] font-bold text-slate-600">رقم الهاتف (بحث برقم الهاتف)</label>
              <input
                type="text"
                value={partyPhone}
                onChange={(e) => {
                  setPartyPhone(e.target.value);
                  setShowPhoneDropdown(true);
                }}
                onFocus={() => setShowPhoneDropdown(true)}
                placeholder="ابحث برقم الهاتف..."
                className="bg-white border border-slate-300 rounded px-2 text-[10px] sm:text-xs h-[28px] font-mono text-slate-800"
              />
              {showPhoneDropdown && (
                <div className="absolute top-full right-0 left-0 bg-white border border-blue-500 rounded-lg max-h-[160px] overflow-y-auto z-50 shadow-xl mt-1">
                  {filteredParties
                    .filter((p) => !partyPhone || (p.phone && p.phone.includes(partyPhone)))
                    .slice(0, 15)
                    .map((p) => (
                      <div
                        key={p.id}
                        onClick={() => selectParty(p)}
                        className="px-2.5 py-1.5 text-xs cursor-pointer hover:bg-blue-50 border-b border-slate-100 flex items-center justify-between"
                      >
                        <span className="font-bold text-slate-800">{p.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{p.phone}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Job site / statement */}
            <div className="flex flex-col gap-0.5 col-span-2 sm:col-span-3 md:col-span-4 lg:col-span-9 xl:col-span-9">
              <label className="text-[9px] sm:text-[10px] font-bold text-slate-600">البيان / جهة العمل أو ملاحظات الفاتورة</label>
              <input
                type="text"
                value={jobSite}
                onChange={(e) => setJobSite(e.target.value)}
                placeholder="بيان الفاتورة، موقع التسليم، أو أي شروط خاصة..."
                className="bg-white border border-slate-300 rounded px-2 text-[10px] sm:text-xs h-[28px] text-slate-800"
              />
            </div>

            {/* Account Status and Balance Banner */}
            <div className="col-span-full text-xs font-bold bg-amber-50/80 border border-amber-200 px-3 py-1.5 rounded-md flex flex-wrap justify-between items-center text-slate-800">
              <span className="flex items-center gap-1.5">
                <span>حالة الحساب:</span>
                <strong className="px-2 py-0.5 rounded text-[11px]" style={{ color: partyBalanceInfo.color }}>
                  {partyBalanceInfo.typeText}
                </strong>
              </span>
              <span className="flex items-center gap-1.5">
                <span>الرصيد المالي الحالي (له / عليه):</span>
                <strong className="text-sm font-mono" style={{ color: partyBalanceInfo.color }}>
                  {partyBalanceInfo.balanceVal}
                </strong>
                <span>ج.م</span>
              </span>
            </div>
          </div>

          {/* Pricing System and Quick Invoice Type Switcher Bar */}
          <div className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg flex flex-wrap items-center justify-between shrink-0 gap-2">
            <div className="flex items-center gap-2">
              <label className="text-slate-800 text-xs font-black">نظام التسعير المطبق:</label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setInvoicePriceType('cash')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer shadow-xs ${
                    currentInvoicePriceType === 'cash'
                      ? 'bg-emerald-600 text-white border border-emerald-700'
                      : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  💵 سعر نقدي (قطاعي)
                </button>
                <button
                  type="button"
                  onClick={() => setInvoicePriceType('wholesale')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer shadow-xs ${
                    currentInvoicePriceType === 'wholesale'
                      ? 'bg-indigo-600 text-white border border-indigo-700'
                      : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  🏷️ سعر جملة
                </button>
                <button
                  type="button"
                  onClick={() => setInvoicePriceType('buy')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer shadow-xs ${
                    currentInvoicePriceType === 'buy'
                      ? 'bg-teal-700 text-white border border-teal-800'
                      : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  🛒 سعر شراء / تكلفة
                </button>
              </div>
            </div>

            {/* Quick Invoice Type Switcher */}
            <div className="flex items-center gap-1.5">
              <label className="text-slate-700 text-xs font-bold">نوع السداد:</label>
              <select
                value={selectedInvoiceType}
                onChange={(e) => setSelectedInvoiceType(e.target.value as any)}
                className="bg-white border border-slate-300 rounded-md px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-xs"
              >
                <option value="nagdi">نقدي (كاش فوري)</option>
                <option value="ajel">آجل (ذمم وحسابات)</option>
                <option value="return_nagdi">مرتجع نقدي (صرف فوري)</option>
                <option value="return_ajel">مرتجع آجل (تسوية حساب)</option>
              </select>
            </div>
          </div>

          {/* Quick Search / Barcode Scanner Row + Action Buttons */}
          <div className="bg-slate-100 border border-slate-300 p-2 sm:p-2.5 rounded-lg flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
            {/* Quick Barcode / Name Input */}
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="🔍 ابحث بالاسم أو امسح الباركود واضغط Enter لإدراج الصنف فوراً..."
                value={quickSearchText}
                onChange={(e) => {
                  setQuickSearchText(e.target.value);
                  setShowQuickDropdown(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleQuickSearchEnter();
                  }
                }}
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs sm:text-sm text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-xs"
              />
              {showQuickDropdown && quickSearchText.trim() && (
                <div className="absolute top-full right-0 left-0 bg-white border border-blue-500 rounded-lg max-h-[200px] overflow-y-auto z-50 shadow-2xl mt-1">
                  {(appData.items || [])
                    .filter(
                      (i) =>
                        i.name.toLowerCase().includes(quickSearchText.toLowerCase()) ||
                        (i.code && i.code.toLowerCase().includes(quickSearchText.toLowerCase()))
                    )
                    .slice(0, 10)
                    .map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleQuickAddFromSearch(item)}
                        className="px-3 py-2 text-xs cursor-pointer hover:bg-blue-50 border-b border-slate-100 flex items-center justify-between"
                      >
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">{item.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">باركود: {item.code || '-'} | الرصيد: {item.quantity || 0}</span>
                        </div>
                        <div className="text-left font-mono font-bold text-emerald-700">
                          {currentInvoicePriceType === 'wholesale'
                            ? (item.wholesalePrice || item.price || 0)
                            : currentInvoicePriceType === 'buy' || !isSale
                            ? (item.costPrice || item.purchasePrice || item.price || 0)
                            : (item.salePrice || item.price || 0)}{' '}
                          ج.م
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsLookupModalOpen(true)}
                className="px-3 sm:px-4 py-2 text-white rounded-md text-xs sm:text-sm font-bold cursor-pointer flex items-center gap-1.5 shadow-xs transition hover:brightness-110"
                style={{ backgroundColor: themeSecondary }}
              >
                <span>📦</span>
                <span>دليل الأصناف الشامل</span>
              </button>
              <button
                type="button"
                onClick={() => setIsOptionsModalOpen(true)}
                className="px-3 sm:px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-md text-xs sm:text-sm font-bold cursor-pointer flex items-center gap-1.5 shadow-xs transition"
              >
                <span>⚙️</span>
                <span>الخصم، الضريبة والدفع</span>
              </button>
            </div>
          </div>

          {/* 🗑️ Bulk Selection & Delete Action Bar (يظهر عند التحديد أو الضغط المطول) */}
          {selectedRowIds.size > 0 && (
            <div className="bg-rose-50 border-2 border-rose-300 px-3 py-2 rounded-lg flex flex-wrap items-center justify-between gap-2 shrink-0 animate-fade-in shadow-xs">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs font-black">
                  {selectedRowIds.size}
                </span>
                <span className="text-xs font-black text-rose-950">
                  تم تحديد {selectedRowIds.size} من أصل {invoiceItems.length} صنف (اضغط مطولاً على أي صنف لإضافته أو إلغائه)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-md text-xs font-black cursor-pointer shadow-xs transition flex items-center gap-1.5"
                  title="حذف جميع الأصناف المحددة"
                >
                  <span>🗑️</span>
                  <span>حذف المحددة ({selectedRowIds.size})</span>
                </button>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-md text-xs font-bold cursor-pointer transition"
                >
                  {selectedRowIds.size === invoiceItems.length ? 'إلغاء تحديد الكل' : 'تحديد كل الأصناف'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRowIds(new Set())}
                  className="px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-md text-xs font-bold cursor-pointer transition"
                >
                  ✕ إلغاء التحديد
                </button>
              </div>
            </div>
          )}

          {/* Table Responsive of Items - توزيع دقيق للأعمدة ومنع التداخل */}
          <div className="w-full flex-1 min-h-[220px] max-h-[48vh] overflow-x-auto overflow-y-auto border border-slate-300 rounded-lg bg-white shadow-xs">
            <table className="w-full border-collapse text-xs sm:text-sm text-center">
              <thead className="bg-slate-100 text-slate-800 font-bold sticky top-0 z-10 border-b border-slate-300">
                <tr>
                  <th className="p-2 border border-slate-300 w-9 sm:w-10 text-center font-bold">
                    <input
                      type="checkbox"
                      checked={invoiceItems.length > 0 && selectedRowIds.size === invoiceItems.length}
                      onChange={handleSelectAll}
                      className="cursor-pointer rounded border-slate-300"
                      title="تحديد كل الأصناف"
                    />
                  </th>
                  <th className="p-2 border border-slate-300 w-9 sm:w-10 text-center font-bold text-slate-600">م</th>
                  <th className="p-2 border border-slate-300 w-20 sm:w-24 font-mono text-center font-bold text-slate-700 text-xs">الباركود</th>
                  {/* توسيع عمود اسم الصنف لضمان ظهوره بالكامل وبوضوح تام على الشاشة */}
                  <th className="p-2 border border-slate-300 min-w-[280px] lg:min-w-[380px] text-right font-black text-slate-900">
                    <span>اسم الصنف</span>
                    <span className="text-[10px] text-slate-500 font-normal mr-1.5 hidden sm:inline">(نقر: تعديل | ضغط مطول: تحديد)</span>
                  </th>
                  {/* تقليل عرض عمود البيان */}
                  <th className="p-2 border border-slate-300 w-28 sm:w-36 text-right font-bold text-slate-800">البيان</th>
                  {/* تصغير عمود العدد */}
                  <th className="p-2 border border-slate-300 w-14 sm:w-18 text-center font-bold text-slate-800">العدد</th>
                  {/* تصغير عمود السعر */}
                  <th className="p-2 border border-slate-300 w-18 sm:w-22 text-center font-bold text-slate-800">السعر</th>
                  {/* تصغير عمود الإجمالي */}
                  <th className="p-2 border border-slate-300 w-20 sm:w-26 text-center font-black text-slate-900">الإجمالي</th>
                  <th className="p-2 border border-slate-300 w-14 sm:w-16 text-center font-bold text-slate-800">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {invoiceItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-slate-400 p-10 text-center text-xs sm:text-sm bg-white">
                      لم يتم إدراج أصناف بعد (استخدم البحث السريع أعلاه أو اضغط "دليل الأصناف الشامل")
                    </td>
                  </tr>
                ) : (
                  invoiceItems.map((item, index) => {
                    const isSelected = selectedRowIds.has(item.rowId);
                    return (
                      <tr
                        key={item.rowId}
                        onPointerDown={(e) => handlePointerDown(item.rowId, e)}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                        onPointerMove={handlePointerMove}
                        onClick={(e) => handleRowClick(index, item.rowId, e)}
                        className={`border-b transition-colors cursor-pointer select-none ${
                          isSelected
                            ? 'bg-blue-100/90 border-blue-400 font-bold'
                            : 'hover:bg-blue-50/70 border-slate-200 bg-white'
                        }`}
                        title="نقر فردي: فتح كارت التعديل التفصيلي | ضغط مطول: تحديد الصنف للحذف"
                      >
                        {/* مربع التحديد */}
                        <td className="p-2 border border-slate-200 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => toggleSelectRow(item.rowId, e as any)}
                            className="cursor-pointer rounded border-slate-300"
                          />
                        </td>
                        {/* الرقم التسلسلي */}
                        <td className="p-2 border border-slate-200 font-mono font-bold text-slate-600 text-xs">
                          {index + 1}
                        </td>
                        {/* الباركود */}
                        <td className="p-2 border border-slate-200 font-mono text-slate-700 text-xs">
                          {item.code || '-'}
                        </td>
                        {/* اسم الصنف - كامل وبوضوح تام بدون اقتطاع */}
                        <td className="p-2 border border-slate-200 text-right font-black text-slate-900 break-words leading-relaxed">
                          <div className="flex items-center gap-1.5">
                            {isSelected && <span className="text-blue-600 shrink-0">✓</span>}
                            <span>{item.name}</span>
                          </div>
                        </td>
                        {/* البيان - مقلل العرض مع إمكانية عرض التول تيب */}
                        <td
                          className="p-2 border border-slate-200 text-right text-slate-600 truncate max-w-[140px] text-xs font-normal"
                          title={item.spec || ''}
                        >
                          {item.spec || '-'}
                        </td>
                        {/* العدد - مصغر */}
                        <td className="p-2 border border-slate-200 font-mono font-bold text-slate-900 text-center">
                          {item.qty}
                        </td>
                        {/* السعر - مصغر */}
                        <td className="p-2 border border-slate-200 font-mono font-bold text-slate-900 text-center">
                          {item.price.toFixed(2)}
                        </td>
                        {/* الإجمالي - مصغر */}
                        <td className="p-2 border border-slate-200 font-mono font-black text-emerald-800 text-center">
                          {item.total.toFixed(2)}
                        </td>
                        {/* إجراء */}
                        <td className="p-1.5 border border-slate-200" onClick={(e) => e.stopPropagation()}>
                          <div className="inline-flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => openModifyModal(index)}
                              className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded cursor-pointer transition"
                              title="كارت التعديل التفصيلي"
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              onClick={() => removeItemFromInvoice(index)}
                              className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-100 rounded cursor-pointer transition"
                              title="حذف هذا الصنف"
                            >
                              🗑️
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
        </div>

        {/* Bottom Fixed Area - Clean, Light & Zero Dark/Black Shading */}
        <div className="shrink-0 flex flex-col gap-1.5 bg-slate-50 p-2 sm:p-3 border-t border-slate-200 sticky bottom-0 z-20">
          {/* Summary Box - Clean White Cards with Crisp Borders */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 bg-white border border-slate-300 p-2 sm:p-2.5 rounded-lg text-center shadow-xs">
            <div className="bg-slate-50 border border-slate-200 p-1.5 sm:p-2 rounded-md flex flex-col items-center justify-center">
              <span className="text-[10px] sm:text-xs font-bold text-slate-600">إجمالي الكميات</span>
              <span className="font-bold text-slate-900 text-xs sm:text-base font-mono mt-0.5">{totals.totalQty.toFixed(2)}</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-1.5 sm:p-2 rounded-md flex flex-col items-center justify-center">
              <span className="text-[10px] sm:text-xs font-bold text-slate-600">الخصومات</span>
              <span className="font-bold text-rose-600 text-xs sm:text-base font-mono mt-0.5">{totals.discount.toFixed(2)}</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-1.5 sm:p-2 rounded-md flex flex-col items-center justify-center">
              <span className="text-[10px] sm:text-xs font-bold text-slate-600">الضرائب</span>
              <span className="font-bold text-blue-600 text-xs sm:text-base font-mono mt-0.5">{totals.tax.toFixed(2)}</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-1.5 sm:p-2 rounded-md flex flex-col items-center justify-center">
              <span className="text-[10px] sm:text-xs font-bold text-slate-600">الإيراد / الرسوم</span>
              <span className="font-bold text-purple-600 text-xs sm:text-base font-mono mt-0.5">{totals.extra.toFixed(2)}</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-1.5 sm:p-2 rounded-md flex flex-col items-center justify-center">
              <span className="text-[10px] sm:text-xs font-bold text-slate-600">المدفوع</span>
              <span className="font-bold text-emerald-700 text-xs sm:text-base font-mono mt-0.5">{totals.paid.toFixed(2)}</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-1.5 sm:p-2 rounded-md flex flex-col items-center justify-center">
              <span className="text-[10px] sm:text-xs font-bold text-slate-600">المتبقي</span>
              <span className="font-bold text-amber-700 text-xs sm:text-base font-mono mt-0.5">{totals.remain.toFixed(2)}</span>
            </div>
            <div className="col-span-full bg-emerald-50 border border-emerald-400 p-2 sm:p-3 rounded-lg text-emerald-950 font-bold text-xs sm:text-sm md:text-base flex justify-between items-center px-4 sm:px-6 shadow-xs">
              <span className="font-bold text-slate-900">الصافي النهائي للفاتورة:</span>
              <span className="text-emerald-700 text-base sm:text-xl font-mono font-black">{totals.net.toFixed(2)} ج.م</span>
            </div>
          </div>

          {/* Action Button Bar */}
          <div className="flex gap-2 mt-0.5">
            <button
              type="button"
              onClick={handleSaveAndPostInvoice}
              className="flex-1 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-black text-white cursor-pointer shadow-md transition hover:brightness-110 flex items-center justify-center gap-1.5"
              style={{ backgroundColor: themeAccent }}
            >
              <span>💾 حفظ وترحيل الحسابات والمخزن</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="py-2 sm:py-2.5 px-5 rounded-lg text-xs sm:text-sm font-bold text-white cursor-pointer shadow-md transition hover:brightness-110 flex items-center justify-center gap-1.5"
              style={{ backgroundColor: themeSecondary }}
            >
              <span>🖨️ طباعة</span>
            </button>
          </div>
        </div>
      </div>

      {/* ⚙️ نافذة الإيرادات الإضافية والخصومات وطرق الدفع (Options, Revenue & Multi-Payment Modal) */}
      {isOptionsModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs z-[60] flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white w-full max-w-lg max-h-[90vh] rounded-xl border-2 border-slate-400 shadow-2xl flex flex-col overflow-hidden text-slate-800 my-auto">
            {/* Header */}
            <div
              className={`text-white px-4 py-2.5 text-xs sm:text-sm font-black flex justify-between items-center bg-gradient-to-r ${theme.headerBg} shadow-sm`}
            >
              <div className="flex items-center gap-2">
                <span>⚙️</span>
                <span>نافذة الإيرادات الإضافية، الخصومات ووسائل الدفع</span>
              </div>
              <button
                type="button"
                onClick={() => setIsOptionsModalOpen(false)}
                className="w-7 h-7 rounded-full hover:bg-white/20 active:bg-white/30 flex items-center justify-center text-white text-sm font-bold cursor-pointer transition"
                title="إغلاق"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-3 sm:p-4 flex flex-col gap-3.5 text-xs overflow-y-auto">
              {/* قسم 1: الإيرادات الإضافية والرسوم */}
              <div className="bg-purple-50/70 border border-purple-200 rounded-lg p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-purple-950 text-xs flex items-center gap-1.5">
                    <span>💰</span>
                    <span>الإيرادات الإضافية والرسوم (شحن، تركيب، خدمات خاصة)</span>
                  </span>
                  <span className="text-[10px] text-purple-700 font-bold">تُضاف لصافي الفاتورة</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-700">اسم أو بيان الإيراد / الخدمة</label>
                    <input
                      type="text"
                      value={extraIncomeName}
                      onChange={(e) => setExtraIncomeName(e.target.value)}
                      placeholder="مثال: مصاريف شحن ونقل، تركيب، صيانة..."
                      className="border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-700">مبلغ الإيراد (ج.م)</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        value={extraIncomeVal}
                        onChange={(e) => setExtraIncomeVal(e.target.value)}
                        placeholder="0.00"
                        className="w-full border border-slate-300 rounded-md px-2.5 pl-10 py-1.5 text-xs font-mono font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <span className="absolute left-2.5 top-1.5 text-[10px] text-slate-500 font-bold">ج.م</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* قسم 2: الخصومات والضرائب */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-col gap-3">
                <span className="font-black text-slate-800 text-xs flex items-center gap-1.5">
                  <span>🏷️</span>
                  <span>الخصم والضريبة على إجمالي الفاتورة</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* الخصم الكلي */}
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-slate-700">خصم الفاتورة</label>
                      <div className="flex border border-blue-600 rounded overflow-hidden h-[22px] w-[86px]">
                        <button
                          type="button"
                          onClick={() => setInvDiscType('val')}
                          className={`flex-1 text-[9px] font-bold cursor-pointer transition ${
                            invDiscType === 'val' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600'
                          }`}
                        >
                          ج.م
                        </button>
                        <button
                          type="button"
                          onClick={() => setInvDiscType('percent')}
                          className={`flex-1 text-[9px] font-bold cursor-pointer transition ${
                            invDiscType === 'percent' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600'
                          }`}
                        >
                          %
                        </button>
                      </div>
                    </div>
                    <input
                      type="number"
                      step="any"
                      value={globalInvDisc}
                      onChange={(e) => setGlobalInvDisc(e.target.value)}
                      placeholder="أدخل قيمة أو نسبة الخصم..."
                      className="border border-slate-300 rounded-md px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 bg-white"
                    />
                  </div>

                  {/* الضريبة الكلية */}
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-slate-700">ضريبة القيمة المضافة</label>
                      <div className="flex border border-blue-600 rounded overflow-hidden h-[22px] w-[86px]">
                        <button
                          type="button"
                          onClick={() => setInvTaxType('percent')}
                          className={`flex-1 text-[9px] font-bold cursor-pointer transition ${
                            invTaxType === 'percent' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600'
                          }`}
                        >
                          %
                        </button>
                        <button
                          type="button"
                          onClick={() => setInvTaxType('val')}
                          className={`flex-1 text-[9px] font-bold cursor-pointer transition ${
                            invTaxType === 'val' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600'
                          }`}
                        >
                          ج.م
                        </button>
                      </div>
                    </div>
                    <input
                      type="number"
                      step="any"
                      value={globalInvTax}
                      onChange={(e) => setGlobalInvTax(e.target.value)}
                      placeholder="أدخل قيمة أو نسبة الضريبة..."
                      className="border border-slate-300 rounded-md px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* قسم 3: وسائل الدفع والتحصيل المتعددة */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-3 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="font-black text-emerald-950 text-xs flex items-center gap-1.5">
                    <span>💳</span>
                    <span>وسائل التحصيل والدفع المتعددة</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => addPaymentRow('نقدي / كاش', totals.net)}
                    className="px-2.5 py-1 text-[10px] font-black text-white bg-emerald-700 hover:bg-emerald-800 rounded-md cursor-pointer transition flex items-center gap-1 shadow-xs"
                  >
                    <span>+</span>
                    <span>إضافة وسيلة دفع</span>
                  </button>
                </div>

                <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto">
                  {paymentRows.length === 0 ? (
                    <div className="text-slate-500 text-[11px] text-center py-2">
                      لا توجد أسطر دفع محددة (سيتم احتساب الدفع نقداً تلقائياً عند الحفظ للفاتورة النقدية)
                    </div>
                  ) : (
                    paymentRows.map((r) => (
                      <div key={r.id} className="flex gap-2 items-center bg-white border border-slate-200 p-1.5 rounded-md">
                        <select
                          value={r.method}
                          onChange={(e) => updatePaymentRow(r.id, 'method', e.target.value)}
                          className="h-[28px] w-[130px] text-xs font-bold border border-slate-300 rounded px-1.5 bg-white text-slate-800"
                        >
                          <option value="نقدي / كاش">💵 نقدي / كاش</option>
                          <option value="انستاباي Instapay">⚡ إنستاباي Instapay</option>
                          <option value="فودافون كاش">📱 فودافون كاش</option>
                          <option value="فيزا / كارت">💳 فيزا / شبكة</option>
                          <option value="حساب بنكي">🏦 حساب بنكي</option>
                        </select>
                        <div className="relative flex-1">
                          <input
                            type="number"
                            step="any"
                            value={r.amount || ''}
                            onChange={(e) => updatePaymentRow(r.id, 'amount', e.target.value)}
                            className="h-[28px] w-full text-xs font-mono font-bold border border-slate-300 rounded px-2 text-slate-900"
                            placeholder="المبلغ المدفوع..."
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removePaymentRow(r.id)}
                          className="w-7 h-[28px] text-rose-600 hover:bg-rose-50 rounded flex items-center justify-center font-bold text-xs cursor-pointer"
                          title="حذف هذا الدفع"
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Net Summary and Save */}
              <div className="flex items-center justify-between bg-slate-100 border border-slate-300 px-3 py-2 rounded-lg font-bold">
                <span className="text-slate-700">الصافي بعد التعديل:</span>
                <span className="text-emerald-700 text-sm font-mono font-black">{totals.net.toFixed(2)} ج.م</span>
              </div>

              <button
                type="button"
                onClick={() => setIsOptionsModalOpen(false)}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs sm:text-sm font-bold cursor-pointer transition shadow-xs flex items-center justify-center gap-1.5"
              >
                <span>✓</span>
                <span>تأكيد وحفظ التعديلات</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📦 نافذة دليل الأصناف الشامل (Lookup Modal - Centered & Responsive) */}
      {isLookupModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs z-[60] flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="bg-slate-100 w-full max-w-4xl max-h-[90vh] min-h-[500px] rounded-xl border-2 border-slate-400 shadow-2xl flex flex-col overflow-hidden text-slate-800 my-auto">
            {/* Header */}
            <div
              className={`text-white px-4 py-2.5 text-xs sm:text-sm font-black flex justify-between items-center shrink-0 shadow-sm bg-gradient-to-r ${theme.headerBg}`}
            >
              <div className="flex items-center gap-2">
                <span>📦</span>
                <span>دليل الأصناف الشامل (اختر صنفاً للإضافة السريعة للفاتورة)</span>
              </div>
              <button
                type="button"
                onClick={() => setIsLookupModalOpen(false)}
                className="w-7 h-7 rounded-full hover:bg-white/20 active:bg-white/30 flex items-center justify-center text-white text-sm font-bold cursor-pointer transition"
                title="إغلاق"
              >
                ✕
              </button>
            </div>

            {/* Content Area */}
            <div className="flex flex-1 p-2 gap-2 overflow-hidden">
              {/* Categories Sidebar */}
              <div className="w-[120px] sm:w-[150px] bg-white border border-slate-300 rounded-lg flex flex-col overflow-hidden shrink-0 shadow-xs">
                <div className="bg-slate-100 p-2 text-xs font-black border-b border-slate-200 flex flex-col items-center gap-1.5">
                  <span className="text-slate-800">التصنيفات</span>
                  <button
                    type="button"
                    onClick={openNewItemDialog}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold py-1.5 cursor-pointer shadow-xs transition"
                  >
                    + صنف جديد
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                  <div
                    onClick={() => setSelectedLookupCategory('all')}
                    className={`p-2 text-xs font-bold cursor-pointer text-center transition ${
                      selectedLookupCategory === 'all'
                        ? 'bg-blue-600 text-white font-black'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    الكل ({appData.items?.length || 0})
                  </div>
                  {categoriesList.map((cat) => (
                    <div
                      key={cat}
                      onClick={() => setSelectedLookupCategory(cat)}
                      className={`p-2 text-xs font-bold cursor-pointer text-center truncate transition ${
                        selectedLookupCategory === cat
                          ? 'bg-blue-600 text-white font-black'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                      title={cat}
                    >
                      {cat}
                    </div>
                  ))}
                </div>
              </div>

              {/* Items Cards Panel */}
              <div className="flex-1 bg-white border border-slate-300 rounded-lg flex flex-col p-2 gap-2 overflow-hidden shadow-xs">
                {/* Search Bar */}
                <div className="bg-slate-50 p-2 border border-slate-300 rounded-lg flex items-center shrink-0">
                  <input
                    type="text"
                    value={lookupSearch}
                    onChange={(e) => setLookupSearch(e.target.value)}
                    placeholder="🔍 ابحث في دليل الأصناف بالاسم، الكود، أو الباركود..."
                    className="w-full text-xs font-semibold bg-transparent border-none outline-none px-1 text-slate-900"
                  />
                </div>

                {/* Items Grid/List */}
                <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 p-0.5">
                  {(appData.items || [])
                    .filter((item) => {
                      if (selectedLookupCategory !== 'all' && item.category !== selectedLookupCategory) return false;
                      if (!lookupSearch) return true;
                      const q = lookupSearch.toLowerCase().trim();
                      return item.name.toLowerCase().includes(q) || (item.code && item.code.toLowerCase().includes(q));
                    })
                    .map((item) => {
                      const stock = Number(item.quantity ?? 0);
                      const isLow = stock <= 0;
                      return (
                        <div
                          key={item.id}
                          onClick={() => quickAddItemToInvoice(item)}
                          className={`bg-white border rounded-lg p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer shadow-xs hover:border-blue-600 hover:bg-blue-50/40 transition ${
                            isLow ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200'
                          }`}
                        >
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-900 text-xs sm:text-sm">{item.name}</span>
                              <span className="text-[10px] text-slate-500 font-mono">({item.category || 'عامة'})</span>
                            </div>
                            <span className="text-blue-700 text-[10px] font-mono mt-0.5">كود / باركود: {item.code || item.id}</span>
                          </div>

                          <div className="flex items-center gap-2 text-xs font-mono shrink-0">
                            <div className="bg-slate-50 px-2 py-1 rounded border border-slate-200 text-center">
                              <span className="block text-[8px] text-slate-500 font-sans">المتاح</span>
                              <strong className={`${isLow ? 'text-rose-600' : 'text-blue-700'}`}>{stock}</strong>
                            </div>
                            <div className="bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 text-center">
                              <span className="block text-[8px] text-emerald-800 font-sans">سعر الفاتورة</span>
                              <strong className="text-emerald-800 font-black">
                                {Number(
                                  currentInvoicePriceType === 'wholesale'
                                    ? item.wholesalePrice || item.price || 0
                                    : currentInvoicePriceType === 'buy' || !isSale
                                    ? item.costPrice || item.purchasePrice || item.price || 0
                                    : item.salePrice || item.price || 0
                                ).toFixed(2)}{' '}
                                ج.م
                              </strong>
                            </div>
                            <button
                              type="button"
                              className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold transition shadow-xs"
                            >
                              + إضافة
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 📋 كارت التعديل التفصيلي للصنف في الفاتورة (Item Detailed Edit Card Modal - Centered & Responsive) */}
      {isModifyModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs z-[60] flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white w-full max-w-lg md:max-w-xl max-h-[92vh] rounded-xl border-2 border-slate-400 shadow-2xl flex flex-col overflow-hidden text-slate-800 my-auto">
            {/* Header */}
            <div
              className={`text-white px-4 py-2.5 text-xs sm:text-sm font-black flex justify-between items-center bg-gradient-to-r ${theme.headerBg} shadow-sm`}
            >
              <div className="flex items-center gap-2">
                <span>📋</span>
                <span>كارت التعديل التفصيلي للصنف</span>
              </div>
              <button
                type="button"
                onClick={() => setIsModifyModalOpen(false)}
                className="w-7 h-7 rounded-full hover:bg-white/20 active:bg-white/30 flex items-center justify-center text-white text-sm font-bold cursor-pointer transition"
                title="إغلاق"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-3 sm:p-4 flex flex-col gap-3 overflow-y-auto">
              {/* Item Info Card Banner */}
              <div className="bg-slate-50 border border-slate-300 rounded-lg p-2.5 flex items-center justify-between">
                <div>
                  <div className="font-black text-slate-900 text-sm sm:text-base">{modifyName}</div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                    الباركود / الكود: {modifyCode || 'بدون باركود'}
                  </div>
                </div>
                {modifyStock !== null && (
                  <div className="text-left bg-white border border-slate-300 px-2.5 py-1 rounded-md shadow-xs">
                    <span className="text-[10px] text-slate-500 block font-bold">المتاح بالمخزن</span>
                    <span
                      className={`text-xs font-black font-mono ${
                        modifyStock <= 0 ? 'text-rose-600' : 'text-emerald-700'
                      }`}
                    >
                      {modifyStock} وحدة
                    </span>
                  </div>
                )}
              </div>

              {/* Editable Fields Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* اسم الصنف */}
                <div className="col-span-full flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-700">اسم الصنف في الفاتورة</label>
                  <input
                    type="text"
                    value={modifyName}
                    onChange={(e) => setModifyName(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* الكمية مع أزرار الزيادة والنقصان السريعة */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-700">الكمية (العدد)</label>
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => {
                        const q = Math.max(1, (parseFloat(modifyQty) || 0) - 1);
                        setModifyQty(String(q));
                      }}
                      className="w-9 h-[34px] bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-800 font-black rounded-r-lg border border-slate-300 cursor-pointer flex items-center justify-center text-sm"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      step="any"
                      value={modifyQty}
                      onChange={(e) => setModifyQty(e.target.value)}
                      className="flex-1 h-[34px] text-center font-mono font-bold text-slate-900 border-y border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const q = (parseFloat(modifyQty) || 0) + 1;
                        setModifyQty(String(q));
                      }}
                      className="w-9 h-[34px] bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-800 font-black rounded-l-lg border border-slate-300 cursor-pointer flex items-center justify-center text-sm"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* السعر */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-700">سعر الوحدة (ج.م)</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      value={modifyPrice}
                      onChange={(e) => setModifyPrice(e.target.value)}
                      className="w-full h-[34px] border border-slate-300 rounded-lg px-3 pl-12 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="absolute left-3 top-2 text-[10px] text-slate-500 font-bold">ج.م</span>
                  </div>
                </div>

                {/* البيان / ملاحظات الصنف */}
                <div className="col-span-full flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-700">البيان / الوصف وملاحظات الصنف</label>
                  <input
                    type="text"
                    value={modifySpec}
                    onChange={(e) => setModifySpec(e.target.value)}
                    placeholder="ملاحظات تشغيلية، مقاسات، ألوان، أو شروط خاصة بالصنف..."
                    className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Total Preview Banner */}
                <div className="col-span-full bg-emerald-50 border border-emerald-300 rounded-lg p-2.5 flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-950">إجمالي هذا الصنف:</span>
                  <div className="flex items-center gap-1 font-mono text-emerald-800">
                    <span className="text-xs">({modifyQty || 0} × {modifyPrice || 0}) =</span>
                    <strong className="text-base font-black">
                      {((parseFloat(modifyQty) || 0) * (parseFloat(modifyPrice) || 0)).toFixed(2)} ج.م
                    </strong>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={deleteCurrentModifiedItem}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 border border-rose-300 rounded-lg text-xs font-bold cursor-pointer transition flex items-center justify-center gap-1"
                >
                  <span>🗑️</span>
                  <span>حذف هذا الصنف</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModifyModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer transition flex-1 sm:flex-initial"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={saveModifiedItem}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs sm:text-sm font-bold cursor-pointer transition shadow-xs flex-1 sm:flex-initial flex items-center justify-center gap-1"
                  >
                    <span>✓</span>
                    <span>حفظ التعديلات والرجوع</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ➕ نافذة إضافة صنف جديد للمخزون (New Item Modal - Centered & Responsive) */}
      {isNewItemModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs z-[60] flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white w-full max-w-lg max-h-[90vh] rounded-xl border-2 border-slate-400 shadow-2xl flex flex-col overflow-hidden text-slate-800 my-auto">
            <div
              className={`text-white px-4 py-2.5 text-xs sm:text-sm font-black flex justify-between items-center bg-gradient-to-r ${theme.headerBg} shadow-sm`}
            >
              <span>➕ إضافة صنف جديد للمخزون وإدراجه بالفاتورة</span>
              <button
                type="button"
                onClick={() => setIsNewItemModalOpen(false)}
                className="w-7 h-7 rounded-full hover:bg-white/20 active:bg-white/30 flex items-center justify-center text-white text-sm font-bold cursor-pointer transition"
              >
                ✕
              </button>
            </div>
            <div className="p-3 sm:p-4 flex flex-col gap-3 text-xs overflow-y-auto">
              <div className="bg-blue-50 text-blue-900 p-2 rounded-lg text-xs font-bold border border-blue-200">
                💡 سيتم إنشاء الصنف في المخزن العام وتحديد أسعاره، ثم إضافته للفاتورة الحالية فوراً.
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="col-span-full flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-700">اسم الصنف الجديد *</label>
                  <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="مثال: لاب توب ديل، شاشة توشيبا..."
                    className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-bold text-slate-900"
                  />
                </div>
                <div className="col-span-full flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-700">كود / باركود الصنف (تلقائي)</label>
                  <input
                    type="text"
                    value={newItemCode}
                    readOnly
                    className="bg-slate-100 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-slate-700"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-700">سعر الشراء الأساسي (ج.م)</label>
                  <input
                    type="number"
                    value={newItemBuyPrice}
                    onChange={(e) => {
                      setNewItemBuyPrice(e.target.value);
                      handleCalculateMargins(
                        parseFloat(e.target.value) || 0,
                        parseFloat(newItemCashMargin) || 0,
                        parseFloat(newItemWholesaleMargin) || 0
                      );
                    }}
                    placeholder="0.00"
                    className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-900"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-700">المجموعة / التصنيف</label>
                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800"
                  >
                    {categoriesList.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-700">سعر البيع النقدي (قطاعي)</label>
                  <input
                    type="number"
                    value={newItemCashPriceManual}
                    onChange={(e) => setNewItemCashPriceManual(e.target.value)}
                    placeholder="0.00"
                    className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-900 font-bold"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-700">سعر البيع جملة</label>
                  <input
                    type="number"
                    value={newItemWholesalePriceManual}
                    onChange={(e) => setNewItemWholesalePriceManual(e.target.value)}
                    placeholder="0.00"
                    className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-900 font-bold"
                  />
                </div>
                <div className="col-span-full flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-700">الكمية الابتدائية بالمخزون</label>
                  <input
                    type="number"
                    value={newItemStockQty}
                    onChange={(e) => setNewItemStockQty(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-900"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={saveNewItemToInventory}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs sm:text-sm font-bold cursor-pointer mt-2 shadow-xs transition"
              >
                ✓ حفظ وإضافة للفاتورة مباشرة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
