import { persistActiveSession } from '../lib/activePersistence';
import { create } from 'zustand';
import {
  applyImport as dbApplyImport,
  clearAllUserData,
  deleteFolderWithRoutines as dbDeleteFolderWithRoutines,
  deleteRoutine as dbDeleteRoutine,
  deleteMeasurement as dbDeleteMeasurement,
  deleteWorkout as dbDeleteWorkout,
  getSettings,
  mutateDiaryEntries,
  importDiaryDays as dbImportDiaryDays,
  importRoutinePlanRecords,
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
  validWorkoutSet,
  recomputeWorkoutFacts,
  routineFromWorkout,
  workoutFromDraft,
  type WorkoutDraft,
} from '../lib/workoutEditing';
import { routeMotion, transitionRoute } from '../lib/navigationMotion';
import {
  bindNavigationOwner,
  isNavigationOwnerCurrent,
  ensureHistoryEnvelope,
  newHistoryEnvelope,
  readEntryScroll,
  readHistoryEnvelope,
  writeEntryScroll,
} from '../lib/navigationState';
import { closeRestNotifications, unlockAudio, requestNotifyPermission } from '../lib/audio';
import type { NutritionPatch } from '../lib/nutrition';
import { acquireWakeLock, releaseWakeLock } from '../lib/wakeLock';
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
import { assertBackupRecords, type BackupV2 } from '../lib/importer';
import type { DiaryMutation, FoodEntry } from '../lib/foodDiary';
import { normalizeNutritionDay } from '../lib/nutrition';
import { materializeRoutinePlan, parseRoutinePlan, type RoutinePlan } from '../lib/routinePlan';

export type Route =
  | { view: 'home' }
  | { view: 'history'; mode?: 'list' | 'calendar' }
  | { view: 'train' }
  | { view: 'routineImport' }
  | { view: 'profile' }
  | { view: 'settings' }
  | { view: 'body' }
  | { view: 'diet' }
  | { view: 'foodAdd'; date: string; meal: import('../lib/foodDiary').FoodEntry['meal'] }
  | { view: 'foodEdit'; date: string; entryId: string }
  | { view: 'foodImport' }
  | { view: 'foodTotals'; date: string }
  | { view: 'workout' }
  | { view: 'summary'; workoutId: string }
  | { view: 'workoutDetail'; id: string }
  | { view: 'workoutEditor'; id: string }
  | { view: 'progress'; exerciseId?: string }
  | {
      view: 'library';
      pickFor?: { routineId: string } | { activeWorkout: true; replaceInstanceId?: string };
    }
  | { view: 'exercise'; id: string; from?: 'workout' | 'routine' }
  | { view: 'importExport' }
  | { view: 'routine'; id: string }
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
  persistActiveSession(a);
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

async function commitDiaryMutation(
  date: string,
  mutation: DiaryMutation,
): Promise<AccountActionResult<NutritionDay>> {
  const owner = captureOwner();
  if (!owner) return STALE_ACCOUNT_ACTION;
  const snapshot = structuredClone(mutation);
  const result = await withOwnedLocalWrite(owner, () => mutateDiaryEntries(date, snapshot));
  if (result.status === 'stale' || !owns(owner)) return STALE_ACCOUNT_ACTION;
  const day = result.value;
  useStore.setState((state) => ({
    nutrition: [...state.nutrition.filter((item) => item.id !== date), day],
  }));
  if (owns(owner)) await pushRecord(owner.uid, 'nutrition', day);
  return accountActionForOwner(owner, day);
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
  'settings',
  'body',
  'diet',
  'workout',
]);
const ROUTE_KEY = 'overload_route';
const TAB_VIEWS = new Set<Route['view']>(['home', 'train', 'profile']);

let activeEntryKey: string | undefined;
let pendingScroll: number | null = null;
function applyScroll(view: Route['view'], entryKey?: string): void {
  activeEntryKey = entryKey;
  pendingScroll = RESTORE_SCROLL.has(view) ? readEntryScroll(view, entryKey) : 0;
}

