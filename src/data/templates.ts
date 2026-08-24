import type { Folder, Routine } from '../lib/types';
import { SEED_FOLDER, SEED_ROUTINES } from './seedRoutine';

export type TemplatePack = { folder: Folder; routines: Routine[] };

// Starter packs offered on the Workout tab. "Using" one copies its folder and
// routines into the user's data (deterministic ids → re-adding is idempotent).
export const TEMPLATES: TemplatePack[] = [
  { folder: SEED_FOLDER, routines: SEED_ROUTINES },
  {
    folder: { id: 'ppl-folder', name: 'Push / Pull / Legs', updatedAt: 1 },
    routines: [
      {
        id: 'ppl-push',
        name: 'Push',
        folderId: 'ppl-folder',
        updatedAt: 1,
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
        id: 'ppl-pull',
        name: 'Pull',
        folderId: 'ppl-folder',
        updatedAt: 1,
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
        id: 'ppl-legs',
        name: 'Legs',
        folderId: 'ppl-folder',
        updatedAt: 1,
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
