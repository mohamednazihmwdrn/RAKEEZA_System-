import React, { useState, useEffect } from 'react';
import { AppData, FiscalYearClosingRecord, FiscalYearInfo, SaleInvoice } from '../types';
import { Modal } from './Modal';
import { firestoreShardingService, ShardedFiscalYearSummary } from '../services/firestoreShardingService';
import { Calendar, Lock, Unlock, CloudDownload, Printer, CheckCircle, RefreshCw, BarChart2, ShieldCheck, ArrowRight } from 'lucide-react';

const formatCurrency = (val: number, currency: string = 'ج.م') => {
  return `${Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
};

interface FiscalYearSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  appData: AppData;
  onUpdateData: (newData: AppData, logMeta?: { action: string; module: string; details: string }) => void;
  showToast?: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onNavigateToReports?: (fiscalYear?: string) => void;
}

export const FiscalYearSelectorModal: React.FC<FiscalYearSelectorModalProps> = ({
  isOpen,
  onClose,
  appData,
  onUpdateData,
  showToast,
  onNavigateToReports,
}) => {
  const companyId = appData.companyId || 'COMP-000001';
  const currentActiveYear = appData.currentActiveFiscalYear || appData.settings?.fiscalYear || `${new Date().getFullYear()}`;
  const viewingClosedYear = appData.viewingClosedYear;

  const [isLoadingSummaries, setIsLoadingSummaries] = useState(false);
  const [remoteSummaries, setRemoteSummaries] = useState<ShardedFiscalYearSummary[]>([]);
  const [loadingYearData, setLoadingYearData] = useState<string | null>(null);

  // Fetch remote shard summaries from Firestore when opened
  useEffect(() => {
    if (isOpen) {
      setIsLoadingSummaries(true);
      firestoreShardingService
        .fetchAllFiscalYearSummaries(companyId)
        .then((sums) => {
          setRemoteSummaries(sums);
        })
        .catch((err) => {
          console.warn('[FiscalYears] Error fetching remote summaries:', err);
        })
        .finally(() => {
          setIsLoadingSummaries(false);
        });
    }
  }, [isOpen, companyId]);

  if (!isOpen) return null;

  const availableYears: FiscalYearInfo[] = firestoreShardingService.getAvailableFiscalYearsList(
    companyId,
    appData,
    remoteSummaries
  );

  // Switch to review a closed fiscal year
  const handleSwitchToClosedYear = async (targetYear: string) => {
    try {
      setLoadingYearData(targetYear);

      // Check if we need to pull sharded sales from Firestore
      const hasLocalSales = (appData.salesInvoices || []).some(
        (inv) => (inv.date || '').startsWith(targetYear)
      );

      let updatedInvoices = [...(appData.salesInvoices || [])];

      if (!hasLocalSales) {
        showToast?.(`جاري استدعاء سجلات السنة (${targetYear}) من خوادم فايربيس السحابية...`, 'info');
        const comprehensive = await firestoreShardingService.fetchClosedFiscalYearComprehensiveData(
          companyId,
          targetYear,
          appData
        );
        if (comprehensive.salesInvoices.length > 0) {
          // Merge sales invoices without duplicates
          const map = new Map<string, SaleInvoice>();
          updatedInvoices.forEach((i) => map.set(String(i.id), i));
          comprehensive.salesInvoices.forEach((i) => map.set(String(i.id), i));
          updatedInvoices = Array.from(map.values());
        }
      }

      const updatedData: AppData = {
        ...appData,
        salesInvoices: updatedInvoices,
        viewingClosedYear: targetYear,
        currentActiveFiscalYear: currentActiveYear,
      };

      onUpdateData(updatedData, {
        action: 'تبديل سنة مالية',
        module: 'السنوات المالية',
        details: `بدء تصفح ومراجعة سجلات وتقارير السنة المالية المغلقة ${targetYear}`,
      });

      showToast?.(`تم التبديل بنجاح لمراجعة وطباعة تقارير السنة المالية المغلقة (${targetYear})`, 'success');
      onClose();

      if (onNavigateToReports) {
        onNavigateToReports(targetYear);
      }
    } catch (err: any) {
      console.error('[FiscalYear] Error switching year:', err);
      showToast?.('حدث خطأ أثناء تحميل بيانات السنة المغلقة', 'error');
    } finally {
      setLoadingYearData(null);
    }
  };

  // Return to live active year
  const handleReturnToActiveYear = () => {
    const updatedData: AppData = {
      ...appData,
      viewingClosedYear: undefined,
    };

    onUpdateData(updatedData, {
      action: 'تبديل سنة مالية',
      module: 'السنوات المالية',
      details: `العودة إلى السنة المالية النشطة الجارية ${currentActiveYear}`,
    });

    showToast?.(`تمت العودة بنجاح إلى السنة المالية النشطة الجارية (${currentActiveYear})`, 'success');
    onClose();
  };

  // Pull records from Firestore shard on demand
  const handleFetchCloudRecords = async (year: string) => {
    try {
      setLoadingYearData(year);
      showToast?.(`جاري استدعاء سجلات ${year} من فايربيس السحابية...`, 'info');
      const comprehensive = await firestoreShardingService.fetchClosedFiscalYearComprehensiveData(
        companyId,
        year,
        appData
      );

      const map = new Map<string, SaleInvoice>();
      (appData.salesInvoices || []).forEach((i) => map.set(String(i.id), i));
      comprehensive.salesInvoices.forEach((i) => map.set(String(i.id), i));

      const updatedData: AppData = {
        ...appData,
        salesInvoices: Array.from(map.values()),
      };

      onUpdateData(updatedData, {
        action: 'استدعاء سحابي',
        module: 'السنوات المالية',
        details: `تحميل ${comprehensive.salesInvoices.length} فاتورة سنة ${year} من فايربيس`,
      });

      showToast?.(`تم استدعاء ${comprehensive.salesInvoices.length} سجل من السحابة بنجاح`, 'success');
    } catch (e: any) {
      showToast?.('تعذر استدعاء السجلات من السحابة', 'error');
    } finally {
      setLoadingYearData(null);
    }
  };

  // Print Official Certified Closing Dossier
  const handlePrintClosingDossier = (record: FiscalYearClosingRecord) => {
    const company = appData.settings || {};
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast?.('يرجى السماح بالنوافذ المنبثقة للطباعة', 'warning');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>محضر إقفال السنة المالية ${record.fiscalYear} - معتمد</title>
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; color: #1e293b; margin: 0; padding: 20px; font-size: 13px; line-height: 1.6; }
          .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
          .title { font-size: 20px; font-weight: 900; color: #0f172a; margin: 5px 0; }
          .subtitle { font-size: 13px; color: #475569; }
          .badge { display: inline-block; background: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 999px; font-weight: bold; font-size: 11px; margin-top: 5px; border: 1px solid #fde68a; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
          .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; background: #f8fafc; }
          .card-title { font-weight: 800; font-size: 14px; margin-bottom: 8px; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
          .row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #e2e8f0; }
          .label { color: #64748b; font-weight: 600; }
          .val { font-weight: bold; color: #0f172a; direction: ltr; }
          .positive { color: #15803d; }
          .negative { color: #b91c1c; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: right; }
          th { background: #f1f5f9; font-weight: 800; }
          .footer { margin-top: 40px; display: flex; justify-content: space-between; padding-top: 20px; border-top: 1px solid #cbd5e1; font-weight: bold; }
          .sign-box { text-align: center; width: 200px; }
          .sign-line { margin-top: 40px; border-top: 1px dashed #94a3b8; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="font-size: 18px; font-weight: 900;">${appData.settings?.companyName || 'منظومة ركيزة السحابية'}</div>
          <div class="title">محضر إقفال السنة المالية والحسابات الختامية المعتمدة</div>
          <div class="subtitle">السنة المالية: ${record.fiscalYear} | الترحيل إلى: ${record.nextFiscalYear}</div>
          <span class="badge">🔒 محضر رسمي نهائي معتمد وموثق سحابياً</span>
        </div>

        <div class="grid">
          <div class="card">
            <div class="card-title">📊 نتائج الأعمال وقائمة الدخل (P&L)</div>
            <div class="row"><span class="label">إجمالي الإيرادات والمبيعات:</span><span class="val">${formatCurrency(record.totalRevenues)}</span></div>
            <div class="row"><span class="label">إجمالي المصروفات وتكلفة المبيعات:</span><span class="val">${formatCurrency(record.totalExpenses)}</span></div>
            <div class="row" style="font-size: 15px; background: #e2e8f0; padding: 6px 4px; border-radius: 4px; margin-top: 6px;">
              <span class="label" style="color: #0f172a;">صافي النتيجة (أرباح / خسائر):</span>
              <span class="val ${record.netProfitOrLoss >= 0 ? 'positive' : 'negative'}">${formatCurrency(record.netProfitOrLoss)}</span>
            </div>
            <div class="row"><span class="label">حساب الترحيل وحقوق الملكية:</span><span class="val" style="direction: rtl;">${record.closedToAccountName} (${record.closedToAccountCode})</span></div>
          </div>

          <div class="card">
            <div class="card-title">⚖️ الميزانية العمومية والمركز المالي عند الإقفال</div>
            <div class="row"><span class="label">تقييم بضاعة آخر المدة (المخزون):</span><span class="val">${formatCurrency(record.inventoryValueAtClosing)}</span></div>
            <div class="row"><span class="label">إجمالي الأصول والموجودات:</span><span class="val">${formatCurrency(record.totalAssetsAtClosing)}</span></div>
            <div class="row"><span class="label">إجمالي الالتزامات والخصوم:</span><span class="val">${formatCurrency(record.totalLiabilitiesAtClosing)}</span></div>
            <div class="row"><span class="label">إجمالي حقوق الملكية:</span><span class="val">${formatCurrency(record.totalEquityAtClosing)}</span></div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">📑 بيانات التوثيق المحاسبي والقيود اليومية</div>
          <div class="grid" style="margin-bottom: 0;">
            <div>
              <div class="row"><span class="label">رقم قيد الإقفال السنوي:</span><span class="val">#${record.closingJournalEntryId}</span></div>
              <div class="row"><span class="label">تاريخ ووقت اعتماد الإقفال:</span><span class="val" style="direction: rtl;">${new Date(record.closedAt).toLocaleString('ar-EG')}</span></div>
            </div>
            <div>
              <div class="row"><span class="label">المسؤول عن الإقفال والاعتماد:</span><span class="val" style="direction: rtl;">${record.closedBy}</span></div>
              <div class="row"><span class="label">ملاحظات المحضر:</span><span class="val" style="direction: rtl;">${record.notes || 'تم الإقفال بنجاح وفق المعايير المحاسبية المعتمدة'}</span></div>
            </div>
          </div>
        </div>

        <div class="footer">
          <div class="sign-box">
            <div>المحاسب المالي المسؤول</div>
            <div class="sign-line"></div>
          </div>
          <div class="sign-box">
            <div>المدير المالي / مراجع الحسابات</div>
            <div class="sign-line"></div>
          </div>
          <div class="sign-box">
            <div>اعتماد الإدارة العليا</div>
            <div class="sign-line"></div>
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 400);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="📅 إدارة وتصفح السنوات المالية ومراجعة الدفاتر المقفلة"
    >
      <div className="space-y-5 text-right font-sans" dir="rtl">
        {/* Enterprise Explanation Banner */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-4 rounded-2xl border border-blue-500/30 shadow-md">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-300 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="space-y-1 text-xs sm:text-sm">
              <h4 className="font-extrabold text-base text-blue-200">
                هندسة البيانات المؤسسية لقواعد البيانات السحابية الضخمة (Multi-Year Cloud Sharding)
              </h4>
              <p className="text-slate-300 leading-relaxed">
                تتيح لك المنظومة الانتقال بمرونة تامة إلى <strong>أي سنة مالية مقفلة سابقة</strong> لمراجعة الحسابات، وتدقيق العمليات، واستخراج وطباعة كافة التقارير المالية والضريبية بدقة متناهية، مع الحفاظ على سرعة واستقرار قاعدة البيانات عبر تقسيم البيانات آلياً في فايربيس (Sub-collections) والأرشفة السحابية.
              </p>
            </div>
          </div>
        </div>

        {/* Current Status Pill */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-100 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <span className="font-bold text-slate-700">السنة المالية النشطة الجارية:</span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-black text-xs">
              {currentActiveYear} (نشطة - كتابة وترحيل)
            </span>
          </div>

          {viewingClosedYear ? (
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-lg bg-amber-500 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-xs animate-pulse">
                <Lock className="w-3.5 h-3.5" />
                أنت تتصفح حالياً السنة المغلقة: {viewingClosedYear}
              </span>
              <button
                type="button"
                onClick={handleReturnToActiveYear}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1"
              >
                <span>العودة للسنة النشطة</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <span className="text-xs text-slate-500 font-semibold">
              ✅ المنظومة تعمل حالياً في وضع التشغيل الفعلي للسنة الحالية
            </span>
          )}
        </div>

        {/* Fiscal Years List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-black text-slate-800 text-sm flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-blue-600" />
              قائمة السنوات المالية المتاحة في قاعدة البيانات:
            </h4>
            {isLoadingSummaries && (
              <span className="text-xs text-blue-600 flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" />
                جاري فحص السحابة...
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 max-h-[460px] overflow-y-auto pr-1">
            {availableYears.map((yr) => {
              const isCurrent = yr.year === currentActiveYear;
              const isCurrentlyViewing = yr.year === viewingClosedYear;
              const isClosed = yr.isClosed;
              const closing = yr.closingRecord;

              return (
                <div
                  key={yr.year}
                  className={`p-4 rounded-2xl border transition-all ${
                    isCurrentlyViewing
                      ? 'bg-amber-50/80 border-amber-400 shadow-md ring-2 ring-amber-300'
                      : isCurrent
                      ? 'bg-emerald-50/50 border-emerald-300'
                      : 'bg-white border-slate-200 hover:border-blue-300 shadow-xs'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    {/* Year Info */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-black text-slate-900">
                          السنة المالية {yr.year}
                        </span>

                        {isCurrent && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200">
                            ✅ نشطة حالياً
                          </span>
                        )}

                        {isClosed && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200 flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            مقفلة ومعتمدة
                          </span>
                        )}

                        {yr.isArchived && (
                          <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 text-xs font-bold border border-purple-200">
                            📦 مؤرشفة سحابياً
                          </span>
                        )}

                        {isCurrentlyViewing && (
                          <span className="px-2.5 py-0.5 rounded-md bg-amber-500 text-slate-950 text-xs font-black animate-pulse">
                            👁️ قيد العرض والمراجعة الآن
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500">{yr.statusText}</p>

                      {/* Certified Metrics if closed */}
                      {closing && (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-slate-700">
                          <span>
                            <strong>تاريخ الإقفال:</strong> {closing.closingDate}
                          </span>
                          <span>
                            <strong>صافي النتيجة:</strong>{' '}
                            <span
                              className={`font-bold ${
                                closing.netProfitOrLoss >= 0 ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {formatCurrency(closing.netProfitOrLoss)}
                            </span>
                          </span>
                          <span>
                            <strong>الإيرادات:</strong> {formatCurrency(closing.totalRevenues)}
                          </span>
                          <span>
                            <strong>قيد الإقفال:</strong> #{closing.closingJournalEntryId}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto">
                      {/* Pull from Firestore shard */}
                      <button
                        type="button"
                        onClick={() => handleFetchCloudRecords(yr.year)}
                        disabled={loadingYearData === yr.year}
                        className="px-2.5 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        title="جلب فواتير وسجلات هذه السنة من فايربيس السحابية"
                      >
                        {loadingYearData === yr.year ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                        ) : (
                          <CloudDownload className="w-3.5 h-3.5 text-blue-600" />
                        )}
                        <span>جلب من السحابة</span>
                      </button>

                      {/* Print Certified Dossier */}
                      {closing && (
                        <button
                          type="button"
                          onClick={() => handlePrintClosingDossier(closing)}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                          title="طباعة محضر الإقفال المعتمد لهذه السنة"
                        >
                          <Printer className="w-3.5 h-3.5 text-slate-600" />
                          <span>محضر الإقفال</span>
                        </button>
                      )}

                      {/* Main Switch / Review Button */}
                      {isCurrentlyViewing ? (
                        <button
                          type="button"
                          onClick={handleReturnToActiveYear}
                          className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black transition flex items-center gap-1 cursor-pointer shadow-xs"
                        >
                          <span>العودة للسنة النشطة</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      ) : isCurrent ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (viewingClosedYear) handleReturnToActiveYear();
                            else onClose();
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition flex items-center gap-1 cursor-pointer shadow-xs"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>السنة النشطة الحالية</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSwitchToClosedYear(yr.year)}
                          disabled={loadingYearData === yr.year}
                          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                        >
                          {loadingYearData === yr.year ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <BarChart2 className="w-3.5 h-3.5" />
                          )}
                          <span>مراجعة وطباعة كافة التقارير</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <span className="text-xs text-slate-500">
            🔒 مراجعة السنوات المقفلة تكون في وضع القراءة والطباعة فقط للحفاظ على نزاهة القيود المحاسبية.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </Modal>
  );
};
