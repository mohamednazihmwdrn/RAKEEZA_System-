import {
  doc,
  setDoc,
  onSnapshot,
  getDoc,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import { AppData } from '../types';
import { firestoreShardingService } from './firestoreShardingService';

/**
 * ⚡ Real-time Multi-Device Sync Engine using Google Cloud Firestore
 *
 * Provides instantaneous, sub-second bi-directional synchronization
 * across managers, cashiers, and mobile devices without requiring any manual page reload.
 */

class FirebaseRealtimeService {
  private activeUnsubscribes: Map<string, Unsubscribe> = new Map();
  private isConnected: boolean = false;
  private lastLocalPushTimestamp: number = 0;
  private syncListeners: Set<(connected: boolean, lastSyncTime?: string) => void> = new Set();
  private pendingPushTimeout: any = null;

  /**
   * Subscribe to real-time company business data (invoices, cash, inventory, accounts)
   */
  public subscribeToCompanyData(
    companyId: string,
    onDataReceived: (data: Partial<AppData>, sourceDeviceId?: string) => void,
    onError?: (err: any) => void
  ): () => void {
    const cleanId = (companyId || 'COMP-000001').trim();
    const docRef = doc(db, 'tenants', cleanId);

    // Stop existing listener for this company if any
    this.unsubscribeCompany(cleanId);

    try {
      const unsub = onSnapshot(
        docRef,
        (snapshot) => {
          this.isConnected = true;
          this.notifyStatusListeners(true);

          if (!snapshot.exists()) {
            return;
          }

          const rawData = snapshot.data() as any;
          if (!rawData) return;

          // Avoid echo-loops if change originated from this client within 1.5s
          const timeSinceOurPush = Date.now() - this.lastLocalPushTimestamp;
          const myDeviceId = this.getDeviceId();
          if (rawData.lastModifiedDeviceId === myDeviceId && timeSinceOurPush < 1500) {
            return;
          }

          // Build partial update
          const remoteUpdates: Partial<AppData> = {};
          if (Array.isArray(rawData.salesInvoices)) remoteUpdates.salesInvoices = rawData.salesInvoices;
          if (Array.isArray(rawData.purchaseInvoices)) remoteUpdates.purchaseInvoices = rawData.purchaseInvoices;
          if (Array.isArray(rawData.cashTransactions)) remoteUpdates.cashTransactions = rawData.cashTransactions;
          if (Array.isArray(rawData.items)) remoteUpdates.items = rawData.items;
          if (Array.isArray(rawData.customers)) remoteUpdates.customers = rawData.customers;
          if (Array.isArray(rawData.suppliers)) remoteUpdates.suppliers = rawData.suppliers;
          if (Array.isArray(rawData.accounts)) remoteUpdates.accounts = rawData.accounts;
          if (rawData.cashBox) remoteUpdates.cashBox = rawData.cashBox;
          if (Array.isArray(rawData.bankAccounts)) remoteUpdates.bankAccounts = rawData.bankAccounts;
          if (Array.isArray(rawData.journalEntries)) remoteUpdates.journalEntries = rawData.journalEntries;
          if (Array.isArray(rawData.cheques)) remoteUpdates.cheques = rawData.cheques;
          if (Array.isArray(rawData.quotations)) remoteUpdates.quotations = rawData.quotations;
          if (Array.isArray(rawData.auditLogs)) remoteUpdates.auditLogs = rawData.auditLogs;
          if (typeof rawData.nextInvoiceNumber === 'number') remoteUpdates.nextInvoiceNumber = rawData.nextInvoiceNumber;
          if (typeof rawData.nextPurchaseNumber === 'number') remoteUpdates.nextPurchaseNumber = rawData.nextPurchaseNumber;
          if (rawData.settings) remoteUpdates.settings = rawData.settings;

          onDataReceived(remoteUpdates, rawData.lastModifiedDeviceId);
        },
        (error) => {
          console.warn('[Firebase Realtime] Listener error:', error);
          this.isConnected = false;
          this.notifyStatusListeners(false);
          if (onError) onError(error);
        }
      );

      this.activeUnsubscribes.set(cleanId, unsub);
      return () => this.unsubscribeCompany(cleanId);
    } catch (err) {
      console.error('[Firebase Realtime] Failed to initialize listener:', err);
      if (onError) onError(err);
      return () => {};
    }
  }

  /**
   * Push an update immediately to Cloud Firestore to instantly notify other devices
   */
  public async pushUpdateInstant(
    companyId: string,
    data: Partial<AppData>,
    performedByUserName?: string
  ): Promise<boolean> {
    const cleanId = (companyId || 'COMP-000001').trim();
    this.lastLocalPushTimestamp = Date.now();

    const payload: any = {
      companyId: cleanId,
      updatedAt: new Date().toISOString(),
      serverUpdatedAt: serverTimestamp(),
      lastModifiedDeviceId: this.getDeviceId(),
      lastModifiedBy: performedByUserName || 'مستخدم النظام',
    };

    if (data.salesInvoices) payload.salesInvoices = data.salesInvoices;
    if (data.purchaseInvoices) payload.purchaseInvoices = data.purchaseInvoices;
    if (data.cashTransactions) payload.cashTransactions = data.cashTransactions;
    if (data.items) payload.items = data.items;
    if (data.customers) payload.customers = data.customers;
    if (data.suppliers) payload.suppliers = data.suppliers;
    if (data.accounts) payload.accounts = data.accounts;
    if (data.cashBox) payload.cashBox = data.cashBox;
    if (data.bankAccounts) payload.bankAccounts = data.bankAccounts;
    if (data.journalEntries) payload.journalEntries = data.journalEntries;
    if (data.cheques) payload.cheques = data.cheques;
    if (data.quotations) payload.quotations = data.quotations;
    if (data.auditLogs) payload.auditLogs = data.auditLogs.slice(0, 100);
    if (typeof data.nextInvoiceNumber === 'number') payload.nextInvoiceNumber = data.nextInvoiceNumber;
    if (typeof data.nextPurchaseNumber === 'number') payload.nextPurchaseNumber = data.nextPurchaseNumber;
    if (data.settings) {
      const cleanSettings = { ...data.settings };
      if (cleanSettings.logo && typeof cleanSettings.logo === 'string' && cleanSettings.logo.length > 150000) {
        cleanSettings.logo = '';
      }
      payload.settings = cleanSettings;
    }

    try {
      const docRef = doc(db, 'tenants', cleanId);
      await setDoc(docRef, payload, { merge: true });
      this.isConnected = true;
      this.notifyStatusListeners(true);

      // 🛡️ Data Sharding: Asynchronously shard latest invoice into fiscal_years sub-collection
      if (data.salesInvoices && data.salesInvoices.length > 0) {
        const latestInv = data.salesInvoices[0];
        if (latestInv) {
          firestoreShardingService.shardSingleInvoice(cleanId, latestInv).catch(() => {});
        }
      }

      return true;
    } catch (err) {
      console.warn('[Firebase Realtime] Instant push failed:', err);
      return false;
    }
  }

  /**
   * Debounced push for rapid edits (e.g. typing or sequential line items)
   */
  public pushUpdateDebounced(
    companyId: string,
    data: Partial<AppData>,
    delayMs = 300
  ): void {
    if (this.pendingPushTimeout) {
      clearTimeout(this.pendingPushTimeout);
    }
    this.pendingPushTimeout = setTimeout(() => {
      this.pushUpdateInstant(companyId, data);
    }, delayMs);
  }

  /**
   * Fetch one-time initial snapshot
   */
  public async getCompanyDataOnce(companyId: string): Promise<Partial<AppData> | null> {
    const cleanId = (companyId || 'COMP-000001').trim();
    try {
      const docRef = doc(db, 'tenants', cleanId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return snap.data() as Partial<AppData>;
      }
    } catch (err) {
      console.warn('[Firebase Realtime] Fetch once error:', err);
    }
    return null;
  }

  /**
   * Unsubscribe from a company document
   */
  public unsubscribeCompany(companyId: string): void {
    const unsub = this.activeUnsubscribes.get(companyId);
    if (unsub) {
      unsub();
      this.activeUnsubscribes.delete(companyId);
    }
  }

  /**
   * Clear all active listeners
   */
  public stopAll(): void {
    for (const [id, unsub] of this.activeUnsubscribes.entries()) {
      unsub();
    }
    this.activeUnsubscribes.clear();
    this.isConnected = false;
  }

  /**
   * Connection status listener
   */
  public onStatusChange(callback: (connected: boolean) => void): () => void {
    this.syncListeners.add(callback);
    callback(this.isConnected);
    return () => {
      this.syncListeners.delete(callback);
    };
  }

  private notifyStatusListeners(connected: boolean): void {
    for (const listener of this.syncListeners) {
      try {
        listener(connected);
      } catch {}
    }
  }

  private getDeviceId(): string {
    let id = localStorage.getItem('rakeeza_device_uuid');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      localStorage.setItem('rakeeza_device_uuid', id);
    }
    return id;
  }
}

export const firebaseRealtime = new FirebaseRealtimeService();
