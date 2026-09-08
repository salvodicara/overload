import { useTranslation } from 'react-i18next';
import { PageHeader } from '../components/PageHeader';
import { IconBack, IconForward } from '../components/Icons';
import { useCatalog } from '../hooks/useCatalog';
import { exerciseName } from '../lib/exercises';
import { trackingOf } from '../lib/types';
import { formatWeight } from '../lib/units';
import { useStore } from '../state/useStore';
import '../theme/routine-detail.css';

export function RoutineDetail({ id }: { id: string }) {
  const { t, i18n } = useTranslation();
  useCatalog();
  const { routines, active, settings, nav, startWorkout } = useStore();
  const routine = routines.find((item) => item.id === id);
  if (!routine)
    return (
      <div className="screen">
        <button className="btn" onClick={() => history.back()}>
          {t('common.back')}
        </button>
      </div>
    );
  return (
    <div className="screen routine-preview">
      <PageHeader
        className="detail-page-header"
        title={routine.name}
        back={{ label: t('common.back'), icon: <IconBack />, onClick: () => history.back() }}
        action={
          <button className="btn btn-ghost" onClick={() => nav({ view: 'routineEditor', id })}>
            {t('routines.editAction')}
          </button>
        }
      />
      <p className="muted">{t('home.exercises', { count: routine.exercises.length })}</p>
      <button
        className="btn btn-accent btn-block btn-big"
        disabled={!active && routine.exercises.length === 0}
        onClick={() => (active ? nav({ view: 'workout' }) : startWorkout(id))}
      >
        {t(active ? 'home.resume' : 'home.start')}
      </button>
      {routine.warmup && <p className="card card-pad routine-preview__note">{routine.warmup}</p>}
      {routine.exercises.length === 0 && <p className="muted">{t('routines.emptyPreview')}</p>}
      <ol className="routine-preview__list">
        {routine.exercises.map((exercise, index) => (
          <li className="card card-pad" key={exercise.occurrenceId ?? index}>
            <button
              className="routine-preview__exercise"
              onClick={() => nav({ view: 'exercise', id: exercise.exerciseId, from: 'routine' })}
            >
              <strong>{exerciseName(exercise.exerciseId, i18n.language)}</strong>
              <IconForward />
            </button>
            <ol
              className="routine-preview__sets"
              style={
                !exercise.setTargets?.length ? { listStyle: 'none', paddingLeft: 0 } : undefined
              }
            >
              {Array.from(
                { length: exercise.setTargets?.length ? exercise.sets : 1 },
                (_, setIndex) => {
                  const target = exercise.setTargets?.[setIndex] ?? exercise;
                  return (
                    <li key={setIndex}>
                      {!exercise.setTargets?.length && <>{exercise.sets} × </>}
                      {target.repMax === null
                        ? String(target.repMin) + '+'
                        : target.repMin === target.repMax
                          ? target.repMin
                          : String(target.repMin) + '–' + target.repMax}{' '}
                      {t(
                        trackingOf(exercise.tracking) === 'duration'
                          ? 'workout.seconds'
                          : 'workout.reps',
                      )}
                      {trackingOf(exercise.tracking) === 'weight_reps' &&
                        target.startWeightKg != null && (
                          <>
                            {' '}
                            ·{' '}
                            {formatWeight(
                              target.startWeightKg,
                              settings.unit ?? 'kg',
                              i18n.language,
                            )}
                          </>
                        )}
                    </li>
                  );
                },
              )}
            </ol>
            <p className="small muted">
              {t('routines.restPreview', { seconds: exercise.restSec })}
            </p>
            {!!exercise.warmupSets?.length && (
              <p className="small muted">
                {t('routines.warmupCount', { count: exercise.warmupSets.length })}
              </p>
            )}
            {exercise.note && <p className="small routine-preview__note">{exercise.note}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}
