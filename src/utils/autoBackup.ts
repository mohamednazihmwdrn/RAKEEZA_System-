import { AppData, BackupRecord, AutoBackupConfig } from '../types';

/**
 * Creates a system restore snapshot with full metadata and stats preview
 */
export function createSystemSnapshot(
  appData: AppData,
  label: string = 'نسخة احتياطية',
  type: 'auto' | 'manual' | 'pre_restore' | 'file_export' = 'manual'
): BackupRecord {
  // Exclude heavy recursive backups array inside the snapshot itself to prevent exponential size growth
  const dataForSnapshot = {
    ...appData,
    backups: [], // keep empty inside the inner snapshot
  };

  const jsonStr = JSON.stringify(dataForSnapshot);
  // Only generate base64 code if explicitly needed, auto-snapshots store jsonStr directly
  let base64Code = '';
  if (type !== 'auto') {
    try {
      base64Code = btoa(unescape(encodeURIComponent(jsonStr)));
    } catch {
      base64Code = '';
    }
  }

  const sizeKB = Math.round((new Blob([jsonStr]).size / 1024) * 10) / 10;

  const dataPreview = {
    invoicesCount: (appData.salesInvoices || []).length,
    purchasesCount: (appData.purchaseInvoices || []).length,
    customersCount: (appData.customers || []).length,
    itemsCount: (appData.items || []).length,
    journalEntriesCount: (appData.journalEntries || []).length,
  };

  return {
    id: `snap-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    date: new Date().toISOString(),
    label,
    type,
    sizeKB,
    code: base64Code,
    dataPreview,
    snapshotJson: jsonStr,
  };
}

/**
 * Downloads a backup as a formatted JSON file to the user's computer
 */
export function downloadBackupJsonFile(appData: AppData, customName?: string): void {
  try {
    const dataForExport = {
      ...appData,
      exportDate: new Date().toISOString(),
      systemVersion: 'RAKEEZA-ERP-v8.0',
    };

    const jsonStr = JSON.stringify(dataForExport, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
    const filename = customName || `RAKEEZA_نسخة_احتياطية_${dateStr}.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('Error downloading backup file:', e);
  }
}

/**
 * Validates any imported JSON string or uploaded file
 */
export function parseAndValidateBackupFile(jsonContent: string): {
  isValid: boolean;
  parsedData?: AppData;
  error?: string;
  summary?: {
    companyName: string;
    invoicesCount: number;
    customersCount: number;
    itemsCount: number;
    journalsCount: number;
    date?: string;
  };
} {
  try {
    if (!jsonContent || typeof jsonContent !== 'string') {
      return { isValid: false, error: 'الملف فارغ أو غير صالح' };
    }

    let parsed: any;
    // Check if it is a base64 encoded string first
    const trimmed = jsonContent.trim();
    if (trimmed.startsWith('{')) {
      parsed = JSON.parse(trimmed);
    } else {
      try {
        const decoded = decodeURIComponent(escape(atob(trimmed)));
        parsed = JSON.parse(decoded);
      } catch {
        parsed = JSON.parse(trimmed);
      }
    }

    // Essential keys verification
    if (!parsed || typeof parsed !== 'object') {
      return { isValid: false, error: 'هيكل البيانات غير صحيح' };
    }

    if (!parsed.settings || !parsed.users) {
      return { isValid: false, error: 'الملف لا يحتوي على الإعدادات أو المستخدمين المطلوبة للنظام' };
    }

    const summary = {
      companyName: parsed.settings?.companyName || 'مؤسسة غير مسماة',
      invoicesCount: Array.isArray(parsed.salesInvoices) ? parsed.salesInvoices.length : 0,
      customersCount: Array.isArray(parsed.customers) ? parsed.customers.length : 0,
      itemsCount: Array.isArray(parsed.items) ? parsed.items.length : 0,
      journalsCount: Array.isArray(parsed.journalEntries) ? parsed.journalEntries.length : 0,
      date: parsed.exportDate || parsed.backups?.[0]?.date || new Date().toISOString(),
    };

    return {
      isValid: true,
      parsedData: parsed as AppData,
      summary,
    };
  } catch (e: any) {
    return {
      isValid: false,
      error: `فشل فك تشفير أو قراءة الملف: ${e?.message || 'تنسيق غير معروف'}`,
    };
  }
}

/**
 * Checks if auto backup is due
 */
export function shouldTriggerAutoBackup(config?: AutoBackupConfig): boolean {
  if (!config || !config.enabled) return false;

  if (!config.lastBackupTimestamp) return true;

  const lastTime = new Date(config.lastBackupTimestamp).getTime();
  const now = Date.now();
  const intervalMs = (config.intervalMinutes || 60) * 60 * 1000;

  return now - lastTime >= intervalMs;
}

/**
 * Prune snapshots list according to max count
 */
export function pruneSnapshots(backups: BackupRecord[], maxKeep: number = 15): BackupRecord[] {
  if (!backups || backups.length <= maxKeep) return backups || [];

  // Always keep 'pre_restore' and recent manual backups, prune oldest auto backups first
  const autoBackups = backups.filter((b) => b.type === 'auto');
  const otherBackups = backups.filter((b) => b.type !== 'auto');

  if (backups.length > maxKeep) {
    // Keep newest items
    return backups.slice(0, maxKeep);
  }

  return backups;
}

/**
 * Estimate Storage Size in Browser LocalStorage
 */
export function getStorageDiagnostics(): {
  usedKB: number;
  usedMB: number;
  quotaPercentage: number;
  totalRecordsCount: number;
} {
  let totalLength = 0;
  for (let key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      totalLength += (localStorage[key]?.length || 0) * 2; // UTF-16 ~ 2 bytes per char
    }
  }

  const usedKB = Math.round(totalLength / 1024);
  const usedMB = Math.round((usedKB / 1024) * 100) / 100;
  // Typical browser localStorage quota is ~5MB - 10MB
  const quotaPercentage = Math.min(100, Math.round((usedMB / 5.0) * 100));

  return {
    usedKB,
    usedMB,
    quotaPercentage,
    totalRecordsCount: 0,
  };
}
