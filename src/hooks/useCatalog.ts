import { useEffect } from 'react';
import { useStore } from '../state/useStore';

export function useCatalog(required = true): boolean {
  const ensureCatalog = useStore((state) => state.ensureCatalog);
  const catalogReady = useStore((state) => state.catalogReady);

  useEffect(() => {
    if (!required || catalogReady) return;
    let retry: number | undefined;
    let active = true;
    const ensure = (canRetry: boolean) => {
      void ensureCatalog().catch(() => {
        if (!active || !canRetry) return;
        if (retry !== undefined) window.clearTimeout(retry);
        retry = window.setTimeout(() => {
          retry = undefined;
          if (active) ensure(false);
        }, 500);
      });
    };
    const online = () => {
      if (retry !== undefined) window.clearTimeout(retry);
      retry = undefined;
      if (!active) return;
      ensure(true);
    };
    ensure(true);
    window.addEventListener('online', online);
    return () => {
      active = false;
      if (retry !== undefined) window.clearTimeout(retry);
      window.removeEventListener('online', online);
    };
  }, [catalogReady, ensureCatalog, required]);

  return catalogReady;
}
