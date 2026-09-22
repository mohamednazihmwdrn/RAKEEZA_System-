import React, { useState, useMemo } from 'react';
import {
  AppData,
  Quotation,
  InvoiceItem,
  SaleInvoice,
  PurchaseInvoice,
  Customer,
  Supplier,
  Item,
} from '../types';
import { Modal } from './Modal';
import { addAuditLog } from '../utils/storage';
import { printQuotationWindow } from '../utils/printQuotation';
import { exportToExcel } from '../utils/excelExport';
import { openUnifiedPrintWindow } from '../utils/printUnified';
import { TableActionButtons } from './TableActionButtons';
import { tafqeetArabic } from '../utils/tafqeet';

interface QuotesOrdersViewProps {
  appData: AppData;
  onUpdateData: (newData: AppData) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onInspectItem?: (type: string, data: any) => void;
  onShareCatalog?: () => void;
}

export const QuotesOrdersView: React.FC<QuotesOrdersViewProps> = ({
  appData,
  onUpdateData,
  showToast,
  onInspectItem,
  onShareCatalog,
}) => {
  // Navigation & View Tabs
  const [activeTab, setActiveTab] = useState<'sale_quote' | 'purchase_order' | 'analytics'>('sale_quote');

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilterRange, setDateFilterRange] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'total_desc' | 'total_asc'>('date_desc');

  // Modals Control
  const [activeModal, setActiveModal] = useState<'create' | 'edit' | 'view' | 'convert' | 'delete' | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<Quotation | null>(null);
  const [editingQuoteId, setEditingQuoteId] = useState<number | null>(null);
  const [quoteToDelete, setQuoteToDelete] = useState<Quotation | null>(null);
  const [quoteToConvert, setQuoteToConvert] = useState<Quotation | null>(null);

  // Conversion Options Modal State
  const [convertInvoiceType, setConvertInvoiceType] = useState<'nagdi' | 'ajel'>('nagdi');
  const [convertPaymentMethod, setConvertPaymentMethod] = useState<'drawer' | 'vodafone' | 'instapay' | 'bank'>('drawer');

  // Form State (For Create / Edit)
  const [clientName, setClientName] = useState('');
  const [phone, setPhone] = useState('');
  const [salesRep, setSalesRep] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState('');
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount');
  const [discountValue, setDiscountValue] = useState<string>('0');
  const [taxPercent, setTaxPercent] = useState<string>('14');
  const [shippingFees, setShippingFees] = useState<string>('0');
  const [feeDescription, setFeeDescription] = useState('');
  const [pricingType, setPricingType] = useState<'cash' | 'wholesale' | 'custom'>('cash');
  const [paymentTermsPreset, setPaymentTermsPreset] = useState('');
  const [deliveryTermsPreset, setDeliveryTermsPreset] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([]);

  // Draft Item Input State
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [selectedItemObj, setSelectedItemObj] = useState<Item | null>(null);
  const [draftQty, setDraftQty] = useState<string>('1');
  const [draftPrice, setDraftPrice] = useState<string>('0');
  const [draftItemNote, setDraftItemNote] = useState('');
  const [draftItemDiscount, setDraftItemDiscount] = useState('0');
  const [showItemDropdown, setShowItemDropdown] = useState(false);

  // Autocomplete Dropdowns for Parties
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);

  // Current logged in user
  const currentUserObj = appData.users.find((u) => u.id === appData.currentUser) || appData.users[0];

  // Filtered Parties for Autocomplete
  const filteredCustomers = useMemo(() => {
    const q = clientName.trim().toLowerCase();
    if (!q) return appData.customers || [];
    return (appData.customers || []).filter(
      (c) => c.name.toLowerCase().includes(q) || (c.phone && c.phone.toLowerCase().includes(q))
    );
  }, [appData.customers, clientName]);

  const filteredSuppliers = useMemo(() => {
    const q = clientName.trim().toLowerCase();
    if (!q) return appData.suppliers || [];
    return (appData.suppliers || []).filter(
      (s) => s.name.toLowerCase().includes(q) || (s.phone && s.phone.toLowerCase().includes(q))
    );
  }, [appData.suppliers, clientName]);

  // Filtered Items for Catalog Search
  const filteredCatalogItems = useMemo(() => {
    const q = itemSearchQuery.trim().toLowerCase();
    if (!q) return appData.items || [];
    return (appData.items || []).filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.id && i.id.toString().toLowerCase().includes(q)) ||
        (i.code && i.code.toLowerCase().includes(q)) ||
        (i.barcode && i.barcode.toLowerCase().includes(q))
    );
  }, [appData.items, itemSearchQuery]);

  // Form Calculations
  const subtotal = useMemo(() => {
    return items.reduce((sum, it) => sum + (it.total || it.qty * it.price), 0);
  }, [items]);

  const discountAmountCalc = useMemo(() => {
    const val = parseFloat(discountValue) || 0;
    if (discountType === 'percent') {
      return (subtotal * val) / 100;
    }
    return Math.min(subtotal, Math.max(0, val));
  }, [subtotal, discountType, discountValue]);

  const afterDiscount = Math.max(0, subtotal - discountAmountCalc);
  const taxRateNum = parseFloat(taxPercent) || 0;
  const taxAmountCalc = (afterDiscount * taxRateNum) / 100;
  const shippingFeesNum = parseFloat(shippingFees) || 0;
  const grandTotal = afterDiscount + taxAmountCalc + shippingFeesNum;

  const currencySymbol = appData.settings?.currencySymbol || 'ج.م';
  const grandTotalTafqeet = useMemo(() => {
    return tafqeetArabic(grandTotal, {
      currency: currencySymbol === 'ج.م' ? 'جنيه مصري' : currencySymbol,
      fractionName: 'قرش',
      prefix: 'فقط',
      suffix: 'لا غير',
    });
  }, [grandTotal, currencySymbol]);

  // Handle Setting Active Party
  const handleSelectCustomer = (c: Customer) => {
    setClientName(c.name);
    setPhone(c.phone || '');
    setShowPartyDropdown(false);
  };

  const handleSelectSupplier = (s: Supplier) => {
    setClientName(s.name);
    setPhone(s.phone || '');
    setShowPartyDropdown(false);
  };

  // Handle Setting Active Item from Catalog
  const handleSelectItem = (itm: Item) => {
    setSelectedItemObj(itm);
    setItemSearchQuery(itm.name);
    setShowItemDropdown(false);

    let unitPrice = 0;
    if (activeTab === 'sale_quote') {
      if (pricingType === 'wholesale' && (itm as any).wholesalePrice) {
        unitPrice = (itm as any).wholesalePrice;
      } else {
        unitPrice = itm.salePrice || 0;
      }
    } else {
      unitPrice = itm.purchasePrice || 0;
    }
    setDraftPrice(unitPrice.toString());
  };

  // Add Item to Document List
  const handleAddItemToDoc = () => {
    const name = itemSearchQuery.trim();
    const qty = parseFloat(draftQty) || 0;
    const price = parseFloat(draftPrice) || 0;
    const itemDisc = parseFloat(draftItemDiscount) || 0;

    if (!name) {
      showToast('يرجى اختيار أو كتابة اسم الصنف', 'warning');
      return;
    }
    if (qty <= 0) {
      showToast('يرجى تحديد كمية صحيحة أكبر من الصفر', 'warning');
      return;
    }
    if (price < 0) {
      showToast('يرجى إدخال سعر صحيح', 'warning');
      return;
    }

    const lineSubtotal = qty * price;
    const lineDiscount = itemDisc > 0 ? (lineSubtotal * itemDisc) / 100 : 0;
    const lineTotal = Math.max(0, lineSubtotal - lineDiscount);

    const newItem: InvoiceItem = {
      itemId: selectedItemObj?.id || `custom-${Date.now()}`,
      name,
      qty,
      price,
      total: lineTotal,
      notes: draftItemNote.trim() || undefined,
    };

    setItems((prev) => [...prev, newItem]);

    // Reset draft item inputs
    setItemSearchQuery('');
    setSelectedItemObj(null);
    setDraftQty('1');
    setDraftPrice('0');
    setDraftItemNote('');
    setDraftItemDiscount('0');
    setShowItemDropdown(false);
  };

  // Direct In-Table Row Quantity Change
  const handleUpdateItemQty = (index: number, newQtyStr: string) => {
    const newQty = parseFloat(newQtyStr) || 0;
    setItems((prev) =>
      prev.map((it, idx) => {
        if (idx !== index) return it;
        const validQty = Math.max(1, newQty);
        return {
          ...it,
          qty: validQty,
          total: validQty * it.price,
        };
      })
    );
  };

  // Direct In-Table Row Price Change
  const handleUpdateItemPrice = (index: number, newPriceStr: string) => {
    const newPrice = parseFloat(newPriceStr) || 0;
    setItems((prev) =>
      prev.map((it, idx) => {
        if (idx !== index) return it;
        const validPrice = Math.max(0, newPrice);
        return {
          ...it,
          price: validPrice,
          total: it.qty * validPrice,
        };
      })
    );
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Open Create Modal
  const openCreateModal = () => {
    setEditingQuoteId(null);
    setSelectedQuote(null);
    setClientName('');
    setPhone('');
    setSalesRep(currentUserObj?.name || '');
    setDate(new Date().toISOString().split('T')[0]);
    // Default valid until: 15 days later
    const defaultExpiry = new Date();
    defaultExpiry.setDate(defaultExpiry.getDate() + 15);
    setValidUntil(defaultExpiry.toISOString().split('T')[0]);
    setDiscountType('amount');
    setDiscountValue('0');
    setTaxPercent(appData.settings?.defaultTaxRate !== undefined ? appData.settings.defaultTaxRate.toString() : '14');
    setShippingFees('0');
    setFeeDescription('');
    setPricingType('cash');
    setPaymentTermsPreset('نقداً عند الاستلام والفحص');
    setDeliveryTermsPreset('تسليم مخازن الشركة فوراً');
    setNotes('');
    setItems([]);
    setItemSearchQuery('');
    setSelectedItemObj(null);
    setActiveModal('create');
  };

  // Open Edit Modal
  const openEditModal = (quote: Quotation) => {
    setEditingQuoteId(quote.id);
    setSelectedQuote(quote);
    setClientName(quote.clientName || '');
    setPhone(quote.phone || '');
    setSalesRep((quote as any).salesRep || quote.createdBy || '');
    setDate(quote.date || new Date().toISOString().split('T')[0]);
    setValidUntil(quote.validUntil || '');
    setDiscountType('amount');
    setDiscountValue((quote.discount || 0).toString());
    setTaxPercent((quote.tax !== undefined ? quote.tax : 14).toString());
    setShippingFees(((quote as any).fees || 0).toString());
    setFeeDescription((quote as any).feeDescription || '');
    setPricingType('cash');
    setPaymentTermsPreset((quote as any).paymentTerms || '');
    setDeliveryTermsPreset((quote as any).deliveryTerms || '');
    setNotes(quote.notes || '');
    setItems(quote.items ? [...quote.items] : []);
    setItemSearchQuery('');
    setSelectedItemObj(null);
    setActiveModal('edit');
  };

  // Save or Update Quotation
  const handleSaveQuotation = (autoPrint: boolean = false, asDraft: boolean = false) => {
    if (!clientName.trim()) {
      showToast(
        activeTab === 'sale_quote' ? 'يرجى إدخال اسم العميل' : 'يرجى إدخال اسم المورد',
        'warning'
      );
      return;
    }
    if (items.length === 0) {
      showToast('يرجى إضافة صنف واحد على الأقل للمستند', 'warning');
      return;
    }

    const isEditing = editingQuoteId !== null;
    const docId = isEditing ? editingQuoteId : (appData.nextQuoteId || (appData.quotations?.length || 0) + 1);

    // Combine notes with terms presets if present
    const combinedNotesList: string[] = [];
    if (paymentTermsPreset.trim()) combinedNotesList.push(`شروط الدفع والسداد: ${paymentTermsPreset.trim()}`);
    if (deliveryTermsPreset.trim()) combinedNotesList.push(`شروط التسليم والتوريد: ${deliveryTermsPreset.trim()}`);
    if (notes.trim()) combinedNotesList.push(notes.trim());
    const finalNotes = combinedNotesList.join('\n');

    const newDoc: Quotation = {
      id: docId,
      type: activeTab === 'purchase_order' ? 'purchase_order' : 'sale_quote',
      clientName: clientName.trim(),
      phone: phone.trim() || undefined,
      date,
      validUntil: validUntil || undefined,
      items,
      subtotal,
      discount: discountAmountCalc,
      tax: taxRateNum,
      total: grandTotal,
      status: asDraft ? 'draft' : 'sent',
      notes: finalNotes || undefined,
      createdBy: isEditing && selectedQuote?.createdBy ? selectedQuote.createdBy : currentUserObj?.name || 'مدير النظام',
    };

    // Attach extra metadata
    (newDoc as any).salesRep = salesRep.trim() || undefined;
    (newDoc as any).fees = shippingFeesNum;
    (newDoc as any).feeDescription = feeDescription.trim() || undefined;
    (newDoc as any).paymentTerms = paymentTermsPreset.trim() || undefined;
    (newDoc as any).deliveryTerms = deliveryTermsPreset.trim() || undefined;

    let updatedData = { ...appData };
    const currentQuotes = updatedData.quotations || [];

    if (isEditing) {
      updatedData.quotations = currentQuotes.map((q) => (q.id === editingQuoteId ? newDoc : q));
    } else {
      updatedData.quotations = [newDoc, ...currentQuotes];
      updatedData.nextQuoteId = docId + 1;
    }

    const docTypeLabel = newDoc.type === 'sale_quote' ? 'عرض سعر مبيعات' : 'أمر شراء توريد';
    const actionLabel = isEditing ? 'تعديل' : 'إنشاء';

    updatedData = addAuditLog(
      updatedData,
      isEditing ? 'update' : 'create',
      'عروض الأسعار والطلبيات',
      `تم ${actionLabel} ${docTypeLabel} #${docId} للطرف: ${newDoc.clientName} بقيمة ${grandTotal.toFixed(
        2
      )} ج.م`
    );

    onUpdateData(updatedData);
    showToast(`تم ${actionLabel} ${docTypeLabel} #${docId} بنجاح`, 'success');

    if (autoPrint) {
      printQuotationWindow(newDoc, updatedData, appData.settings, showToast);
    }

    setActiveModal(null);
    setSelectedQuote(null);
    setEditingQuoteId(null);
  };

  // Duplicate / Clone Document
  const handleDuplicateQuote = (quote: Quotation) => {
    const nextId = appData.nextQuoteId || (appData.quotations?.length || 0) + 1;
    const clonedDoc: Quotation = {
      ...quote,
      id: nextId,
      date: new Date().toISOString().split('T')[0],
      status: 'draft',
      convertedInvoiceId: undefined,
      createdBy: currentUserObj?.name || 'مدير النظام',
    };

    let updatedData = {
      ...appData,
      quotations: [clonedDoc, ...(appData.quotations || [])],
      nextQuoteId: nextId + 1,
    };

    updatedData = addAuditLog(
      updatedData,
      'create',
      'عروض الأسعار والطلبيات',
      `تم استنساخ وتكرار المستند #${quote.id} إلى مستند جديد #${nextId}`
    );

    onUpdateData(updatedData);
    showToast(`تم تكرار المستند بنجاح برقم جديد #${nextId}`, 'success');
  };

  // Delete Quotation Confirmation
  const handleDeleteConfirm = () => {
    if (!quoteToDelete) return;

    let updatedData = {
      ...appData,
      quotations: (appData.quotations || []).filter((q) => q.id !== quoteToDelete.id),
    };

    const docTypeLabel = quoteToDelete.type === 'sale_quote' ? 'عرض سعر' : 'أمر شراء';
    updatedData = addAuditLog(
      updatedData,
      'delete',
      'عروض الأسعار والطلبيات',
      `تم حذف ${docTypeLabel} #${quoteToDelete.id} للطرف ${quoteToDelete.clientName}`
    );

    onUpdateData(updatedData);
    showToast(`تم حذف ${docTypeLabel} #${quoteToDelete.id} بنجاح`, 'info');
    setQuoteToDelete(null);
    setActiveModal(null);
  };

  // Convert Quotation / Order to Official Invoice
  const handleExecuteConversion = () => {
    if (!quoteToConvert) return;
    if (quoteToConvert.status === 'converted') {
      showToast('هذا المستند تم تحويله مسبقاً لفاتورة معتمدة', 'warning');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const timeNow = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    let updatedData = { ...appData };

    if (quoteToConvert.type === 'sale_quote') {
      const invId = updatedData.nextInvoiceNumber || 1;
      const isCash = convertInvoiceType === 'nagdi';
      const paid = isCash ? quoteToConvert.total : 0;
      const remaining = isCash ? 0 : quoteToConvert.total;

      const newInv: SaleInvoice = {
        id: invId,
        customerName: quoteToConvert.clientName,
        phone: quoteToConvert.phone || '',
        salesRep: (quoteToConvert as any).salesRep || quoteToConvert.createdBy,
        notes: `تم تحويله تلقائياً من عرض سعر المبيعات رقم #${quoteToConvert.id}. ${quoteToConvert.notes || ''}`,
        date: today,
        time: timeNow,
        items: quoteToConvert.items,
        subtotal: quoteToConvert.subtotal,
        discount: quoteToConvert.discount,
        tax: quoteToConvert.tax,
        fees: (quoteToConvert as any).fees || 0,
        total: quoteToConvert.total,
        paymentMethod: convertPaymentMethod,
        type: convertInvoiceType,
        paidAmount: paid,
        remainingAmount: remaining,
        createdAt: new Date().toISOString(),
        createdBy: currentUserObj?.name || 'مدير النظام',
        status: 'approved',
      };

      // 1. Stock Deduction
      updatedData.items = (updatedData.items || []).map((stockItm) => {
        const matchingRow = quoteToConvert.items.find((i) => i.name === stockItm.name || i.itemId === stockItm.id);
        if (matchingRow) {
          const qtyUsed = matchingRow.qty || 1;
          const currentQty = stockItm.quantity || 0;
          return {
            ...stockItm,
            quantity: currentQty - qtyUsed,
            movements: [
              ...(stockItm.movements || []),
              {
                date: today,
                type: 'sale',
                qty: -qtyUsed,
                price: matchingRow.price,
                total: -matchingRow.total,
                note: `صرف مخزني: تحويل عرض سعر #${quoteToConvert.id} إلى فاتورة مبيعات #${invId}`,
              },
            ],
          };
        }
        return stockItm;
      });

      // 2. Customer Ledger or Cashbox Balance
      if (isCash) {
        updatedData.cashBox[convertPaymentMethod] = (updatedData.cashBox[convertPaymentMethod] || 0) + quoteToConvert.total;
        updatedData.cashTransactions.push({
          id: updatedData.nextCashId++,
          date: today,
          type: 'receive',
          method: convertPaymentMethod,
          amount: quoteToConvert.total,
          note: `تحصيل فاتورة بيع نقدي #${invId} (محولة من عرض سعر #${quoteToConvert.id})`,
          customerName: quoteToConvert.clientName,
          invoiceId: invId,
        });
      } else {
        updatedData.customers = (updatedData.customers || []).map((c) => {
          if (c.name.trim().toLowerCase() === quoteToConvert.clientName.trim().toLowerCase()) {
            return { ...c, balance: (c.balance || 0) + quoteToConvert.total };
          }
          return c;
        });
      }

      updatedData.salesInvoices = [newInv, ...(updatedData.salesInvoices || [])];
      updatedData.nextInvoiceNumber = invId + 1;

      // Mark Quote as Converted
      updatedData.quotations = (updatedData.quotations || []).map((q) =>
        q.id === quoteToConvert.id ? { ...q, status: 'converted', convertedInvoiceId: invId } : q
      );

      updatedData = addAuditLog(
        updatedData,
        'create',
        'عروض الأسعار',
        `تم تحويل عرض السعر #${quoteToConvert.id} إلى فاتورة مبيعات رسمية #${invId} وتحديث المخزون والخزينة`
      );

      onUpdateData(updatedData);
      showToast(
        `✅ تم تحويل عرض السعر بنجاح إلى فاتورة مبيعات معتمدة #${invId} وتحديث الحسابات والمخزن!`,
        'success'
      );
    } else {
      // Purchase Order conversion
      const purchId = updatedData.nextPurchaseNumber || 1;
      const isCash = convertInvoiceType === 'nagdi';
      const paid = isCash ? quoteToConvert.total : 0;
      const remaining = isCash ? 0 : quoteToConvert.total;

      const newPurch: PurchaseInvoice = {
        id: purchId,
        supplierName: quoteToConvert.clientName,
        phone: quoteToConvert.phone || '',
        salesRep: (quoteToConvert as any).salesRep || quoteToConvert.createdBy,
        notes: `تم تحويله تلقائياً من أمر الشراء رقم #${quoteToConvert.id}. ${quoteToConvert.notes || ''}`,
        date: today,
        time: timeNow,
        items: quoteToConvert.items,
        subtotal: quoteToConvert.subtotal,
        discount: quoteToConvert.discount,
        tax: quoteToConvert.tax,
        fees: (quoteToConvert as any).fees || 0,
        total: quoteToConvert.total,
        paymentMethod: convertPaymentMethod,
        type: convertInvoiceType,
        paidAmount: paid,
        remainingAmount: remaining,
        createdAt: new Date().toISOString(),
        createdBy: currentUserObj?.name || 'مدير النظام',
        status: 'approved',
      };

      // 1. Stock Addition
      updatedData.items = (updatedData.items || []).map((stockItm) => {
        const matchingRow = quoteToConvert.items.find((i) => i.name === stockItm.name || i.itemId === stockItm.id);
        if (matchingRow) {
          const qtyAdded = matchingRow.qty || 1;
          const currentQty = stockItm.quantity || 0;
          return {
            ...stockItm,
            quantity: currentQty + qtyAdded,
            movements: [
              ...(stockItm.movements || []),
              {
                date: today,
                type: 'purchase',
                qty: qtyAdded,
                price: matchingRow.price,
                total: matchingRow.total,
                note: `إضافة مخزنية: تحويل أمر شراء #${quoteToConvert.id} إلى فاتورة مشتريات #${purchId}`,
              },
            ],
          };
        }
        return stockItm;
      });

      // 2. Supplier Ledger or Cashbox Balance
      if (isCash) {
        updatedData.cashBox[convertPaymentMethod] = (updatedData.cashBox[convertPaymentMethod] || 0) - quoteToConvert.total;
        updatedData.cashTransactions.push({
          id: updatedData.nextCashId++,
          date: today,
          type: 'pay',
          method: convertPaymentMethod,
          amount: quoteToConvert.total,
          note: `سداد فاتورة شراء نقدي #${purchId} (محولة من أمر شراء #${quoteToConvert.id})`,
          customerName: quoteToConvert.clientName,
          invoiceId: purchId,
        });
      } else {
        updatedData.suppliers = (updatedData.suppliers || []).map((s) => {
          if (s.name.trim().toLowerCase() === quoteToConvert.clientName.trim().toLowerCase()) {
            return { ...s, balance: (s.balance || 0) + quoteToConvert.total };
          }
          return s;
        });
      }

      updatedData.purchaseInvoices = [newPurch, ...(updatedData.purchaseInvoices || [])];
      updatedData.nextPurchaseNumber = purchId + 1;

      // Mark Quote as Converted
      updatedData.quotations = (updatedData.quotations || []).map((q) =>
        q.id === quoteToConvert.id ? { ...q, status: 'converted', convertedInvoiceId: purchId } : q
      );

      updatedData = addAuditLog(
        updatedData,
        'create',
        'أوامر الشراء',
        `تم تحويل أمر الشراء #${quoteToConvert.id} إلى فاتورة مشتريات رسمية #${purchId} وإضافة الكميات للمخزن`
      );

      onUpdateData(updatedData);
      showToast(
        `✅ تم تحويل أمر الشراء بنجاح إلى فاتورة مشتريات معتمدة #${purchId} وإضافة البضاعة للمخزن!`,
        'success'
      );
    }

    setQuoteToConvert(null);
    setActiveModal(null);
  };

  // Quick Status Toggle for active quotations
  const handleToggleStatus = (quote: Quotation, newStatus: 'draft' | 'sent' | 'cancelled') => {
    let updatedData = {
      ...appData,
      quotations: (appData.quotations || []).map((q) =>
        q.id === quote.id ? { ...q, status: newStatus } : q
      ),
    };

    updatedData = addAuditLog(
      updatedData,
      'update',
      'عروض الأسعار والطلبيات',
      `تم تغيير حالة المستند #${quote.id} إلى: ${newStatus}`
    );

    onUpdateData(updatedData);
    showToast(`تم تحديث حالة المستند #${quote.id} إلى (${newStatus}) بنجاح`, 'success');
  };

  // Filter and Sort List of Quotations / Orders
  const filteredAndSortedList = useMemo(() => {
    const list = (appData.quotations || []).filter((q) => {
      // 1. Tab Match
      if (activeTab !== 'analytics' && q.type !== activeTab) return false;

      // 2. Search Term Match
      if (searchTerm.trim()) {
        const s = searchTerm.trim().toLowerCase();
        const matchesId = q.id.toString().includes(s);
        const matchesClient = q.clientName?.toLowerCase().includes(s);
        const matchesPhone = q.phone?.toLowerCase().includes(s);
        const matchesNotes = q.notes?.toLowerCase().includes(s);
        const matchesRep = (q as any).salesRep?.toLowerCase().includes(s);
        const matchesItem = q.items?.some((i) => i.name.toLowerCase().includes(s));
        if (!matchesId && !matchesClient && !matchesPhone && !matchesNotes && !matchesRep && !matchesItem) {
          return false;
        }
      }

      // 3. Status Filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'online_order' && q.status !== 'online_order' && q.source !== 'online_catalog') return false;
        if (statusFilter === 'active' && q.status !== 'sent') return false;
        if (statusFilter === 'draft' && q.status !== 'draft') return false;
        if (statusFilter === 'converted' && q.status !== 'converted') return false;
        if (statusFilter === 'cancelled' && q.status !== 'cancelled') return false;
      }

      // 4. Date Range Filter
      const docDate = q.date;
      const todayStr = new Date().toISOString().split('T')[0];
      if (dateFilterRange === 'today' && docDate !== todayStr) return false;
      if (dateFilterRange === 'week') {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        if (docDate < oneWeekAgo.toISOString().split('T')[0]) return false;
      }
      if (dateFilterRange === 'month') {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        if (docDate < oneMonthAgo.toISOString().split('T')[0]) return false;
      }
      if (dateFilterRange === 'custom') {
        if (customStartDate && docDate < customStartDate) return false;
        if (customEndDate && docDate > customEndDate) return false;
      }

      return true;
    });

    // Sort List
    return list.sort((a, b) => {
      if (sortBy === 'date_desc') return b.date.localeCompare(a.date) || b.id - a.id;
      if (sortBy === 'date_asc') return a.date.localeCompare(b.date) || a.id - b.id;
      if (sortBy === 'total_desc') return (b.total || 0) - (a.total || 0);
      if (sortBy === 'total_asc') return (a.total || 0) - (b.total || 0);
      return 0;
    });
  }, [
    appData.quotations,
    activeTab,
    searchTerm,
    statusFilter,
    dateFilterRange,
    customStartDate,
    customEndDate,
    sortBy,
  ]);

  // Key KPI Analytics
  const analyticsData = useMemo(() => {
    const quotes = (appData.quotations || []).filter((q) => q.type === 'sale_quote');
    const orders = (appData.quotations || []).filter((q) => q.type === 'purchase_order');

    const totalQuotesCount = quotes.length;
    const totalQuotesValue = quotes.reduce((s, q) => s + (q.total || 0), 0);
    const convertedQuotes = quotes.filter((q) => q.status === 'converted');
    const convertedQuotesValue = convertedQuotes.reduce((s, q) => s + (q.total || 0), 0);
    const activeQuotesCount = quotes.filter((q) => q.status === 'sent').length;
    const draftQuotesCount = quotes.filter((q) => q.status === 'draft').length;
    const conversionRateQuotes = totalQuotesCount > 0 ? (convertedQuotes.length / totalQuotesCount) * 100 : 0;

    const totalOrdersCount = orders.length;
    const totalOrdersValue = orders.reduce((s, q) => s + (q.total || 0), 0);
    const convertedOrders = orders.filter((q) => q.status === 'converted');
    const convertedOrdersValue = convertedOrders.reduce((s, q) => s + (q.total || 0), 0);
    const activeOrdersCount = orders.filter((q) => q.status === 'sent').length;
    const conversionRateOrders = totalOrdersCount > 0 ? (convertedOrders.length / totalOrdersCount) * 100 : 0;

    return {
      quotes: {
        totalCount: totalQuotesCount,
        totalValue: totalQuotesValue,
        convertedCount: convertedQuotes.length,
        convertedValue: convertedQuotesValue,
        activeCount: activeQuotesCount,
        draftCount: draftQuotesCount,
        conversionRate: conversionRateQuotes,
      },
      orders: {
        totalCount: totalOrdersCount,
        totalValue: totalOrdersValue,
        convertedCount: convertedOrders.length,
        convertedValue: convertedOrdersValue,
        activeCount: activeOrdersCount,
        conversionRate: conversionRateOrders,
      },
    };
  }, [appData.quotations]);

  const activeStats = activeTab === 'sale_quote' ? analyticsData.quotes : analyticsData.orders;

  return (
    <div className="space-y-5">
      {/* 1. Header Toolbar & Navigation Tabs */}
      <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 flex flex-wrap justify-between items-center gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('sale_quote')}
            className={`px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'sale_quote'
                ? 'bg-[#1a237e] text-white shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>📋</span>
            <span>عروض أسعار المبيعات (Quotations)</span>
            <span className="bg-white/20 text-current px-2 py-0.5 rounded-full text-[11px] font-mono">
              {analyticsData.quotes.totalCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('purchase_order')}
            className={`px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'purchase_order'
                ? 'bg-[#1a237e] text-white shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>📦</span>
            <span>أوامر شراء الموردين (Purchase Orders)</span>
            <span className="bg-white/20 text-current px-2 py-0.5 rounded-full text-[11px] font-mono">
              {analyticsData.orders.totalCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-3.5 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'analytics'
                ? 'bg-indigo-900 text-white shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>📊</span>
            <span>المؤشرات ومعدلات التحويل</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <TableActionButtons
            onPrint={() => {
              const isPO = activeTab === 'purchase_order';
              const totalVal = filteredAndSortedList.reduce((sum, q) => sum + (q.total || 0), 0);
              openUnifiedPrintWindow(
                {
                  reportTitle: isPO ? 'سجل وحصر أوامر الشراء للموردين' : 'سجل وحصر عروض أسعار المبيعات للعملاء',
                  subTitle: isPO ? 'أوامر التوريد والشراء الصادرة' : 'عروض الأسعار المعتمدة للعملاء',
                  serial: isPO ? 'PO-LIST' : 'QT-LIST',
                  date: new Date().toISOString().split('T')[0],
                  kpis: [
                    { title: 'إجمالي السجلات', value: `${filteredAndSortedList.length}` },
                    { title: 'إجمالي القيمة الإجمالية', value: `${totalVal.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م` },
                  ],
                  columns: ['#', 'الرقم المرجعي', 'التاريخ', isPO ? 'اسم المورد' : 'اسم العميل', 'عدد البنود', 'الصافي', 'الحالة'],
                  rows: filteredAndSortedList.map((q, idx) => [
                    idx + 1,
                    q.id,
                    q.date,
                    q.clientName,
                    q.items?.length || 0,
                    `${(q.total || 0).toFixed(2)} ج.م`,
                    q.status === 'converted' ? (isPO ? 'تم التحويل لمشتريات' : 'تم التحويل لمبيعات') : q.status === 'sent' ? 'ساري' : q.status === 'draft' ? 'مسودة' : 'ملغي',
                  ]),
                  summary: [
                    { label: 'إجمالي قيمة السجلات المعروضة', value: `${totalVal.toFixed(2)} ج.م`, isTotal: true },
                  ],
                  footerNote: 'تم استخراج السجل واعتماده من المنظومة المحاسبية',
                },
                appData.settings,
                showToast
              );
            }}
            onExportExcel={() => {
              const isPO = activeTab === 'purchase_order';
              exportToExcel({
                filename: `${isPO ? 'أوامر_شراء_الموردين' : 'عروض_أسعار_العملاء'}_${new Date().toISOString().split('T')[0]}`,
                sheetName: isPO ? 'أوامر الشراء' : 'عروض الأسعار',
                data: filteredAndSortedList,
                columns: [
                  { header: 'الرقم المرجعي', key: 'id', width: 14 },
                  { header: 'التاريخ', key: 'date', width: 14 },
                  { header: isPO ? 'اسم المورد' : 'اسم العميل', key: 'clientName', width: 25 },
                  { header: 'رقم الهاتف', key: 'phone', width: 16 },
                  { header: 'مندوب المبيعات', getValue: (q: any) => q.salesRep || '-', width: 18 },
                  { header: 'عدد البنود', getValue: (q: Quotation) => q.items?.length || 0, width: 12 },
                  { header: 'الإجمالي قبل الخصم (ج.م)', getValue: (q: Quotation) => (q.subtotal || q.total).toFixed(2), width: 20 },
                  { header: 'الخصم (ج.م)', getValue: (q: Quotation) => (q.discount || 0).toFixed(2), width: 14 },
                  { header: 'الصافي النهائي (ج.م)', getValue: (q: Quotation) => q.total.toFixed(2), width: 18 },
                  {
                    header: 'الحالة',
                    getValue: (q: Quotation) => q.status === 'converted' ? (isPO ? 'تم التحويل لفاتورة مشتريات' : 'تم التحويل لفاتورة مبيعات') : q.status === 'sent' ? 'ساري وفعال' : q.status === 'draft' ? 'مسودة' : 'ملغي',
                    width: 22,
                  },
                  { header: 'ملاحظات وشروط', key: 'notes', width: 30 },
                ],
                companyName: appData.settings?.companyName || 'المنظومة المحاسبية المعتمدة',
                reportTitle: isPO ? 'سجل وحصر أوامر الشراء للموردين' : 'سجل وحصر عروض أسعار المبيعات للعملاء',
              });
              showToast(`تم تصدير ${isPO ? 'أوامر الشراء' : 'عروض الأسعار'} إلى Excel بنجاح`, 'success');
            }}
            printTitle={activeTab === 'purchase_order' ? 'طباعة سجل أوامر الشراء' : 'طباعة سجل عروض الأسعار'}
            exportTitle={activeTab === 'purchase_order' ? 'تصدير أوامر الشراء إلى Excel' : 'تصدير عروض الأسعار إلى Excel'}
          />
          {onShareCatalog && (
            <button
              type="button"
              onClick={onShareCatalog}
              className="bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 px-3.5 py-2.5 rounded-xl text-xs md:text-sm font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-98"
              title="مشاركة كتالوج المنتجات للعملاء وتوليد QR Code"
            >
              <span>🛍️</span>
              <span>مشاركة الكتالوج والـ QR</span>
            </button>
          )}
          <button
            onClick={openCreateModal}
            className="bg-[#2e7d32] hover:bg-[#1b5e20] text-white px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-98"
          >
            <span>➕</span>
            <span>{activeTab === 'purchase_order' ? 'إنشاء أمر شراء جديد' : 'إنشاء عرض سعر جديد'}</span>
          </button>
        </div>
      </div>

      {/* 2. Top KPI Cards */}
      {activeTab !== 'analytics' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="text-slate-500 text-xs font-bold flex items-center justify-between">
              <span>إجمالي المستندات</span>
              <span className="text-base">📑</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl md:text-2xl font-black text-slate-900 font-mono">
                {activeStats.totalCount}
              </span>
              <span className="text-xs font-bold text-slate-500 font-mono">
                {(activeStats?.totalValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} {currencySymbol}
              </span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-emerald-100 bg-emerald-50/20 shadow-xs flex flex-col justify-between">
            <div className="text-emerald-700 text-xs font-bold flex items-center justify-between">
              <span>محولة لفواتير رسمية</span>
              <span className="text-base">⚡</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl md:text-2xl font-black text-emerald-800 font-mono">
                {activeStats.convertedCount}
              </span>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full font-mono">
                {activeStats.conversionRate.toFixed(1)}% نجاح
              </span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-blue-100 bg-blue-50/20 shadow-xs flex flex-col justify-between">
            <div className="text-blue-700 text-xs font-bold flex items-center justify-between">
              <span>سارية ونشطة / قيد المتابعة</span>
              <span className="text-base">⏳</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl md:text-2xl font-black text-blue-900 font-mono">
                {activeStats.activeCount}
              </span>
              <span className="text-xs font-bold text-blue-600">بانتظار التعميد</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="text-slate-500 text-xs font-bold flex items-center justify-between">
              <span>مسودات / أخرى</span>
              <span className="text-base">📝</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl md:text-2xl font-black text-slate-700 font-mono">
                {(activeStats as any).draftCount || 0}
              </span>
              <span className="text-xs font-bold text-slate-400">غير معتمدة</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Main Data View or Analytics View */}
      {activeTab === 'analytics' ? (
        <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-lg font-black text-[#1a237e]">📊 مؤشرات دورة عروض الأسعار والطلبيات (Conversion Funnel)</h3>
            <p className="text-xs text-slate-500 mt-1">
              متابعة دقيقة لمعدلات تحويل عروض الأسعار إلى فواتير مبيعات فعلية ومردود أوامر الشراء.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Sales Quotes Funnel */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
              <h4 className="font-bold text-slate-800 text-sm flex items-center justify-between">
                <span>📋 عروض أسعار المبيعات للعملاء</span>
                <span className="text-xs bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-full font-mono">
                  {analyticsData.quotes.conversionRate.toFixed(1)}% نسبة التحويل
                </span>
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-200">
                  <span className="text-slate-600">إجمالي العروض الصادرة:</span>
                  <strong className="font-mono">{analyticsData.quotes.totalCount} عرض ({analyticsData.quotes.totalValue.toFixed(2)} {currencySymbol})</strong>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-200 text-emerald-700 font-bold">
                  <span>تم تحويلها لفواتير مبيعات:</span>
                  <span className="font-mono">{analyticsData.quotes.convertedCount} فاتورة ({analyticsData.quotes.convertedValue.toFixed(2)} {currencySymbol})</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-200 text-blue-700">
                  <span>عروض نشطة بانتظار موافقة العميل:</span>
                  <span className="font-mono font-bold">{analyticsData.quotes.activeCount} عرض</span>
                </div>
                <div className="flex justify-between py-1.5 text-slate-500">
                  <span>مسودات قيد الإعداد:</span>
                  <span className="font-mono">{analyticsData.quotes.draftCount} مسودة</span>
                </div>
              </div>
            </div>

            {/* Purchase Orders Funnel */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
              <h4 className="font-bold text-slate-800 text-sm flex items-center justify-between">
                <span>📦 أوامر شراء الموردين</span>
                <span className="text-xs bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full font-mono">
                  {analyticsData.orders.conversionRate.toFixed(1)}% نسبة التوريد
                </span>
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-200">
                  <span className="text-slate-600">إجمالي أوامر الشراء الصادرة:</span>
                  <strong className="font-mono">{analyticsData.orders.totalCount} أمر ({analyticsData.orders.totalValue.toFixed(2)} {currencySymbol})</strong>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-200 text-emerald-700 font-bold">
                  <span>تم توريدها وتحويلها لفواتير مشتريات:</span>
                  <span className="font-mono">{analyticsData.orders.convertedCount} فاتورة ({analyticsData.orders.convertedValue.toFixed(2)} {currencySymbol})</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-200 text-amber-700">
                  <span>أوامر شراء قيد الشحن والتوريد:</span>
                  <span className="font-mono font-bold">{analyticsData.orders.activeCount} أمر توريد</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 space-y-4">
          {/* Search, Status & Date Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            {/* Search Box */}
            <div className="sm:col-span-4 relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="🔍 بحث برقم المستند، الاسم، الهاتف، الصنف..."
                className="w-full pl-3 pr-9 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute left-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Status Filter */}
            <div className="sm:col-span-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700"
              >
                <option value="all">📌 جميع الحالات</option>
                <option value="online_order">🛍️ طلبيات الكتالوج الأونلاين فقط</option>
                <option value="active">⏳ ساري ونشط (بانتظار الاعتماد)</option>
                <option value="converted">✅ محول لفاتورة رسمية</option>
                <option value="draft">📝 مسودة قيد التجهيز</option>
                <option value="cancelled">🚫 ملغي / مرفوض</option>
              </select>
            </div>

            {/* Date Range Quick Selector */}
            <div className="sm:col-span-3">
              <select
                value={dateFilterRange}
                onChange={(e) => setDateFilterRange(e.target.value as any)}
                className="w-full p-2 border border-slate-300 rounded-xl text-xs text-slate-700 font-bold"
              >
                <option value="all">📅 كل الفترات</option>
                <option value="today">اليوم فقط</option>
                <option value="week">آخر 7 أيام</option>
                <option value="month">آخر 30 يوم</option>
                <option value="custom">فترة مخصصة...</option>
              </select>
            </div>

            {/* Sort Order */}
            <div className="sm:col-span-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full p-2 border border-slate-300 rounded-xl text-xs text-slate-700"
              >
                <option value="date_desc">الأحدث تاريخاً</option>
                <option value="date_asc">الأقدم تاريخاً</option>
                <option value="total_desc">القيمة: الأعلى</option>
                <option value="total_asc">القيمة: الأقل</option>
              </select>
            </div>
          </div>

          {/* Custom Date Range Row */}
          {dateFilterRange === 'custom' && (
            <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
              <span className="font-bold text-slate-700">تحديد الفترة:</span>
              <div className="flex items-center gap-1">
                <span>من:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="p-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
              <div className="flex items-center gap-1">
                <span>إلى:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="p-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
            </div>
          )}

          {/* Mobile Responsive Cards (< md) */}
          <div className="block md:hidden space-y-3">
            {filteredAndSortedList.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 text-center text-slate-400 border border-slate-200">
                <span className="text-3xl block mb-2">📭</span>
                <p className="font-bold text-sm text-slate-700">لا توجد مستندات مطابقة لمعايير البحث الحالية</p>
                <button
                  onClick={openCreateModal}
                  className="mt-3 w-full min-h-[44px] bg-[#1a237e] text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-xs"
                >
                  ➕ إنشاء مستند جديد الآن
                </button>
              </div>
            ) : (
              filteredAndSortedList.map((q) => {
                const isConverted = q.status === 'converted';
                const isDraft = q.status === 'draft';
                const isCancelled = q.status === 'cancelled';
                const isOnline = q.status === 'online_order' || q.source === 'online_catalog';
                const docCode = q.orderReference
                  ? q.orderReference
                  : q.type === 'sale_quote'
                  ? `QUO-${String(q.id).padStart(4, '0')}`
                  : `PO-${String(q.id).padStart(4, '0')}`;

                return (
                  <div
                    key={q.id}
                    className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-3 w-full max-w-full box-border"
                  >
                    {/* Card Header: Doc Number & Status */}
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-indigo-50 border border-indigo-200 text-indigo-900 font-mono font-bold px-2.5 py-1 rounded-lg text-xs">
                          {docCode}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500">{q.date}</span>
                      </div>
                      <div>
                        {isConverted ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[11px] px-2.5 py-0.5 rounded-full font-bold">
                            <span>✅</span>
                            <span>فاتورة #{q.convertedInvoiceId}</span>
                          </span>
                        ) : isOnline ? (
                          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-950 border border-amber-300 text-[11px] px-2.5 py-0.5 rounded-full font-black animate-pulse">
                            <span>🛍️</span>
                            <span>طلب كتالوج</span>
                          </span>
                        ) : isDraft ? (
                          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-[11px] px-2.5 py-0.5 rounded-full font-bold">
                            <span>📝</span>
                            <span>مسودة</span>
                          </span>
                        ) : isCancelled ? (
                          <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 text-[11px] px-2.5 py-0.5 rounded-full font-bold">
                            <span>🚫</span>
                            <span>ملغي</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-[11px] px-2.5 py-0.5 rounded-full font-bold">
                            <span>⏳</span>
                            <span>ساري</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Client / Supplier Info */}
                    <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100 space-y-1.5 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[11px] text-slate-400 block mb-0.5">
                            {activeTab === 'sale_quote' ? 'العميل المستهدف:' : 'المورد المعتمد:'}
                          </span>
                          <span className="font-bold text-slate-900 text-sm break-words">{q.clientName}</span>
                        </div>
                        {isOnline && (
                          <span className="bg-amber-400 text-slate-950 text-[10px] px-2 py-0.5 rounded-md font-black shrink-0">
                            متجر ذاتي
                          </span>
                        )}
                      </div>

                      {q.phone && (
                        <div className="flex items-center gap-1.5 text-slate-600 font-mono">
                          <span>📞</span>
                          <span dir="ltr">{q.phone}</span>
                        </div>
                      )}

                      {q.customerAddress && (
                        <div className="text-[11px] text-slate-500 break-words">
                          📍 {q.customerAddress}
                        </div>
                      )}
                    </div>

                    {/* Key Details Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 block">الإجمالي النهائي:</span>
                        <span className="font-mono font-bold text-emerald-700 text-sm">
                          {(q.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} {currencySymbol}
                        </span>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 block">الأصناف:</span>
                        <span className="font-bold text-slate-800">
                          {q.items?.length || 0} صنف
                        </span>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 block">المحرر / المندوب:</span>
                        <span className="font-semibold text-slate-700 truncate block">
                          {(q as any).salesRep || q.createdBy || (isOnline ? 'طلب متجر ذاتي' : 'مدير النظام')}
                        </span>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 block">الصلاحية حتى:</span>
                        <span className="font-mono font-bold text-rose-600 text-xs">
                          {q.validUntil || 'غير محدد'}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons Grid with 44px min-height */}
                    <div className="grid grid-cols-3 gap-1.5 pt-1">
                      <button
                        onClick={() => {
                          setSelectedQuote(q);
                          setActiveModal('view');
                        }}
                        className="min-h-[44px] bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-800 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1"
                      >
                        👁️ عرض
                      </button>
                      <button
                        onClick={() => openEditModal(q)}
                        className="min-h-[44px] bg-amber-50 hover:bg-amber-100 active:bg-amber-200 text-amber-900 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1"
                      >
                        ✏️ تعديل
                      </button>
                      <button
                        onClick={() => printQuotationWindow(q, appData, appData.settings, showToast)}
                        className="min-h-[44px] bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1"
                      >
                        🖨️ طباعة
                      </button>
                      {!isConverted && (
                        <button
                          onClick={() => {
                            setQuoteToConvert(q);
                            setConvertInvoiceType('nagdi');
                            setConvertPaymentMethod('drawer');
                            setActiveModal('convert');
                          }}
                          className="col-span-3 min-h-[44px] bg-[#2e7d32] hover:bg-[#1b5e20] active:bg-[#124116] text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1 shadow-xs"
                        >
                          ⚡ تحويل إلى فاتورة رسمية بنقرة واحدة
                        </button>
                      )}
                      <button
                        onClick={() => handleDuplicateQuote(q)}
                        className="min-h-[44px] bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1"
                      >
                        📑 نسخ
                      </button>
                      <button
                        onClick={() => {
                          setQuoteToDelete(q);
                          setActiveModal('delete');
                        }}
                        className="min-h-[44px] col-span-2 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1"
                      >
                        🗑️ حذف المستند
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Documents Table (Desktop >= md) */}
          <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-right text-xs md:text-sm">
              <thead className="bg-[#1a237e] text-white">
                <tr>
                  <th className="p-3"># الرقم</th>
                  <th className="p-3">التاريخ والصلاحية</th>
                  <th className="p-3">{activeTab === 'sale_quote' ? 'العميل المستهدف' : 'المورد المعتمد'}</th>
                  <th className="p-3">المندوب / المنشئ</th>
                  <th className="p-3">الأصناف</th>
                  <th className="p-3">الإجمالي النهائي</th>
                  <th className="p-3">الحالة</th>
                  <th className="p-3 text-center">الإجراءات والتحكم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAndSortedList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <span className="text-3xl">📭</span>
                        <p className="font-bold text-sm">لا توجد مستندات مطابقة لمعايير البحث الحالية</p>
                        <button
                          onClick={openCreateModal}
                          className="mt-1 bg-[#1a237e] text-white px-3.5 py-1.5 rounded-lg text-xs font-bold"
                        >
                          ➕ إنشاء مستند جديد الآن
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedList.map((q) => {
                    const isConverted = q.status === 'converted';
                    const isDraft = q.status === 'draft';
                    const isCancelled = q.status === 'cancelled';

                    return (
                      <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                        {/* Doc Number */}
                        <td className="p-3 font-mono font-bold text-indigo-900">
                          {q.orderReference ? (
                            <span className="bg-amber-50 border border-amber-300 text-amber-900 px-2 py-1 rounded-md text-xs">
                              {q.orderReference}
                            </span>
                          ) : (
                            <span className="bg-indigo-50 border border-indigo-200 px-2 py-1 rounded-md">
                              {q.type === 'sale_quote' ? `QUO-${String(q.id).padStart(4, '0')}` : `PO-${String(q.id).padStart(4, '0')}`}
                            </span>
                          )}
                        </td>

                        {/* Dates */}
                        <td className="p-3 text-xs">
                          <div className="font-mono font-bold text-slate-800">{q.date}</div>
                          {q.validUntil && (
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              صلاحية: <span className="font-mono text-rose-600 font-bold">{q.validUntil}</span>
                            </div>
                          )}
                        </td>

                        {/* Client / Supplier */}
                        <td className="p-3">
                          <div className="font-bold text-slate-900 flex items-center gap-1">
                            <span>{q.clientName}</span>
                            {(q.status === 'online_order' || q.source === 'online_catalog') && (
                              <span className="bg-amber-400 text-slate-950 text-[10px] px-1.5 py-0.2 rounded font-black">
                                متجر
                              </span>
                            )}
                          </div>
                          {q.phone && (
                            <div className="text-xs font-mono text-slate-500 flex items-center gap-1 mt-0.5">
                              <span>📞</span>
                              <span>{q.phone}</span>
                            </div>
                          )}
                          {q.customerAddress && (
                            <div className="text-[11px] text-slate-500 mt-0.5 truncate max-w-[200px]" title={q.customerAddress}>
                              📍 {q.customerAddress}
                            </div>
                          )}
                        </td>

                        {/* Rep / Creator */}
                        <td className="p-3 text-xs text-slate-600">
                          <div>{(q as any).salesRep || q.createdBy || (q.source === 'online_catalog' ? 'طلب متجر ذاتي' : 'مدير النظام')}</div>
                        </td>

                        {/* Items count */}
                        <td className="p-3 font-mono text-xs">
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-bold">
                            {q.items?.length || 0} صنف
                          </span>
                        </td>

                        {/* Total */}
                        <td className="p-3 font-mono font-bold text-emerald-700 text-sm">
                          {(q.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} {currencySymbol}
                        </td>

                        {/* Status Badge */}
                        <td className="p-3">
                          {isConverted ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[11px] px-2.5 py-1 rounded-full font-bold">
                              <span>✅</span>
                              <span>فاتورة #{q.convertedInvoiceId}</span>
                            </span>
                          ) : q.status === 'online_order' || q.source === 'online_catalog' ? (
                            <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-950 border border-amber-300 text-[11px] px-2.5 py-1 rounded-full font-black animate-pulse">
                              <span>🛍️</span>
                              <span>طلب كتالوج جديد</span>
                            </span>
                          ) : isDraft ? (
                            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-[11px] px-2.5 py-1 rounded-full font-bold">
                              <span>📝</span>
                              <span>مسودة</span>
                            </span>
                          ) : isCancelled ? (
                            <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 text-[11px] px-2.5 py-1 rounded-full font-bold">
                              <span>🚫</span>
                              <span>ملغي / مرفوض</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-[11px] px-2.5 py-1 rounded-full font-bold">
                              <span>⏳</span>
                              <span>ساري ونشط</span>
                            </span>
                          )}
                        </td>

                        {/* Interactive Actions */}
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            {/* View */}
                            <button
                              onClick={() => {
                                setSelectedQuote(q);
                                setActiveModal('view');
                              }}
                              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-800 p-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                              title="معاينة المستند"
                            >
                              👁️
                            </button>

                            {/* Edit */}
                            <button
                              onClick={() => openEditModal(q)}
                              className="bg-amber-50 hover:bg-amber-100 text-amber-900 p-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                              title="تعديل بيانات المستند والأصناف"
                            >
                              ✏️
                            </button>

                            {/* Print */}
                            <button
                              onClick={() => printQuotationWindow(q, appData, appData.settings, showToast)}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-800 p-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                              title="طباعة نموذج المستند الرسمي"
                            >
                              🖨️
                            </button>

                            {/* Convert to Invoice */}
                            {!isConverted && (
                              <button
                                onClick={() => {
                                  setQuoteToConvert(q);
                                  setConvertInvoiceType('nagdi');
                                  setConvertPaymentMethod('drawer');
                                  setActiveModal('convert');
                                }}
                                className="bg-[#2e7d32] hover:bg-[#1b5e20] text-white px-2 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-xs"
                                title="تحويل بنقرة واحدة إلى فاتورة رسمية معتمدة"
                              >
                                <span>⚡</span>
                                <span>تحويل</span>
                              </button>
                            )}

                            {/* Duplicate */}
                            <button
                              onClick={() => handleDuplicateQuote(q)}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                              title="استنساخ وتكرار المستند"
                            >
                              📑
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => {
                                setQuoteToDelete(q);
                                setActiveModal('delete');
                              }}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-700 p-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                              title="حذف المستند"
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
        </div>
      )}

      {/* 4. MODAL: Create / Edit Quotation or Purchase Order */}
      <Modal
        isOpen={activeModal === 'create' || activeModal === 'edit'}
        onClose={() => {
          setActiveModal(null);
          setSelectedQuote(null);
          setEditingQuoteId(null);
        }}
        title={
          editingQuoteId
            ? `✏️ تعديل ${activeTab === 'sale_quote' ? 'عرض السعر' : 'أمر الشراء'} #${editingQuoteId}`
            : `➕ إنشاء ${activeTab === 'sale_quote' ? 'عرض سعر مبيعات جديد' : 'أمر شراء توريد جديد'}`
        }
        footer={
          <div className="flex flex-wrap justify-between items-center w-full gap-3">
            <div className="font-mono text-xs sm:text-sm font-bold text-indigo-950">
              المجموع: {subtotal.toFixed(2)} | الخصم: {discountAmountCalc.toFixed(2)} | الإجمالي النهائي:{' '}
              <span className="text-emerald-700 text-base font-black">
                {grandTotal.toFixed(2)} {currencySymbol}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setActiveModal(null);
                  setSelectedQuote(null);
                  setEditingQuoteId(null);
                }}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                إلغاء
              </button>

              <button
                onClick={() => handleSaveQuotation(false, true)}
                className="bg-slate-700 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                💾 حفظ كمسودة
              </button>

              <button
                onClick={() => handleSaveQuotation(false, false)}
                className="bg-[#1a237e] hover:bg-[#0d1642] text-white px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-sm"
              >
                ✅ حفظ واعتماد
              </button>

              <button
                onClick={() => handleSaveQuotation(true, false)}
                className="bg-[#2e7d32] hover:bg-[#1b5e20] text-white px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-sm"
              >
                <span>🖨️</span>
                <span>حفظ وطباعة فورية</span>
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 text-xs md:text-sm max-h-[75vh] overflow-y-auto pr-1">
          {/* Section 1: Customer / Supplier & Dates */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
              <span>👤</span>
              <span>{activeTab === 'sale_quote' ? 'بيانات العميل والتواصل:' : 'بيانات المورد المعتمد:'}</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              {/* Party Autocomplete Input */}
              <div className="sm:col-span-5 relative">
                <label className="block font-bold text-slate-700 mb-1 text-xs">
                  {activeTab === 'sale_quote' ? 'اسم العميل *' : 'اسم المورد *'}
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => {
                    setClientName(e.target.value);
                    setShowPartyDropdown(true);
                  }}
                  onFocus={() => setShowPartyDropdown(true)}
                  placeholder="ابحث أو أدخل الاسم..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold bg-white text-xs"
                />

                {/* Dropdown Options */}
                {showPartyDropdown && (
                  <div className="absolute z-50 right-0 left-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-300 rounded-xl shadow-xl divide-y divide-slate-100">
                    {activeTab === 'sale_quote' ? (
                      filteredCustomers.length === 0 ? (
                        <div className="p-2 text-center text-slate-400 text-xs">لا يوجد عملاء مطابقين للبحث</div>
                      ) : (
                        filteredCustomers.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => handleSelectCustomer(c)}
                            className="p-2 hover:bg-indigo-50 cursor-pointer flex justify-between items-center text-xs"
                          >
                            <span className="font-bold text-slate-800">{c.name}</span>
                            <span className="text-slate-400 font-mono">{c.phone || '-'}</span>
                          </div>
                        ))
                      )
                    ) : (
                      filteredSuppliers.length === 0 ? (
                        <div className="p-2 text-center text-slate-400 text-xs">لا يوجد موردين مطابقين للبحث</div>
                      ) : (
                        filteredSuppliers.map((s) => (
                          <div
                            key={s.id}
                            onClick={() => handleSelectSupplier(s)}
                            className="p-2 hover:bg-indigo-50 cursor-pointer flex justify-between items-center text-xs"
                          >
                            <span className="font-bold text-slate-800">{s.name}</span>
                            <span className="text-slate-400 font-mono">{s.phone || '-'}</span>
                          </div>
                        ))
                      )
                    )}
                  </div>
                )}
              </div>

              {/* Phone */}
              <div className="sm:col-span-3">
                <label className="block font-bold text-slate-700 mb-1 text-xs">رقم الهاتف والتواصل</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="010..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-mono text-xs bg-white"
                />
              </div>

              {/* Sales Rep */}
              <div className="sm:col-span-4">
                <label className="block font-bold text-slate-700 mb-1 text-xs">المندوب / المنشئ</label>
                <input
                  type="text"
                  value={salesRep}
                  onChange={(e) => setSalesRep(e.target.value)}
                  placeholder="مسؤول المبيعات..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs bg-white"
                  list="salesRepList"
                />
                <datalist id="salesRepList">
                  {(appData.salesReps || []).map((r) => (
                    <option key={r.id} value={r.name} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Dates and Expiry Row */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
              <div className="sm:col-span-4">
                <label className="block font-bold text-slate-700 mb-1 text-xs">تاريخ تحرير المستند</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl font-mono text-xs bg-white"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="block font-bold text-slate-700 mb-1 text-xs">صلاحية العرض حتى تاريخ</label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl font-mono text-xs bg-white"
                />
              </div>

              {/* Quick Validity Buttons */}
              <div className="sm:col-span-4 flex items-end gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(date || new Date());
                    d.setDate(d.getDate() + 7);
                    setValidUntil(d.toISOString().split('T')[0]);
                  }}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 p-2 rounded-lg text-[11px] font-bold cursor-pointer"
                >
                  +7 أيام
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(date || new Date());
                    d.setDate(d.getDate() + 15);
                    setValidUntil(d.toISOString().split('T')[0]);
                  }}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 p-2 rounded-lg text-[11px] font-bold cursor-pointer"
                >
                  +15 يوم
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(date || new Date());
                    d.setDate(d.getDate() + 30);
                    setValidUntil(d.toISOString().split('T')[0]);
                  }}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 p-2 rounded-lg text-[11px] font-bold cursor-pointer"
                >
                  +30 يوم
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Fast Item Lookup & Insertion (Just like Sales & Purchases) */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <span>📦</span>
                <span>إضافة أصناف إلى جدول المستند:</span>
              </h4>

              {activeTab === 'sale_quote' && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-500 font-bold">تسعير الأصناف:</span>
                  <button
                    type="button"
                    onClick={() => setPricingType('cash')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      pricingType === 'cash' ? 'bg-[#1a237e] text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    💵 قطاعي / نقدي
                  </button>
                  <button
                    type="button"
                    onClick={() => setPricingType('wholesale')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      pricingType === 'wholesale' ? 'bg-[#1a237e] text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    🏢 سعر جملة
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
              {/* Item Autocomplete Search */}
              <div className="sm:col-span-5 relative">
                <label className="block font-bold text-slate-700 mb-1 text-xs">الصنف أو الباركود</label>
                <input
                  type="text"
                  value={itemSearchQuery}
                  onChange={(e) => {
                    setItemSearchQuery(e.target.value);
                    setShowItemDropdown(true);
                  }}
                  onFocus={() => setShowItemDropdown(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddItemToDoc();
                    }
                  }}
                  placeholder="ابحث بالاسم أو الباركود..."
                  className="w-full p-2 border border-slate-300 rounded-xl text-xs bg-white font-bold"
                />

                {/* Catalog Item Suggestions */}
                {showItemDropdown && (
                  <div className="absolute z-50 right-0 left-0 mt-1 max-h-52 overflow-y-auto bg-white border border-slate-300 rounded-xl shadow-xl divide-y divide-slate-100">
                    {filteredCatalogItems.length === 0 ? (
                      <div className="p-3 text-center text-slate-400 text-xs">لا توجد أصناف مطابقة</div>
                    ) : (
                      filteredCatalogItems.map((itm) => (
                        <div
                          key={itm.id}
                          onClick={() => handleSelectItem(itm)}
                          className="p-2 hover:bg-indigo-50 cursor-pointer flex justify-between items-center text-xs"
                        >
                          <div>
                            <div className="font-bold text-slate-800">{itm.name}</div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              كود: {itm.code || itm.id} | متوفر: <span className="font-bold text-emerald-700">{itm.quantity || 0}</span> {itm.unit || 'قطعة'}
                            </div>
                          </div>
                          <div className="text-left font-mono font-bold text-indigo-900">
                            {activeTab === 'sale_quote' ? (itm.salePrice || 0).toFixed(2) : (itm.purchasePrice || 0).toFixed(2)} {currencySymbol}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Quantity */}
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1 text-xs">الكمية</label>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setDraftQty((prev) => Math.max(1, (parseFloat(prev) || 1) - 1).toString())}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-2 py-2 rounded-r-lg font-bold text-xs"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={draftQty}
                    onChange={(e) => setDraftQty(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddItemToDoc();
                      }
                    }}
                    className="w-full p-2 border-y border-slate-300 text-center font-mono font-bold text-xs bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setDraftQty((prev) => ((parseFloat(prev) || 0) + 1).toString())}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-2 py-2 rounded-l-lg font-bold text-xs"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Unit Price */}
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1 text-xs">سعر الوحدة</label>
                <input
                  type="number"
                  min="0"
                  value={draftPrice}
                  onChange={(e) => setDraftPrice(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddItemToDoc();
                    }
                  }}
                  className="w-full p-2 border border-slate-300 rounded-xl font-mono font-bold text-center text-xs bg-white"
                />
              </div>

              {/* Item Notes / Specs */}
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1 text-xs">مواصفات / بيان</label>
                <input
                  type="text"
                  value={draftItemNote}
                  onChange={(e) => setDraftItemNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddItemToDoc();
                    }
                  }}
                  placeholder="اختياري..."
                  className="w-full p-2 border border-slate-300 rounded-xl text-xs bg-white"
                />
              </div>

              {/* Add Button */}
              <div className="sm:col-span-1">
                <button
                  type="button"
                  onClick={handleAddItemToDoc}
                  className="w-full bg-[#1a237e] hover:bg-[#0d47a1] text-white p-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
                  title="إضافة الصنف للمستند (Enter)"
                >
                  ➕
                </button>
              </div>
            </div>
          </div>

          {/* Section 3: Interactive Items (Directly Editable) */}
          {/* Mobile Cards for Added Items (< md) */}
          <div className="block md:hidden space-y-2">
            {items.length === 0 ? (
              <div className="p-4 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs">
                لم يتم إضافة أصناف إلى المستند بعد. استخدم الصندوق أعلاه لإضافة الأصناف.
              </div>
            ) : (
              items.map((it, idx) => (
                <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-900 text-xs">{it.name}</div>
                      {it.notes && <div className="text-[11px] text-slate-500 mt-0.5">{it.notes}</div>}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="text-rose-600 hover:text-rose-800 p-1 rounded-lg text-sm font-bold cursor-pointer"
                      title="حذف هذا الصنف"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5 font-bold">الكمية</label>
                      <input
                        type="number"
                        min="1"
                        value={it.qty}
                        onChange={(e) => handleUpdateItemQty(idx, e.target.value)}
                        className="w-full p-1.5 border border-slate-300 rounded-lg text-center font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5 font-bold">السعر (ج.م)</label>
                      <input
                        type="number"
                        min="0"
                        value={it.price}
                        onChange={(e) => handleUpdateItemPrice(idx, e.target.value)}
                        className="w-full p-1.5 border border-slate-300 rounded-lg text-center font-mono font-bold text-indigo-900"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5 font-bold">الإجمالي</label>
                      <div className="p-1.5 bg-white border border-slate-200 rounded-lg text-center font-mono font-bold text-emerald-700">
                        {(it.total || it.qty * it.price).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table (>= md) */}
          <div className="hidden md:block border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-800">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">الصنف والمواصفات</th>
                  <th className="p-3 text-center" style={{ width: '110px' }}>الكمية</th>
                  <th className="p-3 text-center" style={{ width: '130px' }}>السعر (ج.م)</th>
                  <th className="p-3 text-center">الإجمالي</th>
                  <th className="p-3 text-center">حذف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-400">
                      لم يتم إضافة أصناف إلى المستند بعد. استخدم الصندوق أعلاه لإضافة الأصناف.
                    </td>
                  </tr>
                ) : (
                  items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-slate-500">{idx + 1}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{it.name}</div>
                        {it.notes && <div className="text-[11px] text-slate-400 mt-0.5">{it.notes}</div>}
                      </td>
                      <td className="p-2 text-center">
                        <input
                          type="number"
                          min="1"
                          value={it.qty}
                          onChange={(e) => handleUpdateItemQty(idx, e.target.value)}
                          className="w-20 p-1 border border-slate-300 rounded-lg text-center font-mono font-bold text-xs"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <input
                          type="number"
                          min="0"
                          value={it.price}
                          onChange={(e) => handleUpdateItemPrice(idx, e.target.value)}
                          className="w-24 p-1 border border-slate-300 rounded-lg text-center font-mono font-bold text-xs text-indigo-900"
                        />
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-emerald-700">
                        {(it.total || it.qty * it.price).toFixed(2)}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-rose-600 hover:text-rose-800 font-bold text-sm cursor-pointer p-1"
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

          {/* Section 4: Discount, Tax, Extra Fees, & Final Financials */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            {/* Discount */}
            <div className="sm:col-span-3">
              <label className="block font-bold text-slate-700 mb-1 text-xs">الخصم الإجمالي</label>
              <div className="flex">
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as any)}
                  className="bg-slate-200 border-y border-r border-slate-300 rounded-r-lg px-2 text-xs font-bold text-slate-700"
                >
                  <option value="amount">مبلغ (ج.م)</option>
                  <option value="percent">نسبة (%)</option>
                </select>
                <input
                  type="number"
                  min="0"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-l-lg font-mono text-center text-xs bg-white font-bold"
                />
              </div>
            </div>

            {/* VAT Tax */}
            <div className="sm:col-span-3">
              <label className="block font-bold text-slate-700 mb-1 text-xs">ضريبة القيمة المضافة (%)</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  value={taxPercent}
                  onChange={(e) => setTaxPercent(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono text-center text-xs bg-white font-bold"
                />
                <button
                  type="button"
                  onClick={() => setTaxPercent('14')}
                  className="bg-slate-200 hover:bg-slate-300 px-2 py-2 rounded-lg text-[10px] font-bold text-slate-700"
                >
                  14%
                </button>
                <button
                  type="button"
                  onClick={() => setTaxPercent('0')}
                  className="bg-slate-200 hover:bg-slate-300 px-2 py-2 rounded-lg text-[10px] font-bold text-slate-700"
                >
                  إعفاء
                </button>
              </div>
            </div>

            {/* Extra Fees / Shipping */}
            <div className="sm:col-span-3">
              <label className="block font-bold text-slate-700 mb-1 text-xs">مصاريف نقل / شحن (ج.م)</label>
              <input
                type="number"
                min="0"
                value={shippingFees}
                onChange={(e) => setShippingFees(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg font-mono text-center text-xs bg-white"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block font-bold text-slate-700 mb-1 text-xs">بيان المصاريف الإضافية</label>
              <input
                type="text"
                value={feeDescription}
                onChange={(e) => setFeeDescription(e.target.value)}
                placeholder="شحن / تركيب..."
                className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white"
              />
            </div>
          </div>

          {/* Section 5: Tafqeet & Terms Presets */}
          <div className="bg-indigo-50/50 p-3.5 rounded-2xl border border-indigo-100 space-y-3">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <span className="font-bold text-indigo-950 text-xs">المبلغ الإجمالي كتابة (التفقيط):</span>
              <span className="font-bold text-indigo-900 text-xs font-serif bg-white px-3 py-1 rounded-lg border border-indigo-200">
                {grandTotalTafqeet}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block font-bold text-slate-700 mb-1 text-xs">شروط الدفع المقترحة</label>
                <input
                  type="text"
                  value={paymentTermsPreset}
                  onChange={(e) => setPaymentTermsPreset(e.target.value)}
                  placeholder="مثال: 50% دفعة مقدمة والباقي عند التسليم..."
                  className="w-full p-2 border border-slate-300 rounded-xl text-xs bg-white"
                  list="paymentTermsList"
                />
                <datalist id="paymentTermsList">
                  <option value="نقداً عند التسليم والفحص" />
                  <option value="آجل 30 يوم من تاريخ الفاتورة" />
                  <option value="دفعة 50% مقدم والباقي عند الاستلام" />
                  <option value="تحويل بنكي مسبق قبل الشحن" />
                </datalist>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 text-xs">شروط التسليم والتوريد</label>
                <input
                  type="text"
                  value={deliveryTermsPreset}
                  onChange={(e) => setDeliveryTermsPreset(e.target.value)}
                  placeholder="مثال: تسليم مخازن الشركة خلال 48 ساعة..."
                  className="w-full p-2 border border-slate-300 rounded-xl text-xs bg-white"
                  list="deliveryTermsList"
                />
                <datalist id="deliveryTermsList">
                  <option value="تسليم مخازن الشركة فوراً" />
                  <option value="شامل الشحن والتوصيل لموقع العميل" />
                  <option value="التوريد خلال 3 إلى 5 أيام عمل" />
                </datalist>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1 text-xs">ملاحظات عامة وبنود إضافية</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="أدخل أي بنود أو شروط إضافية تظهر في تذييل المستند المطبوع..."
                className="w-full p-2 border border-slate-300 rounded-xl text-xs bg-white"
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* 5. MODAL: View Quotation / Order Details */}
      <Modal
        isOpen={activeModal === 'view' && !!selectedQuote}
        onClose={() => {
          setActiveModal(null);
          setSelectedQuote(null);
        }}
        title={`📄 تفاصيل المستند #${selectedQuote?.id || ''}`}
        footer={
          <div className="flex flex-wrap justify-between items-center w-full gap-2">
            {selectedQuote && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => printQuotationWindow(selectedQuote, appData, appData.settings, showToast)}
                  className="bg-[#1a237e] hover:bg-[#0d1642] text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span>🖨️</span>
                  <span>طباعة المستند الرسمي</span>
                </button>

                {selectedQuote.status !== 'converted' && (
                  <button
                    onClick={() => {
                      setQuoteToConvert(selectedQuote);
                      setActiveModal('convert');
                    }}
                    className="bg-[#2e7d32] hover:bg-[#1b5e20] text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>⚡</span>
                    <span>تحويل لفاتورة رسمية</span>
                  </button>
                )}
              </div>
            )}

            <button
              onClick={() => {
                setActiveModal(null);
                setSelectedQuote(null);
              }}
              className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        }
      >
        {selectedQuote && (
          <div className="space-y-4 text-xs md:text-sm">
            {/* Header Box */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <div>
                <span className="text-slate-500 block text-[11px]">الجهة / الطرف:</span>
                <strong className="text-slate-900 text-sm">{selectedQuote.clientName}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">رقم الهاتف:</span>
                <span className="font-mono font-bold text-slate-800">{selectedQuote.phone || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">تاريخ التحرير:</span>
                <span className="font-mono font-bold text-slate-800">{selectedQuote.date}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">صلاحية المستند:</span>
                <span className="font-mono font-bold text-rose-600">{selectedQuote.validUntil || 'حسب الاتفاق'}</span>
              </div>
            </div>

            {/* Items Table */}
            {/* Mobile Cards for Items (< md) */}
            <div className="block md:hidden space-y-2">
              {selectedQuote.items?.map((it, idx) => (
                <div key={idx} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-bold text-slate-900 block truncate">{it.name}</span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      الكمية: {it.qty} × {(it.price || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="font-mono font-bold text-emerald-700 text-xs shrink-0">
                    {(it.total || it.qty * it.price).toFixed(2)} {currencySymbol}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table (>= md) */}
            <div className="hidden md:block border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-right text-xs">
                <thead className="bg-[#1a237e] text-white">
                  <tr>
                    <th className="p-2.5">#</th>
                    <th className="p-2.5">الصنف</th>
                    <th className="p-2.5 text-center">الكمية</th>
                    <th className="p-2.5 text-center">سعر الوحدة</th>
                    <th className="p-2.5 text-center">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedQuote.items?.map((it, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2.5 font-mono">{idx + 1}</td>
                      <td className="p-2.5 font-bold text-slate-900">{it.name}</td>
                      <td className="p-2.5 text-center font-mono font-bold">{it.qty}</td>
                      <td className="p-2.5 text-center font-mono">{(it.price || 0).toFixed(2)}</td>
                      <td className="p-2.5 text-center font-mono font-bold text-emerald-700">
                        {(it.total || it.qty * it.price).toFixed(2)} {currencySymbol}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financials Breakdown */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-wrap justify-between items-start text-xs gap-3">
              <div className="space-y-1.5 flex-1">
                {selectedQuote.notes && (
                  <div>
                    <strong className="text-slate-700">الشروط والملحوظات:</strong>
                    <div className="text-slate-600 whitespace-pre-line mt-1 bg-white p-2.5 rounded-xl border border-slate-200">
                      {selectedQuote.notes}
                    </div>
                  </div>
                )}
                <div className="text-[11px] text-slate-500 pt-1">
                  أنشئ بواسطة: <strong>{selectedQuote.createdBy}</strong>
                </div>
              </div>

              <div className="text-left font-mono space-y-1 min-w-[220px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">المجموع الفرعي:</span>
                  <strong>{selectedQuote.subtotal?.toFixed(2)} {currencySymbol}</strong>
                </div>
                {selectedQuote.discount > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>الخصم:</span>
                    <span>- {selectedQuote.discount.toFixed(2)} {currencySymbol}</span>
                  </div>
                )}
                {selectedQuote.tax > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>الضريبة ({selectedQuote.tax}%):</span>
                    <span>+{(((selectedQuote.subtotal - selectedQuote.discount) * selectedQuote.tax) / 100).toFixed(2)} {currencySymbol}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-[#1a237e] pt-2 border-t border-slate-300">
                  <span>الإجمالي النهائي:</span>
                  <span>{selectedQuote.total?.toFixed(2)} {currencySymbol}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* 6. MODAL: Convert Quotation / Order to Official Invoice */}
      <Modal
        isOpen={activeModal === 'convert' && !!quoteToConvert}
        onClose={() => {
          setActiveModal(null);
          setQuoteToConvert(null);
        }}
        title={`⚡ تحويل ${quoteToConvert?.type === 'sale_quote' ? 'عرض السعر' : 'أمر الشراء'} #${quoteToConvert?.id || ''} إلى فاتورة معتمدة`}
        footer={
          <div className="flex justify-between items-center w-full">
            <button
              onClick={() => {
                setActiveModal(null);
                setQuoteToConvert(null);
              }}
              className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              إلغاء
            </button>
            <button
              onClick={handleExecuteConversion}
              className="bg-[#2e7d32] hover:bg-[#1b5e20] text-white px-5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <span>✅</span>
              <span>تأكيد التحويل وترحيل القيود والمخزن فوراً</span>
            </button>
          </div>
        }
      >
        {quoteToConvert && (
          <div className="space-y-4 text-xs md:text-sm">
            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 text-emerald-900 space-y-2">
              <h4 className="font-bold text-sm flex items-center gap-1.5">
                <span>⚡</span>
                <span>
                  {quoteToConvert.type === 'sale_quote'
                    ? 'سيتم تحويل هذا العرض إلى فاتورة مبيعات رسمية وخصم الكميات من المخزن'
                    : 'سيتم تحويل أمر الشراء إلى فاتورة مشتريات رسمية وإضافة الكميات للمخزن'}
                </span>
              </h4>
              <p className="text-xs text-emerald-800">
                الطرف: <strong>{quoteToConvert.clientName}</strong> | القيمة الإجمالية:{' '}
                <strong className="font-mono">{quoteToConvert.total.toFixed(2)} {currencySymbol}</strong>
              </p>
            </div>

            {/* Payment & Invoice Type Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1 text-xs">نوع الفاتورة الناتجة</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setConvertInvoiceType('nagdi')}
                    className={`p-2.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1 ${
                      convertInvoiceType === 'nagdi'
                        ? 'bg-[#1a237e] text-white border-[#1a237e] shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    💵 فاتورة نقدية (مدفوعة)
                  </button>
                  <button
                    type="button"
                    onClick={() => setConvertInvoiceType('ajel')}
                    className={`p-2.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1 ${
                      convertInvoiceType === 'ajel'
                        ? 'bg-[#1a237e] text-white border-[#1a237e] shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    📋 فاتورة آجلة (على الحساب)
                  </button>
                </div>
              </div>

              {convertInvoiceType === 'nagdi' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1 text-xs">وسيلة الدفع / الخزينة المستلمة</label>
                  <select
                    value={convertPaymentMethod}
                    onChange={(e) => setConvertPaymentMethod(e.target.value as any)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold bg-white"
                  >
                    <option value="drawer">الدرج (الخزينة الرئيسية)</option>
                    <option value="vodafone">فودافون كاش / محفظة</option>
                    <option value="instapay">إنستاباي (InstaPay)</option>
                    <option value="bank">الحساب البنكي</option>
                  </select>
                </div>
              )}
            </div>

            {/* Items Overview */}
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
              <div className="font-bold text-slate-800 text-xs">الأصناف المراد ترحيلها ({quoteToConvert.items?.length} صنف):</div>
              <ul className="divide-y divide-slate-200 text-xs font-mono">
                {quoteToConvert.items?.map((it, idx) => (
                  <li key={idx} className="py-1 flex justify-between">
                    <span>{it.name} (الكمية: {it.qty})</span>
                    <span className="font-bold text-emerald-700">{(it.total || it.qty * it.price).toFixed(2)} {currencySymbol}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Modal>

      {/* 7. MODAL: Delete Quotation / Order */}
      <Modal
        isOpen={activeModal === 'delete' && !!quoteToDelete}
        onClose={() => {
          setActiveModal(null);
          setQuoteToDelete(null);
        }}
        title={`🗑️ تأكيد حذف المستند #${quoteToDelete?.id || ''}`}
        footer={
          <div className="flex justify-between items-center w-full">
            <button
              onClick={() => {
                setActiveModal(null);
                setQuoteToDelete(null);
              }}
              className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              تراجع
            </button>
            <button
              onClick={handleDeleteConfirm}
              className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <span>🗑️</span>
              <span>نعم، حذف المستند نهائياً</span>
            </button>
          </div>
        }
      >
        {quoteToDelete && (
          <div className="space-y-3 text-xs md:text-sm">
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 space-y-1">
              <p className="font-bold text-sm">هل أنت متأكد من رغبتك في حذف هذا المستند؟</p>
              <p className="text-xs">
                المستند: <strong>{quoteToDelete.type === 'sale_quote' ? 'عرض سعر' : 'أمر شراء'} #{quoteToDelete.id}</strong> | الطرف:{' '}
                <strong>{quoteToDelete.clientName}</strong> | القيمة: <strong>{quoteToDelete.total?.toFixed(2)} {currencySymbol}</strong>
              </p>
            </div>
            {quoteToDelete.status === 'converted' && (
              <p className="text-amber-700 text-xs bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                ⚠️ تنبيه: هذا المستند تم تحويله سابقاً إلى فاتورة معتمدة (#{quoteToDelete.convertedInvoiceId}). لن يتم حذف الفاتورة الناتجة.
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
