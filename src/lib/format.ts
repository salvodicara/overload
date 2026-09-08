import { kindOf, trackingOf, type SetLog, type TrackingType, type Workout } from './types';
import { displayWeight, weightLabel, type WeightUnit } from './units';

/** Local-time YYYY-MM-DD (the 'sv' locale formats exactly this way). */
export function todayISO(): string {
  return new Date().toLocaleDateString('sv');
}

export function fmtDate(
  iso: string,
  locale: string,
  opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' },
): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(locale === 'it' ? 'it-IT' : 'en-GB', opts);
}

/** Compact, locale-aware figures with deliberately short cross-locale suffixes. */
export function formatCompactNumber(value: number, locale: string): string {
  if (!Number.isFinite(value)) return '—';
  const absolute = Math.abs(value);
  let magnitude = absolute < 1_000 ? 0 : Math.floor(Math.log10(absolute) / 3);
  const suffixes = ['', 'K', 'M', 'B', 'T', 'Q'];
  if (absolute / 1_000 ** magnitude >= 999.95) magnitude += 1;
  if (magnitude >= suffixes.length) {
    return new Intl.NumberFormat(locale, {
      notation: 'scientific',
      maximumFractionDigits: 1,
    })
      .format(value)
      .replace('-', '−');
  }
  const scaled = absolute / 1_000 ** magnitude;
  const formatted = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(scaled);
  return `${value < 0 ? '−' : ''}${formatted}${suffixes[magnitude]}`;
}

export function previousWorkout(
  workouts: Workout[],
  exerciseId: string,
  routineId?: string,
): Workout | null {
  const matching = workouts.filter((workout) =>
    workout.sets.some(
      (set) => set.exerciseId === exerciseId && set.done && kindOf(set.kind) === 'working',
    ),
  );
  const sameRoutine = routineId
    ? matching.filter((workout) => workout.routineId === routineId)
    : [];
  let latest: Workout | null = null;
  for (const w of sameRoutine.length > 0 ? sameRoutine : matching) {
    if (
      latest === null ||
      w.date > latest.date ||
      (w.date === latest.date && w.startTs > latest.startTs)
    ) {
      latest = w;
    }
  }
  return latest;
}

/** Most recent completed working sets of an exercise, kept in their saved order. */
export function previousSets(
  workouts: Workout[],
  exerciseId: string,
  routineId?: string,
  occurrenceId?: string,
  tracking?: TrackingType,
): SetLog[] {
  const candidates = workouts
    .map((workout) => {
      let sets = workout.sets.filter(
        (set) =>
          set.exerciseId === exerciseId &&
          set.done &&
          kindOf(set.kind) === 'working' &&
          (!tracking || trackingOf(set.tracking) === tracking),
      );
      if (
        occurrenceId &&
        workout.routineId === routineId &&
        sets.some((set) => set.exerciseInstanceId)
      )
        sets = sets.filter((set) => set.exerciseInstanceId === occurrenceId);
      return { workout, sets };
    })
    .filter((item) => item.sets.length > 0);
  const preferred = routineId
    ? candidates.filter((item) => item.workout.routineId === routineId)
    : [];
  const ordered = (preferred.length ? preferred : candidates).sort(
    (a, b) => b.workout.date.localeCompare(a.workout.date) || b.workout.startTs - a.workout.startTs,
  );
  return ordered[0]?.sets ?? [];
}

export function formatPreviousSet(
  set: SetLog,
  tracking: TrackingType | undefined,
  unit: WeightUnit,
  includeUnit = true,
): string {
  const mode = trackingOf(tracking ?? set.tracking);
  if (mode === 'duration') return `${set.durationSec ?? 0}s`;
  if (mode === 'reps') return String(set.reps);
  const weight = `${displayWeight(set.weightKg, unit)}${includeUnit ? ` ${weightLabel(unit)}` : ''}`;
  return `${weight} × ${set.reps}`;
}
