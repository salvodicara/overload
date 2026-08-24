import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fmtDate, todayISO } from '../lib/format';
import { useStore } from '../state/useStore';

function Bar({ value, target }: { value: number | null; target?: number }) {
  if (!target || value == null) return null;
  const pct = Math.max(0, Math.min(100, (value / target) * 100));
  const on = value >= target * 0.95 && value <= target * 1.15;
  return (
    <span
      aria-hidden
      style={{
        display: 'block',
        height: 4,
        borderRadius: 2,
        background: 'var(--surface2)',
        overflow: 'hidden',
        marginTop: 6,
      }}
    >
      <span
        style={{
          display: 'block',
          width: `${pct}%`,
          height: '100%',
          borderRadius: 2,
          background: on ? 'var(--good)' : 'var(--accent)',
          transition: 'width 0.25s ease',
        }}
      />
    </span>
  );
}

export function ProgressDiet() {
  const { t, i18n } = useTranslation();
  const { nutrition, settings } = useStore();
  const saveNutritionDay = useStore((s) => s.saveNutritionDay);
  const updateSettings = useStore((s) => s.updateSettings);
  const [editTargets, setEditTargets] = useState(false);
  const [mealsOpen, setMealsOpen] = useState(false);

  const today = todayISO();
  const todayRow = nutrition.find((n) => n.id === today);
  const days = nutrition
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);

  return (
    <div className="stack" style={{ marginTop: 4 }}>
      <div className="card card-pad stack" style={{ gap: 10 }}>
        <div className="spread">
          <strong>{t('diet.today')}</strong>
          <button className="small" style={{ color: 'var(--accent-text)', fontWeight: 600, padding: 6 }} onClick={() => setEditTargets((v) => !v)}>
            {t('diet.targets')}
          </button>
        </div>
        {editTargets && (
          <div className="row">
            <label className="stack" style={{ flex: 1, gap: 3 }}>
              <span className="mono muted" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {t('diet.kcalTarget')}
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                defaultValue={settings.kcalTarget ?? ''}
                placeholder="2700"
                aria-label={t('diet.kcalTarget')}
                onChange={(e) => void updateSettings({ kcalTarget: e.target.value ? Number(e.target.value) : undefined })}
              />
            </label>
            <label className="stack" style={{ flex: 1, gap: 3 }}>
              <span className="mono muted" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {t('diet.proteinTarget')}
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                defaultValue={settings.proteinTarget ?? ''}
                placeholder="130"
                aria-label={t('diet.proteinTarget')}
                onChange={(e) => void updateSettings({ proteinTarget: e.target.value ? Number(e.target.value) : undefined })}
              />
            </label>
          </div>
        )}
        <div className="row">
          <label className="stack" style={{ flex: 1, gap: 3 }}>
            <span className="mono muted" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              kcal
            </span>
            <input
              key={`k-${today}-${todayRow?.kcal ?? ''}`}
              type="number"
              inputMode="numeric"
              min={0}
              defaultValue={todayRow?.kcal ?? ''}
              placeholder="0"
              aria-label="kcal"
              onBlur={(e) => void saveNutritionDay(today, { kcal: e.target.value ? Number(e.target.value) : null })}
            />
            <Bar value={todayRow?.kcal ?? null} target={settings.kcalTarget} />
          </label>
          <label className="stack" style={{ flex: 1, gap: 3 }}>
            <span className="mono muted" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t('diet.protein')}
            </span>
            <input
              key={`p-${today}-${todayRow?.proteinG ?? ''}`}
              type="number"
              inputMode="numeric"
              min={0}
              defaultValue={todayRow?.proteinG ?? ''}
              placeholder="0"
              aria-label={t('diet.protein')}
              onBlur={(e) => void saveNutritionDay(today, { proteinG: e.target.value ? Number(e.target.value) : null })}
            />
            <Bar value={todayRow?.proteinG ?? null} target={settings.proteinTarget} />
          </label>
        </div>
        <span className="muted small">{t('diet.hint')}</span>
      </div>

      {days.length > 0 && (
        <div className="card">
          {days.map((n, i) => (
            <div key={n.id} className="spread card-pad" style={{ borderTop: i ? '1px solid var(--line)' : 'none', paddingTop: 10, paddingBottom: 10 }}>
              <span className="mono small muted">{fmtDate(n.date, i18n.language, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
              <span className="mono small">
                {n.kcal != null ? `${n.kcal.toLocaleString(i18n.language)} kcal` : '-'}
                {' · '}
                {n.proteinG != null ? `${n.proteinG} g` : '-'}
              </span>
            </div>
          ))}
        </div>
      )}

      <button className="btn btn-ghost btn-block" aria-expanded={mealsOpen} onClick={() => setMealsOpen((v) => !v)}>
        {t('diet.meals')}
      </button>
      {mealsOpen && (
        <div className="card card-pad stack" style={{ gap: 12 }}>
          {([1, 2, 3] as const).map((n) => (
            <div key={n}>
              <strong style={{ fontSize: 14 }}>{t(`diet.meal${n}Title`)}</strong>
              <div className="muted small" style={{ marginTop: 2 }}>{t(`diet.meal${n}Body`)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
