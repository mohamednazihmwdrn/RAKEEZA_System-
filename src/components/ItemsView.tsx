import React, { useState, useMemo, useEffect } from 'react';
import { AppData, Item } from '../types';
import { Modal } from './Modal';
import { exportToExcel } from '../utils/excelExport';
import { openUnifiedPrintWindow } from '../utils/printUnified';
import { TableActionButtons } from './TableActionButtons';
import { PDF_CATALOG_ITEMS_1001 } from '../data/pdfMasterItems';
import { Trash2, DownloadCloud, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Layers } from 'lucide-react';

interface ItemsViewProps {
  appData: AppData;
  subPage?: string;
  onUpdateData: (newData: AppData, actionInfo?: { action?: string; module?: string; details?: string; deletedId?: string | number }) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onShareCatalog?: () => void;
  onOpenCatalog?: () => void;
  onNavigate?: (page: string) => void;
}

export const ItemsView: React.FC<ItemsViewProps> = ({
  appData,
  subPage = 'items',
  onUpdateData,
  showToast,
  onShareCatalog,
  onOpenCatalog,
  onNavigate,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  // Form
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [qty, setQty] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('قطعة');
  const [code, setCode] = useState('');
  const [itemLastPurchaseDate, setItemLastPurchaseDate] = useState('');

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [purchaseStatusFilter, setPurchaseStatusFilter] = useState<'all' | 'purchased' | 'pending'>('all');

  // 🌳 نافذة إضافة هيكل شجري متكامل (مجموعة > تصنيف > نوع > صنف)
  const [isHierarchyModalOpen, setIsHierarchyModalOpen] = useState(false);
  const [hierGroup, setHierGroup] = useState('');
  const [hierCompany, setHierCompany] = useState('');
  const [hierType, setHierType] = useState('');
  const [hierItemName, setHierItemName] = useState('');
  const [hierItemCode, setHierItemCode] = useState('');
  const [hierQty, setHierQty] = useState('');
  const [hierPurchasePrice, setHierPurchasePrice] = useState('');
  const [hierSalePrice, setHierSalePrice] = useState('');
  const [hierWholesalePrice, setHierWholesalePrice] = useState('');

  const handleOpenAddHierarchy = () => {
    setHierGroup('');
    setHierCompany('');
    setHierType('');
    setHierItemName('');
    setHierItemCode('');
    setHierQty('');
    setHierPurchasePrice('');
    setHierSalePrice('');
    setHierWholesalePrice('');
    setIsHierarchyModalOpen(true);
  };

  const handleSaveHierarchyItem = () => {
    const grp = hierGroup.trim();
    const comp = hierCompany.trim();
    const typ = hierType.trim();
    const itemName = hierItemName.trim();
    const code = hierItemCode.trim() || ('UA' + String((appData.items?.length || 0) + 101));

    if (!grp) {
      showToast('يرجى تحديد أو كتابة اسم المجموعة الرئيسية', 'warning');
      return;
    }
    if (!comp) {
      showToast('يرجى تحديد أو كتابة اسم التصنيف أو الشركة', 'warning');
      return;
    }
    if (!typ) {
      showToast('يرجى تحديد أو كتابة اسم النوع أو القسم الفرعي', 'warning');
      return;
    }
    if (!itemName) {
      showToast('يرجى إدخال اسم الصنف النهائي', 'warning');
      return;
    }

    const pPrice = parseFloat(hierPurchasePrice) || 0;
    const sPrice = parseFloat(hierSalePrice) || (pPrice > 0 ? pPrice * 1.25 : 10);
    const wPrice = parseFloat(hierWholesalePrice) || (sPrice > 0 ? sPrice * 0.90 : pPrice * 1.15);
    const qVal = parseFloat(hierQty) || 0;
    const currentUser = appData.users.find((u) => u.id === appData.currentUser) || appData.users[0];
    const nowIso = new Date().toISOString();

    const newItem: Item = {
      id: 'i_' + Date.now(),
      code,
      name: itemName,
      description: `${grp} > ${comp} > ${typ}`,
      category: grp,
      material: comp,
      unit: typ,
      quantity: qVal,
      purchasePrice: pPrice,
      salePrice: sPrice,
      wholesalePrice: wPrice,
      companyId: appData.companyId || 'COMP-000001',
      branchId: appData.activeBranchId || 'main',
      movements: [],
      createdAt: nowIso,
      updatedAt: nowIso,
      createdBy: currentUser?.name || 'مدير النظام',
      createdByUserId: currentUser?.id,
      createdByUserCode: currentUser?.code || 1,
    };

    const updatedData = {
      ...appData,
      items: [...appData.items, newItem],
    };

    onUpdateData(updatedData, {
      action: 'create_item_hierarchy',
      module: 'الأصناف والمخزون',
      details: `إضافة هيكل شجري كامل للصنف: ${grp} > ${comp} > ${typ} > ${itemName}`,
    });

    setIsHierarchyModalOpen(false);
    showToast(`تمت إضافة المجموعة [${grp}] والتصنيف [${comp}] والنوع [${typ}] والصنف [${itemName}] بنجاح`, 'success');
  };

  // Pagination & Display Controls for 1000+ items
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, pageSize, categoryFilter, purchaseStatusFilter]);

  // Unique categories in database
  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    (appData.items || []).forEach((item) => {
      if (item.category && item.category.trim()) {
        set.add(item.category.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [appData.items]);

  // Overall catalog stats
  const itemsStats = useMemo(() => {
    const total = appData.items?.length || 0;
    const purchased = (appData.items || []).filter(
      (i) => (i.quantity || 0) > 0 || (i.purchasePrice || 0) > 0 || Boolean(i.lastPurchaseDate)
    ).length;
    const pending = total - purchased;
    const unassignedCategory = (appData.items || []).filter(
      (i) => !i.category || !i.category.trim()
    ).length;
    return { total, purchased, pending, unassignedCategory };
  }, [appData.items]);

  const filteredItems = useMemo(() => {
    const s = searchTerm.toLowerCase().trim();
    return (appData.items || []).filter((item) => {
      // 1. Text Search
      if (s) {
        const matches =
          item.name?.toLowerCase().includes(s) ||
          item.description?.toLowerCase().includes(s) ||
          item.code?.toLowerCase().includes(s) ||
          item.category?.toLowerCase().includes(s);
        if (!matches) return false;
      }

      // 2. Category Filter
      if (categoryFilter === 'uncategorized') {
        if (item.category && item.category.trim()) return false;
      } else if (categoryFilter !== 'all') {
        if (item.category?.trim() !== categoryFilter) return false;
      }

      // 3. Purchase Status Filter
      const isPurchased = (item.quantity || 0) > 0 || (item.purchasePrice || 0) > 0 || Boolean(item.lastPurchaseDate);
      if (purchaseStatusFilter === 'purchased' && !isPurchased) return false;
      if (purchaseStatusFilter === 'pending' && isPurchased) return false;

      return true;
    });
  }, [appData.items, searchTerm, categoryFilter, purchaseStatusFilter]);

  const totalPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(filteredItems.length / pageSize));

  const paginatedItems = useMemo(() => {
    if (pageSize === -1) return filteredItems;
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  // 🗑️ حذف جميع الأصناف دفعة واحدة بطلب المستخدم
  const handleDeleteAllItems = () => {
    if (!appData.items || appData.items.length === 0) {
      showToast('لا توجد أصناف في السجل لحذفها', 'info');
      return;
    }

    const confirmMsg = `⚠️ تحذير:\nهل أنت متأكد من رغبتك في حذف جميع الأصناف المسجلة (${appData.items.length} صنف) دفعة واحدة يدوياً؟\n\nيمكنك إعادة إدراج أصناف الـ PDF الـ 1,001 في أي وقت لاحقاً بضغطة زر.`;
    if (!confirm(confirmMsg)) return;

    const updatedData = { ...appData };
    if (!updatedData.deletedRecords) updatedData.deletedRecords = {};
    updatedData.deletedRecords['items_all_cleared'] = Date.now();
    appData.items.forEach((it) => {
      updatedData.deletedRecords[`items_${it.id}`] = Date.now();
    });
    updatedData.items = [];

    onUpdateData(updatedData, {
      action: 'delete_all_items',
      module: 'الأصناف والمخزون',
      details: 'حذف وتفريغ جميع الأصناف يدوياً دفعة واحدة',
    });
    showToast('تم حذف وتفريغ جميع الأصناف بنجاح. يمكنك إعادة إدراجها في أي وقت.', 'info');
  };

  // 📥 دمج أو استعادة أصناف ملف الـ PDF الـ 1001
  const handleRestorePdfItems = () => {
    const confirmMsg = `هل ترغب في إدراج ودمج أصناف ملف PDF المعتمدة (${PDF_CATALOG_ITEMS_1001.length} صنف) بدون أعداد وبدون أسعار وبدون تصنيفات الآن؟`;
    if (!confirm(confirmMsg)) return;

    const updatedData = { ...appData };
    if (updatedData.deletedRecords) {
      delete updatedData.deletedRecords['items_all_cleared'];
    }
    const existingNames = new Set((updatedData.items || []).map((i) => i.name.trim().toLowerCase()));
    const missing = PDF_CATALOG_ITEMS_1001.filter((p) => !existingNames.has(p.name.trim().toLowerCase())).map((it) => ({
      ...it,
      companyId: updatedData.companyId || 'COMP-000001',
    }));

    if (missing.length === 0) {
      showToast('جميع أصناف ملف الـ PDF الـ 1,001 مدمجة بالفعل في قائمة الأصناف!', 'info');
      return;
    }

    updatedData.items = [...(updatedData.items || []), ...missing];
    onUpdateData(updatedData, {
      action: 'seed_pdf_items',
      module: 'الأصناف والمخزون',
      details: `إدراج ${missing.length} صنف من ملف PDF`,
    });
    showToast(`تم إدراج ودمج (${missing.length}) صنف بنجاح في قسم الأصناف!`, 'success');
  };

  // Print Inventory / Items
  const handlePrintItems = () => {
    const totalQty = filteredItems.reduce((sum, i) => sum + (i.quantity || 0), 0);
    const totalInventoryValue = filteredItems.reduce((sum, i) => sum + ((i.quantity || 0) * (i.purchasePrice || 0)), 0);

    openUnifiedPrintWindow(
      {
        reportTitle: 'كشف جرد وأرصدة المخزون السلعي',
        subTitle: 'تقرير الأصناف والمخزون المعتمد',
        serial: 'INV-REP',
        branch: 'المخزن الرئيسي',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        kpis: [
          { title: 'إجمالي عدد الأصناف', value: `${filteredItems.length} صنف` },
          { title: 'إجمالي الكميات بالمخزن', value: `${(totalQty || 0).toLocaleString('en-US')}` },
          { title: 'القيمة الإجمالية بسعر الشراء', value: `${(totalInventoryValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م` },
        ],
        columns: ['#', 'اسم الصنف', 'الوصف / الفئة', 'الكمية الحالية', 'سعر الشراء', 'سعر البيع', 'إجمالي القيمة'],
        rows: filteredItems.map((item, idx) => [
          idx + 1,
          item.name,
          item.description || '-',
          item.quantity,
          `${item.purchasePrice.toFixed(2)} ج.م`,
          `${item.salePrice.toFixed(2)} ج.م`,
          `${(item.quantity * item.purchasePrice).toFixed(2)} ج.م`,
        ]),
        summary: [
          { label: 'إجمالي الكميات بالمخزن', value: totalQty.toString() },
          { label: 'إجمالي قيمة المخزون التقديرية', value: `${totalInventoryValue.toFixed(2)} ج.م`, isTotal: true },
        ],
        footerNote: 'تم استخراج كشف الجرد واعتماده من إدارة المخازن والمستودعات',
      },
      appData.settings,
      showToast
    );
  };

  // Export Items to Excel
  const handleExportItemsExcel = () => {
    exportToExcel({
      filename: `مخزون_الأصناف_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'الأصناف والمخزون',
      data: filteredItems,
      columns: [
        { header: 'كود الصنف', key: 'id', width: 12 },
        { header: 'اسم الصنف', key: 'name', width: 28 },
        { header: 'الوصف / المواصفات', key: 'description', width: 25 },
        { header: 'الكمية بالمخزن', key: 'quantity', width: 15 },
        {
          header: 'سعر الشراء (ج.م)',
          getValue: (item: Item) => item.purchasePrice.toFixed(2),
          width: 18,
        },
        {
          header: 'سعر البيع (ج.م)',
          getValue: (item: Item) => item.salePrice.toFixed(2),
          width: 18,
        },
        {
          header: 'إجمالي القيمة بسعر الشراء',
          getValue: (item: Item) => (item.quantity * item.purchasePrice).toFixed(2),
          width: 22,
        },
      ],
      companyName: appData.settings?.companyName || 'المنظومة المحاسبية المعتمدة',
      reportTitle: 'كشف جرد الأصناف والمخزون السلعي',
    });
    if (showToast) showToast('تم تصدير كشف الأصناف إلى Excel بنجاح', 'success');
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    setName('');
    setCategory('');
    setUnit('قطعة');
    setCode('');
    setDesc('');
    setQty('0');
    setPurchasePrice('0');
    setSalePrice('0');
    setItemLastPurchaseDate('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: Item) => {
    setEditingItem(item);
    setName(item.name || '');
    setCategory(item.category || '');
    setUnit(item.unit || 'قطعة');
    setCode(item.code || '');
    setDesc(item.description || '');
    setQty(item.quantity?.toString() || '0');
    setPurchasePrice(item.purchasePrice?.toString() || '0');
    setSalePrice(item.salePrice?.toString() || '0');
    setItemLastPurchaseDate(item.lastPurchaseDate || '');
    setIsModalOpen(true);
  };

  const handleSaveItem = () => {
    if (!name.trim()) {
      showToast('يرجى إدخال اسم الصنف', 'warning');
      return;
    }

    const updatedData = { ...appData };
    const pPrice = parseFloat(purchasePrice) || 0;
    const sPrice = parseFloat(salePrice) || (pPrice > 0 ? Number((pPrice * 1.25).toFixed(2)) : 0);
    const qVal = parseFloat(qty) || 0;
    const currentUser = appData.users.find((u) => u.id === appData.currentUser) || appData.users[0];
    const nowIso = new Date().toISOString();

    if (editingItem) {
      const idx = updatedData.items.findIndex((i) => i.id === editingItem.id);
      if (idx !== -1) {
        updatedData.items[idx] = {
          ...updatedData.items[idx],
          companyId: updatedData.items[idx].companyId || appData.companyId || 'COMP-000001',
          name: name.trim(),
          category: category.trim(),
          unit: unit.trim() || 'قطعة',
          code: code.trim() || updatedData.items[idx].code,
          description: desc.trim(),
          quantity: qVal,
          purchasePrice: pPrice,
          costPrice: pPrice,
          salePrice: sPrice,
          normalSellingPrice: sPrice,
          wholesaleSellingPrice: Number((sPrice * 0.92).toFixed(2)),
          lastPurchaseDate: itemLastPurchaseDate.trim() || updatedData.items[idx].lastPurchaseDate,
          updatedAt: nowIso,
          updatedBy: currentUser?.name || 'مدير النظام',
        };
      }
      showToast('تم تعديل بيانات الصنف بنجاح', 'success');
    } else {
      const autoCode = code.trim() || `ITM-${String((appData.items?.length || 0) + 1).padStart(4, '0')}`;
      updatedData.items.push({
        id: 'i_' + Date.now(),
        companyId: appData.companyId || 'COMP-000001',
        branchId: appData.activeBranchId || 'main',
        code: autoCode,
        name: name.trim(),
        category: category.trim(),
        unit: unit.trim() || 'قطعة',
        description: desc.trim(),
        quantity: qVal,
        purchasePrice: pPrice,
        costPrice: pPrice,
        salePrice: sPrice,
        normalSellingPrice: sPrice,
        wholesaleSellingPrice: Number((sPrice * 0.92).toFixed(2)),
        lastPurchaseDate: itemLastPurchaseDate.trim() || undefined,
        movements: [],
        createdAt: nowIso,
        updatedAt: nowIso,
        createdBy: currentUser?.name || 'مدير النظام',
        createdByUserId: currentUser?.id,
        createdByUserCode: currentUser?.code || 1,
      });
      showToast('تم إضافة الصنف بنجاح', 'success');
    }

    onUpdateData(updatedData, {
      action: editingItem ? 'edit_item' : 'create_item',
      module: 'الأصناف والمخزون',
      details: `${editingItem ? 'تعديل' : 'إضافة'} صنف: ${name.trim()}`,
    });
    setIsModalOpen(false);
  };

  const handleDeleteItem = (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الصنف؟')) return;
    const targetItem = appData.items.find((i) => i.id === id);
    const updatedData = { ...appData };
    if (!updatedData.deletedRecords) updatedData.deletedRecords = {};
    updatedData.deletedRecords[`items_${id}`] = Date.now();
    updatedData.items = updatedData.items.filter((i) => i.id !== id);
    onUpdateData(updatedData, {
      action: 'delete_item',
      module: 'الأصناف والمخزون',
      details: `حذف الصنف: ${targetItem?.name || id}`,
      deletedId: id,
    });
    showToast('تم حذف الصنف بنجاح');
  };

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col space-y-4">
      {/* 🧭 Tabs for Items, Movement, and Inventory with full phone back support */}
      <div className="bg-white p-2 rounded-xl border-2 border-slate-200 flex items-center justify-between gap-2 shadow-xs select-none">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <button
            type="button"
            onClick={() => onNavigate?.('items')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              subPage === 'items'
                ? 'bg-[#1a237e] text-white shadow-xs'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <span>📦</span>
            <span>دليل وسجل الأصناف</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${subPage === 'items' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {appData.items?.length || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate?.('item_movement')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              subPage === 'item_movement'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <span>🔄</span>
            <span>حركة الصنف والمتابعة</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate?.('inventory')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              subPage === 'inventory'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <span>📊</span>
            <span>جرد وتقييم المخزون</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate?.('physical_inventory')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              subPage === 'physical_inventory'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <span>📋</span>
            <span>الجرد الفعلي والتسويات</span>
          </button>
        </div>

        <div className="hidden lg:flex items-center text-[11px] text-slate-500 font-mono px-3">
          نظام ركيزة • إدارة المستودعات والمخزون
        </div>
      </div>

      {/* 📊 ملخص وإحصائيات سجل الأصناف */}
      {subPage === 'items' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 select-none">
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border-2 border-indigo-200 p-3 sm:p-3.5 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between text-indigo-900 text-xs font-bold">
              <span>إجمالي الأصناف بالدليل</span>
              <span className="text-base sm:text-lg">📦</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-indigo-950 font-mono mt-1">
              {itemsStats.total.toLocaleString('ar-EG')}
              <span className="text-xs font-normal text-indigo-700 mr-1.5">صنف</span>
            </div>
            <div className="text-[11px] text-indigo-700 mt-0.5">
              {itemsStats.total >= 1001 ? 'أصناف ملف PDF الـ 1,001 مدمجة بالكامل' : 'سجل الأصناف والمستودعات'}
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 p-3 sm:p-3.5 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between text-emerald-900 text-xs font-bold">
              <span>أصناف تم شراؤها وتسعيرها</span>
              <span className="text-base sm:text-lg">✅</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-950 font-mono mt-1">
              {itemsStats.purchased.toLocaleString('ar-EG')}
              <span className="text-xs font-normal text-emerald-700 mr-1.5">صنف</span>
            </div>
            <div className="text-[11px] text-emerald-700 mt-0.5">
              تم إدخال رصيدها أو سعرها عند الشراء
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 p-3 sm:p-3.5 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between text-amber-900 text-xs font-bold">
              <span>بانتظار أول عملية شراء</span>
              <span className="text-base sm:text-lg">⏳</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-950 font-mono mt-1">
              {itemsStats.pending.toLocaleString('ar-EG')}
              <span className="text-xs font-normal text-amber-700 mr-1.5">صنف</span>
            </div>
            <div className="text-[11px] text-amber-700 mt-0.5">
              رصيدها وسعرها 0 (تتحدث آلياً عند الشراء)
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-fuchsia-50 border-2 border-purple-200 p-3 sm:p-3.5 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between text-purple-900 text-xs font-bold">
              <span>التصنيفات المتاحة</span>
              <span className="text-base sm:text-lg">📁</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-purple-950 font-mono mt-1">
              {uniqueCategories.length.toLocaleString('ar-EG')}
              <span className="text-xs font-normal text-purple-700 mr-1.5">تصنيف</span>
            </div>
            <div className="text-[11px] text-purple-700 mt-0.5">
              {itemsStats.unassignedCategory > 0 ? `${itemsStats.unassignedCategory} صنف بدون تصنيف حتى الآن` : 'جميع الأصناف مصنفة'}
            </div>
          </div>
        </div>
      )}

      {/* Search & Actions Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {subPage === 'items' && (
              <>
                <button
                  onClick={handleOpenAdd}
                  className="min-h-[42px] bg-[#2e7d32] hover:bg-[#1b5e20] active:bg-[#124116] text-white px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold transition cursor-pointer flex items-center justify-center gap-1 shadow-xs flex-1 sm:flex-initial"
                >
                  ➕ إضافة صنف جديد
                </button>
                <button
                  type="button"
                  onClick={handleOpenAddHierarchy}
                  className="min-h-[42px] bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs flex-1 sm:flex-initial"
                  title="إضافة مجموعة وبداخلها تصنيف وبداخلة نوع وبداخلة الصنف لتسهيل وتسريع الاختيار"
                >
                  <span>🌳</span>
                  <span>+ شجرة صنف (مجموعة &gt; تصنيف &gt; نوع &gt; صنف)</span>
                </button>
                <TableActionButtons
                  onPrint={handlePrintItems}
                  onExportExcel={handleExportItemsExcel}
                  printTitle="طباعة سجل الأصناف والمخزون"
                  exportTitle="تصدير كشف الأصناف إلى Excel"
                />
                {onShareCatalog && (
                  <button
                    type="button"
                    onClick={onShareCatalog}
                    className="min-h-[42px] bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 px-3.5 py-2 rounded-xl text-xs md:text-sm font-black transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                    title="مشاركة كتالوج المنتجات للعملاء وإنشاء QR Code"
                  >
                    <span>🛍️</span>
                    <span>مشاركة الكتالوج والـ QR</span>
                  </button>
                )}
                {/* زر دمج أصناف ملف PDF */}
                <button
                  type="button"
                  onClick={handleRestorePdfItems}
                  className="min-h-[42px] bg-indigo-700 hover:bg-indigo-800 active:bg-indigo-900 text-white px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                  title="إدراج ودمج كافة أصناف ملف PDF (1,001 صنف) بدون أعداد وبدون أسعار وبدون تصنيفات"
                >
                  <span>📥</span>
                  <span>دمج / استعادة أصناف PDF (1,001)</span>
                </button>
                {/* زر حذف جميع الأصناف دفعة واحدة */}
                <button
                  type="button"
                  onClick={handleDeleteAllItems}
                  className="min-h-[42px] bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                  title="حذف وتفريغ جميع الأصناف يدوياً دفعة واحدة في أي وقت"
                >
                  <span>🗑️</span>
                  <span>حذف جميع الأصناف</span>
                </button>
              </>
            )}
          </div>
          <div className="w-full sm:w-auto min-w-[240px]">
            <input
              type="text"
              placeholder="🔍 بحث باسم الصنف، الكود، التصنيف..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full min-h-[42px] px-3.5 py-2 border-2 border-gray-200 rounded-xl text-xs focus:border-[#1a237e] focus:outline-none"
            />
          </div>
        </div>

        {/* 🔍 أدوات التصفية والفلاتر الإضافية */}
        {subPage === 'items' && (
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-600 flex items-center gap-1">
                <span>📁</span>
                <span>التصنيف:</span>
              </span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="تصفية حسب التصنيف"
                className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 text-xs focus:outline-none focus:border-indigo-600"
              >
                <option value="all">كل التصنيفات ({appData.items?.length || 0})</option>
                <option value="uncategorized">أصناف بدون تصنيف ({itemsStats.unassignedCategory})</option>
                {uniqueCategories.map((cat) => {
                  const count = (appData.items || []).filter((i) => i.category?.trim() === cat).length;
                  return (
                    <option key={cat} value={cat}>
                      {cat} ({count})
                    </option>
                  );
                })}
              </select>

              <span className="font-bold text-slate-600 mr-2 flex items-center gap-1">
                <span>🛒</span>
                <span>حالة الشراء:</span>
              </span>
              <div className="inline-flex rounded-lg border border-slate-300 p-0.5 bg-slate-100">
                <button
                  type="button"
                  onClick={() => setPurchaseStatusFilter('all')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition ${
                    purchaseStatusFilter === 'all' ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  الكل
                </button>
                <button
                  type="button"
                  onClick={() => setPurchaseStatusFilter('purchased')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition ${
                    purchaseStatusFilter === 'purchased' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  تم الشراء ({itemsStats.purchased})
                </button>
                <button
                  type="button"
                  onClick={() => setPurchaseStatusFilter('pending')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition ${
                    purchaseStatusFilter === 'pending' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  بانتظار الشراء ({itemsStats.pending})
                </button>
              </div>
            </div>

            <div className="text-slate-500 font-bold text-[11px]">
              عدد النتائج المعروضة: <span className="font-mono text-indigo-900">{filteredItems.length}</span> صنف
            </div>
          </div>
        )}
      </div>

      {/* View Selector */}
      {subPage === 'items' && (
        <>
          {/* Mobile Card List View (< md) using paginatedItems */}
          <div className="block md:hidden space-y-3">
            {paginatedItems.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center text-gray-400 text-sm space-y-2">
                <div className="text-3xl">📦</div>
                <div>لا توجد أصناف مطابقة لخيارات البحث والتصفية</div>
              </div>
            ) : (
              paginatedItems.map((item) => {
                const totalVal = (item.quantity || 0) * (item.purchasePrice || 0);
                const isPendingPurchase = (!item.quantity || item.quantity === 0) && (!item.purchasePrice || item.purchasePrice === 0);
                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200 space-y-3 hover:border-indigo-300 transition"
                  >
                    {/* Top Row: Item Name, Code & Stock Quantity */}
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[#1a237e] font-black text-sm">📦 {item.name}</span>
                          {item.code && (
                            <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono font-bold">
                              {item.code}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            item.category && item.category.trim()
                              ? 'bg-purple-100 text-purple-900'
                              : 'bg-slate-100 text-slate-500 italic'
                          }`}>
                            📁 {item.category && item.category.trim() ? item.category : 'بدون تصنيف'}
                          </span>
                          <span className="text-[10px] text-slate-500 font-bold">
                            الوحدة: {item.unit || 'قطعة'}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-1 rounded-xl text-xs font-black font-mono shadow-xs shrink-0 ${
                          item.quantity < 0
                            ? 'bg-rose-100 text-rose-950 border-2 border-rose-400'
                            : isPendingPurchase
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : item.quantity === 0
                            ? 'bg-slate-100 text-slate-700 border border-slate-300'
                            : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        }`}
                      >
                        {item.quantity < 0
                          ? `⚠️ رصيد سالب: ${item.quantity}`
                          : isPendingPurchase
                          ? '0 • بانتظار الشراء'
                          : `الكمية: ${item.quantity}`}
                      </span>
                    </div>

                    {/* Middle: Description & Pricing Grid */}
                    {item.description && (
                      <div className="text-xs text-slate-500 italic">{item.description}</div>
                    )}

                    <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl text-center">
                      <div>
                        <div className="text-[10px] text-slate-500">سعر الشراء</div>
                        <div className="font-bold text-slate-800 text-xs mt-0.5">
                          {item.purchasePrice > 0 ? `${item.purchasePrice.toFixed(2)} ج.م` : <span className="text-amber-700 text-[10px]">بانتظار الشراء</span>}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500">سعر البيع</div>
                        <div className="font-bold text-indigo-900 text-xs mt-0.5">
                          {item.salePrice > 0 ? `${item.salePrice.toFixed(2)} ج.م` : <span className="text-slate-400 text-[10px]">0.00 ج.م</span>}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500">قيمة المخزون</div>
                        <div className="font-black text-emerald-700 text-xs mt-0.5">{totalVal.toFixed(2)} ج.م</div>
                      </div>
                    </div>

                    {/* Date of Purchase */}
                    <div className="flex items-center justify-between text-[11px] bg-slate-50 px-3 py-1.5 rounded-lg text-slate-600">
                      <span className="flex items-center gap-1 font-bold">
                        <span>📅</span>
                        <span>تاريخ الشراء:</span>
                      </span>
                      <span className="font-mono font-bold text-indigo-950">
                        {item.lastPurchaseDate ? item.lastPurchaseDate : 'لم يتم الشراء بعد'}
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="min-h-[44px] bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1 cursor-pointer border border-amber-200"
                      >
                        ✏️ تعديل الصنف
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="min-h-[44px] bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1 cursor-pointer border border-rose-200"
                      >
                        🗑️ حذف الصنف
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table View (>= md) using paginatedItems */}
          <div className="hidden md:block bg-white rounded-2xl p-4 shadow-xs overflow-x-auto">
            <table className="w-full text-right text-xs md:text-sm border-collapse">
              <thead>
                <tr className="bg-[#1a237e] text-white">
                  <th className="p-3 rounded-r-lg">#</th>
                  <th className="p-3">كود الصنف</th>
                  <th className="p-3">اسم الصنف</th>
                  <th className="p-3">التصنيف / الفئة</th>
                  <th className="p-3">الوحدة</th>
                  <th className="p-3">الكمية الحالية</th>
                  <th className="p-3">سعر الشراء (ج.م)</th>
                  <th className="p-3">سعر البيع (ج.م)</th>
                  <th className="p-3">قيمة المخزون</th>
                  <th className="p-3">تاريخ الشراء</th>
                  <th className="p-3 rounded-l-lg">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-8 text-gray-400">
                      لا توجد أصناف مسجلة تطابق معايير البحث
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((item, idx) => {
                    const rowNumber = pageSize === -1 ? idx + 1 : (currentPage - 1) * pageSize + idx + 1;
                    const totalVal = (item.quantity || 0) * (item.purchasePrice || 0);
                    const isPendingPurchase = (!item.quantity || item.quantity === 0) && (!item.purchasePrice || item.purchasePrice === 0);
                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition">
                        <td className="p-3 font-mono text-slate-400 text-xs">{rowNumber}</td>
                        <td className="p-3 font-mono text-slate-600 font-bold text-xs">{item.code || '-'}</td>
                        <td className="p-3 font-bold text-[#1a237e]">
                          {item.name}
                          {item.description && (
                            <div className="text-[11px] text-slate-400 font-normal">{item.description}</div>
                          )}
                        </td>
                        <td className="p-3">
                          {item.category && item.category.trim() ? (
                            <span className="bg-purple-100 text-purple-900 px-2 py-0.5 rounded-md text-xs font-bold">
                              📁 {item.category}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-xs">بدون تصنيف</span>
                          )}
                        </td>
                        <td className="p-3 text-slate-600 font-medium">{item.unit || 'قطعة'}</td>
                        <td className="p-3">
                          {item.quantity < 0 ? (
                            <span className="inline-flex items-center gap-1 font-mono font-black text-rose-950 bg-rose-100 border-2 border-rose-400 rounded-lg px-2.5 py-1 text-xs shadow-xs">
                              ⚠️ رصيد سالب: {item.quantity}
                            </span>
                          ) : isPendingPurchase ? (
                            <span className="inline-flex items-center gap-1 font-mono font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-300 text-xs">
                              ⏳ 0 (بانتظار الشراء)
                            </span>
                          ) : item.quantity === 0 ? (
                            <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              0 (نفد الرصيد)
                            </span>
                          ) : (
                            <span className="font-mono font-bold text-slate-900 bg-emerald-50 text-emerald-900 px-2 py-0.5 rounded border border-emerald-200">
                              {item.quantity}
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-mono">
                          {item.purchasePrice > 0 ? (
                            item.purchasePrice.toFixed(2)
                          ) : (
                            <span className="text-slate-400 text-xs">0.00</span>
                          )}
                        </td>
                        <td className="p-3 font-mono font-semibold text-indigo-900">
                          {item.salePrice > 0 ? item.salePrice.toFixed(2) : <span className="text-slate-400 text-xs">0.00</span>}
                        </td>
                        <td className="p-3 font-mono font-bold text-[#2e7d32]">{totalVal.toFixed(2)}</td>
                        <td className="p-3 text-xs">
                          {item.lastPurchaseDate ? (
                            <span className="font-mono font-bold text-indigo-950 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                              📅 {item.lastPurchaseDate}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">لم يُشتر بعد</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(item)}
                              className="bg-[#f57f17] hover:bg-[#e65100] text-white p-2 rounded-lg text-xs transition cursor-pointer"
                              title="تعديل بيانات الصنف والتصنيف والأسعار"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="bg-[#c62828] hover:bg-[#b71c1c] text-white p-2 rounded-lg text-xs transition cursor-pointer"
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

          {/* 📄 شريط التنقل بين الصفحات والتحكم بالحجم (Pagination Controls) */}
          {filteredItems.length > 0 && (
            <div className="bg-white p-3 rounded-2xl shadow-xs border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs select-none">
              <div className="flex items-center gap-2">
                <span className="text-slate-600 font-bold">عرض بالصفحة:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  aria-label="عدد الأصناف بالصفحة"
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 text-xs focus:outline-none focus:border-indigo-600"
                >
                  <option value={25}>25 صنف</option>
                  <option value={50}>50 صنف</option>
                  <option value={100}>100 صنف</option>
                  <option value={250}>250 صنف</option>
                  <option value={500}>500 صنف</option>
                  <option value={-1}>عرض الكل ({filteredItems.length})</option>
                </select>

                <span className="text-slate-400 mr-2">
                  عرض {pageSize === -1 ? `1 - ${filteredItems.length}` : `${Math.min((currentPage - 1) * pageSize + 1, filteredItems.length)} - ${Math.min(currentPage * pageSize, filteredItems.length)}`} من إجمالي {filteredItems.length} صنف
                </span>
              </div>

              {pageSize !== -1 && totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 font-bold"
                    title="الصفحة الأولى"
                  >
                    ⏮️
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 font-bold flex items-center gap-1"
                  >
                    <span>السابق</span>
                  </button>

                  <div className="px-3 py-1 font-mono font-bold text-indigo-950 bg-indigo-50 border border-indigo-200 rounded-lg">
                    صفحة {currentPage} من {totalPages}
                  </div>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 font-bold flex items-center gap-1"
                  >
                    <span>التالي</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 font-bold"
                    title="الصفحة الأخيرة"
                  >
                    ⏭️
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {subPage === 'item_movement' && (
        <div className="bg-white rounded-2xl p-3.5 sm:p-4 shadow-sm space-y-4 max-w-full overflow-hidden">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h4 className="font-bold text-[#1a237e] text-base">سجل حركة الأصناف والعمليات المخزنية</h4>
              <p className="text-xs text-slate-500">متابعة دقيقة لحركة الوارد والمنصرف والمرتجع والتسويات للأصناف</p>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
              <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">🟢 بيع نقدي</span>
              <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full">🟠 بيع آجل</span>
              <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">🔵 شراء</span>
              <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full">🔴 مرتجع</span>
            </div>
          </div>

          {/* Mobile Movements Cards (< md) */}
          <div className="block md:hidden space-y-3">
            {filteredItems.map((item) => {
              const moves = item.movements || [];
              const recentMoves = moves.slice(-3).reverse();
              return (
                <div key={item.id} className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="font-bold text-[#1a237e] text-sm">{item.name}</span>
                    <span className="font-mono font-bold bg-white px-2 py-0.5 rounded-lg border border-slate-200 text-slate-800">
                      رصيد: {item.quantity}
                    </span>
                  </div>
                  <div className="text-slate-500 font-medium">إجمالي الحركات: {moves.length} حركة</div>
                  <div className="space-y-1.5 pt-1">
                    {recentMoves.length === 0 ? (
                      <span className="text-slate-400 text-[11px]">لا توجد حركات مسجلة</span>
                    ) : (
                      recentMoves.map((m, idx) => {
                        const isCashSale = m.note?.includes('نقدي') && m.type === 'sale';
                        const isCreditSale = m.note?.includes('آجل') && m.type === 'sale';
                        const isReturn = m.type?.includes('return');
                        const isPurchase = m.type === 'purchase';
                        return (
                          <div key={idx} className="flex items-center justify-between text-[11px] bg-white p-2 rounded-xl border border-slate-200">
                            <span className="font-mono text-slate-500">{m.date}</span>
                            <span
                              className={`px-1.5 py-0.5 rounded-md font-bold text-[10px] ${
                                isCashSale
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isCreditSale
                                  ? 'bg-amber-100 text-amber-800'
                                  : isPurchase
                                  ? 'bg-blue-100 text-blue-800'
                                  : isReturn
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {m.note || m.type}
                            </span>
                            <span className="font-mono font-bold">
                              {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Movements Table (>= md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-right text-xs md:text-sm">
            <thead>
              <tr className="bg-[#1a237e] text-white">
                <th className="p-3 rounded-r-lg">اسم الصنف</th>
                <th className="p-3">الرصيد المتاح</th>
                <th className="p-3">إجمالي الحركات</th>
                <th className="p-3 rounded-l-lg">سجل أحدث الحركات والنوع</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredItems.map((item) => {
                const moves = item.movements || [];
                const recentMoves = moves.slice(-3).reverse();
                return (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-[#1a237e]">{item.name}</td>
                    <td className="p-3 font-mono font-bold text-slate-900">{item.quantity}</td>
                    <td className="p-3 font-mono">{moves.length} حركة</td>
                    <td className="p-3">
                      {recentMoves.length === 0 ? (
                        <span className="text-gray-400">لا توجد حركات مسجلة</span>
                      ) : (
                        <div className="space-y-1">
                          {recentMoves.map((m, idx) => {
                            const isCashSale = m.note?.includes('نقدي') && m.type === 'sale';
                            const isCreditSale = m.note?.includes('آجل') && m.type === 'sale';
                            const isReturn = m.type?.includes('return');
                            const isPurchase = m.type === 'purchase';
                            return (
                              <div key={idx} className="flex items-center gap-1.5 text-[11px] bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                                <span className="font-mono text-slate-500">{m.date}</span>
                                <span
                                  className={`px-1.5 py-0.5 rounded-md font-bold text-[10px] ${
                                    isCashSale
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : isCreditSale
                                      ? 'bg-amber-100 text-amber-900'
                                      : isPurchase
                                      ? 'bg-blue-100 text-blue-800'
                                      : isReturn
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-slate-200 text-slate-700'
                                  }`}
                                >
                                  {isCashSale
                                    ? '🟢 بيع نقدي'
                                    : isCreditSale
                                    ? '🟠 بيع آجل'
                                    : isPurchase
                                    ? '🔵 شراء'
                                    : isReturn
                                    ? '🔴 مرتجع'
                                    : '⚙️ حركة'}
                                </span>
                                <span className="font-mono font-bold text-indigo-900">
                                  {m.qty > 0 ? `+${m.qty}` : m.qty}
                                </span>
                                <span className="text-slate-600 truncate max-w-[200px]">{m.note}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </div>
      )}

      {subPage === 'inventory' && (
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
          <h4 className="font-bold text-[#1a237e]">تقييم وإجمالي المخزون</h4>
          {/* Mobile Inventory Valuation Cards (< md) */}
          <div className="block md:hidden space-y-2.5">
            {filteredItems.map((item) => (
              <div key={item.id} className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex items-center justify-between font-bold">
                  <span className="text-slate-900">{item.name}</span>
                  <span className="text-[#2e7d32] font-mono">
                    {((item.quantity || 0) * (item.purchasePrice || 0)).toFixed(2)} ج.م
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>الكمية: <strong className="font-mono text-slate-800">{item.quantity}</strong></span>
                  <span>سعر الشراء: <strong className="font-mono text-slate-800">{item.purchasePrice.toFixed(2)} ج.م</strong></span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Inventory Valuation Table (>= md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-right text-xs md:text-sm">
              <tbody className="divide-y divide-gray-100">
                {filteredItems.map((item) => (
                  <tr key={item.id}>
                    <td className="p-3 font-bold">{item.name}</td>
                    <td className="p-3">{item.quantity}</td>
                    <td className="p-3">{item.purchasePrice.toFixed(2)} ج.م</td>
                    <td className="p-3 font-bold text-[#2e7d32]">
                      {((item.quantity || 0) * (item.purchasePrice || 0)).toFixed(2)} ج.م
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-slate-100 p-3 rounded-xl text-center font-bold text-base text-[#1a237e]">
            إجمالي قيمة كامل المخزون الحالية:{' '}
            {appData.items
              .reduce((sum, item) => sum + (item.quantity || 0) * (item.purchasePrice || 0), 0)
              .toFixed(2)}{' '}
            ج.م
          </div>
        </div>
      )}

      {/* Add / Edit Item Modal */}
      <Modal
        isOpen={isModalOpen}
        title={editingItem ? '✏️ تعديل بيانات الصنف والتسعير' : '➕ إضافة صنف جديد للدليل'}
        onClose={() => setIsModalOpen(false)}
        footer={
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <button
              onClick={handleSaveItem}
              className="min-h-[44px] bg-[#2e7d32] hover:bg-[#1b5e20] active:bg-[#124116] text-white px-6 py-2.5 rounded-xl font-bold cursor-pointer transition shadow-xs flex-1 sm:flex-initial text-center flex items-center justify-center gap-1.5"
            >
              <span>💾</span>
              <span>حفظ بيانات الصنف</span>
            </button>
            <button
              onClick={() => setIsModalOpen(false)}
              className="min-h-[44px] bg-gray-400 hover:bg-gray-500 active:bg-gray-600 text-white px-6 py-2.5 rounded-xl font-bold cursor-pointer transition flex-1 sm:flex-initial text-center"
            >
              إلغاء
            </button>
          </div>
        }
      >
        <div className="space-y-3.5 text-xs md:text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold mb-1 text-slate-800">اسم الصنف <span className="text-rose-500">*</span></label>
              <input
                type="text"
                placeholder="اسم الصنف المعتمد..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none font-bold"
              />
            </div>
            <div>
              <label className="block font-bold mb-1 text-slate-800">كود الصنف / الباركود</label>
              <input
                type="text"
                placeholder="مثال: ITM-0001 أو باركود..."
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold mb-1 text-slate-800">التصنيف / الفئة</label>
              <input
                type="text"
                list="items-category-datalist"
                placeholder="اكتب أو اختر التصنيف..."
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none font-bold"
              />
              <datalist id="items-category-datalist">
                {uniqueCategories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block font-bold mb-1 text-slate-800">الوحدة</label>
              <input
                type="text"
                placeholder="قطعة، كرتونة، كيلو..."
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold mb-1 text-slate-800">تاريخ الشراء / التحديث</label>
              <input
                type="date"
                value={itemLastPurchaseDate}
                onChange={(e) => setItemLastPurchaseDate(e.target.value)}
                className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold mb-1 text-slate-800">الوصف والمواصفات</label>
            <input
              type="text"
              placeholder="وصف مختصر أو مواصفات الصنف..."
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <div>
              <label className="block font-bold mb-1 text-slate-700">الكمية الحالية</label>
              <input
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="w-full p-2.5 bg-white border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none font-mono font-bold"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">0 = بانتظار الشراء</span>
            </div>
            <div>
              <label className="block font-bold mb-1 text-slate-700">سعر الشراء (ج.م)</label>
              <input
                type="number"
                step="0.01"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                className="w-full p-2.5 bg-white border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none font-mono font-bold"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">يُحدث آلياً عند الشراء</span>
            </div>
            <div>
              <label className="block font-bold mb-1 text-slate-700">سعر البيع (ج.م)</label>
              <input
                type="number"
                step="0.01"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                className="w-full p-2.5 bg-white border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none font-mono font-bold text-indigo-900"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">سعر البيع المعتمد</span>
            </div>
          </div>
        </div>
      </Modal>

      {/* 🌳 Modal إضافة هيكل شجري متكامل (مجموعة > تصنيف > نوع > صنف) */}
      <Modal
        isOpen={isHierarchyModalOpen}
        title="🌳 إضافة شجرة صنف (مجموعة > تصنيف > نوع > صنف)"
        onClose={() => setIsHierarchyModalOpen(false)}
        footer={
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <button
              onClick={handleSaveHierarchyItem}
              className="min-h-[44px] bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white px-6 py-2.5 rounded-xl font-bold cursor-pointer transition shadow-xs flex-1 sm:flex-initial text-center flex items-center justify-center gap-1.5"
            >
              <span>💾</span>
              <span>حفظ وتثبيت الشجرة</span>
            </button>
            <button
              onClick={() => setIsHierarchyModalOpen(false)}
              className="min-h-[44px] bg-gray-400 hover:bg-gray-500 active:bg-gray-600 text-white px-6 py-2.5 rounded-xl font-bold cursor-pointer transition flex-1 sm:flex-initial text-center"
            >
              إلغاء
            </button>
          </div>
        }
      >
        <div className="space-y-3.5 text-xs md:text-sm">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-800 text-[11px] leading-relaxed">
            💡 يتيح لك هذا النموذج إدراج هيكل شجري متسلسل للصنف الجديد: اختر أو اكتب اسم المجموعة ثم التصنيف والنوع والصنف النهائي لتسهيل الاختيار السريع عند إصدار الفواتير.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 1. المجموعة */}
            <div>
              <label className="block font-bold text-teal-800 mb-1">1. المجموعة الرئيسية</label>
              <input
                type="text"
                placeholder="اكتب اسم المجموعة..."
                value={hierGroup}
                onChange={(e) => setHierGroup(e.target.value)}
                className="w-full p-2.5 border-2 border-teal-200 rounded-xl focus:border-teal-600 focus:outline-none font-bold"
              />
            </div>

            {/* 2. التصنيف */}
            <div>
              <label className="block font-bold text-blue-800 mb-1">2. التصنيف / الشركة</label>
              <input
                type="text"
                placeholder="اكتب اسم التصنيف أو الشركة..."
                value={hierCompany}
                onChange={(e) => setHierCompany(e.target.value)}
                className="w-full p-2.5 border-2 border-blue-200 rounded-xl focus:border-blue-600 focus:outline-none font-bold"
              />
            </div>

            {/* 3. النوع */}
            <div>
              <label className="block font-bold text-purple-800 mb-1">3. النوع / القسم الفرعي</label>
              <input
                type="text"
                placeholder="اكتب اسم النوع أو القسم الفرعي..."
                value={hierType}
                onChange={(e) => setHierType(e.target.value)}
                className="w-full p-2.5 border-2 border-purple-200 rounded-xl focus:border-purple-600 focus:outline-none font-bold"
              />
            </div>
          </div>

          {/* 4. اسم الصنف النهائي */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-900 mb-1">4. اسم الصنف النهائي</label>
              <input
                type="text"
                placeholder="اسم الصنف بالكامل..."
                value={hierItemName}
                onChange={(e) => setHierItemName(e.target.value)}
                className="w-full p-2.5 border-2 border-indigo-300 rounded-xl focus:border-indigo-600 focus:outline-none font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">كود الصنف</label>
              <input
                type="text"
                placeholder="كود الصنف..."
                value={hierItemCode}
                onChange={(e) => setHierItemCode(e.target.value)}
                className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-indigo-600 focus:outline-none text-center font-mono"
              />
            </div>
          </div>

          {/* الأسعار والكمية */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div>
              <label className="block font-bold text-slate-700 mb-1 text-[11px]">الكمية بالمخزن</label>
              <input
                type="number"
                min="0"
                step="any"
                value={hierQty}
                onChange={(e) => setHierQty(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg text-center font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-rose-700 mb-1 text-[11px]">سعر الشراء (التكلفة)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={hierPurchasePrice}
                onChange={(e) => setHierPurchasePrice(e.target.value)}
                className="w-full p-2 border border-rose-300 rounded-lg text-center font-bold text-rose-700"
              />
            </div>
            <div>
              <label className="block font-bold text-emerald-700 mb-1 text-[11px]">سعر البيع (قطاعي)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={hierSalePrice}
                onChange={(e) => setHierSalePrice(e.target.value)}
                className="w-full p-2 border border-emerald-300 rounded-lg text-center font-bold text-emerald-700"
              />
            </div>
            <div>
              <label className="block font-bold text-amber-700 mb-1 text-[11px]">سعر الجملة</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={hierWholesalePrice}
                onChange={(e) => setHierWholesalePrice(e.target.value)}
                className="w-full p-2 border border-amber-300 rounded-lg text-center font-bold text-amber-700"
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
