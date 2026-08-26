import { create } from 'zustand';
import {
  applyImport as dbApplyImport,
  clearAllUserData,
  deleteFolderWithRoutines as dbDeleteFolderWithRoutines,
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
  saveWorkouts,
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
  addActiveExercise,
  moveActiveExercise,
  removeActiveExercise,
  replaceActiveExercise,
} from '../lib/activeWorkout';
import {
  buildActiveExercise,
  completedSets,
  normalizeActiveSession,
  type ActiveSession,
  type ActiveSet,
  type PersistedActiveSession,
} from '../lib/session';
import { workoutId } from '../lib/ids';
import { elapsedWorkoutMs, pauseWorkout, resumeWorkout } from '../lib/workoutTiming';
import { newOccurrenceId, normalizeRoutineOccurrences } from '../lib/workoutOccurrences';
import { diffRoutineSession } from '../lib/routineDiff';
import {
  recomputeWorkoutFacts,
  routineFromWorkout,
  workoutFromDraft,
  type WorkoutDraft,
} from '../lib/workoutEditing';
import { routeMotion, transitionRoute } from '../lib/navigationMotion';
import {
  ensureHistoryEnvelope,
  newHistoryEnvelope,
  readEntryScroll,
  readHistoryEnvelope,
  writeEntryScroll,
} from '../lib/navigationState';
import { closeRestNotifications, unlockAudio, requestNotifyPermission } from '../lib/audio';
import { acquireWakeLock, releaseWakeLock } from '../lib/wakeLock';
import { todayISO } from '../lib/format';
import { loadCatalog, registerCustomExercises } from '../lib/exercises';
import type {
  CustomExercise,
  ExerciseNote,
  Folder,
  MeasureMetric,
  Measurement,
  NutritionDay,
  Routine,
  Settings,
  TrackingType,
  Workout,
} from '../lib/types';
import { migrateLegacyRoutines } from '../lib/migrate';
import type { BackupV2 } from '../lib/importer';

export type Route =
  | { view: 'home' }
  | { view: 'history' }
  | { view: 'train' }
  | { view: 'profile' }
  | { view: 'workout' }
  | { view: 'summary'; workoutId: string }
  | { view: 'workoutDetail'; id: string }
  | { view: 'workoutEditor'; id: string }
  | { view: 'progress'; exerciseId?: string }
  | {
      view: 'library';
      pickFor?: { routineId: string } | { activeWorkout: true; replaceInstanceId?: string };
    }
  | { view: 'exercise'; id: string; from?: 'workout' }
  | { view: 'importExport' }
  | { view: 'routineEditor'; id: string };

export type AppUser = { uid: string; name: string | null };

export type { ActiveSession, ActiveSet };

export type AccountOwnerReceipt = Readonly<{ uid: string; generation: number }>;

export type AccountActionResult<T = void> =
  { status: 'applied'; value: T; owner: AccountOwnerReceipt } | { status: 'stale' };

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
      (PersistedActiveSession & { dayIndex?: number }) | null;
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
const RESTORE_SCROLL = new Set<Route['view']>([
  'home',
  'history',
  'train',
  'library',
  'progress',
  'profile',
  'workout',
]);
const ROUTE_KEY = 'overload_route';
const TAB_VIEWS = new Set<Route['view']>(['home', 'train', 'library', 'progress', 'profile']);

