import { trackingOf, type RoutineExercise, type Workout } from './types';
import { previousSets } from './format';

export type Suggestion = { weights: Array<number | null>; hintKey: string };

const DEFAULT_INCREMENT_KG = 2.5;

/** Stretches or trims `weights` to exactly `count` entries, repeating the last one. */
function fitToSets(weights: number[], count: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push(weights[Math.min(i, weights.length - 1)]);
  }
  return out;
}

/** Next-session weights per set plus the i18n key explaining why. */
export function suggest(rx: RoutineExercise, history: Workout[], routineId?: string): Suggestion {
  const targets = rx.setTargets?.length
    ? rx.setTargets
    : Array.from({ length: rx.sets }, () => ({
        repMin: rx.repMin,
        repMax: rx.repMax,
        startWeightKg: rx.startWeightKg,
      }));
  const startWeights = targets.map((target) => target.startWeightKg ?? rx.startWeightKg ?? null);
  const lastSets = previousSets(
    history,
    rx.exerciseId,
    routineId,
    rx.occurrenceId,
    trackingOf(rx.tracking),
  );
  if (!lastSets.length) {
    return {
      weights: startWeights,
      hintKey: startWeights.some((weight) => weight === null) ? 'suggest.choose' : 'suggest.start',
    };
  }

  const lastWeights = fitToSets(
    lastSets.map((s) => s.weightKg),
    targets.length,
  );

  if (rx.setTargets?.length) {
    const increment = rx.incrementKg ?? DEFAULT_INCREMENT_KG;
    const weights = lastWeights.map((weight, index) => {
      const target = targets[index];
      const previous = lastSets[index];
      return target.repMax !== null && previous && previous.reps >= target.repMax
        ? weight + increment
        : weight;
    });
    return {
      weights,
      hintKey: weights.some((weight, index) => weight > lastWeights[index])
        ? 'suggest.increaseSets'
        : 'suggest.repeat',
    };
  }

  const repMax = rx.repMax;
  const closedTopOfRange =
    repMax !== null && lastSets.filter((s) => s.reps >= repMax).length >= targets.length;
  if (closedTopOfRange) {
    const increment = rx.incrementKg ?? DEFAULT_INCREMENT_KG;
    return { weights: lastWeights.map((w) => w + increment), hintKey: 'suggest.increase' };
  }

  return { weights: lastWeights, hintKey: 'suggest.repeat' };
}
