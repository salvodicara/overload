import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconMinus } from './Icons';
import { todayISO } from '../lib/format';
import { useStore } from '../state/useStore';

function weekStart(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toLocaleDateString('sv');
}

/** Weekly momentum: sessions this week vs goal, plus streak of weeks on target. */
export function MomentumCard() {
  const { t } = useTranslation();
  const { workouts, settings } = useStore();
  const updateSettings = useStore((s) => s.updateSettings);
  const [editing, setEditing] = useState(false);

  const goal = settings.weeklyGoal ?? 3;
  const thisWeek = weekStart(todayISO());
  const counts = new Map<string, number>();
  for (const w of workouts) {
    if (w.source !== 'app') continue;
    const k = weekStart(w.date);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const done = counts.get(thisWeek) ?? 0;

  let streak = 0;
  const cursor = new Date(`${thisWeek}T12:00:00`);
  if (done >= goal) streak = 1;
  for (;;) {
    cursor.setDate(cursor.getDate() - 7);
    const k = cursor.toLocaleDateString('sv');
    if ((counts.get(k) ?? 0) >= goal) streak += 1;
    else break;
  }

  return (
    <div className="card card-pad" style={{ margin: '8px 0 14px' }}>
      <div className="spread">
        <strong style={{ fontSize: 14 }}>
          {t('momentum.title', { done, goal })}
        </strong>
        {streak > 0 && <span className="chip chip-good">{t('momentum.streak', { n: streak })}</span>}
      </div>
      <div className="row" style={{ gap: 3, marginTop: 8 }}>
        {Array.from({ length: goal }, (_, i) => (
          <span
            key={i}
            style={{
              flex: 1,
              height: 5,
              borderRadius: 2,
              background: i < Math.min(done, goal) ? 'var(--accent)' : 'var(--surface2)',
            }}
          />
        ))}
      </div>
      <div className="spread" style={{ marginTop: 8 }}>
        <span className="muted small">{done >= goal ? t('momentum.hit') : t('momentum.hint')}</span>
        {editing ? (
          <span className="row" style={{ gap: 8 }}>
            <button
              className="iconbtn"
              style={{ width: 34, height: 34 }}
              aria-label={t('momentum.less')}
              disabled={goal <= 1}
              onClick={() => void updateSettings({ weeklyGoal: goal - 1 })}
            >
              <IconMinus width={13} height={13} />
            </button>
            <span className="mono" style={{ fontWeight: 700 }}>{goal}</span>
            <button
              className="iconbtn"
              style={{ width: 34, height: 34, fontSize: 15, fontWeight: 700 }}
              aria-label={t('momentum.more')}
              disabled={goal >= 7}
              onClick={() => void updateSettings({ weeklyGoal: goal + 1 })}
            >
              +
            </button>
            <button className="small" style={{ color: 'var(--accent-text)', fontWeight: 600 }} onClick={() => setEditing(false)}>
              {t('momentum.done')}
            </button>
          </span>
        ) : (
          <button className="small" style={{ color: 'var(--accent-text)', fontWeight: 600, padding: 4 }} onClick={() => setEditing(true)}>
            {t('momentum.edit')}
          </button>
        )}
      </div>
    </div>
  );
}
