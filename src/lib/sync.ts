import {
  db,
  getSettings,
  listCustomExercises,
  listFolders,
  listMeasurements,
  listNotes,
  listNutrition,
  listRoutines,
  listWorkouts,
} from './db';

/** Every synced record carries an id and a last-write timestamp (epoch ms). */
export type Synced = { id: string; updatedAt: number };

export type SyncState = 'synced' | 'pending' | 'offline' | 'error';

export type SyncCollection =
  | 'workouts'
  | 'routines'
  | 'folders'
  | 'notes'
  | 'measurements'
  | 'nutrition'
  | 'customExercises'
  | 'settings';

/**
 * Last-write-wins diff between the local and remote copies of a collection.
 * Per id: present on one side only → goes to the other side; present on both →
 * the strictly newer `updatedAt` wins (equal timestamps are a no-op).
 */
export function diffForSync<T extends Synced>(local: T[], remote: T[]): { push: T[]; pull: T[] } {
  const remoteById = new Map(remote.map((r) => [r.id, r]));
  const localIds = new Set(local.map((l) => l.id));
  const push: T[] = [];
  const pull: T[] = [];

  for (const mine of local) {
    const theirs = remoteById.get(mine.id);
    if (!theirs) push.push(mine);
    else if (mine.updatedAt > theirs.updatedAt) push.push(mine);
    else if (theirs.updatedAt > mine.updatedAt) pull.push(theirs);
  }

  for (const theirs of remote) {
    if (!localIds.has(theirs.id)) pull.push(theirs);
  }

  return { push, pull };
}

// ---------------------------------------------------------------------------
// Firestore adapter — deliberately thin and free of logic worth unit-testing.
// `firebase/firestore` is imported dynamically so the pure module above (and
// its tests) never pull the SDK into the graph.
// ---------------------------------------------------------------------------

const isBrowser = (): boolean => typeof window !== 'undefined';

/** Firestore rejects `undefined` field values; strip them before writing. */
const sanitize = <T>(rec: T): T => JSON.parse(JSON.stringify(rec)) as T;

async function syncAll(
  uid: string,
  isActive: () => boolean,
  enterLocalWrite: (write: () => Promise<unknown>) => Promise<unknown>,
): Promise<{ pulled: number; pushFailures: number }> {
  const { getFirestore, collection, getDocs, setDoc, doc } = await import('firebase/firestore');
  if (!isActive()) return { pulled: 0, pushFailures: 0 };
  const fs = getFirestore();
  let pulled = 0;
  let pushFailures = 0;

  const syncOne = async <T extends Synced>(
    name: SyncCollection,
    readLocal: () => Promise<T[]>,
    writeLocal: (rows: T[]) => Promise<unknown>,
  ): Promise<void> => {
    if (!isActive()) return;
    const local = await readLocal();
    if (!isActive()) return;
    const snapshot = await getDocs(collection(fs, 'users', uid, name));
    if (!isActive()) return;
    const remote = snapshot.docs.map((d) => d.data() as T);
    const { push, pull } = diffForSync(local, remote);

    if (pull.length > 0) {
      if (!isActive()) return;
      await enterLocalWrite(() => writeLocal(pull));
      if (!isActive()) return;
      pulled += pull.length;
    }
    // One unwritable record must not block the rest of the queue.
    for (const record of push) {
      if (!isActive()) return;
      try {
        await setDoc(doc(fs, 'users', uid, name, record.id), sanitize(record));
        if (!isActive()) return;
      } catch (err) {
        if (!isActive()) return;
        pushFailures += 1;
        console.warn(`sync push failed: ${name}/${record.id}`, err);
      }
    }
  };

  await syncOne('workouts', listWorkouts, (rows) => db.workouts.bulkPut(rows));
  await syncOne('routines', listRoutines, (rows) => db.routines.bulkPut(rows));
  await syncOne('folders', listFolders, (rows) => db.folders.bulkPut(rows));
  await syncOne('notes', listNotes, (rows) => db.notes.bulkPut(rows));
  await syncOne('measurements', listMeasurements, (rows) => db.measurements.bulkPut(rows));
  await syncOne('nutrition', listNutrition, (rows) => db.nutrition.bulkPut(rows));
  await syncOne('customExercises', listCustomExercises, (rows) => db.customExercises.bulkPut(rows));
  // A never-saved settings record (updatedAt 0) has nothing worth pushing.
  await syncOne(
    'settings',
    async () => {
      const settings = await getSettings();
      return settings.updatedAt > 0 ? [settings] : [];
    },
    (rows) => db.settings.bulkPut(rows),
  );
  return { pulled, pushFailures };
}

