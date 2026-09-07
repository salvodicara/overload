import type { Workout } from './types';

/** The saved training date wins over import/edit timestamps. */
export const newestWorkoutFirst = (left: Workout, right: Workout): number =>
  right.date.localeCompare(left.date) ||
  right.startTs - left.startTs ||
  right.updatedAt - left.updatedAt ||
  right.id.localeCompare(left.id);
