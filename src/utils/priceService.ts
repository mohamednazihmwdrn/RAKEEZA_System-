import { AppData, Item, ProductPrice, PriceHistoryRecord } from '../types';
import { addAuditLog } from './storage';

/**
 * Calculates profit margin and profit amount given selling price and purchase cost.
 */
export function calculateProfitMargin(
  sellingPrice: number,
  costPrice: number
): { profitAmount: number; marginPercent: number } {
  const cost = Number(costPrice) || 0;
  const price = Number(sellingPrice) || 0;
  const profitAmount = price - cost;
  const marginPercent = cost > 0 ? (profitAmount / cost) * 100 : price > 0 ? 100 : 0;
  return {
    profitAmount: Math.round(profitAmount * 100) / 100,
    marginPercent: Math.round(marginPercent * 10) / 10,
  };
}

/**
 * Synchronizes and ensures consistency between `items` and `productPrices` collections.
 */
export function ensureProductPricesSynced(data: AppData): AppData {
  const items = data.items || [];
  const existingPrices = data.productPrices ? [...data.productPrices] : [];
  const updatedPrices: ProductPrice[] = [];
  const nowStr = new Date().toISOString().split('T')[0];

  const updatedItems = items.map((item, idx) => {
    const itemCode = item.code || `PRD-${(idx + 1).toString().padStart(3, '0')}`;
    const normalPrice =
      item.normalSellingPrice !== undefined && item.normalSellingPrice > 0
        ? item.normalSellingPrice
        : item.salePrice || 0;
    const wholesalePrice =
      item.wholesaleSellingPrice !== undefined && item.wholesaleSellingPrice > 0
        ? item.wholesaleSellingPrice
        : item.wholesalePrice || (normalPrice > 0 ? Math.round(normalPrice * 0.9) : 0);

    const cost = item.purchasePrice || 0;
    const normalMargin = calculateProfitMargin(normalPrice, cost).marginPercent;
    const wholesaleMargin = calculateProfitMargin(wholesalePrice, cost).marginPercent;

    let priceRecord = existingPrices.find((p) => p.productId === item.id);
    if (!priceRecord) {
      priceRecord = {
        id: `prc-${item.id}`,
        productId: item.id,
        productCode: itemCode,
        productBarcode: item.barcode || '',
        productName: item.name,
        category: item.category || 'عام',
        purchaseCost: cost,
        normalSellingPrice: normalPrice,
        wholesaleSellingPrice: wholesalePrice,
        profitMarginNormalPercent: normalMargin,
        profitMarginWholesalePercent: wholesaleMargin,
        updatedAt: item.lastPriceUpdate || nowStr,
        updatedBy: item.lastPriceUpdatedBy || 'مدير النظام',
      };
    } else {
      // Ensure sync
      priceRecord = {
        ...priceRecord,
        productCode: itemCode,
        productBarcode: item.barcode || priceRecord.productBarcode,
        productName: item.name,
        category: item.category || priceRecord.category,
        purchaseCost: cost,
        normalSellingPrice: priceRecord.normalSellingPrice || normalPrice,
        wholesaleSellingPrice: priceRecord.wholesaleSellingPrice || wholesalePrice,
        profitMarginNormalPercent: calculateProfitMargin(priceRecord.normalSellingPrice || normalPrice, cost).marginPercent,
        profitMarginWholesalePercent: calculateProfitMargin(priceRecord.wholesaleSellingPrice || wholesalePrice, cost).marginPercent,
      };
    }

    updatedPrices.push(priceRecord);

    return {
      ...item,
      code: itemCode,
      salePrice: priceRecord.normalSellingPrice,
      wholesalePrice: priceRecord.wholesaleSellingPrice,
      normalSellingPrice: priceRecord.normalSellingPrice,
      wholesaleSellingPrice: priceRecord.wholesaleSellingPrice,
      lastPriceUpdate: priceRecord.updatedAt,
      lastPriceUpdatedBy: priceRecord.updatedBy,
    };
  });

  return {
    ...data,
    items: updatedItems,
    productPrices: updatedPrices,
    priceHistories: data.priceHistories || [],
  };
}

