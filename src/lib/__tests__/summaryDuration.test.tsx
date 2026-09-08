import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Summary } from '../../screens/Summary';

vi.mock('../../hooks/useCatalog', () => ({ useCatalog: () => true }));
vi.mock('../../state/useStore', () => ({
  useStore: (select?: (state: unknown) => unknown) => {
    const state = {
      settings: {},
      routines: [],
      workouts: [
        {
          id: 'paused-session',
          date: '2026-09-08',
          startTs: 1000,
          endTs: 3601000,
          durationSec: 1200,
          volumeKg: 0,
          sets: [],
          source: 'app',
        },
      ],
      nav: vi.fn(),
    };
    return select ? select(state) : state;
  },
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { min?: number }) =>
      key === 'summary.duration' ? String(values?.min) + ' minutes' : key,
    i18n: { language: 'en' },
  }),
}));

describe('completed workout summary', () => {
  it('reports active training time after a paused session', () => {
    const html = renderToStaticMarkup(<Summary workoutId="paused-session" />);
    expect(html).toContain('20 minutes');
    expect(html).not.toContain('60 minutes');
  });
});
