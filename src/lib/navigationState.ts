import type { Route } from '../state/useStore';

export type HomeSurfaceState = {
  periodUnit?: 'week' | 'month' | 'year';
  periodAnchor?: string;
  chartMetric?: 'workouts' | 'workingSets' | 'volume' | 'durationMin';
  selectedDay?: string | null;
};

export type SurfaceStateMap = {
  home: HomeSurfaceState;
  diet: { date?: string };
  history: {
    mode?: 'list' | 'calendar';
    anchor?: string;
    query?: string;
    routineId?: string;
    exerciseId?: string;
    visibleCount?: number;
    selectedDay?: string | null;
  };
  library: {
    query?: string;
    group?: string | null;
    visibleCount?: number;
    equipment?: string;
    sort?: 'name' | 'recent';
  };
  progress: HomeSurfaceState & {
    section?: string;
    exerciseId?: string;
    metric?: string;
    range?: string;
  };
  train: { openProgramId?: string | null };
};

export type SurfaceView = keyof SurfaceStateMap;

export type HistoryEnvelope = {
  route: Route;
  entryKey: string;
  owner?: string;
  surfaces?: Partial<SurfaceStateMap>;
  parent?: { route: Route; entryKey: string };
};

const entryScroll = new Map<string, number>();
let navigationOwner: string | undefined;

export function isNavigationOwnerCurrent(state: unknown): boolean {
  return !navigationOwner || objectOrEmpty(state).owner === navigationOwner;
}

export function bindNavigationOwner(uid: string, reset: boolean): void {
  navigationOwner = uid;
  if (reset) {
    entryScroll.clear();
    entrySnapshots.clear();
  }
  if (typeof history === 'undefined') return;
  const current = currentState();
  const next =
    reset || (current.owner !== undefined && current.owner !== uid)
      ? newHistoryEnvelope({ view: 'home' })
      : { ...current, owner: uid };
  history.replaceState(next, '');
}

