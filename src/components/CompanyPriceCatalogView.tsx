import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Building2,
  Tags,
  PlusCircle,
  FolderPlus,
  Layers,
  Percent,
  Printer,
  Search,
  Pencil,
  Trash2,
  X,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
} from 'lucide-react';
import { AppData, Item } from '../types';
import { exportToExcel } from '../utils/excelExport';

interface CompanyPriceCatalogViewProps {
  appData: AppData;
  onUpdateData: (newData: AppData, actionInfo?: { action?: string; module?: string; details?: string; deletedId?: string | number }) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onNavigate?: (page: string) => void;
}

export const CompanyPriceCatalogView: React.FC<CompanyPriceCatalogViewProps> = ({
  appData,
  onUpdateData,
  showToast,
  onNavigate,
}) => {
  // 1. Persistent Storage of Companies and Categories
  const [companiesDB, setCompaniesDB] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('rakeeza_comps_clean');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}

    // Derive companies from existing items or company name
    const set = new Set<string>();
    if (appData.settings?.companyName) set.add(appData.settings.companyName);
    (appData.items || []).forEach((i) => {
      const comp = (i as any).company || (i as any).brand;
      if (comp) set.add(comp.trim());
    });
    const arr = Array.from(set);
    return arr.length > 0 ? arr : ['الشركة العامة'];
  });

  const [categoriesDB, setCategoriesDB] = useState<Record<string, string[]>>(() => {
    try {
      const saved = localStorage.getItem('rakeeza_cats_clean');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {}

    const map: Record<string, string[]> = {};
    companiesDB.forEach((c) => {
      map[c] = ['عام'];
    });
    (appData.items || []).forEach((i) => {
      const comp = (i as any).company || (i as any).brand || companiesDB[0] || 'الشركة العامة';
      const cat = i.category || 'عام';
      if (!map[comp]) map[comp] = ['عام'];
      if (!map[comp].includes(cat)) map[comp].push(cat);
    });
    return map;
  });

  // Save companies and categories to localStorage on changes
  useEffect(() => {
    try {
      localStorage.setItem('rakeeza_comps_clean', JSON.stringify(companiesDB));
      localStorage.setItem('rakeeza_cats_clean', JSON.stringify(categoriesDB));
    } catch {}
  }, [companiesDB, categoriesDB]);

  // Filters State
  const [filterCompany, setFilterCompany] = useState<string>(() => companiesDB[0] || '');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals State
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [modalCatCompany, setModalCatCompany] = useState<string>(() => companiesDB[0] || '');
  const [newCategoryName, setNewCategoryName] = useState('');

  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number>(-1);
  const [modalItemCompany, setModalItemCompany] = useState<string>('');
  const [modalItemCategory, setModalItemCategory] = useState<string>('عام');
  const [inputName, setInputName] = useState('');
  const [inputDesc, setInputDesc] = useState('');
  const [inputBuyPrice, setInputBuyPrice] = useState('');
  const [inputSellPrice, setInputSellPrice] = useState('');
  const [inputQuantity, setInputQuantity] = useState('10');

  const [isBulkPriceModalOpen, setIsBulkPriceModalOpen] = useState(false);
  const [bulkScope, setBulkScope] = useState<'all' | 'company' | 'category'>('all');
  const [bulkCompany, setBulkCompany] = useState<string>(() => companiesDB[0] || '');
  const [bulkCategory, setBulkCategory] = useState<string>('all');
  const [bulkPercentage, setBulkPercentage] = useState<string>('10');

  // Long press / Action Menu State
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [selectedItemForMenu, setSelectedItemForMenu] = useState<Item | null>(null);

  // Synchronize filterCompany if empty
  useEffect(() => {
    if (!filterCompany && companiesDB.length > 0) {
      setFilterCompany(companiesDB[0]);
    }
  }, [companiesDB, filterCompany]);

  // Synchronize modalCatCompany
  useEffect(() => {
    if (companiesDB.length > 0 && !companiesDB.includes(modalCatCompany)) {
      setModalCatCompany(companiesDB[0]);
    }
  }, [companiesDB, modalCatCompany]);

  // Filtered Categories for dropdown
  const availableCategoriesForFilter = useMemo(() => {
    return categoriesDB[filterCompany] || ['عام'];
  }, [categoriesDB, filterCompany]);

  // Derived Items from appData.items
  const itemsList = useMemo(() => {
    return appData.items || [];
  }, [appData.items]);

  // Filtered Table Items
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return itemsList.filter((item) => {
      const itemComp = (item as any).company || (item as any).brand || companiesDB[0] || '';
      const matchComp = !filterCompany || itemComp === filterCompany;

      const itemCat = item.category || 'عام';
      const matchCat = filterCategory === 'all' || itemCat === filterCategory;

      const matchQ =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.code && item.code.toLowerCase().includes(q)) ||
        ((item as any).description && (item as any).description.toLowerCase().includes(q)) ||
        ((item as any).spec && (item as any).spec.toLowerCase().includes(q)) ||
        itemCat.toLowerCase().includes(q);

      return matchComp && matchCat && matchQ;
    });
  }, [itemsList, filterCompany, filterCategory, searchQuery, companiesDB]);

  // Calculated Profit Margin in Item Modal
  const modalProfitInfo = useMemo(() => {
    const buy = parseFloat(inputBuyPrice) || 0;
    const sell = parseFloat(inputSellPrice) || 0;
    const profit = sell - buy;
    const pct = buy > 0 ? ((profit / buy) * 100).toFixed(1) : '0';
    return { profit, pct };
  }, [inputBuyPrice, inputSellPrice]);

  // 1. Save New Company
  const handleSaveCompany = () => {
    const name = newCompanyName.trim();
    if (!name) {
      showToast('يرجى إدخال اسم الشركة أو المجموعة', 'warning');
      return;
    }
    if (companiesDB.includes(name)) {
      showToast('هذه الشركة مسجلة مسبقاً', 'warning');
      return;
    }

    const updatedComps = [...companiesDB, name];
    setCompaniesDB(updatedComps);
    setCategoriesDB((prev) => ({
      ...prev,
      [name]: ['عام'],
    }));

    setFilterCompany(name);
    setIsCompanyModalOpen(false);
    setNewCompanyName('');
    showToast(`✅ تم إنشاء الشركة [${name}] وتثبيتها بنجاح`, 'success');
  };

  // 2. Save New Category for Company
  const handleSaveCategory = () => {
    const cat = newCategoryName.trim();
    if (!cat) {
      showToast('يرجى إدخال اسم التصنيف (الفئة)', 'warning');
      return;
    }
    const currentCats = categoriesDB[modalCatCompany] || [];
    if (currentCats.includes(cat)) {
      showToast('هذا التصنيف مثبت مسبقاً تحت هذه الشركة', 'warning');
      return;
    }

    setCategoriesDB((prev) => ({
      ...prev,
      [modalCatCompany]: [...(prev[modalCatCompany] || []), cat],
    }));

    setFilterCompany(modalCatCompany);
    setFilterCategory(cat);
    setIsCategoryModalOpen(false);
    setNewCategoryName('');
    showToast(`✅ تم تثبيت التصنيف [${cat}] بنجاح تحت شركة (${modalCatCompany})`, 'success');
  };

  // 3. Open Add Item Modal
  const handleOpenAddItem = () => {
    if (companiesDB.length === 0) {
      showToast('يرجى إضافة شركة أولاً قبل إدراج الأصناف', 'warning');
      return;
    }
    setEditingItemIndex(-1);
    setSelectedItemForMenu(null);
    const activeComp = filterCompany || companiesDB[0];
    setModalItemCompany(activeComp);
    const cats = categoriesDB[activeComp] || ['عام'];
    setModalItemCategory(filterCategory !== 'all' ? filterCategory : cats[0] || 'عام');
    setInputName('');
    setInputDesc('');
    setInputBuyPrice('');
    setInputSellPrice('');
    setInputQuantity('10');
    setIsItemModalOpen(true);
  };

  // 4. Open Edit Item Modal
  const handleOpenEditItem = (item: Item) => {
    const comp = (item as any).company || filterCompany || companiesDB[0];
    setEditingItemIndex(1);
    setModalItemCompany(comp);
    setModalItemCategory(item.category || 'عام');
    setInputName(item.name);
    setInputDesc((item as any).description || (item as any).spec || '');
    setInputBuyPrice(String(item.costPrice ?? item.purchasePrice ?? 0));
    setInputSellPrice(String(item.salePrice ?? item.price ?? 0));
    setInputQuantity(String(item.quantity ?? 0));
    setSelectedItemForMenu(item);
    setIsItemModalOpen(true);
    setIsActionMenuOpen(false);
  };

  // 5. Save Item Data (Adds/Updates directly in appData.items and syncs across ERP & Inventory)
  const handleSaveItem = () => {
    const name = inputName.trim();
    if (!name) {
      showToast('يرجى إدخال اسم الصنف', 'warning');
      return;
    }

    const buyPrice = parseFloat(inputBuyPrice) || 0;
    const sellPrice = parseFloat(inputSellPrice) || 0;
    const qty = parseFloat(inputQuantity) || 0;
    const desc = inputDesc.trim();
    const comp = modalItemCompany || filterCompany || companiesDB[0] || 'الشركة العامة';
    const cat = modalItemCategory || 'عام';

    // Ensure company and category are tracked
    if (!companiesDB.includes(comp)) {
      setCompaniesDB((prev) => [...prev, comp]);
    }
    if (!categoriesDB[comp] || !categoriesDB[comp].includes(cat)) {
      setCategoriesDB((prev) => ({
        ...prev,
        [comp]: [...(prev[comp] || []), cat],
      }));
    }

    let updatedItems = [...(appData.items || [])];

    if (selectedItemForMenu && isItemModalOpen && editingItemIndex !== -1) {
      // Edit Existing Item & sync inventory
      const prevQty = Number(selectedItemForMenu.quantity ?? 0);
      const qtyDiff = qty - prevQty;
      let updatedMovements = [...(selectedItemForMenu.movements || [])];
      if (qtyDiff !== 0) {
        updatedMovements.push({
          date: new Date().toISOString().split('T')[0],
          type: 'adjustment',
          qty: Math.abs(qtyDiff),
          price: buyPrice,
          total: Math.abs(qtyDiff) * buyPrice,
          note: `تسوية وتعديل رصيد مخزني من قائمة أسعار الشركات (${prevQty} -> ${qty})`,
        });
      }

      updatedItems = updatedItems.map((it) => {
        if (it.id === selectedItemForMenu.id) {
          return {
            ...it,
            name,
            category: cat,
            costPrice: buyPrice,
            purchasePrice: buyPrice,
            price: sellPrice,
            salePrice: sellPrice,
            normalSellingPrice: sellPrice,
            wholesalePrice: it.wholesalePrice || sellPrice * 0.95,
            quantity: qty,
            movements: updatedMovements,
            description: desc,
            spec: desc,
            company: comp,
            brand: comp,
          };
        }
        return it;
      });

      const updatedData: AppData = {
        ...appData,
        items: updatedItems,
      };

      onUpdateData(updatedData, {
        action: 'تعديل صنف وتسعير ومخزون',
        module: 'إدارة الأسعار والشركات',
        details: `تعديل صنف [${name}] - سعر البيع: ${sellPrice} ج.م - الشراء: ${buyPrice} ج.م - الرصيد: ${qty}`,
      });

      showToast(`✅ تم تحديث بيانات الصنف [${name}] وتطبيق الأسعار والرصيد على كافة المعاملات والمخزن`, 'success');
    } else {
      // Add Brand New Item & initialize inventory
      let maxCode = 0;
      (appData.items || []).forEach((i) => {
        const num = parseInt(String(i.code || '').replace(/\D/g, '')) || 0;
        if (num > maxCode) maxCode = num;
      });
      const generatedCode = '1' + String(maxCode + 1).padStart(3, '0');

      const newItem: Item = {
        id: `it_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        code: generatedCode,
        name,
        category: cat,
        costPrice: buyPrice,
        purchasePrice: buyPrice,
        price: sellPrice,
        salePrice: sellPrice,
        normalSellingPrice: sellPrice,
        wholesalePrice: sellPrice * 0.95,
        quantity: qty,
        minStockAlert: 5,
        description: desc,
        spec: desc,
        company: comp,
        brand: comp,
        movements: [
          {
            date: new Date().toISOString().split('T')[0],
            type: 'adjustment',
            qty: qty,
            price: buyPrice,
            total: qty * buyPrice,
            note: 'رصيد افتتاحي أولي من قائمة أسعار الشركات والتصنيفات',
          },
        ],
      } as any;

      updatedItems = [newItem, ...updatedItems];

      const updatedData: AppData = {
        ...appData,
        items: updatedItems,
      };

      onUpdateData(updatedData, {
        action: 'إضافة صنف جديد بالمخزون',
        module: 'إدارة الأسعار والشركات',
        details: `إضافة صنف [${name}] تحت شركة [${comp}] وتصنيف [${cat}] برصيد ${qty}`,
      });

      showToast(`✅ تم حفظ الصنف [${name}] وإدراجه في المخزون والفواتير فورياً`, 'success');
    }

    setIsItemModalOpen(false);
    setSelectedItemForMenu(null);
  };

  // 6. Delete Item (Removes from appData.items)
  const handleDeleteItem = (item: Item) => {
    if (!confirm(`هل أنت متأكد من حذف الصنف [${item.name}] نهائياً من النظام والمخزون؟`)) {
      return;
    }

    const updatedItems = (appData.items || []).filter((i) => i.id !== item.id);
    const updatedData: AppData = {
      ...appData,
      items: updatedItems,
    };

    onUpdateData(updatedData, {
      action: 'حذف صنف',
      module: 'إدارة الأسعار والشركات',
      details: `حذف الصنف [${item.name}] من قائمة الأسعار والمخزون`,
      deletedId: item.id,
    });

    setIsActionMenuOpen(false);
    setSelectedItemForMenu(null);
    showToast(`🗑️ تم حذف الصنف [${item.name}] بنجاح`, 'info');
  };

  // 7. Apply Bulk Price Increase (%)
  const handleApplyBulkPriceIncrease = () => {
    const pct = parseFloat(bulkPercentage);
    if (isNaN(pct) || pct === 0) {
      showToast('يرجى إدخال نسبة مئوية صحيحة للزيادة', 'warning');
      return;
    }

    let affectedCount = 0;
    const factor = 1 + pct / 100;

    const updatedItems = (appData.items || []).map((item) => {
      const comp = (item as any).company || (item as any).brand || companiesDB[0] || '';
      const cat = item.category || 'عام';

      let match = false;
      if (bulkScope === 'all') match = true;
      else if (bulkScope === 'company' && comp === bulkCompany) match = true;
      else if (bulkScope === 'category' && comp === bulkCompany && cat === bulkCategory) match = true;

      if (match) {
        affectedCount++;
        const currentBuy = Number(item.costPrice ?? item.purchasePrice ?? 0);
        const currentSell = Number(item.salePrice ?? item.price ?? 0);
        const newBuy = parseFloat((currentBuy * factor).toFixed(2));
        const newSell = parseFloat((currentSell * factor).toFixed(2));

        return {
          ...item,
          costPrice: newBuy,
          purchasePrice: newBuy,
          price: newSell,
          salePrice: newSell,
          normalSellingPrice: newSell,
          wholesalePrice: parseFloat(((item.wholesalePrice || newSell * 0.95) * factor).toFixed(2)),
        };
      }
      return item;
    });

    const updatedData: AppData = {
      ...appData,
      items: updatedItems,
    };

    onUpdateData(updatedData, {
      action: 'تحديث ورفع أسعار جماعي',
      module: 'إدارة الأسعار والشركات',
      details: `زيادة بنسبة ${pct}% على ${affectedCount} صنف - النطاق: ${bulkScope}`,
    });

    setIsBulkPriceModalOpen(false);
    showToast(`🚀 تم رفع وتحديث الأسعار بنسبة ${pct}% لـ (${affectedCount}) صنف بنجاح`, 'success');
  };

  // 8. Direct Print
  const handlePrintCatalog = () => {
    window.print();
  };

  // 9. Export to Excel
  const handleExportExcel = () => {
    exportToExcel({
      filename: `قائمة_أسعار_${filterCompany || 'الشركات'}_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'قائمة الأسعار',
      data: filteredItems,
      columns: [
        { header: 'الباركود', key: 'code', width: 14 },
        { header: 'اسم الصنف', key: 'name', width: 28 },
        { header: 'الشركة', getValue: (i: any) => i.company || filterCompany, width: 20 },
        { header: 'التصنيف', key: 'category', width: 18 },
        { header: 'المواصفات', getValue: (i: any) => i.description || i.spec || '-', width: 25 },
        { header: 'سعر الشراء', getValue: (i: Item) => (i.costPrice ?? i.purchasePrice ?? 0).toFixed(2), width: 16, isCurrency: true },
        { header: 'سعر البيع', getValue: (i: Item) => (i.salePrice ?? i.price ?? 0).toFixed(2), width: 16, isCurrency: true },
        {
          header: 'الربح',
          getValue: (i: Item) => {
            const buy = Number(i.costPrice ?? i.purchasePrice ?? 0);
            const sell = Number(i.salePrice ?? i.price ?? 0);
            return (sell - buy).toFixed(2);
          },
          width: 16,
          isCurrency: true,
        },
      ],
      companyName: appData.settings?.companyName,
      reportTitle: `قائمة الأسعار والتصنيفات - شركة ${filterCompany}`,
    });
    showToast('تم تصدير قائمة الأسعار إلى ملف Excel بنجاح', 'success');
  };

  // Long press handler
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const handleRowMouseDown = (item: Item) => {
    timerRef.current = setTimeout(() => {
      setSelectedItemForMenu(item);
      setIsActionMenuOpen(true);
    }, 550);
  };
  const handleRowMouseUp = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-3 text-slate-800" dir="rtl">
      {/* 🏛️ الهيدر والبانر الرئيسي - خلفية بيضاء وكتابة سوداء متناسقة مع الواجهة الرئيسية */}
      <div className="bg-white text-slate-900 p-3.5 sm:p-5 rounded-xl shadow-xs border-2 border-slate-200 no-print flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center font-bold text-blue-600">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black tracking-wide flex items-center gap-2">
                <span className="text-slate-900">ركيزة | إدارة الشركات والتصنيفات والأسعار الذكية</span>
                <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full font-bold">
                  النظام المركزي
                </span>
              </h2>
              <p className="text-[11px] text-slate-600">
                قائمة الأسعار المعتمدة، تثبيت الشركات والفئات، وحساب هوامش الأرباح التلقائية
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleExportExcel}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold transition flex items-center gap-1 cursor-pointer"
              title="تصدير إكسيل"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>إكسيل</span>
            </button>
            <button
              type="button"
              onClick={handlePrintCatalog}
              className="text-xs bg-[#2e7d32] hover:bg-[#1b5e20] text-white px-3 py-1.5 rounded-lg font-bold shadow-xs transition flex items-center gap-1 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة</span>
            </button>
          </div>
        </div>

        {/* شبكة الأزرار الخمسة المركزية المطابقة للكود المرفق */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {/* 1. شركة */}
          <button
            type="button"
            onClick={() => {
              setNewCompanyName('');
              setIsCompanyModalOpen(true);
            }}
            className="bg-purple-700 hover:bg-purple-800 active:bg-purple-900 text-white py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs border border-purple-600 cursor-pointer"
          >
            <FolderPlus className="w-4 h-4" />
            <span>+ شركة جديدة</span>
          </button>

          {/* 2. تصنيف */}
          <button
            type="button"
            onClick={() => {
              setNewCategoryName('');
              setModalCatCompany(filterCompany || companiesDB[0] || '');
              setIsCategoryModalOpen(true);
            }}
            className="bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs border border-teal-600 cursor-pointer"
          >
            <Layers className="w-4 h-4" />
            <span>+ تثبيت تصنيف</span>
          </button>

          {/* 3. صنف */}
          <button
            type="button"
            onClick={handleOpenAddItem}
            className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs border border-emerald-700 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ صنف جديد</span>
          </button>

          {/* 4. رفع سعر */}
          <button
            type="button"
            onClick={() => {
              setBulkCompany(filterCompany || companiesDB[0]);
              setBulkCategory(filterCategory !== 'all' ? filterCategory : 'all');
              setIsBulkPriceModalOpen(true);
            }}
            className="bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs border border-amber-700 cursor-pointer"
          >
            <Percent className="w-4 h-4" />
            <span>رفع الأسعار (%)</span>
          </button>

          {/* 5. معاينة المخزن أو حركة الأصناف */}
          <button
            type="button"
            onClick={() => onNavigate && onNavigate('items')}
            className="bg-slate-700 hover:bg-slate-800 active:bg-slate-900 text-white py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs border border-slate-600 cursor-pointer"
          >
            <Tags className="w-4 h-4" />
            <span>دليل المخزون</span>
          </button>
        </div>
      </div>

      {/* بطاقة الإحصائيات والفلاتر الثلاثية */}
      <div className="bg-white border border-slate-300 rounded-xl p-3 sm:p-4 flex flex-col gap-3 shadow-xs no-print">
        {/* شريط الإحصائيات السريعة */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-center flex flex-col items-center">
            <span className="text-[10px] text-slate-500 font-bold">إجمالي الشركات المسجلة</span>
            <span className="text-base sm:text-lg font-black text-slate-900 font-mono mt-0.5">{companiesDB.length}</span>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-center flex flex-col items-center">
            <span className="text-[10px] text-slate-500 font-bold">أصناف الفلتر الحالي</span>
            <span className="text-base sm:text-lg font-black text-emerald-700 font-mono mt-0.5">{filteredItems.length}</span>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-center flex flex-col items-center">
            <span className="text-[10px] text-slate-500 font-bold">إجمالي الأصناف بالمخزن</span>
            <span className="text-base sm:text-lg font-black text-blue-700 font-mono mt-0.5">{itemsList.length}</span>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-center flex flex-col items-center">
            <span className="text-[10px] text-slate-500 font-bold">الشركة النشطة</span>
            <span className="text-xs sm:text-sm font-black text-purple-800 truncate max-w-[140px] mt-1">
              {filterCompany || 'جميع الشركات'}
            </span>
          </div>
        </div>

        {/* شبكة الفلاتر الثلاثية: اختيار الشركة، التصنيف المثبت، والبحث الذكي */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-200">
          {/* فلتر الشركة */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
              <span>الشركة / المجموعة:</span>
            </label>
            <select
              value={filterCompany}
              onChange={(e) => {
                setFilterCompany(e.target.value);
                setFilterCategory('all');
              }}
              className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
            >
              {companiesDB.length === 0 ? (
                <option value="">لا توجد شركات</option>
              ) : (
                companiesDB.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* فلتر التصنيف المثبت */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-teal-600" />
              <span>التصنيف المثبت (الفئة):</span>
            </label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
            >
              <option value="all">جميع التصنيفات</option>
              {availableCategoriesForFilter.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* البحث الذكي */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <Search className="w-3.5 h-3.5 text-amber-600" />
              <span>بحث ذكي بالأصناف:</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="بحث بالاسم، الكود، أو المواصفات..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg pr-3 pl-8 py-2 text-xs text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 📄 بطاقة جدول عرض الأصناف والأسعار - نظيفة كلياً بدون أي تظليل أسود */}
      <div className="bg-white border border-slate-300 rounded-xl p-3 sm:p-4 flex flex-col gap-2.5 shadow-xs">
        {/* ترويسة خاصة بالطباعة الورقية الفاخرة */}
        <div className="hidden print:block text-center border-b-2 border-black pb-3 mb-4">
          <h1 className="text-xl font-black text-black">
            {appData.settings?.companyName || 'منظومة ركيزة المحاسبية'}
          </h1>
          <h2 className="text-base font-bold text-slate-800 mt-1">
            قائمة أسعار شركة: {filterCompany || 'عامة'} | التصنيف: {filterCategory === 'all' ? 'جميع التصنيفات المثبتة' : filterCategory}
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            تاريخ استخراج الكشف: {new Date().toLocaleDateString('ar-EG')} - عدد الأصناف: {filteredItems.length}
          </p>
        </div>

        <div className="flex items-center justify-between border-b border-slate-200 pb-2 no-print">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-black text-slate-900">
              بيان الأصناف والأسعار وهوامش الربح
            </span>
            <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-mono">
              ({filteredItems.length} صنف)
            </span>
          </div>
          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
            💡 اضغط على أي صنف للتعديل السريع أو الحذف
          </span>
        </div>

        {/* جدول الأصناف التفاعلي */}
        <div className="w-full overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full border-collapse text-xs text-center">
            <thead className="bg-slate-100 text-slate-800 font-bold sticky top-0 z-10 border-b border-slate-300">
              <tr>
                <th className="p-2 border border-slate-300 w-[5%] font-bold">م</th>
                <th className="p-2 border border-slate-300 w-[12%] font-mono">الباركود</th>
                <th className="p-2 border border-slate-300 w-[22%] text-right font-black">اسم الصنف</th>
                <th className="p-2 border border-slate-300 w-[16%] text-right font-medium">المواصفات / العبوة</th>
                <th className="p-2 border border-slate-300 w-[9%] font-bold text-indigo-700">الرصيد</th>
                <th className="p-2 border border-slate-300 w-[11%] font-bold text-slate-700">سعر الشراء</th>
                <th className="p-2 border border-slate-300 w-[11%] font-bold text-emerald-700">سعر البيع</th>
                <th className="p-2 border border-slate-300 w-[9%] font-bold text-blue-700">هامش الربح</th>
                <th className="p-2 border border-slate-300 w-[5%] no-print font-bold">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 bg-white">
                    لا توجد أصناف مسجلة تحت هذا الفلتر. اضغط على زر (+ صنف جديد) لإدراج صنف فورياً.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, index) => {
                  const buy = Number(item.costPrice ?? item.purchasePrice ?? 0);
                  const sell = Number(item.salePrice ?? item.price ?? 0);
                  const profit = sell - buy;
                  const pct = buy > 0 ? ((profit / buy) * 100).toFixed(0) : '0';

                  return (
                    <tr
                      key={item.id}
                      onClick={() => handleOpenEditItem(item)}
                      onMouseDown={() => handleRowMouseDown(item)}
                      onMouseUp={handleRowMouseUp}
                      className="hover:bg-blue-50/50 border-b border-slate-200 transition-colors bg-white cursor-pointer select-none"
                      title="اضغط للتعديل أو الحذف"
                    >
                      <td className="p-2 border border-slate-200 font-mono font-bold text-slate-700 bg-white">
                        {index + 1}
                      </td>
                      <td className="p-2 border border-slate-200 font-mono text-slate-600 text-[11px] bg-white">
                        {item.code || '-'}
                      </td>
                      <td className="p-2 border border-slate-200 text-right font-bold text-slate-900 bg-white">
                        {item.name}
                      </td>
                      <td className="p-2 border border-slate-200 text-right text-slate-600 truncate max-w-[140px] bg-white text-xs">
                        {(item as any).description || (item as any).spec || '-'}
                      </td>
                      <td className="p-2 border border-slate-200 font-mono font-bold text-indigo-800 bg-white">
                        {item.quantity ?? 0}
                      </td>
                      <td className="p-2 border border-slate-200 font-mono font-bold text-slate-800 bg-white">
                        {buy.toFixed(2)}
                      </td>
                      <td className="p-2 border border-slate-200 font-mono font-black text-emerald-700 bg-white">
                        {sell.toFixed(2)}
                      </td>
                      <td className="p-2 border border-slate-200 font-mono font-bold bg-white">
                        <span className={profit >= 0 ? 'text-blue-700' : 'text-rose-600'}>
                          {profit.toFixed(1)} ({pct}%)
                        </span>
                      </td>
                      <td className="p-2 border border-slate-200 bg-white no-print" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditItem(item)}
                            className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded cursor-pointer transition"
                            title="تعديل الصنف"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item)}
                            className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded cursor-pointer transition"
                            title="حذف الصنف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* 1. Modal إضافة شركة جديدة */}
      {isCompanyModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white w-full max-w-[340px] rounded-xl border border-slate-300 shadow-2xl overflow-hidden text-slate-800">
            <div className="bg-slate-900 text-white px-3.5 py-2.5 text-xs font-bold flex justify-between items-center">
              <span className="flex items-center gap-1.5">
                <FolderPlus className="w-4 h-4 text-purple-400" />
                <span>إضافة شركة أو مجموعة جديدة</span>
              </span>
              <button
                type="button"
                onClick={() => setIsCompanyModalOpen(false)}
                className="text-white hover:text-rose-300 cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <div className="p-3.5 flex flex-col gap-2.5">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">اسم الشركة / المجموعة:</label>
                <input
                  type="text"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="مثال: مؤسسة النور، شركة الأهرام..."
                  className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  autoFocus
                />
              </div>
            </div>
            <div className="bg-slate-50 px-3.5 py-2.5 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCompanyModalOpen(false)}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveCompany}
                className="px-4 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold cursor-pointer shadow-xs"
              >
                حفظ الشركة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal تثبيت تصنيف جديد للشركة */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white w-full max-w-[340px] rounded-xl border border-slate-300 shadow-2xl overflow-hidden text-slate-800">
            <div className="bg-slate-900 text-white px-3.5 py-2.5 text-xs font-bold flex justify-between items-center">
              <span className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-teal-400" />
                <span>إضافة وتثبيت تصنيف للشركة</span>
              </span>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="text-white hover:text-rose-300 cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <div className="p-3.5 flex flex-col gap-2.5">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">اختر الشركة لتثبيت التصنيف تحتها:</label>
                <select
                  value={modalCatCompany}
                  onChange={(e) => setModalCatCompany(e.target.value)}
                  className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none cursor-pointer"
                >
                  {companiesDB.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">اسم التصنيف الجديد (الفئة):</label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="مثال: بلاستيك، دهانات، أدوات، كابلات..."
                  className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  autoFocus
                />
              </div>
            </div>
            <div className="bg-slate-50 px-3.5 py-2.5 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveCategory}
                className="px-4 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold cursor-pointer shadow-xs"
              >
                تثبيت التصنيف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Modal كارت الصنف للإضافة والتعديل وحساب هامش الربح */}
      {isItemModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white w-full max-w-[360px] rounded-xl border border-slate-300 shadow-2xl overflow-hidden text-slate-800">
            <div className="bg-slate-900 text-white px-3.5 py-2.5 text-xs font-bold flex justify-between items-center">
              <span>{selectedItemForMenu ? `تعديل الصنف: ${selectedItemForMenu.name}` : 'إضافة صنف جديد وتسعيره'}</span>
              <button
                type="button"
                onClick={() => setIsItemModalOpen(false)}
                className="text-white hover:text-rose-300 cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <div className="p-3.5 flex flex-col gap-2.5 text-xs">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-slate-700">الشركة التابع لها:</label>
                <select
                  value={modalItemCompany}
                  onChange={(e) => setModalItemCompany(e.target.value)}
                  className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none"
                >
                  {companiesDB.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-slate-700">التصنيف المثبت (الفئة):</label>
                <select
                  value={modalItemCategory}
                  onChange={(e) => setModalItemCategory(e.target.value)}
                  className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none"
                >
                  {(categoriesDB[modalItemCompany] || ['عام']).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-slate-700">اسم الصنف:</label>
                <input
                  type="text"
                  value={inputName}
                  onChange={(e) => setInputName(e.target.value)}
                  placeholder="اسم الصنف..."
                  className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-slate-700">بيان الصنف / المواصفات:</label>
                <input
                  type="text"
                  value={inputDesc}
                  onChange={(e) => setInputDesc(e.target.value)}
                  placeholder="المواصفات، العبوة، أو المقاس..."
                  className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-indigo-800">الرصيد المخزني (الكمية):</label>
                  <input
                    type="number"
                    step="1"
                    value={inputQuantity}
                    onChange={(e) => setInputQuantity(e.target.value)}
                    placeholder="0"
                    className="border border-indigo-300 bg-indigo-50/30 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-indigo-950 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-700">سعر الشراء (ج.م):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={inputBuyPrice}
                    onChange={(e) => setInputBuyPrice(e.target.value)}
                    placeholder="0.00"
                    className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-700">سعر البيع (ج.م):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={inputSellPrice}
                    onChange={(e) => setInputSellPrice(e.target.value)}
                    placeholder="0.00"
                    className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-black text-emerald-700 focus:outline-none"
                  />
                </div>
              </div>

              {/* هامش الربح المتوقع المحسوب فورياً */}
              <div className="bg-emerald-50 border border-emerald-200 p-2 rounded-lg text-center font-bold text-xs flex justify-between items-center px-3">
                <span className="text-emerald-950">هامش الربح المتوقع:</span>
                <span className="text-emerald-700 font-mono font-black">
                  {modalProfitInfo.profit.toFixed(2)} ج.م ({modalProfitInfo.pct}%)
                </span>
              </div>
            </div>
            <div className="bg-slate-50 px-3.5 py-2.5 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsItemModalOpen(false)}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveItem}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer shadow-xs"
              >
                حفظ الصنف وتثبيت السعر
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Modal رفع وتحديث الأسعار الذكي بالنسبة المئوية */}
      {isBulkPriceModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white w-full max-w-[360px] rounded-xl border border-slate-300 shadow-2xl overflow-hidden text-slate-800">
            <div className="bg-slate-900 text-white px-3.5 py-2.5 text-xs font-bold flex justify-between items-center">
              <span className="flex items-center gap-1.5">
                <Percent className="w-4 h-4 text-amber-400" />
                <span>رفع الأسعار الذكي (نسبة مئوية %)</span>
              </span>
              <button
                type="button"
                onClick={() => setIsBulkPriceModalOpen(false)}
                className="text-white hover:text-rose-300 cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <div className="p-3.5 flex flex-col gap-2.5 text-xs">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-slate-700">نطاق تطبيق الزيادة:</label>
                <select
                  value={bulkScope}
                  onChange={(e) => setBulkScope(e.target.value as any)}
                  className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none"
                >
                  <option value="all">جميع الشركات والأصناف (دفعة واحدة)</option>
                  <option value="company">شركة معينة بالكامل</option>
                  <option value="category">تصنيف محدد داخل شركة</option>
                </select>
              </div>

              {(bulkScope === 'company' || bulkScope === 'category') && (
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-700">اختر الشركة:</label>
                  <select
                    value={bulkCompany}
                    onChange={(e) => setBulkCompany(e.target.value)}
                    className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none"
                  >
                    {companiesDB.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {bulkScope === 'category' && (
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-700">اختر التصنيف:</label>
                  <select
                    value={bulkCategory}
                    onChange={(e) => setBulkCategory(e.target.value)}
                    className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none"
                  >
                    <option value="all">جميع التصنيفات</option>
                    {(categoriesDB[bulkCompany] || ['عام']).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-slate-700">نسبة الزيادة المئوية (%):</label>
                <input
                  type="number"
                  step="0.1"
                  value={bulkPercentage}
                  onChange={(e) => setBulkPercentage(e.target.value)}
                  placeholder="مثال: 10 أو 5.5"
                  className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 p-2 rounded-lg text-[10px] text-amber-900 font-bold">
                ⚠️ سيتم زيادة أسعار الشراء والبيع بالنسبة المحددة وتحديث تكاليف وأسعار البيع في الفواتير والمخزون فورياً.
              </div>
            </div>
            <div className="bg-slate-50 px-3.5 py-2.5 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsBulkPriceModalOpen(false)}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleApplyBulkPriceIncrease}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold cursor-pointer shadow-xs"
              >
                تنفيذ الزيادة فورياً
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Menu قائمة الخيارات للضغطة المطولة أو النقر السريع */}
      {isActionMenuOpen && selectedItemForMenu && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white w-[260px] rounded-xl border border-slate-300 p-3.5 shadow-2xl flex flex-col gap-2.5 text-center">
            <div className="text-xs font-black text-slate-900 border-b border-slate-200 pb-2">
              خيارات الصنف: {selectedItemForMenu.name}
            </div>
            <button
              type="button"
              onClick={() => handleOpenEditItem(selectedItemForMenu)}
              className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>تعديل الصنف والأسعار</span>
            </button>
            <button
              type="button"
              onClick={() => handleDeleteItem(selectedItemForMenu)}
              className="bg-rose-600 hover:bg-rose-700 text-white py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>حذف الصنف من المخزون</span>
            </button>
            <button
              type="button"
              onClick={() => setIsActionMenuOpen(false)}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 py-1.5 px-3 rounded-lg text-xs font-bold cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
