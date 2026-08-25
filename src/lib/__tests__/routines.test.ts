import { describe, expect, it } from 'vitest';
import { lastCompletedFor, nextRoutine } from '../routines';
import type { Folder, Routine, Workout } from '../types';

const program: Folder = { id: 'p', name: 'Program', updatedAt: 1 };
const makeRoutine = (id: string, folderId?: string): Routine => ({
  id, name: id, folderId, exercises: [], updatedAt: 1,
});
const a = makeRoutine('a', 'p');
const b = makeRoutine('b', 'p');
const ungroupedA = makeRoutine('u-a');
const ungroupedB = makeRoutine('u-b');
const done = (routineId: string, startTs: number): Workout => ({
  id: `w-${routineId}-${startTs}`, routineId, date: '2026-08-25', startTs,
  sets: [], volumeKg: 0, updatedAt: startTs, source: 'app',
});

describe('nextRoutine', () => {
  it('selects the first routine for a new program', () => {
    expect(nextRoutine([a, b], [program], [])?.id).toBe('a');
  });

  it('advances within the most recently used program and wraps', () => {
    expect(nextRoutine([a, b], [program], [done('a', 100)])?.id).toBe('b');
    expect(nextRoutine([a, b], [program], [done('b', 200)])?.id).toBe('a');
  });

  it('uses least recently performed when routines are ungrouped', () => {
    expect(nextRoutine([ungroupedA, ungroupedB], [], [done('u-a', 200)])?.id).toBe('u-b');
  });

  it('considers program routines in the fallback after an ungrouped workout', () => {
    expect(nextRoutine([ungroupedA, a, b], [program], [done('u-a', 200)])?.id).toBe('a');
  });

  it('sorts completion evidence by start timestamp rather than array position', () => {
    expect(nextRoutine([a, b], [program], [done('b', 200), done('a', 100)])?.id).toBe('a');
  });

  it('returns the latest completion for a routine', () => {
    expect(lastCompletedFor(a, [done('a', 100), done('a', 200)])?.startTs).toBe(200);
  });
});
