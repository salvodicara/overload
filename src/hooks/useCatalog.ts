import { useCallback, useEffect, useState } from 'react';
import { useStore } from '../state/useStore';

export function useCatalogState(required = true) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retryNow = useCallback(() => setAttempt((value) => value + 1), []);
  const ensureCatalog = useStore((state) => state.ensureCatalog);
  const catalogReady = useStore((state) => state.catalogReady);

  useEffect(() => {
    if (!required || catalogReady) return;
    setFailed(false);
    let retry: number | undefined;
    let active = true;
    const ensure = (canRetry: boolean) => {
      void ensureCatalog().catch(() => {
        if (!active) return;
        if (!canRetry) {
          setFailed(true);
          return;
        }
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
      setFailed(false);
      ensure(true);
    };
    ensure(true);
    window.addEventListener('online', online);
    return () => {
      active = false;
      if (retry !== undefined) window.clearTimeout(retry);
      window.removeEventListener('online', online);
    };
  }, [catalogReady, ensureCatalog, required, attempt]);

  return { ready: catalogReady, failed: failed && !catalogReady, retry: retryNow };
}

export function useCatalog(required = true): boolean {
  return useCatalogState(required).ready;
}
