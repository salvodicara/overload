import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ensureHistoryEnvelope,
  newHistoryEnvelope,
  readEntryScroll,
  readHistoryEnvelope,
  replaceSurfaceState,
  surfaceStateFor,
  writeEntryScroll,
} from '../navigationState';

describe('navigation entry state', () => {
  beforeEach(() => {
    const fakeHistory = {
      state: null as unknown,
      replaceState(state: unknown) {
        this.state = state;
      },
    };
    vi.stubGlobal('history', fakeHistory);
    history.replaceState({ route: { view: 'home' }, entryKey: 'entry-a' }, '');
  });

  it('preserves route identity while replacing one surface snapshot', () => {
    replaceSurfaceState('home', {
      periodUnit: 'month',
      periodAnchor: '2026-05-01',
      chartMetric: 'durationMin',
      selectedDay: '2026-05-20',
    });

    expect(readHistoryEnvelope()).toEqual({
      route: { view: 'home' },
      entryKey: 'entry-a',
      surfaces: {
        home: {
          periodUnit: 'month',
          periodAnchor: '2026-05-01',
          chartMetric: 'durationMin',
          selectedDay: '2026-05-20',
        },
      },
    });
    expect(surfaceStateFor('home')).toEqual({
      periodUnit: 'month',
      periodAnchor: '2026-05-01',
      chartMetric: 'durationMin',
      selectedDay: '2026-05-20',
    });
  });

  it('keeps scroll independent for two entries of the same surface', () => {
    writeEntryScroll('home', 420, 'entry-a');
    writeEntryScroll('home', 20, 'entry-b');

    expect(readEntryScroll('home', 'entry-a')).toBe(420);
    expect(readEntryScroll('home', 'entry-b')).toBe(20);
  });

  it('ignores malformed surface state instead of crashing navigation', () => {
    history.replaceState(
      {
        route: { view: 'home' },
        entryKey: 'entry-a',
        surfaces: { home: 'not-an-object' },
      },
      '',
    );

    expect(surfaceStateFor('home')).toEqual({});
  });

  it('keeps a restored Home snapshot when the app initializes its route', () => {
    const existing = {
      route: { view: 'home' } as const,
      entryKey: 'entry-a',
      surfaces: { home: { periodUnit: 'year' as const, periodAnchor: '2024-01-01' } },
    };

    expect(ensureHistoryEnvelope({ view: 'home' }, existing)).toEqual(existing);
  });

  it('creates a distinct entry for a pushed detail route', () => {
    const detail = newHistoryEnvelope(
      { view: 'workoutDetail', id: 'workout-old' },
      { home: { periodUnit: 'month', periodAnchor: '2026-05-01' } },
    );

    expect(detail.route).toEqual({ view: 'workoutDetail', id: 'workout-old' });
    expect(detail.entryKey).toEqual(expect.any(String));
    expect(detail.entryKey).not.toBe('entry-a');
    expect(detail.surfaces?.home).toEqual({
      periodUnit: 'month',
      periodAnchor: '2026-05-01',
    });
  });
});
