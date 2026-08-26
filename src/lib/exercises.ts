import { CURATED } from '../data/curated';
import EQUIPMENT_KEYS from '../data/equipment.json';
import NAMES_IT from '../data/names.it.json';
import type { Exercise } from './types';

type FedbExercise = {
  id: string;
  name: string;
  equipment?: string | null;
  primaryMuscles: string[];
  instructions?: string[];
  images?: string[];
};

export type CatalogExercise = Exercise & { instructions: string[] };

export type MuscleGroup = 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core' | 'calves';

export function equipmentLabelKey(equipment: string): string {
  const keys = EQUIPMENT_KEYS as Record<string, string>;
  return `library.equipment.${keys[equipment.trim().toLowerCase()] ?? 'other'}`;
}

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
          nameIt: (NAMES_IT as Record<string, string>)[row.id] ?? row.name,
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
  const q = normalizeSearch(query);
  const all = [...getCatalog().values()];
  return all
    .flatMap((exercise) => {
      if (group && muscleGroup(exercise) !== group) return [];
      const score = q ? searchScore(exercise, q) : 0;
      return score === null ? [] : [{ exercise, score }];
    })
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      const an = locale === 'it' ? a.exercise.nameIt : a.exercise.nameEn;
      const bn = locale === 'it' ? b.exercise.nameIt : b.exercise.nameEn;
      return an.localeCompare(bn, locale);
    })
    .map(({ exercise }) => exercise);
}

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function searchScore(exercise: CatalogExercise, query: string): number | null {
  const names = [exercise.nameIt, exercise.nameEn, ...(exercise.aliases ?? [])]
    .map(normalizeSearch)
    .filter(Boolean);
  if (names.some((name) => name === query)) return 0;
  if (names.some((name) => name.startsWith(query))) return 10;
  if (names.some((name) => name.includes(query))) return 20;

  const queryTokens = query.split(' ');
  let best: number | null = null;
  for (const name of names) {
    const words = name.split(' ');
    const exactTokens = queryTokens.every((token) =>
      words.some((word) => (token.length < 3 ? word === token : word.includes(token))),
    );
    if (exactTokens) {
      best = Math.min(best ?? 30, 30);
      continue;
    }
    const fuzzyTokens = queryTokens.every((token) =>
      words.some((word) => isCloseToken(token, word)),
    );
    if (fuzzyTokens) best = Math.min(best ?? 50, 50);
  }
  return best;
}

function isCloseToken(query: string, candidate: string): boolean {
  if (query.length < 5 || candidate.length < 5) return false;
  const threshold = Math.min(2, Math.floor(Math.max(query.length, candidate.length) / 4));
  if (Math.abs(query.length - candidate.length) > threshold) return false;
  return editDistanceWithin(query, candidate, threshold);
}

function editDistanceWithin(a: string, b: string, limit: number): boolean {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let ai = 1; ai <= a.length; ai += 1) {
    const current = [ai];
    let rowBest = current[0];
    for (let bi = 1; bi <= b.length; bi += 1) {
      const cost = a[ai - 1] === b[bi - 1] ? 0 : 1;
      const value = Math.min(current[bi - 1] + 1, previous[bi] + 1, previous[bi - 1] + cost);
      current.push(value);
      rowBest = Math.min(rowBest, value);
    }
    if (rowBest > limit) return false;
    previous = current;
  }
  return previous[b.length] <= limit;
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
