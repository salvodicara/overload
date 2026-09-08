import type { ActiveSession } from './session';

let status: 'saved' | 'error' = 'saved';
const listeners = new Set<() => void>();
export const activePersistenceStatus = (): 'saved' | 'error' => status;
export function subscribeActivePersistence(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function persistActiveSession(active: ActiveSession | null): void {
  let next: typeof status = 'saved';
  try {
    if (active) localStorage.setItem('overload_active', JSON.stringify(active));
    else localStorage.removeItem('overload_active');
  } catch {
    next = 'error';
  }
  if (next !== status) {
    status = next;
    listeners.forEach((listener) => listener());
  }
}
