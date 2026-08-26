import { kindOf, type Workout } from './types';
import { computeVolume } from './volume';

export type PeriodUnit = 'week' | 'month' | 'year';

export type TrainingMetrics = {
  workouts: number;
  workingSets: number;
  volume: number;
  durationMin: number;
};

export type PeriodSummary = TrainingMetrics & { previous: TrainingMetrics };
export type TrainingBucket = TrainingMetrics & { date: string };

function atNoon(date: Date): Date {
  const next = new Date(date);
  next.setHours(12, 0, 0, 0);
  return next;
}

function toIso(date: Date): string {
  return date.toLocaleDateString('sv');
}

function addDays(date: Date, amount: number): Date {
  const next = atNoon(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function dayOffset(start: string, end: string): number {
  const startMs = new Date(`${start}T12:00:00`).getTime();
  const endMs = new Date(`${end}T12:00:00`).getTime();
  return Math.max(0, Math.round((endMs - startMs) / 86_400_000));
}

function workingSetCount(workout: Workout): number {
  return workout.sets.filter((set) => set.done && kindOf(set.kind) === 'working').length;
}

function metrics(workouts: Workout[]): TrainingMetrics {
  const completed = workouts.filter((workout) => workingSetCount(workout) > 0);
  return {
    workouts: completed.length,
    workingSets: completed.reduce((sum, workout) => sum + workingSetCount(workout), 0),
    volume: completed.reduce((sum, workout) => sum + computeVolume(workout.sets), 0),
    durationMin: Math.round(
      completed.reduce(
        (sum, workout) =>
          sum + Math.max(0, (workout.endTs ?? workout.startTs) - workout.startTs) / 60_000,
        0,
      ),
    ),
  };
}

export function periodBounds(anchor: Date, unit: PeriodUnit): { start: string; end: string } {
  const date = atNoon(anchor);
  if (unit === 'week') {
    const start = addDays(date, -((date.getDay() + 6) % 7));
    return { start: toIso(start), end: toIso(addDays(start, 6)) };
  }
  if (unit === 'month') {
    const start = new Date(date.getFullYear(), date.getMonth(), 1, 12);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 12);
    return { start: toIso(start), end: toIso(end) };
  }
  return {
    start: toIso(new Date(date.getFullYear(), 0, 1, 12)),
    end: toIso(new Date(date.getFullYear(), 11, 31, 12)),
  };
}

export function shiftPeriod(anchor: Date, unit: PeriodUnit, amount: number): Date {
  const date = atNoon(anchor);
  if (unit === 'week') return addDays(date, amount * 7);
  if (unit === 'month') {
    return new Date(date.getFullYear(), date.getMonth() + amount, 1, 12);
  }
  return new Date(date.getFullYear() + amount, 0, 1, 12);
}

function rowsWithin(workouts: Workout[], start: string, end: string): Workout[] {
  return workouts.filter((workout) => workout.date >= start && workout.date <= end);
}

export function periodSummary(
  anchor: Date,
  unit: PeriodUnit,
  workouts: Workout[],
  now?: Date,
): PeriodSummary {
  const bounds = periodBounds(anchor, unit);
  const previousBounds = periodBounds(shiftPeriod(anchor, unit, -1), unit);
  const today = now ? toIso(atNoon(now)) : bounds.end;
  const isCurrent = now ? bounds.start === periodBounds(now, unit).start : false;
  const currentEnd = isCurrent && today < bounds.end ? today : bounds.end;
  const previousEnd = isCurrent
    ? toIso(
        addDays(
          new Date(`${previousBounds.start}T12:00:00`),
          dayOffset(bounds.start, currentEnd),
        ),
      )
    : previousBounds.end;
  return {
    ...metrics(rowsWithin(workouts, bounds.start, currentEnd)),
    previous: metrics(
      rowsWithin(
        workouts,
        previousBounds.start,
        previousEnd < previousBounds.end ? previousEnd : previousBounds.end,
      ),
    ),
  };
}

export function periodBuckets(
  anchor: Date,
  unit: PeriodUnit,
  workouts: Workout[],
  now?: Date,
): TrainingBucket[] {
  const bounds = periodBounds(anchor, unit);
  const starts: Date[] = [];
  if (unit === 'week') {
    const start = new Date(`${bounds.start}T12:00:00`);
    for (let index = 0; index < 7; index += 1) starts.push(addDays(start, index));
  } else if (unit === 'month') {
    const start = new Date(`${bounds.start}T12:00:00`);
    for (let day = 1; day <= Number(bounds.end.slice(-2)); day += 7) {
      starts.push(new Date(start.getFullYear(), start.getMonth(), day, 12));
    }
  } else {
    const year = Number(bounds.start.slice(0, 4));
    for (let month = 0; month < 12; month += 1) starts.push(new Date(year, month, 1, 12));
  }

  const visibleStarts =
    now && bounds.start === periodBounds(now, unit).start
      ? starts.filter((start) => toIso(start) <= toIso(atNoon(now)))
      : starts;

  return visibleStarts.map((start) => {
    const startIso = toIso(start);
    const next = starts[starts.indexOf(start) + 1];
    const endIso = next ? toIso(addDays(next, -1)) : bounds.end;
    const visibleEnd = now && endIso > toIso(atNoon(now)) ? toIso(atNoon(now)) : endIso;
    return { date: startIso, ...metrics(rowsWithin(workouts, startIso, visibleEnd)) };
  });
}
