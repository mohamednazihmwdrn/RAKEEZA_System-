import React, { useState, useRef } from 'react';
import { SaleInvoice, PurchaseInvoice, Settings } from '../types';
import { printInvoiceWindow } from '../utils/printInvoice';
import { exportElementToPdf } from '../utils/pdfExport';

interface InvoiceCardTemplateProps {
  invoice: SaleInvoice | PurchaseInvoice;
  isSales: boolean;
  settings: Settings;
  onPrint?: () => void;
  onPrintFormat?: (format: 'A4' | 'A5' | '80mm') => void;
  onClose?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export const InvoiceCardTemplate: React.FC<InvoiceCardTemplateProps> = ({
  invoice,
  isSales,
  settings,
  onPrintFormat,
  onClose,
  onEdit,
  onDelete,
}) => {
  const [paperSize, setPaperSize] = useState<'A4' | 'A5' | 'thermal'>('A4');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const invoiceContainerRef = useRef<HTMLDivElement>(null);

  const handlePrintWithSize = (size: 'A4' | 'A5' | 'thermal') => {
    if (onPrintFormat) {
      onPrintFormat(size === 'thermal' ? '80mm' : size);
    } else {
      printInvoiceWindow(invoice, isSales, settings, undefined, size === 'thermal' ? '80mm' : size);
    }
  };

  const handleExportPdf = async () => {
    if (invoiceContainerRef.current) {
      try {
        setIsExportingPdf(true);
        const formatName = paperSize === 'A5' ? 'a5' : 'a4';
        const serial = invoice.id || '1';
        await exportElementToPdf(
          invoiceContainerRef.current,
          `فاتورة_${serial}.pdf`,
          {
            format: formatName,
            orientation: 'portrait',
            margin: 5,
            scale: 2,
          }
        );
      } catch (err) {
        console.error('PDF export error:', err);
        // Fallback to print dialog
        handlePrintWithSize(paperSize);
      } finally {
        setIsExportingPdf(false);
      }
    } else {
      handlePrintWithSize(paperSize);
    }
  };

  const isSaleInv = isSales;
  const partyLabel = isSaleInv ? 'اسم العميل' : 'اسم المورد';
  const partyIdLabel = isSaleInv ? 'رقم العميل' : 'رقم المورد';
  const partyName = isSaleInv
    ? (invoice as SaleInvoice).customerName || 'عميل نقدي'
    : (invoice as PurchaseInvoice).supplierName || 'مورد عام';
  const partyPhone = invoice.phone || (invoice as any).customerId || (invoice as any).supplierId || (invoice as any).clientSyncId || '-';

  const companyName = settings.companyName || 'شركة ركيزة للحلول البرمجية';
  const companyAddress = settings.address || 'القاهرة - مصر';
  const logoUrl = (settings as any).logo || (settings as any).logoUrl || '';

  const companyPhones = [settings.phone1, settings.phone2, settings.phone3].filter(Boolean) as string[];
  if (companyPhones.length === 0) {
    companyPhones.push('01029190615');
  }

  const invoiceNumber = `${invoice.id}`;
  const invoiceDate = invoice.date || new Date().toLocaleDateString('ar-EG');
  const invoiceTime =
    invoice.time ||
    new Date().toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
    });

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

  return (
    <div className="space-y-4 w-full">
      {/* شريط التحكم والمعاينة بالأعلى */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-[#1a237e] text-white p-3 sm:p-3.5 rounded-2xl shadow-md print:hidden">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm sm:text-base">📋 معاينة {invoiceTypeTitle}</span>
          <span className="bg-[#2e7d32] text-white px-2.5 py-0.5 rounded-md text-xs font-mono font-bold">
            #{invoiceNumber}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* محدد مقاس المعاينة والطباعة: A4 / A5 / حراري 80mm */}
          <div className="inline-flex rounded-xl bg-white/10 p-1 border border-white/20">
            <button
              type="button"
              onClick={() => setPaperSize('A4')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                paperSize === 'A4' ? 'bg-white text-[#1a237e] shadow-sm' : 'text-white hover:bg-white/10'
              }`}
            >
              📄 A4
            </button>
            <button
              type="button"
              onClick={() => setPaperSize('A5')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                paperSize === 'A5' ? 'bg-white text-[#1a237e] shadow-sm' : 'text-white hover:bg-white/10'
              }`}
            >
              📑 A5
            </button>
            <button
              type="button"
              onClick={() => setPaperSize('thermal')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                paperSize === 'thermal' ? 'bg-white text-[#1a237e] shadow-sm' : 'text-white hover:bg-white/10'
              }`}
            >
              🧾 حراري
            </button>
          </div>

          {/* أزرار الإجراءات */}
          <button
            type="button"
            onClick={() => handlePrintWithSize(paperSize)}
            className="bg-[#00c853] hover:bg-[#00b248] text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <span>🖨️</span>
            <span>طباعة ({paperSize === 'thermal' ? 'حراري 80mm' : paperSize})</span>
          </button>

          <button
            type="button"
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            className="bg-[#d84315] hover:bg-[#bf360c] disabled:opacity-50 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <span>💾</span>
            <span>{isExportingPdf ? 'جارِ التحميل...' : 'حفظ PDF'}</span>
          </button>

          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              ✏️ تعديل
            </button>
          )}

          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              🗑️ حذف
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-600 hover:bg-slate-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              ✕ إغلاق
            </button>
          )}
        </div>
      </div>

      {/* مساحة معاينة الفاتورة بالتصميم المعتمد المطابق لكود المستخدم */}
      <div className="w-full overflow-x-auto flex flex-col items-center py-4 bg-[#eef1f5] rounded-2xl border border-slate-300">
        <div
          ref={invoiceContainerRef}
          className="bg-white text-black flex flex-col justify-between transition-all duration-200"
          style={{
            border: paperSize === 'thermal' ? '1px dashed #000' : '1.5px solid #000',
            width: paperSize === 'A4' ? '210mm' : paperSize === 'A5' ? '148mm' : '76mm',
            minHeight: paperSize === 'A4' ? '297mm' : paperSize === 'A5' ? '210mm' : 'auto',
            padding: paperSize === 'A4' ? '8mm 10mm' : paperSize === 'A5' ? '5mm 6mm' : '4mm 3mm',
            fontSize: paperSize === 'A5' ? '0.82rem' : paperSize === 'thermal' ? '0.75rem' : '0.88rem',
            boxShadow: paperSize === 'thermal' ? 'none' : '0 4px 12px rgba(0, 0, 0, 0.15)',
            boxSizing: 'border-box',
          }}
        >
          <div>
            {/* الترويسة العليا */}
            <div
              className="flex justify-between items-center w-full"
              style={{
                borderBottom: '1.5px solid #000',
                paddingBottom: '6px',
                marginBottom: '8px',
              }}
            >
              <div className="text-right" style={{ flex: 1.2 }}>
                <h2 style={{ margin: '0 0 2px 0', fontSize: '1.1rem', fontWeight: 'bold' }}>
                  {companyName}
                </h2>
                <p style={{ margin: 0, fontSize: '0.73rem', color: '#333' }}>
                  {companyAddress}
                </p>
              </div>

              <div
                className="flex justify-center items-center"
                style={{ flex: 0.8, minWidth: '80px' }}
              >
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="الشعار"
                    style={{ maxWidth: '80px', maxHeight: '45px', objectFit: 'contain' }}
                  />
                ) : null}
              </div>

              <div className="flex justify-end" style={{ flex: 1.2 }}>
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
              className="flex justify-between items-center w-full"
              style={{
                border: '1.5px solid #000',
                padding: '5px 10px',
                marginBottom: '8px',
                fontSize: '0.8rem',
                lineHeight: 1.4,
                backgroundColor: '#fafafa',
                flexDirection: paperSize === 'thermal' ? 'column' : 'row',
                textAlign: paperSize === 'thermal' ? 'center' : 'inherit',
                gap: paperSize === 'thermal' ? '4px' : '0',
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
                        backgroundColor: '#ededed',
                        fontWeight: 'bold',
                        fontSize: '0.78rem',
                        textAlign: 'center',
                      }}
                    >
                      اسم الصنف
                    </th>
                    <th
                      style={{
                        width: '30%',
                        border: '1px solid #000',
                        padding: '4px 6px',
                        backgroundColor: '#ededed',
                        fontWeight: 'bold',
                        fontSize: '0.78rem',
                        textAlign: 'center',
                      }}
                    >
                      الوصف
                    </th>
                    <th
                      style={{
                        width: '10%',
                        border: '1px solid #000',
                        padding: '4px 6px',
                        backgroundColor: '#ededed',
                        fontWeight: 'bold',
                        fontSize: '0.78rem',
                        textAlign: 'center',
                      }}
                    >
                      العدد
                    </th>
                    <th
                      style={{
                        width: '10%',
                        border: '1px solid #000',
                        padding: '4px 6px',
                        backgroundColor: '#ededed',
                        fontWeight: 'bold',
                        fontSize: '0.78rem',
                        textAlign: 'center',
                      }}
                    >
                      السعر
                    </th>
                    <th
                      style={{
                        width: '12%',
                        border: '1px solid #000',
                        padding: '4px 6px',
                        backgroundColor: '#ededed',
                        fontWeight: 'bold',
                        fontSize: '0.78rem',
                        textAlign: 'center',
                      }}
                    >
                      الإجمالي
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ border: '1px solid #000', padding: '10px', textAlign: 'center', color: '#777' }}>
                        لا توجد أصناف في هذه الفاتورة
                      </td>
                    </tr>
                  ) : (
                    items.map((item, idx) => {
                      const qty = parseFloat(String(item.qty)) || 0;
                      const price = parseFloat(String(item.price)) || 0;
                      const itemTotal = Number(item.total !== undefined ? item.total : qty * price);
                      const desc = item.spec || item.notes || (item as any).desc || (item as any).description || '-';

                      return (
                        <tr key={idx}>
                          <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', fontWeight: 'bold' }}>
                            {item.name || ''}
                          </td>
                          <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', color: '#444' }}>
                            {desc}
                          </td>
                          <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 'bold' }}>
                            {qty}
                          </td>
                          <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center', fontFamily: 'monospace' }}>
                            {price.toFixed(2)}
                          </td>
                          <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 'bold' }}>
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
              className="flex w-full"
              style={{
                justifyContent: paperSize === 'thermal' ? 'center' : 'flex-end',
                marginTop: '6px',
                marginBottom: '8px',
              }}
            >
              <div
                className="flex flex-col"
                style={{
                  width: paperSize === 'thermal' ? '100%' : '240px',
                  gap: '2px',
                  fontSize: '0.82rem',
                  fontWeight: 'bold',
                }}
              >
                {feesVal > 0 && (
                  <div className="flex justify-between items-center" style={{ padding: '1px 0' }}>
                    <span>{feesName}:</span>
                    <span style={{ fontFamily: 'monospace' }}>{feesVal.toFixed(2)}</span>
                  </div>
                )}
                <div
                  className="flex justify-between items-center"
                  style={{
                    borderTop: '1.5px solid #000',
                    marginTop: '3px',
                    paddingTop: '3px',
                    fontSize: '0.95rem',
                  }}
                >
                  <span>صافي القيمة / الإجمالي:</span>
                  <span style={{ fontFamily: 'monospace' }}>{grandTotal.toFixed(2)}</span>
                </div>
                {paidVal > 0 && (
                  <div className="flex justify-between items-center" style={{ padding: '1px 0' }}>
                    <span>المبلغ المدفوع:</span>
                    <span style={{ fontFamily: 'monospace' }}>{paidVal.toFixed(2)}</span>
                  </div>
                )}
                {remainingVal > 0 && (
                  <div className="flex justify-between items-center" style={{ padding: '1px 0' }}>
                    <span>المبلغ المتبقي:</span>
                    <span style={{ fontFamily: 'monospace' }}>{remainingVal.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* التذييل */}
          <div>
            <div
              className="flex justify-between w-full"
              style={{
                borderTop: '1.5px solid #000',
                paddingTop: '5px',
                marginTop: 'auto',
                fontSize: '0.73rem',
                fontWeight: 600,
              }}
            >
              <div>{footerTermsNote}</div>
              <div>صفحة رقم: 1/1</div>
            </div>
          </div>
        </div>

        {/* حقوق الملكية خارج الفاتورة */}
        <div
          style={{
            width: '100%',
            textAlign: 'center',
            fontSize: '0.68rem',
            fontWeight: 'bold',
            color: '#444',
            padding: '5px 0',
            direction: 'ltr',
          }}
        >
          حقوق الملكية محفوظة Mohamed Nazih 01029190615
        </div>
      </div>
    </div>
  );
};
