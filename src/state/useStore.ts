import { create } from 'zustand';
import {
  applyImport as dbApplyImport,
  db,
  deleteFolder as dbDeleteFolder,
  deleteRoutine as dbDeleteRoutine,
  deleteWorkout as dbDeleteWorkout,
  getSettings,
  listFolders,
  listRoutines,
  listWorkouts,
  saveFolder,
  saveRoutine,
  saveSettings,
  saveWorkout,
} from '../lib/db';
import { deleteRecord, pushRecord, startSync, type SyncState } from '../lib/sync';
import { computeVolume, flagPrs } from '../lib/volume';
import { getPhase, suggest, type Phase } from '../lib/progression';
import { workoutId } from '../lib/ids';
import { unlockAudio, requestNotifyPermission } from '../lib/audio';
import { acquireWakeLock, releaseWakeLock } from '../lib/wakeLock';
import { todayISO } from '../lib/format';
import { loadCatalog } from '../lib/exercises';
import type { Folder, Routine, Settings, Workout } from '../lib/types';
import { migrateLegacyRoutines } from '../lib/migrate';

export type Route =
  | { view: 'home' }
  | { view: 'train' }
  | { view: 'profile' }
  | { view: 'workout' }
  | { view: 'summary'; workoutId: string }
  | { view: 'workoutDetail'; id: string }
  | { view: 'progress' }
  | { view: 'library'; pickFor?: { routineId: string } }
  | { view: 'exercise'; id: string; from?: 'workout' }
  | { view: 'settings' }
  | { view: 'importExport' }
  | { view: 'routineEditor'; id: string };

export type AppUser = { uid: string; name: string | null };

export type ActiveSet = { weightKg: number | null; reps: number | null; done: boolean };
export type ActiveSession = {
  routineId: string;
  startTs: number;
  ex: { exerciseId: string; sets: ActiveSet[]; hintKey: string }[];
  /** Persisted so a running rest timer survives reloads and PWA eviction. */
  restUntil?: number | null;
  restExerciseId?: string | null;
  restTotalSec?: number | null;
};

const ACTIVE_KEY = 'overload_active';
const UID_KEY = 'overload_uid';

