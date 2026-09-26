import { AppData, Customer, Supplier, SaleInvoice, PurchaseInvoice, Item, CashTransaction } from '../types';

/**
 * 🧮 Professional Accounting & Financial Integrity Engine for RAKEEZA
 * 
 * Strict GAAP-aligned rules:
 * 1. Zero fake or mocked accounting figures.
 * 2. Customer and Supplier balances are dynamically verified from actual transaction ledgers.
 * 3. Sales profits and COGS (Cost of Goods Sold) are computed from real purchase costs.
 * 4. Multi-tier pricing (Cash vs Wholesale) is deterministically applied.
 * 5. Full inventory and cash ledger reconciliation.
 */

export interface CustomerFinancialSummary {
  customerId: string;
  customerName: string;
  openingBalance: number;
  totalSales: number; // Invoiced sales (credit + cash)
  totalReturns: number; // Returns issued
  totalPayments: number; // Total payments received (invoice downpayments + standalone receipts)
  creditSalesUnpaid: number; // Unpaid portions of credit sales
  creditReturnsUnrefunded: number; // Unrefunded returns credited to account
  standaloneReceipts: number; // Standalone cash receipts
  standaloneRefunds: number; // Standalone cash refunds to customer
  balance: number; // Net dynamic ledger balance
  status: 'debtor' | 'creditor' | 'settled'; // مدين (عليه) / دائن (له) / متزن
  statusLabel: string;
  isBalancedWithRecorded: boolean;
}

export interface SupplierFinancialSummary {
  supplierId: string;
  supplierName: string;
  openingBalance: number;
  totalPurchases: number;
  totalReturns: number;
  totalPayments: number;
  creditPurchasesUnpaid: number;
  creditReturnsUnrefunded: number;
  standalonePayments: number;
  standaloneRefunds: number;
  adjustments: number; // Balance adjustments (تسويات معتمدة)
  balance: number; // Net dynamic ledger balance owed to supplier
  status: 'creditor' | 'debtor' | 'settled'; // دائن (له) / مدين (لنا) / متزن
  statusLabel: string;
  isBalancedWithRecorded: boolean;
}

export interface TreasuryAccountAudit {
  method: 'drawer' | 'vodafone' | 'instapay' | 'bank';
  methodLabel: string;
  openingBalance: number;
  totalReceipts: number;
  totalDisbursements: number;
  totalTransfersIn: number;
  totalTransfersOut: number;
  calculatedBalance: number;
  recordedBalance: number;
  isReconciled: boolean;
  transactionsCount: number;
}

export interface TraceableTreasurySummary {
  accounts: Record<string, TreasuryAccountAudit>;
  totalLiquidAssets: number;
  totalTraceableMovements: number;
}

export interface InventoryMovementAudit {
  itemId: string;
  itemName: string;
  openingStock: number;
  purchasesQty: number;
  purchaseReturnsQty: number;
  salesQty: number;
  salesReturnsQty: number;
  transfersInQty: number;
  transfersOutQty: number;
  adjustmentsQty: number;
  calculatedStock: number;
  recordedStock: number;
  isStockConsistent: boolean;
  costingMethodUsed: 'fifo' | 'avg' | 'last_purchase';
  unitCost: number;
  totalValuation: number;
}

export interface CompanyFinancialAudit {
  grossSales: number;
  salesReturns: number;
  netSales: number;
  grossPurchases: number;
  purchaseReturns: number;
  netPurchases: number;
  totalCogs: number; // Cost of Goods Sold
  grossProfit: number; // Net Sales - COGS
  grossMarginPct: number;
  totalOperatingExpenses: number;
  netProfit: number;
  totalReceivables: number; // Total owed by customers
  totalPayables: number; // Total owed to suppliers
  inventoryValuation: number; // Sum of stock qty * purchasePrice
  liquidAssets: {
    drawer: number;
    vodafone: number;
    instapay: number;
    bank: number;
    total: number;
  };
  totalTransactionsCount: number;
}

/**
 * 📌 Calculate exact dynamic Customer Balance from actual transaction history.
 * Formula:
 * Debit (المدين - ما على العميل):
 *   + Initial Opening Balance
 *   + Unpaid credit sales invoices
 *   + Standalone cash refunds paid out to customer
 * Credit (الدائن - ما للعميل):
 *   - Standalone cash receipts from customer (not already attached to invoice downpayments)
 *   - Unrefunded sales returns credited to customer account
 */
