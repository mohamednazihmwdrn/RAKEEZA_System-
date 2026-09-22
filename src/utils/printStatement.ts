import { AppData, Settings } from '../types';

export interface StatementData {
  company: {
    name: string;
    address: string;
    logoUrl?: string;
    phones: string[];
    paperSize?: string;
    pageMargin?: number;
  };
  accountCode: string;
  accountName: string;
  accountType: string;
  dateFrom: string;
  dateTo: string;
  previousBalance: number;
  transactions: Array<{
    date: string;
    refNo: string;
    description: string;
    debit: number;
    credit: number;
  }>;
}

export function formatEnNumber(num: number): string {
  const n = Number(num) || 0;
  return Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function compileStatementData(
  partyName: string,
  partyType: 'customer' | 'supplier',
  appData: AppData,
  filterFromDate?: string,
  filterToDate?: string
): StatementData {
  const settings: Partial<Settings> = appData.settings || {};
  const isCustomer = partyType === 'customer';

  // Company details
  const phones: string[] = [];
  if (settings.phone1) phones.push(settings.phone1);
  if (settings.phone2) phones.push(settings.phone2);
  if (settings.phone3) phones.push(settings.phone3);
  if (phones.length === 0) phones.push('01029190615');

  // Party info
  let accountCode = isCustomer ? 'CUST-001' : 'SUPP-001';
  let accountName = partyName;
  let accountType = isCustomer ? 'حساب عميل (آجل ونقدي)' : 'حساب مورد (آجل ونقدي)';

  if (isCustomer) {
    const cust = appData.customers.find((c) => c.name === partyName);
    if (cust) {
      accountCode = cust.id || accountCode;
      accountName = cust.name;
    }
  } else {
    const supp = appData.suppliers.find((s) => s.name === partyName);
    if (supp) {
      accountCode = supp.id || accountCode;
      accountName = supp.name;
    }
  }

  // Determine all transactions related to this party
  interface RawTx {
    date: string;
    refNo: string;
    description: string;
    debit: number;
    credit: number;
  }

  const allRawTxs: RawTx[] = [];

  if (isCustomer) {
    // 1. Sales Invoices
    (appData.salesInvoices || []).forEach((inv) => {
      if (inv.customerName === partyName) {
        const invTotal = Number(inv.total) || 0;
        const invPaid = Number(inv.paidAmount !== undefined ? inv.paidAmount : (inv.type === 'nagdi' ? invTotal : 0));
        const isReturn = inv.type?.startsWith('return_');
        const invDate = (inv.date || '').split('T')[0] || new Date().toISOString().split('T')[0];

        if (isReturn) {
          // Return invoice: credit to customer (reduces debt)
          allRawTxs.push({
            date: invDate,
            refNo: `RET-${inv.id}`,
            description: `إذن مرتجع مبيعات فاتورة #${inv.id}${inv.notes ? ` (${inv.notes})` : ''}`,
            debit: 0,
            credit: invTotal,
          });
          // If refund was paid out from cash drawer to customer
          if (invPaid > 0) {
            allRawTxs.push({
              date: invDate,
              refNo: `REF-${inv.id}`,
              description: `سداد قيمة مرتجع مبيعات نقداً للعميل #${inv.id}`,
              debit: invPaid,
              credit: 0,
            });
          }
        } else {
          // Sales invoice: debit (debt on customer)
          allRawTxs.push({
            date: invDate,
            refNo: `INV-${inv.id}`,
            description: `فاتورة مبيعات ${inv.type === 'nagdi' ? 'نقدية' : 'آجلة'} #${inv.id}${inv.notes ? ` (${inv.notes})` : ''}`,
            debit: invTotal,
            credit: 0,
          });

          // Immediate payment recorded on the invoice
          if (invPaid > 0) {
            allRawTxs.push({
              date: invDate,
              refNo: `PAY-${inv.id}`,
              description: `سداد فوري على فاتورة مبيعات #${inv.id} (${inv.paymentMethod || 'نقدي'})`,
              debit: 0,
              credit: invPaid,
            });
          }
        }
      }
    });

    // 2. Direct Cash / Bank Receipts & Payments
    (appData.cashTransactions || []).forEach((tx) => {
      if (tx.customerName === partyName) {
        const txDate = (tx.date || '').split('T')[0] || new Date().toISOString().split('T')[0];
        const amt = Number(tx.amount) || 0;
        if (tx.type === 'receive' || tx.type === 'deposit') {
          // Customer payment: credit (reduces customer debt)
          allRawTxs.push({
            date: txDate,
            refNo: `REC-${tx.id}`,
            description: `سند قبض / تحصيل نقدي #${tx.id}${tx.note ? ` (${tx.note})` : ''}${tx.method ? ` - وسيلة: ${tx.method}` : ''}`,
            debit: 0,
            credit: amt,
          });
        } else if (tx.type === 'pay' || tx.type === 'withdraw') {
          // Refund or payment to customer: debit
          allRawTxs.push({
            date: txDate,
            refNo: `VOU-${tx.id}`,
            description: `سند صرف / دفعة للعميل #${tx.id}${tx.note ? ` (${tx.note})` : ''}`,
            debit: amt,
            credit: 0,
          });
        }
      }
    });

    // 3. Cheques
    (appData.cheques || []).forEach((chk) => {
      if (chk.drawerName === partyName || chk.beneficiaryName === partyName) {
        const chkDate = (chk.dueDate || chk.issueDate || '').split('T')[0];
        const amt = Number(chk.amount) || 0;
        if (chk.type === 'receivable') {
          allRawTxs.push({
            date: chkDate,
            refNo: `CHK-${chk.chequeNumber || chk.id}`,
            description: `شيك مقبوض رقم ${chk.chequeNumber} بنك ${chk.bankName || ''} [حالة: ${chk.status}]`,
            debit: 0,
            credit: amt,
          });
        }
      }
    });
  } else {
    // SUPPLIER
    // 1. Purchase Invoices
    (appData.purchaseInvoices || []).forEach((inv) => {
      if (inv.supplierName === partyName) {
        const invTotal = Number(inv.total) || 0;
        const invPaid = Number(inv.paidAmount !== undefined ? inv.paidAmount : (inv.type === 'nagdi' ? invTotal : 0));
        const isReturn = inv.type?.startsWith('return_');
        const invDate = (inv.date || '').split('T')[0] || new Date().toISOString().split('T')[0];

        if (isReturn) {
          // Return to supplier: debit (reduces supplier debt on us)
          allRawTxs.push({
            date: invDate,
            refNo: `RET-${inv.id}`,
            description: `إذن مرتجع مشتريات للمورد #${inv.id}${inv.notes ? ` (${inv.notes})` : ''}`,
            debit: invTotal,
            credit: 0,
          });
          if (invPaid > 0) {
            allRawTxs.push({
              date: invDate,
              refNo: `REF-${inv.id}`,
              description: `استرداد نقدي من المورد لمرتجع #${inv.id}`,
              debit: 0,
              credit: invPaid,
            });
          }
        } else {
          // Purchase: credit (supplier is creditor / له)
          allRawTxs.push({
            date: invDate,
            refNo: `PUR-${inv.id}`,
            description: `فاتورة مشتريات ${inv.type === 'nagdi' ? 'نقدية' : 'آجلة'} #${inv.id}${inv.notes ? ` (${inv.notes})` : ''}`,
            debit: 0,
            credit: invTotal,
          });

          // Immediate payment recorded on invoice: debit (سداد للمورد)
          if (invPaid > 0) {
            allRawTxs.push({
              date: invDate,
              refNo: `PAY-${inv.id}`,
              description: `سداد فوري على فاتورة مشتريات #${inv.id} (${inv.paymentMethod || 'نقدي'})`,
              debit: invPaid,
              credit: 0,
            });
          }
        }
      }
    });

    // 2. Direct Cash / Bank Payments & Receipts
    (appData.cashTransactions || []).forEach((tx) => {
      if (tx.supplierName === partyName) {
        const txDate = (tx.date || '').split('T')[0] || new Date().toISOString().split('T')[0];
        const amt = Number(tx.amount) || 0;
        if (tx.type === 'pay' || tx.type === 'withdraw') {
          // Payment to supplier: debit (سداد له / عليه)
          allRawTxs.push({
            date: txDate,
            refNo: `VOU-${tx.id}`,
            description: `سند صرف / سداد للمورد #${tx.id}${tx.note ? ` (${tx.note})` : ''}${tx.method ? ` - وسيلة: ${tx.method}` : ''}`,
            debit: amt,
            credit: 0,
          });
        } else if (tx.type === 'receive' || tx.type === 'deposit') {
          // Refund from supplier: credit
          allRawTxs.push({
            date: txDate,
            refNo: `REC-${tx.id}`,
            description: `سند قبض / استرداد من المورد #${tx.id}${tx.note ? ` (${tx.note})` : ''}`,
            debit: 0,
            credit: amt,
          });
        }
      }
    });

    // 3. Cheques paid to supplier
    (appData.cheques || []).forEach((chk) => {
      if (chk.drawerName === partyName || chk.beneficiaryName === partyName) {
        const chkDate = (chk.dueDate || chk.issueDate || '').split('T')[0];
        const amt = Number(chk.amount) || 0;
        if (chk.type === 'payable') {
          allRawTxs.push({
            date: chkDate,
            refNo: `CHK-${chk.chequeNumber || chk.id}`,
            description: `شيك صادر للمورد رقم ${chk.chequeNumber} مسحوب على ${chk.bankName || ''} [حالة: ${chk.status}]`,
            debit: amt,
            credit: 0,
          });
        }
      }
    });
  }

  // Sort all transactions chronologically
  allRawTxs.sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));

  // Determine date ranges
  let dateFrom = filterFromDate || '';
  let dateTo = filterToDate || '';

  if (!dateFrom && allRawTxs.length > 0) {
    dateFrom = allRawTxs[0].date;
  }
  if (!dateTo) {
    dateTo = new Date().toISOString().split('T')[0];
  }
  if (!dateFrom) {
    dateFrom = dateTo;
  }

  // Calculate previous balance before dateFrom
  let previousBalance = 0;
  const periodTransactions: RawTx[] = [];

  allRawTxs.forEach((tx) => {
    if (tx.date < dateFrom) {
      if (isCustomer) {
        previousBalance += tx.debit - tx.credit;
      } else {
        // For supplier: positive balance = creditor (له)
        previousBalance += tx.credit - tx.debit;
      }
    } else if (tx.date <= dateTo) {
      periodTransactions.push(tx);
    }
  });

  return {
    company: {
      name: settings.companyName || 'منظومة RAKEEZA التجارية والأنظمة المحاسبية',
      address: settings.address || 'الفرع الرئيسي - جمهورية مصر العربية',
      logoUrl: (settings as any).logo || (settings as any).logoUrl || '',
      phones: phones,
      paperSize: (settings as any).paperSize || 'A4',
      pageMargin: (settings as any).pageMargin !== undefined ? (settings as any).pageMargin : 5,
    },
    accountCode,
    accountName,
    accountType,
    dateFrom,
    dateTo,
    previousBalance,
    transactions: periodTransactions,
  };
}

