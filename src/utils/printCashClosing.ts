import { AppData } from '../types';
import { getPrintToolbarStyles, getPrintToolbarHtml, getPrintToolbarScript } from './printToolbarHelper';

export interface CashClosingData {
  company: {
    name: string;
    address: string;
    logoUrl?: string;
    phones: string[];
    paperSize?: string;
    pageMargin?: number;
  };
  cashierName: string;
  cashierId: string;
  docType: string;
  serialNo: string;
  branch: string;
  date: string;
  time: string;
  openBalance: number;
  actualCash?: number;
  transactions: Array<{
    no: string;
    type: string;
    desc: string;
    amountIn: number;
    amountOut: number;
    method: string;
  }>;
}

export function formatNumber(num: number): string {
  const n = Number(num) || 0;
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function compileCashClosingData(
  appData: AppData,
  filterDate?: string,
  customActualCash?: number,
  customOpenBalance?: number
): CashClosingData {
  const targetDate = filterDate || new Date().toISOString().split('T')[0];
  const settings = appData.settings || ({} as any);

  const currentUserObj = appData.users.find((u) => u.id === appData.currentUser) || appData.users[0];
  const cashierName = currentUserObj?.name || 'أمين الخزينة الرئيسي';
  const cashierId = currentUserObj?.id || 'CASH-01';
  const branch = (appData as any).currentBranch || 'الفرع الرئيسي';

  const phones: string[] = [];
  if (settings.phone1) phones.push(settings.phone1);
  if (settings.phone2) phones.push(settings.phone2);
  if (settings.phone3) phones.push(settings.phone3);

  const transactions: CashClosingData['transactions'] = [];

  // Helper method translator
  const translateMethod = (m?: string): string => {
    if (!m) return 'نقدي';
    const lower = m.toLowerCase();
    if (lower === 'drawer' || lower === 'كاش' || lower === 'نقدي') return 'نقدي';
    if (lower.includes('visa') || lower.includes('فيزا') || lower.includes('card')) return 'فيزا';
    if (lower.includes('insta') || lower.includes('انستاباي') || lower.includes('إنستاباي')) return 'إنستاباي';
    if (lower.includes('voda') || lower.includes('فودافون') || lower.includes('cash')) return 'فودافون كاش';
    if (lower.includes('bank') || lower.includes('بنك') || lower.includes('تحويل')) return 'تحويل بنكي';
    return m;
  };

  // 1. Sales Invoices
  (appData.salesInvoices || []).forEach((inv) => {
    const invDate = (inv.date || '').split('T')[0];
    if (invDate === targetDate) {
      const paid = inv.paidAmount !== undefined ? inv.paidAmount : (inv.type === 'nagdi' ? inv.total : 0);
      const isReturn = inv.type.startsWith('return_');
      const docLabel = isReturn ? 'مرتجع مبيعات' : (inv.type === 'nagdi' ? 'فاتورة مبيعات نقدية' : 'فاتورة مبيعات آجلة');
      const methodLabel = translateMethod(inv.paymentMethod);

      if (paid > 0) {
        transactions.push({
          no: `SAL-${inv.id}`,
          type: docLabel,
          desc: `العميل: ${inv.customerName || 'عميل نقدي'}${inv.notes ? ` (${inv.notes})` : ''}`,
          amountIn: isReturn ? 0 : paid,
          amountOut: isReturn ? paid : 0,
          method: methodLabel,
        });
      }
    }
  });

  // 2. Purchase Invoices
  (appData.purchaseInvoices || []).forEach((inv) => {
    const invDate = (inv.date || '').split('T')[0];
    if (invDate === targetDate) {
      const paid = inv.paidAmount !== undefined ? inv.paidAmount : (inv.type === 'nagdi' ? inv.total : 0);
      const isReturn = inv.type.startsWith('return_');
      const docLabel = isReturn ? 'مرتجع مشتريات' : (inv.type === 'nagdi' ? 'فاتورة مشتريات نقدية' : 'فاتورة مشتريات آجلة');
      const methodLabel = translateMethod(inv.paymentMethod);

      if (paid > 0) {
        transactions.push({
          no: `PUR-${inv.id}`,
          type: docLabel,
          desc: `المورد: ${inv.supplierName || 'مورد عام'}${inv.notes ? ` (${inv.notes})` : ''}`,
          amountIn: isReturn ? paid : 0,
          amountOut: isReturn ? 0 : paid,
          method: methodLabel,
        });
      }
    }
  });

  // 3. Direct Cash Transactions (Vouchers, Receipts, Payments, Deposits, Withdrawals)
  (appData.cashTransactions || []).forEach((tx) => {
    const txDate = (tx.date || '').split('T')[0];
    if (txDate === targetDate) {
      const isReceive = tx.type === 'receive' || tx.type === 'deposit';
      const docLabel = tx.type === 'receive' ? 'سند قبض نقدي' : tx.type === 'pay' ? 'سند صرف نقدي' : tx.type === 'deposit' ? 'إيداع خزينة' : 'سحب خزينة';
      const party = tx.customerName ? `العميل: ${tx.customerName}` : tx.supplierName ? `المورد: ${tx.supplierName}` : (tx.note || 'معاملة عامة');
      const methodLabel = translateMethod(tx.method);

      transactions.push({
        no: `VOU-${tx.id}`,
        type: docLabel,
        desc: `${party}${tx.invoiceId ? ` (مرتبط بفاتورة #${tx.invoiceId})` : ''}`,
        amountIn: isReceive ? tx.amount : 0,
        amountOut: !isReceive ? tx.amount : 0,
        method: methodLabel,
      });
    }
  });

  const openBalance = customOpenBalance !== undefined ? customOpenBalance : 0;
  const currentCashInDrawer = appData.cashBox?.drawer || 0;
  const actualCash = customActualCash !== undefined ? customActualCash : currentCashInDrawer;

  const now = new Date();
  const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  return {
    company: {
      name: settings.companyName || 'منظومة RAKEEZA للأنظمة المحاسبية المتطورة',
      address: settings.address || 'المركز الرئيسي - جمهورية مصر العربية',
      logoUrl: (settings as any).logo || (settings as any).logoUrl || '',
      phones: phones.length > 0 ? phones : ['01029190615'],
      paperSize: (settings as any).paperSize || 'A4',
      pageMargin: (settings as any).pageMargin !== undefined ? (settings as any).pageMargin : 5,
    },
    cashierName,
    cashierId,
    docType: 'تقفيل يومية الخزينة',
    serialNo: `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${(appData.nextCashId || 1)}`,
    branch,
    date: targetDate,
    time: timeStr,
    openBalance,
    actualCash,
    transactions,
  };
}

export function generateCashClosingPrintHtml(data: CashClosingData): string {
  const serializedData = JSON.stringify(data);
  const paperSize = data.company?.paperSize || 'A4';
  const pageMargin = data.company?.pageMargin !== undefined ? data.company.pageMargin : 5;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>تقفيل يومية الخزينة متعدد الوسائل</title>
<style>
  :root {
    --page-size: ${paperSize === 'A5' ? 'A5 portrait' : paperSize === 'Letter' ? 'letter portrait' : 'A4 portrait'};
    --page-margin: ${pageMargin}mm;
  }

  /* ضبط إعدادات الصفحة للطباعة المتوافقة مع A4 و A5 */
  @page {
    size: var(--page-size, auto);
    margin: var(--page-margin, 4mm);
  }

  * { box-sizing: border-box; }
  
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

  .cash-container, .report-container { 
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
  }

  /* 1. الترويسة الديناميكية */
  .header { 
    display: flex; 
    justify-content: space-between; 
    align-items: center; 
    border-bottom: 2px solid #000; 
    padding-bottom: 4px; 
    margin-bottom: 5px;
    width: 100%;
  }
  
  .header.is-empty { display: none !important; }
  .header-right h2 { margin: 0 0 2px 0; font-size: 1.1rem; font-weight: bold; }
  .header-right p { margin: 0; font-size: 0.75rem; color: #333; }

  .header-center { display: flex; justify-content: center; align-items: center; min-width: 80px; }
  .logo-img { max-width: 85px; max-height: 50px; object-fit: contain; }

  .phones-list { list-style: none; padding: 0; margin: 0; font-size: 0.75rem; direction: ltr; text-align: left; }
  .phones-list li { margin-bottom: 1px; font-weight: 600; }

  /* 2. مستطيل البيانات */
  .info-box { 
    display: flex; 
    justify-content: space-between; 
    align-items: center;
    border: 1.5px solid #000; 
    padding: 3px 8px; 
    margin-bottom: 5px; 
    font-size: 0.78rem;
    line-height: 1.3;
    width: 100%;
    background-color: #fafafa;
  }
  .info-item p { margin: 1px 0; }

  /* جداول الصفحة */
  .section-title {
    font-size: 0.78rem;
    font-weight: bold;
    margin: 4px 0 2px 0;
    border-bottom: 1px solid #000;
    display: inline-block;
  }

  table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  th, td { border: 1px solid #000; padding: 2px 4px; text-align: center; font-size: 0.76rem; }
  th { background-color: #ededed; font-weight: bold; }

  /* 3. تجميع وسائل الدفع */
  .methods-table th { background-color: #e2e8f0; }

  /* 4. الحركات التفصيلية */
  .table-wrapper { width: 100%; flex-grow: 1; display: flex; flex-direction: column; }

  /* 5. الملخص والتوقيعات */
  .bottom-section {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: 4px;
    margin-bottom: 4px;
    width: 100%;
  }

  .signatures-box { font-size: 0.75rem; font-weight: bold; display: flex; gap: 20px; }
  .summary-vertical-list { width: 250px; display: flex; flex-direction: column; gap: 1px; font-size: 0.78rem; font-weight: bold; text-align: left; }
  .summary-line { display: flex; justify-content: space-between; align-items: center; padding: 1px 3px; }
  .summary-line.total-line { border: 1.5px solid #000; background-color: #f8f9fa; padding: 3px; font-size: 0.88rem; }

  /* التذييل الداخلي */
  .cash-footer-note {
    border-top: 1.5px solid #000;
    padding-top: 3px;
    margin-top: auto; 
    display: flex;
    justify-content: space-between;
    font-size: 0.72rem;
    font-weight: 600;
    width: 100%;
  }

  /* حقوق الملكية خارج الإطار الخارجي */
  .copyright-outside {
    width: 100%;
    text-align: center;
    font-size: 0.72rem;
    font-weight: bold;
    color: #444;
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
    }
    .cash-container { 
      border: 3px solid #000 !important; 
      width: 100vw !important; 
      height: 99.5% !important; 
      min-height: 99.5% !important;
      max-height: 100% !important;
      padding: 4mm !important;
      box-sizing: border-box !important;
      box-shadow: none !important;
      page-break-after: avoid !important;
      page-break-inside: avoid !important;
    }
  }
  ${getPrintToolbarStyles()}
</style>
</head>
<body>

${getPrintToolbarHtml('محضر إغلاق الخزينة اليومي')}

<div class="cash-container">
  <div>
    <!-- الترويسة -->
    <div class="header" id="invoiceHeader">
      <div class="header-right">
        <h2 id="settingCompanyName"></h2>
        <p id="settingCompanyAddress"></p>
      </div>
      <div class="header-center">
        <img id="settingCompanyLogo" class="logo-img" src="" alt="الشعار" style="display:none;">
      </div>
      <div class="header-left">
        <ul class="phones-list" id="settingPhonesList"></ul>
      </div>
    </div>

    <!-- صندوق البيانات -->
    <div class="info-box">
      <div class="info-item" style="text-align: right;">
        <p><strong>أمين الخزينة / المستخدم:</strong> <span id="lblCashierName"></span></p>
        <p><strong>رقم / كود الخزينة:</strong> <span id="lblCashierId"></span></p>
      </div>
      <div class="info-item" style="text-align: center;">
        <p><strong id="lblDocType">تقفيل يومية الخزينة</strong> - <strong>#<span id="lblSerialNo">1</span></strong></p>
        <p><strong>الفرع:</strong> <span id="lblBranch"></span></p>
      </div>
      <div class="info-item" style="text-align: left;">
        <p><strong>التاريخ:</strong> <span id="lblStatementDate"></span></p>
        <p><strong>الوقت:</strong> <span id="lblStatementTime"></span></p>
      </div>
    </div>

    <!-- جدول تجميع وسائل الدفع المختلفة -->
    <div class="section-title">ملخص مبيعات وتحصيلات وسائل الدفع:</div>
    <table class="methods-table">
      <thead>
        <tr>
          <th>وسيلة الدفع</th>
          <th>نقدي الدرج (الكاش)</th>
          <th>فيزا / ماكينة (Visa)</th>
          <th>إنستاباي (InstaPay)</th>
          <th>فودافون كاش</th>
          <th>تحويل بنكي</th>
          <th>وسائل أخرى</th>
          <th>إجمالي التحصيل الإلكتروني والبنكي</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>المبلغ المسجل بالنظام</strong></td>
          <td id="m-cash">0.00</td>
          <td id="m-visa">0.00</td>
          <td id="m-instapay">0.00</td>
          <td id="m-voda">0.00</td>
          <td id="m-bank">0.00</td>
          <td id="m-other">0.00</td>
          <td id="m-total-digital" style="font-weight: bold;">0.00</td>
        </tr>
      </tbody>
    </table>

    <!-- جدول الحركة اليومية التفصيلي -->
    <div class="section-title">تفاصيل الحركة اليومية بالفواتير والسندات:</div>
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th style="width: 10%;">رقم المستند</th>
            <th style="width: 14%;">نوع المستند</th>
            <th style="width: 34%;">البيان / اسم العميل / الوصف</th>
            <th style="width: 14%;">المبلغ الوارد</th>
            <th style="width: 14%;">المبلغ المنصرف</th>
            <th style="width: 14%;">وسيلة الدفع المختارة</th>
          </tr>
        </thead>
        <tbody id="cashTable">
        </tbody>
      </table>
    </div>

    <!-- ملخص التقفيل والعهدة النقدية -->
    <div class="bottom-section">
      <div class="signatures-box">
        <div>توقيع أمين الخزينة: ....................</div>
        <div>توقيع الحسابات / المراجع: ....................</div>
      </div>

      <div class="summary-vertical-list">
        <div class="summary-line">
          <span>العهدة النقدية الافتتاحية:</span>
          <span id="val-open-balance">0.00</span>
        </div>
        <div class="summary-line">
          <span>إجمالي وارد الكاش (الدرج):</span>
          <span id="val-cash-in">0.00</span>
        </div>
        <div class="summary-line">
          <span>إجمالي منصرف الكاش (الدرج):</span>
          <span id="val-cash-out">0.00</span>
        </div>
        <div class="summary-line">
          <span>الرصيد الدفتري المفترض بالدرج:</span>
          <span id="val-expected-cash">0.00</span>
        </div>
        <div class="summary-line">
          <span>الجرد الفعلي بالدرج:</span>
          <span id="val-actual-cash">0.00</span>
        </div>
        <div class="summary-line">
          <span>الفارق (عجز / زيادة كاش):</span>
          <span id="val-diff">0.00</span>
        </div>
        <div class="summary-line total-line">
          <span>إجمالي المقبوضات (كل الوسائل):</span>
          <span id="val-grand-total-all">0.00</span>
        </div>
      </div>
    </div>
  </div>

  <div>
    <div class="cash-footer-note">
      <div>تم مراجعة كافة وسائل الدفع وتطابق حركات التحصيل الإلكتروني والنقدي</div>
      <div>صفحة رقم: 1/1</div>
    </div>
  </div>
</div>

<!-- حقوق الملكية خارج الإطار الخارجي تماماً -->
<div class="copyright-outside">
  حقوق الملكية محفوظة Mohamed Nazih 01029190615
</div>

<script>
  // دالة التنسيق المعيارية الموحدة للأرقام والمبالغ الإنجليزية 0-9
  function formatMoney(num) {
    const n = Number(num) || 0;
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // 1. ترويسة الشركة
  function setCompanyHeader(companyData) {
    const header = document.getElementById('invoiceHeader');
    let hasData = false;

    if (companyData && (companyData.name || companyData.address || companyData.companyName)) {
      document.getElementById('settingCompanyName').innerText = companyData.companyName || companyData.name || '';
      document.getElementById('settingCompanyAddress').innerText = companyData.address || '';
      hasData = true;
    }

    const logoEl = document.getElementById('settingCompanyLogo');
    const logoSrc = companyData ? (companyData.logoUrl || companyData.logo || '') : '';
    if (logoEl && logoSrc && companyData.showLogoInPrint !== false) {
      logoEl.src = logoSrc;
      logoEl.style.display = 'block';
      hasData = true;
    } else if (logoEl) {
      logoEl.style.display = 'none';
    }

    const phonesList = document.getElementById('settingPhonesList');
    if (phonesList) {
      phonesList.innerHTML = '';
      const phoneArr = companyData ? (companyData.phones || [companyData.phone1, companyData.phone2, companyData.phone3].filter(Boolean)) : [];
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

    if (!hasData && header) header.classList.add('is-empty');
    else if (header) header.classList.remove('is-empty');
  }

  // 2. بيانات الجلسة والخزينة
  function setCashierDetails(data) {
    document.getElementById('lblCashierName').innerText = data.cashierName || '';
    document.getElementById('lblCashierId').innerText = data.cashierId || '';
    document.getElementById('lblDocType').innerText = data.docType || 'تقفيل يومية الخزينة';
    document.getElementById('lblSerialNo').innerText = data.serialNo || '1';
    document.getElementById('lblBranch').innerText = data.branch || '';
    
    document.getElementById('lblStatementDate').innerText = data.date || '';
    document.getElementById('lblStatementTime').innerText = data.time || '';
  }

  // 3. تحليل بيانات وسائل الدفع وحركات اليومية المجلوبة من النظام
  function loadCashierData(data) {
    const tbody = document.getElementById('cashTable');
    tbody.innerHTML = '';

    // تجميع الحركات حسب الوسيلة
    let totals = {
      cashIn: 0,
      cashOut: 0,
      visa: 0,
      instapay: 0,
      voda: 0,
      bank: 0,
      other: 0
    };

    if (data.transactions && data.transactions.length > 0) {
      data.transactions.forEach(item => {
        const amountIn = parseFloat(item.amountIn) || 0;
        const amountOut = parseFloat(item.amountOut) || 0;
        const method = (item.method || 'نقدي').trim();
        const lowerMethod = method.toLowerCase();

        // تجميع حسب الوسيلة
        if (method === 'نقدي' || method === 'كاش' || lowerMethod === 'drawer') {
          totals.cashIn += amountIn;
          totals.cashOut += amountOut;
        } else if (method.includes('فيزا') || lowerMethod.includes('visa') || lowerMethod.includes('card')) {
          totals.visa += amountIn;
        } else if (method.includes('انستاباي') || method.includes('إنستاباي') || lowerMethod.includes('insta')) {
          totals.instapay += amountIn;
        } else if (method.includes('فودافون') || lowerMethod.includes('voda')) {
          totals.voda += amountIn;
        } else if (method.includes('بنكي') || method.includes('تحويل') || lowerMethod.includes('bank')) {
          totals.bank += amountIn;
        } else {
          totals.other += amountIn;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = \`
          <td>\${item.no || '-'}</td>
          <td>\${item.type || '-'}</td>
          <td style="text-align: right; padding-right: 6px;">\${item.desc || ''}</td>
          <td>\${amountIn > 0 ? formatMoney(amountIn) : '-'}</td>
          <td>\${amountOut > 0 ? formatMoney(amountOut) : '-'}</td>
          <td><strong>\${method}</strong></td>
        \`;
        tbody.appendChild(tr);
      });
    } else {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="6" style="padding: 8px; color: #777;">لا توجد حركات مالية مسجلة في هذا اليوم</td>';
      tbody.appendChild(tr);
    }

    // عرض تجميع وسائل الدفع بالأرقام الإنجليزية 0-9
    document.getElementById('m-cash').innerText = formatMoney(totals.cashIn);
    document.getElementById('m-visa').innerText = formatMoney(totals.visa);
    document.getElementById('m-instapay').innerText = formatMoney(totals.instapay);
    document.getElementById('m-voda').innerText = formatMoney(totals.voda);
    document.getElementById('m-bank').innerText = formatMoney(totals.bank);
    document.getElementById('m-other').innerText = formatMoney(totals.other);

    const digitalTotal = totals.visa + totals.instapay + totals.voda + totals.bank + totals.other;
    document.getElementById('m-total-digital').innerText = formatMoney(digitalTotal);

    // الحسابات المالية للكاش
    const openBalance = parseFloat(data.openBalance) || 0;
    const expectedCash = openBalance + totals.cashIn - totals.cashOut;
    const actualCash = data.actualCash !== undefined ? parseFloat(data.actualCash) : expectedCash;
    const diff = actualCash - expectedCash;
    const grandTotalAll = totals.cashIn + digitalTotal;

    document.getElementById('val-open-balance').innerText = formatMoney(openBalance);
    document.getElementById('val-cash-in').innerText = formatMoney(totals.cashIn);
    document.getElementById('val-cash-out').innerText = formatMoney(totals.cashOut);
    document.getElementById('val-expected-cash').innerText = formatMoney(expectedCash);
    document.getElementById('val-actual-cash').innerText = formatMoney(actualCash);
    
    const diffEl = document.getElementById('val-diff');
    diffEl.innerText = formatMoney(diff);
    if (diff < 0) {
      diffEl.style.color = '#b71c1c';
    } else if (diff > 0) {
      diffEl.style.color = '#1b5e20';
    } else {
      diffEl.style.color = '#000';
    }

    document.getElementById('val-grand-total-all').innerText = formatMoney(grandTotalAll);
  }

  // ربط البيانات الديناميكية من النظام
  const systemData = ${serializedData};

  if (systemData.company) {
    setCompanyHeader(systemData.company);
  }

  setCashierDetails(systemData);
  loadCashierData(systemData);
</script>

${getPrintToolbarScript()}

</body>
</html>`;
}

export function printCashClosingWindow(
  appData: AppData,
  filterDate?: string,
  customActualCash?: number,
  customOpenBalance?: number,
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

  const compiled = compileCashClosingData(appData, filterDate, customActualCash, customOpenBalance);
  const html = generateCashClosingPrintHtml(compiled);
  printWin.document.open();
  printWin.document.write(html);
  printWin.document.close();
}
