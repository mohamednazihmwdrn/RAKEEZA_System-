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
  onUpdateData: (
    newData: AppData,
    actionInfo?: { action?: string; module?: string; details?: string; deletedId?: string | number }
  ) => void;
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
  cashPrice?: number;
  wholesalePrice?: number;
  buyPrice?: number;
}

export interface WorkspacePayRow {
  id: string;
  method: string;
  amount: number;
}

export const RakeezaInvoiceWorkspace: React.FC<RakeezaInvoiceWorkspaceProps> = ({
  isOpen,
  onClose,
  mode: initialMode,
  invoiceType: initialInvoiceType,
  pricingType: initialPricingType,
  editingInvoice,
  appData,
  onUpdateData,
  showToast,
}) => {
  if (!isOpen) return null;

  // 🏛️ Current Department (Sales vs Purchases)
  const [currentDept] = useState<'sale' | 'purchase'>(() => {
    if (editingInvoice) {
      return (editingInvoice as any).supplierName ? 'purchase' : 'sale';
    }
    return initialMode;
  });

  const isSale = currentDept === 'sale';

  // 🏷️ نظام تسعير الفاتورة: 'cash' (سعر نقدي), 'wholesale' (سعر جملة), 'buy' (سعر شراء)
  const [activePricingTier, setActivePricingTier] = useState<'cash' | 'wholesale' | 'buy'>(() => {
    if (editingInvoice) {
      const sType = (editingInvoice as any).salesType;
      if (sType === 'wholesale') return 'wholesale';
      if ((editingInvoice as any).supplierName) return 'buy';
      return 'cash';
    }
    if (initialPricingType === 'wholesale') return 'wholesale';
    if (initialPricingType === 'buy') return 'buy';
    return isSale ? 'cash' : 'buy';
  });

  // Invoice type (nagdi / ajel / return_nagdi / return_ajel)
  const [selectedInvoiceType, setSelectedInvoiceType] = useState<'nagdi' | 'ajel' | 'return_nagdi' | 'return_ajel'>(() => {
    if (editingInvoice?.type) return editingInvoice.type;
    return initialInvoiceType || 'nagdi';
  });

  useEffect(() => {
    if (initialInvoiceType) {
      setSelectedInvoiceType(initialInvoiceType);
    }
  }, [initialInvoiceType]);

  const isReturn = selectedInvoiceType.startsWith('return_');

  // 🎨 هوية الفاتورة اللونيّة الديناميكية طبقاً للأنظمة العالمية (لكل نوع حركة لون وعنوان مختلف)
  const invoiceTheme = useMemo(() => {
    if (isSale) {
      if (selectedInvoiceType === 'return_nagdi' || selectedInvoiceType === 'return_ajel') {
        return {
          bg: 'linear-gradient(135deg, #881337 0%, #be123c 100%)',
          border: '#e11d48',
          badgeText: selectedInvoiceType === 'return_ajel' ? '↩ مرتجع مبيعات آجل' : '↩ مرتجع مبيعات نقدي',
          icon: 'fa-rotate-left',
        };
      }
      if (selectedInvoiceType === 'ajel') {
        return {
          bg: 'linear-gradient(135deg, #78350f 0%, #b45309 100%)',
          border: '#d97706',
          badgeText: '⏳ فاتورة مبيعات آجل',
          icon: 'fa-clock',
        };
      }
      if (activePricingTier === 'wholesale') {
        return {
          bg: 'linear-gradient(135deg, #1e1b4b 0%, #3730a3 100%)',
          border: '#4f46e5',
          badgeText: '🏷️ فاتورة مبيعات جملة',
          icon: 'fa-tags',
        };
      }
      return {
        bg: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)',
        border: '#059669',
        badgeText: '💵 فاتورة مبيعات نقدي',
        icon: 'fa-cash-register',
      };
    } else {
      // Purchases
      if (selectedInvoiceType === 'return_nagdi' || selectedInvoiceType === 'return_ajel') {
        return {
          bg: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)',
          border: '#dc2626',
          badgeText: selectedInvoiceType === 'return_ajel' ? '↩ مرتجع شراء آجل' : '↩ مرتجع شراء نقدي',
          icon: 'fa-rotate-left',
        };
      }
      if (selectedInvoiceType === 'ajel') {
        return {
          bg: 'linear-gradient(135deg, #713f12 0%, #9a3412 100%)',
          border: '#ea580c',
          badgeText: '⏳ فاتورة شراء آجل (ذمم موردين)',
          icon: 'fa-file-invoice-dollar',
        };
      }
      if (activePricingTier === 'wholesale') {
        return {
          bg: 'linear-gradient(135deg, #164e63 0%, #0e7490 100%)',
          border: '#0891b2',
          badgeText: '📦 فاتورة توريد / مشتريات جملة',
          icon: 'fa-boxes-packing',
        };
      }
      return {
        bg: 'linear-gradient(135deg, #134e4a 0%, #0f766e 100%)',
        border: '#0d9488',
        badgeText: '🛒 فاتورة شراء نقدي',
        icon: 'fa-cart-shopping',
      };
    }
  }, [isSale, selectedInvoiceType, activePricingTier]);

  // Window Maximize Toggle
  const [isMaximized, setIsMaximized] = useState(false);

  // Live Digital Clock (HH:MM ص/م)
  const [liveTime, setLiveTime] = useState('12:00 م');
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setLiveTime(d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Invoice ID & Sequence
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
  const [custCode, setCustCode] = useState<string>(() => {
    if (isSale) return (editingInvoice as any)?.customerCode || '1';
    return (editingInvoice as any)?.supplierCode || '1';
  });
  const [custName, setCustName] = useState<string>(() => {
    if (isSale) return (editingInvoice as SaleInvoice)?.customerName || 'عميل نقدي';
    return (editingInvoice as PurchaseInvoice)?.supplierName || 'مورد عام';
  });
  const [custPhone, setCustPhone] = useState<string>(editingInvoice?.phone || '');
  const [jobSite, setJobSite] = useState<string>(
    (editingInvoice as any)?.jobSite || editingInvoice?.notes || ''
  );

  // Autocomplete Suggestions State
  const [showCustDropdown, setShowCustDropdown] = useState(false);

  const partySuggestions = useMemo(() => {
    const q = custName.trim().toLowerCase();
    const list = isSale ? (appData.customers || []) : (appData.suppliers || []);
    if (!q) return list.slice(0, 8);
    return list
      .filter((p) => p.name.toLowerCase().includes(q) || (p.phone && p.phone.includes(q)) || (p.code && p.code.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [custName, isSale, appData.customers, appData.suppliers]);

  // 🟡 حساب رصيد وحالة الحساب (الدائن / المدين) للعميل أو المورد المختار
  const matchedParty = useMemo(() => {
    if (isSale) {
      return appData.customers?.find(
        (c) =>
          (custCode && (c.code === custCode || c.id === custCode)) ||
          (custName && c.name.trim().toLowerCase() === custName.trim().toLowerCase())
      );
    } else {
      return appData.suppliers?.find(
        (s) =>
          (custCode && (s.code === custCode || s.id === custCode)) ||
          (custName && s.name.trim().toLowerCase() === custName.trim().toLowerCase())
      );
    }
  }, [custName, custCode, isSale, appData.customers, appData.suppliers]);

  const partyBalance: number = useMemo(() => {
    if (!matchedParty) return 0;
    if (isSale) {
      const res = calculateCustomerBalance(matchedParty as Customer, appData);
      return typeof res === 'number' ? res : (res?.balance || 0);
    } else {
      const res = calculateSupplierBalance(matchedParty as Supplier, appData);
      return typeof res === 'number' ? res : (res?.balance || 0);
    }
  }, [matchedParty, isSale, appData]);

  // Integrated Items Database (يعتمد حصرياً على أصناف المستخدم المسجلة دون أي أصناف وهمية مسبقة)
  const [localItemsDatabase, setLocalItemsDatabase] = useState<any[]>(() => {
    if (!appData.items || appData.items.length === 0) return [];

    return appData.items.map((i, idx) => {
      const bPrice = Number(i.purchasePrice || i.costPrice || 0);
      const cPrice = Number(i.salePrice || i.price || 0);
      const wPrice = Number(i.wholesalePrice || i.wholesaleSellingPrice || (cPrice > 0 ? cPrice * 0.95 : bPrice * 1.1));
      const wbPrice = Number((i as any).wholesalePurchasePrice || (i as any).wholesaleBuyPrice || (bPrice > 0 ? bPrice * 0.95 : bPrice));
      return {
        code: i.code || `ITM-${String(idx + 1).padStart(3, '0')}`,
        name: i.name,
        group: i.category || 'عام',
        company: i.material || 'عام',
        typeName: i.unit || 'عام',
        stock: Number(i.quantity ?? 0),
        buyPrice: bPrice,
        cashPrice: cPrice,
        wholesalePrice: wPrice,
        wholesaleBuyPrice: wbPrice,
        itemId: i.id,
      };
    });
  });

  // Current Invoice Items
  const [currentInvoiceItems, setCurrentInvoiceItems] = useState<WorkspaceItemRow[]>(() => {
    if (editingInvoice?.items && editingInvoice.items.length > 0) {
      return editingInvoice.items.map((i, idx) => ({
        rowId: (i as any).rowId || `row_${idx}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        code: i.code || '',
        name: i.name,
        spec: i.spec || i.notes || '',
        qty: Number(i.qty || (i as any).quantity || 1),
        price: Number(i.price || 0),
        total: Number(i.total || (Number(i.qty || 1) * Number(i.price || 0))),
        itemId: i.itemId,
        costPrice: i.costPrice,
      }));
    }
    return [];
  });

  // Helper to extract item price based on active pricing tier
  const getItemPriceForTier = (dbItem: any, tier: 'cash' | 'wholesale' | 'buy'): number => {
    if (!dbItem) return 0;
    const cPrice = Number(dbItem.cashPrice || dbItem.salePrice || dbItem.normalSellingPrice || dbItem.price || 0);
    const bPrice = Number(dbItem.buyPrice || dbItem.purchasePrice || dbItem.costPrice || 0);
    const wPrice = Number(dbItem.wholesalePrice || dbItem.wholesaleSellingPrice || 0);

    if (tier === 'cash') {
      if (cPrice > 0) return cPrice;
      if (bPrice > 0) return Math.round(bPrice * 1.25 * 100) / 100;
      return 10;
    }

    if (tier === 'wholesale') {
      // If explicit wholesale price exists and differs from cash price, use it
      if (wPrice > 0 && Math.abs(wPrice - cPrice) > 0.01) {
        return wPrice;
      }
      // Otherwise calculate realistic wholesale price (10% discount from cash price, or 15% margin over cost)
      if (cPrice > 0) {
        return Math.round(cPrice * 0.90 * 100) / 100;
      }
      if (bPrice > 0) {
        return Math.round(bPrice * 1.15 * 100) / 100;
      }
      return 9;
    }

    if (tier === 'buy') {
      // If purchase price exists and differs from cash price, use it
      if (bPrice > 0 && Math.abs(bPrice - cPrice) > 0.01) {
        return bPrice;
      }
      // Otherwise estimate standard purchase cost (approx 75% of cash price)
      if (cPrice > 0) {
        return Math.round(cPrice * 0.75 * 100) / 100;
      }
      if (bPrice > 0) return bPrice;
      return 7.5;
    }

    return cPrice || 10;
  };

  // 🔄 تغيير نظام التسعير (سعر نقدي / سعر جملة / سعر شراء) يُحدث أسعار كافة الأصناف فوراً
  const handleChangePricingTier = (newTier: 'cash' | 'wholesale' | 'buy') => {
    setActivePricingTier(newTier);

    // تحديث السعر فوراً داخل كارت الصنف إذا كان الكارت مفتوحاً حالياً
    if (cardItem) {
      const updatedCardPrice = getItemPriceForTier(cardItem, newTier);
      if (updatedCardPrice > 0) {
        setCardPrice(updatedCardPrice.toString());
      }
    }

    setCurrentInvoiceItems((prev) => {
      if (prev.length === 0) return prev;
      return prev.map((invItem) => {
        let newPrice = 0;

        // 1. الاسترجاع من الأسعار المحفوظة مسبقاً في السطر
        if (newTier === 'cash' && invItem.cashPrice && invItem.cashPrice > 0) {
          newPrice = invItem.cashPrice;
        } else if (newTier === 'wholesale' && invItem.wholesalePrice && invItem.wholesalePrice > 0) {
          newPrice = invItem.wholesalePrice;
        } else if (newTier === 'buy' && (invItem.buyPrice || invItem.costPrice)) {
          newPrice = Number(invItem.buyPrice || invItem.costPrice || 0);
        }

        // 2. البحث في قاعدة الأصناف المحلية أو أصناف التطبيق
        if (newPrice <= 0) {
          const dbItem =
            localItemsDatabase.find(
              (i) =>
                (i.code && invItem.code && i.code.trim().toLowerCase() === invItem.code.trim().toLowerCase()) ||
                (invItem.itemId && (String(i.itemId) === String(invItem.itemId) || String(i.id) === String(invItem.itemId))) ||
                (i.name && invItem.name && i.name.trim().toLowerCase() === invItem.name.trim().toLowerCase())
            ) ||
            appData.items?.find(
              (i) =>
                (i.code && invItem.code && i.code.trim().toLowerCase() === invItem.code.trim().toLowerCase()) ||
                (invItem.itemId && String(i.id) === String(invItem.itemId)) ||
                (i.name && invItem.name && i.name.trim().toLowerCase() === invItem.name.trim().toLowerCase())
            );

          if (dbItem) {
            newPrice = getItemPriceForTier(dbItem, newTier);
          }
        }

        // 3. الحساب التلقائي الواقعي في حال عدم وجود الصنف في القاعدة
        if (newPrice <= 0) {
          const baseP = Number(invItem.cashPrice || invItem.price || 0);
          if (newTier === 'wholesale') {
            newPrice = Math.round(baseP * 0.90 * 100) / 100;
          } else if (newTier === 'buy') {
            newPrice = Number(invItem.costPrice || Math.round(baseP * 0.75 * 100) / 100);
          } else {
            newPrice = baseP > 0 ? baseP : 10;
          }
        }

        if (newPrice <= 0) {
          newPrice = invItem.price;
        }

        return {
          ...invItem,
          price: newPrice,
          total: Number((invItem.qty * newPrice).toFixed(2)),
        };
      });
    });

    const tierName = newTier === 'cash' ? 'النقدي' : newTier === 'wholesale' ? 'الجملة' : 'الشراء';
    showToast(`تم تطبيق سعر ${tierName} على كافة بنود الفاتورة بنجاح`, 'info');
  };

  // Sync pricing tier when initialPricingType prop changes
  useEffect(() => {
    if (initialPricingType && (initialPricingType === 'cash' || initialPricingType === 'wholesale' || initialPricingType === 'buy')) {
      handleChangePricingTier(initialPricingType);
    }
  }, [initialPricingType]);

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
    (editingInvoice as any)?.extraRevenueName || (editingInvoice as any)?.extraIncomeName || ''
  );
  const [extraIncomeVal, setExtraIncomeVal] = useState<string>(
    (editingInvoice as any)?.extraRevenueAmount ? String((editingInvoice as any).extraRevenueAmount) : ''
  );

  const [paymentRows, setPaymentRows] = useState<WorkspacePayRow[]>(() => {
    if ((editingInvoice as any)?.paymentSplits && (editingInvoice as any).paymentSplits.length > 0) {
      return (editingInvoice as any).paymentSplits.map((p: any, idx: number) => ({
        id: String(idx + 1),
        method: p.method,
        amount: Number(p.amount),
      }));
    }
    if (editingInvoice?.paidAmount && Number(editingInvoice.paidAmount) > 0) {
      return [{ id: '1', method: editingInvoice.paymentMethod || 'نقدي', amount: Number(editingInvoice.paidAmount) }];
    }
    return [];
  });

  // Hierarchy Lookup Modal State
  const [isLookupModalOpen, setIsLookupModalOpen] = useState(false);
  const [globalLookupSearch, setGlobalLookupSearch] = useState('');
  const [hierarchyState, setHierarchyState] = useState<{
    step: 'groups' | 'companies' | 'types' | 'items' | 'search';
    selectedGroup: string | null;
    selectedCompany: string | null;
    selectedType: string | null;
  }>({
    step: 'groups',
    selectedGroup: null,
    selectedCompany: null,
    selectedType: null,
  });

  // Item Detail Card Modal State (Auto-Focus & Select on Quantity)
  const [isDetailCardOpen, setIsDetailCardOpen] = useState(false);
  const [cardItem, setCardItem] = useState<any>(null);
  const [cardQty, setCardQty] = useState<string>('1');
  const [cardPrice, setCardPrice] = useState<string>('0');
  const [cardSpec, setCardSpec] = useState<string>('');
  const cardQtyInputRef = useRef<HTMLInputElement | null>(null);

  // Modify Invoice Item Modal State
  const [isModifyModalOpen, setIsModifyModalOpen] = useState(false);
  const [modifyItemIndex, setModifyItemIndex] = useState<number>(-1);
  const [modifyItemName, setModifyItemName] = useState<string>('');
  const [modifyItemQty, setModifyItemQty] = useState<string>('');
  const [modifyItemPrice, setModifyItemPrice] = useState<string>('');
  const [modifyItemSpec, setModifyItemSpec] = useState<string>('');
  const modifyQtyInputRef = useRef<HTMLInputElement | null>(null);

  // New Item Registration Modal State
  const [isNewItemModalOpen, setIsNewItemModalOpen] = useState(false);
  const [newInputItemName, setNewInputItemName] = useState('');
  const [newInputItemCode, setNewInputItemCode] = useState('');
  const [editBuyPrice, setEditBuyPrice] = useState('');
  const [editItemCategory, setEditItemCategory] = useState('');
  const [editCashPriceManual, setEditCashPriceManual] = useState('');
  const [editWholesalePriceManual, setEditWholesalePriceManual] = useState('');
  const [editQty, setEditQty] = useState('');

  // 🌳 نافذة إضافة هيكل شجري متكامل للصنف الجديد (مجموعة > تصنيف > نوع > صنف)
  const [isNewHierarchyModalOpen, setIsNewHierarchyModalOpen] = useState(false);
  const [hierGroup, setHierGroup] = useState('');
  const [hierCompany, setHierCompany] = useState('');
  const [hierType, setHierType] = useState('');
  const [hierItemName, setHierItemName] = useState('');
  const [hierItemCode, setHierItemCode] = useState('');
  const [hierBuyPrice, setHierBuyPrice] = useState('');
  const [hierCashPrice, setHierCashPrice] = useState('');
  const [hierWholesalePrice, setHierWholesalePrice] = useState('');
  const [hierStock, setHierStock] = useState('');

  // Auto-Focus helper for modals
  const autoFocusModalFirstInput = (containerRefId: string) => {
    setTimeout(() => {
      const container = document.getElementById(containerRefId);
      if (container) {
        const input = container.querySelector<HTMLInputElement | HTMLSelectElement>(
          'input:not([readonly]):not([type="hidden"]), select'
        );
        if (input) {
          input.focus();
          if ((input as HTMLInputElement).select) (input as HTMLInputElement).select();
        }
      }
    }, 80);
  };

  useEffect(() => {
    if (isOptionsModalOpen) autoFocusModalFirstInput('optionsModal');
  }, [isOptionsModalOpen]);

  useEffect(() => {
    if (isLookupModalOpen) autoFocusModalFirstInput('lookupModal');
  }, [isLookupModalOpen]);

  useEffect(() => {
    if (isNewItemModalOpen) autoFocusModalFirstInput('editItemModal');
  }, [isNewItemModalOpen]);

  // Keyboard Enter Navigation
  const handleKeyDownEnterNav = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT') {
        if (isDetailCardOpen && target.id === 'input-card-qty') {
          e.preventDefault();
          confirmAddDetailedItem();
          return;
        }

        const modalContainer =
          target.closest('.modal-box') ||
          target.closest('.lookup-modal-box') ||
          target.closest('.app-container');

        if (modalContainer) {
          const focusable = Array.from(
            modalContainer.querySelectorAll<HTMLElement>(
              'input:not([readonly]):not([disabled]):not([type="hidden"]), select:not([disabled]), button:not([disabled])'
            )
          ).filter((el) => el.offsetParent !== null);

          const index = focusable.indexOf(target);
          if (index > -1 && index + 1 < focusable.length) {
            e.preventDefault();
            const nextEl = focusable[index + 1];
            nextEl.focus();
            if ((nextEl as HTMLInputElement).select) {
              (nextEl as HTMLInputElement).select();
            }
          }
        }
      }
    }
  };

  // Open Item Detail Card and Auto-Focus & Select on Quantity
  const openItemDetailCard = (item: any) => {
    setCardItem(item);
    const calculatedP = getItemPriceForTier(item, activePricingTier);
    setCardPrice(calculatedP.toString());
    setCardQty('1');
    setCardSpec('');
    setIsLookupModalOpen(false);
    setIsDetailCardOpen(true);

    requestAnimationFrame(() => {
      setTimeout(() => {
        if (cardQtyInputRef.current) {
          cardQtyInputRef.current.focus();
          cardQtyInputRef.current.select();
        }
      }, 60);
    });
  };

  // Confirm Adding Item from Detail Card
  const confirmAddDetailedItem = () => {
    if (!cardItem) return;
    const q = parseFloat(cardQty) || 1;
    const p = parseFloat(cardPrice) || 0;
    const s = cardSpec.trim();

    if (isSale) {
      setLocalItemsDatabase((prev) =>
        prev.map((i) => (i.code === cardItem.code ? { ...i, stock: Math.max(0, (i.stock || 0) - q) } : i))
      );
    }

    // 🔍 فحص ما إذا كان البند مضافاً مسبقاً في الفاتورة:
    // إذا لم يُكتب له وصف أو بيان جديد، يزيد العدد ولا ينزل بنداً منفرداً.
    // وينزل بنداً منفرداً فقط في حالة كتابة وصف أو بيان محدد ومختلف طبقاً لطلب المستخدم بدقة.
    setCurrentInvoiceItems((prev) => {
      let targetIndex = -1;

      if (s !== '') {
        // إذا كتب المستخدم بياناً أو وصفاً: يبحث عن بند يحمل نفس هذا البيان تماماً، وإلا ينزل بنداً منفرداً
        targetIndex = prev.findIndex((r) => {
          const isSame =
            (r.code && cardItem.code && r.code.trim().toLowerCase() === cardItem.code.trim().toLowerCase()) ||
            (r.itemId && cardItem.itemId && String(r.itemId) === String(cardItem.itemId)) ||
            (r.name && cardItem.name && r.name.trim().toLowerCase() === cardItem.name.trim().toLowerCase());
          return isSame && (r.spec || '').trim() === s;
        });
      } else {
        // إذا لم يكتب المستخدم أي بيان أو وصف: يزيد العدد على البند القائم (الخالي من الوصف، أو أول بند من الصنف)
        targetIndex = prev.findIndex((r) => {
          const isSame =
            (r.code && cardItem.code && r.code.trim().toLowerCase() === cardItem.code.trim().toLowerCase()) ||
            (r.itemId && cardItem.itemId && String(r.itemId) === String(cardItem.itemId)) ||
            (r.name && cardItem.name && r.name.trim().toLowerCase() === cardItem.name.trim().toLowerCase());
          return isSame && (r.spec || '').trim() === '';
        });

        if (targetIndex === -1) {
          // إذا لم يجد بنداً بدون وصف، يبحث عن أي بند من هذا الصنف لزيادة عدده
          targetIndex = prev.findIndex((r) =>
            (r.code && cardItem.code && r.code.trim().toLowerCase() === cardItem.code.trim().toLowerCase()) ||
            (r.itemId && cardItem.itemId && String(r.itemId) === String(cardItem.itemId)) ||
            (r.name && cardItem.name && r.name.trim().toLowerCase() === cardItem.name.trim().toLowerCase())
          );
        }
      }

      if (targetIndex > -1) {
        // زيادة العدد للبند القائم بدلاً من تكراره في سطر منفصل
        return prev.map((row, idx) => {
          if (idx === targetIndex) {
            const newQty = Number((row.qty + q).toFixed(2));
            const newPrice = p > 0 ? p : row.price;
            return {
              ...row,
              qty: newQty,
              price: newPrice,
              total: Number((newQty * newPrice).toFixed(2)),
            };
          }
          return row;
        });
      }

      // إضافة بند جديد في سطر منفصل (في حال كان صنفاً جديداً أو كُتب له وصف/بيان خاص)
      const cPrice = Number(cardItem.cashPrice || getItemPriceForTier(cardItem, 'cash'));
      const wPrice = Number(cardItem.wholesalePrice || getItemPriceForTier(cardItem, 'wholesale'));
      const bPrice = Number(cardItem.buyPrice || getItemPriceForTier(cardItem, 'buy'));

      const newRow: WorkspaceItemRow = {
        rowId: `row_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        code: cardItem.code,
        name: cardItem.name,
        spec: s,
        qty: q,
        price: p,
        total: Number((q * p).toFixed(2)),
        itemId: cardItem.itemId,
        costPrice: cardItem.buyPrice,
        cashPrice: cPrice > 0 ? cPrice : (p > 0 ? p : 10),
        wholesalePrice: wPrice > 0 ? wPrice : Math.round((cPrice || p || 10) * 0.90 * 100) / 100,
        buyPrice: bPrice > 0 ? bPrice : Math.round((cPrice || p || 10) * 0.75 * 100) / 100,
      };
      return [...prev, newRow];
    });

    showToast(s ? `تم إدراج البند مع الوصف: ${cardItem.name}` : `تمت زيادة العدد للصنف: ${cardItem.name}`, 'info');
    setIsDetailCardOpen(false);
    setCardItem(null);
  };

  // Modify Row
  const openModifyInvoiceItem = (index: number) => {
    const item = currentInvoiceItems[index];
    if (!item) return;
    setModifyItemIndex(index);
    setModifyItemName(item.name);
    setModifyItemQty(item.qty.toString());
    setModifyItemPrice(item.price.toString());
    setModifyItemSpec(item.spec || '');
    setIsModifyModalOpen(true);

    setTimeout(() => {
      if (modifyQtyInputRef.current) {
        modifyQtyInputRef.current.focus();
        modifyQtyInputRef.current.select();
      }
    }, 60);
  };

  const saveModifiedInvoiceItem = () => {
    if (modifyItemIndex < 0 || modifyItemIndex >= currentInvoiceItems.length) return;
    const q = parseFloat(modifyItemQty) || 0;
    const p = parseFloat(modifyItemPrice) || 0;
    const s = modifyItemSpec.trim();

    if (q <= 0) {
      alert('يرجى إدخال كمية صحيحة أكبر من صفر');
      return;
    }

    setCurrentInvoiceItems((prev) =>
      prev.map((item, idx) =>
        idx === modifyItemIndex
          ? {
              ...item,
              qty: q,
              price: p,
              spec: s,
              total: Number((q * p).toFixed(2)),
            }
          : item
      )
    );

    setIsModifyModalOpen(false);
  };

  const removeItem = (index: number) => {
    const removed = currentInvoiceItems[index];
    if (removed && isSale) {
      setLocalItemsDatabase((prev) =>
        prev.map((i) => (i.code === removed.code ? { ...i, stock: (i.stock || 0) + Number(removed.qty || 0) } : i))
      );
    }
    setCurrentInvoiceItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Add Payment Row
  const addPaymentRow = (defaultMethod: string = 'نقدي', defaultAmount: number = 0) => {
    setPaymentRows((prev) => [
      ...prev,
      { id: String(Date.now() + Math.random()), method: defaultMethod, amount: defaultAmount || 0 },
    ]);
  };

  const removePaymentRow = (id: string) => {
    setPaymentRows((prev) => prev.filter((r) => r.id !== id));
  };

  // Calculations
  const totals = useMemo(() => {
    let totalQtySum = 0;
    let itemsSubTotal = 0;

    currentInvoiceItems.forEach((i) => {
      totalQtySum += Number(i.qty) || 0;
      itemsSubTotal += (Number(i.price) || 0) * (Number(i.qty) || 0);
    });

    const globalDiscInput = parseFloat(globalInvDisc) || 0;
    const globalDiscCalculated =
      invDiscType === 'percent' ? itemsSubTotal * (globalDiscInput / 100) : globalDiscInput;

    const globalTaxInput = parseFloat(globalInvTax) || 0;
    const taxableBase = Math.max(0, itemsSubTotal - globalDiscCalculated);
    const globalTaxCalculated =
      invTaxType === 'percent' ? taxableBase * (globalTaxInput / 100) : globalTaxInput;

    const extraVal = parseFloat(extraIncomeVal) || 0;
    const netTotal = Math.max(0, itemsSubTotal - globalDiscCalculated + globalTaxCalculated + extraVal);

    let paidTotal = 0;
    if (paymentRows.length === 0) {
      paidTotal = (selectedInvoiceType === 'nagdi' || selectedInvoiceType === 'return_nagdi') ? netTotal : 0;
    } else {
      paymentRows.forEach((r) => {
        paidTotal += Math.max(0, Number(r.amount) || 0);
      });
    }

    const remainTotal = Math.max(0, netTotal - paidTotal);

    return {
      qtySum: totalQtySum,
      subtotal: itemsSubTotal,
      discount: globalDiscCalculated,
      tax: globalTaxCalculated,
      extra: extraVal,
      net: netTotal,
      paid: paidTotal,
      remain: remainTotal,
    };
  }, [currentInvoiceItems, globalInvDisc, invDiscType, globalInvTax, invTaxType, extraIncomeVal, paymentRows, selectedInvoiceType]);

  // Open New Item Modal
  const openEditModalForNewItem = () => {
    setNewInputItemName('');
    const newCode = 'UA' + String(localItemsDatabase.length + 101);
    setNewInputItemCode(newCode);
    setEditBuyPrice('');
    setEditCashPriceManual('');
    setEditWholesalePriceManual('');
    setEditQty('');
    const groups = [...new Set(localItemsDatabase.map((i) => i.group))];
    setEditItemCategory(groups[0] || 'بويات');
    setIsNewItemModalOpen(true);
  };

  // 🌳 فتح نافذة إضافة هيكل شجري متكامل (مجموعة > تصنيف/شركة > نوع > صنف) - خالي تماماً ليدخل المستخدم بياناته لأول مرة
  const openNewHierarchyModal = () => {
    setHierGroup('');
    setHierCompany('');
    setHierType('');
    setHierItemName('');
    const newCode = localItemsDatabase.length > 0 ? ('UA' + String(localItemsDatabase.length + 101)) : '';
    setHierItemCode(newCode);
    setHierBuyPrice('');
    setHierCashPrice('');
    setHierWholesalePrice('');
    setHierStock('');
    setIsNewHierarchyModalOpen(true);
  };

  const saveNewHierarchyModal = () => {
    const grp = hierGroup.trim();
    const comp = hierCompany.trim();
    const typ = hierType.trim();
    const name = hierItemName.trim();
    const code = hierItemCode.trim() || ('UA' + String(localItemsDatabase.length + 101));

    if (!grp) {
      alert('يرجى تحديد أو كتابة اسم المجموعة الرئيسية');
      return;
    }
    if (!comp) {
      alert('يرجى تحديد أو كتابة اسم التصنيف أو الشركة');
      return;
    }
    if (!typ) {
      alert('يرجى تحديد أو كتابة اسم النوع أو القسم الفرعي');
      return;
    }
    if (!name) {
      alert('يرجى إدخال اسم الصنف');
      return;
    }

    const buyP = parseFloat(hierBuyPrice) || 0;
    const cashP = parseFloat(hierCashPrice) || (buyP > 0 ? buyP * 1.25 : 10);
    const wholesaleP = parseFloat(hierWholesalePrice) || (cashP > 0 ? cashP * 0.90 : buyP * 1.15);
    const qtyP = parseFloat(hierStock) || 0;

    const newItem = {
      code,
      name,
      group: grp,
      company: comp,
      typeName: typ,
      stock: qtyP,
      buyPrice: buyP,
      cashPrice: cashP,
      wholesalePrice: wholesaleP,
      wholesaleBuyPrice: Number((buyP * 0.95).toFixed(2)),
      itemId: `item_${Date.now()}`,
    };

    setLocalItemsDatabase((prev) => [...prev, newItem]);

    const newAppItem: Item = {
      id: newItem.itemId,
      code,
      name,
      category: grp,
      material: comp,
      unit: typ,
      quantity: qtyP,
      purchasePrice: buyP,
      salePrice: cashP,
      wholesalePrice: wholesaleP,
    };

    onUpdateData(
      {
        ...appData,
        items: [...(appData.items || []), newAppItem],
      },
      {
        action: 'create_item',
        module: 'المخزون',
        details: `إضافة هيكل شجري كامل: ${grp} > ${comp} > ${typ} > ${name}`,
      }
    );

    setIsNewHierarchyModalOpen(false);

    // توجيه الشجرة فوراً إلى موقع الصنف الجديد لاختياره بنقرة واحدة
    setHierarchyState({
      step: 'items',
      selectedGroup: grp,
      selectedCompany: comp,
      selectedType: typ,
    });
    setGlobalLookupSearch('');

    showToast(`تمت إضافة المجموعة [${grp}] والتصنيف [${comp}] والنوع [${typ}] والصنف [${name}] بنجاح`, 'success');
  };

  const saveNewItemData = () => {
    const name = newInputItemName.trim();
    const code = newInputItemCode.trim();
    if (!name) {
      alert('يرجى إدخال اسم الصنف');
      return;
    }

    const buyP = parseFloat(editBuyPrice) || 0;
    const cashP = parseFloat(editCashPriceManual) || (buyP * 1.15);
    const wholesaleP = parseFloat(editWholesalePriceManual) || (cashP * 0.95);
    const qtyP = parseFloat(editQty) || 0;

    const newItem = {
      code,
      name,
      group: editItemCategory || 'بويات',
      company: 'عام',
      typeName: 'عام',
      stock: qtyP,
      buyPrice: buyP,
      cashPrice: cashP,
      wholesalePrice: wholesaleP,
      wholesaleBuyPrice: Number((buyP * 0.95).toFixed(2)),
      itemId: `item_${Date.now()}`,
    };

    setLocalItemsDatabase((prev) => [...prev, newItem]);

    const newAppItem: Item = {
      id: newItem.itemId,
      code,
      name,
      category: newItem.group,
      quantity: qtyP,
      purchasePrice: buyP,
      salePrice: cashP,
      wholesalePrice: wholesaleP,
    };

    onUpdateData(
      {
        ...appData,
        items: [...(appData.items || []), newAppItem],
      },
      {
        action: 'create_item',
        module: 'المخزون',
        details: `إضافة صنف جديد: ${name} بكود ${code}`,
      }
    );

    setIsNewItemModalOpen(false);
    openItemDetailCard(newItem);
  };

  // Save Invoice & Post to Ledger & Database
  const saveInvoice = () => {
    if (currentInvoiceItems.length === 0) {
      alert('الفاتورة فارغة! يرجى إدراج صنف واحد على الأقل من دليل الأصناف.');
      return;
    }

    const defaultPartyName = isSale
      ? custName.trim() || 'عميل نقدي'
      : custName.trim() || 'مورد عام';

    let finalPayments = [...paymentRows];
    if (finalPayments.length === 0) {
      if (selectedInvoiceType === 'nagdi' || selectedInvoiceType === 'return_nagdi') {
        finalPayments = [{ id: '1', method: 'نقدي', amount: totals.net }];
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
        salesType: activePricingTier === 'wholesale' ? 'wholesale' : 'cash',
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
      const updated = postPurchaseInvoice(appData, invoiceData, isEditing, editingInvoice?.id);

      onUpdateData(updated, {
        action: isEditing ? 'تعديل فاتورة مشتريات' : 'حفظ فاتورة مشتريات',
        module: 'المشتريات',
        details: `فاتورة مشتريات #${invNum} - المورد: ${defaultPartyName} - الصافي: ${totals.net.toFixed(2)} ج.م`,
      });

      showToast(`✅ تم حفظ وترحيل فاتورة المشتريات #${invNum} وتحديث التوريدات والمخزن بنجاح`, 'success');
      onClose();
    }
  };

  // Direct Print Invoice
  const handlePrintCurrentInvoice = () => {
    const defaultPartyName = isSale
      ? custName.trim() || 'عميل نقدي'
      : custName.trim() || 'مورد عام';

    const tempInvoice: any = {
      id: Number(invNum) || invoiceId,
      date: invDate,
      time: invTime,
      type: selectedInvoiceType,
      customerName: defaultPartyName,
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
      })),
      subtotal: totals.subtotal,
      discount: totals.discount,
      tax: totals.tax,
      extraRevenueAmount: totals.extra,
      extraRevenueName: extraIncomeName,
      total: totals.net,
      paidAmount: totals.paid,
      remainingAmount: totals.remain,
      paymentMethod: paymentRows[0]?.method || 'نقدي',
      branchId: appData.activeBranchId || 'main',
      createdBy: appData.users?.find((u) => u.id === appData.currentUser)?.name || 'مدير النظام',
    };

    printInvoiceWindow(tempInvoice, isSale, appData.settings, showToast);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-2 bg-slate-900/70 select-none overflow-hidden"
      dir="rtl"
      onKeyDown={handleKeyDownEnterNav}
    >
      {/* 📱 Scoped CSS matching Image 2 100% with crisp non-truncated headers and zero horizontal scroll */}
      <style>{`
        .app-container {
          width: 100%;
          max-width: 480px;
          background: #fff;
          border-radius: 0px;
          border: 1px solid #cbd5e1;
          box-shadow: 0 2px 10px rgba(0,0,0,0.08);
          display: flex;
          flex-direction: column;
          height: 100%;
          max-height: 100vh;
          position: relative;
          overflow-x: hidden;
          overflow-y: hidden;
          box-sizing: border-box;
        }
        @media (min-width: 640px) {
          .app-container {
            border-radius: 6px;
            max-width: 580px;
            max-height: 98vh;
          }
        }
        @media (min-width: 768px) {
          .app-container {
            max-width: 680px;
          }
        }
        @media (min-width: 1024px) {
          .app-container {
            max-width: 800px;
          }
        }
        .header-title {
          background: #1e293b;
          color: #fff;
          padding: 5px 8px;
          font-size: 10.5px;
          font-weight: bold;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-shrink: 0;
          box-sizing: border-box;
          border-top-left-radius: inherit;
          border-top-right-radius: inherit;
        }
        #liveTime {
          font-size: 9.5px;
          font-family: inherit;
          font-weight: bold;
        }
        .main-content {
          padding: 4px;
          display: flex;
          flex-direction: column;
          gap: 3px;
          flex: 1;
          overflow-x: hidden;
          overflow-y: hidden;
          min-height: 0;
          box-sizing: border-box;
        }
        .invoice-card {
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 3px;
          padding: 3px;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 2px;
          flex-shrink: 0;
          box-sizing: border-box;
          width: 100%;
        }
        .field-inline {
          display: flex;
          flex-direction: column;
          gap: 1px;
          min-width: 0;
          position: relative;
          box-sizing: border-box;
        }
        .field-inline label {
          font-size: 8px;
          font-weight: bold;
          color: #475569;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .field-inline input, .field-inline select {
          padding: 2px 4px;
          border: 1px solid #cbd5e1;
          border-radius: 3px;
          font-size: 9px;
          outline: none;
          background: #fff;
          width: 100%;
          height: 22px;
          box-sizing: border-box;
        }
        .field-inline input:focus, .field-inline select:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.2);
        }
        .span-2 { grid-column: span 2; }
        .span-3 { grid-column: span 3; }

        /* 🟡 شريط حالة الحساب والدائن/المدين (طبق الأصل للصورة 2) */
        .account-status-bar {
          background: #fefce8;
          border: 1px solid #fef08a;
          border-radius: 3px;
          padding: 3px 6px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 8.5px;
          font-weight: bold;
          flex-shrink: 0;
          width: 100%;
          box-sizing: border-box;
        }

        /* 🏷️ نظام تسعير الفاتورة (طبق الأصل للصورة 2) */
        .pricing-tier-bar {
          background: #fff;
          border: 1px solid #cbd5e1;
          border-radius: 3px;
          padding: 3px 5px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-shrink: 0;
          width: 100%;
          box-sizing: border-box;
          gap: 4px;
        }
        .pricing-tier-btn {
          flex: 1;
          padding: 2px 4px;
          font-size: 8.5px;
          font-weight: bold;
          border-radius: 3px;
          cursor: pointer;
          border: 1px solid #cbd5e1;
          background: #fff;
          color: #334155;
          text-align: center;
          white-space: nowrap;
          box-sizing: border-box;
          transition: all 0.15s ease;
        }
        .pricing-tier-btn.active-cash {
          background: #16a34a !important;
          color: #fff !important;
          border-color: #16a34a !important;
        }
        .pricing-tier-btn.active-wholesale {
          background: #2563eb !important;
          color: #fff !important;
          border-color: #2563eb !important;
        }
        .pricing-tier-btn.active-buy {
          background: #d97706 !important;
          color: #fff !important;
          border-color: #d97706 !important;
        }

        .top-actions-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 3px;
          flex-shrink: 0;
          box-sizing: border-box;
          width: 100%;
        }
        .btn-action-top {
          width: 100%;
          padding: 5px;
          background: #2563eb;
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
          box-sizing: border-box;
          white-space: nowrap;
        }
        .btn-action-alt {
          background: #475569;
        }
        .table-responsive {
          width: 100%;
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          border: 1px solid #cbd5e1;
          border-radius: 3px;
          background: #fff;
          min-height: 0;
          box-sizing: border-box;
        }
        table {
          width: 100%;
          table-layout: fixed;
          border-collapse: collapse;
          text-align: center;
          box-sizing: border-box;
        }
        th, td {
          border: 1px solid #cbd5e1;
          vertical-align: middle;
          white-space: nowrap;
          box-sizing: border-box;
        }
        /* 📏 ترويسة الجدول بدون أي اختصارات أو نقاط قطع */
        th {
          background: #f1f5f9;
          color: #1e293b;
          font-weight: 700;
          height: 20px;
          font-size: 7.2px;
          padding: 1px 1px;
          position: sticky;
          top: 0;
          z-index: 2;
          overflow: hidden;
          letter-spacing: -0.25px;
          text-align: center;
        }
        tbody tr {
          height: 19px;
        }
        tbody tr td {
          padding: 1px 2px;
          height: 19px;
          line-height: 1.15;
          font-size: 7.2px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        /* النسب الدقيقة لظهور كافة الكلمات كاملة على الهاتف: م | الصنف | الوصف | العدد | سعر | اجمالي | إجراء */
        .col-seq { width: 5%; text-align: center; font-size: 7.2px; }
        .col-item { width: 27%; text-align: right; padding-right: 3px; font-weight: 600; font-size: 7.2px; }
        .col-desc { width: 16%; text-align: right; padding-right: 2px; font-size: 7.2px; }
        .col-qty { width: 11%; text-align: center; font-size: 7.2px; }
        .col-price { width: 13%; text-align: center; font-size: 7.2px; }
        .col-total { width: 16%; font-weight: bold; text-align: center; font-size: 7.2px; }
        .col-action { width: 12%; text-align: center; }

        .invoice-item-actions {
          display: inline-flex;
          gap: 4px;
          justify-content: center;
          align-items: center;
        }
        .invoice-item-actions i {
          cursor: pointer;
          font-size: 9.5px;
          padding: 1px;
        }
        .bottom-fixed-area {
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: 3px;
          background: #fff;
          padding: 4px;
          border-top: 1px solid #cbd5e1;
          position: sticky;
          bottom: 0;
          z-index: 100;
          box-sizing: border-box;
          width: 100%;
        }
        .summary-bar {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 2.5px;
          background: #ffffff;
          color: #0f172a;
          border: 1.5px solid #cbd5e1;
          padding: 4px;
          border-radius: 4px;
          text-align: center;
          box-sizing: border-box;
          width: 100%;
          box-shadow: 0 1px 2px rgba(0,0,0,0.04);
        }
        .summary-item {
          font-size: 8px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          color: #334155;
          padding: 2.5px 2px;
          border-radius: 3px;
          box-sizing: border-box;
        }
        .summary-item span {
          font-weight: bold;
          color: #16a34a;
          display: block;
          font-size: 8.5px;
        }
        .summary-net {
          grid-column: span 3;
          background: #f0fdf4 !important;
          border: 1.5px solid #86efac !important;
          color: #166534 !important;
          font-size: 9.5px !important;
          font-weight: bold !important;
        }
        .summary-net span { color: #15803d !important; font-size: 11px !important; font-weight: 900 !important; }
        .btn-action-bar {
          display: flex;
          gap: 3px;
          width: 100%;
          box-sizing: border-box;
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
          box-sizing: border-box;
        }
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.65);
          z-index: 2000;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 6px;
          box-sizing: border-box;
          overflow: hidden;
        }
        .modal-box {
          background: #fff;
          width: 100%;
          max-width: 400px;
          border-radius: 8px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          border: 1px solid #cbd5e1;
          box-shadow: 0 4px 15px rgba(0,0,0,0.2);
          box-sizing: border-box;
        }
        .modal-header {
          background: #2563eb;
          color: white;
          padding: 6px 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 10.5px;
          font-weight: bold;
          box-sizing: border-box;
        }
        .modal-body {
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          box-sizing: border-box;
          max-height: 85vh;
          overflow-y: auto;
        }
        .big-toggle-group {
          display: flex;
          border: 2px solid #2563eb;
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
          color: #2563eb;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .big-toggle-btn.active {
          background: #2563eb;
          color: white;
        }
        .edit-card-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 4px;
          box-sizing: border-box;
          width: 100%;
        }
        .lookup-modal-box {
          background: #ffffff;
          width: 100%;
          max-width: 580px;
          height: 92vh;
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          border: 2px solid #94a3b8;
          overflow: hidden;
          box-sizing: border-box;
          box-shadow: 0 10px 25px rgba(0,0,0,0.15);
        }
        .hierarchy-nav-bar {
          background: #ffffff;
          padding: 6px 10px;
          border-bottom: 1.5px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
          font-size: 9.5px;
          font-weight: bold;
          color: #0f172a;
          flex-shrink: 0;
          box-sizing: border-box;
        }
        .hierarchy-btns-group {
          display: flex;
          gap: 3px;
        }
        .hier-btn {
          background: #f8fafc;
          color: #0f172a;
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          padding: 3.5px 8px;
          cursor: pointer;
          font-size: 8.5px;
          font-weight: bold;
          display: flex;
          align-items: center;
          gap: 3px;
          transition: background 0.15s ease;
        }
        .hier-btn:hover {
          background: #f1f5f9;
        }
        .hier-btn.success {
          background: #16a34a;
          color: #ffffff;
          border-color: #15803d;
        }
        .hierarchy-content-area {
          flex: 1;
          background: #f8fafc;
          padding: 6px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 5px;
          box-sizing: border-box;
        }
        .hierarchy-card-item {
          background: #fff;
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          padding: 7px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          font-weight: bold;
          font-size: 10px;
          color: #1e293b;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          box-sizing: border-box;
          width: 100%;
        }
        .hierarchy-card-item:hover {
          background: #eff6ff;
          border-color: #2563eb;
        }
        .search-quick-bar {
          background: #fff;
          padding: 4px;
          border-bottom: 1px solid #cbd5e1;
          display: flex;
          gap: 4px;
          align-items: center;
          flex-shrink: 0;
          box-sizing: border-box;
          width: 100%;
        }
      `}</style>

      {/* 📦 Main Rakeeza App Container (مطابق للصورة 2 تماماً) */}
      <div
        className={`app-container ${
          isMaximized ? '!max-w-none !w-full !h-full !max-h-full !rounded-none' : ''
        }`}
      >
        {/* 🏷️ Header Bar (نظام الفواتير والمخزون - ركيزة) مع ثيم وعنوان ديناميكي يعبر عن نوع الحركة */}
        <div className="header-title" style={{ background: invoiceTheme.bg, borderBottomColor: invoiceTheme.border }}>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onClose}
              className="text-white hover:text-rose-400 p-0.5 rounded transition cursor-pointer"
              title="إغلاق"
            >
              <i className="fa-solid fa-xmark text-xs"></i>
            </button>
            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              className="text-white hover:text-blue-300 p-0.5 rounded transition cursor-pointer"
              title={isMaximized ? 'تصغير' : 'تكبير'}
            >
              <i className={`fa-solid ${isMaximized ? 'fa-compress' : 'fa-expand'} text-[9px]`}></i>
            </button>
            <span style={{ fontWeight: 800, fontSize: '10.5px' }}>
              <i className={`fa-solid ${invoiceTheme.icon} ml-1`}></i>
              {invoiceTheme.badgeText}
            </span>
          </div>
          <span id="liveTime">{liveTime}</span>
        </div>

        {/* 📑 Main Content Area */}
        <div className="main-content">
          {/* 1. Header Information Card (3 columns) */}
          <div className="invoice-card">
            <div className="field-inline">
              <label>رقم الفاتورة</label>
              <input type="text" value={invNum} readOnly />
            </div>
            <div className="field-inline">
              <label>التاريخ</label>
              <input
                type="date"
                value={invDate}
                onChange={(e) => setInvDate(e.target.value)}
              />
            </div>
            <div className="field-inline">
              <label>الوقت</label>
              <input
                type="time"
                value={invTime}
                onChange={(e) => setInvTime(e.target.value)}
              />
            </div>
            <div className="field-inline">
              <label>{isSale ? 'كود العميل' : 'كود المورد'}</label>
              <input
                type="text"
                value={custCode}
                onChange={(e) => setCustCode(e.target.value)}
                placeholder="الكود..."
              />
            </div>
            <div className="field-inline">
              <label>{isSale ? 'اسم العميل (بحث)' : 'اسم المورد (بحث)'}</label>
              <input
                type="text"
                value={custName}
                onFocus={() => setShowCustDropdown(true)}
                onChange={(e) => {
                  setCustName(e.target.value);
                  setShowCustDropdown(true);
                }}
                placeholder="اكتب للبحث..."
              />
              {showCustDropdown && partySuggestions.length > 0 && (
                <div className="absolute top-[26px] right-0 left-0 bg-white border border-slate-300 rounded shadow-lg z-50 max-h-36 overflow-y-auto text-[8.5px]">
                  {partySuggestions.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setCustName(p.name);
                        setCustCode(p.code || p.id);
                        if (p.phone) setCustPhone(p.phone);
                        setShowCustDropdown(false);
                      }}
                      className="p-1.5 hover:bg-blue-50 cursor-pointer border-b border-slate-100 flex justify-between items-center"
                    >
                      <span className="font-bold text-slate-800">{p.name}</span>
                      <span className="text-slate-500 font-mono text-[7.5px]">
                        {p.phone || p.code || p.id}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="field-inline">
              <label>رقم الهاتف (بحث)</label>
              <input
                type="text"
                value={custPhone}
                onChange={(e) => setCustPhone(e.target.value)}
                placeholder="ابحث برقم الهاتف..."
              />
            </div>
            <div className="field-inline span-3">
              <label>البيان / جهة العمل</label>
              <input
                type="text"
                value={jobSite}
                onChange={(e) => setJobSite(e.target.value)}
                placeholder="البيان..."
              />
            </div>
          </div>

          {/* 🟡 2. شريط حالة الحساب والدائن/المدين (طبق الأصل للصورة 2) */}
          <div className="account-status-bar">
            <div>
              <span className="text-slate-600">حالة الحساب: </span>
              <span
                style={{
                  color:
                    selectedInvoiceType === 'ajel'
                      ? '#d97706'
                      : partyBalance > 0
                      ? '#dc2626'
                      : partyBalance < 0
                      ? '#2563eb'
                      : '#16a34a',
                }}
              >
                {selectedInvoiceType === 'ajel'
                  ? 'آجل'
                  : partyBalance > 0
                  ? (isSale ? 'مدين (عليه مديونية)' : 'دائن (له مستحقات)')
                  : partyBalance < 0
                  ? (isSale ? 'دائن (له رصيد)' : 'مدين (عليه رصيد)')
                  : 'نقدي'}
              </span>
            </div>
            <div>
              <span className="text-amber-900">المبلغ (له / عليه): </span>
              <span
                style={{
                  color:
                    partyBalance > 0
                      ? '#dc2626'
                      : partyBalance < 0
                      ? '#2563eb'
                      : '#16a34a',
                  fontFamily: 'monospace',
                }}
              >
                {partyBalance !== 0
                  ? `${Math.abs(partyBalance).toFixed(2)} ج.م ${
                      isSale
                        ? partyBalance > 0
                          ? '(عليه)'
                          : '(له)'
                        : partyBalance > 0
                        ? '(له)'
                        : '(عليه)'
                    }`
                  : '0.00 ج.م'}
              </span>
            </div>
          </div>

          {/* 🏷️ 3. نظام تسعير الفاتورة: [سعر نقدي] [سعر جملة] [سعر شراء] (طبق الأصل للصورة 2) */}
          <div className="pricing-tier-bar">
            <span style={{ fontSize: '8.5px', fontWeight: 'bold', color: '#1e293b' }}>
              نظام تسعير الفاتورة:
            </span>
            <div style={{ display: 'flex', gap: '3px', flex: 1, maxWidth: '240px' }}>
              <button
                type="button"
                onClick={() => handleChangePricingTier('cash')}
                className={`pricing-tier-btn ${activePricingTier === 'cash' ? 'active-cash' : ''}`}
                title="سعر البيع النقدي (القطاعي)"
              >
                سعر نقدي
              </button>
              <button
                type="button"
                onClick={() => handleChangePricingTier('wholesale')}
                className={`pricing-tier-btn ${activePricingTier === 'wholesale' ? 'active-wholesale' : ''}`}
                title="سعر بيع الجملة"
              >
                سعر جملة
              </button>
              <button
                type="button"
                onClick={() => handleChangePricingTier('buy')}
                className={`pricing-tier-btn ${activePricingTier === 'buy' ? 'active-buy' : ''}`}
                title="سعر الشراء والتكلفة"
              >
                سعر شراء
              </button>
            </div>
          </div>

          {/* 4. Top Action Buttons Grid (دليل الأصناف، والخصم والدفع - طبقاً للصورة 2) */}
          <div className="top-actions-grid">
            <button
              type="button"
              className="btn-action-top"
              onClick={() => {
                setHierarchyState({ step: 'groups', selectedGroup: null, selectedCompany: null, selectedType: null });
                setGlobalLookupSearch('');
                setIsLookupModalOpen(true);
              }}
              title="دليل الأصناف والتنقل الهرمي لاختيار صنف"
            >
              <i className="fa-solid fa-boxes-stacked ml-1"></i> دليل الأصناف
            </button>
            <button
              type="button"
              className="btn-action-top btn-action-alt"
              onClick={() => {
                setIsOptionsModalOpen(true);
              }}
              title="الخصم، الضريبة وإدارة المدفوعات"
            >
              <i className="fa-solid fa-sliders ml-1"></i> الخصم والدفع
            </button>
          </div>

          {/* 5. Compact Items Table (تنسيق مدمج مع ظهور كامل لترويسات الأعمدة طبقاً للصورة 2) */}
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th className="col-seq">م</th>
                  <th className="col-item">الصنف</th>
                  <th className="col-desc">الوصف</th>
                  <th className="col-qty">العدد</th>
                  <th className="col-price">سعر</th>
                  <th className="col-total">اجمالي</th>
                  <th className="col-action">إجراء</th>
                </tr>
              </thead>
              <tbody id="invoiceItemsTable">
                {currentInvoiceItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ color: '#94a3b8', padding: '15px' }}>
                      لم يتم إدراج أصناف بعد
                    </td>
                  </tr>
                ) : (
                  currentInvoiceItems.map((item, index) => (
                    <tr key={item.rowId}>
                      <td className="col-seq">{index + 1}</td>
                      <td className="col-item" style={{ textAlign: 'right' }}>
                        <span style={{ fontWeight: 'bold' }}>{item.name}</span>
                      </td>
                      <td className="col-desc" style={{ textAlign: 'right', color: '#64748b' }}>
                        {item.spec || '-'}
                      </td>
                      <td className="col-qty">{item.qty}</td>
                      <td className="col-price">{item.price.toFixed(2)}</td>
                      <td className="col-total">{item.total.toFixed(2)}</td>
                      <td className="col-action">
                        <span className="invoice-item-actions">
                          <i
                            className="fa-solid fa-pen-to-square"
                            style={{ color: '#2563eb' }}
                            title="تعديل"
                            onClick={() => openModifyInvoiceItem(index)}
                          ></i>
                          <i
                            className="fa-solid fa-trash"
                            style={{ color: '#dc2626' }}
                            title="حذف"
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
        </div>

        {/* 6. Bottom Fixed Summary & Action Bar (طبق الأصل للصورة 2) */}
        <div className="bottom-fixed-area">
          <div className="summary-bar">
            <div className="summary-item">
              اجمالي العدد: <span id="lblItemsTotal">{totals.qtySum.toFixed(2)}</span>
            </div>
            <div className="summary-item">
              الخصومات: <span id="lblDiscTotal">{totals.discount.toFixed(2)}</span>
            </div>
            <div className="summary-item">
              الضرائب: <span id="lblTaxTotal">{totals.tax.toFixed(2)}</span>
            </div>
            <div className="summary-item">
              الإيراد: <span id="lblExtraTotal">{totals.extra.toFixed(2)}</span>
            </div>
            <div className="summary-item">
              المدفوع: <span id="lblPaidTotal" style={{ color: '#60a5fa' }}>{totals.paid.toFixed(2)}</span>
            </div>
            <div className="summary-item">
              المتبقي: <span id="lblRemainTotal" style={{ color: '#f87171' }}>{totals.remain.toFixed(2)}</span>
            </div>
            <div className="summary-item summary-net">
              اجمالي الصافي: <span id="lblNetTotal">{totals.net.toFixed(2)}</span>
            </div>
          </div>

          <div className="btn-action-bar">
            <button
              type="button"
              className="btn-action"
              style={{ background: '#16a34a', padding: '6px', fontSize: '9px' }}
              onClick={saveInvoice}
            >
              <i className="fa-solid fa-save ml-1"></i> حفظ وترحيل الحسابات
            </button>
            <button
              type="button"
              className="btn-action"
              style={{ background: '#2563eb', padding: '6px', fontSize: '9px' }}
              onClick={handlePrintCurrentInvoice}
            >
              <i className="fa-solid fa-print ml-1"></i> طباعة
            </button>
          </div>
        </div>
      </div>

      {/* ⚙️ نافذة الخيارات والمدفوعات (Options & Payments Modal) */}
      {isOptionsModalOpen && (
        <div className="modal-overlay" id="optionsModal">
          <div className="modal-box">
            <div className="modal-header">
              <span>
                <i className="fa-solid fa-sliders ml-1"></i> خصومات، ضرائب، إيرادات ودفع
              </span>
              <span style={{ cursor: 'pointer', fontSize: '18px' }} onClick={() => setIsOptionsModalOpen(false)}>
                &times;
              </span>
            </div>
            <div className="modal-body">
              {/* Discount */}
              <div className="field-inline" style={{ gap: '3px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '9px' }}>خصم الفاتورة الكلية</label>
                  <div className="big-toggle-group">
                    <button
                      type="button"
                      className={`big-toggle-btn ${invDiscType === 'val' ? 'active' : ''}`}
                      onClick={() => setInvDiscType('val')}
                    >
                      ج.م
                    </button>
                    <button
                      type="button"
                      className={`big-toggle-btn ${invDiscType === 'percent' ? 'active' : ''}`}
                      onClick={() => setInvDiscType('percent')}
                    >
                      %
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  value={globalInvDisc}
                  onChange={(e) => setGlobalInvDisc(e.target.value)}
                  placeholder="أدخل قيمة أو نسبة الخصم..."
                  style={{ height: '26px', fontSize: '10px' }}
                />
              </div>

              {/* Tax */}
              <div className="field-inline" style={{ gap: '3px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '9px' }}>ضريبة الفاتورة الكلية</label>
                  <div className="big-toggle-group">
                    <button
                      type="button"
                      className={`big-toggle-btn ${invTaxType === 'percent' ? 'active' : ''}`}
                      onClick={() => setInvTaxType('percent')}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      className={`big-toggle-btn ${invTaxType === 'val' ? 'active' : ''}`}
                      onClick={() => setInvTaxType('val')}
                    >
                      ج.م
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  value={globalInvTax}
                  onChange={(e) => setGlobalInvTax(e.target.value)}
                  placeholder="أدخل قيمة أو نسبة الضريبة..."
                  style={{ height: '26px', fontSize: '10px' }}
                />
              </div>

              {/* Extra Income */}
              <div className="edit-card-grid">
                <div className="field-inline">
                  <label style={{ fontSize: '9px' }}>اسم الإيراد الإضافي</label>
                  <input
                    type="text"
                    value={extraIncomeName}
                    onChange={(e) => setExtraIncomeName(e.target.value)}
                    style={{ height: '25px', fontSize: '9.5px' }}
                  />
                </div>
                <div className="field-inline">
                  <label style={{ fontSize: '9px' }}>مبلغ الإيراد</label>
                  <input
                    type="number"
                    value={extraIncomeVal}
                    onChange={(e) => setExtraIncomeVal(e.target.value)}
                    style={{ height: '25px', fontSize: '9.5px' }}
                  />
                </div>
              </div>

              {/* Multi-Payment Rows */}
              <div className="field-inline">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '9px' }}>طرق الدفع المتعددة</label>
                  <button
                    type="button"
                    style={{
                      padding: '2px 6px',
                      fontSize: '8.5px',
                      background: '#16a34a',
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
                  {paymentRows.map((r) => (
                    <div
                      key={r.id}
                      className="pay-row"
                      style={{ display: 'flex', gap: '4px', alignItems: 'center' }}
                    >
                      <select
                        value={r.method}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPaymentRows((prev) => prev.map((row) => (row.id === r.id ? { ...row, method: val } : row)));
                        }}
                        style={{ height: '24px', width: '95px', fontSize: '9px' }}
                      >
                        <option value="نقدي">نقدي</option>
                        <option value="انستاباي">انستاباي</option>
                        <option value="فودافون كاش">فودافون كاش</option>
                        <option value="فيزا">فيزا</option>
                        <option value="بنك">بنك</option>
                      </select>
                      <input
                        type="number"
                        value={r.amount || ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setPaymentRows((prev) => prev.map((row) => (row.id === r.id ? { ...row, amount: val } : row)));
                        }}
                        placeholder="المبلغ"
                        style={{ height: '24px', flex: 1, fontSize: '9.5px' }}
                      />
                      <i
                        className="fa-solid fa-circle-xmark"
                        style={{ color: '#dc2626', cursor: 'pointer', fontSize: '14px' }}
                        onClick={() => removePaymentRow(r.id)}
                      ></i>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="btn-action-top"
                style={{ background: '#16a34a', marginTop: '6px', padding: '6px', fontSize: '9.5px' }}
                onClick={() => setIsOptionsModalOpen(false)}
              >
                <i className="fa-solid fa-check ml-1"></i> تم وحفظ الخيارات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📇 كارت الصنف التفصيلي (التركيز التلقائي على الكمية وبدون أقواس حول الكود نهائياً) */}
      {isDetailCardOpen && cardItem && (
        <div className="modal-overlay" id="itemDetailCardModal">
          <div className="modal-box">
            <div className="modal-header">
              <span>
                <i className="fa-solid fa-pen-to-square ml-1"></i> كارت الصنف التفصيلي
              </span>
              <span style={{ cursor: 'pointer', fontSize: '18px' }} onClick={() => setIsDetailCardOpen(false)}>
                &times;
              </span>
            </div>
            <div className="modal-body">
              <input type="hidden" value={cardItem.code} />
              <div className="field-inline">
                <label>اسم الصنف:</label>
                <input
                  type="text"
                  readOnly
                  value={cardItem.name}
                  style={{ background: '#f1f5f9', fontWeight: 'bold', height: '24px', fontSize: '9.5px' }}
                />
              </div>
              <div className="edit-card-grid">
                <div className="field-inline">
                  <label>المتاح بالمخزن:</label>
                  <input
                    type="text"
                    readOnly
                    value={cardItem.stock}
                    style={{
                      background: '#e2e8f0',
                      fontWeight: 'bold',
                      color: '#2563eb',
                      textAlign: 'center',
                      height: '24px',
                      fontSize: '9.5px',
                    }}
                  />
                </div>
                <div className="field-inline">
                  <label>سعر الشراء:</label>
                  <input
                    type="text"
                    readOnly
                    value={`${Number(cardItem.buyPrice || 0).toFixed(2)} ج.م`}
                    style={{
                      background: '#e2e8f0',
                      fontWeight: 'bold',
                      color: '#dc2626',
                      textAlign: 'center',
                      height: '24px',
                      fontSize: '9.5px',
                    }}
                  />
                </div>
              </div>
              {/* أزرار التسعير السريعة داخل كارت الصنف */}
              <div style={{ display: 'flex', gap: '3px', margin: '2px 0 4px 0' }}>
                <button
                  type="button"
                  onClick={() => {
                    const p = getItemPriceForTier(cardItem, 'cash');
                    setCardPrice(p.toString());
                  }}
                  className="pricing-tier-btn"
                  style={{ flex: 1, padding: '3px', fontSize: '8px', fontWeight: 'bold', background: '#dcfce7', color: '#166534', border: '1px solid #86efac', borderRadius: '3px', cursor: 'pointer' }}
                >
                  نقدي ({getItemPriceForTier(cardItem, 'cash').toFixed(2)})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const p = getItemPriceForTier(cardItem, 'wholesale');
                    setCardPrice(p.toString());
                  }}
                  className="pricing-tier-btn"
                  style={{ flex: 1, padding: '3px', fontSize: '8px', fontWeight: 'bold', background: '#e0e7ff', color: '#3730a3', border: '1px solid #a5b4fc', borderRadius: '3px', cursor: 'pointer' }}
                >
                  جملة ({getItemPriceForTier(cardItem, 'wholesale').toFixed(2)})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const p = getItemPriceForTier(cardItem, 'buy');
                    setCardPrice(p.toString());
                  }}
                  className="pricing-tier-btn"
                  style={{ flex: 1, padding: '3px', fontSize: '8px', fontWeight: 'bold', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '3px', cursor: 'pointer' }}
                >
                  شراء ({getItemPriceForTier(cardItem, 'buy').toFixed(2)})
                </button>
              </div>

              <div className="edit-card-grid">
                <div className="field-inline">
                  <label>سعر الحركة:</label>
                  <input
                    type="number"
                    step="any"
                    value={cardPrice}
                    onChange={(e) => setCardPrice(e.target.value)}
                    style={{
                      fontWeight: 'bold',
                      color: '#16a34a',
                      textAlign: 'center',
                      height: '24px',
                      fontSize: '9.5px',
                    }}
                  />
                </div>
                <div className="field-inline">
                  <label>سعر الجملة الإضافي:</label>
                  <input
                    type="number"
                    readOnly
                    value={cardItem.wholesalePrice || 0}
                    style={{
                      background: '#e2e8f0',
                      fontWeight: 'bold',
                      color: '#d97706',
                      textAlign: 'center',
                      height: '24px',
                      fontSize: '9.5px',
                    }}
                  />
                </div>
              </div>
              <div className="edit-card-grid">
                <div className="field-inline">
                  <label>العدد المطلوب:</label>
                  {/* 🎯 التركيز التلقائي والتحديد على حقل العدد فور فتح الكارت ومفتاح Enter يضيف الصنف */}
                  <input
                    ref={cardQtyInputRef}
                    id="input-card-qty"
                    type="number"
                    min="0.01"
                    step="any"
                    value={cardQty}
                    onChange={(e) => setCardQty(e.target.value)}
                    style={{ textAlign: 'center', fontWeight: 'bold', height: '24px', fontSize: '9.5px' }}
                  />
                </div>
                <div className="field-inline">
                  <label>اجمالي صافي:</label>
                  <input
                    type="text"
                    readOnly
                    value={`${((parseFloat(cardQty) || 0) * (parseFloat(cardPrice) || 0)).toFixed(2)} ج.م`}
                    style={{
                      background: '#e2e8f0',
                      fontWeight: 'bold',
                      color: '#16a34a',
                      textAlign: 'center',
                      height: '24px',
                      fontSize: '9.5px',
                    }}
                  />
                </div>
              </div>
              <div className="field-inline">
                <label>الوصف / البيان / ملاحظات البند:</label>
                <input
                  type="text"
                  value={cardSpec}
                  onChange={(e) => setCardSpec(e.target.value)}
                  placeholder="ملاحظات..."
                  style={{ height: '24px', fontSize: '9.5px' }}
                />
              </div>
              <button
                type="button"
                className="btn-action-top"
                style={{ background: '#16a34a', marginTop: '6px', padding: '6px', fontSize: '9.5px' }}
                onClick={confirmAddDetailedItem}
              >
                <i className="fa-solid fa-check ml-1"></i> إضافة للفاتورة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📚 دليل الأصناف التفاعلي المتقدم (التنقل الهرمي الذكي) */}
      {isLookupModalOpen && (
        <div className="modal-overlay" id="lookupModal">
          <div className="lookup-modal-box">
            <div className="modal-header">
              <span>
                <i className="fa-solid fa-boxes-stacked ml-1"></i> إضافة صنف (التنقل الهرمي)
              </span>
              <span style={{ cursor: 'pointer', fontSize: '18px' }} onClick={() => setIsLookupModalOpen(false)}>
                &times;
              </span>
            </div>

            <div className="search-quick-bar">
              <input
                type="text"
                value={globalLookupSearch}
                onChange={(e) => {
                  const val = e.target.value;
                  setGlobalLookupSearch(val);
                  if (val.trim()) {
                    setHierarchyState((prev) => ({ ...prev, step: 'search' }));
                  } else {
                    setHierarchyState({ step: 'groups', selectedGroup: null, selectedCompany: null, selectedType: null });
                  }
                }}
                placeholder="بحث سريع بالاسم أو الكود في أي وقت..."
                style={{ height: '24px', flex: 1, fontSize: '9.5px' }}
              />
              <button
                type="button"
                className="hier-btn"
                onClick={openNewHierarchyModal}
                style={{ background: '#059669', color: '#fff', fontWeight: 'bold' }}
                title="إضافة مجموعة وبداخلها تصنيف وبداخلة نوع وبداخلة الصنف للتنقل الهرمي السريع"
              >
                <i className="fa-solid fa-sitemap ml-1"></i> + إضافة مجموعة وتصنيف ونوع وصنف
              </button>
              <button
                type="button"
                className="hier-btn success"
                onClick={openEditModalForNewItem}
              >
                <i className="fa-solid fa-plus ml-1"></i> صنف جديد
              </button>
            </div>

            <div className="hierarchy-nav-bar" id="hierarchyNavBar">
              <span id="hierPathTitle">
                {hierarchyState.step === 'search'
                  ? `نتائج البحث عن: "${globalLookupSearch}"`
                  : hierarchyState.step === 'companies'
                  ? `${hierarchyState.selectedGroup} > اختر الشركة:`
                  : hierarchyState.step === 'types'
                  ? `${hierarchyState.selectedGroup} > ${hierarchyState.selectedCompany} > اختر النوع:`
                  : hierarchyState.step === 'items'
                  ? `الأصناف التابعة لـ: ${hierarchyState.selectedType}`
                  : 'المجموعات الرئيسية'}
              </span>
              <div className="hierarchy-btns-group">
                <button
                  type="button"
                  className="hier-btn"
                  onClick={() => {
                    setHierarchyState({ step: 'groups', selectedGroup: null, selectedCompany: null, selectedType: null });
                    setGlobalLookupSearch('');
                  }}
                >
                  <i className="fa-solid fa-house ml-1"></i> الرئيسية
                </button>
                {hierarchyState.step !== 'groups' && (
                  <button
                    type="button"
                    className="hier-btn"
                    onClick={() => {
                      if (hierarchyState.step === 'companies' || hierarchyState.step === 'search') {
                        setHierarchyState({ step: 'groups', selectedGroup: null, selectedCompany: null, selectedType: null });
                      } else if (hierarchyState.step === 'types') {
                        setHierarchyState((prev) => ({ ...prev, step: 'companies', selectedType: null }));
                      } else if (hierarchyState.step === 'items') {
                        setHierarchyState((prev) => ({ ...prev, step: 'types' }));
                      }
                    }}
                  >
                    <i className="fa-solid fa-arrow-right ml-1"></i> رجوع
                  </button>
                )}
              </div>
            </div>

            <div className="hierarchy-content-area" id="hierarchyContentArea">
              {/* Step 1: Search results */}
              {hierarchyState.step === 'search' && (
                (() => {
                  const q = globalLookupSearch.trim().toLowerCase();
                  const results = localItemsDatabase.filter(
                    (i) => i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q)
                  );
                  if (results.length === 0) {
                    return (
                      <div style={{ textAlign: 'center', padding: '25px', color: '#94a3b8', fontSize: '9.5px' }}>
                        لا توجد أصناف مطابقة للبحث
                      </div>
                    );
                  }
                  return results.map((item) => (
                    <div
                      key={item.code}
                      className="hierarchy-card-item"
                      style={{ flexDirection: 'column', alignItems: 'stretch', gap: '4px' }}
                      onClick={() => openItemDetailCard(item)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '10px', color: '#1e293b' }}>
                        <span>{item.name}</span>
                        {/* ⚠️ كود بدون أي أقواس نهائياً */}
                        <span style={{ color: '#2563eb', fontSize: '8.5px' }}>كود: {item.code}</span>
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(4, 1fr)',
                          gap: '2px',
                          fontSize: '8px',
                          textAlign: 'center',
                          background: '#f1f5f9',
                          padding: '4px',
                          borderRadius: '3px',
                          fontWeight: 'normal',
                        }}
                      >
                        <div>المخزون: <strong style={{ color: '#2563eb' }}>{item.stock}</strong></div>
                        <div>شراء: <strong style={{ color: '#dc2626' }}>{Number(item.buyPrice || 0).toFixed(2)}</strong></div>
                        <div>قطاعي: <strong style={{ color: '#16a34a' }}>{Number(item.cashPrice || 0).toFixed(2)}</strong></div>
                        <div>جملة: <strong style={{ color: '#d97706' }}>{Number(item.wholesalePrice || 0).toFixed(2)}</strong></div>
                      </div>
                    </div>
                  ));
                })()
              )}

              {/* Step 2: Groups */}
              {hierarchyState.step === 'groups' && (
                (() => {
                  const groups = [...new Set(localItemsDatabase.map((i) => i.group))];
                  return groups.map((g) => (
                    <div
                      key={g}
                      className="hierarchy-card-item"
                      onClick={() => setHierarchyState({ step: 'companies', selectedGroup: g, selectedCompany: null, selectedType: null })}
                    >
                      <span>
                        <i className="fa-solid fa-folder ml-1" style={{ color: '#2563eb' }}></i> {g}
                      </span>
                      <i className="fa-solid fa-chevron-left" style={{ fontSize: '9px', color: '#64748b' }}></i>
                    </div>
                  ));
                })()
              )}

              {/* Step 3: Companies */}
              {hierarchyState.step === 'companies' && (
                (() => {
                  const comps = [
                    ...new Set(
                      localItemsDatabase.filter((i) => i.group === hierarchyState.selectedGroup).map((i) => i.company)
                    ),
                  ];
                  return comps.map((c) => (
                    <div
                      key={c}
                      className="hierarchy-card-item"
                      onClick={() => setHierarchyState((prev) => ({ ...prev, step: 'types', selectedCompany: c }))}
                    >
                      <span>
                        <i className="fa-solid fa-building ml-1" style={{ color: '#d97706' }}></i> {c}
                      </span>
                      <i className="fa-solid fa-chevron-left" style={{ fontSize: '9px', color: '#64748b' }}></i>
                    </div>
                  ));
                })()
              )}

              {/* Step 4: Types */}
              {hierarchyState.step === 'types' && (
                (() => {
                  const types = [
                    ...new Set(
                      localItemsDatabase
                        .filter((i) => i.group === hierarchyState.selectedGroup && i.company === hierarchyState.selectedCompany)
                        .map((i) => i.typeName)
                    ),
                  ];
                  return types.map((t) => (
                    <div
                      key={t}
                      className="hierarchy-card-item"
                      onClick={() => setHierarchyState((prev) => ({ ...prev, step: 'items', selectedType: t }))}
                    >
                      <span>
                        <i className="fa-solid fa-tag ml-1" style={{ color: '#16a34a' }}></i> {t}
                      </span>
                      <i className="fa-solid fa-chevron-left" style={{ fontSize: '9px', color: '#64748b' }}></i>
                    </div>
                  ));
                })()
              )}

              {/* Step 5: Items list under type */}
              {hierarchyState.step === 'items' && (
                (() => {
                  const items = localItemsDatabase.filter(
                    (i) =>
                      i.group === hierarchyState.selectedGroup &&
                      i.company === hierarchyState.selectedCompany &&
                      i.typeName === hierarchyState.selectedType
                  );
                  if (items.length === 0) {
                    return (
                      <div style={{ textAlign: 'center', padding: '25px', color: '#94a3b8', fontSize: '9.5px' }}>
                        لا توجد أصناف في هذا النوع
                      </div>
                    );
                  }
                  return items.map((item) => (
                    <div
                      key={item.code}
                      className="hierarchy-card-item"
                      style={{ flexDirection: 'column', alignItems: 'stretch', gap: '4px' }}
                      onClick={() => openItemDetailCard(item)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '10px', color: '#1e293b' }}>
                        <span>{item.name}</span>
                        {/* ⚠️ كود بدون أقواس */}
                        <span style={{ color: '#2563eb', fontSize: '8.5px' }}>كود: {item.code}</span>
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(4, 1fr)',
                          gap: '2px',
                          fontSize: '8px',
                          textAlign: 'center',
                          background: '#f1f5f9',
                          padding: '4px',
                          borderRadius: '3px',
                          fontWeight: 'normal',
                        }}
                      >
                        <div>المخزون: <strong style={{ color: '#2563eb' }}>{item.stock}</strong></div>
                        <div>شراء: <strong style={{ color: '#dc2626' }}>{Number(item.buyPrice || 0).toFixed(2)}</strong></div>
                        <div>قطاعي: <strong style={{ color: '#16a34a' }}>{Number(item.cashPrice || 0).toFixed(2)}</strong></div>
                        <div>جملة: <strong style={{ color: '#d97706' }}>{Number(item.wholesalePrice || 0).toFixed(2)}</strong></div>
                      </div>
                    </div>
                  ));
                })()
              )}
            </div>
          </div>
        </div>
      )}

      {/* ➕ نافذة إضافة صنف جديد للمخزون (New Item Modal) */}
      {isNewItemModalOpen && (
        <div className="modal-overlay" id="editItemModal">
          <div className="modal-box">
            <div className="modal-header">
              <span>إضافة صنف جديد للمخزون</span>
              <span style={{ cursor: 'pointer', fontSize: '18px' }} onClick={() => setIsNewItemModalOpen(false)}>
                &times;
              </span>
            </div>
            <div className="modal-body">
              <div className="edit-card-grid">
                <div className="field-inline span-2">
                  <label>اسم الصنف</label>
                  <input
                    type="text"
                    value={newInputItemName}
                    onChange={(e) => setNewInputItemName(e.target.value)}
                    style={{ height: '24px', fontSize: '9.5px' }}
                  />
                </div>
                <div className="field-inline span-2">
                  <label>الكود الفريد</label>
                  {/* ⚠️ كود الصنف بدون أقواس */}
                  <input
                    type="text"
                    readOnly
                    value={newInputItemCode}
                    style={{ background: '#f1f5f9', fontWeight: 'bold', height: '24px', fontSize: '9.5px' }}
                  />
                </div>
                <div className="field-inline">
                  <label>سعر الشراء</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={editBuyPrice}
                    onChange={(e) => setEditBuyPrice(e.target.value)}
                    style={{ height: '24px', fontSize: '9.5px' }}
                  />
                </div>
                <div className="field-inline">
                  <label>المجموعة</label>
                  <select
                    value={editItemCategory}
                    onChange={(e) => setEditItemCategory(e.target.value)}
                    style={{ height: '24px', fontSize: '9.5px' }}
                  >
                    {[...new Set(localItemsDatabase.map((i) => i.group))].map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field-inline">
                  <label>سعر القطاعي</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={editCashPriceManual}
                    onChange={(e) => setEditCashPriceManual(e.target.value)}
                    style={{ height: '24px', fontSize: '9.5px' }}
                  />
                </div>
                <div className="field-inline">
                  <label>سعر الجملة</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={editWholesalePriceManual}
                    onChange={(e) => setEditWholesalePriceManual(e.target.value)}
                    style={{ height: '24px', fontSize: '9.5px' }}
                  />
                </div>
                <div className="field-inline span-2">
                  <label>العدد بالمخزون</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={editQty}
                    onChange={(e) => setEditQty(e.target.value)}
                    style={{ height: '24px', fontSize: '9.5px' }}
                  />
                </div>
              </div>
              <button
                type="button"
                className="btn-action-top"
                style={{ background: '#16a34a', marginTop: '4px', padding: '6px', fontSize: '9.5px' }}
                onClick={saveNewItemData}
              >
                <i className="fa-solid fa-check ml-1"></i> حفظ الصنف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌳 نافذة إضافة هيكل شجري متكامل (مجموعة > تصنيف/شركة > نوع > صنف) */}
      {isNewHierarchyModalOpen && (
        <div className="modal-overlay" id="newHierarchyModal">
          <div className="modal-box" style={{ maxWidth: '360px' }}>
            <div className="modal-header" style={{ background: '#ffffff', color: '#0f172a', borderBottom: '1.5px solid #e2e8f0' }}>
              <span style={{ fontWeight: 800 }}>
                <i className="fa-solid fa-sitemap ml-1" style={{ color: '#059669' }}></i> إضافة شجرة صنف (مجموعة &gt; تصنيف &gt; نوع &gt; صنف)
              </span>
              <span style={{ cursor: 'pointer', fontSize: '18px', color: '#64748b' }} onClick={() => setIsNewHierarchyModalOpen(false)}>
                &times;
              </span>
            </div>
            <div className="modal-body">
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '5px 7px', marginBottom: '4px', fontSize: '8.5px', color: '#334155', lineHeight: 1.4 }}>
                💡 اكتب اسم المجموعة والتصنيف والنوع والصنف النهائي ليتم تثبيته فوراً كفرع نشط في شجرة الفاتورة والمخزون.
              </div>

              <div className="edit-card-grid">
                {/* 1. المجموعة */}
                <div className="field-inline span-2">
                  <label style={{ color: '#0f766e', fontWeight: 'bold' }}>1. المجموعة الرئيسية</label>
                  <input
                    type="text"
                    value={hierGroup}
                    onChange={(e) => setHierGroup(e.target.value)}
                    placeholder="اكتب اسم المجموعة الرئيسية..."
                    style={{ height: '24px', fontSize: '9.5px', fontWeight: 'bold' }}
                  />
                </div>

                {/* 2. التصنيف / الشركة */}
                <div className="field-inline span-2">
                  <label style={{ color: '#0369a1', fontWeight: 'bold' }}>2. التصنيف / الشركة / الماركة</label>
                  <input
                    type="text"
                    value={hierCompany}
                    onChange={(e) => setHierCompany(e.target.value)}
                    placeholder="اكتب اسم التصنيف أو الشركة..."
                    style={{ height: '24px', fontSize: '9.5px', fontWeight: 'bold' }}
                  />
                </div>

                {/* 3. النوع / القسم الفرعي */}
                <div className="field-inline span-2">
                  <label style={{ color: '#6d28d9', fontWeight: 'bold' }}>3. النوع / القسم الفرعي</label>
                  <input
                    type="text"
                    value={hierType}
                    onChange={(e) => setHierType(e.target.value)}
                    placeholder="اكتب اسم النوع أو القسم الفرعي..."
                    style={{ height: '24px', fontSize: '9.5px', fontWeight: 'bold' }}
                  />
                </div>

                {/* 4. اسم الصنف */}
                <div className="field-inline span-2">
                  <label style={{ color: '#1e293b', fontWeight: 'bold' }}>4. اسم الصنف النهائي</label>
                  <input
                    type="text"
                    value={hierItemName}
                    onChange={(e) => setHierItemName(e.target.value)}
                    placeholder="اكتب اسم الصنف النهائي..."
                    style={{ height: '24px', fontSize: '9.5px', fontWeight: 'bold', border: '1.5px solid #2563eb' }}
                  />
                </div>

                {/* كود الصنف */}
                <div className="field-inline">
                  <label>كود الصنف</label>
                  <input
                    type="text"
                    value={hierItemCode}
                    onChange={(e) => setHierItemCode(e.target.value)}
                    placeholder="كود..."
                    style={{ height: '24px', fontSize: '9px', textAlign: 'center' }}
                  />
                </div>

                {/* العدد بالمخزن */}
                <div className="field-inline">
                  <label>العدد بالمخزن</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={hierStock}
                    onChange={(e) => setHierStock(e.target.value)}
                    placeholder="0"
                    style={{ height: '24px', fontSize: '9.5px', textAlign: 'center' }}
                  />
                </div>

                {/* سعر الشراء */}
                <div className="field-inline">
                  <label>سعر الشراء (التكلفة)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={hierBuyPrice}
                    onChange={(e) => setHierBuyPrice(e.target.value)}
                    placeholder="0.00"
                    style={{ height: '24px', fontSize: '9.5px', textAlign: 'center' }}
                  />
                </div>

                {/* سعر البيع النقدي */}
                <div className="field-inline">
                  <label>سعر القطاعي (نقدي)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={hierCashPrice}
                    onChange={(e) => setHierCashPrice(e.target.value)}
                    placeholder="0.00"
                    style={{ height: '24px', fontSize: '9.5px', textAlign: 'center' }}
                  />
                </div>

                {/* سعر الجملة */}
                <div className="field-inline span-2">
                  <label>سعر بيع الجملة</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={hierWholesalePrice}
                    onChange={(e) => setHierWholesalePrice(e.target.value)}
                    placeholder="0.00"
                    style={{ height: '24px', fontSize: '9.5px', textAlign: 'center' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="btn-action-top"
                  style={{ background: '#059669', flex: 1, padding: '7px', fontSize: '10px' }}
                  onClick={saveNewHierarchyModal}
                >
                  <i className="fa-solid fa-check ml-1"></i> حفظ وتثبيت في الشجرة
                </button>
                <button
                  type="button"
                  className="btn-action-top btn-action-alt"
                  style={{ width: '60px', padding: '7px', fontSize: '9.5px' }}
                  onClick={() => setIsNewHierarchyModalOpen(false)}
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✏️ نافذة تعديل بند في الفاتورة (Modify Invoice Item Modal) */}
      {isModifyModalOpen && (
        <div className="modal-overlay" id="modifyInvoiceItemModal">
          <div className="modal-box">
            <div className="modal-header">
              <span>
                <i className="fa-solid fa-pen-to-square ml-1"></i> تعديل صنف في الفاتورة
              </span>
              <span style={{ cursor: 'pointer', fontSize: '18px' }} onClick={() => setIsModifyModalOpen(false)}>
                &times;
              </span>
            </div>
            <div className="modal-body">
              <input type="hidden" value={modifyItemIndex} />
              <div className="field-inline">
                <label>اسم الصنف</label>
                <input
                  type="text"
                  readOnly
                  value={modifyItemName}
                  style={{ background: '#f1f5f9', height: '24px', fontSize: '9.5px' }}
                />
              </div>
              <div className="edit-card-grid">
                <div className="field-inline">
                  <label>العدد</label>
                  <input
                    ref={modifyQtyInputRef}
                    type="number"
                    min="0.01"
                    step="any"
                    value={modifyItemQty}
                    onChange={(e) => setModifyItemQty(e.target.value)}
                    style={{ height: '24px', fontSize: '9.5px' }}
                  />
                </div>
                <div className="field-inline">
                  <label>سعر</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={modifyItemPrice}
                    onChange={(e) => setModifyItemPrice(e.target.value)}
                    style={{ height: '24px', fontSize: '9.5px' }}
                  />
                </div>
              </div>
              <div className="field-inline span-2">
                <label>الوصف / البيان</label>
                <input
                  type="text"
                  value={modifyItemSpec}
                  onChange={(e) => setModifyItemSpec(e.target.value)}
                  placeholder="اختياري..."
                  style={{ height: '24px', fontSize: '9.5px' }}
                />
              </div>
              <button
                type="button"
                className="btn-action-top"
                style={{ background: '#16a34a', marginTop: '6px', padding: '6px', fontSize: '9.5px' }}
                onClick={saveModifiedInvoiceItem}
              >
                <i className="fa-solid fa-check ml-1"></i> حفظ التعديل
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
