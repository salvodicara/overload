import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildActiveExercise, completedSets } from '../session';

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

beforeEach(() => {
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
});
