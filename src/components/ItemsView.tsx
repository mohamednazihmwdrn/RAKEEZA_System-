import React, { useState } from 'react';
import { AppData, Item } from '../types';
import { Modal } from './Modal';
import { InventoryStocktakingView } from './InventoryStocktakingView';
import { exportToExcel } from '../utils/excelExport';
import { openUnifiedPrintWindow } from '../utils/printUnified';
import { TableActionButtons } from './TableActionButtons';

interface ItemsViewProps {
  appData: AppData;
  subPage?: string;
  onUpdateData: (newData: AppData) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onShareCatalog?: () => void;
  onOpenCatalog?: () => void;
}

export const ItemsView: React.FC<ItemsViewProps> = ({
  appData,
  subPage = 'items',
  onUpdateData,
  showToast,
  onShareCatalog,
  onOpenCatalog,
}) => {
  // If the user navigated to physical inventory or settlement, render the enterprise stocktaking engine
  if (subPage === 'physical_inventory' || subPage === 'inventory_settlement') {
    return (
      <InventoryStocktakingView
        appData={appData}
        subPage={subPage}
        onUpdateData={onUpdateData}
        showToast={showToast}
      />
    );
  }

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  // Form
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [qty, setQty] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [salePrice, setSalePrice] = useState('');

  // Physical count state
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, number>>({});

  const filteredItems = appData.items.filter((item) => {
    const s = searchTerm.toLowerCase();
    return item.name?.toLowerCase().includes(s) || item.description?.toLowerCase().includes(s);
  });

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
    setDesc('');
    setQty('0');
    setPurchasePrice('0');
    setSalePrice('0');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: Item) => {
    setEditingItem(item);
    setName(item.name);
    setDesc(item.description || '');
    setQty(item.quantity.toString());
    setPurchasePrice(item.purchasePrice.toString());
    setSalePrice(item.salePrice.toString());
    setIsModalOpen(true);
  };

  const handleSaveItem = () => {
    if (!name.trim()) {
      showToast('يرجى إدخال اسم الصنف', 'warning');
      return;
    }

    const updatedData = { ...appData };
    const pPrice = parseFloat(purchasePrice) || 0;
    const sPrice = parseFloat(salePrice) || pPrice * 1.2;
    const qVal = parseFloat(qty) || 0;

    if (editingItem) {
      const idx = updatedData.items.findIndex((i) => i.id === editingItem.id);
      if (idx !== -1) {
        updatedData.items[idx] = {
          ...updatedData.items[idx],
          name: name.trim(),
          description: desc.trim(),
          quantity: qVal,
          purchasePrice: pPrice,
          salePrice: sPrice,
        };
      }
      showToast('تم تعديل بيانات الصنف بنجاح', 'success');
    } else {
      updatedData.items.push({
        id: 'i' + Date.now(),
        name: name.trim(),
        description: desc.trim(),
        quantity: qVal,
        purchasePrice: pPrice,
        salePrice: sPrice,
        movements: [],
      });
      showToast('تم إضافة الصنف بنجاح', 'success');
    }

    onUpdateData(updatedData);
    setIsModalOpen(false);
  };

  const handleDeleteItem = (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الصنف؟')) return;
    const updatedData = { ...appData };
    updatedData.items = updatedData.items.filter((i) => i.id !== id);
    onUpdateData(updatedData);
    showToast('تم حذف الصنف بنجاح');
  };

  const handleApplySettlement = () => {
    const updatedData = { ...appData };
    let totalAdjustments = 0;

    updatedData.items.forEach((item) => {
      const pCount = physicalCounts[item.id];
      if (pCount !== undefined && pCount !== item.quantity) {
        const diff = pCount - item.quantity;
        item.quantity = pCount;
        if (!item.movements) item.movements = [];
        item.movements.push({
          date: new Date().toISOString().split('T')[0],
          type: 'adjustment',
          qty: diff,
          price: item.purchasePrice,
          total: diff * item.purchasePrice,
          note: 'تسوية جرد فعلي',
        });
        totalAdjustments += 1;
      }
    });

    onUpdateData(updatedData);
    showToast(`تم تطبيق التسوية وتحديث ${totalAdjustments} أصناف بنجاح`, 'success');
  };

  return (
    <div className="space-y-4">
      {/* Search & Actions Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {subPage === 'items' && (
            <>
              <button
                onClick={handleOpenAdd}
                className="min-h-[42px] bg-[#2e7d32] hover:bg-[#1b5e20] active:bg-[#124116] text-white px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition cursor-pointer flex items-center justify-center gap-1 shadow-xs flex-1 sm:flex-initial"
              >
                ➕ إضافة صنف جديد
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
            </>
          )}
          {subPage === 'physical_inventory' && (
            <button
              onClick={handleApplySettlement}
              className="min-h-[42px] bg-[#1a237e] hover:bg-[#0d47a1] active:bg-[#082a61] text-white px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition cursor-pointer flex items-center justify-center gap-1 shadow-xs flex-1 sm:flex-initial"
            >
              ✅ تطبيق نتائج الجرد
            </button>
          )}
        </div>
        <div className="w-full sm:w-auto min-w-[220px]">
          <input
            type="text"
            placeholder="🔍 بحث في الأصناف..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full min-h-[42px] px-3.5 py-2 border-2 border-gray-200 rounded-xl text-xs focus:border-[#1a237e] focus:outline-none"
          />
        </div>
      </div>

      {/* View Selector */}
      {subPage === 'items' && (
        <>
          {/* Mobile Card List View (< md) */}
          <div className="block md:hidden space-y-3">
            {filteredItems.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 text-center text-gray-400 text-sm">
                لا توجد أصناف مسجلة
              </div>
            ) : (
              filteredItems.map((item) => {
                const totalVal = (item.quantity || 0) * (item.purchasePrice || 0);
                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200 space-y-3 hover:border-indigo-300 transition"
                  >
                    {/* Top Row: Item Name & Stock Quantity */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-[#1a237e] font-black text-sm">📦 {item.name}</span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          item.quantity < 0
                            ? 'bg-rose-100 text-rose-800'
                            : item.quantity === 0
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        الكمية: {item.quantity}
                      </span>
                    </div>

                    {/* Middle: Description & Pricing Grid */}
                    {item.description && (
                      <div className="text-xs text-slate-500 italic">{item.description}</div>
                    )}

                    <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl text-center">
                      <div>
                        <div className="text-[10px] text-slate-500">سعر الشراء</div>
                        <div className="font-bold text-slate-800 text-xs mt-0.5">{item.purchasePrice.toFixed(2)} ج.م</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500">سعر البيع</div>
                        <div className="font-bold text-indigo-900 text-xs mt-0.5">{item.salePrice.toFixed(2)} ج.م</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500">قيمة المخزون</div>
                        <div className="font-black text-emerald-700 text-xs mt-0.5">{totalVal.toFixed(2)} ج.م</div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="min-h-[44px] bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1"
                      >
                        ✏️ تعديل
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="min-h-[44px] bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1"
                      >
                        🗑️ حذف
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table View (>= md) */}
          <div className="hidden md:block bg-white rounded-2xl p-4 shadow-xs overflow-x-auto">
            <table className="w-full text-right text-xs md:text-sm border-collapse">
              <thead>
                <tr className="bg-[#1a237e] text-white">
                  <th className="p-3 rounded-r-lg">اسم الصنف</th>
                  <th className="p-3">الوصف</th>
                  <th className="p-3">الكمية</th>
                  <th className="p-3">سعر الشراء (ج.م)</th>
                  <th className="p-3">سعر البيع (ج.م)</th>
                  <th className="p-3">قيمة المخزون</th>
                  <th className="p-3 rounded-l-lg">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-400">
                      لا توجد أصناف مسجلة
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const totalVal = (item.quantity || 0) * (item.purchasePrice || 0);
                    return (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-[#1a237e]">{item.name}</td>
                        <td className="p-3 text-gray-500">{item.description || '-'}</td>
                        <td
                          className={`p-3 font-bold ${
                            item.quantity < 0 ? 'text-[#c62828]' : item.quantity === 0 ? 'text-[#f57f17]' : ''
                          }`}
                        >
                          {item.quantity}
                        </td>
                        <td className="p-3">{item.purchasePrice.toFixed(2)}</td>
                        <td className="p-3 font-semibold">{item.salePrice.toFixed(2)}</td>
                        <td className="p-3 font-bold text-[#2e7d32]">{totalVal.toFixed(2)}</td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleOpenEdit(item)}
                              className="bg-[#f57f17] text-white p-2 rounded-lg text-xs hover:bg-[#e65100]"
                              title="تعديل"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="bg-[#c62828] text-white p-2 rounded-lg text-xs hover:bg-[#b71c1c]"
                              title="حذف"
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

      {subPage === 'physical_inventory' && (
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <h4 className="font-bold text-[#1a237e]">إدخال الجرد الفعلي للمخازن</h4>

          {/* Mobile Physical Inventory Cards (< md) */}
          <div className="block md:hidden space-y-3">
            {filteredItems.map((item) => {
              const currentPhysical = physicalCounts[item.id] ?? item.quantity;
              const diff = currentPhysical - item.quantity;
              return (
                <div key={item.id} className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs space-y-2">
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-slate-900 text-sm">{item.name}</span>
                    <span
                      className={`font-mono font-bold px-2 py-0.5 rounded-lg text-xs ${
                        diff < 0
                          ? 'bg-rose-100 text-rose-800'
                          : diff > 0
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      الفارق: {diff > 0 ? `+${diff}` : diff}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">
                      المسجلة: <strong className="font-mono text-slate-800">{item.quantity}</strong>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-600 font-semibold text-[11px]">الفعلية:</span>
                      <input
                        type="number"
                        value={currentPhysical}
                        onChange={(e) =>
                          setPhysicalCounts({
                            ...physicalCounts,
                            [item.id]: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-24 p-1.5 bg-white border-2 border-slate-200 rounded-lg text-center font-mono font-bold focus:border-[#1a237e] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Physical Inventory Table (>= md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-right text-xs md:text-sm">
            <thead>
              <tr className="bg-[#1a237e] text-white">
                <th className="p-3 rounded-r-lg">الصنف</th>
                <th className="p-3">الكمية المسجلة</th>
                <th className="p-3">الكمية الفعلية بالمخزن</th>
                <th className="p-3 rounded-l-lg">الفارق</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredItems.map((item) => {
                const currentPhysical = physicalCounts[item.id] ?? item.quantity;
                const diff = currentPhysical - item.quantity;
                return (
                  <tr key={item.id}>
                    <td className="p-3 font-bold">{item.name}</td>
                    <td className="p-3">{item.quantity}</td>
                    <td className="p-3">
                      <input
                        type="number"
                        value={currentPhysical}
                        onChange={(e) =>
                          setPhysicalCounts({
                            ...physicalCounts,
                            [item.id]: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-28 p-1.5 border-2 border-gray-200 rounded-lg text-center focus:border-[#1a237e] focus:outline-none"
                      />
                    </td>
                    <td
                      className={`p-3 font-bold ${
                        diff < 0 ? 'text-[#c62828]' : diff > 0 ? 'text-[#2e7d32]' : 'text-gray-400'
                      }`}
                    >
                      {diff > 0 ? `+${diff}` : diff}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </div>
      )}

      {subPage === 'inventory_settlement' && (
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <h4 className="font-bold text-[#1a237e]">تقرير مطابقة وتسوية الجرد</h4>
          <p className="text-gray-500 text-xs">حالة مطابقة أرصدة الدفتر مع الأرصدة الفعلية في المخازن</p>
          {/* Mobile Settlement Cards (< md) */}
          <div className="block md:hidden space-y-2.5">
            {filteredItems.map((item) => (
              <div key={item.id} className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex items-center justify-between font-bold">
                  <span className="text-slate-900">{item.name}</span>
                  <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[11px] font-bold">
                    ⚪ مطابق
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>الدفترية: <strong className="font-mono text-slate-800">{item.quantity}</strong></span>
                  <span>الفعلية: <strong className="font-mono text-slate-800">{item.quantity}</strong></span>
                  <span>الفارق: <strong className="font-mono text-slate-800">0</strong></span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Settlement Table (>= md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-right text-xs md:text-sm">
              <tbody className="divide-y divide-gray-100">
                {filteredItems.map((item) => (
                  <tr key={item.id}>
                    <td className="p-3 font-bold">{item.name}</td>
                    <td className="p-3">{item.quantity}</td>
                    <td className="p-3">{item.quantity}</td>
                    <td className="p-3">0</td>
                    <td className="p-3">
                      <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-xs font-bold">
                        ⚪ مطابق
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Item Modal */}
      <Modal
        isOpen={isModalOpen}
        title={editingItem ? '✏️ تعديل صنف' : '➕ إضافة صنف جديد'}
        onClose={() => setIsModalOpen(false)}
        footer={
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <button
              onClick={handleSaveItem}
              className="min-h-[44px] bg-[#2e7d32] hover:bg-[#1b5e20] active:bg-[#124116] text-white px-6 py-2.5 rounded-xl font-bold cursor-pointer transition shadow-xs flex-1 sm:flex-initial text-center"
            >
              💾 حفظ الصنف
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
        <div className="space-y-4 text-xs md:text-sm">
          <div>
            <label className="block font-bold mb-1">اسم الصنف</label>
            <input
              type="text"
              placeholder="اسم الصنف..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-bold mb-1">الوصف والمواصفات</label>
            <input
              type="text"
              placeholder="وصف مختصر للصنف..."
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-bold mb-1">الكمية الأولية</label>
              <input
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">سعر الشراء (ج.م)</label>
              <input
                type="number"
                step="0.01"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">سعر البيع (ج.م)</label>
              <input
                type="number"
                step="0.01"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none"
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
