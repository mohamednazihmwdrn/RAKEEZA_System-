import React, { useState } from 'react';
import { AppData, AccountNode, AccountType, CostCenter } from '../types';
import { Modal } from './Modal';
import { addAuditLog } from '../utils/storage';
import { printAccountsTreeWindow, printCostCentersWindow } from '../utils/printAccounts';
import { exportToExcel } from '../utils/excelExport';
import { printStatementWindow, StatementData } from '../utils/printStatement';

interface AccountsTreeViewProps {
  appData: AppData;
  onUpdateData: (newData: AppData) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export const AccountsTreeView: React.FC<AccountsTreeViewProps> = ({
  appData,
  onUpdateData,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<'tree' | 'costCenters' | 'statement'>('tree');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    '1': true,
    '11': true,
    '2': true,
    '21': true,
    '3': true,
    '4': true,
    '5': true,
  });

  // Modal State for Adding Account
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [editingAccountCode, setEditingAccountCode] = useState<string | null>(null);
  const [newAccCode, setNewAccCode] = useState('');
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState<AccountType>('asset');
  const [newAccParent, setNewAccParent] = useState('');
  const [newAccDesc, setNewAccDesc] = useState('');

  // Modal State for Cost Centers
  const [isAddCostCenterModalOpen, setIsAddCostCenterModalOpen] = useState(false);
  const [editingCostCenterId, setEditingCostCenterId] = useState<string | null>(null);
  const [ccCode, setCcCode] = useState('');
  const [ccName, setCcName] = useState('');
  const [ccManager, setCcManager] = useState('');

  // Account Ledger Statement Search
  const [selectedAccCode, setSelectedAccCode] = useState<string>('1101');
  const [statementStartDate, setStatementStartDate] = useState('');
  const [statementEndDate, setStatementEndDate] = useState('');

