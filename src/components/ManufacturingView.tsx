import React, { useState } from 'react';
import { AppData, BOM, ProductionOrder, JournalEntry } from '../types';
import { addAuditLog } from '../utils/storage';
import { openUnifiedPrintWindow } from '../utils/printUnified';
import { exportToExcel } from '../utils/excelExport';
import { TableActionButtons } from './TableActionButtons';

interface ManufacturingViewProps {
  appData: AppData;
  onUpdateData: (newData: AppData) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onInspectItem?: (type: any, data: any) => void;
}

export const ManufacturingView: React.FC<ManufacturingViewProps> = ({
  appData,
  onUpdateData,
  showToast,
  onInspectItem,
}) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'boms'>('orders');
  const [isBomModalOpen, setIsBomModalOpen] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);

  // New BOM State
  const [bomName, setBomName] = useState('');
  const [finishedProductName, setFinishedProductName] = useState('');
  const [outputQty, setOutputQty] = useState<number>(1);
  const [laborCost, setLaborCost] = useState<number>(50);
  const [overheadCost, setOverheadCost] = useState<number>(30);
  const [bomItems, setBomItems] = useState<{ itemId: string; name: string; qty: number; unitCost: number }[]>([]);

  // Production Order State
  const [selectedBomId, setSelectedBomId] = useState('');
  const [orderQuantity, setOrderQuantity] = useState<number>(10);
  const [orderNotes, setOrderNotes] = useState('');

  const currency = appData.settings?.currencySymbol || 'ج.م';
  const boms = appData.boms || [];
  const orders = appData.productionOrders || [];
  const inventoryItems = appData.items || [];

  // Add Raw material to BOM form
  const handleAddRawMaterial = (itemId: string) => {
    const item = inventoryItems.find((i) => i.id === itemId);
    if (!item) return;
    if (bomItems.some((b) => b.itemId === itemId)) {
      showToast('هذه الخامة مضافة بالفعل في المعادلة', 'info');
      return;
    }
    setBomItems([
      ...bomItems,
      {
        itemId: item.id,
        name: item.name,
        qty: 1,
        unitCost: item.costPrice || item.salePrice * 0.7,
      },
    ]);
  };

  // Calculate Unit BOM Cost
  const calculateBomTotalCost = (items: typeof bomItems, labor: number, overhead: number, outQty: number) => {
    const rawTotal = items.reduce((acc, i) => acc + i.qty * i.unitCost, 0);
    const total = rawTotal + labor + overhead;
    return {
      total,
      unitCost: outQty > 0 ? total / outQty : total,
      rawTotal,
    };
  };

  // Save BOM
  const handleSaveBom = () => {
    if (!bomName.trim() || !finishedProductName.trim() || bomItems.length === 0) {
      showToast('يرجى استكمال اسم المعادلة، المنتج النهائي، وإضافة خامة واحدة على الأقل', 'warning');
      return;
    }

    const { total, unitCost } = calculateBomTotalCost(bomItems, laborCost, overheadCost, outputQty);
    const newBom: BOM = {
      id: `bom-${Date.now()}`,
      name: bomName,
      finishedProductName,
      outputQuantity: Number(outputQty),
      unit: 'قطعة',
      rawMaterials: bomItems.map((b) => ({
        itemId: b.itemId,
        itemName: b.name,
        quantity: Number(b.qty),
        unit: 'وحدة',
        estimatedCost: Number(b.unitCost),
      })),
      laborCost: Number(laborCost),
      overheadCost: Number(overheadCost),
      totalEstimatedCost: total,
      unitCost: unitCost,
      status: 'active',
    };

    let updated = {
      ...appData,
      boms: [newBom, ...appData.boms],
    };
    updated = addAuditLog(updated, 'create', 'التصنيع والإنتاج', `تم إنشاء معادلة تكوين وتصنيع [${bomName}] للمنتج ${finishedProductName}.`);
    onUpdateData(updated);
    showToast('تم حفظ معادلة التكوين بنجاح', 'success');
    setIsBomModalOpen(false);
  };

  // Execute & Complete Production Order (Consumes Raw Materials & Creates Finished Goods)
  const handleExecuteProduction = (order: ProductionOrder) => {
    if (order.status === 'completed') return;

    let updated = { ...appData };
    const bom = boms.find((b) => b.id === order.bomId);
    if (!bom) return;

    const multiplier = order.targetQuantity / (bom.outputQuantity || 1);

    // 1. Check raw materials stock & deduct
    for (const rm of bom.rawMaterials) {
      const invItem = updated.items.find((i) => i.id === rm.itemId || i.name === rm.itemName);
      const neededQty = rm.quantity * multiplier;
      if (invItem && invItem.quantity < neededQty) {
        showToast(`رصيد الخامة [${rm.itemName}] في المخزن (${invItem.quantity}) غير كافٍ لتشغيل الأمر (المطلوب: ${neededQty})`, 'error');
        return;
      }
    }

    // Deduct raw materials
    updated.items = updated.items.map((it) => {
      const rm = bom.rawMaterials.find((r) => r.itemId === it.id || r.itemName === it.name);
      if (rm) {
        const consumed = rm.quantity * multiplier;
        return { ...it, quantity: Math.max(0, it.quantity - consumed) };
      }
      return it;
    });

    // 2. Add or increase Finished Good item
    const totalProductionCost = bom.totalEstimatedCost * multiplier;
    const finishedItemIndex = updated.items.findIndex((i) => i.name === bom.finishedProductName);

    if (finishedItemIndex >= 0) {
      const existing = updated.items[finishedItemIndex];
      const newQty = existing.quantity + order.targetQuantity;
      // Weighted average cost
      const newCost = Math.round(((existing.quantity * (existing.costPrice || 0)) + totalProductionCost) / newQty);
      updated.items[finishedItemIndex] = {
        ...existing,
        quantity: newQty,
        costPrice: newCost,
      };
    } else {
      updated.items.push({
        id: `item-${Date.now()}`,
        name: bom.finishedProductName,
        quantity: order.targetQuantity,
        purchasePrice: Math.round(totalProductionCost / order.targetQuantity),
        costPrice: Math.round(totalProductionCost / order.targetQuantity),
        salePrice: Math.round((totalProductionCost / order.targetQuantity) * 1.3),
        category: 'منتجات تامة الصنع',
        unit: bom.unit || 'قطعة',
        minStockAlert: 5,
      });
    }

    // 3. Dual Accounting Journal Entry
    const nextJournalId = updated.nextJournalId || 1;
    const jv: JournalEntry = {
      id: nextJournalId,
      entryNumber: `MFG-${String(nextJournalId).padStart(4, '0')}`,
      date: new Date().toISOString().substring(0, 10),
      description: `إثبات تكلفة أمر تشغيل وإنتاج #${order.orderNumber} (${order.targetQuantity} ${bom.finishedProductName})`,
      source: 'manual',
      createdBy: appData.users.find((u) => u.id === appData.currentUser)?.name || 'المدير',
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      isApproved: true,
      lines: [
        {
          accountCode: '1103',
          accountName: 'مخزون الإنتاج التام والمصنع',
          debit: totalProductionCost,
          credit: 0,
          note: `إنتاج ${order.targetQuantity} وحدة`,
        },
        {
          accountCode: '1102',
          accountName: 'مخزون المواد الخام ومصروفات التشغيل',
          debit: 0,
          credit: totalProductionCost,
          note: `صرف خامات ومصاريف أمر #${order.orderNumber}`,
        },
      ],
    };

    updated.journalEntries = [jv, ...updated.journalEntries];
    updated.nextJournalId = nextJournalId + 1;

    // Update order status
    updated.productionOrders = updated.productionOrders.map((o) =>
      o.id === order.id
        ? {
            ...o,
            status: 'completed',
            producedQuantity: order.targetQuantity,
            actualCost: totalProductionCost,
            journalEntryId: nextJournalId,
          }
        : o
    );

    updated = addAuditLog(
      updated,
      'approval',
      'التصنيع',
      `تم إتمام تشغيل أمر الإنتاج #${order.orderNumber} وإيداع ${order.targetQuantity} قطعة في مخزن التام بتكلفة ${totalProductionCost} ${currency}.`
    );

    onUpdateData(updated);
    showToast(`تم إتمام أمر الإنتاج وإيداع البضاعة في المخازن بنجاح`, 'success');
  };

  // Create Production Order
  const handleCreateOrder = () => {
    const bom = boms.find((b) => b.id === selectedBomId);
    if (!bom) {
      showToast('يرجى اختيار معادلة التكوين', 'warning');
      return;
    }

    const nextId = appData.nextProductionOrderId || 1;
    const estCost = bom.unitCost * orderQuantity;

    const newOrder: ProductionOrder = {
      id: nextId,
      orderNumber: `WO-${new Date().getFullYear()}-${String(nextId).padStart(4, '0')}`,
      bomId: bom.id,
      finishedProductName: bom.finishedProductName,
      targetQuantity: Number(orderQuantity),
      producedQuantity: 0,
      startDate: new Date().toISOString().substring(0, 10),
      status: 'planned',
      estimatedCost: estCost,
      actualCost: 0,
      notes: orderNotes,
      createdBy: appData.users.find((u) => u.id === appData.currentUser)?.name || 'المدير',
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };

    const updated: AppData = {
      ...appData,
      productionOrders: [newOrder, ...(appData.productionOrders || [])],
      nextProductionOrderId: nextId + 1,
    };
    const finalData = addAuditLog(updated, 'create', 'أوامر الإنتاج', `تم إصدار أمر تشغيل وإنتاج #${newOrder.orderNumber} للمنتج ${bom.finishedProductName}.`);
    onUpdateData(finalData);
    showToast(`تم إنشاء أمر التشغيل #${newOrder.orderNumber} بنجاح`, 'success');
    setIsOrderModalOpen(false);
  };

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap justify-between items-center gap-4">
        <div>
          <h3 className="text-lg font-black text-[#1a237e] flex items-center gap-2">
            <span>⚙️ نظام التصنيع والإنتاج والتكاليف الصناعية (BOM & Manufacturing)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            معادلات التكوين BOM، أوامر التشغيل، الخصم الآلي للمواد الخام وإيداع المنتج التام بالمخزن.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <TableActionButtons
            onPrint={() => {
              if (activeTab === 'orders') {
                openUnifiedPrintWindow(
                  {
                    title: 'سجل أوامر التشغيل والإنتاج التام',
                    partyLabel: 'إجمالي الأوامر',
                    partyName: `${orders.length} أمر تشغيل`,
                    items: orders.map((o) => ({
                      name: `${o.finishedProductName} (${o.orderNumber})`,
                      unit: 'وحدة تامة',
                      qty: o.targetQuantity,
                      price: (o.estimatedCost || 0) / (o.targetQuantity || 1),
                      total: o.actualCost || o.estimatedCost,
                      notes: `الحالة: ${o.status === 'completed' ? 'مكتمل ومنتج' : 'قيد التشغيل'} | البدء: ${o.startDate}`,
                    })),
                    totals: [
                      {
                        label: 'إجمالي التكاليف:',
                        value: orders.reduce((a, b) => a + (b.actualCost || b.estimatedCost), 0),
                        isBold: true,
                        isHighlight: true,
                      },
                    ],
                  },
                  appData.settings,
                  showToast
                );
              } else {
                openUnifiedPrintWindow(
                  {
                    title: 'دليل معادلات التكوين وقوائم المواد BOM',
                    partyLabel: 'إجمالي المعادلات',
                    partyName: `${boms.length} معادلة`,
                    items: boms.map((b) => ({
                      name: `${b.name} (${b.finishedProductName})`,
                      unit: `${b.outputQuantity} وحدة مخرجات`,
                      qty: b.items?.length || 0,
                      price: b.laborCost + b.overheadCost,
                      total: b.unitCost,
                      notes: `خامات: ${b.rawMaterialCost.toFixed(2)} | مصنعية: ${b.laborCost} | غير مباشر: ${b.overheadCost}`,
                    })),
                    totals: [
                      {
                        label: 'عدد المعادلات المسجلة:',
                        value: boms.length,
                        isBold: true,
                      },
                    ],
                  },
                  appData.settings,
                  showToast
                );
              }
            }}
            onExportExcel={() => {
              if (activeTab === 'orders') {
                exportToExcel({
                  filename: `أوامر_الإنتاج_والتشغيل_${new Date().toISOString().split('T')[0]}`,
                  sheetName: 'أوامر الإنتاج',
                  data: orders,
                  columns: [
                    { header: 'رقم أمر التشغيل', key: 'orderNumber', width: 18 },
                    { header: 'المنتج التام', key: 'finishedProductName', width: 25 },
                    { header: 'الكمية المستهدفة', key: 'targetQuantity', width: 14 },
                    { header: 'الكمية المنتجة فعلياً', key: 'producedQuantity', width: 16 },
                    { header: 'تاريخ البدء', key: 'startDate', width: 14 },
                    { header: 'تاريخ الإتمام', getValue: (o) => o.completionDate || '-', width: 14 },
                    { header: 'التكلفة التقديرية (ج.م)', getValue: (o) => (o.estimatedCost || 0).toFixed(2), width: 18 },
                    { header: 'التكلفة الفعلية (ج.م)', getValue: (o) => (o.actualCost || 0).toFixed(2), width: 18 },
                    {
                      header: 'حالة التشغيل',
                      getValue: (o) => o.status === 'completed' ? 'مكتمل ومرحل للمخازن' : o.status === 'in_progress' ? 'قيد التشغيل' : 'مخطط',
                      width: 20,
                    },
                    { header: 'ملاحظات', key: 'notes', width: 25 },
                  ],
                  companyName: appData.settings?.companyName || 'المنظومة المحاسبية المعتمدة',
                  reportTitle: 'سجل أوامر التشغيل والإنتاج والتكاليف الصناعية',
                });
                showToast('تم تصدير أوامر الإنتاج إلى Excel بنجاح', 'success');
              } else {
                exportToExcel({
                  filename: `معادلات_التكوين_BOM_${new Date().toISOString().split('T')[0]}`,
                  sheetName: 'معادلات التكوين',
                  data: boms,
                  columns: [
                    { header: 'اسم المعادلة', key: 'name', width: 25 },
                    { header: 'المنتج التام النهائي', key: 'finishedProductName', width: 25 },
                    { header: 'حجم مخرجات التشغيل', key: 'outputQuantity', width: 16 },
                    { header: 'تكلفة المواد الخام (ج.م)', getValue: (b: any) => (b.rawMaterialCost || 0).toFixed(2), width: 20 },
                    { header: 'تكلفة الأجور والمصنعية', getValue: (b: any) => (b.laborCost || 0).toFixed(2), width: 18 },
                    { header: 'مصاريف صناعية غير مباشرة', getValue: (b: any) => (b.overheadCost || 0).toFixed(2), width: 22 },
                    { header: 'إجمالي تكلفة الوحدة التامة', getValue: (b: any) => (b.unitCost || 0).toFixed(2), width: 22 },
                  ],
                  companyName: appData.settings?.companyName || 'المنظومة المحاسبية المعتمدة',
                  reportTitle: 'دليل وقوائم شجرة المواد ومعادلات التكوين الصناعية BOM',
                });
                showToast('تم تصدير معادلات التكوين إلى Excel بنجاح', 'success');
              }
            }}
            printTitle={activeTab === 'orders' ? 'طباعة سجل أوامر الإنتاج' : 'طباعة دليل معادلات التكوين'}
            exportTitle={activeTab === 'orders' ? 'تصدير أوامر الإنتاج إلى Excel' : 'تصدير معادلات التكوين إلى Excel'}
          />
          <button
            onClick={() => {
              setBomName('');
              setFinishedProductName('');
              setOutputQty(1);
              setLaborCost(50);
              setOverheadCost(30);
              setBomItems([]);
              setIsBomModalOpen(true);
            }}
            className="bg-[#1a237e] hover:bg-[#0d47a1] text-white px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-xs"
          >
            <span>➕ إنشاء معادلة تكوين (BOM)</span>
          </button>
          <button
            onClick={() => {
              if (boms.length === 0) {
                showToast('يرجى إنشاء معادلة تكوين أولاً', 'warning');
                return;
              }
              setSelectedBomId(boms[0].id);
              setOrderQuantity(10);
              setIsOrderModalOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            <span>⚡ إصدار أمر تشغيل وإنتاج</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-4 text-xs font-bold">
        <button
          onClick={() => setActiveTab('orders')}
          className={`pb-2.5 px-2 border-b-2 transition cursor-pointer ${
            activeTab === 'orders' ? 'border-[#1a237e] text-[#1a237e]' : 'border-transparent text-slate-500'
          }`}
        >
          🏭 أوامر الإنتاج والتشغيل ({orders.length})
        </button>
        <button
          onClick={() => setActiveTab('boms')}
          className={`pb-2.5 px-2 border-b-2 transition cursor-pointer ${
            activeTab === 'boms' ? 'border-[#1a237e] text-[#1a237e]' : 'border-transparent text-slate-500'
          }`}
        >
          📋 معادلات التكوين BOM ({boms.length})
        </button>
      </div>

      {/* TAB 1: PRODUCTION ORDERS */}
      {activeTab === 'orders' && (
        <div className="space-y-3">
          {/* Mobile Cards */}
          <div className="block md:hidden space-y-3">
            {orders.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-sm">
                لا توجد أوامر تشغيل مسجلة حالياً
              </div>
            ) : (
              orders.map((order) => (
                <div
                  key={order.id}
                  onClick={() => onInspectItem && onInspectItem('production', order)}
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3 active:bg-slate-50 transition cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                    <div>
                      <strong className="text-slate-900 text-sm block">{order.finishedProductName}</strong>
                      <span className="text-xs font-mono font-bold text-blue-900 block mt-0.5">{order.orderNumber}</span>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        order.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : order.status === 'in_progress'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {order.status === 'completed'
                        ? 'مكتمل ومرحل بالمخزن'
                        : order.status === 'in_progress'
                        ? 'قيد التشغيل'
                        : 'مخطط ومجدول'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-mono">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">الكمية المستهدفة:</span>
                      <strong className="text-slate-800 text-sm">{order.targetQuantity} وحدة</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">تاريخ البدء:</span>
                      <strong className="text-slate-700">{order.startDate}</strong>
                    </div>
                    <div className="col-span-2 pt-1 border-t border-slate-200/50 flex justify-between items-center">
                      <span className="text-xs text-slate-600 font-sans">التكلفة التقديرية:</span>
                      <strong className="text-blue-950 text-sm font-black">
                        {(order.estimatedCost || 0).toLocaleString()} {currency}
                      </strong>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                    {order.status !== 'completed' ? (
                      <button
                        onClick={() => handleExecuteProduction(order)}
                        className="min-h-[42px] bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition shadow-xs flex items-center justify-center gap-1"
                      >
                        ⚡ إتمام الإنتاج والصرف
                      </button>
                    ) : (
                      <div className="min-h-[42px] bg-slate-100 text-slate-500 rounded-xl text-xs font-bold flex items-center justify-center">
                        ✅ تم الإتمام
                      </div>
                    )}
                    <button
                      onClick={() => {
                        openUnifiedPrintWindow(
                          {
                            title: `أمر تشغيل وإنتاج صناعي #${order.orderNumber}`,
                            docNumber: order.orderNumber,
                            date: order.startDate,
                            partyLabel: 'المنتج النهائي',
                            partyName: order.finishedProductName,
                            items: [
                              {
                                name: `تصنيع وتشغيل ${order.finishedProductName}`,
                                qty: order.targetQuantity,
                                price: Math.round(order.estimatedCost / order.targetQuantity),
                                total: order.estimatedCost,
                                notes: `الحالة: ${order.status}`,
                              },
                            ],
                            totals: [{ label: 'إجمالي تكلفة التشغيل:', value: order.estimatedCost, isBold: true, isHighlight: true }],
                          },
                          appData.settings,
                          showToast
                        );
                      }}
                      className="min-h-[42px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition flex items-center justify-center gap-1"
                    >
                      🖨️ طباعة
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">رقم أمر التشغيل</th>
                  <th className="p-3">المنتج النهائي المطلوب</th>
                  <th className="p-3 text-center">الكمية المستهدفة</th>
                  <th className="p-3 text-left">التكلفة التقديرية</th>
                  <th className="p-3 text-center">تاريخ البدء</th>
                  <th className="p-3 text-center">الحالة</th>
                  <th className="p-3 text-center">تنفيذ وترحيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center p-8 text-slate-400">
                      لا توجد أوامر تشغيل مسجلة حالياً
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => onInspectItem && onInspectItem('production', order)}
                      className="hover:bg-blue-50/40 cursor-pointer transition"
                    >
                      <td className="p-3 font-mono font-bold text-blue-900">{order.orderNumber}</td>
                      <td className="p-3 font-bold text-slate-900">{order.finishedProductName}</td>
                      <td className="p-3 text-center font-black text-slate-800 text-sm">{order.targetQuantity}</td>
                      <td className="p-3 text-left font-bold">{(order.estimatedCost || 0).toLocaleString()} {currency}</td>
                      <td className="p-3 text-center font-mono text-slate-500">{order.startDate}</td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            order.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : order.status === 'in_progress'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {order.status === 'completed'
                            ? 'مكتمل ومرحل بالمخزن'
                            : order.status === 'in_progress'
                            ? 'قيد التشغيل'
                            : 'مخطط ومجدول'}
                        </span>
                      </td>
                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          {order.status !== 'completed' && (
                            <button
                              onClick={() => handleExecuteProduction(order)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition shadow-xs"
                              title="خصم الخامات وإضافة المنتج التام بالمخزن وتوليد القيد"
                            >
                              ⚡ إتمام الإنتاج والصرف
                            </button>
                          )}
                          <button
                            onClick={() => {
                              openUnifiedPrintWindow(
                                {
                                  title: `أمر تشغيل وإنتاج صناعي #${order.orderNumber}`,
                                  docNumber: order.orderNumber,
                                  date: order.startDate,
                                  partyLabel: 'المنتج النهائي',
                                  partyName: order.finishedProductName,
                                  items: [
                                    {
                                      name: `تصنيع وتشغيل ${order.finishedProductName}`,
                                      qty: order.targetQuantity,
                                      price: Math.round(order.estimatedCost / order.targetQuantity),
                                      total: order.estimatedCost,
                                      notes: `الحالة: ${order.status}`,
                                    },
                                  ],
                                  totals: [{ label: 'إجمالي تكلفة التشغيل:', value: order.estimatedCost, isBold: true, isHighlight: true }],
                                },
                                appData.settings,
                                showToast
                              );
                            }}
                            className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-1 rounded-lg text-xs font-bold cursor-pointer"
                          >
                            🖨️ طباعة
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: BOM RECIPES */}
      {activeTab === 'boms' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {boms.map((bom) => (
            <div key={bom.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-black text-slate-900 text-sm">{bom.name}</h4>
                  <span className="text-xs text-emerald-700 font-bold block">
                    المنتج المخرج: {bom.finishedProductName} ({bom.outputQuantity} {bom.unit})
                  </span>
                </div>
                <span className="bg-blue-50 text-blue-900 text-xs px-2.5 py-1 rounded-xl font-black">
                  تكلفة الوحدة: {(bom.unitCost || 0).toLocaleString()} {currency}
                </span>
              </div>

              {/* Raw Materials Table */}
              <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 text-xs">
                <span className="text-slate-500 font-bold block mb-1.5">المواد الخام الداخلة في التركيبة:</span>
                <div className="space-y-1">
                  {bom.rawMaterials.map((rm, idx) => (
                    <div key={idx} className="flex justify-between text-[11.5px] border-b border-slate-200/60 pb-1">
                      <span>• {rm.itemName} ({rm.quantity} {rm.unit})</span>
                      <strong className="text-slate-700 font-mono">{((rm.quantity || 0) * (rm.estimatedCost || 0)).toLocaleString()} {currency}</strong>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 pt-2">
                  <span>أجور عمالة مباشرة: {bom.laborCost} {currency}</span>
                  <span>مصاريف صناعية غير مباشرة: {bom.overheadCost} {currency}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* BOM Modal */}
      {isBomModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 space-y-4 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <h3 className="font-black text-lg text-[#1a237e]">إنشاء معادلة تكوين تصنيع (BOM)</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم المعادلة *</label>
                <input
                  type="text"
                  value={bomName}
                  onChange={(e) => setBomName(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl"
                  placeholder="مثال: تركيبة تصنيع طاولة خشبية"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم المنتج التام الصنع *</label>
                <input
                  type="text"
                  value={finishedProductName}
                  onChange={(e) => setFinishedProductName(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl"
                  placeholder="مثال: طاولة طعام زان 6 كراسي"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">الكمية الناتجة من التشغيلة</label>
                <input
                  type="number"
                  min={1}
                  value={outputQty}
                  onChange={(e) => setOutputQty(Number(e.target.value))}
                  className="w-full p-2 border border-slate-300 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">أجور عمالة التشغيل ({currency})</label>
                <input
                  type="number"
                  value={laborCost}
                  onChange={(e) => setLaborCost(Number(e.target.value))}
                  className="w-full p-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">مصاريف صناعية غير مباشرة / إهلاك ({currency})</label>
                <input
                  type="number"
                  value={overheadCost}
                  onChange={(e) => setOverheadCost(Number(e.target.value))}
                  className="w-full p-2 border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            {/* Select Raw Materials */}
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <div className="flex justify-between items-center text-xs">
                <label className="font-bold text-slate-800">المواد الخام والقطع المطلوبة:</label>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddRawMaterial(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="p-1.5 border border-slate-300 rounded-xl bg-slate-50 text-xs"
                >
                  <option value="">➕ إضافة خامة من المخزن...</option>
                  {inventoryItems.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} (رصيده: {it.quantity} | تكلفة: {it.purchasePrice || it.salePrice * 0.7} {currency})
                    </option>
                  ))}
                </select>
              </div>

              {/* Mobile BOM Items Cards */}
              <div className="block sm:hidden space-y-2">
                {bomItems.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs">
                    اختر الخامات من القائمة أعلاه لإضافتها للمعادلة
                  </div>
                ) : (
                  bomItems.map((b, idx) => (
                    <div key={b.itemId} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-900">{b.name}</span>
                        <button
                          type="button"
                          onClick={() => setBomItems(bomItems.filter((_, i) => i !== idx))}
                          className="text-rose-600 font-bold hover:text-rose-800 p-1"
                        >
                          ✕ حذف
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2 items-center">
                        <div>
                          <label className="text-[10px] text-slate-500 block mb-0.5">الكمية:</label>
                          <input
                            type="number"
                            min={0.1}
                            step="0.5"
                            value={b.qty}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setBomItems(bomItems.map((x, i) => (i === idx ? { ...x, qty: val } : x)));
                            }}
                            className="w-full p-1 border border-slate-300 rounded text-center font-bold font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 block mb-0.5">تكلفة الوحدة:</label>
                          <div className="font-mono text-slate-700 font-bold">{b.unitCost} {currency}</div>
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 block mb-0.5">الإجمالي:</label>
                          <div className="font-mono font-black text-emerald-700">
                            {((b.qty || 0) * (b.unitCost || 0)).toLocaleString()} {currency}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop BOM Table */}
              <div className="hidden sm:block border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-right">
                  <thead className="bg-slate-50 font-bold text-slate-700 border-b border-slate-200">
                    <tr>
                      <th className="p-2">الخامة</th>
                      <th className="p-2 text-center" style={{ width: '90px' }}>الكمية</th>
                      <th className="p-2 text-left" style={{ width: '100px' }}>تكلفة الوحدة</th>
                      <th className="p-2 text-left" style={{ width: '100px' }}>الإجمالي</th>
                      <th className="p-2 text-center" style={{ width: '40px' }}>-</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bomItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-slate-400">
                          اختر الخامات من القائمة أعلاه لإضافتها للمعادلة
                        </td>
                      </tr>
                    ) : (
                      bomItems.map((b, idx) => (
                        <tr key={b.itemId}>
                          <td className="p-2 font-bold">{b.name}</td>
                          <td className="p-2 text-center">
                            <input
                              type="number"
                              min={0.1}
                              step="0.5"
                              value={b.qty}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setBomItems(bomItems.map((x, i) => (i === idx ? { ...x, qty: val } : x)));
                              }}
                              className="w-16 p-1 border rounded text-center font-bold"
                            />
                          </td>
                          <td className="p-2 text-left">{b.unitCost} {currency}</td>
                          <td className="p-2 text-left font-bold">{((b.qty || 0) * (b.unitCost || 0)).toLocaleString()} {currency}</td>
                          <td className="p-2 text-center">
                            <button
                              onClick={() => setBomItems(bomItems.filter((_, i) => i !== idx))}
                              className="text-rose-600 font-bold hover:text-rose-800"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Total Calculated Preview */}
              <div className="bg-blue-50 p-3 rounded-xl flex justify-between items-center text-xs font-bold text-blue-950">
                <span>إجمالي تكلفة التشغيلة: {(calculateBomTotalCost(bomItems, laborCost, overheadCost, outputQty)?.total || 0).toLocaleString()} {currency}</span>
                <span>تكلفة القطعة الواحدة التامة: {(calculateBomTotalCost(bomItems, laborCost, overheadCost, outputQty)?.unitCost || 0).toLocaleString()} {currency}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsBomModalOpen(false)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveBom}
                className="bg-[#1a237e] hover:bg-[#0d47a1] text-white px-5 py-2 rounded-xl text-xs font-bold cursor-pointer shadow-xs"
              >
                💾 حفظ معادلة التكوين
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Modal */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 border border-slate-200">
            <h3 className="font-black text-lg text-emerald-900">إصدار أمر تشغيل وإنتاج</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اختر معادلة التكوين (BOM)</label>
                <select
                  value={selectedBomId}
                  onChange={(e) => setSelectedBomId(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl bg-white"
                >
                  {boms.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} (ينتج: {b.finishedProductName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">الكمية المستهدف إنتاجها (قطعة)</label>
                <input
                  type="number"
                  min={1}
                  value={orderQuantity}
                  onChange={(e) => setOrderQuantity(Number(e.target.value))}
                  className="w-full p-2 border border-slate-300 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ملاحظات التشغيل</label>
                <input
                  type="text"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl"
                  placeholder="رقم الوردية، المشرف المسئول..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsOrderModalOpen(false)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={handleCreateOrder}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-xs font-bold cursor-pointer shadow-xs"
              >
                ⚡ إصدار أمر التشغيل
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
