import * as XLSX from 'xlsx';
import { AccountNode, Item } from '../types';

export interface ExcelColumn<T = any> {
  header: string;
  key?: string | number | symbol;
  getValue?: (item: any, index: number) => any;
  width?: number;
  isCurrency?: boolean;
  isNumeric?: boolean;
}

/**
 * Format a number to 2 decimal places with comma separation or return raw number
 */
function cleanNumericValue(val: any): number | null {
  if (typeof val === 'number' && !isNaN(val)) return val;
  if (typeof val === 'string') {
    // Strip currency symbols and spaces
    const cleaned = val.replace(/[^\d.-]/g, '');
    const num = parseFloat(cleaned);
    if (!isNaN(num)) return num;
  }
  return null;
}

/**
 * Export structured JSON data or rows to an Excel (.xlsx) file with RTL support and formatting
 */
export function exportToExcel<T = any>({
  filename,
  sheetName = 'البيانات',
  data,
  columns,
  companyName = 'منظومة ركيزة RAKEEZA ERP',
  reportTitle,
  includeSummaryRow = true,
  currencySymbol = 'ج.م',
}: {
  filename: string;
  sheetName?: string;
  data: T[] | any[];
  columns: ExcelColumn<any>[];
  companyName?: string;
  reportTitle?: string;
  includeSummaryRow?: boolean;
  currencySymbol?: string;
}) {
  try {
    const rows: any[][] = [];

    // 1. Report Header in Excel
    if (companyName) {
      rows.push([companyName]);
    }
    if (reportTitle) {
      rows.push([reportTitle]);
      rows.push([`تاريخ الاستخراج: ${new Date().toLocaleString('ar-EG')} - منظومة ركيزة لإدارة الموارد السحابية ERP`]);
      rows.push([]); // Empty row
    }

    // 2. Table Headers
    const headers = columns.map((c) => c.header);
    rows.push(headers);

    // Track column totals for numeric columns
    const columnTotals: (number | null)[] = columns.map(() => 0);
    const hasNumericInCol: boolean[] = columns.map(() => false);

    // 3. Data Rows
    data.forEach((item, idx) => {
      const row = columns.map((col, colIdx) => {
        let rawVal = '';
        if (col.getValue) {
          rawVal = col.getValue(item, idx);
        } else if (col.key && item && typeof item === 'object') {
          const v = (item as any)[col.key];
          rawVal = v !== undefined && v !== null ? v : '';
        }

        // Check if value is numeric
        const numVal = cleanNumericValue(rawVal);
        if (numVal !== null && (col.isNumeric || col.isCurrency || typeof rawVal === 'number')) {
          hasNumericInCol[colIdx] = true;
          if (columnTotals[colIdx] !== null) {
            columnTotals[colIdx] = (columnTotals[colIdx] || 0) + numVal;
          }
          return numVal;
        }

        return rawVal !== undefined && rawVal !== null ? String(rawVal) : '';
      });
      rows.push(row);
    });

    // 4. Optional Summary / Total Row
    if (includeSummaryRow && data.length > 0) {
      const hasAnyTotal = hasNumericInCol.some((hasNum) => hasNum);
      if (hasAnyTotal) {
        const summaryRow = columns.map((col, colIdx) => {
          if (colIdx === 0) return 'الإجمالي الكلي';
          if (colIdx === 1 && !hasNumericInCol[1]) return `(عدد السجلات: ${data.length})`;
          if (hasNumericInCol[colIdx] && columnTotals[colIdx] !== null) {
            const tot = columnTotals[colIdx]!;
            return Math.round(tot * 100) / 100;
          }
          return '';
        });
        rows.push(summaryRow);
      }
    }

    // 5. Create Workbook & Worksheet
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Set RTL direction
    if (!ws['!views']) ws['!views'] = [];
    ws['!views'].push({ rightToLeft: true });

    // Set Column Widths based on headers and data length
    ws['!cols'] = columns.map((c, colIdx) => {
      let maxLen = c.header.length;
      data.slice(0, 100).forEach((item, idx) => {
        const val = c.getValue ? c.getValue(item, idx) : item?.[c.key as any];
        if (val) maxLen = Math.max(maxLen, String(val).length);
      });
      return {
        wch: c.width || Math.max(maxLen + 5, 14),
      };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));

    // Ensure valid filename extension
    const cleanFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;

    // Trigger download
    XLSX.writeFile(wb, cleanFilename);
    return true;
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    alert('حدث خطأ أثناء تصدير ملف الإكسيل. يرجى المحاولة مرة أخرى.');
    return false;
  }
}

