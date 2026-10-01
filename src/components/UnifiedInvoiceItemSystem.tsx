import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Boxes,
  FolderTree,
  Search,
  Plus,
  Minus,
  Check,
  X,
  Edit,
  Trash2,
  Save,
  CreditCard,
  Percent,
  Coins,
  DollarSign,
  Layers,
  ArrowRight,
  ChevronDown,
  Tag,
  Receipt,
  Calculator,
  AlertTriangle,
} from 'lucide-react';
import { Item } from '../types';

export interface InvoiceItemUnified {
  code: string;
  name: string;
  price: number;
  qty: number;
  discVal: number;
  discType: 'val' | 'percent';
  actualDisc: number;
  taxVal: number;
  taxType: 'percent' | 'val';
  actualTax: number;
  spec: string;
  total: number;
  itemId?: string;
  costPrice?: number;
}

export interface PaymentRow {
  id: string;
  method: string;
  amount: number;
}

export interface CatalogLookupItem {
  id?: string;
  code: string;
  name: string;
  category: string;
  stock: number;
  cashPrice: number;
  wholesalePrice: number;
  buyPrice: number;
}

// Built-in default catalog matching the user's template specification
export const DEFAULT_TEMPLATE_ITEMS: CatalogLookupItem[] = [
  { code: 'G017', name: 'بستلة 2026 A', category: 'بويات', stock: 1030.0, cashPrice: 580.0, wholesalePrice: 540.0, buyPrice: 480.0 },
  { code: 'G018', name: 'بستلة 2026 B', category: 'بويات', stock: 25.0, cashPrice: 560.0, wholesalePrice: 520.0, buyPrice: 460.0 },
  { code: 'G019', name: 'جالون 2020', category: 'بويات', stock: 121.0, cashPrice: 350.0, wholesalePrice: 320.0, buyPrice: 280.0 },
  { code: 'G020', name: 'سيلر ممتاز GLC', category: 'بويات', stock: 450.0, cashPrice: 230.0, wholesalePrice: 210.0, buyPrice: 180.0 },
  { code: 'G021', name: 'معجون بطانة 02', category: 'مواد إنسداد', stock: 78.0, cashPrice: 95.0, wholesalePrice: 85.0, buyPrice: 70.0 },
];

export const PAYMENT_METHODS = [
  'نقدي / كاش',
  'انستاباي Instapay',
  'فودافون كاش Vodafone Cash',
  'فيزا / كارت Visa',
];

interface UnifiedInvoiceItemSystemProps {
  // Mode & context
  mode?: 'sale' | 'purchase' | 'return_sale' | 'return_purchase';
  pricingType?: 'cash' | 'wholesale' | 'buy';
  catalogItems?: Item[];

  // Invoice Items
  currentInvoiceItems?: InvoiceItemUnified[];
  items?: InvoiceItemUnified[];
  onItemsChange?: (items: InvoiceItemUnified[]) => void;
  onChangeItems?: (items: InvoiceItemUnified[]) => void;

  // Global Discount & Tax
  globalInvDisc: number;
  onGlobalInvDiscChange?: (val: number) => void;
  onChangeGlobalInvDisc?: (val: number) => void;
  invDiscType: 'val' | 'percent';
  onInvDiscTypeChange?: (type: 'val' | 'percent') => void;
  onChangeInvDiscType?: (type: 'val' | 'percent') => void;

  globalInvTax: number;
  onGlobalInvTaxChange?: (val: number) => void;
  onChangeGlobalInvTax?: (val: number) => void;
  invTaxType: 'percent' | 'val';
  onInvTaxTypeChange?: (type: 'percent' | 'val') => void;
  onChangeInvTaxType?: (type: 'percent' | 'val') => void;

  // Extra Income / Service / Shipping
  extraIncomeName: string;
  onExtraIncomeNameChange?: (val: string) => void;
  onChangeExtraIncomeName?: (val: string) => void;
  extraIncomeVal: number;
  onExtraIncomeValChange?: (val: number) => void;
  onChangeExtraIncomeVal?: (val: number) => void;

  // Multi Payment Rows
  paymentRows: PaymentRow[];
  onPaymentRowsChange?: (rows: PaymentRow[]) => void;
  onChangePaymentRows?: (rows: PaymentRow[]) => void;

  // Save invoice action
  onSaveInvoice?: () => void;
  isSaving?: boolean;
  hidePrintActions?: boolean;
  hideSaveButton?: boolean;
}

