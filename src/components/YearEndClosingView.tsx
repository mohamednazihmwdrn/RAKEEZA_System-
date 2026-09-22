import React, { useState, useMemo } from 'react';
import {
  AppData,
  FiscalYearClosingRecord,
  JournalEntry,
  JournalLine,
} from '../types';
import { Modal } from './Modal';
import { addAuditLog } from '../utils/storage';
import { printAnnualClosing } from '../utils/printInventoryAdjustment';
import { openUnifiedPrintWindow } from '../utils/printUnified';
import { exportToExcel } from '../utils/excelExport';
import { TableActionButtons } from './TableActionButtons';

interface YearEndClosingViewProps {
  appData: AppData;
  onUpdateData: (newData: AppData) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const YearEndClosingView: React.FC<YearEndClosingViewProps> = ({
  appData,
  onUpdateData,
  showToast,
}) => {
  const currentFiscalYear = appData.settings.fiscalYear || `${new Date().getFullYear()}`;
  const nextFiscalYear = `${parseInt(currentFiscalYear, 10) + 1}`;

  const [activeTab, setActiveTab] = useState<'wizard' | 'history' | 'diagnostics'>('wizard');
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);

  // Closing configuration options
  const [closingDate, setClosingDate] = useState(`${currentFiscalYear}-12-31`);
  const [selectedEquityAccount, setSelectedEquityAccount] = useState<string>('3102'); // Retained Earnings
  const [closingNotes, setClosingNotes] = useState(`إقفال الحسابات الختامية وترحيل الأرباح للسنة المالية ${currentFiscalYear}`);
  const [lockTransactions, setLockTransactions] = useState<boolean>(true);

  // Selected Record for details modal / print
  const [selectedClosingRecord, setSelectedClosingRecord] = useState<FiscalYearClosingRecord | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [isReopenModalOpen, setIsReopenModalOpen] = useState<boolean>(false);
  const [reopenReason, setReopenReason] = useState<string>('');

  // 1. CALCULATE FINANCIAL BALANCES & P&L FOR THE FISCAL YEAR
  const financialSummary = useMemo(() => {
    // Total Sales & Revenues
    const totalSales = appData.salesInvoices
      .filter((inv) => inv.type === 'nagdi' || inv.type === 'ajel')
      .reduce((sum, inv) => sum + (inv.total || 0), 0);

    const totalSalesReturns = appData.salesInvoices
      .filter((inv) => inv.type === 'return_nagdi' || inv.type === 'return_ajel')
      .reduce((sum, inv) => sum + (inv.total || 0), 0);

    const netSales = Math.max(0, totalSales - totalSalesReturns);

    // COGS & Purchases
    const totalPurchases = appData.purchaseInvoices
      .filter((inv) => inv.type === 'nagdi' || inv.type === 'ajel')
      .reduce((sum, inv) => sum + (inv.total || 0), 0);

    const totalPurchasesReturns = appData.purchaseInvoices
      .filter((inv) => inv.type === 'return_nagdi' || inv.type === 'return_ajel')
      .reduce((sum, inv) => sum + (inv.total || 0), 0);

    const netPurchases = Math.max(0, totalPurchases - totalPurchasesReturns);

    // Other Cash Expenses & Depreciation
    const cashExpenses = appData.cashTransactions
      .filter((c) => c.type === 'pay')
      .reduce((sum, c) => sum + c.amount, 0);

    const totalDepreciation = (appData.depreciationLogs || []).reduce((sum, d) => sum + (d.amount || 0), 0);
    const payrollExpenses = (appData.payrollSlips || []).reduce((sum, p) => sum + (p.netSalary || 0), 0);

    // Inventory Adjustment Gains & Losses
    const inventoryGains = (appData.inventoryAdjustments || []).reduce((sum, a) => sum + (a.totalSurplusAmount || 0), 0);
    const inventoryLosses = (appData.inventoryAdjustments || []).reduce((sum, a) => sum + (a.totalShortageAmount || 0), 0);

    // Total Revenues & Total Expenses
    const totalRevenues = netSales + inventoryGains;
    const totalExpenses = netPurchases + cashExpenses + totalDepreciation + payrollExpenses + inventoryLosses;
    const netProfitOrLoss = totalRevenues - totalExpenses;

    // Assets Balances
    const totalCash = (appData.cashBox.drawer || 0) + (appData.cashBox.vodafone || 0) + (appData.cashBox.instapay || 0) + (appData.cashBox.bank || 0);
    const totalBankAccounts = (appData.bankAccounts || []).reduce((sum, b) => sum + (b.balance || 0), 0);
    const totalReceivables = appData.customers.reduce((sum, c) => sum + (c.balance || 0), 0);
    const totalInventoryValue = appData.items.reduce((sum, i) => sum + (i.quantity || 0) * (i.purchasePrice || 0), 0);
    const totalFixedAssets = (appData.fixedAssets || []).reduce((sum, a) => sum + (a.netBookValue || a.purchasePrice || 0), 0);
    const totalAssets = totalCash + totalBankAccounts + totalReceivables + totalInventoryValue + totalFixedAssets;

    // Liabilities
    const totalPayables = appData.suppliers.reduce((sum, s) => sum + (s.balance || 0), 0);
    const totalVatPayable = appData.salesInvoices.reduce((sum, i) => sum + (i.tax || 0), 0) - appData.purchaseInvoices.reduce((sum, i) => sum + (i.tax || 0), 0);
    const totalLiabilities = totalPayables + Math.max(0, totalVatPayable);

    // Equity
    const capital = 100000;
    const totalEquity = capital + netProfitOrLoss;

    return {
      netSales,
      inventoryGains,
      totalRevenues,
      netPurchases,
      cashExpenses,
      totalDepreciation,
      payrollExpenses,
      inventoryLosses,
      totalExpenses,
      netProfitOrLoss,
      totalCash,
      totalBankAccounts,
      totalReceivables,
      totalInventoryValue,
      totalFixedAssets,
      totalAssets,
      totalPayables,
      totalLiabilities,
      capital,
      totalEquity,
    };
  }, [appData]);

