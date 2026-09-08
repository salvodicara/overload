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