/**
 * Export Trial Balance (ميزان المراجعة) with standard accounting balance checks
 */
export function exportTrialBalanceToExcel({
  accounts,
  companyName = 'منظومة ركيزة RAKEEZA ERP',
  appData,
}: {
  accounts: AccountNode[];
  companyName?: string;
  appData: any;
}) {
  const todayStr = new Date().toISOString().split('T')[0];

  // Calculate totals
  const allSales = (appData.salesInvoices || []).reduce((sum: number, inv: any) => sum + (inv.total || 0), 0);
  const allPurchases = (appData.purchaseInvoices || []).reduce((sum: number, inv: any) => sum + (inv.total || 0), 0);
  const totalReceivables = (appData.customers || []).reduce((sum: number, c: any) => sum + (c.balance || 0), 0);
  const totalPayables = (appData.suppliers || []).reduce((sum: number, s: any) => sum + (s.balance || 0), 0);
  const totalInventoryVal = (appData.items || []).reduce(
    (sum: number, i: any) => sum + (i.quantity || 0) * (i.purchasePrice || 0),
    0
  );
  const operatingExpenses = (appData.cashTransactions || [])
    .filter((c: any) => c.type === 'pay' && !c.supplierName)
    .reduce((sum: number, c: any) => sum + (c.amount || 0), 0);
  const totalCOGS = allPurchases * 0.85;

  const rows: any[][] = [];
  rows.push([companyName]);
  rows.push(['ميزان المراجعة بالأرصدة والمجاميع (Trial Balance)']);
  rows.push([`تاريخ الاستخراج: ${new Date().toLocaleString('ar-EG')} - السنة المالية الحالية`]);
  rows.push([]);

  // Header
  rows.push(['كود الحساب', 'اسم الحساب المحاسبي', 'طبيعة الحساب', 'مجموع المدين (Debit) ج.م', 'مجموع الدائن (Credit) ج.م', 'رصيد الحساب النهائي ج.م']);

  let totalDebitSum = 0;
  let totalCreditSum = 0;

  const subAccounts = accounts.filter((a) => !a.isParent);
  subAccounts.forEach((acc) => {
    let d = 0;
    let c = 0;
    if (acc.code === '1101') d = appData.cashBox?.drawer || 0;
    if (acc.code === '1102') d = appData.cashBox?.vodafone || 0;
    if (acc.code === '1103') d = appData.cashBox?.instapay || 0;
    if (acc.code === '1104') d = appData.cashBox?.bank || 0;
    if (acc.code === '1105') d = totalReceivables;
    if (acc.code === '1106') d = totalInventoryVal;
    if (acc.code === '2101') c = totalPayables;
    if (acc.code === '4101') c = allSales;
    if (acc.code === '5101') d = totalCOGS;
    if (acc.code === '5204') d = operatingExpenses;

    const bal = acc.type === 'asset' || acc.type === 'expense' ? d - c : c - d;

    totalDebitSum += d;
    totalCreditSum += c;

    rows.push([
      acc.code,
      acc.name,
      acc.type === 'asset' ? 'أصول (Assets)' : acc.type === 'liability' ? 'خصوم (Liabilities)' : acc.type === 'equity' ? 'حقوق ملكية (Equity)' : acc.type === 'revenue' ? 'إيرادات (Revenue)' : 'مصروفات (Expenses)',
      d > 0 ? d : 0,
      c > 0 ? c : 0,
      bal,
    ]);
  });

  rows.push([]);
  rows.push(['الإجمالي الكلي', 'توازن ميزان المراجعة المحاسبي', '', totalDebitSum, totalCreditSum, totalDebitSum - totalCreditSum]);
  rows.push(['حالة التوازن:', Math.abs(totalDebitSum - totalCreditSum) < 1 ? '✅ ميزان المراجعة متوازن تماماً' : '⚠️ يوجد فرق تسوية قيد المراجعة']);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  if (!ws['!views']) ws['!views'] = [];
  ws['!views'].push({ rightToLeft: true });

  ws['!cols'] = [
    { wch: 14 },
    { wch: 34 },
    { wch: 22 },
    { wch: 24 },
    { wch: 24 },
    { wch: 26 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ميزان المراجعة');
  XLSX.writeFile(wb, `ميزان_المراجعة_${todayStr}.xlsx`);
  return true;
}

/**
 * Export Income Statement (قائمة الدخل P&L)
 */
export function exportIncomeStatementToExcel({
  companyName = 'منظومة ركيزة RAKEEZA ERP',
  allSales,
  allSalesReturns,
  netSalesRevenue,
  totalCOGS,
  grossProfit,
  operatingExpenses,
  netIncome,
}: {
  companyName?: string;
  allSales: number;
  allSalesReturns: number;
  netSalesRevenue: number;
  totalCOGS: number;
  grossProfit: number;
  operatingExpenses: number;
  netIncome: number;
}) {
  const todayStr = new Date().toISOString().split('T')[0];
  const rows: any[][] = [];

  rows.push([companyName]);
  rows.push(['قائمة الدخل والأرباح والخسائر الشاملة (Income Statement / P&L)']);
  rows.push([`تاريخ الاستخراج: ${new Date().toLocaleString('ar-EG')}`]);
  rows.push([]);

  rows.push(['بند قائمة الدخل', 'القيمة بالعملة المحلية (ج.م)', 'النسبة من الإيرادات']);
  rows.push(['إجمالي المبيعات والإيرادات (Sales Revenue)', allSales, '100.0%']);
  rows.push(['- مردودات ومسموحات المبيعات (Returns)', allSalesReturns, allSales > 0 ? `${((allSalesReturns / allSales) * 100).toFixed(1)}%` : '0%']);
  rows.push(['= صافي المبيعات (Net Sales)', netSalesRevenue, allSales > 0 ? `${((netSalesRevenue / allSales) * 100).toFixed(1)}%` : '0%']);
  rows.push([]);
  rows.push(['- تكلفة البضاعة المباعة (COGS)', totalCOGS, allSales > 0 ? `${((totalCOGS / allSales) * 100).toFixed(1)}%` : '0%']);
  rows.push(['= مجمل الربح التجاري (Gross Profit)', grossProfit, allSales > 0 ? `${((grossProfit / allSales) * 100).toFixed(1)}%` : '0%']);
  rows.push([]);
  rows.push(['- المصروفات التشغيلية والإدارية (Operating Expenses)', operatingExpenses, allSales > 0 ? `${((operatingExpenses / allSales) * 100).toFixed(1)}%` : '0%']);
  rows.push([]);
  rows.push(['🏆 صافي الربح / الخسارة النهائي (Net Profit / Loss)', netIncome, allSales > 0 ? `${((netIncome / allSales) * 100).toFixed(1)}%` : '0%']);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  if (!ws['!views']) ws['!views'] = [];
  ws['!views'].push({ rightToLeft: true });

  ws['!cols'] = [
    { wch: 45 },
    { wch: 28 },
    { wch: 20 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'قائمة الدخل');
  XLSX.writeFile(wb, `قائمة_الدخل_${todayStr}.xlsx`);
  return true;
}

/**
 * Export Balance Sheet (الميزانية العمومية والمركز المالي)
 */
export function exportBalanceSheetToExcel({
  companyName = 'منظومة ركيزة RAKEEZA ERP',
  totalCurrentAssets,
  totalCashBank,
  totalReceivables,
  totalInventoryVal,
  totalFixedAssets,
  totalAssets,
  totalLiabilities,
  totalPayables,
  totalEquity,
  netIncome,
}: {
  companyName?: string;
  totalCurrentAssets: number;
  totalCashBank: number;
  totalReceivables: number;
  totalInventoryVal: number;
  totalFixedAssets: number;
  totalAssets: number;
  totalLiabilities: number;
  totalPayables: number;
  totalEquity: number;
  netIncome: number;
}) {
  const todayStr = new Date().toISOString().split('T')[0];
  const rows: any[][] = [];

  rows.push([companyName]);
  rows.push(['الميزانية العمومية وقائمة المركز المالي (Balance Sheet)']);
  rows.push([`تاريخ الاستخراج: ${new Date().toLocaleString('ar-EG')}`]);
  rows.push([]);

  rows.push(['الجانب المحاسبي', 'البند التفصيلي', 'القيمة الجزئية (ج.م)', 'القيمة الكلية (ج.م)']);

  // Assets
  rows.push(['1. الأصول (Assets)', 'الأصول المتداولة (Current Assets)', '', totalCurrentAssets]);
  rows.push(['', '• النقدية وما في حكمها (خزائن وبنوك)', totalCashBank, '']);
  rows.push(['', '• العملاء والمدينون التجاريون', totalReceivables, '']);
  rows.push(['', '• المخزون السلعي التام', totalInventoryVal, '']);
  rows.push(['', 'الأصول الثابتة (Fixed Assets)', totalFixedAssets, totalFixedAssets]);
  rows.push(['', 'إجمالي الأصول الكلية (Total Assets)', '', totalAssets]);
  rows.push([]);

  // Liabilities & Equity
  rows.push(['2. الخصوم وحقوق الملكية', 'الخصوم المتداولة (Current Liabilities)', '', totalLiabilities]);
  rows.push(['', '• الموردين والدائنون التجاريون', totalPayables, '']);
  rows.push(['', 'حقوق الملكية (Owner’s Equity)', '', totalEquity]);
  rows.push(['', '• رأس المال والأرباح المرحلة', totalEquity - netIncome, '']);
  rows.push(['', '• أرباح / خسائر الفترة الحالية', netIncome, '']);
  rows.push(['', 'إجمالي الخصوم وحقوق الملكية', '', totalLiabilities + totalEquity]);
  rows.push([]);

  const isBalanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1;
  rows.push(['توازن معادلة المركز المالي:', isBalanced ? '✅ المعادلة متوازنة: الأصول = الخصوم + حقوق الملكية' : '⚠️ جاري تسوية قيود الإقفال']);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  if (!ws['!views']) ws['!views'] = [];
  ws['!views'].push({ rightToLeft: true });

  ws['!cols'] = [
    { wch: 28 },
    { wch: 38 },
    { wch: 24 },
    { wch: 24 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'المركز المالي');
  XLSX.writeFile(wb, `الميزانية_العمومية_${todayStr}.xlsx`);
  return true;
}

/**
 * Export Inventory Valuation & Reorder Status to Excel
 */
export function exportInventoryValuationToExcel({
  items,
  companyName = 'منظومة ركيزة RAKEEZA ERP',
}: {
  items: Item[];
  companyName?: string;
}) {
  const todayStr = new Date().toISOString().split('T')[0];
  const columns: ExcelColumn<Item>[] = [
    { header: 'كود الصنف', key: 'id', width: 14 },
    { header: 'اسم الصنف', key: 'name', width: 30 },
    { header: 'التصنيف / المجموعة', getValue: (it) => it.category || 'عام', width: 18 },
    { header: 'الوحدة', getValue: (it) => it.unit || 'قطعة', width: 12 },
    { header: 'الرصيد الفعلي بالمخزن', getValue: (it) => it.quantity || 0, isNumeric: true, width: 18 },
    { header: 'حد إعادة الطلب (Alert)', getValue: (it) => it.minStockAlert || 0, isNumeric: true, width: 18 },
    {
      header: 'حالة المخزون وحد الطلب',
      getValue: (it) => {
        const minAlert = it.minStockAlert !== undefined ? it.minStockAlert : 5;
        if (it.quantity <= 0) return '🚨 نفد تماماً (رصيد 0)';
        if (it.quantity <= minAlert) return '⚠️ وصل لحد الطلب (بحاجة لتوريد)';
        return '✅ مخزون آمن';
      },
      width: 24,
    },
    { header: 'سعر الشراء (التكلفة) ج.م', getValue: (it) => it.purchasePrice || 0, isCurrency: true, width: 20 },
    {
      header: 'إجمالي تقييم المخزون بالتكلفة (ج.م)',
      getValue: (it) => Math.round((it.quantity || 0) * (it.purchasePrice || 0) * 100) / 100,
      isCurrency: true,
      width: 26,
    },
    { header: 'سعر البيع النقدي ج.م', getValue: (it) => it.salePrice || 0, isCurrency: true, width: 18 },
    {
      header: 'إجمالي القيمة البيعية المتوقعة (ج.م)',
      getValue: (it) => Math.round((it.quantity || 0) * (it.salePrice || 0) * 100) / 100,
      isCurrency: true,
      width: 26,
    },
    {
      header: 'هامش الربح المتوقع %',
      getValue: (it) => {
        if (!it.purchasePrice || it.purchasePrice <= 0) return '0%';
        const margin = ((it.salePrice - it.purchasePrice) / it.purchasePrice) * 100;
        return `${margin.toFixed(1)}%`;
      },
      width: 18,
    },
  ];

  return exportToExcel({
    filename: `تقييم_المخزون_وحدود_الطلب_${todayStr}`,
    sheetName: 'تقييم المخزون وحد الطلب',
    data: items,
    columns,
    companyName,
    reportTitle: 'كشف الجرد المخزني الشامل وتقييم البضاعة وحالة حدود الطلب',
    includeSummaryRow: true,
  });
}
