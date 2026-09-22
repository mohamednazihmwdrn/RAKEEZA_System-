import React, { useState } from 'react';
import { AppData, AuditLog } from '../types';
import { openUnifiedPrintWindow } from '../utils/printUnified';
import { exportToExcel } from '../utils/excelExport';
import { TableActionButtons } from './TableActionButtons';

interface AuditTrailViewProps {
  appData: AppData;
  onUpdateData: (newData: AppData) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export const AuditTrailView: React.FC<AuditTrailViewProps> = ({
  appData,
  showToast,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<string>('all');

  const logs: AuditLog[] = appData.auditLogs || [];

  const actions = ['all', 'create', 'update', 'delete', 'print', 'approval', 'login', 'transfer'];
  const modules = ['all', ...Array.from(new Set(logs.map((l) => l.module)))];
  const userList = ['all', ...Array.from(new Set(logs.map((l) => l.userName).filter(Boolean)))];

  const getUserCode = (log: AuditLog) => {
    if (log.userCode !== undefined && log.userCode !== null && log.userCode !== '') {
      return log.userCode;
    }
    const matched = appData.users?.find((u) => u.id === log.userId || u.name === log.userName);
    if (matched?.code !== undefined && matched?.code !== null) {
      return matched.code;
    }
    if (log.userRole === 'admin' || log.userRole === 'company_admin' || log.userName.includes('مدير')) {
      return 1;
    }
    return undefined;
  };

  const filteredLogs = logs.filter((log) => {
    const code = getUserCode(log);
    const codeStr = code !== undefined ? `كود ${code}` : '';
    const matchSearch =
      log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.module.toLowerCase().includes(searchTerm.toLowerCase()) ||
      codeStr.toLowerCase().includes(searchTerm.toLowerCase());
    const matchAction = selectedAction === 'all' || log.action === selectedAction;
    const matchModule = selectedModule === 'all' || log.module === selectedModule;
    const matchUser = selectedUser === 'all' || log.userName === selectedUser;
    return matchSearch && matchAction && matchModule && matchUser;
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'create':
        return <span className="bg-emerald-100 text-emerald-800 text-[11px] px-2.5 py-0.5 rounded-full font-bold">➕ إضافة جديدة</span>;
      case 'update':
        return <span className="bg-blue-100 text-blue-800 text-[11px] px-2.5 py-0.5 rounded-full font-bold">✏️ تعديل بيانات</span>;
      case 'delete':
        return <span className="bg-rose-100 text-rose-800 text-[11px] px-2.5 py-0.5 rounded-full font-bold">🗑️ حذف</span>;
      case 'print':
        return <span className="bg-indigo-100 text-indigo-800 text-[11px] px-2.5 py-0.5 rounded-full font-bold">🖨️ طباعة</span>;
      case 'approval':
        return <span className="bg-purple-100 text-purple-800 text-[11px] px-2.5 py-0.5 rounded-full font-bold">🛡️ اعتماد</span>;
      case 'transfer':
        return <span className="bg-amber-100 text-amber-800 text-[11px] px-2.5 py-0.5 rounded-full font-bold">🚚 تحويل مخزني</span>;
      case 'login':
        return <span className="bg-teal-100 text-teal-800 text-[11px] px-2.5 py-0.5 rounded-full font-bold">🔑 تسجيل دخول</span>;
      default:
        return <span className="bg-slate-100 text-slate-700 text-[11px] px-2.5 py-0.5 rounded-full font-bold">{action}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-gradient-to-r from-[#263238] to-[#37474f] text-white p-5 rounded-2xl shadow-md flex flex-wrap justify-between items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🛡️</span>
            <h3 className="font-black text-lg md:text-xl text-[#ffd54f]">
              سجل التدقيق الرقابي والأمان (Audit Trail & Activity Log)
            </h3>
          </div>
          <p className="text-xs text-slate-200 mt-1 opacity-90">
            رصد زمني دقيق لكل العمليات والتعديلات والإضافات التي تمت داخل النظام لحماية البيانات من التلاعب
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-white/10 px-3 py-1.5 rounded-xl text-xs font-mono text-white">
            إجمالي السجلات: <strong>{filteredLogs.length}</strong> حركة
          </div>
          <TableActionButtons
            onPrint={() => {
              openUnifiedPrintWindow(
                {
                  title: 'تقرير سجل التدقيق الرقابي وحركات النظام (Audit Trail)',
                  partyLabel: 'إجمالي الحركات',
                  partyName: `${filteredLogs.length} سجل حركة`,
                  items: filteredLogs.map((l) => ({
                    name: l.details,
                    code: l.id,
                    unit: l.module,
                    qty: 1,
                    price: 0,
                    total: 0,
                    notes: `المستخدم: ${l.userName} | الإجراء: ${l.action} | التاريخ: ${l.timestamp}`,
                  })),
                  totals: [
                    {
                      label: 'عدد الحركات المطبوعة:',
                      value: filteredLogs.length,
                      isBold: true,
                    },
                  ],
                },
                appData.settings,
                showToast
              );
            }}
            onExportExcel={() => {
              exportToExcel({
                filename: `سجل_التدقيق_الرقابي_${new Date().toISOString().split('T')[0]}`,
                sheetName: 'سجل التدقيق الرقابي',
                data: filteredLogs,
                columns: [
                  { header: 'كود السجل', key: 'id', width: 14 },
                  { header: 'التاريخ والوقت', key: 'timestamp', width: 22 },
                  { header: 'اسم المستخدم', key: 'userName', width: 20 },
                  { header: 'نوع الحركة', key: 'action', width: 16 },
                  { header: 'القسم / الوحدة', key: 'module', width: 18 },
                  { header: 'تفاصيل وبيان العملية', key: 'details', width: 45 },
                ],
                companyName: appData.settings?.companyName || 'المنظومة المحاسبية المعتمدة',
                reportTitle: 'سجل التدقيق الرقابي والأمان وحركات مستخدمي النظام',
              });
              showToast('تم تصدير سجل التدقيق إلى Excel بنجاح', 'success');
            }}
            printTitle="طباعة سجل التدقيق الرقابي"
            exportTitle="تصدير سجل التدقيق إلى Excel"
          />
        </div>
      </div>

      {/* Real-time sync banner */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <span className="font-bold text-emerald-900">
            مزامنة سحابية فورية لحظية نشطة بين كود 1 (المدير) وجميع أكواد موظفي الشركة
          </span>
        </div>
        <div className="text-emerald-700 text-[11px] font-medium">
          يتم توثيق كل حركة بالثانية مع اسم وكود المستخدم المنفذ للإجراء
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">بحث شامل بالسجل أو الكود</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="🔍 بحث بالبيان، المستخدم، كود 1..."
            className="w-full p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-slate-50 focus:border-[#1a237e] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">المستخدم / الكود</label>
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="w-full p-2 border border-slate-300 rounded-xl text-xs font-bold bg-slate-50 focus:border-[#1a237e] focus:outline-none"
          >
            <option value="all">👥 جميع المستخدمين والأكواد</option>
            {userList.filter((u) => u !== 'all').map((u) => {
              const matchedU = appData.users?.find((usr) => usr.name === u);
              const uCode = matchedU?.code || (matchedU?.role === 'admin' || matchedU?.role === 'company_admin' ? 1 : '');
              return (
                <option key={u} value={u}>
                  {uCode ? `كود ${uCode} - ` : ''}{u}
                </option>
              );
            })}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">نوع الحركة</label>
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="w-full p-2 border border-slate-300 rounded-xl text-xs font-bold bg-slate-50 focus:border-[#1a237e] focus:outline-none"
          >
            <option value="all">🌟 جميع الحركات</option>
            {actions.filter((a) => a !== 'all').map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">الوحدة / القسم</label>
          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className="w-full p-2 border border-slate-300 rounded-xl text-xs font-bold bg-slate-50 focus:border-[#1a237e] focus:outline-none"
          >
            <option value="all">🌟 جميع الأقسام</option>
            {modules.filter((m) => m !== 'all').map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Audit Log Container: Responsive Cards on Mobile & Table on Desktop */}
      {/* Mobile Cards View (< md) */}
      <div className="block md:hidden space-y-3">
        {filteredLogs.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center text-slate-400 border border-slate-200">
            <span className="text-3xl block mb-2">📜</span>
            <p className="font-bold text-sm text-slate-700">لا توجد سجلات تطابق معايير البحث</p>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const code = getUserCode(log);
            const isManager = code === 1 || code === '1' || log.userRole === 'admin' || log.userRole === 'company_admin' || log.userName.includes('مدير');

            return (
              <div
                key={log.id}
                className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-2.5 w-full max-w-full box-border"
              >
                {/* Header: Timestamp and Action */}
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <span className="font-mono text-xs text-slate-500 font-medium">🕒 {log.timestamp}</span>
                  <div>{getActionBadge(log.action)}</div>
                </div>

                {/* User & Module Info */}
                <div className="flex items-center justify-between gap-2 text-xs flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {isManager ? (
                      <span className="inline-flex items-center gap-1 bg-amber-100 border border-amber-300 text-amber-900 text-[11px] px-2 py-0.5 rounded-full font-bold shadow-2xs">
                        <span>👑</span> كود 1 (المدير)
                      </span>
                    ) : code !== undefined && code !== null ? (
                      <span className="inline-flex items-center gap-1 bg-indigo-100 border border-indigo-200 text-indigo-900 text-[11px] px-2 py-0.5 rounded-full font-bold">
                        <span>👤</span> كود {code}
                      </span>
                    ) : (
                      <span className="bg-slate-100 text-slate-600 text-[11px] px-2 py-0.5 rounded-full font-medium">
                        مستخدم
                      </span>
                    )}
                    <span className="font-bold text-slate-900">{log.userName}</span>
                  </div>

                  <span className="font-semibold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded-md text-xs border border-indigo-100">
                    📂 {log.module}
                  </span>
                </div>

                {/* Event Details */}
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs text-slate-700 font-medium leading-relaxed break-words">
                  {log.details}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Audit Log Table (>= md) */}
      <div className="hidden md:block bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs md:text-sm">
            <thead className="bg-[#1a237e] text-white">
              <tr>
                <th className="p-3 rounded-r-lg">التوقيت والتاريخ</th>
                <th className="p-3">المستخدم والكود</th>
                <th className="p-3">نوع الحركة</th>
                <th className="p-3">الوحدة / القسم</th>
                <th className="p-3 rounded-l-lg">تفاصيل الحدث والبيانات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    لا توجد سجلات تطابق معايير البحث.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const code = getUserCode(log);
                  const isManager = code === 1 || code === '1' || log.userRole === 'admin' || log.userRole === 'company_admin' || log.userName.includes('مدير');

                  return (
                    <tr key={log.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-mono text-slate-600 whitespace-nowrap text-xs">
                        🕒 {log.timestamp}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {isManager ? (
                            <span className="inline-flex items-center gap-1 bg-amber-100 border border-amber-300 text-amber-900 text-[11px] px-2 py-0.5 rounded-full font-bold shadow-2xs">
                              <span>👑</span> كود 1 (المدير)
                            </span>
                          ) : code !== undefined && code !== null ? (
                            <span className="inline-flex items-center gap-1 bg-indigo-100 border border-indigo-200 text-indigo-900 text-[11px] px-2 py-0.5 rounded-full font-bold">
                              <span>👤</span> كود {code}
                            </span>
                          ) : (
                            <span className="bg-slate-100 text-slate-600 text-[11px] px-2 py-0.5 rounded-full font-medium">
                              مستخدم
                            </span>
                          )}
                          <span className="font-bold text-slate-900">{log.userName}</span>
                        </div>
                      </td>
                      <td className="p-3 whitespace-nowrap">{getActionBadge(log.action)}</td>
                      <td className="p-3 font-semibold text-indigo-900 whitespace-nowrap">
                        📂 {log.module}
                      </td>
                      <td className="p-3 text-slate-700 font-medium">{log.details}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
