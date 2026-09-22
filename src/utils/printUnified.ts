import React from 'react';
import { Settings } from '../types';

export interface UnifiedReportConfig {
  reportTitle: string;
  subTitle?: string;
  branch?: string;
  serial?: string | number;
  date?: string;
  time?: string;
  company?: {
    name?: string;
    address?: string;
    logo?: string;
    phones?: string[];
  };
  infoExtra?: Array<{ label: string; value: string }>;
  kpis?: Array<{ title: string; value: string }>;
  columns: string[];
  rows: (string | number | React.ReactNode)[][];
  summary?: Array<{ label: string; value: string | number; isTotal?: boolean }>;
  notes?: string;
  footerNote?: string;
  signatures?: string[];
  isThermal?: boolean;
}

export interface PrintDocumentConfig {
  title: string;
  docNumber?: string | number;
  docTypeBadge?: string;
  date?: string;
  time?: string;
  partyName?: string;
  partyPhone?: string;
  partyTaxNumber?: string;
  partyAddress?: string;
  partyLabel?: string;
  notes?: string;
  paymentMethod?: string;
  items?: {
    index?: number;
    name: string;
    unit?: string;
    qty: number | string;
    price: number | string;
    discount?: number | string;
    tax?: number | string;
    total: number | string;
    notes?: string;
  }[];
  totals?: {
    label: string;
    value: string | number;
    isBold?: boolean;
    isHighlight?: boolean;
  }[];
  additionalDetails?: { label: string; value: string }[];
  isThermal?: boolean;
  qrData?: string;
  signatures?: string[];
  footerNote?: string;
  branch?: string;
}

/**
 * Standardized Unified System Print Generator
 * Complies strictly with the universal accounting system blueprint:
 * - Full-page 3px black border container
 * - Formal header with company title, address, logo, and phone (01029190615)
 * - Dynamic info box
 * - Dynamic table styling (1px solid #000, #ededed th)
 * - Vertical summary list with total lines
 * - Formal footer and copyright: "حقوق الملكية محفوظة Mohamed Nazih 01029190615"
 */
