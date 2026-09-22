import React, { useState } from 'react';
import { AppData, CrmLead, LeadStage, Customer } from '../types';
import { addAuditLog } from '../utils/storage';
import { openWhatsAppChat, cleanPhoneNumber } from '../services/whatsappService';
import { exportToExcel } from '../utils/excelExport';

interface CrmPipelineViewProps {
  appData: AppData;
  onUpdateData: (newData: AppData) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onNavigateToSales?: () => void;
}

const STAGES: { key: LeadStage; label: string; color: string; bg: string }[] = [
  { key: 'new', label: 'عميل محتمل جديد', color: 'text-sky-700', bg: 'bg-sky-50 border-sky-200' },
  { key: 'contacted', label: 'تم التواصل والتأهيل', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
  { key: 'quotation_sent', label: 'تم إرسال عرض سعر', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  { key: 'negotiation', label: 'مفاوضات ومتابعة', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  { key: 'won', label: 'صفقة رابحة (تعاقد)', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  { key: 'lost', label: 'غير مهتم / ملغاة', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
];

export const CrmPipelineView: React.FC<CrmPipelineViewProps> = ({
  appData,
  onUpdateData,
  showToast,
  onNavigateToSales,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form state
  const [clientName, setClientName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [expectedValue, setExpectedValue] = useState('');
  const [source, setSource] = useState('إعلانات السوشيال ميديا');
  const [salesRep, setSalesRep] = useState(appData.salesReps[0]?.name || 'مندوب عام');
  const [nextFollowupDate, setNextFollowupDate] = useState('');
  const [notes, setNotes] = useState('');

  // Initial Seed
  const leads: CrmLead[] = appData.crmLeads && appData.crmLeads.length > 0
    ? appData.crmLeads
    : [
        {
          id: 'lead-01',
          clientName: 'م. أحمد الشناوي',
          companyName: 'مجموعة الدلتا للتجارة والتوزيع',
          phone: '01099887766',
          expectedValue: 45000,
          currency: 'EGP',
          stage: 'quotation_sent',
          source: 'معرض القاهرة الدولي',
          salesRep: 'محمد علي',
          nextFollowupDate: '2026-09-20',
          notes: 'مهتم بطلب 5 أجهزة حاسوب ديل وطابعات ليزر للفرع الجديد',
          createdAt: '2026-09-12',
          updatedAt: '2026-09-15',
          createdBy: 'المدير',
        },
        {
          id: 'lead-02',
          clientName: 'أ. سارة الجمل',
          companyName: 'عيادات الصفوة الطبية',
          phone: '01234567890',
          expectedValue: 28000,
          currency: 'EGP',
          stage: 'negotiation',
          source: 'إعلانات السوشيال ميديا',
          salesRep: 'كريم محمود',
          nextFollowupDate: '2026-09-18',
          notes: 'طلبت خصم 5% على عروض الأسعار المقدمة وموعد التوريد خلال أسبوع',
          createdAt: '2026-09-10',
          updatedAt: '2026-09-16',
          createdBy: 'المدير',
        },
        {
          id: 'lead-03',
          clientName: 'د. خالد توفيق',
          companyName: 'مختبرات الأمل',
          phone: '01122334455',
          expectedValue: 85000,
          currency: 'EGP',
          stage: 'won',
          source: 'ترشيح من عميل حالي',
          salesRep: 'محمد علي',
          notes: 'تم توقيع العقد وجاري إصدار الفاتورة والتوريد الفوري',
          createdAt: '2026-09-01',
          updatedAt: '2026-09-14',
          createdBy: 'المدير',
        },
      ];

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      lead.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.companyName && lead.companyName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      lead.phone.includes(searchTerm) ||
      (lead.salesRep && lead.salesRep.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStage = stageFilter === 'all' || lead.stage === stageFilter;
    return matchesSearch && matchesStage;
  });

  const totalValue = leads.reduce((sum, l) => sum + (l.expectedValue || 0), 0);
  const wonValue = leads.filter((l) => l.stage === 'won').reduce((sum, l) => sum + (l.expectedValue || 0), 0);
  const wonCount = leads.filter((l) => l.stage === 'won').length;
  const winRate = leads.length > 0 ? Math.round((wonCount / leads.length) * 100) : 0;

  const handleStageChange = (leadId: string, newStage: LeadStage) => {
    const updated = leads.map((l) => (l.id === leadId ? { ...l, stage: newStage, updatedAt: new Date().toISOString() } : l));
    const targetLead = leads.find((l) => l.id === leadId);

    let updatedData: AppData = {
      ...appData,
      crmLeads: updated,
    };

    updatedData = addAuditLog(
      updatedData,
      'update',
      'إدارة علاقات العملاء CRM',
      `تم تحديث مرحلة العميل ${targetLead?.clientName} إلى ${newStage}`
    );

    onUpdateData(updatedData);
    showToast('تم تحديث مرحلة الصفقة بنجاح', 'success');
  };

  const handleCreateLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !phone.trim()) {
      showToast('يرجى كتابة اسم العميل ورقم الهاتف', 'warning');
      return;
    }

    const newLead: CrmLead = {
      id: `lead-${Date.now()}`,
      clientName: clientName.trim(),
      companyName: companyName.trim() || undefined,
      phone: phone.trim(),
      expectedValue: parseFloat(expectedValue) || 0,
      currency: 'EGP',
      stage: 'new',
      source,
      salesRep,
      nextFollowupDate: nextFollowupDate || undefined,
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
      createdBy: 'المدير',
    };

    const updated = [newLead, ...(appData.crmLeads || leads)];
    let updatedData: AppData = {
      ...appData,
      crmLeads: updated,
    };

    updatedData = addAuditLog(
      updatedData,
      'create',
      'إدارة علاقات العملاء CRM',
      `تم تسجيل فرصة بيعية جديدة للعميل ${newLead.clientName}`
    );

    onUpdateData(updatedData);
    showToast('تمت إضافة الفرصة البيعية بنجاح إلى البايب لاين', 'success');

    // Reset
    setClientName('');
    setCompanyName('');
    setPhone('');
    setExpectedValue('');
    setNotes('');
    setIsAddModalOpen(false);
  };

  // 1-Click WhatsApp Chat with formatted message
  const handleOpenWhatsApp = (lead: CrmLead) => {
    const comp = appData.settings.companyName || 'منظومة ركيزة';
    const msg = `السلام عليكم ورحمة الله وبركاته،
أهلاً بحضرتك أستاذ/ة *${lead.clientName}* المحترم 🌸

يسعدنا في *${comp}* التواصل مع سيادتكم لمتابعة استفساركم وتلبية كافة متطلباتكم بأفضل جودة وأسعار تنافسية.

هل يناسبكم التحدث الآن أو تحديد موعد مناسب لمناقشة التفاصيل؟
سعداء دائماً بخدمتكم.
*${comp}*`;

    openWhatsAppChat(lead.phone, msg);
  };

  // Convert Lead to Permanent Customer
  const handleConvertToCustomer = (lead: CrmLead) => {
    const existing = appData.customers.find((c) => c.phone === lead.phone || c.name.trim() === lead.clientName.trim());
    if (existing) {
      showToast('هذا العميل مسجل بالفعل في دليل العملاء الدائمين', 'info');
      return;
    }

    const newCustomer: Customer = {
      id: `cust-${Date.now()}`,
      name: lead.companyName ? `${lead.clientName} (${lead.companyName})` : lead.clientName,
      phone: lead.phone,
      address: lead.companyName || 'القاهرة',
      balance: 0,
      creditLimit: 50000,
      priceTier: 'retail',
    };

    let updatedData: AppData = {
      ...appData,
      customers: [...appData.customers, newCustomer],
    };

    updatedData = addAuditLog(
      updatedData,
      'create',
      'العملاء',
      `تم تحويل العميل المحتمل ${lead.clientName} إلى عميل دائم بالمنظومة`
    );

    onUpdateData(updatedData);
    showToast(`تم تحويل ${lead.clientName} إلى عميل دائم بنجاح`, 'success');
  };

  const handleExportExcel = () => {
    const rows = filteredLeads.map((l, idx) => ({
      'م': idx + 1,
      'اسم العميل': l.clientName,
      'الشركة': l.companyName || '',
      'رقم الهاتف': l.phone,
      'القيمة المتوقعة (ج.م)': l.expectedValue,
      'المرحلة': STAGES.find((s) => s.key === l.stage)?.label || l.stage,
      'المصدر': l.source || '',
      'المندوب': l.salesRep || '',
      'المتابعة القادمة': l.nextFollowupDate || '',
      'ملاحظات': l.notes || '',
    }));
    exportToExcel({
      filename: 'سجل_فرص_المبيعات_CRM_ركيزة',
      sheetName: 'الفرص البيعية',
      data: rows,
      columns: [
        { header: 'م', key: 'م', width: 6 },
        { header: 'اسم العميل', key: 'اسم العميل', width: 22 },
        { header: 'الشركة', key: 'الشركة', width: 20 },
        { header: 'رقم الهاتف', key: 'رقم الهاتف', width: 16 },
        { header: 'القيمة المتوقعة (ج.م)', key: 'القيمة المتوقعة (ج.م)', width: 18, isNumeric: true },
        { header: 'المرحلة', key: 'المرحلة', width: 16 },
        { header: 'المصدر', key: 'المصدر', width: 16 },
        { header: 'المندوب', key: 'المندوب', width: 18 },
        { header: 'المتابعة القادمة', key: 'المتابعة القادمة', width: 15 },
        { header: 'ملاحظات', key: 'ملاحظات', width: 25 },
      ],
      reportTitle: 'سجل إدارة الفرص والمبيعات والعملاء المحتملين (CRM)',
    });
    showToast('تم تصدير سجل الفرص البيعية بنجاح إلى Excel', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-[#1a237e] via-[#0d47a1] to-[#1565c0] text-white p-5 rounded-2xl shadow-md flex flex-wrap justify-between items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎯</span>
            <h3 className="font-black text-lg md:text-xl text-[#ffd54f]">
              إدارة علاقات العملاء وفرص المبيعات (Mini-CRM & Sales Pipeline)
            </h3>
          </div>
          <p className="text-xs text-blue-100 mt-1 opacity-90">
            متابعة الصفقات والعملاء المحتملين، وتتبع مراحل الإغلاق، والمحادثة الفورية عبر واتساب، والتحويل المباشر إلى فواتير
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs transition shadow-sm cursor-pointer flex items-center gap-1.5"
          >
            <span>➕</span> إضافة فرصة بيع جديدة
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200">
          <div className="text-xs text-slate-500 font-bold">إجمالي الفرص بالبايب لاين</div>
          <div className="text-xl font-black text-slate-800 mt-1 font-mono">{leads.length} فرصة</div>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-indigo-200 bg-indigo-50/20">
          <div className="text-xs text-indigo-700 font-bold">القيمة التقديرية للصفقات</div>
          <div className="text-xl font-black text-indigo-900 mt-1 font-mono">
            {totalValue.toLocaleString()} ج.م
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-emerald-200 bg-emerald-50/30">
          <div className="text-xs text-emerald-700 font-bold">الصفقات المغلقة بنجاح (Won)</div>
          <div className="text-xl font-black text-emerald-700 mt-1 font-mono">
            {wonValue.toLocaleString()} ج.م ({wonCount})
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-amber-200 bg-amber-50/30">
          <div className="text-xs text-amber-700 font-bold">معدل الإغلاق والنجاح (Win Rate)</div>
          <div className="text-xl font-black text-amber-800 mt-1 font-mono">{winRate}%</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 flex flex-wrap justify-between items-center gap-3">
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setStageFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              stageFilter === 'all' ? 'bg-[#1a237e] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            الكل ({leads.length})
          </button>
          {STAGES.map((stg) => {
            const count = leads.filter((l) => l.stage === stg.key).length;
            return (
              <button
                key={stg.key}
                onClick={() => setStageFilter(stg.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  stageFilter === stg.key ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {stg.label} ({count})
              </button>
            );
          })}
          <button
            onClick={handleExportExcel}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 mr-2"
          >
            <span>📊</span> Excel
          </button>
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            placeholder="🔍 بحث باسم العميل، الهاتف، المندوب..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full min-h-[38px] px-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:border-[#1a237e] focus:outline-none"
          />
        </div>
      </div>

      {/* Pipeline Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredLeads.length === 0 ? (
          <div className="col-span-full bg-white rounded-2xl p-10 text-center text-slate-400">
            لا توجد فرص بيعية مطابقة لمعايير البحث الحالية
          </div>
        ) : (
          filteredLeads.map((lead) => {
            const currentStage = STAGES.find((s) => s.key === lead.stage) || STAGES[0];
            return (
              <div
                key={lead.id}
                className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200 space-y-3 hover:border-indigo-300 transition"
              >
                {/* Header */}
                <div className="flex justify-between items-start gap-2 border-b border-slate-100 pb-2.5">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{lead.clientName}</h4>
                    {lead.companyName && (
                      <div className="text-xs text-slate-500 font-semibold mt-0.5">🏢 {lead.companyName}</div>
                    )}
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${currentStage.bg} ${currentStage.color}`}>
                    {currentStage.label}
                  </span>
                </div>

                {/* Info & Metrics */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 p-2 rounded-xl">
                    <span className="text-slate-400 block text-[10px]">القيمة المتوقعة</span>
                    <span className="font-black text-[#1a237e] text-sm font-mono">
                      {(lead.expectedValue || 0).toLocaleString()} ج.م
                    </span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-xl">
                    <span className="text-slate-400 block text-[10px]">المندوب المسؤول</span>
                    <span className="font-bold text-slate-700 text-xs truncate block">
                      👔 {lead.salesRep || 'غير محدد'}
                    </span>
                  </div>
                </div>

                {/* Phone & Next Followup */}
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <div className="flex items-center gap-1 font-mono">
                    <span>📞</span> {lead.phone}
                  </div>
                  {lead.nextFollowupDate && (
                    <div className="text-[11px] text-amber-700 font-bold">
                      ⏰ متابعة: {lead.nextFollowupDate}
                    </div>
                  )}
                </div>

                {lead.notes && (
                  <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg italic line-clamp-2">
                    {lead.notes}
                  </p>
                )}

                {/* Stage Controller Select */}
                <div className="pt-1">
                  <label className="text-[10px] text-slate-400 block font-bold mb-1">تغيير مرحلة الصفقة:</label>
                  <select
                    value={lead.stage}
                    onChange={(e) => handleStageChange(lead.id, e.target.value as LeadStage)}
                    className="w-full min-h-[34px] px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none"
                  >
                    {STAGES.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => handleOpenWhatsApp(lead)}
                    className="min-h-[36px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-xl text-[11px] transition flex items-center justify-center gap-1"
                    title="محادثة فورية على واتساب"
                  >
                    💬 واتساب
                  </button>

                  <button
                    onClick={() => handleConvertToCustomer(lead)}
                    className="min-h-[36px] bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold rounded-xl text-[11px] transition flex items-center justify-center gap-1"
                    title="إضافة لدليل العملاء الدائمين"
                  >
                    👤 عميل دائم
                  </button>

                  <button
                    onClick={() => {
                      if (onNavigateToSales) onNavigateToSales();
                      showToast(`تم فتح شاشة المبيعات لإصدار فاتورة للعميل ${lead.clientName}`, 'info');
                    }}
                    className="min-h-[36px] bg-[#1a237e] hover:bg-[#0d47a1] text-white font-bold rounded-xl text-[11px] transition flex items-center justify-center gap-1"
                    title="إصدار فاتورة بيع مباشرة"
                  >
                    🧾 فاتورة
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Add Lead */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-base text-slate-800 flex items-center gap-2">
                <span>➕</span> إضافة فرصة بيعية جديدة (New Lead)
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم العميل المسؤول *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: أ. محمود يوسف"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full min-h-[40px] px-3 border border-slate-200 rounded-xl text-xs focus:border-indigo-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم الشركة / النشاط</label>
                  <input
                    type="text"
                    placeholder="مثال: شركة البركة للمقاولات"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full min-h-[40px] px-3 border border-slate-200 rounded-xl text-xs focus:border-indigo-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف / واتساب *</label>
                  <input
                    type="text"
                    required
                    placeholder="010..."
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full min-h-[40px] px-3 border border-slate-200 rounded-xl text-xs font-mono focus:border-indigo-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">القيمة المتوقعة (ج.م)</label>
                  <input
                    type="number"
                    placeholder="مثال: 50000"
                    value={expectedValue}
                    onChange={(e) => setExpectedValue(e.target.value)}
                    className="w-full min-h-[40px] px-3 border border-slate-200 rounded-xl text-xs font-mono focus:border-indigo-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">مصدر الفرصة (Source)</label>
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className="w-full min-h-[40px] px-3 border border-slate-200 rounded-xl text-xs focus:border-indigo-600 focus:outline-none bg-white"
                  >
                    <option value="إعلانات السوشيال ميديا">إعلانات السوشيال ميديا</option>
                    <option value="معارض ومؤتمرات">معارض ومؤتمرات</option>
                    <option value="ترشيح من عميل حالي">ترشيح من عميل حالي</option>
                    <option value="اتصال مباشر / تليفون">اتصال مباشر / تليفون</option>
                    <option value="موقع الكتروني / كتالوج">موقع الكتروني / كتالوج</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">المندوب المسؤول</label>
                  <select
                    value={salesRep}
                    onChange={(e) => setSalesRep(e.target.value)}
                    className="w-full min-h-[40px] px-3 border border-slate-200 rounded-xl text-xs focus:border-indigo-600 focus:outline-none bg-white"
                  >
                    {appData.salesReps.map((r) => (
                      <option key={r.id} value={r.name}>
                        {r.name}
                      </option>
                    ))}
                    {appData.salesReps.length === 0 && <option value="المدير العام">المدير العام</option>}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ المتابعة القادمة</label>
                <input
                  type="date"
                  value={nextFollowupDate}
                  onChange={(e) => setNextFollowupDate(e.target.value)}
                  className="w-full min-h-[40px] px-3 border border-slate-200 rounded-xl text-xs focus:border-indigo-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">تفاصيل وملاحظات الطلب</label>
                <textarea
                  rows={2}
                  placeholder="الأصناف المطلوبة، متطلبات خاصة، الأسعار المعروضة..."
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
                  حفظ الفرصة البيعية
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