export type SyncController = {
  stop(): Promise<void>;
};

/**
 * Starts LWW mirroring of the local Dexie tables against
 * `users/{uid}/{workouts|routines|settings}`. Runs once immediately, then again
 * whenever connectivity returns or the tab becomes visible. Returns an
 * unsubscribe that removes the listeners.
 */
export function startSync(
  uid: string,
  onState?: (s: SyncState) => void,
  onPulled?: () => void | Promise<void>,
): SyncController {
  let disposed = false;
  let rerunRequested = false;
  let inFlight: Promise<void> | null = null;
  const enteredLocalWrites = new Set<Promise<void>>();
  const isActive = (): boolean => !disposed;
  const report = (s: SyncState): void => {
    if (isActive()) onState?.(s);
  };
  const enterLocalWrite = (write: () => Promise<unknown>): Promise<unknown> => {
    if (!isActive()) return Promise.resolve();
    const operation = write();
    const settled = operation.then(
      () => undefined,
      () => undefined,
    );
    enteredLocalWrites.add(settled);
    void settled.then(() => enteredLocalWrites.delete(settled));
    return operation;
  };

  const runOnce = async (): Promise<void> => {
    if (!isActive()) return;
    if (isBrowser() && navigator.onLine === false) {
      report('offline');
      return;
    }
    report('pending');
    try {
      const { pulled, pushFailures } = await syncAll(uid, isActive, enterLocalWrite);
      if (!isActive()) return;
      report(pushFailures > 0 ? 'error' : 'synced');
      if (pulled > 0 && isActive()) await onPulled?.();
    } catch {
      report('error');
    }
  };

  const requestRun = (): void => {
    if (!isActive()) return;
    if (inFlight) {
      rerunRequested = true;
      return;
    }
    inFlight = (async () => {
      do {
        rerunRequested = false;
        await runOnce();
      } while (rerunRequested && isActive());
    })().finally(() => {
      inFlight = null;
    });
  };

  requestRun();

  const onVisible = (): void => {
    if (document.visibilityState === 'visible') requestRun();
  };
  const onOffline = (): void => report('offline');

  if (isBrowser()) {
    window.addEventListener('online', requestRun);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);
  }

  return {
    async stop(): Promise<void> {
      disposed = true;
      rerunRequested = false;
      if (isBrowser()) {
        window.removeEventListener('online', requestRun);
        window.removeEventListener('offline', onOffline);
        document.removeEventListener('visibilitychange', onVisible);
      }
      await Promise.all([...enteredLocalWrites]);
    },
  };
}

/**
 * Pushes one record and exposes Firebase/import failures to callers that need
 * confirmation that the remote write completed.
 */
export async function pushRecordStrict(
  uid: string,
  col: SyncCollection,
  rec: Synced,
): Promise<void> {
  const { getFirestore, setDoc, doc } = await import('firebase/firestore');
  await setDoc(doc(getFirestore(), 'users', uid, col, rec.id), sanitize(rec));
}

/**
 * Best-effort push after an ordinary local write. Failures are non-fatal:
 * IndexedDB stays authoritative and the next `startSync` run reconciles.
 */
export async function pushRecord(uid: string, col: SyncCollection, rec: Synced): Promise<void> {
  try {
    await pushRecordStrict(uid, col, rec);
  } catch {
    console.warn(`sync pending: ${col}/${rec.id}`);
  }
}

/** Fire-and-forget remote delete mirroring a local delete. */
export async function deleteRecord(uid: string, col: SyncCollection, id: string): Promise<void> {
  try {
    const { getFirestore, deleteDoc, doc } = await import('firebase/firestore');
    await deleteDoc(doc(getFirestore(), 'users', uid, col, id));
  } catch {
    console.warn(`remote delete pending: ${col}/${id}`);
  }
}
