import { create } from 'zustand';
import {
  applyImport as dbApplyImport,
  clearAllUserData,
  deleteFolder as dbDeleteFolder,
  deleteRoutine as dbDeleteRoutine,
  deleteMeasurement as dbDeleteMeasurement,
  deleteWorkout as dbDeleteWorkout,
  getSettings,
  listFolders,
  listRoutines,
  listMeasurements,
  listCustomExercises,
  listNotes,
  listNutrition,
  listWorkouts,
  restoreBackupCollections,
  saveFolder,
  saveCustomExercise,
  saveMeasurement,
  saveNote,
  saveNutrition,
  saveRoutine,
  saveSettings,
  saveWorkout,
} from '../lib/db';
import {
  deleteRecord,
  pushRecord,
  pushRecordStrict,
  startSync,
  type SyncController,
  type SyncState,
} from '../lib/sync';
import { computeVolume, flagPrs } from '../lib/volume';
import {
  buildActiveExercise,
  completedSets,
  normalizeActiveSession,
  type ActiveSession,
  type ActiveSet,
  type PersistedActiveSession,
} from '../lib/session';
import { workoutId } from '../lib/ids';
import { unlockAudio, requestNotifyPermission } from '../lib/audio';
import { acquireWakeLock, releaseWakeLock } from '../lib/wakeLock';
import { todayISO } from '../lib/format';
import { loadCatalog, registerCustomExercises } from '../lib/exercises';
import type { CustomExercise, ExerciseNote, Folder, MeasureMetric, Measurement, NutritionDay, Routine, Settings, Workout } from '../lib/types';
import { migrateLegacyRoutines } from '../lib/migrate';
import { routineTechniqueMigrations } from '../lib/notes';
import type { BackupV2 } from '../lib/importer';

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
  | { view: 'importExport' }
  | { view: 'routineEditor'; id: string };

export type AppUser = { uid: string; name: string | null };

export type { ActiveSession, ActiveSet };

export type AccountOwnerReceipt = Readonly<{ uid: string; generation: number }>;

export type AccountActionResult<T = void> =
  | { status: 'applied'; value: T; owner: AccountOwnerReceipt }
  | { status: 'stale' };

export const STALE_ACCOUNT_ACTION = Object.freeze({ status: 'stale' as const });

export function isStaleAccountAction(
  result: AccountActionResult<unknown>,
): result is typeof STALE_ACCOUNT_ACTION {
  return result.status === 'stale';
}

export function isAccountActionCurrent<T>(
  result: AccountActionResult<T>,
): result is Extract<AccountActionResult<T>, { status: 'applied' }> {
  return result.status === 'applied' && owns(result.owner);
}

export async function continueAccountAction<T>(
  action: Promise<AccountActionResult<T>>,
  onApplied: (value: T) => void | Promise<void>,
): Promise<AccountActionResult<T>> {
  const result = await action;
  if (!isAccountActionCurrent(result)) return STALE_ACCOUNT_ACTION;
  await onApplied(result.value);
  return result;
}

function appliedAccountAction<T>(owner: Owner, value: T): AccountActionResult<T> {
  return { status: 'applied', value, owner };
}

function accountActionForOwner<T>(owner: Owner, value: T): AccountActionResult<T> {
  return owns(owner) ? appliedAccountAction(owner, value) : STALE_ACCOUNT_ACTION;
}

export class BackupCloudSyncError extends Error {
  readonly cause: unknown;

  constructor(cause: unknown) {
    super('backup cloud sync failed');
    this.name = 'BackupCloudSyncError';
    this.cause = cause;
  }
}

const ACTIVE_KEY = 'overload_active';
const UID_KEY = 'overload_uid';

