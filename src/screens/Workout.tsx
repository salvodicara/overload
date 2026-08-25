import { useEffect, useRef, useState, type FocusEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { IconCheck, IconDown, IconMinus, IconNote } from '../components/Icons';
import { NoteEditor } from '../components/NoteEditor';
import { exerciseName } from '../lib/exercises';
import { fmtDate, formatPreviousSet, previousSets } from '../lib/format';
import { exerciseJournal } from '../lib/notes';
import type { TrackingType } from '../lib/types';
import { canonicalWeight, displayWeight, formatWeight, weightLabel } from '../lib/units';
import { isAccountActionCurrent, useStore } from '../state/useStore';

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

export function Workout() {
  const { t, i18n } = useTranslation();
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
  const queueTechniqueNote = useStore((s) => s.queueTechniqueNote);
  const saveTechniqueNote = useStore((s) => s.saveTechniqueNote);
  const updateSessionNote = useStore((s) => s.updateSessionNote);
  const setRestOverride = useStore((s) => s.setRestOverride);
  const [confirming, setConfirming] = useState(false);
  const [editingRest, setEditingRest] = useState<number | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [committingNotes, setCommittingNotes] = useState<Record<string, boolean>>({});
  const committingNoteKeys = useRef(new Set<string>());
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
      <header className="workout-header">
        <button
          className="iconbtn workout-header__minimize"
          aria-label={t('workout.minimize')}
          onClick={() => nav({ view: 'train' })}
        >
          <IconDown />
        </button>
        <div className="workout-header__copy">
          <h1 className="display workout-header__title">{routine.name}</h1>
          <span className="mono small muted workout-header__elapsed">
            {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
          </span>
        </div>
        <button className="btn btn-accent workout-header__finish" onClick={() => void finish()}>
          {t('workout.finish')}
        </button>
      </header>

      {routine.warmup && (
        <details className="workout-preparation">
          <summary>{t('workout.warmup')}</summary>
          <p>{routine.warmup}</p>
        </details>
      )}

      <div className="stack workout-exercises">
        {active.ex.map((exercise, exerciseIndex) => {
          const prescription = routine.exercises.find(
            (item) => item.exerciseId === exercise.exerciseId,
          );
          const name = exerciseName(exercise.exerciseId, i18n.language);
          const priorWorkingSets = previousSets(workouts, exercise.exerciseId);
          const firstWorkingWeight =
            exercise.sets.find((set) => set.kind === 'working')?.weightKg ?? 0;
          const target = prescription
            ? `${prescription.sets} × ${rangeLabel(prescription.repMin, prescription.repMax)}${
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
                      {t('momentum.done')}
                    </button>
                  </div>
                )}

                {(() => {
                  const note = notes.find((item) => item.id === exercise.exerciseId);
                  const techniqueKey = `${exerciseIndex}:technique`;
                  const sessionKey = `${exerciseIndex}:session`;
                  const techniqueExpanded = expandedNotes[techniqueKey] ?? false;
                  const sessionExpanded = expandedNotes[sessionKey] ?? false;
                  const techniqueCommitting = committingNotes[techniqueKey] ?? false;
                  const techniqueLabelId = `workout-note-${exerciseIndex}-technique-label`;
                  const sessionLabelId = `workout-note-${exerciseIndex}-session-label`;
                  const techniqueContentId = `workout-note-${exerciseIndex}-technique-content`;
                  const sessionContentId = `workout-note-${exerciseIndex}-session-content`;
                  const previousSession = exerciseJournal(workouts, note, exercise.exerciseId).find(
                    (entry) => entry.id.startsWith('workout:'),
                  );
                  const toggleNote = (key: string) =>
                    setExpandedNotes((current) => ({ ...current, [key]: !current[key] }));
                  const commitTechnique = async (text: string) => {
                    if (committingNoteKeys.current.has(techniqueKey)) return;
                    committingNoteKeys.current.add(techniqueKey);
                    setCommittingNotes((current) => ({ ...current, [techniqueKey]: true }));
                    try {
                      const result = await saveTechniqueNote(exercise.exerciseId, text);
                      if (isAccountActionCurrent(result)) {
                        setExpandedNotes((current) => ({ ...current, [techniqueKey]: false }));
                      }
                    } catch {
                      // Keep the draft open when local persistence fails.
                    } finally {
                      committingNoteKeys.current.delete(techniqueKey);
                      setCommittingNotes((current) => ({ ...current, [techniqueKey]: false }));
                    }
                  };
                  return (
                    <div className="workout-notes">
                      <section className="workout-note">
                        <button
                          type="button"
                          className="workout-note__trigger"
                          aria-expanded={techniqueExpanded}
                          aria-controls={techniqueContentId}
                          disabled={techniqueCommitting}
                          onClick={() => {
                            if (!committingNoteKeys.current.has(techniqueKey)) {
                              toggleNote(techniqueKey);
                            }
                          }}
                        >
                          <IconNote width={16} height={16} aria-hidden />
                          <span className="workout-note__copy">
                            <span id={techniqueLabelId} className="workout-note__scope">
                              {t('notes.technique')}
                            </span>
                            <span className="workout-note__summary">
                              {note?.technique || t('notes.techniquePlaceholder')}
                            </span>
                          </span>
                          <span className="workout-note__chevron" aria-hidden="true">
                            ▾
                          </span>
                        </button>
                        <div
                          id={techniqueContentId}
                          className="workout-note__content"
                          role="group"
                          hidden={!techniqueExpanded}
                        >
                          {techniqueExpanded && (
                            <NoteEditor
                              key={`technique:${exerciseIndex}`}
                              initial={note?.technique ?? ''}
                              placeholder={t('notes.techniquePlaceholder')}
                              labelledBy={techniqueLabelId}
                              doneLabel={t('notes.done')}
                              disabled={techniqueCommitting}
                              onChangeText={(text) => queueTechniqueNote(exercise.exerciseId, text)}
                              onDone={commitTechnique}
                            />
                          )}
                        </div>
                      </section>
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
                  if (!isWarmup) workingIndex += 1;
                  const setNumber = setIndex + 1;
                  return (
                    <div
                      key={setIndex}
                      className={`set-grid set-row setrow${set.done ? ' done' : ''}`}
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
                      <span className="set-previous mono">
                        {previous ? formatPreviousSet(previous, exercise.tracking, unit) : '—'}
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
                <button className="addset" onClick={() => addSet(exerciseIndex)}>
                  {t('workout.addSet')}
                </button>
                {exercise.sets.length > 1 && (
                  <button
                    className="addset exercise-block__remove-set"
                    onClick={() => removeSet(exerciseIndex)}
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

      {confirming && (
        <div className="sheet-scrim" role="dialog" aria-modal="true">
          <div className="sheet card card-pad stack">
            <strong>{t('workout.abandonTitle')}</strong>
            <span className="muted small">{t('workout.abandonBody')}</span>
            <button className="btn btn-danger btn-block" onClick={abandon}>
              {t('workout.abandonConfirm')}
            </button>
            <button className="btn btn-ghost btn-block" onClick={() => setConfirming(false)}>
              {t('workout.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
