import React, { useState } from 'react';
import { AppData, User, UserRole } from '../types';
import { Modal } from './Modal';
import { openUnifiedPrintWindow } from '../utils/printUnified';
import { exportToExcel } from '../utils/excelExport';
import { TableActionButtons } from './TableActionButtons';
import { SYSTEM_PERMISSIONS, PermissionDefinition } from '../utils/permissions';
import { getStoredLocalSession } from '../services/cloudApi';
import {
  Shield,
  UserPlus,
  Key,
  CheckSquare,
  Square,
  Sparkles,
  Edit2,
  Trash2,
  Lock,
  Unlock,
  Building2,
  Phone,
  UserCheck,
  CheckCircle2,
} from 'lucide-react';

interface UsersViewProps {
  appData: AppData;
  onUpdateData: (newData: AppData, actionInfo?: { action?: string; module?: string; details?: string }) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const UsersView: React.FC<UsersViewProps> = ({ appData, onUpdateData, showToast }) => {
  const currentCompanyId = appData.companyId || 'COMP-000001';
  const currentUser = appData.users.find((u) => u.id === appData.currentUser) || appData.users[0];

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('user');
  const [userStatus, setUserStatus] = useState<'active' | 'disabled'>('active');
  const [userPermissions, setUserPermissions] = useState<Record<string, boolean>>({});

  // Filter users strictly by the current company
  const companyUsers = appData.users.filter(
    (u) => !u.companyId || u.companyId === currentCompanyId
  );

  // Reset Form
  const handleOpenNewUserModal = () => {
    setEditingUserId(null);
    setName('');
    setUsername('');
    setPassword('');
    setPhone('');
    setRole('user');
    setUserStatus('active');

    // Default basic permissions
    const defaultPerms: Record<string, boolean> = {
      dashboard: true,
      sales_view: true,
      sales_create: true,
      quotes_orders: true,
      items_view: true,
      pos_access: true,
    };
    setUserPermissions(defaultPerms);
    setIsModalOpen(true);
  };

  const handleOpenEditUserModal = (user: User) => {
    setEditingUserId(user.id);
    setName(user.name);
    setUsername(user.username);
    setPassword(user.password || '');
    setPhone(user.phone || '');
    setRole(user.role);
    setUserStatus(user.status || 'active');

    // Convert stored permissions
    const perms: Record<string, boolean> = {};
    if (user.permissions?.all || user.role === 'admin' || user.role === 'company_admin') {
      SYSTEM_PERMISSIONS.forEach((p) => {
        perms[p.id] = true;
      });
    } else {
      SYSTEM_PERMISSIONS.forEach((p) => {
        perms[p.id] = !!user.permissions?.[p.id];
      });
    }
    setUserPermissions(perms);
    setIsModalOpen(true);
  };

  // Toggle single permission
  const handleTogglePermission = (permId: string) => {
    setUserPermissions((prev) => ({
      ...prev,
      [permId]: !prev[permId],
    }));
  };

  // Preset role templates
  const handleApplyRolePreset = (presetRole: string) => {
    const newPerms: Record<string, boolean> = {};

    if (presetRole === 'all') {
      SYSTEM_PERMISSIONS.forEach((p) => (newPerms[p.id] = true));
      setRole('admin');
    } else if (presetRole === 'cashier') {
      newPerms.dashboard = true;
      newPerms.pos_access = true;
      newPerms.sales_view = true;
      newPerms.sales_create = true;
      newPerms.sales_returns = true;
      newPerms.items_view = true;
      newPerms.cash_receipt = true;
      setRole('cashier');
    } else if (presetRole === 'warehouse') {
      newPerms.dashboard = true;
      newPerms.inventory_view = true;
      newPerms.items_view = true;
      newPerms.items_create = true;
      newPerms.items_edit = true;
      newPerms.inventory_stocktaking = true;
      newPerms.inventory_transfers = true;
      newPerms.purchases_view = true;
      setRole('warehouse_keeper');
    } else if (presetRole === 'accountant') {
      newPerms.dashboard = true;
      newPerms.accounts_view = true;
      newPerms.daily_entries = true;
      newPerms.treasury_view = true;
      newPerms.cash_receipt = true;
      newPerms.cash_payment = true;
      newPerms.banks_manage = true;
      newPerms.cheques_manage = true;
      newPerms.reports_view = true;
      newPerms.reports_export = true;
      newPerms.customers_manage = true;
      newPerms.suppliers_manage = true;
      setRole('accountant');
    } else if (presetRole === 'sales_rep') {
      newPerms.dashboard = true;
      newPerms.sales_view = true;
      newPerms.sales_create = true;
      newPerms.quotes_orders = true;
      newPerms.customers_manage = true;
      newPerms.items_view = true;
      newPerms.cash_receipt = true;
      setRole('sales_rep');
    } else if (presetRole === 'none') {
      // Uncheck all
      setRole('user');
    }

    setUserPermissions(newPerms);
  };

  // Save User
  const handleSaveUser = () => {
    if (!name.trim() || !username.trim() || !password.trim()) {
      showToast('يرجى ملء جميع الحقول المفروضة (الاسم، اسم المستخدم، وكلمة المرور)', 'warning');
      return;
    }

    // Check duplicate username inside company
    const duplicate = companyUsers.find(
      (u) =>
        u.username.toLowerCase() === username.trim().toLowerCase() &&
        u.id !== editingUserId
    );
    if (duplicate) {
      showToast('اسم المستخدم هذا مسجل مسبقاً في هذه الشركة، يرجى اختيار اسم آخر', 'error');
      return;
    }

    const permissionPayload: Record<string, boolean> = { ...userPermissions };

    let updatedUsers: User[];

    const activeSession = getStoredLocalSession();
    const activeCompCode =
      activeSession?.company?.code ||
      (activeSession?.company as any)?.companyCode ||
      appData.settings?.companyCode ||
      '101';

    if (editingUserId) {
      // Editing existing user
      updatedUsers = appData.users.map((u) => {
        if (u.id === editingUserId) {
          const userCode = u.code || (u as any).userCode || 1;
          return {
            ...u,
            code: userCode,
            userCode: userCode,
            uid: u.uid || `UID_${currentCompanyId}_USR_${userCode}`,
            companyId: u.companyId || currentCompanyId,
            companyCode: u.companyCode || String(activeCompCode),
            name: name.trim(),
            username: username.trim(),
            password: password.trim(),
            phone: phone.trim(),
            role,
            status: userStatus,
            permissions: permissionPayload,
          };
        }
        return u;
      });

      // Audit Log
      const auditLog = {
        id: `log-usr-${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        userName: currentUser.name,
        userId: currentUser.id,
        companyId: currentCompanyId,
        action: 'edit_user',
        module: 'إدارة المستخدمين والصلاحيات',
        details: `تم تحديث بيانات وصلاحيات المستخدم "${name.trim()}" (الدور: ${role})`,
      };

      onUpdateData({
        ...appData,
        users: updatedUsers,
        auditLogs: [auditLog, ...(appData.auditLogs || [])],
      });

      showToast(`تم تعديل بيانات وصلاحيات المستخدم "${name}" بنجاح`, 'success');
    } else {
      // Creating new user with sequential user code
      const existingCodes = companyUsers
        .map((u) => Number(u.code ?? (u as any).userCode ?? 0))
        .filter((n) => !isNaN(n) && n > 0);
      const nextUserCode = existingCodes.length > 0 ? Math.max(...existingCodes) + 1 : companyUsers.length + 1;
      const userUid = `UID_${currentCompanyId}_USR_${nextUserCode}`;

      const newUser: User = {
        id: `u-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        uid: userUid,
        code: nextUserCode,
        userCode: nextUserCode,
        companyId: currentCompanyId,
        companyCode: String(activeCompCode),
        name: name.trim(),
        username: username.trim(),
        password: password.trim(),
        phone: phone.trim(),
        role,
        status: userStatus,
        permissions: permissionPayload,
        createdAt: new Date().toISOString().split('T')[0],
      };

      updatedUsers = [...appData.users, newUser];

      // Audit Log
      const auditLog = {
        id: `log-usr-${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        userName: currentUser.name,
        userId: currentUser.id,
        companyId: currentCompanyId,
        action: 'create_user',
        module: 'إدارة المستخدمين والصلاحيات',
        details: `تم إنشاء حساب مستخدم جديد "${newUser.name}" (اسم الدخول: ${newUser.username}) مع تخصيص الصلاحيات`,
      };

      onUpdateData({
        ...appData,
        users: updatedUsers,
        auditLogs: [auditLog, ...(appData.auditLogs || [])],
      });

      showToast(`تم إنشاء حساب المستخدم "${newUser.name}" بنجاح`, 'success');
    }

    setIsModalOpen(false);
  };

  const handleDeleteUser = (id: string, userName: string) => {
    if (companyUsers.length <= 1) {
      showToast('لا يمكن حذف المستخدم الوحيد في الشركة', 'error');
      return;
    }
    if (id === currentUser.id) {
      showToast('لا يمكنك حذف الحساب الذي تستخدمه حالياً لتسجيل الدخول', 'warning');
      return;
    }
    if (!confirm(`هل أنت متأكد من حذف المستخدم "${userName}" نهائياً من منظومة الشركة؟`)) return;

    const updatedUsers = appData.users.filter((u) => u.id !== id);

    const auditLog = {
      id: `log-usr-del-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      userName: currentUser.name,
      userId: currentUser.id,
      companyId: currentCompanyId,
      action: 'delete_user',
      module: 'إدارة المستخدمين والصلاحيات',
      details: `تم حذف حساب المستخدم "${userName}"`,
    };

    onUpdateData({
      ...appData,
      users: updatedUsers,
      auditLogs: [auditLog, ...(appData.auditLogs || [])],
    });

    showToast(`تم حذف المستخدم "${userName}" بنجاح`, 'info');
  };

  const handleToggleStatus = (targetUser: User) => {
    if (targetUser.id === currentUser.id) {
      showToast('لا يمكنك تعطيل حسابك الشخصي أثناء تسجيل الدخول', 'warning');
      return;
    }

    const newStatus = targetUser.status === 'disabled' ? 'active' : 'disabled';
    const updatedUsers = appData.users.map((u) =>
      u.id === targetUser.id ? { ...u, status: newStatus as any } : u
    );

    const auditLog = {
      id: `log-usr-stat-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      userName: currentUser.name,
      userId: currentUser.id,
      companyId: currentCompanyId,
      action: 'change_user_status',
      module: 'إدارة المستخدمين والصلاحيات',
      details: `تم تغيير حالة المستخدم "${targetUser.name}" إلى ${newStatus === 'active' ? 'نشط' : 'معطل'}`,
    };

    onUpdateData({
      ...appData,
      users: updatedUsers,
      auditLogs: [auditLog, ...(appData.auditLogs || [])],
    });

    showToast(
      `تم ${newStatus === 'active' ? 'تنشيط' : 'تعطيل'} حساب المستخدم "${targetUser.name}" بنجاح`,
      'success'
    );
  };

  const handlePrintUsers = () => {
    openUnifiedPrintWindow(
      {
        reportTitle: 'دليل وحسابات مستخدمي المنظومة والصلاحيات',
        subTitle: `سجل موظفي ومستخدمي شركة: ${appData.settings?.companyName || 'الشركة'}`,
        serial: 'USERS-AUDIT',
        branch: 'إدارة الصلاحيات وأمن المعلومات',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        kpis: [
          { title: 'إجمالي المستخدمين', value: `${companyUsers.length} مستخدم` },
          { title: 'المدراء / الأدمن', value: `${companyUsers.filter((u) => u.role === 'admin' || u.role === 'company_admin').length} مدير` },
          { title: 'الحسابات النشطة', value: `${companyUsers.filter((u) => u.status !== 'disabled').length} نشط` },
        ],
        columns: ['#', 'الاسم بالكامل', 'اسم الدخول', 'الدور / الصلاحية', 'الحالة', 'الهاتف'],
        rows: companyUsers.map((u, idx) => [
          idx + 1,
          u.name,
          u.username,
          u.role === 'admin' || u.role === 'company_admin' ? 'مدير شركة (Admin)' : 'مستخدم مخصص',
          u.status === 'disabled' ? 'معطل ⛔' : 'نشط ✅',
          u.phone || '—',
        ]),
        footerNote: 'تم استخراج هذا التقرير الرقابي من منظومة RAKEEZA Cloud ERP المعتمدة',
      },
      appData.settings,
      showToast
    );
  };

  const handleExportUsersExcel = () => {
    exportToExcel({
      filename: `دليل_مستخدمي_الشركة_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'المستخدمين',
      data: companyUsers,
      columns: [
        { header: 'كود المستخدم', key: 'id', width: 14 },
        { header: 'الاسم بالكامل', key: 'name', width: 25 },
        { header: 'اسم الدخول', key: 'username', width: 20 },
        {
          header: 'نوع الصلاحية',
          getValue: (u: any) =>
            u.role === 'admin' || u.role === 'company_admin' ? 'مدير عام (Admin)' : 'مستخدم مصرح',
          width: 18,
        },
        {
          header: 'الحالة',
          getValue: (u: any) => (u.status === 'disabled' ? 'معطل' : 'نشط'),
          width: 12,
        },
        { header: 'الهاتف', key: 'phone', width: 16 },
      ],
      companyName: appData.settings?.companyName || 'منظومة ركيزة',
      reportTitle: 'دليل وسجل حسابات مستخدمي المنظومة والصلاحيات',
    });
    showToast('تم تصدير دليل المستخدمين إلى Excel بنجاح', 'success');
  };

  // Group permissions by category for the modal view
  const categories = Array.from(new Set(SYSTEM_PERMISSIONS.map((p) => p.category)));

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header Banner */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200/80 flex flex-wrap justify-between items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-slate-900 font-extrabold text-base sm:text-lg flex items-center gap-2">
                <span>إدارة مستخدمي وصلاحيات الشركة</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold">
                  {companyUsers.length} مستخدم
                </span>
              </h4>
              <p className="text-xs text-slate-500">
                عزل تام لحسابات موظفي شركتك مع التحكم الدقيق في صلاحيات كل مستخدم
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <TableActionButtons
            onPrint={handlePrintUsers}
            onExportExcel={handleExportUsersExcel}
            printLabel="طباعة السجل"
          />
          <button
            onClick={handleOpenNewUserModal}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2 rounded-xl text-xs md:text-sm font-bold cursor-pointer flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>إضافة مستخدم جديد</span>
          </button>
        </div>
      </div>

      {/* Users Responsive Cards (< md) */}
      <div className="block md:hidden space-y-3">
        {companyUsers.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center text-slate-400 border border-slate-200">
            <span className="text-3xl block mb-2">👥</span>
            <p className="font-bold text-sm text-slate-700">لا يوجد مستخدمين مسجلين</p>
          </div>
        ) : (
          companyUsers.map((u) => {
            const isAdmin = u.role === 'admin' || u.role === 'company_admin';
            const permsCount = u.permissions?.all
              ? SYSTEM_PERMISSIONS.length
              : Object.values(u.permissions || {}).filter(Boolean).length;

            return (
              <div
                key={u.id}
                className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-3 w-full max-w-full box-border"
              >
                {/* Header: Avatar, Name, ID & Status Toggle */}
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-sm shrink-0">
                      {u.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                        <span className="truncate">{u.name}</span>
                        {u.id === currentUser.id && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-amber-100 text-amber-800 font-semibold shrink-0">
                            (أنت)
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">ID: {u.id}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleStatus(u)}
                    disabled={u.id === currentUser.id}
                    className={`min-h-[36px] px-3 py-1 rounded-xl text-xs font-bold cursor-pointer transition-all inline-flex items-center gap-1 shrink-0 ${
                      u.status === 'disabled'
                        ? 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                        : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                    }`}
                    title="انقر لتبديل حالة الحساب بين نشط ومعطل"
                  >
                    {u.status === 'disabled' ? (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>معطل</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>نشط</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 block mb-0.5">اسم الدخول:</span>
                    <span className="font-mono font-bold text-slate-800">{u.username}</span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 block mb-0.5">الهاتف:</span>
                    <span className="font-mono text-slate-700">{u.phone || '—'}</span>
                  </div>

                  <div className="col-span-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          isAdmin
                            ? 'bg-purple-100 text-purple-800 border border-purple-200'
                            : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}
                      >
                        {isAdmin ? 'مدير عام الشركة' : 'مستخدم مصرح'}
                      </span>
                      <span className="text-[11px] text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md font-medium">
                        {isAdmin ? 'كامل الصلاحيات (37)' : `${permsCount} صلاحية مفعلة`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => handleOpenEditUserModal(u)}
                    className="flex-1 min-h-[44px] bg-blue-50 hover:bg-blue-100 active:bg-blue-200 text-blue-800 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>تعديل الصلاحيات والحساب</span>
                  </button>
                  {u.id !== currentUser.id && (
                    <button
                      onClick={() => handleDeleteUser(u.id, u.name)}
                      className="min-h-[44px] px-3.5 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1 cursor-pointer"
                      title="حذف المستخدم"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>حذف</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Users Desktop Table (>= md) */}
      <div className="hidden md:block bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 overflow-x-auto">
        <table className="w-full text-right text-xs md:text-sm">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="p-3 rounded-r-xl">الاسم ومسمى الحساب</th>
              <th className="p-3">اسم المستخدم للدخول</th>
              <th className="p-3">رقم الهاتف</th>
              <th className="p-3">الدور والصلاحيات</th>
              <th className="p-3 text-center">الحالة</th>
              <th className="p-3 rounded-l-xl text-center">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {companyUsers.map((u) => {
              const isAdmin = u.role === 'admin' || u.role === 'company_admin';
              const permsCount = u.permissions?.all
                ? SYSTEM_PERMISSIONS.length
                : Object.values(u.permissions || {}).filter(Boolean).length;

              return (
                <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-sm shrink-0">
                        {u.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{u.name}</span>
                          {u.id === currentUser.id && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-amber-100 text-amber-800 font-semibold">
                              (أنت)
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">ID: {u.id}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 font-mono text-slate-600 font-semibold">{u.username}</td>
                  <td className="p-3 text-slate-600">{u.phone || '—'}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          isAdmin
                            ? 'bg-purple-100 text-purple-800 border border-purple-200'
                            : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}
                      >
                        {isAdmin ? 'مدير عام الشركة' : 'مستخدم مصرح'}
                      </span>
                      <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        {isAdmin ? 'كامل الصلاحيات (37)' : `${permsCount} صلاحية مفعلة`}
                      </span>
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => handleToggleStatus(u)}
                      disabled={u.id === currentUser.id}
                      className={`px-2.5 py-1 rounded-full text-xs font-bold cursor-pointer transition-all inline-flex items-center gap-1 ${
                        u.status === 'disabled'
                          ? 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                          : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                      }`}
                      title="انقر لتبديل حالة الحساب بين نشط ومعطل"
                    >
                      {u.status === 'disabled' ? (
                        <>
                          <Lock className="w-3 h-3" />
                          <span>معطل</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3 h-3" />
                          <span>نشط</span>
                        </>
                      )}
                    </button>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => handleOpenEditUserModal(u)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        title="تعديل الصلاحيات وبيانات الحساب"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {u.id !== currentUser.id && (
                        <button
                          onClick={() => handleDeleteUser(u.id, u.name)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="حذف المستخدم"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Granular Permissions & User Modal */}
      <Modal
        isOpen={isModalOpen}
        title={editingUserId ? '🛠️ تعديل بيانات وصلاحيات المستخدم' : '👤 إضافة مستخدم جديد وتحديد الصلاحيات'}
        onClose={() => setIsModalOpen(false)}
      >
        <div className="space-y-5 text-xs sm:text-sm max-h-[80vh] overflow-y-auto pr-1" dir="rtl">
          
          {/* Section 1: Basic Credentials */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
            <h5 className="font-bold text-slate-800 flex items-center gap-1.5 text-sm">
              <UserCheck className="w-4 h-4 text-blue-600" />
              <span>البيانات الأساسية للحساب</span>
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1 text-slate-700">الاسم بالكامل *</label>
                <input
                  type="text"
                  placeholder="مثال: أحمد محمود"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700">اسم الدخول (Username) *</label>
                <input
                  type="text"
                  placeholder="ahmed_sales"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  dir="ltr"
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none font-mono text-left"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700">كلمة المرور *</label>
                <input
                  type="text"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  dir="ltr"
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none font-mono text-left"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700">رقم الهاتف (اختياري)</label>
                <input
                  type="text"
                  placeholder="010XXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  dir="ltr"
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none text-left"
                />
              </div>
            </div>

            <div className="flex items-center gap-4 pt-1">
              <div>
                <label className="block font-semibold mb-1 text-slate-700">حالة الحساب</label>
                <select
                  value={userStatus}
                  onChange={(e) => setUserStatus(e.target.value as any)}
                  className="p-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none"
                >
                  <option value="active">نشط (Active)</option>
                  <option value="disabled">معطل (Disabled)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700">الدور العام</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="p-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none"
                >
                  <option value="user">مستخدم عادي محدد الصلاحيات</option>
                  <option value="company_admin">مدير عام الشركة (كامل الصلاحيات)</option>
                  <option value="cashier">كاشير مبيعات</option>
                  <option value="accountant">محاسب مالي</option>
                  <option value="warehouse_keeper">أمين مخازن</option>
                  <option value="sales_rep">مندوب مبيعات</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Quick Permission Presets */}
          <div className="bg-blue-50/70 p-3.5 rounded-xl border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-blue-900 flex items-center gap-1.5 text-xs sm:text-sm">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>قوالب الصلاحيات السريعة:</span>
              </span>
              <span className="text-[11px] text-blue-700">تطبيق نمط فوري بنقرة واحدة</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleApplyRolePreset('all')}
                className="px-2.5 py-1 bg-white hover:bg-blue-100 border border-blue-300 text-blue-900 rounded-lg text-xs font-semibold transition-all cursor-pointer"
              >
                🌟 منح جميع الصلاحيات (أدمن)
              </button>
              <button
                type="button"
                onClick={() => handleApplyRolePreset('cashier')}
                className="px-2.5 py-1 bg-white hover:bg-blue-100 border border-blue-300 text-blue-900 rounded-lg text-xs font-semibold transition-all cursor-pointer"
              >
                🛒 كاشير مبيعات
              </button>
              <button
                type="button"
                onClick={() => handleApplyRolePreset('warehouse')}
                className="px-2.5 py-1 bg-white hover:bg-blue-100 border border-blue-300 text-blue-900 rounded-lg text-xs font-semibold transition-all cursor-pointer"
              >
                📦 أمين مخزن
              </button>
              <button
                type="button"
                onClick={() => handleApplyRolePreset('accountant')}
                className="px-2.5 py-1 bg-white hover:bg-blue-100 border border-blue-300 text-blue-900 rounded-lg text-xs font-semibold transition-all cursor-pointer"
              >
                🪙 محاسب مالي
              </button>
              <button
                type="button"
                onClick={() => handleApplyRolePreset('sales_rep')}
                className="px-2.5 py-1 bg-white hover:bg-blue-100 border border-blue-300 text-blue-900 rounded-lg text-xs font-semibold transition-all cursor-pointer"
              >
                🎯 مندوب مبيعات
              </button>
              <button
                type="button"
                onClick={() => handleApplyRolePreset('none')}
                className="px-2.5 py-1 bg-white hover:bg-rose-50 border border-rose-300 text-rose-800 rounded-lg text-xs font-semibold transition-all cursor-pointer"
              >
                ❌ إلغاء تحديد الكل
              </button>
            </div>
          </div>

          {/* Section 3: Granular Checkboxes by Category */}
          <div className="space-y-4">
            <h5 className="font-extrabold text-slate-900 text-sm flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-blue-600" />
                <span>مصفوفة الصلاحيات التفصيلية (Granular Permissions):</span>
              </span>
              <span className="text-xs font-semibold text-blue-600">
                {Object.values(userPermissions).filter(Boolean).length} من أصل {SYSTEM_PERMISSIONS.length} مفعلة
              </span>
            </h5>

            <div className="space-y-4">
              {categories.map((cat) => {
                const permsInCat = SYSTEM_PERMISSIONS.filter((p) => p.category === cat);
                const allChecked = permsInCat.every((p) => userPermissions[p.id]);

                return (
                  <div key={cat} className="p-3 rounded-xl border border-slate-200 bg-white space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <span className="font-bold text-slate-900 text-xs sm:text-sm">{cat}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = { ...userPermissions };
                          permsInCat.forEach((p) => {
                            updated[p.id] = !allChecked;
                          });
                          setUserPermissions(updated);
                        }}
                        className="text-[11px] text-blue-600 hover:underline font-semibold cursor-pointer"
                      >
                        {allChecked ? 'إلغاء تحديد القسم' : 'تحديد كل القسم'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {permsInCat.map((perm) => {
                        const isChecked = !!userPermissions[perm.id];
                        return (
                          <label
                            key={perm.id}
                            onClick={() => handleTogglePermission(perm.id)}
                            className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all select-none ${
                              isChecked
                                ? 'bg-blue-50/80 border-blue-300 text-blue-950 font-semibold'
                                : 'bg-slate-50/60 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="hidden"
                            />
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400 shrink-0" />
                            )}
                            <span className="text-xs leading-tight">{perm.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-4 border-t border-slate-200 sticky bottom-0 bg-white py-2">
            <button
              type="button"
              onClick={handleSaveUser}
              className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all text-sm cursor-pointer"
            >
              💾 حفظ المستخدم والصلاحيات
            </button>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="py-3 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
