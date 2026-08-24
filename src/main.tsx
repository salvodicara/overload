import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';
import './theme/tokens.css';
import App from './App';

// Self-heal: a reload storm (stale or looping service worker) unregisters
// everything once and boots clean instead of trapping the user.
(() => {
  try {
    const now = Date.now();
    const boots = (JSON.parse(sessionStorage.getItem('boot') ?? '[]') as number[])
      .filter((t) => now - t < 30_000)
      .concat(now);
    sessionStorage.setItem('boot', JSON.stringify(boots));
    if (boots.length > 4 && !sessionStorage.getItem('healed')) {
      sessionStorage.setItem('healed', '1');
      void (async () => {
        const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? [];
        await Promise.all(regs.map((r) => r.unregister()));
        await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
        location.reload();
      })();
    }
  } catch {
    /* storage unavailable */
  }
})();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
