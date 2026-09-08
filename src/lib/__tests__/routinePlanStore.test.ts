import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { db } from '../db';
import { parseRoutinePlan } from '../routinePlan';
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
const plan = () =>
  parseRoutinePlan(
    JSON.stringify({
      format: 'overload-plan',
      version: 1,
      name: 'My plan',
      routines: [
        {
          name: 'A',
          exercises: [{ exerciseId: 'Squat', sets: 3, repMin: 8, repMax: 12, restSec: 90 }],
        },
      ],
    }),
  );
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
it('concurrent imports create one program and preserve unrelated collections', async () => {
  await db.settings.put({ id: 'settings', unit: 'lb', updatedAt: 1 });
  const results = await Promise.all([
    useStore.getState().importRoutinePlan(plan()),
    useStore.getState().importRoutinePlan(plan()),
  ]);
  expect(results.every((result) => result.status === 'applied')).toBe(true);
  expect(
    results.filter((result) => result.status === 'applied' && result.value.alreadyImported),
  ).toHaveLength(1);
  expect(await db.folders.count()).toBe(1);
  expect(await db.routines.count()).toBe(1);
  expect((await db.settings.get('settings'))?.unit).toBe('lb');
  expect(useStore.getState().routines).toHaveLength(1);
});
it('an account switch during asynchronous preparation prevents importing into the new owner', async () => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const ensure = useStore.getState().ensureCatalog;
  useStore.setState({ ensureCatalog: () => held });
  const pending = useStore.getState().importRoutinePlan(plan());
  useStore.getState().setUser({ uid: 'b', name: null });
  await vi.waitFor(() => expect(useStore.getState().user?.uid).toBe('b'));
  release();
  expect(await pending).toEqual({ status: 'stale' });
  await vi.waitFor(() => expect(useStore.getState().authState).toBe('ready'));
  expect(await db.folders.count()).toBe(0);
  expect(await db.routines.count()).toBe(0);
  expect(pushRecordMock).not.toHaveBeenCalled();
  useStore.setState({ ensureCatalog: ensure });
});

it('preserves an unrelated optimistic edit made while importing', async () => {
  const existing = { id: 'existing', name: 'Before', exercises: [], updatedAt: 1 };
  await db.routines.put(existing);
  useStore.setState({ routines: [existing] });
  const read = db.routines.toArray.bind(db.routines);
  vi.spyOn(db.routines, 'toArray').mockImplementationOnce(() =>
    read().then((snapshot) => {
      useStore.setState({ routines: [{ ...existing, name: 'Concurrent edit', updatedAt: 2 }] });
      return snapshot;
    }),
  );
  await useStore.getState().importRoutinePlan(plan());
  expect(useStore.getState().routines.find((routine) => routine.id === 'existing')?.name).toBe(
    'Concurrent edit',
  );
});
