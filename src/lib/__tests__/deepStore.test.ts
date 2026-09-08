import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, it, expect, vi } from 'vitest';
vi.mock('../sync', () => ({
  startSync: () => ({ stop: async () => {} }),
  pushRecord: async () => {},
  pushRecordStrict: async () => {},
  deleteRecord: async () => {},
}));
import { db } from '../db';
import { useStore } from '../../state/useStore';
const storage = new Map<string, string>();
beforeEach(async () => {
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
  });
  useStore.getState().setUser(null);
  await useStore.getState().init();
  await db.delete();
  await db.open();
  storage.clear();
  useStore.getState().setUser({ uid: 'audit', name: null });
  await useStore.getState().init();
  useStore.setState({
    route: { view: 'workout' },
    active: {
      routineId: 'r',
      startTs: new Date('2026-09-07T23:30:00').getTime(),
      ex: [
        {
          exerciseId: 'squat',
          instanceId: 'one',
          tracking: 'weight_reps',
          hintKey: '',
          sets: [{ weightKg: 40, reps: 8, durationSec: null, kind: 'working', done: true }],
        },
      ],
    },
  });
});
afterEach(async () => {
  useStore.getState().setUser(null);
  await useStore.getState().init();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('uses the session start day after midnight', async () => {
  await useStore.getState().finishWorkout();
  expect(useStore.getState().workouts[0].date).toBe('2026-09-07');
});
it('does not redirect a newer screen or finish a replacement session', async () => {
  const original = db.workouts.put.bind(db.workouts);
  let release!: () => void;
  const held = new Promise<void>((r) => {
    release = r;
  });
  vi.spyOn(db.workouts, 'put').mockImplementationOnce((async (...args: any[]) => {
    await Dexie.waitFor(held);
    return original(args[0]);
  }) as any);
  const saving = useStore.getState().finishWorkout();
  await vi.waitFor(() => expect(db.workouts.put).toHaveBeenCalled());
  useStore.setState({ route: { view: 'profile' } });
  release();
  await saving;
  expect(useStore.getState().route.view).toBe('profile');
  expect(useStore.getState().active).toBeNull();
});
it('freezes active edits and avoids duplicate completed workouts during a pending finish', async () => {
  const original = db.workouts.put.bind(db.workouts);
  let release!: () => void;
  const held = new Promise<void>((r) => {
    release = r;
  });
  vi.spyOn(db.workouts, 'put').mockImplementationOnce((async (...args: any[]) => {
    await Dexie.waitFor(held);
    return original(args[0]);
  }) as any);
  const saving = useStore.getState().finishWorkout();
  await vi.waitFor(() => expect(db.workouts.put).toHaveBeenCalled());
  useStore.getState().updateSet(0, 0, { weightKg: 99 });
  void useStore.getState().finishWorkout();
  const weight = useStore.getState().active?.ex[0].sets[0].weightKg;
  release();
  await saving;
  expect(weight).toBe(40);
  expect(useStore.getState().workouts).toHaveLength(1);
});
it('recalculates personal-record flags after a historical workout is deleted', async () => {
  const base = {
    date: '2026-09-07',
    startTs: 10,
    updatedAt: 1,
    source: 'app' as const,
    volumeKg: 400,
  };
  const workouts = [
    { ...base, id: 'first', sets: [{ exerciseId: 'squat', weightKg: 50, reps: 8, done: true }] },
    {
      ...base,
      id: 'second',
      startTs: 20,
      sets: [{ exerciseId: 'squat', weightKg: 60, reps: 8, done: true, isPr: true }],
    },
  ];
  await db.workouts.bulkPut(workouts);
  useStore.setState({ workouts });
  await useStore.getState().deleteWorkout('first');
  const remaining = useStore.getState().workouts[0];
  expect(remaining.sets[0].isPr).not.toBe(true);
  expect(remaining.updatedAt).toBeGreaterThan(1);
  expect((await db.workouts.get('second'))?.sets[0].isPr).not.toBe(true);
});
