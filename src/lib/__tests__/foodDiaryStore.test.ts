import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { db } from '../db';
import type { FoodEntry } from '../foodDiary';
const { pushRecordMock, catalog } = vi.hoisted(() => ({
  pushRecordMock: vi.fn(async () => {}),
  catalog: new Map([['Squat', { id: 'Squat', nameIt: 'Squat', nameEn: 'Squat', muscles: [] }]]),
}));
vi.mock('../sync', () => ({
  pushRecord: pushRecordMock,
  deleteRecord: vi.fn(),
  pushRecordStrict: vi.fn(),
  startSync: () => ({ stop: async () => {} }),
}));
vi.mock('../exercises', () => ({
  getCatalog: () => catalog,
  loadCatalog: async () => {},
  registerCustomExercises: () => {},
}));
vi.mock('../wakeLock', () => ({ releaseWakeLock: () => {}, acquireWakeLock: () => {} }));
import { useStore } from '../../state/useStore';
const storage = new Map<string, string>();
const foodEntry = (id = 'a'): FoodEntry => ({
  id,
  quantity: 50,
  meal: 'breakfast',
  food: {
    id: 'oats',
    name: 'Oats',
    basis: 'g',
    source: 'usda',
    nutrients: { kcal: 380, proteinG: 12 },
  },
});
beforeEach(async () => {
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  storage.clear();
  useStore.getState().setUser(null);
  await db.delete();
  await db.open();
  pushRecordMock.mockClear();
  storage.set('overload_uid', 'a');
  useStore.getState().setUser({ uid: 'a', name: null });
  await vi.waitFor(() => expect(useStore.getState().authState).toBe('ready'));
});
afterEach(async () => {
  useStore.getState().setUser(null);
  await db.delete();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('concurrent additions and edits preserve other entries and snapshots', async () => {
  const a = foodEntry();
  await Promise.all([
    useStore.getState().addDiaryEntries('2026-09-08', [a]),
    useStore.getState().addDiaryEntries('2026-09-08', [foodEntry('b')]),
  ]);
  a.food.name = 'Mutated input';
  await useStore.getState().updateDiaryEntry('2026-09-08', { ...foodEntry(), quantity: 100 });
  const day = useStore.getState().nutrition.find((day) => day.date === '2026-09-08');
  expect(day?.entries).toHaveLength(2);
  expect(day?.entries?.[1].food.name).toBe('Oats');
  expect(day?.kcal).toBe(570);
});
it('an immediate account change cancels queued diary writes', async () => {
  const pending = useStore.getState().addDiaryEntries('2026-09-08', [foodEntry()]);
  useStore.getState().setUser({ uid: 'b', name: null });
  expect(await pending).toEqual({ status: 'stale' });
  await vi.waitFor(() => expect(useStore.getState().authState).toBe('ready'));
  expect(await db.nutrition.count()).toBe(0);
  expect(pushRecordMock).not.toHaveBeenCalled();
});
it('multi-day import rolls back every date when a later date fails', async () => {
  await expect(
    useStore.getState().importDiaryDays([
      { date: '2026-09-08', entries: [foodEntry()] },
      { date: '2026-02-30', entries: [foodEntry()] },
    ]),
  ).rejects.toThrow();
  expect(await db.nutrition.count()).toBe(0);
  expect(useStore.getState().nutrition).toEqual([]);
});
it('multi-day import retry preserves edits and does not duplicate entries', async () => {
  const days = [
    { date: '2026-09-08', entries: [foodEntry()] },
    { date: '2026-09-09', entries: [foodEntry('b')] },
  ];
  await useStore.getState().importDiaryDays(days);
  await useStore.getState().updateDiaryEntry(days[0].date, { ...foodEntry(), quantity: 100 });
  await useStore.getState().importDiaryDays(days);
  expect((await db.nutrition.get(days[0].date))?.kcal).toBe(380);
  expect(await db.nutrition.count()).toBe(2);
});
