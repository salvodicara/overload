import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';

const { deleteRecord, pushRecord } = vi.hoisted(() => ({
  deleteRecord: vi.fn(async () => undefined),
  pushRecord: vi.fn(async () => undefined),
}));
vi.mock('../sync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sync')>()),
  deleteRecord,
  pushRecord,
  startSync: vi.fn(() => ({ stop: async () => undefined })),
}));

import { TEMPLATES } from '../../data/templates';
import { installTemplatePack } from '../../screens/Train';
import { confirmImportPreview } from '../../screens/ImportExport';
import { createCustomExerciseFlow } from '../../screens/Library';
import { db } from '../db';
import type { BackupV2 } from '../importer';
import { continueAccountAction, useStore, type AccountActionResult } from '../../state/useStore';

const EMPTY_BACKUP: BackupV2 = {
  version: 2,
  workouts: [],
  routines: [],
  folders: [],
  notes: [],
  measurements: [],
  nutrition: [],
  customExercises: [],
  settings: { id: 'settings', updatedAt: 0 },
};

const storage = new Map<string, string>();

async function signInForCurrentReceipt(): Promise<() => Promise<void>> {
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  storage.clear();
  await db.delete();
  await db.open();
  useStore.getState().setUser(null);
  await vi.waitFor(() => expect(useStore.getState().authState).toBe('signedOut'));
  storage.set('overload_uid', 'flow-owner');
  useStore.getState().setUser({ uid: 'flow-owner', name: null });
  await vi.waitFor(() => expect(useStore.getState().authState).toBe('ready'));
  return async () => {
    useStore.getState().setUser(null);
    await vi.waitFor(() => expect(useStore.getState().authState).toBe('signedOut'));
    await db.delete();
    vi.unstubAllGlobals();
  };
}

