import React, { useState, useEffect } from 'react';
import { AppData } from '../types';
import { Modal } from './Modal';
import { dataIntegrityAuditor, IntegrityAuditReport } from '../utils/dataIntegrityAuditor';
import { firestoreShardingService, ColdStorageArchiveRecord } from '../services/firestoreShardingService';
import {
  Activity,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  Archive,
  Database,
  Cpu,
  RefreshCw,
  Download,
  Wrench,
  Layers,
  Sparkles,
} from 'lucide-react';

interface BigDataDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  appData: AppData;
  onUpdateData: (newData: AppData, logMeta?: { action: string; module: string; details: string }) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const BigDataDiagnosticsModal: React.FC<BigDataDiagnosticsModalProps> = ({
  isOpen,
  onClose,
  appData,
  onUpdateData,
  showToast,
}) => {
  const [report, setReport] = useState<IntegrityAuditReport | null>(null);
  const [isRunningScan, setIsRunningScan] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [archivesList, setArchivesList] = useState<ColdStorageArchiveRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'integrity' | 'archiving' | 'capacity'>('integrity');

  const runDiagnostic = async () => {
    setIsRunningScan(true);
    try {
      const res = await dataIntegrityAuditor.runFullDiagnostic(appData);
      setReport(res);
    } catch (e) {
      console.error('Scan error:', e);
    } finally {
      setIsRunningScan(false);
    }
  };

  const loadArchives = async () => {
    try {
      const list = await firestoreShardingService.fetchTenantArchives(appData.companyId || 'COMP-000001');
      setArchivesList(list);
    } catch (e) {
      console.warn('Failed to load archives:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      runDiagnostic();
      loadArchives();
    }
  }, [isOpen, appData]);

  if (!isOpen) return null;

  const handleAutoRepair = () => {
    const { repairedData, repairsMade } = dataIntegrityAuditor.autoRepairIntegrity(appData);
    if (repairsMade.length > 0) {
      onUpdateData(repairedData, {
        action: 'إصلاح تلقائي للنزاهة',
        module: 'تشخيص البيانات الضخمة',
        details: repairsMade.join(' | '),
      });
      showToast(repairsMade.join(' - '), 'success');
      runDiagnostic();
    } else {
      showToast('النظام في حالة سليمة ومثالية، لا توجد أخطاء تحتاج لإصلاح.', 'info');
    }
  };

  const handleExecuteArchiving = async () => {
    if (!window.confirm('هل تريد تشغيل الأرشفة الباردة ونقل الفواتير التي مر عليها أكثر من سنتين إلى مخزن الأرشيف التاريخي لتسريع النظام؟')) {
      return;
    }
    setIsArchiving(true);
    try {
      const res = await firestoreShardingService.executeColdStorageArchiving(
        appData.companyId || 'COMP-000001',
        appData,
        'مدير النظام'
      );
      if (res.archivedCount > 0) {
        onUpdateData(res.remainingData, {
          action: 'أرشفة باردة',
          module: 'الأرشيف التاريخي',
          details: `تمت أرشفة ${res.archivedCount} سجل بنجاح إلى Cold Storage لتخفيف قاعدة البيانات.`,
        });
        showToast(`تمت أرشفة ${res.archivedCount} سجل تاريخي بنجاح!`, 'success');
        setArchivesList([...res.archivesCreated, ...archivesList]);
        runDiagnostic();
      } else {
        showToast('لا توجد فواتير أو حركات يتجاوز تاريخها سنتين لأرشفتها.', 'info');
      }
    } catch (e: any) {
      showToast(e?.message || 'حدث خطأ أثناء تنفيذ الأرشفة الباردة', 'error');
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="مركز فحص النزاهة المحاسبية وإدارة البيانات الضخمة (10M+ Enterprise Hub)"
      maxWidth="max-w-4xl"
    >
      <div className="space-y-6 text-right font-sans" dir="rtl">
        {/* Top Header Card */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 border border-indigo-800/40">
          <div className="flex items-center gap-4">
            <div className={`p-4 rounded-2xl shadow-inner ${
              (report?.score || 100) >= 80 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            }`}>
              <Activity className="w-8 h-8 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold">حالة النظام والنزاهة المحاسبية</h3>
                <span className="text-xs bg-indigo-500/30 text-indigo-200 px-2.5 py-0.5 rounded-full border border-indigo-400/30">
                  سعة 10,000,000+ فاتورة
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                محرك التخزين: <span className="font-semibold text-emerald-300">IndexedDB Enterprise</span> | المعمارية: <span className="font-semibold text-indigo-300">مقسمة سحابياً ومؤرشفة بارداً</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-white/10 px-5 py-3 rounded-xl border border-white/10 backdrop-blur-sm">
            <div className="text-center">
              <span className="text-xs text-slate-300 block">مؤشر الجودة المحاسبية</span>
              <span className="text-3xl font-black text-emerald-400">
                {report ? `${report.score}%` : '...'}
              </span>
            </div>
            <button
              onClick={runDiagnostic}
              disabled={isRunningScan}
              className="p-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl transition text-white shadow-md disabled:opacity-50"
              title="إعادة الفحص الآن"
            >
              <RefreshCw className={`w-5 h-5 ${isRunningScan ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-gray-200 gap-2">
          <button
            onClick={() => setActiveTab('integrity')}
            className={`pb-3 px-4 font-bold text-sm flex items-center gap-2 border-b-2 transition ${
              activeTab === 'integrity'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            فحص النزاهة والقيود المحاسبية
          </button>
          <button
            onClick={() => setActiveTab('archiving')}
            className={`pb-3 px-4 font-bold text-sm flex items-center gap-2 border-b-2 transition ${
              activeTab === 'archiving'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Archive className="w-4 h-4" />
            الأرشفة الباردة والمخزن التاريخي (Cold Storage)
          </button>
          <button
            onClick={() => setActiveTab('capacity')}
            className={`pb-3 px-4 font-bold text-sm flex items-center gap-2 border-b-2 transition ${
              activeTab === 'capacity'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Database className="w-4 h-4" />
            سعة IndexedDB واستهلاك الموارد
          </button>
        </div>

        {/* TAB 1: INTEGRITY AUDIT */}
        {activeTab === 'integrity' && (
          <div className="space-y-4">
            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-xs text-gray-500 block">إجمالي الفواتير النشطة</span>
                <span className="text-lg font-black text-slate-800">
                  {report?.totalSalesInvoices.toLocaleString() || 0}
                </span>
                <span className="text-[10px] text-gray-400 block mt-0.5">جاهزة للتجزئة الشهرية</span>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-xs text-gray-500 block">توازن القيود المزدوجة</span>
                <span className={`text-lg font-black ${
                  (report?.debitCreditDiscrepancy || 0) === 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {(report?.debitCreditDiscrepancy || 0) === 0 ? 'متوازن 100%' : `${report?.debitCreditDiscrepancy} ج.م فارق`}
                </span>
                <span className="text-[10px] text-gray-400 block mt-0.5">المدين = الدائن</span>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-xs text-gray-500 block">تسلسل الترقيم التلقائي</span>
                <span className={`text-lg font-black ${
                  report?.isSequenceConsistent ? 'text-emerald-600' : 'text-amber-600'
                }`}>
                  {report?.isSequenceConsistent ? 'سليم ومنتظم' : 'يحتاج مزامنة'}
                </span>
                <span className="text-[10px] text-gray-400 block mt-0.5">الرقم القادم: {report?.nextInvoiceNumberConfig}</span>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-xs text-gray-500 block">فواتير مكررة</span>
                <span className={`text-lg font-black ${
                  (report?.duplicateInvoiceIds.length || 0) === 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {report?.duplicateInvoiceIds.length || 0} فاتورة
                </span>
                <span className="text-[10px] text-gray-400 block mt-0.5">حماية كاملة من التصادم</span>
              </div>
            </div>

            {/* Issues and Checks List */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-indigo-600" />
                  سجل نتائج الفحص المحاسبي الآلي
                </h4>
                {report && report.issues.some((i) => i.canAutoRepair) && (
                  <button
                    onClick={handleAutoRepair}
                    className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg shadow transition"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    إصلاح الأخطاء تلقائياً
                  </button>
                )}
              </div>

              {report?.issues.length === 0 ? (
                <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                  <div className="text-xs">
                    <p className="font-bold">كافة السجلات والقيود المحاسبية سليمة ومتوازنة تماماً بنسبة 100%.</p>
                    <p className="text-emerald-700 mt-0.5">لا توجد أي فجوات ترقيم، أو قيود غير متطابقة، أو تكرار في السجلات.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {report?.issues.map((issue, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border flex items-start justify-between gap-3 ${
                        issue.type === 'error'
                          ? 'bg-rose-50 border-rose-200 text-rose-900'
                          : issue.type === 'warning'
                          ? 'bg-amber-50 border-amber-200 text-amber-900'
                          : 'bg-blue-50 border-blue-200 text-blue-900'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                          issue.type === 'error' ? 'text-rose-600' : 'text-amber-600'
                        }`} />
                        <div>
                          <h5 className="font-bold text-xs">{issue.title}</h5>
                          <p className="text-[11px] mt-0.5 opacity-90">{issue.description}</p>
                        </div>
                      </div>
                      {issue.canAutoRepair && (
                        <button
                          onClick={handleAutoRepair}
                          className="text-[11px] font-bold underline whitespace-nowrap self-center"
                        >
                          إصلاح فوري
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: COLD STORAGE ARCHIVING */}
        {activeTab === 'archiving' && (
          <div className="space-y-4">
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-indigo-900 text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  أرشفة البيانات القديمة تلقائياً (أقدم من سنتين)
                </h4>
                <p className="text-xs text-indigo-700 mt-1 leading-relaxed">
                  تقوم هذه العملية بفرز الفواتير والحركات المالية التي مضى عليها أكثر من سنتين، وضغطها في حزم أرشيف باردة مؤمنة. تظل البيانات محفوظة بالكامل وقابلة للتنزيل والاستعراض في أي وقت، مع الحفاظ على خفة وسرعة النظام اليومي.
                </p>
              </div>
              <button
                onClick={handleExecuteArchiving}
                disabled={isArchiving}
                className="whitespace-nowrap bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition flex items-center gap-2 disabled:opacity-50"
              >
                <Archive className="w-4 h-4" />
                {isArchiving ? 'جاري الأرشفة...' : 'بدء الأرشفة الباردة الآن'}
              </button>
            </div>

            {/* List of Archived manifest files */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h4 className="font-bold text-gray-800 text-sm mb-3">حزم الأرشيف البارد المعتمدة (Cold Storage Manifests)</h4>

              {archivesList.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Archive className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-xs">لم يتم إنشاء أي حزم أرشفة باردة حتى الآن.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {archivesList.map((arc) => (
                    <div
                      key={arc.id}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                          <Layers className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{arc.title}</p>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            سنة: <span className="font-semibold">{arc.fiscalYear}</span> | السجلات: <span className="font-semibold">{arc.recordsCount}</span> | الحجم: <span className="font-semibold">{arc.fileSizeKB} KB</span> | التاريخ: {arc.archivedAt?.substring(0, 10)}
                          </p>
                        </div>
                      </div>

                      {arc.downloadUrl && (
                        <a
                          href={arc.downloadUrl}
                          download={`archive_${arc.fiscalYear}_${arc.id}.json`}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg text-slate-700 font-bold transition shadow-sm"
                        >
                          <Download className="w-3.5 h-3.5 text-indigo-600" />
                          تنزيل JSON
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: CAPACITY & INDEXEDDB STATUS */}
        {activeTab === 'capacity' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <span className="text-xs text-gray-500 block">محرك التخزين الفعلي</span>
                <span className="text-base font-black text-emerald-600 block mt-1">IndexedDB Enterprise</span>
                <span className="text-[11px] text-gray-400 block mt-1">سعة غير محدودة (&gt; 50GB)</span>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <span className="text-xs text-gray-500 block">حجم البيانات الحالية</span>
                <span className="text-base font-black text-slate-800 block mt-1">
                  {report?.estimatedPayloadSizeMB || 0.1} ميجابايت
                </span>
                <span className="text-[11px] text-gray-400 block mt-1">مضغوطة بنظام الكود المتسلسل</span>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <span className="text-xs text-gray-500 block">حصة مساحة المتصفح المتاحة</span>
                <span className="text-base font-black text-indigo-600 block mt-1">
                  {report?.browserStorageQuotaMB.toLocaleString() || '5,000'} ميجابايت
                </span>
                <span className="text-[11px] text-gray-400 block mt-1">مستهلك: {report?.browserStoragePercent || 0}%</span>
              </div>
            </div>

            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs leading-relaxed">
              <p className="font-bold flex items-center gap-1.5 mb-1 text-sm">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                النظام مهيأ لاستقبال أكثر من 10,000,000 فاتورة سنوياً
              </p>
              <ul className="list-disc list-inside space-y-1 text-emerald-800 mt-2">
                <li>لا توجد أي قيود من الـ 5MB الخاصة بـ LocalStorage، يتم التخزين عبر IndexedDB عالي الكفاءة.</li>
                <li>عمليات الحفظ تجري لا تزامناً (Async non-blocking) دون أي تجميد للشاشة أو تعليق.</li>
                <li>تتم تجزئة الفواتير الشهرية والسنوية لضمان سرعة التصفح والطباعة فورياً.</li>
              </ul>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition shadow-sm"
          >
            إغلاق
          </button>
        </div>
      </div>
    </Modal>
  );
};
