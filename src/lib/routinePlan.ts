import { getCatalog } from './exercises';
import type { Exercise, Folder, Routine, RoutineExercise, TrackingType } from './types';

export type RoutinePlan = {
  format: 'overload-plan';
  version: 1;
  name: string;
  routines: { name: string; warmup?: string; exercises: RoutineExercise[] }[];
};
export type RoutinePlanRecords = { folder: Folder; routines: Routine[] };
export type PlanCatalog = ReadonlyMap<string, Pick<Exercise, 'id' | 'nameIt' | 'nameEn'>>;
export class RoutinePlanError extends Error {
  constructor(
    public code: 'invalid_json' | 'invalid_plan' | 'unknown_exercise',
    public path: string,
    message: string,
    public exerciseId?: string,
  ) {
    super(message);
    this.name = 'RoutinePlanError';
  }
}
function invalid(path: string, message: string): never {
  throw new RoutinePlanError('invalid_plan', path, `${path}: ${message}`);
}
function record(value: unknown, path: string, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    invalid(path, 'Expected an object.');
  const item = value as Record<string, unknown>;
  for (const key of Object.keys(item))
    if (!keys.includes(key)) invalid(`${path}.${key}`, 'Unknown field; use the AI kit schema.');
  return item;
}
function text(value: unknown, path: string, max = 120): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    invalid(path, `Expected nonempty text of at most ${max} characters.`);
  return value.trim();
}
function number(value: unknown, path: string, min: number, max: number, integer = false): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  )
    invalid(path, `Expected ${integer ? 'an integer' : 'a number'} from ${min} to ${max}.`);
  return value;
}
function array(value: unknown, path: string, min: number, max: number): unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max)
    invalid(path, `Expected ${min}–${max} items.`);
  return value;
}
function target(value: Record<string, unknown>, path: string) {
  const repMin = number(value.repMin, `${path}.repMin`, 1, 86400, true);
  const repMax =
    value.repMax === null ? null : number(value.repMax, `${path}.repMax`, repMin, 86400, true);
  return {
    repMin,
    repMax,
    ...(value.startWeightKg === undefined
      ? {}
      : { startWeightKg: number(value.startWeightKg, `${path}.startWeightKg`, 0, 2000) }),
  };
}
function exercise(value: unknown, path: string, catalog: PlanCatalog): RoutineExercise {
  const item = record(value, path, [
    'exerciseId',
    'sets',
    'repMin',
    'repMax',
    'restSec',
    'note',
    'startWeightKg',
    'incrementKg',
    'setTargets',
    'tracking',
    'warmupSets',
  ]);
  const exerciseId = text(item.exerciseId, `${path}.exerciseId`, 200);
  if (!catalog.has(exerciseId))
    throw new RoutinePlanError(
      'unknown_exercise',
      `${path}.exerciseId`,
      `${path}.exerciseId: Unknown catalog ID "${exerciseId}". Use an exact ID from the AI kit catalog; names are not IDs.`,
      exerciseId,
    );
  const sets = number(item.sets, `${path}.sets`, 1, 100, true);
  const tracking = item.tracking === undefined ? 'weight_reps' : item.tracking;
  if (!['weight_reps', 'reps', 'duration'].includes(tracking as string))
    invalid(`${path}.tracking`, 'Use weight_reps, reps or duration.');
  const result: RoutineExercise = {
    exerciseId,
    sets,
    ...target(item, path),
    restSec: number(item.restSec, `${path}.restSec`, 0, 3600, true),
    tracking: tracking as TrackingType,
  };
  if (item.note !== undefined) result.note = text(item.note, `${path}.note`, 4000);
  if (item.incrementKg !== undefined)
    result.incrementKg = number(item.incrementKg, `${path}.incrementKg`, 0, 1000);
  if (item.setTargets !== undefined)
    result.setTargets = array(item.setTargets, `${path}.setTargets`, sets, sets).map(
      (entry, index) =>
        target(
          record(entry, `${path}.setTargets[${index}]`, ['repMin', 'repMax', 'startWeightKg']),
          `${path}.setTargets[${index}]`,
        ),
    );
  if (item.warmupSets !== undefined)
    result.warmupSets = array(item.warmupSets, `${path}.warmupSets`, 0, 20).map((entry, index) => {
      const at = `${path}.warmupSets[${index}]`;
      const warmup = record(
        entry,
        at,
        tracking === 'duration'
          ? ['durationSec']
          : tracking === 'reps'
            ? ['reps']
            : ['weightKg', 'reps'],
      );
      return tracking === 'duration'
        ? { durationSec: number(warmup.durationSec, `${at}.durationSec`, 1, 86400, true) }
        : tracking === 'reps'
          ? { reps: number(warmup.reps, `${at}.reps`, 1, 86400, true) }
          : {
              weightKg: number(warmup.weightKg, `${at}.weightKg`, 0, 2000),
              reps: number(warmup.reps, `${at}.reps`, 1, 86400, true),
            };
    });
  if (
    tracking !== 'weight_reps' &&
    (result.startWeightKg !== undefined ||
      result.incrementKg !== undefined ||
      result.setTargets?.some((item) => item.startWeightKg !== undefined))
  )
    invalid(path, 'Weight fields require tracking weight_reps.');
  return result;
}

