import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { FoodNutrients } from '../../components/FoodNutrients';
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));
it('marks incomplete calorie totals without requiring the details disclosure', () => {
  expect(
    renderToStaticMarkup(<FoodNutrients totals={{ kcal: 100 }} incomplete={['kcal']} compact />),
  ).toContain('food.partial');
});
