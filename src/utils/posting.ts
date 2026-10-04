import { AppData, SaleInvoice, PurchaseInvoice, JournalEntry, JournalLine, ItemMovement } from '../types';

/**
 * 🏛️ محرك الترحيل المحاسبي الشامل لمنظومة ركيزة (RAKEEZA Universal Posting Engine)
 * 
 * يضمن الترحيل الفوري والآلي لجميع العمليات:
 * 1. المخزون: تحديث فوري للأرصدة (سواء بالزيادة، النقصان، أو الوصول للسالب مع تسجيل حركة الصنف).
 * 2. كشف حساب العميل / المورد: تسجيل المديونية والدفعات وتحديث الحالة (له / عليه).
 * 3. الخزينة والنقدية: توجيه المقبوضات والمدفوعات لسندات القبض والصرف وتحديث الخزائن المحددة.
 * 4. قيود اليومية المزدوجة: إنشاء القيود المحاسبية المتوازنة (Debit = Credit) آلياً.
 */

// Helper to determine cashbox key from method name
export function mapPaymentMethodToKey(methodName?: string): 'drawer' | 'vodafone' | 'instapay' | 'bank' {
  if (!methodName) return 'drawer';
  const m = methodName.toLowerCase();
  if (m.includes('فودافون') || m.includes('vodafone')) return 'vodafone';
  if (m.includes('انستاباي') || m.includes('إنستاباي') || m.includes('instapay')) return 'instapay';
  if (m.includes('فيزا') || m.includes('visa') || m.includes('بنك') || m.includes('تحويل') || m.includes('bank')) return 'bank';
  return 'drawer';
}

export function getPaymentMethodLabel(key: 'drawer' | 'vodafone' | 'instapay' | 'bank'): string {
  switch (key) {
    case 'drawer': return 'الدرج والخزينة الرئيسية';
    case 'vodafone': return 'محفظة فودافون كاش';
    case 'instapay': return 'تحويل انستاباي Instapay';
    case 'bank': return 'الحساب البنكي / فيزا';
    default: return 'الخزينة النقدية';
  }
}

/**
 * 💰 ترحيل فاتورة المبيعات (نقدي، آجل، مرتجع نقدي، مرتجع آجل)
 */
