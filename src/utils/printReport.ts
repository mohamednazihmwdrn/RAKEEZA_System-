import { AppData, Settings } from '../types';
import { ReportResult } from './reportsData';

export function generateReportPrintHtml(
  reportData: ReportResult,
  appData: AppData,
  dateFrom?: string,
  dateTo?: string
): string {
  const settings: Partial<Settings> = appData.settings || {};
  const companyName = settings.companyName || 'RAKEEZA';
  const companySubtitle = settings.address || 'الفرع الرئيسي - ش المعهد الديني';
  const logoSrc = settings.logo || settings.logoUrl || '';
  const showLogo = settings.showLogoInPrint !== false && Boolean(logoSrc);
  const paperSize = settings.paperSize || 'A4';
  const pageMargin = settings.pageMargin !== undefined ? settings.pageMargin : 4;

  const phoneNumbers = [
    settings.phone1,
    settings.phone2,
    settings.phone3,
  ].filter(Boolean) as string[];
  const finalPhones = phoneNumbers.length > 0 ? phoneNumbers : ['01029190615'];

  const currentUserObj = appData.users.find((u) => u.id === appData.currentUser) || appData.users[0];
  const createdBy = currentUserObj?.name || 'مدير النظام';

  const reportTitle = reportData.title || 'تقرير عام';
  const now = new Date();
  const printDate = now.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const printTime = now.toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const fromStr = dateFrom || reportData.fromDate || '2026-01-01';
  const toStr = dateTo || reportData.toDate || now.toISOString().split('T')[0];
  const storeName = appData.activeBranchId
    ? (appData.branches?.find((b) => b.id === appData.activeBranchId)?.name || 'الفرع الرئيسي')
    : 'الفرع الرئيسي';

  // Build KPIs (4 cards layout matching enterprise ERP standards)
  let kpisList: { title: string; value: string }[] = [];
  if (reportData.kpis && reportData.kpis.length > 0) {
    kpisList = reportData.kpis.map((k) => ({
      title: k.label,
      value: typeof k.value === 'number' ? `${k.value.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م` : String(k.value),
    }));
  } else {
    kpisList = [
      { title: 'إجمالي القيمة', value: `${(reportData.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م` },
      { title: 'عدد السجلات', value: `${reportData.count || reportData.rows.length} حركة` },
      { title: 'الصافي العام', value: `${(reportData.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م` },
      { title: 'الحالة / المؤشر', value: 'نشط ومطابق' },
    ];
  }

  // Ensure up to 4 KPI cards
  if (kpisList.length < 4) {
    if (kpisList.length === 1) {
      kpisList.push({ title: 'عدد السجلات', value: `${reportData.rows.length} سجل` });
      kpisList.push({ title: 'الصافي العام', value: `${(reportData.total || 0).toFixed(2)} ج.م` });
      kpisList.push({ title: 'حالة التقرير', value: 'معتمد' });
    } else if (kpisList.length === 2) {
      kpisList.push({ title: 'الصافي العام', value: `${(reportData.total || 0).toFixed(2)} ج.م` });
      kpisList.push({ title: 'حالة التقرير', value: 'معتمد' });
    } else if (kpisList.length === 3) {
      kpisList.push({ title: 'حالة التقرير', value: 'معتمد' });
    }
  }

  const kpisHtml = kpisList
    .slice(0, 4)
    .map(
      (kpi) =>
        `<div class="kpi-card">
          <div class="kpi-title">${kpi.title}</div>
          <div class="kpi-value">${kpi.value}</div>
        </div>`
    )
    .join('');

  const tableHeadersHtml = reportData.columns
    .map((col) => `<th>${col}</th>`)
    .join('');

  const tableRowsHtml =
    reportData.rows.length === 0
      ? `<tr><td colspan="${Math.max(1, reportData.columns.length)}" style="text-align:center;padding:15px;color:#888;">لا توجد بيانات متاحة لهذا التقرير خلال الفترة المحددة</td></tr>`
      : reportData.rows
          .map(
            (row) =>
              `<tr>${row
                .map((cell, idx) => {
                  const val = cell !== undefined && cell !== null ? cell : '-';
                  const alignStyle = idx === 1 ? 'text-align:right;' : 'text-align:center;';
                  return `<td style="${alignStyle}">${val}</td>`;
                })
                .join('')}</tr>`
          )
          .join('');

  // Table footer totals
  const totalCols = reportData.columns.length;
  let tableFootHtml = '';
  if (reportData.rows.length > 0) {
    tableFootHtml = `<tfoot>
      <tr>
        <td style="font-weight:bold; background:#ededed;">الإجمالـــي العام</td>
        ${Array.from({ length: Math.max(0, totalCols - 2) })
          .map(() => `<td style="background:#ededed;">-</td>`)
          .join('')}
        ${totalCols > 1 ? `<td style="font-weight:bold; background:#ededed; font-size:0.85rem;">${(reportData.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م</td>` : ''}
      </tr>
    </tfoot>`;
  }

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>${reportTitle} - ${companyName}</title>
<style>
  :root {
    --page-size: ${paperSize === 'A5' ? 'A5 portrait' : paperSize === 'Letter' ? 'letter portrait' : 'A4 portrait'};
    --page-margin: ${pageMargin}mm;
  }
  @page {
    size: var(--page-size, auto);
    margin: var(--page-margin, 0mm);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  
  html, body { 
    font-family: 'Segoe UI', Tahoma, Arial, sans-serif; 
    background-color: #f0f2f5; margin: 0; padding: 0; color: #000;
    width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center;
  }

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
  body.size-a5 .logo-img { max-height: 38px; }
  body.size-a5 .info-box { padding: 3px 5px; font-size: 0.68rem; }
  body.size-a5 .kpi-card { padding: 2px 4px; }
  body.size-a5 .kpi-card .kpi-title { font-size: 0.65rem; }
  body.size-a5 .kpi-card .kpi-value { font-size: 0.8rem; }
  body.size-a5 table th, body.size-a5 table td { padding: 2.5px 3.5px; font-size: 0.68rem; }
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
  body.size-80mm .kpi-grid {
    grid-template-columns: 1fr;
    gap: 3px;
  }
  body.size-80mm table th, body.size-80mm table td {
    padding: 2px 3px;
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
  body.size-58mm .kpi-grid {
    grid-template-columns: 1fr;
    gap: 2px;
  }
  body.size-58mm table th, body.size-58mm table td {
    padding: 1.5px 2px;
    font-size: 0.6rem;
  }

  body.orient-landscape .report-container { width: 100vw; height: auto; min-height: calc(100vh - 20px); }

  .report-container { 
    background: #fff; width: 100vw; height: calc(100vh - 20px); max-width: 100%;
    margin: 0 auto; padding: 5mm 7mm; border: 3px solid #000; 
    display: flex; flex-direction: column; justify-content: space-between;
    box-sizing: border-box;
  }

  /* 1. الترويسة */
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 5px; width: 100%; }
  .header-right h2 { margin: 0 0 2px 0; font-size: 1.1rem; font-weight: bold; }
  .header-right p { margin: 0; font-size: 0.75rem; color: #333; }
  .header-center { text-align: center; }
  .logo-img { max-width: 95px; max-height: 52px; object-fit: contain; }
  .header-left { text-align: left; }
  .phones-list { list-style: none; padding: 0; margin: 0; font-size: 0.75rem; direction: ltr; text-align: left; }
  .phones-list li { margin-bottom: 1px; font-weight: 600; }

  /* 2. صندوق بيانات الفلترة */
  .info-box { 
    display: flex; justify-content: space-between; align-items: center;
    border: 1.5px solid #000; padding: 4px 8px; margin-bottom: 6px; 
    font-size: 0.78rem; line-height: 1.35; width: 100%; background-color: #fafafa;
  }
  .info-item p { margin: 1px 0; }

  /* 3. شبكة المؤشرات (KPIs) */
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 6px; width: 100%; }
  .kpi-card { border: 1.5px solid #000; padding: 4px 6px; text-align: center; background-color: #f8f9fa; }
  .kpi-card .kpi-title { font-size: 0.7rem; font-weight: bold; color: #333; }
  .kpi-card .kpi-value { font-size: 0.92rem; font-weight: bold; margin-top: 2px; }

  /* 4. الجدول الديناميكي المتجاوب */
  .table-wrapper { width: 100%; flex-grow: 1; display: flex; flex-direction: column; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  th, td { border: 1px solid #000; padding: 3px 5px; text-align: center; font-size: 0.75rem; }
  th { background-color: #ededed; font-weight: bold; }
  tfoot tr { background-color: #f1f5f9; font-weight: bold; }

  /* 5. التوقيعات والتذييل */
  .bottom-section { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 4px; margin-bottom: 4px; width: 100%; font-size: 0.78rem; font-weight: bold; }
  .report-footer-note { border-top: 1.5px solid #000; padding-top: 3px; margin-top: auto; display: flex; justify-content: space-between; font-size: 0.72rem; font-weight: 600; width: 100%; }
  .copyright-outside { 
    width: 100%; 
    text-align: center; 
    font-size: 0.72rem; 
    font-weight: bold; 
    color: #000; 
    margin-top: auto;
    padding: 2px 0; 
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
    .report-container { 
      border: 3px solid #000 !important; 
      width: 100vw !important; 
      height: calc(100vh - 20px) !important; 
      min-height: calc(100vh - 20px) !important;
      max-height: calc(100vh - 20px) !important; 
      padding: 4mm 6mm !important; 
      box-sizing: border-box !important;
      box-shadow: none !important; 
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
      page-break-after: avoid !important;
      page-break-inside: avoid !important;
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
    .no-print { display: none !important; }
  }
</style>
</head>
<body>

<div class="no-print-toolbar no-print">
  <div class="toolbar-title-box">
    <span class="title-text">🖨️ معاينة وتخصيص الطباعة</span>
    <span class="doc-badge">${reportTitle}</span>
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
        <h2 id="settingCompanyName">${companyName}</h2>
        <p id="settingCompanyAddress">${companySubtitle}</p>
      </div>
      <div class="header-center">
        <img id="settingCompanyLogo" class="logo-img" src="${logoSrc}" alt="Logo" style="${showLogo ? '' : 'display:none;'}" />
      </div>
      <div class="header-left">
        <ul class="phones-list" id="settingPhonesList">
          ${finalPhones.map((p) => `<li>${p}</li>`).join('')}
        </ul>
      </div>
    </div>

    <!-- 2. صندوق بيانات الفلترة والبحث -->
    <div class="info-box">
      <div class="info-item" style="text-align: right;">
        <p><strong>اسم التقرير:</strong> <span style="font-weight:bold; font-size:0.85rem;">${reportTitle}</span></p>
        <p><strong>الفرع / النطاق:</strong> <span>${storeName}</span></p>
      </div>
      <div class="info-item" style="text-align: center;">
        <p><strong>الفترة من:</strong> <span>${fromStr}</span> <strong>إلى:</strong> <span>${toStr}</span></p>
        <p><strong>مُستخرج التقرير:</strong> <span>${createdBy}</span></p>
      </div>
      <div class="info-item" style="text-align: left;">
        <p><strong>تاريخ الاستخراج:</strong> <span>${printDate}</span></p>
        <p><strong>وقت الطباعة:</strong> <span>${printTime}</span></p>
      </div>
    </div>

    <!-- 3. كروت المؤشرات KPIs -->
    <div class="kpi-grid">
      ${kpisHtml}
    </div>

    <!-- 4. الجدول الديناميكي المتجاوب -->
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            ${tableHeadersHtml}
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
        ${tableFootHtml}
      </table>
    </div>

    <!-- 5. التوقيعات -->
    <div class="bottom-section">
      <div>إعداد / المحاسب المختص: ....................</div>
      <div>المراجع المالي: ....................</div>
      <div>اعتماد المدير العام: ....................</div>
    </div>
  </div>

  <div>
    <!-- التذييل الداخلي -->
    <div class="report-footer-note">
      <div>* هذا التقرير مستخرج من النظام الآلي ويعتبر وثيقة مراجعة داخلية معتمدة</div>
      <div>صفحة رقم: 1/1</div>
    </div>
  </div>
</div>

<!-- حقوق الملكية خارج الإطار الخارجي تماماً -->
<div class="copyright-outside">
  حقوق الملكية محفوظة Mohamed Nazih 01029190615
</div>

<script>
  function setCompanyHeader(companyData) {
    if (!companyData) return;
    if (companyData.companyName || companyData.name) {
      const el = document.getElementById('settingCompanyName');
      if (el) el.innerText = companyData.companyName || companyData.name;
    }
    if (companyData.address) {
      const el = document.getElementById('settingCompanyAddress');
      if (el) el.innerText = companyData.address;
    }
    const logoEl = document.getElementById('settingCompanyLogo');
    const logoSrc = companyData.logoUrl || companyData.logo || '';
    if (logoEl && logoSrc && companyData.showLogoInPrint !== false) {
      logoEl.src = logoSrc;
      logoEl.style.display = 'block';
    } else if (logoEl) {
      logoEl.style.display = 'none';
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

export function printReportWindow(
  reportData: ReportResult,
  appData: AppData,
  dateFrom?: string,
  dateTo?: string,
  showToast?: (msg: string, type: 'warning' | 'error' | 'success' | 'info') => void
) {
  const printWin = window.open('', '_blank', 'width=950,height=900');
  if (!printWin) {
    if (showToast) {
      showToast('يرجى السماح بالنوافذ المنبثقة للطباعة', 'warning');
    } else {
      alert('يرجى السماح بالنوافذ المنبثقة للطباعة');
    }
    return;
  }

  const html = generateReportPrintHtml(reportData, appData, dateFrom, dateTo);
  printWin.document.write(html);
  printWin.document.close();
}

