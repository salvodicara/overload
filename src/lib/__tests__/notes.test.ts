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
import { exerciseJournal, routineTechniqueMigrations } from '../notes';
import type { ExerciseNote, Routine, Workout } from '../types';
import { useStore } from '../../state/useStore';
import workoutSource from '../../screens/Workout.tsx?raw';
import noteEditorSource from '../../components/NoteEditor.tsx?raw';
import storeSource from '../../state/useStore.ts?raw';

const storage = new Map<string, string>();

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function fakeTechniqueTimer() {
  const realSetTimeout = globalThis.setTimeout;
  const realClearTimeout = globalThis.clearTimeout;
  const techniqueTimer = 1234 as unknown as ReturnType<typeof setTimeout>;
  let releaseTechniqueTimer!: () => void;
  const cleared = vi.fn();
  const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementation(((
    handler: TimerHandler,
    delay?: number,
    ...args: unknown[]
  ) => {
    if (delay === 500 && typeof handler === 'function') {
      releaseTechniqueTimer = () => handler(...args);
      return techniqueTimer;
    }
    return realSetTimeout(handler, delay, ...args);
  }) as typeof setTimeout);
  const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout').mockImplementation((timer) => {
    if (timer === techniqueTimer) cleared();
    else realClearTimeout(timer);
  });
  return {
    cleared,
    release: () => releaseTechniqueTimer(),
    restore() {
      clearTimeoutSpy.mockRestore();
      setTimeoutSpy.mockRestore();
    },
  };
}

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
    const [migration] = routineTechniqueMigrations(
      [routineWith('bench', 'Routine note')],
      [existing],
    );

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
    const existing: ExerciseNote = {
      id: 'bench',
      entries: [{ date: '2026-08-20', text: 'Legacy import' }],
      updatedAt: 20,
    };
    await saveRoutine(routineWith('bench', 'Scapole ferme'));
    await saveNote(existing);

    await useStore.getState().reload();

    expect(pushRecord).toHaveBeenCalledWith('user-1', 'notes', {
      id: 'bench',
      technique: 'Scapole ferme',
      entries: existing.entries,
      updatedAt: 20,
    });
  });

  it('publishes a boot migration after readiness without making init wait for the network', async () => {
    useStore.getState().setUser(null);
    await vi.waitFor(() => expect(useStore.getState().authState).toBe('signedOut'));
    const existing: ExerciseNote = {
      id: 'bench',
      entries: [{ date: '2026-08-20', text: 'Same timestamp remotely' }],
      updatedAt: 20,
    };
    await saveRoutine(routineWith('bench', 'Boot technique'));
    await saveNote(existing);
    pushRecord.mockClear();
    const remote = deferred<void>();
    pushRecord.mockReturnValueOnce(remote.promise);

    useStore.getState().setUser({ uid: 'user-1', name: null });
    const init = useStore.getState().init();
    try {
      await vi.waitFor(() => expect(useStore.getState().authState).toBe('ready'));
      await vi.waitFor(() =>
        expect(pushRecord).toHaveBeenCalledWith('user-1', 'notes', {
          ...existing,
          technique: 'Boot technique',
        }),
      );
      const settled = vi.fn();
      void init.then(settled);
      await vi.waitFor(() => expect(settled).toHaveBeenCalledOnce());
    } finally {
      remote.resolve();
      await init;
    }
  });

  it('publishes the final migration record created while importing workouts', async () => {
    const existing: ExerciseNote = {
      id: 'bench',
      entries: [{ date: '2026-08-20', text: 'Same timestamp remotely' }],
      updatedAt: 20,
    };
    await saveRoutine(routineWith('bench', 'Imported technique'));
    await saveNote(existing);
    useStore.setState({ routines: [], notes: [] });
    pushRecord.mockClear();

    await useStore.getState().importWorkouts([]);

    expect(pushRecord).toHaveBeenCalledWith('user-1', 'notes', {
      ...existing,
      technique: 'Imported technique',
    });
  });

  it('drops a queued Technique edit when its account is invalidated before the timer fires', async () => {
    const timer = fakeTechniqueTimer();
    try {
      useStore.getState().queueTechniqueNote('bench', 'Account A text');

      storage.set('overload_uid', 'user-1');
      useStore.getState().setUser({ uid: 'user-2', name: null });
      await useStore.getState().init();
      expect(timer.cleared).toHaveBeenCalledOnce();
      pushRecord.mockClear();
      timer.release();
      await Promise.resolve();

      expect(useStore.getState().user?.uid).toBe('user-2');
      expect(useStore.getState().notes).toEqual([]);
      expect(await db.notes.get('bench')).toBeUndefined();
      expect(pushRecord).not.toHaveBeenCalledWith(
        'user-2',
        'notes',
        expect.objectContaining({ technique: 'Account A text' }),
      );
    } finally {
      timer.restore();
    }
  });

  it('saves a queued Technique edit for the same account after the debounce', async () => {
    const timer = fakeTechniqueTimer();
    try {
      useStore.getState().queueTechniqueNote('bench', '  Same account text  ');
      timer.release();
      await vi.waitFor(() =>
        expect(useStore.getState().notes).toEqual([
          expect.objectContaining({ id: 'bench', technique: 'Same account text' }),
        ]),
      );

      expect(await db.notes.get('bench')).toEqual(
        expect.objectContaining({ id: 'bench', technique: 'Same account text' }),
      );
      expect(pushRecord).toHaveBeenCalledWith(
        'user-1',
        'notes',
        expect.objectContaining({ id: 'bench', technique: 'Same account text' }),
      );
    } finally {
      timer.restore();
    }
  });

  it('settles a failed debounce save so a later Technique retry can persist', async () => {
    const timer = fakeTechniqueTimer();
    const put = vi.spyOn(db.notes, 'put').mockRejectedValueOnce(new Error('disk full'));
    try {
      useStore.getState().queueTechniqueNote('bench', 'Failed debounce');
      timer.release();
      await vi.waitFor(() => expect(put).toHaveBeenCalledOnce());
      await new Promise((resolve) => setTimeout(resolve, 0));

      await expect(
        useStore.getState().saveTechniqueNote('bench', 'Recovered cue'),
      ).resolves.toMatchObject({
        status: 'applied',
      });
      expect((await db.notes.get('bench'))?.technique).toBe('Recovered cue');
    } finally {
      put.mockRestore();
      timer.restore();
    }
  });

  it('uses the existing Technique save boundary to consume a queued draft once', async () => {
    const timer = fakeTechniqueTimer();
    try {
      useStore.getState().queueTechniqueNote('bench', '  Brace before unracking  ');

      const result = await useStore
        .getState()
        .saveTechniqueNote('bench', '  Brace before unracking  ');

      expect(result.status).toBe('applied');
      expect(useStore.getState().notes).toEqual([
        expect.objectContaining({ id: 'bench', technique: 'Brace before unracking' }),
      ]);
      expect(await db.notes.get('bench')).toEqual(
        expect.objectContaining({ id: 'bench', technique: 'Brace before unracking' }),
      );
      expect(pushRecord).toHaveBeenCalledTimes(1);

      timer.release();
      await Promise.resolve();
      expect(pushRecord).toHaveBeenCalledTimes(1);
    } finally {
      timer.restore();
    }
  });

  it('commits Done for account A before an account switch and never sends it to account B', async () => {
    useStore.getState().queueTechniqueNote('bench', 'Account A cue');
    const result = await useStore.getState().saveTechniqueNote('bench', 'Account A cue');

    expect(result.status).toBe('applied');
    expect(await db.notes.get('bench')).toEqual(
      expect.objectContaining({ technique: 'Account A cue' }),
    );
    expect(pushRecord).toHaveBeenCalledWith(
      'user-1',
      'notes',
      expect.objectContaining({ id: 'bench', technique: 'Account A cue' }),
    );

    storage.set('overload_uid', 'user-1');
    useStore.getState().setUser({ uid: 'user-2', name: null });
    await useStore.getState().init();

    expect(useStore.getState().user?.uid).toBe('user-2');
    expect(pushRecord).not.toHaveBeenCalledWith(
      'user-2',
      'notes',
      expect.objectContaining({ technique: 'Account A cue' }),
    );
  });

  it('keeps the final Done text when it races an already-started debounce save', async () => {
    const timer = fakeTechniqueTimer();
    try {
      useStore.getState().queueTechniqueNote('bench', 'First cue');
      timer.release();
      useStore.getState().queueTechniqueNote('bench', 'Final cue');

      await useStore.getState().saveTechniqueNote('bench', 'Final cue');

      expect(await db.notes.get('bench')).toEqual(
        expect.objectContaining({ technique: 'Final cue' }),
      );
      expect(useStore.getState().notes).toEqual([
        expect.objectContaining({ id: 'bench', technique: 'Final cue' }),
      ]);
    } finally {
      timer.restore();
    }
  });

  it('hands an admitted Done commit to account A when account B starts before its local write settles', async () => {
    const write = deferred<string>();
    const remote = deferred<void>();
    const originalPut = db.notes.put.bind(db.notes);
    const put = vi
      .spyOn(db.notes, 'put')
      .mockImplementationOnce(
        (note) => write.promise.then(() => originalPut(note)) as ReturnType<typeof db.notes.put>,
      );
    pushRecord.mockReturnValueOnce(remote.promise);
    const commit = useStore.getState().saveTechniqueNote('bench', 'Account A durable cue');
    try {
      await vi.waitFor(() => expect(put).toHaveBeenCalledOnce());
      storage.set('overload_uid', 'user-1');
      useStore.getState().setUser({ uid: 'user-2', name: null });
      expect(useStore.getState().authState).toBe('loading');

      write.resolve('bench');
      await vi.waitFor(() =>
        expect(pushRecord).toHaveBeenCalledWith(
          'user-1',
          'notes',
          expect.objectContaining({ id: 'bench', technique: 'Account A durable cue' }),
        ),
      );
      await expect(commit).resolves.toEqual({ status: 'stale' });
      await useStore.getState().init();

      expect(useStore.getState().user?.uid).toBe('user-2');
      expect(await db.notes.get('bench')).toBeUndefined();
      expect(pushRecord).not.toHaveBeenCalledWith(
        'user-2',
        'notes',
        expect.objectContaining({ technique: 'Account A durable cue' }),
      );
      await expect(
        useStore.getState().saveTechniqueNote('bench', 'Account B cue'),
      ).resolves.toMatchObject({
        status: 'applied',
      });
      expect((await db.notes.get('bench'))?.technique).toBe('Account B cue');
      expect(pushRecord).toHaveBeenCalledWith(
        'user-2',
        'notes',
        expect.objectContaining({ technique: 'Account B cue' }),
      );
    } finally {
      write.resolve('bench');
      remote.resolve();
      await commit.catch(() => {});
      put.mockRestore();
    }
  });

  it('reserves a final A save ahead of B clearing while an earlier local save is pending', async () => {
    const firstWrite = deferred<string>();
    const finalWrite = deferred<string>();
    const originalPut = db.notes.put.bind(db.notes);
    const put = vi
      .spyOn(db.notes, 'put')
      .mockImplementationOnce(
        (note) =>
          firstWrite.promise.then(() => originalPut(note)) as ReturnType<typeof db.notes.put>,
      )
      .mockImplementationOnce(
        (note) =>
          finalWrite.promise.then(() => originalPut(note)) as ReturnType<typeof db.notes.put>,
      );
    const clear = vi.spyOn(db.notes, 'clear');
    const first = useStore.getState().saveTechniqueNote('bench', 'First A value');
    let final: Promise<unknown> | undefined;
    try {
      await vi.waitFor(() => expect(put).toHaveBeenCalledOnce());
      final = useStore.getState().saveTechniqueNote('bench', 'Final A value');
      storage.set('overload_uid', 'user-1');
      useStore.getState().setUser({ uid: 'user-2', name: null });
      await Promise.resolve();
      await Promise.resolve();

      firstWrite.resolve('bench');
      await vi.waitFor(() => expect(put).toHaveBeenCalledTimes(2));
      expect(clear).not.toHaveBeenCalled();
      finalWrite.resolve('bench');
      await vi.waitFor(() =>
        expect(pushRecord).toHaveBeenCalledWith(
          'user-1',
          'notes',
          expect.objectContaining({ id: 'bench', technique: 'Final A value' }),
        ),
      );
      await expect(first).resolves.toEqual({ status: 'stale' });
      await expect(final).resolves.toEqual({ status: 'stale' });
      await useStore.getState().init();

      expect(useStore.getState().user?.uid).toBe('user-2');
      expect(useStore.getState().notes).toEqual([]);
      expect(await db.notes.get('bench')).toBeUndefined();
      expect(pushRecord).not.toHaveBeenCalledWith(
        'user-2',
        'notes',
        expect.objectContaining({ technique: 'Final A value' }),
      );
    } finally {
      firstWrite.resolve('bench');
      finalWrite.resolve('bench');
      await first.catch(() => {});
      await final?.catch(() => {});
      put.mockRestore();
      clear.mockRestore();
    }
  });

  it('orders a newer public Technique save behind a deferred debounce handoff', async () => {
    const timer = fakeTechniqueTimer();
    const firstRemote = deferred<void>();
    const secondRemote = deferred<void>();
    pushRecord.mockReturnValueOnce(firstRemote.promise).mockReturnValueOnce(secondRemote.promise);
    let second: Promise<unknown> | undefined;
    try {
      useStore.getState().queueTechniqueNote('bench', 'First remote value');
      timer.release();
      await vi.waitFor(() => expect(pushRecord).toHaveBeenCalledTimes(1));

      second = useStore.getState().saveTechniqueNote('bench', 'Newest value');
      await vi.waitFor(() =>
        expect(useStore.getState().notes).toEqual([
          expect.objectContaining({ id: 'bench', technique: 'Newest value' }),
        ]),
      );
      expect((await db.notes.get('bench'))?.technique).toBe('Newest value');
      expect(pushRecord).toHaveBeenCalledTimes(1);

      firstRemote.resolve();
      await vi.waitFor(() => expect(pushRecord).toHaveBeenCalledTimes(2));
      expect(pushRecord.mock.calls.at(-1)).toEqual([
        'user-1',
        'notes',
        expect.objectContaining({ id: 'bench', technique: 'Newest value' }),
      ]);
      secondRemote.resolve();
      await expect(second).resolves.toMatchObject({ status: 'applied' });
    } finally {
      firstRemote.resolve();
      secondRemote.resolve();
      await second?.catch(() => {});
      timer.restore();
    }
  });

  it('keeps a retry behind an earlier remote handoff when the intervening local save fails', async () => {
    const firstRemote = deferred<void>();
    const originalPut = db.notes.put.bind(db.notes);
    const put = vi
      .spyOn(db.notes, 'put')
      .mockImplementationOnce((note) => originalPut(note))
      .mockRejectedValueOnce(new Error('disk full'))
      .mockImplementationOnce((note) => originalPut(note));
    pushRecord.mockReturnValueOnce(firstRemote.promise);
    const first = useStore.getState().saveTechniqueNote('bench', 'First remote value');
    let retry: Promise<unknown> | undefined;
    try {
      await vi.waitFor(() => expect(pushRecord).toHaveBeenCalledTimes(1));
      await expect(
        useStore.getState().saveTechniqueNote('bench', 'Failed local value'),
      ).rejects.toThrow('disk full');

      retry = useStore.getState().saveTechniqueNote('bench', 'Newest retry value');
      await vi.waitFor(async () => {
        expect((await db.notes.get('bench'))?.technique).toBe('Newest retry value');
      });
      expect(pushRecord).toHaveBeenCalledTimes(1);

      firstRemote.resolve();
      await vi.waitFor(() => expect(pushRecord).toHaveBeenCalledTimes(2));
      expect(pushRecord.mock.calls.at(-1)).toEqual([
        'user-1',
        'notes',
        expect.objectContaining({ technique: 'Newest retry value' }),
      ]);
      await expect(first).resolves.toMatchObject({ status: 'applied' });
      await expect(retry).resolves.toMatchObject({ status: 'applied' });
    } finally {
      firstRemote.resolve();
      await first.catch(() => {});
      await retry?.catch(() => {});
      put.mockRestore();
    }
  });

  it('pushes a saved technique when authenticated', async () => {
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
  it('uses Technique and This session actions without the legacy dated-entry action', () => {
    expect(workoutSource).not.toContain('addNoteEntry');
    expect(workoutSource).toContain('queueTechniqueNote');
    expect(workoutSource).toContain('saveTechniqueNote');
    expect(workoutSource).not.toContain('flushTechniqueNote');
    expect(workoutSource).toContain('isAccountActionCurrent(result)');
    expect(workoutSource).toContain('disabled={techniqueCommitting}');
    expect(workoutSource).toContain('updateSessionNote');
    expect(workoutSource).toContain('note?.technique');
    expect(workoutSource).toContain('e.sessionNote');
  });

  it('locks Technique text input while Done is committing', () => {
    expect(noteEditorSource).toMatch(/<textarea[\s\S]*disabled=\{disabled\}/);
  });

  it('detaches pending Technique remote sequences on account invalidation', () => {
    expect(storeSource).toContain('techniqueSaveSequences.clear()');
  });
});