function readActive(): ActiveSession | null {
  try {
    const raw = JSON.parse(localStorage.getItem(ACTIVE_KEY) ?? 'null') as
      | (ActiveSession & { dayIndex?: number })
      | null;
    // Sessions persisted under the pre-folders model are discarded.
    if (raw && raw.dayIndex !== undefined) return null;
    return raw;
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

type ToastListener = (msg: string) => void;
let toastListener: ToastListener | null = null;
export function onToast(l: ToastListener): void {
  toastListener = l;
}
export function toast(msg: string): void {
  toastListener?.(msg);
}

// Store code has no hook context; screens register the translator at boot.
let translate: ((key: string) => string) | null = null;
export function registerTranslator(fn: (key: string) => string): void {
  translate = fn;
}
function i18nToast(key: string): string {
  return translate ? translate(key) : key;
}

let stopSync: (() => void) | null = null;


// Editor keystrokes save on every change; batch the remote writes per routine.
const routinePushTimers = new Map<string, ReturnType<typeof setTimeout>>();
function debouncedPushRoutine(uid: string, routineId: string): void {
  clearTimeout(routinePushTimers.get(routineId));
  routinePushTimers.set(
    routineId,
    setTimeout(() => {
      const rec = useStore.getState().routines.find((x) => x.id === routineId);
      if (rec) void pushRecord(uid, 'routines', rec);
    }, 600),
  );
}

export type Store = {
  route: Route;
  user: AppUser | null | undefined;
  settings: Settings;
  workouts: Workout[];
  routines: Routine[];
  folders: Folder[];
  syncState: SyncState;
  active: ActiveSession | null;
  restUntil: number | null;
  restExerciseId: string | null;
  restTotalSec: number | null;
  catalogReady: boolean;

  nav(route: Route): void;
  setUser(user: AppUser | null): void;
  init(): Promise<void>;
  reload(): Promise<void>;
  updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void>;
  phase(): Phase | null;

  startWorkout(routineId: string): void;
  updateSet(ei: number, si: number, patch: Partial<ActiveSet>): void;
  toggleDone(ei: number, si: number): void;
  addSet(ei: number): void;
  removeSet(ei: number): void;
  abandonWorkout(): void;
  finishWorkout(): Promise<Workout | null>;

  startRest(sec: number, exerciseId: string): void;
  stopRest(): void;

  saveRoutine(r: Routine): Promise<void>;
  deleteRoutine(id: string): Promise<void>;
  saveFolder(f: Folder): Promise<void>;
  deleteFolder(id: string): Promise<void>;
  addExerciseToRoutine(routineId: string, exerciseId: string): Promise<void>;
  deleteWorkout(id: string): Promise<void>;
  importWorkouts(fresh: Workout[]): Promise<void>;
};

const initialActive = readActive();

export const useStore = create<Store>((set, get) => ({
  route: { view: 'home' },
  user: undefined,
  settings: { id: 'settings', updatedAt: 0 },
  workouts: [],
  routines: [],
  folders: [],
  syncState: 'offline',
  active: initialActive,
  restUntil: initialActive?.restUntil && initialActive.restUntil > Date.now() ? initialActive.restUntil : null,
  restExerciseId: initialActive?.restExerciseId ?? null,
  restTotalSec: initialActive?.restTotalSec ?? null,
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
      // A different Google account on this device must never inherit (or
      // upload) the previous account's local data.
      let lastUid: string | null = null;
      try {
        lastUid = localStorage.getItem(UID_KEY);
        localStorage.setItem(UID_KEY, user.uid);
      } catch {
        /* storage unavailable */
      }
      const boot = async (): Promise<void> => {
        if (lastUid && lastUid !== user.uid) {
          persistActive(null);
          await Promise.all([db.workouts.clear(), db.routines.clear(), db.settings.clear()]);
          set({ workouts: [], routines: [], settings: { id: 'settings', updatedAt: 0 }, active: null });
        }
        stopSync?.();
        stopSync = startSync(
          user.uid,
          (s) => set({ syncState: s }),
          () => void get().reload(),
        );
      };
      void boot();
    }
    if (!user) {
      stopSync?.();
      stopSync = null;
    }
  },

  async init() {
    void loadCatalog().then(() => set({ catalogReady: true }));
    await migrateLegacyRoutines(get().user?.uid);
    await get().reload();
    if (get().active) set({ route: { view: 'workout' } });
  },

  async reload() {
    await migrateLegacyRoutines(get().user?.uid);
    const [workouts, routines, folders, settings] = await Promise.all([
      listWorkouts(),
      listRoutines(),
      listFolders(),
      getSettings(),
    ]);
    set({ workouts, routines, folders, settings });
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

  startWorkout(routineId) {
    const routine = get().routines.find((r) => r.id === routineId);
    if (!routine || routine.exercises.length === 0) return;
    unlockAudio();
    requestNotifyPermission();
    acquireWakeLock();
    const phase = get().phase();
    const history = get().workouts;
    const active: ActiveSession = {
      routineId,
      startTs: Date.now(),
      ex: routine.exercises.map((rx) => {
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
    const exerciseId = next.ex[ei].exerciseId;
    s.done = !s.done;
    // Resolve by exercise id, not position: the routine may have been
    // edited/reordered while this session was in progress.
    const routine = get().routines.find((r) => r.id === active.routineId);
    const rx = routine?.exercises.find((x) => x.exerciseId === exerciseId);
    if (s.done && s.reps == null) s.reps = rx?.repMin ?? null;
    persistActive(next);
    set({ active: next });
    if (s.done) get().startRest(rx?.restSec ?? 90, exerciseId);
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
    const date = todayISO();
    const dayLabel = routine?.name;
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
    if (doneSets.length === 0) {
      // Hevy behavior: an accidental session with nothing logged is discarded,
      // not recorded and not nagged about.
      persistActive(null);
      releaseWakeLock();
      set({ active: null, restUntil: null, restExerciseId: null, route: { view: 'home' } });
      toast(i18nToast('workout.discarded'));
      return null;
    }
    const flagged = flagPrs(doneSets, get().workouts, date);
    const workout: Workout = {
      id: workoutId('app', date, `${routine?.name ?? 'w'}-${active.startTs}`),
      routineId: active.routineId,
      ...(dayLabel ? { dayLabel } : {}),
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
    const restUntil = Date.now() + sec * 1000;
    set({ restUntil, restExerciseId: exerciseId, restTotalSec: sec });
    const active = get().active;
    if (active) persistActive({ ...active, restUntil, restExerciseId: exerciseId, restTotalSec: sec });
  },

  stopRest() {
    set({ restUntil: null, restExerciseId: null, restTotalSec: null });
    const active = get().active;
    if (active) persistActive({ ...active, restUntil: null, restExerciseId: null, restTotalSec: null });
  },

  async saveRoutine(r) {
    const next = { ...r, updatedAt: Date.now() };
    await saveRoutine(next);
    const list = get().routines;
    set({
      routines: list.some((x) => x.id === next.id)
        ? list.map((x) => (x.id === next.id ? next : x))
        : [...list, next],
    });
    const uid = get().user?.uid;
    if (uid) debouncedPushRoutine(uid, next.id);
  },

  async deleteRoutine(id) {
    await dbDeleteRoutine(id);
    set({ routines: get().routines.filter((r) => r.id !== id) });
    const uid = get().user?.uid;
    if (uid) void deleteRecord(uid, 'routines', id);
  },

  async saveFolder(f) {
    const next = { ...f, updatedAt: Date.now() };
    await saveFolder(next);
    const list = get().folders;
    set({
      folders: list.some((x) => x.id === next.id)
        ? list.map((x) => (x.id === next.id ? next : x))
        : [...list, next],
    });
    const uid = get().user?.uid;
    if (uid) void pushRecord(uid, 'folders', next);
  },

  async deleteFolder(id) {
    // Routines inside a deleted folder become ungrouped, never deleted.
    for (const r of get().routines.filter((x) => x.folderId === id)) {
      await get().saveRoutine({ ...r, folderId: undefined });
    }
    await dbDeleteFolder(id);
    set({ folders: get().folders.filter((f) => f.id !== id) });
    const uid = get().user?.uid;
    if (uid) void deleteRecord(uid, 'folders', id);
  },

  async addExerciseToRoutine(routineId, exerciseId) {
    const routine = get().routines.find((r) => r.id === routineId);
    if (!routine) return;
    const next = structuredClone(routine);
    next.exercises.push({ exerciseId, sets: 3, repMin: 8, repMax: 12, restSec: 90 });
    await get().saveRoutine(next);
  },

  async deleteWorkout(id) {
    await dbDeleteWorkout(id);
    set({ workouts: get().workouts.filter((w) => w.id !== id) });
    const uid = get().user?.uid;
    if (uid) void deleteRecord(uid, 'workouts', id);
  },

  async importWorkouts(fresh) {
    await dbApplyImport(fresh);
    await get().reload();
    const uid = get().user?.uid;
    if (uid) for (const w of fresh) void pushRecord(uid, 'workouts', w);
  },
}));
