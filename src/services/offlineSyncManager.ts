import { AppData } from '../types';
import { saveTenantDataCloud } from './cloudApi';
import { realtimeSync } from './realtimeSync';

export interface OfflineMutation {
  id: string;
  companyId: string;
  timestamp: string;
  data: Partial<AppData>;
  actionInfo?: {
    action?: string;
    module?: string;
    details?: string;
    userCode?: string | number;
  };
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: string | null;
  lastError: string | null;
}

const QUEUE_KEY_PREFIX = 'rakeeza_offline_mutations_';

class OfflineSyncManager {
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private isSyncing: boolean = false;
  private lastSyncTime: string | null = null;
  private lastError: string | null = null;
  private activeCompanyId: string = 'COMP-000001';
  private subscribers: Set<(status: SyncStatus) => void> = new Set();
  private dataUpdateCallback: ((newData: AppData) => void) | null = null;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnlineEvent);
      window.addEventListener('offline', this.handleOfflineEvent);

      // Periodic check every 15 seconds to ensure queue is flushed once connection is healthy
      this.checkInterval = setInterval(() => {
        if (this.isOnline && !this.isSyncing) {
          const queue = this.getQueue(this.activeCompanyId);
          if (queue.length > 0) {
            this.flushQueue(this.activeCompanyId);
          }
        }
      }, 15000);
    }
  }

  public setCompanyId(companyId: string) {
    if (companyId && companyId !== this.activeCompanyId) {
      this.activeCompanyId = companyId;
      this.notifySubscribers();
    }
  }

  public setDataUpdateCallback(cb: (newData: AppData) => void) {
    this.dataUpdateCallback = cb;
  }

  public subscribe(cb: (status: SyncStatus) => void) {
    this.subscribers.add(cb);
    cb(this.getStatus());
    return () => {
      this.subscribers.delete(cb);
    };
  }

  public getStatus(): SyncStatus {
    const queue = this.getQueue(this.activeCompanyId);
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      pendingCount: queue.length,
      lastSyncTime: this.lastSyncTime,
      lastError: this.lastError,
    };
  }

  private notifySubscribers() {
    const status = this.getStatus();
    this.subscribers.forEach((cb) => {
      try {
        cb(status);
      } catch (err) {
        console.error('Error notifying sync subscriber:', err);
      }
    });
  }

  private handleOnlineEvent = () => {
    this.isOnline = true;
    this.lastError = null;
    this.notifySubscribers();
    // Automatically flush pending changes on reconnection
    this.flushQueue(this.activeCompanyId);
  };

  private handleOfflineEvent = () => {
    this.isOnline = false;
    this.notifySubscribers();
  };

  public getQueue(companyId: string = this.activeCompanyId): OfflineMutation[] {
    try {
      const raw = localStorage.getItem(`${QUEUE_KEY_PREFIX}${companyId}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private setQueue(companyId: string, queue: OfflineMutation[]) {
    try {
      localStorage.setItem(`${QUEUE_KEY_PREFIX}${companyId}`, JSON.stringify(queue));
    } catch (e) {
      console.warn('Failed to save offline queue to localStorage:', e);
    }
    this.notifySubscribers();
  }

  /**
   * Records a mutation to be synchronized
   */
  public queueMutation(
    companyId: string,
    data: Partial<AppData>,
    actionInfo?: OfflineMutation['actionInfo']
  ): void {
    const cleanId = companyId || this.activeCompanyId;
    const queue = this.getQueue(cleanId);

    const mutation: OfflineMutation = {
      id: `mut-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      companyId: cleanId,
      timestamp: new Date().toISOString(),
      data,
      actionInfo,
    };

    // Replace or append (if queue gets large, keep latest snapshot)
    queue.push(mutation);
    // Keep at most 100 mutations
    const trimmed = queue.slice(-100);
    this.setQueue(cleanId, trimmed);
  }

  /**
   * Flushes all queued mutations to the cloud server and Firestore
   */
  public async flushQueue(
    companyId: string = this.activeCompanyId,
    forcedData?: Partial<AppData>
  ): Promise<{ success: boolean; flushedCount: number; error?: string }> {
    const cleanId = companyId || this.activeCompanyId;
    const queue = this.getQueue(cleanId);

    if (!navigator.onLine) {
      this.isOnline = false;
      this.notifySubscribers();
      return { success: false, flushedCount: 0, error: 'الجهاز غير متصل بالإنترنت حالياً' };
    }

    if (queue.length === 0 && !forcedData) {
      return { success: true, flushedCount: 0 };
    }

    this.isSyncing = true;
    this.lastError = null;
    this.notifySubscribers();

    try {
      // Find latest combined state
      const latestData: Partial<AppData> = forcedData || {};
      if (!forcedData && queue.length > 0) {
        // Merge from newest to oldest or take latest snapshot
        const lastMutation = queue[queue.length - 1];
        Object.assign(latestData, lastMutation.data);
      }

      // 1. Sync to Express Cloud Backend
      const saveRes = await saveTenantDataCloud(latestData, cleanId, {
        action: 'مزامنة تلقائية للعمليات دون اتصال',
        module: 'المزامنة السحابية',
        details: `مزامنة ${queue.length} عمليات مخزنة محلياً أثناء انقطاع الاتصال`,
      });

      // 2. Broadcast via Firestore
      await realtimeSync.broadcastChange(cleanId, latestData, {
        action: 'مزامنة تلقائية',
        module: 'المزامنة السحابية',
        details: `تمت مزامنة العمليات بعد استعادة الاتصال`,
      });

      // Clear queue on success
      const count = queue.length;
      this.setQueue(cleanId, []);
      this.lastSyncTime = new Date().toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      this.isOnline = true;
      this.isSyncing = false;
      this.notifySubscribers();

      return { success: true, flushedCount: count };
    } catch (err: any) {
      this.lastError = err?.message || 'فشلت المزامنة مع الخادم السحابي';
      this.isSyncing = false;
      this.notifySubscribers();
      return { success: false, flushedCount: 0, error: this.lastError };
    }
  }

  public clearQueue(companyId: string = this.activeCompanyId) {
    this.setQueue(companyId, []);
  }

  public destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnlineEvent);
      window.removeEventListener('offline', this.handleOfflineEvent);
    }
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.subscribers.clear();
  }
}

export const offlineSyncManager = new OfflineSyncManager();
