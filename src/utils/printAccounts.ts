import { AppData, AccountNode, CostCenter, Settings } from '../types';

/**
 * Print Chart of Accounts (دليل الحسابات الشجري)
 */
export function printAccountsTreeWindow(
  accounts: AccountNode[],
  computeStats: (code: string) => { totalDebit: number; totalCredit: number; balance: number },
  settings?: Settings
) {
  const compName = settings?.companyName || 'المنظومة المحاسبية المتكاملة';
  const compAddress = settings?.address || 'المركز الرئيسي - الإدارة المالية';
  const compPhones = [settings?.phone1, settings?.phone2, settings?.phone3].filter(Boolean) as string[];
  const finalPhones = compPhones.length > 0 ? compPhones : ['01029190615'];
  const compLogo = settings?.logo || settings?.logoUrl || '';
  const dateStr = new Date().toLocaleDateString('ar-EG');
  const timeStr = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  // Calculate totals
  const totalAssets = accounts
    .filter((a) => a.type === 'asset' && !a.isParent)
    .reduce((sum, a) => sum + computeStats(a.code).balance, 0);

  const totalLiabilities = accounts
    .filter((a) => a.type === 'liability' && !a.isParent)
    .reduce((sum, a) => sum + computeStats(a.code).balance, 0);

  const totalEquities = accounts
    .filter((a) => a.type === 'equity' && !a.isParent)
    .reduce((sum, a) => sum + computeStats(a.code).balance, 0);

  const totalRevenues = accounts
    .filter((a) => a.type === 'revenue' && !a.isParent)
    .reduce((sum, a) => sum + computeStats(a.code).balance, 0);

  const totalExpenses = accounts
    .filter((a) => a.type === 'expense' && !a.isParent)
    .reduce((sum, a) => sum + computeStats(a.code).balance, 0);

  const getTypeNameAr = (type: string) => {
    switch (type) {
      case 'asset':
        return 'أصول (Assets)';
      case 'liability':
        return 'خصوم (Liabilities)';
      case 'equity':
        return 'حقوق ملكية (Equity)';
      case 'revenue':
        return 'إيرادات (Revenues)';
      case 'expense':
        return 'مصروفات (Expenses)';
      default:
        return type;
    }
  };

  const rowsHtml = accounts
    .map((acc, idx) => {
      const stats = computeStats(acc.code);
      const isParent = acc.isParent || !acc.parentCode;
      const rowClass = isParent ? 'bg-slate-100 font-bold' : '';
      const indent = acc.parentCode ? (acc.code.length > 3 ? '&nbsp;&nbsp;&nbsp;&nbsp;↳ ' : '&nbsp;&nbsp;↳ ') : '';

      return `
        <tr style="${isParent ? 'background-color: #f1f5f9; font-weight: bold;' : ''}">
          <td style="text-align: center;">${idx + 1}</td>
          <td style="text-align: center; font-family: monospace; font-weight: bold; color: #1e1b4b;">${acc.code}</td>
          <td style="text-align: right;">${indent}${acc.name}</td>
          <td style="text-align: center; font-size: 0.85em;">${getTypeNameAr(acc.type)}</td>
          <td style="text-align: center; font-family: monospace;">${acc.parentCode || '-'}</td>
          <td style="text-align: right; font-family: monospace; color: #047857;">${(stats?.totalDebit || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
          <td style="text-align: right; font-family: monospace; color: #be123c;">${(stats?.totalCredit || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
          <td style="text-align: right; font-family: monospace; font-weight: bold; color: ${(stats?.balance || 0) >= 0 ? '#047857' : '#be123c'};">${(stats?.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        </tr>
      `;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>دليل الحسابات الشجري - ${compName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
    body { background: #525659; padding: 10px; display: flex; flex-direction: column; align-items: center; }

    .no-print-toolbar {
      position: sticky; top: 0; z-index: 9999;
      background: #0f172a; color: #fff; width: 100%; padding: 8px 16px;
      display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center;
      gap: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }
    .toolbar-title-box { display: flex; align-items: center; gap: 8px; }
    .toolbar-title-box .title-text { font-weight: bold; font-size: 13.5px; color: #fff; }
    .toolbar-title-box .doc-badge { background: #334155; color: #93c5fd; padding: 2px 8px; border-radius: 4px; font-size: 11.5px; font-weight: 600; }
    .toolbar-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .toolbar-field { display: flex; align-items: center; gap: 5px; font-size: 12px; }
    .toolbar-field label { color: #cbd5e1; font-weight: 600; white-space: nowrap; }
    .toolbar-select { padding: 5px 9px; border-radius: 6px; border: 1px solid #475569; background: #1e293b; color: #fff; font-size: 12px; font-weight: 600; cursor: pointer; outline: none; }
    .btn-print { background: #16a34a; color: #fff; border: none; padding: 6px 18px; border-radius: 6px; font-weight: bold; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.25); }
    .btn-print:hover { background: #15803d; }
    .btn-close { background: #475569; color: #fff; border: none; padding: 6px 14px; border-radius: 6px; font-size: 12px; cursor: pointer; }

    .report-container {
      background: #fff; width: 100vw; min-height: 98vh; max-width: 100%;
      margin: 0 auto; padding: 5mm 7mm; border: 3px solid #000;
      display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box;
    }

    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 5px; }
    .header-right { text-align: right; width: 33%; }
    .header-right h2 { font-size: 1.15rem; font-weight: bold; color: #000; }
    .header-right p { font-size: 0.75rem; color: #333; margin-top: 1px; }
    .header-center { text-align: center; width: 34%; }
    .logo-img { max-height: 50px; max-width: 120px; object-fit: contain; }
    .header-left { text-align: left; width: 33%; font-size: 0.75rem; }
    .phones-list { list-style: none; }

    .info-box { display: flex; justify-content: space-between; align-items: center; border: 1.5px solid #000; background: #fff; padding: 4px 8px; margin-bottom: 6px; font-size: 0.78rem; }
    .info-box p { margin: 1px 0; }

    .kpis-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; margin-bottom: 6px; }
    .kpi-card { border: 1px solid #000; padding: 3px 5px; text-align: center; background: #f8fafc; }
    .kpi-card .kpi-title { font-size: 0.7rem; font-weight: bold; color: #475569; }
    .kpi-card .kpi-val { font-size: 0.85rem; font-weight: bold; font-family: monospace; color: #0f172a; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 0.75rem; }
    table th, table td { border: 1px solid #000; padding: 3.5px 5px; }
    table th { background: #ededed; color: #000; font-weight: bold; text-align: center; }

    .report-footer-note { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #000; padding-top: 4px; font-size: 0.75rem; color: #222; }
    .copyright-outside { text-align: center; font-size: 0.72rem; color: #fff; padding: 4px 0; font-weight: 500; }

    /* THERMAL 80MM STYLES */
    body.size-80mm { background: #fff; padding: 0; font-size: 11px; }
    body.size-80mm .report-container { width: 76mm; min-height: auto; border: none; padding: 2mm; margin: 0 auto; }
    body.size-80mm .header { flex-direction: column; border-bottom: 1px dashed #000; text-align: center; }
    body.size-80mm .header-right, body.size-80mm .header-center, body.size-80mm .header-left { width: 100%; text-align: center; }
    body.size-80mm .info-box { flex-direction: column; text-align: center; border: 1px dashed #000; }
    body.size-80mm .kpis-grid { grid-template-columns: repeat(2, 1fr); }
    body.size-80mm table { font-size: 9.5px; }
    body.size-80mm table th, body.size-80mm table td { padding: 2px 3px; }
    body.size-80mm .copyright-outside { color: #000; font-size: 9px; }

    body.size-58mm { background: #fff; padding: 0; font-size: 9.5px; }
    body.size-58mm .report-container { width: 54mm; min-height: auto; border: none; padding: 1mm; margin: 0 auto; }
    body.size-58mm .header { flex-direction: column; text-align: center; border-bottom: 1px dashed #000; }
    body.size-58mm .header-right, body.size-58mm .header-center, body.size-58mm .header-left { width: 100%; text-align: center; }
    body.size-58mm .info-box { flex-direction: column; text-align: center; border: 1px dashed #000; }
    body.size-58mm .kpis-grid { grid-template-columns: 1fr; }
    body.size-58mm table { font-size: 8px; }
    body.size-58mm table th, body.size-58mm table td { padding: 1.5px 2px; }
    body.size-58mm .copyright-outside { color: #000; font-size: 8px; }

    @media print {
      body { background: #fff; padding: 0; }
      .no-print-toolbar, .no-print { display: none !important; }
      .report-container { border: 2.5px solid #000; }
      .copyright-outside { color: #000; }
      body.size-80mm .report-container, body.size-58mm .report-container { border: none; }
    }
  </style>
</head>
<body>

<div class="no-print-toolbar no-print">
  <div class="toolbar-title-box">
    <span class="title-text">🖨️ معاينة وتخصيص دليل الحسابات</span>
    <span class="doc-badge">إجمالي الحسابات: ${accounts.length}</span>
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
    <!-- الترويسة -->
    <div class="header">
      <div class="header-right">
        <h2>${compName}</h2>
        <p>${compAddress}</p>
      </div>
      <div class="header-center">
        ${compLogo ? `<img class="logo-img" src="${compLogo}" alt="شعار">` : `<div style="font-size:11px;border:1px dashed #999;padding:4px 8px;border-radius:4px;">دليل الحسابات العام</div>`}
      </div>
      <div class="header-left">
        <ul class="phones-list">
          ${compPhones.map((ph) => `<li>📞 ${ph}</li>`).join('')}
        </ul>
      </div>
    </div>

    <!-- صندوق معلومات التقرير -->
    <div class="info-box">
      <div style="text-align: right;">
        <p><strong>اسم التقرير:</strong> دليل الحسابات الشجري العام والأرصدة</p>
        <p><strong>طبيعة الدليل:</strong> هيكل محاسبي موحد (Double Entry)</p>
      </div>
      <div style="text-align: center;">
        <p><strong>عدد الحسابات المسجلة:</strong> <strong>${accounts.length} حساب</strong></p>
      </div>
      <div style="text-align: left;">
        <p><strong>تاريخ الطباعة:</strong> ${dateStr}</p>
        <p><strong>الوقت:</strong> ${timeStr}</p>
      </div>
    </div>

    <!-- KPIs -->
    <div class="kpis-grid">
      <div class="kpi-card">
        <div class="kpi-title">إجمالي الأصول</div>
        <div class="kpi-val">${(totalAssets || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">إجمالي الخصوم</div>
        <div class="kpi-val">${(totalLiabilities || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">حقوق الملكية</div>
        <div class="kpi-val">${(totalEquities || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">إجمالي الإيرادات</div>
        <div class="kpi-val">${(totalRevenues || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">إجمالي المصروفات</div>
        <div class="kpi-val">${(totalExpenses || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م</div>
      </div>
    </div>

    <!-- الجدول -->
    <table>
      <thead>
        <tr>
          <th style="width: 35px;">#</th>
          <th style="width: 75px;">كود الحساب</th>
          <th>اسم الحساب المحاسبي</th>
          <th style="width: 110px;">النوع المحاسبي</th>
          <th style="width: 75px;">الحساب الأب</th>
          <th style="width: 85px;">إجمالي المدين</th>
          <th style="width: 85px;">إجمالي الدائن</th>
          <th style="width: 95px;">الرصيد الصافي</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  </div>

  <div>
    <div class="report-footer-note">
      <div>تم استخراج الدليل واعتماده محاسبياً وفقاً لمعايير المحاسبة العامة المعتمدة</div>
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

  const w = window.open('', '_blank', 'width=1100,height=900');
  if (w) {
    w.document.open();
    w.document.write(html);
    w.document.close();
  }
}

/**
 * Print Cost Centers (مراكز التكلفة والمشاريع)
 */
export function printCostCentersWindow(
  costCenters: CostCenter[],
  journalEntries: any[],
  settings?: Settings
) {
  const compName = settings?.companyName || 'المنظومة المحاسبية المتكاملة';
  const compAddress = settings?.address || 'المركز الرئيسي - إدارة المشاريع والتكاليف';
  const compPhones = [settings?.phone1, settings?.phone2, settings?.phone3].filter(Boolean) as string[];
  const finalPhones = compPhones.length > 0 ? compPhones : ['01029190615'];
  const compLogo = settings?.logo || settings?.logoUrl || '';
  const dateStr = new Date().toLocaleDateString('ar-EG');
  const timeStr = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  // Calculate movements per cost center
  const rowsHtml = costCenters
    .map((cc, idx) => {
      let totalDebits = 0;
      let totalCredits = 0;
      let count = 0;

      journalEntries.forEach((entry) => {
        entry.lines.forEach((line: any) => {
          if (line.costCenter === cc.name || line.costCenter === cc.code) {
            totalDebits += line.debit || 0;
            totalCredits += line.credit || 0;
            count += 1;
          }
        });
      });

      const netBalance = totalDebits - totalCredits;

      return `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td style="text-align: center; font-family: monospace; font-weight: bold; color: #1e1b4b;">${cc.code}</td>
          <td style="text-align: right; font-weight: bold;">${cc.name}</td>
          <td style="text-align: center;">${cc.manager || 'المدير العام'}</td>
          <td style="text-align: center; font-family: monospace;">${count} حركة</td>
          <td style="text-align: right; font-family: monospace; color: #047857;">${(totalDebits || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
          <td style="text-align: right; font-family: monospace; color: #be123c;">${(totalCredits || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
          <td style="text-align: right; font-family: monospace; font-weight: bold; color: ${netBalance >= 0 ? '#047857' : '#be123c'};">${(netBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        </tr>
      `;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>تقرير مراكز التكلفة والمشاريع - ${compName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
    body { background: #525659; padding: 10px; display: flex; flex-direction: column; align-items: center; }

    .no-print-toolbar {
      position: sticky; top: 0; z-index: 9999;
      background: #0f172a; color: #fff; width: 100%; padding: 8px 16px;
      display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center;
      gap: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }
    .toolbar-title-box { display: flex; align-items: center; gap: 8px; }
    .toolbar-title-box .title-text { font-weight: bold; font-size: 13.5px; color: #fff; }
    .toolbar-title-box .doc-badge { background: #334155; color: #93c5fd; padding: 2px 8px; border-radius: 4px; font-size: 11.5px; font-weight: 600; }
    .toolbar-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .toolbar-field { display: flex; align-items: center; gap: 5px; font-size: 12px; }
    .toolbar-field label { color: #cbd5e1; font-weight: 600; white-space: nowrap; }
    .toolbar-select { padding: 5px 9px; border-radius: 6px; border: 1px solid #475569; background: #1e293b; color: #fff; font-size: 12px; font-weight: 600; cursor: pointer; outline: none; }
    .btn-print { background: #16a34a; color: #fff; border: none; padding: 6px 18px; border-radius: 6px; font-weight: bold; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.25); }
    .btn-print:hover { background: #15803d; }
    .btn-close { background: #475569; color: #fff; border: none; padding: 6px 14px; border-radius: 6px; font-size: 12px; cursor: pointer; }

    .report-container {
      background: #fff; width: 100vw; min-height: 98vh; max-width: 100%;
      margin: 0 auto; padding: 5mm 7mm; border: 3px solid #000;
      display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box;
    }

    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 5px; }
    .header-right { text-align: right; width: 33%; }
    .header-right h2 { font-size: 1.15rem; font-weight: bold; color: #000; }
    .header-right p { font-size: 0.75rem; color: #333; margin-top: 1px; }
    .header-center { text-align: center; width: 34%; }
    .logo-img { max-height: 50px; max-width: 120px; object-fit: contain; }
    .header-left { text-align: left; width: 33%; font-size: 0.75rem; }
    .phones-list { list-style: none; }

    .info-box { display: flex; justify-content: space-between; align-items: center; border: 1.5px solid #000; background: #fff; padding: 4px 8px; margin-bottom: 6px; font-size: 0.78rem; }
    .info-box p { margin: 1px 0; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 0.75rem; }
    table th, table td { border: 1px solid #000; padding: 4px 6px; }
    table th { background: #ededed; color: #000; font-weight: bold; text-align: center; }

    .report-footer-note { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #000; padding-top: 4px; font-size: 0.75rem; color: #222; }
    .copyright-outside { text-align: center; font-size: 0.72rem; color: #fff; padding: 4px 0; font-weight: 500; }

    /* THERMAL 80MM */
    body.size-80mm { background: #fff; padding: 0; font-size: 11px; }
    body.size-80mm .report-container { width: 76mm; min-height: auto; border: none; padding: 2mm; margin: 0 auto; }
    body.size-80mm .header { flex-direction: column; text-align: center; border-bottom: 1px dashed #000; }
    body.size-80mm .header-right, body.size-80mm .header-center, body.size-80mm .header-left { width: 100%; text-align: center; }
    body.size-80mm .info-box { flex-direction: column; text-align: center; border: 1px dashed #000; }
    body.size-80mm table { font-size: 9.5px; }
    body.size-80mm table th, body.size-80mm table td { padding: 2px 3px; }
    body.size-80mm .copyright-outside { color: #000; font-size: 9px; }

    body.size-58mm { background: #fff; padding: 0; font-size: 9.5px; }
    body.size-58mm .report-container { width: 54mm; min-height: auto; border: none; padding: 1mm; margin: 0 auto; }
    body.size-58mm .header { flex-direction: column; text-align: center; border-bottom: 1px dashed #000; }
    body.size-58mm .header-right, body.size-58mm .header-center, body.size-58mm .header-left { width: 100%; text-align: center; }
    body.size-58mm .info-box { flex-direction: column; text-align: center; border: 1px dashed #000; }
    body.size-58mm table { font-size: 8px; }
    body.size-58mm table th, body.size-58mm table td { padding: 1.5px 2px; }
    body.size-58mm .copyright-outside { color: #000; font-size: 8px; }

    @media print {
      body { background: #fff; padding: 0; }
      .no-print-toolbar, .no-print { display: none !important; }
      .report-container { border: 2.5px solid #000; }
      .copyright-outside { color: #000; }
      body.size-80mm .report-container, body.size-58mm .report-container { border: none; }
    }
  </style>
</head>
<body>

<div class="no-print-toolbar no-print">
  <div class="toolbar-title-box">
    <span class="title-text">🖨️ معاينة وتخصيص مراكز التكلفة</span>
    <span class="doc-badge">إجمالي المراكز: ${costCenters.length}</span>
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
    <!-- الترويسة -->
    <div class="header">
      <div class="header-right">
        <h2>${compName}</h2>
        <p>${compAddress}</p>
      </div>
      <div class="header-center">
        ${compLogo ? `<img class="logo-img" src="${compLogo}" alt="شعار">` : `<div style="font-size:11px;border:1px dashed #999;padding:4px 8px;border-radius:4px;">مراكز التكلفة والمشاريع</div>`}
      </div>
      <div class="header-left">
        <ul class="phones-list">
          ${compPhones.map((ph) => `<li>📞 ${ph}</li>`).join('')}
        </ul>
      </div>
    </div>

    <!-- صندوق معلومات التقرير -->
    <div class="info-box">
      <div style="text-align: right;">
        <p><strong>اسم التقرير:</strong> تقرير مراكز التكلفة والمشاريع والأقسام</p>
        <p><strong>الهدف:</strong> قياس الأداء وتوزيع التكاليف والإيرادات التشغيلية</p>
      </div>
      <div style="text-align: center;">
        <p><strong>عدد المراكز والمشاريع:</strong> <strong>${costCenters.length} مركز</strong></p>
      </div>
      <div style="text-align: left;">
        <p><strong>تاريخ الطباعة:</strong> ${dateStr}</p>
        <p><strong>الوقت:</strong> ${timeStr}</p>
      </div>
    </div>

    <!-- الجدول -->
    <table>
      <thead>
        <tr>
          <th style="width: 35px;">#</th>
          <th style="width: 80px;">كود المركز</th>
          <th>اسم مركز التكلفة / المشروع</th>
          <th style="width: 130px;">المسؤول / المشرف</th>
          <th style="width: 80px;">الحركات</th>
          <th style="width: 95px;">إجمالي المدين</th>
          <th style="width: 95px;">إجمالي الدائن</th>
          <th style="width: 100px;">صافي الرصيد</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  </div>

  <div>
    <div class="report-footer-note">
      <div>تم استخراج تقرير مراكز التكلفة بدقة واعتماده محاسبياً</div>
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

  const w = window.open('', '_blank', 'width=1100,height=900');
  if (w) {
    w.document.open();
    w.document.write(html);
    w.document.close();
  }
}
