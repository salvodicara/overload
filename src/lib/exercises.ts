import { CURATED } from '../data/curated';
import NAMES_IT from '../data/names.it.json';
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
  back: 'back',
  lats: 'back',
  'middle back': 'back',
  'lower back': 'back',
  traps: 'back',
  neck: 'back',
  legs: 'legs',
  quadriceps: 'legs',
  hamstrings: 'legs',
  glutes: 'legs',
  adductors: 'legs',
  abductors: 'legs',
  shoulders: 'shoulders',
  arms: 'arms',
  biceps: 'arms',
  triceps: 'arms',
  forearms: 'arms',
  abdominals: 'core',
  calves: 'calves',
};

export function muscleGroup(ex: Exercise): MuscleGroup {
  return GROUP_OF[ex.muscles[0] ?? ''] ?? 'core';
}

let publicCatalog: Map<string, CatalogExercise> | null = null;
let customCatalog = new Map<string, CatalogExercise>();
let catalog = new Map<string, CatalogExercise>();
let loading: Promise<Map<string, CatalogExercise>> | null = null;

function mergeCatalogs(): Map<string, CatalogExercise> {
  catalog = new Map([...(publicCatalog ?? []), ...customCatalog]);
  return catalog;
}

export function loadCatalog(): Promise<Map<string, CatalogExercise>> {
  if (publicCatalog) return Promise.resolve(catalog);
  loading ??= fetch('/data/exercises.json')
    .then((response) => {
      if (!response.ok) throw new Error(`catalog request failed: ${response.status}`);
      return response.json() as Promise<FedbExercise[]>;
    })
    .then((rows) => {
      const map = new Map<string, CatalogExercise>();
      for (const row of rows) {
        const cur = CURATED[row.id];
        map.set(row.id, {
          id: row.id,
          nameEn: row.name,
          nameIt: cur?.nameIt ?? (NAMES_IT as Record<string, string>)[row.id] ?? row.name,
          muscles: row.primaryMuscles,
          equipment: row.equipment ?? undefined,
          media: (row.images ?? []).map((p) => `/exercise-media/${p}`),
          youtubeId: cur?.youtubeId,
          aliases: cur?.aliases,
          instructions: row.instructions ?? [],
        });
      }
      publicCatalog = map;
      loading = null;
      return mergeCatalogs();
    })
    .catch((error: unknown) => {
      loading = null;
      throw error;
    });
  return loading;
}

/** User-created exercises join the same catalog map so every screen just works. */
export function registerCustomExercises(
  list: { id: string; name: string; muscleGroup: string }[],
): void {
  const next = new Map<string, CatalogExercise>();
  for (const x of list) {
    next.set(x.id, {
      id: x.id,
      nameEn: x.name,
      nameIt: x.name,
      muscles: [x.muscleGroup === 'core' ? 'abdominals' : x.muscleGroup],
      media: [],
      instructions: [],
    });
  }
  customCatalog = next;
  mergeCatalogs();
}

/** Synchronous access includes registered custom rows before the public catalog resolves. */
export function getCatalog(): Map<string, CatalogExercise> {
  return catalog;
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

export function searchExercises(
  query: string,
  group: MuscleGroup | null,
  locale: string,
): CatalogExercise[] {
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
      return an.localeCompare(bn, locale);
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

// Italian instruction steps live in a separate lazily-fetched asset so the
// main bundle stays lean; English (in the catalog) is the fallback.
let instructionsIt: Record<string, string[]> | null = null;
let instructionsItLoading: Promise<void> | null = null;

export function loadItalianInstructions(): Promise<void> {
  instructionsItLoading ??= fetch('/data/instructions.it.json')
    .then((r) => (r.ok ? (r.json() as Promise<Record<string, string[]>>) : {}))
    .then((data) => {
      instructionsIt = data;
    })
    .catch(() => {
      instructionsIt = {};
    });
  return instructionsItLoading;
}

export function italianInstructions(id: string): string[] | null {
  return instructionsIt?.[id] ?? null;
}
