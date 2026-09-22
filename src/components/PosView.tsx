import React, { useState, useMemo, useEffect } from 'react';
import { AppData, Item, InvoiceItem, SaleInvoice } from '../types';
import { printInvoiceWindow } from '../utils/printInvoice';
import { printCashClosingWindow } from '../utils/printCashClosing';
import { printShiftReportWindow } from '../utils/printShiftReport';
import { addAuditLog } from '../utils/storage';
import { getProductActivePrice } from '../utils/priceService';
import { LayoutGrid, List, Sparkles, X, Image as ImageIcon } from 'lucide-react';

interface PosViewProps {
  appData: AppData;
  onUpdateData: (newData: AppData) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export const PosView: React.FC<PosViewProps> = ({ appData, onUpdateData, showToast }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cart, setCart] = useState<InvoiceItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('زبون نقدي');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [saleType, setSaleType] = useState<'nagdi' | 'ajel' | 'split'>('nagdi');
  // 🏷️ POS Pricing Tier: Master Price Source
  const [pricingTier, setPricingTier] = useState<'cash' | 'wholesale'>('cash');
  const [paymentMethod, setPaymentMethod] = useState<'drawer' | 'vodafone' | 'instapay' | 'bank'>('drawer');
  const [downpaymentInput, setDownpaymentInput] = useState<string>('');
  
  // Split payment state
  const [splitCash, setSplitCash] = useState<string>('');
  const [splitDigitalMethod, setSplitDigitalMethod] = useState<'vodafone' | 'instapay' | 'bank'>('instapay');
  const [splitDigitalAmount, setSplitDigitalAmount] = useState<string>('');

  const [discountVal, setDiscountVal] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(appData.settings.defaultTaxRate || 14);
  const [heldOrders, setHeldOrders] = useState<Array<{ id: number; customer: string; time: string; items: InvoiceItem[] }>>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [posMobileTab, setPosMobileTab] = useState<'products' | 'cart'>('products');
  const [posViewMode, setPosViewMode] = useState<'visual' | 'compact'>('visual');

  // Categories list
  const categories = useMemo(() => {
    return ['all', ...Array.from(new Set(appData.items.map((i) => i.category || 'عام')))];
  }, [appData.items]);

  // Category item counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: appData.items.length };
    appData.items.forEach((item) => {
      const cat = item.category || 'عام';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [appData.items]);

  // Category Icon mapper
  const getCategoryIcon = (cat: string) => {
    if (cat === 'all') return '🌟';
    const lower = cat.toLowerCase();
    if (lower.includes('كمبيوتر') || lower.includes('لابتوب') || lower.includes('شاش')) return '💻';
    if (lower.includes('طابع') || lower.includes('حبر') || lower.includes('ورق')) return '🖨️';
    if (lower.includes('إكسسوار') || lower.includes('سماعات') || lower.includes('كابل')) return '🎧';
    if (lower.includes('شبك') || lower.includes('كامير') || lower.includes('مراقبة')) return '📹';
    if (lower.includes('مكتب') || lower.includes('أدوات')) return '📎';
    if (lower.includes('أجهزة') || lower.includes('جوال') || lower.includes('موبايل')) return '📱';
    if (lower.includes('ملابس') || lower.includes('أقمشة')) return '👕';
    if (lower.includes('غذائ') || lower.includes('أطعمة') || lower.includes('مشروب')) return '🍔';
    return '📦';
  };

  // Keyboard shortcut listener for F1..F8 category switching
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is actively typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key.startsWith('F') && !isNaN(Number(e.key.substring(1)))) {
        const fIndex = Number(e.key.substring(1)) - 1;
        if (fIndex >= 0 && fIndex < categories.length) {
          e.preventDefault();
          setSelectedCategory(categories[fIndex]);
          showToast(`تم اختيار قسم: ${categories[fIndex] === 'all' ? 'جميع الأقسام' : categories[fIndex]} (مفتاح ${e.key})`, 'info');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [categories, showToast]);

  // Matched customer for balance and credit limit checks
  const matchedCustomer = appData.customers.find(
    (c) => c.name.trim().toLowerCase() === selectedCustomer.trim().toLowerCase()
  );

  // Filter items
  const filteredItems = appData.items.filter((item) => {
    const matchCat = selectedCategory === 'all' || (item.category || 'عام') === selectedCategory;
    const matchSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.barcode && item.barcode.includes(searchTerm));
    return matchCat && matchSearch;
  });

  const handleSwitchPricingTier = (newTier: 'cash' | 'wholesale') => {
    setPricingTier(newTier);
    if (cart.length > 0) {
      let updatedCount = 0;
      const updatedCart = cart.map((item) => {
        const res = getProductActivePrice(appData, item.itemId || item.name, newTier);
        if (res.hasPrice) {
          updatedCount++;
          return {
            ...item,
            price: res.price,
            priceType: newTier,
            priceSource: 'price_management' as const,
            total: item.qty * res.price,
          };
        }
        return item;
      });
      setCart(updatedCart);
      showToast(
        `تم تحويل أسعار (${updatedCount}) صنف بالسلة إلى تسعيرة (${newTier === 'wholesale' ? 'الجملة' : 'النقدي'}) من إدارة الأسعار`,
        'info'
      );
    }
  };

