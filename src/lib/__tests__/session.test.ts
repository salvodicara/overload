import 'fake-indexeddb/auto';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildActiveExercise, completedSets } from '../session';

vi.mock('../sync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sync')>()),
  pushRecord: vi.fn(() => Promise.resolve()),
  startSync: vi.fn(() => ({ stop: async () => undefined })),
}));
vi.mock('../wakeLock', () => ({
  acquireWakeLock: vi.fn(),
  releaseWakeLock: vi.fn(),
}));

const storage = new Map<string, string>();
let useStore: typeof import('../../state/useStore').useStore;

beforeAll(async () => {
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  ({ useStore } = await import('../../state/useStore'));
});

beforeEach(async () => {
  useStore.getState().setUser(null);
  await vi.waitFor(() => expect(useStore.getState().authState).toBe('signedOut'));
  storage.clear();
  useStore.setState({ active: null });
});

describe('active session helpers', () => {
  it('prepends editable warm-up rows and creates working rows', () => {
    const active = buildActiveExercise(
      {
        exerciseId: 'squat',
        sets: 3,
        repMin: 5,
        repMax: 5,
        restSec: 120,
        warmupSets: [
          { weightKg: 20, reps: 8 },
          { weightKg: 40, reps: 5 },
        ],
      },
      [],
    );

    expect(active.sets.map((set) => set.kind)).toEqual([
      'warmup',
      'warmup',
      'working',
      'working',
      'working',
    ]);
  });

  it('builds duration rows without fake repetitions', () => {
    const active = buildActiveExercise(
      {
        exerciseId: 'plank',
        sets: 2,
        repMin: 45,
        repMax: 60,
        restSec: 60,
        tracking: 'duration',
      },
      [],
    );

    expect(active.tracking).toBe('duration');
    expect(active.sets[0]).toMatchObject({ durationSec: 45, reps: null, weightKg: null });
  });

  it('builds repetition rows without fake weights', () => {
    const active = buildActiveExercise(
      {
        exerciseId: 'pushup',
        sets: 2,
        repMin: 12,
        repMax: 15,
        restSec: 60,
        tracking: 'reps',
      },
      [],
    );

    expect(active.tracking).toBe('reps');
    expect(active.sets[0]).toMatchObject({ durationSec: null, reps: 12, weightKg: null });
  });

  it('serializes only completed rows and carries tracking and kind', () => {
    expect(
      completedSets({
        exerciseId: 'squat',
        tracking: 'weight_reps',
        hintKey: 'suggest.repeat',
        sets: [
          { weightKg: 20, reps: 8, durationSec: null, kind: 'warmup', done: true },
          { weightKg: 60, reps: 5, durationSec: null, kind: 'working', done: false },
        ],
      }),
    ).toEqual([
      {
        exerciseId: 'squat',
        weightKg: 20,
        reps: 8,
        done: true,
        tracking: 'weight_reps',
        kind: 'warmup',
      },
    ]);
  });

  it('serializes duration with legacy zeroes and duration metadata', () => {
    expect(
      completedSets({
        exerciseId: 'plank',
        tracking: 'duration',
        hintKey: 'suggest.start',
        sets: [
          {
            weightKg: null,
            reps: null,
            durationSec: 45,
            kind: 'working',
            done: true,
          },
        ],
      }),
    ).toEqual([
      {
        exerciseId: 'plank',
        weightKg: 0,
        reps: 0,
        durationSec: 45,
        done: true,
        tracking: 'duration',
        kind: 'working',
      },
    ]);
  });

  it('persists session notes immediately', () => {
    useStore.setState({
      active: {
        routineId: 'routine',
        startTs: 1,
        ex: [
          {
            exerciseId: 'squat',
            tracking: 'weight_reps',
            hintKey: 'suggest.start',
            sets: [
              {
                weightKg: 60,
                reps: null,
                durationSec: null,
                kind: 'working',
                done: false,
              },
            ],
          },
        ],
      },
    });

    useStore.getState().updateSessionNote(0, 'Keep the brace tight');

    expect(useStore.getState().active?.ex[0].sessionNote).toBe('Keep the brace tight');
    expect(JSON.parse(storage.get('overload_active') ?? 'null').ex[0].sessionNote).toBe(
      'Keep the brace tight',
    );
  });

  it('persists set kind changes immediately', () => {
    useStore.setState({
      active: {
        routineId: 'routine',
        startTs: 1,
        ex: [
          {
            exerciseId: 'squat',
            tracking: 'weight_reps',
            hintKey: 'suggest.start',
            sets: [
              {
                weightKg: 20,
                reps: 8,
                durationSec: null,
                kind: 'warmup',
                done: false,
              },
            ],
          },
        ],
      },
    });

    useStore.getState().toggleSetKind(0, 0);

    expect(useStore.getState().active?.ex[0].sets[0].kind).toBe('working');
    expect(JSON.parse(storage.get('overload_active') ?? 'null').ex[0].sets[0].kind).toBe('working');
  });

  it('rehydrates legacy active rows before add, completion, and routine proposals', async () => {
    const legacy = {
      routineId: 'routine',
      startTs: 1,
      ex: [
        {
          exerciseId: 'squat',
          hintKey: 'suggest.repeat',
          sets: [{ weightKg: 60, reps: 5, done: true }],
        },
      ],
    };
    storage.set('overload_active', JSON.stringify(legacy));
    vi.resetModules();
    const { db } = await import('../db');
    await db.workouts.clear();
    const { useStore: rehydratedStore } = await import('../../state/useStore');

    storage.set('overload_uid', 'user-1');
    rehydratedStore.getState().setUser({ uid: 'user-1', name: null });
    await vi.waitFor(() => expect(rehydratedStore.getState().authState).toBe('ready'));

    expect(rehydratedStore.getState().active).toEqual({
      routineId: 'routine',
      startTs: 1,
      ex: [
        {
          exerciseId: 'squat',
          tracking: 'weight_reps',
          hintKey: 'suggest.repeat',
          sets: [
            {
              weightKg: 60,
              reps: 5,
              durationSec: null,
              kind: 'working',
              done: true,
            },
          ],
        },
      ],
    });
    expect(JSON.parse(storage.get('overload_active') ?? 'null')).toEqual(
      rehydratedStore.getState().active,
    );

    rehydratedStore.setState({
      routines: [
        {
          id: 'routine',
          name: 'Legacy routine',
          exercises: [
            {
              exerciseId: 'squat',
              sets: 2,
              repMin: 5,
              repMax: 5,
              restSec: 120,
            },
          ],
          updatedAt: 1,
        },
      ],
      workouts: [],
    });

    rehydratedStore.getState().addSet(0);
    expect(rehydratedStore.getState().active?.ex[0].sets[1]).toEqual({
      weightKg: 60,
      reps: null,
      durationSec: null,
      kind: 'working',
      done: false,
    });

    const result = await rehydratedStore.getState().finishWorkout();
    expect(result.status).toBe('applied');
    const workout = result.status === 'applied' ? result.value : null;
    expect(workout?.sets).toEqual([
      {
        exerciseId: 'squat',
        weightKg: 60,
        reps: 5,
        done: true,
        tracking: 'weight_reps',
        kind: 'working',
      },
    ]);
    expect(rehydratedStore.getState().pendingRoutineChanges).toEqual({
      routineId: 'routine',
      items: [{ exerciseId: 'squat', sets: 1 }],
    });
  });
});