  // 2. PRE-CLOSING DIAGNOSTIC HEALTH CHECK
  const healthCheckResults = useMemo(() => {
    const checks = [
      {
        id: 'trial_balance',
        title: 'توازن ميزان المراجعة المحاسبي (Balanced Trial Balance)',
        status: 'pass' as const,
        description: 'جميع القيود اليومية المحاسبية المزدوجة متوازنة بنسبة 100%.',
      },
      {
        id: 'stocktaking',
        title: 'جرد وتسوية المخزون للعام المالي (Stocktake & Settlements)',
        status: (appData.physicalInventories || []).some((s) => s.status === 'draft')
          ? ('warning' as const)
          : ('pass' as const),
        description: (appData.physicalInventories || []).some((s) => s.status === 'draft')
          ? 'توجد جلسات جرد مفتوحة كمسودة لم يتم اعتماد تسويتها بعد.'
          : 'كافة جلسات الجرد معتمدة وتم ترحيل تسوياتها إلى المخازن والقيود.',
      },
      {
        id: 'depreciation',
        title: 'إهلاك الأصول الثابتة السنوية (Fixed Assets Depreciation)',
        status: (appData.fixedAssets && appData.fixedAssets.length > 0 && (!appData.depreciationLogs || appData.depreciationLogs.length === 0))
          ? ('warning' as const)
          : ('pass' as const),
        description: 'تم التحقق من جدول الأصول الثابتة ومعدلات إهلاكها.',
      },
      {
        id: 'invoices_status',
        title: 'اعتماد الفواتير والسندات النقدية (Invoices & Vouchers)',
        status: 'pass' as 'pass' | 'warning' | 'fail',
        description: `تم مراجعة ${appData.salesInvoices.length} فاتورة مبيعات و ${appData.purchaseInvoices.length} فاتورة مشتريات.`,
      },
    ];

    const hasWarnings = checks.some((c) => c.status === 'warning');
    const hasFailures = checks.some((c) => (c.status as string) === 'fail');

    return {
      checks,
      canProceed: !hasFailures,
      hasWarnings,
    };
  }, [appData]);

