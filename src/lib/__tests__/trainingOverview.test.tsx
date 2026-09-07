import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { TrainingOverview } from '../../components/TrainingOverview';

vi.mock('../../state/useStore', () => ({
  useStore: () => ({
    settings: { unit: 'kg' },
    workouts: [125050, 125100].map((volume, index) => ({
      id: String(index),
      date: `2026-08-2${4 + index}`,
      startTs: 0,
      sets: [{ exerciseId: 'squat', done: true, weightKg: volume, reps: 1 }],
    })),
  }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { values?: string }) => options?.values ?? key,
    i18n: { language: 'en' },
  }),
}));

it('preserves distinct nearby large values in the chart text alternative', () => {
  const html = renderToStaticMarkup(
    <TrainingOverview
      surface={{ periodAnchor: '2026-08-26', periodUnit: 'week' }}
      onChange={() => {}}
    />,
  );
  expect(html).toContain('24 Aug: 125,050 kg');
  expect(html).toContain('25 Aug: 125,100 kg');
});
