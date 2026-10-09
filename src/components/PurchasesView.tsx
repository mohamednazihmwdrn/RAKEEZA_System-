import React, { useState } from 'react';
import {
  Plus,
  RotateCcw,
  Search,
  Eye,
  Pencil,
  Trash2,
  Printer,
  DollarSign,
  Building2,
  User as UserIcon,
  FileText,
  CheckCircle2,
  AlertCircle,
  Save,
  X,
} from 'lucide-react';
import { AppData, PurchaseInvoice, InvoiceItem } from '../types';
import { Modal } from './Modal';
import { printInvoiceWindow } from '../utils/printInvoice';
import { InvoiceCardTemplate } from './InvoiceCardTemplate';
import { exportToExcel } from '../utils/excelExport';
import { openUnifiedPrintWindow } from '../utils/printUnified';
import { TableActionButtons } from './TableActionButtons';
import { InvoiceItemModal } from './InvoiceItemModal';
import { UnifiedInvoiceItemSystem, InvoiceItemUnified, PaymentRow } from './UnifiedInvoiceItemSystem';
import { postPurchaseInvoice, deletePurchaseInvoice } from '../utils/posting';
import { calculateSupplierBalance } from '../utils/accounting';
import { RakeezaInvoiceWorkspace } from './RakeezaInvoiceWorkspace';

interface PurchasesViewProps {
  appData: AppData;
  onUpdateData: (newData: AppData, actionInfo?: { action?: string; module?: string; details?: string; deletedId?: string | number }) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onInspectItem?: (type: string, data: any) => void;
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({ appData, onUpdateData, showToast }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('all');
  const [selectedBranchId, setSelectedBranchId] = useState<string>(appData.activeBranchId || appData.branches?.[0]?.id || 'main');
  const [activeModal, setActiveModal] = useState<'create' | 'edit' | 'view' | 'pay' | null>(null);
  const [modalType, setModalType] = useState<'nagdi' | 'ajel' | 'return_nagdi' | 'return_ajel'>('nagdi');
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);
  const [editingInvoiceId, setEditingInvoiceId] = useState<number | null>(null);