/** Strict, bounded external format. Never accepts a backup or silently resolves exercise names. */
export function parseRoutinePlan(source: string, catalog: PlanCatalog = getCatalog()): RoutinePlan {
  if (source.length > 1_000_000) invalid('plan', 'File exceeds 1 MB of text.');
  const trimmed = source.trim();
  const fence = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i);
  let value: unknown;
  try {
    value = JSON.parse(fence?.[1] ?? trimmed);
  } catch {
    throw new RoutinePlanError(
      'invalid_json',
      'plan',
      'Expected a JSON plan object (optionally inside a json code fence).',
    );
  }
  const item = record(value, 'plan', ['format', 'version', 'name', 'routines']);
  if (item.format !== 'overload-plan' || item.version !== 1)
    invalid(
      'plan',
      'Expected format overload-plan, version 1. Backup files cannot be imported here.',
    );
  return {
    format: 'overload-plan',
    version: 1,
    name: text(item.name, 'name'),
    routines: array(item.routines, 'routines', 1, 30).map((entry, index) => {
      const path = `routines[${index}]`;
      const routine = record(entry, path, ['name', 'warmup', 'exercises']);
      return {
        name: text(routine.name, `${path}.name`),
        ...(routine.warmup === undefined
          ? {}
          : { warmup: text(routine.warmup, `${path}.warmup`, 4000) }),
        exercises: array(routine.exercises, `${path}.exercises`, 1, 50).map((value, i) =>
          exercise(value, `${path}.exercises[${i}]`, catalog),
        ),
      };
    }),
  };
}

/** Hash only normalized content, never timestamps; retries target the same records. */
export async function materializeRoutinePlan(
  plan: RoutinePlan,
  now = Date.now(),
): Promise<RoutinePlanRecords> {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(plan)),
  );
  const id =
    'plan:' +
    [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, '0')).join('');
  return {
    folder: { id, name: plan.name, updatedAt: now },
    routines: plan.routines.map((routine, index) => ({
      ...routine,
      id: `${id}:${index}`,
      folderId: id,
      updatedAt: now,
      exercises: routine.exercises.map((exercise, i) => ({
        ...exercise,
        occurrenceId: `${id}:${index}:${i}`,
      })),
    })),
  };
}

