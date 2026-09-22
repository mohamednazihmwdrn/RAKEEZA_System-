import React, { useState, useMemo, useEffect } from 'react';
import { AppData, Quotation, SaleInvoice, InvoiceItem, TenantCompany, CatalogConfig } from '../types';
import { addAuditLog } from '../utils/storage';
import { printWebOrderReceipt } from '../utils/printOrderReceipt';
import { openUnifiedPrintWindow } from '../utils/printUnified';
import { exportToExcel } from '../utils/excelExport';
import { playOrderAlertChime } from '../utils/audioChime';
import { DEFAULT_COMPANIES } from '../utils/multiTenantService';
import { TableActionButtons } from './TableActionButtons';

interface WebOrdersInboxViewProps {
  appData: AppData;
  onUpdateData: (newData: AppData) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onNavigateToSales?: () => void;
  onInspectItem?: (type: string, data: any) => void;
  userCompanyId?: string;
  isOwner?: boolean;
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  new: 'جديد / بانتظار التأكيد',
  processing: 'قيد التجهيز في المخزن',
  shipped: 'قيد التوصيل والشحن',
  delivered: 'تم التسليم للعميل',
  cancelled: 'تم إلغاء الطلب',
  converted: 'تم تحويله لفاتورة مبيعات',
};

