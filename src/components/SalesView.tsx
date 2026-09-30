import React, { useState } from 'react';
import {
  Plus,
  RotateCcw,
  Search,
  Eye,
  Pencil,
  Trash2,
  Printer,
  MessageSquare,
  DollarSign,
  Building2,
  User as UserIcon,
  FileText,
  CheckCircle2,
  AlertCircle,
  Tag,
  Calendar,
  Save,
  X,
} from 'lucide-react';
import { AppData, SaleInvoice, InvoiceItem } from '../types';
import { Modal } from './Modal';
import { printInvoiceWindow } from '../utils/printInvoice';
import { InvoiceCardTemplate } from './InvoiceCardTemplate';
import { getProductActivePrice } from '../utils/priceService';
import { InvoiceItemModal } from './InvoiceItemModal';
import { UnifiedInvoiceItemSystem, InvoiceItemUnified, PaymentRow } from './UnifiedInvoiceItemSystem';
import { exportToExcel } from '../utils/excelExport';
import { openUnifiedPrintWindow } from '../utils/printUnified';
import { TableActionButtons } from './TableActionButtons';
import { generateInvoiceWhatsAppMessage, openWhatsAppChat } from '../services/whatsappService';

interface SalesViewProps {
  appData: AppData;
  onUpdateData: (newData: AppData, actionInfo?: { action?: string; module?: string; details?: string; deletedId?: string | number }) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onInspectItem?: (type: string, data: any) => void;
}

