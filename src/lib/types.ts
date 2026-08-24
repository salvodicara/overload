export type SetLog = {
  exerciseId: string;
  weightKg: number;
  reps: number;
  done: boolean;
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
  source: 'app' | 'hevy' | 'import';
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
};

export type RoutineDay = {
  label: string;
  name: string;
  warmup?: string;
  exercises: RoutineExercise[];
};

export type Routine = {
  id: string;
  name: string;
  days: RoutineDay[];
  updatedAt: number;
};

export type Settings = {
  id: 'settings';
  programStartDate?: string;
  locale?: 'it' | 'en';
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
