import { describe, expect, it } from 'vitest';
import { formatCompactNumber, formatPreviousSet } from '../format';
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

describe('formatCompactNumber', () => {
  it.each([
    [999, '999'],
    [999.99, '1K'],
    [100_000, '100K'],
    [999_999, '1M'],
    [1_250_000, '1,3M'],
    [-1_250_000, '−1,3M'],
    [1_000_000_000, '1B'],
  ])('formats %s without overflowing the metric', (value, expected) => {
    expect(formatCompactNumber(value, 'it-IT')).toBe(expected);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'uses a safe placeholder for %s',
    (value) => {
      expect(formatCompactNumber(value, 'it-IT')).toBe('—');
    },
  );
});
