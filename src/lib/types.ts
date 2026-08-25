import type { WeightUnit } from './units';

export type TrackingType = 'weight_reps' | 'reps' | 'duration';

export type SetKind = 'warmup' | 'working';

export const trackingOf = (value?: TrackingType): TrackingType => value ?? 'weight_reps';

export const kindOf = (value?: SetKind): SetKind => value ?? 'working';

export type SetLog = {
  exerciseId: string;
  weightKg: number;
  reps: number;
  done: boolean;
  tracking?: TrackingType;
  kind?: SetKind;
  durationSec?: number;
  isPr?: boolean;
};

export type Workout = {
  id: string;
  routineId?: string;
  dayLabel?: string;
  /** YYYY-MM-DD */
  date: string;
  startTs: number;
  endTs?: number;
  sets: SetLog[];
  volumeKg: number;
  note?: string;
  updatedAt: number;
  source: 'app' | 'hevy';
};

export type RoutineExercise = {
  exerciseId: string;
  sets: number;
  repMin: number;
  /** null = open-ended (e.g. "max") */
  repMax: number | null;
  restSec: number;
  note?: string;
  startWeightKg?: number;
  incrementKg?: number;
  tracking?: TrackingType;
  warmupSets?: { weightKg?: number; reps?: number; durationSec?: number }[];
};

/** Hevy model: a routine IS one workout template; folders group them. */
export type Routine = {
  id: string;
  name: string;
  folderId?: string;
  warmup?: string;
  exercises: RoutineExercise[];
  updatedAt: number;
};

/** Per-exercise training notes: dated entries that accumulate, never overwrite. */
export type ExerciseNote = {
  /** exerciseId */
  id: string;
  entries: { date: string; text: string }[];
  updatedAt: number;
};

export type Folder = {
  id: string;
  name: string;
  updatedAt: number;
};

/** Pre-migration shape (multi-day container); converted on load. */
export type LegacyRoutine = {
  id: string;
  name: string;
  days: { label: string; name: string; warmup?: string; exercises: RoutineExercise[] }[];
  updatedAt: number;
};

export type Settings = {
  id: 'settings';
  unit?: WeightUnit;
  programStartDate?: string;
  locale?: 'it' | 'en';
  kcalTarget?: number;
  proteinTarget?: number;
  weeklyGoal?: number;
  updatedAt: number;
};

/** User-created exercise (id `custom:<uuid>`), synced like everything else. */
export type CustomExercise = {
  id: string;
  name: string;
  muscleGroup: string;
  updatedAt: number;
};

export type MeasureMetric = 'weight' | 'waist' | 'chest' | 'arm' | 'thigh' | 'calf';

export type Measurement = {
  id: string;
  date: string;
  metric: MeasureMetric;
  value: number;
  updatedAt: number;
};

/** One nutrition row per day; id === date. */
export type NutritionDay = {
  id: string;
  date: string;
  kcal: number | null;
  proteinG: number | null;
  updatedAt: number;
};

export type Exercise = {
  id: string;
  nameIt: string;
  nameEn: string;
  muscles: string[];
  equipment?: string;
  media?: string[];
  youtubeId?: string;
  aliases?: string[];
};
