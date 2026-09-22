import { Quotation, AppData } from '../types';
import { tafqeetArabic } from './tafqeet';

export function printWebOrderReceipt(
  order: Quotation,
  appData: AppData,
  format: '80mm' | 'a4' = '80mm',
  autoClose = true
): void {
  const settings = appData.settings;
  const config = appData.catalogConfig;

  const companyName = config?.storeName || settings.companyName || 'مؤسسة ركيزة التجارية';
  const companyAddress = settings.address || '';
  const companyPhone = config?.contactPhone || settings.phone1 || '01029190615';
  const currency = config?.currencySymbol || settings.currencySymbol || 'ج.م';

  const orderNumber = order.orderReference || `ORD-${order.id}`;
  const orderDate = order.date || new Date().toISOString().split('T')[0];
  const orderTime = order.time || new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  const clientName = order.clientName || 'عميل المتجر الإلكتروني';
  const clientPhone = order.phone || '-';
  const clientAddress = order.customerAddress || 'استلام من الفرع / لم يحدد';
  const notes = order.deliveryNotes || order.notes || '';

  const printWindow = window.open('', '_blank', format === '80mm' ? 'width=380,height=700' : 'width=850,height=950');
  if (!printWindow) {
    alert('يرجى السماح بالنوافذ المنبثقة للطباعة الفورية لإيصال الطلب');
    return;
  }

  const itemsHtml = (order.items || [])
    .map(
      (item, idx) => `
    <tr style="border-bottom: 1px dashed #ccc;">
      <td style="padding: 5px 2px; text-align: right; font-weight: bold; font-size: ${format === '80mm' ? '12px' : '14px'};">
        ${idx + 1}. ${item.name}
        ${item.notes ? `<div style="font-size: 10px; color: #555; font-weight: normal;">${item.notes}</div>` : ''}
      </td>
      <td style="padding: 5px 2px; text-align: center; font-size: ${format === '80mm' ? '12px' : '14px'}; font-weight: bold;">
        ${item.qty}
      </td>
      <td style="padding: 5px 2px; text-align: center; font-size: ${format === '80mm' ? '11px' : '13px'};">
        ${Number(item.price).toFixed(2)}
      </td>
      <td style="padding: 5px 2px; text-align: left; font-weight: bold; font-size: ${format === '80mm' ? '12px' : '14px'};">
        ${Number(item.total).toFixed(2)}
      </td>
    </tr>
  `
    )
    .join('');

  const tafqeetStr = tafqeetArabic(order.total || 0, { currency });

  const html = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>إيصال طلب إلكتروني #${orderNumber}</title>
      <style>
        @page {
          size: ${format === '80mm' ? '80mm auto' : 'A4 portrait'};
          margin: ${format === '80mm' ? '3mm' : '12mm'};
        }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif, system-ui;
          direction: rtl;
          margin: 0;
          padding: ${format === '80mm' ? '4px' : '20px'};
          color: #000;
          background: #fff;
          font-size: ${format === '80mm' ? '12px' : '14px'};
          line-height: 1.35;
        }
        .text-center { text-align: center; }
        .text-left { text-align: left; }
        .text-right { text-align: right; }
        .font-bold { font-weight: bold; }
        .dashed-line {
          border-top: 1px dashed #333;
          margin: 8px 0;
        }
        .double-line {
          border-top: 2px solid #000;
          margin: 8px 0;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 6px 0;
        }
        th {
          border-bottom: 1.5px solid #000;
          padding: 4px 2px;
          font-size: ${format === '80mm' ? '11px' : '13px'};
        }
        .badge {
          display: inline-block;
          background: #000;
          color: #fff;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: ${format === '80mm' ? '11px' : '13px'};
          font-weight: bold;
          margin: 4px 0;
        }
        .highlight-box {
          background: #f4f4f5;
          border: 1px solid #d4d4d8;
          padding: 6px;
          border-radius: 6px;
          margin: 6px 0;
        }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
      </style>
    </head>
    <body>
      <div class="text-center">
        <h2 style="margin: 2px 0 4px 0; font-size: ${format === '80mm' ? '16px' : '22px'}; font-weight: 900;">
          ${companyName}
        </h2>
        ${companyAddress ? `<div style="font-size: 11px; color: #444;">${companyAddress}</div>` : ''}
        ${companyPhone ? `<div style="font-size: 11px; font-weight: bold;">هاتف / واتساب: ${companyPhone}</div>` : ''}
        
        <div class="badge">🛒 إيصال طلب من المتجر الإلكتروني (WEB ORDER)</div>
        <div style="font-size: ${format === '80mm' ? '13px' : '16px'}; font-weight: 900; margin: 2px 0;">
          رقم الطلب: ${orderNumber}
        </div>
        <div style="font-size: 11px; color: #333;">
          التاريخ: <strong>${orderDate}</strong> | الوقت: <strong>${orderTime}</strong>
        </div>
      </div>

      <div class="dashed-line"></div>

      <!-- Customer Details -->
      <div class="highlight-box">
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
          <span>العميل:</span>
          <strong style="font-size: ${format === '80mm' ? '13px' : '15px'};">${clientName}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
          <span>الهاتف:</span>
          <strong style="font-size: ${format === '80mm' ? '13px' : '15px'}; direction: ltr;">${clientPhone}</strong>
        </div>
        ${
          clientAddress
            ? `
          <div style="margin-top: 3px; border-top: 1px dashed #ccc; padding-top: 3px;">
            <span>العنوان / التوصيل:</span>
            <div style="font-weight: bold;">${clientAddress}</div>
          </div>
        `
            : ''
        }
        ${
          notes
            ? `
          <div style="margin-top: 3px; border-top: 1px dashed #ccc; padding-top: 3px; color: #854d0e; font-weight: bold;">
            <span>ملاحظات العميل:</span>
            <div>${notes}</div>
          </div>
        `
            : ''
        }
      </div>

      <div class="dashed-line"></div>

      <!-- Items Table -->
      <table>
        <thead>
          <tr>
            <th class="text-right" style="width: 50%;">الصنف</th>
            <th class="text-center" style="width: 15%;">الكمية</th>
            <th class="text-center" style="width: 17%;">السعر</th>
            <th class="text-left" style="width: 18%;">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div class="dashed-line"></div>

      <!-- Totals -->
      <div style="margin-top: 6px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
          <span>المجموع الفرعي:</span>
          <span>${Number(order.subtotal || order.total).toFixed(2)} ${currency}</span>
        </div>
        ${
          order.discount
            ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px; color: #dc2626;">
            <span>الخصم:</span>
            <span>-${Number(order.discount).toFixed(2)} ${currency}</span>
          </div>
        `
            : ''
        }
        ${
          order.tax
            ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span>الضريبة:</span>
            <span>+${Number(order.tax).toFixed(2)} ${currency}</span>
          </div>
        `
            : ''
        }
        <div class="double-line"></div>
        <div style="display: flex; justify-content: space-between; font-size: ${
          format === '80mm' ? '15px' : '18px'
        }; font-weight: 900;">
          <span>الصافي المطلوب:</span>
          <span>${Number(order.total).toFixed(2)} ${currency}</span>
        </div>
        ${
          tafqeetStr
            ? `
          <div style="font-size: 10px; color: #555; text-align: center; margin-top: 4px; font-weight: bold;">
            (${tafqeetStr})
          </div>
        `
            : ''
        }
      </div>

      <div class="dashed-line"></div>

      <!-- Footer -->
      <div class="text-center" style="margin-top: 10px; font-size: 10px; color: #444;">
        <div style="font-weight: bold;">نظام ركيزة لإدارة المبيعات والمتاجر الإلكترونية (Rakeeza ERP)</div>
        <div>يرجى مراجعة الأصناف والتجهيز فوراً للتسليم أو الشحن</div>
        <div style="margin-top: 6px; letter-spacing: 2px; font-family: monospace; font-size: 11px;">
          *${orderNumber}*
        </div>
      </div>

      <script>
        window.onload = function() {
          window.focus();
          window.print();
          ${autoClose ? 'setTimeout(function(){ window.close(); }, 750);' : ''}
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