  const handleAddToCart = (item: Item) => {
    if (item.quantity <= 0) {
      showToast(`الصنف ${item.name} غير متوفر بالمخزن حالياً`, 'warning');
      return;
    }

    // Check active master price
    const priceRes = getProductActivePrice(appData, item.id, pricingTier);
    if (!priceRes.hasPrice) {
      showToast(
        priceRes.message || `الصنف ${item.name} ليس له سعر بيع (${pricingTier === 'wholesale' ? 'جملة' : 'نقدي'}) محدد في إدارة الأسعار`,
        'error'
      );
      return;
    }

    const unitPrice = priceRes.price;

    setCart((prev) => {
      const existing = prev.find((i) => i.name === item.name);
      if (existing) {
        if (existing.qty >= item.quantity) {
          showToast('لا يمكن تجاوز الكمية المتوفرة بالمخزن', 'warning');
          return prev;
        }
        return prev.map((i) =>
          i.name === item.name
            ? { ...i, qty: i.qty + 1, price: unitPrice, total: (i.qty + 1) * unitPrice }
            : i
        );
      }
      return [
        ...prev,
        {
          itemId: item.id,
          name: item.name,
          qty: 1,
          price: unitPrice,
          costPrice: item.purchasePrice,
          priceType: pricingTier,
          priceSource: 'price_management',
          total: unitPrice,
        },
      ];
    });
  };