/**
 * Updates prices for a single product, records price history, and updates audit logs.
 */
export function updateProductPrice(
  data: AppData,
  productId: string,
  normalSellingPrice: number,
  wholesaleSellingPrice: number,
  updatedBy: string,
  reason?: string
): AppData {
  const currentData = ensureProductPricesSynced(data);
  const targetItem = currentData.items.find((i) => i.id === productId);
  if (!targetItem) return currentData;

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  const oldNormalPrice = targetItem.normalSellingPrice || targetItem.salePrice || 0;
  const oldWholesalePrice = targetItem.wholesaleSellingPrice || targetItem.wholesalePrice || 0;

  const newNormal = Math.max(0, Number(normalSellingPrice) || 0);
  const newWholesale = Math.max(0, Number(wholesaleSellingPrice) || 0);

  // If no change, return
  const isChanged = oldNormalPrice !== newNormal || oldWholesalePrice !== newWholesale;
  if (!isChanged) return currentData;

  const cost = targetItem.purchasePrice || 0;
  const normalMargin = calculateProfitMargin(newNormal, cost).marginPercent;
  const wholesaleMargin = calculateProfitMargin(newWholesale, cost).marginPercent;

  // 1. Create Price History Record
  const historyRecord: PriceHistoryRecord = {
    id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    productId: targetItem.id,
    productCode: targetItem.code || '',
    productBarcode: targetItem.barcode || '',
    productName: targetItem.name,
    category: targetItem.category,
    purchaseCost: cost,
    oldNormalPrice,
    newNormalPrice: newNormal,
    oldWholesalePrice,
    newWholesalePrice: newWholesale,
    changedBy: updatedBy,
    date: dateStr,
    time: timeStr,
    reason: reason || 'تعديل أسعار يدوي من إدارة الأسعار',
  };

  // 2. Update item
  const updatedItems = currentData.items.map((i) =>
    i.id === productId
      ? {
          ...i,
          salePrice: newNormal,
          wholesalePrice: newWholesale,
          normalSellingPrice: newNormal,
          wholesaleSellingPrice: newWholesale,
          lastPriceUpdate: dateStr,
          lastPriceUpdatedBy: updatedBy,
        }
      : i
  );

  // 3. Update productPrices collection
  const existingPrices = currentData.productPrices || [];
  const updatedPrices = existingPrices.map((p) =>
    p.productId === productId
      ? {
          ...p,
          purchaseCost: cost,
          normalSellingPrice: newNormal,
          wholesaleSellingPrice: newWholesale,
          profitMarginNormalPercent: normalMargin,
          profitMarginWholesalePercent: wholesaleMargin,
          updatedAt: dateStr,
          updatedBy,
          notes: reason,
        }
      : p
  );

  const updatedHistories = [historyRecord, ...(currentData.priceHistories || [])].slice(0, 1000);

  const finalData: AppData = {
    ...currentData,
    items: updatedItems,
    productPrices: updatedPrices,
    priceHistories: updatedHistories,
  };

  return addAuditLog(
    finalData,
    'update',
    'إدارة الأسعار',
    `تحديث أسعار الصنف "${targetItem.name}": نقدي (${oldNormalPrice} → ${newNormal} ج.م)، جملة (${oldWholesalePrice} → ${newWholesale} ج.م)`
  );
}

export type BulkAdjustmentType =
  | 'increase_normal_pct'
  | 'decrease_normal_pct'
  | 'increase_wholesale_pct'
  | 'decrease_wholesale_pct'
  | 'increase_both_pct'
  | 'decrease_both_pct'
  | 'increase_fixed_amount'
  | 'decrease_fixed_amount'
  | 'set_cost_margin_pct';

