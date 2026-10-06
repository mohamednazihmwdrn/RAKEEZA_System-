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

  // 🏛️ Invoice Types & Pricing Type States
  const [selectedInvoiceType, setSelectedInvoiceType] = useState<'nagdi' | 'ajel' | 'return_nagdi' | 'return_ajel'>(
    editingInvoice?.type || initialInvoiceType || 'nagdi'
  );

  const isReturn = selectedInvoiceType.startsWith('return_');

  const [currentInvoicePriceType, setCurrentInvoicePriceType] = useState<'cash' | 'wholesale' | 'buy'>(
    pricingType || (mode === 'purchase' ? 'buy' : 'cash')
  );

  // Fullscreen / Window Maximized State
  const [isMaximized, setIsMaximized] = useState(false);

  // Live Time
  const [liveTime, setLiveTime] = useState('00:00');
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setLiveTime(d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

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

  // Party State (Customer in Sales, Supplier in Purchases)
  const [custCode, setCustCode] = useState<string>(
    isSale ? (editingInvoice as any)?.customerCode || '1' : (editingInvoice as any)?.supplierCode || '1'
  );
  const [custName, setCustName] = useState<string>(
    isSale ? (editingInvoice as SaleInvoice)?.customerName || '' : (editingInvoice as PurchaseInvoice)?.supplierName || ''
  );
  const [custPhone, setCustPhone] = useState<string>(editingInvoice?.phone || '');
  const [jobSite, setJobSite] = useState<string>((editingInvoice as any)?.jobSite || editingInvoice?.notes || '');

  // Autocomplete Dropdowns State
  const [showNameDropdown, setShowNameDropdown] = useState(false);
  const [showPhoneDropdown, setShowPhoneDropdown] = useState(false);

  // Items in Current Invoice
  const [currentInvoiceItems, setCurrentInvoiceItems] = useState<WorkspaceItemRow[]>(() => {
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

  // Multi-Selection State for Bulk Delete (Long-Press feature)
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
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Modify Single Invoice Item Modal State (كارت التعديل التفصيلي للصنف)
  const [isModifyModalOpen, setIsModifyModalOpen] = useState(false);
  const [modifyIndex, setModifyIndex] = useState<number>(-1);
  const [modifyName, setModifyName] = useState('');
  const [modifyCode, setModifyCode] = useState('');
  const [modifyQty, setModifyQty] = useState('');
  const [modifyPrice, setModifyPrice] = useState('');
  const [modifySpec, setModifySpec] = useState('');
  const [modifyStock, setModifyStock] = useState<number | null>(null);

  // Add Brand New Item Modal (إضافة صنف جديد للمخزون) State
  const [isNewItemModalOpen, setIsNewItemModalOpen] = useState(false);
  const [newInputItemName, setNewInputItemName] = useState('');
  const [newInputItemCode, setNewInputItemCode] = useState('');
  const [editBuyPrice, setEditBuyPrice] = useState('');
  const [editItemCategory, setEditItemCategory] = useState('');
  const [editCashProfitMargin, setEditCashProfitMargin] = useState('');
  const [editCashPriceManual, setEditCashPriceManual] = useState('');
  const [editWholesaleProfitMargin, setEditWholesaleProfitMargin] = useState('');
  const [editWholesalePriceManual, setEditWholesalePriceManual] = useState('');
  const [editQty, setEditQty] = useState('');
  const [lblCalcCashMargin, setLblCalcCashMargin] = useState('النسبة: 0%');
  const [lblCalcWholesaleMargin, setLblCalcWholesaleMargin] = useState('النسبة: 0%');

  // Categories List from database items
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    (appData.items || []).forEach((it) => {
      if (it.category) set.add(it.category.trim());
    });
    return Array.from(set).filter(Boolean);
  }, [appData.items]);

  // Customer or Supplier Balance Information
  const partyBalanceInfo = useMemo(() => {
    if (isSale) {
      const customer = (appData.customers || []).find(
        (c) => c.name.trim().toLowerCase() === custName.trim().toLowerCase() || (c as any).code === custCode
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
        (s) => s.name.trim().toLowerCase() === custName.trim().toLowerCase() || (s as any).code === custCode
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
  }, [isSale, custName, custCode, appData]);

  // Autocomplete Filtered Parties
  const filteredParties = useMemo(() => {
    return isSale ? (appData.customers || []) : (appData.suppliers || []);
  }, [isSale, appData]);

  const selectCustomer = (party: Customer | Supplier) => {
    const code = (party as any).code || party.id;
    setCustCode(code);
    setCustName(party.name || '');
    setCustPhone(party.phone || '');
    setShowNameDropdown(false);
    setShowPhoneDropdown(false);
  };

  const syncCustomerByCode = (code: string) => {
    setCustCode(code);
    const matched = filteredParties.find((p) => ((p as any).code && (p as any).code === code.trim()) || p.id === code.trim());
    if (matched) {
      setCustName(matched.name || '');
      setCustPhone(matched.phone || '');
    }
  };

  // Pricing switch logic (cash, wholesale, buy)
  const setInvoicePriceType = (type: 'cash' | 'wholesale' | 'buy') => {
    setCurrentInvoicePriceType(type);
    setCurrentInvoiceItems((prev) =>
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

    currentInvoiceItems.forEach((i) => {
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
  }, [currentInvoiceItems, globalInvDisc, invDiscType, globalInvTax, invTaxType, extraIncomeVal, paymentRows, selectedInvoiceType]);

  // Add Item to Invoice from Lookup or Barcode
  const quickAddItemToInvoice = (item: any) => {
    const stock = Number(item.quantity ?? item.stock ?? 0);
    if (isSale && !isReturn && stock <= 0) {
      const proceed = confirm(`⚠️ تنبيه: رصيد الصنف (${item.name}) منتهٍ أو صفر بالمخزن. هل تريد المتابعة بالبيع بالسالب؟`);
      if (!proceed) return;
    }

    let activePrice = Number(item.salePrice || item.cashPrice || item.price || 0);
    if (currentInvoicePriceType === 'wholesale') {
      activePrice = Number(item.wholesalePrice || item.price || 0);
    } else if (currentInvoicePriceType === 'buy' || !isSale) {
      activePrice = Number(item.costPrice || item.purchasePrice || item.buyPrice || item.price || 0);
    }

    setCurrentInvoiceItems((prev) => {
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
          costPrice: Number(item.costPrice || item.buyPrice || 0),
        },
      ];
    });

    setIsLookupModalOpen(false);
  };

  // Quick Barcode / Name Input Handler
  const handleQuickSearchEnter = () => {
    const q = quickSearchText.trim().toLowerCase();
    if (!q) return;
    const items = appData.items || [];
    const exactBarcode = items.find((i) => i.code && i.code.toLowerCase() === q);
    if (exactBarcode) {
      quickAddItemToInvoice(exactBarcode);
      setQuickSearchText('');
      setShowQuickDropdown(false);
      return;
    }
    const exactName = items.find((i) => i.name.toLowerCase() === q);
    if (exactName) {
      quickAddItemToInvoice(exactName);
      setQuickSearchText('');
      setShowQuickDropdown(false);
      return;
    }
    const matches = items.filter(
      (i) => i.name.toLowerCase().includes(q) || (i.code && i.code.toLowerCase().includes(q))
    );
    if (matches.length === 1) {
      quickAddItemToInvoice(matches[0]);
      setQuickSearchText('');
      setShowQuickDropdown(false);
    } else if (matches.length > 1) {
      setShowQuickDropdown(true);
    } else {
      showToast(`الصنف "${quickSearchText}" غير مسجل بقاعدة الأصناف`, 'warning');
    }
  };

  // Modify Single Invoice Item (كارت التعديل التفصيلي للصنف)
  const openModifyModal = (index: number) => {
    const item = currentInvoiceItems[index];
    if (!item) return;
    setModifyIndex(index);
    setModifyName(item.name);
    setModifyCode(item.code || '');
    setModifyQty(String(item.qty));
    setModifyPrice(String(item.price));
    setModifySpec(item.spec || '');

    const dbItem = (appData.items || []).find(
      (i) => (i.code && item.code && i.code === item.code) || (item.itemId && i.id === item.itemId) || i.name.trim() === item.name.trim()
    );
    setModifyStock(dbItem ? Number(dbItem.quantity ?? (dbItem as any).stock ?? 0) : null);
    setIsModifyModalOpen(true);
  };

  const saveModifiedItem = () => {
    if (modifyIndex < 0 || modifyIndex >= currentInvoiceItems.length) return;
    const qty = parseFloat(modifyQty) || 0;
    const price = parseFloat(modifyPrice) || 0;
    if (qty <= 0) {
      alert('الرجاء إدخال كمية صحيحة أكبر من صفر');
      return;
    }
    setCurrentInvoiceItems((prev) => {
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
    showToast('تم حفظ تعديل الصنف بالفاتورة', 'success');
  };

  // Remove Single Item
  const removeItemFromInvoice = (index: number) => {
    const target = currentInvoiceItems[index];
    if (target && selectedRowIds.has(target.rowId)) {
      setSelectedRowIds((prev) => {
        const next = new Set(prev);
        next.delete(target.rowId);
        return next;
      });
    }
    setCurrentInvoiceItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // 🎯 Long Press & Click Logic for Table Rows
  const handlePointerDown = (rowId: string, e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    isLongPressTriggeredRef.current = false;
    pointerStartPosRef.current = { x: e.clientX, y: e.clientY };

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

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
      isLongPressTriggeredRef.current = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }

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
    setCurrentInvoiceItems((prev) => prev.filter((item) => !selectedRowIds.has(item.rowId)));
    setSelectedRowIds(new Set());
    showToast(`🗑️ تم حذف (${count}) أصناف محددة بنجاح`, 'info');
  };

  const handleSelectAll = () => {
    if (selectedRowIds.size === currentInvoiceItems.length) {
      setSelectedRowIds(new Set());
    } else {
      setSelectedRowIds(new Set(currentInvoiceItems.map((i) => i.rowId)));
    }
  };

  // Multi-Payment Rows
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

  // Add Brand New Item Dialog Logic & Margins Calculation
  const openNewItemDialog = () => {
    let maxCode = 0;
    (appData.items || []).forEach((i) => {
      const num = parseInt(String(i.code || '').replace(/\D/g, '')) || 0;
      if (num > maxCode) maxCode = num;
    });
    setNewInputItemCode('1' + String(maxCode + 1).padStart(3, '0'));
    setNewInputItemName('');
    setEditItemCategory(categoriesList[0] || 'عامة');
    setEditBuyPrice('');
    setEditCashProfitMargin('20');
    setEditCashPriceManual('');
    setEditWholesaleProfitMargin('10');
    setEditWholesalePriceManual('');
    setEditQty('10');
    setLblCalcCashMargin('النسبة: 20%');
    setLblCalcWholesaleMargin('النسبة: 10%');
    setIsNewItemModalOpen(true);
  };

  const calculatePricesFromMargin = (buyP: number, cashM: number, wholesaleM: number) => {
    if (buyP > 0) {
      if (cashM > 0) {
        setEditCashPriceManual((buyP * (1 + cashM / 100)).toFixed(2));
        setLblCalcCashMargin(`النسبة: ${cashM}%`);
      }
      if (wholesaleM > 0) {
        setEditWholesalePriceManual((buyP * (1 + wholesaleM / 100)).toFixed(2));
        setLblCalcWholesaleMargin(`النسبة: ${wholesaleM}%`);
      }
    }
  };

  const calculateMarginFromManualPrice = (type: 'cash' | 'wholesale') => {
    const buyPrice = parseFloat(editBuyPrice) || 0;
    if (buyPrice <= 0) return;

    if (type === 'cash') {
      const manualPrice = parseFloat(editCashPriceManual) || 0;
      if (manualPrice > 0) {
        const margin = ((manualPrice - buyPrice) / buyPrice) * 100;
        setLblCalcCashMargin(`النسبة المحسوبة: ${margin.toFixed(1)}%`);
        setEditCashProfitMargin(margin.toFixed(1));
      }
    } else if (type === 'wholesale') {
      const manualPrice = parseFloat(editWholesalePriceManual) || 0;
      if (manualPrice > 0) {
        const margin = ((manualPrice - buyPrice) / buyPrice) * 100;
        setLblCalcWholesaleMargin(`النسبة المحسوبة: ${margin.toFixed(1)}%`);
        setEditWholesaleProfitMargin(margin.toFixed(1));
      }
    }
  };

  const saveNewItemData = () => {
    const name = newInputItemName.trim();
    if (!name) {
      alert('أدخل اسم الصنف الجديد');
      return;
    }
    const buyPrice = parseFloat(editBuyPrice) || 0;
    const cashPrice = parseFloat(editCashPriceManual) || (buyPrice > 0 ? buyPrice * 1.2 : 10);
    const wholesalePrice = parseFloat(editWholesalePriceManual) || (cashPrice * 0.95);
    const stock = parseFloat(editQty) || 0;

    const newItemObj: Item = {
      id: `it_${Date.now()}`,
      code: newInputItemCode.trim(),
      name,
      category: editItemCategory || 'عامة',
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

    quickAddItemToInvoice(newItemObj);
    showToast(`✅ تم إنشاء الصنف [${name}] وإضافته للمخزون والفاتورة مباشرة`, 'success');
  };

  // Save Invoice & Post Ledger (الترحيل المحاسبي وتحديث المخزون بدقة)
  const saveInvoice = () => {
    if (currentInvoiceItems.length === 0) {
      alert('الفاتورة فارغة! يرجى إدراج صنف واحد على الأقل من دليل الأصناف.');
      return;
    }

    const defaultPartyName = isSale
      ? custName.trim() || 'عميل نقدي'
      : custName.trim() || 'مورد عام';

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
        phone: custPhone,
        notes: jobSite,
        items: currentInvoiceItems.map((i) => ({
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
        phone: custPhone,
        notes: jobSite,
        items: currentInvoiceItems.map((i) => ({
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
      ? custName.trim() || 'عميل نقدي'
      : custName.trim() || 'مورد عام';

    const invObject: any = {
      id: invoiceId,
      date: invDate,
      time: invTime,
      type: selectedInvoiceType,
      customerName: defaultPartyName,
      supplierName: defaultPartyName,
      phone: custPhone,
      items: currentInvoiceItems.map((i) => ({
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
          ? 'fixed inset-0 w-full min-h-screen h-full z-50 flex flex-col bg-[#e2e8f0] overflow-y-auto select-none p-1 sm:p-2'
          : 'fixed inset-0 w-full min-h-screen z-50 flex justify-center items-start sm:items-center p-1 sm:p-2.5 md:p-3 bg-slate-900/75 backdrop-blur-2xs overflow-y-auto select-none'
      }
      dir="rtl"
    >
      <style>{`
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

        .rakeeza-app-container {
          width: 100%;
          background: #fff;
          border-radius: 6px;
          border: 1px solid var(--border);
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
          margin: auto;
          min-height: 580px;
        }

        .header-title-box {
          background: var(--primary);
          color: #fff;
          padding: 6px 10px;
          font-size: 11px;
          font-weight: bold;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-shrink: 0;
          border-bottom: 1px solid #334155;
        }

        .rakeeza-main-content {
          padding: 5px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
          min-width: 0;
        }

        .invoice-card-box {
          background: #f8fafc;
          border: 1px solid var(--border);
          border-radius: 4px;
          padding: 5px;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 3px;
          flex-shrink: 0;
        }

        @media (min-width: 768px) {
          .invoice-card-box {
            grid-template-columns: repeat(6, minmax(0, 1fr));
            gap: 4px;
          }
        }

        .field-inline-box {
          display: flex;
          flex-direction: column;
          gap: 1.5px;
          min-width: 0;
          position: relative;
        }

        .field-inline-box label {
          font-size: 8.5px;
          font-weight: bold;
          color: #475569;
        }

        .rakeeza-input, .rakeeza-select {
          padding: 2px 4px;
          border: 1px solid var(--border);
          border-radius: 3px;
          font-size: 9.5px;
          outline: none;
          background: #fff;
          width: 100%;
          height: 24px;
          color: #1e293b;
        }

        .rakeeza-input:focus, .rakeeza-select:focus {
          border-color: var(--secondary);
          box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.2);
        }

        .top-actions-grid-box {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px;
          flex-shrink: 0;
        }

        .btn-action-top-box {
          width: 100%;
          padding: 6px;
          background: var(--secondary);
          color: white;
          border: none;
          border-radius: 3px;
          font-size: 10px;
          font-weight: bold;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          transition: filter 0.15s;
        }

        .btn-action-top-box:hover {
          filter: brightness(1.1);
        }

        .btn-action-alt-box {
          background: #475569;
        }

        .table-responsive-box {
          width: 100%;
          flex: 1;
          min-height: 200px;
          max-height: 48vh;
          overflow-y: auto;
          overflow-x: auto;
          border: 1px solid var(--border);
          border-radius: 4px;
          background: #fff;
        }

        .table-responsive-box table {
          width: 100%;
          border-collapse: collapse;
          font-size: 9px;
          text-align: center;
        }

        .table-responsive-box th, .table-responsive-box td {
          padding: 3px 4px;
          border: 1px solid var(--border);
          vertical-align: middle;
        }

        .table-responsive-box th {
          background: #f1f5f9;
          color: var(--primary);
          font-weight: bold;
          position: sticky;
          top: 0;
          z-index: 2;
        }

        .bottom-fixed-area-box {
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: 3px;
          background: #fff;
          padding: 4px 6px;
          border-top: 1px solid var(--border);
          position: sticky;
          bottom: 0;
          z-index: 10;
        }

        .summary-bar-box {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 2.5px;
          background: #1e293b;
          color: white;
          padding: 4px;
          border-radius: 4px;
          text-align: center;
        }

        @media (min-width: 640px) {
          .summary-bar-box {
            grid-template-columns: repeat(6, minmax(0, 1fr));
          }
        }

        .summary-item-box {
          font-size: 8.5px;
          background: rgba(255,255,255,0.08);
          padding: 2.5px 3px;
          border-radius: 3px;
        }

        .summary-item-box span {
          font-weight: bold;
          color: #4ade80;
          display: block;
          font-size: 9.5px;
          font-family: monospace;
        }

        .summary-net-box {
          grid-column: 1 / -1;
          background: #166534 !important;
          font-size: 10px !important;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 4px 10px;
        }

        .summary-net-box span {
          color: #facc15 !important;
          font-size: 12px !important;
          font-weight: 900;
        }

        .btn-action-bar-box {
          display: flex;
          gap: 4px;
        }

        .btn-action-btn {
          flex: 1;
          padding: 6px;
          border: none;
          border-radius: 3px;
          font-weight: bold;
          font-size: 9.5px;
          color: white;
          cursor: pointer;
          text-align: center;
          transition: filter 0.15s;
        }

        .btn-action-btn:hover {
          filter: brightness(1.1);
        }
      `}</style>

      {/* Main Container - Responsive up to max-w-7xl on desktop or full-screen */}
      <div
        className={`rakeeza-app-container ${
          isMaximized
            ? 'w-full min-h-screen rounded-none border-0 shadow-none'
            : 'max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl'
        }`}
      >
        {/* Header Title */}
        <div className="header-title-box">
          <div className="flex items-center gap-2">
            <span>📄 {isSale ? 'نظام الفواتير والمخزون - ركيزة' : 'نظام المشتريات والتوريد - ركيزة'}</span>
            <span
              className={`text-[9px] px-2 py-0.5 rounded font-black ${
                isReturn ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
              }`}
            >
              {isReturn ? (isSale ? '↩ مرتجع مبيعات' : '↩ مرتجع مشتريات') : isSale ? '💵 فاتورة مبيعات' : '🛒 فاتورة مشتريات'}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-[9.5px] font-mono bg-black/25 px-2 py-0.5 rounded text-white/90">
              🕒 {liveTime}
            </span>
            <button
              type="button"
              onClick={() => setIsMaximized((prev) => !prev)}
              className="w-6 h-6 rounded hover:bg-white/20 active:bg-white/30 flex items-center justify-center text-white text-xs font-bold cursor-pointer transition"
              title={isMaximized ? 'استعادة الحجم الطبيعي' : 'تكبير الشاشة (Fullscreen)'}
            >
              {isMaximized ? '🗗' : '⛶'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-6 h-6 rounded hover:bg-white/20 active:bg-white/30 flex items-center justify-center text-white text-sm font-black cursor-pointer transition"
              title="إغلاق"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="rakeeza-main-content">
          {/* Invoice Card Grid */}
          <div className="invoice-card-box">
            <div className="field-inline-box">
              <label>رقم الفاتورة</label>
              <input type="text" value={invNum} readOnly className="rakeeza-input bg-slate-100 font-bold" />
            </div>
            <div className="field-inline-box">
              <label>التاريخ</label>
              <input
                type="date"
                value={invDate}
                onChange={(e) => setInvDate(e.target.value)}
                className="rakeeza-input font-mono"
              />
            </div>
            <div className="field-inline-box">
              <label>الوقت</label>
              <input
                type="time"
                value={invTime}
                onChange={(e) => setInvTime(e.target.value)}
                className="rakeeza-input font-mono"
              />
            </div>
            <div className="field-inline-box">
              <label>{isSale ? 'كود العميل' : 'كود المورد'}</label>
              <input
                type="text"
                value={custCode}
                placeholder="الكود..."
                onChange={(e) => syncCustomerByCode(e.target.value)}
                className="rakeeza-input font-mono"
              />
            </div>
            <div className="field-inline-box relative col-span-2 sm:col-span-1 md:col-span-2">
              <label>{isSale ? 'اسم العميل (بحث)' : 'اسم المورد (بحث)'}</label>
              <input
                type="text"
                value={custName}
                placeholder="اكتب للبحث..."
                onChange={(e) => {
                  setCustName(e.target.value);
                  setShowNameDropdown(true);
                }}
                onFocus={() => setShowNameDropdown(true)}
                className="rakeeza-input font-bold"
              />
              {showNameDropdown && (
                <div className="absolute top-full right-0 left-0 bg-white border border-blue-500 rounded max-h-[130px] overflow-y-auto z-50 shadow-xl mt-1">
                  {filteredParties
                    .filter(
                      (p) =>
                        !custName ||
                        p.name.toLowerCase().includes(custName.toLowerCase()) ||
                        ((p as any).code && String((p as any).code).toLowerCase().includes(custName.toLowerCase()))
                    )
                    .slice(0, 15)
                    .map((p) => (
                      <div
                        key={p.id}
                        onClick={() => selectCustomer(p)}
                        className="px-2 py-1.5 text-[9.5px] cursor-pointer hover:bg-blue-50 border-b border-slate-100 flex items-center justify-between"
                      >
                        <span className="font-bold text-slate-800">{p.name}</span>
                        <span className="text-[8px] text-slate-500 font-mono">({(p as any).code || p.id})</span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="field-inline-box relative col-span-2 sm:col-span-1 md:col-span-2">
              <label>رقم الهاتف (بحث)</label>
              <input
                type="text"
                value={custPhone}
                placeholder="ابحث برقم الهاتف..."
                onChange={(e) => {
                  setCustPhone(e.target.value);
                  setShowPhoneDropdown(true);
                }}
                onFocus={() => setShowPhoneDropdown(true)}
                className="rakeeza-input font-mono"
              />
              {showPhoneDropdown && (
                <div className="absolute top-full right-0 left-0 bg-white border border-blue-500 rounded max-h-[130px] overflow-y-auto z-50 shadow-xl mt-1">
                  {filteredParties
                    .filter((p) => !custPhone || (p.phone && p.phone.includes(custPhone)))
                    .slice(0, 15)
                    .map((p) => (
                      <div
                        key={p.id}
                        onClick={() => selectCustomer(p)}
                        className="px-2 py-1.5 text-[9.5px] cursor-pointer hover:bg-blue-50 border-b border-slate-100 flex items-center justify-between"
                      >
                        <span className="font-bold text-slate-800">{p.name}</span>
                        <span className="text-[8px] text-slate-500 font-mono">{p.phone}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="field-inline-box col-span-3 sm:col-span-3 md:col-span-4">
              <label>البيان / جهة العمل أو الملاحظات</label>
              <input
                type="text"
                value={jobSite}
                placeholder="بيان الفاتورة، موقع التسليم، أو أي شروط خاصة..."
                onChange={(e) => setJobSite(e.target.value)}
                className="rakeeza-input"
              />
            </div>

            {/* Account Balance Display Banner */}
            <div className="col-span-3 sm:col-span-3 md:col-span-6 bg-yellow-50 border border-yellow-200 p-1.5 rounded flex items-center justify-between text-[9px] font-bold text-slate-800">
              <span className="flex items-center gap-1">
                <span>حالة الحساب:</span>
                <strong style={{ color: partyBalanceInfo.color }}>{partyBalanceInfo.typeText}</strong>
              </span>
              <span className="flex items-center gap-1">
                <span>المبلغ (له / عليه):</span>
                <strong style={{ color: partyBalanceInfo.color }} className="font-mono text-[10px]">
                  {partyBalanceInfo.balanceVal}
                </strong>
                <span>ج.م</span>
              </span>
            </div>
          </div>

          {/* Pricing Box & Invoice Payment Type Switcher */}
          <div className="bg-[#fefce8] border border-[#fde047] p-1.5 rounded flex flex-wrap items-center justify-between shrink-0 gap-2">
            <div className="flex items-center gap-1.5 flex-1">
              <label className="text-[#854d0e] text-[9px] font-bold shrink-0">نظام تسعير الفاتورة:</label>
              <div className="flex gap-1 flex-1 max-w-sm">
                <button
                  type="button"
                  onClick={() => setInvoicePriceType('cash')}
                  className={`flex-1 py-1 rounded text-[8.5px] font-bold cursor-pointer transition ${
                    currentInvoicePriceType === 'cash'
                      ? 'bg-[#16a34a] text-white border-0 font-black'
                      : 'bg-white text-slate-700 border border-slate-300'
                  }`}
                >
                  💵 سعر نقدي
                </button>
                <button
                  type="button"
                  onClick={() => setInvoicePriceType('wholesale')}
                  className={`flex-1 py-1 rounded text-[8.5px] font-bold cursor-pointer transition ${
                    currentInvoicePriceType === 'wholesale'
                      ? 'bg-[#16a34a] text-white border-0 font-black'
                      : 'bg-white text-slate-700 border border-slate-300'
                  }`}
                >
                  🏷️ سعر جملة
                </button>
                <button
                  type="button"
                  onClick={() => setInvoicePriceType('buy')}
                  className={`flex-1 py-1 rounded text-[8.5px] font-bold cursor-pointer transition ${
                    currentInvoicePriceType === 'buy'
                      ? 'bg-[#16a34a] text-white border-0 font-black'
                      : 'bg-white text-slate-700 border border-slate-300'
                  }`}
                >
                  🛒 سعر شراء
                </button>
              </div>
            </div>

            {/* Quick Invoice Type Switcher */}
            <div className="flex items-center gap-1 shrink-0">
              <label className="text-slate-700 text-[8.5px] font-bold">نوع السداد:</label>
              <select
                value={selectedInvoiceType}
                onChange={(e) => setSelectedInvoiceType(e.target.value as any)}
                className="h-[22px] bg-white border border-slate-300 rounded px-1.5 text-[8.5px] font-bold text-slate-800 cursor-pointer"
              >
                <option value="nagdi">نقدي (كاش فوري)</option>
                <option value="ajel">آجل (ذمم وحسابات)</option>
                <option value="return_nagdi">مرتجع نقدي (صرف فوري)</option>
                <option value="return_ajel">مرتجع آجل (تسوية حساب)</option>
              </select>
            </div>
          </div>

          {/* Top Actions Grid + Barcode Search Bar */}
          <div className="flex flex-col gap-1.5 shrink-0">
            <div className="top-actions-grid-box">
              <button
                type="button"
                className="btn-action-top-box"
                onClick={() => setIsLookupModalOpen(true)}
              >
                <span>📦</span>
                <span>دليل الأصناف (إضافة سريعة)</span>
              </button>
              <button
                type="button"
                className="btn-action-top-box btn-action-alt-box"
                onClick={() => setIsOptionsModalOpen(true)}
              >
                <span>⚙️</span>
                <span>الخصم، الضريبة والدفع</span>
              </button>
            </div>

            {/* Quick Barcode Scanner / Instant Name Search Input */}
            <div className="relative w-full">
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
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-[9.5px] font-semibold text-slate-900 focus:outline-none focus:border-blue-500 shadow-xs"
              />
              {showQuickDropdown && quickSearchText.trim() && (
                <div className="absolute top-full right-0 left-0 bg-white border border-blue-500 rounded max-h-[160px] overflow-y-auto z-50 shadow-xl mt-1">
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
                        onClick={() => {
                          quickAddItemToInvoice(item);
                          setQuickSearchText('');
                          setShowQuickDropdown(false);
                        }}
                        className="px-2.5 py-1.5 text-[9.5px] cursor-pointer hover:bg-blue-50 border-b border-slate-100 flex items-center justify-between"
                      >
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">{item.name}</span>
                          <span className="text-[8px] text-slate-500 font-mono">باركود: {item.code || '-'} | الرصيد: {item.quantity || 0}</span>
                        </div>
                        <span className="font-mono font-bold text-emerald-700 text-xs">
                          {Number(
                            currentInvoicePriceType === 'wholesale'
                              ? item.wholesalePrice || item.price || 0
                              : currentInvoicePriceType === 'buy' || !isSale
                              ? item.costPrice || item.purchasePrice || item.price || 0
                              : item.salePrice || item.price || 0
                          ).toFixed(2)}{' '}
                          ج.م
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* 🗑️ Bulk Selection & Delete Action Bar (يظهر فوراً عند تحديد أصناف بالضغط المطول) */}
          {selectedRowIds.size > 0 && (
            <div className="bg-rose-50 border border-rose-300 px-2.5 py-1.5 rounded flex flex-wrap items-center justify-between gap-1.5 shrink-0 shadow-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] font-black">
                  {selectedRowIds.size}
                </span>
                <span className="text-[9.5px] font-black text-rose-950">
                  تم تحديد {selectedRowIds.size} صنف (اضغط مطولاً على أي صنف لإلغائه أو إضافته)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[9px] font-bold cursor-pointer transition shadow-xs flex items-center gap-1"
                >
                  <span>🗑️</span>
                  <span>حذف المحددة ({selectedRowIds.size})</span>
                </button>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded text-[9px] font-bold cursor-pointer transition"
                >
                  {selectedRowIds.size === currentInvoiceItems.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRowIds(new Set())}
                  className="px-2 py-1 bg-white border border-slate-300 text-slate-700 rounded text-[9px] font-bold cursor-pointer transition"
                >
                  ✕ إلغاء
                </button>
              </div>
            </div>
          )}

          {/* Table Responsive of Items */}
          <div className="table-responsive-box">
            <table>
              <thead>
                <tr>
                  <th className="w-[30px]">
                    <input
                      type="checkbox"
                      checked={currentInvoiceItems.length > 0 && selectedRowIds.size === currentInvoiceItems.length}
                      onChange={handleSelectAll}
                      className="cursor-pointer"
                      title="تحديد كل الأصناف"
                    />
                  </th>
                  <th className="w-[30px]">م</th>
                  <th className="w-[70px]">الباركود</th>
                  <th className="text-right min-w-[140px] sm:min-w-[200px] font-black">
                    <span>الصنف</span>
                    <span className="text-[7.5px] text-slate-500 font-normal mr-1 hidden sm:inline">(نقر: تعديل | ضغط مطول: تحديد)</span>
                  </th>
                  <th className="text-right w-[80px] sm:w-[120px]">الوصف</th>
                  <th className="w-[45px] sm:w-[60px]">الكمية</th>
                  <th className="w-[55px] sm:w-[70px]">السعر</th>
                  <th className="w-[65px] sm:w-[85px] font-black">الإجمالي</th>
                  <th className="w-[50px] sm:w-[70px]">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {currentInvoiceItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ color: '#94a3b8', padding: '25px', textAlign: 'center' }}>
                      لم يتم إدراج أصناف بعد (اضغط من دليل الأصناف للبيع السريع)
                    </td>
                  </tr>
                ) : (
                  currentInvoiceItems.map((item, index) => {
                    const isSelected = selectedRowIds.has(item.rowId);
                    return (
                      <tr
                        key={item.rowId}
                        onPointerDown={(e) => handlePointerDown(item.rowId, e)}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                        onPointerMove={handlePointerMove}
                        onClick={(e) => handleRowClick(index, item.rowId, e)}
                        className={`transition-colors cursor-pointer select-none ${
                          isSelected
                            ? 'bg-blue-100 font-bold'
                            : 'hover:bg-[#f8fafc]'
                        }`}
                        title="نقر فردي: فتح كارت التعديل التفصيلي | ضغط مطول: تحديد الصنف للحذف"
                      >
                        <td onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => toggleSelectRow(item.rowId, e as any)}
                            className="cursor-pointer"
                          />
                        </td>
                        <td className="font-mono text-slate-600 font-bold">{index + 1}</td>
                        <td className="font-mono text-slate-600 text-[8.5px]">{item.code || '-'}</td>
                        <td className="text-right font-black text-slate-900 break-words">
                          <div className="flex items-center gap-1">
                            {isSelected && <span className="text-blue-600 text-[9px]">✓</span>}
                            <span>{item.name}</span>
                          </div>
                        </td>
                        <td className="text-right text-[#64748b] truncate max-w-[120px]" title={item.spec || ''}>
                          {item.spec || '-'}
                        </td>
                        <td className="font-mono font-bold text-slate-900">{item.qty}</td>
                        <td className="font-mono font-bold text-slate-900">{item.price.toFixed(2)}</td>
                        <td className="font-mono font-black text-emerald-800">{item.total.toFixed(2)}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <span className="inline-flex gap-1.5 justify-center items-center">
                            <span
                              className="cursor-pointer p-0.5 text-blue-600 hover:text-blue-800"
                              title="تعديل الصنف"
                              onClick={() => openModifyModal(index)}
                            >
                              ✏️
                            </span>
                            <span
                              className="cursor-pointer p-0.5 text-rose-600 hover:text-rose-800"
                              title="حذف"
                              onClick={() => removeItemFromInvoice(index)}
                            >
                              🗑️
                            </span>
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Fixed Area */}
        <div className="bottom-fixed-area-box">
          <div className="summary-bar-box">
            <div className="summary-item-box">
              إجمالي الكميات: <span>{totals.totalQty.toFixed(2)}</span>
            </div>
            <div className="summary-item-box">
              الخصومات: <span className="text-rose-400">{totals.discount.toFixed(2)}</span>
            </div>
            <div className="summary-item-box">
              الضرائب: <span className="text-blue-400">{totals.tax.toFixed(2)}</span>
            </div>
            <div className="summary-item-box">
              الإيراد: <span className="text-purple-400">{totals.extra.toFixed(2)}</span>
            </div>
            <div className="summary-item-box">
              المدفوع: <span style={{ color: '#60a5fa' }}>{totals.paid.toFixed(2)}</span>
            </div>
            <div className="summary-item-box">
              المتبقي: <span style={{ color: '#f87171' }}>{totals.remain.toFixed(2)}</span>
            </div>
            <div className="summary-net-box">
              <span>الصافي النهائي للفاتورة:</span>
              <span>{totals.net.toFixed(2)} ج.م</span>
            </div>
          </div>

          <div className="btn-action-bar-box">
            <button
              type="button"
              className="btn-action-btn"
              style={{ background: 'var(--accent)' }}
              onClick={saveInvoice}
            >
              <span>💾 حفظ وترحيل الحسابات</span>
            </button>
            <button
              type="button"
              className="btn-action-btn"
              style={{ background: 'var(--secondary)' }}
              onClick={handlePrint}
            >
              <span>🖨️ طباعة</span>
            </button>
          </div>
        </div>
      </div>

      {/* نافذة الخيارات والمدفوعات (optionsModal) */}
      {isOptionsModalOpen && (
        <div
          className="fixed inset-0 bg-black/65 z-[2000] flex justify-center items-center p-2"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOptionsModalOpen(false);
          }}
        >
          <div className="bg-white w-full max-w-[400px] rounded-lg overflow-hidden flex flex-col border border-slate-300 shadow-2xl my-auto">
            <div
              className="text-white px-2.5 py-1.5 flex justify-between items-center text-[10.5px] font-bold"
              style={{ background: 'var(--secondary)' }}
            >
              <span>⚙️ خصومات، ضرائب، إيرادات ودفع</span>
              <span
                style={{ cursor: 'pointer', fontSize: '18px' }}
                onClick={() => setIsOptionsModalOpen(false)}
              >
                &times;
              </span>
            </div>

            <div className="p-2.5 flex flex-col gap-2 text-xs">
              {/* الخصم الكلي */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] font-bold text-slate-700">خصم الفاتورة الكلية</label>
                  <div className="flex border-2 border-blue-600 rounded overflow-hidden h-[24px] w-[110px]">
                    <button
                      type="button"
                      className={`flex-1 text-[9.5px] font-bold cursor-pointer border-0 ${
                        invDiscType === 'val' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600'
                      }`}
                      onClick={() => setInvDiscType('val')}
                    >
                      ج.م
                    </button>
                    <button
                      type="button"
                      className={`flex-1 text-[9.5px] font-bold cursor-pointer border-0 ${
                        invDiscType === 'percent' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600'
                      }`}
                      onClick={() => setInvDiscType('percent')}
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
                  className="w-full border border-slate-300 rounded px-2 text-[10px] h-[26px]"
                />
              </div>

              {/* الضريبة الكلية */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] font-bold text-slate-700">ضريبة الفاتورة الكلية</label>
                  <div className="flex border-2 border-blue-600 rounded overflow-hidden h-[24px] w-[110px]">
                    <button
                      type="button"
                      className={`flex-1 text-[9.5px] font-bold cursor-pointer border-0 ${
                        invTaxType === 'percent' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600'
                      }`}
                      onClick={() => setInvTaxType('percent')}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      className={`flex-1 text-[9.5px] font-bold cursor-pointer border-0 ${
                        invTaxType === 'val' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600'
                      }`}
                      onClick={() => setInvTaxType('val')}
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
                  className="w-full border border-slate-300 rounded px-2 text-[10px] h-[26px]"
                />
              </div>

              {/* الإيرادات الإضافية */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-0.5">
                  <label className="text-[9px] font-bold text-slate-700">اسم الإيراد</label>
                  <input
                    type="text"
                    value={extraIncomeName}
                    onChange={(e) => setExtraIncomeName(e.target.value)}
                    placeholder="شحن، تركيب..."
                    className="border border-slate-300 rounded px-2 text-[9.5px] h-[25px]"
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="text-[9px] font-bold text-slate-700">مبلغ الإيراد</label>
                  <input
                    type="number"
                    step="any"
                    value={extraIncomeVal}
                    onChange={(e) => setExtraIncomeVal(e.target.value)}
                    placeholder="0.00"
                    className="border border-slate-300 rounded px-2 text-[9.5px] h-[25px]"
                  />
                </div>
              </div>

              {/* طرق الدفع المتعددة */}
              <div className="flex flex-col gap-1 border-t border-slate-200 pt-2">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[9px] font-bold text-slate-700">طرق الدفع المتعددة</label>
                  <button
                    type="button"
                    style={{ background: 'var(--accent)' }}
                    className="text-white px-2 py-0.5 text-[8.5px] rounded font-bold cursor-pointer"
                    onClick={() => addPaymentRow('نقدي / كاش', totals.net)}
                  >
                    + إضافة دفع
                  </button>
                </div>
                <div className="flex flex-col gap-1 max-h-[100px] overflow-y-auto">
                  {paymentRows.map((r) => (
                    <div key={r.id} className="flex gap-1 items-center">
                      <select
                        value={r.method}
                        onChange={(e) => updatePaymentRow(r.id, 'method', e.target.value)}
                        className="h-[24px] w-[100px] text-[9.5px] border border-slate-300 rounded px-1"
                      >
                        <option value="نقدي / كاش">نقدي</option>
                        <option value="انستاباي Instapay">انستاباي</option>
                        <option value="فودافون كاش">فودافون كاش</option>
                        <option value="فيزا / كارت">فيزا</option>
                        <option value="حساب بنكي">حساب بنكي</option>
                      </select>
                      <input
                        type="number"
                        step="any"
                        value={r.amount || ''}
                        onChange={(e) => updatePaymentRow(r.id, 'amount', e.target.value)}
                        className="h-[24px] flex-1 text-[9.5px] border border-slate-300 rounded px-1 font-mono"
                        placeholder="المبلغ..."
                      />
                      <button
                        type="button"
                        onClick={() => removePaymentRow(r.id)}
                        className="text-rose-600 hover:text-rose-800 text-xs px-1 cursor-pointer font-bold"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="w-full text-white py-2 rounded text-[10px] font-bold cursor-pointer mt-1"
                style={{ background: 'var(--accent)' }}
                onClick={() => setIsOptionsModalOpen(false)}
              >
                ✓ تم وحفظ الخيارات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* دليل الأصناف (lookupModal) */}
      {isLookupModalOpen && (
        <div
          className="fixed inset-0 bg-black/65 z-[2000] flex justify-center items-center p-2"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsLookupModalOpen(false);
          }}
        >
          <div className="bg-[#e5e7eb] w-[98vw] max-w-4xl h-[94vh] rounded-md flex flex-col border-2 border-[#64748b] overflow-hidden my-auto shadow-2xl">
            <div
              className="text-white px-3 py-1.5 flex justify-between items-center text-[10.5px] font-bold shrink-0"
              style={{ background: 'var(--primary)' }}
            >
              <span>📦 دليل الأصناف (اختر صنفاً للإضافة السريعة)</span>
              <span
                style={{ cursor: 'pointer', fontSize: '18px' }}
                onClick={() => setIsLookupModalOpen(false)}
              >
                &times;
              </span>
            </div>

            <div className="flex flex-1 p-1 gap-1 overflow-hidden">
              {/* Categories Sidebar */}
              <div className="w-[85px] sm:w-[100px] bg-[#f8fafc] border border-[#94a3b8] rounded flex flex-col overflow-hidden shrink-0">
                <div className="bg-[#f1f5f9] p-1 text-[8px] font-bold border-b border-[#cbd5e1] flex flex-col items-center gap-1">
                  <span>المجموعات</span>
                  <button
                    type="button"
                    onClick={openNewItemDialog}
                    style={{ background: 'var(--accent)' }}
                    className="text-white rounded px-1.5 py-1 text-[8px] font-bold cursor-pointer w-full"
                    title="إضافة صنف جديد"
                  >
                    + صنف جديد
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <div
                    onClick={() => setSelectedCategory('all')}
                    className={`p-1.5 text-[8px] font-bold border-b border-[#e2e8f0] cursor-pointer text-center ${
                      selectedCategory === 'all' ? 'bg-[#0284c7] text-white' : 'text-[#1e293b] hover:bg-slate-100'
                    }`}
                  >
                    الكل
                  </div>
                  {categoriesList.map((cat) => (
                    <div
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`p-1.5 text-[8px] font-bold border-b border-[#e2e8f0] cursor-pointer text-center truncate ${
                        selectedCategory === cat ? 'bg-[#0284c7] text-white' : 'text-[#1e293b] hover:bg-slate-100'
                      }`}
                      title={cat}
                    >
                      {cat}
                    </div>
                  ))}
                </div>
              </div>

              {/* Items Panel */}
              <div className="flex-1 bg-[#f8fafc] border border-[#94a3b8] rounded flex flex-col p-1 gap-1 overflow-hidden">
                <div className="bg-white p-1 border border-[#cbd5e1] rounded flex items-center shrink-0">
                  <input
                    type="text"
                    value={lookupSearch}
                    onChange={(e) => setLookupSearch(e.target.value)}
                    placeholder="بحث بالاسم أو الكود..."
                    className="h-[24px] flex-1 text-[9.5px] border-none outline-none px-1"
                  />
                </div>

                <div className="flex-1 overflow-y-auto flex flex-col gap-1 p-0.5">
                  {(appData.items || [])
                    .filter((item) => {
                      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
                      if (!lookupSearch) return true;
                      const q = lookupSearch.toLowerCase().trim();
                      return item.name.toLowerCase().includes(q) || (item.code && item.code.toLowerCase().includes(q));
                    })
                    .map((item) => {
                      const stock = Number(item.quantity ?? (item as any).stock ?? 0);
                      const isZeroOrLess = stock <= 0;
                      return (
                        <div
                          key={item.id}
                          onClick={() => quickAddItemToInvoice(item)}
                          className={`bg-white border rounded p-1.5 flex flex-col gap-0.5 cursor-pointer shadow-xs hover:border-blue-600 transition ${
                            isZeroOrLess ? 'border-rose-400 bg-rose-50/20' : 'border-[#cbd5e1]'
                          }`}
                        >
                          <div className="flex justify-between items-center font-bold text-[9.5px] border-b border-[#f1f5f9] pb-0.5">
                            <span className="text-[#1e293b]">
                              {item.name} <small style={{ color: isZeroOrLess ? '#dc2626' : '#64748b', fontWeight: 'normal' }}>({item.category || 'عامة'})</small>
                            </span>
                            <span style={{ color: '#0284c7', fontSize: '8.5px' }} className="font-mono">{item.code || item.id}</span>
                          </div>
                          <div className="grid grid-cols-4 gap-1 text-[8px] text-center pt-0.5">
                            <div className={`p-0.5 rounded border ${isZeroOrLess ? 'bg-[#fff5f5] border-[#fca5a5]' : 'bg-[#f8fafc] border-[#e2e8f0]'}`}>
                              <span className="block text-[6px] text-[#64748b]">المتاح</span>
                              <strong style={{ color: stock < 0 ? '#dc2626' : (stock === 0 ? '#d97706' : '#0284c7'), fontSize: '9px' }}>
                                {stock}
                              </strong>
                            </div>
                            <div className="bg-[#f8fafc] p-0.5 rounded border border-[#e2e8f0]">
                              <span className="block text-[6px] text-[#64748b]">نقدي</span>
                              <strong style={{ color: '#16a34a' }}>{Number(item.salePrice || item.price || 0).toFixed(2)}</strong>
                            </div>
                            <div className="bg-[#f8fafc] p-0.5 rounded border border-[#e2e8f0]">
                              <span className="block text-[6px] text-[#64748b]">جملة</span>
                              <strong style={{ color: '#d97706' }}>{Number(item.wholesalePrice || item.price || 0).toFixed(2)}</strong>
                            </div>
                            <div className="bg-[#f8fafc] p-0.5 rounded border border-[#e2e8f0]">
                              <span className="block text-[6px] text-[#64748b]">شراء</span>
                              <strong style={{ color: '#dc2626' }}>{Number(item.costPrice || item.purchasePrice || item.price || 0).toFixed(2)}</strong>
                            </div>
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

      {/* نافذة إضافة صنف جديد للمخزون (editItemModal) */}
      {isNewItemModalOpen && (
        <div
          className="fixed inset-0 bg-black/65 z-[2000] flex justify-center items-center p-2"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsNewItemModalOpen(false);
          }}
        >
          <div className="bg-white w-full max-w-[400px] rounded-lg overflow-hidden flex flex-col border border-slate-300 shadow-2xl my-auto">
            <div
              className="text-white px-2.5 py-1.5 flex justify-between items-center text-[10.5px] font-bold"
              style={{ background: 'var(--secondary)' }}
            >
              <span>إضافة صنف جديد للمخزون</span>
              <span
                style={{ cursor: 'pointer', fontSize: '18px' }}
                onClick={() => setIsNewItemModalOpen(false)}
              >
                &times;
              </span>
            </div>
            <div className="p-2 flex flex-col gap-1.5 text-xs">
              <div style={{ background: '#eff6ff', padding: '3px 6px', borderRadius: '3px', color: '#1d4ed8', fontWeight: 'bold', fontSize: '8.5px' }}>
                إضافة مباشرة للمخزون وإدراجه بالفاتورة
              </div>
              <div className="grid grid-cols-2 gap-1">
                <div className="col-span-2 flex flex-col gap-0.5">
                  <label className="text-[8.5px] font-bold text-slate-700">اسم الصنف الجديد</label>
                  <input
                    type="text"
                    value={newInputItemName}
                    onChange={(e) => setNewInputItemName(e.target.value)}
                    className="h-[24px] border border-slate-300 rounded px-1.5 text-[9.5px]"
                  />
                </div>
                <div className="col-span-2 flex flex-col gap-0.5">
                  <label className="text-[8.5px] font-bold text-slate-700">كود الصنف (تلقائي)</label>
                  <input
                    type="text"
                    value={newInputItemCode}
                    readOnly
                    style={{ background: '#f1f5f9', fontWeight: 'bold' }}
                    className="h-[24px] border border-slate-300 rounded px-1.5 text-[9.5px]"
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="text-[8.5px] font-bold text-slate-700">سعر الشراء الأساسي</label>
                  <input
                    type="number"
                    step="any"
                    value={editBuyPrice}
                    onChange={(e) => {
                      setEditBuyPrice(e.target.value);
                      calculatePricesFromMargin(
                        parseFloat(e.target.value) || 0,
                        parseFloat(editCashProfitMargin) || 0,
                        parseFloat(editWholesaleProfitMargin) || 0
                      );
                    }}
                    className="h-[24px] border border-slate-300 rounded px-1.5 text-[9.5px]"
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="text-[8.5px] font-bold text-slate-700">المجموعة</label>
                  <select
                    value={editItemCategory}
                    onChange={(e) => setEditItemCategory(e.target.value)}
                    className="h-[24px] border border-slate-300 rounded px-1 text-[9.5px]"
                  >
                    {categoriesList.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="text-[8.5px] font-bold text-slate-700">ربح القطاعي (% أو ج.م)</label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      step="any"
                      placeholder="%"
                      value={editCashProfitMargin}
                      onChange={(e) => {
                        setEditCashProfitMargin(e.target.value);
                        calculatePricesFromMargin(
                          parseFloat(editBuyPrice) || 0,
                          parseFloat(e.target.value) || 0,
                          parseFloat(editWholesaleProfitMargin) || 0
                        );
                      }}
                      className="h-[24px] flex-1 border border-slate-300 rounded px-1 text-[9px]"
                    />
                    <input
                      type="number"
                      step="any"
                      placeholder="ج.م"
                      value={editCashPriceManual}
                      onChange={(e) => {
                        setEditCashPriceManual(e.target.value);
                        calculateMarginFromManualPrice('cash');
                      }}
                      className="h-[24px] flex-1 border border-slate-300 rounded px-1 text-[9px]"
                    />
                  </div>
                  <span style={{ fontSize: '7px', color: '#16a34a', fontWeight: 'bold' }}>{lblCalcCashMargin}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="text-[8.5px] font-bold text-slate-700">ربح الجملة (% أو ج.م)</label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      step="any"
                      placeholder="%"
                      value={editWholesaleProfitMargin}
                      onChange={(e) => {
                        setEditWholesaleProfitMargin(e.target.value);
                        calculatePricesFromMargin(
                          parseFloat(editBuyPrice) || 0,
                          parseFloat(editCashProfitMargin) || 0,
                          parseFloat(e.target.value) || 0
                        );
                      }}
                      className="h-[24px] flex-1 border border-slate-300 rounded px-1 text-[9px]"
                    />
                    <input
                      type="number"
                      step="any"
                      placeholder="ج.م"
                      value={editWholesalePriceManual}
                      onChange={(e) => {
                        setEditWholesalePriceManual(e.target.value);
                        calculateMarginFromManualPrice('wholesale');
                      }}
                      className="h-[24px] flex-1 border border-slate-300 rounded px-1 text-[9px]"
                    />
                  </div>
                  <span style={{ fontSize: '7px', color: '#d97706', fontWeight: 'bold' }}>{lblCalcWholesaleMargin}</span>
                </div>
                <div className="col-span-2 flex flex-col gap-0.5">
                  <label className="text-[8.5px] font-bold text-slate-700">الكمية بالمخزون</label>
                  <input
                    type="number"
                    step="any"
                    value={editQty}
                    onChange={(e) => setEditQty(e.target.value)}
                    className="h-[24px] border border-slate-300 rounded px-1.5 text-[9.5px]"
                  />
                </div>
              </div>

              <button
                type="button"
                style={{ background: 'var(--accent)', marginTop: '4px' }}
                className="w-full text-white py-2 rounded text-[10px] font-bold cursor-pointer"
                onClick={saveNewItemData}
              >
                <i className="fa-solid fa-check"></i> حفظ والرجوع للفاتورة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تعديل بيانات البند داخل الفاتورة (modifyInvoiceItemModal) */}
      {isModifyModalOpen && (
        <div
          className="fixed inset-0 bg-black/65 z-[2000] flex justify-center items-center p-2"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModifyModalOpen(false);
          }}
        >
          <div className="bg-white w-full max-w-[400px] rounded-lg overflow-hidden flex flex-col border border-slate-300 shadow-2xl my-auto">
            <div
              className="text-white px-2.5 py-1.5 flex justify-between items-center text-[10.5px] font-bold"
              style={{ background: 'var(--secondary)' }}
            >
              <span>✏️ تعديل صنف في الفاتورة</span>
              <span
                style={{ cursor: 'pointer', fontSize: '18px' }}
                onClick={() => setIsModifyModalOpen(false)}
              >
                &times;
              </span>
            </div>
            <div className="p-2.5 flex flex-col gap-2 text-xs">
              <div className="flex flex-col gap-0.5">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] font-bold text-slate-700">اسم الصنف</label>
                  {modifyStock !== null && (
                    <span className="text-[8.5px] text-slate-500 font-mono">
                      رصيد المخزن: <strong className={modifyStock <= 0 ? 'text-rose-600' : 'text-blue-600'}>{modifyStock}</strong>
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={modifyName}
                  readOnly
                  style={{ background: '#f1f5f9' }}
                  className="h-[24px] border border-slate-300 rounded px-1.5 text-[9.5px] font-bold text-slate-800"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-0.5">
                  <label className="text-[9px] font-bold text-slate-700">الكمية</label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    value={modifyQty}
                    onChange={(e) => setModifyQty(e.target.value)}
                    className="h-[24px] border border-slate-300 rounded px-1.5 text-[9.5px] font-mono text-slate-900 font-bold"
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="text-[9px] font-bold text-slate-700">سعر البيع (ج.م)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={modifyPrice}
                    onChange={(e) => setModifyPrice(e.target.value)}
                    className="h-[24px] border border-slate-300 rounded px-1.5 text-[9.5px] font-mono text-slate-900 font-bold"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-0.5">
                <label className="text-[9px] font-bold text-slate-700">الوصف / البيان</label>
                <input
                  type="text"
                  value={modifySpec}
                  onChange={(e) => setModifySpec(e.target.value)}
                  placeholder="ملاحظات أو مواصفات خاصة..."
                  className="h-[24px] border border-slate-300 rounded px-1.5 text-[9.5px] text-slate-800"
                />
              </div>

              {/* Total preview */}
              <div className="bg-slate-50 border border-slate-200 p-1.5 rounded flex justify-between items-center text-[10px] font-bold text-slate-800">
                <span>الإجمالي المحسوب:</span>
                <span className="font-mono text-emerald-700 font-black text-xs">
                  {((parseFloat(modifyQty) || 0) * (parseFloat(modifyPrice) || 0)).toFixed(2)} ج.م
                </span>
              </div>

              <div className="flex gap-1.5 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (modifyIndex > -1) {
                      removeItemFromInvoice(modifyIndex);
                      setIsModifyModalOpen(false);
                      showToast('تم حذف الصنف من الفاتورة', 'info');
                    }
                  }}
                  className="px-2 py-1.5 bg-rose-50 text-rose-700 border border-rose-300 rounded text-[9.5px] font-bold cursor-pointer hover:bg-rose-100"
                >
                  🗑️ حذف
                </button>
                <button
                  type="button"
                  style={{ background: 'var(--accent)' }}
                  className="flex-1 text-white py-1.5 rounded text-[10px] font-bold cursor-pointer"
                  onClick={saveModifiedItem}
                >
                  ✓ حفظ التعديل والرجوع للفاتورة
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
