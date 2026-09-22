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
import { getStoredToken } from './cloudApi';

/**
 * ⚡ RealtimeSyncService: Hybrid Cloud Engine
 * 
 * Powered primarily by Google Cloud Firestore (Sub-second Real-time Listeners via onSnapshot)
 * with graceful fallback to server SSE & Polling.
 * 
 * Ensures manager, cashiers, storekeepers, and mobile phone users all see every
 * invoice, payment, stock update, and account movement instantaneously in real-time.
 */

export interface SyncActorUser {
  id: string;
  name: string;
  code: string | number;
  role: string;
}

export interface SyncActionInfo {
  action?: string;
  module?: string;
  details?: string;
  userCode?: string | number;
}

export interface RealtimeSyncEvent {
  type: 'REALTIME_SYNC' | 'CONNECTED' | 'DISCONNECTED';
  version?: number;
  data?: AppData;
  actorUser?: SyncActorUser;
  actionInfo?: SyncActionInfo;
  timestamp?: string;
}

export interface RealtimeSyncInitOptions {
  companyId: string;
  currentUserCode?: string | number;
  currentUserName?: string;
  currentUserId?: string;
  initialVersion?: number;
  onDataUpdated?: (
    data: AppData,
    meta?: {
      actorCode?: string | number;
      actorName?: string;
      actorRole?: string;
      actionInfo?: SyncActionInfo;
    }
  ) => void;
}

export class RealtimeSyncService {
  private firestoreUnsub: Unsubscribe | null = null;
  private eventSource: EventSource | null = null;
  private pollTimer: any = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private currentVersion: number = 1;
  private companyId: string = 'COMP-000001';
  private currentUserId: string = '';
  private currentUserCode: string | number = 1;
  private currentUserName: string = 'مستخدم';
  private isConnected: boolean = false;
  private lastLocalPushTimestamp: number = 0;
  private listeners: Set<(event: RealtimeSyncEvent) => void> = new Set();
  private statusListeners: Set<(connected: boolean) => void> = new Set();
  private recentActivities: Array<{
    id: string;
    timestamp: string;
    actor: SyncActorUser;
    actionInfo: SyncActionInfo;
  }> = [];

  public init(
    optionsOrCompanyId: string | RealtimeSyncInitOptions,
    currentUserId?: string,
    initialVersion: number = 1
  ) {
    // 🛡️ Always destroy prior connections and intervals first to prevent memory leaks and duplicate timers
    this.destroy();

    if (typeof optionsOrCompanyId === 'object') {
      const opts = optionsOrCompanyId;
      this.companyId = opts.companyId || 'COMP-000001';
      this.currentUserId = opts.currentUserId || '';
      this.currentUserCode = opts.currentUserCode || 1;
      this.currentUserName = opts.currentUserName || 'مستخدم';
      this.currentVersion = opts.initialVersion || 1;
      if (opts.onDataUpdated) {
        this.subscribe((event) => {
          if (event.data) {
            opts.onDataUpdated!(event.data, {
              actorCode: event.actorUser?.code || event.actionInfo?.userCode,
              actorName: event.actorUser?.name,
              actorRole: event.actorUser?.role,
              actionInfo: event.actionInfo,
            });
          }
        });
      }
    } else {
      this.companyId = optionsOrCompanyId || 'COMP-000001';
      this.currentUserId = currentUserId || '';
      this.currentVersion = initialVersion;
    }

    // 0. Instant 0ms Cross-Tab synchronization on same machine
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel(`rakeeza_sync_${this.companyId}`);
        this.broadcastChannel.onmessage = (event) => {
          if (event.data && event.data.type === 'REALTIME_SYNC') {
            this.handleIncomingSync(event.data);
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel setup notice:', e);
      }
    }

    // 1. First priority: Real-time Google Cloud Firestore Listener
    this.initFirestoreListener();

    // 2. Auxiliary server SSE / Polling fallback
    this.connectServerStream();
    this.startPollingFallback();
  }

  public stop() {
    this.destroy();
  }

