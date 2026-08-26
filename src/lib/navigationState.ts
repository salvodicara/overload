import type { Route } from '../state/useStore';

export type HomeSurfaceState = {
  periodUnit?: 'week' | 'month' | 'year';
  periodAnchor?: string;
  chartMetric?: 'workouts' | 'workingSets' | 'volume' | 'durationMin';
  selectedDay?: string | null;
};

export type SurfaceStateMap = {
  home: HomeSurfaceState;
  history: {
    mode?: 'list' | 'calendar';
    anchor?: string;
    query?: string;
    routineId?: string;
    exerciseId?: string;
    visibleCount?: number;
    selectedDay?: string | null;
  };
  library: { query?: string; group?: string | null; visibleCount?: number };
  progress: { section?: string; exerciseId?: string; metric?: string; range?: string };
  train: { openProgramId?: string | null };
};

export type SurfaceView = keyof SurfaceStateMap;

export type HistoryEnvelope = {
  route: Route;
  entryKey: string;
  surfaces?: Partial<SurfaceStateMap>;
};

const entryScroll = new Map<string, number>();

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
    ...(surfaces && Object.keys(surfaces).length > 0 ? { surfaces } : {}),
  };
}

export function ensureHistoryEnvelope(route: Route, state: unknown): HistoryEnvelope {
  const current = objectOrEmpty(state);
  if (
    current.route &&
    typeof current.entryKey === 'string' &&
    (current.route as Route).view === route.view
  ) {
    const surfaces = objectOrEmpty(current.surfaces) as Partial<SurfaceStateMap>;
    return {
      route,
      entryKey: current.entryKey,
      ...(Object.keys(surfaces).length > 0 ? { surfaces } : {}),
    };
  }
  return newHistoryEnvelope(route);
}

export function readHistoryEnvelope(): HistoryEnvelope | null {
  const state = currentState();
  if (!state.route || typeof state.entryKey !== 'string') return null;
  const surfaces = objectOrEmpty(state.surfaces) as Partial<SurfaceStateMap>;
  return {
    route: state.route as Route,
    entryKey: state.entryKey,
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
  const surfaces = objectOrEmpty(currentState().surfaces);
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
