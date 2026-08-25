import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const pushRecord = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock('../sync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sync')>()),
  pushRecord,
}));

import { db, saveNote, saveRoutine } from '../db';
import { exerciseJournal, routineTechniqueMigrations } from '../notes';
import type { ExerciseNote, Routine, Workout } from '../types';
import { useStore } from '../../state/useStore';
import workoutSource from '../../screens/Workout.tsx?raw';

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

describe('routine technique migration', () => {
  it('deduplicates legacy routine notes into one technique note', () => {
    const routines = [
      routineWith('bench', 'Scapole ferme'),
      routineWith('bench', 'Scapole ferme'),
      routineWith('bench', 'Piedi stabili'),
    ];

    expect(routineTechniqueMigrations(routines, [])).toEqual([
      { id: 'bench', technique: 'Scapole ferme\n\nPiedi stabili', entries: [], updatedAt: 0 },
    ]);
  });

  it('does not overwrite an existing technique note', () => {
    const existing: ExerciseNote = {
      id: 'bench',
      technique: 'Keep this',
      entries: [{ date: '2026-08-20', text: 'Legacy entry' }],
      updatedAt: 20,
    };

    expect(routineTechniqueMigrations([routineWith('bench', 'Routine note')], [existing])).toEqual(
      [],
    );
  });

  it('preserves legacy entries and is idempotent after the migration is merged', () => {
    const existing: ExerciseNote = {
      id: 'bench',
      entries: [{ date: '2026-08-20', text: 'Legacy entry' }],
      updatedAt: 20,
    };
    const [migration] = routineTechniqueMigrations([routineWith('bench', 'Routine note')], [existing]);

    expect(migration).toEqual({
      id: 'bench',
      technique: 'Routine note',
      entries: [{ date: '2026-08-20', text: 'Legacy entry' }],
      updatedAt: 20,
    });
    expect(routineTechniqueMigrations([routineWith('bench', 'Routine note')], [migration])).toEqual(
      [],
    );
  });
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
  });

  it('reload migrates a routine note once and preserves imported entries', async () => {
    const routine = routineWith('bench', '  Scapole ferme  ');
    const imported: ExerciseNote = {
      id: 'bench',
      entries: [{ date: '2026-08-20', text: 'Legacy import' }],
      updatedAt: 20,
    };
    await saveRoutine(routine);
    await saveNote(imported);

    await useStore.getState().reload();
    const once = useStore.getState().notes[0];
    await useStore.getState().reload();

    expect(once).toEqual({ ...imported, technique: 'Scapole ferme' });
    expect(useStore.getState().notes).toEqual([once]);
    expect(await db.notes.get('bench')).toEqual(once);
  });

  it('saves a trimmed technique while preserving legacy entries and allows clearing it', async () => {
    const existing: ExerciseNote = {
      id: 'bench',
      technique: 'Old technique',
      entries: [{ date: '2026-08-20', text: 'Legacy import' }],
      updatedAt: 1,
    };
    await saveNote(existing);
    useStore.setState({ notes: [existing] });

    await useStore.getState().saveTechniqueNote('bench', '  New technique  ');
    expect(useStore.getState().notes[0]).toMatchObject({
      id: 'bench',
      technique: 'New technique',
      entries: existing.entries,
    });

    await useStore.getState().saveTechniqueNote('bench', '   ');
    expect(useStore.getState().notes[0].technique).toBe('');
    expect((await db.notes.get('bench'))?.technique).toBe('');
  });

  it('pushes a migrated routine technique when authenticated', async () => {
    await saveRoutine(routineWith('bench', 'Scapole ferme'));
    useStore.setState({ user: { uid: 'user-1', name: null } });

    await useStore.getState().reload();

    expect(pushRecord).toHaveBeenCalledWith('user-1', 'notes', {
      id: 'bench',
      technique: 'Scapole ferme',
      entries: [],
      updatedAt: 0,
    });
  });

  it('pushes a saved technique when authenticated', async () => {
    useStore.setState({ user: { uid: 'user-1', name: null } });

    await useStore.getState().saveTechniqueNote('bench', 'Brace hard');

    expect(pushRecord).toHaveBeenCalledWith(
      'user-1',
      'notes',
      expect.objectContaining({ id: 'bench', technique: 'Brace hard', entries: [] }),
    );
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

    const workout = await useStore.getState().finishWorkout();

    expect(workout?.exerciseNotes).toEqual([{ exerciseId: 'bench', text: 'Shoulder fine' }]);
    expect((await db.workouts.get(workout?.id ?? ''))?.exerciseNotes).toEqual([
      { exerciseId: 'bench', text: 'Shoulder fine' },
    ]);
    expect(useStore.getState().notes).toEqual([legacy]);
    expect(await db.notes.get('bench')).toEqual(legacy);
  });
});

describe('active Workout note API contract', () => {
  it('uses Technique and This session actions without the legacy dated-entry action', () => {
    expect(workoutSource).not.toContain('addNoteEntry');
    expect(workoutSource).toContain('saveTechniqueNote');
    expect(workoutSource).toContain('updateSessionNote');
    expect(workoutSource).toContain('note?.technique');
    expect(workoutSource).toContain('e.sessionNote');
  });
});
