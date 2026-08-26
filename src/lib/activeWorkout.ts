import type { ActiveExercise, ActiveSession } from './session';

export function addActiveExercise(active: ActiveSession, exercise: ActiveExercise): ActiveSession {
  return { ...active, ex: [...active.ex, structuredClone(exercise)] };
}

export function removeActiveExercise(active: ActiveSession, instanceId: string): ActiveSession {
  return { ...active, ex: active.ex.filter((exercise) => exercise.instanceId !== instanceId) };
}

export function replaceActiveExercise(
  active: ActiveSession,
  instanceId: string,
  replacement: ActiveExercise,
): ActiveSession {
  return {
    ...active,
    ex: active.ex.map((exercise) =>
      exercise.instanceId === instanceId ? structuredClone(replacement) : exercise,
    ),
  };
}

export function moveActiveExercise(
  active: ActiveSession,
  instanceId: string,
  targetIndex: number,
): ActiveSession {
  const currentIndex = active.ex.findIndex((exercise) => exercise.instanceId === instanceId);
  if (currentIndex < 0) return active;
  const ex = [...active.ex];
  const [exercise] = ex.splice(currentIndex, 1);
  ex.splice(Math.max(0, Math.min(targetIndex, ex.length)), 0, exercise);
  return { ...active, ex };
}
