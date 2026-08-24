import { db, getSettings, listFolders, listRoutines, listWorkouts } from './db';

/** Every synced record carries an id and a last-write timestamp (epoch ms). */
export type Synced = { id: string; updatedAt: number };

export type SyncState = 'synced' | 'pending' | 'offline' | 'error';

export type SyncCollection = 'workouts' | 'routines' | 'folders' | 'settings';

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
const sanitize = <T,>(rec: T): T => JSON.parse(JSON.stringify(rec)) as T;

async function syncAll(uid: string): Promise<{ pulled: number; pushFailures: number }> {
  const { getFirestore, collection, getDocs, setDoc, doc } = await import('firebase/firestore');
  const fs = getFirestore();
  let pulled = 0;
  let pushFailures = 0;

  const syncOne = async <T extends Synced>(
    name: SyncCollection,
    local: T[],
    writeLocal: (rows: T[]) => Promise<unknown>,
  ): Promise<void> => {
    const snapshot = await getDocs(collection(fs, 'users', uid, name));
    const remote = snapshot.docs.map((d) => d.data() as T);
    const { push, pull } = diffForSync(local, remote);

    if (pull.length > 0) {
      await writeLocal(pull);
      pulled += pull.length;
    }
    // One unwritable record must not block the rest of the queue.
    for (const record of push) {
      try {
        await setDoc(doc(fs, 'users', uid, name, record.id), sanitize(record));
      } catch (err) {
        pushFailures += 1;
        console.warn(`sync push failed: ${name}/${record.id}`, err);
      }
    }
  };

  const settings = await getSettings();
  await syncOne('workouts', await listWorkouts(), (rows) => db.workouts.bulkPut(rows));
  await syncOne('routines', await listRoutines(), (rows) => db.routines.bulkPut(rows));
  await syncOne('folders', await listFolders(), (rows) => db.folders.bulkPut(rows));
  // A never-saved settings record (updatedAt 0) has nothing worth pushing.
  await syncOne('settings', settings.updatedAt > 0 ? [settings] : [], (rows) =>
    db.settings.bulkPut(rows),
  );
  return { pulled, pushFailures };
}

/**
 * Starts LWW mirroring of the local Dexie tables against
 * `users/{uid}/{workouts|routines|settings}`. Runs once immediately, then again
 * whenever connectivity returns or the tab becomes visible. Returns an
 * unsubscribe that removes the listeners.
 */
export function startSync(
  uid: string,
  onState?: (s: SyncState) => void,
  onPulled?: () => void,
): () => void {
  const report = (s: SyncState): void => onState?.(s);

  const run = (): void => {
    if (isBrowser() && navigator.onLine === false) {
      report('offline');
      return;
    }
    report('pending');
    void syncAll(uid).then(
      ({ pulled, pushFailures }) => {
        report(pushFailures > 0 ? 'error' : 'synced');
        if (pulled > 0) onPulled?.();
      },
      () => report('error'),
    );
  };

  run();

  if (!isBrowser()) return () => {};

  const onVisible = (): void => {
    if (document.visibilityState === 'visible') run();
  };
  const onOffline = (): void => report('offline');

  window.addEventListener('online', run);
  window.addEventListener('offline', onOffline);
  document.addEventListener('visibilitychange', onVisible);

  return () => {
    window.removeEventListener('online', run);
    window.removeEventListener('offline', onOffline);
    document.removeEventListener('visibilitychange', onVisible);
  };
}

/**
 * Fire-and-forget push of a single record after a local write. Failures are
 * non-fatal: IndexedDB stays authoritative and the next `startSync` run
 * reconciles.
 */
export async function pushRecord(uid: string, col: SyncCollection, rec: Synced): Promise<void> {
  try {
    const { getFirestore, setDoc, doc } = await import('firebase/firestore');
    await setDoc(doc(getFirestore(), 'users', uid, col, rec.id), sanitize(rec));
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
