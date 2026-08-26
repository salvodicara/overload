import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '../components/BottomSheet';
import { IconBack, IconMinus, IconMore } from '../components/Icons';
import { PageHeader } from '../components/PageHeader';
import { useCatalog } from '../hooks/useCatalog';
import { exerciseName, searchExercises } from '../lib/exercises';
import { formatPreviousSet, previousSets } from '../lib/format';
import { kindOf, trackingOf, type SetLog } from '../lib/types';
import { canonicalWeight, displayWeight, weightLabel } from '../lib/units';
import {
  draftFromWorkout,
  removeExerciseFromDraft,
  removeSetFromDraft,
  validateWorkoutDraft,
  type WorkoutDraft,
} from '../lib/workoutEditing';
import { continueAccountAction, useStore } from '../state/useStore';

type DraftGroup = { key: string; exerciseId: string; sets: { set: SetLog; index: number }[] };

function groupsFor(draft: WorkoutDraft): DraftGroup[] {
  const groups: DraftGroup[] = [];
  for (const [index, set] of draft.sets.entries()) {
    const key = set.exerciseInstanceId ?? set.exerciseId;
    let group = groups.find((item) => item.key === key);
    if (!group) {
      group = { key, exerciseId: set.exerciseId, sets: [] };
      groups.push(group);
    }
    group.sets.push({ set, index });
  }
  return groups;
}

