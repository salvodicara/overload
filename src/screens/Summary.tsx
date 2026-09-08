import { useTranslation } from 'react-i18next';
import { useCatalog } from '../hooks/useCatalog';
import { exerciseName } from '../lib/exercises';
import { kindOf } from '../lib/types';
import { normalizeRoutineOccurrences } from '../lib/workoutOccurrences';
import { displayVolume, weightLabel } from '../lib/units';
import { useStore } from '../state/useStore';
import '../theme/workout-surfaces.css';

export function Summary({ workoutId }: { workoutId: string }) {
  const { t, i18n } = useTranslation();
  useCatalog();
  const { settings, workouts, routines } = useStore();
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
  const durationSec = w.durationSec ?? (w.endTs ? (w.endTs - w.startTs) / 1000 : 0);
  const mins = durationSec > 0 ? Math.max(1, Math.round(durationSec / 60)) : 0;
  const original = routines.find((routine) => routine.id === pending?.routineId);
  const before = original ? normalizeRoutineOccurrences(original).exercises : [];
  const after = pending?.nextRoutine?.exercises ?? [];
  const changes = pending?.nextRoutine
    ? [
        ...after.flatMap((exercise, index) => {
          const oldIndex = before.findIndex((item) => item.occurrenceId === exercise.occurrenceId);
          const old = before[oldIndex];
          if (
            old &&
            oldIndex === index &&
            old.exerciseId === exercise.exerciseId &&
            old.sets === exercise.sets &&
            old.restSec === exercise.restSec
          )
            return [];
          return [{ before: old, after: exercise, oldIndex, index }];
        }),
        ...before.flatMap((exercise, oldIndex) =>
          after.some((item) => item.occurrenceId === exercise.occurrenceId)
            ? []
            : [{ before: exercise, after: undefined, oldIndex, index: -1 }],
        ),
      ]
    : [];
  const prescription = (exercise: (typeof before)[number], index: number): string =>
    String(index + 1) +
    '. ' +
    exerciseName(exercise.exerciseId, i18n.language) +
    ' · ' +
    t('summary.workingSetCount', { count: exercise.sets }) +
    ' · ' +
    t('routines.restPreview', { seconds: exercise.restSec });

  return (
    <div className="screen">
      <div className="summary-pop" style={{ textAlign: 'center', padding: '56px 0 8px' }}>
        <h1 className="display" style={{ fontSize: 40 }}>
          {t('summary.title')}
        </h1>
        <div
          className="display summary-volume"
          style={{ color: 'var(--accent-text)', marginTop: 12 }}
        >
          {volume.toLocaleString(i18n.language)}{' '}
          <span style={{ fontSize: '0.42em' }}>{weightLabel(unit)}</span>
        </div>
        <div className="muted">{t('summary.volume')}</div>
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
            {t(changes.length ? 'summary.reviewChanges' : 'summary.updateRoutineBody', {
              n: pending.items.length,
            })}
          </span>
          {changes.map((change, index) => (
            <div key={index} className="small" style={{ overflowWrap: 'anywhere' }}>
              {change.before && (
                <p>
                  <span className="muted">{t('summary.before')}: </span>
                  {prescription(change.before, change.oldIndex)}
                </p>
              )}
              <p>
                <strong>{t('summary.after')}: </strong>
                {change.after ? prescription(change.after, change.index) : t('summary.removed')}
              </p>
            </div>
          ))}
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
        className="btn btn-ghost btn-block"
        style={{ marginTop: 24 }}
        onClick={() => nav({ view: 'workoutDetail', id: w.id })}
      >
        {t('summary.viewWorkout')}
      </button>
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