function objectOrEmpty(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function currentState(): Record<string, unknown> {
  if (typeof history === 'undefined') return {};
  return objectOrEmpty(history.state);
}

export function createEntryKey(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

export function newHistoryEnvelope(
  route: Route,
  surfaces?: Partial<SurfaceStateMap>,
): HistoryEnvelope {
  return {
    route,
    entryKey: createEntryKey(),
    ...(navigationOwner ? { owner: navigationOwner } : {}),
    ...(surfaces && Object.keys(surfaces).length > 0 ? { surfaces } : {}),
  };
}

export function ensureHistoryEnvelope(route: Route, state: unknown): HistoryEnvelope {
  const current = objectOrEmpty(state);
  if (
    isNavigationOwnerCurrent(current) &&
    current.route &&
    typeof current.entryKey === 'string' &&
    JSON.stringify(current.route) === JSON.stringify(route)
  ) {
    const surfaces = objectOrEmpty(current.surfaces) as Partial<SurfaceStateMap>;
    return {
      ...current,
      route,
      entryKey: current.entryKey,
      ...(typeof current.owner === 'string' ? { owner: current.owner } : {}),
      ...(Object.keys(surfaces).length > 0 ? { surfaces } : {}),
    };
  }
  return newHistoryEnvelope(route);
}

export function readHistoryEnvelope(): HistoryEnvelope | null {
  const state = currentState();
  if (
    !isNavigationOwnerCurrent(state) ||
    !validRoute(state.route) ||
    typeof state.entryKey !== 'string'
  )
    return null;
  const surfaces = objectOrEmpty(state.surfaces) as Partial<SurfaceStateMap>;
  return {
    ...state,
    route: state.route as Route,
    entryKey: state.entryKey,
    ...(typeof state.owner === 'string' ? { owner: state.owner } : {}),
    ...(Object.keys(surfaces).length > 0 ? { surfaces } : {}),
  };
}

export function replaceSurfaceState<K extends SurfaceView>(
  view: K,
  snapshot: SurfaceStateMap[K],
): void {
  if (typeof history === 'undefined') return;
  const current = currentState();
  const surfaces = objectOrEmpty(current.surfaces);
  history.replaceState({ ...current, surfaces: { ...surfaces, [view]: snapshot } }, '');
}

export function surfaceStateFor<K extends SurfaceView>(view: K): SurfaceStateMap[K] {
  const state = currentState();
  const surfaces = isNavigationOwnerCurrent(state) ? objectOrEmpty(state.surfaces) : {};
  return objectOrEmpty(surfaces[view]) as SurfaceStateMap[K];
}

function scrollKey(view: string, entryKey: string): string {
  return `${entryKey}\0${view}`;
}

export function writeEntryScroll(view: string, y: number, entryKey?: string): void {
  const key = entryKey ?? readHistoryEnvelope()?.entryKey;
  if (!key) return;
  entryScroll.set(scrollKey(view, key), Math.max(0, y));
  writeEntryValue('scrollY', Math.max(0, y), key);
}

export function readEntryScroll(view: string, entryKey?: string): number {
  const key = entryKey ?? readHistoryEnvelope()?.entryKey;
  return key
    ? (entryScroll.get(scrollKey(view, key)) ?? readEntryValue<number>('scrollY', key) ?? 0)
    : 0;
}

/** History is browser-controlled input: reject malformed or obsolete route payloads. */
export function validRoute(value: unknown): value is Route {
  const r = objectOrEmpty(value);
  if (typeof r.view !== 'string') return false;
  if (
    [
      'home',
      'train',
      'profile',
      'settings',
      'body',
      'diet',
      'workout',
      'routineImport',
      'foodImport',
      'importExport',
    ].includes(r.view)
  )
    return true;
  if (['routine', 'routineEditor', 'exercise', 'workoutDetail', 'workoutEditor'].includes(r.view))
    return typeof r.id === 'string' && r.id.length > 0;
  if (r.view === 'summary') return typeof r.workoutId === 'string';
  if (r.view === 'history')
    return r.mode === undefined || ['list', 'calendar'].includes(String(r.mode));
  if (r.view === 'progress') return r.exerciseId === undefined || typeof r.exerciseId === 'string';
  if (r.view === 'library') {
    if (r.pickFor === undefined) return true;
    const pick = objectOrEmpty(r.pickFor);
    return (
      typeof pick.routineId === 'string' ||
      (pick.activeWorkout === true &&
        (pick.replaceInstanceId === undefined || typeof pick.replaceInstanceId === 'string'))
    );
  }
  if (
    !['foodAdd', 'foodEdit', 'foodTotals'].includes(r.view) ||
    typeof r.date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(r.date)
  )
    return false;
  return (
    r.view === 'foodTotals' ||
    (r.view === 'foodEdit'
      ? typeof r.entryId === 'string'
      : ['breakfast', 'lunch', 'dinner', 'snack'].includes(String(r.meal)))
  );
}

const entrySnapshots = new Map<string, Record<string, unknown>>();
function snapshotKey(entryKey?: string): string | undefined {
  const entry = readHistoryEnvelope();
  const key = entryKey ?? entry?.entryKey;
  return key
    ? `overload_navigation:${navigationOwner ?? entry?.owner ?? 'anonymous'}:${key}`
    : undefined;
}
function snapshot(entryKey?: string): Record<string, unknown> {
  const key = snapshotKey(entryKey);
  if (!key) return {};
  const cached = entrySnapshots.get(key);
  if (cached) return cached;
  let value: Record<string, unknown> = {};
  try {
    value = objectOrEmpty(JSON.parse(sessionStorage.getItem(key) ?? '{}'));
  } catch {
    /* Optional session storage. */
  }
  entrySnapshots.set(key, value);
  return value;
}
export function readEntryValue<T>(name: string, entryKey?: string): T | undefined {
  return snapshot(entryKey)[name] as T | undefined;
}
export function writeEntryValue(name: string, value: unknown, entryKey?: string): void {
  const key = snapshotKey(entryKey);
  if (!key) return;
  const next = { ...snapshot(entryKey), [name]: value };
  entrySnapshots.set(key, next);
  try {
    sessionStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* Retain working context in memory if storage is unavailable/full. */
  }
}
export function clearEntryDrafts(entryKey?: string): void {
  const key = snapshotKey(entryKey);
  if (!key) return;
  const { scrollY, presentation } = snapshot(entryKey);
  const next = { scrollY, presentation };
  entrySnapshots.set(key, next);
  try {
    sessionStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* Optional storage. */
  }
}

/** Picking an item returns to its existing caller instead of duplicating the editor in history. */
export function returnToCaller(route: Route, fallback: (route: Route) => void): void {
  const parent = readHistoryEnvelope()?.parent;
  if (parent && JSON.stringify(parent.route) === JSON.stringify(route)) history.back();
  else fallback(route);
}