  // Form State
  const [supplierName, setSupplierName] = useState('');
  const [phone, setPhone] = useState('');
  const [supplierRepId, setSupplierRepId] = useState('');
  const [supplierRepName, setSupplierRepName] = useState('');
  const [supplierRepPhone, setSupplierRepPhone] = useState('');
  const [salesRep, setSalesRep] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paidAmountInput, setPaidAmountInput] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'drawer' | 'vodafone' | 'instapay' | 'bank'>('drawer');
  const [tempItems, setTempItems] = useState<InvoiceItem[]>([]);

  // 🏷️ Purchases Pricing Type (buy vs wholesale)
  const [purchasesPricingType, setPurchasesPricingType] = useState<'cash' | 'wholesale' | 'buy'>('buy');

  // 📦 Unified Invoice Items & Financials State
  const [unifiedItems, setUnifiedItems] = useState<InvoiceItemUnified[]>([]);
  const [globalInvDisc, setGlobalInvDisc] = useState<number>(0);
  const [invDiscType, setInvDiscType] = useState<'percent' | 'val'>('percent');
  const [globalInvTax, setGlobalInvTax] = useState<number>(0);
  const [invTaxType, setInvTaxType] = useState<'percent' | 'val'>('percent');
  const [extraIncomeName, setExtraIncomeName] = useState<string>('');
  const [extraIncomeVal, setExtraIncomeVal] = useState<number>(0);
  const [paymentRows, setPaymentRows] = useState<PaymentRow[]>([
    { id: 'pay_1', method: 'نقدي / كاش', amount: 0 },
  ]);

  // 📦 Item Card Modal State (كارت الصنف)
  const [isItemCardModalOpen, setIsItemCardModalOpen] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [editingItemData, setEditingItemData] = useState<InvoiceItem | null>(null);

  // Item Draft Input (Quick Inline)
  const [itemName, setItemName] = useState('');
  const [itemQty, setItemQty] = useState('');
  const [itemPrice, setItemPrice] = useState('');

  // Discount/Tax/Fees & Extra Adjustments (All empty / zero by default, optional percent vs fixed)
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discount, setDiscount] = useState<number>(0);
  const [taxType, setTaxType] = useState<'percent' | 'fixed'>('percent');
  const [tax, setTax] = useState<number>(0);
  const [extraRevenueName, setExtraRevenueName] = useState<string>(''); // اسم الإيراد / الخصم الإضافي
  const [extraRevenueAmount, setExtraRevenueAmount] = useState<number>(0); // مبلغ الإيراد الإضافي
  const [fees, setFees] = useState<number>(0);

  // Payment Modal for Credit Invoices
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<'drawer' | 'vodafone' | 'instapay' | 'bank'>('drawer');

  // Autocomplete Dropdowns State
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [showPhoneDropdown, setShowPhoneDropdown] = useState(false);
  const [showItemDropdown, setShowItemDropdown] = useState(false);

  const filteredSuppliersForName = appData.suppliers.filter((s) => {
    const q = supplierName.trim().toLowerCase();
    if (!q) return true;
    return s.name.toLowerCase().includes(q) || (s.phone && s.phone.toLowerCase().includes(q));
  });

  const filteredSuppliersForPhone = appData.suppliers.filter((s) => {
    const q = phone.trim().toLowerCase();
    if (!q) return true;
    return s.name.toLowerCase().includes(q) || (s.phone && s.phone.toLowerCase().includes(q));
  });

  const filteredItemsForSearch = appData.items.filter((i) => {
    const q = itemName.trim().toLowerCase();
    if (!q) return true;
    return i.name.toLowerCase().includes(q) || (i.id && i.id.toString().includes(q));
  });

  const filteredInvoices = appData.purchaseInvoices.filter((inv) => {
    if (selectedBranchFilter !== 'all' && inv.branchId && inv.branchId !== selectedBranchFilter) {
      return false;
    }
    const s = searchTerm.toLowerCase();
    return (
      inv.id.toString().includes(s) ||
      inv.supplierName?.toLowerCase().includes(s) ||
      inv.phone?.toLowerCase().includes(s) ||
      inv.salesRep?.toLowerCase().includes(s) ||
      inv.notes?.toLowerCase().includes(s)
    );
  });

  const getMethodLabel = (m: string) => {
    switch (m) {
      case 'drawer':
        return 'الدرج (الخزينة الرئيسية)';
      case 'vodafone':
        return 'فودافون كاش';
      case 'instapay':
        return 'إنستاباي (InstaPay)';
      case 'bank':
        return 'حساب بنكي';
      default:
        return m;
    }
  };

  const openCreateModal = (
    type: 'nagdi' | 'ajel' | 'return_nagdi' | 'return_ajel',
    pricingType: 'cash' | 'wholesale' | 'buy' = 'buy'
  ) => {
    setEditingInvoiceId(null);
    setSelectedBranchId(appData.activeBranchId || appData.branches?.[0]?.id || 'main');
    setModalType(type);
    setPurchasesPricingType(pricingType);
    setSupplierName('');
    setPhone('');
    setSupplierRepId('');
    setSupplierRepName('');
    setSupplierRepPhone('');
    setSalesRep('');
    setNotes('');
    setDate(new Date().toISOString().split('T')[0]);
    setPaymentMethod('drawer');
    setPaidAmountInput(type === 'ajel' || type === 'return_ajel' ? '0' : '');
    setTempItems([]);

    // Reset Unified System state
    setUnifiedItems([]);
    setGlobalInvDisc(0);
    setInvDiscType('percent');
    setGlobalInvTax(0);
    setInvTaxType('percent');
    setExtraIncomeName('');
    setExtraIncomeVal(0);
    setPaymentRows([{ id: `pay_${Date.now()}`, method: 'نقدي / كاش', amount: 0 }]);

    setItemName('');
    setItemQty('');
    setItemPrice('');
    setDiscountType('percent');
    setDiscount(0);
    setTaxType('percent');
    setTax(0);
    setExtraRevenueName('');
    setExtraRevenueAmount(0);
    setFees(0);
    setShowSupplierDropdown(false);
    setShowPhoneDropdown(false);
    setShowItemDropdown(false);
    setActiveModal('create');
  };

  const openEditModal = (inv: PurchaseInvoice) => {
    setEditingInvoiceId(inv.id);
    setSelectedBranchId(inv.branchId || appData.activeBranchId || appData.branches?.[0]?.id || 'main');
    setModalType(inv.type);
    setSupplierName(inv.supplierName || '');
    setPhone(inv.phone || '');
    setSupplierRepId((inv as any).supplierRepId || '');
    setSupplierRepName((inv as any).supplierRepName || '');
    setSupplierRepPhone((inv as any).supplierRepPhone || '');
    setSalesRep(inv.salesRep || '');
    setNotes(inv.notes || '');
    setDate(inv.date || new Date().toISOString().split('T')[0]);
    setPaymentMethod((inv.paymentMethod as any) || 'drawer');
    setPaidAmountInput(inv.paidAmount !== undefined ? inv.paidAmount.toString() : '');
    setTempItems(inv.items ? [...inv.items] : []);

    // Map items to unified items
    const mappedItems: InvoiceItemUnified[] = (inv.items || []).map((i) => ({
      code: i.code || (i.itemId ? `ITM-${i.itemId.substring(0, 6)}` : 'G000'),
      name: i.name,
      price: Number(i.price || 0),
      qty: Number(i.qty || 1),
      discVal: Number(i.discVal ?? i.discountValue ?? 0),
      discType: (i.discType === 'val' || i.discountType === 'fixed') ? 'val' : 'percent',
      actualDisc: Number(i.actualDisc ?? i.discount ?? 0),
      taxVal: Number(i.taxVal ?? i.taxValue ?? 0),
      taxType: (i.taxType === 'val' || i.taxType === 'fixed') ? 'val' : 'percent',
      actualTax: Number(i.actualTax ?? i.tax ?? 0),
      spec: i.spec || i.notes || '',
      total: Number(i.total || 0),
      itemId: i.itemId,
      costPrice: i.costPrice,
    }));
    setUnifiedItems(mappedItems);

    setGlobalInvDisc(inv.discountValue || (inv.discountType === 'percent' ? inv.discount : 0) || 0);
    setInvDiscType(inv.discountType === 'fixed' ? 'val' : 'percent');
    setGlobalInvTax(inv.taxValue || (inv.taxType === 'fixed' ? inv.tax : 0) || 0);
    setInvTaxType(inv.taxType === 'fixed' ? 'val' : 'percent');
    setExtraIncomeName(inv.extraRevenueName || '');
    setExtraIncomeVal(inv.extraRevenueAmount || 0);

    if (inv.paymentSplits && inv.paymentSplits.length > 0) {
      setPaymentRows(
        inv.paymentSplits.map((p, idx) => ({
          id: `pay_${idx}_${Date.now()}`,
          method: p.method === 'drawer' ? 'نقدي / كاش' : p.method === 'vodafone' ? 'فودافون كاش' : p.method === 'instapay' ? 'إنستاباي (InstaPay)' : 'تحويل بنكي',
          amount: Number(p.amount || 0),
        }))
      );
    } else {
      const pmLabel = inv.paymentMethod === 'vodafone' ? 'فودافون كاش' : inv.paymentMethod === 'instapay' ? 'إنستاباي (InstaPay)' : inv.paymentMethod === 'bank' ? 'تحويل بنكي' : 'نقدي / كاش';
      setPaymentRows([{ id: `pay_${Date.now()}`, method: pmLabel, amount: Number(inv.paidAmount || 0) }]);
    }

    setItemName('');
    setItemQty('');
    setItemPrice('');
    setDiscountType(inv.discountType || 'percent');
    setDiscount(inv.discountValue !== undefined ? inv.discountValue : (inv.discount || 0));
    setTaxType(inv.taxType || 'percent');
    setTax(inv.taxValue !== undefined ? inv.taxValue : (inv.tax !== undefined ? inv.tax : 0));
    setExtraRevenueName(inv.extraRevenueName || '');
    setExtraRevenueAmount(inv.extraRevenueAmount || 0);
    setFees(inv.fees || 0);
    setShowSupplierDropdown(false);
    setShowPhoneDropdown(false);
    setShowItemDropdown(false);
    setActiveModal('edit');
  };

  const handleOpenAddItemModal = () => {
    setEditingItemIndex(null);
    setEditingItemData(null);
    setIsItemCardModalOpen(true);
  };

  const handleOpenEditItemModal = (item: InvoiceItem, index: number) => {
    setEditingItemIndex(index);
    setEditingItemData(item);
    setIsItemCardModalOpen(true);
  };

  const handleSaveItemFromModal = (item: InvoiceItem) => {
    if (editingItemIndex !== null && editingItemIndex >= 0) {
      setTempItems((prev) => {
        const copy = [...prev];
        copy[editingItemIndex] = item;
        return copy;
      });
    } else {
      setTempItems((prev) => [...prev, item]);
    }
  };

  const handleAddItem = () => {
    const name = itemName.trim();
    const qty = parseFloat(itemQty) || 0;
    const price = parseFloat(itemPrice) || 0;

    if (!name || qty <= 0 || price <= 0) {
      showToast('يرجى إدخال اسم الصنف والعدد وسعر الشراء بشكل صحيح', 'warning');
      return;
    }

    setTempItems((prev) => [
      ...prev,
      {
        name,
        qty,
        price,
        total: qty * price,
        discountType: 'percent',
        discountValue: 0,
        taxType: 'percent',
        taxValue: 0,
      },
    ]);
    setItemName('');
    setItemQty('');
    setItemPrice('');
  };

  const handleRemoveItem = (index: number) => {
    setTempItems((prev) => prev.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    // 1. Calculate per-item totals and accumulate item-level discounts and taxes
    const activeItems = unifiedItems.length > 0 ? unifiedItems : tempItems;
    let itemsBaseSubtotal = 0;
    let totalItemDiscounts = 0;
    let totalItemTaxes = 0;

    activeItems.forEach((itm: any) => {
      const lineRaw = (Number(itm.qty) || 0) * (Number(itm.price) || 0);
      itemsBaseSubtotal += lineRaw;

      // Item discount
      let lineDisc = 0;
      if (itm.discType === 'val' || itm.discountType === 'fixed') {
        lineDisc = itm.discVal !== undefined ? Number(itm.discVal) : (itm.discountValue !== undefined ? Number(itm.discountValue) : Number(itm.discount || 0));
      } else {
        const discRate = itm.discVal !== undefined ? Number(itm.discVal) : (itm.discountValue !== undefined ? Number(itm.discountValue) : Number(itm.discount || 0));
        lineDisc = (lineRaw * discRate) / 100;
      }
      totalItemDiscounts += Math.max(0, lineDisc);

      // Item tax
      let lineTax = 0;
      const taxableBase = Math.max(0, lineRaw - lineDisc);
      if (itm.taxType === 'val' || itm.taxType === 'fixed') {
        lineTax = itm.taxVal !== undefined ? Number(itm.taxVal) : (itm.taxValue !== undefined ? Number(itm.taxValue) : Number(itm.tax || 0));
      } else {
        const taxRate = itm.taxVal !== undefined ? Number(itm.taxVal) : (itm.taxValue !== undefined ? Number(itm.taxValue) : Number(itm.tax || 0));
        lineTax = (taxableBase * taxRate) / 100;
      }
      totalItemTaxes += Math.max(0, lineTax);
    });

    // 2. Invoice-level additional discount & tax
    const activeDisc = globalInvDisc > 0 ? globalInvDisc : discount;
    const activeDiscType = globalInvDisc > 0 ? invDiscType : (discountType === 'fixed' ? 'val' : 'percent');
    const activeTax = globalInvTax > 0 ? globalInvTax : tax;
    const activeTaxType = globalInvTax > 0 ? invTaxType : (taxType === 'fixed' ? 'val' : 'percent');
    const activeExtraRev = extraIncomeVal > 0 ? extraIncomeVal : extraRevenueAmount;

    const afterItemDiscBase = Math.max(0, itemsBaseSubtotal - totalItemDiscounts);
    let invoiceLevelDiscount = 0;
    if (typeof activeDisc === 'number' && activeDisc > 0) {
      if (activeDiscType === 'percent') {
        invoiceLevelDiscount = (afterItemDiscBase * activeDisc) / 100;
      } else {
        invoiceLevelDiscount = activeDisc;
      }
    }

    const finalTaxableBase = Math.max(0, afterItemDiscBase - invoiceLevelDiscount);
    let invoiceLevelTax = 0;
    if (typeof activeTax === 'number' && activeTax > 0) {
      if (activeTaxType === 'percent') {
        invoiceLevelTax = (finalTaxableBase * activeTax) / 100;
      } else {
        invoiceLevelTax = activeTax;
      }
    }

    const totalDiscount = totalItemDiscounts + invoiceLevelDiscount;
    const totalTax = totalItemTaxes + invoiceLevelTax;
    const extraRev = typeof activeExtraRev === 'number' && activeExtraRev > 0 ? activeExtraRev : 0;
    const grandTotal = Math.max(0, itemsBaseSubtotal - totalDiscount + totalTax + extraRev);

    let effectivePaid = 0;
    let effectiveRemaining = 0;

    if (modalType === 'nagdi' || modalType === 'return_nagdi') {
      effectivePaid = grandTotal;
      effectiveRemaining = 0;
    } else {
      const sumPayments = paymentRows.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
      const rawPaid = sumPayments > 0 ? sumPayments : (parseFloat(paidAmountInput) || 0);
      effectivePaid = Math.max(0, Math.min(grandTotal, rawPaid));
      effectiveRemaining = Math.max(0, grandTotal - effectivePaid);
    }

    return {
      subtotal: itemsBaseSubtotal,
      totalItemDiscounts,
      totalItemTaxes,
      invoiceLevelDiscount,
      invoiceLevelTax,
      totalDiscount,
      totalTax,
      extraRevenueAmount: extraRev,
      total: grandTotal,
      effectivePaid,
      effectiveRemaining,
    };
  };

  const handleSaveInvoice = () => {
    const finalItemsToSave: InvoiceItem[] =
      unifiedItems.length > 0
        ? unifiedItems.map((ui, idx) => ({
            itemId: ui.itemId || `itm_${idx}_${Date.now()}`,
            code: ui.code,
            name: ui.name,
            qty: ui.qty,
            price: ui.price,
            costPrice: ui.costPrice || ui.price,
            discount: ui.actualDisc,
            discountType: ui.discType === 'val' ? 'fixed' : 'percent',
            discountValue: ui.discVal,
            tax: ui.actualTax,
            taxType: ui.taxType === 'val' ? 'fixed' : 'percent',
            taxValue: ui.taxVal,
            spec: ui.spec,
            notes: ui.spec,
            total: ui.total,
          }))
        : tempItems;

    if (finalItemsToSave.length === 0) {
      showToast('يرجى إضافة صنف واحد على الأقل', 'warning');
      return;
    }
    if (!supplierName.trim()) {
      showToast('يرجى إدخال اسم المورد', 'warning');
      return;
    }

    const { subtotal, total, totalDiscount, totalTax, effectivePaid, effectiveRemaining } = calculateTotals();
    const isReturn = modalType.startsWith('return_');

    // Primary payment method from paymentRows or state
    let chosenPaymentMethod = paymentMethod;
    if (paymentRows.length > 0 && paymentRows[0].method) {
      const m = paymentRows[0].method;
      if (m.includes('فودافون')) chosenPaymentMethod = 'vodafone';
      else if (m.includes('إنستاباي') || m.includes('انستاباي')) chosenPaymentMethod = 'instapay';
      else if (m.includes('بنك') || m.includes('تحويل')) chosenPaymentMethod = 'bank';
      else chosenPaymentMethod = 'drawer';
    }

    // 1. Mandatory Payment Method Validation for Cash operations
    if ((modalType === 'nagdi' || modalType === 'return_nagdi') && !chosenPaymentMethod) {
      showToast('يرجى اختيار وسيلة دفع إجبارية (الخزينة أو الحساب البنكي) للعملية النقدية', 'error');
      return;
    }
    if ((modalType === 'ajel' || modalType === 'return_ajel') && effectivePaid > 0 && !chosenPaymentMethod) {
      showToast('يرجى اختيار وسيلة سداد/استلام الدفعة النقدية', 'error');
      return;
    }

    const isEditing = editingInvoiceId !== null;
    const invId = isEditing ? editingInvoiceId : appData.nextPurchaseNumber;
    const oldInvForMeta = isEditing ? appData.purchaseInvoices.find((i) => i.id === editingInvoiceId) : null;
    const nowIso = new Date().toISOString();

    const paymentSplits = paymentRows
      .filter((p) => Number(p.amount) > 0)
      .map((p) => {
        let pm: 'drawer' | 'vodafone' | 'instapay' | 'bank' = 'drawer';
        if (p.method.includes('فودافون')) pm = 'vodafone';
        else if (p.method.includes('إنستاباي') || p.method.includes('انستاباي')) pm = 'instapay';
        else if (p.method.includes('بنك') || p.method.includes('تحويل')) pm = 'bank';
        return {
          method: pm,
          amount: Number(p.amount),
        };
      });

    const newInvoice: PurchaseInvoice = {
      id: invId,
      clientSyncId: isEditing ? ((oldInvForMeta as any)?.clientSyncId || `pur_${invId}_${Date.now()}`) : `pur_${invId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      companyId: appData.companyId || 'COMP-000001',
      branchId: selectedBranchId || appData.activeBranchId || 'main',
      supplierName: supplierName.trim(),
      phone: phone.trim(),
      supplierRepId: supplierRepId || undefined,
      supplierRepName: supplierRepName.trim() || undefined,
      supplierRepPhone: supplierRepPhone.trim() || undefined,
      salesRep: salesRep.trim() || undefined,
      notes: notes.trim() || undefined,
      date: date,
      time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      items: finalItemsToSave,
      subtotal,
      discount: totalDiscount || 0,
      discountType: invDiscType === 'val' ? 'fixed' : 'percent',
      discountValue: globalInvDisc || discount || 0,
      tax: totalTax || 0,
      taxType: invTaxType === 'val' ? 'fixed' : 'percent',
      taxValue: globalInvTax || tax || 0,
      extraRevenueName: (extraIncomeName || extraRevenueName).trim() || undefined,
      extraRevenueAmount: (extraIncomeVal || extraRevenueAmount) > 0 ? (extraIncomeVal || extraRevenueAmount) : undefined,
      fees: fees || 0,
      total,
      paymentMethod: chosenPaymentMethod,
      type: modalType,
      paidAmount: effectivePaid,
      remainingAmount: effectiveRemaining,
      status: 'approved',
      createdAt: isEditing ? (oldInvForMeta?.createdAt || nowIso) : nowIso,
      updatedAt: nowIso,
      createdBy: isEditing ? (oldInvForMeta?.createdBy || appData.users.find((u) => u.id === appData.currentUser)?.name || 'مدير النظام') : (appData.users.find((u) => u.id === appData.currentUser)?.name || 'مدير النظام'),
      createdByUserId: appData.users.find((u) => u.id === appData.currentUser)?.id,
      createdByUserCode: appData.users.find((u) => u.id === appData.currentUser)?.code || 1,
      paymentSplits: paymentSplits.length > 0 ? paymentSplits : undefined,
    };

    const updatedData = postPurchaseInvoice(appData, newInvoice, isEditing, editingInvoiceId || undefined);

    onUpdateData(updatedData, {
      action: isEditing
        ? `تعديل ${isReturn ? 'مرتجع' : 'فاتورة'} مشتريات #${newInvoice.id}`
        : `إنشاء ${isReturn ? 'مرتجع' : 'فاتورة'} مشتريات #${newInvoice.id}`,
      module: 'المشتريات',
      details: `${isReturn ? 'مرتجع' : 'فاتورة'} مشتريات للمورد: ${supplierName} بقيمة ${total.toFixed(2)} ج.م`,
    });
    setActiveModal(null);
    showToast(`تم حفظ ${isReturn ? 'مرتجع' : 'فاتورة'} مشتريات رقم #${newInvoice.id} بنجاح`, 'success');
  };

  const handleDeleteInvoice = (id: number) => {
    if (!confirm('هل أنت متأكد من حذف فاتورة المشتريات هذه؟ سيتم خصم الكميات المشتراة من رصيد المخزن وتسوية حساب المورد والخزينة تلقائياً.')) return;
    const invToDelete = appData.purchaseInvoices.find((i) => i.id === id);
    if (!invToDelete) return;

    const updatedData = deletePurchaseInvoice(appData, id);
    if (!updatedData.deletedRecords) updatedData.deletedRecords = {};
    updatedData.deletedRecords[`purchaseInvoices_${id}`] = Date.now();

    onUpdateData(updatedData, {
      action: 'delete_purchase',
      module: 'المشتريات',
      details: `تم حذف ${invToDelete.type.startsWith('return_') ? 'مرتجع' : 'فاتورة'} الشراء رقم #${id} وتسوية رصيد المخزون وحساب المورد والخزينة`,
      deletedId: id,
    });
    showToast(`تم حذف فاتورة المشتريات رقم #${id} وتسوية المخزون وحساب المورد والخزينة بنجاح`, 'success');
  };

  const handleOpenPayModal = (inv: PurchaseInvoice) => {
    setSelectedInvoice(inv);
    const rem = inv.total - (inv.paidAmount || 0);
    setPayAmount(rem > 0 ? rem : 0);
    setPayMethod('drawer');
    setActiveModal('pay');
  };

  const handleConfirmPayment = () => {
    if (!selectedInvoice) return;
    if (payAmount <= 0) {
      showToast('يرجى إدخال مبلغ سداد صحيح', 'warning');
      return;
    }
    const rem = selectedInvoice.total - (selectedInvoice.paidAmount || 0);
    if (payAmount > rem) {
      showToast('المبلغ المدخل يتجاوز القيمة المتبقية للفاتورة', 'error');
      return;
    }

    const updatedData = { ...appData };
    const inv = updatedData.purchaseInvoices.find((i) => i.id === selectedInvoice.id);
    if (inv) {
      inv.paidAmount = (inv.paidAmount || 0) + payAmount;
      inv.remainingAmount = inv.total - inv.paidAmount;

      // Deduct from Treasury
      updatedData.cashBox[payMethod] = (updatedData.cashBox[payMethod] || 0) - payAmount;

      // Deduct from Supplier Balance
      const supp = updatedData.suppliers.find((s) => s.name === inv.supplierName);
      if (supp) supp.balance = (supp.balance || 0) - payAmount;

      const nowIso = new Date().toISOString();
      const currentUserObj = updatedData.users?.find((u) => u.id === updatedData.currentUser) || updatedData.users?.[0];
      const newCashId = updatedData.nextCashId || 1;
      updatedData.nextCashId = newCashId + 1;

      updatedData.cashTransactions.push({
        id: newCashId,
        companyId: appData.companyId || 'COMP-000001',
        branchId: inv.branchId || appData.activeBranchId || 'main',
        date: new Date().toISOString().split('T')[0],
        type: 'pay',
        method: payMethod,
        amount: payAmount,
        note: `سداد دفعة فاتورة مشتريات #${inv.id} (${getMethodLabel(payMethod)}) - المورد: ${inv.supplierName}`,
        supplierName: inv.supplierName,
        invoiceId: inv.id,
        status: 'approved',
        createdAt: nowIso,
        updatedAt: nowIso,
        createdBy: currentUserObj?.name || 'مستخدم النظام',
        createdByUserId: currentUserObj?.id,
        createdByUserCode: currentUserObj?.code || 1,
      });

      onUpdateData(updatedData, {
        action: 'purchase_payment',
        module: 'المشتريات والخزينة',
        details: `سداد مبلغ ${payAmount} ج.م للمورد ${inv.supplierName} عبر ${getMethodLabel(payMethod)}`,
      });
      setActiveModal(null);
      showToast(`تم سداد ${payAmount} ج.م للمورد ${inv.supplierName} بنجاح`, 'success');
    }
  };

  const handlePrintInvoice = (inv: PurchaseInvoice) => {
    printInvoiceWindow(inv, false, appData.settings, showToast);
  };

  // Print Purchases List
  const handlePrintPurchasesList = () => {
    const list = appData.purchaseInvoices || [];
    const totalAmount = list.reduce((sum, i) => sum + (i.total || 0), 0);
    const totalPaid = list.reduce((sum, i) => sum + (i.paidAmount || 0), 0);
    const totalRemaining = totalAmount - totalPaid;

    openUnifiedPrintWindow(
      {
        reportTitle: 'سجل فواتير المشتريات والتوريدات',
        subTitle: 'كشف المشتريات المعتمد',
        serial: 'PURCH-REP',
        branch: 'إدارة المشتريات والمخازن',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        kpis: [
          { title: 'عدد الفواتير', value: `${list.length} فاتورة` },
          { title: 'إجمالي المشتريات', value: `${totalAmount.toFixed(2)} ج.م` },
          { title: 'إجمالي المسدد', value: `${totalPaid.toFixed(2)} ج.م` },
          { title: 'المتبقي ذمم موردين', value: `${totalRemaining.toFixed(2)} ج.م` },
        ],
        columns: ['#', 'التاريخ', 'المورد', 'النوع', 'الإجمالي', 'المسدد', 'المتبقي'],
        rows: list.map((inv) => [
          `#${inv.id}`,
          inv.date,
          inv.supplierName,
          inv.type === 'return_nagdi' || inv.type === 'return_ajel'
            ? 'مرتجع'
            : inv.type === 'nagdi'
            ? 'نقدي'
            : 'آجل',
          `${inv.total.toFixed(2)} ج.م`,
          `${(inv.paidAmount || 0).toFixed(2)} ج.م`,
          `${(inv.total - (inv.paidAmount || 0)).toFixed(2)} ج.م`,
        ]),
        summary: [
          { label: 'إجمالي قيمة المشتريات', value: `${totalAmount.toFixed(2)} ج.م`, isTotal: true },
          { label: 'إجمالي المبالغ المسددة', value: `${totalPaid.toFixed(2)} ج.م` },
          { label: 'إجمالي المتبقي للموردين', value: `${totalRemaining.toFixed(2)} ج.م` },
        ],
        footerNote: 'تم استخراج سجل المشتريات من النظام المحاسبي المعتمد',
      },
      appData.settings,
      showToast
    );
  };

  // Export Purchases to Excel
  const handleExportPurchasesExcel = () => {
    const list = appData.purchaseInvoices || [];
    exportToExcel({
      filename: `سجل_فواتير_المشتريات_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'المشتريات',
      data: list,
      columns: [
        { header: 'رقم الفاتورة', key: 'id', width: 14 },
        { header: 'التاريخ', key: 'date', width: 14 },
        { header: 'اسم المورد', key: 'supplierName', width: 26 },
        {
          header: 'نوع الفاتورة',
          getValue: (item: PurchaseInvoice) =>
            item.type === 'return_nagdi' || item.type === 'return_ajel'
              ? 'مرتجع مشتريات'
              : item.type === 'nagdi'
              ? 'نقدي'
              : 'آجل',
          width: 16,
        },
        {
          header: 'الإجمالي (ج.م)',
          getValue: (item: PurchaseInvoice) => item.total.toFixed(2),
          width: 16,
        },
        {
          header: 'المسدد (ج.م)',
          getValue: (item: PurchaseInvoice) => (item.paidAmount || 0).toFixed(2),
          width: 16,
        },
        {
          header: 'المتبقي (ج.م)',
          getValue: (item: PurchaseInvoice) => (item.total - (item.paidAmount || 0)).toFixed(2),
          width: 16,
        },
        { header: 'ملاحظات', key: 'notes', width: 24 },
      ],
      companyName: appData.settings?.companyName || 'المنظومة المحاسبية المعتمدة',
      reportTitle: 'سجل فواتير المشتريات والتوريدات',
    });
    showToast('تم تصدير فواتير المشتريات إلى Excel بنجاح', 'success');
  };

  const getTitleForModal = () => {
    switch (modalType) {
      case 'nagdi':
        return '🔹 فاتورة شراء نقدي جديدة (سداد فوري للمورد بالكامل)';
      case 'ajel':
        return '🔹 فاتورة شراء آجل جديدة (ذمم موردين / دفعة مقدمة)';
      case 'return_nagdi':
        return '↩ مرتجع شراء نقدي (استرداد فوري من المورد)';
      case 'return_ajel':
        return '↩ مرتجع شراء آجل (خصم من مستحقات المورد)';
    }
  };

  const totalPurchasesAmount = (appData.purchaseInvoices || []).reduce((acc, i) => acc + (i.total || 0), 0);
  const totalPurchasesPaid = (appData.purchaseInvoices || []).reduce((acc, i) => acc + (i.paidAmount || 0), 0);
  const totalPurchasesRemaining = totalPurchasesAmount - totalPurchasesPaid;

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col space-y-4">
      {/* 🏛️ ترويسة قسم إدارة المشتريات والتوريد - خلفية بيضاء وكتابة سوداء متناسقة مع الواجهة الرئيسية */}
      <div className="bg-white text-slate-900 p-3 sm:p-4 rounded-xl shadow-xs border-2 border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center shrink-0 shadow-2xs">
            <Building2 className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black tracking-wide flex items-center gap-2">
              <span className="text-slate-900 font-black">إدارة فواتير المشتريات والتوريدات</span>
              <span className="text-[10px] bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded-full font-bold">
                🛒 قسم المشتريات
              </span>
            </h2>
            <p className="text-[11px] text-slate-600 font-medium">
              تسجيل وتدقيق فواتير الشراء النقدي والآجل والتوريدات ومستحقات الموردين بدقة متناهية
            </p>
          </div>
        </div>

        {/* Quick KPI badges */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="bg-slate-50 border border-slate-200 px-3 py-1 rounded-lg flex flex-col items-center shadow-2xs">
            <span className="text-[9px] text-slate-500 font-bold">عدد الفواتير</span>
            <span className="text-xs font-black font-mono text-slate-900">{appData.purchaseInvoices?.length || 0}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 px-3 py-1 rounded-lg flex flex-col items-center shadow-2xs">
            <span className="text-[9px] text-slate-500 font-bold">إجمالي المشتريات</span>
            <span className="text-xs font-black font-mono text-emerald-600">{totalPurchasesAmount.toLocaleString()} ج.م</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 px-3 py-1 rounded-lg flex flex-col items-center shadow-2xs">
            <span className="text-[9px] text-slate-500 font-bold">المسدد للموردين</span>
            <span className="text-xs font-black font-mono text-teal-600">{totalPurchasesPaid.toLocaleString()} ج.م</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 px-3 py-1 rounded-lg flex flex-col items-center shadow-2xs">
            <span className="text-[9px] text-slate-500 font-bold">مستحقات آجلة</span>
            <span className="text-xs font-black font-mono text-amber-600">{totalPurchasesRemaining.toLocaleString()} ج.م</span>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="bg-teal-50/40 p-3 sm:p-4 rounded-xl shadow-xs border border-teal-200/80 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
          {/* 1. شراء نقدي */}
          <button
            onClick={() => openCreateModal('nagdi', 'buy')}
            className="min-h-[40px] bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white px-3 sm:px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs border border-teal-800 hover:scale-[1.02]"
            title="فاتورة شراء نقدي بسداد فوري للمورد من الخزينة"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>🛒 شراء نقدي</span>
          </button>

          {/* 2. شراء جملة / توريد */}
          <button
            onClick={() => openCreateModal('nagdi', 'wholesale')}
            className="min-h-[40px] bg-cyan-800 hover:bg-cyan-900 active:bg-cyan-950 text-white px-3 sm:px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs border border-cyan-900 hover:scale-[1.02]"
            title="فاتورة توريد وشراء كميات جملة"
          >
            <Building2 className="w-4 h-4 shrink-0" />
            <span>📦 شراء جملة / توريد</span>
          </button>

          {/* 3. شراء أجل */}
          <button
            onClick={() => openCreateModal('ajel', 'buy')}
            className="min-h-[40px] bg-amber-700 hover:bg-amber-800 active:bg-amber-900 text-white px-3 sm:px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs border border-amber-800 hover:scale-[1.02]"
            title="فاتورة شراء آجل على حساب ومستحقات المورد"
          >
            <DollarSign className="w-4 h-4 shrink-0" />
            <span>⏳ شراء أجل</span>
          </button>

          {/* 4. مرتجع شراء نقدي */}
          <button
            onClick={() => openCreateModal('return_nagdi', 'buy')}
            className="min-h-[40px] bg-rose-700 hover:bg-rose-800 active:bg-rose-900 text-white px-3 sm:px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs border border-rose-800 hover:scale-[1.02]"
            title="مرتجع بضاعة واسترداد نقدي من المورد إلى الخزينة"
          >
            <RotateCcw className="w-4 h-4 shrink-0" />
            <span>↩ مرتجع نقدي</span>
          </button>

          {/* 5. مرتجع شراء جملة */}
          <button
            onClick={() => openCreateModal('return_nagdi', 'wholesale')}
            className="min-h-[40px] bg-red-900 hover:bg-red-950 text-white px-3 sm:px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs border border-red-950 hover:scale-[1.02]"
            title="مرتجع شراء جملة بسعر جملة الشراء"
          >
            <RotateCcw className="w-4 h-4 shrink-0" />
            <span>↩ مرتجع شراء جملة</span>
          </button>

          {/* 6. مرتجع أجل */}
          <button
            onClick={() => openCreateModal('return_ajel', 'buy')}
            className="min-h-[40px] bg-slate-700 hover:bg-slate-800 active:bg-slate-900 text-white px-3 sm:px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs border border-slate-800 hover:scale-[1.02]"
            title="مرتجع بضاعة وخصم من مستحقات المورد"
          >
            <RotateCcw className="w-4 h-4 shrink-0" />
            <span>↩ مرتجع أجل</span>
          </button>

          <TableActionButtons
            onPrint={handlePrintPurchasesList}
            onExportExcel={handleExportPurchasesExcel}
            printTitle="طباعة سجل فواتير المشتريات"
            exportTitle="تصدير المشتريات إلى Excel"
          />
        </div>
        <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2 min-w-[220px]">
          {appData.branches && appData.branches.length > 1 && (
            <select
              value={selectedBranchFilter}
              onChange={(e) => setSelectedBranchFilter(e.target.value)}
              className="min-h-[40px] px-3 py-2 border border-teal-300 bg-white text-teal-950 font-semibold rounded-lg text-xs focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600 focus:outline-none cursor-pointer"
            >
              <option value="all">جميع الفروع ({appData.purchaseInvoices?.length || 0})</option>
              {appData.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({appData.purchaseInvoices?.filter((i) => i.branchId === b.id).length || 0})
                </option>
              ))}
            </select>
          )}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-teal-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="بحث برقم الفاتورة أو اسم المورد..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full min-h-[40px] pr-9 pl-3 py-2 border border-teal-300 bg-white rounded-lg text-xs focus:ring-2 focus:ring-teal-600/40 focus:border-teal-600 focus:outline-none placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      {/* Mobile Card List View (< md) */}
      <div className="block md:hidden space-y-3">
        {filteredInvoices.length === 0 ? (
          <div className="bg-white rounded-xl p-6 text-center text-black font-bold text-sm border-2 border-slate-300">
            لا توجد فواتير مشتريات مسجلة
          </div>
        ) : (
          filteredInvoices.map((inv) => (
            <div
              key={inv.id}
              className="bg-white rounded-xl p-4 shadow-xs border-2 border-teal-200/90 space-y-3 hover:border-teal-400 transition"
            >
              {/* Top Row: Invoice ID, Date & Type Badge */}
              <div className="flex items-center justify-between border-b border-teal-100 pb-2">
                <div
                  onClick={() => {
                    setSelectedInvoice(inv);
                    setActiveModal('view');
                  }}
                  className="flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="text-teal-900 font-black font-mono text-sm">#{inv.id}</span>
                  <span className="text-slate-600 font-bold text-xs font-mono">| {inv.date}</span>
                  <span className="text-[10px] bg-teal-100 text-teal-900 border border-teal-300 px-1.5 py-0.2 rounded font-bold">
                    مشتريات
                  </span>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded text-xs font-black border ${
                    inv.type === 'nagdi'
                      ? 'bg-emerald-50 text-emerald-950 border-emerald-300'
                      : inv.type === 'ajel'
                      ? 'bg-amber-50 text-amber-950 border-amber-300'
                      : 'bg-rose-50 text-rose-950 border-rose-300'
                  }`}
                >
                  {inv.type === 'nagdi'
                    ? 'نقدي'
                    : inv.type === 'ajel'
                    ? 'آجل'
                    : inv.type === 'return_nagdi'
                    ? 'مرتجع نقدي'
                    : 'مرتجع أجل'}
                </span>
              </div>

              {/* Middle Info: Supplier & Financials */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-black text-black text-sm">{inv.supplierName}</div>
                  {inv.salesRep && (
                    <div className="text-xs text-blue-950 font-bold flex items-center gap-1 mt-0.5">
                      <UserIcon className="w-3.5 h-3.5 text-blue-700" />
                      <span>مسؤول: {inv.salesRep}</span>
                    </div>
                  )}
                  {inv.notes && (
                    <div className="text-xs text-black font-medium mt-0.5 line-clamp-1 flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                      <span>{inv.notes}</span>
                    </div>
                  )}
                  {inv.type === 'ajel' && inv.remainingAmount !== undefined && (
                    <div className="text-xs mt-1 font-mono">
                      {inv.remainingAmount > 0 ? (
                        <span className="text-amber-950 font-black bg-amber-50 px-2 py-0.5 rounded border border-amber-300">
                          متبقي للمورد: {inv.remainingAmount.toFixed(2)} ج.م
                        </span>
                      ) : (
                        <span className="text-emerald-950 font-black bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                          <span>مسددة بالكامل</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="text-left shrink-0">
                  <div className="text-xs text-slate-800 font-bold">القيمة الإجمالية</div>
                  <div className="font-black text-black text-base font-mono tabular-nums">
                    {(inv.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
                  </div>
                </div>
              </div>

              {/* Action Buttons with 40px min-height */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                {inv.type === 'ajel' && (inv.remainingAmount ?? (inv.total - (inv.paidAmount || 0))) > 0 && (
                  <button
                    onClick={() => handleOpenPayModal(inv)}
                    className="min-h-[40px] bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-lg text-xs transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                    title="تسديد دفعة للمورد"
                  >
                    <DollarSign className="w-4 h-4" />
                    <span>سداد</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setSelectedInvoice(inv);
                    setActiveModal('view');
                  }}
                  className="min-h-[40px] bg-slate-100 hover:bg-slate-200 text-black border border-slate-300 font-bold rounded-lg text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-blue-700" />
                  <span>عرض</span>
                </button>
                <button
                  onClick={() => openEditModal(inv)}
                  className="min-h-[40px] bg-blue-100 hover:bg-blue-200 text-blue-950 border border-blue-400 font-bold rounded-lg text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5 text-blue-700" />
                  <span>تعديل</span>
                </button>
                <button
                  onClick={() => handlePrintInvoice(inv)}
                  className="min-h-[40px] bg-slate-100 hover:bg-slate-200 text-black border border-slate-300 font-bold rounded-lg text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-700" />
                  <span>طباعة</span>
                </button>
                <button
                  onClick={() => handleDeleteInvoice(inv.id)}
                  className="min-h-[40px] bg-rose-100 hover:bg-rose-200 text-rose-950 border border-rose-400 font-bold rounded-lg text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-700" />
                  <span>حذف</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Invoices Desktop Table (>= md) */}
      <div className="hidden md:block bg-white rounded-xl shadow-xs border-2 border-slate-300 overflow-x-auto">
        <table className="w-full text-right text-xs md:text-sm border-collapse border border-slate-300">
          <thead>
            <tr className="bg-slate-100 text-slate-900 font-bold border-b-2 border-slate-300">
              <th className="p-3 font-black border border-slate-300 text-slate-900">رقم الفاتورة</th>
              <th className="p-3 font-black border border-slate-300 text-slate-900">المورد</th>
              {appData.branches && appData.branches.length > 1 && <th className="p-3 font-black border border-slate-300 text-slate-900">الفرع</th>}
              <th className="p-3 font-black border border-slate-300 text-slate-900">التاريخ</th>
              <th className="p-3 font-black border border-slate-300 text-slate-900">القيمة (ج.م)</th>
              <th className="p-3 font-black border border-slate-300 text-slate-900">المسدد / المتبقي</th>
              <th className="p-3 font-black border border-slate-300 text-slate-900">النوع</th>
              <th className="p-3 font-black border border-slate-300 text-slate-900">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300 bg-white">
            {filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-black font-bold">
                  لا توجد فواتير مشتريات مسجلة
                </td>
              </tr>
            ) : (
              filteredInvoices.map((inv) => {
                const rem = inv.remainingAmount ?? (inv.type === 'ajel' ? inv.total - (inv.paidAmount || 0) : 0);
                const paid = inv.paidAmount ?? (inv.type === 'nagdi' ? inv.total : 0);
                return (
                  <tr key={inv.id} className="bg-white hover:bg-slate-100 transition border-b border-slate-300">
                    <td
                      onClick={() => {
                        setSelectedInvoice(inv);
                        setActiveModal('view');
                      }}
                      className="p-3 text-blue-900 font-black font-mono cursor-pointer hover:underline border border-slate-300"
                    >
                      #{inv.id}
                    </td>
                    <td className="p-3 border border-slate-300">
                      <div className="font-black text-black">{inv.supplierName}</div>
                      {inv.salesRep && (
                        <div className="text-xs text-blue-950 font-bold flex items-center gap-1 mt-0.5">
                          <UserIcon className="w-3.5 h-3.5 text-blue-700" />
                          <span>مسؤول: {inv.salesRep}</span>
                        </div>
                      )}
                      {inv.notes && (
                        <div className="text-xs text-black font-medium truncate max-w-[160px] flex items-center gap-1 mt-0.5" title={inv.notes}>
                          <FileText className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                          <span>{inv.notes}</span>
                        </div>
                      )}
                    </td>
                    {appData.branches && appData.branches.length > 1 && (
                      <td className="p-3 border border-slate-300">
                        <span className="text-xs font-black px-2 py-0.5 rounded bg-blue-100 text-blue-950 border border-blue-300">
                          {appData.branches.find((b) => b.id === inv.branchId)?.name || 'الفرع الرئيسي'}
                        </span>
                      </td>
                    )}
                    <td className="p-3 font-mono font-bold text-black border border-slate-300">{inv.date}</td>
                    <td className="p-3 font-black font-mono text-black tabular-nums border border-slate-300 text-sm">
                      {(inv.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 border border-slate-300">
                      {inv.type === 'ajel' ? (
                        <div className="text-xs space-y-0.5 font-mono">
                          <div className="text-emerald-950 font-black tabular-nums">مسدد: {paid.toFixed(2)}</div>
                          {rem > 0 ? (
                            <div className="text-rose-950 font-black tabular-nums">متبقي: {rem.toFixed(2)}</div>
                          ) : (
                            <div className="text-emerald-950 font-black text-xs inline-flex items-center gap-1 font-sans">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>مسددة بالكامل</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500 text-xs">سداد فوري</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${
                          inv.type === 'nagdi'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : inv.type === 'ajel'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {inv.type === 'nagdi'
                          ? 'نقدي'
                          : inv.type === 'ajel'
                          ? 'آجل'
                          : inv.type === 'return_nagdi'
                          ? 'مرتجع نقدي'
                          : 'مرتجع أجل'}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        {inv.type === 'ajel' && rem > 0 && (
                          <button
                            onClick={() => handleOpenPayModal(inv)}
                            className="w-8 h-8 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 flex items-center justify-center transition cursor-pointer"
                            title="تسديد دفعة للمورد"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedInvoice(inv);
                            setActiveModal('view');
                          }}
                          className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 flex items-center justify-center transition cursor-pointer border border-blue-200"
                          title="عرض الفاتورة"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEditModal(inv)}
                          className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 flex items-center justify-center transition cursor-pointer border border-blue-200"
                          title="تعديل الفاتورة"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handlePrintInvoice(inv)}
                          className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center justify-center transition cursor-pointer border border-slate-200"
                          title="طباعة"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteInvoice(inv.id)}
                          className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 flex items-center justify-center transition cursor-pointer border border-rose-200"
                          title="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 🏛️ واجهة تسجيل فواتير المشتريات والتوريدات المعتمدة - ركيزة (مطابقة كلياً للتصميم الأصلي بالصورة) */}
      {(activeModal === 'create' || activeModal === 'edit') && (
        <RakeezaInvoiceWorkspace
          isOpen={true}
          onClose={() => {
            setActiveModal(null);
            setEditingInvoiceId(null);
          }}
          mode="purchase"
          invoiceType={modalType}
          pricingType={purchasesPricingType}
          editingInvoice={editingInvoiceId !== null ? appData.purchaseInvoices.find((i) => i.id === editingInvoiceId) || null : null}
          appData={appData}
          onUpdateData={onUpdateData}
          showToast={showToast}
        />
      )}

      {/* 📇 كارت الصنف Modal (اسم الصنف، البيان/الملاحظة، العدد، السعر، الخصم والضريبة بالنسبة أو الثابت) */}
      <InvoiceItemModal
        isOpen={isItemCardModalOpen}
        onClose={() => setIsItemCardModalOpen(false)}
        onSave={handleSaveItemFromModal}
        catalogItems={appData.items}
        mode="purchase"
        initialItem={editingItemData}
      />

      {/* Modal for Supplier Payment (Pay Modal) */}
      <Modal
        isOpen={activeModal === 'pay'}
        title={`💰 تسديد دفعة لمورد - فاتورة مشتريات #${selectedInvoice?.id}`}
        onClose={() => setActiveModal(null)}
      >
        {selectedInvoice && (
          <div className="space-y-4 text-xs md:text-sm">
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl space-y-1 text-slate-800">
              <div className="flex justify-between">
                <span>المورد:</span>
                <span className="font-bold">{selectedInvoice.supplierName}</span>
              </div>
              <div className="flex justify-between">
                <span>إجمالي الفاتورة:</span>
                <span className="font-mono font-bold">{selectedInvoice.total.toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between">
                <span>المسدد سابقاً:</span>
                <span className="font-mono text-emerald-700 font-bold">
                  {(selectedInvoice.paidAmount || 0).toFixed(2)} ج.م
                </span>
              </div>
              <div className="flex justify-between border-t border-amber-200 pt-1 text-rose-700 font-bold">
                <span>المبلغ المتبقي للمورد:</span>
                <span className="font-mono">
                  {(selectedInvoice.total - (selectedInvoice.paidAmount || 0)).toFixed(2)} ج.م
                </span>
              </div>
            </div>

            <div>
              <label className="block font-bold mb-1 text-gray-700">المبلغ المراد سداده للمورد (ج.م)</label>
              <input
                type="number"
                min="0.01"
                max={selectedInvoice.total - (selectedInvoice.paidAmount || 0)}
                step="any"
                value={payAmount}
                onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                className="w-full p-2.5 border-2 border-emerald-400 rounded-xl focus:border-[#1a237e] focus:outline-none font-mono font-bold text-base"
              />
            </div>

            <div>
              <label className="block font-bold mb-1 text-gray-700">وسيلة السداد والصرف</label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as any)}
                className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none font-semibold"
              >
                <option value="drawer">💵 نقدي (الدرج / الخزينة الرئيسية)</option>
                <option value="vodafone">📱 فودافون كاش (محفظة إلكترونية)</option>
                <option value="instapay">⚡ إنستاباي (InstaPay)</option>
                <option value="bank">💳 حساب بنكي</option>
              </select>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                onClick={handleConfirmPayment}
                className="min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold transition shadow-xs flex-1 sm:flex-initial text-center cursor-pointer"
              >
                ✓ تأكيد سداد {payAmount.toFixed(2)} ج.م
              </button>
              <button
                onClick={() => setActiveModal(null)}
                className="min-h-[44px] bg-gray-400 hover:bg-gray-500 text-white px-6 py-2.5 rounded-xl font-bold transition flex-1 sm:flex-initial text-center cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal for Purchase Invoice View - Using the standard template */}
      <Modal
        isOpen={activeModal === 'view'}
        title={`📋 تفاصيل فاتورة الشراء #${selectedInvoice?.id}`}
        onClose={() => setActiveModal(null)}
        maxWidth="max-w-5xl xl:max-w-6xl w-full"
      >
        {selectedInvoice && (
          <InvoiceCardTemplate
            invoice={selectedInvoice}
            isSales={false}
            settings={appData.settings}
            onPrint={() => handlePrintInvoice(selectedInvoice)}
            onClose={() => setActiveModal(null)}
            onEdit={() => {
              setActiveModal(null);
              openEditModal(selectedInvoice);
            }}
            onDelete={() => {
              setActiveModal(null);
              handleDeleteInvoice(selectedInvoice.id);
            }}
          />
        )}
      </Modal>
    </div>
  );
};
