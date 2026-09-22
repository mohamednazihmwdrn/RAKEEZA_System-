import React, { useState } from 'react';
import { AppData, FixedAsset, DepreciationLog, JournalEntry } from '../types';
import { addAuditLog } from '../utils/storage';
import { openUnifiedPrintWindow } from '../utils/printUnified';
import { exportToExcel } from '../utils/excelExport';
import { TableActionButtons } from './TableActionButtons';

interface FixedAssetsViewProps {
  appData: AppData;
  onUpdateData: (newData: AppData) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onInspectItem?: (type: any, data: any) => void;
}

export const FixedAssetsView: React.FC<FixedAssetsViewProps> = ({
  appData,
  onUpdateData,
  showToast,
  onInspectItem,
}) => {
  const [activeTab, setActiveTab] = useState<'assets' | 'depreciation_logs'>('assets');
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);

  // Asset Form State
  const [assetName, setAssetName] = useState('');
  const [assetCategory, setAssetCategory] = useState<FixedAsset['category']>('vehicles');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().substring(0, 10));
  const [purchasePrice, setPurchasePrice] = useState<number>(50000);
  const [salvageValue, setSalvageValue] = useState<number>(5000);
  const [usefulLifeYears, setUsefulLifeYears] = useState<number>(5);
  const [assetLocation, setAssetLocation] = useState('المقر الرئيسي');
  const [assetNotes, setAssetNotes] = useState('');

  const currency = appData.settings?.currencySymbol || 'ج.م';
  const assets = appData.fixedAssets || [];
  const logs = appData.depreciationLogs || [];

  const totalAssetCost = assets.reduce((acc, a) => acc + a.purchasePrice, 0);
  const totalAccumulated = assets.reduce((acc, a) => acc + a.accumulatedDepreciation, 0);
  const totalNetBookValue = assets.reduce((acc, a) => acc + a.netBookValue, 0);

  // Run 1-Click Monthly/Annual Depreciation
  const handleRunPeriodicDepreciation = () => {
    if (assets.length === 0) {
      showToast('لا توجد أصول مسجلة لاحتساب الإهلاك', 'warning');
      return;
    }

    const currentPeriod = new Date().toISOString().substring(0, 7); // YYYY-MM
    let nextJournalId = appData.nextJournalId || 1;
    let totalDepreciationAmount = 0;
    const newLogs: DepreciationLog[] = [];

    const updatedAssets = assets.map((asset) => {
      if (asset.status !== 'active' || asset.netBookValue <= asset.salvageValue) {
        return asset;
      }

      // Monthly depreciation = (Purchase Price - Salvage Value) / (Useful Years * 12)
      const annualDepreciation = (asset.purchasePrice - asset.salvageValue) / asset.usefulLifeYears;
      const monthlyDepreciation = Math.round(annualDepreciation / 12);
      const effectiveDepreciation = Math.min(monthlyDepreciation, Math.max(0, asset.netBookValue - asset.salvageValue));

      if (effectiveDepreciation > 0) {
        totalDepreciationAmount += effectiveDepreciation;
        const newAccum = asset.accumulatedDepreciation + effectiveDepreciation;
        const newBookValue = asset.purchasePrice - newAccum;

        newLogs.push({
          id: `dep-${Date.now()}-${asset.id}`,
          assetId: asset.id,
          assetName: asset.name,
          date: new Date().toISOString().substring(0, 10),
          fiscalYear: new Date().getFullYear().toString(),
          period: currentPeriod,
          amount: effectiveDepreciation,
          accumulatedBefore: asset.accumulatedDepreciation,
          accumulatedAfter: newAccum,
          bookValueAfter: newBookValue,
          journalEntryId: nextJournalId,
          createdBy: appData.users.find((u) => u.id === appData.currentUser)?.name || 'المدير',
        });

        return {
          ...asset,
          accumulatedDepreciation: newAccum,
          netBookValue: newBookValue,
          status: newBookValue <= asset.salvageValue ? ('depreciated' as const) : ('active' as const),
        };
      }
      return asset;
    });

    if (totalDepreciationAmount === 0) {
      showToast('جميع الأصول وصلت لقيمتها التخريدية أو مهلكة بالكامل', 'info');
      return;
    }

    // Dual Accounting Journal Entry:
    // Debit: 5204 مصروف إهلاك الأصول الثابتة
    // Credit: 1201 مجمع إهلاك الأصول الثابتة
    const journalEntry: JournalEntry = {
      id: nextJournalId,
      entryNumber: `DEP-${currentPeriod.replace('-', '')}-${String(nextJournalId).padStart(3, '0')}`,
      date: new Date().toISOString().substring(0, 10),
      description: `إثبات قسط الإهلاك الدوري للأصول الثابتة عن فترة ${currentPeriod}`,
      source: 'manual',
      createdBy: appData.users.find((u) => u.id === appData.currentUser)?.name || 'المدير',
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      isApproved: true,
      lines: [
        {
          accountCode: '5204',
          accountName: 'مصروف إهلاك أصول ومعدات',
          debit: totalDepreciationAmount,
          credit: 0,
          note: `إهلاك شهري عن ${currentPeriod}`,
        },
        {
          accountCode: '1201',
          accountName: 'مجمع إهلاك الأصول الثابتة',
          debit: 0,
          credit: totalDepreciationAmount,
          note: `إهلاك مجمع للأصول الثابتة`,
        },
      ],
    };

    let updated: AppData = {
      ...appData,
      fixedAssets: updatedAssets,
      depreciationLogs: [...newLogs, ...appData.depreciationLogs],
      journalEntries: [journalEntry, ...appData.journalEntries],
      nextJournalId: nextJournalId + 1,
    };

    updated = addAuditLog(
      updated,
      'approval',
      'الأصول الثابتة',
      `تم تشغيل دورة الإهلاك الدوري بقيمة إجمالية ${totalDepreciationAmount} ${currency} وتوليد القيد المحاسبي #${journalEntry.entryNumber}.`
    );

    onUpdateData(updated);
    showToast(`تم احتساب الإهلاك بقيمة ${(totalDepreciationAmount || 0).toLocaleString()} ${currency} وتوليد القيد المحاسبي بنجاح`, 'success');
  };

  // Save Asset
  const handleSaveAsset = () => {
    if (!assetName.trim()) {
      showToast('يرجى كتابة اسم الأصل الثابت', 'warning');
      return;
    }

    const depRate = usefulLifeYears > 0 ? +(100 / usefulLifeYears).toFixed(2) : 20;
    let updated = { ...appData };

    if (editingAssetId) {
      updated.fixedAssets = updated.fixedAssets.map((a) =>
        a.id === editingAssetId
          ? {
              ...a,
              name: assetName,
              category: assetCategory,
              purchaseDate,
              purchasePrice: Number(purchasePrice),
              salvageValue: Number(salvageValue),
              usefulLifeYears: Number(usefulLifeYears),
              annualDepreciationRate: depRate,
              netBookValue: Number(purchasePrice) - a.accumulatedDepreciation,
              location: assetLocation,
              notes: assetNotes,
            }
          : a
      );
      showToast('تم تحديث الأصل بنجاح', 'success');
    } else {
      const newAsset: FixedAsset = {
        id: `asset-${Date.now()}`,
        code: `AST-${String(assets.length + 1).padStart(3, '0')}`,
        name: assetName,
        category: assetCategory,
        purchaseDate,
        purchasePrice: Number(purchasePrice),
        salvageValue: Number(salvageValue),
        usefulLifeYears: Number(usefulLifeYears),
        annualDepreciationRate: depRate,
        accumulatedDepreciation: 0,
        netBookValue: Number(purchasePrice),
        location: assetLocation,
        status: 'active',
        notes: assetNotes,
      };
      updated.fixedAssets = [newAsset, ...updated.fixedAssets];
      showToast('تمت إضافة الأصل الثابت بنجاح', 'success');
    }

    onUpdateData(updated);
    setIsAssetModalOpen(false);
  };

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      {/* Top Header & Sub-nav */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap justify-between items-center gap-4">
        <div>
          <h3 className="text-lg font-black text-[#1a237e] flex items-center gap-2">
            <span>🏢 إدارة الأصول الثابتة والإهلاكات المحاسبية (Fixed Assets)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            تسجيل الأصول، رصد القيمة الدفترية، حساب أقساط الإهلاك الآلي، وترحيل القيود لمحاسبة التكاليف.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => {
              setEditingAssetId(null);
              setAssetName('');
              setPurchasePrice(30000);
              setSalvageValue(3000);
              setUsefulLifeYears(5);
              setAssetNotes('');
              setIsAssetModalOpen(true);
            }}
            className="flex-1 sm:flex-initial min-h-[42px] bg-[#1a237e] hover:bg-[#0d47a1] text-white px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1 shadow-xs whitespace-nowrap"
          >
            <span>➕ تسجيل أصل جديد</span>
          </button>
          <button
            type="button"
            onClick={handleRunPeriodicDepreciation}
            className="flex-1 sm:flex-initial min-h-[42px] bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs whitespace-nowrap"
          >
            <span>⚡ احتساب وإثبات الإهلاك الدوري</span>
          </button>
          <TableActionButtons
            onPrint={() => {
              openUnifiedPrintWindow(
                {
                  title: 'تقرير وحصر الأصول الثابتة والقيمة الدفترية',
                  items: assets.map((a) => ({
                    name: `${a.name} (${a.code})`,
                    unit: a.location,
                    qty: 1,
                    price: a.purchasePrice,
                    discount: a.accumulatedDepreciation,
                    total: a.netBookValue,
                    notes: `معدل إهلاك: ${a.annualDepreciationRate}% | حالة: ${a.status === 'active' ? 'يعمل' : 'مهلك'}`,
                  })),
                  totals: [
                    { label: 'إجمالي تكلفة الشراء الأصلية:', value: totalAssetCost },
                    { label: 'إجمالي مجمع الإهلاك:', value: -totalAccumulated },
                    { label: 'صافي القيمة الدفترية الحالية للأصول:', value: totalNetBookValue, isBold: true, isHighlight: true },
                  ],
                },
                appData.settings,
                showToast
              );
            }}
            onExportExcel={() => {
              exportToExcel({
                filename: `سجل_الأصول_الثابتة_${new Date().toISOString().split('T')[0]}`,
                sheetName: 'الأصول الثابتة',
                data: assets,
                columns: [
                  { header: 'كود الأصل', key: 'code', width: 14 },
                  { header: 'اسم الأصل', key: 'name', width: 25 },
                  {
                    header: 'الفئة / التصنيف',
                    getValue: (a: FixedAsset) => a.category === 'vehicles' ? 'سيارات ومركبات' : a.category === 'machinery' ? 'آلات ومعدات' : a.category === 'buildings' ? 'مباني وعقارات' : a.category === 'computers' ? 'أجهزة وحواسيب' : 'أثاث ومفروشات',
                    width: 20,
                  },
                  { header: 'تاريخ الشراء', key: 'purchaseDate', width: 14 },
                  { header: 'تكلفة الشراء (ج.م)', getValue: (a: FixedAsset) => a.purchasePrice.toFixed(2), width: 18 },
                  { header: 'مجمع الإهلاك (ج.م)', getValue: (a: FixedAsset) => a.accumulatedDepreciation.toFixed(2), width: 18 },
                  { header: 'صافي القيمة الدفترية (ج.م)', getValue: (a: FixedAsset) => a.netBookValue.toFixed(2), width: 22 },
                  { header: 'الموقع / الفرع', key: 'location', width: 18 },
                  { header: 'ملاحظات', key: 'notes', width: 25 },
                ],
                companyName: appData.settings?.companyName || 'المنظومة المحاسبية المعتمدة',
                reportTitle: 'سجل وحصر الأصول الثابتة ومجمعات الإهلاك',
              });
              showToast('تم تصدير سجل الأصول الثابتة إلى Excel بنجاح', 'success');
            }}
            printTitle="طباعة سجل وحصر الأصول الثابتة"
            exportTitle="تصدير سجل الأصول إلى Excel"
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-bold block">إجمالي تكلفة شراء الأصول</span>
            <strong className="text-xl font-black text-slate-900">{(totalAssetCost || 0).toLocaleString()} {currency}</strong>
          </div>
          <span className="p-3 bg-blue-50 text-blue-800 rounded-xl text-xl">🏛️</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-bold block">مجمع الإهلاك المتراكم</span>
            <strong className="text-xl font-black text-rose-700">-{(totalAccumulated || 0).toLocaleString()} {currency}</strong>
          </div>
          <span className="p-3 bg-rose-50 text-rose-800 rounded-xl text-xl">📉</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-bold block">صافي القيمة الدفترية الحالية (Book Value)</span>
            <strong className="text-xl font-black text-emerald-700">{(totalNetBookValue || 0).toLocaleString()} {currency}</strong>
          </div>
          <span className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xl">💎</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-4 text-xs font-bold">
        <button
          onClick={() => setActiveTab('assets')}
          className={`pb-2.5 px-2 border-b-2 transition cursor-pointer ${
            activeTab === 'assets' ? 'border-[#1a237e] text-[#1a237e]' : 'border-transparent text-slate-500'
          }`}
        >
          📋 سجل الأصول الثابتة ({assets.length})
        </button>
        <button
          onClick={() => setActiveTab('depreciation_logs')}
          className={`pb-2.5 px-2 border-b-2 transition cursor-pointer ${
            activeTab === 'depreciation_logs' ? 'border-[#1a237e] text-[#1a237e]' : 'border-transparent text-slate-500'
          }`}
        >
          📜 حركات وسجل الإهلاك الدوري ({logs.length})
        </button>
      </div>

      {/* TAB 1: ASSETS LIST */}
      {activeTab === 'assets' && (
        <div className="space-y-3">
          {/* Mobile Cards */}
          <div className="block md:hidden space-y-3">
            {assets.map((asset) => (
              <div
                key={asset.id}
                onClick={() => onInspectItem && onInspectItem('asset', asset)}
                className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3 active:bg-slate-50 transition cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                  <div>
                    <strong className="text-slate-900 text-sm block">{asset.name}</strong>
                    <span className="text-[11px] text-slate-500 font-medium block">
                      📍 {asset.location || 'المقر'} | تاريخ الشراء: {asset.purchaseDate}
                    </span>
                    <span className="text-xs font-mono font-bold text-blue-900 block mt-0.5">{asset.code}</span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                      asset.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {asset.status === 'active' ? 'يعمل بالخدمة' : 'مهلك بالكامل'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-mono">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-sans">تكلفة الشراء:</span>
                    <strong className="text-slate-800">{(asset.purchasePrice || 0).toLocaleString()} {currency}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-sans">معدل الإهلاك:</span>
                    <strong className="text-blue-700">{asset.annualDepreciationRate}% سنوي</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-sans">مجمع الإهلاك:</span>
                    <strong className="text-rose-600">-{(asset.accumulatedDepreciation || 0).toLocaleString()} {currency}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-sans">العمر الإنتاجي:</span>
                    <strong className="text-slate-700">{asset.usefulLifeYears} سنوات</strong>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-slate-200/50 flex justify-between items-center">
                    <span className="text-xs text-slate-600 font-sans">صافي القيمة الدفترية:</span>
                    <strong className="text-emerald-800 text-sm font-black">
                      {(asset.netBookValue || 0).toLocaleString()} {currency}
                    </strong>
                  </div>
                </div>

                <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => {
                      setEditingAssetId(asset.id);
                      setAssetName(asset.name);
                      setAssetCategory(asset.category);
                      setPurchaseDate(asset.purchaseDate);
                      setPurchasePrice(asset.purchasePrice);
                      setSalvageValue(asset.salvageValue);
                      setUsefulLifeYears(asset.usefulLifeYears);
                      setAssetLocation(asset.location || '');
                      setAssetNotes(asset.notes || '');
                      setIsAssetModalOpen(true);
                    }}
                    className="w-full min-h-[42px] bg-blue-50 hover:bg-blue-100 text-blue-800 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    ✏️ تعديل بيانات الأصل
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">كود الأصل</th>
                    <th className="p-3">اسم الأصل والتصنيف</th>
                    <th className="p-3 text-left">تكلفة الشراء</th>
                    <th className="p-3 text-center">العمر الإنتاجي</th>
                    <th className="p-3 text-left">مجمع الإهلاك</th>
                    <th className="p-3 text-left">القيمة الدفترية</th>
                    <th className="p-3 text-center">الحالة</th>
                    <th className="p-3 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assets.map((asset) => (
                    <tr
                      key={asset.id}
                      onClick={() => onInspectItem && onInspectItem('asset', asset)}
                      className="hover:bg-blue-50/40 cursor-pointer transition"
                    >
                      <td className="p-3 font-mono font-bold text-blue-900">{asset.code}</td>
                      <td className="p-3">
                        <div className="font-black text-slate-900">{asset.name}</div>
                        <span className="text-[10px] text-slate-500">
                          📍 {asset.location || 'المقر'} | تاريخ الشراء: {asset.purchaseDate}
                        </span>
                      </td>
                      <td className="p-3 text-left font-bold">{(asset.purchasePrice || 0).toLocaleString()} {currency}</td>
                      <td className="p-3 text-center font-semibold">
                        {asset.usefulLifeYears} سنوات ({asset.annualDepreciationRate}% سنوي)
                      </td>
                      <td className="p-3 text-left font-bold text-rose-600">
                        -{(asset.accumulatedDepreciation || 0).toLocaleString()} {currency}
                      </td>
                      <td className="p-3 text-left font-black text-emerald-800 text-sm">
                        {(asset.netBookValue || 0).toLocaleString()} {currency}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            asset.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {asset.status === 'active' ? 'يعمل بالخدمة' : 'مهلك بالكامل'}
                        </span>
                      </td>
                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setEditingAssetId(asset.id);
                            setAssetName(asset.name);
                            setAssetCategory(asset.category);
                            setPurchaseDate(asset.purchaseDate);
                            setPurchasePrice(asset.purchasePrice);
                            setSalvageValue(asset.salvageValue);
                            setUsefulLifeYears(asset.usefulLifeYears);
                            setAssetLocation(asset.location || '');
                            setAssetNotes(asset.notes || '');
                            setIsAssetModalOpen(true);
                          }}
                          className="text-blue-700 hover:text-blue-900 font-bold px-2 py-1 bg-blue-50 rounded-lg cursor-pointer"
                        >
                          ✏️ تعديل
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DEPRECIATION LOGS */}
      {activeTab === 'depreciation_logs' && (
        <div className="space-y-3">
          {/* Mobile Cards */}
          <div className="block md:hidden space-y-3">
            {logs.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-sm">
                لم يتم تسجيل عمليات إهلاك دورية بعد. اضغط على زر "احتساب وإثبات الإهلاك الدوري" لتشغيل الدورة.
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div>
                      <strong className="text-slate-900 text-sm block">{log.assetName}</strong>
                      <span className="text-xs text-blue-900 font-bold">الفترة: {log.period}</span>
                    </div>
                    <span className="text-xs font-mono text-slate-500">{log.date}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-mono">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">قسط الإهلاك:</span>
                      <strong className="text-rose-700 font-black">-{(log.amount || 0).toLocaleString()} {currency}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">مجمع الإهلاك الجديد:</span>
                      <strong className="text-slate-800">{(log.accumulatedAfter || 0).toLocaleString()} {currency}</strong>
                    </div>
                    <div className="col-span-2 pt-1 border-t border-slate-200/50 flex justify-between items-center">
                      <span className="text-xs text-slate-600 font-sans">القيمة الدفترية الجديدة:</span>
                      <strong className="text-emerald-700 text-sm font-black">
                        {(log.bookValueAfter || 0).toLocaleString()} {currency}
                      </strong>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500 text-left">
                    المسؤول: <span className="font-semibold text-slate-700">{log.createdBy}</span>
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
                  <th className="p-3">تاريخ الإهلاك</th>
                  <th className="p-3">الفترة المالية</th>
                  <th className="p-3">اسم الأصل</th>
                  <th className="p-3 text-left">قسط الإهلاك المحتسب</th>
                  <th className="p-3 text-left">مجمع الإهلاك بعد القيد</th>
                  <th className="p-3 text-left">القيمة الدفترية الجديدة</th>
                  <th className="p-3 text-center">المسؤول</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center p-8 text-slate-400">
                      لم يتم تسجيل عمليات إهلاك دورية بعد. اضغط على زر "احتساب وإثبات الإهلاك الدوري" لتشغيل الدورة.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono text-slate-500">{log.date}</td>
                      <td className="p-3 font-bold text-blue-900">{log.period}</td>
                      <td className="p-3 font-bold text-slate-800">{log.assetName}</td>
                      <td className="p-3 text-left font-black text-rose-700">-{(log.amount || 0).toLocaleString()} {currency}</td>
                      <td className="p-3 text-left font-bold">{(log.accumulatedAfter || 0).toLocaleString()} {currency}</td>
                      <td className="p-3 text-left font-black text-emerald-700">{(log.bookValueAfter || 0).toLocaleString()} {currency}</td>
                      <td className="p-3 text-center text-slate-500">{log.createdBy}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Asset Form Modal */}
      {isAssetModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl p-6 space-y-4 border border-slate-200">
            <h3 className="font-black text-lg text-[#1a237e]">
              {editingAssetId ? 'تعديل بيانات الأصل الثابت' : 'تسجيل أصل ثابت جديد'}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="md:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">اسم الأصل الثابت *</label>
                <input
                  type="text"
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl"
                  placeholder="مثال: سيارة نقل، أجهزة كمبيوتر، أثاث صالة العرض"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">تصنيف الأصل</label>
                <select
                  value={assetCategory}
                  onChange={(e) => setAssetCategory(e.target.value as any)}
                  className="w-full p-2 border border-slate-300 rounded-xl bg-white"
                >
                  <option value="vehicles">سيارات ومركبات</option>
                  <option value="computers">أجهزة كمبيوتر وتكنولوجيا</option>
                  <option value="equipment">معدات وآلات تشغيل</option>
                  <option value="furniture">أثاث وتجهيزات مكتبية</option>
                  <option value="buildings">عقارات ومباني</option>
                  <option value="other">أصول أخرى</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">تاريخ الشراء</label>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">تكلفة الشراء الأصلية ({currency}) *</label>
                <input
                  type="number"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(Number(e.target.value))}
                  className="w-full p-2 border border-slate-300 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">القيمة التخريدية المتوقعة ({currency})</label>
                <input
                  type="number"
                  value={salvageValue}
                  onChange={(e) => setSalvageValue(Number(e.target.value))}
                  className="w-full p-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">العمر الإنتاجي (بالسنوات) *</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={usefulLifeYears}
                  onChange={(e) => setUsefulLifeYears(Number(e.target.value))}
                  className="w-full p-2 border border-slate-300 rounded-xl font-bold"
                />
                <span className="text-[10px] text-slate-500 block mt-1">
                  نسبة الإهلاك السنوي: {(usefulLifeYears > 0 ? (100 / usefulLifeYears).toFixed(1) : 0)}%
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">الموقع / الفرع</label>
                <input
                  type="text"
                  value={assetLocation}
                  onChange={(e) => setAssetLocation(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl"
                  placeholder="المقر، المعرض، المخزن"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">بيان وملاحظات</label>
                <input
                  type="text"
                  value={assetNotes}
                  onChange={(e) => setAssetNotes(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl"
                  placeholder="رقم الشاسيه، الرقم التسلسلي، حالة الأصل..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsAssetModalOpen(false)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveAsset}
                className="bg-[#1a237e] hover:bg-[#0d47a1] text-white px-5 py-2 rounded-xl text-xs font-bold cursor-pointer shadow-xs"
              >
                💾 حفظ الأصل الثابت
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
