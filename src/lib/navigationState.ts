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
};

const entryScroll = new Map<string, number>();
let navigationOwner: string | undefined;

export function isNavigationOwnerCurrent(state: unknown): boolean {
  return !navigationOwner || objectOrEmpty(state).owner === navigationOwner;
}

export function bindNavigationOwner(uid: string, reset: boolean): void {
  navigationOwner = uid;
  if (reset) entryScroll.clear();
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
    (current.route as Route).view === route.view
  ) {
    const surfaces = objectOrEmpty(current.surfaces) as Partial<SurfaceStateMap>;
    return {
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
  if (!isNavigationOwnerCurrent(state) || !state.route || typeof state.entryKey !== 'string')
    return null;
  const surfaces = objectOrEmpty(state.surfaces) as Partial<SurfaceStateMap>;
  return {
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
}

export function readEntryScroll(view: string, entryKey?: string): number {
  const key = entryKey ?? readHistoryEnvelope()?.entryKey;
  return key ? (entryScroll.get(scrollKey(view, key)) ?? 0) : 0;
}