export function generateStatementPrintHtml(data: StatementData, isSupplier: boolean = false): string {
  const serializedData = JSON.stringify(data);
  const serializedIsSupplier = JSON.stringify(isSupplier);
  const paperSize = data.company?.paperSize || 'A4';
  const pageMargin = data.company?.pageMargin !== undefined ? data.company.pageMargin : 5;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>كشف حساب تفصيلي - ${data.accountName}</title>
<style>
  :root {
    --page-size: ${paperSize === 'A5' ? 'A5 portrait' : paperSize === 'Letter' ? 'letter portrait' : 'A4 portrait'};
    --page-margin: ${pageMargin}mm;
  }

  @page { 
    size: var(--page-size, auto); 
    margin: var(--page-margin, 4mm); 
  }
  * { box-sizing: border-box; }
  
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
    background: #fff; width: 100vw; height: 100vh; min-height: 98vh; max-width: 100%;
    margin: 0 auto; padding: 5mm 7mm; border: 3px solid #000; 
    box-sizing: border-box;
    display: flex; flex-direction: column; justify-content: space-between;
  }

  /* 1. الترويسة */
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 5px; width: 100%; }
  .header.is-empty { display: none !important; }
  .header-right h2 { margin: 0 0 2px 0; font-size: 1.1rem; font-weight: bold; }
  .header-right p { margin: 0; font-size: 0.75rem; color: #333; }
  .header-center { display: flex; justify-content: center; align-items: center; min-width: 80px; }
  .logo-img { max-width: 85px; max-height: 50px; object-fit: contain; }
  .phones-list { list-style: none; padding: 0; margin: 0; font-size: 0.75rem; direction: ltr; text-align: left; }
  .phones-list li { margin-bottom: 1px; font-weight: 600; }

  /* 2. صندوق البيانات الأساسية */
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
  .info-col { display: table-cell; vertical-align: top; width: 33.33%; }
  .info-item { margin-bottom: 2px; white-space: nowrap; }
  .no-break { display: inline-block; direction: ltr; unicode-bidi: embed; white-space: nowrap; }

  /* 3. كروت المؤشرات (KPIs) */
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 6px; }
  .kpi-card { border: 1.5px solid #000; padding: 4px 6px; text-align: center; background-color: #f8f9fa; }
  .kpi-card .kpi-title { font-size: 0.7rem; font-weight: bold; color: #333; }
  .kpi-card .kpi-value { font-size: 0.88rem; font-weight: bold; margin-top: 2px; direction: ltr; }

  /* 4. الجدول */
  .table-wrapper { width: 100%; flex-grow: 1; display: flex; flex-direction: column; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  th, td { border: 1px solid #000; padding: 4px 5px; text-align: center; font-size: 0.73rem; }
  th { background-color: #ededed; font-weight: bold; font-size: 0.76rem; }
  tfoot tr { background-color: #e2e8f0; font-weight: bold; }

  .amount-cell { direction: ltr; }
  .debit-col { color: #dc2626; }
  .credit-col { color: #16a34a; }
  .balance-col { font-weight: bold; background-color: #f8f9fa; direction: ltr; }

  /* 5. التوقيعات والتذييل */
  .bottom-section { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 6px; margin-bottom: 4px; width: 100%; font-size: 0.78rem; font-weight: bold; }
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
  }
</style>
</head>
<body>

<div class="no-print-toolbar no-print">
  <div class="toolbar-title-box">
    <span class="title-text">🖨️ معاينة وتخصيص الطباعة</span>
    <span class="doc-badge">كشف حساب - ${data.accountName}</span>
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
    <div class="header" id="invoiceHeader">
      <div class="header-right">
        <h2 id="settingCompanyName">منظومة ركيزة | RAKEEZA ERP</h2>
        <p id="settingCompanyAddress">الفرع الرئيسي - ش المعهد الديني</p>
      </div>
      <div class="header-center">
        <img id="settingCompanyLogo" class="logo-img" src="" alt="الشعار" style="display:none;">
      </div>
      <div class="header-left">
        <ul class="phones-list" id="settingPhonesList">
          <li>01029190615</li>
        </ul>
      </div>
    </div>

    <!-- صندوق البيانات -->
    <div class="info-box">
      <div class="info-col" style="text-align: right;">
        <div class="info-item"><strong>نوع المستند:</strong> <span style="font-weight:bold; color:#2563eb;">كشف حساب تفصيلي</span></div>
        <div class="info-item"><strong>الاسم / الحساب:</strong> <span id="lblAccountName" style="font-weight:bold;">-</span></div>
      </div>
      <div class="info-col" style="text-align: center;">
        <div class="info-item"><strong>كود الحساب:</strong> <span id="lblAccountCode" class="no-break" style="font-weight:bold;">-</span></div>
        <div class="info-item"><strong>نوع الحساب:</strong> <span id="lblAccountType">-</span></div>
      </div>
      <div class="info-col" style="text-align: left;">
        <div class="info-item"><strong>عن الفترة من:</strong> <span id="lblDateFrom" class="no-break">-</span></div>
        <div class="info-item"><strong>إلـــى تاريخ:</strong> <span id="lblDateTo" class="no-break">-</span></div>
      </div>
    </div>

    <!-- كروت المؤشرات (KPIs) -->
    <div class="kpi-grid" id="kpiGrid"></div>

    <!-- جدول الحركات -->
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th style="width: 5%;">#</th>
            <th style="width: 12%;">التاريخ</th>
            <th style="width: 15%;">رقم الحركة / المرجع</th>
            <th style="width: 33%; text-align: right;">البيـــان / شرح الحركة</th>
            <th style="width: 11%;">مدينة (+ عليـه)</th>
            <th style="width: 11%;">دائنة (- لـه)</th>
            <th style="width: 13%;">الرصيد التراكمي</th>
          </tr>
        </thead>
        <tbody id="tableBody"></tbody>
        <tfoot id="tableFoot"></tfoot>
      </table>
    </div>

    <!-- التوقيعات -->
    <div class="bottom-section">
      <div>المحاسب المختص: ....................</div>
      <div>مراجعة الحسابات: ....................</div>
      <div>اعتماد المدير المالي: ....................</div>
    </div>
  </div>

  <div>
    <div class="report-footer-note">
      <div>* يعتبر هذا الكشف كشف حساب رسمي نهائي للحركات المسجلة بالنظام حتى تاريخه</div>
      <div>صفحة رقم: 1/1</div>
    </div>
  </div>
</div>

<div class="copyright-outside">
  حقوق الملكية محفوظة Mohamed Nazih 01029190615
</div>

<script>
  const statementData = ${serializedData};
  const isSupp = ${serializedIsSupplier};

  function formatEnNumber(num) {
    const n = Number(num) || 0;
    return Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

  function renderStatement() {
    if (statementData.company) {
      setCompanyHeader(statementData.company);
    }

    document.getElementById("lblAccountCode").innerText = statementData.accountCode || '-';
    document.getElementById("lblAccountName").innerText = statementData.accountName || '-';
    document.getElementById("lblAccountType").innerText = statementData.accountType || '-';
    document.getElementById("lblDateFrom").innerText = statementData.dateFrom || '-';
    document.getElementById("lblDateTo").innerText = statementData.dateTo || '-';

    let runningBalance = Number(statementData.previousBalance) || 0;
    let totalDebit = 0;
    let totalCredit = 0;

    // صف الرصيد السابق
    let bodyHtml = \`
      <tr style="background-color: #fafafa; font-weight: bold;">
        <td>-</td>
        <td class="no-break">\${statementData.dateFrom || '-'}</td>
        <td>-</td>
        <td style="text-align: right;">رصيد ما قبل الفترة (الرصيد السابق)</td>
        <td class="amount-cell debit-col">\${statementData.previousBalance > 0 ? formatEnNumber(statementData.previousBalance) : "0.00"}</td>
        <td class="amount-cell credit-col">\${statementData.previousBalance < 0 ? formatEnNumber(statementData.previousBalance) : "0.00"}</td>
        <td class="balance-col">\${formatEnNumber(runningBalance)} \${runningBalance > 0 ? "مدين (+)" : runningBalance < 0 ? "دائن (-)" : "متزن"}</td>
      </tr>
    \`;

    if (statementData.transactions && statementData.transactions.length > 0) {
      statementData.transactions.forEach((item, index) => {
        const debit = Number(item.debit) || 0;
        const credit = Number(item.credit) || 0;
        totalDebit += debit;
        totalCredit += credit;

        if (isSupp) {
          // For suppliers: credit is purchase (+ له), debit is payment (- عليه)
          runningBalance += (credit - debit);
        } else {
          // For customers: debit is sales (+ عليه), credit is payment (- له)
          runningBalance += (debit - credit);
        }

        const balanceLabel = runningBalance > 0 ? (isSupp ? "دائن (له)" : "مدين (عليه)") : runningBalance < 0 ? (isSupp ? "مدين (لنا)" : "دائن (له)") : "متزن";

        bodyHtml += \`
          <tr>
            <td>\${index + 1}</td>
            <td class="no-break">\${item.date || '-'}</td>
            <td style="font-weight:bold;">\${item.refNo || '-'}</td>
            <td style="text-align: right;">\${item.description || ''}</td>
            <td class="amount-cell debit-col">\${debit > 0 ? formatEnNumber(debit) : "-"}</td>
            <td class="amount-cell credit-col">\${credit > 0 ? formatEnNumber(credit) : "-"}</td>
            <td class="balance-col">\${formatEnNumber(runningBalance)} \${balanceLabel}</td>
          </tr>
        \`;
      });
    }

    document.getElementById("tableBody").innerHTML = bodyHtml;

    const finalBalanceLabel = isSupp
      ? (runningBalance > 0 ? "دائن للمورد (مستحق له)" : runningBalance < 0 ? "مدين على المورد (لنا)" : "حساب متزن 0.00")
      : (runningBalance > 0 ? "مدين على العميل (مستحق عليه)" : runningBalance < 0 ? "دائن للعميل (رصيد له)" : "حساب متزن 0.00");

    // كروت المؤشرات
    document.getElementById("kpiGrid").innerHTML = \`
      <div class="kpi-card">
        <div class="kpi-title">الرصيد السابق</div>
        <div class="kpi-value">\${formatEnNumber(statementData.previousBalance)} EGP</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">\${isSupp ? "إجمالي السدادات والمردودات (مدين)" : "إجمالي المديونية والمبيعات (عليه)"}</div>
        <div class="kpi-value debit-col">\${formatEnNumber(totalDebit)} EGP</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">\${isSupp ? "إجمالي المشتريات المستحقة (دائن)" : "إجمالي التحصيلات والسدادات (له)"}</div>
        <div class="kpi-value credit-col">\${formatEnNumber(totalCredit)} EGP</div>
      </div>
      <div class="kpi-card" style="background-color: #eff6ff; border-color: #2563eb;">
        <div class="kpi-title">الرصيد النهائي الحالي</div>
        <div class="kpi-value" style="color: #1d4ed8;">\${formatEnNumber(runningBalance)} EGP</div>
        <div style="font-size: 0.65rem; color: #1e40af; font-weight: bold; margin-top: 1px;">\${finalBalanceLabel}</div>
      </div>
    \`;

    // تذييل الجدول
    document.getElementById("tableFoot").innerHTML = \`
      <tr>
        <td colspan="4" style="text-align: right;">الإجـمــالـــي العــام للـحــركــــات</td>
        <td class="amount-cell debit-col">\${formatEnNumber(totalDebit)}</td>
        <td class="amount-cell credit-col">\${formatEnNumber(totalCredit)}</td>
        <td class="balance-col" style="color: #1d4ed8;">\${formatEnNumber(runningBalance)}</td>
      </tr>
    \`;
  }

  renderStatement();

  function updatePrintLayout() {
    const sizeEl = document.getElementById('selPaperSize');
    const orientEl = document.getElementById('selOrientation');
    const marginEl = document.getElementById('selMargins');

    const size = sizeEl ? sizeEl.value : 'A4';
    const orient = orientEl ? orientEl.value : 'portrait';
    const marginType = marginEl ? marginEl.value : 'normal';

    let marginVal = '4mm 6mm';
    if (marginType === 'compact') marginVal = '2mm 4mm';
    if (marginType === 'wide') marginVal = '6mm 8mm';

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

export function printStatementWindow(
  partyNameOrData: string | StatementData,
  partyType?: 'customer' | 'supplier',
  appData?: AppData,
  filterFromDate?: string,
  filterToDate?: string,
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

  let html = '';
  if (typeof partyNameOrData === 'object' && partyNameOrData !== null) {
    const isSupplier = partyType === 'supplier';
    html = generateStatementPrintHtml(partyNameOrData, isSupplier);
  } else if (appData) {
    const compiled = compileStatementData(partyNameOrData as string, partyType || 'customer', appData, filterFromDate, filterToDate);
    const isSupplier = partyType === 'supplier';
    html = generateStatementPrintHtml(compiled, isSupplier);
  }

  printWin.document.open();
  printWin.document.write(html);
  printWin.document.close();
}
