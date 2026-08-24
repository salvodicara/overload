import type { Workout } from './types';

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

/** Most recent done sets of an exercise, for "last time" lines and prefills. */
export function lastTimeLine(
  workouts: Workout[],
  exerciseId: string,
): { date: string; sets: string } | null {
  for (const w of workouts) {
    const sets = w.sets.filter((s) => s.exerciseId === exerciseId && s.done);
    if (sets.length) {
      return { date: w.date, sets: sets.map((s) => `${s.weightKg}×${s.reps}`).join('  ') };
    }
  }
  return null;
}