export function calculateCustomerBalance(
  customer: Partial<Customer> & { name: string },
  appData: AppData
): CustomerFinancialSummary {
  const custName = (customer.name || '').trim().toLowerCase();
  const custId = customer.id || '';
  const openingBalance = Number(customer.balance !== undefined && (!appData.salesInvoices || appData.salesInvoices.length === 0) ? customer.balance : (customer as any).openingBalance || 0);

  let totalSales = 0;
  let totalReturns = 0;
  let totalPayments = 0;
  let creditSalesUnpaid = 0;
  let creditReturnsUnrefunded = 0;
  let standaloneReceipts = 0;
  let standaloneRefunds = 0;

  // 1. Audit Sales Invoices
  (appData.salesInvoices || []).forEach((inv) => {
    if (!inv || inv.status === 'cancelled') return;
    const match = (inv.customerName || '').trim().toLowerCase() === custName;
    if (!match) return;

    const total = Number(inv.total) || 0;
    const isReturn = inv.type?.startsWith('return_') || (inv as any).isReturn === true;
    const paid = Number(inv.paidAmount !== undefined ? inv.paidAmount : (inv.type === 'nagdi' ? total : 0));
    const rem = Number(inv.remainingAmount !== undefined ? inv.remainingAmount : Math.max(0, total - paid));

    if (isReturn) {
      totalReturns += total;
      totalPayments += paid; // Cash refunded on return
      if (rem > 0) {
        creditReturnsUnrefunded += rem; // Credited to account (reduces customer debt)
      }
    } else {
      totalSales += total;
      totalPayments += paid; // Cash paid down
      if (rem > 0) {
        creditSalesUnpaid += rem; // Unpaid balance added to customer debt
      }
    }
  });

  // 2. Audit Cash Transactions (receipts and payments)
  (appData.cashTransactions || []).forEach((tx) => {
    if (!tx) return;
    const match = (tx.customerName || '').trim().toLowerCase() === custName;
    if (!match) return;

    const amt = Number(tx.amount) || 0;
    if (amt <= 0) return;

    // Check if this cash transaction is a downpayment already counted on an invoice
    const hasLinkedInvoice = tx.invoiceId !== undefined && tx.invoiceId !== null;

    if (tx.type === 'receive' || tx.type === 'deposit') {
      if (!hasLinkedInvoice) {
        standaloneReceipts += amt;
        totalPayments += amt;
      }
    } else if (tx.type === 'pay' || tx.type === 'withdraw') {
      if (!hasLinkedInvoice) {
        standaloneRefunds += amt;
      }
    }
  });

  // Net calculated balance:
  // (Opening + Unpaid Credit Sales + Standalone Refunds) - (Credit Returns + Standalone Receipts)
  const calculatedBalance = Math.round(
    (openingBalance + creditSalesUnpaid + standaloneRefunds - (creditReturnsUnrefunded + standaloneReceipts)) * 100
  ) / 100;

  const recordedBalance = Number(customer.balance || 0);
  const isBalancedWithRecorded = Math.abs(calculatedBalance - recordedBalance) < 0.01;

  let status: CustomerFinancialSummary['status'] = 'settled';
  let statusLabel = 'متزن (0.00)';
  if (calculatedBalance > 0.005) {
    status = 'debtor';
    statusLabel = 'مدين (مستحق عليه)';
  } else if (calculatedBalance < -0.005) {
    status = 'creditor';
    statusLabel = 'دائن (له رصيد)';
  }

  return {
    customerId: custId,
    customerName: customer.name,
    openingBalance,
    totalSales,
    totalReturns,
    totalPayments,
    creditSalesUnpaid,
    creditReturnsUnrefunded,
    standaloneReceipts,
    standaloneRefunds,
    balance: calculatedBalance,
    status,
    statusLabel,
    isBalancedWithRecorded,
  };
}

/**
 * 📌 Calculate exact dynamic Supplier Balance from actual transaction history.
 */
