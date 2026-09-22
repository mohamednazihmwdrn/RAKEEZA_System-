import { SaleInvoice, PurchaseInvoice, Settings } from '../types';

export function generateInvoicePrintHtml(
  inv: SaleInvoice | PurchaseInvoice,
  isSales: boolean,
  settings: Settings
): string {
  const isSaleInv = isSales;
  const partyLabel = isSaleInv ? 'اسم العميل' : 'اسم المورد';
  const partyIdLabel = isSaleInv ? 'رقم العميل / الهاتف' : 'رقم المورد / الهاتف';
  const partyName = isSaleInv
    ? (inv as SaleInvoice).customerName || 'عميل نقدي'
    : (inv as PurchaseInvoice).supplierName || 'مورد عام';
  const partyPhone = inv.phone || (inv as any).customerId || (inv as any).supplierId || '-';

  const companyPhone1 = settings.phone1 || '01029190615';
  const companyPhone2 = settings.phone2 || '';
  const companyPhone3 = settings.phone3 || '';

  const companyName = settings.companyName || 'RAKEEZA';
  const companyAddress = settings.address || 'جمهورية مصر العربية';
  const logoUrl = (settings as any).logo || (settings as any).logoUrl || '';

  const invoiceNumber = `${inv.id}`;
  const invoiceDate = inv.date || new Date().toISOString().split('T')[0];
  const invoiceTime =
    inv.time ||
    new Date().toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
    });

  // Invoice type title
  let invoiceTypeTitle = 'فاتورة مبيعات';
  if (inv.type === 'nagdi') {
    invoiceTypeTitle = isSaleInv ? 'مبيعات نقدية' : 'مشتريات نقدية';
  } else if (inv.type === 'ajel') {
    invoiceTypeTitle = isSaleInv ? 'مبيعات آجلة' : 'مشتريات آجلة';
  } else if (inv.type === 'return_nagdi') {
    invoiceTypeTitle = isSaleInv ? 'مرتجع مبيعات نقدي' : 'مرتجع مشتريات نقدي';
  } else if (inv.type === 'return_ajel') {
    invoiceTypeTitle = isSaleInv ? 'مرتجع مبيعات آجل' : 'مرتجع مشتريات آجل';
  }

  // Payment method label
  let paymentMethodType = 'نقدي (الدرج)';
  if (inv.paymentMethod === 'drawer') {
    paymentMethodType = 'نقدي (الدرج)';
  } else if (inv.paymentMethod === 'vodafone') {
    paymentMethodType = 'فودافون كاش';
  } else if (inv.paymentMethod === 'instapay') {
    paymentMethodType = 'إنستاباي (InstaPay)';
  } else if (inv.paymentMethod === 'bank') {
    paymentMethodType = 'تحويل بنكي';
  } else if (inv.paymentMethod) {
    paymentMethodType = inv.paymentMethod;
  }

  const items = inv.items || [];
  const subtotal =
    inv.subtotal !== undefined
      ? inv.subtotal
      : items.reduce((s, i) => s + (i.total || i.qty * i.price), 0);
  const discountVal = inv.discount || 0;
  const taxVal = inv.tax || 0;
  const feesName = (inv as any).feeDescription || (inv.fees ? 'نقل / مصاريف' : 'رسوم');
  const feesVal = inv.fees || 0;
  const extraRevenueName = (inv as any).extraRevenueName || 'إيرادات إضافية';
  const extraRevenueVal = (inv as any).extraRevenueAmount || 0;
  const grandTotal = inv.total;

  let paidAmount = inv.paidAmount;
  let remainingAmount = inv.remainingAmount;
  if (paidAmount === undefined) {
    if (inv.type === 'nagdi' || inv.type === 'return_nagdi') {
      paidAmount = grandTotal;
      remainingAmount = 0;
    } else {
      paidAmount = 0;
      remainingAmount = grandTotal;
    }
  }
  if (remainingAmount === undefined) {
    remainingAmount = Math.max(0, grandTotal - (paidAmount || 0));
  }

  // Calculate item-level and invoice-level aggregated financial values
  let itemsBaseSubtotal = 0;
  let totalItemDiscounts = 0;
  let totalItemTaxes = 0;

  items.forEach((item) => {
    const base = (item.qty || 0) * (item.price || 0);
    itemsBaseSubtotal += base;

    let itemDisc = 0;
    if ((item as any).discountType === 'percent') {
      const p = (item as any).discountValue !== undefined ? (item as any).discountValue : item.discount || 0;
      itemDisc = (base * p) / 100;
    } else if ((item as any).discountType === 'fixed') {
      itemDisc = (item as any).discountValue !== undefined ? (item as any).discountValue : item.discount || 0;
    } else if (typeof item.discount === 'number' && item.discount > 0) {
      itemDisc = item.discount;
    }
    totalItemDiscounts += itemDisc;

    let itemTax = 0;
    const afterDisc = Math.max(0, base - itemDisc);
    if ((item as any).taxType === 'percent') {
      const tp = (item as any).taxValue !== undefined ? (item as any).taxValue : item.tax || 0;
      itemTax = (afterDisc * tp) / 100;
    } else if ((item as any).taxType === 'fixed') {
      itemTax = (item as any).taxValue !== undefined ? (item as any).taxValue : item.tax || 0;
    } else if (typeof item.tax === 'number' && item.tax > 0) {
      itemTax = item.tax;
    }
    totalItemTaxes += itemTax;
  });

  const invoiceDiscountAmount = typeof discountVal === 'number' && discountVal > 0 ? (itemsBaseSubtotal * discountVal) / 100 : 0;
  const totalDiscount = totalItemDiscounts + invoiceDiscountAmount;

  const invoiceTaxAmount = typeof taxVal === 'number' && taxVal > 0 ? (Math.max(0, itemsBaseSubtotal - totalDiscount) * taxVal) / 100 : 0;
  const totalTax = totalItemTaxes + invoiceTaxAmount;

  // Render Table Rows (Exact 5 columns: اسم الصنف, البيان, العدد, السعر, الإجمالي)
  const itemsRowsHtml =
    items.length === 0
      ? `<tr><td colspan="5" style="color: #888; padding: 6px; text-align: center;">لا توجد أصناف في هذه الفاتورة</td></tr>`
      : items
          .map((item) => {
            const itemDesc = item.notes || (item as any).statement || '-';
            const itemLineTotal = item.total !== undefined ? item.total : (item.qty * item.price);
            return `
          <tr>
            <td style="text-align: right; padding-right: 6px; font-weight: 600;">${item.name || ''}</td>
            <td style="text-align: right; padding-right: 6px; color: #333;">${itemDesc}</td>
            <td style="font-weight: 600; text-align: center;">${item.qty}</td>
            <td style="text-align: center;">${parseFloat(item.price.toString()).toFixed(2)}</td>
            <td style="font-weight: bold; text-align: center;">${parseFloat(itemLineTotal.toString()).toFixed(2)}</td>
          </tr>
        `;
          })
          .join('');

  const paperSize = (settings as any).paperSize || 'A4';
  const pageMargin = (settings as any).pageMargin !== undefined ? (settings as any).pageMargin : 5;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${invoiceTypeTitle} #${invoiceNumber}</title>
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
    margin: 0; 
    padding: 0; 
    color: #000;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .no-print-bar {
    width: 100%;
    margin: 0 0 10px 0;
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    background: #0f172a;
    color: #fff;
    padding: 8px 16px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    position: sticky;
    top: 0;
    z-index: 9999;
    font-size: 0.85rem;
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
    background: #1e293b;
    color: #fff;
    border: 1px solid #475569;
    padding: 5px 9px;
    border-radius: 6px;
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
    cursor: pointer;
    font-weight: bold;
    font-size: 13px;
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

  /* الحاوية الخارجية الكاملة للطباعة - ورقة واحدة متماسكة */
  .invoice-full-wrapper {
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    height: 100%;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
    page-break-after: avoid !important;
  }

  /* الحاوية الرئيسية للفاتورة داخل الإطار */
  .invoice-container, .report-container { 
    background: #fff; 
    width: 100vw;
    height: 100vh;
    min-height: 98vh;
    max-width: 100%;
    margin: 0 auto; 
    padding: 5mm 6mm; 
    border: 3px solid #000; 
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }

  /* 1. الترويسة الديناميكية */
  .header { 
    display: flex; 
    justify-content: space-between; 
    align-items: center; 
    border-bottom: 2px solid #000; 
    padding-bottom: 3px; 
    margin-bottom: 5px;
    width: 100%;
  }

  .header-right h2 { margin: 0 0 1px 0; font-size: 1.1rem; font-weight: bold; }
  .header-right p { margin: 0; font-size: 0.72rem; color: #333; }

  /* مكان اللوجو / الشعار في منتصف الترويسة */
  .header-center {
    display: flex;
    justify-content: center;
    align-items: center;
    min-width: 70px;
  }

  .logo-img { 
    max-width: 80px; 
    max-height: 48px; 
    object-fit: contain;
  }

  .phones-list { 
    list-style: none; 
    padding: 0; 
    margin: 0; 
    font-size: 0.72rem; 
    direction: ltr; 
    text-align: left;
  }
  .phones-list li { margin-bottom: 1px; font-weight: 600; }

  /* 2. مستطيل البيانات المنكمش */
  .info-box { 
    display: flex; 
    justify-content: space-between; 
    align-items: center;
    border: 1.5px solid #000; 
    padding: 3px 6px; 
    margin-bottom: 5px; 
    font-size: 0.75rem;
    line-height: 1.25;
    width: 100%;
    background-color: #fafafa;
  }
  .info-item p { margin: 1px 0; }

  /* 3. جدول الأصناف */
  .table-wrapper {
    width: 100%;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    margin-bottom: 4px;
  }

  table { 
    width: 100%; 
    border-collapse: collapse; 
    margin-bottom: 4px; 
  }
  
  th, td { 
    border: 1px solid #000; 
    padding: 2.5px 4px; 
    text-align: center; 
    font-size: 0.75rem;
  }
  
  th { 
    background-color: #ededed; 
    font-weight: bold; 
    font-size: 0.74rem; 
    padding: 3px 2px;
  }

  /* 4. الحسابات والملخص */
  .bottom-section {
    display: flex;
    justify-content: flex-end;
    margin-top: 3px;
    margin-bottom: 4px;
    width: 100%;
  }

  .summary-vertical-list {
    width: 230px;
    display: flex;
    flex-direction: column;
    gap: 1.5px;
    font-size: 0.78rem;
    font-weight: bold;
    text-align: left;
  }

  .summary-line {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1px 0;
  }

  .summary-line.total-line {
    border-top: 1.5px solid #000;
    margin-top: 1px;
    padding-top: 2px;
    font-size: 0.88rem;
  }

  /* 5. تذييل داخل الفاتورة */
  .invoice-footer-note {
    border-top: 1.5px solid #000;
    padding-top: 3px;
    margin-top: auto; 
    display: flex;
    justify-content: space-between;
    font-size: 0.7rem;
    font-weight: 600;
    width: 100%;
  }

  /* 6. حقوق الملكية خارج الإطار الخارجي */
  .copyright-outside {
    width: 100%;
    text-align: center;
    font-size: 0.72rem;
    font-weight: bold;
    color: #000;
    margin-top: auto;
    padding: 2px 0 0 0;
    direction: rtl;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }

  /* تخصيص طباعة A5 */
  body.size-a5 @page {
    size: A5 portrait;
    margin: 3mm 4mm 2mm 4mm;
  }
  body.size-a5 .invoice-container, body.size-a5 .report-container {
    padding: 3mm 4mm;
  }
  body.size-a5 .header-right h2 { font-size: 0.95rem; }
  body.size-a5 .header-right p, body.size-a5 .phones-list { font-size: 0.65rem; }
  body.size-a5 .info-box { font-size: 0.68rem; padding: 2px 4px; }
  body.size-a5 th, body.size-a5 td { font-size: 0.68rem; padding: 2px 3px; }
  body.size-a5 .summary-vertical-list { font-size: 0.7rem; width: 200px; }
  body.size-a5 .summary-line.total-line { font-size: 0.8rem; }
  body.size-a5 .invoice-footer-note { font-size: 0.63rem; }
  body.size-a5 .copyright-outside { font-size: 0.62rem; }

  /* Thermal 80mm & 58mm POS styles */
  body.size-80mm {
    font-size: 0.72rem;
    background: #fff;
    padding: 0;
  }
  body.size-80mm .invoice-full-wrapper {
    max-width: 80mm !important;
    width: 80mm !important;
  }
  body.size-80mm .invoice-container, body.size-80mm .report-container {
    width: 76mm !important;
    min-height: auto !important;
    height: auto !important;
    border: none !important;
    padding: 2mm !important;
    margin: 0 auto;
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
    flex-direction: column;
    text-align: center;
    border: 1px dashed #000;
  }
  body.size-80mm th, body.size-80mm td {
    padding: 2px 3px;
    font-size: 0.68rem;
  }
  body.size-80mm .summary-wrapper {
    flex-direction: column;
  }
  body.size-80mm .summary-vertical-list {
    width: 100%;
  }

  body.size-58mm {
    font-size: 0.65rem;
    background: #fff;
    padding: 0;
  }
  body.size-58mm .invoice-full-wrapper {
    max-width: 58mm !important;
    width: 58mm !important;
  }
  body.size-58mm .invoice-container, body.size-58mm .report-container {
    width: 54mm !important;
    min-height: auto !important;
    height: auto !important;
    border: none !important;
    padding: 1.5mm !important;
    margin: 0 auto;
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
    flex-direction: column;
    text-align: center;
    border: 1px dashed #000;
  }
  body.size-58mm th, body.size-58mm td {
    padding: 1.5px 2px;
    font-size: 0.6rem;
  }
  body.size-58mm .summary-wrapper {
    flex-direction: column;
  }
  body.size-58mm .summary-vertical-list {
    width: 100%;
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
    
    .invoice-full-wrapper {
      max-width: 100% !important;
      width: 100% !important;
      height: 100% !important;
      display: flex !important;
      flex-direction: column !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      page-break-after: avoid !important;
      page-break-before: avoid !important;
      margin: 0 !important;
    }

    .invoice-container, .report-container { 
      border: 3px solid #000 !important; 
      width: 100vw !important; 
      height: calc(100vh - 20px) !important;
      min-height: calc(100vh - 20px) !important;
      max-height: calc(100vh - 20px) !important;
      padding: 4mm 5mm !important;
      box-sizing: border-box !important;
      box-shadow: none !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      page-break-after: avoid !important;
    }

    .table-wrapper {
      flex-grow: 1 !important;
      display: flex !important;
      flex-direction: column !important;
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

    .no-print, .no-print-bar { 
      display: none !important; 
    }
  }
</style>
</head>
<body>

<div class="no-print-bar">
  <div class="toolbar-title-box">
    <span class="title-text">🖨️ معاينة وتخصيص الطباعة</span>
    <span class="doc-badge">${invoiceTypeTitle} #${invoiceNumber}</span>
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

<div class="invoice-full-wrapper">
  <div class="invoice-container">
    <div>
      <!-- الترويسة -->
      <div class="header" id="invoiceHeader">
        <div class="header-right">
          <h2 id="settingCompanyName">${companyName}</h2>
          <p id="settingCompanyAddress">${companyAddress}</p>
        </div>
        
        <!-- اللوجو / الشعار في المنتصف -->
        <div class="header-center">
          ${logoUrl ? `<img id="settingCompanyLogo" class="logo-img" src="${logoUrl}" alt="الشعار" />` : ''}
        </div>
        
        <div class="header-left">
          <ul class="phones-list" id="settingPhonesList">
            ${companyPhone1 ? `<li>${companyPhone1}</li>` : ''}
            ${companyPhone2 ? `<li>${companyPhone2}</li>` : ''}
            ${companyPhone3 ? `<li>${companyPhone3}</li>` : ''}
          </ul>
        </div>
      </div>

      <!-- صندوق البيانات -->
      <div class="info-box">
        <!-- أعلى اليمين -->
        <div class="info-item" style="text-align: right;">
          <p><strong>${partyLabel}:</strong> <span id="lblClientName">${partyName}</span></p>
          <p><strong>${partyIdLabel}:</strong> <span id="lblClientId">${partyPhone}</span></p>
          ${
            (inv as any).customerRepName
              ? `<p style="color: #1a237e; font-weight: bold;"><strong>المندوب المفوض / المستلم:</strong> <span>${(inv as any).customerRepName}</span> ${(inv as any).customerRepPhone ? `<span style="direction: ltr; display: inline-block;">(${ (inv as any).customerRepPhone })</span>` : ''}</p>`
              : (inv as any).supplierRepName
              ? `<p style="color: #1a237e; font-weight: bold;"><strong>مندوب التوريد / الشركة:</strong> <span>${(inv as any).supplierRepName}</span> ${(inv as any).supplierRepPhone ? `<span style="direction: ltr; display: inline-block;">(${ (inv as any).supplierRepPhone })</span>` : ''}</p>`
              : ''
          }
        </div>
        
        <!-- المنتصف -->
        <div class="info-item" style="text-align: center;">
          <p>
            <strong id="lblInvoiceType">${invoiceTypeTitle}</strong> - 
            <strong style="font-size: 0.95rem;">#<span id="lblSerialNo">${invoiceNumber}</span></strong>
          </p>
          <p><strong>وسيلة الدفع:</strong> <span id="lblPaymentMethod">${paymentMethodType}</span></p>
          ${inv.salesRep ? `<p><strong>مندوب المبيعات:</strong> <span>${inv.salesRep}</span></p>` : ''}
        </div>
        
        <!-- أعلى اليسار -->
        <div class="info-item" style="text-align: left;">
          <p><strong>التاريخ:</strong> <span id="lblInvoiceDate">${invoiceDate}</span></p>
          <p><strong>الوقت:</strong> <span id="lblInvoiceTime">${invoiceTime}</span></p>
          ${(inv as any).createdBy || (inv as any).userName ? `<p><strong>المستخدم:</strong> <span>${(inv as any).createdBy || (inv as any).userName}</span></p>` : ''}
        </div>
      </div>

      ${inv.notes ? `<div style="font-size: 0.72rem; background: #eef2f5; border: 1px solid #ccc; padding: 2px 5px; margin-bottom: 4px; border-radius: 2px;"><strong>📝 ملاحظات:</strong> ${inv.notes}</div>` : ''}

      <!-- جدول الأصناف (5 أعمدة محددة: اسم الصنف، البيان، العدد، السعر، الإجمالي) -->
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th style="width: 32%; text-align: right; padding-right: 6px;">اسم الصنف</th>
              <th style="width: 28%; text-align: right; padding-right: 6px;">البيان</th>
              <th style="width: 12%; text-align: center;">العدد</th>
              <th style="width: 13%; text-align: center;">السعر</th>
              <th style="width: 15%; text-align: center;">الإجمالي</th>
            </tr>
          </thead>
          <tbody id="invoiceTable">
            ${itemsRowsHtml}
          </tbody>
        </table>
      </div>

      <!-- الحسابات والملخص (تسمع الخصومات والضرائب المضافة على الأصناف هنا تحت البيانات) -->
      <div class="bottom-section">
        <div class="summary-vertical-list">
          <div class="summary-line">
            <span>إجمالي قيمة الأصناف:</span>
            <span>${itemsBaseSubtotal.toFixed(2)} ج.م</span>
          </div>
          ${totalDiscount > 0 ? `
          <div class="summary-line" id="row-discount" style="color: #2e7d32;">
            <span id="lbl-discount">إجمالي الخصم:</span>
            <span id="val-discount">-${totalDiscount.toFixed(2)} ج.م</span>
          </div>` : ''}
          ${totalTax > 0 ? `
          <div class="summary-line" id="row-tax" style="color: #312e81;">
            <span id="lbl-tax">إجمالي الضريبة:</span>
            <span id="val-tax">+${totalTax.toFixed(2)} ج.م</span>
          </div>` : ''}
          ${extraRevenueVal > 0 ? `
          <div class="summary-line" id="row-extra-revenue" style="color: #047857; font-weight: bold;">
            <span id="lbl-extra-revenue">➕ ${extraRevenueName}:</span>
            <span id="val-extra-revenue">+${extraRevenueVal.toFixed(2)} ج.م</span>
          </div>` : ''}
          <div class="summary-line total-line" id="row-total">
            <span>صافي القيمة / الإجمالي:</span>
            <span id="val-total">${grandTotal.toFixed(2)} ج.م</span>
          </div>
          <div class="summary-line" id="row-paid">
            <span>المبلغ المدفوع:</span>
            <span id="val-paid">${paidAmount.toFixed(2)} ج.م</span>
          </div>
          ${remainingAmount > 0 ? `
          <div class="summary-line" id="row-remaining" style="color: #b71c1c;">
            <span>المبلغ المتبقي:</span>
            <span id="val-remaining">${remainingAmount.toFixed(2)} ج.م</span>
          </div>` : ''}
        </div>
      </div>
    </div>

    <div>
      <div class="invoice-footer-note">
        <div>البضاعة المباعة ترجع وتستبدل خلال 14 يوماً بأصل الفاتورة</div>
        <div>صفحة رقم: 1/1</div>
      </div>
    </div>
  </div>

  <!-- حقوق الملكية خارج الإطار الخارجي تماماً - متماسكة في نفس الصفحة -->
  <div class="copyright-outside">
    حقوق الملكية محفوظة لدي المطور Mohamed Nazih تواصل 01029190615
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
      if (addrEl) addrEl.innerText = companyData.address || '';
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
            li.innerText = phone;
            phonesList.appendChild(li);
          }
        });
        hasData = true;
      }
    }
    if (!hasData) header.classList.add('is-empty');
    else header.classList.remove('is-empty');
  }

  function updatePrintLayout() {
    const sizeEl = document.getElementById('selPaperSize');
    const orientEl = document.getElementById('selOrientation');
    const marginEl = document.getElementById('selMargins');

    const size = sizeEl ? sizeEl.value : 'A4';
    const orient = orientEl ? orientEl.value : 'portrait';
    const marginType = marginEl ? marginEl.value : 'normal';

    let marginVal = '4mm 5mm 3mm 5mm';
    if (marginType === 'compact') marginVal = '2mm 3mm 2mm 3mm';
    if (marginType === 'wide') marginVal = '6mm 8mm 5mm 8mm';

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

export function printInvoiceWindow(
  inv: SaleInvoice | PurchaseInvoice,
  isSales: boolean,
  settings: Settings,
  showToast?: (msg: string, type: 'warning' | 'error' | 'success' | 'info') => void,
  preferredPaperSize?: 'A4' | 'A5' | '80mm' | '58mm'
) {
  if (preferredPaperSize && typeof window !== 'undefined') {
    try {
      localStorage.setItem('sys_print_pref_size', preferredPaperSize);
    } catch {}
  }
  const html = generateInvoicePrintHtml(inv, isSales, settings);
  let printWin: Window | null = null;
  try {
    printWin = window.open('', '_blank', 'width=900,height=950');
  } catch (e) {
    printWin = null;
  }

  if (printWin) {
    try {
      printWin.document.open();
      printWin.document.write(html);
      printWin.document.close();
      return;
    } catch {
      // If writing to window fails, fall back to iframe
    }
  }

  // Fallback: Invisible iframe printing for iframe/sandboxed environments
  try {
    let iframe = document.getElementById('rakeeza-invoice-print-frame') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'rakeeza-invoice-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);
    }
    const frameDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (frameDoc) {
      frameDoc.open();
      frameDoc.write(html);
      frameDoc.close();
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          if (showToast) {
            showToast('تم إرسال أمر الطباعة بنجاح', 'success');
          }
        } catch (err) {
          console.error('Iframe print error:', err);
        }
      }, 500);
      return;
    }
  } catch (err) {
    console.error('Fallback printing error:', err);
  }

  if (showToast) {
    showToast('يرجى السماح بالنوافذ المنبثقة لمعاينة الفاتورة', 'warning');
  }
}
