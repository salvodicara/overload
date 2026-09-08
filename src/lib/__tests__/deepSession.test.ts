import 'fake-indexeddb/auto';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
vi.mock('../sync', () => ({
  startSync: () => ({ stop: async () => {} }),
  pushRecord: async () => {},
  pushRecordStrict: async () => {},
  deleteRecord: async () => {},
}));
import { useStore } from '../../state/useStore';
import { buildActiveExercise } from '../session';
import type { Routine } from '../types';
const storage = new Map<string, string>();
const routine: Routine = {
  id: 'repeat',
  name: 'Repeated squat',
  updatedAt: 1,
  exercises: [
    { exerciseId: 'squat', occurrenceId: 'heavy', sets: 1, repMin: 5, repMax: 5, restSec: 180 },
    { exerciseId: 'squat', occurrenceId: 'light', sets: 1, repMin: 12, repMax: 12, restSec: 45 },
  ],
};
beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  storage.clear();
  useStore.setState({
    routines: [routine],
    active: {
      routineId: routine.id,
      startTs: Date.now(),
      ex: routine.exercises.map((rx) => buildActiveExercise(rx, [], routine.id)),
    },
    restUntil: null,
  });
});
afterEach(() => vi.unstubAllGlobals());
it('keeps the rest deadline through subsequent set and note edits', () => {
  useStore.getState().startRest(90, 'squat');
  const deadline = useStore.getState().restUntil;
  useStore.getState().updateSet(0, 0, { weightKg: 40 });
  useStore.getState().updateSessionNote(0, 'Keep form');
  expect(JSON.parse(storage.get('overload_active')!).restUntil).toBe(deadline);
  expect(useStore.getState().active?.restUntil).toBe(deadline);
});
it('does not revive a stopped rest deadline on the next edit', () => {
  const active = useStore.getState().active!;
  useStore.setState({ active: { ...active, restUntil: Date.now() + 90000 } });
  useStore.getState().stopRest();
  useStore.getState().updateSet(0, 0, { weightKg: 40 });
  expect(JSON.parse(storage.get('overload_active')!).restUntil).toBeNull();
});
it('uses the exact repeated occurrence for reps and rest', () => {
  useStore.getState().updateSet(1, 0, { weightKg: 20 });
  useStore.getState().toggleDone(1, 0);
  expect(useStore.getState().active?.ex[1].sets[0].reps).toBe(12);
  expect(useStore.getState().restTotalSec).toBe(45);
});
it.each([
  { weightKg: -10, reps: 8 },
  { weightKg: 20, reps: 1.5 },
  { weightKg: Infinity, reps: 8 },
])('rejects invalid completed weighted values %j', (patch) => {
  useStore.getState().updateSet(0, 0, patch);
  useStore.getState().toggleDone(0, 0);
  expect(useStore.getState().active?.ex[0].sets[0].done).toBe(false);
});
it('rejects an empty completed timed set', () => {
  const active = useStore.getState().active!;
  active.ex[0].tracking = 'duration';
  active.ex[0].sets[0].durationSec = null;
  useStore.setState({ active });
  useStore.getState().toggleDone(0, 0);
  expect(useStore.getState().active?.ex[0].sets[0].done).toBe(false);
});
it('keeps requested tracking when adding or replacing an active exercise', () => {
  useStore.getState().addWorkoutExercise('plank', 'duration');
  expect(useStore.getState().active?.ex.at(-1)?.tracking).toBe('duration');
  useStore.getState().replaceWorkoutExercise('heavy', 'pushups', 'reps');
  expect(useStore.getState().active?.ex[0].tracking).toBe('reps');
});
