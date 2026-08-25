import { kindOf, type SetLog, type Workout } from './types';

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

function latestWorkoutWith(workouts: Workout[], exerciseId: string): Workout | null {
  let latest: Workout | null = null;
  for (const w of workouts) {
    if (!w.sets.some((s) => s.exerciseId === exerciseId && s.done && kindOf(s.kind) === 'working')) {
      continue;
    }
    if (latest === null || w.date > latest.date || (w.date === latest.date && w.startTs > latest.startTs)) {
      latest = w;
    }
  }
  return latest;
}

/** Most recent completed working sets of an exercise, kept in their saved order. */
export function previousSets(workouts: Workout[], exerciseId: string): SetLog[] {
  return latestWorkoutWith(workouts, exerciseId)?.sets.filter(
    (s) => s.exerciseId === exerciseId && s.done && kindOf(s.kind) === 'working',
  ) ?? [];
}

/** Most recent done sets of an exercise, for "last time" lines and prefills. */
export function lastTimeLine(
  workouts: Workout[],
  exerciseId: string,
): { date: string; sets: string } | null {
  const latest = latestWorkoutWith(workouts, exerciseId);
  if (!latest) return null;
  return {
    date: latest.date,
    sets: latest.sets
      .filter((s) => s.exerciseId === exerciseId && s.done && kindOf(s.kind) === 'working')
      .map((s) => `${s.weightKg}×${s.reps}`)
      .join('  '),
  };
}