/**
 * Applies bulk price adjustments to a set of products.
 */
export function applyBulkPriceAdjustments(
  data: AppData,
  productIds: string[],
  adjustmentType: BulkAdjustmentType,
  value: number,
  updatedBy: string,
  reason?: string,
  secondaryValue?: number // used for margin wholesale pct
): { updatedData: AppData; count: number } {
  let currentData = ensureProductPricesSynced(data);
  let count = 0;
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  const newHistories: PriceHistoryRecord[] = [];
  const targetIdSet = new Set(productIds);

  const updatedItems = currentData.items.map((item) => {
    if (!targetIdSet.has(item.id)) return item;

    const oldNormal = item.normalSellingPrice || item.salePrice || 0;
    const oldWholesale = item.wholesaleSellingPrice || item.wholesalePrice || 0;
    const cost = item.purchasePrice || 0;

    let newNormal = oldNormal;
    let newWholesale = oldWholesale;

    switch (adjustmentType) {
      case 'increase_normal_pct':
        newNormal = Math.round((oldNormal * (1 + value / 100)) * 100) / 100;
        break;
      case 'decrease_normal_pct':
        newNormal = Math.max(0, Math.round((oldNormal * (1 - value / 100)) * 100) / 100);
        break;
      case 'increase_wholesale_pct':
        newWholesale = Math.round((oldWholesale * (1 + value / 100)) * 100) / 100;
        break;
      case 'decrease_wholesale_pct':
        newWholesale = Math.max(0, Math.round((oldWholesale * (1 - value / 100)) * 100) / 100);
        break;
      case 'increase_both_pct':
        newNormal = Math.round((oldNormal * (1 + value / 100)) * 100) / 100;
        newWholesale = Math.round((oldWholesale * (1 + value / 100)) * 100) / 100;
        break;
      case 'decrease_both_pct':
        newNormal = Math.max(0, Math.round((oldNormal * (1 - value / 100)) * 100) / 100);
        newWholesale = Math.max(0, Math.round((oldWholesale * (1 - value / 100)) * 100) / 100);
        break;
      case 'increase_fixed_amount':
        newNormal = Math.round((oldNormal + value) * 100) / 100;
        newWholesale = Math.round((oldWholesale + value) * 100) / 100;
        break;
      case 'decrease_fixed_amount':
        newNormal = Math.max(0, Math.round((oldNormal - value) * 100) / 100);
        newWholesale = Math.max(0, Math.round((oldWholesale - value) * 100) / 100);
        break;
      case 'set_cost_margin_pct':
        // value = normal profit margin %, secondaryValue = wholesale profit margin %
        if (cost > 0) {
          newNormal = Math.round((cost * (1 + value / 100)) * 100) / 100;
          const wholesaleMargin = secondaryValue !== undefined ? secondaryValue : value * 0.7;
          newWholesale = Math.round((cost * (1 + wholesaleMargin / 100)) * 100) / 100;
        }
        break;
    }

    if (newNormal !== oldNormal || newWholesale !== oldWholesale) {
      count++;
      newHistories.push({
        id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        productId: item.id,
        productCode: item.code || '',
        productBarcode: item.barcode || '',
        productName: item.name,
        category: item.category,
        purchaseCost: cost,
        oldNormalPrice: oldNormal,
        newNormalPrice: newNormal,
        oldWholesalePrice: oldWholesale,
        newWholesalePrice: newWholesale,
        changedBy: updatedBy,
        date: dateStr,
        time: timeStr,
        reason: reason || `تعديل جماعي للأسعار (${adjustmentType})`,
      });

      return {
        ...item,
        salePrice: newNormal,
        wholesalePrice: newWholesale,
        normalSellingPrice: newNormal,
        wholesaleSellingPrice: newWholesale,
        lastPriceUpdate: dateStr,
        lastPriceUpdatedBy: updatedBy,
      };
    }

    return item;
  });

  // Re-sync productPrices
  const updatedPrices = (currentData.productPrices || []).map((p) => {
    const matchedItem = updatedItems.find((i) => i.id === p.productId);
    if (!matchedItem) return p;
    const cost = matchedItem.purchasePrice || 0;
    const normalPrice = matchedItem.normalSellingPrice || matchedItem.salePrice || 0;
    const wholesalePrice = matchedItem.wholesaleSellingPrice || matchedItem.wholesalePrice || 0;

    return {
      ...p,
      purchaseCost: cost,
      normalSellingPrice: normalPrice,
      wholesaleSellingPrice: wholesalePrice,
      profitMarginNormalPercent: calculateProfitMargin(normalPrice, cost).marginPercent,
      profitMarginWholesalePercent: calculateProfitMargin(wholesalePrice, cost).marginPercent,
      updatedAt: dateStr,
      updatedBy,
    };
  });

  const finalHistories = [...newHistories, ...(currentData.priceHistories || [])].slice(0, 1000);

  let finalData: AppData = {
    ...currentData,
    items: updatedItems,
    productPrices: updatedPrices,
    priceHistories: finalHistories,
  };

  if (count > 0) {
    finalData = addAuditLog(
      finalData,
      'update',
      'إدارة الأسعار',
      `تطبيق تعديل أسعار جماعي على (${count}) صنف بنجاح بواسطة ${updatedBy}`
    );
  }

  return { updatedData: finalData, count };
}

