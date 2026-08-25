import { useTranslation } from 'react-i18next';
import { exerciseName } from '../lib/exercises';
import { useStore } from '../state/useStore';

export function Summary({ workoutId }: { workoutId: string }) {
  const { t, i18n } = useTranslation();
  const { workouts } = useStore();
  const nav = useStore((s) => s.nav);
  const pending = useStore((s) => s.pendingRoutineChanges);
  const applyRoutineChanges = useStore((s) => s.applyRoutineChanges);
  const dismissRoutineChanges = useStore((s) => s.dismissRoutineChanges);
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
      <div className="summary-pop" style={{ textAlign: 'center', padding: '56px 0 8px' }}>
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
        {prs.map((id, i) => (
          <div key={id} className="banner banner-good" style={{ animationDelay: `${0.12 + i * 0.07}s` }}>
            {t('summary.pr', { exercise: exerciseName(id, i18n.language) })}
          </div>
        ))}
      </div>

      {pending && (
        <div className="card card-pad stack" style={{ marginTop: 14 }}>
          <strong>{t('summary.updateRoutineTitle')}</strong>
          <span className="muted small">
            {t('summary.updateRoutineBody', { n: pending.items.length })}
          </span>
          <div className="row">
            <button className="btn btn-accent" style={{ flex: 1 }} onClick={() => void applyRoutineChanges()}>
              {t('summary.updateRoutineYes')}
            </button>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={dismissRoutineChanges}>
              {t('summary.updateRoutineNo')}
            </button>
          </div>
        </div>
      )}

      <button className="btn btn-solid btn-block btn-big" style={{ marginTop: 24 }} onClick={() => nav({ view: 'home' })}>
        {t('summary.home')}
      </button>
    </div>
  );
}
