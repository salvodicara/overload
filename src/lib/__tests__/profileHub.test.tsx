import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { Profile } from '../../screens/Profile';

vi.mock('../../state/useStore', () => {
  const state = {
    settings: { unit: 'kg', locale: 'en' },
    user: { name: 'Alex' },
    syncState: 'synced',
    nav: vi.fn(),
    updateSettings: vi.fn(),
    workouts: Array.from({ length: 6 }, (_, index) => ({
      id: `session-${index}`,
      dayLabel: `Session ${index}`,
      date: `2026-08-0${index + 1}`,
      startTs: index,
      updatedAt: 1,
      sets: [],
      source: 'app',
      volumeKg: 100,
    })),
  };
  return {
    useStore: (select?: (value: typeof state) => unknown) => (select ? select(state) : state),
  };
});
vi.mock('../../hooks/useCatalog', () => ({ useCatalog: () => true }));
vi.mock('../firebase', () => ({ signOutUser: vi.fn() }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

it('shows the newest five workouts while keeping lifetime summary volume', () => {
  const html = renderToStaticMarkup(<Profile />);
  expect(html).toContain('Session 5');
  expect(html).toContain('Session 1');
  expect(html).not.toContain('Session 0');
  expect(html.indexOf('Session 5')).toBeLessThan(html.indexOf('Session 1'));
  expect(html).toContain('600 kg');
});