const integer = (minimum: number, maximum: number) => ({ type: 'integer', minimum, maximum });
const numeric = (minimum: number, maximum: number) => ({ type: 'number', minimum, maximum });
const shortText = { type: 'string', minLength: 1, maxLength: 120, pattern: '\\S' };
const longText = { ...shortText, maxLength: 4000 };
const targets = {
  repMin: integer(1, 86400),
  repMax: { anyOf: [integer(1, 86400), { type: 'null' }] },
  startWeightKg: numeric(0, 2000),
};
const object = (properties: Record<string, unknown>, required: string[]) => ({
  type: 'object',
  additionalProperties: false,
  properties,
  required,
});
const warmup = (properties: Record<string, unknown>, required: string[]) => ({
  type: 'array',
  maxItems: 20,
  items: object(properties, required),
});
export const ROUTINE_PLAN_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  ...object(
    {
      format: { const: 'overload-plan' },
      version: { const: 1 },
      name: shortText,
      routines: {
        type: 'array',
        minItems: 1,
        maxItems: 30,
        items: object(
          {
            name: shortText,
            warmup: longText,
            exercises: {
              type: 'array',
              minItems: 1,
              maxItems: 50,
              items: {
                ...object(
                  {
                    exerciseId: { type: 'string', minLength: 1, maxLength: 200 },
                    sets: integer(1, 100),
                    ...targets,
                    restSec: integer(0, 3600),
                    note: longText,
                    incrementKg: numeric(0, 1000),
                    tracking: { enum: ['weight_reps', 'reps', 'duration'] },
                    setTargets: {
                      type: 'array',
                      minItems: 1,
                      maxItems: 100,
                      items: object(targets, ['repMin', 'repMax']),
                    },
                    warmupSets: { type: 'array', maxItems: 20 },
                  },
                  ['exerciseId', 'sets', 'repMin', 'repMax', 'restSec'],
                ),
                allOf: [
                  {
                    if: { properties: { tracking: { const: 'duration' } }, required: ['tracking'] },
                    then: {
                      properties: {
                        warmupSets: warmup({ durationSec: integer(1, 86400) }, ['durationSec']),
                      },
                    },
                  },
                  {
                    if: { properties: { tracking: { const: 'reps' } }, required: ['tracking'] },
                    then: {
                      properties: { warmupSets: warmup({ reps: integer(1, 86400) }, ['reps']) },
                    },
                  },
                  {
                    if: {
                      anyOf: [
                        { not: { required: ['tracking'] } },
                        { properties: { tracking: { const: 'weight_reps' } } },
                      ],
                    },
                    then: {
                      properties: {
                        warmupSets: warmup(
                          { weightKg: numeric(0, 2000), reps: integer(1, 86400) },
                          ['weightKg', 'reps'],
                        ),
                      },
                    },
                  },
                  {
                    if: {
                      properties: { tracking: { enum: ['reps', 'duration'] } },
                      required: ['tracking'],
                    },
                    then: {
                      not: {
                        anyOf: [{ required: ['startWeightKg'] }, { required: ['incrementKg'] }],
                      },
                      properties: {
                        setTargets: { items: { not: { required: ['startWeightKg'] } } },
                      },
                    },
                  },
                ],
              },
            },
          },
          ['name', 'exercises'],
        ),
      },
    },
    ['format', 'version', 'name', 'routines'],
  ),
};

export function buildRoutinePlanKit(catalog: PlanCatalog = getCatalog()): string {
  const entries = [...catalog.values()]
    .map(({ id, nameIt, nameEn }) => ({ id, nameIt, nameEn }))
    .sort((a, b) => a.id.localeCompare(b.id));
  if (!entries.length)
    invalid('catalog', 'Load the exercise catalog before generating the AI kit.');
  const example: RoutinePlan = {
    format: 'overload-plan',
    version: 1,
    name: 'Example program',
    routines: [
      {
        name: 'Day A',
        exercises: [
          {
            exerciseId: entries[0].id,
            sets: 3,
            repMin: 8,
            repMax: 12,
            restSec: 90,
            tracking: 'weight_reps',
          },
        ],
      },
    ],
  };
  return JSON.stringify(
    {
      instructions: [
        'Create a training plan following the user’s requirements. Return only one JSON object matching schema, not a backup.',
        'Use exact exerciseId values from catalog. Never invent or translate IDs. Ask the user if a requested exercise has no appropriate catalog match.',
        'Weights are kilograms and times are seconds. For duration tracking, repMin and repMax describe seconds.',
        'Additional validation: repMax must be null or at least repMin; setTargets, when present, must contain exactly sets entries. All text must contain non-whitespace characters.',
        'Do not include IDs for folders, routines or exercise occurrences. Import creates them without changing existing history, settings or routines.',
        'The example demonstrates file structure only; it is not a recommended training program.',
      ],
      schema: ROUTINE_PLAN_SCHEMA,
      example,
      catalog: entries,
    },
    null,
    2,
  );
}
