import { useTranslation } from 'react-i18next';
import { exerciseName } from '../lib/exercises';
import { useStore } from '../state/useStore';

export function Summary({ workoutId }: { workoutId: string }) {
  const { t, i18n } = useTranslation();
  const { workouts } = useStore();
  const nav = useStore((s) => s.nav);
  const w = workouts.find((x) => x.id === workoutId);
  if (!w) {
    nav({ view: 'home' });
    return null;
  }
  const prev = workouts.find(
    (x) => x.id !== w.id && x.source === 'app' && x.dayLabel === w.dayLabel && x.date <= w.date,
  );
  const diff = prev ? Math.round(w.volumeKg - prev.volumeKg) : null;
  const prs = [...new Set(w.sets.filter((s) => s.isPr).map((s) => s.exerciseId))];
  const mins = w.endTs ? Math.max(1, Math.round((w.endTs - w.startTs) / 60000)) : 0;

  return (
    <div className="screen">
      <div style={{ textAlign: 'center', padding: '56px 0 8px' }}>
        <div className="display" style={{ fontSize: 40 }}>
          {t('summary.title')}
        </div>
        <div className="display" style={{ fontSize: 64, color: 'var(--accent-text)', marginTop: 12 }}>
          {Math.round(w.volumeKg).toLocaleString(i18n.language)}
        </div>
        <div className="muted">{t('summary.volume')}</div>
        <div className="mono small muted" style={{ marginTop: 8 }}>
          {t('summary.sets', { n: w.sets.length })} · {t('summary.duration', { min: mins })}
        </div>
      </div>

      {diff !== null && (
        <div className={`banner ${diff >= 0 ? 'banner-good' : 'banner-warn'}`} style={{ textAlign: 'center', marginTop: 14 }}>
          {t(diff >= 0 ? 'summary.vsLastUp' : 'summary.vsLastDown', {
            diff: Math.abs(diff).toLocaleString(i18n.language),
            day: w.dayLabel ?? '',
          })}
        </div>
      )}

      <div className="stack" style={{ marginTop: 14 }}>
        {prs.map((id) => (
          <div key={id} className="banner banner-good">
            {t('summary.pr', { exercise: exerciseName(id, i18n.language) })}
          </div>
        ))}
      </div>

      <button className="btn btn-solid btn-block btn-big" style={{ marginTop: 24 }} onClick={() => nav({ view: 'home' })}>
        {t('summary.home')}
      </button>
    </div>
  );
}
