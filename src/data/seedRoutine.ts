import type { Folder, Routine } from '../lib/types';

// "Operazione Rientro" — 8-week comeback program: one routine per training day
// (Hevy model), grouped in a folder. Ids match the legacy migration output.
export const SEED_FOLDER: Folder = {
  id: 'operazione-rientro-folder',
  name: 'Operazione Rientro',
  updatedAt: 1,
};

export const SEED_ROUTINES: Routine[] = [
  {
    id: 'operazione-rientro-a',
    name: 'A · Upper Heavy',
    folderId: SEED_FOLDER.id,
    updatedAt: 1,
    warmup: "5' cardio + elastico spalle (pull-apart 2×15, dislocazioni 2×10)",
    exercises: [
        { exerciseId: 'Seated_Cable_Rows', sets: 2, repMin: 10, repMax: 12, restSec: 60, startWeightKg: 20, note: 'Attivazione scapolare: conta il movimento delle scapole, non il peso.' },
        { exerciseId: 'Dumbbell_Bench_Press', sets: 4, repMin: 5, repMax: 7, restSec: 150, startWeightKg: 14, note: 'Eccentrica controllata, fermo 1\u2033 al petto.' },
        { exerciseId: 'Smith_Machine_Incline_Bench_Press', sets: 3, repMin: 7, repMax: 9, restSec: 120, startWeightKg: 5, note: 'Eccentrica profonda in 3\u2033, spinta decisa e incompleta in alto.' },
        { exerciseId: 'Dumbbell_Incline_Row', sets: 4, repMin: 6, repMax: 8, restSec: 120, startWeightKg: 12, note: 'Petto in appoggio, fermo 1\u2033 in chiusura.' },
        { exerciseId: 'Wide-Grip_Lat_Pulldown', sets: 3, repMin: 8, repMax: 10, restSec: 90, startWeightKg: 30, note: 'Picco di contrazione 1\u20132\u2033, massimo allungamento in alto.' },
        { exerciseId: 'Face_Pull', sets: 3, repMin: 12, repMax: 15, restSec: 60, startWeightKg: 12, note: 'Fune al viso, gomiti alti, 1\u2033 di fermo. Qualit\u00e0 totale.' },
        { exerciseId: 'EZ-Bar_Curl', sets: 3, repMin: 8, repMax: 10, restSec: 90, startWeightKg: 5 },
    ],
  },
  {
    id: 'operazione-rientro-b',
    name: 'B · Lower Heavy',
    folderId: SEED_FOLDER.id,
    updatedAt: 1,
    warmup: "5' cardio + mobilità anche e caviglie (squat a corpo libero 2×10)",
    exercises: [
        { exerciseId: 'Calf_Press_On_The_Leg_Press_Machine', sets: 3, repMin: 10, repMax: 12, restSec: 60, startWeightKg: 50 },
        { exerciseId: 'Barbell_Squat', sets: 4, repMin: 5, repMax: 7, restSec: 150, startWeightKg: 20, note: 'Stance comoda, centro piede. Dalla sett. 3 fermo 2\u2033 in buca sulle prime 2 serie.' },
        { exerciseId: 'Leg_Press', sets: 3, repMin: 8, repMax: 10, restSec: 120, startWeightKg: 40, note: 'Spinta di centro piede, niente lock articolare.' },
        { exerciseId: 'Seated_Leg_Curl', sets: 3, repMin: 8, repMax: 10, restSec: 90, startWeightKg: 32, note: 'Eccentrica dilatata, picco marcato 1\u20132\u2033.' },
        { exerciseId: 'Leg_Extensions', sets: 3, repMin: 10, repMax: 12, restSec: 75, startWeightKg: 32 },
        { exerciseId: 'Hanging_Leg_Raise', sets: 3, repMin: 8, repMax: null, restSec: 60, startWeightKg: 0 },
        { exerciseId: 'Plank', sets: 3, repMin: 30, repMax: 45, restSec: 60, startWeightKg: 0, note: 'secondi' },
    ],
  },
  {
    id: 'operazione-rientro-c',
    name: 'C · Upper Hyper',
    folderId: SEED_FOLDER.id,
    updatedAt: 1,
    warmup: "5' cardio + elastico spalle (pull-apart 2×15, dislocazioni 2×10)",
    exercises: [
        { exerciseId: 'Butterfly', sets: 3, repMin: 10, repMax: 12, restSec: 75, startWeightKg: 16 },
        { exerciseId: 'Dumbbell_Bench_Press', sets: 3, repMin: 8, repMax: 10, restSec: 90, startWeightKg: 12 },
        { exerciseId: 'Cable_Crossover', sets: 2, repMin: 10, repMax: 12, restSec: 60, startWeightKg: 6 },
        { exerciseId: 'T-Bar_Row_with_Handle', sets: 3, repMin: 8, repMax: 10, restSec: 90, startWeightKg: 15 },
        { exerciseId: 'V-Bar_Pulldown', sets: 3, repMin: 10, repMax: 12, restSec: 90, startWeightKg: 25 },
        { exerciseId: 'Seated_Cable_Rows', sets: 2, repMin: 12, repMax: 15, restSec: 60, startWeightKg: 20 },
        { exerciseId: 'Seated_Side_Lateral_Raise', sets: 4, repMin: 10, repMax: 12, restSec: 50, startWeightKg: 8 },
        { exerciseId: 'Triceps_Pushdown_-_Rope_Attachment', sets: 3, repMin: 10, repMax: 12, restSec: 60, startWeightKg: 12.5 },
    ],
  },
  {
    id: 'operazione-rientro-d',
    name: 'D · Lower Hyper',
    folderId: SEED_FOLDER.id,
    updatedAt: 1,
    warmup: "5' cardio + mobilità anche e caviglie",
    exercises: [
        { exerciseId: 'Seated_Leg_Curl', sets: 3, repMin: 10, repMax: 12, restSec: 60, startWeightKg: 32 },
        { exerciseId: 'Romanian_Deadlift', sets: 3, repMin: 8, repMax: 10, restSec: 120, startWeightKg: 25, note: 'Eccentrica in 3\u2033, femorali in massimo allungamento, schiena neutra.' },
        { exerciseId: 'Hack_Squat', sets: 3, repMin: 10, repMax: 12, restSec: 90, startWeightKg: 20, note: 'Massima profondit\u00e0, focus quadricipiti.' },
        { exerciseId: 'Dumbbell_Lunges', sets: 2, repMin: 10, repMax: 12, restSec: 75, startWeightKg: 10 },
        { exerciseId: 'Leg_Extensions', sets: 2, repMin: 12, repMax: 15, restSec: 60, startWeightKg: 30 },
        { exerciseId: 'Spider_Curl', sets: 3, repMin: 10, repMax: 12, restSec: 60, startWeightKg: 8 },
        { exerciseId: 'EZ-Bar_Skullcrusher', sets: 3, repMin: 10, repMax: 12, restSec: 60, startWeightKg: 0 },
        { exerciseId: 'Side_Bridge', sets: 3, repMin: 20, repMax: 30, restSec: 45, startWeightKg: 0, note: 'secondi per lato' },
    ],
  },
];
