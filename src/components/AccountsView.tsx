import React, { useState } from 'react';
import {
  Users,
  Building2,
  User,
  UserPlus,
  FileText,
  MessageSquare,
  Pencil,
  Trash2,
  Printer,
  Plus,
  Phone,
  Calendar,
  Save,
  X,
  CreditCard,
} from 'lucide-react';
import { AppData, Customer, CustomerRepresentative } from '../types';
import { Modal } from './Modal';
import { printStatementWindow, compileStatementData, formatEnNumber } from '../utils/printStatement';
import { exportElementToPdf } from '../utils/pdfExport';
import { exportToExcel } from '../utils/excelExport';
import { openUnifiedPrintWindow } from '../utils/printUnified';
import { TableActionButtons } from './TableActionButtons';
import { generateStatementWhatsAppMessage, openWhatsAppChat } from '../services/whatsappService';
import { calculateCustomerBalance, calculateSupplierBalance } from '../utils/accounting';

interface AccountsViewProps {
  appData: AppData;
  onUpdateData: (newData: AppData, actionInfo?: { action?: string; module?: string; details?: string; deletedId?: string | number }) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const AccountsView: React.FC<AccountsViewProps> = ({ appData, onUpdateData, showToast }) => {
  const [modalType, setModalType] = useState<'customer' | 'supplier' | null>(null);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [commercialReg, setCommercialReg] = useState('');
  const [address, setAddress] = useState('');
  const [initialRepName, setInitialRepName] = useState('');
  const [initialRepPhone, setInitialRepPhone] = useState('');

  const handleOpenEdit = (type: 'customer' | 'supplier', acc: any) => {
    setEditingAccountId(acc.id);
    setName(acc.name || '');
    setPhone(acc.phone || '');
    setTaxNumber(acc.taxNumber || '');
    setCommercialReg(acc.commercialReg || '');
    setAddress(acc.address || '');
    setInitialRepName('');
    setInitialRepPhone('');
    setModalType(type);
  };

  // Representatives Modal State
  const [managingRepsParty, setManagingRepsParty] = useState<{
    id: string;
    name: string;
    type: 'customer' | 'supplier';
    phone?: string;
    representatives: CustomerRepresentative[];
  } | null>(null);
  const [newRepName, setNewRepName] = useState('');
  const [newRepPhone, setNewRepPhone] = useState('');
  const [newRepJobTitle, setNewRepJobTitle] = useState('');
  const [newRepNotes, setNewRepNotes] = useState('');

  // Statement Modal State
  const [statementParty, setStatementParty] = useState<{
    name: string;
    type: 'customer' | 'supplier';
  } | null>(null);
  const [statementFromDate, setStatementFromDate] = useState('');
  const [statementToDate, setStatementToDate] = useState(new Date().toISOString().split('T')[0]);

  const openStatementModal = (partyName: string, partyType: 'customer' | 'supplier') => {
    setStatementParty({ name: partyName, type: partyType });
    setStatementFromDate('');
    setStatementToDate(new Date().toISOString().split('T')[0]);
  };

  // Print Customers Directory
  const handlePrintCustomers = () => {
    const totalBalance = appData.customers.reduce((sum, c) => sum + calculateCustomerBalance(c, appData).balance, 0);
    openUnifiedPrintWindow(
      {
        reportTitle: 'دليل العملاء والأرصدة الحسابية الفعلى',
        subTitle: 'سجل حسابات العملاء المعتمد والمحسوب محاسبياً',
        serial: 'CUST-REP',
        branch: 'الإدارة المالية',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        kpis: [
          { title: 'إجمالي العملاء', value: `${appData.customers.length} عميل` },
          { title: 'إجمالي مديونيات العملاء الفعلية', value: `${totalBalance.toFixed(2)} ج.م` },
        ],
        columns: ['#', 'اسم العميل', 'رقم الهاتف', 'الرصيد الحسابي الفعلي (ج.م)', 'الحالة'],
        rows: appData.customers.map((c, idx) => {
          const bal = calculateCustomerBalance(c, appData).balance;
          return [
            idx + 1,
            c.name,
            c.phone || 'غير مسجل',
            `${bal.toFixed(2)} ج.م`,
            bal > 0 ? 'مدين (عليه مبالغ)' : bal < 0 ? 'دائن (له رصيد)' : 'متزن',
          ];
        }),
        summary: [
          { label: 'إجمالي أرصدة العملاء الفعلية', value: `${totalBalance.toFixed(2)} ج.م`, isTotal: true },
        ],
        footerNote: 'تم استخراج كشف أرصدة العملاء استناداً للعمليات والمعاملات الفعلية المسجلة',
      },
      appData.settings,
      showToast
    );
  };

  // Export Customers to Excel
  const handleExportCustomersExcel = () => {
    exportToExcel({
      filename: `دليل_العملاء_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'العملاء',
      data: appData.customers,
      columns: [
        { header: 'كود العميل', key: 'id', width: 14 },
        { header: 'اسم العميل', key: 'name', width: 28 },
        { header: 'رقم الهاتف', key: 'phone', width: 18 },
        {
          header: 'الرصيد الحسابي الفعلي (ج.م)',
          getValue: (item: any) => calculateCustomerBalance(item, appData).balance.toFixed(2),
          width: 20,
        },
      ],
      companyName: appData.settings?.companyName || 'المنظومة المحاسبية المعتمدة',
      reportTitle: 'دليل وحسابات العملاء المعتمدة',
    });
    showToast('تم تصدير دليل العملاء إلى ملف Excel بنجاح', 'success');
  };

  // Print Suppliers Directory
  const handlePrintSuppliers = () => {
    const totalBalance = appData.suppliers.reduce((sum, s) => sum + calculateSupplierBalance(s, appData).balance, 0);
    openUnifiedPrintWindow(
      {
        reportTitle: 'دليل الموردين والأرصدة المستحقة الفعلية',
        subTitle: 'سجل حسابات الموردين المعتمد والمحسوب محاسبياً',
        serial: 'SUPP-REP',
        branch: 'الإدارة المالية والمشتريات',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        kpis: [
          { title: 'إجمالي الموردين', value: `${appData.suppliers.length} مورد` },
          { title: 'إجمالي مستحقات الموردين الفعلية', value: `${totalBalance.toFixed(2)} ج.م` },
        ],
        columns: ['#', 'اسم المورد', 'رقم الهاتف', 'الرصيد الحسابي الفعلي (ج.م)', 'الحالة'],
        rows: appData.suppliers.map((s, idx) => {
          const bal = calculateSupplierBalance(s, appData).balance;
          return [
            idx + 1,
            s.name,
            s.phone || 'غير مسجل',
            `${bal.toFixed(2)} ج.م`,
            bal > 0 ? 'مستحق له (دائن)' : bal < 0 ? 'مدين (لنا مبالغ)' : 'متزن',
          ];
        }),
        summary: [
          { label: 'إجمالي مستحقات الموردين الفعلية', value: `${totalBalance.toFixed(2)} ج.م`, isTotal: true },
        ],
        footerNote: 'تم استخراج كشف أرصدة الموردين استناداً للعمليات الفعلية المسجلة',
      },
      appData.settings,
      showToast
    );
  };

  // Export Suppliers to Excel
  const handleExportSuppliersExcel = () => {
    exportToExcel({
      filename: `دليل_الموردين_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'الموردين',
      data: appData.suppliers,
      columns: [
        { header: 'كود المورد', key: 'id', width: 14 },
        { header: 'اسم المورد', key: 'name', width: 28 },
        { header: 'رقم الهاتف', key: 'phone', width: 18 },
        {
          header: 'الرصيد الحسابي الفعلي (ج.م)',
          getValue: (item: any) => calculateSupplierBalance(item, appData).balance.toFixed(2),
          width: 20,
        },
      ],
      companyName: appData.settings?.companyName || 'المنظومة المحاسبية المعتمدة',
      reportTitle: 'دليل وحسابات الموردين المعتمدة',
    });
    showToast('تم تصدير دليل الموردين إلى ملف Excel بنجاح', 'success');
  };

  const handleAddAccount = () => {
    if (!name.trim()) {
      showToast('يرجى إدخال الاسم', 'warning');
      return;
    }

    const updatedData = { ...appData };
    const currentUser = appData.users.find((u) => u.id === appData.currentUser) || appData.users[0];
    const nowIso = new Date().toISOString();

    if (editingAccountId) {
      if (modalType === 'customer') {
        updatedData.customers = updatedData.customers.map((c) =>
          c.id === editingAccountId
            ? {
                ...c,
                companyId: c.companyId || appData.companyId || 'COMP-000001',
                name: name.trim(),
                phone: phone.trim(),
                taxNumber: taxNumber.trim() || undefined,
                commercialReg: commercialReg.trim() || undefined,
                address: address.trim() || undefined,
                updatedAt: nowIso,
                updatedBy: currentUser?.name || 'مدير النظام',
              }
            : c
        );
        showToast('تم تعديل بيانات العميل بنجاح', 'success');
      } else {
        updatedData.suppliers = updatedData.suppliers.map((s) =>
          s.id === editingAccountId
            ? {
                ...s,
                companyId: s.companyId || appData.companyId || 'COMP-000001',
                name: name.trim(),
                phone: phone.trim(),
                taxNumber: taxNumber.trim() || undefined,
                commercialReg: commercialReg.trim() || undefined,
                address: address.trim() || undefined,
                updatedAt: nowIso,
                updatedBy: currentUser?.name || 'مدير النظام',
              }
            : s
        );
        showToast('تم تعديل بيانات المورد بنجاح', 'success');
      }

      onUpdateData(updatedData);
      setModalType(null);
      setEditingAccountId(null);
      setName('');
      setPhone('');
      setTaxNumber('');
      setCommercialReg('');
      setAddress('');
      setInitialRepName('');
      setInitialRepPhone('');
      return;
    }

    const initialReps: CustomerRepresentative[] = [];
    if (initialRepName.trim()) {
      initialReps.push({
        id: 'rep_' + Date.now(),
        name: initialRepName.trim(),
        phone: initialRepPhone.trim() || phone.trim(),
        jobTitle: modalType === 'customer' ? 'المندوب المفوض بالاستلام' : 'مندوب التوريد والمبيعات',
        isPrimary: true,
      });
    }

    if (modalType === 'customer') {
      const newCustId = 'c' + Date.now();
      updatedData.customers.push({
        id: newCustId,
        companyId: appData.companyId || 'COMP-000001',
        branchId: appData.activeBranchId || 'main',
        name: name.trim(),
        phone: phone.trim(),
        taxNumber: taxNumber.trim() || undefined,
        commercialReg: commercialReg.trim() || undefined,
        address: address.trim() || undefined,
        balance: 0,
        representatives: initialReps,
        transactions: [],
        createdAt: nowIso,
        updatedAt: nowIso,
        createdBy: currentUser?.name || 'مدير النظام',
        createdByUserId: currentUser?.id,
        createdByUserCode: currentUser?.code || 1,
      });
      showToast('تم إضافة العميل وبيانات المندوب بنجاح', 'success');
    } else {
      updatedData.suppliers.push({
        id: 's' + Date.now(),
        companyId: appData.companyId || 'COMP-000001',
        branchId: appData.activeBranchId || 'main',
        name: name.trim(),
        phone: phone.trim(),
        taxNumber: taxNumber.trim() || undefined,
        commercialReg: commercialReg.trim() || undefined,
        address: address.trim() || undefined,
        balance: 0,
        representatives: initialReps,
        transactions: [],
        createdAt: nowIso,
        updatedAt: nowIso,
        createdBy: currentUser?.name || 'مدير النظام',
        createdByUserId: currentUser?.id,
        createdByUserCode: currentUser?.code || 1,
      });
      showToast('تم إضافة المورد وبيانات المندوب بنجاح', 'success');
    }

    onUpdateData(updatedData, {
      action: modalType === 'customer' ? 'create_customer' : 'create_supplier',
      module: modalType === 'customer' ? 'العملاء' : 'الموردين',
      details: `إضافة ${modalType === 'customer' ? 'عميل' : 'مورد'}: ${name.trim()}`,
    });
    setModalType(null);
    setName('');
    setPhone('');
    setTaxNumber('');
    setCommercialReg('');
    setAddress('');
    setInitialRepName('');
    setInitialRepPhone('');
  };

  const handleWhatsAppCustomer = (c: Customer) => {
    const msg = generateStatementWhatsAppMessage(
      c.name,
      c.balance || 0,
      new Date().toISOString().split('T')[0],
      appData.settings
    );
    openWhatsAppChat(c.phone || '', msg);
    showToast('جاري فتح محادثة واتساب لإرسال كشف الحساب والرصيد للعميل', 'info');
  };

  const handleAddRepresentative = () => {
    if (!managingRepsParty || !newRepName.trim()) {
      showToast('يرجى إدخال اسم المندوب', 'warning');
      return;
    }

    const newRep: CustomerRepresentative = {
      id: 'rep_' + Date.now(),
      name: newRepName.trim(),
      phone: newRepPhone.trim(),
      jobTitle: newRepJobTitle.trim() || (managingRepsParty.type === 'customer' ? 'المندوب المفوض' : 'مندوب التوريد'),
      notes: newRepNotes.trim() || undefined,
      isPrimary: (managingRepsParty.representatives?.length || 0) === 0,
    };

    const updatedData = { ...appData };
    if (managingRepsParty.type === 'customer') {
      const updatedCusts = appData.customers.map((c) => {
        if (c.id === managingRepsParty.id) {
          const reps = c.representatives ? [...c.representatives, newRep] : [newRep];
          return { ...c, representatives: reps };
        }
        return c;
      });
      updatedData.customers = updatedCusts;
      const current = updatedCusts.find((c) => c.id === managingRepsParty.id);
      setManagingRepsParty(
        current
          ? {
              id: current.id,
              name: current.name,
              type: 'customer',
              phone: current.phone,
              representatives: current.representatives || [],
            }
          : null
      );
    } else {
      const updatedSupps = appData.suppliers.map((s) => {
        if (s.id === managingRepsParty.id) {
          const reps = s.representatives ? [...s.representatives, newRep] : [newRep];
          return { ...s, representatives: reps };
        }
        return s;
      });
      updatedData.suppliers = updatedSupps;
      const current = updatedSupps.find((s) => s.id === managingRepsParty.id);
      setManagingRepsParty(
        current
          ? {
              id: current.id,
              name: current.name,
              type: 'supplier',
              phone: current.phone,
              representatives: current.representatives || [],
            }
          : null
      );
    }

    onUpdateData(updatedData);
    setNewRepName('');
    setNewRepPhone('');
    setNewRepJobTitle('');
    setNewRepNotes('');
    showToast('تمت إضافة المندوب بنجاح للشركة', 'success');
  };

  const handleDeleteRepresentative = (repId: string) => {
    if (!managingRepsParty) return;
    const updatedData = { ...appData };

    if (managingRepsParty.type === 'customer') {
      const updatedCusts = appData.customers.map((c) => {
        if (c.id === managingRepsParty.id) {
          const reps = (c.representatives || []).filter((r) => r.id !== repId);
          return { ...c, representatives: reps };
        }
        return c;
      });
      updatedData.customers = updatedCusts;
      const current = updatedCusts.find((c) => c.id === managingRepsParty.id);
      setManagingRepsParty(
        current
          ? {
              id: current.id,
              name: current.name,
              type: 'customer',
              phone: current.phone,
              representatives: current.representatives || [],
            }
          : null
      );
    } else {
      const updatedSupps = appData.suppliers.map((s) => {
        if (s.id === managingRepsParty.id) {
          const reps = (s.representatives || []).filter((r) => r.id !== repId);
          return { ...s, representatives: reps };
        }
        return s;
      });
      updatedData.suppliers = updatedSupps;
      const current = updatedSupps.find((s) => s.id === managingRepsParty.id);
      setManagingRepsParty(
        current
          ? {
              id: current.id,
              name: current.name,
              type: 'supplier',
              phone: current.phone,
              representatives: current.representatives || [],
            }
          : null
      );
    }

    onUpdateData(updatedData);
    showToast('تم حذف المندوب بنجاح');
  };

  const handleDeleteCustomer = (id: string) => {
    if (!confirm('حذف هذا العميل؟')) return;
    const targetCust = appData.customers.find((c) => c.id === id);
    const updatedData = { ...appData };
    if (!updatedData.deletedRecords) updatedData.deletedRecords = {};
    updatedData.deletedRecords[`customers_${id}`] = Date.now();
    updatedData.customers = updatedData.customers.filter((c) => c.id !== id);
    onUpdateData(updatedData, {
      action: 'delete_customer',
      module: 'العملاء',
      details: `حذف العميل: ${targetCust?.name || id}`,
    });
    showToast('تم حذف العميل بنجاح');
  };

  const handleDeleteSupplier = (id: string) => {
    if (!confirm('حذف هذا المورد؟')) return;
    const targetSupp = appData.suppliers.find((s) => s.id === id);
    const updatedData = { ...appData };
    if (!updatedData.deletedRecords) updatedData.deletedRecords = {};
    updatedData.deletedRecords[`suppliers_${id}`] = Date.now();
    updatedData.suppliers = updatedData.suppliers.filter((s) => s.id !== id);
    onUpdateData(updatedData, {
      action: 'delete_supplier',
      module: 'الموردين',
      details: `حذف المورد: ${targetSupp?.name || id}`,
    });
    showToast('تم حذف المورد بنجاح');
  };

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Customers Section */}
        <div className="bg-white p-4 rounded-xl shadow-xs border border-slate-200/90 space-y-3">
          <div className="flex flex-wrap justify-between items-center pb-2 border-b border-slate-100 gap-2">
            <h4 className="text-slate-900 font-bold text-sm sm:text-base flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-700" />
              <span>العملاء والشركات المشترية ({appData.customers.length})</span>
            </h4>
            <div className="flex flex-wrap items-center gap-1.5">
              <TableActionButtons
                onPrint={handlePrintCustomers}
                onExportExcel={handleExportCustomersExcel}
                printTitle="طباعة دليل العملاء والأرصدة"
                exportTitle="تصدير العملاء إلى Excel"
              />
              <button
                onClick={() => {
                  setName('');
                  setPhone('');
                  setTaxNumber('');
                  setCommercialReg('');
                  setAddress('');
                  setInitialRepName('');
                  setInitialRepPhone('');
                  setModalType('customer');
                }}
                className="min-h-[38px] bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <UserPlus className="w-4 h-4" />
                <span>إضافة شركة / عميل</span>
              </button>
            </div>
          </div>

