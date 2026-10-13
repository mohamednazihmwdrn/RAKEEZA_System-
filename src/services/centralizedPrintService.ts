import { SaleInvoice, PurchaseInvoice, Settings } from '../types';

export type PaperSize = 'A4' | 'A5' | 'thermal';

export interface InvoicePrintPayload {
  invoice: SaleInvoice | PurchaseInvoice;
  isSales?: boolean;
  settings?: Settings;
  preferredPaperSize?: PaperSize;
  onClose?: () => void;
}

const PRINT_EVENT_NAME = 'rakeeza_open_invoice_print';

/**
 * 🖨️ Centralized Service function to open the Invoice Print & Preview Modal from anywhere in the system
 */
export function openCentralizedInvoicePrint(payload: InvoicePrintPayload): void {
  if (typeof window === 'undefined') return;
  const event = new CustomEvent(PRINT_EVENT_NAME, { detail: payload });
  window.dispatchEvent(event);
}

/**
 * 🎧 Subscribe to centralized invoice print requests (Used by CentralizedInvoicePrintModal)
 */
export function subscribeToInvoicePrint(
  callback: (payload: InvoicePrintPayload) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const handler = (e: Event) => {
    const customEvent = e as CustomEvent<InvoicePrintPayload>;
    if (customEvent && customEvent.detail && customEvent.detail.invoice) {
      callback(customEvent.detail);
    }
  };

  window.addEventListener(PRINT_EVENT_NAME, handler);
  return () => {
    window.removeEventListener(PRINT_EVENT_NAME, handler);
  };
}