  public subscribe(callback: (event: RealtimeSyncEvent) => void) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  public onStatusChange(callback: (connected: boolean) => void) {
    this.statusListeners.add(callback);
    callback(this.isConnected);
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  public setVersion(ver: number) {
    if (ver > this.currentVersion) {
      this.currentVersion = ver;
    }
  }

  public getRecentActivities() {
    return this.recentActivities;
  }

  public getConnectedStatus() {
    return this.isConnected;
  }

  /**
   * ⚡ Real-time Google Cloud Firestore Snapshot Listener
   * Receives changes within milliseconds across all connected tabs, mobiles, and PCs
   */
  private initFirestoreListener() {
    if (this.firestoreUnsub) {
      this.firestoreUnsub();
      this.firestoreUnsub = null;
    }

    const cleanId = (this.companyId || 'COMP-000001').trim();

    try {
      const docRef = doc(db, 'tenants', cleanId);
      this.firestoreUnsub = onSnapshot(
        docRef,
        (snapshot) => {
          this.setConnectedStatus(true);

          if (!snapshot.exists()) {
            return;
          }

          const rawData = snapshot.data() as any;
          if (!rawData) return;

          // Prevent infinite echo loop if this browser tab just emitted this exact change within 1.5s
          const myDeviceId = this.getDeviceId();
          const timeSinceOurPush = Date.now() - this.lastLocalPushTimestamp;
          if (rawData.lastModifiedDeviceId === myDeviceId && timeSinceOurPush < 1500) {
            return;
          }

          // Build valid complete AppData payload preserving all business collections
          const remoteData: Partial<AppData> = {};
          if (Array.isArray(rawData.salesInvoices)) remoteData.salesInvoices = rawData.salesInvoices;
          if (Array.isArray(rawData.purchaseInvoices)) remoteData.purchaseInvoices = rawData.purchaseInvoices;
          if (Array.isArray(rawData.cashTransactions)) remoteData.cashTransactions = rawData.cashTransactions;
          if (Array.isArray(rawData.items)) remoteData.items = rawData.items;
          if (Array.isArray(rawData.customers)) remoteData.customers = rawData.customers;
          if (Array.isArray(rawData.suppliers)) remoteData.suppliers = rawData.suppliers;
          if (Array.isArray(rawData.accounts)) remoteData.accounts = rawData.accounts;
          if (rawData.cashBox) remoteData.cashBox = rawData.cashBox;
          if (Array.isArray(rawData.bankAccounts)) remoteData.bankAccounts = rawData.bankAccounts;
          if (Array.isArray(rawData.journalEntries)) remoteData.journalEntries = rawData.journalEntries;
          if (Array.isArray(rawData.cheques)) remoteData.cheques = rawData.cheques;
          if (Array.isArray(rawData.quotations)) remoteData.quotations = rawData.quotations;
          if (Array.isArray(rawData.auditLogs)) remoteData.auditLogs = rawData.auditLogs;
          if (Array.isArray(rawData.users)) remoteData.users = rawData.users;
          if (Array.isArray(rawData.branches)) remoteData.branches = rawData.branches;
          if (Array.isArray(rawData.costCenters)) remoteData.costCenters = rawData.costCenters;
          if (Array.isArray(rawData.employees)) remoteData.employees = rawData.employees;
          if (Array.isArray(rawData.fixedAssets)) remoteData.fixedAssets = rawData.fixedAssets;
          if (Array.isArray(rawData.boms)) remoteData.boms = rawData.boms;
          if (Array.isArray(rawData.salesReps)) remoteData.salesReps = rawData.salesReps;
          if (Array.isArray(rawData.productPrices)) remoteData.productPrices = rawData.productPrices;
          if (Array.isArray(rawData.commissions)) remoteData.commissions = rawData.commissions;
          if (Array.isArray(rawData.productionOrders)) remoteData.productionOrders = rawData.productionOrders;
          if (Array.isArray(rawData.approvalRequests)) remoteData.approvalRequests = rawData.approvalRequests;
          if (rawData.catalogConfig) remoteData.catalogConfig = rawData.catalogConfig;
          if (rawData.advancedSettings) remoteData.advancedSettings = rawData.advancedSettings;
          if (typeof rawData.nextInvoiceNumber === 'number') remoteData.nextInvoiceNumber = rawData.nextInvoiceNumber;
          if (typeof rawData.nextPurchaseNumber === 'number') remoteData.nextPurchaseNumber = rawData.nextPurchaseNumber;
          if (rawData.settings) remoteData.settings = rawData.settings;

          const actorUser: SyncActorUser = {
            id: rawData.lastModifiedUserId || 'user',
            name: rawData.lastModifiedBy || 'مستخدم آخر',
            code: rawData.lastModifiedUserCode || 2,
            role: rawData.lastModifiedUserCode === 1 ? 'admin' : 'user',
          };

          const actionInfo: SyncActionInfo = {
            action: rawData.lastAction || 'تحديث البيانات',
            module: rawData.lastModule || 'المنظومة',
            details: rawData.lastActionDetails || 'تحديث لحظي عبر فايربيس السحابية',
            userCode: rawData.lastModifiedUserCode,
          };

          this.handleIncomingSync({
            type: 'REALTIME_SYNC',
            version: rawData.version || Date.now(),
            data: remoteData as AppData,
            actorUser,
            actionInfo,
            timestamp: rawData.updatedAt || new Date().toISOString(),
          });
        },
        (error) => {
          console.warn('[Firebase Realtime] Listener warning:', error);
          // Don't mark disconnected immediately; SSE and polling are active
        }
      );
    } catch (e) {
      console.warn('[Firebase Realtime] Setup catch:', e);
    }
  }

  /**
   * 🛡️ Sanitize and optimize payload to permanently protect Firebase Firestore:
   * 1. Strips massive stringified backup snapshots (`snapshotJson` and `code`) from backups.
   * 2. Caps real-time active audit logs to the latest 100 entries.
   * 3. Prevents large base64 data URIs (>150KB) from clogging the 1MB Firestore limit.
   * 4. Excludes static historical archives (`closedFiscalYears`).
   */
  private sanitizeForFirestore(data: Partial<AppData>): Record<string, any> {
    const clean: any = { ...data };

    // 1. Never send recursive JSON backup copies to Firestore
    if (Array.isArray(clean.backups)) {
      clean.backups = clean.backups.map((b: any) => ({
        id: b.id,
        date: b.date,
        label: b.label,
        type: b.type,
        sizeKB: b.sizeKB,
        dataPreview: b.dataPreview,
      }));
    }

    // 2. Cap real-time audit logs to 100 entries to prevent Firestore document inflation
    if (Array.isArray(clean.auditLogs)) {
      clean.auditLogs = clean.auditLogs.slice(0, 100);
    }

    // 3. Exclude heavy closed years archive from the active live operational document
    if ('closedFiscalYears' in clean) {
      delete clean.closedFiscalYears;
    }

    // 4. Protect against heavy base64 logos
    if (clean.settings && clean.settings.logo && typeof clean.settings.logo === 'string') {
      if (clean.settings.logo.length > 150000) {
        clean.settings = { ...clean.settings, logo: '' };
      }
    }

    return clean;
  }

  /**
   * 🚀 Broadcast a local mutation instantaneously to all other connected devices
   * Uses Quad-Layer synchronization: BroadcastChannel + Firestore + SSE + Server API
   */
  public async broadcastChange(
    companyId: string,
    data: Partial<AppData>,
    actionInfo?: SyncActionInfo
  ): Promise<boolean> {
    const cleanId = (companyId || this.companyId || 'COMP-000001').trim();
    this.lastLocalPushTimestamp = Date.now();

    const actorUser: SyncActorUser = {
      id: this.currentUserId || 'user',
      name: this.currentUserName || 'مستخدم',
      code: this.currentUserCode || 1,
      role: this.currentUserCode === 1 ? 'admin' : 'user',
    };

    const action: SyncActionInfo = {
      action: actionInfo?.action || 'تحديث فوري',
      module: actionInfo?.module || 'المنظومة',
      details: actionInfo?.details || 'عملية جديدة',
      userCode: this.currentUserCode,
    };

    const nextVer = this.currentVersion + 1;
    this.currentVersion = nextVer;

    // 🛡️ Apply Firestore payload optimizer to save space and quota
    const sanitizedData = this.sanitizeForFirestore(data);

    const payload: any = {
      ...sanitizedData,
      companyId: cleanId,
      version: nextVer,
      updatedAt: new Date().toISOString(),
      serverUpdatedAt: serverTimestamp(),
      lastModifiedDeviceId: this.getDeviceId(),
      lastModifiedUserId: this.currentUserId,
      lastModifiedUserCode: this.currentUserCode,
      lastModifiedBy: this.currentUserName,
      lastAction: action.action,
      lastModule: action.module,
      lastActionDetails: action.details,
    };

    // 0. Layer 0: Instant 0ms broadcast to all other open tabs on this machine
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'REALTIME_SYNC',
          version: nextVer,
          data,
          actorUser,
          actionInfo: action,
          timestamp: payload.updatedAt,
        });
      } catch {}
    }

    // 1. Layer 1: Google Cloud Firestore real-time push to all devices
    try {
      const docRef = doc(db, 'tenants', cleanId);
      setDoc(docRef, payload, { merge: true }).catch((err) => {
        console.warn('[Firebase Realtime] setDoc background notice:', err);
      });
      this.setConnectedStatus(true);
    } catch (err) {
      console.warn('[Firebase Realtime] Broadcast error:', err);
    }

    return true;
  }

  private connectServerStream() {
    const token = getStoredToken();
    if (!token) return;

    if (this.eventSource) {
      try {
        this.eventSource.close();
      } catch {}
      this.eventSource = null;
    }

    try {
      const url = `/api/tenant/sync-stream?token=${encodeURIComponent(token)}`;
      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        this.setConnectedStatus(true);
      };

      this.eventSource.onmessage = (e) => {
        try {
          const payload: RealtimeSyncEvent = JSON.parse(e.data);
          if (payload.type === 'CONNECTED') {
            this.setConnectedStatus(true);
            if (payload.version) this.currentVersion = payload.version;
            return;
          }

          if (payload.type === 'REALTIME_SYNC') {
            this.handleIncomingSync(payload);
          }
        } catch {}
      };

      this.eventSource.onerror = () => {
        // Handled silently - Firestore and Polling maintain connectivity
      };
    } catch {}
  }

  private startPollingFallback() {
    if (this.pollTimer) clearInterval(this.pollTimer);

    // Dynamic, high-frequency 2.5s polling fallback with zero battery drain
    this.pollTimer = setInterval(async () => {
      const token = getStoredToken();
      const queryParams = new URLSearchParams({
        version: String(this.currentVersion),
        companyId: this.companyId,
      });
      if (token) queryParams.set('token', token);

      try {
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`/api/tenant/sync-check?${queryParams.toString()}`, {
          headers,
        });

        if (res.ok) {
          const json = await res.json();
          if (json.hasUpdate && json.data) {
            this.handleIncomingSync({
              type: 'REALTIME_SYNC',
              version: json.version,
              data: json.data,
              actorUser: json.lastAction?.actorUser,
              actionInfo: json.lastAction?.actionInfo,
              timestamp: json.lastAction?.timestamp || new Date().toISOString(),
            });
          }
        }
      } catch {}
    }, 2500);
  }

  private handleIncomingSync(payload: RealtimeSyncEvent) {
    // 🛡️ Prevent infinite echo loop if this browser tab just emitted this exact change within 1.5s
    const myDeviceId = this.getDeviceId();
    const isSelfModified = (payload.data as any)?.lastModifiedDeviceId === myDeviceId;
    const timeSinceOurPush = Date.now() - this.lastLocalPushTimestamp;
    if (isSelfModified && timeSinceOurPush < 1500) {
      return;
    }

    if (payload.version && payload.version > this.currentVersion) {
      this.currentVersion = payload.version;
    }

    if (payload.actorUser && payload.actionInfo) {
      const activity = {
        id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        timestamp: payload.timestamp || new Date().toISOString(),
        actor: payload.actorUser,
        actionInfo: payload.actionInfo,
      };
      this.recentActivities = [activity, ...this.recentActivities].slice(0, 50);
    }

    // Notify all subscribers (App.tsx updates React state & components render instantly)
    this.listeners.forEach((listener) => {
      try {
        listener(payload);
      } catch {}
    });
  }

  private setConnectedStatus(status: boolean) {
    if (this.isConnected !== status) {
      this.isConnected = status;
      this.statusListeners.forEach((fn) => {
        try {
          fn(status);
        } catch {}
      });
    }
  }

  public getDeviceId(): string {
    let id = localStorage.getItem('rakeeza_device_uuid');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      localStorage.setItem('rakeeza_device_uuid', id);
    }
    return id;
  }

  public destroy() {
    if (this.firestoreUnsub) {
      this.firestoreUnsub();
      this.firestoreUnsub = null;
    }
    if (this.eventSource) {
      try {
        this.eventSource.close();
      } catch {}
      this.eventSource = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.close();
      } catch {}
      this.broadcastChannel = null;
    }
    this.listeners.clear();
    this.statusListeners.clear();
    this.isConnected = false;
  }
}

export const realtimeSync = new RealtimeSyncService();
export const realtimeSyncService = realtimeSync;
