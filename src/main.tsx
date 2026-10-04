import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Auto-update Service Worker whenever a new release is pushed to GitHub/Vercel
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // Instantly activate new service worker and reload the page to get the latest Vercel deployment
      updateSW(true);
    },
    onOfflineReady() {
      console.log('RAKEEZA ERP offline cache ready');
    },
  });

  // Re-check for Vercel updates when user switches back to the app or window is focused
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      updateSW();
    }
  });

  window.addEventListener('focus', () => {
    updateSW();
  });
}

// Guard against long-press and right-click copy/paste menu on static system labels
if (typeof window !== 'undefined') {
  document.addEventListener('contextmenu', (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const isInputOrSelectable =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable ||
      Boolean(target.closest('input, textarea, [contenteditable="true"], .selectable, .selectable-text, .allow-copy'));
    if (!isInputOrSelectable) {
      e.preventDefault();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
