import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { ProgressBody } from '../../screens/ProgressBody';

const state = vi.hoisted(() => ({
  settings: {},
  measurements: Array.from({ length: 12 }, (_, index) => ({
    id: String(index),
    date: `2026-08-${String(index + 1).padStart(2, '0')}`,
    metric: 'weight',
    value: 70 + index,
  })),
  addMeasurement: vi.fn(),
  deleteMeasurement: vi.fn(),
}));
vi.mock('../../state/useStore', () => ({
  useStore: (select: (value: typeof state) => unknown) => select(state),
  continueAccountAction: vi.fn(),
}));
vi.mock('../../components/LineChart', () => ({ LineChart: () => null }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, values?: Record<string, unknown>) =>
      key === 'library.resultCount' ? `${values?.shown} of ${values?.total}` : key,
  }),
}));

it('keeps older measurements discoverable when the first page is full', () => {
  const html = renderToStaticMarkup(<ProgressBody />);
  expect(html).toContain('10 of 12');
  expect(html).toContain('library.showMore');
  expect((html.match(/aria-label="body.delete"/g) ?? []).length).toBe(10);
});

it('excludes future records from the current seven-day average', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-08T12:00:00'));
  state.measurements = [
    { id: 'today', date: '2026-09-08', metric: 'weight', value: 70 },
    { id: 'future', date: '2027-01-01', metric: 'weight', value: 150 },
  ];
  const html = renderToStaticMarkup(<ProgressBody />);
  expect(html).toContain('body.weeklyAvg</dt><dd>70 kg');
  vi.useRealTimers();
});
