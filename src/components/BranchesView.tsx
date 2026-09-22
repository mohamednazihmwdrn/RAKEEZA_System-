import React, { useState } from 'react';
import { AppData, Branch, StockTransfer } from '../types';
import { Modal } from './Modal';
import { addAuditLog } from '../utils/storage';
import { openUnifiedPrintWindow } from '../utils/printUnified';
import { exportToExcel } from '../utils/excelExport';
import { TableActionButtons } from './TableActionButtons';

interface BranchesViewProps {
  appData: AppData;
  onUpdateData: (newData: AppData) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export const BranchesView: React.FC<BranchesViewProps> = ({
  appData,
  onUpdateData,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<'branches' | 'transfers' | 'branchStock'>('branches');
  const [isAddBranchModalOpen, setIsAddBranchModalOpen] = useState(false);
  const [isNewTransferModalOpen, setIsNewTransferModalOpen] = useState(false);

  // Branch form
  const [branchCode, setBranchCode] = useState('');
  const [branchName, setBranchName] = useState('');
  const [branchLocation, setBranchLocation] = useState('');
  const [branchPhone, setBranchPhone] = useState('');
  const [branchManager, setBranchManager] = useState('');

  // Transfer form
  const [fromBranchId, setFromBranchId] = useState(appData.branches[0]?.id || 'br-main');
  const [toBranchId, setToBranchId] = useState(appData.branches[1]?.id || 'br-branch2');
  const [transferItemId, setTransferItemId] = useState('');
  const [transferQty, setTransferQty] = useState(1);
  const [transferNote, setTransferNote] = useState('');

  const handleAddBranch = () => {
    if (!branchCode.trim() || !branchName.trim()) {
      showToast('يرجى إدخال كود واسم الفرع', 'warning');
      return;
    }

    const newBranch: Branch = {
      id: `br-${Date.now()}`,
      code: branchCode.trim(),
      name: branchName.trim(),
      location: branchLocation.trim() || 'غير محدد',
      phone: branchPhone.trim() || '01000000000',
      isMain: false,
      manager: branchManager.trim() || undefined,
    };

    let updatedData: AppData = {
      ...appData,
      branches: [...(appData.branches || []), newBranch],
    };

    updatedData = addAuditLog(
      updatedData,
      'create',
      'إدارة الفروع',
      `تمت إضافة فرع/مخزن جديد: ${newBranch.code} - ${newBranch.name}`
    );

    onUpdateData(updatedData);
    showToast('تمت إضافة الفرع الجديد بنجاح', 'success');
    setIsAddBranchModalOpen(false);
    setBranchCode('');
    setBranchName('');
    setBranchLocation('');
    setBranchPhone('');
    setBranchManager('');
  };

  const handleSetActiveBranch = (branchId: string) => {
    const br = appData.branches.find((b) => b.id === branchId);
    let updatedData: AppData = {
      ...appData,
      activeBranchId: branchId,
    };
    onUpdateData(updatedData);
    showToast(`تم تبديل جلسة العمل الحالية إلى: ${br?.name || 'الفرع المحدد'}`, 'info');
  };

  const handleExecuteTransfer = () => {
    if (fromBranchId === toBranchId) {
      showToast('لا يمكن التحويل لنفس الفرع! يرجى اختيار فرع مستلم مختلف', 'warning');
      return;
    }

    const item = appData.items.find((i) => i.id === transferItemId);
    if (!item) {
      showToast('يرجى اختيار الصنف المراد تحويله', 'warning');
      return;
    }

    if (transferQty <= 0 || transferQty > item.quantity) {
      showToast(`الكمية المطلوبة غير متوفرة! المتوفر حالياً: ${item.quantity}`, 'error');
      return;
    }

    const fromBranch = appData.branches.find((b) => b.id === fromBranchId);
    const toBranch = appData.branches.find((b) => b.id === toBranchId);
    const today = new Date().toISOString().split('T')[0];
    const currentUserObj = appData.users.find((u) => u.id === appData.currentUser) || appData.users[0];

    const transferId = (appData.stockTransfers?.length || 0) + 1;
    const newTransfer: StockTransfer = {
      id: transferId,
      date: today,
      fromBranch: fromBranch?.name || 'فرع المصدر',
      toBranch: toBranch?.name || 'فرع المستلم',
      items: [
        {
          itemId: item.id,
          itemName: item.name,
          qty: transferQty,
          cost: item.purchasePrice,
        },
      ],
      note: transferNote.trim() || undefined,
      createdBy: currentUserObj?.name || 'مدير النظام',
      status: 'completed',
    };

    // Update item stock across branch stock tracking
    const updatedItems = appData.items.map((it) => {
      if (it.id === item.id) {
        const bStock = { ...(it.branchStock || {}) };
        bStock[fromBranchId] = Math.max(0, (bStock[fromBranchId] || it.quantity) - transferQty);
        bStock[toBranchId] = (bStock[toBranchId] || 0) + transferQty;

        return {
          ...it,
          branchStock: bStock,
          movements: [
            ...(it.movements || []),
            {
              date: today,
              type: 'transfer_out' as const,
              qty: transferQty,
              price: it.purchasePrice,
              total: transferQty * it.purchasePrice,
              note: `تحويل مخزني #${transferId} من [${fromBranch?.name}] إلى [${toBranch?.name}]`,
            },
          ],
        };
      }
      return it;
    });

    let updatedData: AppData = {
      ...appData,
      items: updatedItems,
      stockTransfers: [newTransfer, ...(appData.stockTransfers || [])],
    };

    updatedData = addAuditLog(
      updatedData,
      'transfer',
      'التحويلات المخزنية',
      `تم تحويل ${transferQty} من صنف (${item.name}) من فرع [${fromBranch?.name}] إلى [${toBranch?.name}]`
    );

    onUpdateData(updatedData);
    showToast(`تم إتمام التحويل المخزني بنجاح بين الفروع وتحديث الأرصدة`, 'success');
    setIsNewTransferModalOpen(false);
    setTransferItemId('');
    setTransferQty(1);
    setTransferNote('');
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation & Controls */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('branches')}
            className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'branches'
                ? 'bg-[#1a237e] text-white shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            🏢 الفروع والمخازن ({appData.branches?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('transfers')}
            className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'transfers'
                ? 'bg-[#1a237e] text-white shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            🚚 التحويلات بين المخازن ({appData.stockTransfers?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('branchStock')}
            className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'branchStock'
                ? 'bg-[#1a237e] text-white shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            📦 أرصدة الأصناف حسب الفرع
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <TableActionButtons
            printLabel="طباعة السجل"
            onPrint={() => {
              if (activeTab === 'branches') {
                openUnifiedPrintWindow(
                  {
                    title: 'دليل الفروع والمستودعات المسجلة',
                    partyLabel: 'إجمالي الفروع',
                    partyName: `${appData.branches?.length || 0} فرع ومستودع`,
                    items: (appData.branches || []).map((b) => ({
                      name: `${b.name} (${b.code})`,
                      unit: b.isMain ? 'الفرع الرئيسي' : 'فرع فرعي',
                      qty: 1,
                      price: 0,
                      total: 0,
                      notes: `العنوان: ${b.location} | الهاتف: ${b.phone} | المدير: ${b.manager || '-'}`,
                    })),
                    totals: [
                      {
                        label: 'إجمالي الفروع والمخازن:',
                        value: appData.branches?.length || 0,
                        isBold: true,
                      },
                    ],
                  },
                  appData.settings,
                  showToast
                );
              } else if (activeTab === 'transfers') {
                openUnifiedPrintWindow(
                  {
                    title: 'سجل التحويلات المخزنية بين الفروع والمستودعات',
                    partyLabel: 'إجمالي أذون التحويل',
                    partyName: `${appData.stockTransfers?.length || 0} إذن تحويل`,
                    items: (appData.stockTransfers || []).map((t) => ({
                      name: `${t.itemName} (${t.transferNumber})`,
                      unit: 'كمية محولة',
                      qty: t.quantity,
                      price: 0,
                      total: 0,
                      notes: `من: [${t.fromBranchName}] إلى: [${t.toBranchName}] | التاريخ: ${t.date} | المسؤول: ${t.createdBy}`,
                    })),
                    totals: [
                      {
                        label: 'إجمالي كميات البضاعة المحولة:',
                        value: (appData.stockTransfers || []).reduce((acc, t) => acc + t.quantity, 0),
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
                    title: 'تقرير أرصدة المخزون حسب الفروع والمستودعات',
                    partyLabel: 'إجمالي الأصناف',
                    partyName: `${appData.items.length} صنف`,
                    items: appData.items.map((it) => ({
                      name: it.name,
                      code: it.barcode || it.id,
                      unit: it.unit || 'قطعة',
                      qty: it.quantity,
                      price: it.purchasePrice,
                      total: it.quantity * it.purchasePrice,
                      notes: (appData.branches || []).map((b) => `${b.name}: ${it.branchStock?.[b.id] ?? (b.isMain ? it.quantity : 0)}`).join(' | '),
                    })),
                    totals: [
                      {
                        label: 'إجمالي قيمة المخزون العام:',
                        value: appData.items.reduce((acc, it) => acc + it.quantity * it.purchasePrice, 0),
                        isBold: true,
                        isHighlight: true,
                      },
                    ],
                  },
                  appData.settings,
                  showToast
                );
              }
            }}
            onExportExcel={() => {
              if (activeTab === 'branches') {
                exportToExcel({
                  filename: `دليل_الفروع_والمخازن_${new Date().toISOString().split('T')[0]}`,
                  sheetName: 'الفروع والمخازن',
                  data: appData.branches || [],
                  columns: [
                    { header: 'كود الفرع', key: 'code', width: 14 },
                    { header: 'اسم الفرع / المستودع', key: 'name', width: 25 },
                    { header: 'النوع', getValue: (b) => b.isMain ? 'فرع رئيسي' : 'فرع فرعي', width: 16 },
                    { header: 'العنوان والموقع', key: 'location', width: 25 },
                    { header: 'رقم الهاتف', key: 'phone', width: 16 },
                    { header: 'مدير الفرع / المسؤول', getValue: (b) => b.manager || '-', width: 20 },
                  ],
                  companyName: appData.settings?.companyName || 'المنظومة المحاسبية المعتمدة',
                  reportTitle: 'دليل وبيانات الفروع والمستودعات المسجلة',
                });
                showToast('تم تصدير دليل الفروع إلى Excel بنجاح', 'success');
              } else if (activeTab === 'transfers') {
                exportToExcel({
                  filename: `سجل_التحويلات_المخزنية_${new Date().toISOString().split('T')[0]}`,
                  sheetName: 'التحويلات المخزنية',
                  data: appData.stockTransfers || [],
                  columns: [
                    { header: 'رقم الإذن', key: 'transferNumber', width: 16 },
                    { header: 'التاريخ', key: 'date', width: 14 },
                    { header: 'اسم الصنف المحول', key: 'itemName', width: 25 },
                    { header: 'الكمية المحولة', key: 'quantity', width: 14 },
                    { header: 'من فرع / مخزن', key: 'fromBranchName', width: 20 },
                    { header: 'إلى فرع / مخزن', key: 'toBranchName', width: 20 },
                    { header: 'المسؤول والمحرر', key: 'createdBy', width: 18 },
                    { header: 'ملاحظات', getValue: (t) => t.notes || '-', width: 25 },
                  ],
                  companyName: appData.settings?.companyName || 'المنظومة المحاسبية المعتمدة',
                  reportTitle: 'سجل أذون التحويلات المخزنية بين الفروع',
                });
                showToast('تم تصدير سجل التحويلات إلى Excel بنجاح', 'success');
              } else {
                exportToExcel({
                  filename: `أرصدة_المخزون_حسب_الفروع_${new Date().toISOString().split('T')[0]}`,
                  sheetName: 'أرصدة المخزون بالفرع',
                  data: appData.items,
                  columns: [
                    { header: 'كود / باركود الصنف', getValue: (i) => i.barcode || i.id, width: 18 },
                    { header: 'اسم الصنف', key: 'name', width: 25 },
                    { header: 'الوحدة', getValue: (i) => i.unit || 'قطعة', width: 12 },
                    { header: 'إجمالي الرصيد العام', key: 'quantity', width: 18 },
                    { header: 'سعر التكلفة (ج.م)', getValue: (i) => i.purchasePrice.toFixed(2), width: 18 },
                    { header: 'إجمالي القيمة (ج.م)', getValue: (i) => (i.quantity * i.purchasePrice).toFixed(2), width: 20 },
                    ...(appData.branches || []).map((b) => ({
                      header: `رصيد فرع [${b.name}]`,
                      getValue: (i: any) => String(i.branchStock?.[b.id] ?? (b.isMain ? i.quantity : 0)),
                      width: 18,
                    })),
                  ],
                  companyName: appData.settings?.companyName || 'المنظومة المحاسبية المعتمدة',
                  reportTitle: 'تقرير وتفصيل أرصدة المخزون الموزعة على الفروع والمستودعات',
                });
                showToast('تم تصدير أرصدة المخزون إلى Excel بنجاح', 'success');
              }
            }}
          />
          {activeTab === 'branches' && (
            <button
              onClick={() => setIsAddBranchModalOpen(true)}
              className="bg-[#2e7d32] hover:bg-[#1b5e20] text-white px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition cursor-pointer flex items-center gap-1 shadow-sm"
            >
              ➕ إضافة فرع / مخزن جديد
            </button>
          )}
          {activeTab === 'transfers' && (
            <button
              onClick={() => setIsNewTransferModalOpen(true)}
              className="bg-[#0288d1] hover:bg-[#0277bd] text-white px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition cursor-pointer flex items-center gap-1 shadow-sm"
            >
              ➕ إنشاء إذن تحويل بضاعة
            </button>
          )}
        </div>
      </div>

      {/* Tab 1: Branches List */}
      {activeTab === 'branches' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-base md:text-lg font-bold text-[#1a237e]">
              إدارة الفروع والمخازن والمعارض (Multi-Branch Management)
            </h3>
            <p className="text-xs text-slate-500">
              يمكنك العمل على مستوى الفرع المحدد أو متابعة المؤشرات المجمعة لكافة فروع ومخازن المؤسسة.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(appData.branches || []).map((br) => {
              const isSelected = appData.activeBranchId === br.id;
              return (
                <div
                  key={br.id}
                  className={`p-5 rounded-2xl border-2 transition space-y-3 ${
                    isSelected
                      ? 'border-[#1a237e] bg-indigo-50/40 shadow-md'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-mono bg-blue-100 text-blue-900 px-2 py-0.5 rounded text-xs font-bold">
                      {br.code}
                    </span>
                    {br.isMain && (
                      <span className="bg-amber-100 text-amber-900 text-[11px] px-2 py-0.5 rounded font-bold">
                        ⭐ الفرع الرئيسي
                      </span>
                    )}
                  </div>

                  <div>
                    <h4 className="font-black text-slate-900 text-base">{br.name}</h4>
                    <p className="text-xs text-slate-500 mt-1">📍 {br.location}</p>
                    <p className="text-xs text-slate-500">📞 {br.phone}</p>
                    {br.manager && <p className="text-xs text-slate-600 font-semibold mt-1">👤 المدير: {br.manager}</p>}
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 flex justify-between items-center">
                    {isSelected ? (
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg">
                        ✅ الفرع النشط حالياً
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSetActiveBranch(br.id)}
                        className="bg-[#1a237e] hover:bg-[#0d47a1] text-white px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                      >
                        تبديل إلى هذا الفرع 🔄
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Stock Transfers */}
      {activeTab === 'transfers' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-base md:text-lg font-bold text-[#1a237e]">
              سجل أذون وتحويلات البضاعة بين المخازن (Stock Transfers)
            </h3>
            <p className="text-xs text-slate-500">
              تتبع حركة نقل الأصناف بين المستودعات مع خصم وإضافة الكميات تلقائياً وتحديث كشوف الحركة.
            </p>
          </div>

          {/* Mobile Transfers Cards (< md) */}
          <div className="block md:hidden space-y-3">
            {(!appData.stockTransfers || appData.stockTransfers.length === 0) ? (
              <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                لا توجد أذون تحويلات مسجلة بعد. اضغط على الزر أعلاه لإنشاء إذن تحويل.
              </div>
            ) : (
              appData.stockTransfers.map((t) => (
                <div key={t.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
                    <span className="font-mono font-bold text-indigo-900">#TR-{t.id}</span>
                    <span className="font-mono text-slate-500">{t.date}</span>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded font-bold">
                      ✅ مكتمل
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-400 block mb-0.5">من فرع:</span>
                      <span className="font-bold text-rose-700">📤 {t.fromBranch}</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-400 block mb-0.5">إلى فرع:</span>
                      <span className="font-bold text-emerald-700">📥 {t.toBranch}</span>
                    </div>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200 space-y-1">
                    <span className="text-[10px] text-slate-400 block">الأصناف المحولة:</span>
                    {t.items.map((i, idx) => (
                      <div key={idx} className="font-bold text-slate-900 flex justify-between">
                        <span>{i.itemName}</span>
                        <span className="font-mono text-indigo-700 font-bold">{i.qty} قطعة</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-[11px] text-slate-500 text-left font-mono">
                    المسؤول: {t.createdBy}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Transfers Table (>= md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-right text-xs md:text-sm">
              <thead className="bg-[#1a237e] text-white">
                <tr>
                  <th className="p-3 rounded-r-lg">رقم الإذن</th>
                  <th className="p-3">التاريخ</th>
                  <th className="p-3">من فرع</th>
                  <th className="p-3">إلى فرع</th>
                  <th className="p-3">الأصناف والكمية</th>
                  <th className="p-3">المسؤول</th>
                  <th className="p-3 rounded-l-lg">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(!appData.stockTransfers || appData.stockTransfers.length === 0) ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      لا توجد أذون تحويلات مسجلة بعد. اضغط على الزر أعلاه لإنشاء إذن تحويل.
                    </td>
                  </tr>
                ) : (
                  appData.stockTransfers.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-indigo-900">#TR-{t.id}</td>
                      <td className="p-3 font-mono">{t.date}</td>
                      <td className="p-3 font-semibold text-rose-700">📤 {t.fromBranch}</td>
                      <td className="p-3 font-semibold text-emerald-700">📥 {t.toBranch}</td>
                      <td className="p-3">
                        {t.items.map((i, idx) => (
                          <div key={idx} className="font-bold">
                            {i.itemName} ({i.qty} قطعة)
                          </div>
                        ))}
                      </td>
                      <td className="p-3 text-slate-600">{t.createdBy}</td>
                      <td className="p-3">
                        <span className="bg-emerald-100 text-emerald-800 text-[11px] px-2 py-0.5 rounded font-bold">
                          ✅ مكتمل ومرحل
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Branch Stock Distribution */}
      {activeTab === 'branchStock' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-base md:text-lg font-bold text-[#1a237e]">
              توزيع أرصدة المخزون على الفروع والمخازن
            </h3>
            <p className="text-xs text-slate-500">
              استعراض كميات كل صنف في كافة المستودعات بشكل منفصل مع الإجمالي الكلي.
            </p>
          </div>

          {/* Mobile Stock Distribution Cards (< md) */}
          <div className="block md:hidden space-y-3">
            {appData.items.map((item) => (
              <div key={item.id} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-2">
                  <div>
                    <span className="font-bold text-slate-900 text-sm block">{item.name}</span>
                    <span className="font-mono text-[11px] text-slate-500">{item.barcode || item.id}</span>
                  </div>
                  <div className="text-left">
                    <span className="text-[10px] text-slate-400 block">الإجمالي:</span>
                    <span className="font-mono font-black text-emerald-800 text-sm">{item.quantity}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  {appData.branches.map((b) => {
                    const qtyInBranch = item.branchStock?.[b.id] ?? (b.isMain ? item.quantity : 0);
                    return (
                      <div key={b.id} className="bg-white p-2 rounded-lg border border-slate-200 flex justify-between items-center">
                        <span className="text-slate-600 truncate">{b.name}:</span>
                        <span className="font-mono font-bold text-slate-900 mr-1">{qtyInBranch}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Stock Distribution Table (>= md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-right text-xs md:text-sm">
              <thead className="bg-[#1a237e] text-white">
                <tr>
                  <th className="p-3 rounded-r-lg">كود/باركود</th>
                  <th className="p-3">اسم الصنف</th>
                  {appData.branches.map((b) => (
                    <th key={b.id} className="p-3 text-center">
                      {b.name}
                    </th>
                  ))}
                  <th className="p-3 rounded-l-lg text-center">الإجمالي الكلي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {appData.items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono text-slate-600">{item.barcode || item.id}</td>
                    <td className="p-3 font-bold text-slate-900">{item.name}</td>
                    {appData.branches.map((b) => {
                      const qtyInBranch = item.branchStock?.[b.id] ?? (b.isMain ? item.quantity : 0);
                      return (
                        <td key={b.id} className="p-3 text-center font-mono font-bold text-slate-700">
                          {qtyInBranch}
                        </td>
                      );
                    })}
                    <td className="p-3 text-center font-mono font-black text-emerald-800 bg-emerald-50/50">
                      {item.quantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Add Branch */}
      <Modal
        isOpen={isAddBranchModalOpen}
        onClose={() => setIsAddBranchModalOpen(false)}
        title="➕ إضافة فرع أو مستودع جديد"
        footer={
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsAddBranchModalOpen(false)}
              className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              إلغاء
            </button>
            <button
              onClick={handleAddBranch}
              className="bg-[#2e7d32] hover:bg-[#1b5e20] text-white px-5 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              حفظ الفرع
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs md:text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">كود الفرع *</label>
              <input
                type="text"
                value={branchCode}
                onChange={(e) => setBranchCode(e.target.value)}
                placeholder="مثال: BR-03"
                className="w-full p-2.5 border border-slate-300 rounded-xl font-mono font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">اسم الفرع / المخزن *</label>
              <input
                type="text"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder="مثال: فرع الإسكندرية والمعرض"
                className="w-full p-2.5 border border-slate-300 rounded-xl font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">الموقع والعنوان</label>
            <input
              type="text"
              value={branchLocation}
              onChange={(e) => setBranchLocation(e.target.value)}
              placeholder="مثال: سموحة، الإسكندرية"
              className="w-full p-2.5 border border-slate-300 rounded-xl"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">هاتف الفرع</label>
              <input
                type="text"
                value={branchPhone}
                onChange={(e) => setBranchPhone(e.target.value)}
                placeholder="010..."
                className="w-full p-2.5 border border-slate-300 rounded-xl font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">المدير المسؤول</label>
              <input
                type="text"
                value={branchManager}
                onChange={(e) => setBranchManager(e.target.value)}
                placeholder="اسم المشرف أو المدير"
                className="w-full p-2.5 border border-slate-300 rounded-xl"
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal: New Stock Transfer */}
      <Modal
        isOpen={isNewTransferModalOpen}
        onClose={() => setIsNewTransferModalOpen(false)}
        title="➕ إنشاء إذن تحويل بضاعة بين المخازن"
        footer={
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsNewTransferModalOpen(false)}
              className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              إلغاء
            </button>
            <button
              onClick={handleExecuteTransfer}
              className="bg-[#0288d1] hover:bg-[#0277bd] text-white px-5 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              تنفيذ وترحيل التحويل
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs md:text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">من فرع / مخزن المصدر *</label>
              <select
                value={fromBranchId}
                onChange={(e) => setFromBranchId(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl font-bold bg-slate-50"
              >
                {appData.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">إلى فرع / مخزن المستلم *</label>
              <select
                value={toBranchId}
                onChange={(e) => setToBranchId(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl font-bold bg-slate-50"
              >
                {appData.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">الصنف المراد تحويله *</label>
              <select
                value={transferItemId}
                onChange={(e) => setTransferItemId(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl"
              >
                <option value="">-- اختر الصنف --</option>
                {appData.items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} (المتوفر بالمخزن: {i.quantity})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">الكمية المحولة *</label>
              <input
                type="number"
                min="1"
                value={transferQty}
                onChange={(e) => setTransferQty(parseInt(e.target.value) || 1)}
                className="w-full p-2.5 border border-slate-300 rounded-xl font-mono text-center font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">ملاحظات التحويل</label>
            <input
              type="text"
              value={transferNote}
              onChange={(e) => setTransferNote(e.target.value)}
              placeholder="سبب التحويل أو رقم إذن السائق..."
              className="w-full p-2.5 border border-slate-300 rounded-xl"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
