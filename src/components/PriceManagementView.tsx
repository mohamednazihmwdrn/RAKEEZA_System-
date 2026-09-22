import React, { useState, useMemo } from 'react';
import { AppData, Item, ProductPrice, PriceHistoryRecord } from '../types';
import { Modal } from './Modal';
import { openUnifiedPrintWindow } from '../utils/printUnified';
import { exportToExcel } from '../utils/excelExport';
import { TableActionButtons } from './TableActionButtons';
import {
  calculateProfitMargin,
  updateProductPrice,
  applyBulkPriceAdjustments,
  BulkAdjustmentType,
  ensureProductPricesSynced,
} from '../utils/priceService';

interface PriceManagementViewProps {
  appData: AppData;
  onUpdateData: (newData: AppData) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const PriceManagementView: React.FC<PriceManagementViewProps> = ({
  appData,
  onUpdateData,
  showToast,
}) => {
  // Ensure sync
  const syncedData = useMemo(() => ensureProductPricesSynced(appData), [appData]);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'list' | 'bulk' | 'history' | 'import_export'>('list');

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'complete' | 'missing_cash' | 'missing_wholesale' | 'no_prices'>('all');

  // Selected Products for Bulk operations
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // Single Item Edit Modal
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [modalNormalPrice, setModalNormalPrice] = useState<string>('');
  const [modalWholesalePrice, setModalWholesalePrice] = useState<string>('');
  const [modalReason, setModalReason] = useState<string>('');

  // Single Item History Modal
  const [historyItem, setHistoryItem] = useState<Item | null>(null);

  // Bulk Operations State
  const [bulkAdjustmentType, setBulkAdjustmentType] = useState<BulkAdjustmentType>('increase_both_pct');
  const [bulkValue, setBulkValue] = useState<string>('10');
  const [bulkSecondaryValue, setBulkSecondaryValue] = useState<string>('15');
  const [bulkReason, setBulkReason] = useState<string>('');
  const [showBulkConfirmModal, setShowBulkConfirmModal] = useState(false);

  // History Filter
  const [historySearch, setHistorySearch] = useState('');
  const [historyDateFilter, setHistoryDateFilter] = useState('');

  // Import State
  const [importJsonText, setImportJsonText] = useState('');

  // Current logged in user
  const currentUserObj = appData.users.find((u) => u.id === appData.currentUser) || appData.users[0];
  const currentUserName = currentUserObj?.name || 'مدير النظام';

  // Permission checks
  const canEditPrices = currentUserObj?.role === 'admin' || currentUserObj?.permissions?.all || currentUserObj?.permissions?.prices !== false;
  const canEditCash = canEditPrices && (currentUserObj?.role === 'admin' || currentUserObj?.permissions?.editCashPrices !== false);
  const canEditWholesale = canEditPrices && (currentUserObj?.role === 'admin' || currentUserObj?.permissions?.editWholesalePrices !== false);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    syncedData.items.forEach((i) => {
      if (i.category) set.add(i.category);
    });
    return ['all', ...Array.from(set)];
  }, [syncedData.items]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return syncedData.items.filter((item) => {
      // Search
      const q = searchTerm.trim().toLowerCase();
      const matchSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.code && item.code.toLowerCase().includes(q)) ||
        (item.barcode && item.barcode.toLowerCase().includes(q)) ||
        (item.category && item.category.toLowerCase().includes(q));

      // Category
      const matchCategory = selectedCategory === 'all' || item.category === selectedCategory;

      // Status
      const hasCash = (item.normalSellingPrice || item.salePrice || 0) > 0;
      const hasWholesale = (item.wholesaleSellingPrice || item.wholesalePrice || 0) > 0;

      let matchStatus = true;
      if (statusFilter === 'complete') matchStatus = hasCash && hasWholesale;
      else if (statusFilter === 'missing_cash') matchStatus = !hasCash && hasWholesale;
      else if (statusFilter === 'missing_wholesale') matchStatus = hasCash && !hasWholesale;
      else if (statusFilter === 'no_prices') matchStatus = !hasCash && !hasWholesale;

      return matchSearch && matchCategory && matchStatus;
    });
  }, [syncedData.items, searchTerm, selectedCategory, statusFilter]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = syncedData.items.length;
    let withCash = 0;
    let withWholesale = 0;
    let noPrices = 0;
    let totalCashMargin = 0;
    let totalWholesaleMargin = 0;
    let validCashMarginsCount = 0;
    let validWholesaleMarginsCount = 0;

    syncedData.items.forEach((item) => {
      const normal = item.normalSellingPrice || item.salePrice || 0;
      const wholesale = item.wholesaleSellingPrice || item.wholesalePrice || 0;
      const cost = item.purchasePrice || 0;

      if (normal > 0) {
        withCash++;
        if (cost > 0) {
          totalCashMargin += calculateProfitMargin(normal, cost).marginPercent;
          validCashMarginsCount++;
        }
      }
      if (wholesale > 0) {
        withWholesale++;
        if (cost > 0) {
          totalWholesaleMargin += calculateProfitMargin(wholesale, cost).marginPercent;
          validWholesaleMarginsCount++;
        }
      }
      if (normal <= 0 && wholesale <= 0) {
        noPrices++;
      }
    });

    const avgCashMargin = validCashMarginsCount > 0 ? (totalCashMargin / validCashMarginsCount).toFixed(1) : '0';
    const avgWholesaleMargin = validWholesaleMarginsCount > 0 ? (totalWholesaleMargin / validWholesaleMarginsCount).toFixed(1) : '0';

    return {
      total,
      withCash,
      withWholesale,
      noPrices,
      avgCashMargin,
      avgWholesaleMargin,
    };
  }, [syncedData.items]);

  // Open Edit Modal for Item
  const handleOpenEdit = (item: Item) => {
    setEditingItem(item);
    setModalNormalPrice((item.normalSellingPrice || item.salePrice || 0).toString());
    setModalWholesalePrice((item.wholesaleSellingPrice || item.wholesalePrice || 0).toString());
    setModalReason('');
  };

  // Save Single Item Price
  const handleSaveItemPrice = () => {
    if (!editingItem) return;

    const normal = parseFloat(modalNormalPrice);
    const wholesale = parseFloat(modalWholesalePrice);

    if (isNaN(normal) || normal < 0 || isNaN(wholesale) || wholesale < 0) {
      showToast('يرجى إدخال أسعار صحيحة أكبر من أو تساوي الصفر', 'warning');
      return;
    }

    const cost = editingItem.purchasePrice || 0;
    if (cost > 0 && normal < cost) {
      const confirmBelowCost = confirm(
        `⚠️ تنبيه: سعر البيع النقدي (${normal} ج.م) أقل من سعر التكلفة/الشراء (${cost} ج.م).\nهل أنت متأكد من حفظ هذا السعر؟`
      );
      if (!confirmBelowCost) return;
    }

    const updated = updateProductPrice(
      syncedData,
      editingItem.id,
      normal,
      wholesale,
      currentUserName,
      modalReason.trim() || 'تعديل السعر من شاشة إدارة الأسعار'
    );

    onUpdateData(updated);
    setEditingItem(null);
    showToast(`تم حفظ وتحديث أسعار الصنف "${editingItem.name}" بنجاح`, 'success');
  };

  // Preset Margin Quick Setter
  const applyPresetMargin = (percent: number, target: 'normal' | 'wholesale' | 'both') => {
    if (!editingItem) return;
    const cost = editingItem.purchasePrice || 0;
    if (cost <= 0) {
      showToast('سعر تكلفة الصنف 0 ج.م، يرجى إدخال السعر يدوياً', 'info');
      return;
    }
    const calculatedPrice = Math.round(cost * (1 + percent / 100) * 100) / 100;
    if (target === 'normal' || target === 'both') {
      setModalNormalPrice(calculatedPrice.toString());
    }
    if (target === 'wholesale' || target === 'both') {
      const wholesaleCalculated = target === 'both' ? Math.round(cost * (1 + (percent * 0.75) / 100) * 100) / 100 : calculatedPrice;
      setModalWholesalePrice(wholesaleCalculated.toString());
    }
  };

  // Multi-select toggle
  const handleToggleSelectAll = () => {
    if (selectedProductIds.length === filteredProducts.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(filteredProducts.map((p) => p.id));
    }
  };

  const handleToggleSelectProduct = (id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  // Bulk Apply Execution
  const handleExecuteBulkAdjustment = () => {
    const targetIds = selectedProductIds.length > 0 ? selectedProductIds : filteredProducts.map((p) => p.id);
    if (targetIds.length === 0) {
      showToast('لا توجد أصناف محددة لتطبيق التعديل عليها', 'warning');
      return;
    }

    const val = parseFloat(bulkValue);
    if (isNaN(val)) {
      showToast('يرجى إدخال قيمة التعديل بشكل صحيح', 'warning');
      return;
    }

    const secondaryVal = parseFloat(bulkSecondaryValue) || undefined;

    const { updatedData, count } = applyBulkPriceAdjustments(
      syncedData,
      targetIds,
      bulkAdjustmentType,
      val,
      currentUserName,
      bulkReason.trim() || undefined,
      secondaryVal
    );

    onUpdateData(updatedData);
    setShowBulkConfirmModal(false);
    setSelectedProductIds([]);
    showToast(`تم تحديث وتعديل أسعار (${count}) صنف بنجاح`, 'success');
  };

  const handleDeleteHistory = (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا السجل من تاريخ تعديلات الأسعار؟')) return;
    const updatedData = {
      ...syncedData,
      priceHistories: (syncedData.priceHistories || []).filter((h) => h.id !== id),
    };
    onUpdateData(updatedData);
    showToast('تم حذف سجل تعديل السعر بنجاح', 'success');
  };

  // Filtered History
  const filteredHistories = useMemo(() => {
    const list = syncedData.priceHistories || [];
    return list.filter((h) => {
      const q = historySearch.trim().toLowerCase();
      const matchSearch =
        !q ||
        h.productName.toLowerCase().includes(q) ||
        (h.productCode && h.productCode.toLowerCase().includes(q)) ||
        (h.changedBy && h.changedBy.toLowerCase().includes(q)) ||
        (h.reason && h.reason.toLowerCase().includes(q));

      const matchDate = !historyDateFilter || h.date === historyDateFilter;

      return matchSearch && matchDate;
    });
  }, [syncedData.priceHistories, historySearch, historyDateFilter]);

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'كود الصنف',
      'الباركود',
      'اسم الصنف',
      'التصنيف',
      'سعر الشراء (التكلفة)',
      'سعر البيع النقدي',
      'هامش ربح النقدي %',
      'سعر البيع بالجملة',
      'هامش ربح الجملة %',
      'آخر تحديث',
      'المستخدم',
    ];

    const rows = syncedData.items.map((item) => {
      const normal = item.normalSellingPrice || item.salePrice || 0;
      const wholesale = item.wholesaleSellingPrice || item.wholesalePrice || 0;
      const cost = item.purchasePrice || 0;
      const normMargin = calculateProfitMargin(normal, cost).marginPercent;
      const wholMargin = calculateProfitMargin(wholesale, cost).marginPercent;

      return [
        `"${item.code || ''}"`,
        `"${item.barcode || ''}"`,
        `"${item.name.replace(/"/g, '""')}"`,
        `"${item.category || ''}"`,
        cost,
        normal,
        normMargin,
        wholesale,
        wholMargin,
        `"${item.lastPriceUpdate || ''}"`,
        `"${item.lastPriceUpdatedBy || ''}"`,
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `rakeeza_price_list_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('تم تصدير قائمة الأسعار إلى ملف CSV بنجاح', 'success');
  };

  // Export JSON
  const handleExportJSON = () => {
    const exportData = syncedData.items.map((i) => ({
      id: i.id,
      code: i.code,
      barcode: i.barcode,
      name: i.name,
      category: i.category,
      purchasePrice: i.purchasePrice,
      normalSellingPrice: i.normalSellingPrice || i.salePrice || 0,
      wholesaleSellingPrice: i.wholesaleSellingPrice || i.wholesalePrice || 0,
    }));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `rakeeza_prices_export_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('تم تصدير ملف الأسعار JSON بنجاح', 'success');
  };

  // Import JSON
  const handleImportJSON = () => {
    if (!importJsonText.trim()) {
      showToast('يرجى لصق بيانات JSON أولاً', 'warning');
      return;
    }

    try {
      const parsed = JSON.parse(importJsonText);
      if (!Array.isArray(parsed)) {
        showToast('تنسيق JSON غير صالح، يجب أن يكون مصفوفة من الأصناف', 'error');
        return;
      }

      let updatedCount = 0;
      let workingData = { ...syncedData };

      parsed.forEach((item) => {
        const target = workingData.items.find(
          (i) =>
            i.id === item.id ||
            (item.code && i.code === item.code) ||
            (item.barcode && i.barcode === item.barcode) ||
            i.name.trim().toLowerCase() === (item.name || '').trim().toLowerCase()
        );

        if (target) {
          const normal = item.normalSellingPrice !== undefined ? item.normalSellingPrice : item.salePrice;
          const wholesale = item.wholesaleSellingPrice !== undefined ? item.wholesaleSellingPrice : item.wholesalePrice;

          if (normal !== undefined || wholesale !== undefined) {
            const finalNormal = normal !== undefined ? Number(normal) : target.normalSellingPrice || target.salePrice || 0;
            const finalWholesale = wholesale !== undefined ? Number(wholesale) : target.wholesaleSellingPrice || target.wholesalePrice || 0;

            workingData = updateProductPrice(
              workingData,
              target.id,
              finalNormal,
              finalWholesale,
              currentUserName,
              'استيراد وتحديث الأسعار عبر ملف JSON'
            );
            updatedCount++;
          }
        }
      });

      if (updatedCount > 0) {
        onUpdateData(workingData);
        setImportJsonText('');
        showToast(`تم استيراد وتحديث أسعار (${updatedCount}) صنف بنجاح`, 'success');
      } else {
        showToast('لم يتم العثور على أصناف مطابقة لتحديث أسعارها', 'warning');
      }
    } catch (e) {
      showToast('خطأ في قراءة ملف JSON، يرجى التأكد من صحة التنسيق', 'error');
    }
  };

  // Print Price List
  const handlePrintPriceList = () => {
    openUnifiedPrintWindow(
      {
        title: 'قائمة أسعار المنتجات المعتمدة (النقدي والجملة)',
        partyLabel: 'إجمالي الأصناف المفلترة',
        partyName: `${filteredProducts.length} صنف`,
        items: filteredProducts.map((item) => {
          const normal = item.normalSellingPrice || item.salePrice || 0;
          const wholesale = item.wholesaleSellingPrice || item.wholesalePrice || 0;
          const cost = item.purchasePrice || 0;
          const normMargin = calculateProfitMargin(normal, cost);
          const wholMargin = calculateProfitMargin(wholesale, cost);

          return {
            name: item.name,
            code: item.barcode || item.code || item.id,
            unit: item.category || 'عام',
            qty: 1,
            price: normal,
            total: wholesale,
            notes: `التكلفة: ${cost.toFixed(2)} | هامش النقدي: +${normMargin.marginPercent}% | هامش الجملة: +${wholMargin.marginPercent}%`,
          };
        }),
        totals: [
          {
            label: 'إجمالي عدد الأصناف المسعرة:',
            value: filteredProducts.length,
            isBold: true,
          },
        ],
      },
      appData.settings,
      showToast
    );
  };

  // Export to Real Excel
  const handleExportExcel = () => {
    exportToExcel({
      filename: `قائمة_الأسعار_المعتمدة_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'قائمة الأسعار',
      data: filteredProducts,
      columns: [
        { header: 'كود الصنف', getValue: (i: any) => i.code || '-', width: 14 },
        { header: 'الباركود', getValue: (i: any) => i.barcode || '-', width: 18 },
        { header: 'اسم الصنف', key: 'name', width: 30 },
        { header: 'التصنيف / المجموعة', getValue: (i: any) => i.category || 'عام', width: 18 },
        { header: 'سعر التكلفة (ج.م)', getValue: (i: any) => (i.purchasePrice || 0).toFixed(2), width: 18 },
        { header: 'سعر البيع النقدي (ج.م)', getValue: (i: any) => (i.normalSellingPrice || i.salePrice || 0).toFixed(2), width: 22 },
        {
          header: 'هامش الربح النقدي (%)',
          getValue: (i: any) => `+${calculateProfitMargin(i.normalSellingPrice || i.salePrice || 0, i.purchasePrice || 0).marginPercent}%`,
          width: 20,
        },
        { header: 'سعر البيع بالجملة (ج.م)', getValue: (i: any) => (i.wholesaleSellingPrice || i.wholesalePrice || 0).toFixed(2), width: 22 },
        {
          header: 'هامش الربح بالجملة (%)',
          getValue: (i: any) => `+${calculateProfitMargin(i.wholesaleSellingPrice || i.wholesalePrice || 0, i.purchasePrice || 0).marginPercent}%`,
          width: 20,
        },
        { header: 'تاريخ آخر تحديث', getValue: (i: any) => i.lastPriceUpdate || '-', width: 16 },
        { header: 'القائم بالتحديث', getValue: (i: any) => i.lastPriceUpdatedBy || '-', width: 18 },
      ],
      companyName: appData.settings?.companyName || 'المنظومة المحاسبية المعتمدة',
      reportTitle: 'قائمة وسياسات أسعار المنتجات المعتمدة (البيع النقدي والبيع بالجملة)',
    });
    showToast('تم تصدير قائمة الأسعار إلى Excel بنجاح', 'success');
  };

  return (
    <div className="space-y-5 pb-12">
      {/* 1. Header Banner & Architecture Explanation */}
      <div className="bg-gradient-to-r from-[#1a237e] via-[#283593] to-[#0d47a1] text-white p-5 rounded-2xl shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">💰</span>
            <h3 className="text-xl font-black">إدارة وتسعير المنتجات المركزية (Price Management)</h3>
            <span className="bg-amber-400 text-slate-900 text-xs px-2.5 py-0.5 rounded-full font-bold">
              المصدر الرئيسي المعتمد للأسعار
            </span>
          </div>
          <p className="text-xs sm:text-sm text-indigo-100 mt-1 max-w-3xl leading-relaxed">
            المنظومة المركزية لتحديد وحفظ أسعار البيع الدائمة لكافة الأصناف (سعر البيع النقدي وسعر البيع بالجملة). تُسحب الأسعار آلياً داخل فواتير المبيعات ونقاط البيع بناءً على نوع البيع المختار دون الحاجة للإدخال اليدوي.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <TableActionButtons
            onPrint={handlePrintPriceList}
            onExportExcel={handleExportExcel}
            printLabel="طباعة السجل"
          />
        </div>
      </div>

      {/* 2. Dashboard KPIs Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs text-slate-500 font-semibold">إجمالي المنتجات</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-xl font-black text-[#1a237e]">{(metrics?.total || 0).toLocaleString('ar-EG')}</span>
            <span className="text-xs text-slate-400">صنف</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-emerald-100 bg-emerald-50/30 shadow-sm flex flex-col justify-between">
          <span className="text-xs text-emerald-800 font-semibold flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> أسعار نقدية مكتملة
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-xl font-black text-emerald-700">{(metrics?.withCash || 0).toLocaleString('ar-EG')}</span>
            <span className="text-[11px] font-bold text-emerald-600">
              {metrics.total > 0 ? Math.round((metrics.withCash / metrics.total) * 100) : 0}%
            </span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-blue-100 bg-blue-50/30 shadow-sm flex flex-col justify-between">
          <span className="text-xs text-blue-800 font-semibold flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span> أسعار جملة مكتملة
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-xl font-black text-blue-700">{(metrics?.withWholesale || 0).toLocaleString('ar-EG')}</span>
            <span className="text-[11px] font-bold text-blue-600">
              {metrics.total > 0 ? Math.round((metrics.withWholesale / metrics.total) * 100) : 0}%
            </span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-rose-100 bg-rose-50/30 shadow-sm flex flex-col justify-between">
          <span className="text-xs text-rose-800 font-semibold flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span> منتجات تحتاج تسعير
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-xl font-black text-rose-700">{(metrics?.noPrices || 0).toLocaleString('ar-EG')}</span>
            <span className="text-xs text-rose-600 font-semibold">تحتاج تحديد</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-indigo-100 shadow-sm flex flex-col justify-between">
          <span className="text-xs text-indigo-700 font-semibold">متوسط هامش النقدي</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-xl font-black text-indigo-900">+{metrics.avgCashMargin}%</span>
            <span className="text-[10px] text-slate-400">فوق التكلفة</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-indigo-100 shadow-sm flex flex-col justify-between">
          <span className="text-xs text-indigo-700 font-semibold">متوسط هامش الجملة</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-xl font-black text-indigo-900">+{metrics.avgWholesaleMargin}%</span>
            <span className="text-[10px] text-slate-400">فوق التكلفة</span>
          </div>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto text-xs sm:text-sm font-bold bg-white p-2 rounded-xl shadow-sm">
        <button
          onClick={() => setActiveTab('list')}
          className={`px-4 py-2.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'list'
              ? 'bg-[#1a237e] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span>📋</span> جدول قائمة الأسعار والتسعير ({filteredProducts.length})
        </button>

        <button
          onClick={() => setActiveTab('bulk')}
          className={`px-4 py-2.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'bulk'
              ? 'bg-[#1a237e] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span>⚡</span> التعديل والزيادة الجماعية
          {selectedProductIds.length > 0 && (
            <span className="bg-amber-400 text-slate-900 px-1.5 py-0.2 rounded-full text-[11px] font-black">
              {selectedProductIds.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'history'
              ? 'bg-[#1a237e] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span>📜</span> سجل تغييرات وتاريخ الأسعار ({syncedData.priceHistories?.length || 0})
        </button>

        <button
          onClick={() => setActiveTab('import_export')}
          className={`px-4 py-2.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'import_export'
              ? 'bg-[#1a237e] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span>📥📤</span> استيراد وتصدير الأسعار
        </button>
      </div>

      {/* 4. Tab 1: Price List Table */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs sm:text-sm">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">بحث في الأصناف</label>
              <input
                type="text"
                placeholder="ابحث بالاسم، الكود، أو الباركود..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-xl focus:border-[#1a237e] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">التصنيف</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-xl focus:border-[#1a237e] focus:outline-none"
              >
                <option value="all">جميع التصنيفات</option>
                {categories.filter((c) => c !== 'all').map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">حالة التسعير</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full p-2 border border-slate-300 rounded-xl focus:border-[#1a237e] focus:outline-none"
              >
                <option value="all">جميع الحالات</option>
                <option value="complete">🟢 مكتمل التسعير (نقدي + جملة)</option>
                <option value="missing_cash">🟠 ينقصه سعر نقدي</option>
                <option value="missing_wholesale">🟡 ينقصه سعر جملة</option>
                <option value="no_prices">🔴 بدون أي أسعار</option>
              </select>
            </div>

            <div className="flex items-end gap-2">
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('all');
                  setStatusFilter('all');
                }}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold p-2 rounded-xl transition cursor-pointer"
              >
                🔄 إعادة تعيين الفلاتر
              </button>
            </div>
          </div>

          {/* Bulk Selection Bar if items are selected */}
          {selectedProductIds.length > 0 && (
            <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-xl flex items-center justify-between text-xs sm:text-sm">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#1a237e]">
                  تم تحديد ({selectedProductIds.length}) من أصل ({filteredProducts.length}) صنف
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('bulk')}
                  className="bg-[#1a237e] hover:bg-[#0d47a1] text-white px-3.5 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1"
                >
                  <span>⚡</span> تطبيق تعديل جماعي على المحددين
                </button>
                <button
                  onClick={() => setSelectedProductIds([])}
                  className="text-slate-500 hover:text-slate-700 px-2 py-1"
                >
                  إلغاء التحديد
                </button>
              </div>
            </div>
          )}

          {/* Products List Section */}
          {/* Mobile Products Cards (< md) */}
          <div className="block md:hidden space-y-3">
            {filteredProducts.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center text-slate-400 border border-slate-200">
                لا توجد أصناف مطابقة للبحث أو الفلتر المختار
              </div>
            ) : (
              filteredProducts.map((item) => {
                const normal = item.normalSellingPrice || item.salePrice || 0;
                const wholesale = item.wholesaleSellingPrice || item.wholesalePrice || 0;
                const cost = item.purchasePrice || 0;
                const normMargin = calculateProfitMargin(normal, cost);
                const wholMargin = calculateProfitMargin(wholesale, cost);
                const hasCash = normal > 0;
                const hasWholesale = wholesale > 0;
                const isSelected = selectedProductIds.includes(item.id);

                return (
                  <div
                    key={item.id}
                    className={`bg-white rounded-2xl p-4 border space-y-3 shadow-xs transition ${
                      isSelected ? 'border-indigo-500 bg-indigo-50/20' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectProduct(item.id)}
                          className="mt-1 cursor-pointer rounded h-4 w-4 text-indigo-600 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 text-sm">{item.name}</div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono">{item.code || '-'}</span>
                            <span>•</span>
                            <span>{item.category || 'عام'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {hasCash && hasWholesale ? (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                            🟢 مكتمل
                          </span>
                        ) : hasCash ? (
                          <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                            🟡 ينقصه جملة
                          </span>
                        ) : hasWholesale ? (
                          <span className="bg-orange-100 text-orange-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                            🟠 ينقصه نقدي
                          </span>
                        ) : (
                          <span className="bg-rose-100 text-rose-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                            🔴 بدون سعر
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2 rounded-xl text-center text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">التكلفة</span>
                        <span className="font-mono font-bold text-slate-700">{cost.toFixed(2)}</span>
                      </div>
                      <div className="bg-emerald-50/60 rounded-lg p-1">
                        <span className="text-[10px] text-emerald-800 font-bold block">سعر النقدي</span>
                        <span className="font-mono font-black text-emerald-700 text-xs">
                          {hasCash ? `${normal.toFixed(2)}` : 'غير محدد'}
                        </span>
                        {hasCash && (
                          <span className="text-[9px] text-emerald-600 block">+{normMargin.marginPercent}%</span>
                        )}
                      </div>
                      <div className="bg-blue-50/60 rounded-lg p-1">
                        <span className="text-[10px] text-blue-800 font-bold block">سعر الجملة</span>
                        <span className="font-mono font-black text-blue-700 text-xs">
                          {hasWholesale ? `${wholesale.toFixed(2)}` : 'غير محدد'}
                        </span>
                        {hasWholesale && (
                          <span className="text-[9px] text-blue-600 block">+{wholMargin.marginPercent}%</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                      <span className="text-[10px] text-slate-400">
                        {item.lastPriceUpdate ? `تحديث: ${item.lastPriceUpdate}` : ''}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="min-h-[38px] bg-[#1a237e] hover:bg-[#0d47a1] text-white px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1"
                        >
                          <span>✏️</span> تسعير
                        </button>
                        <button
                          onClick={() => setHistoryItem(item)}
                          className="min-h-[38px] px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs transition"
                          title="عرض سجل تاريخ أسعار هذا الصنف"
                        >
                          📜 السجل
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Products Table (>= md) */}
          <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
            <table className="w-full text-right text-xs md:text-sm border-collapse">
              <thead>
                <tr className="bg-[#1a237e] text-white">
                  <th className="p-3 text-center w-10">
                    <input
                      type="checkbox"
                      checked={
                        filteredProducts.length > 0 &&
                        selectedProductIds.length === filteredProducts.length
                      }
                      onChange={handleToggleSelectAll}
                      className="cursor-pointer rounded"
                    />
                  </th>
                  <th className="p-3 font-bold">كود الصنف</th>
                  <th className="p-3 font-bold">الباركود</th>
                  <th className="p-3 font-bold">اسم الصنف</th>
                  <th className="p-3 font-bold">التصنيف</th>
                  <th className="p-3 font-bold">سعر الشراء (التكلفة)</th>
                  <th className="p-3 font-bold bg-indigo-900/40">سعر البيع النقدي</th>
                  <th className="p-3 font-bold bg-indigo-900/60">سعر البيع بالجملة</th>
                  <th className="p-3 font-bold">آخر تحديث للسعر</th>
                  <th className="p-3 font-bold">الحالة</th>
                  <th className="p-3 font-bold text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center p-8 text-slate-400">
                      لا توجد أصناف مطابقة للبحث أو الفلتر المختار
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((item) => {
                    const normal = item.normalSellingPrice || item.salePrice || 0;
                    const wholesale = item.wholesaleSellingPrice || item.wholesalePrice || 0;
                    const cost = item.purchasePrice || 0;

                    const normMargin = calculateProfitMargin(normal, cost);
                    const wholMargin = calculateProfitMargin(wholesale, cost);

                    const hasCash = normal > 0;
                    const hasWholesale = wholesale > 0;
                    const isSelected = selectedProductIds.includes(item.id);

                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-slate-50 transition ${
                          isSelected ? 'bg-indigo-50/40' : ''
                        }`}
                      >
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectProduct(item.id)}
                            className="cursor-pointer rounded"
                          />
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-700">{item.code || '-'}</td>
                        <td className="p-3 font-mono text-xs text-slate-500">{item.barcode || '-'}</td>
                        <td className="p-3 font-bold text-slate-900">
                          <div>{item.name}</div>
                          {item.description && (
                            <div className="text-[11px] text-slate-400 font-normal truncate max-w-[200px]">
                              {item.description}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <span className="bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-md">
                            {item.category || 'عام'}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-slate-700 font-mono">
                          {cost.toFixed(2)} ج.م
                        </td>
                        <td className="p-3 bg-emerald-50/30">
                          {hasCash ? (
                            <div>
                              <span className="font-bold text-emerald-800 font-mono text-sm block">
                                {normal.toFixed(2)} ج.م
                              </span>
                              <span className="text-[10px] text-emerald-600 font-semibold">
                                ربح: +{normMargin.profitAmount.toFixed(2)} (+{normMargin.marginPercent}%)
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded">
                              غير محدد
                            </span>
                          )}
                        </td>
                        <td className="p-3 bg-blue-50/30">
                          {hasWholesale ? (
                            <div>
                              <span className="font-bold text-blue-800 font-mono text-sm block">
                                {wholesale.toFixed(2)} ج.م
                              </span>
                              <span className="text-[10px] text-blue-600 font-semibold">
                                ربح: +{wholMargin.profitAmount.toFixed(2)} (+{wholMargin.marginPercent}%)
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded">
                              غير محدد
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-xs text-slate-500">
                          <div>{item.lastPriceUpdate || '-'}</div>
                          {item.lastPriceUpdatedBy && (
                            <div className="text-[10px] text-slate-400">بواسطة: {item.lastPriceUpdatedBy}</div>
                          )}
                        </td>
                        <td className="p-3">
                          {hasCash && hasWholesale ? (
                            <span className="bg-emerald-100 text-emerald-800 text-[11px] px-2 py-0.5 rounded-full font-bold">
                              🟢 مكتمل
                            </span>
                          ) : hasCash ? (
                            <span className="bg-amber-100 text-amber-800 text-[11px] px-2 py-0.5 rounded-full font-bold">
                              🟡 ينقصه جملة
                            </span>
                          ) : hasWholesale ? (
                            <span className="bg-orange-100 text-orange-800 text-[11px] px-2 py-0.5 rounded-full font-bold">
                              🟠 ينقصه نقدي
                            </span>
                          ) : (
                            <span className="bg-rose-100 text-rose-800 text-[11px] px-2 py-0.5 rounded-full font-bold">
                              🔴 بدون سعر
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(item)}
                              className="bg-[#1a237e] hover:bg-[#0d47a1] text-white px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1"
                              title="تعديل الأسعار الدائمة"
                            >
                              <span>✏️</span> تسعير
                            </button>
                            <button
                              onClick={() => setHistoryItem(item)}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-1.5 rounded-lg text-xs transition cursor-pointer"
                              title="عرض سجل تاريخ أسعار هذا الصنف"
                            >
                              📜
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
      )}

      {/* 5. Tab 2: Bulk Price Adjustments */}
      {activeTab === 'bulk' && (
        <div className="space-y-5">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h4 className="font-black text-lg text-[#1a237e] flex items-center gap-2">
                <span>⚡</span> أداة التعديل والزيادة الجماعية لأسعار المنتجات
              </h4>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                تتيح هذه الأداة تحديث أسعار مجموعة أصناف دفعة واحدة بنسب مئوية أو مبالغ ثابتة أو هوامش ربح موحدة مع إمكانية المعاينة قبل التطبيق.
              </p>
            </div>

            {/* Target selection info */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs sm:text-sm">
              <div>
                <strong>نطاق التطبيق:</strong>{' '}
                {selectedProductIds.length > 0 ? (
                  <span className="text-[#1a237e] font-bold">
                    الأصناف المحددة يدوياً في الجدول ({selectedProductIds.length} صنف)
                  </span>
                ) : (
                  <span className="text-[#1a237e] font-bold">
                    كافة الأصناف الظاهرة حسب الفلتر الحالي ({filteredProducts.length} صنف)
                  </span>
                )}
              </div>
              <button
                onClick={() => setActiveTab('list')}
                className="text-indigo-600 font-bold hover:underline cursor-pointer"
              >
                تغيير التحديد من الجدول ↗
              </button>
            </div>

            {/* Adjustment Form */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نوع التعديل المطلوب</label>
                <select
                  value={bulkAdjustmentType}
                  onChange={(e) => setBulkAdjustmentType(e.target.value as BulkAdjustmentType)}
                  className="w-full p-2.5 border-2 border-slate-300 rounded-xl focus:border-[#1a237e] focus:outline-none text-xs sm:text-sm font-semibold"
                >
                  <option value="increase_both_pct">📈 زيادة سعر البيع النقدي والجملة بنسبة %</option>
                  <option value="increase_normal_pct">📈 زيادة سعر البيع النقدي فقط بنسبة %</option>
                  <option value="increase_wholesale_pct">📈 زيادة سعر البيع بالجملة فقط بنسبة %</option>
                  <option value="decrease_both_pct">📉 تخفيض سعر البيع النقدي والجملة بنسبة %</option>
                  <option value="decrease_normal_pct">📉 تخفيض سعر البيع النقدي فقط بنسبة %</option>
                  <option value="decrease_wholesale_pct">📉 تخفيض سعر البيع بالجملة فقط بنسبة %</option>
                  <option value="increase_fixed_amount">➕ زيادة مبلغ ثابت (ج.م) على كلا السعرين</option>
                  <option value="decrease_fixed_amount">➖ تخفيض مبلغ ثابت (ج.م) من كلا السعرين</option>
                  <option value="set_cost_margin_pct">🎯 تسعير بهامش ربح موحد فوق سعر الشراء %</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {bulkAdjustmentType.includes('fixed')
                    ? 'المبلغ الثابت (ج.م)'
                    : bulkAdjustmentType === 'set_cost_margin_pct'
                    ? 'نسبة هامش ربح النقدي %'
                    : 'النسبة المئوية %'}
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                  className="w-full p-2.5 border-2 border-slate-300 rounded-xl focus:border-[#1a237e] focus:outline-none text-xs sm:text-sm font-bold text-[#1a237e]"
                />
              </div>

              {bulkAdjustmentType === 'set_cost_margin_pct' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    نسبة هامش ربح الجملة %
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={bulkSecondaryValue}
                    onChange={(e) => setBulkSecondaryValue(e.target.value)}
                    className="w-full p-2.5 border-2 border-slate-300 rounded-xl focus:border-[#1a237e] focus:outline-none text-xs sm:text-sm font-bold text-blue-700"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">سبب أو ملاحظة التعديل</label>
                  <input
                    type="text"
                    placeholder="مثال: زيادة أسعار دورية لمواكبة التضخم..."
                    value={bulkReason}
                    onChange={(e) => setBulkReason(e.target.value)}
                    className="w-full p-2.5 border-2 border-slate-300 rounded-xl focus:border-[#1a237e] focus:outline-none text-xs sm:text-sm"
                  />
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowBulkConfirmModal(true)}
                disabled={!canEditPrices}
                className="bg-[#1a237e] hover:bg-[#0d47a1] text-white px-6 py-2.5 rounded-xl font-bold transition flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                <span>⚡</span> معاينة وتطبيق التعديل الجماعي
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Tab 3: Price Change History Log */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs sm:text-sm">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">بحث في السجل</label>
              <input
                type="text"
                placeholder="ابحث باسم الصنف، المستخدم، أو سبب التغيير..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-xl focus:border-[#1a237e] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ التغيير</label>
              <input
                type="date"
                value={historyDateFilter}
                onChange={(e) => setHistoryDateFilter(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-xl focus:border-[#1a237e] focus:outline-none"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setHistorySearch('');
                  setHistoryDateFilter('');
                }}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold p-2 rounded-xl transition cursor-pointer"
              >
                🔄 مسح الفلاتر
              </button>
            </div>
          </div>

          {/* Price History Section */}
          {/* Mobile Price History Cards (< md) */}
          <div className="block md:hidden space-y-3">
            {filteredHistories.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center text-slate-400 border border-slate-200">
                لا توجد سجلات تعديل أسعار مسجلة حتى الآن
              </div>
            ) : (
              filteredHistories.map((h, idx) => (
                <div key={h.id} className="bg-white rounded-2xl p-4 border border-slate-200 space-y-2.5 shadow-xs text-xs">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <span className="font-bold text-[#1a237e] text-sm truncate">{h.productName}</span>
                    <span className="font-mono text-slate-500 text-[11px]">{h.date} {h.time}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded-xl text-[11px]">
                    <div>
                      <span className="text-[10px] text-slate-400 block">النقدي (سابق ← جديد):</span>
                      <span className="font-mono text-slate-400 line-through mr-1">{h.oldNormalPrice.toFixed(2)}</span>
                      <span className="font-mono font-bold text-emerald-700">{h.newNormalPrice.toFixed(2)} ج.م</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">الجملة (سابق ← جديد):</span>
                      <span className="font-mono text-slate-400 line-through mr-1">{h.oldWholesalePrice.toFixed(2)}</span>
                      <span className="font-mono font-bold text-blue-700">{h.newWholesalePrice.toFixed(2)} ج.م</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                    <span>بواسطة: <strong>{h.changedBy}</strong></span>
                    {h.reason && <span className="italic text-slate-400 truncate max-w-[150px]">{h.reason}</span>}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Price History Table (>= md) */}
          <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
            <table className="w-full text-right text-xs md:text-sm border-collapse">
              <thead>
                <tr className="bg-[#1a237e] text-white">
                  <th className="p-3">#</th>
                  <th className="p-3">التاريخ والوقت</th>
                  <th className="p-3">الصنف</th>
                  <th className="p-3">التكلفة</th>
                  <th className="p-3">السعر النقدي (السابق ← الجديد)</th>
                  <th className="p-3">سعر الجملة (السابق ← الجديد)</th>
                  <th className="p-3">المستخدم المسؤول</th>
                  <th className="p-3">سبب التعديل</th>
                  <th className="p-3 text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredHistories.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center p-8 text-slate-400">
                      لا توجد سجلات تعديل أسعار مسجلة حتى الآن
                    </td>
                  </tr>
                ) : (
                  filteredHistories.map((h, idx) => (
                    <tr key={h.id} className="hover:bg-slate-50">
                      <td className="p-3 text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-mono text-xs">
                        <div>{h.date}</div>
                        <div className="text-slate-400">{h.time}</div>
                      </td>
                      <td className="p-3 font-bold text-[#1a237e]">
                        <div>{h.productName}</div>
                        {h.productCode && <div className="text-xs text-slate-400 font-mono">{h.productCode}</div>}
                      </td>
                      <td className="p-3 font-mono text-slate-600">{(h.purchaseCost || 0).toFixed(2)} ج.م</td>
                      <td className="p-3 font-mono">
                        <div className="flex items-center gap-1 font-bold">
                          <span className="text-slate-400 line-through">{h.oldNormalPrice.toFixed(2)}</span>
                          <span>←</span>
                          <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                            {h.newNormalPrice.toFixed(2)} ج.م
                          </span>
                        </div>
                      </td>
                      <td className="p-3 font-mono">
                        <div className="flex items-center gap-1 font-bold">
                          <span className="text-slate-400 line-through">{h.oldWholesalePrice.toFixed(2)}</span>
                          <span>←</span>
                          <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                            {h.newWholesalePrice.toFixed(2)} ج.م
                          </span>
                        </div>
                      </td>
                      <td className="p-3 text-xs font-semibold text-slate-700">👤 {h.changedBy}</td>
                      <td className="p-3 text-xs text-slate-600 italic">{h.reason || '-'}</td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleDeleteHistory(h.id)}
                          className="bg-rose-50 hover:bg-rose-100 text-rose-700 p-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                          title="حذف هذا السجل"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. Tab 4: Import / Export */}
      {activeTab === 'import_export' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Export Box */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h4 className="font-bold text-base text-[#1a237e] flex items-center gap-1.5">
                <span>📤</span> تصدير بيانات قائمة الأسعار
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                تصدير كافة أسعار البيع النقدية والجملة وهوامش الربح في ملفات متوافقة مع Excel وبرامج الحسابات.
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleExportCSV}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold p-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <span>📊</span> تصدير جدول الأسعار الكامل (CSV / Excel)
              </button>
              <button
                onClick={handleExportJSON}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold p-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <span>💾</span> تصدير بيانات الأسعار البرمجية (JSON)
              </button>
              <button
                onClick={handlePrintPriceList}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold p-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <span>🖨️</span> طباعة وثيقة الأسعار المعتمدة
              </button>
            </div>
          </div>

          {/* Import Box */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h4 className="font-bold text-base text-[#1a237e] flex items-center gap-1.5">
                <span>📥</span> استيراد وتحديث الأسعار عبر JSON
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                الصق مصفوفة JSON تحتوي على تحديثات الأسعار لتطبيقها آلياً على الأصناف المطابقة.
              </p>
            </div>

            <div className="space-y-3">
              <textarea
                rows={6}
                placeholder={`[\n  {\n    "code": "PRD-001",\n    "normalSellingPrice": 1000,\n    "wholesaleSellingPrice": 900\n  }\n]`}
                value={importJsonText}
                onChange={(e) => setImportJsonText(e.target.value)}
                className="w-full p-3 font-mono text-xs border border-slate-300 rounded-xl focus:border-[#1a237e] focus:outline-none"
                dir="ltr"
              />
              <button
                onClick={handleImportJSON}
                disabled={!canEditPrices}
                className="w-full bg-[#1a237e] hover:bg-[#0d47a1] text-white font-bold p-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
              >
                <span>📥</span> استيراد وتطبيق الأسعار
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Single Item Price Edit Modal */}
      <Modal
        isOpen={editingItem !== null}
        title={`💰 تعديل الأسعار الدائمة للصنف: ${editingItem?.name || ''}`}
        onClose={() => setEditingItem(null)}
      >
        {editingItem && (
          <div className="space-y-4 text-xs sm:text-sm">
            {/* Item Info Header */}
            <div className="bg-indigo-50/70 p-3.5 rounded-xl border border-indigo-100 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <span className="text-slate-500 text-xs block">كود الصنف:</span>
                <span className="font-mono font-bold text-[#1a237e]">{editingItem.code || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 text-xs block">الباركود:</span>
                <span className="font-mono font-bold text-slate-700">{editingItem.barcode || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 text-xs block">التصنيف:</span>
                <span className="font-bold text-slate-700">{editingItem.category || 'عام'}</span>
              </div>
              <div>
                <span className="text-slate-500 text-xs block">سعر التكلفة (الشراء):</span>
                <span className="font-mono font-bold text-slate-900">{(editingItem.purchasePrice || 0).toFixed(2)} ج.م</span>
              </div>
            </div>

            {/* Quick Margin Presets */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                تحديد سريع لهامش الربح فوق سعر التكلفة ({(editingItem.purchasePrice || 0).toFixed(2)} ج.م):
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[10, 15, 20, 25, 30, 40, 50].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => applyPresetMargin(pct, 'both')}
                    className="bg-slate-100 hover:bg-indigo-100 hover:text-indigo-800 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer border border-slate-200"
                  >
                    +{pct}%
                  </button>
                ))}
              </div>
            </div>

            {/* Price Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Cash Selling Price */}
              <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-200">
                <div className="flex items-center justify-between mb-1">
                  <label className="font-black text-emerald-900 flex items-center gap-1">
                    <span>🟢</span> سعر البيع النقدي
                  </label>
                  <span className="text-[11px] text-emerald-700 font-bold">(Cash Price)</span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={modalNormalPrice}
                  disabled={!canEditCash}
                  onChange={(e) => setModalNormalPrice(e.target.value)}
                  className="w-full p-2.5 border-2 border-emerald-300 rounded-xl focus:border-emerald-600 focus:outline-none font-bold text-base text-emerald-950 font-mono bg-white"
                />
                {/* Live Margin Calculation */}
                {(() => {
                  const p = parseFloat(modalNormalPrice) || 0;
                  const c = editingItem.purchasePrice || 0;
                  const m = calculateProfitMargin(p, c);
                  return (
                    <div className="mt-2 text-xs flex justify-between items-center text-emerald-800 font-semibold">
                      <span>مبلغ الربح: {m.profitAmount.toFixed(2)} ج.م</span>
                      <span className="bg-emerald-200/70 px-2 py-0.5 rounded text-[11px] font-bold">
                        نسبة الهامش: +{m.marginPercent}%
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Wholesale Selling Price */}
              <div className="bg-blue-50/50 p-3.5 rounded-xl border border-blue-200">
                <div className="flex items-center justify-between mb-1">
                  <label className="font-black text-blue-900 flex items-center gap-1">
                    <span>🔵</span> سعر البيع بالجملة
                  </label>
                  <span className="text-[11px] text-blue-700 font-bold">(Wholesale Price)</span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={modalWholesalePrice}
                  disabled={!canEditWholesale}
                  onChange={(e) => setModalWholesalePrice(e.target.value)}
                  className="w-full p-2.5 border-2 border-blue-300 rounded-xl focus:border-blue-600 focus:outline-none font-bold text-base text-blue-950 font-mono bg-white"
                />
                {/* Live Margin Calculation */}
                {(() => {
                  const p = parseFloat(modalWholesalePrice) || 0;
                  const c = editingItem.purchasePrice || 0;
                  const m = calculateProfitMargin(p, c);
                  return (
                    <div className="mt-2 text-xs flex justify-between items-center text-blue-800 font-semibold">
                      <span>مبلغ الربح: {m.profitAmount.toFixed(2)} ج.م</span>
                      <span className="bg-blue-200/70 px-2 py-0.5 rounded text-[11px] font-bold">
                        نسبة الهامش: +{m.marginPercent}%
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Reason Field */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                سبب التعديل أو ملاحظات التسعير (اختياري للسجل)
              </label>
              <input
                type="text"
                placeholder="مثال: تعديل تسعيرة الموردين، تحديث تكلفة الشراء..."
                value={modalReason}
                onChange={(e) => setModalReason(e.target.value)}
                className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-[#1a237e] focus:outline-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleSaveItemPrice}
                disabled={!canEditPrices}
                className="flex-1 bg-[#1a237e] hover:bg-[#0d47a1] text-white font-bold p-3 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
              >
                <span>💾</span> حفظ واعتماد الأسعار
              </button>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-5 py-3 rounded-xl transition cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* 9. Item Specific History Modal */}
      <Modal
        isOpen={historyItem !== null}
        title={`📜 سجل تغييرات أسعار الصنف: ${historyItem?.name || ''}`}
        onClose={() => setHistoryItem(null)}
      >
        {historyItem && (
          <div className="space-y-4 text-xs sm:text-sm">
            {/* Mobile Modal History Cards (< md) */}
            <div className="block md:hidden space-y-2 max-h-80 overflow-y-auto">
              {syncedData.priceHistories?.filter((h) => h.productId === historyItem.id).length === 0 ? (
                <div className="text-center p-6 text-slate-400 bg-slate-50 rounded-xl">
                  لا توجد تغييرات سابقة مسجلة لهذا الصنف
                </div>
              ) : (
                syncedData.priceHistories
                  ?.filter((h) => h.productId === historyItem.id)
                  .map((h) => (
                    <div key={h.id} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs space-y-1">
                      <div className="flex items-center justify-between text-slate-500 text-[11px]">
                        <span className="font-mono">{h.date} {h.time}</span>
                        <span>{h.changedBy}</span>
                      </div>
                      <div className="flex items-center justify-between font-mono text-xs">
                        <span className="text-emerald-800 font-bold">نقدي: {h.oldNormalPrice} ← {h.newNormalPrice}</span>
                        <span className="text-blue-800 font-bold">جملة: {h.oldWholesalePrice} ← {h.newWholesalePrice}</span>
                      </div>
                      {h.reason && <div className="text-[10px] text-slate-400 italic">{h.reason}</div>}
                    </div>
                  ))
              )}
            </div>

            {/* Desktop Modal History Table (>= md) */}
            <div className="hidden md:block border border-slate-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="p-2.5">التاريخ والوقت</th>
                    <th className="p-2.5">النقدي (السابق ← الجديد)</th>
                    <th className="p-2.5">الجملة (السابق ← الجديد)</th>
                    <th className="p-2.5">المستخدم</th>
                    <th className="p-2.5">السبب</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {syncedData.priceHistories?.filter((h) => h.productId === historyItem.id).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center p-6 text-slate-400">
                        لا توجد تغييرات سابقة مسجلة لهذا الصنف
                      </td>
                    </tr>
                  ) : (
                    syncedData.priceHistories
                      ?.filter((h) => h.productId === historyItem.id)
                      .map((h) => (
                        <tr key={h.id} className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono">
                            <div>{h.date}</div>
                            <div className="text-slate-400 text-[10px]">{h.time}</div>
                          </td>
                          <td className="p-2.5 font-mono font-bold text-emerald-800">
                            {h.oldNormalPrice} ← {h.newNormalPrice} ج.م
                          </td>
                          <td className="p-2.5 font-mono font-bold text-blue-800">
                            {h.oldWholesalePrice} ← {h.newWholesalePrice} ج.م
                          </td>
                          <td className="p-2.5 text-slate-600">{h.changedBy}</td>
                          <td className="p-2.5 text-slate-500 italic">{h.reason || '-'}</td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setHistoryItem(null)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-5 py-2 rounded-xl transition cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* 10. Bulk Adjustment Confirmation Modal */}
      <Modal
        isOpen={showBulkConfirmModal}
        title="⚠️ تأكيد تطبيق التعديل الجماعي للأسعار"
        onClose={() => setShowBulkConfirmModal(false)}
      >
        <div className="space-y-4 text-xs sm:text-sm">
          <p className="text-slate-700 leading-relaxed font-semibold">
            أنت على وشك تعديل أسعار{' '}
            <strong className="text-[#1a237e]">
              ({selectedProductIds.length > 0 ? selectedProductIds.length : filteredProducts.length}) صنف
            </strong>{' '}
            حسب المعايير التالية:
          </p>

          <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-amber-900 space-y-1 text-xs">
            <div>
              <strong>نوع الإجراء:</strong> {bulkAdjustmentType}
            </div>
            <div>
              <strong>القيمة:</strong> {bulkValue}
            </div>
            {bulkReason && (
              <div>
                <strong>السبب:</strong> {bulkReason}
              </div>
            )}
          </div>

          <p className="text-slate-500 text-xs">
            سيتم حفظ التغييرات في قاعدة البيانات وتسجيل العملية بالكامل في سجل تاريخ الأسعار باسم المستخدم ({currentUserName}).
          </p>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleExecuteBulkAdjustment}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold p-3 rounded-xl transition cursor-pointer shadow-md"
            >
              ✅ نعم، تطبيق وحفظ التعديل الجماعي
            </button>
            <button
              type="button"
              onClick={() => setShowBulkConfirmModal(false)}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-5 py-3 rounded-xl transition cursor-pointer"
            >
              تراجع وإلغاء
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
