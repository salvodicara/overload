import type { ExerciseNote, Workout } from './types';

export type JournalEntry = {
  id: string;
  date: string;
  text: string;
};

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
