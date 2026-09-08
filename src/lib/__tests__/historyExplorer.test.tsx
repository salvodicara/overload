import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Workout } from '../types';
import { History } from '../../screens/History';
import { WorkoutList } from '../../components/WorkoutList';

const data = vi.hoisted(() => ({
  workouts: [] as Workout[],
  surface: {} as Record<string, unknown>,
}));
vi.mock('../../state/useStore', () => ({
  useStore: (select: (state: unknown) => unknown) =>
    select({ workouts: data.workouts, routines: [], settings: {}, nav: vi.fn() }),
}));
vi.mock('../../hooks/useSurfaceState', () => ({ useSurfaceState: () => [data.surface, vi.fn()] }));
vi.mock('../../hooks/useCatalog', () => ({ useCatalog: () => true }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { count?: number }) =>
      key + (opts?.count === undefined ? '' : ':' + opts.count),
    i18n: { language: 'en' },
  }),
}));
vi.mock('../exercises', () => ({ exerciseName: (id: string) => id }));
function workout(id: string, date: string, startTs = 1): Workout {
  return { id, dayLabel: id, date, startTs, updatedAt: 1, sets: [], source: 'app', volumeKg: 0 };
}

describe('history explorer regressions', () => {
  beforeEach(() => {
    data.surface = { mode: 'calendar', anchor: '2026-08', visibleCount: 40 };
    data.workouts = [];
  });
  it('shows only the displayed month while retaining multiple same-day sessions', () => {
    data.workouts = [
      workout('august-morning', '2026-08-03'),
      workout('august-evening', '2026-08-03'),
      workout('july-session', '2026-07-03'),
    ];
    const html = renderToStaticMarkup(<History />);
    expect(html).toContain('august-morning');
    expect(html).toContain('august-evening');
    expect(html).not.toContain('july-session');
  });
  it('does not offer a reset when the entire month is already shown', () => {
    const html = renderToStaticMarkup(<History />);
    expect(html).not.toContain('history.showWholeMonth');
    expect(html).toContain('history.workoutsCount:0');
  });
  it('ignores a legacy day selection and retains the whole month', () => {
    data.surface.selectedDay = '2026-08-03';
    const html = renderToStaticMarkup(<History />);
    expect(html).not.toContain('history.showWholeMonth');
    expect(html).not.toContain('history.dayScope');
    expect(html).toContain('history.emptyMonth');
  });
  it('orders dates before pagination even when timestamps disagree', () => {
    data.surface = { mode: 'list', visibleCount: 1 };
    data.workouts = [
      workout('older-date', '2026-07-03', 100),
      workout('newer-date', '2026-08-03', 1),
    ];
    const html = renderToStaticMarkup(<History />);
    expect(html).toContain('newer-date');
    expect(html).not.toContain('older-date');
  });
  it('uses the same search and routine/exercise filters for day markers and sessions', () => {
    data.surface = { ...data.surface, query: 'match', routineId: 'routine', exerciseId: 'squat' };
    data.workouts = [
      {
        ...workout('match-visible', '2026-08-03'),
        routineId: 'routine',
        sets: [{ exerciseId: 'squat', done: true, reps: 5, weightKg: 10 }],
      },
      workout('hidden', '2026-08-03'),
    ];
    const html = renderToStaticMarkup(<History />);
    expect(html).toContain('history.workoutsCount:1');
    expect(html).not.toContain('history.workoutsCount:2');
  });
  it('groups WorkoutList by saved date before timestamps', () => {
    const html = renderToStaticMarkup(
      <WorkoutList
        workouts={[
          workout('older-date', '2026-07-03', 100),
          workout('newer-date', '2026-08-03', 1),
        ]}
        onOpen={() => {}}
      />,
    );
    expect(html.indexOf('newer-date')).toBeLessThan(html.indexOf('older-date'));
  });
});
