import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '../components/BottomSheet';
import { IconBack, IconMinus } from '../components/Icons';
import { PageHeader } from '../components/PageHeader';
import { useCatalog } from '../hooks/useCatalog';
import { exerciseName, searchExercises } from '../lib/exercises';
import { kindOf, trackingOf, type SetLog } from '../lib/types';
import { canonicalWeight, displayWeight, weightLabel } from '../lib/units';
import {
  draftFromWorkout,
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
  const unit = useStore((state) => state.settings.unit ?? 'kg');
  const updateWorkout = useStore((state) => state.updateWorkout);
  const [draft, setDraft] = useState<WorkoutDraft | null>(() =>
    workout ? draftFromWorkout(workout) : null,
  );
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const choices = useMemo(
    () => (adding ? searchExercises(query, null, i18n.language).slice(0, 40) : []),
    [adding, query, i18n.language],
  );
  if (!workout || !draft) return null;

  const groups = groupsFor(draft);
  const errors = validateWorkoutDraft(draft);
  const updateSet = (index: number, patch: Partial<SetLog>): void =>
    setDraft((current) => {
      if (!current) return current;
      const sets = [...current.sets];
      sets[index] = { ...sets[index], ...patch };
      return { ...current, sets };
    });
  const removeSet = (index: number): void =>
    setDraft((current) =>
      current ? { ...current, sets: current.sets.filter((_, item) => item !== index) } : current,
    );

  return (
    <div className="screen workout-editor-screen">
      <PageHeader
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
        {groups.map((group) => (
          <section key={group.key} className="card workout-editor-exercise">
            <div className="workout-editor-exercise__heading">
              <strong>{exerciseName(group.exerciseId, i18n.language)}</strong>
              <button
                className="btn btn-ghost"
                onClick={() =>
                  setDraft({
                    ...draft,
                    sets: draft.sets.filter(
                      (set) => (set.exerciseInstanceId ?? set.exerciseId) !== group.key,
                    ),
                  })
                }
              >
                {t('history.removeExercise')}
              </button>
            </div>
            <div className="workout-editor-set-list">
              {group.sets.map(({ set, index }, row) => (
                <div key={index} className="workout-editor-set">
                  <span className="mono">{kindOf(set.kind) === 'warmup' ? 'W' : row + 1}</span>
                  {trackingOf(set.tracking) === 'weight_reps' && (
                    <label>
                      <span>{weightLabel(unit)}</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={displayWeight(set.weightKg, unit)}
                        onChange={(event) =>
                          updateSet(index, {
                            weightKg: canonicalWeight(Number(event.target.value), unit),
                          })
                        }
                      />
                    </label>
                  )}
                  {trackingOf(set.tracking) !== 'duration' ? (
                    <label>
                      <span>{t('workout.reps')}</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={set.reps}
                        onChange={(event) => updateSet(index, { reps: Number(event.target.value) })}
                      />
                    </label>
                  ) : (
                    <label>
                      <span>{t('workout.seconds')}</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={set.durationSec ?? 0}
                        onChange={(event) =>
                          updateSet(index, { durationSec: Number(event.target.value) })
                        }
                      />
                    </label>
                  )}
                  <button
                    className="iconbtn"
                    aria-label={t('workout.removeSet')}
                    onClick={() => removeSet(index)}
                  >
                    <IconMinus />
                  </button>
                </div>
              ))}
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
        ))}
      </div>

      <button className="btn btn-ghost btn-block" onClick={() => setAdding(true)}>
        {t('workout.addExercise')}
      </button>
      {errors.includes('sets') && <p className="form-error">{t('history.needOneSet')}</p>}

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
