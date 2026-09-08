import { validateSavedMeals } from './foodDiary';
import type {
  CustomExercise,
  ExerciseNote,
  Folder,
  LegacyRoutine,
  Measurement,
  Routine,
  Settings,
  Workout,
} from './types';

export const MAX_MEASUREMENT = 1_000_000;
export function validDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
function requireValid(condition: unknown): asserts condition {
  if (!condition) throw new Error('import.invalid');
}
function object(value: unknown): Record<string, unknown> {
  requireValid(value && typeof value === 'object' && !Array.isArray(value));
  return value as Record<string, unknown>;
}
function text(value: unknown, nonempty = false): boolean {
  return typeof value === 'string' && (!nonempty || value.trim().length > 0);
}
function number(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}
function integer(value: unknown, min = 0): boolean {
  return number(value, min) && Number.isSafeInteger(value);
}
function optional(value: unknown, check: (v: unknown) => boolean): boolean {
  return value === undefined || check(value);
}
function record(value: unknown): Record<string, unknown> {
  const x = object(value);
  requireValid(text(x.id, true) && number(x.updatedAt));
  return x;
}
function array(value: unknown, check: (v: unknown) => void): void {
  requireValid(Array.isArray(value));
  for (const item of value) check(item);
}
const tracking = (v: unknown) => ['weight_reps', 'reps', 'duration'].includes(v as string);

export function assertMeasurement(value: unknown): asserts value is Measurement {
  const x = record(value);
  requireValid(
    validDate(x.date) &&
      ['weight', 'waist', 'chest', 'arm', 'thigh', 'calf'].includes(x.metric as string) &&
      number(x.value, Number.MIN_VALUE, MAX_MEASUREMENT),
  );
}
export function assertSettings(value: unknown): asserts value is Settings {
  const x = record(value);
  requireValid(
    x.id === 'settings' &&
      optional(x.unit, (v) => v === 'kg' || v === 'lb') &&
      optional(x.locale, (v) => v === 'it' || v === 'en') &&
      optional(x.programStartDate, validDate) &&
      optional(x.kcalTarget, (v) => number(v, 1, 1e9)) &&
      optional(x.proteinTarget, (v) => number(v, 1, 1e9)) &&
      optional(x.weeklyGoal, (v) => integer(v)),
  );
  if (x.savedMeals !== undefined) validateSavedMeals(x.savedMeals);
}
export function assertFolder(value: unknown): asserts value is Folder {
  const x = record(value);
  requireValid(text(x.name, true));
}
export function assertCustomExercise(value: unknown): asserts value is CustomExercise {
  const x = record(value);
  requireValid(text(x.name, true) && text(x.muscleGroup, true));
}
export function assertExerciseNote(value: unknown): asserts value is ExerciseNote {
  const x = record(value);
  requireValid(optional(x.technique, text));
  array(x.entries, (value) => {
    const entry = object(value);
    requireValid(validDate(entry.date) && text(entry.text));
  });
}
function assertSet(value: unknown): void {
  const x = object(value);
  requireValid(
    text(x.exerciseId, true) &&
      optional(x.exerciseInstanceId, (v) => text(v, true)) &&
      number(x.weightKg) &&
      integer(x.reps) &&
      typeof x.done === 'boolean' &&
      optional(x.tracking, tracking) &&
      optional(x.kind, (v) => v === 'working' || v === 'warmup') &&
      optional(x.durationSec, (v) => number(v)) &&
      optional(x.isPr, (v) => typeof v === 'boolean'),
  );
  if (x.tracking === 'duration' && x.done) requireValid(number(x.durationSec, Number.MIN_VALUE));
}
export function assertWorkout(value: unknown): asserts value is Workout {
  const x = record(value);
  requireValid(
    validDate(x.date) &&
      number(x.startTs, -8.64e15, 8.64e15) &&
      optional(x.endTs, (v) => number(v, x.startTs as number, 8.64e15)) &&
      optional(x.durationSec, (v) => number(v)) &&
      number(x.volumeKg) &&
      ['app', 'hevy'].includes(x.source as string) &&
      optional(x.routineId, (v) => text(v, true)) &&
      optional(x.dayLabel, text) &&
      optional(x.note, text),
  );
  array(x.sets, assertSet);
  if (x.exerciseOrder !== undefined) array(x.exerciseOrder, (v) => requireValid(text(v, true)));
  if (x.exerciseNotes !== undefined)
    array(x.exerciseNotes, (value) => {
      const n = object(value);
      requireValid(
        text(n.exerciseId, true) &&
          text(n.text) &&
          optional(n.exerciseInstanceId, (v) => text(v, true)),
      );
    });
}
function assertPrescription(value: unknown): void {
  const x = object(value);
  requireValid(
    text(x.exerciseId, true) &&
      optional(x.occurrenceId, (v) => text(v, true)) &&
      integer(x.sets, 1) &&
      integer(x.repMin) &&
      (x.repMax === null || (integer(x.repMax) && Number(x.repMax) >= Number(x.repMin))) &&
      number(x.restSec) &&
      optional(x.note, text) &&
      optional(x.startWeightKg, (v) => number(v)) &&
      optional(x.incrementKg, (v) => number(v)) &&
      optional(x.tracking, tracking),
  );
  if (x.setTargets !== undefined)
    array(x.setTargets, (value) => {
      const target = object(value);
      requireValid(
        integer(target.repMin) &&
          (target.repMax === null ||
            (integer(target.repMax) && Number(target.repMax) >= Number(target.repMin))) &&
          optional(target.startWeightKg, (v) => number(v)),
      );
    });
  if (x.warmupSets !== undefined)
    array(x.warmupSets, (value) => {
      const warm = object(value);
      requireValid(
        optional(warm.weightKg, (v) => number(v)) &&
          optional(warm.reps, (v) => integer(v)) &&
          optional(warm.durationSec, (v) => number(v)),
      );
    });
}
/** Legacy days are validated without flattening or dropping their original fields. */
export function assertRoutine(value: unknown): asserts value is Routine | LegacyRoutine {
  const x = record(value);
  requireValid(
    text(x.name, true) && optional(x.folderId, (v) => text(v, true)) && optional(x.warmup, text),
  );
  if (x.days !== undefined)
    array(x.days, (value) => {
      const day = object(value);
      requireValid(text(day.label) && text(day.name) && optional(day.warmup, text));
      array(day.exercises, assertPrescription);
    });
  else array(x.exercises, assertPrescription);
}
export function assertCollection(value: unknown, check: (v: unknown) => void): void {
  const ids = new Set<unknown>();
  array(value, (item) => {
    check(item);
    const id = object(item).id;
    requireValid(!ids.has(id));
    ids.add(id);
  });
}