function readActive(): ActiveSession | null {
  try {
    const raw = JSON.parse(localStorage.getItem(ACTIVE_KEY) ?? 'null') as
      | (PersistedActiveSession & { dayIndex?: number })
      | null;
    // Sessions persisted under the pre-folders model are discarded.
    if (raw && raw.dayIndex !== undefined) return null;
    if (!raw) return null;
    const active = normalizeActiveSession(raw);
    if (JSON.stringify(active) !== JSON.stringify(raw)) persistActive(active);
    return active;
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

type AuthState = 'loading' | 'ready' | 'signedOut' | 'error';
type Owner = AccountOwnerReceipt;
type PendingBoot = {
  uid: string;
  generation: number;
  user: AppUser;
  promise: Promise<void>;
};

let authGeneration = 0;
let currentOwner: Owner | null = null;
let pendingBoot: PendingBoot | null = null;
let syncController: SyncController | null = null;
let localWriteTail: Promise<void> = Promise.resolve();

function withLocalWriteBarrier<T>(work: () => Promise<T>): Promise<T> {
  const run = localWriteTail.then(work, work);
  localWriteTail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function owns(owner: Owner): boolean {
  return (
    currentOwner?.uid === owner.uid &&
    currentOwner.generation === owner.generation &&
    authGeneration === owner.generation
  );
}

function generationIsCurrent(owner: Owner): boolean {
  return authGeneration === owner.generation;
}

function captureOwner(): Owner | null {
  return currentOwner ? { ...currentOwner } : null;
}

async function withOwnedLocalWrite<T>(
  owner: Owner,
  work: () => Promise<T>,
): Promise<AccountActionResult<T>> {
  return withLocalWriteBarrier(async () => {
    if (!owns(owner)) return STALE_ACCOUNT_ACTION;
    const value = await work();
    if (!owns(owner)) return STALE_ACCOUNT_ACTION;
    return appliedAccountAction(owner, value);
  });
}

// Tab-like views restore their scroll position when you come back (e.g. from
// an exercise's technique page straight back to where you were in the workout).
const scrollMemory = new Map<string, number>();
const RESTORE_SCROLL = new Set<Route['view']>(['home', 'train', 'library', 'progress', 'profile', 'workout']);
const ROUTE_KEY = 'overload_route';
const TAB_VIEWS = new Set<Route['view']>(['home', 'train', 'library', 'progress', 'profile']);

function applyScroll(view: Route['view']): void {
  const y = RESTORE_SCROLL.has(view) ? (scrollMemory.get(view) ?? 0) : 0;
  requestAnimationFrame(() => window.scrollTo(0, y));
}

function savedRoute(): Route {
  try {
    const v = localStorage.getItem(ROUTE_KEY) as Route['view'] | null;
    if (v && TAB_VIEWS.has(v)) return { view: v } as Route;
  } catch {
    /* storage unavailable */
  }
  return { view: 'home' };
}


// Editor keystrokes save on every change; batch the remote writes per routine.
const routinePushTimers = new Map<string, ReturnType<typeof setTimeout>>();
const techniqueSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
function clearRoutinePushTimers(): void {
  for (const timer of routinePushTimers.values()) clearTimeout(timer);
  routinePushTimers.clear();
}

function clearTechniqueSaveTimers(): void {
  for (const timer of techniqueSaveTimers.values()) clearTimeout(timer);
  techniqueSaveTimers.clear();
}

function debouncedPushRoutine(owner: Owner, routineId: string): void {
  clearTimeout(routinePushTimers.get(routineId));
  routinePushTimers.set(
    routineId,
    setTimeout(() => {
      if (!owns(owner)) return;
      const rec = useStore.getState().routines.find((x) => x.id === routineId);
      if (rec) void pushRecord(owner.uid, 'routines', rec);
    }, 600),
  );
}

export type Store = {
  route: Route;
  user: AppUser | null | undefined;
  authState: AuthState;
  settings: Settings;
  workouts: Workout[];
  routines: Routine[];
  folders: Folder[];
  notes: ExerciseNote[];
  measurements: Measurement[];
  nutrition: NutritionDay[];
  customExercises: CustomExercise[];
  syncState: SyncState;
  active: ActiveSession | null;
  restUntil: number | null;
  restExerciseId: string | null;
  restTotalSec: number | null;
  pendingRoutineChanges: { routineId: string; items: { exerciseId: string; restSec?: number; sets?: number }[] } | null;
  catalogReady: boolean;

  nav(route: Route): void;
  setUser(user: AppUser | null): void;
  init(): Promise<void>;
  reload(): Promise<void>;
  updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<AccountActionResult>;
  startWorkout(routineId: string): void;
  updateSet(ei: number, si: number, patch: Partial<ActiveSet>): void;
  updateSessionNote(ei: number, text: string): void;
  toggleSetKind(ei: number, si: number): void;
  toggleDone(ei: number, si: number): void;
  setRestOverride(ei: number, sec: number): void;
  addSet(ei: number): void;
  removeSet(ei: number): void;
  abandonWorkout(): void;
  finishWorkout(): Promise<AccountActionResult<Workout | null>>;
  applyRoutineChanges(): Promise<AccountActionResult>;
  dismissRoutineChanges(): void;

  startRest(sec: number, exerciseId: string): void;
  stopRest(): void;

  saveRoutine(r: Routine): Promise<AccountActionResult>;
  deleteRoutine(id: string): Promise<AccountActionResult>;
  saveFolder(f: Folder): Promise<AccountActionResult>;
  deleteFolder(id: string): Promise<AccountActionResult>;
  addExerciseToRoutine(routineId: string, exerciseId: string): Promise<AccountActionResult>;
  queueTechniqueNote(exerciseId: string, text: string): void;
  saveTechniqueNote(exerciseId: string, text: string): Promise<AccountActionResult>;
  addNoteEntry(exerciseId: string, text: string): Promise<AccountActionResult>;
  importNotes(incoming: ExerciseNote[]): Promise<AccountActionResult<number>>;
  createCustomExercise(name: string, muscleGroup: string): Promise<AccountActionResult<string>>;
  addMeasurement(metric: MeasureMetric, value: number, date: string): Promise<AccountActionResult>;
  deleteMeasurement(id: string): Promise<AccountActionResult>;
  saveNutritionDay(date: string, patch: Partial<Pick<NutritionDay, 'kcal' | 'proteinG'>>): Promise<AccountActionResult>;
  deleteWorkout(id: string): Promise<AccountActionResult>;
  importWorkouts(fresh: Workout[]): Promise<AccountActionResult>;
  restoreBackup(backup: BackupV2): Promise<AccountActionResult>;
};

type HydratedCollections = {
  workouts: Workout[];
  routines: Routine[];
  folders: Folder[];
  notes: ExerciseNote[];
  measurements: Measurement[];
  nutrition: NutritionDay[];
  customExercises: CustomExercise[];
  settings: Settings;
  techniqueMigrations: ExerciseNote[];
};

async function loadHydratedCollections(): Promise<HydratedCollections> {
  const [workouts, routines, folders, notes, measurements, nutrition, customExercises, settings] =
    await Promise.all([
      listWorkouts(),
      listRoutines(),
      listFolders(),
      listNotes(),
      listMeasurements(),
      listNutrition(),
      listCustomExercises(),
      getSettings(),
    ]);
  const techniqueMigrations = routineTechniqueMigrations(routines, notes);
  for (const migration of techniqueMigrations) await saveNote(migration);
  const migratedById = new Map(techniqueMigrations.map((note) => [note.id, note]));
  const mergedNotes = [
    ...notes.map((note) => migratedById.get(note.id) ?? note),
    ...techniqueMigrations.filter((note) => !notes.some((existing) => existing.id === note.id)),
  ];
  return {
    workouts,
    routines,
    folders,
    notes: mergedNotes,
    measurements,
    nutrition,
    customExercises,
    settings,
    techniqueMigrations,
  };
}

async function reloadForOwner(
  owner: Owner,
  set: (state: Partial<Store>) => void,
): Promise<void> {
  const hydrated = await withLocalWriteBarrier(async () => {
    if (!owns(owner)) return null;
    await migrateLegacyRoutines();
    if (!owns(owner)) return null;
    return loadHydratedCollections();
  });
  if (!hydrated || !owns(owner)) return;
  const { techniqueMigrations, ...collections } = hydrated;
  registerCustomExercises(collections.customExercises);
  set(collections);
  await pushTechniqueMigrations(owner, techniqueMigrations);
}

async function pushTechniqueMigrations(
  owner: Owner,
  migrations: ExerciseNote[],
): Promise<boolean> {
  for (const migration of migrations) {
    if (!owns(owner)) return false;
    await pushRecord(owner.uid, 'notes', migration);
  }
  return owns(owner);
}

const initialActive = readActive();

export const useStore = create<Store>((set, get) => ({
  route: savedRoute(),
  user: undefined,
  authState: 'loading',
  settings: { id: 'settings', updatedAt: 0 },
  workouts: [],
  routines: [],
  folders: [],
  notes: [],
  measurements: [],
  nutrition: [],
  customExercises: [],
  syncState: 'offline',
  active: initialActive,
  restUntil: initialActive?.restUntil && initialActive.restUntil > Date.now() ? initialActive.restUntil : null,
  restExerciseId: initialActive?.restExerciseId ?? null,
  restTotalSec: initialActive?.restTotalSec ?? null,
  pendingRoutineChanges: null,
  catalogReady: false,

  nav(route) {
    scrollMemory.set(get().route.view, window.scrollY);
    if (TAB_VIEWS.has(route.view)) {
      try {
        localStorage.setItem(ROUTE_KEY, route.view);
      } catch {
        /* storage unavailable */
      }
    }
    // Hardware/browser back works everywhere: detail screens stack on the
    // history, switching tabs replaces the entry (Android convention).
    const replace = TAB_VIEWS.has(route.view) && TAB_VIEWS.has(get().route.view);
    try {
      if (replace) history.replaceState({ route }, '');
      else history.pushState({ route }, '');
    } catch {
      /* history unavailable */
    }
    set({ route });
    applyScroll(route.view);
  },

  setUser(user) {
    if (user && pendingBoot?.uid === user.uid) {
      pendingBoot.user = user;
      return;
    }
    if (user && owns({ uid: user.uid, generation: currentOwner?.generation ?? -1 })) {
      set({ user });
      return;
    }
    if (!user && !pendingBoot && !currentOwner && get().authState === 'signedOut') return;

    const previousOwner = currentOwner;
    const previousSync = syncController;
    const generation = ++authGeneration;
    const owner: Owner | null = user ? { uid: user.uid, generation } : null;
    currentOwner = null;
    syncController = null;
    clearRoutinePushTimers();
    clearTechniqueSaveTimers();
    if (!user || previousOwner) releaseWakeLock();
    set({ user: undefined, authState: 'loading', syncState: 'offline' });

    const boot = async (): Promise<void> => {
      try {
        await previousSync?.stop();
        if (authGeneration !== generation) return;

        if (!user || !owner) {
          await withLocalWriteBarrier(async () => undefined);
          if (authGeneration !== generation) return;
          set({ user: null, authState: 'signedOut', syncState: 'offline' });
          return;
        }

        let storedUid: string | null = null;
        try {
          storedUid = localStorage.getItem(UID_KEY);
        } catch {
          /* storage unavailable */
        }
        const changedUid =
          (storedUid !== null && storedUid !== user.uid) ||
          (previousOwner !== null && previousOwner.uid !== user.uid);

        const hydrated = await withLocalWriteBarrier(async () => {
          if (!generationIsCurrent(owner)) return null;
          if (changedUid) await clearAllUserData();
          if (!generationIsCurrent(owner)) return null;
          await migrateLegacyRoutines();
          if (!generationIsCurrent(owner)) return null;
          return loadHydratedCollections();
        });
        if (!hydrated || !generationIsCurrent(owner)) return;

        if (changedUid) {
          persistActive(null);
          registerCustomExercises([]);
          set({
            active: null,
            restUntil: null,
            restExerciseId: null,
            restTotalSec: null,
            pendingRoutineChanges: null,
          });
        }
        try {
          localStorage.setItem(UID_KEY, user.uid);
        } catch {
          /* storage unavailable */
        }

        currentOwner = owner;
        const readyUser = pendingBoot?.generation === generation ? pendingBoot.user : user;
        const { techniqueMigrations, ...collections } = hydrated;
        registerCustomExercises(collections.customExercises);
        set({
          ...collections,
          user: readyUser,
          authState: 'ready',
          route: get().active ? { view: 'workout' } : get().route,
        });
        if (get().active) acquireWakeLock();
        void pushTechniqueMigrations(owner, techniqueMigrations);

        if (typeof window !== 'undefined') {
          void loadCatalog().then(() => {
            if (!owns(owner)) return;
            registerCustomExercises(get().customExercises);
            set({ catalogReady: true });
          });
        }

        if (import.meta.env.VITE_E2E !== '1' && owns(owner)) {
          syncController = startSync(
            owner.uid,
            (syncState) => {
              if (owns(owner)) set({ syncState });
            },
            async () => {
              if (owns(owner)) await reloadForOwner(owner, set);
            },
          );
        }
      } catch {
        if (authGeneration === generation) {
          currentOwner = null;
          set({ user: undefined, authState: 'error', syncState: 'offline' });
        }
      } finally {
        if (pendingBoot?.generation === generation) pendingBoot = null;
      }
    };
    const promise = boot();
    if (user) pendingBoot = { uid: user.uid, generation, user, promise };
    else pendingBoot = { uid: '', generation, user: { uid: '', name: null }, promise };
  },

  async init() {
    await pendingBoot?.promise;
  },

  async reload() {
    const owner = captureOwner();
    if (!owner) return;
    await reloadForOwner(owner, set);
  },

  async updateSettings(patch) {
    const owner = captureOwner();
    if (!owner) return STALE_ACCOUNT_ACTION;
    const result = await withOwnedLocalWrite(owner, () => saveSettings(patch));
    if (result.status === 'stale' || !owns(owner)) return STALE_ACCOUNT_ACTION;
    const settings = result.value;
    set({ settings });
    if (owns(owner)) await pushRecord(owner.uid, 'settings', settings);
    return accountActionForOwner(owner, undefined);
  },

  startWorkout(routineId) {
    const routine = get().routines.find((r) => r.id === routineId);
    if (!routine || routine.exercises.length === 0) return;
    unlockAudio();
    requestNotifyPermission();
    acquireWakeLock();
    const history = get().workouts;
    const active: ActiveSession = {
      routineId,
      startTs: Date.now(),
      ex: routine.exercises.map((rx) => buildActiveExercise(rx, history)),
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

  updateSessionNote(ei, text) {
    const active = get().active;
    if (!active) return;
    const next = structuredClone(active);
    next.ex[ei].sessionNote = text;
    persistActive(next);
    set({ active: next });
  },

  toggleSetKind(ei, si) {
    const active = get().active;
    if (!active) return;
    const next = structuredClone(active);
    const activeSet = next.ex[ei].sets[si];
    activeSet.kind = activeSet.kind === 'warmup' ? 'working' : 'warmup';
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
    if (s.done && next.ex[ei].tracking !== 'duration' && s.reps == null) {
      s.reps = rx?.repMin ?? null;
    }
    persistActive(next);
    set({ active: next });
    if (s.done) get().startRest(next.ex[ei].restOverride ?? rx?.restSec ?? 90, exerciseId);
  },

  setRestOverride(ei, sec) {
    const active = get().active;
    if (!active) return;
    const next = structuredClone(active);
    next.ex[ei].restOverride = sec;
    persistActive(next);
    set({ active: next });
  },

  addSet(ei) {
    const active = get().active;
    if (!active) return;
    const next = structuredClone(active);
    const exercise = next.ex[ei];
    const sets = exercise.sets;
    const last = sets[sets.length - 1];
    sets.push({
      weightKg: exercise.tracking === 'weight_reps' ? (last?.weightKg ?? null) : null,
      reps: exercise.tracking === 'reps' ? (last?.reps ?? null) : null,
      durationSec: exercise.tracking === 'duration' ? (last?.durationSec ?? null) : null,
      kind: 'working',
      done: false,
    });
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
    const owner = captureOwner();
    if (!owner) return STALE_ACCOUNT_ACTION;
    const active = get().active;
    if (!active) return appliedAccountAction(owner, null);
    const routine = get().routines.find((r) => r.id === active.routineId);
    const date = todayISO();
    const dayLabel = routine?.name;
    const doneSets = active.ex.flatMap(completedSets);
    if (doneSets.length === 0) {
      // Hevy behavior: an accidental session with nothing logged is discarded,
      // not recorded and not nagged about.
      persistActive(null);
      releaseWakeLock();
      set({ active: null, restUntil: null, restExerciseId: null, route: { view: 'home' } });
      toast(i18nToast('workout.discarded'));
      return appliedAccountAction(owner, null);
    }
    const flagged = flagPrs(doneSets, get().workouts, date);
    const exerciseNotes = active.ex.flatMap(({ exerciseId, sessionNote }) => {
      const text = sessionNote?.trim();
      return text ? [{ exerciseId, text }] : [];
    });
    const workout: Workout = {
      id: workoutId('app', date, `${routine?.name ?? 'w'}-${active.startTs}`),
      routineId: active.routineId,
      ...(dayLabel ? { dayLabel } : {}),
      date,
      startTs: active.startTs,
      endTs: Date.now(),
      sets: flagged,
      volumeKg: computeVolume(flagged),
      ...(exerciseNotes.length > 0 ? { exerciseNotes } : {}),
      updatedAt: Date.now(),
      source: 'app',
    };
    // Hevy behavior: session-local tweaks (rest, extra sets) can be persisted
    // to the routine afterwards; collect the diff before discarding the session.
    const items: { exerciseId: string; restSec?: number; sets?: number }[] = [];
    if (routine) {
      for (const e of active.ex) {
        const rx = routine.exercises.find((x) => x.exerciseId === e.exerciseId);
        if (!rx) continue;
        const change: { exerciseId: string; restSec?: number; sets?: number } = { exerciseId: e.exerciseId };
        if (e.restOverride !== undefined && e.restOverride !== rx.restSec) change.restSec = e.restOverride;
        const doneCount = e.sets.filter((set) => set.done && set.kind === 'working').length;
        if (doneCount > 0 && doneCount !== rx.sets) change.sets = doneCount;
        if (change.restSec !== undefined || change.sets !== undefined) items.push(change);
      }
    }
    const result = await withOwnedLocalWrite(owner, async () => {
      await saveWorkout(workout);
      return workout;
    });
    if (result.status === 'stale' || !owns(owner)) return STALE_ACCOUNT_ACTION;
    persistActive(null);
    releaseWakeLock();
    set({
      active: null,
      restUntil: null,
      restExerciseId: null,
      workouts: [workout, ...get().workouts],
      route: { view: 'summary', workoutId: workout.id },
      pendingRoutineChanges: routine && items.length > 0 ? { routineId: routine.id, items } : null,
    });
    if (owns(owner)) await pushRecord(owner.uid, 'workouts', workout);
    return accountActionForOwner(owner, workout);
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
    const owner = captureOwner();
    if (!owner) return STALE_ACCOUNT_ACTION;
    const next = { ...r, updatedAt: Date.now() };
    const result = await withOwnedLocalWrite(owner, async () => {
      await saveRoutine(next);
      return next;
    });
    if (result.status === 'stale' || !owns(owner)) return STALE_ACCOUNT_ACTION;
    const list = get().routines;
    set({
      routines: list.some((x) => x.id === next.id)
        ? list.map((x) => (x.id === next.id ? next : x))
        : [...list, next],
    });
    debouncedPushRoutine(owner, next.id);
    return appliedAccountAction(owner, undefined);
  },

  async deleteRoutine(id) {
    const owner = captureOwner();
    if (!owner) return STALE_ACCOUNT_ACTION;
    const result = await withOwnedLocalWrite(owner, async () => {
      await dbDeleteRoutine(id);
    });
    if (result.status === 'stale' || !owns(owner)) return STALE_ACCOUNT_ACTION;
    set({ routines: get().routines.filter((r) => r.id !== id) });
    if (owns(owner)) await deleteRecord(owner.uid, 'routines', id);
    return accountActionForOwner(owner, undefined);
  },

  async saveFolder(f) {
    const owner = captureOwner();
    if (!owner) return STALE_ACCOUNT_ACTION;
    const next = { ...f, updatedAt: Date.now() };
    const result = await withOwnedLocalWrite(owner, async () => {
      await saveFolder(next);
      return next;
    });
    if (result.status === 'stale' || !owns(owner)) return STALE_ACCOUNT_ACTION;
    const list = get().folders;
    set({
      folders: list.some((x) => x.id === next.id)
        ? list.map((x) => (x.id === next.id ? next : x))
        : [...list, next],
    });
    if (owns(owner)) await pushRecord(owner.uid, 'folders', next);
    return accountActionForOwner(owner, undefined);
  },

  async deleteFolder(id) {
    const owner = captureOwner();
    if (!owner) return STALE_ACCOUNT_ACTION;
    // Routines inside a deleted folder become ungrouped, never deleted.
    const moved = get().routines
      .filter((routine) => routine.folderId === id)
      .map((routine) => ({ ...routine, folderId: undefined, updatedAt: Date.now() }));
    const result = await withOwnedLocalWrite(owner, async () => {
      for (const routine of moved) await saveRoutine(routine);
      await dbDeleteFolder(id);
      return moved;
    });
    if (result.status === 'stale' || !owns(owner)) return STALE_ACCOUNT_ACTION;
    const movedById = new Map(moved.map((routine) => [routine.id, routine]));
    set({
      folders: get().folders.filter((folder) => folder.id !== id),
      routines: get().routines.map((routine) => movedById.get(routine.id) ?? routine),
    });
    for (const routine of moved) debouncedPushRoutine(owner, routine.id);
    if (owns(owner)) await deleteRecord(owner.uid, 'folders', id);
    return accountActionForOwner(owner, undefined);
  },

  async addNoteEntry(exerciseId, text) {
    const owner = captureOwner();
    if (!owner) return STALE_ACCOUNT_ACTION;
    const trimmed = text.trim();
    if (!trimmed) return appliedAccountAction(owner, undefined);
    const date = todayISO();
    const existing = get().notes.find((n) => n.id === exerciseId);
    const next: ExerciseNote = existing
      ? structuredClone(existing)
      : { id: exerciseId, entries: [], updatedAt: 0 };
    const today = next.entries.find((e) => e.date === date);
    // Same-day additions update today's entry; past entries are never touched.
    if (today) today.text = trimmed;
    else next.entries.push({ date, text: trimmed });
    next.updatedAt = Date.now();
    const result = await withOwnedLocalWrite(owner, async () => {
      await saveNote(next);
      return next;
    });
    if (result.status === 'stale' || !owns(owner)) return STALE_ACCOUNT_ACTION;
    set({ notes: [...get().notes.filter((n) => n.id !== exerciseId), next] });
    if (owns(owner)) await pushRecord(owner.uid, 'notes', next);
    return accountActionForOwner(owner, undefined);
  },

  async importNotes(incoming) {
    const owner = captureOwner();
    if (!owner) return STALE_ACCOUNT_ACTION;
    const base = get().notes;
    const result = await withOwnedLocalWrite(owner, async () => {
      const mergedNotes = [...base];
      const changedNotes: ExerciseNote[] = [];
      for (const inc of incoming) {
        const existing = mergedNotes.find((note) => note.id === inc.id);
        const next: ExerciseNote = existing
          ? structuredClone(existing)
          : { id: inc.id, entries: [], updatedAt: 0 };
        const have = new Set(next.entries.map((entry) => entry.date));
        let changed = false;
        for (const entry of inc.entries) {
          // Existing entries win: imports never overwrite what the user wrote.
          if (!have.has(entry.date)) {
            next.entries.push(entry);
            changed = true;
          }
        }
        if (!changed) continue;
        next.entries.sort((a, b) => a.date.localeCompare(b.date));
        next.updatedAt = Date.now();
        await saveNote(next);
        const index = mergedNotes.findIndex((note) => note.id === inc.id);
        if (index >= 0) mergedNotes[index] = next;
        else mergedNotes.push(next);
        changedNotes.push(next);
      }
      return { mergedNotes, changedNotes };
    });
    if (result.status === 'stale' || !owns(owner)) return STALE_ACCOUNT_ACTION;
    set({ notes: result.value.mergedNotes });
    for (const note of result.value.changedNotes) {
      if (!owns(owner)) return STALE_ACCOUNT_ACTION;
      await pushRecord(owner.uid, 'notes', note);
    }
    return accountActionForOwner(owner, result.value.changedNotes.length);
  },

  async createCustomExercise(name, muscleGroup) {
    const owner = captureOwner();
    if (!owner) return STALE_ACCOUNT_ACTION;
    const x: CustomExercise = {
      id: `custom:${crypto.randomUUID()}`,
      name: name.trim(),
      muscleGroup,
      updatedAt: Date.now(),
    };
    const result = await withOwnedLocalWrite(owner, async () => {
      await saveCustomExercise(x);
      return [...get().customExercises, x];
    });
    if (result.status === 'stale' || !owns(owner)) return STALE_ACCOUNT_ACTION;
    const next = result.value;
    registerCustomExercises(next);
    set({ customExercises: next });
    if (owns(owner)) await pushRecord(owner.uid, 'customExercises', x);
    return accountActionForOwner(owner, x.id);
  },

  async addMeasurement(metric, value, date) {
    const owner = captureOwner();
    if (!owner) return STALE_ACCOUNT_ACTION;
    const m: Measurement = { id: crypto.randomUUID(), date, metric, value, updatedAt: Date.now() };
    const result = await withOwnedLocalWrite(owner, async () => {
      await saveMeasurement(m);
      return m;
    });
    if (result.status === 'stale' || !owns(owner)) return STALE_ACCOUNT_ACTION;
    set({ measurements: [...get().measurements, m].sort((a, b) => a.date.localeCompare(b.date)) });
    if (owns(owner)) await pushRecord(owner.uid, 'measurements', m);
    return accountActionForOwner(owner, undefined);
  },

  async deleteMeasurement(id) {
    const owner = captureOwner();
    if (!owner) return STALE_ACCOUNT_ACTION;
    const result = await withOwnedLocalWrite(owner, async () => {
      await dbDeleteMeasurement(id);
    });
    if (result.status === 'stale' || !owns(owner)) return STALE_ACCOUNT_ACTION;
    set({ measurements: get().measurements.filter((m) => m.id !== id) });
    if (owns(owner)) await deleteRecord(owner.uid, 'measurements', id);
    return accountActionForOwner(owner, undefined);
  },

  async saveNutritionDay(date, patch) {
    const owner = captureOwner();
    if (!owner) return STALE_ACCOUNT_ACTION;
    const existing = get().nutrition.find((n) => n.id === date);
    const next: NutritionDay = {
      id: date,
      date,
      kcal: existing?.kcal ?? null,
      proteinG: existing?.proteinG ?? null,
      ...patch,
      updatedAt: Date.now(),
    };
    const result = await withOwnedLocalWrite(owner, async () => {
      await saveNutrition(next);
      return next;
    });
    if (result.status === 'stale' || !owns(owner)) return STALE_ACCOUNT_ACTION;
    set({ nutrition: [...get().nutrition.filter((n) => n.id !== date), next] });
    if (owns(owner)) await pushRecord(owner.uid, 'nutrition', next);
    return accountActionForOwner(owner, undefined);
  },

  async applyRoutineChanges() {
    const owner = captureOwner();
    if (!owner) return STALE_ACCOUNT_ACTION;
    const pending = get().pendingRoutineChanges;
    if (!pending) return appliedAccountAction(owner, undefined);
    const routine = get().routines.find((r) => r.id === pending.routineId);
    if (!routine) {
      set({ pendingRoutineChanges: null });
      return appliedAccountAction(owner, undefined);
    }
    const next = structuredClone(routine);
    for (const item of pending.items) {
      const rx = next.exercises.find((x) => x.exerciseId === item.exerciseId);
      if (!rx) continue;
      if (item.restSec !== undefined) rx.restSec = item.restSec;
      if (item.sets !== undefined) rx.sets = item.sets;
    }
    next.updatedAt = Date.now();
    const result = await withOwnedLocalWrite(owner, async () => {
      await saveRoutine(next);
      return next;
    });
    if (result.status === 'stale' || !owns(owner)) return STALE_ACCOUNT_ACTION;
    set({
      routines: get().routines.map((routine) => (routine.id === next.id ? next : routine)),
    });
    debouncedPushRoutine(owner, next.id);
    set({ pendingRoutineChanges: null });
    return appliedAccountAction(owner, undefined);
  },

  dismissRoutineChanges() {
    set({ pendingRoutineChanges: null });
  },

  async addExerciseToRoutine(routineId, exerciseId) {
    const owner = captureOwner();
    if (!owner) return STALE_ACCOUNT_ACTION;
    const routine = get().routines.find((r) => r.id === routineId);
    if (!routine) return appliedAccountAction(owner, undefined);
    const next = structuredClone(routine);
    next.exercises.push({ exerciseId, sets: 3, repMin: 8, repMax: 12, restSec: 90 });
    next.updatedAt = Date.now();
    const result = await withOwnedLocalWrite(owner, async () => {
      await saveRoutine(next);
      return next;
    });
    if (result.status === 'stale' || !owns(owner)) return STALE_ACCOUNT_ACTION;
    set({
      routines: get().routines.map((current) => (current.id === next.id ? next : current)),
    });
    debouncedPushRoutine(owner, next.id);
    return appliedAccountAction(owner, undefined);
  },

  async saveTechniqueNote(exerciseId, text) {
    const owner = captureOwner();
    if (!owner) return STALE_ACCOUNT_ACTION;
    const existing = get().notes.find((note) => note.id === exerciseId);
    const next: ExerciseNote = {
      ...(existing ?? { id: exerciseId, entries: [], updatedAt: 0 }),
      technique: text.trim(),
      updatedAt: Date.now(),
    };
    const result = await withOwnedLocalWrite(owner, async () => {
      await saveNote(next);
      return next;
    });
    if (result.status === 'stale' || !owns(owner)) return STALE_ACCOUNT_ACTION;
    set({ notes: [...get().notes.filter((note) => note.id !== exerciseId), next] });
    if (owns(owner)) await pushRecord(owner.uid, 'notes', next);
    return accountActionForOwner(owner, undefined);
  },

  queueTechniqueNote(exerciseId, text) {
    const owner = captureOwner();
    if (!owner) return;
    clearTimeout(techniqueSaveTimers.get(exerciseId));
    techniqueSaveTimers.set(
      exerciseId,
      setTimeout(() => {
        techniqueSaveTimers.delete(exerciseId);
        if (owns(owner)) void get().saveTechniqueNote(exerciseId, text);
      }, 500),
    );
  },

  async deleteWorkout(id) {
    const owner = captureOwner();
    if (!owner) return STALE_ACCOUNT_ACTION;
    const result = await withOwnedLocalWrite(owner, async () => {
      await dbDeleteWorkout(id);
    });
    if (result.status === 'stale' || !owns(owner)) return STALE_ACCOUNT_ACTION;
    set({ workouts: get().workouts.filter((w) => w.id !== id) });
    if (owns(owner)) await deleteRecord(owner.uid, 'workouts', id);
    return accountActionForOwner(owner, undefined);
  },

  async importWorkouts(fresh) {
    const owner = captureOwner();
    if (!owner) return STALE_ACCOUNT_ACTION;
    const result = await withOwnedLocalWrite(owner, async () => {
      await dbApplyImport(fresh);
      await migrateLegacyRoutines();
      return loadHydratedCollections();
    });
    if (result.status === 'stale' || !owns(owner)) return STALE_ACCOUNT_ACTION;
    const { techniqueMigrations, ...collections } = result.value;
    registerCustomExercises(collections.customExercises);
    set(collections);
    if (!(await pushTechniqueMigrations(owner, techniqueMigrations))) {
      return STALE_ACCOUNT_ACTION;
    }
    for (const workout of fresh) {
      if (!owns(owner)) return STALE_ACCOUNT_ACTION;
      await pushRecord(owner.uid, 'workouts', workout);
    }
    return accountActionForOwner(owner, undefined);
  },

  async restoreBackup(backup) {
    const owner = captureOwner();
    if (!owner) return STALE_ACCOUNT_ACTION;
    const result = await withOwnedLocalWrite(owner, async () => {
      await restoreBackupCollections(backup);
      await migrateLegacyRoutines();
      return loadHydratedCollections();
    });
    if (result.status === 'stale' || !owns(owner)) return STALE_ACCOUNT_ACTION;
    const { techniqueMigrations, ...collections } = result.value;
    registerCustomExercises(collections.customExercises);
    set(collections);
    const migrationById = new Map(techniqueMigrations.map((note) => [note.id, note]));
    const notesForCloud = [
      ...backup.notes.map((note) => migrationById.get(note.id) ?? note),
      ...techniqueMigrations.filter(
        (migration) => !backup.notes.some((note) => note.id === migration.id),
      ),
    ];
    try {
      for (const record of backup.workouts) {
        if (!owns(owner)) return STALE_ACCOUNT_ACTION;
        await pushRecordStrict(owner.uid, 'workouts', record);
      }
      for (const record of backup.routines) {
        if (!owns(owner)) return STALE_ACCOUNT_ACTION;
        await pushRecordStrict(owner.uid, 'routines', record);
      }
      for (const record of backup.folders) {
        if (!owns(owner)) return STALE_ACCOUNT_ACTION;
        await pushRecordStrict(owner.uid, 'folders', record);
      }
      for (const record of notesForCloud) {
        if (!owns(owner)) return STALE_ACCOUNT_ACTION;
        await pushRecordStrict(owner.uid, 'notes', record);
      }
      for (const record of backup.measurements) {
        if (!owns(owner)) return STALE_ACCOUNT_ACTION;
        await pushRecordStrict(owner.uid, 'measurements', record);
      }
      for (const record of backup.nutrition) {
        if (!owns(owner)) return STALE_ACCOUNT_ACTION;
        await pushRecordStrict(owner.uid, 'nutrition', record);
      }
      for (const record of backup.customExercises) {
        if (!owns(owner)) return STALE_ACCOUNT_ACTION;
        await pushRecordStrict(owner.uid, 'customExercises', record);
      }
      if (!owns(owner)) return STALE_ACCOUNT_ACTION;
      await pushRecordStrict(owner.uid, 'settings', backup.settings);
      return accountActionForOwner(owner, undefined);
    } catch (error) {
      if (!owns(owner)) return STALE_ACCOUNT_ACTION;
      throw new BackupCloudSyncError(error);
    }
  },
}));

if (typeof window !== 'undefined') {
  try {
    history.replaceState({ route: useStore.getState().route }, '');
  } catch {
    /* history unavailable */
  }
  window.addEventListener('popstate', (event) => {
    const route = (event.state as { route?: Route } | null)?.route ?? ({ view: 'home' } as Route);
    scrollMemory.set(useStore.getState().route.view, window.scrollY);
    useStore.setState({ route });
    applyScroll(route.view);
  });
}