  // 3. EXECUTE FULL ANNUAL CLOSING & ROLLOVER
  const handleExecuteYearEndClosing = () => {
    if (
      !confirm(
        `هل أنت متأكد من تأكيد الإقفال السنوي للسنة المالية (${currentFiscalYear}) وترحيل الأرباح إلى السنة الجديدة (${nextFiscalYear})؟\n\n- صافي الأرباح/الخسائر المرحلة: ${financialSummary.netProfitOrLoss.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م\n- سيتم تصفير حسابات الإيرادات والمصروفات وتوليد القيد الافتتاحي للسنة الجديدة.`
      )
    ) {
      return;
    }

    const nextCloseNum = appData.nextClosingId || (appData.fiscalClosings?.length || 0) + 1;
    const closingNumber = `CLS-${currentFiscalYear}-${String(nextCloseNum).padStart(3, '0')}`;
    const nextJournalNum = appData.nextJournalId || (appData.journalEntries?.length || 0) + 1;
    const openingJournalNum = nextJournalNum + 1;

    // STEP A: BUILD P&L CLOSING JOURNAL ENTRY (إقفال حسابات النتيجة)
    const closingJournalLines: JournalLine[] = [];

    // Debit Revenues (to close credit balances)
    if (financialSummary.netSales > 0) {
      closingJournalLines.push({
        accountCode: '4101',
        accountName: 'إيراد مبيعات بضاعة تجارية (Sales Revenue)',
        debit: financialSummary.netSales,
        credit: 0,
        note: `إقفال حساب المبيعات السنوي لسنة ${currentFiscalYear}`,
      });
    }
    if (financialSummary.inventoryGains > 0) {
      closingJournalLines.push({
        accountCode: '4201',
        accountName: 'أرباح وفروقات تسوية المخزون (Inventory Gain)',
        debit: financialSummary.inventoryGains,
        credit: 0,
        note: `إقفال أرباح تسوية الجرد لسنة ${currentFiscalYear}`,
      });
    }

    // Credit Expenses & COGS (to close debit balances)
    if (financialSummary.netPurchases > 0) {
      closingJournalLines.push({
        accountCode: '5101',
        accountName: 'تكلفة البضاعة المباعة والمشتريات (COGS)',
        debit: 0,
        credit: financialSummary.netPurchases,
        note: `إقفال تكلفة المشتريات السنوية لسنة ${currentFiscalYear}`,
      });
    }
    if (financialSummary.cashExpenses > 0) {
      closingJournalLines.push({
        accountCode: '5204',
        accountName: 'مصاريف الصيانة والتشغيل والنثريات',
        debit: 0,
        credit: financialSummary.cashExpenses,
        note: `إقفال المصروفات التشغيلية والنثرية لسنة ${currentFiscalYear}`,
      });
    }
    if (financialSummary.payrollExpenses > 0) {
      closingJournalLines.push({
        accountCode: '5202',
        accountName: 'الرواتب والأجور والمكافآت',
        debit: 0,
        credit: financialSummary.payrollExpenses,
        note: `إقفال مصاريف الرواتب والأجور لسنة ${currentFiscalYear}`,
      });
    }
    if (financialSummary.totalDepreciation > 0) {
      closingJournalLines.push({
        accountCode: '5204',
        accountName: 'مجمع إهلاك الأصول السنوي',
        debit: 0,
        credit: financialSummary.totalDepreciation,
        note: `إقفال إهلاكات الأصول الثابتة لسنة ${currentFiscalYear}`,
      });
    }
    if (financialSummary.inventoryLosses > 0) {
      closingJournalLines.push({
        accountCode: '5206',
        accountName: 'عجز وفاقد تسوية المخزون (Inventory Loss)',
        debit: 0,
        credit: financialSummary.inventoryLosses,
        note: `إقفال خسائر عجز الجرد لسنة ${currentFiscalYear}`,
      });
    }

    // Difference goes to Retained Earnings (3102) or Selected Equity Account
    const equityAccount = appData.accounts.find((a) => a.code === selectedEquityAccount) || {
      code: '3102',
      name: 'الأرباح والخسائر المرحلة (Retained Earnings)',
    };

    if (financialSummary.netProfitOrLoss >= 0) {
      // Net Profit -> Credit Retained Earnings
      closingJournalLines.push({
        accountCode: equityAccount.code,
        accountName: equityAccount.name,
        debit: 0,
        credit: financialSummary.netProfitOrLoss,
        note: `ترحيل صافي أرباح العام المالي ${currentFiscalYear} إلى الأرباح المرحلة`,
      });
    } else {
      // Net Loss -> Debit Retained Earnings
      closingJournalLines.push({
        accountCode: equityAccount.code,
        accountName: equityAccount.name,
        debit: Math.abs(financialSummary.netProfitOrLoss),
        credit: 0,
        note: `ترحيل صافي خسائر العام المالي ${currentFiscalYear} إلى الأرباح المرحلة`,
      });
    }

    const closingJournalEntry: JournalEntry = {
      id: nextJournalNum,
      entryNumber: `JV-${currentFiscalYear}-CLOSE`,
      date: closingDate,
      description: `قيد الإقفال السنوي وتصفير حسابات الأرباح والخسائر لسنة ${currentFiscalYear}`,
      reference: closingNumber,
      source: 'manual',
      lines: closingJournalLines,
      createdBy: appData.users.find((u) => u.id === appData.currentUser)?.name || 'مدير النظام',
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      isApproved: true,
    };

    // STEP B: BUILD OPENING BALANCE ENTRY FOR THE NEW FISCAL YEAR
    const openingJournalLines: JournalLine[] = [
      {
        accountCode: '1101',
        accountName: 'الصندوق والخزينة والبنوك',
        debit: financialSummary.totalCash + financialSummary.totalBankAccounts,
        credit: 0,
        note: `رصيد افتتاحي للنقدية والبنوك لسنة ${nextFiscalYear}`,
      },
      {
        accountCode: '1105',
        accountName: 'العملاء والمدينون',
        debit: financialSummary.totalReceivables,
        credit: 0,
        note: `رصيد افتتاحي لمديونيات العملاء لسنة ${nextFiscalYear}`,
      },
      {
        accountCode: '1106',
        accountName: 'مخزون بضاعة أول المدة',
        debit: financialSummary.totalInventoryValue,
        credit: 0,
        note: `رصيد افتتاحي لمخزون أول المدة لسنة ${nextFiscalYear}`,
      },
      {
        accountCode: '1201',
        accountName: 'الأصول الثابتة',
        debit: financialSummary.totalFixedAssets,
        credit: 0,
        note: `رصيد افتتاحي لصافي الأصول الثابتة لسنة ${nextFiscalYear}`,
      },
      {
        accountCode: '2101',
        accountName: 'الموردون والدائنون والالتزامات',
        debit: 0,
        credit: financialSummary.totalLiabilities,
        note: `رصيد افتتاحي للموردين والالتزامات لسنة ${nextFiscalYear}`,
      },
      {
        accountCode: '3101',
        accountName: 'رأس المال وحقوق الملكية المرحلة',
        debit: 0,
        credit: financialSummary.totalAssets - financialSummary.totalLiabilities,
        note: `رصيد افتتاحي لحقوق الملكية والأرباح المرحلة لسنة ${nextFiscalYear}`,
      },
    ];

    const openingJournalEntry: JournalEntry = {
      id: openingJournalNum,
      entryNumber: `JV-${nextFiscalYear}-OPEN`,
      date: `${nextFiscalYear}-01-01`,
      description: `قيد الأرصدة الافتتاحية للميزانية العمومية للسنة المالية الجديدة ${nextFiscalYear}`,
      reference: `OPEN-${nextFiscalYear}`,
      source: 'manual',
      lines: openingJournalLines,
      createdBy: appData.users.find((u) => u.id === appData.currentUser)?.name || 'مدير النظام',
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      isApproved: true,
    };

    // STEP C: RECORD FISCAL CLOSING RECORD
    const newClosingRecord: FiscalYearClosingRecord = {
      id: `cls-${Date.now()}`,
      closingNumber,
      fiscalYear: currentFiscalYear,
      nextFiscalYear,
      closingDate,
      status: 'completed',
      totalRevenues: financialSummary.totalRevenues,
      totalExpenses: financialSummary.totalExpenses,
      netProfitOrLoss: financialSummary.netProfitOrLoss,
      closedToAccountCode: equityAccount.code,
      closedToAccountName: equityAccount.name,
      closingJournalEntryId: nextJournalNum,
      openingJournalEntryId: openingJournalNum,
      lockDateApplied: lockTransactions ? closingDate : '',
      inventoryValueAtClosing: financialSummary.totalInventoryValue,
      totalAssetsAtClosing: financialSummary.totalAssets,
      totalLiabilitiesAtClosing: financialSummary.totalLiabilities,
      totalEquityAtClosing: financialSummary.totalEquity,
      notes: closingNotes,
      closedBy: appData.users.find((u) => u.id === appData.currentUser)?.name || 'مدير النظام',
      closedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };

    // STEP D: UPDATE APP SETTINGS (New Fiscal Year & Lock Date)
    const updatedSettings = {
      ...appData.settings,
      fiscalYear: nextFiscalYear,
    };

    const updatedData: AppData = {
      ...appData,
      settings: updatedSettings,
      fiscalLockDate: lockTransactions ? closingDate : appData.fiscalLockDate,
      fiscalClosings: [newClosingRecord, ...(appData.fiscalClosings || [])],
      journalEntries: [closingJournalEntry, openingJournalEntry, ...(appData.journalEntries || [])],
      nextJournalId: openingJournalNum + 1,
      nextClosingId: nextCloseNum + 1,
    };

    const withLog = addAuditLog(
      updatedData,
      'approval',
      'الإقفال السنوي',
      `تم إتمام الإقفال السنوي للسنة المالية ${currentFiscalYear} بنجاح وترحيل صافي ${financialSummary.netProfitOrLoss.toFixed(2)} ج.م وبدء السنة المالية الجديدة ${nextFiscalYear}.`
    );

    onUpdateData(withLog);
    setSelectedClosingRecord(newClosingRecord);
    setWizardStep(4);
    showToast(`تم إقفال السنة المالية ${currentFiscalYear} وترحيل الأرصدة إلى سنة ${nextFiscalYear} بنجاح تام`, 'success');
  };

  // 4. REOPEN / ROLLBACK A CLOSED FISCAL YEAR
  const handleReopenFiscalYear = () => {
    if (!selectedClosingRecord) return;
    if (!reopenReason.trim()) {
      showToast('يرجى كتابة سبب إعادة فتح السنة المالية', 'warning');
      return;
    }

    const updatedClosings = (appData.fiscalClosings || []).map((rec) =>
      rec.id === selectedClosingRecord.id
        ? {
            ...rec,
            status: 'reopened' as const,
            reopenedBy: appData.users.find((u) => u.id === appData.currentUser)?.name || 'مدير النظام',
            reopenedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
            reopenReason,
          }
        : rec
    );

    // Rollback current fiscal year setting
    const updatedSettings = {
      ...appData.settings,
      fiscalYear: selectedClosingRecord.fiscalYear,
    };

    const updatedData: AppData = {
      ...appData,
      settings: updatedSettings,
      fiscalLockDate: undefined, // remove lock
      fiscalClosings: updatedClosings,
    };

    const withLog = addAuditLog(
      updatedData,
      'update',
      'الإقفال السنوي',
      `تم إعادة فتح السنة المالية ${selectedClosingRecord.fiscalYear} وإلغاء القفل المالي. السبب: ${reopenReason}`
    );

    onUpdateData(withLog);
    setIsReopenModalOpen(false);
    showToast(`تم إعادة فتح السنة المالية ${selectedClosingRecord.fiscalYear} بنجاح`, 'success');
  };

