import { describe, expect, it, vi } from 'vitest';
import { TEMPLATES } from '../../data/templates';
import { installTemplatePack } from '../../screens/Train';
import { confirmImportPreview } from '../../screens/ImportExport';
import { createCustomExerciseFlow } from '../../screens/Library';
import type { BackupV2 } from '../importer';
import { continueAccountAction } from '../../state/useStore';

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

describe('account-owned screen workflows', () => {
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
      },
    );

    expect(result).toEqual({ status: 'stale' });
    expect(addExerciseToRoutine).not.toHaveBeenCalled();
    expect(nav).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
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

  it('does not navigate an editor after a stale delete', async () => {
    const nav = vi.fn();

    await continueAccountAction(Promise.resolve({ status: 'stale' as const }), () => {
      nav({ view: 'train' });
    });

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