export const UnifiedInvoiceItemSystem: React.FC<UnifiedInvoiceItemSystemProps> = ({
  mode = 'sale',
  pricingType = 'cash',
  catalogItems = [],
  currentInvoiceItems: propItems,
  items: aliasItems,
  onItemsChange: propOnItemsChange,
  onChangeItems: aliasOnChangeItems,
  globalInvDisc,
  onGlobalInvDiscChange,
  onChangeGlobalInvDisc,
  invDiscType,
  onInvDiscTypeChange,
  onChangeInvDiscType,
  globalInvTax,
  onGlobalInvTaxChange,
  onChangeGlobalInvTax,
  invTaxType,
  onInvTaxTypeChange,
  onChangeInvTaxType,
  extraIncomeName,
  onExtraIncomeNameChange,
  onChangeExtraIncomeName,
  extraIncomeVal,
  onExtraIncomeValChange,
  onChangeExtraIncomeVal,
  paymentRows,
  onPaymentRowsChange,
  onChangePaymentRows,
  onSaveInvoice,
  isSaving = false,
  hidePrintActions = true,
  hideSaveButton = false,
}) => {
  const currentInvoiceItems = propItems ?? aliasItems ?? [];
  const onItemsChange = (items: InvoiceItemUnified[]) => {
    propOnItemsChange?.(items);
    aliasOnChangeItems?.(items);
  };
  const setGlobalInvDisc = (val: number) => {
    onGlobalInvDiscChange?.(val);
    onChangeGlobalInvDisc?.(val);
  };
  const setInvDiscType = (val: 'val' | 'percent') => {
    onInvDiscTypeChange?.(val);
    onChangeInvDiscType?.(val);
  };
  const setGlobalInvTax = (val: number) => {
    onGlobalInvTaxChange?.(val);
    onChangeGlobalInvTax?.(val);
  };
  const setInvTaxType = (val: 'percent' | 'val') => {
    onInvTaxTypeChange?.(val);
    onChangeInvTaxType?.(val);
  };
  const setExtraIncomeName = (val: string) => {
    onExtraIncomeNameChange?.(val);
    onChangeExtraIncomeName?.(val);
  };
  const setExtraIncomeVal = (val: number) => {
    onExtraIncomeValChange?.(val);
    onChangeExtraIncomeVal?.(val);
  };
  const setPaymentRows = (rows: PaymentRow[]) => {
    onPaymentRowsChange?.(rows);
    onChangePaymentRows?.(rows);
  };
  // Modals state
  const [isLookupOpen, setIsLookupOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Lookup state
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchType, setSearchType] = useState<'start' | 'contains'>('start');

  // Edit/Add modal state
  const [editingIndex, setEditingIndex] = useState<number>(-1);
  const [tempSelectedItem, setTempSelectedItem] = useState<CatalogLookupItem | null>(null);

  const [priceTier, setPriceTier] = useState<'cash' | 'wholesale' | 'buy' | 'custom'>('cash');
  const [editPrice, setEditPrice] = useState<string>('0.00');
  const [editQty, setEditQty] = useState<string>('1');
  const [editDiscValue, setEditDiscValue] = useState<string>('0.00');
  const [editDiscType, setEditDiscType] = useState<'val' | 'percent'>('val');
  const [editTaxValue, setEditTaxValue] = useState<string>('0.00');
  const [editTaxType, setEditTaxType] = useState<'percent' | 'val'>('percent');
  const [editSpec, setEditSpec] = useState<string>('');

  const lookupSearchInputRef = useRef<HTMLInputElement>(null);
  const editPriceInputRef = useRef<HTMLInputElement>(null);
  const editQtyInputRef = useRef<HTMLInputElement>(null);
  const editDiscValueInputRef = useRef<HTMLInputElement>(null);
  const editTaxValueInputRef = useRef<HTMLInputElement>(null);
  const editSpecInputRef = useRef<HTMLInputElement>(null);

  const handlePriceTierChange = (tier: 'cash' | 'wholesale' | 'buy' | 'custom') => {
    setPriceTier(tier);
    if (!tempSelectedItem) return;
    if (tier === 'cash') {
      setEditPrice(tempSelectedItem.cashPrice.toFixed(2));
    } else if (tier === 'wholesale') {
      setEditPrice(tempSelectedItem.wholesalePrice.toFixed(2));
    } else if (tier === 'buy') {
      setEditPrice(tempSelectedItem.buyPrice.toFixed(2));
    }
  };

  const handleManualPriceChange = (val: string) => {
    setEditPrice(val);
    const num = parseFloat(val);
    if (!tempSelectedItem || isNaN(num)) {
      setPriceTier('custom');
      return;
    }
    if (Math.abs(num - tempSelectedItem.cashPrice) < 0.001) {
      setPriceTier('cash');
    } else if (Math.abs(num - tempSelectedItem.wholesalePrice) < 0.001) {
      setPriceTier('wholesale');
    } else if (Math.abs(num - tempSelectedItem.buyPrice) < 0.001) {
      setPriceTier('buy');
    } else {
      setPriceTier('custom');
    }
  };

  const incrementQty = () => {
    const cur = parseFloat(editQty) || 0;
    setEditQty(String(cur + 1));
  };

  const decrementQty = () => {
    const cur = parseFloat(editQty) || 0;
    if (cur > 1) {
      setEditQty(String(cur - 1));
    }
  };

  // Merge database items with template items
  const fullCatalog: CatalogLookupItem[] = useMemo(() => {
    if (catalogItems && catalogItems.length > 0) {
      return catalogItems.map((i) => ({
        id: i.id,
        code: i.code || i.barcode || `ITM-${i.id.substring(0, 6)}`,
        name: i.name,
        category: i.category || 'عام',
        stock: Number(i.quantity ?? 0),
        cashPrice: Number(i.salePrice || i.normalSellingPrice || i.price || 0),
        wholesalePrice: Number(i.wholesalePrice || i.wholesaleSellingPrice || i.salePrice || 0),
        buyPrice: Number(i.purchasePrice || i.costPrice || 0),
      }));
    }
    return DEFAULT_TEMPLATE_ITEMS;
  }, [catalogItems]);

  // Extract unique categories
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    fullCatalog.forEach((item) => {
      if (item.category && item.category.trim()) {
        set.add(item.category.trim());
      }
    });
    if ((!catalogItems || catalogItems.length === 0) && set.size === 0) {
      ['بويات', 'مواد إنسداد', 'ديكورات', 'حداد'].forEach((c) => set.add(c));
    }
    return Array.from(set);
  }, [fullCatalog, catalogItems]);

  // Filter items in lookup modal
  const filteredLookupItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return fullCatalog.filter((item) => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }
      if (!q) return true;

      const name = (item.name || '').toLowerCase();
      const code = (item.code || '').toLowerCase();

      if (searchType === 'start') {
        return name.startsWith(q) || code.startsWith(q);
      } else {
        return name.includes(q) || code.includes(q);
      }
    });
  }, [fullCatalog, selectedCategory, searchQuery, searchType]);

  // Open Lookup Modal
  const openLookupModal = () => {
    setIsLookupOpen(true);
    setTimeout(() => {
      lookupSearchInputRef.current?.focus();
    }, 150);
  };

  const closeLookupModal = () => {
    setIsLookupOpen(false);
  };

  // Open Edit Item Modal
  const openEditModal = (item: CatalogLookupItem, index = -1) => {
    setEditingIndex(index);
    setTempSelectedItem(item);
    setIsLookupOpen(false);
    setIsEditOpen(true);

    if (index > -1 && currentInvoiceItems[index]) {
      const cur = currentInvoiceItems[index];
      setEditPrice(String(cur.price));
      setEditQty(String(cur.qty));
      setEditDiscValue(String(cur.discVal));
      setEditDiscType(cur.discType);
      setEditTaxValue(String(cur.taxVal));
      setEditTaxType(cur.taxType);
      setEditSpec(cur.spec || '');
      if (Math.abs(cur.price - item.cashPrice) < 0.001) {
        setPriceTier('cash');
      } else if (Math.abs(cur.price - item.wholesalePrice) < 0.001) {
        setPriceTier('wholesale');
      } else if (Math.abs(cur.price - item.buyPrice) < 0.001) {
        setPriceTier('buy');
      } else {
        setPriceTier('custom');
      }
    } else {
      // Determine default price based on invoice mode
      let defaultP = item.cashPrice;
      let initialTier: 'cash' | 'wholesale' | 'buy' | 'custom' = 'cash';
      if (mode === 'purchase' || mode === 'return_purchase' || pricingType === 'buy') {
        defaultP = item.buyPrice;
        initialTier = 'buy';
      } else if (pricingType === 'wholesale') {
        defaultP = item.wholesalePrice;
        initialTier = 'wholesale';
      }

      setPriceTier(initialTier);
      setEditPrice(Number(defaultP).toFixed(2));
      setEditQty('1');
      setEditDiscValue('0.00');
      setEditDiscType('val');
      setEditTaxValue('0.00');
      setEditTaxType('percent');
      setEditSpec('');
    }

    setTimeout(() => {
      editPriceInputRef.current?.focus();
    }, 150);
  };

  const closeEditModal = () => {
    setIsEditOpen(false);
    setTempSelectedItem(null);
    setEditingIndex(-1);
  };

  // Keyboard Enter navigation in Edit Item Modal
  const handleEnterKey = (e: React.KeyboardEvent, nextAction: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      switch (nextAction) {
        case 'editQty':
          editQtyInputRef.current?.focus();
          break;
        case 'editDiscValue':
          editDiscValueInputRef.current?.focus();
          break;
        case 'editTaxValue':
          editTaxValueInputRef.current?.focus();
          break;
        case 'editSpec':
          editSpecInputRef.current?.focus();
          break;
        case 'pushToInvoice':
          pushToInvoice();
          break;
        default:
          break;
      }
    }
  };

  // Push confirmed item into invoice using exact math formulas
  const pushToInvoice = () => {
    if (!tempSelectedItem) return;

    const price = parseFloat(editPrice) || 0;
    const qty = parseFloat(editQty) || 1;
    const discVal = parseFloat(editDiscValue) || 0;
    const discType = editDiscType;
    const taxVal = parseFloat(editTaxValue) || 0;
    const taxType = editTaxType;
    const spec = editSpec.trim();

    // Exact formula from user specification
    const actualDisc = discType === 'percent' ? (price * qty) * (discVal / 100) : (discVal * qty);
    const baseAfterDisc = (price * qty) - actualDisc;
    const actualTax = taxType === 'percent' ? baseAfterDisc * (taxVal / 100) : (taxVal * qty);
    const total = baseAfterDisc + actualTax;

    const itemObj: InvoiceItemUnified = {
      code: tempSelectedItem.code,
      name: tempSelectedItem.name,
      price,
      qty,
      discVal,
      discType,
      actualDisc,
      taxVal,
      taxType,
      actualTax,
      spec,
      total,
      itemId: tempSelectedItem.id,
      costPrice: tempSelectedItem.buyPrice,
    };

    const updated = [...currentInvoiceItems];
    if (editingIndex > -1) {
      updated[editingIndex] = itemObj;
    } else {
      updated.push(itemObj);
    }

    onItemsChange(updated);
    closeEditModal();
  };

  // Remove Item
  const removeItem = (index: number) => {
    const updated = [...currentInvoiceItems];
    updated.splice(index, 1);
    onItemsChange(updated);
  };

  // Payment Rows Management
  const addPaymentRow = (defaultMethod = 'نقدي / كاش') => {
    const newRow: PaymentRow = {
      id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      method: defaultMethod,
      amount: 0,
    };
    setPaymentRows([...(paymentRows || []), newRow]);
  };

  const updatePaymentRowMethod = (id: string, method: string) => {
    const updated = (paymentRows || []).map((r) => (r.id === id ? { ...r, method } : r));
    setPaymentRows(updated);
  };

  const updatePaymentRowAmount = (id: string, val: string) => {
    const amount = parseFloat(val) || 0;
    const updated = (paymentRows || []).map((r) => (r.id === id ? { ...r, amount } : r));
    setPaymentRows(updated);
  };

  const removePaymentRow = (id: string) => {
    const updated = (paymentRows || []).filter((r) => r.id !== id);
    setPaymentRows(updated);
  };

  // Ensure at least one payment row exists on first load
  useEffect(() => {
    if (!paymentRows || paymentRows.length === 0) {
      setPaymentRows([
        { id: `pay_${Date.now()}`, method: 'نقدي / كاش', amount: 0 },
      ]);
    }
  }, []);

  // Compute all totals dynamically
  const {
    itemsSubTotal,
    itemsDisc,
    itemsTax,
    totalDisc,
    totalTax,
    netTotal,
    paidTotal,
    remainTotal,
  } = useMemo(() => {
    let sub = 0;
    let d = 0;
    let t = 0;

    currentInvoiceItems.forEach((i) => {
      sub += i.price * i.qty;
      d += i.actualDisc;
      t += i.actualTax;
    });

    const globalDiscInput = globalInvDisc || 0;
    const globalDiscCalculated =
      invDiscType === 'percent'
        ? (sub - d) * (globalDiscInput / 100)
        : globalDiscInput;

    const globalTaxInput = globalInvTax || 0;
    const baseForGlobalTax = sub - d - globalDiscCalculated;
    const globalTaxCalculated =
      invTaxType === 'percent'
        ? baseForGlobalTax * (globalTaxInput / 100)
        : globalTaxInput;

    const extraIncome = extraIncomeVal || 0;
    const totD = d + globalDiscCalculated;
    const totT = t + globalTaxCalculated;
    const net = sub - totD + totT + extraIncome;

    let paid = 0;
    paymentRows.forEach((r) => {
      paid += r.amount || 0;
    });

    const remain = net - paid;

    return {
      itemsSubTotal: sub,
      itemsDisc: d,
      itemsTax: t,
      totalDisc: totD,
      totalTax: totT,
      netTotal: net,
      paidTotal: paid,
      remainTotal: remain,
    };
  }, [
    currentInvoiceItems,
    globalInvDisc,
    invDiscType,
    globalInvTax,
    invTaxType,
    extraIncomeVal,
    paymentRows,
  ]);

  return (
    <div className="w-full flex flex-col gap-4 text-slate-800" dir="rtl">
      {/* 1. Large Touch-Friendly Button to Open Catalog / Categories */}
      <button
        type="button"
        id="btn-open-catalog-lookup"
        onClick={openLookupModal}
        className="w-full min-h-[48px] py-3.5 px-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 hover:from-blue-800 hover:to-indigo-900 active:scale-[0.99] text-white rounded-xl font-black text-sm sm:text-base shadow-md transition-all cursor-pointer flex items-center justify-center gap-2.5 touch-manipulation"
      >
        <Boxes className="w-5 h-5 text-amber-300 shrink-0" />
        <span>فتح دليل الأصناف والمجموعات (إضافة صنف للفاتورة)</span>
      </button>

      {/* 2. Items List / Table with Touch Optimization */}
      <div className="w-full bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        {currentInvoiceItems.length === 0 ? (
          <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center gap-2.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Boxes className="w-6 h-6" />
            </div>
            <p className="font-bold text-slate-700 text-sm">لم يتم إدراج أي أصناف في الفاتورة بعد</p>
            <p className="text-xs text-slate-400">
              اضغط على زر "فتح دليل الأصناف والمجموعات" أعلاه لاختيار وتعديل الأصناف بسهولة
            </p>
          </div>
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto max-h-[320px] border border-slate-300 rounded-lg">
              <table className="w-full border-collapse text-xs text-center border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 font-black sticky top-0 border-b-2 border-slate-300 z-10">
                    <th className="py-3 px-2 text-center w-14 border border-slate-300 font-black text-black">كود</th>
                    <th className="py-3 px-3 text-right border border-slate-300 font-black text-black">الصنف</th>
                    <th className="py-3 px-2 text-center w-16 border border-slate-300 font-black text-black">الكمية</th>
                    <th className="py-3 px-2 text-center w-24 border border-slate-300 font-black text-black">السعر</th>
                    <th className="py-3 px-2 text-center w-20 border border-slate-300 font-black text-black">الخصم</th>
                    <th className="py-3 px-2 text-center w-20 border border-slate-300 font-black text-black">الضريبة</th>
                    <th className="py-3 px-3 text-right border border-slate-300 font-black text-black">البيان / التفاصيل</th>
                    <th className="py-3 px-3 text-center w-24 border border-slate-300 font-black text-black">الإجمالي</th>
                    <th className="py-3 px-2 text-center w-20 border border-slate-300 font-black text-black">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {currentInvoiceItems.map((item, index) => {
                    const catalogMatch = fullCatalog.find((c) => c.code === item.code) || {
                      code: item.code,
                      name: item.name,
                      category: 'عام',
                      stock: 0,
                      cashPrice: item.price,
                      wholesalePrice: item.price,
                      buyPrice: item.price,
                    };
                    return (
                      <tr key={index} className="bg-white hover:bg-slate-100 transition-colors border-b border-slate-200">
                        <td className="py-2.5 px-2 font-mono font-black text-black border border-slate-300">
                          <span className="bg-slate-100 px-1 py-0.5 rounded border border-slate-300">{item.code}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-black border border-slate-300 text-xs sm:text-sm">{item.name}</td>
                        <td className="py-2.5 px-2 font-mono font-black text-black border border-slate-300 text-xs sm:text-sm">{item.qty}</td>
                        <td className="py-2.5 px-2 font-mono font-black text-black border border-slate-300 text-xs sm:text-sm">
                          {item.price.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-2 font-mono text-black font-black border border-slate-300">
                          {item.discVal > 0 ? `${item.discVal}${item.discType === 'percent' ? '%' : ' ج'}` : '-'}
                        </td>
                        <td className="py-2.5 px-2 font-mono text-black font-black border border-slate-300">
                          {item.taxVal > 0 ? `${item.taxVal}${item.taxType === 'percent' ? '%' : ' ج'}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right text-black font-bold border border-slate-300 truncate max-w-[160px]">
                          {item.spec || '-'}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-black text-black border border-slate-300 text-xs sm:text-sm">
                          {item.total.toFixed(2)} ج.م
                        </td>
                        <td className="py-2.5 px-2 border border-slate-300">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditModal(catalogMatch, index)}
                              className="w-8 h-8 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-900 border border-blue-400 flex items-center justify-center transition-colors cursor-pointer"
                              title="تعديل الصنف"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              className="w-8 h-8 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-900 border border-rose-400 flex items-center justify-center transition-colors cursor-pointer"
                              title="حذف الصنف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Touch-Friendly Cards View */}
            <div className="block md:hidden p-2 space-y-2.5 max-h-[380px] overflow-y-auto">
              {currentInvoiceItems.map((item, index) => {
                const catalogMatch = fullCatalog.find((c) => c.code === item.code) || {
                  code: item.code,
                  name: item.name,
                  category: 'عام',
                  stock: 0,
                  cashPrice: item.price,
                  wholesalePrice: item.price,
                  buyPrice: item.price,
                };
                return (
                  <div
                    key={index}
                    className="flex flex-col gap-2.5 bg-white p-3.5 rounded-xl border-2 border-slate-300 shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[11px] bg-slate-100 text-black border border-slate-300 px-2 py-0.5 rounded font-black">
                            {item.code}
                          </span>
                          <span className="font-black text-black text-sm">{item.name}</span>
                        </div>
                        {item.spec && (
                          <p className="text-xs text-slate-800 mt-1 line-clamp-2">
                            البيان: <span className="text-black font-bold">{item.spec}</span>
                          </p>
                        )}
                      </div>
                      <div className="text-left shrink-0">
                        <div className="text-sm font-black text-black font-mono">
                          {item.total.toFixed(2)} ج.م
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-black bg-slate-50 p-2.5 rounded-lg border border-slate-300 font-bold">
                      <div className="flex items-center gap-2">
                        <span>الكمية: <strong className="font-mono text-black font-black">{item.qty}</strong></span>
                        <span>×</span>
                        <span className="font-mono font-black">{item.price.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        {item.discVal > 0 && (
                          <span className="text-black font-black bg-amber-100 border border-amber-300 px-2 py-0.5 rounded">
                            خصم: {item.discVal}{item.discType === 'percent' ? '%' : ' ج'}
                          </span>
                        )}
                        {item.taxVal > 0 && (
                          <span className="text-black font-black bg-indigo-100 border border-indigo-300 px-2 py-0.5 rounded">
                            ضريبة: {item.taxVal}{item.taxType === 'percent' ? '%' : ' ج'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => openEditModal(catalogMatch, index)}
                        className="min-h-[40px] px-3.5 py-1.5 bg-blue-100 hover:bg-blue-200 active:bg-blue-300 text-blue-950 border border-blue-400 rounded-lg text-xs font-black flex items-center gap-1.5 transition-colors touch-manipulation cursor-pointer"
                      >
                        <Edit className="w-4 h-4" />
                        <span>تعديل الصنف</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="min-h-[40px] px-3.5 py-1.5 bg-rose-100 hover:bg-rose-200 active:bg-rose-300 text-rose-950 border border-rose-400 rounded-lg text-xs font-black flex items-center gap-1.5 transition-colors touch-manipulation cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>حذف</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 3. Extra Sections (Discount, Tax, Extra Revenue, Multi-Payment) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-100 p-3.5 rounded-xl border-2 border-slate-300">
        {/* Global Invoice Discount & Tax */}
        <div className="bg-white p-3.5 rounded-xl border-2 border-slate-300 flex flex-col gap-2.5 shadow-xs">
          <div className="text-xs font-black text-black border-b-2 border-slate-200 pb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Tag className="w-4 h-4 text-amber-600" />
              <span>خصم / ضريبة الفاتورة الكلية</span>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {/* Global Discount */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-black">خصم الفاتورة</label>
                <div className="flex border-2 border-blue-700 rounded overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setInvDiscType('val')}
                    className={`px-2 py-0.5 text-xs font-black transition cursor-pointer ${
                      invDiscType === 'val' ? 'bg-blue-700 text-white' : 'bg-white text-blue-900 hover:bg-blue-50'
                    }`}
                  >
                    ج.م
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvDiscType('percent')}
                    className={`px-2 py-0.5 text-xs font-black transition cursor-pointer ${
                      invDiscType === 'percent' ? 'bg-blue-700 text-white' : 'bg-white text-blue-900 hover:bg-blue-50'
                    }`}
                  >
                    %
                  </button>
                </div>
              </div>
              <input
                type="number"
                min="0"
                step="any"
                value={globalInvDisc === 0 ? '' : globalInvDisc}
                placeholder="0.00"
                onChange={(e) => setGlobalInvDisc(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                className="w-full p-2.5 bg-white border-2 border-slate-400 rounded-lg text-xs font-black text-black focus:outline-none focus:border-blue-700 font-mono shadow-xs"
              />
            </div>

            {/* Global Tax */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-black">ضريبة الفاتورة</label>
                <div className="flex border-2 border-blue-700 rounded overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setInvTaxType('percent')}
                    className={`px-2 py-0.5 text-xs font-black transition cursor-pointer ${
                      invTaxType === 'percent' ? 'bg-blue-700 text-white' : 'bg-white text-blue-900 hover:bg-blue-50'
                    }`}
                  >
                    %
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvTaxType('val')}
                    className={`px-2 py-0.5 text-xs font-black transition cursor-pointer ${
                      invTaxType === 'val' ? 'bg-blue-700 text-white' : 'bg-white text-blue-900 hover:bg-blue-50'
                    }`}
                  >
                    ج.م
                  </button>
                </div>
              </div>
              <input
                type="number"
                min="0"
                step="any"
                value={globalInvTax === 0 ? '' : globalInvTax}
                placeholder="0.00"
                onChange={(e) => setGlobalInvTax(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                className="w-full p-2.5 bg-white border-2 border-slate-400 rounded-lg text-xs font-black text-black focus:outline-none focus:border-blue-700 font-mono shadow-xs"
              />
            </div>
          </div>
        </div>

        {/* Extra Income / Delivery / Shipping */}
        <div className="bg-white p-3.5 rounded-xl border-2 border-slate-300 flex flex-col gap-2.5 shadow-xs">
          <div className="text-xs font-black text-black border-b-2 border-slate-200 pb-1.5 flex items-center justify-between">
            <span>الإيراد الإضافي (مصاريف شحن/خدمة)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-black text-black">اسم الإيراد</label>
              <input
                type="text"
                placeholder="خدمة توصيل / شحن..."
                value={extraIncomeName}
                onChange={(e) => setExtraIncomeName(e.target.value)}
                className="w-full p-2.5 bg-white border-2 border-slate-400 rounded-lg text-xs font-black text-black focus:outline-none focus:border-blue-700 placeholder:text-slate-500 shadow-xs"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-black text-black">مبلغ الإيراد (ج.م)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={extraIncomeVal === 0 ? '' : extraIncomeVal}
                placeholder="0.00"
                onChange={(e) => setExtraIncomeVal(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                className="w-full p-2.5 bg-white border-2 border-slate-400 rounded-lg text-xs font-black text-black focus:outline-none focus:border-blue-700 font-mono shadow-xs"
              />
            </div>
          </div>
        </div>

        {/* Multi-Payment Methods Row */}
        <div className="md:col-span-2 bg-white p-3.5 rounded-xl border-2 border-slate-300 flex flex-col gap-2.5 shadow-xs">
          <div className="text-xs font-black text-black border-b-2 border-slate-200 pb-1.5 flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-blue-700" />
              <span>تحديد طريقة / طرق الدفع المتعددة:</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (paymentRows && paymentRows.length > 0) {
                    const updated = [...paymentRows];
                    updated[0] = { ...updated[0], amount: netTotal };
                    setPaymentRows(updated);
                  } else {
                    setPaymentRows([{ id: `pay_${Date.now()}`, method: 'نقدي / كاش', amount: netTotal }]);
                  }
                }}
                className="px-2.5 py-1 text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-300 rounded-lg cursor-pointer transition shadow-xs"
              >
                ⚡ سداد كامل الصافي كاش
              </button>
              <button
                type="button"
                onClick={() => addPaymentRow('نقدي / كاش')}
                className="px-3 py-1.5 text-xs font-black bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white rounded-lg cursor-pointer transition-colors shadow-xs flex items-center gap-1 touch-manipulation"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة طريقة دفع</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {paymentRows.map((row) => (
              <div key={row.id} className="flex items-center gap-2">
                <select
                  value={row.method}
                  onChange={(e) => updatePaymentRowMethod(row.id, e.target.value)}
                  className="w-44 sm:w-60 p-2.5 bg-white border-2 border-slate-400 rounded-lg text-xs font-black text-black focus:outline-none focus:border-blue-700 shadow-xs cursor-pointer"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  min="0"
                  step="any"
                  value={row.amount === 0 ? '' : row.amount}
                  placeholder="المبلغ المدفوع (0.00)"
                  onChange={(e) => updatePaymentRowAmount(row.id, e.target.value)}
                  className="flex-1 p-2.5 bg-white border-2 border-slate-400 rounded-lg text-xs font-black text-black focus:outline-none focus:border-blue-700 font-mono shadow-xs"
                />

                {paymentRows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePaymentRow(row.id)}
                    className="p-2 text-rose-700 hover:text-white hover:bg-rose-600 rounded-lg border border-rose-300 transition-colors cursor-pointer"
                    title="حذف طريقة الدفع"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Summary Bar (خالٍ تماماً من الألوان الغامقة - تصميم فاتح، مشرق، عالي التباين) */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border-2 border-slate-300 shadow-xs flex flex-wrap items-center justify-between gap-2.5 text-xs sm:text-sm">
        <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
          <span className="text-slate-700 font-bold">إجمالي الأصناف:</span>
          <span className="font-mono font-black text-slate-950 text-sm sm:text-base">{itemsSubTotal.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2 bg-amber-50 px-3 py-2 rounded-xl border border-amber-200">
          <span className="text-amber-900 font-bold">الخصومات:</span>
          <span className="font-mono font-black text-amber-950 text-sm sm:text-base">{totalDisc.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2 bg-indigo-50 px-3 py-2 rounded-xl border border-indigo-200">
          <span className="text-indigo-900 font-bold">الضرائب:</span>
          <span className="font-mono font-black text-indigo-950 text-sm sm:text-base">{totalTax.toFixed(2)}</span>
        </div>
        {extraIncomeVal > 0 && (
          <div className="flex items-center gap-2 bg-teal-50 px-3 py-2 rounded-xl border border-teal-200">
            <span className="text-teal-900 font-bold">الإيراد الإضافي:</span>
            <span className="font-mono font-black text-teal-950 text-sm sm:text-base">{extraIncomeVal.toFixed(2)}</span>
          </div>
        )}
        <div className="flex items-center gap-2 bg-emerald-50 px-4 py-2.5 rounded-xl border-2 border-emerald-400 shadow-xs">
          <span className="text-emerald-950 font-black text-sm sm:text-base">الصافي النهائي:</span>
          <span className="font-mono font-black text-emerald-950 text-base sm:text-lg">{netTotal.toFixed(2)} ج.م</span>
        </div>
        <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-xl border border-blue-200">
          <span className="text-blue-900 font-bold">المدفوع:</span>
          <span className="font-mono font-black text-blue-950 text-sm sm:text-base">{paidTotal.toFixed(2)}</span>
        </div>
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
            remainTotal > 0
              ? 'bg-rose-50 border-rose-300 text-rose-950'
              : 'bg-emerald-50 border-emerald-300 text-emerald-950'
          }`}
        >
          <span className="font-bold">المتبقي:</span>
          <span className="font-mono font-black text-sm sm:text-base">{remainTotal.toFixed(2)}</span>
        </div>
      </div>

      {/* 5. Action Bar (تظهر فقط عند عدم وجود زر الحفظ في النافذة الرئيسية لمنع أي تكرار) */}
      {!hideSaveButton && onSaveInvoice && (
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={onSaveInvoice}
            disabled={isSaving || currentInvoiceItems.length === 0}
            className="flex-1 min-h-[48px] py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-black text-sm sm:text-base shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer touch-manipulation"
          >
            <Save className="w-5 h-5" />
            <span>{isSaving ? 'جاري الحفظ والترحيل...' : 'حفظ وترحيل الحسابات'}</span>
          </button>
        </div>
      )}

      {/* ================= 1. MODAL: Large Item Lookup Modal (بالمجموعات) ================= */}
      {isLookupOpen && (
        <div className="fixed inset-0 z-[10000] bg-black/75 flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div
            className="bg-white border-2 border-slate-700 rounded-xl w-[98vw] h-[94vh] max-w-7xl flex flex-col overflow-hidden shadow-2xl"
            dir="rtl"
          >
            {/* Header (تصميم فاتح عالي التباين) */}
            <div className="bg-slate-100 text-slate-900 px-4 py-3 flex items-center justify-between border-b-2 border-slate-300 shrink-0">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-700" />
                <span className="font-black text-sm sm:text-base text-black">بالمجموعات - اختيار صنف للفاتورة</span>
              </div>
              <button
                type="button"
                onClick={closeLookupModal}
                className="w-8 h-8 rounded-lg bg-slate-200 hover:bg-red-600 text-slate-800 hover:text-white flex items-center justify-center text-lg font-black transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Layout: Desktop Split, Mobile Stack */}
            <div className="flex-1 flex flex-col md:flex-row gap-2 p-2 overflow-hidden bg-slate-100">
              {/* Category Panel: Dropdown on Mobile (< md), Vertical Sidebar on Desktop (>= md) */}
              {/* Mobile Category Dropdown Selector */}
              <div className="block md:hidden w-full bg-white p-2.5 rounded-xl border-2 border-slate-300 shadow-xs shrink-0">
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="mobile-category-dropdown" className="text-xs font-black text-black flex items-center gap-1.5">
                    <FolderTree className="w-4 h-4 text-amber-500" />
                    <span>المجموعة التصنيفية (قائمة منسدلة):</span>
                  </label>
                  <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-300">
                    {selectedCategory === 'all'
                      ? `الكل (${fullCatalog.length} صنف)`
                      : `${selectedCategory} (${fullCatalog.filter((i) => i.category === selectedCategory).length} صنف)`}
                  </span>
                </div>
                <div className="relative">
                  <select
                    id="mobile-category-dropdown"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full h-11 px-3 pl-10 bg-white border-2 border-slate-500 rounded-xl text-xs sm:text-sm font-black text-black focus:outline-none focus:border-blue-700 shadow-xs appearance-none cursor-pointer"
                  >
                    <option value="all">📂 الكل (عرض جميع الأصناف - {fullCatalog.length} صنف)</option>
                    {categoriesList.map((cat, idx) => {
                      const count = fullCatalog.filter((i) => i.category === cat).length;
                      return (
                        <option key={cat} value={cat}>
                          📁 {String(idx + 1).padStart(2, '0')} - {cat} ({count} صنف)
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDown className="w-5 h-5 text-slate-700 absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>

              {/* Desktop Category Sidebar */}
              <div className="hidden md:flex w-64 bg-white rounded-lg border-2 border-slate-300 flex-col shrink-0 overflow-hidden shadow-xs">
                <div className="bg-slate-100 text-slate-900 px-3 py-2.5 font-black text-xs border-b border-slate-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FolderTree className="w-4 h-4 text-amber-600" />
                    <span>المجموعات التصنيفية:</span>
                  </div>
                  <span className="text-[10px] bg-slate-200 text-slate-800 px-2 py-0.5 rounded-md font-mono font-bold">
                    {categoriesList.length} مجموعات
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto divide-y divide-slate-200">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('all')}
                    className={`w-full px-3 py-2.5 text-xs font-black text-right transition-colors flex items-center justify-between cursor-pointer ${
                      selectedCategory === 'all'
                        ? 'bg-blue-700 text-white shadow-xs font-black'
                        : 'text-black hover:bg-slate-100'
                    }`}
                  >
                    <span>الكل (عرض جميع الأصناف)</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                        selectedCategory === 'all' ? 'bg-blue-900 text-white' : 'bg-slate-200 text-black'
                      }`}
                    >
                      {fullCatalog.length}
                    </span>
                  </button>
                  {categoriesList.map((cat, idx) => {
                    const count = fullCatalog.filter((i) => i.category === cat).length;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`w-full px-3 py-2.5 text-xs font-bold text-right transition-colors flex items-center justify-between cursor-pointer ${
                          selectedCategory === cat
                            ? 'bg-blue-700 text-white shadow-xs font-black'
                            : 'text-black hover:bg-slate-100'
                        }`}
                      >
                        <span>{String(idx + 1).padStart(2, '0')} - {cat}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                            selectedCategory === cat ? 'bg-blue-900 text-white' : 'bg-slate-200 text-black'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Items Panel */}
              <div className="flex-1 bg-white rounded-lg border-2 border-slate-300 flex flex-col p-2 gap-2 overflow-hidden shadow-xs">
                {/* Search top bar */}
                <div className="bg-slate-50 p-2.5 rounded-lg border-2 border-slate-300 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 text-xs font-black text-black cursor-pointer">
                      <input
                        type="radio"
                        name="searchType"
                        value="start"
                        checked={searchType === 'start'}
                        onChange={() => setSearchType('start')}
                        className="text-blue-700 w-4 h-4"
                      />
                      <span>بداية الاسم</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs font-black text-black cursor-pointer">
                      <input
                        type="radio"
                        name="searchType"
                        value="contains"
                        checked={searchType === 'contains'}
                        onChange={() => setSearchType('contains')}
                        className="text-blue-700 w-4 h-4"
                      />
                      <span>وسط الاسم</span>
                    </label>
                  </div>

                  <div className="flex items-center gap-2 flex-1 max-w-md justify-end">
                    <label className="text-xs font-black text-black shrink-0">بحث:</label>
                    <div className="relative flex-1">
                      <input
                        ref={lookupSearchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="اكتب اسم الصنف أو الكود..."
                        className="w-full h-10 px-3 pr-8 bg-white border-2 border-slate-400 rounded-lg text-xs font-black text-black focus:outline-none focus:border-blue-700 placeholder:text-slate-500"
                      />
                      <Search className="w-4 h-4 text-slate-600 absolute right-2.5 top-3" />
                    </div>
                  </div>
                </div>

                {/* Table & Mobile Cards Container */}
                <div className="flex-1 overflow-y-auto border-2 border-slate-300 rounded-lg bg-white">
                  {filteredLookupItems.length === 0 ? (
                    <div className="p-8 text-center text-slate-700 flex flex-col items-center justify-center gap-3">
                      <p className="text-xs sm:text-sm font-bold text-black">لا توجد أصناف مطابقة للبحث المحدد</p>
                      {searchQuery.trim() && (
                        <button
                          type="button"
                          onClick={() =>
                            openEditModal({
                              code: `NEW-${Math.floor(100 + Math.random() * 900)}`,
                              name: searchQuery.trim(),
                              category: selectedCategory !== 'all' ? selectedCategory : 'عام',
                              stock: 0,
                              cashPrice: 0,
                              wholesalePrice: 0,
                              buyPrice: 0,
                            })
                          }
                          className="min-h-[44px] px-4 py-2 bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer shadow-xs touch-manipulation"
                        >
                          <Plus className="w-4 h-4" />
                          <span>إدراج "{searchQuery.trim()}" كصنف مخصص بالفاتورة</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div>
                      {/* Desktop Lookup Table */}
                      <table className="hidden md:table w-full border-collapse text-xs text-center border border-slate-300">
                        <thead>
                          <tr className="bg-slate-100 text-slate-900 font-black sticky top-0 border-b-2 border-slate-300 z-10">
                            <th className="py-2.5 px-3 w-24 text-black font-black border border-slate-300">كود</th>
                            <th className="py-2.5 px-4 text-right text-black font-black border border-slate-300">اسم الصنف / المجموعة</th>
                            <th className="py-2.5 px-3 w-28 text-black font-black border border-slate-300">الرصيد المتاح</th>
                            <th className="py-2.5 px-3 w-32 text-black font-black border border-slate-300">سعر البيع النقدي</th>
                            <th className="py-2.5 px-3 w-32 text-black font-black border border-slate-300">سعر البيع الجملة</th>
                            <th className="py-2.5 px-3 w-28 text-black font-black border border-slate-300">سعر الشراء</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-300 bg-white">
                          {filteredLookupItems.map((item, idx) => (
                            <tr
                              key={item.code + '_' + idx}
                              onClick={() => openEditModal(item)}
                              className="bg-white hover:bg-blue-50 cursor-pointer transition-colors border-b border-slate-300"
                            >
                              <td className="py-2.5 px-3 font-mono font-black text-black border border-slate-300">
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300">{item.code}</span>
                              </td>
                              <td className="py-2.5 px-4 text-right font-black text-black border border-slate-300 text-xs sm:text-sm">{item.name}</td>
                              <td className="py-2.5 px-3 font-mono font-black text-blue-900 border border-slate-300">
                                {item.stock.toFixed(2)}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-black text-emerald-900 border border-slate-300">
                                {item.cashPrice.toFixed(2)} ج.م
                              </td>
                              <td className="py-2.5 px-3 font-mono font-black text-amber-900 border border-slate-300">
                                {item.wholesalePrice.toFixed(2)} ج.م
                              </td>
                              <td className="py-2.5 px-3 font-mono font-black text-rose-900 border border-slate-300">
                                {item.buyPrice.toFixed(2)} ج.م
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Mobile Touch-Friendly Card List */}
                      <div className="block md:hidden p-2 space-y-2.5">
                        {filteredLookupItems.map((item, idx) => (
                          <div
                            key={item.code + '_' + idx}
                            onClick={() => openEditModal(item)}
                            className="bg-white active:bg-blue-100 p-3.5 rounded-xl border-2 border-slate-300 flex flex-col gap-2 transition-colors cursor-pointer touch-manipulation shadow-xs"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="font-mono text-xs bg-slate-100 text-black border border-slate-300 px-2 py-0.5 rounded font-black">
                                  {item.code}
                                </span>
                                <h4 className="font-black text-black text-sm mt-1">{item.name}</h4>
                                <span className="text-xs text-slate-800 font-bold">المجموعة: {item.category}</span>
                              </div>
                              <span className="text-xs font-black text-blue-900 bg-blue-100 border border-blue-300 px-2.5 py-1 rounded-md font-mono shrink-0">
                                رصيد: {item.stock.toFixed(2)}
                              </span>
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1.5 border-t border-slate-200">
                              <div className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200">
                                <span className="block text-[11px] text-emerald-950 font-bold">نقدي</span>
                                <span className="font-mono font-black text-emerald-900 text-xs">
                                  {item.cashPrice.toFixed(2)}
                                </span>
                              </div>
                              <div className="p-1.5 rounded-lg bg-amber-50 border border-amber-200">
                                <span className="block text-[11px] text-amber-950 font-bold">جملة</span>
                                <span className="font-mono font-black text-amber-900 text-xs">
                                  {item.wholesalePrice.toFixed(2)}
                                </span>
                              </div>
                              <div className="p-1.5 rounded-lg bg-rose-50 border border-rose-200">
                                <span className="block text-[11px] text-rose-950 font-bold">شراء</span>
                                <span className="font-mono font-black text-rose-900 text-xs">
                                  {item.buyPrice.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= 2. MODAL: Edit / Add Item Modal (كارت تعديل/إضافة الصنف المنظم والانسيابي) ================= */}
      {isEditOpen && tempSelectedItem && (() => {
        const modalPrice = parseFloat(editPrice) || 0;
        const modalQty = parseFloat(editQty) || 1;
        const modalDiscVal = parseFloat(editDiscValue) || 0;
        const modalTaxVal = parseFloat(editTaxValue) || 0;

        const modalSubtotal = modalPrice * modalQty;
        const modalCalculatedDisc =
          editDiscType === 'percent'
            ? modalSubtotal * (modalDiscVal / 100)
            : modalDiscVal * modalQty;
        const modalAfterDisc = Math.max(0, modalSubtotal - modalCalculatedDisc);
        const modalCalculatedTax =
          editTaxType === 'percent'
            ? modalAfterDisc * (modalTaxVal / 100)
            : modalTaxVal * modalQty;
        const modalItemTotal = modalAfterDisc + modalCalculatedTax;

        return (
          <div className="fixed inset-0 z-[10001] bg-black/75 flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
            <div
              className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col border-2 border-slate-600 my-auto"
              dir="rtl"
            >
              {/* Header (تصميم فاتح وأنيق عالي التباين) */}
              <div className="bg-slate-100 text-slate-900 px-4 py-3 flex items-center justify-between border-b-2 border-slate-300">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
                    <Edit className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm sm:text-base text-black">
                      {editingIndex > -1 ? 'تعديل بيانات الصنف بالفاتورة' : 'إدراج صنف وتحديد السعر والكمية'}
                    </h3>
                    <p className="text-[11px] text-slate-600 font-bold">
                      كود الصنف: <span className="font-mono text-blue-900 font-black">{tempSelectedItem.code}</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="w-8 h-8 rounded-lg bg-slate-200 hover:bg-red-600 text-slate-800 hover:text-white flex items-center justify-center text-sm font-black transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div className="p-4 sm:p-5 flex flex-col gap-3.5 bg-white max-h-[82vh] overflow-y-auto">
                {/* Item Summary Banner */}
                <div className="bg-slate-50 p-3 rounded-xl border-2 border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 block">اسم الصنف والمجموعة</span>
                    <h4 className="text-sm sm:text-base font-black text-black">{tempSelectedItem.name}</h4>
                    <span className="text-xs text-blue-900 font-bold">📁 {tempSelectedItem.category}</span>
                  </div>
                  <div className="flex items-center gap-2 sm:flex-col sm:items-end bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-600">الرصيد المتاح بالمخزن:</span>
                    <span
                      className={`font-mono font-black text-sm sm:text-base px-2 py-0.5 rounded-md ${
                        tempSelectedItem.stock < 0
                          ? 'text-rose-950 bg-rose-100 border border-rose-300'
                          : tempSelectedItem.stock === 0
                          ? 'text-amber-900 bg-amber-50 border border-amber-300'
                          : 'text-emerald-800 bg-emerald-50 border border-emerald-200'
                      }`}
                    >
                      {tempSelectedItem.stock < 0 ? `⚠️ رصيد سالب: ${tempSelectedItem.stock.toFixed(2)}` : `${tempSelectedItem.stock.toFixed(2)} قطعة`}
                    </span>
                  </div>
                </div>

                {/* Visual Alert Banner for Negative Sale */}
                {modalQty > tempSelectedItem.stock && (mode === 'sale' || mode === 'return_sale') && (
                  <div className="bg-rose-50 border-2 border-rose-300 p-2.5 rounded-xl flex items-center justify-between text-xs text-rose-950 font-bold animate-in fade-in duration-150 shadow-xs">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-rose-700 shrink-0" />
                      <div>
                        <span className="font-black text-rose-950 block">⚠️ تنبيه رصيد المخزون: الكمية المطلوبة ({modalQty}) تتجاوز الرصيد المتاح ({tempSelectedItem.stock.toFixed(2)})</span>
                        <span className="text-[11px] text-rose-800 font-semibold">متاح ومفعل البيع بالسالب تلقائياً - الرصيد المتوقع بعد الحفظ: {(tempSelectedItem.stock - modalQty).toFixed(2)}</span>
                      </div>
                    </div>
                    <span className="bg-rose-700 text-white text-[11px] font-black px-2.5 py-1 rounded-lg shrink-0 shadow-xs">
                      بيع بالسالب مسموح
                    </span>
                  </div>
                )}

                {/* 1. Price Tier Dropdown Selector (قائمة منسدلة لاختيار إذا كان الصنف جملة أو شراء أو نقدي) */}
                <div className="bg-blue-50/70 p-3 rounded-xl border-2 border-blue-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="select-price-tier" className="text-xs font-black text-blue-950 flex items-center gap-1.5">
                      <Tag className="w-4 h-4 text-blue-700" />
                      <span>اختيار نوع السعر (قائمة منسدلة):</span>
                    </label>
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-300">
                      {priceTier === 'cash'
                        ? 'سعر نقدي'
                        : priceTier === 'wholesale'
                        ? 'سعر جملة'
                        : priceTier === 'buy'
                        ? 'سعر شراء'
                        : 'سعر مخصص'}
                    </span>
                  </div>

                  <div className="relative">
                    <select
                      id="select-price-tier"
                      value={priceTier}
                      onChange={(e) => handlePriceTierChange(e.target.value as any)}
                      className="w-full h-11 px-3 pl-10 bg-white border-2 border-blue-400 focus:border-blue-700 rounded-xl text-xs sm:text-sm font-black text-black shadow-xs appearance-none cursor-pointer focus:outline-none"
                    >
                      <option value="cash">
                        🟢 سعر بيع نقدي (قطاعي) — {tempSelectedItem.cashPrice.toFixed(2)} ج.م
                      </option>
                      <option value="wholesale">
                        🟡 سعر بيع جملة — {tempSelectedItem.wholesalePrice.toFixed(2)} ج.م
                      </option>
                      <option value="buy">
                        🔴 سعر شراء / تكلفة — {tempSelectedItem.buyPrice.toFixed(2)} ج.م
                      </option>
                      <option value="custom">
                        ✏️ سعر يدوي / مخصص
                      </option>
                    </select>
                    <ChevronDown className="w-5 h-5 text-blue-700 absolute left-3 top-3 pointer-events-none" />
                  </div>

                  {/* Fast click chips */}
                  <div className="flex items-center gap-1.5 pt-0.5 overflow-x-auto text-[11px]">
                    <button
                      type="button"
                      onClick={() => handlePriceTierChange('cash')}
                      className={`px-2 py-1 rounded-lg font-black border transition cursor-pointer shrink-0 ${
                        priceTier === 'cash'
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                          : 'bg-white text-emerald-900 border-emerald-300 hover:bg-emerald-50'
                      }`}
                    >
                      نقدي: {tempSelectedItem.cashPrice.toFixed(2)}
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePriceTierChange('wholesale')}
                      className={`px-2 py-1 rounded-lg font-black border transition cursor-pointer shrink-0 ${
                        priceTier === 'wholesale'
                          ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                          : 'bg-white text-amber-900 border-amber-300 hover:bg-amber-50'
                      }`}
                    >
                      جملة: {tempSelectedItem.wholesalePrice.toFixed(2)}
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePriceTierChange('buy')}
                      className={`px-2 py-1 rounded-lg font-black border transition cursor-pointer shrink-0 ${
                        priceTier === 'buy'
                          ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                          : 'bg-white text-rose-900 border-rose-300 hover:bg-rose-50'
                      }`}
                    >
                      شراء: {tempSelectedItem.buyPrice.toFixed(2)}
                    </button>
                  </div>
                </div>

                {/* 2. Price Input & Quantity Stepper */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Unit Price */}
                  <div className="flex flex-col gap-1.5 bg-slate-50 p-2.5 rounded-xl border-2 border-slate-300">
                    <label className="text-xs font-black text-black flex items-center justify-between">
                      <span>السعر للوحدة</span>
                      <span className="text-[10px] text-slate-500 font-normal">بالجنيه المصري</span>
                    </label>
                    <div className="relative">
                      <input
                        ref={editPriceInputRef}
                        type="number"
                        min="0"
                        step="any"
                        value={editPrice}
                        onChange={(e) => handleManualPriceChange(e.target.value)}
                        onKeyDown={(e) => handleEnterKey(e, 'editQty')}
                        className="w-full h-11 px-3 pl-10 bg-white border-2 border-slate-400 focus:border-blue-700 rounded-xl text-sm font-black font-mono text-black focus:outline-none shadow-xs"
                      />
                      <span className="absolute left-3 top-2.5 text-xs font-black text-slate-600">ج.م</span>
                    </div>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="flex flex-col gap-1.5 bg-slate-50 p-2.5 rounded-xl border-2 border-slate-300">
                    <label className="text-xs font-black text-black flex items-center justify-between">
                      <span>الكمية المطلوبة</span>
                      <span className="text-[10px] text-blue-700 font-bold">أزرار سريعة +/-</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={decrementQty}
                        className="w-10 h-11 bg-white hover:bg-slate-100 active:bg-slate-200 border-2 border-slate-400 text-black font-black text-lg rounded-xl flex items-center justify-center cursor-pointer shadow-xs touch-manipulation"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <input
                        ref={editQtyInputRef}
                        type="number"
                        min="0.001"
                        step="any"
                        value={editQty}
                        onChange={(e) => setEditQty(e.target.value)}
                        onKeyDown={(e) => handleEnterKey(e, 'editDiscValue')}
                        className="flex-1 h-11 px-2 text-center bg-white border-2 border-slate-400 focus:border-blue-700 rounded-xl text-sm sm:text-base font-black font-mono text-black focus:outline-none shadow-xs"
                      />
                      <button
                        type="button"
                        onClick={incrementQty}
                        className="w-10 h-11 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black text-lg rounded-xl flex items-center justify-center cursor-pointer shadow-xs touch-manipulation"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 3. Reorganized Discount & Tax Sections (مبلغ ثابت أو نسبة مئوية) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Discount Box */}
                  <div className="bg-amber-50/60 p-3 rounded-xl border-2 border-amber-300 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-amber-950 flex items-center gap-1">
                        <Tag className="w-3.5 h-3.5 text-amber-700" />
                        <span>الخصم على الصنف</span>
                      </label>
                      {/* Segmented Type Toggle */}
                      <div className="flex bg-white p-0.5 rounded-lg border-2 border-amber-300">
                        <button
                          type="button"
                          onClick={() => setEditDiscType('val')}
                          className={`px-2 py-0.5 text-xs font-black rounded transition ${
                            editDiscType === 'val'
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'text-amber-900 hover:bg-amber-100'
                          }`}
                        >
                          مبلغ ثابت
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditDiscType('percent')}
                          className={`px-2 py-0.5 text-xs font-black rounded transition ${
                            editDiscType === 'percent'
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'text-amber-900 hover:bg-amber-100'
                          }`}
                        >
                          نسبة %
                        </button>
                      </div>
                    </div>

                    <div className="relative">
                      <input
                        ref={editDiscValueInputRef}
                        type="number"
                        min="0"
                        step="any"
                        value={editDiscValue}
                        onChange={(e) => setEditDiscValue(e.target.value)}
                        onKeyDown={(e) => handleEnterKey(e, 'editTaxValue')}
                        placeholder={editDiscType === 'percent' ? 'نسبة الخصم %' : 'مبلغ الخصم ج.م'}
                        className="w-full h-10 px-3 pl-8 bg-white border-2 border-amber-400 focus:border-amber-600 rounded-xl text-xs sm:text-sm font-black font-mono text-black focus:outline-none shadow-xs"
                      />
                      <span className="absolute left-3 top-2 text-xs font-black text-amber-800">
                        {editDiscType === 'percent' ? '%' : 'ج.م'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-0.5">
                      <span className="text-slate-600 font-bold">الخصم المحسوب:</span>
                      <span className="font-mono font-black text-rose-700">
                        - {modalCalculatedDisc.toFixed(2)} ج.م
                      </span>
                    </div>
                  </div>

                  {/* Tax Box */}
                  <div className="bg-indigo-50/60 p-3 rounded-xl border-2 border-indigo-300 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-indigo-950 flex items-center gap-1">
                        <Receipt className="w-3.5 h-3.5 text-indigo-700" />
                        <span>الضريبة على الصنف</span>
                      </label>
                      {/* Segmented Type Toggle */}
                      <div className="flex bg-white p-0.5 rounded-lg border-2 border-indigo-300">
                        <button
                          type="button"
                          onClick={() => setEditTaxType('percent')}
                          className={`px-2 py-0.5 text-xs font-black rounded transition ${
                            editTaxType === 'percent'
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'text-indigo-900 hover:bg-indigo-100'
                          }`}
                        >
                          نسبة %
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditTaxType('val')}
                          className={`px-2 py-0.5 text-xs font-black rounded transition ${
                            editTaxType === 'val'
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'text-indigo-900 hover:bg-indigo-100'
                          }`}
                        >
                          مبلغ ثابت
                        </button>
                      </div>
                    </div>

                    <div className="relative">
                      <input
                        ref={editTaxValueInputRef}
                        type="number"
                        min="0"
                        step="any"
                        value={editTaxValue}
                        onChange={(e) => setEditTaxValue(e.target.value)}
                        onKeyDown={(e) => handleEnterKey(e, 'editSpec')}
                        placeholder={editTaxType === 'percent' ? 'نسبة الضريبة %' : 'مبلغ الضريبة ج.م'}
                        className="w-full h-10 px-3 pl-8 bg-white border-2 border-indigo-400 focus:border-indigo-600 rounded-xl text-xs sm:text-sm font-black font-mono text-black focus:outline-none shadow-xs"
                      />
                      <span className="absolute left-3 top-2 text-xs font-black text-indigo-800">
                        {editTaxType === 'percent' ? '%' : 'ج.م'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-0.5">
                      <span className="text-slate-600 font-bold">الضريبة المحسوبة:</span>
                      <span className="font-mono font-black text-blue-700">
                        + {modalCalculatedTax.toFixed(2)} ج.م
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. Spec / Notes Input */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-black text-black">البيان / ملاحظات الصنف (اختياري)</label>
                  <input
                    ref={editSpecInputRef}
                    type="text"
                    placeholder="تفاصيل المنتج أو ملاحظات إضافية على الصنف..."
                    value={editSpec}
                    onChange={(e) => setEditSpec(e.target.value)}
                    onKeyDown={(e) => handleEnterKey(e, 'pushToInvoice')}
                    className="w-full h-10 px-3 bg-white border-2 border-slate-400 focus:border-blue-700 rounded-xl text-xs font-bold text-black focus:outline-none placeholder:text-slate-500 shadow-xs"
                  />
                </div>

                {/* 5. Live Real-Time Calculation Card (ملخص الحسبة الفورية للصنف - تصميم فاتح ومشرق بدون ألوان غامقة) */}
                <div className="bg-slate-50 text-slate-900 p-3.5 rounded-xl border-2 border-slate-300 flex flex-col gap-2 shadow-xs">
                  <div className="flex items-center justify-between text-xs border-b border-slate-200 pb-1.5 font-bold">
                    <span className="text-slate-800 flex items-center gap-1.5">
                      <Calculator className="w-4 h-4 text-blue-700" />
                      <span>الحسبة التلقائية للصنف:</span>
                    </span>
                    <span className="text-slate-700 font-mono font-bold">
                      {modalPrice.toFixed(2)} × {modalQty} = {modalSubtotal.toFixed(2)} ج.م
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-white p-1.5 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-600 block font-bold">الخصم</span>
                      <span className="font-mono font-black text-rose-700 text-xs">
                        -{modalCalculatedDisc.toFixed(2)}
                      </span>
                    </div>
                    <div className="bg-white p-1.5 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-600 block font-bold">الضريبة</span>
                      <span className="font-mono font-black text-blue-700 text-xs">
                        +{modalCalculatedTax.toFixed(2)}
                      </span>
                    </div>
                    <div className="bg-emerald-50 p-1.5 rounded-lg border border-emerald-300">
                      <span className="text-[10px] text-emerald-900 block font-bold">الصافي</span>
                      <span className="font-mono font-black text-emerald-950 text-xs">
                        {modalItemTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                    <span className="text-xs font-black text-slate-900">الإجمالي المستحق للصنف:</span>
                    <span className="font-mono font-black text-base sm:text-lg text-emerald-800">
                      {modalItemTotal.toFixed(2)} ج.م
                    </span>
                  </div>
                </div>

                {/* 6. Action Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="w-24 min-h-[46px] py-2.5 px-3 bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-black rounded-xl font-black text-xs transition cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    id="btnPushToInv"
                    onClick={pushToInvoice}
                    className="flex-1 min-h-[46px] py-3 px-4 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white rounded-xl font-black text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer touch-manipulation"
                  >
                    <Check className="w-5 h-5" />
                    <span>تأكيد وإدراج بالفاتورة (Enter)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
