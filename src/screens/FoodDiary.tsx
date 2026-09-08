import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '../components/BottomSheet';
import { FoodNutrients, foodName } from '../components/FoodNutrients';
import { useSurfaceState } from '../hooks/useSurfaceState';
import { todayISO, fmtDate } from '../lib/format';
import { NUTRIENT_FIELDS } from '../lib/nutrition';
import { summarizeEntries, type FoodEntry, type Food } from '../lib/foodDiary';
import { isAccountActionCurrent, toast, useStore } from '../state/useStore';
export const MEALS: FoodEntry['meal'][] = ['breakfast', 'lunch', 'dinner', 'snack'];
export function FoodDiary() {
  const { t, i18n } = useTranslation();
  const { nutrition, settings, nav, updateSettings } = useStore();
  const [surface, setSurface] = useSurfaceState('diet', { date: todayISO() });
  const date = surface.date ?? todayISO();
  const row = nutrition.find((day) => day.date === date);
  const entries = row?.entries ?? [];
  const summary = row?.entries
    ? summarizeEntries(entries)
    : {
        totals: Object.fromEntries(
          NUTRIENT_FIELDS.filter((key) => row?.[key] != null).map((key) => [key, row![key]]),
        ) as Food['nutrients'],
        incomplete: [],
      };
  const [savingMeal, setSavingMeal] = useState<FoodEntry['meal'] | null>(null);
  const [mealName, setMealName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const setDate = (value: string) => setSurface({ date: value });
  async function saveMeal() {
    if (busy || !savingMeal || !mealName.trim()) return;
    setBusy(true);
    setError(false);
    try {
      const saved = {
        id: crypto.randomUUID(),
        name: mealName.trim(),
        entries: structuredClone(
          entries.filter((entry) => entry.meal === savingMeal && entry.food.source !== 'manual'),
        ),
      };
      const result = await updateSettings({
        savedMeals: [...(useStore.getState().settings.savedMeals ?? []), saved],
      });
      if (isAccountActionCurrent(result)) {
        setSavingMeal(null);
        setMealName('');
        toast(t('food.mealSaved'));
      }
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="food-diary">
      <label className="field food-date">
        <span className="field-label">{t('diet.date')}</span>
        <input
          type="date"
          value={date}
          onChange={(event) => {
            if (event.target.value && event.target.validity.valid) setDate(event.target.value);
          }}
        />
      </label>
      <section aria-label={t('food.dailySummary')} className="food-summary">
        <FoodNutrients totals={summary.totals} incomplete={summary.incomplete} compact />
        {settings.kcalTarget && (
          <p className="small muted">{t('food.target', { value: settings.kcalTarget })}</p>
        )}
        <details>
          <summary>{t('food.allNutrients')}</summary>
          <FoodNutrients totals={summary.totals} incomplete={summary.incomplete} />
        </details>
      </section>
      <div className="food-tools">
        <button className="btn btn-ghost" onClick={() => nav({ view: 'foodImport' })}>
          {t('food.import')}
        </button>
        <button className="btn btn-ghost" onClick={() => nav({ view: 'foodTotals', date })}>
          {t('food.manualTotals')}
        </button>
      </div>
      {!row?.entries && NUTRIENT_FIELDS.some((key) => row?.[key] != null) && (
        <p className="small muted">{t('food.existingTotals')}</p>
      )}
      {MEALS.map((meal) => {
        const foods = entries.filter((entry) => entry.meal === meal);
        return (
          <section key={meal} className="food-meal" aria-labelledby={'meal-' + meal}>
            <div className="spread">
              <h2 id={'meal-' + meal}>{t('food.meals.' + meal)}</h2>
              {foods.some((entry) => entry.food.source !== 'manual') && (
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setError(false);
                    setMealName(t('food.meals.' + meal));
                    setSavingMeal(meal);
                  }}
                >
                  {t('food.saveMeal')}
                </button>
              )}
            </div>
            {foods.length > 0 && (
              <ul className="food-entries">
                {foods.map((entry) => (
                  <li key={entry.id}>
                    <button
                      onClick={() =>
                        entry.food.source === 'manual'
                          ? nav({ view: 'foodTotals', date })
                          : nav({ view: 'foodEdit', date, entryId: entry.id })
                      }
                    >
                      <span>
                        <strong>
                          {entry.food.source === 'manual'
                            ? t('food.manualTotals')
                            : foodName(entry.food, i18n.language)}
                        </strong>
                        <small>
                          {entry.food.source === 'manual'
                            ? t('food.manualEntry')
                            : entry.quantity.toLocaleString(i18n.language) +
                              ' ' +
                              entry.food.basis +
                              (entry.food.brand ? ' · ' + entry.food.brand : '')}
                        </small>
                      </span>
                      <span className="mono">
                        {entry.food.nutrients.kcal === undefined
                          ? '—'
                          : Math.round((entry.food.nutrients.kcal * entry.quantity) / 100)}{' '}
                        <small>kcal</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button className="food-add" onClick={() => nav({ view: 'foodAdd', date, meal })}>
              {t('food.addFood')}
            </button>
          </section>
        );
      })}
      {nutrition.length > 0 && (
        <details className="food-history">
          <summary>{t('diet.recent')}</summary>
          <ul>
            {[...nutrition]
              .filter(
                (day) => day.entries?.length || NUTRIENT_FIELDS.some((key) => day[key] != null),
              )
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((day) => (
                <li key={day.date}>
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      setDate(day.date);
                      window.scrollTo(0, 0);
                    }}
                  >
                    {fmtDate(day.date, i18n.language)}
                  </button>
                </li>
              ))}
          </ul>
        </details>
      )}
      <p className="small muted food-attribution">
        {t('food.sources')}{' '}
        <a href="https://fdc.nal.usda.gov/" target="_blank" rel="noreferrer">
          USDA
        </a>{' '}
        ·{' '}
        <a href="https://world.openfoodfacts.org/" target="_blank" rel="noreferrer">
          Open Food Facts
        </a>{' '}
        (ODbL).
      </p>
      <BottomSheet
        open={savingMeal !== null}
        title={t('food.saveMeal')}
        onClose={() => {
          if (!busy) setSavingMeal(null);
        }}
      >
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            void saveMeal();
          }}
        >
          <label className="field">
            <span>{t('food.mealName')}</span>
            <input
              disabled={busy}
              value={mealName}
              maxLength={120}
              onChange={(event) => setMealName(event.target.value)}
              required
            />
          </label>
          <p className="small muted">{t('food.saveMealHint')}</p>
          {error && <p role="alert">{t('food.saveError')}</p>}
          <button className="btn btn-accent" disabled={busy || !mealName.trim()}>
            {busy ? t('food.working') : t('common.save')}
          </button>
        </form>
      </BottomSheet>
    </div>
  );
}
