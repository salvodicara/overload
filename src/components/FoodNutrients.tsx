import { useTranslation } from 'react-i18next';
import { NUTRIENT_META, type Food, type NutrientKey } from '../lib/foodDiary';
export function foodName(food: Food, language: string) {
  return language === 'it' ? (food.nameIt ?? food.name) : food.name;
}
export function FoodNutrients({
  totals,
  incomplete = [],
  compact = false,
}: {
  totals: Food['nutrients'];
  incomplete?: NutrientKey[];
  compact?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const keys = compact
    ? (['kcal', 'proteinG', 'carbsG', 'fatG'] as NutrientKey[])
    : (Object.keys(NUTRIENT_META) as NutrientKey[]);
  return (
    <>
      <dl className={compact ? 'food-macros' : 'food-nutrients'}>
        {keys.map((key) => (
          <div key={key}>
            <dt>{t('food.nutrients.' + key)}</dt>
            <dd>
              <span className="mono">
                {totals[key] === undefined
                  ? '—'
                  : totals[key]!.toLocaleString(i18n.language, { maximumFractionDigits: 1 })}
              </span>{' '}
              <span className="small">{NUTRIENT_META[key].unit}</span>
              {!compact && incomplete.includes(key) && (
                <span className="food-partial">{t('food.partial')}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      {!compact && <p className="small muted">{t('food.coverageHint')}</p>}
    </>
  );
}
