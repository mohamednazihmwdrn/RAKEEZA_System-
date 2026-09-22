import React, { useState, useMemo, useEffect } from 'react';
import { AppData, Item, Quotation, InvoiceItem, TenantCompany } from '../types';
import { addAuditLog } from '../utils/storage';
import { printWebOrderReceipt } from '../utils/printOrderReceipt';
import { playOrderAlertChime } from '../utils/audioChime';
import { DEFAULT_COMPANIES } from '../utils/multiTenantService';

interface CustomerCatalogViewProps {
  appData: AppData;
  onUpdateData: (newData: AppData) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onExitToAdmin?: () => void;
  onShareCatalog?: () => void;
  merchantCompanyId?: string;
  isPublicCustomerView?: boolean;
}

interface CartItem {
  item: Item;
  qty: number;
  price: number;
  selectedMaterial?: string;
}

export const CustomerCatalogView: React.FC<CustomerCatalogViewProps> = ({
  appData,
  onUpdateData,
  showToast,
  onExitToAdmin,
  onShareCatalog,
  merchantCompanyId,
  isPublicCustomerView,
}) => {
  // 1. Resolve Available Companies
  const companies = useMemo(() => {
    return appData.companies && appData.companies.length > 0 ? appData.companies : DEFAULT_COMPANIES;
  }, [appData.companies]);

  // 2. Multi-Tenant URL parameter checking (?company=RKZ-001 or ?company=COMP-000001)
  const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const companyParam = urlParams.get('company') || urlParams.get('tenant');

  // Match requested company strictly
  const matchedCompany = useMemo(() => {
    if (!companyParam) return null;
    const clean = companyParam.trim().toLowerCase();
    return (
      companies.find(
        (c) =>
          c.id.toLowerCase() === clean ||
          c.code?.toLowerCase() === clean ||
          c.tenantId?.toLowerCase() === clean
      ) || null
    );
  }, [companies, companyParam]);

  // Security guard: If a specific company code was requested in URL but doesn't exist
  const isInvalidCompanyRequested = Boolean(companyParam && !matchedCompany);

  // Strict Merchant Store vs. Unified Marketplace logic:
  // If merchantCompanyId is provided OR user came from ERP admin OR specific company link was visited:
  // This is strictly that merchant's private store. NO other merchants are shown!
  const isMerchantStoreView = Boolean(
    merchantCompanyId || (!isPublicCustomerView && onExitToAdmin) || (companyParam && matchedCompany)
  );

  const initialCompanyId = useMemo(() => {
    if (merchantCompanyId) return merchantCompanyId;
    if (matchedCompany) return matchedCompany.id;
    if (!isPublicCustomerView && (appData.companyId || onExitToAdmin)) {
      return appData.companyId || 'COMP-000001';
    }
    return 'all'; // Default to unified marketplace for public customer browsing
  }, [merchantCompanyId, matchedCompany, isPublicCustomerView, appData.companyId, onExitToAdmin]);

  const [selectedVendorCompanyId, setSelectedVendorCompanyId] = useState<string>(initialCompanyId);

  // In merchant mode, unified marketplace is NEVER true. In public view, it is true when 'all' is active.
  const isUnifiedMarketplace = !isMerchantStoreView && selectedVendorCompanyId === 'all';

  // Active Company Context
  const activeCompany = useMemo(() => {
    const targetId =
      merchantCompanyId ||
      (selectedVendorCompanyId !== 'all' ? selectedVendorCompanyId : null) ||
      matchedCompany?.id ||
      appData.companyId;

    if (targetId) {
      const found = companies.find((c) => c.id === targetId || c.code === targetId);
      if (found) return found;
    }
    return (
      companies[0] ||
      ({
        id: 'COMP-000001',
        code: 'RKZ-001',
        name: appData.settings.companyName || 'شركة ركيزة للمحاسبة والتجارة RAKEEZA',
        phone: appData.settings.phone1 || '01029190615',
        status: 'active',
      } as TenantCompany)
    );
  }, [merchantCompanyId, selectedVendorCompanyId, matchedCompany, appData.companyId, companies, appData.settings]);

  // Check store activation status (1000 EGP subscription)
  const isCompanyStoreActive = (comp: typeof companies[0] | undefined | null): boolean => {
    if (!comp) return false;
    if (comp.id === 'COMP-000001' || comp.code === 'RKZ-001') return true;
    if (comp.storeSubscriptionStatus === 'active' || comp.storeSubscriptionStatus === 'trial') return true;
    if (comp.isMarketplacePublished) return true;
    return false;
  };

  // Helper to get vendor company for any product with strict multi-tenant resolution
  const getVendorForItem = (item: Item): typeof companies[0] => {
    if (item.companyId) {
      const found = companies.find(
        (c) => c.id === item.companyId || c.code === item.companyId || c.tenantId === item.companyId
      );
      if (found) return found;
    }
    if (merchantCompanyId) {
      const found = companies.find((c) => c.id === merchantCompanyId || c.code === merchantCompanyId);
      if (found) return found;
    }
    if (!isUnifiedMarketplace && activeCompany && activeCompany.id !== 'all') {
      return activeCompany;
    }
    return companies[0] || activeCompany;
  };

  // Product counts per company
  const companyItemCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (appData.items || []).forEach((it) => {
      if (it.showInCatalog !== false) {
        const vendor = getVendorForItem(it);
        const cId = vendor.id || 'COMP-000001';
        counts[cId] = (counts[cId] || 0) + 1;
      }
    });
    return counts;
  }, [appData.items, companies, activeCompany, merchantCompanyId, isUnifiedMarketplace]);

  // Catalog Configuration: Unified Marketplace vs. Single Company Store
  const config = useMemo(() => {
    if (isUnifiedMarketplace) {
      return {
        enabled: true,
        storeName: 'السوق الإلكتروني الموحد | Market Hub',
        storeDescription: 'المنصة التجارية الموحدة لجميع الشركات والتجار المعتمدين - مثل أمازون، تصفح واطلب وتصل الفاتورة للتاجر مباشرة',
        contactPhone: appData.settings.phone1 || '01029190615',
        whatsappNumber: '01029190615',
        allowOnlineOrders: true,
        priceDisplayMode: 'both' as const,
        showStockStatus: true,
        showExactStockQty: false,
        bannerMessage: '🛒 مرحباً بكم في السوق الإلكتروني الموحد! تصفح معروضات مختلف التجار والشركات، وتصل كل طلبية وفاتورة لحساب التاجر الخاص في المنظومة.',
        currencySymbol: appData.settings.currencySymbol || 'ج.م',
        autoPrintOrders: true,
        soundAlertEnabled: true,
      };
    }

    const tenantSpecific = appData.companyCatalogConfigs?.[activeCompany.id];
    const companyDirect = activeCompany.catalogConfig;
    const fallback = appData.catalogConfig;

    return {
      enabled: true,
      storeName:
        tenantSpecific?.storeName ||
        companyDirect?.storeName ||
        activeCompany.tradeName ||
        activeCompany.name ||
        appData.settings.companyName,
      storeDescription:
        tenantSpecific?.storeDescription ||
        companyDirect?.storeDescription ||
        `المتجر والكتالوج الإلكتروني لشركة ${activeCompany.name} - طلب مباشر فوري`,
      contactPhone:
        tenantSpecific?.contactPhone ||
        companyDirect?.contactPhone ||
        activeCompany.phone ||
        appData.settings.phone1 ||
        '01029190615',
      whatsappNumber:
        tenantSpecific?.whatsappNumber ||
        companyDirect?.whatsappNumber ||
        activeCompany.whatsapp ||
        activeCompany.phone ||
        appData.settings.phone1 ||
        '01029190615',
      allowOnlineOrders:
        tenantSpecific?.allowOnlineOrders ??
        companyDirect?.allowOnlineOrders ??
        fallback?.allowOnlineOrders ??
        true,
      priceDisplayMode:
        tenantSpecific?.priceDisplayMode ||
        companyDirect?.priceDisplayMode ||
        fallback?.priceDisplayMode ||
        'both',
      showStockStatus:
        tenantSpecific?.showStockStatus ??
        companyDirect?.showStockStatus ??
        fallback?.showStockStatus ??
        true,
      showExactStockQty:
        tenantSpecific?.showExactStockQty ??
        companyDirect?.showExactStockQty ??
        fallback?.showExactStockQty ??
        false,
      bannerMessage:
        tenantSpecific?.bannerMessage ||
        companyDirect?.bannerMessage ||
        fallback?.bannerMessage ||
        '',
      currencySymbol:
        tenantSpecific?.currencySymbol ||
        companyDirect?.currencySymbol ||
        appData.settings.currencySymbol ||
        'ج.م',
      autoPrintOrders:
        tenantSpecific?.autoPrintOrders ??
        companyDirect?.autoPrintOrders ??
        fallback?.autoPrintOrders ??
        true,
      soundAlertEnabled:
        tenantSpecific?.soundAlertEnabled ??
        companyDirect?.soundAlertEnabled ??
        fallback?.soundAlertEnabled ??
        true,
    };
  }, [isUnifiedMarketplace, appData.companyCatalogConfigs, activeCompany, appData.catalogConfig, appData.settings]);

  const storeName = config.storeName;
  const contactPhone = config.contactPhone;
  const whatsappNumber = config.whatsappNumber;
  const currency = config.currencySymbol;

  // Set browser document title to this company's store name
  useEffect(() => {
    if (typeof document !== 'undefined' && storeName) {
      document.title = `${storeName} | المتجر الإلكتروني المباشر`;
    }
  }, [storeName]);

  // State
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [sortBy, setSortBy] = useState<'default' | 'price_asc' | 'price_desc' | 'name'>('default');
  const [activePriceMode, setActivePriceMode] = useState<'retail' | 'wholesale'>(
    config.priceDisplayMode === 'wholesale_only' ? 'wholesale' : 'retail'
  );

  // Cart State
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Order Submission Form State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Submitted Order State
  const [confirmedOrder, setConfirmedOrder] = useState<{
    orderId: number;
    orderReference: string;
    items: CartItem[];
    total: number;
    customerName: string;
    customerPhone: string;
    deliveryAddress: string;
    orderNotes: string;
    date: string;
    createdOrders?: Array<{
      orderId: number;
      orderReference: string;
      companyId: string;
      companyName: string;
      companyPhone: string;
      companyWhatsapp: string;
      itemsCount: number;
      total: number;
    }>;
  } | null>(null);

  // Products available based on mode (Unified Marketplace vs. Isolated Company Store)
  const companyItems = useMemo(() => {
    if (isUnifiedMarketplace) {
      // In unified marketplace, display all catalog-enabled items from all companies!
      return (appData.items || []).filter((it) => it.showInCatalog !== false);
    }
    // In isolated single-company mode, display strictly that company's items:
    const targetCompId = merchantCompanyId || activeCompany.id;
    return (appData.items || []).filter((it) => {
      if (it.companyId) {
        return it.companyId === targetCompId;
      }
      return targetCompId === companies[0]?.id || targetCompId === 'COMP-000001';
    });
  }, [isUnifiedMarketplace, appData.items, merchantCompanyId, activeCompany, companies]);

  // Available Materials (dynamically gathered from items + standard textiles/materials)
  const availableMaterials = useMemo(() => {
    const set = new Set<string>();
    companyItems.forEach((it) => {
      if (it.material && it.material.trim()) {
        it.material.split(/[,،]/).forEach((m) => {
          const clean = m.trim();
          if (clean) set.add(clean);
        });
      }
    });
    // Standard baseline materials
    ['قطن مصري 100%', 'كتان فاخر', 'صوف طبيعي', 'حرير', 'جلد طبيعي', 'خشب طبيعي', 'حديد ومعادن', 'بوليستر'].forEach((m) =>
      set.add(m)
    );
    return ['all', ...Array.from(set)];
  }, [companyItems]);

  // Filters State
  const [selectedMaterialFilter, setSelectedMaterialFilter] = useState<string>('all');
  const [selectedMerchantFilter, setSelectedMerchantFilter] = useState<string>('all');

  // Direct Order Modal State (for sending invoice directly to chosen vendor via WhatsApp)
  const [directOrderModalItem, setDirectOrderModalItem] = useState<Item | null>(null);
  const [directOrderQty, setDirectOrderQty] = useState(1);
  const [directOrderSelectedMaterial, setDirectOrderSelectedMaterial] = useState('');
  const [directOrderClientName, setDirectOrderClientName] = useState('');
  const [directOrderClientPhone, setDirectOrderClientPhone] = useState('');
  const [directOrderAddress, setDirectOrderAddress] = useState('');
  const [directOrderNotes, setDirectOrderNotes] = useState('');
  const [isSubmittingDirectOrder, setIsSubmittingDirectOrder] = useState(false);

  // STRICT ISOLATION: Categories derived ONLY from current displayed items!
  const categories = useMemo(() => {
    const set = new Set<string>();
    companyItems.forEach((it) => {
      if (it.category && it.category.trim() && it.showInCatalog !== false) {
        set.add(it.category.trim());
      }
    });
    return ['all', ...Array.from(set)];
  }, [companyItems]);

  // Filtered Items for Display
  const filteredItems = useMemo(() => {
    // Only show items enabled for catalog belonging strictly to this scope
    let result = companyItems.filter((it) => it.showInCatalog !== false);

    // Category filter
    if (selectedCategory !== 'all') {
      result = result.filter((it) => it.category?.trim() === selectedCategory);
    }

    // Material filter
    if (selectedMaterialFilter !== 'all') {
      const qMat = selectedMaterialFilter.toLowerCase();
      result = result.filter((it) => {
        const mat = (it.material || it.unit || it.description || '').toLowerCase();
        return mat.includes(qMat);
      });
    }

    // Merchant filter (in Unified Marketplace only)
    if (isUnifiedMarketplace && selectedMerchantFilter !== 'all') {
      result = result.filter((it) => {
        const vendor = getVendorForItem(it);
        return vendor.id === selectedMerchantFilter;
      });
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (it) =>
          it.name?.toLowerCase().includes(q) ||
          it.code?.toLowerCase().includes(q) ||
          it.barcode?.toLowerCase().includes(q) ||
          it.category?.toLowerCase().includes(q) ||
          it.description?.toLowerCase().includes(q) ||
          it.catalogDescription?.toLowerCase().includes(q) ||
          it.catalogBadge?.toLowerCase().includes(q) ||
          (it.material && it.material.toLowerCase().includes(q))
      );
    }

    // Stock filter
    if (onlyInStock) {
      result = result.filter((it) => (it.quantity || 0) > 0);
    }

    // Helper for effective price
    const getEffectivePrice = (it: Item) => {
      if (activePriceMode === 'wholesale') {
        return it.catalogWholesalePrice && it.catalogWholesalePrice > 0
          ? it.catalogWholesalePrice
          : it.wholesalePrice || it.catalogPrice || it.salePrice || 0;
      }
      if (it.catalogDiscountPrice && it.catalogDiscountPrice > 0) {
        return it.catalogDiscountPrice;
      }
      return it.catalogPrice !== undefined && it.catalogPrice > 0 ? it.catalogPrice : it.salePrice || 0;
    };

    // Sorting
    if (sortBy === 'price_asc') {
      result.sort((a, b) => getEffectivePrice(a) - getEffectivePrice(b));
    } else if (sortBy === 'price_desc') {
      result.sort((a, b) => getEffectivePrice(b) - getEffectivePrice(a));
    } else if (sortBy === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    } else {
      // Default: featured items first!
      result.sort((a, b) => (b.catalogFeatured ? 1 : 0) - (a.catalogFeatured ? 1 : 0));
    }

    return result;
  }, [
    companyItems,
    selectedCategory,
    selectedMaterialFilter,
    selectedMerchantFilter,
    isUnifiedMarketplace,
    searchQuery,
    onlyInStock,
    sortBy,
    activePriceMode,
  ]);

  // Open Direct Order Modal with prefilled material
  const handleOpenDirectOrderModal = (item: Item) => {
    setDirectOrderModalItem(item);
    setDirectOrderQty(1);
    setDirectOrderSelectedMaterial(item.material || 'قطن مصري 100%');
    setDirectOrderClientName(customerName || '');
    setDirectOrderClientPhone(customerPhone || '');
    setDirectOrderAddress(deliveryAddress || '');
    setDirectOrderNotes('');
  };

  // Submit Direct Order: Creates invoice for specific vendor and dispatches WhatsApp
  const handleSubmitDirectOrder = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!directOrderModalItem) return;

    if (!directOrderClientName.trim()) {
      showToast('يرجى إدخال اسم العميل للتواصل', 'warning');
      return;
    }
    if (!directOrderClientPhone.trim()) {
      showToast('يرجى إدخال رقم الهاتف أو الواتساب', 'warning');
      return;
    }

    setIsSubmittingDirectOrder(true);

    try {
      const item = directOrderModalItem;
      const vendor = getVendorForItem(item);
      const targetCompanyId = vendor.id || 'COMP-000001';

      const effectivePrice =
        item.catalogDiscountPrice && item.catalogDiscountPrice > 0
          ? item.catalogDiscountPrice
          : item.catalogPrice !== undefined && item.catalogPrice > 0
          ? item.catalogPrice
          : item.salePrice || 0;

      const total = directOrderQty * effectivePrice;
      const nextId = appData.nextQuoteId || (appData.quotations?.length || 0) + 1;
      const orderRef = `ORD-${new Date().getFullYear()}-${String(nextId).padStart(4, '0')}`;
      const today = new Date().toISOString().split('T')[0];
      const nowTime = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

      // Multi-Tenant Order Document strictly bound to this merchant's companyId
      const newOrderDoc: Quotation = {
        id: nextId,
        type: 'sale_quote',
        status: 'online_order',
        source: 'online_catalog',
        orderReference: orderRef,
        clientName: directOrderClientName.trim(),
        phone: directOrderClientPhone.trim(),
        customerAddress: directOrderAddress.trim() || undefined,
        deliveryNotes: directOrderNotes.trim() || undefined,
        notes: `طلب أونلاين مباشر لشركة [${vendor.tradeName || vendor.name}]. الخامة المختارة: ${directOrderSelectedMaterial}. ${
          directOrderAddress ? `العنوان: ${directOrderAddress}. ` : ''
        }${directOrderNotes ? `ملاحظات: ${directOrderNotes}` : ''}`,
        date: today,
        time: nowTime,
        items: [
          {
            itemId: item.id,
            name: `${item.name} (${directOrderSelectedMaterial})`,
            qty: directOrderQty,
            price: effectivePrice,
            total,
            notes: `الخامة: ${directOrderSelectedMaterial}`,
          },
        ],
        subtotal: total,
        discount: 0,
        tax: 0,
        total,
        createdBy: `العميل (المتجر الإلكتروني - ${vendor.tradeName || vendor.name})`,
        companyId: targetCompanyId,
        orderStatus: 'new',
        autoPrinted: Boolean(config.autoPrintOrders),
      };

      const updatedQuotations = [newOrderDoc, ...(appData.quotations || [])];
      let updatedData = {
        ...appData,
        quotations: updatedQuotations,
        nextQuoteId: nextId + 1,
      };

      updatedData = addAuditLog(
        updatedData,
        'create',
        'المتجر الإلكتروني',
        `استلام طلب مباشر #${orderRef} لشركة (${vendor.tradeName || vendor.name}) للصنف: ${item.name} بخامة (${directOrderSelectedMaterial}) بقيمة ${total.toFixed(2)} ${currency}`
      );

      // Direct local update to merchant's cached database if present
      try {
        const tenantStorageKey = `rakeeza_tenant_data_${targetCompanyId}`;
        const rawTenant = localStorage.getItem(tenantStorageKey);
        if (rawTenant) {
          const parsedTenant = JSON.parse(rawTenant);
          parsedTenant.quotations = [newOrderDoc, ...(parsedTenant.quotations || [])];
          parsedTenant.nextQuoteId = Math.max(parsedTenant.nextQuoteId || 1, nextId + 1);
          localStorage.setItem(tenantStorageKey, JSON.stringify(parsedTenant));
        }
      } catch {}

      onUpdateData(updatedData);

      // ☁️ Multi-Tenant Cloud API Sync:
      // Send direct order directly to the merchant's companyId on the cloud backend
      try {
        fetch('/api/marketplace/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName: directOrderClientName.trim(),
            customerPhone: directOrderClientPhone.trim(),
            deliveryAddress: directOrderAddress.trim(),
            orderNotes: `الخامة المختارة: ${directOrderSelectedMaterial}. ${directOrderNotes.trim()}`,
            items: [
              {
                companyId: targetCompanyId,
                item: {
                  ...item,
                  name: `${item.name} (${directOrderSelectedMaterial})`,
                  companyId: targetCompanyId,
                },
                qty: directOrderQty,
                price: effectivePrice,
              },
            ],
          }),
        }).catch((e) => console.warn('Direct order cloud sync warning:', e));
      } catch {}

      if (config.soundAlertEnabled) {
        playOrderAlertChime();
      }

      // Format WhatsApp message to this specific merchant
      const cleanPhone = (vendor.whatsapp || vendor.phone || '01029190615').replace(/[^0-9]/g, '');
      const fullPhone = cleanPhone.startsWith('2')
        ? cleanPhone
        : cleanPhone.startsWith('0')
        ? `2${cleanPhone}`
        : `20${cleanPhone}`;

      const waMessage = `السلام عليكم ورحمة الله وبركاته،
مرحباً شركة (${vendor.tradeName || vendor.name})،
أود طلب المنتج التالي عبر المتجر الإلكتروني:
━━━━━━━━━━━━━━━
📦 المنتج: ${item.name}
🧵 الخامة المختارة: ${directOrderSelectedMaterial}
🔢 الكمية: ${directOrderQty} ${item.unit || 'قطعة'}
💰 السعر: ${effectivePrice.toFixed(2)} ${currency}
💵 الإجمالي: ${total.toFixed(2)} ${currency}
━━━━━━━━━━━━━━━
👤 اسم العميل: ${directOrderClientName.trim()}
📞 هاتف العميل: ${directOrderClientPhone.trim()}
${directOrderAddress ? `📍 العنوان: ${directOrderAddress.trim()}\n` : ''}${
        directOrderNotes ? `📝 ملاحظات: ${directOrderNotes.trim()}\n` : ''
      }📑 رقم الفاتورة والطلب بالمنظومة: ${orderRef}
━━━━━━━━━━━━━━━
✅ تم توجيه وتسجيل الفاتورة برقم (${orderRef}) تلقائياً إلى لوحة تحكم وارد الويب بشركتكم [${vendor.tradeName || vendor.name}].
يرجى تأكيد استلام الطلب وتجهيز الشحنة. شكراً جزيلاً.`;

      const waUrl = `https://wa.me/${fullPhone}?text=${encodeURIComponent(waMessage)}`;

      // Cache details
      setCustomerName(directOrderClientName);
      setCustomerPhone(directOrderClientPhone);
      setDeliveryAddress(directOrderAddress);

      // Close modal
      setDirectOrderModalItem(null);

      showToast(`تم توجيه وتسجيل الفاتورة #${orderRef} بنجاح إلى حساب ${vendor.tradeName || vendor.name} وجاري فتح الواتساب...`, 'success');
      window.open(waUrl, '_blank');
    } catch (err: any) {
      showToast('حدث خطأ أثناء تسجيل الطلب', 'error');
    } finally {
      setIsSubmittingDirectOrder(false);
    }
  };

  // Cart totals
  const cartItemsList = useMemo(() => Object.values(cart), [cart]);
  const cartTotalCount = useMemo(() => cartItemsList.reduce((acc, cur) => acc + cur.qty, 0), [cartItemsList]);
  const cartTotalPrice = useMemo(
    () => cartItemsList.reduce((acc, cur) => acc + cur.qty * cur.price, 0),
    [cartItemsList]
  );

  // Cart operations
  const handleAddToCart = (item: Item) => {
    let price: number;
    if (activePriceMode === 'wholesale') {
      price =
        item.catalogWholesalePrice && item.catalogWholesalePrice > 0
          ? item.catalogWholesalePrice
          : item.wholesalePrice || item.catalogPrice || item.salePrice || 0;
    } else {
      price =
        item.catalogDiscountPrice && item.catalogDiscountPrice > 0
          ? item.catalogDiscountPrice
          : item.catalogPrice !== undefined && item.catalogPrice > 0
          ? item.catalogPrice
          : item.salePrice || 0;
    }

    setCart((prev) => {
      const existing = prev[item.id];
      const newQty = existing ? existing.qty + 1 : 1;
      return {
        ...prev,
        [item.id]: {
          item,
          qty: newQty,
          price,
        },
      };
    });
    showToast(`تمت إضافة "${item.name}" إلى سلة الطلب`, 'success');
  };

  const handleUpdateCartQty = (itemId: string, delta: number) => {
    setCart((prev) => {
      const existing = prev[itemId];
      if (!existing) return prev;
      const newQty = existing.qty + delta;
      if (newQty <= 0) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return {
        ...prev,
        [itemId]: { ...existing, qty: newQty },
      };
    });
  };

  const handleRemoveFromCart = (itemId: string) => {
    setCart((prev) => {
      const copy = { ...prev };
      delete copy[itemId];
      return copy;
    });
  };

  const handleClearCart = () => {
    setCart({});
  };

  // Submit Order into ERP System
  const handleSubmitOrder = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!customerName.trim()) {
      showToast('يرجى كتابة اسم العميل أو اسم المحل', 'warning');
      return;
    }
    if (!customerPhone.trim()) {
      showToast('يرجى كتابة رقم الهاتف أو الواتساب للتواصل', 'warning');
      return;
    }
    if (cartItemsList.length === 0) {
      showToast('سلة الطلب فارغة، أضف بعض المنتجات أولاً', 'warning');
      return;
    }

    setIsSubmitting(true);

    try {
      // Multi-Tenant Isolation for Orders:
      // Group items by vendor company so each company gets their own order and invoice!
      const itemsByCompany: Record<string, CartItem[]> = {};
      cartItemsList.forEach((c) => {
        const vendor = getVendorForItem(c.item);
        const vId = vendor.id || 'COMP-000001';
        if (!itemsByCompany[vId]) {
          itemsByCompany[vId] = [];
        }
        itemsByCompany[vId].push(c);
      });

      let currentNextQuoteId = appData.nextQuoteId || (appData.quotations?.length || 0) + 1;
      let updatedQuotations = [...(appData.quotations || [])];
      let updatedData = { ...appData };
      const createdOrdersInfo: Array<{
        orderId: number;
        orderReference: string;
        companyId: string;
        companyName: string;
        companyPhone: string;
        companyWhatsapp: string;
        itemsCount: number;
        total: number;
      }> = [];

      const today = new Date().toISOString().split('T')[0];
      const nowTime = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
      let primaryOrderDoc: Quotation | null = null;

      Object.entries(itemsByCompany).forEach(([vCompanyId, vItems]) => {
        const vCompany =
          companies.find((c) => c.id === vCompanyId || c.code === vCompanyId || c.tenantId === vCompanyId) ||
          companies[0];
        const canonicalCompId = vCompany.id || vCompanyId;
        const nextId = currentNextQuoteId++;
        const orderRef = `ORD-${new Date().getFullYear()}-${String(nextId).padStart(4, '0')}`;
        const vTotal = vItems.reduce((sum, it) => sum + it.qty * it.price, 0);

        const invoiceItems: InvoiceItem[] = vItems.map((c) => ({
          itemId: c.item.id,
          name: c.item.name,
          qty: c.qty,
          price: c.price,
          total: c.qty * c.price,
          notes: c.item.unit ? `الوحدة: ${c.item.unit}` : undefined,
        }));

        const newOrderDoc: Quotation = {
          id: nextId,
          type: 'sale_quote',
          status: 'online_order',
          source: 'online_catalog',
          orderReference: orderRef,
          clientName: customerName.trim(),
          phone: customerPhone.trim(),
          customerAddress: deliveryAddress.trim() || undefined,
          deliveryNotes: orderNotes.trim() || undefined,
          notes: `طلب أونلاين عبر المتجر الإلكتروني والسوق الموحد لشركة [${vCompany.tradeName || vCompany.name}]. ${
            deliveryAddress ? `العنوان: ${deliveryAddress}. ` : ''
          }${orderNotes ? `ملاحظات: ${orderNotes}` : ''}`,
          date: today,
          time: nowTime,
          items: invoiceItems,
          subtotal: vTotal,
          discount: 0,
          tax: 0,
          total: vTotal,
          createdBy: `العميل (المتجر الإلكتروني - ${vCompany.tradeName || vCompany.name})`,
          companyId: canonicalCompId,
          orderStatus: 'new',
          autoPrinted: Boolean(config.autoPrintOrders),
        };

        if (!primaryOrderDoc) {
          primaryOrderDoc = newOrderDoc;
        }

        updatedQuotations.unshift(newOrderDoc);

        // Update individual tenant local storage cache if available
        try {
          const tenantStorageKey = `rakeeza_tenant_data_${canonicalCompId}`;
          const rawTenant = localStorage.getItem(tenantStorageKey);
          if (rawTenant) {
            const parsedTenant = JSON.parse(rawTenant);
            parsedTenant.quotations = [newOrderDoc, ...(parsedTenant.quotations || [])];
            parsedTenant.nextQuoteId = Math.max(parsedTenant.nextQuoteId || 1, nextId + 1);
            localStorage.setItem(tenantStorageKey, JSON.stringify(parsedTenant));
          }
        } catch {}

        createdOrdersInfo.push({
          orderId: nextId,
          orderReference: orderRef,
          companyId: canonicalCompId,
          companyName: vCompany.tradeName || vCompany.name,
          companyPhone: vCompany.phone || '01029190615',
          companyWhatsapp: vCompany.whatsapp || vCompany.phone || '01029190615',
          itemsCount: vItems.length,
          total: vTotal,
        });

        updatedData = addAuditLog(
          updatedData,
          'create',
          'المتجر الإلكتروني والسوق الموحد',
          `استلام طلب شراء أونلاين جديد #${orderRef} لشركة (${vCompany.tradeName || vCompany.name}) من العميل: ${customerName.trim()} بقيمة ${vTotal.toFixed(
            2
          )} ${currency}`
        );
      });

      updatedData.quotations = updatedQuotations;
      updatedData.nextQuoteId = currentNextQuoteId;
      onUpdateData(updatedData);

      // Multi-Tenant Cloud Sync: Send order to server marketplace endpoint to route directly to each company's cloud database
      try {
        fetch('/api/marketplace/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            deliveryAddress: deliveryAddress.trim(),
            orderNotes: orderNotes.trim(),
            items: cartItemsList.map((c) => {
              const vendor = getVendorForItem(c.item);
              const targetCompId = vendor.id || 'COMP-000001';
              return {
                companyId: targetCompId,
                item: { ...c.item, companyId: targetCompId },
                qty: c.qty,
                price: c.price,
              };
            }),
          }),
        }).catch((e) => console.warn('Cloud marketplace order sync warning:', e));
      } catch {}

      // Play alert chime if enabled
      if (config.soundAlertEnabled !== false) {
        playOrderAlertChime();
      }

      // Auto-print receipt for first order if enabled
      if (Boolean(config.autoPrintOrders) && primaryOrderDoc) {
        try {
          printWebOrderReceipt(primaryOrderDoc, updatedData, appData.catalogConfig?.printFormat || '80mm', true);
        } catch (printErr) {
          console.warn('Auto print failed:', printErr);
        }
      }

      // Set confirmed order view
      setConfirmedOrder({
        orderId: createdOrdersInfo[0]?.orderId || 1,
        orderReference: createdOrdersInfo.map((o) => o.orderReference).join(', '),
        items: [...cartItemsList],
        total: cartTotalPrice,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        deliveryAddress: deliveryAddress.trim(),
        orderNotes: orderNotes.trim(),
        date: today,
        createdOrders: createdOrdersInfo,
      });

      // Clear cart
      setCart({});
      setIsCartOpen(false);
      showToast('🎉 تم إرسال طلب الشراء إلى فواتير التجار المختصين بنجاح!', 'success');
    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء إرسال الطلب، يرجى المحاولة مرة أخرى', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Build WhatsApp share string
  const createWhatsAppOrderLink = (order: typeof confirmedOrder) => {
    if (!order) return '';
    const cleanPhone = (whatsappNumber || '').replace(/[^0-9]/g, '');
    const fullPhone = cleanPhone.startsWith('2') ? cleanPhone : cleanPhone.startsWith('0') ? `2${cleanPhone}` : `20${cleanPhone}`;

    const itemsSummary = order.items
      .map((it, idx) => `${idx + 1}. *${it.item.name}* (الكمية: ${it.qty} ${it.item.unit || 'قطعة'}) = ${(it.qty * it.price).toFixed(2)} ${currency}`)
      .join('\n');

    const message = `🛍️ *طلب شراء جديد من الكتالوج الإلكتروني*
---------------------------------------
🔖 *رقم الطلب:* ${order.orderReference}
📅 *التاريخ:* ${order.date}
👤 *اسم العميل:* ${order.customerName}
📞 *الهاتف:* ${order.customerPhone}
${order.deliveryAddress ? `📍 *عنوان التوصيل:* ${order.deliveryAddress}\n` : ''}${order.orderNotes ? `📝 *ملاحظات:* ${order.orderNotes}\n` : ''}---------------------------------------
📦 *تفاصيل المنتجات:*
${itemsSummary}
---------------------------------------
💰 *الإجمالي المطلوب:* *${order.total.toFixed(2)} ${currency}*
---------------------------------------
_تم الإرسال عبر الكتالوج الإلكتروني - منظومة RAKEEZA_`;

    return `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
  };

  // Print Order Receipt
  const handlePrintOrderReceipt = () => {
    if (!confirmedOrder) return;
    const printWindow = window.open('', '_blank', 'width=750,height=900');
    if (!printWindow) {
      alert('يرجى السماح بالنوافذ المنبثقة للطباعة');
      return;
    }

    const itemsRows = confirmedOrder.items
      .map(
        (it, idx) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${idx + 1}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">${it.item.name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${it.qty} ${it.item.unit || 'قطعة'}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${it.price.toFixed(2)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: bold;">${(it.qty * it.price).toFixed(2)}</td>
      </tr>
    `
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>إيصال طلب شراء - ${confirmedOrder.orderReference}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, sans-serif; }
          body { padding: 30px; background: #fff; color: #1e293b; font-size: 14px; }
          .header { border-bottom: 2px solid #1a237e; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
          .store-name { font-size: 24px; font-weight: bold; color: #1a237e; }
          .order-ref { font-size: 18px; font-weight: 800; color: #0d47a1; }
          .details-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-bottom: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { background: #1a237e; color: #fff; padding: 10px; font-size: 13px; }
          .total-box { background: #e8eaf6; border: 2px solid #1a237e; border-radius: 12px; padding: 16px; text-align: left; font-size: 18px; font-weight: 900; color: #1a237e; }
          .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 12px; border-top: 1px dashed #cbd5e1; padding-top: 15px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="store-name">${storeName}</div>
            <div style="color: #64748b; font-size: 13px; margin-top: 4px;">إيصال تأكيد طلب شراء إلكتروني</div>
          </div>
          <div style="text-align: left;">
            <div class="order-ref">${confirmedOrder.orderReference}</div>
            <div style="font-size: 12px; color: #64748b;">التاريخ: ${confirmedOrder.date}</div>
          </div>
        </div>

        <div class="details-box">
          <div><strong>العميل:</strong> ${confirmedOrder.customerName}</div>
          <div><strong>الهاتف:</strong> <span dir="ltr">${confirmedOrder.customerPhone}</span></div>
          ${confirmedOrder.deliveryAddress ? `<div style="grid-column: span 2;"><strong>عنوان التوصيل:</strong> ${confirmedOrder.deliveryAddress}</div>` : ''}
          ${confirmedOrder.orderNotes ? `<div style="grid-column: span 2;"><strong>ملاحظات الطلب:</strong> ${confirmedOrder.orderNotes}</div>` : ''}
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 40px;">#</th>
              <th style="text-align: right;">المنتج</th>
              <th style="width: 100px;">الكمية</th>
              <th style="width: 100px;">السعر (${currency})</th>
              <th style="width: 120px;">الإجمالي (${currency})</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <div class="total-box">
          الإجمالي الكلي: ${confirmedOrder.total.toFixed(2)} ${currency}
        </div>

        <div class="footer">
          شكراً لتسوقكم معنا! للتواصل: ${contactPhone} | ${appData.settings.address || ''}
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 400);
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Helper category icons
  const getCategoryIcon = (catName?: string) => {
    if (!catName) return '📦';
    const c = catName.toLowerCase();
    if (c.includes('غذاء') || c.includes('طعام') || c.includes('أغذية')) return '🥫';
    if (c.includes('كهرب') || c.includes('إلكترون') || c.includes('كمبيوتر')) return '💻';
    if (c.includes('موبايل') || c.includes('هاتف')) return '📱';
    if (c.includes('ملابس') || c.includes('أزياء')) return '👕';
    if (c.includes('بناء') || c.includes('دهان') || c.includes('حديد')) return '🏗️';
    if (c.includes('صحة') || c.includes('دواء') || c.includes('طبي')) return '💊';
    if (c.includes('سيار') || c.includes('قطع غيار')) return '🚗';
    if (c.includes('منزل') || c.includes('أثاث')) return '🛋️';
    if (c.includes('مشروب') || c.includes('عصير')) return '🧃';
    return '📦';
  };

  // If a non-existent company URL was accessed, protect data privacy
  if (isInvalidCompanyRequested) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center" dir="rtl">
        <div className="bg-slate-800 border border-slate-700/80 p-8 rounded-2xl max-w-md w-full shadow-2xl">
          <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
            🔒
          </div>
          <h2 className="text-xl font-bold text-white mb-2">رابط المتجر غير متاح أو غير مصرح</h2>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            المتجر الإلكتروني المطلوب بالمعرف (<span className="text-amber-400 font-mono font-bold">{companyParam}</span>) غير مسجل في النظام أو تم تغيير الرابط الخاص به. لضمان أمان وعزل بيانات الشركات بالكامل، لا يمكن عرض منتجات أي شركة أخرى عبر هذا الرابط.
          </p>
          {onExitToAdmin && (
            <button
              type="button"
              onClick={onExitToAdmin}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 px-4 rounded-xl font-bold text-sm transition cursor-pointer"
            >
              العودة إلى لوحة الإدارة
            </button>
          )}
          <div className="text-xs text-slate-500 border-t border-slate-700/60 pt-4 mt-4">
            نظام ركيزة - عزل تام لبيانات الشركات والكتالوجات الإلكترونية
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-28 font-sans w-full max-w-full overflow-x-hidden" dir="rtl">
      {/* Top Admin / Staff Notification Bar (If visited within ERP or with onExitToAdmin) */}
      {onExitToAdmin && (
        <div className="bg-slate-900 text-white px-3 py-2 text-xs flex items-center justify-between shadow-xs sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <span className="bg-emerald-500 text-slate-950 font-black px-2 py-0.5 rounded-full text-[10px]">
              وضع المعاينة الحية
            </span>
            <span className="hidden sm:inline font-bold">
              هذه هي واجهة كتالوج المتجر كما يراها عملاؤك أونلاين تماماً.
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onShareCatalog && (
              <button
                type="button"
                onClick={onShareCatalog}
                className="bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 px-3 py-1 rounded-lg font-black text-xs transition cursor-pointer flex items-center gap-1 shadow-xs"
              >
                <span>🔗</span> مشاركة الكتالوج والـ QR
              </button>
            )}
            <button
              type="button"
              onClick={onExitToAdmin}
              className="bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1"
            >
              <span>↩️</span> العودة للوحة الإدارة (ERP)
            </button>
          </div>
        </div>
      )}

      {/* Marketplace Context Notice (only when in Unified Marketplace mode) */}
      {isUnifiedMarketplace && (
        <div className="bg-slate-900 text-white border-b border-slate-800 px-4 py-2 text-xs shadow-inner">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-right">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-black">🌐 السوق الإلكتروني الموحد:</span>
              <span className="text-slate-300">
                تصفح منتجات كافة التجار المعتمدين، حدد الخامة والمواصفات، وسيتم توجيه الفاتورة والطلب إلى التاجر المختار مباشرة.
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700">
              إجمالي المنتجات: {companyItems.length} صنف
            </span>
          </div>
        </div>
      )}

      {/* Main Store Header */}
      <header className="bg-gradient-to-r from-[#1a237e] via-[#0d47a1] to-[#1565c0] text-white shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Logo & Store Info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-2xl shadow-inner">
                {isUnifiedMarketplace ? '🌐' : '🛍️'}
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
                  <span>{storeName}</span>
                  <span className="text-[11px] bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full font-bold">
                    {isUnifiedMarketplace ? 'منصة متعددة التجار' : 'متجر الشركة'}
                  </span>
                </h1>
                <p className="text-xs text-blue-100/90 font-medium line-clamp-1">
                  {config.storeDescription || 'الكتالوج الإلكتروني المباشر لاستعراض الأسعار والطلب الفوري'}
                </p>
              </div>
            </div>

            {/* Mobile Cart Button */}
            <div className="flex md:hidden items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCartOpen(true)}
                className="relative bg-amber-400 hover:bg-amber-300 text-slate-950 px-3.5 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition active:scale-95"
              >
                <span>🛒</span>
                <span>السلة</span>
                {cartTotalCount > 0 && (
                  <span className="bg-red-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {cartTotalCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Quick Contact & Header Actions */}
          <div className="flex items-center gap-2.5 flex-wrap justify-between md:justify-end text-xs">
            {contactPhone && (
              <a
                href={`tel:${contactPhone}`}
                className="bg-white/10 hover:bg-white/20 active:bg-white/30 text-white px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition border border-white/10"
              >
                <span>📞</span>
                <span dir="ltr">{contactPhone}</span>
              </a>
            )}

            {whatsappNumber && (
              <a
                href={`https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition shadow-xs"
              >
                <span>💬</span>
                <span>تواصل واتساب</span>
              </a>
            )}

            {/* Desktop Cart Button */}
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="hidden md:flex relative bg-amber-400 hover:bg-amber-300 text-slate-950 px-4 py-2 rounded-xl font-black text-xs items-center gap-2 shadow-md cursor-pointer transition active:scale-95"
            >
              <span>🛒</span>
              <span>سلة الطلبات</span>
              <span className="bg-slate-900 text-white text-[11px] font-black px-2 py-0.5 rounded-full">
                {cartTotalCount} صنف
              </span>
              <span className="border-r border-slate-950/20 pr-1.5 text-slate-950 font-black">
                {cartTotalPrice.toFixed(2)} {currency}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Banner Notice */}
      {config.bannerMessage && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2 text-center text-xs font-bold flex items-center justify-center gap-2">
          <span>📢</span>
          <span>{config.bannerMessage}</span>
        </div>
      )}

      {/* Order Confirmed Screen (If order submitted successfully) */}
      {confirmedOrder && (
        <div className="max-w-3xl mx-auto px-4 py-8 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-emerald-100 text-center space-y-6">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl mx-auto flex items-center justify-center text-3xl shadow-inner">
              ✓
            </div>
            <div>
              <span className="bg-emerald-100 text-emerald-800 text-xs font-black px-3 py-1 rounded-full">
                تم تسجيل الطلبية بنجاح في المنظومة
              </span>
              <h2 className="text-2xl font-black text-slate-900 mt-2">شكراً لك، {confirmedOrder.customerName}!</h2>
              <p className="text-slate-600 text-sm mt-1">
                رقم الطلب المرجعي الخاص بك هو:{' '}
                <strong className="text-blue-700 font-mono text-base">{confirmedOrder.orderReference}</strong>
              </p>
            </div>

            {/* Per-Vendor Orders List if multiple vendors, or Single Order Actions */}
            {confirmedOrder.createdOrders && confirmedOrder.createdOrders.length > 1 ? (
              <div className="space-y-3 pt-2">
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 text-xs text-blue-900 text-right">
                  <strong>📦 تم تقسيم طلبك حسب الشركات الموردة ({confirmedOrder.createdOrders.length} شركات):</strong>
                  <p className="text-[11px] text-blue-700 mt-0.5">
                    كل شركة استلمت فاتورتها الخاصة في منظومتها المحاسبية. يمكنك إرسال إشعار فوري لكل تاجر عبر الواتساب:
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-right">
                  {confirmedOrder.createdOrders.map((ord) => {
                    const cleanPhone = (ord.companyWhatsapp || ord.companyPhone || '01029190615').replace(/[^0-9]/g, '');
                    const fullPhone = cleanPhone.startsWith('2') ? cleanPhone : cleanPhone.startsWith('0') ? `2${cleanPhone}` : `20${cleanPhone}`;
                    const msg = `مرحباً ${ord.companyName}، لقد قمت بإرسال طلب شراء جديد رقم (${ord.orderReference}) عبر السوق الإلكتروني الموحد بقيمة ${ord.total.toFixed(2)} ${currency}. يرجى مراجعة الفاتورة في المنظومة وتأكيد الشحن.`;
                    const waLink = `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;

                    return (
                      <div key={ord.orderReference} className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 text-xs">🏢 {ord.companyName}</span>
                          <span className="font-mono text-xs font-black text-blue-700">{ord.orderReference}</span>
                        </div>
                        <div className="text-xs text-slate-600 flex items-center justify-between">
                          <span>{ord.itemsCount} أصناف</span>
                          <span className="font-black text-slate-900">{ord.total.toFixed(2)} {currency}</span>
                        </div>
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition shadow-xs"
                        >
                          <span>💬</span> إرسال للتاجر واتساب
                        </a>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={handlePrintOrderReceipt}
                    className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>🖨️</span> طباعة إيصال الفاتورة الإجمالية
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto pt-2">
                <a
                  href={createWhatsAppOrderLink(confirmedOrder)}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm px-5 py-3 rounded-2xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>💬</span> إرسال نسخة الطلب عبر الواتساب
                </a>
                <button
                  type="button"
                  onClick={handlePrintOrderReceipt}
                  className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs sm:text-sm px-5 py-3 rounded-2xl transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>🖨️</span> طباعة إيصال الطلبية
                </button>
              </div>
            )}

            {/* Order Items Breakdown */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-right text-xs">
              <div className="font-bold text-slate-800 mb-3 border-b border-slate-200 pb-2 flex justify-between">
                <span>ملخص محتويات الطلبية:</span>
                <span>{confirmedOrder.items.length} أصناف</span>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto divide-y divide-slate-100">
                {confirmedOrder.items.map((it, idx) => {
                  const itVendor = getVendorForItem(it.item);
                  return (
                    <div key={idx} className="pt-2 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-slate-800">{it.item.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {it.qty} × {it.price.toFixed(2)} {currency} • <span className="text-blue-700">🏢 {itVendor.tradeName || itVendor.name}</span>
                        </p>
                      </div>
                      <span className="font-black text-slate-900">
                        {(it.qty * it.price).toFixed(2)} {currency}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="border-t-2 border-slate-300 mt-3 pt-3 flex justify-between items-center text-sm font-black text-[#1a237e]">
                <span>المبلغ الإجمالي:</span>
                <span>
                  {confirmedOrder.total.toFixed(2)} {currency}
                </span>
              </div>
            </div>

            {/* Continue Shopping Button */}
            <button
              type="button"
              onClick={() => setConfirmedOrder(null)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-6 py-2.5 rounded-xl transition cursor-pointer"
            >
              🛍️ متابعة التسوق وعمل طلب آخر
            </button>
          </div>
        </div>
      )}

      {/* Pending Store Activation Notice Screen (If a non-activated company store is viewed directly) */}
      {!confirmedOrder && !isUnifiedMarketplace && !isCompanyStoreActive(activeCompany) && (
        <div className="max-w-2xl mx-auto px-4 py-12 text-center" dir="rtl">
          <div className="bg-white border border-amber-200 rounded-3xl p-8 shadow-xl space-y-4">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto text-3xl">
              💳
            </div>
            <span className="bg-amber-100 text-amber-800 text-xs font-black px-3 py-1 rounded-full">
              المتجر الإلكتروني بانتظار تفعيل الاشتراك (1000 ج.م)
            </span>
            <h2 className="text-xl font-black text-slate-900">
              متجر {activeCompany.tradeName || activeCompany.name}
            </h2>
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed max-w-md mx-auto">
              تفعيل المتجر الإلكتروني الخاص بهذه الشركة وعرض منتجاتها بالسوق الموحد يتطلب اشتراكاً لأول مرة بقيمة <strong>1,000 ج.م</strong>.
              يرجى التواصل مع مالك وإدارة المنظومة لسداد الرسوم وتفعيل المتجر فوراً.
            </p>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-1.5 text-slate-700 text-right">
              <div className="flex justify-between">
                <span>🏢 <strong>كود الشركة:</strong></span>
                <span className="font-mono text-blue-700 font-bold">{activeCompany.code || activeCompany.id}</span>
              </div>
              <div className="flex justify-between">
                <span>📞 <strong>رقم هاتف المالك المباشر:</strong></span>
                <span dir="ltr" className="font-bold text-slate-900">01029190615</span>
              </div>
              <div className="flex justify-between">
                <span>🎁 <strong>فترة تجربة المنظومة:</strong></span>
                <span className="font-bold text-emerald-700">شهر كامل مجاني (30 يوماً) لكافة أقسام النظام</span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 pt-2 justify-center">
              <a
                href={`https://wa.me/201029190615?text=${encodeURIComponent(
                  `مرحباً، أود تفعيل المتجر الإلكتروني والسوق الموحد لشركة (${activeCompany.name}) كود: ${activeCompany.code || activeCompany.id} وسداد اشتراك الـ 1000 جنية.`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-5 py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs"
              >
                <span>💬</span> تواصل مع المالك واتساب (01029190615)
              </a>
              <a
                href="tel:01029190615"
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition flex items-center justify-center gap-1.5"
              >
                <span>📞</span> اتصال بالمالك
              </a>
              <button
                type="button"
                onClick={() => setSelectedVendorCompanyId('all')}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-5 py-2.5 rounded-xl transition cursor-pointer"
              >
                🌐 تصفح السوق الموحد (الشركات المفعلة)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Browsing Screen */}
      {!confirmedOrder && (isUnifiedMarketplace || isCompanyStoreActive(activeCompany)) && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-6">
          {/* Controls Bar: Search & Filtering */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3">
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              {/* Search Box */}
              <div className="relative flex-1">
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث باسم المنتج، الكود، الباركود، أو التصنيف..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-8 py-2.5 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-[#1a237e] focus:bg-white transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Extra Toggles: Pricing & In-Stock */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Price Mode Toggle if enabled */}
                {config.priceDisplayMode === 'both' && (
                  <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-bold border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setActivePriceMode('retail')}
                      className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                        activePriceMode === 'retail'
                          ? 'bg-[#1a237e] text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      سعر قطاعي
                    </button>
                    <button
                      type="button"
                      onClick={() => setActivePriceMode('wholesale')}
                      className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                        activePriceMode === 'wholesale'
                          ? 'bg-[#1a237e] text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      سعر جملة
                    </button>
                  </div>
                )}

                {/* Material Filter */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
                  <span className="text-slate-500 font-bold whitespace-nowrap">🧵 الخامة:</span>
                  <select
                    value={selectedMaterialFilter}
                    onChange={(e) => setSelectedMaterialFilter(e.target.value)}
                    className="bg-transparent font-bold text-slate-800 focus:outline-hidden cursor-pointer max-w-[130px] truncate"
                  >
                    <option value="all">كل الخامات</option>
                    {availableMaterials
                      .filter((m) => m !== 'all')
                      .map((mat) => (
                        <option key={mat} value={mat}>
                          {mat}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Merchant Filter (Only in Unified Marketplace mode) */}
                {isUnifiedMarketplace && (
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
                    <span className="text-slate-500 font-bold whitespace-nowrap">🏢 التاجر:</span>
                    <select
                      value={selectedMerchantFilter}
                      onChange={(e) => setSelectedMerchantFilter(e.target.value)}
                      className="bg-transparent font-bold text-slate-800 focus:outline-hidden cursor-pointer max-w-[140px] truncate"
                    >
                      <option value="all">جميع التجار (الكل)</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.tradeName || c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Stock Toggle */}
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl cursor-pointer hover:bg-slate-100 transition select-none">
                  <input
                    type="checkbox"
                    checked={onlyInStock}
                    onChange={(e) => setOnlyInStock(e.target.checked)}
                    className="rounded text-[#1a237e] focus:ring-0 cursor-pointer"
                  />
                  <span>المتوفر بالمخزن فقط</span>
                </label>

                {/* Sort Dropdown */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-hidden cursor-pointer"
                >
                  <option value="default">الترتيب الافتراضي</option>
                  <option value="price_asc">السعر: من الأقل للأعلى</option>
                  <option value="price_desc">السعر: من الأعلى للأقل</option>
                  <option value="name">الاسم: أ - ي</option>
                </select>
              </div>
            </div>

            {/* Category Filter Pills & Material Quick Chips */}
            <div className="space-y-1.5 pt-1 border-t border-slate-100">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 no-scrollbar text-xs">
                <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap ml-1">الأقسام:</span>
                {categories.map((cat) => {
                  const isSelected = selectedCategory === cat;
                  const label = cat === 'all' ? '🛍️ جميع المنتجات' : `${getCategoryIcon(cat)} ${cat}`;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer text-xs ${
                        isSelected
                          ? 'bg-[#1a237e] text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Material Quick Filters */}
              {availableMaterials.length > 2 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-[11px]">
                  <span className="font-bold text-slate-400 whitespace-nowrap ml-1">خامة سريعة:</span>
                  {availableMaterials.slice(0, 8).map((mat) => {
                    const isSelected = selectedMaterialFilter === mat;
                    return (
                      <button
                        key={mat}
                        type="button"
                        onClick={() => setSelectedMaterialFilter(isSelected && mat !== 'all' ? 'all' : mat)}
                        className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-700 text-white shadow-xs'
                            : 'bg-emerald-50/80 hover:bg-emerald-100 text-emerald-900 border border-emerald-200/80'
                        }`}
                      >
                        {mat === 'all' ? 'الكل' : `🧵 ${mat}`}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Results Summary */}
          <div className="flex items-center justify-between text-xs text-slate-500 px-1 font-bold">
            <span>
              عرض {filteredItems.length} منتج
              {selectedCategory !== 'all' ? ` في تصنيف "${selectedCategory}"` : ''}
            </span>
            {cartTotalCount > 0 && (
              <span className="text-emerald-700">
                لديك {cartTotalCount} عناصر في السلة ({cartTotalPrice.toFixed(2)} {currency})
              </span>
            )}
          </div>

          {/* Products Grid */}
          {filteredItems.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs space-y-3">
              <div className="text-4xl">🔍</div>
              <h3 className="text-base font-bold text-slate-800">لا توجد منتجات مطابقة للبحث أو التصنيف المحدد</h3>
              <p className="text-xs text-slate-500">جرب البحث بكلمة أخرى أو إلغاء فلتر المتوفر في المخزن</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                  setOnlyInStock(false);
                }}
                className="mt-2 bg-[#1a237e] hover:bg-[#0d47a1] text-white px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                إعادة ضبط الفلاتر
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
              {filteredItems.map((item) => {
                const inStock = (item.quantity || 0) > 0;
                const baseCatalogPrice =
                  item.catalogPrice !== undefined && item.catalogPrice > 0 ? item.catalogPrice : item.salePrice || 0;
                const isDiscounted = Boolean(item.catalogDiscountPrice && item.catalogDiscountPrice > 0);
                const wholesalePrice =
                  item.catalogWholesalePrice && item.catalogWholesalePrice > 0
                    ? item.catalogWholesalePrice
                    : item.wholesalePrice;

                const effectivePrice =
                  activePriceMode === 'wholesale' && wholesalePrice && wholesalePrice > 0
                    ? wholesalePrice
                    : isDiscounted
                    ? item.catalogDiscountPrice!
                    : baseCatalogPrice;

                const inCart = cart[item.id];

                return (
                  <div
                    key={item.id}
                    className={`bg-white rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden group ${
                      item.catalogFeatured
                        ? 'border-indigo-300 ring-2 ring-indigo-50 shadow-xs'
                        : 'border-slate-200 hover:border-blue-300 hover:shadow-md'
                    }`}
                  >
                    {/* Top Thumbnail Badge */}
                    <div className="relative bg-gradient-to-br from-slate-50 to-blue-50/40 p-4 flex flex-col items-center justify-center min-h-[130px] border-b border-slate-100 overflow-hidden">
                      <div className="w-16 h-16 rounded-2xl bg-white shadow-xs border border-slate-100 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform overflow-hidden">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          getCategoryIcon(item.category)
                        )}
                      </div>

                      {/* Top Badges (Category, Featured, Custom Badge) */}
                      <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                        {item.catalogFeatured && (
                          <span className="bg-indigo-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-xs">
                            🌟 مميز
                          </span>
                        )}
                        {item.catalogBadge && (
                          <span className="bg-amber-400 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-full shadow-xs">
                            {item.catalogBadge}
                          </span>
                        )}
                        {item.category && !item.catalogBadge && (
                          <span className="bg-white/90 backdrop-blur-xs text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-200">
                            {item.category}
                          </span>
                        )}
                      </div>

                      {/* Stock Status Badge */}
                      {config.showStockStatus && (
                        <span
                          className={`absolute top-2 left-2 text-[10px] font-black px-2 py-0.5 rounded-full ${
                            inStock
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {inStock
                            ? config.showExactStockQty
                              ? `متوفر (${item.quantity})`
                              : 'متوفر'
                            : 'غير متوفر'}
                        </span>
                      )}
                    </div>

                    {/* Body Content */}
                    <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between space-y-2.5">
                      <div>
                        {/* Merchant Seller Badge (Only shown in Unified Marketplace) */}
                        {isUnifiedMarketplace && (() => {
                          const itVendor = getVendorForItem(item);
                          return (
                            <div className="flex items-center justify-between gap-1 mb-1.5 bg-slate-50 border border-slate-200/80 px-2 py-0.5 rounded-lg">
                              <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700 truncate">
                                <span className="text-amber-500">🏢</span>
                                <span className="text-[#1a237e] font-extrabold truncate">
                                  {itVendor.tradeName || itVendor.name}
                                </span>
                              </div>
                              {itVendor.code && (
                                <span className="font-mono text-[9px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                  #{itVendor.code}
                                </span>
                              )}
                            </div>
                          );
                        })()}

                        <h4 className="font-bold text-slate-900 text-xs sm:text-sm line-clamp-2 leading-snug">
                          {item.name}
                        </h4>

                        {/* Material (الخامة) Display */}
                        <div className="my-1.5 bg-emerald-50/70 border border-emerald-100 rounded-lg px-2 py-1 text-[11px] flex items-center justify-between gap-1">
                          <span className="text-emerald-900 font-bold flex items-center gap-1 shrink-0">
                            <span>🧵</span> الخامة:
                          </span>
                          <span className="font-bold text-emerald-950 truncate" title={item.material || 'خامة معتمدة ممتازة'}>
                            {item.material || 'خامة ممتازة معتمدة'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-1">
                          {item.unit && <span>الوحدة: {item.unit}</span>}
                          {item.barcode && <span className="font-mono text-[10px] text-slate-400">({item.barcode})</span>}
                        </div>
                        {(item.catalogDescription || item.description) && (
                          <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                            {item.catalogDescription || item.description}
                          </p>
                        )}
                      </div>

                      {/* Price Section with Discount Support */}
                      <div className="pt-2 border-t border-slate-100 flex items-baseline justify-between">
                        <div>
                          {isDiscounted && activePriceMode === 'retail' ? (
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-base sm:text-lg font-black text-rose-600">
                                {effectivePrice.toFixed(2)}
                              </span>
                              <span className="text-xs line-through text-slate-400 font-bold">
                                {baseCatalogPrice.toFixed(2)}
                              </span>
                              <span className="text-[10px] font-bold text-slate-500 mr-0.5">{currency}</span>
                            </div>
                          ) : (
                            <div>
                              <span className="text-base sm:text-lg font-black text-[#1a237e]">
                                {effectivePrice.toFixed(2)}
                              </span>
                              <span className="text-[10px] font-bold text-slate-500 mr-1">{currency}</span>
                            </div>
                          )}
                        </div>
                        {wholesalePrice && wholesalePrice > 0 && activePriceMode === 'retail' && (
                          <span className="text-[10px] text-emerald-700 font-semibold">
                            جملة: {wholesalePrice}
                          </span>
                        )}
                      </div>

                      {/* Action Buttons: Direct WhatsApp Order (Select Material) + Cart */}
                      <div className="space-y-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenDirectOrderModal(item)}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white py-2 px-2.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                          title="اختر الخامة وأرسل رسالة بالطلب والفاتورة إلى التاجر"
                        >
                          <span>💬</span>
                          <span>طلب ورسالة للتاجر</span>
                        </button>

                        {inCart ? (
                          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl p-1">
                            <button
                              type="button"
                              onClick={() => handleUpdateCartQty(item.id, -1)}
                              className="w-7 h-7 bg-white hover:bg-slate-100 text-slate-800 rounded-lg font-black text-sm flex items-center justify-center shadow-xs cursor-pointer active:scale-95 transition"
                            >
                              -
                            </button>
                            <span className="font-black text-xs text-[#1a237e] px-2">
                              {inCart.qty} في السلة
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateCartQty(item.id, 1)}
                              className="w-7 h-7 bg-[#1a237e] hover:bg-[#0d47a1] text-white rounded-lg font-black text-sm flex items-center justify-center shadow-xs cursor-pointer active:scale-95 transition"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAddToCart(item)}
                            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-1.5 px-2.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 border border-slate-200"
                          >
                            <span>🛒</span>
                            <span>إضافة للسلة</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Floating Bottom Bar (Sticky on Mobile & Desktop when cart has items) */}
      {cartTotalCount > 0 && !confirmedOrder && !isCartOpen && (
        <aside
          aria-label="شريط سلة الطلب العائم"
          className="fixed bottom-3 sm:bottom-5 left-4 right-4 max-w-2xl mx-auto z-40 animate-slide-up"
        >
          <div className="bg-[#1a237e] text-white rounded-2xl p-3 sm:p-3.5 shadow-2xl flex items-center justify-between border border-blue-400/30 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center text-lg font-black shadow-xs">
                {cartTotalCount}
              </div>
              <div>
                <p className="text-xs text-blue-200 font-medium">إجمالي سلة الطلب</p>
                <p className="text-base sm:text-lg font-black text-white">
                  {cartTotalPrice.toFixed(2)} {currency}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 px-5 py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-md transition"
            >
              <span>🛒 استكمال الطلب والدفع</span>
              <span>←</span>
            </button>
          </div>
        </aside>
      )}

      {/* Cart & Checkout Modal Drawer */}
      {isCartOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in"
          onClick={() => setIsCartOpen(false)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-200 my-auto flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-[#1a237e] text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🛒</span>
                <h3 className="text-sm sm:text-base font-black">سلة المنتجات واستكمال الطلب</h3>
                <span className="bg-amber-400 text-slate-950 text-xs font-black px-2 py-0.5 rounded-full">
                  {cartTotalCount} صنف
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsCartOpen(false)}
                className="text-white/80 hover:text-white w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs sm:text-sm">
              {cartItemsList.length === 0 ? (
                <div className="text-center py-10 space-y-3 text-slate-500">
                  <div className="text-4xl">🛒</div>
                  <p className="font-bold text-slate-700">السلة فارغة حالياً</p>
                  <p className="text-xs">تصفح المنتجات في الكتالوج وأضف العناصر التي ترغب في طلبها</p>
                </div>
              ) : (
                <>
                  {/* Cart Items List */}
                  <div className="space-y-2 divide-y divide-slate-100">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-500 pb-1">
                      <span>المنتجات المحددة ({cartItemsList.length}):</span>
                      <button
                        type="button"
                        onClick={handleClearCart}
                        className="text-rose-600 hover:text-rose-700 cursor-pointer"
                      >
                        تفريغ السلة
                      </button>
                    </div>

                    {cartItemsList.map(({ item, qty, price }) => {
                      const itVendor = getVendorForItem(item);
                      return (
                        <div key={item.id} className="pt-2.5 flex items-center justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="font-bold text-slate-900 line-clamp-1">{item.name}</h4>
                              <span className="bg-slate-100 text-slate-700 text-[10px] px-1.5 py-0.5 rounded font-bold whitespace-nowrap">
                                🏢 {itVendor.tradeName || itVendor.name}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500">
                              {price.toFixed(2)} {currency} {item.unit ? `(${item.unit})` : ''}
                            </p>
                          </div>

                          {/* Qty Controls */}
                          <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl p-1 border border-slate-200">
                            <button
                              type="button"
                              onClick={() => handleUpdateCartQty(item.id, -1)}
                              className="w-6 h-6 bg-white hover:bg-slate-200 text-slate-800 rounded-lg font-bold flex items-center justify-center text-xs cursor-pointer"
                            >
                              -
                            </button>
                            <span className="w-8 text-center font-bold text-xs">{qty}</span>
                            <button
                              type="button"
                              onClick={() => handleUpdateCartQty(item.id, 1)}
                              className="w-6 h-6 bg-[#1a237e] text-white hover:bg-[#0d47a1] rounded-lg font-bold flex items-center justify-center text-xs cursor-pointer"
                            >
                              +
                            </button>
                          </div>

                          {/* Line Total & Remove */}
                          <div className="text-left min-w-[75px]">
                            <span className="font-black text-slate-900 block text-xs">
                              {(qty * price).toFixed(2)} {currency}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveFromCart(item.id)}
                              className="text-[10px] text-rose-500 hover:text-rose-700 cursor-pointer"
                            >
                              حذف
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Cart Totals Summary Card */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>إجمالي قيمة الأصناف:</span>
                      <span className="font-bold">
                        {cartTotalPrice.toFixed(2)} {currency}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>الشحن والتوصيل:</span>
                      <span className="text-emerald-700 font-bold">يتم الاتفاق والتأكيد هاتفياً</span>
                    </div>
                    <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-sm font-black text-[#1a237e]">
                      <span>الإجمالي المطلوب:</span>
                      <span className="text-base">
                        {cartTotalPrice.toFixed(2)} {currency}
                      </span>
                    </div>
                  </div>

                  {/* Customer Information Form */}
                  <form onSubmit={handleSubmitOrder} className="space-y-3 pt-2">
                    <div className="border-t border-slate-200 pt-3">
                      <h4 className="font-black text-slate-900 text-xs mb-2 flex items-center gap-1.5">
                        <span>📝</span> بيانات التواصل والتوصيل
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          الاسم / اسم المحل أو المؤسسة <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="مثال: أحمد عبد الله / مكتبة النور"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:bg-white focus:ring-2 focus:ring-[#1a237e] focus:outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          رقم الهاتف / الواتساب <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="tel"
                          required
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          placeholder="مثال: 01012345678"
                          dir="ltr"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:bg-white focus:ring-2 focus:ring-[#1a237e] focus:outline-hidden text-right"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        عنوان التوصيل أو الفرع المستلم
                      </label>
                      <input
                        type="text"
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        placeholder="مثال: القاهرة - المعادي - شارع النصر"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:bg-white focus:ring-2 focus:ring-[#1a237e] focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        ملاحظات إضافية على الطلب
                      </label>
                      <input
                        type="text"
                        value={orderNotes}
                        onChange={(e) => setOrderNotes(e.target.value)}
                        placeholder="أي تفاصيل خاصة بموعد التسليم أو المواصفات..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:bg-white focus:ring-2 focus:ring-[#1a237e] focus:outline-hidden"
                      />
                    </div>
                  </form>
                </>
              )}
            </div>

            {/* Modal Footer Actions */}
            {cartItemsList.length > 0 && (
              <div className="bg-slate-50 border-t border-slate-200 p-4 flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSubmitOrder()}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white py-3 px-5 rounded-xl font-black text-xs sm:text-sm transition cursor-pointer shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <span>🚀</span>
                  <span>{isSubmitting ? 'جاري تسجيل الطلب...' : 'تأكيد وإرسال الطلب للمنظومة'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsCartOpen(false)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 py-3 px-5 rounded-xl font-bold text-xs transition cursor-pointer"
                >
                  إغلاق السلة
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Direct Order & WhatsApp Dispatch Modal (اختيار الخامة وإرسال الفاتورة للتاجر المختار) */}
      {directOrderModalItem && (() => {
        const item = directOrderModalItem;
        const vendor = getVendorForItem(item);
        const effectivePrice =
          item.catalogDiscountPrice && item.catalogDiscountPrice > 0
            ? item.catalogDiscountPrice
            : item.catalogPrice !== undefined && item.catalogPrice > 0
            ? item.catalogPrice
            : item.salePrice || 0;
        const total = directOrderQty * effectivePrice;

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto"
            dir="rtl"
          >
            <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-auto">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-emerald-600 via-teal-700 to-[#1a237e] text-white p-4 sm:p-5 flex items-center justify-between">
                <div>
                  <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    طلب مباشر من التاجر
                  </span>
                  <h3 className="text-base sm:text-lg font-black mt-1">
                    طلب المنتج وإرسال الفاتورة للتاجر
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setDirectOrderModalItem(null)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer text-sm"
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleSubmitDirectOrder} className="p-4 sm:p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                {/* Product & Merchant Info Card */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex gap-3 items-center">
                  <div className="w-16 h-16 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-3xl overflow-hidden shrink-0">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <span>📦</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-black text-slate-900 text-xs sm:text-sm truncate">{item.name}</h4>
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-0.5">
                      <span className="text-amber-500">🏢 التاجر:</span>
                      <strong className="text-blue-900">{vendor.tradeName || vendor.name}</strong>
                      {vendor.code && <span className="font-mono text-[10px] text-slate-400">({vendor.code})</span>}
                    </div>
                    <div className="text-xs font-black text-emerald-700 mt-1">
                      {effectivePrice.toFixed(2)} {currency} {item.unit ? ` / ${item.unit}` : ''}
                    </div>
                  </div>
                </div>

                {/* Material Selection (اختيار الخامة) */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-slate-800 flex items-center gap-1">
                    <span>🧵</span>
                    <span>حدد الخامة أو نوع القماش / المواصفات المطلوبة:</span>
                    <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      item.material,
                      'قطن مصري 100%',
                      'كتان فاخر',
                      'صوف طبيعي',
                      'حرير ناعم',
                      'جلد طبيعي',
                    ]
                      .filter((m, idx, arr): m is string => Boolean(m && m.trim() && arr.indexOf(m) === idx))
                      .map((mat) => {
                        const isSelected = directOrderSelectedMaterial === mat;
                        return (
                          <button
                            key={mat}
                            type="button"
                            onClick={() => setDirectOrderSelectedMaterial(mat)}
                            className={`py-2 px-2.5 rounded-xl text-xs font-bold transition cursor-pointer border text-center truncate ${
                              isSelected
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {mat}
                          </button>
                        );
                      })}
                  </div>
                  {/* Or Custom Material Input */}
                  <input
                    type="text"
                    value={directOrderSelectedMaterial}
                    onChange={(e) => setDirectOrderSelectedMaterial(e.target.value)}
                    placeholder="أو اكتب الخامة / المواصفات الخاصة هنا يدويًا..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden mt-1"
                    required
                  />
                </div>

                {/* Quantity Stepper */}
                <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-2xl p-3">
                  <div className="text-xs font-bold text-slate-800">
                    <span>الكمية المطلوبة:</span>
                    <span className="text-slate-500 mr-1 text-[11px]">({item.unit || 'قطعة'})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDirectOrderQty((q) => Math.max(1, q - 1))}
                      className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-800 font-black text-sm hover:bg-slate-100 transition cursor-pointer"
                    >
                      -
                    </button>
                    <span className="font-black text-base text-[#1a237e] min-w-[28px] text-center">
                      {directOrderQty}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDirectOrderQty((q) => q + 1)}
                      className="w-8 h-8 rounded-lg bg-emerald-600 text-white font-black text-sm hover:bg-emerald-700 transition cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                  <div className="text-xs font-black text-slate-900">
                    الإجمالي: {total.toFixed(2)} {currency}
                  </div>
                </div>

                {/* Customer Details Form */}
                <div className="space-y-2.5 pt-1">
                  <div className="font-bold text-xs text-slate-800 border-b border-slate-200 pb-1 flex items-center gap-1">
                    <span>👤</span>
                    <span>بيانات المستلم والتوصيل:</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        الاسم بالكامل <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={directOrderClientName}
                        onChange={(e) => setDirectOrderClientName(e.target.value)}
                        placeholder="اسم العميل أو المحل"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        رقم الهاتف / الواتساب <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={directOrderClientPhone}
                        onChange={(e) => setDirectOrderClientPhone(e.target.value)}
                        placeholder="مثال: 01012345678"
                        dir="ltr"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden text-right"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      عنوان التسليم أو المحافظة
                    </label>
                    <input
                      type="text"
                      value={directOrderAddress}
                      onChange={(e) => setDirectOrderAddress(e.target.value)}
                      placeholder="العنوان أو المكان المراد التوصيل إليه"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      ملاحظات خاصة على الخامة أو المقاس
                    </label>
                    <input
                      type="text"
                      value={directOrderNotes}
                      onChange={(e) => setDirectOrderNotes(e.target.value)}
                      placeholder="أي تفاصيل خاصة بالمقاس أو اللون أو موعد الشحن..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Notice that order will be dispatched to this specific vendor */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-[11px] text-emerald-900 flex items-center gap-2">
                  <span>ℹ️</span>
                  <span>
                    سيتم تسجيل هذه الفاتورة مباشرة في حساب شركة (<strong>{vendor.tradeName || vendor.name}</strong>) وفتح محادثة واتساب معها لإتمام التجهيز.
                  </span>
                </div>

                {/* Footer Buttons */}
                <div className="flex gap-2.5 pt-2">
                  <button
                    type="submit"
                    disabled={isSubmittingDirectOrder}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-xs sm:text-sm py-3 px-4 rounded-xl transition cursor-pointer shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <span>💬</span>
                    <span>{isSubmittingDirectOrder ? 'جاري تسجيل الطلب...' : 'إرسال الفاتورة والرسالة للتاجر عبر الواتساب'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirectOrderModalItem(null)}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs py-3 px-4 rounded-xl transition cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
