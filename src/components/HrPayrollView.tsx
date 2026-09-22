import React, { useState } from 'react';
import { AppData, Employee, PayrollSlip, EmployeeAdvance, JournalEntry } from '../types';
import { addAuditLog } from '../utils/storage';
import { openUnifiedPrintWindow } from '../utils/printUnified';
import { exportToExcel } from '../utils/excelExport';
import { TableActionButtons } from './TableActionButtons';

interface HrPayrollViewProps {
  appData: AppData;
  onUpdateData: (newData: AppData) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onInspectItem?: (type: any, data: any) => void;
}

export const HrPayrollView: React.FC<HrPayrollViewProps> = ({
  appData,
  onUpdateData,
  showToast,
  onInspectItem,
}) => {
  const [activeTab, setActiveTab] = useState<'payroll' | 'employees' | 'advances'>('payroll');
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().substring(0, 7)); // YYYY-MM
  const currency = appData.settings?.currencySymbol || 'ج.م';

  // Employee Form State
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
  const [empName, setEmpName] = useState('');
  const [empPhone, setEmpPhone] = useState('');
  const [empNationalId, setEmpNationalId] = useState('');
  const [empDepartment, setEmpDepartment] = useState('المبيعات والتسويق');
  const [empJobTitle, setEmpJobTitle] = useState('');
  const [empBasicSalary, setEmpBasicSalary] = useState<number>(5000);
  const [empHousing, setEmpHousing] = useState<number>(0);
  const [empTransport, setEmpTransport] = useState<number>(0);
  const [empInsurance, setEmpInsurance] = useState<number>(0);
  const [empTax, setEmpTax] = useState<number>(0);

  // Advance Modal State
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [advEmpId, setAdvEmpId] = useState('');
  const [advAmount, setAdvAmount] = useState<number>(2000);
  const [advInstallments, setAdvInstallments] = useState<number>(2);
  const [advNotes, setAdvNotes] = useState('');

  const employees = appData.employees || [];
  const payrollSlips = appData.payrollSlips || [];
  const advances = appData.employeeAdvances || [];

  // Filter slips for active selected month
  const currentMonthSlips = payrollSlips.filter((p) => p.month === selectedMonth);

  // 1-Click Automated Payroll Generation for the month
  const handleGenerateMonthlyPayroll = () => {
    if (employees.length === 0) {
      showToast('لا يوجد موظفين مسجلين لإنشاء المسير', 'warning');
      return;
    }

    let nextId = appData.nextPayrollId || 1;
    const newSlips: PayrollSlip[] = [];

    employees.forEach((emp) => {
      // Check if slip already exists for this employee in selected month
      const existing = payrollSlips.find((p) => p.month === selectedMonth && p.employeeId === emp.id);
      if (!existing && emp.status === 'active') {
        const empAdvance = advances.find((a) => a.employeeId === emp.id && a.status === 'active');
        const advanceDeduction = empAdvance ? Math.min(empAdvance.remainingAmount, empAdvance.monthlyDeduction) : 0;
        const totalAllowances = emp.housingAllowance + emp.transportAllowance + emp.otherAllowances;
        const gross = emp.basicSalary + totalAllowances;
        const totalDeductions = emp.insuranceDeduction + emp.taxDeduction;
        const net = Math.max(0, gross - totalDeductions - advanceDeduction);

        newSlips.push({
          id: nextId,
          slipNumber: `PAY-${selectedMonth.replace('-', '')}-${String(nextId).padStart(3, '0')}`,
          month: selectedMonth,
          employeeId: emp.id,
          employeeName: emp.name,
          department: emp.department,
          basicSalary: emp.basicSalary,
          allowances: totalAllowances,
          bonuses: 0,
          overtime: 0,
          grossSalary: gross,
          deductions: totalDeductions,
          advancesDeducted: advanceDeduction,
          netSalary: net,
          status: 'draft',
          notes: `مسير راتب شهر ${selectedMonth}`,
          createdBy: appData.users.find((u) => u.id === appData.currentUser)?.name || 'المدير',
          createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
        });
        nextId++;
      }
    });

    if (newSlips.length === 0) {
      showToast(`تم إنشاء مسير شهر ${selectedMonth} بالكامل مسبقاً لجميع الموظفين`, 'info');
      return;
    }

    let updated = {
      ...appData,
      payrollSlips: [...newSlips, ...appData.payrollSlips],
      nextPayrollId: nextId,
    };
    updated = addAuditLog(updated, 'create', 'الموارد البشرية', `تم توليد مسير رواتب شهر ${selectedMonth} لعدد ${newSlips.length} موظف.`);
    onUpdateData(updated);
    showToast(`تم توليد مسير رواتب لعدد ${newSlips.length} موظف بنجاح`, 'success');
  };

  // Approve and Post Payroll into Accounting Journal
  const handleApprovePayroll = (slip: PayrollSlip) => {
    if (slip.status === 'paid') return;

    let updated = { ...appData };
    const nextJournalId = updated.nextJournalId || 1;

    // Create dual-entry journal entry:
    // Debit: 5202 الرواتب والأجور والمكافآت (Gross)
    // Credit: 1101 الخزينة (Net)
    // Credit: 2104 مستحقات/استقطاعات
    const journalEntry: JournalEntry = {
      id: nextJournalId,
      entryNumber: `JV-${new Date().getFullYear()}-${String(nextJournalId).padStart(4, '0')}`,
      date: new Date().toISOString().substring(0, 10),
      description: `صرف راتب الموظف ${slip.employeeName} لشهر ${slip.month}`,
      source: 'cash',
      createdBy: appData.users.find((u) => u.id === appData.currentUser)?.name || 'المدير',
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      isApproved: true,
      lines: [
        {
          accountCode: '5202',
          accountName: 'الرواتب والأجور والمكافآت',
          debit: slip.grossSalary,
          credit: 0,
          note: `راتب إجمالي - ${slip.employeeName}`,
        },
        {
          accountCode: '1101',
          accountName: 'الصندوق والخزينة الرئيسية',
          debit: 0,
          credit: slip.netSalary,
          note: `صافي الراتب المسدد نقداً`,
        },
        ...(slip.deductions + slip.advancesDeducted > 0
          ? [
              {
                accountCode: '2104',
                accountName: 'مصروفات مستحقة واستقطاعات',
                debit: 0,
                credit: slip.deductions + slip.advancesDeducted,
                note: `استقطاعات تأمينات وسلف`,
              },
            ]
          : []),
      ],
    };

    // Deduct from Drawer cash box
    updated.cashBox = {
      ...updated.cashBox,
      drawer: Math.max(0, updated.cashBox.drawer - slip.netSalary),
    };

    // Update advance if any
    if (slip.advancesDeducted > 0) {
      updated.employeeAdvances = updated.employeeAdvances.map((adv) => {
        if (adv.employeeId === slip.employeeId && adv.status === 'active') {
          const newRemaining = Math.max(0, adv.remainingAmount - slip.advancesDeducted);
          return {
            ...adv,
            paidAmount: adv.paidAmount + slip.advancesDeducted,
            remainingAmount: newRemaining,
            status: newRemaining === 0 ? 'completed' : 'active',
          };
        }
        return adv;
      });
    }

    // Update slip status
    updated.payrollSlips = updated.payrollSlips.map((p) =>
      p.id === slip.id
        ? { ...p, status: 'paid', paymentDate: new Date().toISOString().substring(0, 10), journalEntryId: nextJournalId }
        : p
    );

    updated.journalEntries = [journalEntry, ...updated.journalEntries];
    updated.nextJournalId = nextJournalId + 1;
    updated = addAuditLog(updated, 'approval', 'الرواتب والأجور', `تم اعتماد وصرف راتب الموظف ${slip.employeeName} بقيمة ${slip.netSalary} ${currency} وتوليد القيد المحاسبي.`);

    onUpdateData(updated);
    showToast(`تم صرف الراتب وتوليد القيد المحاسبي #${journalEntry.entryNumber} بنجاح`, 'success');
  };

  // Save Employee
  const handleSaveEmployee = () => {
    if (!empName.trim()) {
      showToast('يرجى إدخال اسم الموظف', 'warning');
      return;
    }

    let updated = { ...appData };
    if (editingEmpId) {
      updated.employees = updated.employees.map((e) =>
        e.id === editingEmpId
          ? {
              ...e,
              name: empName,
              phone: empPhone,
              nationalId: empNationalId,
              department: empDepartment,
              jobTitle: empJobTitle,
              basicSalary: Number(empBasicSalary),
              housingAllowance: Number(empHousing),
              transportAllowance: Number(empTransport),
              insuranceDeduction: Number(empInsurance),
              taxDeduction: Number(empTax),
            }
          : e
      );
      showToast('تم تحديث بيانات الموظف بنجاح', 'success');
    } else {
      const newEmp: Employee = {
        id: `emp-${Date.now()}`,
        code: `EMP-${String(employees.length + 1).padStart(3, '0')}`,
        name: empName,
        phone: empPhone,
        nationalId: empNationalId,
        department: empDepartment,
        jobTitle: empJobTitle,
        basicSalary: Number(empBasicSalary),
        housingAllowance: Number(empHousing),
        transportAllowance: Number(empTransport),
        otherAllowances: 0,
        insuranceDeduction: Number(empInsurance),
        taxDeduction: Number(empTax),
        hireDate: new Date().toISOString().substring(0, 10),
        status: 'active',
      };
      updated.employees = [newEmp, ...updated.employees];
      showToast('تم إضافة الموظف الجديد بنجاح', 'success');
    }

    onUpdateData(updated);
    setIsEmployeeModalOpen(false);
  };

  // Save Advance
  const handleSaveAdvance = () => {
    const emp = employees.find((e) => e.id === advEmpId);
    if (!emp) {
      showToast('يرجى اختيار الموظف', 'warning');
      return;
    }

    const monthly = Math.ceil(advAmount / (advInstallments || 1));
    const newAdv: EmployeeAdvance = {
      id: `adv-${Date.now()}`,
      employeeId: emp.id,
      employeeName: emp.name,
      date: new Date().toISOString().substring(0, 10),
      totalAmount: advAmount,
      monthlyDeduction: monthly,
      paidAmount: 0,
      remainingAmount: advAmount,
      installmentsCount: advInstallments,
      notes: advNotes,
      status: 'active',
    };

    let updated = {
      ...appData,
      employeeAdvances: [newAdv, ...appData.employeeAdvances],
      // Deduct from cashbox
      cashBox: {
        ...appData.cashBox,
        drawer: Math.max(0, appData.cashBox.drawer - advAmount),
      },
    };
    updated = addAuditLog(updated, 'create', 'الموارد البشرية', `تم صرف سلفة للموظف ${emp.name} بقيمة ${advAmount} ${currency}.`);
    onUpdateData(updated);
    showToast(`تم تسجيل وصرف السلفة للموظف ${emp.name} بنجاح`, 'success');
    setIsAdvanceModalOpen(false);
  };

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      {/* Top Header & Sub-nav */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap justify-between items-center gap-4">
        <div>
          <h3 className="text-lg font-black text-[#1a237e] flex items-center gap-2">
            <span>👥 وحدة إدارة الموارد البشرية والرواتب (HR & Payroll)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            إدارة مسيرات الأجور الشهرية، السلف والقروض، احتساب الاستقطاعات، والترحيل المحاسبي التلقائي.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('payroll')}
              className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 sm:py-1.5 rounded-lg transition cursor-pointer text-center whitespace-nowrap ${
                activeTab === 'payroll' ? 'bg-[#1a237e] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              💵 مسير الرواتب
            </button>
            <button
              onClick={() => setActiveTab('employees')}
              className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 sm:py-1.5 rounded-lg transition cursor-pointer text-center whitespace-nowrap ${
                activeTab === 'employees' ? 'bg-[#1a237e] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              👤 سجل الموظفين ({employees.length})
            </button>
            <button
              onClick={() => setActiveTab('advances')}
              className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 sm:py-1.5 rounded-lg transition cursor-pointer text-center whitespace-nowrap ${
                activeTab === 'advances' ? 'bg-[#1a237e] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              💳 السلف ({advances.length})
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: PAYROLL SLIPS */}
      {activeTab === 'payroll' && (
        <div className="space-y-4">
          {/* Action Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-700">الشهر المالي:</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="p-2 border border-slate-300 rounded-xl text-xs font-bold bg-slate-50"
              />
              <span className="text-xs text-slate-500 font-semibold">
                (عدد القسائم: {currentMonthSlips.length})
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleGenerateMonthlyPayroll}
                className="flex-1 sm:flex-initial min-h-[42px] bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs whitespace-nowrap"
              >
                <span>⚡ إنشاء مسير الشهر آلياً بنقرة واحدة</span>
              </button>
              <TableActionButtons
                onPrint={() => {
                  openUnifiedPrintWindow(
                    {
                      title: `كشف مسير الرواتب الإجمالي لشهر ${selectedMonth}`,
                      partyLabel: 'إجمالي العاملين',
                      partyName: `${currentMonthSlips.length} موظف`,
                      items: currentMonthSlips.map((s) => ({
                        name: `${s.employeeName} (${s.department})`,
                        qty: 1,
                        price: s.basicSalary,
                        discount: s.deductions + s.advancesDeducted,
                        total: s.netSalary,
                        notes: `الحالة: ${s.status === 'paid' ? 'تم الصرف' : 'معلق'}`,
                      })),
                      totals: [
                        {
                          label: 'إجمالي الرواتب الصافية:',
                          value: currentMonthSlips.reduce((acc, c) => acc + c.netSalary, 0),
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
                    filename: `مسير_رواتب_${selectedMonth}_${new Date().toISOString().split('T')[0]}`,
                    sheetName: `مسير رواتب ${selectedMonth}`,
                    data: currentMonthSlips,
                    columns: [
                      { header: 'رقم القسيمة', key: 'slipNumber', width: 14 },
                      { header: 'اسم الموظف', key: 'employeeName', width: 25 },
                      { header: 'القسم / الإدارة', key: 'department', width: 18 },
                      { header: 'الراتب الأساسي (ج.م)', getValue: (s) => s.basicSalary.toFixed(2), width: 18 },
                      { header: 'إجمالي البدلات (ج.م)', getValue: (s) => s.allowances.toFixed(2), width: 18 },
                      { header: 'الاستقطاعات والخصومات', getValue: (s) => s.deductions.toFixed(2), width: 18 },
                      { header: 'استقطاع السلفة', getValue: (s) => s.advancesDeducted.toFixed(2), width: 16 },
                      { header: 'صافي الراتب المستحق (ج.م)', getValue: (s) => s.netSalary.toFixed(2), width: 22 },
                      {
                        header: 'حالة الصرف',
                        getValue: (s) => s.status === 'paid' ? 'تم الصرف والترحيل' : 'معلق / لم يصرف',
                        width: 18,
                      },
                    ],
                    companyName: appData.settings?.companyName || 'المنظومة المحاسبية المعتمدة',
                    reportTitle: `كشف مسير رواتب الموظفين لشهر ${selectedMonth}`,
                  });
                  showToast('تم تصدير كشف مسير الرواتب إلى Excel بنجاح', 'success');
                }}
                printTitle="طباعة كشف مسير الرواتب"
                exportTitle="تصدير كشف الرواتب إلى Excel"
              />
            </div>
          </div>

          {/* Slips Content */}
          <div className="space-y-3">
            {/* Mobile Cards */}
            <div className="block md:hidden space-y-3">
              {currentMonthSlips.length === 0 ? (
                <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-sm">
                  لا يوجد مسير رواتب مسجل لشهر {selectedMonth}. اضغط على "إنشاء مسير الشهر آلياً" لتوليده فوراً.
                </div>
              ) : (
                currentMonthSlips.map((slip) => (
                  <div
                    key={slip.id}
                    onClick={() => onInspectItem && onInspectItem('payroll', slip)}
                    className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3 active:bg-slate-50 transition"
                  >
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                      <div>
                        <strong className="text-slate-900 text-sm block">{slip.employeeName}</strong>
                        <span className="text-[11px] text-slate-500 font-semibold">{slip.department}</span>
                        <span className="text-xs font-mono font-bold text-blue-900 block mt-0.5">{slip.slipNumber}</span>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                          slip.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {slip.status === 'paid' ? 'تم الصرف والترحيل' : 'معلق للاعتماد'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-mono">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-sans">الأساسي:</span>
                        <strong className="text-slate-800">{(slip.basicSalary || 0).toLocaleString()} {currency}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-sans">البدلات:</span>
                        <strong className="text-emerald-700">+{(slip.allowances || 0).toLocaleString()} {currency}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-sans">الاستقطاعات:</span>
                        <strong className="text-rose-600">-{(slip.deductions || 0).toLocaleString()} {currency}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-sans">سداد السلفة:</span>
                        <strong className="text-amber-700">-{(slip.advancesDeducted || 0).toLocaleString()} {currency}</strong>
                      </div>
                      <div className="col-span-2 pt-1 border-t border-slate-200/50 flex justify-between items-center">
                        <span className="text-xs text-slate-600 font-sans">صافي الراتب المستحق:</span>
                        <strong className="text-blue-950 text-base font-black">
                          {(slip.netSalary || 0).toLocaleString()} {currency}
                        </strong>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                      {slip.status !== 'paid' ? (
                        <button
                          onClick={() => handleApprovePayroll(slip)}
                          className="min-h-[42px] bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition shadow-xs flex items-center justify-center gap-1"
                        >
                          💰 صرف وترحيل
                        </button>
                      ) : (
                        <div className="min-h-[42px] bg-slate-100 text-slate-500 rounded-xl text-xs font-bold flex items-center justify-center">
                          ✅ تم الصرف
                        </div>
                      )}
                      <button
                        onClick={() => onInspectItem && onInspectItem('payroll', slip)}
                        className="min-h-[42px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition flex items-center justify-center gap-1"
                      >
                        🔍 معاينة/طباعة
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">رقم القسيمة</th>
                      <th className="p-3">الموظف / القسم</th>
                      <th className="p-3 text-left">الأساسي</th>
                      <th className="p-3 text-left">البدلات</th>
                      <th className="p-3 text-left">الاستقطاعات</th>
                      <th className="p-3 text-left">سداد السلفة</th>
                      <th className="p-3 text-left">صافي الراتب</th>
                      <th className="p-3 text-center">الحالة</th>
                      <th className="p-3 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentMonthSlips.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center p-8 text-slate-400">
                          لا يوجد مسير رواتب مسجل لشهر {selectedMonth}. اضغط على "إنشاء مسير الشهر آلياً" لتوليده فوراً.
                        </td>
                      </tr>
                    ) : (
                      currentMonthSlips.map((slip) => (
                        <tr
                          key={slip.id}
                          onClick={() => onInspectItem && onInspectItem('payroll', slip)}
                          className="hover:bg-blue-50/50 cursor-pointer transition"
                        >
                          <td className="p-3 font-mono font-bold text-blue-900">{slip.slipNumber}</td>
                          <td className="p-3">
                            <div className="font-black text-slate-900">{slip.employeeName}</div>
                            <span className="text-[10px] text-slate-500">{slip.department}</span>
                          </td>
                          <td className="p-3 text-left">{(slip.basicSalary || 0).toLocaleString()} {currency}</td>
                          <td className="p-3 text-left text-emerald-700">+{(slip.allowances || 0).toLocaleString()} {currency}</td>
                          <td className="p-3 text-left text-rose-600">-{(slip.deductions || 0).toLocaleString()} {currency}</td>
                          <td className="p-3 text-left text-amber-700">-{(slip.advancesDeducted || 0).toLocaleString()} {currency}</td>
                          <td className="p-3 text-left font-black text-blue-950 text-sm">{(slip.netSalary || 0).toLocaleString()} {currency}</td>
                          <td className="p-3 text-center">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                slip.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {slip.status === 'paid' ? 'تم الصرف والترحيل' : 'معلق للاعتماد'}
                            </span>
                          </td>
                          <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1.5">
                              {slip.status !== 'paid' && (
                                <button
                                  onClick={() => handleApprovePayroll(slip)}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition shadow-xs"
                                  title="صرف الراتب وترحيل القيد المحاسبي"
                                >
                                  💰 صرف وترحيل
                                </button>
                              )}
                              <button
                                onClick={() => onInspectItem && onInspectItem('payroll', slip)}
                                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-1 rounded-lg text-[11px] font-bold cursor-pointer"
                              >
                                🔍 معاينة/طباعة
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EMPLOYEES DIRECTORY */}
      {activeTab === 'employees' && (
        <div className="space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-200">
            <span className="text-xs font-bold text-slate-600">قائمة وسجل العاملين بالمنشأة ({employees.length} موظف)</span>
            <div className="flex items-center gap-2">
              <TableActionButtons
                onPrint={() => {
                  openUnifiedPrintWindow(
                    {
                      title: 'دليل وبيانات العاملين والموظفين بالمنشأة',
                      partyLabel: 'إجمالي الموظفين',
                      partyName: `${employees.length} موظف`,
                      items: employees.map((emp) => ({
                        name: `${emp.name} (${emp.jobTitle || 'موظف'})`,
                        code: emp.code,
                        unit: emp.department,
                        qty: 1,
                        price: emp.basicSalary,
                        total: emp.basicSalary + (emp.housingAllowance || 0) + (emp.transportAllowance || 0),
                        notes: `الهاتف: ${emp.phone || '-'} | القومي: ${emp.nationalId || '-'}`,
                      })),
                      totals: [
                        {
                          label: 'إجمالي الرواتب الأساسية:',
                          value: employees.reduce((acc, c) => acc + c.basicSalary, 0),
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
                    filename: `سجل_الموظفين_${new Date().toISOString().split('T')[0]}`,
                    sheetName: 'دليل الموظفين',
                    data: employees,
                    columns: [
                      { header: 'كود الموظف', key: 'code', width: 14 },
                      { header: 'اسم الموظف', key: 'name', width: 25 },
                      { header: 'المسمى الوظيفي', key: 'jobTitle', width: 20 },
                      { header: 'القسم / الإدارة', key: 'department', width: 18 },
                      { header: 'رقم الهاتف', key: 'phone', width: 16 },
                      { header: 'الرقم القومي', key: 'nationalId', width: 20 },
                      { header: 'الراتب الأساسي (ج.م)', getValue: (e) => e.basicSalary.toFixed(2), width: 18 },
                      { header: 'بدل السكن (ج.م)', getValue: (e) => (e.housingAllowance || 0).toFixed(2), width: 16 },
                      { header: 'بدل الانتقال (ج.م)', getValue: (e) => (e.transportAllowance || 0).toFixed(2), width: 16 },
                      { header: 'التأمينات الاجتماعية', getValue: (e) => (e.insuranceDeduction || 0).toFixed(2), width: 18 },
                      { header: 'ضريبة كسب العمل', getValue: (e) => (e.taxDeduction || 0).toFixed(2), width: 18 },
                    ],
                    companyName: appData.settings?.companyName || 'المنظومة المحاسبية المعتمدة',
                    reportTitle: 'دليل وبيانات العاملين والموظفين المسجلين بالنظام',
                  });
                  showToast('تم تصدير سجل الموظفين إلى Excel بنجاح', 'success');
                }}
                printTitle="طباعة دليل وسجل الموظفين"
                exportTitle="تصدير سجل الموظفين إلى Excel"
              />
              <button
                onClick={() => {
                  setEditingEmpId(null);
                  setEmpName('');
                  setEmpPhone('');
                  setEmpNationalId('');
                  setEmpJobTitle('');
                  setEmpBasicSalary(5000);
                  setEmpHousing(500);
                  setEmpTransport(300);
                  setEmpInsurance(300);
                  setEmpTax(100);
                  setIsEmployeeModalOpen(true);
                }}
                className="bg-[#1a237e] hover:bg-[#0d47a1] text-white px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-xs"
              >
                <span>➕ إضافة موظف جديد</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {employees.map((emp) => (
              <div
                key={emp.id}
                className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-blue-300 transition space-y-3"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-black text-slate-900 text-sm">{emp.name}</h4>
                    <span className="text-xs text-blue-800 font-bold">{emp.jobTitle || 'موظف'}</span>
                    <span className="text-[11px] text-slate-400 block">{emp.department}</span>
                  </div>
                  <span className="bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                    {emp.code}
                  </span>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">الراتب الأساسي:</span>
                    <strong className="text-slate-800">{(emp.basicSalary || 0).toLocaleString()} {currency}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">إجمالي البدلات:</span>
                    <strong className="text-emerald-700">
                      +{((emp.housingAllowance || 0) + (emp.transportAllowance || 0) + (emp.otherAllowances || 0)).toLocaleString()} {currency}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">الاستقطاعات والتأمينات:</span>
                    <strong className="text-rose-600">
                      -{((emp.insuranceDeduction || 0) + (emp.taxDeduction || 0)).toLocaleString()} {currency}
                    </strong>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-mono" dir="ltr">{emp.phone}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingEmpId(emp.id);
                        setEmpName(emp.name);
                        setEmpPhone(emp.phone);
                        setEmpNationalId(emp.nationalId || '');
                        setEmpDepartment(emp.department);
                        setEmpJobTitle(emp.jobTitle);
                        setEmpBasicSalary(emp.basicSalary);
                        setEmpHousing(emp.housingAllowance);
                        setEmpTransport(emp.transportAllowance);
                        setEmpInsurance(emp.insuranceDeduction);
                        setEmpTax(emp.taxDeduction);
                        setIsEmployeeModalOpen(true);
                      }}
                      className="text-blue-700 hover:text-blue-900 font-bold cursor-pointer"
                    >
                      ✏️ تعديل
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: ADVANCES & LOANS */}
      {activeTab === 'advances' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-600">سجل سلف العاملين والأقساط المستحقة</span>
            <button
              onClick={() => {
                if (employees.length > 0) setAdvEmpId(employees[0].id);
                setIsAdvanceModalOpen(true);
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-xs"
            >
              <span>💳 صرف سلفة لموظف</span>
            </button>
          </div>

          <div className="space-y-3">
            {/* Mobile Cards */}
            <div className="block md:hidden space-y-3">
              {advances.length === 0 ? (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center text-slate-400 text-sm">
                  لا يوجد سلف مسجلة حالياً
                </div>
              ) : (
                advances.map((adv) => (
                  <div
                    key={adv.id}
                    className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div>
                        <strong className="text-slate-900 text-sm block">{adv.employeeName}</strong>
                        <span className="text-[11px] text-slate-500 font-mono">تاريخ الصرف: {adv.date}</span>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          adv.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {adv.status === 'completed' ? 'مسددة بالكامل' : 'جارية الخصم'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-mono">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-sans">قيمة السلفة:</span>
                        <strong className="text-slate-800">{(adv.totalAmount || 0).toLocaleString()} {currency}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-sans">عدد الأقساط:</span>
                        <strong className="text-slate-800">{adv.installmentsCount} شهر</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-sans">الاستقطاع الشهري:</span>
                        <strong className="text-amber-700">{(adv.monthlyDeduction || 0).toLocaleString()} {currency}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-sans">المسدد:</span>
                        <strong className="text-emerald-700">{(adv.paidAmount || 0).toLocaleString()} {currency}</strong>
                      </div>
                      <div className="col-span-2 pt-1 border-t border-slate-200/50 flex justify-between items-center">
                        <span className="text-xs text-slate-600 font-sans">المتبقي من السلفة:</span>
                        <strong className="text-rose-700 font-black text-sm">
                          {(adv.remainingAmount || 0).toLocaleString()} {currency}
                        </strong>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">الموظف</th>
                    <th className="p-3">تاريخ الصرف</th>
                    <th className="p-3 text-left">قيمة السلفة</th>
                    <th className="p-3 text-center">الأقساط</th>
                    <th className="p-3 text-left">الاستقطاع الشهري</th>
                    <th className="p-3 text-left">المسدد</th>
                    <th className="p-3 text-left">المتبقي</th>
                    <th className="p-3 text-center">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {advances.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center p-6 text-slate-400">
                        لا يوجد سلف مسجلة حالياً
                      </td>
                    </tr>
                  ) : (
                    advances.map((adv) => (
                      <tr key={adv.id} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-slate-800">{adv.employeeName}</td>
                        <td className="p-3 text-slate-500 font-mono">{adv.date}</td>
                        <td className="p-3 text-left font-bold">{(adv.totalAmount || 0).toLocaleString()} {currency}</td>
                        <td className="p-3 text-center">{adv.installmentsCount} شهر</td>
                        <td className="p-3 text-left text-amber-700 font-bold">{(adv.monthlyDeduction || 0).toLocaleString()} {currency}</td>
                        <td className="p-3 text-left text-emerald-700">{(adv.paidAmount || 0).toLocaleString()} {currency}</td>
                        <td className="p-3 text-left font-black text-rose-700">{(adv.remainingAmount || 0).toLocaleString()} {currency}</td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              adv.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {adv.status === 'completed' ? 'مسددة بالكامل' : 'جارية الخصم'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Employee Modal */}
      {isEmployeeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl p-6 space-y-4 border border-slate-200">
            <h3 className="font-black text-lg text-[#1a237e]">
              {editingEmpId ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم الموظف *</label>
                <input
                  type="text"
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl"
                  placeholder="الاسم ثلاثي"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">رقم الهاتف</label>
                <input
                  type="text"
                  value={empPhone}
                  onChange={(e) => setEmpPhone(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl"
                  placeholder="010xxxxxxxx"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">القسم / الإدارة</label>
                <select
                  value={empDepartment}
                  onChange={(e) => setEmpDepartment(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl bg-white"
                >
                  <option value="المبيعات والتسويق">المبيعات والتسويق</option>
                  <option value="الحسابات والمالية">الحسابات والمالية</option>
                  <option value="المستودعات واللوجستيات">المستودعات واللوجستيات</option>
                  <option value="الإدارة العامة">الإدارة العامة</option>
                  <option value="الدعم الفني والتشغيل">الدعم الفني والتشغيل</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">المسمى الوظيفي</label>
                <input
                  type="text"
                  value={empJobTitle}
                  onChange={(e) => setEmpJobTitle(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl"
                  placeholder="مثال: مندوب مبيعات، كاشير، محاسب"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">الراتب الأساسي *</label>
                <input
                  type="number"
                  value={empBasicSalary}
                  onChange={(e) => setEmpBasicSalary(Number(e.target.value))}
                  className="w-full p-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">بدل سكن / انتقال</label>
                <input
                  type="number"
                  value={empHousing}
                  onChange={(e) => setEmpHousing(Number(e.target.value))}
                  className="w-full p-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">استقطاع التأمينات</label>
                <input
                  type="number"
                  value={empInsurance}
                  onChange={(e) => setEmpInsurance(Number(e.target.value))}
                  className="w-full p-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">استقطاع كسب العمل / ضرائب</label>
                <input
                  type="number"
                  value={empTax}
                  onChange={(e) => setEmpTax(Number(e.target.value))}
                  className="w-full p-2 border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsEmployeeModalOpen(false)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveEmployee}
                className="bg-[#1a237e] hover:bg-[#0d47a1] text-white px-5 py-2 rounded-xl text-xs font-bold cursor-pointer shadow-xs"
              >
                💾 حفظ الموظف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Advance Modal */}
      {isAdvanceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 border border-slate-200">
            <h3 className="font-black text-lg text-amber-900">صرف سلفة لموظف</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اختر الموظف</label>
                <select
                  value={advEmpId}
                  onChange={(e) => setAdvEmpId(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl bg-white"
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.department})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">مبلغ السلفة ({currency})</label>
                <input
                  type="number"
                  value={advAmount}
                  onChange={(e) => setAdvAmount(Number(e.target.value))}
                  className="w-full p-2 border border-slate-300 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">عدد شهور السداد (الأقساط)</label>
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={advInstallments}
                  onChange={(e) => setAdvInstallments(Number(e.target.value))}
                  className="w-full p-2 border border-slate-300 rounded-xl font-bold"
                />
                <span className="text-[10px] text-slate-500 block mt-1">
                  سيتم خصم: {Math.ceil(advAmount / (advInstallments || 1))} {currency} شهرياً تلقائياً من مسير الراتب.
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">بيان وملاحظات</label>
                <input
                  type="text"
                  value={advNotes}
                  onChange={(e) => setAdvNotes(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl"
                  placeholder="سبب السلفة..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsAdvanceModalOpen(false)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveAdvance}
                className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2 rounded-xl text-xs font-bold cursor-pointer shadow-xs"
              >
                💵 اعتماد وصرف السلفة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
