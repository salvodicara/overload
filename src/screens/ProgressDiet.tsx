import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fmtDate, todayISO } from '../lib/format';
import { useStore } from '../state/useStore';

function targetNumber(value: string): number | undefined {
  const number = Number(value);
  return value && Number.isFinite(number) && number > 0 ? number : undefined;
}

function dailyNumber(value: string): number | null {
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
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
        current: current ?? '0',
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

export function ProgressDiet() {
  const { t, i18n } = useTranslation();
  const nutrition = useStore((state) => state.nutrition);
  const settings = useStore((state) => state.settings);
  const saveNutritionDay = useStore((state) => state.saveNutritionDay);
  const updateSettings = useStore((state) => state.updateSettings);
  const [editTargets, setEditTargets] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const targetsId = useId();
  const today = todayISO();
  const todayRow = nutrition.find((day) => day.id === today);
  const recentDays = nutrition
    .filter((day) => day.kcal != null || day.proteinG != null)
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 7);
  const locale = i18n.language === 'it' ? 'it-IT' : 'en-GB';
  const persist = (action: Promise<unknown>): void => {
    setSaveError(false);
    void action.catch(() => setSaveError(true));
  };

  return (
    <div className="nutrition-progress">
      <section className="nutrition-today card card-pad" aria-labelledby="nutrition-today-title">
        <div className="spread">
          <h2 id="nutrition-today-title" className="progress-section-title">
            {t('diet.today')}
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

        {editTargets && (
          <div id={targetsId} className="nutrition-fields nutrition-targets">
            <label className="field">
              <span className="field-label">{t('diet.kcalTarget')}</span>
              <input
                name="calorie-target"
                type="number"
                inputMode="numeric"
                min={1}
                autoComplete="off"
                defaultValue={settings.kcalTarget ?? ''}
                onBlur={(event) => {
                  const kcalTarget = targetNumber(event.target.value);
                  if (kcalTarget !== settings.kcalTarget) {
                    persist(updateSettings({ kcalTarget }));
                  }
                }}
              />
            </label>
            <label className="field">
              <span className="field-label">{t('diet.proteinTarget')}</span>
              <input
                name="protein-target"
                type="number"
                inputMode="numeric"
                min={1}
                autoComplete="off"
                defaultValue={settings.proteinTarget ?? ''}
                onBlur={(event) => {
                  const proteinTarget = targetNumber(event.target.value);
                  if (proteinTarget !== settings.proteinTarget) {
                    persist(updateSettings({ proteinTarget }));
                  }
                }}
              />
            </label>
          </div>
        )}

        <div className="nutrition-fields">
          <label className="field">
            <span className="field-label">{t('diet.calories')}</span>
            <input
              key={`kcal-${todayRow?.kcal ?? ''}`}
              name="calories"
              type="number"
              inputMode="numeric"
              min={0}
              autoComplete="off"
              defaultValue={todayRow?.kcal ?? ''}
              onBlur={(event) => {
                const kcal = dailyNumber(event.target.value);
                if (kcal !== (todayRow?.kcal ?? null)) {
                  persist(saveNutritionDay(today, { kcal }));
                }
              }}
            />
            <Goal
              value={todayRow?.kcal ?? null}
              target={settings.kcalTarget}
              unit="kcal"
              emptyKey="diet.noCalorieTarget"
            />
          </label>
          <label className="field">
            <span className="field-label">{t('diet.protein')}</span>
            <input
              key={`protein-${todayRow?.proteinG ?? ''}`}
              name="protein"
              type="number"
              inputMode="numeric"
              min={0}
              autoComplete="off"
              defaultValue={todayRow?.proteinG ?? ''}
              onBlur={(event) => {
                const proteinG = dailyNumber(event.target.value);
                if (proteinG !== (todayRow?.proteinG ?? null)) {
                  persist(saveNutritionDay(today, { proteinG }));
                }
              }}
            />
            <Goal
              value={todayRow?.proteinG ?? null}
              target={settings.proteinTarget}
              unit="g"
              emptyKey="diet.noProteinTarget"
            />
          </label>
        </div>
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
              <li key={day.id} className="spread">
                <span className="mono small muted">
                  {fmtDate(day.date, i18n.language, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
                <span className="mono small">
                  {day.kcal == null ? '−' : `${day.kcal.toLocaleString(locale)} kcal`}
                  <span aria-hidden="true"> · </span>
                  {day.proteinG == null ? '−' : `${day.proteinG.toLocaleString(locale)} g`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
