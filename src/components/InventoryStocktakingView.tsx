import React, { useState, useMemo } from 'react';
import {
  AppData,
  StocktakeSession,
  StocktakeItemRecord,
  InventoryAdjustmentVoucher,
  GoodsIssueVoucher,
  GoodsIssueItem,
  JournalEntry,
} from '../types';
import { Modal } from './Modal';
import { addAuditLog } from '../utils/storage';
import { printStocktakeSession, printSettlementVoucher } from '../utils/printInventoryAdjustment';
import { printGoodsIssueNote } from '../utils/printGoodsIssueNote';
import { exportToExcel } from '../utils/excelExport';
import { openUnifiedPrintWindow } from '../utils/printUnified';
import { TableActionButtons } from './TableActionButtons';

interface InventoryStocktakingViewProps {
  appData: AppData;
  subPage?: string;
  onUpdateData: (newData: AppData) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onInspectItem?: (itemId: string) => void;
}

export const InventoryStocktakingView: React.FC<InventoryStocktakingViewProps> = ({
  appData,
  subPage = 'physical_inventory',
  onUpdateData,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<'sessions' | 'active_count' | 'goods_issue' | 'vouchers'>(
    subPage === 'inventory_settlement'
      ? 'vouchers'
      : subPage === 'goods_issue'
      ? 'goods_issue'
      : 'sessions'
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterVariance, setFilterVariance] = useState<'all' | 'variance_only' | 'matched' | 'shortage' | 'surplus'>('all');
  const [barcodeInput, setBarcodeInput] = useState('');

  // Selected Session for Active Count or Viewing
  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    appData.physicalInventories && appData.physicalInventories.length > 0
      ? appData.physicalInventories[0].id
      : null
  );

  // Modals
  const [isNewSessionModalOpen, setIsNewSessionModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<InventoryAdjustmentVoucher | null>(null);

  // Goods Issue (إذن صرف مخزني) States & Modals
  const [isNewIssueModalOpen, setIsNewIssueModalOpen] = useState(false);
  const [isIssueDetailsModalOpen, setIsIssueDetailsModalOpen] = useState(false);
  const [selectedIssueVoucher, setSelectedIssueVoucher] = useState<GoodsIssueVoucher | null>(null);
  const [issueSearchTerm, setIssueSearchTerm] = useState('');

  // New Goods Issue Form State
  const [newIssueBranchId, setNewIssueBranchId] = useState(appData.branches?.[0]?.id || 'br-main');
  const [newIssueRecipient, setNewIssueRecipient] = useState('');
  const [newIssueRecipientType, setNewIssueRecipientType] = useState<GoodsIssueVoucher['recipientType']>('department');
  const [newIssueDate, setNewIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [newIssuePurpose, setNewIssuePurpose] = useState('');
  const [newIssueWarehouseKeeper, setNewIssueWarehouseKeeper] = useState('سامح إبراهيم (أمين المخزن)');
  const [newIssueRecipientSignatory, setNewIssueRecipientSignatory] = useState('');
  const [newIssueApprovedBy, setNewIssueApprovedBy] = useState('أ. محمد نزيه (مدير المخازن)');
  const [newIssueNotes, setNewIssueNotes] = useState('');
  const [newIssueItems, setNewIssueItems] = useState<
    Array<{
      itemId: string;
      code: string;
      name: string;
      unit: string;
      qty: number;
      unitCost: number;
      currentStock: number;
      notes?: string;
    }>
  >([]);

  // New Session Form State
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newBranchId, setNewBranchId] = useState(appData.branches?.[0]?.id || 'br-main');
  const [newCategory, setNewCategory] = useState('all');
  const [newCommittee, setNewCommittee] = useState('أحمد محمود (أمين المخزن)، كريم عادل (عضو الجرد)');
  const [newNotes, setNewNotes] = useState('');

  // Get current active session
  const currentSession = useMemo(() => {
    return appData.physicalInventories.find((s) => s.id === activeSessionId) || null;
  }, [appData.physicalInventories, activeSessionId]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    appData.items.forEach((i) => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set);
  }, [appData.items]);

  // Filter items in active session
  const filteredSessionItems = useMemo(() => {
    if (!currentSession) return [];
    return currentSession.items.filter((item) => {
      const matchSearch =
        item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.barcode && item.barcode.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.category && item.category.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchCat = filterCategory === 'all' || item.category === filterCategory;

      let matchVar = true;
      if (filterVariance === 'variance_only') matchVar = item.varianceQty !== 0;
      else if (filterVariance === 'matched') matchVar = item.varianceQty === 0;
      else if (filterVariance === 'shortage') matchVar = item.varianceQty < 0;
      else if (filterVariance === 'surplus') matchVar = item.varianceQty > 0;

      return matchSearch && matchCat && matchVar;
    });
  }, [currentSession, searchTerm, filterCategory, filterVariance]);

  // Create New Stocktake Session
  const handleCreateSession = () => {
    if (!newTitle.trim()) {
      showToast('يرجى كتابة عنوان أو مسمى جلسة الجرد', 'warning');
      return;
    }

    const branch = appData.branches?.find((b) => b.id === newBranchId);
    const branchName = branch ? branch.name : 'الفرع الرئيسي';

    // Build item records from items list
    let targetItems = appData.items;
    if (newCategory !== 'all') {
      targetItems = targetItems.filter((i) => i.category === newCategory);
    }

    const nextIdNum = appData.nextStocktakeId || appData.physicalInventories.length + 1;
    const sessionNumber = `INV-${new Date().getFullYear()}-${String(nextIdNum).padStart(3, '0')}`;

    const sessionItems: StocktakeItemRecord[] = targetItems.map((item) => {
      // If branch-specific stock exists, use it; otherwise use total quantity
      let bookQ = item.quantity || 0;
      if (newBranchId && item.branchStock && item.branchStock[newBranchId] !== undefined) {
        bookQ = item.branchStock[newBranchId];
      }
      return {
        itemId: item.id,
        itemName: item.name,
        barcode: item.barcode,
        category: item.category || 'عام',
        unit: item.unit || 'قطعة',
        bookQty: bookQ,
        countedQty: bookQ, // initially equals book qty until user counts
        varianceQty: 0,
        costPrice: item.purchasePrice || 0,
        varianceCostTotal: 0,
        reason: 'routine_adjustment',
        notes: '',
      };
    });

    const newSession: StocktakeSession = {
      id: `stk-${Date.now()}`,
      sessionNumber,
      title: newTitle.trim(),
      date: newDate,
      branchId: newBranchId,
      branchName,
      category: newCategory === 'all' ? 'كافة المجموعات' : newCategory,
      status: 'draft',
      items: sessionItems,
      totalItemsCounted: sessionItems.length,
      matchedItemsCount: sessionItems.length,
      shortageItemsCount: 0,
      surplusItemsCount: 0,
      totalShortageValue: 0,
      totalSurplusValue: 0,
      netVarianceValue: 0,
      committeeMembers: newCommittee,
      notes: newNotes,
      createdBy: appData.users.find((u) => u.id === appData.currentUser)?.name || 'مدير النظام',
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };

    const updatedData: AppData = {
      ...appData,
      physicalInventories: [newSession, ...appData.physicalInventories],
      nextStocktakeId: nextIdNum + 1,
    };

    const withLog = addAuditLog(
      updatedData,
      'create',
      'الجرد والمخازن',
      `تم فتح جلسة جرد جديدة برقم ${sessionNumber} (${newSession.title}) تشمل ${sessionItems.length} صنف.`
    );

    onUpdateData(withLog);
    setActiveSessionId(newSession.id);
    setActiveTab('active_count');
    setIsNewSessionModalOpen(false);
    showToast(`تم إنشاء جلسة الجرد ${sessionNumber} بنجاح`, 'success');
  };

  // Live Count Update for an Item
  const handleUpdateItemCount = (itemId: string, newCountedQty: number, reason?: string, notes?: string) => {
    if (!currentSession || currentSession.status === 'approved_settled') return;

    const updatedSessions = appData.physicalInventories.map((sess) => {
      if (sess.id !== currentSession.id) return sess;

      let matched = 0;
      let shortage = 0;
      let surplus = 0;
      let totalShortVal = 0;
      let totalSurpVal = 0;

      const updatedItems = sess.items.map((item) => {
        if (item.itemId === itemId) {
          const counted = Math.max(0, newCountedQty);
          const variance = counted - item.bookQty;
          const varianceVal = variance * item.costPrice;
          const updatedRecord: StocktakeItemRecord = {
            ...item,
            countedQty: counted,
            varianceQty: variance,
            varianceCostTotal: varianceVal,
            reason: (reason as any) || item.reason || (variance < 0 ? 'shortage_loss' : variance > 0 ? 'surplus_found' : 'routine_adjustment'),
            notes: notes !== undefined ? notes : item.notes,
          };

          if (variance === 0) matched++;
          else if (variance < 0) {
            shortage++;
            totalShortVal += Math.abs(varianceVal);
          } else {
            surplus++;
            totalSurpVal += varianceVal;
          }

          return updatedRecord;
        } else {
          if (item.varianceQty === 0) matched++;
          else if (item.varianceQty < 0) {
            shortage++;
            totalShortVal += Math.abs(item.varianceCostTotal);
          } else {
            surplus++;
            totalSurpVal += item.varianceCostTotal;
          }
          return item;
        }
      });

      return {
        ...sess,
        items: updatedItems,
        matchedItemsCount: matched,
        shortageItemsCount: shortage,
        surplusItemsCount: surplus,
        totalShortageValue: totalShortVal,
        totalSurplusValue: totalSurpVal,
        netVarianceValue: totalSurpVal - totalShortVal,
      };
    });

    onUpdateData({
      ...appData,
      physicalInventories: updatedSessions,
    });
  };

  // Barcode Scanner Live Count Increment (+1)
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim() || !currentSession) return;

    const term = barcodeInput.trim().toLowerCase();
    const target = currentSession.items.find(
      (i) => (i.barcode && i.barcode.toLowerCase() === term) || i.itemId.toLowerCase() === term
    );

    if (target) {
      handleUpdateItemCount(target.itemId, target.countedQty + 1);
      showToast(`تم مسح: ${target.itemName} (+1) -> العدد الفعلي: ${target.countedQty + 1}`, 'info');
      setBarcodeInput('');
    } else {
      showToast(`لم يتم العثور على صنف بالباركود: ${barcodeInput}`, 'warning');
    }
  };

  // Save Session as In-Review / Draft
  const handleSaveDraft = () => {
    if (!currentSession) return;
    showToast('تم حفظ تقدم جلسة الجرد كمسودة بنجاح', 'success');
  };

  // ONE-CLICK APPROVE & SETTLE (The Core Engine: Updates Items & Auto-creates Balanced Journal Entry)
  const handleApproveAndSettle = (session: StocktakeSession) => {
    if (session.status === 'approved_settled') {
      showToast('هذه الجلسة معتمدة ومسواة محاسبياً بالفعل', 'info');
      return;
    }

    const varianceItems = session.items.filter((i) => i.varianceQty !== 0);
    if (varianceItems.length === 0) {
      // All matched perfectly
      const updatedSessions = appData.physicalInventories.map((s) =>
        s.id === session.id
          ? {
              ...s,
              status: 'approved_settled' as const,
              approvedBy: appData.users.find((u) => u.id === appData.currentUser)?.name || 'مدير النظام',
              approvedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
            }
          : s
      );

      const withLog = addAuditLog(
        { ...appData, physicalInventories: updatedSessions },
        'approval',
        'الجرد والمخازن',
        `تم اعتماد جلسة الجرد ${session.sessionNumber} (مطابقة تامة 100% بدون أي فروقات).`
      );

      onUpdateData(withLog);
      showToast(`تم اعتماد جلسة الجرد ${session.sessionNumber} بنجاح (مطابقة تامة)`, 'success');
      return;
    }

    if (
      !confirm(
        `تأكيد اعتماد نتائج الجرد وتوليد سند التسوية المحاسبية والقيود اليومية؟\n\n- عدد الأصناف التي بها فروقات: ${varianceItems.length}\n- إجمالي العجز: ${session.totalShortageValue.toFixed(2)} ج.م\n- إجمالي الفائض: ${session.totalSurplusValue.toFixed(2)} ج.م\n\nسيتم تحديث أرصدة المخازن فوراً وإنشاء قيد اليومية المزدوج بدقة.`
      )
    ) {
      return;
    }

    // 1. Update items real quantities and movements
    const updatedItems = appData.items.map((item) => {
      const rec = session.items.find((i) => i.itemId === item.id);
      if (rec && rec.varianceQty !== 0) {
        const diff = rec.varianceQty;
        const newTotalQty = rec.countedQty;

        // Update branch stock if applicable
        const updatedBranchStock = { ...(item.branchStock || {}) };
        if (session.branchId) {
          updatedBranchStock[session.branchId] = rec.countedQty;
        }

        const newMovement = {
          date: session.date,
          type: 'adjustment' as const,
          qty: diff,
          price: item.purchasePrice,
          total: Math.abs(diff * item.purchasePrice),
          note: `تسوية جرد فعلي جلسة (${session.sessionNumber}) - ${rec.reason || 'تسوية فروقات'}`,
          branchName: session.branchName,
        };

        return {
          ...item,
          quantity: newTotalQty,
          branchStock: updatedBranchStock,
          movements: [newMovement, ...(item.movements || [])],
        };
      }
      return item;
    });

    // 2. Generate Inventory Adjustment Voucher
    const nextAdjNum = appData.nextAdjustmentId || appData.inventoryAdjustments?.length + 1 || 1;
    const voucherNumber = `ADJ-${new Date().getFullYear()}-${String(nextAdjNum).padStart(3, '0')}`;
    const nextJournalNum = appData.nextJournalId || (appData.journalEntries?.length || 0) + 1;

    const voucherItems = varianceItems.map((i) => ({
      itemId: i.itemId,
      itemName: i.itemName,
      bookQtyBefore: i.bookQty,
      adjustedQty: i.varianceQty,
      newStockQty: i.countedQty,
      unitCost: i.costPrice,
      totalAmount: Math.abs(i.varianceCostTotal),
      varianceType: (i.varianceQty < 0 ? 'shortage' : 'surplus') as 'shortage' | 'surplus',
      reason: i.reason || (i.varianceQty < 0 ? 'عجز وفاقد مخزني' : 'فائض مخزني'),
    }));

    const newVoucher: InventoryAdjustmentVoucher = {
      id: `adj-${Date.now()}`,
      voucherNumber,
      stocktakeSessionId: session.id,
      stocktakeSessionNumber: session.sessionNumber,
      date: session.date,
      branchId: session.branchId,
      branchName: session.branchName,
      type: session.totalShortageValue > 0 && session.totalSurplusValue > 0 ? 'mixed' : session.totalShortageValue > 0 ? 'shortage_only' : 'surplus_only',
      status: 'posted',
      items: voucherItems,
      totalShortageAmount: session.totalShortageValue,
      totalSurplusAmount: session.totalSurplusValue,
      netAdjustmentAmount: session.netVarianceValue,
      journalEntryId: nextJournalNum,
      notes: `تسوية معتمدة لجلسة الجرد ${session.sessionNumber} - ${session.title}`,
      createdBy: appData.users.find((u) => u.id === appData.currentUser)?.name || 'مدير النظام',
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };

    // 3. Generate Automatic Balanced Journal Entry (Dual Ledger Entry)
    const journalLines: any[] = [];

    // Case A: Shortage (عجز) -> Debit Shrinkage Expense (5206), Credit Inventory Asset (1106)
    if (session.totalShortageValue > 0) {
      journalLines.push({
        accountCode: '5206',
        accountName: 'عجز وفاقد تسوية المخزون (Inventory Shrinkage & Loss)',
        debit: session.totalShortageValue,
        credit: 0,
        note: `إثبات عجز وفاقد جرد مخزني سند ${voucherNumber} - ${session.branchName || 'الرئيسي'}`,
      });
      journalLines.push({
        accountCode: '1106',
        accountName: 'مخزون البضاعة (Merchandise Inventory)',
        debit: 0,
        credit: session.totalShortageValue,
        note: `تخفيض قيمة المخزون بالعجز الفعلي سند ${voucherNumber}`,
      });
    }

    // Case B: Surplus (زيادة/فائض) -> Debit Inventory Asset (1106), Credit Inventory Gain (4201)
    if (session.totalSurplusValue > 0) {
      journalLines.push({
        accountCode: '1106',
        accountName: 'مخزون البضاعة (Merchandise Inventory)',
        debit: session.totalSurplusValue,
        credit: 0,
        note: `زيادة قيمة المخزون بالفائض الفعلي سند ${voucherNumber}`,
      });
      journalLines.push({
        accountCode: '4201',
        accountName: 'أرباح وفروقات تسوية المخزون (Inventory Adjustment Gain)',
        debit: 0,
        credit: session.totalSurplusValue,
        note: `إثبات أرباح وفروقات الجرد الإيجابية سند ${voucherNumber}`,
      });
    }

    const newJournalEntry: JournalEntry = {
      id: nextJournalNum,
      entryNumber: `JV-${new Date().getFullYear()}-${String(nextJournalNum).padStart(4, '0')}`,
      date: session.date,
      description: `قيد تسوية فروقات الجرد الفعلي للمخازن - سند ${voucherNumber} (${session.sessionNumber})`,
      reference: voucherNumber,
      source: 'inventory',
      lines: journalLines,
      createdBy: appData.users.find((u) => u.id === appData.currentUser)?.name || 'مدير النظام',
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      isApproved: true,
    };

    // 4. Update session status
    const updatedSessions = appData.physicalInventories.map((s) =>
      s.id === session.id
        ? {
            ...s,
            status: 'approved_settled' as const,
            approvedBy: appData.users.find((u) => u.id === appData.currentUser)?.name || 'مدير النظام',
            approvedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
            settlementVoucherId: newVoucher.id,
            journalEntryId: nextJournalNum,
          }
        : s
    );

    const updatedData: AppData = {
      ...appData,
      items: updatedItems,
      physicalInventories: updatedSessions,
      inventoryAdjustments: [newVoucher, ...(appData.inventoryAdjustments || [])],
      journalEntries: [newJournalEntry, ...(appData.journalEntries || [])],
      nextAdjustmentId: nextAdjNum + 1,
      nextJournalId: nextJournalNum + 1,
    };

    const withLog = addAuditLog(
      updatedData,
      'approval',
      'الجرد والمخازن',
      `تم اعتماد تسوية الجرد ${session.sessionNumber} وتوليد سند التسوية ${voucherNumber} وقيد اليومية رقم ${newJournalEntry.entryNumber}.`
    );

    onUpdateData(withLog);
    setSelectedVoucher(newVoucher);
    showToast(`تم اعتماد الجرد وتوليد قيد التسوية ${newJournalEntry.entryNumber} وتحديث أرصدة ${varianceItems.length} أصناف فوراً`, 'success');
  };

  // ==================== GOODS ISSUE NOTE (إذن صرف مخزني) HANDLERS ====================
  const handleOpenNewIssueModal = () => {
    const firstItem = appData.items[0];
    setNewIssueBranchId(appData.branches?.[0]?.id || 'br-main');
    setNewIssueRecipient('فرع المنتزه / قسم الصيانة');
    setNewIssueRecipientType('maintenance');
    setNewIssueDate(new Date().toISOString().split('T')[0]);
    setNewIssuePurpose('صرف قطع غيار ومستلزمات تشغيل بناءً على طلب الاحتياج رقم (REQ-402) بغرض صيانة وتشغيل خط الإنتاج الثاني.');
    setNewIssueWarehouseKeeper('سامح إبراهيم (أمين المخزن)');
    setNewIssueRecipientSignatory('م. أحمد فؤاد (مشرف الصيانة)');
    setNewIssueApprovedBy('أ. محمد نزيه (مدير المخازن)');
    setNewIssueNotes('تم فحص البضاعة ومطابقتها قبل الصرف.');

    if (firstItem) {
      setNewIssueItems([
        {
          itemId: firstItem.id,
          code: firstItem.barcode || firstItem.code || 'ITM-001',
          name: firstItem.name,
          unit: firstItem.unit || 'قطعة',
          qty: 5,
          unitCost: firstItem.purchasePrice || 1200,
          currentStock: firstItem.quantity || 0,
          notes: 'أصلية معتمدة',
        },
      ]);
    } else {
      setNewIssueItems([]);
    }
    setIsNewIssueModalOpen(true);
  };

  const handleAddIssueItemRow = () => {
    const defaultItem =
      appData.items.find((it) => !newIssueItems.some((selected) => selected.itemId === it.id)) ||
      appData.items[0];

    if (!defaultItem) {
      showToast('لا توجد أصناف مضافة في قاعدة البيانات', 'warning');
      return;
    }

    setNewIssueItems([
      ...newIssueItems,
      {
        itemId: defaultItem.id,
        code: defaultItem.barcode || defaultItem.code || `ITM-${String(newIssueItems.length + 1).padStart(3, '0')}`,
        name: defaultItem.name,
        unit: defaultItem.unit || 'قطعة',
        qty: 1,
        unitCost: defaultItem.purchasePrice || 100,
        currentStock: defaultItem.quantity || 0,
        notes: '',
      },
    ]);
  };

  const handleUpdateIssueItem = (index: number, field: string, value: any) => {
    const updated = [...newIssueItems];
    if (field === 'itemId') {
      const found = appData.items.find((i) => i.id === value);
      if (found) {
        updated[index] = {
          ...updated[index],
          itemId: found.id,
          code: found.barcode || found.code || `ITM-${String(index + 1).padStart(3, '0')}`,
          name: found.name,
          unit: found.unit || 'قطعة',
          unitCost: found.purchasePrice || 0,
          currentStock: found.quantity || 0,
        };
      }
    } else {
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
    }
    setNewIssueItems(updated);
  };

  const handleRemoveIssueItemRow = (index: number) => {
    setNewIssueItems(newIssueItems.filter((_, i) => i !== index));
  };

  const handleSaveGoodsIssue = (autoApprove: boolean = false, autoPrint: boolean = false) => {
    if (!newIssueRecipient.trim()) {
      showToast('يرجى تحديد اسم الجهة أو المستلم', 'warning');
      return;
    }
    if (newIssueItems.length === 0) {
      showToast('يرجى إضافة صنف واحد على الأقل لإذن الصرف', 'warning');
      return;
    }

    const nextId =
      appData.nextGoodsIssueId ||
      (appData.goodsIssueVouchers?.length ? appData.goodsIssueVouchers.length + 89 : 89);
    const voucherNumber = `GIN-2026-${String(nextId).padStart(3, '0')}`;
    const branch = appData.branches?.find((b) => b.id === newIssueBranchId);
    const branchName = branch ? branch.name : 'المخزن الرئيسي';

    const itemsFormatted: GoodsIssueItem[] = newIssueItems.map((it, idx) => ({
      itemId: it.itemId,
      code: it.code || `ITM-${String(idx + 1).padStart(3, '0')}`,
      name: it.name,
      unit: it.unit || 'قطعة',
      qty: Number(it.qty) || 1,
      unitCost: Number(it.unitCost) || 0,
      totalCost: (Number(it.qty) || 1) * (Number(it.unitCost) || 0),
      notes: it.notes,
    }));

    const totalQty = itemsFormatted.reduce((acc, i) => acc + i.qty, 0);
    const totalCost = itemsFormatted.reduce((acc, i) => acc + i.totalCost, 0);

    const newIssue: GoodsIssueVoucher = {
      id: `gin-${Date.now()}`,
      voucherNumber,
      date: newIssueDate,
      time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true }),
      sourceBranchId: newIssueBranchId,
      sourceBranchName: branchName,
      recipientName: newIssueRecipient,
      recipientType: newIssueRecipientType,
      purposeReason: newIssuePurpose || 'صرف مواد ومستلزمات تشغيل بناءً على طلب الاحتياج.',
      items: itemsFormatted,
      totalQty,
      totalCost,
      createdBy: appData.users.find((u) => u.id === appData.currentUser)?.name || 'Mohamed Nazih',
      warehouseKeeper: newIssueWarehouseKeeper,
      recipientSignatory: newIssueRecipientSignatory,
      approvedBy: newIssueApprovedBy,
      status: autoApprove ? 'approved' : 'draft',
      notes: newIssueNotes,
    };

    let updatedItems = [...appData.items];
    let updatedJournal = [...(appData.journalEntries || [])];
    let nextJournalNum = appData.nextJournalId || 1;

    // If auto-approved, deduct from inventory and create double entry
    if (autoApprove) {
      newIssueItems.forEach((issueItem) => {
        const itemIdx = updatedItems.findIndex((it) => it.id === issueItem.itemId);
        if (itemIdx !== -1) {
          const prev = updatedItems[itemIdx];
          const newQty = Math.max(0, (prev.quantity || 0) - issueItem.qty);
          const newBranchStock = { ...(prev.branchStock || {}) };
          if (newIssueBranchId) {
            newBranchStock[newIssueBranchId] = Math.max(
              0,
              (newBranchStock[newIssueBranchId] || 0) - issueItem.qty
            );
          }
          const movements = [
            ...(prev.movements || []),
            {
              date: newIssueDate,
              type: 'transfer_out' as const,
              qty: issueItem.qty,
              price: issueItem.unitCost,
              total: issueItem.qty * issueItem.unitCost,
              note: `صرف مخزني بموجب إذن رقم ${voucherNumber} إلى ${newIssueRecipient}`,
              branchName: branchName,
            },
          ];
          updatedItems[itemIdx] = {
            ...prev,
            quantity: newQty,
            branchStock: newBranchStock,
            movements,
          };
        }
      });

      if (totalCost > 0) {
        const journalEntry: JournalEntry = {
          id: nextJournalNum,
          entryNumber: `JV-${new Date().getFullYear()}-${String(nextJournalNum).padStart(4, '0')}`,
          date: newIssueDate,
          description: `إثبات تكلفة البضاعة المنصرفة بموجب إذن صرف مخزني ${voucherNumber} - ${newIssueRecipient}`,
          reference: voucherNumber,
          source: 'inventory',
          lines: [
            {
              accountCode: '5101',
              accountName: 'تكلفة البضاعة المباعة / المنصرفة',
              debit: totalCost,
              credit: 0,
              note: `صرف مواد إلى ${newIssueRecipient}`,
            },
            {
              accountCode: '1106',
              accountName: 'مخزون البضاعة بالمستودعات',
              debit: 0,
              credit: totalCost,
              note: `خصم منصرف من ${branchName}`,
            },
          ],
          createdBy: appData.users.find((u) => u.id === appData.currentUser)?.name || 'مدير النظام',
          createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
          isApproved: true,
        };
        newIssue.journalEntryId = nextJournalNum;
        updatedJournal = [journalEntry, ...updatedJournal];
        nextJournalNum++;
      }
    }

    const updatedData: AppData = {
      ...appData,
      items: updatedItems,
      goodsIssueVouchers: [newIssue, ...(appData.goodsIssueVouchers || [])],
      journalEntries: updatedJournal,
      nextGoodsIssueId: nextId + 1,
      nextJournalId: nextJournalNum,
    };

    const withLog = addAuditLog(
      updatedData,
      'create',
      'المخازن والمستودعات',
      `تم إنشاء إذن صرف مخزني ${voucherNumber} لصالح ${newIssueRecipient} بإجمالي ${totalQty} قطعة وتكلفة ${totalCost.toFixed(2)} ج.م.`
    );

    onUpdateData(withLog);
    setIsNewIssueModalOpen(false);

    if (autoPrint) {
      printGoodsIssueNote(newIssue, updatedData, showToast);
      showToast(`تم حفظ وإصدار إذن الصرف ${voucherNumber} وفتح نافذة الطباعة بنجاح`, 'success');
    } else {
      showToast(`تم حفظ إذن الصرف المخزني ${voucherNumber} بنجاح`, 'success');
    }
  };

  const handleApproveGoodsIssue = (issue: GoodsIssueVoucher) => {
    if (issue.status === 'approved') {
      showToast('هذا الإذن معتمد ومسوى في الأرصدة بالفعل', 'info');
      return;
    }

    let updatedItems = [...appData.items];
    issue.items.forEach((issueItem) => {
      const itemIdx = updatedItems.findIndex(
        (it) => it.id === issueItem.itemId || it.name === issueItem.name
      );
      if (itemIdx !== -1) {
        const prev = updatedItems[itemIdx];
        const newQty = Math.max(0, (prev.quantity || 0) - issueItem.qty);
        const newBranchStock = { ...(prev.branchStock || {}) };
        if (issue.sourceBranchId) {
          newBranchStock[issue.sourceBranchId] = Math.max(
            0,
            (newBranchStock[issue.sourceBranchId] || 0) - issueItem.qty
          );
        }
        const movements = [
          ...(prev.movements || []),
          {
            date: issue.date,
            type: 'transfer_out' as const,
            qty: issueItem.qty,
            price: issueItem.unitCost,
            total: issueItem.totalCost,
            note: `اعتماد صرف مخزني بموجب إذن ${issue.voucherNumber} إلى ${issue.recipientName}`,
            branchName: issue.sourceBranchName || 'المخزن الرئيسي',
          },
        ];
        updatedItems[itemIdx] = {
          ...prev,
          quantity: newQty,
          branchStock: newBranchStock,
          movements,
        };
      }
    });

    const nextJournalNum = appData.nextJournalId || 1;
    const journalEntry: JournalEntry = {
      id: nextJournalNum,
      entryNumber: `JV-${new Date().getFullYear()}-${String(nextJournalNum).padStart(4, '0')}`,
      date: issue.date,
      description: `إثبات تكلفة البضاعة المنصرفة بموجب إذن صرف مخزني ${issue.voucherNumber} - ${issue.recipientName}`,
      reference: issue.voucherNumber,
      source: 'inventory',
      lines: [
        {
          accountCode: '5101',
          accountName: 'تكلفة البضاعة المباعة / المنصرفة',
          debit: issue.totalCost,
          credit: 0,
          note: `صرف مواد إلى ${issue.recipientName}`,
        },
        {
          accountCode: '1106',
          accountName: 'مخزون البضاعة بالمستودعات',
          debit: 0,
          credit: issue.totalCost,
          note: `خصم منصرف من ${issue.sourceBranchName || 'المخزن الرئيسي'}`,
        },
      ],
      createdBy: appData.users.find((u) => u.id === appData.currentUser)?.name || 'مدير النظام',
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      isApproved: true,
    };

    const updatedVouchers = (appData.goodsIssueVouchers || []).map((v) =>
      v.id === issue.id
        ? {
            ...v,
            status: 'approved' as const,
            approvedBy:
              appData.users.find((u) => u.id === appData.currentUser)?.name ||
              'أ. محمد نزيه (مدير المخازن)',
            journalEntryId: nextJournalNum,
          }
        : v
    );

    const updatedData: AppData = {
      ...appData,
      items: updatedItems,
      goodsIssueVouchers: updatedVouchers,
      journalEntries: [journalEntry, ...(appData.journalEntries || [])],
      nextJournalId: nextJournalNum + 1,
    };

    const withLog = addAuditLog(
      updatedData,
      'approval',
      'المخازن والمستودعات',
      `تم اعتماد إذن الصرف المخزني ${issue.voucherNumber} وتوليد قيد اليومية رقم ${journalEntry.entryNumber}.`
    );

    onUpdateData(withLog);
    showToast(
      `تم اعتماد إذن الصرف ${issue.voucherNumber} وخصم الكميات من المخزون وتوليد قيد اليومية ${journalEntry.entryNumber}`,
      'success'
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Metrics Banner */}
      <div className="bg-gradient-to-r from-[#1a237e] via-[#0d47a1] to-[#01579b] text-white p-6 rounded-3xl shadow-xl flex flex-wrap justify-between items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📦</span>
            <h2 className="text-xl md:text-2xl font-black text-[#ffd54f]">
              نظام الجرد الفعلي ومطابقة وتسوية المخازن
            </h2>
            <span className="bg-amber-400 text-slate-900 text-xs font-black px-2.5 py-0.5 rounded-full">
              Enterprise Live
            </span>
          </div>
          <p className="text-xs md:text-sm text-blue-100 max-w-2xl leading-relaxed">
            محرك الجرد الآلي الذكي المتفوق على Odoo: جرد حي بالماسح الضوئي، احتساب فوري للعجز والفائض المالي، وتوليد تلقائي لسندات التسوية وقيود اليومية المزدوجة المتوازنة.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleOpenNewIssueModal}
            className="bg-[#0288d1] hover:bg-[#0277bd] text-white px-4 py-2.5 rounded-2xl text-xs md:text-sm font-bold shadow-lg transition-all transform active:scale-95 cursor-pointer flex items-center gap-1.5"
          >
            <span>📤</span> إنشاء إذن صرف مخزني
          </button>
          <button
            onClick={() => setIsNewSessionModalOpen(true)}
            className="bg-[#2e7d32] hover:bg-[#1b5e20] text-white px-4 py-2.5 rounded-2xl text-xs md:text-sm font-bold shadow-lg transition-all transform active:scale-95 cursor-pointer flex items-center gap-1.5"
          >
            <span>➕</span> فتح جلسة جرد جديدة
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab('sessions')}
          className={`px-5 py-2.5 rounded-2xl text-xs md:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'sessions'
              ? 'bg-[#1a237e] text-white shadow-md'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <span>📋</span> جلسات الجرد ({appData.physicalInventories.length})
        </button>

        <button
          onClick={() => {
            if (activeSessionId) setActiveTab('active_count');
            else showToast('يرجى اختيار جلسة جرد أولاً من القائمة', 'info');
          }}
          className={`px-5 py-2.5 rounded-2xl text-xs md:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'active_count'
              ? 'bg-[#1a237e] text-white shadow-md'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <span>⚡</span> شاشة العد والمطابقة الحية
          {currentSession && (
            <span className="bg-amber-400 text-slate-900 text-[10px] px-1.5 py-0.5 rounded font-black">
              {currentSession.sessionNumber}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('goods_issue')}
          className={`px-5 py-2.5 rounded-2xl text-xs md:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'goods_issue'
              ? 'bg-[#1a237e] text-white shadow-md'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <span>📤</span> أذونات الصرف المخزني ({appData.goodsIssueVouchers?.length || 0})
        </button>

        <button
          onClick={() => setActiveTab('vouchers')}
          className={`px-5 py-2.5 rounded-2xl text-xs md:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'vouchers'
              ? 'bg-[#1a237e] text-white shadow-md'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <span>⚖️</span> سندات التسوية المعتمدة والقيود ({appData.inventoryAdjustments?.length || 0})
        </button>
      </div>

      {/* TAB 1: SESSIONS LIST */}
      {activeTab === 'sessions' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-lg">
                📦
              </div>
              <div>
                <span className="text-xs text-slate-500 block">إجمالي جلسات الجرد</span>
                <strong className="text-slate-900 text-base">{appData.physicalInventories.length} جلسة</strong>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-lg">
                ✅
              </div>
              <div>
                <span className="text-xs text-slate-500 block">الجلسات المعتمدة والمسواة</span>
                <strong className="text-emerald-700 text-base">
                  {appData.physicalInventories.filter((s) => s.status === 'approved_settled').length} جلسة
                </strong>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-lg">
                ⏳
              </div>
              <div>
                <span className="text-xs text-slate-500 block">جلسات قيد المراجعة والعد</span>
                <strong className="text-amber-700 text-base">
                  {appData.physicalInventories.filter((s) => s.status === 'draft' || s.status === 'in_review').length} مسودة
                </strong>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-lg">
                ⚖️
              </div>
              <div>
                <span className="text-xs text-slate-500 block">سندات التسوية المسجلة</span>
                <strong className="text-purple-700 text-base">{appData.inventoryAdjustments?.length || 0} سند</strong>
              </div>
            </div>
          </div>

          {/* Sessions List - Mobile Cards (< lg) & Desktop Table (>= lg) */}
          <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-xs border border-slate-200 space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-2 pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-[#1a237e]">سجل جلسات جرد المخازن</h3>
              <span className="text-xs text-slate-500">اختر جلسة لمتابعة العد الفعلي أو اعتماد التسوية</span>
            </div>

            {/* Mobile Cards View */}
            <div className="block lg:hidden space-y-3">
              {appData.physicalInventories.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  لا توجد جلسات جرد مسجلة بعد. انقر على "فتح جلسة جرد جديدة" للبدء.
                </div>
              ) : (
                appData.physicalInventories.map((sess) => {
                  const matchPercent = sess.totalItemsCounted > 0 ? Math.round((sess.matchedItemsCount / sess.totalItemsCounted) * 100) : 100;
                  return (
                    <div
                      key={sess.id}
                      className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3 hover:border-indigo-300 transition"
                    >
                      <div className="flex items-center justify-between border-b border-slate-200/70 pb-2">
                        <div>
                          <span className="font-mono font-bold text-indigo-700 text-xs">{sess.sessionNumber}</span>
                          <h4 className="font-bold text-slate-900 text-sm mt-0.5">{sess.title}</h4>
                        </div>
                        {sess.status === 'approved_settled' ? (
                          <span className="bg-emerald-100 text-emerald-800 text-[11px] px-2.5 py-1 rounded-full font-bold">
                            ✅ معتمد ومسوى
                          </span>
                        ) : (
                          <span className="bg-amber-100 text-amber-800 text-[11px] px-2.5 py-1 rounded-full font-bold">
                            📝 قيد العد
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-100">
                        <div>📅 التاريخ: <strong className="text-slate-800">{sess.date}</strong></div>
                        <div>🏢 الفرع: <strong className="text-slate-800">{sess.branchName || 'الرئيسي'}</strong></div>
                        <div>📦 الأصناف: <strong className="text-slate-800">{sess.totalItemsCounted} صنف</strong></div>
                        <div>
                          🎯 التطابق:{' '}
                          <span
                            className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${
                              matchPercent === 100 ? 'text-emerald-700' : 'text-amber-700'
                            }`}
                          >
                            {matchPercent}%
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-100 text-xs">
                        <span className="text-slate-500">صافي الأثر المالي:</span>
                        <strong
                          className={`font-mono text-sm ${
                            sess.netVarianceValue < 0
                              ? 'text-rose-600'
                              : sess.netVarianceValue > 0
                              ? 'text-emerald-600'
                              : 'text-slate-700'
                          }`}
                        >
                          {sess.netVarianceValue.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
                        </strong>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-1">
                        <button
                          onClick={() => {
                            setActiveSessionId(sess.id);
                            setActiveTab('active_count');
                          }}
                          className="min-h-[42px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                        >
                          🔍 فحص
                        </button>
                        <button
                          onClick={() => printStocktakeSession(sess, appData)}
                          className="min-h-[42px] bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                          title="طباعة تقرير الجرد والتسوية"
                        >
                          🖨️ طباعة
                        </button>
                        {sess.status !== 'approved_settled' ? (
                          <button
                            onClick={() => handleApproveAndSettle(sess)}
                            className="min-h-[42px] bg-[#2e7d32] hover:bg-[#1b5e20] active:bg-[#124116] text-white px-2 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 shadow-xs"
                          >
                            ⚡ اعتماد
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedVoucher(
                                appData.inventoryAdjustments?.find((v) => v.stocktakeSessionId === sess.id) || null
                              );
                              if (appData.inventoryAdjustments?.find((v) => v.stocktakeSessionId === sess.id)) {
                                setIsDetailsModalOpen(true);
                              } else {
                                showToast('لا يوجد سند تسوية منفصل لهذه الجلسة', 'info');
                              }
                            }}
                            className="min-h-[42px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                          >
                            📄 سند
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-right text-xs md:text-sm">
                <thead className="bg-[#1a237e] text-white">
                  <tr>
                    <th className="p-3 rounded-r-xl">رقم الجلسة</th>
                    <th className="p-3">عنوان الجلسة</th>
                    <th className="p-3">التاريخ</th>
                    <th className="p-3">الفرع / المستودع</th>
                    <th className="p-3">المجموعة</th>
                    <th className="p-3 text-center">الأصناف</th>
                    <th className="p-3 text-center">التطابق</th>
                    <th className="p-3">صافي الأثر المالي</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3 rounded-l-xl text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {appData.physicalInventories.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-400">
                        لا توجد جلسات جرد مسجلة بعد. انقر على "فتح جلسة جرد جديدة" للبدء.
                      </td>
                    </tr>
                  ) : (
                    appData.physicalInventories.map((sess) => {
                      const matchPercent = sess.totalItemsCounted > 0 ? Math.round((sess.matchedItemsCount / sess.totalItemsCounted) * 100) : 100;
                      return (
                        <tr key={sess.id} className="hover:bg-slate-50 transition">
                          <td className="p-3 font-mono font-bold text-indigo-700">{sess.sessionNumber}</td>
                          <td className="p-3 font-bold text-slate-900">{sess.title}</td>
                          <td className="p-3 font-mono text-slate-600">{sess.date}</td>
                          <td className="p-3 text-slate-600">{sess.branchName || 'الفرع الرئيسي'}</td>
                          <td className="p-3 text-slate-600">{sess.category || 'الكل'}</td>
                          <td className="p-3 text-center font-bold">{sess.totalItemsCounted}</td>
                          <td className="p-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                matchPercent === 100
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : matchPercent >= 80
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {matchPercent}%
                            </span>
                          </td>
                          <td className="p-3 font-mono font-bold">
                            <span
                              className={
                                sess.netVarianceValue < 0
                                  ? 'text-rose-600'
                                  : sess.netVarianceValue > 0
                                  ? 'text-emerald-600'
                                  : 'text-slate-600'
                              }
                            >
                              {sess.netVarianceValue.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
                            </span>
                          </td>
                          <td className="p-3">
                            {sess.status === 'approved_settled' ? (
                              <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1">
                                <span>✅</span> معتمد ومسوى
                              </span>
                            ) : (
                              <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1">
                                <span>📝</span> مسودة قيد العد
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex justify-center gap-1.5">
                              <button
                                onClick={() => {
                                  setActiveSessionId(sess.id);
                                  setActiveTab('active_count');
                                }}
                                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer"
                                title="فتح شاشة العد والمطابقة"
                              >
                                🔍 فحص وعد
                              </button>
                              <button
                                onClick={() => printStocktakeSession(sess, appData)}
                                className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer"
                                title="طباعة تقرير الجرد والتسوية المعتمد"
                              >
                                🖨️ طباعة
                              </button>
                              {sess.status !== 'approved_settled' && (
                                <button
                                  onClick={() => handleApproveAndSettle(sess)}
                                  className="bg-[#2e7d32] hover:bg-[#1b5e20] text-white px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer shadow-sm"
                                  title="اعتماد وتسوية الجرد آلياً"
                                >
                                  ⚡ اعتماد
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ACTIVE COUNT & RECONCILIATION LIVE SCREEN */}
      {activeTab === 'active_count' && (
        <div className="space-y-5">
          {currentSession ? (
            <>
              {/* Session Control Bar */}
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 space-y-4">
                <div className="flex flex-wrap justify-between items-center gap-4 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📋</span>
                    <div>
                      <h3 className="text-base md:text-lg font-black text-[#1a237e] flex items-center gap-2">
                        <span>{currentSession.title}</span>
                        <span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-lg border border-indigo-200">
                          {currentSession.sessionNumber}
                        </span>
                        {currentSession.status === 'approved_settled' ? (
                          <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
                            ✅ معتمد ومسوى نهائياً
                          </span>
                        ) : (
                          <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
                            📝 قيد العد والتسجيل
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-slate-500">
                        التاريخ: {currentSession.date} | الفرع: {currentSession.branchName || 'الرئيسي'} | لجنة الجرد: {currentSession.committeeMembers || 'غير محدد'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveDraft}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      💾 حفظ كمسودة
                    </button>
                    <TableActionButtons
                      onPrint={() => setIsPrintModalOpen(true)}
                      onExportExcel={() => {
                        exportToExcel({
                          filename: `استمارة_جرد_${currentSession.sessionNumber}_${currentSession.date}`,
                          sheetName: 'أصناف الجرد الفعلي',
                          data: currentSession.items,
                          columns: [
                            { header: 'كود الصنف', key: 'itemCode', width: 14 },
                            { header: 'اسم الصنف', key: 'itemName', width: 25 },
                            { header: 'الوحدة', key: 'unit', width: 12 },
                            { header: 'الرصيد الدفتري (المسجل)', getValue: (i) => i.systemQty.toString(), width: 20 },
                            { header: 'الرصيد الفعلي (المعدود)', getValue: (i) => i.countedQty.toString(), width: 20 },
                            { header: 'فرق الكمية (الفروقات)', getValue: (i) => (i.countedQty - i.systemQty).toString(), width: 20 },
                            { header: 'سعر التكلفة (ج.م)', getValue: (i) => i.costPrice.toFixed(2), width: 18 },
                            { header: 'قيمة الفارق المالي (ج.م)', getValue: (i) => i.varianceValue.toFixed(2), width: 20 },
                            {
                              header: 'الحالة والمطابقة',
                              getValue: (i) => i.status === 'matched' ? 'مطابق' : i.status === 'shortage' ? 'عجز' : 'زيادة',
                              width: 16,
                            },
                          ],
                          companyName: appData.settings?.companyName || 'المنظومة المحاسبية المعتمدة',
                          reportTitle: `تقرير واستمارة الجرد المخزني الفعلي - ${currentSession.title} (${currentSession.sessionNumber})`,
                        });
                        showToast('تم تصدير بيانات جلسة الجرد إلى Excel بنجاح', 'success');
                      }}
                      printTitle="طباعة استمارة الجرد الفعلي"
                      exportTitle="تصدير بيانات الجرد إلى Excel"
                    />
                    {currentSession.status !== 'approved_settled' && (
                      <button
                        onClick={() => handleApproveAndSettle(currentSession)}
                        className="bg-[#2e7d32] hover:bg-[#1b5e20] text-white px-5 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-md flex items-center gap-1"
                      >
                        <span>⚡</span> اعتماد وتوليد قيد التسوية فوراً
                      </button>
                    )}
                  </div>
                </div>

                {/* Session Real-time Variance KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-center">
                    <span className="text-[11px] text-slate-500 block">إجمالي الأصناف</span>
                    <strong className="text-slate-900 text-base">{currentSession.totalItemsCounted} صنف</strong>
                  </div>

                  <div className="bg-emerald-50/70 p-3 rounded-2xl border border-emerald-200 text-center">
                    <span className="text-[11px] text-emerald-800 block">مطابق تماماً</span>
                    <strong className="text-emerald-700 text-base">{currentSession.matchedItemsCount} صنف</strong>
                  </div>

                  <div className="bg-rose-50/70 p-3 rounded-2xl border border-rose-200 text-center">
                    <span className="text-[11px] text-rose-800 block">أصناف بها عجز (نقص)</span>
                    <strong className="text-rose-700 text-base">
                      {currentSession.shortageItemsCount} ({currentSession.totalShortageValue.toFixed(2)} ج.م)
                    </strong>
                  </div>

                  <div className="bg-blue-50/70 p-3 rounded-2xl border border-blue-200 text-center">
                    <span className="text-[11px] text-blue-800 block">أصناف بها زيادة (فائض)</span>
                    <strong className="text-blue-700 text-base">
                      {currentSession.surplusItemsCount} ({currentSession.totalSurplusValue.toFixed(2)} ج.م)
                    </strong>
                  </div>

                  <div className="bg-[#1a237e] text-white p-3 rounded-2xl text-center shadow-md">
                    <span className="text-[11px] text-blue-200 block">صافي الأثر المالي للتسوية</span>
                    <strong
                      className={`text-base font-mono ${
                        currentSession.netVarianceValue < 0
                          ? 'text-rose-300'
                          : currentSession.netVarianceValue > 0
                          ? 'text-[#ffd54f]'
                          : 'text-emerald-300'
                      }`}
                    >
                      {currentSession.netVarianceValue.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
                    </strong>
                  </div>
                </div>

                {/* Live Barcode Scanner & Rapid Search Filters */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2">
                  <form onSubmit={handleBarcodeSubmit} className="md:col-span-4 flex gap-2">
                    <input
                      type="text"
                      placeholder="📷 امسح الباركود للعد السريع (+1)..."
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      disabled={currentSession.status === 'approved_settled'}
                      className="w-full p-2.5 border-2 border-indigo-200 focus:border-indigo-600 rounded-xl text-xs font-mono focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={currentSession.status === 'approved_settled'}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0"
                    >
                      مسح
                    </button>
                  </form>

                  <div className="md:col-span-3">
                    <input
                      type="text"
                      placeholder="🔍 بحث بالاسم أو الكود..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#1a237e]"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <select
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none"
                    >
                      <option value="all">📂 كافة المجموعات</option>
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-3">
                    <select
                      value={filterVariance}
                      onChange={(e) => setFilterVariance(e.target.value as any)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none font-semibold text-slate-700"
                    >
                      <option value="all">🔘 عرض كافة الأصناف</option>
                      <option value="variance_only">⚠️ الأصناف التي بها فروقات فقط</option>
                      <option value="shortage">🔴 أصناف العجز فقط</option>
                      <option value="surplus">🔵 أصناف الزيادة فقط</option>
                      <option value="matched">🟢 الأصناف المطابقة 100%</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Items Inventory Count - Mobile Cards (< lg) & Desktop Table (>= lg) */}
              <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-xs border border-slate-200 space-y-3">
                {/* Mobile Count Cards */}
                <div className="block lg:hidden space-y-3">
                  {filteredSessionItems.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">
                      لا توجد أصناف مطابقة لشروط البحث والتصفية.
                    </div>
                  ) : (
                    filteredSessionItems.map((item) => {
                      const isShort = item.varianceQty < 0;
                      const isSurp = item.varianceQty > 0;
                      const isMatch = item.varianceQty === 0;

                      return (
                        <div
                          key={item.itemId}
                          className={`rounded-2xl p-4 border space-y-3 transition ${
                            isShort
                              ? 'bg-rose-50/30 border-rose-200'
                              : isSurp
                              ? 'bg-blue-50/30 border-blue-200'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 border-b border-slate-200/70 pb-2">
                            <div>
                              <h4 className="font-bold text-[#1a237e] text-sm">{item.itemName}</h4>
                              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                                <span>{item.category || 'عام'}</span>
                                {item.barcode && <span className="font-mono text-[11px]">كود: {item.barcode}</span>}
                              </div>
                            </div>
                            <div>
                              {isMatch && (
                                <span className="bg-emerald-100 text-emerald-800 text-[11px] px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1">
                                  <span>🟢</span> مطابق
                                </span>
                              )}
                              {isShort && (
                                <span className="bg-rose-100 text-rose-800 text-[11px] px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1">
                                  <span>🔴</span> عجز مخزني
                                </span>
                              )}
                              {isSurp && (
                                <span className="bg-blue-100 text-blue-800 text-[11px] px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1">
                                  <span>🔵</span> زيادة مخزنية
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Quantities & Count Input */}
                          <div className="grid grid-cols-2 gap-2 text-xs bg-white p-3 rounded-xl border border-slate-100">
                            <div>
                              <span className="text-slate-500 block text-[11px]">الرصيد الدفتري</span>
                              <strong className="text-slate-800 font-mono text-sm">{item.bookQty} {item.unit || 'قطعة'}</strong>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[11px]">الفارق الكمي والمالي</span>
                              <strong
                                className={`font-mono text-sm ${
                                  isShort ? 'text-rose-600' : isSurp ? 'text-blue-600' : 'text-emerald-600'
                                }`}
                              >
                                {item.varianceQty > 0 ? `+${item.varianceQty}` : item.varianceQty} (
                                {item.varianceCostTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م)
                              </strong>
                            </div>
                          </div>

                          {/* Quick Count Control */}
                          <div className="bg-white p-3 rounded-xl border border-slate-100 space-y-2">
                            <label className="text-[11px] font-bold text-slate-700 block">الكمية الفعلية بالمخزن:</label>
                            <div className="flex items-center justify-between gap-1.5">
                              {currentSession.status !== 'approved_settled' && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItemCount(item.itemId, Math.max(0, item.countedQty - 1))}
                                  className="min-h-[44px] min-w-[44px] rounded-xl bg-slate-200 hover:bg-slate-300 font-bold text-slate-700 flex items-center justify-center text-base cursor-pointer"
                                >
                                  -
                                </button>
                              )}
                              <input
                                type="number"
                                min="0"
                                value={item.countedQty}
                                disabled={currentSession.status === 'approved_settled'}
                                onChange={(e) =>
                                  handleUpdateItemCount(item.itemId, parseFloat(e.target.value) || 0)
                                }
                                className={`flex-1 min-h-[44px] p-2 text-center font-bold font-mono border-2 rounded-xl text-sm focus:outline-none transition ${
                                  isShort
                                    ? 'border-rose-300 text-rose-700 bg-rose-50/40'
                                    : isSurp
                                    ? 'border-blue-300 text-blue-700 bg-blue-50/40'
                                    : 'border-slate-200 text-slate-800'
                                }`}
                              />
                              {currentSession.status !== 'approved_settled' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateItemCount(item.itemId, item.countedQty + 1)}
                                    className="min-h-[44px] min-w-[44px] rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-base cursor-pointer"
                                  >
                                    +
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateItemCount(item.itemId, item.countedQty + 5)}
                                    className="min-h-[44px] px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-600 cursor-pointer"
                                  >
                                    +5
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Reason Selector on mobile */}
                          {currentSession.status !== 'approved_settled' ? (
                            <div>
                              <label className="text-[11px] font-bold text-slate-700 block mb-1">سبب الفارق:</label>
                              <select
                                value={item.reason || 'routine_adjustment'}
                                onChange={(e) =>
                                  handleUpdateItemCount(item.itemId, item.countedQty, e.target.value)
                                }
                                className="w-full min-h-[42px] p-2 border border-slate-200 rounded-xl text-xs bg-white"
                              >
                                <option value="routine_adjustment">تسوية دورية معتادة</option>
                                <option value="shortage_loss">عجز وفاقد مخزني</option>
                                <option value="damage">تلف وكسر</option>
                                <option value="expired">انتهاء صلاحية</option>
                                <option value="surplus_found">بضاعة زائدة مكتشفة</option>
                                <option value="entry_error">خطأ تسجيل قيد سابق</option>
                              </select>
                            </div>
                          ) : (
                            <div className="text-xs text-slate-600">السبب: {item.reason || 'تسوية دورية'}</div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-right text-xs md:text-sm border-collapse">
                    <thead className="bg-[#1a237e] text-white">
                      <tr>
                        <th className="p-3 rounded-r-xl">الصنف والباركود</th>
                        <th className="p-3">المجموعة والوحدة</th>
                        <th className="p-3 text-center">الرصيد الدفتري</th>
                        <th className="p-3 text-center min-w-[170px]">الكمية الفعلية بالمخزن</th>
                        <th className="p-3 text-center">الفارق (الكمية)</th>
                        <th className="p-3">سعر التكلفة</th>
                        <th className="p-3">قيمة الفارق المالي</th>
                        <th className="p-3 min-w-[140px]">سبب الفارق والملاحظات</th>
                        <th className="p-3 rounded-l-xl text-center">حالة المطابقة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredSessionItems.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-slate-400">
                            لا توجد أصناف مطابقة لشروط البحث والتصفية.
                          </td>
                        </tr>
                      ) : (
                        filteredSessionItems.map((item) => {
                          const isShort = item.varianceQty < 0;
                          const isSurp = item.varianceQty > 0;
                          const isMatch = item.varianceQty === 0;

                          return (
                            <tr
                              key={item.itemId}
                              className={`hover:bg-slate-50 transition ${
                                isShort ? 'bg-rose-50/20' : isSurp ? 'bg-blue-50/20' : ''
                              }`}
                            >
                              <td className="p-3">
                                <div className="font-bold text-[#1a237e]">{item.itemName}</div>
                                {item.barcode && (
                                  <div className="font-mono text-[10px] text-slate-400">كود: {item.barcode}</div>
                                )}
                              </td>
                              <td className="p-3 text-slate-600">
                                <div>{item.category || '-'}</div>
                                <span className="text-[10px] text-slate-400 font-semibold">{item.unit || 'قطعة'}</span>
                              </td>
                              <td className="p-3 text-center font-bold font-mono text-slate-800">{item.bookQty}</td>

                              {/* Count Input with Quick Increment Buttons */}
                              <td className="p-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {currentSession.status !== 'approved_settled' && (
                                    <button
                                      onClick={() => handleUpdateItemCount(item.itemId, Math.max(0, item.countedQty - 1))}
                                      className="w-6 h-6 rounded-lg bg-slate-200 hover:bg-slate-300 font-bold text-slate-700 flex items-center justify-center cursor-pointer text-xs"
                                      title="إنقاص 1"
                                    >
                                      -
                                    </button>
                                  )}
                                  <input
                                    type="number"
                                    min="0"
                                    value={item.countedQty}
                                    disabled={currentSession.status === 'approved_settled'}
                                    onChange={(e) =>
                                      handleUpdateItemCount(item.itemId, parseFloat(e.target.value) || 0)
                                    }
                                    className={`w-20 p-1.5 text-center font-bold font-mono border-2 rounded-xl text-xs focus:outline-none transition ${
                                      isShort
                                        ? 'border-rose-300 text-rose-700 bg-rose-50/40'
                                        : isSurp
                                        ? 'border-blue-300 text-blue-700 bg-blue-50/40'
                                        : 'border-slate-200 text-slate-800'
                                    }`}
                                  />
                                  {currentSession.status !== 'approved_settled' && (
                                    <>
                                      <button
                                        onClick={() => handleUpdateItemCount(item.itemId, item.countedQty + 1)}
                                        className="w-6 h-6 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center cursor-pointer text-xs"
                                        title="زيادة 1"
                                      >
                                        +
                                      </button>
                                      <button
                                        onClick={() => handleUpdateItemCount(item.itemId, item.countedQty + 5)}
                                        className="px-1.5 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-600 cursor-pointer"
                                        title="زيادة 5"
                                      >
                                        +5
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>

                              {/* Variance Qty */}
                              <td className="p-3 text-center font-bold font-mono text-sm">
                                <span
                                  className={`px-2 py-0.5 rounded-lg ${
                                    isShort
                                      ? 'bg-rose-100 text-rose-800'
                                      : isSurp
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  {item.varianceQty > 0 ? `+${item.varianceQty}` : item.varianceQty}
                                </span>
                              </td>

                              <td className="p-3 font-mono text-slate-600">{item.costPrice.toFixed(2)} ج.م</td>

                              {/* Variance Financial Value */}
                              <td className="p-3 font-mono font-bold">
                                <span
                                  className={
                                    isShort ? 'text-rose-600' : isSurp ? 'text-blue-600' : 'text-emerald-600'
                                  }
                                >
                                  {item.varianceCostTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
                                </span>
                              </td>

                              {/* Reason Selector */}
                              <td className="p-3">
                                {currentSession.status !== 'approved_settled' ? (
                                  <select
                                    value={item.reason || 'routine_adjustment'}
                                    onChange={(e) =>
                                      handleUpdateItemCount(item.itemId, item.countedQty, e.target.value)
                                    }
                                    className="w-full p-1.5 border border-slate-200 rounded-lg text-xs"
                                  >
                                    <option value="routine_adjustment">تسوية دورية معتادة</option>
                                    <option value="shortage_loss">عجز وفاقد مخزني</option>
                                    <option value="damage">تلف وكسر</option>
                                    <option value="expired">انتهاء صلاحية</option>
                                    <option value="surplus_found">بضاعة زائدة مكتشفة</option>
                                    <option value="entry_error">خطأ تسجيل قيد سابق</option>
                                  </select>
                                ) : (
                                  <span className="text-xs text-slate-600">{item.reason || 'تسوية دورية'}</span>
                                )}
                              </td>

                              {/* Status Badge */}
                              <td className="p-3 text-center">
                                {isMatch && (
                                  <span className="bg-emerald-100 text-emerald-800 text-[11px] px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1">
                                    <span>🟢</span> مطابق
                                  </span>
                                )}
                                {isShort && (
                                  <span className="bg-rose-100 text-rose-800 text-[11px] px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1">
                                    <span>🔴</span> عجز مخزني
                                  </span>
                                )}
                                {isSurp && (
                                  <span className="bg-blue-100 text-blue-800 text-[11px] px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1">
                                    <span>🔵</span> زيادة مخزنية
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 space-y-3">
              <span className="text-4xl">📦</span>
              <h3 className="text-lg font-bold text-slate-700">لا توجد جلسة جرد نشطة محددة</h3>
              <p className="text-xs text-slate-500">اختر جلسة من تبويب جلسات الجرد أو أنشئ جلسة جديدة للبدء.</p>
              <button
                onClick={() => setActiveTab('sessions')}
                className="bg-[#1a237e] text-white px-5 py-2 rounded-xl text-xs font-bold cursor-pointer"
              >
                الانتقال إلى جلسات الجرد
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SETTLEMENT VOUCHERS & AUDIT JOURNALS */}
      {activeTab === 'vouchers' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-xs border border-slate-200 space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-2 pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-[#1a237e]">
                  سجل سندات تسوية المخزون والقيود المحاسبية الآلية
                </h3>
                <p className="text-xs text-slate-500">
                  جميع سندات التسوية المعتمدة مع ربطها التلقائي بقيود اليومية المزدوجة وتاريخ الاعتماد.
                </p>
              </div>
              <TableActionButtons
                onPrint={() => {
                  const adjustments = appData.inventoryAdjustments || [];
                  openUnifiedPrintWindow(
                    {
                      title: 'سجل وحصر سندات تسوية المخزون والقيود الآلية',
                      partyLabel: 'إجمالي السندات',
                      partyName: `${adjustments.length} سند تسوية`,
                      items: adjustments.map((v) => ({
                        name: `${v.voucherNumber} (جلسة: ${v.stocktakeSessionNumber || '-'})`,
                        unit: v.branchName || 'الرئيسي',
                        qty: v.items?.length || 0,
                        price: 0,
                        total: v.netAdjustmentAmount,
                        notes: `التاريخ: ${v.date} | قيد رقم: ${v.journalEntryId || '-'} | عجز: -${v.totalShortageAmount.toFixed(2)} | زيادة: +${v.totalSurplusAmount.toFixed(2)}`,
                      })),
                      totals: [
                        {
                          label: 'صافي أثر التسويات:',
                          value: adjustments.reduce((sum, v) => sum + (v.netAdjustmentAmount || 0), 0),
                          isBold: true,
                          isHighlight: true,
                        },
                      ],
                    },
                    appData.settings,
                    showToast
                  );
                }}
                onExportExcel={() => {
                  const adjustments = appData.inventoryAdjustments || [];
                  exportToExcel({
                    filename: `سندات_تسوية_المخزون_${new Date().toISOString().split('T')[0]}`,
                    sheetName: 'سندات التسوية',
                    data: adjustments,
                    columns: [
                      { header: 'رقم السند', key: 'voucherNumber', width: 16 },
                      { header: 'التاريخ', key: 'date', width: 14 },
                      { header: 'رقم جلسة الجرد', getValue: (v) => v.stocktakeSessionNumber || '-', width: 16 },
                      { header: 'الفرع', getValue: (v) => v.branchName || 'المخزن الرئيسي', width: 18 },
                      { header: 'رقم قيد اليومية', getValue: (v) => v.journalEntryId ? `JV-${v.journalEntryId}` : '-', width: 16 },
                      { header: 'إجمالي العجز (ج.م)', getValue: (v) => v.totalShortageAmount.toFixed(2), width: 18 },
                      { header: 'إجمالي الزيادة (ج.م)', getValue: (v) => v.totalSurplusAmount.toFixed(2), width: 18 },
                      { header: 'صافي التسوية (ج.م)', getValue: (v) => v.netAdjustmentAmount.toFixed(2), width: 18 },
                    ],
                    companyName: appData.settings?.companyName || 'المنظومة المحاسبية المعتمدة',
                    reportTitle: 'سجل سندات تسوية فروقات الجرد المخزني',
                  });
                  showToast('تم تصدير سجل سندات التسوية إلى Excel بنجاح', 'success');
                }}
                printTitle="طباعة سجل سندات التسوية"
                exportTitle="تصدير سندات التسوية إلى Excel"
              />
            </div>

            {/* Mobile Vouchers Cards */}
            <div className="block lg:hidden space-y-3">
              {!appData.inventoryAdjustments || appData.inventoryAdjustments.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  لا توجد سندات تسوية معتمدة بعد. عند اعتماد أي جلسة جرد بها فروقات ستظهر هنا تلقائياً.
                </div>
              ) : (
                appData.inventoryAdjustments.map((voucher) => (
                  <div
                    key={voucher.id}
                    className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3 hover:border-indigo-300 transition"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200/70 pb-2">
                      <div>
                        <span className="font-mono font-bold text-indigo-700 text-xs">{voucher.voucherNumber}</span>
                        <div className="text-xs text-slate-600 mt-0.5">
                          جلسة: <strong className="font-mono">{voucher.stocktakeSessionNumber || '-'}</strong>
                        </div>
                      </div>
                      {voucher.journalEntryId && (
                        <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-bold text-xs">
                          قيد #{voucher.journalEntryId}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-100">
                      <div>📅 التاريخ: <strong className="text-slate-800">{voucher.date}</strong></div>
                      <div>🏢 الفرع: <strong className="text-slate-800">{voucher.branchName || 'الرئيسي'}</strong></div>
                      <div>📦 الأصناف: <strong className="text-slate-800">{voucher.items.length} صنف</strong></div>
                      <div>
                        صافي التسوية:{' '}
                        <strong
                          className={`font-mono text-[11px] ${
                            voucher.netAdjustmentAmount < 0
                              ? 'text-rose-700'
                              : voucher.netAdjustmentAmount > 0
                              ? 'text-emerald-700'
                              : 'text-slate-700'
                          }`}
                        >
                          {voucher.netAdjustmentAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
                        </strong>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-white p-2 rounded-xl border border-slate-100 text-xs font-mono">
                      <div className="text-rose-600">عجز: -{voucher.totalShortageAmount.toFixed(2)} ج.م</div>
                      <div className="text-blue-600">زيادة: +{voucher.totalSurplusAmount.toFixed(2)} ج.م</div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={() => {
                          setSelectedVoucher(voucher);
                          setIsDetailsModalOpen(true);
                        }}
                        className="min-h-[42px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                      >
                        📄 تفاصيل
                      </button>
                      <button
                        onClick={() => printSettlementVoucher(voucher, appData)}
                        className="min-h-[42px] bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                      >
                        🖨️ طباعة السند
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop Vouchers Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-right text-xs md:text-sm">
                <thead className="bg-[#1a237e] text-white">
                  <tr>
                    <th className="p-3 rounded-r-xl">رقم سند التسوية</th>
                    <th className="p-3">التاريخ</th>
                    <th className="p-3">جلسة الجرد المرجعية</th>
                    <th className="p-3">الفرع</th>
                    <th className="p-3 text-center">الأصناف المعدلة</th>
                    <th className="p-3">إجمالي العجز</th>
                    <th className="p-3">إجمالي الزيادة</th>
                    <th className="p-3">صافي التسوية</th>
                    <th className="p-3">رقم قيد اليومية</th>
                    <th className="p-3 rounded-l-xl text-center">التفاصيل والطباعة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!appData.inventoryAdjustments || appData.inventoryAdjustments.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-400">
                        لا توجد سندات تسوية معتمدة بعد. عند اعتماد أي جلسة جرد بها فروقات ستظهر هنا تلقائياً.
                      </td>
                    </tr>
                  ) : (
                    appData.inventoryAdjustments.map((voucher) => (
                      <tr key={voucher.id} className="hover:bg-slate-50 transition">
                        <td className="p-3 font-mono font-bold text-indigo-700">{voucher.voucherNumber}</td>
                        <td className="p-3 font-mono text-slate-600">{voucher.date}</td>
                        <td className="p-3 font-mono font-semibold text-slate-800">
                          {voucher.stocktakeSessionNumber || '-'}
                        </td>
                        <td className="p-3 text-slate-600">{voucher.branchName || 'الفرع الرئيسي'}</td>
                        <td className="p-3 text-center font-bold">{voucher.items.length}</td>
                        <td className="p-3 font-mono font-bold text-rose-600">
                          {voucher.totalShortageAmount.toFixed(2)} ج.م
                        </td>
                        <td className="p-3 font-mono font-bold text-blue-600">
                          {voucher.totalSurplusAmount.toFixed(2)} ج.م
                        </td>
                        <td className="p-3 font-mono font-bold">
                          <span
                            className={
                              voucher.netAdjustmentAmount < 0
                                ? 'text-rose-700'
                                : voucher.netAdjustmentAmount > 0
                                ? 'text-emerald-700'
                                : 'text-slate-700'
                            }
                          >
                            {voucher.netAdjustmentAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
                          </span>
                        </td>
                        <td className="p-3 font-mono">
                          {voucher.journalEntryId ? (
                            <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-bold text-xs">
                              قيد #{voucher.journalEntryId}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedVoucher(voucher);
                                setIsDetailsModalOpen(true);
                              }}
                              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer"
                            >
                              📄 تفاصيل
                            </button>
                            <button
                              onClick={() => printSettlementVoucher(voucher, appData)}
                              className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer"
                              title="طباعة سند التسوية المعتمد"
                            >
                              🖨️ طباعة
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: GOODS ISSUE VOUCHERS (أذونات الصرف المخزني) */}
      {activeTab === 'goods_issue' && (
        <div className="space-y-4">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-lg">
                📤
              </div>
              <div>
                <span className="text-xs text-slate-500 block">إجمالي أذونات الصرف</span>
                <strong className="text-slate-900 text-base">
                  {appData.goodsIssueVouchers?.length || 0} إذن صرف
                </strong>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-lg">
                ✅
              </div>
              <div>
                <span className="text-xs text-slate-500 block">الأذونات المعتمدة</span>
                <strong className="text-emerald-700 text-base">
                  {(appData.goodsIssueVouchers || []).filter((v) => v.status === 'approved').length} إذن معتمد
                </strong>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-lg">
                📦
              </div>
              <div>
                <span className="text-xs text-slate-500 block">إجمالي الكميات المنصرفة</span>
                <strong className="text-indigo-700 text-base">
                  {(appData.goodsIssueVouchers || []).reduce((acc, v) => acc + (v.totalQty || 0), 0)} قطعة / وحدة
                </strong>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-lg">
                💰
              </div>
              <div>
                <span className="text-xs text-slate-500 block">إجمالي القيمة المنصرفة</span>
                <strong className="text-purple-700 text-base">
                  {(appData.goodsIssueVouchers || [])
                    .reduce((acc, v) => acc + (v.totalCost || 0), 0)
                    .toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
                  ج.م
                </strong>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <span className="text-slate-400">🔍</span>
              <input
                type="text"
                placeholder="بحث برقم الإذن، اسم المستلم، الصنف، أو الغرض..."
                value={issueSearchTerm}
                onChange={(e) => setIssueSearchTerm(e.target.value)}
                className="w-full text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenNewIssueModal}
                className="bg-[#0288d1] hover:bg-[#0277bd] text-white px-4 py-2 rounded-xl text-xs md:text-sm font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>➕</span> إنشاء إذن صرف جديد
              </button>
              <TableActionButtons
                onPrint={() => {
                  const filteredGoodsIssues = (appData.goodsIssueVouchers || []).filter((v) => {
                    if (!issueSearchTerm.trim()) return true;
                    const term = issueSearchTerm.toLowerCase();
                    return (
                      v.voucherNumber.toLowerCase().includes(term) ||
                      v.recipientName.toLowerCase().includes(term) ||
                      v.purposeReason.toLowerCase().includes(term) ||
                      v.items.some((i) => i.name.toLowerCase().includes(term) || (i.code && i.code.toLowerCase().includes(term)))
                    );
                  });
                  openUnifiedPrintWindow(
                    {
                      title: 'سجل وحصر أذونات الصرف المخزني',
                      partyLabel: 'إجمالي الأذونات',
                      partyName: `${filteredGoodsIssues.length} إذن صرف`,
                      items: filteredGoodsIssues.map((issue) => ({
                        name: `${issue.recipientName} (${issue.voucherNumber})`,
                        unit: issue.sourceBranchName || 'الرئيسي',
                        qty: issue.totalQty,
                        price: issue.totalQty > 0 ? issue.totalCost / issue.totalQty : 0,
                        total: issue.totalCost,
                        notes: `الغرض: ${issue.purposeReason} | التاريخ: ${issue.date}`,
                      })),
                      totals: [
                        {
                          label: 'إجمالي تكلفة المنصرف:',
                          value: filteredGoodsIssues.reduce((sum, v) => sum + (v.totalCost || 0), 0),
                          isBold: true,
                          isHighlight: true,
                        },
                      ],
                    },
                    appData.settings,
                    showToast
                  );
                }}
                onExportExcel={() => {
                  const filteredGoodsIssues = (appData.goodsIssueVouchers || []).filter((v) => {
                    if (!issueSearchTerm.trim()) return true;
                    const term = issueSearchTerm.toLowerCase();
                    return (
                      v.voucherNumber.toLowerCase().includes(term) ||
                      v.recipientName.toLowerCase().includes(term) ||
                      v.purposeReason.toLowerCase().includes(term) ||
                      v.items.some((i) => i.name.toLowerCase().includes(term) || (i.code && i.code.toLowerCase().includes(term)))
                    );
                  });
                  exportToExcel({
                    filename: `سجل_أذونات_الصرف_المخزني_${new Date().toISOString().split('T')[0]}`,
                    sheetName: 'أذونات الصرف',
                    data: filteredGoodsIssues,
                    columns: [
                      { header: 'رقم الإذن', key: 'voucherNumber', width: 16 },
                      { header: 'التاريخ', key: 'date', width: 14 },
                      { header: 'المخزن المصدر', getValue: (v) => v.sourceBranchName || 'المخزن الرئيسي', width: 20 },
                      { header: 'الجهة المستلمة', key: 'recipientName', width: 25 },
                      { header: 'الغرض / سبب الصرف', key: 'purposeReason', width: 30 },
                      { header: 'إجمالي الكمية', key: 'totalQty', width: 14 },
                      { header: 'إجمالي التكلفة (ج.م)', getValue: (v) => v.totalCost.toFixed(2), width: 18 },
                      { header: 'الحالة', getValue: (v) => v.status === 'approved' ? 'معتمد ومخصوم' : 'مسودة قيد الفحص', width: 18 },
                    ],
                    companyName: appData.settings?.companyName || 'المنظومة المحاسبية المعتمدة',
                    reportTitle: 'سجل وحصر أذونات الصرف المخزني المنفذة',
                  });
                  showToast('تم تصدير سجل أذونات الصرف إلى Excel بنجاح', 'success');
                }}
                printTitle="طباعة سجل أذونات الصرف"
                exportTitle="تصدير أذونات الصرف إلى Excel"
              />
            </div>
          </div>

          {/* Mobile Cards View */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:hidden">
            {(!appData.goodsIssueVouchers || appData.goodsIssueVouchers.length === 0) ? (
              <div className="col-span-full p-8 text-center text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">
                لا توجد أذونات صرف مخزني مسجلة بعد. انقر على "إنشاء إذن صرف مخزني جديد" للبدء.
              </div>
            ) : (
              appData.goodsIssueVouchers
                .filter((v) => {
                  if (!issueSearchTerm.trim()) return true;
                  const term = issueSearchTerm.toLowerCase();
                  return (
                    v.voucherNumber.toLowerCase().includes(term) ||
                    v.recipientName.toLowerCase().includes(term) ||
                    v.purposeReason.toLowerCase().includes(term) ||
                    v.items.some((i) => i.name.toLowerCase().includes(term) || (i.code && i.code.toLowerCase().includes(term)))
                  );
                })
                .map((issue) => (
                  <div
                    key={issue.id}
                    className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3 shadow-xs hover:border-indigo-300 transition"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div>
                        <span className="font-mono font-bold text-indigo-700 text-xs">{issue.voucherNumber}</span>
                        <h4 className="font-bold text-slate-900 text-sm mt-0.5">{issue.recipientName}</h4>
                      </div>
                      {issue.status === 'approved' ? (
                        <span className="bg-emerald-100 text-emerald-800 text-[11px] px-2.5 py-1 rounded-full font-bold">
                          ✅ معتمد ومخصوم
                        </span>
                      ) : (
                        <span className="bg-amber-100 text-amber-800 text-[11px] px-2.5 py-1 rounded-full font-bold">
                          📝 مسودة قيد الفحص
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div>📅 التاريخ: <strong className="text-slate-800">{issue.date}</strong></div>
                      <div>🏢 المخزن: <strong className="text-slate-800">{issue.sourceBranchName || 'الرئيسي'}</strong></div>
                      <div>📦 الأصناف: <strong className="text-slate-800">{issue.items.length} صنف ({issue.totalQty} وحدة)</strong></div>
                      <div>
                        💰 الإجمالي:{' '}
                        <strong className="text-indigo-700 font-mono">
                          {issue.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
                        </strong>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 line-clamp-2 bg-slate-50 p-2 rounded-lg">
                      📌 الغرض: {issue.purposeReason}
                    </p>

                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <button
                        onClick={() => {
                          setSelectedIssueVoucher(issue);
                          setIsIssueDetailsModalOpen(true);
                        }}
                        className="min-h-[40px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        👁️ معاينة
                      </button>
                      <button
                        onClick={() => printGoodsIssueNote(issue, appData, showToast)}
                        className="min-h-[40px] bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                        title="طباعة إذن الصرف الرسمي"
                      >
                        🖨️ طباعة
                      </button>
                      {issue.status !== 'approved' ? (
                        <button
                          onClick={() => handleApproveGoodsIssue(issue)}
                          className="min-h-[40px] bg-[#2e7d32] hover:bg-[#1b5e20] text-white px-2 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                        >
                          ⚡ اعتماد
                        </button>
                      ) : (
                        <span className="min-h-[40px] bg-slate-100 text-slate-500 px-2 py-1.5 rounded-xl text-[11px] font-bold flex items-center justify-center">
                          🔒 مقيد
                        </span>
                      )}
                    </div>
                  </div>
                ))
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs md:text-sm">
                <thead className="bg-[#1a237e] text-white">
                  <tr>
                    <th className="p-3 rounded-r-xl">رقم الإذن</th>
                    <th className="p-3">التاريخ والوقت</th>
                    <th className="p-3">المخزن المصدر</th>
                    <th className="p-3">الجهة المستلمة / القسم</th>
                    <th className="p-3">الغرض وسبب الصرف</th>
                    <th className="p-3 text-center">الأصناف</th>
                    <th className="p-3 text-center">الكمية</th>
                    <th className="p-3">إجمالي التكلفة</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3 rounded-l-xl text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(!appData.goodsIssueVouchers || appData.goodsIssueVouchers.length === 0) ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-400">
                        لا توجد أذونات صرف مخزني مسجلة بعد. انقر على "إنشاء إذن صرف مخزني جديد" للبدء.
                      </td>
                    </tr>
                  ) : (
                    appData.goodsIssueVouchers
                      .filter((v) => {
                        if (!issueSearchTerm.trim()) return true;
                        const term = issueSearchTerm.toLowerCase();
                        return (
                          v.voucherNumber.toLowerCase().includes(term) ||
                          v.recipientName.toLowerCase().includes(term) ||
                          v.purposeReason.toLowerCase().includes(term) ||
                          v.items.some((i) => i.name.toLowerCase().includes(term) || (i.code && i.code.toLowerCase().includes(term)))
                        );
                      })
                      .map((issue) => (
                        <tr key={issue.id} className="hover:bg-slate-50 transition">
                          <td className="p-3 font-mono font-bold text-indigo-700">{issue.voucherNumber}</td>
                          <td className="p-3 font-mono text-slate-600">
                            {issue.date} <span className="text-[11px] text-slate-400">{issue.time || ''}</span>
                          </td>
                          <td className="p-3 font-semibold text-slate-800">{issue.sourceBranchName || 'المخزن الرئيسي'}</td>
                          <td className="p-3 font-bold text-slate-900">{issue.recipientName}</td>
                          <td className="p-3 text-slate-600 max-w-xs truncate" title={issue.purposeReason}>
                            {issue.purposeReason}
                          </td>
                          <td className="p-3 text-center font-bold">{issue.items.length}</td>
                          <td className="p-3 text-center font-mono font-bold text-indigo-700">{issue.totalQty}</td>
                          <td className="p-3 font-mono font-bold text-slate-900">
                            {issue.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
                          </td>
                          <td className="p-3">
                            {issue.status === 'approved' ? (
                              <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-xs font-bold">
                                ✅ معتمد
                              </span>
                            ) : (
                              <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-xs font-bold">
                                📝 مسودة
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex justify-center gap-1.5">
                              <button
                                onClick={() => {
                                  setSelectedIssueVoucher(issue);
                                  setIsIssueDetailsModalOpen(true);
                                }}
                                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer"
                              >
                                👁️ معاينة
                              </button>
                              <button
                                onClick={() => printGoodsIssueNote(issue, appData, showToast)}
                                className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer"
                                title="طباعة إذن الصرف الرسمي بنمط القالب المعتمد"
                              >
                                🖨️ طباعة
                              </button>
                              {issue.status !== 'approved' && (
                                <button
                                  onClick={() => handleApproveGoodsIssue(issue)}
                                  className="bg-[#2e7d32] hover:bg-[#1b5e20] text-white px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
                                  title="اعتماد الإذن وخصم الكميات من رصيد المخزن"
                                >
                                  ⚡ اعتماد
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: CREATE NEW STOCKTAKE SESSION */}
      <Modal
        isOpen={isNewSessionModalOpen}
        onClose={() => setIsNewSessionModalOpen(false)}
        title="➕ فتح جلسة جرد مخازن جديدة"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <button
              onClick={() => setIsNewSessionModalOpen(false)}
              className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              إلغاء
            </button>
            <button
              onClick={handleCreateSession}
              className="bg-[#2e7d32] hover:bg-[#1b5e20] text-white px-6 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-md"
            >
              بدء جلسة الجرد
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs md:text-sm">
          <div>
            <label className="block font-bold text-slate-700 mb-1">مسمى وعنوان جلسة الجرد *</label>
            <input
              type="text"
              placeholder="مثال: جرد نهاية العام 2026 - المستودع الرئيسي..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">تاريخ الجرد</label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">الفرع والمستودع المستهدف</label>
              <select
                value={newBranchId}
                onChange={(e) => setNewBranchId(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl font-semibold"
              >
                {appData.branches?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">نطاق الأصناف المجرودة</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl font-semibold"
              >
                <option value="all">📦 كافة الأصناف والمجموعات (جرد كلي شامل)</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    فقط مجموعة: {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">أعضاء لجنة الجرد والمشرفين</label>
              <input
                type="text"
                placeholder="أحمد محمود، كريم عادل..."
                value={newCommittee}
                onChange={(e) => setNewCommittee(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">ملاحظات وتعليمات الجرد</label>
            <textarea
              rows={2}
              placeholder="أي تعليمات خاصة باللجنة أو مكان الجرد..."
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl"
            />
          </div>
        </div>
      </Modal>

      {/* MODAL 2: SETTLEMENT VOUCHER DETAILS MODAL */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        title={`⚖️ تفاصيل سند تسوية المخزون: ${selectedVoucher?.voucherNumber || ''}`}
        footer={
          <div className="flex justify-between items-center w-full">
            <span className="text-xs text-slate-500">
              قيد اليومية المرتبط: #{selectedVoucher?.journalEntryId || 'غير مرتبط'}
            </span>
            <div className="flex gap-2">
              {selectedVoucher && (
                <button
                  onClick={() => printSettlementVoucher(selectedVoucher, appData)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1"
                >
                  🖨️ طباعة السند المعتمد
                </button>
              )}
              <button
                onClick={() => setIsDetailsModalOpen(false)}
                className="bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        }
      >
        {selectedVoucher && (
          <div className="space-y-4 text-xs md:text-sm">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
              <div>
                <span className="text-slate-500 block text-[10px]">رقم السند</span>
                <strong>{selectedVoucher.voucherNumber}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">التاريخ</span>
                <strong>{selectedVoucher.date}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">جلسة الجرد</span>
                <strong>{selectedVoucher.stocktakeSessionNumber}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">المحرر</span>
                <strong>{selectedVoucher.createdBy}</strong>
              </div>
            </div>

            {/* Mobile Voucher Items (< md) */}
            <div className="block md:hidden space-y-2 max-h-[300px] overflow-y-auto">
              {selectedVoucher.items.map((item, idx) => (
                <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-slate-800">{item.itemName}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        item.varianceType === 'shortage'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {item.reason}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-center bg-white p-1.5 rounded-lg border border-slate-200 text-[11px] font-mono">
                    <div>
                      <span className="text-slate-400 block text-[9px]">دفتري</span>
                      <span>{item.bookQtyBefore}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px]">مسواة</span>
                      <span className={item.varianceType === 'shortage' ? 'text-rose-700 font-bold' : 'text-blue-700 font-bold'}>
                        {item.adjustedQty > 0 ? `+${item.adjustedQty}` : item.adjustedQty}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px]">جديد</span>
                      <span className="text-emerald-700 font-bold">{item.newStockQty}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 pt-1">
                    <span>التكلفة: {item.unitCost.toFixed(2)} ج.م</span>
                    <span className="font-bold text-slate-900">الإجمالي: {item.totalAmount.toFixed(2)} ج.م</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Voucher Items Table (>= md) */}
            <div className="hidden md:block overflow-x-auto max-h-[300px] border border-slate-200 rounded-2xl">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 sticky top-0">
                  <tr>
                    <th className="p-2.5">الصنف</th>
                    <th className="p-2.5 text-center">الرصيد الدفتري</th>
                    <th className="p-2.5 text-center">الكمية المسواة</th>
                    <th className="p-2.5 text-center">الرصيد الجديد</th>
                    <th className="p-2.5">سعر التكلفة</th>
                    <th className="p-2.5">الإجمالي</th>
                    <th className="p-2.5">النوع والسبب</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedVoucher.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-800">{item.itemName}</td>
                      <td className="p-2.5 text-center font-mono">{item.bookQtyBefore}</td>
                      <td className="p-2.5 text-center font-mono font-bold">
                        <span className={item.varianceType === 'shortage' ? 'text-rose-700' : 'text-blue-700'}>
                          {item.adjustedQty > 0 ? `+${item.adjustedQty}` : item.adjustedQty}
                        </span>
                      </td>
                      <td className="p-2.5 text-center font-mono font-bold text-emerald-700">{item.newStockQty}</td>
                      <td className="p-2.5 font-mono">{item.unitCost.toFixed(2)} ج.م</td>
                      <td className="p-2.5 font-mono font-bold">{item.totalAmount.toFixed(2)} ج.م</td>
                      <td className="p-2.5">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                            item.varianceType === 'shortage'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {item.reason}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-purple-50 p-4 rounded-2xl border border-purple-200 text-xs flex justify-between items-center">
              <div>
                <strong className="text-purple-900 block">
                  الأثر المحاسبي والقيد المزدوج التلقائي (#{selectedVoucher.journalEntryId})
                </strong>
                <span className="text-purple-700">
                  تم قيد العجز كمدين في حساب عجز وفاقد المخزون (5206) ودائن في مخزون البضاعة (1106).
                </span>
              </div>
              <strong className="text-sm font-mono text-purple-900">
                صافي التسوية: {selectedVoucher.netAdjustmentAmount.toFixed(2)} ج.م
              </strong>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 3: PRINTABLE STOCKTAKE SHEET */}
      <Modal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        title="🖨️ طباعة استمارة الجرد ومحضر المطابقة"
        footer={
          <div className="flex justify-between items-center w-full">
            <button
              onClick={() => currentSession && printStocktakeSession(currentSession, appData)}
              className="bg-[#1a237e] hover:bg-[#0d47a1] text-white px-6 py-2 rounded-xl text-xs font-bold cursor-pointer"
            >
              🖨️ طباعة الآن
            </button>
            <button
              onClick={() => setIsPrintModalOpen(false)}
              className="bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        }
      >
        {currentSession && (
          <div className="space-y-4 p-4 border border-slate-300 rounded-xl bg-white text-xs" id="printable-stocktake">
            <div className="text-center pb-3 border-b-2 border-slate-800 space-y-1">
              <h3 className="text-base font-black text-slate-900">{appData.settings.companyName}</h3>
              <h4 className="text-sm font-bold text-indigo-900">استمارة الجرد الفعلي للمخازن</h4>
              <p className="text-slate-500">
                جلسة رقم: {currentSession.sessionNumber} | التاريخ: {currentSession.date} | الفرع: {currentSession.branchName}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs border border-slate-300">
              <thead className="bg-slate-100 border-b border-slate-300">
                <tr>
                  <th className="p-2 border-l border-slate-300">م</th>
                  <th className="p-2 border-l border-slate-300">اسم الصنف</th>
                  <th className="p-2 border-l border-slate-300 text-center">الرصيد الدفتري</th>
                  <th className="p-2 border-l border-slate-300 text-center">العدد الفعلي (كتابة)</th>
                  <th className="p-2 border-l border-slate-300 text-center">الفارق</th>
                  <th className="p-2">ملاحظات وتوقيع العضو</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {currentSession.items.map((it, idx) => (
                  <tr key={it.itemId}>
                    <td className="p-2 border-l border-slate-300 text-center font-mono">{idx + 1}</td>
                    <td className="p-2 border-l border-slate-300 font-bold">{it.itemName}</td>
                    <td className="p-2 border-l border-slate-300 text-center font-mono">{it.bookQty}</td>
                    <td className="p-2 border-l border-slate-300 text-center font-mono font-bold">
                      {it.countedQty}
                    </td>
                    <td className="p-2 border-l border-slate-300 text-center font-mono">
                      {it.varianceQty !== 0 ? it.varianceQty : 'مطابق'}
                    </td>
                    <td className="p-2 text-slate-500">{it.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-6 text-center font-bold text-slate-800">
              <div>
                <p className="text-[10px] text-slate-500 mb-8">أمين المخزن</p>
                <div className="border-t border-slate-400 pt-1">التوقيع: ....................</div>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 mb-8">رئيس لجنة الجرد</p>
                <div className="border-t border-slate-400 pt-1">التوقيع: ....................</div>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 mb-8">المدير المالي / الاعتماد</p>
                <div className="border-t border-slate-400 pt-1">التوقيع: ....................</div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 4: CREATE NEW GOODS ISSUE VOUCHER (إنشاء إذن صرف مخزني جديد) */}
      <Modal
        isOpen={isNewIssueModalOpen}
        onClose={() => setIsNewIssueModalOpen(false)}
        title="📤 تحرير إذن صرف مخزني جديد"
        footer={
          <div className="flex flex-wrap justify-between items-center gap-2 w-full">
            <button
              onClick={() => setIsNewIssueModalOpen(false)}
              className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              إلغاء
            </button>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleSaveGoodsIssue(false, false)}
                className="bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                💾 حفظ كمسودة
              </button>
              <button
                onClick={() => handleSaveGoodsIssue(false, true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-md flex items-center gap-1"
              >
                <span>🖨️</span> حفظ وطباعة فورية
              </button>
              <button
                onClick={() => handleSaveGoodsIssue(true, true)}
                className="bg-[#2e7d32] hover:bg-[#1b5e20] text-white px-5 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-lg flex items-center gap-1"
              >
                <span>⚡</span> اعتماد وخصم من المخزن وطباعة
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 text-xs md:text-sm max-h-[75vh] overflow-y-auto pr-1">
          {/* Top Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            <div>
              <label className="block font-bold text-slate-700 mb-1">المستودع / المخزن المصدر *</label>
              <select
                value={newIssueBranchId}
                onChange={(e) => setNewIssueBranchId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {(appData.branches || []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">تاريخ الصرف *</label>
              <input
                type="date"
                value={newIssueDate}
                onChange={(e) => setNewIssueDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">نوع الجهة المستلمة *</label>
              <select
                value={newIssueRecipientType}
                onChange={(e) => setNewIssueRecipientType(e.target.value as any)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="maintenance">قسم الصيانة والتشغيل</option>
                <option value="branch">فرع آخر / مستودع داخلي</option>
                <option value="department">إدارة أو قسم داخلي</option>
                <option value="production">خط إنتاج / تصنيع</option>
                <option value="customer">عميل / تسليم خارجي</option>
                <option value="internal">استخدام داخلي</option>
                <option value="other">أخرى</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">اسم الجهة / المستلم / القسم *</label>
              <input
                type="text"
                placeholder="مثال: فرع المنتزه / قسم الصيانة العامة"
                value={newIssueRecipient}
                onChange={(e) => setNewIssueRecipient(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">أمين المخزن المسؤول</label>
              <input
                type="text"
                value={newIssueWarehouseKeeper}
                onChange={(e) => setNewIssueWarehouseKeeper(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block font-bold text-slate-700 mb-1">الغرض وسبب الصرف</label>
              <textarea
                rows={2}
                placeholder="مثال: صرف قطع غيار ومستلزمات تشغيل بناءً على طلب الاحتياج رقم (REQ-402) بغرض صيانة وتشغيل خط الإنتاج الثاني."
                value={newIssuePurpose}
                onChange={(e) => setNewIssuePurpose(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Items Section */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-slate-800 text-xs md:text-sm flex items-center gap-1.5">
                <span>📦</span> قائمة الأصناف المنصرفة ({newIssueItems.length})
              </h4>
              <button
                type="button"
                onClick={handleAddIssueItemRow}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <span>➕</span> إضافة صنف
              </button>
            </div>

            {/* Mobile Issue Items Cards (< md) */}
            <div className="block md:hidden space-y-2.5">
              {newIssueItems.length === 0 ? (
                <div className="p-4 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs">
                  لم يتم إضافة أي صنف بعد. انقر على "إضافة صنف" لإدراج أصناف لإذن الصرف.
                </div>
              ) : (
                newIssueItems.map((row, idx) => (
                  <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] text-slate-500 block mb-0.5 font-bold">الصنف #{idx + 1}</label>
                        <select
                          value={row.itemId}
                          onChange={(e) => handleUpdateIssueItem(idx, 'itemId', e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          {(appData.items || []).map((it) => (
                            <option key={it.id} value={it.id}>
                              {it.name} ({it.barcode || it.code || 'بدون كود'})
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveIssueItemRow(idx)}
                        className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg bg-rose-50 cursor-pointer font-bold shrink-0 mt-3.5"
                        title="حذف هذا الصنف"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-0.5">الكود</label>
                        <input
                          type="text"
                          value={row.code}
                          onChange={(e) => handleUpdateIssueItem(idx, 'code', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded p-1 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-0.5">الوحدة</label>
                        <input
                          type="text"
                          value={row.unit}
                          onChange={(e) => handleUpdateIssueItem(idx, 'unit', e.target.value)}
                          className="w-full text-center bg-white border border-slate-200 rounded p-1 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-0.5">الرصيد المتاح</label>
                        <div className={`font-mono font-bold text-xs p-1 text-center rounded ${
                          row.currentStock > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {row.currentStock}
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-0.5">الكمية المنصرفة</label>
                        <input
                          type="number"
                          min="1"
                          value={row.qty}
                          onChange={(e) => handleUpdateIssueItem(idx, 'qty', Math.max(1, Number(e.target.value)))}
                          className="w-full text-center font-mono font-bold text-indigo-700 bg-white border border-indigo-300 rounded-lg p-1 text-xs focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-0.5">سعر التكلفة</label>
                        <input
                          type="number"
                          step="0.1"
                          value={row.unitCost}
                          onChange={(e) => handleUpdateIssueItem(idx, 'unitCost', Number(e.target.value))}
                          className="w-full text-center font-mono bg-white border border-slate-300 rounded p-1 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-0.5">إجمالي التكلفة</label>
                        <div className="p-1 bg-white border border-slate-200 rounded text-center font-mono font-bold text-slate-900">
                          {(Number(row.qty || 1) * Number(row.unitCost || 0)).toFixed(2)} ج.م
                        </div>
                      </div>
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="ملاحظات الصنف..."
                        value={row.notes || ''}
                        onChange={(e) => handleUpdateIssueItem(idx, 'notes', e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded p-1 text-xs"
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop Table (>= md) */}
            <div className="hidden md:block border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <table className="w-full text-right text-xs">
                <thead className="bg-[#1a237e] text-white">
                  <tr>
                    <th className="p-2.5 w-10 text-center">م</th>
                    <th className="p-2.5 min-w-[200px]">اسم الصنف</th>
                    <th className="p-2.5 w-24">الكود</th>
                    <th className="p-2.5 w-20 text-center">الوحدة</th>
                    <th className="p-2.5 w-20 text-center">الرصيد المتاح</th>
                    <th className="p-2.5 w-24 text-center">الكمية المنصرفة</th>
                    <th className="p-2.5 w-28 text-center">سعر التكلفة</th>
                    <th className="p-2.5 w-28 text-center">إجمالي التكلفة</th>
                    <th className="p-2.5">ملاحظات الصنف</th>
                    <th className="p-2.5 w-12 text-center">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {newIssueItems.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-6 text-center text-slate-400">
                        لم يتم إضافة أي صنف بعد. انقر على "إضافة صنف" لإدراج أصناف لإذن الصرف.
                      </td>
                    </tr>
                  ) : (
                    newIssueItems.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2 text-center font-mono text-slate-500">{idx + 1}</td>
                        <td className="p-2">
                          <select
                            value={row.itemId}
                            onChange={(e) => handleUpdateIssueItem(idx, 'itemId', e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            {(appData.items || []).map((it) => (
                              <option key={it.id} value={it.id}>
                                {it.name} ({it.barcode || it.code || 'بدون كود'})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2 font-mono text-xs text-slate-600">
                          <input
                            type="text"
                            value={row.code}
                            onChange={(e) => handleUpdateIssueItem(idx, 'code', e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded p-1 text-xs font-mono"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="text"
                            value={row.unit}
                            onChange={(e) => handleUpdateIssueItem(idx, 'unit', e.target.value)}
                            className="w-16 text-center bg-white border border-slate-200 rounded p-1 text-xs"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <span
                            className={`font-mono font-bold text-xs px-2 py-0.5 rounded ${
                              row.currentStock > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {row.currentStock}
                          </span>
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="number"
                            min="1"
                            value={row.qty}
                            onChange={(e) => handleUpdateIssueItem(idx, 'qty', Math.max(1, Number(e.target.value)))}
                            className="w-20 text-center font-mono font-bold text-indigo-700 bg-white border border-indigo-300 rounded-lg p-1 text-xs focus:ring-1 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="number"
                            step="0.1"
                            value={row.unitCost}
                            onChange={(e) => handleUpdateIssueItem(idx, 'unitCost', Number(e.target.value))}
                            className="w-24 text-center font-mono bg-white border border-slate-300 rounded p-1 text-xs"
                          />
                        </td>
                        <td className="p-2 text-center font-mono font-bold text-slate-900">
                          {(Number(row.qty || 1) * Number(row.unitCost || 0)).toFixed(2)} ج.م
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            placeholder="ملاحظات..."
                            value={row.notes || ''}
                            onChange={(e) => handleUpdateIssueItem(idx, 'notes', e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded p-1 text-xs"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveIssueItemRow(idx)}
                            className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50 cursor-pointer font-bold"
                            title="حذف هذا الصنف"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals Box */}
          <div className="bg-[#1a237e] text-white p-4 rounded-2xl flex flex-wrap justify-between items-center gap-4">
            <div className="flex gap-6">
              <div>
                <span className="text-[11px] text-blue-200 block">عدد الأصناف</span>
                <strong className="text-base">{newIssueItems.length} صنف</strong>
              </div>
              <div>
                <span className="text-[11px] text-blue-200 block">إجمالي الكمية المنصرفة</span>
                <strong className="text-base font-mono">
                  {newIssueItems.reduce((acc, i) => acc + (Number(i.qty) || 0), 0)} قطعة
                </strong>
              </div>
            </div>
            <div className="text-left">
              <span className="text-[11px] text-blue-200 block">إجمالي تكلفة الإذن</span>
              <strong className="text-xl font-mono text-[#ffd54f]">
                {newIssueItems
                  .reduce((acc, i) => acc + (Number(i.qty) || 0) * (Number(i.unitCost) || 0), 0)
                  .toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
                ج.م
              </strong>
            </div>
          </div>

          {/* Signatures Form Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <div>
              <label className="block font-bold text-slate-700 mb-1">مستلم البضاعة / التوقيع</label>
              <input
                type="text"
                placeholder="مثال: م. أحمد فؤاد (مشرف الصيانة)"
                value={newIssueRecipientSignatory}
                onChange={(e) => setNewIssueRecipientSignatory(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">المعتمد / مدير المخازن</label>
              <input
                type="text"
                value={newIssueApprovedBy}
                onChange={(e) => setNewIssueApprovedBy(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* MODAL 5: GOODS ISSUE VOUCHER DETAILS & PRINT (معاينة إذن الصرف وطباعته) */}
      <Modal
        isOpen={isIssueDetailsModalOpen}
        onClose={() => setIsIssueDetailsModalOpen(false)}
        title={
          selectedIssueVoucher
            ? `📄 تفاصيل إذن صرف مخزني (${selectedIssueVoucher.voucherNumber})`
            : '📄 تفاصيل إذن الصرف'
        }
        footer={
          <div className="flex flex-wrap justify-between items-center gap-2 w-full">
            <button
              onClick={() => setIsIssueDetailsModalOpen(false)}
              className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              إغلاق
            </button>
            {selectedIssueVoucher && (
              <div className="flex gap-2">
                {selectedIssueVoucher.status !== 'approved' && (
                  <button
                    onClick={() => {
                      handleApproveGoodsIssue(selectedIssueVoucher);
                      setIsIssueDetailsModalOpen(false);
                    }}
                    className="bg-[#2e7d32] hover:bg-[#1b5e20] text-white px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-md flex items-center gap-1"
                  >
                    <span>⚡</span> اعتماد وخصم من المخزون
                  </button>
                )}
                <button
                  onClick={() => printGoodsIssueNote(selectedIssueVoucher, appData, showToast)}
                  className="bg-[#1a237e] hover:bg-[#0d47a1] text-white px-5 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-lg flex items-center gap-1.5"
                >
                  <span>🖨️</span> طباعة إذن الصرف الرسمي
                </button>
              </div>
            )}
          </div>
        }
      >
        {selectedIssueVoucher && (
          <div className="space-y-4 text-xs md:text-sm max-h-[75vh] overflow-y-auto pr-1">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <span className="text-[11px] text-slate-500 block">رقم الإذن:</span>
                <strong className="text-indigo-700 font-mono font-bold text-sm">
                  {selectedIssueVoucher.voucherNumber}
                </strong>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">التاريخ والوقت:</span>
                <strong className="text-slate-800 font-mono">
                  {selectedIssueVoucher.date} {selectedIssueVoucher.time || ''}
                </strong>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">المخزن المصدر:</span>
                <strong className="text-slate-800">
                  {selectedIssueVoucher.sourceBranchName || 'المخزن الرئيسي'}
                </strong>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">الحالة:</span>
                {selectedIssueVoucher.status === 'approved' ? (
                  <span className="bg-emerald-100 text-emerald-800 text-[11px] px-2 py-0.5 rounded-full font-bold">
                    ✅ معتمد ومخصوم
                  </span>
                ) : (
                  <span className="bg-amber-100 text-amber-800 text-[11px] px-2 py-0.5 rounded-full font-bold">
                    📝 مسودة
                  </span>
                )}
              </div>
              <div className="col-span-2">
                <span className="text-[11px] text-slate-500 block">الجهة / المستلم:</span>
                <strong className="text-slate-900 font-bold">{selectedIssueVoucher.recipientName}</strong>
              </div>
              <div className="col-span-2">
                <span className="text-[11px] text-slate-500 block">الغرض وسبب الصرف:</span>
                <span className="text-slate-700">{selectedIssueVoucher.purposeReason}</span>
              </div>
            </div>

            {/* Items Table */}
            {/* Mobile Voucher Items Cards (< md) */}
            <div className="block md:hidden space-y-2">
              {selectedIssueVoucher.items.map((it, idx) => (
                <div key={idx} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs space-y-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-slate-800 text-xs">{it.name}</span>
                      <span className="text-[11px] text-slate-400 block font-mono">{it.code || '-'}</span>
                    </div>
                    <span className="font-mono font-bold text-slate-900">{it.totalCost.toFixed(2)} ج.م</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/50">
                    <span>الكمية: <strong className="text-indigo-700 font-mono">{it.qty} {it.unit || 'قطعة'}</strong></span>
                    <span>سعر التكلفة: <strong className="text-slate-700 font-mono">{it.unitCost.toFixed(2)} ج.م</strong></span>
                  </div>
                  {it.notes && (
                    <div className="text-[10px] text-slate-400 italic">ملاحظة: {it.notes}</div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-right text-xs">
                <thead className="bg-[#1a237e] text-white">
                  <tr>
                    <th className="p-2.5 text-center">م</th>
                    <th className="p-2.5">كود الصنف</th>
                    <th className="p-2.5">اسم الصنف والمواصفات</th>
                    <th className="p-2.5 text-center">الوحدة</th>
                    <th className="p-2.5 text-center">الكمية</th>
                    <th className="p-2.5 text-center">سعر التكلفة</th>
                    <th className="p-2.5 text-center">إجمالي القيمة</th>
                    <th className="p-2.5">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedIssueVoucher.items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2.5 text-center font-mono text-slate-500">{idx + 1}</td>
                      <td className="p-2.5 font-mono font-bold text-indigo-700">{it.code || '-'}</td>
                      <td className="p-2.5 font-bold text-slate-800">{it.name}</td>
                      <td className="p-2.5 text-center">{it.unit || 'قطعة'}</td>
                      <td className="p-2.5 text-center font-mono font-bold text-indigo-700">{it.qty}</td>
                      <td className="p-2.5 text-center font-mono">{it.unitCost.toFixed(2)} ج.م</td>
                      <td className="p-2.5 text-center font-mono font-bold text-slate-900">
                        {it.totalCost.toFixed(2)} ج.م
                      </td>
                      <td className="p-2.5 text-slate-500">{it.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals & Accounting */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-slate-100 p-3 rounded-2xl border border-slate-200 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span>إجمالي عدد الأصناف:</span>
                  <strong>{selectedIssueVoucher.items.length} صنف</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span>إجمالي الكميات المنصرفة:</span>
                  <strong className="font-mono text-indigo-700">{selectedIssueVoucher.totalQty} وحدة</strong>
                </div>
                <div className="flex justify-between py-1 pt-2 font-bold text-sm">
                  <span>إجمالي القيمة المنصرفة:</span>
                  <span className="font-mono text-emerald-700">
                    {selectedIssueVoucher.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
                  </span>
                </div>
              </div>

              <div className="bg-purple-50 p-3 rounded-2xl border border-purple-200 text-xs space-y-1">
                <strong className="text-purple-900 block">
                  الأثر المحاسبي والقيد المزدوج{' '}
                  {selectedIssueVoucher.journalEntryId ? `(قيد #${selectedIssueVoucher.journalEntryId})` : ''}
                </strong>
                <p className="text-purple-800 text-[11px] leading-relaxed">
                  مدين: حساب تكلفة البضاعة المنصرفة (5101) <br />
                  دائن: حساب مخزون البضاعة بالمستودعات (1106)
                </p>
                <span className="text-[11px] text-purple-600 font-bold block pt-1">
                  المعتمد: {selectedIssueVoucher.approvedBy || 'أ. محمد نزيه'}
                </span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
