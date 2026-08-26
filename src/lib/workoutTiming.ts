import type { ActiveSession } from './session';

export function elapsedWorkoutMs(active: ActiveSession, now = Date.now()): number {
  const effectiveNow = active.pausedAt ?? now;
  return Math.max(0, effectiveNow - active.startTs - (active.pausedTotalMs ?? 0));
}

export function pauseWorkout(active: ActiveSession, now = Date.now()): ActiveSession {
  return active.pausedAt ? active : { ...active, pausedAt: now };
}

export function resumeWorkout(active: ActiveSession, now = Date.now()): ActiveSession {
  if (!active.pausedAt) return active;
  return {
    ...active,
    pausedTotalMs: (active.pausedTotalMs ?? 0) + Math.max(0, now - active.pausedAt),
    pausedAt: undefined,
  };
}
