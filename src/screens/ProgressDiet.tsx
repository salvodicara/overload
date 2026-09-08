import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fmtDate, todayISO } from '../lib/format';
import { NUTRIENT_FIELDS, validNutrient, type NutrientField } from '../lib/nutrition';
import { useStore } from '../state/useStore';

function dailyNumber(value: string): number | null {
  if (!value) return null;
  const number = Number(value);
  return number;
}

function Goal({
  value,
  target,
  unit,
  emptyKey,
}: {
  value: number | null;
  target?: number;
  unit: string;
  emptyKey: 'diet.noCalorieTarget' | 'diet.noProteinTarget';
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'it' ? 'it-IT' : 'en-GB';
  const current = value?.toLocaleString(locale);
  const text = target
    ? t('diet.currentTarget', {
        current: current ?? '−',
        target: target.toLocaleString(locale),
        unit,
      })
    : current !== undefined
      ? t('diet.currentNoTarget', { current, unit })
      : t(emptyKey);

  return (
    <>
      <span className="small muted">{text}</span>
      {target && value != null && (
        <span className="nutrition-goal__track" aria-hidden="true">
          <span
            className="nutrition-goal__fill"
            style={{ width: `${Math.min(100, (value / target) * 100)}%` }}
          />
        </span>
      )}
    </>
  );
}

const nutrientLabels = {
  kcal: 'diet.calories',
  proteinG: 'diet.protein',
  carbsG: 'diet.carbs',
  fatG: 'diet.fat',
  saturatedFatG: 'diet.saturatedFat',
  fiberG: 'diet.fiber',
  sugarG: 'diet.sugar',
  saltG: 'diet.salt',
} as const;

export function ProgressDiet({ initialDate }: { initialDate?: string } = {}) {
  const { t, i18n } = useTranslation();
  const nutrition = useStore((state) => state.nutrition);
  const settings = useStore((state) => state.settings);
  const saveNutritionDay = useStore((state) => state.saveNutritionDay);
  const updateSettings = useStore((state) => state.updateSettings);
  const [editTargets, setEditTargets] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [invalidInput, setInvalidInput] = useState(false);
  const [invalidTarget, setInvalidTarget] = useState(false);
  const [selectedDate, setSelectedDate] = useState(initialDate ?? todayISO);
  const targetsId = useId();
  const today = todayISO();
  const storedRow = nutrition.find((day) => day.id === selectedDate);
  const manual = storedRow?.entries?.find((entry) => entry.food.source === 'manual');
  const selectedRow = storedRow?.entries
    ? {
        ...storedRow,
        ...Object.fromEntries(
          NUTRIENT_FIELDS.map((field) => [field, manual?.food.nutrients[field] ?? null]),
        ),
      }
    : storedRow;
  const recentDays = nutrition
    .filter((day) => NUTRIENT_FIELDS.some((field) => day[field] != null))
    .sort((left, right) => right.date.localeCompare(left.date));
  const locale = i18n.language === 'it' ? 'it-IT' : 'en-GB';
  const persist = (action: Promise<unknown>): void => {
    setSaveError(false);
    void action.catch(() => setSaveError(true));
  };

  const saveValue = (field: NutrientField, value: string, valid: boolean): void => {
    const number = dailyNumber(value);
    if (!valid || !validNutrient(number)) {
      setInvalidInput(true);
      return;
    }
    setInvalidInput(false);
    if (number !== (selectedRow?.[field] ?? null))
      persist(saveNutritionDay(selectedDate, { [field]: number }));
  };

  const saveTarget = (
    field: 'kcalTarget' | 'proteinTarget',
    value: string,
    valid: boolean,
  ): void => {
    const number = value === '' ? undefined : Number(value);
    if (!valid || (number !== undefined && (!Number.isFinite(number) || number < 1))) {
      setInvalidTarget(true);
      return;
    }
    setInvalidTarget(false);
    if (number !== settings[field]) persist(updateSettings({ [field]: number }));
  };

  return (
    <div className="nutrition-progress">
      <section className="nutrition-today card card-pad" aria-labelledby="nutrition-today-title">
        <div className="spread">
          <h2 id="nutrition-today-title" className="progress-section-title">
            {selectedDate === today ? t('diet.today') : fmtDate(selectedDate, i18n.language)}
          </h2>
          <button
            className="nutrition-targets-toggle"
            type="button"
            aria-expanded={editTargets}
            aria-controls={targetsId}
            onClick={() => setEditTargets((open) => !open)}
          >
            {t('diet.targets')}
          </button>
        </div>

        <label className="field">
          <span className="field-label">{t('diet.date')}</span>
          <input
            type="date"
            name="nutrition-date"
            value={selectedDate}
            max={today}
            onChange={(event) => {
              if (event.target.value && event.target.validity.valid) {
                setSelectedDate(event.target.value);
                setInvalidInput(false);
              }
            }}
          />
        </label>

        {editTargets && (
          <div id={targetsId} className="nutrition-fields nutrition-targets">
            <label className="field">
              <span className="field-label">{t('diet.kcalTarget')}</span>
              <input
                name="calorie-target"
                type="number"
                inputMode="decimal"
                step="any"
                min={1}
                autoComplete="off"
                defaultValue={settings.kcalTarget ?? ''}
                onBlur={(event) =>
                  saveTarget('kcalTarget', event.target.value, event.target.validity.valid)
                }
              />
            </label>
            <label className="field">
              <span className="field-label">{t('diet.proteinTarget')}</span>
              <input
                name="protein-target"
                type="number"
                inputMode="decimal"
                step="any"
                min={1}
                autoComplete="off"
                defaultValue={settings.proteinTarget ?? ''}
                onBlur={(event) =>
                  saveTarget('proteinTarget', event.target.value, event.target.validity.valid)
                }
              />
            </label>
          </div>
        )}

        <div className="nutrition-fields">
          {NUTRIENT_FIELDS.map((field) => (
            <label className="field" key={field}>
              <span className="field-label">{t(nutrientLabels[field])}</span>
              <input
                key={`${selectedDate}-${field}-${selectedRow?.[field] ?? ''}`}
                aria-label={t(nutrientLabels[field])}
                name={field === 'kcal' ? 'calories' : field === 'proteinG' ? 'protein' : field}
                type="number"
                inputMode="decimal"
                step="any"
                min={0}
                autoComplete="off"
                defaultValue={selectedRow?.[field] ?? ''}
                onBlur={(event) =>
                  saveValue(field, event.target.value, event.target.validity.valid)
                }
              />
              {field === 'kcal' && (
                <Goal
                  value={selectedRow?.kcal ?? null}
                  target={settings.kcalTarget}
                  unit="kcal"
                  emptyKey="diet.noCalorieTarget"
                />
              )}
              {field === 'proteinG' && (
                <Goal
                  value={selectedRow?.proteinG ?? null}
                  target={settings.proteinTarget}
                  unit="g"
                  emptyKey="diet.noProteinTarget"
                />
              )}
            </label>
          ))}
        </div>
        {invalidTarget && (
          <div className="form-feedback form-feedback--error" role="alert">
            {t('diet.invalidTarget')}
          </div>
        )}
        {invalidInput && (
          <div className="form-feedback form-feedback--error" role="alert">
            {t('diet.invalid')}
          </div>
        )}
        <p className="small muted">{t('diet.hint')}</p>
        {saveError && (
          <div className="form-feedback form-feedback--error" role="alert">
            {t('diet.saveError')}
          </div>
        )}
      </section>

      {recentDays.length === 0 && <p className="nutrition-state">{t('diet.empty')}</p>}

      {recentDays.length > 0 && (
        <section className="nutrition-history" aria-labelledby="nutrition-history-title">
          <h2 id="nutrition-history-title" className="progress-section-title">
            {t('diet.recent')}
          </h2>
          <ul>
            {recentDays.map((day) => (
              <li
                key={day.id}
                className="stack"
                style={{ paddingBlock: 'var(--space-3)', gap: 'var(--space-2)' }}
              >
                <button
                  type="button"
                  className="btn btn-ghost"
                  aria-pressed={selectedDate === day.date}
                  onClick={() => {
                    setSelectedDate(day.date);
                    setInvalidInput(false);
                    document
                      .querySelector('[name="nutrition-date"]')
                      ?.scrollIntoView({ block: 'center' });
                  }}
                >
                  {fmtDate(day.date, i18n.language, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </button>
                <dl className="nutrition-fields">
                  {NUTRIENT_FIELDS.filter((field) => day[field] != null).map((field) => (
                    <div key={field}>
                      <dt className="small muted">{t(nutrientLabels[field])}</dt>
                      <dd className="mono small">
                        {day[field]!.toLocaleString(locale)} {field === 'kcal' ? 'kcal' : 'g'}
                      </dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
