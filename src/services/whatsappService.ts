import { SaleInvoice, Customer, Settings, Quotation } from '../types';

/**
 * 📲 RAKEEZA WhatsApp Business Messaging Helper
 * Supports direct web/app redirection via wa.me and formatted professional Arabic notices
 */

export function cleanPhoneNumber(phone?: string): string {
  if (!phone) return '';
  // Remove spaces, hyphens, plus signs, brackets
  let cleaned = phone.replace(/[\s\-\+\(\)]/g, '');
  
  // If starts with 01 (Egyptian mobile format: 010, 011, 012, 015)
  if (cleaned.startsWith('01') && cleaned.length === 11) {
    cleaned = '2' + cleaned; // Add Egypt country code 201...
  } else if (cleaned.startsWith('1') && cleaned.length === 10) {
    cleaned = '20' + cleaned;
  }
  
  return cleaned;
}

export function generateInvoiceWhatsAppMessage(invoice: SaleInvoice, settings?: Settings): string {
  const companyName = settings?.companyName || 'منظومة ركيزة';
  const currency = 'ج.م';

  const itemsList = (invoice.items || [])
    .slice(0, 10)
    .map((item) => `▫️ ${item.name} (${item.qty} × ${(item.price || 0).toLocaleString()} = ${(item.total || 0).toLocaleString()} ${currency})`)
    .join('\n');

  const extraItemsCount = (invoice.items || []).length > 10 ? `\n... وباقي الأصناف (${invoice.items.length - 10} صنف إضافي)` : '';

  const paymentStatus =
    invoice.paidAmount >= invoice.total
      ? '✅ خالص بالكامل'
      : invoice.paidAmount > 0
      ? `⚠️ مدفوع جزئياً (متبقي: ${(invoice.remainingAmount || 0).toLocaleString()} ${currency})`
      : `⏳ آجل بالكامل (مستحق: ${(invoice.total || 0).toLocaleString()} ${currency})`;

  return `السلام عليكم ورحمة الله وبركاته،
أهلاً بحضرتك أستاذ/ة: *${invoice.customerName}* 🌸

يسعدنا في *${companyName}* إرسال تفاصيل فاتورة المبيعات الخاصة بكم:
📋 *رقم الفاتورة:* #${invoice.id}
📅 *التاريخ:* ${invoice.date}
${invoice.salesRep ? `👔 *المندوب المسؤول:* ${invoice.salesRep}\n` : ''}
📦 *ملخص بنود الفاتورة:*
${itemsList}${extraItemsCount}

💰 *الإجمالي النهائي:* ${(invoice.total || 0).toLocaleString()} ${currency}
💵 *المدفوع:* ${(invoice.paidAmount || 0).toLocaleString()} ${currency}
📊 *حالة السداد:* ${paymentStatus}

${invoice.notes ? `📝 *ملاحظات:* ${invoice.notes}\n` : ''}
سعداء دائماً بخدمتكم وتلبية طلباتكم.
لأي استفسار أو متابعة نتشرف بتواصلكم معنا.
*${companyName}*`;
}

export function generateStatementWhatsAppMessage(
  customerOrName: Customer | string,
  balanceOrSettings?: number | Settings,
  dateStr?: string,
  settingsObj?: Settings
): string {
  let custName = typeof customerOrName === 'string' ? customerOrName : customerOrName.name;
  let balance = typeof balanceOrSettings === 'number' ? balanceOrSettings : (typeof customerOrName === 'object' ? customerOrName.balance || 0 : 0);
  let effectiveSettings = typeof balanceOrSettings === 'object' ? balanceOrSettings : (settingsObj || undefined);

  const companyName = effectiveSettings?.companyName || 'منظومة ركيزة';
  const currency = 'ج.م';

  const statusText =
    balance > 0
      ? `📌 *الرصيد المستحق طرف سيادتكم:* ${balance.toLocaleString()} ${currency}`
      : balance < 0
      ? `🟢 *رصيد دائن لصالحكم:* ${Math.abs(balance).toLocaleString()} ${currency}`
      : `✅ *الحساب خالص تماماً ومطابق بدون أي مديونية.*`;

  return `السلام عليكم ورحمة الله وبركاته،
عناية العميل الكريم: *${custName}* المحترم 🌸

تحية طيبة من *${companyName}*،
نرفق لسيادتكم ملخص كشف الحساب المالي حتى تاريخ اليوم ${dateStr ? `(${dateStr})` : ''}:

${statusText}

${balance > 0 ? `نرجو التكرم بالاطلاع والمراجعة لجدولة السداد في أقرب فرصة شاكرين لسيادتكم حسن تعاونكم الدائم وثقتكم بنا.` : ''}

نسعد دائماً بشراكتنا المستمرة معكم.
*إدارة الحسابات - ${companyName}*`;
}

export function generateQuotationWhatsAppMessage(quote: Quotation, settings?: Settings): string {
  const companyName = settings?.companyName || 'منظومة ركيزة';
  const currency = 'ج.م';
  const clientName = (quote as any).customerName || (quote as any).clientName || 'العميل';

  return `السلام عليكم ورحمة الله وبركاته،
السادة الكرام / *${clientName}* المحترمون 🌸

تحية طيبة وبعد،
يسعدنا في *${companyName}* تقديم عرض السعر رقم: *#${quote.id}*
📅 *تاريخ العرض:* ${quote.date}
${quote.validUntil ? `⏳ *صلاحية العرض حتى:* ${quote.validUntil}\n` : ''}
💰 *القيمة الإجمالية للعرض:* ${(quote.total || 0).toLocaleString()} ${currency}

نأمل أن ينال عرضنا قبولكم، ويسعدنا تقديم أي استفسارات أو توضيحات.
شاكرين لكم اهتمامكم ونسعد بالتعاون معكم.

*${companyName}*`;
}

export function openWhatsAppChat(phone: string, text: string): boolean {
  const clean = cleanPhoneNumber(phone);
  const encodedText = encodeURIComponent(text);
  
  if (clean) {
    const url = `https://wa.me/${clean}?text=${encodedText}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  } else {
    // If no phone is provided, open web sharing prompt
    const url = `https://wa.me/?text=${encodedText}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    return false;
  }
}
