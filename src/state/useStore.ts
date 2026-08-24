import { create } from 'zustand';
import {
  applyImport as dbApplyImport,
  deleteWorkout as dbDeleteWorkout,
  getSettings,
  listRoutines,
  listWorkouts,
  saveRoutine,
  saveSettings,
  saveWorkout,
} from '../lib/db';
import { pushRecord, startSync, type SyncState } from '../lib/sync';
import { computeVolume, flagPrs } from '../lib/volume';
import { getPhase, suggest, type Phase } from '../lib/progression';
import { workoutId } from '../lib/ids';
import { unlockAudio, requestNotifyPermission } from '../lib/audio';
import { acquireWakeLock, releaseWakeLock } from '../lib/wakeLock';
import { SEED_ROUTINE } from '../data/seedRoutine';
import { loadCatalog } from '../lib/exercises';
import type { Routine, Settings, Workout } from '../lib/types';

export type Route =
  | { view: 'home' }
  | { view: 'workout' }
  | { view: 'summary'; workoutId: string }
  | { view: 'history' }
  | { view: 'workoutDetail'; id: string }
  | { view: 'progress' }
  | { view: 'library'; pickFor?: { routineId: string; dayIndex: number } }
  | { view: 'exercise'; id: string }
  | { view: 'settings' }
  | { view: 'importExport' }
  | { view: 'routines' }
  | { view: 'routineEditor'; id: string };

export type AppUser = { uid: string; name: string | null };

export type ActiveSet = { weightKg: number | null; reps: number | null; done: boolean };
export type ActiveSession = {
  routineId: string;
  dayIndex: number;
  startTs: number;
  ex: { exerciseId: string; sets: ActiveSet[]; hintKey: string }[];
};

const ACTIVE_KEY = 'overload_active';

function readActive(): ActiveSession | null {
  try {
    return JSON.parse(localStorage.getItem(ACTIVE_KEY) ?? 'null') as ActiveSession | null;
  } catch {
    return null;
  }
}

