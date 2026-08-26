import { describe, expect, it } from 'vitest';
import { weekDays } from '../../screens/Home';

describe('weekDays', () => {
  it('uses the selected app locale instead of the browser locale', () => {
    const date = new Date('2026-08-26T12:00:00Z');

    expect(weekDays(date, 'it').map((day) => day.label)).toEqual([
      'LU',
      'MA',
      'ME',
      'GI',
      'VE',
      'SA',
      'DO',
    ]);
    expect(weekDays(date, 'en').map((day) => day.label)).toEqual([
      'MO',
      'TU',
      'WE',
      'TH',
      'FR',
      'SA',
      'SU',
    ]);
  });
});
