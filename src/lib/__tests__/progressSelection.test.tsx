import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import { Progress } from '../../screens/Progress';

const fixture = vi.hoisted(() => ({ exerciseId: 'pushup' as string | undefined }));
vi.mock('../../state/useStore', () => ({
  useStore: (select?: (state: any) => unknown) => {
    const state = {
      route: { view: 'progress', exerciseId: fixture.exerciseId },
      settings: { unit: 'kg' },
      catalogReady: true,
      workouts: [
        {
          id: 'w1',
          date: '2026-09-08',
          startTs: 1,
          sets: [{ exerciseId: 'squat', weightKg: 40, reps: 8, done: true }],
        },
      ],
    };
    return select ? select(state) : state;
  },
}));
vi.mock('../../hooks/useCatalog', () => ({ useCatalog: () => true }));
vi.mock('../../hooks/useSurfaceState', () => ({
  useSurfaceState: (_view: string, defaults: unknown) => [defaults, vi.fn()],
}));
vi.mock('../../components/TrainingOverview', () => ({
  TrainingOverview: () => <div>overview</div>,
}));
vi.mock('../exercises', () => ({
  exerciseName: (id: string) => (id === 'squat' ? 'Squat' : 'Push-Up'),
  getCatalog: () =>
    new Map([
      ['squat', {}],
      ['pushup', {}],
    ]),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));
beforeEach(() => {
  fixture.exerciseId = 'pushup';
});

it('keeps a requested exercise without sessions visible instead of substituting recorded exercise', () => {
  const html = renderToStaticMarkup(<Progress />);
  expect(html).toContain('<option value="pushup" selected="">Push-Up</option>');
  expect(html).toContain('<option value="squat">Squat</option>');
  expect(html).toContain('>Push-Up</h2>');
  expect(html).toContain('progress.noExerciseHistory');
  expect(html).not.toContain('progress.summary');
});
it('keeps the existing default selection for general Statistics', () => {
  fixture.exerciseId = undefined;
  const html = renderToStaticMarkup(<Progress />);
  expect(html).toContain('<option value="squat" selected="">Squat</option>');
  expect(html).not.toContain('Push-Up');
  expect(html).toContain('progress.needAnotherSession');
});
