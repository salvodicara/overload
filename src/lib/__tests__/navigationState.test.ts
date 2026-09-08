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

it('clears filters and scroll when navigation changes account owner', async () => {
  const { bindNavigationOwner, isNavigationOwnerCurrent } = await import('../navigationState');
  const fake = {
    state: null as unknown,
    replaceState(state: unknown) {
      this.state = state;
    },
  };
  vi.stubGlobal('history', fake);
  bindNavigationOwner('first', true);
  replaceSurfaceState('history', { routineId: 'private-routine' });
  writeEntryScroll('history', 900);
  const first = history.state;
  bindNavigationOwner('second', true);
  expect(surfaceStateFor('history')).toEqual({});
  expect(readEntryScroll('history')).toBe(0);
  expect(isNavigationOwnerCurrent(first)).toBe(false);
});

it('restores scroll and unfinished entry state after a module reload', async () => {
  const rows = new Map<string, string>();
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => rows.get(k) ?? null,
    setItem: (k: string, v: string) => rows.set(k, v),
  });
  vi.resetModules();
  const before = await import('../navigationState');
  history.replaceState(before.newHistoryEnvelope({ view: 'routineEditor', id: 'one' }), '');
  before.bindNavigationOwner('owner', false);
  before.writeEntryValue('draft', { text: 'unfinished', open: true });
  before.writeEntryScroll('routineEditor', 987);
  vi.resetModules();
  const after = await import('../navigationState');
  after.bindNavigationOwner('owner', false);
  expect(after.readHistoryEnvelope()?.route).toEqual({ view: 'routineEditor', id: 'one' });
  expect(after.readEntryScroll('routineEditor')).toBe(987);
  expect(after.readEntryValue('draft')).toEqual({ text: 'unfinished', open: true });
});

it('does not reuse an entry for a different entity of the same screen type', async () => {
  const { ensureHistoryEnvelope, newHistoryEnvelope } = await import('../navigationState');
  const old = newHistoryEnvelope({ view: 'exercise', id: 'one' });
  expect(ensureHistoryEnvelope({ view: 'exercise', id: 'two' }, old).entryKey).not.toBe(
    old.entryKey,
  );
});

it('clears completed drafts on their original entry without touching another screen', async () => {
  const api = await import('../navigationState');
  const first = api.newHistoryEnvelope({ view: 'workoutEditor', id: 'one' });
  history.replaceState(first, '');
  api.writeEntryValue('draft', { name: 'changed' });
  api.writeEntryScroll('workoutEditor', 80);
  const second = api.newHistoryEnvelope({ view: 'routineImport' });
  history.replaceState(second, '');
  api.writeEntryValue('draft', 'another draft');
  api.clearEntryDrafts(first.entryKey);
  expect(api.readEntryValue('draft', first.entryKey)).toBeUndefined();
  expect(api.readEntryScroll('workoutEditor', first.entryKey)).toBe(80);
  expect(api.readEntryValue('draft')).toBe('another draft');
});

it('never restores an old account snapshot into a new account', async () => {
  const api = await import('../navigationState');
  api.bindNavigationOwner('first-account', true);
  const key = api.readHistoryEnvelope()!.entryKey;
  api.writeEntryValue('draft', 'private');
  api.bindNavigationOwner('second-account', true);
  expect(api.readEntryValue('draft', key)).toBeUndefined();
});

it('rejects malformed deep routes and accepts supported picker and nutrition payloads', async () => {
  const { validRoute } = await import('../navigationState');
  for (const route of [
    null,
    {},
    { view: 'unknown' },
    { view: 'exercise' },
    { view: 'workoutEditor', id: 3 },
    { view: 'foodAdd', date: 'wrong', meal: 'snack' },
    { view: 'library', pickFor: { activeWorkout: false } },
  ])
    expect(validRoute(route)).toBe(false);
  for (const route of [
    { view: 'exercise', id: 'one', from: 'routine' },
    { view: 'foodAdd', date: '2026-09-08', meal: 'snack' },
    { view: 'library', pickFor: { activeWorkout: true, replaceInstanceId: 'one' } },
  ])
    expect(validRoute(route)).toBe(true);
});
