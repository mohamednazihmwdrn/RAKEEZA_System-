import React from 'react';
import { SaleInvoice, PurchaseInvoice, Settings } from '../types';
import { printInvoiceWindow } from '../utils/printInvoice';
import { tafqeetArabic } from '../utils/tafqeet';

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
  onPrint,
  onPrintFormat,
  onClose,
  onEdit,
  onDelete,
}) => {
  const handlePrintWithSize = (size: 'A4' | 'A5' | '80mm') => {
    if (onPrintFormat) {
      onPrintFormat(size);
    } else if (onPrint && size === 'A4') {
      onPrint();
    } else {
      printInvoiceWindow(invoice, isSales, settings, undefined, size);
    }
  };
  const isSaleInv = isSales;
  const partyLabel = isSaleInv ? 'اسم العميل' : 'اسم المورد';
  const partyIdLabel = isSaleInv ? 'رقم العميل / الهاتف' : 'رقم المورد / الهاتف';
  const partyName = isSaleInv
    ? (invoice as SaleInvoice).customerName || 'عميل نقدي'
    : (invoice as PurchaseInvoice).supplierName || 'مورد عام';
  const partyPhone = invoice.phone || (invoice as any).customerId || (invoice as any).supplierId || '-';

  const companyName = settings.companyName || 'منظومة RAKEEZA للمحاسبة';
  const companyAddress = settings.address || 'جمهورية مصر العربية';
  const companyPhone1 = settings.phone1 || '01029190615';
  const companyPhone2 = settings.phone2 || '';
  const companyPhone3 = settings.phone3 || '';
  const logoUrl = (settings as any).logo || (settings as any).logoUrl || '';

  const invoiceNumber = `${invoice.id}`;
  const invoiceDate = invoice.date || new Date().toISOString().split('T')[0];
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

  let paymentMethodType = 'نقدي (الدرج)';
  if (invoice.paymentMethod === 'drawer') {
    paymentMethodType = 'نقدي (الدرج)';
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
  const subtotal =
    invoice.subtotal !== undefined
      ? invoice.subtotal
      : items.reduce((s, i) => s + (i.total || i.qty * i.price), 0);
  const discountVal = invoice.discount || 0;
  const taxVal = invoice.tax || 0;
  const feesName = (invoice as any).feeDescription || (invoice.fees ? 'نقل / مصاريف' : 'رسوم');
  const feesVal = invoice.fees || 0;
  const grandTotal = invoice.total;

  let paidAmount = invoice.paidAmount;
  let remainingAmount = invoice.remainingAmount;
  if (paidAmount === undefined) {
    if (invoice.type === 'nagdi' || invoice.type === 'return_nagdi') {
      paidAmount = grandTotal;
      remainingAmount = 0;
    } else {
      paidAmount = 0;
      remainingAmount = grandTotal;
    }
  }
  if (remainingAmount === undefined) {
    remainingAmount = Math.max(0, grandTotal - (paidAmount || 0));
  }

  const discountAmount = typeof discountVal === 'number' ? (subtotal * discountVal) / 100 : 0;
  const taxAmount = typeof taxVal === 'number' ? ((subtotal - discountAmount) * taxVal) / 100 : 0;

  return (
    <div className="space-y-4">
      {/* Control Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#1a237e] text-white p-3 rounded-xl print:hidden">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm">📋 {invoiceTypeTitle}</span>
          <span className="bg-[#198754] px-2 py-0.5 rounded-md text-xs font-mono font-bold">
            #{invoiceNumber}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Standardized Printing Options: A4, A5, Thermal 80mm */}
          <div className="inline-flex rounded-lg overflow-hidden border border-emerald-600 bg-emerald-700/60 p-0.5">
            <button
              onClick={() => handlePrintWithSize('A4')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer flex items-center gap-1"
              title="طباعة A4 قياسي"
            >
              🖨️ A4
            </button>
            <button
              onClick={() => handlePrintWithSize('A5')}
              className="hover:bg-emerald-600/80 text-white px-2 py-1 rounded text-xs font-bold transition cursor-pointer flex items-center gap-1"
              title="طباعة A5 مدمج"
            >
              📄 A5
            </button>
            <button
              onClick={() => handlePrintWithSize('80mm')}
              className="hover:bg-emerald-600/80 text-white px-2 py-1 rounded text-xs font-bold transition cursor-pointer flex items-center gap-1"
              title="طباعة إيصال حراري (Thermal 80mm)"
            >
              🧾 حراري 80mm
            </button>
          </div>
          {onEdit && (
            <button
              onClick={onEdit}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
            >
              ✏️ تعديل
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
            >
              🗑️ حذف
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="bg-slate-600 hover:bg-slate-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
            >
              إغلاق
            </button>
          )}
        </div>
      </div>

      {/* The Unified Standard Invoice Container - Clean, Light and Modern */}
      <div className="bg-white border-2 border-slate-300 rounded-xl p-4 sm:p-6 text-slate-800 flex flex-col justify-between shadow-lg">
        <div>
          {/* 1. الترويسة الديناميكية */}
          <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-3 w-full">
            <div className="text-right flex-1">
              <h2 className="text-lg font-bold text-slate-900 m-0 leading-tight">{companyName}</h2>
              <p className="text-xs text-slate-500 m-0">{companyAddress}</p>
            </div>

            {/* اللوجو / الشعار في المنتصف */}
            <div className="flex justify-center items-center min-w-[80px] flex-1">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="الشعار"
                  className="max-w-[90px] max-h-[55px] object-contain"
                />
              ) : null}
            </div>

            <div className="text-left flex-1">
              <ul className="list-none p-0 m-0 text-xs font-semibold text-slate-700" dir="ltr">
                {companyPhone1 && <li className="mb-0.5">{companyPhone1}</li>}
                {companyPhone2 && <li className="mb-0.5">{companyPhone2}</li>}
                {companyPhone3 && <li className="mb-0.5">{companyPhone3}</li>}
              </ul>
            </div>
          </div>

          {/* 2. مستطيل البيانات */}
          <div className="flex flex-col sm:flex-row justify-between items-center border border-slate-200 rounded-lg p-2 sm:px-3 mb-3 text-xs leading-snug w-full bg-slate-50 gap-2">
            <div className="text-right w-full sm:w-auto">
              <p className="m-0.5 text-slate-800">
                <strong className="text-slate-600">{partyLabel}:</strong> <span className="font-bold text-slate-900">{partyName}</span>
              </p>
              <p className="m-0.5 text-slate-800">
                <strong className="text-slate-600">{partyIdLabel}:</strong> <span dir="ltr" className="font-mono">{partyPhone}</span>
              </p>
              {(invoice as any).customerRepName && (
                <p className="m-0.5 text-indigo-900 font-bold">
                  <strong>المندوب المستلم:</strong> <span>{(invoice as any).customerRepName}</span>{' '}
                  {(invoice as any).customerRepPhone && <span dir="ltr">({(invoice as any).customerRepPhone})</span>}
                </p>
              )}
            </div>

            <div className="text-center w-full sm:w-auto">
              <p className="m-0.5">
                <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">{invoiceTypeTitle}</span> -{' '}
                <strong className="text-sm font-mono text-slate-900">#{invoiceNumber}</strong>
              </p>
              <p className="m-0.5 text-slate-700">
                <strong>وسيلة الدفع:</strong> <span>{paymentMethodType}</span>
              </p>
              {invoice.salesRep && (
                <p className="m-0.5 text-slate-700">
                  <strong>مندوب المبيعات:</strong> <span>{invoice.salesRep}</span>
                </p>
              )}
            </div>

            <div className="text-left w-full sm:w-auto" dir="rtl">
              <p className="m-0.5 text-slate-700">
                <strong>التاريخ:</strong> <span className="font-mono font-bold text-slate-900">{invoiceDate}</span>
              </p>
              <p className="m-0.5 text-slate-700">
                <strong>الوقت:</strong> <span className="font-mono text-slate-800">{invoiceTime}</span>
              </p>
            </div>
          </div>

          {invoice.notes && (
            <div className="text-xs bg-slate-50 border border-slate-200 p-2 mb-3 rounded-lg text-slate-700">
              <strong>📝 ملاحظات:</strong> {invoice.notes}
            </div>
          )}

          {/* 3. جدول الأصناف - نظيف تماماً وخالٍ من التظليل الأسود */}
          <div className="w-full overflow-x-auto mb-3 rounded-lg border border-slate-200">
            <table className="w-full border-collapse text-center text-xs">
              <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                <tr>
                  <th className="border border-slate-200 p-1.5 sm:p-2 text-right font-black text-[11px] sm:text-xs" style={{ width: '30%' }}>
                    الوصف
                  </th>
                  <th className="border border-slate-200 p-1.5 sm:p-2 text-right font-medium text-[11px] sm:text-xs" style={{ width: '22%' }}>
                    البيان
                  </th>
                  <th className="border border-slate-200 p-1.5 sm:p-2 font-bold text-[11px] sm:text-xs" style={{ width: '10%' }}>
                    العدد
                  </th>
                  <th className="border border-slate-200 p-1.5 sm:p-2 font-bold text-[11px] sm:text-xs" style={{ width: '12%' }}>
                    سعر
                  </th>
                  <th className="border border-slate-200 p-1.5 sm:p-2 font-bold text-[10px] sm:text-xs" style={{ width: '7%' }}>
                    الخصم
                  </th>
                  <th className="border border-slate-200 p-1.5 sm:p-2 font-bold text-[10px] sm:text-xs" style={{ width: '7%' }}>
                    الضريبة
                  </th>
                  <th className="border border-slate-200 p-1.5 sm:p-2 font-black text-[11px] sm:text-xs" style={{ width: '12%' }}>
                    اجمالي
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="border border-slate-200 p-4 text-slate-400 bg-white">
                      لا توجد أصناف في هذه الفاتورة
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => {
                    const hasDisc = (item.discountValue !== undefined && item.discountValue > 0) || ((item.discount || 0) > 0);
                    const discDisplay = !hasDisc
                      ? '-'
                      : item.discountType === 'percent'
                      ? `${item.discountValue ?? item.discount}%`
                      : `${parseFloat((item.discountValue ?? item.discount ?? 0).toString()).toFixed(2)} ج.م`;

                    const hasTax = (item.taxValue !== undefined && item.taxValue > 0) || ((item.tax || 0) > 0);
                    const taxDisplay = !hasTax
                      ? '-'
                      : item.taxType === 'percent'
                      ? `${item.taxValue ?? item.tax}%`
                      : `${parseFloat((item.taxValue ?? item.tax ?? 0).toString()).toFixed(2)} ج.م`;

                    return (
                      <tr key={idx} className="bg-white hover:bg-slate-50 transition-colors">
                        <td className="border border-slate-200 p-1.5 sm:p-2 font-bold text-right text-slate-900 pr-2 text-[11px] sm:text-xs">
                          {item.name}
                        </td>
                        <td className="border border-slate-200 p-1.5 sm:p-2 text-right text-slate-600 text-[10.5px] sm:text-xs">
                          {item.notes || '-'}
                        </td>
                        <td className="border border-slate-200 p-1.5 sm:p-2 font-mono font-bold text-slate-900 text-[11px] sm:text-xs">{item.qty}</td>
                        <td className="border border-slate-200 p-1.5 sm:p-2 font-mono font-bold text-slate-900 text-[11px] sm:text-xs">
                          {parseFloat(item.price.toString()).toFixed(2)}
                        </td>
                        <td className="border border-slate-200 p-1.5 sm:p-2 font-mono text-[10px] sm:text-[11px] text-slate-700">
                          {discDisplay}
                        </td>
                        <td className="border border-slate-200 p-1.5 sm:p-2 font-mono text-[10px] sm:text-[11px] text-slate-700">
                          {taxDisplay}
                        </td>
                        <td className="border border-slate-200 p-1.5 sm:p-2 font-black font-mono text-slate-950 text-[11px] sm:text-xs">
                          {parseFloat(item.total.toString()).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 4. الحسابات والملخص - تصميم ناصع وفاتح ومتجاوب للشاشات الكبيرة */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-end gap-3 mt-3 mb-3 w-full">
            {/* جهة اليمين: تفقيط المبلغ والتوقيع والشروط */}
            <div className="flex-1 flex flex-col justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700">
              <div>
                <span className="font-bold text-slate-900 block mb-1">المبلغ كتابة بالحروف:</span>
                <p className="font-bold text-emerald-800 bg-emerald-50/70 border border-emerald-200 p-2 rounded text-xs leading-relaxed">
                  {tafqeetArabic(grandTotal)}
                </p>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-200 text-[11px] text-slate-600 mt-2">
                <div>
                  <span className="font-bold">المستلم: </span>
                  <span className="underline decoration-dotted decoration-slate-400">........................</span>
                </div>
                <div>
                  <span className="font-bold">توقيع المسؤول / الختم: </span>
                  <span className="underline decoration-dotted decoration-slate-400">........................</span>
                </div>
              </div>
            </div>

            {/* جهة اليسار: جدول الحسابات والأرقام */}
            <div className="w-full sm:w-80 flex flex-col gap-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 shadow-xs shrink-0">
              {discountVal > 0 && (
                <div className="flex justify-between items-center py-0.5 text-rose-700">
                  <span className="font-bold">خصم الفاتورة ({discountVal}%):</span>
                  <span className="font-mono font-black">{discountAmount.toFixed(2)} ج.م</span>
                </div>
              )}
              {taxVal > 0 && (
                <div className="flex justify-between items-center py-0.5 text-blue-700">
                  <span className="font-bold">المصروفات/الضريبة ({taxVal}%):</span>
                  <span className="font-mono font-black">{taxAmount.toFixed(2)} ج.م</span>
                </div>
              )}
              <div className="flex justify-between items-center border-t border-slate-200 pt-1.5 text-sm bg-emerald-50 -mx-3 -mb-1.5 px-3 py-2 rounded-b-lg border-b border-emerald-300">
                <span className="font-black text-slate-900">صافي القيمة / الإجمالي:</span>
                <span className="font-mono font-black text-emerald-700 text-base">{grandTotal.toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between items-center py-0.5 pt-1 text-slate-800">
                <span className="font-bold">المبلغ المدفوع:</span>
                <span className="font-mono text-emerald-800 font-black">{paidAmount.toFixed(2)} ج.م</span>
              </div>
              {remainingAmount > 0 && (
                <div className="flex justify-between items-center py-0.5 text-amber-800">
                  <span className="font-bold">المبلغ المتبقي:</span>
                  <span className="font-mono font-black">{remainingAmount.toFixed(2)} ج.م</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          {/* 5. تذييل داخل الفاتورة */}
          <div className="border-t border-slate-300 pt-1.5 mt-3 flex justify-between text-[11px] font-semibold w-full text-slate-600">
            <div>البضاعة المباعة ترجع وتستبدل خلال 14 يوماً بأصل الفاتورة</div>
            <div>صفحة رقم: 1/1</div>
          </div>
        </div>
      </div>

      {/* 6. حقوق الملكية خارج الإطار الخارجي تماماً */}
      <div className="w-full text-center text-[11px] font-bold text-slate-600 py-1" dir="ltr">
        حقوق الملكية محفوظة Mohamed Nazih 01029190615
      </div>
    </div>
  );
};
