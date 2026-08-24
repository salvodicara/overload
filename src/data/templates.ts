import type { Routine } from '../lib/types';
import { SEED_ROUTINE } from './seedRoutine';

// Starter templates offered to new users. Using one copies it into the user's
// own routines (same id → re-adding is idempotent).
export const TEMPLATES: Routine[] = [
  SEED_ROUTINE,
  {
    id: 'push-pull-legs',
    name: 'Push / Pull / Legs',
    updatedAt: 1,
    days: [
      {
        label: 'A',
        name: 'Push',
        exercises: [
          { exerciseId: 'Dumbbell_Bench_Press', sets: 3, repMin: 8, repMax: 12, restSec: 120 },
          { exerciseId: 'Smith_Machine_Incline_Bench_Press', sets: 3, repMin: 8, repMax: 12, restSec: 90 },
          { exerciseId: 'Seated_Side_Lateral_Raise', sets: 3, repMin: 10, repMax: 15, restSec: 60 },
          { exerciseId: 'Butterfly', sets: 3, repMin: 10, repMax: 12, restSec: 75 },
          { exerciseId: 'Triceps_Pushdown_-_Rope_Attachment', sets: 3, repMin: 10, repMax: 12, restSec: 60 },
          { exerciseId: 'EZ-Bar_Skullcrusher', sets: 3, repMin: 10, repMax: 12, restSec: 60 },
        ],
      },
      {
        label: 'B',
        name: 'Pull',
        exercises: [
          { exerciseId: 'Wide-Grip_Lat_Pulldown', sets: 3, repMin: 8, repMax: 12, restSec: 90 },
          { exerciseId: 'Bent_Over_Barbell_Row', sets: 3, repMin: 8, repMax: 10, restSec: 120 },
          { exerciseId: 'Seated_Cable_Rows', sets: 3, repMin: 10, repMax: 12, restSec: 90 },
          { exerciseId: 'Face_Pull', sets: 3, repMin: 12, repMax: 15, restSec: 60 },
          { exerciseId: 'EZ-Bar_Curl', sets: 3, repMin: 8, repMax: 12, restSec: 75 },
          { exerciseId: 'Hammer_Curls', sets: 3, repMin: 10, repMax: 12, restSec: 60 },
        ],
      },
      {
        label: 'C',
        name: 'Legs',
        exercises: [
          { exerciseId: 'Barbell_Squat', sets: 4, repMin: 6, repMax: 10, restSec: 150, incrementKg: 5 },
          { exerciseId: 'Romanian_Deadlift', sets: 3, repMin: 8, repMax: 12, restSec: 120, incrementKg: 5 },
          { exerciseId: 'Leg_Press', sets: 3, repMin: 10, repMax: 12, restSec: 90, incrementKg: 5 },
          { exerciseId: 'Seated_Leg_Curl', sets: 3, repMin: 10, repMax: 12, restSec: 75 },
          { exerciseId: 'Standing_Calf_Raises', sets: 4, repMin: 10, repMax: 15, restSec: 60 },
          { exerciseId: 'Plank', sets: 3, repMin: 30, repMax: 60, restSec: 60 },
        ],
      },
    ],
  },
];
