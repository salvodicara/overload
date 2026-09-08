import { useTranslation } from 'react-i18next';
import { IconForward } from './Icons';
import { exerciseName } from '../lib/exercises';
import { trackingOf, type Routine } from '../lib/types';
import { formatWeight } from '../lib/units';
import { useStore } from '../state/useStore';
import '../theme/routine-detail.css';

export function RoutinePrescription({
  routine,
  onExercise,
}: {
  routine: Pick<Routine, 'warmup' | 'exercises'>;
  onExercise?(id: string): void;
}) {
  const { t, i18n } = useTranslation();
  const settings = useStore((state) => state.settings);
  return (
    <>
      {routine.warmup && (
        <p className="card card-pad routine-preview__note" style={{ marginBlock: 12 }}>
          {routine.warmup}
        </p>
      )}
      {routine.exercises.length === 0 && <p className="muted">{t('routines.emptyPreview')}</p>}
      <ol className="routine-preview__list">
        {routine.exercises.map((exercise, index) => (
          <li
            className="card card-pad"
            key={exercise.occurrenceId ?? index}
            data-navigation-key={exercise.occurrenceId ?? String(index)}
          >
            {onExercise ? (
              <button
                className="routine-preview__exercise"
                onClick={() => onExercise(exercise.exerciseId)}
              >
                <strong>{exerciseName(exercise.exerciseId, i18n.language)}</strong>
                <IconForward />
              </button>
            ) : (
              <strong>{exerciseName(exercise.exerciseId, i18n.language)}</strong>
            )}
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
                        (target.startWeightKg ?? exercise.startWeightKg) != null && (
                          <>
                            {' '}
                            ·{' '}
                            {formatWeight(
                              (target.startWeightKg ?? exercise.startWeightKg)!,
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
            {exercise.incrementKg != null && trackingOf(exercise.tracking) === 'weight_reps' && (
              <p className="small muted">
                {t('routines.incrementPreview', {
                  weight: formatWeight(exercise.incrementKg, settings.unit ?? 'kg', i18n.language),
                })}
              </p>
            )}
            {!!exercise.warmupSets?.length && (
              <div className="small muted">
                <p>{t('history.warmupSets')}</p>
                <ul style={{ paddingLeft: 20 }}>
                  {exercise.warmupSets.map((set, warmupIndex) => (
                    <li key={warmupIndex}>
                      {trackingOf(exercise.tracking) === 'duration' ? (
                        <>
                          {set.durationSec ?? '—'} {t('workout.seconds')}
                        </>
                      ) : (
                        <>
                          {set.reps ?? '—'} {t('workout.reps')}
                          {set.weightKg != null && (
                            <>
                              {' '}
                              · {formatWeight(set.weightKg, settings.unit ?? 'kg', i18n.language)}
                            </>
                          )}
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {exercise.note && <p className="small routine-preview__note">{exercise.note}</p>}
          </li>
        ))}
      </ol>
    </>
  );
}
