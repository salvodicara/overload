import { CURATED } from '../data/curated';
import type { Exercise } from './types';

type FedbExercise = {
  id: string;
  name: string;
  equipment?: string | null;
  primaryMuscles: string[];
  secondaryMuscles?: string[];
  instructions?: string[];
  images?: string[];
};

export type CatalogExercise = Exercise & { instructions: string[] };

export type MuscleGroup = 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core' | 'calves';

const GROUP_OF: Record<string, MuscleGroup> = {
  chest: 'chest',
  lats: 'back',
  'middle back': 'back',
  'lower back': 'back',
  traps: 'back',
  neck: 'back',
  quadriceps: 'legs',
  hamstrings: 'legs',
  glutes: 'legs',
  adductors: 'legs',
  abductors: 'legs',
  shoulders: 'shoulders',
  biceps: 'arms',
  triceps: 'arms',
  forearms: 'arms',
  abdominals: 'core',
  calves: 'calves',
};

export function muscleGroup(ex: Exercise): MuscleGroup {
  return GROUP_OF[ex.muscles[0] ?? ''] ?? 'core';
}

let catalog: Map<string, CatalogExercise> | null = null;
let loading: Promise<Map<string, CatalogExercise>> | null = null;

export function loadCatalog(): Promise<Map<string, CatalogExercise>> {
  if (catalog) return Promise.resolve(catalog);
  loading ??= fetch('/data/exercises.json')
    .then((r) => r.json() as Promise<FedbExercise[]>)
    .then((rows) => {
      const map = new Map<string, CatalogExercise>();
      for (const row of rows) {
        const cur = CURATED[row.id];
        map.set(row.id, {
          id: row.id,
          nameEn: row.name,
          nameIt: cur?.nameIt ?? row.name,
          muscles: row.primaryMuscles,
          equipment: row.equipment ?? undefined,
          media: (row.images ?? []).map((p) => `/exercise-media/${p}`),
          youtubeId: cur?.youtubeId,
          aliases: cur?.aliases,
          instructions: row.instructions ?? [],
        });
      }
      catalog = map;
      return map;
    });
  return loading;
}

/** Synchronous access after loadCatalog resolved (returns empty map before). */
export function getCatalog(): Map<string, CatalogExercise> {
  return catalog ?? new Map();
}

export function exerciseName(id: string, locale: string): string {
  const ex = getCatalog().get(id);
  if (ex) return locale === 'it' ? ex.nameIt : ex.nameEn;
  // Unknown exercises created by import keep their original title in the id.
  return id.startsWith('hevy:') ? humanize(id.slice(5)) : humanize(id);
}

function humanize(s: string): string {
  return s.replace(/[_-]+/g, ' ').trim();
}

export function searchExercises(query: string, group: MuscleGroup | null, locale: string): CatalogExercise[] {
  const q = query.trim().toLowerCase();
  const all = [...getCatalog().values()];
  return all
    .filter((ex) => {
      if (group && muscleGroup(ex) !== group) return false;
      if (!q) return true;
      return (
        ex.nameIt.toLowerCase().includes(q) ||
        ex.nameEn.toLowerCase().includes(q) ||
        (ex.aliases ?? []).some((a) => a.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      const an = locale === 'it' ? a.nameIt : a.nameEn;
      const bn = locale === 'it' ? b.nameIt : b.nameEn;
      const aCur = a.id in CURATED ? 0 : 1;
      const bCur = b.id in CURATED ? 0 : 1;
      return aCur - bCur || an.localeCompare(bn);
    });
}

/** Hevy exercise_title → exerciseId map for the CSV importer. */
export function hevyAliasMap(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, cur] of Object.entries(CURATED)) {
    for (const alias of cur.aliases ?? []) out[alias] = id;
  }
  return out;
}
