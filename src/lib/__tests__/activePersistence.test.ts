import { afterEach, describe, expect, it, vi } from 'vitest';
import { activePersistenceStatus, persistActiveSession, subscribeActivePersistence } from '../activePersistence';
import type { ActiveSession } from '../session';

afterEach(() => vi.unstubAllGlobals());
describe('active session persistence feedback', () => {
  it('reports failed storage and clears the warning only after a successful write', () => {
    const setItem = vi.fn(() => { throw new Error('quota'); });
    vi.stubGlobal('localStorage', { setItem, removeItem: vi.fn() });
    const changed = vi.fn();
    const unsubscribe = subscribeActivePersistence(changed);
    persistActiveSession({ routineId: 'a' } as ActiveSession);
    expect(activePersistenceStatus()).toBe('error');
    expect(changed).toHaveBeenCalledTimes(1);
    vi.stubGlobal('localStorage', { setItem: vi.fn(), removeItem: vi.fn() });
    persistActiveSession({ routineId: 'a' } as ActiveSession);
    expect(activePersistenceStatus()).toBe('saved');
    expect(changed).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
});
