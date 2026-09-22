/**
 * Arabic Number to Words Converter (Tafqeet / تفقيط)
 * Converts numbers into formal Arabic textual representation with currency and sub-currency.
 */

const ones = [
  '',
  'واحد',
  'اثنان',
  'ثلاثة',
  'أربعة',
  'خمسة',
  'ستة',
  'سبعة',
  'ثمانية',
  'تسعة',
  'عشرة',
  'أحد عشر',
  'اثنا عشر',
  'ثلاثة عشر',
  'أربعة عشر',
  'خمسة عشر',
  'ستة عشر',
  'سبعة عشر',
  'ثمانية عشر',
  'تسعة عشر',
];

const tens = [
  '',
  '',
  'عشرون',
  'ثلاثون',
  'أربعون',
  'خمسون',
  'ستون',
  'سبعون',
  'ثمانون',
  'تسعون',
];

const hundreds = [
  '',
  'مائة',
  'مئتان',
  'ثلاثمائة',
  'أربعمائة',
  'خمسمائة',
  'ستمائة',
  'سبعمائة',
  'ثمانمائة',
  'تسعمائة',
];

function convertThreeDigitGroup(num: number): string {
  let res = '';
  const h = Math.floor(num / 100);
  const remainder = num % 100;

  if (h > 0) {
    res += hundreds[h];
  }

  if (remainder > 0) {
    if (res !== '') res += ' و';
    if (remainder < 20) {
      res += ones[remainder];
    } else {
      const o = remainder % 10;
      const t = Math.floor(remainder / 10);
      if (o > 0) {
        res += ones[o] + ' و' + tens[t];
      } else {
        res += tens[t];
      }
    }
  }

  return res;
}

export interface TafqeetOptions {
  currency?: string; // e.g. "جنيه مصري", "ريال سعودي", "درهم"
  fractionName?: string; // e.g. "قرش", "هللة", "فلس"
  prefix?: string; // e.g. "فقط"
  suffix?: string; // e.g. "لا غير"
}

export function tafqeetArabic(amount: number, options: TafqeetOptions = {}): string {
  const {
    currency = 'جنيه مصري',
    fractionName = 'قرش',
    prefix = 'فقط',
    suffix = 'لا غير',
  } = options;

  if (isNaN(amount) || amount === 0) {
    return `${prefix} صفر ${currency} ${suffix}`;
  }

  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);

  const integerPart = Math.floor(absAmount);
  const fractionPart = Math.round((absAmount - integerPart) * 100);

  if (integerPart === 0 && fractionPart === 0) {
    return `${prefix} صفر ${currency} ${suffix}`;
  }

  const parts: string[] = [];

  // Billions
  const billions = Math.floor(integerPart / 1_000_000_000);
  // Millions
  const millions = Math.floor((integerPart % 1_000_000_000) / 1_000_000);
  // Thousands
  const thousands = Math.floor((integerPart % 1_000_000) / 1_000);
  // Units
  const units = integerPart % 1_000;

  if (billions > 0) {
    if (billions === 1) parts.push('مليار');
    else if (billions === 2) parts.push('ملياران');
    else if (billions >= 3 && billions <= 10) parts.push(`${convertThreeDigitGroup(billions)} مليارات`);
    else parts.push(`${convertThreeDigitGroup(billions)} مليار`);
  }

  if (millions > 0) {
    if (millions === 1) parts.push('مليون');
    else if (millions === 2) parts.push('مليونان');
    else if (millions >= 3 && millions <= 10) parts.push(`${convertThreeDigitGroup(millions)} ملايين`);
    else parts.push(`${convertThreeDigitGroup(millions)} مليون`);
  }

  if (thousands > 0) {
    if (thousands === 1) parts.push('ألف');
    else if (thousands === 2) parts.push('ألفان');
    else if (thousands >= 3 && thousands <= 10) parts.push(`${convertThreeDigitGroup(thousands)} آلاف`);
    else parts.push(`${convertThreeDigitGroup(thousands)} ألف`);
  }

  if (units > 0) {
    parts.push(convertThreeDigitGroup(units));
  }

  let result = parts.join(' و');

  if (result.trim() === '') {
    result = 'صفر';
  }

  let finalStr = `${prefix} ${result} ${currency}`;

  if (fractionPart > 0) {
    const fractionText = convertThreeDigitGroup(fractionPart);
    finalStr += ` و${fractionText} ${fractionName}`;
  }

  if (suffix) {
    finalStr += ` ${suffix}`;
  }

  if (isNegative) {
    finalStr = `سالب ` + finalStr;
  }

  return finalStr.trim();
}