export function WorkoutEditor({ id }: { id: string }) {
  const { t, i18n } = useTranslation();
  useCatalog();
  const workout = useStore((state) => state.workouts.find((item) => item.id === id));
  const workouts = useStore((state) => state.workouts);
  const unit = useStore((state) => state.settings.unit ?? 'kg');
  const updateWorkout = useStore((state) => state.updateWorkout);
  const [draft, setDraft] = useState<WorkoutDraft | null>(() =>
    workout ? draftFromWorkout(workout) : null,
  );
  const [adding, setAdding] = useState(false);
  const [exerciseOptions, setExerciseOptions] = useState<DraftGroup | null>(null);
  const [query, setQuery] = useState('');
  const choices = useMemo(
    () => (adding ? searchExercises(query, null, i18n.language).slice(0, 40) : []),
    [adding, query, i18n.language],
  );
  if (!workout || !draft) return null;

  const groups = groupsFor(draft);
  const earlierWorkouts = workouts.filter(
    (candidate) =>
      candidate.id !== workout.id &&
      (candidate.date < workout.date ||
        (candidate.date === workout.date && candidate.startTs < workout.startTs)),
  );
  const errors = validateWorkoutDraft(draft);
  const updateSet = (index: number, patch: Partial<SetLog>): void =>
    setDraft((current) => {
      if (!current) return current;
      const sets = [...current.sets];
      sets[index] = { ...sets[index], ...patch };
      return { ...current, sets };
    });
  const removeSet = (index: number): void =>
    setDraft((current) => (current ? removeSetFromDraft(current, index) : current));
  const removeExercise = (key: string): void =>
    setDraft((current) => (current ? removeExerciseFromDraft(current, key) : current));

  return (
    <div className="screen workout-editor-screen">
      <PageHeader
        className="workout-editor-header"
        title={t('history.editWorkout')}
        back={{ label: t('common.back'), icon: <IconBack />, onClick: () => history.back() }}
        action={
          <button
            className="btn btn-accent"
            disabled={errors.length > 0}
            onClick={() =>
              void continueAccountAction(updateWorkout(id, draft), () => history.back())
            }
          >
            {t('common.save')}
          </button>
        }
      />

      <section className="workout-editor-meta">
        <label>
          <span>{t('history.routineName')}</span>
          <input
            value={draft.dayLabel}
            onChange={(event) => setDraft({ ...draft, dayLabel: event.target.value })}
          />
        </label>
        <div className="workout-editor-meta__row">
          <label>
            <span>{t('history.date')}</span>
            <input
              type="date"
              value={draft.date}
              onChange={(event) => setDraft({ ...draft, date: event.target.value })}
            />
          </label>
          <label>
            <span>{t('history.startTime')}</span>
            <input
              type="time"
              value={draft.startTime}
              onChange={(event) => setDraft({ ...draft, startTime: event.target.value })}
            />
          </label>
          <label>
            <span>{t('history.durationMinutes')}</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={draft.durationMin}
              onChange={(event) => setDraft({ ...draft, durationMin: Number(event.target.value) })}
            />
          </label>
        </div>
        <label>
          <span>{t('history.overallNote')}</span>
          <textarea
            rows={2}
            value={draft.note}
            onInput={(event) => {
              event.currentTarget.style.height = 'auto';
              event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
            }}
            onChange={(event) => setDraft({ ...draft, note: event.target.value })}
          />
        </label>
      </section>

      <div className="stack workout-editor-exercises">
        {groups.map((group) => {
          const name = exerciseName(group.exerciseId, i18n.language);
          const tracking = trackingOf(group.sets[0]?.set.tracking);
          const priorWorkingSets = previousSets(
            earlierWorkouts,
            group.exerciseId,
            workout.routineId,
          );
          let workingIndex = 0;
          return (
            <section key={group.key} className="card workout-editor-exercise">
              <div className="workout-editor-exercise__heading">
                <strong>{name}</strong>
                <button
                  type="button"
                  className="iconbtn workout-editor-exercise__options"
                  aria-label={t('workout.exerciseOptions')}
                  onClick={() => setExerciseOptions(group)}
                >
                  <IconMore />
                </button>
              </div>
              <div
                className={`set-table set-table--${tracking.replace('_', '-')}`}
                aria-label={t('workout.setsFor', { exercise: name })}
              >
                <div
                  className="set-grid set-table__header workout-editor-set-header mono muted"
                  aria-hidden="true"
                >
                  <span>{t('workout.set')}</span>
                  <span>{t('workout.previous')}</span>
                  {tracking === 'weight_reps' && <span>{weightLabel(unit)}</span>}
                  {tracking !== 'duration' && <span>{t('workout.reps')}</span>}
                  {tracking === 'duration' && <span>{t('workout.seconds')}</span>}
                  <span />
                </div>
                {group.sets.map(({ set, index }, row) => {
                  const warmup = kindOf(set.kind) === 'warmup';
                  const previous = warmup ? undefined : priorWorkingSets[workingIndex++];
                  const previousLabel = previous
                    ? formatPreviousSet(previous, tracking, unit, false)
                    : '—';
                  return (
                    <div
                      key={index}
                      className="set-grid set-row workout-editor-set"
                      role="group"
                      aria-label={t('workout.setRow', { set: row + 1, exercise: name })}
                    >
                      <span className="mono workout-editor-set__number">
                        {warmup ? 'W' : workingIndex}
                      </span>
                      <span
                        className="set-previous mono"
                        aria-label={`${t('workout.previous')}: ${previousLabel}`}
                      >
                        {previousLabel}
                      </span>
                      {tracking === 'weight_reps' && (
                        <input
                          type="number"
                          inputMode="decimal"
                          aria-label={t('workout.loadInput', {
                            set: row + 1,
                            unit: weightLabel(unit),
                          })}
                          value={displayWeight(set.weightKg, unit)}
                          onFocus={(event) => event.currentTarget.select()}
                          onChange={(event) =>
                            updateSet(index, {
                              weightKg: canonicalWeight(Number(event.target.value), unit),
                            })
                          }
                        />
                      )}
                      {tracking !== 'duration' ? (
                        <input
                          type="number"
                          inputMode="numeric"
                          aria-label={t('workout.repsInput', { set: row + 1 })}
                          value={set.reps ?? ''}
                          onFocus={(event) => event.currentTarget.select()}
                          onChange={(event) =>
                            updateSet(index, {
                              reps: Number(event.target.value),
                            })
                          }
                        />
                      ) : (
                        <input
                          type="number"
                          inputMode="numeric"
                          aria-label={t('workout.secondsInput', { set: row + 1 })}
                          value={set.durationSec ?? ''}
                          onFocus={(event) => event.currentTarget.select()}
                          onChange={(event) =>
                            updateSet(index, {
                              durationSec:
                                event.target.value === '' ? undefined : Number(event.target.value),
                            })
                          }
                        />
                      )}
                      <button
                        type="button"
                        className="iconbtn workout-editor-set__remove"
                        aria-label={t('history.removeSet', { n: row + 1 })}
                        onClick={() => removeSet(index)}
                      >
                        <IconMinus />
                      </button>
                    </div>
                  );
                })}
              </div>
              <button
                className="addset"
                onClick={() => {
                  const last = group.sets.at(-1)?.set;
                  if (!last) return;
                  setDraft({ ...draft, sets: [...draft.sets, { ...last, isPr: undefined }] });
                }}
              >
                {t('workout.addSet')}
              </button>
            </section>
          );
        })}
      </div>

      <button className="btn btn-ghost btn-block" onClick={() => setAdding(true)}>
        {t('workout.addExercise')}
      </button>
      {errors.includes('sets') && <p className="form-error">{t('history.needOneSet')}</p>}

      {exerciseOptions && (
        <BottomSheet
          open
          title={t('workout.exerciseOptions')}
          onClose={() => setExerciseOptions(null)}
        >
          <p className="muted small">{exerciseName(exerciseOptions.exerciseId, i18n.language)}</p>
          <button
            type="button"
            className="btn btn-danger btn-block"
            onClick={() => {
              removeExercise(exerciseOptions.key);
              setExerciseOptions(null);
            }}
          >
            {t('history.removeExercise')}
          </button>
        </BottomSheet>
      )}

      {adding && (
        <BottomSheet open title={t('library.pickTitle')} onClose={() => setAdding(false)}>
          <input
            type="search"
            autoFocus
            placeholder={t('library.search')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="workout-editor-picker">
            {choices.map((exercise) => (
              <button
                key={exercise.id}
                onClick={() => {
                  const instance = `wx:${crypto.randomUUID()}`;
                  setDraft({
                    ...draft,
                    exerciseOrder: [...draft.exerciseOrder, instance],
                    sets: [
                      ...draft.sets,
                      {
                        exerciseId: exercise.id,
                        exerciseInstanceId: instance,
                        weightKg: 0,
                        reps: 8,
                        done: true,
                        tracking: 'weight_reps',
                        kind: 'working',
                      },
                    ],
                  });
                  setAdding(false);
                  setQuery('');
                }}
              >
                {exerciseName(exercise.id, i18n.language)}
              </button>
            ))}
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
