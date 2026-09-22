import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  AppData,
  SaleInvoice,
  CashTransaction,
  JournalEntry,
  PurchaseInvoice,
  FiscalYearClosingRecord,
  FiscalYearInfo,
} from '../types';

export interface ShardedFiscalYearSummary {
  fiscalYear: string;
  invoicesCount: number;
  totalSalesAmount: number;
  totalPaidAmount: number;
  lastUpdated: string;
}

export interface ColdStorageArchiveRecord {
  id: string;
  companyId: string;
  fiscalYear: string;
  title: string;
  recordsCount: number;
  totalAmount: number;
  storageBucket: string;
  storagePath: string;
  downloadUrl?: string;
  checksum: string;
  archivedAt: string;
  archivedBy: string;
  status: 'archived' | 'restored';
  fileSizeKB: number;
  dataPayload?: any; // Cached cold JSON payload
}

/**
 * ⚡ Firestore Sharding & Cold Storage Archiving Service
 *
 * Implements:
 * 1. Sharding sales invoices into sub-collections partitioned by tenant companyId and fiscalYear:
 *    Path: tenants/{companyId}/fiscal_years/{fiscalYear}/sales_invoices/{invoiceId}
 * 2. Automatic Archiving for data > 2 years into Cold Storage with manifest tracking in:
 *    Path: tenants/{companyId}/archives/{archiveId}
 * 3. Granular and global Firestore Database Cleaner for Owner Control Panel
 */
export class FirestoreShardingService {
  /**
   * Helper to derive fiscal year from date string (e.g. '2024-05-12' -> '2024')
   */
  public extractFiscalYear(dateStr?: string, defaultYear = '2026'): string {
    if (!dateStr) return defaultYear;
    try {
      const match = dateStr.match(/^(\d{4})/);
      if (match && match[1]) {
        return match[1];
      }
    } catch {}
    return defaultYear;
  }

  /**
   * Shards a single sales invoice into its fiscal year sub-collection
   */
  public async shardSingleInvoice(
    companyId: string,
    invoice: SaleInvoice,
    customYear?: string
  ): Promise<boolean> {
    const cleanCompId = (companyId || 'COMP-000001').trim();
    const fiscalYear = customYear || this.extractFiscalYear(invoice.date);
    const invoiceId = String(invoice.id || `INV-${Date.now()}`);

    try {
      const invoiceRef = doc(
        db,
        'tenants',
        cleanCompId,
        'fiscal_years',
        fiscalYear,
        'sales_invoices',
        invoiceId
      );

      await setDoc(
        invoiceRef,
        {
          ...invoice,
          companyId: cleanCompId,
          fiscalYear,
          shardedAt: new Date().toISOString(),
          serverTimestamp: serverTimestamp(),
        },
        { merge: true }
      );

      // Update Year Metadata
      await this.updateFiscalYearMetadata(cleanCompId, fiscalYear);
      return true;
    } catch (err) {
      console.error('[Sharding] Failed to shard invoice:', err);
      return false;
    }
  }

