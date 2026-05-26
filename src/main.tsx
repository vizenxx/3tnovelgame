import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AppErrorBoundary } from './components/AppErrorBoundary.tsx';
import './index.css';

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    let reloadingForNewWorker = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloadingForNewWorker) return;
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
