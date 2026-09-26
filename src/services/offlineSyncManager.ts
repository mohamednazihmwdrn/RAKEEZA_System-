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
    deletedId?: string | number;
  };
}

export type SyncState = 'online_synced' | 'online_syncing' | 'offline' | 'error' | 'pending';

export interface SyncStatus {
  state: SyncState;
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

      // Periodic check every 10 seconds to auto-flush pending changes once connection is healthy
      this.checkInterval = setInterval(() => {
        if (this.isOnline && !this.isSyncing) {
          const queue = this.getQueue(this.activeCompanyId);
          if (queue.length > 0) {
            this.flushQueue(this.activeCompanyId);
          }
        }
      }, 10000);
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
    const pendingCount = queue.length;

    let state: SyncState = 'online_synced';
    if (!this.isOnline) {
      state = 'offline';
    } else if (this.isSyncing) {
      state = 'online_syncing';
    } else if (this.lastError) {
      state = 'error';
    } else if (pendingCount > 0) {
      state = 'pending';
    } else {
      state = 'online_synced';
    }

    return {
      state,
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      pendingCount,
      lastSyncTime: this.lastSyncTime,
      lastError: this.lastError,
    };
  }

  public setSyncing(syncing: boolean) {
    this.isSyncing = syncing;
    if (syncing) {
      this.lastError = null;
    }
    this.notifySubscribers();
  }

  public setSyncError(errorMsg: string) {
    this.isSyncing = false;
    this.lastError = errorMsg;
    this.notifySubscribers();
  }

  public markSynchronized() {
    this.isSyncing = false;
    this.lastError = null;
    this.lastSyncTime = new Date().toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    this.notifySubscribers();
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
    this.isSyncing = false;
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
   * Records a mutation to be synchronized safely with deduplication
   */
  public queueMutation(
    companyId: string,
    data: Partial<AppData>,
    actionInfo?: OfflineMutation['actionInfo']
  ): void {
    const cleanId = companyId || this.activeCompanyId;
    const queue = this.getQueue(cleanId);

    // Deduplication check: if identical action and details is already queued in the last 2 seconds
    const now = Date.now();
    const isDuplicate = queue.some((m) => {
      if (actionInfo && m.actionInfo) {
        if (
          m.actionInfo.action === actionInfo.action &&
          m.actionInfo.details === actionInfo.details &&
          m.actionInfo.deletedId === actionInfo.deletedId
        ) {
          const diff = now - new Date(m.timestamp).getTime();
          return diff < 3000;
        }
      }
      return false;
    });

    if (isDuplicate) {
      return;
    }

    const mutation: OfflineMutation = {
      id: `mut-${now}-${Math.random().toString(36).substring(2, 6)}`,
      companyId: cleanId,
      timestamp: new Date().toISOString(),
      data,
      actionInfo,
    };

    queue.push(mutation);
    // Keep at most 100 recent mutations
    const trimmed = queue.slice(-100);
    this.setQueue(cleanId, trimmed);
  }

  /**
   * Flushes all queued mutations to the authoritative cloud server and Firestore
   */
  public async flushQueue(
    companyId: string = this.activeCompanyId,
    forcedData?: Partial<AppData>
  ): Promise<{ success: boolean; flushedCount: number; data?: AppData; error?: string }> {
    const cleanId = companyId || this.activeCompanyId;

    if (this.isSyncing) {
      return { success: true, flushedCount: 0 };
    }

    const queue = this.getQueue(cleanId);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.isOnline = false;
      this.notifySubscribers();
      return { success: false, flushedCount: 0, error: 'الجهاز غير متصل بالإنترنت حالياً' };
    }

    if (queue.length === 0 && !forcedData) {
      this.markSynchronized();
      return { success: true, flushedCount: 0 };
    }

    this.isSyncing = true;
    this.lastError = null;
    this.notifySubscribers();

    try {
      // Find latest combined state
      let combinedData: Partial<AppData> = forcedData || {};
      if (!forcedData && queue.length > 0) {
        // Sequentially fold all queued mutations from oldest to newest
        for (const mut of queue) {
          if (mut.data) {
            combinedData = { ...combinedData, ...mut.data };
          }
        }
      }

      // 1. Sync to Authoritative Express Cloud Backend
      const saveRes = await saveTenantDataCloud(combinedData, cleanId, {
        action: 'مزامنة تلقائية للعمليات دون اتصال',
        module: 'المزامنة السحابية',
        details: `مزامنة ${queue.length} عملية مخزنة محلياً بعد استعادة الاتصال`,
      });

      if (!saveRes.success) {
        throw new Error(saveRes.error || 'فشلت المزامنة مع الخادم السحابي');
      }

      // 2. Broadcast authoritative update via Firestore & BroadcastChannel
      await realtimeSync.broadcastChange(cleanId, saveRes.data || combinedData, {
        action: 'مزامنة تلقائية بعد استعادة الاتصال',
        module: 'المزامنة السحابية',
        details: 'تمت مزامنة العمليات بعد استعادة الاتصال بنجاح',
      });

      // 3. Clear queue strictly on verified cloud success
      const count = queue.length;
      this.setQueue(cleanId, []);
      this.markSynchronized();

      // 4. Update local React state with authoritative server data if callback is registered
      if (saveRes.data && this.dataUpdateCallback) {
        try {
          this.dataUpdateCallback(saveRes.data);
        } catch (cbErr) {
          console.warn('Error in dataUpdateCallback during flush:', cbErr);
        }
      }

      return { success: true, flushedCount: count, data: saveRes.data };
    } catch (err: any) {
      const errMsg = err?.message || 'فشلت المزامنة مع الخادم السحابي';
      this.setSyncError(errMsg);
      return { success: false, flushedCount: 0, error: errMsg };
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
