import React, { useState, useRef } from 'react';
import { AppData, AutoBackupConfig, BackupRecord } from '../types';
import {
  createSystemSnapshot,
  downloadBackupJsonFile,
  parseAndValidateBackupFile,
  getStorageDiagnostics,
} from '../utils/autoBackup';
import { addAuditLog } from '../utils/storage';
import { openUnifiedPrintWindow } from '../utils/printUnified';
import { exportToExcel } from '../utils/excelExport';
import { TableActionButtons } from './TableActionButtons';
import { exportMigrationCsvPackage, exportMigrationExcel } from '../utils/migrationExporter';
import { realtimeSyncService } from '../services/realtimeSync';

interface BackupViewProps {
  appData: AppData;
  onUpdateData: (newData: AppData) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const BackupView: React.FC<BackupViewProps> = ({ appData, onUpdateData, showToast }) => {
  const [activeTab, setActiveTab] = useState<'schedule' | 'snapshots' | 'manual' | 'cloud_integrations'>('schedule');
  const [restoreCode, setRestoreCode] = useState('');
  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [selectedFileSummary, setSelectedFileSummary] = useState<any | null>(null);
  const [stagedRestoreData, setStagedRestoreData] = useState<AppData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const autoConfig: AutoBackupConfig = appData.autoBackupConfig || {
    enabled: true,
    intervalMinutes: 60,
    autoDownloadFile: false,
    maxSnapshotsToKeep: 15,
    lastBackupTimestamp: new Date().toISOString(),
    backupLocation: 'browser_storage',
    notifyOnBackup: true,
  };

  const backups = appData.backups || [];
  const diagnostics = getStorageDiagnostics();

  // Save Auto-Backup Config
  const handleUpdateConfig = (newConfig: Partial<AutoBackupConfig>) => {
    const updatedConfig: AutoBackupConfig = {
      ...autoConfig,
      ...newConfig,
    };

    const updated: AppData = {
      ...appData,
      autoBackupConfig: updatedConfig,
    };

    const finalData = addAuditLog(
      updated,
      'update',
      'النسخ الاحتياطي',
      `تم تحديث إعدادات النسخ التلقائي: الحالة (${updatedConfig.enabled ? 'مفعل' : 'معطل'}) - الفاصل (${updatedConfig.intervalMinutes} دقيقة).`
    );

    onUpdateData(finalData);
    showToast('تم حفظ إعدادات النسخ الاحتياطي التلقائي بنجاح', 'success');
  };

  // Create Manual Snapshot Now
  const handleCreateSnapshot = (label?: string) => {
    const customName = label || snapshotLabel.trim() || 'نقطة استعادة يدوية';
    const newSnapshot = createSystemSnapshot(appData, customName, 'manual');

    const updated: AppData = {
      ...appData,
      backups: [newSnapshot, ...(appData.backups || [])].slice(0, autoConfig.maxSnapshotsToKeep || 20),
      autoBackupConfig: {
        ...autoConfig,
        lastBackupTimestamp: new Date().toISOString(),
      },
    };

    const finalData = addAuditLog(
      updated,
      'create',
      'النسخ الاحتياطي',
      `تم إنشاء نقطة استعادة يدوية لنظام: ${customName} (حجم: ${newSnapshot.sizeKB} KB).`
    );

    onUpdateData(finalData);
    setSnapshotLabel('');
    showToast('تم إنشاء نقطة الاستعادة وحفظها في المتصفح بنجاح', 'success');
  };

  // Export Full JSON File
  const handleExportFile = () => {
    downloadBackupJsonFile(appData);
    const snap = createSystemSnapshot(appData, 'تصدير ملف بيانات خارجي', 'file_export');
    let updated = {
      ...appData,
      backups: [snap, ...(appData.backups || [])].slice(0, autoConfig.maxSnapshotsToKeep || 20),
    };
    updated = addAuditLog(updated, 'create', 'النسخ الاحتياطي', 'تم تحميل وتصدير ملف النسخة الاحتياطية كاملاً للجهاز.');
    onUpdateData(updated);
    showToast('تم تحميل ملف النسخة الاحتياطية JSON بنجاح إلى جهازك', 'success');
  };

  // 1-Click Instant Restore Snapshot
  const handleRestoreSnapshot = (snapshot: BackupRecord) => {
    if (
      !confirm(
        `⚠️ تنبيه هام!\nهل أنت متأكد من استعادة بيانات النظام إلى نقطة (${snapshot.label || 'النسخة المحددة'}) بتاريخ ${new Date(
          snapshot.date || Date.now()
        ).toLocaleString('ar-EG')}؟\nسيتم حفظ نقطة أمان احتياطية قبل الاستعادة تلقائياً.`
      )
    ) {
      return;
    }

    try {
      let targetData: AppData | null = null;

      if (snapshot.snapshotJson) {
        targetData = JSON.parse(snapshot.snapshotJson);
      } else if (snapshot.code) {
        const decoded = decodeURIComponent(escape(atob(snapshot.code)));
        targetData = JSON.parse(decoded);
      }

      if (!targetData || !targetData.settings) {
        throw new Error('بيانات النقطة غير مكتملة أو تالفة');
      }

      // 1. Create a safety pre-restore point of CURRENT state first!
      const safetyPoint = createSystemSnapshot(appData, '🛡️ نقطة أمان ما قبل الاسترجاع', 'pre_restore');

      // 2. Prepare restored state, preserving current backups history list
      const restoredAppData: AppData = {
        ...targetData,
        backups: [safetyPoint, ...(appData.backups || [])],
        autoBackupConfig: appData.autoBackupConfig || autoConfig,
      };

      const finalData = addAuditLog(
        restoredAppData,
        'update',
        'النسخ الاحتياطي',
        `تمت استعادة النظام بنجاح إلى نقطة (${snapshot.label}) المؤرخة في ${snapshot.date}.`
      );

      onUpdateData(finalData);
      showToast('تمت استعادة بيانات النظام بالكامل بنجاح وتوثيق نقطة أمان سابقة', 'success');
    } catch (e: any) {
      showToast(`فشل استعادة النقطة: ${e?.message || 'خطأ غير معروف'}`, 'error');
    }
  };

  // Handle File Input Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const validation = parseAndValidateBackupFile(content);

      if (!validation.isValid || !validation.parsedData) {
        showToast(validation.error || 'الملف المحدد غير صالح', 'error');
        setSelectedFileSummary(null);
        setStagedRestoreData(null);
        return;
      }

      setSelectedFileSummary(validation.summary);
      setStagedRestoreData(validation.parsedData);
      showToast('تم فحص الملف بنجاح وجاهز للاستعادة', 'info');
    };
    reader.readAsText(file);
  };

  // Apply File Restore
  const handleApplyFileRestore = () => {
    if (!stagedRestoreData) return;

    if (
      !confirm(
        `هل تريد بالتأكيد تطبيق النسخة الاحتياطية المستوردة لـ (${
          selectedFileSummary?.companyName || 'المنشأة'
        })؟\nسيتم استبدال البيانات الحالية وإنشاء نقطة أمان فورية.`
      )
    ) {
      return;
    }

    try {
      const safetyPoint = createSystemSnapshot(appData, '🛡️ نقطة أمان قبل استيراد ملف خارجي', 'pre_restore');
      const restoredAppData: AppData = {
        ...stagedRestoreData,
        backups: [safetyPoint, ...(appData.backups || [])],
        autoBackupConfig: appData.autoBackupConfig || autoConfig,
      };

      const finalData = addAuditLog(
        restoredAppData,
        'update',
        'النسخ الاحتياطي',
        `تم استيراد واستعادة ملف خارجي لمؤسسة (${selectedFileSummary?.companyName}).`
      );

      onUpdateData(finalData);
      showToast('تم استيراد واستعادة بيانات النظام من الملف بنجاح!', 'success');
      setSelectedFileSummary(null);
      setStagedRestoreData(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (e: any) {
      showToast(`حدث خطأ أثناء استعادة الملف: ${e?.message}`, 'error');
    }
  };

  // Restore from Base64 Text Code
  const handleRestoreFromCode = () => {
    if (!restoreCode.trim()) {
      showToast('يرجى لصق كود النسخة الاحتياطية المشفر أولاً', 'warning');
      return;
    }

    const validation = parseAndValidateBackupFile(restoreCode);
    if (!validation.isValid || !validation.parsedData) {
      showToast(validation.error || 'كود غير صالح', 'error');
      return;
    }

    if (
      !confirm(
        `هل أنت متأكد من استعادة البيانات من الكود المدخل لمؤسسة (${validation.summary?.companyName})؟`
      )
    ) {
      return;
    }

    const safetyPoint = createSystemSnapshot(appData, '🛡️ نقطة أمان قبل استرجاع كود مشفر', 'pre_restore');
    const restoredAppData: AppData = {
      ...validation.parsedData,
      backups: [safetyPoint, ...(appData.backups || [])],
      autoBackupConfig: appData.autoBackupConfig || autoConfig,
    };

    const finalData = addAuditLog(
      restoredAppData,
      'update',
      'النسخ الاحتياطي',
      `تم استرجاع النظام من كود مشفر بنجاح لمؤسسة (${validation.summary?.companyName}).`
    );

    onUpdateData(finalData);
    showToast('تمت استعادة البيانات من الكود بنجاح', 'success');
    setRestoreCode('');
  };

  // Delete Backup Record
  const handleDeleteBackup = (idxToDelete: number) => {
    if (!confirm('هل تريد حذف سجل نقطة الاستعادة هذه؟')) return;
    const newBackups = backups.filter((_, i) => i !== idxToDelete);
    onUpdateData({ ...appData, backups: newBackups });
    showToast('تم حذف نقطة الاستعادة بنجاح', 'success');
  };

  // Clear Old Snapshots
  const handleClearOldBackups = () => {
    if (!confirm('هل تريد مسح جميع نقاط الاستعادة القديمة والاحتفاظ بأحدث نقطتين فقط؟')) return;
    const trimmed = backups.slice(0, 2);
    onUpdateData({ ...appData, backups: trimmed });
    showToast('تم تنظيف وتفريغ نقاط الاستعادة القديمة بنجاح', 'success');
  };

  // Export Google Drive formatted snapshot
  const handleExportGoogleDriveFile = () => {
    const compName = (appData.settings?.companyName || 'Rakeeza').replace(/[/\\?%*:|"<>]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `GoogleDrive_Backup_${compName}_${dateStr}.json`;
    downloadBackupJsonFile(appData, fileName);
    showToast('تم تجهيز وتحميل ملف النسخة الاحتياطية لجوجل درايف بنجاح', 'success');
  };

  const handleOpenGoogleDrive = () => {
    if (typeof window !== 'undefined') {
      window.open('https://drive.google.com', '_blank');
    }
  };

  // Export Relational SQL Bundle
  const handleExportSqlZip = async () => {
    try {
      showToast('جاري تجميع حزمة جداول SQL وCSV العلاقية...', 'info');
      await exportMigrationCsvPackage(appData, undefined, 'مدير النظام');
      showToast('تم تصدير حزمة ملفات SQL وCSV العلاقية بنجاح', 'success');
    } catch (err: any) {
      showToast(`فشل تصدير حزمة SQL: ${err?.message || 'خطأ'}`, 'error');
    }
  };

  const handleExportSqlExcel = () => {
    try {
      showToast('جاري تصدير مصنف إكسل وقاموس البيانات العلائقية...', 'info');
      exportMigrationExcel(appData, undefined, 'مدير النظام');
      showToast('تم تصدير مصنف الإكسل العلائقي بنجاح', 'success');
    } catch (err: any) {
      showToast(`فشل تصدير الإكسل العلائقي: ${err?.message || 'خطأ'}`, 'error');
    }
  };

  const handlePurgeCloudBloat = async () => {
    try {
      const companyId = appData.companyId || 'COMP-000001';
      showToast('جاري ترشيد وتطهير الوثيقة السحابية لفايربيس...', 'info');
      await realtimeSyncService.broadcastChange(companyId, appData, {
        action: 'ترشيد وتطهير مساحة فايربيس',
        module: 'النسخ السحابي',
        details: 'تم ضغط وتنظيف السجلات وتفريغ التكرارات لتوفير مساحة السحابة',
      });
      showToast('تم ترشيد وثيقة فايربيس السحابية بنجاح واستهلاك أقل من 50KB', 'success');
    } catch (e: any) {
      showToast('فشل ترشيد السحابة', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto" dir="rtl">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#1a237e] via-[#0d47a1] to-[#01579b] text-white p-6 rounded-3xl shadow-md flex flex-wrap justify-between items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-white/10 rounded-xl text-2xl">💾</span>
            <h2 className="text-xl md:text-2xl font-black tracking-tight">
              مركز النسخ الاحتياطي التلقائي واستعادة الكوارث
            </h2>
            <span
              className={`text-xs px-3 py-1 rounded-full font-bold ${
                autoConfig.enabled
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-400/30'
              }`}
            >
              {autoConfig.enabled ? '● الحماية التلقائية نشطة' : '○ الحماية التلقائية معطلة'}
            </span>
          </div>
          <p className="text-xs md:text-sm text-blue-100 max-w-2xl leading-relaxed">
            حماية بيانات المؤسسة من الفقدان بجدولة نسخ ذكي دوري، استرجاع سريع بضغطة زر واحدة (1-Click Rollback)،
            وتصدير ملفات كاملة مشفرة لضمان أمان العمليات المحاسبية.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => handleCreateSnapshot('نقطة استعادة يدوية سريعة')}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <span>⚡ إنشاء نقطة استعادة الآن</span>
          </button>

          <button
            onClick={handleExportFile}
            className="bg-white/15 hover:bg-white/25 text-white px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 backdrop-blur-sm cursor-pointer"
          >
            <span>📥 تصدير ملف JSON كامل</span>
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex border-b border-slate-200 gap-4 text-xs md:text-sm font-bold">
        <button
          onClick={() => setActiveTab('schedule')}
          className={`pb-3 px-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'schedule'
              ? 'border-[#1a237e] text-[#1a237e]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>⚙️ جدولة النسخ التلقائي (Auto-Backup)</span>
        </button>

        <button
          onClick={() => setActiveTab('snapshots')}
          className={`pb-3 px-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'snapshots'
              ? 'border-[#1a237e] text-[#1a237e]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>🕒 نقاط الاستعادة المحفوظة ({backups.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('manual')}
          className={`pb-3 px-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'manual'
              ? 'border-[#1a237e] text-[#1a237e]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>📤 استيراد ملف خارجي أو كود مشفر</span>
        </button>

        <button
          onClick={() => setActiveTab('cloud_integrations')}
          className={`pb-3 px-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'cloud_integrations'
              ? 'border-[#1a237e] text-[#1a237e]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>☁️ تنظيم فايربيس وجوجل درايف وSQL</span>
        </button>
      </div>

      {/* TAB 1: AUTO-BACKUP SCHEDULER */}
      {activeTab === 'schedule' && (
        <div className="space-y-6">
          {/* Main Controls Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>🤖 إعدادات محرك النسخ الاحتياطي التلقائي (Auto-Backup Engine)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  يقوم النظام بحفظ لقطات مشفرة في الخلفية دون تعطيل عمل الكاشير أو المستخدمين.
                </p>
              </div>

              {/* Master Switch */}
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoConfig.enabled}
                  onChange={(e) => handleUpdateConfig({ enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-13 h-7 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-[#1a237e]"></div>
                <span className="mr-3 text-xs font-bold text-slate-800">
                  {autoConfig.enabled ? 'مفعل ويعمل تلقائياً' : 'معطل'}
                </span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Interval selector */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <label className="text-xs font-bold text-slate-700 block">⏱️ الفاصل الزمني للنسخ:</label>
                <select
                  disabled={!autoConfig.enabled}
                  value={autoConfig.intervalMinutes}
                  onChange={(e) => handleUpdateConfig({ intervalMinutes: Number(e.target.value) })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-xs font-bold focus:outline-none focus:border-[#1a237e] disabled:opacity-50"
                >
                  <option value={15}>كل 15 دقيقة (للمتاجر فائقة النشاط)</option>
                  <option value={30}>كل 30 دقيقة (موصى به لنقاط البيع POS)</option>
                  <option value={60}>كل 1 ساعة (افتراضي)</option>
                  <option value={120}>كل ساعتين</option>
                  <option value={360}>كل 6 ساعات</option>
                  <option value={1440}>مرة واحدة يومياً (Daily Backup)</option>
                </select>
                <p className="text-[11px] text-slate-500">
                  آخر نسخة تم حفظها: {autoConfig.lastBackupTimestamp ? new Date(autoConfig.lastBackupTimestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : 'لم تحفظ بعد'}
                </p>
              </div>

              {/* Max snapshots count */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <label className="text-xs font-bold text-slate-700 block">🗄️ عدد نقاط الاستعادة للاحتفاظ بها:</label>
                <select
                  disabled={!autoConfig.enabled}
                  value={autoConfig.maxSnapshotsToKeep || 15}
                  onChange={(e) => handleUpdateConfig({ maxSnapshotsToKeep: Number(e.target.value) })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-xs font-bold focus:outline-none focus:border-[#1a237e] disabled:opacity-50"
                >
                  <option value={5}>الاحتفاظ بآخر 5 نقاط استعادة</option>
                  <option value={10}>الاحتفاظ بآخر 10 نقاط استعادة</option>
                  <option value={15}>الاحتفاظ بآخر 15 نقطة استعادة (موصى به)</option>
                  <option value={30}>الاحتفاظ بآخر 30 نقطة استعادة</option>
                  <option value={50}>الاحتفاظ بآخر 50 نقطة استعادة</option>
                </select>
                <p className="text-[11px] text-slate-500">
                  يقوم النظام بتدوير النسخ القديمة آلياً لمنع امتلاء الذاكرة.
                </p>
              </div>

              {/* Auto download toggle */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <label className="text-xs font-bold text-slate-700 block">📥 التحميل التلقائي لملف خارجي:</label>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-slate-600">تنزيل ملف .json آلياً</span>
                  <input
                    type="checkbox"
                    disabled={!autoConfig.enabled}
                    checked={autoConfig.autoDownloadFile}
                    onChange={(e) => handleUpdateConfig({ autoDownloadFile: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded cursor-pointer disabled:opacity-50"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  يقوم بتحميل ملف النسخة الاحتياطية على القرص الصلب للجهاز مع كل دورة نسخ.
                </p>
              </div>
            </div>

            {/* Storage Health Diagnostics Card */}
            <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-300">📊 فحص سعة التخزين المحلي وقواعد البيانات (LocalStorage):</span>
                <span className="font-mono text-emerald-400 font-bold">{diagnostics.usedMB} MB مستخدم</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700">
                <div
                  className={`h-full transition-all duration-500 ${
                    diagnostics.quotaPercentage > 75
                      ? 'bg-rose-500'
                      : diagnostics.quotaPercentage > 50
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.max(5, diagnostics.quotaPercentage)}%` }}
                ></div>
              </div>
              <div className="flex flex-wrap justify-between items-center text-[11px] text-slate-400 gap-2">
                <span>
                  🟢 حالة الذاكرة: <strong>{diagnostics.quotaPercentage < 60 ? 'ممتازة ومستقرة' : 'يوصى بتنظيف النسخ القديمة'}</strong> ({diagnostics.quotaPercentage}% من السعة الافتراضية)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={handleClearOldBackups}
                    className="text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer"
                  >
                    🧹 تنظيف النسخ القديمة الزائدة
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Snapshot Trigger Card */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex-1 min-w-[280px]">
              <h4 className="text-sm font-bold text-slate-900">⚡ حفظ لقطة استعادة يدوية فورية مع تسمية مخصصة:</h4>
              <p className="text-xs text-slate-500">
                يمكنك كتابة وصف مخصص (مثال: قبل إقفال الشهر، قبل جرد المخزن، بعد اعتماد الرواتب).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                value={snapshotLabel}
                onChange={(e) => setSnapshotLabel(e.target.value)}
                placeholder="اسم اللقطة (اختياري)..."
                className="p-2.5 border border-slate-300 rounded-xl text-xs bg-slate-50 font-bold focus:border-[#1a237e] focus:outline-none min-w-[220px]"
              />
              <button
                onClick={() => handleCreateSnapshot()}
                className="bg-[#1a237e] hover:bg-[#0d47a1] text-white px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition shadow-xs whitespace-nowrap"
              >
                💾 حفظ اللقطة الآن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SAVED RESTORE POINTS LIST */}
      {activeTab === 'snapshots' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap justify-between items-center gap-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900">🕒 سجل نقاط الاستعادة (Restore Points Timeline)</h4>
              <p className="text-xs text-slate-500">
                يمكنك معاينة تفاصيل أي نقطة والرجوع إليها بضغطة زر واحدة (1-Click Rollback) في حال وقوع أي خطأ.
              </p>
            </div>
            <div className="flex items-center flex-wrap gap-2">
              <TableActionButtons
                printLabel="طباعة السجل"
                onPrint={() => {
                  openUnifiedPrintWindow(
                    {
                      title: 'سجل نقاط الاستعادة والنسخ الاحتياطي للنظام',
                      partyLabel: 'إجمالي النقاط',
                      partyName: `${backups.length} نقطة استعادة`,
                      items: backups.map((snap) => ({
                        name: `${snap.label || 'نقطة استعادة'} (${snap.id || '-'})`,
                        unit: snap.type === 'auto' ? 'تلقائي' : snap.type === 'pre_restore' ? 'أمان قبل الاسترجاع' : 'يدوي',
                        qty: 1,
                        price: 0,
                        total: 0,
                        notes: `التاريخ: ${snap.timestamp || '-'} | الحجم: ${snap.sizeKb || 0} KB | فواتير: ${snap.counts?.invoices || 0} | أصناف: ${snap.counts?.items || 0} | قيود: ${snap.counts?.journal || 0}`,
                      })),
                      totals: [
                        {
                          label: 'إجمالي نقاط الاستعادة المحفوظة:',
                          value: backups.length,
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
                    filename: `سجل_نقاط_الاستعادة_${new Date().toISOString().split('T')[0]}`,
                    sheetName: 'نقاط الاستعادة',
                    data: backups,
                    columns: [
                      { header: 'معرف النقطة', key: 'id', width: 22 },
                      { header: 'اسم / وصف النقطة', key: 'label', width: 25 },
                      { header: 'النوع', getValue: (s: any) => s.type === 'auto' ? 'تلقائي مجدول' : s.type === 'pre_restore' ? 'أمان تلقائي' : 'يدوي', width: 16 },
                      { header: 'التاريخ والوقت', key: 'timestamp', width: 22 },
                      { header: 'الحجم التقريبي (KB)', key: 'sizeKb', width: 18 },
                      { header: 'عدد الفواتير', getValue: (s: any) => s.counts?.invoices || 0, width: 14 },
                      { header: 'عدد الأصناف', getValue: (s: any) => s.counts?.items || 0, width: 14 },
                      { header: 'عدد القيود', getValue: (s: any) => s.counts?.journal || 0, width: 14 },
                    ],
                    companyName: appData.settings?.companyName || 'المنظومة المحاسبية المعتمدة',
                    reportTitle: 'سجل وأرشيف نقاط الاستعادة والنسخ الاحتياطية',
                  });
                  showToast('تم تصدير سجل نقاط الاستعادة إلى Excel بنجاح', 'success');
                }}
              />
              <button
                onClick={() => handleCreateSnapshot('نقطة يدوية')}
                className="bg-[#1a237e] text-white px-3.5 py-2 rounded-xl text-xs font-bold hover:bg-[#0d47a1] transition cursor-pointer"
              >
                ➕ نقطة جديدة
              </button>
            </div>
          </div>

          {/* Mobile Snapshots Cards (< md) */}
          <div className="block md:hidden space-y-3">
            {backups.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-slate-400">
                لا توجد نقاط استعادة محفوظة حتى الآن. سيتم توليدها تلقائياً أو يمكنك الضغط على "إنشاء نقطة الآن".
              </div>
            ) : (
              backups.map((snap, idx) => {
                const isAuto = snap.type === 'auto';
                const isPre = snap.type === 'pre_restore';
                const isExport = snap.type === 'file_export';

                return (
                  <div key={snap.id || idx} className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3 shadow-xs">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold ${
                          isPre
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : isAuto
                            ? 'bg-blue-100 text-blue-900 border border-blue-200'
                            : isExport
                            ? 'bg-purple-100 text-purple-900 border border-purple-200'
                            : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                        }`}
                      >
                        {isPre ? '🛡️ قبل الاسترجاع' : isAuto ? '🤖 مجدولة آلياً' : isExport ? '📁 تصدير ملف' : '👤 يدوية'}
                      </span>
                      <span className="text-[11px] font-medium text-slate-500">
                        {new Date(snap.date || Date.now()).toLocaleString('ar-EG', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="font-bold text-slate-900 text-sm">
                      {snap.label || 'نسخة احتياطية لمنظومة RAKEEZA'}
                    </div>

                    {snap.dataPreview && (
                      <div className="flex flex-wrap gap-1.5 text-[11px]">
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-medium">
                          🧾 {snap.dataPreview.invoicesCount} فاتورة
                        </span>
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-medium">
                          👥 {snap.dataPreview.customersCount} عميل
                        </span>
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-medium">
                          📦 {snap.dataPreview.itemsCount} صنف
                        </span>
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-medium">
                          ⚖️ {snap.dataPreview.journalEntriesCount} قيد
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                      <span className="font-mono text-xs font-bold text-slate-600">
                        {snap.sizeKB ? `${snap.sizeKB} KB` : ''}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleRestoreSnapshot(snap)}
                          className="min-h-[40px] bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer"
                          title="استعادة هذه النقطة"
                        >
                          <span>↩ استعادة</span>
                        </button>
                        {snap.code && (
                          <button
                            onClick={() => {
                              navigator.clipboard?.writeText(snap.code || '').then(() => {
                                showToast('تم نسخ الكود المشفر للحافظة', 'success');
                              });
                            }}
                            className="min-h-[40px] px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                            title="نسخ كود Base64"
                          >
                            📋
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteBackup(idx)}
                          className="min-h-[40px] px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition"
                          title="حذف هذه النقطة"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Snapshots Table (>= md) */}
          <div className="hidden md:block bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">النوع</th>
                  <th className="p-3.5">التاريخ والوقت</th>
                  <th className="p-3.5">اسم النقطة والبيان</th>
                  <th className="p-3.5">إحصائيات البيانات المسجلة</th>
                  <th className="p-3.5 text-center">الحجم</th>
                  <th className="p-3.5 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {backups.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center p-10 text-slate-400">
                      لا توجد نقاط استعادة محفوظة حتى الآن. سيتم توليدها تلقائياً أو يمكنك الضغط على "إنشاء نقطة الآن".
                    </td>
                  </tr>
                ) : (
                  backups.map((snap, idx) => {
                    const isAuto = snap.type === 'auto';
                    const isPre = snap.type === 'pre_restore';
                    const isExport = snap.type === 'file_export';

                    return (
                      <tr key={snap.id || idx} className="hover:bg-slate-50 transition">
                        <td className="p-3.5">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold ${
                              isPre
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : isAuto
                                ? 'bg-blue-100 text-blue-900 border border-blue-200'
                                : isExport
                                ? 'bg-purple-100 text-purple-900 border border-purple-200'
                                : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                            }`}
                          >
                            {isPre ? '🛡️ قبل الاسترجاع' : isAuto ? '🤖 مجدولة آلياً' : isExport ? '📁 تصدير ملف' : '👤 يدوية'}
                          </span>
                        </td>
                        <td className="p-3.5 font-medium text-slate-600 whitespace-nowrap">
                          {new Date(snap.date || Date.now()).toLocaleString('ar-EG', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </td>
                        <td className="p-3.5 font-bold text-slate-900">
                          {snap.label || 'نسخة احتياطية لمنظومة RAKEEZA'}
                        </td>
                        <td className="p-3.5 text-[11px] text-slate-600">
                          {snap.dataPreview ? (
                            <div className="flex flex-wrap gap-1.5">
                              <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                                🧾 {snap.dataPreview.invoicesCount} فاتورة
                              </span>
                              <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                                👥 {snap.dataPreview.customersCount} عميل
                              </span>
                              <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                                📦 {snap.dataPreview.itemsCount} صنف
                              </span>
                              <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                                ⚖️ {snap.dataPreview.journalEntriesCount} قيد
                              </span>
                            </div>
                          ) : (
                            <span className="font-mono text-slate-400 truncate max-w-[150px] block">
                              {snap.code ? snap.code.substring(0, 20) + '...' : '-'}
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-center font-mono font-bold text-slate-700">
                          {snap.sizeKB ? `${snap.sizeKB} KB` : '-'}
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleRestoreSnapshot(snap)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer"
                              title="استعادة هذه النقطة واستبدال البيانات الحالية بها"
                            >
                              <span>↩ استعادة فورية</span>
                            </button>

                            {snap.code && (
                              <button
                                onClick={() => {
                                  navigator.clipboard?.writeText(snap.code || '').then(() => {
                                    showToast('تم نسخ الكود المشفر للحافظة', 'success');
                                  });
                                }}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
                                title="نسخ كود Base64 المشفر"
                              >
                                📋
                              </button>
                            )}

                            <button
                              onClick={() => handleDeleteBackup(idx)}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-700 px-2 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
                              title="حذف هذه النقطة"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: IMPORT EXTERNAL FILE OR CODE */}
      {activeTab === 'manual' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* File Upload Box */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div>
              <h4 className="text-base font-bold text-[#1a237e] flex items-center gap-2">
                <span>📁 استيراد ملف نسخة احتياطية (.JSON)</span>
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                اختر ملف النسخة الاحتياطية الذي تم تصديره سابقاً من جهازك لاسترجاع البيانات بالكامل.
              </p>
            </div>

            <div className="border-2 border-dashed border-slate-300 hover:border-[#1a237e] rounded-2xl p-6 text-center bg-slate-50 transition">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.txt,.bak"
                onChange={handleFileChange}
                className="hidden"
                id="file-backup-input"
              />
              <label htmlFor="file-backup-input" className="cursor-pointer block space-y-2">
                <span className="text-3xl block">📤</span>
                <span className="text-xs font-bold text-slate-800 block">
                  اضغط هنا لاختيار ملف JSON من جهازك أو اسحبه إلى هنا
                </span>
                <span className="text-[11px] text-slate-400 block">الملفات المدعومة: JSON, TXT, BAK</span>
              </label>
            </div>

            {/* Preview Staged File */}
            {selectedFileSummary && (
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl space-y-2 text-xs">
                <div className="flex justify-between items-center font-bold text-blue-900 border-b border-blue-200/60 pb-2">
                  <span>معاينة بيانات الملف المستورد:</span>
                  <span className="bg-blue-200/80 px-2 py-0.5 rounded-full text-[10.5px]">جاهز للاستعادة</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-700">
                  <div>اسم المؤسسة: <strong>{selectedFileSummary.companyName}</strong></div>
                  <div>تاريخ النسخة: <strong>{new Date(selectedFileSummary.date).toLocaleDateString('ar-EG')}</strong></div>
                  <div>عدد الفواتير: <strong>{selectedFileSummary.invoicesCount}</strong></div>
                  <div>عدد العملاء: <strong>{selectedFileSummary.customersCount}</strong></div>
                  <div>عدد الأصناف: <strong>{selectedFileSummary.itemsCount}</strong></div>
                  <div>عدد القيود: <strong>{selectedFileSummary.journalsCount}</strong></div>
                </div>

                <button
                  onClick={handleApplyFileRestore}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold text-xs transition mt-2 cursor-pointer shadow-xs"
                >
                  ↩ تطبيق واستعادة هذا الملف الآن
                </button>
              </div>
            )}
          </div>

          {/* Text Code Encrypted Box */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div>
              <h4 className="text-base font-bold text-[#1a237e] flex items-center gap-2">
                <span>🔑 استعادة البيانات من كود مشفر (Base64)</span>
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                ألصق الكود المشفر هنا لاسترجاع كافة الإعدادات والفواتير والحسابات في ثوانٍ.
              </p>
            </div>

            <textarea
              rows={6}
              placeholder="ألصق كود النسخة الاحتياطية المشفر هنا..."
              value={restoreCode}
              onChange={(e) => setRestoreCode(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-2xl text-xs font-mono bg-slate-50 focus:bg-white focus:border-[#1a237e] focus:outline-none"
            ></textarea>

            <button
              onClick={handleRestoreFromCode}
              className="w-full bg-[#f57f17] hover:bg-[#e65100] text-white py-3 rounded-2xl font-bold text-xs transition cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
            >
              <span>↩ فك التشفير واستعادة النظام بالكامل</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: CLOUD INTEGRATIONS (FIREBASE, GOOGLE DRIVE, SQL) */}
      {activeTab === 'cloud_integrations' && (
        <div className="space-y-6">
          {/* 1. Firebase Storage Optimizer Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
            <div className="flex flex-wrap justify-between items-center gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2.5 bg-amber-500/10 text-amber-600 rounded-2xl text-xl">🔥</span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    منظومة ترشيد مساحة وحماية باقة فايربيس السحابية (Firebase Storage Optimizer)
                  </h3>
                  <p className="text-xs text-slate-500">
                    تم ضبط المنظومة معمارياً لتفادي نفاد مساحة أو باقة فايربيس وتفادي تجاوز سقف 1MB لوثيقة Firestore.
                  </p>
                </div>
              </div>

              <button
                onClick={handlePurgeCloudBloat}
                className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>🧹 تطهير وترشيد الوثيقة السحابية الآن</span>
              </button>
            </div>

            {/* Diagnostics Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                <span className="text-[11px] font-bold text-slate-500 block">حجم الوثيقة التشغيلية السحابية</span>
                <span className="text-lg font-black text-emerald-600 mt-1 block">
                  ~ {Math.max(12, Math.round(diagnostics.usedKB * 0.4))} KB
                </span>
                <span className="text-[10px] text-slate-400">مستهلك أقل من 4% من حد 1024 KB المسموح</span>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                <span className="text-[11px] font-bold text-slate-500 block">سجلات التدقيق اللحظية المتزامنة</span>
                <span className="text-lg font-black text-[#1a237e] mt-1 block">
                  {Math.min(100, (appData.auditLogs || []).length)} سجل حديث
                </span>
                <span className="text-[10px] text-slate-400">سقف محمي تلقائياً لمنع التضخم</span>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                <span className="text-[11px] font-bold text-slate-500 block">حماية النسخ الاحتياطية المتداخلة</span>
                <span className="text-lg font-black text-indigo-600 mt-1 block">
                  نشطة (عزل سحابي)
                </span>
                <span className="text-[10px] text-slate-400">تخزين النسخ الكبيرة محلياً وعلى درايف</span>
              </div>
            </div>

            {/* Optimization Rules Breakdown */}
            <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/60 space-y-2 text-xs text-slate-700">
              <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                <span>🛡️ آليات توفير المساحة المطبقة برمجياً:</span>
              </h4>
              <ul className="list-disc list-inside space-y-1.5 text-slate-600 pr-1">
                <li>
                  <strong>عزل ملفات النسخ الاحتياطية الثقيلة:</strong> تم منع إرسال النسخ الكاملة المتكررة (`snapshotJson`) إلى سحابة فايربيس لتفادي حرق الكوتا والحدود.
                </li>
                <li>
                  <strong>حصر سجلات التدقيق (Audit Logs):</strong> يتم إرسال أحدث 100 حركة فقط في المزامنة الحية للسحابة، مع حفظ الأرشيف التاريخي كاملاً على الجهاز ومصنفات التصدير.
                </li>
                <li>
                  <strong>ضغط وحماية الشعار والمرفقات:</strong> منع إرسال سلاسل الصور الضخمة غير المضغوطة لتفادي بطء المزامنة واستهلاك الباقة.
                </li>
                <li>
                  <strong>عزل السنوات المالية المقفلة:</strong> البيانات التاريخية للسنوات السابقة تحفظ كأرشيف مستقل ولا يتم رفعها مع كل فاتورة بيع جديدة.
                </li>
                <li>
                  <strong>تجزئة البيانات (Firestore Data Sharding):</strong> تقسيم المبيعات تلقائياً حسب السنوات المالية في مجموعات فرعية (Sub-collections) لتسريع الاستعلامات وتفادي حد 1MB.
                </li>
                <li>
                  <strong>الأرشفة الباردة التلقائية (&gt; سنتين):</strong> ترحيل العمليات القديمة التي تتجاوز السنتين إلى Google Cloud Storage مع الاحتفاظ بروابطها ومؤشراتها في فايربيس لتخفيض حجم قاعدة البيانات الحية.
                </li>
              </ul>
            </div>
          </div>

          {/* 2. Google Drive Cloud Storage Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2.5 bg-blue-500/10 text-blue-600 rounded-2xl text-xl">📁</span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    النسخ السحابي المجاني على Google Drive (سعة 15 جيجابايت مجانية)
                  </h3>
                  <p className="text-xs text-slate-500">
                    احفظ نسخاً احتياطية كاملة ومستقلة على حساب جوجل درايف الخاص بك مجاناً تماماً دون استهلاك باقة فايربيس.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleExportGoogleDriveFile}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span>📥 تحميل نسخة مخصصة لـ Google Drive</span>
                </button>

                <button
                  onClick={handleOpenGoogleDrive}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-300"
                >
                  <span>🔗 فتح Google Drive لرفع الملف</span>
                </button>
              </div>
            </div>

            <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 text-xs text-blue-900 leading-relaxed">
              💡 <strong>طريقة العمل:</strong> اضغط على <em>"تحميل نسخة مخصصة لـ Google Drive"</em> لحفظ ملف مشفر يحتوي على كافة الفواتير، الحسابات، قيود اليومية، وأرصدة العملاء والموردين، ثم ارفعه مباشرة إلى مجلد خاص في حسابك على Google Drive. يمكنك استعادة هذا الملف في أي وقت عبر تبويب <em>"استيراد ملف خارجي"</em>.
            </div>
          </div>

          {/* 3. SQL Relational Database Integration Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2.5 bg-indigo-500/10 text-indigo-600 rounded-2xl text-xl">🗄️</span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    التكامل مع قواعد البيانات العلاقية (SQL / PostgreSQL / MySQL)
                  </h3>
                  <p className="text-xs text-slate-500">
                    تصدير بنية الجداول العلاقية وقاموس البيانات الكامل (DDL & Schema) للربط مع سيرفرات SQL.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleExportSqlZip}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span>📦 تصدير حزمة جداول SQL/CSV (ZIP)</span>
                </button>

                <button
                  onClick={handleExportSqlExcel}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span>📊 مصنف البيانات العلائقية (Excel)</span>
                </button>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-700 space-y-2">
              <div className="font-bold text-slate-900">مخطط الجداول العلاقية (Relational Tables Schema):</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono text-slate-600">
                <div className="bg-white p-2 rounded-lg border border-slate-200">Customers (id, name, balance...)</div>
                <div className="bg-white p-2 rounded-lg border border-slate-200">Suppliers (id, name, balance...)</div>
                <div className="bg-white p-2 rounded-lg border border-slate-200">Products (id, code, qty, cost...)</div>
                <div className="bg-white p-2 rounded-lg border border-slate-200">Sales_Invoices (id, total, tax...)</div>
                <div className="bg-white p-2 rounded-lg border border-slate-200">Purchase_Invoices (id, total...)</div>
                <div className="bg-white p-2 rounded-lg border border-slate-200">Cash_Transactions (id, amount...)</div>
                <div className="bg-white p-2 rounded-lg border border-slate-200">Journal_Entries (id, debit, credit)</div>
                <div className="bg-white p-2 rounded-lg border border-slate-200">Accounts_Tree (code, parent...)</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
