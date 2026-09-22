import { CashTransaction, AppData, Settings } from '../types';
import { tafqeetArabic } from './tafqeet';

export interface UnifiedVoucherData {
  type: 'receive' | 'pay' | 'deposit' | 'withdraw' | 'قبض' | 'صرف' | string;
  serialNo?: string | number;
  partyName?: string;
  partyId?: string;
  amount: number;
  paymentMethod?: string;
  amountText?: string;
  reason?: string;
  accountName?: string;
  date?: string;
  time?: string;
  invoiceId?: string | number;
  notes?: string;
}

/**
 * Generates the HTML string for the Unified Financial Voucher (سند مالي موحد - قبض / صرف)
 */
export function generateCashVoucherPrintHtml(
  dataOrTrans: CashTransaction | UnifiedVoucherData,
  appDataOrSettings: AppData | Settings
): string {
  // Normalize settings
  const settings: Settings = (appDataOrSettings as AppData).settings || (appDataOrSettings as Settings) || {
    companyName: 'منظومة RAKEEZA للمحاسبة',
    address: 'القاهرة، مصر',
    phone1: '01029190615',
    phone2: '',
    phone3: '',
    taxNumber: '',
    commercialReg: '',
    notes: '',
    defaultTaxRate: 14,
    currencySymbol: 'ج.م',
    paperSize: 'A4',
    pageMargin: 5,
    showLogoInPrint: true,
  };

  const companyName = settings.companyName || 'منظومة RAKEEZA للمحاسبة';
  const companyAddress = settings.address || 'القاهرة، مصر';
  const logoUrl = settings.logo || settings.logoUrl || '';
  const showLogo = settings.showLogoInPrint !== false && Boolean(logoUrl);

  const phones: string[] = [settings.phone1, settings.phone2, settings.phone3].filter(Boolean) as string[];

  // Normalize voucher data
  const isTrans = 'method' in dataOrTrans;
  const rawType = dataOrTrans.type || 'receive';
  const isReceive =
    rawType === 'receive' ||
    rawType === 'deposit' ||
    rawType === 'قبض' ||
    String(rawType).includes('قبض') ||
    String(rawType).includes('receive');

  const serialNo =
    (dataOrTrans as any).serialNo ||
    (dataOrTrans as any).id ||
    (dataOrTrans as any).code ||
    '1';

  let partyName = (dataOrTrans as any).partyName || '';
  let partyId = (dataOrTrans as any).partyId || '';

  if (isTrans) {
    const tx = dataOrTrans as CashTransaction;
    partyName = tx.customerName || tx.supplierName || (tx.type === 'receive' ? 'عميل نقدي' : 'مورد عام');
    partyId = (tx as any).customerId || (tx as any).supplierId || (tx.invoiceId ? `فاتورة #${tx.invoiceId}` : '-');
  }

  const amount = Number(dataOrTrans.amount) || 0;
  const currency = settings.currencySymbol || 'ج.م';

  let paymentMethod = (dataOrTrans as any).paymentMethod || '';
  if (isTrans) {
    const tx = dataOrTrans as CashTransaction;
    paymentMethod =
      tx.method === 'drawer'
        ? 'نقدي (الخزينة الرئيسية)'
        : tx.method === 'vodafone'
        ? 'فودافون كاش'
        : tx.method === 'instapay'
        ? 'إنستاباي (InstaPay)'
        : tx.method === 'bank'
        ? 'حساب بنكي'
        : tx.method || 'نقدي';
  } else if (!paymentMethod) {
    paymentMethod = 'نقدي';
  }

  const amountText =
    (dataOrTrans as any).amountText ||
    tafqeetArabic(amount, { currency: currency === 'ج.م' ? 'جنيه مصري' : currency });

  let reason = (dataOrTrans as any).reason || (dataOrTrans as any).note || (dataOrTrans as any).notes || '';
  if (isTrans && (dataOrTrans as CashTransaction).invoiceId) {
    const invNote = `سداد وتسوية مستحقات الفاتورة رقم #${(dataOrTrans as CashTransaction).invoiceId}`;
    reason = reason ? `${reason} (${invNote})` : invNote;
  }
  if (!reason) {
    reason = isReceive ? 'سداد دفعة نقدية / تصفية حساب جاري' : 'صرف مستحقات مالية / مصاريف تشغيلية';
  }

  const accountName =
    (dataOrTrans as any).accountName ||
    (isReceive ? 'الخزينة العامة الرئيسية' : 'خزينة المصروفات والمدفوعات');

  const now = new Date();
  const dateStr = (dataOrTrans as any).date || now.toISOString().split('T')[0];
  const timeStr =
    (dataOrTrans as any).time ||
    now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  // Page formatting
  const paperSize = settings.paperSize || 'A4';
  const pageMargin = settings.pageMargin !== undefined ? settings.pageMargin : 5;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${isReceive ? 'سند قبض مالي' : 'سند صرف مالي'} #${serialNo}</title>
<style>
  :root {
    --page-size: ${paperSize === 'A5' ? 'A5 portrait' : paperSize === 'Letter' ? 'letter portrait' : 'A4 portrait'};
    --page-margin: ${pageMargin}mm;
  }

  @page { 
    size: var(--page-size, auto); 
    margin: var(--page-margin, 4mm); 
  }
  
  * { 
    box-sizing: border-box; 
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  
  html, body { 
    font-family: 'Segoe UI', Tahoma, Arial, sans-serif; 
    background-color: #f0f2f5; 
    margin: 0; padding: 0; color: #000;
    width: 100%; height: 100%;
    display: flex; flex-direction: column; align-items: center;
  }

  .no-print-toolbar, .no-print-bar {
    position: sticky;
    top: 0;
    z-index: 9999;
    background: #0f172a;
    color: #fff;
    width: 100%;
    padding: 8px 16px;
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
  }
  .toolbar-title-box {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .toolbar-title-box .title-text {
    font-weight: bold;
    font-size: 13.5px;
    color: #fff;
  }
  .toolbar-title-box .doc-badge {
    background: #334155;
    color: #93c5fd;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11.5px;
    font-weight: 600;
  }
  .toolbar-controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .toolbar-field {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
  }
  .toolbar-field label {
    color: #cbd5e1;
    font-weight: 600;
    white-space: nowrap;
  }
  .toolbar-select {
    padding: 5px 9px;
    border-radius: 6px;
    border: 1px solid #475569;
    background: #1e293b;
    color: #fff;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    outline: none;
    transition: border-color 0.15s;
  }
  .toolbar-select:focus {
    border-color: #3b82f6;
  }
  .btn-print {
    background: #16a34a;
    color: #fff;
    border: none;
    padding: 6px 18px;
    border-radius: 6px;
    font-weight: bold;
    font-size: 13px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.25);
    transition: all 0.15s;
  }
  .btn-print:hover {
    background: #15803d;
    transform: translateY(-1px);
  }
  .btn-close {
    background: #475569;
    color: #fff;
    border: none;
    padding: 6px 14px;
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn-close:hover {
    background: #334155;
  }

  body.size-a5 { font-size: 0.75rem; }
  body.size-a5 .voucher-container { padding: 3mm 4mm; min-height: calc(100vh - 12px); }
  body.size-a5 .header-right h2 { font-size: 1rem; }
  body.size-a5 .header-right p, body.size-a5 .phones-list { font-size: 0.65rem; }
  body.size-a5 .logo-img { max-height: 38px; }
  body.size-a5 .info-box { padding: 3px 6px; font-size: 0.72rem; }
  body.size-a5 .voucher-body { padding: 8px; font-size: 0.78rem; line-height: 1.6; }
  body.size-a5 .amount-highlight { font-size: 0.95rem; padding: 2px 8px; }
  body.size-a5 .bottom-section { font-size: 0.72rem; margin: 3px 0; }
  body.size-a5 .voucher-footer-note { font-size: 0.65rem; padding-top: 2px; }
  body.size-a5 .copyright-outside { font-size: 0.65rem; padding: 1px 0; }

  body.orient-landscape .voucher-container { width: 100vw; height: auto; min-height: calc(100vh - 20px); }

  .voucher-wrapper {
    width: 100%;
    max-width: 850px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-grow: 1;
    height: 100%;
  }

  .voucher-container, .report-container { 
    background: #fff; 
    width: 100vw;
    height: 100vh;
    min-height: 98vh;
    max-width: 100%;
    margin: 0 auto; 
    padding: 5mm 7mm; 
    border: 3px solid #000; 
    box-sizing: border-box;
    display: flex; 
    flex-direction: column; 
    justify-content: space-between;
    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  }

  /* 1. الترويسة الديناميكية */
  .header { 
    display: flex; 
    justify-content: space-between; 
    align-items: center; 
    border-bottom: 2px solid #000; 
    padding-bottom: 5px; 
    margin-bottom: 6px; 
    width: 100%; 
  }
  .header.is-empty { display: none !important; }
  .header-right h2 { margin: 0 0 2px 0; font-size: 1.15rem; font-weight: 900; color: #000; }
  .header-right p { margin: 0; font-size: 0.78rem; color: #333; }
  .header-center { display: flex; justify-content: center; align-items: center; min-width: 80px; }
  .logo-img { max-width: 90px; max-height: 55px; object-fit: contain; }
  .phones-list { list-style: none; padding: 0; margin: 0; font-size: 0.75rem; direction: ltr; text-align: left; }
  .phones-list li { margin-bottom: 1px; font-weight: 700; color: #111; }

  /* 2. صندوق البيانات العلوي */
  .info-box { 
    display: flex; 
    justify-content: space-between; 
    align-items: center;
    border: 1.5px solid #000; 
    padding: 5px 10px; 
    margin-bottom: 8px; 
    font-size: 0.8rem; 
    line-height: 1.4; 
    width: 100%; 
    background-color: #fafafa;
  }
  .info-item p { margin: 2px 0; }

  /* 3. جسم السند المتمدد رأسياً */
  .voucher-body {
    border: 1.5px solid #000;
    padding: 14px;
    margin-bottom: 8px;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    font-size: 0.88rem;
    line-height: 1.9;
    background: #fff;
  }

  .amount-highlight {
    border: 2px solid #000;
    background: #ededed;
    padding: 4px 14px;
    font-size: 1.15rem;
    font-weight: 900;
    display: inline-block;
    color: #000;
  }

  .voucher-row { display: flex; align-items: center; gap: 8px; width: 100%; }
  .voucher-row strong { white-space: nowrap; font-weight: 800; }
  .dots-line { flex-grow: 1; border-bottom: 1px dotted #000; font-weight: bold; padding: 0 6px; color: #111; }

  /* 4. التوقيعات */
  .bottom-section {
    display: flex; 
    justify-content: space-between; 
    align-items: flex-end;
    margin-top: 6px; 
    margin-bottom: 6px; 
    width: 100%; 
    font-size: 0.8rem; 
    font-weight: bold;
    padding: 0 4px;
  }

  /* 5. التذييل الداخلي */
  .voucher-footer-note {
    border-top: 1.5px solid #000; 
    padding-top: 4px; 
    margin-top: auto; 
    display: flex; 
    justify-content: space-between; 
    font-size: 0.72rem; 
    font-weight: 600; 
    width: 100%;
    color: #333;
  }

  /* حقوق الملكية خارج الإطار الخارجي */
  .copyright-outside {
    width: 100%; 
    text-align: center; 
    font-size: 0.72rem; 
    font-weight: bold; 
    color: #000; 
    margin-top: auto;
    padding: 3px 0; 
    direction: rtl;
  }

  @media print {
    html, body { 
      background: #fff !important; 
      padding: 0 !important; 
      margin: 0 !important; 
      width: 100% !important;
      height: 100% !important;
      overflow: hidden !important;
      display: flex !important;
      flex-direction: column !important;
    }
    .no-print-bar { display: none !important; }
    .voucher-wrapper { width: 100% !important; max-width: 100% !important; margin: 0 !important; height: 100% !important; }
    .voucher-container, .report-container { 
      border: 3px solid #000 !important; 
      width: 100vw !important; 
      height: calc(100vh - 20px) !important; 
      min-height: calc(100vh - 20px) !important;
      max-height: calc(100vh - 20px) !important;
      padding: 4mm 6mm !important; 
      box-shadow: none !important; 
      box-sizing: border-box !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
      page-break-after: avoid !important; 
      page-break-inside: avoid !important;
    }
    .voucher-body {
      flex-grow: 1 !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-around !important;
    }
    .copyright-outside {
      display: block !important;
      position: relative !important;
      margin-top: auto !important;
      padding-top: 2px !important;
      font-size: 0.72rem !important;
      font-weight: bold !important;
      color: #000 !important;
    }
  }
</style>
</head>
<body>

<div class="no-print-toolbar no-print-bar">
  <div class="toolbar-title-box">
    <span class="title-text">🖨️ معاينة وتخصيص الطباعة</span>
    <span class="doc-badge">${isReceive ? 'سند قبض مالي' : 'سند صرف مالي'} #${serialNo}</span>
  </div>
  <div class="toolbar-controls">
    <div class="toolbar-field">
      <label for="selPaperSize">حجم الورق:</label>
      <select id="selPaperSize" class="toolbar-select" onchange="updatePrintLayout()">
        <option value="A4" ${paperSize === 'A4' ? 'selected' : ''}>A4 (قياسي)</option>
        <option value="A5" ${paperSize === 'A5' ? 'selected' : ''}>A5 (مدمج)</option>
        <option value="Letter" ${paperSize === 'Letter' ? 'selected' : ''}>Letter</option>
      </select>
    </div>
    <div class="toolbar-field">
      <label for="selOrientation">الاتجاه:</label>
      <select id="selOrientation" class="toolbar-select" onchange="updatePrintLayout()">
        <option value="portrait" selected>📄 رأسي / عمودي (Portrait)</option>
        <option value="landscape">📑 أفقي (Landscape)</option>
      </select>
    </div>
    <div class="toolbar-field">
      <label for="selMargins">الهوامش:</label>
      <select id="selMargins" class="toolbar-select" onchange="updatePrintLayout()">
        <option value="compact">مضغوطة (3mm)</option>
        <option value="normal" selected>قياسية (5mm)</option>
        <option value="wide">عريضة (8mm)</option>
      </select>
    </div>
    <button class="btn-print" onclick="triggerPrint()">
      <span>🖨️</span>
      <span>طباعة الآن (Print)</span>
    </button>
    <button class="btn-close" onclick="window.close()">✕ إغلاق</button>
  </div>
</div>

<div class="voucher-wrapper">
  <div class="voucher-container">
    <div>
      <!-- 1. الترويسة الديناميكية -->
      <div class="header" id="invoiceHeader">
        <div class="header-right">
          <h2 id="settingCompanyName">${companyName}</h2>
          <p id="settingCompanyAddress">📍 ${companyAddress}</p>
        </div>
        <div class="header-center">
          <img id="settingCompanyLogo" class="logo-img" src="${logoUrl}" alt="شعار المؤسسة" style="${showLogo ? 'display:block;' : 'display:none;'}">
        </div>
        <div class="header-left">
          <ul class="phones-list" id="settingPhonesList">
            ${phones.map((p) => `<li>📞 ${p}</li>`).join('')}
          </ul>
        </div>
      </div>

      <!-- 2. صندوق البيانات الديناميكي -->
      <div class="info-box">
        <div class="info-item" style="text-align: right;">
          <p><strong>${isReceive ? 'استلمنا من السيد / السادة:' : 'اصرفوا للسيد / السادة:'}</strong> <span>${partyName}</span></p>
          <p><strong>${isReceive ? 'كود العميل / الحساب:' : 'جهة الصرف / الحساب:'}</strong> <span>${partyId || '-'}</span></p>
        </div>
        <div class="info-item" style="text-align: center;">
          <p><strong style="font-size: 1.05rem; color: ${isReceive ? '#166534' : '#991b1b'};">${isReceive ? 'سنــــد قبـــض' : 'سنــــد صـــرف'}</strong></p>
          <p><strong>رقم السند: #${serialNo}</strong></p>
        </div>
        <div class="info-item" style="text-align: left;">
          <p><strong>التاريخ:</strong> <span>${dateStr}</span></p>
          <p><strong>الوقت:</strong> <span>${timeStr}</span></p>
        </div>
      </div>

      <!-- 3. محتوى السند التفصيلي -->
      <div class="voucher-body">
        <div class="voucher-row" style="justify-content: space-between;">
          <div>
            <strong>${isReceive ? 'المبلغ المقبوض:' : 'المبلغ المنصرف:'} </strong>
            <span class="amount-highlight"><span>${(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> ${currency}</span>
          </div>
          <div>
            <strong>وسيلة الدفع: </strong>
            <span style="font-weight: bold; border: 1.5px solid #000; padding: 3px 10px; background: #fafafa;">${paymentMethod}</span>
          </div>
        </div>

        <div class="voucher-row">
          <strong>مبلغا وقدره (تفقيط):</strong>
          <div class="dots-line">${amountText}</div>
        </div>

        <div class="voucher-row">
          <strong>وذلك قيمة / مقابل:</strong>
          <div class="dots-line">${reason}</div>
        </div>

        <div class="voucher-row">
          <strong>${isReceive ? 'الخزينة / الحساب المحول إليه:' : 'خصماً من خزينة / حساب:'}</strong>
          <div class="dots-line">${accountName}</div>
        </div>
      </div>

      <!-- 4. التوقيعات الديناميكية -->
      <div class="bottom-section">
        <div>${isReceive ? 'توقيع القابض (العميل): ....................' : 'توقيع المستلم (المستفيد): ....................'}</div>
        <div>أمين الخزينة / الصراف: ....................</div>
        <div>اعتماد الحسابات / الإدارة: ....................</div>
      </div>
    </div>

    <div>
      <div class="voucher-footer-note">
        <div>${isReceive ? 'يعتبر هذا السند إشعاراً رسمياً بالتحصيل ولا يحتاج لختم إضافي إلا في الحالات الخاصة' : 'تم صرف المبلغ بناءً على الدورة المستندية والاعتمادات المالية المقررة'}</div>
        <div>صفحة رقم: 1/1</div>
      </div>
    </div>
  </div>

  <!-- حقوق الملكية خارج الإطار الخارجي -->
  <div class="copyright-outside">
    حقوق الملكية محفوظة Mohamed Nazih 01029190615
  </div>
</div>

<script>
  function setCompanyHeader(companyData) {
    if (!companyData) return;
    const header = document.getElementById('invoiceHeader');
    if (!header) return;
    let hasData = false;
    if (companyData.name || companyData.address || companyData.companyName) {
      const nameEl = document.getElementById('settingCompanyName');
      const addrEl = document.getElementById('settingCompanyAddress');
      if (nameEl) nameEl.innerText = companyData.companyName || companyData.name || '';
      if (addrEl) addrEl.innerText = companyData.address ? '📍 ' + companyData.address : '';
      hasData = true;
    }
    const logoEl = document.getElementById('settingCompanyLogo');
    const logoSrc = companyData.logoUrl || companyData.logo || '';
    if (logoEl && logoSrc && companyData.showLogoInPrint !== false) {
      logoEl.src = logoSrc;
      logoEl.style.display = 'block';
      hasData = true;
    } else if (logoEl) {
      logoEl.style.display = 'none';
    }

    const phonesList = document.getElementById('settingPhonesList');
    if (phonesList) {
      const phoneArr = companyData.phones || [companyData.phone1, companyData.phone2, companyData.phone3].filter(Boolean);
      phonesList.innerHTML = '';
      if (phoneArr && phoneArr.length > 0) {
        phoneArr.slice(0, 3).forEach((phone) => {
          if (phone) {
            const li = document.createElement('li');
            li.innerText = '📞 ' + phone;
            phonesList.appendChild(li);
          }
        });
        hasData = true;
      }
    }
  }

  function updatePrintLayout() {
    const sizeEl = document.getElementById('selPaperSize');
    const orientEl = document.getElementById('selOrientation');
    const marginEl = document.getElementById('selMargins');

    const size = sizeEl ? sizeEl.value : 'A4';
    const orient = orientEl ? orientEl.value : 'portrait';
    const marginType = marginEl ? marginEl.value : 'normal';

    let marginVal = '5mm 7mm';
    if (marginType === 'compact') marginVal = '3mm 4mm';
    if (marginType === 'wide') marginVal = '7mm 9mm';

    let styleEl = document.getElementById('dynamicPageStyle');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'dynamicPageStyle';
      document.head.appendChild(styleEl);
    }

    styleEl.innerHTML = '@page { size: ' + size + ' ' + orient + '; margin: ' + marginVal + '; }';

    document.body.classList.remove('size-a4', 'size-a5', 'size-letter', 'orient-portrait', 'orient-landscape');
    document.body.classList.add('size-' + size.toLowerCase(), 'orient-' + orient);

    try {
      localStorage.setItem('sys_print_pref_size', size);
      localStorage.setItem('sys_print_pref_orient', orient);
      localStorage.setItem('sys_print_pref_margin', marginType);
    } catch(e) {}
  }

  function triggerPrint() {
    updatePrintLayout();
    window.print();
  }

  window.addEventListener('DOMContentLoaded', () => {
    try {
      const savedSize = localStorage.getItem('sys_print_pref_size');
      const savedOrient = localStorage.getItem('sys_print_pref_orient');
      const savedMargin = localStorage.getItem('sys_print_pref_margin');
      if (savedSize && document.getElementById('selPaperSize')) {
        document.getElementById('selPaperSize').value = savedSize;
      }
      if (savedOrient && document.getElementById('selOrientation')) {
        document.getElementById('selOrientation').value = savedOrient;
      }
      if (savedMargin && document.getElementById('selMargins')) {
        document.getElementById('selMargins').value = savedMargin;
      }
    } catch(e) {}
    updatePrintLayout();
  });
</script>
</body>
</html>`;
}

export function printCashVoucherWindow(
  trans: CashTransaction | UnifiedVoucherData,
  appDataOrSettings: AppData | Settings,
  showToast?: (msg: string, type: 'warning' | 'error' | 'success' | 'info') => void
) {
  const printWin = window.open('', '_blank', 'width=850,height=900');
  if (!printWin) {
    if (showToast) {
      showToast('يرجى السماح بالنوافذ المنبثقة للطباعة', 'warning');
    } else {
      alert('يرجى السماح بالنوافذ المنبثقة للطباعة');
    }
    return;
  }

  const html = generateCashVoucherPrintHtml(trans, appDataOrSettings);
  printWin.document.open();
  printWin.document.write(html);
  printWin.document.close();
}