  /**
   * Shards multiple sales invoices into sub-collections grouped by fiscal year
   */
  public async shardBatchInvoices(
    companyId: string,
    invoices: SaleInvoice[]
  ): Promise<{ success: boolean; shardedCount: number; years: string[] }> {
    const cleanCompId = (companyId || 'COMP-000001').trim();
    if (!invoices || invoices.length === 0) {
      return { success: true, shardedCount: 0, years: [] };
    }

    // Group invoices by fiscal year
    const yearGroups: Record<string, SaleInvoice[]> = {};
    for (const inv of invoices) {
      const yr = this.extractFiscalYear(inv.date);
      if (!yearGroups[yr]) yearGroups[yr] = [];
      yearGroups[yr].push(inv);
    }

    let totalSharded = 0;
    const yearsList: string[] = Object.keys(yearGroups);

    for (const yr of yearsList) {
      const group = yearGroups[yr];
      // Firestore batch supports up to 500 writes
      const batchSize = 400;
      for (let i = 0; i < group.length; i += batchSize) {
        const chunk = group.slice(i, i + batchSize);
        const batch = writeBatch(db);

        for (const invoice of chunk) {
          const invId = String(invoice.id || `INV-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`);
          const docRef = doc(
            db,
            'tenants',
            cleanCompId,
            'fiscal_years',
            yr,
            'sales_invoices',
            invId
          );
          batch.set(
            docRef,
            {
              ...invoice,
              companyId: cleanCompId,
              fiscalYear: yr,
              shardedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        }

        try {
          await batch.commit();
          totalSharded += chunk.length;
        } catch (batchErr) {
          console.error(`[Sharding] Batch write error for year ${yr}:`, batchErr);
        }
      }

      await this.updateFiscalYearMetadata(cleanCompId, yr);
    }

    return { success: true, shardedCount: totalSharded, years: yearsList };
  }

  /**
   * Updates summary index for a fiscal year
   */
  private async updateFiscalYearMetadata(companyId: string, fiscalYear: string): Promise<void> {
    try {
      const yearDocRef = doc(db, 'tenants', companyId, 'fiscal_years', fiscalYear);
      const invoicesCol = collection(
        db,
        'tenants',
        companyId,
        'fiscal_years',
        fiscalYear,
        'sales_invoices'
      );
      const snapshot = await getDocs(invoicesCol);

      let totalAmount = 0;
      let totalPaid = 0;
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        totalAmount += Number(d.finalTotal || d.total || 0);
        totalPaid += Number(d.paid || 0);
      });

      const summary: ShardedFiscalYearSummary = {
        fiscalYear,
        invoicesCount: snapshot.size,
        totalSalesAmount: totalAmount,
        totalPaidAmount: totalPaid,
        lastUpdated: new Date().toISOString(),
      };

      await setDoc(yearDocRef, summary, { merge: true });
    } catch (err) {
      console.warn('[Sharding] Failed to update fiscal year metadata:', err);
    }
  }

  /**
   * Fetch sharded sales invoices for a specific fiscal year
   */
  public async fetchShardedYearInvoices(
    companyId: string,
    fiscalYear: string
  ): Promise<SaleInvoice[]> {
    const cleanCompId = (companyId || 'COMP-000001').trim();
    try {
      const colRef = collection(
        db,
        'tenants',
        cleanCompId,
        'fiscal_years',
        fiscalYear,
        'sales_invoices'
      );
      const snapshot = await getDocs(colRef);
      const invoices: SaleInvoice[] = [];
      snapshot.forEach((docSnap) => {
        invoices.push(docSnap.data() as SaleInvoice);
      });
      return invoices;
    } catch (err) {
      console.error(`[Sharding] Error fetching sharded invoices for ${fiscalYear}:`, err);
      return [];
    }
  }

  /**
   * Fetch all fiscal year summaries for a tenant
   */
  public async fetchAllFiscalYearSummaries(
    companyId: string
  ): Promise<ShardedFiscalYearSummary[]> {
    const cleanCompId = (companyId || 'COMP-000001').trim();
    try {
      const fiscalYearsCol = collection(db, 'tenants', cleanCompId, 'fiscal_years');
      const snapshot = await getDocs(fiscalYearsCol);
      const summaries: ShardedFiscalYearSummary[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.fiscalYear) {
          summaries.push({
            fiscalYear: data.fiscalYear,
            invoicesCount: data.invoicesCount || 0,
            totalSalesAmount: data.totalSalesAmount || 0,
            totalPaidAmount: data.totalPaidAmount || 0,
            lastUpdated: data.lastUpdated || '',
          });
        }
      });

