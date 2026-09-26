import { User } from '../types';

export interface RecordMetadataContext {
  companyId: string;
  branchId?: string;
  user?: {
    id?: string;
    name?: string;
    code?: string | number;
  };
}

/**
 * 🛡️ Stamped Record Identity & Ownership
 * Enforces companyId, branchId, user ownership, timestamps, and status on every record.
 */
export function stampNewRecord<T extends Record<string, any>>(
  record: T,
  ctx: RecordMetadataContext,
  defaultStatus: string = 'approved'
): T {
  const now = new Date().toISOString();
  return {
    ...record,
    companyId: ctx.companyId || record.companyId || 'COMP-000001',
    branchId: record.branchId || ctx.branchId || 'main',
    createdBy: record.createdBy || ctx.user?.name || 'مدير النظام',
    createdByUserId: record.createdByUserId || ctx.user?.id || undefined,
    createdByUserCode: record.createdByUserCode || ctx.user?.code || 1,
    createdAt: record.createdAt || now,
    updatedAt: now,
    status: record.status || defaultStatus,
  };
}

/**
 * 🛡️ Stamp Updated Record
 * Preserves original ownership while updating updatedAt, updatedBy, and user references.
 */
export function stampUpdatedRecord<T extends Record<string, any>>(
  record: T,
  ctx: Partial<RecordMetadataContext>
): T {
  const now = new Date().toISOString();
  return {
    ...record,
    updatedAt: now,
    updatedBy: ctx.user?.name || record.updatedBy || 'مدير النظام',
    updatedByUserId: ctx.user?.id || record.updatedByUserId || undefined,
    updatedByUserCode: ctx.user?.code || record.updatedByUserCode || undefined,
  };
}

/**
 * 🛡️ Strictly scope an array of records to a company
 * Filters out any record that belongs to another companyId
 */
export function scopeRecordsToCompany<T extends { companyId?: string }>(
  records: T[] | undefined,
  targetCompanyId: string
): T[] {
  if (!records || !Array.isArray(records)) return [];
  if (!targetCompanyId) return records;
  const cleanTarget = targetCompanyId.trim().toUpperCase();
  return records.filter((r) => {
    if (!r.companyId) return true; // Legacy records in tenant store belong to tenant
    return r.companyId.trim().toUpperCase() === cleanTarget;
  });
}

/**
 * 🏢 Filter an array of records by branch
 * Allows 'all' to show all company records, or matches specific branchId
 */
export function filterRecordsByBranch<T extends { branchId?: string }>(
  records: T[] | undefined,
  selectedBranchId: string | undefined | null
): T[] {
  if (!records || !Array.isArray(records)) return [];
  if (!selectedBranchId || selectedBranchId === 'all') return records;
  return records.filter((r) => {
    // If record has no branchId, consider it company-wide (accessible to all branches)
    if (!r.branchId) return true;
    return r.branchId === selectedBranchId;
  });
}