function applyScroll(view: Route['view'], entryKey?: string): void {
  const y = RESTORE_SCROLL.has(view) ? readEntryScroll(view, entryKey) : 0;
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
function clearRoutinePushTimers(): void {
  for (const timer of routinePushTimers.values()) clearTimeout(timer);
  routinePushTimers.clear();
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

function cancelRoutinePush(routineId: string): void {
  clearTimeout(routinePushTimers.get(routineId));
  routinePushTimers.delete(routineId);
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
  pendingRoutineChanges: {
    routineId: string;
    items: { exerciseId: string; exerciseIndex: number; restSec?: number; sets?: number }[];
    nextRoutine?: Routine;
  } | null;
  catalogReady: boolean;

  nav(route: Route): void;
  ensureCatalog(): Promise<void>;
  setUser(user: AppUser | null): void;
  init(): Promise<void>;
  reload(): Promise<void>;
  updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<AccountActionResult>;
  startWorkout(routineId: string): void;
  updateSet(ei: number, si: number, patch: Partial<ActiveSet>): void;
  updateSessionNote(ei: number, text: string): void;
  updateRoutineTechnique(instanceId: string, text: string): Promise<AccountActionResult>;
  toggleSetKind(ei: number, si: number): void;
  toggleDone(ei: number, si: number): void;
  setRestOverride(ei: number, sec: number): void;
  addSet(ei: number): void;
  removeSet(ei: number): void;
  addWorkoutExercise(exerciseId: string): void;
  replaceWorkoutExercise(instanceId: string, exerciseId: string): void;
  removeWorkoutExercise(instanceId: string): void;
  moveWorkoutExercise(instanceId: string, targetIndex: number): void;
  pauseWorkoutClock(): void;
  resumeWorkoutClock(): void;
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
  addExerciseToRoutine(
    routineId: string,
    exerciseId: string,
    tracking?: TrackingType,
  ): Promise<AccountActionResult>;
  importNotes(incoming: ExerciseNote[]): Promise<AccountActionResult<number>>;
  createCustomExercise(name: string, muscleGroup: string): Promise<AccountActionResult<string>>;
  addMeasurement(metric: MeasureMetric, value: number, date: string): Promise<AccountActionResult>;
  deleteMeasurement(id: string): Promise<AccountActionResult>;
  saveNutritionDay(
    date: string,
    patch: Partial<Pick<NutritionDay, 'kcal' | 'proteinG'>>,
  ): Promise<AccountActionResult>;
  deleteWorkout(id: string): Promise<AccountActionResult>;
  updateWorkout(id: string, draft: WorkoutDraft): Promise<AccountActionResult>;
  repeatWorkout(id: string): Promise<AccountActionResult>;
  saveWorkoutAsRoutine(
    id: string,
    name: string,
    folderId?: string,
  ): Promise<AccountActionResult>;
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
  return {
    workouts,
    routines,
    folders,
    notes,
    measurements,
    nutrition,
    customExercises,
    settings,
  };
}

async function reloadForOwner(owner: Owner, set: (state: Partial<Store>) => void): Promise<void> {
  const snapshot = await withLocalWriteBarrier(async () => {
    if (!owns(owner)) return null;
    const routinesAtRead = useStore.getState().routines;
    await migrateLegacyRoutines();
    if (!owns(owner)) return null;
    return { hydrated: await loadHydratedCollections(), routinesAtRead };
  });
  if (!snapshot || !owns(owner)) return;
  const collections = snapshot.hydrated;
  registerCustomExercises(collections.customExercises);
  if (!owns(owner)) return;
  const routines =
    useStore.getState().routines === snapshot.routinesAtRead
      ? collections.routines
      : useStore.getState().routines;
  set({ ...collections, routines });
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
  restUntil:
    initialActive?.restUntil && initialActive.restUntil > Date.now()
      ? initialActive.restUntil
      : null,
  restExerciseId: initialActive?.restExerciseId ?? null,
  restTotalSec: initialActive?.restTotalSec ?? null,
  pendingRoutineChanges: null,
  catalogReady: false,

  nav(route) {
    const previous = get().route;
    const previousEnvelope = readHistoryEnvelope();
    writeEntryScroll(previous.view, window.scrollY, previousEnvelope?.entryKey);
    if (TAB_VIEWS.has(route.view)) {
      try {
        localStorage.setItem(ROUTE_KEY, route.view);
      } catch {
        /* storage unavailable */
      }
    }
    // Hardware/browser back works everywhere: detail screens stack on the
    // history, switching tabs replaces the entry (Android convention).
    const replace = TAB_VIEWS.has(route.view) && TAB_VIEWS.has(previous.view);
    const nextEnvelope = newHistoryEnvelope(route, previousEnvelope?.surfaces);
    try {
      if (replace) history.replaceState(nextEnvelope, '');
      else history.pushState(nextEnvelope, '');
    } catch {
      /* history unavailable */
    }
    transitionRoute(routeMotion(previous, route), () => {
      set({ route });
      applyScroll(route.view, nextEnvelope.entryKey);
    });
  },

  async ensureCatalog() {
    if (get().catalogReady) return;
    const owner = captureOwner();
    if (!owner) return;
    await loadCatalog();
    if (!owns(owner)) return;
    registerCustomExercises(get().customExercises);
    if (!owns(owner)) return;
    set({ catalogReady: true });
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
    registerCustomExercises([]);
    if (!user || previousOwner) releaseWakeLock();
    set({ user: undefined, authState: 'loading', syncState: 'offline', catalogReady: false });

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
        const collections = hydrated;
        registerCustomExercises(collections.customExercises);
        set({
          ...collections,
          user: readyUser,
          authState: 'ready',
          route: get().active ? { view: 'workout' } : get().route,
        });
        if (get().active) acquireWakeLock();
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
    const storedRoutine = get().routines.find((r) => r.id === routineId);
    const routine = storedRoutine ? normalizeRoutineOccurrences(storedRoutine) : undefined;
    if (!routine || routine.exercises.length === 0) return;
    unlockAudio();
    requestNotifyPermission();
    acquireWakeLock();
    const history = get().workouts;
    const active: ActiveSession = {
      routineId,
      startTs: Date.now(),
      ex: routine.exercises.map((rx) => buildActiveExercise(rx, history, routine.id)),
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

  async updateRoutineTechnique(instanceId, text) {
    const active = get().active;
    const routine = active && get().routines.find((item) => item.id === active.routineId);
    if (!active || !routine) return STALE_ACCOUNT_ACTION;
    const normalized = normalizeRoutineOccurrences(routine);
    const next: Routine = {
      ...normalized,
      exercises: normalized.exercises.map((exercise) =>
        exercise.occurrenceId === instanceId ? { ...exercise, note: text.trim() || undefined } : exercise,
      ),
    };
    return get().saveRoutine(next);
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
    if (!s.done && next.ex[ei].tracking === 'weight_reps' && s.weightKg === null) {
      toast(i18nToast('workout.enterLoad'));
      return;
    }
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

  addWorkoutExercise(exerciseId) {
    const active = get().active;
    if (!active) return;
    const instanceId = newOccurrenceId();
    const exercise = buildActiveExercise(
      {
        exerciseId,
        occurrenceId: instanceId,
        sets: 3,
        repMin: 8,
        repMax: 12,
        restSec: 90,
      },
      get().workouts,
      active.routineId,
    );
    exercise.routineOccurrenceId = undefined;
    const next = addActiveExercise(active, exercise);
    persistActive(next);
    set({ active: next, route: { view: 'workout' } });
  },

  replaceWorkoutExercise(instanceId, exerciseId) {
    const active = get().active;
    if (!active) return;
    const current = active.ex.find((exercise) => exercise.instanceId === instanceId);
    if (!current) return;
    const replacement = buildActiveExercise(
      {
        exerciseId,
        occurrenceId: newOccurrenceId(),
        sets: Math.max(1, current.sets.filter((set) => set.kind === 'working').length),
        repMin: 8,
        repMax: 12,
        restSec: current.restOverride ?? 90,
        tracking: current.tracking,
      },
      get().workouts,
      active.routineId,
    );
    replacement.routineOccurrenceId = undefined;
    const next = replaceActiveExercise(active, instanceId, replacement);
    persistActive(next);
    set({ active: next, route: { view: 'workout' } });
  },

  removeWorkoutExercise(instanceId) {
    const active = get().active;
    if (!active || active.ex.length <= 1) return;
    const next = removeActiveExercise(active, instanceId);
    persistActive(next);
    set({ active: next });
  },

  moveWorkoutExercise(instanceId, targetIndex) {
    const active = get().active;
    if (!active) return;
    const next = moveActiveExercise(active, instanceId, targetIndex);
    persistActive(next);
    set({ active: next });
  },

  pauseWorkoutClock() {
    const active = get().active;
    if (!active) return;
    const next = pauseWorkout(active);
    persistActive(next);
    set({ active: next });
  },

  resumeWorkoutClock() {
    const active = get().active;
    if (!active) return;
    const next = resumeWorkout(active);
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
    const exerciseNotes = active.ex.flatMap(({ exerciseId, instanceId, sessionNote }) => {
      const text = sessionNote?.trim();
      return text ? [{ exerciseId, exerciseInstanceId: instanceId, text }] : [];
    });
    const workout: Workout = {
      id: workoutId('app', date, `${routine?.name ?? 'w'}-${active.startTs}`),
      routineId: active.routineId,
      ...(dayLabel ? { dayLabel } : {}),
      date,
      startTs: active.startTs,
      endTs: Date.now(),
      durationSec: Math.round(elapsedWorkoutMs(active) / 1000),
      sets: flagged,
      exerciseOrder: active.ex.map(
        (exercise, index) =>
          exercise.instanceId ?? `legacy:${active.routineId}:${index}:${exercise.exerciseId}`,
      ),
      volumeKg: computeVolume(flagged),
      ...(exerciseNotes.length > 0 ? { exerciseNotes } : {}),
      updatedAt: Date.now(),
      source: 'app',
    };
    const routineDiff = routine ? diffRoutineSession(routine, active) : null;
    const items = (routineDiff?.changes ?? []).map((_, exerciseIndex) => ({
      exerciseId: active.ex[Math.min(exerciseIndex, active.ex.length - 1)]?.exerciseId ?? '',
      exerciseIndex,
    }));
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
      pendingRoutineChanges:
        routine && routineDiff && items.length > 0
          ? { routineId: routine.id, items, nextRoutine: routineDiff.nextRoutine }
          : null,
    });
    if (owns(owner)) await pushRecord(owner.uid, 'workouts', workout);
    return accountActionForOwner(owner, workout);
  },

  startRest(sec, exerciseId) {
    void closeRestNotifications();
    const restUntil = Date.now() + sec * 1000;
    set({ restUntil, restExerciseId: exerciseId, restTotalSec: sec });
    const active = get().active;
    if (active)
      persistActive({ ...active, restUntil, restExerciseId: exerciseId, restTotalSec: sec });
  },

  stopRest() {
    void closeRestNotifications();
    set({ restUntil: null, restExerciseId: null, restTotalSec: null });
    const active = get().active;
    if (active)
      persistActive({ ...active, restUntil: null, restExerciseId: null, restTotalSec: null });
  },

  async saveRoutine(r) {
    const owner = captureOwner();
    if (!owner) return STALE_ACCOUNT_ACTION;
    const next = { ...r, updatedAt: Date.now() };
    const list = get().routines;
    set({
      routines: list.some((x) => x.id === next.id)
        ? list.map((x) => (x.id === next.id ? next : x))
        : [...list, next],
    });
    try {
      const result = await withOwnedLocalWrite(owner, async () => {
        await saveRoutine(next);
        return next;
      });
      if (result.status === 'stale' || !owns(owner)) return STALE_ACCOUNT_ACTION;
      debouncedPushRoutine(owner, next.id);
      return appliedAccountAction(owner, undefined);
    } catch (error) {
      // A newer save (or another account) is authoritative; otherwise restore durable state.
      if (owns(owner) && get().routines.find((routine) => routine.id === next.id) === next) {
        const durable = (await listRoutines()).find((routine) => routine.id === next.id);
        if (owns(owner) && get().routines.find((routine) => routine.id === next.id) === next) {
          set({
            routines: durable
              ? get().routines.map((routine) => (routine.id === next.id ? durable : routine))
              : get().routines.filter((routine) => routine.id !== next.id),
          });
        }
      }
      throw error;
    }
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
    const routineIds = get()
      .routines.filter((routine) => routine.folderId === id)
      .map((routine) => routine.id);
    const deletedIds = new Set(routineIds);
    const result = await withOwnedLocalWrite(owner, async () => {
      await dbDeleteFolderWithRoutines(id, routineIds);
      return routineIds;
    });
    if (result.status === 'stale' || !owns(owner)) return STALE_ACCOUNT_ACTION;
    for (const routineId of routineIds) cancelRoutinePush(routineId);
    set({
      folders: get().folders.filter((folder) => folder.id !== id),
      routines: get().routines.filter((routine) => !deletedIds.has(routine.id)),
    });
    for (const routineId of routineIds) {
      if (!owns(owner)) return STALE_ACCOUNT_ACTION;
      await deleteRecord(owner.uid, 'routines', routineId);
    }
    if (owns(owner)) await deleteRecord(owner.uid, 'folders', id);
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
    const next = pending.nextRoutine
      ? structuredClone(pending.nextRoutine)
      : structuredClone(routine);
    if (!pending.nextRoutine) {
      for (const item of pending.items) {
        const rx = next.exercises[item.exerciseIndex];
        if (!rx || rx.exerciseId !== item.exerciseId) continue;
        if (item.restSec !== undefined) rx.restSec = item.restSec;
        if (item.sets !== undefined) rx.sets = item.sets;
      }
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

  async addExerciseToRoutine(routineId, exerciseId, tracking = 'weight_reps') {
    const owner = captureOwner();
    if (!owner) return STALE_ACCOUNT_ACTION;
    const routine = get().routines.find((r) => r.id === routineId);
    if (!routine) return appliedAccountAction(owner, undefined);
    const next = structuredClone(routine);
    next.exercises.push({
      exerciseId,
      sets: 3,
      repMin: 8,
      repMax: 12,
      restSec: 90,
      tracking,
    });
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

  async updateWorkout(id, draft) {
    const owner = captureOwner();
    if (!owner) return STALE_ACCOUNT_ACTION;
    const original = get().workouts.find((workout) => workout.id === id);
    if (!original) return appliedAccountAction(owner, undefined);
    const edited = workoutFromDraft(original, draft);
    const workouts = recomputeWorkoutFacts(
      get().workouts.map((workout) => (workout.id === id ? edited : workout)),
    );
    const result = await withOwnedLocalWrite(owner, async () => {
      await saveWorkouts(workouts);
      return workouts;
    });
    if (result.status === 'stale' || !owns(owner)) return STALE_ACCOUNT_ACTION;
    set({ workouts: result.value });
    for (const workout of result.value) {
      if (!owns(owner)) return STALE_ACCOUNT_ACTION;
      await pushRecord(owner.uid, 'workouts', workout);
    }
    return accountActionForOwner(owner, undefined);
  },

  async saveWorkoutAsRoutine(id, name, folderId) {
    const owner = captureOwner();
    if (!owner) return STALE_ACCOUNT_ACTION;
    const workout = get().workouts.find((item) => item.id === id);
    if (!workout) return appliedAccountAction(owner, undefined);
    const result = await get().saveRoutine(routineFromWorkout(workout, name, folderId));
    return isAccountActionCurrent(result) ? accountActionForOwner(owner, undefined) : result;
  },

  async repeatWorkout(id) {
    const owner = captureOwner();
    if (!owner) return STALE_ACCOUNT_ACTION;
    const workout = get().workouts.find((item) => item.id === id);
    if (!workout) return appliedAccountAction(owner, undefined);
    const routine = routineFromWorkout(workout, workout.dayLabel ?? i18nToast('nav.workout'));
    const result = await get().saveRoutine(routine);
    if (!isAccountActionCurrent(result)) return result;
    get().startWorkout(routine.id);
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
    const collections = result.value;
    registerCustomExercises(collections.customExercises);
    set(collections);
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
    const collections = result.value;
    registerCustomExercises(collections.customExercises);
    set(collections);
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
      for (const record of backup.notes) {
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
    history.replaceState(
      ensureHistoryEnvelope(useStore.getState().route, history.state),
      '',
    );
  } catch {
    /* history unavailable */
  }
  window.addEventListener('popstate', (event) => {
    const route = (event.state as { route?: Route } | null)?.route ?? ({ view: 'home' } as Route);
    const currentEnvelope = readHistoryEnvelope();
    writeEntryScroll(
      useStore.getState().route.view,
      window.scrollY,
      currentEnvelope?.entryKey,
    );
    const targetEnvelope = ensureHistoryEnvelope(route, event.state);
    transitionRoute('back', () => {
      try {
        history.replaceState(targetEnvelope, '');
      } catch {
        /* history unavailable */
      }
      useStore.setState({ route });
      applyScroll(route.view, targetEnvelope.entryKey);
    });
  });
}
