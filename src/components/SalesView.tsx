import React, { useState } from 'react';
import { AppData, SaleInvoice, InvoiceItem } from '../types';
import { Modal } from './Modal';
import { printInvoiceWindow } from '../utils/printInvoice';
import { InvoiceCardTemplate } from './InvoiceCardTemplate';
import { getProductActivePrice } from '../utils/priceService';
import { InvoiceItemModal } from './InvoiceItemModal';
import { exportToExcel } from '../utils/excelExport';
import { openUnifiedPrintWindow } from '../utils/printUnified';
import { TableActionButtons } from './TableActionButtons';
import { generateInvoiceWhatsAppMessage, openWhatsAppChat } from '../services/whatsappService';

interface SalesViewProps {
  appData: AppData;
  onUpdateData: (newData: AppData, actionInfo?: { action?: string; module?: string; details?: string }) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onInspectItem?: (type: string, data: any) => void;
}

export const SalesView: React.FC<SalesViewProps> = ({ appData, onUpdateData, showToast, onInspectItem }) => {
  const [searchTerm, setSearchTerm] = useState('');
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
    if (tempItems.length > 0) {
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

    tempItems.forEach((itm) => {
      const base = (itm.qty || 0) * (itm.price || 0);
      itemsBaseSubtotal += base;

      let itmDisc = 0;
      if (itm.discountType === 'percent') {
        const p = itm.discountValue !== undefined ? itm.discountValue : itm.discount || 0;
        itmDisc = (base * p) / 100;
      } else if (itm.discountType === 'fixed') {
        itmDisc = itm.discountValue !== undefined ? itm.discountValue : itm.discount || 0;
      } else if (typeof itm.discount === 'number' && itm.discount > 0) {
        itmDisc = itm.discount;
      }
      totalItemDiscounts += itmDisc;

      let itmTax = 0;
      const afterDisc = Math.max(0, base - itmDisc);
      if (itm.taxType === 'percent') {
        const tp = itm.taxValue !== undefined ? itm.taxValue : itm.tax || 0;
        itmTax = (afterDisc * tp) / 100;
      } else if (itm.taxType === 'fixed') {
        itmTax = itm.taxValue !== undefined ? itm.taxValue : itm.tax || 0;
      } else if (typeof itm.tax === 'number' && itm.tax > 0) {
        itmTax = itm.tax;
      }
      totalItemTaxes += itmTax;
    });

    let invoiceDiscountAmount = 0;
    if (typeof discount === 'number' && discount > 0) {
      if (discountType === 'percent') {
        invoiceDiscountAmount = (itemsBaseSubtotal * discount) / 100;
      } else {
        invoiceDiscountAmount = discount;
      }
    }
    const totalDiscountAmount = totalItemDiscounts + invoiceDiscountAmount;

    const baseForInvoiceTax = Math.max(0, itemsBaseSubtotal - totalDiscountAmount);
    let invoiceTaxAmount = 0;
    if (typeof tax === 'number' && tax > 0) {
      if (taxType === 'percent') {
        invoiceTaxAmount = (baseForInvoiceTax * tax) / 100;
      } else {
        invoiceTaxAmount = tax;
      }
    }
    const totalTaxAmount = totalItemTaxes + invoiceTaxAmount;

    const extraRev = typeof extraRevenueAmount === 'number' && extraRevenueAmount > 0 ? extraRevenueAmount : 0;
    const grandTotal = Math.max(0, itemsBaseSubtotal - totalDiscountAmount + totalTaxAmount + extraRev);

    let effectivePaid = 0;
    let effectiveRemaining = 0;

    if (modalType === 'nagdi' || modalType === 'return_nagdi') {
      effectivePaid = grandTotal;
      effectiveRemaining = 0;
    } else {
      const rawPaid = parseFloat(paidAmountInput) || 0;
      effectivePaid = Math.max(0, Math.min(grandTotal, rawPaid));
      effectiveRemaining = Math.max(0, grandTotal - effectivePaid);
    }

    return {
      subtotal: itemsBaseSubtotal,
      totalItemDiscounts,
      totalItemTaxes,
      invoiceDiscountAmount,
      invoiceTaxAmount,
      totalDiscount: totalDiscountAmount,
      totalTax: totalTaxAmount,
      extraRevenueAmount: extraRev,
      total: grandTotal,
      effectivePaid,
      effectiveRemaining,
    };
  };

  const handleSaveInvoice = () => {
    if (tempItems.length === 0) {
      showToast('يرجى إضافة صنف واحد على الأقل', 'warning');
      return;
    }
    if (!customerName.trim()) {
      showToast('يرجى إدخال اسم العميل', 'warning');
      return;
    }

    const { subtotal, totalDiscount, totalTax, total, effectivePaid, effectiveRemaining } = calculateTotals();
    const isReturn = modalType.startsWith('return_');

    // 1. Mandatory Payment Method Validation for Cash operations
    if ((modalType === 'nagdi' || modalType === 'return_nagdi') && !paymentMethod) {
      showToast('يرجى اختيار وسيلة دفع إجبارية (الخزينة أو الحساب البنكي) للعملية النقدية', 'error');
      return;
    }
    if ((modalType === 'ajel' || modalType === 'return_ajel') && effectivePaid > 0 && !paymentMethod) {
      showToast('يرجى اختيار وسيلة استلام/صرف الدفعة المقدمة', 'error');
      return;
    }

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

    const newInvoice: SaleInvoice = {
      id: invId,
      customerName: customerName.trim(),
      phone: phone.trim(),
      customerRepId: customerRepId || undefined,
      customerRepName: customerRepName.trim() || undefined,
      customerRepPhone: customerRepPhone.trim() || undefined,
      salesRep: salesRep.trim() || undefined,
      notes: notes.trim() || undefined,
      date: date,
      time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      items: tempItems,
      subtotal,
      discount: totalDiscount || 0,
      discountType,
      discountValue: discount || 0,
      tax: totalTax || 0,
      taxType,
      taxValue: tax || 0,
      extraRevenueName: extraRevenueName.trim() || undefined,
      extraRevenueAmount: extraRevenueAmount > 0 ? extraRevenueAmount : undefined,
      fees: fees || 0,
      total,
      paymentMethod,
      type: modalType,
      salesType: salesPricingType,
      paidAmount: effectivePaid,
      remainingAmount: effectiveRemaining,
      createdAt: new Date().toISOString(),
      createdBy: appData.users.find((u) => u.id === appData.currentUser)?.name || 'مدير النظام',
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
    tempItems.forEach((item) => {
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
      // 1. Cash Sale: Full amount directly to selected payment method, 0 customer debt
      updatedData.cashBox[paymentMethod] = (updatedData.cashBox[paymentMethod] || 0) + total;
      updatedData.cashTransactions.push({
        id: updatedData.nextCashId++,
        date: date,
        type: 'receive',
        method: paymentMethod,
        amount: total,
        note: `فاتورة بيع نقدي #${newInvoice.id} - العميل: ${customerName}`,
        customerName: customerName,
        invoiceId: newInvoice.id,
      });
    } else if (modalType === 'ajel') {
      // 2. Credit Sale: If downpayment made, add to cashbox; remaining goes to customer debt
      if (effectivePaid > 0) {
        updatedData.cashBox[paymentMethod] = (updatedData.cashBox[paymentMethod] || 0) + effectivePaid;
        updatedData.cashTransactions.push({
          id: updatedData.nextCashId++,
          date: date,
          type: 'receive',
          method: paymentMethod,
          amount: effectivePaid,
          note: `دفعة مقدمة فاتورة بيع آجل #${newInvoice.id} (${getMethodLabel(paymentMethod)}) - العميل: ${customerName}`,
          customerName: customerName,
          invoiceId: newInvoice.id,
        });
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
      // 3. Cash Return: Full amount paid back to customer from selected method, 0 customer debt impact
      updatedData.cashBox[paymentMethod] = (updatedData.cashBox[paymentMethod] || 0) - total;
      updatedData.cashTransactions.push({
        id: updatedData.nextCashId++,
        date: date,
        type: 'pay',
        method: paymentMethod,
        amount: total,
        note: `مرتجع بيع نقدي (صرف فوري للعميل) #${newInvoice.id} - العميل: ${customerName}`,
        customerName: customerName,
        invoiceId: newInvoice.id,
      });
    } else if (modalType === 'return_ajel') {
      // 4. Credit Return: If partial cash refunded, deduct from cashbox; remaining deducted from customer debt
      if (effectivePaid > 0) {
        updatedData.cashBox[paymentMethod] = (updatedData.cashBox[paymentMethod] || 0) - effectivePaid;
        updatedData.cashTransactions.push({
          id: updatedData.nextCashId++,
          date: date,
          type: 'pay',
          method: paymentMethod,
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

    updatedData.salesInvoices = updatedData.salesInvoices.filter((i) => i.id !== id);
    onUpdateData(updatedData, {
      action: 'delete',
      module: 'المبيعات',
      details: `حذف فاتورة مبيعات رقم #${id} واسترجاع الأصناف للمخزون`,
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

      updatedData.cashTransactions.push({
        id: updatedData.nextCashId++,
        date: new Date().toISOString().split('T')[0],
        type: 'receive',
        method: payMethod,
        amount: payAmount,
        note: `تسديد فاتورة مبيعات #${inv.id} - العميل: ${inv.customerName}`,
        customerName: inv.customerName,
        invoiceId: inv.id,
      });

      onUpdateData(updatedData);
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
      <div className="bg-white p-3 sm:p-4 rounded-2xl shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
          <button
            onClick={() => openCreateModal('nagdi')}
            className="min-h-[42px] bg-[#2e7d32] hover:bg-[#1b5e20] active:bg-[#124116] text-white px-3 sm:px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition cursor-pointer flex items-center justify-center gap-1 shadow-xs"
          >
            ➕ بيع نقدي
          </button>
          <button
            onClick={() => openCreateModal('ajel')}
            className="min-h-[42px] bg-[#f57f17] hover:bg-[#e65100] active:bg-[#b74100] text-white px-3 sm:px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition cursor-pointer flex items-center justify-center gap-1 shadow-xs"
          >
            ➕ بيع أجل
          </button>
          <button
            onClick={() => openCreateModal('return_nagdi')}
            className="min-h-[42px] bg-[#c62828] hover:bg-[#b71c1c] active:bg-[#8e1414] text-white px-3 sm:px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition cursor-pointer flex items-center justify-center gap-1 shadow-xs"
          >
            ↩ مرتجع نقدي
          </button>
          <button
            onClick={() => openCreateModal('return_ajel')}
            className="min-h-[42px] bg-slate-600 hover:bg-slate-700 active:bg-slate-800 text-white px-3 sm:px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition cursor-pointer flex items-center justify-center gap-1 shadow-xs"
          >
            ↩ مرتجع أجل
          </button>
          <TableActionButtons
            onPrint={handlePrintSalesList}
            onExportExcel={handleExportSalesExcel}
            printTitle="طباعة سجل فواتير المبيعات"
            exportTitle="تصدير المبيعات إلى Excel"
          />
        </div>
        <div className="w-full sm:w-auto min-w-[220px]">
          <input
            type="text"
            placeholder="🔍 بحث برقم الفاتورة أو اسم العميل..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full min-h-[42px] px-3.5 py-2 border-2 border-gray-200 rounded-xl text-xs focus:border-[#1a237e] focus:outline-none"
          />
        </div>
      </div>

      {/* Mobile Card List View (< md) */}
      <div className="block md:hidden space-y-3">
        {filteredInvoices.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center text-gray-400 text-sm">
            لا توجد فواتير مبيعات مسجلة
          </div>
        ) : (
          filteredInvoices.map((inv) => {
            const isPaidFull = inv.paidAmount >= inv.total;
            return (
              <div
                key={inv.id}
                className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200 space-y-3 hover:border-indigo-300 transition"
              >
                {/* Top Row: Invoice ID, Date & Type Badge */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div
                    onClick={() => {
                      setSelectedInvoice(inv);
                      setActiveModal('view');
                    }}
                    className="flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="text-[#1a237e] font-black text-sm">#{inv.id}</span>
                    <span className="text-slate-400 text-xs">| {inv.date}</span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      inv.type === 'nagdi'
                        ? 'bg-emerald-100 text-emerald-800'
                        : inv.type === 'ajel'
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-rose-100 text-rose-800'
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
                    <div className="font-bold text-slate-900 text-sm">{inv.customerName}</div>
                    {inv.salesRep && (
                      <div className="text-[11px] text-indigo-700 font-medium mt-0.5">👔 مندوب: {inv.salesRep}</div>
                    )}
                    {inv.notes && (
                      <div className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-1">📝 {inv.notes}</div>
                    )}
                  </div>
                  <div className="text-left shrink-0">
                    <div className="text-xs text-slate-500">القيمة الإجمالية</div>
                    <div className="font-black text-[#1a237e] text-base font-mono">
                      {(inv.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
                    </div>
                  </div>
                </div>

                {/* Status & Payment breakdown if Ajel */}
                <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      isPaidFull
                        ? 'bg-emerald-100 text-emerald-800'
                        : inv.paidAmount > 0
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {isPaidFull ? '✅ مدفوع بالكامل' : inv.paidAmount > 0 ? '⚠️ مدفوع جزئياً' : '❌ غير مدفوع'}
                  </span>

                  {inv.type === 'ajel' && (
                    <div className="text-[11px] text-slate-600">
                      <span>المدفوع: <strong className="text-emerald-700">{inv.paidAmount.toFixed(0)}</strong></span>
                      <span className="mx-1">/</span>
                      <span>المتبقي: <strong className="text-red-700 font-bold">{(inv.total - inv.paidAmount).toFixed(0)}</strong></span>
                    </div>
                  )}
                </div>

                {/* Action Buttons with 44px min-height */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                  <button
                    onClick={() => {
                      setSelectedInvoice(inv);
                      setActiveModal('view');
                    }}
                    className="min-h-[44px] bg-slate-100 hover:bg-slate-200 text-[#1a237e] font-bold rounded-xl text-xs transition flex items-center justify-center gap-1"
                  >
                    📋 عرض
                  </button>
                  <button
                    onClick={() => openEditModal(inv)}
                    className="min-h-[44px] bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1"
                  >
                    ✏️ تعديل
                  </button>
                  <button
                    onClick={() => handlePrintInvoice(inv)}
                    className="min-h-[44px] bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1"
                  >
                    🖨️ طباعة
                  </button>
                  <button
                    onClick={() => handleWhatsAppShare(inv)}
                    className="min-h-[44px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1"
                    title="إرسال عبر واتساب"
                  >
                    💬 واتساب
                  </button>
                  <button
                    onClick={() => handleDeleteInvoice(inv.id)}
                    className="min-h-[44px] bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1"
                  >
                    🗑️ حذف
                  </button>
                  {inv.type === 'ajel' && !isPaidFull && (
                    <button
                      onClick={() => handleOpenPayModal(inv)}
                      className="min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1 shadow-xs col-span-2 sm:col-span-4"
                    >
                      💰 تسديد دفعة من الفاتورة الآجلة
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Invoices Desktop Table (>= md) */}
      <div className="hidden md:block bg-white rounded-2xl p-4 shadow-xs overflow-x-auto">
        <table className="w-full text-right text-xs md:text-sm border-collapse">
          <thead>
            <tr className="bg-[#1a237e] text-white">
              <th className="p-3 rounded-r-lg">رقم الفاتورة</th>
              <th className="p-3">العميل</th>
              <th className="p-3">التاريخ</th>
              <th className="p-3">القيمة (ج.م)</th>
              <th className="p-3">النوع</th>
              <th className="p-3">الحالة</th>
              <th className="p-3 rounded-l-lg">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-gray-400">
                  لا توجد فواتير مبيعات مسجلة
                </td>
              </tr>
            ) : (
              filteredInvoices.map((inv) => {
                const isPaidFull = inv.paidAmount >= inv.total;
                return (
                  <tr key={inv.id} className="hover:bg-slate-50 transition">
                    <td
                      onClick={() => {
                        setSelectedInvoice(inv);
                        setActiveModal('view');
                      }}
                      className="p-3 text-[#1a237e] font-bold cursor-pointer hover:underline"
                    >
                      #{inv.id}
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-gray-900">{inv.customerName}</div>
                      {inv.salesRep && (
                        <div className="text-[11px] text-indigo-700 font-medium">👔 {inv.salesRep}</div>
                      )}
                      {inv.notes && (
                        <div className="text-[10px] text-gray-500 italic truncate max-w-[160px]" title={inv.notes}>
                          📝 {inv.notes}
                        </div>
                      )}
                    </td>
                    <td className="p-3">{inv.date}</td>
                    <td className="p-3 font-semibold">{inv.total.toFixed(2)}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded-full text-[11px] font-bold ${
                          inv.type === 'nagdi'
                            ? 'bg-emerald-100 text-emerald-800'
                            : inv.type === 'ajel'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-rose-100 text-rose-800'
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
                      <span
                        className={`px-2 py-1 rounded-full text-[11px] font-bold ${
                          isPaidFull
                            ? 'bg-emerald-100 text-emerald-800'
                            : inv.paidAmount > 0
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {isPaidFull ? 'مكتمل' : inv.paidAmount > 0 ? 'مدفوع جزئياً' : 'غير مدفوع'}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            setSelectedInvoice(inv);
                            setActiveModal('view');
                          }}
                          className="bg-[#1a237e] text-white p-2 rounded-lg text-xs hover:bg-[#0d47a1] transition cursor-pointer"
                          title="عرض الفاتورة"
                        >
                          📋
                        </button>
                        <button
                          onClick={() => handlePrintInvoice(inv)}
                          className="bg-teal-700 text-white p-2 rounded-lg text-xs hover:bg-teal-800 transition cursor-pointer"
                          title="طباعة"
                        >
                          🖨️
                        </button>
                        <button
                          onClick={() => handleWhatsAppShare(inv)}
                          className="bg-[#25D366] text-white p-2 rounded-lg text-xs hover:bg-[#128C7E] transition cursor-pointer font-bold"
                          title="إرسال الفاتورة عبر واتساب"
                        >
                          💬
                        </button>
                        <button
                          onClick={() => openEditModal(inv)}
                          className="bg-blue-600 text-white p-2 rounded-lg text-xs hover:bg-blue-700 transition cursor-pointer"
                          title="تعديل الفاتورة"
                        >
                          ✏️
                        </button>
                        {inv.type === 'ajel' && !isPaidFull && (
                          <button
                            onClick={() => handleOpenPayModal(inv)}
                            className="bg-[#2e7d32] text-white p-2 rounded-lg text-xs hover:bg-[#1b5e20] transition cursor-pointer"
                            title="تسديد المتبقي"
                          >
                            💰
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteInvoice(inv.id)}
                          className="bg-[#c62828] text-white p-2 rounded-lg text-xs hover:bg-[#b71c1c] transition cursor-pointer"
                          title="حذف"
                        >
                          🗑️
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
        footer={
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <button
              type="button"
              onClick={handleSaveInvoice}
              className="min-h-[46px] bg-[#2e7d32] hover:bg-[#1b5e20] active:bg-[#124116] text-white px-8 py-3 rounded-xl font-black text-sm cursor-pointer transition shadow-md flex items-center justify-center gap-2 flex-1 sm:flex-initial"
            >
              <span>💾</span> {editingInvoiceId !== null ? 'تحديث وحفظ فاتورة المبيعات' : 'حفظ فاتورة المبيعات وترحيل الحسابات'}
            </button>
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="min-h-[46px] bg-gray-400 hover:bg-gray-500 active:bg-gray-600 text-white px-6 py-3 rounded-xl font-bold text-sm cursor-pointer transition flex-1 sm:flex-initial text-center"
            >
              إلغاء
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs md:text-sm">
          {/* Quick Top Bar with Save Button */}
          <div className="flex justify-between items-center bg-emerald-50/80 border border-emerald-200 p-2.5 rounded-xl">
            <span className="text-emerald-900 font-bold text-xs flex items-center gap-1.5">
              <span>📌</span> {getTitleForModal()}
            </span>
            <button
              type="button"
              onClick={handleSaveInvoice}
              className="bg-[#2e7d32] hover:bg-[#1b5e20] active:bg-[#124116] text-white px-4 py-1.5 rounded-lg font-bold text-xs cursor-pointer transition shadow-xs flex items-center gap-1"
            >
              <span>💾</span> {editingInvoiceId !== null ? 'تحديث وحفظ' : 'حفظ الفاتورة الآن'}
            </button>
          </div>
          {/* Header Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="relative">
              <label className="block font-bold mb-1 text-gray-700">العميل</label>
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
                className="w-full p-2 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none text-xs md:text-sm"
              />
              {showCustomerDropdown && (
                <div className="absolute top-full right-0 left-0 z-50 bg-white border border-indigo-200 rounded-xl shadow-2xl max-h-52 overflow-y-auto mt-1 divide-y divide-gray-100">
                  {filteredCustomersForName.length === 0 ? (
                    <div className="p-2.5 text-xs text-gray-500 text-center">
                      عميل جديد: <strong>"{customerName}"</strong> (سيتم تسجيله بالاسم والرقم عند الحفظ)
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
                        className="p-2.5 hover:bg-indigo-50 cursor-pointer flex justify-between items-center text-xs transition"
                      >
                        <div>
                          <span className="font-bold text-[#1a237e] block">👤 {c.name}</span>
                          <span className="text-gray-500 text-[11px]">📞 {c.phone || 'بدون رقم مسجل'}</span>
                        </div>
                        {c.balance !== undefined && (
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${c.balance > 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
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
              <label className="block font-bold mb-1 text-gray-700">الهاتف</label>
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
                className="w-full p-2 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none text-xs md:text-sm"
              />
              {showPhoneDropdown && (
                <div className="absolute top-full right-0 left-0 z-50 bg-white border border-indigo-200 rounded-xl shadow-2xl max-h-52 overflow-y-auto mt-1 divide-y divide-gray-100">
                  {filteredCustomersForPhone.length === 0 ? (
                    <div className="p-2.5 text-xs text-gray-500 text-center">
                      رقم جديد: <strong>"{phone}"</strong>
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
                        className="p-2.5 hover:bg-indigo-50 cursor-pointer flex justify-between items-center text-xs transition"
                      >
                        <div>
                          <span className="font-bold text-[#1a237e] block">📞 {c.phone || 'بدون رقم'}</span>
                          <span className="text-gray-600 text-[11px]">👤 {c.name}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block font-bold mb-1 text-gray-700">التاريخ</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-2 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none text-xs md:text-sm"
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

            {/* Price Warning if product has no price */}
            {priceWarning && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-2.5 rounded-xl text-xs mb-3 flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-bold">
                  <span>⚠️</span> {priceWarning}
                </span>
                <span className="text-[10px] bg-rose-200 text-rose-900 px-2 py-0.5 rounded-full font-bold">
                  مطلوب تسعير
                </span>
              </div>
            )}

            {/* Add Item Form Bar with Prominent "Card Item Modal" Button */}
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 mb-3 bg-white p-3 rounded-xl border border-indigo-100 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="text-lg">📦</span>
                <div>
                  <h4 className="font-bold text-[#1a237e] text-xs sm:text-sm">أصناف الفاتورة ({tempItems.length})</h4>
                  <p className="text-[11px] text-gray-500">يمكنك إضافة الأصناف عبر كارت الصنف التفصيلي أو عبر الإدخال المباشر</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleOpenAddItemModal}
                className="min-h-[42px] bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-98 text-white px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer flex items-center justify-center gap-2 shadow-md"
              >
                <span className="text-base font-bold">➕</span>
                <span>فتح كارت الصنف (بيان / خصم / ضريبة)</span>
              </button>
            </div>

            {/* Quick Add Item Form */}
            <div className="grid grid-cols-2 sm:grid-cols-12 gap-2 sm:gap-3 items-end">
              {/* Product Autocomplete */}
              <div className="relative col-span-2 sm:col-span-6">
                <label className="block text-xs font-bold mb-1 text-slate-700">الصنف والباركود (بحث سريع)</label>
                <input
                  type="text"
                  placeholder="ابحث باسم الصنف، الباركود، أو الكود..."
                  value={itemName}
                  onFocus={() => setShowItemDropdown(true)}
                  onBlur={() => setTimeout(() => setShowItemDropdown(false), 250)}
                  onChange={(e) => {
                    const val = e.target.value;
                    setItemName(val);
                    setShowItemDropdown(true);
                    const matched = appData.items.find(
                      (i) =>
                        i.name.toLowerCase() === val.toLowerCase() ||
                        (i.barcode && i.barcode === val) ||
                        (i.code && i.code === val)
                    );
                    if (matched) {
                      handleSelectItemFromCatalog(matched);
                    }
                  }}
                  className="w-full p-2.5 border-2 border-slate-300 rounded-xl focus:border-[#1a237e] focus:outline-none bg-white text-xs md:text-sm font-medium"
                />
                {showItemDropdown && (
                  <div className="absolute top-full right-0 left-0 z-50 bg-white border border-indigo-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto mt-1 divide-y divide-gray-100">
                    {filteredItemsForSearch.length === 0 ? (
                      <div className="p-3 text-xs text-gray-500 text-center">
                        لا يوجد صنف مطابق لـ <strong>"{itemName}"</strong>
                      </div>
                    ) : (
                      filteredItemsForSearch.map((i) => {
                        const normalP = i.normalSellingPrice || i.salePrice || 0;
                        const wholeP = i.wholesaleSellingPrice || i.wholesalePrice || 0;
                        return (
                          <div
                            key={i.id}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSelectItemFromCatalog(i);
                            }}
                            className="p-2.5 hover:bg-indigo-50 cursor-pointer flex justify-between items-center text-xs transition"
                          >
                            <div>
                              <div className="font-bold text-[#1a237e] flex items-center gap-1.5">
                                <span>📦</span>
                                <span>{i.name}</span>
                                {i.code && (
                                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                                    {i.code}
                                  </span>
                                )}
                              </div>
                              <div className="text-gray-500 text-[11px] mt-0.5 flex gap-2">
                                <span>المخزون: <strong>{i.quantity || 0}</strong> {i.unit || 'قطعة'}</span>
                                {i.barcode && <span className="font-mono">باركود: {i.barcode}</span>}
                              </div>
                            </div>
                            <div className="text-left">
                              <div className="text-xs font-bold text-emerald-700">
                                نقدي: {normalP.toFixed(2)} ج.م
                              </div>
                              <div className="text-[11px] font-bold text-indigo-700">
                                جملة: {wholeP.toFixed(2)} ج.م
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Quantity Input */}
              <div className="col-span-1 sm:col-span-2">
                <label className="block text-xs font-bold mb-1 text-slate-700">العدد</label>
                <input
                  type="number"
                  placeholder="0"
                  step="any"
                  value={itemQty}
                  onChange={(e) => setItemQty(e.target.value)}
                  className="w-full p-2.5 border-2 border-slate-300 rounded-xl focus:border-[#1a237e] focus:outline-none bg-white text-xs md:text-sm font-bold font-mono"
                />
              </div>

              {/* Price Field (Protected / Controlled) */}
              <div className="col-span-1 sm:col-span-2">
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    السعر
                  </label>
                  {isPriceAutoFetched && (
                    <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-bold">
                      🔒 آلي
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  placeholder="0.00"
                  step="any"
                  value={itemPrice}
                  readOnly={!canOverridePrice}
                  onChange={(e) => {
                    if (canOverridePrice) {
                      setItemPrice(e.target.value);
                      setIsPriceAutoFetched(false);
                    }
                  }}
                  className={`w-full p-2.5 border-2 rounded-xl focus:outline-none text-xs md:text-sm font-bold font-mono ${
                    !canOverridePrice
                      ? 'bg-slate-100 text-slate-800 border-slate-300 cursor-not-allowed'
                      : 'bg-white text-slate-900 border-indigo-300 focus:border-[#1a237e]'
                  }`}
                />
              </div>

              {/* Add Button */}
              <div className="col-span-2 sm:col-span-2">
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="w-full min-h-[44px] bg-[#1a237e] hover:bg-[#0d47a1] active:bg-[#002171] text-white px-3 py-2.5 rounded-xl font-bold transition cursor-pointer flex items-center justify-center gap-1 shadow-xs"
                >
                  <span>➕</span> إضافة سريعة
                </button>
              </div>
            </div>
          </div>

          {/* Items Container - Dual Mobile Cards / Desktop Table */}
          {tempItems.length === 0 ? (
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center text-gray-500 text-xs sm:text-sm flex flex-col items-center justify-center gap-2">
              <span className="text-3xl">🛒</span>
              <span className="font-bold text-gray-700">لم يتم إضافة أي أصناف إلى الفاتورة بعد</span>
              <span className="text-gray-400 text-xs">اضغط على زر "فتح كارت الصنف" بالأعلى لإضافة صنف مع تحديد البيان والخصم والضريبة بحرية</span>
            </div>
          ) : (
            <div>
              {/* Mobile Card List for Added Items */}
              <div className="block md:hidden space-y-2 max-h-56 overflow-y-auto pr-0.5">
                {tempItems.map((item, idx) => (
                  <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col gap-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-900 truncate">{item.name}</div>
                        {item.notes && (
                          <div className="text-[11px] text-indigo-700 mt-0.5">بيان: {item.notes}</div>
                        )}
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-1">
                          <span>العدد: <strong className="font-mono text-slate-800">{item.qty}</strong></span>
                          <span>×</span>
                          <span>{item.price.toFixed(2)} ج.م</span>
                          {((item.discountValue || item.discount || 0) > 0) && (
                            <span className="bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded text-[10px] font-bold">
                              خصم: {item.discountValue || item.discount}{item.discountType === 'percent' ? '%' : ' ج.م'}
                            </span>
                          )}
                          {((item.taxValue || item.tax || 0) > 0) && (
                            <span className="bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded text-[10px] font-bold">
                              ضريبة: {item.taxValue || item.tax}{item.taxType === 'percent' ? '%' : ' ج.م'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-left shrink-0">
                        <span className="font-bold font-mono text-[#1a237e] text-sm block">{item.total.toFixed(2)} ج.م</span>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 border-t border-slate-200 pt-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEditItemModal(item, idx)}
                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1"
                      >
                        <span>✏️</span> تعديل
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-700 px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1"
                      >
                        <span>🗑️</span> حذف
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table for Added Items */}
              <div className="hidden md:block border border-gray-200 rounded-xl overflow-x-auto max-h-56">
                <table className="w-full text-right text-xs">
                  <thead className="bg-gray-100 text-gray-700 font-bold">
                    <tr>
                      <th className="p-2.5">#</th>
                      <th className="p-2.5">اسم الصنف</th>
                      <th className="p-2.5">البيان / ملاحظة</th>
                      <th className="p-2.5 text-center">العدد</th>
                      <th className="p-2.5">السعر</th>
                      <th className="p-2.5">الخصم والضريبة</th>
                      <th className="p-2.5">الإجمالي</th>
                      <th className="p-2.5 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {tempItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition">
                        <td className="p-2.5 font-mono text-gray-500">{idx + 1}</td>
                        <td className="p-2.5 font-bold text-slate-900">{item.name}</td>
                        <td className="p-2.5 text-gray-600 max-w-[180px] truncate" title={item.notes}>
                          {item.notes || '-'}
                        </td>
                        <td className="p-2.5 font-mono font-bold text-center text-slate-800">{item.qty}</td>
                        <td className="p-2.5 font-mono font-medium">{item.price.toFixed(2)} ج.م</td>
                        <td className="p-2.5">
                          <div className="flex flex-wrap gap-1">
                            {((item.discountValue || item.discount || 0) > 0) ? (
                              <span className="bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                خصم: {item.discountValue || item.discount}{item.discountType === 'percent' ? '%' : ' ج.م'}
                              </span>
                            ) : null}
                            {((item.taxValue || item.tax || 0) > 0) ? (
                              <span className="bg-indigo-100 text-indigo-900 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                ضريبة: {item.taxValue || item.tax}{item.taxType === 'percent' ? '%' : ' ج.م'}
                              </span>
                            ) : null}
                            {!((item.discountValue || item.discount || 0) > 0) && !((item.taxValue || item.tax || 0) > 0) && (
                              <span className="text-gray-400 text-[11px]">-</span>
                            )}
                          </div>
                        </td>
                        <td className="p-2.5 font-bold font-mono text-[#1a237e]">{item.total.toFixed(2)} ج.م</td>
                        <td className="p-2.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditItemModal(item, idx)}
                              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs transition cursor-pointer font-bold"
                              title="تعديل في كارت الصنف"
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-700 px-2 py-1 rounded text-xs transition cursor-pointer font-bold"
                              title="حذف الصنف"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Discounts, Tax & Extra Revenue Section - Dynamic & Comprehensive */}
          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-700 pb-1.5 border-b border-slate-200">
              <span className="flex items-center gap-1.5">
                <span>⚡</span>
                <span>الخانات الإضافية أسفل بيانات الفاتورة (الخصم والضريبة والإيرادات)</span>
              </span>
              <span className="text-[11px] text-slate-500 font-normal">الخصم والضريبة اختياري (نسبة مئوية % أو مبلغ ثابت ج.م) + خانة الإيرادات الإضافية</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* 1. الخصم الإضافي (اختياري بين نسبة % أو مبلغ ثابت) */}
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">خصم الفاتورة</label>
                  <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setDiscountType('percent')}
                      className={`px-2 py-0.5 text-[11px] font-bold rounded-md transition-all ${
                        discountType === 'percent'
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="خصم نسبة مئوية"
                    >
                      % نسبة
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('fixed')}
                      className={`px-2 py-0.5 text-[11px] font-bold rounded-md transition-all ${
                        discountType === 'fixed'
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="خصم مبلغ ثابت"
                    >
                      ج.م ثابت
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    placeholder={discountType === 'percent' ? '0 %' : '0.00 ج.م'}
                    min="0"
                    step="any"
                    value={discount || ''}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 border-2 border-gray-200 rounded-lg focus:border-amber-600 focus:outline-none text-xs font-mono font-bold"
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-gray-400 pointer-events-none">
                    {discountType === 'percent' ? '%' : 'ج.م'}
                  </span>
                </div>
              </div>

              {/* 2. الضريبة الإضافية (اختياري بين نسبة % أو مبلغ ثابت) */}
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">ضريبة الفاتورة</label>
                  <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setTaxType('percent')}
                      className={`px-2 py-0.5 text-[11px] font-bold rounded-md transition-all ${
                        taxType === 'percent'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="ضريبة نسبة مئوية"
                    >
                      % نسبة
                    </button>
                    <button
                      type="button"
                      onClick={() => setTaxType('fixed')}
                      className={`px-2 py-0.5 text-[11px] font-bold rounded-md transition-all ${
                        taxType === 'fixed'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="ضريبة مبلغ ثابت"
                    >
                      ج.م ثابت
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    placeholder={taxType === 'percent' ? '0 %' : '0.00 ج.م'}
                    min="0"
                    step="any"
                    value={tax || ''}
                    onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 border-2 border-gray-200 rounded-lg focus:border-indigo-600 focus:outline-none text-xs font-mono font-bold"
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-gray-400 pointer-events-none">
                    {taxType === 'percent' ? '%' : 'ج.م'}
                  </span>
                </div>
              </div>

              {/* 3. الإيرادات الإضافية (خانة للاسم وخانة للمبلغ) */}
              <div className="bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-emerald-900 flex items-center gap-1">
                    <span>💵</span>
                    <span>الإيراد الإضافي</span>
                  </label>
                  <span className="text-[10px] text-emerald-700 font-medium">اسم ومبلغ</span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  <div className="col-span-3">
                    <input
                      type="text"
                      placeholder="اسم الإيراد (مثال: توصيل، تركيب)"
                      value={extraRevenueName}
                      onChange={(e) => setExtraRevenueName(e.target.value)}
                      className="w-full p-2 border-2 border-emerald-200 rounded-lg focus:border-emerald-600 focus:outline-none text-[11px]"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      placeholder="المبلغ (ج.م)"
                      min="0"
                      step="any"
                      value={extraRevenueAmount || ''}
                      onChange={(e) => setExtraRevenueAmount(parseFloat(e.target.value) || 0)}
                      className="w-full p-2 border-2 border-emerald-200 rounded-lg focus:border-emerald-600 focus:outline-none text-xs font-mono font-bold text-emerald-900"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Aggregated Totals Preview */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-2 border-t border-slate-200 text-xs">
              <div className="p-2 bg-white rounded-lg border border-slate-200">
                <span className="text-gray-500 text-[10px] block">إجمالي قيمة الأصناف</span>
                <span className="font-bold font-mono text-slate-800">{calculateTotals().subtotal.toFixed(2)} ج.م</span>
              </div>
              <div className="p-2 bg-amber-50 rounded-lg border border-amber-200">
                <span className="text-amber-800 text-[10px] flex items-center justify-between">
                  <span>إجمالي الخصومات</span>
                  <span className="text-[9px] font-mono font-semibold">({discountType === 'percent' ? `${discount}%` : 'ثابت'})</span>
                </span>
                <span className="font-bold font-mono text-amber-900">-{calculateTotals().totalDiscount.toFixed(2)} ج.م</span>
              </div>
              <div className="p-2 bg-indigo-50 rounded-lg border border-indigo-200">
                <span className="text-indigo-800 text-[10px] flex items-center justify-between">
                  <span>إجمالي الضرائب</span>
                  <span className="text-[9px] font-mono font-semibold">({taxType === 'percent' ? `${tax}%` : 'ثابت'})</span>
                </span>
                <span className="font-bold font-mono text-indigo-900">+{calculateTotals().totalTax.toFixed(2)} ج.م</span>
              </div>
              <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-200">
                <span className="text-emerald-800 text-[10px] truncate block" title={extraRevenueName || 'الإيراد الإضافي'}>
                  {extraRevenueName ? `إيراد: ${extraRevenueName}` : 'الإيراد الإضافي'}
                </span>
                <span className="font-bold font-mono text-emerald-900">+{calculateTotals().extraRevenueAmount.toFixed(2)} ج.م</span>
              </div>
              <div className="col-span-2 sm:col-span-1 p-2 bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-lg shadow-sm">
                <span className="text-blue-200 text-[10px] block">الصافي النهائي للفاتورة</span>
                <span className="font-bold font-mono text-white text-sm">{calculateTotals().total.toFixed(2)} ج.م</span>
              </div>
            </div>
          </div>

          {/* Financial Settlement Section according to Operation Type */}
          <div className="border border-slate-200 bg-slate-50/80 p-3.5 rounded-2xl space-y-3">
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

            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span>💳</span>
                {modalType === 'nagdi' && 'تسوية البيع النقدي (سداد فوري بالكامل)'}
                {modalType === 'ajel' && 'تسوية البيع الآجل والذمم (دفعة مقدمة / متبقي)'}
                {modalType === 'return_nagdi' && 'تسوية صرف المرتجع النقدي للعميل فوراً'}
                {modalType === 'return_ajel' && 'تسوية المرتجع الآجل (خصم من ذمم العميل / رد نقدي)'}
              </span>
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                  modalType === 'nagdi'
                    ? 'bg-emerald-100 text-emerald-800'
                    : modalType === 'ajel'
                    ? 'bg-amber-100 text-amber-900'
                    : modalType === 'return_nagdi'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-purple-100 text-purple-900'
                }`}
              >
                {modalType === 'nagdi'
                  ? '🟢 نقدي فوري'
                  : modalType === 'ajel'
                  ? '🟠 آجل (ذمم عملاء)'
                  : modalType === 'return_nagdi'
                  ? '🔴 مرتجع نقدي'
                  : '⚫ مرتجع آجل'}
              </span>
            </div>

            {/* Inputs based on type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* If Ajel or Return Ajel: Show Paid / Downpayment amount input */}
              {(modalType === 'ajel' || modalType === 'return_ajel') && (
                <div>
                  <label className="block text-xs font-bold mb-1 text-slate-700">
                    {modalType === 'ajel'
                      ? 'المسدد مقدماً / نقداً الآن (ج.م)'
                      : 'المردود نقداً للعميل الآن إن وجد (ج.م)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={calculateTotals().total}
                    step="any"
                    placeholder="0.00"
                    value={paidAmountInput}
                    onChange={(e) => setPaidAmountInput(e.target.value)}
                    className="w-full p-2 border-2 border-amber-300 rounded-xl focus:border-[#1a237e] focus:outline-none bg-white text-xs md:text-sm font-mono font-bold"
                  />
                  <div className="text-[10px] text-slate-500 mt-1">
                    {modalType === 'ajel'
                      ? 'أدخل المبلغ المستلم من العميل الآن (أو اتركه 0 لتسجيل الفاتورة آجلة بالكامل كذمة)'
                      : 'أدخل أي نقدية تم ردها للعميل فعلياً (أو اتركه 0 ليتم خصم كامل المرتجع من حسابه)'}
                  </div>
                </div>
              )}

              {/* Payment Method Selector */}
              <div className={modalType === 'nagdi' || modalType === 'return_nagdi' ? 'sm:col-span-2' : ''}>
                <label className="block text-xs font-bold mb-1 text-slate-700">
                  {modalType === 'nagdi'
                    ? 'وسيلة استلام المبلغ (الخزينة / الحساب البنكي)'
                    : modalType === 'return_nagdi'
                    ? 'وسيلة صرف المرتجع للعميل'
                    : 'وسيلة استلام / صرف النقدية'}
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full p-2 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none bg-white text-xs md:text-sm font-semibold"
                >
                  <option value="drawer">💵 نقدي (الدرج / الخزينة الرئيسية)</option>
                  <option value="vodafone">📱 فودافون كاش (محفظة إلكترونية)</option>
                  <option value="instapay">⚡ إنستاباي (InstaPay)</option>
                  <option value="bank">💳 حساب بنكي</option>
                </select>
              </div>
            </div>

            {/* Live Financial Impact Summary Box */}
            <div className="bg-white border border-slate-200 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-2 bg-slate-50 rounded-lg">
                <span className="text-slate-500 block text-[10px]">إجمالي الفاتورة / المرتجع</span>
                <span className="font-bold font-mono text-slate-900 text-sm">
                  {calculateTotals().total.toFixed(2)} ج.م
                </span>
              </div>
              <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                <span className="text-emerald-700 block text-[10px]">
                  {modalType.startsWith('return') ? 'المصروف نقداً للعميل' : 'المحصل نقداً الآن'}
                </span>
                <span className="font-bold font-mono text-emerald-800 text-sm">
                  {calculateTotals().effectivePaid.toFixed(2)} ج.م
                </span>
                <span className="text-[10px] text-emerald-600 block truncate">
                  ({getMethodLabel(paymentMethod)})
                </span>
              </div>
              <div className="p-2 bg-amber-50 rounded-lg border border-amber-100 col-span-2 sm:col-span-1">
                <span className="text-amber-800 block text-[10px]">
                  {modalType === 'ajel'
                    ? 'المتبقي كمديونية (ذمم عملاء)'
                    : modalType === 'return_ajel'
                    ? 'المخصوم من مديونية العميل'
                    : 'المتبقي كذمم'}
                </span>
                <span
                  className={`font-bold font-mono text-sm ${
                    calculateTotals().effectiveRemaining > 0 ? 'text-rose-700' : 'text-slate-700'
                  }`}
                >
                  {calculateTotals().effectiveRemaining.toFixed(2)} ج.م
                </span>
              </div>
            </div>
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
