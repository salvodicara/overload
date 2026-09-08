import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildRoutinePlanKit,
  materializeRoutinePlan,
  parseRoutinePlan,
  RoutinePlanError,
} from '../routinePlan';
import { db, importRoutinePlanRecords } from '../db';
import type { Exercise } from '../types';

const catalog = new Map<string, Exercise>([
  ['Squat', { id: 'Squat', nameIt: 'Squat', nameEn: 'Squat', muscles: ['legs'] }],
]);
const input = () => ({
  format: 'overload-plan',
  version: 1,
  name: 'My plan',
  routines: [
    {
      name: 'Day A',
      exercises: [{ exerciseId: 'Squat', sets: 3, repMin: 6, repMax: 10, restSec: 90 }],
    },
  ],
});
afterEach(async () => {
  await db.delete();
});

describe('external routine plans', () => {
  it('accepts fenced JSON and creates stable IDs independent of key order', async () => {
    const plan = parseRoutinePlan('```json\n' + JSON.stringify(input()) + '\n```', catalog);
    const a = await materializeRoutinePlan(plan, 10);
    const b = await materializeRoutinePlan(
      parseRoutinePlan(JSON.stringify({ ...input(), name: 'My plan' }), catalog),
      20,
    );
    expect(a.folder.id).toBe(b.folder.id);
    expect(a.routines[0].id).toBe(b.routines[0].id);
    expect(a.routines[0].exercises[0].occurrenceId).toBeTruthy();
  });
  it('reports exact path and unknown exercise instead of substituting', () => {
    const value = input();
    value.routines[0].exercises[0].exerciseId = 'squat';
    try {
      parseRoutinePlan(JSON.stringify(value), catalog);
      throw Error('expected rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(RoutinePlanError);
      expect(error).toMatchObject({
        code: 'unknown_exercise',
        exerciseId: 'squat',
        path: 'routines[0].exercises[0].exerciseId',
      });
    }
  });
  it.each([
    (p: any) => {
      p.version = 2;
    },
    (p: any) => {
      p.extra = 'typo';
    },
    (p: any) => {
      p.routines = [];
    },
    (p: any) => {
      p.routines[0].exercises[0].sets = 0;
    },
    (p: any) => {
      p.routines[0].exercises[0].repMax = 2;
    },
    (p: any) => {
      p.routines[0].exercises[0].restSec = '90';
    },
    (p: any) => {
      p.routines[0].exercises[0].setTargets = [{ repMin: 5, repMax: 8 }];
    },
    (p: any) => {
      p.routines[0].exercises[0].warmupSets = [{ weightKg: -1, reps: 8 }];
    },
    (p: any) => {
      p.routines[0].exercises[0].warmupSets = [{ durationSec: 30 }];
    },
    (p: any) => {
      p.routines[0].exercises[0].occurrenceId = 'injected';
    },
  ])('rejects malformed prescriptions %#', (mutate) => {
    const value = input();
    mutate(value);
    expect(() => parseRoutinePlan(JSON.stringify(value), catalog)).toThrow(RoutinePlanError);
  });
  it('rejects nonfinite JSON exponent', () => {
    expect(() =>
      parseRoutinePlan(JSON.stringify(input()).replace('"restSec":90', '"restSec":1e999'), catalog),
    ).toThrow(RoutinePlanError);
  });
  it('kit includes valid example, full schema and actual ID catalog', () => {
    const kit = JSON.parse(buildRoutinePlanKit(catalog));
    expect(kit.catalog).toEqual([{ id: 'Squat', nameIt: 'Squat', nameEn: 'Squat' }]);
    expect(kit.schema.properties.format.const).toBe('overload-plan');
    expect(parseRoutinePlan(JSON.stringify(kit.example), catalog).routines).toHaveLength(1);
  });
  it('imports atomically, preserves unrelated data and does not overwrite edited duplicate', async () => {
    await db.open();
    await db.settings.put({ id: 'settings', unit: 'lb', updatedAt: 1 });
    await db.folders.put({ id: 'existing', name: 'Existing', updatedAt: 1 });
    const records = await materializeRoutinePlan(
      parseRoutinePlan(JSON.stringify(input()), catalog),
      10,
    );
    expect((await importRoutinePlanRecords(records)).alreadyImported).toBe(false);
    await db.routines.update(records.routines[0].id, { name: 'Edited after import' });
    expect((await importRoutinePlanRecords(records)).alreadyImported).toBe(true);
    expect(await db.routines.count()).toBe(1);
    expect((await db.routines.get(records.routines[0].id))?.name).toBe('Edited after import');
    expect((await db.settings.get('settings'))?.unit).toBe('lb');
    expect(await db.folders.count()).toBe(2);
  });
  it('a record collision aborts the entire new import', async () => {
    await db.open();
    const records = await materializeRoutinePlan(
      parseRoutinePlan(JSON.stringify(input()), catalog),
      10,
    );
    await db.routines.put({ ...records.routines[0], name: 'Keep me' });
    await expect(importRoutinePlanRecords(records)).rejects.toThrow();
    expect(await db.folders.count()).toBe(0);
    expect((await db.routines.toArray())[0].name).toBe('Keep me');
  });
  it('completes a partially synced program without overwriting its existing folder', async () => {
    await db.open();
    const records = await materializeRoutinePlan(
      parseRoutinePlan(JSON.stringify(input()), catalog),
      10,
    );
    await db.folders.put({ ...records.folder, name: 'Renamed on another device' });
    expect((await importRoutinePlanRecords(records)).alreadyImported).toBe(false);
    expect(await db.routines.count()).toBe(1);
    expect((await db.folders.get(records.folder.id))?.name).toBe('Renamed on another device');
  });
});