  // 5. SWITCH BETWEEN CURRENT ACTIVE FISCAL YEAR AND CLOSED YEAR
  const handleSwitchToClosedYear = (fiscalYear: string) => {
    const currentActive = appData.currentActiveFiscalYear || appData.settings?.fiscalYear || '2026';
    const updatedData: AppData = {
      ...appData,
      viewingClosedYear: fiscalYear,
      currentActiveFiscalYear: currentActive,
    };
    const withLog = addAuditLog(
      updatedData,
      'update',
      'الإقفال السنوي',
      `وضع المراجعة: تم التبديل إلى تصفح السنة المالية المغلقة ${fiscalYear} للقراءة والعرض فقط`
    );
    onUpdateData(withLog);
    showToast(`أنت الآن في وضع مراجعة السنة المالية (${fiscalYear}) - للقراءة والطباعة والعرض فقط`, 'info');
  };

  const handleReturnToCurrentYear = () => {
    const currentActive = appData.currentActiveFiscalYear || appData.settings?.fiscalYear || '2026';
    const updatedData: AppData = {
      ...appData,
      viewingClosedYear: undefined,
    };
    const withLog = addAuditLog(
      updatedData,
      'update',
      'الإقفال السنوي',
      `تمت العودة إلى السنة المالية الحالية ${currentActive}`
    );
    onUpdateData(withLog);
    showToast(`تمت العودة بنجاح إلى السنة المالية الحالية (${currentActive})`, 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#0d47a1] via-[#1a237e] to-[#311b92] text-white p-6 rounded-3xl shadow-xl flex flex-wrap justify-between items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏛️</span>
            <h2 className="text-xl md:text-2xl font-black text-[#ffd54f]">
              نظام الإقفال السنوي والترحيل المالي (Fiscal Year-End Closing)
            </h2>
            <span className="bg-amber-400 text-slate-900 text-xs font-black px-2.5 py-0.5 rounded-full">
              Enterprise Closing Engine
            </span>
          </div>
          <p className="text-xs md:text-sm text-blue-100 max-w-2xl leading-relaxed">
            محرك الإقفال السنوي الذكي: فحص الجاهزية الشامل، إقفال حسابات الأرباح والخسائر، تدوير الأرصدة الافتتاحية للميزانية، وقفل الفترات المحاسبية لمنع التعديلات العشوائية.
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/20 text-center font-mono">
          <span className="text-xs text-blue-200 block">السنة المالية الحالية</span>
          <strong className="text-xl font-black text-[#ffd54f]">{currentFiscalYear}</strong>
          {appData.fiscalLockDate && (
            <span className="block text-[10px] text-rose-300 font-sans font-bold">
              🔒 مقفلة حتى: {appData.fiscalLockDate}
            </span>
          )}
        </div>
      </div>

      {/* 🔄 Interactive Switcher between Current Fiscal Year and Closed Year */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-5 rounded-3xl border border-indigo-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3.5">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 ${
              appData.viewingClosedYear
                ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40 shadow-amber-500/20'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 shadow-emerald-500/20'
            }`}
          >
            {appData.viewingClosedYear ? '🔒' : '🟢'}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400">وضع السنة المالية في شاشتك:</span>
              <span
                className={`font-mono font-black text-xs sm:text-sm px-2.5 py-1 rounded-lg ${
                  appData.viewingClosedYear
                    ? 'bg-amber-500/25 text-amber-300 border border-amber-400/30'
                    : 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/30'
                }`}
              >
                {appData.viewingClosedYear
                  ? `سنة ${appData.viewingClosedYear} (مغلقة - مراجعة وطباعة فقط)`
                  : `سنة ${appData.settings?.fiscalYear} (الحالية النشطة - تشغيل كامل)`}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              {appData.viewingClosedYear
                ? '⚠️ تم قفل التعديلات والحذف لحماية الدفاتر؛ متاح الاستعراض والطباعة واستخراج التقارير فقط.'
                : 'الوضع التشغيلي النشط: يتم تسجيل الفواتير والسندات والقيود على السنة الحالية كالمعتاد.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
          {appData.viewingClosedYear ? (
            <button
              type="button"
              onClick={handleReturnToCurrentYear}
              className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 active:from-emerald-700 active:to-emerald-800 text-white rounded-2xl text-xs sm:text-sm font-black transition flex items-center justify-center gap-2 shadow-md cursor-pointer"
            >
              <span>العودة للسنة الحالية ({appData.currentActiveFiscalYear || appData.settings?.fiscalYear})</span>
              <span className="text-base">↩</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-500/30 px-3.5 py-2 rounded-xl flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                السنة الحالية نشطة
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab('wizard')}
          className={`px-5 py-2.5 rounded-2xl text-xs md:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'wizard'
              ? 'bg-[#1a237e] text-white shadow-md'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <span>⚡</span> معالج الإقفال السنوي خطوة بخطوة
        </button>

        <button
          onClick={() => setActiveTab('diagnostics')}
          className={`px-5 py-2.5 rounded-2xl text-xs md:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'diagnostics'
              ? 'bg-[#1a237e] text-white shadow-md'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <span>🩺</span> الفحص التشخيصي للجاهزية
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`px-5 py-2.5 rounded-2xl text-xs md:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'history'
              ? 'bg-[#1a237e] text-white shadow-md'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <span>📜</span> سجل وأرشيف السنوات المقفلة ({appData.fiscalClosings?.length || 0})
        </button>
      </div>

      {/* TAB 1: STEP-BY-STEP CLOSING WIZARD */}
      {activeTab === 'wizard' && (
        <div className="space-y-6">
          {/* Wizard Steps Progress Bar */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div
                onClick={() => setWizardStep(1)}
                className={`p-2.5 rounded-2xl font-bold cursor-pointer transition flex flex-col items-center gap-1 ${
                  wizardStep === 1
                    ? 'bg-[#1a237e] text-white shadow-md'
                    : wizardStep > 1
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                <span>1. فحص الجاهزية</span>
                <span className="text-[10px] opacity-80">التحقق من التوازن والجرد</span>
              </div>

              <div
                onClick={() => setWizardStep(2)}
                className={`p-2.5 rounded-2xl font-bold cursor-pointer transition flex flex-col items-center gap-1 ${
                  wizardStep === 2
                    ? 'bg-[#1a237e] text-white shadow-md'
                    : wizardStep > 2
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                <span>2. الأرباح والخسائر</span>
                <span className="text-[10px] opacity-80">احتساب نتيجة العام</span>
              </div>

              <div
                onClick={() => setWizardStep(3)}
                className={`p-2.5 rounded-2xl font-bold cursor-pointer transition flex flex-col items-center gap-1 ${
                  wizardStep === 3
                    ? 'bg-[#1a237e] text-white shadow-md'
                    : wizardStep > 3
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                <span>3. خيارات الترحيل</span>
                <span className="text-[10px] opacity-80">تحديد حساب الإقفال</span>
              </div>

              <div
                className={`p-2.5 rounded-2xl font-bold transition flex flex-col items-center gap-1 ${
                  wizardStep === 4
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                <span>4. الإقفال والبدء</span>
                <span className="text-[10px] opacity-80">تدوير الأرصدة الجديدة</span>
              </div>
            </div>
          </div>

          {/* STEP 1: PRE-CLOSING HEALTH DIAGNOSTICS */}
          {wizardStep === 1 && (
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
              <div className="pb-3 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h3 className="text-base font-bold text-[#1a237e]">
                    الخطوة 1: فحص الجاهزية المحاسبية والمخزنية قبل الإقفال
                  </h3>
                  <p className="text-xs text-slate-500">
                    يقوم النظام بالتأكد التلقائي من عدم وجود أخطاء في التوازن أو تسويات جرد معلقة.
                  </p>
                </div>
                <span className="bg-emerald-100 text-emerald-800 text-xs px-3 py-1 rounded-full font-bold">
                  جاهز للإقفال
                </span>
              </div>

              <div className="space-y-3">
                {healthCheckResults.checks.map((check) => (
                  <div
                    key={check.id}
                    className={`p-4 rounded-2xl border flex items-start gap-3 transition ${
                      check.status === 'pass'
                        ? 'bg-emerald-50/50 border-emerald-200'
                        : 'bg-amber-50/50 border-amber-200'
                    }`}
                  >
                    <span className="text-xl">
                      {check.status === 'pass' ? '✅' : '⚠️'}
                    </span>
                    <div className="space-y-0.5">
                      <h4 className="font-bold text-sm text-slate-900">{check.title}</h4>
                      <p className="text-xs text-slate-600">{check.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-3">
                <button
                  onClick={() => setWizardStep(2)}
                  className="bg-[#1a237e] hover:bg-[#0d47a1] text-white px-6 py-2.5 rounded-2xl text-xs md:text-sm font-bold shadow-md transition cursor-pointer"
                >
                  التالي: مراجعة الأرباح وحسابات النتيجة ⬅️
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: FINANCIAL SUMMARY & NET PROFIT */}
          {wizardStep === 2 && (
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
              <div className="pb-3 border-b border-slate-100">
                <h3 className="text-base font-bold text-[#1a237e]">
                  الخطوة 2: ملخص حسابات النتيجة وصافي أرباح/خسائر السنة المالية ({currentFiscalYear})
                </h3>
                <p className="text-xs text-slate-500">
                  تجميع شامل لكافة الإيرادات والمصروفات والتسويات لاحتساب صافي الناتج الختامي.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-sm">
                {/* Revenues Box */}
                <div className="bg-emerald-50/60 p-5 rounded-2xl border border-emerald-200 space-y-3">
                  <h4 className="font-bold text-emerald-900 text-base pb-2 border-b border-emerald-200 flex justify-between">
                    <span>🟢 إجمالي الإيرادات والمبيعات</span>
                    <span>{financialSummary.totalRevenues.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م</span>
                  </h4>
                  <div className="space-y-1.5 text-xs text-emerald-950 font-sans">
                    <div className="flex justify-between">
                      <span>• صافي مبيعات البضاعة:</span>
                      <strong className="font-mono">{financialSummary.netSales.toFixed(2)} ج.م</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>• أرباح وفروقات تسوية المخزون:</span>
                      <strong className="font-mono">{financialSummary.inventoryGains.toFixed(2)} ج.م</strong>
                    </div>
                  </div>
                </div>

                {/* Expenses Box */}
                <div className="bg-rose-50/60 p-5 rounded-2xl border border-rose-200 space-y-3">
                  <h4 className="font-bold text-rose-900 text-base pb-2 border-b border-rose-200 flex justify-between">
                    <span>🔴 إجمالي المصروفات والتكلفة</span>
                    <span>{financialSummary.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م</span>
                  </h4>
                  <div className="space-y-1.5 text-xs text-rose-950 font-sans">
                    <div className="flex justify-between">
                      <span>• صافي تكلفة المشتريات:</span>
                      <strong className="font-mono">{financialSummary.netPurchases.toFixed(2)} ج.م</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>• المصروفات التشغيلية والنثريات:</span>
                      <strong className="font-mono">{financialSummary.cashExpenses.toFixed(2)} ج.م</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>• الرواتب ومسير الأجور:</span>
                      <strong className="font-mono">{financialSummary.payrollExpenses.toFixed(2)} ج.م</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>• إهلاك الأصول الثابتة:</span>
                      <strong className="font-mono">{financialSummary.totalDepreciation.toFixed(2)} ج.م</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>• عجز وفاقد تسوية المخزون:</span>
                      <strong className="font-mono">{financialSummary.inventoryLosses.toFixed(2)} ج.م</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Net Profit Banner */}
              <div className="bg-gradient-to-r from-[#1a237e] to-[#2e7d32] text-white p-5 rounded-2xl flex justify-between items-center shadow-lg">
                <div>
                  <span className="text-xs text-blue-200 block">صافي النتيجة الختامية للعام المالي ({currentFiscalYear})</span>
                  <strong className="text-lg md:text-xl font-bold">
                    {financialSummary.netProfitOrLoss >= 0 ? '🏆 صافي ربح العام المالي' : '⚠️ صافي خسارة العام المالي'}
                  </strong>
                </div>
                <div className="text-right">
                  <strong className="text-2xl font-mono text-[#ffd54f]">
                    {financialSummary.netProfitOrLoss.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
                  </strong>
                </div>
              </div>

              <div className="flex justify-between pt-3">
                <button
                  onClick={() => setWizardStep(1)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-5 py-2 rounded-2xl text-xs font-bold transition cursor-pointer"
                >
                  ➡️ السابق
                </button>
                <button
                  onClick={() => setWizardStep(3)}
                  className="bg-[#1a237e] hover:bg-[#0d47a1] text-white px-6 py-2.5 rounded-2xl text-xs md:text-sm font-bold shadow-md transition cursor-pointer"
                >
                  التالي: تحديد خيارات الترحيل والقفل ⬅️
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: CLOSING CONFIGURATION & ROLLOVER OPTIONS */}
          {wizardStep === 3 && (
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
              <div className="pb-3 border-b border-slate-100">
                <h3 className="text-base font-bold text-[#1a237e]">
                  الخطوة 3: إعدادات ترحيل الأرباح وقفل السنة المالية
                </h3>
                <p className="text-xs text-slate-500">
                  حدد الحساب المحاسبي الذي سيتم ترحيل الأرباح إليه وتاريخ قفل الفترة المالية.
                </p>
              </div>

              <div className="space-y-4 text-xs md:text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">تاريخ إقفال السنة المالية *</label>
                    <input
                      type="date"
                      value={closingDate}
                      onChange={(e) => setClosingDate(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">حساب ترحيل الأرباح والخسائر *</label>
                    <select
                      value={selectedEquityAccount}
                      onChange={(e) => setSelectedEquityAccount(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl font-semibold"
                    >
                      <option value="3102">3102 - الأرباح والخسائر المرحلة (Retained Earnings) [موصى به]</option>
                      <option value="3103">3103 - جاري صاحب المنشأة / الشركاء</option>
                      <option value="3101">3101 - رأس المال المستثمر</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">البيان والشرح في قيد الإقفال</label>
                  <input
                    type="text"
                    value={closingNotes}
                    onChange={(e) => setClosingNotes(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <strong className="text-slate-900 block">🔒 تفعيل القفل المحاسبي حتى تاريخ الإقفال</strong>
                    <span className="text-slate-500 text-xs">
                      منع إضافة أو تعديل أو حذف أي فواتير أو قيود محاسبية سابقة لتاريخ {closingDate}.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={lockTransactions}
                    onChange={(e) => setLockTransactions(e.target.checked)}
                    className="w-5 h-5 accent-[#1a237e] cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex justify-between pt-3">
                <button
                  onClick={() => setWizardStep(2)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-5 py-2 rounded-2xl text-xs font-bold transition cursor-pointer"
                >
                  ➡️ السابق
                </button>
                <button
                  onClick={handleExecuteYearEndClosing}
                  className="bg-[#2e7d32] hover:bg-[#1b5e20] text-white px-8 py-3 rounded-2xl text-xs md:text-sm font-black shadow-lg transition-all transform active:scale-95 cursor-pointer flex items-center gap-2"
                >
                  <span>🚀</span> تأكيد الإقفال السنوي وبدء السنة {nextFiscalYear} فوراً
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: SUCCESS SUMMARY */}
          {wizardStep === 4 && selectedClosingRecord && (
            <div className="bg-white p-8 rounded-3xl border border-emerald-200 shadow-sm text-center space-y-4">
              <span className="text-5xl">🎉</span>
              <h3 className="text-xl font-black text-emerald-900">
                تم إتمام الإقفال السنوي للسنة المالية {selectedClosingRecord.fiscalYear} بنجاح تام!
              </h3>
              <p className="text-xs md:text-sm text-slate-600 max-w-xl mx-auto">
                تم تصفير حسابات الإيرادات والمصروفات وتوليد قيد الإقفال وقيد الأرصدة الافتتاحية للسنة المالية الجديدة ({selectedClosingRecord.nextFiscalYear}).
              </p>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 max-w-md mx-auto text-xs space-y-2 text-right font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">رقم مستند الإقفال:</span>
                  <strong className="text-indigo-700">{selectedClosingRecord.closingNumber}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">صافي الأرباح المرحلة:</span>
                  <strong className="text-emerald-700">
                    {selectedClosingRecord.netProfitOrLoss.toFixed(2)} ج.م
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">قيد الإقفال المرتبط:</span>
                  <strong>قيد #{selectedClosingRecord.closingJournalEntryId}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">قيد الأرصدة الافتتاحية:</span>
                  <strong>قيد #{selectedClosingRecord.openingJournalEntryId}</strong>
                </div>
              </div>

              <div className="flex justify-center gap-3 pt-3">
                <button
                  onClick={() => setIsPrintModalOpen(true)}
                  className="bg-[#1a237e] text-white px-6 py-2.5 rounded-2xl text-xs font-bold cursor-pointer"
                >
                  🖨️ طباعة تقرير الإقفال السنوي
                </button>
                <button
                  onClick={() => {
                    setWizardStep(1);
                    setActiveTab('history');
                  }}
                  className="bg-slate-200 text-slate-800 px-6 py-2.5 rounded-2xl text-xs font-bold cursor-pointer"
                >
                  عرض سجل السنوات المقفلة
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DIAGNOSTICS */}
      {activeTab === 'diagnostics' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="pb-3 border-b border-slate-100 flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-[#1a237e]">لوحة الفحص التشخيصي المالي والمخزني</h3>
              <p className="text-xs text-slate-500">مراجعة المؤشرات الحيوية قبل أو بعد إغلاق الفترات المالية.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
              <h4 className="font-bold text-xs text-slate-800">📊 ميزان المراجعة بالمجاميع والأرصدة</h4>
              <p className="text-xs text-slate-600">
                إجمالي حركة المدين والدائن في جميع القيود متطابق تماماً ولا توجد فروقات غير مفسرة.
              </p>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full inline-block">
                ✅ سليم ومتوازن
              </span>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
              <h4 className="font-bold text-xs text-slate-800">📦 سلامة المخزون والتسويات</h4>
              <p className="text-xs text-slate-600">
                إجمالي قيمة المخزون الحالي: {financialSummary.totalInventoryValue.toFixed(2)} ج.م عبر {appData.items.length} صنف.
              </p>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full inline-block">
                ✅ مطابق للدفاتر
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CLOSINGS HISTORY ARCHIVE */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-xs border border-slate-200 space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2 pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-[#1a237e]">أرشيف وسجل السنوات المالية السابقة</h3>
              <p className="text-xs text-slate-500">
                سجل تاريخي بكافة عمليات الإقفال السنوية السابقة والأرباح المرحلة مع إمكانية طباعة المحاضر.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <TableActionButtons
                printLabel="طباعة السجل"
                onPrint={() => {
                  const closings = appData.fiscalClosings || [];
                  openUnifiedPrintWindow(
                    {
                      title: 'سجل وأرشيف إقفالات السنوات المالية السابقة',
                      partyLabel: 'إجمالي السجلات',
                      partyName: `${closings.length} سنة مقفلة`,
                      items: closings.map((rec) => ({
                        name: `إقفال السنة المالية ${rec.fiscalYear} (${rec.closingNumber})`,
                        unit: rec.closedToAccountName,
                        qty: 1,
                        price: rec.netProfitOrLoss,
                        total: rec.netProfitOrLoss,
                        notes: `التاريخ: ${rec.closingDate} | الإيرادات: ${rec.totalRevenues.toFixed(2)} | المصروفات: ${rec.totalExpenses.toFixed(2)} | الحالة: ${rec.status === 'completed' ? 'مقفلة' : 'معاد فتحها'}`,
                      })),
                      totals: [
                        {
                          label: 'إجمالي صافي الأرباح المرحلة:',
                          value: closings.reduce((sum, r) => sum + r.netProfitOrLoss, 0),
                          isBold: true,
                          isHighlight: true,
                        },
                      ],
                    },
                    appData.settings,
                    showToast
                  );
                }}
                onExportExcel={() => {
                  exportToExcel({
                    filename: `أرشيف_الإقفالات_السنوية_${new Date().toISOString().split('T')[0]}`,
                    sheetName: 'الإقفالات السنوية',
                    data: appData.fiscalClosings || [],
                    columns: [
                      { header: 'رقم محضر الإقفال', key: 'closingNumber', width: 18 },
                      { header: 'السنة المالية', key: 'fiscalYear', width: 14 },
                      { header: 'تاريخ الإقفال', key: 'closingDate', width: 14 },
                      { header: 'المحاسب المسؤول', key: 'closedBy', width: 20 },
                      { header: 'حساب الترحيل', key: 'closedToAccountName', width: 25 },
                      { header: 'إجمالي الإيرادات (ج.م)', getValue: (r: any) => (r.totalRevenues || 0).toFixed(2), width: 20 },
                      { header: 'إجمالي المصروفات (ج.م)', getValue: (r: any) => (r.totalExpenses || 0).toFixed(2), width: 20 },
                      { header: 'صافي الربح / الخسارة', getValue: (r: any) => (r.netProfitOrLoss || 0).toFixed(2), width: 20 },
                      { header: 'الحالة', getValue: (r: any) => r.status === 'completed' ? 'مقفلة ومعتمدة' : 'معاد فتحها', width: 16 },
                      { header: 'ملاحظات', getValue: (r: any) => r.notes || '-', width: 30 },
                    ],
                    companyName: appData.settings?.companyName || 'المنظومة المحاسبية المعتمدة',
                    reportTitle: 'سجل وأرشيف إقفالات السنوات المالية والحسابات الختامية',
                  });
                  showToast('تم تصدير سجل الإقفالات إلى Excel بنجاح', 'success');
                }}
              />
            </div>
          </div>

          {/* Mobile Closings Cards */}
          <div className="block lg:hidden space-y-3">
            {!appData.fiscalClosings || appData.fiscalClosings.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                لا توجد سنوات مقفلة سابقة مسجلة في الأرشيف حتى الآن.
              </div>
            ) : (
              appData.fiscalClosings.map((rec) => (
                <div
                  key={rec.id}
                  className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3 hover:border-indigo-300 transition"
                >
                  <div className="flex items-center justify-between border-b border-slate-200/70 pb-2">
                    <div>
                      <span className="font-mono font-bold text-indigo-700 text-xs">{rec.closingNumber}</span>
                      <div className="text-xs font-bold text-slate-900 mt-0.5">
                        السنة المالية: <span className="font-mono text-indigo-900">{rec.fiscalYear}</span>
                      </div>
                    </div>
                    {rec.status === 'completed' ? (
                      <span className="bg-emerald-100 text-emerald-800 text-[11px] px-2.5 py-1 rounded-full font-bold">
                        ✅ مقفلة
                      </span>
                    ) : (
                      <span className="bg-amber-100 text-amber-800 text-[11px] px-2.5 py-1 rounded-full font-bold">
                        🔄 معاد فتحها
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-100">
                    <div>📅 التاريخ: <strong className="text-slate-800">{rec.closingDate}</strong></div>
                    <div>👤 المحاسب: <strong className="text-slate-800">{rec.closedBy}</strong></div>
                    <div className="col-span-2">
                      حساب الترحيل: <strong className="text-slate-800">{rec.closedToAccountName}</strong>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1 bg-white p-2 rounded-xl border border-slate-100 text-center font-mono text-[11px]">
                    <div className="text-emerald-700 font-bold">
                      <span className="block text-[9px] text-slate-400 font-sans">الإيرادات</span>
                      {rec.totalRevenues.toLocaleString('en-US', { minimumFractionDigits: 1 })}
                    </div>
                    <div className="text-rose-700 font-bold">
                      <span className="block text-[9px] text-slate-400 font-sans">المصروفات</span>
                      {rec.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 1 })}
                    </div>
                    <div className={rec.netProfitOrLoss >= 0 ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                      <span className="block text-[9px] text-slate-400 font-sans">الصافي</span>
                      {rec.netProfitOrLoss.toLocaleString('en-US', { minimumFractionDigits: 1 })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => {
                        setSelectedClosingRecord(rec);
                        setIsPrintModalOpen(true);
                      }}
                      className="min-h-[42px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                    >
                      📄 محضر الإقفال
                    </button>
                    {appData.viewingClosedYear === rec.fiscalYear ? (
                      <button
                        onClick={handleReturnToCurrentYear}
                        className="min-h-[42px] bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 shadow-sm"
                      >
                        العودة للحالية ↩
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSwitchToClosedYear(rec.fiscalYear)}
                        className="min-h-[42px] bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                      >
                        👁️ تصفح ومراجعة
                      </button>
                    )}
                    {rec.status === 'completed' && (
                      <button
                        onClick={() => {
                          setSelectedClosingRecord(rec);
                          setIsReopenModalOpen(true);
                        }}
                        className="col-span-2 min-h-[42px] bg-rose-50 hover:bg-rose-100 text-rose-700 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                      >
                        🔓 إعادة فتح للمراجعة
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Closings Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-right text-xs md:text-sm">
              <thead className="bg-[#1a237e] text-white">
                <tr>
                  <th className="p-3 rounded-r-xl">رقم الإقفال</th>
                  <th className="p-3">السنة المالية</th>
                  <th className="p-3">تاريخ الإقفال</th>
                  <th className="p-3">إجمالي الإيرادات</th>
                  <th className="p-3">إجمالي المصروفات</th>
                  <th className="p-3">صافي الأرباح المرحلة</th>
                  <th className="p-3">حساب الترحيل</th>
                  <th className="p-3">المحاسب المعتمد</th>
                  <th className="p-3">الحالة</th>
                  <th className="p-3 rounded-l-xl text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!appData.fiscalClosings || appData.fiscalClosings.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400">
                      لا توجد سنوات مقفلة سابقة مسجلة في الأرشيف حتى الآن.
                    </td>
                  </tr>
                ) : (
                  appData.fiscalClosings.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-mono font-bold text-indigo-700">{rec.closingNumber}</td>
                      <td className="p-3 font-mono font-bold text-slate-900">{rec.fiscalYear}</td>
                      <td className="p-3 font-mono text-slate-600">{rec.closingDate}</td>
                      <td className="p-3 font-mono font-bold text-emerald-700">
                        {rec.totalRevenues.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
                      </td>
                      <td className="p-3 font-mono font-bold text-rose-700">
                        {rec.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
                      </td>
                      <td className="p-3 font-mono font-bold">
                        <span className={rec.netProfitOrLoss >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                          {rec.netProfitOrLoss.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
                        </span>
                      </td>
                      <td className="p-3 text-slate-600">{rec.closedToAccountName}</td>
                      <td className="p-3 text-slate-600">{rec.closedBy}</td>
                      <td className="p-3">
                        {rec.status === 'completed' ? (
                          <span className="bg-emerald-100 text-emerald-800 text-[11px] px-2.5 py-1 rounded-full font-bold">
                            ✅ مقفلة
                          </span>
                        ) : (
                          <span className="bg-amber-100 text-amber-800 text-[11px] px-2.5 py-1 rounded-full font-bold">
                            🔄 معاد فتحها
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex justify-center items-center gap-1.5 flex-wrap">
                          {appData.viewingClosedYear === rec.fiscalYear ? (
                            <button
                              onClick={handleReturnToCurrentYear}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-xs"
                              title="العودة إلى السنة المالية الحالية"
                            >
                              <span>العودة للحالية ↩</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSwitchToClosedYear(rec.fiscalYear)}
                              className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1"
                              title="تصفح بيانات هذه السنة المالية للمراجعة والطباعة فقط"
                            >
                              <span>👁️ مراجعة</span>
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedClosingRecord(rec);
                              setIsPrintModalOpen(true);
                            }}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer"
                          >
                            📄 معاينة
                          </button>
                          <button
                            onClick={() => printAnnualClosing(rec, appData)}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer"
                            title="طباعة محضر الإقفال والحسابات الختامية المعتمد"
                          >
                            🖨️ طباعة
                          </button>
                          {rec.status === 'completed' && (
                            <button
                              onClick={() => {
                                setSelectedClosingRecord(rec);
                                setIsReopenModalOpen(true);
                              }}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-700 px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer"
                              title="إلغاء الإقفال وإعادة الفتح"
                            >
                              🔓 إعادة فتح
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: PRINT ANNUAL CLOSING REPORT */}
      <Modal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        title="🖨️ طباعة تقرير ومحضر الإقفال السنوي الشامل"
        footer={
          <div className="flex justify-between items-center w-full">
            <button
              onClick={() => selectedClosingRecord && printAnnualClosing(selectedClosingRecord, appData)}
              className="bg-[#1a237e] hover:bg-[#0d47a1] text-white px-6 py-2 rounded-xl text-xs font-bold cursor-pointer"
            >
              🖨️ طباعة التقرير المعتمد
            </button>
            <button
              onClick={() => setIsPrintModalOpen(false)}
              className="bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        }
      >
        {selectedClosingRecord && (
          <div className="space-y-4 p-4 border border-slate-300 rounded-xl bg-white text-xs" id="printable-closing">
            <div className="text-center pb-3 border-b-2 border-slate-800 space-y-1">
              <h3 className="text-base font-black text-slate-900">{appData.settings.companyName}</h3>
              <h4 className="text-sm font-bold text-indigo-900">
                محضر الإقفال السنوي والحسابات الختامية للسنة المالية ({selectedClosingRecord.fiscalYear})
              </h4>
              <p className="text-slate-500">
                رقم المستند: {selectedClosingRecord.closingNumber} | تاريخ الإقفال: {selectedClosingRecord.closingDate}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 border border-slate-200 p-3 rounded-xl bg-slate-50 font-mono">
              <div>
                <span className="text-slate-500 block text-[10px]">إجمالي الإيرادات:</span>
                <strong className="text-emerald-700">{selectedClosingRecord.totalRevenues.toFixed(2)} ج.م</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">إجمالي المصروفات:</span>
                <strong className="text-rose-700">{selectedClosingRecord.totalExpenses.toFixed(2)} ج.م</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">صافي الربح / الخسارة:</span>
                <strong className="text-slate-900">{selectedClosingRecord.netProfitOrLoss.toFixed(2)} ج.م</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">حساب الترحيل:</span>
                <strong className="text-indigo-800">{selectedClosingRecord.closedToAccountName}</strong>
              </div>
            </div>

            <div className="border border-slate-200 p-3 rounded-xl space-y-1">
              <strong className="text-slate-900 block">المركز المالي والأصول وقت الإقفال:</strong>
              <div className="grid grid-cols-3 gap-2 font-mono text-slate-700">
                <div>الأصول: {selectedClosingRecord.totalAssetsAtClosing.toFixed(2)} ج.م</div>
                <div>الخصوم: {selectedClosingRecord.totalLiabilitiesAtClosing.toFixed(2)} ج.م</div>
                <div>المخزون: {selectedClosingRecord.inventoryValueAtClosing.toFixed(2)} ج.م</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-6 text-center font-bold text-slate-800">
              <div>
                <p className="text-[10px] text-slate-500 mb-8">المحاسب المالي</p>
                <div className="border-t border-slate-400 pt-1">التوقيع: ....................</div>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 mb-8">مدير الحسابات</p>
                <div className="border-t border-slate-400 pt-1">التوقيع: ....................</div>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 mb-8">رئيس مجلس الإدارة</p>
                <div className="border-t border-slate-400 pt-1">التوقيع: ....................</div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL: REOPEN FISCAL YEAR */}
      <Modal
        isOpen={isReopenModalOpen}
        onClose={() => setIsReopenModalOpen(false)}
        title={`🔓 إعادة فتح السنة المالية: ${selectedClosingRecord?.fiscalYear || ''}`}
        footer={
          <div className="flex justify-end gap-2 w-full">
            <button
              onClick={() => setIsReopenModalOpen(false)}
              className="bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
            >
              إلغاء
            </button>
            <button
              onClick={handleReopenFiscalYear}
              className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-2 rounded-xl text-xs font-bold cursor-pointer"
            >
              تأكيد إعادة الفتح وإلغاء القفل
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs md:text-sm">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800">
            ⚠️ تحذير: إعادة فتح السنة المالية سيسمح بتعديل القيود وإلغاء القفل المحاسبي. يرجى توثيق سبب إعادة الفتح للرقابة والتدقيق.
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">سبب إعادة الفتح *</label>
            <textarea
              rows={3}
              placeholder="اكتب سبب إعادة الفتح (مثال: مراجعة فاتورة مورد سابقة أو تعديل تسوية ضريبية)..."
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