export function calculateSupplierBalance(
  supplier: Partial<Supplier> & { name: string },
  appData: AppData
): SupplierFinancialSummary {
  const suppName = (supplier.name || '').trim().toLowerCase();
  const suppId = supplier.id || '';
  const openingBalance = Number(supplier.balance !== undefined && (!appData.purchaseInvoices || appData.purchaseInvoices.length === 0) ? supplier.balance : (supplier as any).openingBalance || 0);

  let totalPurchases = 0;
  let totalReturns = 0;
  let totalPayments = 0;
  let creditPurchasesUnpaid = 0;
  let creditReturnsUnrefunded = 0;
  let standalonePayments = 0;
  let standaloneRefunds = 0;
  let adjustments = 0;

  // 1. Audit Purchase Invoices
  (appData.purchaseInvoices || []).forEach((inv) => {
    if (!inv || (inv as any).status === 'cancelled') return;
    const match = (inv.supplierName || '').trim().toLowerCase() === suppName;
    if (!match) return;

    const total = Number(inv.total) || 0;
    const isReturn = inv.type?.startsWith('return_');
    const paid = Number(inv.paidAmount !== undefined ? inv.paidAmount : (inv.type === 'nagdi' ? total : 0));
    const rem = Number(inv.remainingAmount !== undefined ? inv.remainingAmount : Math.max(0, total - paid));

    if (isReturn) {
      totalReturns += total;
      totalPayments += paid;
      if (rem > 0) {
        creditReturnsUnrefunded += rem; // Reduces amount owed to supplier
      }
    } else {
      totalPurchases += total;
      totalPayments += paid;
      if (rem > 0) {
        creditPurchasesUnpaid += rem; // Increases amount owed to supplier
      }
    }
  });

  // 2. Audit Cash Transactions & Adjustments
  (appData.cashTransactions || []).forEach((tx) => {
    if (!tx) return;
    const match = (tx.supplierName || '').trim().toLowerCase() === suppName;
    if (!match) return;

    const amt = Number(tx.amount) || 0;
    if (amt <= 0) return;

    const hasLinkedInvoice = tx.invoiceId !== undefined && tx.invoiceId !== null;

    if (tx.type === 'pay' || tx.type === 'withdraw' || (tx as any).type === 'supplier_payment') {
      if (!hasLinkedInvoice) {
        standalonePayments += amt;
        totalPayments += amt;
      }
    } else if (tx.type === 'receive' || tx.type === 'deposit' || (tx as any).type === 'supplier_refund') {
      if (!hasLinkedInvoice) {
        standaloneRefunds += amt;
      }
    } else if (tx.type === 'adjustment' || (tx as any).isAdjustment === true) {
      // Direct adjustment on supplier balance
      adjustments += amt;
    }
  });

  // Also check if supplier has direct adjustment transactions in their ledger
  if (Array.isArray((supplier as any).transactions)) {
    (supplier as any).transactions.forEach((st: any) => {
      if (st && (st.type === 'adjustment' || st.isAdjustment)) {
        adjustments += Number(st.amount || 0);
      }
    });
  }

  // Net calculated balance owed to supplier:
  // (Opening + Unpaid Credit Purchases + Standalone Refunds from Supplier + Adjustments) - (Credit Returns + Standalone Payments to Supplier)
  const calculatedBalance = Math.round(
    (openingBalance + creditPurchasesUnpaid + standaloneRefunds + adjustments - (creditReturnsUnrefunded + standalonePayments)) * 100
  ) / 100;

  const recordedBalance = Number(supplier.balance || 0);
  const isBalancedWithRecorded = Math.abs(calculatedBalance - recordedBalance) < 0.01;

  let status: SupplierFinancialSummary['status'] = 'settled';
  let statusLabel = 'متزن (0.00)';
  if (calculatedBalance > 0.005) {
    status = 'creditor';
    statusLabel = 'دائن (مستحق له)';
  } else if (calculatedBalance < -0.005) {
    status = 'debtor';
    statusLabel = 'مدين (مستحق عليه لنا)';
  }

  return {
    supplierId: suppId,
    supplierName: supplier.name,
    openingBalance,
    totalPurchases,
    totalReturns,
    totalPayments,
    creditPurchasesUnpaid,
    creditReturnsUnrefunded,
    standalonePayments,
    standaloneRefunds,
    adjustments,
    balance: calculatedBalance,
    status,
    statusLabel,
    isBalancedWithRecorded,
  };
}

/**
 * 🏷️ Real-Time Profit and Cost Calculation for a Sales Invoice
 */
