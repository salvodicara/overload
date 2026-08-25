import type { ExerciseNote, Routine, Workout } from './types';

export type JournalEntry = {
  id: string;
  date: string;
  text: string;
};

export function routineTechniqueMigrations(
  routines: Routine[],
  notes: ExerciseNote[],
): ExerciseNote[] {
  const existingById = new Map(notes.map((note) => [note.id, note]));
  const legacyByExercise = new Map<string, string[]>();

  for (const routine of routines) {
    for (const exercise of routine.exercises) {
      const text = exercise.note?.trim();
      if (!text) continue;
      const collected = legacyByExercise.get(exercise.exerciseId) ?? [];
      if (!collected.includes(text)) collected.push(text);
      legacyByExercise.set(exercise.exerciseId, collected);
    }
  }

  const migrations: ExerciseNote[] = [];
  for (const [exerciseId, techniqueParts] of legacyByExercise) {
    const existing = existingById.get(exerciseId);
    if (existing?.technique?.trim()) continue;
    migrations.push({
      ...(existing ?? { id: exerciseId, entries: [], updatedAt: 0 }),
      technique: techniqueParts.join('\n\n'),
    });
  }
  return migrations;
}

export function exerciseJournal(
  workouts: Workout[],
  note: ExerciseNote | undefined,
  exerciseId: string,
): JournalEntry[] {
  const workoutEntries = workouts.flatMap((workout) =>
    (workout.exerciseNotes ?? [])
      .filter((entry) => entry.exerciseId === exerciseId)
      .map((entry) => ({
        id: `workout:${workout.id}`,
        date: workout.date,
        startTs: workout.startTs,
        text: entry.text,
      })),
  );
  workoutEntries.sort((a, b) =>
    a.date === b.date ? b.startTs - a.startTs : b.date.localeCompare(a.date),
  );

  const legacyEntries = (note?.entries ?? [])
    .map((entry, index) => ({
      id: `legacy:${entry.date}:${index}`,
      date: entry.date,
      text: entry.text,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  return [...workoutEntries.map(({ id, date, text }) => ({ id, date, text })), ...legacyEntries];
}
