import { deleteRoutine, listRoutines, saveFolder, saveRoutine } from './db';
import { slug } from './ids';
import { deleteRecord, pushRecord } from './sync';
import type { Folder, LegacyRoutine, Routine } from './types';

// One-way conversion from the retired multi-day routine container to the Hevy
// model (one routine = one workout, grouped by folder). Deterministic ids keep
// it idempotent across devices; once no legacy rows exist it is a no-op.
let running = false;

export async function migrateLegacyRoutines(uid: string | undefined): Promise<void> {
  if (running) return;
  running = true;
  try {
    const all = (await listRoutines()) as (Routine | LegacyRoutine)[];
    for (const r of all) {
      if (!('days' in r)) continue;
      const folder: Folder = { id: `${r.id}-folder`, name: r.name, updatedAt: Date.now() };
      await saveFolder(folder);
      if (uid) void pushRecord(uid, 'folders', folder);
      for (const day of r.days) {
        const split: Routine = {
          id: `${r.id}-${slug(day.label)}`,
          name: `${day.label} · ${day.name}`,
          folderId: folder.id,
          warmup: day.warmup,
          exercises: day.exercises,
          updatedAt: Date.now(),
        };
        await saveRoutine(split);
        if (uid) void pushRecord(uid, 'routines', split);
      }
      await deleteRoutine(r.id);
      if (uid) void deleteRecord(uid, 'routines', r.id);
    }
  } finally {
    running = false;
  }
}