/**
 * Retrieves the exact selling price for an item based on the selected salesType ('cash' | 'wholesale').
 * Strictly returns { hasPrice: false, message: "..." } if missing, preventing silent fallbacks.
 */
export function getProductActivePrice(
  data: AppData,
  productIdOrName: string,
  salesType: 'cash' | 'wholesale'
): { price: number; priceType: 'cash' | 'wholesale'; hasPrice: boolean; message?: string; item?: Item } {
  const items = data.items || [];
  const item = items.find(
    (i) =>
      i.id === productIdOrName ||
      i.name.trim().toLowerCase() === productIdOrName.trim().toLowerCase() ||
      (i.barcode && i.barcode === productIdOrName) ||
      (i.code && i.code === productIdOrName)
  );

  if (!item) {
    return {
      price: 0,
      priceType: salesType,
      hasPrice: false,
      message: `لم يتم العثور على الصنف المحدد في سجل الأصناف.`,
    };
  }

  if (salesType === 'cash') {
    const cashPrice =
      item.normalSellingPrice !== undefined && item.normalSellingPrice > 0
        ? item.normalSellingPrice
        : item.salePrice !== undefined && item.salePrice > 0
        ? item.salePrice
        : 0;

    if (cashPrice <= 0) {
      return {
        price: 0,
        priceType: 'cash',
        hasPrice: false,
        item,
        message: `هذا المنتج ("${item.name}") لا يحتوي على سعر بيع نقدي.\nيرجى إدخال السعر من قسم إدارة الأسعار أولاً.`,
      };
    }

    return {
      price: cashPrice,
      priceType: 'cash',
      hasPrice: true,
      item,
    };
  } else {
    // wholesale
    const wholesalePrice =
      item.wholesaleSellingPrice !== undefined && item.wholesaleSellingPrice > 0
        ? item.wholesaleSellingPrice
        : item.wholesalePrice !== undefined && item.wholesalePrice > 0
        ? item.wholesalePrice
        : 0;

    if (wholesalePrice <= 0) {
      return {
        price: 0,
        priceType: 'wholesale',
        hasPrice: false,
        item,
        message: `هذا المنتج ("${item.name}") لا يحتوي على سعر بيع بالجملة.\nيرجى إدخال السعر من قسم إدارة الأسعار أولاً.`,
      };
    }

    return {
      price: wholesalePrice,
      priceType: 'wholesale',
      hasPrice: true,
      item,
    };
  }
}