export function generateUnifiedReportHtml(config: UnifiedReportConfig): string {
  const companyName = config.company?.name || 'RAKEEZA';
  const companyAddress = config.company?.address || 'الفرع الرئيسي - جمهورية مصر العربية';
  const companyLogo = config.company?.logo || '';
  const phones = config.company?.phones && config.company.phones.length > 0
    ? config.company.phones
    : [];

  const now = new Date();
  const dateStr = config.date || now.toLocaleDateString('ar-EG');
  const timeStr = config.time || now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  const serialStr = config.serial !== undefined && config.serial !== '' ? `${config.serial}` : '1';
  const branchStr = config.branch || 'الفرع الرئيسي';
  const subTitleStr = config.subTitle || 'مستند رسمي';
  const footerNoteText = config.footerNote || 'نظام إدارة الشركات والمحاسبة';

  const theadHtml = `<tr>${config.columns.map((c) => `<th>${c}</th>`).join('')}</tr>`;
  const tbodyHtml = config.rows.length === 0
    ? `<tr><td colspan="${Math.max(1, config.columns.length)}" style="color:#666;padding:12px;">لا توجد بيانات متاحة لهذا التقرير</td></tr>`
    : config.rows
        .map(
          (row) =>
            `<tr>${row
              .map((cell, cellIdx) => {
                const alignStyle = cellIdx === 1 ? 'text-align:right;' : 'text-align:center;';
                return `<td style="${alignStyle}">${cell !== undefined && cell !== null ? cell : '-'}</td>`;
              })
              .join('')}</tr>`
        )
        .join('');

  let summaryHtml = '';
  if (config.summary && config.summary.length > 0) {
    summaryHtml = `
    <div class="bottom-section" id="summarySection">
      <div class="summary-vertical-list" id="summaryContent">
        ${config.summary
          .map(
            (s) => `
          <div class="summary-line ${s.isTotal ? 'total-line' : ''}">
            <span>${s.label}:</span>
            <span>${s.value}</span>
          </div>`
          )
          .join('')}
      </div>
    </div>`;
  }

  // Extra info details if provided (like customer info)
  let extraInfoHtml = '';
  if (config.infoExtra && config.infoExtra.length > 0) {
    extraInfoHtml = `
    <div class="extra-info-banner">
      ${config.infoExtra
        .map(
          (item) => `
        <div class="extra-item">
          <strong>${item.label}:</strong> <span>${item.value}</span>
        </div>`
        )
        .join('')}
    </div>`;
  }

  // KPIs if provided
  let kpisHtml = '';
  if (config.kpis && config.kpis.length > 0) {
    kpisHtml = `
    <div class="kpi-grid">
      ${config.kpis
        .map(
          (kpi) => `
        <div class="kpi-card">
          <div class="kpi-title">${kpi.title}</div>
          <div class="kpi-value">${kpi.value}</div>
        </div>`
        )
        .join('')}
    </div>`;
  }

  // Notes if provided
  let notesHtml = '';
  if (config.notes) {
    notesHtml = `
    <div class="notes-box">
      <strong>ملاحظات:</strong> ${config.notes.replace(/\n/g, '<br>')}
    </div>`;
  }

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title id="printPageTitle">${config.reportTitle} - ${serialStr}</title>
<style>
  @page { size: auto; margin: 0mm; }
  * { box-sizing: border-box; }
  
  html, body { 
    font-family: 'Segoe UI', Tahoma, Arial, sans-serif; 
    background-color: #f0f2f5; 
    margin: 0; padding: 0; color: #000;
    width: 100%; min-height: 100%;
    display: flex; flex-direction: column; align-items: center;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .no-print-toolbar {
    background: #0f172a;
    color: #fff;
    padding: 8px 16px;
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    position: sticky;
    top: 0;
    z-index: 9999;
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
    color: white;
    border: none;
    padding: 6px 18px;
    font-size: 13px;
    font-weight: bold;
    border-radius: 6px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.25);
    transition: all 0.15s;
  }

  .btn-print:hover {
    background: #15803d;
    transform: translateY(-1px);
  }

  .btn-close {
    background: #475569;
    color: white;
    border: none;
    padding: 6px 14px;
    font-size: 12px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-close:hover {
    background: #334155;
  }

  /* الإطار الخارجي الموحد لكل التقارير */
  .invoice-container { 
    background: #fff; 
    width: 100vw; 
    min-height: calc(100vh - 25px);
    max-width: 100%; 
    margin: 10px auto; 
    padding: 6mm 8mm; 
    border: 3px solid #000; 
    display: flex; 
    flex-direction: column; 
    justify-content: space-between;
    transition: all 0.2s ease;
  }

  /* A5 mode scaling */
  body.size-a5 {
    font-size: 0.72rem;
  }
  body.size-a5 .invoice-container {
    padding: 3mm 4mm;
    min-height: calc(100vh - 12px);
  }
  body.size-a5 .header-right h2 { font-size: 0.95rem; }
  body.size-a5 .header-right p, body.size-a5 .phones-list { font-size: 0.65rem; }
  body.size-a5 .logo-img { max-height: 40px; max-width: 65px; }
  body.size-a5 .report-info-box { padding: 3px 6px; font-size: 0.7rem; }
  body.size-a5 .kpi-card { padding: 2px 4px; }
  body.size-a5 .kpi-card .kpi-title { font-size: 0.65rem; }
  body.size-a5 .kpi-card .kpi-value { font-size: 0.8rem; }
  body.size-a5 table th, body.size-a5 table td { padding: 2.5px 3.5px; font-size: 0.68rem; }
  body.size-a5 .summary-vertical-list { width: 210px; font-size: 0.75rem; }
  body.size-a5 .invoice-footer-note { font-size: 0.68rem; padding-top: 2px; }
  body.size-a5 .copyright-outside { font-size: 0.65rem; padding: 1px 0; }

  /* Thermal 80mm & 58mm POS styles */
  body.size-80mm {
    font-size: 0.72rem;
    background: #fff;
    padding: 0;
  }
  body.size-80mm .invoice-container {
    width: 76mm;
    min-height: auto;
    border: none;
    padding: 2mm;
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
  body.size-80mm .report-info-box {
    flex-direction: column;
    text-align: center;
    border: 1px dashed #000;
  }
  body.size-80mm .kpi-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  body.size-80mm table th, body.size-80mm table td {
    padding: 2px 3px;
    font-size: 0.68rem;
  }
  body.size-80mm .summary-vertical-list {
    width: 100%;
  }
  body.size-80mm .copyright-outside {
    color: #000;
    font-size: 0.65rem;
  }

  body.size-58mm {
    font-size: 0.65rem;
    background: #fff;
    padding: 0;
  }
  body.size-58mm .invoice-container {
    width: 54mm;
    min-height: auto;
    border: none;
    padding: 1.5mm;
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
  body.size-58mm .report-info-box {
    flex-direction: column;
    text-align: center;
    border: 1px dashed #000;
  }
  body.size-58mm .kpi-grid {
    grid-template-columns: 1fr;
  }
  body.size-58mm table th, body.size-58mm table td {
    padding: 1.5px 2px;
    font-size: 0.6rem;
  }
  body.size-58mm .summary-vertical-list {
    width: 100%;
  }
  body.size-58mm .copyright-outside {
    color: #000;
    font-size: 0.6rem;
  }

  /* Landscape mode adjustments */
  body.orient-landscape .kpi-grid {
    grid-template-columns: repeat(4, 1fr);
  }
  body.orient-landscape .invoice-container {
    height: auto;
    min-height: calc(100vh - 20px);
  }

  /* 1. الترويسة الثابتة */
  .header { 
    display: flex; 
    justify-content: space-between; 
    align-items: center; 
    border-bottom: 2px solid #000; 
    padding-bottom: 4px; 
    margin-bottom: 6px; 
    width: 100%;
  }
  .header-right h2 { margin: 0 0 2px 0; font-size: 1.15rem; font-weight: bold; }
  .header-right p { margin: 0; font-size: 0.75rem; color: #333; }
  .header-center { display: flex; justify-content: center; align-items: center; min-width: 80px; }
  .logo-img { max-width: 90px; max-height: 55px; object-fit: contain; }
  .phones-list { list-style: none; padding: 0; margin: 0; font-size: 0.75rem; direction: ltr; text-align: left; }
  .phones-list li { margin-bottom: 1px; font-weight: 600; }

  /* 2. صندوق عنوان التقرير الديناميكي */
  .report-info-box { 
    display: flex; 
    justify-content: space-between; 
    align-items: center;
    border: 1.5px solid #000; 
    padding: 4px 8px; 
    margin-bottom: 6px; 
    font-size: 0.8rem; 
    background-color: #fafafa; 
    width: 100%;
  }
  .report-info-box p { margin: 1px 0; }

  .extra-info-banner {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    border: 1px dashed #000;
    padding: 4px 8px;
    margin-bottom: 6px;
    font-size: 0.75rem;
    background-color: #fff;
  }
  .extra-item { margin: 0; }

  /* KPIs */
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
    margin-bottom: 6px;
  }
  .kpi-card {
    border: 1.5px solid #000;
    padding: 3px 6px;
    text-align: center;
    background-color: #f8f9fa;
  }
  .kpi-card .kpi-title { font-size: 0.7rem; font-weight: bold; color: #333; }
  .kpi-card .kpi-value { font-size: 0.85rem; font-weight: bold; margin-top: 1px; direction: ltr; }

  /* 3. حاوية الجدول المتغيرة حسب التقرير */
  .table-wrapper { width: 100%; flex-grow: 1; overflow-y: visible; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  th, td { border: 1px solid #000; padding: 4px 5px; text-align: center; font-size: 0.78rem; }
  th { background-color: #ededed; font-weight: bold; }

  /* 4. الملخص المالي السفلي (اختياري حسب التقرير) */
  .bottom-section { display: flex; justify-content: flex-end; margin-top: 4px; margin-bottom: 8px; width: 100%; }
  .summary-vertical-list { width: 260px; display: flex; flex-direction: column; gap: 2px; font-size: 0.85rem; font-weight: bold; text-align: left; }
  .summary-line { display: flex; justify-content: space-between; align-items: center; padding: 1px 0; }
  .summary-line.total-line { border-top: 1.5px solid #000; margin-top: 2px; padding-top: 2px; font-size: 0.95rem; }

  .notes-box {
    border: 1px solid #000;
    padding: 4px 8px;
    font-size: 0.75rem;
    margin-bottom: 6px;
    background-color: #fff;
  }

  /* 5. تذييل الصفحة */
  .invoice-footer-note {
    border-top: 1.5px solid #000; 
    padding-top: 4px; 
    margin-top: auto; 
    display: flex; 
    justify-content: space-between; 
    font-size: 0.75rem; 
    font-weight: 600; 
    width: 100%;
  }

  /* 6. حقوق الملكية خارج الإطار الثابت */
  .copyright-outside {
    width: 100%; 
    text-align: center; 
    font-size: 0.68rem; 
    font-weight: bold; 
    color: #444; 
    padding: 2px 0 6px 0; 
    direction: ltr;
  }

  @media print {
    .no-print-toolbar { display: none !important; }
    body { background: none; padding: 0; margin: 0; }
    .invoice-container { 
      border: 3px solid #000 !important; 
      width: 100vw !important; 
      height: calc(100vh - 20px) !important;
      min-height: calc(100vh - 20px) !important;
      margin: 0 !important;
      padding: 5mm !important; 
      box-shadow: none; 
      page-break-after: avoid; 
      page-break-inside: avoid;
    }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>

<div class="no-print-toolbar no-print">
  <div class="toolbar-title-box">
    <span class="title-text">🖨️ معاينة وتخصيص الطباعة</span>
    <span class="doc-badge">${config.reportTitle} #${serialStr}</span>
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

<div class="invoice-container">
  <div>
    <!-- الترويسة الثابتة للشركة -->
    <div class="header">
      <div class="header-right">
        <h2 id="compName">${companyName}</h2>
        <p id="compAddress">${companyAddress}</p>
      </div>
      <div class="header-center">
        ${
          companyLogo
            ? `<img id="compLogo" class="logo-img" src="${companyLogo}" alt="شعار">`
            : `<div style="font-size:11px;border:1px dashed #999;padding:4px 8px;border-radius:4px;">RAKEEZA ERP</div>`
        }
      </div>
      <div class="header-left">
        <ul class="phones-list" id="compPhones">
          ${phones.map((ph) => `<li>${ph}</li>`).join('')}
        </ul>
      </div>
    </div>

    <!-- صندوق معلومات التقرير الديناميكي -->
    <div class="report-info-box">
      <div style="text-align: right;">
        <p><strong>اسم التقرير:</strong> <span id="repTitle">${config.reportTitle}</span></p>
        <p><strong>الفرع / القسم:</strong> <span id="repBranch">${branchStr}</span></p>
      </div>
      <div style="text-align: center;">
        <p><strong id="repSubTitle">${subTitleStr}</strong> - <strong style="font-size: 0.9rem;">#<span id="repSerial">${serialStr}</span></strong></p>
      </div>
      <div style="text-align: left;">
        <p><strong>التاريخ:</strong> <span id="repDate">${dateStr}</span></p>
        <p><strong>الوقت:</strong> <span id="repTime">${timeStr}</span></p>
      </div>
    </div>

    ${extraInfoHtml}
    ${kpisHtml}

    <!-- جدول البيانات الديناميكي -->
    <div class="table-wrapper">
      <table>
        <thead id="dynamicTableHead">
          ${theadHtml}
        </thead>
        <tbody id="dynamicTableBody">
          ${tbodyHtml}
        </tbody>
      </table>
    </div>

    ${summaryHtml}
    ${notesHtml}
  </div>

  <div>
    <div class="invoice-footer-note">
      <div id="footerNoteText">${footerNoteText}</div>
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

/**
 * Universal Print Window Opener
 */
export function openUnifiedPrintWindow(
  doc: PrintDocumentConfig | UnifiedReportConfig,
  settings?: Settings,
  showToast?: (msg: string, type: any) => void
): void {
  // Check if it's already a UnifiedReportConfig or convert from PrintDocumentConfig
  let unifiedConfig: UnifiedReportConfig;

  if ('columns' in doc && 'rows' in doc) {
    unifiedConfig = doc as UnifiedReportConfig;
  } else {
    const d = doc as PrintDocumentConfig;
    const companyName = settings?.companyName || 'RAKEEZA';
    const companyAddress = settings?.address || 'جمهورية مصر العربية';
    const phones = [settings?.phone1, settings?.phone2, settings?.phone3].filter(Boolean) as string[];

    const columns = ['م', 'الصنف / البند', 'الكمية', 'سعر الوحدة', 'الخصم', 'الإجمالي'];
    const rows = (d.items || []).map((it, idx) => [
      idx + 1,
      it.name + (it.notes ? ` (${it.notes})` : ''),
      it.qty,
      it.price,
      it.discount ? it.discount : '0',
      it.total,
    ]);

    const summary = (d.totals || []).map((t, idx) => ({
      label: t.label,
      value: `${t.value} ${settings?.currencySymbol || 'ج.م'}`,
      isTotal: idx === (d.totals?.length || 1) - 1 || t.isHighlight || t.isBold,
    }));

    const infoExtra: Array<{ label: string; value: string }> = [];
    if (d.partyName) infoExtra.push({ label: d.partyLabel || 'الطرف المستفيد', value: d.partyName });
    if (d.partyPhone) infoExtra.push({ label: 'الهاتف', value: d.partyPhone });
    if (d.paymentMethod) infoExtra.push({ label: 'طريقة الدفع', value: d.paymentMethod });

    unifiedConfig = {
      reportTitle: d.title,
      subTitle: d.docTypeBadge || 'مستند رسمي',
      serial: d.docNumber || '1',
      branch: d.branch || 'الفرع الرئيسي',
      date: d.date,
      time: d.time,
      company: {
        name: companyName,
        address: companyAddress,
        logo: (settings as any)?.logo || (settings as any)?.logoUrl || '',
        phones: phones.length > 0 ? phones : ['01029190615'],
      },
      infoExtra,
      columns,
      rows,
      summary,
      notes: d.notes,
      footerNote: d.footerNote || 'نظام إدارة الشركات والمحاسبة',
      signatures: d.signatures,
    };
  }

  const html = generateUnifiedReportHtml(unifiedConfig);

  let printWindow: Window | null = null;
  try {
    printWindow = window.open('', '_blank', 'width=1000,height=900');
  } catch {
    printWindow = null;
  }

  if (printWindow) {
    try {
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      return;
    } catch {
      // Fall back to hidden iframe
    }
  }

  // Fallback: hidden iframe for sandboxed environments
  try {
    let iframe = document.getElementById('rakeeza-report-print-frame') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'rakeeza-report-print-frame';
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
            showToast('تم إرسال أمر طباعة التقرير بنجاح', 'success');
          }
        } catch (err) {
          console.error('Iframe report print error:', err);
        }
      }, 500);
      return;
    }
  } catch (err) {
    console.error('Report fallback print error:', err);
  }

  if (showToast) {
    showToast('يرجى السماح بالنوافذ المنبثقة (Popups) لمعاينة وطباعة التقرير', 'warning');
  }
}