function persistActive(a: ActiveSession | null): void {
  try {
    if (a) localStorage.setItem(ACTIVE_KEY, JSON.stringify(a));
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* storage full/unavailable: session survives in memory */
  }
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

type ToastListener = (msg: string) => void;
let toastListener: ToastListener | null = null;
export function onToast(l: ToastListener): void {
  toastListener = l;
}
export function toast(msg: string): void {
  toastListener?.(msg);
}

let stopSync: (() => void) | null = null;

export type Store = {
  route: Route;
  user: AppUser | null | undefined;
  settings: Settings;
  workouts: Workout[];
  routines: Routine[];
  syncState: SyncState;
  active: ActiveSession | null;
  restUntil: number | null;
  restExerciseId: string | null;
  catalogReady: boolean;

  nav(route: Route): void;
  setUser(user: AppUser | null): void;
  init(): Promise<void>;
  reload(): Promise<void>;
  updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void>;
  phase(): Phase | null;

  startWorkout(routineId: string, dayIndex: number): void;
  updateSet(ei: number, si: number, patch: Partial<ActiveSet>): void;
  toggleDone(ei: number, si: number): void;
  addSet(ei: number): void;
  removeSet(ei: number): void;
  abandonWorkout(): void;
  finishWorkout(): Promise<Workout | null>;

  startRest(sec: number, exerciseId: string): void;
  stopRest(): void;

  saveRoutine(r: Routine): Promise<void>;
  addExerciseToRoutineDay(routineId: string, dayIndex: number, exerciseId: string): Promise<void>;
  deleteWorkout(id: string): Promise<void>;
  importWorkouts(fresh: Workout[]): Promise<void>;
};

export const useStore = create<Store>((set, get) => ({
  route: { view: 'home' },
  user: undefined,
  settings: { id: 'settings', updatedAt: 0 },
  workouts: [],
  routines: [],
  syncState: 'offline',
  active: readActive(),
  restUntil: null,
  restExerciseId: null,
  catalogReady: false,

  nav(route) {
    set({ route });
    window.scrollTo(0, 0);
  },

  setUser(user) {
    const prev = get().user;
    set({ user });
    if (import.meta.env.VITE_E2E === '1') return;
    if (user && user.uid !== prev?.uid) {
      stopSync?.();
      stopSync = startSync(user.uid, (s) => set({ syncState: s }));
    }
    if (!user) {
      stopSync?.();
      stopSync = null;
    }
  },

  async init() {
    void loadCatalog().then(() => set({ catalogReady: true }));
    const routines = await listRoutines();
    if (routines.length === 0) {
      await saveRoutine(SEED_ROUTINE);
    }
    await get().reload();
    if (get().active) set({ route: { view: 'workout' } });
  },

  async reload() {
    const [workouts, routines, settings] = await Promise.all([
      listWorkouts(),
      listRoutines(),
      getSettings(),
    ]);
    set({ workouts, routines, settings });
  },

  async updateSettings(patch) {
    const settings = await saveSettings(patch);
    set({ settings });
    const uid = get().user?.uid;
    if (uid) void pushRecord(uid, 'settings', settings);
  },

  phase() {
    return getPhase(get().settings.programStartDate, todayISO());
  },

  startWorkout(routineId, dayIndex) {
    const routine = get().routines.find((r) => r.id === routineId);
    const day = routine?.days[dayIndex];
    if (!routine || !day) return;
    unlockAudio();
    requestNotifyPermission();
    acquireWakeLock();
    const phase = get().phase();
    const history = get().workouts;
    const active: ActiveSession = {
      routineId,
      dayIndex,
      startTs: Date.now(),
      ex: day.exercises.map((rx) => {
        const s = suggest(rx, history, phase);
        return {
          exerciseId: rx.exerciseId,
          hintKey: s.hintKey,
          sets: s.weights.map((w) => ({ weightKg: w, reps: null, done: false })),
        };
      }),
    };
    persistActive(active);
    set({ active, route: { view: 'workout' } });
  },

  updateSet(ei, si, patch) {
    const active = get().active;
    if (!active) return;
    const next = structuredClone(active);
    Object.assign(next.ex[ei].sets[si], patch);
    persistActive(next);
    set({ active: next });
  },

  toggleDone(ei, si) {
    const active = get().active;
    if (!active) return;
    const next = structuredClone(active);
    const s = next.ex[ei].sets[si];
    s.done = !s.done;
    const routine = get().routines.find((r) => r.id === active.routineId);
    const rx = routine?.days[active.dayIndex]?.exercises[ei];
    if (s.done && s.reps == null && rx) s.reps = rx.repMin;
    persistActive(next);
    set({ active: next });
    if (s.done && rx) get().startRest(rx.restSec, rx.exerciseId);
  },

  addSet(ei) {
    const active = get().active;
    if (!active) return;
    const next = structuredClone(active);
    const sets = next.ex[ei].sets;
    const last = sets[sets.length - 1];
    sets.push({ weightKg: last?.weightKg ?? null, reps: null, done: false });
    persistActive(next);
    set({ active: next });
  },

  removeSet(ei) {
    const active = get().active;
    if (!active) return;
    const next = structuredClone(active);
    if (next.ex[ei].sets.length > 1) next.ex[ei].sets.pop();
    persistActive(next);
    set({ active: next });
  },

  abandonWorkout() {
    persistActive(null);
    releaseWakeLock();
    set({ active: null, restUntil: null, restExerciseId: null, route: { view: 'home' } });
  },

  async finishWorkout() {
    const active = get().active;
    if (!active) return null;
    const routine = get().routines.find((r) => r.id === active.routineId);
    const day = routine?.days[active.dayIndex];
    const date = todayISO();
    const doneSets = active.ex.flatMap((e) =>
      e.sets
        .filter((s) => s.done)
        .map((s) => ({
          exerciseId: e.exerciseId,
          weightKg: s.weightKg ?? 0,
          reps: s.reps ?? 0,
          done: true,
        })),
    );
    if (doneSets.length === 0) return null;
    const flagged = flagPrs(doneSets, get().workouts, date);
    const workout: Workout = {
      id: workoutId('app', date, `${day?.label ?? 'x'}-${active.startTs}`),
      routineId: active.routineId,
      dayLabel: day ? `${day.label} · ${day.name}` : undefined,
      date,
      startTs: active.startTs,
      endTs: Date.now(),
      sets: flagged,
      volumeKg: computeVolume(flagged),
      updatedAt: Date.now(),
      source: 'app',
    };
    await saveWorkout(workout);
    persistActive(null);
    releaseWakeLock();
    set({
      active: null,
      restUntil: null,
      restExerciseId: null,
      workouts: [workout, ...get().workouts],
      route: { view: 'summary', workoutId: workout.id },
    });
    const uid = get().user?.uid;
    if (uid) void pushRecord(uid, 'workouts', workout);
    return workout;
  },

  startRest(sec, exerciseId) {
    set({ restUntil: Date.now() + sec * 1000, restExerciseId: exerciseId });
  },

  stopRest() {
    set({ restUntil: null, restExerciseId: null });
  },

  async saveRoutine(r) {
    const next = { ...r, updatedAt: Date.now() };
    await saveRoutine(next);
    set({ routines: get().routines.map((x) => (x.id === next.id ? next : x)) });
    if (!get().routines.some((x) => x.id === next.id)) {
      set({ routines: [...get().routines, next] });
    }
    const uid = get().user?.uid;
    if (uid) void pushRecord(uid, 'routines', next);
  },

  async addExerciseToRoutineDay(routineId, dayIndex, exerciseId) {
    const routine = get().routines.find((r) => r.id === routineId);
    const day = routine?.days[dayIndex];
    if (!routine || !day) return;
    const next = structuredClone(routine);
    next.days[dayIndex].exercises.push({
      exerciseId,
      sets: 3,
      repMin: 8,
      repMax: 12,
      restSec: 90,
    });
    await get().saveRoutine(next);
  },

  async deleteWorkout(id) {
    await dbDeleteWorkout(id);
    set({ workouts: get().workouts.filter((w) => w.id !== id) });
  },

  async importWorkouts(fresh) {
    await dbApplyImport(fresh);
    await get().reload();
    const uid = get().user?.uid;
    if (uid) for (const w of fresh) void pushRecord(uid, 'workouts', w);
  },
}));