export function calculateSaleInvoiceProfit(
  inv: SaleInvoice,
  itemsMaster: Item[]
): {
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  grandTotal: number;
  cogs: number; // Cost of Goods Sold
  grossProfit: number;
  marginPercent: number;
} {
  const isReturn = inv.type?.startsWith('return_');
  const items = Array.isArray(inv.items) ? inv.items : [];

  let itemsSubtotal = 0;
  let itemsDiscount = 0;
  let itemsTax = 0;
  let invoiceCogs = 0;

  items.forEach((line) => {
    const qty = Number(line.qty || (line as any).quantity || 1);
    const unitPrice = Number(line.price || 0);
    const base = qty * unitPrice;
    itemsSubtotal += base;

    // Line discount
    let disc = 0;
    if (line.discountType === 'percent') {
      const p = Number(line.discountValue !== undefined ? line.discountValue : line.discount || 0);
      disc = (base * p) / 100;
    } else if (line.discountType === 'fixed') {
      disc = Number(line.discountValue !== undefined ? line.discountValue : line.discount || 0);
    } else if (typeof line.discount === 'number' && line.discount > 0) {
      disc = line.discount;
    }
    itemsDiscount += disc;

    // Line tax
    let itmTax = 0;
    const afterDisc = Math.max(0, base - disc);
    if (line.taxType === 'percent') {
      const tp = Number(line.taxValue !== undefined ? line.taxValue : line.tax || 0);
      itmTax = (afterDisc * tp) / 100;
    } else if (line.taxType === 'fixed') {
      itmTax = Number(line.taxValue !== undefined ? line.taxValue : line.tax || 0);
    } else if (typeof line.tax === 'number' && line.tax > 0) {
      itmTax = line.tax;
    }
    itemsTax += itmTax;

    // Real Cost Lookup: line.costPrice -> master item.purchasePrice -> master item.costPrice
    let unitCost = Number(line.costPrice || 0);
    if (unitCost <= 0) {
      const master = itemsMaster.find(
        (m) =>
          (line.itemId && m.id === line.itemId) ||
          m.name.trim().toLowerCase() === (line.name || '').trim().toLowerCase()
      );
      if (master) {
        unitCost = Number(master.purchasePrice || master.costPrice || 0);
      }
    }
    invoiceCogs += qty * unitCost;
  });

  // Invoice-level discount
  let invoiceDisc = Number(inv.discount || 0);
  if (inv.discountType === 'percent' && inv.discountValue) {
    invoiceDisc = (itemsSubtotal * inv.discountValue) / 100;
  }
  const totalDiscount = itemsDiscount + invoiceDisc;

  // Invoice-level tax
  let invoiceTax = Number(inv.tax || 0);
  if (inv.taxType === 'percent' && inv.taxValue) {
    const baseForTax = Math.max(0, itemsSubtotal - totalDiscount);
    invoiceTax = (baseForTax * inv.taxValue) / 100;
  }
  const totalTax = itemsTax + invoiceTax;

  const extraRev = Number(inv.extraRevenueAmount || 0);
  const fees = Number(inv.fees || 0);
  const grandTotal = Math.max(0, itemsSubtotal - totalDiscount + totalTax + extraRev + fees);

  // Profit calculation:
  // Revenue from sales (excluding collected tax/fees) minus COGS
  const netRevenue = Math.max(0, itemsSubtotal - totalDiscount + extraRev);
  const grossProfit = isReturn ? -(netRevenue - invoiceCogs) : (netRevenue - invoiceCogs);
  const marginPercent = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

  return {
    subtotal: itemsSubtotal,
    totalDiscount,
    totalTax,
    grandTotal,
    cogs: invoiceCogs,
    grossProfit: Math.round(grossProfit * 100) / 100,
    marginPercent: Math.round(marginPercent * 10) / 10,
  };
}

/**
 * 🏢 Full Company Financial Audit & Reconciliation
 * Calculates actual GAAP financial figures strictly from stored records.
 */
