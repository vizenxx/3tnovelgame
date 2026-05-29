import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AppErrorBoundary } from './components/AppErrorBoundary.tsx';
import './index.css';

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Capture before register() — null means first install, non-null means an existing SW is active.
    const hadController = Boolean(navigator.serviceWorker.controller);
    let reloadingForNewWorker = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // Only reload when swapping an existing SW (version update), not on first install.
      // On first install hadController is false, so skipWaiting+claim would otherwise
      // cause a spurious reload that shows the boot screen twice.
      if (!hadController || reloadingForNewWorker) return;
      reloadingForNewWorker = true;
      window.location.reload();
    });

    navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(__APP_BUILD_ID__)}`)
      .then((registration) => {
        registration.update().catch(() => {});
      })
      .catch((error) => {
        console.error('Service worker registration failed:', error);
      });
  });
} else if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister().catch(() => {});
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
