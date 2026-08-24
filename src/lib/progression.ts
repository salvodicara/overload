import type { RoutineExercise, Workout } from './types';

export type PhaseKey = 'reactivation' | 'rebuild' | 'progress' | 'deload' | 'done';

export type Phase = { week: number; key: PhaseKey };

export type Suggestion = { weights: number[]; hintKey: string };

const DAY_MS = 86400000;
const DEFAULT_INCREMENT_KG = 2.5;
const DELOAD_FACTOR = 0.6;
const ROUND_STEP_KG = 2.5;

/** Parses a `YYYY-MM-DD` date as UTC midnight (DST-safe day arithmetic). */
function toUtcDay(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function phaseKeyForWeek(week: number): PhaseKey {
  if (week <= 2) return 'reactivation';
  if (week <= 5) return 'rebuild';
  if (week <= 8) return 'progress';
  if (week === 9) return 'deload';
  return 'done';
}

/** Current program phase, or null when the program has no start date or has not begun. */
export function getPhase(programStartDate: string | undefined, today: string): Phase | null {
  if (!programStartDate) return null;
  const days = Math.floor((toUtcDay(today) - toUtcDay(programStartDate)) / DAY_MS);
  if (days < 0) return null;
  const week = Math.floor(days / 7) + 1;
  return { week, key: phaseKeyForWeek(week) };
}

function roundToStep(weightKg: number): number {
  return Math.round(weightKg / ROUND_STEP_KG) * ROUND_STEP_KG;
}

/** Most recent workout (date, then startTs) holding at least one completed set of the exercise. */
function lastWorkoutWith(history: Workout[], exerciseId: string): Workout | null {
  let best: Workout | null = null;
  for (const w of history) {
    if (!w.sets.some((s) => s.done && s.exerciseId === exerciseId)) continue;
    if (best === null || w.date > best.date || (w.date === best.date && w.startTs > best.startTs)) {
      best = w;
    }
  }
  return best;
}

/** Stretches or trims `weights` to exactly `count` entries, repeating the last one. */
function fitToSets(weights: number[], count: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push(weights[Math.min(i, weights.length - 1)]);
  }
  return out;
}

/** Next-session weights per set plus the i18n key explaining why. */
export function suggest(rx: RoutineExercise, history: Workout[], phase: Phase | null): Suggestion {
  const startWeights = new Array<number>(rx.sets).fill(rx.startWeightKg ?? 0);
  const last = lastWorkoutWith(history, rx.exerciseId);
  if (!last) return { weights: startWeights, hintKey: 'suggest.start' };

  const loggedInApp = history.some(
    (w) => w.source === 'app' && w.sets.some((s) => s.done && s.exerciseId === rx.exerciseId),
  );
  if (phase?.key === 'reactivation' && !loggedInApp) {
    return { weights: startWeights, hintKey: 'suggest.phase1' };
  }

  const lastSets = last.sets.filter((s) => s.done && s.exerciseId === rx.exerciseId);
  const lastWeights = fitToSets(
    lastSets.map((s) => s.weightKg),
    rx.sets,
  );

  if (phase?.key === 'deload') {
    return {
      weights: lastWeights.map((w) => roundToStep(w * DELOAD_FACTOR)),
      hintKey: 'suggest.deload',
    };
  }

  const repMax = rx.repMax;
  const closedTopOfRange =
    repMax !== null && lastSets.filter((s) => s.reps >= repMax).length >= rx.sets;
  if (closedTopOfRange) {
    const increment = rx.incrementKg ?? DEFAULT_INCREMENT_KG;
    return { weights: lastWeights.map((w) => w + increment), hintKey: 'suggest.increase' };
  }

  return { weights: lastWeights, hintKey: 'suggest.repeat' };
}
