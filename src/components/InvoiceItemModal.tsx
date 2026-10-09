import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Plus, Percent, DollarSign, Calculator, Check, Search, Package, Sparkles, ChevronDown, Tag } from 'lucide-react';
import { InvoiceItem, Item } from '../types';

interface InvoiceItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: InvoiceItem) => void;
  catalogItems?: Item[];
  pricingType?: 'cash' | 'wholesale';
  mode?: 'sale' | 'purchase';
  initialItem?: InvoiceItem | null;
}

export const InvoiceItemModal: React.FC<InvoiceItemModalProps> = ({
  isOpen,
  onClose,
  onSave,
  catalogItems = [],
  pricingType = 'cash',
  mode = 'sale',
  initialItem = null,
}) => {
  // All inputs are empty by default - no hardcoded values or 14% tax!
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [qty, setQty] = useState<string>('');
  const [price, setPrice] = useState<string>('');
  const [costPrice, setCostPrice] = useState<number | undefined>(undefined);

  // Discount configuration
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('fixed');
  const [discountValue, setDiscountValue] = useState<string>('');

  // Tax configuration (Strictly empty / 0 by default, never 14%)
  const [taxType, setTaxType] = useState<'percent' | 'fixed'>('percent');
  const [taxValue, setTaxValue] = useState<string>('');

  // Catalog search autocomplete
  const [showCatalogDropdown, setShowCatalogDropdown] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [validationError, setValidationError] = useState<string>('');
  const qtyInputRef = useRef<HTMLInputElement | null>(null);

  // Prepopulate if editing
  useEffect(() => {
    if (initialItem) {
      setSelectedItemId(initialItem.itemId || '');
      setName(initialItem.name || '');
      setNotes(initialItem.notes || '');
      setQty(initialItem.qty ? String(initialItem.qty) : '');
      setPrice(initialItem.price !== undefined ? String(initialItem.price) : '');
      setCostPrice(initialItem.costPrice);

      const mappedDiscType: 'percent' | 'fixed' =
        initialItem.discType === 'val' || initialItem.discountType === 'fixed'
          ? 'fixed'
          : 'percent';
      setDiscountType(mappedDiscType);
      setDiscountValue(
        initialItem.discountValue !== undefined && initialItem.discountValue > 0
          ? String(initialItem.discountValue)
          : initialItem.discount !== undefined && initialItem.discount > 0
          ? String(initialItem.discount)
          : ''
      );

      const mappedTaxType: 'percent' | 'fixed' =
        initialItem.taxType === 'val' || initialItem.taxType === 'fixed'
          ? 'fixed'
          : 'percent';
      setTaxType(mappedTaxType);
      setTaxValue(
        initialItem.taxValue !== undefined && initialItem.taxValue > 0
          ? String(initialItem.taxValue)
          : initialItem.tax !== undefined && initialItem.tax > 0
          ? String(initialItem.tax)
          : ''
      );
      setValidationError('');
    } else {
      // Clean slate - completely empty inputs
      setSelectedItemId('');
      setName('');
      setNotes('');
      setQty('');
      setPrice('');
      setCostPrice(undefined);
      setDiscountType('fixed');
      setDiscountValue('');
      setTaxType('percent');
      setTaxValue(''); // Empty! User types if needed
      setShowCatalogDropdown(false);
      setSearchFilter('');
      setValidationError('');
    }
  }, [initialItem, isOpen]);

  // Filtered catalog items
  const filteredCatalog = useMemo(() => {
    if (!catalogItems || catalogItems.length === 0) return [];
    if (!name.trim()) return catalogItems.slice(0, 8);
    const q = name.toLowerCase().trim();
    return catalogItems
      .filter((i) => (i.name && i.name.toLowerCase().includes(q)) || (i.code && i.code.toLowerCase().includes(q)))
      .slice(0, 10);
  }, [catalogItems, name]);

  // Mathematical computations
  const numQty = parseFloat(qty) || 0;
  const numPrice = parseFloat(price) || 0;
  const baseSubtotal = numQty * numPrice;

  // Discount calc
  const rawDiscount = parseFloat(discountValue) || 0;
  let calculatedDiscount = 0;
  if (discountType === 'percent') {
    calculatedDiscount = (baseSubtotal * rawDiscount) / 100;
  } else {
    calculatedDiscount = rawDiscount;
  }
  if (calculatedDiscount > baseSubtotal) {
    calculatedDiscount = baseSubtotal;
  }

  // Tax calc
  const afterDiscount = Math.max(0, baseSubtotal - calculatedDiscount);
  const rawTax = parseFloat(taxValue) || 0;
  let calculatedTax = 0;
  if (taxType === 'percent') {
    calculatedTax = (afterDiscount * rawTax) / 100;
  } else {
    calculatedTax = rawTax;
  }

  // Final Item Total
  const finalItemTotal = Math.max(0, afterDiscount + calculatedTax);

  const handleSelectCatalogItem = (item: Item) => {
    setSelectedItemId(item.id);
    setName(item.name);
    setCostPrice(item.purchasePrice || 0);

    // Default item price depending on mode & tier
    if (mode === 'sale') {
      const itemPrice = pricingType === 'wholesale' && item.wholesalePrice ? item.wholesalePrice : item.salePrice || 0;
      setPrice(itemPrice > 0 ? String(itemPrice) : '');
    } else {
      // Purchase mode
      const pPrice = item.purchasePrice || 0;
      setPrice(pPrice > 0 ? String(pPrice) : '');
    }

    setShowCatalogDropdown(false);

    // Auto-Focus & Select on Quantity immediately
    setTimeout(() => {
      if (qtyInputRef.current) {
        qtyInputRef.current.focus();
        qtyInputRef.current.select();
      }
    }, 60);
  };

  const handleSave = () => {
    if (!name.trim()) {
      setValidationError('يرجى إدخال اسم الصنف أو اختياره من المخزن');
      return;
    }
    if (numQty <= 0) {
      setValidationError('يرجى إدخال كمية صحيحة أكبر من صفر');
      return;
    }
    if (numPrice < 0) {
      setValidationError('يرجى إدخال سعر صحيح (صفر أو أكثر)');
      return;
    }

    setValidationError('');

    const itemToSave: InvoiceItem = {
      itemId: selectedItemId || undefined,
      name: name.trim(),
      notes: notes.trim(),
      qty: numQty,
      price: numPrice,
      costPrice: costPrice,
      discount: calculatedDiscount,
      discountType: discountType,
      discountValue: rawDiscount > 0 ? rawDiscount : undefined,
      tax: calculatedTax,
      taxType: taxType,
      taxValue: rawTax > 0 ? rawTax : undefined,
      total: finalItemTotal,
    };

    onSave(itemToSave);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      id="invoice-item-modal-overlay"
      className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto animate-in fade-in duration-200"
    >
      <div
        id="invoice-item-modal-card"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden text-right flex flex-col"
        dir="rtl"
      >
        {/* Modal Header */}
        <div className="bg-white text-slate-900 px-5 py-4 flex items-center justify-between border-b-2 border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-xs">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-black text-lg text-slate-900">
                {initialItem ? 'تعديل بيانات كارت الصنف' : 'كارت الصنف (إضافة صنف للفاتورة)'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                أدخل بيانات الصنف بدقة - جميع الحسابات لحظية والتحكم في نوع الخصم والضريبة متاح
              </p>
            </div>
          </div>
          <button
            id="btn-close-item-modal"
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 flex items-center justify-center transition-colors text-slate-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto bg-slate-50/50">
          {validationError && (
            <div className="bg-rose-50 border-r-4 border-rose-600 text-rose-800 p-3 rounded-xl text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in">
              <span className="flex items-center gap-2">
                <span>⚠️</span>
                <span>{validationError}</span>
              </span>
              <button
                type="button"
                onClick={() => setValidationError('')}
                className="text-rose-500 hover:text-rose-800 text-sm font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {/* 1. Item Name with Quick Warehouse Search */}
          <div className="relative">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <span>اسم الصنف</span>
                <span className="text-rose-500 font-bold">*</span>
              </label>
              {catalogItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowCatalogDropdown(!showCatalogDropdown)}
                  className="text-xs text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>تصفح من المخزن</span>
                </button>
              )}
            </div>

            <input
              id="input-item-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setShowCatalogDropdown(true);
              }}
              onFocus={() => setShowCatalogDropdown(true)}
              placeholder="اكتب اسم الصنف هنا أو اختر من المخزن..."
              className="w-full h-11 px-3.5 bg-white border-2 border-slate-300 focus:border-blue-600 rounded-xl text-slate-900 text-sm font-bold shadow-sm focus:outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
              autoFocus
            />

            {/* Catalog suggestions dropdown */}
            {showCatalogDropdown && filteredCatalog.length > 0 && (
              <div className="absolute z-20 top-full mt-1.5 w-full bg-white rounded-xl shadow-xl border border-slate-200 divide-y divide-slate-100 max-h-48 overflow-y-auto animate-in fade-in duration-150">
                <div className="px-3 py-1.5 bg-slate-50 text-[11px] font-bold text-slate-500 flex justify-between">
                  <span>أصناف متطابقة من المخزن</span>
                  <button
                    type="button"
                    onClick={() => setShowCatalogDropdown(false)}
                    className="text-slate-400 hover:text-slate-700 text-xs"
                  >
                    إغلاق
                  </button>
                </div>
                {filteredCatalog.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectCatalogItem(item)}
                    className="w-full px-3.5 py-2 text-right hover:bg-blue-50/80 flex items-center justify-between transition-colors group"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900 group-hover:text-blue-700">{item.name}</div>
                      <div className="text-[11px] text-slate-500">
                        كود: {item.code || '-'} | رصيد: {item.quantity ?? 0}
                      </div>
                    </div>
                    <div className="text-left">
                      <span className="text-xs font-bold text-emerald-700">
                        {mode === 'sale'
                          ? (pricingType === 'wholesale' && item.wholesalePrice ? item.wholesalePrice : item.price || 0)
                          : (item.costPrice || item.purchasePrice || item.price || 0)}{' '}
                        ج.م
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 2. Note / Statement / البيان */}
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-1.5">البيان / ملاحظة الصنف</label>
            <input
              id="input-item-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="اكتب بيان الصنف أو تفاصيل الموديل، اللون، المقاس، أو الشروط..."
              className="w-full h-11 px-3.5 bg-white border-2 border-slate-300 focus:border-blue-600 rounded-xl text-slate-900 text-sm font-semibold shadow-sm focus:outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
            />
          </div>

          {/* Price Tier Selection Dropdown */}
          {(() => {
            const matched = catalogItems.find(
              (i) => i.id === selectedItemId || (name && i.name.trim().toLowerCase() === name.trim().toLowerCase())
            );
            if (!matched) return null;
            return (
              <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-200 space-y-1.5">
                <label className="text-xs font-black text-blue-950 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-blue-700" />
                  <span>تحديد نوع السعر (جملة / شراء / نقدي):</span>
                </label>
                <div className="relative">
                  <select
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'cash') setPrice(String(matched.salePrice || 0));
                      else if (val === 'wholesale') setPrice(String(matched.wholesalePrice || matched.salePrice || 0));
                      else if (val === 'buy') setPrice(String(matched.purchasePrice || 0));
                    }}
                    className="w-full h-10 px-3 pl-9 bg-white border-2 border-blue-300 rounded-xl text-xs font-black text-slate-800 shadow-xs appearance-none cursor-pointer"
                  >
                    <option value="">-- اضغط لاختيار فئة السعر المناسبة للصنف --</option>
                    <option value="cash">🟢 سعر بيع نقدي (قطاعي) — {Number(matched.salePrice || 0).toFixed(2)} ج.م</option>
                    <option value="wholesale">🟡 سعر بيع جملة — {Number(matched.wholesalePrice || matched.salePrice || 0).toFixed(2)} ج.م</option>
                    <option value="buy">🔴 سعر شراء / تكلفة — {Number(matched.purchasePrice || 0).toFixed(2)} ج.م</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-blue-700 absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>
            );
          })()}

          {/* 3. Quantity & Price Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Quantity */}
            <div>
              <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5 mb-1.5">
                <span>العدد (الكمية)</span>
                <span className="text-rose-500 font-bold">*</span>
              </label>
              <div className="relative">
                <input
                  ref={qtyInputRef}
                  id="input-item-qty"
                  type="number"
                  min="0"
                  step="any"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  placeholder="أدخل العدد..."
                  className="w-full h-11 px-3.5 bg-white border-2 border-slate-300 focus:border-blue-600 rounded-xl text-slate-900 text-base font-black shadow-sm focus:outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
                />
              </div>
            </div>

            {/* Price */}
            <div>
              <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5 mb-1.5">
                <span>السعر (سعر الوحدة)</span>
                <span className="text-rose-500 font-bold">*</span>
              </label>
              <div className="relative">
                <input
                  id="input-item-price"
                  type="number"
                  min="0"
                  step="any"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="أدخل السعر..."
                  className="w-full h-11 px-3.5 bg-white border-2 border-slate-300 focus:border-blue-600 rounded-xl text-slate-900 text-base font-black shadow-sm focus:outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
                />
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">ج.م</span>
              </div>
            </div>
          </div>

          {/* 4. Discount & Tax Grid (Percentage vs Fixed Controls) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            {/* Discount */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <span>الخصم</span>
                </label>
                {/* Switch discount type */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setDiscountType('percent')}
                    className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                      discountType === 'percent'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    نسبة %
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('fixed')}
                    className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                      discountType === 'fixed'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    مبلغ ثابت
                  </button>
                </div>
              </div>

              <div className="relative">
                <input
                  id="input-item-discount"
                  type="number"
                  min="0"
                  step="any"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={discountType === 'percent' ? 'أدخل النسبة %' : 'أدخل المبلغ ج.م'}
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-300 focus:border-blue-600 rounded-lg text-slate-900 text-sm font-bold shadow-sm focus:outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
                />
                <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">
                  {discountType === 'percent' ? '%' : 'ج.م'}
                </span>
              </div>

              {calculatedDiscount > 0 && (
                <div className="text-[11px] text-emerald-700 font-bold flex justify-between">
                  <span>قيمة الخصم:</span>
                  <span>- {calculatedDiscount.toFixed(2)} ج.م</span>
                </div>
              )}
            </div>

            {/* Tax (Strictly empty / 0 by default, never 14%) */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <span>الضريبة (قيمة مضافة)</span>
                </label>
                {/* Switch tax type */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setTaxType('percent')}
                    className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                      taxType === 'percent'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    نسبة %
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaxType('fixed')}
                    className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                      taxType === 'fixed'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    مبلغ ثابت
                  </button>
                </div>
              </div>

              <div className="relative">
                <input
                  id="input-item-tax"
                  type="number"
                  min="0"
                  step="any"
                  value={taxValue}
                  onChange={(e) => setTaxValue(e.target.value)}
                  placeholder={taxType === 'percent' ? 'أدخل النسبة % (اختياري)' : 'أدخل المبلغ ج.م'}
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-300 focus:border-indigo-600 rounded-lg text-slate-900 text-sm font-bold shadow-sm focus:outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
                />
                <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">
                  {taxType === 'percent' ? '%' : 'ج.م'}
                </span>
              </div>

              {calculatedTax > 0 && (
                <div className="text-[11px] text-indigo-700 font-bold flex justify-between">
                  <span>قيمة الضريبة:</span>
                  <span>+ {calculatedTax.toFixed(2)} ج.م</span>
                </div>
              )}
            </div>
          </div>

          {/* 5. Live Calculation Breakdown */}
          <div className="bg-white rounded-xl p-4 text-slate-900 border-2 border-slate-200 shadow-xs">
            <div className="text-xs font-bold text-slate-700 mb-2.5 flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-blue-600" />
                <span>شريط الحسابات اللحظية للصنف</span>
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                (تسمع الخصومات والضرائب في الإجمالي النهائي)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-[11px] text-slate-600 mb-0.5 font-bold">القيمة الأساسية</div>
                <div className="text-sm font-bold font-mono text-slate-900">{baseSubtotal.toFixed(2)} ج.م</div>
              </div>

              <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                <div className="text-[11px] text-emerald-800 mb-0.5 font-bold">الخصم</div>
                <div className="text-sm font-bold font-mono text-emerald-700">
                  {calculatedDiscount > 0 ? `-${calculatedDiscount.toFixed(2)}` : '0.00'} ج.م
                </div>
              </div>

              <div className="p-2 rounded-lg bg-blue-50 border border-blue-200">
                <div className="text-[11px] text-blue-800 mb-0.5 font-bold">الضريبة</div>
                <div className="text-sm font-bold font-mono text-blue-700">
                  {calculatedTax > 0 ? `+${calculatedTax.toFixed(2)}` : '0.00'} ج.م
                </div>
              </div>

              <div className="p-2 rounded-lg bg-amber-50 border border-amber-300">
                <div className="text-[11px] text-amber-900 mb-0.5 font-bold">الإجمالي النهائي للصنف</div>
                <div className="text-base font-black font-mono text-amber-950">{finalItemTotal.toFixed(2)} ج.م</div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            id="btn-cancel-item-modal"
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-bold text-slate-700 bg-white hover:bg-slate-200 rounded-xl border border-slate-300 transition-colors"
          >
            إلغاء
          </button>
          <button
            id="btn-confirm-add-item"
            type="button"
            onClick={handleSave}
            className="px-6 py-2.5 text-sm font-black text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-md transition-all flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>{initialItem ? 'حفظ التعديلات' : 'إضافة الصنف للفاتورة'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
