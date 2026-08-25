import { describe, expect, it } from 'vitest';
import { canonicalWeight, displayVolume, displayWeight, formatWeight, weightLabel } from '../units';

describe('weight units', () => {
  it('keeps kg canonical', () => {
    expect(displayWeight(42.5, 'kg')).toBe(42.5);
    expect(canonicalWeight(42.5, 'kg')).toBe(42.5);
  });

  it('round-trips pounds without changing storage units', () => {
    const pounds = displayWeight(100, 'lb');
    expect(pounds).toBe(220.5);
    expect(canonicalWeight(pounds, 'lb')).toBeCloseTo(100, 1);
  });

  it('rounds canonical kg volumes to integers and converted lb volumes to one decimal', () => {
    expect(displayVolume(127.5, 'kg')).toBe(128);
    expect(displayVolume(-127.5, 'kg')).toBe(-127);
    expect(displayVolume(300, 'lb')).toBe(661.4);
  });

  it('formats one shared label and locale-aware value', () => {
    expect(weightLabel('lb')).toBe('lb');
    expect(formatWeight(20, 'kg', 'it')).toBe('20 kg');
  });
});
