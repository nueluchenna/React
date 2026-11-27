import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';

// Auto-recover from stale Vite dynamic chunk mismatches after a PWA deploy
window.addEventListener('vite:preloadError', () => {
  const key = 'manni_chunk_reload_once';
  if (!sessionStorage.getItem(key)) {
    sessionStorage.setItem(key, '1');
    window.location.reload();
  }
});
setTimeout(() => {
  sessionStorage.removeItem('manni_chunk_reload_once');
}, 5000);

// Cleanly reload once when a new Service Worker takes control
if ('serviceWorker' in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
