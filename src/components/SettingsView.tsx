import React, { useState, useEffect } from 'react';
import { AppData, Settings } from '../types';
import {
  getCompanyApiKey,
  regenerateCompanyApiKey,
  updateCompanyProfile,
} from '../services/cloudApi';
import {
  Key,
  Copy,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  Server,
  Smartphone,
  ShieldCheck,
  Globe,
  Terminal,
} from 'lucide-react';

interface SettingsViewProps {
  appData: AppData;
  onUpdateData: (newData: AppData) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onShareCatalog?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ appData, onUpdateData, showToast, onShareCatalog }) => {
  const [settings, setSettings] = useState<Settings>({
    paperSize: 'A4',
    pageMargin: 5,
    showLogoInPrint: true,
    printerType: 'standard',
    defaultTaxRate: 14,
    currencySymbol: 'ج.م',
    fiscalYear: '2026',
    country: 'مصر',
    ...appData.settings,
  });

  // Keep settings state synchronized with incoming appData.settings updates
  useEffect(() => {
    if (appData.settings) {
      setSettings((prev) => ({
        ...prev,
        ...appData.settings,
      }));
    }
  }, [appData.settings]);

  // API Key & External APK Integration state
  const [apiKeyInfo, setApiKeyInfo] = useState<{
    apiKey?: string;
    companyId?: string;
    companyCode?: string;
    companyName?: string;
  } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadApiKey();
  }, []);

  const loadApiKey = async () => {
    try {
      const res = await getCompanyApiKey();
      if (res.success) {
        setApiKeyInfo({
          apiKey: res.apiKey,
          companyId: res.companyId,
          companyCode: res.companyCode,
          companyName: res.companyName,
        });
      }
    } catch (e) {
      console.warn('Could not load company API key:', e);
    }
  };

  const handleCopyApiKey = () => {
    if (!apiKeyInfo?.apiKey) return;
    navigator.clipboard.writeText(apiKeyInfo.apiKey);
    setCopiedKey(true);
    showToast('تم نسخ مفتاح الـ API / APK بنجاح إلى الحافظة', 'success');
    setTimeout(() => setCopiedKey(false), 2500);
  };

  const handleRegenerateApiKey = async () => {
    if (!confirm('هل أنت متأكد من رغبتك في توليد مفتاح جديد؟ سيتطلب ذلك تحديث المفتاح في أي تطبيق APK أو سيرفر خارجي متصل.')) {
      return;
    }
    setIsRegenerating(true);
    try {
      const res = await regenerateCompanyApiKey();
      if (res.success && res.apiKey) {
        setApiKeyInfo((prev) => (prev ? { ...prev, apiKey: res.apiKey } : null));
        showToast('تم تجديد مفتاح الـ API بنجاح', 'success');
      } else {
        showToast(res.error || 'فشل في تجديد المفتاح', 'error');
      }
    } catch (e) {
      showToast('حدث خطأ أثناء تجديد المفتاح', 'error');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('يرجى اختيار ملف صورة صالح (PNG / JPG / WEBP / SVG)', 'error');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showToast('حجم الصورة كبير جداً، يفضل اختيار صورة أقل من 2 ميجابايت', 'warning');
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setSettings((prev) => ({
        ...prev,
        logo: base64,
        logoUrl: base64,
      }));
      try {
        localStorage.setItem('company_logo_base64', base64);
      } catch (e) {
        console.warn('LocalStorage limit reached for standalone logo', e);
      }
      showToast('تم تحميل الشعار بنجاح، اضغط على زر حفظ الإعدادات لتثبيته', 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setSettings((prev) => ({
      ...prev,
      logo: '',
      logoUrl: '',
    }));
    try {
      localStorage.removeItem('company_logo_base64');
    } catch (e) {
      console.warn(e);
    }
    showToast('تمت إزالة الشعار', 'info');
  };

  const handleSave = async () => {
    setIsSaving(true);
    const updatedData = { ...appData, settings };
    onUpdateData(updatedData);

    if (settings.logo) {
      try {
        localStorage.setItem('company_logo_base64', settings.logo);
      } catch (e) {
        console.warn(e);
      }
    }

    // Sync company profile in cloud database & Firestore
    try {
      await updateCompanyProfile({
        name: settings.companyName,
        tradeName: settings.companyName,
        address: settings.address,
        phone: settings.phone1,
        phone1: settings.phone1,
        phone2: settings.phone2,
        phone3: settings.phone3,
        taxNumber: settings.taxNumber,
        commercialReg: settings.commercialReg,
        activityCode: settings.activityCode,
        activity: settings.activityCode,
        email: settings.email,
        website: settings.website,
        city: settings.city,
        country: settings.country,
        bankName: settings.bankName,
        bankAccountNumber: settings.bankAccountNumber,
        iban: settings.iban,
        defaultTaxRate: settings.defaultTaxRate,
        currencySymbol: settings.currencySymbol,
        fiscalYear: settings.fiscalYear,
        notes: settings.notes,
      });
    } catch (e) {
      console.warn('Failed cloud profile sync:', e);
    }

    setIsSaving(false);
    showToast('تم حفظ بيانات المنشأة والترويسة وهوامش الطباعة بنجاح، وتنعكس فوراً على كافة المطبوعات والفواتير', 'success');
  };

  const handleClearSampleData = () => {
    if (
      confirm(
        'هل أنت أسلوب متأكد من تفريغ كافة العملاء والموردين والأصناف والفواتير السابقة للبدء بنظام فارغ 100% لإدخال بياناتك الحقيقية الخاصة؟'
      )
    ) {
      const emptyData: AppData = {
        ...appData,
        customers: [],
        suppliers: [],
        items: [],
        salesInvoices: [],
        purchaseInvoices: [],
        cashTransactions: [],
        cashBox: { drawer: 0, vodafone: 0, instapay: 0, bank: 0 },
        salesReps: [],
        bankAccounts: [],
        nextInvoiceNumber: 1,
        nextPurchaseNumber: 1,
        nextCashId: 1,
      };

      onUpdateData(emptyData);
      showToast('تم تفريغ كافة البيانات للبدء بنظام فارغ تماماً', 'info');
    }
  };

  const currentLogo = settings.logo || settings.logoUrl || '';

  return (
    <div className="space-y-6 max-w-5xl mx-auto w-full overflow-x-hidden">
      {/* Top Action & Status Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base sm:text-lg font-black text-[#1a237e] flex items-center gap-2">
            <span>⚙️</span> إعدادات وبيانات المنشأة الرسمية (Company Profile & ERP Settings)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            تهيئة هوية الشركة، السجل التجاري، الرقم الضريبي، الحسابات البنكية، وهوامش وتذييل الفواتير المطبوعة.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="w-full sm:w-auto min-h-[44px] bg-[#2e7d32] hover:bg-[#1b5e20] active:bg-[#144718] text-white px-6 py-2 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
        >
          {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>💾</span>}
          <span>{isSaving ? 'جارٍ الحفظ...' : 'حفظ كافة التعديلات'}</span>
        </button>
      </div>

      {/* 🏢 1. Company Identity & Legal Information */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-xs border border-slate-200 space-y-5">
        <h4 className="text-[#1a237e] font-black text-sm sm:text-base flex items-center gap-2 border-b border-slate-100 pb-3">
          <span>🏢</span> الهوية التجارية والبيانات القانونية للمنشأة
        </h4>

        {/* Logo Upload Section */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-5">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-2 border-dashed border-indigo-300 bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-xs relative group">
            {currentLogo ? (
              <img
                src={currentLogo}
                alt="شعار الشركة"
                className="w-full h-full object-contain p-1.5"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="text-center p-2 text-slate-400">
                <span className="text-2xl block mb-1">🖼️</span>
                <span className="text-[10px] font-bold block">لا يوجد شعار</span>
              </div>
            )}
          </div>

          <div className="space-y-2 flex-1 text-center sm:text-right">
            <div className="text-xs sm:text-sm font-bold text-slate-800">شعار المؤسسة الرسمي للطباعة والفواتير</div>
            <p className="text-[11px] sm:text-xs text-slate-500">
              يظهر هذا الشعار تلقائياً في ترويسة جميع فواتير المبيعات والمشتريات، كشوفات الحساب، سندات الصرف والقبض، وتقارير النظام الشاملة.
            </p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
              <label className="min-h-[40px] bg-[#1a237e] hover:bg-[#0d47a1] active:bg-[#082a63] text-white px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs">
                <span>📤</span> رفع شعار جديد
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </label>

              {currentLogo && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="min-h-[40px] bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1"
                >
                  <span>🗑️</span> حذف الشعار
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Identity Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs md:text-sm">
          <div>
            <label className="block font-bold text-slate-700 mb-1">اسم المؤسسة / الاسم التجاري الرسمي <span className="text-rose-500">*</span></label>
            <input
              type="text"
              value={settings.companyName}
              onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
              className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-[#1a237e] focus:outline-none font-bold"
              placeholder="مثال: شركة النور للتجارة والتوزيع"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">رقم السجل التجاري (Commercial Reg.)</label>
            <input
              type="text"
              value={settings.commercialReg || ''}
              onChange={(e) => setSettings({ ...settings, commercialReg: e.target.value })}
              className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-[#1a237e] focus:outline-none font-mono"
              placeholder="مثال: 104523"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">الرقم الضريبي / ضريبة القيمة المضافة (Tax ID)</label>
            <input
              type="text"
              value={settings.taxNumber || ''}
              onChange={(e) => setSettings({ ...settings, taxNumber: e.target.value })}
              className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-[#1a237e] focus:outline-none font-mono"
              placeholder="مثال: 300-120-450"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">النشاط التجاري / مجال العمل</label>
            <input
              type="text"
              value={settings.activityCode || ''}
              onChange={(e) => setSettings({ ...settings, activityCode: e.target.value })}
              className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-[#1a237e] focus:outline-none"
              placeholder="مثال: تجارة مواد البناء والتوريدات العمومية"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">السنة المالية النشطة (Fiscal Year)</label>
            <input
              type="text"
              value={settings.fiscalYear || '2026'}
              onChange={(e) => setSettings({ ...settings, fiscalYear: e.target.value })}
              className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-[#1a237e] focus:outline-none font-mono font-bold"
              placeholder="2026"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">الدولة</label>
            <input
              type="text"
              value={settings.country || 'مصر'}
              onChange={(e) => setSettings({ ...settings, country: e.target.value })}
              className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-[#1a237e] focus:outline-none"
              placeholder="مثال: مصر / المملكة العربية السعودية"
            />
          </div>
        </div>
      </div>

      {/* 📍 2. Contact Information & Locations */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-xs border border-slate-200 space-y-4">
        <h4 className="text-[#1a237e] font-black text-sm sm:text-base flex items-center gap-2 border-b border-slate-100 pb-3">
          <span>📍</span> المقر الرئيسي، العناوين، وبيانات التواصل
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs md:text-sm">
          <div className="sm:col-span-2">
            <label className="block font-bold text-slate-700 mb-1">المقر الرئيسي والعنوان التفصيلي</label>
            <input
              type="text"
              value={settings.address || ''}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-[#1a237e] focus:outline-none"
              placeholder="مثال: 15 شارع الجمهورية، الدور الثاني، وسط البلد"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">المدينة / المحافظة</label>
            <input
              type="text"
              value={settings.city || ''}
              onChange={(e) => setSettings({ ...settings, city: e.target.value })}
              className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-[#1a237e] focus:outline-none"
              placeholder="مثال: القاهرة / الإسكندرية / الرياض"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">رقم الهاتف الأساسي (Phone 1)</label>
            <input
              type="text"
              dir="ltr"
              value={settings.phone1 || ''}
              onChange={(e) => setSettings({ ...settings, phone1: e.target.value })}
              className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-[#1a237e] focus:outline-none text-right font-mono"
              placeholder="010XXXXXXXX"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">رقم الهاتف الإضافي / المبيعات (Phone 2)</label>
            <input
              type="text"
              dir="ltr"
              value={settings.phone2 || ''}
              onChange={(e) => setSettings({ ...settings, phone2: e.target.value })}
              className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-[#1a237e] focus:outline-none text-right font-mono"
              placeholder="011XXXXXXXX"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">رقم الواتساب وخدمة العملاء (Phone 3 / WhatsApp)</label>
            <input
              type="text"
              dir="ltr"
              value={settings.phone3 || ''}
              onChange={(e) => setSettings({ ...settings, phone3: e.target.value })}
              className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-[#1a237e] focus:outline-none text-right font-mono"
              placeholder="012XXXXXXXX"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">البريد الإلكتروني الرسمي للمنشأة</label>
            <input
              type="email"
              dir="ltr"
              value={settings.email || ''}
              onChange={(e) => setSettings({ ...settings, email: e.target.value })}
              className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-[#1a237e] focus:outline-none text-right font-mono"
              placeholder="info@company.com"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-bold text-slate-700 mb-1">الموقع الإلكتروني الرسمي (Website)</label>
            <input
              type="url"
              dir="ltr"
              value={settings.website || ''}
              onChange={(e) => setSettings({ ...settings, website: e.target.value })}
              className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-[#1a237e] focus:outline-none text-right font-mono"
              placeholder="https://www.company.com"
            />
          </div>
        </div>
      </div>

      {/* 💰 3. Financial, Tax & Banking Configuration */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-xs border border-slate-200 space-y-4">
        <h4 className="text-[#1a237e] font-black text-sm sm:text-base flex items-center gap-2 border-b border-slate-100 pb-3">
          <span>💰</span> الإعدادات المالية، الضريبية، والبيانات البنكية
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs md:text-sm">
          <div>
            <label className="block font-bold text-slate-700 mb-1">رمز العملة الافتراضية</label>
            <select
              value={settings.currencySymbol || 'ج.م'}
              onChange={(e) => setSettings({ ...settings, currencySymbol: e.target.value })}
              className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-[#1a237e] focus:outline-none font-bold bg-white"
            >
              <option value="ج.م">ج.م (جنيه مصري)</option>
              <option value="ر.س">ر.س (ريال سعودي)</option>
              <option value="$">$ (دولار أمريكي)</option>
              <option value="د.إ">د.إ (درهم إماراتي)</option>
              <option value="د.ك">د.ك (دينار كويتي)</option>
              <option value="ر.ع">ر.ع (ريال عماني)</option>
              <option value="د.ب">د.ب (دينار بحريني)</option>
              <option value="ر.ق">ر.ق (ريال قطري)</option>
              <option value="د.أ">د.أ (دينار أردني)</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">نسبة ضريبة القيمة المضافة الافتراضية (%)</label>
            <div className="relative">
              <input
                type="number"
                step="0.5"
                min="0"
                max="100"
                value={settings.defaultTaxRate ?? 14}
                onChange={(e) => setSettings({ ...settings, defaultTaxRate: Number(e.target.value) })}
                className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-[#1a237e] focus:outline-none font-mono font-bold pl-8"
              />
              <span className="absolute left-3 top-3 text-slate-400 font-bold">%</span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">تطبق تلقائياً على فواتير المبيعات والمشتريات والبنود الخاضعة.</span>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">نسبة ضريبة الخصم والإضافة / الأرباح التجارية (%)</label>
            <div className="relative">
              <input
                type="number"
                step="0.25"
                min="0"
                max="10"
                value={settings.withholdingTaxRate ?? 1}
                onChange={(e) => setSettings({ ...settings, withholdingTaxRate: Number(e.target.value) })}
                className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-[#1a237e] focus:outline-none font-mono font-bold pl-8"
              />
              <span className="absolute left-3 top-3 text-slate-400 font-bold">%</span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">نسبة الخصم والإضافة المعتمدة (الافتراضي 1%).</span>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">اسم البنك المعتمد للمنشأة</label>
            <input
              type="text"
              value={settings.bankName || ''}
              onChange={(e) => setSettings({ ...settings, bankName: e.target.value })}
              className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-[#1a237e] focus:outline-none"
              placeholder="مثال: البنك الأهلي المصري / بنك الراجحي"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">رقم الحساب البنكي</label>
            <input
              type="text"
              dir="ltr"
              value={settings.bankAccountNumber || ''}
              onChange={(e) => setSettings({ ...settings, bankAccountNumber: e.target.value })}
              className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-[#1a237e] focus:outline-none font-mono text-right"
              placeholder="100234567890"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">رقم الآيبان الدولي (IBAN)</label>
            <input
              type="text"
              dir="ltr"
              value={settings.iban || ''}
              onChange={(e) => setSettings({ ...settings, iban: e.target.value })}
              className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-[#1a237e] focus:outline-none font-mono text-right"
              placeholder="EG000000000000000000000000"
            />
          </div>
        </div>
      </div>

      {/* 📝 4. Invoice Footer, Terms & Conditions */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-xs border border-slate-200 space-y-4">
        <h4 className="text-[#1a237e] font-black text-sm sm:text-base flex items-center gap-2 border-b border-slate-100 pb-3">
          <span>📝</span> تذييل وملاحظات وشروط الفواتير المطبوعة
        </h4>

        <div>
          <label className="block font-bold text-slate-700 mb-1">نص تذييل الفاتورة وشروط الاسترجاع والاستبدال</label>
          <textarea
            rows={3}
            value={settings.notes || ''}
            onChange={(e) => setSettings({ ...settings, notes: e.target.value })}
            className="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-[#1a237e] focus:outline-none text-xs sm:text-sm leading-relaxed"
            placeholder="مثال: البضاعة المباعة ترد وتستبدل خلال 14 يوماً بموجب أصل الفاتورة وبحالتها الأصلية. شكراً لتعاملكم معنا."
          />
          <span className="text-[11px] text-slate-400 mt-1 block">يظهر هذا النص أسفل جميع فواتير المبيعات، سندات القبض، وعروض الأسعار.</span>
        </div>
      </div>

      {/* 🔑 External API & Mobile APK Integration Key Card */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-lg border border-indigo-900/50 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-800/40 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-white flex items-center gap-2">
                مفتاح الـ API والربط الخارجي وتطبيق الموبايل (APK Key)
              </h4>
              <p className="text-xs text-indigo-200">
                مفتاح موثق ومشفر لربط تطبيق الموبايل (Android APK) أو أي سيرفر خارجي بقاعدة بيانات المنظومة
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <ShieldCheck className="w-3.5 h-3.5" /> سحابي نشط
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Company ID */}
          <div className="bg-white/5 border border-white/10 p-3.5 rounded-xl">
            <span className="text-xs text-indigo-200 block mb-1">معرف المنشأة (Company ID):</span>
            <div className="flex items-center justify-between font-mono font-bold text-sm text-indigo-300">
              <span>{apiKeyInfo?.companyId || appData.companyId || 'COMP-672842'}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-200">
                كود: {apiKeyInfo?.companyCode || '108'}
              </span>
            </div>
          </div>

          {/* API Base URL */}
          <div className="bg-white/5 border border-white/10 p-3.5 rounded-xl">
            <span className="text-xs text-indigo-200 block mb-1">رابط الخادم المباشر (API Base URL):</span>
            <div className="font-mono font-bold text-xs text-slate-300 truncate" dir="ltr">
              {typeof window !== 'undefined' ? `${window.location.origin}/api` : 'https://.../api'}
            </div>
          </div>
        </div>

        {/* API Key Box */}
        <div className="bg-black/40 border border-indigo-500/30 p-4 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5" />
              مفتاح المصادقة السري للـ APK والسيرفر الخارجي (Secret API Key)
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="text-xs flex items-center gap-1 text-slate-400 hover:text-white px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition-all"
              >
                {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showApiKey ? 'إخفاء' : 'إظهار'}
              </button>
              <button
                type="button"
                onClick={handleRegenerateApiKey}
                disabled={isRegenerating}
                className="text-xs flex items-center gap-1 text-amber-400 hover:text-amber-300 px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 transition-all disabled:opacity-50"
                title="توليد مفتاح جديد"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
                تجديد
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type={showApiKey ? 'text' : 'password'}
              readOnly
              value={apiKeyInfo?.apiKey || 'rkz_live_672842_a9d3f8e12b7405c6'}
              className="w-full bg-slate-900/90 border border-white/10 rounded-lg p-2.5 font-mono text-sm text-emerald-400 tracking-wider focus:outline-none"
              dir="ltr"
            />
            <button
              type="button"
              onClick={handleCopyApiKey}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shrink-0 transition-all shadow-md active:scale-95"
            >
              {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copiedKey ? 'تم النسخ!' : 'نسخ المفتاح'}
            </button>
          </div>
        </div>

        {/* Integration Instructions & Sample */}
        <div className="bg-white/5 border border-white/10 p-4 rounded-xl space-y-2.5 text-xs text-slate-300 leading-relaxed">
          <div className="flex items-center gap-2 text-indigo-300 font-bold">
            <Terminal className="w-4 h-4" />
            طريقة الربط من السيرفر الخارجي أو تطبيق APK:
          </div>
          <p>
            أرسل المفتاح في ترويسة الطلب <code className="bg-indigo-900/60 px-2 py-0.5 rounded text-amber-300 font-mono">x-api-key</code> أو كمعامل في الرابط <code className="bg-indigo-900/60 px-2 py-0.5 rounded text-amber-300 font-mono">?apiKey=...</code>:
          </p>
          <div className="bg-black/60 p-3 rounded-lg font-mono text-[11px] text-emerald-300 break-all whitespace-pre-wrap max-w-full text-left overflow-x-hidden" dir="ltr">
            curl -X GET "{typeof window !== 'undefined' ? window.location.origin : 'https://your-domain'}/api/tenant/data" \<br />
            &nbsp;&nbsp;-H "x-api-key: {apiKeyInfo?.apiKey || 'rkz_live_672842_a9d3f8e12b7405c6'}"
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1">
            <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
            <span>يدعم التطبيق الربط التلقائي بمزامنة لحظية ثنائية الاتجاه دون الحاجة لتسجيل دخول يدوي متكرر.</span>
          </div>
        </div>
      </div>

      {/* Printing & Layout Engine Configuration */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <h4 className="text-[#1a237e] font-bold text-base flex items-center gap-1 border-b border-gray-100 pb-3">
          <span>🖨️</span> إعدادات محرك الطباعة وتنسيق الورقة (CSS Page Setup)
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs md:text-sm">
          {/* Default Page Size */}
          <div>
            <label className="block font-bold mb-1 text-slate-700">حجم الصفحة الافتراضي للتقارير</label>
            <select
              value={settings.paperSize || 'A4'}
              onChange={(e) => setSettings({ ...settings, paperSize: e.target.value as any })}
              className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none bg-white font-bold"
            >
              <option value="A4">A4 (210mm × 297mm) - المقاس القياسي للتقارير</option>
              <option value="A5">A5 (148mm × 210mm) - فواتير وسندات نصف ورقة</option>
              <option value="Letter">Letter (8.5 × 11 بوصة)</option>
              <option value="auto">تلقائي (Auto Fit)</option>
            </select>
            <span className="text-[11px] text-slate-400 mt-1 block">يتحكم في مقاس الورقة لجميع قوالب التقارير والفواتير.</span>
          </div>

          {/* Page Margin in MM */}
          <div>
            <label className="block font-bold mb-1 text-slate-700">
              هوامش الصفحة (Margin): <span className="font-mono text-indigo-700">{settings.pageMargin ?? 5} ملم</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="20"
                step="1"
                value={settings.pageMargin ?? 5}
                onChange={(e) => setSettings({ ...settings, pageMargin: Number(e.target.value) })}
                className="flex-1 accent-[#1a237e]"
              />
              <input
                type="number"
                min="0"
                max="30"
                value={settings.pageMargin ?? 5}
                onChange={(e) => setSettings({ ...settings, pageMargin: Number(e.target.value) })}
                className="w-16 p-2 border-2 border-gray-200 rounded-xl font-mono text-center text-xs font-bold"
              />
            </div>
            {/* Quick Margins Presets */}
            <div className="flex gap-1.5 mt-1.5">
              {[0, 3, 5, 8, 10, 15].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSettings({ ...settings, pageMargin: m })}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                    settings.pageMargin === m
                      ? 'bg-indigo-900 text-white border-indigo-900'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {m}mm
                </button>
              ))}
            </div>
          </div>

          {/* Show Logo in Print */}
          <div>
            <label className="block font-bold mb-1 text-slate-700">خيارات الشعار والمظهر في المطبوعات</label>
            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showLogoInPrint !== false}
                  onChange={(e) => setSettings({ ...settings, showLogoInPrint: e.target.checked })}
                  className="w-4 h-4 accent-[#1a237e] rounded"
                />
                <span className="font-bold text-xs text-slate-800">إظهار الشعار في ترويسة المطبوعات</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.printerType === 'thermal'}
                  onChange={(e) => setSettings({ ...settings, printerType: e.target.checked ? 'thermal' : 'standard' })}
                  className="w-4 h-4 accent-[#1a237e] rounded"
                />
                <span className="font-bold text-xs text-slate-800">الوضع الافتراضي: طابعة إيصالات حرارية 80mm</span>
              </label>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={handleSave}
            className="bg-[#2e7d32] hover:bg-[#1b5e20] text-white px-8 py-2.5 rounded-xl font-bold transition cursor-pointer shadow-xs flex items-center gap-2"
          >
            <span>💾</span>
            <span>حفظ كافة التعديلات والإعدادات</span>
          </button>
        </div>
      </div>

      {/* Online Catalog & B2B/B2C Storefront Settings Card */}
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-amber-200 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-2xl">
              🛍️
            </div>
            <div>
              <h4 className="font-black text-lg text-slate-900 flex items-center gap-2">
                كتالوج المنتجات والمتجر الإلكتروني للعملاء (B2B / B2C Catalog)
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                تفعيل وإدارة رابط الكتالوج الخارجي، واستقبال طلبات الشراء أونلاين مباشرة إلى خط سير الفواتير والطلبيات، وطباعة بوستر QR Code لمتجرك.
              </p>
            </div>
          </div>
          {onShareCatalog && (
            <button
              type="button"
              onClick={onShareCatalog}
              className="bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-black px-5 py-2.5 rounded-xl text-sm transition cursor-pointer flex items-center gap-2 shadow-xs shrink-0"
            >
              <span>⚡</span>
              <span>مشاركة الكتالوج وتوليد QR Code</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs text-slate-600">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
              <span>🌐</span> رابط مباشر للعملاء
            </div>
            <p className="text-slate-500">
              يمكن لعملائك تصفح المنتجات والأسعار من أي متصفح أو هاتف بدون تثبيت تطبيق.
            </p>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
              <span>📥</span> طلبات شراء فورية
            </div>
            <p className="text-slate-500">
              تحويل طلبات الشراء تلقائياً إلى عروض أسعار وطلبيات في نظام ERP مع إشعار فوري.
            </p>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
              <span>📱</span> جاهز للواتساب والطباعة
            </div>
            <p className="text-slate-500">
              توليد ملصقات QR Code عالية الدقة للطباعة على الكروت وأبواب المحل أو الإرسال واتساب.
            </p>
          </div>
        </div>
      </div>

      {/* Developer Rights Box */}
      <div className="bg-gradient-to-r from-[#072a4e] to-[#0d4b8e] text-white p-6 rounded-2xl shadow-sm border border-indigo-900 space-y-3">
        <h4 className="font-bold text-lg flex items-center gap-2 text-[#ffd54f]">
          <span>💻</span> حقوق الملكية وتطوير النظام
        </h4>
        <div className="text-sm space-y-1.5 opacity-95">
          <p>
            اسم المنظومة: <strong className="text-white text-base">منظومة ركيزة | RAKEEZA Cloud ERP</strong>
          </p>
          <p>
            تطوير وبرمجة: <strong className="text-[#ffd54f] text-base">Mohamed Nazih</strong>
          </p>
          <p>
            رقم الهاتف والتواصل المباشر: <strong className="font-mono text-emerald-300 text-base" dir="ltr">01029190615</strong>
          </p>
        </div>
        <p className="text-xs text-blue-200 pt-2 border-t border-white/20">
          جميع حقوق الملكية والتأليف محفوظة للمطور. يتم طباعة هذا التذييل تلقائياً على جميع الفواتير، التقارير الشاملة، كشوفات الحسابات وسندات الخزينة.
        </p>
      </div>

      {/* Clear Sample Data Box */}
      <div className="bg-red-50 p-6 rounded-2xl shadow-sm border border-red-200 space-y-3">
        <h4 className="text-[#c62828] font-bold text-base flex items-center gap-1">
          <span>🗑️</span> تفريغ بيانات العينات للبدء بشركة جديدة
        </h4>
        <p className="text-gray-600 text-xs">
          إذا كنت تريد البدء بنظام فارغ 100% بدون أية أصناف أو عملاء أو موردين أو فواتير سابقة لبدء إدخال بياناتك الحقيقية، يمكنك تفريغ العينات بنقرة واحدة.
        </p>
        <button
          onClick={handleClearSampleData}
          className="bg-[#c62828] hover:bg-[#b71c1c] text-white px-6 py-2.5 rounded-xl text-xs md:text-sm font-bold transition cursor-pointer"
        >
          🗑️ تفريغ النظام والبدء بقاعدة فارغة
        </button>
      </div>
    </div>
  );
};
