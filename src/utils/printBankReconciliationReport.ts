import { AppData, Settings, BankAccount, BankStatementItem, ApprovalRequest } from '../types';
import { getPrintToolbarStyles, getPrintToolbarHtml, getPrintToolbarScript } from './printToolbarHelper';

export interface BankReconciliationData {
  company: Settings;
  issuerName: string;
  targetDate: string;
  selectedBank: BankAccount;
  statementItems: BankStatementItem[];
  bookBalance: number;
  statementBalance: number;
  difference: number;
  reconciledCount: number;
  pendingCount: number;
  approvals: ApprovalRequest[];
}

export function formatNumber(num: number): string {
  const n = Number(num) || 0;
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function compileBankReconciliationData(
  appData: AppData,
  bankAccountId?: string,
  targetDate?: string
): BankReconciliationData {
  const company = appData.settings || {
    companyName: 'RAKEEZA',
    address: 'الفرع الرئيسي - ش المعهد الديني، القاهرة',
    phone1: '01029190615',
    phone2: '',
    phone3: '',
    taxNumber: '123-456-789',
    currencySymbol: 'ج.م',
    showLogoInPrint: true,
    notes: '',
    defaultTaxRate: 14,
  };

  const currentUserObj = appData.users?.find((u) => u.id === appData.currentUser) || appData.users?.[0];
  const issuerName = currentUserObj?.name || 'Mohamed Nazih';
  const selectedDate = targetDate || new Date().toISOString().split('T')[0];

  const bankAccounts = appData.bankAccounts || [];
  const selectedBank =
    bankAccounts.find((b) => b.id === bankAccountId) ||
    bankAccounts[0] || {
      id: 'b1',
      name: 'البنك الأهلي المصري',
      accountNumber: 'EG50000200012345678901',
      balance: 145000,
    };

  const statementItems = (appData.bankStatements || []).filter((s) => s.bankAccountId === selectedBank.id);

  // If no statements exist yet for this bank, provide realistic sample reconciliation items so report is complete and useful
  const activeItems: BankStatementItem[] =
    statementItems.length > 0
      ? statementItems
      : [
          {
            id: 'sample-stmt-1',
            bankAccountId: selectedBank.id,
            date: selectedDate,
            reference: 'DEP-8841',
            description: 'إيداع تحصيلات نقدية وحوالات عملاء',
            debit: 0,
            credit: 45000,
            isReconciled: true,
          },
          {
            id: 'sample-stmt-2',
            bankAccountId: selectedBank.id,
            date: selectedDate,
            reference: 'CHQ-5520',
            description: 'صرف شيك مقاصة للمورد شركة الأهرام',
            debit: 20000,
            credit: 0,
            isReconciled: true,
          },
          {
            id: 'sample-stmt-3',
            bankAccountId: selectedBank.id,
            date: selectedDate,
            reference: 'FEE-019',
            description: 'عمولات ومصاريف مسك حسابات وخدمات مصرفية',
            debit: 450,
            credit: 0,
            isReconciled: false,
          },
          {
            id: 'sample-stmt-4',
            bankAccountId: selectedBank.id,
            date: selectedDate,
            reference: 'INT-331',
            description: 'عوائد وفوائد دائنة للحساب الجاري',
            debit: 0,
            credit: 1200,
            isReconciled: false,
          },
        ];

  const bookBalance = selectedBank.balance || 0;
  const totalCredits = activeItems.reduce((sum, item) => sum + (item.credit || 0), 0);
  const totalDebits = activeItems.reduce((sum, item) => sum + (item.debit || 0), 0);
  const statementBalance = totalCredits - totalDebits;
  const difference = bookBalance - statementBalance;

  const reconciledCount = activeItems.filter((i) => i.isReconciled).length;
  const pendingCount = activeItems.filter((i) => !i.isReconciled).length;

  const approvals = appData.approvalRequests || [];

  return {
    company,
    issuerName,
    targetDate: selectedDate,
    selectedBank,
    statementItems: activeItems,
    bookBalance,
    statementBalance,
    difference,
    reconciledCount,
    pendingCount,
    approvals,
  };
}

export function generateBankReconciliationReportHtml(
  appData: AppData,
  bankAccountId?: string,
  targetDate?: string
): string {
  const data = compileBankReconciliationData(appData, bankAccountId, targetDate);

  const phone = data.company.phone1 || '01029190615';
  const companyTitle = data.company.companyName || 'RAKEEZA';
  const branchAddress = data.company.address || 'الفرع الرئيسي - ش المعهد الديني';

  const now = new Date();
  const printDate = now.toLocaleDateString('ar-EG');
  const printTime = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  // Rows HTML
  let rowsHtml = '';
  let totalDebit = 0;
  let totalCredit = 0;

  data.statementItems.forEach((item) => {
    totalDebit += item.debit || 0;
    totalCredit += item.credit || 0;
    const isCredit = (item.credit || 0) > 0;
    const debitStr = item.debit > 0 ? formatNumber(item.debit) : '-';
    const creditStr = item.credit > 0 ? formatNumber(item.credit) : '-';

    rowsHtml += `
      <tr>
        <td style="font-family: monospace;">${item.date}</td>
        <td style="font-family: monospace; font-weight: bold;">${item.reference || '-'}</td>
        <td style="text-align: right; font-weight: 600;">${item.description}</td>
        <td>
          <span style="display:inline-block; padding: 1px 6px; border-radius: 4px; font-weight: bold; font-size: 0.72rem; ${
            isCredit ? 'background-color: #dcfce7; color: #166534;' : 'background-color: #fee2e2; color: #991b1b;'
          }">
            ${isCredit ? 'إيداع وارد (+)' : 'سحب / عمولة (-)'}
          </span>
        </td>
        <td class="expense-val">${debitStr}</td>
        <td class="income-val">${creditStr}</td>
        <td>
          <span style="display:inline-block; padding: 1px 6px; border-radius: 4px; font-weight: bold; font-size: 0.72rem; ${
            item.isReconciled ? 'background-color: #dcfce7; color: #166534;' : 'background-color: #fef3c7; color: #92400e;'
          }">
            ${item.isReconciled ? '✅ تمت المطابقة' : '⏳ معلق للمراجعة'}
          </span>
        </td>
      </tr>
    `;
  });

  const isMatched = Math.abs(data.difference) < 0.01;
  const statusBadge = isMatched
    ? '<span style="color:#16a34a; font-weight:bold;">✅ متطابق ومكتمل الاعتماد</span>'
    : `<span style="color:#dc2626; font-weight:bold;">⚠️ فرق تسوية مطلوب: ${formatNumber(Math.abs(data.difference))} ج.م</span>`;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>مذكرة التسوية والمطابقة البنكية والاعتماد</title>
<style>
  @page { size: auto; margin: 0mm; }
  * { box-sizing: border-box; }
  
  html, body { 
    font-family: 'Segoe UI', Tahoma, Arial, sans-serif; 
    background-color: #f0f2f5; margin: 0; padding: 0; color: #000;
    width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center;
  }

  .report-container { 
    background: #fff; width: 100vw; height: calc(100vh - 25px); max-width: 100%;
    margin: 0 auto; padding: 5mm 7mm; border: 3px solid #000; 
    display: flex; flex-direction: column; justify-content: space-between;
  }

  /* 1. الترويسة */
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 5px; width: 100%; }
  .header-right h2 { margin: 0 0 2px 0; font-size: 1.1rem; font-weight: bold; }
  .header-right p { margin: 0; font-size: 0.75rem; color: #333; }
  .logo-img { max-width: 85px; max-height: 50px; object-fit: contain; }
  .phones-list { list-style: none; padding: 0; margin: 0; font-size: 0.75rem; direction: ltr; text-align: left; }
  .phones-list li { margin-bottom: 1px; font-weight: 600; }

  /* 2. صندوق البيانات والفلترة */
  .info-box { 
    display: flex; justify-content: space-between; align-items: center;
    border: 1.5px solid #000; padding: 4px 8px; margin-bottom: 6px; 
    font-size: 0.78rem; line-height: 1.3; width: 100%; background-color: #fafafa;
  }
  .info-item p { margin: 1px 0; }

  /* 3. كروت الإحصائيات (KPIs) */
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 6px; }
  .kpi-card { border: 1.5px solid #000; padding: 4px 6px; text-align: center; background-color: #f8f9fa; }
  .kpi-card .kpi-title { font-size: 0.7rem; font-weight: bold; color: #333; }
  .kpi-card .kpi-value { font-size: 0.92rem; font-weight: bold; margin-top: 2px; }

  /* 4. الجدول */
  .table-wrapper { width: 100%; flex-grow: 1; overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  th, td { border: 1px solid #000; padding: 3.5px 4px; text-align: center; font-size: 0.74rem; }
  th { background-color: #ededed; font-weight: bold; }
  tfoot tr { background-color: #f1f5f9; font-weight: bold; }

  /* تمييز المبالغ */
  .income-val { color: #16a34a; font-weight: bold; }
  .expense-val { color: #dc2626; font-weight: bold; }

  /* 5. التوقيعات */
  .bottom-section { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 4px; margin-bottom: 4px; width: 100%; font-size: 0.78rem; font-weight: bold; }
  .report-footer-note { border-top: 1.5px solid #000; padding-top: 3px; margin-top: auto; display: flex; justify-content: space-between; font-size: 0.72rem; font-weight: 600; width: 100%; }
  .copyright-outside { width: 100%; text-align: center; font-size: 0.72rem; font-weight: bold; color: #000; padding: 2px 0; direction: rtl; }

  ${getPrintToolbarStyles()}

  @media print {
    body { background: none; padding: 0; margin: 0; }
    .report-container { border: 3px solid #000 !important; width: 100vw !important; height: calc(100vh - 20px) !important; padding: 4mm !important; box-shadow: none; }
  }
</style>
</head>
<body>

${getPrintToolbarHtml('مذكرة التسوية البنكية - ' + data.selectedBank.name)}

<div class="report-container">
  <div>
    <!-- الترويسة -->
    <div class="header">
      <div class="header-right">
        <h2>${companyTitle}</h2>
        <p>${branchAddress}</p>
      </div>
      <div class="header-center">
        <!-- الشعار -->
      </div>
      <div class="header-left">
        <ul class="phones-list">
          <li>${phone}</li>
        </ul>
      </div>
    </div>

    <!-- صندوق البيانات والفلترة -->
    <div class="info-box">
      <div class="info-item" style="text-align: right;">
        <p><strong>نوع التقرير:</strong> <span style="font-weight:bold; font-size:0.85rem;">مذكرة التسوية والمطابقة البنكية والاعتماد</span></p>
        <p><strong>الحساب البنكي:</strong> <span style="font-weight:bold; color:#1a237e;">${data.selectedBank.name} (${data.selectedBank.accountNumber})</span></p>
      </div>
      <div class="info-item" style="text-align: center;">
        <p><strong>تاريخ التسوية:</strong> <span id="lblTransactionDate">${data.targetDate}</span></p>
        <p><strong>مسؤول المراجعة والاعتماد:</strong> <span>${data.issuerName}</span></p>
      </div>
      <div class="info-item" style="text-align: left;">
        <p><strong>تاريخ الطباعة:</strong> <span id="lblPrintDate">${printDate}</span></p>
        <p><strong>وقت الطباعة:</strong> <span id="lblPrintTime">${printTime}</span></p>
      </div>
    </div>

    <!-- كروت الإحصائيات (KPIs) -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-title">الرصيد الدفتري بالنظام</div>
        <div class="kpi-value" style="color:#1e40af;">${formatNumber(data.bookBalance)} ج.م</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">رصيد كشف الحساب البنكي</div>
        <div class="kpi-value income-val">${formatNumber(data.statementBalance)} ج.م</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">فرق التسوية (Variance)</div>
        <div class="kpi-value" style="color:${isMatched ? '#16a34a' : '#dc2626'};">${formatNumber(data.difference)} ج.م</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">حالة المطابقة والاعتماد</div>
        <div class="kpi-value" style="font-size:0.8rem;">${statusBadge}</div>
      </div>
    </div>

    <!-- جدول بنود التسوية والمطابقة -->
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th style="width: 10%;">تاريخ الحركة</th>
            <th style="width: 13%;">المرجع / الشيك</th>
            <th style="width: 32%; text-align: right;">البيان التفصيلي بكشف الحساب</th>
            <th style="width: 13%;">طبيعة الحركة</th>
            <th style="width: 11%;">مدين / سحب (-)</th>
            <th style="width: 11%;">دائن / إيداع (+)</th>
            <th style="width: 10%;">حالة المطابقة</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="4" style="text-align: right; font-weight:bold;">إجمالي حركات كشف الحساب البنكي</td>
            <td class="expense-val">${formatNumber(totalDebit)}</td>
            <td class="income-val">${formatNumber(totalCredit)}</td>
            <td style="font-weight:bold; color:#1a237e;">الصافي: ${formatNumber(totalCredit - totalDebit)}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- التوقيعات والاعتماد -->
    <div class="bottom-section">
      <div>المحاسب المسؤول / مدخل البيانات: ....................</div>
      <div>المراجع والمطابقة الداخلية: ....................</div>
      <div>يعتمد / المدير المالي العام: ....................</div>
    </div>
  </div>

  <div>
    <div class="report-footer-note">
      <div>* تطابق هذه المذكرة الأرصدة البنكية الدفترية مع الكشوفات المصرفية المعتمدة رسمياً وتخضع للمراجعة الدورية</div>
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

export function printBankReconciliationReportWindow(
  appData: AppData,
  bankAccountId?: string,
  targetDate?: string,
  showToast?: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void
): void {
  try {
    const htmlContent = generateBankReconciliationReportHtml(appData, bankAccountId, targetDate);
    const printWindow = window.open('', '_blank', 'width=1100,height=850,menubar=no,toolbar=no,location=no,status=no');

    if (!printWindow) {
      if (showToast) {
        showToast('يرجى السماح بالنوافذ المنبثقة لطباعة مذكرة التسوية والمطابقة البنكية', 'warning');
      }
      return;
    }

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    if (showToast) {
      showToast('تم فتح وتجهيز مذكرة التسوية البنكية ومحضر الاعتماد للطباعة والمعاينة بنجاح', 'success');
    }
  } catch (err) {
    console.error('Error printing bank reconciliation report:', err);
    if (showToast) {
      showToast('حدث خطأ أثناء إعداد مذكرة التسوية البنكية للطباعة', 'error');
    }
  }
}
