import { createRef, useEffect, useRef, useState, type FocusEvent, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '../components/BottomSheet';
import { IconCheck, IconDown, IconMinus, IconNote } from '../components/Icons';
import { NoteEditor } from '../components/NoteEditor';
import { PageHeader } from '../components/PageHeader';
import { useCatalog } from '../hooks/useCatalog';
import { exerciseName } from '../lib/exercises';
import { fmtDate, formatPreviousSet, previousSets } from '../lib/format';
import { exerciseJournal } from '../lib/notes';
import type { TrackingType } from '../lib/types';
import { canonicalWeight, displayWeight, formatWeight, weightLabel } from '../lib/units';
import { useStore } from '../state/useStore';

function fmtRest(sec: number): string {
  if (sec < 60) return `${sec}″`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m}′${s}″` : `${m}′`;
}

function selectNumericValue(event: FocusEvent<HTMLInputElement>): void {
  event.currentTarget.select();
}

function rangeLabel(min: number, max: number | null): string {
  return max === null ? `${min}+` : min === max ? String(min) : `${min}–${max}`;
}

function tableMode(tracking: TrackingType): string {
  return tracking.replace('_', '-');
}

type PendingSetRemoval = {
  exercise: string;
  exerciseIndex: number;
  setNumber: number;
};

export function Workout() {
  const { t, i18n } = useTranslation();
  useCatalog();
  const { active, routines, workouts, settings } = useStore();
  const nav = useStore((s) => s.nav);
  const updateSet = useStore((s) => s.updateSet);
  const toggleSetKind = useStore((s) => s.toggleSetKind);
  const toggleDone = useStore((s) => s.toggleDone);
  const addSet = useStore((s) => s.addSet);
  const removeSet = useStore((s) => s.removeSet);
  const abandon = useStore((s) => s.abandonWorkout);
  const finish = useStore((s) => s.finishWorkout);
  const notes = useStore((s) => s.notes);
  const updateSessionNote = useStore((s) => s.updateSessionNote);
  const setRestOverride = useStore((s) => s.setRestOverride);
  const [confirming, setConfirming] = useState(false);
  const [pendingSetRemoval, setPendingSetRemoval] = useState<PendingSetRemoval | null>(null);
  const [editingRest, setEditingRest] = useState<number | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const cancelAbandonRef = useRef<HTMLButtonElement>(null);
  const cancelSetRemovalRef = useRef<HTMLButtonElement>(null);
  const addSetRefs = useRef<Array<RefObject<HTMLButtonElement | null>>>([]);
  const setRemovalCommittedRef = useRef(false);
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const routine = routines.find((r) => r.id === active?.routineId);
  const broken = routines.length > 0 && (!active || !routine);
  useEffect(() => {
    if (broken) abandon();
  }, [broken, abandon]);
  if (!active || !routine) return null;

  const unit = settings.unit ?? 'kg';
  const elapsed = Math.floor((Date.now() - active.startTs) / 1000);

  return (
    <div className="screen workout-screen">
      <PageHeader
        className="workout-header"
        sticky
        title={<span className="workout-header__title">{routine.name}</span>}
        eyebrow={
          <span className="workout-header__elapsed">
            {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
          </span>
        }
        back={{
          label: t('workout.minimize'),
          icon: <IconDown />,
          onClick: () => nav({ view: 'train' }),
        }}
        action={
          <button
            className="btn btn-accent workout-header__finish"
            aria-label={t('workout.finish')}
            onClick={() => void finish()}
          >
            {t('workout.finishShort')}
          </button>
        }
      />

      {routine.warmup && (
        <details className="workout-preparation">
          <summary>{t('workout.warmup')}</summary>
          <p>{routine.warmup}</p>
        </details>
      )}

      <div className="stack workout-exercises">
        {active.ex.map((exercise, exerciseIndex) => {
          // Active exercises preserve routine order, so the index identifies the exact
          // prescription even when the same catalog exercise appears more than once.
          const prescription = routine.exercises[exerciseIndex];
          const name = exerciseName(exercise.exerciseId, i18n.language);
          const priorWorkingSets = previousSets(workouts, exercise.exerciseId, routine.id);
          const firstWorkingWeight =
            exercise.sets.find((set) => set.kind === 'working')?.weightKg ?? 0;
          const target = prescription
            ? prescription.setTargets?.length
              ? prescription.setTargets
                  .map(
                    (setTarget) =>
                      `${rangeLabel(setTarget.repMin, setTarget.repMax)}${
                        exercise.tracking === 'duration' ? 's' : ''
                      }`,
                  )
                  .join(' / ')
              : `${prescription.sets} × ${rangeLabel(prescription.repMin, prescription.repMax)}${
                  exercise.tracking === 'duration' ? 's' : ''
                }`
            : null;
          const progression =
            exercise.tracking === 'weight_reps'
              ? t(exercise.hintKey, {
                  kg: firstWorkingWeight,
                  weight: formatWeight(firstWorkingWeight, unit, i18n.language),
                })
              : exercise.tracking === 'duration'
                ? t('workout.durationTarget')
                : t('workout.repsTarget');
          const addSetRef =
            addSetRefs.current[exerciseIndex] ??
            (addSetRefs.current[exerciseIndex] = createRef<HTMLButtonElement>());
          let workingIndex = 0;

          return (
            <section key={exercise.exerciseId} className="exercise-block card">
              <div className="card-pad exercise-block__header">
                <button
                  className="exercise-block__name"
                  onClick={() =>
                    nav({ view: 'exercise', id: exercise.exerciseId, from: 'workout' })
                  }
                >
                  {name}
                </button>
                <div className="exercise-block__meta">
                  {target && <span>{target}</span>}
                  {prescription && (
                    <button
                      className="exercise-block__rest"
                      aria-expanded={editingRest === exerciseIndex}
                      onClick={() =>
                        setEditingRest(editingRest === exerciseIndex ? null : exerciseIndex)
                      }
                    >
                      {t('workout.rest', {
                        time: fmtRest(exercise.restOverride ?? prescription.restSec),
                      })}{' '}
                      ▾
                    </button>
                  )}
                  <span>{progression}</span>
                </div>

                {editingRest === exerciseIndex && prescription && (
                  <div className="exercise-block__rest-editor">
                    <button
                      className="iconbtn rest-adjust"
                      aria-label={t('workout.restLess')}
                      disabled={(exercise.restOverride ?? prescription.restSec) <= 15}
                      onClick={() =>
                        setRestOverride(
                          exerciseIndex,
                          Math.max(15, (exercise.restOverride ?? prescription.restSec) - 15),
                        )
                      }
                    >
                      <IconMinus width={14} height={14} />
                    </button>
                    <span className="mono exercise-block__rest-value">
                      {fmtRest(exercise.restOverride ?? prescription.restSec)}
                    </span>
                    <button
                      className="iconbtn rest-adjust"
                      aria-label={t('workout.restMore')}
                      onClick={() =>
                        setRestOverride(
                          exerciseIndex,
                          (exercise.restOverride ?? prescription.restSec) + 15,
                        )
                      }
                    >
                      +
                    </button>
                    <button
                      className="btn btn-ghost rest-adjust-done"
                      onClick={() => setEditingRest(null)}
                    >
                      {t('common.done')}
                    </button>
                  </div>
                )}

                {prescription?.note && (
                  <aside className="workout-coach-note">
                    <span className="mono small">{t('notes.coach')}</span>
                    <p>{prescription.note}</p>
                  </aside>
                )}

                {(() => {
                  const note = notes.find((item) => item.id === exercise.exerciseId);
                  const sessionKey = `${exerciseIndex}:session`;
                  const sessionExpanded = expandedNotes[sessionKey] ?? false;
                  const sessionLabelId = `workout-note-${exerciseIndex}-session-label`;
                  const sessionContentId = `workout-note-${exerciseIndex}-session-content`;
                  const previousSession = exerciseJournal(workouts, note, exercise.exerciseId).find(
                    (entry) => entry.id.startsWith('workout:'),
                  );
                  const toggleNote = (key: string) =>
                    setExpandedNotes((current) => ({ ...current, [key]: !current[key] }));
                  return (
                    <div className="workout-notes">
                      <section className="workout-note">
                        <button
                          type="button"
                          className="workout-note__trigger"
                          aria-expanded={sessionExpanded}
                          aria-controls={sessionContentId}
                          onClick={() => toggleNote(sessionKey)}
                        >
                          <IconNote width={16} height={16} aria-hidden />
                          <span className="workout-note__copy">
                            <span id={sessionLabelId} className="workout-note__scope">
                              {t('notes.session')}
                            </span>
                            <span className="workout-note__summary">
                              {exercise.sessionNote || t('notes.sessionPlaceholder')}
                            </span>
                          </span>
                          <span className="workout-note__chevron" aria-hidden="true">
                            ▾
                          </span>
                        </button>
                        <div
                          id={sessionContentId}
                          className="workout-note__content"
                          role="group"
                          hidden={!sessionExpanded}
                        >
                          {sessionExpanded && (
                            <>
                              {previousSession && (
                                <p className="workout-note__context">
                                  <span>
                                    {t('notes.previousSession', {
                                      date: fmtDate(previousSession.date, i18n.language),
                                    })}
                                  </span>
                                  <span>{previousSession.text}</span>
                                </p>
                              )}
                              <NoteEditor
                                key={`session:${exerciseIndex}`}
                                initial={exercise.sessionNote ?? ''}
                                placeholder={t('notes.sessionPlaceholder')}
                                labelledBy={sessionLabelId}
                                doneLabel={t('notes.done')}
                                onChangeText={(text) => updateSessionNote(exerciseIndex, text)}
                                onDone={() => toggleNote(sessionKey)}
                              />
                            </>
                          )}
                        </div>
                      </section>
                    </div>
                  );
                })()}
              </div>

              <div
                className={`set-table set-table--${tableMode(exercise.tracking)}`}
                aria-label={t('workout.setsFor', { exercise: name })}
              >
                <div className="set-grid set-table__header mono muted" aria-hidden="true">
                  <span>{t('workout.set')}</span>
                  <span>{t('workout.previous')}</span>
                  {exercise.tracking === 'weight_reps' && <span>{weightLabel(unit)}</span>}
                  {exercise.tracking !== 'duration' && <span>{t('workout.reps')}</span>}
                  {exercise.tracking === 'duration' && <span>{t('workout.seconds')}</span>}
                  <span>
                    <IconCheck width={13} height={13} />
                  </span>
                </div>

                {exercise.sets.map((set, setIndex) => {
                  const isWarmup = set.kind === 'warmup';
                  const workingNumber = workingIndex + 1;
                  const previous = isWarmup ? undefined : priorWorkingSets[workingIndex];
                  const previousValue = previous
                    ? formatPreviousSet(previous, exercise.tracking, unit, false)
                    : t('workout.noPrevious');
                  if (!isWarmup) workingIndex += 1;
                  const setNumber = setIndex + 1;
                  return (
                    <div
                      key={setIndex}
                      className={`set-grid set-row setrow${set.done ? ' done' : ''}`}
                      role="group"
                      aria-label={t('workout.setRow', { set: setNumber, exercise: name })}
                    >
                      <button
                        className="set-kind-toggle mono"
                        aria-pressed={isWarmup}
                        aria-label={
                          isWarmup
                            ? t('workout.markWorking', { set: setNumber })
                            : t('workout.markWarmup', { set: setNumber })
                        }
                        onClick={() => toggleSetKind(exerciseIndex, setIndex)}
                      >
                        {isWarmup ? 'W' : workingNumber}
                      </button>
                      <span
                        className="set-previous mono"
                        aria-label={t('workout.previousValue', {
                          set: setNumber,
                          value: previousValue,
                        })}
                      >
                        {previous ? previousValue : '—'}
                      </span>
                      {exercise.tracking === 'weight_reps' && (
                        <input
                          type="number"
                          inputMode="decimal"
                          step={unit === 'kg' ? 0.5 : 1}
                          min={0}
                          aria-label={t('workout.loadInput', {
                            set: setNumber,
                            unit: weightLabel(unit),
                          })}
                          value={set.weightKg === null ? '' : displayWeight(set.weightKg, unit)}
                          onFocus={selectNumericValue}
                          onChange={(event) =>
                            updateSet(exerciseIndex, setIndex, {
                              weightKg:
                                event.target.value === ''
                                  ? null
                                  : canonicalWeight(Number(event.target.value), unit),
                            })
                          }
                        />
                      )}
                      {exercise.tracking !== 'duration' && (
                        <input
                          type="number"
                          inputMode="numeric"
                          step={1}
                          min={0}
                          aria-label={t('workout.repsInput', { set: setNumber })}
                          value={set.reps ?? ''}
                          onFocus={selectNumericValue}
                          onChange={(event) =>
                            updateSet(exerciseIndex, setIndex, {
                              reps: event.target.value === '' ? null : Number(event.target.value),
                            })
                          }
                        />
                      )}
                      {exercise.tracking === 'duration' && (
                        <input
                          type="number"
                          inputMode="numeric"
                          step={1}
                          min={0}
                          aria-label={t('workout.secondsInput', { set: setNumber })}
                          value={set.durationSec ?? ''}
                          onFocus={selectNumericValue}
                          onChange={(event) =>
                            updateSet(exerciseIndex, setIndex, {
                              durationSec:
                                event.target.value === '' ? null : Number(event.target.value),
                            })
                          }
                        />
                      )}
                      <button
                        className="setcheck"
                        aria-pressed={set.done}
                        aria-label={`${t('workout.set')} ${setNumber}`}
                        onClick={() => toggleDone(exerciseIndex, setIndex)}
                      >
                        <IconCheck />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="exercise-block__set-actions">
                <button ref={addSetRef} className="addset" onClick={() => addSet(exerciseIndex)}>
                  {t('workout.addSet')}
                </button>
                {exercise.sets.length > 1 && (
                  <button
                    className="addset exercise-block__remove-set"
                    onClick={() => {
                      setRemovalCommittedRef.current = false;
                      setPendingSetRemoval({
                        exercise: name,
                        exerciseIndex,
                        setNumber: exercise.sets.length,
                      });
                    }}
                    aria-label={t('workout.removeSet')}
                  >
                    <IconMinus />
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <details className="workout-actions">
        <summary>{t('workout.moreActions')}</summary>
        <button className="btn btn-danger btn-block" onClick={() => setConfirming(true)}>
          {t('workout.abandonConfirm')}
        </button>
      </details>

      {pendingSetRemoval && (
        <BottomSheet
          open
          title={t('workout.removeSetTitle', {
            set: pendingSetRemoval.setNumber,
            exercise: pendingSetRemoval.exercise,
          })}
          initialFocusRef={cancelSetRemovalRef}
          fallbackFocusRef={addSetRefs.current[pendingSetRemoval.exerciseIndex]}
          onClose={() => setPendingSetRemoval(null)}
        >
          <span className="muted small">{t('workout.removeSetBody')}</span>
          <button
            className="btn btn-danger btn-block"
            onClick={() => {
              if (setRemovalCommittedRef.current) return;
              setRemovalCommittedRef.current = true;
              const exerciseIndex = pendingSetRemoval.exerciseIndex;
              setPendingSetRemoval(null);
              removeSet(exerciseIndex);
            }}
          >
            {t('workout.removeSet')}
          </button>
          <button
            ref={cancelSetRemovalRef}
            className="btn btn-ghost btn-block"
            onClick={() => setPendingSetRemoval(null)}
          >
            {t('workout.cancel')}
          </button>
        </BottomSheet>
      )}

      {confirming && (
        <BottomSheet
          open
          title={t('workout.abandonTitle')}
          initialFocusRef={cancelAbandonRef}
          onClose={() => setConfirming(false)}
        >
          <span className="muted small">{t('workout.abandonBody')}</span>
          <button className="btn btn-danger btn-block" onClick={abandon}>
            {t('workout.abandonConfirm')}
          </button>
          <button
            ref={cancelAbandonRef}
            className="btn btn-ghost btn-block"
            onClick={() => setConfirming(false)}
          >
            {t('workout.cancel')}
          </button>
        </BottomSheet>
      )}
    </div>
  );
}
