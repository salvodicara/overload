import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { ProgressDiet } from '../../screens/ProgressDiet';

vi.mock('../../state/useStore', () => ({
  useStore: (select: (state: unknown) => unknown) =>
    select({
      nutrition: [
        {
          id: '2026-09-01',
          date: '2026-09-01',
          kcal: null,
          proteinG: null,
          carbsG: 12.5,
          fatG: 0,
          saltG: 1.25,
        },
      ],
      settings: {},
      saveNutritionDay: () => {},
      updateSettings: () => {},
    }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

it('exposes a date input and includes nutrient-only records with labelled zeros in history', () => {
  const html = renderToStaticMarkup(<ProgressDiet />);
  expect(html).toContain('type="date"');
  expect(html).toContain('name="saltG"');
  expect(html).toContain('step="any"');
  expect(html).toContain('12.5');
  expect(html).toContain('1.25');
  expect(html).toContain('diet.fat');
  expect(html).toContain('0 g');
});
