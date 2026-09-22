import { AppData, StocktakeSession, InventoryAdjustmentVoucher, FiscalYearClosingRecord, Settings } from '../types';
import { getPrintToolbarStyles, getPrintToolbarHtml, getPrintToolbarScript } from './printToolbarHelper';
export { generateGoodsIssuePrintHtml, printGoodsIssueNote } from './printGoodsIssueNote';

/**
 * Generates the unified print HTML for Physical Inventory Count & Stocktake Sessions (جلسة الجرد الفعلي)
 */
export function generateStocktakePrintHtml(session: StocktakeSession, appData: AppData): string {
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

  const now = new Date();
  const printDate = session.date || now.toLocaleDateString('ar-EG');
  const printTime = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  const currentUserObj = appData.users.find((u) => u.id === appData.currentUser) || appData.users[0];
  const officerName = session.createdBy || currentUserObj?.name || 'Mohamed Nazih';

  // Metrics Calculation
  const totalItemsCounted = session.items?.length || 0;
  const matchedItems = session.items?.filter((i) => (i.varianceQty || 0) === 0).length || 0;
  const totalShortageValue = session.totalShortageValue || session.items?.reduce((sum, i) => i.varianceQty < 0 ? sum + Math.abs(i.varianceCostTotal || 0) : sum, 0) || 0;
  const totalSurplusValue = session.totalSurplusValue || session.items?.reduce((sum, i) => i.varianceQty > 0 ? sum + Math.abs(i.varianceCostTotal || 0) : sum, 0) || 0;

  // Totals for table footer
  let totalBookQty = 0;
  let totalCountedQty = 0;
  let netVarianceQty = 0;
  let netSettlementValue = 0;

  const rowsHtml = (session.items || [])
    .map((item, idx) => {
      const bookQ = item.bookQty || 0;
      const countQ = item.countedQty || 0;
      const varQ = item.varianceQty !== undefined ? item.varianceQty : countQ - bookQ;
      const cost = item.costPrice || 0;
      const varVal = item.varianceCostTotal !== undefined ? item.varianceCostTotal : varQ * cost;

      totalBookQty += bookQ;
      totalCountedQty += countQ;
      netVarianceQty += varQ;
      netSettlementValue += varVal;

      let varQClass = '';
      let varQText = `${varQ}`;
      if (varQ < 0) {
        varQClass = 'deficit';
        varQText = `- ${Math.abs(varQ)}`;
      } else if (varQ > 0) {
        varQClass = 'surplus';
        varQText = `+ ${varQ}`;
      } else {
        varQText = '0';
      }

      let varValClass = '';
      let varValText = `${varVal.toFixed(2)}`;
      if (varVal < 0) {
        varValClass = 'deficit';
        varValText = `- ${Math.abs(varVal).toFixed(2)}`;
      } else if (varVal > 0) {
        varValClass = 'surplus';
        varValText = `+ ${varVal.toFixed(2)}`;
      } else {
        varValText = '0.00';
      }

      const itemObj = appData.items.find((it) => it.id === item.itemId);
      const itemCode = item.barcode || itemObj?.barcode || `ITM-${String(idx + 101).padStart(3, '0')}`;
      const unit = itemObj?.unit || 'قطعة';
      const reason = item.notes || (varQ === 0 ? 'مطابق' : varQ < 0 ? 'عجز في الجرد' : 'زيادة رصيد');

      return `<tr>
        <td>${itemCode}</td>
        <td style="text-align: right; font-weight: 600;">${item.itemName}</td>
        <td>${unit}</td>
        <td>${bookQ}</td>
        <td>${countQ}</td>
        <td class="${varQClass}">${varQText}</td>
        <td>${cost.toFixed(2)}</td>
        <td class="${varValClass}">${varValText}</td>
        <td>${reason}</td>
      </tr>`;
    })
    .join('');

  const netVarianceClass = netVarianceQty < 0 ? 'deficit' : netVarianceQty > 0 ? 'surplus' : '';
  const netVarianceText = netVarianceQty < 0 ? `- ${Math.abs(netVarianceQty)}` : netVarianceQty > 0 ? `+ ${netVarianceQty}` : '0';
  const netSettlementClass = netSettlementValue < 0 ? 'deficit' : netSettlementValue > 0 ? 'surplus' : '';
  const netSettlementText = netSettlementValue < 0 ? `- ${Math.abs(netSettlementValue).toFixed(2)}` : netSettlementValue > 0 ? `+ ${netSettlementValue.toFixed(2)}` : '0.00';

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>تقرير الجرد والتسوية المخزنية - ${session.sessionNumber || ''}</title>
<style>
  :root {
    --page-size: ${paperSize === 'A5' ? 'A5 portrait' : paperSize === 'Letter' ? 'letter portrait' : 'A4 portrait'};
    --page-margin: ${pageMargin}mm;
  }
  @page { size: var(--page-size, auto); margin: var(--page-margin, 0mm); }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  
  html, body { 
    font-family: 'Segoe UI', Tahoma, Arial, sans-serif; 
    background-color: #f0f2f5; margin: 0; padding: 0; color: #000;
    width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center;
  }

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
  .logo-img { max-width: 85px; max-height: 50px; object-fit: contain; }
  .header-left { text-align: left; }
  .phones-list { list-style: none; padding: 0; margin: 0; font-size: 0.75rem; direction: ltr; text-align: left; }
  .phones-list li { margin-bottom: 1px; font-weight: 600; }

  /* 2. صندوق البيانات والفلترة */
  .info-box { 
    display: flex; justify-content: space-between; align-items: center;
    border: 1.5px solid #000; padding: 4px 8px; margin-bottom: 6px; 
    font-size: 0.78rem; line-height: 1.35; width: 100%; background-color: #fafafa;
  }
  .info-item p { margin: 1px 0; }

  /* 3. كروت الإحصائيات (KPIs) */
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 6px; width: 100%; }
  .kpi-card { border: 1.5px solid #000; padding: 4px 6px; text-align: center; background-color: #f8f9fa; }
  .kpi-card .kpi-title { font-size: 0.7rem; font-weight: bold; color: #333; }
  .kpi-card .kpi-value { font-size: 0.92rem; font-weight: bold; margin-top: 2px; }

  /* 4. الجدول */
  .table-wrapper { width: 100%; flex-grow: 1; display: flex; flex-direction: column; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  th, td { border: 1px solid #000; padding: 3px 4px; text-align: center; font-size: 0.73rem; }
  th { background-color: #ededed; font-weight: bold; }
  tfoot tr { background-color: #f1f5f9; font-weight: bold; }

  /* تمييز حالات العجز والزيادة */
  .deficit { color: #dc2626; font-weight: bold; }
  .surplus { color: #16a34a; font-weight: bold; }

  /* 5. التوقيعات */
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
  ${getPrintToolbarStyles()}
</style>
</head>
<body>

${getPrintToolbarHtml('محضر الجرد الفعلي #' + (session.sessionNumber || 'INV'))}

<div class="report-container">
  <div>
    <!-- الترويسة -->
    <div class="header">
      <div class="header-right">
        <h2>${companyName}</h2>
        <p>${companySubtitle}</p>
      </div>
      <div class="header-center">
        ${showLogo ? `<img src="${logoSrc}" alt="Logo" class="logo-img" />` : ''}
      </div>
      <div class="header-left">
        <ul class="phones-list">
          ${finalPhones.map((p) => `<li>${p}</li>`).join('')}
        </ul>
      </div>
    </div>

    <!-- صندوق البيانات والفلترة -->
    <div class="info-box">
      <div class="info-item" style="text-align: right;">
        <p><strong>نوع التقرير:</strong> <span style="font-weight:bold; font-size:0.85rem;">تقرير الجرد والتسوية المخزنية</span></p>
        <p><strong>المخزن / الفرع:</strong> <span>${session.branchName || 'المخزن الرئيسي - 01'}</span></p>
      </div>
      <div class="info-item" style="text-align: center;">
        <p><strong>رقم مذكرة الجرد:</strong> <span>${session.sessionNumber || 'INV-2026-01'}</span></p>
        <p><strong>مسؤول الجرد:</strong> <span>${officerName}</span></p>
      </div>
      <div class="info-item" style="text-align: left;">
        <p><strong>تاريخ الجرد:</strong> <span>${printDate}</span></p>
        <p><strong>وقت الاعتماد:</strong> <span>${printTime}</span></p>
      </div>
    </div>

    <!-- كروت المؤشرات المعدلة والمطبقة حاسبياً -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-title">إجمالي الأصناف المجرودة</div>
        <div class="kpi-value">${totalItemsCounted} صنف</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">أصناف متطابقة</div>
        <div class="kpi-value" style="color:#16a34a;">${matchedItems} صنف</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">قيمة العجز الإجمالي</div>
        <div class="kpi-value deficit">- ${(totalShortageValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">قيمة الزيادة الإجمالية</div>
        <div class="kpi-value surplus">+ ${(totalSurplusValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م</div>
      </div>
    </div>

    <!-- جدول الجرد والتسوية -->
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th style="width: 8%;">كود الصنف</th>
            <th style="width: 25%; text-align: right;">اسم الصنف</th>
            <th style="width: 7%;">الوحدة</th>
            <th style="width: 9%;">الرصيد الدفتري</th>
            <th style="width: 9%;">الرصيد الفعلي</th>
            <th style="width: 8%;">فرق الكمية</th>
            <th style="width: 10%;">تكلفة الوحدة</th>
            <th style="width: 12%;">قيمة التسوية</th>
            <th style="width: 12%;">البيان / السبب</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || `<tr><td colspan="9" style="padding:15px;color:#888;">لا توجد أصناف في هذه الجلسة</td></tr>`}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3">الإجمالـــي العام</td>
            <td>${totalBookQty}</td>
            <td>${totalCountedQty}</td>
            <td class="${netVarianceClass}">${netVarianceText}</td>
            <td>-</td>
            <td class="${netSettlementClass}">${netSettlementText}</td>
            <td>صافي التسوية</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- لجنة الجرد والتوقيعات -->
    <div class="bottom-section">
      <div>أمين المخزن: ....................</div>
      <div>رئيس لجنة الجرد: ....................</div>
      <div>يعتمد / المدير المالي: ....................</div>
    </div>
  </div>

  <div>
    <div class="report-footer-note">
      <div>* هذا التقرير يعتبر إذن تسوية مخزنية معتمد بعد التوقيع ولا يجوز التعديل عليه بعد الاعتماد</div>
      <div>صفحة رقم: 1/1</div>
    </div>
  </div>
</div>

<div class="copyright-outside">
  حقوق الملكية محفوظة Mohamed Nazih 01029190615
</div>

${getPrintToolbarScript()}
</body>
</html>`;
}

/**
 * Generates the unified print HTML for Inventory Settlement Vouchers (سندات تسوية المخزون)
 */
export function generateSettlementPrintHtml(voucher: InventoryAdjustmentVoucher, appData: AppData): string {
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

  const now = new Date();
  const printDate = voucher.date || now.toLocaleDateString('ar-EG');
  const printTime = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  const totalItemsCount = voucher.items?.length || 0;
  const shortageCount = voucher.items?.filter((i) => i.varianceType === 'shortage').length || 0;
  const surplusCount = voucher.items?.filter((i) => i.varianceType === 'surplus').length || 0;

  let totalBookQty = 0;
  let totalNewQty = 0;
  let netAdjustedQty = 0;

  const rowsHtml = (voucher.items || [])
    .map((item, idx) => {
      const bookQ = item.bookQtyBefore || 0;
      const adjQ = item.adjustedQty || 0;
      const newQ = item.newStockQty || 0;
      const cost = item.unitCost || 0;
      const totalAmt = item.totalAmount || Math.abs(adjQ * cost);

      totalBookQty += bookQ;
      totalNewQty += newQ;
      netAdjustedQty += adjQ;

      const isShortage = item.varianceType === 'shortage';
      const adjClass = isShortage ? 'deficit' : 'surplus';
      const adjText = isShortage ? `- ${Math.abs(adjQ)}` : `+ ${adjQ}`;
      const amtClass = isShortage ? 'deficit' : 'surplus';
      const amtText = isShortage ? `- ${totalAmt.toFixed(2)}` : `+ ${totalAmt.toFixed(2)}`;

      const itemObj = appData.items.find((it) => it.id === item.itemId);
      const itemCode = itemObj?.barcode || `ITM-${String(idx + 101).padStart(3, '0')}`;
      const unit = itemObj?.unit || 'قطعة';

      return `<tr>
        <td>${itemCode}</td>
        <td style="text-align: right; font-weight: 600;">${item.itemName}</td>
        <td>${unit}</td>
        <td>${bookQ}</td>
        <td>${newQ}</td>
        <td class="${adjClass}">${adjText}</td>
        <td>${cost.toFixed(2)}</td>
        <td class="${amtClass}">${amtText}</td>
        <td>${item.reason || (isShortage ? 'عجز تسوية' : 'فائض تسوية')}</td>
      </tr>`;
    })
    .join('');

  const netAdjClass = netAdjustedQty < 0 ? 'deficit' : netAdjustedQty > 0 ? 'surplus' : '';
  const netAdjText = netAdjustedQty < 0 ? `- ${Math.abs(netAdjustedQty)}` : netAdjustedQty > 0 ? `+ ${netAdjustedQty}` : '0';
  const netAmt = voucher.netAdjustmentAmount || (voucher.totalSurplusAmount - voucher.totalShortageAmount);
  const netAmtClass = netAmt < 0 ? 'deficit' : netAmt > 0 ? 'surplus' : '';
  const netAmtText = netAmt < 0 ? `- ${Math.abs(netAmt).toFixed(2)}` : netAmt > 0 ? `+ ${netAmt.toFixed(2)}` : '0.00';

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>سند تسوية المخزون - ${voucher.voucherNumber}</title>
<style>
  :root {
    --page-size: ${paperSize === 'A5' ? 'A5 portrait' : paperSize === 'Letter' ? 'letter portrait' : 'A4 portrait'};
    --page-margin: ${pageMargin}mm;
  }
  @page { size: var(--page-size, auto); margin: var(--page-margin, 0mm); }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  
  html, body { 
    font-family: 'Segoe UI', Tahoma, Arial, sans-serif; 
    background-color: #f0f2f5; margin: 0; padding: 0; color: #000;
    width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center;
  }

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
  .logo-img { max-width: 85px; max-height: 50px; object-fit: contain; }
  .header-left { text-align: left; }
  .phones-list { list-style: none; padding: 0; margin: 0; font-size: 0.75rem; direction: ltr; text-align: left; }
  .phones-list li { margin-bottom: 1px; font-weight: 600; }

  /* 2. صندوق البيانات */
  .info-box { 
    display: flex; justify-content: space-between; align-items: center;
    border: 1.5px solid #000; padding: 4px 8px; margin-bottom: 6px; 
    font-size: 0.78rem; line-height: 1.35; width: 100%; background-color: #fafafa;
  }
  .info-item p { margin: 1px 0; }

  /* 3. كروت الإحصائيات (KPIs) */
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 6px; width: 100%; }
  .kpi-card { border: 1.5px solid #000; padding: 4px 6px; text-align: center; background-color: #f8f9fa; }
  .kpi-card .kpi-title { font-size: 0.7rem; font-weight: bold; color: #333; }
  .kpi-card .kpi-value { font-size: 0.92rem; font-weight: bold; margin-top: 2px; }

  /* 4. الجدول */
  .table-wrapper { width: 100%; flex-grow: 1; display: flex; flex-direction: column; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  th, td { border: 1px solid #000; padding: 3px 4px; text-align: center; font-size: 0.73rem; }
  th { background-color: #ededed; font-weight: bold; }
  tfoot tr { background-color: #f1f5f9; font-weight: bold; }

  .deficit { color: #dc2626; font-weight: bold; }
  .surplus { color: #16a34a; font-weight: bold; }

  /* 5. التوقيعات */
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
  ${getPrintToolbarStyles()}
</style>
</head>
<body>

${getPrintToolbarHtml('سند تسوية مخزنية #' + voucher.voucherNumber)}

<div class="report-container">
  <div>
    <!-- الترويسة -->
    <div class="header">
      <div class="header-right">
        <h2>${companyName}</h2>
        <p>${companySubtitle}</p>
      </div>
      <div class="header-center">
        ${showLogo ? `<img src="${logoSrc}" alt="Logo" class="logo-img" />` : ''}
      </div>
      <div class="header-left">
        <ul class="phones-list">
          ${finalPhones.map((p) => `<li>${p}</li>`).join('')}
        </ul>
      </div>
    </div>

    <!-- صندوق البيانات -->
    <div class="info-box">
      <div class="info-item" style="text-align: right;">
        <p><strong>نوع المستند:</strong> <span style="font-weight:bold; font-size:0.85rem;">سند تسوية وتعديل مخزني معتمد</span></p>
        <p><strong>رقم السند:</strong> <span>${voucher.voucherNumber}</span></p>
      </div>
      <div class="info-item" style="text-align: center;">
        <p><strong>جلسة الجرد الأصلية:</strong> <span>${voucher.stocktakeSessionNumber || '-'}</span></p>
        <p><strong>المحرر / المحاسب:</strong> <span>${voucher.createdBy || 'مدير النظام'}</span></p>
      </div>
      <div class="info-item" style="text-align: left;">
        <p><strong>تاريخ الترحيل:</strong> <span>${printDate}</span></p>
        <p><strong>قيد اليومية المرتبط:</strong> <span>JV-${voucher.journalEntryId || 'مرحل'}</span></p>
      </div>
    </div>

    <!-- كروت المؤشرات -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-title">أصناف تمت تسويتها</div>
        <div class="kpi-value">${totalItemsCount} صنف</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">بنود عجز / نقص</div>
        <div class="kpi-value deficit">${shortageCount} بند</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">إجمالي عجز المخزون</div>
        <div class="kpi-value deficit">- ${(voucher.totalShortageAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">إجمالي فائض المخزون</div>
        <div class="kpi-value surplus">+ ${(voucher.totalSurplusAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م</div>
      </div>
    </div>

    <!-- جدول التسوية -->
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th style="width: 8%;">كود الصنف</th>
            <th style="width: 25%; text-align: right;">اسم الصنف</th>
            <th style="width: 7%;">الوحدة</th>
            <th style="width: 9%;">الرصيد السابق</th>
            <th style="width: 9%;">الرصيد المعدل</th>
            <th style="width: 8%;">الكمية المسواة</th>
            <th style="width: 10%;">سعر التكلفة</th>
            <th style="width: 12%;">قيمة التسوية</th>
            <th style="width: 12%;">السبب والتصنيف</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || `<tr><td colspan="9" style="padding:15px;color:#888;">لا توجد تفاصيل تسوية</td></tr>`}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3">الإجمالـــي العام</td>
            <td>${totalBookQty}</td>
            <td>${totalNewQty}</td>
            <td class="${netAdjClass}">${netAdjText}</td>
            <td>-</td>
            <td class="${netAmtClass}">${netAmtText}</td>
            <td>صافي الأثر المالي</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- التوقيعات -->
    <div class="bottom-section">
      <div>أمين المخزن: ....................</div>
      <div>المحاسب المالي: ....................</div>
      <div>يعتمد / المدير العام: ....................</div>
    </div>
  </div>

  <div>
    <div class="report-footer-note">
      <div>* هذا السند مولد ومرحل آلياً إلى حسابات الأستاذ العام وقيود اليومية المزدوجة ويعد وثيقة مالية نهائية</div>
      <div>صفحة رقم: 1/1</div>
    </div>
  </div>
</div>

<div class="copyright-outside">
  حقوق الملكية محفوظة Mohamed Nazih 01029190615
</div>

${getPrintToolbarScript()}
</body>
</html>`;
}

/**
 * Generates the unified print HTML for Annual Year-End Closing (محضر الإقفال السنوي والحسابات الختامية)
 */
export function generateAnnualClosingPrintHtml(closingRecord: FiscalYearClosingRecord, appData: AppData): string {
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

  const now = new Date();
  const printDate = closingRecord.closingDate || now.toLocaleDateString('ar-EG');
  const printTime = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  const isProfit = closingRecord.netProfitOrLoss >= 0;
  const netProfitClass = isProfit ? 'surplus' : 'deficit';
  const netProfitSign = isProfit ? '+' : '-';

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>محضر الإقفال السنوي - سنة ${closingRecord.fiscalYear}</title>
<style>
  :root {
    --page-size: ${paperSize === 'A5' ? 'A5 portrait' : paperSize === 'Letter' ? 'letter portrait' : 'A4 portrait'};
    --page-margin: ${pageMargin}mm;
  }
  @page { size: var(--page-size, auto); margin: var(--page-margin, 0mm); }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  
  html, body { 
    font-family: 'Segoe UI', Tahoma, Arial, sans-serif; 
    background-color: #f0f2f5; margin: 0; padding: 0; color: #000;
    width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center;
  }

  .report-container { 
    background: #fff; width: 100vw; height: calc(100vh - 20px); max-width: 100%;
    margin: 0 auto; padding: 5mm 7mm; border: 3px solid #000; 
    display: flex; flex-direction: column; justify-content: space-between;
    box-sizing: border-box;
  }

  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 5px; width: 100%; }
  .header-right h2 { margin: 0 0 2px 0; font-size: 1.1rem; font-weight: bold; }
  .header-right p { margin: 0; font-size: 0.75rem; color: #333; }
  .header-center { text-align: center; }
  .logo-img { max-width: 85px; max-height: 50px; object-fit: contain; }
  .header-left { text-align: left; }
  .phones-list { list-style: none; padding: 0; margin: 0; font-size: 0.75rem; direction: ltr; text-align: left; }
  .phones-list li { margin-bottom: 1px; font-weight: 600; }

  .info-box { 
    display: flex; justify-content: space-between; align-items: center;
    border: 1.5px solid #000; padding: 4px 8px; margin-bottom: 6px; 
    font-size: 0.78rem; line-height: 1.35; width: 100%; background-color: #fafafa;
  }
  .info-item p { margin: 1px 0; }

  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 6px; width: 100%; }
  .kpi-card { border: 1.5px solid #000; padding: 4px 6px; text-align: center; background-color: #f8f9fa; }
  .kpi-card .kpi-title { font-size: 0.7rem; font-weight: bold; color: #333; }
  .kpi-card .kpi-value { font-size: 0.92rem; font-weight: bold; margin-top: 2px; }

  .table-wrapper { width: 100%; flex-grow: 1; display: flex; flex-direction: column; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  th, td { border: 1px solid #000; padding: 4px 6px; text-align: center; font-size: 0.75rem; }
  th { background-color: #ededed; font-weight: bold; }
  tfoot tr { background-color: #f1f5f9; font-weight: bold; }

  .deficit { color: #dc2626; font-weight: bold; }
  .surplus { color: #16a34a; font-weight: bold; }

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
  ${getPrintToolbarStyles()}
</style>
</head>
<body>

${getPrintToolbarHtml('محضر الإقفال السنوي - سنة ' + closingRecord.fiscalYear)}

<div class="report-container">
  <div>
    <!-- الترويسة -->
    <div class="header">
      <div class="header-right">
        <h2>${companyName}</h2>
        <p>${companySubtitle}</p>
      </div>
      <div class="header-center">
        ${showLogo ? `<img src="${logoSrc}" alt="Logo" class="logo-img" />` : ''}
      </div>
      <div class="header-left">
        <ul class="phones-list">
          ${finalPhones.map((p) => `<li>${p}</li>`).join('')}
        </ul>
      </div>
    </div>

    <!-- صندوق البيانات -->
    <div class="info-box">
      <div class="info-item" style="text-align: right;">
        <p><strong>نوع التقرير:</strong> <span style="font-weight:bold; font-size:0.85rem;">محضر الإقفال السنوي والحسابات الختامية</span></p>
        <p><strong>السنة المالية المقفلة:</strong> <span>سنة ${closingRecord.fiscalYear}</span></p>
      </div>
      <div class="info-item" style="text-align: center;">
        <p><strong>رقم مذكرة الإقفال:</strong> <span>${closingRecord.closingNumber}</span></p>
        <p><strong>مسؤول الإقفال:</strong> <span>${closingRecord.closedBy || 'المدير المالي'}</span></p>
      </div>
      <div class="info-item" style="text-align: left;">
        <p><strong>تاريخ الإقفال:</strong> <span>${printDate}</span></p>
        <p><strong>قيد الترحيل:</strong> <span>JV-${closingRecord.closingJournalEntryId || 'مرحل'}</span></p>
      </div>
    </div>

    <!-- كروت المؤشرات -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-title">إجمالي الإيرادات</div>
        <div class="kpi-value surplus">${(closingRecord.totalRevenues || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">إجمالي المصروفات</div>
        <div class="kpi-value deficit">${(closingRecord.totalExpenses || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">صافي نتيجة النشاط</div>
        <div class="kpi-value ${netProfitClass}">${netProfitSign} ${Math.abs(closingRecord.netProfitOrLoss || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">قيمة المخزون عند الإقفال</div>
        <div class="kpi-value" style="color:#1e40af;">${(closingRecord.inventoryValueAtClosing || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م</div>
      </div>
    </div>

    <!-- جدول ملخص المركز المالي والحسابات الختامية -->
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th style="width: 25%; text-align: right;">البيان المحاسبي</th>
            <th style="width: 25%;">القيمة الدفترية عند الإقفال</th>
            <th style="width: 25%; text-align: right;">حساب الترحيل / المعالجة</th>
            <th style="width: 25%;">الحالة والأثر</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="text-align: right; font-weight: bold;">إجمالي الأصول والسيولة</td>
            <td style="font-weight: bold;">${(closingRecord.totalAssetsAtClosing || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م</td>
            <td style="text-align: right;">الأصول المتداولة والثابتة</td>
            <td class="surplus">مرحل كأرصدة افتتاحية</td>
          </tr>
          <tr>
            <td style="text-align: right; font-weight: bold;">إجمالي الخصوم والالتزامات</td>
            <td style="font-weight: bold;">${(closingRecord.totalLiabilitiesAtClosing || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م</td>
            <td style="text-align: right;">الموردين والالتزامات الضريبية</td>
            <td class="deficit">مرحل كأرصدة افتتاحية</td>
          </tr>
          <tr>
            <td style="text-align: right; font-weight: bold;">تقييم المخزون السلعي التام</td>
            <td style="font-weight: bold;">${(closingRecord.inventoryValueAtClosing || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م</td>
            <td style="text-align: right;">مخزون البضاعة (1106)</td>
            <td style="color:#1e40af; font-weight:bold;">بضاعة أول المدة للعام الجديد</td>
          </tr>
          <tr>
            <td style="text-align: right; font-weight: bold;">ترحيل صافي الأرباح / الخسائر</td>
            <td style="font-weight: bold;" class="${netProfitClass}">${(closingRecord.netProfitOrLoss || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م</td>
            <td style="text-align: right;">${closingRecord.closedToAccountName}</td>
            <td class="${netProfitClass}">تم إثبات القيد الختامي</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- التوقيعات -->
    <div class="bottom-section">
      <div>المحاسب المالي: ....................</div>
      <div>مدير الحسابات / المراجع: ....................</div>
      <div>يعتمد / رئيس مجلس الإدارة: ....................</div>
    </div>
  </div>

  <div>
    <div class="report-footer-note">
      <div>* هذا التقرير يعتبر محضر إقفال سنوي وحسابات ختامية معتمدة ورسمية تم ترحيلها وقفلها محاسبياً بالنظام</div>
      <div>صفحة رقم: 1/1</div>
    </div>
  </div>
</div>

<div class="copyright-outside">
  حقوق الملكية محفوظة Mohamed Nazih 01029190615
</div>

${getPrintToolbarScript()}
</body>
</html>`;
}

/**
 * Trigger print dialog for Stocktake Session
 */
export function printStocktakeSession(session: StocktakeSession, appData: AppData): void {
  const html = generateStocktakePrintHtml(session, appData);
  const printWin = window.open('', '_blank', 'width=1100,height=900');
  if (!printWin) {
    alert('يرجى السماح بالنوافذ المنبثقة للطباعة');
    return;
  }
  printWin.document.open();
  printWin.document.write(html);
  printWin.document.close();
}

/**
 * Trigger print dialog for Settlement Voucher
 */
export function printSettlementVoucher(voucher: InventoryAdjustmentVoucher, appData: AppData): void {
  const html = generateSettlementPrintHtml(voucher, appData);
  const printWin = window.open('', '_blank', 'width=1100,height=900');
  if (!printWin) {
    alert('يرجى السماح بالنوافذ المنبثقة للطباعة');
    return;
  }
  printWin.document.open();
  printWin.document.write(html);
  printWin.document.close();
}

/**
 * Trigger print dialog for Annual Closing Record
 */
export function printAnnualClosing(closingRecord: FiscalYearClosingRecord, appData: AppData): void {
  const html = generateAnnualClosingPrintHtml(closingRecord, appData);
  const printWin = window.open('', '_blank', 'width=1100,height=900');
  if (!printWin) {
    alert('يرجى السماح بالنوافذ المنبثقة للطباعة');
    return;
  }
  printWin.document.open();
  printWin.document.write(html);
  printWin.document.close();
}
