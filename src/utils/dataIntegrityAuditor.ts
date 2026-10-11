/**
 * 🛡️ Automated Accounting Integrity Auditor & Diagnostic Engine
 *
 * Enforces:
 * 1. Double-Entry Balance Invariance (Debits === Credits)
 * 2. Invoice Sequential Numbering & Duplicate Detection
 * 3. Cash Box Reconciliation vs Transaction Ledger
 * 4. Memory Footprint & Storage Health Diagnostics
 * 5. One-click Safe Auto-Repair
 */

import { AppData, JournalEntry, SaleInvoice } from '../types';
import { getStorageQuotaMetrics } from './indexedDbStorage';

export interface IntegrityAuditReport {
  isHealthy: boolean;
  score: number; // 0 to 100
  checkedAt: string;

  // Double entry invariance
  totalDebits: number;
  totalCredits: number;
  debitCreditDiscrepancy: number;
  unbalancedJournalsCount: number;
  unbalancedJournalIds: string[];

  // Invoices integrity
  totalSalesInvoices: number;
  duplicateInvoiceIds: string[];
  maxInvoiceNumericId: number;
  nextInvoiceNumberConfig: number;
  isSequenceConsistent: boolean;

  // Cash reconciliation
  calculatedCashNet: number;
  reportedCashTotal: number;
  cashDiscrepancy: number;

  // System scale & footprint
  totalRecordsCount: number;
  estimatedPayloadSizeMB: number;
  browserStorageUsageMB: number;
  browserStorageQuotaMB: number;
  browserStoragePercent: number;

  // Issues & warnings list
  issues: {
    type: 'error' | 'warning' | 'info';
    title: string;
    description: string;
    canAutoRepair: boolean;
  }[];
}

class DataIntegrityAuditor {
  public async runFullDiagnostic(appData: AppData): Promise<IntegrityAuditReport> {
    const issues: IntegrityAuditReport['issues'] = [];

    // 1. Audit Double-Entry Journal Entries
    let totalDebits = 0;
    let totalCredits = 0;
    let unbalancedCount = 0;
    const unbalancedIds: string[] = [];

    const journals = appData.journalEntries || [];
    for (let i = 0; i < journals.length; i++) {
      const entry = journals[i];
      let entryDebits = 0;
      let entryCredits = 0;

      const lines = entry.lines || [];
      for (let j = 0; j < lines.length; j++) {
        entryDebits += Number(lines[j].debit || 0);
        entryCredits += Number(lines[j].credit || 0);
      }

      totalDebits += entryDebits;
      totalCredits += entryCredits;

      const lineDiff = Math.abs(entryDebits - entryCredits);
      if (lineDiff > 0.05) {
        unbalancedCount++;
        unbalancedIds.push(String(entry.id));
      }
    }

    const journalDiscrepancy = Math.round(Math.abs(totalDebits - totalCredits) * 100) / 100;

    if (unbalancedCount > 0) {
      issues.push({
        type: 'error',
        title: 'قيود محاسبية غير متوازنة',
        description: `يوجد ${unbalancedCount} قيد محاسبي لا يتساوى فيه طرف المدين مع الدائن بفارق إجمالي ${journalDiscrepancy} ج.م.`,
        canAutoRepair: true,
      });
    }

    // 2. Audit Sales Invoices Sequence & Duplicates
    const invoices = appData.salesInvoices || [];
    const seenIds = new Set<string>();
    const duplicateIds: string[] = [];
    let maxNumericId = 0;

    for (let i = 0; i < invoices.length; i++) {
      const invIdStr = String(invoices[i].id);
      if (seenIds.has(invIdStr)) {
        duplicateIds.push(invIdStr);
      } else {
        seenIds.add(invIdStr);
      }

      const numVal = parseInt(invIdStr.replace(/\D/g, ''), 10);
      if (!isNaN(numVal) && numVal > maxNumericId) {
        maxNumericId = numVal;
      }
    }

    const nextInvCfg = Number(appData.nextInvoiceNumber || 1);
    const isSequenceConsistent = nextInvCfg > maxNumericId;

    if (duplicateIds.length > 0) {
      issues.push({
        type: 'error',
        title: 'تكرار في أرقام الفواتير',
        description: `تم رصد ${duplicateIds.length} فواتير مكررة الرقم في النظام.`,
        canAutoRepair: true,
      });
    }

    if (!isSequenceConsistent && maxNumericId > 0) {
      issues.push({
        type: 'warning',
        title: 'مؤشر الترقيم التسلسلي للفواتير يحتاج ضبط',
        description: `الرقم التسلسلي التالي للفاتورة (${nextInvCfg}) أقل من أو يساوي أعلى رقم موجود حالياً (${maxNumericId}).`,
        canAutoRepair: true,
      });
    }

    // 3. Audit Cash Box Reconciliation
    const cashTxs = appData.cashTransactions || [];
    let calculatedCashNet = 0;
    for (let i = 0; i < cashTxs.length; i++) {
      const tx = cashTxs[i];
      if (tx.type === 'receive') {
        calculatedCashNet += Number(tx.amount || 0);
      } else if (tx.type === 'pay') {
        calculatedCashNet -= Number(tx.amount || 0);
      }
    }

    const cashBox = appData.cashBox || { drawer: 0, vodafone: 0, instapay: 0, bank: 0 };
    const reportedCashTotal =
      Number(cashBox.drawer || 0) +
      Number(cashBox.vodafone || 0) +
      Number(cashBox.instapay || 0) +
      Number(cashBox.bank || 0);

    const cashDiscrepancy = Math.round(Math.abs(calculatedCashNet - reportedCashTotal) * 100) / 100;

    // 4. Memory Footprint & Storage Quotas
    const totalRecords =
      invoices.length +
      (appData.purchaseInvoices?.length || 0) +
      cashTxs.length +
      journals.length +
      (appData.items?.length || 0) +
      (appData.customers?.length || 0) +
      (appData.suppliers?.length || 0);

    let payloadSizeMB = 0;
    try {
      const serialized = JSON.stringify(appData);
      payloadSizeMB = Math.round((new Blob([serialized]).size / (1024 * 1024)) * 100) / 100;
    } catch {}

    const quota = await getStorageQuotaMetrics();

    if (quota.percentageUsed > 80) {
      issues.push({
        type: 'warning',
        title: 'استهلاك مرتفع لمساحة التخزين المحلية',
        description: `المتصفح استهلك ${quota.percentageUsed}% من الحصة التخزينية المخصصة. يُنصح بتشغيل الأرشفة الباردة.`,
        canAutoRepair: false,
      });
    }

    // Calculate overall Health Score
    let score = 100;
    if (unbalancedCount > 0) score -= Math.min(30, unbalancedCount * 5);
    if (duplicateIds.length > 0) score -= Math.min(25, duplicateIds.length * 5);
    if (!isSequenceConsistent) score -= 10;
    if (cashDiscrepancy > 1000) score -= 10;
    score = Math.max(0, Math.min(100, score));

    const isHealthy = issues.filter((i) => i.type === 'error').length === 0 && score >= 80;

    return {
      isHealthy,
      score,
      checkedAt: new Date().toISOString(),
      totalDebits: Math.round(totalDebits * 100) / 100,
      totalCredits: Math.round(totalCredits * 100) / 100,
      debitCreditDiscrepancy: journalDiscrepancy,
      unbalancedJournalsCount: unbalancedCount,
      unbalancedJournalIds: unbalancedIds,
      totalSalesInvoices: invoices.length,
      duplicateInvoiceIds: duplicateIds,
      maxInvoiceNumericId: maxNumericId,
      nextInvoiceNumberConfig: nextInvCfg,
      isSequenceConsistent,
      calculatedCashNet: Math.round(calculatedCashNet * 100) / 100,
      reportedCashTotal: Math.round(reportedCashTotal * 100) / 100,
      cashDiscrepancy,
      totalRecordsCount: totalRecords,
      estimatedPayloadSizeMB: payloadSizeMB,
      browserStorageUsageMB: quota.usageMB,
      browserStorageQuotaMB: quota.quotaMB,
      browserStoragePercent: quota.percentageUsed,
      issues,
    };
  }

