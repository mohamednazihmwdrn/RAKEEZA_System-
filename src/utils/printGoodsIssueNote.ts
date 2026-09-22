import { AppData, GoodsIssueVoucher, Settings } from '../types';
import { getPrintToolbarStyles, getPrintToolbarHtml, getPrintToolbarScript } from './printToolbarHelper';

/**
 * Generate Ultra-Precise HTML for Goods Issue Note (إذن صرف مخزني)
 * Built to 100% exact ERP standards matching official warehouse management systems.
 */
export function generateGoodsIssuePrintHtml(
  issue: GoodsIssueVoucher,
  appData: AppData
): string {
  const company = appData.settings || {
    companyName: 'منظومة RAKEEZA للمحاسبة والمستودعات',
    address: 'القاهرة، جمهورية مصر العربية',
    phone1: '01029190615',
    phone2: '',
    phone3: '',
    taxNumber: '123-456-789',
    currencySymbol: 'ج.م',
    showLogoInPrint: true,
    notes: '',
    defaultTaxRate: 14,
  };

  const currency = company.currencySymbol || 'ج.م';
  const issueDate = issue.date || new Date().toISOString().split('T')[0];
  const printTime =
    issue.time ||
    new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });

  const totalItemsCount = issue.items?.length || 0;
  const totalQty = issue.items?.reduce((sum, item) => sum + (Number(item.qty) || 0), 0) || 0;
  const grandTotalCost =
    issue.items?.reduce((sum, item) => sum + (Number(item.totalCost) || Number(item.qty) * Number(item.unitCost) || 0), 0) ||
    issue.totalCost ||
    0;

  const phoneNumbers = [company.phone1, company.phone2, company.phone3].filter(Boolean);
  const phonesHtml =
    phoneNumbers.length > 0
      ? phoneNumbers.map((p) => `<li>${p}</li>`).join('')
      : '<li>01029190615</li>';

  const logoSrc = (company.showLogoInPrint !== false && (company.logo || company.logoUrl)) ? (company.logo || company.logoUrl) : '';

  const tableRowsHtml = issue.items?.length
    ? issue.items
        .map(
          (item, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${item.code || `ITM-${String(idx + 1).padStart(3, '0')}`}</td>
        <td class="text-right">${item.name || 'صنف غير مسمى'}</td>
        <td>${item.unit || 'قطعة'}</td>
        <td class="amount-cell">${(Number(item.qty) || 0).toLocaleString('en-US')}</td>
        <td class="amount-cell">${(Number(item.unitCost) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td class="amount-cell">${(Number(item.totalCost) || Number(item.qty || 0) * Number(item.unitCost || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
    `
        )
        .join('')
    : `
      <tr>
        <td colspan="7" style="padding: 15px; color: #777;">لا توجد أصناف مسجلة في هذا الإذن</td>
      </tr>
    `;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>إذن صرف مخزني - ${issue.voucherNumber || 'GIN'}</title>
<style>
  @page { size: auto; margin: 0mm; }
  * { box-sizing: border-box; }
  
  html, body { 
    font-family: 'Segoe UI', Tahoma, Arial, sans-serif; 
    background-color: #f0f2f5; margin: 0; padding: 0; color: #000;
    width: 100%; min-height: 100%; display: flex; flex-direction: column; align-items: center;
  }

  .report-container { 
    background: #fff; width: 100vw; min-height: calc(100vh - 25px); max-width: 100%;
    margin: 0 auto; padding: 5mm 7mm; border: 3px solid #000; 
    display: flex; flex-direction: column; justify-content: space-between;
  }

  /* 1. الترويسة */
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 5px; width: 100%; }
  .header-right h2 { margin: 0 0 2px 0; font-size: 1.15rem; font-weight: bold; }
  .header-right p { margin: 0; font-size: 0.75rem; color: #333; }
  .phone-list { list-style: none; padding: 0; margin: 0; font-size: 0.75rem; direction: ltr; text-align: left; }
  .logo-img { max-height: 48px; max-width: 130px; object-fit: contain; }

  /* 2. بيانات إذن الصرف */
  .info-box { 
    display: flex; justify-content: space-between; border: 1.5px solid #000; 
    padding: 5px 10px; margin-bottom: 5px; font-size: 0.75rem; background: #fff; line-height: 1.4;
  }
  .info-item { display: flex; flex-direction: column; gap: 2px; }

  /* 3. كروت الإجماليات */
  .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 5px; }
  .kpi-card { border: 1.5px solid #000; padding: 4px; text-align: center; background: #fafafa; }
  .kpi-title { font-size: 0.7rem; font-weight: bold; color: #333; margin-bottom: 2px; }
  .kpi-value { font-size: 0.95rem; font-weight: bold; }
  .kpi-total { background: #eff6ff; border-color: #2563eb; color: #1d4ed8; }

  /* 4. الجدول */
  .table-container { flex-grow: 1; margin-bottom: 5px; }
  table { width: 100%; border-collapse: collapse; border: 1.5px solid #000; }
  th, td { border: 1px solid #000; padding: 3.5px 4px; font-size: 0.72rem; text-align: center; }
  th { background-color: #ededed; font-weight: bold; }
  .text-right { text-align: right; padding-right: 6px; }
  .amount-cell { font-family: Tahoma, sans-serif; font-weight: bold; }
  tfoot tr { background-color: #ededed; font-weight: bold; }

  /* 5. البيان والملاحظات */
  .notes-section { border: 1px solid #000; padding: 4px 8px; font-size: 0.72rem; margin-bottom: 5px; background: #fff; }
  .notes-title { font-weight: bold; margin-bottom: 2px; }

  /* 6. التوقيعات */
  .signatures { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.75rem; font-weight: bold; padding: 0 10px; }

  /* 7. التذييل */
  .footer { border-top: 1px solid #000; padding-top: 2px; display: flex; justify-content: space-between; font-size: 0.65rem; }
  
  .copyright-outside { font-size: 0.75rem; font-weight: bold; text-align: center; padding: 3px 0; width: 100%; color: #000; }

  /* شريط أدوات التحكم في المعاينة */
  .no-print {
    width: 100%;
    max-width: 1000px;
    margin: 8px auto 4px auto;
    padding: 8px 12px;
    background: #ffffff;
    border-radius: 8px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.1);
    display: flex;
    justify-content: space-between;
    align-items: center;
    direction: rtl;
  }
  ${getPrintToolbarStyles()}

  @media print {
    html, body { background: #fff; width: 100vw; height: 100vh; overflow: hidden; }
    .report-container { border: 2.5px solid #000; height: calc(100vh - 22px); width: 100vw; max-width: 100%; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>

  ${getPrintToolbarHtml('إذن صرف مخزني #' + (issue.voucherNumber || 'GIN'))}

  <div class="report-container">
    
    <!-- 1. الترويسة -->
    <div class="header">
      <div class="header-right">
        <h2>${company.companyName}</h2>
        <p>${company.address}</p>
        ${company.taxNumber ? `<p style="font-size:0.7rem; color:#555;">الرقم الضريبي: ${company.taxNumber}</p>` : ''}
      </div>
      <div class="header-center">
        ${logoSrc ? `<img src="${logoSrc}" alt="شعار المؤسسة" class="logo-img" onerror="this.style.display='none'">` : `<div style="font-weight:bold; font-size:0.9rem; color:#1a237e; border:1px dashed #999; padding:3px 8px; border-radius:4px;">${company.companyName}</div>`}
      </div>
      <div class="header-left">
        <ul class="phone-list">
          ${phonesHtml}
        </ul>
      </div>
    </div>

    <!-- 2. بيانات إذن الصرف -->
    <div class="info-box">
      <div class="info-item">
        <span><strong>نوع المستند:</strong> <span style="color: #dc2626; font-weight: bold;">إذن صرف مخزني</span></span>
        <span><strong>المخزن المحول منه:</strong> ${issue.sourceBranchName || 'المخزن الرئيسي'}</span>
      </div>
      <div class="info-item">
        <span><strong>رقم الإذن:</strong> ${issue.voucherNumber || 'GIN-2026-001'}</span>
        <span><strong>الجهة / المستلم:</strong> ${issue.recipientName || 'قسم الصيانة / التشغيل'}</span>
      </div>
      <div class="info-item">
        <span><strong>تاريخ الصرف:</strong> ${issueDate}</span>
        <span><strong>وقت الطباعة:</strong> ${printTime}</span>
      </div>
    </div>

    <!-- 3. كروت الإجماليات (KPIs) -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-title">عدد الأصناف المصروفة</div>
        <div class="kpi-value">${totalItemsCount} صنف</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">إجمالي عدد الكميات</div>
        <div class="kpi-value amount-cell">${(totalQty || 0).toLocaleString('en-US')}</div>
      </div>
      <div class="kpi-card kpi-total">
        <div class="kpi-title" style="color: #1d4ed8;">إجمالي التكلفة المصروفة</div>
        <div class="kpi-value amount-cell">${(grandTotalCost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}</div>
      </div>
    </div>

    <!-- 4. جدول الأصناف -->
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th style="width: 5%;">#</th>
            <th style="width: 15%;">كود الصنف</th>
            <th style="width: 30%;">اسم الصنف / الوصف</th>
            <th style="width: 10%;">الوحدة</th>
            <th style="width: 10%;">الكمية</th>
            <th style="width: 15%;">تكلفة الوحدة</th>
            <th style="width: 15%;">إجمالي التكلفة</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="4" class="text-right">الإجمالـــي العــام</td>
            <td class="amount-cell">${(totalQty || 0).toLocaleString('en-US')}</td>
            <td>-</td>
            <td class="amount-cell">${(grandTotalCost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- 5. البيان والملاحظات -->
    <div class="notes-section">
      <div class="notes-title">السبب / الغرض من الصرف:</div>
      <div>${issue.purposeReason || issue.notes || 'صرف مواد ومستلزمات تشغيل بناءً على طلب الاحتياج المعتمد.'}</div>
    </div>

    <!-- 6. التوقيعات -->
    <div class="signatures">
      <div>أمين المخزن: ${issue.warehouseKeeper || '....................'}</div>
      <div>المستلم / طالب الصرف: ${issue.recipientSignatory || '....................'}</div>
      <div>يعتمد / مدير المخازن: ${issue.approvedBy || '....................'}</div>
    </div>

    <!-- 7. التذييل -->
    <div class="footer">
      <div>* يعتبر المستلم مسؤولاً مسؤولية كاملة عن البضائع المذكورة أعلاه فور التوقيع بالاستلام.</div>
      <div>صفحة رقم: 1/1</div>
    </div>

  </div>

  <!-- حقوق الملكية خارج الإطار -->
  <div class="copyright-outside">
    حقوق الملكية محفوظة Mohamed Nazih 01029190615
  </div>

  ${getPrintToolbarScript()}
</body>
</html>`;
}

/**
 * Open Goods Issue Note print popup and trigger print dialog.
 */
export function printGoodsIssueNote(
  issue: GoodsIssueVoucher,
  appData: AppData,
  showToast?: (msg: string, type: any) => void
): void {
  const html = generateGoodsIssuePrintHtml(issue, appData);
  const printWindow = window.open('', '_blank', 'width=1000,height=850');

  if (!printWindow) {
    if (showToast) {
      showToast('يرجى السماح بالنوافذ المنبثقة (Popups) لمعاينة وطباعة إذن الصرف', 'warning');
    }
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  // Focus and optionally trigger print
  printWindow.focus();
}