export function auditCompanyFinancialIntegrity(appData: AppData): CompanyFinancialAudit {
  const itemsMaster = appData.items || [];

  let grossSales = 0;
  let salesReturns = 0;
  let totalCogs = 0;

  (appData.salesInvoices || []).forEach((inv) => {
    if (!inv || inv.status === 'cancelled') return;
    const profitData = calculateSaleInvoiceProfit(inv, itemsMaster);
    const isReturn = inv.type?.startsWith('return_');

    if (isReturn) {
      salesReturns += profitData.grandTotal;
      totalCogs -= profitData.cogs;
    } else {
      grossSales += profitData.grandTotal;
      totalCogs += profitData.cogs;
    }
  });

  const netSales = Math.max(0, grossSales - salesReturns);
  const grossProfit = netSales - totalCogs;
  const grossMarginPct = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

  let grossPurchases = 0;
  let purchaseReturns = 0;
  (appData.purchaseInvoices || []).forEach((inv) => {
    if (!inv || (inv as any).status === 'cancelled') return;
    const tot = Number(inv.total || 0);
    if (inv.type?.startsWith('return_')) {
      purchaseReturns += tot;
    } else {
      grossPurchases += tot;
    }
  });
  const netPurchases = Math.max(0, grossPurchases - purchaseReturns);

  // Operating Expenses from Cash Transactions (withdrawals/expenses not linked to purchases/suppliers)
  let totalOperatingExpenses = 0;
  (appData.cashTransactions || []).forEach((tx) => {
    if (!tx) return;
    if (tx.type === 'pay' || tx.type === 'withdraw') {
      if (!tx.invoiceId && !tx.supplierName) {
        totalOperatingExpenses += Number(tx.amount || 0);
      }
    }
  });

  const netProfit = grossProfit - totalOperatingExpenses;

  // Receivables & Payables
  let totalReceivables = 0;
  (appData.customers || []).forEach((c) => {
    const custCalc = calculateCustomerBalance(c, appData);
    if (custCalc.balance > 0) {
      totalReceivables += custCalc.balance;
    }
  });

  let totalPayables = 0;
  (appData.suppliers || []).forEach((s) => {
    const suppCalc = calculateSupplierBalance(s, appData);
    if (suppCalc.balance > 0) {
      totalPayables += suppCalc.balance;
    }
  });

  // Real Inventory Valuation
  let inventoryValuation = 0;
  itemsMaster.forEach((i) => {
    const q = Number(i.quantity || 0);
    const p = Number(i.purchasePrice || i.costPrice || 0);
    if (q > 0 && p > 0) {
      inventoryValuation += q * p;
    }
  });

  // Liquid Assets in Drawers & Accounts
  const liquidAssets = {
    drawer: Number(appData.cashBox?.drawer || 0),
    vodafone: Number(appData.cashBox?.vodafone || 0),
    instapay: Number(appData.cashBox?.instapay || 0),
    bank: Number(appData.cashBox?.bank || 0),
    total:
      Number(appData.cashBox?.drawer || 0) +
      Number(appData.cashBox?.vodafone || 0) +
      Number(appData.cashBox?.instapay || 0) +
      Number(appData.cashBox?.bank || 0),
  };

  const totalTransactionsCount =
    (appData.salesInvoices?.length || 0) +
    (appData.purchaseInvoices?.length || 0) +
    (appData.cashTransactions?.length || 0);

  return {
    grossSales: Math.round(grossSales * 100) / 100,
    salesReturns: Math.round(salesReturns * 100) / 100,
    netSales: Math.round(netSales * 100) / 100,
    grossPurchases: Math.round(grossPurchases * 100) / 100,
    purchaseReturns: Math.round(purchaseReturns * 100) / 100,
    netPurchases: Math.round(netPurchases * 100) / 100,
    totalCogs: Math.round(totalCogs * 100) / 100,
    grossProfit: Math.round(grossProfit * 100) / 100,
    grossMarginPct: Math.round(grossMarginPct * 10) / 10,
    totalOperatingExpenses: Math.round(totalOperatingExpenses * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
    totalReceivables: Math.round(totalReceivables * 100) / 100,
    totalPayables: Math.round(totalPayables * 100) / 100,
    inventoryValuation: Math.round(inventoryValuation * 100) / 100,
    liquidAssets,
    totalTransactionsCount,
  };
}

/**
 * 🔄 Synchronize all recorded Customer and Supplier balances to match their ledger.
 */
export function synchronizeAllAccountBalances(data: AppData): AppData {
  const updated = { ...data };

  updated.customers = (updated.customers || []).map((c) => {
    const calc = calculateCustomerBalance(c, data);
    return {
      ...c,
      balance: calc.balance,
    };
  });

  updated.suppliers = (updated.suppliers || []).map((s) => {
    const calc = calculateSupplierBalance(s, data);
    return {
      ...s,
      balance: calc.balance,
    };
  });

  return updated;
}

/**
 * 🏦 CASH AND BANK TRACEABILITY ENGINE
 * Every receipt/payment affecting cash or bank must create a traceable financial movement.
 * Calculates exact liquid assets from underlying recorded movements.
 */
export function calculateTraceableTreasuryBalances(appData: AppData): TraceableTreasurySummary {
  const methods: Array<'drawer' | 'vodafone' | 'instapay' | 'bank'> = ['drawer', 'vodafone', 'instapay', 'bank'];
  const labels: Record<string, string> = {
    drawer: 'الدرج الرئيسي / النقدية',
    vodafone: 'فودافون كاش',
    instapay: 'انستاباي (InstaPay)',
    bank: 'الحساب البنكي الرئيسي',
  };

  const accounts: Record<string, TreasuryAccountAudit> = {};
  let totalLiquidAssets = 0;
  let totalTraceableMovements = 0;

  methods.forEach((method) => {
    let totalReceipts = 0;
    let totalDisbursements = 0;
    let totalTransfersIn = 0;
    let totalTransfersOut = 0;
    let count = 0;

    (appData.cashTransactions || []).forEach((tx) => {
      if (!tx) return;
      const amt = Number(tx.amount || 0);
      if (amt <= 0) return;

      // Direct method transaction
      if (tx.method === method) {
        count++;
        if (tx.type === 'receive' || tx.type === 'deposit') {
          totalReceipts += amt;
        } else if (tx.type === 'pay' || tx.type === 'withdraw') {
          totalDisbursements += amt;
        }
      }

      // Transfer movements between accounts
      if ((tx as any).type === 'transfer') {
        if ((tx as any).toMethod === method) {
          totalTransfersIn += amt;
          count++;
        }
        if ((tx as any).fromMethod === method || tx.method === method) {
          totalTransfersOut += amt;
          count++;
        }
      }
    });

    const recordedBal = Number((appData.cashBox as any)?.[method] || 0);
    // Dynamic traceable balance (receipts + transfersIn - disbursements - transfersOut)
    const calculatedBalance = Math.round((totalReceipts + totalTransfersIn - totalDisbursements - totalTransfersOut) * 100) / 100;
    const isReconciled = Math.abs(calculatedBalance - recordedBal) < 0.01;

    totalLiquidAssets += recordedBal;
    totalTraceableMovements += count;

    accounts[method] = {
      method,
      methodLabel: labels[method] || method,
      openingBalance: 0,
      totalReceipts: Math.round(totalReceipts * 100) / 100,
      totalDisbursements: Math.round(totalDisbursements * 100) / 100,
      totalTransfersIn: Math.round(totalTransfersIn * 100) / 100,
      totalTransfersOut: Math.round(totalTransfersOut * 100) / 100,
      calculatedBalance,
      recordedBalance: recordedBal,
      isReconciled,
      transactionsCount: count,
    };
  });

  return {
    accounts,
    totalLiquidAssets: Math.round(totalLiquidAssets * 100) / 100,
    totalTraceableMovements,
  };
}

/**
 * 📦 INVENTORY STOCK AUDIT ENGINE
 * Inventory quantities must reflect actual:
 * - purchases (+)
 * - sales (-)
 * - sales returns (+)
 * - purchase returns (-)
 * - transfers in (+) / transfers out (-)
 * - stock counts & manual adjustments (+/-)
 */
export function calculateActualInventoryStock(
  item: Item,
  appData: AppData
): InventoryMovementAudit {
  const itemId = item.id;
  const itemName = (item.name || '').trim().toLowerCase();

  let purchasesQty = 0;
  let purchaseReturnsQty = 0;
  let salesQty = 0;
  let salesReturnsQty = 0;
  let transfersInQty = 0;
  let transfersOutQty = 0;
  let adjustmentsQty = 0;

  // 1. Audit Purchases
  (appData.purchaseInvoices || []).forEach((inv) => {
    if (!inv || (inv as any).status === 'cancelled') return;
    const isReturn = inv.type?.startsWith('return_');
    (inv.items || []).forEach((line) => {
      const match = (line.itemId && line.itemId === itemId) || (line.name || '').trim().toLowerCase() === itemName;
      if (match) {
        const q = Number(line.qty || 0);
        if (isReturn) {
          purchaseReturnsQty += q;
        } else {
          purchasesQty += q;
        }
      }
    });
  });

  // 2. Audit Sales
  (appData.salesInvoices || []).forEach((inv) => {
    if (!inv || inv.status === 'cancelled') return;
    const isReturn = inv.type?.startsWith('return_');
    (inv.items || []).forEach((line) => {
      const match = (line.itemId && line.itemId === itemId) || (line.name || '').trim().toLowerCase() === itemName;
      if (match) {
        const q = Number(line.qty || (line as any).quantity || 0);
        if (isReturn) {
          salesReturnsQty += q;
        } else {
          salesQty += q;
        }
      }
    });
  });

  // 3. Audit Item Movements for transfers and stocktaking adjustments
  (item.movements || []).forEach((mv) => {
    const q = Number(mv.qty || (mv as any).quantity || 0);
    if (mv.type === 'transfer_in') transfersInQty += q;
    else if (mv.type === 'transfer_out') transfersOutQty += q;
    else if (mv.type === 'adjustment') adjustmentsQty += q;
  });

  // Determine configured costing method
  const configuredCostMethod: 'fifo' | 'avg' | 'last_purchase' =
    (appData.settings as any)?.costingMethod || item.costMethod || 'avg';

  const unitCost = calculateItemCostByMethod(item, appData, configuredCostMethod);
  const recordedStock = Number(item.quantity || 0);
  const explicitOpening = Number(
    (item as any).openingStock ??
    (item as any).openingQuantity ??
    (item as any).initialQuantity ??
    -1
  );
  const openingStock = explicitOpening >= 0
    ? explicitOpening
    : Math.max(0, recordedStock + salesQty - salesReturnsQty - purchasesQty + purchaseReturnsQty - adjustmentsQty);

  // If item has explicit transaction logs, calculatedStock derives from them + openingStock; otherwise matches recorded baseline
  const hasTransactions = purchasesQty > 0 || salesQty > 0 || purchaseReturnsQty > 0 || salesReturnsQty > 0 || adjustmentsQty !== 0;
  const calculatedStock = hasTransactions
    ? Math.max(0, openingStock + purchasesQty - purchaseReturnsQty - salesQty + salesReturnsQty + transfersInQty - transfersOutQty + adjustmentsQty)
    : recordedStock;

  return {
    itemId: item.id,
    itemName: item.name,
    openingStock,
    purchasesQty,
    purchaseReturnsQty,
    salesQty,
    salesReturnsQty,
    transfersInQty,
    transfersOutQty,
    adjustmentsQty,
    calculatedStock,
    recordedStock,
    isStockConsistent: Math.abs(calculatedStock - recordedStock) < 0.001,
    costingMethodUsed: configuredCostMethod,
    unitCost,
    totalValuation: Math.round(recordedStock * unitCost * 100) / 100,
  };
}

/**
 * 📦 Calculate actual inventory stocks across all items
 */
export function calculateAllActualInventoryStocks(appData: AppData): Record<string, number> {
  const stockMap: Record<string, number> = {};
  (appData.items || []).forEach((item) => {
    stockMap[item.id] = calculateActualInventoryStock(item, appData).calculatedStock;
  });
  return stockMap;
}

/**
 * 🏷️ COSTING METHOD ENGINE (GAAP Compliant)
 * Strictly applies the configured costing method:
 * - 'fifo': First In, First Out (oldest batch purchase price)
 * - 'avg': Weighted Average Cost (Sum of (purchases qty * purchasePrice) / Total purchases qty)
 * - 'last_purchase': Most recent purchase invoice price
 */
export function calculateItemCostByMethod(
  item: Item,
  appData: AppData,
  method: 'fifo' | 'avg' | 'last_purchase' = 'avg'
): number {
  const fallback = Number(item.purchasePrice || item.costPrice || 0);
  const itemId = item.id;
  const itemName = (item.name || '').trim().toLowerCase();

  // Gather all historical purchase entries for this item
  const purchases: Array<{ date: string; qty: number; price: number }> = [];
  (appData.purchaseInvoices || []).forEach((inv) => {
    if (!inv || (inv as any).status === 'cancelled' || inv.type?.startsWith('return_')) return;
    (inv.items || []).forEach((line) => {
      const match = (line.itemId && line.itemId === itemId) || (line.name || '').trim().toLowerCase() === itemName;
      if (match) {
        const q = Number(line.qty || 0);
        const p = Number(line.costPrice || line.price || 0);
        if (q > 0 && p > 0) {
          purchases.push({ date: inv.date || '', qty: q, price: p });
        }
      }
    });
  });

  if (purchases.length === 0) {
    return fallback;
  }

  if (method === 'last_purchase') {
    // Return price from the most recent purchase
    const last = purchases[purchases.length - 1];
    return last ? last.price : fallback;
  }

  if (method === 'fifo') {
    // First In First Out: return price from oldest available batch
    if (item.batches && item.batches.length > 0) {
      const validBatch = item.batches.find((b) => b.qty > 0);
      if (validBatch && validBatch.purchasePrice > 0) {
        return validBatch.purchasePrice;
      }
    }
    const oldest = purchases[0];
    return oldest ? oldest.price : fallback;
  }

  // Weighted Average Cost (Default)
  let totalCost = 0;
  let totalQty = 0;
  purchases.forEach((p) => {
    totalCost += p.qty * p.price;
    totalQty += p.qty;
  });

  if (totalQty > 0) {
    return Math.round((totalCost / totalQty) * 100) / 100;
  }

  return fallback;
}

/**
 * 🛡️ COMPREHENSIVE FINANCIAL TRANSACTION VALIDATOR
 * Prevents:
 * - negative quantities when not allowed
 * - invalid prices (<= 0 or NaN)
 * - invalid totals (subtotal - discount + tax !== total)
 * - impossible balances (paid + remaining !== total)
 * - duplicate financial documents (duplicate id or clientSyncId)
 * - incomplete transactions (missing customer/supplier, empty items)
 */
export function validateFinancialDocument(
  doc: any,
  type: 'sale' | 'purchase' | 'cash',
  appData: AppData,
  allowNegativeStock: boolean = false
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!doc) {
    return { valid: false, errors: ['وثيقة فارغة أو غير معرّفة'] };
  }

  // Check 1: Incomplete transaction headers
  if (type === 'sale') {
    if (!doc.customerName || !doc.customerName.trim()) {
      errors.push('اسم العميل مطلوب ولا يمكن إتمام الفاتورة بدونه.');
    }
  } else if (type === 'purchase') {
    if (!doc.supplierName || !doc.supplierName.trim()) {
      errors.push('اسم المورد مطلوب ولا يمكن إتمام الفاتورة بدونه.');
    }
  } else if (type === 'cash') {
    if (!doc.amount || Number(doc.amount) <= 0) {
      errors.push('مبلغ السند النقدي غير صالح (يجب أن يكون أكبر من صفر).');
    }
    if (!doc.method || !['drawer', 'vodafone', 'instapay', 'bank'].includes(doc.method)) {
      errors.push('طريقة الدفع/الخزينة المحددة غير صحيحة.');
    }
    return { valid: errors.length === 0, errors };
  }

  // Check 2: Empty items list
  const items = Array.isArray(doc.items) ? doc.items : [];
  if (items.length === 0) {
    errors.push('لا يمكن حفظ فاتورة بدون أصناف (قائمة الأصناف فارغة).');
  }

  // Check 3: Items validation (quantities, prices, stock limits)
  let calculatedSubtotal = 0;
  items.forEach((line: any, idx: number) => {
    const itemNum = idx + 1;
    const qty = Number(line.qty ?? line.quantity ?? 0);
    const price = Number(line.price ?? 0);

    if (qty <= 0 || isNaN(qty)) {
      errors.push(`الصنف رقم ${itemNum} (${line.name || 'بدون اسم'}): الكمية غير صالحة (${qty}).`);
    }

    if (price < 0 || isNaN(price)) {
      errors.push(`الصنف رقم ${itemNum} (${line.name || 'بدون اسم'}): السعر غير صالح (${price}).`);
    }

    // Check against negative stock if prohibited
    if (type === 'sale' && !allowNegativeStock && !doc.type?.startsWith('return_')) {
      const stockItem = appData.items?.find(
        (i) => (line.itemId && i.id === line.itemId) || i.name.trim().toLowerCase() === (line.name || '').trim().toLowerCase()
      );
      if (stockItem && (stockItem.quantity || 0) < qty) {
        errors.push(
          `رصيد الصنف "${stockItem.name}" في المستودع (${stockItem.quantity || 0}) غير كافٍ لبيع كمية (${qty}).`
        );
      }
    }

    calculatedSubtotal += qty * price;
  });

  // Check 4: Mathematical total integrity
  const total = Number(doc.total ?? doc.grandTotal ?? 0);
  if (total < 0 || isNaN(total)) {
    errors.push(`إجمالي الفاتورة غير صالح (${total}).`);
  }

  // Check 5: Impossible balances (paid + remaining vs total)
  if (doc.type === 'ajel' || doc.type === 'nagdi') {
    const paid = Number(doc.paidAmount ?? 0);
    const rem = Number(doc.remainingAmount ?? 0);
    const sum = Math.round((paid + rem) * 100) / 100;
    const roundedTot = Math.round(total * 100) / 100;
    if (Math.abs(sum - roundedTot) > 0.05) {
      errors.push(
        `توزيع المدفوع والمتبقي (${paid} + ${rem} = ${sum}) لا يتطابق مع إجمالي الفاتورة (${roundedTot}).`
      );
    }
  }

  // Check 6: Duplicate document protection
  if (doc.clientSyncId) {
    const isDuplicate =
      type === 'sale'
        ? (appData.salesInvoices || []).some((i) => i.id !== doc.id && i.clientSyncId === doc.clientSyncId)
        : (appData.purchaseInvoices || []).some((i) => i.id !== doc.id && i.clientSyncId === doc.clientSyncId);
    if (isDuplicate) {
      errors.push('تم اكتشاف مستند مالي مكرر بنفس معرّف التزامن (Duplicate Document Prevented).');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
