import { describe, expect, it } from 'vitest';
import { formatPreviousSet } from '../format';
import type { SetLog, TrackingType } from '../types';

const set = (patch: Partial<SetLog> = {}): SetLog => ({
  exerciseId: 'bench',
  weightKg: 40,
  reps: 8,
  done: true,
  ...patch,
});

describe('formatPreviousSet', () => {
  it.each<[TrackingType, SetLog, string]>([
    ['weight_reps', set(), '88.2 lb × 8'],
    ['reps', set({ weightKg: 0, reps: 12, tracking: 'reps' }), '12'],
    ['duration', set({ weightKg: 0, reps: 0, durationSec: 35, tracking: 'duration' }), '35s'],
  ])('formats %s history for the active row', (tracking, previous, expected) => {
    expect(formatPreviousSet(previous, tracking, 'lb')).toBe(expected);
  });

  it('treats a missing historical tracking field as weighted legacy data', () => {
    expect(formatPreviousSet(set({ tracking: undefined }), undefined, 'kg')).toBe('40 kg × 8');
  });

  it('omits the repeated unit inside a table whose weight column already names it', () => {
    expect(formatPreviousSet(set(), 'weight_reps', 'lb', false)).toBe('88.2 × 8');
  });
});
