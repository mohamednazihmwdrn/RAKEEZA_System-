import React, { useState, useMemo } from 'react';
import { AppData, Item, TenantCompany } from '../types';
import { addAuditLog } from '../utils/storage';
import { DEFAULT_COMPANIES } from '../utils/multiTenantService';

interface CatalogManagerViewProps {
  appData: AppData;
  onUpdateData: (newData: AppData) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onPreviewStore: (companyId?: string) => void;
  onShareCatalog: (companyId?: string) => void;
}

export const CatalogManagerView: React.FC<CatalogManagerViewProps> = ({
  appData,
  onUpdateData,
  showToast,
  onPreviewStore,
  onShareCatalog,
}) => {
  // Companies list
  const companies: TenantCompany[] = useMemo(() => {
    return appData.companies && appData.companies.length > 0 ? appData.companies : DEFAULT_COMPANIES;
  }, [appData.companies]);

  const currentUser = useMemo(() => {
    return appData.users.find((u) => u.id === appData.currentUser) || appData.users[0];
  }, [appData.users, appData.currentUser]);

  const isOwner = currentUser?.role === 'owner' || appData.isOwnerAuthenticated;
  const userCompanyId = currentUser?.companyId || appData.companyId || companies[0]?.id || 'COMP-000001';

  // Current Company Selection for Data Isolation (Locked for non-owners)
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(() => {
    if (!isOwner) return userCompanyId;
    return appData.companyId || appData.settings.companyId || companies[0]?.id || 'COMP-000001';
  });

  const activeCompany = useMemo(() => {
    return companies.find((c) => c.id === selectedCompanyId) || companies[0];
  }, [companies, selectedCompanyId]);

  // Search and Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'unpublished' | 'discounted' | 'featured'>(
    'all'
  );

  // New Item Quick Form Modal
  const [isNewItemModalOpen, setIsNewItemModalOpen] = useState(false);
  const [newItemForm, setNewItemForm] = useState<{
    name: string;
    category: string;
    unit: string;
    quantity: number;
    purchasePrice: number;
    salePrice: number;
    catalogPrice: number;
    catalogDiscountPrice: number;
    catalogWholesalePrice: number;
    catalogBadge: string;
    catalogFeatured: boolean;
    catalogDescription: string;
    imageUrl: string;
  }>({
    name: '',
    category: 'إلكترونيات',
    unit: 'قطعة',
    quantity: 10,
    purchasePrice: 100,
    salePrice: 150,
    catalogPrice: 150,
    catalogDiscountPrice: 0,
    catalogWholesalePrice: 130,
    catalogBadge: '',
    catalogFeatured: false,
    catalogDescription: '',
    imageUrl: '',
  });

  // Bulk Discount Modal State
  const [isBulkDiscountModalOpen, setIsBulkDiscountModalOpen] = useState(false);
  const [bulkDiscountPercent, setBulkDiscountPercent] = useState<number>(10);

  // Filter items isolated by company strictly
  const companyItems = useMemo(() => {
    return appData.items.filter((item) => {
      // If item has companyId, must strictly match selectedCompanyId
      if (item.companyId) {
        return item.companyId === selectedCompanyId;
      }
      // If item has no companyId, associate strictly with default primary company
      return selectedCompanyId === companies[0]?.id || selectedCompanyId === 'COMP-000001';
    });
  }, [appData.items, selectedCompanyId, companies]);

  // Extract categories for filter
  const categories = useMemo(() => {
    const cats = new Set<string>();
    companyItems.forEach((it) => {
      if (it.category) cats.add(it.category);
    });
    return Array.from(cats);
  }, [companyItems]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return companyItems.filter((item) => {
      // Text search
      const q = searchTerm.toLowerCase().trim();
      if (q) {
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesCode = item.code?.toLowerCase().includes(q) || false;
        const matchesBarcode = item.barcode?.toLowerCase().includes(q) || false;
        const matchesCat = item.category?.toLowerCase().includes(q) || false;
        if (!matchesName && !matchesCode && !matchesBarcode && !matchesCat) return false;
      }

      // Category filter
      if (categoryFilter !== 'all' && item.category !== categoryFilter) {
        return false;
      }

      // Status filter
      if (statusFilter === 'published' && item.showInCatalog === false) {
        return false;
      }
      if (statusFilter === 'unpublished' && item.showInCatalog !== false) {
        return false;
      }
      if (statusFilter === 'discounted' && (!item.catalogDiscountPrice || item.catalogDiscountPrice <= 0)) {
        return false;
      }
      if (statusFilter === 'featured' && !item.catalogFeatured) {
        return false;
      }

      return true;
    });
  }, [companyItems, searchTerm, categoryFilter, statusFilter]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const published = companyItems.filter((it) => it.showInCatalog !== false);
    const discounted = companyItems.filter((it) => (it.catalogDiscountPrice || 0) > 0);
    const featured = companyItems.filter((it) => it.catalogFeatured);
    const outOfStock = companyItems.filter((it) => (it.quantity || 0) <= 0);

    return {
      totalItems: companyItems.length,
      publishedCount: published.length,
      discountedCount: discounted.length,
      featuredCount: featured.length,
      outOfStockCount: outOfStock.length,
    };
  }, [companyItems]);

  // Handlers for individual item update
  const handleUpdateItemField = (
    itemId: string,
    field: keyof Item,
    value: any
  ) => {
    const updatedItems = appData.items.map((it) => {
      if (it.id === itemId) {
        return {
          ...it,
          companyId: it.companyId || selectedCompanyId,
          [field]: value,
        };
      }
      return it;
    });

    const updatedData: AppData = {
      ...appData,
      items: updatedItems,
    };
    onUpdateData(updatedData);
  };

  // Toggle publish status
  const handleTogglePublish = (item: Item) => {
    const nextState = item.showInCatalog === false ? true : false;
    handleUpdateItemField(item.id, 'showInCatalog', nextState);
    showToast(
      nextState
        ? `تم نشر "${item.name}" على متجر الويب سايت`
        : `تم إخفاء "${item.name}" من متجر الويب سايت`,
      nextState ? 'success' : 'info'
    );
  };

  // Helper to check if an item belongs to selectedCompanyId
  const doesItemBelongToSelected = (it: Item) => {
    if (it.companyId) return it.companyId === selectedCompanyId;
    return selectedCompanyId === companies[0]?.id || selectedCompanyId === 'COMP-000001';
  };

  // Bulk publish all in-stock items
  const handleBulkPublishInStock = () => {
    const updatedItems = appData.items.map((it) => {
      if (doesItemBelongToSelected(it) && (it.quantity || 0) > 0) {
        return {
          ...it,
          companyId: selectedCompanyId,
          showInCatalog: true,
          catalogPrice: it.catalogPrice || it.salePrice,
        };
      }
      return it;
    });

    let updatedData = { ...appData, items: updatedItems };
    updatedData = addAuditLog(
      updatedData,
      'update',
      'إدارة كتالوج الويب سايت',
      `نشر جميع الأصناف المتوفرة لشركة (${activeCompany.name}) على المتجر الإلكتروني`
    );
    onUpdateData(updatedData);
    showToast(`✅ تم نشر جميع الأصناف المتوفرة في المخزن على متجر الويب سايت لشركة ${activeCompany.name} بنجاح`, 'success');
  };

  // Bulk unpublish all items
  const handleBulkUnpublishAll = () => {
    if (!window.confirm(`هل أنت متأكد من إخفاء جميع الأصناف من متجر الويب سايت لشركة (${activeCompany.name})؟`)) return;

    const updatedItems = appData.items.map((it) => {
      if (doesItemBelongToSelected(it)) {
        return {
          ...it,
          companyId: selectedCompanyId,
          showInCatalog: false,
        };
      }
      return it;
    });

    onUpdateData({ ...appData, items: updatedItems });
    showToast(`تم إخفاء جميع الأصناف من متجر الويب سايت لشركة ${activeCompany.name}`, 'info');
  };

  // Apply Bulk Discount
  const handleApplyBulkDiscount = () => {
    if (bulkDiscountPercent <= 0 || bulkDiscountPercent >= 90) {
      showToast('يرجى تحديد نسبة خصم صالحة بين 1% و 90%', 'warning');
      return;
    }

    const ratio = (100 - bulkDiscountPercent) / 100;
    const updatedItems = appData.items.map((it) => {
      if (doesItemBelongToSelected(it) && it.showInCatalog !== false) {
        const basePrice = it.catalogPrice || it.salePrice || 100;
        const discountPrice = Math.round(basePrice * ratio * 100) / 100;
        return {
          ...it,
          companyId: selectedCompanyId,
          catalogPrice: basePrice,
          catalogDiscountPrice: discountPrice,
          catalogBadge: `خصم ${bulkDiscountPercent}%`,
        };
      }
      return it;
    });

    let updatedData = { ...appData, items: updatedItems };
    updatedData = addAuditLog(
      updatedData,
      'update',
      'إدارة كتالوج الويب سايت',
      `تطبيق خصم ترويجي ${bulkDiscountPercent}% على أسعار الويب سايت لشركة (${activeCompany.name})`
    );
    onUpdateData(updatedData);
    setIsBulkDiscountModalOpen(false);
    showToast(`🎉 تم تطبيق خصم ${bulkDiscountPercent}% وتوليد شارات العروض لشركة ${activeCompany.name} بنجاح!`, 'success');
  };

  // Remove all discounts
  const handleClearDiscounts = () => {
    const updatedItems = appData.items.map((it) => {
      if (doesItemBelongToSelected(it)) {
        return {
          ...it,
          companyId: selectedCompanyId,
          catalogDiscountPrice: 0,
          catalogBadge: undefined,
        };
      }
      return it;
    });
    onUpdateData({ ...appData, items: updatedItems });
    showToast(`تمت إزالة جميع الخصومات الإضافية من متجر شركة ${activeCompany.name}`, 'info');
  };

  // Create new product directly
  const handleCreateNewProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemForm.name.trim()) {
      showToast('يرجى كتابة اسم المنتج', 'warning');
      return;
    }

    const newItemId = `item-${Date.now()}`;
    const newItemCode = `PRD-${Math.floor(1000 + Math.random() * 9000)}`;

    const newItem: Item = {
      id: newItemId,
      code: newItemCode,
      name: newItemForm.name.trim(),
      category: newItemForm.category.trim() || 'عام',
      unit: newItemForm.unit.trim() || 'قطعة',
      quantity: Number(newItemForm.quantity) || 0,
      purchasePrice: Number(newItemForm.purchasePrice) || 0,
      salePrice: Number(newItemForm.salePrice) || 0,
      wholesalePrice: Number(newItemForm.catalogWholesalePrice) || Number(newItemForm.salePrice) || 0,
      normalSellingPrice: Number(newItemForm.salePrice) || 0,
      wholesaleSellingPrice: Number(newItemForm.catalogWholesalePrice) || Number(newItemForm.salePrice) || 0,
      showInCatalog: true,
      catalogPrice: Number(newItemForm.catalogPrice) || Number(newItemForm.salePrice) || 0,
      catalogDiscountPrice: Number(newItemForm.catalogDiscountPrice) || 0,
      catalogWholesalePrice: Number(newItemForm.catalogWholesalePrice) || 0,
      catalogBadge: newItemForm.catalogBadge.trim() || undefined,
      catalogFeatured: newItemForm.catalogFeatured,
      catalogDescription: newItemForm.catalogDescription.trim() || undefined,
      imageUrl: newItemForm.imageUrl.trim() || undefined,
      companyId: selectedCompanyId,
    };

    let updatedData = {
      ...appData,
      items: [newItem, ...appData.items],
    };

    updatedData = addAuditLog(
      updatedData,
      'create',
      'إدارة كتالوج الويب سايت',
      `إضافة الصنف الجديد "${newItem.name}" بسعر ويب سايت ${newItem.catalogPrice} لشركة (${activeCompany.name})`
    );

    onUpdateData(updatedData);
    setIsNewItemModalOpen(false);
    setNewItemForm({
      name: '',
      category: 'إلكترونيات',
      unit: 'قطعة',
      quantity: 10,
      purchasePrice: 100,
      salePrice: 150,
      catalogPrice: 150,
      catalogDiscountPrice: 0,
      catalogWholesalePrice: 130,
      catalogBadge: '',
      catalogFeatured: false,
      catalogDescription: '',
      imageUrl: '',
    });
    showToast(`🎉 تمت إضافة الصنف "${newItem.name}" ونشره على الويب سايت بنجاح!`, 'success');
  };

  return (
    <div className="space-y-5 pb-16" dir="rtl">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 md:p-7 rounded-3xl shadow-md border border-indigo-900/60 relative overflow-hidden">
        <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-amber-400 text-slate-950 text-xs font-black px-3 py-1 rounded-lg">
                🛍️ متجر الويب سايت والكتالوج B2B / B2C
              </span>
              <span className="bg-white/10 text-slate-200 text-xs px-2.5 py-1 rounded-lg border border-white/10">
                🔒 عزل كامل لبيانات وأسعار كل شركة
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-white">
              إدارة المنتجات وأسعار الويب سايت (Catalog Product Manager)
            </h2>
            <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
              تحكم بدقة في المنتجات التي تظهر لعملائك على الويب سايت، وحدد أسعار بيع خاصة بالمتجر الإلكتروني
              أو عروض وخصومات ترويجية، مع عزل تام يضمن استقلالية كل شركة بكتالوجها وأسعارها.
            </p>
          </div>

          {/* Company Selector Box */}
          <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/20 flex flex-col gap-2 min-w-[280px]">
            <div className="flex items-center justify-between text-xs text-amber-300 font-bold">
              <span>🏢 الشركة الحالية المدارة:</span>
              <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded text-[10px] border border-emerald-500/30">
                {activeCompany.code || activeCompany.id}
              </span>
            </div>

            {!isOwner ? (
              <div className="bg-slate-900/90 text-white font-black text-sm p-3 rounded-xl border border-slate-700 flex items-center justify-between">
                <span>{activeCompany.name}</span>
                <span className="text-[11px] text-emerald-400 font-bold">🔒 بياناتك معزولة ومحمية</span>
              </div>
            ) : (
              <select
                value={selectedCompanyId}
                onChange={(e) => {
                  setSelectedCompanyId(e.target.value);
                  showToast(`تم التبديل إلى كتالوج شركة: ${companies.find((c) => c.id === e.target.value)?.name}`, 'info');
                }}
                className="bg-slate-900/90 text-white font-black text-sm p-2.5 rounded-xl border border-slate-700 focus:ring-2 focus:ring-amber-400 focus:outline-none cursor-pointer"
              >
                {companies.map((comp) => (
                  <option key={comp.id} value={comp.id} className="bg-slate-900 text-white">
                    {comp.name} ({comp.code || comp.id})
                  </option>
                ))}
              </select>
            )}

            <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-slate-300">
              <span>رابط متجر هذه الشركة:</span>
              <span className="font-mono text-amber-300 font-bold">?company={activeCompany.code || activeCompany.id}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-bold mb-1">إجمالي أصناف الشركة</div>
          <div className="text-2xl font-black text-slate-900">{metrics.totalItems}</div>
          <div className="text-[11px] text-slate-400 mt-1">منتج مسجل في النظام</div>
        </div>

        <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 shadow-xs">
          <div className="text-xs text-emerald-700 font-bold mb-1">معروض على الويب سايت</div>
          <div className="text-2xl font-black text-emerald-700">{metrics.publishedCount}</div>
          <div className="text-[11px] text-emerald-600 mt-1">يظهر للعملاء للشراء</div>
        </div>

        <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 shadow-xs">
          <div className="text-xs text-amber-800 font-bold mb-1">عروض وخصومات خاصة</div>
          <div className="text-2xl font-black text-amber-800">{metrics.discountedCount}</div>
          <div className="text-[11px] text-amber-600 mt-1">بأسعار ترويجية مخفضة</div>
        </div>

        <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-200 shadow-xs">
          <div className="text-xs text-indigo-800 font-bold mb-1">منتجات مميزة (Featured)</div>
          <div className="text-2xl font-black text-indigo-800">{metrics.featuredCount}</div>
          <div className="text-[11px] text-indigo-600 mt-1">في صدر الكتالوج</div>
        </div>

        <div className="bg-rose-50 p-4 rounded-2xl border border-rose-200 shadow-xs">
          <div className="text-xs text-rose-700 font-bold mb-1">أصناف نفدت كميتها</div>
          <div className="text-2xl font-black text-rose-700">{metrics.outOfStockCount}</div>
          <div className="text-[11px] text-rose-600 mt-1">رصيدها في المخزن صفر</div>
        </div>
      </div>

      {/* Action Bar & Quick Operations */}
      <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsNewItemModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-black px-4 py-2.5 rounded-xl text-xs md:text-sm transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <span>➕</span>
              <span>إضافة منتج جديد للكتالوج</span>
            </button>

            <button
              type="button"
              onClick={handleBulkPublishInStock}
              className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold px-3.5 py-2.5 rounded-xl text-xs md:text-sm transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="تفعيل خيار العرض لجميع الأصناف التي تحتوي على رصيد موجب"
            >
              <span>⚡</span>
              <span>نشر المتوفر تلقائياً</span>
            </button>

            <button
              type="button"
              onClick={() => setIsBulkDiscountModalOpen(true)}
              className="bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-black px-3.5 py-2.5 rounded-xl text-xs md:text-sm transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span>🏷️</span>
              <span>تطبيق خصم جماعي %</span>
            </button>

            {metrics.discountedCount > 0 && (
              <button
                type="button"
                onClick={handleClearDiscounts}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2.5 rounded-xl text-xs transition cursor-pointer"
              >
                إلغاء الخصومات
              </button>
            )}

            <button
              type="button"
              onClick={handleBulkUnpublishAll}
              className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold px-3 py-2.5 rounded-xl text-xs transition border border-rose-200 cursor-pointer"
            >
              إخفاء الكل
            </button>
          </div>

          {/* Storefront preview and QR buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPreviewStore(activeCompany.id)}
              className="bg-slate-900 hover:bg-slate-800 text-white font-black px-4 py-2.5 rounded-xl text-xs md:text-sm transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span>👁️</span>
              <span>معاينة متجر الشركة</span>
            </button>

            <button
              type="button"
              onClick={() => onShareCatalog(activeCompany.id)}
              className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs md:text-sm transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span>📱</span>
              <span>مشاركة الرابط والـ QR</span>
            </button>
          </div>
        </div>

        {/* Search and Filters Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">البحث بالاسم أو الكود أو الباركود:</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث عن منتج..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs md:text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">تصفية حسب التصنيف:</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs md:text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="all">جميع التصنيفات ({companyItems.length})</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">حالة العرض بالمتجر:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs md:text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="all">جميع الأصناف</option>
              <option value="published">المعروضة على الويب سايت فقط</option>
              <option value="unpublished">المخفية من الويب سايت</option>
              <option value="discounted">عليها عروض وخصومات</option>
              <option value="featured">منتجات مميزة (Featured)</option>
            </select>
          </div>

          <div className="flex items-end">
            <div className="w-full bg-indigo-50/70 border border-indigo-200 rounded-xl px-3 py-2 text-xs text-indigo-900 flex items-center justify-between">
              <span>النتائج المعروضة:</span>
              <strong className="text-sm font-black text-indigo-700">{filteredItems.length} منتج</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Items Management Section */}
      {/* Mobile Responsive Cards (< md) */}
      <div className="block md:hidden space-y-3">
        {filteredItems.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
            <div className="text-4xl mb-2">🛍️</div>
            <div className="font-bold text-slate-700">لا توجد منتجات مطابقة لخيارات البحث أو التصفية</div>
            <p className="text-xs text-slate-400 mt-1">
              يمكنك تعديل البحث أو الضغط على "إضافة منتج جديد للكتالوج" لإدراج أصناف جديدة.
            </p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isPublished = item.showInCatalog !== false;
            const isDiscounted = (item.catalogDiscountPrice || 0) > 0;
            const currentCatalogPrice =
              item.catalogPrice !== undefined ? item.catalogPrice : item.salePrice;

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3 transition ${
                  !isPublished ? 'opacity-70 bg-slate-50/60' : ''
                }`}
              >
                {/* Header: Image, Name, Category, Featured Star */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xl overflow-hidden shrink-0">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        '📦'
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-black text-slate-900 text-sm truncate flex items-center gap-1.5">
                        <span className="truncate">{item.name}</span>
                        {item.catalogBadge && (
                          <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-1.5 py-0.5 rounded shrink-0">
                            {item.catalogBadge}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span>{item.category || 'عام'}</span>
                        <span>•</span>
                        <span className="font-mono">{item.code || '-'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleUpdateItemField(item.id, 'catalogFeatured', !item.catalogFeatured)}
                      className={`text-2xl transition cursor-pointer p-1 rounded-lg ${
                        item.catalogFeatured ? 'text-amber-500 scale-110' : 'text-slate-300 hover:text-amber-400'
                      }`}
                      title={item.catalogFeatured ? 'منتج مميز' : 'تمييز المنتج'}
                    >
                      ★
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTogglePublish(item)}
                      className={`min-h-[38px] px-3 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                        isPublished ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {isPublished ? '✅ معروض' : '🚫 مخفي'}
                    </button>
                  </div>
                </div>

                {/* Stock & Retail Info */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 block">المخزون الحالي:</span>
                    <span
                      className={`font-black text-xs px-2 py-0.5 rounded-md inline-block mt-0.5 ${
                        (item.quantity || 0) > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {item.quantity || 0} {item.unit || 'قطعة'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">سعر المحل (ERP):</span>
                    <span className="font-bold text-slate-700 text-xs block mt-0.5">
                      {Number(item.salePrice || 0).toFixed(2)} ج.م
                    </span>
                  </div>
                </div>

                {/* Price Inputs Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-amber-50/60 p-2 rounded-xl border border-amber-200">
                    <label className="block text-[10px] font-bold text-amber-900 mb-1">
                      سعر الويب سايت (ج.م)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={currentCatalogPrice}
                      onChange={(e) =>
                        handleUpdateItemField(item.id, 'catalogPrice', parseFloat(e.target.value) || 0)
                      }
                      className="w-full text-center font-black bg-white border border-amber-300 rounded-lg p-1.5 text-xs text-amber-950 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  <div className="bg-rose-50/60 p-2 rounded-xl border border-rose-200">
                    <label className="block text-[10px] font-bold text-rose-900 mb-1">
                      سعر العرض/الخصم
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={item.catalogDiscountPrice || ''}
                      onChange={(e) =>
                        handleUpdateItemField(item.id, 'catalogDiscountPrice', parseFloat(e.target.value) || 0)
                      }
                      className="w-full text-center font-black bg-white border border-rose-300 rounded-lg p-1.5 text-xs text-rose-950 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                      placeholder="0 (بدون خصم)"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      سعر الجملة للكتالوج
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={item.catalogWholesalePrice || item.wholesalePrice || ''}
                      onChange={(e) =>
                        handleUpdateItemField(item.id, 'catalogWholesalePrice', parseFloat(e.target.value) || 0)
                      }
                      className="w-full text-center font-bold bg-white border border-slate-300 rounded-lg p-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      شارة العرض (Badge)
                    </label>
                    <input
                      type="text"
                      value={item.catalogBadge || ''}
                      onChange={(e) => handleUpdateItemField(item.id, 'catalogBadge', e.target.value)}
                      className="w-full text-center text-xs bg-white border border-slate-300 rounded-lg p-1.5 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      placeholder="مثال: خصم خاص"
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Items Management Table (>= md) */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs md:text-sm border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-black border-b border-slate-200 select-none">
              <tr>
                <th className="p-3 text-center w-16">عرض بالمتجر</th>
                <th className="p-3 min-w-[200px]">المنتج والتصنيف</th>
                <th className="p-3 text-center min-w-[90px]">المخزون الحالي</th>
                <th className="p-3 text-center min-w-[100px]">سعر المحل (ERP)</th>
                <th className="p-3 text-center min-w-[130px] bg-amber-50 text-amber-900">
                  سعر الويب سايت (ج.م)
                </th>
                <th className="p-3 text-center min-w-[120px] bg-rose-50 text-rose-900">
                  سعر العرض/الخصم
                </th>
                <th className="p-3 text-center min-w-[120px]">سعر الجملة للكتالوج</th>
                <th className="p-3 text-center min-w-[110px]">شارة العرض (Badge)</th>
                <th className="p-3 text-center w-20">مميز</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-slate-500">
                    <div className="text-4xl mb-2">🛍️</div>
                    <div className="font-bold text-slate-700">لا توجد منتجات مطابقة لخيارات البحث أو التصفية</div>
                    <p className="text-xs text-slate-400 mt-1">
                      يمكنك تعديل البحث أو الضغط على "إضافة منتج جديد للكتالوج" لإدراج أصناف جديدة لشركة{' '}
                      <strong>{activeCompany.name}</strong>.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isPublished = item.showInCatalog !== false;
                  const isDiscounted = (item.catalogDiscountPrice || 0) > 0;
                  const currentCatalogPrice =
                    item.catalogPrice !== undefined ? item.catalogPrice : item.salePrice;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/80 transition ${
                        !isPublished ? 'opacity-60 bg-slate-50/40' : ''
                      }`}
                    >
                      {/* Publish Toggle Switch */}
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleTogglePublish(item)}
                          className={`w-11 h-6 flex items-center rounded-full p-1 transition cursor-pointer mx-auto ${
                            isPublished ? 'bg-emerald-500 justify-end' : 'bg-slate-300 justify-start'
                          }`}
                          title={isPublished ? 'معروض على الويب سايت (اضغط للإخفاء)' : 'مخفي (اضغط للنشر)'}
                        >
                          <div className="bg-white w-4 h-4 rounded-full shadow-xs transition" />
                        </button>
                        <span className="text-[10px] font-bold block mt-1 text-slate-500">
                          {isPublished ? 'معروض' : 'مخفي'}
                        </span>
                      </td>

                      {/* Product Name & Meta */}
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-lg overflow-hidden shrink-0">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              '📦'
                            )}
                          </div>
                          <div>
                            <div className="font-black text-slate-900 flex items-center gap-1.5">
                              <span>{item.name}</span>
                              {item.catalogFeatured && (
                                <span className="bg-indigo-100 text-indigo-700 text-[10px] font-black px-1.5 py-0.5 rounded">
                                  🌟 مميز
                                </span>
                              )}
                              {item.catalogBadge && (
                                <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-1.5 py-0.5 rounded">
                                  {item.catalogBadge}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                              <span>كود: {item.code || '-'}</span>
                              <span>•</span>
                              <span>تصنيف: {item.category || 'عام'}</span>
                              <span>•</span>
                              <span>وحدة: {item.unit || 'قطعة'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Stock Quantity */}
                      <td className="p-3 text-center">
                        <span
                          className={`font-black text-xs px-2.5 py-1 rounded-lg ${
                            (item.quantity || 0) > 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {item.quantity || 0} {item.unit || ''}
                        </span>
                      </td>

                      {/* ERP Standard Retail Price */}
                      <td className="p-3 text-center text-slate-600 font-bold">
                        {Number(item.salePrice || 0).toFixed(2)}
                      </td>

                      {/* Dedicated Website Catalog Price (Inline Edit) */}
                      <td className="p-3 text-center bg-amber-50/40">
                        <div className="relative inline-block w-28">
                          <input
                            type="number"
                            step="0.5"
                            value={currentCatalogPrice}
                            onChange={(e) =>
                              handleUpdateItemField(item.id, 'catalogPrice', parseFloat(e.target.value) || 0)
                            }
                            className="w-full text-center font-black bg-white border border-amber-300 rounded-lg px-2 py-1.5 text-xs text-amber-950 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                            placeholder="سعر المتجر"
                          />
                        </div>
                      </td>

                      {/* Discount Price (Inline Edit) */}
                      <td className="p-3 text-center bg-rose-50/40">
                        <div className="relative inline-block w-28">
                          <input
                            type="number"
                            step="0.5"
                            value={item.catalogDiscountPrice || ''}
                            onChange={(e) =>
                              handleUpdateItemField(
                                item.id,
                                'catalogDiscountPrice',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className={`w-full text-center font-black bg-white border rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none ${
                              isDiscounted ? 'border-rose-400 text-rose-700 bg-rose-50/30' : 'border-slate-300 text-slate-500'
                            }`}
                            placeholder="0 (لا يوجد خصم)"
                          />
                        </div>
                      </td>

                      {/* Catalog Wholesale Price (Inline Edit) */}
                      <td className="p-3 text-center">
                        <div className="relative inline-block w-28">
                          <input
                            type="number"
                            step="0.5"
                            value={item.catalogWholesalePrice || item.wholesalePrice || ''}
                            onChange={(e) =>
                              handleUpdateItemField(
                                item.id,
                                'catalogWholesalePrice',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-full text-center font-bold bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            placeholder="سعر الجملة"
                          />
                        </div>
                      </td>

                      {/* Badge / Label (Inline Edit) */}
                      <td className="p-3 text-center">
                        <input
                          type="text"
                          value={item.catalogBadge || ''}
                          onChange={(e) => handleUpdateItemField(item.id, 'catalogBadge', e.target.value)}
                          className="w-28 text-center text-xs bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          placeholder="مثال: جديد"
                        />
                      </td>

                      {/* Featured Star Toggle */}
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleUpdateItemField(item.id, 'catalogFeatured', !item.catalogFeatured)}
                          className={`text-xl transition cursor-pointer p-1 rounded-lg ${
                            item.catalogFeatured ? 'text-amber-500 scale-110' : 'text-slate-300 hover:text-amber-400'
                          }`}
                          title={item.catalogFeatured ? 'منتج مميز (اضغط لإلغاء التمييز)' : 'اضغط لتمييز المنتج في الكتالوج'}
                        >
                          ★
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add New Product directly for Company */}
      {isNewItemModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <span>➕</span> إضافة منتج جديد لكتالوج شركة {activeCompany.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  سيتم تسجيل المنتج في قاعدة بيانات الشركة وعرضه على الويب سايت بالأسعار المحددة.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewItemModalOpen(false)}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-black cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateNewProduct} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم المنتج *</label>
                  <input
                    type="text"
                    required
                    value={newItemForm.name}
                    onChange={(e) => setNewItemForm({ ...newItemForm, name: e.target.value })}
                    placeholder="مثال: شاحن أنكر سريع 20 واط Type-C"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">التصنيف / القسم</label>
                  <input
                    type="text"
                    value={newItemForm.category}
                    onChange={(e) => setNewItemForm({ ...newItemForm, category: e.target.value })}
                    placeholder="مثال: إلكترونيات"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">وحدة القياس</label>
                  <input
                    type="text"
                    value={newItemForm.unit}
                    onChange={(e) => setNewItemForm({ ...newItemForm, unit: e.target.value })}
                    placeholder="قطعة / كرتونة / طقم"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الرصيد الافتتاحي في المخزن</label>
                  <input
                    type="number"
                    value={newItemForm.quantity}
                    onChange={(e) => setNewItemForm({ ...newItemForm, quantity: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">سعر الشراء والتكلفة (ج.م)</label>
                  <input
                    type="number"
                    value={newItemForm.purchasePrice}
                    onChange={(e) =>
                      setNewItemForm({ ...newItemForm, purchasePrice: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Dedicated Website Pricing Section */}
              <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200 space-y-3">
                <h4 className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                  <span>🛍️</span> تسعير المنتج المخصص لمتجر الويب سايت:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-amber-950 mb-1">
                      سعر البيع على الويب سايت *
                    </label>
                    <input
                      type="number"
                      required
                      value={newItemForm.catalogPrice}
                      onChange={(e) =>
                        setNewItemForm({
                          ...newItemForm,
                          catalogPrice: parseFloat(e.target.value) || 0,
                          salePrice: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-sm font-black text-amber-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-rose-900 mb-1">
                      سعر العرض المخفض (اختياري)
                    </label>
                    <input
                      type="number"
                      value={newItemForm.catalogDiscountPrice || ''}
                      onChange={(e) =>
                        setNewItemForm({
                          ...newItemForm,
                          catalogDiscountPrice: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="0 (بدون خصم)"
                      className="w-full bg-white border border-rose-300 rounded-xl px-3 py-2 text-sm font-black text-rose-700 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-800 mb-1">سعر الجملة للكتالوج</label>
                    <input
                      type="number"
                      value={newItemForm.catalogWholesalePrice || ''}
                      onChange={(e) =>
                        setNewItemForm({
                          ...newItemForm,
                          catalogWholesalePrice: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">شارة المنتج الترويجية</label>
                    <input
                      type="text"
                      value={newItemForm.catalogBadge}
                      onChange={(e) => setNewItemForm({ ...newItemForm, catalogBadge: e.target.value })}
                      placeholder="مثال: الأكثر طلباً / جديد / عرض الأسبوع"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">رابط صورة المنتج (URL)</label>
                    <input
                      type="url"
                      value={newItemForm.imageUrl}
                      onChange={(e) => setNewItemForm({ ...newItemForm, imageUrl: e.target.value })}
                      placeholder="https://..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="featuredCheckbox"
                    checked={newItemForm.catalogFeatured}
                    onChange={(e) => setNewItemForm({ ...newItemForm, catalogFeatured: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                  />
                  <label htmlFor="featuredCheckbox" className="text-xs font-bold text-slate-800 cursor-pointer">
                    تمييز المنتج ليظهر في صدر صفحة المتجر (🌟 Featured Product)
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">وصف تسويقي للمنتج للعملاء</label>
                <textarea
                  rows={2}
                  value={newItemForm.catalogDescription}
                  onChange={(e) => setNewItemForm({ ...newItemForm, catalogDescription: e.target.value })}
                  placeholder="مواصفات المنتج ومميزاته التي تظهر للعميل في الكتالوج..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewItemModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-black px-6 py-2.5 rounded-xl text-xs md:text-sm transition shadow-xs cursor-pointer"
                >
                  حفظ ونشر على الويب سايت
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Bulk Discount */}
      {isBulkDiscountModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span>🏷️</span> تطبيق خصم ترويجي بالنسبة المئوية
              </h3>
              <button
                type="button"
                onClick={() => setIsBulkDiscountModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              سيتم احتساب سعر الخصم التلقائي لجميع منتجات الويب سايت المنشورة لشركة{' '}
              <strong>{activeCompany.name}</strong> وتوليد شارة <strong>خصم {bulkDiscountPercent}%</strong>.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">نسبة الخصم المطلوبة (%):</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="5"
                  max="70"
                  step="5"
                  value={bulkDiscountPercent}
                  onChange={(e) => setBulkDiscountPercent(parseInt(e.target.value, 10))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <span className="font-black text-lg text-amber-700 min-w-[50px] text-center">
                  {bulkDiscountPercent}%
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsBulkDiscountModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleApplyBulkDiscount}
                className="bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs md:text-sm transition shadow-xs cursor-pointer"
              >
                تطبيق الخصم فوراً
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