  const handleUpdateQty = (index: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(index);
      return;
    }
    setCart((prev) => {
      const copy = [...prev];
      const item = appData.items.find((i) => i.name === copy[index].name);
      if (item && newQty > item.quantity) {
        showToast('الكمية المطلوبة أكبر من المتوفر بالمخزون', 'warning');
        return prev;
      }
      copy[index] = {
        ...copy[index],
        qty: newQty,
        total: newQty * copy[index].price,
      };
      return copy;
    });
  };

  const handleRemoveItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const handleHoldOrder = () => {
    if (cart.length === 0) {
      showToast('السلة فارغة، لا يوجد طلب لتعليقه', 'warning');
      return;
    }
    const newHold = {
      id: Date.now(),
      customer: selectedCustomer,
      time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      items: cart,
    };
    setHeldOrders((prev) => [newHold, ...prev]);
    setCart([]);
    showToast('تم تعليق الفاتورة بنجاح في قائمة الانتظار', 'info');
  };

  const handleRecallOrder = (orderId: number) => {
    const order = heldOrders.find((o) => o.id === orderId);
    if (!order) return;
    setCart(order.items);
    setSelectedCustomer(order.customer);
    setHeldOrders((prev) => prev.filter((o) => o.id !== orderId));
    showToast('تم استرجاع الفاتورة المعلقة إلى السلة', 'success');
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const taxAmount = (subtotal - discountVal) * (taxRate / 100);
  const finalTotal = Math.max(0, subtotal - discountVal + taxAmount);

  // Financial distribution calculations
  let effectivePaidCash = 0;
  let effectivePaidDigital = 0;
  let effectiveRemainingCredit = 0;

  if (saleType === 'nagdi') {
    effectivePaidCash = finalTotal;
    effectiveRemainingCredit = 0;
  } else if (saleType === 'ajel') {
    const downpayment = Math.max(0, parseFloat(downpaymentInput) || 0);
    effectivePaidCash = Math.min(finalTotal, downpayment);
    effectiveRemainingCredit = Math.max(0, finalTotal - effectivePaidCash);
  } else if (saleType === 'split') {
    const cashVal = Math.max(0, parseFloat(splitCash) || 0);
    const digVal = Math.max(0, parseFloat(splitDigitalAmount) || 0);
    effectivePaidCash = cashVal;
    effectivePaidDigital = digVal;
    const totalPaid = effectivePaidCash + effectivePaidDigital;
    effectiveRemainingCredit = Math.max(0, finalTotal - totalPaid);
  }

  // Credit limit calculation
  const currentCustBalance = matchedCustomer?.balance || 0;
  const custCreditLimit = matchedCustomer?.creditLimit || 0;
  const projectedBalance = currentCustBalance + effectiveRemainingCredit;
  const isCreditLimitExceeded =
    custCreditLimit > 0 && effectiveRemainingCredit > 0 && projectedBalance > custCreditLimit;

  const getMethodLabel = (m: string) => {
    switch (m) {
      case 'drawer':
        return 'الدرج (كاش)';
      case 'vodafone':
        return 'فودافون كاش';
      case 'instapay':
        return 'إنستاباي';
      case 'bank':
        return 'حساب بنكي / فيزا';
      default:
        return m;
    }
  };

  const handleCheckout = (isThermalPrint = false) => {
    if (cart.length === 0) {
      showToast('يرجى إضافة أصناف إلى السلة أولاً', 'warning');
      return;
    }

    if (!paymentMethod && saleType === 'nagdi') {
      showToast('يرجى اختيار وسيلة دفع نقدية صحيحة (خزينة/بنك)', 'error');
      return;
    }

    if (saleType === 'ajel' && (!selectedCustomer.trim() || selectedCustomer.trim() === 'زبون نقدي')) {
      showToast('يجب تحديد اسم عميل مسجل أو إدخال اسم العميل للبيع الآجل', 'warning');
      return;
    }

    if (isCreditLimitExceeded) {
      const confirmExceed = confirm(
        `⚠️ تنبيه ائتماني: العميل "${selectedCustomer}" سيتجاوز حد الائتمان المسموح به (${custCreditLimit.toFixed(
          2
        )} ج.م). الرصيد الجديد سيكون (${projectedBalance.toFixed(2)} ج.م).\n\nهل تريد المتابعة وتأكيد العملية؟`
      );
      if (!confirmExceed) {
        showToast('تم إلغاء إصدار الفاتورة لتجاوز حد الائتمان', 'info');
        return;
      }
    }

    const nextId = appData.nextInvoiceNumber || (appData.salesInvoices?.length || 0) + 1;
    const today = new Date().toISOString().split('T')[0];
    const currentUserObj = appData.users.find((u) => u.id === appData.currentUser) || appData.users[0];

    const totalPaidAll = saleType === 'split' ? effectivePaidCash + effectivePaidDigital : effectivePaidCash;

    const newInvoice: SaleInvoice = {
      id: nextId,
      customerName: selectedCustomer.trim(),
      phone: customerPhone.trim(),
      date: today,
      time: new Date().toLocaleTimeString('ar-EG'),
      items: cart,
      subtotal,
      discount: discountVal,
      tax: taxAmount,
      fees: 0,
      total: finalTotal,
      paymentMethod: saleType === 'split' ? 'split' : paymentMethod,
      type: saleType === 'ajel' ? 'ajel' : 'nagdi',
      salesType: pricingTier,
      paidAmount: totalPaidAll,
      remainingAmount: effectiveRemainingCredit,
      createdAt: new Date().toISOString(),
      createdBy: currentUserObj?.name || 'كاشير نقطة البيع',
      status: 'approved',
      branchId: appData.activeBranchId || 'br-main',
    };

    // Update Items Quantities
    const updatedItems = appData.items.map((item) => {
      const sold = cart.find((c) => c.name === item.name);
      if (sold) {
        return {
          ...item,
          quantity: item.quantity - sold.qty,
          movements: [
            ...(item.movements || []),
            {
              date: today,
              type: 'sale' as const,
              qty: sold.qty,
              price: sold.price,
              total: sold.total,
              note: `نقطة بيع POS فاتورة ${saleType === 'ajel' ? 'آجلة' : 'نقدية'} #${nextId}`,
            },
          ],
        };
      }
      return item;
    });

    // Update Cash Box & Ledger
    const updatedCashBox = { ...appData.cashBox };
    const updatedCashTransactions = [...(appData.cashTransactions || [])];
    let nextCashId = appData.nextCashId || 1;

    if (saleType === 'nagdi') {
      updatedCashBox[paymentMethod] = (updatedCashBox[paymentMethod] || 0) + finalTotal;
      updatedCashTransactions.unshift({
        id: nextCashId++,
        date: today,
        type: 'receive' as const,
        method: paymentMethod,
        amount: finalTotal,
        note: `إيراد نقطة بيع POS فاتورة مبيعات نقدية #${nextId}`,
        customerName: selectedCustomer,
        invoiceId: nextId,
        createdBy: currentUserObj?.name,
      });
    } else if (saleType === 'ajel') {
      if (effectivePaidCash > 0) {
        updatedCashBox[paymentMethod] = (updatedCashBox[paymentMethod] || 0) + effectivePaidCash;
        updatedCashTransactions.unshift({
          id: nextCashId++,
          date: today,
          type: 'receive' as const,
          method: paymentMethod,
          amount: effectivePaidCash,
          note: `دفعة نقدية مع فاتورة POS آجل #${nextId} (${getMethodLabel(paymentMethod)}) - العميل: ${selectedCustomer}`,
          customerName: selectedCustomer,
          invoiceId: nextId,
          createdBy: currentUserObj?.name,
        });
      }
      // Customer Ledger
      const updatedCustomers = [...appData.customers];
      const custIdx = updatedCustomers.findIndex(
        (c) => c.name.trim().toLowerCase() === selectedCustomer.trim().toLowerCase()
      );
      if (custIdx !== -1) {
        updatedCustomers[custIdx].balance = (updatedCustomers[custIdx].balance || 0) + effectiveRemainingCredit;
      } else {
        updatedCustomers.push({
          id: 'c' + Date.now(),
          name: selectedCustomer.trim(),
          phone: customerPhone.trim(),
          balance: effectiveRemainingCredit,
          transactions: [],
        });
      }
    } else if (saleType === 'split') {
      if (effectivePaidCash > 0) {
        updatedCashBox['drawer'] = (updatedCashBox['drawer'] || 0) + effectivePaidCash;
        updatedCashTransactions.unshift({
          id: nextCashId++,
          date: today,
          type: 'receive' as const,
          method: 'drawer',
          amount: effectivePaidCash,
          note: `جزء نقدي من فاتورة POS مجزأة #${nextId} - العميل: ${selectedCustomer}`,
          customerName: selectedCustomer,
          invoiceId: nextId,
          createdBy: currentUserObj?.name,
        });
      }
      if (effectivePaidDigital > 0) {
        updatedCashBox[splitDigitalMethod] = (updatedCashBox[splitDigitalMethod] || 0) + effectivePaidDigital;
        updatedCashTransactions.unshift({
          id: nextCashId++,
          date: today,
          type: 'receive' as const,
          method: splitDigitalMethod,
          amount: effectivePaidDigital,
          note: `جزء إلكتروني (${getMethodLabel(splitDigitalMethod)}) من فاتورة POS #${nextId} - العميل: ${selectedCustomer}`,
          customerName: selectedCustomer,
          invoiceId: nextId,
          createdBy: currentUserObj?.name,
        });
      }
      if (effectiveRemainingCredit > 0) {
        const updatedCustomers = [...appData.customers];
        const custIdx = updatedCustomers.findIndex(
          (c) => c.name.trim().toLowerCase() === selectedCustomer.trim().toLowerCase()
        );
        if (custIdx !== -1) {
          updatedCustomers[custIdx].balance = (updatedCustomers[custIdx].balance || 0) + effectiveRemainingCredit;
        } else {
          updatedCustomers.push({
            id: 'c' + Date.now(),
            name: selectedCustomer.trim(),
            phone: customerPhone.trim(),
            balance: effectiveRemainingCredit,
            transactions: [],
          });
        }
      }
    }

    let updatedData: AppData = {
      ...appData,
      salesInvoices: [newInvoice, ...(appData.salesInvoices || [])],
      items: updatedItems,
      cashBox: updatedCashBox,
      cashTransactions: updatedCashTransactions,
      customers:
        saleType === 'ajel' || (saleType === 'split' && effectiveRemainingCredit > 0)
          ? appData.customers.map((c) =>
              c.name.trim().toLowerCase() === selectedCustomer.trim().toLowerCase()
                ? { ...c, balance: (c.balance || 0) + effectiveRemainingCredit }
                : c
            )
          : appData.customers,
      nextInvoiceNumber: nextId + 1,
      nextCashId: nextCashId,
    };

    updatedData = addAuditLog(
      updatedData,
      'create',
      'نقطة البيع (POS)',
      `تم إتمام فاتورة POS #${nextId} (${saleType === 'ajel' ? 'آجل' : 'نقدي'}) بقيمة ${finalTotal.toFixed(2)} ج.م`
    );

    onUpdateData(updatedData);
    showToast(`تم إصدار فاتورة POS #${nextId} بنجاح`, 'success');

    // Print
    printInvoiceWindow(newInvoice, true, updatedData.settings, showToast);

    // Reset Cart
    setCart([]);
    setDiscountVal(0);
    setSelectedCustomer('زبون نقدي');
    setCustomerPhone('');
    setDownpaymentInput('');
    setSplitCash('');
    setSplitDigitalAmount('');
    setSaleType('nagdi');
  };

  return (
    <div className="space-y-4">
      {/* POS Screen Header */}
      <div className="bg-gradient-to-r from-[#1a237e] to-[#0d47a1] text-white p-4 rounded-2xl shadow-md flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚡</span>
          <div>
            <h3 className="font-black text-base md:text-lg text-[#ffd54f]">نقطة البيع السريعة (Express Touch POS)</h3>
            <p className="text-xs text-blue-100 opacity-90">شاشة كاشير فائقة السرعة للمبيعات المباشرة وطباعة الإيصالات الفورية</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {heldOrders.length > 0 && (
            <div className="flex items-center gap-2 bg-amber-500/30 border border-amber-400/50 px-3 py-1.5 rounded-xl text-xs">
              <span>⏳ معلقة ({heldOrders.length}):</span>
              {heldOrders.map((h) => (
                <button
                  key={h.id}
                  onClick={() => handleRecallOrder(h.id)}
                  className="bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold px-2 py-0.5 rounded cursor-pointer transition shadow-xs"
                >
                  {h.customer}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => {
              const todayStr = new Date().toISOString().split('T')[0];
              printCashClosingWindow(appData, todayStr, undefined, undefined, showToast);
            }}
            className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 border border-white/20"
            title="طباعة تقفيل يومية الخزينة ونقطة البيع (Z-Report)"
          >
            <span>📊</span>
            <span>تقفيل الخزينة (Z-Report)</span>
          </button>
          <button
            onClick={() => {
              const todayStr = new Date().toISOString().split('T')[0];
              printShiftReportWindow(appData, todayStr, undefined, showToast);
            }}
            className="bg-amber-400 hover:bg-amber-300 text-slate-900 px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-xs"
            title="طباعة تقرير ملخص الشفت والأرباح اليومية"
          >
            <span>📈</span>
            <span>ملخص الشفت والأرباح</span>
          </button>
        </div>
      </div>

      {/* Mobile Adaptive Tab Switcher (< lg) */}
      <div className="flex lg:hidden bg-white p-1 rounded-2xl border border-slate-200 shadow-xs mb-3">
        <button
          type="button"
          onClick={() => setPosMobileTab('products')}
          className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${
            posMobileTab === 'products'
              ? 'bg-[#1a237e] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>🛍️ معروضات الأصناف</span>
          <span className="bg-white/20 text-current px-1.5 py-0.2 rounded-full text-[10px]">
            {filteredItems.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setPosMobileTab('cart')}
          className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${
            posMobileTab === 'cart'
              ? 'bg-[#1a237e] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>🛒 السلة والمحاسبة</span>
          {cart.length > 0 && (
            <span className="bg-amber-400 text-slate-950 font-black px-1.5 py-0.2 rounded-full text-[10px]">
              {cart.length}
            </span>
          )}
          {finalTotal > 0 && (
            <span className="font-mono font-bold text-[11px] text-emerald-400">
              ({finalTotal.toFixed(0)} ج.م)
            </span>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Side: Items Catalog & Quick Touch Grid (7 Cols) */}
        <div
          className={`${
            posMobileTab === 'products' ? 'block' : 'hidden'
          } lg:block lg:col-span-7 bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-slate-200 space-y-4`}
        >
          {/* Price Management Master Pricing Tier Selector Bar */}
          <div className="bg-gradient-to-r from-amber-50 to-indigo-50 border border-amber-200/80 rounded-xl p-2.5 flex flex-wrap justify-between items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
              <span>🏷️</span>
              <span>تسعيرة نقطة البيع:</span>
              <span className="text-[11px] font-normal text-slate-500">(المصدر: إدارة الأسعار)</span>
            </div>
            <div className="flex items-center bg-white p-0.5 rounded-lg border border-slate-300 shadow-xs">
              <button
                type="button"
                onClick={() => handleSwitchPricingTier('cash')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                  pricingTier === 'cash'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>🟢</span> نقدي (قطاعي)
              </button>
              <button
                type="button"
                onClick={() => handleSwitchPricingTier('wholesale')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                  pricingTier === 'wholesale'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>🔵</span> جملة (Wholesale)
              </button>
            </div>
          </div>

          {/* Search, View Mode & Barcode Bar */}
          <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center">
            <div className="relative flex-1 min-w-[220px]">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="🔍 ابحث بالاسم أو امسح الباركود سريعاً..."
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-800"
                autoFocus
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                  title="مسح البحث"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setPosViewMode('visual')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  posViewMode === 'visual'
                    ? 'bg-white text-indigo-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="عرض شبكي بالصور"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">شبكة الصور</span>
              </button>
              <button
                type="button"
                onClick={() => setPosViewMode('compact')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  posViewMode === 'compact'
                    ? 'bg-white text-indigo-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="عرض مضغوط سريع"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">مضغوط</span>
              </button>
            </div>
          </div>

          {/* Categories Filter Bar with Quick Shortcuts */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center px-1">
              <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                <span>📁 الفئات والأقسام</span>
                <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded font-mono">
                  (اختصارات سريعة F1-F8)
                </span>
              </span>
              <span className="text-[11px] font-semibold text-slate-400">
                المعروض: {filteredItems.length} صنف
              </span>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1.5 pt-0.5 scrollbar-thin">
              {categories.map((cat, idx) => {
                const isSelected = selectedCategory === cat;
                const icon = getCategoryIcon(cat);
                const count = categoryCounts[cat] || 0;
                const shortcutKey = idx < 8 ? `F${idx + 1}` : null;

                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`group relative px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-2 border select-none ${
                      isSelected
                        ? 'bg-[#1a237e] text-white border-[#1a237e] shadow-md shadow-indigo-950/20 scale-[1.02]'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 shadow-2xs'
                    }`}
                  >
                    <span className="text-sm">{icon}</span>
                    <span className="font-semibold">{cat === 'all' ? 'جميع الأقسام' : cat}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-800'
                      }`}
                    >
                      {count}
                    </span>
                    {shortcutKey && (
                      <span
                        className={`text-[9px] px-1 py-0.2 rounded font-mono hidden md:inline-block ${
                          isSelected
                            ? 'bg-amber-400 text-slate-950 font-black'
                            : 'bg-slate-200/80 text-slate-500'
                        }`}
                        title={`اختصار لوحة المفاتيح: ${shortcutKey}`}
                      >
                        {shortcutKey}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Items Touch Grid (Visual Cards with Images OR Compact Grid) */}
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <span className="text-3xl block">🔍</span>
              <h4 className="font-bold text-slate-700 text-sm">لا توجد أصناف مطابقة للبحث أو القسم</h4>
              <p className="text-xs text-slate-500">جرب البحث بكلمات أخرى أو اختر "جميع الأقسام".</p>
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('all');
                }}
                className="mt-2 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                إلغاء الفلاتر وعرض الكل
              </button>
            </div>
          ) : posViewMode === 'visual' ? (
            /* Visual Grid with Product Images */
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3 max-h-[520px] overflow-y-auto pr-1">
              {filteredItems.map((item) => {
                const activePrice =
                  pricingTier === 'wholesale'
                    ? item.wholesaleSellingPrice || item.wholesalePrice || (item.salePrice ? Math.round(item.salePrice * 0.9) : 0)
                    : item.normalSellingPrice || item.salePrice || 0;

                const cartItem = cart.find((c) => c.name === item.name);
                const cartQty = cartItem?.qty || 0;
                const isOutOfStock = item.quantity <= 0;
                const isLowStock = item.quantity > 0 && item.quantity <= 3;

                return (
                  <div
                    key={item.id}
                    onClick={() => handleAddToCart(item)}
                    className={`group relative bg-white hover:bg-indigo-50/40 border rounded-2xl p-2.5 flex flex-col justify-between cursor-pointer transition transform active:scale-95 shadow-xs hover:shadow-md select-none overflow-hidden ${
                      cartQty > 0
                        ? 'border-indigo-400 ring-2 ring-indigo-500/20 bg-indigo-50/20'
                        : 'border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    {/* Product Image / Visual Placeholder */}
                    <div className="relative w-full h-24 sm:h-28 bg-slate-100/80 rounded-xl overflow-hidden mb-2 flex items-center justify-center border border-slate-100 group-hover:border-indigo-200 transition">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-contain p-1 group-hover:scale-105 transition duration-200"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-tr from-slate-100 to-indigo-50/50 text-slate-400 group-hover:text-indigo-600 transition p-2">
                          <span className="text-3xl mb-1 drop-shadow-xs">{getCategoryIcon(item.category || 'عام')}</span>
                          <span className="text-[10px] font-bold text-slate-400 truncate max-w-[90%]">
                            {item.category || 'صنف'}
                          </span>
                        </div>
                      )}

                      {/* In-cart Quantity Badge */}
                      {cartQty > 0 && (
                        <div className="absolute top-1.5 left-1.5 bg-amber-400 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 z-10 animate-pulse">
                          <span>🛒</span>
                          <span>{cartQty}</span>
                        </div>
                      )}

                      {/* Stock Badge */}
                      <div className="absolute top-1.5 right-1.5 z-10">
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded-md font-mono font-bold shadow-xs ${
                            isOutOfStock
                              ? 'bg-rose-600 text-white'
                              : isLowStock
                              ? 'bg-amber-500 text-slate-950 font-black'
                              : 'bg-slate-900/70 text-white backdrop-blur-xs'
                          }`}
                        >
                          {isOutOfStock ? 'نفذ' : `مخزون: ${item.quantity}`}
                        </span>
                      </div>
                    </div>

                    {/* Product Info */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span className="truncate max-w-[70%]">{item.category || 'عام'}</span>
                        {item.barcode && <span className="font-mono text-[9px]">#{item.barcode.slice(-4)}</span>}
                      </div>
                      <h4
                        className="font-bold text-slate-800 text-xs line-clamp-2 leading-snug group-hover:text-indigo-900 transition"
                        title={item.name}
                      >
                        {item.name}
                      </h4>
                    </div>

                    {/* Price & Add Action Button */}
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex justify-between items-center">
                      <div>
                        <span className="font-bold text-[#1a237e] text-xs sm:text-sm font-mono block">
                          {activePrice.toFixed(2)} <span className="text-[10px] font-sans font-normal">ج.م</span>
                        </span>
                        <span className="text-[9px] text-slate-400">
                          {pricingTier === 'wholesale' ? 'جملة' : 'نقدي'}
                        </span>
                      </div>
                      <button
                        type="button"
                        className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black shadow-xs transition ${
                          isOutOfStock
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white group-hover:scale-110'
                        }`}
                        title="إضافة للسلة"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Compact Dense Grid Layout */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-[520px] overflow-y-auto pr-1">
              {filteredItems.map((item) => {
                const activePrice =
                  pricingTier === 'wholesale'
                    ? item.wholesaleSellingPrice || item.wholesalePrice || (item.salePrice ? Math.round(item.salePrice * 0.9) : 0)
                    : item.normalSellingPrice || item.salePrice || 0;

                const cartItem = cart.find((c) => c.name === item.name);
                const cartQty = cartItem?.qty || 0;

                return (
                  <div
                    key={item.id}
                    onClick={() => handleAddToCart(item)}
                    className={`bg-slate-50 hover:bg-indigo-50/70 border rounded-xl p-2.5 flex flex-col justify-between cursor-pointer transition transform active:scale-95 shadow-xs select-none ${
                      cartQty > 0 ? 'border-indigo-400 bg-indigo-50/30' : 'border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono">
                          مخزون: {item.quantity}
                        </span>
                        {cartQty > 0 ? (
                          <span className="text-[9px] bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded-full font-black">
                            🛒 {cartQty}
                          </span>
                        ) : item.quantity <= 3 ? (
                          <span className="text-[9px] bg-amber-100 text-amber-800 px-1 rounded font-bold">
                            وشك
                          </span>
                        ) : null}
                      </div>
                      <h4 className="font-bold text-slate-800 text-xs line-clamp-2">{item.name}</h4>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-200/60 flex justify-between items-center">
                      <div>
                        <span className="font-bold text-[#1a237e] text-xs font-mono block">
                          {activePrice.toFixed(2)} ج.م
                        </span>
                        <span className="text-[9px] text-slate-400">
                          {pricingTier === 'wholesale' ? 'سعر جملة' : 'سعر نقدي'}
                        </span>
                      </div>
                      <span className="bg-indigo-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-black">
                        +
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Active Cart & Checkout Panel (5 Cols) */}
        <div
          className={`${
            posMobileTab === 'cart' ? 'block' : 'hidden'
          } lg:block lg:col-span-5 bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between space-y-3`}
        >
          {/* Mobile Back to Products Banner */}
          <div className="lg:hidden flex justify-between items-center bg-indigo-50 border border-indigo-200 p-2.5 rounded-xl">
            <span className="font-bold text-xs text-indigo-950">🛒 سلة البيع والمحاسبة</span>
            <button
              type="button"
              onClick={() => setPosMobileTab('products')}
              className="bg-white text-indigo-800 hover:bg-indigo-100 font-bold px-3 py-1 rounded-lg border border-indigo-200 cursor-pointer text-xs flex items-center gap-1 shadow-2xs"
            >
              <span>➕ إضافة أصناف أخرى</span>
            </button>
          </div>

          {/* Customer & Header with Credit Limit Badge */}
          <div className="space-y-2 pb-2 border-b border-slate-100 relative">
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <label className="block text-[11px] font-bold text-slate-700 mb-0.5 flex justify-between">
                  <span>اسم العميل</span>
                  {matchedCustomer && (
                    <span className="text-[10px] text-indigo-700 font-bold">
                      رصيد: {matchedCustomer.balance.toFixed(2)} ج.م
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={selectedCustomer}
                  onChange={(e) => {
                    setSelectedCustomer(e.target.value);
                    setShowCustomerDropdown(true);
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  placeholder="ابحث أو اختر العميل..."
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs font-bold bg-slate-50 focus:border-[#1a237e] focus:bg-white"
                />

                {/* Customer Autocomplete Dropdown */}
                {showCustomerDropdown && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    <div
                      onClick={() => {
                        setSelectedCustomer('زبون نقدي');
                        setCustomerPhone('');
                        setShowCustomerDropdown(false);
                      }}
                      className="p-2 hover:bg-indigo-50 cursor-pointer text-xs border-b border-slate-100 font-bold text-slate-800"
                    >
                      🌟 زبون نقدي عام (بدون حساب ذمة)
                    </div>
                    {appData.customers
                      .filter((c) => c.name.toLowerCase().includes(selectedCustomer.toLowerCase()))
                      .map((c) => (
                        <div
                          key={c.id}
                          onClick={() => {
                            setSelectedCustomer(c.name);
                            setCustomerPhone(c.phone || '');
                            setShowCustomerDropdown(false);
                          }}
                          className="p-2 hover:bg-indigo-50 cursor-pointer text-xs border-b border-slate-100 flex justify-between items-center"
                        >
                          <div>
                            <div className="font-bold text-slate-900">{c.name}</div>
                            {c.phone && <div className="text-[10px] text-slate-500 font-mono">📱 {c.phone}</div>}
                          </div>
                          <div className="text-left">
                            <div className={`font-mono text-[11px] font-bold ${c.balance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                              {c.balance.toFixed(2)} ج.م
                            </div>
                            {c.creditLimit !== undefined && c.creditLimit > 0 && (
                              <div className="text-[9px] text-slate-400">حد: {c.creditLimit.toFixed(0)}</div>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-0.5">رقم الهاتف</label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="010..."
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono bg-slate-50"
                />
              </div>
            </div>

            {/* Smart Credit Limit Warning Alert */}
            {isCreditLimitExceeded && (
              <div className="bg-rose-50 border border-rose-300 p-2 rounded-xl text-rose-900 text-xs space-y-0.5">
                <div className="font-bold flex items-center gap-1 text-[11px]">
                  <span>⚠️</span>
                  <span>تنبيه: تجاوز حد الائتمان المسموح!</span>
                </div>
                <div className="text-[10px] text-rose-700 leading-tight">
                  الحد المسموح للعميل: <strong>{custCreditLimit.toFixed(2)} ج.م</strong> | الرصيد بعد الفاتورة:{' '}
                  <strong className="text-rose-900 font-mono">{projectedBalance.toFixed(2)} ج.م</strong> (تجاوز بمقدار{' '}
                  {(projectedBalance - custCreditLimit).toFixed(2)} ج.م)
                </div>
              </div>
            )}
          </div>

          {/* Cart Items List */}
          <div className="flex-1 max-h-[190px] overflow-y-auto space-y-1.5 pr-1">
            {cart.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                🛒 السلة فارغة. اختر أصنافاً من الشبكة للإضافة
              </div>
            ) : (
              cart.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-200 text-xs">
                  <div className="flex-1 pr-1 truncate">
                    <div className="font-bold text-slate-900 truncate flex items-center gap-1">
                      <span>{item.name}</span>
                      <span
                        className={`text-[9px] px-1 rounded font-bold ${
                          item.priceType === 'wholesale' ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {item.priceType === 'wholesale' ? 'جملة' : 'نقدي'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {item.price.toFixed(2)} × {item.qty} = <strong className="text-indigo-900">{item.total.toFixed(2)}</strong> ج.م
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleUpdateQty(idx, item.qty - 1)}
                      className="w-6 h-6 bg-slate-200 hover:bg-slate-300 rounded font-bold text-slate-800 cursor-pointer"
                    >
                      -
                    </button>
                    <span className="font-mono font-bold w-6 text-center">{item.qty}</span>
                    <button
                      onClick={() => handleUpdateQty(idx, item.qty + 1)}
                      className="w-6 h-6 bg-slate-200 hover:bg-slate-300 rounded font-bold text-slate-800 cursor-pointer"
                    >
                      +
                    </button>
                    <button
                      onClick={() => handleRemoveItem(idx)}
                      className="text-rose-600 hover:text-rose-800 font-bold px-1 text-sm cursor-pointer mr-1"
                      title="حذف"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Calculation & Pricing Summary */}
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1.5 text-xs">
            <div className="flex justify-between font-semibold text-slate-600">
              <span>المجموع الفرعي:</span>
              <span className="font-mono">{subtotal.toFixed(2)} ج.م</span>
            </div>
            <div className="flex justify-between items-center">
              <span>خصم إضافي:</span>
              <input
                type="number"
                value={discountVal || ''}
                onChange={(e) => setDiscountVal(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-20 p-1 border border-slate-300 rounded text-center font-mono text-xs font-bold bg-white"
              />
            </div>
            <div className="flex justify-between items-center">
              <span>ضريبة القيمة المضافة ({taxRate}%):</span>
              <span className="font-mono font-bold text-slate-700">{taxAmount.toFixed(2)} ج.م</span>
            </div>
            <div className="flex justify-between items-center pt-1.5 border-t border-slate-300 text-base font-black text-[#1a237e]">
              <span>المبلغ الإجمالي:</span>
              <span className="font-mono text-emerald-800 text-lg">{finalTotal.toFixed(2)} ج.م</span>
            </div>

            {/* Sale Type Selector: Nagdi vs Ajel vs Split */}
            <div className="pt-2 border-t border-slate-200">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">نوع عملية البيع والدفع</label>
              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={() => setSaleType('nagdi')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1 ${
                    saleType === 'nagdi'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>🟢</span>
                  <span>نقدي (فوري)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSaleType('ajel')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1 ${
                    saleType === 'ajel'
                      ? 'bg-amber-700 text-white shadow-xs'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>🟠</span>
                  <span>آجل (ذمم)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSaleType('split')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1 ${
                    saleType === 'split'
                      ? 'bg-purple-700 text-white shadow-xs'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>🔄</span>
                  <span>دفع متعدد</span>
                </button>
              </div>
            </div>

            {/* Dynamic Controls based on Sale Type */}
            {saleType === 'nagdi' && (
              <div className="pt-1 space-y-1">
                <label className="block text-[10px] font-bold text-slate-600">وسيلة استلام النقدية (الخزينة/البنك)</label>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { key: 'drawer', label: '💵 كاش' },
                    { key: 'vodafone', label: '📱 فودافون' },
                    { key: 'instapay', label: '⚡ إنستاباي' },
                    { key: 'bank', label: '💳 فيزا/بنك' },
                  ].map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setPaymentMethod(m.key as any)}
                      className={`py-1.5 px-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center ${
                        paymentMethod === m.key
                          ? 'bg-[#1a237e] text-white shadow-xs'
                          : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {saleType === 'ajel' && (
              <div className="bg-amber-50/80 border border-amber-200 p-2 rounded-xl space-y-1.5 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-amber-900 mb-0.5">
                      المسدد نقداً الآن (دفعة مقدمة)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={finalTotal}
                      step="any"
                      placeholder="0.00"
                      value={downpaymentInput}
                      onChange={(e) => setDownpaymentInput(e.target.value)}
                      className="w-full p-1.5 border border-amber-300 rounded-lg text-xs font-mono font-bold bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-amber-900 mb-0.5">وسيلة تحصيل الدفعة</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="w-full p-1.5 border border-amber-300 rounded-lg text-xs font-semibold bg-white"
                    >
                      <option value="drawer">💵 كاش (الدرج)</option>
                      <option value="vodafone">📱 فودافون كاش</option>
                      <option value="instapay">⚡ إنستاباي</option>
                      <option value="bank">💳 حساب بنكي</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-between items-center text-[11px] pt-1 border-t border-amber-200/60 font-bold">
                  <span className="text-amber-800">المتبقي يُرحل كمديونية على العميل:</span>
                  <span className="text-rose-700 font-mono text-sm">{effectiveRemainingCredit.toFixed(2)} ج.م</span>
                </div>
              </div>
            )}

            {saleType === 'split' && (
              <div className="bg-purple-50/80 border border-purple-200 p-2 rounded-xl space-y-1.5 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-purple-900 mb-0.5">المسدد كاش نقدي (الدرج)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0.00"
                      value={splitCash}
                      onChange={(e) => setSplitCash(e.target.value)}
                      className="w-full p-1.5 border border-purple-300 rounded-lg text-xs font-mono font-bold bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-purple-900 mb-0.5">المسدد إلكتروني / بنكي</label>
                    <div className="flex gap-1">
                      <select
                        value={splitDigitalMethod}
                        onChange={(e) => setSplitDigitalMethod(e.target.value as any)}
                        className="p-1 border border-purple-300 rounded-lg text-[10px] font-bold bg-white"
                      >
                        <option value="instapay">إنستاباي</option>
                        <option value="vodafone">فودافون</option>
                        <option value="bank">فيزا/بنك</option>
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0.00"
                        value={splitDigitalAmount}
                        onChange={(e) => setSplitDigitalAmount(e.target.value)}
                        className="w-full p-1.5 border border-purple-300 rounded-lg text-xs font-mono font-bold bg-white"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center text-[11px] pt-1 border-t border-purple-200/60 font-bold">
                  <span className="text-purple-900">المتبقي كآجل / ذمم:</span>
                  <span className="text-purple-800 font-mono text-sm">{effectiveRemainingCredit.toFixed(2)} ج.م</span>
                </div>
              </div>
            )}
          </div>

          {/* Action Checkout Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              onClick={handleHoldOrder}
              className="min-h-[44px] bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold py-2 px-3 rounded-xl text-xs transition cursor-pointer flex sm:flex-col items-center justify-center gap-0.5 shadow-xs"
            >
              <span>⏸️ تعليق الطلب</span>
              <span className="text-[9px] opacity-90 hidden sm:inline">Hold Order</span>
            </button>
            <button
              onClick={() => handleCheckout(true)}
              className="min-h-[44px] bg-[#2e7d32] hover:bg-[#1b5e20] active:bg-[#124116] text-white font-bold py-2 px-3 rounded-xl text-xs transition cursor-pointer flex sm:flex-col items-center justify-center gap-0.5 shadow-xs"
            >
              <span>🧾 حفظ وإيصال حراري</span>
              <span className="text-[9px] opacity-90 hidden sm:inline">Thermal POS</span>
            </button>
            <button
              onClick={() => handleCheckout(false)}
              className="min-h-[44px] bg-[#1a237e] hover:bg-[#0d47a1] active:bg-[#082a61] text-white font-bold py-2 px-3 rounded-xl text-xs transition cursor-pointer flex sm:flex-col items-center justify-center gap-0.5 shadow-xs"
            >
              <span>🖨️ حفظ وفاتورة A4</span>
              <span className="text-[9px] opacity-90 hidden sm:inline">A4 Invoice</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Floating Cart Summary Button when on Products view */}
      {cart.length > 0 && posMobileTab === 'products' && (
        <div className="lg:hidden fixed bottom-20 left-4 right-4 z-20 animate-fade-in">
          <button
            type="button"
            onClick={() => setPosMobileTab('cart')}
            className="w-full bg-[#1a237e] hover:bg-[#0d47a1] active:bg-[#002171] text-white p-3 rounded-2xl shadow-2xl flex items-center justify-between font-bold text-xs sm:text-sm border-2 border-amber-400/80 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span className="bg-amber-400 text-slate-950 font-black px-2 py-0.5 rounded-full text-xs">
                {cart.length} أصناف
              </span>
              <span>في سلة البيع</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-amber-300 font-black text-sm sm:text-base">
                {finalTotal.toFixed(2)} ج.م
              </span>
              <span className="bg-white/20 px-2 py-1 rounded-lg text-xs">إتمام البيع ⬅</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