export const SalesView: React.FC<SalesViewProps> = ({ appData, onUpdateData, showToast, onInspectItem }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('all');
  const [selectedBranchId, setSelectedBranchId] = useState<string>(appData.activeBranchId || appData.branches?.[0]?.id || 'main');
  const [activeModal, setActiveModal] = useState<'create' | 'edit' | 'view' | 'pay' | null>(null);
  const [modalType, setModalType] = useState<'nagdi' | 'ajel' | 'return_nagdi' | 'return_ajel'>('nagdi');
  const [selectedInvoice, setSelectedInvoice] = useState<SaleInvoice | null>(null);
  const [editingInvoiceId, setEditingInvoiceId] = useState<number | null>(null);

  // 🏷️ Centralized Price Management Master Source Control: 'cash' vs 'wholesale'
  const [salesPricingType, setSalesPricingType] = useState<'cash' | 'wholesale'>('cash');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [isPriceAutoFetched, setIsPriceAutoFetched] = useState<boolean>(false);
  const [priceWarning, setPriceWarning] = useState<string | null>(null);

  // Current logged in user for permission checks
  const currentUser = appData.users.find((u) => u.id === appData.currentUser) || appData.users[0];
  const canOverridePrice = currentUser?.role === 'admin' || !!(currentUser as any)?.permissions?.allowInvoicePriceOverride;

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [customerRepId, setCustomerRepId] = useState('');
  const [customerRepName, setCustomerRepName] = useState('');
  const [customerRepPhone, setCustomerRepPhone] = useState('');
  const [salesRep, setSalesRep] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  // Payment & Downpayment State
  const [paidAmountInput, setPaidAmountInput] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'drawer' | 'vodafone' | 'instapay' | 'bank'>('drawer');
  const [tempItems, setTempItems] = useState<InvoiceItem[]>([]);

  // 🚀 Unified Invoice Registration System State (الأصناف والخصومات والضرائب ووسائل الدفع)
  const [unifiedItems, setUnifiedItems] = useState<InvoiceItemUnified[]>([]);
  const [globalInvDisc, setGlobalInvDisc] = useState<number>(0);
  const [invDiscType, setInvDiscType] = useState<'val' | 'percent'>('percent');
  const [globalInvTax, setGlobalInvTax] = useState<number>(0);
  const [invTaxType, setInvTaxType] = useState<'percent' | 'val'>('percent');
  const [extraIncomeName, setExtraIncomeName] = useState<string>('');
  const [extraIncomeVal, setExtraIncomeVal] = useState<number>(0);
  const [paymentRows, setPaymentRows] = useState<PaymentRow[]>([
    { id: 'pay_1', method: 'نقدي / كاش', amount: 0 },
  ]);

  // Item Draft Input
  const [itemName, setItemName] = useState('');
  const [itemNote, setItemNote] = useState('');
  const [itemQty, setItemQty] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemDiscount, setItemDiscount] = useState('');
  const [itemTax, setItemTax] = useState('');
  const [showItemCard, setShowItemCard] = useState(true);

  // 📦 Item Card Modal State (كارت الصنف)
  const [isItemCardModalOpen, setIsItemCardModalOpen] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [editingItemData, setEditingItemData] = useState<InvoiceItem | null>(null);

  // Discount/Tax/Fees & Extra Revenue (Default 0, optional percent vs fixed)
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discount, setDiscount] = useState<number>(0);
  const [taxType, setTaxType] = useState<'percent' | 'fixed'>('percent');
  const [tax, setTax] = useState<number>(0);
  const [extraRevenueName, setExtraRevenueName] = useState<string>(''); // خانة اسم الإيراد
  const [extraRevenueAmount, setExtraRevenueAmount] = useState<number>(0); // خانة مبلغ الإيراد
  const [feeDesc, setFeeDesc] = useState<string>('');
  const [fees, setFees] = useState<number>(0);

  // Payment Modal State
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<'drawer' | 'vodafone' | 'instapay' | 'bank'>('drawer');

  // Autocomplete Dropdowns State
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showPhoneDropdown, setShowPhoneDropdown] = useState(false);
  const [showItemDropdown, setShowItemDropdown] = useState(false);

  const filteredCustomersForName = appData.customers.filter((c) => {
    const q = customerName.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || (c.phone && c.phone.toLowerCase().includes(q));
  });

  const filteredCustomersForPhone = appData.customers.filter((c) => {
    const q = phone.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || (c.phone && c.phone.toLowerCase().includes(q));
  });

  const filteredItemsForSearch = appData.items.filter((i) => {
    const q = itemName.trim().toLowerCase();
    if (!q) return true;
    return i.name.toLowerCase().includes(q) || (i.id && i.id.toString().includes(q));
  });

  const filteredInvoices = appData.salesInvoices.filter((inv) => {
    if (selectedBranchFilter !== 'all' && inv.branchId && inv.branchId !== selectedBranchFilter) {
      return false;
    }
    const s = searchTerm.toLowerCase();
    return (
      inv.id.toString().includes(s) ||
      inv.customerName?.toLowerCase().includes(s) ||
      inv.phone?.toLowerCase().includes(s) ||
      inv.salesRep?.toLowerCase().includes(s) ||
      inv.notes?.toLowerCase().includes(s)
    );
  });

  const openCreateModal = (type: 'nagdi' | 'ajel' | 'return_nagdi' | 'return_ajel') => {
    setEditingInvoiceId(null);
    setSelectedBranchId(appData.activeBranchId || appData.branches?.[0]?.id || 'main');
    setModalType(type);
    setSalesPricingType('cash');
    setSelectedItemId('');
    setIsPriceAutoFetched(false);
    setPriceWarning(null);
    setCustomerName('');
    setPhone('');
    setCustomerRepId('');
    setCustomerRepName('');
    setCustomerRepPhone('');
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
    setItemNote('');
    setItemQty('');
    setItemPrice('');
    setItemDiscount('');
    setItemTax('');
    setDiscountType('percent');
    setDiscount(0);
    setTaxType('percent');
    setTax(0);
    setExtraRevenueName('');
    setExtraRevenueAmount(0);
    setFeeDesc('');
    setFees(0);
    setShowCustomerDropdown(false);
    setShowPhoneDropdown(false);
    setShowItemDropdown(false);
    setShowItemCard(true);
    setActiveModal('create');
  };

  const openEditModal = (inv: SaleInvoice) => {
    setEditingInvoiceId(inv.id);
    setSelectedBranchId(inv.branchId || appData.activeBranchId || appData.branches?.[0]?.id || 'main');
    setModalType(inv.type);
    setSalesPricingType((inv.salesType as any) || (inv.type === 'ajel' ? 'wholesale' : 'cash'));
    setSelectedItemId('');
    setIsPriceAutoFetched(false);
    setPriceWarning(null);
    setCustomerName(inv.customerName);
    setPhone(inv.phone || '');
    setCustomerRepId(inv.customerRepId || '');
    setCustomerRepName(inv.customerRepName || '');
    setCustomerRepPhone(inv.customerRepPhone || '');
    setSalesRep(inv.salesRep || '');
    setNotes(inv.notes || '');
    setDate(inv.date || new Date().toISOString().split('T')[0]);
    setPaymentMethod((inv.paymentMethod as any) || 'drawer');
    setPaidAmountInput(inv.paidAmount !== undefined ? inv.paidAmount.toString() : '0');
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
          method: p.method,
          amount: p.amount,
        }))
      );
    } else {
      const methodLabel =
        inv.paymentMethod === 'vodafone'
          ? 'فودافون كاش Vodafone Cash'
          : inv.paymentMethod === 'instapay'
          ? 'انستاباي Instapay'
          : inv.paymentMethod === 'bank'
          ? 'فيزا / كارت Visa'
          : 'نقدي / كاش';
      setPaymentRows([
        { id: `pay_${Date.now()}`, method: methodLabel, amount: inv.paidAmount || 0 },
      ]);
    }

    setItemName('');
    setItemNote('');
    setItemQty('');
    setItemPrice('');
    setItemDiscount('0');
    setItemTax('0');
    setDiscountType(inv.discountType || 'percent');
    setDiscount(inv.discountValue !== undefined ? inv.discountValue : (inv.discount || 0));
    setTaxType(inv.taxType || 'percent');
    setTax(inv.taxValue !== undefined ? inv.taxValue : (inv.tax || 0));
    setExtraRevenueName(inv.extraRevenueName || '');
    setExtraRevenueAmount(inv.extraRevenueAmount || 0);
    setFeeDesc((inv as any).feeDescription || '');
    setFees(inv.fees || 0);
    setShowCustomerDropdown(false);
    setShowPhoneDropdown(false);
    setShowItemDropdown(false);
    setShowItemCard(true);
    setActiveModal('edit');
  };

  // 🏷️ Handle switching sales pricing type (Cash vs Wholesale)
  const handleChangePricingType = (newType: 'cash' | 'wholesale') => {
    setSalesPricingType(newType);

    // If currently draft item selected, update its price immediately
    if (itemName.trim()) {
      const priceRes = getProductActivePrice(appData, selectedItemId || itemName, newType);
      if (priceRes.hasPrice) {
        setItemPrice(priceRes.price.toString());
        setPriceWarning(null);
        setIsPriceAutoFetched(true);
      } else {
        setItemPrice('');
        setPriceWarning(priceRes.message || 'لا يوجد سعر محدد في إدارة الأسعار');
        showToast(priceRes.message || 'الصنف ليس له سعر محدد', 'error');
      }
    }

    // If there are already items in the invoice table, recalculate them to match master price
    if (unifiedItems.length > 0) {
      let updatedCount = 0;
      const updatedUnified = unifiedItems.map((itm) => {
        const res = getProductActivePrice(appData, itm.itemId || itm.name, newType);
        if (res.hasPrice) {
          updatedCount++;
          const newUnit = res.price;
          const baseTot = (itm.qty || 1) * newUnit;
          const itemDiscAmt = itm.discType === 'val' ? (itm.discVal || 0) : (baseTot * (itm.discVal || 0)) / 100;
          const afterDisc = Math.max(0, baseTot - itemDiscAmt);
          const itemTaxAmt = itm.taxType === 'val' ? (itm.taxVal || 0) : (afterDisc * (itm.taxVal || 0)) / 100;
          const newTot = Math.max(0, afterDisc + itemTaxAmt);
          return {
            ...itm,
            price: newUnit,
            actualDisc: itemDiscAmt,
            actualTax: itemTaxAmt,
            total: newTot,
          };
        }
        return itm;
      });
      setUnifiedItems(updatedUnified);
      showToast(
        `تم إعادة احتساب أسعار (${updatedCount}) صنف وفق تسعيرة (${newType === 'wholesale' ? 'الجملة' : 'النقدي'}) من إدارة الأسعار`,
        'info'
      );
    } else if (tempItems.length > 0) {
      let updatedCount = 0;
      const updatedTemp = tempItems.map((itm) => {
        const res = getProductActivePrice(appData, itm.itemId || itm.name, newType);
        if (res.hasPrice) {
          updatedCount++;
          const newUnit = res.price;
          const itmDisc = itm.discount || 0;
          const itmTax = itm.tax || 0;
          const baseTot = itm.qty * newUnit;
          const newTot = baseTot - (baseTot * itmDisc / 100) + (baseTot * itmTax / 100);
          return {
            ...itm,
            price: newUnit,
            priceType: newType,
            priceSource: 'price_management' as const,
            total: Math.max(0, newTot),
          };
        }
        return itm;
      });
      setTempItems(updatedTemp);
      showToast(
        `تم إعادة احتساب أسعار (${updatedCount}) صنف وفق تسعيرة (${newType === 'wholesale' ? 'الجملة' : 'النقدي'}) من إدارة الأسعار`,
        'info'
      );
    }
  };

  // 🏷️ Handle selecting an item from the catalog
  const handleSelectItemFromCatalog = (item: any) => {
    setItemName(item.name);
    setSelectedItemId(item.id);
    if (!itemQty) setItemQty('1');
    setShowItemDropdown(false);

    // Fetch active master price strictly from Price Management
    const priceRes = getProductActivePrice(appData, item.id, salesPricingType);
    if (!priceRes.hasPrice) {
      setItemPrice('');
      setIsPriceAutoFetched(false);
      setPriceWarning(priceRes.message || 'لا يوجد سعر مسجل');
      showToast(priceRes.message || 'هذا المنتج لا يحتوي على سعر بيع في إدارة الأسعار', 'error');
    } else {
      setItemPrice(priceRes.price.toString());
      setPriceWarning(null);
      setIsPriceAutoFetched(true);
    }
  };

  const handleAddItem = () => {
    const name = itemName.trim();
    const qty = parseFloat(itemQty) || 0;
    const price = parseFloat(itemPrice) || 0;
    const itmDisc = parseFloat(itemDiscount) || 0;
    const itmTax = parseFloat(itemTax) || 0;

    if (!name || qty <= 0) {
      showToast('يرجى إدخال اسم الصنف والكمية بشكل صحيح', 'warning');
      return;
    }

    if (price <= 0) {
      showToast('لا يمكن إضافة صنف بسعر 0 أو بدون سعر محدد في إدارة الأسعار', 'error');
      return;
    }

    const matchedItem = appData.items.find(
      (i) => i.id === selectedItemId || i.name.trim().toLowerCase() === name.toLowerCase()
    );

    const baseTotal = qty * price;
    const calculatedTotal = baseTotal - (baseTotal * itmDisc / 100) + (baseTotal * itmTax / 100);

    setTempItems((prev) => [
      ...prev,
      {
        itemId: matchedItem?.id || selectedItemId || undefined,
        name,
        qty,
        price,
        costPrice: matchedItem?.purchasePrice || 0,
        priceType: salesPricingType,
        priceSource: isPriceAutoFetched ? 'price_management' : 'manual_override',
        notes: itemNote.trim() || undefined,
        discount: itmDisc,
        tax: itmTax,
        total: Math.max(0, calculatedTotal),
      },
    ]);
    setItemName('');
    setSelectedItemId('');
    setItemNote('');
    setItemQty('');
    setItemPrice('');
    setItemDiscount('0');
    setItemTax('0');
    setIsPriceAutoFetched(false);
    setPriceWarning(null);
  };

  // 📇 Open Add Item Modal (كارت الصنف)
  const handleOpenAddItemModal = () => {
    setEditingItemIndex(null);
    setEditingItemData(null);
    setIsItemCardModalOpen(true);
  };

  // ✏️ Open Edit Item Modal (تعديل كارت الصنف)
  const handleOpenEditItemModal = (item: InvoiceItem, index: number) => {
    setEditingItemIndex(index);
    setEditingItemData(item);
    setIsItemCardModalOpen(true);
  };

  // 💾 Save Item from Modal
  const handleSaveItemFromModal = (savedItem: InvoiceItem) => {
    if (editingItemIndex !== null && editingItemIndex >= 0) {
      setTempItems((prev) => {
        const copy = [...prev];
        copy[editingItemIndex] = savedItem;
        return copy;
      });
      showToast(`تم تعديل كارت الصنف: ${savedItem.name}`, 'success');
    } else {
      setTempItems((prev) => [...prev, savedItem]);
      showToast(`تمت إضافة الصنف للفاتورة: ${savedItem.name}`, 'success');
    }
    setIsItemCardModalOpen(false);
  };

  const handleRemoveItem = (index: number) => {
    setTempItems((prev) => prev.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    let itemsBaseSubtotal = 0;
    let totalItemDiscounts = 0;
    let totalItemTaxes = 0;

    unifiedItems.forEach((itm) => {
      itemsBaseSubtotal += (itm.price || 0) * (itm.qty || 1);
      totalItemDiscounts += itm.actualDisc || 0;
      totalItemTaxes += itm.actualTax || 0;
    });

    const globalDiscAmount =
      invDiscType === 'percent'
        ? (itemsBaseSubtotal - totalItemDiscounts) * (globalInvDisc / 100)
        : (globalInvDisc || 0);

    const baseForGlobalTax = Math.max(0, itemsBaseSubtotal - totalItemDiscounts - globalDiscAmount);
    const globalTaxAmount =
      invTaxType === 'percent'
        ? baseForGlobalTax * (globalInvTax / 100)
        : (globalInvTax || 0);

    const totalDiscountAmount = totalItemDiscounts + globalDiscAmount;
    const totalTaxAmount = totalItemTaxes + globalTaxAmount;
    const extraRev = extraIncomeVal || 0;
    const grandTotal = Math.max(0, itemsBaseSubtotal - totalDiscountAmount + totalTaxAmount + extraRev);

    let paidTotal = 0;
    paymentRows.forEach((r) => {
      paidTotal += r.amount || 0;
    });

    let effectivePaid = paidTotal;
    if ((modalType === 'nagdi' || modalType === 'return_nagdi') && effectivePaid === 0 && grandTotal > 0) {
      effectivePaid = grandTotal;
    }
    const effectiveRemaining = Math.max(0, grandTotal - effectivePaid);

    return {
      subtotal: itemsBaseSubtotal,
      totalItemDiscounts,
      totalItemTaxes,
      invoiceDiscountAmount: globalDiscAmount,
      invoiceTaxAmount: globalTaxAmount,
      totalDiscount: totalDiscountAmount,
      totalTax: totalTaxAmount,
      extraRevenueAmount: extraRev,
      total: grandTotal,
      effectivePaid,
      effectiveRemaining,
    };
  };

  const handleSaveInvoice = () => {
    if (unifiedItems.length === 0) {
      showToast('يرجى إضافة صنف واحد على الأقل في الفاتورة', 'warning');
      return;
    }
    if (!customerName.trim()) {
      showToast('يرجى إدخال اسم العميل', 'warning');
      return;
    }

    const { subtotal, totalDiscount, totalTax, total, effectivePaid, effectiveRemaining, extraRevenueAmount } = calculateTotals();
    const isReturn = modalType.startsWith('return_');

    // 2. Customer Credit Limit Verification for Credit Sale (Ajel)
    if (modalType === 'ajel' && effectiveRemaining > 0) {
      const cust = appData.customers.find(
        (c) => c.name.trim().toLowerCase() === customerName.trim().toLowerCase()
      );
      if (cust && cust.creditLimit && cust.creditLimit > 0) {
        const currentBalance = cust.balance || 0;
        const projectedBalance = currentBalance + effectiveRemaining;
        if (projectedBalance > cust.creditLimit) {
          const excess = projectedBalance - cust.creditLimit;
          const confirmExceed = confirm(
            `⚠️ تنبيه ائتماني: العميل "${customerName}" سيتجاوز الحد الائتماني المسموح به (${cust.creditLimit.toFixed(
              2
            )} ج.م) بمقدار (${excess.toFixed(2)} ج.م).\n\nالرصيد الحالي: ${currentBalance.toFixed(
              2
            )} ج.م\nالمتبقي من الفاتورة: ${effectiveRemaining.toFixed(
              2
            )} ج.م\nالرصيد الجديد المتوقع: ${projectedBalance.toFixed(
              2
            )} ج.م\n\nهل تريد المتابعة وحفظ الفاتورة الآجلة على مسؤليتك؟`
          );
          if (!confirmExceed) {
            showToast('تم إلغاء حفظ الفاتورة لتجاوز سقف الائتمان المسموح', 'info');
            return;
          }
        }
      }
    }

    const isEditing = editingInvoiceId !== null;
    const invId = isEditing ? editingInvoiceId : appData.nextInvoiceNumber;
    const oldInvForMeta = isEditing ? appData.salesInvoices.find((i) => i.id === editingInvoiceId) : null;
    const nowIso = new Date().toISOString();

    const finalItems: InvoiceItem[] = unifiedItems.map((u) => ({
      itemId: u.itemId,
      code: u.code,
      name: u.name,
      qty: u.qty,
      price: u.price,
      costPrice: u.costPrice,
      total: u.total,
      spec: u.spec,
      notes: u.spec,
      discVal: u.discVal,
      discType: u.discType,
      actualDisc: u.actualDisc,
      taxVal: u.taxVal,
      taxType: u.taxType,
      actualTax: u.actualTax,
      discount: u.actualDisc,
      discountType: u.discType === 'percent' ? 'percent' : 'fixed',
      discountValue: u.discVal,
      tax: u.actualTax,
      taxValue: u.taxVal,
    }));

    const firstRowMethod = paymentRows[0]?.method || 'نقدي / كاش';
    const primaryMethodKey: 'drawer' | 'vodafone' | 'instapay' | 'bank' =
      firstRowMethod.includes('فودافون')
        ? 'vodafone'
        : firstRowMethod.includes('انستاباي')
        ? 'instapay'
        : firstRowMethod.includes('فيزا') || firstRowMethod.includes('بنك')
        ? 'bank'
        : 'drawer';

    const newInvoice: SaleInvoice = {
      id: invId,
      clientSyncId: isEditing ? ((oldInvForMeta as any)?.clientSyncId || `sale_${invId}_${Date.now()}`) : `sale_${invId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      companyId: appData.companyId || 'COMP-000001',
      branchId: selectedBranchId || appData.activeBranchId || 'main',
      customerName: customerName.trim(),
      phone: phone.trim(),
      customerRepId: customerRepId || undefined,
      customerRepName: customerRepName.trim() || undefined,
      customerRepPhone: customerRepPhone.trim() || undefined,
      salesRep: salesRep.trim() || undefined,
      notes: notes.trim() || undefined,
      date: date,
      time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      items: finalItems,
      subtotal,
      discount: totalDiscount || 0,
      discountType: invDiscType === 'percent' ? 'percent' : 'fixed',
      discountValue: globalInvDisc || 0,
      tax: totalTax || 0,
      taxType: invTaxType === 'percent' ? 'percent' : 'fixed',
      taxValue: globalInvTax || 0,
      extraRevenueName: extraIncomeName.trim() || undefined,
      extraRevenueAmount: extraIncomeVal > 0 ? extraIncomeVal : (extraRevenueAmount > 0 ? extraRevenueAmount : undefined),
      fees: 0,
      total,
      paymentMethod: paymentRows.length > 1 ? 'split' : primaryMethodKey,
      paymentSplits: paymentRows.map((r) => ({ method: r.method, amount: r.amount })),
      type: modalType,
      salesType: salesPricingType,
      paidAmount: effectivePaid,
      remainingAmount: effectiveRemaining,
      status: 'approved',
      createdAt: isEditing ? (oldInvForMeta?.createdAt || nowIso) : nowIso,
      updatedAt: nowIso,
      createdBy: isEditing ? (oldInvForMeta?.createdBy || currentUser?.name || 'مدير النظام') : (currentUser?.name || 'مدير النظام'),
      createdByUserId: currentUser?.id,
      createdByUserCode: currentUser?.code || 1,
    };
    (newInvoice as any).feeDescription = feeDesc.trim() || undefined;

    const updatedData = { ...appData };

    // If editing, remove old invoice first and revert old stock movements and financial impacts
    if (isEditing) {
      const oldInv = updatedData.salesInvoices.find((i) => i.id === editingInvoiceId);
      if (oldInv) {
        const wasReturn = oldInv.type?.startsWith('return_');
        // Revert old item stocks
        oldInv.items?.forEach((itm) => {
          const sItm = updatedData.items.find((i) => (itm.itemId && i.id === itm.itemId) || i.name.trim() === itm.name.trim());
          if (sItm) {
            sItm.quantity = wasReturn ? (sItm.quantity || 0) - itm.qty : (sItm.quantity || 0) + itm.qty;
            if (!sItm.movements) sItm.movements = [];
            sItm.movements.push({
              date: date,
              type: 'adjustment',
              qty: wasReturn ? -itm.qty : itm.qty,
              price: itm.price,
              total: (wasReturn ? -itm.qty : itm.qty) * (itm.price || 0),
              note: `تسوية وإعادة كميات الفاتورة السابقة #${oldInv.id} قبل حفظ التعديل`,
            });
          }
        });

        // Revert old financial impacts (Cashbox & Customer Balance)
        if (oldInv.type === 'nagdi') {
          const oldMethod = oldInv.paymentMethod || 'drawer';
          if (updatedData.cashBox[oldMethod] !== undefined) {
            updatedData.cashBox[oldMethod] = Math.max(0, (updatedData.cashBox[oldMethod] || 0) - (oldInv.total || 0));
          }
        } else if (oldInv.type === 'ajel') {
          if (oldInv.paidAmount && oldInv.paidAmount > 0) {
            const oldMethod = oldInv.paymentMethod || 'drawer';
            if (updatedData.cashBox[oldMethod] !== undefined) {
              updatedData.cashBox[oldMethod] = Math.max(0, (updatedData.cashBox[oldMethod] || 0) - oldInv.paidAmount);
            }
          }
          const oldRemaining = oldInv.remainingAmount !== undefined ? oldInv.remainingAmount : (oldInv.total - (oldInv.paidAmount || 0));
          if (oldRemaining > 0 && oldInv.customerName) {
            const oldCust = updatedData.customers.find((c) => c.name === oldInv.customerName);
            if (oldCust) {
              oldCust.balance = (oldCust.balance || 0) - oldRemaining;
            }
          }
        } else if (oldInv.type === 'return_nagdi') {
          const oldMethod = oldInv.paymentMethod || 'drawer';
          if (updatedData.cashBox[oldMethod] !== undefined) {
            updatedData.cashBox[oldMethod] = (updatedData.cashBox[oldMethod] || 0) + (oldInv.total || 0);
          }
        } else if (oldInv.type === 'return_ajel') {
          if (oldInv.paidAmount && oldInv.paidAmount > 0) {
            const oldMethod = oldInv.paymentMethod || 'drawer';
            if (updatedData.cashBox[oldMethod] !== undefined) {
              updatedData.cashBox[oldMethod] = (updatedData.cashBox[oldMethod] || 0) + oldInv.paidAmount;
            }
          }
          const oldRemaining = oldInv.remainingAmount !== undefined ? oldInv.remainingAmount : (oldInv.total - (oldInv.paidAmount || 0));
          if (oldRemaining > 0 && oldInv.customerName) {
            const oldCust = updatedData.customers.find((c) => c.name === oldInv.customerName);
            if (oldCust) {
              oldCust.balance = (oldCust.balance || 0) + oldRemaining;
            }
          }
        }
      }
      updatedData.salesInvoices = updatedData.salesInvoices.map((i) => (i.id === editingInvoiceId ? newInvoice : i));
    } else {
      updatedData.nextInvoiceNumber += 1;
      updatedData.salesInvoices = [newInvoice, ...updatedData.salesInvoices];
    }

    // Update Stock with new items
    finalItems.forEach((item) => {
      const stockItem = updatedData.items.find((i) => (item.itemId && i.id === item.itemId) || i.name.trim() === item.name.trim());
      if (stockItem) {
        stockItem.quantity = isReturn ? (stockItem.quantity || 0) + item.qty : (stockItem.quantity || 0) - item.qty;
        if (!stockItem.movements) stockItem.movements = [];
        stockItem.movements.push({
          date: date,
          type: isReturn ? 'return_sale' : 'sale',
          qty: isReturn ? item.qty : -item.qty,
          price: item.price,
          total: isReturn ? item.total : -item.total,
          note: isReturn
            ? `مرتجع بيع (${modalType === 'return_nagdi' ? 'نقدي' : 'آجل'}) من ${customerName}`
            : `بيع (${modalType === 'nagdi' ? 'نقدي' : 'آجل'}) للعميل ${customerName}`,
        });
      }
    });

    // Cashbox & Customer Balance Handling
    if (modalType === 'nagdi') {
      // 1. Cash Sale:
      paymentRows.forEach((row) => {
        if (row.amount > 0) {
          const mKey: 'drawer' | 'vodafone' | 'instapay' | 'bank' =
            row.method.includes('فودافون') ? 'vodafone' :
            row.method.includes('انستاباي') ? 'instapay' :
            row.method.includes('فيزا') || row.method.includes('بنك') ? 'bank' : 'drawer';
          updatedData.cashBox[mKey] = (updatedData.cashBox[mKey] || 0) + row.amount;
          updatedData.cashTransactions.push({
            id: updatedData.nextCashId++,
            date: date,
            type: 'receive',
            method: mKey,
            amount: row.amount,
            note: `فاتورة بيع نقدي #${newInvoice.id} (${row.method}) - العميل: ${customerName}`,
            customerName: customerName,
            invoiceId: newInvoice.id,
          });
        }
      });
      if (effectivePaid > 0 && paymentRows.every((r) => !r.amount)) {
        updatedData.cashBox[primaryMethodKey] = (updatedData.cashBox[primaryMethodKey] || 0) + effectivePaid;
        updatedData.cashTransactions.push({
          id: updatedData.nextCashId++,
          date: date,
          type: 'receive',
          method: primaryMethodKey,
          amount: effectivePaid,
          note: `فاتورة بيع نقدي #${newInvoice.id} - العميل: ${customerName}`,
          customerName: customerName,
          invoiceId: newInvoice.id,
        });
      }
    } else if (modalType === 'ajel') {
      // 2. Credit Sale:
      if (effectivePaid > 0) {
        paymentRows.forEach((row) => {
          if (row.amount > 0) {
            const mKey: 'drawer' | 'vodafone' | 'instapay' | 'bank' =
              row.method.includes('فودافون') ? 'vodafone' :
              row.method.includes('انستاباي') ? 'instapay' :
              row.method.includes('فيزا') || row.method.includes('بنك') ? 'bank' : 'drawer';
            updatedData.cashBox[mKey] = (updatedData.cashBox[mKey] || 0) + row.amount;
            updatedData.cashTransactions.push({
              id: updatedData.nextCashId++,
              date: date,
              type: 'receive',
              method: mKey,
              amount: row.amount,
              note: `دفعة مقدمة فاتورة بيع آجل #${newInvoice.id} (${row.method}) - العميل: ${customerName}`,
              customerName: customerName,
              invoiceId: newInvoice.id,
            });
          }
        });
        if (paymentRows.every((r) => !r.amount)) {
          updatedData.cashBox[primaryMethodKey] = (updatedData.cashBox[primaryMethodKey] || 0) + effectivePaid;
          updatedData.cashTransactions.push({
            id: updatedData.nextCashId++,
            date: date,
            type: 'receive',
            method: primaryMethodKey,
            amount: effectivePaid,
            note: `دفعة مقدمة فاتورة بيع آجل #${newInvoice.id} - العميل: ${customerName}`,
            customerName: customerName,
            invoiceId: newInvoice.id,
          });
        }
      }
      const cust = updatedData.customers.find((c) => c.name === customerName);
      if (cust) {
        cust.balance = (cust.balance || 0) + effectiveRemaining;
      } else {
        updatedData.customers.push({
          id: 'c' + Date.now(),
          name: customerName,
          phone: phone,
          balance: effectiveRemaining,
          transactions: [],
        });
      }
    } else if (modalType === 'return_nagdi') {
      // 3. Cash Return:
      const refundAmount = effectivePaid > 0 ? effectivePaid : total;
      updatedData.cashBox[primaryMethodKey] = (updatedData.cashBox[primaryMethodKey] || 0) - refundAmount;
      updatedData.cashTransactions.push({
        id: updatedData.nextCashId++,
        date: date,
        type: 'pay',
        method: primaryMethodKey,
        amount: refundAmount,
        note: `مرتجع بيع نقدي (صرف فوري للعميل) #${newInvoice.id} - العميل: ${customerName}`,
        customerName: customerName,
        invoiceId: newInvoice.id,
      });
    } else if (modalType === 'return_ajel') {
      // 4. Credit Return:
      if (effectivePaid > 0) {
        updatedData.cashBox[primaryMethodKey] = (updatedData.cashBox[primaryMethodKey] || 0) - effectivePaid;
        updatedData.cashTransactions.push({
          id: updatedData.nextCashId++,
          date: date,
          type: 'pay',
          method: primaryMethodKey,
          amount: effectivePaid,
          note: `صرف نقدي من مرتجع مبيعات آجل #${newInvoice.id} - العميل: ${customerName}`,
          customerName: customerName,
          invoiceId: newInvoice.id,
        });
      }
      const cust = updatedData.customers.find((c) => c.name === customerName);
      if (cust) {
        cust.balance = (cust.balance || 0) - effectiveRemaining;
      }
    }

    const actionKind = isReturn ? 'return' : isEditing ? 'edit' : 'create';
    const actionText = isReturn
      ? `مرتجع مبيعات #${newInvoice.id} بقيمة ${total.toFixed(2)} ج.م للعميل "${customerName}"`
      : isEditing
      ? `تعديل فاتورة مبيعات #${newInvoice.id} بقيمة ${total.toFixed(2)} ج.م للعميل "${customerName}"`
      : `إصدار فاتورة مبيعات #${newInvoice.id} بقيمة ${total.toFixed(2)} ج.م للعميل "${customerName}"`;

    onUpdateData(updatedData, {
      action: actionKind,
      module: 'المبيعات',
      details: actionText,
    });
    setActiveModal(null);
    showToast(`تم حفظ ${isReturn ? 'مرتجع' : 'فاتورة'} مبيعات رقم #${newInvoice.id} بنجاح`, 'success');
  };

  const handleDeleteInvoice = (id: number) => {
    if (!confirm('هل أنت متأكد من حذف هذه الفاتورة؟ سيتم استرجاع كميات الأصناف تلقائياً إلى رصيد المخزون وتسوية الحسابات.')) return;
    const updatedData = { ...appData };
    const invToDelete = updatedData.salesInvoices.find((i) => i.id === id);

    if (invToDelete) {
      const isReturn = invToDelete.type?.startsWith('return_');
      let restoredItemsCount = 0;

      // 1. Rollback stock for all items
      invToDelete.items?.forEach((itm) => {
        const sItm = updatedData.items.find((i) => (itm.itemId && i.id === itm.itemId) || i.name.trim() === itm.name.trim());
        if (sItm) {
          const qtyDelta = isReturn ? -itm.qty : itm.qty;
          sItm.quantity = (sItm.quantity || 0) + qtyDelta;
          restoredItemsCount += itm.qty;

          if (!sItm.movements) sItm.movements = [];
          sItm.movements.push({
            date: new Date().toISOString().split('T')[0],
            type: 'adjustment',
            qty: qtyDelta,
            price: itm.price,
            total: qtyDelta * (itm.price || 0),
            note: `استرجاع رصيد المخزن بعد إلغاء/حذف فاتورة المبيعات #${id}`,
          });
        }
      });

      // 2. Rollback customer balance if credit sale
      if (invToDelete.customerName) {
        const cust = updatedData.customers.find((c) => c.name === invToDelete.customerName);
        if (cust) {
          const unpaidDebt = invToDelete.remainingAmount !== undefined ? invToDelete.remainingAmount : (invToDelete.total - (invToDelete.paidAmount || 0));
          if (unpaidDebt > 0) {
            cust.balance = Math.max(0, (cust.balance || 0) - (isReturn ? -unpaidDebt : unpaidDebt));
          }
        }
      }

      // 3. Rollback treasury cashbox if any paid amount
      if (invToDelete.paidAmount && invToDelete.paidAmount > 0) {
        const method = invToDelete.paymentMethod || 'drawer';
        if (updatedData.cashBox[method] !== undefined) {
          updatedData.cashBox[method] = isReturn
            ? (updatedData.cashBox[method] || 0) + invToDelete.paidAmount
            : Math.max(0, (updatedData.cashBox[method] || 0) - invToDelete.paidAmount);
        }
      }

      // Remove related cash transaction
      updatedData.cashTransactions = (updatedData.cashTransactions || []).filter((tx) => tx.invoiceId !== id);
    }

    if (!updatedData.deletedRecords) updatedData.deletedRecords = {};
    updatedData.deletedRecords[`salesInvoices_${id}`] = Date.now();

    updatedData.salesInvoices = updatedData.salesInvoices.filter((i) => i.id !== id);
    onUpdateData(updatedData, {
      action: 'delete_invoice',
      module: 'المبيعات',
      details: `حذف فاتورة مبيعات رقم #${id} واسترجاع الأصناف للمخزون`,
      deletedId: id,
    });
    showToast(`تم حذف الفاتورة رقم #${id} وإعادة كميات الأصناف كاملة إلى رصيد المخزن بنجاح`, 'success');
  };

  const handleOpenPayModal = (inv: SaleInvoice) => {
    setSelectedInvoice(inv);
    const rem = inv.total - (inv.paidAmount || 0);
    setPayAmount(rem > 0 ? rem : 0);
    setPayMethod('drawer');
    setActiveModal('pay');
  };

  const handleConfirmPayment = () => {
    if (!selectedInvoice) return;
    if (payAmount <= 0) {
      showToast('يرجى إدخال مبلغ دفع صحيح', 'warning');
      return;
    }
    const rem = selectedInvoice.total - (selectedInvoice.paidAmount || 0);
    if (payAmount > rem) {
      showToast('المبلغ المدفوع يتجاوز القيمة المتبقية للفاتورة', 'error');
      return;
    }

    const updatedData = { ...appData };
    const inv = updatedData.salesInvoices.find((i) => i.id === selectedInvoice.id);
    if (inv) {
      inv.paidAmount = (inv.paidAmount || 0) + payAmount;
      inv.remainingAmount = inv.total - inv.paidAmount;

      updatedData.cashBox[payMethod] += payAmount;

      const cust = updatedData.customers.find((c) => c.name === inv.customerName);
      if (cust) cust.balance = (cust.balance || 0) - payAmount;

      const nowIso = new Date().toISOString();
      const currentUserObj = updatedData.users?.find((u) => u.id === updatedData.currentUser) || updatedData.users?.[0];
      const newCashId = updatedData.nextCashId || 1;
      updatedData.nextCashId = newCashId + 1;

      updatedData.cashTransactions.push({
        id: newCashId,
        companyId: appData.companyId || 'COMP-000001',
        branchId: inv.branchId || appData.activeBranchId || 'main',
        date: new Date().toISOString().split('T')[0],
        type: 'receive',
        method: payMethod,
        amount: payAmount,
        note: `تسديد فاتورة مبيعات #${inv.id} - العميل: ${inv.customerName}`,
        customerName: inv.customerName,
        invoiceId: inv.id,
        status: 'approved',
        createdAt: nowIso,
        updatedAt: nowIso,
        createdBy: currentUserObj?.name || 'مستخدم النظام',
        createdByUserId: currentUserObj?.id,
        createdByUserCode: currentUserObj?.code || 1,
      });

      onUpdateData(updatedData, {
        action: 'invoice_payment',
        module: 'المبيعات والخزينة',
        details: `تسديد مبلغ ${payAmount} ج.م من الفاتورة رقم #${inv.id}`,
      });
      setActiveModal(null);
      showToast(`تم تسديد ${payAmount} ج.م للفاتورة #${inv.id} بنجاح`, 'success');
    }
  };

  const handlePrintInvoice = (inv: SaleInvoice) => {
    printInvoiceWindow(inv, true, appData.settings, showToast);
  };

  const handleWhatsAppShare = (inv: SaleInvoice) => {
    const customer = appData.customers.find((c) => c.name.trim() === inv.customerName.trim());
    const phone = customer?.phone || '';
    const msg = generateInvoiceWhatsAppMessage(inv, appData.settings);
    openWhatsAppChat(phone, msg);
    showToast('جاري فتح محادثة واتساب لإرسال تفاصيل الفاتورة للعميل', 'info');
  };

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

  const getTitleForModal = () => {
    switch (modalType) {
      case 'nagdi':
        return '🔹 فاتورة بيع نقدي جديدة (سداد فوري بالكامل)';
      case 'ajel':
        return '🔹 فاتورة بيع آجل جديدة (ذمم عملاء / دفعة مقدمة)';
      case 'return_nagdi':
        return '↩ مرتجع بيع نقدي (صرف فوري للعميل)';
      case 'return_ajel':
        return '↩ مرتجع بيع آجل (خصم من مديونية العميل)';
    }
  };

  // Print Sales Invoices List
  const handlePrintSalesList = () => {
    const list = appData.salesInvoices || [];
    const totalAmount = list.reduce((sum, i) => sum + (i.total || 0), 0);
    const totalPaid = list.reduce((sum, i) => sum + (i.paidAmount || 0), 0);
    const totalRemaining = totalAmount - totalPaid;

    openUnifiedPrintWindow(
      {
        reportTitle: 'سجل فواتير المبيعات والإيرادات',
        subTitle: 'كشف المبيعات المعتمد',
        serial: 'SALES-REP',
        branch: 'إدارة المبيعات',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        kpis: [
          { title: 'عدد الفواتير', value: `${list.length} فاتورة` },
          { title: 'إجمالي المبيعات', value: `${totalAmount.toFixed(2)} ج.م` },
          { title: 'إجمالي المحصل', value: `${totalPaid.toFixed(2)} ج.م` },
          { title: 'المتبقي ذمم عملاء', value: `${totalRemaining.toFixed(2)} ج.م` },
        ],
        columns: ['#', 'التاريخ', 'العميل', 'النوع', 'الإجمالي', 'المحصل', 'المتبقي'],
        rows: list.map((inv) => [
          `#${inv.id}`,
          inv.date,
          inv.customerName,
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
          { label: 'إجمالي قيمة المبيعات', value: `${totalAmount.toFixed(2)} ج.م`, isTotal: true },
          { label: 'إجمالي المبالغ المحصلة', value: `${totalPaid.toFixed(2)} ج.م` },
          { label: 'إجمالي المتبقي على العملاء', value: `${totalRemaining.toFixed(2)} ج.م` },
        ],
        footerNote: 'تم استخراج سجل المبيعات من النظام المحاسبي المعتمد',
      },
      appData.settings,
      showToast
    );
  };

  // Export Sales to Excel
  const handleExportSalesExcel = () => {
    const list = appData.salesInvoices || [];
    exportToExcel({
      filename: `سجل_فواتير_المبيعات_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'المبيعات',
      data: list,
      columns: [
        { header: 'رقم الفاتورة', key: 'id', width: 14 },
        { header: 'التاريخ', key: 'date', width: 14 },
        { header: 'اسم العميل', key: 'clientName', width: 26 },
        {
          header: 'نوع الفاتورة',
          getValue: (item: SaleInvoice) =>
            item.type === 'return_nagdi' || item.type === 'return_ajel'
              ? 'مرتجع مبيعات'
              : item.type === 'nagdi'
              ? 'نقدي'
              : 'آجل',
          width: 16,
        },
        { header: 'طريقة الدفع', key: 'paymentMethod', width: 14 },
        { header: 'إجمالي الفاتورة', key: 'total', width: 16, isCurrency: true },
        { header: 'المبلغ المسدد', key: 'paidAmount', width: 16, isCurrency: true },
        {
          header: 'المتبقي',
          getValue: (item: SaleInvoice) => (item.total - (item.paidAmount || 0)).toFixed(2),
          width: 16,
          isCurrency: true,
        },
        { header: 'الملاحظات', key: 'notes', width: 30 },
      ],
      companyName: appData.settings?.companyName,
      reportTitle: 'سجل فواتير المبيعات والتوريدات',
    });
    showToast('تم تصدير سجل المبيعات إلى ملف Excel بنجاح', 'success');
  };

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-xl shadow-xs border border-slate-200/90 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
          <button
            onClick={() => openCreateModal('nagdi')}
            className="min-h-[40px] bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white px-3 sm:px-4 py-2 rounded-lg text-xs md:text-sm font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>بيع نقدي</span>
          </button>
          <button
            onClick={() => openCreateModal('ajel')}
            className="min-h-[40px] bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white px-3 sm:px-4 py-2 rounded-lg text-xs md:text-sm font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>بيع أجل</span>
          </button>
          <button
            onClick={() => openCreateModal('return_nagdi')}
            className="min-h-[40px] bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white px-3 sm:px-4 py-2 rounded-lg text-xs md:text-sm font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
          >
            <RotateCcw className="w-4 h-4 shrink-0" />
            <span>مرتجع نقدي</span>
          </button>
          <button
            onClick={() => openCreateModal('return_ajel')}
            className="min-h-[40px] bg-slate-600 hover:bg-slate-700 active:bg-slate-800 text-white px-3 sm:px-4 py-2 rounded-lg text-xs md:text-sm font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
          >
            <RotateCcw className="w-4 h-4 shrink-0" />
            <span>مرتجع أجل</span>
          </button>
          <TableActionButtons
            onPrint={handlePrintSalesList}
            onExportExcel={handleExportSalesExcel}
            printTitle="طباعة سجل فواتير المبيعات"
            exportTitle="تصدير المبيعات إلى Excel"
          />
        </div>
        <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2 min-w-[220px]">
          {appData.branches && appData.branches.length > 1 && (
            <select
              value={selectedBranchFilter}
              onChange={(e) => setSelectedBranchFilter(e.target.value)}
              className="min-h-[40px] px-3 py-2 border border-slate-300 bg-slate-50 text-slate-800 font-semibold rounded-lg text-xs focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 focus:outline-none cursor-pointer"
            >
              <option value="all">جميع الفروع ({appData.salesInvoices?.length || 0})</option>
              {appData.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({appData.salesInvoices?.filter((i) => i.branchId === b.id).length || 0})
                </option>
              ))}
            </select>
          )}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="بحث برقم الفاتورة أو العميل..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full min-h-[40px] pr-9 pl-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Mobile Card List View (< md) */}
      <div className="block md:hidden space-y-3">
        {filteredInvoices.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center text-black font-bold text-sm border-2 border-slate-300">
            لا توجد فواتير مبيعات مسجلة
          </div>
        ) : (
          filteredInvoices.map((inv) => {
            const isPaidFull = inv.paidAmount >= inv.total;
            return (
              <div
                key={inv.id}
                className="bg-white rounded-2xl p-4 shadow-xs border-2 border-slate-300 space-y-3 hover:border-slate-500 transition"
              >
                {/* Top Row: Invoice ID, Date & Type Badge */}
                <div className="flex items-center justify-between border-b-2 border-slate-200 pb-2">
                  <div
                    onClick={() => {
                      setSelectedInvoice(inv);
                      setActiveModal('view');
                    }}
                    className="flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="text-blue-900 font-black text-sm font-mono">#{inv.id}</span>
                    <span className="text-black font-bold text-xs font-mono">| {inv.date}</span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${
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

                {/* Middle Info: Customer & Financials */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-black text-black text-sm">{inv.customerName}</div>
                    {inv.salesRep && (
                      <div className="text-xs text-blue-950 font-bold mt-0.5">👔 مندوب: {inv.salesRep}</div>
                    )}
                    {inv.notes && (
                      <div className="text-xs text-black font-medium mt-0.5 line-clamp-1">📝 {inv.notes}</div>
                    )}
                  </div>
                  <div className="text-left shrink-0">
                    <div className="text-xs text-slate-800 font-bold">القيمة الإجمالية</div>
                    <div className="font-black text-black text-base font-mono">
                      {(inv.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
                    </div>
                  </div>
                </div>

                {/* Status & Payment breakdown if Ajel */}
                <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-300">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-black border ${
                      isPaidFull
                        ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                        : inv.paidAmount > 0
                        ? 'bg-amber-100 text-amber-950 border-amber-300'
                        : 'bg-rose-100 text-rose-950 border-rose-300'
                    }`}
                  >
                    {isPaidFull ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                        <span>مدفوع بالكامل</span>
                      </>
                    ) : inv.paidAmount > 0 ? (
                      <>
                        <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                        <span>مدفوع جزئياً</span>
                      </>
                    ) : (
                      <span>غير مدفوع</span>
                    )}
                  </span>

                  {inv.type === 'ajel' && (
                    <div className="text-xs text-black font-mono font-bold">
                      <span>المدفوع: <strong className="text-emerald-900 font-black">{inv.paidAmount.toFixed(0)}</strong></span>
                      <span className="mx-1 text-slate-400">/</span>
                      <span>المتبقي: <strong className="text-rose-900 font-black">{(inv.total - inv.paidAmount).toFixed(0)}</strong></span>
                    </div>
                  )}
                </div>

                {/* Action Buttons with 40px min-height */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                  <button
                    onClick={() => {
                      setSelectedInvoice(inv);
                      setActiveModal('view');
                    }}
                    className="min-h-[40px] bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-black border border-slate-300 font-bold rounded-lg text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-blue-700" />
                    <span>عرض</span>
                  </button>
                  <button
                    onClick={() => openEditModal(inv)}
                    className="min-h-[40px] bg-blue-100 hover:bg-blue-200 active:bg-blue-300 text-blue-950 border border-blue-400 font-bold rounded-lg text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5 text-blue-700" />
                    <span>تعديل</span>
                  </button>
                  <button
                    onClick={() => handlePrintInvoice(inv)}
                    className="min-h-[40px] bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-black border border-slate-300 font-bold rounded-lg text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-700" />
                    <span>طباعة</span>
                  </button>
                  <button
                    onClick={() => handleWhatsAppShare(inv)}
                    className="min-h-[40px] bg-emerald-100 hover:bg-emerald-200 active:bg-emerald-300 text-emerald-950 border border-emerald-400 font-bold rounded-lg text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                    title="إرسال عبر واتساب"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-800" />
                    <span>واتساب</span>
                  </button>
                  <button
                    onClick={() => handleDeleteInvoice(inv.id)}
                    className="min-h-[40px] bg-rose-100 hover:bg-rose-200 active:bg-rose-300 text-rose-950 border border-rose-400 font-bold rounded-lg text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-700" />
                    <span>حذف</span>
                  </button>
                  {inv.type === 'ajel' && !isPaidFull && (
                    <button
                      onClick={() => handleOpenPayModal(inv)}
                      className="min-h-[40px] bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-black rounded-lg text-xs transition flex items-center justify-center gap-1.5 shadow-xs col-span-2 sm:col-span-4 cursor-pointer"
                    >
                      <DollarSign className="w-4 h-4" />
                      <span>تسديد دفعة من الفاتورة الآجلة</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Invoices Desktop Table (>= md) */}
      <div className="hidden md:block bg-white rounded-xl shadow-xs border-2 border-slate-300 overflow-x-auto">
        <table className="w-full text-right text-xs md:text-sm border-collapse border border-slate-300">
          <thead>
            <tr className="bg-[#0f172a] text-white">
              <th className="p-3 font-black border border-slate-700 text-white">رقم الفاتورة</th>
              <th className="p-3 font-black border border-slate-700 text-white">العميل</th>
              {appData.branches && appData.branches.length > 1 && <th className="p-3 font-black border border-slate-700 text-white">الفرع</th>}
              <th className="p-3 font-black border border-slate-700 text-white">التاريخ</th>
              <th className="p-3 font-black border border-slate-700 text-white">القيمة (ج.م)</th>
              <th className="p-3 font-black border border-slate-700 text-white">النوع</th>
              <th className="p-3 font-black border border-slate-700 text-white">الحالة</th>
              <th className="p-3 font-black border border-slate-700 text-white">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300 bg-white">
            {filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-black font-bold">
                  لا توجد فواتير مبيعات مسجلة
                </td>
              </tr>
            ) : (
              filteredInvoices.map((inv) => {
                const isPaidFull = inv.paidAmount >= inv.total;
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
                      <div className="font-black text-black">{inv.customerName}</div>
                      {inv.salesRep && (
                        <div className="text-xs text-blue-950 font-bold flex items-center gap-1 mt-0.5">
                          <UserIcon className="w-3 h-3 text-blue-700" />
                          <span>مندوب: {inv.salesRep}</span>
                        </div>
                      )}
                      {inv.notes && (
                        <div className="text-xs text-black font-medium truncate max-w-[160px] flex items-center gap-1 mt-0.5" title={inv.notes}>
                          <FileText className="w-3 h-3 text-slate-700 shrink-0" />
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
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded text-xs font-black border ${
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
                    </td>
                    <td className="p-3 border border-slate-300">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-black border ${
                          isPaidFull
                            ? 'bg-emerald-50 text-emerald-950 border-emerald-300'
                            : inv.paidAmount > 0
                            ? 'bg-amber-50 text-amber-950 border-amber-300'
                            : 'bg-rose-50 text-rose-950 border-rose-300'
                        }`}
                      >
                        {isPaidFull ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                            <span>مكتمل</span>
                          </>
                        ) : inv.paidAmount > 0 ? (
                          <>
                            <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                            <span>مدفوع جزئياً</span>
                          </>
                        ) : (
                          <span>غير مدفوع</span>
                        )}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
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
                          onClick={() => handlePrintInvoice(inv)}
                          className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center justify-center transition cursor-pointer border border-slate-200"
                          title="طباعة"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleWhatsAppShare(inv)}
                          className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex items-center justify-center transition cursor-pointer border border-emerald-200"
                          title="إرسال عبر واتساب"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEditModal(inv)}
                          className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 flex items-center justify-center transition cursor-pointer border border-blue-200"
                          title="تعديل الفاتورة"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {inv.type === 'ajel' && !isPaidFull && (
                          <button
                            onClick={() => handleOpenPayModal(inv)}
                            className="w-8 h-8 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 flex items-center justify-center transition cursor-pointer"
                            title="تسديد المتبقي"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                          </button>
                        )}
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

      {/* Modal for Invoice Creation & Edit */}
      <Modal
        isOpen={activeModal === 'create' || activeModal === 'edit'}
        title={getTitleForModal()}
        onClose={() => setActiveModal(null)}
        maxWidth="max-w-6xl"
        footer={
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <button
              type="button"
              onClick={handleSaveInvoice}
              className="min-h-[42px] bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white px-6 py-2.5 rounded-lg font-semibold text-xs sm:text-sm cursor-pointer transition shadow-xs flex items-center justify-center gap-2 flex-1 sm:flex-initial"
            >
              <Save className="w-4 h-4" />
              <span>{editingInvoiceId !== null ? 'تحديث وحفظ فاتورة المبيعات' : 'حفظ فاتورة المبيعات وترحيل الحسابات'}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="min-h-[42px] bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-800 px-5 py-2.5 rounded-lg font-semibold text-xs sm:text-sm cursor-pointer transition flex items-center justify-center gap-1.5 flex-1 sm:flex-initial text-center"
            >
              <X className="w-4 h-4" />
              <span>إلغاء</span>
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs md:text-sm">
          {/* Modal Header Banner */}
          <div className="flex justify-between items-center bg-slate-100 border-2 border-slate-200 p-2.5 rounded-xl">
            <span className="text-slate-900 font-black text-xs sm:text-sm flex items-center gap-1.5">
              <span>📌</span> {getTitleForModal()}
            </span>
          </div>
          {/* Header Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {appData.branches && appData.branches.length > 1 && (
              <div>
                <label className="block font-bold mb-1 text-indigo-950 flex items-center gap-1">
                  <span>🏢</span> الفرع المصدر
                </label>
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="w-full p-2 border-2 border-indigo-200 bg-indigo-50/40 rounded-xl focus:border-[#1a237e] focus:outline-none text-xs md:text-sm font-bold"
                >
                  {appData.branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.isMain ? '(الرئيسي)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="relative">
              <label className="block font-black mb-1 text-black">العميل</label>
              <input
                type="text"
                placeholder="ابحث باسم العميل أو هاتفه..."
                value={customerName}
                onFocus={() => setShowCustomerDropdown(true)}
                onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomerName(val);
                  setShowCustomerDropdown(true);
                  const matched = appData.customers.find(
                    (c) => c.name === val || (c.phone && c.phone === val)
                  );
                  if (matched) {
                    setCustomerName(matched.name);
                    setPhone(matched.phone || '');
                    if (matched.representatives && matched.representatives.length > 0) {
                      const primary = matched.representatives.find((r) => r.isPrimary) || matched.representatives[0];
                      setCustomerRepId(primary.id);
                      setCustomerRepName(primary.name);
                      setCustomerRepPhone(primary.phone);
                    } else {
                      setCustomerRepId('');
                      setCustomerRepName('');
                      setCustomerRepPhone('');
                    }
                  }
                }}
                className="w-full p-2.5 bg-white border-2 border-slate-400 rounded-xl focus:border-blue-700 focus:outline-none text-xs md:text-sm font-bold text-black placeholder:text-slate-500"
              />
              {showCustomerDropdown && (
                <div className="absolute top-full right-0 left-0 z-50 bg-white border-2 border-slate-400 rounded-xl shadow-2xl max-h-52 overflow-y-auto mt-1 divide-y divide-slate-200">
                  {filteredCustomersForName.length === 0 ? (
                    <div className="p-3 text-xs text-black font-bold text-center">
                      عميل جديد: <strong className="text-blue-900">"{customerName}"</strong> (سيتم تسجيله بالاسم والرقم عند الحفظ)
                    </div>
                  ) : (
                    filteredCustomersForName.map((c) => (
                      <div
                        key={c.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setCustomerName(c.name);
                          setPhone(c.phone || '');
                          if (c.representatives && c.representatives.length > 0) {
                            const primary = c.representatives.find((r) => r.isPrimary) || c.representatives[0];
                            setCustomerRepId(primary.id);
                            setCustomerRepName(primary.name);
                            setCustomerRepPhone(primary.phone);
                          } else {
                            setCustomerRepId('');
                            setCustomerRepName('');
                            setCustomerRepPhone('');
                          }
                          setShowCustomerDropdown(false);
                        }}
                        className="p-2.5 hover:bg-slate-100 cursor-pointer flex justify-between items-center text-xs transition border-b border-slate-100"
                      >
                        <div>
                          <span className="font-black text-black block text-sm">👤 {c.name}</span>
                          <span className="text-slate-800 font-bold text-xs">📞 {c.phone || 'بدون رقم مسجل'}</span>
                        </div>
                        {c.balance !== undefined && (
                          <span className={`text-xs font-black px-2 py-0.5 rounded-full border ${c.balance > 0 ? 'bg-red-50 text-red-900 border-red-300' : 'bg-emerald-50 text-emerald-900 border-emerald-300'}`}>
                            الرصيد: {c.balance.toFixed(2)} ج.م
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="relative">
              <label className="block font-black mb-1 text-black">الهاتف</label>
              <input
                type="text"
                placeholder="رقم الهاتف..."
                value={phone}
                onFocus={() => setShowPhoneDropdown(true)}
                onBlur={() => setTimeout(() => setShowPhoneDropdown(false), 200)}
                onChange={(e) => {
                  const val = e.target.value;
                  setPhone(val);
                  setShowPhoneDropdown(true);
                  const matched = appData.customers.find(
                    (c) => (c.phone && c.phone === val) || c.name === val
                  );
                  if (matched) {
                    setCustomerName(matched.name);
                    setPhone(matched.phone || val);
                  }
                }}
                className="w-full p-2.5 bg-white border-2 border-slate-400 rounded-xl focus:border-blue-700 focus:outline-none text-xs md:text-sm font-bold text-black placeholder:text-slate-500"
              />
              {showPhoneDropdown && (
                <div className="absolute top-full right-0 left-0 z-50 bg-white border-2 border-slate-400 rounded-xl shadow-2xl max-h-52 overflow-y-auto mt-1 divide-y divide-slate-200">
                  {filteredCustomersForPhone.length === 0 ? (
                    <div className="p-3 text-xs text-black font-bold text-center">
                      رقم جديد: <strong className="text-blue-900">"{phone}"</strong>
                    </div>
                  ) : (
                    filteredCustomersForPhone.map((c) => (
                      <div
                        key={c.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setCustomerName(c.name);
                          setPhone(c.phone || '');
                          setShowPhoneDropdown(false);
                        }}
                        className="p-2.5 hover:bg-slate-100 cursor-pointer flex justify-between items-center text-xs transition border-b border-slate-100"
                      >
                        <div>
                          <span className="font-black text-black block text-sm">📞 {c.phone || 'بدون رقم'}</span>
                          <span className="text-slate-800 font-bold text-xs">👤 {c.name}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block font-black mb-1 text-black">التاريخ</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-2.5 bg-white border-2 border-slate-400 rounded-xl focus:border-blue-700 focus:outline-none text-xs md:text-sm font-black text-black"
              />
            </div>
          </div>

          {/* Customer Representative / Delegate Section */}
          <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-200 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <label className="font-bold text-indigo-950 text-xs flex items-center gap-1.5">
                <span>👥</span> مندوب الشركة المشترية / المفوض بالاستلام <span className="text-gray-500 font-normal">(يظهر بالفاتورة المطبوعة)</span>
              </label>
              {(() => {
                const currentCust = appData.customers.find(
                  (c) => c.name.trim().toLowerCase() === customerName.trim().toLowerCase()
                );
                if (currentCust?.representatives && currentCust.representatives.length > 0) {
                  return (
                    <select
                      value={customerRepId}
                      onChange={(e) => {
                        const repId = e.target.value;
                        setCustomerRepId(repId);
                        const rep = currentCust.representatives?.find((r) => r.id === repId);
                        if (rep) {
                          setCustomerRepName(rep.name);
                          setCustomerRepPhone(rep.phone);
                        } else if (!repId) {
                          setCustomerRepName('');
                          setCustomerRepPhone('');
                        }
                      }}
                      className="bg-white border border-indigo-300 rounded-lg text-xs font-bold text-indigo-900 px-2 py-1 focus:outline-none"
                    >
                      <option value="">-- اختيار من مناديب الشركة ({currentCust.representatives.length}) --</option>
                      {currentCust.representatives.map((r) => (
                        <option key={r.id} value={r.id}>
                          👤 {r.name} ({r.phone}) {r.jobTitle ? `- ${r.jobTitle}` : ''}
                        </option>
                      ))}
                    </select>
                  );
                }
                return null;
              })()}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <input
                  type="text"
                  placeholder="اسم المندوب المفوض (مثال: أحمد محمود)..."
                  value={customerRepName}
                  onChange={(e) => setCustomerRepName(e.target.value)}
                  className="w-full p-2 bg-white border border-indigo-200 rounded-lg focus:border-indigo-600 focus:outline-none text-xs font-medium"
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="رقم هاتف المندوب (مثال: 01012345678)..."
                  value={customerRepPhone}
                  onChange={(e) => setCustomerRepPhone(e.target.value)}
                  className="w-full p-2 bg-white border border-indigo-200 rounded-lg focus:border-indigo-600 focus:outline-none text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* Sales Rep and Notes Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-indigo-50/60 p-3 rounded-xl border border-indigo-100">
            <div>
              <label className="block font-bold mb-1 text-gray-700 flex items-center gap-1">
                <span>👔</span> مندوب المبيعات <span className="text-gray-400 font-normal">(اختياري)</span>
              </label>
              <input
                type="text"
                placeholder="اختر أو اكتب اسم مندوب المبيعات..."
                list="salesRepsListSales"
                value={salesRep}
                onChange={(e) => setSalesRep(e.target.value)}
                className="w-full p-2 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none bg-white text-xs md:text-sm"
              />
              <datalist id="salesRepsListSales">
                {(appData.salesReps || []).map((r) => (
                  <option key={r.id} value={r.name} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block font-bold mb-1 text-gray-700 flex items-center gap-1">
                <span>📝</span> ملاحظات إضافية <span className="text-gray-400 font-normal">(اختياري)</span>
              </label>
              <input
                type="text"
                placeholder="أي ملاحظات أو بيانات إضافية للعميل أو العملية..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-2 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none bg-white text-xs md:text-sm"
              />
            </div>
          </div>

          <hr className="border-gray-200" />

          {/* 🏷️ Centralized Price Management Control Bar */}
          <div className="bg-gradient-to-r from-amber-50 to-indigo-50 border border-amber-200 rounded-2xl p-3 sm:p-4 shadow-xs">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-3">
              <div>
                <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <span>🏷️</span> نظام تسعير الفاتورة (المصدر المركزي: إدارة الأسعار)
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  يتم جلب الأسعار تلقائياً وفق نوع البيع المحدد ولا يُسمح بالإدخال العشوائي
                </p>
              </div>

              {/* Cash vs Wholesale Mode Buttons */}
              <div className="flex items-center bg-white p-1 rounded-xl border border-slate-300 shadow-xs self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => handleChangePricingType('cash')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    salesPricingType === 'cash'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>🟢</span> سعر نقدي (قطاعي)
                </button>
                <button
                  type="button"
                  onClick={() => handleChangePricingType('wholesale')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    salesPricingType === 'wholesale'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>🔵</span> سعر جملة (Wholesale)
                </button>
              </div>
            </div>
          </div>

          {/* Live Customer Credit Limit Alert if Ajel */}
          {modalType === 'ajel' && (() => {
            const matchedCust = appData.customers.find(
              (c) => c.name.trim().toLowerCase() === customerName.trim().toLowerCase()
            );
            if (matchedCust && matchedCust.creditLimit && matchedCust.creditLimit > 0) {
              const currentBal = matchedCust.balance || 0;
              const rem = calculateTotals().effectiveRemaining;
              const projBal = currentBal + rem;
              const isExceeded = projBal > matchedCust.creditLimit;
              return (
                <div
                  className={`p-3 rounded-xl border text-xs ${
                    isExceeded
                      ? 'bg-rose-50 border-rose-300 text-rose-900'
                      : 'bg-indigo-50 border-indigo-200 text-indigo-900'
                  }`}
                >
                  <div className="flex justify-between items-center font-bold">
                    <span className="flex items-center gap-1.5">
                      <span>{isExceeded ? '⚠️' : '🛡️'}</span>
                      <span>
                        {isExceeded
                          ? 'تحذير: سيتم تجاوز الحد الائتماني المسموح به للعميل!'
                          : 'فحص السقف الائتماني للعميل'}
                      </span>
                    </span>
                    <span className="font-mono">
                      الحد المسموح: {matchedCust.creditLimit.toFixed(2)} ج.م
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 text-[11px]">
                    <span>الرصيد الحالي: <strong>{currentBal.toFixed(2)} ج.م</strong></span>
                    <span>+ متبقي الفاتورة: <strong>{rem.toFixed(2)} ج.م</strong></span>
                    <span>
                      = الرصيد المتوقع:{' '}
                      <strong className={isExceeded ? 'text-rose-700 font-bold' : 'text-indigo-800 font-bold'}>
                        {projBal.toFixed(2)} ج.م
                      </strong>
                    </span>
                    {isExceeded && (
                      <span className="text-rose-700 font-black">
                        (تجاوز بمقدار: {(projBal - matchedCust.creditLimit).toFixed(2)} ج.م)
                      </span>
                    )}
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* 📦 نظام تسجيل وإدارة الأصناف الموحد للفاتورة (متجاوب مع الهواتف وشاشات اللمس) */}
          <div className="bg-slate-50/70 p-1 sm:p-2 rounded-2xl border border-slate-200 shadow-xs">
            <UnifiedInvoiceItemSystem
              mode={modalType.startsWith('return') ? 'return_sale' : 'sale'}
              items={unifiedItems}
              onChangeItems={setUnifiedItems}
              catalogItems={appData.items}
              pricingType={salesPricingType}
              globalInvDisc={globalInvDisc}
              onChangeGlobalInvDisc={setGlobalInvDisc}
              invDiscType={invDiscType}
              onChangeInvDiscType={setInvDiscType}
              globalInvTax={globalInvTax}
              onChangeGlobalInvTax={setGlobalInvTax}
              invTaxType={invTaxType}
              onChangeInvTaxType={setInvTaxType}
              extraIncomeName={extraIncomeName}
              onChangeExtraIncomeName={setExtraIncomeName}
              extraIncomeVal={extraIncomeVal}
              onChangeExtraIncomeVal={setExtraIncomeVal}
              paymentRows={paymentRows}
              onChangePaymentRows={setPaymentRows}
              hidePrintActions={true}
              onSaveInvoice={handleSaveInvoice}
            />
          </div>




        </div>
      </Modal>

      {/* 📇 كارت الصنف Modal (اسم الصنف، البيان، العدد، السعر، الخصم والضريبة بالنسبة أو الثابت) */}
      <InvoiceItemModal
        isOpen={isItemCardModalOpen}
        onClose={() => setIsItemCardModalOpen(false)}
        onSave={handleSaveItemFromModal}
        catalogItems={appData.items}
        pricingType={salesPricingType}
        mode="sale"
        initialItem={editingItemData}
      />

      {/* Modal for Invoice View - Using the standard template */}
      <Modal
        isOpen={activeModal === 'view'}
        title={`📋 تفاصيل الفاتورة #${selectedInvoice?.id}`}
        onClose={() => setActiveModal(null)}
      >
        {selectedInvoice && (
          <InvoiceCardTemplate
            invoice={selectedInvoice}
            isSales={true}
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

      {/* Modal for Invoice Pay */}
      <Modal
        isOpen={activeModal === 'pay'}
        title={`💰 تسديد دُفعة للفاتورة #${selectedInvoice?.id}`}
        onClose={() => setActiveModal(null)}
      >
        {selectedInvoice && (
          <div className="space-y-4 text-xs md:text-sm">
            <div className="bg-slate-50 p-3 rounded-xl">
              <p>
                العميل: <strong>{selectedInvoice.customerName}</strong>
              </p>
              <p>
                إجمالي الفاتورة: <strong>{selectedInvoice.total.toFixed(2)} ج.م</strong>
              </p>
              <p>
                المدفوع حالياً: <strong>{selectedInvoice.paidAmount.toFixed(2)} ج.م</strong>
              </p>
              <p className="text-red-700 font-bold text-base mt-1">
                المتبقي: {(selectedInvoice.total - selectedInvoice.paidAmount).toFixed(2)} ج.م
              </p>
            </div>

            <div>
              <label className="block font-bold mb-1">مبلغ التسديد (ج.م)</label>
              <input
                type="number"
                step="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                className="w-full p-2 border-2 border-gray-200 rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold mb-1">وسيلة التحصيل</label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as any)}
                className="w-full p-2 border-2 border-gray-200 rounded-xl"
              >
                <option value="drawer">نقدي (الدرج)</option>
                <option value="vodafone">فودافون كاش</option>
                <option value="instapay">إنستاباي</option>
                <option value="bank">حساب بنكي</option>
              </select>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleConfirmPayment}
                className="min-h-[44px] bg-[#2e7d32] hover:bg-[#1b5e20] active:bg-[#124116] text-white px-6 py-2 rounded-xl font-bold cursor-pointer transition shadow-xs flex-1 sm:flex-initial text-center"
              >
                ✅ تأكيد التسديد
              </button>
              <button
                onClick={() => setActiveModal(null)}
                className="min-h-[44px] bg-gray-400 hover:bg-gray-500 active:bg-gray-600 text-white px-6 py-2 rounded-xl font-bold cursor-pointer transition flex-1 sm:flex-initial text-center"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