          {/* Mobile Card List (< md) */}
          <div className="block md:hidden space-y-2.5">
            {appData.customers.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">لا يوجد عملاء مسجلين</div>
            ) : (
              appData.customers.map((c) => (
                <div key={c.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2 shadow-2xs">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                        <span>{c.name}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1 font-mono">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{c.phone || 'بدون رقم'}</span>
                      </div>
                      {c.representatives && c.representatives.length > 0 && (
                        <div className="text-[11px] text-blue-800 font-medium mt-1 bg-blue-50/70 border border-blue-100 p-1.5 rounded">
                          المناديب: {c.representatives.map((r) => `${r.name} (${r.phone})`).join(' ، ')}
                        </div>
                      )}
                    </div>
                    <div className="text-left">
                      <div className="text-[10px] text-slate-500">الرصيد الفعلي الحسابي</div>
                      {(() => {
                        const bal = calculateCustomerBalance(c, appData).balance;
                        return (
                          <div className={`font-mono font-bold text-xs tabular-nums ${bal > 0 ? 'text-rose-700' : bal < 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                            {bal.toFixed(2)} ج.م
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                    <button
                      onClick={() =>
                        setManagingRepsParty({
                          id: c.id,
                          name: c.name,
                          type: 'customer',
                          phone: c.phone,
                          representatives: c.representatives || [],
                        })
                      }
                      className="min-h-[36px] bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1 border border-blue-200 cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>المناديب ({c.representatives?.length || 0})</span>
                    </button>
                    <button
                      onClick={() => openStatementModal(c.name, 'customer')}
                      className="min-h-[36px] bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>كشف حساب</span>
                    </button>
                    <button
                      onClick={() => handleWhatsAppCustomer(c)}
                      className="min-h-[36px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                      title="إرسال كشف الحساب والرصيد واتساب"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>واتساب</span>
                    </button>
                    <button
                      onClick={() => handleOpenEdit('customer', c)}
                      className="min-h-[36px] bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>تعديل</span>
                    </button>
                    <button
                      onClick={() => handleDeleteCustomer(c.id)}
                      className="min-h-[36px] bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table (>= md) */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-right text-xs md:text-sm">
              <thead>
                <tr className="bg-[#0f2756] text-white">
                  <th className="p-2.5 font-semibold">الشركة / العميل</th>
                  <th className="p-2.5 font-semibold">هاتف الشركة</th>
                  <th className="p-2.5 font-semibold">المناديب وجهات الاتصال</th>
                  <th className="p-2.5 font-semibold">الرصيد (ج.م)</th>
                  <th className="p-2.5 font-semibold">كشف الحساب</th>
                  <th className="p-2.5 font-semibold">تعديل</th>
                  <th className="p-2.5 font-semibold">حذف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {appData.customers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center p-4 text-slate-400">
                      لا يوجد عملاء
                    </td>
                  </tr>
                ) : (
                  appData.customers.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 transition">
                      <td className="p-2.5 font-bold text-slate-900">
                        <div>{c.name}</div>
                        {c.taxNumber && (
                          <div className="text-[10px] text-slate-400 font-mono">ضريبي: {c.taxNumber}</div>
                        )}
                      </td>
                      <td className="p-2.5 text-slate-600 font-mono">{c.phone || '-'}</td>
                      <td className="p-2.5">
                        <button
                          onClick={() =>
                            setManagingRepsParty({
                              id: c.id,
                              name: c.name,
                              type: 'customer',
                              phone: c.phone,
                              representatives: c.representatives || [],
                            })
                          }
                          className="bg-blue-50 hover:bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-semibold transition flex items-center gap-1 border border-blue-200 cursor-pointer"
                        >
                          <Users className="w-3 h-3" />
                          <span>المناديب</span>
                          <span className="bg-blue-200 text-blue-900 text-[10px] px-1 rounded font-mono">
                            {c.representatives?.length || 0}
                          </span>
                        </button>
                        {c.representatives && c.representatives.length > 0 && (
                          <div className="text-[10px] text-slate-500 truncate max-w-[150px] mt-0.5 font-mono">
                            {c.representatives[0].name} ({c.representatives[0].phone})
                          </div>
                        )}
                      </td>
                      <td className="p-2.5 font-bold font-mono tabular-nums">
                        {(() => {
                          const bal = calculateCustomerBalance(c, appData).balance;
                          return (
                            <span className={bal > 0 ? 'text-rose-700' : bal < 0 ? 'text-amber-700' : 'text-emerald-700'}>
                              {bal.toFixed(2)}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="p-2.5">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openStatementModal(c.name, 'customer')}
                            className="bg-slate-800 text-white px-2 py-1 rounded text-xs font-semibold hover:bg-slate-900 transition flex items-center gap-1 cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>كشف حساب</span>
                          </button>
                          <button
                            onClick={() => handleWhatsAppCustomer(c)}
                            className="bg-emerald-600 text-white p-1 rounded text-xs font-bold hover:bg-emerald-700 transition flex items-center justify-center cursor-pointer"
                            title="إرسال الرصيد عبر واتساب"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="p-2.5">
                        <button
                          onClick={() => handleOpenEdit('customer', c)}
                          className="w-7 h-7 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 cursor-pointer transition flex items-center justify-center border border-blue-200"
                          title="تعديل بيانات العميل"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </td>
                      <td className="p-2.5">
                        <button
                          onClick={() => handleDeleteCustomer(c.id)}
                          className="w-7 h-7 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 cursor-pointer transition flex items-center justify-center border border-rose-200"
                          title="حذف العميل"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Suppliers Section */}
        <div className="bg-white p-4 rounded-xl shadow-xs border border-slate-200/90 space-y-3">
          <div className="flex flex-wrap justify-between items-center pb-2 border-b border-slate-100 gap-2">
            <h4 className="text-slate-900 font-bold text-sm sm:text-base flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-700" />
              <span>الموردين ({appData.suppliers.length})</span>
            </h4>
            <div className="flex flex-wrap items-center gap-1.5">
              <TableActionButtons
                onPrint={handlePrintSuppliers}
                onExportExcel={handleExportSuppliersExcel}
                printTitle="طباعة دليل الموردين والأرصدة"
                exportTitle="تصدير الموردين إلى Excel"
              />
              <button
                onClick={() => {
                  setName('');
                  setPhone('');
                  setModalType('supplier');
                }}
                className="min-h-[38px] bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة مورد</span>
              </button>
            </div>
          </div>

          {/* Mobile Card List (< md) */}
          <div className="block md:hidden space-y-2.5">
            {appData.suppliers.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">لا يوجد موردين مسجلين</div>
            ) : (
              appData.suppliers.map((s) => (
                <div key={s.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2 shadow-2xs">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                        <span>{s.name}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1 font-mono">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{s.phone || 'بدون رقم'}</span>
                      </div>
                      {s.representatives && s.representatives.length > 0 && (
                        <div className="text-[11px] text-blue-800 font-medium mt-1 bg-blue-50/70 border border-blue-100 p-1.5 rounded">
                          المناديب: {s.representatives.map((r) => `${r.name} (${r.phone})`).join(' ، ')}
                        </div>
                      )}
                    </div>
                    <div className="text-left">
                      <div className="text-[10px] text-slate-500">الرصيد الفعلي المستحق</div>
                      {(() => {
                        const bal = calculateSupplierBalance(s, appData).balance;
                        return (
                          <div className={`font-mono font-bold text-xs tabular-nums ${bal > 0 ? 'text-rose-700' : bal < 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                            {bal.toFixed(2)} ج.م
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                    <button
                      onClick={() =>
                        setManagingRepsParty({
                          id: s.id,
                          name: s.name,
                          type: 'supplier',
                          phone: s.phone,
                          representatives: s.representatives || [],
                        })
                      }
                      className="min-h-[36px] bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1 border border-blue-200 cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>المناديب ({s.representatives?.length || 0})</span>
                    </button>
                    <button
                      onClick={() => openStatementModal(s.name, 'supplier')}
                      className="min-h-[36px] bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>كشف حساب</span>
                    </button>
                    <button
                      onClick={() => handleOpenEdit('supplier', s)}
                      className="min-h-[36px] bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>تعديل</span>
                    </button>
                    <button
                      onClick={() => handleDeleteSupplier(s.id)}
                      className="min-h-[36px] bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table (>= md) */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-right text-xs md:text-sm">
              <thead>
                <tr className="bg-[#0f2756] text-white">
                  <th className="p-2.5 font-semibold">الشركة / المورد</th>
                  <th className="p-2.5 font-semibold">هاتف الشركة</th>
                  <th className="p-2.5 font-semibold">المناديب وجهات الاتصال</th>
                  <th className="p-2.5 font-semibold">الرصيد (ج.م)</th>
                  <th className="p-2.5 font-semibold">كشف الحساب</th>
                  <th className="p-2.5 font-semibold">تعديل</th>
                  <th className="p-2.5 font-semibold">حذف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {appData.suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center p-4 text-slate-400">
                      لا يوجد موردين
                    </td>
                  </tr>
                ) : (
                  appData.suppliers.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 transition">
                      <td className="p-2.5 font-bold text-slate-900">
                        <div>{s.name}</div>
                        {s.taxNumber && (
                          <div className="text-[10px] text-slate-400 font-mono">ضريبي: {s.taxNumber}</div>
                        )}
                      </td>
                      <td className="p-2.5 text-slate-600 font-mono">{s.phone || '-'}</td>
                      <td className="p-2.5">
                        <button
                          onClick={() =>
                            setManagingRepsParty({
                              id: s.id,
                              name: s.name,
                              type: 'supplier',
                              phone: s.phone,
                              representatives: s.representatives || [],
                            })
                          }
                          className="bg-blue-50 hover:bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-semibold transition flex items-center gap-1 border border-blue-200 cursor-pointer"
                        >
                          <Users className="w-3 h-3" />
                          <span>المناديب</span>
                          <span className="bg-blue-200 text-blue-900 text-[10px] px-1 rounded font-mono">
                            {s.representatives?.length || 0}
                          </span>
                        </button>
                        {s.representatives && s.representatives.length > 0 && (
                          <div className="text-[10px] text-slate-500 truncate max-w-[150px] mt-0.5 font-mono">
                            {s.representatives[0].name} ({s.representatives[0].phone})
                          </div>
                        )}
                      </td>
                      <td className="p-2.5 font-bold font-mono tabular-nums">
                        {(() => {
                          const bal = calculateSupplierBalance(s, appData).balance;
                          return (
                            <span className={bal > 0 ? 'text-rose-700' : bal < 0 ? 'text-amber-700' : 'text-emerald-700'}>
                              {bal.toFixed(2)}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="p-2.5">
                        <button
                          onClick={() => openStatementModal(s.name, 'supplier')}
                          className="bg-slate-800 text-white px-2 py-1 rounded text-xs font-semibold hover:bg-slate-900 transition flex items-center gap-1 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>كشف حساب</span>
                        </button>
                      </td>
                      <td className="p-2.5">
                        <button
                          onClick={() => handleOpenEdit('supplier', s)}
                          className="w-7 h-7 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 cursor-pointer transition flex items-center justify-center border border-blue-200"
                          title="تعديل بيانات المورد"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </td>
                      <td className="p-2.5">
                        <button
                          onClick={() => handleDeleteSupplier(s.id)}
                          className="w-7 h-7 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 cursor-pointer transition flex items-center justify-center border border-rose-200"
                          title="حذف المورد"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Account Modal */}
      <Modal
        isOpen={modalType !== null}
        title={modalType === 'customer' ? '👤 إضافة شركة / عميل جديد' : '🏢 إضافة مورد جديد'}
        onClose={() => setModalType(null)}
      >
        <div className="space-y-4 text-xs md:text-sm">
          <div>
            <label className="block font-bold mb-1 text-slate-800">
              {modalType === 'customer' ? 'اسم الشركة / العميل *' : 'اسم المورد / الشركة *'}
            </label>
            <input
              type="text"
              placeholder={modalType === 'customer' ? 'مثال: شركة النور للتجارة والتوريدات' : 'اسم المورد...'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none font-semibold"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold mb-1 text-slate-800">رقم الهاتف الأساسي</label>
              <input
                type="text"
                placeholder="010xxxxxxx"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block font-bold mb-1 text-slate-800">الرقم الضريبي (اختياري)</label>
              <input
                type="text"
                placeholder="123-456-789"
                value={taxNumber}
                onChange={(e) => setTaxNumber(e.target.value)}
                className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold mb-1 text-slate-800">السجل التجاري (اختياري)</label>
              <input
                type="text"
                placeholder="رقم السجل التجاري..."
                value={commercialReg}
                onChange={(e) => setCommercialReg(e.target.value)}
                className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block font-bold mb-1 text-slate-800">العنوان / الفرع</label>
              <input
                type="text"
                placeholder="العنوان أو المدينة..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none"
              />
            </div>
          </div>

          {/* Initial Representative / Delegate for either Customer or Supplier */}
          <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-2.5">
            <div className="font-bold text-indigo-900 text-xs flex items-center gap-1.5">
              <span>👥</span> {modalType === 'customer' ? 'المندوب أو المفوض بالاستلام (يمكن إضافة المزيد لاحقاً)' : 'مندوب التوريد أو جهة الاتصال بالمورد (يمكن إضافة المزيد لاحقاً)'}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-0.5">اسم المندوب</label>
                <input
                  type="text"
                  placeholder="اسم مندوب الشركة..."
                  value={initialRepName}
                  onChange={(e) => setInitialRepName(e.target.value)}
                  className="w-full p-2 bg-white border border-indigo-200 rounded-lg focus:border-indigo-600 focus:outline-none text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-0.5">رقم هاتف المندوب</label>
                <input
                  type="text"
                  placeholder="01xxxxxxxxx"
                  value={initialRepPhone}
                  onChange={(e) => setInitialRepPhone(e.target.value)}
                  className="w-full p-2 bg-white border border-indigo-200 rounded-lg focus:border-indigo-600 focus:outline-none text-xs font-mono"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <button
              onClick={handleAddAccount}
              className="min-h-[42px] bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white px-6 py-2.5 rounded-lg font-semibold text-xs sm:text-sm cursor-pointer transition shadow-xs flex items-center justify-center gap-2 flex-1 sm:flex-initial text-center"
            >
              <Save className="w-4 h-4" />
              <span>حفظ البيانات</span>
            </button>
            <button
              onClick={() => setModalType(null)}
              className="min-h-[42px] bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-800 px-6 py-2.5 rounded-lg font-semibold text-xs sm:text-sm cursor-pointer transition flex items-center justify-center gap-1.5 flex-1 sm:flex-initial text-center"
            >
              <X className="w-4 h-4" />
              <span>إلغاء</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Representatives Management Modal (For Both Customers and Suppliers) */}
      <Modal
        isOpen={managingRepsParty !== null}
        title={`👥 إدارة مناديب وجهات الاتصال لـ (${managingRepsParty?.type === 'customer' ? 'شركة مشترية / عميل' : 'شركة موردة / مورد'}): ${managingRepsParty?.name || ''}`}
        onClose={() => setManagingRepsParty(null)}
      >
        {managingRepsParty && (
          <div className="space-y-4 text-xs md:text-sm">
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
              <div className="text-slate-700 font-bold">
                {managingRepsParty.type === 'customer' ? '🏢 شركة مشترية / عميل:' : '🏢 شركة موردة / مورد:'} {managingRepsParty.name} (هاتف: {managingRepsParty.phone || 'غير مسجل'})
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                يمكنك تسجيل عدة مناديب لهذه الشركة. عند إنشاء فاتورة ({managingRepsParty.type === 'customer' ? 'مبيعات' : 'مشتريات'}) يمكنك اختيار المندوب ليظهر اسمه ورقمه بالفاتورة المطبوعة بدقة.
              </div>
            </div>

            {/* List of Existing Representatives */}
            <div className="space-y-2">
              <h5 className="font-bold text-slate-800 text-xs">قائمة المناديب المسجلين:</h5>
              {(!managingRepsParty.representatives || managingRepsParty.representatives.length === 0) ? (
                <div className="text-center py-4 bg-amber-50/60 border border-amber-200 rounded-xl text-amber-800 text-xs">
                  لا يوجد مناديب مسجلين لهذه الشركة حالياً. يمكنك إضافة مندوب جديد بالأسفل.
                </div>
              ) : (
                <div className="space-y-2">
                  {managingRepsParty.representatives.map((rep) => (
                    <div
                      key={rep.id}
                      className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 transition"
                    >
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>👤 {rep.name}</span>
                          {rep.isPrimary && (
                            <span className="bg-indigo-100 text-indigo-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                              رئيسي
                            </span>
                          )}
                          {rep.jobTitle && (
                            <span className="text-slate-500 text-[11px]">({rep.jobTitle})</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-600 font-mono mt-0.5">📞 {rep.phone || 'بدون هاتف'}</div>
                        {rep.notes && <div className="text-[11px] text-slate-400 mt-0.5">📝 {rep.notes}</div>}
                      </div>
                      <button
                        onClick={() => handleDeleteRepresentative(rep.id)}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 p-2 rounded-lg text-xs font-bold transition cursor-pointer"
                        title="حذف المندوب"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add New Representative Form */}
            <div className="p-3.5 bg-indigo-50/50 border border-indigo-200 rounded-xl space-y-3">
              <div className="font-bold text-indigo-900 text-xs flex items-center gap-1">
                <span>➕</span> إضافة مندوب / مفوض جديد للشركة
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">اسم المندوب *</label>
                  <input
                    type="text"
                    placeholder="مثال: أحمد محمود"
                    value={newRepName}
                    onChange={(e) => setNewRepName(e.target.value)}
                    className="w-full p-2 bg-white border border-gray-300 rounded-lg focus:border-indigo-600 focus:outline-none text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">رقم هاتف المندوب *</label>
                  <input
                    type="text"
                    placeholder="01012345678"
                    value={newRepPhone}
                    onChange={(e) => setNewRepPhone(e.target.value)}
                    className="w-full p-2 bg-white border border-gray-300 rounded-lg focus:border-indigo-600 focus:outline-none text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">الصفة / الوظيفة</label>
                  <input
                    type="text"
                    placeholder={managingRepsParty.type === 'customer' ? 'مثال: مسؤول المشتريات / المستلم' : 'مثال: مندوب التوريد / المبيعات'}
                    value={newRepJobTitle}
                    onChange={(e) => setNewRepJobTitle(e.target.value)}
                    className="w-full p-2 bg-white border border-gray-300 rounded-lg focus:border-indigo-600 focus:outline-none text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">ملاحظات</label>
                  <input
                    type="text"
                    placeholder="ملاحظات إضافية..."
                    value={newRepNotes}
                    onChange={(e) => setNewRepNotes(e.target.value)}
                    className="w-full p-2 bg-white border border-gray-300 rounded-lg focus:border-indigo-600 focus:outline-none text-xs"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddRepresentative}
                className="w-full min-h-[40px] bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 shadow-xs cursor-pointer"
              >
                ➕ حفظ وإضافة المندوب
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setManagingRepsParty(null)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-5 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Statement Modal with Quick Filter and Real ERP Calculations */}
      <Modal
        isOpen={statementParty !== null}
        title={`📄 كشف حساب تفصيلي معتمد (${statementParty?.type === 'customer' ? 'عميل' : 'مورد'}): ${statementParty?.name || ''}`}
        onClose={() => setStatementParty(null)}
      >
        {statementParty && (
          <div id="statement-preview-container" className="space-y-4 text-xs md:text-sm p-1">
            {/* Header Badge */}
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between">
              <div>
                <div className="font-bold text-[#1a237e] text-sm">
                  {statementParty.name} ({statementParty.type === 'customer' ? 'حساب عميل' : 'حساب مورد'})
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  كشف حساب تفصيلي بالحركات والمبيعات والمشتريات والسندات مع احتساب الرصيد التراكمي
                </div>
              </div>
              <div className="text-2xl">📑</div>
            </div>

            {/* Date Filters & Quick Presets */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold mb-1 text-slate-800">من تاريخ (بداية الفترة)</label>
                <input
                  type="date"
                  value={statementFromDate}
                  onChange={(e) => setStatementFromDate(e.target.value)}
                  className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none bg-white font-semibold text-xs md:text-sm"
                />
              </div>

              <div>
                <label className="block font-bold mb-1 text-slate-800">إلى تاريخ (نهاية الفترة)</label>
                <input
                  type="date"
                  value={statementToDate}
                  onChange={(e) => setStatementToDate(e.target.value)}
                  className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none bg-white font-semibold text-xs md:text-sm"
                />
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setStatementFromDate('');
                  setStatementToDate(new Date().toISOString().split('T')[0]);
                }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                📅 كل المدة (من البداية)
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
                  setStatementFromDate(firstDay);
                  setStatementToDate(d.toISOString().split('T')[0]);
                }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                📅 هذا الشهر
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  const firstDayYear = new Date(d.getFullYear(), 0, 1).toISOString().split('T')[0];
                  setStatementFromDate(firstDayYear);
                  setStatementToDate(d.toISOString().split('T')[0]);
                }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                📅 هذا العام
              </button>
            </div>

            {/* Live Data Summary Card */}
            {(() => {
              const compiled = compileStatementData(
                statementParty.name,
                statementParty.type,
                appData,
                statementFromDate,
                statementToDate
              );

              let totalDebit = 0;
              let totalCredit = 0;
              compiled.transactions.forEach((tx) => {
                totalDebit += tx.debit;
                totalCredit += tx.credit;
              });

              const isSupp = statementParty.type === 'supplier';
              const runningBal = isSupp
                ? compiled.previousBalance + (totalCredit - totalDebit)
                : compiled.previousBalance + (totalDebit - totalCredit);

              return (
                <div className="space-y-3 bg-slate-50/80 p-3 rounded-2xl border border-slate-200">
                  <div className="font-bold text-slate-800 text-xs flex items-center justify-between">
                    <span>مؤشرات الكشف للفترة:</span>
                    <span className="font-mono text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      عدد الحركات: {compiled.transactions.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                    <div className="bg-white border border-slate-200 p-2 rounded-xl">
                      <div className="text-slate-600 font-bold">الرصيد السابق</div>
                      <div className="font-mono font-black text-sm text-slate-800 mt-1">
                        {formatEnNumber(compiled.previousBalance)}
                      </div>
                    </div>
                    <div className="bg-rose-50 border border-rose-200 p-2 rounded-xl">
                      <div className="text-rose-800 font-bold">
                        {isSupp ? 'السدادات (مدين)' : 'المديونية (عليه)'}
                      </div>
                      <div className="font-mono font-black text-sm text-rose-700 mt-1">
                        {formatEnNumber(totalDebit)}
                      </div>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 p-2 rounded-xl">
                      <div className="text-emerald-800 font-bold">
                        {isSupp ? 'المشتريات (له)' : 'التحصيلات (له)'}
                      </div>
                      <div className="font-mono font-black text-sm text-emerald-700 mt-1">
                        {formatEnNumber(totalCredit)}
                      </div>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 p-2 rounded-xl">
                      <div className="text-blue-800 font-bold">الرصيد النهائي الحالي</div>
                      <div className="font-mono font-black text-sm text-blue-700 mt-1">
                        {formatEnNumber(runningBal)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Print & PDF Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                onClick={() => {
                  printStatementWindow(
                    statementParty.name,
                    statementParty.type,
                    appData,
                    statementFromDate,
                    statementToDate,
                    showToast
                  );
                  setStatementParty(null);
                }}
                className="min-h-[44px] bg-[#1a237e] hover:bg-[#0d47a1] active:bg-[#002171] text-white px-5 py-2.5 rounded-xl font-bold cursor-pointer transition shadow-xs flex-1 text-center flex items-center justify-center gap-2 text-xs md:text-sm"
              >
                <span>🖨️</span>
                <span>طباعة كشف الحساب التفصيلي</span>
              </button>

              <button
                onClick={async () => {
                  const modalContent = document.getElementById('statement-preview-container');
                  if (modalContent) {
                    showToast('جاري إنشاء وتحميل كشف الحساب كملف PDF...', 'info');
                    try {
                      await exportElementToPdf(
                        modalContent,
                        `كشف_حساب_${statementParty.name}_${statementToDate || new Date().toISOString().split('T')[0]}.pdf`,
                        {
                          format: (appData.settings?.paperSize?.toLowerCase() as any) || 'a4',
                          margin: appData.settings?.pageMargin ?? 5,
                        }
                      );
                      showToast('تم تصدير ملف PDF بنجاح', 'success');
                      setStatementParty(null);
                    } catch (e) {
                      console.error(e);
                      showToast('جاري فتح نافذة الطباعة لتصدير PDF...', 'info');
                      printStatementWindow(
                        statementParty.name,
                        statementParty.type,
                        appData,
                        statementFromDate,
                        statementToDate,
                        showToast
                      );
                      setStatementParty(null);
                    }
                  } else {
                    printStatementWindow(
                      statementParty.name,
                      statementParty.type,
                      appData,
                      statementFromDate,
                      statementToDate,
                      showToast
                    );
                    setStatementParty(null);
                  }
                }}
                className="min-h-[44px] bg-[#c2410c] hover:bg-[#9a3412] active:bg-[#7c2d12] text-white px-5 py-2.5 rounded-xl font-bold cursor-pointer transition shadow-xs flex-1 text-center flex items-center justify-center gap-2 text-xs md:text-sm"
              >
                <span>📥</span>
                <span>تصدير PDF مباشر</span>
              </button>

              <button
                onClick={() => setStatementParty(null)}
                className="min-h-[44px] bg-gray-400 hover:bg-gray-500 active:bg-gray-600 text-white px-4 py-2.5 rounded-xl font-bold cursor-pointer transition flex-1 sm:flex-initial text-center text-xs md:text-sm"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