  const toggleNode = (code: string) => {
    setExpandedNodes((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  // Calculate live balances from Journal Entries
  const computeAccountBalance = (accountCode: string) => {
    let totalDebit = 0;
    let totalCredit = 0;

    (appData.journalEntries || []).forEach((entry) => {
      entry.lines.forEach((line) => {
        if (line.accountCode === accountCode || line.accountCode.startsWith(accountCode)) {
          totalDebit += line.debit || 0;
          totalCredit += line.credit || 0;
        }
      });
    });

    // Also include cash transactions & sales & purchases in balance
    if (accountCode === '1101') {
      totalDebit += appData.cashBox?.drawer || 0;
    } else if (accountCode === '1102') {
      totalDebit += appData.cashBox?.vodafone || 0;
    } else if (accountCode === '1103') {
      totalDebit += appData.cashBox?.instapay || 0;
    } else if (accountCode === '1104') {
      totalDebit += appData.cashBox?.bank || 0;
    } else if (accountCode === '1105') {
      totalDebit += appData.customers.reduce((sum, c) => sum + (c.balance > 0 ? c.balance : 0), 0);
    } else if (accountCode === '1106') {
      totalDebit += appData.items.reduce((sum, i) => sum + (i.quantity * i.purchasePrice), 0);
    } else if (accountCode === '2101') {
      totalCredit += appData.suppliers.reduce((sum, s) => sum + (s.balance > 0 ? s.balance : 0), 0);
    } else if (accountCode === '4101') {
      totalCredit += appData.salesInvoices.reduce((sum, inv) => sum + inv.total, 0);
    } else if (accountCode === '5101') {
      totalDebit += appData.salesInvoices.reduce((sum, inv) => {
        const cost = inv.items.reduce((iSum, item) => {
          const original = appData.items.find((i) => i.name === item.name);
          return iSum + ((original?.purchasePrice || item.price * 0.75) * item.qty);
        }, 0);
        return sum + cost;
      }, 0);
    }

    const acc = appData.accounts.find((a) => a.code === accountCode);
    const isDebitNature = acc?.type === 'asset' || acc?.type === 'expense';
    const balance = isDebitNature ? totalDebit - totalCredit : totalCredit - totalDebit;

    return { totalDebit, totalCredit, balance };
  };

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

  // Export Chart of Accounts to Excel
  const handleExportTreeExcel = () => {
    const columns = [
      { header: 'كود الحساب', key: 'code', width: 14 },
      { header: 'اسم الحساب المحاسبي', key: 'name', width: 28 },
      {
        header: 'النوع المحاسبي',
        getValue: (item: AccountNode) => getTypeNameAr(item.type),
        width: 18,
      },
      {
        header: 'الحساب الأب',
        getValue: (item: AccountNode) => item.parentCode || 'حساب رئيسي',
        width: 16,
      },
      {
        header: 'إجمالي المدين (ج.م)',
        getValue: (item: AccountNode) => computeAccountBalance(item.code).totalDebit.toFixed(2),
        width: 16,
      },
      {
        header: 'إجمالي الدائن (ج.م)',
        getValue: (item: AccountNode) => computeAccountBalance(item.code).totalCredit.toFixed(2),
        width: 16,
      },
      {
        header: 'الرصيد الصافي (ج.م)',
        getValue: (item: AccountNode) => computeAccountBalance(item.code).balance.toFixed(2),
        width: 18,
      },
    ];

    exportToExcel({
      filename: `دليل_الحسابات_الشجري_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'دليل الحسابات',
      data: appData.accounts,
      columns,
      companyName: appData.settings?.companyName || 'المنظومة المحاسبية المعتمدة',
      reportTitle: 'دليل الحسابات الشجري العام والأرصدة الحالية',
    });

    showToast('تم تصدير دليل الحسابات إلى ملف Excel بنجاح', 'success');
  };

  // Export Cost Centers to Excel
  const handleExportCostCentersExcel = () => {
    const columns = [
      { header: 'كود المركز', key: 'code', width: 14 },
      { header: 'اسم مركز التكلفة / المشروع', key: 'name', width: 28 },
      {
        header: 'المشرف المسؤول',
        getValue: (item: CostCenter) => item.manager || 'المدير العام',
        width: 20,
      },
      {
        header: 'إجمالي الحركات المدينة',
        getValue: (item: CostCenter) => {
          let debits = 0;
          (appData.journalEntries || []).forEach((e) => {
            e.lines.forEach((l) => {
              if (l.costCenter === item.name || l.costCenter === item.code) debits += l.debit || 0;
            });
          });
          return debits.toFixed(2);
        },
        width: 18,
      },
      {
        header: 'إجمالي الحركات الدائنة',
        getValue: (item: CostCenter) => {
          let credits = 0;
          (appData.journalEntries || []).forEach((e) => {
            e.lines.forEach((l) => {
              if (l.costCenter === item.name || l.costCenter === item.code) credits += l.credit || 0;
            });
          });
          return credits.toFixed(2);
        },
        width: 18,
      },
    ];

    exportToExcel({
      filename: `مراكز_التكلفة_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'مراكز التكلفة',
      data: appData.costCenters || [],
      columns,
      companyName: appData.settings?.companyName || 'المنظومة المحاسبية المعتمدة',
      reportTitle: 'تقرير مراكز التكلفة والمشاريع والأقسام',
    });

    showToast('تم تصدير مراكز التكلفة إلى Excel بنجاح', 'success');
  };

  // Export General Ledger Statement to Excel
  const handleExportLedgerExcel = () => {
    const acc = appData.accounts.find((a) => a.code === selectedAccCode) || appData.accounts[0];
    const txs = (appData.journalEntries || []).flatMap((entry) =>
      entry.lines
        .filter((l) => l.accountCode === selectedAccCode)
        .map((l) => ({
          date: entry.date,
          entryNumber: entry.entryNumber,
          description: l.note || entry.description,
          debit: l.debit || 0,
          credit: l.credit || 0,
          costCenter: l.costCenter || 'الرئيسي',
        }))
    );

    const columns = [
      { header: 'التاريخ', key: 'date', width: 14 },
      { header: 'رقم القيد / المرجع', key: 'entryNumber', width: 16 },
      { header: 'البيان والشرح', key: 'description', width: 30 },
      {
        header: 'مدين (Debit)',
        getValue: (item: any) => (item.debit > 0 ? item.debit.toFixed(2) : '-'),
        width: 14,
      },
      {
        header: 'دائن (Credit)',
        getValue: (item: any) => (item.credit > 0 ? item.credit.toFixed(2) : '-'),
        width: 14,
      },
      { header: 'مركز التكلفة', key: 'costCenter', width: 18 },
    ];

    exportToExcel({
      filename: `كشف_حساب_${acc.code}_${acc.name}`,
      sheetName: `كشف ${acc.code}`,
      data: txs,
      columns,
      companyName: appData.settings?.companyName || 'المنظومة المحاسبية المعتمدة',
      reportTitle: `كشف حساب أستاذ عام - [${acc.code}] ${acc.name}`,
    });

    showToast('تم تصدير كشف الحساب إلى Excel بنجاح', 'success');
  };

  // Print Ledger Statement
  const handlePrintLedgerStatement = () => {
    const acc = appData.accounts.find((a) => a.code === selectedAccCode) || appData.accounts[0];
    const txs = (appData.journalEntries || []).flatMap((entry) =>
      entry.lines
        .filter((l) => l.accountCode === selectedAccCode)
        .map((l) => ({
          date: entry.date,
          refNo: entry.entryNumber,
          description: l.note || entry.description,
          debit: l.debit || 0,
          credit: l.credit || 0,
        }))
    );

    const stData: StatementData = {
      company: {
        name: appData.settings?.companyName || 'المنظومة المحاسبية المعتمدة',
        address: appData.settings?.address || 'المركز الرئيسي',
        logoUrl: appData.settings?.logoUrl || appData.settings?.logo || '',
        phones: appData.settings?.phone1 ? [appData.settings.phone1] : ['01029190615'],
      },
      accountCode: acc.code,
      accountName: acc.name,
      accountType: getTypeNameAr(acc.type),
      dateFrom: statementStartDate || '2026-01-01',
      dateTo: statementEndDate || new Date().toISOString().split('T')[0],
      previousBalance: 0,
      transactions: txs,
    };

    printStatementWindow(stData);
  };

  const getAccountCalculatedBalance = (accountCode: string) => {
    let totalDebit = 0;
    let totalCredit = 0;

    (appData.journalEntries || []).forEach((entry) => {
      entry.lines.forEach((line) => {
        if (line.accountCode === accountCode) {
          totalDebit += line.debit || 0;
          totalCredit += line.credit || 0;
        }
      });
    });

    if (accountCode === '1101') {
      totalDebit += appData.cashBox?.drawer || 0;
    } else if (accountCode === '1102') {
      totalDebit += appData.cashBox?.vodafone || 0;
    } else if (accountCode === '1103') {
      totalDebit += appData.cashBox?.instapay || 0;
    } else if (accountCode === '1104') {
      totalDebit += appData.cashBox?.bank || 0;
    } else if (accountCode === '1105') {
      totalDebit += appData.customers.reduce((sum, c) => sum + (c.balance > 0 ? c.balance : 0), 0);
    } else if (accountCode === '1106') {
      totalDebit += appData.items.reduce((sum, i) => sum + (i.quantity * i.purchasePrice), 0);
    } else if (accountCode === '2101') {
      totalCredit += appData.suppliers.reduce((sum, s) => sum + (s.balance > 0 ? s.balance : 0), 0);
    } else if (accountCode === '4101') {
      totalCredit += appData.salesInvoices.reduce((sum, inv) => sum + inv.total, 0);
    } else if (accountCode === '5101') {
      totalDebit += appData.salesInvoices.reduce((sum, inv) => {
        const cost = inv.items.reduce((iSum, item) => {
          const original = appData.items.find((i) => i.name === item.name);
          return iSum + ((original?.purchasePrice || item.price * 0.75) * item.qty);
        }, 0);
        return sum + cost;
      }, 0);
    }

    const acc = appData.accounts.find((a) => a.code === accountCode);
    const isDebitNature = acc?.type === 'asset' || acc?.type === 'expense';
    const balance = isDebitNature ? totalDebit - totalCredit : totalCredit - totalDebit;

    return { totalDebit, totalCredit, balance };
  };

  const handleOpenEditAccount = (acc: AccountNode) => {
    setEditingAccountCode(acc.code);
    setNewAccCode(acc.code);
    setNewAccName(acc.name);
    setNewAccType(acc.type);
    setNewAccParent(acc.parentCode || '');
    setNewAccDesc(acc.description || '');
    setIsAddAccountModalOpen(true);
  };

  const handleDeleteAccount = (code: string) => {
    const target = appData.accounts.find((a) => a.code === code);
    if (!target) return;

    const hasChildren = appData.accounts.some((a) => a.parentCode === code);
    if (hasChildren) {
      showToast('لا يمكن حذف هذا الحساب لأنه حساب رئيسي يحتوي على حسابات فرعية تحته. يرجى حذف أو نقل الحسابات التابعة له أولاً.', 'error');
      return;
    }

    if (!confirm(`هل أنت متأكد من رغبتك في حذف الحساب: [${target.code}] ${target.name}؟`)) return;

    let updatedAccounts = appData.accounts.filter((a) => a.code !== code);
    let updatedData = { ...appData, accounts: updatedAccounts };
    updatedData = addAuditLog(
      updatedData,
      'delete',
      'دليل الحسابات',
      `تم حذف الحساب: ${target.code} - ${target.name}`
    );

    onUpdateData(updatedData);
    showToast(`تم حذف الحساب [${target.code}] بنجاح`, 'success');
  };

  const handleAddAccount = () => {
    if (!newAccCode.trim() || !newAccName.trim()) {
      showToast('يرجى كتابة كود الحساب واسم الحساب', 'warning');
      return;
    }

    if (editingAccountCode) {
      let updatedAccounts = appData.accounts.map((a) =>
        a.code === editingAccountCode
          ? {
              ...a,
              name: newAccName.trim(),
              type: newAccType,
              parentCode: newAccParent || undefined,
              description: newAccDesc.trim() || undefined,
            }
          : a
      );

      let updatedData = { ...appData, accounts: updatedAccounts };
      updatedData = addAuditLog(
        updatedData,
        'update',
        'دليل الحسابات',
        `تم تعديل بيانات الحساب: ${editingAccountCode} - ${newAccName.trim()}`
      );

      onUpdateData(updatedData);
      showToast('تم تعديل بيانات الحساب بنجاح', 'success');
      setIsAddAccountModalOpen(false);
      setEditingAccountCode(null);
      setNewAccCode('');
      setNewAccName('');
      setNewAccDesc('');
      return;
    }

    if (appData.accounts.some((a) => a.code === newAccCode.trim())) {
      showToast('كود الحساب موجود بالفعل! يرجى اختيار كود آخر', 'error');
      return;
    }

    const parent = appData.accounts.find((a) => a.code === newAccParent);
    const newAcc: AccountNode = {
      code: newAccCode.trim(),
      name: newAccName.trim(),
      type: newAccType,
      parentCode: newAccParent || undefined,
      isParent: false,
      debit: 0,
      credit: 0,
      balance: 0,
      description: newAccDesc.trim() || undefined,
    };

    let updatedAccounts = [...appData.accounts, newAcc];
    if (parent && !parent.isParent) {
      updatedAccounts = updatedAccounts.map((a) =>
        a.code === parent.code ? { ...a, isParent: true } : a
      );
    }

    let updatedData = { ...appData, accounts: updatedAccounts };
    updatedData = addAuditLog(
      updatedData,
      'create',
      'دليل الحسابات',
      `تم إنشاء حساب جديد: ${newAcc.code} - ${newAcc.name}`
    );

    onUpdateData(updatedData);
    showToast('تمت إضافة الحساب بنجاح إلى شجرة الحسابات', 'success');
    setIsAddAccountModalOpen(false);
    setNewAccCode('');
    setNewAccName('');
    setNewAccDesc('');
  };

  const handleOpenEditCostCenter = (cc: CostCenter) => {
    setEditingCostCenterId(cc.id);
    setCcCode(cc.code);
    setCcName(cc.name);
    setCcManager(cc.manager || '');
    setIsAddCostCenterModalOpen(true);
  };

  const handleDeleteCostCenter = (id: string) => {
    const target = (appData.costCenters || []).find((c) => c.id === id);
    if (!target) return;

    if (!confirm(`هل أنت متأكد من حذف مركز التكلفة: [${target.code}] ${target.name}؟`)) return;

    const updatedCCs = (appData.costCenters || []).filter((c) => c.id !== id);
    let updatedData = { ...appData, costCenters: updatedCCs };
    updatedData = addAuditLog(
      updatedData,
      'delete',
      'مراكز التكلفة',
      `تم حذف مركز التكلفة: ${target.code} - ${target.name}`
    );

    onUpdateData(updatedData);
    showToast(`تم حذف مركز التكلفة [${target.code}] بنجاح`, 'success');
  };

  const handleAddCostCenter = () => {
    if (!ccCode.trim() || !ccName.trim()) {
      showToast('يرجى إدخال كود واسم مركز التكلفة', 'warning');
      return;
    }

    if (editingCostCenterId) {
      const updatedCCs = (appData.costCenters || []).map((c) =>
        c.id === editingCostCenterId
          ? {
              ...c,
              code: ccCode.trim(),
              name: ccName.trim(),
              manager: ccManager.trim() || undefined,
            }
          : c
      );

      let updatedData = { ...appData, costCenters: updatedCCs };
      updatedData = addAuditLog(
        updatedData,
        'update',
        'مراكز التكلفة',
        `تم تعديل بيانات مركز التكلفة: ${ccCode.trim()} - ${ccName.trim()}`
      );

      onUpdateData(updatedData);
      showToast('تم تعديل مركز التكلفة بنجاح', 'success');
      setIsAddCostCenterModalOpen(false);
      setEditingCostCenterId(null);
      setCcCode('');
      setCcName('');
      setCcManager('');
      return;
    }

    const newCC: CostCenter = {
      id: `cc-${Date.now()}`,
      code: ccCode.trim(),
      name: ccName.trim(),
      manager: ccManager.trim() || undefined,
    };

    let updatedData = {
      ...appData,
      costCenters: [...(appData.costCenters || []), newCC],
    };
    updatedData = addAuditLog(
      updatedData,
      'create',
      'مراكز التكلفة',
      `تمت إضافة مركز تكلفة: ${newCC.code} - ${newCC.name}`
    );

    onUpdateData(updatedData);
    showToast('تم حفظ مركز التكلفة بنجاح', 'success');
    setIsAddCostCenterModalOpen(false);
    setCcCode('');
    setCcName('');
    setCcManager('');
  };

  // Helper for type color
  const getTypeBadge = (type: AccountType) => {
    switch (type) {
      case 'asset':
        return <span className="bg-emerald-100 text-emerald-800 text-[11px] px-2 py-0.5 rounded font-bold">أصول (Assets)</span>;
      case 'liability':
        return <span className="bg-rose-100 text-rose-800 text-[11px] px-2 py-0.5 rounded font-bold">خصوم (Liabilities)</span>;
      case 'equity':
        return <span className="bg-purple-100 text-purple-800 text-[11px] px-2 py-0.5 rounded font-bold">حقوق ملكية (Equity)</span>;
      case 'revenue':
        return <span className="bg-blue-100 text-blue-800 text-[11px] px-2 py-0.5 rounded font-bold">إيرادات (Revenues)</span>;
      case 'expense':
        return <span className="bg-amber-100 text-amber-800 text-[11px] px-2 py-0.5 rounded font-bold">مصروفات (Expenses)</span>;
      default:
        return null;
    }
  };

  // Recursive tree rendering - ultra responsive with mobile card layout
  const renderAccountNode = (node: AccountNode, level: number = 0) => {
    const children = appData.accounts.filter((a) => a.parentCode === node.code);
    const hasChildren = children.length > 0;
    const isExpanded = expandedNodes[node.code] ?? false;
    const stats = computeAccountBalance(node.code);

    return (
      <div key={node.code} className="flex flex-col w-full max-w-full">
        <div
          className={`p-2.5 sm:p-3 rounded-xl transition border mb-1.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 ${
            level === 0
              ? 'bg-slate-100 font-bold border-slate-300 text-slate-900 shadow-xs'
              : level === 1
              ? 'bg-slate-50 font-semibold border-slate-200 text-slate-800'
              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
          }`}
        >
          {/* Right Section: Node Toggle, Code, Name, Type */}
          <div className="flex items-center flex-wrap gap-2 flex-1 min-w-0">
            {hasChildren ? (
              <button
                type="button"
                onClick={() => toggleNode(node.code)}
                className="w-7 h-7 min-w-[28px] flex items-center justify-center rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition cursor-pointer"
                title={isExpanded ? 'طي التفرع' : 'توسيع التفرع'}
              >
                {isExpanded ? '▼' : '◀'}
              </button>
            ) : (
              <span className="w-7 text-center text-xs text-slate-400">📄</span>
            )}
            <span className="font-mono bg-[#1a237e]/10 text-[#1a237e] px-2 py-0.5 rounded text-xs font-black shrink-0">
              {node.code}
            </span>
            <span className="text-xs sm:text-sm font-bold text-slate-800 break-words flex-1 min-w-[120px]">
              {node.name}
            </span>
            <div className="shrink-0">
              {getTypeBadge(node.type)}
            </div>
          </div>

          {/* Left Section: Balance & Action Buttons */}
          <div className="flex items-center justify-between sm:justify-end gap-2.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 shrink-0">
            <div className="text-right sm:text-left font-mono">
              <span className="text-[11px] text-slate-500 ml-1">الرصيد:</span>
              <strong
                className={`text-xs sm:text-sm ${
                  stats.balance >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {stats.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
              </strong>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setSelectedAccCode(node.code);
                  setActiveTab('statement');
                }}
                className="min-h-[34px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap"
                title="عرض كشف حساب تفصيلي"
              >
                📊 <span className="hidden xs:inline">كشف حساب</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenEditAccount(node)}
                className="w-8 h-8 flex items-center justify-center bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                title="تعديل بيانات الحساب"
              >
                ✏️
              </button>

              <button
                type="button"
                onClick={() => handleDeleteAccount(node.code)}
                className="w-8 h-8 flex items-center justify-center bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                title="حذف الحساب"
              >
                🗑️
              </button>
            </div>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="flex flex-col border-r-2 border-indigo-200/60 pr-1.5 sm:pr-3 mr-1.5 sm:mr-3 my-1">
            {children.map((child) => renderAccountNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // Ledger lines for selected account
  const selectedAccount = appData.accounts.find((a) => a.code === selectedAccCode) || appData.accounts[0];
  const accountStats = computeAccountBalance(selectedAccount?.code || '1101');

  return (
    <div className="space-y-6">
      {/* Top Header and Navigation Tabs */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('tree')}
            className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'tree'
                ? 'bg-[#1a237e] text-white shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            🌳 شجرة دليل الحسابات
          </button>
          <button
            onClick={() => setActiveTab('costCenters')}
            className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'costCenters'
                ? 'bg-[#1a237e] text-white shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            🏢 مراكز التكلفة والمشاريع
          </button>
          <button
            onClick={() => setActiveTab('statement')}
            className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'statement'
                ? 'bg-[#1a237e] text-white shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            📑 كشف حساب الأستاذ العام
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {activeTab === 'tree' && (
            <button
              type="button"
              onClick={() => {
                setEditingAccountCode(null);
                setNewAccCode('');
                setNewAccName('');
                setNewAccDesc('');
                setIsAddAccountModalOpen(true);
              }}
              className="flex-1 sm:flex-initial min-h-[42px] bg-[#2e7d32] hover:bg-[#1b5e20] text-white px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition cursor-pointer flex items-center justify-center gap-1 shadow-sm whitespace-nowrap"
            >
              ➕ إضافة حساب شجري جديد
            </button>
          )}
          {activeTab === 'costCenters' && (
            <button
              type="button"
              onClick={() => {
                setEditingCostCenterId(null);
                setCcCode('');
                setCcName('');
                setCcManager('');
                setIsAddCostCenterModalOpen(true);
              }}
              className="flex-1 sm:flex-initial min-h-[42px] bg-[#0288d1] hover:bg-[#0277bd] text-white px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition cursor-pointer flex items-center justify-center gap-1 shadow-sm whitespace-nowrap"
            >
              ➕ إضافة مركز تكلفة
            </button>
          )}
        </div>
      </div>

      {/* Tab 1: Chart of Accounts Tree */}
      {activeTab === 'tree' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-wrap justify-between items-center pb-3 border-b border-slate-100 gap-3">
            <div>
              <h3 className="text-base md:text-lg font-bold text-[#1a237e]">
                دليل الحسابات الشجري العام (Chart of Accounts)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                هيكل محاسبي هرمي مزدوج يربط كل حركات المبيعات، المشتريات، الخزينة، والمخازن بالحسابات المعنية.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => printAccountsTreeWindow(appData.accounts, computeAccountBalance, appData.settings)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="معاينة وطباعة دليل الحسابات مع إمكانية اختيار المقاس A4 / A5 / حراري 80mm"
              >
                🖨️ طباعة الدليل
              </button>
              <button
                onClick={handleExportTreeExcel}
                className="bg-[#2e7d32] hover:bg-[#1b5e20] text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="تصدير شجرة الحسابات إلى ملف إكسيل (.xlsx)"
              >
                📊 تصدير Excel
              </button>
              <button
                onClick={() => {
                  const allOpen: Record<string, boolean> = {};
                  appData.accounts.forEach((a) => (allOpen[a.code] = true));
                  setExpandedNodes(allOpen);
                }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
              >
                توسيع الكل 🔽
              </button>
              <button
                onClick={() => setExpandedNodes({})}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
              >
                طي الكل 🔼
              </button>
            </div>
          </div>

          <div className="space-y-1">
            {appData.accounts
              .filter((a) => !a.parentCode)
              .map((rootNode) => renderAccountNode(rootNode, 0))}
          </div>
        </div>
      )}

      {/* Tab 2: Cost Centers */}
      {activeTab === 'costCenters' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-wrap justify-between items-center pb-3 border-b border-slate-100 gap-3">
            <div>
              <h3 className="text-base md:text-lg font-bold text-[#1a237e]">
                مراكز التكلفة والمشاريع والأقسام (Cost Centers)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                توزيع وتقسيم الإيرادات والمصروفات على فروع ومشاريع وأقسام مستقلة لمراقبة ربحية كل مركز بدقة.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => printCostCentersWindow(appData.costCenters || [], appData.journalEntries || [], appData.settings)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="معاينة وطباعة تقرير مراكز التكلفة مع خيارات المقاس A4 / A5 / حراري 80mm"
              >
                🖨️ طباعة المراكز
              </button>
              <button
                onClick={handleExportCostCentersExcel}
                className="bg-[#2e7d32] hover:bg-[#1b5e20] text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="تصدير مراكز التكلفة إلى ملف إكسيل (.xlsx)"
              >
                📊 تصدير Excel
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(appData.costCenters || []).map((cc) => (
              <div
                key={cc.id}
                className="bg-slate-50 hover:bg-slate-100/80 p-4 rounded-2xl border border-slate-200 transition space-y-2"
              >
                <div className="flex justify-between items-center">
                  <span className="font-mono bg-blue-100 text-blue-800 text-xs px-2.5 py-1 rounded-lg font-bold">
                    {cc.code}
                  </span>
                  <span className="text-xs text-slate-500">🏢 مركز نشط</span>
                </div>
                <h4 className="font-bold text-slate-900 text-base">{cc.name}</h4>
                <p className="text-xs text-slate-600">
                  المسؤول / المشرف: <strong>{cc.manager || 'المدير العام'}</strong>
                </p>
                <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                  <button
                    onClick={() => handleOpenEditCostCenter(cc)}
                    className="flex-1 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    ✏️ تعديل
                  </button>
                  <button
                    onClick={() => handleDeleteCostCenter(cc.id)}
                    className="flex-1 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    🗑️ حذف
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Account Ledger Statement */}
      {activeTab === 'statement' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
          <div className="flex flex-wrap justify-between items-center gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base md:text-lg font-bold text-[#1a237e]">
                كشف حساب أستاذ عام تفصيلي
              </h3>
              <p className="text-xs text-slate-500">
                استعراض سجل الحركات، الأرصدة، القيود المدينة والدائنة لأي حساب في الدليل.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedAccCode}
                onChange={(e) => setSelectedAccCode(e.target.value)}
                className="p-2 border border-slate-300 rounded-xl text-sm font-bold bg-slate-50 focus:ring-2 focus:ring-indigo-500"
              >
                {appData.accounts.map((acc) => (
                  <option key={acc.code} value={acc.code}>
                    [{acc.code}] {acc.name}
                  </option>
                ))}
              </select>

              <button
                onClick={handlePrintLedgerStatement}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="طباعة كشف الحساب مع المعاينة الرسمية والتخصيص"
              >
                🖨️ طباعة كشف الحساب
              </button>

              <button
                onClick={handleExportLedgerExcel}
                className="bg-[#2e7d32] hover:bg-[#1b5e20] text-white px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="تصدير كشف الحساب إلى ملف Excel (.xlsx)"
              >
                📊 تصدير Excel
              </button>
            </div>
          </div>

          {/* Account Summary Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="text-center">
              <span className="text-xs text-slate-500 block mb-1">إجمالي المدين (Debit)</span>
              <strong className="text-emerald-700 text-lg font-mono">
                {(accountStats?.totalDebit || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
              </strong>
            </div>
            <div className="text-center">
              <span className="text-xs text-slate-500 block mb-1">إجمالي الدائن (Credit)</span>
              <strong className="text-rose-700 text-lg font-mono">
                {(accountStats?.totalCredit || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
              </strong>
            </div>
            <div className="text-center">
              <span className="text-xs text-slate-500 block mb-1">الرصيد الصافي الحالي</span>
              <strong className="text-[#1a237e] text-xl font-mono font-black">
                {(accountStats?.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
              </strong>
            </div>
          </div>

          {/* Movement Cards for Mobile (< md) */}
          <div className="block md:hidden space-y-2.5">
            {((appData.journalEntries || []).flatMap((entry) =>
              entry.lines
                .filter((l) => l.accountCode === selectedAccCode)
                .map((line, idx) => ({ entry, line, idx }))
            ).length === 0) ? (
              <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl">
                لا توجد حركات مقيدة على هذا الحساب
              </div>
            ) : (
              (appData.journalEntries || []).flatMap((entry) =>
                entry.lines
                  .filter((l) => l.accountCode === selectedAccCode)
                  .map((line, idx) => (
                    <div key={`${entry.id}-${idx}`} className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-2">
                      <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-1.5">
                        <span className="font-bold text-indigo-900 font-mono">{entry.entryNumber}</span>
                        <span className="text-slate-500 font-mono">{entry.date}</span>
                        <span className="text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-600">
                          {line.costCenter || 'الرئيسي'}
                        </span>
                      </div>

                      <div className="text-slate-800 font-medium break-words">
                        {line.note || entry.description}
                      </div>

                      <div className="grid grid-cols-2 gap-2 bg-white p-2 rounded-lg border border-slate-200 text-center">
                        <div>
                          <span className="text-[10px] text-slate-400 block">مدين:</span>
                          <span className="font-mono font-bold text-emerald-700">
                            {line.debit > 0 ? `${line.debit.toFixed(2)} ج.م` : '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">دائن:</span>
                          <span className="font-mono font-bold text-rose-700">
                            {line.credit > 0 ? `${line.credit.toFixed(2)} ج.م` : '-'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
              )
            )}
          </div>

          {/* Desktop Movement Table (>= md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-right text-xs md:text-sm">
              <thead className="bg-[#1a237e] text-white">
                <tr>
                  <th className="p-3 rounded-r-lg">التاريخ</th>
                  <th className="p-3">رقم القيد / المرجع</th>
                  <th className="p-3">البيان والشرح</th>
                  <th className="p-3">مدين (Debit)</th>
                  <th className="p-3">دائن (Credit)</th>
                  <th className="p-3 rounded-l-lg">مركز التكلفة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(appData.journalEntries || []).flatMap((entry) =>
                  entry.lines
                    .filter((l) => l.accountCode === selectedAccCode)
                    .map((line, idx) => (
                      <tr key={`${entry.id}-${idx}`} className="hover:bg-slate-50">
                        <td className="p-3 font-mono">{entry.date}</td>
                        <td className="p-3 font-bold text-indigo-900">{entry.entryNumber}</td>
                        <td className="p-3">{line.note || entry.description}</td>
                        <td className="p-3 font-bold text-emerald-700 font-mono">
                          {line.debit > 0 ? line.debit.toFixed(2) : '-'}
                        </td>
                        <td className="p-3 font-bold text-rose-700 font-mono">
                          {line.credit > 0 ? line.credit.toFixed(2) : '-'}
                        </td>
                        <td className="p-3 text-slate-600">{line.costCenter || 'الرئيسي'}</td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Add/Edit Account */}
      <Modal
        isOpen={isAddAccountModalOpen}
        onClose={() => {
          setIsAddAccountModalOpen(false);
          setEditingAccountCode(null);
        }}
        title={editingAccountCode ? `✏️ تعديل بيانات الحساب [${editingAccountCode}]` : "➕ إضافة حساب جديد إلى شجرة الحسابات"}
        footer={
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setIsAddAccountModalOpen(false);
                setEditingAccountCode(null);
              }}
              className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              إلغاء
            </button>
            <button
              onClick={handleAddAccount}
              className="bg-[#2e7d32] hover:bg-[#1b5e20] text-white px-5 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              {editingAccountCode ? "تحديث الحساب" : "حفظ الحساب"}
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs md:text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">كود الحساب المحاسبي *</label>
              <input
                type="text"
                value={newAccCode}
                onChange={(e) => setNewAccCode(e.target.value)}
                disabled={!!editingAccountCode}
                placeholder="مثال: 1107"
                className={`w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono ${
                  editingAccountCode ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''
                }`}
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">اسم الحساب بالكامل *</label>
              <input
                type="text"
                value={newAccName}
                onChange={(e) => setNewAccName(e.target.value)}
                placeholder="مثال: حساب بنك قطر الوطني"
                className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">نوع الحساب الرئيسي</label>
              <select
                value={newAccType}
                onChange={(e) => setNewAccType(e.target.value as AccountType)}
                className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold"
              >
                <option value="asset">1 - أصول (Assets)</option>
                <option value="liability">2 - خصوم (Liabilities)</option>
                <option value="equity">3 - حقوق ملكية (Equity)</option>
                <option value="revenue">4 - إيرادات (Revenue)</option>
                <option value="expense">5 - مصروفات (Expense)</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">الحساب الأب المتفرع منه</label>
              <select
                value={newAccParent}
                onChange={(e) => setNewAccParent(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-semibold"
              >
                <option value="">-- بدون حساب أب (حساب رئيسي) --</option>
                {appData.accounts.map((acc) => (
                  <option key={acc.code} value={acc.code}>
                    [{acc.code}] {acc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">وصف أو ملاحظات</label>
            <input
              type="text"
              value={newAccDesc}
              onChange={(e) => setNewAccDesc(e.target.value)}
              placeholder="وصف طبيعة الحساب واستخدامه..."
              className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </Modal>

      {/* Modal: Add/Edit Cost Center */}
      <Modal
        isOpen={isAddCostCenterModalOpen}
        onClose={() => {
          setIsAddCostCenterModalOpen(false);
          setEditingCostCenterId(null);
        }}
        title={editingCostCenterId ? "✏️ تعديل بيانات مركز التكلفة" : "➕ إضافة مركز تكلفة جديد"}
        footer={
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setIsAddCostCenterModalOpen(false);
                setEditingCostCenterId(null);
              }}
              className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              إلغاء
            </button>
            <button
              onClick={handleAddCostCenter}
              className="bg-[#0288d1] hover:bg-[#0277bd] text-white px-5 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              {editingCostCenterId ? "تحديث المركز" : "حفظ المركز"}
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs md:text-sm">
          <div>
            <label className="block font-bold text-slate-700 mb-1">كود مركز التكلفة *</label>
            <input
              type="text"
              value={ccCode}
              onChange={(e) => setCcCode(e.target.value)}
              placeholder="مثال: CC-04"
              className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">اسم مركز التكلفة أو المشروع *</label>
            <input
              type="text"
              value={ccName}
              onChange={(e) => setCcName(e.target.value)}
              placeholder="مثال: مشروع فرع المعادي الجديد"
              className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">المشرف / المدير المسؤول</label>
            <input
              type="text"
              value={ccManager}
              onChange={(e) => setCcManager(e.target.value)}
              placeholder="مثال: م. طارق سامي"
              className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
