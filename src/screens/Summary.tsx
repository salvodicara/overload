import { useTranslation } from 'react-i18next';
import { useCatalog } from '../hooks/useCatalog';
import { exerciseName } from '../lib/exercises';
import { kindOf } from '../lib/types';
import { displayVolume, weightLabel } from '../lib/units';
import { useStore } from '../state/useStore';

export function Summary({ workoutId }: { workoutId: string }) {
  const { t, i18n } = useTranslation();
  useCatalog();
  const { settings, workouts } = useStore();
  const nav = useStore((s) => s.nav);
  const pending = useStore((s) => s.pendingRoutineChanges);
  const applyRoutineChanges = useStore((s) => s.applyRoutineChanges);
  const dismissRoutineChanges = useStore((s) => s.dismissRoutineChanges);
  const w = workouts.find((x) => x.id === workoutId);
  if (!w) {
    nav({ view: 'home' });
    return null;
  }
  const prev = workouts
    .filter(
      (candidate) =>
        candidate.id !== w.id &&
        candidate.source === 'app' &&
        candidate.dayLabel === w.dayLabel &&
        candidate.startTs < w.startTs,
    )
    .reduce<(typeof workouts)[number] | null>(
      (latest, candidate) =>
        latest === null || candidate.startTs > latest.startTs ? candidate : latest,
      null,
    );
  const unit = settings.unit ?? 'kg';
  const volume = displayVolume(w.volumeKg, unit);
  const diff = prev ? displayVolume(w.volumeKg - prev.volumeKg, unit) : null;
  const prs = [...new Set(w.sets.filter((s) => s.isPr).map((s) => s.exerciseId))];
  const workingSetCount = w.sets.filter((set) => set.done && kindOf(set.kind) === 'working').length;
  const mins = w.endTs ? Math.max(1, Math.round((w.endTs - w.startTs) / 60000)) : 0;

  return (
    <div className="screen">
      <div className="summary-pop" style={{ textAlign: 'center', padding: '56px 0 8px' }}>
        <h1 className="display" style={{ fontSize: 40 }}>
          {t('summary.title')}
        </h1>
        <div
          className="display"
          style={{ fontSize: 64, color: 'var(--accent-text)', marginTop: 12 }}
        >
          {volume.toLocaleString(i18n.language)}
        </div>
        <div className="muted">{t('summary.volume', { unit: weightLabel(unit) })}</div>
        <div className="mono small muted" style={{ marginTop: 8 }}>
          {t('summary.workingSetCount', { count: workingSetCount })} ·{' '}
          {t('summary.duration', { min: mins })}
        </div>
      </div>

      {diff !== null && (
        <div
          className={`banner ${diff >= 0 ? 'banner-good' : 'banner-warn'}`}
          style={{ textAlign: 'center', marginTop: 14 }}
        >
          {t(diff >= 0 ? 'summary.vsLastUp' : 'summary.vsLastDown', {
            diff: Math.abs(diff).toLocaleString(i18n.language),
            unit: weightLabel(unit),
            day: w.dayLabel ?? '',
          })}
        </div>
      )}

      <div className="stack" style={{ marginTop: 14 }}>
        {prs.map((id, i) => (
          <div
            key={id}
            className="banner banner-good"
            style={{ animationDelay: `${0.12 + i * 0.07}s` }}
          >
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
            <button
              className="btn btn-accent"
              style={{ flex: 1 }}
              onClick={() => void applyRoutineChanges()}
            >
              {t('summary.updateRoutineYes')}
            </button>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={dismissRoutineChanges}>
              {t('summary.updateRoutineNo')}
            </button>
          </div>
        </div>
      )}

      <button
        className="btn btn-solid btn-block btn-big"
        style={{ marginTop: 24 }}
        onClick={() => nav({ view: 'home' })}
      >
        {t('summary.home')}
      </button>
    </div>
  );
}
