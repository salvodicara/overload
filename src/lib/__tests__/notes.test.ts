import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const pushRecord = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const startSync = vi.hoisted(() => vi.fn(() => ({ stop: async () => undefined })));
vi.mock('../sync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sync')>()),
  pushRecord,
  startSync,
}));

import { db, saveNote, saveRoutine } from '../db';
import { exerciseJournal } from '../notes';
import type { ExerciseNote, Routine, Workout } from '../types';
import { useStore } from '../../state/useStore';
import workoutSource from '../../screens/Workout.tsx?raw';

const storage = new Map<string, string>();

const routineWith = (exerciseId: string, note: string): Routine => ({
  id: crypto.randomUUID(),
  name: 'Routine',
  exercises: [{ exerciseId, sets: 3, repMin: 8, repMax: 10, restSec: 90, note }],
  updatedAt: 1,
});

const workoutWithNote = (
  id: string,
  date: string,
  startTs: number,
  exerciseId: string,
  text: string,
): Workout => ({
  id,
  date,
  startTs,
  sets: [],
  volumeKg: 0,
  updatedAt: startTs,
  source: 'app',
  exerciseNotes: [{ exerciseId, text }],
});

describe('exercise journal', () => {
  it('keeps two notes from two workouts on the same day', () => {
    const workouts = [
      workoutWithNote('late', '2026-08-25', 200, 'bench', 'Shoulder fine'),
      workoutWithNote('early', '2026-08-25', 100, 'bench', 'Seat 4'),
    ];

    expect(exerciseJournal(workouts, undefined, 'bench').map((entry) => entry.text)).toEqual([
      'Shoulder fine',
      'Seat 4',
    ]);
  });

  it('uses workout identities and appends legacy dated entries', () => {
    const workouts = [
      workoutWithNote('older-day', '2026-08-24', 300, 'bench', 'Older workout'),
      workoutWithNote('latest', '2026-08-25', 200, 'bench', 'Latest workout'),
    ];
    const note: ExerciseNote = {
      id: 'bench',
      technique: 'Technique',
      entries: [
        { date: '2026-08-22', text: 'Old import' },
        { date: '2026-08-23', text: 'New import' },
      ],
      updatedAt: 1,
    };

    expect(exerciseJournal(workouts, note, 'bench')).toEqual([
      { id: 'workout:latest', date: '2026-08-25', text: 'Latest workout' },
      { id: 'workout:older-day', date: '2026-08-24', text: 'Older workout' },
      { id: 'legacy:2026-08-23:1', date: '2026-08-23', text: 'New import' },
      { id: 'legacy:2026-08-22:0', date: '2026-08-22', text: 'Old import' },
    ]);
  });
});

describe('note persistence', () => {
  beforeEach(async () => {
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });
    useStore.getState().setUser(null);
    await vi.waitFor(() => expect(useStore.getState().authState).toBe('signedOut'));
    storage.clear();
    pushRecord.mockClear();
    await Promise.all([db.notes.clear(), db.routines.clear(), db.workouts.clear()]);
    useStore.setState({
      user: null,
      notes: [],
      routines: [],
      workouts: [],
      active: null,
      pendingRoutineChanges: null,
    });
    storage.set('overload_uid', 'user-1');
    useStore.getState().setUser({ uid: 'user-1', name: null });
    await vi.waitFor(() => expect(useStore.getState().authState).toBe('ready'));
    pushRecord.mockClear();
  });

  it('reload keeps a routine note scoped to its routine occurrence', async () => {
    const routine = routineWith('bench', '  Scapole ferme  ');
    const imported: ExerciseNote = {
      id: 'bench',
      entries: [{ date: '2026-08-20', text: 'Legacy import' }],
      updatedAt: 20,
    };
    await saveRoutine(routine);
    await saveNote(imported);

    await useStore.getState().reload();
    const reloadedRoutine = useStore.getState().routines[0];
    await useStore.getState().reload();

    expect(reloadedRoutine.exercises[0].note).toBe('  Scapole ferme  ');
    expect(useStore.getState().notes).toEqual([imported]);
    expect(await db.notes.get('bench')).toEqual(imported);
  });

  it('stores only non-empty trimmed session notes on the finished workout', async () => {
    const legacy: ExerciseNote = {
      id: 'bench',
      entries: [{ date: '2026-08-25', text: 'Imported legacy note' }],
      updatedAt: 1,
    };
    await saveNote(legacy);
    useStore.setState({
      notes: [legacy],
      active: {
        routineId: 'routine',
        startTs: 1,
        ex: [
          {
            exerciseId: 'bench',
            tracking: 'weight_reps',
            hintKey: 'suggest.start',
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
          {
            exerciseId: 'squat',
            tracking: 'weight_reps',
            hintKey: 'suggest.start',
            sessionNote: '   ',
            sets: [
              {
                weightKg: 80,
                reps: 5,
                durationSec: null,
                kind: 'working',
                done: false,
              },
            ],
          },
        ],
      },
    });

    useStore.getState().updateSessionNote(0, '  Shoulder fine  ');

    const result = await useStore.getState().finishWorkout();
    expect(result.status).toBe('applied');
    const workout = result.status === 'applied' ? result.value : null;

    expect(workout?.exerciseNotes).toEqual([{ exerciseId: 'bench', text: 'Shoulder fine' }]);
    expect((await db.workouts.get(workout?.id ?? ''))?.exerciseNotes).toEqual([
      { exerciseId: 'bench', text: 'Shoulder fine' },
    ]);
    expect(useStore.getState().notes).toEqual([legacy]);
    expect(await db.notes.get('bench')).toEqual(legacy);
  });
});

describe('active Workout note API contract', () => {
  it('renders the routine occurrence note and keeps session notes on the workout', () => {
    expect(workoutSource).not.toContain('addNoteEntry');
    expect(workoutSource).not.toContain('queueTechniqueNote');
    expect(workoutSource).not.toContain('saveTechniqueNote');
    expect(workoutSource).toContain('routine.exercises[exerciseIndex]');
    expect(workoutSource).toContain('prescription?.note');
    expect(workoutSource).toContain('updateSessionNote');
    expect(workoutSource).toContain('e.sessionNote');
  });
});
