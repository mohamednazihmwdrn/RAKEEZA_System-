/**
 * 🧭 Rakeeza Mobile & Browser Navigation History Engine
 *
 * Implements hierarchical and chronological history tracking for phone navigation buttons,
 * gesture back swipes, and browser popstate events.
 *
 * Ensures:
 * 1. Stepping back returns to the PREVIOUS/PARENT page, never prematurely resetting to Home.
 * 2. Active modals, workspaces, drawers, and inspect modals close first on phone back button.
 * 3. Mobile sidebar closes gracefully on back button without breaking navigation history.
 */

export const PAGE_PARENT_MAP: Record<string, string> = {
  // Accounts & Partners hierarchy
  'customers': 'accounts',
  'suppliers': 'accounts',
  'accounts_tree': 'accounts',

  // Cash & Treasury hierarchy
  'receipts': 'cash',
  'payments': 'cash',
  'treasury': 'cash',
  'cheques': 'cash',
  'bank_reconciliation': 'cash',
  'cash_flow_closing': 'cash',

  // Items & Inventory hierarchy
  'item_movement': 'items',
  'inventory': 'items',
  'physical_inventory': 'inventory',
  'inventory_settlement': 'inventory',
  'serial_warranty': 'items',
  'manufacturing': 'items',

  // Operations & Financial Statements hierarchy
  'daily_entries': 'daily_operations',
  'trial_balance': 'daily_operations',
  'income_statement': 'daily_operations',
  'balance_sheet': 'daily_operations',
  'monthly_profit_report': 'daily_operations',
  'profit_report': 'daily_operations',
  'year_end_closing': 'daily_operations',
  'fixed_assets': 'daily_operations',

  // Sales & Commercial hierarchy
  'quotes_orders': 'sales',
  'price_management': 'sales',
  'company_prices': 'price_management',
  'company_catalog': 'price_management',
  'web_orders': 'sales',
  'sales_reps': 'sales',
  'crm_pipeline': 'sales',
  'catalog_manager': 'sales',
  'catalog': 'catalog_manager',
  'pos': 'sales',
  'einvoicing': 'sales',
  'e_invoicing': 'sales',

  // Settings & System hierarchy
  'users': 'settings',
  'backup': 'settings',
  'branches': 'settings',
  'audit_trail': 'settings',

  // Reports Group Root
  'reports_group': 'home',
  'reports': 'home',
  'bi_analytics': 'reports_group',
};

/**
 * Returns parent page for a given subpage
 */
export function getParentPage(page: string): string | null {
  if (!page || page === 'home' || page === 'login') return null;

  if (PAGE_PARENT_MAP[page]) {
    return PAGE_PARENT_MAP[page];
  }

  // Handle reports hierarchy: reports_sales_تفصيلي -> reports_sales -> reports_group
  if (page.startsWith('reports_') && page !== 'reports_group') {
    const parts = page.split('_');
    if (parts.length > 2) {
      return `reports_${parts[1]}`;
    }
    return 'reports_group';
  }

  return null;
}

// Global Modal & Overlay Back Handler Registry
type BackHandler = () => boolean; // returns true if back event was consumed
const modalBackHandlers: BackHandler[] = [];

/**
 * Registers an active modal/workspace/drawer to intercept the phone's back button.
 * Returns an unregister function.
 */
export function registerModalBackHandler(handler: BackHandler): () => void {
  modalBackHandlers.push(handler);
  return () => {
    const index = modalBackHandlers.indexOf(handler);
    if (index !== -1) {
      modalBackHandlers.splice(index, 1);
    }
  };
}

/**
 * Consumes top modal handler if any modal is active
 */
export function consumeModalBack(): boolean {
  if (modalBackHandlers.length > 0) {
    // Pop from end (topmost modal)
    const handler = modalBackHandlers.pop();
    if (handler) {
      return handler();
    }
  }
  return false;
}

/**
 * Checks if any modal back handler is registered
 */
export function hasActiveModal(): boolean {
  return modalBackHandlers.length > 0;
}

// In-Memory & Session Page Navigation Stack
const STACK_KEY = 'rakeeza_nav_history_stack_v2';

function loadStackFromSession(): string[] {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const saved = sessionStorage.getItem(STACK_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    }
  } catch {}
  return ['home'];
}

function saveStackToSession(stack: string[]): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.setItem(STACK_KEY, JSON.stringify(stack.slice(-20))); // keep latest 20
    }
  } catch {}
}

let pageStack: string[] = loadStackFromSession();

/**
 * Push a new page into the navigation stack
 */
export function pushNavigationPage(page: string): void {
  if (!page || page === 'login') return;

  // Don't push duplicates if current top of stack is the same page
  const currentTop = pageStack[pageStack.length - 1];
  if (currentTop === page) return;

  pageStack.push(page);
  saveStackToSession(pageStack);
}

/**
 * Pop current page and return previous page from the stack.
 * If stack has only 1 item or empty, attempts to resolve parent page before falling back to 'home'.
 */
export function popNavigationPage(currentPage: string): string {
  // If stack has items, remove current page from top
  while (pageStack.length > 0 && pageStack[pageStack.length - 1] === currentPage) {
    pageStack.pop();
  }

  if (pageStack.length > 0) {
    const prevPage = pageStack[pageStack.length - 1];
    // 🛡️ Prevent skipping straight to home if current page is a sub-page with a specific parent
    const parent = getParentPage(currentPage);
    if (prevPage === 'home' && parent && parent !== 'home' && parent !== currentPage) {
      pageStack = ['home', parent];
      saveStackToSession(pageStack);
      return parent;
    }
    saveStackToSession(pageStack);
    return prevPage;
  }

  // If stack was empty or only had current page, check parent hierarchy
  const parent = getParentPage(currentPage);
  if (parent && parent !== currentPage) {
    pageStack = ['home', parent];
    saveStackToSession(pageStack);
    return parent;
  }

  // Fallback to home
  pageStack = ['home'];
  saveStackToSession(pageStack);
  return 'home';
}

/**
 * Peek at the previous page without modifying stack
 */
export function getPreviousNavigationPage(currentPage: string): string {
  if (pageStack.length > 1) {
    // If top is current, peek second from top
    if (pageStack[pageStack.length - 1] === currentPage) {
      return pageStack[pageStack.length - 2];
    }
    return pageStack[pageStack.length - 1];
  }

  const parent = getParentPage(currentPage);
  if (parent && parent !== currentPage) {
    return parent;
  }

  return 'home';
}

/**
 * Determines whether user can go back
 */
export function canNavigateBack(currentPage: string): boolean {
  if (currentPage !== 'home' && currentPage !== 'login') {
    return true;
  }
  return pageStack.length > 1;
}