export function postSaleInvoice(
  appData: AppData,
  invoice: SaleInvoice,
  isEditing: boolean = false,
  oldInvoiceId?: number
): AppData {
  const data: AppData = {
    ...appData,
    items: (appData.items || []).map((i) => ({ ...i, movements: [...(i.movements || [])] })),
    customers: (appData.customers || []).map((c) => ({ ...c, transactions: [...(c.transactions || [])] })),
    cashTransactions: [...(appData.cashTransactions || [])],
    cashBox: { ...appData.cashBox },
    journalEntries: [...(appData.journalEntries || [])],
    salesInvoices: [...(appData.salesInvoices || [])],
  };

  const isReturn = invoice.type.startsWith('return_');
  const now = new Date();
  const dateStr = invoice.date || now.toISOString().split('T')[0];
  const timeStr = invoice.time || now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  // 1. If editing, rollback previous invoice impacts first
  if (isEditing && oldInvoiceId) {
    const oldInv = data.salesInvoices.find((i) => i.id === oldInvoiceId);
    if (oldInv) {
      const wasReturn = oldInv.type.startsWith('return_');
      
      // Rollback old stock movements
      oldInv.items?.forEach((itm) => {
        const stockItm = data.items.find((i) => (itm.itemId && i.id === itm.itemId) || i.name.trim() === itm.name.trim());
        if (stockItm) {
          const qtyDiff = wasReturn ? -itm.qty : itm.qty;
          stockItm.quantity = (stockItm.quantity || 0) + qtyDiff;
          stockItm.movements.push({
            date: dateStr,
            type: 'adjustment',
            qty: qtyDiff,
            price: itm.price,
            total: qtyDiff * itm.price,
            note: `تسوية وإعادة رصيد المخزن قبل تعديل فاتورة المبيعات #${oldInv.id}`,
          });
        }
      });

      // Rollback old customer balance
      if (oldInv.customerName) {
        const cust = data.customers.find((c) => c.name.trim().toLowerCase() === oldInv.customerName.trim().toLowerCase());
        if (cust) {
          const unpaid = oldInv.remainingAmount !== undefined ? oldInv.remainingAmount : (oldInv.total - (oldInv.paidAmount || 0));
          if (unpaid > 0) {
            cust.balance = (cust.balance || 0) - (wasReturn ? -unpaid : unpaid);
          }
        }
      }

      // Rollback old cashbox
      if (oldInv.paidAmount && oldInv.paidAmount > 0) {
        if (oldInv.paymentSplits && oldInv.paymentSplits.length > 0) {
          oldInv.paymentSplits.forEach((sp) => {
            const key = mapPaymentMethodToKey(sp.method);
            data.cashBox[key] = (data.cashBox[key] || 0) - (wasReturn ? -sp.amount : sp.amount);
          });
        } else {
          const key = oldInv.paymentMethod === 'split' ? 'drawer' : (oldInv.paymentMethod || 'drawer');
          data.cashBox[key] = (data.cashBox[key] || 0) - (wasReturn ? -oldInv.paidAmount : oldInv.paidAmount);
        }
      }

      // Remove previous cash transactions & journal entries for this invoice
      data.cashTransactions = data.cashTransactions.filter((tx) => tx.invoiceId !== oldInvoiceId);
      data.journalEntries = data.journalEntries.filter((je) => je.reference !== `SALE-INV-${oldInvoiceId}`);
      data.salesInvoices = data.salesInvoices.filter((i) => i.id !== oldInvoiceId);
    }
  }

  // 2. Put invoice in salesInvoices
  data.salesInvoices = [invoice, ...data.salesInvoices];
  if (!isEditing && invoice.id >= data.nextInvoiceNumber) {
    data.nextInvoiceNumber = invoice.id + 1;
  }

  // 3. 📦 Inventory Posting: Instant stock deduction (supports negative selling with audit trail)
  invoice.items.forEach((item) => {
    let stockItem = data.items.find((i) => (item.itemId && i.id === item.itemId) || i.name.trim() === item.name.trim());
    if (!stockItem) {
      // Create new catalog item if dynamically introduced
      stockItem = {
        id: item.itemId || `i_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: item.name,
        quantity: 0,
        purchasePrice: item.costPrice || item.price * 0.75,
        salePrice: item.price,
        movements: [],
      };
      data.items.push(stockItem);
    }

    const qtyChange = isReturn ? item.qty : -item.qty;
    stockItem.quantity = (stockItem.quantity || 0) + qtyChange;

    const moveType: ItemMovement['type'] = isReturn ? 'return_sale' : 'sale';
    const noteText = isReturn
      ? `مرتجع بيع (${invoice.type === 'return_nagdi' ? 'نقدي' : 'آجل'}) من العميل ${invoice.customerName} - فاتورة #${invoice.id}`
      : `بيع (${invoice.type === 'nagdi' ? 'نقدي' : 'آجل'}) للعميل ${invoice.customerName} - فاتورة #${invoice.id}${stockItem.quantity < 0 ? ' [بيع بالسالب]' : ''}`;

    stockItem.movements.push({
      date: dateStr,
      type: moveType,
      qty: qtyChange,
      price: item.price,
      total: Math.abs(qtyChange) * item.price,
      note: noteText,
    });
  });

  // 4. 📋 Customer Account Posting (كشف حساب العميل والمديونية له / عليه)
  let cust = data.customers.find((c) => c.name.trim().toLowerCase() === invoice.customerName.trim().toLowerCase());
  if (!cust) {
    cust = {
      id: 'c' + Date.now(),
      name: invoice.customerName,
      phone: invoice.phone || '',
      balance: 0,
      transactions: [],
    };
    data.customers.push(cust);
  }

  const effectiveRemaining = invoice.remainingAmount !== undefined ? invoice.remainingAmount : Math.max(0, invoice.total - (invoice.paidAmount || 0));
  const effectivePaid = invoice.paidAmount || 0;

  if (invoice.type === 'ajel') {
    // Credit Sale: Increase customer debt by remaining unpaid amount
    cust.balance = (cust.balance || 0) + effectiveRemaining;
    cust.transactions.push({
      id: `tx_${Date.now()}_sale_${invoice.id}`,
      date: dateStr,
      time: timeStr,
      refNo: `INV-${invoice.id}`,
      type: 'sale_credit',
      invoiceId: invoice.id,
      description: `فاتورة بيع آجل رقم #${invoice.id} (الإجمالي: ${invoice.total.toFixed(2)} - المسدد: ${effectivePaid.toFixed(2)})`,
      debit: effectiveRemaining, // ما عليه
      credit: 0,
      balance: cust.balance,
      notes: invoice.notes,
    });
  } else if (invoice.type === 'return_ajel') {
    // Credit Return: Deduct from customer debt
    cust.balance = (cust.balance || 0) - effectiveRemaining;
    cust.transactions.push({
      id: `tx_${Date.now()}_ret_${invoice.id}`,
      date: dateStr,
      time: timeStr,
      refNo: `RET-${invoice.id}`,
      type: 'return_sale',
      invoiceId: invoice.id,
      description: `مرتجع مبيعات آجل رقم #${invoice.id} قيد في الحساب`,
      debit: 0,
      credit: effectiveRemaining, // ما له (تخفيض المديونية)
      balance: cust.balance,
      notes: invoice.notes,
    });
  }

  // 5. 🏦 Treasury & Cash Posting (سندات القبض والصرف وتحديث الخزينة)
  if (effectivePaid > 0) {
    const splits = (invoice.paymentSplits && invoice.paymentSplits.length > 0)
      ? invoice.paymentSplits
      : [{ method: invoice.paymentMethod, amount: effectivePaid }];

    splits.forEach((split) => {
      if (split.amount <= 0) return;
      const mKey = mapPaymentMethodToKey(split.method);
      const isPayOut = isReturn; // In cash return, money is paid out to customer

      if (isPayOut) {
        data.cashBox[mKey] = (data.cashBox[mKey] || 0) - split.amount;
        data.cashTransactions.push({
          id: data.nextCashId++,
          date: dateStr,
          type: 'pay',
          method: mKey,
          amount: split.amount,
          note: `سند صرف: رد نقدي لمرتجع مبيعات #${invoice.id} (${split.method}) - العميل: ${invoice.customerName}`,
          customerName: invoice.customerName,
          invoiceId: invoice.id,
        });
      } else {
        data.cashBox[mKey] = (data.cashBox[mKey] || 0) + split.amount;
        data.cashTransactions.push({
          id: data.nextCashId++,
          date: dateStr,
          type: 'receive',
          method: mKey,
          amount: split.amount,
          note: `سند قبض: تحصيل ${invoice.type === 'ajel' ? 'دفعة مقدمة من فاتورة آجل' : 'فاتورة بيع نقدي'} #${invoice.id} (${split.method}) - العميل: ${invoice.customerName}`,
          customerName: invoice.customerName,
          invoiceId: invoice.id,
        });
      }
    });
  }

  // 6. 📊 Double-Entry Journal Entry Generation (سندات القيد المحاسبي المتوازن آلياً)
  const nextJid = data.nextJournalId || 1001;
  const journalLines: JournalLine[] = [];

  if (!isReturn) {
    // Normal Sale:
    // Debits: Cash received + Accounts Receivable (remaining)
    if (effectivePaid > 0) {
      const splits = (invoice.paymentSplits && invoice.paymentSplits.length > 0)
        ? invoice.paymentSplits
        : [{ method: invoice.paymentMethod, amount: effectivePaid }];

      splits.forEach((sp) => {
        const mKey = mapPaymentMethodToKey(sp.method);
        const accCode = mKey === 'bank' ? '1102' : '1101';
        journalLines.push({
          accountCode: accCode,
          accountName: mKey === 'bank' ? 'الحساب البنكي والتحويل الإلكتروني' : 'الصندوق والخزينة النقدية',
          debit: sp.amount,
          credit: 0,
          note: `تحصيل فاتورة بيع #${invoice.id} (${sp.method})`,
        });
      });
    }

    if (effectiveRemaining > 0) {
      journalLines.push({
        accountCode: '1103',
        accountName: `العملاء والمدينون - ${invoice.customerName}`,
        debit: effectiveRemaining,
        credit: 0,
        note: `المتبقي الآجل فاتورة مبيعات #${invoice.id}`,
      });
    }

    // Credits: Sales Revenue + VAT + Extra Revenue
    const netRevenue = Math.max(0, invoice.subtotal - (invoice.discount || 0));
    journalLines.push({
      accountCode: '4101',
      accountName: 'إيرادات مبيعات بضاعة تجارية',
      debit: 0,
      credit: netRevenue,
      note: `إيراد مبيعات فاتورة #${invoice.id}`,
    });

    if (invoice.tax && invoice.tax > 0) {
      journalLines.push({
        accountCode: '2105',
        accountName: 'أمانات ضريبة القيمة المضافة',
        debit: 0,
        credit: invoice.tax,
        note: `ضريبة مبيعات فاتورة #${invoice.id}`,
      });
    }

    if (invoice.extraRevenueAmount && invoice.extraRevenueAmount > 0) {
      journalLines.push({
        accountCode: '4104',
        accountName: 'إيرادات تشغيلية وأخرى / مصاريف خدمة وشحن',
        debit: 0,
        credit: invoice.extraRevenueAmount,
        note: invoice.extraRevenueName || `خدمة / مصاريف شحن فاتورة #${invoice.id}`,
      });
    }
  } else {
    // Sales Return:
    // Debit: Sales Returns
    journalLines.push({
      accountCode: '4102',
      accountName: 'مردودات ومسموحات المبيعات',
      debit: invoice.total,
      credit: 0,
      note: `مردودات مبيعات فاتورة #${invoice.id} للعميل ${invoice.customerName}`,
    });

    // Credit: Cash refund or reduction of Customer debt
    if (effectivePaid > 0) {
      const mKey = mapPaymentMethodToKey(invoice.paymentMethod);
      journalLines.push({
        accountCode: mKey === 'bank' ? '1102' : '1101',
        accountName: mKey === 'bank' ? 'الحساب البنكي والتحويل الإلكتروني' : 'الصندوق والخزينة النقدية',
        debit: 0,
        credit: effectivePaid,
        note: `صرف رد نقدي لمرتجع مبيعات #${invoice.id}`,
      });
    }

    if (effectiveRemaining > 0) {
      journalLines.push({
        accountCode: '1103',
        accountName: `العملاء والمدينون - ${invoice.customerName}`,
        debit: 0,
        credit: effectiveRemaining,
        note: `تخفيض مديونية العميل بمرتجع مبيعات #${invoice.id}`,
      });
    }
  }

  // Strictly enforce Double-Entry Validation (Total Debit === Total Credit)
  const totalDebit = Math.round(journalLines.reduce((s, l) => s + (l.debit || 0), 0) * 100) / 100;
  const totalCredit = Math.round(journalLines.reduce((s, l) => s + (l.credit || 0), 0) * 100) / 100;
  const diff = Math.round((totalDebit - totalCredit) * 100) / 100;
  if (Math.abs(diff) > 0.01) {
    throw new Error(
      `القيد المحاسبي غير متوازن: إجمالي المدين (${totalDebit.toFixed(2)}) لا يساوي إجمالي الدائن (${totalCredit.toFixed(2)}). تم إيقاف الترحيل لحماية سلامة الدفاتر المحاسبية ومنع التوازن الوهمي.`
    );
  }

  data.journalEntries.push({
    id: nextJid,
    date: dateStr,
    entryNumber: `JV-SAL-${invoice.id}`,
    reference: `SALE-INV-${invoice.id}`,
    description: `قيد محاسبي آلي لـ${isReturn ? 'مرتجع مبيعات' : 'فاتورة مبيعات'} #${invoice.id} - العميل: ${invoice.customerName}`,
    lines: journalLines,
    source: 'sales',
    createdBy: invoice.createdBy || 'مدير النظام',
    createdAt: new Date().toISOString(),
    isApproved: true,
  });
  data.nextJournalId = nextJid + 1;

  return data;
}

/**
 * 🛒 ترحيل فاتورة المشتريات (نقدي، آجل، مرتجع نقدي، مرتجع آجل)
 */
export function postPurchaseInvoice(
  appData: AppData,
  invoice: PurchaseInvoice,
  isEditing: boolean = false,
  oldInvoiceId?: number
): AppData {
  const data: AppData = {
    ...appData,
    items: (appData.items || []).map((i) => ({ ...i, movements: [...(i.movements || [])] })),
    suppliers: (appData.suppliers || []).map((s) => ({ ...s, transactions: [...(s.transactions || [])] })),
    cashTransactions: [...(appData.cashTransactions || [])],
    cashBox: { ...appData.cashBox },
    journalEntries: [...(appData.journalEntries || [])],
    purchaseInvoices: [...(appData.purchaseInvoices || [])],
  };

  const isReturn = invoice.type.startsWith('return_');
  const now = new Date();
  const dateStr = invoice.date || now.toISOString().split('T')[0];
  const timeStr = invoice.time || now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  // 1. If editing, rollback previous invoice impacts first
  if (isEditing && oldInvoiceId) {
    const oldInv = data.purchaseInvoices.find((i) => i.id === oldInvoiceId);
    if (oldInv) {
      const wasReturn = oldInv.type.startsWith('return_');
      
      // Rollback stock
      oldInv.items?.forEach((itm) => {
        const stockItm = data.items.find((i) => (itm.itemId && i.id === itm.itemId) || i.name.trim() === itm.name.trim());
        if (stockItm) {
          const qtyDiff = wasReturn ? itm.qty : -itm.qty;
          stockItm.quantity = Math.max(0, (stockItm.quantity || 0) + qtyDiff);
          stockItm.movements.push({
            date: dateStr,
            type: 'adjustment',
            qty: qtyDiff,
            price: itm.price,
            total: qtyDiff * itm.price,
            note: `تسوية وإعادة رصيد المخزن قبل تعديل فاتورة المشتريات #${oldInv.id}`,
          });
        }
      });

      // Rollback supplier balance
      if (oldInv.supplierName) {
        const supp = data.suppliers.find((s) => s.name.trim().toLowerCase() === oldInv.supplierName.trim().toLowerCase());
        if (supp) {
          const unpaid = oldInv.remainingAmount !== undefined ? oldInv.remainingAmount : (oldInv.total - (oldInv.paidAmount || 0));
          if (unpaid > 0) {
            supp.balance = (supp.balance || 0) - (wasReturn ? -unpaid : unpaid);
          }
        }
      }

      // Rollback cashbox
      if (oldInv.paidAmount && oldInv.paidAmount > 0) {
        if (oldInv.paymentSplits && oldInv.paymentSplits.length > 0) {
          oldInv.paymentSplits.forEach((sp) => {
            const key = mapPaymentMethodToKey(sp.method);
            data.cashBox[key] = (data.cashBox[key] || 0) + (wasReturn ? -sp.amount : sp.amount);
          });
        } else {
          const mKey = mapPaymentMethodToKey(oldInv.paymentMethod);
          data.cashBox[mKey] = (data.cashBox[mKey] || 0) + (wasReturn ? -oldInv.paidAmount : oldInv.paidAmount);
        }
      }

      data.cashTransactions = data.cashTransactions.filter((tx) => tx.invoiceId !== oldInvoiceId);
      data.journalEntries = data.journalEntries.filter((je) => je.reference !== `PUR-INV-${oldInvoiceId}`);
      data.purchaseInvoices = data.purchaseInvoices.filter((i) => i.id !== oldInvoiceId);
    }
  }

  // 2. Put invoice in purchaseInvoices
  data.purchaseInvoices = [invoice, ...data.purchaseInvoices];
  if (!isEditing && invoice.id >= data.nextPurchaseNumber) {
    data.nextPurchaseNumber = invoice.id + 1;
  }

  // 3. 📦 Inventory Posting: Instant stock increase & cost price update
  invoice.items.forEach((item) => {
    let stockItem = data.items.find((i) => (item.itemId && i.id === item.itemId) || i.name.trim() === item.name.trim());
    if (!stockItem) {
      stockItem = {
        id: item.itemId || `i_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: item.name,
        quantity: 0,
        purchasePrice: item.price,
        salePrice: item.price * 1.25,
        movements: [],
      };
      data.items.push(stockItem);
    }

    const qtyChange = isReturn ? -item.qty : item.qty;
    stockItem.quantity = (stockItem.quantity || 0) + qtyChange;
    if (!isReturn && item.price > 0) {
      stockItem.purchasePrice = item.price; // اعتماد سعر الشراء المحدث
    }

    const moveType: ItemMovement['type'] = isReturn ? 'return_purchase' : 'purchase';
    const noteText = isReturn
      ? `مرتجع شراء (${invoice.type === 'return_nagdi' ? 'نقدي' : 'آجل'}) للمورد ${invoice.supplierName} - فاتورة #${invoice.id}`
      : `شراء وتوريد (${invoice.type === 'nagdi' ? 'نقدي' : 'آجل'}) من المورد ${invoice.supplierName} - فاتورة #${invoice.id}`;

    stockItem.movements.push({
      date: dateStr,
      type: moveType,
      qty: qtyChange,
      price: item.price,
      total: Math.abs(qtyChange) * item.price,
      note: noteText,
    });
  });

  // 4. 📋 Supplier Account Posting (كشف حساب المورد والمديونية له / عليه)
  let supp = data.suppliers.find((s) => s.name.trim().toLowerCase() === invoice.supplierName.trim().toLowerCase());
  if (!supp) {
    supp = {
      id: 's' + Date.now(),
      name: invoice.supplierName,
      phone: invoice.phone || '',
      balance: 0,
      transactions: [],
    };
    data.suppliers.push(supp);
  }

  const effectiveRemaining = invoice.remainingAmount !== undefined ? invoice.remainingAmount : Math.max(0, invoice.total - (invoice.paidAmount || 0));
  const effectivePaid = invoice.paidAmount || 0;

  if (invoice.type === 'ajel') {
    // Credit Purchase: Increase supplier credit (debt we owe them)
    supp.balance = (supp.balance || 0) + effectiveRemaining;
    supp.transactions.push({
      id: `tx_${Date.now()}_pur_${invoice.id}`,
      date: dateStr,
      time: timeStr,
      refNo: `PUR-${invoice.id}`,
      type: 'purchase_credit',
      invoiceId: invoice.id,
      description: `فاتورة شراء وتوريد آجل رقم #${invoice.id} (الإجمالي: ${invoice.total.toFixed(2)} - المسدد: ${effectivePaid.toFixed(2)})`,
      debit: 0,
      credit: effectiveRemaining, // ما له
      balance: supp.balance,
      notes: invoice.notes,
    });
  } else if (invoice.type === 'return_ajel') {
    // Credit Purchase Return: Reduce supplier debt
    supp.balance = (supp.balance || 0) - effectiveRemaining;
    supp.transactions.push({
      id: `tx_${Date.now()}_pret_${invoice.id}`,
      date: dateStr,
      time: timeStr,
      refNo: `PRET-${invoice.id}`,
      type: 'return_purchase',
      invoiceId: invoice.id,
      description: `مرتجع مشتريات وتوريد آجل رقم #${invoice.id} خصم من الحساب`,
      debit: effectiveRemaining, // ما عليه (تخفيض رصيده)
      credit: 0,
      balance: supp.balance,
      notes: invoice.notes,
    });
  }

  // 5. 🏦 Treasury & Cash Posting (سندات الصرف والقبض وتحديث الخزائن)
  if (effectivePaid > 0) {
    const splits = (invoice.paymentSplits && invoice.paymentSplits.length > 0)
      ? invoice.paymentSplits
      : [{ method: invoice.paymentMethod, amount: effectivePaid }];

    splits.forEach((split) => {
      if (split.amount <= 0) return;
      const mKey = mapPaymentMethodToKey(split.method);
      const isReceive = isReturn; // In purchase return, money is received back into treasury

      if (isReceive) {
        data.cashBox[mKey] = (data.cashBox[mKey] || 0) + split.amount;
        data.cashTransactions.push({
          id: data.nextCashId++,
          date: dateStr,
          type: 'receive',
          method: mKey,
          amount: split.amount,
          note: `سند قبض: استرداد نقدي من مرتجع مشتريات #${invoice.id} (${split.method}) - المورد: ${invoice.supplierName}`,
          supplierName: invoice.supplierName,
          invoiceId: invoice.id,
        });
      } else {
        data.cashBox[mKey] = (data.cashBox[mKey] || 0) - split.amount;
        data.cashTransactions.push({
          id: data.nextCashId++,
          date: dateStr,
          type: 'pay',
          method: mKey,
          amount: split.amount,
          note: `سند صرف: سداد ${invoice.type === 'ajel' ? 'دفعة من فاتورة شراء آجل' : 'فاتورة شراء نقدي'} #${invoice.id} (${split.method}) - المورد: ${invoice.supplierName}`,
          supplierName: invoice.supplierName,
          invoiceId: invoice.id,
        });
      }
    });
  }

  // 6. 📊 Double-Entry Journal Entry Generation
  const nextJid = data.nextJournalId || 1001;
  const journalLines: JournalLine[] = [];

  if (!isReturn) {
    // Normal Purchase:
    // Debit: Purchases Cost
    journalLines.push({
      accountCode: '5101',
      accountName: 'تكلفة وتوريدات المشتريات التجارية',
      debit: invoice.total,
      credit: 0,
      note: `مشتريات فاتورة #${invoice.id} من المورد ${invoice.supplierName}`,
    });

    // Credits: Treasury (paid) + Accounts Payable (remaining)
    if (effectivePaid > 0) {
      const splits = (invoice.paymentSplits && invoice.paymentSplits.length > 0)
        ? invoice.paymentSplits
        : [{ method: invoice.paymentMethod, amount: effectivePaid }];

      splits.forEach((sp) => {
        const mKey = mapPaymentMethodToKey(sp.method);
        const accCode = mKey === 'bank' ? '1102' : '1101';
        journalLines.push({
          accountCode: accCode,
          accountName: mKey === 'bank' ? 'الحساب البنكي والتحويل الإلكتروني' : 'الصندوق والخزينة النقدية',
          debit: 0,
          credit: sp.amount,
          note: `سداد فاتورة مشتريات #${invoice.id} (${sp.method})`,
        });
      });
    }

    if (effectiveRemaining > 0) {
      journalLines.push({
        accountCode: '2101',
        accountName: `الموردون والدائنون - ${invoice.supplierName}`,
        debit: 0,
        credit: effectiveRemaining,
        note: `المتبقي الآجل فاتورة مشتريات #${invoice.id}`,
      });
    }
  } else {
    // Purchase Return:
    // Debit: Treasury (refund received) or Accounts Payable (debt reduced)
    if (effectivePaid > 0) {
      const mKey = mapPaymentMethodToKey(invoice.paymentMethod);
      journalLines.push({
        accountCode: mKey === 'bank' ? '1102' : '1101',
        accountName: mKey === 'bank' ? 'الحساب البنكي والتحويل الإلكتروني' : 'الصندوق والخزينة النقدية',
        debit: effectivePaid,
        credit: 0,
        note: `استرداد نقدي من مرتجع مشتريات #${invoice.id}`,
      });
    }

    if (effectiveRemaining > 0) {
      journalLines.push({
        accountCode: '2101',
        accountName: `الموردون والدائنون - ${invoice.supplierName}`,
        debit: effectiveRemaining,
        credit: 0,
        note: `تخفيض حساب المورد بمرتجع مشتريات #${invoice.id}`,
      });
    }

    // Credit: Purchase Returns
    journalLines.push({
      accountCode: '5102',
      accountName: 'مردودات ومسموحات المشتريات والتوريد',
      debit: 0,
      credit: invoice.total,
      note: `مردودات مشتريات فاتورة #${invoice.id}`,
    });
  }

  // Strictly enforce Double-Entry Validation (Total Debit === Total Credit)
  const totalDebit = Math.round(journalLines.reduce((s, l) => s + (l.debit || 0), 0) * 100) / 100;
  const totalCredit = Math.round(journalLines.reduce((s, l) => s + (l.credit || 0), 0) * 100) / 100;
  const diff = Math.round((totalDebit - totalCredit) * 100) / 100;
  if (Math.abs(diff) > 0.01) {
    throw new Error(
      `القيد المحاسبي غير متوازن: إجمالي المدين (${totalDebit.toFixed(2)}) لا يساوي إجمالي الدائن (${totalCredit.toFixed(2)}). تم إيقاف الترحيل لحماية سلامة الدفاتر المحاسبية ومنع التوازن الوهمي.`
    );
  }

  data.journalEntries.push({
    id: nextJid,
    date: dateStr,
    entryNumber: `JV-PUR-${invoice.id}`,
    reference: `PUR-INV-${invoice.id}`,
    description: `قيد محاسبي آلي لـ${isReturn ? 'مرتجع مشتريات' : 'فاتورة مشتريات'} #${invoice.id} - المورد: ${invoice.supplierName}`,
    lines: journalLines,
    source: 'purchase',
    createdBy: invoice.createdBy || 'مدير النظام',
    createdAt: new Date().toISOString(),
    isApproved: true,
  });
  data.nextJournalId = nextJid + 1;

  return data;
}

/**
 * 🗑️ حذف فاتورة مبيعات مع استرجاع حركة المخزون والقيود المحاسبية
 */
export function deleteSaleInvoice(appData: AppData, invoiceId: number | string): AppData {
  const data: AppData = {
    ...appData,
    items: (appData.items || []).map((i) => ({ ...i, movements: [...(i.movements || [])] })),
    customers: (appData.customers || []).map((c) => ({ ...c, transactions: [...(c.transactions || [])] })),
    cashTransactions: [...(appData.cashTransactions || [])],
    cashBox: { ...appData.cashBox },
    journalEntries: [...(appData.journalEntries || [])],
    salesInvoices: [...(appData.salesInvoices || [])],
  };

  const inv = data.salesInvoices.find((i) => i.id === invoiceId || String(i.id) === String(invoiceId));
  if (!inv) return data;

  const isReturn = inv.type.startsWith('return_');

  // Rollback inventory
  inv.items?.forEach((itm) => {
    const stockItm = data.items.find((i) => (itm.itemId && i.id === itm.itemId) || i.name.trim() === itm.name.trim());
    if (stockItm) {
      const qtyDiff = isReturn ? -itm.qty : itm.qty;
      stockItm.quantity = Math.max(0, (stockItm.quantity || 0) + qtyDiff);
      stockItm.movements = (stockItm.movements || []).filter((m) => !m.note?.includes(String(inv.id)));
    }
  });

  // Rollback cash box
  if (inv.paidAmount && inv.paidAmount > 0) {
    const methodKey = mapPaymentMethodToKey(inv.paymentMethod);
    const amount = Number(inv.paidAmount);
    if (isReturn) {
      data.cashBox[methodKey] = (data.cashBox[methodKey] || 0) + amount;
    } else {
      data.cashBox[methodKey] = Math.max(0, (data.cashBox[methodKey] || 0) - amount);
    }
    data.cashTransactions = data.cashTransactions.filter((tx) => tx.invoiceId !== inv.id && !tx.note?.includes(String(inv.id)));
  }

  // Rollback customer ledger
  const customer = data.customers.find((c) => c.name.trim() === (inv.customerName || '').trim());
  if (customer && customer.transactions) {
    customer.transactions = customer.transactions.filter((tx: any) => tx.invoiceId !== inv.id && !tx.reference?.includes(String(inv.id)));
  }

  // Rollback journal entry
  data.journalEntries = data.journalEntries.filter(
    (je) => je.entryNumber !== `JV-SAL-${inv.id}` && je.reference !== `SALE-INV-${inv.id}`
  );

  // Remove invoice
  data.salesInvoices = data.salesInvoices.filter((i) => i.id !== inv.id && String(i.id) !== String(inv.id));

  return data;
}

/**
 * 🗑️ حذف فاتورة مشتريات مع استرجاع حركة المخزون والقيود المحاسبية
 */
export function deletePurchaseInvoice(appData: AppData, invoiceId: number | string): AppData {
  const data: AppData = {
    ...appData,
    items: (appData.items || []).map((i) => ({ ...i, movements: [...(i.movements || [])] })),
    suppliers: (appData.suppliers || []).map((s) => ({ ...s, transactions: [...(s.transactions || [])] })),
    cashTransactions: [...(appData.cashTransactions || [])],
    cashBox: { ...appData.cashBox },
    journalEntries: [...(appData.journalEntries || [])],
    purchaseInvoices: [...(appData.purchaseInvoices || [])],
  };

  const inv = data.purchaseInvoices.find((i) => i.id === invoiceId || String(i.id) === String(invoiceId));
  if (!inv) return data;

  const isReturn = inv.type.startsWith('return_');

  // Rollback inventory
  inv.items?.forEach((itm) => {
    const stockItm = data.items.find((i) => (itm.itemId && i.id === itm.itemId) || i.name.trim() === itm.name.trim());
    if (stockItm) {
      const qtyDiff = isReturn ? itm.qty : -itm.qty;
      stockItm.quantity = Math.max(0, (stockItm.quantity || 0) + qtyDiff);
      stockItm.movements = (stockItm.movements || []).filter((m) => !m.note?.includes(String(inv.id)));
    }
  });

  // Rollback cash box
  if (inv.paidAmount && inv.paidAmount > 0) {
    const methodKey = mapPaymentMethodToKey(inv.paymentMethod);
    const amount = Number(inv.paidAmount);
    if (isReturn) {
      data.cashBox[methodKey] = Math.max(0, (data.cashBox[methodKey] || 0) - amount);
    } else {
      data.cashBox[methodKey] = (data.cashBox[methodKey] || 0) + amount;
    }
    data.cashTransactions = data.cashTransactions.filter((tx) => tx.invoiceId !== inv.id && !tx.note?.includes(String(inv.id)));
  }

  // Rollback supplier ledger
  const supplier = data.suppliers.find((s) => s.name.trim() === (inv.supplierName || '').trim());
  if (supplier && supplier.transactions) {
    supplier.transactions = supplier.transactions.filter((tx: any) => tx.invoiceId !== inv.id && !tx.reference?.includes(String(inv.id)));
  }

  // Rollback journal entry
  data.journalEntries = data.journalEntries.filter(
    (je) => je.entryNumber !== `JV-PUR-${inv.id}` && je.reference !== `PUR-INV-${inv.id}`
  );

  // Remove invoice
  data.purchaseInvoices = data.purchaseInvoices.filter((i) => i.id !== inv.id && String(i.id) !== String(inv.id));

  return data;
}
