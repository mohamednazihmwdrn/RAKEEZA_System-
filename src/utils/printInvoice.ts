import { SaleInvoice, PurchaseInvoice, Settings } from '../types';
import { openCentralizedInvoicePrint, PaperSize } from '../services/centralizedPrintService';

export function generateInvoicePrintHtml(
  inv: SaleInvoice | PurchaseInvoice,
  isSales: boolean,
  settings: Settings,
  preferredPaperSize: 'A4' | 'A5' | 'thermal' | '80mm' = 'A4'
): string {
  const isSaleInv = isSales;
  const partyLabel = isSaleInv ? 'اسم العميل' : 'اسم المورد';
  const partyIdLabel = isSaleInv ? 'رقم العميل' : 'رقم المورد';
  const partyName = isSaleInv
    ? (inv as SaleInvoice).customerName || 'عميل نقدي'
    : (inv as PurchaseInvoice).supplierName || 'مورد عام';
  const partyPhone = inv.phone || (inv as any).customerId || (inv as any).supplierId || (inv as any).clientSyncId || '-';

  const companyName = settings.companyName || 'شركة ركيزة للحلول البرمجية';
  const companyAddress = settings.address || 'القاهرة - مصر';
  const logoUrl = (settings as any).logo || (settings as any).logoUrl || '';

  const companyPhones = [settings.phone1, settings.phone2, settings.phone3].filter(Boolean) as string[];
  if (companyPhones.length === 0) {
    companyPhones.push('01029190615');
  }

  const invoiceNumber = `${inv.id}`;
  const invoiceDate = inv.date || new Date().toLocaleDateString('ar-EG');
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
  let paymentMethodType = 'نقداً';
  if (inv.paymentMethod === 'drawer') {
    paymentMethodType = 'نقداً (الخزينة)';
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
  const grandTotal = Number(inv.total || 0);
  const feesName = (inv as any).feeDescription || (inv.fees ? 'نقل' : 'مصاريف نقل');
  const feesVal = Number(inv.fees || 0);

  let paidVal = Number(inv.paidAmount);
  let remainingVal = Number(inv.remainingAmount);
  if (isNaN(paidVal)) {
    if (inv.type === 'nagdi' || inv.type === 'return_nagdi') {
      paidVal = grandTotal;
      remainingVal = 0;
    } else {
      paidVal = 0;
      remainingVal = grandTotal;
    }
  }
  if (isNaN(remainingVal)) {
    remainingVal = Math.max(0, grandTotal - paidVal);
  }

  const footerTermsNote =
    settings.invoiceFooterNote ||
    (inv as any).footerNote ||
    'البضاعة المباعة ترجع وتستبدل خلال 14 يوماً بأصل الفاتورة';

  // Build items rows
  const tableRowsHtml =
    items.length === 0
      ? `<tr><td colspan="5" style="padding: 10px; color: #777;">لا توجد أصناف في هذه الفاتورة</td></tr>`
      : items
          .map((item) => {
            const qty = parseFloat(String(item.qty)) || 0;
            const price = parseFloat(String(item.price)) || 0;
            const itemTotal = Number(item.total !== undefined ? item.total : qty * price);
            const desc = item.spec || item.notes || (item as any).desc || (item as any).description || '-';

            return `
            <tr>
              <td style="text-align: right; font-weight: bold; padding-right: 8px;">${item.name || ''}</td>
              <td style="text-align: right; color: #444; padding-right: 8px;">${desc}</td>
              <td style="font-family: monospace; font-weight: bold;">${qty}</td>
              <td style="font-family: monospace;">${price.toFixed(2)}</td>
              <td style="font-family: monospace; font-weight: bold;">${itemTotal.toFixed(2)}</td>
            </tr>`;
          })
          .join('');

  // Paper size normalization
  const initialPaperSize =
    preferredPaperSize === '80mm' || preferredPaperSize === 'thermal'
      ? 'thermal'
      : preferredPaperSize === 'A5'
      ? 'A5'
      : 'A4';

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${invoiceTypeTitle} #${invoiceNumber}</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
<style>
  /* ====================================================
     1. التنسيقات العامة وإعدادات الشاشة
  ==================================================== */
  * { 
    box-sizing: border-box; 
    margin: 0;
    padding: 0;
  }
  
  html, body { 
    font-family: 'Segoe UI', Tahoma, Arial, sans-serif; 
    background-color: #eef1f5; 
    color: #000;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 15px 0;
  }

  /* شريط أدوات التحكم بالطباعة وتغيير المقاسات وحفظ الـ PDF (يظهر على الشاشة فقط ويختفي عند الطباعة) */
  .no-print-toolbar {
    width: 100%;
    max-width: 210mm;
    background: #1a237e;
    color: #fff;
    padding: 10px 16px;
    border-radius: 12px;
    margin-bottom: 14px;
    box-shadow: 0 4px 12px rgba(26, 35, 126, 0.25);
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    user-select: none;
  }

  .toolbar-left, .toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .toolbar-title {
    font-size: 0.95rem;
    font-weight: bold;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .toolbar-badge {
    background: #2e7d32;
    color: #fff;
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 0.75rem;
    font-family: monospace;
    font-weight: bold;
  }

  .paper-size-btn {
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.3);
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 0.78rem;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  .paper-size-btn:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  .paper-size-btn.active {
    background: #fff;
    color: #1a237e;
    border-color: #fff;
    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
  }

  .action-btn {
    border: none;
    padding: 7px 14px;
    border-radius: 8px;
    font-size: 0.8rem;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .btn-print {
    background: #00c853;
    color: #fff;
  }
  .btn-print:hover { background: #00b248; }

  .btn-pdf {
    background: #d84315;
    color: #fff;
  }
  .btn-pdf:hover { background: #bf360c; }

  .btn-close {
    background: #455a64;
    color: #fff;
  }
  .btn-close:hover { background: #37474f; }

  /* الحاوية الرئيسية للفاتورة مع ضبط النسب */
  .invoice-container { 
    background: #fff; 
    border: 1.5px solid #000; 
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transition: width 0.2s ease, min-height 0.2s ease;
  }

  /* --- أبعاد ونسب مقاس A4 --- */
  body[data-paper-size="A4"] .invoice-container {
    width: 210mm;
    min-height: 297mm;
    padding: 8mm 10mm;
  }

  /* --- أبعاد ونسب مقاس A5 --- */
  body[data-paper-size="A5"] .invoice-container {
    width: 148mm;
    min-height: 210mm;
    padding: 5mm 6mm;
  }
  body[data-paper-size="A5"] {
    font-size: 0.82rem;
  }

  /* --- المقاس الحراري Thermal 80mm --- */
  body[data-paper-size="thermal"] .invoice-container {
    width: 76mm;
    min-height: auto;
    padding: 4mm 3mm;
    border: 1px dashed #000;
    box-shadow: none;
  }
  body[data-paper-size="thermal"] {
    font-size: 0.75rem;
  }
  body[data-paper-size="thermal"] .info-box {
    flex-direction: column;
    gap: 4px;
    text-align: center;
  }
  body[data-paper-size="thermal"] .info-item {
    text-align: center !important;
  }
  body[data-paper-size="thermal"] .bottom-section {
    justify-content: center;
  }
  body[data-paper-size="thermal"] .summary-vertical-list {
    width: 100%;
  }

  /* ====================================================
     2. الهيكل الداخلي المعتمد (الترويسة، البيانات، الجدول)
  ==================================================== */
  /* الترويسة العليا */
  .header { 
    display: flex; 
    justify-content: space-between; 
    align-items: center; 
    border-bottom: 1.5px solid #000; 
    padding-bottom: 6px; 
    margin-bottom: 8px; 
    width: 100%;
  }
  .header.is-empty { display: none !important; }

  .header-right { text-align: right; flex: 1.2; }
  .header-right h2 { margin: 0 0 2px 0; font-size: 1.1rem; font-weight: bold; }
  .header-right p { margin: 0; font-size: 0.73rem; color: #333; }

  .header-center {
    display: flex;
    justify-content: center;
    align-items: center;
    min-width: 80px;
    flex: 0.8;
  }
  .logo-img { max-width: 80px; max-height: 45px; object-fit: contain; }

  .header-left { flex: 1.2; display: flex; justify-content: flex-end; }
  .phones-list { list-style: none; padding: 0; margin: 0; font-size: 0.73rem; direction: ltr; text-align: left; }
  .phones-list li { margin-bottom: 1px; font-weight: 600; }

  /* صندوق معلومات العميل والفاتورة الأصلي */
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
  .info-item p { margin: 1px 0; }

  /* جدول الأصناف الأصلي المعتمد (مع اسم الصنف والوصف والعدد والسعر والإجمالي) */
  .table-wrapper { width: 100%; flex-grow: 1; }
  table.items-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  table.items-table th, table.items-table td { 
    border: 1px solid #000; 
    padding: 4px 6px; 
    text-align: center; 
    font-size: 0.8rem; 
  }
  table.items-table th { 
    background-color: #ededed; 
    font-weight: bold; 
    font-size: 0.78rem; 
  }

  /* المجموع والملخص السفلي الأصلي */
  .bottom-section { display: flex; justify-content: flex-end; margin-top: 6px; margin-bottom: 8px; width: 100%; }
  .summary-vertical-list { width: 240px; display: flex; flex-direction: column; gap: 2px; font-size: 0.82rem; font-weight: bold; }
  .summary-line { display: flex; justify-content: space-between; align-items: center; padding: 1px 0; }
  .summary-line.total-line { 
    border-top: 1.5px solid #000; 
    margin-top: 3px; 
    padding-top: 3px; 
    font-size: 0.95rem; 
  }

  /* التذييل وحقوق الملكية */
  .invoice-footer-note {
    border-top: 1.5px solid #000;
    padding-top: 5px;
    margin-top: auto; 
    display: flex;
    justify-content: space-between;
    font-size: 0.73rem;
    font-weight: 600;
    width: 100%;
  }

  .copyright-outside {
    width: 100%;
    text-align: center;
    font-size: 0.68rem;
    font-weight: bold;
    color: #444;
    padding: 5px 0;
    direction: ltr;
  }

  .hide-row { display: none !important; }

  /* ====================================================
     3. إعدادات الطباعة للـ A4 والـ A5 والحراري
  ==================================================== */
  @page {
    margin: 0mm;
  }

  @media print {
    body { 
      background: none !important; 
      padding: 0 !important; 
      margin: 0 !important; 
      color: #000 !important;
    }

    .no-print-toolbar { 
      display: none !important; 
    }

    /* طباعة A4 */
    body[data-paper-size="A4"] .invoice-container {
      width: 210mm !important;
      min-height: 297mm !important;
      padding: 8mm 10mm !important;
      margin: 0 auto !important;
      border: 1.5px solid #000 !important;
      box-shadow: none !important;
      page-break-after: avoid !important;
      page-break-inside: avoid !important;
    }

    /* طباعة A5 */
    body[data-paper-size="A5"] .invoice-container {
      width: 148mm !important;
      min-height: 210mm !important;
      padding: 5mm 6mm !important;
      margin: 0 auto !important;
      border: 1.5px solid #000 !important;
      box-shadow: none !important;
      page-break-after: avoid !important;
      page-break-inside: avoid !important;
    }

    /* الطباعة الحرارية */
    body[data-paper-size="thermal"] .invoice-container {
      width: 76mm !important;
      min-height: auto !important;
      padding: 3mm !important;
      border: none !important;
      box-shadow: none !important;
      page-break-after: avoid !important;
      page-break-inside: avoid !important;
    }
    
    .copyright-outside { 
      display: none !important; 
    }
  }
</style>
<style id="dynamic-page-size"></style>
</head>
<body data-paper-size="${initialPaperSize}">

<!-- شريط التحكم والمعاينة بالأعلى (غير مطبوع) -->
<div class="no-print-toolbar">
  <div class="toolbar-left">
    <div class="toolbar-title">
      <span>🖨️</span>
      <span>معاينة وتخصيص الفاتورة</span>
    </div>
    <span class="toolbar-badge">${invoiceTypeTitle} #${invoiceNumber}</span>
  </div>

  <div class="toolbar-right">
    <button type="button" class="paper-size-btn ${initialPaperSize === 'A4' ? 'active' : ''}" id="btn-size-a4" onclick="setPaperSize('A4')">
      📄 مقاس A4
    </button>
    <button type="button" class="paper-size-btn ${initialPaperSize === 'A5' ? 'active' : ''}" id="btn-size-a5" onclick="setPaperSize('A5')">
      📑 مقاس A5
    </button>
    <button type="button" class="paper-size-btn ${initialPaperSize === 'thermal' ? 'active' : ''}" id="btn-size-thermal" onclick="setPaperSize('thermal')">
      🧾 حراري 80mm
    </button>

    <button type="button" class="action-btn btn-print" onclick="window.print()">
      <span>🖨️</span>
      <span>طباعة الفاتورة</span>
    </button>
    <button type="button" class="action-btn btn-pdf" onclick="saveAsPdf()">
      <span>💾</span>
      <span>حفظ PDF</span>
    </button>
    <button type="button" class="action-btn btn-close" onclick="window.close()">
      ✕ إغلاق
    </button>
  </div>
</div>

<div class="invoice-container">
  <div>
    <!-- الترويسة الديناميكية -->
    <div class="header" id="invoiceHeader">
      <div class="header-right">
        <h2 id="settingCompanyName">${companyName}</h2>
        <p id="settingCompanyAddress">${companyAddress}</p>
      </div>
      
      <div class="header-center">
        ${logoUrl ? `<img id="settingCompanyLogo" class="logo-img" src="${logoUrl}" alt="الشعار" />` : ''}
      </div>
      
      <div class="header-left">
        <ul class="phones-list" id="settingPhonesList">
          ${companyPhones.map((phone) => `<li>${phone}</li>`).join('')}
        </ul>
      </div>
    </div>

    <!-- صندوق البيانات الأصلي -->
    <div class="info-box">
      <div class="info-item" style="text-align: right;">
        <p><strong>${partyLabel}:</strong> <span id="lblClientName">${partyName}</span></p>
        <p><strong>${partyIdLabel}:</strong> <span id="lblClientId">${partyPhone}</span></p>
      </div>
      
      <div class="info-item" style="text-align: center;">
        <p>
          <strong id="lblInvoiceType">${invoiceTypeTitle}</strong> - 
          <strong style="font-size: 1rem;">#<span id="lblSerialNo">${invoiceNumber}</span></strong>
        </p>
        <p><strong>وسيلة الدفع:</strong> <span id="lblPaymentMethod">${paymentMethodType}</span></p>
      </div>
      
      <div class="info-item" style="text-align: left;">
        <p><strong>التاريخ:</strong> <span id="lblInvoiceDate">${invoiceDate}</span></p>
        <p><strong>الوقت:</strong> <span id="lblInvoiceTime">${invoiceTime}</span></p>
      </div>
    </div>

    <!-- جدول الأصناف الأصلي -->
    <div class="table-wrapper">
      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 38%;">اسم الصنف</th>
            <th style="width: 30%;">الوصف</th>
            <th style="width: 10%;">العدد</th>
            <th style="width: 10%;">السعر</th>
            <th style="width: 12%;">الإجمالي</th>
          </tr>
        </thead>
        <tbody id="invoiceTable">
          ${tableRowsHtml}
        </tbody>
      </table>
    </div>

    <!-- ملخص الحسابات الأصلي -->
    <div class="bottom-section">
      <div class="summary-vertical-list">
        <div class="summary-line ${feesVal > 0 ? '' : 'hide-row'}" id="row-fees">
          <span id="lbl-fees">${feesName}:</span>
          <span id="val-fees">${feesVal.toFixed(2)}</span>
        </div>
        <div class="summary-line total-line" id="row-total">
          <span>صافي القيمة / الإجمالي:</span>
          <span id="val-total">${grandTotal.toFixed(2)}</span>
        </div>
        <div class="summary-line ${paidVal > 0 ? '' : 'hide-row'}" id="row-paid">
          <span>المبلغ المدفوع:</span>
          <span id="val-paid">${paidVal.toFixed(2)}</span>
        </div>
        <div class="summary-line ${remainingVal > 0 ? '' : 'hide-row'}" id="row-remaining">
          <span>المبلغ المتبقي:</span>
          <span id="val-remaining">${remainingVal.toFixed(2)}</span>
        </div>
      </div>
    </div>
  </div>

  <div>
    <div class="invoice-footer-note">
      <div id="footerTermsNote">${footerTermsNote}</div>
      <div>صفحة رقم: <span id="lblPageNumber">1/1</span></div>
    </div>
  </div>
</div>

<div class="copyright-outside">
  حقوق الملكية محفوظة Mohamed Nazih 01029190615
</div>

<script>
  function setPaperSize(size) {
    document.body.setAttribute('data-paper-size', size);
    
    // Update button active state
    var btnA4 = document.getElementById('btn-size-a4');
    var btnA5 = document.getElementById('btn-size-a5');
    var btnThermal = document.getElementById('btn-size-thermal');
    if (btnA4) btnA4.classList.toggle('active', size === 'A4');
    if (btnA5) btnA5.classList.toggle('active', size === 'A5');
    if (btnThermal) btnThermal.classList.toggle('active', size === 'thermal');

    // Update dynamic @page CSS
    var styleEl = document.getElementById('dynamic-page-size');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'dynamic-page-size';
      document.head.appendChild(styleEl);
    }
    if (size === 'A4') {
      styleEl.innerHTML = '@page { size: A4 portrait; margin: 0; }';
    } else if (size === 'A5') {
      styleEl.innerHTML = '@page { size: A5 portrait; margin: 0; }';
    } else if (size === 'thermal') {
      styleEl.innerHTML = '@page { size: 80mm auto; margin: 0; }';
    }

    try {
      localStorage.setItem('sys_print_pref_size', size);
    } catch(e) {}
  }

  function saveAsPdf() {
    var container = document.querySelector('.invoice-container');
    var size = document.body.getAttribute('data-paper-size') || 'A4';
    var serial = document.getElementById('lblSerialNo') ? document.getElementById('lblSerialNo').innerText : '${invoiceNumber}';
    var invoiceType = document.getElementById('lblInvoiceType') ? document.getElementById('lblInvoiceType').innerText : 'فاتورة';
    var filename = invoiceType + '_' + serial + '.pdf';

    if (window.html2pdf) {
      var opt = {
        margin: size === 'thermal' ? [3, 2, 3, 2] : [0, 0, 0, 0],
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: {
          unit: 'mm',
          format: size === 'A5' ? 'a5' : size === 'thermal' ? [80, 220] : 'a4',
          orientation: 'portrait'
        }
      };
      html2pdf().set(opt).from(container).save();
    } else {
      window.print();
    }
  }

  window.addEventListener('DOMContentLoaded', function() {
    var savedSize = null;
    try {
      savedSize = localStorage.getItem('sys_print_pref_size');
    } catch(e) {}
    if (savedSize && (savedSize === 'A4' || savedSize === 'A5' || savedSize === 'thermal')) {
      setPaperSize(savedSize);
    } else {
      setPaperSize('${initialPaperSize}');
    }
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
  preferredPaperSize?: 'A4' | 'A5' | 'thermal' | '80mm'
) {
  const normPaperSize: PaperSize =
    preferredPaperSize === '80mm' || preferredPaperSize === 'thermal'
      ? 'thermal'
      : preferredPaperSize === 'A5'
      ? 'A5'
      : 'A4';

  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem('sys_print_pref_size', normPaperSize);
  } catch {}

  // 1. Centralized in-app high-fidelity preview modal (Preferred & sandbox-friendly)
  openCentralizedInvoicePrint({
    invoice: inv,
    isSales,
    settings,
    preferredPaperSize: normPaperSize,
  });
}