describe('account-owned screen workflows', () => {
  it('deleting a program removes its routines but preserves standalone routines and history', async () => {
    const cleanUp = await signInForCurrentReceipt();
    try {
      const folder = { id: 'program-a', name: 'Program A', updatedAt: 0 };
      const containedA = {
        id: 'routine-a',
        name: 'Routine A',
        folderId: folder.id,
        exercises: [],
        updatedAt: 0,
      };
      const containedB = {
        id: 'routine-b',
        name: 'Routine B',
        folderId: folder.id,
        exercises: [],
        updatedAt: 0,
      };
      const standalone = {
        id: 'routine-standalone',
        name: 'Standalone',
        exercises: [],
        updatedAt: 0,
      };
      const historicalWorkout = {
        id: 'workout-a',
        routineId: containedA.id,
        date: '2026-01-12',
        startTs: 1,
        sets: [],
        volumeKg: 0,
        updatedAt: 1,
        source: 'app' as const,
      };

      await useStore.getState().saveFolder(folder);
      await useStore.getState().saveRoutine(containedA);
      await useStore.getState().saveRoutine(containedB);
      await useStore.getState().saveRoutine(standalone);
      await db.workouts.put(historicalWorkout);
      useStore.setState({ workouts: [historicalWorkout] });

      await expect(useStore.getState().deleteFolder(folder.id)).resolves.toMatchObject({
        status: 'applied',
      });

      expect(useStore.getState().folders).toEqual([]);
      expect(useStore.getState().routines.map((routine) => routine.id)).toEqual([standalone.id]);
      expect(useStore.getState().workouts).toEqual([historicalWorkout]);
      expect(await db.folders.toArray()).toEqual([]);
      expect((await db.routines.toArray()).map((routine) => routine.id)).toEqual([standalone.id]);
      expect(await db.workouts.toArray()).toEqual([historicalWorkout]);
    } finally {
      await cleanUp();
    }
  });

  it('stops a template install before any routine when the folder action becomes stale', async () => {
    const saveFolder = vi.fn(async () => ({ status: 'stale' as const }));
    const saveRoutine = vi.fn(async () => ({
      status: 'applied' as const,
      value: undefined,
      owner: { uid: 'account-a', generation: 1 },
    }));

    const result = await installTemplatePack(TEMPLATES[0], { saveFolder, saveRoutine });

    expect(result).toEqual({ status: 'stale' });
    expect(saveRoutine).not.toHaveBeenCalled();
  });

  it('reports a stale backup restore before the import caller can show success UI', async () => {
    const success = vi.fn();
    const result = await confirmImportPreview(
      {
        name: 'backup.json',
        fresh: [],
        duplicates: 0,
        unknown: [],
        routines: [],
        notes: [],
        backup: EMPTY_BACKUP,
      },
      {
        restoreBackup: vi.fn(async () => ({ status: 'stale' as const })),
        saveRoutine: vi.fn(),
        importWorkouts: vi.fn(),
        importNotes: vi.fn(),
        onSuccess: success,
      },
    );

    expect(result).toEqual({ status: 'stale' });
    expect(success).not.toHaveBeenCalled();
  });

  it('does not add or navigate when custom exercise creation becomes stale', async () => {
    const addExerciseToRoutine = vi.fn();
    const nav = vi.fn();
    const close = vi.fn();

    const result = await createCustomExerciseFlow(
      { name: 'Carry', muscleGroup: 'core', pickFor: { routineId: 'routine-a' } },
      {
        createCustomExercise: vi.fn(async () => ({ status: 'stale' as const })),
        addExerciseToRoutine,
        nav,
        close,
        isUiCurrent: () => true,
      },
    );

    expect(result).toEqual({ status: 'stale' });
    expect(addExerciseToRoutine).not.toHaveBeenCalled();
    expect(nav).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it('forwards the selected routine tracking only after current creation', async () => {
    const cleanUp = await signInForCurrentReceipt();
    try {
      const created = await useStore.getState().createCustomExercise('Receipt source', 'core');
      expect(created.status).toBe('applied');
      if (created.status !== 'applied') throw new Error('current receipt missing');
      const added: AccountActionResult = { ...created, value: undefined };
      const addExerciseToRoutine = vi.fn(async () => added);
      const nav = vi.fn();
      const close = vi.fn();

      const result = await createCustomExerciseFlow(
        {
          name: 'Band pull-apart',
          muscleGroup: 'shoulders',
          tracking: 'reps',
          pickFor: { routineId: 'routine-a' },
        },
        {
          createCustomExercise: vi.fn(async () => created),
          addExerciseToRoutine,
          nav,
          close,
          isUiCurrent: () => true,
        },
      );

      expect(result).toEqual(created);
      expect(addExerciseToRoutine).toHaveBeenCalledOnce();
      expect(addExerciseToRoutine).toHaveBeenCalledWith('routine-a', created.value, 'reps');
      expect(close).toHaveBeenCalledOnce();
      expect(nav).toHaveBeenCalledWith({ view: 'routineEditor', id: 'routine-a' });
    } finally {
      await cleanUp();
    }
  });

  it('stops custom-exercise UI continuation when the sheet is dismissed while creating', async () => {
    const cleanUp = await signInForCurrentReceipt();
    try {
      const created = await useStore.getState().createCustomExercise('Receipt source', 'core');
      expect(created.status).toBe('applied');
      if (created.status !== 'applied') throw new Error('current receipt missing');
      type AppliedCreation = Extract<AccountActionResult<string>, { status: 'applied' }>;
      let resolveCreate!: (receipt: AppliedCreation) => void;
      const pendingCreate = new Promise<AppliedCreation>((resolve) => {
        resolveCreate = resolve;
      });
      let uiCurrent = true;
      const addExerciseToRoutine = vi.fn();
      const close = vi.fn();
      const nav = vi.fn();
      const flow = createCustomExerciseFlow(
        {
          name: 'Carry',
          muscleGroup: 'core',
          tracking: 'duration',
          pickFor: { routineId: 'routine-a' },
        },
        {
          createCustomExercise: vi.fn(async () => pendingCreate),
          addExerciseToRoutine,
          close,
          nav,
          isUiCurrent: () => uiCurrent,
        },
      );

      uiCurrent = false;
      resolveCreate(created);
      await expect(flow).resolves.toEqual({ status: 'stale' });
      expect(addExerciseToRoutine).not.toHaveBeenCalled();
      expect(close).not.toHaveBeenCalled();
      expect(nav).not.toHaveBeenCalled();
    } finally {
      await cleanUp();
    }
  });

  it('does not close or navigate when adding the created exercise becomes stale', async () => {
    const cleanUp = await signInForCurrentReceipt();
    try {
      const created = await useStore.getState().createCustomExercise('Receipt source', 'core');
      expect(created.status).toBe('applied');
      if (created.status !== 'applied') throw new Error('current receipt missing');
      const close = vi.fn();
      const nav = vi.fn();

      const result = await createCustomExerciseFlow(
        {
          name: 'Carry',
          muscleGroup: 'core',
          tracking: 'duration',
          pickFor: { routineId: 'routine-a' },
        },
        {
          createCustomExercise: vi.fn(async () => created),
          addExerciseToRoutine: vi.fn(async () => ({ status: 'stale' as const })),
          close,
          nav,
          isUiCurrent: () => true,
        },
      );

      expect(result).toEqual({ status: 'stale' });
      expect(close).not.toHaveBeenCalled();
      expect(nav).not.toHaveBeenCalled();
    } finally {
      await cleanUp();
    }
  });

  it('does not run create-routine success UI after a stale save', async () => {
    const nav = vi.fn();
    const close = vi.fn();

    const result = await continueAccountAction(
      Promise.resolve({ status: 'stale' as const }),
      () => {
        close();
        nav({ view: 'routineEditor', id: 'routine-a' });
      },
    );

    expect(result).toEqual({ status: 'stale' });
    expect(close).not.toHaveBeenCalled();
    expect(nav).not.toHaveBeenCalled();
  });

  it('returns stale without running destructive caller UI after a stale delete', async () => {
    const nav = vi.fn();

    const result = await continueAccountAction(
      Promise.resolve({ status: 'stale' as const }),
      () => {
        nav({ view: 'train' });
      },
    );

    expect(result).toEqual({ status: 'stale' });
    expect(nav).not.toHaveBeenCalled();
  });

  it('does not continue an applied receipt whose owner is no longer current', async () => {
    const continuation = vi.fn();

    const result = await continueAccountAction(
      Promise.resolve({
        status: 'applied' as const,
        value: undefined,
        owner: { uid: 'old-account', generation: -1 },
      }),
      continuation,
    );

    expect(result).toEqual({ status: 'stale' });
    expect(continuation).not.toHaveBeenCalled();
  });
});
