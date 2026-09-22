import { CurrencyDef, MultiCurrencyConfig } from '../types';

export const DEFAULT_CURRENCIES: CurrencyDef[] = [
  {
    code: 'EGP',
    name: 'الجنيه المصري',
    symbol: 'ج.م',
    isBaseCurrency: true,
    exchangeRate: 1.0,
    fractionUnit: 'قرش',
    lastUpdated: '2026-09-17',
  },
  {
    code: 'USD',
    name: 'الدولار الأمريكي',
    symbol: '$',
    isBaseCurrency: false,
    exchangeRate: 50.30,
    fractionUnit: 'سنت',
    lastUpdated: '2026-09-17',
  },
  {
    code: 'EUR',
    name: 'اليورو الأوروبي',
    symbol: '€',
    isBaseCurrency: false,
    exchangeRate: 54.80,
    fractionUnit: 'سنت',
    lastUpdated: '2026-09-17',
  },
  {
    code: 'SAR',
    name: 'الريال السعودي',
    symbol: 'ر.س',
    isBaseCurrency: false,
    exchangeRate: 13.40,
    fractionUnit: 'هللة',
    lastUpdated: '2026-09-17',
  },
  {
    code: 'AED',
    name: 'الدرهم الإماراتي',
    symbol: 'د.إ',
    isBaseCurrency: false,
    exchangeRate: 13.70,
    fractionUnit: 'فلس',
    lastUpdated: '2026-09-17',
  },
  {
    code: 'KWD',
    name: 'الدينار الكويتي',
    symbol: 'د.ك',
    isBaseCurrency: false,
    exchangeRate: 163.50,
    fractionUnit: 'فلس',
    lastUpdated: '2026-09-17',
  },
];

export const DEFAULT_MULTI_CURRENCY_CONFIG: MultiCurrencyConfig = {
  enabled: true,
  baseCurrency: 'EGP',
  allowAutoFxGainLoss: true,
};

/**
 * Convert foreign currency to base currency (EGP)
 */
export function toBaseCurrency(amount: number, currencyCode: string, currencies: CurrencyDef[] = DEFAULT_CURRENCIES): number {
  if (!amount || currencyCode === 'EGP') return amount;
  const curr = currencies.find((c) => c.code === currencyCode);
  const rate = curr ? curr.exchangeRate : 1.0;
  return amount * rate;
}

/**
 * Convert base currency (EGP) to foreign currency
 */
export function fromBaseCurrency(baseAmount: number, targetCurrencyCode: string, currencies: CurrencyDef[] = DEFAULT_CURRENCIES): number {
  if (!baseAmount || targetCurrencyCode === 'EGP') return baseAmount;
  const curr = currencies.find((c) => c.code === targetCurrencyCode);
  const rate = curr && curr.exchangeRate > 0 ? curr.exchangeRate : 1.0;
  return baseAmount / rate;
}

/**
 * Calculates foreign exchange gain/loss (أرباح وخسائر فروق أسعار الصرف)
 * @param invoiceRate Exchange rate at the time of invoice creation
 * @param settlementRate Exchange rate at the time of payment
 * @param foreignAmount Amount paid in foreign currency
 * @param isReceivable True for customer receipts (sales), False for supplier payments (purchases)
 */
export function calculateFxDifference(
  invoiceRate: number,
  settlementRate: number,
  foreignAmount: number,
  isReceivable: boolean = true
): { diffAmount: number; type: 'gain' | 'loss' | 'neutral' } {
  const rateDiff = settlementRate - invoiceRate;
  const baseDiff = foreignAmount * rateDiff;

  if (Math.abs(baseDiff) < 0.001) {
    return { diffAmount: 0, type: 'neutral' };
  }

  // For Receivables (Customer): if settlementRate > invoiceRate => Gain (we receive more EGP)
  // For Payables (Supplier): if settlementRate > invoiceRate => Loss (we pay more EGP)
  if (isReceivable) {
    return {
      diffAmount: Math.abs(baseDiff),
      type: baseDiff > 0 ? 'gain' : 'loss',
    };
  } else {
    return {
      diffAmount: Math.abs(baseDiff),
      type: baseDiff > 0 ? 'loss' : 'gain',
    };
  }
}
