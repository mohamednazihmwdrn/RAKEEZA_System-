import React, { useState, useEffect, useRef } from 'react';
import { SaleInvoice, PurchaseInvoice, Settings } from '../types';
import {
  InvoicePrintPayload,
  PaperSize,
  subscribeToInvoicePrint,
} from '../services/centralizedPrintService';
import { exportElementToPdf } from '../utils/pdfExport';
import { Printer, Download, X, Copy, Check, FileText } from 'lucide-react';

interface CentralizedInvoicePrintModalProps {
  defaultSettings?: Settings;
}

export const CentralizedInvoicePrintModal: React.FC<CentralizedInvoicePrintModalProps> = ({
  defaultSettings,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activePayload, setActivePayload] = useState<InvoicePrintPayload | null>(null);
  const [paperSize, setPaperSize] = useState<PaperSize>('A4');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const invoiceContainerRef = useRef<HTMLDivElement>(null);

  // Subscribe to centralized print service events
  useEffect(() => {
    const unsubscribe = subscribeToInvoicePrint((payload) => {
      setActivePayload(payload);
      const initialSize: PaperSize =
        payload.preferredPaperSize ||
        (typeof window !== 'undefined'
          ? (localStorage.getItem('sys_print_pref_size') as PaperSize)
          : 'A4') ||
        'A4';
      setPaperSize(initialSize === 'thermal' ? 'thermal' : initialSize === 'A5' ? 'A5' : 'A4');
      setIsOpen(true);
    });
    return () => unsubscribe();
  }, []);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleClose = () => {
    if (activePayload?.onClose) {
      try {
        activePayload.onClose();
      } catch {}
    }
    setIsOpen(false);
    setActivePayload(null);
  };

  const handleChangePaperSize = (size: PaperSize) => {
    setPaperSize(size);
    try {
      localStorage.setItem('sys_print_pref_size', size);
    } catch {}
  };

  if (!isOpen || !activePayload || !activePayload.invoice) {
    return null;
  }

  const invoice = activePayload.invoice;
  const isSaleInv = activePayload.isSales !== undefined ? activePayload.isSales : true;
  const settings: Settings = activePayload.settings || defaultSettings || ({} as Settings);

  // Extraction of party information
  const partyLabel = isSaleInv ? 'اسم العميل' : 'اسم المورد';
  const partyIdLabel = isSaleInv ? 'رقم العميل' : 'رقم المورد';
  const partyName = isSaleInv
    ? (invoice as SaleInvoice).customerName || 'عميل نقدي'
    : (invoice as PurchaseInvoice).supplierName || 'مورد عام';
  const partyPhone =
    invoice.phone ||
    (invoice as any).customerId ||
    (invoice as any).supplierId ||
    (invoice as any).clientSyncId ||
    '-';

  // Company info
  const companyName = settings.companyName || 'شركة ركيزة للحلول البرمجية';
  const companyAddress = settings.address || 'القاهرة - مصر';
  const logoUrl = (settings as any).logo || (settings as any).logoUrl || '';

  const companyPhones = [settings.phone1, settings.phone2, settings.phone3].filter(Boolean) as string[];
  if (companyPhones.length === 0) {
    companyPhones.push('01029190615');
  }

  // Invoice identifiers
  const invoiceNumber = `${invoice.id}`;
  const invoiceDate = invoice.date || new Date().toLocaleDateString('ar-EG');
  const invoiceTime =
    invoice.time ||
    new Date().toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
    });

  // Invoice title
  let invoiceTypeTitle = 'فاتورة مبيعات';
  if (invoice.type === 'nagdi') {
    invoiceTypeTitle = isSaleInv ? 'مبيعات نقدية' : 'مشتريات نقدية';
  } else if (invoice.type === 'ajel') {
    invoiceTypeTitle = isSaleInv ? 'مبيعات آجلة' : 'مشتريات آجلة';
  } else if (invoice.type === 'return_nagdi') {
    invoiceTypeTitle = isSaleInv ? 'مرتجع مبيعات نقدي' : 'مرتجع مشتريات نقدي';
  } else if (invoice.type === 'return_ajel') {
    invoiceTypeTitle = isSaleInv ? 'مرتجع مبيعات آجل' : 'مرتجع مشتريات آجل';
  }

  // Payment method label
  let paymentMethodType = 'نقداً';
  if (invoice.paymentMethod === 'drawer') {
    paymentMethodType = 'نقداً (الخزينة)';
  } else if (invoice.paymentMethod === 'vodafone') {
    paymentMethodType = 'فودافون كاش';
  } else if (invoice.paymentMethod === 'instapay') {
    paymentMethodType = 'إنستاباي (InstaPay)';
  } else if (invoice.paymentMethod === 'bank') {
    paymentMethodType = 'تحويل بنكي';
  } else if (invoice.paymentMethod) {
    paymentMethodType = invoice.paymentMethod;
  }

  // Financial Totals
  const items = invoice.items || [];
  const grandTotal = Number(invoice.total || 0);
  const feesName = (invoice as any).feeDescription || (invoice.fees ? 'نقل' : 'مصاريف نقل');
  const feesVal = Number(invoice.fees || 0);

  let paidVal = Number(invoice.paidAmount);
  let remainingVal = Number(invoice.remainingAmount);
  if (isNaN(paidVal)) {
    if (invoice.type === 'nagdi' || invoice.type === 'return_nagdi') {
      paidVal = grandTotal;
      remainingVal = 0;
    } else {
      paidVal = 0;
      remainingVal = grandTotal;
    }
  }
  if (isNaN(remainingVal)) {
    remainingVal = Math.max(0, grandTotal - paidVal);
  }

  const footerTermsNote =
    settings.invoiceFooterNote ||
    (invoice as any).footerNote ||
    'البضاعة المباعة ترجع وتستبدل خلال 14 يوماً بأصل الفاتورة';

  /**
   * 🖨️ Execute high-precision window.print() with customized page CSS
   */
  const handlePrint = () => {
    // 1. Inject or update dynamic @page style
    let styleEl = document.getElementById('centralized-invoice-print-style');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'centralized-invoice-print-style';
      document.head.appendChild(styleEl);
    }

    let pageSizeRule = '@page { size: A4 portrait; margin: 0; }';
    if (paperSize === 'A5') {
      pageSizeRule = '@page { size: A5 portrait; margin: 0; }';
    } else if (paperSize === 'thermal') {
      pageSizeRule = '@page { size: 80mm auto; margin: 0; }';
    }

    styleEl.innerHTML = `
      ${pageSizeRule}
      @media print {
        body {
          background: #ffffff !important;
          margin: 0 !important;
          padding: 0 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        /* Hide everything except print invoice modal container */
        body > *:not(#centralized-print-modal-root) {
          display: none !important;
        }
        #centralized-print-modal-root .no-print-toolbar,
        #centralized-print-modal-root .no-print-backdrop {
          display: none !important;
        }
        #centralized-print-modal-root,
        #centralized-print-modal-root .print-stage-wrapper {
          position: static !important;
          background: transparent !important;
          padding: 0 !important;
          margin: 0 !important;
          overflow: visible !important;
          display: block !important;
        }
        #rakeeza-printable-invoice-container {
          box-shadow: none !important;
          margin: 0 auto !important;
          page-break-after: avoid !important;
          page-break-inside: avoid !important;
        }
        .copyright-outside {
          display: none !important;
        }
      }
    `;

    // 2. Add attribute on body
    document.body.setAttribute('data-print-mode', 'invoice');
    document.body.setAttribute('data-paper-size', paperSize);

    // 3. Trigger window.print
    setTimeout(() => {
      window.print();
      document.body.removeAttribute('data-print-mode');
    }, 100);
  };

  /**
   * 💾 Export exact element to PDF
   */
  const handleSavePdf = async () => {
    if (!invoiceContainerRef.current) return;
    try {
      setIsExportingPdf(true);
      const filename = `${invoiceTypeTitle}_${invoiceNumber}.pdf`;
      const format = paperSize === 'A5' ? 'a5' : 'a4';

      await exportElementToPdf(invoiceContainerRef.current, filename, {
        format,
        orientation: 'portrait',
        margin: paperSize === 'thermal' ? 2 : 4,
        scale: 2,
      });
    } catch (err) {
      console.error('Error generating PDF:', err);
      // Fallback: trigger print
      handlePrint();
    } finally {
      setIsExportingPdf(false);
    }
  };

  /**
   * 📋 Copy quick summary to clipboard
   */
  const handleCopySummary = () => {
    const text = `*${invoiceTypeTitle} #${invoiceNumber}*\nالطرف: ${partyName} (${partyPhone})\nالتاريخ: ${invoiceDate}\nالإجمالي: ${grandTotal.toFixed(2)} ج.م\nالمدفوع: ${paidVal.toFixed(2)} ج.م\nالمتبقي: ${remainingVal.toFixed(2)} ج.م`;
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div
      id="centralized-print-modal-root"
      className="fixed inset-0 z-[9999] flex flex-col justify-start items-center overflow-y-auto no-print-backdrop"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)' }}
      dir="rtl"
    >
      {/* 1. Fixed / Sticky Top Toolbar */}
      <div className="w-full max-w-5xl px-3 pt-3 pb-2 sticky top-0 z-50 no-print-toolbar">
        <div className="bg-[#1a237e] text-white p-3 sm:p-4 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3 border border-indigo-400/30">
          {/* Left section: Title & Badge */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm sm:text-base">معاينة وتخصيص الفاتورة</span>
                <span className="bg-[#2e7d32] text-white px-2 py-0.5 rounded text-xs font-mono font-black">
                  #{invoiceNumber}
                </span>
              </div>
              <p className="text-[11px] text-indigo-200">{invoiceTypeTitle} - {partyName}</p>
            </div>
          </div>

          {/* Center section: Paper Size Selector Buttons */}
          <div className="flex items-center gap-1.5 bg-white/10 p-1 rounded-xl border border-white/20">
            <button
              type="button"
              onClick={() => handleChangePaperSize('A4')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                paperSize === 'A4'
                  ? 'bg-white text-[#1a237e] shadow-md font-black'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              <span>📄</span>
              <span>مقاس A4</span>
            </button>
            <button
              type="button"
              onClick={() => handleChangePaperSize('A5')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                paperSize === 'A5'
                  ? 'bg-white text-[#1a237e] shadow-md font-black'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              <span>📑</span>
              <span>مقاس A5</span>
            </button>
            <button
              type="button"
              onClick={() => handleChangePaperSize('thermal')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                paperSize === 'thermal'
                  ? 'bg-white text-[#1a237e] shadow-md font-black'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              <span>🧾</span>
              <span>حراري 80mm</span>
            </button>
          </div>

          {/* Right section: Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handlePrint}
              className="bg-[#00c853] hover:bg-[#00b248] active:bg-[#009624] text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition flex items-center gap-1.5 cursor-pointer shadow-md"
              title="طباعة الفاتورة بالمقاس المحدد"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة ({paperSize === 'thermal' ? 'حراري 80mm' : paperSize})</span>
            </button>

            <button
              type="button"
              onClick={handleSavePdf}
              disabled={isExportingPdf}
              className="bg-[#d84315] hover:bg-[#bf360c] active:bg-[#992600] disabled:opacity-50 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
              title="حفظ الفاتورة كملف PDF"
            >
              <Download className="w-4 h-4" />
              <span>{isExportingPdf ? 'جارِ التحميل...' : 'حفظ PDF'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopySummary}
              className="bg-white/15 hover:bg-white/25 text-white p-2 rounded-xl transition cursor-pointer"
              title="نسخ ملخص الفاتورة"
            >
              {isCopied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={handleClose}
              className="bg-slate-700 hover:bg-slate-800 text-white p-2 rounded-xl transition cursor-pointer"
              title="إغلاق المعاينة (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Interactive Preview Canvas Stage */}
      <div className="w-full flex-1 flex flex-col items-center py-6 px-2 sm:px-4 print-stage-wrapper">
        <div
          ref={invoiceContainerRef}
          id="rakeeza-printable-invoice-container"
          className="bg-white text-black flex flex-col justify-between transition-all duration-200"
          style={{
            fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif",
            border: paperSize === 'thermal' ? '1px dashed #000' : '1.5px solid #000',
            width: paperSize === 'A4' ? '210mm' : paperSize === 'A5' ? '148mm' : '76mm',
            minHeight: paperSize === 'A4' ? '297mm' : paperSize === 'A5' ? '210mm' : 'auto',
            padding: paperSize === 'A4' ? '8mm 10mm' : paperSize === 'A5' ? '5mm 6mm' : '4mm 3mm',
            fontSize: paperSize === 'A5' ? '0.82rem' : paperSize === 'thermal' ? '0.75rem' : '0.88rem',
            boxShadow: paperSize === 'thermal' ? 'none' : '0 8px 24px rgba(0, 0, 0, 0.25)',
            boxSizing: 'border-box',
          }}
        >
          <div>
            {/* الترويسة الديناميكية المعتمدة */}
            <div
              className="header"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1.5px solid #000',
                paddingBottom: '6px',
                marginBottom: '8px',
                width: '100%',
              }}
            >
              <div style={{ textAlign: 'right', flex: 1.2 }}>
                <h2 style={{ margin: '0 0 2px 0', fontSize: '1.1rem', fontWeight: 'bold' }}>
                  {companyName}
                </h2>
                <p style={{ margin: 0, fontSize: '0.73rem', color: '#333' }}>
                  {companyAddress}
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  minWidth: '80px',
                  flex: 0.8,
                }}
              >
                {logoUrl && (
                  <img
                    src={logoUrl}
                    alt="الشعار"
                    style={{ maxWidth: '80px', maxHeight: '45px', objectFit: 'contain' }}
                  />
                )}
              </div>

              <div style={{ flex: 1.2, display: 'flex', justifyContent: 'flex-end' }}>
                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    fontSize: '0.73rem',
                    direction: 'ltr',
                    textAlign: 'left',
                  }}
                >
                  {companyPhones.map((phone, idx) => (
                    <li key={idx} style={{ marginBottom: '1px', fontWeight: 600 }}>
                      {phone}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* صندوق معلومات العميل والفاتورة الأصلي */}
            <div
              style={{
                display: 'flex',
                flexDirection: paperSize === 'thermal' ? 'column' : 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                border: '1.5px solid #000',
                padding: '5px 10px',
                marginBottom: '8px',
                fontSize: '0.8rem',
                lineHeight: 1.4,
                width: '100%',
                backgroundColor: '#fafafa',
                gap: paperSize === 'thermal' ? '4px' : '0px',
              }}
            >
              <div style={{ textAlign: paperSize === 'thermal' ? 'center' : 'right' }}>
                <p style={{ margin: '1px 0' }}>
                  <strong>{partyLabel}:</strong> <span>{partyName}</span>
                </p>
                <p style={{ margin: '1px 0' }}>
                  <strong>{partyIdLabel}:</strong> <span>{partyPhone}</span>
                </p>
              </div>

              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: '1px 0' }}>
                  <strong>{invoiceTypeTitle}</strong> -{' '}
                  <strong style={{ fontSize: '1rem' }}>#{invoiceNumber}</strong>
                </p>
                <p style={{ margin: '1px 0' }}>
                  <strong>وسيلة الدفع:</strong> <span>{paymentMethodType}</span>
                </p>
              </div>

              <div style={{ textAlign: paperSize === 'thermal' ? 'center' : 'left' }}>
                <p style={{ margin: '1px 0' }}>
                  <strong>التاريخ:</strong> <span>{invoiceDate}</span>
                </p>
                <p style={{ margin: '1px 0' }}>
                  <strong>الوقت:</strong> <span>{invoiceTime}</span>
                </p>
              </div>
            </div>

            {/* جدول الأصناف الأصلي المعتمد */}
            <div style={{ width: '100%', flexGrow: 1 }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  marginBottom: '8px',
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        width: '38%',
                        border: '1px solid #000',
                        padding: '4px 6px',
                        textAlign: 'center',
                        backgroundColor: '#ededed',
                        fontWeight: 'bold',
                        fontSize: '0.78rem',
                      }}
                    >
                      اسم الصنف
                    </th>
                    <th
                      style={{
                        width: '30%',
                        border: '1px solid #000',
                        padding: '4px 6px',
                        textAlign: 'center',
                        backgroundColor: '#ededed',
                        fontWeight: 'bold',
                        fontSize: '0.78rem',
                      }}
                    >
                      الوصف
                    </th>
                    <th
                      style={{
                        width: '10%',
                        border: '1px solid #000',
                        padding: '4px 6px',
                        textAlign: 'center',
                        backgroundColor: '#ededed',
                        fontWeight: 'bold',
                        fontSize: '0.78rem',
                      }}
                    >
                      العدد
                    </th>
                    <th
                      style={{
                        width: '10%',
                        border: '1px solid #000',
                        padding: '4px 6px',
                        textAlign: 'center',
                        backgroundColor: '#ededed',
                        fontWeight: 'bold',
                        fontSize: '0.78rem',
                      }}
                    >
                      السعر
                    </th>
                    <th
                      style={{
                        width: '12%',
                        border: '1px solid #000',
                        padding: '4px 6px',
                        textAlign: 'center',
                        backgroundColor: '#ededed',
                        fontWeight: 'bold',
                        fontSize: '0.78rem',
                      }}
                    >
                      الإجمالي
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        style={{
                          border: '1px solid #000',
                          padding: '10px',
                          textAlign: 'center',
                          color: '#777',
                        }}
                      >
                        لا توجد أصناف في هذه الفاتورة
                      </td>
                    </tr>
                  ) : (
                    items.map((it, idx) => {
                      const qty = parseFloat(String(it.qty)) || 0;
                      const price = parseFloat(String(it.price)) || 0;
                      const itemTotal = Number(it.total !== undefined ? it.total : qty * price);
                      const desc =
                        it.spec || it.notes || (it as any).desc || (it as any).description || '-';

                      return (
                        <tr key={idx}>
                          <td
                            style={{
                              border: '1px solid #000',
                              padding: '4px 6px',
                              textAlign: 'right',
                              fontWeight: 'bold',
                              fontSize: '0.8rem',
                            }}
                          >
                            {it.name}
                          </td>
                          <td
                            style={{
                              border: '1px solid #000',
                              padding: '4px 6px',
                              textAlign: 'right',
                              color: '#444',
                              fontSize: '0.8rem',
                            }}
                          >
                            {desc}
                          </td>
                          <td
                            style={{
                              border: '1px solid #000',
                              padding: '4px 6px',
                              textAlign: 'center',
                              fontFamily: 'monospace',
                              fontWeight: 'bold',
                              fontSize: '0.8rem',
                            }}
                          >
                            {qty}
                          </td>
                          <td
                            style={{
                              border: '1px solid #000',
                              padding: '4px 6px',
                              textAlign: 'center',
                              fontFamily: 'monospace',
                              fontSize: '0.8rem',
                            }}
                          >
                            {price.toFixed(2)}
                          </td>
                          <td
                            style={{
                              border: '1px solid #000',
                              padding: '4px 6px',
                              textAlign: 'center',
                              fontFamily: 'monospace',
                              fontWeight: 'bold',
                              fontSize: '0.8rem',
                            }}
                          >
                            {itemTotal.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* المجموع والملخص السفلي الأصلي */}
            <div
              style={{
                display: 'flex',
                justifyContent: paperSize === 'thermal' ? 'center' : 'flex-end',
                marginTop: '6px',
                marginBottom: '8px',
                width: '100%',
              }}
            >
              <div
                style={{
                  width: paperSize === 'thermal' ? '100%' : '240px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  fontSize: '0.82rem',
                  fontWeight: 'bold',
                }}
              >
                {feesVal > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '1px 0',
                    }}
                  >
                    <span>{feesName}:</span>
                    <span>{feesVal.toFixed(2)}</span>
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTop: '1.5px solid #000',
                    marginTop: '3px',
                    paddingTop: '3px',
                    fontSize: '0.95rem',
                    fontWeight: 'bold',
                  }}
                >
                  <span>صافي القيمة / الإجمالي:</span>
                  <span>{grandTotal.toFixed(2)}</span>
                </div>

                {paidVal > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '1px 0',
                    }}
                  >
                    <span>المبلغ المدفوع:</span>
                    <span>{paidVal.toFixed(2)}</span>
                  </div>
                )}

                {remainingVal > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '1px 0',
                    }}
                  >
                    <span>المبلغ المتبقي:</span>
                    <span>{remainingVal.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* التذييل وحقوق الملكية */}
          <div>
            <div
              style={{
                borderTop: '1.5px solid #000',
                paddingTop: '5px',
                marginTop: 'auto',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.73rem',
                fontWeight: 600,
                width: '100%',
              }}
            >
              <div>{footerTermsNote}</div>
              <div>صفحة رقم: 1/1</div>
            </div>
          </div>
        </div>

        {/* حقوق الملكية خارج الفاتورة */}
        <div
          className="copyright-outside"
          style={{
            width: '100%',
            textAlign: 'center',
            fontSize: '0.68rem',
            fontWeight: 'bold',
            color: '#cbd5e1',
            padding: '10px 0',
            direction: 'ltr',
          }}
        >
          حقوق الملكية محفوظة Mohamed Nazih 01029190615
        </div>
      </div>
    </div>
  );
};