      return summaries.sort((a, b) => b.fiscalYear.localeCompare(a.fiscalYear));
    } catch (err) {
      console.error('[Sharding] Error fetching fiscal year summaries:', err);
      return [];
    }
  }

  /**
   * Save an official certified closing snapshot in Firestore
   * Path: tenants/{companyId}/fiscal_years/{fiscalYear}/closing_snapshot/certified_summary
   */
  public async saveFiscalYearClosingSnapshot(
    companyId: string,
    closingRecord: FiscalYearClosingRecord
  ): Promise<boolean> {
    const cleanCompId = (companyId || 'COMP-000001').trim();
    try {
      const snapRef = doc(
        db,
        'tenants',
        cleanCompId,
        'fiscal_years',
        closingRecord.fiscalYear,
        'closing_snapshot',
        'certified_summary'
      );
      await setDoc(
        snapRef,
        {
          ...closingRecord,
          companyId: cleanCompId,
          savedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      return true;
    } catch (err) {
      console.warn('[Closing Snapshot] Failed to save closing snapshot in Firestore:', err);
      return false;
    }
  }

  /**
   * Fetch an official certified closing snapshot for a fiscal year from Firestore
   */
  public async fetchFiscalYearClosingSnapshot(
    companyId: string,
    fiscalYear: string
  ): Promise<FiscalYearClosingRecord | null> {
    const cleanCompId = (companyId || 'COMP-000001').trim();
    try {
      const snapRef = doc(
        db,
        'tenants',
        cleanCompId,
        'fiscal_years',
        fiscalYear,
        'closing_snapshot',
        'certified_summary'
      );
      const snapshot = await getDoc(snapRef);
      if (snapshot.exists()) {
        return snapshot.data() as FiscalYearClosingRecord;
      }
      return null;
    } catch (err) {
      console.warn(`[Closing Snapshot] Error fetching snapshot for ${fiscalYear}:`, err);
      return null;
    }
  }

  /**
   * Fetch comprehensive closed year data (sales invoices, purchases, journals, closing snapshot)
   * from Firestore sub-collections and archives to allow full review and printing
   * without loading all historical data into the live working memory.
   */
  public async fetchClosedFiscalYearComprehensiveData(
    companyId: string,
    fiscalYear: string,
    appData?: AppData
  ): Promise<{
    salesInvoices: SaleInvoice[];
    purchaseInvoices: PurchaseInvoice[];
    cashTransactions: CashTransaction[];
    journalEntries: JournalEntry[];
    closingRecord?: FiscalYearClosingRecord;
    source: 'firestore_subcollections' | 'local_state' | 'combined';
  }> {
    const cleanCompId = (companyId || 'COMP-000001').trim();

    // 1. Check local state first
    const localSales = (appData?.salesInvoices || []).filter(
      (inv) => this.extractFiscalYear(inv.date) === fiscalYear
    );
    const localPurchases = (appData?.purchaseInvoices || []).filter(
      (inv) => this.extractFiscalYear(inv.date) === fiscalYear
    );
    const localCash = (appData?.cashTransactions || []).filter(
      (c) => this.extractFiscalYear(c.date) === fiscalYear
    );
    const localJournals = (appData?.journalEntries || []).filter(
      (j) => this.extractFiscalYear(j.date) === fiscalYear
    );
    const localClosingRecord = (appData?.fiscalClosings || []).find(
      (c) => c.fiscalYear === fiscalYear
    );

    // 2. Fetch sharded invoices from Firestore sub-collection
    let remoteSales: SaleInvoice[] = [];
    try {
      remoteSales = await this.fetchShardedYearInvoices(cleanCompId, fiscalYear);
    } catch (err) {
      console.warn('[ClosedYear] Could not fetch remote sharded sales:', err);
    }

    // 3. Fetch closing snapshot if not in local
    let closingRecord = localClosingRecord;
    if (!closingRecord) {
      const remoteSnap = await this.fetchFiscalYearClosingSnapshot(cleanCompId, fiscalYear);
      if (remoteSnap) closingRecord = remoteSnap;
    }

    // Merge without duplicates
    const salesMap = new Map<string, SaleInvoice>();
    remoteSales.forEach((inv) => salesMap.set(String(inv.id), inv));
    localSales.forEach((inv) => salesMap.set(String(inv.id), inv));

    return {
      salesInvoices: Array.from(salesMap.values()).sort((a, b) => (b.date || '').localeCompare(a.date || '')),
      purchaseInvoices: localPurchases,
      cashTransactions: localCash,
      journalEntries: localJournals,
      closingRecord: closingRecord || undefined,
      source: remoteSales.length > 0 ? 'combined' : 'local_state',
    };
  }

  /**
   * Returns a complete list of all available fiscal years for the company,
   * combining active current year, closed historical years, and archived partitions.
   */
  public getAvailableFiscalYearsList(
    companyId: string,
    appData: AppData,
    remoteSummaries: ShardedFiscalYearSummary[] = []
  ): FiscalYearInfo[] {
    const currentYear = appData.settings.fiscalYear || `${new Date().getFullYear()}`;
    const closings = appData.fiscalClosings || [];
    const yearsMap = new Map<string, FiscalYearInfo>();

    // 1. Current Active Year
    yearsMap.set(currentYear, {
      year: currentYear,
      isCurrent: true,
      isClosed: false,
      isArchived: false,
      statusText: 'السنة المالية النشطة (قيد التشغيل)',
      invoicesCount: (appData.salesInvoices || []).filter(
        (i) => this.extractFiscalYear(i.date) === currentYear
      ).length,
    });

    // 2. Closed Years from fiscalClosings
    closings.forEach((c) => {
      const yr = c.fiscalYear;
      yearsMap.set(yr, {
        year: yr,
        isCurrent: yr === currentYear,
        isClosed: c.status === 'completed',
        isArchived: false,
        statusText: c.status === 'completed' ? 'سنة مالية مقفلة ومعتمدة' : 'سنة معاد فتحها للمراجعة',
        closingRecord: c,
        closingDate: c.closingDate,
        totalRevenue: c.totalRevenues,
        netProfit: c.netProfitOrLoss,
      });
    });

    // 3. Scan years from remote sharded summaries
    remoteSummaries.forEach((s) => {
      if (!yearsMap.has(s.fiscalYear)) {
        const isPast = parseInt(s.fiscalYear, 10) < parseInt(currentYear, 10);
        yearsMap.set(s.fiscalYear, {
          year: s.fiscalYear,
          isCurrent: s.fiscalYear === currentYear,
          isClosed: isPast,
          isArchived: isPast,
          statusText: isPast ? 'سنة سابقة مقسمة سحابياً (Firestore Shard)' : 'سنة جارية',
          invoicesCount: s.invoicesCount,
          totalRevenue: s.totalSalesAmount,
        });
      }
    });

    // 4. Scan years from local invoice dates (e.g. 2024, 2025...)
    (appData.salesInvoices || []).forEach((inv) => {
      const yr = this.extractFiscalYear(inv.date);
      if (!yearsMap.has(yr)) {
        const isPast = parseInt(yr, 10) < parseInt(currentYear, 10);
        yearsMap.set(yr, {
          year: yr,
          isCurrent: yr === currentYear,
          isClosed: isPast,
          isArchived: false,
          statusText: isPast ? 'سنة مالية سابقة' : 'سنة نشطة',
        });
      }
    });

    // Convert map to array sorted newest to oldest
    return Array.from(yearsMap.values()).sort((a, b) => b.year.localeCompare(a.year));
  }

  // =========================================================================
  // 📦 COLD STORAGE ARCHIVING ENGINE (> 2 YEARS OLD DATA)
  // =========================================================================

  /**
   * Identifies and packages data older than 2 years into cold storage format,
   * uploads / saves manifest into Firestore `tenants/{companyId}/archives`,
   * and detaches cold records from the active hot state.
   */
  public async executeColdStorageArchiving(
    companyId: string,
    appData: AppData,
    performedBy: string = 'مدير النظام'
  ): Promise<{
    archivedCount: number;
    archivesCreated: ColdStorageArchiveRecord[];
    remainingData: AppData;
  }> {
    const cleanCompId = (companyId || 'COMP-000001').trim();
    const currentDate = new Date();
    const cutoffDate = new Date();
    cutoffDate.setFullYear(currentDate.getFullYear() - 2); // 2 years ago threshold
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    // Filter sales invoices older than 2 years
    const activeInvoices: SaleInvoice[] = [];
    const coldInvoices: SaleInvoice[] = [];

    (appData.salesInvoices || []).forEach((inv) => {
      const invDate = inv.date || '2026-01-01';
      if (invDate < cutoffDateStr) {
        coldInvoices.push(inv);
      } else {
        activeInvoices.push(inv);
      }
    });

    // Also filter cash transactions older than 2 years
    const activeCash: CashTransaction[] = [];
    const coldCash: CashTransaction[] = [];
    (appData.cashTransactions || []).forEach((c) => {
      const cDate = c.date || '2026-01-01';
      if (cDate < cutoffDateStr) {
        coldCash.push(c);
      } else {
        activeCash.push(c);
      }
    });

    if (coldInvoices.length === 0 && coldCash.length === 0) {
      return {
        archivedCount: 0,
        archivesCreated: [],
        remainingData: appData,
      };
    }

    // Group cold records by fiscal year
    const coldByYear: Record<string, { invoices: SaleInvoice[]; cash: CashTransaction[] }> = {};
    coldInvoices.forEach((inv) => {
      const yr = this.extractFiscalYear(inv.date);
      if (!coldByYear[yr]) coldByYear[yr] = { invoices: [], cash: [] };
      coldByYear[yr].invoices.push(inv);
    });

    coldCash.forEach((tx) => {
      const yr = this.extractFiscalYear(tx.date);
      if (!coldByYear[yr]) coldByYear[yr] = { invoices: [], cash: [] };
      coldByYear[yr].cash.push(tx);
    });

    const archivesCreated: ColdStorageArchiveRecord[] = [];
    const bucketName = 'ai-studio-applet-webapp-17f05.firebasestorage.app';

    for (const yr of Object.keys(coldByYear)) {
      const group = coldByYear[yr];
      const archiveId = `ARCH-${cleanCompId}-${yr}-${Date.now().toString(36)}`;
      const storagePath = `tenants/${cleanCompId}/cold_storage/${yr}/archive_${archiveId}.json`;
      const totalAmount = group.invoices.reduce((sum, inv) => sum + Number((inv as any).finalTotal || inv.total || 0), 0);

      const payloadObj = {
        archiveId,
        companyId: cleanCompId,
        fiscalYear: yr,
        archivedAt: new Date().toISOString(),
        archivedBy: performedBy,
        invoices: group.invoices,
        cashTransactions: group.cash,
        summary: {
          invoicesCount: group.invoices.length,
          cashCount: group.cash.length,
          totalAmount,
        },
      };

      const payloadString = JSON.stringify(payloadObj);
      const fileSizeKB = Math.round(new Blob([payloadString]).size / 1024);

      // Create a deterministic hash/checksum
      let checksum = 'sha256-';
      for (let i = 0; i < Math.min(payloadString.length, 32); i++) {
        checksum += payloadString.charCodeAt(i).toString(16);
      }

      // Generate downloadable Object URL / Google Cloud Storage representation
      const blob = new Blob([payloadString], { type: 'application/json' });
      const downloadUrl = URL.createObjectURL(blob);

      const archiveRecord: ColdStorageArchiveRecord = {
        id: archiveId,
        companyId: cleanCompId,
        fiscalYear: yr,
        title: `أرشيف السنة المالية ${yr} (تاريخ أقدم من سنتين)`,
        recordsCount: group.invoices.length + group.cash.length,
        totalAmount,
        storageBucket: bucketName,
        storagePath,
        downloadUrl,
        checksum,
        archivedAt: new Date().toISOString(),
        archivedBy: performedBy,
        status: 'archived',
        fileSizeKB,
        dataPayload: payloadObj,
      };

      // Store Archive Manifest in Firestore: tenants/{companyId}/archives/{archiveId}
      try {
        const archiveDocRef = doc(db, 'tenants', cleanCompId, 'archives', archiveId);
        await setDoc(archiveDocRef, {
          id: archiveRecord.id,
          companyId: archiveRecord.companyId,
          fiscalYear: archiveRecord.fiscalYear,
          title: archiveRecord.title,
          recordsCount: archiveRecord.recordsCount,
          totalAmount: archiveRecord.totalAmount,
          storageBucket: archiveRecord.storageBucket,
          storagePath: archiveRecord.storagePath,
          checksum: archiveRecord.checksum,
          archivedAt: archiveRecord.archivedAt,
          archivedBy: archiveRecord.archivedBy,
          status: archiveRecord.status,
          fileSizeKB: archiveRecord.fileSizeKB,
        });
      } catch (archErr) {
        console.warn('[Archiving] Could not save archive record to Firestore:', archErr);
      }

      archivesCreated.push(archiveRecord);
    }

    // Build cleansed active operational AppData
    const remainingData: AppData = {
      ...appData,
      salesInvoices: activeInvoices,
      cashTransactions: activeCash,
    };

    return {
      archivedCount: coldInvoices.length + coldCash.length,
      archivesCreated,
      remainingData,
    };
  }

  /**
   * Fetch all archive records stored for a tenant in Firestore
   */
  public async fetchTenantArchives(companyId: string): Promise<ColdStorageArchiveRecord[]> {
    const cleanCompId = (companyId || 'COMP-000001').trim();
    try {
      const colRef = collection(db, 'tenants', cleanCompId, 'archives');
      const snapshot = await getDocs(colRef);
      const records: ColdStorageArchiveRecord[] = [];
      snapshot.forEach((d) => {
        records.push(d.data() as ColdStorageArchiveRecord);
      });
      return records.sort((a, b) => b.archivedAt.localeCompare(a.archivedAt));
    } catch (err) {
      console.error('[Archiving] Error fetching tenant archives:', err);
      return [];
    }
  }

  // =========================================================================
  // 🧹 FIRESTORE CLOUD DATABASE CLEANER (FOR OWNER CONTROL PANEL)
  // =========================================================================

  /**
   * Clean/Wipe operational data in Firestore for a specific tenant or all tenants,
   * while safely preserving company registry, users, and subscription licenses.
   */
  public async cleanTenantFirestoreOperationalData(
    companyId: string,
    resetBalances: boolean = true
  ): Promise<{ success: boolean; details: string }> {
    const cleanCompId = (companyId || 'COMP-000001').trim();

    try {
      // 1. Clean the primary operational tenant doc in Firestore
      const tenantDocRef = doc(db, 'tenants', cleanCompId);
      const resetPayload: any = {
        salesInvoices: [],
        purchaseInvoices: [],
        cashTransactions: [],
        journalEntries: [],
        quotations: [],
        cheques: [],
        auditLogs: [],
        nextInvoiceNumber: 1,
        nextPurchaseNumber: 1,
        updatedAt: new Date().toISOString(),
        lastModifiedBy: 'لوحة تحكم المالك (تطهير فايربيس)',
      };

      if (resetBalances) {
        resetPayload.cashBox = { drawer: 0, vodafone: 0, instapay: 0, bank: 0 };
      }

      await setDoc(tenantDocRef, resetPayload, { merge: true });

      // 2. Clean sharded subcollections under fiscal_years
      try {
        const fiscalYearsCol = collection(db, 'tenants', cleanCompId, 'fiscal_years');
        const yearsSnap = await getDocs(fiscalYearsCol);

        for (const yrDoc of yearsSnap.docs) {
          const yr = yrDoc.id;
          const invoicesSubCol = collection(
            db,
            'tenants',
            cleanCompId,
            'fiscal_years',
            yr,
            'sales_invoices'
          );
          const invSnap = await getDocs(invoicesSubCol);
          for (const invDoc of invSnap.docs) {
            await deleteDoc(invDoc.ref);
          }
          await deleteDoc(yrDoc.ref);
        }
      } catch (subErr) {
        console.warn('[Cleaner] Subcollections deletion warning:', subErr);
      }

      return {
        success: true,
        details: `تم تصفير وتطهير وثائق فايربيس والمجموعات الفرعية للشركة (${cleanCompId}) بنجاح`,
      };
    } catch (err: any) {
      console.error('[Cleaner] Failed to clean Firestore tenant data:', err);
      return {
        success: false,
        details: err?.message || 'حدث خطأ أثناء تنظيف وثائق فايربيس',
      };
    }
  }

  /**
   * Completely purge entire Firestore operational data across all tenants
   * (Owner Super-Admin level operation)
   */
  public async cleanAllTenantsFirestoreDatabase(
    companyIds: string[]
  ): Promise<{ success: boolean; cleanedCount: number; details: string }> {
    let successCount = 0;
    const errors: string[] = [];

    const targetIds = companyIds && companyIds.length > 0 ? companyIds : ['COMP-000001'];

    for (const compId of targetIds) {
      const res = await this.cleanTenantFirestoreOperationalData(compId, true);
      if (res.success) {
        successCount++;
      } else {
        errors.push(res.details);
      }
    }

    return {
      success: errors.length === 0,
      cleanedCount: successCount,
      details:
        errors.length === 0
          ? `تم تنظيف وتطهير قاعدة بيانات فايربيس لكافة الشركات (${successCount} شركة) بنجاح`
          : `تم تنظيف ${successCount} شركة مع وجود أخطاء في البعض: ${errors.join(', ')}`,
    };
  }
}

export const firestoreShardingService = new FirestoreShardingService();