/** Restore after React commits the destination; a short outgoing page would clamp it. */
export function restoreRouteScroll(): void {
  if (pendingScroll === null || typeof window === 'undefined') return;
  const y = pendingScroll;
  pendingScroll = null;
  window.scrollTo(0, y);
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
  finishingWorkout: boolean;
  restUntil: number | null;
  restExerciseId: string | null;
  restTotalSec: number | null;
  pendingRoutineChanges: {
    workoutId?: string;
    baseUpdatedAt?: number;
    routineId: string;
    items: { exerciseId: string; exerciseIndex: number; restSec?: number; sets?: number }[];
    nextRoutine?: Routine;
  } | null;
  catalogReady: boolean;

  nav(route: Route): void;
  ensureCatalog(): Promise<void>;
  importRoutinePlan(
    plan: RoutinePlan,
  ): Promise<AccountActionResult<{ folderId: string; alreadyImported: boolean }>>;
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
  addWorkoutExercise(exerciseId: string, tracking?: TrackingType): void;
  replaceWorkoutExercise(instanceId: string, exerciseId: string, tracking?: TrackingType): void;
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
  saveNutritionDay(date: string, patch: NutritionPatch): Promise<AccountActionResult>;
  addDiaryEntries(date: string, entries: FoodEntry[]): Promise<AccountActionResult<NutritionDay>>;
  updateDiaryEntry(date: string, entry: FoodEntry): Promise<AccountActionResult<NutritionDay>>;
  deleteDiaryEntry(date: string, id: string): Promise<AccountActionResult<NutritionDay>>;
  importDiaryDays(days: { date: string; entries: FoodEntry[] }[]): Promise<AccountActionResult>;
  deleteWorkout(id: string): Promise<AccountActionResult>;
  updateWorkout(id: string, draft: WorkoutDraft): Promise<AccountActionResult>;
  repeatWorkout(id: string): Promise<AccountActionResult>;
  saveWorkoutAsRoutine(id: string, name: string, folderId?: string): Promise<AccountActionResult>;
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
  finishingWorkout: false,
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
    if (route.view === 'history' && route.mode) {
      nextEnvelope.surfaces = {
        ...nextEnvelope.surfaces,
        history: { ...nextEnvelope.surfaces?.history, mode: route.mode, selectedDay: null },
      };
    }
    if (route.view === 'progress' && route.exerciseId) {
      nextEnvelope.surfaces = {
        ...nextEnvelope.surfaces,
        progress: { ...nextEnvelope.surfaces?.progress, exerciseId: route.exerciseId },
      };
    }
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
    set({
      user: undefined,
      authState: 'loading',
      syncState: 'offline',
      catalogReady: false,
      finishingWorkout: false,
    });

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

        try {
          bindNavigationOwner(user.uid, changedUid);
        } catch {
          /* History unavailable. */
        }
        activeEntryKey = readHistoryEnvelope()?.entryKey;
        if (changedUid) {
          persistActive(null);
          registerCustomExercises([]);
          set({
            route: { view: 'home' },
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

  async importRoutinePlan(plan) {
    const owner = captureOwner();
    if (!owner) return STALE_ACCOUNT_ACTION;
    await get().ensureCatalog();
    if (!owns(owner)) return STALE_ACCOUNT_ACTION;
    // Validate again at the write boundary, including the current account's custom catalog.
    const validated = parseRoutinePlan(JSON.stringify(plan));
    const records = await materializeRoutinePlan(validated);
    const result = await withOwnedLocalWrite(owner, async () => {
      const imported = await importRoutinePlanRecords(records);
      return { ...imported, folders: await listFolders(), routines: await listRoutines() };
    });
    if (result.status === 'stale' || !owns(owner)) return STALE_ACCOUNT_ACTION;
    // Merge only additions: a concurrent editor may already hold newer optimistic values.
    set((state) => ({
      folders: [
        ...state.folders,
        ...result.value.folders.filter(
          (item) =>
            item.id === records.folder.id &&
            !state.folders.some((current) => current.id === item.id),
        ),
      ],
      routines: [
        ...state.routines,
        ...result.value.routines.filter(
          (item) =>
            records.routines.some((record) => record.id === item.id) &&
            !state.routines.some((current) => current.id === item.id),
        ),
      ],
    }));
    // Retry sync using durable records, never the original plan over later user edits.
    const folder = get().folders.find((item) => item.id === records.folder.id);
    if (folder && owns(owner)) await pushRecord(owner.uid, 'folders', folder);
    for (const routine of result.value.routines) {
      if (!owns(owner)) return STALE_ACCOUNT_ACTION;
      if (routine.folderId === records.folder.id) debouncedPushRoutine(owner, routine.id);
    }
    return accountActionForOwner(owner, {
      folderId: records.folder.id,
      alreadyImported: result.value.alreadyImported,
    });
  },

  startWorkout(routineId) {
    if (get().active) {
      set({ route: { view: 'workout' } });
      return;
    }
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
    if (get().finishingWorkout) return;
    const active = get().active;
    if (!active) return;
    const next = structuredClone(active);
    Object.assign(next.ex[ei].sets[si], patch, { edited: true });
    persistActive(next);
    set({ active: next });
  },

  updateSessionNote(ei, text) {
    if (get().finishingWorkout) return;
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
        exercise.occurrenceId === instanceId
          ? { ...exercise, note: text.trim() || undefined }
          : exercise,
      ),
    };
    return get().saveRoutine(next);
  },

  toggleSetKind(ei, si) {
    if (get().finishingWorkout) return;
    const active = get().active;
    if (!active) return;
    const next = structuredClone(active);
    const activeSet = next.ex[ei].sets[si];
    activeSet.kind = activeSet.kind === 'warmup' ? 'working' : 'warmup';
    persistActive(next);
    set({ active: next });
  },

  toggleDone(ei, si) {
    if (get().finishingWorkout) return;
    const active = get().active;
    if (!active) return;
    const next = structuredClone(active);
    const s = next.ex[ei].sets[si];
    const exerciseId = next.ex[ei].exerciseId;
    if (!s.done && next.ex[ei].tracking === 'weight_reps' && s.weightKg === null) {
      toast(i18nToast('workout.enterLoad'));
      return;
    }
    const routine = get().routines.find((r) => r.id === active.routineId);
    const exercise = next.ex[ei];
    const occurrences = routine ? normalizeRoutineOccurrences(routine).exercises : [];
    const rx = exercise.routineOccurrenceId
      ? occurrences.find((item) => item.occurrenceId === exercise.routineOccurrenceId)
      : occurrences.filter((item) => item.exerciseId === exerciseId).length === 1
        ? occurrences.find((item) => item.exerciseId === exerciseId)
        : undefined;
    if (!s.done) {
      const workingIndex =
        exercise.sets.slice(0, si + 1).filter((set) => set.kind === 'working').length - 1;
      if (exercise.tracking !== 'duration' && s.reps == null)
        s.reps = s.targetReps ?? rx?.setTargets?.[workingIndex]?.repMin ?? rx?.repMin ?? null;
      const valid =
        exercise.tracking === 'duration'
          ? s.durationSec !== null && Number.isFinite(s.durationSec) && s.durationSec > 0
          : s.reps !== null &&
            Number.isSafeInteger(s.reps) &&
            s.reps >= 0 &&
            (exercise.tracking === 'reps' ||
              (s.weightKg !== null && Number.isFinite(s.weightKg) && s.weightKg >= 0));
      if (!valid) {
        toast(i18nToast('workout.invalidSet'));
        return;
      }
    }
    s.done = !s.done;
    persistActive(next);
    set({ active: next });
    if (s.done)
      get().startRest(
        exercise.restOverride ?? exercise.prescribedRestSec ?? rx?.restSec ?? 90,
        exerciseId,
      );
  },

  setRestOverride(ei, sec) {
    if (get().finishingWorkout) return;
    const active = get().active;
    if (!active) return;
    const next = structuredClone(active);
    next.ex[ei].restOverride = sec;
    persistActive(next);
    set({ active: next });
  },

  addSet(ei) {
    if (get().finishingWorkout) return;
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
      targetReps: last?.targetReps ?? last?.reps ?? undefined,
      done: false,
    });
    persistActive(next);
    set({ active: next });
  },

  removeSet(ei) {
    if (get().finishingWorkout) return;
    const active = get().active;
    if (!active) return;
    const next = structuredClone(active);
    if (next.ex[ei].sets.length > 1) next.ex[ei].sets.pop();
    persistActive(next);
    set({ active: next });
  },

  addWorkoutExercise(exerciseId, tracking = 'weight_reps') {
    if (get().finishingWorkout) return;
    const active = get().active;
    if (!active) return;
    const instanceId = newOccurrenceId();
    const exercise = buildActiveExercise(
      {
        exerciseId,
        tracking,
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

  replaceWorkoutExercise(instanceId, exerciseId, tracking) {
    if (get().finishingWorkout) return;
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
        tracking: tracking ?? current.tracking,
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
    if (get().finishingWorkout) return;
    const active = get().active;
    if (!active || active.ex.length <= 1) return;
    const next = removeActiveExercise(active, instanceId);
    persistActive(next);
    set({ active: next });
  },

  moveWorkoutExercise(instanceId, targetIndex) {
    if (get().finishingWorkout) return;
    const active = get().active;
    if (!active) return;
    const next = moveActiveExercise(active, instanceId, targetIndex);
    persistActive(next);
    set({ active: next });
  },

  pauseWorkoutClock() {
    if (get().finishingWorkout) return;
    const active = get().active;
    if (!active) return;
    const next = pauseWorkout(active);
    persistActive(next);
    set({ active: next });
  },

  resumeWorkoutClock() {
    if (get().finishingWorkout) return;
    const active = get().active;
    if (!active) return;
    const next = resumeWorkout(active);
    persistActive(next);
    set({ active: next });
  },

  abandonWorkout() {
    if (get().finishingWorkout) return;
    persistActive(null);
    releaseWakeLock();
    set({ active: null, restUntil: null, restExerciseId: null, route: { view: 'home' } });
  },

  async finishWorkout() {
    const owner = captureOwner();
    if (!owner) return STALE_ACCOUNT_ACTION;
    if (get().finishingWorkout) return STALE_ACCOUNT_ACTION;
    const actionRoute = get().route;
    const active = get().active;
    if (!active) return appliedAccountAction(owner, null);
    set({ finishingWorkout: true });
    try {
      const routine = get().routines.find((r) => r.id === active.routineId);
      const date = new Date(active.startTs).toLocaleDateString('sv');
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
      if (
        doneSets.some((set) => !validWorkoutSet(set)) ||
        !Number.isFinite(computeVolume(doneSets))
      )
        throw new Error('workout.invalidSet');
      const flagged = flagPrs(doneSets, get().workouts, date, active.startTs);
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
      const sameSession = get().active?.startTs === active.startTs;
      if (sameSession) {
        persistActive(null);
        releaseWakeLock();
      }
      set({
        ...(sameSession
          ? { active: null, restUntil: null, restExerciseId: null, restTotalSec: null }
          : {}),
        workouts: [workout, ...get().workouts.filter((item) => item.id !== workout.id)],
        ...(sameSession && get().route === actionRoute
          ? { route: { view: 'summary' as const, workoutId: workout.id } }
          : {}),
        pendingRoutineChanges:
          routine && routineDiff && items.length > 0
            ? {
                workoutId: workout.id,
                baseUpdatedAt: routine.updatedAt,
                routineId: routine.id,
                items,
                nextRoutine: routineDiff.nextRoutine,
              }
            : null,
      });
      if (owns(owner)) await pushRecord(owner.uid, 'workouts', workout);
      return accountActionForOwner(owner, workout);
    } finally {
      if (owns(owner)) set({ finishingWorkout: false });
    }
  },

  startRest(sec, exerciseId) {
    if (!Number.isFinite(sec) || sec < 0) return;
    void closeRestNotifications();
    const timer = {
      restUntil: Date.now() + sec * 1000,
      restExerciseId: exerciseId,
      restTotalSec: sec,
    };
    const current = get().active;
    const active = current ? { ...current, ...timer } : null;
    set({ ...timer, ...(active ? { active } : {}) });
    if (active) persistActive(active);
  },

  stopRest() {
    void closeRestNotifications();
    const timer = { restUntil: null, restExerciseId: null, restTotalSec: null };
    const current = get().active;
    const active = current ? { ...current, ...timer } : null;
    set({ ...timer, ...(active ? { active } : {}) });
    if (active) persistActive(active);
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

  addDiaryEntries(date, entries) {
    return commitDiaryMutation(date, { kind: 'add', entries });
  },
  updateDiaryEntry(date, entry) {
    return commitDiaryMutation(date, { kind: 'update', entry });
  },
  deleteDiaryEntry(date, id) {
    return commitDiaryMutation(date, { kind: 'delete', id });
  },
  async importDiaryDays(days) {
    const owner = captureOwner();
    if (!owner) return STALE_ACCOUNT_ACTION;
    const snapshot = structuredClone(days);
    const result = await withOwnedLocalWrite(owner, () => dbImportDiaryDays(snapshot));
    if (result.status === 'stale' || !owns(owner)) return STALE_ACCOUNT_ACTION;
    set((state) => ({
      nutrition: [
        ...state.nutrition.filter((day) => !result.value.some((next) => next.id === day.id)),
        ...result.value,
      ],
    }));
    for (const day of result.value) {
      if (!owns(owner)) return STALE_ACCOUNT_ACTION;
      const current = get().nutrition.find((item) => item.id === day.id);
      if (current) await pushRecord(owner.uid, 'nutrition', current);
    }
    return accountActionForOwner(owner, undefined);
  },

  async saveNutritionDay(date, patch) {
    const owner = captureOwner();
    if (!owner) return STALE_ACCOUNT_ACTION;
    const result = await withOwnedLocalWrite(owner, () => saveNutrition(date, patch));
    if (result.status === 'stale' || !owns(owner)) return STALE_ACCOUNT_ACTION;
    const next = result.value;
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
    if (pending.baseUpdatedAt !== undefined && pending.baseUpdatedAt !== routine.updatedAt)
      throw new Error('summary.routineChanged');
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
      const current = (await listRoutines()).find((item) => item.id === pending.routineId);
      if (
        get().pendingRoutineChanges !== pending ||
        (pending.baseUpdatedAt !== undefined && current?.updatedAt !== pending.baseUpdatedAt)
      )
        throw new Error('summary.routineChanged');
      await saveRoutine(next);
      return next;
    });
    if (result.status === 'stale' || !owns(owner)) return STALE_ACCOUNT_ACTION;
    set({
      routines: get().routines.map((current) => (current === routine ? next : current)),
    });
    debouncedPushRoutine(owner, next.id);
    if (get().pendingRoutineChanges === pending) set({ pendingRoutineChanges: null });
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
      return listWorkouts();
    });
    if (result.status === 'stale' || !owns(owner)) return STALE_ACCOUNT_ACTION;
    const before = get().workouts;
    set({ workouts: result.value });
    if (owns(owner)) await deleteRecord(owner.uid, 'workouts', id);
    for (const workout of result.value) {
      if (!owns(owner)) return STALE_ACCOUNT_ACTION;
      if (before.find((item) => item.id === workout.id)?.updatedAt !== workout.updatedAt)
        await pushRecord(owner.uid, 'workouts', workout);
    }
    return accountActionForOwner(owner, undefined);
  },

  async updateWorkout(id, draft) {
    const owner = captureOwner();
    if (!owner) return STALE_ACCOUNT_ACTION;
    const snapshot = structuredClone(draft);
    const result = await withOwnedLocalWrite(owner, async () => {
      const current = await listWorkouts();
      const original = current.find((workout) => workout.id === id);
      if (!original) return current;
      const edited = workoutFromDraft(original, snapshot);
      const workouts = recomputeWorkoutFacts(
        current.map((workout) => (workout.id === id ? edited : workout)),
        Date.now(),
      );
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
    const actionRoute = get().route;
    const owner = captureOwner();
    if (!owner) return STALE_ACCOUNT_ACTION;
    const workout = get().workouts.find((item) => item.id === id);
    if (!workout) return appliedAccountAction(owner, undefined);
    const routine = routineFromWorkout(workout, workout.dayLabel ?? i18nToast('nav.workout'));
    const result = await get().saveRoutine(routine);
    if (!isAccountActionCurrent(result)) return result;
    if (get().route === actionRoute) get().startWorkout(routine.id);
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
    assertBackupRecords(backup);
    const owner = captureOwner();
    if (!owner) return STALE_ACCOUNT_ACTION;
    backup = { ...backup, nutrition: backup.nutrition.map(normalizeNutritionDay) };
    const result = await withOwnedLocalWrite(owner, async () => {
      await restoreBackupCollections(backup);
      await migrateLegacyRoutines();
      return loadHydratedCollections();
    });
    if (result.status === 'stale' || !owns(owner)) return STALE_ACCOUNT_ACTION;
    const collections = result.value;
    registerCustomExercises(collections.customExercises);
    set(collections);
    // Restore may supersede deletion markers; publish the actual committed revisions.
    backup = {
      ...backup,
      workouts: collections.workouts.filter((row) =>
        backup.workouts.some((item) => item.id === row.id),
      ),
      routines: collections.routines.filter((row) =>
        backup.routines.some((item) => item.id === row.id),
      ),
      folders: collections.folders.filter((row) =>
        backup.folders.some((item) => item.id === row.id),
      ),
      notes: collections.notes.filter((row) => backup.notes.some((item) => item.id === row.id)),
      measurements: collections.measurements.filter((row) =>
        backup.measurements.some((item) => item.id === row.id),
      ),
      nutrition: collections.nutrition.filter((row) =>
        backup.nutrition.some((item) => item.id === row.id),
      ),
      customExercises: collections.customExercises.filter((row) =>
        backup.customExercises.some((item) => item.id === row.id),
      ),
      settings: collections.settings,
    };
    try {
      for (const record of backup.workouts) {
        if (!owns(owner)) return STALE_ACCOUNT_ACTION;
        await pushRecordStrict(owner.uid, 'workouts', record, true);
      }
      for (const record of backup.routines) {
        if (!owns(owner)) return STALE_ACCOUNT_ACTION;
        await pushRecordStrict(owner.uid, 'routines', record, true);
      }
      for (const record of backup.folders) {
        if (!owns(owner)) return STALE_ACCOUNT_ACTION;
        await pushRecordStrict(owner.uid, 'folders', record, true);
      }
      for (const record of backup.notes) {
        if (!owns(owner)) return STALE_ACCOUNT_ACTION;
        await pushRecordStrict(owner.uid, 'notes', record, true);
      }
      for (const record of backup.measurements) {
        if (!owns(owner)) return STALE_ACCOUNT_ACTION;
        await pushRecordStrict(owner.uid, 'measurements', record, true);
      }
      for (const record of backup.nutrition) {
        if (!owns(owner)) return STALE_ACCOUNT_ACTION;
        await pushRecordStrict(owner.uid, 'nutrition', record, true);
      }
      for (const record of backup.customExercises) {
        if (!owns(owner)) return STALE_ACCOUNT_ACTION;
        await pushRecordStrict(owner.uid, 'customExercises', record, true);
      }
      if (!owns(owner)) return STALE_ACCOUNT_ACTION;
      await pushRecordStrict(owner.uid, 'settings', backup.settings, true);
      return accountActionForOwner(owner, undefined);
    } catch (error) {
      if (!owns(owner)) return STALE_ACCOUNT_ACTION;
      throw new BackupCloudSyncError(error);
    }
  },
}));

if (typeof window !== 'undefined') {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  try {
    history.replaceState(ensureHistoryEnvelope(useStore.getState().route, history.state), '');
    activeEntryKey = readHistoryEnvelope()?.entryKey;
  } catch {
    /* history unavailable */
  }
  window.addEventListener('popstate', (event) => {
    const route = isNavigationOwnerCurrent(event.state)
      ? ((event.state as { route?: Route } | null)?.route ?? ({ view: 'home' } as Route))
      : ({ view: 'home' } as Route);
    writeEntryScroll(useStore.getState().route.view, window.scrollY, activeEntryKey);
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
