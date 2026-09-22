import React, { useState } from 'react';
import { AppData, SerialItemRecord } from '../types';
import { addAuditLog } from '../utils/storage';
import { openUnifiedPrintWindow } from '../utils/printUnified';
import { exportToExcel } from '../utils/excelExport';

interface SerialWarrantyTrackingViewProps {
  appData: AppData;
  onUpdateData: (newData: AppData) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export const SerialWarrantyTrackingView: React.FC<SerialWarrantyTrackingViewProps> = ({
  appData,
  onUpdateData,
  showToast,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCheckModalOpen, setIsCheckModalOpen] = useState(false);
  const [checkQuery, setCheckQuery] = useState('');
  const [checkedResult, setCheckedResult] = useState<SerialItemRecord | null | undefined>(undefined);

  // Form state
  const [serialNumber, setSerialNumber] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [warrantyMonths, setWarrantyMonths] = useState('12');
  const [notes, setNotes] = useState('');

  // Initial Seed if empty
  const records: SerialItemRecord[] = appData.serialRecords && appData.serialRecords.length > 0
    ? appData.serialRecords
    : [
        {
          id: 'ser-001',
          serialNumber: 'DELL-OPT-9020-SN98214',
          itemId: appData.items[0]?.id || 'itm-1',
          itemName: appData.items[0]?.name || 'جهاز كمبيوتر ديل Dell Core i7',
          customerName: 'شركة النور للاستيراد',
          customerPhone: '01012345678',
          invoiceNumber: 'INV-1001',
          saleDate: '2026-03-10',
          warrantyMonths: 12,
          warrantyExpiryDate: '2027-03-10',
          status: 'in_warranty',
          notes: 'شامل استبدال قطع الغيار مع الصيانة الدورية المجانية',
          createdAt: '2026-03-10 10:00',
          createdBy: 'المدير',
        },
        {
          id: 'ser-002',
          serialNumber: 'HP-LSR-M404-SN55120',
          itemId: appData.items[1]?.id || 'itm-2',
          itemName: 'طابعة ليزر HP LaserJet Pro',
          customerName: 'مكتب الأهرام للمحاماة',
          customerPhone: '01198765432',
          invoiceNumber: 'INV-1002',
          saleDate: '2025-05-15',
          warrantyMonths: 12,
          warrantyExpiryDate: '2026-05-15',
          status: 'warranty_expired',
          notes: 'تمت الصيانة لمرة واحدة في يناير 2026',
          createdAt: '2025-05-15 11:30',
          createdBy: 'كاشير 1',
        },
        {
          id: 'ser-003',
          serialNumber: 'SAMS-MNT-27-SN10928',
          itemId: 'itm-3',
          itemName: 'شاشة سامسونج 27 بوصة IPS 144Hz',
          customerName: 'محمد نزيه (كاش)',
          customerPhone: '01029190615',
          invoiceNumber: 'INV-1005',
          saleDate: '2026-08-01',
          warrantyMonths: 24,
          warrantyExpiryDate: '2028-08-01',
          status: 'in_warranty',
          notes: 'ضمان الوكيل الرسمي المعتمد',
          createdAt: '2026-08-01 14:20',
          createdBy: 'المدير',
        },
      ];

  const filteredRecords = records.filter((rec) => {
    const matchesSearch =
      rec.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rec.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (rec.customerName && rec.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (rec.invoiceNumber && rec.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || rec.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalCount = records.length;
  const inWarrantyCount = records.filter((r) => r.status === 'in_warranty').length;
  const expiredCount = records.filter((r) => r.status === 'warranty_expired').length;
  const maintenanceCount = records.filter((r) => r.status === 'maintenance').length;

  const handleSaveRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serialNumber.trim() || !selectedItemId) {
      showToast('يرجى كتابة الرقم التسلسلي واختيار الصنف', 'warning');
      return;
    }

    const item = appData.items.find((i) => i.id === selectedItemId);
    const months = parseInt(warrantyMonths, 10) || 12;
    const now = new Date();
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + months);

    const newRecord: SerialItemRecord = {
      id: `ser-${Date.now()}`,
      serialNumber: serialNumber.trim().toUpperCase(),
      itemId: selectedItemId,
      itemName: item?.name || 'صنف غير معروف',
      itemCode: item?.code,
      customerName: customerName.trim() || 'عميل نقدي',
      customerPhone: customerPhone.trim() || undefined,
      invoiceNumber: invoiceNumber.trim() || undefined,
      saleDate: now.toISOString().split('T')[0],
      warrantyMonths: months,
      warrantyExpiryDate: expiry.toISOString().split('T')[0],
      status: 'in_warranty',
      notes: notes.trim() || undefined,
      createdAt: new Date().toLocaleString('ar-EG'),
      createdBy: 'المدير',
    };

    const updatedRecords = [newRecord, ...(appData.serialRecords || records)];
    let updatedData: AppData = {
      ...appData,
      serialRecords: updatedRecords,
    };

    updatedData = addAuditLog(
      updatedData,
      'create',
      'الضمان والسيريالات',
      `تم تسجيل سيريال جديد ${newRecord.serialNumber} للصنف ${newRecord.itemName}`
    );

    onUpdateData(updatedData);
    showToast('تم تسجيل كارت السيريال وشهادة الضمان بنجاح', 'success');

    // Reset Form
    setSerialNumber('');
    setSelectedItemId('');
    setCustomerName('');
    setCustomerPhone('');
    setInvoiceNumber('');
    setNotes('');
    setIsAddModalOpen(false);
  };

  const handleCheckSerial = (e: React.FormEvent) => {
    e.preventDefault();
    const q = checkQuery.trim().toLowerCase();
    if (!q) return;

    const found = records.find(
      (r) => r.serialNumber.toLowerCase() === q || r.serialNumber.toLowerCase().includes(q)
    );
    setCheckedResult(found || null);
  };

  const handlePrintWarrantyCert = (rec: SerialItemRecord) => {
    openUnifiedPrintWindow({
      reportTitle: 'شهادة ضمان معتمدة للأجهزة والمعدات',
      subTitle: `رقم السيريال: ${rec.serialNumber} | كود الصنف: ${rec.itemCode || 'N/A'}`,
      date: rec.saleDate || new Date().toISOString().split('T')[0],
      company: {
        name: appData.settings.companyName || 'منظومة ركيزة للحلول التقنية',
        address: appData.settings.address || 'جمهورية مصر العربية',
        phones: [appData.settings.phone1 || appData.settings.phone2 || '01029190615'],
      },
      infoExtra: [
        { label: 'اسم العميل المعتمد', value: rec.customerName || 'عميل نقدي' },
        { label: 'رقم هاتف العميل', value: rec.customerPhone || 'غير مسجل' },
        { label: 'رقم الفاتورة المرجعية', value: rec.invoiceNumber || 'فاتورة مباشرة' },
        { label: 'مدة الضمان المعتمدة', value: `${rec.warrantyMonths} شهراً` },
        { label: 'تاريخ انتهاء الضمان', value: rec.warrantyExpiryDate },
        { label: 'حالة الضمان الحالية', value: rec.status === 'in_warranty' ? 'ساري ومعتمد ✅' : 'منتهي الصلاحية ❌' },
      ],
      columns: ['البند / الصنف المضمون', 'الرقم التسلسلي (Serial No)', 'شروط الضمان وسياسة الاستبدال'],
      rows: [
        [
          rec.itemName,
          rec.serialNumber,
          rec.notes || 'الضمان يغطي عيوب الصناعة وقطع الغيار الأصلية ولا يغطي سوء الاستخدام أو الكسر أو الحروق الكهربائية.',
        ],
      ],
      signatures: ['توقيع واستلام العميل', 'ختم قسم الصيانة والضمان', 'إدارة المبيعات'],
    });
  };

  const handleExportExcel = () => {
    const rows = filteredRecords.map((r, idx) => ({
      'م': idx + 1,
      'الرقم التسلسلي': r.serialNumber,
      'اسم الصنف': r.itemName,
      'اسم العميل': r.customerName || '',
      'هاتف العميل': r.customerPhone || '',
      'رقم الفاتورة': r.invoiceNumber || '',
      'تاريخ البيع': r.saleDate || '',
      'مدة الضمان (شهور)': r.warrantyMonths,
      'تاريخ انتهاء الضمان': r.warrantyExpiryDate,
      'الحالة': r.status === 'in_warranty' ? 'ساري' : 'منتهي',
      'ملاحظات': r.notes || '',
    }));
    exportToExcel({
      filename: 'سجل_السيريالات_والضمانات_ركيزة',
      sheetName: 'الأرقام التسلسلية والضمانات',
      data: rows,
      columns: [
        { header: 'م', key: 'م', width: 6 },
        { header: 'الرقم التسلسلي', key: 'الرقم التسلسلي', width: 18 },
        { header: 'اسم الصنف', key: 'اسم الصنف', width: 22 },
        { header: 'اسم العميل', key: 'اسم العميل', width: 20 },
        { header: 'هاتف العميل', key: 'هاتف العميل', width: 16 },
        { header: 'رقم الفاتورة', key: 'رقم الفاتورة', width: 14 },
        { header: 'تاريخ البيع', key: 'تاريخ البيع', width: 14 },
        { header: 'مدة الضمان (شهور)', key: 'مدة الضمان (شهور)', width: 16, isNumeric: true },
        { header: 'تاريخ انتهاء الضمان', key: 'تاريخ انتهاء الضمان', width: 16 },
        { header: 'الحالة', key: 'الحالة', width: 12 },
        { header: 'ملاحظات', key: 'ملاحظات', width: 25 },
      ],
      reportTitle: 'سجل الأرقام التسلسلية وشهادات الضمان للمنتجات المباعة',
    });
    showToast('تم تصدير سجل السيريالات بنجاح إلى Excel', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-[#0d47a1] via-[#1565c0] to-[#1a237e] text-white p-5 rounded-2xl shadow-md flex flex-wrap justify-between items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔍</span>
            <h3 className="font-black text-lg md:text-xl text-[#ffd54f]">
              إدارة وتتبع الأرقام التسلسلية والضمان (Serial Numbers & Warranty Tracking)
            </h3>
          </div>
          <p className="text-xs text-blue-100 mt-1 opacity-90">
            تتبع أجهزة الكمبيوتر والمعدات بالسيريال، فحص سريان فترات الضمان، وطباعة شهادات الضمان المعتمدة للعملاء
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setIsCheckModalOpen(true);
              setCheckQuery('');
              setCheckedResult(undefined);
            }}
            className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 font-black rounded-xl text-xs transition shadow-sm cursor-pointer flex items-center gap-1.5"
          >
            <span>⚡</span> فحص سيريال فوري
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs transition shadow-sm cursor-pointer flex items-center gap-1.5"
          >
            <span>➕</span> تسجيل سيريال جديد
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200">
          <div className="text-xs text-slate-500 font-bold">إجمالي الأجهزة بالسيريال</div>
          <div className="text-xl font-black text-slate-800 mt-1 font-mono">{totalCount}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-emerald-200 bg-emerald-50/30">
          <div className="text-xs text-emerald-700 font-bold">أجهزة داخل الضمان الساري</div>
          <div className="text-xl font-black text-emerald-600 mt-1 font-mono">{inWarrantyCount}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-rose-200 bg-rose-50/30">
          <div className="text-xs text-rose-700 font-bold">أجهزة منتهية الضمان</div>
          <div className="text-xl font-black text-rose-600 mt-1 font-mono">{expiredCount}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-amber-200 bg-amber-50/30">
          <div className="text-xs text-amber-700 font-bold">أجهزة قيد الصيانة</div>
          <div className="text-xl font-black text-amber-600 mt-1 font-mono">{maintenanceCount}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 flex flex-wrap justify-between items-center gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              statusFilter === 'all' ? 'bg-[#1a237e] text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            الكل ({records.length})
          </button>
          <button
            onClick={() => setStatusFilter('in_warranty')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              statusFilter === 'in_warranty' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            ساري الضمان ({inWarrantyCount})
          </button>
          <button
            onClick={() => setStatusFilter('warranty_expired')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              statusFilter === 'warranty_expired' ? 'bg-rose-600 text-white shadow-xs' : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
            }`}
          >
            منتهي الضمان ({expiredCount})
          </button>
          <button
            onClick={handleExportExcel}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1"
          >
            <span>📊</span> تصدير Excel
          </button>
        </div>

        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="🔍 بحث برقم السيريال، الصنف، العميل..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full min-h-[38px] px-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:border-[#1a237e] focus:outline-none"
          />
        </div>
      </div>

      {/* Table of Serials */}
      <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200 overflow-x-auto">
        <table className="w-full text-right text-xs md:text-sm border-collapse">
          <thead>
            <tr className="bg-[#1a237e] text-white">
              <th className="p-3 rounded-r-xl">الرقم التسلسلي (Serial No)</th>
              <th className="p-3">اسم الصنف والجهاز</th>
              <th className="p-3">العميل</th>
              <th className="p-3">تاريخ البيع</th>
              <th className="p-3">مدة الضمان</th>
              <th className="p-3">تاريخ الانتهاء</th>
              <th className="p-3">حالة الضمان</th>
              <th className="p-3 rounded-l-xl text-center">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-slate-400">
                  لا توجد أجهزة مسجلة تطابق معايير البحث
                </td>
              </tr>
            ) : (
              filteredRecords.map((rec) => (
                <tr key={rec.id} className="hover:bg-slate-50 transition">
                  <td className="p-3 font-mono font-bold text-indigo-900">{rec.serialNumber}</td>
                  <td className="p-3 font-bold text-slate-800">{rec.itemName}</td>
                  <td className="p-3">
                    <div className="font-semibold text-slate-700">{rec.customerName || 'عميل نقدي'}</div>
                    {rec.customerPhone && <div className="text-[11px] text-slate-400 font-mono">{rec.customerPhone}</div>}
                  </td>
                  <td className="p-3 font-mono text-slate-600">{rec.saleDate || '-'}</td>
                  <td className="p-3 font-bold text-slate-700">{rec.warrantyMonths} شهر</td>
                  <td className="p-3 font-mono text-slate-600">{rec.warrantyExpiryDate}</td>
                  <td className="p-3">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                        rec.status === 'in_warranty'
                          ? 'bg-emerald-100 text-emerald-800'
                          : rec.status === 'warranty_expired'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {rec.status === 'in_warranty'
                        ? '✅ ساري الضمان'
                        : rec.status === 'warranty_expired'
                        ? '❌ منتهي'
                        : '⚙️ صيانة'}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => handlePrintWarrantyCert(rec)}
                      className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-xs transition cursor-pointer"
                    >
                      🖨️ شهادة الضمان
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Check Serial Fast */}
      {isCheckModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-base text-slate-800 flex items-center gap-2">
                <span>⚡</span> فحص واستعلام فوري عن سيريال وضمان جهاز
              </h3>
              <button
                onClick={() => setIsCheckModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCheckSerial} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  أدخل أو امسح الباركود / الرقم التسلسلي (Serial Number):
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="مثال: DELL-OPT-9020-SN98214"
                    value={checkQuery}
                    onChange={(e) => setCheckQuery(e.target.value)}
                    className="flex-1 min-h-[42px] px-3.5 border-2 border-indigo-200 rounded-xl text-sm font-mono focus:border-indigo-600 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-5 bg-[#1a237e] hover:bg-[#0d47a1] text-white font-bold rounded-xl text-xs transition"
                  >
                    فحص
                  </button>
                </div>
              </div>
            </form>

            {checkedResult !== undefined && (
              <div className="mt-4">
                {checkedResult === null ? (
                  <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl text-center text-rose-800 text-xs font-bold">
                    ⚠️ لم يتم العثور على هذا الرقم التسلسلي في قاعدة بيانات المنشأة! الجهاز غير مسجل أو خارج الضمان.
                  </div>
                ) : (
                  <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                      <span className="font-bold text-emerald-900 text-sm">✅ تم التحقق من الجهاز بنجاح</span>
                      <span className="font-mono font-bold text-xs bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded">
                        {checkedResult.serialNumber}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-emerald-950 pt-1">
                      <div>
                        <span className="font-bold">الصنف:</span> {checkedResult.itemName}
                      </div>
                      <div>
                        <span className="font-bold">العميل:</span> {checkedResult.customerName || 'عميل نقدي'}
                      </div>
                      <div>
                        <span className="font-bold">تاريخ البيع:</span> {checkedResult.saleDate}
                      </div>
                      <div>
                        <span className="font-bold">نهاية الضمان:</span> {checkedResult.warrantyExpiryDate}
                      </div>
                      <div className="col-span-2 mt-1">
                        <span className="font-bold">حالة الضمان:</span>{' '}
                        {checkedResult.status === 'in_warranty' ? (
                          <span className="text-emerald-700 font-black">ساري المفعول (مغطى بالضمان)</span>
                        ) : (
                          <span className="text-rose-700 font-black">منتهي الصلاحية</span>
                        )}
                      </div>
                    </div>
                    <div className="pt-2 text-left">
                      <button
                        onClick={() => handlePrintWarrantyCert(checkedResult)}
                        className="px-3 py-1.5 bg-[#1a237e] text-white text-xs font-bold rounded-lg"
                      >
                        🖨️ طباعة شهادة الضمان
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Add New Serial */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-base text-slate-800 flex items-center gap-2">
                <span>➕</span> تسجيل كارت سيريال وضمان جهاز جديد
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRecord} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  الرقم التسلسلي للجهاز (Serial Number) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="أدخل السيريال أو امسحه بالباركود..."
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  className="w-full min-h-[40px] px-3 border border-slate-200 rounded-xl text-xs font-mono focus:border-indigo-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الصنف / الجهاز *</label>
                <select
                  required
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full min-h-[40px] px-3 border border-slate-200 rounded-xl text-xs focus:border-indigo-600 focus:outline-none bg-white"
                >
                  <option value="">-- اختر الصنف من قائمة المخزون --</option>
                  {appData.items.map((itm) => (
                    <option key={itm.id} value={itm.id}>
                      {itm.name} ({itm.code || 'بدون كود'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم العميل</label>
                  <input
                    type="text"
                    placeholder="اسم المشتري..."
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full min-h-[40px] px-3 border border-slate-200 rounded-xl text-xs focus:border-indigo-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">هاتف العميل</label>
                  <input
                    type="text"
                    placeholder="010..."
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full min-h-[40px] px-3 border border-slate-200 rounded-xl text-xs font-mono focus:border-indigo-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم الفاتورة المرجعية</label>
                  <input
                    type="text"
                    placeholder="مثال: INV-1001"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full min-h-[40px] px-3 border border-slate-200 rounded-xl text-xs focus:border-indigo-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">مدة الضمان (شهور)</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={warrantyMonths}
                    onChange={(e) => setWarrantyMonths(e.target.value)}
                    className="w-full min-h-[40px] px-3 border border-slate-200 rounded-xl text-xs focus:border-indigo-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">شروط وملاحظات الضمان</label>
                <textarea
                  rows={2}
                  placeholder="ملاحظات الصيانة والقطع المشمولة..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:border-indigo-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1a237e] hover:bg-[#0d47a1] text-white font-bold rounded-xl text-xs transition shadow-sm"
                >
                  حفظ وتأكيد السيريال
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
