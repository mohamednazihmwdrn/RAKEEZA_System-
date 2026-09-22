import { Quotation, AppData, Settings, Item } from '../types';
import { tafqeetArabic } from './tafqeet';

export function generateQuotationPrintHtml(
  quotation: Quotation,
  appData: AppData,
  customSettings?: Settings
): string {
  const settings: Settings = customSettings || appData.settings || {
    companyName: 'RAKEEZA',
    address: 'جمهورية مصر العربية',
    phone1: '',
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

  const isSaleQuote = quotation.type === 'sale_quote';
  const docTitleAr = isSaleQuote ? 'عرض سعر رسمي (Quotation)' : 'أمر شراء توريد (Purchase Order)';
  const docTypeBadge = isSaleQuote ? 'عرض سعر (Quotation)' : 'أمر شراء (Purchase Order)';
  const partyTitle = isSaleQuote ? 'العميل / الشركة:' : 'المورد / الشركة:';
  const partyName = quotation.clientName || 'العميل الكريم';
  const docNumber = isSaleQuote ? `QUO-${String(quotation.id).padStart(4, '0')}` : `PO-${String(quotation.id).padStart(4, '0')}`;
  const createdBy = quotation.createdBy || 'إدارة المبيعات';
  const docDate = quotation.date || new Date().toISOString().split('T')[0];
  const validUntilDate = quotation.validUntil || 'حسب الاتفاق المبرم';

  const companyName = settings.companyName || 'RAKEEZA';
  const companyAddress = settings.address || 'الفرع الرئيسي - ش المعهد الديني';
  const logoUrl = settings.logo || (settings as any).logoUrl || '';
  const showLogo = Boolean(settings.showLogoInPrint !== false && logoUrl);

  const phones: string[] = [settings.phone1, settings.phone2, settings.phone3].filter(Boolean) as string[];
  if (phones.length === 0) {
    phones.push('01029190615');
  }

  // Calculate items, codes, units, totals
  let totalQty = 0;
  let subtotal = 0;

  const itemsRows = (quotation.items || []).map((item, idx) => {
    // Find matching catalog item for extra metadata like code, unit, barcode
    const catalogItem: Item | undefined = appData.items?.find(
      (i) => i.id === item.itemId || i.name.trim().toLowerCase() === item.name.trim().toLowerCase()
    );

    const itemCode = catalogItem?.code || catalogItem?.barcode || (item.itemId ? `ITM-${item.itemId}` : `ITM-${idx + 101}`);
    const unit = catalogItem?.unit || 'قطعة';
    const qty = item.qty || 1;
    const price = item.price || 0;
    const lineTotal = item.total !== undefined ? item.total : qty * price;

    totalQty += qty;
    subtotal += lineTotal;

    return {
      index: idx + 1,
      code: itemCode,
      name: item.name,
      notes: item.notes,
      unit,
      qty,
      price,
      total: lineTotal,
    };
  });

  const discount = quotation.discount || 0;
  const amountAfterDiscount = Math.max(0, subtotal - discount);
  const taxRate = quotation.tax || 0;
  const taxAmount = taxRate > 0 ? (amountAfterDiscount * taxRate) / 100 : 0;
  const fees = (quotation as any).fees || 0;
  const feeDesc = (quotation as any).feeDescription || 'مصاريف نقل وشحن إضافية';
  const grandTotal = quotation.total || (amountAfterDiscount + taxAmount + fees);

  const tafqeetText = tafqeetArabic(grandTotal, {
    currency: settings.currencySymbol === 'ج.م' ? 'جنيه مصري' : (settings.currencySymbol || 'جنيه مصري'),
    fractionName: 'قرش',
    prefix: 'فقط',
    suffix: 'لا غير',
  });

  // Terms and Notes
  const termsList: string[] = [];
  if (quotation.notes && quotation.notes.trim()) {
    // Split notes by newline if multiple
    quotation.notes.split('\n').forEach((n) => {
      if (n.trim()) termsList.push(n.trim());
    });
  }

  if (termsList.length === 0) {
    if (isSaleQuote) {
      termsList.push('طريقة الدفع: حسب الاتفاق المبرم والشروط المالية المعتمدة.');
      termsList.push('الأسعار سارية ومضمونة حتى تاريخ انتهاء صلاحية العرض الموضح أعلاه.');
      termsList.push('مدة التوريد والتسليم: فوراً من تاريخ التعميد وتأكيد الطلبية.');
      termsList.push('ملاحظة: السعر غير شامل أي مصاريف شحن أو تركيب خاصة خارج النطاق المتفق عليه.');
    } else {
      termsList.push('طريقة السداد: دفعة عند الاستلام والفحص الفني بالمخزن.');
      termsList.push('يجب مطابقة الأصناف للمواصفات القياسية والفحص الظاهري قبل التوريد.');
      termsList.push('يتم إرفاق إذن التسليم والفاتورة الضريبية الأصلية مع الشحنة.');
    }
  }

  const formatNumber = (num: number) =>
    (Number(num) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${docTitleAr} - ${docNumber}</title>
<style>
  @page { size: auto; margin: 0mm; }
  * { 
    box-sizing: border-box; 
    -webkit-print-color-adjust: exact !important; 
    print-color-adjust: exact !important; 
  }
  
  html, body { 
    font-family: 'Segoe UI', Tahoma, Arial, sans-serif; 
    background-color: #f0f2f5; 
    margin: 0; 
    padding: 0; 
    color: #000;
    width: 100%; 
    height: 100%; 
    display: flex; 
    flex-direction: column; 
    align-items: center;
  }

  /* Toolbar */
  .no-print-toolbar {
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

  body.size-a5 { font-size: 0.72rem; }
  body.size-a5 .report-container { padding: 3mm 4mm; min-height: calc(100vh - 12px); }
  body.size-a5 .header-right h2 { font-size: 0.95rem; }
  body.size-a5 .header-right p, body.size-a5 .phones-list { font-size: 0.65rem; }
  body.size-a5 .header-center img { max-height: 38px; }
  body.size-a5 .info-box { padding: 3px 5px; font-size: 0.68rem; }
  body.size-a5 .kpi-card { padding: 2px 4px; }
  body.size-a5 .kpi-card .kpi-title { font-size: 0.65rem; }
  body.size-a5 .kpi-card .kpi-value { font-size: 0.8rem; }
  body.size-a5 table th, body.size-a5 table td { padding: 3px 4px; font-size: 0.68rem; }
  body.size-a5 .summary-box { width: 220px; font-size: 0.75rem; }
  body.size-a5 .report-footer-note { font-size: 0.68rem; padding-top: 2px; }
  body.size-a5 .copyright-outside { font-size: 0.65rem; padding: 1px 0; }

  /* Thermal 80mm & 58mm POS styles */
  body.size-80mm {
    font-size: 0.72rem;
    background: #fff;
    padding: 0;
  }
  body.size-80mm .report-container {
    width: 76mm !important;
    min-height: auto !important;
    height: auto !important;
    border: none !important;
    padding: 2mm !important;
    margin: 0 auto;
    box-shadow: none;
  }
  body.size-80mm .header {
    flex-direction: column;
    text-align: center;
    border-bottom: 1px dashed #000;
  }
  body.size-80mm .header-right, body.size-80mm .header-center, body.size-80mm .header-left {
    width: 100%;
    text-align: center;
  }
  body.size-80mm .info-box {
    display: block;
    width: 100%;
    border: 1px dashed #000;
  }
  body.size-80mm .info-col {
    display: block;
    width: 100%;
    text-align: center !important;
  }
  body.size-80mm .kpi-grid {
    grid-template-columns: 1fr;
    gap: 3px;
  }
  body.size-80mm table th, body.size-80mm table td {
    padding: 2px 3px;
    font-size: 0.68rem;
  }
  body.size-80mm .summary-wrapper {
    flex-direction: column;
    align-items: stretch;
  }
  body.size-80mm .summary-box {
    width: 100% !important;
  }
  body.size-80mm .bottom-section {
    flex-direction: column;
    gap: 4px;
    font-size: 0.68rem;
  }

  body.size-58mm {
    font-size: 0.65rem;
    background: #fff;
    padding: 0;
  }
  body.size-58mm .report-container {
    width: 54mm !important;
    min-height: auto !important;
    height: auto !important;
    border: none !important;
    padding: 1.5mm !important;
    margin: 0 auto;
    box-shadow: none;
  }
  body.size-58mm .header {
    flex-direction: column;
    text-align: center;
    border-bottom: 1px dashed #000;
  }
  body.size-58mm .header-right, body.size-58mm .header-center, body.size-58mm .header-left {
    width: 100%;
    text-align: center;
  }
  body.size-58mm .info-box {
    display: block;
    width: 100%;
    border: 1px dashed #000;
  }
  body.size-58mm .info-col {
    display: block;
    width: 100%;
    text-align: center !important;
  }
  body.size-58mm .kpi-grid {
    grid-template-columns: 1fr;
    gap: 2px;
  }
  body.size-58mm table th, body.size-58mm table td {
    padding: 1.5px 2px;
    font-size: 0.6rem;
  }
  body.size-58mm .summary-wrapper {
    flex-direction: column;
    align-items: stretch;
  }
  body.size-58mm .summary-box {
    width: 100% !important;
  }
  body.size-58mm .bottom-section {
    flex-direction: column;
    gap: 4px;
    font-size: 0.62rem;
  }

  body.orient-landscape .report-container { width: 100vw; height: auto; min-height: calc(100vh - 20px); }

  .report-container { 
    background: #fff; 
    width: 100vw; 
    height: calc(100vh - 25px); 
    max-width: 100%;
    margin: 0 auto; 
    padding: 5mm 7mm; 
    border: 3px solid #000; 
    display: flex; 
    flex-direction: column; 
    justify-content: space-between;
    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  }

  /* 1. الترويسة */
  .header { 
    display: flex; 
    justify-content: space-between; 
    align-items: center; 
    border-bottom: 2px solid #000; 
    padding-bottom: 4px; 
    margin-bottom: 5px; 
    width: 100%; 
  }
  .header-right h2 { margin: 0 0 2px 0; font-size: 1.15rem; font-weight: bold; color: #000; }
  .header-right p { margin: 0; font-size: 0.75rem; color: #333; }
  .header-center { text-align: center; }
  .header-center img { max-height: 48px; object-fit: contain; }
  .phones-list { list-style: none; padding: 0; margin: 0; font-size: 0.75rem; direction: ltr; text-align: left; }
  .phones-list li { margin-bottom: 1px; font-weight: 600; }

  /* 2. صندوق البيانات الأساسية (معدل لمنع الترحيل) */
  .info-box { 
    display: table;
    width: 100%;
    border: 1.5px solid #000; 
    padding: 4px 6px; 
    margin-bottom: 6px; 
    font-size: 0.75rem; 
    line-height: 1.4; 
    background-color: #fafafa;
  }
  .info-col {
    display: table-cell;
    vertical-align: top;
    width: 33.33%;
  }
  .info-item { margin-bottom: 2px; white-space: nowrap; }
  .no-break { display: inline-block; direction: ltr; unicode-bidi: embed; white-space: nowrap; }

  /* 3. كروت المؤشرات (KPIs) */
  .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 6px; }
  .kpi-card { border: 1.5px solid #000; padding: 4px 6px; text-align: center; background-color: #f8f9fa; }
  .kpi-card .kpi-title { font-size: 0.7rem; font-weight: bold; color: #333; }
  .kpi-card .kpi-value { font-size: 0.92rem; font-weight: bold; margin-top: 2px; color: #2563eb; direction: ltr; }

  /* 4. الجدول وملخص المبالغ */
  .table-wrapper { width: 100%; flex-grow: 1; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  th, td { border: 1px solid #000; padding: 5px; text-align: center; font-size: 0.75rem; }
  th { background-color: #ededed; font-weight: bold; font-size: 0.78rem; }

  .amount-cell { direction: ltr; }
  
  .summary-section {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-top: 4px;
    gap: 10px;
  }

  .terms-container {
    flex: 1;
    border: 1.5px solid #000;
    padding: 6px;
    font-size: 0.75rem;
    line-height: 1.4;
    background-color: #fff;
    min-height: 80px;
  }

  .totals-table {
    width: 290px;
    border-collapse: collapse;
  }
  .totals-table td {
    padding: 4px 8px;
    font-size: 0.75rem;
  }
  .totals-table td.title-col {
    text-align: right;
    font-weight: bold;
    background-color: #f8f9fa;
  }
  .totals-table td.val-col {
    text-align: center;
    font-weight: bold;
    direction: ltr;
  }
  .grand-total-row td {
    background-color: #e2e8f0 !important;
    font-size: 0.85rem !important;
    color: #1d4ed8;
  }

  /* 5. التوقيعات والتذييل */
  .bottom-section { 
    display: flex; 
    justify-content: space-between; 
    align-items: flex-end; 
    margin-top: 6px; 
    margin-bottom: 4px; 
    width: 100%; 
    font-size: 0.78rem; 
    font-weight: bold; 
  }
  .report-footer-note { 
    border-top: 1.5px solid #000; 
    padding-top: 3px; 
    margin-top: auto; 
    display: flex; 
    justify-content: space-between; 
    font-size: 0.72rem; 
    font-weight: 600; 
    width: 100%; 
  }
  .copyright-outside { 
    width: 100%; 
    text-align: center; 
    font-size: 0.68rem; 
    font-weight: bold; 
    color: #444; 
    padding: 2px 0; 
    direction: ltr; 
  }

  @media print {
    body { background: none; padding: 0; margin: 0; }
    .no-print-toolbar { display: none !important; }
    .report-container { 
      border: 3px solid #000 !important; 
      width: 100vw !important; 
      height: calc(100vh - 20px) !important; 
      padding: 4mm !important; 
      box-shadow: none; 
    }
  }
</style>
</head>
<body>

<!-- شريط الأدوات العلوي للمعاينة السريعة والطباعة -->
<div class="no-print-toolbar">
  <div class="toolbar-title-box">
    <span class="title-text">🖨️ معاينة وتخصيص الطباعة</span>
    <span class="doc-badge">${docTitleAr} #${docNumber}</span>
  </div>
  <div class="toolbar-controls">
    <div class="toolbar-field">
      <label for="selPaperSize">حجم الورق:</label>
      <select id="selPaperSize" class="toolbar-select" onchange="updatePrintLayout()">
        <option value="A4" selected>A4 (قياسي)</option>
        <option value="A5">A5 (مدمج)</option>
        <option value="80mm">حراري (80mm / Receipt)</option>
        <option value="58mm">حراري (58mm / Mini)</option>
        <option value="Letter">Letter</option>
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

<div class="report-container">
  <div>
    <!-- 1. الترويسة -->
    <div class="header">
      <div class="header-right">
        <h2>${companyName}</h2>
        <p>${companyAddress}</p>
        ${settings.taxNumber ? `<p style="font-size:0.7rem; color:#444;">الرقم الضريبي: <strong>${settings.taxNumber}</strong></p>` : ''}
      </div>
      <div class="header-center">
        ${showLogo ? `<img src="${logoUrl}" alt="Logo" />` : ''}
      </div>
      <div class="header-left">
        <ul class="phones-list">
          ${phones.map((p) => `<li>${p}</li>`).join('')}
        </ul>
      </div>
    </div>

    <!-- 2. صندوق البيانات الخالي من مشكلة الترحيل -->
    <div class="info-box">
      <div class="info-col" style="text-align: right;">
        <div class="info-item"><strong>نوع المستند:</strong> <span style="font-weight:bold; color:#2563eb;">${docTypeBadge}</span></div>
        <div class="info-item"><strong>${partyTitle}</strong> <span id="lblCustomerName" style="font-weight:bold;">${partyName}</span></div>
        ${quotation.phone ? `<div class="info-item"><strong>الهاتف:</strong> <span class="no-break">${quotation.phone}</span></div>` : ''}
      </div>
      <div class="info-col" style="text-align: center;">
        <div class="info-item"><strong>رقم المستند:</strong> <span id="lblQuotationNo" class="no-break" style="font-weight:bold;">${docNumber}</span></div>
        <div class="info-item"><strong>مُعد المستند:</strong> <span id="lblCreatedBy">${createdBy}</span></div>
        <div class="info-item"><strong>حالة المستند:</strong> <span>${quotation.status === 'converted' ? 'مُحول لفاتورة' : 'ساري ونشط'}</span></div>
      </div>
      <div class="info-col" style="text-align: left;">
        <div class="info-item"><strong>التاريخ:</strong> <span id="lblQuotationDate" class="no-break">${docDate}</span></div>
        <div class="info-item"><strong>الصلاحية حتى:</strong> <span id="lblValidUntil" class="no-break" style="color:#dc2626; font-weight:bold;">${validUntilDate}</span></div>
      </div>
    </div>

    <!-- 3. كروت المؤشرات (KPIs) -->
    <div class="kpi-grid" id="kpiGrid">
      <div class="kpi-card">
        <div class="kpi-title">عدد الأصناف المطلوبة</div>
        <div class="kpi-value">${itemsRows.length} صنف</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">إجمالي الكميات</div>
        <div class="kpi-value">${formatNumber(totalQty)}</div>
      </div>
      <div class="kpi-card" style="background-color: #eff6ff; border-color: #2563eb;">
        <div class="kpi-title">الإجمالي النهائي للطلب</div>
        <div class="kpi-value" style="color: #1d4ed8;">${formatNumber(grandTotal)} ${settings.currencySymbol || 'EGP'}</div>
      </div>
    </div>

    <!-- 4. جدول الأصناف -->
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th style="width: 5%;">#</th>
            <th style="width: 17%;">كود الصنف</th>
            <th style="width: 44%; text-align: right;">الوصف / اسم الصنف</th>
            <th style="width: 9%;">الوحدة</th>
            <th style="width: 9%;">الكمية</th>
            <th style="width: 13%;">السعر</th>
            <th style="width: 15%;">الإجمالي</th>
          </tr>
        </thead>
        <tbody id="tableBody">
          ${
            itemsRows.length === 0
              ? `<tr><td colspan="7" style="padding: 10px; color: #888;">لا توجد أصناف مسجلة في هذا المستند</td></tr>`
              : itemsRows
                  .map(
                    (item) => `
            <tr>
              <td>${item.index}</td>
              <td style="font-weight:bold; font-family: monospace;">${item.code}</td>
              <td style="text-align: right; font-weight: bold;">
                ${item.name}
                ${item.notes ? `<div style="font-size: 0.68rem; font-weight: normal; color: #555;">${item.notes}</div>` : ''}
              </td>
              <td>${item.unit}</td>
              <td class="amount-cell" style="font-weight:bold;">${formatNumber(item.qty)}</td>
              <td class="amount-cell">${formatNumber(item.price)}</td>
              <td class="amount-cell" style="font-weight:bold; background-color: #f8f9fa;">${formatNumber(item.total)}</td>
            </tr>
          `
                  )
                  .join('')
          }
        </tbody>
      </table>

      <!-- ملخص المبالغ + الشروط -->
      <div class="summary-section">
        <div class="terms-container">
          <strong>الشروط والأحكام والملحوظات:</strong>
          <div id="termsList" style="margin-top: 3px;">
            <ol style="margin: 0 0 0 15px; padding: 0;">
              ${termsList.map((t) => `<li>${t}</li>`).join('')}
            </ol>
            <div style="margin-top: 6px; font-size: 0.72rem; color: #1e3a8a; font-weight: bold;">
              فقط: ${tafqeetText}
            </div>
          </div>
        </div>

        <table class="totals-table">
          <tr>
            <td class="title-col">المجموع الفرعي:</td>
            <td class="val-col" id="valSubtotal">${formatNumber(subtotal)}</td>
          </tr>
          ${
            discount > 0
              ? `
          <tr id="rowDiscount">
            <td class="title-col" style="color:#dc2626;">الخصم:</td>
            <td class="val-col" style="color:#dc2626;" id="valDiscount">- ${formatNumber(discount)}</td>
          </tr>`
              : ''
          }
          ${
            taxRate > 0
              ? `
          <tr id="rowTax">
            <td class="title-col" id="lblTaxTitle">ضريبة القيمة المضافة (${taxRate}%):</td>
            <td class="val-col" id="valTax">${formatNumber(taxAmount)}</td>
          </tr>`
              : ''
          }
          ${
            fees > 0
              ? `
          <tr id="rowFees">
            <td class="title-col" id="lblFeesTitle">${feeDesc}:</td>
            <td class="val-col" id="valFees">+ ${formatNumber(fees)}</td>
          </tr>`
              : ''
          }
          <tr class="grand-total-row">
            <td class="title-col">الإجمالي النهائي:</td>
            <td class="val-col" id="valGrandTotal">${formatNumber(grandTotal)} ${settings.currencySymbol || 'EGP'}</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- 5. التوقيعات والاعتماد -->
    <div class="bottom-section">
      <div>${isSaleQuote ? 'مسؤول المبيعات' : 'مسؤول المشتريات'}: ....................</div>
      <div>مراجعة الحسابات: ....................</div>
      <div>${isSaleQuote ? 'موافقة واعتماد العميل' : 'موافقة واعتماد المورد'}: ....................</div>
    </div>
  </div>

  <div>
    <div class="report-footer-note">
      <div>* يعتبر هذا العرض ملغياً وغير ملزم للشركة بعد انتهاء مدة الصلاحية المحددة أعلاه</div>
      <div>صفحة رقم: 1/1</div>
    </div>
  </div>
</div>

<div class="copyright-outside">
  حقوق الملكية محفوظة Mohamed Nazih 01029190615
</div>

<script>
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

    if (size === '80mm') {
      styleEl.innerHTML = '@page { size: 80mm auto; margin: 2mm 2mm; }';
    } else if (size === '58mm') {
      styleEl.innerHTML = '@page { size: 58mm auto; margin: 1mm 1mm; }';
    } else {
      styleEl.innerHTML = '@page { size: ' + size + ' ' + orient + '; margin: ' + marginVal + '; }';
    }

    document.body.classList.remove('size-a4', 'size-a5', 'size-letter', 'size-80mm', 'size-58mm', 'orient-portrait', 'orient-landscape');
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

export function printQuotationWindow(
  quotation: Quotation,
  appData: AppData,
  customSettings?: Settings,
  showToast?: (msg: string, type: 'warning' | 'error' | 'success' | 'info') => void
): void {
  const printWin = window.open('', '_blank', 'width=900,height=950');
  if (!printWin) {
    if (showToast) {
      showToast('يرجى السماح بالنوافذ المنبثقة للطباعة', 'warning');
    } else {
      alert('يرجى السماح بالنوافذ المنبثقة للطباعة');
    }
    return;
  }

  const html = generateQuotationPrintHtml(quotation, appData, customSettings);
  printWin.document.open();
  printWin.document.write(html);
  printWin.document.close();
}
