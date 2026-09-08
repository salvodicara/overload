import { afterEach, expect, it, vi } from 'vitest';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
it('recovers unsaved drafts after module reload and keeps accounts separate', async () => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => values.set(k, v),
    removeItem: (k: string) => values.delete(k),
  });
  const draft = { id: 'routine', name: 'Unsaved', updatedAt: 1, exercises: [] };
  const first = (await import('../routineDrafts')).recoveryDrafts;
  first.set('account-a:routine', draft);
  vi.resetModules();
  const reloaded = (await import('../routineDrafts')).recoveryDrafts;
  expect(reloaded.get('account-a:routine')).toEqual(draft);
  expect(reloaded.get('account-b:routine')).toBeUndefined();
  reloaded.delete('account-a:routine');
  vi.resetModules();
  expect((await import('../routineDrafts')).recoveryDrafts.has('account-a:routine')).toBe(false);
});