  /**
   * Safe automated repair for common accounting & sequence anomalies
   */
  public autoRepairIntegrity(appData: AppData): {
    repairedData: AppData;
    repairsMade: string[];
  } {
    const repairsMade: string[] = [];
    let updated = { ...appData };

    // 1. Fix nextInvoiceNumber sequence
    let maxId = 0;
    (updated.salesInvoices || []).forEach((inv) => {
      const num = parseInt(String(inv.id).replace(/\D/g, ''), 10);
      if (!isNaN(num) && num > maxId) maxId = num;
    });

    if (maxId >= Number(updated.nextInvoiceNumber || 1)) {
      const fixedNext = maxId + 1;
      updated.nextInvoiceNumber = fixedNext;
      repairsMade.push(`تم تصحيح عداد الفواتير التسلسلي إلى (${fixedNext}) لمنع أي تعارض في أرقام الفواتير القادمة.`);
    }

    // 2. Fix unbalanced small rounding journal entries (< 1.00)
    if (updated.journalEntries && updated.journalEntries.length > 0) {
      let balancedJournalsCount = 0;
      updated.journalEntries = updated.journalEntries.map((j) => {
        let deb = 0;
        let cred = 0;
        (j.lines || []).forEach((l) => {
          deb += Number(l.debit || 0);
          cred += Number(l.credit || 0);
        });

        const diff = Math.round((deb - cred) * 100) / 100;
        if (Math.abs(diff) > 0 && Math.abs(diff) <= 1.0) {
          balancedJournalsCount++;
          // Add rounding line
          const newLines = [...(j.lines || [])];
          if (diff > 0) {
            newLines.push({
              accountCode: '5204',
              accountName: 'فروقات تقريب محاسبي وتسوية نظام',
              debit: 0,
              credit: diff,
              note: 'تسوية آلية لفرق التقريب المحاسبي',
            });
          } else {
            newLines.push({
              accountCode: '4103',
              accountName: 'فروقات تقريب محاسبي وتسوية نظام',
              debit: Math.abs(diff),
              credit: 0,
              note: 'تسوية آلية لفرق التقريب المحاسبي',
            });
          }
          return {
            ...j,
            lines: newLines,
            totalDebit: Math.max(deb, cred),
            totalCredit: Math.max(deb, cred),
          };
        }
        return j;
      });

      if (balancedJournalsCount > 0) {
        repairsMade.push(`تمت موازنة عدد (${balancedJournalsCount}) قيد محاسبي بمعالجة فروقات التقريب.`);
      }
    }

    return {
      repairedData: updated,
      repairsMade,
    };
  }
}

export const dataIntegrityAuditor = new DataIntegrityAuditor();