export const WebOrdersInboxView: React.FC<WebOrdersInboxViewProps> = ({
  appData,
  onUpdateData,
  showToast,
  onNavigateToSales,
  onInspectItem,
  userCompanyId: propUserCompanyId,
  isOwner: propIsOwner,
}) => {
  const companies: TenantCompany[] = useMemo(() => {
    return appData.companies && appData.companies.length > 0 ? appData.companies : DEFAULT_COMPANIES;
  }, [appData.companies]);

  const currentUser = useMemo(() => {
    return appData.users.find((u) => u.id === appData.currentUser) || appData.users[0];
  }, [appData.users, appData.currentUser]);

  const isOwner =
    propIsOwner !== undefined
      ? propIsOwner
      : (currentUser?.role === 'owner' || appData.isOwnerAuthenticated);

  const userCompanyId =
    propUserCompanyId ||
    currentUser?.companyId ||
    appData.companyId ||
    companies[0]?.id ||
    'COMP-000001';

  // Selected company filter: Non-owners are strictly locked to their own company
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(() => {
    if (!isOwner) return userCompanyId;
    return appData.companyId && appData.companyId !== 'all' ? appData.companyId : 'all';
  });

  // Keep selectedCompanyId in sync when user switches company or prop changes
  useEffect(() => {
    if (!isOwner) {
      setSelectedCompanyId(userCompanyId);
    } else if (appData.companyId && appData.companyId !== 'all') {
      setSelectedCompanyId(appData.companyId);
    }
  }, [isOwner, userCompanyId, appData.companyId]);

  const activeCompany = useMemo(() => {
    if (selectedCompanyId === 'all') return companies[0];
    return (
      companies.find(
        (c) => c.id === selectedCompanyId || c.code === selectedCompanyId || c.tenantId === selectedCompanyId
      ) || companies[0]
    );
  }, [companies, selectedCompanyId]);

  // Filter status tab
  const [activeTab, setActiveTab] = useState<
    'all' | 'new' | 'processing' | 'shipped' | 'delivered' | 'converted' | 'cancelled'
  >('all');

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Quotation | null>(null);

  // Auto-Print & Sound preferences stored in catalogConfig
  const config = useMemo<CatalogConfig>(() => {
    const tenantConfig = appData.companyCatalogConfigs?.[activeCompany.id];
    return (
      tenantConfig ||
      activeCompany.catalogConfig ||
      appData.catalogConfig || {
        enabled: true,
        autoPrintOrders: false,
        printFormat: '80mm' as const,
        soundAlertEnabled: true,
      }
    );
  }, [appData.companyCatalogConfigs, activeCompany, appData.catalogConfig]);

  const autoPrintEnabled = config.autoPrintOrders ?? false;
  const printFormat: '80mm' | 'a4' = (config.printFormat as '80mm' | 'a4') || '80mm';
  const soundEnabled = config.soundAlertEnabled ?? true;

  // Toggle Auto-Print
  const handleToggleAutoPrint = () => {
    const nextVal = !autoPrintEnabled;
    const updatedCompanyConfigs = {
      ...(appData.companyCatalogConfigs || {}),
      [activeCompany.id]: {
        ...config,
        autoPrintOrders: nextVal,
      },
    };
    const updatedData: AppData = {
      ...appData,
      companyCatalogConfigs: updatedCompanyConfigs,
      catalogConfig: {
        ...config,
        autoPrintOrders: nextVal,
      },
    };
    onUpdateData(updatedData);
    showToast(
      nextVal
        ? `🖨️ تم تفعيل الطباعة الفورية التلقائية للطلبات الجديدة لشركة (${activeCompany.name})`
        : `تم تعطيل الطباعة الفورية لشركة (${activeCompany.name})`,
      nextVal ? 'success' : 'info'
    );
  };

  // Toggle Sound Alert
  const handleToggleSound = () => {
    const nextVal = !soundEnabled;
    const updatedCompanyConfigs = {
      ...(appData.companyCatalogConfigs || {}),
      [activeCompany.id]: {
        ...config,
        soundAlertEnabled: nextVal,
      },
    };
    const updatedData: AppData = {
      ...appData,
      companyCatalogConfigs: updatedCompanyConfigs,
      catalogConfig: {
        ...config,
        soundAlertEnabled: nextVal,
      },
    };
    onUpdateData(updatedData);
    showToast(
      nextVal ? '🔔 تم تفعيل رنين التنبيه الصوتي للطلبات الجديدة' : 'تم كتم التنبيه الصوتي',
      nextVal ? 'success' : 'info'
    );
  };

  // Change Print Format
  const handleChangePrintFormat = (fmt: '80mm' | 'a4') => {
    const updatedCompanyConfigs = {
      ...(appData.companyCatalogConfigs || {}),
      [activeCompany.id]: {
        ...config,
        printFormat: fmt,
      },
    };
    const updatedData: AppData = {
      ...appData,
      companyCatalogConfigs: updatedCompanyConfigs,
      catalogConfig: {
        ...config,
        printFormat: fmt,
      },
    };
    onUpdateData(updatedData);
    showToast(
      fmt === '80mm' ? 'تم اختيار طابعة الفواتير الحرارية (80mm Thermal Slip)' : 'تم اختيار نموذج A4',
      'info'
    );
  };

  // Filter web orders
  const webOrders = useMemo(() => {
    const quotes = appData.quotations || [];
    // Only orders from catalog / online store
    let list = quotes.filter(
      (q) =>
        q.source === 'online_catalog' ||
        q.status === 'online_order' ||
        (q.orderReference && q.orderReference.startsWith('ORD-'))
    );

    // Strict Company filter
    if (selectedCompanyId !== 'all') {
      const currentTargetCompany = companies.find(
        (c) => c.id === selectedCompanyId || c.code === selectedCompanyId || c.tenantId === selectedCompanyId
      );
      const matchedIds = new Set<string>(
        [
          selectedCompanyId,
          currentTargetCompany?.id || '',
          currentTargetCompany?.code || '',
          currentTargetCompany?.tenantId || '',
        ].filter(Boolean)
      );

      list = list.filter((q) => {
        if (q.companyId) {
          return matchedIds.has(q.companyId);
        }
        return matchedIds.has(companies[0]?.id) || matchedIds.has('COMP-000001');
      });
    }

    // Status filter
    if (activeTab === 'new') {
      list = list.filter((q) => q.status === 'online_order' || q.orderStatus === 'new');
    } else if (activeTab === 'processing') {
      list = list.filter((q) => q.orderStatus === 'processing');
    } else if (activeTab === 'shipped') {
      list = list.filter((q) => q.orderStatus === 'shipped');
    } else if (activeTab === 'delivered') {
      list = list.filter((q) => q.orderStatus === 'delivered');
    } else if (activeTab === 'converted') {
      list = list.filter((q) => q.status === 'converted' || q.convertedInvoiceId);
    } else if (activeTab === 'cancelled') {
      list = list.filter((q) => q.status === 'cancelled' || q.orderStatus === 'cancelled');
    }

    // Search query
    const q = searchTerm.toLowerCase().trim();
    if (q) {
      list = list.filter(
        (o) =>
          o.orderReference?.toLowerCase().includes(q) ||
          o.clientName?.toLowerCase().includes(q) ||
          o.phone?.includes(q) ||
          o.customerAddress?.toLowerCase().includes(q)
      );
    }

    // Sort newest first
    return list.sort((a, b) => {
      const timeA = new Date(a.date + ' ' + (a.time || '00:00')).getTime() || Number(a.id) || 0;
      const timeB = new Date(b.date + ' ' + (b.time || '00:00')).getTime() || Number(b.id) || 0;
      return timeB - timeA;
    });
  }, [appData.quotations, selectedCompanyId, activeTab, searchTerm, companies]);

  // Counts for tabs
  const tabCounts = useMemo(() => {
    const allQuotes = (appData.quotations || []).filter(
      (q) =>
        q.source === 'online_catalog' ||
        q.status === 'online_order' ||
        (q.orderReference && q.orderReference.startsWith('ORD-'))
    );

    const scoped =
      selectedCompanyId === 'all'
        ? allQuotes
        : allQuotes.filter((q) => {
            const currentTargetCompany = companies.find(
              (c) => c.id === selectedCompanyId || c.code === selectedCompanyId || c.tenantId === selectedCompanyId
            );
            const matchedIds = new Set<string>(
              [
                selectedCompanyId,
                currentTargetCompany?.id || '',
                currentTargetCompany?.code || '',
                currentTargetCompany?.tenantId || '',
              ].filter(Boolean)
            );
            if (q.companyId) {
              return matchedIds.has(q.companyId);
            }
            return matchedIds.has(companies[0]?.id) || matchedIds.has('COMP-000001');
          });

    return {
      all: scoped.length,
      new: scoped.filter((q) => q.status === 'online_order' || q.orderStatus === 'new').length,
      processing: scoped.filter((q) => q.orderStatus === 'processing').length,
      shipped: scoped.filter((q) => q.orderStatus === 'shipped').length,
      delivered: scoped.filter((q) => q.orderStatus === 'delivered').length,
      converted: scoped.filter((q) => q.status === 'converted' || q.convertedInvoiceId).length,
      cancelled: scoped.filter((q) => q.status === 'cancelled' || q.orderStatus === 'cancelled').length,
    };
  }, [appData.quotations, selectedCompanyId, companies]);

  // Update order status
  const handleUpdateOrderStatus = (
    orderId: number,
    newStatus: 'new' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  ) => {
    const updatedQuotes = (appData.quotations || []).map((q) => {
      if (q.id === orderId) {
        return {
          ...q,
          orderStatus: newStatus,
          status: newStatus === 'cancelled' ? 'cancelled' : q.status,
        };
      }
      return q;
    });

    const statusLabels: Record<string, string> = {
      new: 'جديد / بانتظار التأكيد',
      processing: 'قيد التجهيز في المخزن',
      shipped: 'قيد التوصيل والشحن',
      delivered: 'تم التسليم للعميل',
      cancelled: 'تم إلغاء الطلب',
    };

    let updatedData = { ...appData, quotations: updatedQuotes };
    updatedData = addAuditLog(
      updatedData,
      'update',
      'طلبات الويب سايت',
      `تحديث حالة الطلب #${orderId} إلى: ${statusLabels[newStatus]}`
    );
    onUpdateData(updatedData);
    showToast(`تم تحديث حالة الطلب إلى: ${statusLabels[newStatus]}`, 'success');
  };

  // Convert Web Order to Official Sale Invoice
  const handleConvertToInvoice = (order: Quotation) => {
    if (order.status === 'converted' || order.convertedInvoiceId) {
      showToast('تم تحويل هذا الطلب إلى فاتورة مبيعات مسبقاً', 'info');
      return;
    }

    if (!window.confirm(`هل ترغب في تحويل الطلب #${order.orderReference || order.id} إلى فاتورة مبيعات نقدية رسمية وخصم الكميات من المخزون؟`)) {
      return;
    }

    try {
      const nextInvId = appData.nextInvoiceNumber || (appData.salesInvoices?.length || 0) + 1;
      const today = new Date().toISOString().split('T')[0];
      const nowTime = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

      // Create official sale invoice
      const newInvoice: SaleInvoice = {
        id: nextInvId,
        customerName: order.clientName || 'عميل المتجر الإلكتروني',
        phone: order.phone,
        customerAddress: order.customerAddress,
        notes: `فاتورة مبيعات تم إنشاؤها آلياً من طلب الويب سايت #${order.orderReference || order.id}. ${
          order.deliveryNotes || ''
        }`,
        date: today,
        time: nowTime,
        items: [...(order.items || [])],
        subtotal: order.subtotal || order.total,
        discount: order.discount || 0,
        tax: order.tax || 0,
        fees: 0,
        total: order.total,
        paymentMethod: 'drawer',
        type: 'nagdi',
        paidAmount: order.total,
        remainingAmount: 0,
        createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
        createdBy: 'النظام (تحويل طلب أونلاين)',
        companyId: order.companyId,
        status: 'approved',
      };

      // Deduct inventory
      const updatedItems = [...appData.items].map((invItem) => {
        const orderLine = order.items.find((line) => line.itemId === invItem.id || line.name === invItem.name);
        if (orderLine) {
          const newQty = Math.max(0, (invItem.quantity || 0) - (orderLine.qty || 0));
          return {
            ...invItem,
            quantity: newQty,
          };
        }
        return invItem;
      });

      // Update cash drawer
      const newCashBox = {
        ...appData.cashBox,
        drawer: (appData.cashBox?.drawer || 0) + order.total,
      };

      // Mark order as converted
      const updatedQuotes = (appData.quotations || []).map((q) => {
        if (q.id === order.id) {
          return {
            ...q,
            status: 'converted' as const,
            orderStatus: 'converted' as const,
            convertedInvoiceId: nextInvId,
          };
        }
        return q;
      });

      let updatedData: AppData = {
        ...appData,
        salesInvoices: [newInvoice, ...(appData.salesInvoices || [])],
        nextInvoiceNumber: nextInvId + 1,
        items: updatedItems,
        cashBox: newCashBox,
        quotations: updatedQuotes,
      };

      updatedData = addAuditLog(
        updatedData,
        'create',
        'المبيعات والفواتير',
        `تحويل طلب الويب سايت #${order.orderReference || order.id} إلى فاتورة مبيعات رقم #${nextInvId} بقيمة ${order.total} ج.م مع خصم المخزون وتحديث الخزينة`
      );

      onUpdateData(updatedData);
      showToast(
        `🎉 تم تحويل الطلب بنجاح إلى فاتورة مبيعات معتمدة رقم #${nextInvId} وخصم المخزون!`,
        'success'
      );
    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء تحويل الطلب لفاتورة', 'error');
    }
  };

  // Trigger Print Receipt
  const handlePrintReceipt = (order: Quotation, format: '80mm' | 'a4') => {
    printWebOrderReceipt(order, appData, format, false);
    showToast(`🖨️ تم فتح أمر الطباعة لإيصال الطلب #${order.orderReference || order.id}`, 'info');
  };

  // Open WhatsApp with order details
  const handleOpenWhatsApp = (order: Quotation) => {
    const phone = (order.phone || '').replace(/[^0-9]/g, '');
    if (!phone) {
      showToast('رقم هاتف العميل غير متوفر أو غير صالح', 'warning');
      return;
    }

    const itemsSummary = (order.items || [])
      .map((it) => `• ${it.name} (كمية: ${it.qty}) بسعر ${it.price} ج.م`)
      .join('\n');

    const message = `مرحباً أ/ ${order.clientName} 🌸
شكراً لطلبك من متجرنا!
تفاصيل طلب الشراء:
رقم الطلب: ${order.orderReference || `#${order.id}`}
المنتجات:
${itemsSummary}
الإجمالي المطلوب: ${order.total} ج.م
العنوان: ${order.customerAddress || 'استلام بالفرع'}

طلبك قيد التجهيز حالياً، وسنتواصل معك فور تسليمه لشركة التوصيل. شكراً لثقتكم!`;

    const encoded = encodeURIComponent(message);
    const intlPhone = phone.startsWith('0') ? '2' + phone : phone;
    window.open(`https://wa.me/${intlPhone}?text=${encoded}`, '_blank');
  };

  // Test printer slip
  const handleTestPrint = () => {
    const dummyOrder: Quotation = {
      id: 9999,
      type: 'sale_quote',
      status: 'online_order',
      source: 'online_catalog',
      orderReference: 'ORD-TEST-80MM',
      clientName: 'تجربة طابعة ركيزة Rakeeza',
      phone: '01029190615',
      customerAddress: 'طابعة الفواتير الحرارية 80 مم',
      notes: 'إيصال اختبار فوري للتحقق من توافق الطابعة مع النظام',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      items: [
        { name: 'منتج تجريبي 1 (طابعة بون)', qty: 1, price: 250, total: 250 },
        { name: 'كابل شحن سريع Type-C', qty: 2, price: 75, total: 150 },
      ],
      subtotal: 400,
      discount: 0,
      tax: 0,
      total: 400,
      createdBy: 'اختبار الطابعة',
    };

    printWebOrderReceipt(dummyOrder, appData, printFormat, false);
    showToast('🖨️ تم إرسال إيصال الاختبار التجريبي إلى الطابعة', 'success');
  };

  // Test Audio Chime
  const handleTestChime = () => {
    playOrderAlertChime();
    showToast('🔔 استمع للرنين الصوتي الخاص بوصول طلبات جديدة', 'info');
  };

  return (
    <div className="space-y-5 pb-16 w-full max-w-full overflow-x-hidden" dir="rtl">
      {/* Top Banner Card with Auto-Print Controls */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-5 md:p-7 rounded-3xl shadow-md border border-slate-700 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 bg-emerald-500 text-slate-950 text-xs font-black px-3 py-1 rounded-lg">
                <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping" />
                استقبال مباشر للطلبات (Live Web Orders)
              </span>
              {autoPrintEnabled ? (
                <span className="bg-amber-400 text-slate-950 text-xs font-black px-3 py-1 rounded-lg flex items-center gap-1">
                  <span>🖨️</span> الطباعة التلقائية مفعلة ({printFormat})
                </span>
              ) : (
                <span className="bg-slate-700 text-slate-300 text-xs px-2.5 py-1 rounded-lg">
                  الطباعة التلقائية متوقفة
                </span>
              )}
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-white">
              صندوق استقبال طلبات الويب سايت والكتالوج الإلكتروني
            </h2>
            <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
              تصل جميع طلبات العملاء من المتجر الإلكتروني هنا في الوقت الفعلي مع إشعار صوتي، ويمكنك تفعيل خيار
              الطباعة التلقائية الفورية لطابعة الفواتير (80mm Thermal Receipt) الموصولة بجهازك دون الحاجة للنقر!
            </p>
          </div>

          {/* Quick Hardware Controls: Auto-Print, Sound, Test */}
          <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-white/20 flex flex-col gap-3 w-full sm:w-auto sm:min-w-[300px]">
            <div className="text-xs font-black text-amber-300 flex items-center justify-between">
              <span>⚙️ إعدادات الطباعة والتنبيه اللحظي:</span>
              <span className="text-[10px] text-slate-300 font-normal">نظام ركيزة Rakeeza</span>
            </div>

            {/* Auto-Print Toggle */}
            <div className="flex items-center justify-between gap-3 bg-slate-900/60 p-2.5 rounded-xl border border-white/10">
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>🖨️</span> طباعة فورية تلقائية للطلبات
                </div>
                <div className="text-[10px] text-slate-300">طباعة إيصال الطلب فور وصوله من العميل</div>
              </div>
              <button
                type="button"
                onClick={handleToggleAutoPrint}
                className={`w-12 h-6 flex items-center rounded-full p-1 transition cursor-pointer ${
                  autoPrintEnabled ? 'bg-emerald-500 justify-end' : 'bg-slate-600 justify-start'
                }`}
              >
                <div className="bg-white w-4 h-4 rounded-full shadow-xs" />
              </button>
            </div>

            {/* Sound Toggle */}
            <div className="flex items-center justify-between gap-3 bg-slate-900/60 p-2.5 rounded-xl border border-white/10">
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>🔔</span> رنين تنبيه صوتي عند وصول طلب
                </div>
                <div className="text-[10px] text-slate-300">نغمة جرس تنبيه مميزة</div>
              </div>
              <button
                type="button"
                onClick={handleToggleSound}
                className={`w-12 h-6 flex items-center rounded-full p-1 transition cursor-pointer ${
                  soundEnabled ? 'bg-amber-400 justify-end' : 'bg-slate-600 justify-start'
                }`}
              >
                <div className="bg-white w-4 h-4 rounded-full shadow-xs" />
              </button>
            </div>

            {/* Print Format Selector & Test Buttons */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10">
              <div className="flex items-center gap-1 text-xs">
                <span className="text-[11px] text-slate-300">الحجم:</span>
                <select
                  value={printFormat}
                  onChange={(e) => handleChangePrintFormat(e.target.value as any)}
                  className="bg-slate-900 text-white font-bold text-xs p-1.5 rounded-lg border border-slate-600 focus:outline-none cursor-pointer"
                >
                  <option value="80mm">حراري 80mm</option>
                  <option value="a4">ورق A4</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleTestChime}
                  className="bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-slate-600 transition cursor-pointer"
                  title="سماع الرنين الصوتي"
                >
                  🔔 صوت
                </button>
                <button
                  type="button"
                  onClick={handleTestPrint}
                  className="bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-black px-3 py-1.5 rounded-lg transition cursor-pointer shadow-xs"
                  title="طباعة إيصال تجريبي لاختبار الطابعة"
                >
                  🖨️ تجربة الطباعة
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>الكل</span>
              <span className="bg-white/20 px-1.5 py-0.2 rounded-full text-[10px]">
                {tabCounts.all}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('new')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'new'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              <span>🔴 طلبات جديدة</span>
              <span className="bg-rose-900/20 text-rose-800 px-1.5 py-0.2 rounded-full text-[10px] font-black">
                {tabCounts.new}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('processing')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'processing'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <span>قيد التجهيز</span>
              <span className="bg-amber-900/20 text-amber-900 px-1.5 py-0.2 rounded-full text-[10px]">
                {tabCounts.processing}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('shipped')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'shipped'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border border-indigo-200'
              }`}
            >
              <span>قيد التوصيل</span>
              <span className="bg-indigo-900/20 text-indigo-900 px-1.5 py-0.2 rounded-full text-[10px]">
                {tabCounts.shipped}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('delivered')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'delivered'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <span>تم التسليم</span>
              <span className="bg-emerald-900/20 text-emerald-900 px-1.5 py-0.2 rounded-full text-[10px]">
                {tabCounts.delivered}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('converted')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'converted'
                  ? 'bg-teal-700 text-white'
                  : 'bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200'
              }`}
            >
              <span>تمت الفوترة</span>
              <span className="bg-teal-900/20 text-teal-900 px-1.5 py-0.2 rounded-full text-[10px]">
                {tabCounts.converted}
              </span>
            </button>
          </div>

          {/* Company Filter & Search */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {!isOwner ? (
              <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl px-3 py-2 text-xs font-black flex items-center gap-1.5">
                <span>🔒</span>
                <span>وارد: {activeCompany.name}</span>
              </div>
            ) : (
              companies.length > 1 && (
                <select
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="all">🏢 جميع الشركات</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code || c.id})
                    </option>
                  ))}
                </select>
              )
            )}

            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث برقم الطلب أو العميل أو الهاتف..."
              className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs md:text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none flex-1 min-w-[150px] md:w-64"
            />

            <TableActionButtons
              onPrint={() => {
                openUnifiedPrintWindow(
                  {
                    title: 'سجل وحصر طلبات المتجر الإلكتروني والويب سايت',
                    partyLabel: 'إجمالي الطلبات',
                    partyName: `${webOrders.length} طلب وارد`,
                    items: webOrders.map((o) => ({
                      name: `${o.clientName || 'عميل المتجر'} (${o.orderReference || o.id})`,
                      unit: o.orderStatus ? ORDER_STATUS_LABELS[o.orderStatus] || o.orderStatus : 'جديد',
                      qty: o.items?.length || 0,
                      price: 0,
                      total: o.total,
                      notes: `الهاتف: ${o.phone || '-'} | العنوان: ${o.customerAddress || '-'} | التاريخ: ${o.date}`,
                    })),
                    totals: [
                      {
                        label: 'إجمالي قيمة الطلبات:',
                        value: webOrders.reduce((sum, o) => sum + (o.total || 0), 0),
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
                exportToExcel({
                  filename: `طلبات_المتجر_الإلكتروني_${new Date().toISOString().split('T')[0]}`,
                  sheetName: 'طلبات الويب سايت',
                  data: webOrders,
                  columns: [
                    { header: 'رقم الطلب المرجعي', getValue: (o: any) => o.orderReference || `#${o.id}`, width: 18 },
                    { header: 'تاريخ الطلب', key: 'date', width: 14 },
                    { header: 'اسم العميل', getValue: (o: any) => o.clientName || 'عميل أونلاين', width: 25 },
                    { header: 'رقم الهاتف', getValue: (o: any) => o.phone || '-', width: 16 },
                    { header: 'عنوان التوصيل', getValue: (o: any) => o.customerAddress || '-', width: 30 },
                    { header: 'عدد الأصناف', getValue: (o: any) => o.items?.length || 0, width: 14 },
                    { header: 'إجمالي الطلب (ج.م)', getValue: (o: any) => (o.total || 0).toFixed(2), width: 18 },
                    { header: 'حالة الطلب', getValue: (o: any) => o.orderStatus ? ORDER_STATUS_LABELS[o.orderStatus] || o.orderStatus : 'جديد', width: 20 },
                    { header: 'ملاحظات التوصيل', getValue: (o: any) => o.deliveryNotes || '-', width: 25 },
                  ],
                  companyName: appData.settings?.companyName || 'المنظومة المحاسبية المعتمدة',
                  reportTitle: 'سجل وحصر طلبات العملاء من المتجر والكتالوج الإلكتروني',
                });
                showToast('تم تصدير طلبات المتجر إلى Excel بنجاح', 'success');
              }}
              printTitle="طباعة سجل طلبات الويب سايت"
              exportTitle="تصدير طلبات الويب سايت إلى Excel"
            />
          </div>
        </div>
      </div>

      {/* Orders List / Cards Grid */}
      {webOrders.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs space-y-3">
          <div className="text-5xl">🛒</div>
          <h3 className="text-lg font-black text-slate-800">لا توجد طلبات واردة من الويب سايت حالياً</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            عندما يقوم أي عميل بإرسال طلب شراء عبر رابط الكتالوج أونلاين أو مسح رمز الـ QR Code، سيظهر طلبه
            هنا فوراً مع إمكانية طباعة البون بضغطة زر أو تحويله لفاتورة مبيعات معتمدة.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {webOrders.map((order) => {
            const isNew = order.status === 'online_order' || order.orderStatus === 'new';
            const isConverted = order.status === 'converted' || Boolean(order.convertedInvoiceId);
            const currentStatus = order.orderStatus || (isNew ? 'new' : 'delivered');
            const orderCompany = companies.find(
              (c) => c.id === order.companyId || c.code === order.companyId || c.tenantId === order.companyId
            );

            return (
              <div
                key={order.id}
                className={`bg-white rounded-2xl border transition shadow-xs hover:shadow-md p-5 flex flex-col justify-between gap-4 relative overflow-hidden ${
                  isNew
                    ? 'border-rose-400 ring-2 ring-rose-100 bg-gradient-to-b from-rose-50/20 to-white'
                    : isConverted
                    ? 'border-teal-300'
                    : 'border-slate-200'
                }`}
              >
                {/* Header of the Order Card */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black text-base md:text-lg text-slate-900">
                        {order.orderReference || `#ORD-${order.id}`}
                      </span>
                      {orderCompany && (
                        <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-slate-200 flex items-center gap-1">
                          <span>🏢</span> {orderCompany.tradeName || orderCompany.name}
                        </span>
                      )}
                      {isNew && (
                        <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
                          طلب جديد بانتظار التأكيد
                        </span>
                      )}
                      {isConverted && (
                        <span className="bg-teal-100 text-teal-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                          ✓ تم التحويل لفاتورة #{order.convertedInvoiceId}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                      <span>التاريخ: {order.date}</span>
                      {order.time && <span>• الساعة: {order.time}</span>}
                    </div>
                  </div>

                  {/* Total price highlight */}
                  <div className="text-left shrink-0">
                    <div className="text-xl md:text-2xl font-black text-indigo-700">
                      {Number(order.total).toFixed(2)} ج.م
                    </div>
                    <div className="text-[11px] text-slate-400 font-bold">
                      {order.items?.length || 0} صنف
                    </div>
                  </div>
                </div>

                {/* Customer Info Box */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-bold">العميل:</span>
                    <strong className="text-slate-900 text-sm font-black">{order.clientName}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-bold">الهاتف:</span>
                    <span className="font-mono font-bold text-slate-800 text-xs dir-ltr">
                      {order.phone || '-'}
                    </span>
                  </div>
                  {order.customerAddress && (
                    <div className="flex items-start justify-between gap-2 pt-1 border-t border-slate-200/60">
                      <span className="text-slate-500 font-bold shrink-0">العنوان والتوصيل:</span>
                      <span className="font-bold text-slate-800 text-right">{order.customerAddress}</span>
                    </div>
                  )}
                  {order.deliveryNotes && (
                    <div className="flex items-start justify-between gap-2 pt-1 border-t border-slate-200/60 text-amber-800">
                      <span className="font-bold shrink-0">ملاحظات العميل:</span>
                      <span className="font-bold text-right">{order.deliveryNotes}</span>
                    </div>
                  )}
                </div>

                {/* Items Summary Table */}
                <div className="border border-slate-100 rounded-xl overflow-hidden text-xs">
                  <div className="bg-slate-100 px-3 py-1.5 font-bold text-slate-600 flex justify-between">
                    <span>بيان الأصناف المطلوبة</span>
                    <span>الكمية × السعر</span>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-36 overflow-y-auto">
                    {(order.items || []).map((it, idx) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                        <span className="font-bold text-slate-800">
                          {it.name}
                          {it.notes ? <span className="text-slate-400 text-[10px] mr-1 font-normal">({it.notes})</span> : ''}
                        </span>
                        <span className="text-slate-600 font-mono font-bold">
                          {it.qty} × {Number(it.price).toFixed(2)} = {Number(it.total).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Status Selector and Action Buttons */}
                <div className="space-y-2 pt-1 border-t border-slate-100">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-slate-600 shrink-0">مرحلة الطلب:</span>
                    <select
                      value={currentStatus}
                      onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value as any)}
                      className="bg-slate-100 font-bold text-slate-800 text-xs p-1.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                    >
                      <option value="new">🔴 جديد (بانتظار التأكيد)</option>
                      <option value="processing">🟡 قيد التجهيز في المخزن</option>
                      <option value="shipped">🚚 قيد التوصيل مع المندوب</option>
                      <option value="delivered">✅ تم التسليم بنجاح</option>
                      <option value="cancelled">❌ ملغي</option>
                    </select>
                  </div>

                  {/* Operational Action Buttons */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    {/* Print 80mm Slip */}
                    <button
                      type="button"
                      onClick={() => handlePrintReceipt(order, '80mm')}
                      className="bg-slate-900 hover:bg-slate-800 text-white font-black py-2 px-2 rounded-xl text-xs flex items-center justify-center gap-1 transition shadow-xs cursor-pointer"
                      title="طباعة إيصال فوري على طابعة الكاشير الحرارية 80 مم"
                    >
                      <span>🖨️</span>
                      <span>بون 80mm</span>
                    </button>

                    {/* Print A4 */}
                    <button
                      type="button"
                      onClick={() => handlePrintReceipt(order, 'a4')}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-2 rounded-xl text-xs flex items-center justify-center gap-1 transition cursor-pointer"
                      title="طباعة نموذج A4 رسمي"
                    >
                      <span>📄</span>
                      <span>ورق A4</span>
                    </button>

                    {/* WhatsApp */}
                    <button
                      type="button"
                      onClick={() => handleOpenWhatsApp(order)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-2 rounded-xl text-xs flex items-center justify-center gap-1 transition shadow-xs cursor-pointer"
                      title="مراسلة العميل بتفاصيل الطلب عبر واتساب"
                    >
                      <span>💬</span>
                      <span>واتساب</span>
                    </button>

                    {/* Convert to Invoice */}
                    {!isConverted ? (
                      <button
                        type="button"
                        onClick={() => handleConvertToInvoice(order)}
                        className="bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-black py-2 px-2 rounded-xl text-xs flex items-center justify-center gap-1 transition shadow-xs cursor-pointer"
                        title="تحويل مباشر لفاتورة مبيعات معتمدة وخصم المخزون"
                      >
                        <span>⚡</span>
                        <span>فوترة فورية</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={onNavigateToSales}
                        className="bg-teal-50 text-teal-800 border border-teal-200 font-black py-2 px-2 rounded-xl text-xs flex items-center justify-center gap-1 hover:bg-teal-100 transition cursor-pointer"
                      >
                        <span>✓ الفاتورة</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
